# Research — `src/core/hooks/default-subscribers.js`

Wave: analysis-tools-unblock-pass-1
Cluster: hooks-and-integration
Tickets in scope: **T1** (wire relationship-analyzer as INDEX_COMPLETE P=25) and **T3** (cosmetic docstring fix on the insight-store-populator block).
Mode: read-only research.

---

## 1. Identity

- **Path:** `/home/user/st8/src/core/hooks/default-subscribers.js`
- **LOC:** 394 (file ends at the `module.exports` block on line 394).
- **Module shape:** `'use strict'` CommonJS. Two named exports plus a Symbol.
  - `registerDefaultSubscribers(registry)` — the entry point.
  - `_resetDefaultSubscribersFlag(registry)` — test helper for `clear()` + re-register.
  - `DEFAULTS_REGISTERED` — `Symbol.for('st8.defaultSubscribersRegistered')` used as the idempotency flag (line 53).
- **Last commit touching this file:** `2f076d1 fix(lifecycle): wire dormant printer chain on FILE_AFTER_CHANGE (ticket 16)` (per `git log --oneline -- src/core/hooks/default-subscribers.js | head -1`). Predecessors (in order): `7af7411` (Wave 4B bruno session-start), `4984892` (Wave 3B insight-store-populator), `3b8fa1a` (Wave 2D idempotency + DRY+wrap + sonic top-level require), `13ec011` (Wave 2B FILE_AFTER_CHANGE decomp), `b05f6fc` (Wave 1B mutation-log retention), `7f16a65` (sonic daemon), `04f63fb` (original HookRegistry).

---

## 2. Stated intent (cluster doc framing)

`docs/components/hooks-and-integration.md` lines 11–14, 96–146 frame this file as **"the single bootstrap call (from `src/core/server/main.js:258`) that attaches st8's built-in modules to the registry."** Each named hook has at least one publisher (Wave 2B closed the four declared-but-unfired gaps); subscribers are wired here.

`docs/components/identity-and-analysis.md` §3 (lines 59–75) — "The post-index hook chain" — is the canonical diagram and is **out of date**: it does **not** mention `P=35 insight-store-populator` (added Wave 3B) or `P=50 mutation-log-retention` (added Wave 1B). The bible commit log shows both were added after the doc was last hand-edited. This is a known doc-drift issue, not in scope for T1/T3 but worth noting.

---

## 3. Public surface — `registerDefaultSubscribers`

**Signature:** `registerDefaultSubscribers(registry)` (`src/core/hooks/default-subscribers.js:69`).

**Argument shape:** any object that has `register(name, handler, options)` — typically a `HookRegistry` instance (the singleton from `src/core/hook-registry.js:267` or a fresh `new HookRegistry()` for tests). The function throws `TypeError('registerDefaultSubscribers: needs a HookRegistry')` if `registry.register` is not a function (line 70–72).

**Return value:** `undefined`. Subscribers are registered for their side effect; no handle is returned.

**Idempotency:** the symbol `DEFAULTS_REGISTERED` is set on the registry on first call (line 77). Subsequent calls short-circuit on the guard at line 73–76. Tests that `clear()` and re-register must also call `_resetDefaultSubscribersFlag(registry)` (lines 386–388, asserted by `tests/core/hook-registry.test.js:401-415`).

**Caller:** `src/core/server/main.js:258` calls this exactly once during bootstrap, after persistence init + before the first `hookRegistry.execute(HOOKS.INDEX_START, ...)` at `main.js:267`.

---

## 4. The current subscriber map

| Hook | Priority | Source tag | Handler (anonymous arrow) | Registered module / function | Lines |
|---|---|---|---|---|---|
| `HOOKS.INDEX_START` | 10 | `sonic-daemon` | inline | `sonicDaemon.start({ targetDir })` — `src/features/search/sonic-daemon.js` (hoisted top-level require at line 44, try/catch'd) | 84–99 |
| `HOOKS.INDEX_START` | 20 | `bruno-session-start` | inline | `new BrunoOscar(ctx.persistence, notificationBus).runBrunoCall()` — `src/features/lifecycle/bruno-oscar.js` + `src/core/notification-bus.js` (both lazy-required inside handler) | 114–127 |
| `HOOKS.INDEX_COMPLETE` | 10 | `manifest-generator` | inline | `writeManifests(ctx.result.files, ctx.targetDir)` — `src/features/schema-cards/manifest-generator.js` | 142–150 |
| `HOOKS.INDEX_COMPLETE` | 20 | `schema-card-emitter` | inline | `ctx.emitter.emitAllCards(ctx.persistence)` + `ctx.printer.printAllFromCards(...)` — `src/features/schema-cards/emitter.js` + `printer.js` (handles passed via ctx, not required here) | 154–162 |
| `HOOKS.INDEX_COMPLETE` | 30 | `gap-analyzer` | inline | `new GapAnalyzer(schemaCardsDir, ctx.persistence).analyze() + .writeReport(...)` — `src/features/analysis/gap-analyzer.js` | 166–177 |
| `HOOKS.INDEX_COMPLETE` | 35 | `insight-store-populator` | inline | `populateInsightsFromRegistry(ctx.persistence, { projectId: 'st8' })` — `src/features/analysis/insight-store-populator.js` | 214–224 |
| `HOOKS.INDEX_COMPLETE` | 40 | `intent-seeder` | inline | `new IntentSeeder(ctx.persistence, schemaCardsDir, ctx.targetDir).seedAll()` — `src/features/analysis/intent-seeder.js` | 181–191 |
| `HOOKS.INDEX_COMPLETE` | 50 | `mutation-log-retention` | inline | `ctx.persistence.pruneMutationLogRetention(30)` + gated via `getSetting/upsertSetting('persistence', 'mutationLogLastPruneAt')` | 243–266 |
| `HOOKS.INDEX_COMPLETE` | 90 | `force-checks` | `runForceChecks` | `src/core/hooks/force-checks.js:330` — registered via a **separate** call `registerForceChecks(hookRegistry)` from `main.js`, **not** from `registerDefaultSubscribers`. | n/a (different file) |
| `HOOKS.FILE_AFTER_CHANGE` | 20 | `file-after-change/schema-card-emitter` | inline | Reads `ctx.emitter`, AST-parses via `src/shared/utils/ast-parser.js`, calls `ctx.emitter.emitCard(...)`. DELETE branch unlinks the on-disk card. Sets `ctx.schemaCard` for the P=30 broadcaster. | 294–347 |
| `HOOKS.FILE_AFTER_CHANGE` | 30 | `file-after-change/sse-broadcaster` | inline | Publishes to `notificationBus` (lazy-required) with `{ fingerprint, filepath, mutationType, actor, sha256Hash, schemaCard }`. | 355–378 |

Run-order (`registry.introspectExecuteOrder(HOOKS.INDEX_COMPLETE)` after `registerForceChecks` is called):

```
manifest-generator (10) → schema-card-emitter (20) → gap-analyzer (30) →
insight-store-populator (35) → intent-seeder (40) → mutation-log-retention (50) →
force-checks (90)
```

**Source order in the file** ≠ **priority order at runtime.** The file registers `gap-analyzer` (P=30) at line 166, then `intent-seeder` (P=40) at line 181, then `insight-store-populator` (P=35) at line 214 — but at runtime the registry sorts by priority (`HookRegistry.register` line 106) so insight-store-populator (P=35) runs **before** intent-seeder (P=40). This file-order-vs-run-order mismatch is the entire root cause of T3's docstring bug.

**Hooks with zero default subscribers:** `FILE_INDEXED`, `FILE_BEFORE_CHANGE`, `LIFECYCLE_TRANSITION`, `COMMIT_RECORDED`, `PRD_GENERATE`, `TICKET_CREATED`. All have publishers; no defaults.

---

## 5. Prior work touching this file

| Commit | Wave | What it did |
|---|---|---|
| `04f63fb` | initial | Original `HookRegistry` + initial INDEX_COMPLETE subscribers (manifest, schema-card-emitter, gap-analyzer, intent-seeder). |
| `7f16a65` | sonic foundation | Added P=10 INDEX_START sonic-daemon subscriber (lazy-required at that point). |
| `b05f6fc` | Wave 1B | Added P=50 INDEX_COMPLETE `mutation-log-retention` subscriber + 24h gate via `st8_settings`. |
| `13ec011` | Wave 2B (ticket 6) | Decomposed the 215-line `onFileChange` callback in `main.js` into the two new `FILE_AFTER_CHANGE` subscribers (P=20 emitter + P=30 sse-broadcaster). |
| `3b8fa1a` | Wave 2D (tickets 12, 13, 14) | (a) Idempotency via `DEFAULTS_REGISTERED` Symbol; (b) DRY+wrap convention applied uniformly to every subscriber; (c) hoisted sonic-daemon require to top of file with try/catch (the `sonicDaemon`/`sonicDaemonLoadError` module-locals at lines 41–48). Reviewer flagged all three "convention decisions" still hold (review.md:582–605). |
| `4984892` | Wave 3B (ticket 7 of identity-and-analysis) | Added the P=35 `insight-store-populator` subscriber at lines 193–224. **This is the source of the T3 docstring bug** — the comment block at lines 193–213 claims it runs "after intent-seeding" but P=35 < P=40, so it runs **before** intent-seeder at runtime. |
| `7af7411` | Wave 4B (ticket 9) | Added P=20 INDEX_START `bruno-session-start` subscriber at lines 114–127. |
| `2f076d1` | Wave 4C (ticket 16) | Set `ctx.schemaCard` in the P=20 FILE_AFTER_CHANGE handler (line 343) so the P=30 broadcaster can forward it to `notificationBus.publish` for the printer fallback. |

No prior wave has touched the relationship-analyzer wiring. Ticket 3 of `identity-and-analysis` was **defer-confirmed** by Wave 3B (defer reason at `docs/_pending-tickets/identity-and-analysis.for-review.json:59`: wiring against `(currentGraph, currentGraph)` would emit all-SAFE conflicts — "a stub disguised as a wire-up"). T1 in **this** wave re-opens that decision.

---

## 6. Existing tests

`tests/core/hook-registry.test.js` (the only place that tests `registerDefaultSubscribers` directly):

| Line | Test | What it asserts |
|---|---|---|
| 371–399 | ticket 12 — idempotent | `INDEX_COMPLETE.count === 6` (line 390); `INDEX_START.count === 2` (line 395). |
| 401–415 | ticket 12 — `_resetDefaultSubscribersFlag` unblocks re-register | `INDEX_COMPLETE.count === 6` (line 414). |
| 417+ | ticket 14 — sonic-daemon top-level require | source-grep asserts the require is at module top, not inside the handler. |
| 489+ | ticket 13 — DRY+wrap | every INDEX_COMPLETE subscriber survives a bare-ctx fire. |

`tests/core/hooks/file-after-change-printer-wire.test.js` — covers the Wave 4C ticket 16 ctx.schemaCard wiring.

`tests/features/analysis/insight-store-populator.test.js` — 7 probes against `populateInsightsFromRegistry` directly. **Does not** assert priority or run-order relative to intent-seeder. The hook-count assertion in `tests/core/hook-registry.test.js:390` is the only test that locks subscriber count for INDEX_COMPLETE.

`tests/features/lifecycle/bruno-oscar.test.js:239–296` — static-shape probe + dedup probe for `registerDefaultSubscribers` on INDEX_START.

**No test asserts run-order for INDEX_COMPLETE.** Adding a P=25 subscriber will break the `count === 6` assertion at hook-registry.test.js line 390 and 414 unless those numbers are bumped to 7.

---

## 7. Contracts

### Priority semantics

`HookRegistry.register` (line 93–109 in hook-registry.js): stores `priority` (default 100) on the entry, then `arr.sort((a, b) => a.priority - b.priority)` — **lower priority runs first**. `execute()` iterates the sorted array (lines 155–164). Same priority preserves registration order (sort is stable on V8).

CLAUDE.md priority bands (mirrored in `docs/components/hooks-and-integration.md:275-280`):

- 10–40: per-feature work other subscribers may read (manifests, cards, intent).
- 50–80: derived/secondary work (notifications, dashboards, mirrors).
- 90+: verification / integrity passes that read everything else's output.

P=25 fits in the 10–40 band as a "per-feature read of cards before gap-analysis." Slot is currently empty (see §9).

### DRY + wrap convention (Wave 2D ticket 13)

Every default subscriber wraps its body in its own `try/catch` and logs `console.error('[st8] <module> failed:', err.message)`. The wrap is **convenience**, not load-bearing — `HookRegistry.execute` already catches per-handler throws (line 156–164 of hook-registry.js) so the chain continues. The Wave 2B reviewer (review.md:200–210) confirmed the inner wrap is duplicative for isolation but provides per-source error context that the registry's generic `[hooks] "X" subscriber "Y" threw:` line loses.

Verified per-subscriber log strings in this file:
- `[st8] Manifest generation failed:` (148)
- `[st8] Schema card emission failed:` (160)
- `[st8] Gap analysis failed:` (175)
- `[st8] Insight store population failed:` (222)
- `[st8] Intent seeding failed:` (189)
- `[st8] file_mutation_log retention failed:` (264)
- `[st8] Sonic daemon start failed:` (97)
- `[st8] Bruno session-start scan failed:` (125)
- FILE_AFTER_CHANGE branch-local catches at 308 (`Failed to delete schema card for ...`), 344 (`Failed to emit schema card for ...`), 376 (`SSE broadcast failed:`).

### Registry-level safety net

`HookRegistry.execute` (hook-registry.js:144–189): per-handler try/catch logs `[hooks] "<hook>" subscriber "<source>" threw:` and counts the failure in `summary.fail`. A subscriber throw never breaks subsequent subscribers. EventEmitter listeners (re-emit at lines 178–187) are also wrapped per-listener.

### Source tag convention

- Bare module name for INDEX_START/INDEX_COMPLETE subscribers: `sonic-daemon`, `bruno-session-start`, `manifest-generator`, `schema-card-emitter`, `gap-analyzer`, `insight-store-populator`, `intent-seeder`, `mutation-log-retention`, `force-checks`.
- Path-prefixed for FILE_AFTER_CHANGE: `file-after-change/schema-card-emitter`, `file-after-change/sse-broadcaster` — disambiguates from the INDEX_COMPLETE namesake.

T1's new subscriber should follow the bare-module convention.

---

## 8. Change vector

### T1 — register `relationship-adapter` at INDEX_COMPLETE P=25

**Spec (canonical):** `docs/_pending-roadmap/identity-and-analysis.md:49-53` ("P2.1 — Wire `relationship-analyzer.js` … Register as an INDEX_COMPLETE subscriber at P=25 (before gap-analyzer reads cards so gap-analyzer can incorporate the conflict signal into D5)").

**Source tag:** `relationship-analyzer` (bare module name, matches the file at `src/features/analysis/relationship-analyzer.js`). Aligns with sibling tags `gap-analyzer`, `intent-seeder`, `insight-store-populator`.

**Where to add the import:** there is no module-level require for the analysis features today — `gap-analyzer`, `intent-seeder`, and `insight-store-populator` are all lazy-required **inside** their handler (lines 168, 183, 216). Match this pattern: lazy-require inside the handler so test registries that don't exercise INDEX_COMPLETE don't pull the analyzer's transitive deps. Do **not** hoist the require to the top of the file unless the adapter has a load-time cost the brief wants to surface at boot (the sonic-daemon hoist is precedent for that case; the other analyzers chose lazy).

**Where to add the register block:** the source order in the file is currently:
- line 142–150: P=10 manifest-generator
- line 154–162: P=20 schema-card-emitter
- line 166–177: P=30 gap-analyzer
- line 181–191: P=40 intent-seeder
- line 193–224: P=35 insight-store-populator (out of order in source!)
- line 243–266: P=50 mutation-log-retention

By **priority** the new P=25 block belongs between schema-card-emitter (P=20, line 162) and gap-analyzer (P=30, line 166). The clean placement is **immediately after the schema-card-emitter register block at line 162**, before the gap-analyzer comment block at line 164.

**Suggested template (matches the existing convention exactly — DRY+wrap, bare-module source tag, lazy require):**

```js
// P=25 — Relationship analysis (roadmap P2.1, identity-and-analysis).
// Runs AFTER schema-card emission (P=20) so cards are on disk and BEFORE
// gap-analyzer (P=30) so D5 can incorporate the conflict signal.
//
// Wrapped in try/catch per the ticket-13 convention.
registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
  try {
    const { analyzeRelationships } = require('../../features/analysis/relationship-analyzer');
    // ... adapter call here; see open question in §10 about the
    // (externalGraph, currentGraph) argument shape ...
    console.log('[st8] Relationship analysis complete');
  } catch (err) {
    console.error('[st8] Relationship analysis failed:', err.message);
  }
}, { priority: 25, source: 'relationship-analyzer' });
```

**Expected payload from the hook:** `HOOKS.INDEX_COMPLETE` payload (per hook-registry.js:42 + main.js:380): `{ result, targetDir, persistence, emitter, printer }`. `ctx.result.files` is the upserted file_registry slice; `ctx.persistence` exposes `getAllFiles`, `getAllConnections` (added Wave 2D ticket 18 at persistence.js:919-924), `getFileByPath`, etc. — the same handles gap-analyzer reads.

**Cross-cluster blocker (must not be ignored):** `relationship-analyzer.analyzeRelationships(externalGraph, currentGraph, targetPages)` requires three inputs; st8 only has `currentGraph`. The Wave 3B defer (identity-and-analysis.for-review.json:59) is explicit: wiring against `(currentGraph, currentGraph)` produces all-SAFE conflicts — "a stub disguised as a wire-up." T1's brief in **this** wave says "wire end-to-end" — that implies either (a) a relationship-**adapter** layer that synthesizes a meaningful external graph (e.g. a recent git revision of the same repo) or (b) accepting the Wave 3B deferral and surfacing the missing data source as a flag. The brief says "adds a NEW INDEX_COMPLETE subscriber" so the subscriber wire-up itself is in scope; what the subscriber **feeds** the analyzer is the open question (see §10).

**Test impact:** `tests/core/hook-registry.test.js:390` and `:414` both assert `idxComplete.count === 6`. T1 changes that to 7. The assertion error messages also need updating: line 390 says "INDEX_COMPLETE should have exactly 6 default subscribers, not 12" (the 12 is the doubled-subscribers-via-idempotency-failure case; the new number is "7, not 14"). The comment block at line 385–388 enumerating the 6 subscribers must add `relationship-analyzer`.

### T3 — cosmetic docstring fix on the insight-store-populator block

**Location:** `src/core/hooks/default-subscribers.js:193-213` (comment block above the `registry.register(HOOKS.INDEX_COMPLETE, ...)` call at line 214).

**Exact bug:** line 196 reads:

```js
  // Walks the file_registry after intent-seeding has run and writes
```

At runtime, `intent-seeder` is P=40 and `insight-store-populator` is P=35. Lower priority runs first (verified: `HookRegistry.register` sorts ascending). **`insight-store-populator` runs BEFORE `intent-seeder`, not after.** The docstring is asserting the opposite of what the priority numbers it uses guarantee.

The bug originates in commit `4984892` (Wave 3B ticket 7 of identity-and-analysis). The author probably wrote the block based on source-order (the populator's register block sits **after** intent-seeder's register block in the file — lines 181–191 then 193–224 — which reads as "after intent-seeding"), forgetting that the registry re-sorts by priority. The Wave 3B reviewer did not catch it (the ticket was acked).

**The corroborating research find:** `docs/_research/2026-05-16-analysis-tools-unblock/src_features_analysis_insight-store-populator.md:48` already enumerated the same bug: *"Despite the docstring at default-subscribers.js:193 claiming 'after intent-seeding has run', the insight populator (P=35) actually runs **before** intent-seeder (P=40). Stale block comment; not a bug. Insights depend on `status`/`reachabilityScore`/`impactRadius` from the indexer's graph build, not on intent."* That research note confirms the populator does not depend on intent-seeder output — the order is incidental, not load-bearing. The populator reads `status` / `reachabilityScore` / `impactRadius` from `file_registry` rows the indexer wrote in Pass-1/Pass-2; intent-seeder writes to a different table (`file_intent`).

**Proposed exact text change (T3 deliverable):**

Old (line 196–197):
```js
  // Walks the file_registry after intent-seeding has run and writes
  // per-file insights into InsightRecords / FileInsightSlots:
```

New:
```js
  // Walks the file_registry (which the indexer's graph build populates
  // with status/reachabilityScore/impactRadius in Pass-2) and writes
  // per-file insights into InsightRecords / FileInsightSlots:
```

Rationale: removes the false ordering claim, replaces with the accurate dependency (Pass-2 graph build → `file_registry` shape → insights). No behavior change. No priority change. Reading order in the registry remains `... gap-analyzer (30) → insight-store-populator (35) → intent-seeder (40) ...`.

**Optional secondary fix:** the source-order in the file is also misleading (insight-store-populator's register block at lines 193–224 sits between intent-seeder's block at lines 181–191 and the mutation-log-retention block at 226+). Moving the populator block up to between gap-analyzer (line 177) and intent-seeder (line 181) would make source-order match runtime-order. That is a **second** edit and is **not required** for T3 — the comment fix alone closes the cosmetic bug. Reviewer may want to ack the move as a separate concern (cluster convention is "source-order should mirror priority-order where practical" but it isn't enforced).

**Test impact:** none. The comment is not asserted by any test.

---

## 9. Provisions already made

**P=25 slot:** empty. Priorities currently in use on INDEX_COMPLETE are `10, 20, 30, 35, 40, 50, 90`. No subscriber claims P=25. The slot is also documented as P2.1's intended landing zone (`docs/_pending-roadmap/identity-and-analysis.md:51`).

**Pattern abstractions:** none beyond the DRY+wrap convention. Each subscriber's register block is hand-rolled. Tags, log strings, and require sites are all inline. The convention is "follow the gap-analyzer block at lines 166–177 as a template" — that's what T1's new block should mirror.

**Lazy-require pattern:** all three analysis-feature subscribers (`gap-analyzer`, `intent-seeder`, `insight-store-populator`) lazy-require their feature module inside the handler. T1's `relationship-analyzer` require should be lazy too unless there is a load-cost reason to hoist (the sonic-daemon hoist at lines 41–48 is the only top-level feature require, and it's there because the brief at ticket 14 specifically wanted missing-module surfacing at boot, not on first INDEX_START fire).

**`ctx` carries no opaque state.** Every subscriber reads from `ctx.persistence` / `ctx.targetDir` / `ctx.emitter` / `ctx.printer` / `ctx.result`. T1's adapter must source its inputs from these handles (or build a `SemanticGraph` from `persistence.getAllFiles()` + `persistence.getAllConnections()`).

**`relationship-analyzer.js` itself:** already exists at `src/features/analysis/relationship-analyzer.js` (924 LOC; no consumers besides the dead `src/features/integr8/index.js:51` import). The signature is `analyzeRelationships(externalGraph, currentGraph, targetPages)`. No adapter file exists yet — T1's brief says "wire end-to-end" so the adapter is part of T1's deliverable (or it's a chained ticket).

---

## 10. Gaps + open questions

1. **T1's argument shape for `analyzeRelationships`.** The function expects `(externalGraph, currentGraph, targetPages)`. st8's runtime has `currentGraph` only. The Wave 3B deferral (identity-and-analysis.for-review.json:59) is explicit that wiring against `(currentGraph, currentGraph)` is a cheat. What does T1's adapter feed for `externalGraph`? The companion research at `docs/_research/2026-05-16-analysis-tools-unblock/src_features_analysis_relationship-analyzer.md` and `src_features_analysis_path-generator.md:191` should have the answer (they're in the same wave bundle); cross-check with the analyzer researcher.

2. **Hook-count test update.** `tests/core/hook-registry.test.js:390` and `:414` assert `INDEX_COMPLETE.count === 6` plus a comment block at lines 385–388 enumerating the six. T1 must update both lines to 7 and add `relationship-analyzer` to the comment. Strictly out of scope for `default-subscribers.js` edits but **in scope for any commit that adds the subscriber**, or the test will fail (`npm test` will go from 207 passing to 206 passing + 1 fail).

3. **Identity-and-analysis ticket 3 deferral status.** That ticket (`docs/_pending-tickets/identity-and-analysis.for-review.json:53-64`) is marked `defer-confirmed` with explicit reasoning. T1 in this **hooks** cluster re-opens it. The roadmap reads "P2.1" (`docs/_pending-roadmap/identity-and-analysis.md:49-53`) which authorizes the wire-up — but Wave 3B's reviewer explicitly said the wiring "shares the same retain-or-retire fate" with `integr8/index.js` + `migration-executor.js` (`identity-and-analysis.review.md:220-223`). Question for the founder: is T1 superseding the Wave 3B deferral with new context, or is T1 the "fate decision" Wave 3B punted on? Either is defensible; clarity matters for the executor.

4. **Source-order in file vs priority-order at runtime.** The populator's register block sits between intent-seeder and mutation-log-retention (source lines 193–224 between 181–191 and 226+). This is the root cause of T3's docstring bug. Moving the block to its priority-order slot (between gap-analyzer at line 177 and intent-seeder at line 181) would prevent the same class of bug recurring when the next subscriber lands at, say, P=37. T3's brief says "cosmetic docstring corrections" — a block move is a structural change. Recommend: comment fix in T3; block move as a separate flag for a future structural pass if reviewer wants it.

5. **No test asserts INDEX_COMPLETE run-order.** Wave 2D added 21 hook-registry probes but none lock the source-tag order on INDEX_COMPLETE. A `runOrder` snapshot test (assert `r.introspectExecuteOrder(HOOKS.INDEX_COMPLETE)` deep-equals the canonical order) would have caught both the populator's docstring drift and any future priority collision. Not in T1/T3 scope but a candidate for a follow-up ticket in this same cluster.

6. **`force-checks` is registered separately via `registerForceChecks(hookRegistry)` in `main.js`, not from this file.** It is functionally a default subscriber (always wired in production) but it lives outside `registerDefaultSubscribers`. T1 should be in `registerDefaultSubscribers` (relationship-analyzer is a feature subscriber, not an integrity check), but worth noting the convention is not 100% consistent — force-checks is an exception with its own opt-out story (component doc line 181–186).
