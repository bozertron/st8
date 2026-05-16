# Research — `src/features/analysis/insight-store-populator.js`

**Cluster:** identity-and-analysis
**Ticket in scope:** T3 — Reconcile insight-store persistence
**Mode:** read-only

---

## 1. Identity

- Path: `/home/user/st8/src/features/analysis/insight-store-populator.js`
- LOC: 166 lines, `'use strict'` CommonJS module (`src/features/analysis/insight-store-populator.js:1-166`).
- Single git commit in history: `4984892 feat(identity): wire insight-store as INDEX_COMPLETE subscriber + /api/insights (ticket 7)` — Wave 3B landing.
- Module exports exactly one function: `populateInsightsFromRegistry` (`src/features/analysis/insight-store-populator.js:163-165`).

## 2. Stated intent

Header docstring at lines 3-34: "Walks file_registry after each indexer pass and writes per-file insights to the InsightRecords table." Implements roadmap P1.2 ("Wire insight-store.js as INDEX_COMPLETE subscriber"; `docs/_pending-roadmap/identity-and-analysis.md:22-26`). Documents five insight categories, snapshot (not append) semantics via `clearProject()`, idempotency, and a return shape of `{ files, inserted, severityCounts, projectId }`.

## 3. Public surface

`populateInsightsFromRegistry(persistence, options = {})` — `src/features/analysis/insight-store-populator.js:43`.

- Required: `persistence.getAllFiles()` (TypeError otherwise, line 44-46).
- Options: `projectId` (default `'st8'`, line 48), `passNumber` (default `Date.now()`, line 49), `store` (injectable for tests, line 57).
- Side effects:
  - `fs.mkdirSync(path.dirname(getSharedDatabasePath()), { recursive: true })` on the maestro shared data dir (lines 57-65), best-effort.
  - `store.clearProject(projectId)` (line 73) — wipes prior insights for that project.
  - `store.ensureFileSlot(...)` per file (line 96).
  - `store.addInsightsBatch(insights)` (line 153).
- Return: `{ files, inserted, severityCounts, projectId }` (lines 155-160).

## 4. Callers

**Single live caller** in `src/`:

- `src/core/hooks/default-subscribers.js:214-224` — registered as `HOOKS.INDEX_COMPLETE` subscriber at `priority: 35, source: 'insight-store-populator'`. Wrapped in try/catch with `[st8] Insight store population failed: ...` log; success log line is `[st8] Insight store: <inserted> insights across <files> files (errors=N, warnings=N, info=N)` (line 218-220). **The P=35 documented in CLAUDE.md matches the code exactly.**

Notes on ordering relative to the rest of the INDEX_COMPLETE chain (`src/core/hooks/default-subscribers.js`):

- P=10 manifest-generator (142-150)
- P=20 schema-card-emitter (154-162)
- P=30 gap-analyzer (166-177)
- **P=35 insight-store-populator (214-224)**
- P=40 intent-seeder (181-191)
- P=50 mutation-log-retention (243-266)

Despite the docstring at default-subscribers.js:193 claiming "after intent-seeding has run", the insight populator (P=35) actually runs **before** intent-seeder (P=40). Stale block comment; not a bug. Insights depend on `status`/`reachabilityScore`/`impactRadius` from the indexer's graph build, not on intent.

Tests: `tests/features/analysis/insight-store-populator.test.js` (187 lines, 7 probes covering: missing-persistence throw, RED-orphan, YELLOW-under-connected, GREEN-thin, high-impact additive, idempotency, multi-fingerprint dedup). Hook count assertion in `tests/core/hook-registry.test.js:387` mentions insight-store-populator as part of the 5→6 INDEX_COMPLETE subscriber count.

## 5. Prior work

The full T7 wire-up rationale is recorded verbatim in `docs/_pending-tickets/identity-and-analysis.for-review.json` (Wave 3B ticket 7, `actionsTaken`). Wave 3B reviewer audit in `docs/_pending-tickets/identity-and-analysis.review.md:113-241` explicitly verified live: "[st8] Insight store: 304 insights across 305 files (errors=237, warnings=67, info=0)" matched a curl of `/api/insights`. Wave 3B residualConcern #5 (json line) and reviewer cross-cluster flag #1 (review.md:206-209) **already flag** that insights persist in `scaffolder_data.sqlite`, NOT `st8.sqlite`, with retention-policy as a deferred cross-cluster concern.

## 6. Existing tests

`/home/user/st8/tests/features/analysis/insight-store-populator.test.js` — 7 tests, all passing as part of the 207/207 suite:

- Line 33 — throws on missing persistence
- Line 38 — RED + impactRadius=0 → orphan/error
- Line 64 — YELLOW → under-connected/warning
- Line 88 — GREEN reach<0.3 → under-imported/warning
- Line 111 — impactRadius ≥ 10 → additive high-impact/info
- Line 136 — idempotency (3 runs → 1 row)
- Line 159 — multi-fingerprint dedup (newest birthTimestamp wins)

Tests use the `options.store` injection (line 70 of the SUT) to swap in a temp-DB-backed `InsightStore` per test — so they exercise the **real** SQLite writer, just against a temp path, not the production `scaffolder_data.sqlite`.

## 7. Contracts (WHEN/WHAT/WHERE — definitively, with evidence)

### WHEN it fires

After every `INDEX_COMPLETE` hook execution, at priority 35. INDEX_COMPLETE fires once per indexer pass from `src/core/server/main.js` after Pass-1 upsert + Pass-2 wiring.

### WHAT it walks

`persistence.getAllFiles()` (line 75) — every row of `file_registry` in `st8.sqlite`. Multi-fingerprint dedup by newest `birthTimestamp` (lines 79-86) matches Wave 3A ticket 9 schema-card emitter contract.

### WHERE it writes — DEFINITIVE EVIDENCE

**Probe (just executed, read-only better-sqlite3):**

```
st8.sqlite tables:
  activity_log, ai_content, connections, file_intent,
  file_mutation_log, file_registry, prd_projects, providers,
  sqlite_sequence, st8_settings, tickets
  (NO insights / InsightRecords / FileInsightSlots)

/root/.local/share/com.scaffolder.app/scaffolder_data.sqlite tables:
  FileInsightSlots (300 rows), InsightRecords (299 rows)

Sample InsightRecords:
  { project_id: 'st8', file_path: '.claude/settings.local.json',
    category: 'orphan', severity: 'error' }
  { project_id: 'st8', file_path: 'CLAUDE.md',
    category: 'orphan', severity: 'error' }
  { project_id: 'st8', file_path: 'Louis/DELIVERY_SUMMARY.md',
    category: 'orphan', severity: 'error' }
```

The 299 InsightRecords / 300 FileInsightSlots **exactly matches** the boot log `[st8] Insight store: 299 insights across 300 files`. **Insights ARE persisted to disk.** The meta-dogfood claim "insights are not persisted / in-memory only" (`docs/_pending-tickets/meta-dogfood.md:15` and `:121`) is **factually wrong** — meta-dogfood looked at the wrong database. The shared file at `/root/.local/share/com.scaffolder.app/scaffolder_data.sqlite` survives `rm -rf /home/user/st8/.st8`. They survive reboot.

### Trace through the code

1. `populator` line 39: `const { getSharedDatabasePath } = require('../../core/database/graph-persister');`
2. `graph-persister.js:93-106` (`getSharedDatabasePath`): returns `~/.local/share/com.scaffolder.app/scaffolder_data.sqlite` on Linux.
3. `populator` line 70: `const store = options.store || insightStoreModule.getInsightStore();`
4. `insight-store.js:356-361` (`getInsightStore` singleton): `new InsightStore(dbPath)` with dbPath defaulted by…
5. `insight-store.js:49-55` (`InsightStore` constructor): `const resolvedPath = dbPath || getSharedDatabasePath(); this.db = new better_sqlite3_1.default(resolvedPath);`. Opens **the real on-disk shared SQLite file**, sets `journal_mode = WAL`, `busy_timeout = 5000`, runs `ensureTables()` (creates `FileInsightSlots` + `InsightRecords` + 6 indexes if missing).
6. `populator` line 73: `store.clearProject(projectId)` (insight-store.js:301-307 — `DELETE FROM InsightRecords WHERE project_id = ?` + same for FileInsightSlots, both in a SQLite transaction).
7. `populator` line 153: `store.addInsightsBatch(insights)` (insight-store.js:155-182 — INSERTs in a transaction).

### Why meta-dogfood missed it

Meta-dogfood line 106: "SQLite (`/home/user/st8/st8.sqlite`, 2.8 MB)" — only inspected `st8.sqlite`. The InsightStore writes to a **different file** (`scaffolder_data.sqlite`) in a **different directory** (`~/.local/share/com.scaffolder.app/`). The compiled-from-TS `InsightStore` deliberately uses `getSharedDatabasePath()` and not the st8 persistence layer; this is a documented architectural seam (`src/core/database/graph-persister.js:18-23`, `src/features/analysis/insight-store.js:46`).

## 8. Change vector for T3

T3 framing: "make insights survive reboot." Per the probe above, **they already do.** The actual T3 question reduces to: do we want insights in `st8.sqlite` (st8-local, project-scoped, joinable with `file_registry`) or in `scaffolder_data.sqlite` (shared with maestro-scaffolder tooling, cross-tool)?

### Option A — Re-route insights into `st8.sqlite`

**Why:** force-check FC3 (file_registry coverage) doesn't see InsightRecords today; multi-tool reuse of the shared DB risks one tool clobbering another's project rows; FK to `file_registry` via fingerprint becomes possible; `rm /home/user/st8/st8.sqlite` would reset insights along with everything else (clean test-tree semantics).

**Concrete edits required:**

1. **`src/features/analysis/insight-store.js`** is compiled-from-TS (`linguist-generated=true`, header lines 2-34) — **do not hand-edit**. Two acceptable workarounds:
   - (a) Add a thin **wrapper module** `src/features/analysis/insight-store-st8.js` that exposes the same surface (`ensureFileSlot`, `addInsightsBatch`, `clearProject`, `getInsightsForFile`, `getCategorySummary`, `getRecentInsights`) but writes to `st8.sqlite` using the existing `St8Persistence` connection. Tables `insights` + `file_insight_slots` get added to the `EXPECTED_SCHEMA` in `src/core/database/persistence.js` (drift detector hard-fails on missing tables).
   - (b) Pass an explicit `dbPath` into `getInsightStore()` pointing at `path.join(targetDir, '.st8', 'insights.sqlite')` — keeps the maestro code untouched but puts the file under `.st8/` so it tracks with the project.
2. **`src/features/analysis/insight-store-populator.js`** line 70 — swap the `getInsightStore()` call for the wrapper (option a) or pass `dbPath` (option b). The `getSharedDatabasePath()` mkdir block (lines 57-65) becomes dead and should be removed.
3. **`src/core/server/app.js`** `_handleInsights` (line 1645, with `getInsightStore` import at line 1653) — same swap.
4. **`src/core/hooks/default-subscribers.js`** line 214-224 — **no priority change required**. P=35 is correct and consistent with CLAUDE.md.
5. **Tests** — `tests/features/analysis/insight-store-populator.test.js` injects `options.store` so it's unaffected. New tests required for the wrapper module if option (a).
6. **Schema** — add CREATE TABLE statements to `src/core/database/persistence.js` (current schema lives there alongside file_registry etc.). Add to `EXPECTED_SCHEMA` and `introspectSchema()` drift detector (CLAUDE.md persistence invariants).
7. **Migration:** one-shot script to copy existing rows from `scaffolder_data.sqlite` → `st8.sqlite` on first boot post-change. Or accept loss (insights are derived state, regenerated next pass).

### Option B — Declare the cross-tool shared-DB contract intentional

**Why:** Insights ARE already persisted (probe confirmed); the only real bug is documentation drift (CLAUDE.md, meta-dogfood). InsightStore is compiled-from-TS upstream — leaving it untouched keeps the re-vendor path clean.

**Concrete edits required:**

1. **`CLAUDE.md`** persistence-invariants section — add a bullet documenting that `insight-store` writes to `~/.local/share/com.scaffolder.app/scaffolder_data.sqlite`, surviving st8 reboots but shared with other maestro-scaffolder tools.
2. **`docs/_pending-tickets/meta-dogfood.md`** lines 15, 121, 165 — correct the "in-memory only" claim and the "Insights not persisted" residualConcern. Insights ARE persisted, just to a different file.
3. **`src/features/analysis/insight-store-populator.js`** — header (lines 3-34) already correctly says "writes per-file insights to the InsightRecords table." Add a one-line note that the table lives in `scaffolder_data.sqlite`, not `st8.sqlite`.
4. **No code-behavior change.** P=35 stays. Tests stay.
5. (Optional) Add a `/api/insights/source` debug endpoint that returns the resolved `getSharedDatabasePath()` so future dogfood probes can find it without source diving.

### Recommendation

Option B is the honest minimum: the data **already** survives reboot. Option A is cleaner architectural alignment but means hand-rolling a wrapper around a compiled-from-TS file (the populator already had to do an mkdir workaround for InsightStore not creating its parent — lines 57-65). The Wave 3B reviewer cross-cluster flag #1 (review.md:206-209) suggests Option A is a "persistence-and-database P3 ticket" not an in-cluster fix.

If the founder reads T3 as "stop sharing a DB with other tools," that's Option A and it's a 2-3 hour change. If the founder reads T3 as "make sure the data exists across boots," that's already true — Option B is a docs-only ticket.

## 9. Provisions already made

- **mkdir workaround for InsightStore (`src/features/analysis/insight-store-populator.js:57-65`)** — `InsightStore` constructor (insight-store.js:49-55) does NOT mkdir its parent dir (unlike `DatabasePersister` at graph-persister.js:111). Populator best-effort-mkdir's the shared dir so first-boot doesn't throw "directory does not exist".
- **Options injection (`src/features/analysis/insight-store-populator.js:70`)** — `options.store` lets tests and future re-routers swap the writer without monkey-patching.
- **Late binding via `insightStoreModule.getInsightStore()`** (line 70 comment) — keeps the test override possible.
- **Snapshot semantics** — `clearProject(projectId)` at line 73 means re-runs replace, never duplicate. Aligned with "file_mutation_log is the append-only log; insights mirror current state" (header line 27-30).
- **Multi-fingerprint dedup (lines 79-86)** — newest birthTimestamp wins, matches Wave 3A ticket 9 emitter contract.
- **5-category classifier (lines 91-150)** — orphan / red-status / under-connected / under-imported / high-impact (additive); thresholds reachability<0.3 and impactRadius≥10 are hardcoded.
- **Per-file `evidence` string** (line 103) — `status=X, reachabilityScore=Y, impactRadius=Z` — human-readable, surfaces in `/api/insights` per-file response.
- **`context` carries fingerprint + sha256Hash** (line 105) — provides identity-anchor so consumers can join back to `file_registry`.
- **Wave 3B residualConcerns #1-5** (json file) document: Wave 7 frontend consumer pending, hardcoded `projectId='st8'`, heuristic thresholds (0.3, 10) should move to `st8_settings`, InsightStore-parent-mkdir is a workaround, and the scaffolder_data.sqlite location is a known cross-cluster concern.

## 10. Gaps + open questions

1. **T3 scope ambiguity** — "make insights survive reboot" is technically already satisfied. Is the real requirement (a) survival, (b) move out of the shared DB, or (c) just fix the docs that claim they don't survive? Determines Option A vs Option B above. Recommend resolving with the founder before code edits.

2. **No tests against the production database path** — all 7 existing tests inject `options.store` with a temp DB. The boot-time path through `getInsightStore()` → `getSharedDatabasePath()` has zero test coverage. A `/api/insights/source` debug probe (Option B step 5) or an integration test that asserts insights persist across two `populateInsightsFromRegistry()` calls in **separate processes** would close this gap.

3. **Heuristic threshold values (`< 0.3`, `>= 10`)** are hardcoded at lines 132 and 142. Wave 3B residualConcern #3 already flagged moving these to `st8_settings('insightStore')`. Open whether T3 absorbs that or kicks to its own ticket.

4. **Stale block comment** at `src/core/hooks/default-subscribers.js:193` says "Walks the file_registry after intent-seeding has run" but P=35 < P=40, so the populator runs **before** intent-seeder. Worth a one-line comment fix.

5. **Hardcoded `projectId='st8'`** (populator line 48, default-subscribers.js:217) means the InsightStore's project_id column is permanently `'st8'` for st8-instance writes. If another tool ever writes to scaffolder_data.sqlite with the same project_id, `clearProject('st8')` will wipe rows owned by that tool. This is the contamination risk that Option A eliminates.

6. **No FK to `file_registry`** — `InsightRecords` carries `file_path` + `context.fingerprint` but no DB-level integrity constraint to the st8.sqlite `file_registry` table (they're in different DB files; impossible to enforce). Insights for stale fingerprints can accumulate if `clearProject()` isn't called, but the snapshot semantics make that fine in practice.

7. **`/api/insights` endpoint surface** is correctly listed in CLAUDE.md ("Wave 3C consumer"), and meta-dogfood confirmed it works (HTTP 200, real envelope). No gap there — the gap is only in the meta-dogfood DB-location inference.
