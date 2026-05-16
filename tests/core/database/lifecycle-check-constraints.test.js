'use strict';

/**
 * tests/core/database/lifecycle-check-constraints.test.js — Wave 4B ticket 5.
 *
 * Proves that the CHECK constraints on file_registry.lifecyclePhase and
 * file_registry.brunoStatus actually fire on a fresh DB (i.e. they made
 * it into ST8_SCHEMA and survived initialize()).
 *
 * Notes:
 *   - CHECK constraints only land in NEW databases. Existing DBs retain
 *     the un-constrained column shape until a migration framework is
 *     added (deferred to P1.1 persistence roadmap). These tests build a
 *     fresh DB per case.
 *   - sessionsSinceAccess is also not constrained here — the goal is to
 *     verify the two enum-style columns.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Persistence } = require('../../../src/core/database/persistence');

function freshTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'st8-lifecycle-check-'));
}

function freshPersistence() {
    const dir = freshTempDir();
    const origCwd = process.cwd();
    process.chdir(dir);
    const p = new St8Persistence();
    p.initialize();
    return { persistence: p, cleanup: () => { try { p.close(); } catch (_) {} process.chdir(origCwd); } };
}

test('lifecyclePhase CHECK accepts every canonical enum value', () => {
    const { persistence, cleanup } = freshPersistence();
    try {
        const valid = ['CONCEPT', 'LOCKED', 'WIRING', 'DEVELOPMENT', 'PRODUCTION'];
        const stmt = persistence.db.prepare(
            `INSERT INTO file_registry (fingerprint, filepath, filename, sha256Hash, lifecyclePhase)
             VALUES (?, ?, ?, ?, ?)`
        );
        for (const phase of valid) {
            stmt.run(`fp-${phase}`, `f/${phase}.js`, `${phase}.js`, 'abc', phase);
        }
        const rows = persistence.db.prepare('SELECT lifecyclePhase FROM file_registry ORDER BY lifecyclePhase').all();
        assert.equal(rows.length, valid.length);
        const set = new Set(rows.map((r) => r.lifecyclePhase));
        for (const v of valid) assert.ok(set.has(v), `missing ${v}`);
    } finally {
        cleanup();
    }
});

test('lifecyclePhase CHECK rejects typos like PORDUCTION / staging / random', () => {
    const { persistence, cleanup } = freshPersistence();
    try {
        const bad = ['PORDUCTION', 'staging', 'development', 'unknown', 'STAGING'];
        const stmt = persistence.db.prepare(
            `INSERT INTO file_registry (fingerprint, filepath, filename, sha256Hash, lifecyclePhase)
             VALUES (?, ?, ?, ?, ?)`
        );
        for (const phase of bad) {
            assert.throws(
                () => stmt.run(`fp-${phase}`, `f/${phase}.js`, `${phase}.js`, 'abc', phase),
                /CHECK constraint failed/i,
                `expected CHECK to reject "${phase}"`,
            );
        }
    } finally {
        cleanup();
    }
});

test('brunoStatus CHECK accepts active / flagged / archived', () => {
    const { persistence, cleanup } = freshPersistence();
    try {
        const valid = ['active', 'flagged', 'archived'];
        const stmt = persistence.db.prepare(
            `INSERT INTO file_registry (fingerprint, filepath, filename, sha256Hash, brunoStatus)
             VALUES (?, ?, ?, ?, ?)`
        );
        for (const s of valid) {
            stmt.run(`fp-b-${s}`, `b/${s}.js`, `${s}.js`, 'abc', s);
        }
        const rows = persistence.db.prepare('SELECT brunoStatus FROM file_registry ORDER BY brunoStatus').all();
        assert.equal(rows.length, valid.length);
        const set = new Set(rows.map((r) => r.brunoStatus));
        for (const v of valid) assert.ok(set.has(v), `missing ${v}`);
    } finally {
        cleanup();
    }
});

test('brunoStatus CHECK rejects typos like ACTIVE / archive / random', () => {
    const { persistence, cleanup } = freshPersistence();
    try {
        const bad = ['ACTIVE', 'Active', 'archive', 'flag', 'unknown'];
        const stmt = persistence.db.prepare(
            `INSERT INTO file_registry (fingerprint, filepath, filename, sha256Hash, brunoStatus)
             VALUES (?, ?, ?, ?, ?)`
        );
        for (const s of bad) {
            assert.throws(
                () => stmt.run(`fp-b-${s}`, `b/${s}.js`, `${s}.js`, 'abc', s),
                /CHECK constraint failed/i,
                `expected CHECK to reject "${s}"`,
            );
        }
    } finally {
        cleanup();
    }
});

test('defaults still land — no lifecyclePhase / brunoStatus → DEVELOPMENT / active', () => {
    const { persistence, cleanup } = freshPersistence();
    try {
        persistence.db.prepare(
            `INSERT INTO file_registry (fingerprint, filepath, filename, sha256Hash) VALUES (?, ?, ?, ?)`
        ).run('fp-default', 'd/default.js', 'default.js', 'abc');
        const row = persistence.db.prepare('SELECT lifecyclePhase, brunoStatus FROM file_registry WHERE fingerprint = ?').get('fp-default');
        assert.equal(row.lifecyclePhase, 'DEVELOPMENT');
        assert.equal(row.brunoStatus, 'active');
    } finally {
        cleanup();
    }
});
