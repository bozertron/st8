'use strict';

/**
 * cycle-insight-emitter — INDEX_COMPLETE subscriber that emits canonical
 * `circular_dependency` InsightRecords for each cycle detected by the
 * graph builder.
 *
 * Batch 030 — first slice of the sonic-and-search roadmap's "P2 Layer 2
 * Pass-2 — Dependency Health" (see docs/_pending-roadmap/sonic-and-search.md).
 * The roadmap explicitly endorses the per-pass-as-hook-subscriber pattern:
 *
 *   > "Probably simpler to have each pass be its own hook subscriber,
 *    no central BackgroundIndexer coordinator."
 *
 * This module is that subscriber for the cycle-detection pass. It uses
 * the SAME storage path as the existing insight-store-populator
 * (`insightStore.addInsightsBatch`), so:
 *   - One writer per pass; no central coordinator.
 *   - Canonical category name from `docs/Insight Store/insightStore.ts`
 *     (the InsightCategory enum): 'circular_dependency'.
 *   - Severity 'high' — a cycle is always a fixable architectural issue.
 *
 * Note on data flow: cycle data is computed inside
 * `src/features/graph/builder.js:detectCircularDependencies` and was
 * previously discarded by `indexer.js`'s CR-02 transformation. Batch 030
 * extended indexer.js to surface `cycles` in indexDirectory's return,
 * which main.js threads into the INDEX_COMPLETE hook context as
 * `ctx.result.cycles`. This subscriber consumes that.
 *
 * Cycle shape (per builder.js):
 *   { cycle: [nodeId1, nodeId2, ...], files: ['path1', 'path2', ...] }
 *
 * One InsightRecord is emitted per detected cycle, attached to the FIRST
 * file in the cycle. (Future pass: emit one per participant if founder
 * prefers that shape — currently keep it tight to avoid record blow-up.)
 */

// Lazy-required so test sandboxes can stub the module.
const insightStoreModule = require('./insight-store');

const PROJECT_ID_DEFAULT = 'st8';
const PASS_NUMBER = 2; // Pass 2 = "Dependency Health" per the vision doc.

/**
 * Emit one `circular_dependency` insight per detected cycle.
 *
 * @param {Array<{cycle: string[], files: string[]}>} cycles
 *   Cycle records from buildDependencyGraph.
 * @param {object} options
 *   - projectId: defaults to 'st8'
 *   - store: optional InsightStore override (tests pass a temp one)
 * @returns {{inserted: number, skipped: number}}
 */
function emitCycleInsights(cycles, options = {}) {
    const projectId = options.projectId || PROJECT_ID_DEFAULT;

    if (!Array.isArray(cycles) || cycles.length === 0) {
        return { inserted: 0, skipped: 0 };
    }

    // Late binding via the module reference (matches the populator's
    // pattern at insight-store-populator.js:38) so tests can swap
    // getInsightStore.
    const store = options.store || insightStoreModule.getInsightStore();

    const insights = [];
    let skipped = 0;

    for (const c of cycles) {
        const files = Array.isArray(c && c.files) ? c.files.filter(Boolean) : [];
        if (files.length === 0) {
            skipped++;
            continue;
        }
        const filePath = files[0];
        const fileId = store.ensureFileSlot(projectId, filePath);
        const cyclePath = files.join(' → ') + ' → ' + files[0];
        insights.push({
            projectId,
            fileId,
            filePath,
            passNumber: PASS_NUMBER,
            category: 'circular_dependency',
            severity: 'high',
            description: `Circular import dependency detected (${files.length} files)`,
            evidence: cyclePath,
            relatedNodeIds: Array.isArray(c.cycle) ? c.cycle : [],
            context: { participants: files, length: files.length },
        });
    }

    const inserted = insights.length > 0 ? store.addInsightsBatch(insights) : 0;
    return { inserted, skipped };
}

module.exports = { emitCycleInsights };
