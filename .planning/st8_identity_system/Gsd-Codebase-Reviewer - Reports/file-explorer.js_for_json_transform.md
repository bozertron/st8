# file-explorer.js — Deep Line-by-Line Analysis

**File:** `/home/bozertron/1_AT_A_TIME/st8/file-explorer.js` (748 lines)
**Analyzed:** 2026-05-13T20:00:00Z
**Role:** Frontend file browser panel — mounts into `st8.html`, provides directory navigation, file selection, indexing, verification, and workspace switching.

---

## Section 1: Header Comment (Lines 1–13)

```
Lines 1-13: Module banner and feature list
```
- **What triggers it:** N/A (static comment)
- **What it calls:** Nothing
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** ✅ INFORMATIONAL
- **Gap:** None — accurate description of module purpose.

**Key claims in banner:**
- "WebSocket via EPO Bus (no REST fetch)" — **MISLEADING**: REST `/api/files` fallback exists at line 158. The banner says "no REST fetch" but the code explicitly uses REST as a fallback.
- "Dynamic workspace path (no hardcodes)" — **TRUE**: `_getWorkspacePath()` reads from `window.actu8Config.workspace`
- "Error display with retry (not silent)" — **TRUE**: Error banner at lines 308–316
- "Virtual scrolling for large directories" — **TRUE**: Lines 242–445
- "Hidden files toggle (persisted)" — **BROKEN**: `LS_SHOW_HIDDEN` is never defined (see Section 7)
- "Public API: window.VoidFileExplorer" — **TRUE**: Lines 726–747

---

## Section 2: `'use strict'` (Line 15)

```
Lines 15: Strict mode declaration
```
- **What triggers it:** Module load
- **What it calls:** Nothing
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** ✅ WORKING
- **Gap:** None

---

## Section 3: State Object (Lines 17–31)

```
Lines 17-31: explorerState — central mutable state
```
- **What triggers it:** Module load (const declaration)
- **What it calls:** Nothing
- **What calls it:** Every function in the module reads/writes this state
- **Dependencies:** None
- **Status:** ✅ WORKING

**Fields documented:**

| Line | Field | Type | Initial Value | Consumers |
|------|-------|------|---------------|-----------|
| 20 | `currentPath` | string | `'~'` | `_renderExplorer`, `explorerNavigate`, breadcrumbs |
| 21 | `entries` | array | `[]` | `_fetchViaWebSocket`, `_filterEntries`, `_renderExplorer` |
| 22 | `filteredEntries` | array | `[]` | `_renderStandardTable`, `_renderVirtualRows` |
| 23 | `isLoading` | boolean | `false` | `_renderExplorer` |
| 24 | `error` | object\|null | `null` | `_renderExplorer` error banner |
| 25 | `selectedPaths` | Set | `new Set()` | `_handleRowClick`, `_updateSelectionUI`, `_emitSelect` |
| 26 | `activeLocation` | string | `'HOME'` | sidebar nav active class |
| 27 | `onSelect` | fn\|null | `null` | `_emitSelect` |
| 28 | `showHidden` | boolean | `true` | `_toggleHidden`, `_filterEntries` |
| 29 | `workspaceType` | string | `'logic-analyzer'` | `_showWorkspacePicker`, `_selectWorkspace` |
| 30 | `indexedFingerprints` | object\|null | `null` | `getIndexedFingerprints`, `setIndexedFingerprints` |

- **Gap:** `showHidden` initialized to `true` but never reads from `localStorage` on load. The `_toggleHidden` function (line 178) writes to `LS_SHOW_HIDDEN` but the constant is never defined, so the toggle is completely broken.

---

## Section 4: Config Constants (Lines 33–37)

```
Lines 33-37: Virtual scroll configuration
```
- **What triggers it:** Module load
- **What it calls:** Nothing
- **What calls it:** `_renderExplorer` (line 268), `_renderVirtualTable` (line 403), `_renderVirtualRows` (lines 433–434)
- **Dependencies:** None
- **Status:** ✅ WORKING

| Line | Constant | Value | Purpose |
|------|----------|-------|---------|
| 35 | `VIRTUAL_SCROLL_THRESHOLD` | 100 | Entry count threshold to switch from standard to virtual rendering |
| 36 | `ROW_HEIGHT` | 32 | Pixels per row for virtual scroll calculations |
| 37 | `VIRTUAL_BUFFER` | 20 | Extra rows rendered above/below viewport |

- **Gap:** None

---

## Section 5: Comment — Hidden Files (Line 39)

```
Lines 39: Comment explaining hidden files always shown
```
- **What triggers it:** N/A
- **Status:** ✅ INFORMATIONAL (but contradicts the `_toggleHidden` function at line 178 which implies a toggle exists)

---

## Section 6: `_getWorkspacePath()` (Lines 43–50)

```
Lines 43-50: Dynamic workspace path resolver
```
- **What triggers it:** Called by `_buildLocations()` at line 53
- **What it calls:** Reads `window.actu8Config.workspace`
- **What calls it:** `_buildLocations` → `_getWorkspacePath`
- **Dependencies:** `window.actu8Config` (external — injected by actu8 runtime)
- **Status:** ⚠️ PARTIAL

**Flow:**
1. Line 45: Check `window.actu8Config && window.actu8Config.workspace`
2. Line 46: Return workspace path if set
3. Line 49: Fallback to `'~'`

- **Gap:** `_getWorkspacePath()` is called but its return value `wsPath` at line 53 is **never used** in `_buildLocations()`. The function body builds locations with hardcoded `'~'` paths (lines 55–58) and ignores `wsPath`. The WORKSPACE entry at line 58 has `path: null, isWorkspacePicker: true` — it doesn't use the resolved workspace path at all. This is **dead computation**.

---

## Section 7: `_buildLocations()` (Lines 52–60)

```
Lines 52-60: Build sidebar navigation locations
```
- **What triggers it:** Called by line 62 (`let LOCATIONS = _buildLocations()`) on module load, and by `explorerMount` at line 522
- **What it calls:** `_getWorkspacePath()` (result unused)
- **What calls it:** Module initialization, `explorerMount`
- **Dependencies:** None
- **Status:** ✅ WORKING (but `_getWorkspacePath` return is wasted)

**Locations returned:**
| Index | Name | Icon | Path | Special |
|-------|------|------|------|---------|
| 0 | HOME | ◇ | `~` | Standard nav |
| 1 | DOCUMENTS | ◇ | `~/Documents` | Standard nav |
| 2 | DOWNLOADS | ◇ | `~/Downloads` | Standard nav |
| 3 | WORKSPACE | ◈ | null | `isWorkspacePicker: true` — triggers `_showWorkspacePicker()` |

- **Gap:** `wsPath` variable at line 53 is assigned but never used. Dead code.

---

## Section 8: LOCATIONS Global (Line 62)

```
Line 62: let LOCATIONS = _buildLocations();
```
- **What triggers it:** Module load
- **Status:** ✅ WORKING
- **Gap:** Mutable `let` — reassigned in `explorerMount` (line 522). Could be `const` if no reassignment was needed.

---

## Section 9: `_getBreadcrumbs(path)` (Lines 66–79)

```
Lines 66-79: Generate breadcrumb trail from path string
```
- **What triggers it:** Called by `_renderExplorer` at line 264
- **What it calls:** Reads `window.actu8Config.homeDir`
- **What calls it:** `_renderExplorer`
- **Dependencies:** `window.actu8Config` (optional)
- **Status:** ⚠️ PARTIAL

**Flow:**
1. Line 67: If path is falsy or `'~'`, return single crumb `[{ name: '~', path: '~' }]`
2. Line 69: Get home dir from `window.actu8Config.homeDir` or fallback to `'~'`
3. Line 70: Replace leading `~` with home directory
4. Lines 71–78: Split by `/`, build accumulated paths

**Bug (Line 70–75):**
- When `actu8Config.homeDir` is not set, `home` = `'~'`
- `expanded = path.replace(/^~/, '~')` → path stays as-is (e.g., `~/Documents` stays `~/Documents`)
- `parts = expanded.split('/').filter(Boolean)` → `['~', 'Documents']`
- First iteration: `acc = '/~'` (line 75: `acc` is empty → `/${part}` = `/~`)
- Second iteration: `acc = '/~/Documents'`
- Breadcrumbs show `/~ › /Documents` instead of `~ › Documents`
- **The leading slash is wrong when tilde is not expanded.** Breadcrumb paths become `/~/Documents` which won't match the explorer's expected `~/Documents` format.

- **Gap:** When `actu8Config.homeDir` is not set (standalone mode), breadcrumb paths get a leading `/` prefix making them invalid for navigation. Clicking a breadcrumb would navigate to `/~/Documents` instead of `~/Documents`.

---

## Section 10: `_getIcon(entry)` (Lines 81–92)

```
Lines 81-92: Map file extension to emoji icon
```
- **What triggers it:** Called by `_renderRow` at line 460
- **What it calls:** Nothing
- **What calls it:** `_renderRow`
- **Dependencies:** None
- **Status:** ✅ WORKING

**Icon mapping:**
| Extension | Icon |
|-----------|------|
| (directory) | 📁 |
| md, txt | 📄 |
| js, ts, py, vue, rs | 📜 |
| png, jpg, svg, webp | 🖼 |
| json | `{}` |
| toml, yaml, yml | ⚙ |
| css | 🎨 |
| html | 🌐 |
| (other) | ◇ |

- **Gap:** Line 83 uses `entry.name.split('.').pop()?.toLowerCase()` — the optional chaining `?.` is unnecessary since `split()` always returns an array and `pop()` on a single-element array returns that element (never undefined in practice). Minor, no bug.

---

## Section 11: `_formatSize(bytes)` (Lines 94–101)

```
Lines 94-101: Format byte count to human-readable size
```
- **What triggers it:** Called by `_renderRow` at line 463
- **What it calls:** Nothing
- **What calls it:** `_renderRow`
- **Dependencies:** None
- **Status:** ✅ WORKING

**Edge cases:**
- `bytes == null` → returns `'—'` (loose equality catches both null and undefined)
- `bytes === 0` → returns `'0 B'`
- Otherwise: log-based calculation

- **Gap:** None — handles null/undefined/zero correctly.

---

## Section 12: `_formatDate(date)` (Lines 103–107)

```
Lines 103-107: Format date to locale string
```
- **What triggers it:** Called by `_renderRow` at line 464
- **What it calls:** `Date.toLocaleDateString()`, `Date.toLocaleTimeString()`
- **What calls it:** `_renderRow`
- **Dependencies:** None
- **Status:** ✅ WORKING

- **Gap:** If `date` is a non-Date truthy value that isn't parseable by `new Date()`, the function returns `"Invalid Date Invalid Date"`. No guard against invalid date strings.

---

## Section 13: `_filterEntries(entries)` (Lines 111–113)

```
Lines 111-113: Filter entries (currently a no-op passthrough)
```
- **What triggers it:** Called by `explorerNavigate` at line 139, `_toggleHidden` at line 183
- **What it calls:** Nothing
- **What calls it:** `explorerNavigate`, `_toggleHidden`
- **Dependencies:** None
- **Status:** ⚠️ PARTIAL — **Function is a no-op**

**The function returns `entries` unchanged.** Despite `explorerState.showHidden` existing and `_toggleHidden` modifying it, the filter function doesn't actually filter anything. The `showHidden` state field, the `_toggleHidden` function, and the `LS_SHOW_HIDDEN` localStorage key are all dead code paths.

- **Gap:** The hidden files toggle feature is completely non-functional:
  1. `_filterEntries` doesn't filter (line 112: `return entries`)
  2. `LS_SHOW_HIDDEN` constant is never defined (referenced at line 181)
  3. `_toggleHidden` would throw `ReferenceError` on `LS_SHOW_HIDDEN`
  4. `showHidden` is read by nothing

---

## Section 14: `explorerNavigate(path)` (Lines 117–144)

```
Lines 117-144: Main navigation function — loads directory contents
```
- **What triggers it:** 
  - `explorerMount` at line 525 (`explorerNavigate('~')`)
  - `_handleRowDblClick` at line 205 (double-clicking a directory)
  - `_selectWorkspace` at line 604
  - `_retry` at line 531
  - `_navTo` in public API at line 732
  - Breadcrumb clicks (onclick in rendered HTML, line 296, 301)
  - Sidebar nav clicks (onclick in rendered HTML, line 283)
- **What it calls:** `_fetchViaWebSocket(path)` at line 128, `_filterEntries(entries)` at line 139, `_renderExplorer()` at lines 122 and 143
- **What calls it:** Multiple UI interactions (see above)
- **Dependencies:** `_fetchViaWebSocket`, `_filterEntries`, `_renderExplorer`
- **Status:** ✅ WORKING

**Flow:**
1. Line 118: Clear selected paths
2. Line 119: Set current path
3. Line 120: Set loading state
4. Line 121: Clear error
5. Line 122: Re-render (shows loading spinner)
6. Line 128: Fetch entries via WebSocket (with REST fallback)
7. Lines 129–134: On error, set error state with `canRetry: true`
8. Lines 137–140: On success, update entries and filtered entries
9. Line 142: Clear loading state
10. Line 143: Re-render (shows entries or error)

- **Gap:** On fetch failure (line 137: `entries !== null` check), `explorerState.entries` and `explorerState.filteredEntries` are **not cleared**. The old directory contents remain visible behind the error banner. This could confuse users — they see stale files plus an error message.

---

## Section 15: `_fetchViaWebSocket(path)` (Lines 146–165)

```
Lines 146-165: Fetch directory listing — EPO WebSocket first, REST fallback
```
- **What triggers it:** Called by `explorerNavigate` at line 128
- **What it calls:** `window.epoClient.request('file_list', { path })` at line 150, `fetch('/api/files?path=...')` at line 158
- **What calls it:** `explorerNavigate`
- **Dependencies:** `window.epoClient` (optional, external), `/api/files` endpoint (backend/server.js:103)
- **Status:** ✅ WORKING (with known EPO limitation)

**Flow:**
1. Lines 148–155: Try EPO WebSocket first
   - Line 148: Check `window.epoClient && window.epoClient.connected`
   - Line 150: Send `file_list` request
   - Line 151: Return `res.entries || res` on success
   - Lines 152–154: On EPO failure, log warning and fall through to REST
2. Lines 157–164: REST fallback
   - Line 158: `fetch('/api/files?path=' + encodeURIComponent(path))`
   - Line 159: Check `response.ok`
   - Line 162: Parse JSON
   - Line 163: Check `data.error`
   - Line 164: Return `data.entries || []`

**Security (Line 158):**
- Path is properly URL-encoded via `encodeURIComponent(path)` — **no path traversal vulnerability** in the fetch URL itself. Server-side validation is the responsibility of `backend/server.js:_handleFileList`.

**Known Issue (from gap analysis docs):**
- `window.epoClient` is **never instantiated** in the codebase. The EPO path (lines 148–155) is effectively dead code in standalone mode. The REST fallback at line 158 is the actual working path.

- **Gap:** No timeout on `epoClient.request()`. If EPO hangs, the REST fallback never triggers. The `catch` at line 152 only fires on rejection, not on indefinite hang.

---

## Section 16: `_isNetworkError(err)` (Lines 167–174)

```
Lines 167-174: Detect network-related errors by message string matching
```
- **What triggers it:** **NOTHING — this function is never called**
- **What it calls:** Nothing
- **What calls it:** **DEAD CODE — no callers exist in the file**
- **Dependencies:** None
- **Status:** 🔴 NOT CONNECTED — **Dead code**

- **Gap:** This function is defined but never used anywhere in the file. It was likely intended to be called from `explorerNavigate`'s catch block to provide differentiated error messages, but was never wired up.

---

## Section 17: `_toggleHidden()` (Lines 178–185)

```
Lines 178-185: Toggle hidden files visibility
```
- **What triggers it:** `window.VoidFileExplorer._toggleHidden` (public API, line 743)
- **What it calls:** `_filterEntries` at line 183, `_renderExplorer` at line 184
- **What calls it:** Public API only — no UI button in the current render
- **Dependencies:** `LS_SHOW_HIDDEN` (UNDEFINED — **ReferenceError**)
- **Status:** 🔴 BROKEN — **Throws ReferenceError**

**Bug (Line 181):**
```javascript
localStorage.setItem(LS_SHOW_HIDDEN, String(explorerState.showHidden));
```
`LS_SHOW_HIDDEN` is **never defined** in this file. The constant was present in the original `maestro/file-explorer.js` (as noted in CONCERNS.md:14) but was stripped during the port. Calling `_toggleHidden()` will throw:
```
ReferenceError: LS_SHOW_HIDDEN is not defined
```

Additionally, even if the constant existed, `_filterEntries()` is a no-op (line 112), so toggling `showHidden` has no effect on displayed entries.

- **Gap:** 
  1. Add `const LS_SHOW_HIDDEN = 'void_explorer_showHidden';` after line 17
  2. Implement actual filtering in `_filterEntries`
  3. No UI button exists to trigger this function (the toggle was removed from the rendered HTML)

---

## Section 18: `_handleRowClick(e, path, isDirectory)` (Lines 189–201)

```
Lines 189-201: Handle single-click on file/directory row
```
- **What triggers it:** `onclick` handler on rendered table rows (line 456)
- **What it calls:** `_updateSelectionUI()` at line 200
- **What calls it:** `window.VoidFileExplorer._rowClick` (public API, line 739)
- **Dependencies:** `explorerState.selectedPaths`
- **Status:** ✅ WORKING

**Flow:**
1. Lines 190–195: If Ctrl/Meta held, toggle selection (add/remove from Set)
2. Lines 196–199: Otherwise, clear all selections and select only clicked item
3. Line 200: Update UI highlights

- **Gap:** The `isDirectory` parameter is accepted but **never used**. It's passed from the onclick handler (line 456) but the click logic is the same for files and directories. Not a bug, but dead parameter.

---

## Section 19: `_handleRowDblClick(path, isDirectory)` (Lines 203–209)

```
Lines 203-209: Handle double-click on file/directory row
```
- **What triggers it:** `ondblclick` handler on rendered table rows (line 457)
- **What it calls:** `explorerNavigate(path)` at line 205, `_emitSelect()` at line 207
- **What calls it:** `window.VoidFileExplorer._rowDblClick` (public API, line 740)
- **Dependencies:** `explorerNavigate`, `_emitSelect`
- **Status:** ✅ WORKING

**Flow:**
1. Line 204: If directory → navigate into it
2. Line 207: If file → emit selection (open/add to chat)

- **Gap:** None

---

## Section 20: `_emitSelect()` (Lines 211–226)

```
Lines 211-226: Emit selected file paths to callback or chat input
```
- **What triggers it:** 
  - `_handleRowDblClick` at line 207 (double-click on file)
  - "ADD TO CHAT" button click (line 357)
- **What it calls:** `explorerState.onSelect(paths)` at line 215, DOM manipulation at lines 219–221
- **What calls it:** `_handleRowDblClick`, public API `_emitSelect` (line 741)
- **Dependencies:** `explorerState.onSelect` callback, `document.getElementById('input')`
- **Status:** ✅ WORKING

**Flow:**
1. Line 212: Convert Set to Array
2. Line 213: If nothing selected, return early
3. Lines 214–215: If `onSelect` callback exists, call it with paths
4. Lines 217–222: Otherwise, inject paths into `#input` element as fallback
5. Lines 224–225: Clear selection and update UI

- **Gap:** The fallback at line 219 assumes an element with `id="input"` exists. This is the actu8 chat input. If the element doesn't exist (e.g., standalone mode), the fallback silently does nothing — paths are selected but lost.

---

## Section 21: `_updateSelectionUI()` (Lines 228–240)

```
Lines 228-240: Update visual selection state and footer count
```
- **What triggers it:** Called by `_handleRowClick` at line 200, `_emitSelect` at line 225
- **What it calls:** DOM queries and classList manipulation
- **What calls it:** `_handleRowClick`, `_emitSelect`
- **Dependencies:** DOM elements with class `explorer-file-row`, `#explorer-selection-info`, `#explorer-add-btn`
- **Status:** ✅ WORKING

**Flow:**
1. Lines 230–233: Toggle `selected` class on rows matching selected paths
2. Lines 235–239: Update footer info text and add button disabled state

- **Gap:** In virtual scroll mode (lines 425–445), `_renderVirtualRows()` replaces `innerHTML` of the content container. After virtual rows are re-rendered, the selection highlights from `_updateSelectionUI` would be lost because the DOM elements are recreated. No re-application of selection state after virtual scroll repaint.

---

## Section 22: Virtual Scroll State (Lines 242–248)

```
Lines 242-248: _virtualScroll state object
```
- **What triggers it:** Module load
- **Status:** ✅ WORKING

| Field | Initial | Purpose |
|-------|---------|---------|
| `scrollTop` | 0 | Current scroll position |
| `viewportHeight` | 0 | Visible area height |
| `useVirtual` | false | Whether virtual scrolling is active |

---

## Section 23: `_onVirtualScroll()` (Lines 250–256)

```
Lines 250-256: Scroll event handler for virtual scrolling
```
- **What triggers it:** Scroll event on `#explorer-vscroll` element (attached at line 374)
- **What it calls:** `_renderVirtualRows()` at line 255
- **What calls it:** Browser scroll event
- **Dependencies:** `#explorer-vscroll` DOM element
- **Status:** ✅ WORKING

- **Gap:** No debouncing or throttling. On rapid scrolling, `_renderVirtualRows()` fires on every scroll event, causing rapid DOM rewrites. For very large directories (1000+ entries), this could cause visible jank.

---

## Section 24: `_renderExplorer()` (Lines 260–378)

```
Lines 260-378: Main render function — builds entire explorer HTML
```
- **What triggers it:** 
  - `explorerNavigate` at lines 122 and 143
  - `_toggleHidden` at line 184
- **What it calls:** `_getBreadcrumbs` (line 264), `_renderVirtualTable` (line 331), `_renderStandardTable` (line 332), `_renderVirtualRows` (line 375)
- **What calls it:** `explorerNavigate`, `_toggleHidden`
- **Dependencies:** DOM element `#explorer-root`, `LOCATIONS` global, `escapeHtml` global
- **Status:** ✅ WORKING

**Subsections of the rendered HTML:**

### Lines 270–289: Sidebar Navigation
- Renders `LOCATIONS` as nav buttons
- Line 276–281: WORKSPACE picker button → calls `_showWorkspacePicker()`
- Lines 282–287: Standard nav buttons → calls `_navTo(name, path)`
- **Security note (line 283):** `escapeHtml(loc.path)` is used in the onclick handler. Since `loc.path` comes from `_buildLocations()` which returns hardcoded values (`'~'`, `'~/Documents'`, `'~/Downloads'`), this is safe. But the pattern of injecting into onclick strings is fragile — if paths ever contained single quotes, the onclick would break.

### Lines 293–305: Breadcrumbs
- Renders breadcrumb trail with navigation buttons
- Line 296: Root `/` button → `navigate('~')`
- Lines 297–303: Each crumb → `navigate(crumb.path)`
- **XSS protection:** `escapeHtml` used on both `crumb.path` (line 301) and `crumb.name` (line 302) ✅

### Lines 308–316: Error Banner
- Conditional on `explorerState.error`
- Line 311: Error message escaped via `escapeHtml` ✅
- Line 313: Retry button → `_retry()`

### Lines 319–333: Content Area
- Line 320–324: Loading state (spinner)
- Lines 325–329: Empty state
- Lines 330–332: Virtual or standard table based on entry count

### Lines 337–364: Footer
- Line 339: Item count
- Line 341: Selection info span
- Lines 342–347: VERIFY button (hidden by default, shown after indexing)
- Lines 348–352: INDEX button
- Lines 353–358: ADD TO CHAT button
- Lines 359–363: CREATE PRD button → `window.openPRDWizard()`

### Lines 370–377: Virtual Scroll Attachment
- Attaches scroll listener and does initial virtual render
- **Bug (Line 371):** `document.getElementById('explorer-vscroll')` — but the virtual scroll container is only created when `_virtualScroll.useVirtual` is true AND `!explorerState.isLoading`. If the condition at line 370 is true but the element doesn't exist yet (race condition), the listener is never attached.

- **Gap:** The entire HTML is rebuilt via `innerHTML` on every render. This destroys and recreates all DOM nodes, losing:
  1. Scroll position
  2. Selection highlights (re-applied by `_updateSelectionUI` but only when called)
  3. Virtual scroll event listeners (re-attached at line 374 but only for virtual mode)
  4. Focus state

---

## Section 25: `_renderStandardTable(entries)` (Lines 382–398)

```
Lines 382-398: Render table for ≤100 entries (no virtual scroll)
```
- **What triggers it:** `_renderExplorer` at line 332
- **What it calls:** `_renderRow(entry)` for each entry at line 394
- **What calls it:** `_renderExplorer`
- **Dependencies:** `_renderRow`
- **Status:** ✅ WORKING

- **Gap:** None

---

## Section 26: `_renderVirtualTable(entries)` (Lines 402–423)

```
Lines 402-423: Render virtual scroll container for >100 entries
```
- **What triggers it:** `_renderExplorer` at line 331
- **What it calls:** Nothing (creates container structure)
- **What calls it:** `_renderExplorer`
- **Dependencies:** `ROW_HEIGHT` constant
- **Status:** ✅ WORKING

**Structure:**
- Creates a scrollable container `#explorer-vscroll`
- Fixed-height spacer div (total entries × row height)
- Content div `#explorer-vscroll-content` for dynamic row injection

- **Gap:** The table header (lines 407–414) is inside the scrollable container, meaning it scrolls with the content. In virtual scroll mode, the header disappears as user scrolls down. Should be positioned fixed/sticky outside the scroll container.

---

## Section 27: `_renderVirtualRows()` (Lines 425–445)

```
Lines 425-445: Paint visible rows for virtual scrolling
```
- **What triggers it:** `_onVirtualScroll` at line 255, `_renderExplorer` at line 375
- **What it calls:** `_renderRow(entries[i])` at line 440
- **What calls it:** `_onVirtualScroll`, `_renderExplorer`
- **Dependencies:** `explorerState.filteredEntries`, `ROW_HEIGHT`, `VIRTUAL_BUFFER`
- **Status:** ✅ WORKING

**Flow:**
1. Line 427: Get container element
2. Lines 430–431: Get scroll position and viewport height
3. Lines 433–434: Calculate visible range with buffer
4. Line 436: Calculate offset for spacer
5. Lines 437–444: Build HTML with offset spacer and visible rows
6. Line 444: Replace container innerHTML

- **Gap:** 
  1. Line 444: `container.innerHTML = html` — full DOM replacement on every scroll. For smooth scrolling, `requestAnimationFrame` throttling would help.
  2. After virtual rows are re-rendered, any `_updateSelectionUI` highlights are lost (see Section 21 gap).

---

## Section 28: `_renderRow(entry)` (Lines 449–468)

```
Lines 449-468: Render a single table row (shared by standard and virtual)
```
- **What triggers it:** `_renderStandardTable` at line 394, `_renderVirtualRows` at line 440
- **What it calls:** `_getIcon(entry)` at line 460, `_formatSize(entry.size)` at line 463, `_formatDate(entry.modifiedAt)` at line 464, `escapeHtml()` multiple times
- **What calls it:** Standard and virtual table renderers
- **Dependencies:** `escapeHtml` global, `_getIcon`, `_formatSize`, `_formatDate`
- **Status:** ✅ WORKING

**Row structure:**
- `data-path`: Escaped entry path
- `data-is-dir`: Boolean
- `onclick`: `_rowClick(event, path, isDirectory)`
- `ondblclick`: `_rowDblClick(path, isDirectory)`
- Columns: Name (icon + name), Size, Modified, Purpose

**@@@ Handling (Line 465):**
```javascript
<td class="explorer-col-purpose">
  ${entry.intent && entry.intent.purpose ? escapeHtml(entry.intent.purpose) : ''}
  ${entry.needsAIReview ? ' <span class="badge-ai-review">@@@</span>' : ''}
</td>
```
- **Line 465:** If `entry.needsAIReview` is truthy, renders `<span class="badge-ai-review">@@@</span>`
- The `@@@` badge indicates a file that needs AI review
- The badge is styled with gold background (lines 486–494)
- This matches the same pattern in `st8.html:1972` where `@@@` badges appear in the file list

**Security:**
- `entry.path` → `escapeHtml` ✅
- `entry.name` → `escapeHtml` ✅
- `entry.intent.purpose` → `escapeHtml` ✅
- `entry.isDirectory` → injected directly into onclick (boolean, safe) ✅

- **Gap:** If `entry.path` contains a single quote (`'`), the onclick handler at line 456 would break because the path is wrapped in single quotes: `onclick="window.VoidFileExplorer._rowClick(event, '${escapeHtml(entry.path)}', ...)`. `escapeHtml` converts `'` to `&#39;` which would fix the HTML attribute but the JavaScript string would see `&#39;` literally, not a quote. This is safe from XSS but paths with quotes would produce incorrect behavior.

---

## Section 29: `_injectExplorerStyles()` (Lines 472–513)

```
Lines 472-513: Inject dynamic CSS for explorer-specific styles
```
- **What triggers it:** Called by `explorerMount` at line 518
- **What it calls:** DOM style element creation
- **What calls it:** `explorerMount`
- **Dependencies:** None
- **Status:** ✅ WORKING

**Styles injected:**
- `.explorer-col-purpose` — cyan color, italic, truncated with ellipsis
- `.badge-ai-review` — gold background, small bold text for @@@ badges
- `.explorer-prd-btn` — gold-bordered button for PRD creation
- `.explorer-prd-btn:hover` — gold fill on hover

**Guard (Line 473):** Checks for existing `#explorer-dynamic-styles` to prevent duplicate injection.

- **Gap:** None

---

## Section 30: `explorerMount(panelBodyEl, onSelect)` (Lines 517–526)

```
Lines 517-526: Mount the file explorer into a DOM element
```
- **What triggers it:** `st8.html:1678` — panel controller calls `window.VoidFileExplorer.mount(this.host, callback)`
- **What it calls:** `_injectExplorerStyles()` at line 518, `_buildLocations()` at line 522, `explorerNavigate('~')` at line 525
- **What calls it:** `st8.html` panel controller (line 1677–1680)
- **Dependencies:** `_injectExplorerStyles`, `_buildLocations`, `explorerNavigate`
- **Status:** ✅ WORKING

**Flow:**
1. Line 518: Inject CSS styles
2. Line 519: Store onSelect callback
3. Line 522: Rebuild LOCATIONS (refreshes in case config was set after module load)
4. Line 524: Create root container div
5. Line 525: Navigate to home directory

- **Gap:** `panelBodyEl.innerHTML = '<div id="explorer-root" class="explorer-root"></div>'` at line 524 — if `panelBodyEl` already has content, it's destroyed. The `st8.html` panel controller checks `this.mounted` (line 1676) to prevent re-mounting, so this is safe in practice.

---

## Section 31: `_retry()` (Lines 530–532)

```
Lines 530-532: Retry current path navigation
```
- **What triggers it:** "RETRY" button in error banner (line 313)
- **What it calls:** `explorerNavigate(explorerState.currentPath)` at line 531
- **What calls it:** `window.VoidFileExplorer._retry` (public API, line 743)
- **Dependencies:** `explorerNavigate`
- **Status:** ✅ WORKING

- **Gap:** None

---

## Section 32: `_showWorkspacePicker()` (Lines 536–592)

```
Lines 536-592: Display workspace type picker in main content area
```
- **What triggers it:** WORKSPACE nav button click (line 278)
- **What it calls:** Reads `explorerState.workspaceType`, renders workspace options
- **What calls it:** `window.VoidFileExplorer._showWorkspacePicker` (public API, line 734)
- **Dependencies:** `LOCATIONS` global, `explorerState.workspaceType`, `escapeHtml` global
- **Status:** ✅ WORKING

**Workspace options:**
| ID | Name | Description |
|----|------|-------------|
| `logic-analyzer` | Full Stack Logic Analyzer | Codebase connection analysis and debugging |
| `standard` | Standard | Default workspace with text drift surface |
| `pretext-dev` | Pretext Dev | Development environment for pretext engine |

**Flow:**
1. Line 537: Set active location to WORKSPACE
2. Line 540: Get explorer root container
3. Lines 543–547: Define workspace options
4. Lines 549–591: Build HTML with sidebar + workspace picker
5. Line 591: Replace container innerHTML

- **Gap:** 
  1. Lines 549–591: The HTML is built via string concatenation (not template literals like `_renderExplorer`). This is inconsistent with the rest of the file.
  2. Line 559: Uses `escapeHtml(loc.path)` in onclick — but `loc.path` could be `null` for the WORKSPACE entry. `escapeHtml(null)` returns `''` (empty string), so the onclick becomes `_navTo('WORKSPACE', '')`. This would call `explorerNavigate('')` which would fetch an empty path. However, the WORKSPACE entry has `isWorkspacePicker: true` so it takes the `if (loc.isWorkspacePicker)` branch at line 553 and never reaches line 559. Safe.

---

## Section 33: `_selectWorkspace(wsType)` (Lines 594–605)

```
Lines 594-605: Select a workspace type and return to HOME
```
- **What triggers it:** Workspace option click (line 577)
- **What it calls:** `window.st8WorkspaceChanged(wsType)` at line 600, `explorerNavigate('~')` at line 604
- **What calls it:** `window.VoidFileExplorer._selectWorkspace` (public API, line 735)
- **Dependencies:** `window.st8WorkspaceChanged` (defined in `st8.html:1888`)
- **Status:** ✅ WORKING

**Flow:**
1. Line 595: Set workspace type
2. Line 596: Reset active location to HOME
3. Lines 599–601: Notify UI via `st8WorkspaceChanged` callback
4. Line 604: Navigate to home

- **Gap:** None

---

## Section 34: `_setWorkspaceType(wsType)` (Lines 607–618)

```
Lines 607-618: Set workspace type programmatically (duplicate of _selectWorkspace)
```
- **What triggers it:** `window.VoidFileExplorer._setWorkspaceType` (public API, line 736)
- **What it calls:** `window.st8WorkspaceChanged(wsType)` at line 613, `explorerNavigate('~')` at line 617
- **What calls it:** External code via public API
- **Dependencies:** `window.st8WorkspaceChanged`
- **Status:** ✅ WORKING

**⚠️ Code Duplication:**
- `_setWorkspaceType` (lines 607–618) is **identical** to `_selectWorkspace` (lines 594–605). Same logic, same calls, same flow. This is 100% duplicate code.

- **Gap:** Remove one of the two functions and have the other call it. Both are exposed in the public API.

---

## Section 35: `_indexCodebase()` (Lines 622–671)

```
Lines 622-671: Index the current directory via POST /api/index
```
- **What triggers it:** "INDEX" button click (line 351)
- **What it calls:** `fetch('/api/index', ...)` at line 639, `window.st8IndexingComplete(targetPath)` at line 661
- **What calls it:** `window.VoidFileExplorer._indexCodebase` (public API, line 737)
- **Dependencies:** `/api/index` endpoint (backend/server.js:91), `window.st8IndexingComplete` (st8.html:2196)
- **Status:** ⚠️ PARTIAL — has known issues

**Flow:**
1. Lines 623–624: Get index button element
2. Lines 627–631: Validate current path (reject home dir)
3. Lines 634–636: Update button to "INDEXING..." state
4. Lines 639–643: POST to `/api/index` with current path
5. Line 645: Parse response
6. Lines 647–649: Check for errors
7. Line 651: Log success
8. Lines 654–657: Show VERIFY button
9. Lines 660–661: Call `st8IndexingComplete(targetPath)`
10. Lines 663–664: Log errors
11. Lines 666–670: Restore button state in finally block

**Known Issues (from gap analysis docs):**
- **Stale data:** `st8IndexingComplete` fetches from `/api/connection-state.json` which may contain stale startup data, not the freshly indexed data.
- The callback fires regardless of whether the indexing actually produced new data.

- **Gap:** 
  1. Line 651: `console.info('[st8] Indexed:', result.files, 'files')` — uses `console.info` (acceptable for debug)
  2. Lines 660–661: `st8IndexingComplete` is called after successful response, but the manifest it fetches may be stale
  3. No user-visible success feedback (only console log)

---

## Section 36: `_verifyCodebase()` (Lines 675–722)

```
Lines 675-722: Verify codebase integrity via POST /api/verify
```
- **What triggers it:** "VERIFY" button click (line 346)
- **What it calls:** `fetch('/api/verify', ...)` at line 692
- **What calls it:** `window.VoidFileExplorer._verifyCodebase` (public API, line 738)
- **Dependencies:** `/api/verify` endpoint (backend/server.js:100)
- **Status:** ⚠️ PARTIAL — no user-visible results

**Flow:**
1. Lines 676–677: Get verify button element
2. Lines 680–684: Validate current path
3. Lines 687–689: Update button to "VERIFYING..." state
4. Lines 692–696: POST to `/api/verify` with current path
5. Line 698: Parse response
6. Lines 700–702: Check for errors
7. Lines 705–713: Log results to console
8. Lines 714–715: Log errors
9. Lines 717–721: Restore button state

**Gap:**
- Lines 705–713: Verification results (summary, issues, critical issues) are **only logged to console**. No UI feedback is shown to the user. The user clicks VERIFY, sees "VERIFYING..." briefly, then the button returns to "VERIFY" with no indication of pass/fail.
- Line 706: `issues.some(i => i.severity === 'CRITICAL')` — if `issues` is undefined or not an array, this throws. No null check on `issues`.

---

## Section 37: Public API (Lines 726–747)

```
Lines 726-747: window.VoidFileExplorer — public API surface
```
- **What triggers it:** Module load
- **What it calls:** Nothing (just exports)
- **What calls it:** `st8.html`, `phreak-terminal.js`, `settings-ui.js`
- **Dependencies:** None
- **Status:** ✅ WORKING

**Exported API:**

| Property | Type | Internal Function | Line |
|----------|------|-------------------|------|
| `mount` | function | `explorerMount` | 728 |
| `navigate` | function | `explorerNavigate` | 729 |
| `_navTo` | function | inline (sets location + navigate) | 730–733 |
| `_showWorkspacePicker` | function | `_showWorkspacePicker` | 734 |
| `_selectWorkspace` | function | `_selectWorkspace` | 735 |
| `_setWorkspaceType` | function | `_setWorkspaceType` | 736 |
| `_indexCodebase` | function | `_indexCodebase` | 737 |
| `_verifyCodebase` | function | `_verifyCodebase` | 738 |
| `_rowClick` | function | `_handleRowClick` | 739 |
| `_rowDblClick` | function | `_handleRowDblClick` | 740 |
| `_emitSelect` | function | `_emitSelect` | 741 |
| `_toggleHidden` | function | `_toggleHidden` | 742 |
| `_retry` | function | `_retry` | 743 |
| `getWorkspaceType` | function | inline arrow | 744 |
| `getIndexedFingerprints` | function | inline arrow | 745 |
| `setIndexedFingerprints` | function | inline arrow | 746 |

**Consumers:**
- `st8.html:1677–1680`: `VoidFileExplorer.mount()`
- `st8.html:1999–2000`: `VoidFileExplorer.getIndexedFingerprints()`
- `st8.html:2181–2182`: `VoidFileExplorer.setIndexedFingerprints()`
- `phreak-terminal.js:600–601`: `VoidFileExplorer.getIndexedFingerprints()`
- `phreak-terminal.js:662–663`: `VoidFileExplorer.getIndexedFingerprints()`
- `phreak-terminal.js:715–716`: `VoidFileExplorer.getIndexedFingerprints()`
- `settings-ui.js:264`: `VoidFileExplorer._navTo()`

- **Gap:** None — API surface is complete and well-connected.

---

## External Dependencies Map

| Dependency | Type | Defined In | Required? | Status |
|------------|------|------------|-----------|--------|
| `window.escapeHtml` | global function | `st8.html:1655–1659` | **YES** | ✅ Defined before `file-explorer.js` loads (st8.html:1661) |
| `window.epoClient` | global object | External (actu8 runtime) | Optional | ⚠️ Never instantiated in codebase — EPO path is dead |
| `window.actu8Config` | global object | External (actu8 runtime) | Optional | ⚠️ Never set in standalone mode — falls back to defaults |
| `window.st8WorkspaceChanged` | global function | `st8.html:1888` | Optional | ✅ Defined |
| `window.st8IndexingComplete` | global function | `st8.html:2196` | Optional | ✅ Defined |
| `window.openPRDWizard` | global function | `st8.html:1792` | Optional | ✅ Defined |
| `/api/files` | REST endpoint | `backend/server.js:103` | **YES** | ✅ Handler exists |
| `/api/index` | REST endpoint | `backend/server.js:91` | For INDEX button | ✅ Handler exists |
| `/api/verify` | REST endpoint | `backend/server.js:100` | For VERIFY button | ✅ Handler exists |

---

## @@@ Symbol Documentation

| Location | Context | Rendered As |
|----------|---------|-------------|
| **Line 465** | `entry.needsAIReview ? ' <span class="badge-ai-review">@@@</span>' : ''` | Gold badge with `@@@` text next to file purpose column |
| **st8.html:1972** | `file.needsAIReview ? ' <span class="badge-ai-review">@@@</span>' : ''` | Same badge in file list view |

**Purpose:** The `@@@` badge marks files that need AI review. It's a visual indicator that `entry.needsAIReview` (or `file.needsAIReview`) is true. The badge is styled with:
- Gold background (`var(--gold)`)
- Dark text (`var(--void)`)
- Small font (9px)
- Bold weight
- Rounded corners (3px)

---

## Summary of All Issues Found

### 🔴 BLOCKER Issues

| ID | Line | Issue |
|----|------|-------|
| B1 | 181 | `LS_SHOW_HIDDEN` is undefined — `_toggleHidden()` throws `ReferenceError` |
| B2 | 111–113 | `_filterEntries()` is a no-op — hidden files toggle feature is completely broken |

### ⚠️ WARNING Issues

| ID | Line | Issue |
|----|------|-------|
| W1 | 66–79 | `_getBreadcrumbs()` produces paths with leading `/` when `actu8Config.homeDir` is not set |
| W2 | 117–144 | `explorerNavigate()` doesn't clear old entries on error — stale files visible behind error banner |
| W3 | 146–165 | No timeout on `epoClient.request()` — can hang indefinitely, blocking REST fallback |
| W4 | 167–174 | `_isNetworkError()` is dead code — never called |
| W5 | 607–618 | `_setWorkspaceType()` is 100% duplicate of `_selectWorkspace()` |
| W6 | 675–722 | `_verifyCodebase()` only logs results to console — no user-visible feedback |
| W7 | 705–706 | `issues.some()` in `_verifyCodebase()` has no null check — crashes if `issues` is undefined |
| W8 | 260–378 | `_renderExplorer()` rebuilds entire DOM via innerHTML on every render — destroys scroll position and focus |

### ℹ️ INFO Issues

| ID | Line | Issue |
|----|------|-------|
| I1 | 43–50 | `_getWorkspacePath()` return value unused in `_buildLocations()` |
| I2 | 53 | `wsPath` variable assigned but never read |
| I3 | 189 | `isDirectory` parameter unused in `_handleRowClick()` |
| I4 | 242–256 | Virtual scroll has no debouncing/throttling |
| I5 | 370–377 | Virtual scroll listener re-attached on every `_renderExplorer` call |
| I6 | 402–423 | Virtual table header scrolls with content (not sticky) |
| I7 | 1–13 | Banner says "no REST fetch" but REST fallback exists at line 158 |

---

_Report generated: 2026-05-13T20:00:00Z_
_Analyzer: GSD Codebase Reviewer_
_File: file-explorer.js (748 lines)_
