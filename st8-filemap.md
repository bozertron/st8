# ST8 File Map

**Generated:** 2026-05-16
**Purpose:** Complete inventory of all source files for gap analysis and integration planning

---

## Root Level Files

| File | Lines | Purpose | Dependencies |
|------|-------|---------|--------------|
| `CLAUDE.md` | 142 | - | - |
| `PRE_FLIGHT.md` | 124 | - | - |
| `README.md` | 278 | - | - |
| `ai-signal.toml` | 3 | - | - |
| `package.json` | 29 | - | - |
| `st8-filemap.md` | 369 | - | - |
| `st8.code-workspace` | 7 | - | - |
| `st8_bible.md` | 3194 | - | persistence, fs |
| `start.js` | 148 | ST8 — Startup Script | path, fs, child_process, open |

---

## src/core — Infrastructure

### Core Top-Level
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `hook-registry.js` | 273 | hook-registry.js — Named hook system for ST8. | HookRegistry |
| `notification-bus.js` | 174 | ST8 Notification Bus | NotificationBus |

### core/database
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `graph-persister.js` | 268 | GENERATED ARTIFACT — DO NOT HAND-EDIT. | DatabasePersister |
| `persistence.js` | 1589 | ST8 Persistence — SQLite Database Layer | St8Persistence |

### core/hooks
| File | Lines | Purpose |
|------|-------|--------|
| `default-subscribers.js` | 394 | default-subscribers.js — Registers st8's built-in modules as subscribers |
| `force-checks.js` | 347 | force-checks.js — Cross-tool integrity verification. |

### core/server
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `app.js` | 2654 | ST8 Server — HTTP API for manifests | St8Server |
| `auth.js` | 155 | auth.js — minimum-viable shared-secret authentication for write | - |
| `main.js` | 538 | ST8 Backend — Main Entry Point | - |
| `route-manifest.js` | 180 | route-manifest.js — Machine-readable description of the st8 HTTP API. | - |

---

## src/features — Feature Modules

### analysis/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `gap-analyzer.js` | 652 | gapAnalyzer.js — 6-Dimension Gap Analysis Engine | GapAnalyzer |
| `insight-store-populator.js` | 165 | insight-store-populator.js — Walks file_registry after each indexer | - |
| `insight-store.js` | 361 | src/commands/insightStore.ts | InsightStore |
| `intent-seeder.js` | 608 | ST8 Intent Seeder — Auto-generate intent from AST + heuristics | IntentSeeder |
| `path-generator.js` | 858 | src/commands/integr8/pathGenerator.ts | - |
| `relationship-analyzer.js` | 923 | src/commands/integr8/relationshipAnalyzer.ts | - |
| `report-generator.js` | 283 | src/commands/integr8/reportGenerator.ts | - |
| `signal-path-adapter.js` | 338 | signal-path-adapter.js — Bridge between st8's live persistence | - |

### graph/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `builder.js` | 213 | src/commands/graphBuilder.ts | - |
| `traversal.js` | 827 | src/commands/graphTraversal.ts | - |

### indexing/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `background-indexer.js` | 852 | src/commands/backgroundIndexer.ts | BackgroundIndexer |
| `command-parser.js` | 305 | command-parser — Tauri command + frontend invoke() extractor. | - |
| `data-ingestion.js` | 1223 | src/commands/integr8/dataIngestion.ts | - |
| `indexer.js` | 534 | ST8 Indexer — Backend CLI Script | - |
| `overview.js` | 386 | C:\orchestr8\scripts\prd src\overview.ts | - |
| `parser-persistence.js` | 334 | src/commands/parserPersistence.ts | ParserPersistence |
| `route-parser.js` | 342 | - | - |
| `store-parser.js` | 377 | - | - |
| `type-parser.js` | 287 | C:\orchestr8\scripts\prd src\typeParser.ts | - |
| `ui-parser.js` | 286 | C:\orchestr8\scripts\prd src\uiParser.ts | - |

### integr8/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `index.js` | 139 | src/commands/integr8/index.ts | - |
| `migration-executor.js` | 1836 | src/commands/integr8/migrationExecutor.ts | - |
| `toml-serializer.js` | 417 | src/commands/integr8/tomlSerializer.ts | - |

### lifecycle/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `bruno-oscar.js` | 256 | Bruno & Oscar — Automatic File Lifecycle Management | BrunoOscar |

### llm/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `dispatcher.js` | 98 | llm/dispatcher.js — provider-agnostic dispatch (Wave 5E, ticket 1). | - |

### prd/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `generator.js` | 200 | generator.js — PRD generation from schema cards | - |
| `template-engine.js` | 120 | - | TemplateEngine |

### schema-cards/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `emitter.js` | 265 | ST8 Schema Card Emitter | SchemaCardEmitter |
| `manifest-generator.js` | 211 | ST8 Manifest Generator | - |
| `printer.js` | 294 | ST8 Schema Card Printer — Human-Readable Fallback | SchemaCardPrinter |

### search/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `sonic-client.js` | 594 | SonicClient - Lightweight TCP client for Sonic search backend | SonicChannel, SonicClient |
| `sonic-daemon.js` | 630 | sonic-daemon.js — Manages the Sonic search daemon process lifecycle. | - |
| `sonic-indexer.js` | 453 | src/commands/sonicIndexer.ts | SonicIndexer |
| `sonic-queries.js` | 680 | src/commands/sonicQueries.ts | SonicQueries |

### watcher/
| File | Lines | Purpose | Key Classes |
|------|-------|---------|-------------|
| `file-watcher.js` | 203 | ST8 File Watcher | FileWatcher |

---

## src/frontend — UI Layer

### Top-Level
| File | Lines | Purpose |
|------|-------|--------|
| `app.js` | 1232 | escapeHtml utility (was script block 2) |
| `index.html` | 255 | - |

### Components

**constellation/**
| File | Lines | Purpose |
|------|-------|--------|
| `constellation.js` | 315 | - |
| `particles.lib.js` | 1574 | - |

**dive-in/**
| File | Lines | Purpose |
|------|-------|--------|
| `dive-in.css` | 157 | - |
| `dive-in.js` | 671 | - |

**file-explorer/**
| File | Lines | Purpose |
|------|-------|--------|
| `file-explorer.css` | 283 | - |
| `file-explorer.js` | 766 | - |

**graph-viewer/**
| File | Lines | Purpose |
|------|-------|--------|
| `graph-viewer.css` | 109 | - |
| `graph-viewer.js` | 585 | OFFLINE-FIRST (Wave 5H ticket 4): |

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
| `settings.css` | 237 | - |
| `settings.js` | 820 | Canonical list of provider IDs that a `models` entry can declare via its |

**terminal/**
| File | Lines | Purpose |
|------|-------|--------|
| `terminal.css` | 244 | - |
| `terminal.js` | 1149 | - |

### Services
| File | Lines | Purpose |
|------|-------|--------|
| `coordination.js` | 294 | - |
| `settings-reader.js` | 152 | - |

### Styles
| File | Lines | Purpose |
|------|-------|--------|
| `base.css` | 23 | - |
| `carousel.css` | 258 | - |
| `chat.css` | 36 | - |
| `dock.css` | 91 | - |
| `file-list.css` | 117 | - |
| `fonts.css` | 17 | - |
| `notes-popup.css` | 124 | - |
| `panels.css` | 77 | - |
| `tokens.css` | 43 | - |
| `void.css` | 102 | - |

---

## src/shared — Shared Types & Utils

### Types
| File | Lines | Purpose |
|------|-------|--------|
| `integr8-types.js` | 82 | src/commands/integr8/types.ts |
| `st8-types.js` | 290 | ST8 Types — Canonical Type Definitions |

### Utils
| File | Lines | Purpose |
|------|-------|--------|
| `ast-parser.js` | 1102 | src/utils/astParser.ts |
| `birth-timestamp.js` | 176 | birth-timestamp — identity-preserving birthTimestamp derivation |
| `ground-plane.js` | 273 | src/utils/groundPlane.ts |
| `io-chan.js` | 395 | src/utils/ioChan.ts |
| `safe-fs.js` | 598 | src/utils/safeFs.ts |
| `settings-crypto.js` | 227 | settings-crypto.js — symmetric encryption layer for at-rest sensitive |

---

## Non-Source

| Path | Purpose |
|------|--------|
| `.st8/` | Runtime output (schema-cards/, gap-analysis.md) |
| `.st8/schema-cards/` | Per-file schema card JSON files |
| `.archive/` | Archived reference files |
| `node_modules/` | NPM dependencies |
| `fonts/` | Custom fonts (Monoton, Poiret One) |
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
