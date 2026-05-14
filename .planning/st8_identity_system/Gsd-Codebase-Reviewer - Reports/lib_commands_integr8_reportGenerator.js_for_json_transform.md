# Codebase Report: lib/commands/integr8/reportGenerator.js

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/integr8/reportGenerator.js`
**Lines:** 284
**Type:** Compiled JavaScript (from TypeScript source `src/commands/integr8/reportGenerator.ts`)
**Purpose:** Generates a comprehensive Markdown migration report from integr8 analysis output

---

## FILE STRUCTURE OVERVIEW

```
Lines 1-6:      Module setup & imports
Lines 7-150:    Main function: generateMigrationReport()
Lines 151-211:  Formatting helper functions
Lines 212-237:  Interpretation helper functions
Lines 238-247:  Risk computation function
Lines 248-283:  Next steps generation function
Line 284:       Source map reference
```

---

## SECTION-BY-SECTION ANALYSIS

### Lines 1-6: Module Setup & Imports

```javascript
"use strict";
// src/commands/integr8/reportGenerator.ts
// Generates a comprehensive Markdown migration report from integr8 analysis output.
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMigrationReport = generateMigrationReport;
const types_js_1 = require("./types.js");
```

**What this section does:** Initializes the CommonJS module, sets up TypeScript interop metadata, exports the main function, and imports type definitions.

**What triggers it:** Module load via `require("./reportGenerator.js")`

**What it calls:** `require("./types.js")` — loads `types.js` from the same `integr8/` directory

**What calls it:** `index.js` line 54: `const reportGenerator_js_1 = require("./reportGenerator.js");`

**Dependencies:**
- `./types.js` — Provides enums: `IntegrationOutcome`, `ConflictType`, `ResolutionStrategy`, `MigrationAction`

**Status:** ✅ WORKING

**Gap:** None — standard TypeScript compiled output

---

### Lines 7-11: Function Signature & JSDoc

```javascript
/**
 * Generates a professional Markdown report from the integr8 analysis output.
 * Includes executive summary, graph analysis, conflicts, steps, risk assessment, and next steps.
 */
function generateMigrationReport(output) {
```

**What this section does:** Defines the main exported function with documentation.

**What triggers it:** Called from `index.js` line 99

**What it calls:** Nothing yet — function declaration

**What calls it:**
- `index.js:99` — `output.migrationReport = (0, reportGenerator_js_1.generateMigrationReport)(output);`

**Dependencies:** Parameter `output` must conform to `Integr8Output` shape

**Status:** ✅ WORKING

**Gap:** None

---

### Lines 12-13: Destructuring & Initialization

```javascript
    const { migrationPlan, semanticGraph, outcome, reasons } = output;
    const lines = [];
```

**What this section does:** Destructures the `output` object into its constituent parts and initializes an empty array to accumulate Markdown lines.

**What triggers it:** Function invocation

**What it calls:** Nothing — pure destructuring

**What calls it:** Lines above (function entry)

**Dependencies:** `output` must have properties: `migrationPlan`, `semanticGraph`, `outcome`, `reasons`

**Status:** ✅ WORKING

**Gap:** None — but note that `output.migrationReport` (also part of `Integr8Output`) is NOT destructured here because this function generates it. The report is written to `output.migrationReport` AFTER this function returns (in `index.js:99`).

---

### Lines 14-19: HEADER Section

```javascript
    // ===== HEADER =====
    lines.push('# Migration Report: integr8 Analysis');
    lines.push('');
    lines.push(`> Generated: ${migrationPlan.timestamp}`);
    lines.push(`> Plan ID: \`${migrationPlan.id}\``);
    lines.push('');
```

**What this section does:** Generates the report header with title, generation timestamp, and plan ID.

**What triggers it:** Part of `generateMigrationReport()` execution flow

**What it calls:** Nothing — string interpolation

**What calls it:** Sequential flow from line 11

**Dependencies:**
- `migrationPlan.timestamp` — must be a string or Date
- `migrationPlan.id` — must be a string

**Status:** ✅ WORKING

**Gap:** No validation that `timestamp` or `id` exist. If `migrationPlan` is malformed, these will render as `undefined`.

---

### Lines 20-31: EXECUTIVE SUMMARY Section

```javascript
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
```

**What this section does:** Generates a summary table with key metrics from the migration analysis.

**What triggers it:** Sequential flow — part of report generation

**What it calls:**
- `formatOutcomeBadge(outcome)` — line 152 (converts outcome enum to emoji badge)
- `migrationPlan.estimatedComplexity.toUpperCase()` — string method call
- `.length` on arrays — `migrationPlan.steps`, `semanticGraph.nodes`, `semanticGraph.edges`

**What calls it:** Sequential flow from line 19

**Dependencies:**
- `migrationPlan.estimatedComplexity` — must be a string (calls `.toUpperCase()`)
- `migrationPlan.steps` — must be an array
- `migrationPlan.conflictCount` — must be a number
- `semanticGraph.nodes` — must be an array
- `semanticGraph.edges` — must be an array

**Status:** ✅ WORKING

**Gap:** If `estimatedComplexity` is `null`/`undefined`, `.toUpperCase()` will throw a TypeError. No defensive check exists.

---

### Lines 32-39: SOURCE & TARGET Section

```javascript
    // ===== SOURCE & TARGET =====
    lines.push('## Source & Target');
    lines.push('');
    lines.push(`| | Path |`);
    lines.push(`|--|------|`);
    lines.push(`| **Source (External)** | \`${migrationPlan.sourcePath}\` |`);
    lines.push(`| **Target (Current)** | \`${migrationPlan.targetPath}\` |`);
    lines.push('');
```

**What this section does:** Displays source and target paths in a table.

**What triggers it:** Sequential flow

**What it calls:** Nothing — string interpolation

**What calls it:** Sequential flow from line 31

**Dependencies:**
- `migrationPlan.sourcePath` — string
- `migrationPlan.targetPath` — string

**Status:** ✅ WORKING

**Gap:** Paths could be very long and break table formatting. No truncation.

---

### Lines 40-52: GRAPH ANALYSIS Section

```javascript
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
```

**What this section does:** Generates a table showing graph properties (reachability, stability, fragility) with scores and human-readable interpretations. Conditionally shows integration distance if available.

**What triggers it:** Sequential flow

**What it calls:**
- `formatPercent(props.reachability)` — line 166 (formats number as percentage)
- `interpretReachability(props.reachability)` — line 213 (provides text interpretation)
- `formatPercent(props.stability)` — line 166
- `interpretStability(props.stability)` — line 222
- `formatPercent(props.fragility)` — line 166
- `interpretFragility(props.fragility)` — line 229

**What calls it:** Sequential flow from line 39

**Dependencies:**
- `semanticGraph.properties.reachability` — number (0-1)
- `semanticGraph.properties.stability` — number (0-1)
- `semanticGraph.properties.fragility` — number (0-1)
- `semanticGraph.properties.integrationDistance` — optional number

**Status:** ✅ WORKING

**Gap:** No validation that `props` exists or that numeric values are within expected ranges. If `reachability` is `NaN`, `formatPercent` will produce `"NaN%"`.

---

### Lines 53-82: CONFLICTS DETECTED Section

```javascript
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
```

**What this section does:** Renders conflicts in two formats: (1) a summary table, and (2) detailed conflict cards with full descriptions, options, and JSON details.

**What triggers it:** Sequential flow

**What it calls:**
- `formatConflictType(conflict.type)` — line 169 (maps enum to human-readable string)
- `formatResolution(conflict.recommended)` — line 180 (maps resolution enum to display string)
- `formatResolution` again for each `conflict.resolutionOptions` item — line 180
- `JSON.stringify(conflict.details)` — native JSON serialization for detail objects

**What calls it:** Sequential flow from line 52

**Dependencies:**
- `migrationPlan.conflicts` — must be an array
- Each conflict must have: `id`, `type`, `item`, `description`, `resolutionOptions`, `recommended`, optionally `details`

**Status:** ✅ WORKING

**Gap:** Line 75 — `conflict.resolutionOptions.map(formatResolution).join(', ')` — If `resolutionOptions` is `null`/`undefined`, this will throw a TypeError. No defensive check exists.

---

### Lines 83-114: MIGRATION STEPS Section

```javascript
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
```

**What this section does:** Iterates over migration steps and renders each with action icon, description, and conditional sub-details (from/to paths, file info, rewrite rules, conflict references, commands).

**What triggers it:** Sequential flow

**What it calls:**
- `getActionIcon(step.action)` — line 201 (maps action to emoji)
- `formatAction(step.action)` — line 190 (maps action enum to display string)
- `types_js_1.MigrationAction.COPY_FILE` — constant comparison from `types.js`
- `formatResolution(step.resolution)` — line 180

**What calls it:** Sequential flow from line 82

**Dependencies:**
- `migrationPlan.steps` — array of step objects
- Each step: `step`, `action`, `description`, optionally `from`, `to`, `file`, `rules`, `conflictId`, `resolution`, `command`
- `step.rules` items: `originalImport`, `rewrittenImport`, `reason`

**Status:** ✅ WORKING

**Gaps:**
1. **Line 94:** `if (step.from && step.to)` — uses truthiness check. If `step.from` is `""` (empty string) or `0`, the section is skipped even though the value exists.
2. **Line 98:** `if (step.file && step.action !== types_js_1.MigrationAction.COPY_FILE)` — COPY_FILE actions intentionally hide file display. This is a design choice but undocumented.
3. **Line 106:** `if (step.conflictId)` — `formatResolution(step.resolution)` is called without checking if `step.resolution` exists. If `conflictId` is set but `resolution` is `undefined`, `formatResolution` returns `` `undefined` `` (line 187: `` `\`${resolution}\`` ``).

---

### Lines 115-127: RISK ASSESSMENT Section

```javascript
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
```

**What this section does:** Computes overall risk level and generates a factor-by-factor risk assessment table with emoji indicators.

**What triggers it:** Sequential flow

**What it calls:**
- `computeRiskLevel(props, migrationPlan.conflictCount)` — line 238 (weighted risk score)
- `formatPercent(props.reachability)` — line 166
- `formatPercent(props.stability)` — line 166
- `formatPercent(props.fragility)` — line 166

**What calls it:** Sequential flow from line 114

**Dependencies:**
- `props` — reused from line 43 (same `semanticGraph.properties` object)
- `migrationPlan.conflictCount` — number

**Status:** ✅ WORKING

**Gap:** Thresholds in the ternary chains (e.g., `0.8`, `0.5`, `0.7`, `0.4`, `0.1`, `0.3`, `3`) are magic numbers. If thresholds change, they must be updated in both this section AND the interpretation helpers (lines 213-237). The thresholds are NOT consistent:
- Risk assessment (line 123): reachability `>= 0.8` = Good
- `interpretReachability` (line 214): reachability `>= 0.95` = Excellent, `>= 0.8` = Good

This creates inconsistency: a reachability of `0.94` shows "✅ Good" in risk assessment but "Good — most dependencies resolved" in graph analysis (not "Excellent").

---

### Lines 128-136: OUTCOME EXPLANATION Section

```javascript
    // ===== OUTCOME EXPLANATION =====
    lines.push('## Outcome Explanation');
    lines.push('');
    lines.push(`The analysis concluded with outcome **${outcome}** for the following reasons:`);
    lines.push('');
    for (const reason of reasons) {
        lines.push(`- ${reason}`);
    }
    lines.push('');
```

**What this section does:** Displays the outcome and lists all reasons as bullet points.

**What triggers it:** Sequential flow

**What it calls:** Nothing — simple iteration

**What calls it:** Sequential flow from line 127

**Dependencies:**
- `outcome` — string (IntegrationOutcome enum value)
- `reasons` — array of strings

**Status:** ✅ WORKING

**Gap:** If `reasons` is `null`/`undefined`, the `for...of` loop will throw a TypeError.

---

### Lines 137-144: NEXT STEPS Section

```javascript
    // ===== NEXT STEPS =====
    lines.push('## Next Steps');
    lines.push('');
    const nextSteps = generateNextSteps(outcome, migrationPlan.conflictCount);
    for (const step of nextSteps) {
        lines.push(`- ${step}`);
    }
    lines.push('');
```

**What this section does:** Generates and displays actionable next steps based on the outcome and conflict count.

**What triggers it:** Sequential flow

**What it calls:**
- `generateNextSteps(outcome, migrationPlan.conflictCount)` — line 249 (switch-based step generation)

**What calls it:** Sequential flow from line 136

**Dependencies:**
- `outcome` — IntegrationOutcome enum
- `migrationPlan.conflictCount` — number

**Status:** ✅ WORKING

**Gap:** None

---

### Lines 145-150: FOOTER & Return

```javascript
    // ===== FOOTER =====
    lines.push('---');
    lines.push(`*Report generated by integr8 Semantic Graph Compiler*`);
    lines.push('');
    return lines.join('\n');
}
```

**What this section does:** Adds a horizontal rule footer and joins all accumulated lines into a single Markdown string.

**What triggers it:** Sequential flow (end of function)

**What it calls:** `lines.join('\n')` — native Array method

**What calls it:** Returns to caller (`index.js:99`)

**Dependencies:** None

**Status:** ✅ WORKING

**Gap:** None

---

### Lines 151-165: formatOutcomeBadge()

```javascript
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
```

**What this section does:** Maps IntegrationOutcome enum values to emoji-prefixed display strings.

**What triggers it:** Called from line 25

**What it calls:** Nothing — pure mapping

**What calls it:** `generateMigrationReport()` line 25

**Dependencies:**
- `types_js_1.IntegrationOutcome` — enum from `types.js`

**Status:** ⚠️ PARTIAL

**Gap:** **No default case in switch statement.** If `outcome` is an unexpected value (e.g., `null`, `undefined`, or a new enum value not yet handled), the function returns `undefined` implicitly. This would render as `| **Outcome** | undefined |` in the table. Should add `default: return String(outcome);` like `formatConflictType` does on line 177.

---

### Lines 166-168: formatPercent()

```javascript
function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
}
```

**What this section does:** Converts a 0-1 decimal to a percentage string with one decimal place.

**What triggers it:** Called from lines 46, 47, 48, 123, 124, 125

**What it calls:** `Number.prototype.toFixed(1)`

**What calls it:** `generateMigrationReport()` — graph analysis and risk assessment sections

**Dependencies:** `value` must be a number

**Status:** ✅ WORKING

**Gap:** If `value` is `NaN`, produces `"NaN%"`. If `value` is `undefined`, throws TypeError on `undefined * 100`.

---

### Lines 169-178: formatConflictType()

```javascript
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
```

**What this section does:** Maps ConflictType enum values to human-readable strings.

**What triggers it:** Called from lines 64, 71

**What it calls:** `String(type)` — native conversion (default case)

**What calls it:** `generateMigrationReport()` — conflicts section

**Dependencies:** `types_js_1.ConflictType` — enum from `types.js`

**Status:** ✅ WORKING

**Gap:** None — has proper default case

---

### Lines 180-188: formatResolution()

```javascript
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
```

**What this section does:** Maps ResolutionStrategy enum values to backtick-wrapped display strings.

**What triggers it:** Called from lines 64, 75, 76, 107

**What it calls:** Template literal with backtick wrapping (default case)

**What calls it:** `generateMigrationReport()` — conflicts and migration steps sections

**Dependencies:** `types_js_1.ResolutionStrategy` — enum from `types.js`

**Status:** ✅ WORKING

**Gap:** Default case wraps `resolution` in backticks. If `resolution` is `undefined`, renders as `` `undefined` `` — not a crash but semantically misleading.

---

### Lines 190-199: formatAction()

```javascript
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
```

**What this section does:** Maps MigrationAction enum values to human-readable action names.

**What triggers it:** Called from line 93

**What it calls:** `String(action)` — native conversion (default case)

**What calls it:** `generateMigrationReport()` — migration steps section

**Dependencies:** `types_js_1.MigrationAction` — enum from `types.js`

**Status:** ✅ WORKING

**Gap:** None — has proper default case

---

### Lines 201-211: getActionIcon()

```javascript
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
```

**What this section does:** Maps MigrationAction enum values to emoji icons for visual step indicators.

**What triggers it:** Called from line 92

**What it calls:** Nothing — pure mapping

**What calls it:** `generateMigrationReport()` — migration steps section

**Dependencies:** `types_js_1.MigrationAction` — enum from `types.js`

**Status:** ✅ WORKING

**Gap:** None — has proper default case (bullet point)

---

### Lines 213-221: interpretReachability()

```javascript
function interpretReachability(value) {
    if (value >= 0.95)
        return 'Excellent — nearly all dependencies resolved';
    if (value >= 0.8)
        return 'Good — most dependencies resolved';
    if (value >= 0.5)
        return 'Moderate — significant gaps remain';
    return 'Poor — majority of dependencies unresolved';
}
```

**What this section does:** Converts a reachability score (0-1) into a human-readable interpretation.

**What triggers it:** Called from line 46

**What it calls:** Nothing — pure threshold logic

**What calls it:** `generateMigrationReport()` — graph analysis section

**Dependencies:** `value` must be a number

**Status:** ✅ WORKING

**Gap:** Thresholds (0.95, 0.8, 0.5) differ from risk assessment thresholds in lines 123 (0.8, 0.5). This creates inconsistent messaging — see Lines 115-127 gap above.

---

### Lines 222-228: interpretStability()

```javascript
function interpretStability(value) {
    if (value >= 0.8)
        return 'High confidence in integration success';
    if (value >= 0.5)
        return 'Moderate confidence — some uncertainty';
    return 'Low confidence — integration may be unreliable';
}
```

**What this section does:** Converts a stability score (0-1) into a human-readable interpretation.

**What triggers it:** Called from line 47

**What it calls:** Nothing — pure threshold logic

**What calls it:** `generateMigrationReport()` — graph analysis section

**Dependencies:** `value` must be a number

**Status:** ✅ WORKING

**Gap:** Thresholds (0.8, 0.5) differ from risk assessment thresholds in line 124 (0.7, 0.4). Inconsistent messaging.

---

### Lines 229-237: interpretFragility()

```javascript
function interpretFragility(value) {
    if (value <= 0.05)
        return 'Minimal post-integration breakage risk';
    if (value <= 0.15)
        return 'Low risk — minor issues possible';
    if (value <= 0.3)
        return 'Moderate risk — careful testing required';
    return 'High risk — significant breakage likely';
}
```

**What this section does:** Converts a fragility score (0-1) into a human-readable interpretation.

**What triggers it:** Called from line 48

**What it calls:** Nothing — pure threshold logic

**What calls it:** `generateMigrationReport()` — graph analysis section

**Dependencies:** `value` must be a number

**Status:** ✅ WORKING

**Gap:** Thresholds (0.05, 0.15, 0.3) differ from risk assessment thresholds in line 125 (0.1, 0.3). Inconsistent messaging — e.g., fragility of 0.08 shows "Low risk — minor issues possible" in graph analysis but "✅ Low" in risk assessment (because 0.08 <= 0.1).

---

### Lines 238-247: computeRiskLevel()

```javascript
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
```

**What this section does:** Computes a weighted risk score from graph properties and conflict count, then maps to a color-coded risk level.

**What triggers it:** Called from line 118

**What it calls:** Nothing — pure computation

**What calls it:** `generateMigrationReport()` — risk assessment section

**Dependencies:**
- `props.reachability` — number
- `props.stability` — number
- `props.fragility` — number
- `conflictCount` — number

**Status:** ✅ WORKING

**Gap:** The scoring formula weights conflicts at `0.1` per conflict. With 10 conflicts, that's `+1.0` to the score. With `reachability=0`, `stability=0`, `fragility=1`, and 10 conflicts, the score would be `1 + 1 + 1 + 1 = 4.0`, which maps to `🔴 CRITICAL`. The formula seems reasonable but the `0.1` weight is a magic number.

---

### Lines 249-283: generateNextSteps()

```javascript
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
```

**What this section does:** Generates context-sensitive next step recommendations based on the integration outcome.

**What triggers it:** Called from line 140

**What it calls:** `steps.push()` — array method

**What calls it:** `generateMigrationReport()` — next steps section

**Dependencies:**
- `outcome` — IntegrationOutcome enum
- `conflictCount` — number (used in PARTIAL case template literal)

**Status:** ⚠️ PARTIAL

**Gap:** **No default case in switch statement.** If `outcome` is an unexpected value, `steps` remains empty and no next steps are rendered. Unlike `formatOutcomeBadge` which also lacks a default, this one is more problematic because the user gets no guidance at all. Should add:
```javascript
default:
    steps.push('Review the analysis output and consult documentation');
    break;
```

---

### Line 284: Source Map Reference

```javascript
//# sourceMappingURL=reportGenerator.js.map
```

**What this section does:** References the TypeScript source map for debugging.

**Status:** N/A — metadata only

**Gap:** The `.map` file would need to exist at the same path for source-level debugging to work.

---

## CONNECTION MAP

### What Triggers Report Generation?

```
[CLI Command] → [index.js:62 runIntegr8Command(args)]
    → [Stage 1] dataIngestion.ingestProjectData()     — line 71
    → [Stage 2] relationshipAnalyzer.analyzeRelationships() — line 80
    → [Stage 3] pathGenerator.generateMigrationPath()  — line 86
    → [reportGenerator.generateMigrationReport(output)] — line 99 ← THIS FILE
    → [Write to disk: migration_report.md]              — line 107
```

### What Files Get Called?

| File | Import Line | Functions Used |
|------|-------------|----------------|
| `./types.js` | Line 6 | `IntegrationOutcome`, `ConflictType`, `ResolutionStrategy`, `MigrationAction` (enum values only) |

### Where Does the Report Get Written?

| Location | File | Line |
|----------|------|------|
| In-memory | `output.migrationReport` | `index.js:99` |
| Disk (Markdown) | `{outputDir}/migration_report.md` | `index.js:107` |
| Console (summary) | stdout | `index.js:134-136` |

---

## @@@ HANDLING

**No `@@@` symbols found** in this file. Searched with grep — zero matches.

---

## COMPLETE CALL GRAPH

```
generateMigrationReport(output)                    [line 11]
├── formatOutcomeBadge(outcome)                    [line 152]
│   └── types_js_1.IntegrationOutcome.*            [types.js]
├── formatPercent(value)                           [line 166] × 6 calls
│   └── Number.prototype.toFixed(1)
├── interpretReachability(value)                   [line 213]
├── interpretStability(value)                      [line 222]
├── interpretFragility(value)                      [line 229]
├── formatConflictType(type)                       [line 169] × 2 per conflict
│   └── types_js_1.ConflictType.*                  [types.js]
├── formatResolution(resolution)                   [line 180] × 3+ per conflict
│   └── types_js_1.ResolutionStrategy.*            [types.js]
├── getActionIcon(action)                          [line 201] × 1 per step
│   └── types_js_1.MigrationAction.*               [types.js]
├── formatAction(action)                           [line 190] × 1 per step
│   └── types_js_1.MigrationAction.*               [types.js]
├── computeRiskLevel(props, conflictCount)         [line 238]
└── generateNextSteps(outcome, conflictCount)      [line 249]
    └── types_js_1.IntegrationOutcome.*            [types.js]
```

---

## SUMMARY OF GAPS

| # | Severity | Line(s) | Gap Description |
|---|----------|---------|-----------------|
| 1 | **MEDIUM** | 152-165 | `formatOutcomeBadge()` has no default case — returns `undefined` for unknown outcomes |
| 2 | **MEDIUM** | 249-283 | `generateNextSteps()` has no default case — returns empty array for unknown outcomes |
| 3 | **LOW** | 26 | `migrationPlan.estimatedComplexity.toUpperCase()` — no null check; will throw TypeError if `undefined` |
| 4 | **LOW** | 75 | `conflict.resolutionOptions.map(...)` — no null check; will throw TypeError if `undefined` |
| 5 | **LOW** | 107 | `formatResolution(step.resolution)` called when `step.conflictId` exists but `step.resolution` may be `undefined` |
| 6 | **LOW** | 123-125 vs 213-237 | Threshold inconsistency between risk assessment table and interpretation helpers |
| 7 | **INFO** | 94 | Truthiness check `step.from && step.to` skips empty strings |
| 8 | **INFO** | 239 | Magic number `0.1` for conflict weight in risk computation |
| 9 | **INFO** | All | No input validation — assumes well-formed `output` object throughout |

---

*Report generated: 2026-05-13*
*Reviewer: GSD Code Reviewer Agent*
*File: 284 lines, 1 import, 10 functions, 9 report sections*
