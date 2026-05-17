'use strict';

/**
 * tests/features/analysis/gap-analyzer-insight-adapter.test.js — Batch 032 (QW-2).
 *
 * Unit tests for emitGapAnalysisInsights — the pure function that maps
 * GapAnalyzer's D1–D6 report onto canonical InsightRecord rows. Uses a
 * fake InsightStore via options.store injection (matches the pattern
 * established by cycle-insight-emitter.test.js).
 *
 * Coverage:
 *   - shape-locks: each D-dimension maps to its documented canonical category
 *   - no D-dimension cross-contamination
 *   - 4 canonical categories produced from one MVP report (structural,
 *     dependency, api_surface, documentation)
 *   - missing-D-section + malformed entries → safe no-op
 *   - byCategory + inserted + skipped counters match the actual emit
 *   - synthetic (architecture) filepath for D6 missingEndpoints when
 *     no handlerModule provided
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { emitGapAnalysisInsights, PASS_NUMBER } =
    require('../../../src/features/analysis/gap-analyzer-insight-adapter');

function makeFakeStore() {
    const calls = { ensureFileSlot: [], addInsightsBatch: [] };
    const store = {
        ensureFileSlot(projectId, filePath) {
            calls.ensureFileSlot.push({ projectId, filePath });
            return `slot_${projectId}_${filePath}`;
        },
        addInsightsBatch(insights) {
            calls.addInsightsBatch.push(insights);
            return insights.length;
        },
    };
    return { store, calls };
}

// ─── Empty / malformed inputs ─────────────────────────────────

test('empty gap report → no inserts, no calls', () => {
    const { store, calls } = makeFakeStore();
    const result = emitGapAnalysisInsights({}, null, { store });
    assert.equal(result.inserted, 0);
    assert.equal(result.skipped, 0);
    assert.equal(calls.addInsightsBatch.length, 0);
});

test('null / non-object gap report → safe no-op', () => {
    const { store } = makeFakeStore();
    assert.equal(emitGapAnalysisInsights(null, null, { store }).inserted, 0);
    assert.equal(emitGapAnalysisInsights(undefined, null, { store }).inserted, 0);
    assert.equal(emitGapAnalysisInsights('not-a-report', null, { store }).inserted, 0);
});

// ─── D2 → structural ──────────────────────────────────────────

test('D2 redFiles → structural / high InsightRecords', () => {
    const { store, calls } = makeFakeStore();
    const report = {
        D2_status: {
            redFiles: [
                { filepath: 'src/a.js', reachabilityScore: 0,
                  rootCauses: ['no importers', 'no exports'] },
                { filepath: 'src/b.js', reachabilityScore: 0.1,
                  rootCauses: ['low reach'] },
            ],
        },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.inserted, 2);
    assert.equal(result.byCategory.structural, 2);
    const batch = calls.addInsightsBatch[0];
    assert.equal(batch[0].category, 'structural');
    assert.equal(batch[0].severity, 'high');
    assert.match(batch[0].description, /Structural gap/);
    assert.match(batch[0].evidence, /reachabilityScore=0/);
    assert.deepEqual(batch[0].context.rootCauses, ['no importers', 'no exports']);
    assert.equal(batch[0].passNumber, PASS_NUMBER);
});

// ─── D5 → dependency ──────────────────────────────────────────

test('D5 orphanImports → dependency / high InsightRecords', () => {
    const { store, calls } = makeFakeStore();
    const report = {
        D5_connections: {
            orphanImports: [
                { source: 'src/foo.js', target: 'src/missing.js' },
                { source: 'src/bar.js', target: 'lib/gone.js' },
            ],
        },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.inserted, 2);
    assert.equal(result.byCategory.dependency, 2);
    const batch = calls.addInsightsBatch[0];
    assert.equal(batch[0].category, 'dependency');
    assert.equal(batch[0].severity, 'high');
    assert.equal(batch[0].filePath, 'src/foo.js');
    assert.match(batch[0].description, /Broken dependency/);
    assert.equal(batch[0].context.target, 'src/missing.js');
});

// ─── D4 zero exports → api_surface (medium) ───────────────────

test('D4 zero-export files → api_surface / medium', () => {
    const { store, calls } = makeFakeStore();
    const report = {
        D4_exports: {
            exportDetails: [
                { filepath: 'src/silent.js', exportCount: 0 },
                { filepath: 'src/loud.js', exportCount: 5 },     // skipped
                { filepath: 'src/another.js', exportCount: 0 },
            ],
        },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.inserted, 2);
    assert.equal(result.byCategory.api_surface, 2);
    const batch = calls.addInsightsBatch[0];
    for (const i of batch) {
        assert.equal(i.category, 'api_surface');
        assert.equal(i.severity, 'medium');
        assert.match(i.description, /No exports declared/);
    }
});

// ─── D6 missing endpoints → api_surface (critical) ────────────

test('D6 missingEndpoints → api_surface / critical with synthetic filepath fallback', () => {
    const { store, calls } = makeFakeStore();
    const report = {
        D6_architecture: {
            missingEndpoints: [
                { endpoint: '/api/foo', requiredModule: 'src/features/foo.js' },
                { endpoint: '/api/bar' }, // no module → synthetic (architecture)
            ],
        },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.inserted, 2);
    assert.equal(result.byCategory.api_surface, 2);
    const batch = calls.addInsightsBatch[0];
    assert.equal(batch[0].filePath, 'src/features/foo.js');
    assert.equal(batch[0].severity, 'critical');
    assert.match(batch[0].description, /Documented endpoint missing/);
    assert.equal(batch[1].filePath, '(architecture)',
        'no requiredModule → synthetic architecture filepath');
});

test('D4 + D6 both emit api_surface — combined count = D4 + D6', () => {
    const { store } = makeFakeStore();
    const report = {
        D4_exports: { exportDetails: [{ filepath: 'a.js', exportCount: 0 }] },
        D6_architecture: { missingEndpoints: [{ endpoint: '/api/x', requiredModule: 'b.js' }] },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.byCategory.api_surface, 2);
});

// ─── D3 → documentation (medium) ──────────────────────────────

test('D3 unauthored → documentation / medium', () => {
    const { store, calls } = makeFakeStore();
    const report = {
        D3_intent: {
            unauthored: [
                { filepath: 'src/silent.js', hasValueStatement: false },
                { filepath: 'src/quiet.js', hasValueStatement: true },
            ],
        },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.inserted, 2);
    assert.equal(result.byCategory.documentation, 2);
    const batch = calls.addInsightsBatch[0];
    assert.equal(batch[0].severity, 'medium');
    assert.match(batch[0].description, /Missing purpose\/intent/);
    assert.match(batch[0].evidence, /hasValueStatement=false/);
});

// ─── D1 → documentation (low) ─────────────────────────────────

test('D1 canProgress → documentation / low', () => {
    const { store, calls } = makeFakeStore();
    const report = {
        D1_lifecycle: {
            canProgress: [
                { filepath: 'src/ready.js', currentPhase: 'DEVELOPMENT', hasPurpose: true },
            ],
        },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.inserted, 1);
    assert.equal(result.byCategory.documentation, 1);
    const insight = calls.addInsightsBatch[0][0];
    assert.equal(insight.severity, 'low');
    assert.match(insight.description, /Lifecycle progression ready/);
});

test('D1 + D3 both emit documentation — combined count = D1 + D3', () => {
    const { store } = makeFakeStore();
    const report = {
        D1_lifecycle: { canProgress: [{ filepath: 'a.js', currentPhase: 'DEVELOPMENT' }] },
        D3_intent: { unauthored: [{ filepath: 'b.js' }, { filepath: 'c.js' }] },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.byCategory.documentation, 3);
});

// ─── End-to-end MVP coverage ─────────────────────────────────

test('full MVP report → 4 canonical categories produced in one call', () => {
    const { store } = makeFakeStore();
    const report = {
        D1_lifecycle: { canProgress: [{ filepath: 'a.js' }] },
        D2_status: { redFiles: [{ filepath: 'b.js', rootCauses: ['orphan'] }] },
        D3_intent: { unauthored: [{ filepath: 'c.js' }] },
        D4_exports: { exportDetails: [{ filepath: 'd.js', exportCount: 0 }] },
        D5_connections: { orphanImports: [{ source: 'e.js', target: 'gone.js' }] },
        D6_architecture: { missingEndpoints: [{ endpoint: '/api/x', requiredModule: 'f.js' }] },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    // 4 canonical categories produced
    assert.equal(result.byCategory.structural, 1);
    assert.equal(result.byCategory.dependency, 1);
    assert.equal(result.byCategory.api_surface, 2);    // D4 + D6
    assert.equal(result.byCategory.documentation, 2);  // D1 + D3
    assert.equal(result.inserted, 6);
});

// ─── Hygiene ─────────────────────────────────────────────────

test('entries without filepath are skipped (not crashed)', () => {
    const { store } = makeFakeStore();
    const report = {
        D2_status: {
            redFiles: [
                { reachabilityScore: 0, rootCauses: ['no path'] },  // missing filepath
                { filepath: 'good.js', rootCauses: ['fine'] },
            ],
        },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.inserted, 1);
    assert.equal(result.skipped, 1);
});

test('custom projectId is propagated', () => {
    const { store, calls } = makeFakeStore();
    const report = { D2_status: { redFiles: [{ filepath: 'a.js', rootCauses: [] }] } };
    emitGapAnalysisInsights(report, null, { store, projectId: 'someOtherProject' });
    assert.equal(calls.addInsightsBatch[0][0].projectId, 'someOtherProject');
    assert.equal(calls.addInsightsBatch[0][0].fileId, 'slot_someOtherProject_a.js');
});

test('store.ensureFileSlot throwing → file skipped, others continue', () => {
    const calls = { addInsightsBatch: [] };
    const store = {
        ensureFileSlot(p, fp) {
            if (fp === 'bomb.js') throw new Error('store error');
            return 'slot_' + fp;
        },
        addInsightsBatch(insights) {
            calls.addInsightsBatch.push(insights);
            return insights.length;
        },
    };
    const report = {
        D2_status: {
            redFiles: [
                { filepath: 'good.js', rootCauses: ['fine'] },
                { filepath: 'bomb.js', rootCauses: ['boom'] },
                { filepath: 'also-good.js', rootCauses: ['fine'] },
            ],
        },
    };
    const result = emitGapAnalysisInsights(report, null, { store });
    assert.equal(result.inserted, 2);
    assert.equal(result.skipped, 1);
});
