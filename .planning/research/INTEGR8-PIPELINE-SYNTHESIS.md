# Integr8 Pipeline — Research Synthesis

**Date:** 2026-05-14
**Source:** `lib/commands/integr8/` (9 modules, ~4,200 LOC compiled JS)

---

## 1. Executive Summary

The Integr8 pipeline is ST8's **semantic graph compiler** — a 3-stage analysis engine that determines whether code from an external project can be integrated into the current project. It builds dependency graphs from both projects, classifies every import/export relationship as SAFE, NEEDS_REWRITE, CONFLICT, or MISSING, then generates an ordered migration plan with conflict resolution strategies.

The pipeline was designed as a standalone CLI command (`runIntegr8Command`) but in practice **its sub-components are consumed directly** by the background indexer and graph builder — the orchestrator function itself is dead code. This is the single most important architectural finding: the pipeline's real value lives in its composable stages, not its top-level orchestration.

The analysis engine is sophisticated — it includes Tarjan's SCC for cycle detection, structural subtyping analysis, adaptive retry with circuit breakers, and cost-based break-point selection for dependency cycles. However, the pipeline is entirely sequential (no parallelism between stages), and the migration executor (`migrationExecutor.js`) exists but is never wired into the orchestrator.

---

## 2. Pipeline Architecture

### 2.1 Three-Stage Sequential Pipeline

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Stage 1:       │     │  Stage 2:            │     │  Stage 3:       │
│  Data Ingestion │────▶│  Relationship        │────▶│  Path           │
│                 │     │  Analysis            │     │  Generation     │
│  dataIngestion  │     │  relationshipAnalyzer│     │  pathGenerator  │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
        │                        │                          │
        ▼                        ▼                          ▼
  6 Parsers → Graph      Merge + Classify           Topo Sort → Plan
  (nodes + edges)        (unified graph)            (migration steps)
```

**Execution model:** Strictly sequential. Each stage's output is the next stage's input. No parallelism between stages.

### 2.2 Module Inventory

| Module | Lines | Role | Used By Orchestrator | Used Externally |
|--------|-------|------|---------------------|-----------------|
| `index.js` | 140 | Orchestrator | — | **NO** (dead code) |
| `dataIngestion.js` | 1,102 | Stage 1: Parse projects into graphs | Yes | `backgroundIndexer`, `graphBuilder` |
| `relationshipAnalyzer.js` | 924 | Stage 2: Merge graphs, classify deps | Yes | — |
| `pathGenerator.js` | 859 | Stage 3: Generate migration plan | Yes | — |
| `types.js` | 83 | Shared enums and type definitions | Yes | `backgroundIndexer`, `graphBuilder` |
| `databasePersister.js` | 229 | SQLite persistence for graphs | Yes | `backgroundIndexer`, `graphBuilder`, `insightStore`, `parserPersistence`, `graphTraversal` |
| `tomlSerializer.js` | 418 | Serialize/deserialize plans to TOML | Yes | `migrationExecutor` |
| `reportGenerator.js` | 284 | Markdown report generation | Yes | — |
| `migrationExecutor.js` | 1,200+ | Execute migration plans | **NO** (not wired) | — |

---

## 3. Data Flow

### 3.1 Stage 1: Data Ingestion (`dataIngestion.js`)

**Input:** `{ externalPath, currentPath, targetPages }`
**Output:** `{ externalGraph, currentGraph }` — two `SemanticGraph` objects

```
For each project path:
  ┌─ overview parser   → FILE nodes
  ├─ store parser      → STORE nodes
  ├─ route parser      → ROUTE nodes
  ├─ command parser    → COMMAND nodes
  ├─ type parser       → TYPE nodes
  └─ ui parser         → COMPONENT nodes
        │
        ▼
  AST extraction       → IMPORT nodes + EXPORT nodes (from real source files)
        │
        ▼
  buildEdges()         → CONTAINS, NAVIGATES_TO, INVOKES edges
        │
        ▼
  SemanticGraph { nodes[], edges[], properties }
```

**Key mechanisms:**
- **Circuit breaker** (3-failure threshold, 30s reset, half-open probing)
- **Adaptive retry** (exponential backoff with error-specific delays: EACCES=3x, EMFILE=5x, ENOENT=skip)
- **Fallback chain:** primary parser → regex fallback → unparseable marker
- **Enhanced import scanning:** side-effect imports, conditional/dynamic imports, barrel re-exports
- **AST-based enrichment:** `extractImportsAndExports()` on `.ts/.tsx/.js/.jsx/.vue` files

**Node types produced:** `file`, `store`, `route`, `command`, `type`, `import`, `export`, `component`

### 3.2 Stage 2: Relationship Analysis (`relationshipAnalyzer.js`)

**Input:** Two `SemanticGraph` objects + `targetPages`
**Output:** `{ unifiedGraph, conflicts[], dependencyMap[] }`

```
For each target page:
  1. Find page node in externalGraph
  2. Find all IMPORT edges from that page
  3. For each import:
     a. Search currentGraph exports by name (O(1) indexed lookup)
     b. Classify: SAFE | NEEDS_REWRITE | CONFLICT | MISSING
     c. Detect conflicts: NAME_COLLISION, TYPE_MISMATCH, CIRCULAR_DEPENDENCY, MISSING_DEPENDENCY
     d. Build unified edges with confidence scores
  4. Merge remaining current graph nodes
  5. Compute graph properties (reachability, stability, fragility)
```

**Classification logic:**
| Condition | Status |
|-----------|--------|
| Exact path match | `SAFE` |
| Name matches, path differs | `NEEDS_REWRITE` |
| Signature/type mismatch | `CONFLICT` |
| No match found | `MISSING` |

**Conflict detection types:**
- `MISSING_DEPENDENCY` — no matching export in target
- `NAME_COLLISION` — same name, different implementation (metadata >30% different)
- `TYPE_MISMATCH` — incompatible type signatures
- `CIRCULAR_DEPENDENCY` — direct and multi-step cycle detection

**Advanced features:**
- **Structural subtyping engine** (I-13): TypeScript-style variance analysis (covariant returns, contravariant params)
- **Breaking change detection:** removed exports, narrowed types, async/sync changes
- **Tarjan's SCC algorithm** (I-07): O(V+E) cycle detection with break-point recommendations

### 3.3 Stage 3: Path Generation (`pathGenerator.js`)

**Input:** Unified graph + conflicts + targetPages
**Output:** `{ plan, outcome, reasons, topologicalAnalysis }`

```
1. Topological sort (Kahn's algorithm with cycle handling)
2. Generate MigrationSteps:
   - COPY_FILE (ordered by dependencies)
   - REWRITE_IMPORT (grouped by source file)
   - MERGE_ROUTE (for route nodes)
   - RESOLVE_CONFLICT (one per conflict)
   - VERIFY (always last)
3. Evaluate outcome (decision matrix)
4. Generate human-readable reasons
5. Compute complexity (low/medium/high)
6. Enhanced topological analysis (critical path, parallel groups, cost estimates)
```

**Outcome decision matrix:**
| Condition | Outcome |
|-----------|---------|
| reachability > 0.95 AND fragility < 0.05 AND 0 conflicts | `SUCCESS` |
| reachability >= 0.5 AND all conflicts resolvable | `PARTIAL` |
| reachability < 0.5 OR unresolvable conflicts | `FAILURE` |
| >2 ambiguous conflicts | `AMBIGUOUS` |
| Critical missing dependency | `REDIRECT` |

**Cycle handling (I-15):** Cost-based break-point selection — processes lowest-cost nodes first, suggests interface extraction or dependency injection.

---

## 4. Key Components

### 4.1 Type System (`types.js`)

The type system defines 8 enums that form the pipeline's vocabulary:

- **IntegrationOutcome:** SUCCESS, PARTIAL, FAILURE, AMBIGUOUS, REDIRECT
- **DependencyStatus:** SAFE, NEEDS_REWRITE, CONFLICT, MISSING
- **NodeType:** file, store, route, command, type, import, export, component (+ function, variable)
- **EdgeType:** 12 types including depends_on, imports, exports, navigates_to, invokes, conflicts_with, contains, calls, reads, writes, dynamic_import, reexports
- **MigrationAction:** copy_file, rewrite_import, merge_route, resolve_conflict, run_command, verify
- **ConflictType:** name_collision, type_mismatch, version_conflict, circular_dependency, api_incompatibility, missing_dependency
- **ResolutionStrategy:** rename, merge, overwrite, ignore, custom
- **VerificationLevel:** syntax, import_resolution, type_check, semantic

### 4.2 Database Persistence (`databasePersister.js`)

SQLite persistence using `better-sqlite3` with WAL mode. Four tables:

- **GraphNodes** — node_id, graph_id, node_type, name, path, metadata_json
- **GraphEdges** — edge_id, graph_id, from/to_node_id, edge_type, status, confidence
- **MigrationPlans** — plan_id, integration_id, outcome, complexity, steps_json, paths
- **IntegrationSnapshots** — snapshot_id, integration_id, type (pre/post), data_json

Shared database path follows Tauri convention: `~/.local/share/com.scaffolder.app/scaffolder_data.sqlite` (Linux).

### 4.3 Migration Executor (`migrationExecutor.js`)

A fully-implemented but **unwired** migration executor that can:
- Execute COPY_FILE, REWRITE_IMPORT, MERGE_ROUTE, RESOLVE_CONFLICT, VERIFY steps
- Detect router frameworks (Vue Router 4, React Router 6+, Next.js)
- Build path resolution context (workspace packages, tsconfig paths, package.json exports)
- Generate compatibility adapters for type conflicts
- Execute sandboxed user-defined transforms
- Create pre-migration snapshots and rollback support

**This is significant dead code** — the orchestrator never calls it, and no external module imports it.

---

## 5. Integration Points

### 5.1 Direct Consumers (External Modules)

The pipeline's sub-components are imported directly by three external modules:

**`backgroundIndexer.js`:**
```javascript
const { DatabasePersister } = require("./integr8/databasePersister.js");
const { ingestSingleProject } = require("./integr8/dataIngestion.js");
const { NodeType, EdgeType } = require("./integr8/types.js");
```
Uses `ingestSingleProject()` directly for indexing — bypasses the orchestrator entirely.

**`graphBuilder.js`:**
```javascript
const { NodeType, EdgeType } = require("./integr8/types.js");
const { ingestSingleProject } = require("./integr8/dataIngestion.js");
```
Uses ingestion for graph construction.

**`insightStore.js`, `parserPersistence.js`, `graphTraversal.js`:**
```javascript
const { DatabasePersister } = require("./integr8/databasePersister.js");
```
All use the shared database persister for SQLite access.

### 5.2 Internal Dependencies

The pipeline consumes these external parsers (all in `lib/commands/`):
- `overview.js` — file listing
- `storeParser.js` — Pinia/Vuex store analysis
- `routeParser.js` — Vue Router route extraction
- `commandParser.js` — Tauri command detection
- `typeParser.js` — TypeScript type/interface extraction
- `uiParser.js` — UI component analysis

And these utilities (in `lib/utils/`):
- `astParser.js` — AST-based import/export extraction
- `safeFs.js` — Safe filesystem access
- `ioChan.js` — I/O channel with priority queuing

---

## 6. Gaps and Issues

### 6.1 Critical Gaps

| Issue | Severity | Description |
|-------|----------|-------------|
| **Dead orchestrator** | HIGH | `runIntegr8Command()` is exported but never called by any module. The CLI command path is broken or removed. |
| **Unwired executor** | HIGH | `migrationExecutor.js` (1,200+ LOC) is fully implemented but never called. The "apply" capability is orphaned. |
| **No CLI entry point** | HIGH | There's no visible CLI command registration that invokes `runIntegr8Command`. The pipeline is analysis-only via direct imports. |

### 6.2 Architectural Concerns

| Issue | Severity | Description |
|-------|----------|-------------|
| **Sequential-only execution** | MEDIUM | Stages run strictly sequentially. Stage 1 ingests external and current projects sequentially — these could run in parallel. |
| **Node ID fragility** | MEDIUM | `nodeCounter` is a module-level mutable variable reset per `ingestProjectData()` call. Concurrent usage would corrupt IDs. |
| **No incremental updates** | MEDIUM | Each run re-ingests everything. No delta/diff capability for large projects. |
| **Parser coupling** | LOW | Text-based parser output parsing (regex on report strings) is fragile. AST-based extraction is the right path but only used for imports/exports. |

### 6.3 Dead Code Inventory

| Module | Function | Status |
|--------|----------|--------|
| `index.js` | `runIntegr8Command()` | Exported, never imported |
| `migrationExecutor.js` | `executeMigrationPlan()` | Exported, never imported |
| `migrationExecutor.js` | `verifyIntegration()` | Exported, never imported |
| `migrationExecutor.js` | `rollbackMigration()` | Exported, never imported |
| `migrationExecutor.js` | `executeAtomicMigration()` | Exported, never imported |
| `migrationExecutor.js` | `createPreMigrationSnapshot()` | Exported, never imported |

### 6.4 Quality Indicators

**Strengths:**
- Mature error handling (circuit breaker, adaptive retry, fallback chains)
- Sophisticated graph analysis (Tarjan's SCC, structural subtyping, cost-based break points)
- Clean separation of concerns (stages are independently usable)
- Comprehensive type system with 8 well-defined enums
- SQLite persistence with proper schema and indexing

**Weaknesses:**
- No test files found for any integr8 module
- Regex-based text parsing of parser output is brittle
- No configuration file — all thresholds are hardcoded
- No logging framework — uses `console.log/warn/error` directly
- The TOML serializer/parser is ~400 LOC of hand-rolled parsing (could use a library)

---

## 7. Recommendations

### 7.1 Immediate Actions

1. **Decide on the orchestrator:** Either wire `runIntegr8Command` to a CLI command or remove it as dead code. The sub-components are already used directly — formalize that pattern.

2. **Wire or remove the migration executor:** The 1,200+ LOC executor is a significant investment. Either integrate it into a `--apply` CLI flag or archive it.

3. **Stabilize node IDs:** Replace the mutable `nodeCounter` with UUIDs or content-addressable IDs to support concurrent usage.

### 7.2 Architectural Improvements

4. **Parallelize Stage 1:** External and current project ingestion are independent — run them concurrently.

5. **Extract parser output contracts:** Replace regex parsing of text reports with structured output from parsers (or at least JSON intermediate format).

6. **Add incremental mode:** Cache previous graph and diff against current state instead of full re-ingestion.

### 7.3 Testing

7. **Add integration tests:** The pipeline has zero test coverage. Focus on `relationshipAnalyzer` (classification logic) and `pathGenerator` (outcome evaluation) as they contain the most complex logic.

---

*Synthesis generated from source analysis of `lib/commands/integr8/` — 9 modules, ~4,200 LOC.*
