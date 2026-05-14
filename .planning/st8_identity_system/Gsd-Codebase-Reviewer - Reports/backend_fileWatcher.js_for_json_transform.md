# Detailed Line-by-Line Report: `backend/fileWatcher.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/fileWatcher.js`
**Total Lines:** 139
**Report Date:** 2026-05-13
**Status:** WORKING (code is structurally complete but NOT CONNECTED in production — see §Connection Gaps)

---

## Section 1: Shebang & File Header

### Lines 1-9: Shebang + Module Docstring

```
Lines 1-9: Shebang and file header comment
- What triggers it: N/A (documentation only)
- What it calls: N/A
- What calls it: N/A
- Dependencies: None
- Status: WORKING
- Gap: None — purely informational. Note the instruction on line 8:
  "DO NOT copy files from maestro. Import/require by path." This is a
  project convention, not a code issue.
```

**Line-by-line:**
- **Line 1:** `#!/usr/bin/env node` — Shebang for direct execution via `./fileWatcher.js`. However, this file is never executed directly; it's always `require()`'d by `backend/index.js:17`. The shebang is harmless dead weight.
- **Lines 3-9:** JSDoc block. Describes purpose ("Watches for file changes and triggers re-indexing") and references maestro-scaffolder-tool.

---

## Section 2: Strict Mode & Imports

### Lines 11-14: `'use strict'` + Core Module Requires

```
Lines 11-14: Imports
- What triggers it: Module load time (require())
- What it calls: Node.js built-in `path` and `fs` modules
- What calls it: `backend/index.js:17` → `require('./fileWatcher')`
- Dependencies: Node.js built-ins (path, fs)
- Status: WORKING
- Gap: NONE — both `path` and `fs` are imported but ONLY `path` is
  used in the file itself. `fs` is imported but never used directly
  within fileWatcher.js. It's a dead import at this scope level.
```

**Line-by-line:**
- **Line 11:** `'use strict';` — Enforces strict mode. Correct.
- **Line 13:** `const path = require('path');` — **UNUSED within fileWatcher.js.** The `path` module is imported but no `path.*` calls exist in this file. The `path` module is needed by the *callback* in `index.js`, not by the watcher itself. This is a dead import within this file's scope.
- **Line 14:** `const fs = require('fs');` — **UNUSED within fileWatcher.js.** Same situation — `fs` is imported but no `fs.*` calls exist in this file. The `fs` module is used in `index.js`'s callback, not in the watcher class. Dead import.

**BUG (Minor/Quality):** Lines 13-14 import `path` and `fs` but neither is used within this file. They should be removed from `fileWatcher.js` and kept only in the consuming `index.js`.

---

## Section 3: Chokidar Lazy Loader

### Lines 16-31: `loadChokidar()` Function

```
Lines 16-31: Lazy chokidar loader with singleton cache
- What triggers it: Called by `start()` method at line 46
- What it calls: `require('chokidar')` — third-party package
- What calls it: `FileWatcher.start()` at line 46
- Dependencies: `chokidar` npm package (declared in backend/package.json:13)
- Status: WORKING
- Gap: See below for error handling concern
```

**Line-by-line:**
- **Line 18:** `let _chokidar = null;` — Module-level singleton cache. Starts `null`, populated on first call. Correct pattern for lazy loading.
- **Lines 20-31:** `function loadChokidar()` — Lazy loader with try/catch.
  - **Line 21:** `if (!_chokidar)` — Guard: only loads once. Correct.
  - **Line 24:** `_chokidar = require('chokidar');` — Tries to load chokidar from local `node_modules`. If `node_modules` doesn't exist or chokidar isn't installed, this throws.
  - **Line 26:** `console.error('[st8:watcher] Failed to load chokidar:', err.message);` — Logs failure. **Note:** This silently degrades — if chokidar fails to load, `_chokidar` stays `null` and the watcher never starts. The caller at line 47-50 handles this by returning `false`, but there's no retry mechanism.
  - **Line 27:** `_chokidar = null;` — Explicit reset after failure. Redundant since it was already null, but defensive. Fine.

**CONCERN:** The `chokidar` package is listed in `backend/package.json:13` as a regular dependency (`"chokidar": "^3.6.0"`), not optional. If it fails to load, it means `npm install` wasn't run. The error message doesn't suggest running `npm install` — a minor UX gap.

---

## Section 4: FileWatcher Class

### Lines 33-133: `class FileWatcher`

```
Lines 33-133: The FileWatcher class — the core of this module
- What triggers it: Instantiated by `backend/index.js:191` when --watch flag is set
- What it calls: chokidar.watch(), clearTimeout(), setTimeout()
- What calls it: `backend/index.js:191` → `new FileWatcher(targetDir, {...})`
- Dependencies: chokidar (lazy-loaded), Node.js timers
- Status: WORKING (structurally correct)
- Gap: Not started in production (missing --watch flag on CLI)
```

---

### Lines 36-43: Constructor

```
Lines 36-43: constructor(targetDir, options = {})
- What triggers it: `new FileWatcher(targetDir, options)` from index.js:191
- What it calls: None (pure initialization)
- What calls it: backend/index.js:191
- Dependencies: None
- Status: WORKING
- Gap: None
```

**Line-by-line:**
- **Line 36:** `constructor(targetDir, options = {})` — Takes target directory and options object. Default empty options is correct.
- **Line 37:** `this.targetDir = targetDir;` — Stores the directory to watch. Set from `index.js:63` → `path.resolve(args[0])`.
- **Line 38:** `this.debounceMs = options.debounceMs || 500;` — Debounce interval in ms. **SUBTLE BUG:** Using `||` means if someone passes `debounceMs: 0` (intentionally disabling debounce), it falls back to `500`. Should use `?? ` (nullish coalescing) instead: `options.debounceMs ?? 500`. However, `0` debounce is an unlikely use case, so this is a minor quality issue.
- **Line 39:** `this.onFileChange = options.onFileChange || null;` — Callback function. Set from `index.js:193-399` — a massive async function that handles add/change/unlink events. Correct.
- **Line 40:** `this.watcher = null;` — Will hold the chokidar watcher instance. Set in `start()`.
- **Line 41:** `this.debounceTimer = null;` — Will hold the setTimeout reference for debounce. Set in `_onFileChange()`.
- **Line 42:** `this.pendingChanges = new Set();` — Accumulates file changes between debounce flushes. **NOTE:** This is a `Set` of objects `{ path, type }`. Since JavaScript Sets use reference equality for objects, two identical change objects will both be stored. This is actually correct behavior — we want to accumulate all change events, even if the same file changes multiple times before flush. But the deduplication intent is defeated — the Set won't actually deduplicate because each `{ path, type }` is a new object literal. **BUG:** If the intent was deduplication, this is broken. If the intent is just accumulation, a plain `Array` would be more honest and cheaper.

**Line 94 confirms the bug:**
```js
this.pendingChanges.add({ path: filePath, type: eventType });
```
Each call creates a new object, so `Set.add()` will never detect a duplicate. The Set provides no benefit over an Array here.

---

### Lines 45-91: `start()` Method

```
Lines 45-91: start() — Initializes and starts the chokidar file watcher
- What triggers it: `watcher.start()` from backend/index.js:401
- What it calls: loadChokidar() (line 46), chokidar.watch() (line 54),
  this._onFileChange() (lines 82-84), console.error() (line 86)
- What calls it: backend/index.js:401 (only when --watch flag is set)
- Dependencies: chokidar npm package
- Status: WORKING
- Gap: None (structural issues are in connection, not in this method)
```

**Line-by-line:**
- **Line 46:** `const chokidar = loadChokidar();` — Calls the lazy loader.
- **Lines 47-50:** `if (!chokidar) { ... return false; }` — Graceful degradation if chokidar unavailable. Returns `false` to indicate failure. **NOTE:** The caller at `index.js:401` does NOT check this return value — it calls `watcher.start()` without capturing or checking the result. This is a silent failure path.

  **BUG (at caller):** `index.js:401` ignores the `false` return from `start()`. If chokidar fails to load, the watcher silently never starts and no error is surfaced to the user beyond the console.error inside `loadChokidar()`.

- **Line 52:** `console.log(...)` — Logs the target directory. Correct.
- **Lines 54-80:** `this.watcher = chokidar.watch(this.targetDir, { ... })` — The core chokidar configuration:

  **Ignored patterns (lines 55-71):**
  - Line 56: `**/node_modules` — Correct, standard ignore.
  - Line 57: `**/.git` — Correct.
  - Lines 58-59: `**/dist`, `**/build` — Correct, build output.
  - Lines 60-61: `**/.venv`, `**/venv` — Python virtual envs. Correct.
  - Line 62: `**/__pycache__` — Python cache. Correct.
  - Lines 63-65: `**/*.sqlite`, `**/*.sqlite-wal`, `**/*.sqlite-shm` — Database files. **IMPORTANT:** This prevents the watcher from triggering on its own database writes, which would cause infinite loops. Correct.
  - **Line 66:** `**/*.json` — **SIGNIFICANT:** This ignores ALL JSON files. The watcher will NOT detect changes to `.json` files. This means if someone edits `connection-state.json` or any `.json` config, the watcher won't react. This is intentional (per the architecture — JSON is generated output), but it's worth noting.
  - **Line 67:** `**/*.toml` — Ignores all TOML files. Same rationale.
  - Line 68: `**/.st8/**` — Ignores the entire `.st8` directory (schema cards, gap analysis, etc.). Correct — these are generated artifacts.
  - **Line 69:** `**/.planning/st8_identity_system/**` — **NOTABLE:** This ignores the identity system directory specifically. This is meta — it prevents the watcher from triggering on its own reports and snapshots.
  - Line 70: `**/.archive/**` — Archive directory. Correct.
  - Line 71: `**/snapshots/**` — Snapshots directory. Correct.

  **Watch options (lines 73-79):**
  - Line 73: `persistent: true` — Keeps the process alive. Correct.
  - Lines 74-77: `awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }` — Waits 200ms of stability before emitting. This is a SECOND debounce layer on top of the `this.debounceMs` (500ms) in `_onFileChange`. The total delay is ~700ms (200ms write stability + 500ms debounce). This double-debounce is intentional but worth noting.
  - Line 78: `depth: 10` — Watches up to 10 directory levels deep. Sufficient for most projects.
  - Line 79: `followSymlinks: false` — Doesn't follow symbolic links. Correct for security.

  **Event handlers (lines 82-87):**
  - Line 82: `this.watcher.on('add', ...)` — File created. Calls `_onFileChange(filePath, 'add')`.
  - Line 83: `this.watcher.on('change', ...)` — File modified. Calls `_onFileChange(filePath, 'change')`.
  - Line 84: `this.watcher.on('unlink', ...)` — File deleted. Calls `_onFileChange(filePath, 'unlink')`.
  - Lines 85-87: `this.watcher.on('error', ...)` — Error handler. Logs but doesn't propagate. **CONCERN:** A chokidar error (e.g., ENOENT on watched directory) is logged but doesn't stop the watcher or notify the callback. The watcher continues in a potentially broken state.

- **Line 89:** `console.log('[st8:watcher] Watcher started');` — Confirmation log.
- **Line 90:** `return true;` — Success indicator. **NOTE:** Not checked by caller (index.js:401).

---

### Lines 93-105: `_onFileChange(filePath, eventType)` — Debounce Entry Point

```
Lines 93-105: _onFileChange() — Handles individual file change events
- What triggers it: chokidar 'add'/'change'/'unlink' events (lines 82-84)
- What it calls: Set.add() (line 94), clearTimeout() (line 97),
  setTimeout() (line 100), this._flush() (line 101)
- What calls it: chokidar event handlers (lines 82-84)
- Dependencies: None (uses native Set, timers)
- Status: WORKING
- Gap: See Set vs Array issue in constructor analysis
```

**Line-by-line:**
- **Line 93:** `_onFileChange(filePath, eventType)` — Private method (underscore convention). Takes absolute file path and event type string.
- **Line 94:** `this.pendingChanges.add({ path: filePath, type: eventType });` — Adds change to pending set. As noted in constructor analysis, this uses object literals so Set never deduplicates. If two 'change' events fire for the same file before flush, both are stored as separate objects. The `_flush()` method at line 108 converts to Array, so all events are processed. **This is functionally correct** — the callback in index.js handles each event independently — but the Set provides no deduplication benefit.

- **Lines 96-98:** `if (this.debounceTimer) { clearTimeout(this.debounceTimer); }` — Standard debounce: cancel previous timer. Correct.
- **Lines 100-104:** `this.debounceTimer = setTimeout(() => { ... }, this.debounceMs);` — Sets new debounce timer.
  - **Line 101:** `this._flush().catch(err => { ... })` — Calls async `_flush()` and catches errors. **NOTE:** `_flush()` is `async` (line 107), so this returns a Promise. The `.catch()` handles rejections. Correct error handling.

---

### Lines 107-120: `_flush()` — Async Callback Invocation

```
Lines 107-120: async _flush() — Processes accumulated changes
- What triggers it: setTimeout callback in _onFileChange() (line 100-104)
- What it calls: Array.from() (line 108), Set.clear() (line 109),
  this.onFileChange() (line 115)
- What calls it: _onFileChange() via setTimeout (line 100-104)
- Dependencies: The callback function passed via options.onFileChange
- Status: WORKING
- Gap: If onFileChange throws synchronously, it's caught. But if it
  returns a rejected Promise, the catch at line 101 handles it. Correct.
```

**Line-by-line:**
- **Line 107:** `async _flush()` — Async method. Returns a Promise.
- **Line 108:** `const changes = Array.from(this.pendingChanges);` — Converts Set to Array. **BUG CONCERN:** As noted, this converts Set of objects to Array. Since Set uses reference equality, if the same file had multiple rapid changes (e.g., two 'change' events), both are in the array. The callback processes each independently. This is correct behavior but the Set provides no deduplication.

  **ACTUAL BUG:** If the *same* file changes twice rapidly (e.g., two 'change' events), the callback in index.js will process it twice — computing the hash twice, logging two EDIT mutations, publishing two SSE events, emitting two schema cards. The second processing will be a no-op (hash matches), but it wastes work. A Map keyed by filePath would properly deduplicate.

- **Line 109:** `this.pendingChanges.clear();` — Clears the set immediately. **IMPORTANT:** If new changes arrive while `_flush()` is running (it's async), they go into a fresh Set and will be debounced again. This is correct behavior — no changes are lost.

- **Line 111:** `console.log(...)` — Logs change count. Correct.

- **Lines 113-119:** `if (this.onFileChange) { try { await this.onFileChange(changes); } catch ... }` — Invokes the callback.
  - **Line 113:** `if (this.onFileChange)` — Null guard. Correct (constructor allows null).
  - **Line 115:** `await this.onFileChange(changes);` — Awaits the async callback. The callback in `index.js:193-399` is `async (changes) => { ... }` and does significant work (hashing, DB writes, SSE, schema cards). **NOTE:** If the callback takes a long time, new file changes accumulate in `pendingChanges` and will be flushed after the next debounce window. No data is lost.
  - **Lines 116-118:** Error catch. Logs but doesn't re-throw. **CONCERN:** If the callback fails (e.g., DB error), the changes are already cleared from `pendingChanges` (line 109) and are permanently lost. They won't be retried. This is a data loss risk for transient errors.

  **BUG (Data Loss):** Line 109 clears `pendingChanges` BEFORE the callback is invoked at line 115. If the callback throws, the changes are gone. The fix would be to clear AFTER successful callback invocation, or to re-add failed changes to pendingChanges.

---

### Lines 122-132: `stop()` — Cleanup Method

```
Lines 122-132: stop() — Stops the watcher and cleans up timers
- What triggers it: SIGINT handler in backend/index.js:420
- What it calls: clearTimeout() (line 124), this.watcher.close() (line 128)
- What calls it: backend/index.js:420 → `watcher.stop()`
- Dependencies: None
- Status: WORKING
- Gap: None — clean shutdown
```

**Line-by-line:**
- **Lines 123-126:** `if (this.debounceTimer) { clearTimeout(...); this.debounceTimer = null; }` — Cancels pending debounce timer. Prevents a flush after stop. Correct.
- **Lines 127-131:** `if (this.watcher) { this.watcher.close(); this.watcher = null; ... }` — Closes chokidar watcher. **NOTE:** `watcher.close()` is async in chokidar v3+ but is NOT awaited here. This is acceptable for cleanup — the process is exiting anyway.
- **Line 130:** `console.log(...)` — Logs stop. Correct.

---

## Section 5: Module Exports

### Lines 135-139: `module.exports`

```
Lines 135-139: Export the FileWatcher class
- What triggers it: require('./fileWatcher') from index.js:17
- What it calls: None
- What calls it: backend/index.js:17
- Dependencies: None
- Status: WORKING
- Gap: None
```

**Line-by-line:**
- **Lines 137-139:** `module.exports = { FileWatcher };` — Exports the class as a named export. Correct.

---

## Connection Map

### What triggers the watcher to start?

| Trigger | Location | Condition |
|---------|----------|-----------|
| `--watch` CLI flag | `backend/index.js:64` | `args.includes('--watch')` |
| `watcher.start()` | `backend/index.js:401` | Only if `watchMode` is true |

**CRITICAL GAP:** The production process runs as:
```
node backend/index.js /home/bozertron/1_AT_A_TIME/st8 --serve --port 3847
```
**Missing `--watch` flag.** The watcher is NEVER started in the current production configuration. (Source: FILEWATCHER-ARCHITECTURE.md)

### What files get called when changes are detected?

When `onFileChange` callback fires (defined in `index.js:193-399`), it calls:

| Module | Method | Location Called From |
|--------|--------|-------------------|
| `./persistence` | `upsertFile()` | index.js:279, 332 |
| `./persistence` | `logMutation()` | index.js:218-225, 281-288, 334-341 |
| `./persistence` | `deleteFile()` | index.js:246 |
| `./notificationBus` | `publish()` | index.js:228-234, 290-296, 343-349 |
| `./manifestGenerator` | `writeManifests()` | index.js:377-378 |
| `./schemaCardEmitter` | `emitCard()` | index.js:308-311, 361-364 |
| `./st8-types` | `generateFingerprint()` | index.js:259 |
| `lib/utils/astParser.js` | `extractImportsAndExports()` | index.js:303-304, 355-356 |
| `./intentSeeder` | `seedAll()` | index.js:384-385 |
| `./gapAnalyzer` | `writeReport()` | index.js:394 |
| `fs` | `readFileSync()` | index.js:255, 326 |
| `crypto` | `createHash()` | index.js:256, 324-326 |

### What's NOT connected?

1. **fileWatcher.js does NOT call any of the above directly.** It only invokes the callback. All business logic lives in the callback closure in `index.js`.
2. **No connection to `indexer.js`** — The watcher callback does NOT call `indexDirectory()` from indexer.js. Instead, it does inline incremental processing. The full indexer is only used for initial boot.
3. **No connection to `server.js`** — The watcher doesn't know about the HTTP server. It emits to `notificationBus`, which has SSE clients added by the server. The connection is indirect via the notificationBus singleton.

---

## @@@ Symbol Analysis

**No `@@@` symbols found in `backend/fileWatcher.js`.**

The `@@@` handling methods exist in `backend/persistence.js:577-612`:
- `flagForAIReview(filepath, tripleAtCount)` — line 579
- `markAIReviewed(filepath)` — line 586
- `getFilesNeedingAIReview()` — line 593

These are persistence-layer methods for tracking files with `@@@` markers. The file watcher itself does NOT detect or process `@@@` symbols — it only detects file-level changes (add/change/unlink). The `@@@` processing would happen in the indexer or a separate AI review pass.

---

## Summary of Bugs Found

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **HIGH** | Lines 108-115 | `pendingChanges.clear()` before callback invocation — data loss on callback failure |
| 2 | **MEDIUM** | Line 42 | `new Set()` with object literals provides no deduplication — should be `Map<filePath, eventType>` |
| 3 | **MEDIUM** | Line 38 | `|| 500` instead of `?? 500` — falsy debounce values silently overridden |
| 4 | **LOW** | Lines 13-14 | `path` and `fs` imported but unused within this file |
| 5 | **LOW** | Line 90 | `return true` not checked by caller (index.js:401) |
| 6 | **INFO** | Line 1 | Shebang unnecessary — file is never executed directly |

---

## Connection Status Summary

| Component | Connected? | Notes |
|-----------|-----------|-------|
| FileWatcher class → chokidar | ✅ YES | Lazy-loaded, properly guarded |
| FileWatcher → callback | ✅ YES | Debounced, error-handled |
| Callback → persistence | ✅ YES | Full CRUD operations |
| Callback → notificationBus | ✅ YES | SSE + console + printer |
| Callback → manifestGenerator | ✅ YES | Incremental re-write |
| Callback → schemaCardEmitter | ✅ YES | Per-file emission |
| **CLI → watcher start** | ❌ **NO** | `--watch` flag missing from production command |
| Watcher → full re-index | ❌ NO | Only incremental; no full re-index on watcher events |

---

_Reviewed: 2026-05-13_
_Reviewer: GSD-Codebase-Reviewer_
_Depth: standard (line-by-line analysis)_
