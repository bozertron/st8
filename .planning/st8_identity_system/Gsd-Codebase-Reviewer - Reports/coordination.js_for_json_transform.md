# coordination.js — Line-by-Line Analysis Report

**File:** `/home/bozertron/1_AT_A_TIME/st8/coordination.js`
**Total Lines:** 210
**Purpose:** Multi-LLM manifest synchronization layer — polls `connection-state.json`, compares manifests, notifies listeners, generates AI context strings.
**Public API:** `window.St8Coordination`

---

## 1. FILE HEADER / COMMENTS

### Lines 1-10: Module Header Comment
- **What this section does:** Declares the module's purpose — multi-LLM manifest synchronization using `connection-state.json` and `ai-signal.toml`.
- **What triggers it:** N/A (static comment)
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** Mentions `connection-state.json` and `ai-signal.toml`
- **Status:** PARTIAL
- **Gap:** The comment at **line 5** says "Uses connection-state.json **and ai-signal.toml** as the coordination layer." However, **the code never reads `ai-signal.toml`**. Only `connection-state.json` is fetched. The TOML file exists on disk (`/home/bozertron/1_AT_A_TIME/st8/ai-signal.toml`) and is served by the backend server (`backend/server.js:85`), but `coordination.js` has zero TOML parsing or loading logic. The comment is misleading — it documents intent that was never implemented.

---

## 2. STRICT MODE

### Line 12: `'use strict';`
- **What this section does:** Enables strict mode for the entire file.
- **What triggers it:** Module load
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Correctly applied at file scope.

---

## 3. COORDINATION STATE OBJECT

### Lines 16-23: `coordinationState` Declaration
```js
const coordinationState = {
    manifestPath: null,
    lastManifest: null,
    lastUpdate: null,
    listeners: [],
    pollInterval: null,
    pollMs: 2000
};
```
- **What this section does:** Declares module-level mutable state: stores the current manifest, last update timestamp, registered listener callbacks, the polling interval handle, and the poll interval (2 seconds).
- **What triggers it:** Module load (singleton)
- **What it calls:** N/A
- **What calls it:** All other functions in this module read/write this object
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - `pollMs: 2000` is a hardcoded magic number. No way for consumers to configure the polling interval without monkey-patching the object.
  - `listeners: []` grows unboundedly if callers register listeners and forget to unsubscribe (the returned unsubscribe function from `addListener()` is the only cleanup mechanism).

---

## 4. MANIFEST LOADING — `loadManifest()`

### Lines 27-44: `async function loadManifest(manifestPath)`
- **What this section does:** Fetches a JSON manifest from the given URL path using `fetch()`, parses it, stores it in `coordinationState`, updates the timestamp, and calls `notifyListeners()`.
- **What triggers it:**
  1. Called directly by `startPolling()` at **line 62** (initial load)
  2. Called by `setInterval` callback at **line 66** (every 2 seconds)
  3. Can be called manually via `window.St8Coordination.loadManifest()` (exposed at **line 202**)
- **What it calls:**
  - `fetch(manifestPath)` — line 29 (browser fetch API)
  - `response.json()` — line 31
  - `notifyListeners(manifest)` — line 36
- **What calls it:**
  - `startPolling()` at line 62
  - `setInterval` callback at line 65-67
  - External callers via `window.St8Coordination.loadManifest`
- **Dependencies:** Browser `fetch()` API, network availability, backend server serving `/api/connection-state.json`
- **Status:** PARTIAL — WORKING but with critical design gaps
- **Gap:**
  1. **CRITICAL — No change detection (lines 32-36):** Every call to `loadManifest()` unconditionally overwrites `coordinationState.lastManifest` and unconditionally calls `notifyListeners()`. There is **no comparison** between the old manifest and the new manifest. If the manifest hasn't changed (which is the common case during polling), listeners are still fired with identical data every 2 seconds. The `compareManifests()` function exists at line 94 but is **never called** by `loadManifest()`. This means:
     - Listeners get hammered every 2 seconds with duplicate data
     - No consumer can distinguish "manifest changed" from "manifest polled"
     - The `compareManifests()` function is dead code in practice
  2. **No response status differentiation (line 30):** Only `response.ok` (200-299) is checked. A 304 Not Modified response would be treated as a non-ok response and silently ignored (returns `null`). Since the backend likely sends full JSON every time, this wastes bandwidth — ETag/If-None-Match optimization is not possible.
  3. **Swallowed errors (lines 40-42):** Network errors, JSON parse errors, and all other exceptions are caught and logged as warnings. The caller receives `null` with no way to distinguish "manifest doesn't exist" from "network error" from "server returned 500".
  4. **No timeout:** `fetch()` has no `AbortController` timeout. A hung server would cause the promise to hang indefinitely while the next poll cycle fires, potentially stacking up hanging requests.

---

## 5. LISTENER NOTIFICATION — `notifyListeners()`

### Lines 46-54: `function notifyListeners(manifest)`
- **What this section does:** Iterates all registered listener callbacks and invokes each with the manifest. Catches and logs per-listener errors to prevent one failing listener from blocking others.
- **What triggers it:** Called by `loadManifest()` at **line 36**
- **What it calls:** Each callback in `coordinationState.listeners` array (line 49)
- **What calls it:** `loadManifest()` at line 36
- **Dependencies:** `coordinationState.listeners` array
- **Status:** BROKEN (effectively dead — no listeners are ever registered)
- **Gap:**
  1. **CRITICAL — No consumers exist.** Grep across the entire codebase confirms that `St8Coordination.addListener()` is **never called** from any `.js` or `.html` file. The `listeners` array is always empty. Therefore `notifyListeners()` at line 47 iterates zero elements every time. The entire listener notification system is dead infrastructure.
  2. **No listener ordering or priority:** All listeners fire in registration order with no way to control priority.
  3. **Synchronous execution:** Listeners are called synchronously in a `forEach` loop. A slow listener blocks all subsequent listeners and blocks the return from `loadManifest()`.

---

## 6. POLLING — `startPolling()` / `stopPolling()`

### Lines 58-70: `function startPolling(manifestPath)`
- **What this section does:** Stores the manifest path, triggers an initial `loadManifest()` call, then starts a `setInterval` that calls `loadManifest()` every `pollMs` (2000ms).
- **What triggers it:**
  - `st8.html:1905` — called when the user switches to the `logic-analyzer` workspace type:
    ```js
    if (window.St8Coordination) {
        window.St8Coordination.startPolling('/api/connection-state.json');
    }
    ```
- **What it calls:**
  - `loadManifest(manifestPath)` — line 62 (initial), line 66 (recurring)
- **What calls it:** `st8.html` workspace activation handler (line 1904-1906)
- **Dependencies:** `loadManifest()`, `coordinationState`
- **Status:** PARTIAL
- **Gap:**
  1. **CRITICAL — Polling runs but data is discarded.** `startPolling()` starts a 2-second fetch loop. `loadManifest()` stores the result in `coordinationState.lastManifest` and calls `notifyListeners()`. But since zero listeners are registered, and nothing in the codebase calls `getLastManifest()` or `getLastUpdate()`, the polled data is **fetched and thrown away** every 2 seconds.
  2. **No duplicate-start guard:** Calling `startPolling()` twice without calling `stopPolling()` first would create two concurrent `setInterval` loops, doubling the fetch rate. The old interval handle at `coordinationState.pollInterval` would be overwritten, making the first interval impossible to clear.
  3. **No error backoff:** If the server is down, the poll continues every 2 seconds indefinitely with no exponential backoff.
  4. **Console spam (line 69):** `console.info` fires on every `startPolling()` call. If called multiple times (see point 2), this produces duplicate log entries.

### Lines 72-78: `function stopPolling()`
- **What this section does:** Clears the `setInterval` and nulls the handle.
- **What triggers it:**
  - `st8.html:1917` — when switching to `pretext-dev` workspace
  - `st8.html:1935` — when switching to standard workspace
- **What it calls:** `clearInterval()` — line 74
- **What calls it:** `st8.html` workspace deactivation handlers
- **Dependencies:** `coordinationState.pollInterval`
- **Status:** WORKING
- **Gap:**
  1. **No pending-request cleanup:** `stopPolling()` stops future polls but does not abort any in-flight `fetch()` requests from the last poll cycle.

---

## 7. LISTENER MANAGEMENT — `addListener()`

### Lines 82-90: `function addListener(callback)`
- **What this section does:** Pushes a callback function onto the `coordinationState.listeners` array. Returns an unsubscribe function that removes the callback by index.
- **What triggers it:** Would be called by external consumers wanting to receive manifest updates
- **What it calls:** `Array.push()` (line 83), `Array.indexOf()` (line 85), `Array.splice()` (line 87)
- **What calls it:** **NOTHING.** Grep confirms zero call sites across the entire codebase. This function is exported at line 205 but never invoked.
- **Dependencies:** `coordinationState.listeners`
- **Status:** BROKEN (dead code — never called)
- **Gap:**
  1. **CRITICAL — Exported but never consumed.** This is the primary wiring point between polling data and the rest of the application. Without a consumer calling `addListener()`, the entire polling → notification → response pipeline is disconnected. The `gap_analysis_action.md` (line 458) explicitly documents this: "The listener API exists for wiring polling data to `indexedFingerprints` but zero call sites exist."
  2. **Memory leak potential (minor):** If callers do eventually use this but forget to call the unsubscribe function, listeners accumulate forever. No maximum listener count is enforced.
  3. **No duplicate detection:** The same callback can be added multiple times.

---

## 8. MANIFEST COMPARISON — `compareManifests()`

### Lines 94-162: `function compareManifests(oldManifest, newManifest)`
- **What this section does:** Takes two manifest objects and returns a structured diff with four categories: `added`, `removed`, `statusChanged`, `intentChanged`. Builds lookup maps keyed by `filepath` for both manifests, then compares.
- **What triggers it:** Would be called to detect changes between manifest snapshots
- **What it calls:** `Object.keys()`, array iteration
- **What calls it:** **NOTHING.** Grep confirms zero call sites across the entire codebase. Exported at line 206 but never invoked.
- **Dependencies:** Manifest objects with `.files` arrays containing objects with `.filepath`, `.status`, `.intent` fields
- **Status:** BROKEN (dead code — never called)
- **Gap:**
  1. **CRITICAL — Dead code.** This function is the logical companion to `loadManifest()` — it should be called after each poll to determine if anything changed. But `loadManifest()` at line 27-44 never calls it. The function is completely unused.
  2. **Shallow comparison only (lines 149-151):** Intent comparison checks only three specific fields: `purpose`, `dependsOnBehavior`, `valueStatement`. If the manifest adds new intent fields (e.g., `constraints`, `priority`), they would not be detected as changes.
  3. **No deep comparison of other fields:** Only `status` and `intent` are checked for changes. Other file properties (e.g., `sha256Hash`, `imports`, `importedBy`, `reachabilityScore`, `impactRadius`) are never compared. A file whose imports changed but status didn't would be silently missed.
  4. **Null safety (line 95):** Returns `null` if either manifest is null. Callers would need to null-check the return value, but there are no callers.
  5. **No change count or summary:** The returned object has raw arrays but no `.hasChanges()` convenience method or change count.

### Detailed sub-logic:

**Lines 97-102: Change categories initialization**
- Creates four empty arrays: `added`, `removed`, `statusChanged`, `intentChanged`

**Lines 104-117: File lookup map construction**
- Converts `oldManifest.files` and `newManifest.files` arrays into objects keyed by `filepath`
- Uses `forEach` with `f.filepath` as key — assumes `filepath` is unique per file

**Lines 119-124: Added files detection**
- Iterates `newFiles` keys, checks if path exists in `oldFiles`
- Pushes entire file object to `changes.added`

**Lines 126-131: Removed files detection**
- Iterates `oldFiles` keys, checks if path exists in `newFiles`
- Pushes entire file object to `changes.removed`

**Lines 133-142: Status change detection**
- Iterates `newFiles` keys, checks if file exists in both AND `status` differs
- Pushes `{ filepath, oldStatus, newStatus }` object

**Lines 144-159: Intent change detection**
- Iterates `newFiles` keys, checks if file exists in old AND new file has `intent`
- Compares three specific fields: `purpose`, `dependsOnBehavior`, `valueStatement`
- Pushes `{ filepath, oldIntent, newIntent }` object
- Note at **line 147**: `var oldIntent = oldFiles[path].intent || {}` — safely defaults to empty object if old file had no intent

---

## 9. AI CONTEXT GENERATION — `generateAiContext()`

### Lines 166-197: `function generateAiContext(manifest)`
- **What this section does:** Takes a manifest object and generates a human-readable (and LLM-readable) text summary of the codebase state. Includes target directory, file count, status counts, and per-file details (status, hash, imports, purpose).
- **What triggers it:** Would be called to create a context string for AI consumption
- **What it calls:** String concatenation, `Array.map()` (line 188), `Array.join()` (line 188)
- **What calls it:** **NOTHING.** Grep confirms zero call sites across the entire codebase. Exported at line 207 but never invoked.
- **Dependencies:** Manifest object with `.metadata` and `.files` fields
- **Status:** BROKEN (dead code — never called)
- **Gap:**
  1. **CRITICAL — Dead code.** This function is never called from any file in the codebase. It's exported on `window.St8Coordination.generateAiContext` but no consumer invokes it.
  2. **No return for empty manifest (line 167):** Returns empty string `''` if manifest is null or has no `.files`. A caller receiving an empty string might not distinguish this from a legitimate empty codebase.
  3. **No TOML output:** The header comment says the module uses `ai-signal.toml`, but `generateAiContext()` produces plain text, not TOML. There is no TOML generation anywhere in this file.
  4. **Limited context fields (lines 182-193):** Only includes `filepath`, `status`, `sha256Hash`, `imports[].source`, and `intent.purpose`. Does not include `importedBy`, `reachabilityScore`, `impactRadius`, `dependsOnBehavior`, `valueStatement`, or `needsAIReview` — all fields that exist in the actual `connection-state.json` structure.
  5. **Performance (minor):** Uses repeated string concatenation (`context += ...`) in a loop. For large manifests, this creates many intermediate strings. Template literals or array joining would be more efficient, but this is out of v1 scope.

### Detailed sub-logic:

**Line 167:** Guard clause — returns `''` if no manifest or no `.files`

**Lines 169-178:** Header section
- Line 171: Uses `manifest.metadata.targetDirectory` with `'Unknown'` fallback
- Line 172: Uses `manifest.files.length` for total count
- Lines 174-178: Status counts from `manifest.metadata.statusCounts` — uses `.GREEN`, `.YELLOW`, `.RED` properties directly. Would produce `undefined` if `statusCounts` is missing fields.

**Lines 180-194:** Per-file iteration
- Line 183: `file.filepath`
- Line 184: `file.status`
- Line 185: `file.sha256Hash` with `'N/A'` fallback
- Lines 187-189: Imports — maps `imports[].source` and joins with comma. Only includes source name, not `names` array or `isDefault` flag.
- Lines 191-193: Intent — only includes `purpose`, not `dependsOnBehavior` or `valueStatement`

---

## 10. PUBLIC API — `window.St8Coordination`

### Lines 201-210: Public API Export
```js
window.St8Coordination = {
    loadManifest: loadManifest,
    startPolling: startPolling,
    stopPolling: stopPolling,
    addListener: addListener,
    compareManifests: compareManifests,
    generateAiContext: generateAiContext,
    getLastManifest: function() { return coordinationState.lastManifest; },
    getLastUpdate: function() { return coordinationState.lastUpdate; }
};
```
- **What this section does:** Exposes all public functions and two getter closures on `window.St8Coordination`.
- **What triggers it:** Module load (runs once)
- **What it calls:** N/A (property assignment)
- **What calls it:** N/A
- **Dependencies:** `window` global, all previously defined functions
- **Status:** PARTIAL
- **Gap:**
  1. **Only 2 of 8 exported methods are ever used.** Grep confirms:
     - `startPolling` — called at `st8.html:1905`
     - `stopPolling` — called at `st8.html:1917,1935`
     - `loadManifest` — **never called** externally
     - `addListener` — **never called**
     - `compareManifests` — **never called**
     - `generateAiContext` — **never called**
     - `getLastManifest` — **never called**
     - `getLastUpdate` — **never called**
  2. **No namespace collision protection:** Assigns directly to `window.St8Coordination` without checking if it already exists. A second load of the script would silently overwrite all state.
  3. **No initialization pattern:** There's no `init()` or `destroy()` lifecycle. The module is ready as soon as the script tag loads, but `startPolling()` must be called separately.

---

## 11. @@@ HANDLING

**No `@@@` symbols found in `coordination.js`.**

The `@@@` pattern is handled in other files:
- `backend/intentSeeder.js:187-188` — regex `/(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm`
- `backend/persistence.js:577` — `@@@ SYMBOL METHODS` section with `flagForAIReview()`, `markAIReviewed()`, `getFilesNeedingAIReview()`
- `backend/brunoOscar.js:173` — `<!-- @@@ Content from ... @@@ -->` HTML comment markers
- `st8.html:1972` — Badge display `<span class="badge-ai-review">@@@</span>`
- `file-explorer.js:465` — Badge display in file explorer

`coordination.js` does not detect, process, or propagate `@@@` / `needsAIReview` data, even though the `connection-state.json` manifest it polls contains this information (the `needsAIReview` field is present on file entries). The `generateAiContext()` function at line 166 does not include `needsAIReview` in its output.

---

## 12. CONNECTION MAP

### What triggers coordination?
| Trigger | Location | Action |
|---------|----------|--------|
| User switches to `logic-analyzer` workspace | `st8.html:1904-1906` | Calls `St8Coordination.startPolling('/api/connection-state.json')` |
| User switches to `pretext-dev` workspace | `st8.html:1916-1918` | Calls `St8Coordination.stopPolling()` |
| User switches to standard workspace | `st8.html:1934-1936` | Calls `St8Coordination.stopPolling()` |

### What other files get called?
| Called | From | Line |
|--------|------|------|
| `fetch('/api/connection-state.json')` | `loadManifest()` | 29 |
| `setInterval()` | `startPolling()` | 65 |
| `clearInterval()` | `stopPolling()` | 74 |

### What data flows out?
**Nothing.** The coordination layer fetches manifest data every 2 seconds but:
- Zero listeners are registered (`addListener()` is never called)
- `getLastManifest()` is never called
- `getLastUpdate()` is never called
- `compareManifests()` is never called
- `generateAiContext()` is never called

The polled data is stored in `coordinationState.lastManifest` and then **ignored**.

### Parallel fetch path (not using coordination.js):
The actual UI rendering in `st8.html` does NOT use `St8Coordination`:
- `st8.html:2175` — Direct `fetch('/api/connection-state.json')` after saving notes
- `st8.html:2200-2202` — Direct `fetch('/api/connection-state.json')` after indexing completes
- `st8.html:2212-2218` — `fetchManifest()` helper function (separate from coordination.js)

The UI gets its data through its own fetch calls, completely bypassing the coordination layer.

---

## 13. SUMMARY OF FINDINGS

### CRITICAL Issues (3)

| # | Location | Issue |
|---|----------|-------|
| 1 | Lines 27-44 | `loadManifest()` never calls `compareManifests()` — always notifies listeners even when data is unchanged |
| 2 | Lines 82-90, 46-54 | `addListener()` and `notifyListeners()` are dead infrastructure — zero consumers exist in the entire codebase |
| 3 | Lines 94-162, 166-197 | `compareManifests()` and `generateAiContext()` are exported but never called — dead code |

### WARNING Issues (4)

| # | Location | Issue |
|---|----------|-------|
| 1 | Line 5 | Comment claims module uses `ai-signal.toml` — it doesn't |
| 2 | Lines 58-70 | `startPolling()` has no duplicate-start guard — calling twice creates runaway intervals |
| 3 | Lines 27-44 | `loadManifest()` has no fetch timeout — hung server causes stacked requests |
| 4 | Lines 201-210 | 6 of 8 exported API methods are never called anywhere |

### INFO Issues (3)

| # | Location | Issue |
|---|----------|-------|
| 1 | Line 22 | `pollMs: 2000` is a hardcoded magic number |
| 2 | Lines 27-44 | Error handling swallows all errors — callers can't distinguish error types |
| 3 | Lines 166-197 | `generateAiContext()` omits several manifest fields (`importedBy`, `reachabilityScore`, `impactRadius`, `needsAIReview`) |

---

_Report generated: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
