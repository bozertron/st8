'use strict';

/**
 * gap-analyzer-insight-adapter — re-emit GapAnalyzer's D1–D6 output as
 * canonical InsightRecords from `docs/Insight Store/insightStore.ts`'s
 * 13-value InsightCategory enum.
 *
 * Batch 032 (QW-2). Third canonical-category producer after batch 030/031's
 * cycle-insight-emitter (`circular_dependency`). This single producer
 * unlocks FOUR canonical categories in one ticket by mapping six gap-
 * analyzer dimensions:
 *
 *   D2 redFiles              → category: 'structural',   severity: 'high'
 *   D5 orphanImports         → category: 'dependency',   severity: 'high'
 *   D4 files with no exports → category: 'api_surface',  severity: 'medium'
 *   D6 missingEndpoints      → category: 'api_surface',  severity: 'critical'
 *   D3 unauthored            → category: 'documentation', severity: 'medium'
 *   D1 canProgress           → category: 'documentation', severity: 'low'
 *
 * Net canonical coverage delta (across the 13-enum):
 *   Pre-batch-032: 1 (circular_dependency)
 *   Post-batch-032: 5 (+ structural, dependency, api_surface, documentation)
 *
 * Registered as an INDEX_COMPLETE subscriber at P=38 — AFTER
 * insight-store-populator (P=35) and cycle-insight-emitter (P=37) so
 * populator's clearProject(projectId) has already run. The adapter does
 * NOT itself call clearProject, mirroring cycle-insight-emitter's
 * pattern: canonical-category emitters add records to the snapshot the
 * populator just seeded; they don't compete with it.
 *
 * Performance: O(N) over schema cards. Re-runs analyzer.analyze() rather
 * than threading the existing P=30 gap-analyzer subscriber's report
 * through ctx — keeps subscribers loosely coupled and avoids gap-analyzer
 * regression risk if its ctx contract ever changes.
 *
 * Reference contract:
 *   docs/Insight Store/insightStore.ts (13-value enum + InsightRecord)
 *   docs/_pending-roadmap/sonic-and-search.md (P2 Layer 2 — "each pass
 *     be its own hook subscriber, no central BackgroundIndexer coordinator")
 *   st8_bible.md batch 030 (the type-failure pattern + recipe A)
 */

const path = require('path');

const insightStoreModule = require('./insight-store');

const PROJECT_ID_DEFAULT = 'st8';
const PASS_NUMBER = 3; // Pass 3 = "Pattern Detection" (closest match in
                       // the sonic roadmap's 5-pass vision) — distinct
                       // from cycle-emitter's pass=2.

const SYNTHETIC_ARCH_FILEPATH = '(architecture)';

/**
 * Build the canonical InsightRecord set from a gap-analyzer report +
 * persistence (for fileId derivation). Returns counts + inserted total.
 *
 * @param {object} gapReport — output of GapAnalyzer.analyze()
 * @param {object} persistence — St8Persistence (used to drive store.ensureFileSlot)
 * @param {object} options — { projectId, store }
 * @returns {{inserted: number, byCategory: object, skipped: number}}
 */
function emitGapAnalysisInsights(gapReport, persistence, options = {}) {
    const projectId = options.projectId || PROJECT_ID_DEFAULT;
    const store = options.store || insightStoreModule.getInsightStore();

    const insights = [];
    const byCategory = {
        structural: 0,
        dependency: 0,
        api_surface: 0,
        documentation: 0,
    };
    let skipped = 0;

    function pushInsight(filePath, category, severity, description, evidence, context = {}) {
        if (!filePath) { skipped++; return; }
        let fileId;
        try {
            fileId = store.ensureFileSlot(projectId, filePath);
        } catch (_) {
            skipped++;
            return;
        }
        insights.push({
            projectId,
            fileId,
            filePath,
            passNumber: PASS_NUMBER,
            category,
            severity,
            description,
            evidence,
            relatedNodeIds: [],
            context,
        });
        byCategory[category] = (byCategory[category] || 0) + 1;
    }

    // ─── D2 → structural ─────────────────────────────────────────
    const D2 = gapReport && gapReport.D2_status;
    if (D2 && Array.isArray(D2.redFiles)) {
        for (const f of D2.redFiles) {
            const causes = Array.isArray(f.rootCauses) ? f.rootCauses : [];
            pushInsight(
                f.filepath,
                'structural',
                'high',
                `Structural gap: ${causes.length > 0 ? causes.join('; ') : 'RED status with no inferred cause'}`,
                `status=RED, reachabilityScore=${f.reachabilityScore}, rootCauses=[${causes.join(',')}]`,
                { rootCauses: causes }
            );
        }
    }

    // ─── D5 → dependency ─────────────────────────────────────────
    const D5 = gapReport && gapReport.D5_connections;
    if (D5 && Array.isArray(D5.orphanImports)) {
        for (const o of D5.orphanImports) {
            pushInsight(
                o.source,
                'dependency',
                'high',
                `Broken dependency: imports '${o.target}' which is not in the indexed file set`,
                `source=${o.source}, target=${o.target}`,
                { type: 'unresolved_import', target: o.target }
            );
        }
    }

    // ─── D4 missing exports → api_surface ────────────────────────
    const D4 = gapReport && gapReport.D4_exports;
    if (D4 && Array.isArray(D4.exportDetails)) {
        for (const e of D4.exportDetails) {
            const count = typeof e.exportCount === 'number' ? e.exportCount : 0;
            if (count === 0) {
                pushInsight(
                    e.filepath,
                    'api_surface',
                    'medium',
                    'No exports declared — file cannot be consumed as a module',
                    'exportCount=0',
                    { type: 'missing_exports' }
                );
            }
        }
    }

    // ─── D6 missing endpoints → api_surface (synthetic filepath) ──
    const D6 = gapReport && gapReport.D6_architecture;
    if (D6 && Array.isArray(D6.missingEndpoints)) {
        for (const m of D6.missingEndpoints) {
            const handlerModule = m.requiredModule || m.handlerModule || null;
            const fp = handlerModule || SYNTHETIC_ARCH_FILEPATH;
            pushInsight(
                fp,
                'api_surface',
                'critical',
                `Documented endpoint missing implementation: ${m.endpoint}`,
                `endpoint=${m.endpoint}, expectedModule=${handlerModule || 'unspecified'}`,
                { type: 'missing_endpoint', endpoint: m.endpoint }
            );
        }
    }

    // ─── D3 unauthored → documentation (medium) ──────────────────
    const D3 = gapReport && gapReport.D3_intent;
    if (D3 && Array.isArray(D3.unauthored)) {
        for (const u of D3.unauthored) {
            pushInsight(
                u.filepath,
                'documentation',
                'medium',
                'Missing purpose/intent statement (D3 intent coverage)',
                `hasPurpose=false, hasValueStatement=${u.hasValueStatement === true}`,
                { type: 'missing_intent' }
            );
        }
    }

    // ─── D1 canProgress → documentation (low) ────────────────────
    const D1 = gapReport && gapReport.D1_lifecycle;
    if (D1 && Array.isArray(D1.canProgress)) {
        for (const c of D1.canProgress) {
            pushInsight(
                c.filepath,
                'documentation',
                'low',
                `Lifecycle progression ready: phase=${c.currentPhase || 'DEVELOPMENT'} (has intent)`,
                `currentPhase=${c.currentPhase || 'DEVELOPMENT'}, hasPurpose=${c.hasPurpose === true}`,
                { type: 'lifecycle_progression_ready', phase: c.currentPhase || 'DEVELOPMENT' }
            );
        }
    }

    const inserted = insights.length > 0 ? store.addInsightsBatch(insights) : 0;
    return { inserted, byCategory, skipped };
}

/**
 * Subscriber-friendly wrapper. Loads + runs GapAnalyzer over the
 * targetDir's schema cards (.st8/schema-cards/) and feeds the report to
 * emitGapAnalysisInsights. Bundled so the subscriber registration site
 * stays a one-liner.
 *
 * @param {object} ctx — INDEX_COMPLETE hook ctx (uses targetDir + persistence)
 * @param {object} options — passed through to emitGapAnalysisInsights
 */
function runGapAnalysisInsightAdapter(ctx, options = {}) {
    if (!ctx || !ctx.persistence || !ctx.targetDir) {
        return { inserted: 0, byCategory: {}, skipped: 0, ran: false };
    }
    const { GapAnalyzer } = require('./gap-analyzer');
    const schemaCardsDir = path.join(ctx.targetDir, '.st8', 'schema-cards');
    const analyzer = new GapAnalyzer(schemaCardsDir, ctx.persistence);
    const report = analyzer.analyze();
    const result = emitGapAnalysisInsights(report, ctx.persistence, options);
    return Object.assign({ ran: true }, result);
}

module.exports = {
    emitGapAnalysisInsights,
    runGapAnalysisInsightAdapter,
    PASS_NUMBER,
};
