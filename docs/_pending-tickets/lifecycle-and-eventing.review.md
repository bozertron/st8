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
