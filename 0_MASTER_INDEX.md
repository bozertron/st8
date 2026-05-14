# ST8 MASTER FILE INDEX

**Generated:** 2026-05-14
**Purpose:** Complete file-by-file mapping for architecture refactoring

---

## Index Files Created

| File | Lines | Covers |
|------|-------|--------|
| `0_SERVER_JS_INDEX.md` | 452 | `backend/server.js` (1430 lines) |
| `0_PERSISTENCE_JS_INDEX.md` | 453 | `backend/persistence.js` (704 lines) |
| `0_INDEX_JS_INDEX.md` | 274 | `backend/index.js` (435 lines) |
| `0_INDEXER_JS_INDEX.md` | 342 | `backend/indexer.js` (482 lines) |
| `0_BACKEND_INDEX.md` | 426 | All 14 backend files |
| `0_LIB_UTILS_INDEX.md` | 174 | All 4 lib/utils files |
| `0_LIB_COMMANDS_INDEX.md` | 453 | All 16 lib/commands files |
| `0_FRONTEND_INDEX.md` | 237 | All 7 frontend files |
| **Total** | **2811** | **41 source files** |

---

## Codebase Statistics

| Category | Files | Lines | Exports |
|----------|-------|-------|---------|
| Backend | 14 | 5,818 | 32 |
| Lib/Utils | 4 | 2,327 | 26 |
| Lib/Commands | 16 | 10,000+ | 60+ |
| Frontend | 7 | 3,091 | 8 |
| **Total** | **41** | **21,236+** | **126+** |

---

## File Status Summary

### ✅ Working (Connected)
| File | Lines | Purpose |
|------|-------|---------|
| `backend/index.js` | 435 | Main entry point |
| `backend/indexer.js` | 482 | File indexing engine |
| `backend/persistence.js` | 704 | SQLite database layer |
| `backend/server.js` | 1430 | HTTP server |
| `backend/st8-types.js` | 281 | Type definitions |
| `backend/schemaCardEmitter.js` | 209 | Schema card generation |
| `backend/schemaCardPrinter.js` | 294 | TXT fallback generation |
| `backend/notificationBus.js` | 126 | Event notifications |
| `backend/manifestGenerator.js` | 172 | Manifest generation |
| `backend/fileWatcher.js` | 139 | File watching |
| `backend/gapAnalyzer.js` | 651 | Gap analysis |
| `backend/intentSeeder.js` | 510 | Intent seeding |
| `backend/prdGenerator.js` | 200 | PRD generation |
| `backend/brunoOscar.js` | 185 | Lifecycle management |
| `lib/utils/astParser.js` | 1066 | AST parsing |
| `lib/utils/safeFs.js` | 598 | Safe filesystem |
| `lib/utils/ioChan.js` | 395 | I/O channels |
| `lib/commands/insightStore.js` | 361 | Insight storage |
| `lib/commands/parserPersistence.js` | 294 | Parser persistence |
| `lib/commands/overview.js` | 349 | File overview |
| `lib/commands/storeParser.js` | 340 | Store parsing |
| `lib/commands/routeParser.js` | 312 | Route parsing |
| `lib/commands/commandParser.js` | 270 | Command parsing |
| `lib/commands/typeParser.js` | 156 | Type parsing |
| `lib/commands/uiParser.js` | 196 | UI parsing |
| `lib/commands/integr8/dataIngestion.js` | 1101 | Data ingestion |
| `lib/commands/integr8/relationshipAnalyzer.js` | 923 | Relationship analysis |
| `lib/commands/integr8/pathGenerator.js` | 858 | Path generation |
| `lib/commands/integr8/tomlSerializer.js` | 417 | TOML serialization |
| `lib/commands/integr8/reportGenerator.js` | 283 | Report generation |
| `lib/commands/integr8/types.js` | 83 | Type definitions |
| `lib/commands/integr8/databasePersister.js` | 229 | Graph persistence |

### ⚠️ Orphaned (No Consumers)
| File | Lines | Purpose |
|------|-------|---------|
| `lib/utils/groundPlane.js` | 268 | Directory verification |
| `lib/commands/backgroundIndexer.js` | 811 | Background indexing |
| `lib/commands/graphBuilder.js` | 214 | Graph building |
| `lib/commands/graphTraversal.js` | 827 | Graph traversal |

### 🔴 Frontend (Zero Connectivity)
| File | Lines | Purpose |
|------|-------|---------|
| `coordination.js` | 210 | Multi-LLM sync |
| `file-explorer.js` | 748 | File browser |
| `graph-visualizer.js` | 456 | Graph visualization |
| `phreak-terminal.js` | 1086 | Terminal interface |
| `settings-reader.js` | 113 | Settings persistence |
| `settings-ui.js` | 339 | Settings UI |

### ⚠️ Dormant Code (Not Dead — Not Yet Wired)
| File | Lines | Purpose | Exports | Status |
|------|-------|---------|---------|--------|
| `lib/commands/integr8/index.js` | 140 | Orchestrator | 1 | Never called — sub-components used directly |
| `lib/commands/integr8/migrationExecutor.js` | 1836 | Migration execution | 11 | Never wired — has real APIs for atomic migration, rollback, snapshots |
| `fake-stream.js` | 139 | Fake stream | 1 | Being removed from codebase |

**Key insight:** `migrationExecutor.js` has 11 exported functions including `executeAtomicMigration`, `rollbackFromSnapshot`, `createPreMigrationSnapshot` — this is sophisticated migration infrastructure, not dead code. It needs to be wired up, not deleted.

---

## Proposed File Mapping

### Core Infrastructure (`src/0_core/`)

| Target File | Source File(s) | Lines |
|-------------|----------------|-------|
| `0_database/0_connection.js` | `persistence.js` (constructor, initialize, close) | ~50 |
| `0_database/0_schema/0_001_initial.sql` | `persistence.js` (ST8_SCHEMA) | ~120 |
| `0_database/0_queries/0_file-registry.js` | `persistence.js` (file registry methods) | ~80 |
| `0_database/0_queries/0_connections.js` | `persistence.js` (connection methods) | ~25 |
| `0_database/0_queries/0_file-intent.js` | `persistence.js` (intent methods) | ~40 |
| `0_database/0_queries/0_mutation-log.js` | `persistence.js` (mutation log methods) | ~40 |
| `0_database/0_queries/0_activity-log.js` | `persistence.js` (activity log methods) | ~20 |
| `0_database/0_queries/0_settings.js` | `persistence.js` (settings methods) | ~45 |
| `0_database/0_queries/0_prd-projects.js` | `persistence.js` (PRD project methods) | ~45 |
| `0_database/0_graph-persister.js` | `integr8/databasePersister.js` | 229 |
| `0_server/0_app.js` | `server.js` (constructor, start, stop) | ~50 |
| `0_server/0_index.js` | `index.js` (main function) | 435 |
| `0_server/0_routes/0_api/0_files.js` | `server.js` (_handleFileList) | ~50 |
| `0_server/0_routes/0_api/0_connections.js` | `server.js` (_serveManifest) | ~25 |
| `0_server/0_routes/0_api/0_schema-cards.js` | `server.js` (_handlePrd) | ~30 |
| `0_server/0_routes/0_api/0_settings.js` | `server.js` (_handleSettings) | ~80 |
| `0_server/0_routes/0_api/0_health.js` | `server.js` (_serveHealth) | ~10 |
| `0_server/0_routes/0_api/0_sse.js` | `server.js` (_handleMutationsSSE) | ~10 |
| `0_server/0_middleware/0_cors.js` | `server.js` (CORS headers) | ~15 |
| `0_notification-bus.js` | `notificationBus.js` | 126 |
| `0_config/0_default.js` | New | ~50 |
| `0_config/0_index.js` | New | ~20 |
| `0_logging/0_logger.js` | New | ~50 |
| `0_logging/0_index.js` | New | ~20 |
| `0_errors/0_st8-error.js` | New | ~30 |
| `0_errors/0_index.js` | New | ~20 |

### Features (`src/0_features/`)

| Target File | Source File(s) | Lines |
|-------------|----------------|-------|
| `0_indexing/0_indexer.js` | `indexer.js` | 482 |
| `0_indexing/0_ast-parser.js` | `lib/utils/astParser.js` | 1066 |
| `0_indexing/0_file-scanner.js` | `indexer.js` (discoverFiles) | ~30 |
| `0_indexing/0_fingerprint.js` | `st8-types.js` (generateFingerprint) | ~20 |
| `0_indexing/0_background-indexer.js` | `lib/commands/backgroundIndexer.js` | 811 |
| `0_indexing/0_parser-persistence.js` | `lib/commands/parserPersistence.js` | 294 |
| `0_indexing/0_overview.js` | `lib/commands/overview.js` | 349 |
| `0_indexing/0_store-parser.js` | `lib/commands/storeParser.js` | 340 |
| `0_indexing/0_route-parser.js` | `lib/commands/routeParser.js` | 312 |
| `0_indexing/0_command-parser.js` | `lib/commands/commandParser.js` | 270 |
| `0_indexing/0_type-parser.js` | `lib/commands/typeParser.js` | 156 |
| `0_indexing/0_ui-parser.js` | `lib/commands/uiParser.js` | 196 |
| `0_indexing/0_data-ingestion.js` | `integr8/dataIngestion.js` | 1101 |
| `0_analysis/0_gap-analyzer.js` | `gapAnalyzer.js` | 651 |
| `0_analysis/0_intent-seeder.js` | `intentSeeder.js` | 510 |
| `0_analysis/0_relationship-analyzer.js` | `integr8/relationshipAnalyzer.js` | 923 |
| `0_analysis/0_path-generator.js` | `integr8/pathGenerator.js` | 858 |
| `0_analysis/0_report-generator.js` | `integr8/reportGenerator.js` | 283 |
| `0_analysis/0_insight-store.js` | `lib/commands/insightStore.js` | 361 |
| `0_schema-cards/0_emitter.js` | `schemaCardEmitter.js` | 209 |
| `0_schema-cards/0_printer.js` | `schemaCardPrinter.js` | 294 |
| `0_schema-cards/0_manifest-generator.js` | `manifestGenerator.js` | 172 |
| `0_prd/0_generator.js` | `prdGenerator.js` | 200 |
| `0_graph/0_builder.js` | `lib/commands/graphBuilder.js` | 214 |
| `0_graph/0_traversal.js` | `lib/commands/graphTraversal.js` | 827 |
| `0_graph/0_visualizer.js` | `graph-visualizer.js` | 456 |
| `0_watcher/0_file-watcher.js` | `fileWatcher.js` | 139 |
| `0_lifecycle/0_bruno.js` | `brunoOscar.js` | 185 |

### Frontend (`src/0_frontend/`)

| Target File | Source File(s) | Lines |
|-------------|----------------|-------|
| `0_components/0_file-explorer/0_file-explorer.js` | `file-explorer.js` | 748 |
| `0_components/0_terminal/0_terminal.js` | `phreak-terminal.js` | 1086 |
| `0_components/0_graph-viewer/0_graph-viewer.js` | `graph-visualizer.js` | 456 |
| `0_components/0_settings/0_settings.js` | `settings-ui.js` | 339 |
| `0_services/0_coordination.js` | `coordination.js` | 210 |
| `0_services/0_state.js` | `settings-reader.js` | 113 |
| `0_app.js` | New | ~50 |
| `0_index.html` | `st8.html` (HTML only) | ~70 |

### Shared (`src/0_shared/`)

| Target File | Source File(s) | Lines |
|-------------|----------------|-------|
| `0_types/0_st8-types.js` | `st8-types.js` | 281 |
| `0_types/0_integr8-types.js` | `integr8/types.js` | 83 |
| `0_utils/0_safe-fs.js` | `lib/utils/safeFs.js` | 598 |
| `0_utils/0_io-chan.js` | `lib/utils/ioChan.js` | 395 |
| `0_utils/0_ground-plane.js` | `lib/utils/groundPlane.js` | 268 |
| `0_utils/0_crypto.js` | `indexer.js` (hashFile) | ~20 |
| `0_utils/0_path.js` | New | ~30 |
| `0_constants/0_file-extensions.js` | `indexer.js` (CODE_EXTENSIONS) | ~15 |
| `0_constants/0_lifecycle-phases.js` | `st8-types.js` (LifecyclePhase) | ~15 |
| `0_constants/0_file-status.js` | `st8-types.js` (FileStatus) | ~15 |
| `0_constants/0_mutation-types.js` | `st8-types.js` (MutationType) | ~15 |

---

## Files to DELETE

**NONE.** 

No files will be deleted during this refactoring. All files will be copied to their target locations. Benjamin will decide what gets removed after the refactoring is complete.

**Files previously flagged as "dead code" — now marked as "dormant":**
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `lib/commands/integr8/index.js` | 140 | Orchestrator | Dormant — sub-components used directly |
| `lib/commands/integr8/migrationExecutor.js` | 1836 | Migration execution | Dormant — 11 exported APIs for atomic migration, rollback, snapshots |
| `fake-stream.js` | 139 | Fake stream | Being removed from codebase (Benjamin's decision) |

---

## Next Steps

1. **You copy** each source file to its target location(s)
2. **I specify** exactly which lines/sections to keep in each copy
3. **You delete** the specified sections from the copies (only if you choose to)
4. **We verify** each copy works before touching the original
5. **You decide** what happens to the originals

---

## Next Steps

1. **You copy** each source file to its target location(s)
2. **I specify** exactly which lines/sections to keep in each copy
3. **You delete** the specified sections from the copies
4. **We verify** each copy works before touching the original
5. **You delete** the original only after verification

---

*Generated for architecture refactoring reference*
