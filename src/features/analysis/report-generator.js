"use strict";
// src/commands/integr8/reportGenerator.ts
// Generates a comprehensive Markdown migration report from integr8 analysis output.
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMigrationReport = generateMigrationReport;
const types_js_1 = require("../../shared/types/integr8-types.js");
/**
 * Generates a professional Markdown report from the integr8 analysis output.
 * Includes executive summary, graph analysis, conflicts, steps, risk assessment, and next steps.
 */
function generateMigrationReport(output) {
    const { migrationPlan, semanticGraph, outcome, reasons } = output;
    const lines = [];
    // ===== HEADER =====
    lines.push('# Migration Report: integr8 Analysis');
    lines.push('');
    lines.push(`> Generated: ${migrationPlan.timestamp}`);
    lines.push(`> Plan ID: \`${migrationPlan.id}\``);
    lines.push('');
    // ===== EXECUTIVE SUMMARY =====
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| **Outcome** | ${formatOutcomeBadge(outcome)} |`);
    lines.push(`| **Complexity** | ${migrationPlan.estimatedComplexity.toUpperCase()} |`);
    lines.push(`| **Migration Steps** | ${migrationPlan.steps.length} |`);
    lines.push(`| **Conflicts Detected** | ${migrationPlan.conflictCount} |`);
    lines.push(`| **Files in Graph** | ${semanticGraph.nodes.length} nodes |`);
    lines.push(`| **Relationships** | ${semanticGraph.edges.length} edges |`);
    lines.push('');
    // ===== SOURCE & TARGET =====
    lines.push('## Source & Target');
    lines.push('');
    lines.push(`| | Path |`);
    lines.push(`|--|------|`);
    lines.push(`| **Source (External)** | \`${migrationPlan.sourcePath}\` |`);
    lines.push(`| **Target (Current)** | \`${migrationPlan.targetPath}\` |`);
    lines.push('');
    // ===== GRAPH ANALYSIS =====
    lines.push('## Graph Analysis');
    lines.push('');
    const props = semanticGraph.properties;
    lines.push(`| Property | Score | Interpretation |`);
    lines.push(`|----------|-------|----------------|`);
    lines.push(`| **Reachability** | ${formatPercent(props.reachability)} | ${interpretReachability(props.reachability)} |`);
    lines.push(`| **Stability** | ${formatPercent(props.stability)} | ${interpretStability(props.stability)} |`);
    lines.push(`| **Fragility** | ${formatPercent(props.fragility)} | ${interpretFragility(props.fragility)} |`);
    if (props.integrationDistance !== undefined) {
        lines.push(`| **Integration Distance** | ${props.integrationDistance} | Total weighted changes needed |`);
    }
    lines.push('');
    // ===== CONFLICTS DETECTED =====
    lines.push('## Conflicts Detected');
    lines.push('');
    if (migrationPlan.conflicts.length === 0) {
        lines.push('No conflicts detected. Integration path is clear.');
        lines.push('');
    }
    else {
        lines.push(`| # | Type | Item | Recommended Resolution |`);
        lines.push(`|---|------|------|------------------------|`);
        migrationPlan.conflicts.forEach((conflict, idx) => {
            lines.push(`| ${idx + 1} | ${formatConflictType(conflict.type)} | \`${conflict.item}\` | ${formatResolution(conflict.recommended)} |`);
        });
        lines.push('');
        // Conflict details
        lines.push('### Conflict Details');
        lines.push('');
        for (const conflict of migrationPlan.conflicts) {
            lines.push(`#### \`${conflict.id}\` — ${formatConflictType(conflict.type)}`);
            lines.push('');
            lines.push(`- **Item:** \`${conflict.item}\``);
            lines.push(`- **Description:** ${conflict.description}`);
            lines.push(`- **Options:** ${conflict.resolutionOptions.map(formatResolution).join(', ')}`);
            lines.push(`- **Recommended:** ${formatResolution(conflict.recommended)}`);
            if (conflict.details) {
                lines.push(`- **Details:** \`${JSON.stringify(conflict.details)}\``);
            }
            lines.push('');
        }
    }
    // ===== MIGRATION STEPS =====
    lines.push('## Migration Steps');
    lines.push('');
    if (migrationPlan.steps.length === 0) {
        lines.push('No migration steps generated.');
        lines.push('');
    }
    else {
        for (const step of migrationPlan.steps) {
            const actionIcon = getActionIcon(step.action);
            lines.push(`${step.step}. ${actionIcon} **${formatAction(step.action)}** — ${step.description}`);
            if (step.from && step.to) {
                lines.push(`   - From: \`${step.from}\``);
                lines.push(`   - To: \`${step.to}\``);
            }
            if (step.file && step.action !== types_js_1.MigrationAction.COPY_FILE) {
                lines.push(`   - File: \`${step.file}\``);
            }
            if (step.rules && step.rules.length > 0) {
                for (const rule of step.rules) {
                    lines.push(`   - \`${rule.originalImport}\` → \`${rule.rewrittenImport}\` _(${rule.reason})_`);
                }
            }
            if (step.conflictId) {
                lines.push(`   - Conflict: \`${step.conflictId}\` | Resolution: ${formatResolution(step.resolution)}`);
            }
            if (step.command) {
                lines.push(`   - Command: \`${step.command}\``);
            }
        }
        lines.push('');
    }
    // ===== RISK ASSESSMENT =====
    lines.push('## Risk Assessment');
    lines.push('');
    const riskLevel = computeRiskLevel(props, migrationPlan.conflictCount);
    lines.push(`**Overall Risk Level:** ${riskLevel}`);
    lines.push('');
    lines.push('| Factor | Status |');
    lines.push('|--------|--------|');
    lines.push(`| Dependency coverage | ${props.reachability >= 0.8 ? '✅ Good' : props.reachability >= 0.5 ? '⚠️ Moderate' : '❌ Poor'} (${formatPercent(props.reachability)}) |`);
    lines.push(`| Integration stability | ${props.stability >= 0.7 ? '✅ Stable' : props.stability >= 0.4 ? '⚠️ Uncertain' : '❌ Unstable'} (${formatPercent(props.stability)}) |`);
    lines.push(`| Post-integration fragility | ${props.fragility <= 0.1 ? '✅ Low' : props.fragility <= 0.3 ? '⚠️ Moderate' : '❌ High'} (${formatPercent(props.fragility)}) |`);
    lines.push(`| Conflict count | ${migrationPlan.conflictCount === 0 ? '✅ None' : migrationPlan.conflictCount <= 3 ? '⚠️ Manageable' : '❌ High'} (${migrationPlan.conflictCount}) |`);
    lines.push('');
    // ===== OUTCOME EXPLANATION =====
    lines.push('## Outcome Explanation');
    lines.push('');
    lines.push(`The analysis concluded with outcome **${outcome}** for the following reasons:`);
    lines.push('');
    for (const reason of reasons) {
        lines.push(`- ${reason}`);
    }
    lines.push('');
    // ===== NEXT STEPS =====
    lines.push('## Next Steps');
    lines.push('');
    const nextSteps = generateNextSteps(outcome, migrationPlan.conflictCount);
    for (const step of nextSteps) {
        lines.push(`- ${step}`);
    }
    lines.push('');
    // ===== FOOTER =====
    lines.push('---');
    lines.push(`*Report generated by integr8 Semantic Graph Compiler*`);
    lines.push('');
    return lines.join('\n');
}
// ============ FORMATTING HELPERS ============
function formatOutcomeBadge(outcome) {
    switch (outcome) {
        case types_js_1.IntegrationOutcome.SUCCESS:
            return '✅ SUCCESS';
        case types_js_1.IntegrationOutcome.PARTIAL:
            return '⚠️ PARTIAL';
        case types_js_1.IntegrationOutcome.FAILURE:
            return '❌ FAILURE';
        case types_js_1.IntegrationOutcome.AMBIGUOUS:
            return '🔀 AMBIGUOUS';
        case types_js_1.IntegrationOutcome.REDIRECT:
            return '↪️ REDIRECT';
    }
}
function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
}
function formatConflictType(type) {
    switch (type) {
        case types_js_1.ConflictType.NAME_COLLISION: return 'Name Collision';
        case types_js_1.ConflictType.TYPE_MISMATCH: return 'Type Mismatch';
        case types_js_1.ConflictType.VERSION_CONFLICT: return 'Version Conflict';
        case types_js_1.ConflictType.CIRCULAR_DEPENDENCY: return 'Circular Dependency';
        case types_js_1.ConflictType.API_INCOMPATIBILITY: return 'API Incompatibility';
        case types_js_1.ConflictType.MISSING_DEPENDENCY: return 'Missing Dependency';
        default: return String(type);
    }
}
function formatResolution(resolution) {
    switch (resolution) {
        case types_js_1.ResolutionStrategy.RENAME: return '`RENAME`';
        case types_js_1.ResolutionStrategy.MERGE: return '`MERGE`';
        case types_js_1.ResolutionStrategy.OVERWRITE: return '`OVERWRITE`';
        case types_js_1.ResolutionStrategy.IGNORE: return '`IGNORE`';
        case types_js_1.ResolutionStrategy.CUSTOM: return '`CUSTOM`';
        default: return `\`${resolution}\``;
    }
}
function formatAction(action) {
    switch (action) {
        case types_js_1.MigrationAction.COPY_FILE: return 'Copy File';
        case types_js_1.MigrationAction.REWRITE_IMPORT: return 'Rewrite Import';
        case types_js_1.MigrationAction.MERGE_ROUTE: return 'Merge Route';
        case types_js_1.MigrationAction.RESOLVE_CONFLICT: return 'Resolve Conflict';
        case types_js_1.MigrationAction.RUN_COMMAND: return 'Run Command';
        case types_js_1.MigrationAction.VERIFY: return 'Verify';
        default: return String(action);
    }
}
function getActionIcon(action) {
    switch (action) {
        case types_js_1.MigrationAction.COPY_FILE: return '📄';
        case types_js_1.MigrationAction.REWRITE_IMPORT: return '🔄';
        case types_js_1.MigrationAction.MERGE_ROUTE: return '🔀';
        case types_js_1.MigrationAction.RESOLVE_CONFLICT: return '⚡';
        case types_js_1.MigrationAction.RUN_COMMAND: return '🖥️';
        case types_js_1.MigrationAction.VERIFY: return '✅';
        default: return '•';
    }
}
// ============ INTERPRETATION HELPERS ============
function interpretReachability(value) {
    if (value >= 0.95)
        return 'Excellent — nearly all dependencies resolved';
    if (value >= 0.8)
        return 'Good — most dependencies resolved';
    if (value >= 0.5)
        return 'Moderate — significant gaps remain';
    return 'Poor — majority of dependencies unresolved';
}
function interpretStability(value) {
    if (value >= 0.8)
        return 'High confidence in integration success';
    if (value >= 0.5)
        return 'Moderate confidence — some uncertainty';
    return 'Low confidence — integration may be unreliable';
}
function interpretFragility(value) {
    if (value <= 0.05)
        return 'Minimal post-integration breakage risk';
    if (value <= 0.15)
        return 'Low risk — minor issues possible';
    if (value <= 0.3)
        return 'Moderate risk — careful testing required';
    return 'High risk — significant breakage likely';
}
function computeRiskLevel(props, conflictCount) {
    const score = (1 - props.reachability) + (1 - props.stability) + props.fragility + (conflictCount * 0.1);
    if (score <= 0.2)
        return '🟢 LOW';
    if (score <= 0.6)
        return '🟡 MODERATE';
    if (score <= 1.0)
        return '🟠 HIGH';
    return '🔴 CRITICAL';
}
// ============ NEXT STEPS GENERATION ============
function generateNextSteps(outcome, conflictCount) {
    const steps = [];
    switch (outcome) {
        case types_js_1.IntegrationOutcome.SUCCESS:
            steps.push('Run `integr8 --apply` to execute the migration plan automatically');
            steps.push('Run `integr8 --verify` after application to confirm integration integrity');
            steps.push('Review generated artifacts in the output directory');
            break;
        case types_js_1.IntegrationOutcome.PARTIAL:
            steps.push(`Review ${conflictCount} conflict(s) in the migration plan`);
            steps.push('Resolve conflicts manually or adjust resolution strategies');
            steps.push('Re-run `integr8` after resolving conflicts to verify updated outcome');
            steps.push('Once conflicts are resolved, run `integr8 --apply` to execute');
            break;
        case types_js_1.IntegrationOutcome.FAILURE:
            steps.push('Review the conflict details and outcome reasons above');
            steps.push('Consider reducing scope (fewer target pages) to isolate issues');
            steps.push('Check for missing dependencies and install them in the target project');
            steps.push('Re-run with `--strategy aggressive` if willing to accept more automated resolutions');
            break;
        case types_js_1.IntegrationOutcome.AMBIGUOUS:
            steps.push('Multiple valid resolution paths exist — human guidance is required');
            steps.push('Review each conflict and select a resolution strategy manually');
            steps.push('Consider running with `--strategy conservative` for safer defaults');
            steps.push('Re-run `integr8` after providing resolution preferences');
            break;
        case types_js_1.IntegrationOutcome.REDIRECT:
            steps.push('A critical dependency is unavailable in the target project');
            steps.push('Consider an alternative integration approach or different source pages');
            steps.push('Install missing critical dependencies before retrying');
            steps.push('Consult the conflict details for specifics on what is missing');
            break;
    }
    return steps;
}
//# sourceMappingURL=reportGenerator.js.map