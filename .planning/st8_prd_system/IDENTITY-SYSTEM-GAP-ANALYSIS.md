# ST8 Identity System — Gap Analysis: Spec vs Implementation

**Date:** 2026-05-13
**Methodology:** Line-by-line comparison of PHASE-SPECS.md against all implementation files + runtime output verification
**Verdict:** Core pipeline works. Three critical bugs. Five incomplete features. Two naming inconsistencies.

---

## CRITICAL (Ship Blockers)

### C1. Recursive .txt Emission Loop — Runaway File Generation

**Evidence:** The `.planning/st8_identity_system/` directory contains nested filenames like:
```
LATEST_.planning_st8_identity_system_LATEST_.planning_st8_identity_system_LATEST_st8.sqlite-wal.txt.txt.txt.txt.txt
```
And in `.st8/schema-cards/`:
```
.planning_st8_identity_system_LATEST_st8.sqlite-wal.txt.json
.planning_st8_identity_system_LATEST_.planning_st8_identity_system_LATEST_st8.sqlite-wal.txt.txt.json
```

**Root Cause:** The indexer's `discoverFiles()` uses `IGNORE_DIRS = new Set(['node_modules', '.git', ...])` but does NOT ignore:
- `.archive/` — so pretext `.ts` files from the archive are indexed (62+ files)
- `.planning/` — so `.txt` files written by the printer get discovered on subsequent runs
- `st8.sqlite-wal` / `st8.sqlite-shm` — these get picked up somehow

When the printer writes `LATEST_st8.sqlite-wal.txt`, the next indexer run picks up that `.txt`... no wait, `.txt` isn't in CODE_EXTENSIONS. The deeper issue is that the DB already contains entries for these phantom files, and `emitAllCards()` emits cards for EVERYTHING in the DB, including entries that shouldn't exist. The printer then prints those cards, creating more DB entries...

**Fix Required:**
1. Add `.archive`, `.planning`, `vendor`, `snapshots` to `indexer.js` `IGNORE_DIRS`
2. Add a guard in `schemaCardPrinter.printCard()` — skip if filepath ends in `.txt`, `.json`, `.sqlite-wal`, `.sqlite-shm`
3. Delete the phantom entries from the DB (those with `.sqlite-wal` in their filepath)
4. Add `.st8` to `IGNORE_DIRS` in indexer.js (prevent re-indexing schema cards)

**Files:** `backend/indexer.js` (IGNORE_DIRS), `backend/schemaCardPrinter.js` (guard)

---

### C2. Schema Cards Lose AST Data on File Edit

**Evidence:** In `backend/index.js` line 281, when a file change is detected by the watcher:
```javascript
const card = emitter.emitCard(changedFile, { imports: [], exports: [] },
    { importedBy: [], imports: [] }, null, ...);
```

The AST parser is NOT called on the changed file. Instead, empty `{ imports: [], exports: [] }` is passed. This means every time a file is edited, its schema card loses ALL its export/import data. The next time `emitAllCards()` runs, the card has empty AST data, which propagates to the `.txt` fallback and any downstream consumers.

**Fix Required:** Run `extractImportsAndExports(fullPath)` on the changed file before emitting the card, same as `emitAllCards()` does.

**Files:** `backend/index.js` (change handler, ~line 281)

---

### C3. `.st8/` Not in `.gitignore`

**Evidence:** `.gitignore` currently contains `*.sqlite`, `*.sqlite-shm`, `*.sqlite-wal` but NOT `.st8/`. The spec (PHASE-SPECS.md line 1922) explicitly says:
```
# ST8 Identity System
.st8/
```

**Impact:** Schema card JSON files will be committed to git. They're generated artifacts and will cause noisy diffs.

**Fix Required:** Add `.st8/` to `.gitignore`

**Files:** `.gitignore`

---

## HIGH (Missing Spec Features)

### H1. Phase 6 API Endpoints — NOT Implemented

The spec defines 4 new HTTP endpoints. None exist in `server.js`:

| Endpoint | Method | Spec Location | Status |
|----------|--------|--------------|--------|
| `/api/concept-file` | POST | PHASE-SPECS.md line 1729 | NOT IMPLEMENTED |
| `/api/mvp-lock` | POST | PHASE-SPECS.md line 1804 | NOT IMPLEMENTED |
| `/api/prd` | GET | PHASE-SPECS.md line 1847 | NOT IMPLEMENTED |
| `/api/production-promote` | POST | PHASE-SPECS.md line 1853 | NOT IMPLEMENTED |

The backend persistence methods they depend on (`registerConceptFile`, `purgeDevelopmentData`) ARE implemented. Only the HTTP wiring is missing.

**Files:** `backend/server.js` (add 4 route cases + 4 handler methods)

---

### H2. Frontend SSE Integration — NOT Implemented

**Evidence:** No `EventSource` listener exists in `st8.html`, `void-engine.js`, or any frontend file. The spec (PHASE-SPECS.md lines 1889-1908) defines a complete SSE consumer.

**Impact:** The SSE endpoint at `/api/mutations` works (verified in server.js), but no frontend code consumes it. Mutations are invisible to the user.

**Files:** `st8.html` or `void-engine.js` (add EventSource listener + UI notification)

---

### H3. PRD Generation — NOT Implemented

**Evidence:** No `generate-prd.js` script exists. No `GET /api/prd` endpoint exists. The spec (PHASE-SPECS.md lines 1666-1715) defines a complete PRD generator that reads schema cards and produces a markdown PRD grouped by lifecycle phase.

**Impact:** The "PRD falls out of schema cards" promise from the spec is unfulfilled. Schema cards exist but cannot be composed into a PRD.

**Files:** New file `backend/prdGenerator.js` + route in `server.js`

---

### H4. Connections Not Populated in Schema Cards

**Evidence:** `schemaCardEmitter.js` line 124:
```javascript
// TODO: Add connection query when connections table uses camelCase
const connections = { importedBy: [], imports: [] };
```

The connections table IS now camelCase (the normalization was done), but the query was never implemented. Every schema card has empty connections.

**Fix Required:** Query the `connections` table and populate `importedBy`/`imports` arrays.

**Files:** `backend/schemaCardEmitter.js` (emitAllCards method)

---

### H5. Timestamped .txt Files Accumulate With No Cleanup

**Evidence:** The `.planning/st8_identity_system/` directory has ~300 timestamped `.txt` files from multiple emission runs, each ~4KB. No cleanup mechanism exists.

**Impact:** Disk space waste. The spec intended `LATEST_` files as the current state and timestamped files as the audit trail, but with no rotation or pruning, the directory grows unbounded.

**Fix Required:** Add a `pruneOldCards(maxPerFile)` method to `SchemaCardPrinter` that keeps only the N most recent timestamped files per file and deletes the rest. Call after each `printCard()`.

**Files:** `backend/schemaCardPrinter.js` (new method)

---

## MEDIUM (Inconsistencies & Quality Issues)

### M1. `st8_settings` Table Uses Snake_case (`updated_at`)

**Evidence:** `persistence.js` line 123 and `indexer.js` line 153:
```sql
updated_at TEXT DEFAULT CURRENT_TIMESTAMP
```

Every other column in the schema was normalized to camelCase, but `updated_at` was missed. Inconsistent.

**Fix:** Rename `updated_at` to `updatedAt` in both schema definitions + the `upsertSetting()` method.

**Files:** `backend/persistence.js`, `backend/indexer.js`

---

### M2. indexer.js ST8_SCHEMA Missing UNIQUE Constraint and st8_settings

**Evidence:** 
- `persistence.js` connections table has `UNIQUE(sourceFingerprint, targetFingerprint, connectionType)` — `indexer.js` does NOT
- `persistence.js` has `st8_settings` table — `indexer.js` does NOT

Both schemas MUST be identical per the spec (PHASE-SPECS.md line 616).

**Files:** `backend/indexer.js` (ST8_SCHEMA constant)

---

### M3. EXECUTION-PLAN.md References Old Fingerprint Format

**Evidence:** EXECUTION-PLAN.md line 12 still shows:
```
Fingerprint = {filepath}:{birthTimestamp}
```

But the implementation changed to `||` separator (st8-types.js line 188). The plan should reflect the current format.

**Files:** `.planning/st8_identity_system/EXECUTION-PLAN.md`

---

### M4. Duplicate `require('./manifestGenerator')` in index.js

**Evidence:** 
- Line 16: `const { writeManifests } = require('./manifestGenerator');` (top-level)
- Line 153: `const { writeManifests } = require('./manifestGenerator');` (inside main)
- Line 306: `const { writeManifests } = require('./manifestGenerator');` (inside watcher callback)

The top-level import is sufficient. The re-imports inside functions are unnecessary (Node.js caches requires).

**Files:** `backend/index.js` (remove lines 153 and 306)

---

### M5. `.archive/` Directory Indexed by Initial Scan

**Evidence:** 62+ schema cards exist for `.archive/Reference Files/pretext-main/` TypeScript files. These are reference files, not part of the st8 codebase. The fileWatcher ignores `.archive/`, but the indexer's `discoverFiles()` does not.

**Fix:** Add `'archive'`, `'.archive'`, `'.planning'`, `'vendor'`, `'snapshots'` to `IGNORE_DIRS` in `indexer.js`.

**Files:** `backend/indexer.js` (IGNORE_DIRS set)

---

## LOW (Nice-to-Have / Cosmetic)

### L1. CLI `--diff` Mode Still a Stub

**Evidence:** `schemaCardEmitter.js` line 183:
```javascript
console.log('[st8:emitter] Diff mode not yet available from CLI — use programmatically');
```

The `diff()` method works programmatically, but the CLI entry point doesn't use it.

### L2. `setIntent` → `upsertIntent` Naming Change

The spec called it `setIntent`, implementation uses `upsertIntent`. Consistent within the codebase, but diverges from spec. Server.js correctly calls `upsertIntent`, so no runtime issue.

### L3. No `st8.html` HTML File Extension in CODE_EXTENSIONS

The indexer indexes `.js`, `.ts`, `.vue` etc. but not `.html`. The `void-engine.html` and `st8.html` files won't get schema cards.

---

## Agent Review Cross-Reference

The agents ran code reviews + debugging on all 8 implementation files. Here's how their findings map to this gap analysis:

| Agent Finding | My Gap | Status |
|--------------|--------|--------|
| **st8-types CR**: `:` separator broken with ISO timestamps | — (they found and fixed before my review) | FIXED (`||` separator) |
| **persistence CR-01**: `connections` missing UNIQUE constraint | M2 (schema drift) | FIXED (in persistence.js, NOT in indexer.js) |
| **persistence CR-02**: `deleteFile()` doesn't clean `file_mutation_log` | — (I didn't catch this) | FIXED (`deleteMutationLogForFile` added) |
| **persistence CR-03**: `confidenceScore: 0` → `1.0` falsy bug | — (I didn't catch this) | FIXED (`??` operator) |
| **indexer CR**: async/sync mismatch in `buildGraph()` | — (I didn't catch this) | FIXED |
| **schemaCardEmitter CR**: await missing in CLI + field mapping | — (I didn't catch this) | FIXED |
| **notificationBus CR**: SSE error handling + emit exception | — (I didn't catch this) | FIXED |
| **server CR-01**: SSE CORS wildcard | — (I didn't catch this) | FIXED (allowedOrigin param) |
| **server CR-02**: Path traversal via `startsWith` | — (I didn't catch this) | FIXED (`path.relative()`) |
| **index WR-01**: Duplicate `notificationBus.publish()` on EDIT | C2 (partially related) | NOT FIXED |
| **index WR-03**: `MutationType`/`ActorType` imported but unused | — | NOT FIXED |
| **persistence WR-04**: `upsertIntent()` default mismatch | — | NOT FIXED |
| **persistence WR-06**: No transaction wrapping | — | NOT FIXED |
| **server WR-01/02**: No HTTP method validation | — | NOT FIXED |

**Agent-only findings I missed:** 3 critical bugs that were already fixed (persistence CR-02, CR-03, server CR-02). Excellent catches by the agents.

**My findings the agents missed:** The recursive .txt emission loop (C1), the `.archive/` directory being indexed (M5), the Phase 6 missing features (H1-H3), the `.st8/` gitignore omission (C3), and the .txt file accumulation (H5).

---

## Summary Scorecard

| Phase | Spec Status | Implementation Status | Gap |
|-------|------------|----------------------|-----|
| Phase 0: st8-types.js | COMPLETE | COMPLETE + Improved (`||` separator) | None |
| Phase 1: Schema Changes | COMPLETE | COMPLETE + 3 agent fixes | M1 (updated_at), M2 (schema drift in indexer.js) |
| Phase 2: New Modules | COMPLETE | COMPLETE + 2 agent fixes | H4 (connections TODO), H5 (cleanup) |
| Phase 3: Integration Wiring | COMPLETE | PARTIAL + 2 agent fixes | C2 (empty AST + dup publish), M4 (dup require), M5 (archive indexed) |
| Phase 4: Normalization | COMPLETE | COMPLETE | M1 (updated_at missed) |
| Phase 5: Bootstrap | COMPLETE | COMPLETE (runs, produces output) | C1 (recursive loop), C3 (.gitignore) |
| Phase 6: Advanced Features | COMPLETE | NOT STARTED | H1 (4 endpoints), H2 (SSE UI), H3 (PRD gen) |

**Total gaps: 3 Critical, 5 High, 5 Medium, 3 Low + 4 agent warnings not yet addressed**

---

## Recommended Action Order

### Wave 1: Stop the Bleeding (Critical bugs)
1. **C1** — Fix recursive emission loop (add `.archive`, `.planning`, `.st8` to IGNORE_DIRS; add guard in printer)
2. **C3** — Add `.st8/` to `.gitignore`
3. **C2** — Fix empty AST on file edit + remove duplicate `notificationBus.publish()`

### Wave 2: Schema & Data Integrity
4. **M5** — Add `.archive`, `.planning` to indexer IGNORE_DIRS (overlaps with C1)
5. **M2** — Sync indexer.js ST8_SCHEMA with persistence.js (UNIQUE constraint + st8_settings)
6. **H4** — Implement connections query in schema card emitter
7. **persistence WR-04** — Align `upsertIntent()` default with schema (`'INFERRED'` not `'USER'`)
8. **index WR-03** — Replace string literals with `MutationType`/`ActorType` constants
9. **M1** — Rename `updated_at` to `updatedAt` in both schema definitions

### Wave 3: Phase 6 Features
10. **H1** — Add Phase 6 API endpoints (`/api/concept-file`, `/api/mvp-lock`, `/api/prd`, `/api/production-promote`)
11. **H3** — Implement PRD generation (`backend/prdGenerator.js` + route)
12. **H5** — Add .txt file cleanup/rotation
13. **H2** — Frontend SSE integration (EventSource in st8.html)

### Wave 4: Hardening
14. **server WR-01/02** — Add HTTP method validation to `/api/index` and `/api/file-intent`
15. **persistence WR-06** — Add transaction wrapping for `deleteFile()` and `registerConceptFile()`
16. **server WR-07** — Add request body size limits
17. **server WR-03/04** — Fix persistence resource leaks on initialization failure
18. **Remaining low-priority items**
