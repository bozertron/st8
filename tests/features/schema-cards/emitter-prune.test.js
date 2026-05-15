'use strict';

/**
 * schema-cards/emitter.js prune-logic audit — ticket 9.
 *
 * The prune sweep at the end of emitAllCards() removes any *.json file
 * in .st8/schema-cards/ that doesn't correspond to a current
 * file_registry row. These probes exercise:
 *
 *   - PASS: cards exactly match registry → nothing pruned.
 *   - STALE: a card on disk has no registry row → pruned.
 *   - MULTI-FINGERPRINT (ticket-9 core): file_registry has TWO rows
 *     for the same filepath (different birthTimestamps), each with a
 *     card on disk. The newest wins; the other is pruned.
 *   - MIXED: 3 cards on disk, 2 stale + 1 live → exactly 1 remains.
 *   - JSON-ONLY FILTER: non-.json files are NOT touched by the prune.
 *   - PRUNE-COUNT REPORTING: the return value reports prunedCount.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { SchemaCardEmitter } = require('../../../src/features/schema-cards/emitter');

function mkFakePersistence(files) {
    return {
        getAllFiles() { return files.slice(); },
        getAllIntents() { return {}; },
        getMutationCount() { return 0; },
        getLastMutation() { return null; },
        getConnectionsForFile() { return []; },
    };
}

function mkFile(filepath, birthTimestamp) {
    return {
        fingerprint: `${filepath}||${birthTimestamp}`,
        filepath,
        filename: path.basename(filepath),
        sha256Hash: 'sha-abc',
        fileSizeBytes: 10,
        status: 'GREEN',
        reachabilityScore: 0.9,
        impactRadius: 0,
        lifecyclePhase: 'DEVELOPMENT',
        birthTimestamp,
        lastModified: birthTimestamp,
        lastIndexed: birthTimestamp,
        isEntryPoint: false,
    };
}

function withTmp(fn) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-prune-'));
    try { fn(tmp); }
    finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

test('PASS — cards exactly match registry: zero prunes', () => {
    withTmp((tmp) => {
        const emitter = new SchemaCardEmitter(tmp);
        const files = [mkFile('foo.js', '2026-01-01T00:00:00.000Z')];
        const result = emitter.emitAllCards(mkFakePersistence(files));
        assert.equal(result.emitted, 1);
        assert.equal(result.pruned, 0);
        const cards = fs.readdirSync(emitter.outputDir).filter((n) => n.endsWith('.json'));
        assert.deepEqual(cards, ['foo.js.json']);
    });
});

test('STALE — a leftover card with no registry row is unlinked', () => {
    withTmp((tmp) => {
        const emitter = new SchemaCardEmitter(tmp);
        // Plant a stale card BEFORE the emit pass
        fs.writeFileSync(path.join(emitter.outputDir, 'ghost.js.json'), '{}');

        const result = emitter.emitAllCards(mkFakePersistence([mkFile('live.js', '2026-01-01T00:00:00.000Z')]));
        assert.equal(result.pruned, 1, 'ghost.js.json must be pruned');
        const cards = fs.readdirSync(emitter.outputDir).filter((n) => n.endsWith('.json')).sort();
        assert.deepEqual(cards, ['live.js.json']);
    });
});

test('MULTI-FINGERPRINT — two registry rows for same filepath: newest wins, no duplicate', () => {
    withTmp((tmp) => {
        const emitter = new SchemaCardEmitter(tmp);
        const older = mkFile('app.js', '2026-01-01T00:00:00.000Z');
        const newer = mkFile('app.js', '2026-05-15T00:00:00.000Z');
        newer.sha256Hash = 'sha-NEWER'; // distinguishable
        // Order in the persistence layer is non-deterministic — exercise both.
        const result = emitter.emitAllCards(mkFakePersistence([older, newer]));
        assert.equal(result.emitted, 1, 'exactly one emit (dedup by filepath)');
        const cardPath = path.join(emitter.outputDir, 'app.js.json');
        const card = JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
        assert.equal(card.sha256Hash, 'sha-NEWER', 'newer birthTimestamp must win');
        assert.equal(card.birthTimestamp, '2026-05-15T00:00:00.000Z');
    });
});

test('MULTI-FINGERPRINT — reverse order in getAllFiles: still newest wins', () => {
    withTmp((tmp) => {
        const emitter = new SchemaCardEmitter(tmp);
        const newer = mkFile('app.js', '2026-05-15T00:00:00.000Z');
        newer.sha256Hash = 'sha-NEWER';
        const older = mkFile('app.js', '2026-01-01T00:00:00.000Z');
        const result = emitter.emitAllCards(mkFakePersistence([newer, older]));
        assert.equal(result.emitted, 1);
        const card = JSON.parse(fs.readFileSync(path.join(emitter.outputDir, 'app.js.json'), 'utf-8'));
        assert.equal(card.sha256Hash, 'sha-NEWER');
    });
});

test('MIXED — 3 cards on disk, 2 stale + 1 live: exactly 1 remains', () => {
    withTmp((tmp) => {
        const emitter = new SchemaCardEmitter(tmp);
        fs.writeFileSync(path.join(emitter.outputDir, 'stale1.js.json'), '{}');
        fs.writeFileSync(path.join(emitter.outputDir, 'stale2.js.json'), '{}');
        const result = emitter.emitAllCards(mkFakePersistence([mkFile('live.js', '2026-05-15T00:00:00.000Z')]));
        assert.equal(result.pruned, 2);
        const remaining = fs.readdirSync(emitter.outputDir).filter((n) => n.endsWith('.json')).sort();
        assert.deepEqual(remaining, ['live.js.json']);
    });
});

test('JSON-ONLY FILTER — non-.json files are NOT pruned', () => {
    withTmp((tmp) => {
        const emitter = new SchemaCardEmitter(tmp);
        const sidecar = path.join(emitter.outputDir, 'README.txt');
        fs.writeFileSync(sidecar, 'do not delete me');
        const lockfile = path.join(emitter.outputDir, '.lock');
        fs.writeFileSync(lockfile, '');

        emitter.emitAllCards(mkFakePersistence([mkFile('live.js', '2026-05-15T00:00:00.000Z')]));
        assert.ok(fs.existsSync(sidecar), 'README.txt must survive prune');
        assert.ok(fs.existsSync(lockfile), '.lock must survive prune');
    });
});

test('PATH-FLATTENING — nested filepaths produce predictable card names', () => {
    withTmp((tmp) => {
        const emitter = new SchemaCardEmitter(tmp);
        const result = emitter.emitAllCards(mkFakePersistence([
            mkFile('src/features/foo.js', '2026-05-15T00:00:00.000Z'),
        ]));
        assert.equal(result.emitted, 1);
        const cards = fs.readdirSync(emitter.outputDir).filter((n) => n.endsWith('.json'));
        assert.deepEqual(cards, ['src_features_foo.js.json']);
    });
});

test('NEW-OUTPUT-DIR — empty dir, two new files: both cards land, no prune', () => {
    withTmp((tmp) => {
        const emitter = new SchemaCardEmitter(tmp);
        const result = emitter.emitAllCards(mkFakePersistence([
            mkFile('a.js', '2026-01-01T00:00:00.000Z'),
            mkFile('b.js', '2026-01-02T00:00:00.000Z'),
        ]));
        assert.equal(result.emitted, 2);
        assert.equal(result.pruned, 0);
        const cards = fs.readdirSync(emitter.outputDir).filter((n) => n.endsWith('.json')).sort();
        assert.deepEqual(cards, ['a.js.json', 'b.js.json']);
    });
});
