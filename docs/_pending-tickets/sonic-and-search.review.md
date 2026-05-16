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
