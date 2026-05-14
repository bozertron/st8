# ST8 Architecture Refactoring — Pressure Test Report

**Date:** 2026-05-14
**Reviewer:** Claude (gsd-code-reviewer)
**Scope:** Proposed `src/` structure vs. current `backend/`, `lib/`, root frontend files

---

## Executive Summary

The proposed architecture is **structurally sound in concept** but the mapping has **significant gaps** that would cause broken imports, missing features, and a non-functional application if executed as-is. The `src/` directory already exists with 98 empty skeleton files — the directory structure is created but **zero code has been migrated**.

**Critical Issues: 6**
**Warnings: 8**
**Total Issues: 14**

---

## 1. Missing Files — FAIL ❌

**Question:** Are there any source files in the current codebase that aren't mapped to the new structure?

### CR-01: `backend/templateEngine.js` Completely Unmapped

**File:** `backend/templateEngine.js` (120 lines)
**Issue:** This file is a **working, actively-used module** — `server.js` imports it at lines 1364 and 1401 for the `/api/templates` endpoint. It is **not mentioned anywhere** in the MASTER_INDEX or any mapping document.
**Impact:** The `/api/templates` GET and POST endpoints would break completely.
**Fix:** Add mapping to `src/0_features/0_prd/0_template-engine.js` or `src/0_core/0_server/0_template-engine.js`.

### CR-01b: `lib/commands/integr8/migrationExecutor.js` Labeled as Dead Code

**File:** `lib/commands/integr8/migrationExecutor.js` (1836 lines, 11 exports)
**Issue:** This file was labeled "dead code" to delete, but it has 11 exported functions including `executeAtomicMigration`, `rollbackFromSnapshot`, `createPreMigrationSnapshot` — sophisticated migration infrastructure. It's not dead, it's *dormant* — never wired up.
**Impact:** Deleting this file would lose 1,836 lines of migration infrastructure with atomic operations and rollback capabilities.
**Fix:** Keep this file. Map to `src/0_features/0_analysis/0_migration-executor.js`. Wire up when ready.

### CR-01c: No Files Will Be Deleted

**Principle:** No files will be deleted during this refactoring. All files will be copied to their target locations. Benjamin will decide what gets removed after the refactoring is complete.

**Rationale:** The LLM's判断 about "dead code" was wrong for `migrationExecutor.js` — it's dormant infrastructure, not dead code. This principle applies to ALL files flagged as "dead code" — they may be dormant, not dead.

### CR-02: `start.js` (148 lines) Completely Unmapped

**File:** `start.js` (148 lines)
**Issue:** This is the **primary application entry point** (`npm start` runs `node start.js`). It handles dependency installation, backend spawning, browser opening, and CLI argument parsing. It is not mentioned in any index or mapping.
**Impact:** The application cannot be started after refactoring.
**Fix:** Map to `src/0_core/0_server/0_start.js` or keep at root and update the `backend/index.js` path reference.

### CR-03: `st8.html` Inline JavaScript (~900 lines) Not Extracted

**File:** `st8.html` (2587 lines total)
**Issue:** The mapping says `0_frontend/0_index.html` ← `st8.html (HTML only) ~70 lines`. This is **wildly inaccurate**. The file contains:
- **~1550 lines of inline CSS** (lines 137-1686) — fonts, themes, layouts, animations
- **~70 lines of HTML structure** (lines 1687-1757)
- **~830 lines of inline JavaScript** (lines 1760-2585) — panel controller, settings UI, SSE connection, mutation toasts, PRD wizard, graph viewer integration, file list rendering, health polling, AI review badge

The inline JS includes critical application logic that is **not present in any of the separate `.js` files** (file-explorer.js, phreak-terminal.js, etc.). These separate files only provide panel-level components; the main application orchestration lives inline in the HTML.
**Impact:** Extracting "HTML only" would lose the entire application controller, SSE handling, mutation notifications, PRD wizard logic, and settings management.
**Fix:** The inline JavaScript must be extracted into separate modules:
- `src/0_frontend/0_app.js` — main orchestrator (panel controller, SSE, health polling)
- `src/0_frontend/0_components/0_notifications/0_toast.js` — mutation toast system
- `src/0_frontend/0_components/0_prd-wizard/0_prd-wizard.js` — PRD wizard
- `src/0_frontend/0_styles/*.css` — extract inline CSS into separate files

### CR-04: `fonts/` Directory Unmapped

**Files:** `fonts/Monoton-Regular.ttf`, `fonts/PoiretOne-Regular.ttf`
**Issue:** The `st8.html` references these fonts via `@font-face` declarations. They are not accounted for in the new structure.
**Impact:** Typography would break in the UI.
**Fix:** Map to `src/0_frontend/0_styles/0_fonts/` or `src/0_frontend/0_assets/0_fonts/`.

### WR-01: `backend/verify-persistence-fixes.js` Unmapped

**File:** `backend/verify-persistence-fixes.js` (153 lines)
**Issue:** This is a test/verification script. Not mentioned in any index.
**Fix:** Map to `tests/verify-persistence-fixes.js` or `scripts/verify-persistence-fixes.js`.

### WR-02: Backend Documentation Files Unmapped

**Files:** `backend/SCHEMA-CARD-EMITTER-REPORT.md`, `backend/SECURITY-AUDIT-H1.md`
**Issue:** These are backend-specific documentation files not mentioned in any mapping.
**Fix:** Map to `docs/backend/` or include in `src/0_core/` documentation.

---

## 2. Missing Dependencies — FAIL ❌

**Question:** Are there any import/require relationships that would break in the new structure?

### CR-05: 14 API Endpoints Missing Route Files

**Issue:** The proposed structure only maps **6 of 20** API endpoints to route files:

| Mapped | Missing |
|--------|---------|
| `/api/files` → `0_files.js` | `/api/index` |
| `/api/connection-state.json` → `0_connections.js` | `/api/file-intent` |
| `/api/prd` → `0_schema-cards.js` | `/api/verify` |
| `/api/settings` → `0_settings.js` | `/api/mutations` (SSE) |
| `/api/health` → `0_health.js` | `/api/concept-file` |
| `/api/mutations` → `0_sse.js` | `/api/mvp-lock` |
| | `/api/production-promote` |
| | `/api/gap-analysis` |
| | `/api/prd-projects` |
| | `/api/bruno-call` |
| | `/api/oscar-house` |
| | `/api/needs-ai-review` |
| | `/api/mark-reviewed` |
| | `/api/templates` |

**Impact:** 14 API endpoints would have no route handler in the new structure.
**Fix:** Create route files for all 20 endpoints:
- `0_server/0_routes/0_api/0_index.js` (POST /api/index)
- `0_server/0_routes/0_api/0_file-intent.js` (POST /api/file-intent)
- `0_server/0_routes/0_api/0_verify.js` (POST /api/verify)
- `0_server/0_routes/0_api/0_concept-file.js` (POST /api/concept-file)
- `0_server/0_routes/0_api/0_mvp-lock.js` (POST /api/mvp-lock)
- `0_server/0_routes/0_api/0_production-promote.js` (POST /api/production-promote)
- `0_server/0_routes/0_api/0_gap-analysis.js` (GET /api/gap-analysis)
- `0_server/0_routes/0_api/0_prd-projects.js` (GET/POST /api/prd-projects)
- `0_server/0_routes/0_api/0_bruno-call.js` (POST /api/bruno-call)
- `0_server/0_routes/0_api/0_oscar-house.js` (POST /api/oscar-house)
- `0_server/0_routes/0_api/0_needs-ai-review.js` (GET /api/needs-ai-review)
- `0_server/0_routes/0_api/0_mark-reviewed.js` (POST /api/mark-reviewed)
- `0_server/0_routes/0_api/0_templates.js` (GET/POST /api/templates)

### WR-03: `astParser.js` Mapping Conflict

**Issue:** Two different mapping targets exist for `lib/utils/astParser.js`:
1. `0_MASTER_INDEX.md` line 139: → `src/0_features/0_indexing/0_ast-parser.js`
2. `0_LIB_UTILS_INDEX.md` line 51: → `src/0_shared/0_utils/0_ast-parser.js`

The file is used by both `indexer.js` (indexing feature) and `schemaCardEmitter.js` (schema-cards feature) and `dataIngestion.js` (indexing feature). Placing it in `0_shared/0_utils/` is correct since it's a cross-cutting utility.
**Impact:** Confusion during migration; wrong location chosen.
**Fix:** Canonical location should be `src/0_shared/0_utils/0_ast-parser.js`. Remove the `0_features/0_indexing/0_ast-parser.js` skeleton or repurpose it as a re-export.

### WR-04: `tomlSerializer.js` Not in Proposed Structure

**File:** `lib/commands/integr8/tomlSerializer.js` (417 lines)
**Issue:** The `0_LIB_COMMANDS_INDEX.md` maps it to `src/0_shared/0_utils/0_toml-serializer.js`, but this file does **not exist** in the `src/` directory structure. No skeleton was created.
**Impact:** TOML serialization would be lost.
**Fix:** Create `src/0_shared/0_utils/0_toml-serializer.js`.

### WR-05: `manifestGenerator.js` Not in Schema-Cards Feature

**File:** `backend/manifestGenerator.js` (172 lines)
**Issue:** The `0_BACKEND_INDEX.md` maps it to `src/0_features/0_schema-cards/0_manifest-generator.js`, but this file does **not exist** in the `src/` directory. The `0_schema-cards/` directory only has `0_emitter.js`, `0_index.js`, `0_printer.js`.
**Impact:** Manifest generation (connection-state.json, ai-signal.toml) would be lost.
**Fix:** Create `src/0_features/0_schema-cards/0_manifest-generator.js`.

---

## 3. Missing Features — FAIL ❌

**Question:** Are there any features or capabilities that would be lost in the refactoring?

### CR-06: Static File Serving Path Breakage

**Issue:** The current `server.js` line 30 sets `STATIC_DIR = path.join(__dirname, '..')` — meaning it serves files from the **project root** (where `st8.html`, `file-explorer.js`, `phreak-terminal.js`, etc. live). After refactoring:
- The server code moves to `src/0_core/0_server/`
- The frontend files move to `src/0_frontend/`
- The `STATIC_DIR` calculation would point to `src/0_core/` instead of the project root

The `st8.html` loads scripts via relative paths: `<script src="file-explorer.js">`, `<script src="phreak-terminal.js">`, etc. These would break because the files are no longer siblings.
**Impact:** The entire frontend would fail to load.
**Fix:** Either:
1. Update `STATIC_DIR` to point to `src/0_frontend/` and update all script `src` attributes in the HTML
2. Or keep `st8.html` at root and update `STATIC_DIR` calculation
3. Or introduce a build step that bundles the frontend

### WR-06: `settings-reader.js` Not Loaded by HTML

**Issue:** `st8.html` loads 5 scripts (lines 1790-1794): `file-explorer.js`, `phreak-terminal.js`, `graph-visualizer.js`, `settings-ui.js`, `coordination.js`. But `settings-reader.js` is **not loaded** by the HTML — it exists as a standalone file with zero connectivity. The mapping puts it in `src/0_frontend/0_services/0_state.js`, but there's no evidence it's actually used by any other frontend file.
**Impact:** If the refactoring assumes `settings-reader.js` is active, it may create false dependencies.
**Fix:** Verify whether `settings-reader.js` is actually needed. If not, mark for deletion.

### WR-07: Duplicate Schema Definitions

**Issue:** The SQL schema is defined in **two places**:
1. `backend/persistence.js` lines 45-162 (7 tables, 12 indexes)
2. `backend/indexer.js` lines 72-157 (5 tables, 8 indexes — subset)

The `persistence.js` schema is more complete (includes `prd_projects`, `ai_content` tables). The `indexer.js` schema is a **stale duplicate**.
**Impact:** If both schemas are migrated, there will be conflicting definitions.
**Fix:** Only migrate the `persistence.js` schema to `src/0_core/0_database/0_schema/0_001_initial.sql`. The `indexer.js` schema should be deleted (it's already dead code since `indexer.js` never actually creates tables — it's a leftover).

---

## 4. Circular Dependencies — PASS ✅ (with caveats)

**Question:** Would the new structure create any circular dependency issues?

The proposed layered architecture (`0_core` → `0_features` → `0_shared`) is sound. However, the **current codebase** has implicit circular patterns that need attention during migration:

### WR-08: `server.js` → `indexer.js` → `lib/` → `persistence.js` Chain

**Current dependency chain:**
```
server.js → indexer.js → st8-types.js (OK)
server.js → persistence.js → st8-types.js (OK)
server.js → schemaCardEmitter.js → persistence.js (potential issue)
indexer.js → graphBuilder.js → dataIngestion.js → parserPersistence.js → databasePersister.js
```

The `schemaCardEmitter.js` imports `persistence.js` at line 197, creating a bidirectional dependency between server and persistence layers.
**Impact:** In the new structure, if `0_schema-cards/0_emitter.js` imports from `0_core/0_database/`, this is fine (features → core is allowed). But if `0_database/` ever imports from `0_features/`, it would be circular.
**Fix:** Ensure the migration preserves the unidirectional dependency: `0_features` → `0_core` → `0_shared`. Never `0_core` → `0_features`.

---

## 5. Configuration Gaps — FAIL ❌

**Question:** Are there any configuration files, environment variables, or settings that aren't accounted for?

### WR-09: Hardcoded Port Numbers

**Issue:** Port `3847` is hardcoded in:
- `start.js` line 19: `port: 3847`
- `backend/server.js` line 37: `this.port = options.port || 3847`
- `backend/index.js` line 67: `port = portArg !== -1 ? parseInt(args[portArg + 1]) : 3847`

The new `src/0_core/0_config/` module exists but is empty. The proposed `0_default.js` should centralize this.
**Fix:** Extract port to `src/0_core/0_config/0_default.js` and import from there.

### WR-10: `package.json` Scripts Not Updated

**Issue:** Both `package.json` files reference old paths:
- Root `package.json` line 7: `"start": "node start.js"` — `start.js` spawns `backend/index.js`
- Root `package.json` line 8: `"index": "node backend/indexer.js"`
- Root `package.json` line 9: `"serve": "node backend/server.js"`
- Backend `package.json` line 7: `"start": "node index.js"`

After refactoring, these would all break.
**Fix:** Update scripts to point to new `src/` paths.

---

## 6. Test Coverage — FAIL ❌

**Question:** Are there any test files or testing infrastructure that need to be accounted for?

### Issue: No Test Infrastructure

The codebase has **one** verification script (`backend/verify-persistence-fixes.js`) and **no test framework**. There are no:
- Unit tests
- Integration tests
- Test configuration (jest.config, mocha, etc.)
- Test directory structure

**Impact:** The refactoring has no safety net. Any migration error would go undetected until runtime.
**Fix:** Before executing the refactoring:
1. Add a test framework (jest or vitest recommended)
2. Write integration tests for the 20 API endpoints
3. Write unit tests for persistence layer
4. Run tests after each file migration

---

## 7. Build/Dev Tooling — WARNING ⚠️

**Question:** Are there any build scripts, dev tools, or CI/CD configurations that need to be updated?

### WR-11: No Build Pipeline for Frontend

**Issue:** The current frontend is loaded as raw `<script>` tags with `window.*` globals. The proposed `src/0_frontend/` structure suggests a more modular approach, but there's no:
- Bundler (webpack, vite, esbuild)
- Module system (ESM or CommonJS for browser)
- Build step to compile/bundle frontend files

**Impact:** The `src/0_frontend/` files can't use `import`/`export` without a bundler. They'd still need to attach to `window.*`.
**Fix:** Either:
1. Add a bundler (vite recommended for dev experience)
2. Or keep the `window.*` pattern and serve `src/0_frontend/` files directly

### WR-12: `st8.code-workspace` Not Updated

**File:** `st8.code-workspace`
**Issue:** VS Code workspace file may reference old paths.
**Fix:** Update workspace file after migration.

---

## 8. Documentation — PASS ✅ (minor)

**Question:** Are there any documentation files that need to be moved or updated?

Documentation files exist but are non-critical:
- `README.md` — root, may need path updates
- `docs/Agent Deployment.md` — not mapped
- `st8_bible.md`, `st8-filemap.md` — reference docs
- `CODEBASE_ARCHITECTURE_RESEARCH.md`, `DIRECTORY_STRUCTURE_VISUAL.md` — architecture docs

**Impact:** Low. Documentation can be updated after code migration.
**Fix:** Update `README.md` after migration. Other docs are reference material.

---

## 9. Output Directories — PASS ✅

**Question:** Are the .st8/ and .planning/ directories properly accounted for?

- `.st8/` is in `.gitignore` ✅
- `.planning/` is in `.gitignore` ✅
- `st8.sqlite`, `st8.sqlite-shm`, `st8.sqlite-wal` are in `.gitignore` ✅
- `connection-state.json` and `ai-signal.toml` are **generated output** written to `targetDir` (not the project root) — this is correct behavior

**Note:** The `st8.sqlite` database path is hardcoded as `path.join(process.cwd(), 'st8.sqlite')` in `persistence.js` line 168. After refactoring, `process.cwd()` should still work correctly since the server is started from the project root.

---

## 10. Entry Points — FAIL ❌

**Question:** Are all entry points (CLI, server, etc.) properly mapped?

### Entry Points Identified:

| Entry Point | Current | Proposed | Status |
|-------------|---------|----------|--------|
| `npm start` | `start.js` → `backend/index.js` | Not mapped | ❌ BROKEN |
| `npm run index` | `backend/indexer.js` (CLI) | `src/0_features/0_indexing/0_indexer.js` | ⚠️ Needs CLI section |
| `npm run serve` | `backend/server.js` | `src/0_core/0_server/0_app.js` | ⚠️ Needs update |
| `npm run dev` | `start.js --dev` | Not mapped | ❌ BROKEN |
| Shebang in `server.js` | `#!/usr/bin/env node` | Not mapped | ❌ BROKEN |
| Shebang in `indexer.js` | `#!/usr/bin/env node` | Not mapped | ❌ BROKEN |
| Shebang in `index.js` | `#!/usr/bin/env node` | Not mapped | ❌ BROKEN |

**Issue:** The `start.js` entry point is completely unmapped. The `backend/index.js` has a CLI section (lines 42-76) that parses `--watch`, `--serve`, `--port` flags — this needs to be preserved in the new entry point.
**Fix:** Create `src/0_core/0_server/0_start.js` as the new entry point, or keep `start.js` at root and update its path to `src/0_core/0_server/0_index.js`.

---

## Summary of All Findings

### Critical (BLOCKER) — Must Fix Before Migration

| ID | Issue | Impact |
|----|-------|--------|
| CR-01 | `templateEngine.js` unmapped | `/api/templates` endpoint breaks |
| CR-02 | `start.js` unmapped | Application cannot start |
| CR-03 | `st8.html` inline JS (~900 lines) not extracted | Entire app controller lost |
| CR-04 | `fonts/` directory unmapped | Typography breaks |
| CR-05 | 14 API endpoints missing route files | 70% of API breaks |
| CR-06 | Static file serving path breakage | Frontend fails to load |

### Warning — Should Fix

| ID | Issue | Impact |
|----|-------|--------|
| WR-01 | `verify-persistence-fixes.js` unmapped | Test script lost |
| WR-02 | Backend docs unmapped | Documentation lost |
| WR-03 | `astParser.js` mapping conflict | Confusion during migration |
| WR-04 | `tomlSerializer.js` skeleton missing | TOML serialization lost |
| WR-05 | `manifestGenerator.js` skeleton missing | Manifest generation lost |
| WR-06 | `settings-reader.js` connectivity unclear | Dead code risk |
| WR-07 | Duplicate schema definitions | Conflicting migrations |
| WR-08 | Bidirectional dependency in schemaCardEmitter | Potential circular dep |
| WR-09 | Hardcoded port numbers | Config not centralized |
| WR-10 | `package.json` scripts not updated | npm commands break |
| WR-11 | No build pipeline for frontend | Can't use ES modules |
| WR-12 | `st8.code-workspace` not updated | IDE config stale |

---

## Recommendations

### Before Migration (Blockers)

1. **Complete the file inventory** — Add `templateEngine.js`, `start.js`, `fonts/`, and all 14 missing API route files to the mapping
2. **Extract `st8.html` inline code** — This is the largest single task. The ~900 lines of inline JS and ~1550 lines of inline CSS need to be extracted into separate modules before the HTML can be simplified
3. **Create all missing skeleton files** — `0_manifest-generator.js`, `0_toml-serializer.js`, and all 14 API route files
4. **Update `STATIC_DIR` strategy** — Decide whether the frontend stays at root or moves to `src/0_frontend/`

### During Migration (Process)

5. **Migrate one feature at a time** — Start with `0_shared/` (no dependencies), then `0_core/`, then `0_features/`
6. **Test after each file** — Run the application after each file migration to catch breakage early
7. **Keep old files until verified** — Don't delete originals until the new structure is fully working
8. **Update imports incrementally** — Change `require('./persistence')` to `require('../../0_core/0_database/0_connection')` one file at a time

### After Migration (Cleanup)

9. **Add test framework** — The codebase has zero tests; this is a risk multiplier
10. **Centralize configuration** — Move hardcoded values to `0_config/0_default.js`
11. **Consider a bundler** — For the frontend, vite would enable proper ES module usage

---

## Files Already Created (Empty Skeletons)

The `src/` directory contains **98 files**, all with **0 lines of content**. The directory structure is ready but no code has been migrated. This is a good start — the skeleton approach allows incremental migration.

### Skeleton Inventory

| Directory | Files | All Empty |
|-----------|-------|-----------|
| `src/0_core/0_config/` | 6 | ✅ |
| `src/0_core/0_database/` | 12 | ✅ |
| `src/0_core/0_errors/` | 6 | ✅ |
| `src/0_core/0_logging/` | 3 | ✅ |
| `src/0_core/0_server/` | 8 | ✅ |
| `src/0_features/0_analysis/` | 3 | ✅ |
| `src/0_features/0_graph/` | 4 | ✅ |
| `src/0_features/0_indexing/` | 5 | ✅ |
| `src/0_features/0_lifecycle/` | 2 | ✅ |
| `src/0_features/0_prd/` | 2 | ✅ |
| `src/0_features/0_schema-cards/` | 3 | ✅ |
| `src/0_features/0_watcher/` | 3 | ✅ |
| `src/0_frontend/` | 17 | ✅ |
| `src/0_shared/` | 15 | ✅ |
| **Total** | **98** | **All 0 lines** |

---

## Missing Skeleton Files (Need Creation)

| Proposed File | Source | Status |
|---------------|--------|--------|
| `src/0_features/0_prd/0_template-engine.js` | `backend/templateEngine.js` | ❌ Missing |
| `src/0_core/0_server/0_start.js` | `start.js` | ❌ Missing |
| `src/0_shared/0_utils/0_toml-serializer.js` | `lib/commands/integr8/tomlSerializer.js` | ❌ Missing |
| `src/0_features/0_schema-cards/0_manifest-generator.js` | `backend/manifestGenerator.js` | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_index.js` | `server.js` _handleIndex | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_file-intent.js` | `server.js` _handleFileIntent | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_verify.js` | `server.js` _handleVerify | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_concept-file.js` | `server.js` _handleConceptFile | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_mvp-lock.js` | `server.js` _handleMvpLock | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_production-promote.js` | `server.js` _handleProductionPromote | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_gap-analysis.js` | `server.js` _handleGapAnalysis | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_prd-projects.js` | `server.js` _handlePrdProjects | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_bruno-call.js` | `server.js` _handleBrunoCall | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_oscar-house.js` | `server.js` _handleOscarHouse | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_needs-ai-review.js` | `server.js` _handleNeedsAIReview | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_mark-reviewed.js` | `server.js` _handleMarkReviewed | ❌ Missing |
| `src/0_core/0_server/0_routes/0_api/0_templates.js` | `server.js` _handleTemplates | ❌ Missing |

---

## Verdict

**The proposed architecture is a good design** — the layering (core → features → shared) is clean, the naming convention is consistent, and the feature-based organization makes sense for this codebase.

**However, the mapping is incomplete.** Six critical gaps would prevent the application from functioning after migration. The most significant is the `st8.html` inline code extraction — this is a ~900-line JavaScript application embedded in HTML that must be properly decomposed before the frontend can be modularized.

**Recommended approach:** Fix the 6 blockers, create the 17 missing skeleton files, then proceed with incremental migration starting from `0_shared/` → `0_core/` → `0_features/` → `0_frontend/`.

---

*Pressure test completed: 2026-05-14*
*Reviewer: Claude (gsd-code-reviewer)*
*Findings: 6 critical, 8 warnings*
