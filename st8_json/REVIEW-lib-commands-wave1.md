# Schema Card Review — lib/commands Wave 1

**Reviewed:** 2026-05-14
**Files:** 5 schema cards from `.st8/schema-cards/`
**Focus:** Exports, imports, connections, intent, status, summary

---

## Quick Reference Table

| File | Status | Exports | Reachability | importedBy |
|------|--------|---------|-------------|------------|
| backgroundIndexer.js | 🔴 RED | 2 | 0.00 | *(none)* |
| graphBuilder.js | 🔴 RED | 2 | 0.00 | *(none)* |
| graphTraversal.js | 🔴 RED | 13 | 0.00 | *(none)* |
| insightStore.js | 🟢 GREEN | 2 | 0.95 | backgroundIndexer |
| parserPersistence.js | 🟢 GREEN | 1 | 0.95 | backgroundIndexer |

---

## 1. `backgroundIndexer.js`

**Path:** `lib/commands/backgroundIndexer.js` | **Size:** 40 KB

### Exports

| Name | Kind | Line |
|------|------|------|
| `BackgroundIndexer` | variable | 51 |
| `getBackgroundIndexer` | variable | 52 |

### Imports (Source Modules)

| Source | Type |
|--------|------|
| `events` (Node stdlib) | require |
| `chokidar` | require |
| `./integr8/databasePersister.js` | require |
| `./integr8/dataIngestion.js` | require |
| `./parserPersistence.js` | require |
| `./sonicClient.js` | require |
| `./insightStore.js` | require |
| `./multiPassAnalyzer.js` | require |
| `./precisionCapture.js` | require |
| `./integr8/types.js` | require |

### Connections

| Direction | Module |
|-----------|--------|
| **imports** | `databasePersister`, `dataIngestion`, `parserPersistence`, `insightStore`, `types` |
| **importedBy** | *(none — orphaned)* |

### Intent

- **Purpose:** Codebase indexing and analysis
- **Depends on:** events, file system watching, databasePersister, dataIngestion, sonicClient, insightStore, multiPassAnalyzer, precisionCapture, types
- **Value:** Provides codebase indexing pipeline

### Summary

Orchestrates background codebase indexing — watches for file changes via chokidar, runs data ingestion pipelines, persists parsed results, stores insights, and coordinates with the search engine (sonic) and multi-pass analysis. This is the heaviest module in this set at 40 KB.

### Status: 🔴 RED

**Concerns:**
- **Orphaned export** — `importedBy` is empty, meaning no other module in the codebase imports this. The two exports (`BackgroundIndexer`, `getBackgroundIndexer`) appear unused.
- **Zero reachability** — Score is 0.00; this module is not reachable from any entry point.
- **Intent is stub-quality** — All three intent fields end with `???`, meaning the indexer couldn't confidently describe this module's purpose.

---

## 2. `graphBuilder.js`

**Path:** `lib/commands/graphBuilder.js` | **Size:** 9 KB

### Exports

| Name | Kind | Line |
|------|------|------|
| `buildDependencyGraph` | variable | 14 |
| `getImpactAnalysis` | variable | 15 |

### Imports (Source Modules)

| Source | Type |
|--------|------|
| `./integr8/types.js` | require |
| `./integr8/dataIngestion.js` | require |

### Connections

| Direction | Module |
|-----------|--------|
| **imports** | `types`, `dataIngestion` |
| **importedBy** | *(none — orphaned)* |

### Intent

- **Purpose:** Dependency graph construction
- **Depends on:** types, dataIngestion
- **Value:** Provides `buildDependencyGraph` API, `getImpactAnalysis` API

### Summary

Constructs dependency graphs from ingested codebase data and computes impact analysis for individual modules. A focused, lightweight module (9 KB) with a clear single responsibility.

### Status: 🔴 RED

**Concerns:**
- **Orphaned export** — `importedBy` is empty. Both `buildDependencyGraph` and `getImpactAnalysis` appear to have no consumers.
- **Zero reachability** — Score is 0.00.
- **Intent is stub-quality** — Ends with `???`.

---

## 3. `graphTraversal.js`

**Path:** `lib/commands/graphTraversal.js` | **Size:** 33 KB

### Exports

| Name | Kind | Line |
|------|------|------|
| `clearCache` | variable | 48 |
| `ensureIndexes` | variable | 49 |
| `findPaths` | variable | 50 |
| `analyzeReachability` | variable | 51 |
| `extractSubgraph` | variable | 52 |
| `computeImpactChain` | variable | 53 |
| `findImportsOf` | variable | 54 |
| `findConsumersOf` | variable | 55 |
| `findOrphans` | variable | 56 |
| `getDirectorySubgraph` | variable | 57 |
| `getDirectoryBoundary` | variable | 58 |
| `getDataFlowMetrics` | variable | 59 |
| `getFileFlows` | variable | 60 |

### Imports (Source Modules)

| Source | Type |
|--------|------|
| `./integr8/databasePersister.js` | require |

### Connections

| Direction | Module |
|-----------|--------|
| **imports** | `databasePersister` |
| **importedBy** | *(none — orphaned)* |

### Intent

- **Purpose:** Graph traversal and querying
- **Depends on:** databasePersister
- **Value:** 13 query APIs for pathfinding, reachability, impact chains, orphan detection, directory analysis, data flow metrics

### Summary

The largest API surface in this set — 13 exported functions providing a comprehensive graph query toolkit: pathfinding between modules, reachability analysis, subgraph extraction, impact chain computation, consumer/import lookups, orphan detection, and directory-level boundary analysis. All backed by a database persistence layer.

### Status: 🔴 RED

**Concerns:**
- **Orphaned exports** — `importedBy` is empty. All 13 exported functions appear unused.
- **Zero reachability** — Score is 0.00.
- **Massive unused API surface** — 13 functions with no consumers is a significant red flag. This could indicate dead code, incomplete integration, or an API that was built ahead of its consumers.
- **Intent is stub-quality** — Ends with `???`.

---

## 4. `insightStore.js`

**Path:** `lib/commands/insightStore.js` | **Size:** 15 KB

### Exports

| Name | Kind | Line |
|------|------|------|
| `InsightStore` | variable | 42 |
| `getInsightStore` | variable | 43 |

### Imports (Source Modules)

| Source | Type |
|--------|------|
| `./integr8/databasePersister.js` | require |

### Connections

| Direction | Module |
|-----------|--------|
| **imports** | `databasePersister` |
| **importedBy** | `backgroundIndexer` |

### Intent

- **Purpose:** Insight storage and retrieval
- **Depends on:** databasePersister
- **Value:** Provides `InsightStore` and `getInsightStore` APIs

### Summary

Manages storage and retrieval of code analysis insights, backed by the database persistence layer. Consumed by the background indexer, which writes insights during the indexing pipeline.

### Status: 🟢 GREEN

**Notes:**
- Has a confirmed consumer (`backgroundIndexer`).
- Reachability score of 0.95 — strongly connected to entry points.
- Clean dependency chain (single import: `databasePersister`).

---

## 5. `parserPersistence.js`

**Path:** `lib/commands/parserPersistence.js` | **Size:** 14 KB

### Exports

| Name | Kind | Line |
|------|------|------|
| `ParserPersistence` | variable | 42 |

### Imports (Source Modules)

| Source | Type |
|--------|------|
| `./integr8/databasePersister.js` | require |

### Connections

| Direction | Module |
|-----------|--------|
| **imports** | `databasePersister` |
| **importedBy** | `backgroundIndexer` |

### Intent

- **Purpose:** SQLite persistence layer
- **Depends on:** databasePersister
- **Value:** Provides CRUD operations for the file registry

### Summary

Provides CRUD operations for the file registry, persisting parsed file metadata to SQLite via the database persister. Consumed by the background indexer during file ingestion.

### Status: 🟢 GREEN

**Notes:**
- Has a confirmed consumer (`backgroundIndexer`).
- Reachability score of 0.95.
- Single export, single import — minimal coupling.

---

## Cross-Cutting Observations

### Dependency Graph (Wave 1 Internal)

```
backgroundIndexer ──► parserPersistence ──► databasePersister
               ──► insightStore ──────► databasePersister
               ──► dataIngestion
               ──► types
               ──► sonicClient
               ──► multiPassAnalyzer
               ──► precisionCapture
               ──► chokidar (npm)
               ──► events (node)

graphBuilder ──► dataIngestion
             ──► types

graphTraversal ──► databasePersister
```

### Key Finding: 3 of 5 modules are orphaned

`backgroundIndexer`, `graphBuilder`, and `graphTraversal` all have:
- Empty `importedBy` arrays
- Reachability score of 0.00
- RED status

This means **20 out of 22 exports across these 5 files have no known consumers**. Only the 3 exports consumed by `backgroundIndexer` (from `insightStore` and `parserPersistence`) are connected.

### Hypothesis

The three RED modules may be:
1. **CLI entry points** invoked directly (not `require()`-ed by other modules) — their exports would be used at runtime but invisible to static import analysis
2. **Dead code** from an earlier iteration that was never wired up
3. **Pre-built APIs** awaiting integration in a future phase

The `???` suffixes in all intent fields suggest the indexer could not determine purpose with confidence — a signal these modules may lack documentation or have ambiguous roles.
