## RT-2 Verification Report Complete

**Status: ⚠️ CONDITIONAL PASS**

### Summary of Findings

All **7 integration points** verified and properly wired:

| # | Integration Point | File:Lines | Status |
|---|-------------------|------------|--------|
| 1 | Watcher Init | `index.js:122-151` | ✅ PASS |
| 2 | Event Handler | `fileWatcher.js:76-78` | ✅ PASS |
| 3 | Debounce | `fileWatcher.js:87-112` | ✅ PASS |
| 4 | Callback Processing | `index.js:124-148` | ✅ PASS |
| 5 | SHA-256 Hash Compare | `index.js:133-141` | ✅ PASS |
| 6 | Persistence Update | `persistence.js:135-152` | ✅ PASS |
| 7 | Manifest Regeneration | `manifestGenerator.js:134-154` | ✅ PASS |

### Signal Path Verified
```
chokidar event → _onFileChange() → debounce 500ms → _flush() 
→ onFileChange callback → SHA-256 compare → upsertFile() → writeManifests()
```

### Critical Issue Found

**🔴 BUG: `unlink` events will crash** — `readFileSync()` on deleted files throws `ENOENT` inside an `async` callback, creating an unhandled Promise rejection. No unlink-specific handling exists in the callback.

### Other Issues
- 🟡 New files (`add` events) silently skipped — not added to index
- 🟡 `pendingChanges` Set doesn't deduplicate objects (uses reference equality)
- 🟢 Manifests regenerated even when no content changed

### Full Report
Written to: `/home/bozertron/1_AT_A_TIME/st8/RT-2-VERIFICATION-REPORT.md`

Now I have a complete picture of the entire end-to-end flow. Let me write the structured report.

---

## End-to-End Indexing Flow — Verification Report

### Integration Points Verified

#### ✅ 1. Trigger: `file-explorer.js:561-603` — `_indexCodebase()`
- **Status:** EXISTS, properly wired to INDEX button (`#explorer-index-btn`, line 344)
- **Code:** Lines 561-603 — async function gets `targetPath` from `explorerState.currentPath`, sets button to "INDEXING...", calls `PhreakTerminal.execute('index ' + targetPath)`, then calls `st8IndexingComplete(targetPath)`
- **Note:** Calls `st8IndexingComplete` in the `try` block AFTER `execute` returns — this fires regardless of whether indexing actually succeeded (PhreakTerminal.execute catches its own errors and doesn't re-throw)

#### ✅ 2. API Endpoint: `backend/server.js:220-233` — `POST /api/index` → `_handleIndex()`
- **Status:** EXISTS, properly implemented
- **Code:** Calls `indexDirectory(this.targetDir, { write: true })` then `writeManifests(result.files, this.targetDir)`, returns `{ status: 'ok', files: N }`
- **Route registered:** Line 94-95 in `_handleApiRequest` switch statement
- **⚠️ CRITICAL ISSUE:** This endpoint is **never called from the frontend**. See signal path analysis below.

#### ✅ 3. Orchestrator: `backend/index.js:64-115` — Startup `indexDirectory()` → `writeManifests()`
- **Status:** EXISTS, wired correctly for startup flow
- **Code:** Line 64 calls `indexDirectory(targetDir, { write: true })`, lines 70-80 persist each file via `persistence.upsertFile()`, lines 83-100 wire connections, lines 113-114 call `writeManifests()`
- **Note:** This is the startup path (`node backend/index.js <dir> --serve`). It works correctly. The issue is the runtime re-index path via the INDEX button.

#### ✅ 4. File Discovery: `backend/indexer.js:136-162` — `discoverFiles()`
- **Status:** EXISTS, properly implemented
- **Code:** Recursive `walk()` using `fs.readdirSync`, filters by `CODE_EXTENSIONS` (`.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.py`, `.rs`, `.go`), skips `IGNORE_DIRS` (`node_modules`, `.git`, `dist`, `build`, `.venv`, `venv`, `__pycache__`)

#### ✅ 5. Hashing: `backend/indexer.js:166-176` — `hashFile()`
- **Status:** EXISTS, properly implemented
- **Code:** `crypto.createHash('sha256').update(content).digest('hex')` — returns hex SHA-256 fingerprint

#### ✅ 6. Parsing: `backend/indexer.js:180-204` — `parseImports()`
- **Status:** EXISTS, properly implemented with fallback chain
- **Code:** Tries `astParser.extractImportsAndExports(filePath)` first, falls back to `astParser.extractFromText(content)`, returns `[]` if neither available

#### ✅ 7. Classification: `backend/indexer.js:208-257` — `buildGraph()` / `classifyBasic()`
- **Status:** EXISTS, properly implemented with fallback
- **Code:** `buildGraph()` tries `graphBuilder.buildDependencyGraph(targetDir)`, falls back to `classifyBasic()`. `classifyBasic()` marks files as GREEN if imported by another file, RED otherwise.

#### ✅ 8. Persistence: `backend/persistence.js:135-152` — `upsertFile()`
- **Status:** EXISTS, properly implemented
- **Code:** `INSERT OR REPLACE INTO file_registry` with all fields (fingerprint, filepath, filename, sha256_hash, file_size_bytes, status, reachability_score, impact_radius, last_modified)

#### ✅ 9. Manifest: `backend/manifestGenerator.js:134-154` — `writeManifests()`
- **Status:** EXISTS, properly implemented
- **Code:** Writes `connection-state.json` (via `generateConnectionState()`) and `ai-signal.toml` (via `generateAiSignalToml()`) to `targetDir`

#### ✅ 10. Frontend Response: `st8.html:1793-1800` — `st8IndexingComplete()`
- **Status:** EXISTS, properly wired
- **Code:** Calls `fetchManifest(targetPath)` → fetches `/api/connection-state.json` → if manifest has files, calls `renderFileList(manifest.files)` and `VoidFileExplorer.setIndexedFingerprints(manifest)`
- `renderFileList` (line 1565) renders file list with GREEN/YELLOW/RED status dots

---

### Signal Path Trace

#### Path A: Startup Indexing ✅ WORKS
```
start.js → node backend/index.js <dir> --serve
  → indexDirectory(targetDir)          [indexer.js:302]
    → discoverFiles()                   [indexer.js:136]
    → hashFile() per file               [indexer.js:168]
    → parseImports() per file           [indexer.js:180]
    → buildGraph() → classifyBasic()    [indexer.js:208/228]
    → generateManifest()                [indexer.js:261]
    → writeManifest()                   [indexer.js:288] — writes connection-state.json
  → persistence.upsertFile() per file   [persistence.js:135]
  → writeManifests()                    [manifestGenerator.js:134] — writes connection-state.json + ai-signal.toml
  → St8Server.start()                   [server.js start]
```

#### Path B: INDEX Button Click ⚠️ BROKEN LINK
```
[User clicks INDEX]
  → _indexCodebase()                    [file-explorer.js:561]
    → PhreakTerminal.execute('index /path')  [file-explorer.js:580]
      → [EPO path] epoClient.request('exec', {command: 'index /path'})  [phreak-terminal.js:70]
      → [Fallback] fetch('/api/exec', {body: {command: 'index /path'}}) [phreak-terminal.js:90]
        → _handleExec()                 [server.js:203]
          → execSync('index /path')     [server.js:210] ← ⚠️ RUNS AS SHELL COMMAND
            → FAILS: 'index' is not a valid shell command
            → Returns {stdout:'', stderr:'...'} with error
      → PhreakTerminal displays stderr   [phreak-terminal.js:101-104]
    → st8IndexingComplete(targetPath)    [file-explorer.js:591] ← FIRES REGARDLESS
      → fetchManifest(targetPath)        [st8.html:1797]
        → fetch('/api/connection-state.json')  [st8.html:1812]
          → _serveManifest()            [server.js:145]
            → reads connection-state.json from disk ← RETURNS STALE DATA FROM STARTUP
      → renderFileList(manifest.files)   [st8.html:1799]
      → VoidFileExplorer.setIndexedFingerprints(manifest)  [st8.html:1802]
```

**The `/api/index` endpoint (server.js:220-233) which properly calls `indexDirectory()` + `writeManifests()` is NEVER invoked by the frontend.** The frontend routes through `PhreakTerminal → /api/exec → execSync()` which tries to run `index /path` as a raw shell command.

---

### Issues Found

| # | Severity | File:Line | Issue |
|---|----------|-----------|-------|
| 1 | **CRITICAL** | `file-explorer.js:580` → `server.js:210` | INDEX button sends `'index /path'` to `/api/exec` which runs it via `execSync()`. The `index` command is not a valid shell command. The proper `/api/index` endpoint exists but is never called. Re-indexing via the UI button does not work. |
| 2 | **MEDIUM** | `file-explorer.js:590-591` | `st8IndexingComplete()` fires regardless of whether indexing succeeded — the UI shows stale manifest data from startup indexing, giving a false impression that re-indexing worked. |
| 3 | **LOW** | `server.js:203-218` | `_handleExec()` runs arbitrary shell commands via `execSync()` with no sanitization — security risk beyond just the indexing issue. |
| 4 | **LOW** | `indexer.js:360` + `index.js:114` + `server.js:226` | Triple manifest generation: `indexDirectory()` writes manifest internally, `backend/index.js` calls `writeManifests()` again, and `_handleIndex()` also calls `writeManifests()`. Redundant but not broken. |

---

### Status: **FAIL** — 1 Critical Issue

**The INDEX button does not trigger actual re-indexing.** The signal path has a broken link between the frontend trigger and the backend indexer. The frontend routes through `PhreakTerminal → /api/exec → execSync('index /path')` which fails because `index` is not a shell command. The proper `/api/index` endpoint exists and works correctly, but nothing in the frontend calls it.

**Recommended fix:** Either:
- (A) Change `_indexCodebase()` in `file-explorer.js` to call `fetch('/api/index', { method: 'POST' })` directly instead of routing through PhreakTerminal, OR
- (B) Have the PhreakTerminal or EPO server recognize the `index` command and route it to the `/api/index` endpoint, OR
- (C) Add a shell script wrapper named `index` that calls `node backend/indexer.js`

Now I have complete picture of the signal path. Here is my structured report:

---

# Task RT-3: Notes Save → SQLite → Manifest — Integration Report

## Signal Path Trace

```
UI Button "Notes" (st8.html:1593)
  → window.handleFileNotes(filepath) (st8.html:1603-1605)
    → showNotesPopup(filepath) (st8.html:1705-1743)
      [reads existing intent from in-memory manifest via VoidFileExplorer.getIndexedFingerprints()]
      [renders overlay with 3 textareas: #notes-purpose, #notes-depends, #notes-value]
      → SAVE button → window.saveFileNotes(filepath) (st8.html:1747-1790)
        [reads form values from DOM]
        [updates in-memory manifest: fileData.intent = {...}]
        → fetch('/api/file-intent', POST) (st8.html:1768-1783)
          → server.js route /api/file-intent (server.js:97-98)
            → _handleFileIntent(req, res) (server.js:236-270)
              → persistence.upsertIntent({...}) (persistence.js:194-207)
                → SQLite INSERT OR REPLACE INTO file_intent
              → persistence.logActivity({...}) (persistence.js:216-228)
                → SQLite INSERT INTO activity_log
              → res 200 { status: 'ok', fingerprint }
```

## Integration Point Verification

### 1. Popup UI — `showNotesPopup(filepath)` (st8.html:1705-1743)
**Status: ✅ PASS**
- Creates overlay with `notes-popup-overlay` class
- Pre-populates fields from in-memory manifest intent data
- Uses `escapeHtml()` for XSS protection on all user-supplied values (st8.html:1726, 1730, 1734, 1739)
- Close button removes overlay (line 1721)
- Cancel button removes overlay (line 1738)
- Save button calls `window.saveFileNotes(filepath)` (line 1739)

### 2. Form Fields (st8.html:1724-1735)
**Status: ✅ PASS**
- `#notes-purpose` textarea — stores `purpose` (line 1726)
- `#notes-depends` textarea — stores `dependsOnBehavior` (line 1730)
- `#notes-value` textarea — stores `valueStatement` (line 1734)
- All pre-populated with `escapeHtml(intent.field || '')`

### 3. Save Handler — `window.saveFileNotes(filepath)` (st8.html:1747-1790)
**Status: ✅ PASS (writes), ⚠️ ISSUE (read-back)**
- Reads form values correctly (lines 1748-1750)
- Updates in-memory manifest (lines 1759-1765)
- Sends POST to `/api/file-intent` with correct payload structure (lines 1768-1776)
- Payload: `{ fingerprint: fileData.sha256Hash, purpose, dependsOnBehavior, valueStatement }`
- Closes popup after save (lines 1788-1789)
- **Does NOT reload manifest after save** (see Issues section)

### 4. API Route Registration (server.js:97-98)
**Status: ✅ PASS**
- `case '/api/file-intent':` correctly routes to `_handleFileIntent`

### 5. Backend Handler — `_handleFileIntent(req, res)` (server.js:236-270)
**Status: ✅ PASS**
- Parses JSON body correctly (line 241)
- Destructures `{ fingerprint, purpose, dependsOnBehavior, valueStatement }` (line 241)
- Initializes persistence (line 245)
- Calls `upsertIntent` with correct field mapping + `authoredBy: 'USER'` (lines 246-252)
- Calls `logActivity` with `source: 'USER_UI'`, `action: 'NOTE_ADDED'` (lines 254-259)
- Returns `{ status: 'ok', fingerprint }` (line 264)

### 6. SQLite Upsert — `upsertIntent(intent)` (persistence.js:194-207)
**Status: ✅ PASS**
- Uses `INSERT OR REPLACE INTO file_intent` (line 196)
- Maps camelCase JS fields to snake_case DB columns correctly:
  - `intent.fingerprint` → `fingerprint`
  - `intent.purpose` → `purpose`
  - `intent.dependsOnBehavior` → `depends_on_behavior`
  - `intent.valueStatement` → `value_statement`
  - `intent.authoredBy` → `authored_by`
- Sets `last_updated = CURRENT_TIMESTAMP` (line 198)

### 7. Activity Logging — `logActivity(activity)` (persistence.js:216-228)
**Status: ✅ PASS**
- Inserts into `activity_log` with correct columns (lines 217-220)
- Serializes `details` as JSON string (line 226)
- Fields: `source='USER_UI'`, `action='NOTE_ADDED'`, `targetFingerprint`, `details`

### 8. `file_intent` Table Schema (persistence.js:73-81)
**Status: ✅ PASS**
```sql
CREATE TABLE IF NOT EXISTS file_intent (
  fingerprint TEXT PRIMARY KEY,
  purpose TEXT,
  depends_on_behavior TEXT,
  value_statement TEXT,
  authored_by TEXT DEFAULT 'INFERRED',
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
)
```
- Schema matches the data being inserted
- Foreign key to `file_registry` present

### 9. `activity_log` Table Schema (persistence.js:83-90)
**Status: ✅ PASS**
```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'INDEXER',
  action TEXT NOT NULL,
  target_fingerprint TEXT,
  details TEXT
)
```

### 10. Helper Functions
**Status: ✅ PASS**
- `escapeHtml()` defined at st8.html:1402-1406 — handles `&`, `<`, `>`, `"`, `'`
- `VoidFileExplorer.getIndexedFingerprints()` at file-explorer.js:661 — returns `explorerState.indexedFingerprints`
- `VoidFileExplorer.setIndexedFingerprints()` at file-explorer.js:662 — sets state

## Issues Found

### ISSUE 1: Manifest not regenerated after intent save (MEDIUM)
**File:** backend/server.js:236-270
**Problem:** `_handleFileIntent` saves intent to SQLite but does NOT call `writeManifests()` to regenerate `connection-state.json`. The manifest on disk retains stale (empty) intent data.
**Impact:** After page reload, the manifest served by `_serveManifest` (server.js:145-167) returns intent with empty values. User notes are only visible in the current session (in-memory state).

### ISSUE 2: Indexer doesn't load intent from SQLite into manifest (MEDIUM)
**File:** backend/indexer.js:273-282
**Problem:** `generateManifest()` maps files without reading `file_intent` from SQLite. The file objects from the indexer never include `intent` data. The `manifestGenerator.js:generateConnectionState` (line 66) does include `f.intent || { ... }` but `f.intent` is always `undefined` since the indexer never attaches it.
**Impact:** Even if manifest is regenerated (e.g., on re-index), previously saved intent data from SQLite is lost.

### ISSUE 3: Frontend doesn't reload manifest after save (LOW)
**File:** st8.html:1747-1790
**Problem:** `saveFileNotes()` updates in-memory manifest and sends API call, but does NOT call `fetchManifest()` or `renderFileList()` to refresh the UI with updated data.
**Impact:** Minor — the in-memory state is updated, so the data is consistent within the session. But if other UI components re-render from manifest data, they won't see the update.

## Additional Checks

### Does the manifest regenerate after note save?
**NO.** `_handleFileIntent` (server.js:236-270) only persists to SQLite and returns. No `writeManifests()` call.

### Does the frontend reload manifest after save?
**NO.** `saveFileNotes` (st8.html:1747-1790) closes the popup but doesn't call `fetchManifest()`.

### Is the file_intent table schema correct?
**YES.** Schema (persistence.js:73-81) has all required columns with correct types and defaults. Foreign key to `file_registry` is present.

## Summary

| # | Integration Point | File:Line | Status |
|---|---|---|---|
| 1 | Notes popup UI | st8.html:1705-1743 | ✅ PASS |
| 2 | Form fields | st8.html:1724-1735 | ✅ PASS |
| 3 | Save handler (write path) | st8.html:1747-1790 | ✅ PASS |
| 4 | API route registration | server.js:97-98 | ✅ PASS |
| 5 | Backend handler | server.js:236-270 | ✅ PASS |
| 6 | SQLite upsert | persistence.js:194-207 | ✅ PASS |
| 7 | Activity logging | persistence.js:216-228 | ✅ PASS |
| 8 | file_intent schema | persistence.js:73-81 | ✅ PASS |
| 9 | activity_log schema | persistence.js:83-90 | ✅ PASS |
| 10 | Manifest regeneration after save | server.js (missing) | ⚠️ FAIL |
| 11 | Indexer loads intent from SQLite | indexer.js:273-282 | ⚠️ FAIL |
| 12 | Frontend reloads manifest after save | st8.html:1747-1790 | ⚠️ FAIL |

**Overall Status: ⚠️ PARTIAL PASS**

The write path (UI → SQLite) is fully functional and correctly wired. The read-back path (SQLite → Manifest → UI) has gaps: intent data saved to SQLite is not reflected in the manifest on disk, meaning notes are lost after page reload. The in-memory state works for the current session only.

---

## RT-4: Graph Visualizer Polish — Verification Report

### Integration Points Verified

| # | Integration Point | File | Lines | Status |
|---|------------------|------|-------|--------|
| 1 | Class Definition | graph-visualizer.js | 44-56 | ✅ PASS |
| 2 | D3 Load | graph-visualizer.js | 18-40 | ✅ PASS |
| 3 | SVG Creation | graph-visualizer.js | 63-85 | ✅ PASS |
| 4 | Data Transform | graph-visualizer.js | 87-119 | ✅ PASS |
| 5 | Force Simulation | graph-visualizer.js | 130-134 | ✅ PASS |
| 6 | Node Rendering | graph-visualizer.js | 190-227 | ✅ PASS |
| 7 | Link Rendering | graph-visualizer.js | 137-187 | ✅ PASS |
| 8 | Label Rendering | graph-visualizer.js | 237-249 | ✅ PASS |
| 9 | Tick Handler | graph-visualizer.js | 252-266 | ✅ PASS |
| 10 | TUI Button | phreak-terminal.js | 655-673 | ✅ PASS |
| 11 | Button Integration | phreak-terminal.js | 513, 562 | ✅ PASS |

---

### Fixes Applied

#### Fix 1: Zoom Binding — Store zoom reference
**Before:**
```js
var zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', function(event) {
        this.svg.select('g').attr('transform', event.transform);
    }.bind(this));
this.svg.call(zoom);
```
**After:**
```js
this.zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', function(event) {
        this.svg.select('g').attr('transform', event.transform);
    }.bind(this));
this.svg.call(this.zoom);
```
**Files modified:** graph-visualizer.js:53, 75-81

---

#### Fix 2: Node Click Handler — Implemented file details popup
**Before:**
```js
onNodeClick: function(node) {
    console.info('[st8] Node clicked:', node);
    // TODO: Show file details popup
}
```
**After:**
```js
onNodeClick: function(node) {
    _showNodeDetails(node);
}
```
Added `_showNodeDetails(node)` function (lines 281-347) showing:
- Filename and path
- Status badge (color-coded)
- 2×2 grid: reachability score, impact radius, imports count, imported-by count
- Overlay click-to-dismiss

**Files modified:** graph-visualizer.js:279-353, 388-390

---

#### Fix 3: Link Labels on Hover — Tooltip showing import source→target
**Added:** `mouseover`, `mousemove`, `mouseout` handlers on link lines (lines 146-187)
- Hover highlights link in gold (#D4AF37)
- Shows tooltip: "source → target"
- Tooltip follows cursor
- Restores original style on mouseout

**Files modified:** graph-visualizer.js:146-187

---

#### Fix 4: Zoom Reset — Use stored zoom reference with transition
**Before:**
```js
resetZoom: function() {
    if (window.St8GraphVisualizer._currentVisualizer) {
        window.St8GraphVisualizer._currentVisualizer.svg.call(
            d3.zoom().transform,
            d3.zoomIdentity
        );
    }
}
```
**After:**
```js
resetZoom: function() {
    if (window.St8GraphVisualizer._currentVisualizer) {
        var viz = window.St8GraphVisualizer._currentVisualizer;
        if (viz.zoom && viz.svg) {
            viz.svg.transition().duration(500).call(
                viz.zoom.transform,
                d3.zoomIdentity
            );
        }
    }
}
```
**Files modified:** graph-visualizer.js:444-453

---

#### Fix 5: Node Sizing — Larger base + capped impact
**Before:**
```js
.attr('r', function(d) {
    return 5 + (d.impactRadius || 0) * 2;
})
```
**After:**
```js
.attr('r', function(d) {
    var base = 6;
    var impact = Math.min(d.impactRadius || 0, 10);
    return base + impact * 2.5;
})
```
**Files modified:** graph-visualizer.js:196-200

---

#### Fix 6: Filter Controls — GREEN/YELLOW/RED filter buttons
**Added:**
- Filter button group in popup footer (lines 368-373)
- Click handler toggles opacity on nodes/labels/links by status (lines 401-437)
- CSS for `.graph-popup-filters` and `.graph-filter-btn` states

**Files modified:**
- graph-visualizer.js:368-373, 401-437
- st8.html:440-451

---

### CSS Verification

All graph CSS exists in st8.html (lines 350-451):
- `.graph-popup-overlay` — fullscreen backdrop
- `.graph-popup` — 900×700 container with border/shadow
- `.graph-popup-header/title/close` — header bar
- `.graph-popup-body/svg` — graph viewport
- `.graph-popup-footer` — bottom bar with filters
- `.graph-popup-btn` — button styling
- `.graph-popup-filters` — NEW filter button group
- `.graph-filter-btn.active/hover` — NEW filter states

---

### Remaining Issues

| Issue | Severity | Location | Notes |
|-------|----------|----------|-------|
| Tooltip cleanup on popup close | Low | graph-visualizer.js | `#graph-node-details` and `#graph-link-tooltip` divs may persist if popup closed without mouseout. Mitigated by overlay click handler. |
| Large graph performance | Low | graph-visualizer.js:130 | Force simulation with 100+ nodes may lag. Consider `alphaMin` tuning for future. |

---

### Status: **PASS** ✅

All 6 known issues fixed. All 11 integration points verified. CSS present. No blocking issues remain.


No accidental deletions. Now creating the structured verification report:

---

## RT-5 Settings Persistence to SQLite — Verification Report

**Status: PASS**

**Commit:** `d9a231e`

---

### Integration Points Verified

| # | Integration Point | File | Lines | Status | Code Snippet |
|---|---|---|---|---|---|
| 1 | Categories | settings-ui.js | 15-24 | ✅ VERIFIED | `const SETTINGS_CATEGORIES = [{ id: 'sirkits', ... }, ...]` — 8 categories: sirkits, models, shells, voidflow, keybindings, theme, storage, network |
| 2 | State | settings-ui.js | 28-32 | ✅ VERIFIED | `const settingsState = { activeCategory: null, entries: {}, editingEntry: null }` |
| 3 | Defaults | settings-ui.js | 36-66 | ✅ VERIFIED | `const DEFAULT_SETTINGS = { voidflow: { reveal_wpm: 200, ... }, ... }` — All 8 categories with default values |
| 4 | Render Main | settings-ui.js | 95-152 | ✅ VERIFIED | `renderCategoryEntries(categoryId)` — Renders form fields per category (boolean → select, number → input, string → text input) |
| 5 | Update Handler | settings-ui.js | 162-171 | ✅ MODIFIED | `updateValue(categoryId, key, value)` now calls `_persistSetting()` at line 169 |
| 6 | Persistence Point | settings-ui.js | 168 | ✅ RESOLVED | `// TODO: Persist to backend` replaced with `_persistSetting(categoryId, key, value)` |

---

### New Code Added

#### 1. SQLite Schema — backend/persistence.js:98-104
```sql
CREATE TABLE IF NOT EXISTS st8_settings (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, key)
);
```

#### 2. Persistence Methods — backend/persistence.js:245-284
| Method | Line | Purpose |
|--------|------|---------|
| `upsertSetting(category, key, value)` | 245 | INSERT OR REPLACE with auto-timestamp |
| `getSetting(category, key)` | 253 | Single setting lookup with JSON parse |
| `getSettingsByCategory(category)` | 260 | All settings for a category as key-value map |
| `getAllSettings()` | 270 | All settings grouped by category |
| `deleteSetting(category, key)` | 281 | Remove a setting |

#### 3. API Endpoint — backend/server.js:100-101
```javascript
case '/api/settings':
    this._handleSettings(req, res, url);
    break;
```

#### 4. Settings Handler — backend/server.js:276-328
- **GET /api/settings** → Returns all settings grouped by category
- **GET /api/settings?category=X** → Returns settings for one category
- **POST /api/settings** → Upserts `{category, key, value}` with validation
- Proper persistence lifecycle (initialize → work → close)
- Error handling with 400/405/500 responses

#### 5. Frontend Persistence — settings-ui.js:173-185
```javascript
function _persistSetting(categoryId, key, value) {
    fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: categoryId, key: key, value: value })
    })...
}
```

#### 6. Settings Loader — settings-ui.js:187-207
```javascript
function loadSettings() {
    return fetch('/api/settings')
        .then(...)
        .then(function(result) {
            if (result && result.data) {
                Object.keys(result.data).forEach(function(category) {
                    settingsState.entries[category] = result.data[category];
                });
            }
        })...
}
```

---

### Signal Path Traced

```
UI onchange → window.St8Settings.updateValue(categoryId, key, value)
  → settingsState.entries[categoryId][key] = value    [line 166]
  → _persistSetting(categoryId, key, value)            [line 169]
    → fetch('POST /api/settings', {category, key, value})  [line 174]
      → St8Server._handleSettings(req, res, url)       [server.js:276]
        → persistence.initialize()                     [line 280]
        → persistence.upsertSetting(category, key, value)  [line 308]
          → db.prepare('INSERT OR REPLACE INTO st8_settings...')  [persistence.js:246]
          → stmt.run(category, key, JSON.stringify(value))  [line 250]
        → persistence.close()                          [line 309]
        → res.writeHead(200) / res.end({status:'ok'})  [line 310-311]

UI init → showSettingsPopup() / showSettingsInExplorer()
  → loadSettings()                                     [lines 250, 323]
    → fetch('GET /api/settings')                       [line 188]
      → St8Server._handleSettings(req, res, url)       [server.js:276]
        → persistence.getAllSettings()                 [line 289]
          → db.prepare('SELECT category, key, value FROM st8_settings...')  [persistence.js:271]
        → res.json({status:'ok', data: {...}})         [line 293]
    → settingsState.entries[category] = result.data[category]  [line 197]
  → renderSettingsPanel()                              [line 251]
```

---

### Issues Found

None. All integration points are correctly wired.

---

### Summary of Changes

| File | Changes |
|------|---------|
| `backend/persistence.js` | +7 lines schema, +40 lines CRUD methods |
| `backend/server.js` | +2 lines route, +53 lines handler |
| `settings-ui.js` | Replaced TODO with `_persistSetting()`, added `loadSettings()`, updated both UI entry points to auto-load, exposed in public API |

**Total:** 159 insertions, 8 deletions across 3 files.


## Task RT-6 Complete

**Status: PASS**

### Summary

Verified all TUI button integration points and added file count badges to the Phreak> terminal.

### Changes Made

**phreak-terminal.js:**
- Added badge spans to GREEN/YELLOW/RED/ALL buttons (lines 509-512)
- Added `_updateTUIBadges()` function (lines 714-739) to populate badges from manifest
- Called `_updateTUIBadges()` on TUI enter (line 543) and isolate action (line 618)
- Fixed dead code bug in `togglePhoneOffHook()` — removed premature `return` (line 800)

**st8.html:**
- Added `.phreak-badge` CSS styles (lines 1341-1360)
- Badge colors: GREEN→gold, YELLOW→cyan, RED→pink
- Badge hides when empty via `:empty { display: none }`

### Verification Results

All 9 TUI buttons verified:
| Button | Action | Status |
|--------|--------|--------|
| GREEN | `_isolateFiles('GREEN')` | ✅ |
| YELLOW | `_isolateFiles('YELLOW')` | ✅ |
| RED | `_isolateFiles('RED')` | ✅ |
| ALL | `_isolateFiles('ALL')` | ✅ |
| GRAPH | `_showGraph()` | ✅ |
| CLEAR VOID | `_clearVoid()` | ✅ |
| CLEAR PHREAK | `_clearPhreak()` | ✅ |
| CLEAR ALL | `_clearAll()` | ✅ |
| SETTINGS | `_showSettings()` | ✅ |

### Commit

```
35f6834 feat(RT-6): add file count badges to TUI buttons and fix dead code bug
```

### Report

Full verification report saved to `RT-6-VERIFICATION-REPORT.md`.


###Warning: Node details X button leaves invisible overlay blocking graph (z-index 105 > 100).


I now have the complete picture. Here is the full integration report.

---

## Integration Check: RT-1 — End-to-End Indexing Flow

### ACTUAL Signal Path (BROKEN)

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|--------------|
| **1** | INDEX button click | `file-explorer.js:344` | `onclick="window.VoidFileExplorer._indexCodebase()"` |
| **2** | `_indexCodebase()` entry | `file-explorer.js:561` | Gets `targetPath` from `explorerState.currentPath` |
| **3** | Path validation | `file-explorer.js:567-570` | Rejects `~` (home dir), requires subpath |
| **4** | Button state update | `file-explorer.js:573-575` | Sets button to `INDEXING...`, disables it |
| **5** | **Delegation to PhreakTerminal** | `file-explorer.js:579-580` | `await window.PhreakTerminal.execute('index ' + targetPath)` |
| **6** | `phreakExecute()` entry | `phreak-terminal.js:47` | Receives string `'index /some/path'` as `cmd` |
| **7** | Media command check | `phreak-terminal.js:61` | `_tryMediaCommand('index /some/path')` → returns `false` (no match) |
| **8a** | **EPO WebSocket path (primary)** | `phreak-terminal.js:69-70` | `window.epoClient.request('exec', { command: 'index /some/path' })` |
| **8b** | **REST fallback path** | `phreak-terminal.js:90-94` | `fetch('/api/exec', { method: 'POST', body: { command: 'index /some/path' } })` |
| **9** | `_handleExec()` handler | `server.js:206-221` | Parses `{ command }` from body |
| **10** | **Shell execution** | `server.js:212-213` | `execSync('index /some/path', { encoding: 'utf-8', timeout: 30000 })` |
| **11** | **💥 FAILURE** | — | `index` is not a shell command. `execSync` throws, caught at `server.js:216`, returns `{ stdout: '', stderr: err.message }` |
| **12** | Stderr rendered | `phreak-terminal.js:80-82` | Error message displayed in terminal as stderr line |
| **13** | Back in `_indexCodebase` | `file-explorer.js:595` | `catch (err)` — error logged to console |
| **14** | Button restored | `file-explorer.js:598-601` | Button text restored to `INDEX`, re-enabled |

**Result:** The INDEX button triggers a shell command `index /some/path` which doesn't exist. The indexing never runs. No `connection-state.json` or `ai-signal.toml` is generated.

---

### CORRECT Signal Path (What Should Happen)

| Step | Component | File:Line | What Should Happen |
|------|-----------|-----------|---------------------|
| **1** | INDEX button click | `file-explorer.js:344` | `onclick="window.VoidFileExplorer._indexCodebase()"` |
| **2** | `_indexCodebase()` entry | `file-explorer.js:561` | Gets `targetPath` from `explorerState.currentPath` |
| **3** | Path validation | `file-explorer.js:567-570` | Rejects `~` (home dir), requires subpath |
| **4** | Button state update | `file-explorer.js:573-575` | Sets button to `INDEXING...`, disables it |
| **5** | **Direct API call** | (missing) | `fetch('/api/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: targetPath }) })` |
| **6** | `_handleIndex()` handler | `server.js:223-237` | Receives request |
| **7** | `indexDirectory()` | `server.js:227` / `indexer.js:302` | Discovers files, hashes, parses imports, builds graph, classifies (GREEN/YELLOW/RED) |
| **8** | `writeManifests()` | `server.js:229` / `manifestGenerator.js:134` | Writes `connection-state.json` and `ai-signal.toml` to `this.targetDir` |
| **9** | Success response | `server.js:230-231` | Returns `{ status: 'ok', files: result.files.length }` |
| **10** | Result rendered | (missing) | Parse response, display success in terminal, store fingerprints |
| **11** | VERIFY button shown | `file-explorer.js:584-586` | Shows VERIFY button |
| **12** | `window.st8IndexingComplete` | `file-explorer.js:590-591` | Notifies UI |
| **13** | Button restored | `file-explorer.js:598-601` | Button text restored to `INDEX`, re-enabled |

---

### Break Point

**File:** `file-explorer.js`
**Lines:** 577–581

```javascript
577:     try {
578:         // Send indexing request to phreak terminal
579:         if (window.PhreakTerminal && window.PhreakTerminal.execute) {
580:             await window.PhreakTerminal.execute('index ' + targetPath);
581:         }
```

**Why it breaks:** `_indexCodebase()` delegates to `PhreakTerminal.execute()` which is a generic shell command executor. The string `'index /some/path'` is treated as an arbitrary shell command. There is no shell binary named `index`. The dedicated `/api/index` endpoint (server.js:94-95, 223-237) which properly calls `indexDirectory()` + `writeManifests()` is **never invoked from any frontend code**.

**Secondary break at:** `phreak-terminal.js:70` and `phreak-terminal.js:90`
- EPO path (`epoClient.request('exec', ...)`) — sends to EPO bus as `exec` type; no EPO server handler exists in this codebase to route `index` commands
- REST fallback (`fetch('/api/exec', ...)`) — lands on `_handleExec()` which does raw `execSync()`, not `indexDirectory()`

**Dead constant:** `phreak-terminal.js:43` — `const PHREAK_API = '/api/v1/exec'` is declared but **never used** anywhere in the codebase (the actual fetch at line 90 hardcodes `/api/exec`).

---

### Fix Required

**Primary fix in `file-explorer.js:577-581`** — Replace the PhreakTerminal delegation with a direct `/api/index` call:

```javascript
// CURRENT (BROKEN):
try {
    if (window.PhreakTerminal && window.PhreakTerminal.execute) {
        await window.PhreakTerminal.execute('index ' + targetPath);
    }

// FIX:
try {
    const response = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    
    // Display results in PhreakTerminal for user feedback
    if (window.PhreakTerminal && window.PhreakTerminal.execute) {
        // Use appendToken/sealLine for streaming display, NOT execute()
        // OR just log to terminal directly
    }
    console.info('[st8] Indexing complete:', result.files, 'files');
```

**Secondary concern:** The `/api/exec` endpoint (`server.js:206-221`) runs `execSync(command)` with **no sanitization** — this is a command injection vector. Any frontend code (or XSS payload) can execute arbitrary shell commands on the server. This should be sandboxed or removed if not needed.

---

### Additional Findings

| Finding | Severity | Location | Detail |
|---------|----------|----------|--------|
| `/api/index` endpoint exists but is **never called** from any frontend file | BLOCKER | `server.js:94-95` | Only reference is the server route definition itself; grep for `/api/index` across all `.js` returns only `server.js:94` |
| `PHREAK_API` constant is dead code | WARNING | `phreak-terminal.js:43` | `'/api/v1/exec'` declared, never referenced |
| `/api/exec` has no command sanitization | WARNING | `server.js:206-221` | Raw `execSync(command)` — command injection risk |
| EPO `exec` request has no matching server handler | WARNING | `phreak-terminal.js:70` | `epoClient.request('exec', ...)` sent but no EPO server handler visible in codebase |
| `_indexCodebase` never populates `indexedFingerprints` | BLOCKER | `file-explorer.js:30` / `561-603` | `explorerState.indexedFingerprints` is set via `setIndexedFingerprints()` (line 662) but `_indexCodebase()` never calls it; TUI badge/isolate features depend on this data (`phreak-terminal.js:600-601`, `715-716`) |




Confirmed. `getIntent()` exists at `persistence.js:217` but is **never called anywhere** in the entire codebase. The `file_intent` table is only mentioned in schema definitions (indexer.js:75, indexer.js:105), never queried.




Now I have everything I need. Here is the complete integration report:

---

# Integration Report: File Watcher → Re-index Signal Path

## Signal Path for `change` Events — ✅ WORKING

```
fileWatcher.js:77   chokidar 'change' event captured
         ↓
fileWatcher.js:87   _onFileChange(filePath, 'change') called
fileWatcher.js:88   → pendingChanges.add({ path: filePath, type: 'change' })
         ↓
fileWatcher.js:94   debounce timer (500ms) fires _flush()
fileWatcher.js:100  → copies pendingChanges to local array, clears Set
         ↓
fileWatcher.js:105  if (this.onFileChange) { ... }
fileWatcher.js:107  → this.onFileChange(changes)  — calls callback in index.js
         ↓
index.js:128        for (const change of changes) { ... }
index.js:129-131    → result.files.find(f => f.filepath === path.relative(targetDir, change.path))
                    → finds existing file in in-memory array ✅
         ↓
index.js:133-134    → require('fs').readFileSync(change.path)  — file exists, no crash ✅
index.js:135        → crypto.createHash('sha256').update(buf).digest('hex')
         ↓
index.js:137        if (newHash !== changedFile.sha256Hash) { ... }
index.js:138        → changedFile.sha256Hash = newHash  — mutates in-memory record
index.js:139        → persistence.upsertFile(changedFile)  — persists to SQLite ✅
         ↓
persistence.js:143  upsertFile() — INSERT OR REPLACE INTO file_registry ✅
persistence.js:149  → stmt.run(fingerprint, filepath, filename, sha256_hash, ...)
         ↓
index.js:146-147    writeManifests(result.files, targetDir)  — regenerates manifests ✅
         ↓
manifestGenerator.js:134  writeManifests() entry
manifestGenerator.js:140  → generateConnectionState(files, targetDir)  — builds JSON
manifestGenerator.js:141  → fs.writeFileSync(jsonPath, ...)  — writes connection-state.json ✅
manifestGenerator.js:145  → generateAiSignalToml(files, targetDir)  — builds TOML
manifestGenerator.js:146  → fs.writeFileSync(tomlPath, ...)  — writes ai-signal.toml ✅
```

**Verdict:** End-to-end path is complete. File hash change → SQLite update → manifest regeneration all wire correctly.

---

## Signal Path for `unlink` Events — ❌ BROKEN (CRASH)

```
fileWatcher.js:78   chokidar 'unlink' event captured
         ↓
fileWatcher.js:87   _onFileChange(filePath, 'unlink') called
fileWatcher.js:88   → pendingChanges.add({ path: filePath, type: 'unlink' })
         ↓
fileWatcher.js:94   debounce timer (500ms) fires _flush()
fileWatcher.js:100  → copies pendingChanges to local array, clears Set
         ↓
fileWatcher.js:105  if (this.onFileChange) { ... }
fileWatcher.js:107  → this.onFileChange(changes)  — calls callback in index.js
         ↓
index.js:128        for (const change of changes) { ... }
index.js:129-131    → result.files.find(f => f.filepath === path.relative(targetDir, change.path))
                    → finds existing file in in-memory array (file metadata still present) ✅
         ↓
index.js:133-134    → require('fs').readFileSync(change.path)  — 💥 ENOENT CRASH
```

**💥 BREAK POINT:** `index.js:133-134`

```javascript
const newHash = require('crypto')
    .createHash('sha256')
    .update(require('fs').readFileSync(change.path))  // ← file deleted, ENOENT thrown
    .digest('hex');
```

**Root Cause:** The callback has no guard on `change.type`. It unconditionally calls `readFileSync(change.path)` for ALL event types. For `unlink`, the file no longer exists on disk, so `readFileSync` throws `ENOENT`.

**Error Propagation:**
- The `ENOENT` exception propagates up through the `for` loop at `index.js:128`
- Caught by `fileWatcher.js:106-110` (`try/catch` in `_flush()`) — logged as `"[st8:watcher] Error in onFileChange callback: ..."`
- Execution aborts **before** reaching `index.js:146-147` (`writeManifests`)
- **Result:** File remains in both in-memory `result.files` and SQLite. Manifests are NOT regenerated. State is silently corrupted.

**Secondary Issue — No deleteFile() in persistence:**
`persistence.js` exports `upsertFile()` (line 143) but has no `removeFile()` or `deleteFile()` method. Even if the crash were fixed, there is no API to remove the deleted file's row from `file_registry`.

---

## Signal Path for `add` Events — ❌ SILENTLY SKIPPED

```
fileWatcher.js:76   chokidar 'add' event captured
         ↓
fileWatcher.js:87   _onFileChange(filePath, 'add') called
fileWatcher.js:88   → pendingChanges.add({ path: filePath, type: 'add' })
         ↓
fileWatcher.js:94   debounce timer (500ms) fires _flush()
fileWatcher.js:105-107  → this.onFileChange(changes)
         ↓
index.js:128        for (const change of changes) { ... }
index.js:129-131    → result.files.find(f => f.filepath === path.relative(targetDir, change.path))
                    → returns undefined (new file NOT in initial index array) ❌
         ↓
index.js:132        if (changedFile) { ... }  — evaluates to false
         ↓
🔇 SILENTLY SKIPPED — loop continues to next change
         ↓
index.js:146-147    writeManifests(result.files, targetDir)  — runs, but with STALE data
                    (new file is absent from result.files)
```

**💥 BREAK POINT:** `index.js:129-132`

```javascript
const changedFile = result.files.find(f =>
    f.filepath === path.relative(targetDir, change.path)
);
if (changedFile) {  // ← false for new files, entire block skipped
    // ...hash, update, persist...
}
```

**Root Cause:** The callback only looks up files in the existing `result.files` array (populated at initial index time). New files don't exist in this array, so `find()` returns `undefined` and the entire processing block is skipped.

**Consequences:**
1. New file is never hashed (`hashFile()` never called)
2. New file is never added to `result.files` array
3. New file is never persisted to SQLite via `upsertFile()`
4. New file is never parsed for imports (`parseImports()` never called)
5. `writeManifests()` regenerates manifests with the stale `result.files` — new file is absent
6. No user feedback — no log message, no error, complete silence

**Additional Issue — No single-file indexer:** `indexer.js` only exports `indexDirectory()` (line 409) which re-scans the entire directory tree. There is no `indexSingleFile()` function that could incrementally process a new file. To properly handle `add` events, either:
- A new `indexSingleFile(filepath, targetDir)` function must be created, OR
- The callback must call `indexDirectory()` for the full target (expensive), OR  
- The callback must replicate the hash + parse + classify pipeline inline

---

## Summary of Break Points

| # | Event | File:Line | Issue | Severity |
|---|-------|-----------|-------|----------|
| 1 | `unlink` | `index.js:133-134` | `readFileSync()` on deleted file → ENOENT crash | **BLOCKER** |
| 2 | `unlink` | `persistence.js` (missing) | No `deleteFile()` method exists | **BLOCKER** |
| 3 | `unlink` | `index.js:128` | No `change.type` disambiguation — all events handled identically | **BLOCKER** |
| 4 | `add` | `index.js:129-131` | `find()` only matches existing files; new files return `undefined` | **BLOCKER** |
| 5 | `add` | `index.js:132` | `if (changedFile)` guard silently skips unknown files | **BLOCKER** |
| 6 | `add` | `indexer.js` (missing) | No `indexSingleFile()` for incremental indexing | **BLOCKER** |
| 7 | `add` | `index.js:128` | No branch on `change.type === 'add'` to create new entry | **BLOCKER** |
| 8 | `add`/`unlink` | `index.js:146-147` | Manifest regeneration runs with stale `result.files` | **WARNING** |

---

## Fixes Required

### Fix 1: Branch on event type in onFileChange callback
**File:** `backend/index.js`, lines 128-148
**What:** The `for (const change of changes)` loop must branch on `change.type`:
- `'change'` → existing path (re-hash, update)
- `'unlink'` → remove from `result.files`, remove from DB
- `'add'` → index new file, add to `result.files`, persist to DB

### Fix 2: Guard readFileSync against deleted files
**File:** `backend/index.js`, line 133-134
**What:** Wrap `readFileSync` in a `try/catch` or gate it behind `change.type !== 'unlink'`. The current code runs unconditionally for all events.

### Fix 3: Add deleteFile() to St8Persistence
**File:** `backend/persistence.js`
**What:** Add a `deleteFile(filepath)` method:
```javascript
deleteFile(filepath) {
    const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
    return stmt.run(filepath);
}
```
Also add `deleteConnectionsForFile(fingerprint)` to clean up foreign key references in the `connections` table.

### Fix 4: Handle 'add' events with new file indexing
**File:** `backend/index.js`, lines 128-148
**What:** When `change.type === 'add'`:
1. Check if file already exists in `result.files` (skip if so)
2. Hash the new file
3. Parse imports
4. Classify status
5. Add to `result.files` array
6. Call `persistence.upsertFile()`
7. Rebuild connection graph for affected files

### Fix 5: Add indexSingleFile() to indexer (optional but recommended)
**File:** `backend/indexer.js`
**What:** Export a function that indexes a single file path (hash, parse, classify) and returns the file record. This avoids duplicating indexer logic in the callback.

### Fix 6: Remove deleted file from in-memory array on unlink
**File:** `backend/index.js`, after handling unlink
**What:** After removing from DB, also splice the file out of `result.files`:
```javascript
const idx = result.files.indexOf(changedFile);
if (idx !== -1) result.files.splice(idx, 1);
```

---

## Cross-Phase Wiring Verification

| Component | Export | Consumer | Wired? | Notes |
|-----------|--------|----------|--------|-------|
| `fileWatcher.js` → `FileWatcher` class | `module.exports = { FileWatcher }` (line 125) | `index.js:17` imports it | ✅ | Class instantiation at `index.js:122` |
| `persistence.js` → `St8Persistence` class | `module.exports = { St8Persistence }` (line 298) | `index.js:15` imports it | ✅ | Instantiation at `index.js:59` |
| `manifestGenerator.js` → `writeManifests` | `module.exports = { writeManifests }` (line 161) | `index.js:16` imports, `index.js:114` and `index.js:146` calls | ✅ | Called in both initial index and watcher callback |
| `indexer.js` → `indexDirectory` | `module.exports = { indexDirectory }` (line 409) | `index.js:14` imports, `index.js:64` calls | ✅ | Initial index only; NOT used in watcher callback |
| `persistence.js` → `deleteFile` | **NOT EXPORTED** | Needed by watcher callback for `unlink` events | ❌ | Method does not exist |
| `indexer.js` → `indexSingleFile` | **NOT EXPORTED** | Needed by watcher callback for `add` events | ❌ | Function does not exist |

---

## E2E Flow Status

| Flow | Steps | Status | Break Point |
|------|-------|--------|-------------|
| **Initial index → persist → manifest** | indexDirectory → upsertFile loop → writeManifests | ✅ COMPLETE | — |
| **File modified → re-index** | chokidar 'change' → readFileSync → hash compare → upsertFile → writeManifests | ✅ COMPLETE | — |
| **File deleted → clean-up** | chokidar 'unlink' → readFileSync → **CRASH** | ❌ BROKEN | `index.js:133` |
| **File added → index** | chokidar 'add' → find() → **not found, skipped** | ❌ BROKEN | `index.js:129-132` |
| **Server serves stale manifest after add** | add event → manifest regenerated without new file | ❌ BROKEN | `index.js:146-147` (stale data) |



---

# Integration Audit Report: Notes Save → SQLite → Manifest

## 1. Write Signal Path (UI → SQLite) — ✅ COMPLETE

| Step | File | Line(s) | Description |
|------|------|---------|-------------|
| 1 | `st8.html` | 1667 | "Notes" button rendered per file: `onclick="window.handleFileNotes('...')"` |
| 2 | `st8.html` | 1677-1680 | `window.handleFileNotes(filepath)` calls `showNotesPopup(filepath)` |
| 3 | `st8.html` | 1779-1818 | `showNotesPopup()` creates overlay, pre-fills from in-memory manifest, wires SAVE to `window.saveFileNotes(filepath)` |
| 4 | `st8.html` | 1821-1864 | `window.saveFileNotes()` reads textarea values, updates in-memory manifest (line 1835), then POSTs to `/api/file-intent` (line 1842) |
| 5 | `server.js` | 97-98 | Route `/api/file-intent` dispatched to `_handleFileIntent()` |
| 6 | `server.js` | 239-273 | `_handleFileIntent()` parses body, instantiates `St8Persistence`, calls `upsertIntent()` (line 249) and `logActivity()` (line 257), then closes DB |
| 7 | `persistence.js` | 202-215 | `upsertIntent()` executes `INSERT OR REPLACE INTO file_intent` with fingerprint, purpose, dependsOnBehavior, valueStatement, authoredBy |

**Write path verdict:** Data reaches SQLite successfully. No breaks.

---

## 2. Read-Back Signal Path (SQLite → Manifest → UI) — ❌ BROKEN AT 3 POINTS

| Step | File | Line(s) | Description | Status |
|------|------|---------|-------------|--------|
| A | `persistence.js` | 217-219 | `getIntent(fingerprint)` exists — queries `file_intent` table | ✅ EXISTS |
| B | `indexer.js` | 345-353 | `finalFiles` merge loop builds file objects from parsing + classification | ⚠️ No intent query |
| C | `indexer.js` | 261-286 | `generateManifest()` builds `connection-state.json` structure | ⚠️ No intent field |
| D | `manifestGenerator.js` | 56-71 | `generateConnectionState()` maps files to manifest output | ⚠️ Uses `f.intent \|\| {empty}` |
| E | `manifestGenerator.js` | 134-154 | `writeManifests()` writes JSON + TOML to disk | ✅ Writes correctly |
| F | `server.js` | 148-170 | `_serveManifest()` reads `connection-state.json` from disk and returns it | ✅ Serves correctly |
| G | `st8.html` | 1883-1905 | `fetchManifest()` calls `/api/connection-state.json` | ✅ Fetches correctly |
| H | `st8.html` | 1867-1880 | `st8IndexingComplete()` stores manifest and calls `renderFileList()` | ✅ Updates UI |

---

## 3. Break Points — 3 BLOCKERS Identified

### BREAK #1 (BLOCKER): Manifest Not Regenerated After Intent Save

**File:** `server.js:239-273`  
**Problem:** `_handleFileIntent()` saves to SQLite (line 249) but **never regenerates the manifest**. Compare with `_handleIndex()` (line 223-237) which calls `writeManifests()` after indexing. The intent handler has no such call.

```javascript
// server.js:249-267 — saves to DB, but manifest is never refreshed
persistence.upsertIntent({...});
persistence.logActivity({...});
persistence.close();
// ← MISSING: writeManifests() or equivalent call here
res.writeHead(200, ...);
res.end(JSON.stringify({ status: 'ok', fingerprint }));
```

**Impact:** The on-disk `connection-state.json` file remains stale after every notes save. The server continues serving the old file at `/api/connection-state.json`.

---

### BREAK #2 (BLOCKER): Indexer Never Loads Intent from SQLite

**File:** `indexer.js:261-286` (also `indexer.js:345-353`)  
**Problem:** `generateManifest()` constructs file objects with `filepath, filename, status, reachabilityScore, impactRadius, sha256Hash, imports, importedBy` — but **never includes `intent`**. The `file_intent` table is never queried.

Evidence:
- `getIntent()` is defined at `persistence.js:217` but **grep finds zero call sites** across the entire codebase.
- The `file_intent` table appears in the schema comment (`indexer.js:75`) and `CREATE TABLE` (`indexer.js:105`), but is never referenced in any `SELECT` or `JOIN`.
- Even if a re-index is triggered, intent data would be lost from the manifest.

```javascript
// indexer.js:273-283 — intent is missing from the file object
files: files.map(f => ({
    filepath: f.filepath,
    filename: f.filename,
    status: f.status,
    reachabilityScore: f.reachabilityScore,
    impactRadius: f.impactRadius,
    sha256Hash: f.sha256Hash,
    imports: f.imports || [],
    importedBy: f.importedBy || []
    // ← MISSING: intent field populated from file_intent table
}))
```

**Note:** `manifestGenerator.js:66` has a fallback: `intent: f.intent || { purpose: '', dependsOnBehavior: '', valueStatement: '' }` — but since the indexer never populates `f.intent`, this always hits the empty default.

---

### BREAK #3 (BLOCKER): Frontend Doesn't Reload Manifest After Save

**File:** `st8.html:1851-1864`  
**Problem:** After the POST to `/api/file-intent` succeeds (line 1851-1857), the `.then()` callback only logs to console. It does **not** re-fetch the manifest or re-render the file list. The popup is closed (line 1862) and the UI remains showing stale data.

```javascript
// st8.html:1851-1857 — no UI refresh after save
.then(function(data) {
    console.info('[st8] Notes saved to backend:', data);
    // ← MISSING: fetchManifest() + renderFileList() + setIndexedFingerprints()
})
```

**Additionally:** Even the in-memory manifest update (line 1835-1839) is fragile — it mutates the object reference directly, but there's no guarantee `renderFileList()` is called to reflect the change visually.

---

## 4. Fixes Required

### Fix #1: Regenerate Manifest After Intent Save

**File:** `backend/server.js`, method `_handleFileIntent()`  
**Change:** After `upsertIntent()` succeeds, regenerate the manifest by querying all files with their intents from SQLite.

```javascript
// In _handleFileIntent(), after persistence.upsertIntent():
// 1. Get all files from DB
// 2. For each file, get intent from file_intent table
// 3. Call writeManifests() with enriched data
// 4. Update server cache

const { writeManifests } = require('./manifestGenerator');
const files = persistence.getAllFiles();
const enrichedFiles = files.map(f => {
    const intent = persistence.getIntent(f.fingerprint);
    return { ...f, sha256Hash: f.sha256_hash, intent: intent || null };
});
writeManifests(enrichedFiles, this.targetDir);
```

### Fix #2: Indexer Must Load Intent from SQLite

**File:** `backend/indexer.js`, function `generateManifest()` (line 261)  
**Change:** Query `file_intent` for each file and include it in the manifest output.

```javascript
// In generateManifest() or in the finalFiles merge (line 345-353):
// After classification, open DB, query file_intent for each file
const { St8Persistence } = require('./persistence');
const persistence = new St8Persistence();
await persistence.initialize();
const enrichedFiles = finalFiles.map(f => {
    const intent = persistence.getIntent(f.sha256Hash || f.fingerprint);
    return { ...f, intent: intent || { purpose: '', dependsOnBehavior: '', valueStatement: '' } };
});
persistence.close();
```

### Fix #3: Frontend Must Refresh UI After Save

**File:** `st8.html`, function `window.saveFileNotes()` (line 1821)  
**Change:** After successful POST response, re-fetch manifest and re-render.

```javascript
// In the .then() callback (line 1853):
.then(function(data) {
    console.info('[st8] Notes saved to backend:', data);
    // Re-fetch manifest to get updated data
    fetchManifest('/').then(function(manifest) {
        if (manifest && manifest.files) {
            renderFileList(manifest.files);
            if (window.VoidFileExplorer && window.VoidFileExplorer.setIndexedFingerprints) {
                window.VoidFileExplorer.setIndexedFingerprints(manifest);
            }
        }
    });
})
```

---

## 5. Complete Signal Flow Diagram

```
WRITE PATH (working):
  st8.html:1667  Notes button click
       ↓
  st8.html:1677  handleFileNotes(filepath)
       ↓
  st8.html:1779  showNotesPopup(filepath) → overlay with textareas
       ↓
  st8.html:1821  saveFileNotes(filepath) → reads textarea values
       ↓
  st8.html:1842  fetch POST /api/file-intent  ←── WORKS
       ↓
  server.js:239  _handleFileIntent(req, res)
       ↓
  persistence.js:202  upsertIntent() → INSERT INTO file_intent  ←── WORKS
       ↓
  SQLite file_intent table has data  ✅

READ-BACK PATH (broken at 3 points):
  SQLite file_intent table has data
       ↓
  ❌ BREAK #1: server.js:239 — no manifest regeneration after save
       ↓
  ❌ BREAK #2: indexer.js:261 — getIntent() never called during indexing
       ↓
  manifestGenerator.js:56 — f.intent always empty default
       ↓
  connection-state.json on disk — stale or missing intent
       ↓
  server.js:148  _serveManifest() → serves stale file
       ↓
  st8.html:1886  fetchManifest() → gets stale data
       ↓
  ❌ BREAK #3: st8.html:1853 — no re-fetch after save, UI stays stale
```


Now I have all the data. Here's the complete integration report:

---

# Integration Check: RT-4 — Graph Visualizer Polish

## Signal Path (Button Click → Graph Rendering)

### Step 1: GRAPH Button Definition
- **File:** `phreak-terminal.js:513`
- **Code:** `'<button class="phreak-tui-action-btn" data-action="show-graph" title="Show connection graph">GRAPH</button>'`
- Button is embedded in TUI toolbar HTML built by `_enterTUI()` (line 487-530)

### Step 2: Event Delegation Catches Click
- **File:** `phreak-terminal.js:565-567`
- **Code:**
  ```js
  if (e.target.closest('[data-action="show-graph"]')) {
      _showGraph();
  }
  ```
- Listener attached on the TUI overlay at line 546: `overlay.addEventListener('click', function(e) { ... })`

### Step 3: `_showGraph()` Resolves Manifest + Calls Visualizer
- **File:** `phreak-terminal.js:661-679`
- **Steps:**
  1. Gets manifest: `window.VoidFileExplorer.getIndexedFingerprints()` (line 662-664)
  2. Guards: no manifest → prints "No indexed files" (line 667-669)
  3. Guards: no `St8GraphVisualizer` → prints error (line 676)
  4. **Calls:** `window.St8GraphVisualizer.showGraphPopup(manifest)` (line 673)
  5. Logs "Connection graph opened." (line 674)

### Step 4: `showGraphPopup(manifest)` Creates Popup DOM
- **File:** `graph-visualizer.js:357-438`
- Creates `.graph-popup-overlay` → `.graph-popup` → header/body/footer
- Footer contains filter buttons (ALL/GREEN/YELLOW/RED) and RESET ZOOM button
- Appends to `document.body` (line 381)

### Step 5: `GraphVisualizer` Instantiation
- **File:** `graph-visualizer.js:385-391`
- **Code:**
  ```js
  var visualizer = new GraphVisualizer(container, {
      width: 800, height: 500,
      onNodeClick: function(node) { _showNodeDetails(node); }
  });
  ```

### Step 6: `initialize()` → Loads D3 → `_createSVG()`
- **File:** `graph-visualizer.js:58-61` → `graph-visualizer.js:63-85`
- `loadD3()` loads D3.js from CDN (`https://d3js.org/d3.v7.min.js`) or uses cached `window.d3`
- `_createSVG()`:
  - Clears container (line 65)
  - Creates `<svg>` with viewBox (lines 68-72)
  - **Zoom:** `d3.zoom().scaleExtent([0.1, 4])` applied to SVG (lines 75-81)
  - Appends main `<g>` group (line 84)

### Step 7: `setData(manifest)` → Builds Nodes + Links
- **File:** `graph-visualizer.js:87-119`
- **Nodes** (lines 90-99): Maps `manifest.files` → `{id, name, status, reachabilityScore, impactRadius, imports, importedBy}`
- **Links** (lines 102-118): Iterates file imports, matches targets by filepath/filename, creates `{source, target, type:'import'}`

### Step 8: `render()` → D3 Force Simulation + DOM Elements
- **File:** `graph-visualizer.js:121-267`
- **Simulation** (lines 130-134): `forceLink`, `forceManyBody(-300)`, `forceCenter`, `forceCollide(30)`
- **Links** (lines 137-187): `<line>` elements with hover tooltip showing `source → target`
- **Nodes** (lines 190-234): `<circle>` elements sized by impactRadius, colored by status, with drag + click handlers
- **Labels** (lines 237-249): `<text>` elements with filename
- **Tick** (lines 252-266): Updates positions each frame

### Step 9: `_currentVisualizer` Stored
- **File:** `graph-visualizer.js:398`
- `window.St8GraphVisualizer._currentVisualizer = visualizer;`
- Used by `resetZoom()` (line 444-453) and filter handler (line 415-436)

### Step 10: Filter Buttons Wired
- **File:** `graph-visualizer.js:402-437`
- Event delegation on `.graph-popup-footer`
- Updates active class, applies opacity to nodes/labels/links based on status match

---

## Fix Verification

### Fix 1: Zoom ✅ VERIFIED
| Aspect | Location | Code |
|--------|----------|------|
| Zoom behavior | `graph-visualizer.js:75-81` | `d3.zoom().scaleExtent([0.1, 4]).on('zoom', ...)` |
| Applied to SVG | `graph-visualizer.js:81` | `this.svg.call(this.zoom)` |
| Transform on `<g>` | `graph-visualizer.js:78` | `this.svg.select('g').attr('transform', event.transform)` |
| Reset button in footer | `graph-visualizer.js:376` | `<button ... onclick="window.St8GraphVisualizer.resetZoom()">RESET ZOOM</button>` |
| Reset implementation | `graph-visualizer.js:444-453` | `viz.svg.transition().duration(500).call(viz.zoom.transform, d3.zoomIdentity)` |
| Reset button style | `st8.html:424-439` | `.graph-popup-btn` styled with cyan border/text, hover fills cyan |

### Fix 2: Node Click ✅ VERIFIED
| Aspect | Location | Code |
|--------|----------|------|
| Click handler attached | `graph-visualizer.js:230-234` | `node.on('click', function(event, d) { this.onNodeClick(d); }.bind(this))` |
| Callback wired | `graph-visualizer.js:388-390` | `onNodeClick: function(node) { _showNodeDetails(node); }` |
| Details popup created | `graph-visualizer.js:281-347` | `_showNodeDetails(node)` — fixed-position popup with stats grid |
| Close via overlay click | `graph-visualizer.js:339-346` | Overlay at z-index 105, onclick removes both overlay + details |
| **BUG: Close via X button** | `graph-visualizer.js:306` | `onclick="this.parentElement.parentElement.remove()"` — removes details div ONLY, **leaves invisible overlay blocking graph popup** |

### Fix 3: Link Labels (Hover Tooltips) ✅ VERIFIED
| Aspect | Location | Code |
|--------|----------|------|
| Hover highlight | `graph-visualizer.js:147-153` | Link turns `#D4AF37` (gold), opacity 1, width 2 |
| Tooltip creation | `graph-visualizer.js:155-169` | Creates `#graph-link-tooltip` on `body` if missing |
| Tooltip content | `graph-visualizer.js:171` | `sourceName + ' → ' + targetName` |
| Tooltip positioning | `graph-visualizer.js:172-173` | Follows cursor with 12px offset |
| Mouse move | `graph-visualizer.js:176-179` | Tooltip follows mouse |
| Mouse out | `graph-visualizer.js:181-187` | Resets link style, hides tooltip |
| Tooltip style | `graph-visualizer.js:158-169` | Fixed, dark bg, cyan border, Poiret One 11px, z-index 1000 |

### Fix 4: Filters ✅ VERIFIED
| Aspect | Location | Code |
|--------|----------|------|
| Filter buttons | `graph-visualizer.js:369-372` | ALL/GREEN/YELLOW/RED with inline color styles |
| Event delegation | `graph-visualizer.js:402-403` | `.graph-popup-footer` click → `.graph-filter-btn` |
| Active state toggle | `graph-visualizer.js:409-412` | Remove/add `.active` class |
| ALL filter | `graph-visualizer.js:419-422` | All nodes/labels opacity 1, links 0.6 |
| Status filter | `graph-visualizer.js:424-435` | Matching nodes opacity 1, non-matching 0.1; matching links 0.6, non-matching 0.05 |
| Filter button styles | `st8.html:440-451` | `.graph-popup-filters` flex layout, `.active` bg, `.hover` opacity |

---

## CSS Coverage

All graph-related styles present in `st8.html`:

| Selector | Lines | Purpose |
|----------|-------|---------|
| `.graph-popup-overlay` | 350-360 | Full-screen backdrop with blur |
| `.graph-popup` | 361-374 | Popup container (900×700 max) |
| `.graph-popup-header` | 375-382 | Title bar with pink border |
| `.graph-popup-title` | 383-390 | Cyan "CONNECTION GRAPH" title |
| `.graph-popup-close` | 391-400 | Gold close button with hover glow |
| `.graph-popup-body` | 401-405 | Flex-1 container for SVG |
| `.graph-popup-body svg` | 406-408 | `display: block` on SVG |
| `.graph-popup-footer` | 409-416 | Footer with pink top border |
| `.graph-popup-info` | 417-423 | File count text |
| `.graph-popup-btn` | 424-439 | Cyan bordered button with hover fill |
| `.graph-popup-filters` | 440-443 | Flex row with 6px gap |
| `.graph-filter-btn.active` | 444-446 | White bg for active filter |
| `.graph-filter-btn:hover` | 447-451 | Subtle hover with `color: inherit !important` |

**No CSS gaps found.**

---

## Script Loading Order

**File:** `st8.html:1460-1464`
```html
<script src="file-explorer.js"></script>      <!-- Provides VoidFileExplorer.getIndexedFingerprints -->
<script src="phreak-terminal.js"></script>     <!-- References St8GraphVisualizer.showGraphPopup -->
<script src="graph-visualizer.js"></script>    <!-- Registers window.St8GraphVisualizer -->
<script src="settings-ui.js"></script>
<script src="coordination.js"></script>
```

**Order is correct:** `file-explorer.js` (data source) → `phreak-terminal.js` (caller) → `graph-visualizer.js` (provider). Since `_showGraph()` is only called at runtime (not at parse time), the late load of `graph-visualizer.js` is safe.

---

## Public API Wiring

| Export | File:Line | Consumer | File:Line | Status |
|--------|-----------|----------|-----------|--------|
| `window.St8GraphVisualizer.showGraphPopup` | `graph-visualizer.js:443` | `_showGraph()` | `phreak-terminal.js:673` | ✅ WIRED |
| `window.St8GraphVisualizer.resetZoom` | `graph-visualizer.js:444` | Footer button onclick | `graph-visualizer.js:376` | ✅ WIRED |
| `window.St8GraphVisualizer._currentVisualizer` | `graph-visualizer.js:455` | `resetZoom()` + filters | `graph-visualizer.js:416,446` | ✅ WIRED |
| `window.VoidFileExplorer.getIndexedFingerprints` | `file-explorer.js:661` | `_showGraph()` | `phreak-terminal.js:662` | ✅ WIRED |

---

## Detailed Findings

### 🟡 WARNING: Node Details Close Button Leaves Dead Overlay

**Location:** `graph-visualizer.js:306`

**Problem:** The `_showNodeDetails()` function creates two DOM elements:
1. A `details` div at `z-index: 110` (line 296)
2. An invisible overlay at `z-index: 105` (lines 339-346)

The close button uses an inline `onclick`:
```html
<button onclick="this.parentElement.parentElement.remove()" ...>◇</button>
```
This removes only the `details` div. The invisible overlay (`#graph-node-details-overlay`) remains at `z-index: 105`, which is **above** the graph popup overlay (`z-index: 100` from `.graph-popup-overlay`).

**Impact:** After clicking the X on a node details popup, the dead overlay blocks all mouse interaction with the graph. The user must click in the exact area where the invisible overlay sits (which triggers its `onclick` to remove itself) to regain control.

**Fix:** The close button onclick should also remove the overlay:
```js
// Line 306 — change from:
'<button onclick="this.parentElement.parentElement.remove()" ...'
// to:
'<button onclick="var o=document.getElementById(\'graph-node-details-overlay\');if(o)o.remove();this.parentElement.parentElement.remove()" ...'
```
Or better: use event delegation instead of inline onclick (consistent with phreak-terminal.js's CSP-safe approach).

### ℹ️ INFO: Duplicate `_escapeHtml` Definitions

- `phreak-terminal.js:259-265` — module-scoped
- `graph-visualizer.js:349-353` — module-scoped

Both are module-scoped (not on `window`), so no conflict. Each file uses its own copy. Functional but could be deduplicated.

### ℹ️ INFO: Link Tooltip DOM Leak

The `#graph-link-tooltip` element (created at `graph-visualizer.js:157-169`) is appended to `document.body` but never cleaned up by `destroy()` (`graph-visualizer.js:269-276`). The `destroy()` method stops the simulation and removes the SVG but not the tooltip. Minor leak — tooltip is hidden via `display:none` on mouseout.

---

## Status: **PASS with 1 WARNING**

| Check | Status | Details |
|-------|--------|---------|
| Signal path complete | ✅ PASS | Button → delegation → `_showGraph()` → `showGraphPopup()` → `GraphVisualizer` → D3 render |
| Zoom fix | ✅ PASS | `scaleExtent([0.1, 4])`, reset button calls `resetZoom()` with transition |
| Node click fix | ✅ PASS | Click handler → `_showNodeDetails()` popup with stats grid |
| Link labels fix | ✅ PASS | Hover highlights gold, tooltip shows `source → target` |
| Filters fix | ✅ PASS | ALL/GREEN/YELLOW/RED buttons toggle node/link opacity |
| CSS coverage | ✅ PASS | All 13 graph selectors present in `st8.html` |
| Script load order | ✅ PASS | file-explorer → phreak-terminal → graph-visualizer |
| Node details close | ⚠️ WARNING | X button leaves invisible overlay blocking graph (z-index 105 > 100) |


I now have a complete picture of the signal paths. Here is the structured report:

---

## Integration Check: RT-5 — Settings Persistence to SQLite

### Write Signal Path (UI change → SQLite)

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|--------------|
| 1 | HTML `onchange` | `settings-ui.js:134` | Boolean: `this.value === 'true'` → calls `window.St8Settings.updateValue(cat, key, bool)` |
| 1 | HTML `onchange` | `settings-ui.js:140` | Number: `parseFloat(this.value)` → calls `window.St8Settings.updateValue(cat, key, num)` |
| 1 | HTML `onchange` | `settings-ui.js:143` | String: `this.value` → calls `window.St8Settings.updateValue(cat, key, str)` |
| 2 | `updateValue()` | `settings-ui.js:162-171` | Sets `settingsState.entries[categoryId][key] = value` (in-memory), then calls `_persistSetting(categoryId, key, value)` |
| 3 | `_persistSetting()` | `settings-ui.js:173-185` | `fetch('/api/settings', { method: 'POST', body: JSON.stringify({ category, key, value }) })` |
| 4 | Router | `server.js:100-102` | `_handleApiRequest` matches `case '/api/settings'` → calls `_handleSettings(req, res, url)` |
| 5 | `_handleSettings` POST | `server.js:295-317` | Parses JSON body → validates `category` and `key` present → calls `persistence.upsertSetting(category, key, value)` |
| 6 | `upsertSetting()` | `persistence.js:245-251` | `INSERT OR REPLACE INTO st8_settings (category, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)` — value is `JSON.stringify(value)` if not already a string |

**Write path status: ✅ WIRED end-to-end**

---

### Read Signal Path (SQLite → UI on init)

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|--------------|
| 1 | Init trigger | `settings-ui.js:250` | `showSettingsPopup()` calls `loadSettings().then(() => renderSettingsPanel())` |
| 1 | Init trigger | `settings-ui.js:323` | `showSettingsInExplorer()` calls `loadSettings()` |
| 2 | `loadSettings()` | `settings-ui.js:187-207` | `fetch('/api/settings')` → parses JSON response → merges `result.data` into `settingsState.entries` |
| 3 | Router | `server.js:100-102` | `_handleApiRequest` matches `case '/api/settings'` → calls `_handleSettings(req, res, url)` |
| 4 | `_handleSettings` GET | `server.js:281-293` | Calls `persistence.getAllSettings()` (or `getSettingsByCategory(category)` if `?category=` query param) |
| 5 | `getAllSettings()` | `persistence.js:270-279` | `SELECT category, key, value FROM st8_settings ORDER BY category, key` → iterates rows → `JSON.parse(row.value)` per value → returns `{ category: { key: parsedValue } }` |
| 6 | Response | `server.js:292-293` | Returns `{ status: 'ok', data: { ... } }` |
| 7 | State merge | `settings-ui.js:196-198` | `Object.keys(result.data).forEach(cat => settingsState.entries[cat] = result.data[cat])` |
| 8 | Render | `settings-ui.js:102` | `renderCategoryEntries()` reads `settingsState.entries[categoryId]` to populate form fields |

**Read path status: ✅ WIRED end-to-end (on panel open)**

---

### Schema Verification

**Table:** `st8_settings` — defined at `persistence.js:98-104`

```sql
CREATE TABLE IF NOT EXISTS st8_settings (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, key)
);
```

| Check | Status | Detail |
|-------|--------|--------|
| Composite PK on (category, key) | ✅ | Ensures one value per category+key pair |
| INSERT OR REPLACE semantics | ✅ | `persistence.js:247` — upserts correctly on PK conflict |
| `updated_at` auto-set | ✅ | `CURRENT_TIMESTAMP` default; also explicitly set on update |
| Value stored as TEXT | ✅ | Non-string values JSON.stringified on write (`persistence.js:250`), JSON.parsed on read (`persistence.js:276`) |
| Schema applied on init | ✅ | `persistence.js:132` — `this.db.exec(ST8_SCHEMA)` runs all CREATE TABLE IF NOT EXISTS |

**Schema status: ✅ CORRECT**

---

### Value Serialization Roundtrip Verification

| JS Type | Write (UI → DB) | Stored in SQLite | Read (DB → UI) | Roundtrip OK? |
|---------|----------------|-----------------|----------------|---------------|
| `boolean` e.g. `true` | `JSON.stringify(true)` → `"true"` | TEXT `"true"` | `JSON.parse("true")` → `true` | ✅ |
| `number` e.g. `200` | `JSON.stringify(200)` → `"200"` | TEXT `"200"` | `JSON.parse("200")` → `200` | ✅ |
| `string` e.g. `"linear"` | Stored as-is (typeof check) | TEXT `"linear"` | `JSON.parse("linear")` throws → catch returns `"linear"` | ✅ |

---

### Issues Found

#### BLOCKER: None

No broken cross-phase connections. The write path and read path are fully wired.

#### WARNING — `settings-reader.js` is a parallel dead system

| Detail | |
|--------|---|
| **File** | `settings-reader.js:1-113` |
| **Issue** | Uses `LocalStorageAdapter` (localStorage), ES module `export class SettingsReader`, completely separate defaults. Does not connect to SQLite backend or `settings-ui.js` in any way. |
| **Impact** | If any consumer reads settings via `SettingsReader`, they get stale localStorage data, not SQLite-persisted values. Currently appears unused by the main app (not imported in `st8.html`). |

#### WARNING — `loadSettings()` not called on app boot

| Detail | |
|--------|---|
| **File** | `settings-ui.js:187-207` |
| **Issue** | `loadSettings()` is only called when the user opens the settings popup (`showSettingsPopup`, line 250) or explorer settings view (`showSettingsInExplorer`, line 323). There is no automatic call on page load. |
| **Impact** | If any other UI component needs settings values at startup (e.g., voidflow `reveal_wpm` controlling animation speed), they will use `DEFAULT_SETTINGS` rather than persisted values until the settings panel is manually opened. |

#### WARNING — `getSetting()` and `deleteSetting()` are orphaned

| Detail | |
|--------|---|
| **Files** | `persistence.js:253-258` (`getSetting`), `persistence.js:281-284` (`deleteSetting`) |
| **Issue** | These methods are defined but never called by any code. `server.js` only uses `upsertSetting`, `getAllSettings`, and `getSettingsByCategory`. |
| **Impact** | Dead code. `deleteSetting` means there is no UI path to remove a setting — only overwrite. |

#### INFO — New persistence instance per request

| Detail | |
|--------|---|
| **File** | `server.js:277-278` |
| **Issue** | Each `/api/settings` request creates a new `St8Persistence()` and calls `initialize()` (opens a new SQLite connection), then closes it. Same pattern at `server.js:246`. |
| **Impact** | Functional but wasteful. Works correctly due to SQLite's connection model, but adds latency per request. |

---

### Requirements Integration Map

| Requirement | Integration Path | Status | Issue |
|-------------|-----------------|--------|-------|
| RT-5: Settings Persistence to SQLite | UI onchange → `updateValue()` → `_persistSetting()` → `POST /api/settings` → `_handleSettings` → `upsertSetting()` → SQLite | **WIRED** | — |
| RT-5: Settings load on init | `loadSettings()` → `GET /api/settings` → `_handleSettings` → `getAllSettings()` → SQLite → merge into `settingsState.entries` | **PARTIAL** | Only loads when settings panel is opened, not on app boot |
| RT-5: Schema correctness | `st8_settings` table with composite PK (category, key), TEXT value, auto updated_at | **WIRED** | — |

---

### Summary

| Metric | Count |
|--------|-------|
| **Connected** | 6 write steps, 8 read steps — all verified |
| **Orphaned exports** | 2 (`getSetting`, `deleteSetting`) |
| **Missing connections** | 0 (no broken links) |
| **Broken flows** | 0 |
| **Warnings** | 3 (parallel settings-reader.js, no boot-time load, orphaned delete method) |

**Status: PASS** — The core write and read paths are fully wired end-to-end. Settings changes in the UI reach SQLite and persisted values roundtrip correctly back to the UI. The warnings are non-blocking: the parallel `settings-reader.js` is unused, the boot-time gap only matters if other components need settings before the panel is opened, and the orphaned methods are dead code.



---

# Integration Check: RT-6 TUI Buttons with Real Data

## Signal Path Report

---

### 1. GREEN / YELLOW / RED Buttons — click → filter → render

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|-------------|
| **1. Button HTML** | TUI toolbar buttons | `phreak-terminal.js:509-511` | Buttons created with `data-action="isolate-green"`, `"isolate-yellow"`, `"isolate-red"` |
| **2. Event Delegation** | `overlay.addEventListener('click', ...)` | `phreak-terminal.js:546` | Single listener on TUI overlay element |
| **3. Action Match** | `e.target.closest('[data-action="isolate-green"]')` | `phreak-terminal.js:553-560` | Each color matched via `closest()` selector |
| **4. Filter Call** | `_isolateFiles('GREEN')` / `'YELLOW'` / `'RED'` | `phreak-terminal.js:554, 557, 560` | Dispatches to `_isolateFiles` with status string |
| **5. Manifest Source** | `window.VoidFileExplorer.getIndexedFingerprints()` | `phreak-terminal.js:600-601` | Reads from `explorerState.indexedFingerprints` (`file-explorer.js:661`) |
| **6. Guard (no data)** | `if (!manifest \|\| !manifest.files)` | `phreak-terminal.js:604` | Pushes "No indexed files. Run INDEX first." system message |
| **7. Filter Logic** | `manifest.files.filter(f => f.status === status)` | `phreak-terminal.js:614` | Filters by exact status match |
| **8. Badge Update** | `_updateTUIBadges()` | `phreak-terminal.js:618` | Recounts and updates badge elements |
| **9. Terminal Log** | `_mkLine('system', '── GREEN FILES (N) ──')` | `phreak-terminal.js:620` | System line added to terminal output |
| **10. Terminal Render** | `_renderLines()` | `phreak-terminal.js:621` | Append-only render of new system line |
| **11. Render Call** | `window.renderFileList(filtered)` | `phreak-terminal.js:624-625` | Calls into `st8.html`'s global function |
| **12. Container** | `document.getElementById('void-file-list')` | `st8.html:1640` | Targets the right-panel file list container |
| **13. Guard (empty)** | Shows "No files indexed" message | `st8.html:1643-1645` | Empty state for no results |
| **14. Summary Build** | Counts green/yellow/red, builds summary bar | `st8.html:1649-1659` | Status dot summary with per-color counts |
| **15. File List Build** | `files.map(...)` with status dot + filename + action buttons | `st8.html:1661-1671` | Each file rendered as `.file-list-item` |
| **16. DOM Write** | `container.innerHTML = html` | `st8.html:1673` | Full innerHTML replacement of void right panel |

**Status: ✅ WIRED** — Complete path from button click through filter to DOM render. The `void-file-list` container must exist (created by `st8WorkspaceChanged('logic-analyzer')` at `st8.html:1594-1598`), so it only works in logic-analyzer workspace mode.

---

### 2. GRAPH Button — click → action

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|-------------|
| **1. Button HTML** | TUI toolbar button | `phreak-terminal.js:513` | `data-action="show-graph"` |
| **2. Event Match** | `e.target.closest('[data-action="show-graph"]')` | `phreak-terminal.js:565` | Delegation match in overlay click handler |
| **3. Function Call** | `_showGraph()` | `phreak-terminal.js:566` | Dispatched |
| **4. Manifest Source** | `window.VoidFileExplorer.getIndexedFingerprints()` | `phreak-terminal.js:662-663` | Same manifest source |
| **5. Guard (no data)** | Pushes "No indexed files. Run INDEX first." | `phreak-terminal.js:666-669` | Guard clause |
| **6. Graph Check** | `window.St8GraphVisualizer.showGraphPopup` | `phreak-terminal.js:672` | Checks graph-visualizer.js loaded |
| **7. Graph Call** | `window.St8GraphVisualizer.showGraphPopup(manifest)` | `phreak-terminal.js:673` | Passes full manifest |
| **8. Graph Impl** | Creates overlay with D3 graph visualization | `graph-visualizer.js:357-438` | Creates `.graph-popup-overlay`, initializes D3 visualizer, wires filter buttons |

**Status: ✅ WIRED** — Complete path. Graph-visualizer.js exports `showGraphPopup` at `graph-visualizer.js:443`.

---

### 3. SETTINGS Button — click → action

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|-------------|
| **1. Button HTML** | TUI toolbar button | `phreak-terminal.js:519` | `data-action="show-settings"` |
| **2. Event Match** | `e.target.closest('[data-action="show-settings"]')` | `phreak-terminal.js:577` | Delegation match |
| **3. Function Call** | `_showSettings()` | `phreak-terminal.js:578` | Dispatched |
| **4. Settings Check** | `window.St8Settings.showSettingsInExplorer` | `phreak-terminal.js:682` | Checks settings-ui.js loaded |
| **5. Settings Call** | `window.St8Settings.showSettingsInExplorer()` | `phreak-terminal.js:683` | Invokes settings renderer |
| **6. Settings Impl** | Renders settings UI into `#explorer-root` | `settings-ui.js:257-323` | Replaces explorer content with settings categories |

**Status: ✅ WIRED** — Complete path. Settings-ui.js exports `showSettingsInExplorer` at `settings-ui.js:330`.

---

### 4. CLEAR Buttons — click → clear

#### CLEAR VOID

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|-------------|
| **1. Button HTML** | TUI toolbar button | `phreak-terminal.js:516` | `data-action="clear-void"` |
| **2. Event Match** | `e.target.closest('[data-action="clear-void"]')` | `phreak-terminal.js:568` | Delegation match |
| **3. Function Call** | `_clearVoid()` | `phreak-terminal.js:569` | Dispatched |
| **4. DOM Clear** | `container.innerHTML = '...'` | `phreak-terminal.js:642-644` | Replaces `#void-file-list` with "No files indexed" message |
| **5. Terminal Log** | System line "Void cleared." | `phreak-terminal.js:646-647` | Terminal feedback |

**Status: ✅ WIRED**

#### CLEAR PHREAK

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|-------------|
| **1. Button HTML** | TUI toolbar button | `phreak-terminal.js:517` | `data-action="clear-phreak"` |
| **2. Event Match** | `e.target.closest('[data-action="clear-phreak"]')` | `phreak-terminal.js:571` | Delegation match |
| **3. Function Call** | `_clearPhreak()` | `phreak-terminal.js:572` | Dispatched |
| **4. State Reset** | `phreakState.lines = []; phreakState.lastRenderedIndex = -1` | `phreak-terminal.js:651-652` | Clears terminal state |
| **5. Full Render** | `_fullRender()` | `phreak-terminal.js:653` | Re-renders empty terminal |

**Status: ✅ WIRED**

#### CLEAR ALL

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|-------------|
| **1. Button HTML** | TUI toolbar button | `phreak-terminal.js:518` | `data-action="clear-all"` |
| **2. Event Match** | `e.target.closest('[data-action="clear-all"]')` | `phreak-terminal.js:574` | Delegation match |
| **3. Function Call** | `_clearAll()` | `phreak-terminal.js:575` | Dispatched |
| **4. Composes** | `_clearVoid() + _clearPhreak()` | `phreak-terminal.js:656-658` | Calls both clear functions |

**Status: ✅ WIRED**

---

### 5. Badge Update Path — manifest → badge display

| Step | Component | File:Line | What Happens |
|------|-----------|-----------|-------------|
| **1. Trigger: TUI Open** | `_enterTUI()` calls `_updateTUIBadges()` | `phreak-terminal.js:543` | Called once on TUI overlay creation |
| **2. Trigger: Button Click** | `_isolateFiles()` calls `_updateTUIBadges()` | `phreak-terminal.js:618` | Called on every GREEN/YELLOW/RED/ALL click |
| **3. Manifest Source** | `window.VoidFileExplorer.getIndexedFingerprints()` | `phreak-terminal.js:715-716` | Reads current manifest |
| **4. Guard** | `if (!manifest \|\| !manifest.files) return` | `phreak-terminal.js:719` | Early return if no data |
| **5. Count Logic** | Iterates `manifest.files`, counts by `f.status` | `phreak-terminal.js:721-726` | Builds `{green, yellow, red}` counts |
| **6. Badge Select** | `document.querySelectorAll('#phreak-tui-toolbar .phreak-badge')` | `phreak-terminal.js:728` | Finds all badge spans in TUI toolbar |
| **7. Badge Update** | Sets `badge.textContent` to count (or `''` if zero) | `phreak-terminal.js:729-735` | Per `data-badge` attribute (green/yellow/red/all) |
| **8. Badge CSS** | `.phreak-badge:empty { display: none }` | `st8.html:1357` | Empty badges auto-hide |

**Status: ⚠️ PARTIAL WIRED** — Badge update works when triggered, but see warnings below.

---

## Cross-Phase Data Flow Gaps

### GAP 1: Coordination Polling Does NOT Wire to `indexedFingerprints`

| Location | Detail |
|----------|--------|
| **Source** | `coordination.js:58-67` — `startPolling()` calls `loadManifest()` every 2s |
| **Expected Consumer** | `file-explorer.js:662` — `setIndexedFingerprints(fp)` |
| **Actual Wiring** | `st8.html:1875-1876` — only called from `st8IndexingComplete()` |
| **Missing Link** | `St8Coordination.addListener()` is exported (`coordination.js:205`) but **never called** anywhere in the codebase |
| **Impact** | Polling fetches fresh manifest from `/api/connection-state.json` every 2 seconds but the data is discarded — never propagated to `VoidFileExplorer.getIndexedFingerprints()` |

**Classification: WARNING** — Coordination polling runs but its data never reaches the TUI buttons' data source. Buttons only get data if user manually indexes via the file explorer's INDEX button.

### GAP 2: Badge Counts Not Updated After Indexing Completes

| Location | Detail |
|----------|--------|
| **Index Completion** | `st8.html:1867-1880` — `st8IndexingComplete()` calls `renderFileList()` and `setIndexedFingerprints()` |
| **Badge Update** | `_updateTUIBadges()` is only called from `_enterTUI()` and `_isolateFiles()` |
| **Missing** | `st8IndexingComplete()` does NOT call `_updateTUIBadges()` or any PhreakTerminal badge refresh |

**Classification: WARNING** — After indexing completes, the file list in the void right panel renders correctly, but TUI badge counts remain stale until the user clicks a filter button.

### GAP 3: `renderFileList` Called Without Void Right Panel Existing

| Location | Detail |
|----------|--------|
| **Container** | `#void-file-list` — created by `st8WorkspaceChanged('logic-analyzer')` at `st8.html:1594-1598` |
| **Guard** | `st8.html:1641` — `if (!container) return` silently exits |
| **Scenario** | TUI buttons call `renderFileList(filtered)` but if user is not in logic-analyzer workspace, `#void-file-list` doesn't exist |

**Classification: WARNING** — TUI is workspace-agnostic (always available), but `renderFileList` target only exists in logic-analyzer workspace. Filter results silently disappear in other workspaces.

---

## Requirements Integration Map

| Requirement | Integration Path | Status | Issue |
|-------------|-----------------|--------|-------|
| RT-6: TUI Buttons with Real Data | `phreak-terminal.js` TUI buttons → `_isolateFiles()` → `VoidFileExplorer.getIndexedFingerprints()` → `renderFileList()` | **PARTIAL** | Primary path works end-to-end when manifest is populated via INDEX button. However, coordination polling data is not wired to `indexedFingerprints`, and badges don't auto-refresh after indexing. |
| GREEN button filter | `phreak-terminal.js:553` → `:599-639` → `st8.html:1639-1674` | **WIRED** | Complete signal path verified |
| YELLOW button filter | `phreak-terminal.js:556` → `:599-639` → `st8.html:1639-1674` | **WIRED** | Complete signal path verified |
| RED button filter | `phreak-terminal.js:559` → `:599-639` → `st8.html:1639-1674` | **WIRED** | Complete signal path verified |
| ALL button | `phreak-terminal.js:562` → `:599-639` → `st8.html:1639-1674` | **WIRED** | Complete signal path verified |
| GRAPH button | `phreak-terminal.js:565` → `:661-679` → `graph-visualizer.js:357-438` | **WIRED** | Complete signal path verified |
| SETTINGS button | `phreak-terminal.js:577` → `:681-689` → `settings-ui.js:257-323` | **WIRED** | Complete signal path verified |
| CLEAR VOID | `phreak-terminal.js:568` → `:641-648` | **WIRED** | Complete signal path verified |
| CLEAR PHREAK | `phreak-terminal.js:571` → `:650-654` | **WIRED** | Complete signal path verified |
| CLEAR ALL | `phreak-terminal.js:574` → `:656-658` | **WIRED** | Complete signal path verified |
| Badge updates | `phreak-terminal.js:714-736` | **PARTIAL** | Works on button click and TUI open, but not auto-updated after indexing or coordination refresh |

---

## Final Status: **PASS with WARNINGS**

**Wired:** 9/10 button actions fully end-to-end verified with file:line references.

**Partial:** 1 item — Badge updates work for their defined triggers but have two refresh gaps:
1. Badges not refreshed when `st8IndexingComplete()` fires (`st8.html:1867`)
2. Coordination polling data never reaches `indexedFingerprints` — `St8Coordination.addListener()` is exported but never consumed (`coordination.js:205` has zero callers)

**Broken:** 0 items — No BLOCKER-level breaks found. All button click paths reach their target implementations.


I now have complete data. Here is the structured integration report:

---

## Integration Check Complete: RT-7 — void-engine.js Workspace Integration

### Signal Path (Full Trace)

```
STEP 1: User clicks WORKSPACE in sidebar
  file → file-explorer.js
  line 271 → onclick="window.VoidFileExplorer._showWorkspacePicker()"
  ↓
STEP 2: Workspace picker rendered with pretext-dev option
  file → file-explorer.js
  line 482-486 → workspaces array includes { id: 'pretext-dev', name: 'Pretext Dev' }
  line 516 → onclick="window.VoidFileExplorer._selectWorkspace('pretext-dev')"
  ↓
STEP 3: _selectWorkspace() updates state + emits signal
  file → file-explorer.js
  line 533 → function _selectWorkspace(wsType) {
  line 534 →   explorerState.workspaceType = wsType;
  line 538 →   if (window.st8WorkspaceChanged) {
  line 539 →     window.st8WorkspaceChanged(wsType);
              }
  ↓
STEP 4: st8WorkspaceChanged() receives 'pretext-dev'
  file → st8.html
  line 1584 → window.st8WorkspaceChanged = function(wsType) {
  line 1605 → } else if (wsType === 'pretext-dev') {
  line 1607 →   voidEl.classList.remove('split-mode');
  line 1612 →   window.St8Coordination.stopPolling();
  line 1616 →   if (window.loadVoidEngine) {
  line 1617 →     window.loadVoidEngine().then(() => {
  ↓
STEP 5: loadVoidEngine() dynamically injects script
  file → st8.html
  line 1432 → window.loadVoidEngine = function() {
  line 1433 →   if (document.querySelector('script[data-void-engine]')) return Promise.resolve();
  line 1436 →   script.type = 'module';
  line 1437 →   script.src = 'vendor/void-engine.js';
  line 1438 →   script.dataset.voidEngine = 'loaded';
  line 1441 →   document.body.appendChild(script);
  ↓
STEP 6: vendor/void-engine.js module executes
  file → vendor/void-engine.js
  line 2-7 → import { prepareWithSegments, layoutNextLine, ... } from "https://esm.sh/@chenglou/pretext@0.0.6"
  line 107 → var stage = document.getElementById("stage");
  line 114-122 → Creates cursorEl (void-cursor), appends to stage
  line 124-148 → Creates SIRKIT rect obstacles, appends to stage
  line 150 → await document.fonts.ready
  line 151 → preparedBody = prepareWithSegments(BODY_TEXT, BODY_FONT)
  line 154-172 → Attaches keydown listener (typing into void)
  line 236-261 → Attaches pointer handlers (drag rects)
  line 263-336 → Starts requestAnimationFrame(animate) loop
  line 337-338 → lastTime = performance.now(); requestAnimationFrame(animate)
```

### Conditional Loading

| Condition | Behavior | Correct? |
|-----------|----------|----------|
| `pretext-dev` selected | `loadVoidEngine()` called → injects `vendor/void-engine.js` as `<script type="module" data-void-engine="loaded">` | ✅ |
| `logic-analyzer` selected | `unloadVoidEngine()` called → removes script, clears `#stage` innerHTML | ✅ |
| `standard` selected | `unloadVoidEngine()` called → removes script, clears `#stage` innerHTML | ✅ |
| Re-load after unload | Guard `script[data-void-engine]` check returns null after removal → allows re-injection | ✅ |
| Double-load guard | `document.querySelector('script[data-void-engine]')` returns existing script → `Promise.resolve()` early return | ✅ |
| load failure | `.catch(err => console.error(...))` at st8.html:1620 | ✅ |

### CSS Coverage

| void-engine Element | CSS Rule in st8.html | Lines |
|---------------------|---------------------|-------|
| `#stage` (container) | `position: absolute; inset: 0; overflow: hidden;` | 72-76 |
| `.line` (text lines) | `position: absolute; white-space: pre; color: var(--text); z-index: 1; pointer-events: none;` | 78-86 |
| `.sirkit-rect` (drag obstacle) | `position: absolute; pointer-events: auto; z-index: 5; border: 1px solid var(--cyan);` (full styling) | 88-106 |
| `.void-cursor` (wave-pulse cursor) | Full animation styling with 5-child wave keyframes | 668-705 |
| `.void-cursor.visible` | `display: flex;` | 685 |
| `@keyframes void-wave` | opacity pulse 0.18 → 1 → 0.18 | 699-702 |
| `@media (prefers-reduced-motion)` | Disables cursor animation | 703-705 |

**CSS Verdict:** All void-engine DOM classes (`.line`, `.sirkit-rect`, `.void-cursor`) have complete CSS definitions in `st8.html`. ✅

### E2E Flow: Workspace Switch → void-engine Active

| Step | Component | Location | Status |
|------|-----------|----------|--------|
| 1. Click WORKSPACE in sidebar | file-explorer.js | line 271 | ✅ |
| 2. Workspace picker renders | file-explorer.js `_showWorkspacePicker()` | line 475 | ✅ |
| 3. Click "Pretext Dev" option | file-explorer.js onclick handler | line 516 | ✅ |
| 4. `_selectWorkspace('pretext-dev')` | file-explorer.js | line 533 | ✅ |
| 5. `window.st8WorkspaceChanged` called | file-explorer.js → st8.html | line 539 → line 1584 | ✅ WIRED |
| 6. `loadVoidEngine()` called | st8.html | line 1616 | ✅ |
| 7. `<script src="vendor/void-engine.js">` injected | st8.html | line 1437 | ✅ |
| 8. void-engine imports pretext from ESM CDN | vendor/void-engine.js | line 2-7 | ✅ |
| 9. void-engine targets `#stage` | vendor/void-engine.js | line 107 | ✅ |
| 10. `#stage` exists in DOM | st8.html | line 1387 | ✅ |
| 11. Animation loop runs | vendor/void-engine.js | line 338 | ✅ |

### E2E Flow: Workspace Switch → void-engine Unloaded

| Step | Component | Location | Status |
|------|-----------|----------|--------|
| 1. Select "Standard" or "Logic Analyzer" | file-explorer.js | line 516 | ✅ |
| 2. `st8WorkspaceChanged(wsType)` called | st8.html | line 1584 | ✅ |
| 3. `unloadVoidEngine()` called | st8.html | line 1604/1634 | ✅ |
| 4. Script element removed | st8.html | line 1445-1446 | ✅ |
| 5. `#stage` innerHTML cleared | st8.html | line 1447-1448 | ✅ |

### Orphaned Exports

None. All key exports are consumed:

| Export | Source | Consumer | Status |
|--------|--------|----------|--------|
| `window.VoidFileExplorer._selectWorkspace` | file-explorer.js:533 | st8.html onclick (line 516) | ✅ |
| `window.st8WorkspaceChanged` | st8.html:1584 | file-explorer.js:539 | ✅ |
| `window.loadVoidEngine` | st8.html:1432 | st8.html:1616 | ✅ |
| `window.unloadVoidEngine` | st8.html:1444 | st8.html:1604,1634 | ✅ |
| `window.St8Coordination.startPolling` | coordination.js:58 | st8.html:1601 | ✅ |
| `window.St8Coordination.stopPolling` | coordination.js:72 | st8.html:1614,1630 | ✅ |

### Requirements Integration Map

| Requirement | Integration Path | Status | Issue |
|-------------|-----------------|--------|-------|
| RT-7: Workspace selection triggers void-engine | file-explorer.js:533 → st8.html:1584 → st8.html:1432 → vendor/void-engine.js:1 | **WIRED** | — |
| RT-7: Conditional loading (only pretext-dev) | st8.html:1605 condition gates loadVoidEngine() | **WIRED** | — |
| RT-7: Unload on workspace switch away | st8.html:1604,1634 gate unloadVoidEngine() | **WIRED** | — |
| RT-7: Double-load prevention | st8.html:1433 data-void-engine attribute check | **WIRED** | — |
| RT-7: void-engine CSS in st8.html | .line, .sirkit-rect, .void-cursor all styled | **WIRED** | — |

### Status: **PASS**

**All cross-phase connections verified end-to-end.** The signal path from workspace selection through void-engine activation is complete and correctly wired:

1. **file-explorer.js → st8.html**: `_selectWorkspace()` calls `window.st8WorkspaceChanged()` via global function bridge ✅
2. **st8.html → vendor/void-engine.js**: `loadVoidEngine()` dynamically injects the `<script type="module">` tag ✅
3. **vendor/void-engine.js → st8.html DOM**: Module targets `#stage` element that exists in st8.html ✅
4. **vendor/void-engine.js → ESM CDN**: `import ... from "https://esm.sh/@chenglou/pretext@0.0.6"` ✅
5. **Conditional logic**: Only `pretext-dev` triggers loading; `logic-analyzer` and `standard` trigger unloading ✅
6. **CSS**: All void-engine DOM classes have complete styling in st8.html ✅

**One minor note (not a blocker):** After `unloadVoidEngine()` removes the script element and clears `#stage`, the void-engine's `requestAnimationFrame` loop and `keydown`/`pointermove` event listeners continue executing (harmless no-ops since `stage` innerHTML is empty and DOM refs are stale). A full cleanup would require the void-engine module to export a `destroy()` function. This is a design limitation, not a wiring failure.
