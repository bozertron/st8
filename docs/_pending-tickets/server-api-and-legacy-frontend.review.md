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

## Wave 5H Review

Reviewer: `wave-5h-reviewer`
Tickets in scope: 4, 5, 7, 16 (executor `wave-5h-executor`).
Commits audited: `8150845`, `e8b0248`, `cb40905`, `128d8c6` (range
`916d9b5..c2924f6`).
Pre-flight: tests 363/0/0/0 at HEAD `c2924f6`. PRE-FLIGHT OK.

### Per-ticket findings

- **Ticket 16 — phoneOffHook docs.** ACK.
  PHONE METAPHOR JSDoc block at `src/frontend/components/terminal/terminal.js:27-57`
  enumerates the signal flow accurately: `phreakState.phoneOffHook`
  default `false` at L68 → `togglePhoneOffHook` at L860 → click handlers
  for `data-action="phone-toggle"` at L582, L1057, and the titlebar
  hoist at `src/frontend/app.js:136-149` → `suppressed: phreakState.phoneOffHook`
  recorded at terminal.js:429 → popup gated by `entry.provisioned &&
  !entry.suppressed` at L442 → `getPhoneState()` exported at L1107 and
  consumed by app.js L138-148 for status text + CSS class. Minor
  naming/line-number drift (the doc names the internal reader
  `_pushSignal()` at ~L397; the actual function is `receiveSignal` at
  L419) — functionally equivalent, recorded as a note rather than a
  kickback. Cluster doc section 3.2 metaphor paragraph at L289-297
  matches.

- **Ticket 7 — `_toggleHidden` + `LS_SHOW_HIDDEN` removal.** ACK.
  Post-removal grep `_toggleHidden|LS_SHOW_HIDDEN|showHidden` across
  `src/` + `tests/` returns ZERO hits — clean. Diff `e8b0248` removes
  3 sites: (a) `showHidden: true` field from `explorerState`,
  (b) function body + section header, (c) public export. Net
  source-line delta matches the claim. `_filterEntries` at
  file-explorer.js:110 is unchanged (still the `return entries`
  no-op) which confirms the dead-function audit. Tests 363/0/0/0.

- **Ticket 5 — `_isolateFiles` / `_clearVoid` documentation.** ACK.
  Executor's premise rebuttal verified independently:
  `grep _isolateFiles` in `terminal.js` shows callers at L586/589/592/595
  (`isolate-{green,yellow,red,all}`) + definition L662; `_clearVoid`
  called at L601 (`clear-void` button) + L720 (inside `_clearAll`).
  Targets exist: `window.renderFileList = function` at `app.js:448`;
  `'#void-file-list'` referenced at app.js:405 (innerHTML create) and
  L449 (`getElementById` lookup). Both gated on
  `workspace==='logic-analyzer'` exactly as the cluster doc states.
  CROSS-COMPONENT COUPLING JSDoc block at terminal.js:629-660 is
  factually correct. Cluster doc section 3.2 updated to supersede the
  earlier FRONT-002 "stale references" read. NOT-REMOVING was the
  correct call per NO-CHEATS.

- **Ticket 4 — D3 vendored locally.** ACK.
  `src/frontend/vendor/d3/d3.v7.min.js` present, **279,706 bytes**,
  banner `// https://d3js.org v7.9.0 Copyright 2010-2023 Mike Bostock`.
  `D3_VENDOR_URL = '/src/frontend/vendor/d3/d3.v7.min.js'` at
  graph-viewer.js:29; `script.src = D3_VENDOR_URL` at L43 — no CDN
  reference at any `script.src` site in `src/frontend/`. `onerror`
  handler at L48-50 rejects with an actionable message containing the
  refresh `curl` command. `grep d3js.org src/frontend/` returns 4
  lines: the vendored file's own version banner, two comment-block
  references (rationale + refresh procedure), and the error-message
  hint — ZERO runtime references. Same-origin load relies on
  `STATIC_DIR` being repo root (correct given app.js routing).

### NO-CHEATS audit results

- `ls -la src/frontend/vendor/d3/d3.v7.min.js` → file exists, 279,706 bytes (> 250 KB threshold). PASS.
- `grep -rn 'd3js.org' src/frontend/` → 4 hits, all comment/banner/error-text. ZERO `script.src` references to CDN. PASS.
- `grep -rn '_toggleHidden\|LS_SHOW_HIDDEN\|showHidden' src/ tests/` → ZERO hits post-removal. PASS.
- `grep -n '_isolateFiles\|_clearVoid' src/frontend/components/terminal/*.js` → 4 callers (L586,589,592,595) + 1 (L601) + 1 (L720); definitions at L662 + L704. PASS.
- `grep -n 'renderFileList' src/frontend/app.js` → defined at L448. PASS.
- `grep -n 'void-file-list' src/frontend/app.js` → created at L405, consumed at L449. PASS.
- phoneOffHook JSDoc: signal flow matches code with minor naming drift (noted, not blocking).

### Counts

- 4 ack / 0 kickback / 0 defer.
- Test count final: 363 pass / 0 fail / 0 skip / 0 todo (matches pre-flight; reviewer made no source edits).

### Cluster status

Wave 5H executor delivered 4 frontend quick fixes cleanly. One real
behaviour change (D3 vendoring) plus three documentation/removal
fixes. The minor JSDoc naming drift (`_pushSignal` vs `receiveSignal`)
in terminal.js:38 is a candidate for a polish pass during a later
wave but does not block 5I. Safe to proceed to **Wave 5I** (UI/a11y
cleanup: FRONT-003, FRONT-005, FRONT-006 remain open per the JSON).

---

## Wave 5I Review

Reviewer: `wave-5i-reviewer`
Tickets in scope: 6 (FRONT-003), 8 (FRONT-005), 9 (FRONT-006).
Commits audited: `9f6e2dd`, `2510f40`, `d1b4117`, `b3ca689` (range
`c2924f6..b3ca689`).
Pre-flight: tests 373/0/0/0 at HEAD `b3ca689`. PRE-FLIGHT OK.

### Per-ticket findings

- **Ticket 9 (FRONT-006) — PRD wizard kept as modal.** defer-confirmed.
  Inline DESIGN DECISION block at `src/frontend/app.js:335-359` above
  `window.openPRDWizard` documents the keep-modal rationale (founder's
  strip-not-add stance), the migration cost (4th slide track, diamond
  bindings, shelf icon, visibility gating, mount-host relocation), and
  the accepted coupling at `file-explorer.js:350` with the migration
  plan that the global stays as a `slideTo('prd')` shim so call sites
  do not need updates. Roadmap entry P3.3 at
  `docs/_pending-roadmap/server-api-and-legacy-frontend.md:180`
  verified with exactly 8 numbered steps as claimed (SLIDE_TARGETS
  extension, 4th column, mount host, visibility gate, diamondTarget
  update, openPRDWizard shim, closePRDWizard deletion, CSS cleanup).
  NO code behaviour change — defer is honest.

- **Ticket 6 (FRONT-003) — explorer:error CustomEvent.** ACK.
  `grep MutationObserver src/frontend/` returns 3 hits — all
  documentary comments at `app.js:97` and
  `file-explorer.js:147,333` describing what was REPLACED. ZERO
  runtime `new MutationObserver(...)` instances. CustomEvent contract
  verified: `file-explorer.js _setError` dispatches `'explorer:error'`
  on `window` with `detail = { message, canRetry } | null` (or `null`
  to clear); `app.js:136` registers
  `window.addEventListener('explorer:error', ...)` inside the explorer
  mount block. RETRY button at `app.js:127` uses
  `retry.addEventListener('click', ...)` — NO `innerHTML` /
  inline-onclick injection. `renderBanner` uses `createElement`
  throughout and is idempotent (`querySelectorAll(...).forEach(remove)`
  before paint). DRY+wrap try/catch at `app.js:137-141` with
  `'[st8] explorer-error renderer failed'` log matches CLAUDE.md
  convention. 3 tests in `tests/frontend/file-explorer-error-event.test.js`
  (dispatch with detail, dispatch with null, addEventListener
  delivery) re-ran independently: 3/3 pass.

- **Ticket 8 (FRONT-005) — graph popup a11y.** ACK.
  All four enhancements verified in
  `src/frontend/components/graph-viewer/graph-viewer.js`:
  (1) ARIA dialog semantics — `role='dialog'`, `aria-modal='true'`,
  `aria-label='Connection graph'`, `aria-labelledby='graph-popup-title'`
  at L383-385+406; close button `aria-label='Close connection graph'`
  at L389.
  (2) Escape close — `onKeyDown` at L460-465 calls
  `e.preventDefault()` + `e.stopPropagation()` + `closeGraphPopup()`;
  document-scoped capture-phase listener registered at L494.
  (3) Focus trap — `getFocusable()` at L444-458 (filters hidden via
  `offsetParent`); Tab wrap last→first at L487-491; Shift+Tab wrap
  first→last at L482-486.
  (4) Initial + return focus — close button focused at L499-501;
  `opener` captured from `document.activeElement` at L375 and restored
  at L419-421 inside `closeGraphPopup`. Listener cleanup at L417 runs
  `document.removeEventListener('keydown', onKeyDown, true)` BEFORE
  detaching the overlay. Close/reset-zoom buttons wired via
  `addEventListener` at L429 + L435 (replaces previous inline
  `onclick`).
  **MUTATION PROBE EXECUTED:** stubbed the Escape branch in
  `onKeyDown` to early-return (no `preventDefault`, no
  `closeGraphPopup` call). Re-ran
  `tests/frontend/graph-popup-a11y.test.js` — 2 of 7 failed as
  expected: the Escape-close test AND the no-leak test (because
  Escape is the path that triggers the listener-removal in
  `closeGraphPopup`). Restored the Escape branch; 7/7 pass cleanly.
  Escape handler is load-bearing.

### NO-CHEATS audit results

- `grep -rn 'new MutationObserver' src/frontend/` → ZERO runtime
  instances. PASS.
- `grep -n 'explorer:error' src/frontend/` → dispatch in
  file-explorer.js, listener in app.js:136. PASS.
- `grep -n 'innerHTML\|onclick' src/frontend/app.js | grep -i 'retry\|explorer-error'`
  → ZERO matches — RETRY wired via addEventListener only. PASS.
- `grep -n "role='dialog'\|aria-modal\|aria-labelledby" src/frontend/components/graph-viewer/graph-viewer.js`
  → all present. PASS.
- Mutation probe (Escape handler removed) → 2/7 graph-popup tests
  failed; restored → 7/7 pass. PASS.
- P3.3 roadmap entry: 8 steps confirmed at
  docs/_pending-roadmap/server-api-and-legacy-frontend.md:192-213.
  PASS.

### Counts

- 2 ack / 0 kickback / 1 defer-confirmed.
- Test count final: 373 pass / 0 fail / 0 skip / 0 todo (matches
  pre-flight; the mutation-probe edit-and-restore left no residue).

---

## Cluster Summary

The `server-api-and-legacy-frontend` cluster ran across four sub-waves
(5F → 5G → 5H → 5I) and is now ready to close.

| Sub-wave | Tickets covered | ACK | Kickback | Defer |
|---|---|---|---|---|
| 5F | 0, 1, 3, 10, 12 | 5 | 0 | 0 |
| 5G | 2, 11, 13, 14, 15 | 4 | 0 | 1 |
| 5H | 4, 5, 7, 16 | 4 | 0 | 0 |
| 5I | 6, 8, 9 | 2 | 0 | 1 |
| **Cluster total** | **17 tickets** | **15** | **0** | **2** |

Deferred tickets:
- **#15 (BOOT-001)** — FILE_INDEXED batching deferred to roadmap P3.7
  with Wave 2B's 0.82 ms/281-file measurement preserved and the
  trigger condition (subscriber > 5 ms per fire → introduce
  `BULK_INDEXED`) documented at `src/core/server/main.js:285-303`.
- **#9 (FRONT-006)** — PRD wizard carousel migration deferred to
  roadmap P3.3 with an explicit 8-step scope and the keep-modal
  rationale documented at `src/frontend/app.js:335-359`.

Test count trajectory:
- 5F entry: 348 → 5F exit: 355
- 5G exit: 363
- 5H exit: 363 (no behaviour change for the new tests; D3 vendor only)
- 5I exit: 373 (+10 from FRONT-003 and FRONT-005 a11y/no-leak tests)

Cluster-close audit:
- `find src -maxdepth 2 -name "0_*"` → EMPTY. PASS.
- `git ls-files src/0_` → EMPTY. PASS.
- `git log c2924f6..b3ca689 --name-only --pretty=format: | grep "^src/0_"`
  → EMPTY (no 5I drift). PASS. (The naive `master..HEAD` audit
  surfaces the historical d340af4 deletion baked into the sprint
  baseline, per CLAUDE.md guidance to trust `ls src/` over external
  reports — current canonical structure is
  `core features frontend shared` only.)
- Canonical `ls src/` → `core features frontend shared`. PASS.

**Confidence: HIGH — cluster is ready to close.** All 17 tickets
have honest verdicts; 15 ACK + 2 defer-confirmed (both with concrete
roadmap pointers); zero kickbacks across the cluster. Tests
373/0/0/0; no source-code edits remained from any reviewer's
mutation probes.
