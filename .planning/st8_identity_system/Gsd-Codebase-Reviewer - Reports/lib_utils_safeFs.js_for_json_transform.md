# Detailed Line-by-Line Report: `lib/utils/safeFs.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/utils/safeFs.js`
**Total Lines:** 599
**Source Origin:** Compiled from `src/utils/safeFs.ts` (TypeScript → JavaScript via `tsc`)
**Source Map:** `safeFs.js.map` referenced (line 599) but **NOT FOUND** on disk
**Purpose:** Fortified filesystem wrapper — never throws, always returns typed `Result<T, FsError>`

---

## Lines 1-4: File Header & Docstring

```
Lines 1-4: Module header and design intent
- What triggers it: N/A (static header)
- What it calls: N/A
- What calls it: N/A
- Dependencies: None
- Status: WORKING
- Gap: None. Comment references original TS source path `src/utils/safeFs.ts` which does NOT exist on disk — only the compiled JS exists.
```

---

## Lines 5-46: TypeScript Helper Functions (`__createBinding`, `__setModuleDefault`, `__importStar`, `__awaiter`)

```
Lines 5-46: TypeScript compiler-injected polyfills for module interop and async/await
- What triggers it: Called implicitly by every `import * as X` and every `async/await` in the module
- What it calls:
  - __createBinding (lines 5-15): Object.defineProperty or direct assignment for property binding
  - __setModuleDefault (lines 16-20): Sets `default` property on module objects
  - __importStar (lines 21-37): Converts CommonJS require() into namespace-like object
  - __awaiter (lines 38-46): Async/await polyfill wrapping generator functions in Promises
- What calls it: Every `require()` import (lines 62-63) and every `async function` in the file
- Dependencies: `Object.create`, `Object.defineProperty`, `Object.getOwnPropertyNames`, `Promise`, `setTimeout`
- Status: WORKING
- Gap: These are standard TypeScript emit helpers. The `__awaiter` polyfill is used because the TS target is likely ES5/ES2015. No issues, but the code would be cleaner if compiled to native async/await (ES2017+).
```

---

## Lines 47-61: Module Exports Declaration

```
Lines 47-61: CommonJS exports — all public API symbols
- What triggers it: Module load via require()
- What it calls: N/A (just declares exports)
- What calls it: Node.js module system on require()
- Dependencies: None
- Status: WORKING
- Exports declared:
  Line 48: exports.WriteBufferPool = exports.FileHandlePool = void 0;  (placeholder, real export at 439/598)
  Line 49: exports.isTransient = isTransient;
  Line 50: exports.isPermission = isPermission;
  Line 51: exports.isMissing = isMissing;
  Line 52: exports.isCorrupt = isCorrupt;
  Line 53: exports.registerFallback = registerFallback;
  Line 54: exports.safeReadFile = safeReadFile;
  Line 55: exports.safeWriteFile = safeWriteFile;
  Line 56: exports.safeReaddir = safeReaddir;
  Line 57: exports.safeMkdir = safeMkdir;
  Line 58: exports.safeStat = safeStat;
  Line 59: exports.safeAccess = safeAccess;
  Line 60: exports.safeUnlink = safeUnlink;
  Line 61: exports.safeLstat = safeLstat;
- Gap: NONE — all exports match function definitions below.
```

---

## Lines 62-63: Imports

```
Lines 62-63: Core Node.js module imports
- What triggers it: Module load
- What it calls:
  Line 62: const fs = __importStar(require("fs"));    → Node.js fs module (full namespace)
  Line 63: const path = __importStar(require("path")); → Node.js path module (full namespace)
- What calls it: All filesystem operations below use these
- Dependencies: Node.js built-in `fs`, `path`
- Status: WORKING
- Gap: No external dependencies — only Node.js built-ins. This is good for a utility module.
```

---

## Lines 64-78: `classifyErrorCode(err)`

```
Lines 64-78: Error code classification — maps Node.js fs error codes to normalized string codes
- What triggers it: Called by buildFsError() (line 101) whenever any fs operation catches an error
- What it calls: Reads err.code property
- What calls it: buildFsError() at line 101
- Dependencies: Node.js error objects with .code property
- Status: WORKING
- Classified codes:
  Line 67: 'EACCES' → 'EACCES' (permission denied)
  Line 68: 'ENOENT' → 'ENOENT' (file not found)
  Line 69: 'EMFILE' → 'EMFILE' (too many open files)
  Line 70: 'ENOSPC' → 'ENOSPC' (no space left)
  Line 71: 'ELOOP'  → 'ELOOP'  (too many symbolic links)
  Line 72: 'EISDIR' → 'EISDIR' (is a directory)
  Line 73: 'EPERM'  → 'EPERM'  (operation not permitted)
  Line 74: 'EEXIST' → 'EEXIST' (file already exists)
  Line 75: 'ENOTDIR'→ 'ENOTDIR'(not a directory)
  Line 76: default  → 'UNKNOWN'
- Gap: None — comprehensive error code mapping. The function is a simple pass-through with normalization.
```

---

## Lines 79-96: `classifySeverity(code)`

```
Lines 79-96: Maps normalized error codes to severity levels
- What triggers it: Called by buildFsError() at line 105
- What it calls: None (pure switch statement)
- What calls it: buildFsError() at line 105
- Dependencies: None
- Status: WORKING
- Severity mapping:
  Lines 81-83: 'EACCES', 'EPERM' → 'warning' (permission issues — may resolve)
  Lines 84-85: 'ENOENT' → 'skip' (file not found — not actionable)
  Lines 86-94: 'EMFILE', 'ENOSPC', 'ELOOP', 'EISDIR', 'EEXIST', 'ENOTDIR', 'TIMEOUT', 'UNKNOWN' → 'fatal'
- Gap: None — well-structured severity classification.
```

---

## Lines 97-99: `isRetryable(code)`

```
Lines 97-99: Determines if an error code warrants automatic retry
- What triggers it: Called by buildFsError() at line 108
- What it calls: None (pure function)
- What calls it: buildFsError() at line 108, which feeds into withRetry() decision logic at line 147
- Dependencies: None
- Status: WORKING
- Retryable codes: 'EMFILE' (too many open files), 'ENOSPC' (disk full)
- Gap: None — these are the two transient filesystem errors that may self-resolve.
```

---

## Lines 100-110: `buildFsError(err, filePath)`

```
Lines 100-110: Constructs a normalized FsError object from a raw Node.js error
- What triggers it: Every catch block in every safe* function
- What it calls:
  Line 101: classifyErrorCode(err) → gets normalized code
  Line 105: classifySeverity(code) → gets severity
  Line 108: isRetryable(code) → gets retry flag
- What calls it: safeReadFile (line 180), safeWriteFile (line 204), safeReaddir (line 235), safeMkdir (line 254), safeStat (line 270), safeAccess (line 287), safeUnlink (line 303), safeLstat (line 319)
- Dependencies: classifyErrorCode, classifySeverity, isRetryable
- Status: WORKING
- Returns shape:
  {
    code: string,           // Normalized error code
    message: string,        // Original error message
    severity: 'warning' | 'skip' | 'fatal',
    originalError: Error,   // Preserved for stack trace
    path: string,           // File path that caused the error
    retryable: boolean,     // Whether withRetry should attempt again
  }
- Gap: None — clean error factory pattern.
```

---

## Lines 111-127: Public Classification Predicates

```
Lines 111-127: Four exported predicate functions for error classification
- What triggers it: External callers checking error types
- What it calls: None (pure functions reading .code property)
- What calls it:
  - Currently NOT called by any file in the codebase (no grep matches outside this file)
  - Exported for external use but UNUSED
- Dependencies: None
- Status: NOT CONNECTED (exported but never imported/called anywhere)

  Line 113-115: isTransient(error) → checks for 'EMFILE' or 'ENOSPC'
  Line 117-118: isPermission(error) → checks for 'EACCES' or 'EPERM'
  Line 121-122: isMissing(error) → checks for 'ENOENT'
  Line 125-126: isCorrupt(error) → checks for 'ELOOP', 'EISDIR', 'ENOTDIR'

- Gap: These are dead code — exported but never consumed. They duplicate the logic in isRetryable() and classifySeverity(). Either callers should use these instead of raw code checks, or they should be removed.
```

---

## Lines 128-132: `DEFAULT_RETRY` Configuration

```
Lines 128-132: Default retry configuration object
- What triggers it: Used as default parameter in withRetry()
- What it calls: None (constant)
- What calls it: withRetry() at line 139
- Dependencies: None
- Status: WORKING
- Values:
  maxRetries: 3       (up to 3 retries after initial attempt = 4 total attempts)
  baseDelayMs: 100    (100ms initial delay)
  maxDelayMs: 5000    (5 second max delay cap)
- Gap: None — reasonable defaults for filesystem retry.
```

---

## Lines 133-137: `sleep(ms)`

```
Lines 133-137: Async sleep utility using setTimeout wrapped in Promise
- What triggers it: Called by withRetry() at line 151
- What it calls: setTimeout (Node.js timer)
- What calls it: withRetry() at line 151
- Dependencies: None
- Status: WORKING
- Gap: None — standard async sleep pattern.
```

---

## Lines 138-155: `withRetry(operation, opts)`

```
Lines 138-155: Core retry logic with exponential backoff
- What triggers it: Every safe* function wraps its fs operation in withRetry()
- What it calls:
  Line 142: operation() — the fs operation being retried
  Line 147: Checks lastResult.error.retryable (set by buildFsError → isRetryable)
  Line 150: Math.pow(2, attempt) for exponential backoff
  Line 151: sleep(delay)
- What calls it: safeReadFile (line 174), safeWriteFile (lines 195, 206), safeReaddir (line 229), safeMkdir (line 248), safeStat (line 264), safeAccess (line 281), safeUnlink (line 297)
- Dependencies: DEFAULT_RETRY, sleep, FsError.retryable
- Status: WORKING
- Algorithm:
  1. Execute operation immediately (attempt 0)
  2. If success, return immediately
  3. If error is NOT retryable OR max retries exhausted, return failure
  4. Wait with exponential backoff: min(100 * 2^attempt, 5000) ms
  5. Repeat up to maxRetries times
  6. Backoff sequence: 100ms → 200ms → 400ms (capped at 5000ms)
- Gap: None — correct exponential backoff with jitter-free delay (jitter could be added for thundering herd, but not critical for single-process usage).
```

---

## Lines 156-167: Fallback Registry

```
Lines 156-167: In-memory fallback path registry and resolution
- What triggers it: registerFallback() called by external setup code; getFallbackPath() called by safeWriteFile()
- What it calls:
  Line 159: Array.push() on fallbackRegistry
  Line 162: Array.find() with startsWith matching
  Line 165: path.relative() to compute relative path
  Line 166: path.join() to construct fallback path
- What calls it:
  registerFallback: Exported (line 53) but NEVER CALLED by any file in the codebase
  getFallbackPath: Called only by safeWriteFile() at line 214
- Dependencies: Node.js path module
- Status: PARTIAL
  - registerFallback() is exported but never invoked by any consumer
  - getFallbackPath() is called but will always return undefined because no fallbacks are registered
  - This means the fallback write logic in safeWriteFile (lines 214-220) is DEAD CODE
- Gap: registerFallback() is never called. Either:
  1. groundPlane.js should call registerFallback() during initialization to register fallback paths, OR
  2. The fallback mechanism is unused/dead code that should be removed.
```

---

## Lines 168-184: `safeReadFile(filePath, encoding)`

```
Lines 168-184: Safe file read — never throws, returns Result<string, FsError>
- What triggers it: External callers needing to read files safely
- What it calls:
  Line 174: withRetry() wrapping the read operation
  Line 176: fs.promises.readFile(filePath, { encoding })
  Line 180: buildFsError(err, filePath) on failure
- What calls it:
  - dataIngestion.js line 933: reads package.json files through ioChan
  - ioChan.js line 211: referenced in documentation comment
- Dependencies: fs.promises.readFile, withRetry, buildFsError
- Status: WORKING
- Behavior:
  1. Wraps fs.promises.readFile in try/catch
  2. On success: returns { success: true, data: <file contents> }
  3. On failure: returns { success: false, error: <FsError> }
  4. Retries transient errors (EMFILE, ENOSPC) up to 3 times
- Default encoding: 'utf-8' (line 173)
- Gap: None — clean implementation. The encoding parameter defaults correctly.
```

---

## Lines 185-223: `safeWriteFile(filePath, content, options)`

```
Lines 185-223: Safe file write with automatic directory creation and fallback path support
- What triggers it: External callers needing to write files safely
- What it calls:
  Line 192: options?.encoding (default 'utf-8')
  Line 193: options?.mode
  Line 198: path.dirname(target) to get parent directory
  Line 199: fs.promises.mkdir(dir, { recursive: true }) to ensure directory exists
  Line 200: fs.promises.writeFile(target, content, { encoding, mode })
  Line 195: withRetry() wrapping the write+mkdir operation
  Line 204: buildFsError(err, target) on failure
  Line 214: getFallbackPath(filePath) to find fallback
  Line 216: writeAttempt(fallback) to try fallback path
- What calls it:
  - WriteBufferPool.flushPath() at line 553 (internal call)
  - ioChan.js line 211 (documentation reference only)
- Dependencies: fs.promises.writeFile, fs.promises.mkdir, path.dirname, withRetry, buildFsError, getFallbackPath
- Status: WORKING
- Behavior:
  1. Attempts write to primary path (with mkdir -p and retry)
  2. If primary fails AND fallback is registered, tries fallback
  3. Returns primary result if both fail (or if no fallback registered)
- Gap: The fallback mechanism (lines 214-220) is dead code — registerFallback() is never called by any consumer, so getFallbackPath() always returns undefined.
```

---

## Lines 224-239: `safeReaddir(dirPath, options)`

```
Lines 224-239: Safe directory read — never throws, returns Result<Dirent[], FsError>
- What triggers it: External callers needing to list directory contents
- What it calls:
  Line 229: withRetry() wrapping the readdir operation
  Line 231: fs.promises.readdir(dirPath, { withFileTypes: true })
  Line 235: buildFsError(err, dirPath) on failure
- What calls it: NO CALLERS FOUND in the codebase
- Dependencies: fs.promises.readdir, withRetry, buildFsError
- Status: NOT CONNECTED (exported but never called)
- Bug: The `options` parameter (line 227) is ACCEPTED but NEVER USED. The function always passes `{ withFileTypes: true }` regardless of what options the caller provides. This means:
  1. If a caller passes `{ withFileTypes: false }`, it will be IGNORED
  2. If a caller passes `{ encoding: 'buffer' }`, it will be IGNORED
  3. The function signature is misleading — it suggests configurability that doesn't exist
- Gap:
  1. BUG: options parameter is dead/ignored — always uses { withFileTypes: true }
  2. NOT CONNECTED: No callers found in the codebase
```

---

## Lines 240-258: `safeMkdir(dirPath, options)`

```
Lines 240-258: Safe directory creation — never throws, returns Result<string|undefined, FsError>
- What triggers it: External callers needing to create directories
- What it calls:
  Line 246: options?.recursive (default true)
  Line 247: options?.mode (default 0o755)
  Line 248: withRetry() wrapping the mkdir operation
  Line 250: fs.promises.mkdir(dirPath, { recursive, mode })
  Line 254: buildFsError(err, dirPath) on failure
- What calls it: NO CALLERS FOUND in the codebase
- Dependencies: fs.promises.mkdir, withRetry, buildFsError
- Status: NOT CONNECTED (exported but never called)
- Gap: Exported but unused. Note that safeWriteFile already calls fs.promises.mkdir internally (line 199), so callers of safeWriteFile don't need to call safeMkdir separately for the write path.
```

---

## Lines 259-274: `safeStat(filePath)`

```
Lines 259-274: Safe stat — never throws, returns Result<Stats, FsError>
- What triggers it: External callers needing file metadata
- What it calls:
  Line 264: withRetry() wrapping the stat operation
  Line 266: fs.promises.stat(filePath)
  Line 270: buildFsError(err, filePath) on failure
- What calls it: NO CALLERS FOUND in the codebase
- Dependencies: fs.promises.stat, withRetry, buildFsError
- Status: NOT CONNECTED (exported but never called)
- Gap: Exported but unused.
```

---

## Lines 275-291: `safeAccess(filePath, mode)`

```
Lines 275-291: Safe access check — never throws, returns Result<void, FsError>
- What triggers it: External callers checking file accessibility
- What it calls:
  Line 280: mode (default fs.constants.F_OK)
  Line 281: withRetry() wrapping the access operation
  Line 283: fs.promises.access(filePath, accessMode)
  Line 287: buildFsError(err, filePath) on failure
- What calls it:
  - dataIngestion.js line 931: checks package.json accessibility
  - dataIngestion.js line 961: checks file accessibility during ingestion
  - groundPlane.js line 204: checks path write access
- Dependencies: fs.promises.access, fs.constants, withRetry, buildFsError
- Status: WORKING (connected to 3 call sites)
- Gap: None — clean implementation with proper default mode.
```

---

## Lines 292-307: `safeUnlink(filePath)`

```
Lines 292-307: Safe file deletion — never throws, returns Result<void, FsError>
- What triggers it: External callers needing to delete files
- What it calls:
  Line 297: withRetry() wrapping the unlink operation
  Line 299: fs.promises.unlink(filePath)
  Line 303: buildFsError(err, filePath) on failure
- What calls it: NO CALLERS FOUND in the codebase
- Dependencies: fs.promises.unlink, withRetry, buildFsError
- Status: NOT CONNECTED (exported but never called)
- Gap: Exported but unused.
```

---

## Lines 308-322: `safeLstat(filePath)`

```
Lines 308-322: Safe lstat (symlink-aware) — never throws, returns Result<Stats, FsError>
- What triggers it: External callers needing symlink-aware file metadata
- What it calls:
  Line 315: fs.promises.lstat(filePath)
  Line 319: buildFsError(err, filePath) on failure
- What calls it: NO CALLERS FOUND in the codebase
- Dependencies: fs.promises.lstat, buildFsError
- Status: NOT CONNECTED (exported but never called)
- CRITICAL DIFFERENCE FROM OTHER safe* FUNCTIONS: safeLstat does NOT use withRetry(). It directly calls fs.promises.lstat in a try/catch. This is inconsistent with all other safe* functions which wrap in withRetry().
  - Possible reason: lstat is used for symlink detection where retrying wouldn't help
  - But this breaks the "never throws" contract pattern — it DOES follow the same Result<T, FsError> return type, so it's safe, just inconsistent
- Gap:
  1. INCONSISTENCY: No retry logic (unlike all other safe* functions)
  2. NOT CONNECTED: No callers found
```

---

## Lines 323-438: `FileHandlePool` Class

```
Lines 323-438: Pool for bounding concurrent open file descriptors to prevent EMFILE errors
- What triggers it: Instantiated via `new FileHandlePool(options)`
- What calls it: NO INSTANTIATION FOUND in the codebase (no `new FileHandlePool` calls)
- Dependencies: Date.now(), setInterval, setTimeout, Map, Array
- Status: NOT CONNECTED (class defined but never instantiated)

### Constructor (lines 328-348):
  Line 337: options?.poolSize (default 20)
  Line 338: options?.acquireTimeoutMs (default 10000 = 10s)
  Line 339: options?.leakTimeoutMs (default 30000 = 30s)
  Line 341-343: Pre-allocates pool slots with generateId()
  Line 345-347: Starts leak detection timer (setInterval), calls .unref() to not block process exit

### acquire() (lines 354-376):
  Line 356-359: If pool has available slot, pop and return immediately
  Line 362-375: If pool exhausted, create Promise that waits in FIFO queue
  Line 363-370: Timeout handler removes from queue after acquireTimeoutMs
  Line 372-373: Timer .unref() to not block process exit
  Gap: The timeout reject message says "queue position exhausted" which is misleading — it's a timeout, not queue exhaustion.

### release(id) (lines 380-396):
  Line 381-383: Gets handle, returns silently if already released or invalid
  Line 384-385: Marks released, removes from inUse map
  Line 387-395: If queue has waiters, hands slot directly to next waiter; otherwise returns to available pool
  Gap: None — clean FIFO handoff.

### getMetrics() (lines 400-409):
  Returns poolSize, available, inUse, queueLength, queuedTimeoutCount, leakDetectionCount

### destroy() (lines 413-423):
  Line 414-417: Clears leak detection timer
  Line 419-421: Clears timeout timers for pending waiters
  Line 422: Empties queue (NOTE: does NOT reject pending waiters — they will hang!)
  Gap: BUG — destroy() clears the queue array but does NOT reject the pending Promises. Any callers waiting on acquire() will have their Promises permanently pending (memory leak + hanging behavior).

### generateId() (lines 425-427):
  Returns `fhp_${++idCounter}_${Date.now().toString(36)}` — unique handle identifier

### detectLeaks() (lines 428-437):
  Line 429-436: Iterates inUse handles, force-releases any held longer than leakTimeoutMs
  Line 433: Increments leakDetectionCount
  Line 434: Calls this.release(id) to force-release
  Gap: Potential issue — calling release() inside iteration of inUse.entries() modifies the Map during iteration. In V8 this is safe (Map iteration is live), but it's a code smell.
```

---

## Lines 439: FileHandlePool Export

```
Line 439: exports.FileHandlePool = FileHandlePool;
- Status: WORKING (export matches declaration at line 327)
- Gap: Exported but never imported/instantiated anywhere in the codebase.
```

---

## Lines 440-597: `WriteBufferPool` Class

```
Lines 440-597: Batches writes in memory buffer, flushes on threshold or timer
- What triggers it: Instantiated via `new WriteBufferPool(config)`
- What calls it: NO INSTANTIATION FOUND in the codebase (no `new WriteBufferPool` calls)
- Dependencies: safeWriteFile (line 553), fs.promises, path, Buffer, process
- Status: NOT CONNECTED (class defined but never instantiated)

### Constructor (lines 446-465):
  Line 455: config?.maxBufferBytes (default 1MB = 1024*1024)
  Line 456: config?.flushIntervalMs (default 5000 = 5s)
  Line 458-460: Starts auto-flush timer (setInterval), swallows flush errors with .catch(() => {})
  Line 461-462: Timer .unref()
  Line 464: registerShutdownHook()
  Gap: The .catch(() => {}) at line 459 silently swallows ALL flush errors from the timer. If the timer-triggered flush fails, the error is lost. Should at least log to stderr.

### write(filePath, data) (lines 470-485):
  Line 472: path.resolve(filePath) — normalizes path
  Line 473-475: Creates buffer array for new paths
  Line 476-477: Pushes { data, timestamp } entry
  Line 478: Accumulates byte count via Buffer.byteLength(data, 'utf-8')
  Line 480-481: If totalBufferedBytes >= maxBufferBytes, flushes immediately
  Line 483: Returns success if buffered (no immediate write)
  Gap: The timestamp field (line 476) is stored but NEVER READ anywhere. It's dead data — no TTL, no ordering by timestamp, no metrics on buffer age.

### flush() (lines 489-512):
  Line 491: Gets all buffered paths
  Line 493-497: Iterates paths, calls flushPath() for each
  Line 499-509: If any flushes failed, returns composite error with all failure messages
  Line 510: Returns success if all flushed
  Gap: None — clean iteration with error aggregation.

### getMetrics() (lines 516-523):
  Returns bufferedPaths, totalBufferedBytes, flushCount, failedFlushCount

### destroy() (lines 527-535):
  Line 529-532: Clears flush timer
  Line 533: Calls this.flush() to flush remaining buffers
  Gap: None — clean shutdown.

### flushPath(filePath) (lines 537-570):
  Line 540-543: If flush lock held for this path, skip (returns success — data will be caught by next timer)
  Line 544-547: Gets entries, returns success if empty
  Line 548: Acquires flush lock
  Line 551: Concatenates all buffered data in order
  Line 553: Calls safeWriteFile(filePath, content) — NOTE: uses the safe write!
  Line 555-558: On success: deletes buffer, decrements totalBufferedBytes (clamped to 0)
  Line 559: Increments flushCount
  Line 562: On failure: increments failedFlushCount
  Line 567: Releases flush lock in finally block
  Gap:
    1. BUG: Line 541 — if a flush is already in progress for a path, the function returns { success: true } but the data is NOT written. The comment says "will be caught by next timer" but this means data could be delayed indefinitely if the lock is held for a long time.
    2. The flush lock is a simple boolean (Set membership) — there's no queuing. If two flushes are triggered for the same path, the second one silently drops.

### registerShutdownHook() (lines 571-596):
  Line 572-574: Guard against double registration
  Line 575-592: Defines synchronous handler that:
    Line 577-579: Iterates all buffered entries
    Line 580: Concatenates data
    Line 582-584: Uses fs.mkdirSync + fs.writeFileSync (SYNCHRONOUS — required for shutdown)
    Line 586-588: Catches and ignores errors (best-effort)
    Line 590-591: Clears buffers and resets byte counter
  Line 593: process.once('beforeExit', handler)
  Line 594: process.once('SIGINT', handler)
  Line 595: process.once('SIGTERM', handler)
  Gap:
    1. Only uses process.once() — if the handler fires on 'beforeExit' and then SIGTERM arrives, the handler won't fire again. This is intentional (prevent double-flush) but could lose data if beforeExit fires before a signal handler.
    2. The handler overwrites files (writeFileSync) rather than appending — if the buffer contains partial updates, previous file content is lost.
```

---

## Line 598: WriteBufferPool Export

```
Line 598: exports.WriteBufferPool = WriteBufferPool;
- Status: WORKING (export matches declaration at line 445)
- Gap: Exported but never imported/instantiated anywhere in the codebase.
```

---

## Line 599: Source Map Reference

```
Line 599: //# sourceMappingURL=safeFs.js.map
- Status: BROKEN — the source map file safeFs.js.map does NOT exist on disk
- Gap: Source map is missing, making debugging harder (can't trace back to original TypeScript source)
```

---

# Summary: Connections & Dependency Map

## Files That Import safeFs.js

| File | Line | Functions Used |
|------|------|----------------|
| `lib/commands/integr8/dataIngestion.js` | 61 | `safeAccess` (lines 931, 961), `safeReadFile` (line 933) |
| `lib/utils/groundPlane.js` | 56 | `safeAccess` (line 204) |
| `lib/utils/ioChan.js` | 211 | Referenced in docs only (not imported) |

## Functions: Connection Status

| Function | Exported | Called Externally | Status |
|----------|----------|-------------------|--------|
| `isTransient` | ✅ Line 49 | ❌ No callers | **NOT CONNECTED** |
| `isPermission` | ✅ Line 50 | ❌ No callers | **NOT CONNECTED** |
| `isMissing` | ✅ Line 51 | ❌ No callers | **NOT CONNECTED** |
| `isCorrupt` | ✅ Line 52 | ❌ No callers | **NOT CONNECTED** |
| `registerFallback` | ✅ Line 53 | ❌ No callers | **NOT CONNECTED** |
| `safeReadFile` | ✅ Line 54 | ✅ dataIngestion.js:933 | **WORKING** |
| `safeWriteFile` | ✅ Line 55 | ✅ WriteBufferPool:553 (internal) | **WORKING** |
| `safeReaddir` | ✅ Line 56 | ❌ No callers | **NOT CONNECTED** |
| `safeMkdir` | ✅ Line 57 | ❌ No callers | **NOT CONNECTED** |
| `safeStat` | ✅ Line 58 | ❌ No callers | **NOT CONNECTED** |
| `safeAccess` | ✅ Line 59 | ✅ dataIngestion.js:931,961, groundPlane.js:204 | **WORKING** |
| `safeUnlink` | ✅ Line 60 | ❌ No callers | **NOT CONNECTED** |
| `safeLstat` | ✅ Line 61 | ❌ No callers | **NOT CONNECTED** |
| `FileHandlePool` | ✅ Line 439 | ❌ Never instantiated | **NOT CONNECTED** |
| `WriteBufferPool` | ✅ Line 598 | ❌ Never instantiated | **NOT CONNECTED** |

## @@@ Symbols

No `@@@` symbols found in the file.

---

# Bugs & Issues Found

### BUG-1: `safeReaddir` ignores `options` parameter (Line 227)
The function accepts an `options` parameter but never passes it to `fs.promises.readdir()`. It always hardcodes `{ withFileTypes: true }`.

### BUG-2: `FileHandlePool.destroy()` leaves pending Promises hanging (Line 422)
`destroy()` clears the queue array but does NOT reject the pending Promises from `acquire()`. Callers will have permanently pending Promises (memory leak).

### BUG-3: `safeLstat` inconsistent — no retry logic (Lines 312-322)
Unlike all other `safe*` functions, `safeLstat` does NOT wrap in `withRetry()`. While this may be intentional (lstat for symlinks), it breaks the consistency contract.

### BUG-4: `WriteBufferPool.write()` stores `timestamp` but never reads it (Line 476)
The `{ data, timestamp }` entry structure stores a timestamp that is never used for anything — no TTL, no ordering, no age metrics.

### BUG-5: `WriteBufferPool.flushPath()` silently drops writes on lock contention (Line 541)
If a flush is already in progress for a path, the second flush returns `{ success: true }` without writing. Data is deferred to next timer, but this can cause indefinite delays.

### BUG-6: Source map file missing (Line 599)
`//# sourceMappingURL=safeFs.js.map` references a file that doesn't exist on disk.

---

# Dead Code Summary

1. **`isTransient`, `isPermission`, `isMissing`, `isCorrupt`** (lines 113-127) — exported but never called
2. **`registerFallback`** (line 158) — exported but never called → makes fallback logic in `safeWriteFile` dead code
3. **`safeReaddir`** (line 227) — exported but never called
4. **`safeMkdir`** (line 243) — exported but never called
5. **`safeStat`** (line 262) — exported but never called
6. **`safeUnlink`** (line 295) — exported but never called
7. **`safeLstat`** (line 312) — exported but never called
8. **`FileHandlePool`** (line 327) — class exported but never instantiated
9. **`WriteBufferPool`** (line 445) — class exported but never instantiated
10. **`WriteBufferPool.write()` timestamp field** (line 476) — stored but never read

---

_Generated: 2026-05-13_
_Source File: lib/utils/safeFs.js (599 lines)_
_Review Depth: Deep — cross-file trace analysis_
