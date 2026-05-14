# Schema Card Review — lib/commands/integr8/ (Wave 3)

**Reviewed:** 2026-05-14
**Scope:** 6 schema-card JSON files from `.st8/schema-cards/`
**Method:** Cross-referenced each schema card against actual source file contents
**Status:** issues_found

---

## Summary

Reviewed 6 schema cards for the `integr8` pipeline modules. Found **significant data quality issues** in 4 of 6 cards. The most common problems are: (1) phantom imports detected from string literals rather than actual `require`/`import` statements, (2) severely incomplete `importedBy` graphs missing the majority of actual callers, (3) all exports misclassified as `variable` when they are `function` or `enum`, and (4) every intent field contains `???` placeholder text indicating the indexer could not determine purpose.

---

## File-by-File Analysis

### 1. pathGenerator.js

| Field | Schema Card Value | Verified Value | Match? |
|-------|-------------------|----------------|--------|
| **Exports** | `generateMigrationPath` (var, L39), `performTopologicalAnalysis` (var, L40) | Same names at same lines, but kind=`function` not `variable` | ⚠️ KIND |
| **Imports** | `./${toNode.name}` (dynamic), `./types` | `crypto` (L41), `./types` (L42) — no dynamic import exists | ❌ MISS+PHANTOM |
| **importedBy** | 14 modules (backend/*, index.js, start.js) | Only `lib/commands/integr8/index.js` confirmed | ❌ FABRICATED |
| **Intent** | `???` markers on all 3 fields | N/A — indexer incomplete | ⚠️ |
| **Status** | GREEN | Should be YELLOW (data integrity issues) | ⚠️ |

**Summary:** Generates migration plans from analyzed semantic graphs. Provides topological sort, outcome evaluation, and critical path analysis.

**Findings:**

- **PHANTOM IMPORT** — `./${toNode.name}` listed as dynamic import does not exist in source. This appears to be a string literal from inside the code (e.g., template pattern) incorrectly parsed as an import statement.
- **MISSING IMPORT** — `crypto` (line 41, `require("crypto")`) is a real top-level import completely absent from the schema card.
- **FABRICATED importedBy** — Claims 14 modules import pathGenerator. Grep confirms only `lib/commands/integr8/index.js` does. The `backend/*` entries and `start.js` are false positives — likely caused by the indexer matching the string "pathGenerator" in comments, variable names, or unrelated contexts.
- **WRONG KIND** — Both exports are `function` declarations (lines 39-40: `exports.generateMigrationPath = generateMigrationPath`), not `variable`.

---

### 2. relationshipAnalyzer.js

| Field | Schema Card Value | Verified Value | Match? |
|-------|-------------------|----------------|--------|
| **Exports** | 5 named vars (L5-9) | Same names at same lines, but kind=`function` not `variable` | ⚠️ KIND |
| **Imports** | `./types.js` | `./types.js` (L10) | ✅ |
| **importedBy** | `lib/commands/integr8/index.js` | Confirmed (L51 of index.js) | ✅ |
| **Intent** | `???` markers | N/A — indexer incomplete | ⚠️ |
| **Status** | GREEN | GREEN | ✅ |

**Summary:** Stage 2 relationship analysis engine. Analyzes two semantic graphs to identify dependency matches, conflicts, and compute integration properties. Includes Tarjan's SCC for cycle detection.

**Findings:**

- **WRONG KIND** — All 5 exports are `function` declarations, not `variable`.
- **INCOMPLETE importedBy** — Only lists `index.js`, but `dataIngestion.js` may also reference types from this module indirectly. Low severity since direct import is confirmed.

---

### 3. reportGenerator.js

| Field | Schema Card Value | Verified Value | Match? |
|-------|-------------------|----------------|--------|
| **Exports** | `generateMigrationReport` (var, L5) | Same name at same line, but kind=`function` not `variable` | ⚠️ KIND |
| **Imports** | `./types.js` | `./types.js` (L6) | ✅ |
| **importedBy** | `lib/commands/integr8/index.js` | Confirmed (L54 of index.js) | ✅ |
| **Intent** | `???` markers | N/A — indexer incomplete | ⚠️ |
| **Status** | GREEN | GREEN | ✅ |

**Summary:** Generates comprehensive Markdown migration reports from integr8 analysis output, including executive summary, graph analysis, conflicts, steps, risk assessment, and next steps.

**Findings:**

- **WRONG KIND** — Export is `function` declaration, not `variable`.

---

### 4. tomlSerializer.js

| Field | Schema Card Value | Verified Value | Match? |
|-------|-------------------|----------------|--------|
| **Exports** | 3 named vars (L4-6) | Same names at same lines, but kind=`function` not `variable` | ⚠️ KIND |
| **Imports** | `./types` | `./types` (L7) | ✅ |
| **importedBy** | `index.js`, `migrationExecutor.js` | Both confirmed | ✅ |
| **Intent** | `???` markers | N/A — indexer incomplete | ⚠️ |
| **Status** | GREEN | GREEN | ✅ |

**Summary:** TOML serialization/deserialization layer for migration plans and graph metadata. Handles round-trip encoding of plans, steps, conflicts, and graph properties.

**Findings:**

- **WRONG KIND** — All 3 exports are `function` declarations, not `variable`.

---

### 5. types.js

| Field | Schema Card Value | Verified Value | Match? |
|-------|-------------------|----------------|--------|
| **Exports** | 8 named vars, all at "line 4" | 8 enums at lines 6,14,21,34,49,58,67,76; kind=`enum` not `variable` | ❌ KIND+LINES |
| **Imports** | `[]` (none) | None confirmed | ✅ |
| **importedBy** | `backgroundIndexer.js`, `graphBuilder.js` | 8 modules: pathGenerator, relationshipAnalyzer, reportGenerator, tomlSerializer, migrationExecutor, dataIngestion, backgroundIndexer, graphBuilder | ❌ SEVERELY INCOMPLETE |
| **Intent** | "Internal module with no public exports" | Has 8 public enum exports | ❌ CONTRADICTED |
| **Status** | GREEN | Should be YELLOW (data integrity issues) | ⚠️ |

**Summary:** Shared type definitions and enum constants for the integr8 pipeline. Defines IntegrationOutcome, DependencyStatus, NodeType, EdgeType, MigrationAction, ConflictType, ResolutionStrategy, and VerificationLevel.

**Findings:**

- **WRONG KIND** — All 8 exports are `enum` (compiled to IIFE objects), not `variable`.
- **WRONG LINE NUMBERS** — All listed as "line 4" which is the aggregated `exports.X = ...` re-export line. Actual enum definitions span lines 6-82.
- **SEVERELY INCOMPLETE importedBy** — Lists only 2 of 8 actual importers. Missing: `pathGenerator.js` (L42), `relationshipAnalyzer.js` (L10), `reportGenerator.js` (L6), `tomlSerializer.js` (L7), `migrationExecutor.js` (L59), `dataIngestion.js` (L51). This is the most widely-imported module in the integr8 pipeline.
- **CONTRADICTED INTENT** — Says "no public exports" but has 8 named exports that are the foundation of the entire pipeline.

---

### 6. migrationExecutor.js

| Field | Schema Card Value | Verified Value | Match? |
|-------|-------------------|----------------|--------|
| **Exports** | 11 named vars (L46-56) | Same names at same lines, but kind=`function` not `variable` | ⚠️ KIND |
| **Imports** | `./views/NewView.vue` (dynamic), `./types`, `./tomlSerializer`, `child_process`, `crypto` (×2) | `fs-extra` (L57), `path` (L58), `./types` (L59), `./tomlSerializer` (L60) | ❌ MULTIPLE |
| **importedBy** | `[]` (none) | Confirmed — no direct importers found | ✅ |
| **Intent** | `???` markers | N/A — indexer incomplete | ⚠️ |
| **Status** | RED | RED — reachability 0, likely dead code | ✅ |

**Summary:** Migration execution engine. Loads TOML plans, executes step-by-step migrations, handles router framework detection, verification, rollback, and snapshot management.

**Findings:**

- **PHANTOM IMPORT** — `./views/NewView.vue` listed as dynamic import. This is a STRING LITERAL inside a route definition template at line 362: `component: () => import("./views/NewView.vue")`. The indexer incorrectly parsed a code-generation template string as a real import.
- **PHANTOM IMPORTS** — `child_process` and `crypto` are listed as imports but are only `require()`d INSIDE function bodies (lazy requires at lines 1397, 1658, 1734). They are NOT top-level module imports.
- **DUPLICATE IMPORT** — `crypto` appears twice in the imports list (lines 116-119 and 122-125). This is a data duplication bug in the indexer.
- **MISSING IMPORTS** — `fs-extra` (line 57) and `path` (line 58) are real top-level imports completely absent from the schema card.
- **WRONG KIND** — All 11 exports are `function` declarations, not `variable`.

---

## Cross-Cutting Findings

### CF-01: All exports misclassified as `variable`

**Severity:** WARNING
**Affected:** All 6 files
**Issue:** Every function and enum export is classified as `kind: "variable"`. The indexer appears to treat `exports.X = X` assignment patterns as variable exports rather than recognizing the original declaration kind.
**Fix:** The indexer should trace back to the original function/enum declaration to determine kind, not just the export assignment.

### CF-02: All intent fields contain `???` placeholders

**Severity:** WARNING
**Affected:** All 6 files
**Issue:** Every `intent.purpose`, `intent.dependsOnBehavior`, and `intent.valueStatement` field contains `???` markers, indicating the indexer's intent analysis failed or was never run.
**Fix:** Run a post-indexing intent enrichment pass, or disable the `???` output so consumers can distinguish "unknown" from "not yet analyzed."

### CF-03: Import detection parses string literals as imports

**Severity:** BLOCKER
**Affected:** pathGenerator.js (`./${toNode.name}`), migrationExecutor.js (`./views/NewView.vue`)
**Issue:** The indexer's import parser matches `import()` and `require()` patterns inside string literals, template strings, and code-generation templates. This creates phantom imports that don't exist in the actual module dependency graph.
**Fix:** The import parser must skip matches inside string literals and template contexts. A simple heuristic: if `import(` or `require(` appears inside a quoted string or is preceded by `: () =>`, it's likely a template/codegen pattern, not a real import.

### CF-04: importedBy graph is severely incomplete

**Severity:** BLOCKER
**Affected:** types.js (2 of 8 importers listed), pathGenerator.js (1 of 1 — fabricated 13 others)
**Issue:** The reverse-dependency graph is unreliable. For `types.js`, it misses 75% of actual importers. For `pathGenerator.js`, it fabricates 13 non-existent importers. The indexer either fails to track reverse dependencies or uses incorrect matching heuristics.
**Fix:** The indexer should build the `importedBy` graph by scanning all `require()`/`import()` calls and recording the source file, rather than relying on string matching or incomplete traversal.

### CF-05: Duplicate import entries in migrationExecutor.js

**Severity:** WARNING
**Affected:** migrationExecutor.js
**Issue:** `crypto` appears twice in the imports array (lines 116-119 and 122-125 with identical structure).
**Fix:** Deduplicate imports by source path during indexing.

### CF-06: Import source path inconsistency not flagged

**Severity:** INFO
**Affected:** All files importing types.js
**Issue:** Some files use `require("./types")` (no extension) while others use `require("./types.js")` (with extension). The schema cards mirror this inconsistency but don't flag it as a potential issue.
**Fix:** The indexer could normalize import paths or flag extension inconsistencies as a code quality finding.

---

## Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| BLOCKER  | 2     | Phantom imports from string literals; incomplete fabricated importedBy graph |
| WARNING  | 5     | All exports wrong kind; intent fields empty; duplicate imports; migrationExecutor missing real imports |
| INFO     | 1     | Import path extension inconsistency |

---

## Status Recommendation

| File | Schema Status | Recommendation |
|------|---------------|----------------|
| pathGenerator.js | GREEN → **YELLOW** | Fabricated importedBy, phantom import, missing crypto import |
| relationshipAnalyzer.js | GREEN | Acceptable — minor kind issue only |
| reportGenerator.js | GREEN | Acceptable — minor kind issue only |
| tomlSerializer.js | GREEN | Acceptable — minor kind issue only |
| types.js | GREEN → **YELLOW** | Severely incomplete importedBy, contradicted intent |
| migrationExecutor.js | RED | Correctly flagged — phantom imports, missing real imports, likely dead code |

---

_Reviewed: 2026-05-14_
_Method: Source file cross-reference verification_
_Depth: standard (per-file analysis with cross-file import graph verification)_
