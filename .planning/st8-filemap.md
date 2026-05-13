# ST8 File Map

**Generated:** 2026-05-12  
**Purpose:** Complete inventory of all source files for gap analysis and integration planning

---

## Root Level Files

| File | Lines | Purpose | Dependencies |
|------|-------|---------|--------------|
| `st8.html` | 1759 | Main UI shell | settings-ui.js, phreak-terminal.js, file-explorer.js, coordination.js, graph-visualizer.js |
| `st8.sqlite` | - | SQLite database | - |
| `void-engine.js` | 339 | Text layout engine (pretext) - standalone demo | esm.sh/@chenglou/pretext |
| `void-engine.html` | 45 | Demo shell for void-engine | void-engine.js |
| `phreak-terminal.js` | 1033 | TUI terminal emulator | epoClient (optional) |
| `file-explorer.js` | 622 | File browser with workspace switcher | epoClient (optional), PhreakTerminal |
| `graph-visualizer.js` | ~300 | SVG graph renderer | manifest data |
| `settings-ui.js` | 228 | Settings panel UI | - |
| `coordination.js` | 211 | Manifest polling/sync | fetch API |
| `settings-reader.js` | ? | Configuration reader | - |
| `fake-stream.js` | ? | Stream simulation | - |
| `start.js` | ? | Application entry point | backend/index.js |
| `package.json` | ? | Dependencies | better-sqlite3, chokidar, express |

---

## Backend Files

| File | Lines | Purpose | Key Functions/Classes |
|------|-------|---------|----------------------|
| `backend/index.js` | 140 | Main entry point | main() - orchestrates all modules |
| `backend/indexer.js` | 417 | Code parsing/graph building | indexDirectory(), discoverFiles(), parseImports(), buildGraph() |
| `backend/persistence.js` | 249 | SQLite layer | St8Persistence class - upsertFile(), logActivity() |
| `backend/server.js` | 207 | HTTP API server | St8Server class - start(), _serveManifest() |
| `backend/fileWatcher.js` | 128 | Chokidar wrapper | FileWatcher class - start(), _onFileChange() |
| `backend/manifestGenerator.js` | 163 | JSON/TOML generation | writeManifests(), generateConnectionState() |

---

## Library Files (lib/)

### Utils
| File | Lines | Purpose |
|------|-------|---------|
| `lib/utils/astParser.js` | ~40KB | AST-based import extraction |
| `lib/utils/groundPlane.js` | ? | Coordinate system utilities |
| `lib/utils/ioChan.js` | ? | IPC channel abstraction |
| `lib/utils/safeFs.js` | ? | Safe filesystem operations |

### Commands
| File | Lines | Purpose |
|------|-------|---------|
| `lib/commands/backgroundIndexer.js` | ~39KB | Background indexing logic |
| `lib/commands/graphBuilder.js` | ? | Dependency graph construction |
| `lib/commands/graphTraversal.js` | ? | Graph traversal algorithms |
| `lib/commands/insightStore.js` | ? | Analysis results storage |
| `lib/commands/overview.js` | ? | Codebase overview generation |
| `lib/commands/parserPersistence.js` | ? | Parser state persistence |

### Integr8 Subdirectory
| File | Purpose |
|------|---------|
| `lib/commands/integr8/databasePersister.js` | SQLite operations |
| `lib/commands/integr8/dataIngestion.js` | Data import pipeline |
| `lib/commands/integr8/index.js` | Module index |
| `lib/commands/integr8/migrationExecutor.js` | Schema migrations |
| `lib/commands/integr8/pathGenerator.js` | Path utilities |
| `lib/commands/integr8/relationshipAnalyzer.js` | Code relationship analysis |
| `lib/commands/integr8/reportGenerator.js` | Report generation |
| `lib/commands/integr8/tomlSerializer.js` | TOML serialization |
| `lib/commands/integr8/types.js` | Type definitions |

---

## Non-Source

| Path | Purpose |
|------|---------|
| `.planning/` | Planning documents and specs |
| `snapshots/` | Versioned snapshots of code history |
| `.archive/` | Archived reference files |
| `node_modules/` | NPM dependencies |
| `fonts/` | Custom fonts (Monoton, Poiret One) |
| `docs/` | Documentation |
| `st8.code-workspace` | VSCode workspace config |

---

## Integration Points Summary

### Frontend → Backend
1. **st8.html:1475** → `st8WorkspaceChanged()` activates split mode
2. **st8.html:1486** → `St8Coordination.startPolling()` polls manifest
3. **file-explorer.js:538** → `PhreakTerminal.execute('index ' + path)` triggers indexing
4. **st8.html:1655** → Backend `/api/connection-state.json` polled

### Backend Index Flow (NOT WIRED)
```
indexer.js:302 indexDirectory()
         ↓
indexer.js:415 returns { files, manifest }
         ↓
     ??? NOT CONNECTED TO ???
         ↓
persistence.js:107 initialize()
         ↓
persistence.js:135 upsertFile()
         ↓
manifestGenerator.js:134 writeManifests()
         ↓
server.js:136 _serveManifest() → targetDir/connection-state.json
```

### File Watcher (NOT WIRED)
```
fileWatcher.js:87 _onFileChange()
         ↓
fileWatcher.js:105 onFileChange callback
         ↓
index.js:99 TODO - incremental re-index not implemented
```

---

## Workspace Type Handling

| Workspace | file-explorer.js | st8.html |
|-----------|------------------|----------|
| `standard` | Line 61 | Deactivates split mode (line 1490) |
| `logic-analyzer` | Line 62 | Activates split mode (line 1475) |
| `pretext-dev` | Line 63 | NOT handled - void-engine.js would activate |

**Key:** Full Stack Logic Analyzer = `logic-analyzer` workspace type

---

## Stubs and Mock Data

| Location | Type | Impact |
|----------|------|--------|
| `phreak-terminal.js:99` | `_simulateCommand()` | Mock responses when bridge offline |
| `file-explorer.js:187` | `_mockEntries()` | Fallback mock directory data |
| `backend/index.js:101` | TODO comment | Incremental re-index stub |
| `backend/indexer.js:212` | `classifyBasic()` fallback | Basic classification instead of real graph |
| `st8.html:1711` | TODO comment | Notes save not persisted |

---

*End of file map.*
