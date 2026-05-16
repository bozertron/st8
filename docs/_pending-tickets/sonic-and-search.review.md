# Sonic-and-Search Review

## Wave 5A Review

**Reviewer:** wave-5a-reviewer
**Wave 5A executor commits audited:** 4fea31f, 07e3c4d, 8d4bce7, 76f2dca, 4154b85, 86218e1 (six tickets: 0, 1, 2, 4, 8, 9)
**Pre-flight:** PRE-FLIGHT OK (tests=261, head=a26ce39)
**Verdicts:** 6 ack / 0 kickback

### Per-ticket verdicts

| Ticket | Subject | Verdict | Probe |
|---|---|---|---|
| 0 | Broken requires in background-indexer | ack | `node -e "require('background-indexer')"` → LOAD OK |
| 1 | Annotate graph-persister require in sonic-indexer | ack | Read commit; informative, no behavior change |
| 2 | Annotate SQLite fallback in sonic-queries | ack | Read commit; JSDoc lists all 6 method pairs |
| 4 | Move chmod to module-init, idempotent | ack | `ls -la docs/Sonic/sonic` → -rwxr-xr-x preserved |
| 8 | validateSonicConfig() at boot | ack | Targeted test → 9 pass / 0 fail |
| 9 | Per-instance sonic.password | ack | Targeted test → 7 pass / 0 fail; mutation probe confirmed teeth |

### Honest-dormancy audit (ticket 0)

Executor placed the MAESTRO stubs **inline as IIFEs inside background-indexer.js** (not as separate modules — the prompt anticipated separate files, but inline is acceptable and arguably better because the dormancy is co-located with its sole consumer).

Verified all three honest-dormancy criteria:

- **Warn-once on first invocation, not on require.** Each IIFE captures a closure-scoped `warned` flag; warn fires inside the factory method (`getMultiPassAnalyzer` / `createCaptureManager`), not at module load.
- **Returns safe shapes, not throws.** `getMultiPassAnalyzer()` returns `{ runAllPasses: async () => ({ passes:[], insightsAdded:0, ported:false }) }`. `createCaptureManager()` returns `{ beginSession(){}, endSession(){} }`. The `ported:false` discriminator is a nice touch — future callers can detect dormancy programmatically.
- **Clear provenance comment** referencing Wave 5A ticket 0, docs/_pending-roadmap/sonic-and-search.md, and docs/components/sonic-and-search.md § 6.

No silent fake success. Honest dormancy passes.

### Per-instance password mutation probe (ticket 9)

Replaced `setPassword` body with `return;` (no-op) in src/features/search/sonic-client.js. Re-ran `node --test tests/features/search/sonic-password.test.js` → 6 pass / 1 fail (the "updates all three channels" test fired). Restored the original implementation; full suite back to 261/0/0/0. Tests provide real coverage, not snapshot smoke.

### Other independent probes

- File-mode probe: ran `ensureSonicPassword('/tmp/...')`. Returned 64 hex chars (`/^[0-9a-f]{64}$/`); on-disk `.st8/sonic.password` is mode 0600.
- background-indexer load probe: required the module from a one-shot node invocation. No throw; "LOAD OK" printed.
- sonic.cfg port-parse: validateSonicConfig correctly distinguishes config_missing_inet / config_inet_unparseable / config_port_mismatch — the test suite hits each code path with synthesized cfgs.

### Wave 5A end-state

- Tests: 245 → 261 (+16: 9 for validateSonicConfig + 7 for sonic-password). Matches executor claim exactly.
- Source files touched (Wave 5A only): background-indexer.js, sonic-indexer.js, sonic-queries.js, sonic-daemon.js, sonic-client.js. Plus 2 new test files.
- No src/0_* drift. No EXPECTED_PATHS violation.

### Confidence for Wave 5B (daemon lifecycle tests)

**Safe to proceed.** The daemon module now has a solid foundation for lifecycle tests: validateSonicConfig is unit-testable in isolation, ensureSonicPassword is unit-testable in isolation, and the chmod safety net is idempotent. Open tickets remaining in the cluster — daemon lifecycle (ticket index 3), upstream-panic mitigation (5), APP_ID identity (6), Sonic store GC (7), stop() spin-wait (10) — are the natural Wave 5B/5C targets.

## Wave 5B Review

**Reviewer:** wave-5b-reviewer
**Wave 5B executor commits audited:** cfb0f2e, 8df4b9b, 8175299, 3f55bb5, dd272ed (five tickets: 6, 10, 7, 5, 3)
**Pre-flight:** PRE-FLIGHT OK (tests=271, head=0b64f05)
**Verdicts:** 5 ack / 0 kickback / 0 defer

### Per-ticket verdicts

| Ticket | Subject | Verdict | Probe |
|---|---|---|---|
| 6 | APP_ID rename to com.st8.app | ack | `grep -rn com.scaffolder.app src/` → 5 hits across 2 files, only graph-persister.js has live code at line 105, with detailed deferred-rationale at lines 84-91 |
| 10 | async stop() — drop spin-wait | ack | `grep -n 'while.*killed' src/features/search/sonic-daemon.js` → 0 matches; new stop() races child.once('exit') vs setTimeout, idempotent finish() with unref() and listener-race guard |
| 7 | Re-index GC audit | ack | `grep` against sonic-indexer.js confirms FLUSHB (line 217), FLUSHO (lines 297/303/311/317), clearProjectFromTracker (line 424). Executor correctly contradicted the userNote |
| 5 | Broken-pipe panic recovery | ack | MAX_PANIC_RESTARTS=3 (line 121), PANIC_BACKOFF_MS=[1000,5000,30000] (line 122), success-reset at lines 537-538, EPIPE matcher at sonic-client.js:457. Mutation probe confirmed teeth |
| 3 | Lifecycle tests | ack | `node --test tests/features/search/sonic-daemon-lifecycle.test.js` → 10 pass / 0 fail. All have explicit timeouts; no `assert.ok(true)` smoke |

### Anti-cheat probes

**Spin-wait grep (ticket 10):** `grep -n 'while.*killed' src/features/search/sonic-daemon.js` → no output. Spin-wait fully gone.

**Panic-cap mutation (ticket 5):** Mutated `const MAX_PANIC_RESTARTS = 3` to `999` in sonic-daemon.js, ran targeted lifecycle test:
- Test 6 (cap test) → failed (4th call no longer returned null at 999)
- Test 7 (backoff array invariant) → failed (regex match included literal "3")
- Restored file; full suite back to 271 green. Cap has real teeth.

**Ticket 7 anti-cheat:** Executor claimed userNote was wrong. I read sonic-indexer.js directly:
- Line 195 `reindexProject(projectId)` → line 211 `clearProjectFromTracker(projectId)` → line 217 `yield this.client.flush(COLLECTION, projectId)` (FLUSHB on bucket)
- Line 276 `incrementalIndex(...)` → lines 297/303/311/317 `yield this.client.flushObject(...)` (FLUSHO per-record before re-push)
- Line 424 `clearProjectFromTracker` resets session dedup set

Executor's contradiction is correct. They did NOT duck the issue — they audited, documented findings as a JSDoc block at sonic-daemon.js:53-92 with line-number citations, and added tracker-GC test coverage.

**Ticket 6 deferred-comment audit:** Read graph-persister.js:78-92. The deferred-rationale is specific: (a) InsightStore is compiled-from-TS and legacy integr8 pipeline write to `scaffolder_data.sqlite` at this path, renaming would orphan existing on-disk insight data on every developer's machine; (b) this is the database-file location, not the st8 identity. Future v2 migration path named. Not vague — accurate, well-scoped.

### Lifecycle test probe count (ticket 3)

10 tests, each with explicit timeout or synchronous-only:
1. binary_missing degrade (renames real binary)
2. adopt external listener via net.createServer on 1491 (skips if port in use)
3. stop() returns thenable, resolves <200ms when no child
4. stop() source-invariant: spin-wait regex must NOT match, child.once('exit') must match
5. start() idempotency via adopt path
6. schedulePanicRestart respects MAX_PANIC_RESTARTS cap (4th call → null)
7. backoff schedule [1000, 5000, 30000] + cap=3 source-invariant
8. SonicIndexer.clearProjectFromTracker — per-project removal preserves other-project entries
9. SonicIndexer.resetTracker — full clear
10. getStatus shape (running/port/host/restartCount/storePath)

### Wave 5B end-state

- Tests: 261 → 271 (+10). Matches executor claim exactly.
- Source files touched (Wave 5B): sonic-daemon.js, sonic-client.js, ground-plane.js, graph-persister.js. Plus 1 new test file.
- No EXPECTED_PATHS violation.

## Cluster Summary

Total: 11 tickets across Wave 5A (6) + Wave 5B (5).

| Wave | Tickets | Ack | Kickback | Defer |
|---|---|---|---|---|
| 5A | 0, 1, 2, 4, 8, 9 | 6 | 0 | 0 |
| 5B | 3, 5, 6, 7, 10 | 5 | 0 | 0 |
| **Total** | **11** | **11** | **0** | **0** |

**Test suite progression across the cluster:** 245 → 261 → 271 (+26 sonic-coverage). All green, zero skip/zero todo.

**Source files touched across the cluster:**
- src/features/indexing/background-indexer.js (ticket 0 — repaired broken requires + inert stubs)
- src/features/search/sonic-indexer.js (ticket 1 — annotation only)
- src/features/search/sonic-queries.js (ticket 2 — JSDoc only)
- src/features/search/sonic-daemon.js (tickets 4, 5, 7, 8, 9, 10 — chmod, panic recovery, audit, validateConfig, password, async stop)
- src/features/search/sonic-client.js (tickets 5, 9 — EPIPE matcher, setPassword)
- src/shared/utils/ground-plane.js (ticket 6 — APP_ID rename to com.st8.app)
- src/core/database/graph-persister.js (ticket 6 — deferred-rationale comment)
- tests/features/search/sonic-password.test.js (new, ticket 9)
- tests/features/search/sonic-daemon-lifecycle.test.js (new, ticket 3)
- tests/features/search/sonic-config.test.js (new, ticket 8)

**Cluster-close audit note:** `git log master..HEAD --name-only --pretty=format: | grep -E "^src/0_"` returns the d340af4 cleanup commit (delete of 103 0_* skeleton files). This commit removes drift introduced by master's 36d9c16; the working tree has ZERO 0_* files (`ls src/` → core features frontend shared; `find src -maxdepth 3 -name "0_*"` → empty). Wave 4D closed under the same condition (per d080bd7 → 84fa97c). Audit's intent (no NEW drift introduced by sprint) is satisfied. Not a real drift.

**Cluster ready to close:** YES. All 11 tickets ack, no kickbacks, no deferrals, 271 tests green, no 0_* files in working tree.
