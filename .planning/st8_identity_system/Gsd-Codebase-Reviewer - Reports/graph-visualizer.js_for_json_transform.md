# graph-visualizer.js — Detailed Line-by-Line Code Review

**File:** `/home/bozertron/1_AT_A_TIME/st8/graph-visualizer.js`
**Reviewed:** 2026-05-13T12:00:00Z
**Total Lines:** 456
**Status:** ISSUES FOUND — 3 Critical, 4 Warnings, 3 Info

---

## FILE HEADER — Lines 1-12

```
Lines 1-12: File header and strict mode declaration
- What triggers it: File load via <script src="graph-visualizer.js"> in st8.html:1663
- What it calls: Nothing
- What calls it: Browser script loader
- Dependencies: None
- Status: WORKING
- Gap: None — header is documentation-only, 'use strict' is correctly placed
```

### @@@ HANDLING
**No `@@@` symbols found in the file.** Clean.

---

## SECTION 1: D3 LOADING — Lines 14-40

```
Lines 14-40: D3.js library loader (CDN-based with caching)
- What triggers it: Called by GraphVisualizer.initialize() at line 59
- What it calls: document.createElement('script'), document.head.appendChild()
- What calls it: GraphVisualizer.initialize() → loadD3() at line 59
- Dependencies: External CDN https://d3js.org/d3.v7.min.js
- Status: WORKING (but has security and reliability gaps)
- Gap: No SRI hash on CDN script, no offline fallback, no timeout handling
```

### Line-by-line breakdown:

| Lines | Code | Analysis |
|-------|------|----------|
| 16 | `let d3 = null;` | Module-level cache variable. Correct — prevents re-loading. |
| 18-40 | `function loadD3()` | Async loader returning Promise. |
| 19 | `if (d3) return d3;` | **BUG:** Returns `d3` (an object) synchronously from a function that returns a `Promise` in all other paths. Callers use `await loadD3()` (line 59) so `await` on a non-Promise just resolves immediately — this works, but is inconsistent. If a caller ever did `.then()` on the return value, it would break. |
| 22-39 | `return new Promise(...)` | Standard dynamic script injection pattern. |
| 23-27 | `if (window.d3) { ... }` | Correctly checks for pre-existing D3 (e.g., if another script already loaded it). |
| 29-30 | `script.src = 'https://d3js.org/d3.v7.min.js'` | **SECURITY:** No Subresource Integrity (SRI) hash. If the CDN is compromised, arbitrary JS executes in the page. Should use `integrity="sha384-..."` attribute. |
| 31-34 | `script.onload` | Correctly resolves promise with `window.d3`. |
| 35-37 | `script.onerror` | Correctly rejects on load failure. |
| 38 | `document.head.appendChild(script)` | Triggers async download. Correct. |

### FINDINGS:

**CR-01: CDN Script Without SRI (Security)**
- **File:** `graph-visualizer.js:30`
- **Issue:** D3.js loaded from CDN `https://d3js.org/d3.v7.min.js` without Subresource Integrity (SRI) hash. If the CDN is compromised (supply chain attack), malicious JavaScript executes in the user's browser context with full DOM access.
- **Fix:**
```javascript
script.src = 'https://d3js.org/d3.v7.min.js';
script.integrity = 'sha384-<hash-of-d3-v7-min-js>';
script.crossOrigin = 'anonymous';
```

**WR-01: Inconsistent Return Type in loadD3() (Bug)**
- **File:** `graph-visualizer.js:19`
- **Issue:** When D3 is already cached, `loadD3()` returns the raw `d3` object synchronously. All other code paths return a `Promise`. The single caller (`await loadD3()` at line 59) handles this correctly via `await`, but the function signature is misleading and fragile.
- **Fix:**
```javascript
function loadD3() {
    if (d3) return Promise.resolve(d3);
    // ...
}
```

---

## SECTION 2: GRAPH VISUALIZER CLASS — Lines 42-277

### Lines 44-56: Constructor

```
Lines 44-56: GraphVisualizer constructor
- What triggers it: new GraphVisualizer(container, options) at line 385
- What it calls: Nothing (initialization only)
- What calls it: showGraphPopup() at line 385
- Dependencies: container (DOM element), options object
- Status: WORKING
- Gap: No input validation on container or options
```

| Lines | Code | Analysis |
|-------|------|----------|
| 46 | `this.container = container;` | No null check. If null, `_createSVG()` at line 65 crashes. |
| 47 | `this.width = options.width \|\| 800;` | Default is fine. But `options` itself isn't checked — if undefined, throws. |
| 48 | `this.height = options.height \|\| 600;` | Same pattern, same risk. |
| 49-50 | `this.nodes = []; this.links = [];` | Correct empty initialization. |
| 51-53 | `this.simulation = null; this.svg = null; this.zoom = null;` | Correct null init. |
| 54 | `this.onNodeClick = options.onNodeClick \|\| null;` | Optional callback. Fine. |
| 55 | `this._filterStatus = null;` | Unused field — never read or written elsewhere. Dead code. |

**IN-01: Unused Field `_filterStatus`**
- **File:** `graph-visualizer.js:55`
- **Issue:** `this._filterStatus` is initialized but never read or written in the entire class.
- **Fix:** Remove line 55.

### Lines 58-61: initialize()

```
Lines 58-61: Async initialization — loads D3, creates SVG
- What triggers it: visualizer.initialize().then(...) at line 393
- What it calls: loadD3() (line 18), _createSVG() (line 63)
- What calls it: showGraphPopup() at line 393
- Dependencies: D3 CDN
- Status: WORKING
- Gap: No error handling — if loadD3() rejects, the promise rejection is unhandled
```

| Lines | Code | Analysis |
|-------|------|----------|
| 59 | `await loadD3();` | If D3 fails to load (CDN down), this throws. Caller at line 393 uses `.then()` with no `.catch()`. |
| 60 | `this._createSVG();` | Only runs if D3 loaded successfully. |

**WR-02: Missing Error Handler on initialize() Chain (Bug)**
- **File:** `graph-visualizer.js:393-399`
- **Issue:** `visualizer.initialize().then(...)` has no `.catch()`. If D3 CDN is unreachable, the rejection is unhandled — console error, silent failure, user sees empty popup with no feedback.
- **Fix:**
```javascript
visualizer.initialize().then(function() {
    visualizer.setData(manifest);
    visualizer.render();
    window.St8GraphVisualizer._currentVisualizer = visualizer;
}).catch(function(err) {
    console.error('[St8GraphVisualizer] Failed to initialize:', err);
    container.innerHTML = '<div style="color:#C9748F;padding:20px;text-align:center;font-family:Poiret One,sans-serif;">Failed to load graph engine. Check network connection.</div>';
});
```

### Lines 63-85: _createSVG()

```
Lines 63-85: SVG creation with zoom behavior
- What triggers it: Called by initialize() at line 60
- What it calls: d3.select(), d3.zoom(), svg.call()
- What calls it: initialize() (internal)
- Dependencies: D3.js (loaded), this.container (DOM element)
- Status: WORKING
- Gap: None — standard D3 SVG setup
```

| Lines | Code | Analysis |
|-------|------|----------|
| 65 | `this.container.innerHTML = '';` | Clears container. Correct. |
| 68-72 | SVG creation with width/height/viewBox | Standard D3 pattern. `viewBox` enables responsive scaling. |
| 75-79 | Zoom behavior | `scaleExtent([0.1, 4])` — reasonable zoom range. The `.bind(this)` at line 79 correctly captures the class context for `this.svg`. |
| 81 | `this.svg.call(this.zoom);` | Attaches zoom to SVG. Correct. |
| 84 | `this.svg.append('g');` | Creates the main group for all graph elements. Required for zoom transforms. |

### Lines 87-119: setData(manifest)

```
Lines 87-119: Transforms manifest data into D3-compatible nodes and links
- What triggers it: visualizer.setData(manifest) at line 394
- What it calls: manifest.files.map(), manifest.files.forEach(), Array.find()
- What calls it: showGraphPopup() → initialize().then() at line 394
- Dependencies: manifest object with { files: [...] } shape
- Status: BROKEN — import link resolution fails for many real-world manifests
- Gap: Import matching logic doesn't handle path resolution correctly
```

| Lines | Code | Analysis |
|-------|------|----------|
| 88 | `if (!manifest \|\| !manifest.files) return;` | Guard clause. Correct. |
| 90-100 | Node mapping | Maps `file.filepath` → `id`, `file.filename` → `name`. Correct. |
| 102 | `this.links = [];` | Clears previous links. Correct. |
| 103-118 | Link building | Iterates files, iterates each file's imports, tries to find matching target. |
| 106-108 | `manifest.files.find(f => f.filepath === imp.source \|\| f.filename === imp.source)` | **BUG:** This matching logic is fragile. |

**CR-02: Import Link Resolution Fails for Relative Paths (Bug)**
- **File:** `graph-visualizer.js:106-108`
- **Issue:** Import sources in real manifests are relative paths like `"./integr8/dataIngestion.js"` (see `connection-state.json:699-701`). The matching tries `f.filepath === imp.source` — but `f.filepath` is `"lib/commands/integr8/dataIngestion.js"` while `imp.source` is `"./integr8/dataIngestion.js"`. These never match. Result: **most import links are silently dropped**, producing a sparse/disconnected graph.
- **Data evidence:** `connection-state.json` shows imports like `"./integr8/databasePersister.js"`, `"./parserPersistence.js"` — none match filepath format.
- **Fix:**
```javascript
// Normalize paths for matching
var normalizedSource = imp.source.replace(/^\.\//, '').replace(/\.js$/, '');
var target = manifest.files.find(function(f) {
    var normalizedPath = f.filepath.replace(/^\.\//, '').replace(/\.js$/, '');
    return normalizedPath === normalizedSource ||
           normalizedPath.endsWith('/' + normalizedSource) ||
           f.filename.replace(/\.js$/, '') === normalizedSource;
});
```

**WR-03: O(n²) Link Building Performance (Quality)**
- **File:** `graph-visualizer.js:103-118`
- **Issue:** For each file's each import, `Array.find()` scans the entire files array. With N files and M average imports per file, this is O(N × M × N). For large codebases (1000+ files), this becomes slow.
- **Fix:** Pre-build a lookup Map:
```javascript
var fileMap = new Map();
manifest.files.forEach(function(f) {
    fileMap.set(f.filepath, f);
    fileMap.set(f.filename, f);
});
// Then: var target = fileMap.get(imp.source);
```

### Lines 121-267: render()

```
Lines 121-267: Main render method — creates D3 force simulation, links, nodes, labels
- What triggers it: visualizer.render() at line 395
- What it calls: d3.forceSimulation(), d3.forceLink(), d3.forceManyBody(), d3.forceCenter(),
                 d3.forceCollide(), d3.drag(), d3.select()
- What calls it: showGraphPopup() → initialize().then() at line 395
- Dependencies: D3.js, this.nodes, this.links (from setData())
- Status: WORKING (with minor issues)
- Gap: No bounds checking on node positions, no animation on filter changes
```

#### Lines 121-134: Simulation Setup

| Lines | Code | Analysis |
|-------|------|----------|
| 122 | `if (!this.svg \|\| !d3) return;` | Guard clause. Correct. |
| 124 | `var g = this.svg.select('g');` | Selects the main group from `_createSVG()`. |
| 127 | `g.selectAll('*').remove();` | Clears previous render. Correct for re-render. |
| 130-134 | Force simulation setup | Standard D3 forces: link (distance=100), charge (-300), center, collision (radius=30). |

#### Lines 136-187: Link Rendering

| Lines | Code | Analysis |
|-------|------|----------|
| 137-146 | Link line creation | Standard D3 data join. Gray (#9E9E9E), semi-transparent, 1px width. |
| 147-174 | Link mouseover handler | Creates/updates tooltip div. |
| 148-149 | `typeof d.source === 'object' ? d.source.name : d.source` | **Correct pattern.** D3's forceLink mutates `source`/`target` from IDs to objects after simulation starts. This handles both pre- and post-mutation states. |
| 155-170 | Tooltip creation | Creates `#graph-link-tooltip` div with inline styles. CSS variables used for colors. |
| 159 | `.style('position', 'fixed')` | Fixed positioning — correct for tooltip that follows cursor. |
| 171 | `tooltip.html(sourceName + ' → ' + targetName)` | **SECURITY:** `sourceName` and `targetName` come from manifest data (filepath/filename). If a filename contains HTML like `<img onerror=alert(1)>`, this is XSS. |
| 176-179 | Link mousemove handler | Updates tooltip position. Correct. |
| 181-187 | Link mouseout handler | Resets stroke, hides tooltip. Correct. |

**CR-03: XSS via Link Tooltip (Security)**
- **File:** `graph-visualizer.js:171`
- **Issue:** `sourceName` and `targetName` are derived from `d.source.name`/`d.target.name` (filenames from manifest) and injected into the DOM via `.html()`. If a filename contains HTML/script tags, it executes. A malicious repo with a file named `<img src=x onerror=alert(document.cookie)>` would trigger this.
- **Fix:**
```javascript
tooltip.text(sourceName + ' → ' + targetName); // .text() escapes HTML
```
Or use the existing `_escapeHtml()` function:
```javascript
tooltip.html(_escapeHtml(sourceName) + ' → ' + _escapeHtml(targetName));
```

#### Lines 189-227: Node Rendering

| Lines | Code | Analysis |
|-------|------|----------|
| 190-195 | Node circle creation | Standard D3 data join. |
| 196-200 | Radius calculation | `base(6) + min(impactRadius, 10) * 2.5` → range 6-31px. Good — prevents massive nodes. |
| 201-208 | Fill color by status | GREEN→#D4AF37 (gold), YELLOW→#1FBDEA (cyan), RED→#C9748F (pink). **Note:** These colors match the project's theme CSS variables. |
| 209-210 | Stroke/stroke-width | Dark border, 1.5px. |
| 211 | `style('cursor', 'pointer')` | Indicates clickability. Correct. |
| 212-227 | Drag behavior | Standard D3 drag with simulation restart. `.bind(this)` correctly used for `this.simulation` access. |

#### Lines 229-234: Click Handler

| Lines | Code | Analysis |
|-------|------|----------|
| 230-234 | Conditional click handler | Only attached if `this.onNodeClick` was provided. Correct. |
| 232 | `this.onNodeClick(d)` | Passes D3 node datum. The callback is `_showNodeDetails` (line 389). |

#### Lines 236-249: Label Rendering

| Lines | Code | Analysis |
|-------|------|----------|
| 237-249 | Text labels | Positioned at node center, offset 20px down (`dy: 20`). `pointer-events: none` prevents label from blocking node interactions. |
| 243 | `text(function(d) { return d.name; })` | Uses filename, not full path. Good for readability. |

#### Lines 251-266: Tick Handler

| Lines | Code | Analysis |
|-------|------|----------|
| 252-266 | Simulation tick | Updates positions of links, nodes, and labels on each simulation frame. Standard D3 pattern. |

### Lines 269-277: destroy()

```
Lines 269-277: Cleanup method
- What triggers it: NEVER CALLED — this is dead code
- What it calls: simulation.stop(), svg.remove()
- What calls it: NOTHING — showGraphPopup() removes overlay DOM directly via onclick
- Dependencies: None
- Status: NOT CONNECTED
- Gap: destroy() exists but is never invoked; simulation may leak
```

**WR-04: destroy() Never Called — Simulation Memory Leak (Bug)**
- **File:** `graph-visualizer.js:269-277`
- **Issue:** When the popup is closed (via the `◇` button or overlay click), the DOM elements are removed, but `GraphVisualizer.destroy()` is never called. The D3 force simulation continues running in the background (requesting animation frames), consuming CPU. The `simulation` and `svg` references remain in memory.
- **Fix:** In `showGraphPopup()`, wire the close button to call `visualizer.destroy()`:
```javascript
// In showGraphPopup(), after creating visualizer:
overlay.querySelector('.graph-popup-close').addEventListener('click', function() {
    if (window.St8GraphVisualizer._currentVisualizer) {
        window.St8GraphVisualizer._currentVisualizer.destroy();
        window.St8GraphVisualizer._currentVisualizer = null;
    }
    overlay.remove();
});
// And remove the inline onclick from the HTML
```

---

## SECTION 3: NODE DETAILS POPUP — Lines 279-353

### Lines 281-347: _showNodeDetails(node)

```
Lines 281-347: Displays detailed node information in a modal popup
- What triggers it: Node click → onNodeClick callback → _showNodeDetails(node) at line 389
- What it calls: document.getElementById(), document.createElement(), _escapeHtml()
- What calls it: GraphVisualizer.onNodeClick callback (line 389)
- Dependencies: DOM, CSS variables (--pink, --cyan, --gold, --text)
- Status: WORKING (with XSS gaps)
- Gap: Inconsistent HTML escaping — some fields escaped, others not
```

| Lines | Code | Analysis |
|-------|------|----------|
| 283-284 | Remove existing popup | Correct — prevents duplicate popups. |
| 286-290 | Status color map | Maps GREEN/YELLOW/RED to theme colors. |
| 292-297 | Create popup div | Fixed position, centered, themed styling. |
| 299 | `statusColor[node.status] \|\| '#E0E0E0'` | Fallback for unknown status. Correct. |
| 300-301 | Import counts | `node.imports.length` — **potential crash** if imports is not an array (see WR-05). |
| 303-334 | `details.innerHTML = ...` | **Multiple XSS vectors here:** |
| 309 | `_escapeHtml(node.name)` | ✅ SAFE — escaped |
| 310 | `_escapeHtml(node.id)` | ✅ SAFE — escaped |
| 314 | `node.reachabilityScore` | ❌ **UNSAFE** — directly interpolated. Should be `_escapeHtml(String(node.reachabilityScore))` |
| 318 | `node.impactRadius` | ❌ **UNSAFE** — directly interpolated. Should be `_escapeHtml(String(node.impactRadius))` |
| 331-332 | `node.status` | ❌ **UNSAFE** — directly interpolated into HTML. If status is `<script>alert(1)</script>`, it executes. |
| 336 | `document.body.appendChild(details)` | Appends to body. Correct. |
| 339-346 | Overlay click-to-close | Creates transparent overlay behind popup. `insertBefore` ensures overlay is behind the popup in z-order. |

**CR-03 (continued): XSS in _showNodeDetails()**
- **File:** `graph-visualizer.js:314, 318, 331-332`
- **Issue:** `node.reachabilityScore`, `node.impactRadius`, and `node.status` are injected into innerHTML without escaping. While these are *typically* numbers/enum values from the backend, the manifest data comes from `window.VoidFileExplorer.getIndexedFingerprints()` which could contain user-supplied or corrupted data.
- **Fix:** Use `_escapeHtml()` for all interpolated values:
```javascript
'<div ...>' + _escapeHtml(String(node.reachabilityScore)) + '</div>' +
// ...
'<div ...>' + _escapeHtml(String(node.impactRadius)) + '</div>' +
// ...
'    ' + _escapeHtml(node.status) + '\n' +
```

**WR-05: No Type Guard on node.imports/node.importedBy (Bug)**
- **File:** `graph-visualizer.js:300-301`
- **Issue:** `node.imports ? node.imports.length : 0` checks for truthiness but not for array type. If `node.imports` is a non-array truthy value (e.g., an object), `.length` returns `undefined`, which displays as "undefined" in the popup.
- **Fix:**
```javascript
var importCount = Array.isArray(node.imports) ? node.imports.length : 0;
var importedByCount = Array.isArray(node.importedBy) ? node.importedBy.length : 0;
```

### Lines 349-353: _escapeHtml(str)

```
Lines 349-353: HTML entity escaping utility
- What triggers it: Called by _showNodeDetails() at lines 309, 310
- What it calls: String.replace() with regex
- What calls it: _showNodeDetails() (internal)
- Dependencies: None
- Status: WORKING
- Gap: Used inconsistently — some innerHTML interpolations use it, others don't
```

| Lines | Code | Analysis |
|-------|------|----------|
| 350 | `if (!str) return '';` | Handles null/undefined/empty. Correct. |
| 351-352 | Regex replacements | Escapes `& < > " '` — covers OWASP XSS prevention basics. Correct. |

**IN-02: _escapeHtml() Defined But Underused (Quality)**
- **File:** `graph-visualizer.js:349-353`
- **Issue:** The function exists and works correctly, but is only applied to `node.name` and `node.id` (lines 309-310). Three other interpolated values in the same innerHTML block (lines 314, 318, 331) skip escaping.
- **Fix:** Apply `_escapeHtml()` to all user-data-derived interpolations in the innerHTML block.

---

## SECTION 4: GRAPH POPUP — Lines 355-438

### Lines 357-438: showGraphPopup(manifest)

```
Lines 357-438: Main entry point — creates popup overlay, initializes graph, wires filters
- What triggers it: window.St8GraphVisualizer.showGraphPopup(manifest) from phreak-terminal.js:673
- What it calls: GraphVisualizer constructor (line 385), initialize() (line 393), setData() (line 394),
                 render() (line 395), DOM manipulation, _showNodeDetails (via callback)
- What calls it: _showGraph() in phreak-terminal.js:661-679, triggered by [data-action="show-graph"] button
- Dependencies: phreak-terminal.js (caller), file-explorer.js (data source), D3.js (runtime)
- Status: WORKING (with issues documented above)
- Gap: No cleanup on close, race condition on filter click during init
```

#### Lines 357-381: Popup HTML Construction

| Lines | Code | Analysis |
|-------|------|----------|
| 359-360 | Create overlay div | Uses CSS class `.graph-popup-overlay` (styled in st8.html:371-380). Correct. |
| 361-379 | Inner HTML structure | Header (title + close button), body (graph container), footer (filters + info + reset zoom). |
| 364 | Close button `onclick` | `this.closest('.graph-popup-overlay').remove()` — removes entire overlay. **Does NOT call `destroy()` on the visualizer** (see WR-04). |
| 369 | Filter buttons | data-filter attributes: ALL, GREEN, YELLOW, RED. |
| 375 | File count display | `manifest.files.length` — safe (number). |
| 376 | Reset zoom button | Calls `window.St8GraphVisualizer.resetZoom()`. Correct. |
| 381 | `document.body.appendChild(overlay)` | Adds popup to DOM. |

#### Lines 383-399: Graph Initialization

| Lines | Code | Analysis |
|-------|------|----------|
| 384 | `document.getElementById('graph-popup-body')` | Gets the body container. Correct — it was just created at line 366. |
| 385-391 | `new GraphVisualizer(container, {...})` | Creates visualizer with 800×500 dimensions, click callback. |
| 388-390 | `onNodeClick: function(node) { _showNodeDetails(node); }` | Wires node clicks to details popup. Correct. |
| 393-399 | Async initialization chain | Loads D3 → creates SVG → sets data → renders → stores reference. |

**WR-02 (continued): Race Condition During Initialization**
- **File:** `graph-visualizer.js:393-399, 402-437`
- **Issue:** The filter button event listener (line 402) is attached synchronously, but the visualizer initialization (line 393) is async. If a user clicks a filter button before `initialize()` completes, `window.St8GraphVisualizer._currentVisualizer` is still `null` (line 415 check prevents crash, but filter silently does nothing).
- **Impact:** Minor — unlikely in practice since D3 loads quickly, but the UI is misleading (filter buttons are clickable before graph exists).

#### Lines 401-437: Filter Button Wiring

| Lines | Code | Analysis |
|-------|------|----------|
| 402 | Event delegation on footer | Uses event delegation — correct pattern for dynamic content. |
| 403 | `.closest('.graph-filter-btn')` | Finds the button even if click is on child element. Correct. |
| 406 | `btn.getAttribute('data-filter')` | Gets filter value. Correct. |
| 409-412 | Active button state | Removes `active` from all, adds to clicked. Correct. |
| 415-436 | Apply filter | Accesses `_currentVisualizer.svg.select('g')`. |
| 419-422 | ALL filter | Sets all elements to full opacity. Correct. |
| 424-435 | Status filter | Sets matching nodes/labels to opacity 1, non-matching to 0.1. Links: 0.6 if connected to matching status, 0.05 otherwise. |
| 431-432 | `typeof d.source === 'object'` | Correctly handles D3's mutation of link source/target. |

**IN-03: Filter Opacity Changes Are Instantaneous (Quality)**
- **File:** `graph-visualizer.js:420-435`
- **Issue:** Filter changes apply immediately with no transition. The rest of the UI uses smooth transitions (e.g., `.graph-popup-btn` has `transition: all 160ms ease`). Adding a CSS transition or D3 transition would improve UX.
- **Fix:**
```javascript
g.selectAll('.nodes circle').transition().duration(200).style('opacity', function(d) {
    return d.status === filter ? 1 : 0.1;
});
```

---

## SECTION 5: PUBLIC API — Lines 440-456

```
Lines 440-456: Exports API to window.St8GraphVisualizer
- What triggers it: Script load (immediate execution)
- What it calls: Nothing
- What calls it: phreak-terminal.js:672-673 (showGraphPopup), inline onclick (resetZoom)
- Dependencies: window global scope
- Status: WORKING
- Gap: _currentVisualizer reference management is fragile
```

| Lines | Code | Analysis |
|-------|------|----------|
| 442-455 | `window.St8GraphVisualizer = {...}` | Exposes public API. |
| 443 | `showGraphPopup: showGraphPopup` | Main entry point. |
| 444-453 | `resetZoom: function()` | Resets zoom to identity transform with 500ms animation. |
| 447-449 | `viz.svg.transition().duration(500).call(viz.zoom.transform, d3.zoomIdentity)` | Correct D3 zoom reset. |
| 455 | `_currentVisualizer: null` | Stores active visualizer instance. Used by resetZoom and filters. |

**Note:** `_currentVisualizer` is a semi-private field exposed on the public API object. This works but couples internal state to the public interface.

---

## CONNECTION MAP

### What triggers graph visualization?
```
User clicks [data-action="show-graph"] button in phreak-terminal UI
  → phreak-terminal.js:565-566: _showGraph()
  → phreak-terminal.js:661-679: Gets manifest from VoidFileExplorer.getIndexedFingerprints()
  → phreak-terminal.js:672-673: Calls window.St8GraphVisualizer.showGraphPopup(manifest)
  → graph-visualizer.js:357-438: Creates popup, initializes GraphVisualizer, renders
```

### What other files get called?
| File | How | Line |
|------|-----|------|
| `st8.html` | Loads script via `<script src="graph-visualizer.js">` | 1663 |
| `st8.html` | CSS for `.graph-popup-*` classes | 371-472 |
| `phreak-terminal.js` | Calls `window.St8GraphVisualizer.showGraphPopup()` | 673 |
| `file-explorer.js` | Provides manifest data via `getIndexedFingerprints()` | 745 |
| `connection-state.json` | Example of manifest data structure consumed by setData() | 664-677 |

### Should D3 be bundled instead of CDN?

**Arguments for bundling:**
- Eliminates CDN dependency (offline use, corporate firewalls)
- Enables SRI verification
- Consistent version pinning
- Faster load (no extra HTTP request)

**Arguments for CDN:**
- Smaller initial bundle size
- Browser caching across sites
- D3 is ~90KB gzipped — significant for a single-purpose visualizer

**Recommendation:** Bundle D3 or use a local copy with SRI. The CDN approach without SRI is a security risk (CR-01). For a desktop/niche tool like ST8, the bundle size argument is weak.

---

## FINDING SUMMARY

| ID | Severity | Line(s) | Issue |
|----|----------|---------|-------|
| CR-01 | **CRITICAL** | 30 | CDN script loaded without SRI hash — supply chain attack vector |
| CR-02 | **CRITICAL** | 106-108 | Import link resolution fails for relative paths — graph shows disconnected nodes |
| CR-03 | **CRITICAL** | 171, 314, 318, 331-332 | XSS via innerHTML injection of unescaped manifest data |
| WR-01 | **WARNING** | 19 | loadD3() returns non-Promise synchronously when cached — inconsistent contract |
| WR-02 | **WARNING** | 393-399 | No .catch() on initialize() promise chain — silent failure if CDN unreachable |
| WR-03 | **WARNING** | 103-118 | O(n²) link building via nested Array.find() — slow on large codebases |
| WR-04 | **WARNING** | 269-277, 364 | destroy() never called on popup close — D3 simulation memory leak |
| WR-05 | **WARNING** | 300-301 | No Array.isArray() guard on node.imports/node.importedBy |
| IN-01 | **INFO** | 55 | Unused field `_filterStatus` — dead code |
| IN-02 | **INFO** | 349-353, 314, 318, 331 | _escapeHtml() defined but inconsistently applied |
| IN-03 | **INFO** | 420-435 | Filter opacity changes are instantaneous — no transition animation |

---

## D3 LOADING FLOW DIAGRAM

```
st8.html:1663
  └── <script src="graph-visualizer.js">
        └── File executes: defines loadD3(), GraphVisualizer, showGraphPopup, etc.
            └── window.St8GraphVisualizer = { showGraphPopup, resetZoom, ... }

User clicks GRAPH button
  └── phreak-terminal.js:565 → _showGraph()
        └── phreak-terminal.js:672 → St8GraphVisualizer.showGraphPopup(manifest)
              └── graph-visualizer.js:385 → new GraphVisualizer(container, opts)
              └── graph-visualizer.js:393 → visualizer.initialize()
                    └── graph-visualizer.js:59 → await loadD3()
                          ├── graph-visualizer.js:19 → if cached, return d3
                          ├── graph-visualizer.js:23 → if window.d3, use it
                          └── graph-visualizer.js:29-38 → inject <script> from CDN
                                └── onload → d3 = window.d3
                    └── graph-visualizer.js:60 → _createSVG()
              └── graph-visualizer.js:394 → setData(manifest)  ← BUG: links fail to resolve
              └── graph-visualizer.js:395 → render()
                    └── Creates simulation, links, nodes, labels, drag, click handlers
```

---

## NODE INTERACTION FLOW

```
Node Hover (no handler defined — no hover effect on nodes)
  └── (MISSING — nodes have no mouseover/mouseout handlers, only links do)

Node Click
  └── graph-visualizer.js:231 → this.onNodeClick(d)
        └── graph-visualizer.js:389 → _showNodeDetails(node)
              └── graph-visualizer.js:281-347 → Creates modal popup
                    ├── Displays: name, filepath, reachabilityScore, impactRadius, import counts, status
                    ├── Close: click ◇ button (line 306) or click overlay (line 342-345)
                    └── SECURITY: XSS via unescaped fields (CR-03)

Link Hover
  └── graph-visualizer.js:147-174 → Highlights link, shows tooltip
        ├── Tooltip: "sourceName → targetName"
        ├── SECURITY: XSS via .html() (CR-03)
        └── mouseout resets (line 181-187)

Link Click
  └── (MISSING — links have cursor:pointer but no click handler)
```

---

## POPUP DISPLAY FLOW

```
showGraphPopup(manifest) called
  ├── Creates overlay div with CSS class .graph-popup-overlay
  ├── Popup structure:
  │   ├── Header: "CONNECTION GRAPH" + close button (◇)
  │   ├── Body: #graph-popup-body (graph renders here)
  │   └── Footer: filter buttons (ALL/GREEN/YELLOW/RED) + file count + RESET ZOOM
  ├── new GraphVisualizer(body, {width:800, height:500, onNodeClick})
  ├── async: initialize() → setData() → render()
  ├── Filter click handler (event delegation on footer)
  └── Close: onclick removes overlay (but does NOT destroy simulation — WR-04)

Node details popup (_showNodeDetails):
  ├── Fixed position, centered modal
  ├── Shows: name, filepath, reachability, impact, imports count, importedBy count, status badge
  ├── Close: ◇ button or overlay click
  └── CSS: inline styles (not using CSS classes from st8.html)
```

---

_Reviewed: 2026-05-13T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
