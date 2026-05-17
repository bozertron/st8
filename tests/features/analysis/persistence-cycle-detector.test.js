'use strict';

/**
 * tests/features/analysis/persistence-cycle-detector.test.js — Batch 030 follow-up.
 *
 * Covers detectCyclesFromPersistence + mergeCycles. Uses a stub
 * persistence with the minimum read surface (getAllFiles +
 * getAllConnections). No real SQLite needed.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    detectCyclesFromPersistence,
    mergeCycles,
} = require('../../../src/features/analysis/persistence-cycle-detector');

function fakePersistence(files, connections) {
    return {
        getAllFiles() { return files; },
        getAllConnections() { return connections; },
    };
}

// Helper: fingerprint factory consistent with the bible's identity
// invariant (fingerprint = "filepath||birthTimestamp").
const fp = (filepath, ts = '2026-01-01T00:00:00.000Z') => `${filepath}||${ts}`;

// ─── detectCyclesFromPersistence ────────────────────────────────

test('returns [] when persistence is missing or malformed', () => {
    assert.deepEqual(detectCyclesFromPersistence(null), []);
    assert.deepEqual(detectCyclesFromPersistence(undefined), []);
    assert.deepEqual(detectCyclesFromPersistence({}), []);
    assert.deepEqual(detectCyclesFromPersistence({ getAllFiles: () => [] }), []);
});

test('returns [] when there are no files or no connections', () => {
    const p1 = fakePersistence([], []);
    assert.deepEqual(detectCyclesFromPersistence(p1), []);

    const p2 = fakePersistence([{ fingerprint: fp('a.js'), filepath: 'a.js' }], []);
    assert.deepEqual(detectCyclesFromPersistence(p2), []);
});

test('returns [] for an acyclic graph', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js' },
        { fingerprint: fp('b.js'), filepath: 'b.js' },
        { fingerprint: fp('c.js'), filepath: 'c.js' },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('b.js') },
        { sourceFingerprint: fp('b.js'), targetFingerprint: fp('c.js') },
    ];
    const cycles = detectCyclesFromPersistence(fakePersistence(files, connections));
    assert.deepEqual(cycles, []);
});

test('detects a simple 2-node cycle A→B→A', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js' },
        { fingerprint: fp('b.js'), filepath: 'b.js' },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('b.js') },
        { sourceFingerprint: fp('b.js'), targetFingerprint: fp('a.js') },
    ];
    const cycles = detectCyclesFromPersistence(fakePersistence(files, connections));
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].cycle.length, 2);
    // Member ordering follows Tarjan's SCC pop order — exact order is
    // implementation-defined, so just assert the SET of participants.
    assert.deepEqual(cycles[0].cycle.slice().sort(), [fp('a.js'), fp('b.js')].sort());
    assert.deepEqual(cycles[0].files.slice().sort(), ['a.js', 'b.js']);
});

test('detects a 3-node cycle A→B→C→A and not an unrelated tail', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js' },
        { fingerprint: fp('b.js'), filepath: 'b.js' },
        { fingerprint: fp('c.js'), filepath: 'c.js' },
        { fingerprint: fp('tail.js'), filepath: 'tail.js' },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('b.js') },
        { sourceFingerprint: fp('b.js'), targetFingerprint: fp('c.js') },
        { sourceFingerprint: fp('c.js'), targetFingerprint: fp('a.js') },
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('tail.js') },
    ];
    const cycles = detectCyclesFromPersistence(fakePersistence(files, connections));
    assert.equal(cycles.length, 1);
    assert.equal(cycles[0].cycle.length, 3);
    assert.deepEqual(cycles[0].files.slice().sort(), ['a.js', 'b.js', 'c.js']);
});

test('detects two disjoint cycles', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js' },
        { fingerprint: fp('b.js'), filepath: 'b.js' },
        { fingerprint: fp('x.js'), filepath: 'x.js' },
        { fingerprint: fp('y.js'), filepath: 'y.js' },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('b.js') },
        { sourceFingerprint: fp('b.js'), targetFingerprint: fp('a.js') },
        { sourceFingerprint: fp('x.js'), targetFingerprint: fp('y.js') },
        { sourceFingerprint: fp('y.js'), targetFingerprint: fp('x.js') },
    ];
    const cycles = detectCyclesFromPersistence(fakePersistence(files, connections));
    assert.equal(cycles.length, 2);
    const allParticipants = cycles.flatMap(c => c.files).sort();
    assert.deepEqual(allParticipants, ['a.js', 'b.js', 'x.js', 'y.js']);
});

test('skips self-loops (treats "A imports A" as a malformed edge)', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js' },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('a.js') },
    ];
    const cycles = detectCyclesFromPersistence(fakePersistence(files, connections));
    assert.deepEqual(cycles, []);
});

test('skips edges whose endpoints are not in file_registry (no dangling-edge crashes)', () => {
    const files = [
        { fingerprint: fp('a.js'), filepath: 'a.js' },
        { fingerprint: fp('b.js'), filepath: 'b.js' },
    ];
    const connections = [
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('b.js') },
        { sourceFingerprint: fp('b.js'), targetFingerprint: fp('a.js') },
        // Dangling edge — endpoint not in files
        { sourceFingerprint: fp('a.js'), targetFingerprint: fp('ghost.js') },
        { sourceFingerprint: fp('phantom.js'), targetFingerprint: fp('b.js') },
    ];
    const cycles = detectCyclesFromPersistence(fakePersistence(files, connections));
    assert.equal(cycles.length, 1);
    assert.deepEqual(cycles[0].files.slice().sort(), ['a.js', 'b.js']);
});

// ─── mergeCycles ────────────────────────────────────────────────

test('mergeCycles: empty / non-array inputs → []', () => {
    assert.deepEqual(mergeCycles(), []);
    assert.deepEqual(mergeCycles([], []), []);
    assert.deepEqual(mergeCycles(null, undefined, 'not-an-array'), []);
});

test('mergeCycles: passes through unique cycles unchanged', () => {
    const c1 = { cycle: ['fp1', 'fp2'], files: ['a.js', 'b.js'] };
    const c2 = { cycle: ['fp3', 'fp4'], files: ['x.js', 'y.js'] };
    const merged = mergeCycles([c1], [c2]);
    assert.equal(merged.length, 2);
});

test('mergeCycles: dedups two cycles with the same member set', () => {
    const c1 = { cycle: ['fp1', 'fp2'], files: ['a.js', 'b.js'] };
    const c2 = { cycle: ['fp2', 'fp1'], files: ['b.js', 'a.js'] }; // same set, different order
    const merged = mergeCycles([c1], [c2]);
    assert.equal(merged.length, 1);
    // First source wins (deterministic)
    assert.deepEqual(merged[0], c1);
});

test('mergeCycles: dedups across more than 2 sources + handles 3-member cycles by SET, not order', () => {
    const cA = { cycle: ['fp1', 'fp2', 'fp3'], files: ['a.js', 'b.js', 'c.js'] };
    const cB = { cycle: ['fp3', 'fp1', 'fp2'], files: ['c.js', 'a.js', 'b.js'] }; // rotation
    const cC = { cycle: ['fp4', 'fp5'], files: ['x.js', 'y.js'] };
    const merged = mergeCycles([cA], [cB], [cC]);
    assert.equal(merged.length, 2);
});

test('mergeCycles: skips cycles with < 2 members', () => {
    const merged = mergeCycles([{ cycle: ['fp1'], files: ['a.js'] }, { cycle: [], files: [] }]);
    assert.deepEqual(merged, []);
});
