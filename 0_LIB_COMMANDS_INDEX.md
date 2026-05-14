# LIB/COMMANDS FILE INDEX

**Directory:** `lib/commands/`
**Files:** 16 (including integr8/)
**Generated:** 2026-05-14

---

## 1. backgroundIndexer.js (811 lines)

**Purpose:** Background indexing engine — "parse to oblivion" vision
**Source:** Compiled from `src/commands/backgroundIndexer.ts`
**Status:** ⚠️ RED — no consumers

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `BackgroundIndexer` | class | 796 | Main background indexer class |
| `getBackgroundIndexer` | function | 52 | Singleton accessor |

### Key Methods
| Method | Purpose |
|--------|---------|
| `addProject()` | Register project for indexing |
| `removeProject()` | Remove project |
| `executeFullIndex()` | 6-phase full index pipeline |
| `executeIncrementalIndex()` | Incremental re-indexing |
| `discoverSourceFiles()` | File discovery |
| `extractInsights()` | Insight extraction |
| `persistGraph()` | Graph persistence |
| `populateSonicIndex()` | Sonic search indexing |
| `setupWatcher()` | File watcher setup |

### Dependencies
- `./integr8/dataIngestion.js`
- `./integr8/databasePersister.js`
- `./integr8/types.js`
- `./insightStore.js`
- `./parserPersistence.js`
- `better-sqlite3`, `chokidar`, `fast-glob`

### Proposed Target
- `src/0_features/0_indexing/0_background-indexer.js`

---

## 2. graphBuilder.js (214 lines)

**Purpose:** Dependency graph builder with health scoring
**Source:** Compiled from `src/commands/graphBuilder.ts`
**Status:** ⚠️ RED — no consumers

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `buildDependencyGraph` | function | 14 | Build dependency graph |
| `getImpactAnalysis` | function | 15 | Get impact analysis for file |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `buildDependencyGraph` | 21-113 | Build graph with health scoring |
| `detectCircularDependencies` | 117-151 | DFS-based cycle detection |
| `computeImpactRadius` | 155-169 | BFS impact radius computation |
| `getImpactAnalysis` | 174-213 | Impact analysis for single file |

### Dependencies
- `./integr8/types.js`
- `./integr8/dataIngestion.js`

### Proposed Target
- `src/0_features/0_graph/0_builder.js`

---

## 3. graphTraversal.js (827 lines)

**Purpose:** Graph traversal and directory-boundary-aware queries
**Source:** Compiled from `src/commands/graphTraversal.ts`
**Status:** ⚠️ RED — no consumers

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `clearCache` | function | 48 | Clear traversal cache |
| `ensureIndexes` | function | 49 | Ensure database indexes |
| `findPaths` | function | 50 | Find paths between nodes |
| `analyzeReachability` | function | 51 | Analyze reachability |
| `extractSubgraph` | function | 52 | Extract subgraph |
| `computeImpactChain` | function | 53 | Compute impact chain |
| `findImportsOf` | function | 54 | Find imports of file |
| `findConsumersOf` | function | 55 | Find consumers of file |
| `findOrphans` | function | 56 | Find orphaned files |
| `getDirectorySubgraph` | function | 57 | Get subgraph for directory |
| `getDirectoryBoundary` | function | 58 | Get directory boundary |
| `getDataFlowMetrics` | function | 59 | Get data flow metrics |
| `getFileFlows` | function | 60 | Get file flows |

### Dependencies
- `better-sqlite3`
- `./integr8/databasePersister.js`

### Proposed Target
- `src/0_features/0_graph/0_traversal.js`

---

## 4. insightStore.js (361 lines)

**Purpose:** FileInsightSlot-based insight accumulation store
**Source:** Compiled from `src/commands/insightStore.ts`
**Status:** 🟢 GREEN — consumed by backgroundIndexer

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `InsightStore` | class | 350 | Insight store class |
| `getInsightStore` | function | 43 | Singleton accessor |

### Key Methods
| Method | Purpose |
|--------|---------|
| `ensureTables()` | Create tables |
| `addInsight()` | Add insight for file |
| `getInsights()` | Get insights for file |
| `getInsightsByCategory()` | Get insights by category |
| `getRecentInsights()` | Get recent insights |

### Dependencies
- `better-sqlite3`
- `./integr8/databasePersister.js`

### Proposed Target
- `src/0_features/0_analysis/0_insight-store.js`

---

## 5. parserPersistence.js (294 lines)

**Purpose:** Database-first parser persistence layer
**Source:** Compiled from `src/commands/parserPersistence.ts`
**Status:** 🟢 GREEN — consumed by backgroundIndexer

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `ParserPersistence` | class | 294 | Parser persistence class |

### Key Methods
| Method | Purpose |
|--------|---------|
| `ensureProjectTables()` | Create tables |
| `saveParserOutput()` | Save parser output |
| `getParserOutput()` | Get parser output |
| `getParserOutputs()` | Get all parser outputs |

### Dependencies
- `better-sqlite3`
- `./integr8/databasePersister.js`

### Proposed Target
- `src/0_features/0_indexing/0_parser-persistence.js`

---

## 6. overview.js (349 lines)

**Purpose:** File index generation
**Source:** Compiled from `src/commands/overview.ts`
**Status:** 🟢 GREEN — consumed by dataIngestion

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `generateOverviewAndGetFileList` | function | 15 | Generate file overview |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `generateOverviewAndGetFileList` | 15+ | Generate numbered file index |
| `getRelativeProjectFiles` | 38-57 | Get sorted file list |

### Dependencies
- `fast-glob`
- `fs-extra`

### Proposed Target
- `src/0_features/0_indexing/0_overview.js`

---

## 7-11. Parser Files (5 files)

### storeParser.js (340 lines)
**Purpose:** Store/state management parsing
**Export:** `generateStoreReport`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_features/0_indexing/0_store-parser.js`

### routeParser.js (312 lines)
**Purpose:** Route/navigation parsing
**Export:** `generateRouteReport`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_features/0_indexing/0_route-parser.js`

### commandParser.js (270 lines)
**Purpose:** Command/CLI parsing
**Export:** `generateCommandReport`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_features/0_indexing/0_command-parser.js`

### typeParser.js (156 lines)
**Purpose:** Type definition parsing
**Export:** `generateTypeReport`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_features/0_indexing/0_type-parser.js`

### uiParser.js (196 lines)
**Purpose:** UI component parsing
**Export:** `generateUiComponentReport`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_features/0_indexing/0_ui-parser.js`

---

## Integr8 Pipeline (lib/commands/integr8/)

### 12. index.js (140 lines)

**Purpose:** Main orchestrator — 3-stage pipeline
**Status:** ⚠️ RED — dead code (never called)

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `runIntegr8Command` | function | 47 | Run full integr8 pipeline |

### Dependencies
- `./dataIngestion.js`
- `./relationshipAnalyzer.js`
- `./pathGenerator.js`
- `./tomlSerializer.js`
- `./reportGenerator.js`
- `./databasePersister.js`

### Proposed Target
- DELETE (dead code)

---

### 13. dataIngestion.js (1101 lines)

**Purpose:** Stage 1: Data ingestion — calls 6 parsers
**Status:** 🟢 GREEN

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `getParserHealthReport` | function | 47 | Get parser health |
| `resetParserHealth` | function | 48 | Reset parser health |
| `ingestSingleProject` | function | 49 | Ingest single project |
| `ingestProjectData` | function | 50 | Ingest project data |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `retryParser` | 164-204 | Retry with circuit breaker |
| `fallbackChainParser` | 205-226 | 3-tier fallback chain |
| `detectSideEffectImports` | 235-256 | Side-effect import detection |
| `detectConditionalDynamicImports` | 257-304 | Dynamic import detection |
| `detectBarrelReexports` | 305-343 | Barrel re-export detection |
| `enhancedImportScan` | 344-363 | Enhanced import scanning |
| `parseOverviewToNodes` | 378-402 | Overview parsing |
| `parseStoreReportToNodes` | 403-443 | Store parsing |
| `parseRouteReportToNodes` | 444-476 | Route parsing |
| `parseCommandReportToNodes` | 477-524 | Command parsing |
| `parseTypeReportToNodes` | 525-558 | Type parsing |
| `parseUiReportToNodes` | 559-592 | UI parsing |
| `parseImportsFromText` | 593-645 | Import parsing |
| `buildEdges` | 724-819 | Edge building |
| `ingestSingleProject` | 820-1075 | Main ingestion function |
| `ingestProjectData` | 1076-1101 | Entry point |

### Dependencies
- `./types.js`
- `../overview.js`
- `../storeParser.js`
- `../routeParser.js`
- `../commandParser.js`
- `../typeParser.js`
- `../uiParser.js`
- `../parserPersistence.js`
- `../../utils/astParser.js`
- `../../utils/safeFs.js`
- `../../utils/ioChan.js`

### Proposed Target
- `src/0_features/0_indexing/0_data-ingestion.js`

---

### 14. relationshipAnalyzer.js (923 lines)

**Purpose:** Stage 2: Relationship analysis
**Status:** 🟢 GREEN

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `analyzeRelationships` | function | 5 | Analyze relationships |
| `analyzeStructuralSubtyping` | function | 6 | Structural subtyping |
| `detectBreakingChanges` | function | 7 | Breaking change detection |
| `computeTarjanSCC` | function | 8 | Tarjan's SCC |
| `detectCyclesWithTarjan` | function | 9 | Cycle detection |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `analyzeRelationships` | 15+ | Main analysis function |
| `findMatchingExport` | - | Find matching export |
| `classifyDependency` | - | Classify dependency |
| `detectConflicts` | - | Detect conflicts |
| `computeTarjanSCC` | - | Tarjan's SCC algorithm |
| `detectCyclesWithTarjan` | - | Cycle detection |

### Dependencies
- `./types.js`

### Proposed Target
- `src/0_features/0_analysis/0_relationship-analyzer.js`

---

### 15. pathGenerator.js (858 lines)

**Purpose:** Stage 3: Path generation
**Status:** 🟢 GREEN

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `generateMigrationPath` | function | 39 | Generate migration path |
| `performTopologicalAnalysis` | function | 40 | Topological analysis |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `generateMigrationPath` | 39+ | Main path generation |
| `performTopologicalAnalysis` | - | Topological sort |
| `findBreakPoints` | - | Find break points |
| `estimateComplexity` | - | Estimate complexity |

### Dependencies
- `./types.js`

### Proposed Target
- `src/0_features/0_analysis/0_path-generator.js`

---

### 16. migrationExecutor.js (1836 lines)

**Purpose:** Migration execution
**Status:** ⚠️ RED — dead code (never wired)

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `loadMigrationPlan` | function | 46 | Load migration plan |
| `executeMigrationPlan` | function | 47 | Execute migration plan |
| `detectRouterFramework` | function | 48 | Detect router framework |
| `detectFrameworkFromPackageJson` | function | 49 | Detect framework |
| `verifyIntegration` | function | 50 | Verify integration |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `loadMigrationPlan` | - | Load TOML plan |
| `executeMigrationPlan` | - | Execute plan steps |
| `copyFile` | - | Copy file |
| `rewriteImport` | - | Rewrite import |
| `mergeRoute` | - | Merge route |
| `resolveConflict` | - | Resolve conflict |
| `verifyIntegration` | - | Verify integration |

### Dependencies
- `./tomlSerializer.js`
- `fs-extra`
- `child_process`

### Proposed Target
- DELETE (dead code) or `src/0_features/0_analysis/0_migration-executor.js`

---

### 17-19. Supporting Files

### tomlSerializer.js (417 lines)
**Purpose:** TOML serialization
**Exports:** `serializeMigrationPlanToToml`, `serializeGraphMetadataToToml`, `parseMigrationPlanFromToml`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_shared/0_utils/0_toml-serializer.js`

### reportGenerator.js (283 lines)
**Purpose:** Report generation
**Exports:** `generateMigrationReport`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_features/0_analysis/0_report-generator.js`

### types.js (83 lines)
**Purpose:** Type definitions
**Exports:** `IntegrationOutcome`, `DependencyStatus`, `NodeType`, `EdgeType`, `MigrationAction`, `ConflictType`, `ResolutionStrategy`, `VerificationLevel`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_shared/0_types/0_integr8-types.js`

### databasePersister.js (229 lines)
**Purpose:** SQLite persistence for graphs
**Exports:** `DatabasePersister`, `getSharedDatabasePath`
**Status:** 🟢 GREEN
**Proposed Target:** `src/0_core/0_database/0_graph-persister.js`

---

## Summary

| File | Lines | Exports | Status | Proposed Target |
|------|-------|---------|--------|-----------------|
| `backgroundIndexer.js` | 811 | 2 | ⚠️ RED | `src/0_features/0_indexing/0_background-indexer.js` |
| `graphBuilder.js` | 214 | 2 | ⚠️ RED | `src/0_features/0_graph/0_builder.js` |
| `graphTraversal.js` | 827 | 13 | ⚠️ RED | `src/0_features/0_graph/0_traversal.js` |
| `insightStore.js` | 361 | 2 | 🟢 GREEN | `src/0_features/0_analysis/0_insight-store.js` |
| `parserPersistence.js` | 294 | 1 | 🟢 GREEN | `src/0_features/0_indexing/0_parser-persistence.js` |
| `overview.js` | 349 | 1 | 🟢 GREEN | `src/0_features/0_indexing/0_overview.js` |
| `storeParser.js` | 340 | 1 | 🟢 GREEN | `src/0_features/0_indexing/0_store-parser.js` |
| `routeParser.js` | 312 | 1 | 🟢 GREEN | `src/0_features/0_indexing/0_route-parser.js` |
| `commandParser.js` | 270 | 1 | 🟢 GREEN | `src/0_features/0_indexing/0_command-parser.js` |
| `typeParser.js` | 156 | 1 | 🟢 GREEN | `src/0_features/0_indexing/0_type-parser.js` |
| `uiParser.js` | 196 | 1 | 🟢 GREEN | `src/0_features/0_indexing/0_ui-parser.js` |
| `integr8/index.js` | 140 | 1 | ⚠️ RED | DELETE |
| `integr8/dataIngestion.js` | 1101 | 4 | 🟢 GREEN | `src/0_features/0_indexing/0_data-ingestion.js` |
| `integr8/relationshipAnalyzer.js` | 923 | 5 | 🟢 GREEN | `src/0_features/0_analysis/0_relationship-analyzer.js` |
| `integr8/pathGenerator.js` | 858 | 2 | 🟢 GREEN | `src/0_features/0_analysis/0_path-generator.js` |
| `integr8/migrationExecutor.js` | 1836 | 5 | ⚠️ RED | DELETE or `src/0_features/0_analysis/0_migration-executor.js` |
| `integr8/tomlSerializer.js` | 417 | 3 | 🟢 GREEN | `src/0_shared/0_utils/0_toml-serializer.js` |
| `integr8/reportGenerator.js` | 283 | 1 | 🟢 GREEN | `src/0_features/0_analysis/0_report-generator.js` |
| `integr8/types.js` | 83 | 8 | 🟢 GREEN | `src/0_shared/0_types/0_integr8-types.js` |
| `integr8/databasePersister.js` | 229 | 2 | 🟢 GREEN | `src/0_core/0_database/0_graph-persister.js` |

**Total:** 10,000+ lines, 60+ exports

---

*Generated for architecture refactoring reference*
