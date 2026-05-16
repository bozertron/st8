# Server-API-and-Legacy-Frontend Review

## Wave 5F Review

**Reviewer:** wave-5f-reviewer
**Date:** 2026-05-16
**Tickets covered:** 0, 1, 3, 10, 12
**Verdicts:** 5 ack, 0 kickback

### Pre-flight
- HEAD: `679453c chore(wave-5f): server-api sub-wave 5F — routes complete`
- `src/0_*` empty, canonical structure intact (`core features frontend shared`)
- entry chain OK
- Tests baseline: 355 pass / 0 fail / 0 skip / 0 todo (matches expected post-5F baseline)

### Ticket 0 — /api/llm-call (annotation only) — ACK
- JSON ticket 0 status="executed", commitHash points at Wave 5E upstream
  resolution (`a29616f`). Cross-cluster reference to
  `settings-and-providers.for-review.json` ticket 1 is honest — no code
  change in 5F, purely book-keeping.

### Ticket 12 — parseRequestBody helper — ACK
- Helper at `src/core/server/app.js:197-252` is a clean single-responsibility
  Promise wrapper with idempotent settle, `req.destroy()` on cap exceed,
  and 400 fallbacks for invalid JSON / client abort / stream error.
- `tests/core/server/parse-request-body.test.js` — 9 probes, all use a
  real `EventEmitter` mock (not a stub-asserts-called pattern).
  Independently re-ran: 9/9 pass.
- 8KB default cap verified in test (accepts 8000-byte payload, rejects
  10KB).

### Ticket 10 — body cap matrix — ACK
- `grep -c "parseRequestBody(req"` = **22** (executor claimed ~20).
  Two extra call sites vs. claim, but the direction (more uniform
  coverage) is correct.
- `grep "req.on('data'"` in app.js returns **only line 211**, which is
  inside `parseRequestBody` itself. Zero remaining inline parsers.
- 8KB backfill verified on `/api/record-commit` (line 1983) and
  `/api/tickets` POST (line 2091) — both previously uncapped, now
  bounded with explanatory comments.
- Cap matrix matches the executor's claim: 1KB compute-only, 2KB
  templates/prd, 4KB signal-path/report/resolve, 8KB settings/record-
  commit/tickets/llm-call.

### Ticket 1 — lifecycle routes — ACK
- Regex matching in default branch at `app.js:446-454` mirrors the
  established `/api/prd-projects/:name` pattern. Clean.
- `_handleTicketClaim` (2233) and `_handleTicketResolve` (2311) both:
  POST-only (405 otherwise), X-St8-Secret gated, body via
  `parseRequestBody`, persistence call with `changes===0 → 404`,
  `logActivity` row on success.
- TypeError/RangeError from `claimTicket` (unknown/inactive provider)
  surfaces as 400 — correct.
- 7 tests in `tests/core/server/ticket-lifecycle-routes.test.js` all
  boot a real St8Server on ephemeral port + temp targetDir; happy-path
  tests probe persistence directly to confirm row mutations rather than
  trusting the 200.
- **Mutation probe:** broke the auth gate in `_handleTicketClaim`
  (`if (false && !authCheck.ok)`). Test 1 (`POST without X-St8-Secret
  returns 401`) FAILED as expected. Restored. Auth gate is genuine.

### Ticket 3 — /api/exec 501 stub — ACK
- `_handleExec` at `app.js:2188`: POST-only (405 otherwise), drains
  body via `parseRequestBody` 1KB cap so the socket doesn't hang, then
  emits 501 with `{ok:false, error:'not implemented', detail, roadmap}`.
- Roadmap pointer (`docs/_pending-roadmap/server-api-and-legacy-frontend.md`)
  exists and discusses `/api/exec` at line 221 in the P2 frontend ghost-
  route section.
- 2 tests in `api-exec-stub.test.js` — POST → 501 + roadmap match,
  GET → 405.

### Hook-constants honesty — ACK
- `grep -E "TICKET_CLAIMED|TICKET_RESOLVED" src/core/hook-registry.js`
  is empty. Executor honored the CLAUDE.md "no publisher without a
  real subscriber" rule and documented the deferral in both handler
  comments and the JSON `actionsTaken`.

### Test count
- Final: 355 pass / 0 fail / 0 skip / 0 todo (matches pre-flight,
  confirms the review's mutation probe was fully reversed).

### Residual concerns
- None for the 5F scope. Tickets 2 (connection-state freshness), 5-11
  (frontend P2/P3), 6 (path-traversal audit), 7 (DRY follow-up — now
  done as part of 12), 8 (OpenAPI), 9 (REST conventions), 13 (boot
  perf), 14 (terminal phone state) remain open for later waves.

**Confidence: HIGH — safe to proceed to 5G.**

---

## Wave 5G Review

Reviewer: wave-5g-reviewer
Scope: tickets [API-003 (#2), API-006 (#11), API-008 (#13), API-009 (#14), BOOT-001 (#15)].
PRE-FLIGHT: OK (tests=363, head=916d9b5, no src/0_* drift, canonical
src/{core,features,frontend,shared}).

### Verdicts

- **Ticket 11 (API-006) — path.relative annotation** → `ack`.
  JSDoc at `src/core/server/app.js:860-882` documents the three foot-guns
  (symlinks, normalization, prefix-aliasing with concrete
  `/home/bozertron2/evil` example) and an explicit DO-NOT-REGRESS warning
  citing the prior `startsWith()` pattern and audit CR-02. Annotation-only
  — boundary logic byte-identical. Audit of other path-accepting routes
  correctly preserved as roadmap follow-up.

- **Ticket 14 (API-009) — convention documentation** → `ack`.
  JSDoc at `app.js:382-398` above `_handleApiRequest` codifies both forms
  (flat verb vs `:id`/`:name` regex) with cross-refs to
  `route-manifest.js` and the component doc. Component doc subsection
  (`docs/components/server-api-and-legacy-frontend.md:58-84`) covers
  rationale and the revisit-trigger (count > ~30 OR a fourth resource
  gains `:id` verbs → roadmap P2.5).

- **Ticket 13 (API-008) — route manifest + drift** → `ack`.
  Route count cross-check: `grep -c "method:" route-manifest.js` returns
  34 (33 real entries + 1 JSDoc), `grep -c "case '/api/" app.js` returns
  30 switch cases. Delta 3 matches the parameterised routes
  (`prd-projects/:name`, `tickets/:id/claim`, `tickets/:id/resolve`) per
  ticket 13's documented split. 4 drift sub-tests pass cleanly.
  **MUTATION PROBE EXECUTED:** appended a fake
  `{method:'GET', path:'/api/fake-drift', handler:'_handleFakeDrift'}`
  entry — sub-tests 1 ("manifest covers every flat case in app.js") and
  3 ("every handler resolves to a method on St8Server") correctly failed.
  Restored to clean state; 4/4 pass after restoration. Drift test is
  load-bearing, not theatre.

- **Ticket 2 (API-003) — manifest cache** → `ack`.
  Subscriber registered at `app.js:298-307` with priority 200 + source
  `st8-server-manifest-cache` — verified runs AFTER the default-subscribers'
  manifest writers (priority 50). `_serveManifest` (`app.js:560-602`) uses
  `stat.mtimeMs <= cached.mtimeMs` to return cached; forward mtime triggers
  re-read (defence-in-depth for out-of-band rewriters like
  `_handleFileIntent`). The 404 path explicitly sets
  `_manifestCacheEntry = null` (line 594) — no negative caching.
  `stop()` unregisters the subscriber at `app.js:2621-2628` preventing
  singleton-hookRegistry handler leaks across test boots. 4 cache tests
  pass independently (each boots a real St8Server on ephemeral port).

- **Ticket 15 (BOOT-001) — deferred with measurement** → `defer-confirmed`.
  Inline comment block at `src/core/server/main.js:285-303` cites
  Wave 2B's 0.82 ms / 281-file measurement, do-not-parallelise reasoning,
  and the trigger condition (any subscriber blocking > 5 ms per fire →
  add BULK_INDEXED). Roadmap P3.7 at
  `docs/_pending-roadmap/server-api-and-legacy-frontend.md:226-243`
  contains the BULK_INDEXED contract sketch (fired once after Pass 1
  with `{files, targetDir, persistence}`) plus the same trigger. Priority
  distribution footer updated 15 → 16 items. NO CODE BEHAVIOUR CHANGE
  confirmed — defer is honest.

### Counts

- 4 ack / 0 kickback / 1 defer-confirmed.
- Test count final: 363 pass / 0 fail / 0 skip / 0 todo (matches
  pre-flight; the mutation-probe edit-and-restore left no residue).

### Cluster status

5G executor finished its 5 tickets cleanly. No residual concerns surfaced
during review. Safe to proceed to **Wave 5H** (legacy-frontend cleanup
cluster: FRONT-001..FRONT-007 remain open per the JSON's untouched
status fields).
