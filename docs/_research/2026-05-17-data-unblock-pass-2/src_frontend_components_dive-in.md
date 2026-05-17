# Research — `src/frontend/components/dive-in/`

Wave: data-unblock-pass-2 (2026-05-17). Read-only audit. Lens:
backend-signal accuracy, post-batch-031 unlocks, and the founder's
P1.1 signal-path visualization.

## 1. File inventory

| Path | LOC | Role |
|---|--:|---|
| `src/frontend/components/dive-in/dive-in.js` | 671 | ESM module. Public API on `window.St8DiveIn = { show, hide, isOpen, setStatus, destroy }`. Builds Barradeau particle building (Delaunay triangulation -> 15 vertical extrusion layers -> inverse-edge-length particle density) for a single file. Owns Three.js scene + overlay DOM + emergence animation. |
| `src/frontend/components/dive-in/dive-in.css` | 157 | Visual rules: `#dive-in-overlay`, `.dive-in-header`, `#dive-in-close`, `#dive-in-notes`, `#dive-in-canvas-host`. `.open` class drives display; `@media (prefers-reduced-motion)` + small-viewport breakpoints present (Wave 7C tickets 0/1). |
| `three/three.module.js` | 53,044 | Vendored Three.js core (unmodified upstream). |
| `three/controls/OrbitControls.js` | (vendored) | Damped orbit + autoRotate. |
| `three/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,MaskPass,ShaderPass}.js` | (vendored) | Bloom pipeline. |
| `three/shaders/{CopyShader,LuminosityHighPassShader}.js` | (vendored) | Bloom-pass dependencies. |

No subdirectory tests; per-file tests live under `tests/frontend/` only for the shared `status-colors.js` consumer contract.

## 2. Backend endpoints consumed (table)

| Endpoint | Consumed by dive-in today? | Notes |
|---|---|---|
| `GET /api/connection-state.json` | **Indirectly** — `app.js:245` populates `window._st8FileIndex` keyed by fingerprint; dive-in receives a `file` object from that map via `St8DiveIn.show(file)` (`app.js:267-268`). | Single live data path into the panel. |
| `POST /api/signal-path` / `GET /api/signal-path` | **NO** | Backend exists at `app.js:1483` (`_handleSignalPath`), verified live in identity-and-analysis review (22ms, real `orderedFiles`, scoped reachability). Frontend never fetches it. |
| `GET /api/insights` | **NO** | Backend live (review confirms `categorySummary={orphan:237, under-connected:67}` + 50-row recent feed). Zero frontend callers — `grep '/api/insights' src/frontend/` returns nothing. |
| `GET /api/identity-risk` | **NO** | Backend present (`app.js:1674`). No frontend reader anywhere in `src/` (identity-and-analysis review ticket 5 flagged the orphan reader). |
| `GET /api/events` (SSE) | **NO direct subscription** | `app.js` has a global SSE handler (`/api/mutations`, line 1155) that recolors particles. The dive-in module exposes `setStatus()` but is never called from the SSE handler — flips would only fire if a future hook in `app.js` invokes `window.St8DiveIn.setStatus`. |
| `/api/locks` | **NO** | Documented as a Wave 8/louis-and-locking deferral; data source does not yet exist. |
| `/api/generate-report` | **NO** | Backend live (Markdown + JSON envelopes). No frontend caller. |

## 3. Data-accuracy state per endpoint post-batch-031

| Endpoint | Pre-batch-031 | Post-batch-031 (today) |
|---|---|---|
| `/api/signal-path` | Worked but `connections` table was 363 rows of substring-matched false-positives (`main.js` returned 6 wrong outgoing edges). Topo sort + `orderedFiles` were polluted by phantom edges. | **ACCURATE.** Connection-resolver rewrite (`71ff908`) emits 188 unique real edges; `main.js` now produces 16 correct edges. Signal-path's BFS scope, `orderedFiles`, `upstreamCount`/`downstreamCount`, and scoped reachability are computed from a true dependency graph. |
| `/api/insights` | Five ad-hoc categories (`orphan / red-status / under-connected / under-imported / high-impact`). No canonical-13 producers wired. | One canonical category now flows: **`circular_dependency`** via `cycle-insight-emitter.js` (P=37 INDEX_COMPLETE subscriber). st8-on-itself returns 0 cycles (a true negative). Ad-hoc taxonomy still coexists in the same table. |
| `/api/connection-state.json` (manifest of `file` rows fed to dive-in) | `imports`/`importedBy`/`status`/`reachabilityScore` derived from polluted connections. | Same fields, now derived from the corrected connection set — `file.status`, `reachabilityScore`, `impactRadius` more trustworthy. |
| `/api/identity-risk` | No reader. | Still no reader (Wave 3C deferred). |

## 4. UI surfaces gated on data — what's now reachable, what's still blocked

**Reachable today (data is real, UI consumes it):**
- Overlay opens for `RED` / `YELLOW` files only (`app.js:266-268`).
- Header text: `filepath`, `status`, `exports.length`, `fileSizeBytes` (`dive-in.js:431-436`).
- Building geometry: `fileSizeBytes` -> derived `lineCount` (`build()` at line 220), `exports.length` -> height (line 222). LOCKED colour fallback present though never triggered (file.locked is never set — louis-and-locking is dormant).
- Emergence animation (ticket 11) — scatter -> position, cyan -> status colour, ease-out cubic over 2500ms. Fires every `buildForFile`.

**Newly RENDER-READY but UNREACHED (data flows, UI does not subscribe):**
- **Signal-path chain visualization.** `/api/signal-path` now returns trustworthy `orderedFiles` + counts. The dive-in scene has no panel, no fetch, no visual primitive for it. This is FOUNDER PRIORITY #1 per `docs/components/identity-and-analysis.md:261` and `signal-path-adapter.js` header — "Frontend integration (dive-in panel visualization) is Wave 7 scope". Not yet executed.
- **Per-file insights overlay.** `GET /api/insights?filepath=…` returns category + severity + evidence rows for the focal file (review verified). Dive-in could render these as a side card or floating sprites near the building; no consumer code today.
- **Cycle highlight.** Now that `circular_dependency` records ship, a RED-because-in-a-cycle file could light up its building with a distinct cycle-aware visual (e.g. red ring around the focal building). Data exists; renderer does not subscribe.
- **Identity-risk badge.** `.st8/identity-risk.json` writes happen (Wave 3A) but no reader; a small badge "this file's birthtime was unreliable, identity rescued by reuse" would be a one-fetch addition.

**Still gated (waiting on backend):**
- Red lock indicator — explicitly deferred until louis-and-locking Phase L1 ships `/api/locks` and the LOCK_STATE hook. Documented at `dive-in.js:28-66`.
- COMBAT state (purple 0x9D4EDD) — defined in `STATUS_COLOR` but `file.status` from `/api/connection-state.json` never emits `'COMBAT'`. Backend has no producer for it yet.

## 5. Three.js scene / scene composition

- `WebGLRenderer({ antialias:true })`, DPR capped at 2, clear colour `0x0A0A0B` (void).
- `Scene` + `FogExp2(0x0A0A0B, 0.02)`.
- `PerspectiveCamera(50, aspect, 0.1, 500)` at `(25, 20, 25)`. Target recentered to building midpoint (`buildForFile` line 611-613).
- `OrbitControls` — `enableDamping`, `autoRotate=true` while overlay `.open`. Stopped on hide (ticket 17), restored on show.
- `EffectComposer`: `RenderPass` + `UnrealBloomPass(strength=1.2, radius=0.4, threshold=0.1)`.
- Particle material: custom `ShaderMaterial`, additive blending, per-vertex `size` attribute, `gl_PointSize = size * (150 / -mv.z)`; vertex shader applies `sin(uTime*0.5 + x*0.3)*0.05` y-shimmer.
- Line material: `LineBasicMaterial({ color:0xFFFFFF, opacity:0.05, blending:AdditiveBlending })` — barely-visible Delaunay ghost.

**Scene state singleton (`state` object, line 316-341):** holds `renderer`/`scene`/`camera`/`controls`/`composer`/`points`/`lines`/`particleMaterial`/`animId`/`clock`/`currentFile`/`emergence`. Scene persists across hide/show; full disposal only via `destroy()` (HMR path).

**Backend shapes that feed the scene:**
- `file.fileSizeBytes` (number) → `lineCount` proxy → footprint complexity + radius (`makeFootprint`).
- `file.exports` (array) → height (`heightPerExport=0.8` per export).
- `file.status` (`GREEN`/`YELLOW`/`RED`/`COMBAT`/`LOCKED`) → particle colour via `STATUS_COLOR`.
- `file.locked` (boolean) → never set today; LOCKED branch unreachable.
- `file.fingerprint` → identity gate for `setStatus()`.

No use of `imports[]` / `importedBy[]` / `reachabilityScore` / `impactRadius` in the geometry today even though they ship in the `_st8FileIndex` payload.

## 6. Mock / stub regions

- **Default `lineCount` fallback**: `file.fileSizeBytes ? Math.max(20, floor(bytes/60)) : 100`. The `: 100` literal is a stub for files without `fileSizeBytes` — not a bug, just a soft default. Real LOC comes from the indexer.
- **`exports.length || 1` height fallback**: same shape. No-export files get a minimum-height tower.
- **STATUS_COLOR fallback** (`dive-in.js:98`): if `window.St8StatusColors` is missing, an inline hex map is used. Documented with `console.warn`. Not stub-data; load-order safety net.
- **`emergence` animation** — was historically a documented stub (`emergenceMs: 2500` defined but unused per old roadmap line 76). Now LIVE (ticket 11, line 585 onward).
- **Red lock indicator** — entire feature is a documentary stub at lines 28-66 (DEFERRAL NOTE). No code skeleton.

No fetch calls inside the module → no stubbed HTTP responses.

## 7. TOP 3 QUICK WINS

**1. Wire `/api/signal-path` into the dive-in overlay (FOUNDER P1.1).**
On `show(file)`, fetch `GET /api/signal-path?filepath=${file.filepath}` (no auth required). Render the returned `pathSummary.orderedFiles` as a left-rail list (chain of upstream deps) and `upstreamCount`/`downstreamCount` as header chips next to the existing `status / exports / bytes` line. Backend already accurate post-batch-031. Estimated effort: ~80 LOC + a CSS rail. This is the documented Wave 7 hand-off and the founder's #1 priority — the data has been waiting for the renderer since Wave 3B.

**2. Wire `/api/insights?filepath=…` as a "why is this RED?" side card.**
Dive-in opens for RED/YELLOW files specifically — exactly the set with non-empty insights. Render the returned insight rows (category, severity, evidence, related_node_ids). Post-batch-031 the set includes one canonical `circular_dependency` category alongside the ad-hoc taxonomy. Backend live, frontend zero-consumer. ~50 LOC.

**3. Visually highlight cycle membership in the building.**
When the insights response for the focal file contains a `category: 'circular_dependency'` record, swap the line material from the ghost-white 0xFFFFFF to red 0x1FBDEA at higher opacity, or pulse the bloom strength. Single new code path keyed off insight data; uses geometry already in the scene. Showcases the batch-031 pipeline visibly. ~20 LOC.

(Optional fourth: subscribe `setStatus` to the existing `/api/mutations` SSE handler in `app.js`, so a live LIFECYCLE_TRANSITION on the focal file re-colours the building without requiring a fresh click. The wiring is one `if (window.St8DiveIn?.isOpen()) window.St8DiveIn.setStatus(file, status)` line in `app.js`'s mutation handler.)

## 8. Cross-directory dependencies

- `src/frontend/app.js:267-268` — sole call site for `window.St8DiveIn.show(file)`. The `file` object originates from `/api/connection-state.json` (`app.js:245`).
- `src/frontend/components/status-colors.js` — single source of truth for status hex/RGB (Wave 7C ticket 9). Dive-in reads `.INT`; constellation reads `.RGB`. Both fall back to inline maps on load failure.
- `src/frontend/index.html:206-207` — importmap declaring `three` and `three/addons/` -> vendored copies. Hard-fail probe at lines 218-243 surfaces a banner if importmap is unsupported.
- `src/features/analysis/signal-path-adapter.js` — produces the data dive-in does not yet fetch. Header comment explicitly names dive-in as the Wave 7 consumer. `computeSignalPath` returns `pathSummary.orderedFiles` (filtered `copy_file` migration steps), `upstreamCount`, `downstreamCount`, `graphProperties`. Post-batch-031 it reads accurate `connections` rows.
- `src/features/analysis/insight-store-populator.js` + `src/features/analysis/cycle-insight-emitter.js` — produce the records `/api/insights` returns. Both write to `scaffolder_data.sqlite` (NOT `st8.sqlite`) per the InsightStore TS contract.
- `src/features/analysis/insight-store.js` — read path for `/api/insights`. Singleton via `getInsightStore(dbPath)`.
- `src/core/server/app.js:1483` (`_handleSignalPath`), `1638` (`_handleInsights`), `1674` (`_handleIdentityRisk`) — three live consumer endpoints waiting for the dive-in to call them.
- `src/features/analysis/relationship-analyzer.js:computeTarjanSCC` — now live via `persistence-cycle-detector.js` (batch 031). Was dormant pre-031.

## 9. Gaps + open questions

- **Persistence cost per dive-in click.** `/api/signal-path` opens a fresh `St8Persistence` per request (~30ms; identity-and-analysis review cross-cluster flag #3). If signal-path becomes a per-click fetch, switching to `getSharedPersistence()` (post-Wave-1 singleton) would help. Cross-cluster concern; not a dive-in fix.
- **Insights live in `scaffolder_data.sqlite` not `st8.sqlite`.** Documented in identity-and-analysis review cross-cluster flag #1. Survives `rm -rf .st8`. Not blocking dive-in consumption but flagged as a future retention-policy decision.
- **No SSE subscription in dive-in.** The module is purely click-driven. A LIFECYCLE_TRANSITION on the focal file does not flow into the open overlay. `app.js`'s `/api/mutations` SSE handler could mediate; today it does not call `St8DiveIn.setStatus`.
- **COMBAT status producer absent.** The colour and the LOCKED colour both exist on the consumer side but the backend never emits either `status` value. Both branches in `buildForFile`'s color resolution are currently dead at runtime.
- **`imports[]` / `importedBy[]` / `impactRadius` / `reachabilityScore` unused.** The `file` payload from `/api/connection-state.json` carries them; the dive-in does not visualise them. Signal-path adoption (Quick Win #1) is the natural place to surface them.
- **`identity-risk.json` orphan** — still no reader. The dive-in's header is the obvious place ("this file's identity was rescued by birthtime-reuse on $date").
- **Test coverage** — no tests under `tests/frontend/components/dive-in/`. The module is geometry-heavy and DOM-coupled; smoke tests would need a JSDOM + Three.js stub harness. Out of scope for this audit.
- **`emergenceMs` knob now load-bearing.** With emergence live, the 2500ms duration is the user-perceived "into the dimension" cadence. Worth a roadmap mention if any future panel-rail wants to time-align with it.

═══

**Summary in one line:** dive-in is a fully-wired Three.js renderer with zero `/api/` consumption beyond the constellation manifest; the three founder-priority backends (`/api/signal-path`, `/api/insights`, `/api/identity-risk`) are accurate, live, and unsubscribed — the data has been waiting for the renderer since Wave 3B, and batch 031 made the underlying connection graph correct enough that the signal-path it returns now matches reality.
