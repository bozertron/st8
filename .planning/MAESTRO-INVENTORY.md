# Maestro Scaffolder Tool — Complete Dist Inventory

**Analysis Date:** 2026-05-11
**Source:** `/home/bozertron/Software Projects/maestro-scaffolder-tool/dist/`
**Total Files:** 191 (94 .js, 93 .js.map, 1 .txt, 3 other)
**Total JS Lines:** ~31,800

---

## Quick Reference: What's In The Box

| Capability | Primary File(s) | Relevance to st8 |
|---|---|---|
| **File walking/discovery** | `overview.js`, `typeParser.js`, `uiParser.js`, `storeParser.js` | HIGH — uses `fast-glob` |
| **SHA-256 hashing** | `parserPersistence.js`, `backgroundIndexer.js`, `insightStore.js`, `opportunityClassifier.js`, `module-sdk/installer.js` | HIGH — content fingerprinting |
| **Import/export AST parsing** | `utils/astParser.js`, `dataIngestion.js` | CRITICAL — @babel/parser |
| **Graph building** | `graphBuilder.js`, `graphTraversal.js`, `callGraphCluster.js` | CRITICAL — adjacency lists, DFS |
| **Connection classification** | `integr8/relationshipAnalyzer.js`, `compositionAnalyzer.js` | HIGH — SAFE/REWRITE/CONFLICT/MISSING |
| **SQLite persistence** | `integr8/databasePersister.js`, `parserPersistence.js`, `insightStore.js`, `opportunityCatalog.js` | CRITICAL — better-sqlite3 |
| **File watching** | `backgroundIndexer.js` | HIGH — chokidar |
| **TOML/JSON manifests** | `integr8/tomlSerializer.js`, `featureBoundaryDetector.js` | HIGH |
| **Visualization export** | `architectureExporter.js` | MEDIUM — D3-ready JSON, DOT/Graphviz |

---

## Directory Structure

```
dist/
├── index.js                          # CLI entry point (yargs)
├── main.js                           # Vue app entry (Pinia, NaiveUI)
├── indexjs.txt                       # Older CLI snapshot
├── router/index.js                   # Vue Router config
├── stores/uiState.js                 # Pinia store for UI state
├── commands/                         # 60+ command modules
│   ├── integr8/                      # 7-stage integration pipeline
│   ├── harmonize/                    # Connection discovery engine
│   ├── module-sdk/                   # Plugin architecture
│   ├── llm-adapter/                  # LLM integration (OpenAI/Anthropic)
│   │   ├── providers/
│   │   └── experts/
│   └── [40+ individual command files]
├── utils/                            # Core infrastructure
│   ├── astParser.js
│   ├── safeFs.js
│   ├── ioChan.js
│   ├── groundPlane.js
│   └── ioPathAnalyzer.js
└── components/                       # Migration examples
    └── PlugIn & integr8 Feature Migration/
```

---

## File-by-File Inventory

### Entry Points

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `dist/index.js` | CLI entry — yargs command router for scaffold, integr8, plugin, export-graph, etc. | (CLI entry, no exports) | 3034 | LOW — CLI wiring |
| `dist/main.js` | Vue 3 app entry — creates app with Pinia, router, NaiveUI | (Vue bootstrap) | 17 | LOW — UI only |
| `dist/router/index.js` | Vue Router — single ExplorerView route | `default router` | 28 | LOW — UI only |
| `dist/stores/uiState.js` | Pinia store — project root, file tree, loading state | `useUiStateStore` | 51 | LOW — UI only |

### Core Utilities (`dist/utils/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `utils/astParser.js` | **AST-based import/export extraction using @babel/parser** — handles TS/JS/Vue SFC, re-exports, dynamic imports, export star merging. Falls back to regex. | `extractImportsAndExports(filePath)`, `extractFromText(content)` | 965 | **CRITICAL** |
| `utils/safeFs.js` | **Fortified filesystem wrapper** — never throws, returns `Result<T, FsError>`. Circuit breaker pattern, FileHandlePool, WriteBufferPool. | `safeReadFile`, `safeWriteFile`, `safeReaddir`, `safeMkdir`, `safeStat`, `safeAccess`, `safeUnlink`, `FileHandlePool`, `WriteBufferPool` | 598 | **HIGH** |
| `utils/ioChan.js` | **Priority-based I/O channel router with circuit breakers** — CRITICAL/IMPORTANT/ANALYSIS/BEST_EFFORT tiers. Prevents bulk I/O from starving critical ops. | `ioChan` (singleton), `IoChan`, `CircuitBreaker`, `IoChannelPriority` | 395 | **HIGH** |
| `utils/groundPlane.js` | **Pre-verifies critical directory structure on startup** — ensures stable base state for filesystem ops. | `initGroundPlane`, `getVerifiedPath`, `validateGroundPlane`, `getGroundPlanePaths` | 267 | MEDIUM |
| `utils/ioPathAnalyzer.js` | **AST-based scanner for unprotected fs.* calls** — detects direct fs usage not wrapped in SafeFs. Compliance audit tool. | `IoPathAnalyzer`, `runIoAudit` | 372 | LOW — self-audit |

### Integr8 Pipeline (`dist/commands/integr8/`)

This is the **core integration analysis pipeline** — the most relevant code for st8's graph/indexer needs.

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `integr8/types.js` | **Type system for the entire integr8 pipeline** — enums for NodeType, EdgeType, DependencyStatus, IntegrationOutcome, ConflictType, MigrationAction, ResolutionStrategy, VerificationLevel | All enums exported | 82 | **CRITICAL** |
| `integr8/dataIngestion.js` | **Stage 1: Data Ingestion Engine** — calls existing parsers, parses text output into graph nodes. Builds `SemanticGraph` from parser results. Uses `astParser.js` for AST extraction. | `ingestProjectData`, `ingestSingleProject`, `getParserHealthReport`, `resetParserHealth` | 1101 | **CRITICAL** |
| `integr8/relationshipAnalyzer.js` | **Stage 2: Relationship Analysis Engine** — analyzes relationships between two SemanticGraphs. Identifies dependency matches, conflicts. **Uses Tarjan's SCC for cycle detection.** Classifies deps as SAFE/NEEDS_REWRITE/CONFLICT/MISSING. | `analyzeRelationships`, `analyzeStructuralSubtyping`, `detectBreakingChanges`, `computeTarjanSCC`, `detectCyclesWithTarjan` | 923 | **CRITICAL** |
| `integr8/pathGenerator.js` | **Stage 3: Path Generation** — generates migration plan with topological analysis. Evaluates integration outcome (SUCCESS/PARTIAL/FAILURE/AMBIGUOUS/REDIRECT). | `generateMigrationPath`, `performTopologicalAnalysis` | 858 | **HIGH** |
| `integr8/tomlSerializer.js` | **TOML serialization** — serializes/deserializes MigrationPlan and GraphMetadata to TOML format. | `serializeMigrationPlanToToml`, `serializeGraphMetadataToToml`, `parseMigrationPlanFromToml` | 417 | **HIGH** |
| `integr8/reportGenerator.js` | **Markdown report generator** — produces comprehensive migration report with executive summary, graph analysis, conflicts, steps, risk assessment. | `generateMigrationReport` | 283 | MEDIUM |
| `integr8/databasePersister.js` | **SQLite persistence layer** — stores semantic graphs, migration plans, parser results. Uses `better-sqlite3`. Platform-aware path resolution (Linux/macOS/Windows). | `DatabasePersister`, `getSharedDatabasePath` | 228 | **CRITICAL** |
| `integr8/migrationExecutor.js` | **Migration executor** — executes migration plans, handles router framework detection, rollback, atomic migration with snapshots. | `executeMigrationPlan`, `detectRouterFramework`, `verifyIntegration`, `rollbackMigration`, `createPreMigrationSnapshot`, `executeAtomicMigration` | 1836 | MEDIUM |
| `integr8/index.js` | **Main orchestrator** — wires all three stages together: ingest → analyze → generate path → output. | `runIntegr8Command` | 139 | HIGH |

### Graph & Analysis (`dist/commands/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `graphBuilder.js` | **Cross-file dependency graph builder** — builds adjacency lists (outgoing/incoming Maps), detects circular dependencies via DFS, finds orphaned files, computes health scores. | `buildDependencyGraph`, `getImpactAnalysis` | 213 | **CRITICAL** |
| `graphTraversal.js` | **Graph traversal & directory-boundary-aware queries** — reads from SQLite or in-memory. **BFS path finding**, subgraph extraction, impact analysis, neighbor queries. Uses indexes: `idx_graph_nodes_graph_id`, `idx_graph_edges_from/to`. | `clearCache`, `ensureIndexes`, `findPaths`, + many more | 827 | **CRITICAL** |
| `callGraphCluster.js` | **Call graph clustering** — identifies natural module boundaries from call graph data. Connected-component analysis with configurable coupling thresholds. | `clusterCallGraph`, `detectModuleBoundaries`, `computeCouplingMetrics` | 418 | **HIGH** |
| `backgroundIndexer.js` | **PM-1 Layer 1: Background Indexer** — "parse to oblivion" vision. Non-blocking project registration, exhaustive background indexing, incremental updates. **Uses chokidar for file watching.** SHA-256 for project ID generation. | `BackgroundIndexer` class | 811 | **CRITICAL** |
| `insightStore.js` | **FileInsightSlot-based insight accumulation store** — each parse pass adds insights per file. Queries by file, category, recency. SHA-256 for file ID generation. Uses better-sqlite3. | `InsightStore`, `getInsightStore` | 361 | **HIGH** |
| `multiPassAnalyzer.js` | **PM-1 Layer 2: Multi-pass analysis pipeline** — 5 iterative passes adding layers of understanding. Near-duplicate detection via content hashing (MD5). Architectural layer classification. | `MultiPassAnalyzer` class | 1021 | **HIGH** |
| `patternDiscovery.js` | **Pattern Discovery Engine** — identifies recurring structural patterns by connecting graph traversal, internal flow analysis, and composition data. | `discoverPatterns` | 560 | MEDIUM |
| `internalFlowAnalyzer.js` | **Intra-file data flow analysis** — Babel AST analysis for function definitions, call graphs, import usage tracking, flow warnings. | `analyzeFileInternalFlow` | 849 | **HIGH** |
| `compositionAnalyzer.js` | **Composition analysis orchestrator** — 4 modes: project, directory, file, harmonize. Converts raw graph data into gold/blue classified DataFlows with issue detection. | `analyzeComposition`, `classifyStatus`, `classifyOverall` | 544 | **HIGH** |
| `featureBoundaryDetector.js` | **Smart Feature Boundary Detection** — clusters related stores, routes, components, commands into logical feature boundaries using naming convention analysis. | `detectFeatureBoundaries`, `extractFeatureFiles`, `generateFeatureManifestJson` | 240 | MEDIUM |
| `diffEngine.js` | **Real-time code diff engine** — compares two projects or snapshots, produces structured diffs. | `generateProjectSnapshot`, `computeDiff`, `computeDiffSummary`, `compareTwoProjects` | 251 | MEDIUM |
| `diffHarmonize.js` | **Diff Harmonizer** — detects incomplete refactors in code changes. Finds inconsistencies: renamed but not updated, interface changed but implementations stale. | `harmonizeDiff` | 512 | MEDIUM |
| `historicalAnalyzer.js` | **Historical analysis** — takes snapshots, tracks stability timeline, predicts integration risk. | `takeSnapshot`, `getStabilityTimeline`, `predictIntegrationRisk` | 454 | MEDIUM |
| `apiSurfaceMiner.js` | **API Surface Miner** — extracts and maps public API boundary. Connects composition analyzer with graph traversal. | `mineApiSurface` | 272 | MEDIUM |
| `apiStabilityTracker.js` | **API Stability Tracker** — analyzes API stability, finds deprecated usage, generates stability reports. | `analyzeApiStability`, `findDeprecatedUsage`, `generateApiStabilityReport` | 291 | LOW |
| `escalationPredictor.js` | **Escalation Predictor** — predicts which modules need attention next. Heuristic-based pattern matching on historical/structural data. | `EscalationPredictor` class | 504 | LOW |
| `precisionCapture.js` | **Precision-Capture Manager** — rate-limiting modes with adaptive system monitoring and value-driven progress messaging. | `PrecisionCaptureManager`, `createCaptureManager` | 446 | LOW |
| `conflictResolver.js` | **Conflict resolver** — decision trees, strategy templates, TOML validation, regex analysis, adaptive strategy recommendation, anomaly alerts. | 20+ exported functions | 1461 | MEDIUM |
| `importValidator.js` | **Import validator** — validates imports, generates import manifest, applies import rewrites. | `validateImports`, `generateImportManifest`, `applyImportRewrites` | 222 | **HIGH** |
| `typeCompatibilityChecker.js` | **Type compatibility checker** — extracts type definitions, checks compatibility, generates bridge types. | `extractTypeDefinitions`, `checkTypeCompatibility`, `generateBridgeType` | 238 | MEDIUM |

### Parsers (`dist/commands/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `overview.js` | **Project overview scanner** — uses `fast-glob` to scan `src/` and `src-tauri/`, detects entry points, core deps, generates indexed file list. | `generateOverviewAndGetFileList` | 349 | **HIGH** — file discovery |
| `storeParser.js` | **Pinia store parser** — finds and parses Pinia store definitions using AST. | `generateStoreReport` | 340 | MEDIUM |
| `routeParser.js` | **Vue Router route parser** — finds and parses route definitions using AST. | `generateRouteReport` | 312 | MEDIUM |
| `commandParser.js` | **Tauri command parser** — finds frontend `invoke()` calls and backend `#[tauri::command]` declarations via regex. | `generateCommandReport` | 270 | MEDIUM |
| `typeParser.js` | **TypeScript type parser** — finds `.ts` type definition files using `fast-glob`. | `generateTypeReport` | 255 | MEDIUM |
| `uiParser.js` | **UI component parser** — finds Vue components, detects UI framework patterns (NaiveUI), classifies as View/Component/Sub-Component. | `generateUiComponentReport` | 250 | MEDIUM |
| `rustBackendParser.js` | **Rust backend analyzer** — analyzes Rust source, maps Rust types to TypeScript, generates synthetic type definitions, compares frontend to backend. | `analyzeRustBackend`, `compareFrontendToBackend`, `generateBackendReport`, `generateSyntheticTypeDefinitions` | 578 | MEDIUM |
| `parserPersistence.js` | **Parser persistence layer** — persists parser output to shared SQLite database. SHA-256 for content hashing. | `ParserPersistence` class | 294 | **HIGH** |
| `fileRetriever.js` | **File retriever** — reads files by index or path, validates size (40KB max), filters media files. Uses `safeFs` and `ioChan`. | `retrieveFilesByIndex`, `retrieveFilesByPath` | 180 | MEDIUM |
| `report.js` | **Basic report generator** — recursive directory scan with ignore patterns. | `generateReport` | 97 | LOW |
| `reportApi.js` | **Report API** — queries analysis data from SQLite with filters. | `queryAnalysis`, `getProjectSummary` | 136 | MEDIUM |
| `codeGenerator.js` | **Code generator** — template-based code generation for stores, routes, components, features. | `generateFromAnalysis`, `listTemplates`, `generateStoreImports`, `generateFeatureScaffold`, `generateRouteFile` | 243 | LOW |
| `backendGenParser.js` | **Backend boilerplate generator** — generates Cargo.toml, main.rs, schema.rs for Tauri backends. | `generateBackendBoilerplate` | 590 | LOW |
| `uiGenParser.js` | **UI boilerplate generator** — generates main.ts, App.vue, router, store, explorer view for Vue+NaiveUI. | `generateUiBoilerplate` | 597 | LOW |
| `featureFactory.js` | **Feature Factory** — orchestrates context gathering, generates briefing documents for LLM feature creation. | `generateFeatureFactoryBriefing` | 238 | LOW |

### Opportunity System (`dist/commands/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `opportunityCatalog.js` | **PM-1 Layer 4: Opportunity Catalog** — SQLite-backed persistent storage. Remembers every opportunity found, tracks trends and resolutions. SHA-256 for fingerprints. | `OpportunityCatalog`, `getOpportunityCatalog` | 443 | MEDIUM |
| `opportunityClassifier.js` | **PM-1 Layer 4: Opportunity Classifier** — receives OpportunityCandidates from LLM experts, classifies into actionable catalog. SHA-256 for dedup fingerprints. | `OpportunityClassifier`, `getOpportunityClassifier` | 289 | MEDIUM |
| `opportunitySimulator.js` | **PM-1 Layer 5: Opportunity Simulator** — "What-if" analysis engine. Computes before/after deltas for complexity, coupling, dependencies, maintainability, risk. | `OpportunitySimulator`, `getOpportunitySimulator` | 630 | MEDIUM |

### Query & API Layer (`dist/commands/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `unifiedQueryApi.js` | **Unified Query API** — single entry point for all database queries. Coordinates reportApi, ParserPersistence, DatabasePersister. | `UnifiedQueryApi` class | 563 | MEDIUM |
| `dashboardApi.js` | **Dashboard API** — structured data for UI rendering. All methods return UI-ready JSON. | `DashboardApi` class | 476 | LOW |
| `architectureExporter.js` | **PM-1 Layer 5: Architecture Exporter** — exports project architecture for visualization. **Supports JSON (D3-ready), DOT (Graphviz), and D3 force-directed graph formats.** | `ArchitectureExporter`, `getArchitectureExporter` | 503 | **HIGH** — visualization |
| `selfAnalysis.js` | **Self-Analysis Engine** — tool analyzes its OWN codebase as dogfooding. | `SelfAnalysisEngine` class | 476 | LOW |

### Harmonize Engine (`dist/commands/harmonize/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `harmonize/index.js` | **Harmonize orchestrator** — discovers and infers connections between selected files. 6-phase pipeline. | `harmonize(request)` | 101 | **HIGH** |
| `harmonize/phases.js` | **Multi-phase harmonize analysis** — discover existing connections, infer missing connections, surface gating nodes, compute global confidence. **Uses BFS (configurable depth).** Configurable heuristic weights. | `discoverExistingConnections`, `inferMissingConnections`, `surfaceGatingNodes`, `computeGlobalConfidence`, `HARMONIZE_CONFIG` | 516 | **HIGH** |
| `harmonize/escalation.js` | **Escalation logic** — determines when automated analysis is insufficient, generates expert review tickets. | `shouldEscalate`, `generateEscalationTicket` | 148 | MEDIUM |
| `harmonize/types.js` | Type definitions for harmonize engine. | (type-only) | 4 | LOW |

### Module SDK (`dist/commands/module-sdk/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `module-sdk/index.js` | **Module SDK entry** — module registration, query API builders, context building. | `registerModule`, `unregisterModule`, `getRegisteredModule`, `listRegisteredModules`, `buildGraphQueryAPI`, `buildCompositionQueryAPI`, `buildFlowQueryAPI`, `buildHarmonizeQueryAPI`, `buildModuleContext` | 488 | MEDIUM |
| `module-sdk/resolver.js` | **Module Dependency Resolver** — full DAG resolution with topological sort, **Tarjan's SCC** for circular dependency detection, capability matching, version compatibility. | `ModuleDependencyResolver` class | 372 | **HIGH** |
| `module-sdk/orchestrator.js` | **Module Orchestrator** — executes module chains in dependency order with parallel groups, result merging, error handling, progress events, timeout enforcement. | `ModuleOrchestrator` class | 296 | MEDIUM |
| `module-sdk/marketplace.js` | **Module Marketplace Registry** — search, discover, query module metadata from public/private registries with caching and offline support. SHA-256 for content addressing. | `ModuleRegistry` class | 436 | LOW |
| `module-sdk/installer.js` | **Module Installer** — download, verify, install, uninstall, update modules with lock file management, transitive dependency resolution, rollback. SHA-256 for integrity. | `ModuleInstaller` class | 597 | LOW |
| `module-sdk/publisher.js` | **Module Publisher** — validate, build, publish module packages to marketplace registry. SHA-256 for integrity hash. | `ModulePublisher` class | 537 | LOW |
| `module-sdk/types.js` | Type definitions for module SDK. | (type-only) | 5 | LOW |

### LLM Adapter (`dist/commands/llm-adapter/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `llm-adapter/index.js` | **LLM Adapter main** — InsightHookManager monitors InsightStore, invokes expert personas via LLM providers. Token tracking. | `InsightHookManager`, `run`, `runLLMAnalysis`, `createProvider`, `EXPERT_PERSONAS` | 453 | LOW |
| `llm-adapter/init.js` | **LLM Adapter init** — validates credentials, tests API connectivity. | `init`, `reload` | 89 | LOW |
| `llm-adapter/destroy.js` | **LLM Adapter cleanup** — flushes pending requests, reports token usage summary. | `destroy`, `setTokenTracker`, `getTokenTracker` | 62 | LOW |
| `llm-adapter/types.js` | Type definitions for LLM adapter. | (type-only) | 4 | LOW |
| `llm-adapter/providers/openaiProvider.js` | **OpenAI provider** — GPT-4/3.5 integration with rate limiting. | `OpenAIProvider`, `createOpenAIProvider` | 143 | LOW |
| `llm-adapter/providers/anthropicProvider.js` | **Anthropic provider** — Claude 3/3.5 integration with rate limiting. | `AnthropicProvider`, `createAnthropicProvider` | 171 | LOW |
| `llm-adapter/experts/patternAnalyst.js` | **Expert: Pattern Analyst** — identifies recurring patterns, root causes, consolidation opportunities. | `patternAnalyst` | 140 | LOW |
| `llm-adapter/experts/performanceAdvisor.js` | **Expert: Performance Advisor** — finds optimization opportunities. | `performanceAdvisor` | 145 | LOW |
| `llm-adapter/experts/architectureReviewer.js` | **Expert: Architecture Reviewer** — identifies systemic refactoring opportunities. | `architectureReviewer` | 151 | LOW |
| `llm-adapter/experts/securityAnalyst.js` | **Expert: Security Analyst** — deep security analysis and remediation. | `securityAnalyst` | 172 | LOW |

### Plugin System (`dist/commands/`)

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `pluginRegistry.js` | **Plugin registry** — loads, validates, manages parser plugins from filesystem. | `PluginRegistry` class | 697 | LOW |
| `pluginCli.js` | **Plugin CLI** — plugin lifecycle management: create, validate, install, list, test. | `pluginCreate`, `pluginValidate`, `pluginInstall`, `pluginList`, `pluginTest` | 455 | LOW |
| `commandRegistry.js` | **Command registry** — complete JSON schema describing every CLI command, arguments, types, defaults, output shapes. | `getCommandRegistry`, `getCapabilities` | 217 | LOW |

### Other

| File | Purpose | Key Exports/Classes | Lines | Relevance to st8 |
|---|---|---|---|---|
| `integr8handler.js` | **Integr8 command handler** — orchestrates integr8 command logic, dynamically imports parser plugins. | (handler) | 290 | LOW |
| `sonicClient.js` | **Sonic TCP client** — lightweight client for Sonic search backend. Implements Sonic Channel protocol directly. | `SonicClient`, `sonicClient` | 566 | MEDIUM |
| `sonicIndexer.js` | **Sonic Indexer** — transforms graph data into optimized Sonic push operations. Batch indexing, dedup, incremental updates. | `SonicIndexer`, `getSonicIndexer` | 445 | MEDIUM |
| `sonicQueries.js` | **Sonic-powered query layer** — fast Sonic lookup → SQLite enrichment with graceful fallback. Performance metrics tracking. | Multiple query functions | 658 | MEDIUM |
| `projectStructureAdvisor.js` | **Project Structure Advisor** — audits project structure, suggests feature-driven structure, generates structure reports. | `auditProjectStructure`, `suggestFeatureDrivenStructure`, `generateStructureReport` | 443 | LOW |
| `components/.../EXAMPLEpluginforparsers_references_command.js` | Example plugin showing how to create a parser plugin with `analyzeDataFunction` and `formatReportFunction`. | `commandType`, `description`, `supportsCompare`, `specificOptions`, `analyzeDataFunction`, `formatReportFunction` | 149 | LOW |
| `components/.../dependencyinjectionfor_saveScaffoldReport.js` | Migration example: dependency injection for saveScaffoldReport. | (code snippet) | 19 | LOW |
| `components/.../newargumentforsaveScaffoldReport.js` | Migration example: new argument for saveScaffoldReport. | (code snippet) | 19 | LOW |
| `components/.../upgradesfor_saveScaffoldReport.js` | Migration example: upgraded CLI with plugin loading. | (code snippet) | 223 | LOW |
| `commands/types.js` | Shared type definitions for graph traversal and query API. | (type-only) | 5 | LOW |
| `commands/featureFactoryParser.js` | Empty stub (just sourcemap reference). | (empty) | 1 | NONE |

---

## Capability Deep-Dives

### 1. File Walking/Discovery

**Primary:** `dist/commands/overview.js` (line 38-50)
```javascript
const fast_glob_1 = __importDefault(require("fast-glob"));
// Scans src/** and src-tauri/** with ignore patterns
const files = yield (0, fast_glob_1.default)(patterns, {
    cwd: basePath, ignore: IGNORE_PATTERNS, onlyFiles: true, dot: false, absolute: false,
});
```

**Also used in:** `typeParser.js`, `uiParser.js`, `commandParser.js`, `storeParser.js`, `routeParser.js`

**Ignore patterns defined:** `overview.js:22-26` — node_modules, target, .git, dist, alignmentAndContextCache, .DS_Store, typings, *.log

### 2. SHA-256 Hashing / Fingerprinting

**Locations:**
- `backgroundIndexer.js:739` — project ID generation: `crypto.createHash('sha256').update(projectPath).digest('hex')`
- `parserPersistence.js:44` — content hashing for change detection
- `insightStore.js:327` — file ID generation: `crypto.createHash('sha256').update(filePath).digest('hex')`
- `opportunityClassifier.js:278` — dedup fingerprint: `crypto.createHash('sha256').update(raw).digest('hex').substring(0, 24)`
- `opportunityCatalog.js:102` — fingerprint column in SQLite schema
- `module-sdk/installer.js:523` — directory integrity hash
- `module-sdk/publisher.js:274` — tarball integrity hash
- `module-sdk/marketplace.js:325` — content addressing
- `integr8/migrationExecutor.js:1673` — snapshot checksums
- `multiPassAnalyzer.js:483` — near-duplicate detection (MD5, not SHA-256)

### 3. Import/Export AST Parsing

**Primary:** `dist/utils/astParser.js` (965 lines)
- Uses `@babel/parser` for TypeScript/JavaScript/Vue SFC parsing
- Extracts: imports, exports, export stars, re-exports, dynamic imports
- Falls back to regex if AST parsing fails
- Handles Vue SFC `<script>` blocks

**Used by:** `integr8/dataIngestion.js` — calls `extractImportsAndExports` for each file during ingestion

### 4. Graph Building

**Primary:** `dist/commands/graphBuilder.js` (213 lines)
```javascript
// Build adjacency lists
const outgoing = new Map(); // node -> depends on
const incoming = new Map(); // node -> consumed by
// Detect circular dependencies (DFS-based)
const circularDeps = detectCircularDependencies(nodes, outgoing);
```

**Graph traversal:** `dist/commands/graphTraversal.js` (827 lines)
- BFS path finding with directory-boundary awareness
- SQLite-backed with proper indexes
- Subgraph extraction, impact analysis, neighbor queries

**Call graph clustering:** `dist/commands/callGraphCluster.js` (418 lines)
- Connected-component analysis
- Configurable coupling thresholds

### 5. Connection Classification

**Primary:** `dist/commands/integr8/relationshipAnalyzer.js` (line 160-171)
```javascript
function classifyDependency(importNode, match) {
    if (!match) return DependencyStatus.MISSING;
    if (match.hasConflict) return DependencyStatus.CONFLICT;
    if (match.isExact) return DependencyStatus.SAFE;
    return DependencyStatus.NEEDS_REWRITE;
}
```

**Enum values (from `integr8/types.js`):**
- `SAFE` → confidence 1.0
- `NEEDS_REWRITE` → confidence 0.7
- `CONFLICT` → confidence 0.3
- `MISSING` → confidence 0.0

**Composition classification:** `compositionAnalyzer.js:64` — classifies DataFlow status as gold/blue based on edge status and confidence

### 6. SQLite Persistence

**Primary:** `dist/commands/integr8/databasePersister.js` (228 lines)
- Platform-aware path: `~/.local/share/com.scaffolder.app/scaffolder_data.sqlite` (Linux)
- Tables: `GraphNodes`, `GraphEdges`, `MigrationPlans`, `ParserResults`
- Uses `better-sqlite3` (synchronous, no async overhead)

**Also uses SQLite:**
- `parserPersistence.js` — ParserPersistence class
- `insightStore.js` — InsightStore class with `FileInsightSlots` table
- `opportunityCatalog.js` — Opportunities table with fingerprint dedup
- `sonicIndexer.js` — reads from SQLite for Sonic indexing
- `reportApi.js` — queries Stores/Routes/Commands/ProjectFiles tables
- `graphTraversal.js` — reads GraphNodes/GraphEdges with indexes
- `harmonize/index.js` — loads graph data from database
- `module-sdk/index.js` — reads graph data for module context

### 7. File Watching

**Primary:** `dist/commands/backgroundIndexer.js` (line 58, 634)
```javascript
const chokidar_1 = require("chokidar");
// Phase 6: Watch — set up file watcher
const watcher = (0, chokidar_1.watch)(projectPath, { /* config */ });
```

**CLI flag:** `dist/index.js:1345` — `--watch` option (default: true)

### 8. Manifest Generation

**TOML:** `dist/commands/integr8/tomlSerializer.js` (417 lines)
- `serializeMigrationPlanToToml(plan)` — full TOML with [metadata] and [[steps]] sections
- `serializeGraphMetadataToToml(graph)` — graph properties to TOML
- `parseMigrationPlanFromToml(tomlString)` — round-trip parsing

**JSON:** `dist/commands/featureBoundaryDetector.js`
- `generateFeatureManifestJson()` — feature boundary manifests

**Also:** `conflictResolver.js` — `saveResolutionManifest`, `loadResolutionManifest` for TOML conflict resolution manifests

### 9. Visualization Export

**Primary:** `dist/commands/architectureExporter.js` (503 lines)
- **D3-ready JSON** — nodes with id/name/group/value, links with source/target/value
- **DOT/Graphviz** — directed graph with layer-based subgraphs, shortened names
- **D3 force-directed** — nodes with x/y/fx/fy for positioning
- Classifies layers: `classifyLayer(filePath)` → layer assignment

---

## Key Dependencies (from package.json)

| Package | Version | Used For |
|---|---|---|
| `@babel/parser` | ^7.29.3 | AST parsing for imports/exports |
| `better-sqlite3` | ^12.9.0 | SQLite persistence (synchronous) |
| `chokidar` | ^4.0.3 | File watching |
| `fast-glob` | ^3.3.3 | File discovery |
| `fs-extra` | ^11.3.5 | Enhanced filesystem operations |
| `yargs` | ^17.7.2 | CLI argument parsing |
| `vue` | ^3.5.34 | UI framework |
| `pinia` | ^3.0.4 | State management |
| `naive-ui` | ^2.44.1 | UI component library |

---

## Source Maps

Every `.js` file has a corresponding `.js.map` file (93 total). These map back to the original TypeScript sources in `src/commands/` and `src/utils/`.

---

## Summary for st8

**Directly reusable (copy & adapt):**
- `utils/astParser.js` — import/export extraction
- `utils/safeFs.js` — fortified filesystem
- `utils/ioChan.js` — priority I/O channel
- `commands/graphBuilder.js` — adjacency list construction
- `commands/graphTraversal.js` — BFS/DFS traversal with SQLite
- `commands/integr8/types.js` — graph type system (NodeType, EdgeType, etc.)
- `commands/integr8/databasePersister.js` — SQLite schema & persistence
- `commands/integr8/relationshipAnalyzer.js` — dependency classification + Tarjan's SCC
- `commands/backgroundIndexer.js` — file watching + incremental indexing
- `commands/harmonize/phases.js` — BFS connection discovery with configurable depth

**Partially reusable (extract patterns):**
- `commands/callGraphCluster.js` — connected-component clustering
- `commands/compositionAnalyzer.js` — DataFlow classification
- `commands/architectureExporter.js` — D3/DOT export formats
- `commands/integr8/tomlSerializer.js` — TOML serialization
- `commands/conflictResolver.js` — decision tree / strategy patterns

**Not relevant to st8:**
- All LLM adapter files (llm-adapter/)
- All module-sdk files (module-sdk/)
- UI files (main.js, router/, stores/)
- Generator files (uiGenParser.js, backendGenParser.js, codeGenerator.js)
- Plugin system files (pluginRegistry.js, pluginCli.js, commandRegistry.js)
