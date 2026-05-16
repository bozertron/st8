# server-api-and-legacy-frontend — roadmap

Generated 2026-05-15. Companion to
`docs/components/server-api-and-legacy-frontend.md` and
`docs/_pending-tickets/server-api-and-legacy-frontend.json`.

Scope: the 23-route HTTP API in `src/core/server/app.js`, the
`main.js` boot sequence, and the three legacy frontend components
(file-explorer, terminal, graph-viewer).

---

## P1 — close the LLM-collaborator loop

### P1.1 — `/api/tickets/:id/claim` + `/api/tickets/:id/resolve` endpoints

The persistence layer has `createTicket`, `getOpenTickets`, and
`countOpenTickets`. The HTTP surface only exposes list + create.
Without claim / resolve, the LLM-collaborator workflow has no way to
move a ticket through its lifecycle over HTTP.

- Add `POST /api/tickets/:id/claim` — sets a `claimedBy` + `claimedAt`,
  fires `HOOKS.TICKET_CLAIMED`.
- Add `POST /api/tickets/:id/resolve` — sets `resolvedBy` +
  `resolvedAt` + `resolution`, fires `HOOKS.TICKET_RESOLVED`.
- The route table currently has no regex-matched path params except for
  `/api/prd-projects/<name>`; reuse that pattern.
- Cross-cluster: hooks-and-integration owns the new HOOKS constants.

**Acceptance.** An LLM agent can POST to `/api/tickets/:id/claim`, do
work, POST to `/api/tickets/:id/resolve`, and the phreak> badge count
(`/api/tickets/count`) reflects the change.

### P1.2 — `/api/llm-call` endpoint

Settings-and-providers also lists this; tracked here from the API
surface angle. Without it the provider settings stored under
`/api/settings?category=llm` have no consumer.

- `POST /api/llm-call` with `{provider, model, messages,
  settingsCategory?}`.
- Server looks up credentials via `persistence.getSettingsByCategory`.
- Streams tokens back via SSE (reuse `notificationBus.addSSEClient`-style
  pattern? or a new dedicated stream).
- Body-size cap should be larger than the 1KB default — message arrays
  fly past that. 64KB is reasonable.

**Cross-cluster owner:** settings-and-providers will design the
provider abstraction; this cluster owns the HTTP wiring.

---

## P2 — modernise + harden

### P2.1 — Replace D3-from-CDN in graph-viewer

`graph-viewer.js:18-40` injects
`<script src="https://d3js.org/d3.v7.min.js">` at runtime. Conflicts
with the founder's desktop-first stance set during Sonic integration.

Decision points:

1. Is the connection graph still relevant given the
   particles.js / Three.js dive-in pattern (frontend-experience cluster)?
   The constellation view already renders files; the graph view
   visualises **edges** that the constellation doesn't.
2. If yes — bundle D3 locally (`npm i d3` + Rollup, or pin a vendored
   build under `src/frontend/vendor/d3.v7.min.js`).
3. If no — delete graph-viewer.js, retire the `_showGraph` action in
   terminal.js, and document the deprecation.

Either resolution unblocks the desktop bundle.

### P2.2 — Decouple terminal.js from `window.renderFileList`

`terminal.js:624` calls `window.renderFileList(filtered)`. The global
does not exist. The `_isolateFiles` action and the `#void-file-list`
element are vestiges of the founder's pre-session design that didn't
make it into the carousel.

Two options:

1. **Delete.** Remove `_isolateFiles`, `_clearVoid`, and the
   isolate-RED/YELLOW/GREEN actions. About 60 lines.
2. **Wire up.** Add a third carousel slot or a shared file-list service
   (`window.St8FileListView` with a `render(files)` method) that the
   terminal calls. The void-file-list pop-out would become a real
   carousel column.

The founder's recent Sonic guidance suggests we are stripping legacy UI
not adding to it — option 1 is the default.

### P2.3 — OpenAPI / Swagger generation from the route table

Refactor `_handleApiRequest` (`app.js:83-158`) into a table-driven
registry:

```js
const ROUTES = [
  { method: 'GET',  path: '/api/health',  handler: '_serveHealth',  summary: '...' },
  { method: 'POST', path: '/api/index',   handler: '_handleIndex',  summary: '...' },
  ...
];
```

Generate `openapi.json` from `ROUTES` at boot; serve it from
`/api/openapi.json`. The 23-route inventory in
`docs/components/server-api-and-legacy-frontend.md` becomes the
acceptance test.

Knock-on benefit: Sonic and the LLM-collaborator loop both gain a
machine-readable surface.

### P2.4 — Backfill missing body-size limits

`/api/record-commit` and `/api/tickets` have no `MAX_BODY_SIZE` cap.
Both were added after the convention was set and skipped the dance.

- record-commit — 4 KB (commit payload + filesChanged list).
- tickets — 8 KB (note + identityBundle can be longer).

### P2.5 — Path-traversal audit across all path-accepting routes

`_handleFileList` uses `path.relative()` for boundary semantics —
correct. `_serveStaticFile` (`app.js:174`) still uses
`fullPath.startsWith(STATIC_DIR)` — the same insecure pattern that was
fixed in `_handleFileList`. Audit + fix the remaining handlers:

- `_serveStaticFile` (174)
- `_handleIndex` (`{path}` body)
- `_handleVerify` (`{path}` body)
- `_handleConceptFile` (`{filepath}` body)
- `_handleMarkReviewed` (`{filepath}` body)

### P2.6 — `readJsonBody` helper

17 POST handlers reimplement the same data/end/close/413/JSON.parse
dance with subtle drift. Extract a `readJsonBody(req, res,
{maxSize})` Promise helper and wrap each handler. Side benefit: the
`req.on('close')` leak in `_handleSettings` becomes the default.

### P2.7 — `/api/connection-state.json` lag

The endpoint reads the on-disk manifest, which lags SQLite by however
long the manifest writer takes. Either:

- Generate JSON on demand from SQLite (`persistence.getAllFiles` +
  `persistence.getAllIntents`), or
- Add `?fresh=1` that triggers a re-write before responding.

The first option also removes the `/api/file-intent` "rewrite manifest
in place" side door.

---

## P3 — convention + polish

### P3.1 — REST conventions audit

Routes today are a mix of resource-style (`/api/tickets`,
`/api/prd-projects`), action-style (`/api/mvp-lock`,
`/api/bruno-call`, `/api/oscar-house`, `/api/production-promote`), and
hybrid (`/api/file-intent`, `/api/mark-reviewed`). Document a style
guide and reconcile during the OpenAPI refactor (P2.3).

### P3.2 — Rate limiting + auth

st8 binds to `127.0.0.1` only and CORS is locked to the same origin —
the surface is loopback-only by design. If we ever expose st8 over a
LAN (or tunnel it) we need:

- Per-IP rate limit on POST routes (especially `/api/index`,
  `/api/mvp-lock`, `/api/bruno-call`).
- Bearer-token auth on write routes.
- Origin lock removed in favour of explicit allowlist config.

Not urgent — flagged so the desktop-bundling story doesn't accidentally
expose the surface.

### P3.3 — Migrate PRD wizard into the carousel pattern

`src/frontend/index.html:125` declares
`.panel-overlay#overlay-prd-wizard` — still a modal. Frontend agent
explicitly kept it that way. File-explorer.js:362 hard-codes
`onclick="window.openPRDWizard()"` which assumes the modal pattern. If
the PRD wizard becomes a 4th slide, the explorer's button signature
changes.

Either:

- Decide to keep the modal and document the why, OR
- Migrate to a 4th carousel column ("PRD" slide). Hide the slide unless
  the user has run INDEX (so it's not a permanent column).

### P3.4 — file-explorer error-banner: replace MutationObserver hoist

`src/frontend/app.js:59-69` uses `new MutationObserver` to detect when
`.explorer-error-banner` appears inside the explorer host and forcibly
move it into the column titlebar. Fragile — any DOM-structure change
inside file-explorer.js silently breaks the presentation.

Replace with either:

- A CustomEvent (`explorer-error` / `explorer-error-cleared`) the shell
  listens for, OR
- A render slot that the explorer fills via a callback the shell passes
  into `mount()`.

### P3.5 — Phone state machine — lean in or simplify

`phoneOffHook` is read by exactly one consumer (the status line in
`app.js`). The "phone off hook = signals suppressed" metaphor is
charming but undocumented. Either:

- Wire SSE-driven notifications through `phoneOffHook` globally so it
  becomes a real "do not disturb" toggle, OR
- Rename to `notificationsMuted` and drop the SVG.

### P3.6 — Clean up dead constants in terminal.js

- `PHREAK_API = '/api/v1/exec'` (line 43) — comment says "dead", delete.
- `_isolateFiles` / `_clearVoid` paths — see P2.2.
- Hidden-files toggle in file-explorer.js (`LS_SHOW_HIDDEN` undefined,
  no button wires it).

### P3.7 — BULK_INDEXED hook (defer of BOOT-001 / Wave 5G ticket 15)

`main.js` fires `HOOKS.FILE_INDEXED` once per file inside the Pass-1
upsert loop, awaiting each fire sequentially. Today there are ZERO
default subscribers — Wave 2B measured the entire 281-file fire chain at
0.82 ms (sub-millisecond per fire) because `HookRegistry.execute()`
short-circuits when no handlers and no `.on()` listeners exist. The
await chain is NOT a bottleneck on the current path.

**Trigger to revisit:** any subscriber that blocks > 5 ms per fire
(file-level Louis lock checks, real-time UI updates, embedding
generation) turns this loop into a serialised hot path. At that point
add a `BULK_INDEXED` hook fired ONCE after Pass 1 with
`{files, targetDir, persistence}` so bulk consumers can amortise their
work, and keep per-file consumers on `FILE_INDEXED` with a documented
per-fire perf budget. The fire site in `main.js` carries an inline
comment preserving the measurement so a future contributor doesn't
optimise prematurely (Wave 5G ticket 15).

---

## Priority distribution

- **P1:** 2 items (ticket lifecycle + llm-call)
- **P2:** 7 items (D3 bundling, renderFileList decoupling, OpenAPI,
  body-size backfill, traversal audit, readJsonBody helper, manifest
  freshness)
- **P3:** 7 items (REST conventions, rate-limit/auth, PRD wizard,
  error-banner hoist, phone metaphor, dead-constant cleanup, BULK_INDEXED
  hook defer)

Total: 16 roadmap items.
