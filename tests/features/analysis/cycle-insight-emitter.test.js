'use strict';

/**
 * tests/features/analysis/cycle-insight-emitter.test.js — Batch 030.
 *
 * Covers the cycle-insight-emitter subscriber's pure-function entry
 * point (`emitCycleInsights`). Uses a fake InsightStore via the
 * `options.store` injection point — no real SQLite, no INDEX_COMPLETE
 * fire, no main.js boot. Mirrors the pattern used by
 * insight-store-populator.test.js (which constructs its own stub
 * persistence).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { emitCycleInsights } = require('../../../src/features/analysis/cycle-insight-emitter');

function makeFakeStore() {
    const calls = { ensureFileSlot: [], addInsightsBatch: [] };
    const store = {
        ensureFileSlot(projectId, filePath) {
            calls.ensureFileSlot.push({ projectId, filePath });
            // Stable per-(projectId, filePath) pseudo-id.
            return `slot_${projectId}_${filePath}`;
        },
        addInsightsBatch(insights) {
            calls.addInsightsBatch.push(insights);
            return insights.length;
        },
    };
    return { store, calls };
}

test('emitCycleInsights — no cycles → no insertions, no skips, no store calls', () => {
    const { store, calls } = makeFakeStore();
    const result = emitCycleInsights([], { store });
    assert.deepEqual(result, { inserted: 0, skipped: 0 });
    assert.equal(calls.ensureFileSlot.length, 0);
    assert.equal(calls.addInsightsBatch.length, 0);
});

test('emitCycleInsights — undefined / non-array → safe no-op', () => {
    const { store } = makeFakeStore();
    assert.deepEqual(emitCycleInsights(undefined, { store }), { inserted: 0, skipped: 0 });
    assert.deepEqual(emitCycleInsights(null, { store }), { inserted: 0, skipped: 0 });
    assert.deepEqual(emitCycleInsights('not-an-array', { store }), { inserted: 0, skipped: 0 });
});

test('emitCycleInsights — single cycle → 1 InsightRecord with canonical shape', () => {
    const { store, calls } = makeFakeStore();
    const cycles = [
        { cycle: ['n1', 'n2'], files: ['src/a.js', 'src/b.js'] },
    ];
    const result = emitCycleInsights(cycles, { store });
    assert.equal(result.inserted, 1);
    assert.equal(result.skipped, 0);
    assert.equal(calls.addInsightsBatch.length, 1);
    const batch = calls.addInsightsBatch[0];
    assert.equal(batch.length, 1);
    const insight = batch[0];
    assert.equal(insight.projectId, 'st8');
    assert.equal(insight.fileId, 'slot_st8_src/a.js');
    assert.equal(insight.filePath, 'src/a.js');
    assert.equal(insight.category, 'circular_dependency');
    assert.equal(insight.severity, 'high');
    assert.equal(insight.passNumber, 2);
    assert.match(insight.description, /Circular import dependency detected \(2 files\)/);
    assert.equal(insight.evidence, 'src/a.js → src/b.js → src/a.js');
    assert.deepEqual(insight.relatedNodeIds, ['n1', 'n2']);
    assert.deepEqual(insight.context, { participants: ['src/a.js', 'src/b.js'], length: 2 });
});

test('emitCycleInsights — multiple cycles → batch-emitted in order', () => {
    const { store, calls } = makeFakeStore();
    const cycles = [
        { cycle: ['n1', 'n2'], files: ['a.js', 'b.js'] },
        { cycle: ['n3', 'n4', 'n5'], files: ['x.js', 'y.js', 'z.js'] },
    ];
    const result = emitCycleInsights(cycles, { store });
    assert.equal(result.inserted, 2);
    assert.equal(result.skipped, 0);
    // One batch call (addInsightsBatch is the contract — populator does
    // the same single-batch insert).
    assert.equal(calls.addInsightsBatch.length, 1);
    const batch = calls.addInsightsBatch[0];
    assert.equal(batch.length, 2);
    assert.equal(batch[0].filePath, 'a.js');
    assert.equal(batch[1].filePath, 'x.js');
    assert.equal(batch[1].context.length, 3);
});

test('emitCycleInsights — cycle with no files field → skipped, not crashed', () => {
    const { store, calls } = makeFakeStore();
    const cycles = [
        { cycle: ['n1', 'n2'] }, // missing files
        { cycle: ['n3'], files: [] }, // empty files
        { cycle: ['n4', 'n5'], files: ['real.js', 'other.js'] }, // valid
    ];
    const result = emitCycleInsights(cycles, { store });
    assert.equal(result.inserted, 1);
    assert.equal(result.skipped, 2);
    const batch = calls.addInsightsBatch[0];
    assert.equal(batch.length, 1);
    assert.equal(batch[0].filePath, 'real.js');
});

test('emitCycleInsights — custom projectId is honored', () => {
    const { store, calls } = makeFakeStore();
    const cycles = [{ cycle: ['n1', 'n2'], files: ['a.js', 'b.js'] }];
    emitCycleInsights(cycles, { store, projectId: 'someOtherProject' });
    const insight = calls.addInsightsBatch[0][0];
    assert.equal(insight.projectId, 'someOtherProject');
    assert.equal(insight.fileId, 'slot_someOtherProject_a.js');
});

test('emitCycleInsights — evidence formats the full cycle path with closing edge back to start', () => {
    const { store, calls } = makeFakeStore();
    const cycles = [{ cycle: ['n1', 'n2', 'n3'], files: ['a.js', 'b.js', 'c.js'] }];
    emitCycleInsights(cycles, { store });
    const insight = calls.addInsightsBatch[0][0];
    assert.equal(insight.evidence, 'a.js → b.js → c.js → a.js');
});

test('emitCycleInsights — relatedNodeIds defaults to [] when cycle field is missing', () => {
    const { store, calls } = makeFakeStore();
    const cycles = [{ files: ['a.js', 'b.js'] }]; // no cycle field
    emitCycleInsights(cycles, { store });
    const insight = calls.addInsightsBatch[0][0];
    assert.deepEqual(insight.relatedNodeIds, []);
});
