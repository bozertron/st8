# server-api-and-legacy-frontend

Cluster covering the HTTP API surface that st8 exposes plus the three older
frontend components — file-explorer, terminal (phreak>), graph-viewer —
that pre-date the slide-carousel work and are still wired into the new
shell.

Source files in scope:

- `/home/user/st8/src/core/server/app.js` (1613 lines)
- `/home/user/st8/src/core/server/main.js` (453 lines)
- `/home/user/st8/src/frontend/components/file-explorer/file-explorer.js` (748 lines)
- `/home/user/st8/src/frontend/components/terminal/terminal.js` (1086 lines)
- `/home/user/st8/src/frontend/components/graph-viewer/graph-viewer.js` (456 lines)

---

## Part 1 — The API surface

The router in `app.js` is a single flat `switch` in `_handleApiRequest()`
(lines 83-158). Static-file fall-through happens in `_serveStaticFile()`
(line 160) — the slim shell at `/` serves
`src/frontend/index.html` (line 168). CORS is restricted to
`http://localhost:<port>` (line 63). Bind address is `127.0.0.1` only
(line 52). Default port is 3847.

### Route inventory

| # | Method | Path | Handler | Purpose |
|---|---|---|---|---|
| 1 | GET | /api/connection-state.json | `_serveManifest` | Read live manifest JSON from `targetDir/connection-state.json` (file-based, not SQLite). |
| 2 | GET | /api/ai-signal.toml | `_serveToml` | Read live TOML manifest from `targetDir/ai-signal.toml`. |
| 3 | GET | /api/health | `_serveHealth` | `{ status, uptime, targetDir, lastManifestUpdate }`. |
| 4 | POST | /api/index | `_handleIndex` | Re-index a path; writes manifests, returns file count. 1KB body cap. |
| 5 | POST | /api/file-intent | `_handleFileIntent` | Upsert `{purpose, dependsOnBehavior, valueStatement}` for a fingerprint; rewrites manifest in place. 1KB body cap. |
| 6 | GET / POST | /api/settings | `_handleSettings` | GET returns all settings (optional `?category=`); POST upserts `{category, key, value}`. 1KB body cap. |
| 7 | POST | /api/verify | `_handleVerify` | Walk indexed files, recompute SHA-256, report verified / modified / missing / orphan counts. 1KB body cap. |
| 8 | GET | /api/files | `_handleFileList` | List directory entries at `?path=`. Tilde expansion + traversal protection (must be inside `$HOME` or `targetDir` via `path.relative()`). |
| 9 | GET | /api/mutations | `_handleMutationsSSE` | Server-sent events stream of mutation notifications (delegated to `notificationBus.addSSEClient`). |
| 10 | POST | /api/concept-file | `_handleConceptFile` | Phase-6: register a CONCEPT-phase file, set optional intent, publish CONCEPT mutation. 1KB body cap. |
| 11 | POST | /api/mvp-lock | `_handleMvpLock` | Transition every CONCEPT / DEVELOPMENT file to LOCKED, log mutations, re-emit schema cards. 1KB body cap. |
| 12 | GET | /api/prd | `_handlePrd` | Generate the cross-card PRD markdown via `features/prd/generator`. |
| 13 | POST | /api/production-promote | `_handleProductionPromote` | Purge development-only mutation history for a fingerprint. 1KB body cap. |
| 14 | GET | /api/gap-analysis | `_handleGapAnalysis` | Run `GapAnalyzer` over schema cards; content-negotiate JSON or `text/markdown`. |
| 15 | GET / GET-by-name / POST | /api/prd-projects | `_handlePrdProjects` | List, fetch, or create PRD project records. 2KB body cap on POST. Pseudo-REST: `/api/prd-projects/<name>` matched via regex. |
| 16 | POST | /api/bruno-call | `_handleBrunoCall` | Run `BrunoOscar.runBrunoCall(threshold)` — lifecycle alarm pass. 1KB body cap. |
| 17 | POST | /api/oscar-house | `_handleOscarHouse` | Run `BrunoOscar.runOscarHouse(gracePeriod)` — lifecycle reaper pass. 1KB body cap. |
| 18 | GET | /api/needs-ai-review | `_handleNeedsAIReview` | List files flagged `needsAIReview`. |
| 19 | POST | /api/mark-reviewed | `_handleMarkReviewed` | Mark a file as reviewed by AI; requires `filepath`. 1KB body cap. |
| 20 | GET / POST | /api/templates | `_handleTemplates` | GET lists PRD templates; POST saves a named template `{name, content, description}`. 2KB body cap on POST. |
| 21 | POST | /api/record-commit | `_handleRecordCommit` | Receive post-commit hook payload; log to `activity_log`; fire `HOOKS.COMMIT_RECORDED`. No explicit body-size cap. |
| 22 | GET / POST | /api/tickets | `_handleTickets` | GET lists 200 newest open tickets; POST creates a ticket and fires `HOOKS.TICKET_CREATED`. No explicit body-size cap. |
| 23 | GET | /api/tickets/count | `_handleTicketsCount` | `{ count }` of open tickets — phreak> TUI badge source. |

**Total: 23 routes** (24 if you count `/api/prd-projects/<name>` as separate
from `/api/prd-projects`).

### Routing convention (Wave 5G ticket 14)

The router in `_handleApiRequest` is a flat `switch` over `url.pathname`
plus a `default` branch that runs regex matchers for parameterised paths.
The convention — codified here as the intentional design — is:

- **Collection / verb routes use verb-flat path strings** matched directly
  by the `switch`. Examples: `POST /api/tickets` (create a ticket on the
  collection), `POST /api/index` (run an action), `GET /api/tickets/count`
  (a derived collection view).
- **Per-resource routes use `:id` (or `:name`) path parameters** matched
  by regex in the `default` branch. Examples:
  `GET /api/prd-projects/<name>`, `POST /api/tickets/:id/claim`,
  `POST /api/tickets/:id/resolve`.

This is REST-shaped without a router framework. Verbs that act on the
**collection** stay flat (they share a single switch case); verbs that
act on a **specific resource** carry the identifier in the path. The two
forms coexist because adding a generic router would be more code surface
than the dozen current routes warrant — when the count crosses ~30 or a
fourth resource gains `:id` verbs, revisit the table-driven approach
sketched in the roadmap (P2.5).

The machine-readable contract is `src/core/server/route-manifest.js`
(Wave 5G ticket 13) — every route in that file is asserted to exist in
`app.js` and vice versa via the drift test
`tests/core/server/route-manifest-drift.test.js`.

### Cross-cutting observations

- Body-size caps: 17 POST handlers cap at 1KB; two (`/api/prd-projects`,
  `/api/templates`) cap at 2KB; two (`/api/record-commit`, `/api/tickets`)
  have **no cap at all** — they were added later and skipped the pattern.
- Error shape is uniformly `{ error: string }` JSON except for `/api/prd`
  and `/api/gap-analysis (markdown branch)`, which return text.
- The CORS allow-list is per-request and locked to the same origin/port —
  comment notes it was a "security fix: prevent RCE via CORS wildcard".
- `/api/connection-state.json` reads the **on-disk manifest file**, not
  SQLite. This means a slow indexer pass can leave the HTTP response
  trailing the database by however long `writeManifests()` takes after
  the SQLite upsert pass (`main.js` writes manifests as part of
  `INDEX_COMPLETE` subscribers, after all rows are persisted).
- `/api/file-intent` rewrites the manifest file in place rather than
  re-running the indexer — a side door for low-latency intent edits.
- No `/api/llm-call` endpoint exists despite the cluster having a
  documented dependency on it (also flagged by settings-and-providers).
- No `/api/tickets/:id/{claim,resolve}` — `St8Persistence` has the
  underlying methods (the GET-list calls `getOpenTickets`) but no HTTP
  exposure means the LLM-collaborator lifecycle is half-wired.
- No OpenAPI / Swagger document; the only inventory is the switch
  statement itself.

---

## Part 2 — main.js boot sequence

`main.js` is the CLI entry point; the binary contract is:

```
node main.js <target-directory> [--watch] [--serve] [--port N]
```

### Sequence (line numbers from `main.js`)

1. **Global error handlers** (lines 32-41) — `unhandledRejection` logs
   and continues; `uncaughtException` logs and exits 1.
2. **CLI arg parsing** (lines 46-70) — pulls `targetDir`, `--watch`,
   `--serve`, optional `--port` (default 3847).
3. **Persistence init** (lines 82-83) — `new St8Persistence()` then
   `await persistence.initialize()` (creates / opens SQLite, runs
   migrations).
4. **Initial indexer pass** (line 87) — `indexDirectory(targetDir,
   { write: true })` returns `{ files, manifest }`.
5. **Schema-card emitter + printer hoisted** (lines 90-92) — needed by
   later file-watcher callbacks.
6. **Hook subscriber registration** (lines 98-103):
   - `registerDefaultSubscribers(hookRegistry)` wires the built-in
     subscribers (manifest, schema-card emission, gap analysis, intent
     seeding).
   - `registerForceChecks(hookRegistry)` adds the P=90 force-check pass
     that writes `.st8/force-check.md`.
7. **`HOOKS.INDEX_START`** fired (line 107) — extension point for
   pre-pass cleanup.
8. **SQLite store, three passes** (lines 110-180):
   - **Pass 0 (prune)** — `persistence.pruneFilesNotIn(currentFilepaths)`
     drops rows whose filepath is not in this pass; cascades through
     connections / intent / mutation_log via `deleteFile`.
   - **Pass 1 (upsert per file)** — `upsertFile`, then `logMutation`
     with `CREATE`, then **`HOOKS.FILE_INDEXED`** fires for each file
     (per-file extension point).
   - **Pass 2 (connections)** — resolves `imports[].source` against the
     file list and inserts IMPORT connections.
9. **`logActivity('INDEX_COMPLETE')`** (line 182).
10. **`HOOKS.INDEX_COMPLETE`** fired (line 195) — default subscribers
    handle manifest write, schema-card emission, gap analysis, intent
    seeding, force checks (in priority order).
11. **File watcher (optional)** (lines 205-420) — `chokidar`-backed
    `FileWatcher` with a 500ms debounce. On code-file changes it
    branches `unlink` / `add` / change. Each branch upserts, logs
    mutations, publishes via `notificationBus`, and re-emits the file's
    schema card. After any change it re-writes manifests, re-seeds
    intent, re-runs gap analysis.
12. **HTTP server (optional)** (lines 423-427) — `new St8Server({ port,
    targetDir }).start()`.
13. **Lifecycle keep-alive** (lines 435-445) — SIGINT shutdown closes
    watcher, server, persistence; otherwise the process exits after the
    indexer pass.

---

## Part 3 — Legacy frontend components

These three modules pre-date the slide-carousel refactor. They still
mount, but their public APIs and the carousel's lazy-mount logic do not
share a contract.

### 3.1 file-explorer (`window.VoidFileExplorer`)

**What it does.** Renders a directory listing into a panel-body element.
Sidebar locations are HOME / DOCUMENTS / DOWNLOADS / WORKSPACE (picker);
breadcrumb header; standard or virtual-scroll table (kicks in at
>100 entries, 32 px rows, 20-row buffer); a footer with VERIFY, INDEX,
ADD-TO-CHAT, CREATE-PRD buttons.

**Public API.**

```
window.VoidFileExplorer = {
  mount(panelBodyEl, onSelect),
  navigate(path),
  _navTo(name, path),
  _showWorkspacePicker(),
  _selectWorkspace(wsType),
  _setWorkspaceType(wsType),
  _indexCodebase(),       // POST /api/index
  _verifyCodebase(),      // POST /api/verify
  _rowClick / _rowDblClick / _emitSelect / _toggleHidden / _retry,
  getWorkspaceType(),
  getIndexedFingerprints(),
  setIndexedFingerprints(fp)
}
```

`getIndexedFingerprints()` is the cross-component handshake — terminal
and constellation both read manifests through this getter.

**Mount.** Left carousel column. `src/frontend/app.js:50-74` calls
`window.VoidFileExplorer.mount(host, cb)` immediately at boot and
declares `mounted = true`. Slide navigation does not re-mount.

**Known coupling.**

- **Reads** `window.actu8Config.workspace` and `window.actu8Config.homeDir`
  (lines 45-50, 69) — soft optional.
- **Reads** `window.epoClient` (lines 148-155) — EPO bus is tried before
  REST fallback.
- **Writes** `window.st8WorkspaceChanged` (line 599, 612) and
  `window.st8IndexingComplete` (line 660) — invoked if defined.
- **Calls** `window.openPRDWizard()` from the CREATE PRD button
  (`file-explorer.js:362`) — defined in `app.js:250`.
- **MutationObserver in `app.js:69`** watches the explorer host and
  hoists `.explorer-error-banner` into the panel titlebar — a host-side
  workaround for the fact that the explorer renders the banner inside
  its content area, not the titlebar.
- `localStorage.setItem(LS_SHOW_HIDDEN, …)` is called from `_toggleHidden`
  but `LS_SHOW_HIDDEN` is undefined in the file — dead code path.

**Tech debt.**

- The hidden-files toggle (`_toggleHidden`) references undefined
  `LS_SHOW_HIDDEN` and is no longer wired into the UI; state default
  is `true`.
- The error-banner DOM-hoist (`MutationObserver`) is fragile: any change
  to where the banner renders inside the explorer breaks the titlebar
  presentation.
- Workspace types are still hard-coded (`logic-analyzer`, `standard`,
  `pretext-dev`) — Pretext is a legacy concept.

### 3.2 terminal (`window.PhreakTerminal`)

**What it does.** A retro `bozertron@orchestr8:~$` TUI. State holds
lines (append-only render), command history (↑↓), execution flag,
signal buffer, phone-off-hook flag, TUI overlay flag. Supports
streaming tokens, signal pop-ups, media commands routed through the EPO
bus, a vintage SVG handset toggle, and a full-screen overlay mode.

**Public API.**

```
window.PhreakTerminal = {
  mount, execute, focus, copyLine, getLines, clear,
  toggleTUI,
  receiveSignal, getSignals,
  notifyMutation,
  togglePhoneOffHook, getPhoneState, getState,
  appendToken(token), sealLine()
}
```

**Mount.** Right carousel column. `src/frontend/app.js:80-119` mounts
immediately, hoists `.phreak-header-controls` into the panel titlebar,
inserts a `.phreak-status-line`, and wires click handlers for
`[data-action="tui-toggle"]` and `[data-action="phone-toggle"]`.

**Known coupling.**

- **Calls `window.renderFileList(filtered)`** at `terminal.js:624` from
  inside `_isolateFiles(status)`. That global is **not defined anywhere
  in the current frontend codebase** (search returns no hits). The
  `_clearVoid()` path (line 642) targets a `#void-file-list` element
  that doesn't exist in the new shell either — the "void file list"
  pop-out is a vestige of the founder's pre-session design and is now
  dead UI.
- **Reads** `window.VoidFileExplorer.getIndexedFingerprints()` in three
  places (lines 600, 662, 715) to materialise the manifest.
- **Calls** `window.St8GraphVisualizer.showGraphPopup(manifest)` from
  `_showGraph` (line 672) — graph-viewer is the modal-overlay launcher.
- **Calls** `window.St8Settings.showSettingsInExplorer()` from
  `_showSettings` (line 682) — sibling cluster.
- **Reads** `window.epoClient` for command execution; REST fallback hits
  `/api/exec` (line 90) — note: **`/api/exec` is NOT in the route table**
  (see Part 1). Both paths are dead unless the EPO bus is up.
- `PHREAK_API = '/api/v1/exec'` at line 43 is a dead constant — comment
  at line 68 says "replaces dead /api/v1/exec REST".

**Phone on-hook / off-hook state machine.** Pure UI. `phoneOffHook` is a
single boolean. When off-hook, incoming signals (`receiveSignal`) are
stored with `suppressed: true` and the visual pop-up branch is skipped
(line 397, 409). No other component reads `getPhoneState()` — the
titlebar status line in `app.js:103-111` is the only consumer.

**Tech debt.**

- `window.renderFileList` and `#void-file-list` are stale references.
  Either delete the `_isolateFiles` / `_clearVoid` paths or wire them
  into the new carousel.
- `PHREAK_API = '/api/v1/exec'` is dead code.
- `_isolateFiles` includes Make-Topic / Export-Report / Create-Sprint
  hints but only the `make-topic` action wiring is hinted; nothing is
  implemented.
- `_showSettings` assumes the settings UI mounts inside the file
  explorer — that contract is sibling-cluster work and may have shifted
  with the carousel.

### 3.3 graph-viewer (`window.St8GraphVisualizer`)

**What it does.** Renders a D3 force-directed graph of the
import-connection graph. Nodes coloured by status (GREEN / YELLOW /
RED), sized by `impactRadius`, draggable, with zoom/pan, link
mouseover tooltip, click → modal-overlay node-details popup, and a
filter footer that dims non-matching nodes.

**Public API.**

```
window.St8GraphVisualizer = {
  showGraphPopup(manifest),
  resetZoom(),
  _currentVisualizer  // stash for resetZoom
}
```

**Mount.** Not mounted in the carousel directly. The component is
*invoked on demand* by the terminal's `_showGraph()` action (`terminal.js:672`)
which creates a `.graph-popup-overlay` div, appends it to `document.body`,
instantiates a `GraphVisualizer`, and registers a close button.

**Modal mechanism.** Pure DOM-injected overlay — no `<dialog>`, no
`panel-overlay` class. The close affordance is the diamond button's
`onclick="this.closest('.graph-popup-overlay').remove()"`. There is no
keyboard-escape close handler and no focus trap.

**Known coupling.**

- Loads **D3.js from `https://d3js.org/d3.v7.min.js` at runtime via a
  dynamically inserted `<script>`** (lines 18-40). This is the only
  CDN-dependent path left in the frontend.
- Reads `manifest.files[].imports[].source` and matches them against
  `filepath` / `filename` — same fuzzy resolution as the indexer.

**Tech debt.**

- The CDN-load conflicts with the founder's desktop-first stance set
  during Sonic integration: no network, no D3.
- Node-details modal has no escape-key close and no focus trap.
- Modal pattern is unique to graph-viewer — every other modal in the
  shell uses `.panel-overlay` (see PRD wizard).
- The drag callback (line 212) bind chain uses `function() {…}.bind(this)`
  inside another `.bind(this)` — it works but is hard to read.

---

## Cluster boundaries

- **settings-and-providers** owns `/api/settings` semantics, the missing
  `/api/llm-call`, and the settings UI itself.
- **frontend-experience** owns the carousel chrome and PRD wizard
  presentation.
- **sonic-and-search** owns the proposed search endpoints that don't
  yet appear in the route table.
- **hooks-and-integration** owns `HOOKS.INDEX_START / FILE_INDEXED /
  INDEX_COMPLETE / COMMIT_RECORDED / TICKET_CREATED` semantics; this
  cluster only consumes them.
