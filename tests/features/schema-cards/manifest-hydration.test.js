'use strict';

/**
 * tests/features/schema-cards/manifest-hydration.test.js — Batch 032 (QW-1).
 *
 * Verifies the manifest-generator hydration added in batch 032:
 *   - importedBy[] is populated via reverse-walk of the connections table
 *     (filepath strings, NOT raw fingerprints — consumer ergonomics)
 *   - manifest.metadata.cycles[] carries the SCC list from
 *     persistence-cycle-detector (batch 031) or builder.js
 *   - imports[].targetFilepath is attached when a connection row resolves
 *
 * Pre-fix the field was declared in generateConnectionState's projection
 * but the upstream f.importedBy was always undefined → 0 of 322 files had
 * data. The fix wires options.persistence so the projection reads from
 * the live connections table instead of relying on upstream population.
 *
 * Uses a fakePersistence with just the methods generateConnectionState
 * calls (getConnectionsForFile). No real SQLite needed.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { generateConnectionState } = require('../../../src/features/schema-cards/manifest-generator');

const fp = (path, ts = '2026-01-01T00:00:00.000Z') => `${path}||${ts}`;

function fakePersistence(connections) {
    return {
        getConnectionsForFile(fingerprint) {
            return connections.filter(
                c => c.sourceFingerprint === fingerprint || c.targetFingerprint === fingerprint
            );
        },
    };
}

// ─── Backward compatibility ───────────────────────────────────

test('legacy call (no options) preserves pre-batch-032 projection', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'GREEN',
          sha256Hash: 'h', imports: [{ source: './b' }] },
    ];
    const m = generateConnectionState(files, '/tmp/x');
    assert.equal(m.files.length, 1);
    assert.deepEqual(m.files[0].importedBy, []);
    // cycles metadata exists but is empty
    assert.deepEqual(m.metadata.cycles, []);
    // imports passed through unchanged when no persistence
    assert.deepEqual(m.files[0].imports, [{ source: './b' }]);
});

// ─── importedBy reverse-walk ──────────────────────────────────

test('importedBy populated from connections table (filepath, not fingerprint)', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'GREEN', sha256Hash: 'h', imports: [] },
        { fingerprint: fp('b.js'), filepath: 'b.js', filename: 'b.js', status: 'GREEN', sha256Hash: 'h', imports: [] },
        { fingerprint: fp('c.js'), filepath: 'c.js', filename: 'c.js', status: 'GREEN', sha256Hash: 'h', imports: [] },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('b.js'), importSpecifier: './b' },
        { sourceFingerprint: fp('c.js'), targetFingerprint: fp('b.js'), importSpecifier: './b' },
    ];
    const m = generateConnectionState(files, '/tmp/x', {
        persistence: fakePersistence(connections),
    });
    const b = m.files.find(f => f.filepath === 'b.js');
    assert.deepEqual(b.importedBy.slice().sort(), ['a.js', 'c.js']);

    const a = m.files.find(f => f.filepath === 'a.js');
    assert.deepEqual(a.importedBy, []);
});

test('importedBy returns [] gracefully when persistence throws', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'GREEN', sha256Hash: 'h', imports: [] },
    ];
    const bad = {
        getConnectionsForFile() { throw new Error('db dropped'); },
    };
    const m = generateConnectionState(files, '/tmp/x', { persistence: bad });
    assert.deepEqual(m.files[0].importedBy, []);
});

test('importedBy on-file value (if pre-populated) wins over persistence query', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'GREEN',
          sha256Hash: 'h', imports: [], importedBy: ['precomputed.js'] },
    ];
    // Persistence would return something different; the pre-populated wins.
    const conns = [
        { sourceFingerprint: fp('other.js'), targetFingerprint: fp('a.js'), importSpecifier: './a' },
    ];
    const m = generateConnectionState(files, '/tmp/x', {
        persistence: fakePersistence(conns),
    });
    assert.deepEqual(m.files[0].importedBy, ['precomputed.js']);
});

// ─── imports[].targetFilepath resolution ──────────────────────

test('imports[].targetFilepath attached when connection row resolves', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'GREEN',
          sha256Hash: 'h', imports: [{ source: './b', names: ['B'] }] },
        { fingerprint: fp('b.js'), filepath: 'b.js', filename: 'b.js', status: 'GREEN', sha256Hash: 'h', imports: [] },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('b.js'), importSpecifier: './b' },
    ];
    const m = generateConnectionState(files, '/tmp/x', {
        persistence: fakePersistence(connections),
    });
    const a = m.files.find(f => f.filepath === 'a.js');
    assert.equal(a.imports.length, 1);
    assert.equal(a.imports[0].source, './b');
    assert.equal(a.imports[0].targetFilepath, 'b.js');
    assert.deepEqual(a.imports[0].names, ['B'], 'original fields preserved');
});

test('imports without a matching connection row → no targetFilepath added', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'GREEN',
          sha256Hash: 'h', imports: [{ source: 'fs' }] }, // Node builtin, not in conns
    ];
    const connections = []; // no resolutions
    const m = generateConnectionState(files, '/tmp/x', {
        persistence: fakePersistence(connections),
    });
    const imp = m.files[0].imports[0];
    assert.equal(imp.source, 'fs');
    assert.equal(imp.targetFilepath, undefined);
});

// ─── cycles in metadata ───────────────────────────────────────

test('cycles surface in manifest.metadata.cycles', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'RED', sha256Hash: 'h', imports: [] },
        { fingerprint: fp('b.js'), filepath: 'b.js', filename: 'b.js', status: 'RED', sha256Hash: 'h', imports: [] },
    ];
    const cycles = [
        { cycle: [fp('a.js'), fp('b.js')], files: ['a.js', 'b.js'] },
    ];
    const m = generateConnectionState(files, '/tmp/x', { cycles });
    assert.equal(m.metadata.cycles.length, 1);
    assert.deepEqual(m.metadata.cycles[0].files, ['a.js', 'b.js']);
});

test('cycles metadata is empty array (not undefined) for acyclic projects', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'GREEN', sha256Hash: 'h', imports: [] },
    ];
    const m = generateConnectionState(files, '/tmp/x');
    assert.deepEqual(m.metadata.cycles, []);
});

test('cycles malformed entries get coerced safely', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'RED', sha256Hash: 'h', imports: [] },
    ];
    const cycles = [
        null,
        { /* no files */ },
        { files: ['x', 'y'] },
        'not-a-cycle',
    ];
    const m = generateConnectionState(files, '/tmp/x', { cycles });
    assert.equal(m.metadata.cycles.length, 4);
    assert.deepEqual(m.metadata.cycles[2].files, ['x', 'y']);
});

// ─── Combined hydration ──────────────────────────────────────

test('full hydration: importedBy + targetFilepath + cycles in one call', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js', filename: 'a.js', status: 'YELLOW',
          sha256Hash: 'h', imports: [{ source: './b' }] },
        { fingerprint: fp('b.js'), filepath: 'b.js', filename: 'b.js', status: 'YELLOW',
          sha256Hash: 'h', imports: [{ source: './a' }] },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('b.js'), importSpecifier: './b' },
        { sourceFingerprint: fp('b.js'), targetFingerprint: fp('a.js'), importSpecifier: './a' },
    ];
    const cycles = [{ cycle: [fp('a.js'), fp('b.js')], files: ['a.js', 'b.js'] }];
    const m = generateConnectionState(files, '/tmp/x', {
        persistence: fakePersistence(connections),
        cycles,
    });
    const a = m.files.find(f => f.filepath === 'a.js');
    const b = m.files.find(f => f.filepath === 'b.js');
    assert.deepEqual(a.importedBy, ['b.js']);
    assert.deepEqual(b.importedBy, ['a.js']);
    assert.equal(a.imports[0].targetFilepath, 'b.js');
    assert.equal(b.imports[0].targetFilepath, 'a.js');
    assert.equal(m.metadata.cycles.length, 1);
});
