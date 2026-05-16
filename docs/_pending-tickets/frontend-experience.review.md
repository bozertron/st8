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
