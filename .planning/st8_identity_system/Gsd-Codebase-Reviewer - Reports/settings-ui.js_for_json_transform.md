# settings-ui.js — Line-by-Line Review

**File:** `settings-ui.js` (339 lines)
**Reviewed:** 2026-05-13T20:20:00Z
**Status:** ISSUES FOUND — 2 Critical, 4 Warnings, 3 Info

---

## FILE HEADER

### Lines 1-9: Documentation Block
- **What this section does:** Declares the file as ST8 Settings Configuration UI. Lists 8 categories: Sirkits, Models, Shells, Voidflow, Keybindings, Theme, Storage, Network. Declares public API as `window.St8Settings`.
- **What triggers it:** File load (static declaration)
- **What it calls:** Nothing
- **What calls it:** `st8.html` line 1664: `<script src="settings-ui.js"></script>`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None — documentation only

### Line 11: `'use strict';`
- **What this section does:** Enables strict mode
- **Status:** WORKING
- **Gap:** None

---

## SETTINGS CATEGORIES

### Lines 13-24: `SETTINGS_CATEGORIES` Array
- **What this section does:** Defines 8 hardcoded category objects, each with `id`, `name`, `icon` (all `'◇'`), and `description`
- **What triggers it:** Module load (const declaration)
- **What it calls:** Nothing
- **What calls it:**
  - `renderSettingsPanel()` line 78 — iterates to build sidebar nav
  - `renderCategoryEntries()` line 99 — `.find()` to look up category
  - `showSettingsInExplorer()` line 313 — `.map()` to build explorer nav
  - `window.St8Settings.getCategories()` line 337 — public accessor
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** All icons are identical `'◇'` — no visual differentiation between categories

---

## SETTINGS STATE

### Lines 26-32: `settingsState` Object
- **What this section does:** Module-level mutable state holding:
  - `activeCategory: null` — currently selected category ID
  - `entries: {}` — loaded settings data keyed by category
  - `editingEntry: null` — declared but **NEVER READ OR WRITTEN TO** after initialization
- **What triggers it:** Module load (const declaration)
- **What it calls:** Nothing
- **What calls it:** Almost every function in the file reads/writes this
- **Dependencies:** None
- **Status:** PARTIAL
- **Gap:** `editingEntry` is dead state — declared but never used. This suggests the edit form was planned but never implemented. See `editEntry()` at line 217.

---

## DEFAULT SETTINGS

### Lines 34-66: `DEFAULT_SETTINGS` Object
- **What this section does:** Defines fallback values for all 8 categories:
  - `voidflow` (lines 37-45): object with `reveal_wpm: 200`, `word_atomic: true`, `pause_on_drag: true`, `buffer_trail_visible: true`, `reveal_curve: 'linear'`, `drift_rate_lines_per_sec: 0.25`, `cursor_metronome: true`
  - `sirkits` (line 46): `[]`
  - `models` (line 47): `[]`
  - `shells` (line 48): `[]`
  - `keybindings` (line 49): `[]`
  - `theme` (lines 50-54): `{ palette_overrides: {}, font_sizes: {}, spacing_scale: 1.0 }`
  - `storage` (lines 55-59): `{ sqlite_path: 'st8.sqlite', backup_schedule: 'daily', export_targets: [] }`
  - `network` (lines 60-65): `{ epo_bus_endpoint: 'ws://localhost:3847', ports: {}, proxies: [], websocket_retry_policy: 'exponential' }`
- **What triggers it:** Module load (const declaration)
- **What it calls:** Nothing
- **What calls it:**
  - `renderCategoryEntries()` line 102 — fallback when no loaded entries
  - `window.St8Settings.getDefaults()` line 338 — public accessor
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** **Duplicate defaults** — `settings-reader.js` line 17-25 defines `DEFAULT_VOIDFLOW` with identical values. These two systems are not synchronized. If one is updated and the other is not, defaults will diverge.

---

## SETTINGS RENDERING

### Lines 68-93: `renderSettingsPanel()`
- **What this section does:** Renders the full settings layout into `#settings-panel`. Creates:
  - Sidebar with category navigation buttons (lines 75-85)
  - Main content area with placeholder text (lines 87-90)
  - Sets `innerHTML` on the container (line 92)
- **What triggers it:**
  - `selectCategory()` line 158 — re-renders after category change
  - `showSettingsPopup()` line 251 — after loading settings
- **What it calls:** Nothing (pure rendering)
- **What calls it:** `selectCategory`, `showSettingsPopup`
- **Dependencies:**
  - `window.escapeHtml` — NOT used here (but used in `renderCategoryEntries`)
  - `SETTINGS_CATEGORIES` (line 15)
  - `settingsState.activeCategory` (line 29)
  - DOM element `#settings-panel`
- **Status:** WORKING
- **Gap:**
  - Uses `var` instead of `const`/`let` throughout — inconsistent with `'use strict'` intent
  - Inline `onclick` handlers reference `window.St8Settings.selectCategory` which requires the public API to be registered first — load order dependent
  - Category IDs are injected directly into onclick strings without sanitization (line 81) — safe here because `SETTINGS_CATEGORIES` is hardcoded, but fragile pattern

### Lines 95-152: `renderCategoryEntries(categoryId)`
- **What this section does:** Renders the content for a selected category into `#settings-main`. Two rendering paths:
  - **Array entries** (lines 109-122): For categories like sirkits, models — renders a list of entries with EDIT/DUPLICATE buttons and an ADD NEW button
  - **Object entries** (lines 123-149): For categories like voidflow, theme — renders a form with labeled inputs
    - Boolean: `<select>` with TRUE/FALSE (lines 133-137)
    - Number: `<input type="number">` with `parseFloat` (lines 138-140)
    - String: `<input type="text">` with `escapeHtml` (lines 141-144)
- **What triggers it:**
  - `selectCategory()` line 159 — when user clicks a category
  - `addEntry()` line 214 — after adding new entry
  - `duplicateEntry()` line 229 — after duplicating entry
- **What it calls:**
  - `escapeHtml()` (line 142) — defined in `st8.html` line 1655
  - `window.St8Settings.editEntry()` (line 116) — via onclick
  - `window.St8Settings.duplicateEntry()` (line 117) — via onclick
  - `window.St8Settings.addEntry()` (line 122) — via onclick
  - `window.St8Settings.updateValue()` (lines 134, 140, 143) — via onchange
- **What calls it:** `selectCategory`, `addEntry`, `duplicateEntry`
- **Dependencies:**
  - `window.escapeHtml` (global from `st8.html`)
  - `SETTINGS_CATEGORIES` (line 99)
  - `settingsState.entries` (line 102)
  - `DEFAULT_SETTINGS` (line 102)
  - DOM element `#settings-main`
- **Status:** **BROKEN** (XSS vulnerability)
- **Gaps:**
  - **CR-01 (BLOCKER): XSS on line 114** — Entry names are rendered directly into innerHTML without escaping:
    ```javascript
    '<span class="settings-entry-name">' + (entry.name || entry.id || 'Entry ' + (index + 1)) + '</span>'
    ```
    `entry.name` and `entry.id` come from user-created entries or backend data. A malicious entry like `{ name: '<img src=x onerror=alert(1)>' }` would execute JavaScript. **Fix:** Wrap with `escapeHtml()`:
    ```javascript
    '<span class="settings-entry-name">' + escapeHtml(entry.name || entry.id || 'Entry ' + (index + 1)) + '</span>'
    ```
  - **WR-01 (WARNING): No validation of entry structure** — Line 102 falls back to defaults if no entries exist, but doesn't validate that loaded entries have the expected shape. If the backend returns malformed data (e.g., a string instead of array for sirkits), `Array.isArray(entries)` at line 109 would be false, and the object-form renderer would be used instead, showing empty/wrong form.

---

## SETTINGS ACTIONS

### Lines 154-160: `selectCategory(categoryId)`
- **What this section does:** Sets `settingsState.activeCategory`, re-renders the full panel and category entries
- **What triggers it:** User clicking a category nav button (onclick in `renderSettingsPanel` line 81 or `showSettingsInExplorer` line 314)
- **What it calls:**
  - `renderSettingsPanel()` line 158
  - `renderCategoryEntries(categoryId)` line 159
- **What calls it:** `window.St8Settings.selectCategory` (public API line 331)
- **Dependencies:** `settingsState`, both render functions
- **Status:** WORKING
- **Gap:** None

### Lines 162-171: `updateValue(categoryId, key, value)`
- **What this section does:** Updates a key-value pair in `settingsState.entries[categoryId]`, persists to backend, logs to console
- **What triggers it:** `onchange` event on form inputs (lines 134, 140, 143)
- **What it calls:**
  - `_persistSetting(categoryId, key, value)` line 169
  - `console.info` line 170
- **What calls it:** `window.St8Settings.updateValue` (public API line 332)
- **Dependencies:** `settingsState`, `_persistSetting`
- **Status:** PARTIAL
- **Gap:**
  - **WR-02 (WARNING): Only works for object-type categories** — This function is only wired to the object-form renderer (voidflow, theme, storage, network). Array categories (sirkits, models, shells, keybindings) have no persistence mechanism for edits. `editEntry` is a stub. **Array entry changes are lost on page reload.**
  - No validation of `value` — NaN from `parseFloat` on invalid input (line 140) would be persisted as `NaN`
  - No UI feedback that the save succeeded or failed (only console logging)

### Lines 173-185: `_persistSetting(categoryId, key, value)`
- **What this section does:** Sends a POST request to `/api/settings` with `{ category, key, value }` as JSON body
- **What triggers it:** `updateValue()` line 169
- **What it calls:** `fetch('/api/settings', ...)` line 174
- **What calls it:** `updateValue()`
- **Dependencies:**
  - Backend server at `/api/settings` — handled by `backend/server.js` line 97 → `_handleSettings()` line 415
  - Backend persistence: `backend/persistence.js` → `upsertSetting()` line 486
- **Status:** PARTIAL
- **Gap:**
  - **WR-03 (WARNING): Data format mismatch for array categories** — Backend `upsertSetting()` stores `(category, key, value)` as individual rows in `st8_settings` table. But array categories like sirkits are conceptually arrays of objects, not key-value pairs. If `_persistSetting` were ever called for array entries, the backend would store them as `key: "0", value: '{"id":"...","name":"..."}'` instead of as a coherent array. When `loadSettings()` retrieves them via `getAllSettings()`, they come back as `{ sirkits: { "0": {...}, "1": {...} } }` — an object with numeric string keys, NOT an array. This breaks `Array.isArray()` at line 109, causing the wrong rendering path.
  - Fire-and-forget pattern — no retry, no user notification of failure (only console.warn)

### Lines 187-207: `loadSettings()`
- **What this section does:** Fetches all settings from `GET /api/settings`, merges loaded data into `settingsState.entries`. Returns a Promise.
- **What triggers it:**
  - `showSettingsPopup()` line 250
  - `showSettingsInExplorer()` line 323
- **What it calls:** `fetch('/api/settings')` line 188
- **What calls it:** Both show functions
- **Dependencies:**
  - Backend server: `backend/server.js` → `_handleSettings()` → `getAllSettings()` (line 429)
  - Backend persistence: `backend/persistence.js` → `getAllSettings()` line 511
- **Status:** PARTIAL
- **Gap:**
  - **WR-04 (WARNING): No re-render after load in showSettingsInExplorer** — `showSettingsInExplorer()` at line 323 calls `loadSettings()` but does NOT chain `.then()` to re-render the category nav or entries. If the user navigated to a category before the async load completes, the entries would be stale. The popup version (`showSettingsPopup` line 250) correctly chains `.then(function() { renderSettingsPanel(); })`, but the explorer version does not.
  - Merge strategy is shallow — `Object.keys(result.data).forEach(...)` at line 196 overwrites entire category objects. If the backend returns partial data, local unsaved changes would be lost.

### Lines 209-215: `addEntry(categoryId)`
- **What this section does:** Creates a new entry with `{ id: 'new-entry', name: 'New Entry' }` and pushes it to `settingsState.entries[categoryId]`. Re-renders.
- **What triggers it:** "ADD NEW" button click (line 122 onclick)
- **What it calls:** `renderCategoryEntries(categoryId)` line 214
- **What calls it:** `window.St8Settings.addEntry` (public API line 333)
- **Dependencies:** `settingsState`
- **Status:** **BROKEN** (data integrity issue)
- **Gap:**
  - **CR-02 (BLOCKER): Duplicate entry IDs** — Every new entry gets `id: 'new-entry'` (line 213). If the user adds multiple entries, all will have the same ID. This breaks:
    - `settings-reader.js` `upsertRow()` (line 82) — uses `findIndex(r => r.id === row.id)` which would only match the first entry
    - Any downstream logic that uses ID as a unique key
    - **Fix:** Generate unique IDs:
      ```javascript
      var newId = categoryId + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      settingsState.entries[categoryId].push({ id: newId, name: 'New Entry' });
      ```
  - **WR-05 (WARNING): Changes never persisted** — `addEntry()` modifies in-memory state only. There is no call to `_persistSetting()` or any backend save. The new entry exists only until page refresh. This is the same gap as WR-02.

### Lines 217-220: `editEntry(categoryId, index)`
- **What this section does:** Logs to console. That's it.
- **What triggers it:** "EDIT" button click (line 116 onclick)
- **What it calls:** `console.info` line 219
- **What calls it:** `window.St8Settings.editEntry` (public API line 334)
- **Dependencies:** None
- **Status:** **BROKEN** (not implemented)
- **Gap:**
  - **WR-06 (WARNING): Stub function** — Marked with `// TODO: Show edit form` (line 218). The EDIT button is rendered in the UI (line 116) but clicking it does nothing except log. Users can see the button, click it, and get no feedback. This is a misleading UI affordance.
  - `settingsState.editingEntry` (line 31) was declared for this purpose but is never used.

### Lines 222-231: `duplicateEntry(categoryId, index)`
- **What this section does:** Deep-copies an entry via `JSON.parse(JSON.stringify(entry))`, appends " (copy)" to the name, pushes to the entries array, re-renders.
- **What triggers it:** "DUPLICATE" button click (line 117 onclick)
- **What it calls:**
  - `JSON.parse(JSON.stringify(entry))` line 226 — deep clone
  - `renderCategoryEntries(categoryId)` line 229
- **What calls it:** `window.St8Settings.duplicateEntry` (public API line 335)
- **Dependencies:** `settingsState`
- **Status:** PARTIAL
- **Gap:**
  - Same persistence gap as WR-05 — changes are in-memory only
  - Same ID collision issue as CR-02 — the copy retains the original `id` (only `name` is modified at line 227), so two entries share the same ID

---

## SETTINGS POPUP

### Lines 233-253: `showSettingsPopup()`
- **What this section does:** Creates a full-screen overlay with a settings popup. Injects into `document.body`. Loads settings from backend, then renders the panel.
- **What triggers it:** `window.St8Settings.showSettingsPopup` (public API line 329)
- **What it calls:**
  - `document.createElement('div')` line 237
  - `document.body.appendChild(overlay)` line 247
  - `loadSettings()` line 250 — async, chains `.then()`
  - `renderSettingsPanel()` line 251 — inside `.then()`
- **What calls it:** No internal caller found — this is a public API entry point only. **No UI element in st8.html triggers it.** The phreak-terminal uses `showSettingsInExplorer()` instead (line 682-683 of `phreak-terminal.js`).
- **Dependencies:**
  - `loadSettings()`
  - `renderSettingsPanel()`
  - DOM (`document.body`, `#settings-panel`)
- **Status:** WORKING (but disconnected)
- **Gap:**
  - **IN-01 (INFO): Dead entry point** — No UI element in the codebase calls `showSettingsPopup()`. The phreak-terminal calls `showSettingsInExplorer()` instead. This function may be unreachable in normal usage.
  - Close button uses `this.closest('.settings-popup-overlay').remove()` (line 242) — works but uses inline onclick with `this` context

---

## SETTINGS IN EXPLORER

### Lines 255-324: `showSettingsInExplorer()`
- **What this section does:** Replaces the entire `#explorer-root` content with a custom explorer layout that includes:
  - Explorer sidebar with HOME, DOCUMENTS, DOWNLOADS, WORKSPACE, SETTINGS nav (lines 261-285)
  - Settings category nav inside the content area (lines 300-319)
  - Loads settings from backend (line 323)
- **What triggers it:**
  - `phreak-terminal.js` line 682-683: `_showSettings()` → `window.St8Settings.showSettingsInExplorer()`
  - Triggered by `data-action="show-settings"` click (phreak-terminal.js line 577)
- **What it calls:**
  - `document.getElementById('explorer-root')` line 258
  - `SETTINGS_CATEGORIES.map(...)` line 313
  - `loadSettings()` line 323 — **NOT chained with .then()**
- **What calls it:** `window.St8Settings.showSettingsInExplorer` (public API line 330)
- **Dependencies:**
  - `window.VoidFileExplorer._navTo` — **HARDCODED DEPENDENCY** (line 264, 268, 272)
  - `window.VoidFileExplorer._showWorkspacePicker` — **HARDCODED DEPENDENCY** (line 276)
  - `file-explorer.js` must be loaded and `window.VoidFileExplorer` must be registered
  - `SETTINGS_CATEGORIES` (line 313)
  - `settingsState` (line 314)
  - `loadSettings` (line 323)
  - DOM element `#explorer-root`
- **Status:** PARTIAL
- **Gap:**
  - **IN-02 (INFO): Hard coupling to VoidFileExplorer** — Lines 264, 268, 272, 276 directly reference `window.VoidFileExplorer._navTo` and `._showWorkspacePicker`. If `file-explorer.js` fails to load, these onclick handlers will throw `TypeError: Cannot read properties of undefined`. There is no guard check like `window.VoidFileExplorer && ...`.
  - **WR-07 (WARNING): loadSettings() not awaited** — Line 323 calls `loadSettings()` but does not chain `.then()` to re-render. Unlike `showSettingsPopup()` which chains properly (line 250-252), this version renders the nav first, then loads settings asynchronously. If the user clicks a category before settings finish loading, they'll see default/empty data.
  - **IN-03 (INFO): Explorer state destruction** — This function completely replaces `#explorer-root` innerHTML (line 296), destroying the file explorer's state (selected paths, current directory, etc.). When the user navigates away from SETTINGS back to HOME/DOCUMENTS, the explorer has to re-fetch everything from scratch. There is no way to "go back" to the previous explorer state.

---

## PUBLIC API

### Lines 326-339: `window.St8Settings`
- **What this section does:** Registers the public API on `window.St8Settings` with all functions and two accessor methods:
  - `showSettingsPopup` (line 329)
  - `showSettingsInExplorer` (line 330)
  - `selectCategory` (line 331)
  - `updateValue` (line 332)
  - `addEntry` (line 333)
  - `editEntry` (line 334)
  - `duplicateEntry` (line 335)
  - `loadSettings` (line 336)
  - `getCategories` (line 337) — returns `SETTINGS_CATEGORIES` array
  - `getDefaults` (line 338) — returns `DEFAULT_SETTINGS` object
- **What triggers it:** Module load (immediate assignment)
- **What it calls:** Nothing
- **What calls it:**
  - `phreak-terminal.js` line 682: `window.St8Settings.showSettingsInExplorer`
  - `st8.html` line 1664 loads this file
- **Dependencies:** All functions defined above
- **Status:** WORKING
- **Gap:**
  - Missing: `removeEntry` / `deleteEntry` — users can add and duplicate entries but cannot remove them
  - Missing: `resetCategory` — no way to restore defaults for a single category
  - Missing: `exportSettings` / `importSettings` — no backup/restore capability (though `settings-reader.js` has `export()`)

---

## CONNECTIONS MAP

### What triggers settings UI?
| Trigger | Source File | Line | Calls |
|---------|------------|------|-------|
| `data-action="show-settings"` click | `phreak-terminal.js` | 577 | `_showSettings()` → `St8Settings.showSettingsInExplorer()` |
| Phreak terminal `_showSettings()` | `phreak-terminal.js` | 681-688 | `St8Settings.showSettingsInExplorer()` |
| Category nav button click | `settings-ui.js` (rendered) | 81, 314 | `St8Settings.selectCategory(id)` |
| EDIT button click | `settings-ui.js` (rendered) | 116 | `St8Settings.editEntry(catId, idx)` — **STUB** |
| DUPLICATE button click | `settings-ui.js` (rendered) | 117 | `St8Settings.duplicateEntry(catId, idx)` |
| ADD NEW button click | `settings-ui.js` (rendered) | 122 | `St8Settings.addEntry(catId)` |
| Form input change | `settings-ui.js` (rendered) | 134, 140, 143 | `St8Settings.updateValue(catId, key, val)` |

### What other files get called?
| File | How Referenced | Line(s) | Purpose |
|------|---------------|---------|---------|
| `st8.html` | Script tag | 1664 | Loads `settings-ui.js`, defines `window.escapeHtml` |
| `file-explorer.js` | `window.VoidFileExplorer` | 264, 268, 272, 276 | Navigation in explorer-embedded settings |
| `backend/server.js` | `fetch('/api/settings')` | 174, 188 | REST API for persistence |
| `backend/persistence.js` | Via server.js | 486-520 | SQLite storage layer |
| `settings-reader.js` | **NOT connected** | — | Separate settings system (ES module, localStorage) |

### What are sirkits?
- **Definition:** "Spawnable surfaces in the void" (line 16)
- **In settings-ui.js:** Listed as a category, defaults to `[]` (empty array), rendered as an array-type entry list (line 109)
- **In settings-reader.js:** Same — `sirkits: []` (line 58), with `get sirkits()` accessor (line 66) and `upsertRow()` (line 80)
- **In fake-stream.js:** Line 19-37 — sirkits are described as spawnable surfaces that sit in the void; prose drifts around them via pretext; drag pauses reveal, release resumes
- **Connection to settings-ui:** The SIRKITS category allows adding/editing sirkits, but `editEntry` is a stub and changes aren't persisted

---

## @@@ HANDLING

**No `@@@` symbols found in settings-ui.js.**

The `@@@` pattern is used in other files:
- `file-explorer.js` line 465: `<span class="badge-ai-review">@@@</span>` — shown for files that need AI review
- `st8.html` line 1972: Same badge pattern for file list items
- `phreak-terminal.js`: No `@@@` usage

These `@@@` badges are a visual indicator that a file has been flagged for AI review by the intent/indexing system. They are NOT present in settings-ui.js.

---

## SUMMARY OF FINDINGS

### BLOCKER Issues (Must Fix)

**CR-01: XSS via unescaped entry names (line 114)**
- **File:** `settings-ui.js:114`
- **Issue:** Entry names rendered directly into innerHTML without `escapeHtml()`. If a sirkits entry has a malicious name like `<img src=x onerror=alert(document.cookie)>`, it will execute when the SIRKITS category is viewed.
- **Fix:**
  ```javascript
  // Line 114 — change:
  '<span class="settings-entry-name">' + (entry.name || entry.id || 'Entry ' + (index + 1)) + '</span>'
  // to:
  '<span class="settings-entry-name">' + escapeHtml(entry.name || entry.id || 'Entry ' + (index + 1)) + '</span>'
  ```

**CR-02: Duplicate entry IDs on add (line 213)**
- **File:** `settings-ui.js:213`
- **Issue:** Every added entry gets `id: 'new-entry'`. Multiple entries share the same ID, breaking any logic that uses ID as a unique key.
- **Fix:**
  ```javascript
  // Line 213 — change:
  settingsState.entries[categoryId].push({ id: 'new-entry', name: 'New Entry' });
  // to:
  var newId = categoryId + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  settingsState.entries[categoryId].push({ id: newId, name: 'New Entry' });
  ```

### WARNING Issues (Should Fix)

| ID | Line | Issue |
|----|------|-------|
| WR-01 | 102, 109 | No validation of loaded entries structure — wrong type breaks rendering |
| WR-02 | 162-171 | `updateValue` only works for object categories; array entries have no persistence |
| WR-03 | 173-185 | Backend persistence format mismatch for array categories |
| WR-04 | 323 | `loadSettings()` not chained with `.then()` in `showSettingsInExplorer()` |
| WR-05 | 209-215 | `addEntry` changes never persisted to backend |
| WR-06 | 217-220 | `editEntry` is a stub — EDIT button does nothing |
| WR-07 | 323 | Same as WR-04 (explorer version loads async without re-render) |

### INFO Issues (Nice to Fix)

| ID | Line | Issue |
|----|------|-------|
| IN-01 | 235-253 | `showSettingsPopup()` has no UI trigger — potentially unreachable |
| IN-02 | 264-276 | Hard coupling to `window.VoidFileExplorer` — no guard checks |
| IN-03 | 296 | Replacing `#explorer-root` destroys explorer state with no way back |

---

## DUAL SETTINGS SYSTEM CONFLICT

**Critical architectural issue:** There are TWO completely separate settings systems in this codebase:

| Aspect | `settings-ui.js` | `settings-reader.js` |
|--------|------------------|---------------------|
| Module system | Global (script tag) | ES module (`export class`) |
| Storage | REST API (`/api/settings` → SQLite) | `localStorage` |
| State | `settingsState` (module var) | `SettingsReader._data` (instance) |
| Defaults | `DEFAULT_SETTINGS` (lines 36-66) | `DEFAULT_VOIDFLOW` (lines 17-25) |
| Categories | 8 categories | 4 categories (voidflow, sirkits, models, shells) |
| API | `window.St8Settings` | `window.st8Settings` (lowercase) |
| Listeners | None | `on('change', cb)` event system |
| Used by | phreak-terminal.js, st8.html | Not clearly connected to any UI |

These systems are **NOT connected**. Changes made via the settings UI (REST/SQLite) are invisible to `settings-reader.js` (localStorage) and vice versa. The defaults overlap (voidflow values are identical) but are maintained independently.

---

_Reviewed: 2026-05-13T20:20:00Z_
_Reviewer: GSD-Codebase-Reviewer_
_Depth: standard_
