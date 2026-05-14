# phreak-terminal.js — Detailed Line-by-Line Analysis

**File:** `/home/bozertron/1_AT_A_TIME/st8/phreak-terminal.js`
**Lines:** 1086
**Purpose:** Enhanced terminal UI ("PHREAK> TERMINAL") for the actu8 system. Provides a command-line interface with append-only streaming, TUI overlay mode, signal/event framework, phone off-hook toggle, and mutation notifications.
**Origin:** Enhanced from `orchestr8_next/maestro/phreak-terminal.js` (line 5)

---

## Section 1: Header Comment Block

**Lines 1-21:** Module header comment describing the file, its origin, and feature list.
- **What triggers it:** N/A (static comment)
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** N/A (documentation only)
- **Gap:** None

---

## Section 2: `'use strict'`

**Line 23:** Enables strict mode for the entire file.
- **What triggers it:** Module load
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

## Section 3: State Object — `phreakState`

**Lines 27-41:** Singleton state object holding all terminal state.
- **What triggers it:** Module load (instantiated at parse time)
- **What it calls:** N/A
- **What calls it:** Every function in this file reads/writes this object
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. State is well-organized with clear field documentation.

Fields:
- `lines` (line 28): Array of `{ id, type, content }` — the terminal output buffer
- `history` (line 29): Command history for arrow-key recall
- `historyIndex` (line 30): Current position in history (-1 = not browsing)
- `isExecuting` (line 31): Lock flag during command execution
- `lineCounter` (line 32): Auto-incrementing line ID generator
- `onCopyLine` (line 33): Callback for copy-to-chat
- `lastRenderedIndex` (line 34): Tracks append-only render position
- `isTUI` (line 35): TUI overlay mode flag
- `phoneOffHook` (line 36): Phone icon toggle state
- `signals` (line 37): Received signals log
- `signalCounter` (line 38): Auto-incrementing signal ID generator
- `_epoUnlisten` (line 39): EPO listener cleanup function
- `_signalPopups` (line 40): Active signal popup DOM elements for cleanup

---

## Section 4: API Constant

**Line 43:** `const PHREAK_API = '/api/v1/exec';`
- **What triggers it:** Module load
- **What it calls:** N/A
- **What calls it:** **NOTHING — THIS IS DEAD CODE**
- **Dependencies:** None
- **Status:** ⚠️ **BROKEN / DEAD CODE**
- **Gap:** The `PHREAK_API` constant is defined but **never referenced** anywhere in the file. The actual fetch call at line 90 uses the hardcoded string `'/api/exec'` (without `v1`). This is either:
  1. A leftover from an older version that used `/api/v1/exec`
  2. A mismatch — the constant should be used at line 90 but isn't

**Finding:** Dead constant `PHREAK_API` at line 43. The fallback fetch at line 90 uses `/api/exec` instead. If the intent was to use the constant, this is a bug — the paths don't match.

---

## Section 5: Command Execution — `phreakExecute(cmd)`

**Lines 47-119:** Core command execution function. Handles the full lifecycle: echo input → execute → display output.
- **What triggers it:** `Enter` key in input field (line 308), or direct call via `window.PhreakTerminal.execute()` (line 1022)
- **What it calls:**
  - `_mkLine()` (line 253)
  - `_renderLines()` (line 208)
  - `_tryMediaCommand()` (line 130) — for media-specific commands
  - `window.epoClient.request('exec', ...)` (line 70) — EPO WebSocket path
  - `fetch('/api/exec', ...)` (line 90) — REST fallback path
- **What calls it:** `_handleInputKeydown` on Enter (line 308), external callers via `window.PhreakTerminal.execute`
- **Dependencies:** `window.epoClient` (EPO WebSocket client), `/api/exec` backend endpoint
- **Status:** WORKING (with caveats)
- **Gap:**
  1. **Line 43 vs Line 90 API path mismatch** (see Section 4). `PHREAK_API` says `/api/v1/exec`, fallback uses `/api/exec`.
  2. **Line 69-70:** No error handling if `window.epoClient.request` throws — it IS caught by the outer try/catch at line 113, but the error message will be generic. This is acceptable.
  3. **Lines 74-83, 96-104:** The stdout/stderr parsing splits on `\n` and filters empty strings. This is correct but will silently drop empty-line output.
  4. **Line 95:** `response.json()` will throw if the response isn't JSON (e.g., 500 HTML error page). This is caught by the inner try/catch at line 109. Acceptable.

Flow:
```
Enter key → _handleInputKeydown (line 305) → phreakExecute (line 47)
  → echo input line (line 55)
  → _tryMediaCommand (line 61) — if true, returns early
  → if epoClient connected: use WebSocket (line 69-86)
  → else: fallback to REST fetch /api/exec (line 88-111)
  → push stdout/stderr/system lines
  → _renderLines (line 118)
```

---

## Section 6: Media Commands — `MEDIA_COMMANDS` and `_tryMediaCommand(cmd)`

**Lines 121-204:** Media-specific command routing via EPO bus.
- **What triggers it:** Called from `phreakExecute()` at line 61
- **What it calls:**
  - `window.epoClient.request(match.type, {})` (line 141) — for stream/status/health/config queries
  - `window.epoClient.request('start_proxy', { url })` (line 165) — for proxy add
  - `_mkLine()` (line 253)
- **What calls it:** `phreakExecute()` (line 61)
- **Dependencies:** `window.epoClient` (EPO WebSocket client)
- **Status:** WORKING (when EPO client is available)

**MEDIA_COMMANDS map (lines 123-128):**
| Command | EPO Request Type | Label |
|---------|-----------------|-------|
| `stream list` | `get_streams` | Streams |
| `stream status` | `get_status` | Status |
| `media health` | `get_health` | Health |
| `media config` | `get_config` | Config |

**Sub-commands handled:**
- Exact matches against `MEDIA_COMMANDS` (line 134)
- `proxy add <url>` (line 154) — starts a proxy stream via EPO
- `media help` / `stream help` / `av help` (line 174) — prints help text

**Gap:**
  1. **Line 136:** Media commands require EPO connection. If EPO is not connected, it prints an error and returns `true` (handled). This is correct behavior.
  2. **Line 155:** `cmd.trim().substring(10)` extracts the URL. If the user types `proxy add` with trailing spaces but no URL, the `url` check at line 156 catches it. Correct.

---

## Section 7: Render Engine — Append-Only Streaming

**Lines 206-255:** Render functions for terminal output.
- **What triggers it:** Called after every state change that adds lines
- **What it calls:**
  - `_buildLineHTML()` (line 267) — builds HTML for each line
  - `_updateExecutingIndicator()` (line 241)
  - `_scrollToBottom()` (line 248)
  - `document.getElementById('phreak-output')` — the output container
  - `output.insertAdjacentHTML('beforeend', fragment)` (line 222) — append-only insertion
- **What calls it:** `phreakExecute()` (lines 57, 64, 118), `_tryMediaCommand()`, `_isolateFiles()`, `receiveSignal()`, `notifyMutation()`, `togglePhoneOffHook()`, etc.
- **Dependencies:** DOM element `#phreak-output`
- **Status:** WORKING

### `_renderLines()` (lines 208-227)
Append-only renderer. Only renders lines that haven't been rendered yet (tracked by `lastRenderedIndex`).
- **Line 213:** `phreakState.lines.slice(phreakState.lastRenderedIndex + 1)` — gets new lines only
- **Line 214:** If no new lines and already rendered once, just updates executing indicator
- **Line 221:** Maps new lines through `_buildLineHTML`, joins, and inserts via `insertAdjacentHTML`
- **Line 223:** Updates `lastRenderedIndex` to track position

### `_fullRender()` (lines 230-239)
Full re-render. Replaces entire output innerHTML. Used on clear, TUI toggle, and remount.
- **Line 234:** `output.innerHTML = ...` — full replacement (not append-only)

### `_updateExecutingIndicator()` (lines 241-246)
Toggles the executing indicator (diamond `◇`) and dims the input line during execution.

### `_scrollToBottom()` (lines 248-251)
Auto-scrolls output container to bottom.

### `_mkLine(type, content)` (lines 253-255)
Factory function for line objects. Auto-increments `lineCounter`.

**Gap:** None. The append-only rendering is well-implemented.

---

## Section 8: HTML Utilities

**Lines 257-283:** HTML escaping and line HTML builder.

### `_escapeHtml(str)` (lines 259-265)
Escapes `&`, `<`, `>`, `"` for safe HTML insertion.
- **Status:** WORKING
- **Gap:** Does NOT escape single quotes (`'`). This is acceptable because the function is only used inside double-quoted attributes and text content, not single-quoted attributes. However, if `_escapeHtml` were ever used inside a single-quoted attribute context, it could be exploited. **Low risk currently.**

### `_buildLineHTML(line)` (lines 267-283)
Builds HTML string for a single terminal line.
- **Line 271:** Creates `<div class="phreak-line phreak-line--{type}" data-line-id="{id}">`
- **Line 274:** Adds prompt `bozertron@orchestr8:~$` for input lines
- **Line 276:** Content is escaped via `_escapeHtml` — **XSS safe**
- **Line 279:** Copy button `◇` with `data-action="copy"` — CSP-safe (event delegation, no inline onclick)
- **Status:** WORKING
- **Gap:** None. XSS is properly mitigated.

---

## Section 9: Input Handling — `_handleInputKeydown(e)`

**Lines 285-336:** Keyboard event handler for the command input field.
- **What triggers it:** `keydown` event on `#phreak-cmd-input` (attached at line 945)
- **What it calls:**
  - `toggleTUI()` (line 294, 301)
  - `phreakExecute()` (line 308)
- **What calls it:** DOM event listener (attached by `_attachInputListener()` at line 942)
- **Dependencies:** DOM elements `#phreak-cmd-input`
- **Status:** WORKING

**Key bindings:**
| Key | Action | Lines |
|-----|--------|-------|
| `Ctrl+T` / `Cmd+T` | Toggle TUI mode | 292-296 |
| `Escape` (in TUI) | Exit TUI mode | 299-303 |
| `Enter` | Execute command | 305-310 |
| `ArrowUp` | History back | 312-322 |
| `ArrowDown` | History forward | 324-335 |

**Gap:**
  1. **Lines 292-296:** `Ctrl+T` is intercepted globally for TUI toggle. This may conflict with browser default `Ctrl+T` (new tab) when the input is focused. The `e.preventDefault()` prevents the browser action. This is **intentional** but could surprise users.

---

## Section 10: Output Click Handler — Event Delegation

**Lines 338-361:** Click event handler for the output area, using event delegation.
- **What triggers it:** Click on `#phreak-output` (attached at line 952)
- **What it calls:**
  - `_dismissSignalPopup()` (line 345, from line 461)
  - `phreakCopyLine()` (line 359, from line 365)
- **What calls it:** DOM event listener (attached by `_attachOutputClickListener()` at line 949)
- **Dependencies:** DOM elements with `data-action="dismiss-signal"` and `.phreak-copy-btn`
- **Status:** WORKING
- **Gap:** None. Event delegation pattern is CSP-safe and well-structured.

---

## Section 11: Copy-to-Chat — `phreakCopyLine(lineId)`

**Lines 363-376:** Copies a terminal line's content to chat or clipboard.
- **What triggers it:** Click on copy button `◇` (via event delegation at line 359)
- **What it calls:**
  - `phreakState.onCopyLine(line.content)` (line 369) — callback
  - `navigator.clipboard.writeText()` (line 373) — fallback
- **What calls it:** `_handleOutputClick()` (line 359), external via `window.PhreakTerminal.copyLine` (line 1024)
- **Dependencies:** `navigator.clipboard` API (fallback)
- **Status:** WORKING
- **Gap:**
  1. **Line 373:** Clipboard fallback has `.catch(function() {})` — silently swallows errors. This is acceptable for a fallback.

---

## Section 12: Signal Framework — `receiveSignal(signal)`

**Lines 378-413:** Core signal reception function. Stores signals and optionally shows pop-ups.
- **What triggers it:** EPO bus listener (line 899), external callers via `window.PhreakTerminal.receiveSignal` (line 1036)
- **What it calls:**
  - `_mkLine()` (line 253)
  - `_renderLines()` (line 208)
  - `_showSignalPopup()` (line 411, from line 415)
- **What calls it:** `_wireEPOListener()` (line 899), external callers
- **Dependencies:** DOM, `_showSignalPopup()`
- **Status:** WORKING

**Signal shape (documented at lines 380-385):**
```js
{
  type: 'announcement' | 'message' | 'media' | 'system',
  data: { title?, body?, source?, meta? },
  provisioned: boolean   // only true → visual pop-up
}
```

**Flow:**
1. Validate signal has `type` (line 388)
2. Create entry with auto-incrementing ID, timestamp, suppressed flag (lines 391-398)
3. Push to `phreakState.signals` (line 400)
4. Log to terminal as system line (lines 403-407)
5. If `provisioned` AND not `suppressed` (phone on-hook), show popup (lines 410-412)

**Gap:** None. Clean implementation.

---

## Section 13: Signal Popup Display — `_showSignalPopup(entry)`

**Lines 415-459:** Creates and displays a styled card popup for provisioned signals.
- **What triggers it:** `receiveSignal()` when `entry.provisioned && !entry.suppressed` (line 410)
- **What it calls:**
  - `_escapeHtml()` (line 259) — for title, body, source
  - `_scrollToBottom()` (line 248)
  - `setTimeout` for auto-dismiss after 8 seconds (line 448)
- **What calls it:** `receiveSignal()` (line 411)
- **Dependencies:** DOM element `#phreak-output`
- **Status:** WORKING

**Popup structure (lines 435-442):**
- Header with icon + title + dismiss button
- Optional body
- Optional source ("via {source}")

**Auto-dismiss:** 8-second timer (line 448), 400ms fade animation (line 452)

**Gap:**
  1. **Line 435-442:** The popup uses `innerHTML` to build the popup content. The title, body, and source are all escaped via `_escapeHtml()`. **XSS safe.**
  2. **Line 458:** Popup tracking pushes `{ el, timer }` to `_signalPopups` array but **never cleans up the array entry when auto-dismiss fires**. The timer removes the DOM element (line 452) but the `{ el, timer }` object remains in `_signalPopups`. This is a minor memory leak — the array grows unboundedly as signals arrive. The `_dismissSignalPopup` function (line 461) does splice the array, but only for manual dismissals. Auto-dismissed popups are never cleaned from the tracking array.

**Finding:** Memory leak in `_signalPopups` tracking array. Auto-dismissed popups (line 448-455) remove the DOM element but never splice the entry from `phreakState._signalPopups`. Over time, this array grows with stale references to detached DOM nodes.

---

## Section 14: Signal Popup Dismiss — `_dismissSignalPopup(el)`

**Lines 461-475:** Manual dismiss handler for signal popups.
- **What triggers it:** Click on dismiss button `✕` (via event delegation at line 345)
- **What it calls:** `clearTimeout()`, `splice()` on `_signalPopups`, DOM removal with fade
- **What calls it:** `_handleOutputClick()` (line 345)
- **Dependencies:** `phreakState._signalPopups`
- **Status:** WORKING
- **Gap:** None (this path properly cleans up the tracking array).

---

## Section 15: TUI Toggle — `toggleTUI()`

**Lines 477-485:** Toggles between panel mode and full-screen TUI overlay.
- **What triggers it:** `Ctrl+T` in input (line 294), `Escape` in TUI (line 301), TUI header button (line 547), panel header button (line 991), external via `window.PhreakTerminal.toggleTUI` (line 1033)
- **What it calls:** `_exitTUI()` or `_enterTUI()`
- **What calls it:** Multiple entry points (see triggers)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

## Section 16: Enter TUI — `_enterTUI()`

**Lines 487-595:** Creates full-screen TUI overlay with toolbar, phone icon, and file isolation buttons.
- **What triggers it:** `toggleTUI()` when `!phreakState.isTUI` (line 483)
- **What it calls:**
  - `_buildPhoneIconHTML()` (line 784)
  - `_attachInputListener()` (line 942)
  - `_attachOutputClickListener()` (line 949)
  - `_fullRender()` (line 230)
  - `_updatePhoneIconState()` (line 808)
  - `_updateTUIBadges()` (line 714)
  - Various action handlers via event delegation (lines 553-579)
- **What calls it:** `toggleTUI()` (line 483)
- **Dependencies:** DOM (appends to `document.body`)
- **Status:** WORKING

**TUI Overlay Structure (lines 499-530):**
- Header: title "phreak> TUI" + phone icon + close button
- Toolbar: File isolation buttons (GREEN/YELLOW/RED/ALL/GRAPH) + Clear buttons + Settings
- Body: Output area + Input row (recreated elements with same IDs)

**Event Delegation (lines 546-580):** Single click listener on overlay handles all toolbar buttons.

**Global Escape Handler (lines 583-589):** Added to `document` for TUI mode, removed on exit.

**Gap:**
  1. **Line 523:** The TUI overlay creates NEW elements with `id="phreak-output"` and `id="phreak-cmd-input"`. When the TUI overlay is appended to `document.body`, there will be **duplicate IDs** in the DOM (the original panel elements still exist but are hidden). This is technically invalid HTML but works because `_enterTUI` immediately attaches listeners to the NEW elements and `_fullRender` renders into them. However, `document.getElementById()` will always find the FIRST matching element in DOM order — since the TUI overlay is appended AFTER the panel, the panel's elements will be found first. **This is a potential bug.**

   Wait — let me re-check. The overlay is appended to `document.body` at line 532. The panel elements are inside the panel container which is still in the DOM. So `document.getElementById('phreak-output')` at line 209 would find the PANEL's output element, not the TUI's. But `_fullRender()` is called at line 537, which calls `_renderLines()` which calls `document.getElementById('phreak-output')`. If the panel's `#phreak-output` is found first, the render would go to the wrong element.

   Actually, looking more carefully: `_exitTUI()` at line 706-709 looks for `#panel-phreak-body` and calls `phreakMountStateless()` which replaces the panel's innerHTML. The original panel body has its own `#phreak-output`. So during TUI mode, there ARE two `#phreak-output` elements. `document.getElementById()` returns the first one in document order, which would be the panel's hidden one, NOT the TUI overlay's visible one.

   **This is a real bug.** When `_renderLines()` is called during TUI mode, it would render into the HIDDEN panel's output, not the visible TUI overlay's output. However, `_enterTUI()` calls `_fullRender()` at line 537 which does `document.getElementById('phreak-output')` — this would get the panel's element if the panel overlay is still in the DOM.

   Actually, looking at st8.html line 1700-1701: the panel overlay `#overlay-phreak` is a sibling of the body. The panel host `#phreak-host` is inside it. When TUI is entered, the panel overlay may still be visible or hidden. If it's hidden (display:none), `getElementById` still finds it. If the panel is NOT in the DOM (removed), then the TUI's element would be found.

   Let me check: the st8.html panel structure has `overlay-phreak` which is always in the DOM. The `phreak-host` div is inside it. So `phreakMount()` renders into `phreak-host` which creates `#phreak-output` inside the panel. Then `_enterTUI()` creates ANOTHER `#phreak-output` inside the TUI overlay on `document.body`. Now there are two.

   **This is confirmed as a potential rendering bug** — duplicate IDs could cause `_renderLines()` to render into the wrong element during TUI mode.

   HOWEVER — looking at the code more carefully, the TUI overlay appends the new elements to `document.body`. The panel elements are inside `#overlay-phreak > #phreak-host`. The TUI overlay is a direct child of `document.body`. In document order, the panel overlay comes BEFORE the TUI overlay (since it's already in the DOM when TUI is entered). So `getElementById` would find the panel's `#phreak-output` first.

   But wait — the panel overlay might be hidden via CSS (`display:none` or similar). Even if hidden, `getElementById` still finds it. So `_renderLines()` during TUI mode would write to the hidden panel's output, not the visible TUI output.

   **This IS a bug.** Lines would be added to the hidden panel's output during TUI mode, and the user wouldn't see them.

   Actually, let me reconsider. `_enterTUI()` calls `_fullRender()` at line 537. If the panel overlay is hidden with `display:none`, `getElementById` still returns the panel's element. But the TUI overlay's element would NOT be found because it comes later in DOM order.

   **Confirmed: This is a duplicate-ID rendering bug.** During TUI mode, `_renderLines()` and `_fullRender()` would target the hidden panel's `#phreak-output` instead of the visible TUI overlay's `#phreak-output`.

   **Severity: BLOCKER** — commands executed during TUI mode would appear to do nothing (output goes to hidden panel).

---

## Section 17: TUI Isolation and Clear Functions

**Lines 597-689:** File isolation, clear, graph, and settings functions for TUI toolbar.

### `_isolateFiles(status)` (lines 599-639)
Filters indexed files by status (GREEN/YELLOW/RED/ALL) and displays them.
- **What triggers it:** TUI toolbar buttons (lines 553-564)
- **What it calls:**
  - `window.VoidFileExplorer.getIndexedFingerprints()` (line 601) — from `file-explorer.js`
  - `_updateTUIBadges()` (line 618)
  - `window.renderFileList(filtered)` (line 625) — **GHOST FUNCTION**
- **What calls it:** TUI overlay click handler (lines 553-564)
- **Dependencies:** `window.VoidFileExplorer` (from `file-explorer.js`), `window.renderFileList`
- **Status:** ⚠️ **PARTIAL**
- **Gap:**
  1. **Lines 624-625:** `window.renderFileList(filtered)` is called but **this function is never defined anywhere in the codebase**. A grep for `renderFileList\s*=` across all `.js` files found no definition. This is a **ghost dependency** — the call will silently fail (the `if` guard prevents a crash, but the function will never execute).
  2. **Lines 629-637:** Shows action options (make-topic, export-report, create-sprint) but these are **never wired to any handler**. They're just text output with no clickable functionality.

### `_clearVoid()` (lines 641-648)
Clears the void file list panel.
- **Status:** WORKING (if `#void-file-list` exists)

### `_clearPhreak()` (lines 650-654)
Clears the terminal output.
- **Status:** WORKING

### `_clearAll()` (lines 656-659)
Clears both void and phreak.
- **Status:** WORKING

### `_showGraph()` (lines 661-679)
Opens the connection graph visualizer.
- **Dependencies:** `window.VoidFileExplorer.getIndexedFingerprints()`, `window.St8GraphVisualizer.showGraphPopup()` (from `graph-visualizer.js`)
- **Status:** WORKING (when dependencies are loaded)

### `_showSettings()` (lines 681-689)
Opens settings in file explorer.
- **Dependencies:** `window.St8Settings.showSettingsInExplorer()` (from `settings-ui.js`)
- **Status:** WORKING (when dependencies are loaded)

---

## Section 18: Exit TUI — `_exitTUI()`

**Lines 691-710:** Tears down TUI overlay and re-renders into panel.
- **What triggers it:** `toggleTUI()` when `phreakState.isTUI` (line 481)
- **What it calls:**
  - `document.removeEventListener('keydown', ...)` (line 696) — removes global Escape handler
  - `phreakMountStateless()` (line 708) — re-renders into panel
- **What calls it:** `toggleTUI()` (line 481)
- **Dependencies:** DOM element `#panel-phreak-body`
- **Status:** ⚠️ **PARTIAL**
- **Gap:**
  1. **Line 706:** `document.getElementById('panel-phreak-body')` — this looks for the panel body element. If the panel overlay was never opened or the element doesn't exist, this silently does nothing. The terminal state is preserved in `phreakState` but the UI would be empty until the panel is re-opened and `phreakMount()` is called again.
  2. **Duplicate ID cleanup:** When the TUI overlay is removed (line 702), the duplicate `#phreak-output` and `#phreak-cmd-input` are removed from the DOM. This restores the single-ID state. So the duplicate-ID bug from Section 16 is mitigated on exit — but is still active DURING TUI mode.

---

## Section 19: TUI Badge Updates — `_updateTUIBadges()`

**Lines 712-736:** Updates the GREEN/YELLOW/RED/ALL badge counts in the TUI toolbar.
- **What triggers it:** `_enterTUI()` (line 543), `_isolateFiles()` (line 618)
- **What it calls:**
  - `window.VoidFileExplorer.getIndexedFingerprints()` (line 716)
  - `document.querySelectorAll('#phreak-tui-toolbar .phreak-badge')` (line 728)
- **What calls it:** `_enterTUI()`, `_isolateFiles()`
- **Dependencies:** `window.VoidFileExplorer`, DOM
- **Status:** WORKING
- **Gap:** None

---

## Section 20: Stateless Mount — `phreakMountStateless(panelBodyEl)`

**Lines 738-750:** Re-mounts the terminal into a panel body without re-seeding welcome message.
- **What triggers it:** `_exitTUI()` (line 708)
- **What it calls:**
  - `_buildContainerHTML()` (line 921)
  - `_attachInputListener()` (line 942)
  - `_attachOutputClickListener()` (line 949)
  - `_fullRender()` (line 230)
- **What calls it:** `_exitTUI()` (line 708)
- **Dependencies:** DOM
- **Status:** WORKING
- **Gap:** None

---

## Section 21: Phone Icon — SVG and Toggle

**Lines 752-827:** Phone icon SVG definitions, HTML builder, toggle function, and state update.

### SVG Constants (lines 755-782)
- `PHONE_SVG_ACTIVE` (lines 755-762): On-hook handset SVG
- `PHONE_SVG_OFFHOOK` (lines 764-782): Off-hook handset SVG with animated pulsing dots

### `_buildPhoneIconHTML()` (lines 784-795)
Builds the phone button HTML with appropriate SVG and state class.
- **Status:** WORKING

### `togglePhoneOffHook()` (lines 797-806)
Toggles phone state and logs status to terminal.
- **What triggers it:** Phone button click (line 550), external via `window.PhreakTerminal.togglePhoneOffHook` (line 1043)
- **Status:** WORKING

### `_updatePhoneIconState()` (lines 808-827)
Updates all phone toggle buttons in the DOM (there could be multiple — panel header + TUI header).
- **Line 821-824:** Creates a temporary `div` wrapper to parse the new SVG HTML, then replaces the old SVG. This is a safe way to swap SVG content.
- **Status:** WORKING
- **Gap:** None

---

## Section 22: Mutation Notifications — `notifyMutation(data)`

**Lines 829-864:** Displays SSE mutation events in the terminal.
- **What triggers it:** SSE mutation stream in `st8.html` (line 2422-2423): `window.PhreakTerminal.notifyMutation(data)`
- **What it calls:**
  - `_mkLine()` (line 253)
  - `_renderLines()` (line 208)
- **What calls it:** `st8.html` SSE `onmessage` handler (line 2422)
- **Dependencies:** SSE endpoint `/api/mutations` (in `st8.html`)
- **Status:** WORKING

**Mutation type to line type mapping (lines 857-860):**
| Mutation Type | Line Type | Color |
|--------------|-----------|-------|
| `CREATE` | `system` | gold |
| `EDIT` | `stdout` | cyan |
| `LOCK` | `stderr` | pink |
| other | `system` | gold (default) |

**Message format (line 853):** `[MUTATION] {TYPE} {filepath} {HH:MM:SS}`

**Gap:**
  1. **Line 847-849:** Time formatting uses `String(d.getHours()).padStart(2, '0')`. This uses local time, not UTC. This is probably intentional for a local dev tool but could be confusing if the server and client are in different timezones.
  2. **Line 850:** Empty catch `catch (_) {}` silently swallows date parsing errors. If `timestamp` is invalid, `timeStr` remains empty and the message is shown without a timestamp. Acceptable behavior.

---

## Section 23: EPO Bus Listener — `_wireEPOListener()` and `_unwireEPOListener()`

**Lines 866-917:** WebSocket event bus integration for receiving signals.

### `_wireEPOListener()` (lines 870-910)
Subscribes to EPO WebSocket broadcasts and translates them into phreak signals.
- **What triggers it:** `phreakMount()` (line 1001)
- **What it calls:**
  - `window.epoClient.listen(callback)` (line 876) — registers a listener on the EPO bus
  - `receiveSignal()` (line 899) — for each qualifying message
- **What calls it:** `phreakMount()` (line 1001)
- **Dependencies:** `window.epoClient` (EPO WebSocket client)
- **Status:** WORKING (when EPO client is available)

**EPO Message Type Mapping (lines 881-894):**
| EPO Type | Phreak Signal Type | Notes |
|----------|-------------------|-------|
| `announcement` | `announcement` | |
| `notify` | `announcement` | |
| `chat_response` | `message` | |
| `chat_ack` | `message` | |
| `media` | `media` | |
| `tts` | `media` | |
| `system` | `system` | |
| `error` | `system` | |
| `heartbeat` | `null` (skip) | |
| `ping` | `null` (skip) | |
| `pong` | `null` (skip) | |
| `registered` | `null` (skip) | |

**Gap:**
  1. **Line 871:** Idempotency guard `if (phreakState._epoUnlisten) return` — prevents double-wiring. Good.
  2. **Line 874:** Checks `typeof window === 'undefined'` — this is a browser-only file, so this check is technically unnecessary but harmless (defensive coding).
  3. **Line 897:** `if (signalType === null || signalType === undefined) return` — correctly skips unknown message types. However, this means any NEW EPO message type added in the future will be silently dropped. This is the correct behavior (whitelist approach).

### `_unwireEPOListener()` (lines 912-917)
Cleanup function for EPO listener.
- **What triggers it:** **NOTHING — THIS IS NEVER CALLED**
- **Status:** ⚠️ **DEAD CODE**
- **Gap:** `_unwireEPOListener()` is defined but **never called** anywhere in the file or the codebase. The EPO listener is wired at line 1001 in `phreakMount()` but never unwired. If `phreakMount()` is called multiple times, the idempotency guard at line 871 prevents double-wiring, so this isn't a functional bug. But the cleanup function exists as dead code.

---

## Section 24: Container HTML Builder — `_buildContainerHTML()`

**Lines 919-938:** Builds the main terminal container HTML.
- **What triggers it:** `phreakMount()` (line 968), `phreakMountStateless()` (line 740)
- **What it calls:** `_buildPhoneIconHTML()` (line 926)
- **What calls it:** Mount functions
- **Dependencies:** None
- **Status:** WORKING

**Container structure:**
```
div#phreak-container
  div#phreak-header
    span "PHREAK>"
    div.phreak-header-controls
      [phone icon button]
      [TUI toggle button]
  div#phreak-output
  div#phreak-input-line
    span "bozertron@orchestr8:~$ "
    input#phreak-cmd-input
    span#phreak-executing "◇"
```

**Gap:** None

---

## Section 25: Listener Attachment Helpers

**Lines 940-954:** Helper functions to attach event listeners.

### `_attachInputListener()` (lines 942-947)
Attaches `keydown` listener to `#phreak-cmd-input`.
- **Gap:** Attaches a NEW listener every time it's called. If called multiple times (e.g., TUI enter/exit), **multiple listeners accumulate** on the same element. This means each keypress would trigger `_handleInputKeydown` multiple times, causing commands to execute twice, history to jump two entries, etc. However, since TUI mode creates NEW DOM elements (with the duplicate ID issue), the old listeners are on elements that get removed from the DOM. So in practice, this may not cause double-firing. But if `phreakMountStateless()` is called on the same panel body element, it replaces `innerHTML` which destroys the old input element and creates a new one — so the old listener is lost. This is actually correct behavior.

### `_attachOutputClickListener()` (lines 949-954)
Attaches `click` listener to `#phreak-output`.
- **Same analysis as above** — innerHTML replacement destroys old elements, so listener accumulation isn't an issue.

**Status:** WORKING (in practice)
**Gap:** Technically, if `_attachInputListener()` were called on the SAME element without innerHTML replacement, listeners would accumulate. But the current call patterns prevent this.

---

## Section 26: Mount / Init — `phreakMount(panelBodyEl, onCopyLine)`

**Lines 956-1009:** Main entry point for mounting the terminal into a panel.
- **What triggers it:** `st8.html` panel mount (line 1706-1707): `window.PhreakTerminal.mount(this.host, ...)`
- **What it calls:**
  - `_buildContainerHTML()` (line 921)
  - `_attachInputListener()` (line 942)
  - `_attachOutputClickListener()` (line 949)
  - `_wireEPOListener()` (line 870)
  - `_fullRender()` (line 230)
- **What calls it:** `st8.html` panel system
- **Dependencies:** DOM, `window.epoClient`
- **Status:** WORKING

**Welcome message (lines 962-966):** The welcome message seeding is **DISABLED** — `if (false && ...)` at line 962. This means the terminal starts empty. This appears intentional (the `false` is hardcoded).

**Container click handler (lines 974-985):** Clicks on the container focus the input, except when clicking on copy/signal/phone/tui buttons.

**Header button delegation (lines 988-998):** Wires TUI toggle and phone toggle buttons in the header.

**Gap:**
  1. **Line 962:** `if (false && phreakState.lines.length === 0)` — dead code. The welcome message will never be displayed. If this is intentional, the entire block (lines 962-966) should be removed for clarity. If it's a bug (should be `if (phreakState.lines.length === 0)`), then the terminal never shows its welcome message.

---

## Section 27: Focus Helper — `phreakFocus()`

**Lines 1011-1014:** Focuses the command input.
- **Status:** WORKING
- **Gap:** None

---

## Section 28: Public API — `window.PhreakTerminal`

**Lines 1016-1085:** Exports the public API on `window.PhreakTerminal`.
- **What triggers it:** Module load (guarded by `typeof window !== 'undefined'` at line 1018)
- **Status:** WORKING

**API Surface:**

| Method | Line | Description |
|--------|------|-------------|
| `mount(el, onCopyLine)` | 1021 | Mount terminal into element |
| `execute(cmd)` | 1022 | Execute a command |
| `focus()` | 1023 | Focus input |
| `copyLine(lineId)` | 1024 | Copy line to chat/clipboard |
| `getLines()` | 1025 | Get all terminal lines |
| `clear()` | 1026 | Clear terminal |
| `toggleTUI()` | 1033 | Toggle TUI mode |
| `receiveSignal(signal)` | 1036 | Receive a signal |
| `getSignals()` | 1037 | Get all signals |
| `notifyMutation(data)` | 1040 | Display mutation notification |
| `togglePhoneOffHook()` | 1043 | Toggle phone state |
| `getPhoneState()` | 1044 | Get phone state |
| `getState()` | 1045 | Get terminal state snapshot |
| `appendToken(token)` | 1049 | Streaming token append |
| `sealLine()` | 1069 | Seal current streaming line |
| `getState()` | 1075 | **DUPLICATE** — overrides line 1045 |

**Gap:**
  1. **Lines 1045 and 1075:** `getState` is defined TWICE in the same object literal. The second definition (line 1075) **silently overrides** the first (line 1045). The first returns `{ isTUI, phoneOffHook, lineCount }`, the second returns `{ lineCount, historyCount, isExecuting, isTUI, phoneOffHook, signalCount }`. The second is more comprehensive, so this is probably intentional — but the first definition is dead code.

**Finding:** Duplicate `getState` method definition. Lines 1045 and 1075 both define `getState` on the `window.PhreakTerminal` object. The second definition silently overrides the first. The first definition (returning 3 fields) is dead code.

---

## Section 29: Streaming Token Support — `appendToken` and `sealLine`

**Lines 1047-1072:** Streaming token API for real-time output.

### `appendToken(token)` (lines 1049-1066)
Appends a token to the last stdout line (streaming mode) or creates a new line.
- **Line 1052:** Checks if last line is `stdout` type and not `_sealed`
- **Line 1054:** Appends token to content
- **Line 1056-1057:** Directly updates DOM text content (bypasses `_renderLines` for performance)
- **Line 1061-1064:** Creates new line if last isn't stdout or is sealed

### `sealLine()` (lines 1069-1072)
Marks the current streaming line as sealed so next token starts a new line.

**Status:** WORKING
**Gap:**
  1. **Line 1056:** `document.querySelector('[data-line-id="' + last.id + '"] .phreak-text')` — direct DOM manipulation. If the element doesn't exist (e.g., in TUI mode with duplicate IDs), this silently fails and the token is appended to the state but not displayed. The next `_renderLines()` call would pick it up though.
  2. **Line 1052:** `last._sealed` is checked but `_sealed` is not part of the `_mkLine` factory. It's added ad-hoc at line 1062. This is fine for a dynamic property but could be confusing.

---

## @@@ Handling

**No `@@@` symbols found in phreak-terminal.js.**

The `@@@` pattern exists in `st8.html` at line 1972 as part of the file explorer's AI review badge display:
```js
'<div class="file-name">' + escapeHtml(file.filename) + (file.needsAIReview ? ' <span class="badge-ai-review">@@@</span>' : '') + '</div>'
```
This is unrelated to phreak-terminal.js.

---

## Cross-File Dependency Map

### Files that phreak-terminal.js depends on:

| Dependency | Type | Lines Referenced | Required? |
|-----------|------|-----------------|-----------|
| `window.epoClient` | Global (EPO WebSocket client) | 69, 70, 136, 141, 160, 165, 874, 876 | Optional (has REST fallback) |
| `window.VoidFileExplorer` | Global (from `file-explorer.js`) | 600, 601, 662, 663, 715, 716 | Optional (TUI features) |
| `window.renderFileList` | Global (???) | 624, 625 | **NEVER DEFINED — GHOST** |
| `window.St8GraphVisualizer` | Global (from `graph-visualizer.js`) | 672, 673 | Optional (graph feature) |
| `window.St8Settings` | Global (from `settings-ui.js`) | 682, 683 | Optional (settings feature) |
| `/api/exec` | REST endpoint | 90 | Fallback when EPO unavailable |
| `/api/mutations` | SSE endpoint | (in st8.html, calls notifyMutation) | For mutation notifications |

### Files that depend on phreak-terminal.js:

| File | How | Lines |
|------|-----|-------|
| `st8.html` | `<script src="phreak-terminal.js">` | 1662 |
| `st8.html` | `window.PhreakTerminal.mount()` | 1706-1707 |
| `st8.html` | `window.PhreakTerminal.toggleTUI()` | 1723 |
| `st8.html` | `window.PhreakTerminal.togglePhoneOffHook()` | 1725 |
| `st8.html` | `window.PhreakTerminal.getPhoneState()` | 1726 |
| `st8.html` | `window.PhreakTerminal.getState()` | 1785 |
| `st8.html` | `window.PhreakTerminal.notifyMutation()` | 2422-2423 |

---

## Summary of Findings

### BLOCKER Issues

| ID | Line(s) | Issue |
|----|---------|-------|
| B-01 | 487-595, 208-227 | **Duplicate DOM IDs during TUI mode.** `_enterTUI()` creates new elements with `id="phreak-output"` and `id="phreak-cmd-input"` while the original panel elements still exist. `document.getElementById()` returns the FIRST match (panel's hidden element), causing `_renderLines()` to write to the hidden panel instead of the visible TUI overlay. Commands executed during TUI mode would appear to do nothing. |
| B-02 | 43, 90 | **API path mismatch / dead constant.** `PHREAK_API` is defined as `'/api/v1/exec'` but never used. The fallback fetch at line 90 uses hardcoded `'/api/exec'`. If the server expects `/api/v1/exec`, the fallback path will 404. |

### WARNING Issues

| ID | Line(s) | Issue |
|----|---------|-------|
| W-01 | 624-625 | **Ghost dependency on `window.renderFileList`.** This function is called but never defined anywhere in the codebase. The `_isolateFiles()` function will filter files but never render them to the void panel. |
| W-02 | 448-458 | **Memory leak in `_signalPopups`.** Auto-dismissed popups remove their DOM element but never splice their entry from `phreakState._signalPopups`. The tracking array grows unboundedly. |
| W-03 | 912-917 | **Dead code: `_unwireEPOListener()`.** Defined but never called. The EPO listener is never cleaned up. |
| W-04 | 1045, 1075 | **Duplicate `getState` method.** Defined twice in the object literal; the second silently overrides the first. The first definition (line 1045) is dead code. |

### INFO Issues

| ID | Line(s) | Issue |
|----|---------|-------|
| I-01 | 962-966 | **Dead welcome message code.** `if (false && ...)` permanently disables the welcome message. Should be removed or re-enabled. |
| I-02 | 629-637 | **Unwired action options.** The "make-topic", "export-report", "create-sprint" commands are displayed as text but have no handler — they're not clickable and typing them does nothing. |
| I-03 | 259-265 | **`_escapeHtml` doesn't escape single quotes.** Not exploitable in current usage but limits reusability. |
| I-04 | 847-849 | **Local time in mutation timestamps.** `getHours()`/`getMinutes()`/`getSeconds()` use local time, not UTC. |

---

_Report generated: 2026-05-13_
_Reviewer: GSD Codebase Reviewer_
_File: phreak-terminal.js (1086 lines)_
