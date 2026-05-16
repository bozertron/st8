# Research — `src/features/analysis/insight-store.js`

Cluster: `identity-and-analysis`
Tickets in scope: **T3** (reconcile insight-store persistence), **T5** (`/api/file-identity/<fingerprint>` bundle shape).
Mode: **read-only research**. No source edits, no commits.

---

## 1. Identity

- Path: `/home/user/st8/src/features/analysis/insight-store.js`
- Line count: **361 LOC** (`insight-store.js:1-361`).
- Provenance: **compiled-from-TypeScript**. Origin file is `src/commands/insightStore.ts` (per header comment, `insight-store.js:2`). Tell-tale markers: `__createBinding`, `__importStar`, `Object.defineProperty(exports, "__esModule", { value: true })`, and the trailing `//# sourceMappingURL=insightStore.js.map` footer (`insight-store.js:362`). This is the same upstream-vendored TS-emit pattern called out as "READ-ONLY in this repo" for `graph-persister.js` (`graph-persister.js:11-13`).
- Migrated by batch "analysis" (`scripts/migration/manifest-history.jsonl:6`) — `lib/commands/insightStore.js` → `src/features/analysis/insight-store.js`.
- Git history on the file itself: only **two** commits (`git log -- src/features/analysis/insight-store.js`):
  - `0bc7fe5 refactor(analysis): migrate gap-analyzer + intent-seeder + insight-store` (the move)
  - `4984892 feat(identity): wire insight-store as INDEX_COMPLETE subscriber + /api/insights (ticket 7)` (the wire-up did NOT modify this file; it added a sibling populator + a route in `app.js`)

The file itself has not been hand-edited since the import. The wire-up bolted on **around** it.

## 2. Stated intent

Sources of truth (read top-to-bottom):

1. The file's own header (`insight-store.js:2-4`):
   > `FileInsightSlot-based insight accumulation store. Each parse pass adds insights per file; queries allow retrieval by file, category, or recency.`
2. Cluster doc `docs/components/identity-and-analysis.md:227-241` (section 8, "Insight store (dormant)"):
   > "**Currently dormant.** Only `src/features/indexing/background-indexer.js` requires it (line 64), and background-indexer itself has no live consumers… The store table is created on first construction but no live code path calls `addInsight`."
   That section is **stale** relative to Wave 3B ticket 7 (`4984892`) — `insight-store-populator.js` is now a live caller via P=35 INDEX_COMPLETE.
3. Roadmap `docs/_pending-roadmap/identity-and-analysis.md` P1.2 (lines 22-26):
   > "Wire `insight-store.js` as INDEX_COMPLETE subscriber… Once populated, the constellation/file-explorer can finally answer 'why is this file RED' via a `GET /api/insights?filePath=<path>` lookup. The data layer exists — only the producer is missing."
   P1.2 is **marked done** by Wave 3B ticket 7 — see `identity-and-analysis.for-review.json:121` (`"DECISION: WIRE-UP. Roadmap P1.2 …"`).
4. Roadmap P1.3 (lines 30-44): T5 — `/api/file-identity/<fingerprint>` returns a bundle that includes `insights: [ /* once P1.2 lands */ ]`.
5. There is **no** `docs/Insight Store/` directory (verified by directory listing of `docs/`).

**Stated intent in one line:** persist a per-file, per-pass, per-category insight feed addressable by `(projectId, filePath)` so downstream UIs can answer "why is this file RED?". Snapshot semantics (not append-only) — `file_mutation_log` is the append-only history.

## 3. Public surface

Class `InsightStore` (`insight-store.js:48-349`). All methods operate on a single `better-sqlite3` handle owned by the instance.

| Method | Signature | Source line | Behaviour |
|---|---|---|---|
| `constructor(dbPath?)` | optional path | L49-55 | Falls back to `getSharedDatabasePath()`. Enables `journal_mode=WAL`, `busy_timeout=5000`. Calls `ensureTables()`. **Does NOT `mkdir` parent dir** (compare `DatabasePersister` constructor which does — `graph-persister.js:108-111`). |
| `ensureTables()` | private | L57-91 | `CREATE TABLE IF NOT EXISTS FileInsightSlots`, `InsightRecords`, 6 indexes. |
| `ensureFileSlot(projectId, filePath)` | → fileId | L97-104 | Idempotent; returns deterministic fileId from `sha256(projectId::filePath).slice(0,16)`. |
| `getFileSlot(projectId, filePath)` | → slot or null | L108-124 | Returns slot row + distinct categories. |
| `addInsight(insight)` | → insight w/ id+ts | L129-151 | Single-row insert + slot counter update in a transaction. |
| `addInsightsBatch(insights[])` | → count | L155-182 | Batched insert in one transaction. The hot-path writer. |
| `getInsightsForFile(projectId, filePath)` | → Insight[] | L187-191 | Ordered by `pass_number ASC, timestamp ASC`. |
| `getInsightsByCategory(category, projectId?, limit?)` | → Insight[] | L195-209 | |
| `getRecentInsights(projectId?, limit=50)` | → Insight[] | L213-224 | |
| `queryInsights({projectId, fileId, filePath, category, severity, minPassNumber, limit, offset})` | → Insight[] | L228-270 | Flexible AND-conditional query. |
| `getCategorySummary(projectId)` | → `{category: count}` | L274-281 | |
| `getFileSlots(projectId)` | → slot[] | L285-296 | Note: `categories: []` always empty here — divergence from `getFileSlot`'s shape. |
| `clearProject(projectId)` | side-effect | L301-307 | Delete both tables for a project. Called by populator on every pass (snapshot semantics). |
| `clearFile(projectId, filePath)` | side-effect | L311-318 | |
| `close()` | side-effect | L322-324 | |

Module factory `getInsightStore(dbPath?)` (`insight-store.js:356-361`) — process-wide singleton; first call wins on dbPath.

`Insight` row shape per `rowToInsight` (`insight-store.js:333-348`):
```js
{ insightId, projectId, fileId, filePath, passNumber, category, severity,
  description, evidence, relatedNodeIds: string[], context: object, timestamp }
```

## 4. Callers

Three (and only three) live callers in `src/`:

1. **`src/features/analysis/insight-store-populator.js:38,70,73,153`** — the producer.
   - `getInsightStore()` (no path, gets singleton on `scaffolder_data.sqlite`)
   - `store.clearProject(projectId)` → `store.ensureFileSlot(...)` per file → one `store.addInsightsBatch(insights)` call at the end.
   - Snapshot semantics: clears project first, so re-runs replace rather than append (matches `file_mutation_log` being the append-only twin — `insight-store-populator.js:27-30`).
2. **`src/core/hooks/default-subscribers.js:216-217`** — the trigger.
   - P=35 INDEX_COMPLETE subscriber. Sits between gap-analyzer (P=30) and intent-seeder (P=40).
   - Logs `[st8] Insight store: N insights across M files (errors=E, warnings=W, info=I)`.
3. **`src/core/server/app.js:1645-1671`** — the reader (`_handleInsights`).
   - `GET /api/insights?filepath=<p>` → `{ok, filepath, projectId, insights, count}`
   - `GET /api/insights` (no filter) → `{ok, projectId, categorySummary, recent, recentCount}`
   - Read-only; no auth gate (matches the GET-route pattern called out in `app.js:1693-1696`).

Dead/dormant callers:

- **`src/features/indexing/background-indexer.js:66,129,417,538`** — the vendored TS-origin caller. Per `docs/components/identity-and-analysis.md:239-241` background-indexer is dormant (blocked on Sonic restoration + missing `multiPassAnalyzer.js`, `precisionCapture.js`). Not on any live code path.

Test caller: **`tests/features/analysis/insight-store-populator.test.js`** uses `new InsightStore(dbPath)` with a temp-file path to avoid the global singleton (`insight-store-populator.test.js:29`).

## 5. Prior work

| Wave / ticket | Commit | What it touched | Status |
|---|---|---|---|
| Migration batch "analysis" | `0bc7fe5` | Moved `lib/commands/insightStore.js` → `src/features/analysis/insight-store.js`. No content change. | done |
| Wave 3B ticket 7 (P1.2) | `4984892` | Added `insight-store-populator.js`, registered P=35 INDEX_COMPLETE subscriber, added `GET /api/insights`. **Did not modify `insight-store.js`**. | done; verdict in `identity-and-analysis.for-review.json:115-133` (executor + reviewer confirmed live indexer log "304 insights across 305 files"). |
| Meta-dogfood probe | (no commit; doc-only) | `docs/_pending-tickets/meta-dogfood.md:15,40,121,165` | flagged residualConcern #2 HIGH: no `FileInsightSlots` table in st8.sqlite, "in-memory only", "Server restart loses insight history". |

**Note on the meta-dogfood claim:** the residualConcern says "in-memory only / lost on restart". That framing is **incorrect in detail but correct in spirit**:
- The InsightStore *is* a real SQLite-backed store. It just writes to a different file: `~/.local/share/com.scaffolder.app/scaffolder_data.sqlite` (Linux convention, per `graph-persister.js:93-106`). On this box the file exists at `/root/.local/share/com.scaffolder.app/scaffolder_data.sqlite` with `FileInsightSlots`=300 rows, `InsightRecords`=299 rows (verified live).
- **Spirit-correct** because: (a) st8.sqlite has no insights tables (verified — see Section 7), (b) the shared DB is **outside the project** so cross-project pollution is real (any st8 instance on the host writes to the *same* file under `projectId='st8'`), (c) `force-check FC3` / `pruneFilesNotIn` do not cover this DB (residualConcern #5 in `identity-and-analysis.for-review.json:130`).

T3's "insights are lost on server restart" framing is therefore **wrong as stated** — but the **broader contract violation** is real: the data lives in a shared maestro-side DB, not in st8's project-owned database. That is the actual T3 issue.

## 6. Existing tests

- **`tests/features/analysis/insight-store-populator.test.js`** (188 LOC) — 7 tests covering:
  - throw on missing persistence (L33-36)
  - RED+impactRadius=0 → error/orphan (L38-62)
  - YELLOW → warning/under-connected (L64-86)
  - GREEN+reach<0.3 → warning/under-imported (L88-109)
  - high impactRadius=25 → additive info/high-impact (L111-134)
  - idempotency: 3 runs → 1 row (L136-157, validates `clearProject` snapshot semantics)
  - multi-fingerprint dedup by newest birthTimestamp (L159-187)

All tests inject a **temp-file** `InsightStore` via `options.store` (`makeTempStore()`, L26-31) so they don't write to the global singleton's `scaffolder_data.sqlite`.

- **No dedicated tests for `insight-store.js` itself** — the public surface (queryInsights filters, getCategorySummary, clearFile, etc.) is tested only transitively via the populator.

- **`tests/core/hook-registry.test.js:387`** asserts the subscriber count (5→6 with insight-store added).

## 7. Contracts

### Which database?

**`scaffolder_data.sqlite`**, not `st8.sqlite`. Confirmed by:

- `insight-store.js:46,50`: imports and calls `getSharedDatabasePath()` from `../../core/database/graph-persister.js`.
- `graph-persister.js:93-106`: that function returns `~/.local/share/com.scaffolder.app/scaffolder_data.sqlite` on Linux.
- `graph-persister.js:84-92` documents this is **intentional** ("renaming would orphan existing on-disk insight data on every developer's machine") and that "InsightStore (compiled-from-TS, risky to edit) and the legacy integr8 pipeline write to scaffolder_data.sqlite at this path".
- `graph-persister.js:16-26` calls out the two-database split explicitly: `persistence.js` (st8.sqlite owner) "deliberately does NOT use the DatabasePersister class — the maestro-fallthrough was removed in ticket 6. The two databases are independent."

**Probe results (live, 2026-05-16):**

```
$ node -e "...sqlite_master..."  ./st8.sqlite
  → [ file_registry, connections, sqlite_sequence, file_intent,
      file_mutation_log, activity_log, st8_settings, prd_projects,
      ai_content, tickets, providers ]
  (no FileInsightSlots, no InsightRecords)

$ ls /root/.local/share/com.scaffolder.app/
  → scaffolder_data.sqlite  (exists)

$ node -e "...sqlite_master..."  scaffolder_data.sqlite
  → [ FileInsightSlots, InsightRecords ]
  FileInsightSlots rows: 300
  InsightRecords rows:   299
```

Meta-dogfood's claim that there's no FileInsightSlots in st8.sqlite is CORRECT. The "in-memory only / lost on restart" claim is INCORRECT — the data persists in `scaffolder_data.sqlite`. The real problem is **which DB**, not absence of persistence.

### Where the schema lives

- DDL: `insight-store.js:58-90` (`ensureTables` exec block) — `CREATE TABLE IF NOT EXISTS` for both tables, plus 6 indexes.
- Run on every `new InsightStore(...)` construction, including the singleton's first call.
- No `schema_version` table. No migration framework. No drift detector (compare `persistence.js` which has `EXPECTED_SCHEMA` + `introspectSchema()` per CLAUDE.md "Persistence invariants" section).
- The schema is **self-contained** in this file — no cross-file dependencies on column lists.

### Writer contract

From `insight-store-populator.js`:

- Input: `(persistence, { projectId, passNumber?, store? })`.
- Behaviour:
  1. mkdir parent of `getSharedDatabasePath()` best-effort (`insight-store-populator.js:57-65`) — workaround for `InsightStore` constructor not mkdir-ing.
  2. `store.clearProject(projectId)` — snapshot reset.
  3. Walk `persistence.getAllFiles()`, dedup by filepath (newest birthTimestamp wins, matches Wave 3A ticket 9 emitter contract).
  4. For each file, classify into 1+ category and push to `insights[]`.
  5. Single `store.addInsightsBatch(insights)` at the end.
- Output: `{ files, inserted, severityCounts: {error, warning, info}, projectId }`.

### Read contract (`GET /api/insights`)

- With `?filepath=<p>`: returns `{ok, filepath, projectId, insights, count}` where `insights` are the raw `Insight` rows for that file (descending `pass_number`-then-`timestamp`).
- Without filter: returns `{ok, projectId, categorySummary, recent, recentCount}` (50 most-recent across project).
- No auth (GET-only, by design).

## 8. Change vector

### T3 — Reconcile persistence path

The user's ticket framing presents two options. Both are viable; I outline each with concrete file changes. **I have a recommendation at the end.**

#### Option A — Move insights into `st8.sqlite`

Goal: `FileInsightSlots` + `InsightRecords` live as proper tables alongside `file_registry`. "Insights survive reboot" becomes a checkable invariant against the project's own database, covered by force-checks.

Concrete changes:

1. **`src/features/analysis/insight-store-populator.js`** (the safe place to change; populator is hand-written, not vendored TS).
   - Replace `getInsightStore()` call (L70) with construction against st8's persistence handle.
   - Two sub-options here:
     - **A1 — instantiate `new InsightStore(persistence.dbPath)`**: pass the st8.sqlite path. InsightStore happily creates its 2 tables in st8.sqlite via `ensureTables`. Bare-minimum change, but couples a compiled-from-TS file (`insight-store.js`) to st8.sqlite, and InsightStore opens a **second** better-sqlite3 handle on the same file — works but ugly.
     - **A2 — write insights via `persistence` directly**: extend `persistence.js` with `upsertFileInsightSlot`, `insertInsightRecord`, `clearInsightsForProject`, `getInsightsForFile`, `getCategorySummary`, `getRecentInsights`. Move the DDL into `EXPECTED_SCHEMA` so `introspectSchema()` covers it. Keep `insight-store.js` for the legacy background-indexer caller (dormant anyway), but rewire `insight-store-populator.js` and `app.js` to use `persistence`. This is the **correct** wave-1-style approach.
2. **`src/core/database/persistence.js`** (A2 only)
   - Add `FileInsightSlots` + `InsightRecords` to `EXPECTED_SCHEMA` (per CLAUDE.md "Persistence invariants" — drift detector should cover them).
   - Add 6 methods named above. Wrap multi-row writes in a transaction.
   - Add foreign-key cascade hook so `pruneFilesNotIn` / `deleteFile` cascade insights as they currently do mutation-log rows (per-fingerprint cascade — see CLAUDE.md).
3. **`src/core/server/app.js:1645-1671`** (A2 only)
   - Replace the `require('../../features/analysis/insight-store')` import with `persistence.queryInsights({...})`-style calls via the shared persistence singleton.
4. **`src/features/analysis/insight-store-populator.js`** (A2)
   - Drop the `getInsightStore`/`getSharedDatabasePath` imports. Use `persistence` directly. Drop the mkdir workaround.
5. **`docs/components/identity-and-analysis.md:227-241`** — remove the "dormant" framing; update with "writes to st8.sqlite via persistence."
6. **`docs/_pending-tickets/meta-dogfood.md:15,40,121,165`** — strikethrough residualConcern #2 with a "resolved in <wave>" annotation.
7. **Tests:**
   - Update `tests/features/analysis/insight-store-populator.test.js` — temp `InsightStore` injection still works; or switch to temp `persistence` (`new SqlitePersistence(tmpPath)`).
   - Add a `tests/core/database/persistence.insights.test.js` covering the new persistence methods + cascade behaviour.
8. **One-time migration** (A2): if existing developer machines have data in `scaffolder_data.sqlite`, decide: discard (snapshot semantics rebuild on next index) OR write a 30-LOC one-shot migrator that ATTACHes the old DB and SELECTs into st8.sqlite. **Snapshot semantics + once-per-index regeneration means discard is fine** (next INDEX_COMPLETE re-derives everything). Add a one-time DROP TABLE on the legacy DB to keep it from drifting silently.

Pros (A2):
- Insights covered by `introspectSchema()` drift detector.
- Insights covered by FK cascade (`pruneFilesNotIn`, `deleteFile`) — no orphan insight rows.
- Insights covered by single-DB backup/restore semantics.
- T5's `/api/file-identity/<fingerprint>` bundle becomes a **single-DB query** (one connection, one transaction).
- Kills the cross-project pollution risk (every st8 host uses one shared `scaffolder_data.sqlite` keyed only on `projectId='st8'` — two repos with the same name silently merge data).
- Removes a load-bearing dependency on a compiled-from-TS file in a hot path.

Cons (A2):
- Adds ~150 LOC to `persistence.js` (already 1100+ LOC).
- `insight-store.js` becomes a dead module (only `background-indexer.js` references it, also dead). Could be deleted in a follow-up.
- `getSharedDatabasePath()` survives as a graph-persister-only helper. Acceptable.

#### Option B — Delete the schema, declare in-memory-only

Goal: rip `FileInsightSlots`/`InsightRecords` out, replace with an in-process JS Map populated each INDEX_COMPLETE, re-derived on every boot.

Concrete changes:

1. **`src/features/analysis/insight-store.js`** — DELETE the file (or replace with a 30-LOC JS-Map shim that keeps the same API surface).
2. **`src/features/analysis/insight-store-populator.js`** — rewrite to write to the shim instead of SQLite.
3. **`src/core/server/app.js:1645-1671`** — `_handleInsights` reads from the shim.
4. **`src/features/indexing/background-indexer.js:66,129,417,538`** — fix or remove the reference (it's currently dead but still imports the file).
5. **Tests:** rewrite populator tests to assert against the shim.
6. **`docs/components/identity-and-analysis.md:227-241`** — section 8 collapses to a short "insights are derived per-index-pass, kept in process memory" paragraph.
7. **Documentation/contract change:** CLAUDE.md "Persistence invariants" wording must reflect that insights are explicitly NON-persistent.

Pros (B):
- Smallest diff. ~5 file deletions + populator rewrite.
- No schema-drift surface.
- Honest about what was actually happening per the meta-dogfood framing.

Cons (B):
- T5's `/api/file-identity/<fingerprint>` bundle has to either skip `insights` on the first boot before any indexer pass, or trigger an indexer pass on-demand (vio­lates "single read-path" intent).
- Insight history (per-pass `passNumber` ordering) is lost — every reboot resets to "current pass only", whereas the existing SQLite schema has `pass_number` and `timestamp` columns specifically to allow trend analysis across passes (`insight-store.js:71-72`). The data layer was designed for history; B throws that away.
- The dive-in panel's "why is this RED" view will work fine, but anything wanting "show me the history of insights for this file" is impossible (it's possible today, just not surfaced).

#### Recommendation

**Option A2** (move into st8.sqlite via persistence.js). Reasons:

- The roadmap's P1.2 wording ("data layer exists — only the producer is missing") and T5's bundle contract ("`insights: [...]` once P1.2 lands") both assume **a real data layer**. B retrocedes from "data layer" to "ephemeral cache" — a bigger contract change than wave scope.
- A2 unifies persistence under the introspection / drift / cascade invariants that st8.sqlite already enforces (CLAUDE.md "Persistence invariants" section). B leaves a class of data outside those invariants forever.
- The cross-project pollution risk in `scaffolder_data.sqlite` is real (verified: 300 slots in `/root/.local/share/...` keyed only on `projectId='st8'`). A2 eliminates it; B sidesteps it by removing persistence; A1 doesn't help.
- The compiled-from-TS file becomes dead code, easy to delete in a follow-up.

### T5 — `/api/file-identity/<fingerprint>` read-shape from this file

Per roadmap P1.3 (`identity-and-analysis.md:34-41`), the bundle includes `insights: [ /* once P1.2 lands */ ]`.

The natural shape, derived from `getInsightsForFile(projectId, filePath)` (or its persistence-method equivalent post-A2):

```jsonc
{
  "fingerprint": "<filepath>||<ISO-birthTimestamp>",
  "insights": [
    {
      "insightId": "<uuid>",
      "passNumber": 1234,
      "category": "orphan" | "red-status" | "under-connected" | "under-imported" | "high-impact",
      "severity": "error" | "warning" | "info",
      "description": "<human-readable>",
      "evidence": "status=RED, reachabilityScore=0, impactRadius=0",
      "relatedNodeIds": [],
      "context": { "fingerprint": "...", "sha256Hash": "..." },
      "timestamp": "<ISO>"
    },
    /* ordered by pass_number ASC, timestamp ASC — matches getInsightsForFile */
  ]
}
```

**Important constraint for T5:** the existing `Insight` row is keyed by `(projectId, filePath)`, NOT by `fingerprint`. The `context` JSON column happens to carry `fingerprint` + `sha256Hash` (set in `insight-store-populator.js:105`) — but it's a free-form JSON blob, not a structured index. Two consequences:

1. If T5 wants to look up insights *by fingerprint*, it must either:
   - **(a)** translate fingerprint → filepath first via `persistence.getFileByFingerprint`, then call `getInsightsForFile(projectId, filepath)`. Simple, two-query.
   - **(b)** add a `fingerprint` column to `InsightRecords` and index it. Cleaner long-term; aligns with the "fingerprint is the roll-call ID" framing (cluster doc §1, lines 13-25). Requires the populator to write it (it has `file.fingerprint` already — `insight-store-populator.js:105`). **Recommended as part of A2 since you're touching the schema anyway.**
2. The `filePath` in `InsightRecords` is the current path. If a file is renamed mid-session and the indexer re-runs, the old path's insights are cleared by `clearProject` and the new path gets fresh ones — fine for snapshot semantics, but T5 should document that **historical insights for prior fingerprints/paths are not retained** (matches the "snapshot, not append" contract — `insight-store-populator.js:27-30`).

**T5 write-side:** none. T5 is read-only.

## 9. Provisions already made

- **`getSharedDatabasePath()`** (`graph-persister.js:93-106`) — already documented as the InsightStore's path source, with provenance + rename caveats in the file header. T3 can leave it alone (Option A2) since only `insight-store.js` + the dormant `graph-persister.js` callers use it.
- **`insight-store-populator.js` lifecycle hooks** — already P=35 INDEX_COMPLETE, already snapshot-resets via `clearProject`, already wrapped in try/catch in `default-subscribers.js:214-224`. T3 can swap the storage backend without touching subscription wiring.
- **The populator already carries `fingerprint` in `context`** (`insight-store-populator.js:105`) — promoting it to a top-level column is a 1-line populator change + 1-line schema change.
- **Test fixtures already inject a temp store via `options.store`** (`insight-store-populator.test.js:26-31`) — Option A2's "use persistence instead" can mirror that injection pattern with a `options.persistence` override, keeping the test surface stable.
- **`/api/insights` already returns the canonical `Insight` shape** — T5's bundle is a straight `bundle.insights = insights` assignment after fetching them via persistence.
- **Schema-card emitter dedup contract** (newest birthTimestamp wins, `insight-store-populator.js:79-86`) already matches the Wave 3A ticket 9 emitter convention — same dedup rule applies for the bundle.

## 10. Gaps and open questions

1. **Should T3 also delete the dormant `insight-store.js`?** Option A2 leaves it as unused code (only `background-indexer.js` requires it, also dormant). Either delete both as a follow-up sub-ticket or annotate `insight-store.js` with a "RETIRED — use persistence.js methods" header.

2. **Cross-project pollution in `scaffolder_data.sqlite` — what to do with existing data?** Post-A2, the shared DB still has 300 stale `FileInsightSlots` rows on every dev machine. Options: (a) leave it (harmless, gets re-overwritten if someone runs background-indexer), (b) one-time delete on st8 boot, (c) ignore — the file is in maestro's domain.

3. **Should `InsightRecords` get a `fingerprint` column?** Option A2 + T5 are both clean if it does. The populator already has the data. Cost: one column + one index + one populator write. Benefit: T5's lookup becomes a single `WHERE fingerprint=?` query instead of fingerprint→filepath→query. **Recommended.**

4. **Is `passNumber = Date.now()` (`insight-store-populator.js:49`) the right choice?** It's monotonic-ish across passes within a process, but two processes started at the same ms get colliding pass numbers. Probably fine for an MVP, but T3 reviewer may flag this. Alternative: monotonic counter in `st8_settings` (`insightStore.nextPassNumber`).

5. **`docs/components/identity-and-analysis.md:227-241` (section 8 "Insight store (dormant)") is stale.** It still describes the file as dormant. Wave 3B ticket 7 wired it up. Should be updated in this wave or flagged for a follow-up doc-sync ticket.

6. **The meta-dogfood claim "in-memory only / lost on restart" is wrong-but-spirit-right.** Should the T3 fix include amending `docs/_pending-tickets/meta-dogfood.md:15,40,165` with a strikethrough + correction, or leave it as-is until the meta-dogfood wave runs again? (Suggest: amend, since residualConcern HIGH attracts attention.)

7. **Threshold constants** (`reach < 0.3`, `impactRadius >= 10`) live in `insight-store-populator.js:132,142`. `identity-and-analysis.for-review.json:130` residualConcern #3 already flagged this for a settings-and-providers wave. Not T3 scope; mention only.

8. **Multi-project insights** — `clearProject(projectId)` is per-project. The current hard-coded `projectId='st8'` (`insight-store-populator.js:48`) is fine for single-project mode but means every host's st8 instances merge into the same project namespace in `scaffolder_data.sqlite`. A2 moves the data into the project's own st8.sqlite, sidestepping this. Not a blocker for A2; **is** a load-bearing reason to prefer A2 over A1 or B.
