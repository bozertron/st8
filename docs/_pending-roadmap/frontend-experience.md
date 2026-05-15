# frontend-experience — roadmap

Forward-looking design work for the visible UI cluster. Items the
founder has discussed, batches 028 — 031 anticipated, or audit gaps
that suggest natural next moves. Not bugs — see
`docs/_pending-tickets/frontend-experience.json` for those.

Priority key:

- **Priority 1** — blocking the founder's stated loop (collaboration cycle, constellation→ticket flow, shelf takeover); ship next.
- **Priority 2** — polish and ergonomic gaps the founder will notice in normal use.
- **Priority 3** — performance, accessibility, and longer-horizon affordances.

---

## Priority 1

- **Lower-5th shelf takeover ("Pattern 2" from agent C's audit, batch 027 area)**
  The shelf currently is a static container — `#shelf-content` is empty
  and never populated by `app.js`. The founder's design (Pattern 2 of
  the agent-C audit) calls for the lower 1/8 to be *takeover-capable*:
  workspace nav buttons, an LLM chat strip, ticket badges, and other
  per-context affordances should be able to claim the band. Need a
  small registry: `St8Shelf.takeover(componentName, htmlOrEl, opts)`
  with a stack-based push/pop so multiple takeovers compose, and a
  default chrome that re-asserts when nothing is on top.

- **Workspace nav buttons in the shelf**
  `st8WorkspaceChanged(wsType)` flips `void.split-mode` on/off and
  starts/stops coordination polling — but there's no actual workspace
  picker exposed in the new carousel UI. The `file-explorer.js`
  workspace picker exists, but only inside the file-explorer panel.
  The shelf is the natural place: a row of `[◇ Logic Analyzer] [◇
  Standard] [◇ Pretext Dev]` glyphs that drive
  `window.st8WorkspaceChanged(...)`. Depends on the shelf-takeover
  mechanic above.

- **Wire `HOOKS.TICKET_CREATED` to phreak> ticket-list UI**
  Backend fires `HOOKS.TICKET_CREATED` on POST `/api/tickets`. No
  subscriber updates the phreak> terminal. The phreak> TUI should
  render a live ticket list (currently only `/api/tickets/count`
  exists for a badge — and even the badge isn't wired). Add a
  `phreak-tickets.js` view in `components/terminal/` that lists open
  tickets, refreshable, with a "claim" affordance for when the LLM
  collaborator arrives.

- **Real-time ticket badge in the shelf or phreak header**
  `/api/tickets/count` exists. Hook the SSE mutation stream's
  `TICKET_CREATED` events (or add a `ticket:created` SSE event type)
  and surface a `(N)` badge somewhere persistent. Best location: the
  right side of the shelf, next to the right diamond, so it's visible
  from any panel. Depends on shelf-takeover or a permanent shelf
  badge slot.

- **Live SSE re-color of constellation particles on mutation**
  Today, `bootConstellation()` polls `/api/connection-state.json`
  every 5 seconds and calls
  `St8Constellation.updateFileStatus(fingerprint, status)` for every
  file. The SSE mutation stream already delivers per-file
  `mutationType` events. Subscribe the constellation to the stream,
  drop the poll, get sub-second re-color latency.

---

## Priority 2

- **Outer dock diamonds** (batch 027 design, currently dead CSS)
  `carousel.css` defines `.dock-diamond` with hover/active states but
  the markup never references it. The original brief: the existing
  file-explorer icon and `phreak>` text button in `.dock-row` should
  be replaced by diamonds at the screen edges (`◇   ◇`) that serve
  the same slide actions as the shelf diamonds — "always at the
  edges" per the founder. Add the markup, wire them to
  `St8Slide.slideTo()`, retire the existing dock-row entry points.

- **Emergence animation in the dive-in**
  `BUILDING_CONFIG.emergenceMs: 2500` is defined and unused. The
  founder's brief calls for buildings to "emerge from the void":
  particles scatter to position from random `(x,y,z)`, color lerps
  from cyan (`EMERGENCE_COLOR`) to status. Implement a single
  shader-uniform-driven entrance pass on every `show()`, then settle
  into the steady-state shimmer.

- **Hover states / interaction feedback on particles**
  particles.js's built-in `grab` mode lights up strands on hover,
  which is decent but generic. Per-particle hover feedback (a faint
  glow ring + tooltip showing `filename` + status) would close the
  "what am I about to click?" gap. Either:
  (a) extend `attachClickHandler` to a `pointermove` analog that
      tracks the nearest particle within the same 32px hit radius and
      mutates `p.color.opacity` / sets a CSS-positioned tooltip, or
  (b) maintain a parallel SVG overlay over the canvas for
      hover-rings.

- **Convert PRD wizard to a slide-in 4th panel (or a shelf takeover)**
  The PRD wizard uses the old `.panel-overlay.open` modal pattern.
  Stylistically inconsistent with the rest. Either promote it to a 4th
  slide-in panel on the right (after phreak), or fold it into the
  shelf-takeover mechanic — a "create project" affordance that lives
  in the lower 1/8 when explorer is active.

- **`font-face` adjustment for the new layout**
  Both `Monoton` and `Poiret One` come from local `.ttf` files via
  `fonts.css`. Test pass for the new carousel under both fonts on
  slow connections — particularly `font-display: swap` interactions
  with the carousel's `translateX` transition (FOUT during slide could
  cause layout shifts inside the panel titlebars). May need
  `font-display: optional` or a preload hint in `index.html`.

- **Tickets list UI in the phreak> TUI**
  Currently only `/api/tickets/count` is exposed; no list view. The
  phreak> TUI is the natural home for an inbox of open tickets — the
  founder's mental model of phreak is the human's command-line peer
  to the LLM collaborator, and tickets are the message-passing
  channel. Add `phreak-tickets.js` with a list pane, claim/release,
  and SSE auto-update.

- **Dedicated `dive-in.css` for hover / responsive / reduced-motion**
  Move the inline-style soup in `dive-in.js`'s `ensureOverlay()` into
  a stylesheet, add hover states to the close + Notes buttons, add a
  `@media (prefers-reduced-motion: reduce)` that disables the
  shader-shimmer + autoRotate, add small-viewport breakpoints so the
  header doesn't overlap the close button on narrow screens.

- **Status-color shared module**
  Extract the duplicated `STATUS_COLOR` tables from `constellation.js`
  and `dive-in.js` into `components/status-colors.js`. Single source
  of truth — adding a new state (COMBAT, future custom states) becomes
  a one-file change.

---

## Priority 3

- **Keyboard navigation for the slide carousel**
  Today only ESC works. Add Left/Right arrow nav (when no input is
  focused), Home → explorer / End → phreak, and Tab focus management
  between panels. Document the keymap somewhere visible (probably the
  shelf takeover for a `?` help glyph).

- **Constellation spatial index**
  `nearestParticle` is O(N) per click. Add an 8×8 coarse spatial
  bucket keyed in `bindFilesToParticles()`. Becomes load-bearing once
  file counts cross ~5k.

- **Sonic-aware degraded-mode indicator in the shelf**
  When Sonic fails to bind (IPv6 issue, port collision, binary
  missing) the backend logs `[sonic-daemon] ... SQLite-only mode` and
  keeps running. The frontend has no awareness. Expose
  `/api/sonic/status` (or wire it into `/api/health`) and surface a
  small "SQLite mode" indicator somewhere persistent, so users
  understand why search affordances may be slower or absent.

- **Importmap fallback shim**
  Optional: add `es-module-shims` as a graceful fallback for older
  browsers. Today we hard-assume Chrome 89+ / Safari 16.4+ / Firefox
  108+, which is fine for a developer tool, but adding a shim is a
  one-line `<script>` insert and removes the silent-fail mode.

- **Particles.js adapter module**
  Wrap particles.js behind `mountParticles(host, config) → { particles,
  destroy, on(event, fn) }` so the global-side-effect script becomes
  isolated. This makes future migration to a custom WebGL renderer (or
  swap to pixi-particles, etc.) a single-file change.

- **Frontend accessibility pass**
  Beyond the keyboard nav above: the dive-in canvas has no `role` or
  text alternative, the slide diamonds have `aria-label` but no
  `aria-current` on the active panel, and the carousel has no
  `aria-live` region announcing slide changes. Should be cheap to
  retrofit and would let the tool work for keyboard-only users.

- **Touch / gesture support**
  Pointer events for swipe-to-slide would be natural on tablets,
  though the audience is keyboard-first today. Defer until there's a
  real use case.

- **Multi-monitor / detachable panels**
  Long-horizon: the founder's vision of phreak> as a persistent
  command pane suggests it could one day "detach" into its own window.
  Out of scope for current sprint but worth a note here so the
  carousel-only architecture doesn't preclude it.
