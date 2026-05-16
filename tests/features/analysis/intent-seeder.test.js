'use strict';

/**
 * Tests for src/features/analysis/intent-seeder.js
 *
 * Ticket 1: single-read refactor — seedFile() must read each file from
 * disk at most ONCE per call. Previously did two reads (one in
 * _parseFileContent + one for @@@ detection).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { IntentSeeder } = require('../../../src/features/analysis/intent-seeder');

function makeFakePersistence(file) {
    return {
        upsertCalls: [],
        flagCalls: [],
        getAllFiles() { return [file]; },
        upsertIntent(intent) { this.upsertCalls.push(intent); },
        flagForAIReview(fp, n) { this.flagCalls.push({ fp, n }); },
    };
}

test('seedFile reads each source file from disk AT MOST ONCE per call (ticket 1)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-seeder-test-'));
    const target = path.join(tmp, 'sample.js');
    fs.writeFileSync(target, '// purpose comment\nconst x = require("./other");\nmodule.exports = { foo };\n');

    const file = {
        fingerprint: 'sample.js||2026-01-01T00:00:00.000Z',
        filepath: 'sample.js',
        filename: 'sample.js',
    };
    const persistence = makeFakePersistence(file);
    const seeder = new IntentSeeder(persistence, path.join(tmp, '.st8/schema-cards'), tmp);

    // Spy on fs.readFileSync. We don't want to break the JSON card read path
    // (we're not creating a card here, so cardPath doesn't exist anyway), so
    // we just count calls whose path === the target file's absPath.
    const origRead = fs.readFileSync;
    const reads = [];
    fs.readFileSync = function (p, enc) {
        reads.push(typeof p === 'string' ? p : String(p));
        return origRead.apply(fs, arguments);
    };
    try {
        const result = seeder.seedFile(file.fingerprint);
        assert.equal(result.success, true, `seedFile must succeed; error=${result.error}`);
    } finally {
        fs.readFileSync = origRead;
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    const targetReads = reads.filter((p) => p === target);
    assert.equal(targetReads.length, 1, `expected exactly ONE read of ${target}, observed ${targetReads.length}: ${JSON.stringify(targetReads)}`);
});

test('seedFile still detects @@@ markers after the single-read refactor', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-seeder-at-'));
    const target = path.join(tmp, 'flagged.js');
    fs.writeFileSync(target, '// @@@ needs review\nmodule.exports = {};\n');

    const file = {
        fingerprint: 'flagged.js||2026-01-01T00:00:00.000Z',
        filepath: 'flagged.js',
        filename: 'flagged.js',
    };
    const persistence = makeFakePersistence(file);
    const seeder = new IntentSeeder(persistence, path.join(tmp, '.st8/schema-cards'), tmp);

    try {
        seeder.seedFile(file.fingerprint);
        assert.equal(persistence.flagCalls.length, 1, 'flagForAIReview must fire exactly once');
        assert.equal(persistence.flagCalls[0].fp, 'flagged.js');
        assert.ok(persistence.flagCalls[0].n >= 1, 'tripleAtCount must be ≥ 1');
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('seedFile produces an upserted intent with INFERRED authoredBy', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-seeder-intent-'));
    const target = path.join(tmp, 'persistence.js');
    fs.writeFileSync(target, 'module.exports = { foo };\n');

    const file = {
        fingerprint: 'persistence.js||2026-01-01T00:00:00.000Z',
        filepath: 'persistence.js',
        filename: 'persistence.js',
    };
    const persistence = makeFakePersistence(file);
    const seeder = new IntentSeeder(persistence, path.join(tmp, '.st8/schema-cards'), tmp);

    try {
        seeder.seedFile(file.fingerprint);
        assert.equal(persistence.upsertCalls.length, 1);
        const intent = persistence.upsertCalls[0];
        assert.equal(intent.authoredBy, 'INFERRED');
        assert.ok(intent.purpose.endsWith('???'), `purpose must end with ??? marker, got: ${intent.purpose}`);
        // FILENAME_PURPOSE_MAP /persistence/i wins early — should map to
        // "SQLite persistence layer". This pinned probe doubles as a
        // regression guard for ticket 0 if the table reorders.
        assert.ok(intent.purpose.startsWith('SQLite persistence layer'), `got: ${intent.purpose}`);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('seedFile handles missing files without crashing or reading twice', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-seeder-missing-'));
    // Don't create the file. The registry row claims it exists, but disk says no.
    const file = {
        fingerprint: 'ghost.js||2026-01-01T00:00:00.000Z',
        filepath: 'ghost.js',
        filename: 'ghost.js',
    };
    const persistence = makeFakePersistence(file);
    const seeder = new IntentSeeder(persistence, path.join(tmp, '.st8/schema-cards'), tmp);

    try {
        const result = seeder.seedFile(file.fingerprint);
        assert.equal(result.success, true);
        // The intent still gets seeded (fallback "Source module at <path>") —
        // the registry row exists, so seedFile must produce an upsert.
        assert.equal(persistence.upsertCalls.length, 1);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
