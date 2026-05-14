# Frontend Wave 1 — Schema Card Review

**Reviewed:** 2026-05-14
**Source:** `.st8/schema-cards/` (4 files)
**Status:** All 4 cards report `status: RED`

---

## 1. Summary Table

| # | File | Status | Size | Exports | Imports (unique) | ImportedBy | Summary |
|---|------|--------|------|---------|-------------------|------------|---------|
| 1 | `coordination.js` | 🔴 RED | 7.5 KB | 0 | 0 | 0 | Process coordination module — provides loadManifest, notifyListeners, startPolling, stopPolling, addListener, compareManifests, and generateAiContext APIs. |
| 2 | `file-explorer.js` | 🔴 RED | 27.7 KB | 0 | 0 | 0 | File explorer UI component — directory browsing, virtual scrolling, breadcrumb navigation, workspace picker, and WebSocket-based file fetching. |
| 3 | `graph-visualizer.js` | 🔴 RED | 19.6 KB | 0 | 0 | 0 | Graph visualization module — D3.js CDN loader, node rendering, detail popups, and HTML escaping utilities. |
| 4 | `phreak-terminal.js` | 🔴 RED | 42.9 KB | 0 | 0 | 0 | Terminal interface — command execution, TUI mode, history management, phone icon UI, signal popups, media commands, and mutation notifications. Largest frontend module. |

---

## 2. Exports Detail

### `coordination.js`
| Name | Kind | Notes |
|------|------|-------|
| *(none)* | — | No exports. Likely side-effect module or uses implicit global attachment. |

### `file-explorer.js`
| Name | Kind | Notes |
|------|------|-------|
| *(none)* | — | No exports. Largest API surface listed in intent (27 functions) but none are formally exported. |

### `graph-visualizer.js`
| Name | Kind | Notes |
|------|------|-------|
| *(none)* | — | No exports. |

### `phreak-terminal.js`
| Name | Kind | Notes |
|------|------|-------|
| *(none)* | — | No exports. Largest module (42.9 KB) with 36+ API functions but zero formal exports. |

---

## 3. Imports Detail

### `coordination.js`
| Source Module | What's Imported |
|---------------|-----------------|
| *(none)* | — |

### `file-explorer.js`
| Source Module | What's Imported |
|---------------|-----------------|
| *(none)* | — |

### `graph-visualizer.js`
| Source Module | What's Imported |
|---------------|-----------------|
| *(none)* | — |

### `phreak-terminal.js`
| Source Module | What's Imported |
|---------------|-----------------|
| *(none)* | — |

---

## 4. Connections

### `coordination.js`
- **importedBy:** *(none detected)*
- **imports:** *(none detected)*
- **Impact radius:** 0

### `file-explorer.js`
- **importedBy:** *(none detected)*
- **imports:** *(none detected)*
- **Impact radius:** 0

### `graph-visualizer.js`
- **importedBy:** *(none detected)*
- **imports:** *(none detected)*
- **Impact radius:** 0

### `phreak-terminal.js`
- **importedBy:** *(none detected)*
- **imports:** *(none detected)*
- **Impact radius:** 0

---

## 5. Intent

| File | Purpose | Depends On Behavior | Value Statement |
|------|---------|---------------------|-----------------|
| `coordination.js` | Process coordination — notify listeners | No external dependencies | loadManifest, notifyListeners, startPolling, stopPolling, addListener, compareManifests, generateAiContext |
| `file-explorer.js` | File explorer UI — hidden files always shown | No external dependencies | Workspace path resolution, breadcrumb rendering, virtual scrolling, WebSocket file fetching, workspace picker |
| `graph-visualizer.js` | Graph visualization — D3 CDN loading | No external dependencies | D3 loader, GraphVisualizer class, node detail popups, HTML escaping |
| `phreak-terminal.js` | Terminal interface — history management | No external dependencies | Command execution, TUI mode, signal popups, phone icon UI, mutation notifications, media commands |

---

## 6. Status Analysis

All four cards are **🔴 RED** with identical characteristics:

| Metric | Value |
|--------|-------|
| Reachability score | 0 (all) |
| Impact radius | 0 (all) |
| Formal exports | 0 (all) |
| Detected imports | 0 (all) |
| ImportedBy count | 0 (all) |
| Lifecycle phase | DEVELOPMENT (all) |
| Mutation count | 4 (all) |

---

## 7. Key Observations

1. **Zero connectivity graph:** All four modules show empty `imports` and `importedBy` arrays despite listing rich API surfaces in their `intent.valueStatement`. The indexer either cannot parse their import/export style (likely global assignment or IIFE patterns) or these modules are truly isolated.

2. **No formal exports:** All modules list 0 exports despite exposing APIs like `phreakMount`, `explorerMount`, `loadD3`, `loadManifest`, etc. This suggests they attach to global scope (e.g., `window.st8 = {...}`) or use a non-standard module pattern the indexer doesn't recognize.

3. **`???` markers in intent:** Every `purpose`, `dependsOnBehavior`, and `valueStatement` field ends with `???` — indicating the indexer flagged low confidence in its intent extraction. These should be manually verified.

4. **`phreak-terminal.js` is the largest:** At 42.9 KB with 36+ functions, it's the largest frontend module. It mixes terminal I/O, TUI rendering, phone UI, signal handling, and mutation notifications — a candidate for decomposition.

5. **`file-explorer.js` has a `???` in purpose:** The string `"Hidden files are always shown (single-user tool, no toggle) ???"` suggests an unresolved design decision flagged by the indexer.

6. **All `lastMutation.actor` is `INDEXER`:** No human mutations recorded — these cards are purely machine-generated.
