# Backend Wave 3 — Schema Card Review

**Reviewed:** 2026-05-14T00:00:00Z
**Files:** 4 schema cards from `.st8/schema-cards/`
**Status:** All 4 cards are RED (intent fields incomplete — marked with `???`)

---

## File Summary Table

| # | Schema Card File | Source File | Status | Exports | Imports (source) | Imported By |
|---|---|---|---|---|---|---|
| 1 | `backend_prdGenerator.js.json` | `backend/prdGenerator.js` | 🔴 RED | 6 named vars | `fs`, `path` | `backend/server.js` |
| 2 | `backend_schemaCardEmitter.js.json` | `backend/schemaCardEmitter.js` | 🔴 RED | 1 named var | `path`, `fs`, `./st8-types`, `./persistence` | `backend/index.js`, `backend/server.js` |
| 3 | `backend_schemaCardPrinter.js.json` | `backend/schemaCardPrinter.js` | 🔴 RED | 1 named var | `path`, `fs` | `backend/index.js` |
| 4 | `backend_verify-persistence-fixes.js.json` | `backend/verify-persistence-fixes.js` | 🔴 RED | 0 (none) | `path`, `fs`, `./persistence` | _(none)_ |

---

## 1. `backend_prdGenerator.js.json` — PRD Generator

**Source:** `backend/prdGenerator.js` (200 lines, 5871 bytes)

### Exports

| Name | Kind (card) | Kind (actual) | Line | Visibility |
|---|---|---|---|---|
| `loadSchemaCards` | variable | function | 193 | named |
| `groupByLifecyclePhase` | variable | function | 193 | named |
| `generateCardMarkdown` | variable | function | 193 | named |
| `generatePRD` | variable | function | 193 | named |
| `writePRD` | variable | function | 193 | named |
| `main` | variable | function | 193 | named |

> ⚠️ **Note:** All exports show `kind: "variable"` and `line: 193` because the AST parser detected the `module.exports = { ... }` block at line 193, not the individual function declarations. Actual kind is `function` for all six.

### Imports (from card)

| Import Type | Source | Specifiers |
|---|---|---|
| require | `fs` | _(none)_ |
| require | `path` | _(none)_ |

### Connections

| Direction | Module |
|---|---|
| **importedBy** | `backend/server.js` |
| **imports** | `lib/commands/integr8/pathGenerator.js` |

### Intent

| Field | Value |
|---|---|
| **Purpose** | Code or data generation ??? |
| **dependsOnBehavior** | File system operations, file path manipulation ??? |
| **valueStatement** | Provides loadSchemaCards API, groupByLifecyclePhase API, generateCardMarkdown API, generatePRD API, writePRD API, main API ??? |

### Accurate Summary

Reads schema card JSON files from `.st8/schema-cards/`, groups them by lifecycle phase, and generates a comprehensive Product Requirements Document (PRD) in markdown format. Also usable as a CLI tool (`node backend/prdGenerator.js [targetDir]`).

---

## 2. `backend_schemaCardEmitter.js.json` — Schema Card Emitter

**Source:** `backend/schemaCardEmitter.js` (209 lines, 8376 bytes)

### Exports

| Name | Kind (card) | Kind (actual) | Line | Visibility |
|---|---|---|---|---|
| `SchemaCardEmitter` | variable | class | 209 | named |

> ⚠️ **Note:** `SchemaCardEmitter` is a class (line 17), not a variable. The card reports `variable` because it's exported via `module.exports = { SchemaCardEmitter }` at line 209.

### Imports (from card)

| Import Type | Source | Specifiers |
|---|---|---|
| require | `path` | _(none)_ |
| require | `fs` | _(none)_ |
| require | `./st8-types` | _(none)_ |
| require | `./persistence` | _(none)_ |

### Connections

| Direction | Module |
|---|---|
| **importedBy** | `backend/index.js`, `backend/server.js` |
| **imports** | `lib/commands/integr8/pathGenerator.js`, `backend/st8-types.js`, `backend/persistence.js` |

### Intent

| Field | Value |
|---|---|
| **Purpose** | Schema card emission ??? |
| **dependsOnBehavior** | File path manipulation, file system operations, type definitions and constants, database persistence layer ??? |
| **valueStatement** | Provides schema card emission ??? |

### Accurate Summary

Generates deterministic `.st8/schema-card.json` files for every indexed file in the project. Reads file metadata and AST results from the persistence layer, validates against a canonical schema shape, and writes sorted-key JSON for consistent git diffs. Supports bulk emission (`emitAllCards`) and single-file diff mode.

---

## 3. `backend_schemaCardPrinter.js.json` — Schema Card Printer

**Source:** `backend/schemaCardPrinter.js` (294 lines, 14042 bytes)

### Exports

| Name | Kind (card) | Kind (actual) | Line | Visibility |
|---|---|---|---|---|
| `SchemaCardPrinter` | variable | class | 294 | named |

> ⚠️ **Note:** `SchemaCardPrinter` is a class (line 25), not a variable.

### Imports (from card)

| Import Type | Source | Specifiers |
|---|---|---|
| require | `path` | _(none)_ |
| require | `fs` | _(none)_ |

### Connections

| Direction | Module |
|---|---|
| **importedBy** | `backend/index.js` |
| **imports** | `lib/commands/integr8/pathGenerator.js` |

### Intent

| Field | Value |
|---|---|
| **Purpose** | Schema card emission ??? |
| **dependsOnBehavior** | File path manipulation, file system operations ??? |
| **valueStatement** | Provides formatted output ??? |

### Accurate Summary

Emits human-readable `.txt` identity cards to `.planning/st8_identity_system/` as a fallback when the ST8 visual system is offline. Each card contains boxed sections for identity, content version, classification, exports, imports, connections, intent, and mutations. Includes a pruning mechanism to cap timestamped files at 10 per base name and maintains `LATEST_*` snapshot files.

---

## 4. `backend_verify-persistence-fixes.js.json` — Persistence Fix Verifier

**Source:** `backend/verify-persistence-fixes.js` (153 lines, 5286 bytes)

### Exports

| Name | Kind (card) | Kind (actual) | Line | Visibility |
|---|---|---|---|---|
| _(none)_ | — | — | — | — |

### Imports (from card)

| Import Type | Source | Specifiers |
|---|---|---|
| require | `path` | _(none)_ |
| require | `fs` | _(none)_ |
| require | `./persistence` | _(none)_ |

### Connections

| Direction | Module |
|---|---|
| **importedBy** | _(nothing — standalone script)_ |
| **imports** | `lib/commands/integr8/pathGenerator.js`, `backend/persistence.js` |

### Intent

| Field | Value |
|---|---|
| **Purpose** | SQLite persistence layer — Verification script for persistence.js fixes ??? |
| **dependsOnBehavior** | File path manipulation, file system operations, database persistence layer ??? |
| **valueStatement** | Provides assert API, runTests API ??? |

### Accurate Summary

Standalone verification script that tests three persistence.js bug fixes: CR-01 (UNIQUE constraint on connections prevents duplicates), CR-02 (deleteFile cascades cleanup to file_mutation_log), and CR-03 (confidenceScore of 0 is preserved, not coerced to 1.0). Uses in-memory SQLite and exits with code 1 on any failure.

---

## Cross-Cutting Observations

### 1. All Cards RED — Intent Fields Incomplete

Every card has `???` appended to intent fields. The indexer could not determine purpose/behavior/value automatically. **These need manual intent enrichment** to move to GREEN.

### 2. Export Kind Misclassification

All exports are reported as `kind: "variable"`. The AST parser detects the `module.exports = { ... }` assignment rather than the original declaration. `SchemaCardEmitter` and `SchemaCardPrinter` are classes; `prdGenerator` exports are functions. This is a parser limitation, not a data error.

### 3. Connection Graph vs. Import Statements Divergence

The `connections.imports` field (from persistence DB) differs from the `imports` field (from AST parsing):

| Card | AST `imports` | DB `connections.imports` |
|---|---|---|
| prdGenerator | `fs`, `path` | `lib/commands/integr8/pathGenerator.js` |
| schemaCardEmitter | `path`, `fs`, `./st8-types`, `./persistence` | `pathGenerator.js`, `st8-types.js`, `persistence.js` |
| schemaCardPrinter | `path`, `fs` | `pathGenerator.js` |
| verify-persistence-fixes | `path`, `fs`, `./persistence` | `pathGenerator.js`, `persistence.js` |

The AST field captures `require()` calls in source. The connections field captures the resolved dependency graph from the persistence DB. Both are valid but represent different abstraction levels.

### 4. Orphaned Script

`verify-persistence-fixes.js` has **no exports and no importers**. It's a standalone verification script. This is intentional (it's a test/verification tool), but it means:
- It will never appear in the connection graph as a dependency
- It could be moved to a `test/` or `scripts/` directory for clarity

### 5. Unused Imports in Schema Cards

`prdGenerator.js` imports `path` (used) and `fs` (used). `verify-persistence-fixes.js` imports both `path` and `fs` (lines 9-10) but neither is used anywhere in the file. The script only uses `require('./persistence')`, `console.*`, and `process.exit`. These are dead imports.

---

_Reviewed: 2026-05-14_
_Source: .st8/schema-cards/ (4 files)_
_Cross-referenced against: backend/ source files_
