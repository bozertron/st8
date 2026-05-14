# Detailed Line-by-Line Report: `lib/utils/groundPlane.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/utils/groundPlane.js`
**Total Lines:** 268
**Language:** Compiled JavaScript (from TypeScript source `src/utils/groundPlane.ts`)
**Source Map:** Missing (`groundPlane.js.map` not found)

---

## WHAT IS "GROUND PLANE"?

The ground plane is a **filesystem directory pre-verification system**. It ensures a stable base state for all filesystem operations by verifying or creating critical directories on startup. The name comes from electronics: a clean, isolated ground plane ensures stable electrical reference. Here, it ensures stable filesystem reference.

It manages four categories of directories: `data`, `cache`, `plugins`, and `temp`, each with a primary and fallback path.

---

## @@ HANDLING

**No `@@@` symbols found in this file.** Zero occurrences.

---

## CONNECTIONS MAP

| Direction | File | Relationship |
|-----------|------|-------------|
| **Inbound (callers)** | NONE FOUND | Zero consumers in entire codebase |
| **Outbound (dependencies)** | `fs` (Node built-in) | Filesystem operations |
| **Outbound** | `path` (Node built-in) | Path construction |
| **Outbound** | `os` (Node built-in) | Home dir, tmpdir, PID |
| **Outbound** | `./safeFs.js` | `safeAccess()` for validation |

### ⚠️ CRITICAL: This File Has ZERO Consumers

Exhaustive grep across the entire codebase found **no file** that `require()`s or imports `groundPlane.js`. All four exported functions (`initGroundPlane`, `getVerifiedPath`, `validateGroundPlane`, `getGroundPlanePaths`) appear to be **dead code**. The module is completely disconnected from the application.

---

## SECTION-BY-SECTION ANALYSIS

### Lines 1: `"use strict";`
- **What this section does:** Enables strict mode for the entire module.
- **What triggers it:** Module load.
- **What it calls:** N/A (runtime directive).
- **What calls it:** N/A.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None.

---

### Lines 2-5: Comment header
```
// src/utils/groundPlane.ts
// Pre-verifies critical directory structure on startup.
// Hardware analogy: a clean, isolated ground plane that ensures
// a stable base state for all filesystem operations.
```
- **What this section does:** Documents the file's origin (TypeScript source) and purpose.
- **What triggers it:** N/A (comments).
- **What it calls:** N/A.
- **What calls it:** N/A.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None. However, the TypeScript source file (`src/utils/groundPlane.ts`) does NOT exist in the repo — only this compiled JS output exists.

---

### Lines 6-47: TypeScript helper functions (`__createBinding`, `__setModuleDefault`, `__importStar`, `__awaiter`)
- **What this section does:** Auto-generated TypeScript compiler helpers for:
  - `__createBinding` (lines 6-16): Creates property bindings on objects, used for module namespace imports.
  - `__setModuleDefault` (lines 17-21): Sets the `default` export on a module namespace.
  - `__importStar` (lines 22-38): Star-import helper — wraps a CommonJS module into an ES module-like namespace object.
  - `__awaiter` (lines 39-47): Async/await polyfill — converts generator-based async to Promise-based.
- **What triggers it:** Called internally when `require()` is used with `__importStar`.
- **What it calls:** `Object.create`, `Object.getOwnPropertyDescriptor`, `Object.defineProperty`, `Object.getOwnPropertyNames`, `Promise`.
- **What calls it:** Lines 53-55 (`const fs = __importStar(require("fs"))`, etc.).
- **Dependencies:** None (self-contained helpers).
- **Status:** WORKING
- **Gap:** None — standard TypeScript boilerplate. The `__awaiter` is only needed if targeting pre-ES2017; for modern Node.js this is dead weight but harmless.

---

### Lines 48-52: Export declarations
```
Object.defineProperty(exports, "__esModule", { value: true });
exports.initGroundPlane = initGroundPlane;
exports.getVerifiedPath = getVerifiedPath;
exports.validateGroundPlane = validateGroundPlane;
exports.getGroundPlanePaths = getGroundPlanePaths;
```
- **What this section does:** Declares the module as ES-module-compatible and exports four public functions.
- **What triggers it:** Module load.
- **What it calls:** `Object.defineProperty`.
- **What calls it:** N/A (declarative).
- **Dependencies:** None.
- **Status:** ⚠️ NOT CONNECTED — These exports are never imported by any file in the codebase.
- **Gap:** **BLOCKER: All four exports are dead code.** No file in the project calls any of these functions. This entire module is disconnected from the application.

---

### Lines 53-55: Node built-in imports
```
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
```
- **What this section does:** Imports Node.js built-in modules as namespace objects.
- **What triggers it:** Module load.
- **What it calls:** `require()`, `__importStar`.
- **What calls it:** Lines 60-64 (`os.homedir()`, `path.join()`, etc.), lines 112-174 (`fs.promises.*`).
- **Dependencies:** `fs`, `path`, `os` (Node built-ins).
- **Status:** WORKING
- **Gap:** None.

---

### Line 56: safeFs import
```
const safeFs_js_1 = require("./safeFs.js");
```
- **What this section does:** Imports the safe filesystem wrapper module.
- **What triggers it:** Module load.
- **What it calls:** `require("./safeFs.js")`.
- **What calls it:** Line 204 — `safeFs_js_1.safeAccess(activePath, fs.constants.W_OK)`.
- **Dependencies:** `lib/utils/safeFs.js` (exports `safeAccess`, `safeWriteFile`, `safeReadFile`, `safeReaddir`, `safeMkdir`, `safeStat`, `safeUnlink`, `safeLstat`, `WriteBufferPool`, `FileHandlePool`).
- **Status:** WORKING
- **Gap:** **WARNING: Inconsistent error handling strategy.** `validateGroundPlane` (line 204) uses `safeAccess` from `safeFs.js` (never-throw pattern), but `initGroundPlane` (lines 112-115) uses raw `fs.promises.stat` and `fs.promises.writeFile` which CAN throw. The module mixes two different error handling philosophies. Should use `safeFs` consistently throughout.

---

### Lines 57-58: Constants
```
const APP_ID = 'com.scaffolder.app';
```
- **What this section does:** Defines the application identifier used for directory naming.
- **What triggers it:** Module load.
- **What it calls:** N/A.
- **What calls it:** Lines 62-63 (`path.join(dataHome, APP_ID)`, `path.join(cacheHome, APP_ID)`).
- **Dependencies:** None.
- **Status:** ⚠️ PARTIAL
- **Gap:** **WARNING: APP_ID naming mismatch with temp paths.** `APP_ID` is `com.scaffolder.app` (line 58), which creates directories like `~/.local/share/com.scaffolder.app/`. But temp paths use `maestro-` prefix (lines 64, 80, 171) — creating directories like `/tmp/maestro-12345/`. This naming inconsistency suggests the module was ported from a different project ("maestro-scaffolder-tool" as referenced in comments in `backend/*.js`) without fully updating the constants. The `APP_ID` should likely be `maestro` or the temp prefix should be `scaffolder`.

---

### Lines 59-83: `getDefaultPaths()` — Internal path configuration
```
function getDefaultPaths() {
    const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    const cacheHome = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
    ...
}
```
- **What this section does:** Computes primary and fallback directory paths for four categories:
  - `data` (line 66-69): `~/.local/share/com.scaffolder.app/` primary, `/tmp/maestro-{pid}/data` fallback
  - `cache` (line 70-73): `~/.cache/com.scaffolder.app/` primary, `/tmp/maestro-{pid}/cache` fallback
  - `plugins` (line 74-77): `~/.local/share/com.scaffolder.app/plugins/` primary, `/tmp/maestro-{pid}/plugins` fallback
  - `temp` (line 78-81): `/tmp/maestro-{pid}/work` primary, `/tmp/maestro-fallback-{pid}` fallback
- **What triggers it:** Called by `initGroundPlane()` at line 102.
- **What it calls:** `process.env`, `os.homedir()`, `os.tmpdir()`, `path.join()`, `process.pid`.
- **What calls it:** `initGroundPlane()` (line 102).
- **Dependencies:** `path`, `os` (Node built-ins).
- **Status:** ⚠️ PARTIAL
- **Gaps:**
  1. **WARNING: PID-based temp directories create process-specific isolation.** Paths like `/tmp/maestro-12345/` are scoped to the current process ID. If the application spawns child processes or runs as a cluster, each process gets separate temp directories. This may be intentional but is not documented.
  2. **WARNING: Linux/macOS only.** The XDG fallback (`~/.local/share`, `~/.cache`) is Linux-specific. On Windows, `os.homedir()` returns something like `C:\Users\name` but `~/.local/share` doesn't exist. The `os.tmpdir()` works cross-platform but the data/cache paths would create unexpected directories on Windows.
  3. **INFO: No XDG_CONFIG_HOME or XDG_STATE_HOME.** Only DATA and CACHE are covered. If the application needs config or state directories, they're not provided.

---

### Lines 84-86: Module-level state
```
let directories = new Map();
let initialized = false;
```
- **What this section does:** Declares module-level mutable state:
  - `directories`: Map from purpose string (`"data"`, `"cache"`, `"plugins"`, `"temp"`) to entry objects.
  - `initialized`: Boolean flag indicating whether `initGroundPlane()` has completed.
- **What triggers it:** Module load.
- **What it calls:** `Map` constructor.
- **What calls it:** `initGroundPlane()` writes to both (lines 153-155). `getVerifiedPath()`, `validateGroundPlane()`, `getGroundPlanePaths()` read from both.
- **Dependencies:** None.
- **Status:** ⚠️ PARTIAL
- **Gap:** **WARNING: Singleton state with no reset mechanism.** The `directories` Map and `initialized` flag are module-level singletons. There's no way to reset them (e.g., for testing, re-initialization after config change, or cleanup). The comment on line 90 says "Safe to call multiple times (idempotent)" but `initGroundPlane()` does NOT check `initialized` — it re-runs the full verification every time and overwrites Map entries. This is not truly idempotent if the filesystem state has changed between calls.

---

### Lines 87-158: `initGroundPlane()` — Core initialization
```
function initGroundPlane() {
    return __awaiter(this, void 0, void 0, function* () { ... });
}
```
- **What this section does:** Initializes the ground plane by verifying or creating all four directory categories. For each:
  1. Try to create/verify the primary path (line 112)
  2. If primary exists, test write access (line 115)
  3. If primary is not writable, try fallback (lines 123-134)
  4. If primary doesn't exist, try fallback (lines 140-152)
  5. Store result in `directories` Map (line 153)
- **What triggers it:** Externally via `exports.initGroundPlane`, or lazily via `getVerifiedPath()` (line 166).
- **What it calls:**
  - `getDefaultPaths()` (line 102) — gets path configuration
  - `verifyOrCreateDir()` (lines 112, 123, 140) — creates directories
  - `testWriteAccess()` (line 115) — tests write permission
  - `Object.entries()` (line 103) — iterates path configs
- **What calls it:** Nothing in the codebase (dead code). Internally, `getVerifiedPath()` calls it lazily (line 166).
- **Dependencies:** `getDefaultPaths()`, `verifyOrCreateDir()`, `testWriteAccess()`, `fs`, `path`, `os`.
- **Status:** ⚠️ NOT CONNECTED / PARTIAL
- **Gaps:**
  1. **BLOCKER: Not idempotent despite documentation claim.** Line 90 says "Safe to call multiple times (idempotent)." This is FALSE. The function does not check `initialized` before running. Each call re-verifies all directories and overwrites the Map. If directories were removed between calls, the function silently re-creates them. The `initialized` flag is set at line 155 but never checked at entry.
  2. **WARNING: Status object `created` array is misleading.** When a primary path fails and fallback succeeds, the fallback path is pushed to `status.created` (lines 128, 145). But `verifyOrCreateDir()` may have found the fallback already existing — it wasn't necessarily "created." Should distinguish between "verified existing" and "newly created."
  3. **WARNING: `testWriteAccess` (line 115) uses raw `fs.promises` while `validateGroundPlane` (line 204) uses `safeFs.safeAccess`.** Inconsistent error handling — `testWriteAccess` catches errors silently (lines 263-265) but doesn't classify them, while `safeAccess` returns typed error results.

---

### Lines 159-182: `getVerifiedPath(purpose)` — Path retrieval
```
function getVerifiedPath(purpose) {
    return __awaiter(this, void 0, void 0, function* () { ... });
}
```
- **What this section does:** Returns a verified, writable directory path for a given purpose. Features:
  - Lazy initialization: if `initialized` is false, calls `initGroundPlane()` first (lines 165-167)
  - Looks up purpose in `directories` Map (line 168)
  - Emergency fallback: if purpose is unknown or unverified, creates an emergency temp directory (lines 170-178)
- **What triggers it:** Externally via `exports.getVerifiedPath`.
- **What it calls:**
  - `initGroundPlane()` (line 166) — lazy init
  - `directories.get()` (line 168) — Map lookup
  - `fs.promises.mkdir()` (line 173) — emergency directory creation
  - `os.tmpdir()`, `path.join()` (line 171) — emergency path construction
- **What calls it:** Nothing in the codebase (dead code).
- **Dependencies:** `fs`, `path`, `os`, `initGroundPlane()`, `directories` Map.
- **Status:** ⚠️ NOT CONNECTED / PARTIAL
- **Gaps:**
  1. **WARNING: Race condition on lazy initialization.** Lines 165-167: If multiple async callers invoke `getVerifiedPath()` concurrently while `initialized` is false, each will call `initGroundPlane()` simultaneously. Since `initGroundPlane()` doesn't check `initialized` at entry, multiple full initializations will run in parallel, potentially causing duplicate directory creation attempts and Map corruption. Should use a mutex/lock pattern.
  2. **WARNING: Emergency path is created but never registered.** Lines 171-178: When the emergency fallback is used, the path is created via `fs.promises.mkdir()` but never stored in the `directories` Map. Subsequent calls for the same purpose will re-trigger the emergency path creation. The emergency path also leaks — it's never cleaned up.
  3. **WARNING: Silent degradation.** Line 175-177: If even the emergency `mkdir` fails, the catch block is empty and the path is returned anyway. The comment says "caller will handle the error" but there's no contract enforcing this. Callers could use the returned path without knowing it doesn't exist.
  4. **INFO: No input validation on `purpose` parameter.** No check that `purpose` is one of the expected strings (`"data"`, `"cache"`, `"plugins"`, `"temp"`). Any string will be accepted, and if not found in the Map, triggers the emergency path.

---

### Lines 183-218: `validateGroundPlane()` — Health check
```
function validateGroundPlane() {
    return __awaiter(this, void 0, void 0, function* () { ... });
}
```
- **What this section does:** Runs a health check on the ground plane without modifying state. For each registered directory:
  1. Gets the active path (primary or fallback) (line 203)
  2. Checks accessibility using `safeFs.safeAccess()` with `W_OK` (write permission) (line 204)
  3. Reports verified or inaccessible paths (lines 205-211)
  4. Tracks if any fallback is active (lines 212-214)
- **What triggers it:** Externally via `exports.validateGroundPlane`.
- **What it calls:**
  - `safeFs_js_1.safeAccess()` (line 204) — from `lib/utils/safeFs.js`
  - `directories.entries()` (line 202) — Map iteration
  - `fs.constants.W_OK` (line 204) — write permission constant
- **What calls it:** Nothing in the codebase (dead code).
- **Dependencies:** `./safeFs.js` (`safeAccess`), `fs`, `directories` Map.
- **Status:** ⚠️ NOT CONNECTED
- **Gaps:**
  1. **WARNING: No snapshot/compare capability.** The function returns a status object but doesn't compare against the initialization state. It can't detect if a directory was removed and re-created (different inode) or if permissions changed since init.
  2. **INFO: Status object reuses same shape as `initGroundPlane` but semantics differ.** `initGroundPlane` pushes to `status.created` when it creates directories, but `validateGroundPlane` never creates — yet the same status type with `created: []` is always returned empty. This could confuse consumers.

---

### Lines 219-235: `getGroundPlanePaths()` — Sync path access
```
function getGroundPlanePaths() {
    if (!initialized) return null;
    ...
}
```
- **What this section does:** Synchronous accessor that returns all verified paths as a plain object. Returns `null` if not initialized.
- **What triggers it:** Externally via `exports.getGroundPlanePaths`.
- **What it calls:**
  - `directories.entries()` (line 231) — Map iteration
- **What calls it:** Nothing in the codebase (dead code).
- **Dependencies:** `directories` Map, `initialized` flag.
- **Status:** ⚠️ NOT CONNECTED / PARTIAL
- **Gaps:**
  1. **WARNING: Return type is fragile.** Lines 225-230 initialize `result` with empty strings for `cache`, `data`, `plugins`, `temp`. But the type isn't enforced — if `getDefaultPaths()` ever adds a new purpose (e.g., `"logs"`), it will be included in the Map but the `result` object won't have a typed slot for it, so `result[purpose]` would add an untyped property.
  2. **WARNING: Returns `null` instead of throwing/returning empty.** Line 224: Returns `null` if not initialized. This forces all callers to null-check. Returning an empty object or throwing would be more predictable.
  3. **INFO: The `as` type cast in TypeScript source is lost in compilation.** The compiled JS doesn't enforce that `result[purpose]` only accepts known keys.

---

### Lines 236-267: Internal helpers

#### Lines 237-253: `verifyOrCreateDir(dirPath)`
```
function verifyOrCreateDir(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stat = yield fs.promises.stat(dirPath);
            return stat.isDirectory();
        }
        catch (_a) {
            try {
                yield fs.promises.mkdir(dirPath, { recursive: true, mode: 0o755 });
                return true;
            }
            catch (_b) {
                return false;
            }
        }
    });
}
```
- **What this section does:** Checks if a directory exists and is a directory. If not, tries to create it recursively with mode `0o755`.
- **What triggers it:** Called by `initGroundPlane()` at lines 112, 123, 140.
- **What it calls:** `fs.promises.stat()`, `fs.promises.mkdir()`.
- **What calls it:** `initGroundPlane()`.
- **Dependencies:** `fs`.
- **Status:** WORKING (logic is correct)
- **Gaps:**
  1. **WARNING: Uses raw `fs.promises` instead of `safeFs`.** This function uses raw `fs.promises.stat()` and `fs.promises.mkdir()` which can throw. The rest of the module (in `validateGroundPlane`) uses `safeFs.safeAccess()`. Should use `safeFs.safeStat()` and `safeFs.safeMkdir()` for consistency.
  2. **INFO: `stat.isDirectory()` returns false for symlinks to directories.** Line 241: If `dirPath` is a symlink to a directory, `stat()` follows the symlink and `isDirectory()` returns true. But if the symlink target is later removed, this could give a false positive. `lstat()` + checking symlink target would be more robust, though this is an edge case.

#### Lines 255-266: `testWriteAccess(dirPath)`
```
function testWriteAccess(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const testFile = path.join(dirPath, `.groundplane-write-test-${Date.now()}`);
        try {
            yield fs.promises.writeFile(testFile, 'ok', 'utf-8');
            yield fs.promises.unlink(testFile);
            return true;
        }
        catch (_a) {
            return false;
        }
    });
}
```
- **What this section does:** Tests write access by creating and immediately deleting a temporary file.
- **What triggers it:** Called by `initGroundPlane()` at line 115.
- **What it calls:** `path.join()`, `fs.promises.writeFile()`, `fs.promises.unlink()`.
- **What calls it:** `initGroundPlane()`.
- **Dependencies:** `fs`, `path`.
- **Status:** ⚠️ PARTIAL
- **Gaps:**
  1. **WARNING: Race condition / cleanup leak.** Lines 259-260: If `writeFile` succeeds but `unlink` fails (e.g., permissions changed between the two calls, or process is killed), the test file `.groundplane-write-test-{timestamp}` is left behind. This is a minor leak but could accumulate over many failed initialization attempts.
  2. **WARNING: Uses raw `fs.promises` instead of `safeFs`.** Same inconsistency as `verifyOrCreateDir`. Should use `safeFs.safeWriteFile()` and `safeFs.safeUnlink()`.
  3. **INFO: Could use `fs.promises.access(dirPath, fs.constants.W_OK)` instead.** Creating and deleting a file is a more thorough test (tests actual write, not just permission bits), but `access(W_OK)` is simpler and doesn't leave artifacts. The current approach is defensible but heavier.

---

### Line 268: Source map reference
```
//# sourceMappingURL=groundPlane.js.map
```
- **What this section does:** Points to a source map for debugging.
- **What triggers it:** N/A.
- **What it calls:** N/A.
- **What calls it:** N/A.
- **Dependencies:** `groundPlane.js.map` — **file does not exist**.
- **Status:** BROKEN
- **Gap:** **INFO: Source map file missing.** The `.map` file referenced at this line does not exist in the filesystem. Debugging with source maps will fail silently.

---

## SUMMARY OF FINDINGS

### BLOCKERS (Must Fix)

| ID | Line(s) | Issue |
|----|---------|-------|
| B-1 | 49-52 | **All four exported functions are dead code.** Zero consumers in the entire codebase. No file imports `groundPlane.js`. |
| B-2 | 90, 92 | **`initGroundPlane()` is not idempotent despite documentation claim.** Does not check `initialized` flag before running. Repeated calls re-verify all directories and overwrite Map entries. |

### WARNINGS (Should Fix)

| ID | Line(s) | Issue |
|----|---------|-------|
| W-1 | 56, 112-115, 204 | **Inconsistent error handling: mixes raw `fs.promises` with `safeFs`.** `initGroundPlane` uses raw fs, `validateGroundPlane` uses `safeFs.safeAccess`. |
| W-2 | 58, 64, 80, 171 | **APP_ID (`com.scaffolder.app`) vs temp prefix (`maestro-`) naming mismatch.** Suggests incomplete port from a different project. |
| W-3 | 165-167 | **Race condition on lazy initialization.** Multiple concurrent `getVerifiedPath()` calls can trigger parallel `initGroundPlane()` runs. |
| W-4 | 171-178 | **Emergency path created but never registered in Map.** Subsequent calls re-create it. Also never cleaned up. |
| W-5 | 175-177 | **Emergency path returned even when mkdir fails.** Silent degradation with no contract for callers to handle. |
| W-6 | 85-86 | **No reset mechanism for module-level singleton state.** Cannot reinitialize or test in isolation. |
| W-7 | 118, 128, 145 | **`status.created` is misleading.** Fallback paths are pushed to `created` even if they already existed. |
| W-8 | 60-61 | **XDG paths are Linux-only.** Windows creates unexpected directory structures like `C:\Users\name\.local\share`. |
| W-9 | 259-260 | **`testWriteAccess` cleanup leak.** If `unlink` fails after `writeFile` succeeds, test files accumulate. |
| W-10 | 224 | **`getGroundPlanePaths()` returns `null` instead of empty object.** Forces null-check on all callers. |

### INFO (Nice to Fix)

| ID | Line(s) | Issue |
|----|---------|-------|
| I-1 | 268 | **Source map file missing.** `groundPlane.js.map` does not exist. |
| I-2 | 2 | **TypeScript source missing.** Only compiled JS exists; `src/utils/groundPlane.ts` not in repo. |
| I-3 | 163 | **No input validation on `purpose` parameter.** Any string accepted; unknown strings trigger emergency path. |
| I-4 | 225-230 | **Return type of `getGroundPlanePaths` is not extensible.** Hardcoded keys; new purpose types would be silently dropped. |
| I-5 | 39-47 | **`__awaiter` polyfill is dead weight on modern Node.js.** Only needed for pre-ES2017 targets. |

---

*Report generated: 2026-05-13*
*Reviewer: GSD-Code-Reviewer*
*File: `/home/bozertron/1_AT_A_TIME/st8/lib/utils/groundPlane.js` (268 lines)*
