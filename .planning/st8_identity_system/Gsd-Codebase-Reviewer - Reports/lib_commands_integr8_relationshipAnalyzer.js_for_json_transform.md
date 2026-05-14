# Detailed Line-by-Line Report: `lib/commands/integr8/relationshipAnalyzer.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/integr8/relationshipAnalyzer.js`
**Total Lines:** 924
**Language:** JavaScript (compiled from TypeScript)
**Source TypeScript:** `src/commands/integr8/relationshipAnalyzer.ts` — **MISSING** (no .ts source file exists on disk)
**Report Generated:** 2026-05-13

---

## Lines 1-2: File Header
```
"use strict";
// src/commands/integr8/relationshipAnalyzer.ts
```
- **What this section does:** Enables strict mode; comments reference original TypeScript source file that no longer exists on disk.
- **What triggers it:** Module load time.
- **What it calls:** N/A.
- **What calls it:** N/A.
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** The referenced `.ts` source file (`src/commands/integr8/relationshipAnalyzer.ts`) does not exist — only the compiled `.js` output is present. Any future edits must be made to this compiled file directly.

---

## Lines 3-4: Module Declaration
```
// Stage 2: Relationship Analysis Engine
Object.defineProperty(exports, "__esModule", { value: true });
```
- **What this section does:** Comment labels this as "Stage 2" of the integr8 pipeline. Line 4 marks the module as an ES module compiled to CommonJS.
- **What triggers it:** Module load time.
- **What it calls:** `Object.defineProperty`.
- **What calls it:** Module system.
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** None.

---

## Lines 5-9: Export Declarations
```
exports.analyzeRelationships = analyzeRelationships;
exports.analyzeStructuralSubtyping = analyzeStructuralSubtyping;
exports.detectBreakingChanges = detectBreakingChanges;
exports.computeTarjanSCC = computeTarjanSCC;
exports.detectCyclesWithTarjan = detectCyclesWithTarjan;
```
- **What this section does:** Declares 5 public exports from this module.
- **What triggers it:** Module load time.
- **What it calls:** N/A (declarations only).
- **What calls it:**
  - `analyzeRelationships` → called by `integr8/index.js:80` (line 80: `relationshipAnalyzer_js_1.analyzeRelationships(...)`)
  - `analyzeStructuralSubtyping` → **ZERO external callers**. Only called internally at line 326 (within `hasMetadataDifference`) and line 640 (within `detectBreakingChanges`).
  - `detectBreakingChanges` → **ZERO external callers**. Exported but never imported by any file in the codebase.
  - `computeTarjanSCC` → **ZERO external callers**. Only called internally at line 891 (within `detectCyclesWithTarjan`).
  - `detectCyclesWithTarjan` → **ZERO external callers**. Exported but never imported by any file in the codebase.
- **Dependencies:** N/A.
- **Status:** ⚠️ PARTIAL
- **Gap:** 4 of 5 exports (`analyzeStructuralSubtyping`, `detectBreakingChanges`, `computeTarjanSCC`, `detectCyclesWithTarjan`) are **dead exports** — they are exposed publicly but have zero consumers anywhere in the codebase. Only `analyzeRelationships` has an external caller (`integr8/index.js:80`). The other 4 functions are only reachable via internal call chains within this file.

---

## Line 10: Import Statement
```
const types_js_1 = require("./types.js");
```
- **What this section does:** Imports the `types.js` module which defines all enums used throughout this file.
- **What triggers it:** Module load time.
- **What it calls:** `require("./types.js")` → loads `types.js` (83 lines).
- **What calls it:** N/A (import).
- **Dependencies:** `./types.js` — exports: `IntegrationOutcome`, `DependencyStatus`, `NodeType`, `EdgeType`, `MigrationAction`, `ConflictType`, `ResolutionStrategy`, `VerificationLevel`.
- **Specific symbols used in this file:**
  - `EdgeType.IMPORTS` (line 36, 60)
  - `EdgeType.DEPENDS_ON` (line 36, 69)
  - `EdgeType.CONFLICTS_WITH` (line 68)
  - `NodeType.FILE` (line 134)
  - `NodeType.COMPONENT` (line 134)
  - `NodeType.EXPORT` (line 104)
  - `NodeType.IMPORT` (line 120)
  - `DependencyStatus.SAFE` (line 169, 665, 694)
  - `DependencyStatus.NEEDS_REWRITE` (line 51, 171, 668, 695)
  - `DependencyStatus.CONFLICT` (line 165, 672, 696)
  - `DependencyStatus.MISSING` (line 162, 676, 697)
  - `ConflictType.MISSING_DEPENDENCY` (line 205)
  - `ConflictType.NAME_COLLISION` (line 217)
  - `ConflictType.TYPE_MISMATCH` (line 230)
  - `ConflictType.CIRCULAR_DEPENDENCY` (line 249, 904)
  - `ResolutionStrategy.IGNORE` (line 208, 209, 253, 907)
  - `ResolutionStrategy.CUSTOM` (line 208, 235, 253, 907)
  - `ResolutionStrategy.RENAME` (line 220, 221)
  - `ResolutionStrategy.MERGE` (line 220)
  - `ResolutionStrategy.OVERWRITE` (line 220, 235)
- **Status:** ✅ WORKING
- **Gap:** None — `types.js` exists and all referenced symbols are defined.

---

## Lines 11-14: JSDoc Comment for `analyzeRelationships`
```
/**
 * Analyzes relationships between two SemanticGraphs (external project and current project).
 * Identifies dependency matches, conflicts, and computes integration properties.
 */
```
- **What this section does:** Documents the main public function's purpose.
- **Status:** ✅ WORKING
- **Gap:** The JSDoc does not document `@param` or `@return` types. Expected params: `externalGraph: SemanticGraph`, `currentGraph: SemanticGraph`, `targetPages: string[]`. Returns: `{ unifiedGraph, conflicts, dependencyMap }`.

---

## Lines 15-97: `analyzeRelationships(externalGraph, currentGraph, targetPages)`

### Lines 15-27: Function Signature & Local State Initialization
```
function analyzeRelationships(externalGraph, currentGraph, targetPages) {
    const unifiedNodes = [];
    const unifiedEdges = [];
    const conflicts = [];
    const dependencyMap = [];
    const currentExports = indexExportsByName(currentGraph);
    const currentImports = indexImportsBySource(currentGraph);
    let edgeCounter = 0;
    const generateEdgeId = () => `edge_rel_${++edgeCounter}`;
    let conflictCounter = 0;
    const generateConflictId = () => `conflict_${++conflictCounter}`;
```
- **What this section does:** Declares the main analysis function. Initializes output arrays and helper ID generators. Indexes the current graph's exports (by name) and imports (by source path) for O(1) lookups.
- **What triggers it:** Called by `integr8/index.js:80` during Stage 2 of the integr8 pipeline.
- **What it calls:**
  - `indexExportsByName(currentGraph)` → line 101
  - `indexImportsBySource(currentGraph)` → line 117
- **What calls it:** `integr8/index.js:80` — `const analysis = (0, relationshipAnalyzer_js_1.analyzeRelationships)(externalGraph, currentGraph, args.targetPages)`
- **Dependencies:** `indexExportsByName` (line 101), `indexImportsBySource` (line 117), `types.js` enums.
- **Status:** ✅ WORKING
- **Gap:** No input validation — if `externalGraph`, `currentGraph`, or `targetPages` is `null`/`undefined`, the function will throw with an unhelpful error. No JSDoc `@param` tags.

### Lines 29-34: STEP 1 — Find Page Node in External Graph
```
for (const targetPage of targetPages) {
    const pageNode = findPageNode(externalGraph, targetPage);
    if (!pageNode) continue;
    addNodeIfMissing(unifiedNodes, pageNode);
```
- **What this section does:** Iterates over each target page name, finds the corresponding node in the external graph (by name or path match), and adds it to the unified output graph.
- **What triggers it:** The for loop at line 29.
- **What it calls:**
  - `findPageNode(externalGraph, targetPage)` → line 132
  - `addNodeIfMissing(unifiedNodes, pageNode)` → line 703
- **What calls it:** Sequential execution within `analyzeRelationships`.
- **Dependencies:** `findPageNode` (line 132), `addNodeIfMissing` (line 703).
- **Status:** ✅ WORKING
- **Gap:** If `targetPages` is empty or `null`, the for loop silently does nothing — returns empty results with no warning. The `findPageNode` matching (line 137-138) uses `node.path.includes(targetPage)` which is a substring match — could false-positive on partial matches (e.g., targetPage `"home"` would match path `"homepage.tsx"`).

### Lines 35-36: STEP 2 — Find Import Edges Connected to Page
```
const importEdges = externalGraph.edges.filter((e) => e.from === pageNode.id && (e.type === types_js_1.EdgeType.IMPORTS || e.type === types_js_1.EdgeType.DEPENDS_ON));
```
- **What this section does:** Filters the external graph's edges to find all IMPORTS and DEPENDS_ON edges originating from the target page node.
- **What triggers it:** Sequential execution for each `targetPage` in the loop.
- **What it calls:** `Array.filter()` on `externalGraph.edges`.
- **What calls it:** The for loop at line 29.
- **Dependencies:** `EdgeType.IMPORTS`, `EdgeType.DEPENDS_ON` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:** Linear scan of ALL edges per page — O(E) per page. For large graphs with many pages, this could be slow. An adjacency list would be O(degree). However, performance is out of scope for this review.

### Lines 37-82: STEP 2-6 — Process Each Import Edge
```
for (const importEdge of importEdges) {
    const importNode = externalGraph.nodes.find((n) => n.id === importEdge.to);
    if (!importNode) continue;
    addNodeIfMissing(unifiedNodes, importNode);
    const matchResult = findMatchingExport(importNode, currentExports);
    const status = classifyDependency(importNode, matchResult);
    const mapping = { externalNode: importNode.id, status, targetNode: matchResult?.node.id, rewritePath: ... };
    dependencyMap.push(mapping);
    // ... edge building ...
    const detectedConflicts = detectConflicts(importNode, matchResult, pageNode, currentImports, generateConflictId);
    conflicts.push(...detectedConflicts);
}
```

- **What this section does:** For each import edge from the page:
  1. Finds the import node in external graph (line 38)
  2. Searches for a matching export in current graph (line 43)
  3. Classifies the dependency status: SAFE, NEEDS_REWRITE, CONFLICT, or MISSING (line 45)
  4. Builds a dependency mapping entry (lines 47-52)
  5. Creates unified graph edges (lines 56-77)
  6. Detects conflicts (line 80)
- **What triggers it:** The inner for loop at line 37.
- **What it calls:**
  - `externalGraph.nodes.find()` → line 38 (linear scan)
  - `findMatchingExport(importNode, currentExports)` → line 144
  - `classifyDependency(importNode, matchResult)` → line 160
  - `statusToConfidence(status)` → line 692
  - `detectConflicts(importNode, matchResult, pageNode, currentImports, generateConflictId)` → line 198
- **What calls it:** Sequential execution within the `importEdges` loop.
- **Dependencies:** All called functions listed above, plus `types.js` enums.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 38:** `externalGraph.nodes.find()` is O(N) linear scan per import edge. Could use a Map for O(1) lookups.
  - **Line 50-51:** TypeScript-compiled optional chaining (`matchResult === null || matchResult === void 0 ? void 0 : matchResult.node.id`) — if `matchResult` is null, `targetNode` is `undefined`. This is correct but verbose.

### Lines 64-78: Edge Building — Match Found Case
```
if (matchResult) {
    addNodeIfMissing(unifiedNodes, matchResult.node);
    const resolvedEdgeType = status === types_js_1.DependencyStatus.CONFLICT
        ? types_js_1.EdgeType.CONFLICTS_WITH
        : types_js_1.EdgeType.DEPENDS_ON;
    unifiedEdges.push({
        id: generateEdgeId(),
        from: importNode.id,
        to: matchResult.node.id,
        type: resolvedEdgeType,
        status,
        confidence: statusToConfidence(status)
    });
}
```
- **What this section does:** If a matching export was found, adds the export node to the unified graph and creates an edge from the import to the export. Edge type is CONFLICTS_WITH if there's a conflict, otherwise DEPENDS_ON.
- **What triggers it:** Conditional on `matchResult` being truthy.
- **What calls it:** The `importEdges` loop at line 37.
- **Dependencies:** `addNodeIfMissing` (line 703), `statusToConfidence` (line 692), `types.js` enums.
- **Status:** ✅ WORKING
- **Gap:** None — logic is straightforward.

### Lines 84-87: Add Remaining Current Graph Nodes
```
for (const node of currentGraph.nodes) {
    addNodeIfMissing(unifiedNodes, node);
}
```
- **What this section does:** After processing all target pages, adds ALL remaining nodes from the current graph to the unified graph for completeness.
- **What triggers it:** Sequential execution after the main `targetPages` loop completes.
- **What it calls:** `addNodeIfMissing` (line 703) for each node.
- **What calls it:** Sequential flow.
- **Dependencies:** `addNodeIfMissing` (line 703).
- **Status:** ✅ WORKING
- **Gap:** Note that current graph EDGES are NOT added — only nodes. This means the unified graph contains all current nodes but only relationship edges (import → export connections). Internal edges from the current graph are lost. This could be intentional (the unified graph is focused on cross-project relationships) but is undocumented.

### Lines 89-97: Compute Properties & Return
```
const properties = computeGraphProperties(dependencyMap);
const unifiedGraph = { nodes: unifiedNodes, edges: unifiedEdges, properties };
return { unifiedGraph, conflicts, dependencyMap };
```
- **What this section does:** Computes graph-level metrics (reachability, stability, fragility, integrationDistance) from the dependency map. Constructs the unified graph object and returns the complete analysis result.
- **What triggers it:** Sequential execution after all loops complete.
- **What it calls:** `computeGraphProperties(dependencyMap)` → line 649.
- **What calls it:** Sequential flow.
- **Dependencies:** `computeGraphProperties` (line 649).
- **Status:** ✅ WORKING
- **Gap:** The `currentGraph.edges` are NOT included in the unified graph — see note at lines 84-87 above.

---

## Lines 98-112: `indexExportsByName(graph)`
```
function indexExportsByName(graph) {
    const index = {};
    for (const node of graph.nodes) {
        if (node.type === types_js_1.NodeType.EXPORT) {
            if (!index[node.name]) {
                index[node.name] = [];
            }
            index[node.name].push(node);
        }
    }
    return index;
}
```
- **What this section does:** Builds a hash index of all EXPORT nodes in a graph, keyed by node name. Allows O(1) lookup by name (returns array since multiple exports can share a name).
- **What triggers it:** Called at line 21 in `analyzeRelationships`.
- **What it calls:** None (pure iteration).
- **What calls it:** `analyzeRelationships` line 21.
- **Dependencies:** `NodeType.EXPORT` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:** Uses `node.name` as key — if two exports have the same name but different paths, they'll be in the same bucket. This is handled by `findMatchingExport` (line 144) which checks path first. However, the index uses `!index[node.name]` which is falsy-check — an empty string name would be treated as missing. Edge case but possible.

---

## Lines 113-128: `indexImportsBySource(graph)`
```
function indexImportsBySource(graph) {
    const importMap = new Map();
    for (const node of graph.nodes) {
        if (node.type === types_js_1.NodeType.IMPORT && node.path) {
            if (!importMap.has(node.path)) {
                importMap.set(node.path, new Set());
            }
            importMap.get(node.path).add(node.name);
        }
    }
    return importMap;
}
```
- **What this section does:** Builds a Map from source path → Set of imported symbol names. Used for circular dependency detection. Only indexes IMPORT nodes that have a `path` property.
- **What triggers it:** Called at line 23 in `analyzeRelationships`.
- **What it calls:** None (pure iteration).
- **What calls it:** `analyzeRelationships` line 23.
- **Dependencies:** `NodeType.IMPORT` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:** Imports without a `path` property are silently excluded. This means some import relationships may not be tracked for cycle detection.

---

## Lines 129-140: `findPageNode(graph, targetPage)`
```
function findPageNode(graph, targetPage) {
    return graph.nodes.find((node) => {
        if (node.type !== types_js_1.NodeType.FILE && node.type !== types_js_1.NodeType.COMPONENT)
            return false;
        return node.name === targetPage ||
            (node.path && node.path.includes(targetPage));
    });
}
```
- **What this section does:** Searches for a node in the graph that matches the target page by name or path. Only considers FILE and COMPONENT nodes.
- **What triggers it:** Called at line 30 in `analyzeRelationships` for each target page.
- **What it calls:** `Array.find()` on `graph.nodes`.
- **What calls it:** `analyzeRelationships` line 30.
- **Dependencies:** `NodeType.FILE`, `NodeType.COMPONENT` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 138:** `node.path.includes(targetPage)` is a **substring match** — `targetPage = "home"` would match `path = "/pages/homepage.tsx"` or `path = "/components/home-button.tsx"`. This could cause false positives. A more robust check would use path basename matching or exact path segment matching.
  - Returns `undefined` if no match found — the caller handles this with `if (!pageNode) continue` at line 31.

---

## Lines 141-156: `findMatchingExport(importNode, exportIndex)`
```
function findMatchingExport(importNode, exportIndex) {
    const candidates = exportIndex[importNode.name];
    if (!candidates || candidates.length === 0) return null;
    for (const candidate of candidates) {
        if (importNode.path && candidate.path && candidate.path === importNode.path) {
            return { node: candidate, exactPathMatch: true };
        }
    }
    return { node: candidates[0], exactPathMatch: false };
}
```
- **What this section does:** Searches for a matching export by name in the current graph's export index. Prefers exact path match, falls back to first name match.
- **What triggers it:** Called at line 43 in the import processing loop.
- **What it calls:** None (array iteration).
- **What calls it:** `analyzeRelationships` line 43.
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 155:** When no exact path match exists, returns `candidates[0]` — the FIRST export with a matching name. This is **non-deterministic** — the result depends on the order nodes were added to the graph. If multiple exports share a name, different runs could produce different matches.
  - If `importNode.path` is undefined, the exact path match loop at line 150 will always skip (since `importNode.path` is falsy), and it'll return the first candidate as a non-exact match.

---

## Lines 157-172: `classifyDependency(importNode, match)`
```
function classifyDependency(importNode, match) {
    if (!match) return types_js_1.DependencyStatus.MISSING;
    if (hasSignatureMismatch(importNode, match.node)) return types_js_1.DependencyStatus.CONFLICT;
    if (match.exactPathMatch) return types_js_1.DependencyStatus.SAFE;
    return types_js_1.DependencyStatus.NEEDS_REWRITE;
}
```
- **What this section does:** Classifies a dependency into one of 4 statuses based on match results and signature compatibility.
- **What triggers it:** Called at line 45 in the import processing loop.
- **What it calls:** `hasSignatureMismatch(importNode, match.node)` → line 176.
- **What calls it:** `analyzeRelationships` line 45.
- **Dependencies:** `DependencyStatus` enum from `types.js`, `hasSignatureMismatch` (line 176).
- **Status:** ✅ WORKING
- **Gap:** The classification priority is: MISSING > CONFLICT > SAFE > NEEDS_REWRITE. A signature mismatch overrides a path match — so even if paths match exactly, a type mismatch makes it CONFLICT. This seems intentional but is undocumented.

---

## Lines 173-194: `hasSignatureMismatch(importNode, exportNode)`
```
function hasSignatureMismatch(importNode, exportNode) {
    const importMeta = importNode.metadata;
    const exportMeta = exportNode.metadata;
    if (!importMeta || !exportMeta) return false;
    if (importMeta['signature'] && exportMeta['signature']) {
        return importMeta['signature'] !== exportMeta['signature'];
    }
    if (importMeta['returnType'] && exportMeta['returnType']) {
        return importMeta['returnType'] !== exportMeta['returnType'];
    }
    if (importMeta['paramCount'] !== undefined && exportMeta['paramCount'] !== undefined) {
        return importMeta['paramCount'] !== exportMeta['paramCount'];
    }
    return false;
}
```
- **What this section does:** Heuristic check for type/signature mismatch between import expectation and export reality. Checks signature string, return type, and parameter count in priority order.
- **What triggers it:** Called at line 45 (via `classifyDependency`) and line 229 (in `detectConflicts`).
- **What it calls:** None (property comparisons).
- **What calls it:** `classifyDependency` (line 164), `detectConflicts` (line 229).
- **Dependencies:** `metadata` property on nodes.
- **Status:** ⚠️ PARTIAL
- **Gap:**
  - **Line 179:** If either node lacks `metadata`, returns `false` (no mismatch). This means nodes without metadata are ALWAYS considered compatible — even if one has metadata and the other doesn't. A more robust approach would return `true` (mismatch) when one has metadata and the other doesn't.
  - **Lines 182-183:** Signature comparison is exact string equality. Two semantically equivalent signatures with different whitespace or ordering would be flagged as mismatched (e.g., `"(a: string, b: number)"` vs `"(a:string,b:number)"`).
  - **Lines 186-187:** Return type comparison is exact string equality — same issue with whitespace/formatting.
  - **Lines 190-192:** Parameter count comparison only checks the count, not the types. `f(a: string)` and `f(b: number)` have the same count but different signatures.

---

## Lines 195-309: `detectConflicts(importNode, match, pageNode, currentImports, generateId)`

### Lines 198-212: MISSING_DEPENDENCY Conflict
```
if (!match) {
    detected.push({
        id: generateId(),
        type: types_js_1.ConflictType.MISSING_DEPENDENCY,
        item: importNode.name,
        description: `Import "${importNode.name}" from "${importNode.path || 'unknown'}" has no matching export in the current project.`,
        resolutionOptions: [types_js_1.ResolutionStrategy.IGNORE, types_js_1.ResolutionStrategy.CUSTOM],
        recommended: types_js_1.ResolutionStrategy.IGNORE
    });
    return detected;
}
```
- **What this section does:** If no matching export was found, generates a MISSING_DEPENDENCY conflict and returns early.
- **What triggers it:** `match` being null/falsy.
- **What calls it:** `analyzeRelationships` line 80.
- **Dependencies:** `ConflictType.MISSING_DEPENDENCY`, `ResolutionStrategy.IGNORE`, `ResolutionStrategy.CUSTOM` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:** The early `return` at line 211 means no further conflict checks run for missing dependencies. This is correct — you can't have type mismatches or circular dependencies with a non-existent export.

### Lines 213-227: NAME_COLLISION Conflict
```
if (!match.exactPathMatch && hasMetadataDifference(importNode, match.node)) {
    detected.push({
        id: generateId(),
        type: types_js_1.ConflictType.NAME_COLLISION,
        ...
        resolutionOptions: [types_js_1.ResolutionStrategy.RENAME, types_js_1.ResolutionStrategy.MERGE, types_js_1.ResolutionStrategy.OVERWRITE],
        recommended: types_js_1.ResolutionStrategy.RENAME,
        details: { externalPath: importNode.path, currentPath: match.node.path }
    });
}
```
- **What this section does:** If the match is by name only (not exact path) AND the metadata differs meaningfully, generates a NAME_COLLISION conflict.
- **What triggers it:** `!match.exactPathMatch && hasMetadataDifference(...)` being true.
- **What it calls:** `hasMetadataDifference(importNode, match.node)` → line 314.
- **What calls it:** `detectConflicts` at line 214.
- **Dependencies:** `hasMetadataDifference` (line 314), `ConflictType.NAME_COLLISION` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:** No early return — NAME_COLLISION is additive. Multiple conflict types can be detected for the same import.

### Lines 228-242: TYPE_MISMATCH Conflict
```
if (hasSignatureMismatch(importNode, match.node)) {
    detected.push({
        id: generateId(),
        type: types_js_1.ConflictType.TYPE_MISMATCH,
        ...
        details: {
            expectedSignature: importNode.metadata?.['signature'],
            actualSignature: match.node.metadata?.['signature']
        }
    });
}
```
- **What this section does:** If signature mismatch is detected, generates a TYPE_MISMATCH conflict with expected vs actual signatures.
- **What triggers it:** `hasSignatureMismatch(importNode, match.node)` returning true.
- **What it calls:** `hasSignatureMismatch` (line 176).
- **What calls it:** `detectConflicts` at line 229.
- **Dependencies:** `hasSignatureMismatch` (line 176), `ConflictType.TYPE_MISMATCH` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:** **Lines 238-239:** Uses TypeScript-compiled optional chaining (`(_a = importNode.metadata) === null || _a === void 0 ? void 0 : _a['signature']`). If `metadata` is null, `expectedSignature` will be `undefined`. The conflict description at line 234 says "incompatible type signature" but the `details` might have `undefined` values — making the conflict less informative.

### Lines 243-262: CIRCULAR_DEPENDENCY — Direct Cycle Detection
```
if (pageNode.path && currentImports.has(pageNode.path)) {
    const circularNames = currentImports.get(pageNode.path);
    if (circularNames.size > 0) {
        detected.push({
            ...
            type: types_js_1.ConflictType.CIRCULAR_DEPENDENCY,
            details: {
                externalFile: pageNode.path,
                circularImports: Array.from(circularNames),
                cycleType: 'direct'
            }
        });
    }
}
```
- **What this section does:** Checks for direct circular dependencies — if the current project already imports from the page node's path, there's a direct 2-node cycle (A imports B, B imports A).
- **What triggers it:** `pageNode.path` existing AND being present in `currentImports` map.
- **What it calls:** `currentImports.get(pageNode.path)` (Map lookup).
- **What calls it:** `detectConflicts` at line 245.
- **Dependencies:** `currentImports` map built at line 23, `ConflictType.CIRCULAR_DEPENDENCY` from `types.js`.
- **Status:** ⚠️ PARTIAL
- **Gap:**
  - **Line 247:** `if (circularNames.size > 0)` — This checks if the current project imports ANYTHING from the page's path. But it doesn't check if those imports are actually the same symbol that's being imported here. This could **false-positive**: if the current project imports `"utils"` from `"./utils.ts"` and the external page also imports something from `"./utils.ts"`, it would flag as circular even if the actual import chains don't form a cycle.
  - The detection only checks if `pageNode.path` is in `currentImports` — it doesn't verify that the import chain actually leads back to the page. This is a heuristic, not a true cycle detection.

### Lines 263-306: CIRCULAR_DEPENDENCY — Multi-Step Cycle Detection
```
if (importNode.path) {
    const visited = new Set();
    const cycleNodes = [];
    let currentPath = importNode.path;
    while (currentPath && !visited.has(currentPath)) {
        visited.add(currentPath);
        cycleNodes.push(currentPath);
        const importsFromCurrent = currentImports.get(currentPath);
        if (!importsFromCurrent) break;
        let foundCycle = false;
        for (const importedName of importsFromCurrent) {
            if (importedName === importNode.name || importedName === importNode.path) {
                foundCycle = true;
                break;
            }
        }
        if (foundCycle && cycleNodes.length > 2) {
            detected.push({ ... cycleType: 'multi-step' ... });
            break;
        }
        currentPath = undefined;
        if (importsFromCurrent.size > 0) {
            currentPath = Array.from(importsFromCurrent)[0];
        }
    }
}
```
- **What this section does:** Attempts to detect multi-step cycles (A → B → C → A) by walking the import chain. Starts at `importNode.path` and follows imports, checking if any import name/path points back to the original import.
- **What triggers it:** `importNode.path` being truthy.
- **What it calls:** `currentImports.get()` (Map lookups).
- **What calls it:** `detectConflicts` at line 265.
- **Dependencies:** `currentImports` map, `ConflictType.CIRCULAR_DEPENDENCY` from `types.js`.
- **Status:** ⚠️ PARTIAL — has significant logic issues
- **Gap:**
  - **BUG — Line 304:** `currentPath = Array.from(importsFromCurrent)[0]` — This ALWAYS follows only the **first** import in the Set. Set iteration order in JavaScript is insertion order, so this is deterministic but **non-exhaustive**. If the cycle is on the second or third branch, it will be missed entirely. The detection is path-dependent and can miss valid cycles.
  - **BUG — Line 284:** `if (foundCycle && cycleNodes.length > 2)` — A 2-node cycle (A → B → A) would have `cycleNodes = [A, B]` (length 2), which does NOT pass the `> 2` check. Two-node cycles from this multi-step detector are **always missed**. The direct cycle check at lines 245-262 partially compensates, but only for the specific case where `pageNode.path` is in `currentImports`.
  - **BUG — Line 279:** `if (importedName === importNode.name || importedName === importNode.path)` — `importedName` is a symbol name (e.g., `"useState"`), while `importNode.path` is a file path (e.g., `"react/index.ts"`). Comparing a symbol name to a file path will almost never match, making the `importedName === importNode.path` check effectively dead code in most cases.
  - **Line 302:** `currentPath = undefined;` before the conditional — if `importsFromCurrent.size === 0`, the loop ends. This is correct termination.
  - **No visited check for the target:** The `visited` set prevents revisiting nodes in the chain, but the check at line 279 doesn't use `visited` — it checks name/path equality instead of checking if we've returned to a visited node. True cycle detection would check `visited.has(importedName)` or similar.

### Lines 307-309: Return from `detectConflicts`
```
return detected;
```
- **What this section does:** Returns all detected conflicts for this import.
- **Status:** ✅ WORKING
- **Gap:** None.

---

## Lines 310-383: `hasMetadataDifference(nodeA, nodeB)`

### Lines 314-318: Null Metadata Guard
```
if (!nodeA.metadata && !nodeB.metadata) return false;
if (!nodeA.metadata || !nodeB.metadata) return true;
```
- **What this section does:** If both nodes lack metadata, they're not "different" (returns false). If only one has metadata, they ARE different (returns true).
- **What triggers it:** Called at line 214 in `detectConflicts` and line 164 in `classifyDependency` (via `hasSignatureMismatch` which is a different function — `hasMetadataDifference` is only called at line 214).
- **Status:** ✅ WORKING
- **Gap:** None — this is a reasonable heuristic.

### Lines 319-333: Structural Subtyping Check for Signatures
```
if (metaA['signature'] || metaB['signature']) {
    const sigA = parseSignatureFromMetadata(metaA);
    const sigB = parseSignatureFromMetadata(metaB);
    if (sigA && sigB) {
        const subtypeResult = analyzeStructuralSubtyping(sigA, sigB);
        if (!subtypeResult.compatible || subtypeResult.breakingChanges.length > 0) {
            return true;
        }
        return false;
    }
}
```
- **What this section does:** If either node has a signature, parses both into structured form and runs structural subtyping analysis. If incompatible or has breaking changes, they're "different."
- **What triggers it:** Either metadata having a `signature` property.
- **What it calls:**
  - `parseSignatureFromMetadata(meta)` → line 388
  - `analyzeStructuralSubtyping(sigA, sigB)` → line 421
- **What calls it:** `hasMetadataDifference` at line 322.
- **Dependencies:** `parseSignatureFromMetadata` (line 388), `analyzeStructuralSubtyping` (line 421).
- **Status:** ✅ WORKING
- **Gap:** If only one signature parses successfully (one is null), the code falls through to the parameter count check at line 335. This is reasonable but could be more explicit.

### Lines 334-348: Parameter Count Check with Optional Param Awareness
```
if (metaA['paramCount'] !== undefined && metaB['paramCount'] !== undefined) {
    if (metaA['paramCount'] !== metaB['paramCount']) {
        const paramTypesA = metaA['paramTypes'] || [];
        const paramTypesB = metaB['paramTypes'] || [];
        const maxLen = Math.max(paramTypesA.length, paramTypesB.length);
        const minLen = Math.min(paramTypesA.length, paramTypesB.length);
        const extraParams = maxLen > paramTypesA.length ? paramTypesB.slice(minLen) : paramTypesA.slice(minLen);
        const allOptional = extraParams.every(p => p.includes('?') || p.includes('undefined'));
        if (!allOptional) return true;
    }
}
```
- **What this section does:** If parameter counts differ, checks whether the extra parameters are all optional (containing `?` or `undefined`). If they are, it's not considered a breaking difference.
- **What triggers it:** Both nodes having `paramCount` in metadata and the counts differing.
- **What calls it:** `hasMetadataDifference` at line 335.
- **Dependencies:** None.
- **Status:** ⚠️ PARTIAL
- **Gap:**
  - **Line 343:** The condition `maxLen > paramTypesA.length` determines which array has extras. But `paramTypesA.length` and `metaA['paramCount']` could differ — `paramCount` might be 5 but `paramTypes` array might have only 2 entries. The code uses `paramTypes` array length, not `paramCount`, which could lead to incorrect comparison.
  - **Line 344:** `p.includes('?')` matches `?` ANYWHERE in the type string. A type like `Record<string, any?>` or `ConditionalType<T, never?>` would incorrectly be flagged as optional. The check should use a regex like `/^[^?]*\?$/` to only match trailing `?`.
  - **Line 344:** `p.includes('undefined')` — A type like `undefined[]` or `Result<undefined, Error>` would incorrectly be flagged as optional.

### Lines 349-354: Return Type Compatibility Check
```
if (metaA['returnType'] && metaB['returnType']) {
    if (!isReturnTypeCompatible(metaA['returnType'], metaB['returnType'])) {
        return true;
    }
}
```
- **What this section does:** Checks return type compatibility using the `isReturnTypeCompatible` function.
- **What triggers it:** Both nodes having `returnType` in metadata.
- **What it calls:** `isReturnTypeCompatible(metaA['returnType'], metaB['returnType'])` → line 545.
- **Status:** ✅ WORKING
- **Gap:** None.

### Lines 355-361: Type Parameters (Generics) Check
```
if (metaA['typeParams'] && metaB['typeParams']) {
    const tpA = Array.isArray(metaA['typeParams']) ? metaA['typeParams'] : [];
    const tpB = Array.isArray(metaB['typeParams']) ? metaB['typeParams'] : [];
    if (tpA.length !== tpB.length) return true;
}
```
- **What this section does:** If both nodes have generic type parameters, checks if the count differs.
- **What triggers it:** Both nodes having `typeParams` in metadata.
- **Status:** ✅ WORKING
- **Gap:** Only checks count, not the actual type parameter constraints. `<T extends string>` vs `<T extends number>` would not be flagged.

### Lines 362-382: Deep Metadata Key Comparison
```
const keysA = Object.keys(metaA).filter(k => k !== 'projectPath' && k !== 'sourceFile');
const keysB = Object.keys(metaB).filter(k => k !== 'projectPath' && k !== 'sourceFile');
if (Math.abs(keysA.length - keysB.length) > 3) return true;
const sharedKeys = keysA.filter(k => k in metaB);
let differenceScore = 0;
for (const key of sharedKeys) {
    const valA = metaA[key];
    const valB = metaB[key];
    if (valA === valB) continue;
    if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        differenceScore++;
    }
}
return sharedKeys.length > 0 && (differenceScore / sharedKeys.length) > 0.3;
```
- **What this section does:** Compares all metadata keys (excluding `projectPath` and `sourceFile`) between nodes. If key count differs by > 3, they're different. Otherwise, computes a difference score — if > 30% of shared keys differ, they're considered different.
- **What triggers it:** Fallthrough from all previous checks.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 366:** Magic number `3` — threshold for key count difference. No documentation for why 3.
  - **Line 382:** Magic number `0.3` (30%) — threshold for difference score. No documentation. This means up to 30% of metadata can differ without being flagged as "different." This is a design decision but is arbitrary.
  - **Line 377:** `JSON.stringify(valA) !== JSON.stringify(valB)` — JSON comparison is order-dependent for objects: `{a: 1, b: 2}` !== `{b: 2, a: 1}`. This could false-positive on equivalent objects with different key ordering.
  - **Line 369:** `keysA.filter(k => k in metaB)` — uses `in` operator which checks prototype chain. `hasOwnProperty` would be more precise.

---

## Lines 384-416: `parseSignatureFromMetadata(meta)` (I-13 Tier 3)
```
function parseSignatureFromMetadata(meta) {
    const sig = meta['signature'];
    if (!sig || typeof sig !== 'string') return null;
    const params = [];
    const paramTypes = meta['paramTypes'] || [];
    const paramCount = meta['paramCount'] || 0;
    for (let i = 0; i < paramCount; i++) {
        const typeStr = paramTypes[i] || 'any';
        const isOptional = typeStr.includes('?') || typeStr.includes('undefined');
        const isRest = typeStr.startsWith('...');
        params.push({
            name: `param${i}`,
            type: typeStr.replace(/^\.\.\.|[?]$/g, ''),
            optional: isOptional,
            rest: isRest,
        });
    }
    return {
        name: meta['name'] || 'anonymous',
        params,
        returnType: meta['returnType'] || 'void',
        typeParams: meta['typeParams'] || [],
        isAsync: sig.includes('async') || meta['returnType']?.includes('Promise'),
        isGenerator: sig.includes('*') || sig.includes('Generator'),
    };
}
```
- **What this section does:** Parses a function signature string from node metadata into a structured `Signature` object with params, return type, type params, and async/generator flags.
- **What triggers it:** Called at line 324 in `hasMetadataDifference` and line 637-638 in `detectBreakingChanges`.
- **What it calls:** None (pure parsing).
- **What calls it:** `hasMetadataDifference` (line 323-324), `detectBreakingChanges` (line 637-638).
- **Dependencies:** None.
- **Status:** ⚠️ PARTIAL
- **Gap:**
  - **Line 399:** `isOptional = typeStr.includes('?')` — Same bug as line 344. Matches `?` ANYWHERE in the type string, not just as an optional marker. `Map<string, number?>` would trigger this.
  - **Line 399:** `typeStr.includes('undefined')` — Matches `undefined` ANYWHERE. `undefined[]` or `Result<undefined, Error>` would incorrectly flag as optional.
  - **Line 403:** `type: typeStr.replace(/^\.\.\.|[?]$/g, '')` — The regex `[?]$` only strips trailing `?`. But `isOptional` was set by checking for `?` ANYWHERE. So `Map<string, number?>` would have `isOptional = true` but the type would become `Map<string, number?` (stripping nothing since `?` isn't at the end) or `Map<string, number>` (if the `?` was at the end). This inconsistency between detection and stripping is a bug.
  - **Line 398:** `const typeStr = paramTypes[i] || 'any'` — If `paramTypes` array is shorter than `paramCount`, missing params default to `'any'`. This is a reasonable fallback but masks potential data issues.
  - **Line 402:** `name: \`param${i}\`` — Generated parameter names (`param0`, `param1`, etc.) don't reflect actual parameter names from the source. This means signature comparison can't check parameter name compatibility.
  - **Line 413:** `isAsync: sig.includes('async') || meta['returnType']?.includes('Promise')` — TypeScript-compiled optional chain. Could false-positive on types like `PromiseLike` or `NonPromise` (contains "Promise" substring).
  - **Line 414:** `isGenerator: sig.includes('*') || sig.includes('Generator')` — Could false-positive on comments or strings containing `*` or `Generator`.

---

## Lines 417-539: `analyzeStructuralSubtyping(source, target)` (I-13 Tier 3)

### Lines 421-425: Function Signature & Setup
```
function analyzeStructuralSubtyping(source, target) {
    const paramCompatibility = [];
    const breakingChanges = [];
    const maxParams = Math.max(source.params.length, target.params.length);
```
- **What this section does:** Initializes result arrays and computes the maximum parameter count for iteration.
- **What triggers it:** Called at line 326 in `hasMetadataDifference` and line 640 in `detectBreakingChanges`.
- **What calls it:** `hasMetadataDifference` (line 326), `detectBreakingChanges` (line 640).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** None.

### Lines 426-491: Parameter Analysis Loop (Contravariant)
```
for (let i = 0; i < maxParams; i++) {
    const sourceParam = source.params[i];
    const targetParam = target.params[i];
    if (!sourceParam && targetParam) {
        // Target has extra param
        if (!targetParam.optional && !targetParam.rest) {
            breakingChanges.push({ kind: 'added-required-param', severity: 'breaking', ... });
        } else {
            paramCompatibility.push({ compatible: true, reason: 'Optional parameter added (non-breaking)', ... });
        }
    } else if (sourceParam && !targetParam) {
        // Source has param that target removed
        breakingChanges.push({ kind: 'removed-param', severity: 'breaking', ... });
    } else if (sourceParam && targetParam) {
        // Both have param — check contravariant compatibility
        const typeCompat = isTypeAssignable(sourceParam.type, targetParam.type);
        if (!typeCompat && !targetParam.optional) {
            breakingChanges.push({ kind: 'type-narrowed', severity: 'breaking', ... });
        }
    }
}
```
- **What this section does:** Compares parameters positionally. Handles 3 cases: extra target params, removed target params, and type compatibility. Implements contravariant parameter checking.
- **What triggers it:** The for loop at line 426.
- **What it calls:** `isTypeAssignable(sourceParam.type, targetParam.type)` → line 584.
- **What calls it:** `analyzeStructuralSubtyping` at line 426.
- **Dependencies:** `isTypeAssignable` (line 584).
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 474:** `isTypeAssignable(sourceParam.type, targetParam.type)` — Checks if source type is assignable to target type. See bug analysis at line 595 below.
  - The positional comparison assumes parameters are in the same order. TypeScript supports named parameters and destructured params which wouldn't be captured here.

### Lines 492-501: Return Type Analysis (Covariant)
```
const returnTypeCompatible = isReturnTypeCompatible(source.returnType, target.returnType);
if (!returnTypeCompatible) {
    breakingChanges.push({ kind: 'return-type-changed', severity: 'breaking', ... });
}
```
- **What this section does:** Checks return type compatibility using covariant rules. Incompatible return types are breaking changes.
- **What triggers it:** After parameter loop completes.
- **What it calls:** `isReturnTypeCompatible(source.returnType, target.returnType)` → line 545.
- **Status:** ✅ WORKING
- **Gap:** None.

### Lines 502-510: Generic Type Parameter Analysis
```
if (source.typeParams.length !== target.typeParams.length) {
    breakingChanges.push({ kind: 'generic-constraint-added', severity: 'warning', ... });
}
```
- **What this section does:** If generic type parameter counts differ, adds a WARNING-level breaking change (not 'breaking' severity).
- **Status:** ✅ WORKING
- **Gap:** Only checks count, not constraints. `<T extends string>` vs `<T extends number>` would not be detected.

### Lines 511-519: Async/Sync Change Detection
```
if (source.isAsync !== target.isAsync) {
    breakingChanges.push({ kind: 'async-changed', severity: 'breaking', ... });
}
```
- **What this section does:** If async status changed, it's a breaking change.
- **Status:** ✅ WORKING
- **Gap:** None.

### Lines 520-539: Variance Direction & Return
```
let direction = 'invariant';
const allParamsCompat = paramCompatibility.every(p => p.compatible);
if (allParamsCompat && returnTypeCompatible) {
    direction = 'covariant';
} else if (allParamsCompat && !returnTypeCompatible) {
    direction = 'contravariant';
} else if (!allParamsCompat && returnTypeCompatible) {
    direction = 'contravariant';
}
const compatible = breakingChanges.filter(c => c.severity === 'breaking').length === 0;
return { compatible, direction, paramCompatibility, returnTypeCompatible, breakingChanges };
```
- **What this section does:** Determines overall variance direction and whether the signatures are compatible (no breaking changes).
- **Status:** ✅ WORKING
- **Gap:**
  - **Lines 521-531:** The variance direction logic is simplified:
    - Both compatible → covariant (correct)
    - Params compat, return not → contravariant (questionable — this means the source is a subtype in parameter position but NOT in return position, which is more accurately "mixed")
    - Params not compat, return compat → contravariant (same issue)
    - Neither compat → invariant (correct)
  - **Line 532:** `compatible = breakingChanges.filter(c => c.severity === 'breaking').length === 0` — Only 'breaking' severity counts. 'warning' severity changes (like generic constraint changes at line 506) don't affect compatibility. This is intentional but means some changes are reported but don't block.

---

## Lines 540-580: `isReturnTypeCompatible(sourceType, targetType)`

```
function isReturnTypeCompatible(sourceType, targetType) {
    if (!sourceType || !targetType) return true;
    if (sourceType === targetType) return true;
    const src = sourceType.trim().toLowerCase();
    const tgt = targetType.trim().toLowerCase();
    if (src === 'any' || tgt === 'any' || tgt === 'unknown') return true;
    if ((src === 'void' && tgt === 'undefined') || (src === 'undefined' && tgt === 'void')) return true;
    if (src === 'never') return true;
    // Promise<X> compatible with Promise<Y> if X compatible with Y
    const srcPromise = src.match(/^promise<(.+)>$/);
    const tgtPromise = tgt.match(/^promise<(.+)>$/);
    if (srcPromise && tgtPromise) {
        return isReturnTypeCompatible(srcPromise[1], tgtPromise[1]);
    }
    // Union types: source is assignable if it's a subset of target union
    if (tgt.includes('|')) {
        const targetUnion = tgt.split('|').map(t => t.trim());
        return targetUnion.includes(src);
    }
    // null/undefined assignable to nullable types
    if ((src === 'null' || src === 'undefined') && tgt.includes('null')) return true;
    // Array compatibility
    if (src.endsWith('[]') && tgt.endsWith('[]')) {
        return isReturnTypeCompatible(src.slice(0, -2), tgt.slice(0, -2));
    }
    return src === tgt;
}
```
- **What this section does:** Checks if a source return type is assignable to a target return type (covariant). Implements TypeScript-style type assignability heuristics.
- **What triggers it:** Called at line 351 in `hasMetadataDifference` and line 493 in `analyzeStructuralSubtyping`.
- **What calls it:** `hasMetadataDifference` (line 351), `analyzeStructuralSubtyping` (line 493).
- **Dependencies:** None (recursive).
- **Status:** ⚠️ PARTIAL
- **Gap:**
  - **Line 547:** `if (!sourceType || !targetType) return true` — If either type is falsy (empty string, null, undefined), returns true (compatible). An empty string type is treated as compatible with anything. This could mask data quality issues.
  - **Line 553:** `if (src === 'any' || tgt === 'any' || tgt === 'unknown') return true` — Makes `unknown` compatible only as a TARGET type (correct — `T` is assignable to `unknown`). But does NOT handle `src === 'unknown'` — in TypeScript, `unknown` is NOT assignable to most types. This is correct for covariant return checking.
  - **Line 562:** `src.match(/^promise<(.+)>$/)` — Uses greedy `(.+)` which would match nested generics incorrectly. `Promise<Map<string, number>>` would capture `Map<string, number>` correctly, but `Promise<A> | Promise<B>` would not match (correct — handled by union check below).
  - **Line 568-570:** `if (tgt.includes('|'))` — Union type check. Splits on `|` and checks if source is in the union. BUT: `string | number` split by `|` gives `['string', 'number']` which works. However, `Map<string, number> | null` split by `|` gives `['Map<string, number>', ' null']` — the space before `null` is trimmed by `.map(t => t.trim())` so this works. But `(string | number) | null` would incorrectly split the parenthesized union.
  - **Line 573:** `if ((src === 'null' || src === 'undefined') && tgt.includes('null'))` — `tgt.includes('null')` would also match `Nullable<T>` or `nullish` or any type containing "null" as a substring. Should be `tgt === 'null' || tgt.includes('|null') || tgt.includes('null|')`.
  - **Line 576-578:** Array compatibility — only handles `T[]` syntax, not `Array<T>` generic syntax.

---

## Lines 581-609: `isTypeAssignable(sourceType, targetType)`

```
function isTypeAssignable(sourceType, targetType) {
    if (!sourceType || !targetType) return true;
    if (sourceType === targetType) return true;
    const src = sourceType.trim().toLowerCase();
    const tgt = targetType.trim().toLowerCase();
    if (src === 'any' || tgt === 'any') return true;
    if (src === 'unknown') return true;
    if (tgt.includes('|')) {
        const targetUnion = tgt.split('|').map(t => t.trim());
        if (targetUnion.includes(src)) return true;
    }
    if (src.includes('|')) {
        const sourceUnion = src.split('|').map(t => t.trim());
        const targetUnion = tgt.includes('|') ? tgt.split('|').map(t => t.trim()) : [tgt];
        return sourceUnion.every(s => targetUnion.includes(s));
    }
    return src === tgt;
}
```
- **What this section does:** Checks if source type is assignable to target type for PARAMETER positions (contravariant). The logic is similar to `isReturnTypeCompatible` but with different semantics.
- **What triggers it:** Called at line 474 in `analyzeStructuralSubtyping`.
- **What calls it:** `analyzeStructuralSubtyping` (line 474).
- **Dependencies:** None.
- **Status:** ❌ BROKEN — contains a semantic bug
- **Gap:**
  - **BUG — Line 595:** `if (src === 'unknown') return true` — This makes `unknown` assignable to ANYTHING as a parameter source. In TypeScript, `unknown` is the TOP type — it is NOT assignable to anything except `unknown` and `any`. The correct behavior would be `if (src === 'unknown' && (tgt === 'unknown' || tgt === 'any')) return true;` or simply `if (src === 'unknown') return false;` (since `unknown` can't be assigned to specific types). This bug makes parameter type checking **too permissive** — it would incorrectly mark `unknown → string` as compatible, when it should be a breaking change.
  - **Line 586:** Same empty-string guard as `isReturnTypeCompatible` — empty types are treated as compatible.
  - **Lines 599-603:** Union type handling for target — same parenthesized union issue as line 568.
  - **Lines 604-608:** Union type handling for source — checks that ALL source union members are in the target union. This is correct for contravariant parameter checking (source must be a subset of target).

---

## Lines 610-644: `detectBreakingChanges(previousExports, currentExports)` (I-13 Tier 3)

```
function detectBreakingChanges(previousExports, currentExports) {
    const changes = [];
    const prevByName = new Map(previousExports.map(n => [n.name, n]));
    const currByName = new Map(currentExports.map(n => [n.name, n]));
    for (const [name, prevNode] of prevByName) {
        if (!currByName.has(name)) {
            changes.push({ kind: 'removed-param', severity: 'breaking', affectedSymbol: name });
        }
    }
    for (const [name, currNode] of currByName) {
        const prevNode = prevByName.get(name);
        if (!prevNode) continue;
        const prevSig = parseSignatureFromMetadata(prevNode.metadata || {});
        const currSig = parseSignatureFromMetadata(currNode.metadata || {});
        if (prevSig && currSig) {
            const result = analyzeStructuralSubtyping(prevSig, currSig);
            changes.push(...result.breakingChanges);
        }
    }
    return changes;
}
```
- **What this section does:** Detects breaking changes between two versions of a module's public API. Checks for removed exports and signature changes in existing exports.
- **What triggers it:** **NOTHING externally** — this function is exported (line 7) but has ZERO callers in the entire codebase. It's only reachable if another file explicitly imports and calls it.
- **What it calls:**
  - `parseSignatureFromMetadata` (line 388) — twice per export
  - `analyzeStructuralSubtyping` (line 421) — once per matching export pair
- **What calls it:** NO external callers. Dead export.
- **Dependencies:** `parseSignatureFromMetadata` (line 388), `analyzeStructuralSubtyping` (line 421).
- **Status:** ⚠️ NOT CONNECTED — exported but never consumed
- **Gap:**
  - This function has no external callers — it's utility code that was likely intended for version migration or API diffing but was never wired up.
  - **Line 621:** Removed exports use kind `'removed-param'` which is misleading — it's not a removed parameter, it's a removed export. Should have its own kind like `'removed-export'`.
  - **Lines 635-636:** `prevNode.metadata || {}` — Falls back to empty object if no metadata. `parseSignatureFromMetadata({})` will return `null` (since `meta['signature']` is undefined), so the `if (prevSig && currSig)` guard at line 639 handles this correctly.

---

## Lines 645-688: `computeGraphProperties(dependencyMap)`

```
function computeGraphProperties(dependencyMap) {
    const total = dependencyMap.length;
    if (total === 0) {
        return { reachability: 1, stability: 1, fragility: 0, integrationDistance: 0 };
    }
    let safeCount = 0, rewriteCount = 0, conflictCount = 0, missingCount = 0;
    for (const dep of dependencyMap) {
        switch (dep.status) {
            case DependencyStatus.SAFE: safeCount++; break;
            case DependencyStatus.NEEDS_REWRITE: rewriteCount++; break;
            case DependencyStatus.CONFLICT: conflictCount++; break;
            case DependencyStatus.MISSING: missingCount++; break;
        }
    }
    const reachability = (safeCount + rewriteCount) / total;
    const stability = safeCount / total;
    const fragility = (conflictCount + missingCount) / total;
    const integrationDistance = rewriteCount + (conflictCount * 3) + (missingCount * 5);
    return { reachability, stability, fragility, integrationDistance };
}
```
- **What this section does:** Computes graph-level metrics from the dependency analysis:
  - `reachability`: Fraction of deps that are SAFE or NEEDS_REWRITE (0-1)
  - `stability`: Fraction of deps that are SAFE (0-1)
  - `fragility`: Fraction of deps that are CONFLICT or MISSING (0-1)
  - `integrationDistance`: Weighted score (rewrite=1, conflict=3, missing=5)
- **What triggers it:** Called at line 89 in `analyzeRelationships`.
- **What calls it:** `analyzeRelationships` (line 89).
- **Dependencies:** `DependencyStatus` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 652:** Empty dependency map returns `{ reachability: 1, stability: 1, fragility: 0, integrationDistance: 0 }`. This means "no dependencies" is treated as "perfectly reachable and stable." This is a reasonable default but could be misleading — if there are no dependencies, there's nothing to be "reachable."
  - **Lines 686:** Magic numbers for integrationDistance weights (rewrite=1, conflict=3, missing=5). No documentation for why these specific weights.

---

## Lines 689-699: `statusToConfidence(status)`

```
function statusToConfidence(status) {
    switch (status) {
        case DependencyStatus.SAFE: return 1.0;
        case DependencyStatus.NEEDS_REWRITE: return 0.7;
        case DependencyStatus.CONFLICT: return 0.3;
        case DependencyStatus.MISSING: return 0.0;
    }
}
```
- **What this section does:** Maps dependency status to a confidence score (0.0 to 1.0) for edge annotations in the unified graph.
- **What triggers it:** Called at lines 62 and 76 in `analyzeRelationships`.
- **What calls it:** `analyzeRelationships` (lines 62, 76).
- **Dependencies:** `DependencyStatus` from `types.js`.
- **Status:** ✅ WORKING
- **Gap:** No default case. If a new `DependencyStatus` value is added to the enum, this function would return `undefined` silently.

---

## Lines 700-707: `addNodeIfMissing(nodes, node)`

```
function addNodeIfMissing(nodes, node) {
    if (!nodes.some((n) => n.id === node.id)) {
        nodes.push(node);
    }
}
```
- **What this section does:** Adds a node to a collection only if no node with the same ID already exists. Prevents duplicates in the unified graph.
- **What triggers it:** Called at lines 34, 41, 66, 86 in `analyzeRelationships`.
- **What calls it:** `analyzeRelationships` (lines 34, 41, 66, 86).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** Uses `Array.some()` which is O(N) per call. For large graphs with many nodes, this could be slow. A Set-based approach would be O(1). Performance issue — out of scope.

---

## Lines 708-865: `computeTarjanSCC(graph)` (I-07)

### Lines 721-739: Adjacency List Construction
```
function computeTarjanSCC(graph) {
    const nodes = graph.nodes;
    const edges = graph.edges;
    const adjacency = new Map();
    const inDegreeMap = new Map();
    const outDegreeMap = new Map();
    for (const node of nodes) {
        adjacency.set(node.id, []);
        inDegreeMap.set(node.id, 0);
        outDegreeMap.set(node.id, 0);
    }
    for (const edge of edges) {
        const neighbors = adjacency.get(edge.from);
        if (neighbors) {
            neighbors.push(edge.to);
            outDegreeMap.set(edge.from, (outDegreeMap.get(edge.from) || 0) + 1);
            inDegreeMap.set(edge.to, (inDegreeMap.get(edge.to) || 0) + 1);
        }
    }
```
- **What this section does:** Builds adjacency list and degree maps from the graph's edge list. Initializes all nodes with empty neighbor lists.
- **What triggers it:** Called at line 891 in `detectCyclesWithTarjan`.
- **What calls it:** `detectCyclesWithTarjan` (line 891).
- **Dependencies:** `graph.nodes`, `graph.edges`.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 734:** `if (neighbors)` — If `edge.from` references a node ID that doesn't exist in the graph's node list, `adjacency.get(edge.from)` returns `undefined` and the edge is silently skipped. This could hide data integrity issues.
  - The adjacency list includes ALL edge types (IMPORTS, DEPENDS_ON, CONFLICTS_WITH, etc.) — not just dependency edges. This means non-dependency edges (like CONTAINS, CALLS) participate in cycle detection, which may or may not be desired.

### Lines 740-783: Tarjan's Core Algorithm (strongConnect)
```
let indexCounter = 0;
const nodeIndex = new Map();
const nodeLowlink = new Map();
const onStack = new Set();
const stack = [];
const sccs = [];

function strongConnect(nodeId) {
    nodeIndex.set(nodeId, indexCounter);
    nodeLowlink.set(nodeId, indexCounter);
    indexCounter++;
    stack.push(nodeId);
    onStack.add(nodeId);
    const successors = adjacency.get(nodeId) || [];
    for (const successor of successors) {
        if (!nodeIndex.has(successor)) {
            strongConnect(successor);
            nodeLowlink.set(nodeId, Math.min(nodeLowlink.get(nodeId), nodeLowlink.get(successor)));
        } else if (onStack.has(successor)) {
            nodeLowlink.set(nodeId, Math.min(nodeLowlink.get(nodeId), nodeIndex.get(successor)));
        }
    }
    if (nodeLowlink.get(nodeId) === nodeIndex.get(nodeId)) {
        const component = [];
        let w;
        do {
            w = stack.pop();
            onStack.delete(w);
            component.push(w);
        } while (w !== nodeId);
        sccs.push(component);
    }
}
```
- **What this section does:** Implements Tarjan's strongly connected components algorithm. Standard textbook implementation with DFS, index/lowlink tracking, stack management, and SCC extraction.
- **What triggers it:** Called by the DFS loop at line 785.
- **What calls it:** Recursive (self-calling) and the loop at line 785.
- **Dependencies:** `adjacency`, `nodeIndex`, `nodeLowlink`, `onStack`, `stack` (all local state).
- **Status:** ✅ WORKING — textbook-correct implementation
- **Gap:**
  - **Line 751:** `strongConnect` is recursive. For very large graphs with deep chains, this could cause a stack overflow. JavaScript engines typically have a call stack limit of ~10,000-25,000 frames. An iterative version with an explicit stack would be safer for large graphs. Performance/reliability concern.
  - The algorithm correctly handles: visited nodes (line 761), on-stack nodes (line 767), lowlink updates (lines 765, 769), and SCC extraction (lines 773-782).

### Lines 784-789: DFS Entry Point (Handles Disconnected Graphs)
```
for (const node of nodes) {
    if (!nodeIndex.has(node.id)) {
        strongConnect(node.id);
    }
}
```
- **What this section does:** Runs Tarjan's on all nodes, handling disconnected components.
- **Status:** ✅ WORKING
- **Gap:** None.

### Lines 790-830: SCC Post-Processing (Components, Break Points)
```
const components = [];
const nodeToSCC = new Map();
let sccId = 0;
for (const scc of sccs) {
    const isCycle = scc.length > 1;
    let weight = 0;
    for (const memberId of scc) {
        weight += (outDegreeMap.get(memberId) || 0);
        nodeToSCC.set(memberId, sccId);
    }
    const breakPoints = [];
    if (isCycle) {
        for (const memberId of scc) {
            const outDeg = outDegreeMap.get(memberId) || 0;
            const inDeg = inDegreeMap.get(memberId) || 0;
            const internalEdges = (adjacency.get(memberId) || []).filter(target => scc.includes(target)).length;
            breakPoints.push({
                nodeId: memberId, outDegree: outDeg, inDegree: inDeg,
                breakCost: internalEdges,
                recommendation: generateBreakRecommendation(memberId, inDeg, outDeg, internalEdges, nodes),
            });
        }
        breakPoints.sort((a, b) => a.breakCost - b.breakCost);
    }
    components.push({ id: sccId, members: scc, size: scc.length, weight, breakPoints });
    sccId++;
}
```
- **What this section does:** Processes each SCC: computes weight (sum of out-degrees), maps nodes to their SCC, computes break points for cycle SCCs (nodes whose removal would break the cycle), and sorts break points by cost.
- **What triggers it:** After Tarjan's algorithm completes.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 810:** `scc.includes(target)` — Array.includes() is O(N) per call, inside a loop over SCC members, inside a loop over all SCCs. For large SCCs this is O(N²). Performance issue — out of scope.
  - **Line 796:** `const isCycle = scc.length > 1` — An SCC with exactly 1 node is NOT a cycle (it's a single node with no self-loop, OR a node with a self-loop). However, Tarjan's algorithm puts self-loops in SCCs of size 1 only if the node has an edge to itself. The `size > 1` check correctly identifies multi-node cycles but misses self-loops. This is a design decision (self-loops are handled differently) but is undocumented.

### Lines 831-854: Condensation DAG Construction
```
const condensationEdges = [];
const condensationSeen = new Set();
for (const edge of edges) {
    const fromSCC = nodeToSCC.get(edge.from);
    const toSCC = nodeToSCC.get(edge.to);
    if (fromSCC !== undefined && toSCC !== undefined && fromSCC !== toSCC) {
        const key = `${fromSCC}_${toSCC}`;
        if (!condensationSeen.has(key)) {
            condensationSeen.add(key);
            condensationEdges.push({ fromSCC, toSCC, crossEdgeCount: 1 });
        } else {
            const existing = condensationEdges.find(e => e.fromSCC === fromSCC && e.toSCC === toSCC);
            if (existing) existing.crossEdgeCount++;
        }
    }
}
```
- **What this section does:** Builds the condensation DAG — edges between different SCCs. Tracks cross-edge counts between SCC pairs.
- **What triggers it:** After SCC post-processing.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 849:** `condensationEdges.find(...)` — Linear search inside a loop over all edges. For large graphs, this is O(E * C) where C is the number of condensation edges. The `condensationSeen` Set at line 839 already tracks seen pairs, so the `find` at line 849 is only reached for duplicate pairs. A Map keyed by `${fromSCC}_${toSCC}` would be O(1). Performance issue — out of scope.

### Lines 855-865: Summary Statistics & Return
```
const cycleComponents = components.filter(c => c.size > 1);
const largestComponentSize = components.reduce((max, c) => Math.max(max, c.size), 0);
return {
    components,
    condensationDAG: condensationEdges,
    totalCycles: cycleComponents.length,
    largestComponentSize,
    hasCycles: cycleComponents.length > 0,
};
```
- **What this section does:** Computes summary statistics and returns the complete SCC result.
- **Status:** ✅ WORKING
- **Gap:** None.

---

## Lines 866-885: `generateBreakRecommendation(nodeId, inDegree, outDegree, internalEdges, nodes)`

```
function generateBreakRecommendation(nodeId, inDegree, outDegree, internalEdges, nodes) {
    const node = nodes.find(n => n.id === nodeId);
    const name = node?.name || nodeId;
    if (internalEdges === 0) return `"${name}" has no internal cycle edges — already decoupled.`;
    if (internalEdges === 1 && outDegree <= 2) return `Break at "${name}" (low cost: only ${internalEdges} internal edge). Consider extracting an interface.`;
    if (inDegree > outDegree) return `"${name}" is a hub (${inDegree} incoming). Splitting this module would decouple dependents.`;
    if (outDegree > inDegree) return `"${name}" has many outgoing deps (${outDegree}). Consider dependency injection to break cycle.`;
    return `"${name}" has ${internalEdges} internal cycle edges. Refactoring may require extracting shared interfaces.`;
}
```
- **What this section does:** Generates a human-readable recommendation for breaking a cycle at a specific node. Uses heuristics based on degree and internal edge count.
- **What triggers it:** Called at line 816 during SCC post-processing.
- **What calls it:** `computeTarjanSCC` (line 816).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:**
  - **Line 870:** `nodes.find(n => n.id === nodeId)` — Linear search per node. Performance issue — out of scope.
  - **Line 871:** `node?.name || nodeId` — TypeScript-compiled optional chain. If node is not found, falls back to the ID string.
  - The recommendations are generic and don't account for the specific technology stack or project conventions.

---

## Lines 886-923: `detectCyclesWithTarjan(graph, generateConflictId)`

```
function detectCyclesWithTarjan(graph, generateConflictId) {
    const sccResult = computeTarjanSCC(graph);
    const conflicts = [];
    for (const component of sccResult.components) {
        if (component.size <= 1) continue;
        const memberNames = component.members.map(id => {
            const node = graph.nodes.find(n => n.id === id);
            return node?.name || id;
        });
        const bestBreak = component.breakPoints[0];
        conflicts.push({
            id: generateConflictId(),
            type: ConflictType.CIRCULAR_DEPENDENCY,
            item: memberNames.join(', '),
            description: `Strongly connected component with ${component.size} nodes: ${memberNames.slice(0, 5).join(' → ')}${component.size > 5 ? ' → ...' : ''}`,
            resolutionOptions: [ResolutionStrategy.IGNORE, ResolutionStrategy.CUSTOM],
            recommended: ResolutionStrategy.CUSTOM,
            details: {
                cycleType: 'tarjan-scc',
                componentId: component.id, members: component.members,
                memberNames, size: component.size, weight: component.weight,
                suggestedBreakPoint: bestBreak?.nodeId,
                breakCost: bestBreak?.breakCost,
                breakRecommendation: bestBreak?.recommendation,
            },
        });
    }
    return { sccResult, conflicts };
}
```
- **What this section does:** Convenience function that runs Tarjan's SCC and converts cycle components into conflict entries with detailed information and break recommendations.
- **What triggers it:** **NOTHING externally** — this function is exported (line 9) but has ZERO callers in the entire codebase.
- **What it calls:**
  - `computeTarjanSCC(graph)` → line 721
  - `graph.nodes.find(...)` → line 898 (per member)
- **What calls it:** NO external callers. Dead export.
- **Dependencies:** `computeTarjanSCC` (line 721), `ConflictType.CIRCULAR_DEPENDENCY` from `types.js`, `ResolutionStrategy` from `types.js`.
- **Status:** ⚠️ NOT CONNECTED — exported but never consumed
- **Gap:**
  - **Line 898:** `graph.nodes.find(n => n.id === id)` — Linear search per SCC member. For large SCCs, this is O(M * N) where M is members and N is total nodes.
  - **Line 906:** `memberNames.slice(0, 5).join(' → ')` — Truncates display to 5 members. Reasonable for readability.
  - **Line 901:** `component.breakPoints[0]` — Takes the lowest-cost break point (sorted at line 820). If `breakPoints` is empty (size-1 component, but we already filter those), `bestBreak` would be `undefined` — the optional chaining at lines 916-918 handles this.
  - This function duplicates some of the cycle detection logic that also exists in `detectConflicts` (lines 243-306). The `detectConflicts` version uses a simpler heuristic walk, while this function uses the full Tarjan's algorithm. They're never called together — `detectConflicts` is called from `analyzeRelationships`, while `detectCyclesWithTarjan` is never called.

---

## Lines 924: Source Map Reference
```
//# sourceMappingURL=relationshipAnalyzer.js.map
```
- **What this section does:** References the TypeScript source map file.
- **Status:** ✅ WORKING
- **Gap:** The `.map` file may or may not exist. If it does, it enables debugging back to the original TypeScript source.

---

## CONNECTIONS MAP

### What triggers relationship analysis?
| Caller | File | Line | Function Called |
|--------|------|------|-----------------|
| `integr8/index.js` | `lib/commands/integr8/index.js` | 80 | `analyzeRelationships(externalGraph, currentGraph, args.targetPages)` |

Only ONE caller exists. The `backgroundIndexer.js` and `graphBuilder.js` files call sub-components directly (like `ingestProjectData`), bypassing the relationship analyzer entirely.

### What other files get called?
| Line | Function Called | File | Status |
|------|----------------|------|--------|
| 10 | `require("./types.js")` | `types.js` (83 lines) | ✅ Exists |
| 101 | `indexExportsByName()` | Internal (line 101) | ✅ Working |
| 117 | `indexImportsBySource()` | Internal (line 117) | ✅ Working |
| 132 | `findPageNode()` | Internal (line 132) | ✅ Working |
| 144 | `findMatchingExport()` | Internal (line 144) | ✅ Working |
| 160 | `classifyDependency()` | Internal (line 160) | ✅ Working |
| 176 | `hasSignatureMismatch()` | Internal (line 176) | ⚠️ Partial |
| 198 | `detectConflicts()` | Internal (line 198) | ⚠️ Partial |
| 314 | `hasMetadataDifference()` | Internal (line 314) | ✅ Working |
| 388 | `parseSignatureFromMetadata()` | Internal (line 388) | ⚠️ Partial |
| 421 | `analyzeStructuralSubtyping()` | Internal (line 421) | ✅ Working |
| 545 | `isReturnTypeCompatible()` | Internal (line 545) | ⚠️ Partial |
| 584 | `isTypeAssignable()` | Internal (line 584) | ❌ Broken |
| 615 | `detectBreakingChanges()` | Internal (line 615) | ⚠️ Not Connected |
| 649 | `computeGraphProperties()` | Internal (line 649) | ✅ Working |
| 692 | `statusToConfidence()` | Internal (line 692) | ✅ Working |
| 703 | `addNodeIfMissing()` | Internal (line 703) | ✅ Working |
| 721 | `computeTarjanSCC()` | Internal (line 721) | ✅ Working |
| 869 | `generateBreakRecommendation()` | Internal (line 869) | ✅ Working |
| 890 | `detectCyclesWithTarjan()` | Internal (line 890) | ⚠️ Not Connected |

### What data flows out?
| Output | Format | Destination | Line |
|--------|--------|-------------|------|
| `{ unifiedGraph, conflicts, dependencyMap }` | JS object | `integr8/index.js` (line 80) | 96 |
| `unifiedGraph.nodes` | `SemanticNode[]` | Downstream: `pathGenerator.js`, `reportGenerator.js`, `databasePersister.js` | 92 |
| `unifiedGraph.edges` | `SemanticEdge[]` | Downstream: same as above | 93 |
| `unifiedGraph.properties` | `GraphProperties` | Downstream: same as above | 94 |
| `conflicts` | `ConflictResolution[]` | `pathGenerator.js:69` | 96 |
| `dependencyMap` | `DependencyMapping[]` | Internal use only (not consumed downstream) | 96 |

### Dead Exports (NOT CONNECTED)
| Function | Line | External Callers |
|----------|------|-----------------|
| `analyzeStructuralSubtyping` | 6, 421 | NONE (only internal calls at 326, 640) |
| `detectBreakingChanges` | 7, 615 | NONE |
| `computeTarjanSCC` | 8, 721 | NONE (only internal call at 891) |
| `detectCyclesWithTarjan` | 9, 890 | NONE |

---

## @@@ HANDLING

**No `@@@` symbols found** in this file.

---

## FINDINGS SUMMARY

### Critical Issues (BLOCKER)

1. **`isTypeAssignable` makes `unknown` assignable to everything (Line 595)**
   - `if (src === 'unknown') return true` — In TypeScript, `unknown` is NOT assignable to specific types. This makes parameter type checking too permissive and would incorrectly mark `unknown → string` as compatible.
   - **Fix:** Change to `if (src === 'unknown') return (tgt === 'unknown' || tgt === 'any');`

2. **Multi-step cycle detection follows only first import branch (Line 304)**
   - `currentPath = Array.from(importsFromCurrent)[0]` — Only follows the first import in the Set, missing cycles on other branches. Detection is non-exhaustive.
   - **Fix:** Iterate all imports in the set and check each for cycles, or use the full Tarjan's algorithm (`detectCyclesWithTarjan`) instead of this heuristic.

3. **Multi-step cycle detection misses 2-node cycles (Line 284)**
   - `if (foundCycle && cycleNodes.length > 2)` — A → B → A has `cycleNodes.length === 2`, which fails the `> 2` check. Two-node cycles are always missed by this path.
   - **Fix:** Change to `cycleNodes.length >= 2` or remove the length check entirely.

### Warnings (WARNING)

4. **`hasSignatureMismatch` returns false when one node has metadata and other doesn't (Line 179)**
   - `if (!importMeta || !exportMeta) return false` — If one has metadata and the other doesn't, they should arguably be considered mismatched.
   - **Fix:** `if (!importMeta && !exportMeta) return false; if (!importMeta || !exportMeta) return true;`

5. **`isOptional` detection matches `?` anywhere in type string (Lines 344, 399)**
   - `typeStr.includes('?')` matches `Map<string, number?>` or any type containing `?` anywhere. Should only match trailing `?` for optional parameters.
   - **Fix:** Use `/\?$/.test(typeStr)` instead of `typeStr.includes('?')`.

6. **`undefined` substring match for optional detection (Lines 344, 399)**
   - `typeStr.includes('undefined')` matches types like `undefined[]` or `Result<undefined, Error>`. Should check for exact `undefined` type.
   - **Fix:** Use `typeStr === 'undefined' || typeStr.endsWith('|undefined') || typeStr.startsWith('undefined|')`.

7. **`findPageNode` uses substring path matching (Line 138)**
   - `node.path.includes(targetPage)` — `targetPage = "home"` matches `"homepage.tsx"`. Could cause false positives.
   - **Fix:** Use path basename matching: `path.basename(node.path).startsWith(targetPage)` or exact segment matching.

8. **`findMatchingExport` returns first candidate non-deterministically (Line 155)**
   - When multiple exports share the same name but different paths, returns `candidates[0]` — result depends on node insertion order.
   - **Fix:** Sort candidates by path similarity or prefer the one with matching directory structure.

9. **`isReturnTypeCompatible` — `null` substring match in union check (Line 573)**
   - `tgt.includes('null')` matches `Nullable<T>` or `nullish`. Should check for exact `null` type in union.
   - **Fix:** `tgt === 'null' || tgt.split('|').map(t => t.trim()).includes('null')`

10. **Dead exports — 4 of 5 exported functions have no external callers (Lines 6-9)**
    - `analyzeStructuralSubtyping`, `detectBreakingChanges`, `computeTarjanSCC`, `detectCyclesWithTarjan` are exported but never imported by any file.
    - **Impact:** Wasted API surface. Either wire these up to consumers or mark as internal.

### Info (INFO)

11. **Magic numbers for thresholds (Lines 366, 382, 686)**
    - Line 366: `> 3` key count difference threshold
    - Line 382: `> 0.3` (30%) difference score threshold
    - Line 686: `conflictCount * 3`, `missingCount * 5` integrationDistance weights
    - **Suggestion:** Extract to named constants with documentation.

12. **Missing TypeScript source file**
    - Comment at line 2 references `src/commands/integr8/relationshipAnalyzer.ts` but no `.ts` source exists.
    - **Impact:** Edits must be made to compiled `.js` directly.

13. **JSON.stringify order-dependency in metadata comparison (Line 377)**
    - `JSON.stringify(valA) !== JSON.stringify(valB)` is order-dependent for objects.
    - **Suggestion:** Use a deep equality library or normalize key order before comparing.

14. **Tarjan's `strongConnect` is recursive — stack overflow risk on deep graphs (Line 751)**
    - For graphs with chains longer than ~10,000 nodes, recursive DFS will overflow the call stack.
    - **Suggestion:** Convert to iterative with explicit stack for production robustness.

15. **Variance direction labels are simplified (Lines 521-531)**
    - Both `(!allParamsCompat && returnTypeCompatible)` and `(allParamsCompat && !returnTypeCompatible)` are labeled `'contravariant'`. In type theory, these are different variance patterns.

16. **`detectBreakingChanges` uses kind `'removed-param'` for removed exports (Line 623)**
    - Should use `'removed-export'` or a distinct kind for clarity.

---

*Report generated: 2026-05-13*
*Reviewer: GSD-Codebase-Reviewer*
*Depth: deep (cross-file analysis with import graph and call chain tracing)*
*Files reviewed: 1 (relationshipAnalyzer.js) + 2 cross-referenced (types.js, index.js)*
