# ST8 File Map

**Generated:** 2026-05-14
**Purpose:** Complete inventory of all source files for gap analysis and integration planning

---

## Root Level Files

| File | Lines | Purpose | Dependencies |
|------|-------|---------|--------------|
| `README.md` | 278 | - | - |
| `ai-signal.toml` | 3 | - | - |
| `connection-state.json` | 1329 | - | - |
| `coordination.js` | 210 | - | - |
| `fake-stream.js` | 96 | vendor/fake-stream.js | - |
| `file-explorer.js` | 748 | - | - |
| `graph-visualizer.js` | 456 | Try to load D3 from CDN | - |
| `package.json` | 28 | - | - |
| `phreak-terminal.js` | 1086 | - | - |
| `settings-reader.js` | 113 | vendor/settings-reader.js | - |
| `settings-ui.js` | 339 | - | - |
| `st8.code-workspace` | 7 | - | - |
| `st8.html` | 2587 | - | - |
| `start.js` | 148 | ST8 — Startup Script | path, fs, child_process, open |
| `void-engine.html` | 44 | - | - |
| `void-engine.js` | 338 | the-editorial-engine.ts | - |

---

## Backend Files

| File | Lines | Purpose | Key Functions/Classes |
|------|-------|---------|----------------------|
| `brunoOscar.js` | 185 | Bruno & Oscar — Automatic File Lifecycle Management | BrunoOscar |
| `fileWatcher.js` | 139 | ST8 File Watcher | FileWatcher |
| `gapAnalyzer.js` | 651 | gapAnalyzer.js — 6-Dimension Gap Analysis Engine | GapAnalyzer |
| `index.js` | 435 | ST8 Backend — Main Entry Point | - |
| `indexer.js` | 482 | ST8 Indexer — Backend CLI Script | - |
| `intentSeeder.js` | 510 | ST8 Intent Seeder — Auto-generate intent from AST + heuristics | IntentSeeder |
| `manifestGenerator.js` | 172 | ST8 Manifest Generator | - |
| `notificationBus.js` | 126 | ST8 Notification Bus | NotificationBus |
| `persistence.js` | 704 | ST8 Persistence — SQLite Database Layer | St8Persistence |
| `prdGenerator.js` | 200 | prdGenerator.js — PRD generation from schema cards | - |
| `schemaCardEmitter.js` | 209 | ST8 Schema Card Emitter | SchemaCardEmitter |
| `schemaCardPrinter.js` | 294 | ST8 Schema Card Printer — Human-Readable Fallback | SchemaCardPrinter |
| `server.js` | 1430 | ST8 Server — HTTP API for manifests | St8Server |
| `st8-types.js` | 281 | ST8 Types — Canonical Type Definitions | - |
| `templateEngine.js` | 120 | - | TemplateEngine |
| `verify-persistence-fixes.js` | 153 | Verification script for persistence.js fixes | - |

---

## Library Files (lib/)

### Utils
| File | Lines | Purpose |
|------|-------|--------|
| `astParser.js` | 1065 | src/utils/astParser.ts |
| `groundPlane.js` | 267 | src/utils/groundPlane.ts |
| `ioChan.js` | 395 | src/utils/ioChan.ts |
| `safeFs.js` | 598 | src/utils/safeFs.ts |

### Commands
| File | Lines | Purpose |
|------|-------|--------|
| `backgroundIndexer.js` | 811 | src/commands/backgroundIndexer.ts |
| `graphBuilder.js` | 213 | src/commands/graphBuilder.ts |
| `graphTraversal.js` | 827 | src/commands/graphTraversal.ts |
| `insightStore.js` | 361 | src/commands/insightStore.ts |
| `overview.js` | 349 | C:\orchestr8\scripts\prd src\overview.ts |
| `parserPersistence.js` | 294 | src/commands/parserPersistence.ts |

### Integr8 Subdirectory
| File | Lines | Purpose |
|------|-------|--------|
| `dataIngestion.js` | 1101 | src/commands/integr8/dataIngestion.ts |
| `databasePersister.js` | 228 | src/commands/integr8/databasePersister.ts |
| `index.js` | 139 | src/commands/integr8/index.ts |
| `migrationExecutor.js` | 1836 | src/commands/integr8/migrationExecutor.ts |
| `pathGenerator.js` | 858 | src/commands/integr8/pathGenerator.ts |
| `relationshipAnalyzer.js` | 923 | src/commands/integr8/relationshipAnalyzer.ts |
| `reportGenerator.js` | 283 | src/commands/integr8/reportGenerator.ts |
| `tomlSerializer.js` | 417 | src/commands/integr8/tomlSerializer.ts |
| `types.js` | 82 | src/commands/integr8/types.ts |

---

## Non-Source

| Path | Purpose |
|------|--------|
| `.planning/` | Planning documents and specs |
| `.st8/` | Runtime output (schema-cards/, gap-analysis.md) |
| `.st8/schema-cards/` | Per-file schema card JSON files |
| `.archive/` | Archived reference files |
| `node_modules/` | NPM dependencies |
| `fonts/` | Custom fonts (Monoton, Poiret One) |
| `vendor/` | Vendored dependencies (currently empty) |
| `docs/` | Documentation |
| `st8.code-workspace` | VSCode workspace config |

---

## API Endpoints (server.js)

| Endpoint | Method | Purpose |
|----------|--------|--------|
| `/api/connection-state.json` | GET | Serves connection manifest |
| `/api/ai-signal.toml` | GET | Serves AI signal TOML |
| `/api/health` | GET | Health check |
| `/api/index` | POST | Triggers re-indexing |
| `/api/file-intent` | GET/POST | File intent CRUD |
| `/api/settings` | GET/POST | Settings read/write |
| `/api/verify` | POST | Run verification |
| `/api/files` | GET | List indexed files |
| `/api/mutations` | GET | SSE stream of file mutations |
| `/api/concept-file` | GET/POST | Concept file operations |
| `/api/mvp-lock` | POST | MVP lock management |
| `/api/prd` | GET | PRD generation |
| `/api/production-promote` | POST | Promote file to production phase |
| `/api/gap-analysis` | GET | Gap analysis results |
| `/api/prd-projects` | GET/POST | PRD project management |
| `/api/bruno-call` | POST | Bruno file lifecycle actions |
| `/api/oscar-house` | POST | Oscar archive actions |
| `/api/needs-ai-review` | GET | Files needing AI review |
| `/api/mark-reviewed` | POST | Mark file as reviewed |
| `/api/templates` | GET/POST | Template management |

---

## Integration Points Summary

### Frontend → Backend
1. **st8.html** → `st8WorkspaceChanged()` activates split mode
2. **st8.html** → `St8Coordination.startPolling()` polls manifest
3. **file-explorer.js** → `PhreakTerminal.execute('index ' + path)` triggers indexing
4. **st8.html** → Backend `/api/connection-state.json` polled
5. **st8.html** → `/api/mutations` SSE stream for real-time updates
6. **st8.html** → `/api/files`, `/api/settings`, `/api/gap-analysis` etc.

### Backend Index Flow (WIRED)
```
indexer.js:indexDirectory()
         ↓
   returns { files, manifest }
         ↓
persistence.js:St8Persistence.upsertFile()
         ↓
persistence.js:St8Persistence.insertConnection()
         ↓
manifestGenerator.js:writeManifests()
         ↓
schemaCardEmitter.js:emitAllCards()
         ↓
schemaCardPrinter.js:printAllFromCards()
         ↓
gapAnalyzer.js:analyze() → .st8/gap-analysis.md
         ↓
intentSeeder.js:seedAll()
         ↓
server.js:_serveManifest() → targetDir/connection-state.json
```

### File Watcher (WIRED)
```
fileWatcher.js:_onFileChange()
         ↓
index.js:onFileChange callback
         ↓
  ├── ADD:   persistence.upsertFile() + logMutation(CREATE) + emitCard()
  ├── EDIT:  persistence.upsertFile() + logMutation(EDIT) + emitCard()
  └── DEL:   persistence.deleteFile() + logMutation(DELETE) + unlink schema card
         ↓
notificationBus.publish() → SSE → frontend
         ↓
writeManifests() + intentSeeder.seedAll() + gapAnalyzer.writeReport()
```

---

## Workspace Type Handling

| Workspace | file-explorer.js | st8.html |
|-----------|------------------|----------|
| `standard` | Standard file browsing | Deactivates split mode |
| `logic-analyzer` | Full stack view | Activates split mode |
| `pretext-dev` | NOT handled | void-engine.js would activate |

**Key:** Full Stack Logic Analyzer = `logic-analyzer` workspace type

---

## Stubs and Mock Data

| Location | Type | Impact |
|----------|------|--------|
| `phreak-terminal.js` | `_simulateCommand()` | Mock responses when bridge offline |
| `file-explorer.js` | `_mockEntries()` | Fallback mock directory data |
| `backend/indexer.js` | `classifyBasic()` fallback | Basic classification instead of real graph |
| `st8.html` | TODO comment | Notes save not persisted |

---

*End of file map.*
