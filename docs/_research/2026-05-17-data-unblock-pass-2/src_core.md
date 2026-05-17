# src/core — Data-Unblock Pass 2 Research

**Scope:** `/home/user/st8/src/core` (hooks, database, server).
**Date:** 2026-05-17.
**Mode:** Read-only audit through the four-recipe lens of batch 031
(canonical-category producer / accurate resolver / persistence-derived
analyzer / clear-then-rebuild). Anchors at hook publishers,
HTTP-route surface, persistence schema drift, and unblockable
gates.

---

## 1. File inventory (sub-dirs)

| Path | LOC | Role |
|---|--:|---|
| `core/hook-registry.js` | 274 | `HookRegistry` class + canonical `HOOKS` constants; singleton export; `listHooks` / `listAllHooks` / `introspectExecuteOrder`; zero-subscriber fast path. |
| `core/notification-bus.js` | 174 | SSE bus + `setPrinter()` fallback (activated Wave 4C). |
| `core/database/persistence.js` | 1611 | `St8Persistence` class. **One of the two `ST8_SCHEMA` declarations.** `EXPECTED_SCHEMA` + `introspectSchema()` boot-time drift detector. `PRAGMA foreign_keys = ON`. Per-fingerprint cascade. `clearAllConnections()`. Provider seeder. |
| `core/database/graph-persister.js` | 268 | Vendored maestro `DatabasePersister`; READ-ONLY (`.gitattributes linguist-generated=true`). Used by `insight-store.js` for `getSharedDatabasePath()` → `scaffolder_data.sqlite` (NOT `st8.sqlite`). |
| `core/hooks/default-subscribers.js` | 449 | Wires 11 subscribers: INDEX_START (P=10 sonic, P=20 bruno) + **INDEX_COMPLETE × 7** (P=10 manifest, P=20 cards, P=30 gap, P=35 insight-store-populator, P=37 cycle-insight-emitter, P=40 intent-seeder, P=50 mutation-log-retention) + FILE_AFTER_CHANGE × 2 (P=20 card-emit, P=30 SSE). Idempotency Symbol guard. |
| `core/hooks/force-checks.js` | 347 | Force-check pass; registers at INDEX_COMPLETE P=90 (the 8th INDEX_COMPLETE subscriber registered at runtime via `registerForceChecks`). |
| `core/server/main.js` | 573 | Bootstrap: builds emitter/printer, calls `registerDefaultSubscribers` + `registerForceChecks`, fires `INDEX_START` → Pass-0 prune → Pass-1 upsert+`FILE_INDEXED` per file → Pass-2 connection wiring via `connection-resolver` + `clearAllConnections` → `INDEX_COMPLETE`. File-watcher loop fires `FILE_BEFORE_CHANGE` + `FILE_AFTER_CHANGE`. |
| `core/server/app.js` | 2654 | `St8Server` HTTP class. Manifest-cache invalidator subscribed at INDEX_COMPLETE P=200. Publishes `LIFECYCLE_TRANSITION` (×2), `PRD_GENERATE`, `COMMIT_RECORDED`, `TICKET_CREATED`. |
| `core/server/auth.js` | 155 | `.st8/server.secret` mode-0600 + X-St8-Secret check + loopback gate. |
| `core/server/route-manifest.js` | 181 | **Declared contract** — 31 route entries; enforced 1:1 by `tests/core/server/route-manifest-drift.test.js`. |

---

## 2. Hook types declared vs wired (the 9 named in HOOKS)

| Hook | Publishers | Default subscribers | Status |
|---|---|--:|---|
| `INDEX_START` | `main.js:267` | 2 (sonic-daemon, bruno-session-start) | **WIRED** |
| `INDEX_COMPLETE` | `main.js:415` | 7 defaults + 1 force-check + 1 app.js cache invalidator (registered late in `St8Server.start()`) | **WIRED — 7 baseline asserted by hook-registry.test.js:391** |
| `FILE_INDEXED` | `main.js:333` (per-file in Pass-1 loop) | 0 | **PUBLISHER live, NO subscribers — extension point only.** |
| `FILE_BEFORE_CHANGE` | `main.js:462` (watcher) | 0 | **WIRED publisher, ZERO subscribers.** |
| `FILE_AFTER_CHANGE` | `main.js:482` (watcher) | 2 (schema-card-emitter, SSE-broadcaster) | **WIRED** |
| `LIFECYCLE_TRANSITION` | `app.js:1191` (`_handleConceptFile`), `app.js:1403` (`_handleProductionPromote`), `bruno-oscar.js:45` (3 sites: flag/archive/un-archive) | 0 | **WIRED 5 publishers, ZERO subscribers** — prime canonical-category subscriber target. |
| `COMMIT_RECORDED` | `app.js:2122` (`_handleRecordCommit`) | 0 | **WIRED publisher, ZERO subscribers** — roadmap P2 wants a `.st8/commit-snapshots/<hash>.json` writer. |
| `PRD_GENERATE` | `app.js:1312` (`_handlePrd`) | 0 | **WIRED publisher, ZERO subscribers** — scaffolding. |
| `TICKET_CREATED` | `app.js:2237` (`_handleTickets`) | 0 | **WIRED publisher, ZERO subscribers** — Sonic-indexer subscriber pending (hooks-and-integration roadmap P1). |

Six of nine hooks have publishers but no subscribers — every one of
them is a canonical-category producer waiting for a subscriber.

---

## 3. Routes documented vs declared vs implemented — drift table

CLAUDE.md (lines 95–112) declares 11 endpoints. `route-manifest.js`
declares **31**. `app.js` switch covers 29 flat cases + 2 regex
defaults. Tests enforce drift via `route-manifest-drift.test.js`.

| Surface | CLAUDE.md | route-manifest.js | app.js switch | Notes |
|---|:-:|:-:|:-:|---|
| `/api/state` | **YES** | NO | NO | **404. Documented but not implemented.** |
| `/api/manifests` | **YES** | NO | NO | **404. Documented but not implemented.** |
| `/api/events` | **YES (as "SSE event stream")** | as `/api/mutations` | as `/api/mutations` | Name drift: CLAUDE.md calls it `/api/events`, code calls it `/api/mutations`. |
| `/api/connection-state.json` | NO | YES | YES | Real impl. |
| `/api/ai-signal.toml` | NO | YES | YES | Real impl. |
| `/api/health` | NO | YES | YES | Real impl. |
| 22 other routes | NO | YES | YES | Match. |

Drift class A (404 ghost): `/api/state`, `/api/manifests`.
Drift class B (renamed): `/api/events` ↔ `/api/mutations`.

---

## 4. 404 routes — cheapest unblock per

### `/api/state` (≤30 LOC, low risk)

Surface: `{ targetDir, lastIndexed, healthScore, statusCounts,
fileCount, openTicketCount, lifecyclePhaseCounts }`.

Data sources, all already in `St8Persistence`:
- `targetDir`, `lastManifestUpdate` on `this` (already used by `_serveHealth`).
- `getAllFiles()` → derive `statusCounts` + `lifecyclePhaseCounts` in one pass.
- `countOpenTickets()` exists (`/api/tickets/count` consumer).
- `healthScore` is the one missing piece — `builder.js:99`
  computes it but indexer.js:269 discards it. **Either** re-thread
  it through to the manifest (cleanest, but cross-cluster), **or**
  recompute on demand as `green/total` from the file list (cheap,
  one-liner). Recommend the second.

Effort: half a day. Confidence: high.

### `/api/manifests` (≤20 LOC, trivial)

Surface: list of files under `<targetDir>/.st8/schema-cards/*.json`
plus their mtimes. Pure FS read; no persistence touch needed.

```
fs.readdirSync(path.join(targetDir, '.st8', 'schema-cards'))
  .filter(f => f.endsWith('.json'))
  .map(f => ({ filename: f, mtime: fs.statSync(...).mtime }))
```

Effort: 30 minutes. Confidence: high.

Both routes need: `_handle` method, `route-manifest.js` entry,
`app.js` switch case, drift-test passes. Standard recipe.

---

## 5. Persistence schema drift

### The two `ST8_SCHEMA` declarations (real)

- **`src/features/indexing/indexer.js:79`** — 78-line template
  literal: 6 tables (`file_registry`, `connections`, `file_intent`,
  `file_mutation_log`, `activity_log`, `st8_settings`) + indices.
  **No CHECK constraint on `lifecyclePhase`. No `brunoStatus`, no
  `needsAIReview`, no `tripleAtCount`, no `aiContentInjected`, no
  `templateVariables`, no `hasUnfilledVariables`. No `prd_projects`,
  no `ai_content`, no `tickets`, no `providers`.**
- **`src/core/database/persistence.js:65`** — 224-line template
  literal: 10 tables (the 6 above + `prd_projects`, `ai_content`,
  `tickets`, `providers`) + CHECK constraints + full canonical
  index set.

The indexer's `ST8_SCHEMA` is the **older, stripped sibling.**
Search confirms: `indexer.js`'s `ST8_SCHEMA` is **never `.exec()`d**
anywhere in `src/` (it's a dead constant carried from the
pre-refactor `backend/index.js`). Live schema apply happens only at
`persistence.js:423` (`this.db.exec(ST8_SCHEMA)`).

**Risk:** a contributor reading `indexer.js`'s constant believes it
is current and adds a column there. Future-bug magnet. The
constant should be deleted (zero callers) or replaced by an import
of the canonical from persistence.js. Recommend delete.

### `EXPECTED_SCHEMA` introspection drift status

`introspectSchema()` (persistence.js:474) iterates 10 expected
tables × `PRAGMA table_info`, returns structured diff
(`missingTables`, `extraTables`, `missingColumns`, `extraColumns`).
Run at boot, logs `[st8:persistence:drift]` warnings only — never
throws. Three classes of drift that surface but don't block:

1. Older `st8.sqlite` missing the five post-initial columns
   (`needsAIReview` etc.) — known, awaiting migration framework
   (P1.1).
2. `tickets.claimedBy` has no SQL-level FK to `providers.id` —
   enforced JS-side in `claimTicket()`. Block-comment in DDL
   (persistence.js:255-275) is explicit; drift detector cannot see
   missing FKs (only columns).
3. The `connectionType` column on `connections` has no CHECK —
   any string is accepted. `connection-resolver` always writes
   `'IMPORT'` so this is latent surface, not active bug.

**Column-presence audit (10 tables × 88 columns).** Every column
declared in `EXPECTED_SCHEMA` is referenced by at least one method
in persistence.js (`upsertFile`, `getOpenTickets`, etc.) — no dead
columns. Two columns are READ-only in the live codebase:
`file_registry.expiryDate` and `file_registry.eventTrigger` — no
producer writes them. Bruno/Oscar uses `brunoStatus` instead.
Recommend roadmap-flagging `expiryDate` + `eventTrigger` for
either wire-up or removal.

---

## 6. New persistence methods that would unblock canonical producers

The shared/types report's "win #2" (an `addInsightsBatch` bypass that
validates against the canonical-13 enum) is real and bigger than
described:

### M1. `validateInsightCategory(category)` → boolean / throw

Single source of truth — read from the canonical TS enum at
`docs/Insight Store/insightStore.ts:11`. Wire into `addInsight()`
and `addInsightsBatch()` in `insight-store.js`. Pattern: same as
`logActivity`'s key whitelist + `claimTicket`'s provider validator
("loud bug beats quiet bug" from Wave 1A).

**Unblocks:** every future canonical-category producer can trust
the store rejects ad-hoc strings, retiring the ad-hoc 5
(`orphan`, `red-status`, `under-connected`, `under-imported`,
`high-impact`).

### M2. `getInsightsByCategory(category, projectId?, limit?)` in InsightStore — **already exists**

`docs/Insight Store/insightStore.ts:277` declares it. Spot-check
`/home/user/st8/src/features/analysis/insight-store.js` to confirm
it survived compile, then expose it via `/api/insights?category=<c>`
(see §8 Q-W #1). Trivial.

### M3. `getFileMetrics()` — replace builder.js discard

Read-side method: `SELECT status, lifecyclePhase, COUNT(*) FROM
file_registry GROUP BY ...`. Replaces the need to re-thread
`healthScore` through `buildGraph`'s output. Single transaction, 2
SQL statements. Feeds `/api/state` (§4) and any future dashboard.

### M4. `clearAllInsightsForProject(projectId)`

Mirror of `clearAllConnections()` (clear-then-rebuild recipe D).
Needed once a second canonical producer lands and we want a clean
`INDEX_COMPLETE` rebuild without stale insights from a prior run.
Today the populator + cycle-emitter rely on the InsightStore's
internal idempotency — first canonical producer that ISN'T
idempotent will need this. Already exists conceptually as
`removeProjectInsights` in the TS design (`insightStore.ts:408`).
Confirm port in the JS.

---

## 7. Subscriber-registration patterns — promotable conventions

Current `default-subscribers.js` is already disciplined:

1. **DRY + wrap** — every subscriber has an inner `try/catch` with
   `[st8] <source> failed: <msg>` log (Wave 1B ticket 13). Convention.
2. **Symbol idempotency guard** — `Symbol.for('st8.defaultSubscribersRegistered')`.
3. **Late-require** inside the handler — avoids pulling features
   into module-load order during tests.
4. **Per-handler priority constants in 10-step bands** — 10/20/30/35/37/40/50/90/200.
   Gaps left for insertions (the cycle-insight-emitter slotted in
   at 37 with no renumbering needed).

What COULD be promoted into the registry itself:

- **A. `register(name, fn, {source, priority, retryQueue?})` with a
  per-subscriber retry queue.** Today errors are caught + logged
  and discarded. Roadmap P3 in hooks-and-integration wants a
  replay tool; a small `failedInvocations` Map on the registry
  would feed it without new infrastructure.
- **B. Per-subscriber timing via `performance.now()`** — already
  flagged P3 in hooks roadmap. Slot would be in `execute()` around
  the existing `await entry.handler(ctx)`.
- **C. `ctx` shape per hook documented as a frozen interface
  rather than JSDoc.** Subscribers regularly check `if (!ctx ||
  !ctx.persistence) return;` — could centralise.

Recommend B + C as small follow-ups; A waits on subscriber count
growing.

---

## 8. TOP 3 QUICK WINS (impact × confidence / effort)

### QW-1. `/api/insights?category=<canonical>` filter — **HIGHEST**

- **Impact:** unblocks every downstream consumer of canonical-13
  categories. The `addInsightsBatch` path already writes
  `category` correctly for `circular_dependency`; an ad-hoc-set
  filter today returns the populator's 5 strings mixed with the
  emitter's 1 canonical string. A `?category=` filter + the
  `validateInsightCategory` method (M1) separates them cleanly.
- **Confidence:** high. `getInsightsByCategory` already exists in
  the canonical TS (`insightStore.ts:277`), the JS port likely
  carries it.
- **Effort:** ~30 LOC in `_handleInsights` + 1 persistence method
  + 1 test. Half a day.

### QW-2. `/api/state` route — implement the documented ghost

- **Impact:** every frontend that polls server state today hits
  `_serveHealth` (which gives `{uptime, lastManifestUpdate}` only)
  or `connection-state.json` (full manifest — heavy). `/api/state`
  is the canonical middle-weight endpoint. Closes a docs/impl
  drift documented in CLAUDE.md and unblocks UI panel work
  (frontend-experience cluster). Strong claim because the cluster
  reports note 8 endpoints with no frontend consumer — the
  reverse drift (a documented endpoint with no implementation) is
  cheaper to close.
- **Confidence:** high. All data is in persistence.
- **Effort:** ~60 LOC across `app.js` + `route-manifest.js` + test
  + 1 small persistence method (M3). One day.

### QW-3. `LIFECYCLE_TRANSITION` subscriber — Sonic indexer or activity-log

- **Impact:** 5 publishers are firing today with ZERO subscribers
  (`_handleConceptFile`, `_handleProductionPromote`,
  bruno-oscar × 3). A P=50 `activity-log-writer` subscriber that
  writes one row per transition would (a) make the lifecycle
  observable in the existing activity_log query path, (b) feed
  any future per-commit timeline view, (c) prove the canonical-
  producer pattern for the second hook (the first being
  COMMIT_RECORDED).
- **Confidence:** high. `persistence.logActivity()` is the
  whitelisted-key writer; payload of `LIFECYCLE_TRANSITION` maps
  1:1 to `{action: 'lifecycle:transition', targetFingerprint,
  details: JSON.stringify({oldPhase, newPhase, filepath})}`.
- **Effort:** ~25 LOC + test. Two hours.

QW-2 + QW-3 together convert "wired hook with no subscribers" from
6 to 5 and add 2 documented endpoints.

---

## 9. Cross-directory dependencies

| From `src/core` | To | Purpose | Risk |
|---|---|---|---|
| `default-subscribers.js` | `features/lifecycle/bruno-oscar.js` | `runBrunoCall` on INDEX_START | OK |
| `default-subscribers.js` | `features/schema-cards/{emitter,manifest-generator,printer}` | INDEX_COMPLETE cards + manifests | OK |
| `default-subscribers.js` | `features/analysis/{gap-analyzer,intent-seeder,insight-store-populator,cycle-insight-emitter,persistence-cycle-detector}` | INDEX_COMPLETE analysis | OK |
| `default-subscribers.js` | `features/search/sonic-daemon` | INDEX_START spin-up | Optional — wrapped |
| `default-subscribers.js` | `shared/utils/ast-parser` | FILE_AFTER_CHANGE card emit | OK |
| `main.js` | `features/indexing/{indexer,connection-resolver}` | Pass-1 + Pass-2 | OK |
| `main.js` | `features/watcher/file-watcher` | FILE_BEFORE/AFTER_CHANGE publisher | OK |
| `app.js` | `features/analysis/insight-store` via `getInsightStore` | `_handleInsights` | **Per-request init** (~30ms hit) |
| `app.js` | `features/prd/generator` | `_handlePrd` | OK |
| `app.js` | `features/analysis/{signal-path-adapter,path-generator,report-generator}` | signal-path / generate-report | Per-request `St8Persistence` |

The per-request St8Persistence pattern shows up in 4+ handlers;
the `getSharedPersistence()` singleton was the Wave-1 fix and
should be propagated to the remaining sites (already noted in
hooks-and-integration roadmap P2 "Shared persistence instance").

---

## 10. Gaps + open questions

1. **`indexer.js`'s `ST8_SCHEMA` constant.** Dead. Recommend
   deletion. Confirm by re-running `grep -n "ST8_SCHEMA"
   src/features/indexing/indexer.js` and `git log -S 'ST8_SCHEMA'`.
2. **`CLAUDE.md` route drift.** CLAUDE.md API table lists 11
   routes; route-manifest declares 31. Either CLAUDE.md is meant
   to be a "selected highlights" view (then say so explicitly) or
   it's stale. Cheap fix: regenerate CLAUDE.md table from
   `route-manifest.js`.
3. **`/api/events` vs `/api/mutations` naming.** CLAUDE.md says
   `/api/events`. Code says `/api/mutations`. The SSE bus is in
   `notification-bus.js`; the route name is implementation-detail
   in `app.js`. Pick one. Recommend `/api/events` (CLAUDE.md
   matches the SSE event-stream concept better than "mutations").
4. **`expiryDate` + `eventTrigger` columns on `file_registry`.**
   Declared in `EXPECTED_SCHEMA`, never written. Either wire (per
   bruno-oscar's scheduled expiry) or remove.
5. **`FILE_INDEXED` hook with 0 subscribers, fires 281×/index
   pass.** Fast-path covers it (<1ms total per hook-registry test
   measurements). But the pattern question: should the hook be
   tagged `optional` so future tooling can skip publishing?
   Probably not worth the complexity — the fast path is already
   measured-good.
6. **`graph-persister.js` is in `core/database/` but the only live
   importers are under `src/features/`** (insight-store +
   sonic-indexer + traversal + etc., per
   persistence-and-database.review.md). Is it actually a `core`
   asset or should it move to `features/integr8/`? Out of scope
   here; flag for a future structural pass.
7. **One discrepancy with the prompt.** Prompt says "hook-registry
   test asserts INDEX_COMPLETE has exactly 7 subscribers (bumped
   from 6 in batch 031)." Verified: `tests/core/hook-registry.test.js:391`
   asserts exactly 7. Good. But the live `start()` adds an 8th
   (`force-checks` P=90) and `St8Server.start()` adds a 9th
   (manifest-cache invalidator P=200). The test counts only
   `registerDefaultSubscribers`'s contribution, not the post-call
   additions. Worth a comment in the test to prevent future
   confusion.

---

## REPORT BACK

### 1. File inventory (sub-dirs)
10 files across `core/{hook-registry, notification-bus,
database/{persistence, graph-persister}, hooks/{default-subscribers,
force-checks}, server/{main, app, auth, route-manifest}}`. Two
oversized: `app.js` 2654, `persistence.js` 1611.

### 2. Hook types declared vs wired
9 declared. **6 fire with ZERO subscribers** (`FILE_INDEXED`,
`FILE_BEFORE_CHANGE`, `LIFECYCLE_TRANSITION`, `COMMIT_RECORDED`,
`PRD_GENERATE`, `TICKET_CREATED`). Every one is a canonical-
category producer awaiting a subscriber.

### 3. Routes documented vs actual
CLAUDE.md lists 11; route-manifest.js declares 31; app.js
implements 31. Drift: `/api/state` and `/api/manifests` are
documented in CLAUDE.md but 404 in code. `/api/events` (docs) ≠
`/api/mutations` (code) — naming mismatch.

### 4. 404 routes — cheapest unblock
`/api/manifests`: 30-min FS-only read. `/api/state`: half-day,
needs M3 `getFileMetrics()`. Both standard recipe (handler +
route-manifest entry + drift test).

### 5. Persistence schema drift
**Two `ST8_SCHEMA` declarations:** `indexer.js:79` is **dead** (78
LOC, never `.exec()`d). `persistence.js:65` is the live 224-LOC
canonical. Recommend deleting the indexer copy. `EXPECTED_SCHEMA`
introspection covers all 10 tables × 88 columns. Two unused
columns: `expiryDate` + `eventTrigger`.

### 6. New persistence methods
M1 `validateInsightCategory` — enforce canonical-13 enum. M2 surface
existing `getInsightsByCategory` via `/api/insights?category=`. M3
`getFileMetrics()` — feeds `/api/state` and replaces builder.js
discard. M4 `clearAllInsightsForProject` — clear-then-rebuild
recipe D twin of `clearAllConnections()`.

### 7. Subscriber-registration patterns
Already disciplined (try/catch + late-require + Symbol idempotency
+ 10-step priority bands). Promote: per-subscriber timing +
typed-ctx interface. Failed-invocations Map waits on subscriber
count.

### 8. TOP 3 QUICK WINS
**QW-1** `/api/insights?category=` filter — half-day, unblocks
canonical-13 consumers. **QW-2** `/api/state` implementation —
one day, closes documented drift. **QW-3** `LIFECYCLE_TRANSITION`
activity-log subscriber — 2 hours, retires 1 of the 6 hooks with
zero subscribers.

### 9. Cross-directory dependencies
All `src/core` → `src/features` edges flow through the registry
(default-subscribers) or per-request `getInsightStore` /
`St8Persistence` (4 handlers). `getSharedPersistence` singleton
should propagate to the per-request sites (hooks roadmap P2).

### 10. Gaps + open questions
Indexer's dead `ST8_SCHEMA`; CLAUDE.md route-table drift;
`/api/events` vs `/api/mutations` naming; unused `expiryDate` +
`eventTrigger` columns; test asserts 7 INDEX_COMPLETE subscribers
but runtime is 8 (force-checks) or 9 (manifest-cache invalidator)
— worth a clarifying test comment.
