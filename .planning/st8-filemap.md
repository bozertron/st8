# ST8 File Map

**Generated:** 2026-05-16
**Purpose:** Complete inventory of all source files for gap analysis and integration planning

---

## Root Level Files

| File | Lines | Purpose | Dependencies |
|------|-------|---------|--------------|
| `README.md` | 278 | - | - |
| `ai-signal.toml` | 3 | - | - |
| `connection-state.json` | 1329 | - | - |
| `package.json` | 28 | - | - |
| `st8-filemap.md` | 383 | - | - |
| `st8.code-workspace` | 7 | - | - |
| `st8_bible.md` | 2943 | - | persistence, fs |
| `start.js` | 148 | ST8 — Startup Script | path, fs, child_process, open |

---

## src/core — Infrastructure

### Core Top-Level
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `hook-registry.js` | 173 | hook-registry.js — Named hook system for ST8. | HookRegistry |
| `notification-bus.js` | 126 | ST8 Notification Bus | NotificationBus |

### core/database
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `graph-persister.js` | 228 | src/commands/integr8/databasePersister.ts | DatabasePersister |
| `persistence.js` | 840 | ST8 Persistence — SQLite Database Layer | St8Persistence |
| `verify-persistence-fixes.js` | 153 | Verification script for persistence.js fixes | - |

### core/hooks
| File | Lines | Purpose |
|------|-------|--------|
| `default-subscribers.js` | 116 | default-subscribers.js — Registers st8's built-in modules as subscribers |
| `force-checks.js` | 254 | force-checks.js — Cross-tool integrity verification. |

### core/server
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `app.js` | 1613 | ST8 Server — HTTP API for manifests | St8Server |
| `main.js` | 453 | ST8 Backend — Main Entry Point | - |

---

## src/features — Feature Modules

### analysis/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `gap-analyzer.js` | 652 | gapAnalyzer.js — 6-Dimension Gap Analysis Engine | GapAnalyzer |
| `insight-store.js` | 361 | src/commands/insightStore.ts | InsightStore |
| `intent-seeder.js` | 519 | ST8 Intent Seeder — Auto-generate intent from AST + heuristics | IntentSeeder |
| `path-generator.js` | 858 | src/commands/integr8/pathGenerator.ts | - |
| `relationship-analyzer.js` | 923 | src/commands/integr8/relationshipAnalyzer.ts | - |
| `report-generator.js` | 283 | src/commands/integr8/reportGenerator.ts | - |

### graph/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `builder.js` | 213 | src/commands/graphBuilder.ts | - |
| `traversal.js` | 827 | src/commands/graphTraversal.ts | - |

### indexing/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `background-indexer.js` | 811 | src/commands/backgroundIndexer.ts | BackgroundIndexer |
| `command-parser.js` | 270 | C:\orchestr8\scripts\prd src\commandParser.ts | - |
| `data-ingestion.js` | 1101 | src/commands/integr8/dataIngestion.ts | - |
| `indexer.js` | 483 | ST8 Indexer — Backend CLI Script | - |
| `overview.js` | 349 | C:\orchestr8\scripts\prd src\overview.ts | - |
| `parser-persistence.js` | 294 | src/commands/parserPersistence.ts | ParserPersistence |
| `route-parser.js` | 312 | - | - |
| `store-parser.js` | 340 | - | - |
| `type-parser.js` | 255 | C:\orchestr8\scripts\prd src\typeParser.ts | - |
| `ui-parser.js` | 250 | C:\orchestr8\scripts\prd src\uiParser.ts | - |

### integr8/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `index.js` | 139 | src/commands/integr8/index.ts | - |
| `migration-executor.js` | 1836 | src/commands/integr8/migrationExecutor.ts | - |
| `toml-serializer.js` | 417 | src/commands/integr8/tomlSerializer.ts | - |

### lifecycle/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `bruno-oscar.js` | 185 | Bruno & Oscar — Automatic File Lifecycle Management | BrunoOscar |

### prd/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `generator.js` | 200 | generator.js — PRD generation from schema cards | - |
| `template-engine.js` | 120 | - | TemplateEngine |

### schema-cards/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `emitter.js` | 230 | ST8 Schema Card Emitter | SchemaCardEmitter |
| `manifest-generator.js` | 170 | ST8 Manifest Generator | - |
| `printer.js` | 294 | ST8 Schema Card Printer — Human-Readable Fallback | SchemaCardPrinter |

### search/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `sonic-client.js` | 566 | SonicClient - Lightweight TCP client for Sonic search backend | SonicChannel, SonicClient |
| `sonic-daemon.js` | 288 | sonic-daemon.js — Manages the Sonic search daemon process lifecycle. | - |
| `sonic-indexer.js` | 445 | src/commands/sonicIndexer.ts | SonicIndexer |
| `sonic-queries.js` | 658 | src/commands/sonicQueries.ts | SonicQueries |

### watcher/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `file-watcher.js` | 139 | ST8 File Watcher | FileWatcher |

---

## src/frontend — UI Layer

### Top-Level
| File | Lines | Purpose |
|------|-------|--------|
| `app.js` | 970 | escapeHtml utility (was script block 2) |
| `index.html` | 179 | - |

### Components

**constellation/**
| File | Lines | Purpose |
|------|-------|--------|
| `constellation.js` | 286 | - |
| `particles.lib.js` | 1540 | - |

**dive-in/**
| File | Lines | Purpose |
|------|-------|--------|
| `dive-in.js` | 479 | - |

**file-explorer/**
| File | Lines | Purpose |
|------|-------|--------|
| `file-explorer.css` | 283 | - |
| `file-explorer.js` | 748 | - |

**graph-viewer/**
| File | Lines | Purpose |
|------|-------|--------|
| `graph-viewer.css` | 109 | - |
| `graph-viewer.js` | 456 | Try to load D3 from CDN |

**notifications/**
| File | Lines | Purpose |
|------|-------|--------|
| `toast.css` | 96 | - |

**prd-wizard/**
| File | Lines | Purpose |
|------|-------|--------|
| `prd-wizard.css` | 68 | - |

**settings/**
| File | Lines | Purpose |
|------|-------|--------|
| `settings.css` | 219 | - |
| `settings.js` | 374 | Canonical list of provider IDs that a `models` entry can declare via its |

**terminal/**
| File | Lines | Purpose |
|------|-------|--------|
| `terminal.css` | 244 | - |
| `terminal.js` | 1086 | - |

### Services
| File | Lines | Purpose |
|------|-------|--------|
| `coordination.js` | 210 | - |

### Styles
| File | Lines | Purpose |
|------|-------|--------|
| `base.css` | 23 | - |
| `carousel.css` | 230 | - |
| `chat.css` | 36 | - |
| `dock.css` | 91 | - |
| `file-list.css` | 117 | - |
| `fonts.css` | 17 | - |
| `notes-popup.css` | 124 | - |
| `panels.css` | 77 | - |
| `tokens.css` | 41 | - |
| `void.css` | 102 | - |

---

## src/shared — Shared Types & Utils

### Types
| File | Lines | Purpose |
|------|-------|--------|
| `integr8-types.js` | 82 | src/commands/integr8/types.ts |
| `st8-types.js` | 281 | ST8 Types — Canonical Type Definitions |

### Utils
| File | Lines | Purpose |
|------|-------|--------|
| `ast-parser.js` | 1065 | src/utils/astParser.ts |
| `ground-plane.js` | 267 | src/utils/groundPlane.ts |
| `io-chan.js` | 395 | src/utils/ioChan.ts |
| `safe-fs.js` | 598 | src/utils/safeFs.ts |

---

## OGB/ — Archived Legacy Files

| Path | Lines |
|------|-------|
| `OGB/coordination.js.txt` | 210 |
| `OGB/file-explorer.js.txt` | 748 |
| `OGB/graph-visualizer.js.txt` | 456 |
| `OGB/phreak-terminal.js.txt` | 1086 |
| `OGB/settings-reader.js.txt` | 113 |
| `OGB/settings-ui.js.txt` | 339 |
| `OGB/st8.html.txt` | 2587 |
| `OGB/backend/brunoOscar.js.txt` | 185 |
| `OGB/backend/fileWatcher.js.txt` | 139 |
| `OGB/backend/gapAnalyzer.js.txt` | 651 |
| `OGB/backend/index.js.txt` | 435 |
| `OGB/backend/indexer.js.txt` | 482 |
| `OGB/backend/intentSeeder.js.txt` | 510 |
| `OGB/backend/manifestGenerator.js.txt` | 172 |
| `OGB/backend/notificationBus.js.txt` | 126 |
| `OGB/backend/persistence.js.txt` | 704 |
| `OGB/backend/prdGenerator.js.txt` | 200 |
| `OGB/backend/schemaCardEmitter.js.txt` | 209 |
| `OGB/backend/schemaCardPrinter.js.txt` | 294 |
| `OGB/backend/server.js.txt` | 1430 |
| `OGB/backend/st8-types.js.txt` | 281 |
| `OGB/backend/templateEngine.js.txt` | 120 |
| `OGB/backend/verify-persistence-fixes.js.txt` | 153 |

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
| `OGB/` | Archived legacy files (pre-restructure) |
| `docs/` | Documentation, Sonic, particles.js, Insight Store |
| `Louis/` | Louis lock-em-up module |
| `scripts/` | Utility scripts |
| `st8_json/` | Schema card JSON exports |
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

### Backend Index Flow (WIRED — now via src/)
```
src/features/indexing/indexer.js:indexDirectory()
         ↓
   returns { files, manifest }
         ↓
src/core/database/persistence.js:St8Persistence.upsertFile()
         ↓
src/core/database/graph-persister.js:insertConnection()
         ↓
src/features/schema-cards/manifest-generator.js:writeManifests()
         ↓
src/features/schema-cards/emitter.js:emitAllCards()
         ↓
src/features/schema-cards/printer.js:printAllFromCards()
         ↓
src/features/analysis/gap-analyzer.js:analyze() → .st8/gap-analysis.md
         ↓
src/features/analysis/intent-seeder.js:seedAll()
         ↓
src/core/server/main.js → targetDir/connection-state.json
```

### File Watcher (WIRED — now via src/)
```
src/features/watcher/file-watcher.js:_onFileChange()
         ↓
src/core/hook-registry.js:onFileChange callback
         ↓
  ├── ADD:   persistence.upsertFile() + logMutation(CREATE) + emitCard()
  ├── EDIT:  persistence.upsertFile() + logMutation(EDIT) + emitCard()
  └── DEL:   persistence.deleteFile() + logMutation(DELETE) + unlink schema card
         ↓
src/core/notification-bus.js:publish() → SSE → frontend
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
| `src/frontend/components/terminal/terminal.js` | `_simulateCommand()` | Mock responses when bridge offline |
| `src/frontend/components/file-explorer/file-explorer.js` | `_mockEntries()` | Fallback mock directory data |
| `src/features/indexing/indexer.js` | `classifyBasic()` fallback | Basic classification instead of real graph |
| `src/frontend/index.html` | TODO comment | Notes save not persisted |
| `src/frontend/components/constellation/` | Particle visualizations | Mock |
| `src/frontend/components/dive-in/` | 3D graph exploration | Three.js bundled |

---

*End of file map.*
