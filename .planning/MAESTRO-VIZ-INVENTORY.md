# Maestro Scaffolder Tool — Visualization Inventory

**Scouted:** 2026-05-11  
**Source:** `/home/bozertron/Software Projects/maestro-scaffolder-tool/`

---

## Summary

Ben was right — there is a **TON** of visualization infrastructure already built. The project has a full pipeline from data → graph → export → render, with D3.js v7 as the primary frontend graphics library. Key assets:

- **ArchitectureExporter** — D3/JSON/DOT graph export (THE main visualization engine)
- **DashboardAPI** — UI-ready JSON for health, metrics, opportunities, activity, architecture layers
- **GraphBuilder** — Dependency graph with health scoring + circular dependency detection
- **GraphTraversal** — BFS/DFS path finding, reachability, impact chains, directory boundaries
- **Report Generators** — Markdown (migration, stability, API stability), TOML serialization
- **Tauri IPC Commands** — Rust-side commands that bridge all of the above to the frontend
- **UI Requirements Doc** — Complete Vanilla JS module specs with D3 composition graph, gauges, data tables, status badges

---

## Viz Inventory Table

| File Path | What It Renders | Key APIs | Dependencies | Can We Reuse? |
|-----------|----------------|----------|--------------|---------------|
| `src/commands/architectureExporter.ts` | **D3 force-directed graph**, DOT/Graphviz, JSON graph export. Module map, layer diagram with violations, opportunity overlay with color-coded annotations. | `ArchitectureExporter.exportAsGraph(projectId, 'd3'|'json'|'dot')`, `.exportModuleMap()`, `.exportLayerDiagram()`, `.exportOpportunityOverlay()`, `getArchitectureExporter()` singleton | `better-sqlite3`, `integr8/types`, `opportunityCatalog` | ✅ **YES — primary graph viz engine. D3Node/D3Link types already defined.** |
| `src/commands/dashboardApi.ts` | **Dashboard data** — health score (0-100), per-module metrics (coupling/complexity/coverage), opportunity summary with category icons/colors, recent activity timeline, architecture layer diagram data. | `DashboardAPI.getProjectHealth()`, `.getModuleMetrics()`, `.getOpportunitySummary()`, `.getRecentActivity()`, `.getArchitectureOverview()` | `better-sqlite3`, `compositionAnalyzer`, `patternDiscovery`, `historicalAnalyzer` | ✅ **YES — all methods return UI-ready JSON. No further transforms needed.** |
| `src/commands/graphBuilder.ts` | **Dependency graph** with health classification (healthy/partial/unused/broken), circular dependency detection (DFS), impact radius computation (BFS), orphan detection. | `buildDependencyGraph(projectPath)`, `getImpactAnalysis(projectPath, filePath)` | `integr8/types`, `integr8/dataIngestion` | ✅ **YES — produces `GraphHealthReport` with health-scored nodes.** |
| `src/commands/graphTraversal.ts` | **Graph traversal** — BFS path enumeration, reachability analysis, subgraph extraction, cascading impact chains, directory boundary classification (IN/OUT/INTERNAL edges), data flow metrics, file-level flow analysis. | `findPaths()`, `analyzeReachability()`, `extractSubgraph()`, `computeImpactChain()`, `findImportsOf()`, `findConsumersOf()`, `findOrphans()`, `getDirectorySubgraph()`, `getDirectoryBoundary()`, `getDataFlowMetrics()`, `getFileFlows()` | `better-sqlite3`, `integr8/databasePersister` | ✅ **YES — coherent graph cache, all functions return structured data ready for viz.** |
| `src/commands/integr8/reportGenerator.ts` | **Markdown migration report** — executive summary table, graph analysis (reachability/stability/fragility %), conflict table, migration steps with icons, risk assessment (🟢🟡🟠🔴), outcome explanation, next steps. | `generateMigrationReport(output: Integr8Output)` | `integr8/types` | ✅ **YES — color-coded risk levels, emoji badges, ready to render or convert to HTML.** |
| `src/commands/historicalAnalyzer.ts` | **Stability timeline** — snapshot table (timestamp/nodes/edges/health), trend analysis (churn rate, stability trend), risk factors list, recent changes table. | `takeSnapshot()`, `getStabilityTimeline()`, `predictIntegrationRisk()`, `generateStabilityReport()` | `better-sqlite3`, `crypto` | ✅ **YES — `StabilityTimeline` + `TrendAnalysis` interfaces. Markdown report generator included.** |
| `src/commands/apiStabilityTracker.ts` | **API stability report** — command surface table with ✅/🧪/⚠️ badges (stable/experimental/deprecated), summary stats, deprecation details with consuming files, migration guidance. | `analyzeApiStability(projectPath)`, `findDeprecatedUsage()`, `generateApiStabilityReport(surface)` | `fs`, `path` | ✅ **YES — Markdown report with emoji status badges.** |
| `src/commands/compositionAnalyzer.ts` | **Composition analysis** — gold/blue classified DataFlows (in/out), issue detection (error/warning/ambiguity), overall status, internal flow data, harmonize results. | `analyzeProject(path)`, `analyzeDirectory(path)`, `analyzeFile(path)` | `graphTraversal`, `internalFlowAnalyzer`, `harmonize` | ✅ **YES — `CompositionAnalysis` with `DataFlow[]` and `CompositionIssue[]`.** |
| `src/commands/diffEngine.ts` | **Diff visualization** — added/modified/removed/unchanged nodes, health annotations (safe to remove/change, caution flags), diff summary by node type. | `generateProjectSnapshot()`, `computeDiff(before, after, baselineHealth)`, `computeDiffSummary()`, `compareProjects()` | `integr8/types`, `integr8/dataIngestion` | ✅ **YES — `DiffResult` with `HealthAnnotation[]` for color-coded diffs.** |
| `src/commands/featureBoundaryDetector.ts` | **Feature boundary clusters** — groups stores/routes/components/commands/types by naming convention into FeatureBoundary objects with entry points, overlap warnings, unclaimed files. | `detectFeatureBoundaries(projectPath)` | `integr8/types`, `integr8/dataIngestion` | ✅ **YES — `FeatureManifest` with clustered features.** |
| `src/commands/patternDiscovery.ts` | **Pattern discovery** — design patterns, anti-patterns, project-specific patterns with severity (info/warning/critical), confidence scores, recommendations, instances with file paths. | `PatternDiscoveryEngine.discoverPatterns(projectId)` | `better-sqlite3`, `graphTraversal`, `internalFlowAnalyzer` | ✅ **YES — `PatternDiscoveryResult` with categorized patterns.** |
| `src/commands/overview.ts` | **Project overview report** — numbered file index, config summary, entry points, core dependencies (frontend + Rust backend), directory tree. | `generateOverviewAndGetFileList(targetPath, options)` | `fs-extra`, `fast-glob` | ✅ **YES — returns `{ reportString, fileList }`.** |
| `src/commands/internalFlowAnalyzer.ts` | **Intra-file flow analysis** — function definitions, call graphs (caller→callee), import usage tracking, flow warnings (circular calls, unreachable, ambiguous targets). | `analyzeFileInternalFlow(input)` | `@babel/parser`, `@babel/types` | ✅ **YES — `InternalFlowData` with call graph and warnings.** |
| `src/commands/callGraphCluster.ts` | **Call graph clustering** — module clusters with cohesion/coupling scores, refactoring suggestions (extract-module/co-locate/merge/split), change coupling analysis. | `CallGraphClusterer.clusterCallGraph(projectPath)` | `internalFlowAnalyzer`, `graphTraversal` | ✅ **YES — `ClusteringResult` with clusters + suggestions.** |
| `src/commands/multiPassAnalyzer.ts` | **5-pass analysis pipeline** — structural metrics (LOC, functions, complexity), dependency analysis, pattern detection, API surface mining, cross-file insights. Progress tracking per pass. | `MultiPassAnalyzer.runAnalysis(projectId)`, `getAnalysisProgress()` | `insightStore`, `graphTraversal`, `relationshipAnalyzer` | ✅ **YES — `MultiPassResult` with pass-by-pass results and health score.** |
| `src/commands/escalationPredictor.ts` | **Escalation predictions** — module risk scores (0-100), risk levels (low/medium/high/critical), escalation factors, predicted timeframes, escalation timeline. | `EscalationPredictor.predictEscalations(projectId)` | `compositionAnalyzer`, `historicalAnalyzer`, `patternDiscovery` | ✅ **YES — `EscalationPrediction` with timeline entries.** |
| `src/commands/opportunityCatalog.ts` | **Opportunity catalog** — classified opportunities with scale/category/severity/effort/impact/priority, trend tracking, statistics by category/severity/effort/impact. | `OpportunityCatalog.getOpportunities()`, `.getStatistics()`, `.getTrends()` | `better-sqlite3` | ✅ **YES — SQLite-backed with rich query filters.** |
| `src/commands/opportunitySimulator.ts` | **Opportunity simulation** — before/after metrics, delta computation, risk assessment, batch simulation, scenario comparison. | `OpportunitySimulator.simulateOpportunity()`, `.simulateBatch()`, `.compareScenarios()` | `opportunityCatalog`, `graphBuilder`, `compositionAnalyzer` | ✅ **YES — `SimulationResult` with deltas and risk.** |
| `src/commands/projectStructureAdvisor.ts` | **Structure audit** — missing dirs, misplaced files, refactoring suggestions, best practice pass/fail/warn, overall score. | `auditProjectStructure(projectPath)` | `safeFs`, `ioChan` | ✅ **YES — `ProjectAudit` with recommendations.** |
| `src/commands/integr8/tomlSerializer.ts` | **TOML serialization** — migration plan to TOML format, conflict resolutions, graph properties, import rewrite rules. | `serializeMigrationPlanToToml(plan)`, `serializeConflictResolutions()`, `serializeGraphProperties()` | `integr8/types` | ✅ **YES — structured TOML output for migration plans.** |
| `src/commands/reportApi.ts` | **Database query API** — query analysis data (stores/routes/commands/files) with filters, project summary with health score. | `queryAnalysis(parserType, filters, dbPath)`, `getProjectSummary(projectId, dbPath)` | `better-sqlite3` | ✅ **YES — generic query interface for all parsed data.** |
| `src/commands/unifiedQueryApi.ts` | **Unified query API** — single entry point for all DB queries. Wraps graph traversal, parser persistence, database persister. | `UnifiedQueryApi.queryNodes()`, `.queryEdges()`, `.getProjectSummary()`, `.findPaths()`, etc. | `graphTraversal`, `reportApi`, `parserPersistence` | ✅ **YES — facade over all query operations.** |
| `src/commands/uiParser.ts` | **UI component report** — Vue component analysis, UI element inventory (NaiveUI tags), component type classification (View/Component/Sub-Component), comparison mode. | `generateUiComponentReport(targetPath, options)` | `fs-extra`, `fast-glob` | ✅ **YES — component usage report.** |
| `src/commands/uiGenParser.ts` | **UI scaffold generator** — generates Vue.js + NaiveUI + Pinia + Vue Router project with file tree explorer, Tauri command integration. | `generateUiProject(outputDir, options)` | `fs-extra` | ⚠️ **MAYBE — generates scaffolding code, not analysis viz. But the file tree component pattern is reusable.** |
| `src-tauri/src/commands/visualization_commands.rs` | **Tauri viz IPC** — D3 graph export, opportunity overlay, layer diagram, DOT export, simulation responses. Rust structs: `D3Node`, `D3Link`, `D3GraphResponse`, `OpportunityOverlayResponse`, `LayerDiagramResponse`. | `get_architecture_graph()`, `simulate_opportunity()`, `get_opportunity_overlay()`, `get_layer_diagram()`, `export_graph_dot()` | Node.js subprocess | ✅ **YES — Rust IPC bridge for all viz commands.** |
| `src-tauri/src/commands/dashboard_commands.rs` | **Tauri dashboard IPC** — project health dashboard, module health metrics. Rust structs: `DashboardData`, `HealthBreakdown`, `ModuleHealthData`. | `get_project_dashboard()`, `get_module_health()` | Node.js subprocess | ✅ **YES — Rust IPC bridge for dashboard.** |
| `src-tauri/src/commands/graph_queries.rs` | **Tauri graph queries** — list graphs, get nodes/edges, graph statistics (node/edge type counts), migration plan queries. | `list_graphs()`, `get_graph_nodes()`, `get_graph_edges()`, `get_graph_statistics()` | `rusqlite` (direct DB) | ✅ **YES — direct SQLite queries for graph data.** |
| `src-tauri/src/commands/graph_traversal_commands.rs` | **Tauri traversal IPC** — find paths, reachability, subgraph extraction, impact chain, find imports/consumers, orphans, directory boundary, data flow metrics. | `find_paths()`, `analyze_reachability()`, `extract_subgraph()`, `compute_impact_chain()`, etc. | Node.js subprocess | ✅ **YES — Rust IPC bridge for all traversal ops.** |
| `docs/ui-requirements.md` | **Full UI spec** — 11 modules, D3.js v7, Vanilla JS `h()` DOM builder, PHREAK Void dark palette, SVG gauge component, data tables, status badges, filter bars, progress bars, skeleton loaders, toast notifications, file tree widget, composition graph builder. | Module skeleton pattern, `statusBadge()`, `dataTable()`, `statCard()`, `gauge()`, `filterBar()`, `progressBar()`, `showToast()` | D3.js v7 | ✅ **YES — complete design system spec with reusable shared components.** |

---

## Key Reusable Type Interfaces

### D3 Graph Types (from `architectureExporter.ts`)
```typescript
D3Node { id, name, group, type, path?, size, metadata? }
D3Link { source, target, type, weight, status? }
D3GraphData { nodes: D3Node[], links: D3Link[], metadata }
```

### Health Types (from `dashboardApi.ts`)
```typescript
ProjectHealthData { projectId, healthScore (0-100), status ('healthy'|'warning'|'critical'), breakdown, trend }
ModuleMetric { moduleId, coupling, complexity, testCoverage, healthScore, status, inboundDeps, outboundDeps }
```

### Graph Types (from `graphBuilder.ts`)
```typescript
HealthyGraphNode extends GraphNode { health ('healthy'|'partial'|'unused'|'broken'), consumers, dependencies, impactRadius }
GraphHealthReport { nodes, circularDeps, orphanedFiles, deadImports, healthScore, totalNodes, ...counts }
```

### Color Schemes
- **Architecture layers**: presentation=#E3F2FD, business=#E8F5E9, data=#FFF3E0, infrastructure=#F3E5F5
- **Edge styles**: imports=#2196F3, depends_on=#4CAF50, exports=#FF9800 (dashed), contains=#9E9E9E (dotted)
- **Opportunity categories**: performance=#FF6B35, security=#E63946, maintainability=#457B9D, reliability=#2A9D8F, innovation=#E9C46A, debt-reduction=#8338EC
- **Risk levels**: 🟢 LOW, 🟡 MODERATE, 🟠 HIGH, 🔴 CRITICAL
- **Status badges**: ✅ stable, 🧪 experimental, ⚠️ deprecated
- **PHREAK Void palette** (UI spec): dark-only, glow-based, neon-cyan/neon-amber accents

---

## Visualization Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA COLLECTION LAYER                        │
│  multiPassAnalyzer · patternDiscovery · internalFlowAnalyzer     │
│  compositionAnalyzer · historicalAnalyzer · opportunityCatalog   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     GRAPH STORAGE LAYER                          │
│  SQLite (GraphNodes/GraphEdges tables)                           │
│  databasePersister · parserPersistence · unifiedQueryApi          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   ANALYSIS & QUERY LAYER                         │
│  graphBuilder · graphTraversal · callGraphCluster                │
│  featureBoundaryDetector · diffEngine · escalationPredictor      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   EXPORT & RENDER LAYER                          │
│  architectureExporter → D3/JSON/DOT                              │
│  dashboardApi → UI-ready JSON                                    │
│  reportGenerator → Markdown                                      │
│  tomlSerializer → TOML                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    TAURI IPC BRIDGE (Rust)                        │
│  visualization_commands.rs · dashboard_commands.rs               │
│  graph_queries.rs · graph_traversal_commands.rs                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    FRONTEND (Vanilla JS + D3.js v7)               │
│  graph-explorer · diff-viewer · migration-planner                │
│  project-analyzer · composition · project-registry               │
│  opportunity-hub · intelligence · search · marketplace           │
└─────────────────────────────────────────────────────────────────┘
```

---

## What's Missing / Gaps

1. **No HTML report generator** — Reports are Markdown-only. No self-contained HTML dashboard exists.
2. **No Canvas rendering** — All graphics are D3.js SVG-based. No Canvas/WebGL for large graphs.
3. **No Mermaid/Diagrams-as-code** — DOT format exists but no Mermaid generation.
4. **No real-time WebSocket updates** — Polling-based only (pollManager with register/unregister).
5. **Frontend modules not yet built** — The `docs/ui-requirements.md` is a spec; actual `src/ui/` files may not exist yet.
6. **No chart library** — D3.js v7 is the only graphics dependency. No Chart.js/Recharts.
