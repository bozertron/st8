# frontend-experience

The visible UI of st8: a 3-panel slide carousel that puts the file-explorer
on the left, the **constellation / dive-in** stage in the middle, and the
**phreak>** terminal on the right; a contextual "shelf" along the lower 1/8
of the viewport that hosts slide-diamonds and (eventually) chat / workspace
controls; the **Make Ticket** loop that closes the human ⇄ LLM
collaboration cycle through the existing notes popup.

This cluster covers the pieces the user actually clicks on — everything
under `src/frontend/index.html`, `src/frontend/app.js`, `src/frontend/styles/`
and the two new component trees: `components/constellation/` and
`components/dive-in/`. Older components (file-explorer, terminal,
graph-viewer, settings, prd-wizard, notifications, services/coordination)
keep their current behavior; the frontend-experience refactor wraps them in
the new carousel scaffolding rather than replacing them.

The bible's batches 028 — 031 were planned to describe this work; at the
time of writing only batches up to 027 are committed to `st8_bible.md`, so
the canonical reference for design intent is the inline JSDoc in the source
files themselves. This document consolidates that intent.

---

## 1. Architecture overview

### Three panels, mounted once, slid via translateX

The shell is a single `.panels-strip` 300vw wide, with three
`.panel-column` children at 100vw each:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│        .panels-viewport (height: 100vh − shelf)          │
│   ┌────────────┬────────────┬────────────┐              │
│   │ explorer   │   st8      │  phreak>   │              │
│   │  (pink)    │  (cyan)    │  (pink)    │              │
│   │            │ ACTIVE     │            │              │
│   │            │ <======>   │            │              │
│   └────────────┴────────────┴────────────┘              │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ [◇]  .shelf (12.5vh) — contextual content        [◇]    │
└──────────────────────────────────────────────────────────┘
```

The strip slides with a CSS `transform: translateX(var(--strip-offset))`
driven by a single attribute on the strip:

| `[data-active]` | `--strip-offset` |
|---|---|
| `explorer`      | `0`              |
| `st8`           | `-100vw`         |
| `phreak`        | `-200vw`         |

The transition is `var(--carousel-slide-ms) var(--carousel-ease)` —
`320ms cubic-bezier(0.34, 1.56, 0.64, 1)`, the slight overshoot the
founder asked for.

**Crucial property:** all three panels are mounted **once** at boot and
**never torn down**. Sliding only changes a single `transform`; the
particles.js canvas in the st8 panel and any Three.js scene that
spawns inside it survive every slide. This is enforced by the
`panels.{explorer,phreak}.mount()` pattern in `src/frontend/app.js` —
each panel object has a `mounted: false` flag and the `mount()` method
short-circuits on its second call.

### The 1/8 shelf (lower band, fixed)

The shelf is a fixed-position bar at the bottom of the viewport with
`height: var(--shelf-height)` (default `12.5vh`, hence "1/8"). It is a
3-column grid: `auto 1fr auto`. The outer slots hold the two slide
diamonds; the center slot is `#shelf-content`, intended to host
contextual content (LLM chat input, workspace controls, ticket badge —
none of these are wired yet; the shelf is currently a static container).

Its top border picks the accent of the currently-active panel: cyan
when st8 is showing, pink when explorer or phreak is showing. That is
driven by the same `data-active` attribute as the strip, mirrored onto
the shelf.

### Contextual slide-diamonds

Two diamonds live in the shelf — `.slide-diamond.slide-left` and
`.slide-diamond.slide-right`. They are **contextual**: only the
diamond(s) that point to an *adjacent* panel are visible.

| current panel | left diamond | right diamond |
|---|---|---|
| `explorer` (leftmost)   | hidden | visible (→ st8) |
| `st8` (center)          | visible (→ explorer) | visible (→ phreak) |
| `phreak` (rightmost)    | visible (→ st8) | hidden |

Visibility is `opacity: 0; pointer-events: none` rather than `display:
none` so the grid layout doesn't reflow on slide.

`app.js`'s `diamondTarget(direction)` function computes the destination
panel from the current `data-active` attribute and direction; clicking
a diamond calls `slideTo(target)`.

### Mount-once pattern (panels.{explorer,phreak})

```js
panels.explorer = {
  column:  /* .panel-column[data-panel="explorer"] */,
  host:    /* #explorer-host */,
  mounted: false,
  mount() { if (this.mounted) return; /* call window.VoidFileExplorer.mount */ ... this.mounted = true; },
};
```

Both `panels.explorer.mount()` and `panels.phreak.mount()` are called
immediately at boot — not lazily — so that error banners, status lines,
and the phreak header controls are wired into their panel titlebars
before the user first slides. The lazy-mount branch inside `slideTo()`
exists as a safety net (it's a no-op for already-mounted panels).

The center st8 panel is **not** mounted through this same registry; it
hosts `#stage`, which is owned by the constellation/dive-in subsystem
and bootstrapped separately by `bootConstellation()`.

### The importmap (Three.js resolution without a bundler)

`dive-in.js` is the only ES-module in the frontend. It imports from
`'three'` and `'three/addons/...'`. With no bundler in the loop, the
HTML declares an importmap:

```html
<script type="importmap">
{
  "imports": {
    "three":         "./components/dive-in/three/three.module.js",
    "three/addons/": "./components/dive-in/three/"
  }
}
</script>
```

`'three/addons/controls/OrbitControls.js'` therefore resolves to
`./components/dive-in/three/controls/OrbitControls.js`, etc. All
Three.js is vendored — there is no CDN dependency at runtime.

---

## 2. Phase A — slide carousel

**Files:**
- `src/frontend/index.html` — markup shell
- `src/frontend/styles/carousel.css` — layout, theming, diamond visibility
- `src/frontend/styles/tokens.css` — `--panel-accent`, `--shelf-height`, RGB triplets
- `src/frontend/styles/panels.css` — refactored to read `var(--panel-accent)` everywhere it used to hardcode pink
- `src/frontend/app.js` (SLIDE CONTROLLER section, lines ~31 — 247)

### How `data-active` drives `--strip-offset`

`carousel.css` declares three selectors that set `--strip-offset` as a
custom property:

```css
.panels-strip[data-active="explorer"] { --strip-offset:    0;     }
.panels-strip[data-active="st8"]      { --strip-offset: -100vw;   }
.panels-strip[data-active="phreak"]   { --strip-offset: -200vw;   }
```

`.panels-strip` itself reads that variable in its `transform` — so
flipping the attribute is the entire slide. The transition on
`transform` (`var(--carousel-slide-ms) var(--carousel-ease)`)
animates the change. No JavaScript layout math.

The same attribute on `.shelf` re-themes the accent border and chooses
which diamond is visible — purely CSS — so the JS only has to do the
single `setAttribute('data-active', target)` on both elements.

### Contextual diamond visibility (the "closest-to-st8" rule)

```css
.shelf[data-active="explorer"] .slide-diamond.slide-left,
.shelf[data-active="phreak"]   .slide-diamond.slide-right {
  opacity: 0;
  pointer-events: none;
}
```

The founder's mental model: a diamond should always point *toward*
something. From a flanking panel, only one direction has a real target
(the st8 center), so only the diamond pointing that way is visible.
From st8, both flanks have targets, so both are visible.

`app.js`'s `diamondTarget(direction)` matches this exactly:

```js
function diamondTarget(direction) {
  const cur = strip.getAttribute('data-active');
  if (direction === 'left')  return cur === 'phreak' ? 'st8'
                                  : cur === 'st8'    ? 'explorer'
                                  : null;
  // direction === 'right'
  return cur === 'explorer' ? 'st8'
       : cur === 'st8'      ? 'phreak'
       : null;
}
```

`null` results are guarded by the `if (target) slideTo(target)` check —
clicking a hidden diamond (which shouldn't be possible due to
`pointer-events: none`) is a no-op.

### Per-column theming via `--panel-accent`

Each `.panel-column` redefines two custom properties:

```css
.panel-column[data-panel="explorer"] { --panel-accent: var(--pink); --panel-accent-rgb: var(--pink-rgb); }
.panel-column[data-panel="st8"]      { --panel-accent: var(--cyan); --panel-accent-rgb: var(--cyan-rgb); }
.panel-column[data-panel="phreak"]   { --panel-accent: var(--pink); --panel-accent-rgb: var(--pink-rgb); }
```

`panels.css` was refactored so `.panel-frame`, `.panel-titlebar`, and
`.panel-title` all read `var(--panel-accent, var(--pink))` instead of
hardcoding pink. The center panel gets cyan borders and glows; the
flanking panels stay pink — automatically, without any panel-specific
CSS.

The `--panel-accent-rgb` triplet exists because `rgba(...)` needs
three comma-separated numbers, not a hex; the matching `--*-rgb`
custom properties in `tokens.css` (`--gold-rgb`, `--cyan-rgb`,
`--pink-rgb`) carry those triplets, kept in sync with the hex values
by convention.

### Keyboard nav (minimal, intentional)

The only key wired today is `Escape`: from any flanking panel, ESC
returns to the st8 center, matching the "diamond closest to st8"
semantic. It's a no-op when:

- the phreak TUI is active (TUI owns its own ESC), or
- we're already on `st8`.

There is no Left/Right arrow nav yet, no Tab focus management, no
Home/End shortcuts. See pending-tickets.

---

## 3. Phase B — constellation (flat file view)

**Files:**
- `src/frontend/components/constellation/constellation.js` (286 lines)
- `src/frontend/components/constellation/particles.lib.js` (vendored — DO NOT EDIT)

`constellation.js` is a thin st8-specific wrapper over the vendored
particles.js library. It produces the "flat view": each file in
`file_registry` becomes one particle. Healthy files glow gold, broken
files glow cyan (the "bug-juice"), locked files pink, combat (future)
purple. Strands auto-form between proximate particles via
particles.js's `line_linked` mode — a visual hint of the
dependency-graph density without us drawing every edge.

### File-to-particle mapping

particles.js spawns N anonymous particles with `density.enable: false`
and `number.value: fileCount` so we get exactly one particle per file.
After init we walk `pJS.particles.array` and decorate each entry:

```js
p.fileId      = file.fingerprint;
p.filepath    = file.filepath;
p.fileStatus  = file.status;     // 'GREEN' | 'YELLOW' | 'RED' | ...
p.color       = { value: { r, g, b }, rgb };  // status color
```

Decoration order matches the order of the `files` array; that is the
binding contract between the manifest and the particle grid.

### Hooking the internal `pJS.particles.array`

We do **not** modify particles.js. We rely on the fact that the
library exposes its scene through `window.pJSDom[i].pJS` and that each
particle in `pJS.particles.array` is a plain mutable object.
`constellation.js` uses `pickPJS(domId)` to find the right instance by
matching `pJS.tag.id` to our host element's id, then mutates each
particle's `.color` and adds custom fields (`.fileId`, `.filepath`,
`.fileStatus`).

This is a load-bearing assumption — see "Known caveats" — but it
matches the original library's design (particles are plain objects,
rendered each frame from their `.x/.y/.color`).

### Click → nearest particle

particles.js's built-in click modes only do push/remove/bubble/repulse;
none of those fit "open a notes popup". So `onclick.enable` is
explicitly `false` in our config, and `attachClickHandler()` puts our
own listener on `pJS.canvas.el`:

```js
canvas.addEventListener('click', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width  / rect.width);
  const y = (ev.clientY - rect.top)  * (canvas.height / rect.height);
  const hit = nearestParticle(x, y, 32 /* px hit radius */);
  if (hit) state.onParticleClick({ fingerprint: hit.fileId, filepath: hit.filepath, status: hit.fileStatus });
});
```

`nearestParticle` is an O(N) linear scan of `pJS.particles.array`,
keeping the closest particle whose squared-distance is under the hit
radius. With ~1000 files this is fine; if file count climbs into the
tens of thousands a spatial index becomes worth it. See
pending-roadmap.

### Status → color map (canonical)

```js
GREEN:   { r: 212, g: 175, b: 55  }   // --gold     (healthy)
YELLOW:  { r: 212, g: 175, b: 55  }   // --gold     (mild concern, same hue — opacity-shifted via anim)
RED:     { r: 31,  g: 189, b: 234 }   // --cyan     (bug-juice — sad-blue)
LOCKED:  { r: 201, g: 116, b: 143 }   // --pink     (louis-protected, future)
COMBAT:  { r: 157, g: 78,  b: 221 }   // purple     (agents-active, future)
```

The same map is duplicated in `dive-in.js` (as hex). They are kept in
sync by convention — see pending-tickets for a "single source of truth"
suggestion.

`statusColor(file)` checks `file.locked` first, so a locked + RED file
shows pink, not cyan. Locked overrides status.

### SSE / poll update loop

The mutation SSE stream (`/api/mutations`) is consumed in `app.js`'s
`initMutationStream` IIFE for toast display, but **not** wired
directly to the constellation. Instead, `bootConstellation()` ends by
installing a `setInterval(..., 5000)` that re-fetches the manifest and
calls `window.St8Constellation.updateFileStatus(fingerprint, status)`
for every file.

This is a known short-term hack — the SSE plumbing already exists and
delivers per-file mutation events; the poll only exists because the
particle-update logic wasn't yet wired to the SSE handler. See
pending-roadmap "live SSE re-color".

### Public API (window.St8Constellation)

| Method | Purpose |
|---|---|
| `init({ targetEl, files, onParticleClick })` | mount + seed |
| `setFiles(files)`                            | re-seed (rebuilds the canvas if count changed) |
| `updateFileStatus(fingerprint, status)`      | recolor one particle |
| `refocus(fingerprint)`                       | nudge the particles.js grab-mode mouse toward a particle |
| `destroy()`                                  | tear down (for HMR / dev) |

---

## 4. Phase C — dive-in (Three.js + Barradeau building)

**Files:**
- `src/frontend/components/dive-in/dive-in.js` (479 lines, ESM)
- `src/frontend/components/dive-in/three/three.module.js` (vendored Three.js core)
- `src/frontend/components/dive-in/three/controls/OrbitControls.js` (vendored)
- `src/frontend/components/dive-in/three/postprocessing/{EffectComposer, MaskPass, RenderPass, ShaderPass, UnrealBloomPass}.js` (vendored, 5 files)
- `src/frontend/components/dive-in/three/shaders/{CopyShader, LuminosityHighPassShader}.js` (vendored, 2 files)

8 vendored Three.js files in total. They are unmodified upstream
files; we do not document them individually.

### What triggers dive-in

The constellation's `onParticleClick` callback (wired in `app.js`
inside `bootConstellation()`) splits on file status:

```js
const isBuggy = file && (file.status === 'RED' || file.status === 'YELLOW');
if (isBuggy && window.St8DiveIn) {
  window.St8DiveIn.show(file);
} else if (window.handleFileNotes) {
  window.handleFileNotes(hit.filepath);   // straight to notes popup
}
```

Healthy (GREEN) files skip the dive-in entirely — clicking them goes
straight to the existing notes popup. Only RED / YELLOW files
"dimensionalize" into the Barradeau building view, because diving
into a healthy file would be visual cost without insight.

### Barradeau algorithm — summary

The Barradeau-style particle building emerges from three stages:

1. **Footprint generation (2D polygon)** — `makeFootprint(lineCount)`
   produces an organic polygon: a perimeter of `6 + floor(loc/100)`
   points with polar-coordinate jitter (`r * (0.85 + random() * 0.30)`),
   plus inner concentric rings whose density scales with `baseRadius`,
   plus a `(0, 0)` center anchor that closes the triangulation.
2. **Delaunay triangulation (2D)** — `Delaunay2D.triangulate(points)`
   runs Bowyer-Watson over the footprint. The implementation is lifted
   from the founder's `barradeau3d.html` standalone demo. Output is a
   list of `{p1, p2, p3}` triangles; we extract unique edges with their
   lengths into an `edgeMap`.
3. **Vertical extrusion + edge filtering** — for each of the
   `BUILDING_CONFIG.layerCount` (15) layers, we:
   - compute a per-layer scale (`1 − layer * taper`, default taper 1.5%
     per layer),
   - filter edges by length (only edges shorter than
     `maxLen * (1 − t * 0.5)` survive — longer/perimeter edges drop
     out the higher you go, naturally narrowing the building),
   - extrude each surviving edge into 3D at height `y = t * height`,
   - sprinkle particles along the edge with **inverse-edge-length
     density**: `n = floor(edge.length * particlesPerUnit * (1 + (1 −
     edge.length/maxLen) * 2))`. Short interior edges get up to 3×
     more particles than the longest perimeter edges — the building
     concentrates detail at its core.

The result is `builder.particles` (a flat list of `{x, y, z, opacity,
edgeLen}`) and `builder.edges` (a flat list of `{a, b, length}`
segments). Both get converted into Three.js `BufferGeometry` by
`getPointsGeometry(colorHex)` and `getLinesGeometry()`.

`BUILDING_CONFIG` exposes the knobs:

| key | value | meaning |
|---|---|---|
| `baseFootprint`     | 2     | minimum footprint radius |
| `footprintScale`    | 0.008 | additional radius per LOC |
| `minHeight`         | 3     | minimum building height |
| `heightPerExport`   | 0.8   | extra height per export |
| `layerCount`        | 15    | vertical extrusion layers |
| `taper`             | 0.015 | scale narrowing per layer |
| `particlesPerUnit`  | 1.2   | base particle density per edge unit |
| `verticalNoise`     | 0.3   | random y-jitter per particle |
| `emergenceMs`       | 2500  | emergence animation (currently unused) |

### Three.js scene composition

`initScene(host)` is called once on first `show()` and then re-used
between opens — the scene lives across hide/show cycles. Composition:

- `WebGLRenderer({ antialias: true })` with capped DPR (`min(devicePixelRatio, 2)`)
- `Scene` with `FogExp2(0x0A0A0B, 0.02)` (void-colored exponential fog)
- `PerspectiveCamera(50, aspect, 0.1, 500)` at `(25, 20, 25)`
- `OrbitControls` with `enableDamping: true`, `autoRotate: true,
  autoRotateSpeed: 0.5` — slow lazy spin
- `EffectComposer` with two passes:
  - `RenderPass(scene, camera)`
  - `UnrealBloomPass(resolution, strength=1.2, radius=0.4, threshold=0.1)`

The particle material is a custom `ShaderMaterial` with additive
blending and a per-vertex `size` attribute; the vertex shader applies
a `sin(uTime * 0.5 + x * 0.3) * 0.05` shimmer on Y. The line material
is a flat `LineBasicMaterial({ color: 0xFFFFFF, opacity: 0.05,
blending: AdditiveBlending })` — barely visible, just a ghost of the
triangulation.

### Animation loop

`startAnim()` installs a `requestAnimationFrame` tick that advances
the shader uniform `uTime` from a `THREE.Clock`, calls
`controls.update()` (needed for damping + autoRotate), and
`composer.render()`. `stopAnim()` cancels the frame on hide.

### Overlay DOM

`ensureOverlay()` lazy-creates a full-screen `<div>` appended to
`document.body` with id `dive-in-overlay`. It contains:

- `#dive-in-filepath` + `#dive-in-meta` (header, top-left)
- `#dive-in-close` (gold diamond glyph, top-right) → `hide()`
- `#dive-in-notes` (bottom-right pill button) → `window.handleFileNotes(filepath)`
- `#dive-in-canvas-host` (full-bleed canvas mount target)

**All styling is inline-attribute soup** in `dive-in.js` — there is no
`dive-in.css`. See pending-tickets — this is the most-conspicuous
hygiene gap in the cluster.

### Public API (window.St8DiveIn)

```js
window.St8DiveIn = { show, hide, isOpen, setStatus };
```

- `show(file)` — opens the overlay, builds geometry for that file,
  starts animation.
- `hide()` — hides the overlay, stops animation. Scene is preserved
  for re-use.
- `isOpen()` — boolean.
- `setStatus(file, status)` — re-color in-flight (rebuilds geometry
  with new status color).

---

## 5. Phase D — Make Ticket loop

The closing piece of the founder's collaboration cycle.

```
   particle click  →  notes popup  →  Make Ticket  →  POST /api/tickets
                                            ↓
                            HOOKS.TICKET_CREATED fired
                                            ↓
              (future: Sonic indexer / LLM claim-watcher reacts)
                                            ↓
                              phreak> picks up the ticket
```

### Flow

1. **Particle click** in the constellation triggers
   `bootConstellation`'s `onParticleClick` handler. For GREEN files it
   calls `window.handleFileNotes(filepath)` directly. For RED/YELLOW
   files it opens the Three.js dive-in first; the dive-in's
   "Notes / Make Ticket" button also calls
   `window.handleFileNotes(filepath)`.

2. **`showNotesPopup(filepath)`** (app.js) builds an overlay with three
   textareas (PURPOSE, DEPENDS ON BEHAVIOR, VALUE STATEMENT) seeded
   from the file's existing `intent` data. The footer has three
   buttons: CANCEL, SAVE, and a new **MAKE TICKET** button that calls
   `window.makeTicketFromNotes(filepath)`.

3. **`makeTicketFromNotes(filepath)`** (app.js, lines ~596 — 644):
   - Looks up the file in `window._st8FileIndex` (the in-memory
     manifest snapshot keyed by fingerprint, populated by
     `bootConstellation`).
   - Composes a `userNote` string by joining whichever of the three
     textareas have content, prefixed by their field name. If all
     three are empty the note becomes `(no note text)`.
   - POSTs to `/api/tickets` with body:
     ```js
     {
       fingerprint, filepath, sha256Hash, status,
       userNote,
       identityBundle: { intent, imports, importedBy, statusCounts }
     }
     ```
   - On `{ ok: true, id }`, closes the popup and surfaces visual
     feedback. On failure, an alert.

4. **Backend (`src/core/server/app.js _handleTickets`)** validates,
   inserts a row via `St8Persistence.createTicket`, logs a
   `TICKET_CREATED` activity entry, and fires `HOOKS.TICKET_CREATED`
   (`'ticket:created'` in the canonical HOOKS list at
   `src/core/hook-registry.js:64`).

5. **HOOKS.TICKET_CREATED** has no production subscribers yet — the
   plumbing is in place for the future Sonic indexer and phreak's
   badge counter, but neither subscribes today. See pending-roadmap.

`/api/tickets/count` is exposed but the phreak> TUI does not yet
render a live badge from it; see pending-roadmap.

---

## 6. Color tokens — gold / cyan / pink / purple / `--panel-accent`

The full token surface lives in `src/frontend/styles/tokens.css`:

```css
:root {
  --void:   #0A0A0B;
  --text:   #E0E0E0;
  --gold:   #D4AF37;
  --cyan:   #1FBDEA;
  --pink:   #C9748F;

  --gold-rgb: 212, 175, 55;
  --cyan-rgb: 31, 189, 234;
  --pink-rgb: 201, 116, 143;

  --panel-accent:     var(--pink);
  --panel-accent-rgb: var(--pink-rgb);

  --shelf-height:      12.5vh;
  --carousel-slide-ms: 320ms;
  --carousel-ease:     cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Where each token is meant to override

| Token | Where to override | Why |
|---|---|---|
| `--panel-accent` (+ `-rgb`) | per `.panel-column[data-panel="X"]` | each panel themes its own frame border + title |
| `--shelf-height`            | `:root`                            | tuning the lower band (1/8 of vh today) |
| `--carousel-slide-ms` / `-ease` | `:root`                        | global slide feel |
| `--void`, `--text`          | `:root`                            | base canvas + text |
| `--gold`, `--cyan`, `--pink` | `:root`                           | semantic hues — DO NOT override per-panel; use `--panel-accent` instead |

**Purple** (`#9D4EDD`) for COMBAT status is hardcoded in
`constellation.js` and `dive-in.js`'s `STATUS_COLOR` maps — it has no
token in `tokens.css` yet. See pending-tickets.

The `--*-rgb` triplet convention exists because `rgba(...)` needs
comma-separated RGB numbers, not a hex value. Any token that you
intend to use inside an `rgba(...)` call needs a matching `*-rgb`.

### Indirection chain example

```
.shelf border-top:  var(--panel-accent)
.shelf[data-active="st8"]:  --panel-accent: var(--cyan)
:root --cyan: #1FBDEA
```

So flipping `[data-active]` on the shelf changes its border color
purely through CSS variable cascade — no JS color manipulation.

---

## 7. How to add a fourth panel

The carousel was designed so that adding a panel is mostly
a CSS-data update, not a code change.

Suppose we want to add a `voicemail` panel on the far right (after
phreak):

### 1. Add the panel column to `index.html`

```html
<section class="panel-column" data-panel="voicemail">
  <div class="panel-frame">
    <div class="panel-titlebar"><span class="panel-title">VOICEMAIL</span><span>&nbsp;</span></div>
    <div class="panel-body" id="voicemail-host"></div>
  </div>
</section>
```

### 2. Widen the strip and add an offset stop in `carousel.css`

```css
.panels-strip {
  width: 400vw;                /* was 300vw */
}
.panels-strip[data-active="voicemail"] { --strip-offset: -300vw; }

/* Theming */
.panel-column[data-panel="voicemail"] {
  --panel-accent:     var(--gold);
  --panel-accent-rgb: var(--gold-rgb);
}
.shelf[data-active="voicemail"] {
  --panel-accent:     var(--gold);
  --panel-accent-rgb: var(--gold-rgb);
}
```

### 3. Update the diamond-visibility rule

```css
/* phreak is no longer the rightmost — voicemail is */
.shelf[data-active="explorer"]  .slide-diamond.slide-left,
.shelf[data-active="voicemail"] .slide-diamond.slide-right {
  opacity: 0;
  pointer-events: none;
}
```

### 4. Update `app.js`'s `SLIDE_TARGETS` and `diamondTarget`

```js
const SLIDE_TARGETS = ['explorer', 'st8', 'phreak', 'voicemail'];

function diamondTarget(direction) {
  const cur = strip.getAttribute('data-active');
  if (direction === 'left') {
    if (cur === 'voicemail') return 'phreak';
    if (cur === 'phreak')    return 'st8';
    if (cur === 'st8')       return 'explorer';
    return null;
  }
  if (cur === 'explorer') return 'st8';
  if (cur === 'st8')      return 'phreak';
  if (cur === 'phreak')   return 'voicemail';
  return null;
}
```

### 5. Register a mount entry (if interactive)

```js
panels.voicemail = {
  column:  document.querySelector('.panel-column[data-panel="voicemail"]'),
  host:    document.getElementById('voicemail-host'),
  mounted: false,
  mount() { if (this.mounted) return; /* mount your component */ this.mounted = true; },
};
panels.voicemail.mount();
```

That's the whole change. The diamond visibility, theming, and slide
animation all come from CSS variables flipping off the `data-active`
attribute — no per-panel JS layout math.

Note: with 4 panels the founder's "diamond points toward an adjacent
panel" rule still works, but the "ESC returns to st8" rule may need to
become "ESC returns to nearest center anchor" if more than one center
exists.

---

## 8. Known caveats

### Hooking particles.js internals (`pJS.particles.array`)

`constellation.js` reaches into `window.pJSDom[i].pJS.particles.array`
to decorate each particle with `fileId / filepath / fileStatus`. The
vendored particles.js is a pre-modular global-side-effect script
(`window.particlesJS(...)`), and this internal array is not part of a
documented public API — it's just an implementation detail we depend
on.

Risk: if we ever swap particles.js for a newer fork or a custom
renderer, this hook breaks. Mitigation today is just "don't update
particles.lib.js". See pending-tickets — a thin adapter would localize
the blast radius.

### IPv6 vs IPv4 (carries over from Sonic batch 027)

The Sonic daemon's canonical config binds `[::1]:1491`; some hosts
(sandboxed Linux, IPv6-disabled VMs) reject IPv6 binds and st8 falls
back to SQLite-only mode. That fallback is graceful for the backend,
but the **frontend has no awareness** of degraded mode — the
constellation will still try to recolor particles from
`/api/connection-state.json` either way, and any future Sonic-backed
search affordance in the shelf will silently produce no results
without a status indicator. See pending-roadmap.

### Sonic CDN vs local-vendoring decision

All Three.js (1.27 MB `three.module.js` + 8 addon files) is **vendored
locally** under `components/dive-in/three/`. Particles.js (43 KB) is
vendored as `components/constellation/particles.lib.js`. No CDN
fallback. Trade-off:

- (+) zero external network dependency, works fully offline / sandboxed
- (+) deterministic versioning — no upstream surprise
- (−) ~1.3 MB of vendored JS in the repo
- (−) no automatic upgrade path

The founder's bias is toward offline-first, so vendoring won. If
bundle size becomes an issue, the importmap could be re-pointed at a
CDN with a single edit in `index.html`.

### Importmap browser support

`<script type="importmap">` requires Chrome/Edge 89+, Safari 16.4+,
Firefox 108+. We assume modern Chromium — st8 is a developer tool,
not a public site. There is no fallback shim. Old Safari or pre-2023
Firefox would fail silently on the dive-in (the ESM script would
404-resolve `'three'`).

### `window.unloadVoidEngine` guarded calls

`app.js`'s `st8WorkspaceChanged` handler still has `if
(window.unloadVoidEngine) window.unloadVoidEngine();` calls and a
`window.loadVoidEngine().then(...)` branch for the `pretext-dev`
workspace. Per the HTML comment, void-engine was moved to a separate
project; these are guarded no-ops today. They should probably be
deleted — see pending-tickets.

### PRD wizard uses the old modal pattern

The PRD project wizard (markup in `index.html`, handlers
`openPRDWizard`/`createPRDProject` in `app.js`) still uses the
`.panel-overlay.open` modal pattern from before the carousel refactor.
Functionally it works (it's a CSS overlay over the whole carousel),
but it's stylistically inconsistent with the new slide-based model.
See pending-tickets.

### The `.dock-diamond` rule is defined but unused

`carousel.css` ends with a `.dock-diamond { ... }` block (with
hover/active states) for "outer dock diamonds" that batch 027's design
called for. No element in `index.html` or any component carries that
class today — the diamonds are all `.slide-diamond` inside the shelf.
The CSS is harmless but dead. See pending-tickets.

### Polling instead of SSE for particle re-color

`bootConstellation()`'s 5-second `setInterval` re-fetches the entire
manifest every tick. The SSE mutation stream already exists at
`/api/mutations` and is consumed by `initMutationStream` for toasts;
the constellation just isn't wired into it yet. See pending-roadmap.

### Status-color map duplication

Both `constellation.js` and `dive-in.js` carry their own
`STATUS_COLOR` table (one as `{r,g,b}` floats, the other as hex
`0x...`). They are kept in sync by hand. See pending-tickets — a
shared `status-colors.js` module would prevent drift.
