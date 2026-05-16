# Frontend-Experience Review

## Wave 7A Review

Reviewer: wave-7a-reviewer
HEAD reviewed: 9e3c2b7
Tickets in scope: [0, 1, 11, 12, 15, 17]

### Pre-flight
- src/0_ drift: empty (OK)
- src/ structure: core features frontend shared (OK)
- entry chain: OK
- Tests: 423 pass / 0 fail / 0 skipped / 0 todo

### Per-ticket verdicts

**Ticket 0 — Inline styles extracted (ec07e68): ACK**
- `grep -c 'style=' src/frontend/components/dive-in/dive-in.js` → 0
- `grep -c 'style.cssText' src/frontend/components/dive-in/dive-in.js` → 0
- Display toggling moved from `style.display` to `classList.add/remove('open')`.

**Ticket 1 — dive-in.css created (974848d): ACK**
- File present (5006 bytes).
- Uses tokens (var(--gold), var(--pink-rgb), var(--pink)) — no hardcoded hex.
- Has hover/active rules on #dive-in-close and #dive-in-notes.
- Has `@media (max-width: 640px)` responsive block.
- Has `@media (prefers-reduced-motion: reduce)` override.
- index.html loads it at line 61.

**Ticket 11 — emergenceMs wired (772af2a): ACK**
- `updateEmergence(nowMs)` defined at dive-in.js:590, called from anim tick at line 625.
- Uses `BUILDING_CONFIG.emergenceMs` (=2500) as duration at line 594.
- SCATTER_FACTOR=3.0 scatter, EMERGENCE_COLOR=0x1FBDEA cyan start, ease-out-cubic interp at line 595.

**Ticket 12 — resize listener cleanup (0759d2c): ACK**
- `EMERGENCE_RESIZE_LISTENER` module-level ref at line 329.
- Named `onResize` stored at line 537.
- `destroy()` exported at line 452; removeEventListener uses the same ref at line 455.
- `window.St8DiveIn` now includes `destroy` (line 641).
- Note: keydown ESC handler intentionally not cleaned per executor's actionsTaken; documented and harmless.

**Ticket 15 — showCopyFeedback REAL BUG (2b9e1cd): ACK**
- app.js:749 uses `typeof showCopyFeedback === 'function'` guard.
- app.js:750 passes `filepath` to local function call.
- `window.showCopyFeedback` lookup removed.
- `console.info` Ticket-id log moved out of the unreachable else (now unconditional).

**Ticket 17 — autoRotate toggle (181f710): ACK**
- hide() sets `state.controls.autoRotate = false` at line 442 (guarded).
- show() sets `state.controls.autoRotate = true` at line 429 (guarded).
- Co-shipped diff with ticket 12 commit 0759d2c; 181f710 carries the per-ticket subject line — accepted.

### Summary
- ack: 6
- kickback: 0
- Tests stable at 423.
- Safe to proceed to Wave 7B.

## Wave 7B Review

Reviewer: wave-7b-reviewer
HEAD reviewed: e0d1fcc
Tickets in scope: [2, 6, 7, 8, 18, 20, 21]

### Pre-flight
- src/0_ drift: empty (OK)
- src/ structure: core features frontend shared (OK)
- entry chain: OK
- Tests: 435 pass / 0 fail / 0 skipped / 0 todo

### Per-ticket verdicts

**Ticket 2 — Constellation poll → SSE (1e95a1b bookkeeping; resolution at 59325e8): ACK**
- `git show 59325e8 --stat` confirms src/frontend/app.js touched in Wave 4D's lifecycle-and-eventing cluster.
- `grep setInterval src/frontend/app.js` → 1 hit, a comment at L285 documenting the migration. No live setInterval code remains.
- Upstream resolution genuine.

**Ticket 6 — Importmap fallback banner (5a7ac48): ACK**
- IIFE at index.html:208-236 probes `HTMLScriptElement.supports('importmap')`.
- Banner has `role='alert'` (L215), names Chrome 89+/Safari 16.4+/Firefox 108+ (L224).
- console.warns on failure; DOM insertion deferred until <body> ready; full try/catch wrapper.
- HTML comment (L198-207) documents rationale.

**Ticket 7 — Carousel keyboard nav + 12 tests (17f316c): ACK**
- tests/frontend/carousel-keyboard-nav.test.js: 12 test() probes, 12 pass.
- nextSlideTarget at app.js:365-376 handles ArrowLeft/Right/Home/End/Escape over ['explorer','st8','phreak'].
- shouldSuppressCarouselKey gates Ctrl/Meta/Alt, typeable elements, notes overlay, PRD wizard, phreak TUI.
- **MUTATION PROBE**: stubbed `ArrowRight return idx < order.length - 1 ? order[idx + 1] : null` → `return null`. Targeted suite went 12/12 → 11/12 (1 fail). File restored.

**Ticket 8 — PRD modal carousel migration deferred upstream (4bceb86 bookkeeping; resolution at 9f6e2dd): DEFER-CONFIRMED-UPSTREAM**
- `git show 9f6e2dd --stat` confirms Wave 5I FRONT-006 commit, +26 LOC inline rationale in app.js, roadmap update.
- Decision: keep modal. Defer to roadmap P3.3 with explicit 8-step migration scope.
- Bookkeeping commit is correct.

**Ticket 18 — Narrow-viewport @media (bc63b5f): ACK**
- base.css:16 `html, body { overflow: hidden }` already present — executor correctly did NOT duplicate.
- carousel.css:258 `@media (max-width:768px)` + L273 `@media (max-width:360px)` added.
- Inline comment L232-256 explains audit + layout-polish-only intent.

**Ticket 20 — shelf-content defer-with-pointer (5c447d0): DEFER-CONFIRMED**
- Roadmap pointer real: docs/_pending-roadmap/frontend-experience.md lines 16-26 describe `St8Shelf.takeover(componentName, htmlOrEl, opts)` registry, stack push/pop, default-chrome re-assertion.
- HTML comment at index.html:122-143 names the three P1 items with precise line ranges.
- Empty <div> retained as stable future mount point.

**Ticket 21 — bootConstellation DOMContentLoaded gate (b58fd67): ACK**
- app.js:273-277 readyState-aware gate: `if 'loading' addEventListener('DOMContentLoaded') else invoke immediately`.
- No bare top-level invocation remains.

### Summary
- ack: 5 (tickets 2, 6, 7, 18, 21)
- defer-confirmed-upstream: 1 (ticket 8)
- defer-confirmed: 1 (ticket 20)
- kickback: 0
- Tests stable at 435 (baseline 423 + 12 new from ticket 7).
- Mutation probe passed (break thing → test fails → restore).
- Safe to proceed to Wave 7C.

## Wave 7C Review

Reviewer: wave-7c-reviewer
HEAD reviewed: 3fac49e
Tickets in scope: [3, 4, 5, 9, 10, 13, 14, 16, 19]

### Pre-flight
- src/0_ drift: tree empty (OK); audit caught only the documented historical d340af4 cleanup commit since master baseline is 36d9c16 (the add). Tree-state invariant holds.
- src/ structure: core features frontend shared (OK)
- entry chain: OK
- Tests: 451 pass / 0 fail / 0 skipped / 0 todo

### Per-ticket verdicts

**Ticket 3 — Dead void-engine calls removed (4529a59): ACK**
- `grep -rn 'unloadVoidEngine|loadVoidEngine' src/` → 1 hit only, a documentary comment in index.html:19.
- Three call sites in app.js gone. pretext-dev branch correctly degraded to else.

**Ticket 4 — Dead .dock-diamond CSS removed (dcf73c5): ACK**
- `grep -rn 'dock-diamond' src/` → only carousel.css:200-206 documentary block pointing at the roadmap P2 entry. Zero markup users, zero live rules.

**Ticket 5 — Particles.js global contract documented (91cb015): ACK**
- particles.lib.js:10-43 carries the contract: names both globals (window.particlesJS function, window.pJSDom Array), constellation.js as sole consumer, guard pattern, do-not-edit-below directive, roadmap pointer.
- constellation.js:129-136 has explicit warning naming load-order failure mode.
- Roadmap P3 'Particles.js adapter module' entry at docs/_pending-roadmap/frontend-experience.md:186-190.

**Ticket 9 — Shared status-colors module (85218b7): ACK**
- src/frontend/components/status-colors.js exists with HEX/INT/RGB/resolve/resolveInt/hexToInt/hexToRgb. Dual browser+CJS export pattern.
- BOTH consumers reach into SAME module: constellation.js:50 reads .RGB, dive-in.js:93 reads .INT.
- tests/frontend/status-colors.test.js: 10/10 pass.
- **MUTATION PROBE**: swapped HEX.GREEN 'D4AF37' → 'FF0000' in status-colors.js → targeted suite 10/10 → 7/10 (3 fails). Restored, suite back to 10/10.

**Ticket 10 — Purple token (b55198f): ACK**
- tokens.css:14 `--purple: #9D4EDD` (COMBAT comment); L22 `--purple-rgb: 157, 78, 221`. Hex matches status-colors.js HEX.COMBAT.

**Ticket 13 — nearestParticle perf deferred (b30c866): DEFER-CONFIRMED**
- Roadmap entry at docs/_pending-roadmap/frontend-experience.md:158-170 with measurement baseline (~0.1ms per scan at ~1000 files) + numeric thresholds (>10ms p95 click-to-dive-in OR >5k files) + R*-tree anti-pattern guard.

**Ticket 14 — Defensive _st8FileIndex init (a3e9aaa): ACK**
- Two idempotent init points: app.js:32 (module top, post escapeHtml) + app.js:244 (inside bootConstellation, pre-fetch). Failure surface shifted from frontend TypeError to backend validation error.

**Ticket 16 — setStatus geometry-rebuild deferred (098b0a6): DEFER-CONFIRMED**
- Roadmap entry at docs/_pending-roadmap/frontend-experience.md:141-156 with baseline (status flips rare, <500 particles per rebuild, invisible against 2500ms emergence) + numeric thresholds (>1Hz in LIFECYCLE_TRANSITION batch OR >50ms stutter).

**Ticket 19 — destroy() typeof guard fix (422915b): ACK**
- Guard tightened to truthy-intermediate chain. tests/frontend/constellation-destroy-guard.test.js: 6/6 pass. Source-text regression probe prevents revert.

### Summary
- ack: 7 (tickets 3, 4, 5, 9, 10, 14, 19)
- defer-confirmed: 2 (tickets 13, 16)
- kickback: 0
- Tests stable at 451 (baseline 435 + 6 destroy-guard + 10 status-colors = 451).
- Mutation probe passed (status-colors HEX.GREEN swap → 3 fails → restore).

## Cluster Summary

Total tickets: 22

- Wave 7A: 6 ack / 0 kickback / 0 defer
- Wave 7B: 5 ack / 1 defer-confirmed-upstream / 1 defer-confirmed / 0 kickback
- Wave 7C: 7 ack / 2 defer-confirmed / 0 kickback

Cluster total:
- ack: 18
- defer-confirmed: 3 (tickets 8, 13, 16, 20 → 3 defer + 1 defer-upstream)
- defer-confirmed-upstream: 1 (ticket 8)
- kickback: 0

Tests final: 451 pass / 0 fail / 0 skipped / 0 todo.
Cluster-close audit: tree clean — `find src -maxdepth 2 -name "0_*"` empty.

Frontend-experience cluster ready to close.
