# Research: `src/frontend/components/constellation` — data unblock pass 2

Date: 2026-05-17
Agent: research (read-only)
Scope: `/home/user/st8/src/frontend/components/constellation/{constellation.js, particles.lib.js}` + integration in `app.js`, `services/coordination.js`, and the canonical color module `components/status-colors.js`.

---

## 1. File inventory

| File | LOC | Role |
|---|---|---|
| `src/frontend/components/constellation/constellation.js` | 315 | The st8-specific wrapper around particles.js. IIFE; exports `window.St8Constellation` (`init`, `setFiles`, `updateFileStatus`, `refocus`, `destroy`). Maps `file_registry` rows 1:1 to particles, decorates each `pJS.particles.array[i]` with `{ fileId, filepath, fileStatus, color }`, hand-rolls a 32-px nearest-particle click hit-test. |
| `src/frontend/components/constellation/particles.lib.js` | 1574 | Unmodified vendored particles.js v2.0.0 (MIT). Globals: `window.particlesJS`, `window.pJSDom`. Header is a documentary contract block (Wave 7B ticket 8) — `DO NOT EDIT`. |
| `src/frontend/components/status-colors.js` | 101 | Canonical color truth (Wave 7C ticket 9): `HEX/INT/RGB/resolve/resolveInt`. Both constellation.js and dive-in.js consume this. GREEN=`D4AF37`, YELLOW=`D4AF37`, RED=`1FBDEA`, LOCKED=`C9748F`, COMBAT=`9D4EDD`. |

Boot lives in `src/frontend/app.js:232–291` (`bootConstellation()` + DOMContentLoaded gate). Live re-color subscriber at `app.js:340–357` (`window.addEventListener('st8:mutation', ...)`). Initial state fetch is `GET /api/connection-state.json` only.

---

## 2. Data signals driving rendering (signal → particle attribute)

| Backend signal | Consumed via | Particle attribute |
|---|---|---|
| `file.status` (GREEN/YELLOW/RED) | manifest `files[].status` | `p.color` via `statusColor(file)` (RGB lookup) + `p.fileStatus` |
| `file.locked` (boolean) | NOT in manifest today — see Gap §9 | `p.color` LOCKED override IF present (currently always falsy) |
| `file.fingerprint` (`<filepath>\|\|<ISO-birth>`) | manifest `files[].fingerprint` | `p.fileId` (identity key for `updateFileStatus`) |
| `file.filepath` | manifest `files[].filepath` | `p.filepath` (passed to onParticleClick → dive-in lookup) |
| `file.imports` / `file.importedBy` | populated in manifest (post-batch-031: accurate) | UNUSED by constellation — particles.js auto-strands by proximity, not by edge data |
| `file.reachabilityScore` | populated in manifest | UNUSED |
| `file.impactRadius` | populated in manifest | UNUSED |
| `file.intent.{purpose,...}` | manifest | UNUSED — only the click handoff to dive-in / handleFileNotes |
| Particle x/y/size/opacity | none — randomized by particles.js | drift via `move.speed: 0.6`, `out_mode: 'bounce'`, size random 0–4, opacity anim 0.6→0.85 |
| `line_linked` strands | none — geometric proximity | `distance: 140px`, `color: --cyan`, `opacity: 0.18` |

Color count today (st8-on-itself per the wave brief): 1 GREEN / 77 YELLOW / 244 RED. Both YELLOW and GREEN render as the same gold (`D4AF37`) — YELLOW is desaturated only at the dive-in shader, not in the constellation.

---

## 3. Backend endpoints consumed + current accuracy state

| Endpoint | Method | Where | Accuracy post-batch-031 |
|---|---|---|---|
| `/api/connection-state.json` | GET (initial fetch) | `bootConstellation()` app.js:245 + `_serveManifest` app.js:554 (in-process cache, mtime-gated) | `status`, `fingerprint`, `filepath`, `filename` populated. `imports` / `importedBy` populated, **and post-batch-031 ACCURATE** (connection-resolver replaced the substring matcher: 363 false rows → 188 correct; main.js outgoing 6 wrong → 16 right). `reachabilityScore` / `impactRadius` populated but not consumed. `intent` populated. NO `cycles` field on either the file or the manifest envelope — even though `ctx.result.cycles` now threads through INDEX_COMPLETE. |
| `/api/mutations` | GET (SSE) | `app.js:1155` EventSource → `mutationSource.onmessage` → `window.dispatchEvent('st8:mutation', detail)` | Payload shape: `{ fingerprint, filepath, mutationType, actor, schemaCard, timestamp, ... }`. Constellation listener at app.js:340 only reads `data.schemaCard.status` and recolors. Skips DELETE on purpose (schemaCard is null). |

The constellation does NOT consume `/api/insights` — the cycle records that batch 031 made canonical (`category='circular_dependency'`) are written to `insight_store` but never reach the particle layer. Same for `/api/identity-risk` and `/api/signal-path`.

---

## 4. UI affordances that would benefit from canonical-category data

1. **Cycle highlight on hover/click.** Now that `insight_store` carries deterministic `circular_dependency` rows with `evidence='C.js → B.js → A.js → C.js'`, hovering a particle that participates in a cycle could outline (color-cycle) the other cycle members. Today the strands are purely geometric — a real cycle is invisible in the visual.
2. **Edge rendering from `imports`/`importedBy`.** Post-batch-031 these arrays are trustworthy (resolved relative paths, not substring guesses). A subtle "show 1-hop dependency cone on hover" pass would replace particles.js's proximity strands with semantic ones near the focused particle. Roadmap P2 "Hover states / interaction feedback on particles" already names this gap.
3. **Status-based size or opacity.** The 244 RED particles all glow identical cyan; pairing size with `impactRadius` would let founders read "big cyan = wide blast radius, small cyan = leaf bug". Backend data already populated.
4. **LOCKED color routing.** `statusColor` honors `file.locked` → pink, but the manifest's `files[].locked` field is not emitted. Plumbing it through `generateConnectionState` would activate the existing color path with zero frontend change.
5. **COMBAT (agents-active) overlay.** Token + color routing exist (RGB `{r:157,g:78,b:221}`); no producer yet. Would surface louis/ticket-claim state on the relevant particles.

---

## 5. Mock / stub regions

None in the constellation files themselves. The closest things:

- `statusColor()` falls back to inline `STATUS_COLOR` (constellation.js:50-56) if `window.St8StatusColors` is missing — fail-soft, not a stub.
- particles.js itself is decorative-particle scaffolding; constellation.js mutates its plain-object particles directly. No mocks.
- `bootConstellation` swallows a manifest fetch failure with `console.warn` and leaves `_st8FileIndex = {}` (app.js:244). Graceful degradation, not stub data.

---

## 6. SSE event handling — which events handled, which ignored

Routed via `app.js:1162` `mutationSource.onmessage` → `window.dispatchEvent('st8:mutation')`.

Constellation's listener (`app.js:340-357`):

| Event field | Handled? |
|---|---|
| `data.type === 'connected'` | Skipped (handshake) |
| `data.schemaCard.status` present | `updateFileStatus(fingerprint, status)` — recolor one particle |
| `data.schemaCard` null (e.g. DELETE) | Skipped intentionally; comment says "reconciled on next full manifest reload" — but there IS no full manifest reload anymore (the 5s poll was retired). The particle for a deleted file lingers gold/cyan until the next bootConstellation. |
| `data.mutationType === 'CREATE'` | Skipped — particle count is fixed at init; new files don't appear until `setFiles()` is called externally, which no code does |
| Bruno/Oscar/AI_REVIEW/ARCHIVE mutations | Routed only to toast layer (app.js:1188-1201), never to constellation |
| `LIFECYCLE_TRANSITION` (concept→draft→prod) | No constellation reaction (status remains GREEN/YELLOW/RED) |
| `LOCK` mutation | Would recolor IF `schemaCard.locked` flowed, but the constellation only reads `.status` |

**Ignored / not-yet-rendered SSE events**: CREATE (no particle is born), DELETE (particle never dies), CONCEPT (concept registration), LOCK (could light pink), PRODUCTION (★), PURGE.

---

## 7. TOP 3 QUICK WINS

1. **Emit `cycles` into `connection-state.json` (or expose `/api/insights?category=circular_dependency`) and overlay them.**
   Post-batch-031 the canonical cycle records exist in `insight_store`; constellation.js could subscribe at init, store a `fingerprint → cycleMembers[]` map, and on `onParticleClick` (or hover) drop a brief animation that pulses the other members. Zero risk — read-only consumption of data that's already accurate. Largest "constellation now tells a richer story" win for the smallest diff.

2. **Plumb `locked` through `generateConnectionState`.**
   `manifest-generator.js:95-110` currently omits `file.locked`. `statusColor()` already routes it to LOCKED (pink, `C9748F`). One field addition (and a probe to confirm louis writes the flag on `file_registry`) lights up the existing color path. No frontend change required.

3. **Handle CREATE / DELETE in the SSE subscriber.**
   The 5s poll's retirement (Wave 4D) left a hole — particles never appear/disappear between full reloads. Extend `app.js:340` to: on `CREATE`, call `St8Constellation.setFiles(window._st8FileIndex.values() + new file)`; on `DELETE`, mark the particle's `fileId=null` and drop it. The `setFiles` path already exists and re-inits when the count changes (constellation.js:249-258).

(Bonus runner-up: vary particle `size` or `opacity` by `impactRadius` — 1-line change in `bindFilesToParticles`, surfaces an already-populated field.)

---

## 8. Cross-directory dependencies

Inbound (who calls constellation.js):
- `src/frontend/app.js` — sole consumer of `window.St8Constellation` (`init` at L254, `updateFileStatus` at L353).
- `src/frontend/index.html:195-196` — loads `particles.lib.js` then `constellation.js` (load-order matters; documented contract).

Direct dependencies (what constellation.js reaches into):
- `window.particlesJS` and `window.pJSDom` — globals from particles.lib.js.
- `window.St8StatusColors` (from `components/status-colors.js`).
- DOM: `#stage` host element (inside `.panel-column[data-panel="st8"]`).

Adjacent components reading from the same data:
- `src/frontend/components/dive-in/dive-in.js` — same manifest + same color module; constellation's `onParticleClick` hands off to it when status is RED/YELLOW.
- `src/frontend/services/coordination.js:91` — its OWN `/api/mutations` EventSource for manifest reload (separate stream client from app.js's; both are live).

No tests directly probe particles.js behavior. There is `tests/frontend/constellation-destroy-guard.test.js` (6 probes) + `tests/frontend/status-colors.test.js` (10 probes).

---

## 9. Gaps + open questions

- **Status counts unmoved by batch 031** (1/77/244) — gap-analyzer still reads the integr8 in-memory graph (per CLAUDE.md). Constellation surfaces gap-analyzer output, not the new connections table. Fixing this is a backend wave, not a frontend one — but the constellation visualization will inherit the fix for free.
- **No `cycles` field on connection-state.json.** `ctx.result.cycles` exists from batch 031 onward but `manifest-generator.js:84-113` never serializes it. Adding `manifest.cycles` (or a `files[].inCycles` boolean) is one branch of quick-win #1.
- **`locked` field absent from manifest** — backend gap.
- **Particle CREATE/DELETE gap** — frontend gap (above).
- **`refocus()` is unused** — the function exists but no caller in the tree. Could be wired from explorer-row clicks (slide to st8 panel + refocus to clicked file).
- **Hover-tooltip stub** — Wave 7C ticket 13 (PERF NOTE re O(N) nearestParticle) cites a roadmap entry. Hover would re-use the same scan; spatial-index deferred until ~5k files.
- **YELLOW and GREEN visually identical** — both map to `D4AF37` gold. Per status-colors.js comment "YELLOW desaturated via opacity at call site" but constellation.js does no per-status opacity tweak. Either intentional (constellation is low-fidelity, dive-in handles the distinction) or a latent quick win.
- **`data.schemaCard` null on DELETE → particle persists** — explicit gap noted at app.js:346-348 ("reconciled on the next full manifest reload"). There IS no reload anymore.
- **Open Q**: should `/api/insights` be polled at boot to seed cycle overlay, or should the SSE stream gain an `INSIGHT_EMITTED` mutation type to push insights live? Both are recipe-A-shaped per batch 031.
