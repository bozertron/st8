# lifecycle-and-eventing

Cluster: **lifecycle-and-eventing** — the runtime nervous system. The chokidar
file watcher, the notification bus (EventEmitter + SSE), the Bruno+Oscar
lifecycle manager, and the frontend coordination service that polls the
manifest. This is the chain that gets a file-system event from disk through
the backend, onto the SSE stream, and into the UI.

Source files in scope:

| File | Role |
|---|---|
| `src/features/watcher/file-watcher.js` | Chokidar wrapper, debounce-then-flush, the `onFileChange` callback |
| `src/core/notification-bus.js` | `EventEmitter` singleton + SSE client set + `setPrinter()` for the `.txt` fallback |
| `src/features/lifecycle/bruno-oscar.js` | File-lifecycle phase manager (DEVELOPMENT / STAGING / PRODUCTION + brunoStatus stale/flagged/archived) |
| `src/frontend/services/coordination.js` | Frontend manifest poller (2s) with listener-array pub/sub |
| `src/core/server/main.js` | Watcher callback (lines 207–419, ~215 lines) — the "inline hook chain" called out by HOOK-ARCHITECTURE-RESEARCH §6 |
| `src/core/server/app.js` | `/api/mutations` SSE endpoint, `/api/bruno-call`, `/api/oscar-house` |

Design context: `.planning/st8_prd_system/HOOK-ARCHITECTURE-RESEARCH.md`
documents four hook-like patterns; three of them live in this cluster (the
fourth, EPO, is external). Bible batch 003 moved `bruno-oscar.js` and
`file-watcher.js` into their current homes. Batch 009 moved
`notification-bus.js` to `src/core/`. Batches 025/026 are the bookend — batch
025 fixed a wrong-hook bug where commit events fired on `LIFECYCLE_TRANSITION`
(batch 026 narrative confirms: commit events now use `COMMIT_RECORDED` via
`/api/record-commit` in `app.js`; `LIFECYCLE_TRANSITION` is reserved for real
file-phase transitions and currently has no firers).

---

## The four hook-like patterns (HOOK-ARCHITECTURE-RESEARCH §2)

| Pattern | Where | Status | Owned by this cluster? |
|---|---|---|---|
| FileWatcher callback | `src/features/watcher/file-watcher.js` (`onFileChange` constructor option, single-callback) | Implemented | Yes |
| NotificationBus EventEmitter + SSE | `src/core/notification-bus.js` (pub/sub + `/api/mutations` SSE) | Implemented | Yes |
| EPO WebSocket bus | `phreak-terminal.js` / `file-explorer.js` (external `window.epoClient`) | Implemented (optional, external) | No (external) |
| Coordination polling listeners | `src/frontend/services/coordination.js` (listener array + `setInterval(2000)`) | Implemented | Yes |

Three of these are internal to st8 and live in this cluster. The fourth (EPO)
is documented for context but is an external integration. The `NotificationBus`
is the closest thing to a formal hook system in st8 and is the "structural
peer" of the named `hookRegistry` documented in
`docs/components/hooks-and-integration.md` — the two systems coexist:
`hookRegistry` covers pipeline-stage events (`INDEX_COMPLETE` etc.) while
`NotificationBus` covers per-file mutation events.

---

## FileWatcher

`src/features/watcher/file-watcher.js`. Single-class module exporting
`FileWatcher`. Constructor signature: `new FileWatcher(targetDir, { debounceMs, onFileChange })`.

### Chokidar configuration

`start()` lazy-loads `chokidar` and configures the watch:

- **Watch root:** the `targetDir` passed to the constructor (single root)
- **`persistent: true`** — keeps the Node process alive
- **`awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }`** — coalesces editor-save flurries (e.g. write→fsync→rename) into one event
- **`depth: 10`** — bounded recursion
- **`followSymlinks: false`** — symlinks are not crossed
- **Ignored globs** — `node_modules`, `.git`, `dist`, `build`, virtualenvs, Python caches, `*.sqlite*`, `*.json`, `*.toml`, `.st8/**`, `.planning/st8_identity_system/**`, `.archive/**`, `snapshots/**`. Note: the `*.json` and `*.toml` ignores include user code; they exist to prevent the manifest writer's own output from re-triggering the watcher. Bible batch 026 separately added a self-written-basename guard inside the indexer itself for the same drift class.

### Event handling and debounce-then-flush

Three chokidar events are subscribed: `add`, `change`, `unlink`. Each calls
`_onFileChange(filePath, eventType)` which:

1. Pushes `{ path, type }` into `this.pendingChanges` (a `Set`)
2. Clears any existing `debounceTimer`
3. Sets a new `setTimeout(_flush, debounceMs)` — default `500ms`

`_flush()` snapshots the pending set into an array, clears the set, and
invokes the constructor-injected `onFileChange(changes)` callback. The
callback is awaited so the next debounce window starts only after the
previous flush settles. Exceptions inside the callback are caught and logged
but do not abort the watcher.

### What triggers each event type

- **`add`** — file appeared (new file created, or first time the watcher sees an existing file during `ready`)
- **`change`** — content of an already-tracked file changed
- **`unlink`** — tracked file was deleted

`stop()` cancels the debounce timer and calls `watcher.close()`.

---

## The watcher callback in `main.js`

`src/core/server/main.js` constructs the `FileWatcher` in `--watch` mode and
passes an inline `onFileChange` of roughly 215 lines (block at lines 207–419).
HOOK-ARCHITECTURE-RESEARCH §6 identifies this block as the "designed hook
chain implemented as inline procedural code" and the largest remaining
non-refactored seam. The named hook constants `HOOKS.FILE_BEFORE_CHANGE` and
`HOOKS.FILE_AFTER_CHANGE` already exist in `src/core/hook-registry.js`
(documented payload contracts) but no publisher fires them — by design, they
are the seams that this callback's eventual extraction will use.

### Pre-filter

The callback first filters incoming `changes` to a fixed extension allowlist:
`CODE_EXTENSIONS = { .js, .ts, .jsx, .tsx, .vue, .py, .rs, .go, .md, .txt, .json }`
(defined above the callback at line 205). Non-code changes are dropped before
any work. If nothing survives the filter, the callback short-circuits.

### Branches (existing behavior — not a proposal)

For each surviving change, the callback dispatches on `change.type`:

#### `unlink` branch (lines 227–270)

1. Locate the row in the in-memory `result.files` array by `filepath`
2. Splice it out
3. `persistence.logMutation({ mutationType: 'DELETE', actor: 'WATCHER', changedFields: { filepath: [old, null] } })`
4. `notificationBus.publish({ mutationType: 'DELETE', filepath, fingerprint, sha256Hash, actor: 'WATCHER' })`
5. Best-effort delete of the schema card on disk (`.st8/schema-cards/<flat>.json`)
6. `persistence.deleteFile(filepath)` — cascades through connections, intent, mutation_log
7. Sets `anyChanged = true`

#### `add` branch (lines 271–337)

1. Read file content, compute SHA-256
2. `fs.statSync()` for size + birth time; build `fingerprint = generateFingerprint(relPath, birthTimestamp)`
3. Construct a new file record with `status: 'RED'`, `reachabilityScore: 0`, `lifecyclePhase: 'DEVELOPMENT'`, empty `imports`/`importedBy`
4. Push into `result.files`; `persistence.upsertFile(newFile)`
5. `persistence.logMutation({ mutationType: 'CREATE', actor: 'WATCHER' })`
6. `notificationBus.publish({ mutationType: 'CREATE', ... })`
7. Parity emit of a schema card via `emitter.emitCard()` — wraps an AST extraction in its own try/catch so AST parse failures don't block the publish
8. Sets `anyChanged = true`

#### `change` branch (the fall-through `else`, lines 338–391)

1. Find the existing file in `result.files` by `filepath`
2. Re-hash the file content
3. **If hash unchanged → no-op** (touch-without-edit case)
4. If hash changed: update `sha256Hash` + `lastModified`; `persistence.upsertFile()`
5. `persistence.logMutation({ mutationType: 'EDIT', changedFields: { sha256Hash: [old, new] }, actor: 'WATCHER' })`
6. `notificationBus.publish({ mutationType: 'EDIT', ... })`
7. Re-extract AST and re-emit the schema card
8. Sets `anyChanged = true`

### Post-loop (lines 393–417)

If anything actually changed, the callback:

1. Re-writes manifests: `writeManifests(result.files, targetDir)` → updates `connection-state.json` + `ai-signal.toml`
2. Re-runs `IntentSeeder` over the schema cards directory
3. Re-runs `GapAnalyzer.writeReport()` → updates `.st8/gap-analysis.md`

Each step is wrapped in its own try/catch — failure of one does not abort the
next.

### Why this matters

This callback contains every concern the named hook system was supposed to
split apart: the lifecycle method dispatch (`add`/`change`/`unlink`), the
persistence write, the schema-card emission, the SSE publish, the manifest
regen, the gap analysis re-run. It is the single biggest piece of
pre-hook-registry procedural code remaining in the codebase. The bible
explicitly tracks this — batch 023 wired the registry for index-time events
but left the watcher chain alone as "bigger, riskier."

---

## NotificationBus

`src/core/notification-bus.js`. Extends Node's `EventEmitter`. Exposed as
both the class and a frozen singleton `notificationBus`.

### Publish chain

`publish(event)` enriches the event with `publishedAt = new Date().toISOString()`
then runs four steps in order:

1. **EventEmitter** — `this.emit('mutation', enriched)` then `this.emit('mutation:' + mutationType, enriched)`. Wrapped in try/catch so a throwing in-process subscriber does not abort the remaining three steps.
2. **SSE broadcast** — `_broadcastSSE(enriched)` writes `data: <json>\n\n` to every entry in `this.sseClients`. Per-client write errors `delete` that client from the set.
3. **Console** — `console.log` with a glyph (`✎` EDIT, `+` CREATE, `−` DELETE, `◈` CONCEPT, `⊘` LOCK, `★` PRODUCTION, `·` default)
4. **Printer fallback** — if `setPrinter()` was called and the event carries a `schemaCard`, `this.printer.printCard(schemaCard)` writes the `.txt` to `.planning/st8_identity_system/`. The printer call is wrapped in try/catch.

### Event types

The string conventions established by current call sites:

| `mutationType` | Where it fires |
|---|---|
| `CREATE` | indexer (initial pass + watcher `add` branch in main.js) |
| `EDIT` | watcher `change` branch in main.js |
| `DELETE` | watcher `unlink` branch in main.js |
| `CONCEPT` | `app.js` `_handleConceptFile` |
| `LOCK` | `app.js` `_handleMvpLock` |
| `PRODUCTION` | `app.js` `_handleProductionPromote` |
| `BRUNO_CALL` | `bruno-oscar.js` `runBrunoCall` (per-file flag) |
| `ARCHIVE` | `bruno-oscar.js` `runOscarHouse` (per-file archive) |
| `UNARCHIVE` | `bruno-oscar.js` `onEventTriggered` |
| `AI_REVIEW_NEEDED` | `app.js` `_handleNeedsAIReview` (frontend reacts in `app.js:932`) |

Subscribers can listen on `'mutation'` for everything or on `'mutation:EDIT'`
etc. for one type. There are no in-process subscribers registered today — the
registered consumers are all SSE clients.

### SSE wiring

`addSSEClient(res, options)` is called from `app.js _handleMutationsSSE`.

- **Cap:** `maxSseClients = 10` (constructor option). When the set is full the new client gets `503 Too many SSE clients`.
- **CORS:** the caller passes `allowedOrigin` (the server hands in `http://localhost:<port>`). The bus never uses `*`.
- **Headers:** `text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- **Handshake:** an initial `data: { type: 'connected', timestamp: ... }\n\n` is sent before the client is added to the set
- **Cleanup:** `res.on('close')` deletes from the set; `res.on('error')` deletes from the set, calls `res.end()` in a try/catch (the error-handler was added explicitly to prevent uncaught `error` events from crashing the process)
- **Broadcast:** `_broadcastSSE` iterates the set with try/catch per client

There is **no server-side heartbeat ping**. The frontend's EventSource handles
reconnection client-side (see "The full SSE chain" below); the server itself
sends nothing once the handshake completes until a real mutation occurs.

### `setPrinter()`

`main.js` line 92 calls `notificationBus.setPrinter(printer)` where `printer`
is a `SchemaCardPrinter` instance. The printer is only invoked from inside
`publish()` if the event carries a `schemaCard` property. Today no publisher
in this cluster sets that property — the watcher branches emit lightweight
events (`fingerprint`, `filepath`, `mutationType`, `actor`, `sha256Hash`) and
do their own schema-card emission via `emitter.emitCard` outside the
notification bus. The printer hookup is dormant by construction; it would
activate if any publisher chose to attach the card object to the event.

---

## Bruno & Oscar

`src/features/lifecycle/bruno-oscar.js`. One class, `BrunoOscar`, constructed
with a persistence handle and the notification bus. Two configurable
thresholds:

- `STALE_THRESHOLD = 5` — sessions a file can go un-accessed before Bruno flags it
- `GRACE_PERIOD = 7` — days a flagged file sits in Oscar's House before deletion

### The four personas

- **Bruno (`runBrunoCall(threshold)`)** — scans `file_registry` for files with `sessionsSinceAccess > threshold` (via `persistence.getStaleFiles`). For each, sets `brunoStatus = 'flagged'` and publishes a `BRUNO_CALL` mutation event. Designed to run on every session start.
- **Oscar (`runOscarHouse(gracePeriod)`)** — selects rows where `brunoStatus = 'flagged'`, archives each (`persistence.archiveFile`), sets an expiry date `gracePeriod` days out, and publishes an `ARCHIVE` mutation event.
- **Event trigger (`setEventTrigger(filepath, event)`)** — writes `eventTrigger = <name>` to a file's row. The file is un-archived later by:
- **Reanimation (`onEventTriggered(event)`)** — selects rows where `eventTrigger = event`, sets `brunoStatus = 'active'`, resets `sessionsSinceAccess = 0`, clears the trigger, and publishes an `UNARCHIVE` mutation event.

There is also a private `_appendToParent(file)` helper that appends the
content of an archived file to its `associatedWith` parent before disk
removal — the "stale child gets folded into parent" mechanism. It is wired
inside Oscar's flow but only fires for rows that have `associatedWith` set.

### Lifecycle phases vs Bruno status

These are two different columns on `file_registry`:

- **`lifecyclePhase`** (TEXT, default `'DEVELOPMENT'`) — the design intent column. Values seen in code: `DEVELOPMENT`, `STAGING`, `PRODUCTION`. Set by `_handleProductionPromote` in `app.js` and by the indexer's initial upsert.
- **`brunoStatus`** (TEXT, default `'active'`) — the housekeeping column. Values: `active`, `flagged`, `archived`.

Neither column has an ENUM constraint at the schema level; both are TEXT with
default values. Indexes exist on both (`idx_file_registry_lifecycle`,
`idx_file_registry_bruno`).

### API endpoints that drive Bruno/Oscar

`src/core/server/app.js`:

- **`POST /api/bruno-call`** → `_handleBrunoCall` (line 1186). Body: `{ threshold? }`. Constructs a fresh `BrunoOscar` with a fresh `St8Persistence`, runs `runBrunoCall`, returns `{ status, flaggedFiles, files }`.
- **`POST /api/oscar-house`** → `_handleOscarHouse` (line 1241). Body: `{ gracePeriod? }`. Same construction pattern, runs `runOscarHouse`, returns `{ status, archivedFiles, files }`.

Both endpoints have a 1KB body-size guard, enforce `POST`, and instantiate a
fresh persistence object per request (open + initialize + close around the
work).

---

## The `LIFECYCLE_TRANSITION` hook — current state

The constant is declared in `src/core/hook-registry.js` line 52 with the
documented payload `{ file, oldPhase, newPhase }`. It is reserved for actual
file-phase transitions — the Bruno+Oscar territory.

**Current firing sites: none.** Batch 025 explicitly removed the (incorrect)
fire from `/api/record-commit` and replaced it with `HOOKS.COMMIT_RECORDED`
(which lives in the hooks-and-integration cluster). The bible quote: "Wrong
hook for the event. LIFECYCLE_TRANSITION stays reserved for actual file-phase
transitions (bruno+oscar territory)."

So the hook is contract-only today. The natural firing sites — if/when wired
— are inside `BrunoOscar.runOscarHouse` (DEVELOPMENT → archived equivalent),
`_handleProductionPromote` in `app.js` (STAGING → PRODUCTION), and any future
demote endpoint. None of those currently call `hookRegistry.execute`.

---

## Frontend coordination

`src/frontend/services/coordination.js`. Exposes
`window.St8Coordination` with:

- **`startPolling(manifestPath)`** — stores the path, calls `loadManifest` immediately, then `setInterval(loadManifest, 2000)`. The interval handle is kept on `coordinationState.pollInterval`.
- **`stopPolling()`** — clears the interval
- **`addListener(callback)`** — pushes onto `coordinationState.listeners`; returns an unsubscribe function that splices the listener back out
- **`loadManifest(path)`** — `await fetch(path)`, parses JSON, stores on `lastManifest` + `lastUpdate`, then calls `notifyListeners(manifest)` which iterates the array and invokes each (per-listener try/catch)
- **`compareManifests(old, new)`** — diff helper returning `{ added, removed, statusChanged, intentChanged }`
- **`generateAiContext(manifest)`** — human-readable string for paste-into-LLM workflows
- **`getLastManifest()` / `getLastUpdate()`** — accessors

The service is started from `src/frontend/app.js:363`:
`window.St8Coordination.startPolling('/api/connection-state.json')` — so the
poll target is the server's manifest endpoint.

The listener-array pattern is the fourth hook-like surface from
HOOK-ARCHITECTURE-RESEARCH §2. Today there is no `St8Coordination.addListener`
call site in `src/frontend/` — the polling fetches, but nothing reacts to the
manifest. The constellation update path uses a parallel `setInterval` (see
the next section), not a coordination listener.

---

## The full SSE chain (publish → toast → constellation)

End-to-end, what happens when a tracked file changes on disk:

```
chokidar 'change' event on disk
  ↓
FileWatcher._onFileChange()                          src/features/watcher/file-watcher.js:93
  ↓  (debounce 500ms, accumulate in pendingChanges)
FileWatcher._flush()                                 src/features/watcher/file-watcher.js:107
  ↓
onFileChange callback in main.js                     src/core/server/main.js:211
  ↓  (215-line inline orchestration; the EDIT branch fires)
persistence.upsertFile() + persistence.logMutation()
  ↓
notificationBus.publish({ mutationType: 'EDIT', ... })   src/core/notification-bus.js:33
  ↓
  ├─ this.emit('mutation', enriched)                 → in-process subscribers (none today)
  ├─ this.emit('mutation:EDIT', enriched)            → typed subscribers (none today)
  ├─ this._broadcastSSE(enriched)                    → every res in this.sseClients
  ├─ console.log(...)                                → backend stdout
  └─ this.printer?.printCard(...)                    → dormant (no schemaCard prop)
        ↓ (via SSE)
Frontend EventSource at /api/mutations               src/frontend/app.js:903
  ↓  (auto-reconnect with exponential backoff on error; no heartbeat)
mutationSource.onmessage(event)                      src/frontend/app.js:910
  ↓
showMutationToast(data)                              src/frontend/app.js:864 (toast in #mutation-toasts)
  ├─ if BRUNO_CALL → showBrunoToast
  ├─ if ARCHIVE    → showArchiveToast
  └─ if AI_REVIEW_NEEDED → showAIReviewToast
  ↓
PhreakTerminal.notifyMutation(data)                  src/frontend/app.js:937 (TUI signal feed)
```

And separately, on its own 5-second poll (NOT off the SSE chain), the
constellation gets fresh status from the manifest:

```
setInterval 5000ms                                   src/frontend/app.js:199
  ↓
fetch('/api/connection-state.json')
  ↓
data.files.forEach(f => window.St8Constellation.updateFileStatus(f.fingerprint, f.status))
```

So two independent paths drive the UI on a mutation:

- **SSE** → toast + phreak terminal (event-driven, ~latency = debounce + network)
- **Manifest poll** → constellation particle recolor (5s upper-bound latency)

A third independent path drives whatever consumes `St8Coordination`:

- **Coordination poll (2s)** → `lastManifest` + listener fan-out (no current consumers)

---

## Caveats

- **The 215-line inline watcher callback is the biggest "to-do" structural item in this cluster.** HOOK-ARCHITECTURE-RESEARCH §6 flagged it explicitly. `HOOKS.FILE_BEFORE_CHANGE` and `HOOKS.FILE_AFTER_CHANGE` are documented contracts in `hook-registry.js` with no publishers. The conversion is the natural next-batch refactor.
- **Three independent timers drive the live UI** (SSE stream, 5s constellation poll, 2s coordination poll). The two polls do redundant work — both fetch `/api/connection-state.json` from the same browser. Either could subscribe to SSE for the same data.
- **`LIFECYCLE_TRANSITION` is reserved but never fired.** Bruno+Oscar would be the natural publishers; today they emit only `BRUNO_CALL` / `ARCHIVE` / `UNARCHIVE` mutation events on the notification bus, with no hook-registry call.
- **Lifecycle phase column is unconstrained TEXT.** A typo in `_handleProductionPromote` would silently land. Same for `brunoStatus`.
- **Bruno+Oscar's "automatic lifecycle management" is not automatic** — it only runs when `POST /api/bruno-call` or `POST /api/oscar-house` is invoked. Nothing inside st8 fires those endpoints on a schedule. The class docstring describes scheduling intent ("Called on every session start"); the wiring is not present.
- **No server-side SSE heartbeat.** The browser-side EventSource has reconnect with exponential backoff (`reconnectDelay`, `MAX_RECONNECT_DELAY`), but if a proxy / NAT drops an idle TCP connection there is no ping to keep it alive. The frontend will reconnect on `onerror`, which masks but does not eliminate the issue.
- **Printer fallback in `notificationBus.publish` is dormant.** It is wired and `setPrinter()` is called, but no publisher attaches a `schemaCard` property to the event — `main.js` emits cards out-of-band via `emitter.emitCard()`.
- **The notification bus has no in-process subscribers.** Every consumer is an SSE client. The pub/sub machinery is doing one job today.
