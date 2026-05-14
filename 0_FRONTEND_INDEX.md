# FRONTEND FILE INDEX

**Directory:** Root (frontend files)
**Files:** 7
**Generated:** 2026-05-14

---

## 1. coordination.js (210 lines)

**Purpose:** Multi-LLM manifest synchronization
**Status:** 🔴 RED — zero connectivity

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `window.St8Coordination` | object | 201 | Public API |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `loadManifest` | 27-44 | Load manifest from server |
| `notifyListeners` | 46-54 | Notify registered listeners |
| `startPolling` | 58+ | Start polling for updates |
| `stopPolling` | - | Stop polling |
| `addListener` | - | Add change listener |
| `compareManifests` | - | Compare two manifests |
| `generateAiContext` | - | Generate AI context |

### Dependencies
- None (uses fetch API)

### Proposed Target
- `src/0_frontend/0_services/0_coordination.js`

---

## 2. file-explorer.js (748 lines)

**Purpose:** File browser panel with workspace picker
**Status:** 🔴 RED — zero connectivity

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `window.VoidFileExplorer` | object | - | Public API |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `explorerMount` | - | Mount explorer panel |
| `explorerUnmount` | - | Unmount explorer panel |
| `navigateTo` | - | Navigate to directory |
| `refreshFileList` | - | Refresh file list |
| `toggleHiddenFiles` | - | Toggle hidden files |
| `selectFile` | - | Select file |
| `openWorkspace` | - | Open workspace picker |

### Dependencies
- None (uses fetch API)

### Proposed Target
- `src/0_frontend/0_components/0_file-explorer/0_file-explorer.js`

---

## 3. graph-visualizer.js (456 lines)

**Purpose:** D3.js force-directed graph renderer
**Status:** 🔴 RED — zero connectivity

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `window.St8GraphVisualizer` | object | - | Public API |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `loadD3` | 18-40 | Load D3.js from CDN |
| `initialize` | 58+ | Initialize graph |
| `render` | - | Render graph |
| `update` | - | Update graph |
| `resetZoom` | - | Reset zoom |
| `filterByStatus` | - | Filter by status |

### Dependencies
- D3.js (CDN)

### Proposed Target
- `src/0_frontend/0_components/0_graph-viewer/0_graph-viewer.js`

---

## 4. phreak-terminal.js (1086 lines)

**Purpose:** Terminal interface with TUI mode
**Status:** 🔴 RED — zero connectivity

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `window.phreakMount` | function | - | Mount terminal |
| `window.phreakUnmount` | function | - | Unmount terminal |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `phreakMount` | - | Mount terminal panel |
| `phreakUnmount` | - | Unmount terminal panel |
| `phreakExecute` | 47+ | Execute command |
| `renderLines` | - | Render terminal lines |
| `toggleTUI` | - | Toggle TUI mode |
| `receiveSignal` | - | Receive signal |

### Dependencies
- None (uses fetch API)

### Proposed Target
- `src/0_frontend/0_components/0_terminal/0_terminal.js`

---

## 5. settings-reader.js (113 lines)

**Purpose:** Settings persistence
**Status:** 🔴 RED — zero connectivity

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `window.st8Settings` | object | - | Live settings POJO |

### Key Classes
| Class | Lines | Purpose |
|-------|-------|---------|
| `LocalStorageAdapter` | 27-39 | LocalStorage adapter |
| `MemoryAdapter` | 41-45 | Memory adapter |
| `SettingsReader` | 47+ | Settings reader |

### Key Methods
| Method | Purpose |
|--------|---------|
| `read()` | Read settings |
| `write()` | Write settings |
| `on()` | Subscribe to changes |

### Dependencies
- None

### Proposed Target
- `src/0_frontend/0_services/0_state.js`

---

## 6. settings-ui.js (339 lines)

**Purpose:** Schema-driven settings interface
**Status:** 🔴 RED — zero connectivity

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `window.St8Settings` | object | - | Public API |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `mount` | - | Mount settings panel |
| `unmount` | - | Unmount settings panel |
| `selectCategory` | - | Select category |
| `editEntry` | - | Edit entry |
| `duplicateEntry` | - | Duplicate entry |
| `addEntry` | - | Add new entry |

### Dependencies
- None

### Proposed Target
- `src/0_frontend/0_components/0_settings/0_settings.js`

---

## 7. fake-stream.js (139 lines)

**Purpose:** Synthetic LLM stream
**Status:** 🔴 RED — zero connectivity

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `FakeStream` | class | - | Fake stream class |

### Key Methods
| Method | Purpose |
|--------|---------|
| `start()` | Start stream |
| `stop()` | Stop stream |
| `onChunk()` | Register chunk handler |

### Dependencies
- None

### Proposed Target
- DELETE (being removed from codebase)

---

## Summary

| File | Lines | Exports | Status | Proposed Target |
|------|-------|---------|--------|-----------------|
| `coordination.js` | 210 | 1 | 🔴 RED | `src/0_frontend/0_services/0_coordination.js` |
| `file-explorer.js` | 748 | 1 | 🔴 RED | `src/0_frontend/0_components/0_file-explorer/0_file-explorer.js` |
| `graph-visualizer.js` | 456 | 1 | 🔴 RED | `src/0_frontend/0_components/0_graph-viewer/0_graph-viewer.js` |
| `phreak-terminal.js` | 1086 | 2 | 🔴 RED | `src/0_frontend/0_components/0_terminal/0_terminal.js` |
| `settings-reader.js` | 113 | 1 | 🔴 RED | `src/0_frontend/0_services/0_state.js` |
| `settings-ui.js` | 339 | 1 | 🔴 RED | `src/0_frontend/0_components/0_settings/0_settings.js` |
| `fake-stream.js` | 139 | 1 | 🔴 RED | DELETE |

**Total:** 3091 lines, 8 exports

### Key Pattern

All frontend files use `window.*` global attachment pattern:
- `window.St8Coordination`
- `window.VoidFileExplorer`
- `window.St8GraphVisualizer`
- `window.phreakMount` / `window.phreakUnmount`
- `window.st8Settings`
- `window.St8Settings`

This is why the indexer shows zero exports — it can't detect `window.*` assignments.

---

*Generated for architecture refactoring reference*
