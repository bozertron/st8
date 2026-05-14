# Review: lib/commands Wave 2 — Schema Card Analysis

**Reviewed:** 2026-05-14
**Source:** `.st8/schema-cards/` — 5 JSON files
**Scope:** `lib/commands/overview.js`, `lib/commands/integr8/` module

---

## Summary Table

| File | Status | Exports | Imported By | Key Concern |
|------|--------|---------|-------------|-------------|
| `overview.js` | 🟢 GREEN | 1 | 0 (standalone) | None — self-contained utility |
| `databasePersister.js` | 🟢 GREEN | 2 | 5 modules | Core infra — well-connected |
| `dataIngestion.js` | 🟢 GREEN | 4 | 3 modules | Heaviest import fan-out (11 deps) |
| `integr8/index.js` | 🔴 RED | 1 | 0 (orphan) | **Orphaned entry point** — nothing calls `runIntegr8Command` |
| `migrationExecutor.js` | 🔴 RED | 11 | 0 (orphan) | **Orphaned** — 11 exports, zero consumers |

---

## 1. `overview.js`

**Path:** `lib/commands/overview.js` | **Size:** 17.9 KB | **Status:** 🟢 GREEN

| Field | Value |
|-------|-------|
| **Exports** | `generateOverviewAndGetFileList` (variable, L15) |
| **Imports** | None |
| **Imported By** | None (standalone) |
| **Imports (connections)** | None |
| **Purpose** | Project overview display — codebase indexing pipeline |
| **Depends On** | No external dependencies |
| **Value** | Provides `generateOverviewAndGetFileList` API for codebase scanning |

**Summary:** Self-contained utility that generates project overviews and file lists. Zero inbound connections suggest it's invoked directly by CLI or orchestrator, not by other modules. Clean leaf node.

---

## 2. `databasePersister.js`

**Path:** `lib/commands/integr8/databasePersister.js` | **Size:** 9.9 KB | **Status:** 🟢 GREEN

| Field | Value |
|-------|-------|
| **Exports** | `DatabasePersister` (variable, L41), `getSharedDatabasePath` (variable, L42) |
| **Imports** | None listed in `connections.imports` |
| **Imported By** | `backgroundIndexer.js`, `graphTraversal.js`, `insightStore.js`, `integr8/index.js`, `parserPersistence.js` |
| **Purpose** | Database persistence operations |
| **Depends On** | No external dependencies (card says) |
| **Value** | Provides `getSharedDatabasePath` and `DatabasePersister` APIs |

**Summary:** Core persistence layer used by 5 different modules. Well-connected hub — most-imported file in this wave. The `DatabasePersister` export is likely a class or factory; `getSharedDatabasePath` is a path-resolution utility. No issues.

---

## 3. `dataIngestion.js`

**Path:** `lib/commands/integr8/dataIngestion.js` | **Size:** 47.6 KB | **Status:** 🟢 GREEN

| Field | Value |
|-------|-------|
| **Exports** | `getParserHealthReport` (L47), `resetParserHealth` (L48), `ingestSingleProject` (L49), `ingestProjectData` (L50) |
| **Imports** | `./types.js`, `../overview.js`, `../storeParser.js`, `../routeParser.js`, `../commandParser.js`, `../typeParser.js`, `../uiParser.js`, `../parserPersistence.js`, `../../utils/astParser.js`, `../../utils/safeFs.js`, `../../utils/ioChan.js` |
| **Imported By** | `backgroundIndexer.js`, `graphBuilder.js`, `integr8/index.js` |
| **Connections (resolved)** | Imports: `backend/st8-types` |
| **Purpose** | Data ingestion pipeline |
| **Depends On** | types, overview, store/route/command/type/ui parsers, persistence, AST, filesystem, ioChan |
| **Value** | Provides parser health monitoring and project data ingestion APIs |

**Summary:** Largest file in this wave (47.6 KB). Orchestrates parsing of multiple file types (stores, routes, commands, types, UI) and manages parser health. 11 runtime dependencies — highest fan-out. The `overview.js` import confirms it uses the sibling module from wave 1.

---

## 4. `integr8/index.js` — ⚠️ ORPHANED

**Path:** `lib/commands/integr8/index.js` | **Size:** 7.2 KB | **Status:** 🔴 RED

| Field | Value |
|-------|-------|
| **Exports** | `runIntegr8Command` (variable, L47) |
| **Imports** | `./dataIngestion.js`, `./relationshipAnalyzer.js`, `./pathGenerator.js`, `./tomlSerializer.js`, `./reportGenerator.js`, `./databasePersister.js` |
| **Imported By** | **None** |
| **Connections (resolved)** | Imports 6 sibling modules |
| **Purpose** | Module entry point for integr8 command |
| **Depends On** | All 5 sibling integr8 modules |
| **Value** | Provides `runIntegr8Command` API |

### 🔴 Issue: Orphaned Entry Point

`runIntegr8Command` is exported but **nothing imports it**. This is the barrel/entry-point for the entire `integr8/` subsystem, wiring together 6 sub-modules. Possibilities:

1. **Dead code** — the integr8 command was deprecated but never removed
2. **Missing wiring** — a CLI command or orchestrator should import this but doesn't
3. **Indexer gap** — the importer exists but wasn't captured in the schema card

**Action:** Verify whether any CLI handler or command router calls `runIntegr8Command`. If not, this entire submodule tree may be dead code.

---

## 5. `migrationExecutor.js` — ⚠️ ORPHANED

**Path:** `lib/commands/integr8/migrationExecutor.js` | **Size:** 84.5 KB | **Status:** 🔴 RED

| Field | Value |
|-------|-------|
| **Exports** | `loadMigrationPlan` (L46), `executeMigrationPlan` (L47), `detectRouterFramework` (L48), `detectFrameworkFromPackageJson` (L49), `verifyIntegration` (L50), `rollbackMigration` (L51), `createPreMigrationSnapshot` (L52), `executeAtomicMigration` (L53), `rollbackFromSnapshot` (L54), `listAvailableSnapshots` (L55), `rollbackToLatest` (L56) |
| **Imports** | `./views/NewView.vue` (dynamic), `./types`, `./tomlSerializer`, `child_process`, `crypto` (×2) |
| **Imported By** | **None** |
| **Connections (resolved)** | Imports: `backend/st8-types`, `integr8/tomlSerializer` |
| **Purpose** | Database migration execution |
| **Depends On** | NewView.vue, types, tomlSerializer, child_process, crypto |
| **Value** | Full migration lifecycle — load, execute, verify, snapshot, rollback |

### 🔴 Issue: Orphaned — 11 Exports, Zero Consumers

The largest file in this wave (84.5 KB) exports 11 functions covering the entire migration lifecycle but **nothing imports any of them**. Combined with `index.js` also being orphaned, this suggests the entire `integr8/` migration subsystem may be dead code.

### ⚠️ Issue: Duplicate Import

`crypto` is imported twice (lines 117–119 and 121–125). Harmless but indicates copy-paste.

### ⚠️ Issue: Dynamic Vue Import in Backend Module

Line 96–100: `import('./views/NewView.vue')` — a dynamic import of a Vue SFC inside a migration executor. This is unusual for a backend/command module and may indicate:
- Misplaced frontend code
- Template rendering for migration reports
- Incorrect import path

### ⚠️ Issue: `child_process` Usage

The module imports `child_process` (L113–115). Migration executors that shell out need careful input sanitization. Without seeing the implementation, this is a **potential command injection surface** if migration plan contents are interpolated into shell commands.

---

## Cross-File Observations

### Dependency Graph (this wave)

```
overview.js (standalone)
     ↑
dataIngestion.js (11 deps, imported by 3)
     ↑
integr8/index.js ──→ dataIngestion, relationshipAnalyzer, pathGenerator,
   (orphan)             tomlSerializer, reportGenerator, databasePersister

databasePersister.js (imported by 5 — hub)
migrationExecutor.js → tomlSerializer, types, child_process, crypto
   (orphan)
```

### Key Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | 🔴 RED | `integr8/index.js` — orphaned entry point, `runIntegr8Command` has zero consumers |
| 2 | 🔴 RED | `migrationExecutor.js` — orphaned, 11 exports with zero consumers (84.5 KB dead code?) |
| 3 | 🟡 WARN | `migrationExecutor.js` — duplicate `crypto` import (L117–125) |
| 4 | 🟡 WARN | `migrationExecutor.js` — dynamic Vue SFC import in backend module (L96–100) |
| 5 | 🟡 WARN | `migrationExecutor.js` — `child_process` usage is a command injection surface without visible input sanitization |
| 6 | ℹ️ INFO | `dataIngestion.js` — 47.6 KB file with 11 deps; candidate for decomposition |
| 7 | ℹ️ INFO | All `???` markers in `intent` fields suggest indexer uncertainty — manual review of purpose statements recommended |

---

*Generated: 2026-05-14*
*Source: `.st8/schema-cards/` JSON files*
