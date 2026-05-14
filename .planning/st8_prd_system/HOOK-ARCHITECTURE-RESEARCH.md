# ST8 Hook Architecture — Research Report

**Date:** 2026-05-13
**Scope:** Full project search for hook systems, event architecture, callbacks, plugin/extension points
**Search Root:** `/home/bozertron/1_AT_A_TIME/st8`

---

## Executive Summary

**A formal hook system is NOT implemented in st8.** However, the project contains **four distinct hook-like patterns** that are already wired and functional. These patterns are based on Node.js `EventEmitter`, callback injection, SSE (Server-Sent Events), and WebSocket listener registration. The planning documentation describes a deliberate hook chain architecture that is approximately 70% realized in code. No git hooks, no plugin system, no middleware/interceptor framework exists.

---

## 1. Files Containing the Term "hook"

### Code Files (1 file)
| File | Lines | Context |
|------|-------|---------|
| `/home/bozertron/1_AT_A_TIME/st8/phreak-terminal.js` | 12, 36, 390, 405, 409, 765, 786, 788, 789, 812, 813, 815, 816 | Phone "off-hook"/"on-hook" UI toggle (metaphorical, not architectural) |

### Planning/Documentation Files (7 files)
| File | Lines | Context |
|------|-------|---------|
| `/home/bozertron/1_AT_A_TIME/st8/.planning/This is a rich vision.txt` | 1, 2, 52, 64, 73, 75, 209, 213 | **Primary hook architecture design document** — describes the hook chain from file watcher through mutation logging |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/st8_identity_system/PHASE-SPECS.md` | 1179, 1405 | Phase 3C spec: "Wire mutation + emission hooks into change callback" |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/st8_identity_system/10_fileWatcher_js_verification.md` | 19 | "No changes to fileWatcher.js itself are required — the hook is already in place" |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/REFACTORED-PLAN.md` | 78, 79, 96 | "Save hook" behavior for Notes popup (writes to file_intent, activity_log, LLM context) |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/HANDOFF-MASTER-REFERENCE.md` | 296, 492, 554 | References "phone-hook signal framework" |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/Let me check the directory.txt` | 28 | "index.js mutation hooks, server.js SSE endpoint, _handleVerify fixes" |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/codebase/CONCERNS.md` | 22 | Bug report: toggling phone off-hook never shows status message |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/codebase/CONVENTIONS.md` | 69 | CSS class: `phreak-phone--offhook` |

### HTML/CSS (1 file)
| File | Lines | Context |
|------|-------|---------|
| `/home/bozertron/1_AT_A_TIME/st8/st8.html` | 1192 | CSS class `.phreak-phone--offhook` |

---

## 2. Existing Hook-Like Patterns

### Pattern A: FileWatcher Callback Hook (IMPLEMENTED)

**Location:** `backend/fileWatcher.js` (line 39, 113-118)
**Wired In:** `backend/index.js` (lines 168-311)

This is the **primary hook point** in st8. The `FileWatcher` class accepts an `onFileChange` callback in its constructor options. When chokidar detects a file change (add/change/unlink), the callback fires after debouncing.

```
chokidar 'add'/'change'/'unlink' event
  -> FileWatcher._onFileChange()  (debounce)
  -> FileWatcher._flush()
  -> options.onFileChange(changes)  ← THE HOOK POINT
```

**What the callback does (in index.js lines 170-310):**
1. Filters to code files only
2. For `add`: creates fingerprint, upserts to DB, logs CREATE mutation, publishes to notification bus
3. For `change`: re-hashes file, logs EDIT mutation, extracts AST, emits schema card, publishes to notification bus
4. For `unlink`: removes from DB
5. Regenerates manifests if anything changed

**Assessment:** This is a single-callback hook. No chaining, no priority ordering, no way to register multiple listeners.

---

### Pattern B: NotificationBus EventEmitter (IMPLEMENTED)

**Location:** `backend/notificationBus.js` (full file, 125 lines)
**Type:** Singleton `EventEmitter` subclass

The `NotificationBus` extends Node.js `EventEmitter` and provides a pub/sub system for mutation events.

**Event types emitted:**
- `'mutation'` — all mutations
- `'mutation:${mutationType}'` — typed mutations (e.g., `'mutation:EDIT'`, `'mutation:CREATE'`, `'mutation:LOCK'`, `'mutation:PRODUCTION'`)

**Publish chain (line 33-67):**
```
notificationBus.publish(event)
  -> this.emit('mutation', enriched)         ← in-process subscribers
  -> this.emit('mutation:${type}', enriched) ← typed subscribers
  -> this._broadcastSSE(enriched)            ← SSE frontend clients
  -> console.log(...)                        ← console output
  -> this.printer.printCard(...)             ← .txt fallback (if schema card present)
```

**SSE endpoint:** `/api/mutations` in `backend/server.js` (line 106-108, handler at 719-726)

**Frontend consumer:** `st8.html` lines 2086-2106 — `EventSource` listener that receives mutation events and displays toast notifications.

**Assessment:** This is a proper event bus. Any module can `notificationBus.on('mutation', callback)` to subscribe. The try/catch around `emit()` (lines 42-47) prevents one failing listener from breaking others. This is the closest thing to a formal hook system in st8.

---

### Pattern C: EPO WebSocket Bus (EXTERNAL, OPTIONAL)

**Location:** `phreak-terminal.js` (lines 39, 1000-1001), `file-explorer.js` (lines 156-164)
**Type:** External WebSocket client (`window.epoClient`) injected by "actu8" runtime

The EPO bus provides an external integration point for the st8 UI. It uses a request-response pattern and a broadcast listener:

```javascript
// Request-response (file-explorer.js:164)
epoClient.request('file_list', { path: dirPath })

// Broadcast listener (phreak-terminal.js:68-93)
epoClient.listen(callback)  // receives: announcement, chat_response, media, system, etc.
```

**Message types** (from `.planning/codebase/INTEGRATIONS.md`):
- `file_list` — list directory contents
- `exec` — execute shell command
- `get_streams`, `get_status`, `get_health`, `get_config` — media control
- Broadcast signals: `announcement`, `chat_response`, `media`, `system`

**Assessment:** This is an external hook point, not an internal one. st8 is the consumer, not the provider. The EPO bus is optional — when disconnected, st8 falls back to simulation mode.

---

### Pattern D: Coordination Listener Pattern (IMPLEMENTED)

**Location:** `coordination.js` (lines 20-23, 46-54, 82-90)
**Type:** Polling-based listener registration for manifest changes

```javascript
// Register a listener for manifest changes
const unsubscribe = St8Coordination.addListener(function(manifest) {
    // React to manifest changes
});

// Polling starts automatically
St8Coordination.startPolling('/api/connection-state.json');
```

**Assessment:** Simple listener array with manual cleanup. Polls every 2 seconds. Not event-driven (no EventEmitter), but provides a hook point for frontend components to react to backend state changes.

---

## 3. Event System / Callback Architecture Summary

| System | Type | Location | Status | Formal Hook? |
|--------|------|----------|--------|--------------|
| FileWatcher callback | Constructor option | `backend/fileWatcher.js` | IMPLEMENTED | No — single callback, not extensible |
| NotificationBus | EventEmitter singleton | `backend/notificationBus.js` | IMPLEMENTED | **Yes** — closest to a formal hook system |
| SSE mutation stream | HTTP SSE | `backend/server.js` + `st8.html` | IMPLEMENTED | No — one-directional, frontend-only |
| EPO WebSocket bus | External injection | `phreak-terminal.js`, `file-explorer.js` | IMPLEMENTED (optional) | No — external integration, not internal |
| Coordination listeners | Polling + callback array | `coordination.js` | IMPLEMENTED | No — polling-based, not event-driven |
| Activity log | SQLite table | `backend/persistence.js` | IMPLEMENTED | No — persistence, not hooks |
| Mutation log | SQLite table | `backend/persistence.js` | IMPLEMENTED | No — persistence, not hooks |

---

## 4. Plugin / Extension Points

**No plugin system exists in st8.** Specific findings:

- **No `pluginRegistry.js`** in st8 (exists in maestro-scaffolder-tool at `/home/bozertron/Software Projects/maestro-scaffolder-tool/dist/`)
- **No `pluginCli.js`** in st8
- **No plugin directories** (no `plugins/` folder)
- **No middleware pattern** (server.js uses direct `switch/case` routing, no middleware chain)
- **No interceptor pattern** (no request/response interceptors)
- **groundPlane.js** references `plugins` directory paths (lines 74-76) but these are from maestro's architecture, not st8's

**Phreak Terminal Public API** (`phreak-terminal.js` lines 1018-1086) exposes methods via `window.PhreakTerminal`:
- `mount`, `execute`, `focus`, `copyLine`, `getLines`, `clear`
- `toggleTUI`, `receiveSignal`, `getSignals`
- `notifyMutation`, `togglePhoneOffHook`, `getPhoneState`
- `appendToken`, `sealLine`, `getState`

This is a public API surface, not a hook/extension system.

---

## 5. Git Hooks

**No git hooks are implemented.** The `.git/hooks/` directory was searched — no files found.

The planning document (`This is a rich vision.txt`, line 75) explicitly states:

> "For the git integration specifically, we'd add a **complementary** `post-commit` hook that records commit-level state changes (like a checkpoint marker in the mutation log), but the file watcher is the primary driver."

And line 213:
> "Git `post-commit` hook — Records commit checkpoint in mutation log — New .git/hooks/ file"

This is planned but NOT implemented.

---

## 6. The Designed Hook Chain (from Planning Docs)

The `.planning/This is a rich vision.txt` (lines 52-71) describes the intended hook chain:

```
IDE Save / File Watcher Event
  -> chokidar 'change' event  (already exists in fileWatcher.js)
  -> FileWatcher._onFileChange()  (already fires on add/change/unlink)
  -> NEW: _emitMutation(change)  <- the hook point
       -> persistence.logMutation()        -> writes to file_mutation_log
       -> persistence.upsertFile()         -> updates file_registry
       -> indexer.parseFile()              -> re-extracts AST metadata
       -> schemaCardEmitter.emit(file)     -> writes .st8/schema-card.json
       -> notificationBus.publish(event)   -> SSE to frontend / notification
```

**Implementation status:**
| Step | Status | Location |
|------|--------|----------|
| chokidar 'change' event | IMPLEMENTED | `fileWatcher.js:82-84` |
| FileWatcher._onFileChange() | IMPLEMENTED | `fileWatcher.js:93-105` |
| `_emitMutation()` as named function | NOT IMPLEMENTED | Logic is inline in `index.js:170-310` callback |
| persistence.logMutation() | IMPLEMENTED | `persistence.js:306-320` |
| persistence.upsertFile() | IMPLEMENTED | `persistence.js` |
| indexer.parseFile() | PARTIAL | AST extraction happens inline, not via dedicated `parseFile()` |
| schemaCardEmitter.emit() | IMPLEMENTED | `schemaCardEmitter.js:39-85` |
| notificationBus.publish() | IMPLEMENTED | `notificationBus.js:33-67` |

**The gap:** The hook chain is implemented as **inline logic** in `index.js`'s `onFileChange` callback (lines 170-310). It is NOT extracted into a reusable `_emitMutation()` function, and there is no hook registry or plugin mechanism to extend it.

---

## 7. The Activity Log as Hook Audit Trail

The `activity_log` table in SQLite (`backend/persistence.js`) records system-level events:

```sql
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY,
    timestamp TEXT,
    source TEXT,       -- USER_UI | AI_SIGNAL | FILE_HOOK | MANUAL
    action TEXT,       -- CONNECTED | DISCONNECTED | MODIFIED | VERIFIED | NOTE_ADDED
    target_fingerprint TEXT,
    details TEXT       -- freeform JSON
);
```

Note: `FILE_HOOK` is defined as a source type in the schema (from `REFACTORED-PLAN.md` line 210), indicating the intent to use file-watcher-driven events as an audit source. This is partially implemented via `logActivity()` calls in `server.js`.

---

## 8. Recommendations

### 8.1 If a Formal Hook System Is Needed

**Priority: MEDIUM** — The current inline wiring works for st8's single-project scope. A formal hook system becomes valuable if:
- Multiple modules need to react to the same file change event
- Third-party tools need to integrate with st8's event stream
- Hook ordering/priority matters (e.g., validation before persistence)
- Hooks need to be registered/unregistered dynamically

**Recommended approach:** Extend the existing `NotificationBus` pattern rather than building a new system.

```javascript
// backend/hookRegistry.js (proposed)
class HookRegistry extends EventEmitter {
    constructor() {
        super();
        this.hooks = new Map(); // hookName -> [{priority, handler, source}]
    }

    register(hookName, handler, options = {}) {
        const entry = {
            priority: options.priority || 100,
            handler,
            source: options.source || 'unknown'
        };
        if (!this.hooks.has(hookName)) this.hooks.set(hookName, []);
        this.hooks.get(hookName).push(entry);
        this.hooks.get(hookName).sort((a, b) => a.priority - b.priority);
    }

    async execute(hookName, context) {
        const hooks = this.hooks.get(hookName) || [];
        for (const hook of hooks) {
            await hook.handler(context);
        }
        return context;
    }
}
```

**Hook points to formalize:**
1. `file:before-change` — before mutation is logged (for validation)
2. `file:after-change` — after mutation + schema card emission (for notifications)
3. `file:before-index` — before batch indexing starts
4. `file:after-index` — after indexing completes
5. `lifecycle:transition` — when a file's lifecycle phase changes
6. `prd:generate` — before/after PRD generation

### 8.2 If Git Hooks Are Needed

**Priority: LOW** — The file watcher is the primary hook point and covers all save events. Git hooks would only add value for:
- Recording commit checkpoints in the mutation log
- Triggering full re-index on merge/rebase
- Pre-commit validation against schema cards

**Recommended approach:** A single `post-commit` hook script:

```bash
#!/bin/bash
# .git/hooks/post-commit
# Records a commit checkpoint in the st8 mutation log
node backend/cli.js record-commit --commit-hash=$(git rev-parse HEAD)
```

### 8.3 If Plugin/Extension System Is Needed

**Priority: LOW** — Not needed for current st8 scope. If needed later, the existing `groundPlane.js` already defines plugin directory paths (lines 74-76) from maestro's architecture. The maestro plugin system (`pluginRegistry.js`, `pluginCli.js`) could be referenced for design patterns.

---

## 9. Architecture Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │              ST8 Hook Architecture            │
                    │              (Current State)                  │
                    └──────────────────────────────────────────────┘

  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
  │   chokidar   │────>│ FileWatcher  │────>│  index.js           │
  │   (OS fs     │     │ .onFileChange│     │  onFileChange()     │
  │    events)   │     │ (debounced)  │     │  (inline hook chain)│
  └─────────────┘     └──────────────┘     └──────────┬──────────┘
                                                       │
                              ┌─────────────────────────┼──────────────────┐
                              │                         │                  │
                              v                         v                  v
                    ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
                    │ persistence.js  │   │ schemaCard       │   │ notificationBus │
                    │ .logMutation()  │   │ Emitter.emit()   │   │ .publish()      │
                    │ .upsertFile()   │   │ (writes .st8/    │   │ (EventEmitter)  │
                    │ (SQLite)        │   │  schema-cards/)  │   │                 │
                    └─────────────────┘   └──────────────────┘   └────────┬────────┘
                                                                          │
                                                         ┌────────────────┼────────────────┐
                                                         │                │                │
                                                         v                v                v
                                                 ┌──────────────┐ ┌───────────┐ ┌──────────────┐
                                                 │ SSE clients  │ │ Console   │ │ Printer      │
                                                 │ (st8.html    │ │ output    │ │ (.txt        │
                                                 │  EventSource)│ │           │ │  fallback)   │
                                                 └──────────────┘ └───────────┘ └──────────────┘

  ┌───────────────────────────────────────────────────────────────────────────────────────────┐
  │  EXTERNAL INTEGRATION (Optional)                                                         │
  │  ┌─────────────┐     ┌──────────────┐     ┌──────────────────────┐                     │
  │  │ EPO WebSocket│────>│ phreak-term  │     │ coordination.js      │                     │
  │  │ bus (actu8)  │     │ .listen()    │     │ .addListener()       │                     │
  │  └─────────────┘     └──────────────┘     │ (polling-based)      │                     │
  │                                           └──────────────────────┘                     │
  └───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Summary Table

| Question | Answer |
|----------|--------|
| Is a hook system implemented? | **No** — not as a formal, extensible system |
| What hook-like patterns exist? | 4: FileWatcher callback, NotificationBus EventEmitter, EPO WebSocket bus, Coordination listeners |
| Are git hooks implemented? | **No** — planned but not built |
| Is there a plugin system? | **No** — maestro has one, st8 does not |
| Is there middleware/interceptor? | **No** — server.js uses direct switch/case routing |
| What is the primary hook point? | `FileWatcher.onFileChange` callback, wired in `backend/index.js:170-310` |
| What is the event bus? | `NotificationBus` singleton (EventEmitter + SSE + console + printer) |
| Can external tools subscribe? | Yes, via SSE at `/api/mutations` or by importing `notificationBus` |
| What's the biggest gap? | The hook chain is inline code, not a reusable/extendable hook registry |

---

*Report generated: 2026-05-13*
*Search method: Grep for "hook", "callback", "event", "listener", "emit", "trigger", "plugin", "extension", "middleware", "interceptor", "pre-commit", "post-commit", "pre-index", "post-index", "on-change" across all project files*
