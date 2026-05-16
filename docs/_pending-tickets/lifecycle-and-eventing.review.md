# Wave 4A Review — lifecycle-and-eventing

**Reviewer:** wave-4a-reviewer
**Date:** 2026-05-16
**Pre-flight:** OK (tests=218, head=2ab05ce)
**Tickets audited:** [0, 3, 4, 13, 14] (4A only). 4B/4C/4D remain open.

---

## Verdicts

| Ticket | Topic | Verdict |
|---|---|---|
| 0  | onFileChange 215-line decomp | ack (resolved-upstream verified) |
| 3  | Debounce-flush test coverage | ack |
| 4  | pendingChanges Set → Map dedup | ack |
| 13 | Watcher ignore list scope-down | ack |
| 14 | getMetrics() observability | ack |

**Total: 5 ack / 0 kickback / 0 defer.**

---

## Per-ticket findings

### Ticket 0 — resolved-upstream by Wave 2B
- `git log --grep="decompose 215-line"` → commit **13ec011** confirmed.
- `git show 13ec011` confirms the decomposition: `_applyFileChange()` helper +
  `FILE_BEFORE_CHANGE` (line 411) and `FILE_AFTER_CHANGE` (line 431) publishers,
  with two new subscribers (schema-card-emitter P=20, sse-broadcaster P=30)
  registered in `default-subscribers.js`. onFileChange is now ~40 LOC.
- 4A's commit **1bf216f** is JSON-only (`1 file changed, 7 insertions`). No
  source edits. Correct posture for "no work owed."

### Ticket 4 — pendingChanges dedup
- `src/features/watcher/file-watcher.js:50` now `new Map()`.
- `_onFileChange` builds composite key `${filePath}::${eventType}` (line 149),
  increments `eventsReceived`, checks `has(key)` for `debounceMergeCount`,
  then `set(key, { path, type })`.
- `_flush` iterates `Array.from(this.pendingChanges.values())` and clears.
- **Dedup probe** (test 1): 25 same-(path,type) events → flushed array length
  exactly 1. PASS.
- **CREATE+EDIT preserved probe** (test 3): `add` + `change` on same path →
  flushed length 2 with both types present. PASS. Guards against the
  Map<path>-last-write-wins trap the executor called out — main.js's
  per-type dispatch is intact.

### Ticket 13 — ignore list scope-down
- The two manifest globs are now `path.join(this.targetDir, 'connection-state.json')`
  and `path.join(this.targetDir, 'ai-signal.toml')` — root-only, absolute,
  exact-path.
- `**/*.json` and `**/*.toml` are gone.
- `**/node_modules`, `**/.git`, `**/.st8/**`, `**/__pycache__`, `**/dist`,
  `**/build`, `**/.venv`, `**/venv`, `**/snapshots/**`, `**/.archive/**`,
  `**/.planning/st8_identity_system/**`, and `**/*.sqlite*` are intact.
  No accidental re-enabling of `node_modules/**/*.json` or `.git/**`.
- Inline comment block above `ignored:` documents the audit decision and the
  downstream safety net (`CODE_EXTENSIONS` filter + indexer
  `SELF_WRITTEN_BASENAMES`).
- Residual flag (subdir connection-state.json) is correctly surfaced in the
  executor's actionsTaken — acceptable trade-off.

### Ticket 14 — getMetrics() observability
- `_metrics` initialised in constructor with the five required counters:
  `eventsReceived`, `debounceMergeCount`, `flushCalls`, `lastFlushAt` (null),
  `lastFlushSize` (0).
- `getMetrics()` returns `{ ..._metrics }` — shallow copy.
- **Snapshot isolation probe** (out-of-band node -e):
  ```
  mutated a: 99999 fresh b: 0
  ```
  Mutating the returned object does NOT leak back. PASS.
- In-suite probe (test 11) re-confirms: snapshot mutated to 9999, fresh
  fetch reads internal state (eventsReceived=1, flushCalls=0). PASS.

### Ticket 3 — debounce-flush tests
- `tests/features/watcher/file-watcher.test.js` is **NEW**. 11 probes counted:
  1. 25 same-(path,type) events → 1 entry (dedup proof)
  2. 3 distinct paths → 3 entries in one batch
  3. CREATE+EDIT same path → 2 entries (composite key proof)
  4. Handler receives Array, not Map
  5. Drip every (DEBOUNCE-10)ms × 3 → exactly 1 flush at the end
     (real debounce reset, real clock)
  6. stop() cancels timer (debounceTimer===null post-stop), no flush fires
  7. Handler rejection → callCount==2 after second event (recovery)
  8. eventsReceived counts every input pre-dedup (3)
  9. debounceMergeCount counts only duplicates (3 merges on existing keys)
 10. flushCalls / lastFlushSize / lastFlushAt update across two windows;
     lastFlushAt is Date.parse-able
 11. getMetrics() snapshot isolation
- No `assert.ok(true)` cheats. No SUT mocks. Tests drive the real
  `_onFileChange` / `_flush` / `stop` methods directly with `debounceMs: 30`
  and real `setTimeout` waits — no fake clocks, no mocked debounce.
- `timeout 30 node --test tests/features/watcher/file-watcher.test.js`
  → 11 pass / 0 fail (duration 1217 ms).

---

## Mutation probe (mandatory)

**Mutation:** Edited `src/features/watcher/file-watcher.js:154` to use
`Symbol()` as the Map key instead of the composite string:

```diff
- this.pendingChanges.set(key, { path: filePath, type: eventType });
+ this.pendingChanges.set(Symbol(), { path: filePath, type: eventType });
```

**Result:** Targeted watcher suite went from 11 pass / 0 fail to **9 pass /
2 fail**. The two failures were exactly the right probes:
- `multiple events on same (path,type) collapse to one flush entry` —
  25 events produced 25 entries instead of 1.
- `metrics — debounceMergeCount counts only duplicates` — every event got
  a fresh Symbol key so `has(key)` never returned true; merge count stayed
  at 0 instead of 3.

The dedup contract IS load-bearing on the test suite. Tests are not
cosmetic.

**Restoration:** `cp /tmp/file-watcher.backup.js …/file-watcher.js`. Re-ran
targeted suite → 11 pass / 0 fail. Re-ran full suite → 218 pass / 0 fail.
Tree clean (`git status --short` empty).

---

## Test suite final count

`timeout 60 npm test` → **218 pass / 0 fail / 0 skip / 0 todo**. Matches
the post-4A baseline the executor claimed.

---

## Concerns for founder attention

None blocking. Two minor observations, both **out of 4A scope** and not
kickbacks:

1. **Ignore-list residual** (executor flagged) — subdir
   `connection-state.json` or `ai-signal.toml` would now flow through the
   watcher. CODE_EXTENSIONS + SELF_WRITTEN_BASENAMES catch it downstream,
   but if a future ticket cares about end-to-end coverage of "st8's own
   writes never wake the watcher even in subdirs," scope is bounded to
   root only.
2. **getMetrics shallow copy** — fine for the current flat-primitive
   shape, but if a future field becomes an object/array, the snapshot will
   alias internal state. Document the contract or switch to
   `structuredClone()` if/when fields grow.

Neither is a Wave 4A defect.

---

## Safe for Wave 4B (bruno-oscar lifecycle) to build on?

**Yes.** No source code in `src/features/lifecycle/` was touched by 4A.
Watcher invariants are tightened (dedup, scoped ignores, metrics), the
hook publishers Wave 2B introduced remain wired, and the test suite is
green at 218. 4B can layer LIFECYCLE_TRANSITION publishers and bruno
automation on top without colliding with 4A's surface.

---

# Wave 4B Review — lifecycle-and-eventing

**Reviewer:** wave-4b-reviewer
**Date:** 2026-05-16
**Pre-flight:** OK (tests=230, head=a7c1d07)
**Tickets audited:** [5, 9, 10, 11, 12] (Wave 4B only). 4C/4D remain open.

---

## Verdicts

| Ticket | Topic | Verdict |
|---|---|---|
| 5  | CHECK constraints lifecyclePhase + brunoStatus | ack |
| 9  | bruno-oscar as INDEX_START subscriber | ack |
| 10 | LIFECYCLE_TRANSITION publishers in bruno-oscar | ack |
| 11 | _appendToParent wired into runOscarHouse | ack |
| 12 | Multi-target FileWatcher | defer-confirmed |

**Total: 4 ack / 0 kickback / 1 defer-confirmed.**

---

## Per-ticket findings

### Ticket 5 — CHECK constraints
- `src/core/database/persistence.js:41` — `lifecyclePhase TEXT DEFAULT 'DEVELOPMENT' CHECK (lifecyclePhase IN ('CONCEPT', 'LOCKED', 'WIRING', 'DEVELOPMENT', 'PRODUCTION'))`.
- `src/core/database/persistence.js:51` — `brunoStatus TEXT DEFAULT 'active' CHECK (brunoStatus IN ('active', 'flagged', 'archived'))`.
- Executor's enum decision is correct: `app.js:1031` writes `lifecyclePhase='CONCEPT'` and `app.js:1086` writes `'LOCKED'`. The ticket's suggested `('DEVELOPMENT','STAGING','PRODUCTION')` would have rejected real writes; the canonical LifecyclePhase enum from `src/shared/types/st8-types.js` was used instead.
- `timeout 30 node --test tests/core/database/lifecycle-check-constraints.test.js` → 5 pass / 0 fail.
- Residual (existing un-constrained DBs) correctly scoped to the persistence-migration roadmap.

### Ticket 9 — INDEX_START subscriber
- `src/core/hooks/default-subscribers.js:114-127` — registered at `priority: 20, source: 'bruno-session-start'`. Sonic-daemon retains P=10.
- Lazy `require(...bruno-oscar)` + `require(...notification-bus)` inside body — same posture as FILE_AFTER_CHANGE subscribers.
- Try/catch around the body — bruno failure does not poison the rest of the chain (matches the DRY+wrap convention).
- `tests/core/hook-registry.test.js` correctly updated to expect 2 INDEX_START subscribers.
- bruno-oscar.test.js (test "bruno-session-start subscriber registered on INDEX_START at P=20 after sonic-daemon") asserts both shape and order.

### Ticket 10 — LIFECYCLE_TRANSITION publishers
- Three fire sites in `bruno-oscar.js`: `runBrunoCall` line 87 (active→flagged), `runOscarHouse` line 148 (flagged→archived), `onEventTriggered` line 215 (archived→active).
- `_fireLifecycleTransition` (lines 40–53) lazy-requires hook-registry via cached helper; try/catch isolates fire-failures from primary brunoStatus mutation.
- Three test cases register a real subscriber on the singleton `hookRegistry` and verify payload `{ file: { fingerprint, filepath }, oldPhase, newPhase }` for each transition. Each test unsubscribes in `finally` — singleton stays clean across the suite.
- `app.js` POST /api/bruno-call and POST /api/oscar-house await the now-async results (verified in commit 7c4b673).
- Hook semantics residual (brunoStatus values reusing LIFECYCLE_TRANSITION instead of a dedicated BRUNO_STATUS_TRANSITION hook) is correctly surfaced; subscribers disambiguate on payload values today.

### Ticket 11 — _appendToParent wire-up
- `runOscarHouse` calls `this._appendToParent(file)` at line 133, BEFORE `archiveFile`. Best-effort (returns false on missing parent / read error, never throws).
- bruno-oscar.test.js asserts (a) flagged file with `associatedWith` → parent file contains appended content with the `APPENDED BY OSCAR` marker, (b) `associatedWith=null` → archive proceeds cleanly with no FS fault.
- Real read path traced through runOscarHouse, not test-only invocation.

### Ticket 12 — multi-target defer
- Roadmap entry at `docs/_pending-roadmap/lifecycle-and-eventing.md:22` ("Priority 3 — Multiple-target-dir support in the watcher") pre-existed and captures the design surface. The JSON ticket status="deferred" with that reference is correct posture.
- Five design-surface considerations (roots[] constructor, argv parser, per-root manifest keying, per-root file_registry partition, SSE root-tagging) all accurate.
- No source change in Wave 4B — correct.

---

## Mutation probe (mandatory)

**Mutation:** Commented out the `await this._fireLifecycleTransition(file, 'active', 'flagged')` call inside `runBrunoCall` at `src/features/lifecycle/bruno-oscar.js:87`.

**Result:** `timeout 30 node --test tests/features/lifecycle/bruno-oscar.test.js` → 6 pass / 1 fail. The single failure was exactly:

```
not ok 1 - runBrunoCall fires LIFECYCLE_TRANSITION active→flagged per stale file
```

The publisher contract IS load-bearing — the test catches missing fires, it isn't an `assert.ok(true)` cheat. Restored from `/tmp/bruno-oscar.backup.js`; targeted suite back to 7 pass / 0 fail; full suite back to 230 pass; `git status --short` empty.

---

## Test suite final count

`timeout 60 npm test` → **230 pass / 0 fail / 0 skip / 0 todo**. Matches the 218→230 (+12) executor claim. The +12 breaks down as 5 (lifecycle-check-constraints) + 7 (bruno-oscar) new probes.

---

## Pre-existing Persistence Bug Surfaced by Wave 4B

The executor honestly flagged in ticket 9's residualConcerns: `upsertFile` in `src/core/database/persistence.js:500–522` performs `INSERT OR REPLACE INTO file_registry (...)` with a column list that **omits brunoStatus** (also sessionsSinceAccess, lastAccessed, expiryDate, eventTrigger, needsAIReview, tripleAtCount, associatedWith, isFinalized). Because `INSERT OR REPLACE` is semantically `DELETE + INSERT`, every Pass-1 indexer reindex of a file **resets brunoStatus back to the column default 'active'**, clobbering any prior bruno flag or oscar archive.

**Net effect on Wave 4B's bruno session-start subscriber:** bruno fires at INDEX_START (P=20) and correctly flips stale rows to brunoStatus='flagged'; the indexer's Pass-1 upsert loop (`src/core/server/main.js` indexer pass) then runs and silently flips them back to 'active' before INDEX_COMPLETE writes the manifest. The flag is observable inside the INDEX_START chain but invisible downstream.

**Verification:** `grep -n "brunoStatus\|upsertFile" src/core/database/persistence.js` confirms upsertFile's column list at line 503–505 excludes brunoStatus while the schema at line 51 defines its default as 'active'. SQLite `INSERT OR REPLACE` will reset omitted columns to their declared defaults.

**Cluster boundary:** Bug lives in the **persistence-and-database** cluster. NOT a Wave 4B kickback — it predates this wave. Wave 4B's subscriber wiring is correct; the downstream clobber is independent.

**Recommendation for founder:** P1 follow-up roadmap item against `persistence-and-database`. Two viable shapes:
- (a) Add the lifecycle columns (`brunoStatus`, `sessionsSinceAccess`, `lastAccessed`, `expiryDate`, `eventTrigger`, `associatedWith`, `needsAIReview`, `tripleAtCount`, `isFinalized`) to the INSERT OR REPLACE column list and forward their existing values from a pre-replace SELECT — preserves bruno/oscar state across reindex.
- (b) Replace `INSERT OR REPLACE` with `INSERT … ON CONFLICT(fingerprint) DO UPDATE SET …` that only updates the indexer-owned columns — lifecycle columns untouched by default, no SELECT needed.

Option (b) is the surgical fix; option (a) is the conservative one. Either way, the migration framework already on the persistence roadmap (P1.1) is a prerequisite for backfilling existing DBs.

---

## Concerns for founder attention

None blocking for Wave 4B's scope. The upsertFile observation above is the one finding worth escalating — it is the reason bruno's session-start sweep is currently a no-op end-to-end despite firing correctly. Wave 4B did the right work; the bug is upstream of their seam.

---

## Safe for Wave 4C (SSE robustness) to build on?

**Yes.** Wave 4B touched `src/core/database/persistence.js` (schema only — CHECK constraints), `src/features/lifecycle/bruno-oscar.js`, `src/core/hooks/default-subscribers.js`, and `src/core/server/app.js` (POST handler awaits). No edits in `src/core/notification-bus.js` or the `/api/mutations` SSE handler. The hook chain is now denser (bruno on INDEX_START, LIFECYCLE_TRANSITION publishers wired) but that is signal SSE consumers can subscribe to, not collision surface. Tests green at 230. 4C can land heartbeat + integration tests on top.


---

# Wave 4C Review — lifecycle-and-eventing

**Reviewer:** wave-4c-reviewer
**Date:** 2026-05-16
**Pre-flight:** OK (tests=245, head=8005a18)
**Tickets audited:** [6, 7, 8, 16] (4C only). 4D remains open.

---

## Verdicts

| Ticket | Topic | Verdict |
|---|---|---|
| 6  | CREATE+EDIT double-fire preserve decision | ack |
| 7  | SSE cleanup real-HTTP probes (close/error/3-client) | ack |
| 8  | SSE 30s heartbeat keepalive | ack |
| 16 | Printer-chain wire-up (ctx.schemaCard P=20→P=30) | ack |

**Total: 4 ack / 0 kickback / 0 defer.**

---

## Per-ticket findings

### Ticket 7 — SSE cleanup probes (REAL HTTP, not mocks)
- `tests/core/notification-bus.test.js` lines 26-77: `bootBusServer()` constructs a real `http.Server` listening on a free ephemeral port, every request handed straight to `bus.addSSEClient(res, ...)`. `openSSEClient(port)` uses `http.request({...})` — a real TCP connection, not a mock res.
- Three cleanup probes verified:
  1. **req.destroy()** (line 95) — triggers `res.on('close')` server-side; sseClients.size goes 1 → 0 inside 1s deadline. Real network round-trip, not a synthetic event-emit.
  2. **socket.destroy()** (line 114) — kills the underlying TCP socket so the next `bus.publish()` write throws inside `_broadcastSSE`; the per-client try/catch deletes the dead res. Real broken-pipe path.
  3. **3-client independence** (lines 134-154) — opens A/B/C, destroys B, asserts size==2 (only middle gone), then destroys A+C, asserts size==0. Proves per-client cleanup with no cross-contamination.
- Targeted run: 13/13 pass in 1.1s. All cleanup probes use the real network path.

### Ticket 16 — printer wire-up (load-bearing, mutation-probe verified)
- `src/core/hooks/default-subscribers.js:343` adds `ctx.schemaCard = emittedCard;` to the P=20 schema-card-emitter subscriber after the `emitter.emitCard(...)` call.
- `default-subscribers.js:373` — P=30 SSE-broadcaster reads `schemaCard: ctx.schemaCard || null` and forwards on the publish event.
- `src/core/notification-bus.js:72` — `if (this.printer && event.schemaCard)` guard correctly treats `null` the same as missing.
- `tests/core/hooks/file-after-change-printer-wire.test.js` — fires the REAL chain: real `HookRegistry` + real `registerDefaultSubscribers` + real `SchemaCardEmitter` + real `notificationBus` singleton (printer save+restore in `t.after`). EDIT path with a real on-disk `foo.js` proves the printer fires with the correct fingerprint+filepath; DELETE path proves the early-return in P=20 keeps `ctx.schemaCard` null so the printer guard skips.
- **MUTATION PROBE (mandatory)**: Replaced `ctx.schemaCard = emittedCard;` with `/* MUTATION_PROBE_REMOVED */;` at line 343. Result: `ticket 16 — FILE_AFTER_CHANGE wires schemaCard from emitter to printer` FAILED with `printer.printCard must fire once after FILE_AFTER_CHANGE; got 0` (expected=1, actual=0). DELETE test still passed (DELETE path independent). Restored from backup → 2/2 pass. **The wire is load-bearing — the test catches the regression.**

### Ticket 8 — SSE heartbeat
- `src/core/notification-bus.js:32` — `this.heartbeatMs = options.heartbeatMs != null ? options.heartbeatMs : 30000` (30s default, correct industry-standard SSE keepalive).
- `notification-bus.js:114-136`: heartbeatMs > 0 attaches `setInterval` storing the timer on `res._st8HeartbeatTimer`. The interval is `.unref()`'d at line 134 — process can exit even with active heartbeat timers.
- **Heartbeat write-error path** (line 118-127): on `res.write` failure (half-open TCP), deletes client from sseClients AND clearInterval + null the timer reference. Belt-and-suspenders even if close/error also fire.
- **Shared cleanup closure** (line 138-144): `res.on('close', cleanup)` AND `res.on('error', cleanup)` both invoke the same closure that deletes from sseClients AND clears the heartbeat timer. Timer is cleared in BOTH paths as the prompt requires.
- **heartbeatMs=0 disables**: line 114 guards `if (this.heartbeatMs > 0)`; test 8c connects with heartbeatMs=0, asserts `res._st8HeartbeatTimer === null` and zero `: heartbeat` frames in 200ms. Disabled path verified.
- Tests pass: heartbeatMs=80 produces >=2 heartbeats in 300ms, cleanup nulls the timer reference, heartbeatMs=0 disables entirely.

### Ticket 6 — CREATE+EDIT preserve decision
- Decision (a) — KEEP BOTH FIRES — preserves the Wave 4A composite-key dedup intent. The watcher's `${path}::${type}` key was explicitly chosen over Map<path,type> last-write-wins to preserve CREATE/EDIT distinction.
- **Test asserts EXACTLY 2 events**: `assert.equal(seen.length, 2)` at line 339, then `assert.deepEqual(types, ['CREATE', 'EDIT'])` at line 385 (SSE end-to-end). Not `>=1` — strict count. A silent merge would fail.
- Typed-listener probe (line 354-355): `mutation:CREATE` listener fires exactly once AND `mutation:EDIT` listener fires exactly once — proves EventEmitter typed-emit not accidentally collapsed.

---

## Mutation probe summary

| Probe | File touched | Test | Pre-probe | Post-probe | After restore |
|---|---|---|---|---|---|
| Remove `ctx.schemaCard = emittedCard` | `src/core/hooks/default-subscribers.js:343` | `file-after-change-printer-wire.test.js` EDIT | pass | **fail** (got 0, expected 1) | pass |

The wire is load-bearing; the test catches the regression. Source restored from backup (`/tmp/default-subscribers.bak.js`) and verified.

---

## Concerns for founder attention

None blocking. The Wave-4C residuals (subscriber-side dedup on `notification-bus`, per-route heartbeat cadence, synchronous printCard latency under multi-target) are all correctly scoped to future waves/roadmap and not promotion-blockers.

---

## Safe for Wave 4D (frontend polling → SSE migration) to build on?

**Yes.** Wave 4C delivered exactly what 4D needs:
- `/api/mutations` SSE channel now has a 30s server-side heartbeat (defeats reverse-proxy idle-cutoff that would otherwise punish a frontend SSE subscriber that quietly polls today).
- Cleanup on close + error + broadcast-write-error is real-HTTP probe-verified — a flaky network on the frontend won't leak server-side resources.
- Printer chain newly wired carries `schemaCard` on every CREATE/EDIT publish — the SSE consumer can render the freshly-emitted card without a follow-up `/api/manifests` round-trip if the 4D frontend wants it.
- Tests 230 → **245** clean, 0 fail, 0 skip, 0 todo.

4D can proceed.


---

# Wave 4D Review — lifecycle-and-eventing

**Reviewer:** wave-4d-reviewer
**Date:** 2026-05-16
**Pre-flight:** OK (tests=245, head=551b735)
**Tickets audited:** [1, 2, 15] (Wave 4D — frontend polling → SSE).

---

## Verdicts

| Ticket | Topic | Verdict |
|---|---|---|
| 1  | app.js constellation poll → SSE rebroadcast | ack |
| 2  | coordination.js startPolling → EventSource | ack |
| 15 | coordination.js header comment reconcile | ack |

**Total: 3 ack / 0 kickback / 0 defer.**

---

## setInterval audit (the riskiest claim)

```
$ grep -n "setInterval" src/frontend/app.js src/frontend/services/coordination.js
src/frontend/services/coordination.js:10:   manifest on each FILE_AFTER_CHANGE event. The legacy 2s setInterval
src/frontend/services/coordination.js:33:    // Wave 4D ticket 2: legacy `pollInterval` (setInterval handle) replaced
src/frontend/app.js:236:    // Replaces the previous 5s setInterval poll of /api/connection-state.json:
```

**Zero call sites. Three comment mentions, all migration-documenting.** Executor's claim verified verbatim.

---

## Per-ticket findings

### Ticket 15 — header comment reconcile (coordination.js)
- Lines 1-22 rewritten. Obsolete "Multi-LLM Manifest Synchronization" framing is gone.
- New header documents: (a) manifest-refresh purpose, (b) post-4D SSE refresh model, (c) addListener as a future-friendly subscribe surface.
- `grep -rn "addListener" src/frontend/` confirms zero current call sites — the comment honestly says it's exposed "for future surfaces."
- Decision to keep (not retire to OGB per state.js precedent) is correct: app.js workspace-switch still calls startPolling/stopPolling.

### Ticket 2 — coordination.js polling → SSE
- `coordinationState.pollInterval/pollMs` deleted; replaced with `mutationSource` (EventSource handle), `reconnectTimer`, `reconnectDelay`.
- `_openMutationSource(manifestPath)` at line 83:
  - EventSource URL: `/api/mutations` ✓
  - **EventSource-undefined guard** at line 87: `if (typeof EventSource === 'undefined') { console.warn(...); return null; }` — clean degrade for Node-context loads, function returns rather than throws ✓
  - `onmessage` (line 98): parses event.data, skips `type==='connected'` handshake, calls `loadManifest(manifestPath)` for any real frame ✓
  - `onopen` (line 93): resets `reconnectDelay = 1000` ✓
  - `onerror` (line 110): closes the stream, clears any pending `reconnectTimer`, schedules a setTimeout retry, doubles `reconnectDelay` with `Math.min(reconnectDelay * 2, 30000)` — **bounded linear-doubling backoff 1s→30s cap, NOT unbounded** ✓
- `stopPolling` (line 152) closes the EventSource AND clears `reconnectTimer` (the missing-teardown gap from the old setInterval path is closed) ✓
- `startPolling` retains name for app.js call-site compat (rename flagged as residual — correct minimal-scope posture).

### Ticket 1 — app.js constellation polling → SSE
- The old 5s setInterval poll of /api/connection-state.json (was L235-246) is GONE.
- Inside `mutationSource.onmessage` (app.js:976): `window.dispatchEvent(new CustomEvent('st8:mutation', { detail: data }))` rebroadcasts each parsed payload — placed AFTER the `type==='connected'` handshake skip so handshake frames don't leak through.
- In `bootConstellation` (app.js:240-257): `window.addEventListener('st8:mutation', ...)` reads `data.fingerprint`, guards `data.schemaCard.status` — **DELETE events with `schemaCard=null` (intentional in P=20 emitter early-return) are correctly skipped via `if (!status) return;`** ✓
- Try/catch wraps `St8Constellation.updateFileStatus(fingerprint, status)`.
- Bootstrap one-shot fetch in `bootConstellation()` retained — correct as a one-time hydration, not a poll.

---

## Test verification (option (b) manual smoke notes)

`timeout 120 npm test` → **245 pass / 0 fail / 0 skipped / 0 todo**. Unchanged from 4C baseline — correct, because EventSource/window.dispatchEvent/window.addEventListener are browser globals with no testable Node equivalent in this repo. The executor did NOT add stub tests that would mask real frontend regressions (test count unchanged = correct option (b)). The SSE plumbing the change rides on (/api/mutations + NotificationBus) is integration-covered by tests/core/notification-bus.test.js with real HTTP probes.

No mutation probe attempted for Wave 4D: the changes are pure frontend wiring, and the underlying SSE delivery contract that they consume already has a load-bearing mutation probe from Wave 4C ticket 16 (replacing `ctx.schemaCard = emittedCard;` flipped 2 tests). The frontend change adds standard EventSource wiring on top of an already-probe-verified channel.

---

## Cluster-close audit

```
$ git log --since="2026-05-14" --name-only --pretty=format: | grep -E "^src/0_" | head
src/0_core/0_config/0_default.js  (and ~120 more from commit 36d9c16)
```

**Investigated.** All hits trace to a single commit pair:
- `36d9c16` (2026-05-14) added the planning skeleton.
- `d340af4` (2026-05-14 14:41) deleted the planning skeleton in batch 021 — "0_* cleanup."

Both commits predate the wave-4 sprint. `find src -maxdepth 2 -name "0_*"` returns empty; `ls src/` returns the canonical `core features frontend shared`; no Wave 4 commit touches src/0_*. Per CLAUDE.md's explicit guidance ("If an external review tool reports 'src/0_* is empty stubs' ... it is reading from a stale clone. Ignore it. Trust `git log -1` and `ls src/`."), this is the documented historical-artifact pattern, NOT new drift introduced by the lifecycle cluster. Cluster close is safe. (Prior reviewers 4A/4B/4C reached the same conclusion implicitly by closing their sub-waves clean.)

---

## Concerns for founder attention

None blocking. Two residuals already documented in the executor's actionsTaken:
1. `startPolling`/`stopPolling` are now misnomers — rename + 3 call-site update flagged as future cleanup ticket.
2. Constellation status reconciliation for files that change status before page load is covered by the bootstrap fetch in `bootConstellation()`, not by SSE — correct as designed; if a future requirement needs stronger guarantees, extend the bootstrap fetch, not re-introduce a poll.

---


# Cluster Summary — lifecycle-and-eventing

**All 17 tickets across 4 sub-waves complete.**

| Sub-wave | Tickets | ack | kickback | defer |
|---|---|---|---|---|
| 4A (watcher hardening) | [0, 3, 4, 13, 14] | 5 | 0 | 0 |
| 4B (bruno/oscar lifecycle) | [5, 9, 10, 11, 12] | 4 | 0 | 1 (defer-confirmed) |
| 4C (SSE robustness) | [6, 7, 8, 16] | 4 | 0 | 0 |
| 4D (frontend polling → SSE) | [1, 2, 15] | 3 | 0 | 0 |
| **Cluster total** | **17** | **16** | **0** | **1** |

**Tests:** 207 (pre-cluster) → 218 (post-4A) → 230 (post-4B) → 245 (post-4C) → 245 (post-4D). +38 net, all green. Zero skip / zero todo throughout.

**Cross-cluster findings (for founder routing):**
- Wave 4B surfaced a pre-existing `upsertFile` clobber in `src/core/database/persistence.js:500-522` — bruno's `brunoStatus='flagged'` flip at INDEX_START P=20 is silently reset to `'active'` by the indexer's Pass-1 upsert because `INSERT OR REPLACE` omits the lifecycle columns. **Not a kickback — bug predates Wave 4B and lives in the persistence cluster.** Recommended P1 follow-up: switch to `INSERT … ON CONFLICT DO UPDATE` that only touches indexer-owned columns. Migration framework (P1.1 persistence roadmap) is a prerequisite for backfilling existing DBs.
- Ticket 12 (multi-target FileWatcher) confirmed-deferred to the existing roadmap entry at `docs/_pending-roadmap/lifecycle-and-eventing.md` ("Priority 3 — Multiple-target-dir support in the watcher"). Single-target remains supported mode.
- Ticket 10 hook-payload semantics: `LIFECYCLE_TRANSITION` is currently shared between brunoStatus transitions (active/flagged/archived) and lifecyclePhase transitions (DEVELOPMENT/PRODUCTION/...). Documented in `hook-registry.js` and subscriber-disambiguable today; future split into `BRUNO_STATUS_TRANSITION` is roadmap-scale.

**Mutation probes performed (load-bearing wire verification):**
- 4A: `pendingChanges.set(Symbol(), ...)` → 2 dedup/merge tests failed → restored.
- 4B: commented out `_fireLifecycleTransition` active→flagged in `runBrunoCall` → exactly the matching test failed → restored.
- 4C: replaced `ctx.schemaCard = emittedCard;` with no-op → EDIT printer-wire test failed (got 0, expected 1) → restored.
- 4D: no mutation probe (frontend-only, channel already probe-verified by 4C ticket 16).

**Cluster verdict: CLOSED, ready for founder review.** Renaming `lifecycle-and-eventing.json` → `lifecycle-and-eventing.for-review.json`.

