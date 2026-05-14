# BACKEND FILE INDEX

**Directory:** `backend/`
**Files:** 14
**Generated:** 2026-05-14

---

## 1. index.js (435 lines)

**Purpose:** Main entry point — orchestrates all backend modules
**Status:** ✅ Working

### Exports
None (side-effect entry point)

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `main()` | 42-428 | Main application entry point |

### Dependencies
- `./indexer`, `./persistence`, `./manifestGenerator`, `./fileWatcher`
- `./server`, `./st8-types`, `./schemaCardEmitter`, `./schemaCardPrinter`
- `./notificationBus`, `./gapAnalyzer`, `./intentSeeder`

### Proposed Target
- `src/0_core/0_server/0_index.js` (entry point)

---

## 2. indexer.js (482 lines)

**Purpose:** File indexing engine — discovery, hashing, parsing, classification
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `indexDirectory` | function | 474 | Main indexing function |
| `discoverFiles` | function | 475 | File discovery |
| `hashFile` | function | 476 | File hashing |
| `parseImports` | function | 477 | Import parsing |
| `buildGraph` | function | 478 | Graph building |
| `generateManifest` | function | 479 | Manifest generation |
| `writeManifest` | function | 480 | Manifest writing |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `discoverFiles` | 164-190 | Recursive directory walker |
| `hashFile` | 196-204 | SHA-256 hashing |
| `parseImports` | 208-232 | AST-based import extraction |
| `buildGraph` | 236-279 | Dependency graph building |
| `classifyBasic` | 281-317 | Basic classification fallback |
| `generateManifest` | 321-346 | Manifest generation |
| `writeManifest` | 348-358 | Manifest writing |
| `indexDirectory` | 362-433 | Main indexing pipeline |

### Dependencies
- `./st8-types`
- `lib/utils/astParser.js`
- `lib/commands/graphBuilder.js`

### Proposed Target
- `src/0_features/0_indexing/0_indexer.js`

---

## 3. persistence.js (704 lines)

**Purpose:** SQLite database layer
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `St8Persistence` | class | 703 | Main persistence class |

### Key Methods
| Method | Lines | Purpose |
|--------|-------|---------|
| `initialize()` | 172-196 | Database initialization |
| `upsertFile()` | 200-222 | Upsert file record |
| `getAllFiles()` | 229-238 | Get all files |
| `deleteFile()` | 245-260 | Delete file |
| `insertConnection()` | 281-296 | Insert connection |
| `upsertIntent()` | 305-318 | Upsert intent |
| `logMutation()` | 343-357 | Log mutation |
| `registerConceptFile()` | 383-420 | Register concept file |
| `purgeDevelopmentData()` | 424-461 | Purge development data |
| `logActivity()` | 465-477 | Log activity |
| `upsertSetting()` | 486-492 | Upsert setting |
| `close()` | 685-697 | Close database |

### Dependencies
- `./st8-types`
- `better-sqlite3`

### Proposed Target
- `src/0_core/0_database/0_connection.js` (constructor, initialize, close)
- `src/0_core/0_database/0_queries/*.js` (query methods)

---

## 4. server.js (1430 lines)

**Purpose:** HTTP server with API routes
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `St8Server` | class | 1429 | Main server class |

### Key Methods
| Method | Lines | Purpose |
|--------|-------|---------|
| `start()` | 44-54 | Start server |
| `_handleRequest()` | 56-78 | Request handler |
| `_handleApiRequest()` | 80-146 | API route dispatch |
| `_serveStaticFile()` | 148-185 | Static file serving |
| `_serveManifest()` | 187-209 | Manifest endpoint |
| `_serveToml()` | 211-233 | TOML endpoint |
| `_serveHealth()` | 235-243 | Health endpoint |
| `_handleIndex()` | 245-314 | Index endpoint |
| `_handleFileIntent()` | 316-413 | File intent endpoint |
| `_handleSettings()` | 415-490 | Settings endpoint |
| `_handleFileList()` | 492-542 | File list endpoint |
| `_handleVerify()` | 544-738 | Verify endpoint |
| `_handleMutationsSSE()` | 740-747 | SSE endpoint |
| `_handleConceptFile()` | 749-839 | Concept file endpoint |
| `_handleMvpLock()` | 841-928 | MVP lock endpoint |
| `_handlePrd()` | 930-959 | PRD endpoint |
| `_handleProductionPromote()` | 961-1028 | Production promote endpoint |
| `_handleGapAnalysis()` | 1030-1069 | Gap analysis endpoint |
| `_handlePrdProjects()` | 1071-1169 | PRD projects endpoint |
| `_handleBrunoCall()` | 1171-1224 | Bruno call endpoint |
| `_handleOscarHouse()` | 1226-1279 | Oscar house endpoint |
| `_handleNeedsAIReview()` | 1281-1304 | Needs AI review endpoint |
| `_handleMarkReviewed()` | 1306-1360 | Mark reviewed endpoint |
| `_handleTemplates()` | 1362-1416 | Templates endpoint |
| `stop()` | 1418-1423 | Stop server |

### Dependencies
- `http`, `fs`, `path`
- `./indexer`, `./persistence`, `./manifestGenerator`
- `./notificationBus`, `./schemaCardEmitter`, `./prdGenerator`
- `./gapAnalyzer`, `./brunoOscar`, `./templateEngine`

### Proposed Target
- `src/0_core/0_server/0_app.js` (constructor, start, stop)
- `src/0_core/0_server/0_routes/0_api/*.js` (endpoint handlers)
- `src/0_core/0_server/0_middleware/*.js` (middleware)

---

## 5. st8-types.js (281 lines)

**Purpose:** Canonical type definitions
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `LifecyclePhase` | enum | 266 | Lifecycle phases |
| `FileStatus` | enum | 266 | File statuses |
| `MutationType` | enum | 266 | Mutation types |
| `ActorType` | enum | 266 | Actor types |
| `St8FileEntry` | object | 266 | File entry shape |
| `St8SchemaCard` | object | 266 | Schema card shape |
| `St8MutationRecord` | object | 266 | Mutation record shape |
| `validateAgainstShape` | function | 266 | Generic validator |
| `validateSt8FileEntry` | function | 266 | File entry validator |
| `validateSt8SchemaCard` | function | 266 | Schema card validator |
| `validateSt8MutationRecord` | function | 266 | Mutation record validator |
| `generateFingerprint` | function | 266 | Fingerprint generator |
| `parseFingerprint` | function | 266 | Fingerprint parser |

### Dependencies
- None

### Proposed Target
- `src/0_shared/0_types/0_st8-types.js`

---

## 6. schemaCardEmitter.js (209 lines)

**Purpose:** Schema card JSON generation
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `SchemaCardEmitter` | class | - | Schema card emitter |

### Key Methods
| Method | Purpose |
|--------|---------|
| `emitCard()` | Emit single card |
| `emitAllCards()` | Emit all cards |
| `diff()` | Compare cards |

### Dependencies
- `./st8-types`

### Proposed Target
- `src/0_features/0_schema-cards/0_emitter.js`

---

## 7. schemaCardPrinter.js (294 lines)

**Purpose:** Human-readable .txt fallback
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `SchemaCardPrinter` | class | - | Schema card printer |

### Key Methods
| Method | Purpose |
|--------|---------|
| `printCard()` | Print single card |
| `printAllFromCards()` | Print all cards |

### Dependencies
- None

### Proposed Target
- `src/0_features/0_schema-cards/0_printer.js`

---

## 8. notificationBus.js (126 lines)

**Purpose:** Event-driven notification system
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `notificationBus` | singleton | - | Notification bus |

### Key Methods
| Method | Purpose |
|--------|---------|
| `publish()` | Publish event |
| `addSSEClient()` | Add SSE client |
| `setPrinter()` | Set printer |

### Dependencies
- `events` (Node.js)

### Proposed Target
- `src/0_core/0_server/0_notification-bus.js`

---

## 9. manifestGenerator.js (172 lines)

**Purpose:** JSON/TOML manifest generation
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `writeManifests` | function | - | Write manifests |

### Key Functions
| Function | Purpose |
|----------|---------|
| `generateConnectionState()` | Generate JSON manifest |
| `generateAiSignalToml()` | Generate TOML manifest |
| `writeManifests()` | Write both manifests |

### Dependencies
- `./st8-types`

### Proposed Target
- `src/0_features/0_schema-cards/0_manifest-generator.js`

---

## 10. fileWatcher.js (139 lines)

**Purpose:** File change detection
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `FileWatcher` | class | - | File watcher |

### Key Methods
| Method | Purpose |
|--------|---------|
| `start()` | Start watching |
| `stop()` | Stop watching |

### Dependencies
- `chokidar`

### Proposed Target
- `src/0_features/0_watcher/0_file-watcher.js`

---

## 11. gapAnalyzer.js (651 lines)

**Purpose:** 6-dimension gap analysis
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `GapAnalyzer` | class | - | Gap analyzer |

### Key Methods
| Method | Purpose |
|--------|---------|
| `analyze()` | Run analysis |
| `writeReport()` | Write report |
| `toMarkdown()` | Convert to markdown |

### Dependencies
- `fs`, `path`

### Proposed Target
- `src/0_features/0_analysis/0_gap-analyzer.js`

---

## 12. intentSeeder.js (510 lines)

**Purpose:** Auto-generate intent from AST
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `IntentSeeder` | class | - | Intent seeder |

### Key Methods
| Method | Purpose |
|--------|---------|
| `seedAll()` | Seed all files |
| `seedFile()` | Seed single file |

### Dependencies
- `fs`, `path`

### Proposed Target
- `src/0_features/0_analysis/0_intent-seeder.js`

---

## 13. prdGenerator.js (200 lines)

**Purpose:** PRD generation from schema cards
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `loadSchemaCards` | function | - | Load schema cards |
| `generatePRD` | function | - | Generate PRD |

### Dependencies
- `fs`, `path`

### Proposed Target
- `src/0_features/0_prd/0_generator.js`

---

## 14. brunoOscar.js (185 lines)

**Purpose:** Automatic file lifecycle management
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `BrunoOscar` | class | - | Bruno & Oscar |

### Key Methods
| Method | Purpose |
|--------|---------|
| `runBrunoCall()` | Scan for stale files |
| `runOscarHouse()` | Archive flagged files |

### Dependencies
- None

### Proposed Target
- `src/0_features/0_lifecycle/0_bruno.js`

---

## Summary

| File | Lines | Exports | Status | Proposed Target |
|------|-------|---------|--------|-----------------|
| `index.js` | 435 | 0 | ✅ Working | `src/0_core/0_server/0_index.js` |
| `indexer.js` | 482 | 7 | ✅ Working | `src/0_features/0_indexing/0_indexer.js` |
| `persistence.js` | 704 | 1 | ✅ Working | `src/0_core/0_database/*.js` |
| `server.js` | 1430 | 1 | ✅ Working | `src/0_core/0_server/*.js` |
| `st8-types.js` | 281 | 13 | ✅ Working | `src/0_shared/0_types/0_st8-types.js` |
| `schemaCardEmitter.js` | 209 | 1 | ✅ Working | `src/0_features/0_schema-cards/0_emitter.js` |
| `schemaCardPrinter.js` | 294 | 1 | ✅ Working | `src/0_features/0_schema-cards/0_printer.js` |
| `notificationBus.js` | 126 | 1 | ✅ Working | `src/0_core/0_server/0_notification-bus.js` |
| `manifestGenerator.js` | 172 | 1 | ✅ Working | `src/0_features/0_schema-cards/0_manifest-generator.js` |
| `fileWatcher.js` | 139 | 1 | ✅ Working | `src/0_features/0_watcher/0_file-watcher.js` |
| `gapAnalyzer.js` | 651 | 1 | ✅ Working | `src/0_features/0_analysis/0_gap-analyzer.js` |
| `intentSeeder.js` | 510 | 1 | ✅ Working | `src/0_features/0_analysis/0_intent-seeder.js` |
| `prdGenerator.js` | 200 | 2 | ✅ Working | `src/0_features/0_prd/0_generator.js` |
| `brunoOscar.js` | 185 | 1 | ✅ Working | `src/0_features/0_lifecycle/0_bruno.js` |

**Total:** 5818 lines, 32 exports

---

*Generated for architecture refactoring reference*
