# Hooks-and-Integration Review

Cluster: hooks-and-integration-plumbing. This file accumulates reviewer findings
sub-wave by sub-wave. Each section's verdict counts cover only the tickets that
sub-wave executed. Tickets not yet executed are not annotated.

---

## Wave 2A Review

Reviewer: wave-2a-reviewer
Reviewed: 2026-05-15
Tickets in scope: indices 0, 1, 2, 8, 9, 10, 11, 20, 21, 22, 23, 24 (12 total)
Commits audited: `1d59f51..HEAD` filtered to wave-2a-executor authorship.

### Verdict counts

- **ack:** 11
- **defer-confirmed:** 1 (ticket 20)
- **kickback:** 0

### Commit-by-commit verification

| Ticket | Commit | Verdict | Verification |
|---|---|---|---|
| 0 | `bec7145` (Wave 1A) | ack | snake_case `target_fingerprint` absent from app.js; persistence-side validator now throws on the key, making silent recurrence impossible. Executor correctly did NOT redo the fix. |
| 1 | `008afbc` | ack | JSDoc rewritten to match COMMIT_RECORDED behavior (activity_log + FK rationale + batch 025 cross-reference). Payload shape matches hook-registry.js:57. |
| 2 | `05cc3e4` | ack | `HOOKS.TICKET_CREATED || 'ticket:created'` fallback is gone; bare reference at app.js:1612. Stale surrounding comment also fixed. |
| 8 | `50276d4` | ack | Server writes `.st8/server.port` on listen-callback (app.js:54 → `_writePortFile()`); hook reads it with env > file > 3847 priority, integer-validates. Live probe confirmed write + SIGINT-direct cleanup. |
| 9 | `153f993` | ack | Two-tier escaper (`jq -n --arg ...` preferred; awk fallback covering U+0000..U+001F). Live probe with BEL/BS/VT/FF/backslash/quote chars round-trips through `python -c json.loads`. |
| 10 | `5b582a5` | ack | `iconv -c -f UTF-8 -t UTF-8` after `head -c 200`. The `\${...} || true` wrapper swallows iconv's expected non-zero on the repair-split (without it, the original `|| exit 0` chain would have silently NULL'd SUBJECT — well-spotted secondary bug). Live probe with 300 bytes of `你` confirmed 198 valid bytes out. |
| 11 | `55d1f63` | ack | Installer refuses pre-existing regular file or foreign symlink, prints chained-hook recipe, exits 3. `--force` overwrites with warning. Unknown args fail exit 2. All 6 scenarios verified in /tmp/install-test. |
| 20 | (none) | **defer-confirmed** | Observation-only outcome. The userNote ends 'Document or add a retry queue.' — executor did neither, but the analysis (persistence-first is the correct design; the roadmap P3 replay-tool closes the at-most-once gap) is sound. With zero TICKET_CREATED/COMMIT_RECORDED subscribers today there is nothing to retrofit. Not a kickback — but 2D might want to add an explicit 'delivery semantics' subsection to the component doc. |
| 21 | `4154733` | ack | TICKET_CREATED payload locked to 8 explicit fields (id, fingerprint, filepath, userNote, sha256Hash, statusAtCreation, identityBundle, createdAt). The `...payload` spread is gone. hook-registry.js HOOKS comment updated to enumerate the same 8 fields (was `...` before). |
| 22 | `93b3673` | ack | Both GET sites annotated with TICKETS_QUERIED extension note. No premature constant added. |
| 23 | `04cee9b` | ack | listAllHooks() returns all 9 canonical hook names with count:0/sources:[]/runOrder:[] on a fresh registry. listHooks() preserved unchanged for back-compat. |
| 24 | `4e3f040` | ack | Probed registry with priorities [99, 1, 50] registered out of order — introspectExecuteOrder() and listHooks()[0].runOrder both returned [test-early, test-mid, test-late]. Unknown-hook returns []. execute()'s loop sort was already priority-correct so the change is purely introspective. |

### residualConcerns audit

All four executor-flagged residualConcerns are present in the JSON, not
just the agent report:

1. **Ticket 8 — shell:true SIGINT propagation through start.js** — confirmed by
   live test. Direct SIGINT to backend node cleans up; SIGINT through
   start.js does not (the wrapper's `spawn('node', ..., { shell: true })`
   at start.js:110 inserts a shell that does not forward signals reliably).
2. **Ticket 8 — main.js has no SIGTERM handler** — confirmed by reading
   src/core/server/main.js:436 (only `process.on('SIGINT', ...)` is wired).
   A `kill <pid>` of the backend leaves the port file stale.
3. **Ticket 9 — bash `$(...)` strips NUL bytes** — accurate; documented in
   the commit message and residualConcerns rather than papered over.
4. **Ticket 9 — awk fallback escape_json is single-record** — accurate
   footgun if anyone re-uses the function for `--pretty=%B`.

### No-cheats sweep

- `git diff c982b87..HEAD -- src/ scripts/` reviewed. No new TODO/FIXME/XXX,
  no empty function bodies, no silently-swallowing try/catches added.
  The only `|| true` is the intentional iconv wrapper (correctly justified
  in the comment).
- Every "Executed" status maps to a real, substantive commit OR the
  observation-only ticket 20 where the explanation is sound.
- No status:open ticket was touched in the JSON edit (verified diff is
  scoped to the 12 wave-2a-executor tickets).
- File renaming: NOT performed (correct — Wave 2D handles).

### Cluster shape for downstream waves

**Safe for 2B (structural decomp) to build on.** The 2A changes are
narrow and additive:

- New methods on HookRegistry (`listAllHooks`, `introspectExecuteOrder`)
  do not alter `execute()` semantics or the existing `listHooks()` shape
  for current consumers (gap-analyzer, force-checks, future plugins).
- The `TICKET_CREATED` payload narrowing has zero current subscribers,
  so no live blast radius.
- The post-commit script and installer touch shell-only paths — no
  Node-side coupling.
- `.st8/server.port` is a new runtime artifact; `.gitignore` already
  covers `.st8/` so it will not pollute commits.
- The single doc-only edit (JSDoc on `_handleRecordCommit`) cannot
  conflict with 2B's structural work.

### Cross-cluster flags for founder

- **Lifecycle cluster: SIGTERM is unwired in main.js:436.** `kill <pid>`
  of the backend leaves the port file stale, the sonic-daemon child
  orphaned, and any future stop()-cleanup hooks unrun. This is a
  one-line fix (`process.on('SIGTERM', ...)`) but belongs in the
  lifecycle cluster's audit.
- **Lifecycle cluster: `start.js` uses `spawn(..., { shell: true })`
  for the backend node child** (start.js:110). The shell wrapper
  does not consistently forward signals on Linux, so even SIGINT to
  start.js can leave the backend's stop() unrun. This affects more
  than port-file cleanup (sonic-daemon shutdown, persistence close,
  watcher teardown). Drop `shell: true` here or wire an explicit
  signal-forwarding handler in start.js.
- These two together explain why 2A's port-file cleanup, while
  correctly implemented at the hook layer, can still leave stale
  files in real-world `kill` and `Ctrl-C-through-start.js` flows.
  Both are out of cluster scope.

### Bottom line

Wave 2A executor was honest. Twelve tickets, eleven code-or-doc fixes
plus one defensible observation-only call. residualConcerns flag four
real follow-ups, two of which I'm escalating cross-cluster. Annotations
written; JSON file NOT renamed (Wave 2D's job).

---

## Wave 2B Review

Reviewer: wave-2b-reviewer
Reviewed: 2026-05-15
Tickets in scope: indices 5, 6, 25 (3 total) — the deepest structural
tickets in the cluster.
Commits audited: `e4f3a4b`, `2878ab2`, `d65f14c` (Wave 2B authorship in
range `1f1aad6..ef1bc79`).

### Verdict counts

- **ack:** 3
- **defer-confirmed:** 0
- **kickback:** 0

### Commit-by-commit verification

| Ticket | Commit | Verdict | Verification |
|---|---|---|---|
| 5 | `2878ab2` | ack | LIFECYCLE_TRANSITION fires in `_handleConceptFile` (app.js:874) and `_handleProductionPromote` (app.js:1117). PRD_GENERATE fires in `_handlePrd` (app.js:1008) BEFORE generation. All three use lazy-require. Live probe: POST /api/concept-file returned 200 + lifecyclePhase=CONCEPT; GET /api/prd returned 200; no `hook fire failed` lines in server log. **Cross-cluster gap surfaced**: `_handleMvpLock` (app.js:897-984) performs a real CONCEPT/DEVELOPMENT → LOCKED transition without firing the hook. Not a kickback (out of ticket-5 scope, which targeted the four declared-but-unfired CONSTANTS) but flagged for Wave 4. |
| 6 | `d65f14c` | ack | Enumerated every side effect of the original 215-line callback (git show 1f1aad6:src/core/server/main.js L209-419). All accounted for in the new code with no silent gaps. See deep-audit section below. |
| 25 | `e4f3a4b` | ack | Microbench replicated: 1000 fires through empty registry = 1.00 ms (1.003 µs/fire), so 283 fires ≈ 0.28 ms. Executor's 0.82 ms is in the same order of magnitude (includes verbose-disabled overhead). Fast-path code checks BOTH `_hooks.get(name)` empty AND `listenerCount(name) === 0`. Returns the canonical `{ok:0, fail:0, errors:[]}` shape. Live probe via `r.execute(HOOKS.PRD_GENERATE, {})` confirms. |

### Deep audit — ticket 6 (the 215-line decomp)

**Original side effects (enumerated from `git show 1f1aad6:src/core/server/main.js`):**

| # | Side effect | Old location | New location |
|---|---|---|---|
| 1 | Filter by code extension | L213-216 (callback top) | main.js L330 (callback top) — preserved |
| 2a | DELETE: splice from result.files | L233 | _applyFileChange L53 |
| 2b | DELETE: persistence.logMutation | L240-247 | _applyFileChange L56-64 |
| 2c | DELETE: SSE publish | L249-256 (was BEFORE card unlink) | P=30 sse-broadcaster |
| 2d | DELETE: unlink card on disk | L258-265 | P=20 schema-card-emitter L176-190 |
| 2e | DELETE: persistence.deleteFile | L267 | _applyFileChange L65 |
| 2f | DELETE: console.log "Removed" | L268 | _applyFileChange L66 |
| 3a | CREATE: read+hash+stat+fingerprint | L275-280 | _applyFileChange L73-77 |
| 3b | CREATE: push to result.files | L302 | _applyFileChange L96 |
| 3c | CREATE: persistence.upsertFile | L303 | _applyFileChange L97 |
| 3d | CREATE: persistence.logMutation | L305-312 | _applyFileChange L99-107 |
| 3e | CREATE: SSE publish (was BEFORE card) | L313-319 | P=30 sse-broadcaster |
| 3f | CREATE: emitter.emitCard | L321-336 | P=20 schema-card-emitter L194-217 |
| 4a | EDIT: hash + skip-if-same | L353-359 | _applyFileChange L117-118 |
| 4b | EDIT: persistence.upsertFile | L361-364 | _applyFileChange L121-123 |
| 4c | EDIT: persistence.logMutation | L366-373 | _applyFileChange L125-133 |
| 4d | EDIT: SSE publish (was BEFORE card) | L375-381 | P=30 sse-broadcaster |
| 4e | EDIT: AST + emitter.emitCard | L383-396 | P=20 schema-card-emitter |
| 5a | Post-batch: writeManifests | L402 | main.js L378 (inline, AFTER for-loop — correct) |
| 5b | Post-batch: IntentSeeder.seedAll | L408-414 | main.js L381-387 (inline, AFTER for-loop) |
| 5c | Post-batch: GapAnalyzer.writeReport | L417-422 | main.js L389-395 (inline, AFTER for-loop) |
| 5d | Post-batch: console.log "Incremental" | L404 | main.js L379 |

**Zero side effects lost. No ai-content invalidation existed in the original (executor honestly inferred this).**

**End-to-end probe** (`/tmp/st8-2b-probe`, port 3949):
- `echo "x=1" > test.js` → CREATE: `test.js.json` written, `[st8:notify] + test.js — CREATE`, post-batch fired once.
- `echo "x=2" >> test.js` → EDIT: card updated, `[st8:notify] ✎ test.js — EDIT`, post-batch fired once.
- `rm test.js` → DELETE: card unlinked, `[st8:notify] − test.js — DELETE`, persistence row removed, post-batch fired once.
- Post-batch invariant verified: manifest + seeder + gap-analyzer ran exactly ONCE per debounced batch, not N-multiplied. Executor's residualConcerns reasoning holds.

**Subscriber inspection** (default-subscribers.js L157-235):
- P=20 `file-after-change/schema-card-emitter` — guards on `file && mutation`, handles CREATE+EDIT (emit) and DELETE (unlink), wraps emit in its own try/catch.
- P=30 `file-after-change/sse-broadcaster` — guards on `file && mutation`, publishes canonical payload `{fingerprint, filepath, mutationType, actor, sha256Hash}`.
- Source tags use `file-after-change/` prefix → introspection (`listAllHooks().runOrder`) is self-documenting.

**Line count** (onFileChange callback L329-397): 69 lines including comments and braces, ~40 LOC of real code. Matches executor's claim.

### Per-emit try/catch deviation — verdict

The executor kept the per-emit try/catch in the schema-card-emitter
subscriber, deviating from the brief's "no wrapping" rule. Their
justification: *"without it, a single bad emit silences SSE for that
change."*

I probed registry behavior with a P=15 thrower + P=20/P=30 observers:

    order: [ 'thrower-fired', 'p20', 'p30' ]
    res:   {"ok":2,"fail":1,"errors":[{"source":"thrower","error":"boom"}]}

The registry catches throws and continues to subsequent subscribers.
The executor's stated justification is therefore **technically wrong** —
registry-level isolation already guarantees the SSE broadcaster runs
even if the card emit throws.

The try/catch is **convenience** (provides a better error message:
`[st8] Failed to emit schema card for X (type): err.message`) rather
than **load-bearing**. The deviation is benign — at worst it duplicates
the registry's existing isolation. Not a kickback because (a) the
deviation does not introduce a regression, (b) the executor was
transparent about deviating from the brief's rule, and (c) the gap-analyzer
subscriber already has the same "internal try/catch + registry catch"
belt-and-braces pattern, so this is precedent-consistent.

**Recommendation for the founder/Wave 2D:** the executor's reason was
incorrect; the actual reason ("better error message context") is the
same justification the docs already give for wrapping. The brief's
"no wrapping" rule deserves a footnote: convenience-wrapping with a
loud `console.error` is OK; silent swallow is not.

### Honesty gaps (minor)

1. **`_applyFileChange` is module-scoped but not exported.** Executor
   wrote "Lives at module scope (not inside main()) so it is unit-testable
   in isolation." But `src/core/server/main.js` has zero `module.exports`,
   so the helper is module-private and not actually reachable from a test
   file. The decomp still helps readability — it just hasn't unlocked
   testability yet. Minor honesty drift, not a kickback.
2. **Per-emit try/catch reasoning is wrong.** Discussed above.
3. **SSE-vs-card ordering claim is wrong.** Executor claimed P=20-before-P=30
   "preserves pre-decomp visible behavior." It does not — the original
   CREATE/EDIT/DELETE all published SSE BEFORE writing the card. The
   new order (card → SSE) is arguably nicer but IS a behavioral change.
   With zero current SSE consumers that read the card via the bus event,
   live blast radius is zero. Flag for any future SSE consumer.

None of these justify a kickback. The decomp itself preserves every
behavior end-to-end, and the executor's residualConcerns honestly
captures the bigger structural tradeoffs (batch-shaped post-loop,
result.files closure, FC4 fragility).

### residualConcerns audit

All executor-flagged residualConcerns map to real follow-ups:

1. **Ticket 5 — bruno-oscar gaps** (lifecycle cluster) — confirmed by
   reading src/features/lifecycle/bruno-oscar.js: `runBrunoCall` and
   `archiveFile` flip brunoStatus without touching lifecyclePhase. Real
   gap, correctly attributed to lifecycle cluster.
2. **Ticket 5 — PRD_GENERATE empty options** — accurate; harmless
   forward-compat placeholder.
3. **Ticket 6 — batch-shaped post-loop kept inline** — accurate; the
   N-multiplication for gap-analyzer is real (it scans every card on
   disk). FILE_AFTER_CHANGE_BATCH is the right future fix.
4. **Ticket 6 — result.files closure ownership** — accurate; pre-existing
   design choice the decomp inherits.
5. **Ticket 6 — FC4 fragility** — accurate; orthogonal to this work.
6. **Ticket 6 — per-emit try/catch deviation** — see above; honest
   about the deviation, wrong about the reason.
7. **Ticket 25 — fast path zero-help with one subscriber** — accurate.

### No-cheats sweep

- `git diff 880f287..ef1bc79 -- src/ scripts/`: no new TODO/FIXME/XXX,
  no commented-out original blocks, no console.log debris, no
  silently-swallowing catches added. Every new try/catch logs with a
  module-tagged `[st8:*]` prefix.
- Verbose log path in fast-path correctly says "(0 subscribers — fast path)"
  so traces are honest about which branch ran.
- No subscriber bodies are half-written; both new FILE_AFTER_CHANGE
  subscribers are complete.
- File renaming: NOT performed (correct — Wave 2D handles).

### Cluster shape for downstream waves

**Safe for 2C (test infra + perf + auth + validation) to build on.**
The 2B changes:

- `HookRegistry.execute` fast path is purely additive — does not alter
  the multi-subscriber path. Existing INDEX_COMPLETE subscribers, the
  force-checks chain, and the new FILE_AFTER_CHANGE chain all run
  through the unchanged loop.
- `_applyFileChange` lives at module scope; 2C's test-infra work can
  add a `module.exports = { _applyFileChange }` line and write unit
  tests against the three branches without touching the orchestrator.
- New FILE_AFTER_CHANGE subscribers are independent of each other and
  guard on `file && mutation`, so 2C's auth/validation hooks could
  register at higher priorities (P<20) without colliding.
- The two lazy-require sites (`_handleConceptFile`, `_handleProductionPromote`,
  `_handlePrd`) extend the established pattern — no new circular-dep
  risk.

### Cross-cluster flags for founder

- **Lifecycle cluster (Wave 4): MVP-lock unwired.** `_handleMvpLock`
  in src/core/server/app.js:897-984 performs a real CONCEPT/DEVELOPMENT
  → LOCKED phase transition (line 939) without firing
  `LIFECYCLE_TRANSITION`. Ticket 5's scope was "wire the four
  declared-but-unfired CONSTANTS" and that's done correctly. But the
  hook-coverage gap remains for MVP-lock plus the two bruno-oscar
  archive sites the executor already flagged. Wave 4 should extend.
- **Lifecycle cluster (Wave 4): bruno-oscar archive-staging.** Already
  flagged in ticket 5's residualConcerns. `runBrunoCall` →
  brunoStatus='flagged' and `archiveFile` → brunoStatus='archived' both
  represent real phase work that should fire `LIFECYCLE_TRANSITION`.
  The hook contract is in place; bruno-oscar just needs to start using
  it when the phase semantics are nailed down.
- **Documentation cluster: SSE-vs-card ordering changed.** New code
  publishes SSE AFTER writing the card; old code published SSE BEFORE.
  Update any future SSE consumer doc accordingly. Zero current
  consumers; no live impact.

### Cluster running total

Across the 15 tickets reviewed so far (12 from Wave 2A + 3 from Wave 2B):

- **ack:** 14
- **defer-confirmed:** 1 (Wave 2A ticket 20 — observation-only)
- **kickback:** 0

Open Wave 2C and Wave 2D tickets in the JSON remain untouched.

### Bottom line

Wave 2B executor was rigorous on the deepest structural work in the
cluster. All 215 lines of the old onFileChange callback traced to the
new decomp with zero side effects lost. The fast-path optimization is
provably safe and well-measured. The three new publishers all fire
cleanly and use the established lazy-require pattern.

Three minor honesty gaps surfaced (helper marked "unit-testable" but
not exported; per-emit try/catch reasoning is wrong even though the
deviation itself is benign; SSE-vs-card ordering claim is wrong). None
reach kickback threshold. The executor's residualConcerns are
substantive and honest — including the bigger structural tradeoffs
(batch-shaped post-loop, result.files closure ownership, FILE_AFTER_CHANGE_BATCH
as the right future fix).

JSON annotations written; JSON file NOT renamed (final reviewer's job).
Cluster is safe for Wave 2C to build on.

## Wave 2C Review

Reviewer: wave-2c-reviewer
Reviewed: 2026-05-15
Tickets in scope: indices 7, 16, 27, 28 (4 total) — test infra, perf
via shared persistence, shared-secret auth on write routes, strict
input validation on /api/record-commit.
Commits audited: `1425822..0d75ebe` (`1425822`, `4c8c29e`, `606eb4c`,
`6a4a87f`, `0d75ebe`).

### Verdict counts

- **ack:** 4
- **defer-confirmed:** 0
- **kickback:** 0

### Test suite truth

`npm test` → tests:74 / pass:74 / fail:0 / skipped:0 / todo:0 /
cancelled:0. Duration ~2.2 s. Executor's claim of "74 passing tests"
is exact.

**Probe-break audit** (proves the tests genuinely exercise the SUT,
not pass-by-construction): replaced `a.priority - b.priority` with `0`
in src/core/hook-registry.js, re-ran npm test — exactly two tests
failed (`HookRegistry — priority ordering: P=10 runs before P=100`
and `HookRegistry — introspectExecuteOrder returns sources in priority
order`). Restored cleanly. The suite does not pass by construction.

**Cheat scan across every test file** (tests/core/hook-registry.test.js,
tests/core/database/persistence-shared.test.js,
tests/core/server/auth.test.js,
tests/core/server/app-auth-routes.test.js,
tests/core/server/validate-record-commit.test.js):

- Zero `assert.ok(true)` / by-construction asserts.
- Zero mocks of the SUT — auth, persistence, and server are all real
  instances against fs.mkdtempSync dirs and ephemeral HTTP ports.
- One conditional skip exists at auth.test.js:63
  (`{skip: process.platform === 'win32'}` on the mode-0600 check);
  legitimate and reports 0 skipped on Linux.
- No `t.skip()`, `it.skip()`, `test.todo()`, `describe.only()`.

### Commit-by-commit verification

| Ticket | Commit | Verdict | Verification |
|---|---|---|---|
| 7  | `4c8c29e` | ack | getSharedPersistence() at persistence.js:1411 is a true memoized accessor with both cache + in-flight Promise dedupe (no double-init race). Live probe: 100 sequential GETs on /api/tickets/count completed in 618 ms (~6 ms/req including HTTP roundtrip; the historical baseline was ~478 ms for a single new+init); "Database initialized" appears exactly ONCE in the server log across boot + 100 requests. Prototype-spy test wraps St8Persistence.prototype.initialize across 5 sequential + 10 concurrent callers and asserts initCallCount === 1, peakConcurrency === 1 — real probe, not self-mocking. close+reopen test asserts notEqual instance refs. |
| 16 | `1425822` | ack | 74/74 passing, zero skipped/todo. Probe-break confirmed the tests actually exercise the registry. tests/README.md documents the three reusable patterns (prototype-spy, ephemeral-port boot, real persistence vs tmp dir) that the rest of the suite uses. 21 hook-registry probes cover priority ordering, stable tie-breaking, error isolation, async-sequential semantics, fast-path zero-sub, EventEmitter re-emit order, listHooks vs listAllHooks, introspectExecuteOrder, unregister true/false return, register()-returned unregister fn, clear(), TypeError on non-function handler, default priority/source, HOOKS frozen, singleton-vs-fresh-instance. |
| 27 | `606eb4c` | ack | Live HTTP probe on port 4949 against a real main.js boot: POST /api/record-commit returns **401/401/200** for missing/wrong/correct X-St8-Secret. GET /api/tickets remains unauthenticated (200 with no header). GET /api/auth-token returns 200 over loopback, POST → 405. **Cheat-check passed:** with `.st8/server.secret` removed, POST returns **503** (no-secret-on-disk) — does NOT silently allow. auth.js uses `crypto.timingSafeEqual` with a length-mismatch fast-path that returns false BEFORE the timingSafeEqual call (avoids the buffer-length throw). ensureSecret writes via tmp+rename atomic + chmod 0600 + explicit chmodSync belt-and-braces. Frontend bootstrap at frontend/app.js:40 fetches /api/auth-token once on load; st8AuthFetch attaches X-St8-Secret; makeTicketFromNotes routes through it. |
| 28 | `6a4a87f` | ack | Live HTTP probe with valid auth header: filesChanged="5" → **400**, filesChanged=[1,2,3] → **400**, unknown field "bogus" → **400**, happy path filesChanged:3 → **200**. validateRecordCommitPayload at app.js:75 is exported for direct testability and is called BEFORE persistence/hook work, so malformed payloads cannot reach activity_log or COMMIT_RECORDED subscribers. The unknown-key check fires before type checks so attacker-controlled keys (e.g. `"exploit": ...`) return 400 with the field name. The validator handles the full negative space for filesChanged: string, array, object, float, negative, NaN, ±Infinity, >MAX. Invalid JSON body returns 400 (was 500 before). Normalized payload is a reference-fresh object — verified by `assert.notEqual(r.payload, input)`. |

### Live probe results (the four cluster proofs)

```
=== AUTH (port 4949, real server, real .st8/server.secret) ===
no header        → 401
wrong secret     → 401
correct secret   → 200

=== VALIDATION (auth header attached) ===
filesChanged="5"        → 400
filesChanged=[1,2,3]    → 400
bogus unknown field     → 400
happy path              → 200

=== MISSING-SECRET CHEAT CHECK ===
no header, no file              → 503 (not 200; not silent pass)
old secret, no file             → 503

=== AUTH-TOKEN BOOTSTRAP ===
GET /api/auth-token (loopback)  → 200, 64-hex secret
POST /api/auth-token            → 405

=== PERF ===
100 sequential GET /api/tickets/count = 618 ms wall (~6 ms/req)
"Database initialized" log lines across boot + 100 reqs = 1
```

### Singleton proof

One-line summary: across server-boot plus 100 HTTP requests, the
string `Database initialized` appears in the server log exactly ONCE
(`grep -c 'Database initialized' /tmp/st8-srv.log` → 1), and the
prototype-spy test asserts `initCallCount === 1` for 10 concurrent
`Promise.all` callers. The shared instance is real.

### Auth deviation worth noting (not a kickback)

`auth.ensureSecret()` re-writes the secret file if the existing
contents are shorter than 16 chars (auth.js:69 `if (existing.length
>= 16) return existing`; below the threshold falls through to the
regen branch). That's the *correct* behavior for a corrupted/stub
file, and it matches the test at auth.test.js:107 (which writes
`'short\n'` and expects readSecret to return null). But the symmetry
is worth understanding: a manually-shortened secret will be
silently regenerated rather than errored. Not a cheat (it would be a
cheat if it silently *accepted* a too-short secret as valid; it does
the opposite) but worth a callout for future rotation work.

### No-cheats sweep

- `git diff 99cfd4b..0d75ebe -- ':!tests/' ':!docs/' ':!package.json'`
  reviewed line by line. No new TODO/FIXME/XXX, no `NODE_ENV` bypasses,
  no empty function bodies, no swallowing catches.
- Every try/catch in the new code logs with a tagged
  `[st8:server]` / `[st8:auth]` / `[st8:record-commit]` /
  `[st8:tickets]` prefix and continues — never a bare `catch (_) {}`
  except the chmodSync best-effort on Windows (justified inline).
- The "fire-and-forget" shell hook keeps the `|| true` + final
  `exit 0`. Both are pre-existing patterns from Wave 2A's hook work —
  not new cheats.
- File renaming: NOT performed (correct — Wave 2D handles).

### residualConcerns audit

All four executor-flagged residualConcerns are real and present in
the JSON, not just the agent report:

1. **Ticket 7 — 20+ other routes still per-request `new
   St8Persistence()`.** Confirmed by `grep -c 'new St8Persistence(' src/core/server/app.js`
   showing many remaining sites. Out of scope for this ticket (which
   targeted only the two hook-firing POSTs + /api/tickets GET + /count).
   Natural follow-up; the accessor is in place.
2. **Ticket 16 — only hook-registry.js has direct unit coverage.**
   Accurate; default-subscribers.js, force-checks.js, and
   _applyFileChange remain uncovered. Wave 2D inherits the conventions
   doc + the three reusable patterns the existing tests pioneered.
3. **Ticket 27 — token rotation not implemented; frontend bootstrap
   fetches /api/auth-token once with no refresh-on-401; auth-token
   endpoint is loopback-gated but NOT secret-gated.** All three
   accurate and honestly characterized as design choices for the
   current threat model.
4. **Ticket 28 — _handleTickets POST has weaker validation; FILES_CHANGED_MAX
   is a sanity cap not a real upper bound.** Both accurate.

### Cluster shape for downstream waves

**Safe for 2D (subscriber tests + force-check audit + file rename) to
build on.** The 2C changes:

- The test infrastructure (`node --test`, tests/ mirrors src/,
  conventions doc) is the foundation Wave 2D needs. Patterns reusable
  for default-subscribers.js + force-checks.js + _applyFileChange
  tests are already exemplified in the existing suite.
- `getSharedPersistence` is purely additive — existing per-request
  callers still work. 2D can either propagate the accessor to the
  remaining 20+ routes (P2 follow-up) or leave it; the test infra
  for either path is in place.
- Auth gating is scoped to the two write routes; it does not affect
  any subscriber wiring or in-process hook fires. 2D's subscriber
  tests will register directly against `new HookRegistry()` instances
  with no HTTP path involved.
- The validator is exported for direct unit-testability — 2D can
  follow the same pattern when adding `validateCreateTicketPayload`
  (the natural ticket-28 follow-up the residualConcerns flagged).

### Cross-cluster flags for founder

- **Persistence cluster (closed): the accessor at persistence.js:1411
  is now load-bearing for HTTP performance.** Any future change to
  St8Persistence.initialize() must remain idempotent within a single
  process lifetime. The shared-instance contract is now part of the
  cluster API surface, not just an internal helper. Worth a one-line
  callout in the persistence component doc next time it's touched.
- **Lifecycle cluster: SIGTERM is STILL unwired in main.js.** The
  Wave 2A reviewer flagged this. With 2C's `.st8/server.secret` now
  on disk, a SIGTERM-killed server leaves both `.st8/server.port`
  AND the secret behind — the secret survives by design
  (restart-survivability), but a future rotation policy that depends
  on unlinking-on-shutdown would also be unrun. No regression today;
  flagging the same gap from a different angle.
- **Frontend cluster: the auth-token bootstrap has no refresh-on-401
  loop.** If a long-running SPA session ever survives a secret
  rotation, every POST after the rotation will 401 until the user
  reloads. Out of cluster scope; documented in ticket 27 residualConcerns.

### Cluster running total

Across the 19 tickets reviewed so far (12 from Wave 2A + 3 from
Wave 2B + 4 from Wave 2C):

- **ack:** 18
- **defer-confirmed:** 1 (Wave 2A ticket 20 — observation-only)
- **kickback:** 0

Wave 2D tickets remain untouched.

### Bottom line

Wave 2C executor was rigorous on the highest-temptation tickets in
the cluster (the deliverable is "tests pass" and "auth works" — the
two surfaces most prone to by-construction cheats). The probe-break
audit confirms the test suite genuinely exercises the SUT; the live
HTTP probes confirm the auth gate, validation gate, and shared-instance
optimization all behave as advertised in real-world conditions;
the missing-secret cheat-check confirms auth fails closed (503),
not open (200). residualConcerns are honest and substantive.

JSON annotations written; JSON file NOT renamed (final reviewer's
job). Cluster is safe for Wave 2D to build on.
