# DETAILED LINE-BY-LINE REPORT: `lib/commands/graphBuilder.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/graphBuilder.js`
**Total Lines:** 214
**Source:** Compiled from `src/commands/graphBuilder.ts` (TypeScript → JavaScript, Babel helpers generated)
**Status:** WORKING — Both exported functions are functional. Connected to `backend/indexer.js`. Minor code quality issues present.

---

## SECTION 1: FILE HEADER & STRICT MODE (Lines 1-3)

```
Lines 1-3: File header, strict mode, and source comment
- What triggers it: Module load time
- What it calls: Nothing
- What calls it: Node.js runtime on `require()`
- Dependencies: None
- Status: WORKING
- Gap: None
```

**Line-by-line:**
- **Line 1:** `"use strict"` — Enforced strict mode. Correct for CommonJS modules.
- **Line 2:** `// src/commands/graphBuilder.ts` — Reveals this is compiled TypeScript output. Original source was `.ts`.
- **Line 3:** `// Cross-file dependency graph builder with health scoring, circular dependency detection, and impact analysis.` — Describes the module's purpose. Three capabilities: (1) health scoring, (2) circular dependency detection, (3) impact analysis.

---

## SECTION 2: TYPESCRIPT COMPILE HELPER — `__awaiter` (Lines 4-12)

```
Lines 4-12: TypeScript __awaiter helper function
- What triggers it: Every async function call in this module (lines 22, 174)
- What it calls: Promise constructor, generator.next(), generator.throw()
- What calls it: buildDependencyGraph() at line 22, getImpactAnalysis() at line 174
- Dependencies: None (standard ES polyfill)
- Status: WORKING
- Gap: None — standard TypeScript emit for async/await
```

**Detailed breakdown:**
- **Line 4:** `var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {` — Defines `__awaiter` as a polyfill for `async/await`. Uses `(this && this.__awaiter)` check to avoid redefinition if already present in scope.
- **Lines 5-6:** `adopt(value)` helper — Wraps a non-Promise value into a resolved Promise. `value instanceof P ? value : new P(function (resolve) { resolve(value); })`.
- **Lines 7-8:** Creates a new Promise with `fulfilled` and `rejected` handlers that call `step()`.
- **Lines 9-10:** `step(result)` — Advances the generator. If `result.done`, resolves with `result.value`. Otherwise chains `.then(fulfilled, rejected)`.
- **Line 11:** `step((generator = generator.apply(thisArg, _arguments || [])).next())` — Kicks off the generator by calling `.next()` on the first iteration.

**Notes:** This is **auto-generated** by TypeScript compiler. Not hand-written. Standard pattern for transpiling `async/await` to ES5/ES6.

---

## SECTION 3: MODULE EXPORTS REGISTRATION (Lines 13-15)

```
Lines 13-15: Public API registration — exports.__esModule, exports.buildDependencyGraph, exports.getImpactAnalysis
- What triggers it: Module load time
- What it calls: Object.defineProperty (via __esModule)
- What calls it: Callers via destructured require: `const { buildDependencyGraph } = require('./commands/graphBuilder.js')`
- Dependencies: None
- Status: WORKING
- Gap: Only 2 functions are exported. Internal helpers (detectCircularDependencies, computeImpactRadius) are not exported — this is fine as they're implementation details.
```

**Line-by-line:**
- **Line 13:** `Object.defineProperty(exports, "__esModule", { value: true });` — Marks this as a TypeScript-compiled CommonJS module.
- **Line 14:** `exports.buildDependencyGraph = buildDependencyGraph;` — **PRIMARY PUBLIC API**. Async function. Takes `projectPath`, returns a full graph report.
- **Line 15:** `exports.getImpactAnalysis = getImpactAnalysis;` — **SECONDARY PUBLIC API**. Async function. Takes `projectPath` + `filePath`, returns impact analysis for a specific file.

---

## SECTION 4: IMPORTS / DEPENDENCIES (Lines 16-17)

```
Lines 16-17: External dependency imports
- What triggers it: Module load time (synchronous require)
- What it calls: Node.js module resolution
- What calls it: Module initialization
- Dependencies: ./integr8/types.js, ./integr8/dataIngestion.js
- Status: WORKING
- Gap: None — both modules exist and are loadable
```

**Line-by-line:**
- **Line 16:** `const types_js_1 = require("./integr8/types.js");` — Imports the types module. Used for `types_js_1.NodeType.FILE` (line 48), `types_js_1.NodeType.IMPORT` (lines 57, 80, 86), `types_js_1.EdgeType.IMPORTS` (line 58). File exists at `/home/bozertron/1_AT_A_TIME/st8/lib/commands/integr8/types.js`.
- **Line 17:** `const dataIngestion_js_1 = require("./integr8/dataIngestion.js");` — Imports the data ingestion module. Used for `dataIngestion_js_1.ingestProjectData` (line 25). File exists at `/home/bozertron/1_AT_A_TIME/st8/lib/commands/integr8/dataIngestion.js`.

**Dependency chain:**
```
graphBuilder.js
├── integr8/types.js        (NodeType, EdgeType enums)
└── integr8/dataIngestion.js (ingestProjectData function)
    ├── integr8/types.js
    ├── ../overview.js       (generateOverviewAndGetFileList)
    ├── ../storeParser.js    (generateStoreReport)
    ├── ../routeParser.js    (generateRouteReport)
    ├── ../commandParser.js  (generateCommandReport)
    ├── ../typeParser.js     (generateTypeReport)
    ├── ../uiParser.js       (generateUiComponentReport)
    ├── ../parserPersistence.js
    ├── ../../utils/astParser.js (extractFromText, extractImportsAndExports)
    ├── ../../utils/safeFs.js
    └── ../../utils/ioChan.js
```

---

## SECTION 5: `buildDependencyGraph()` — MAIN FUNCTION (Lines 18-113)

```
Lines 18-113: buildDependencyGraph(projectPath) — PRIMARY EXPORTED API
- What triggers it: Called by backend/indexer.js line 246: `await graphBuilder.buildDependencyGraph(targetDir)`
- What it calls: ingestProjectData() (line 25), detectCircularDependencies() (line 44), computeImpactRadius() (line 67)
- What calls it: backend/indexer.js → buildGraph() → getGraphBuilder().buildDependencyGraph()
- Dependencies: integr8/dataIngestion.js (ingestProjectData), integr8/types.js (NodeType, EdgeType)
- Status: WORKING
- Gap: None — function is complete and returns expected shape
```

### 5a. Function Signature & Async Wrapper (Lines 18-23)

- **Line 18-20:** JSDoc comment: `Build a dependency graph with health analysis for a project`.
- **Line 21:** `function buildDependencyGraph(projectPath) {` — Takes a single argument: `projectPath` (string, directory path).
- **Line 22:** `return __awaiter(this, void 0, void 0, function* () {` — Wraps the function body in an async generator pattern.
- **Line 23:** `var _a, _b, _c, _d, _e;` — Declares temporary variables for null-safe property access (TypeScript optional chaining compiled output).

### 5b. Data Ingestion — Getting Raw Graph (Lines 24-31)

- **Lines 25-29:** `const { externalGraph } = yield (0, dataIngestion_js_1.ingestProjectData)({ externalPath: projectPath, currentPath: projectPath, targetPages: [] });` — Calls `ingestProjectData` with `externalPath` and `currentPath` set to the same value. `targetPages` is empty array (no page filtering). **Note:** Both `externalPath` and `currentPath` are the same — this means the function ingests the project twice (once as "external", once as "current"). This is wasteful but not incorrect.
- **Line 30:** `const nodes = externalGraph.nodes;` — Extracts the node array from the graph.
- **Line 31:** `const edges = externalGraph.edges;` — Extracts the edge array from the graph.

**Data shape of `externalGraph`:** `{ nodes: Node[], edges: Edge[], properties: { reachability: 0, stability: 0, fragility: 0 } }` (from `dataIngestion.js` line 1069-1073).

### 5c. Adjacency List Construction (Lines 32-42)

- **Line 33:** `const outgoing = new Map();` — Maps `nodeId → Set<nodeId>` (node depends on).
- **Line 34:** `const incoming = new Map();` — Maps `nodeId → Set<nodeId>` (node is consumed by).
- **Lines 35-38:** Initialize empty Sets for every node in both maps.
- **Lines 39-42:** Populate adjacency lists from edges:
  - **Line 40:** `outgoing.get(edge.from)?.add(edge.to)` — Add `edge.to` to the outgoing set of `edge.from`.
  - **Line 41:** `incoming.get(edge.to)?.add(edge.from)` — Add `edge.from` to the incoming set of `edge.to`.
  - Uses `?.` (optional chaining) — if a node ID isn't in the map, the add is silently skipped. This is safe but could mask data integrity issues.

### 5d. Circular Dependency Detection (Lines 43-44)

- **Line 44:** `const circularDeps = detectCircularDependencies(nodes, outgoing);` — Calls the internal DFS-based cycle detector (defined at lines 117-151). Returns an array of `{ cycle: string[], files: string[] }`.

### 5e. Orphaned File Detection (Lines 45-53)

- **Lines 46-53:** Finds files with no incoming AND no outgoing edges:
  - **Line 48:** Checks `node.type === types_js_1.NodeType.FILE` — only considers FILE nodes.
  - **Line 49:** `(outgoing.get(node.id)?.size || 0) === 0` — no outgoing edges.
  - **Line 50:** `(incoming.get(node.id)?.size || 0) === 0` — no incoming edges.
  - **Line 51:** `orphanedFiles.push(node.path || node.name)` — Uses path if available, otherwise name.

**Gap:** The condition checks `node.type === NodeType.FILE` but many nodes (IMPORT, EXPORT, TYPE, etc.) could also be orphaned. This only detects orphaned FILE nodes, not orphaned exports or imports.

### 5f. Dead Import Detection (Lines 54-63)

- **Lines 55-63:** Finds import nodes with no matching export edge:
  - **Line 57:** Checks `node.type === types_js_1.NodeType.IMPORT` — only considers IMPORT nodes.
  - **Line 58:** `edges.some(e => e.from === node.id && e.type === types_js_1.EdgeType.IMPORTS)` — Checks if any edge FROM this node has type `IMPORTS`. If no such edge exists, the import is unresolved.
  - **Line 59:** Also checks `outgoing.get(node.id)?.size === 0` — double-checks no outgoing edges at all.
  - **Line 60:** `deadImports.push(node.name)` — Records the import name.

**Gap:** The `EdgeType.IMPORTS` check at line 58 is looking for edges of type `imports` but the `buildEdges()` function in `dataIngestion.js` (line 732) only creates `CONTAINS`, `NAVIGATES_TO`, and `INVOKES` edges — it never creates `IMPORTS` edges. This means the `hasResolution` check at line 58 will **always be false** for all import nodes. The dead import detection relies solely on the `outgoing.size === 0` check at line 59.

### 5g. Impact Radius Computation (Lines 64-68)

- **Line 65:** `const impactMap = new Map();` — Maps `nodeId → number` (transitive dependent count).
- **Lines 66-68:** For each node, computes `computeImpactRadius(node.id, incoming)` (defined at lines 155-169). This is a BFS that counts all transitive consumers (nodes that directly or indirectly depend on this node).

### 5h. Health Classification (Lines 69-94)

- **Line 70:** `const cycleNodeIds = new Set(circularDeps.flatMap(c => c.cycle));` — Flattens all cycle node IDs into a Set for O(1) lookup.
- **Line 71:** `const deadImportNames = new Set(deadImports);` — Creates a Set of dead import names.
- **Lines 72-94:** Maps each node to an enriched node with health status:
  - **Line 77-78:** If node is in a cycle → `health = 'broken'`.
  - **Line 80-81:** If node is an IMPORT and in dead imports → `health = 'broken'`.
  - **Line 83-84:** If node is a FILE with no deps and no consumers → `health = 'unused'`.
  - **Line 86-87:** If node has no consumers and is not a FILE → `health = 'partial'`.
  - **Line 89-90:** Otherwise → `health = 'healthy'`.
  - **Lines 92-93:** Spreads original node properties and adds `health`, `consumers`, `dependencies`, `impactRadius`.

**Health classification priority:** broken (cycle) > broken (dead import) > unused (isolated file) > partial (no consumers) > healthy.

### 5i. Health Score Computation & Return (Lines 95-112)

- **Lines 95-98:** Counts nodes by health category: `healthyCount`, `partialCount`, `unusedCount`, `brokenCount`.
- **Line 99:** `const healthScore = nodes.length > 0 ? healthyCount / nodes.length : 1;` — Ratio of healthy nodes to total nodes. Returns 1.0 if no nodes (edge case).
- **Lines 100-111:** Returns the report object:
  ```javascript
  {
    nodes: healthyNodes,        // Array of enriched nodes with health data
    circularDeps,               // Array of { cycle: string[], files: string[] }
    orphanedFiles,              // Array of file paths
    deadImports,                // Array of import names
    healthScore,                // Number 0-1
    totalNodes,                 // Number
    healthyCount,               // Number
    partialCount,               // Number
    unusedCount,                // Number
    brokenCount                 // Number
  }
  ```

**Note:** The return value does NOT include `edges`. The caller (`backend/indexer.js` line 246-267) only uses `report.nodes` for classification, so this is fine for that use case. However, if any other caller needs edge data, it would be missing.

---

## SECTION 6: `detectCircularDependencies()` — INTERNAL HELPER (Lines 114-151)

```
Lines 114-151: detectCircularDependencies(nodes, outgoing) — INTERNAL, NOT EXPORTED
- What triggers it: Called once at line 44 inside buildDependencyGraph()
- What it calls: dfs() (recursive, internal)
- What calls it: buildDependencyGraph() at line 44
- Dependencies: None (operates on passed-in data structures)
- Status: WORKING
- Gap: Reports the same cycle multiple times if multiple entry points reach it
```

### 6a. Function Signature & Setup (Lines 117-122)

- **Line 117:** `function detectCircularDependencies(nodes, outgoing) {` — Takes nodes array and outgoing adjacency map.
- **Line 118:** `const cycles = [];` — Accumulator for detected cycles.
- **Line 119:** `const visited = new Set();` — Tracks globally visited nodes (for DFS across disconnected components).
- **Line 120:** `const recursionStack = new Set();` — Tracks nodes in the current DFS path (for cycle detection).
- **Line 121:** `const path = [];` — Tracks the current DFS path (for extracting cycle members).
- **Line 122:** `const nodeMap = new Map(nodes.map(n => [n.id, n]));` — Creates a lookup map from node ID to node object.

### 6b. DFS Implementation (Lines 123-144)

- **Line 123:** `function dfs(nodeId) {` — Recursive DFS function.
- **Line 124:** `visited.add(nodeId);` — Mark node as globally visited.
- **Line 125:** `recursionStack.add(nodeId);` — Mark node as in current recursion stack.
- **Line 126:** `path.push(nodeId);` — Add node to current path.
- **Lines 127-141:** Iterate over neighbors:
  - **Line 128-129:** If neighbor not visited, recurse.
  - **Lines 131-139:** If neighbor is in recursion stack (cycle detected):
    - **Line 133:** `const cycleStart = path.indexOf(neighbor);` — Find where the cycle starts.
    - **Line 134:** `const cycle = path.slice(cycleStart);` — Extract cycle members.
    - **Lines 135-138:** Map cycle IDs to file paths/names.
    - **Line 139:** `cycles.push({ cycle, files });` — Record the cycle.
- **Line 142:** `path.pop();` — Backtrack: remove node from path.
- **Line 143:** `recursionStack.delete(nodeId);` — Backtrack: remove node from recursion stack.

### 6c. Main Loop (Lines 145-150)

- **Lines 145-149:** Iterate over all nodes, start DFS from unvisited nodes. This ensures disconnected components are also checked.
- **Line 150:** `return cycles;` — Returns array of detected cycles.

**Gap:** The algorithm may report duplicate cycles. If a cycle A→B→C→A is reachable from multiple entry points, it could be detected multiple times. The `visited` set prevents re-visiting nodes in the global sense, but the `recursionStack` check can trigger for the same cycle from different DFS paths. In practice, this is unlikely to cause issues because once a node is in `visited`, it won't be the root of another DFS.

---

## SECTION 7: `computeImpactRadius()` — INTERNAL HELPER (Lines 152-169)

```
Lines 152-169: computeImpactRadius(nodeId, incoming) — INTERNAL, NOT EXPORTED
- What triggers it: Called once per node at line 67 inside buildDependencyGraph()
- What it calls: Nothing (BFS traversal)
- What calls it: buildDependencyGraph() loop at lines 66-68
- Dependencies: None (operates on passed-in data structures)
- Status: WORKING
- Gap: Uses queue.shift() which is O(n) per operation — performance concern for large graphs, but not a correctness issue
```

### 7a. Function Signature & Setup (Lines 155-158)

- **Line 155:** `function computeImpactRadius(nodeId, incoming) {` — Takes a node ID and the incoming adjacency map.
- **Line 156:** `const visited = new Set();` — Tracks visited nodes.
- **Line 157:** `const queue = [nodeId];` — BFS queue, initialized with the start node.
- **Line 158:** `visited.add(nodeId);` — Mark start node as visited.

### 7b. BFS Traversal (Lines 159-167)

- **Line 159:** `while (queue.length > 0) {` — Standard BFS loop.
- **Line 160:** `const current = queue.shift();` — Dequeue front element. **Note:** `Array.shift()` is O(n) — a proper queue implementation would be O(1). For small graphs this is fine.
- **Lines 161-165:** For each consumer of the current node:
  - **Line 162:** If not visited, mark visited and enqueue.
- **Line 168:** `return visited.size - 1;` — Returns count of transitive consumers (excluding self).

---

## SECTION 8: `getImpactAnalysis()` — SECONDARY EXPORTED API (Lines 170-213)

```
Lines 170-213: getImpactAnalysis(projectPath, filePath) — SECONDARY EXPORTED API
- What triggers it: Not called by any file in the current codebase (no grep matches for getImpactAnalysis in callers)
- What it calls: buildDependencyGraph() (line 175), then performs BFS on the result
- What calls it: Unknown — may be called by external tools or future code
- Dependencies: buildDependencyGraph() (same file)
- Status: WORKING but NOT CONNECTED — no callers found in the codebase
- Gap: No callers found. Function is exported but unused. Rebuilds the entire graph just to analyze one file.
```

### 8a. Function Signature & Graph Rebuild (Lines 173-175)

- **Line 173:** `function getImpactAnalysis(projectPath, filePath) {` — Takes project path and target file path.
- **Line 174:** `return __awaiter(this, void 0, void 0, function* () {` — Async wrapper.
- **Line 175:** `const report = yield buildDependencyGraph(projectPath);` — **Calls buildDependencyGraph** to get the full graph. This means every call to `getImpactAnalysis` rebuilds the entire dependency graph from scratch. No caching.

### 8b. Target Node Lookup (Lines 176-180)

- **Line 177:** `const targetNode = report.nodes.find(n => n.path === filePath || n.name === filePath || n.path?.endsWith(filePath));` — Searches for the target node by:
  1. Exact path match
  2. Exact name match
  3. Path ends with the given filePath
- **Lines 178-180:** If not found, returns empty result: `{ directConsumers: [], transitiveConsumers: [], impactRadius: 0 }`.

### 8c. Direct Consumers (Lines 181-185)

- **Lines 182-185:** Maps `targetNode.consumers` (array of node IDs) to node paths/names:
  - `targetNode.consumers.map(id => report.nodes.find(n => n.id === id))` — Looks up each consumer ID in the nodes array.
  - `.filter(n => n)` — Removes nulls (in case a consumer ID doesn't match any node).
  - `.map(n => n.path || n.name)` — Extracts path or name.

**Gap:** Linear search with `.find()` for each consumer — O(n*m) where n is consumers and m is total nodes. A pre-built nodeMap would be O(n+m).

### 8d. Transitive Consumers — BFS (Lines 186-206)

- **Lines 187-201:** BFS from the target node through consumers:
  - **Line 188:** `const queue = [targetNode.id];` — BFS queue.
  - **Line 189:** `visited.add(targetNode.id);` — Mark start as visited.
  - **Lines 190-201:** BFS loop:
    - **Line 192:** `const node = report.nodes.find(n => n.id === current);` — **Another linear search** per BFS step. O(n) per step.
    - **Lines 194-198:** For each consumer of the found node, if not visited, enqueue.
- **Lines 202-206:** Convert visited set (minus target) to paths/names.

**Gap:** The BFS at lines 190-201 does a linear `.find()` on every iteration. For a graph with N nodes and average degree D, this is O(N*D*N) = O(N²*D). Building a nodeMap once would reduce this to O(N*D).

### 8e. Return Value (Lines 207-211)

- **Lines 207-211:** Returns:
  ```javascript
  {
    directConsumers: string[],      // Paths/names of direct consumers
    transitiveConsumers: string[],  // Paths/names of all transitive consumers
    impactRadius: number            // From the pre-computed impactRadius on the node
  }
  ```

**Note:** `impactRadius` at line 210 comes from `targetNode.impactRadius` which was computed during `buildDependencyGraph()`. This value should equal `transitiveConsumers.length` — they're computed via the same BFS logic. This is redundant but not incorrect.

---

## SECTION 9: SOURCEMAP REFERENCE (Line 214)

```
Line 214: //# sourceMappingURL=graphBuilder.js.map
- What triggers it: Browser/debugger tooling
- What it calls: Nothing
- What calls it: Nothing (informational comment)
- Dependencies: graphBuilder.js.map (not present in repo)
- Status: NOT APPLICABLE
- Gap: The .map file may not exist, but this is a no-op comment
```

---

## CONNECTION MAP

### What triggers graph building?

| Caller | File | Line | How |
|--------|------|------|-----|
| `buildGraph()` | `backend/indexer.js` | 246 | `await graphBuilder.buildDependencyGraph(targetDir)` |
| `getImpactAnalysis()` | `lib/commands/graphBuilder.js` | 175 | `yield buildDependencyGraph(projectPath)` (self-call) |

### What other files get called?

| Called Function | Target File | Called From (line) |
|----------------|-------------|-------------------|
| `ingestProjectData()` | `lib/commands/integr8/dataIngestion.js` | graphBuilder.js:25 |
| `detectCircularDependencies()` | `lib/commands/graphBuilder.js` (internal) | graphBuilder.js:44 |
| `computeImpactRadius()` | `lib/commands/graphBuilder.js` (internal) | graphBuilder.js:67 |

### What data flows out?

| Consumer | Data Used | From Return Shape |
|----------|-----------|-------------------|
| `backend/indexer.js` (lines 251-267) | `report.nodes[].path`, `.health`, `.impactRadius` | `{ nodes, circularDeps, orphanedFiles, deadImports, healthScore, totalNodes, ... }` |

### Full Call Chain

```
backend/indexer.js
  └── buildGraph() [line 236]
      └── getGraphBuilder() [line 237] → require('lib/commands/graphBuilder.js')
      └── graphBuilder.buildDependencyGraph(targetDir) [line 246]
          └── ingestProjectData({ externalPath, currentPath, targetPages: [] }) [line 25]
              └── ingestSingleProject(projectPath) × 2 [dataIngestion.js:1094-1095]
                  └── generateOverviewAndGetFileList() [overview.js]
                  └── generateStoreReport() [storeParser.js]
                  └── generateRouteReport() [routeParser.js]
                  └── generateCommandReport() [commandParser.js]
                  └── generateTypeReport() [typeParser.js]
                  └── generateUiComponentReport() [uiParser.js]
                  └── extractImportsAndExports() [astParser.js] (per file)
                  └── buildEdges() [dataIngestion.js:732]
          └── detectCircularDependencies() [line 44] (DFS)
          └── computeImpactRadius() × N [line 67] (BFS per node)
          └── returns { nodes, circularDeps, orphanedFiles, ... }
      └── transforms to [{ filepath, status, reachabilityScore, impactRadius }]
```

---

## @@@ HANDLING

**No `@@@` symbols found in this file.** Grep returned zero matches for `@@@` in `lib/commands/graphBuilder.js`.

---

## GRAPH DATA STRUCTURE

### Node Shape (from `integr8/types.js` + enrichment in graphBuilder.js)

```javascript
{
  id: string,              // e.g., "file_src/main.ts_1", "store_myStore_2"
  type: NodeType,          // "file" | "store" | "route" | "command" | "type" | "import" | "export" | "component" | "function" | "variable"
  name: string,            // Display name
  path: string | undefined,// File path or import source
  metadata: object,        // Varies by node type (projectPath, importType, etc.)
  // --- Added by buildDependencyGraph() ---
  health: string,          // "healthy" | "broken" | "unused" | "partial"
  consumers: string[],     // Node IDs that depend on this node
  dependencies: string[],  // Node IDs this node depends on
  impactRadius: number     // Count of transitive consumers
}
```

### Edge Shape (from `integr8/dataIngestion.js`)

```javascript
{
  id: string,              // e.g., "edge_fromId__contains__toId"
  from: string,            // Source node ID
  to: string,              // Target node ID
  type: EdgeType,          // "contains" | "navigates_to" | "invokes" | etc.
  confidence: number       // 0-1 (1.0 = certain, 0.9 = high confidence)
}
```

### Adjacency Lists (internal to `buildDependencyGraph()`)

```javascript
outgoing: Map<string, Set<string>>  // nodeId → set of node IDs it depends on
incoming: Map<string, Set<string>>  // nodeId → set of node IDs that depend on it
```

### Return Shape of `buildDependencyGraph()`

```javascript
{
  nodes: EnrichedNode[],           // Nodes with health, consumers, dependencies, impactRadius
  circularDeps: Array<{
    cycle: string[],               // Array of node IDs forming the cycle
    files: string[]                // Array of file paths/names in the cycle
  }>,
  orphanedFiles: string[],         // File paths with no connections
  deadImports: string[],           // Import names with no resolution
  healthScore: number,             // 0-1 (healthy nodes / total nodes)
  totalNodes: number,
  healthyCount: number,
  partialCount: number,
  unusedCount: number,
  brokenCount: number
}
```

### Return Shape of `getImpactAnalysis()`

```javascript
{
  directConsumers: string[],       // Paths/names of direct consumers
  transitiveConsumers: string[],   // Paths/names of all transitive consumers
  impactRadius: number             // Pre-computed transitive consumer count
}
```

---

## FINDINGS SUMMARY

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| 1 | WARNING | 25-29 | `ingestProjectData` called with `externalPath === currentPath` — ingests project twice unnecessarily |
| 2 | WARNING | 58 | `EdgeType.IMPORTS` edge type never created by `buildEdges()` — dead import check relies solely on outgoing.size |
| 3 | WARNING | 192 | Linear `.find()` inside BFS loop — O(N²) performance for transitive consumer lookup |
| 4 | INFO | 15-17 | `getImpactAnalysis` is exported but has no callers in the codebase |
| 5 | INFO | 175 | `getImpactAnalysis` rebuilds entire graph on every call — no caching |
| 6 | INFO | 160 | `queue.shift()` is O(n) per operation — could use proper queue for large graphs |
| 7 | INFO | 100-111 | Return value does not include `edges` — callers that need edge data would need to call `ingestProjectData` directly |
| 8 | INFO | 47-52 | Orphaned file detection only checks FILE nodes — orphaned IMPORT/EXPORT nodes not detected |

---

_Reviewed: 2026-05-13_
_Reviewer: GSD Codebase Reviewer_
_Depth: standard_
