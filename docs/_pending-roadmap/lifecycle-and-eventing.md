# Roadmap items — lifecycle-and-eventing cluster

Forward-looking work for the file watcher, notification bus + SSE, Bruno+Oscar
lifecycle manager, and frontend coordination service. Bugs, stale code, and
small gaps live in `_pending-tickets/lifecycle-and-eventing.json`; this file is
the structural-changes list.

---

- **Priority 1 — Convert the 215-line `onFileChange` callback in `main.js` into `HOOKS.FILE_BEFORE_CHANGE` and `HOOKS.FILE_AFTER_CHANGE` subscribers.**
  This is the single biggest piece of pre-hook procedural code remaining in the codebase. The hook constants already exist in `src/core/hook-registry.js` with documented payloads — they have zero publishers today. HOOK-ARCHITECTURE-RESEARCH §6 explicitly identifies this block as "the designed hook chain implemented as inline procedural code." Splitting the add/change/unlink branches into prioritized subscribers gives plugins (Louis lock checks, real-time UI mirrors, audit listeners, future Sonic indexers) a single seam for every file mutation. Suggested decomposition: P=10 validator/short-circuit (BEFORE), P=20 persistence write, P=30 schema-card emit, P=40 notification-bus publish, P=50 manifest regen, P=60 intent-seeder + gap-analyzer re-run (all AFTER). Batch 023 explicitly deferred this as "bigger, riskier" — this is the next batch.

- **Priority 1 — Replace the constellation's 5-second poll with an SSE subscription to `/api/mutations`.**
  `src/frontend/app.js:199` polls `/api/connection-state.json` every 5s purely to recolor particles. Same browser already has an `EventSource` open at line 903 for toast notifications. Wire `mutationSource.onmessage` to call `window.St8Constellation.updateFileStatus(data.fingerprint, deriveStatus(data))` — drops a 5s upper-bound latency to sub-second AND eliminates redundant manifest fetches. Same treatment for `src/frontend/services/coordination.js`'s 2s poll if any consumer of `St8Coordination.addListener` actually exists (currently no call sites in `src/frontend/`). The bus already has the channel; today's work is just plumbing the receive end.

- **Priority 2 — Server-side SSE heartbeat + standardized reconnection.**
  `notificationBus._broadcastSSE` only writes on real mutations; an idle stream can sit there for hours, and any proxy/NAT timeout will silently drop it. Add a `setInterval(15000)` that writes `: heartbeat\n\n` (an SSE comment line — harmless to clients, but the write fails on broken-pipe sockets and the per-client try/catch then cleans the Set). Pair with a frontend `lastEventAt` watchdog: if no event (including handshakes/heartbeats) arrives in 45s, force-reconnect even without an `onerror`. Today the EventSource has reconnect-with-backoff but only after `onerror` fires — half-open sockets escape that path entirely.

- **Priority 2 — Bruno+Oscar lifecycle phase enum + state-machine validation.**
  `file_registry.lifecyclePhase` and `brunoStatus` are unconstrained `TEXT`. Add SQLite `CHECK` constraints (`lifecyclePhase IN ('DEVELOPMENT', 'STAGING', 'PRODUCTION')`, `brunoStatus IN ('active', 'flagged', 'archived')`). Then formalize the legal transitions: DEVELOPMENT → STAGING → PRODUCTION is forward; PRODUCTION → DEVELOPMENT is allowed only via a deliberate `_handleProductionDemote` endpoint (not yet implemented), and `STAGING → DEVELOPMENT` is allowed via a `unstaged` action. Encode these as a `transitionAllowed(from, to)` helper in `bruno-oscar.js`. Wire each transition to fire `HOOKS.LIFECYCLE_TRANSITION` with `{ file, oldPhase, newPhase }` — the hook is reserved for exactly this, currently has no publishers. This is also the natural moment to make Bruno+Oscar's docstring claim ("Automatic Lifecycle Management") true: hook a `SESSION_START` (or batch 025's `INDEX_START`) subscriber that runs Bruno on every session.

- **Priority 3 — Multiple-target-dir support in the watcher.**
  Today `FileWatcher` accepts one `targetDir` in the constructor, and `main.js` constructs it once with the single argv directory. Monorepo and federated setups (frontend repo + sibling backend repo + shared lib) cannot watch both. Extend `FileWatcher` to accept a `roots: string[]` option that maps to `chokidar.watch([...roots])`. Update `main.js` to accept repeated `--watch <dir>` flags or a comma-separated list. Keep the single-root constructor for backward compat. Touches the manifest writer too — `connection-state.json` would need a per-root key or a flattened single manifest with root-prefixed paths.

- **Priority 3 — Watch-mode performance metrics.**
  No observability today for the watcher. Add a lightweight stats object: events received per chokidar event type, total flushes, debounce-merge ratio (events ÷ flushes), last flush duration, longest flush duration, last 60s rolling event count. Expose at `GET /api/watcher/stats` for dashboard display, OR log every N flushes. Critical the moment anyone runs st8 against a directory with a high-churn build artifact that escaped the ignore list — without metrics, the first signal is "chokidar is using 80% CPU."

- **Priority 3 — Single point of schema-card emission via the notification bus.**
  Today `main.js`'s watcher branches call `emitter.emitCard()` out-of-band, while `notificationBus.publish()` has a dormant `printer.printCard(event.schemaCard)` branch that no publisher feeds. Unify: have publishers attach `schemaCard` to the event, and let the bus drive both the SSE broadcast and the printer/emitter fan-out from a single point. Removes a class of bugs where the SSE fires but the card on disk gets out of sync (or vice versa) because two different code paths did the work. Pairs naturally with the P1 hook-conversion refactor.

- **Priority 3 — Replace the `pendingChanges` Set with a Map keyed by path.**
  `file-watcher.js:42` declares `pendingChanges = new Set()` but pushes `{ path, type }` object literals — each call creates a fresh object reference, so the Set never deduplicates. A file touched 100 times in 500ms produces a 100-entry flush. Switch to `Map<path, type>` (last-write-wins semantics) or `Map<path, Set<type>>` if all event types must survive. Order of magnitude less work in the flush callback and a cleaner contract for downstream subscribers (the P1 hook conversion benefits directly).

- **Priority 3 — Coordination service: subscribe or retire.**
  `src/frontend/services/coordination.js` polls every 2s. Grep across `src/frontend/` for `St8Coordination.addListener` returns zero hits. The service is doing work no one consumes. Two paths: (a) wire a real consumer — e.g. the constellation status updater described in P1 above could route through coordination's listener API instead of subscribing to SSE directly, giving coordination a single concrete consumer and a single source of truth for manifest state; (b) retire to OGB following the batch-025 `state.js` precedent if no consumer materializes. Decision needed before the next frontend pass.
