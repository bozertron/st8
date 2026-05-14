# DETAILED LINE-BY-LINE REPORT: `lib/commands/graphTraversal.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/graphTraversal.js`
**Total Lines:** 828
**Source:** Compiled from `src/commands/graphTraversal.ts` (TypeScript → JavaScript)
**Status:** BROKEN — Module is entirely disconnected from the rest of the codebase. No JS file in the project imports it. All 13 exported functions are dead code. Additionally, multiple internal logic bugs exist.

---

## SECTION 1: FILE HEADER & STRICT MODE (Lines 1-10)

```
Lines 1-10: File header, strict mode, and comment documentation
- What triggers it: Module load time
- What it calls: Nothing
- What calls it: Node.js runtime on require()
- Dependencies: None
- Status: WORKING
- Gap: Comments reference src/commands/graphTraversal.ts — but no src/ directory exists in this project. The TypeScript source has been removed or was never committed. Only the compiled JS remains.
```

**Notes:**
- Line 1: `"use strict"` — enforced strict mode, correct for CommonJS.
- Line 2: Comment references original TypeScript source path `src/commands/graphTraversal.ts` — source does NOT exist.
- Lines 6-10: Comments document assumed SQLite indexes. These are documentation only; actual index creation happens in `ensureIndexes()` at lines 117-134.

---

## SECTION 2: TYPESCRIPT COMPILE HELPERS (Lines 11-46)

```
Lines 11-46: TypeScript __createBinding, __setModuleDefault, __importStar, __importDefault helper functions
- What triggers it: Module load time (hoisted function declarations, self-executing initializers)
- What it calls: Object.create, Object.defineProperty, Object.getOwnPropertyNames
- What calls it: Lines 61-64 (better-sqlite3, path, fs, os imports use these helpers)
- Dependencies: None (standard ES polyfills)
- Status: WORKING
- Gap: None — standard TypeScript emit for `import * as` and `importDefault` syntax.
```

**Notes:**
- `__createBinding` (lines 11-21): Creates property descriptors to re-export module properties without copying values.
- `__setModuleDefault` (lines 22-26): Sets a `.default` property on the module wrapper.
- `__importStar` (lines 27-43): Star-import helper — wraps a CommonJS module to expose all named exports as properties.
- `__importDefault` (lines 44-46): Default import helper.
- These are **auto-generated** by TypeScript compiler. Not hand-written code.

---

## SECTION 3: MODULE EXPORTS REGISTRATION (Lines 47-60)

```
Lines 47-60: Public API registration — 13 exported functions
- What triggers it: Module load time
- What calls it: External callers via destructured require: const { findPaths } = require('./graphTraversal')
- Dependencies: None
- Status: NOT CONNECTED — Zero callers exist in the entire codebase
- Gap: CRITICAL — No file in lib/commands/, lib/utils/, or anywhere else in the project requires this module. All 13 exports are dead code.
```

**Exported functions:**
| Line | Export | Purpose |
|------|--------|---------|
| 48 | `clearCache` | Clear the LRU graph cache |
| 49 | `ensureIndexes` | Create SQLite indexes for graph tables |
| 50 | `findPaths` | BFS path enumeration between two nodes |
| 51 | `analyzeReachability` | BFS reachability from a node |
| 52 | `extractSubgraph` | Extract induced subgraph for node set |
| 53 | `computeImpactChain` | Cascading impact analysis |
| 54 | `findImportsOf` | Find import edges matching a symbol |
| 55 | `findConsumersOf` | Find nodes with edges pointing to a file |
| 56 | `findOrphans` | Find nodes with zero edges |
| 57 | `getDirectorySubgraph` | Get nodes/edges within a directory |
| 58 | `getDirectoryBoundary` | Classify edges as IN/OUT/INTERNAL |
| 59 | `getDataFlowMetrics` | Compute data flow metrics for directory boundary |
| 60 | `getFileFlows` | Get inbound/outbound edges for a file |

**Documentation claims consumers** (from MAESTRO-VIZ-INVENTORY.md): `compositionAnalyzer.ts`, `patternDiscovery.ts`, `callGraphCluster.ts`, `multiPassAnalyzer.ts`, `unifiedQueryApi.ts`. **NONE of these files exist in the project.** They are phantom dependencies — referenced in documentation but never implemented.

---

## SECTION 4: IMPORTS (Lines 61-65)

```
Lines 61-65: require() statements — 5 imports
- What triggers it: Module load time
- What calls it: Node.js module loader
- Dependencies: better-sqlite3, path, fs, os, ./integr8/databasePersister.js
- Status: WORKING (imports resolve)
- Gap: fs and os are imported but used only in helper functions (normalizeDirPath, isCaseInsensitiveFS). path is used extensively.
```

**Line-by-line imports:**

| Line | Import | Variable | Used At | Notes |
|------|--------|----------|---------|-------|
| 61 | `better-sqlite3` | `better_sqlite3_1` | Line 108 (`new better_sqlite3_1.default(dbPath, { readonly: true })`) | Only used in `getDb()` fallback when no db passed |
| 62 | `path` | `path` | Lines 214, 218, 225, 226, 234, 235, 240, 241, 517, 522, 786, 791 | Used extensively for path normalization |
| 63 | `fs` | `fs` | Line 213 (`fs.realpathSync`) | Only used in `normalizeDirPath()` |
| 64 | `os` | `os` | Line 230 (`os.platform()`) | Only used in `isCaseInsensitiveFS()` |
| 65 | `./integr8/databasePersister.js` | `databasePersister_js_1` | Line 107 (`getSharedDatabasePath()`) | Only used in `getDb()` fallback |

**Potential issue on line 65:** The import path `./integr8/databasePersister.js` uses `.js` extension. This works when running as compiled JS but could break if the project structure changes. The actual file exists at `lib/commands/integr8/databasePersister.js` — confirmed working.

---

## SECTION 5: MODULE-LEVEL CACHE STATE (Lines 66-73)

```
Lines 66-73: Graph cache initialization and clearCache() function
- What triggers it: Module load (lines 66-68), manual call (line 70)
- What it calls: graphCache.clear(), cacheOrder.length = 0
- What calls it: Nothing in the codebase calls clearCache()
- Dependencies: None
- Status: NOT CONNECTED — clearCache() is exported but never called
- Gap: Dead code. The LRU cache (lines 66-68) is initialized on module load and persists in memory. Nobody ever clears it.
```

**Lines 66-68: Cache state declarations**
```javascript
const graphCache = new Map();         // Line 66: stores {nodes, edges} per graphId
const MAX_CACHED_GRAPHS = 5;          // Line 67: LRU eviction threshold
const cacheOrder = [];                // Line 68: tracks insertion order for LRU
```

**Line 70-73: `clearCache()` function**
```javascript
function clearCache() {
    graphCache.clear();
    cacheOrder.length = 0;
}
```
- Bug: `cacheOrder.length = 0` is correct JavaScript to empty an array, but is a non-obvious pattern. No actual bug.

---

## SECTION 6: getCoherentGraphData() — CORE CACHE LAYER (Lines 74-102)

```
Lines 74-102: getCoherentGraphData() — atomic cache-or-fetch for nodes+edges
- What triggers it: getCachedNodes() (line 181) and getCachedEdges() (line 185)
- What it calls: getAllNodes() (line 86), getAllEdges() (line 87), graphCache.get/set/delete
- What calls it: Every exported function that needs graph data (all 11 query functions)
- Dependencies: graphCache (line 66), cacheOrder (line 68), getAllNodes, getAllEdges
- Status: WORKING
- Gap: Minor — LRU eviction (line 90-92) uses shift() which is O(n). With MAX_CACHED_GRAPHS=5, this is negligible.
```

**Logic flow:**
1. Line 81-84: Check cache. If hit, return immediately (both nodes+edges guaranteed coherent).
2. Line 86-87: Cache miss — fetch nodes and edges from SQLite independently.
3. Line 88: Bundle into `{nodes, edges}` object.
4. Lines 90-92: LRU eviction — if at capacity, remove oldest entry.
5. Lines 95-98: If re-caching same graphId, remove old position from order.
6. Lines 99-100: Insert into cache and push to order.

**Critical design decision (lines 74-78 comment):** This function exists to fix a "split-state bug" where nodes could be cached without edges. By fetching both atomically in one function, coherence is guaranteed.

**Potential issue:** If `getAllNodes()` succeeds but `getAllEdges()` throws, the catch inside those functions returns `[]` — so the cache would store `{nodes: [...], edges: []}`. This means a partially-failed fetch would be cached as coherent data. The cache has no way to know edges failed silently.

---

## SECTION 7: getDb() AND shouldCloseDb() HELPERS (Lines 103-112)

```
Lines 103-112: Database connection helper and ownership check
- What triggers it: Every exported function calls getDb(db) as first step
- What calls it: findPaths (257), analyzeReachability (323), extractSubgraph (374), computeImpactChain (411), findImportsOf (475), findConsumersOf (507), findOrphans (556), getDirectorySubgraph (588), getDirectoryBoundary (644), getDataFlowMetrics (708), getFileFlows (776)
- Dependencies: databasePersister_js_1.getSharedDatabasePath() (line 107), better-sqlite3 (line 108)
- Status: WORKING
- Gap: If db parameter is null/undefined, getDb() creates a NEW readonly connection using getSharedDatabasePath(). This connection is closed in the finally block (shouldCloseDb returns true). This is correct but means every call without a db parameter opens and closes a SQLite connection — potentially expensive if called in a loop.
```

**Line 104-109: `getDb(db)`**
```javascript
function getDb(db) {
    if (db) return db;                              // Use caller-provided connection
    const dbPath = getSharedDatabasePath();         // Platform-specific path
    return new better_sqlite3_1.default(dbPath, { readonly: true }); // New connection
}
```

**Line 110-112: `shouldCloseDb(db)`**
```javascript
function shouldCloseDb(db) {
    return !db;  // Only close if we created the connection
}
```

**Connection ownership pattern:** Every exported function uses this pattern:
```javascript
const database = getDb(db);
const closeDb = shouldCloseDb(db);
try {
    // ... work ...
} finally {
    if (closeDb) database.close();
}
```
This correctly handles both caller-managed and self-managed connections.

---

## SECTION 8: ensureIndexes() (Lines 113-134)

```
Lines 113-134: ensureIndexes() — create SQLite indexes for graph tables
- What triggers it: Manual call from external code (never called in this codebase)
- What it calls: db.exec() for 6 CREATE INDEX statements
- What calls it: Nothing — NOT CONNECTED
- Dependencies: A valid database connection (must be passed as db parameter)
- Status: NOT CONNECTED — exported but never called
- Gap: This function is critical for performance. Without these indexes, all graph queries do full table scans. The fact that nobody calls ensureIndexes() means either: (a) callers create indexes themselves, or (b) queries run without indexes and are slow.
```

**Indexes created (lines 118-125):**

| Line | Index | Table | Columns |
|------|-------|-------|---------|
| 119 | `idx_graph_nodes_graph_id` | GraphNodes | `graph_id` |
| 120 | `idx_graph_nodes_name` | GraphNodes | `graph_id, name` |
| 121 | `idx_graph_edges_graph_id` | GraphEdges | `graph_id` |
| 122 | `idx_graph_edges_from` | GraphEdges | `graph_id, from_node_id` |
| 123 | `idx_graph_edges_to` | GraphEdges | `graph_id, to_node_id` |
| 124 | `idx_graph_edges_type` | GraphEdges | `graph_id, edge_type` |

**Note:** Lines 120 and 124 create compound indexes (`graph_id, name` and `graph_id, edge_type`) that are NOT mentioned in the file header comments (lines 6-10). The header only lists 4 indexes; `ensureIndexes()` creates 6. This is a documentation inconsistency.

**Error handling (lines 127-133):** Individual index creation failures are caught and logged as warnings. This is correct — partial index creation is acceptable since `IF NOT EXISTS` makes the operation idempotent.

---

## SECTION 9: validateGraphId() (Lines 135-152)

```
Lines 135-152: validateGraphId() — check if graphId exists in database
- What triggers it: Every exported function calls validateGraphId() as second step (after getDb)
- What calls it: findPaths (261), analyzeReachability (326), extractSubgraph (377), computeImpactChain (414), findImportsOf (478), findConsumersOf (510), findOrphans (559), getDirectorySubgraph (591), getDirectoryBoundary (648), getDataFlowMetrics (711), getFileFlows (779)
- Dependencies: database.prepare().get() — requires GraphNodes table
- Status: WORKING
- Gap: None — parameterized query prevents SQL injection.
```

**Logic (lines 138-152):**
1. Line 139-141: Reject empty/falsy graphId immediately.
2. Line 143: Query `SELECT COUNT(*) as count FROM GraphNodes WHERE graph_id = ?` — parameterized, safe.
3. Line 144-145: If count is 0, return invalid.
4. Line 147: Return valid.
5. Lines 149-151: Catch database errors.

**Correctness:** This validates that at least one node exists for the graphId. An empty graph (nodes but no edges) would still pass validation. This is intentional — edge-less graphs are valid.

---

## SECTION 10: getAllNodes() AND getAllEdges() (Lines 153-178)

```
Lines 153-178: getAllNodes() and getAllEdges() — raw SQLite queries
- What triggers it: getCoherentGraphData() (lines 86-87)
- What calls it: getCoherentGraphData exclusively
- Dependencies: Database with GraphNodes and GraphEdges tables
- Status: WORKING
- Gap: Error handling returns empty arrays on failure (lines 163, 176). This means a database error is silently swallowed — the cache stores {nodes: [], edges: []} as if the graph is empty. Callers have no way to distinguish "empty graph" from "database error."
```

**Lines 157-165: `getAllNodes(graphId, database)`**
```javascript
function getAllNodes(graphId, database) {
    try {
        return database.prepare('SELECT * FROM GraphNodes WHERE graph_id = ?').all(graphId);
    } catch (error) {
        console.error('[GraphTraversal] Failed to get all nodes:', error);
        return [];  // Silent failure — cache will store empty array
    }
}
```

**Lines 170-178: `getAllEdges(graphId, database)`**
```javascript
function getAllEdges(graphId, database) {
    try {
        return database.prepare('SELECT * FROM GraphEdges WHERE graph_id = ?').all(graphId);
    } catch (error) {
        console.error('[GraphTraversal] Failed to get all edges:', error);
        return [];  // Silent failure — cache will store empty array
    }
}
```

**Bug (lines 162-163, 175-176):** Both functions catch errors and return `[]`. When called from `getCoherentGraphData()`, these empty arrays get cached permanently (until LRU eviction). Subsequent calls return the cached empty result even if the database error was transient. This is a **silent data loss** pattern — the cache makes temporary failures look like empty graphs.

---

## SECTION 11: getCachedNodes() AND getCachedEdges() (Lines 179-186)

```
Lines 179-186: Cache access wrappers
- What triggers it: All exported query functions
- What calls it: findPaths (265-266), analyzeReachability (330-331), extractSubgraph (381-382), computeImpactChain (418-419), findImportsOf (482-483), findConsumersOf (514-515), findOrphans (563-564), getDirectorySubgraph (595-596), getDirectoryBoundary (651-652), getDataFlowMetrics (indirectly via getDirectoryBoundary), getFileFlows (783-784)
- Dependencies: getCoherentGraphData()
- Status: WORKING
- Gap: None
```

**Lines 180-182: `getCachedNodes(graphId, database)`**
```javascript
function getCachedNodes(graphId, database) {
    return getCoherentGraphData(graphId, database).nodes;
}
```

**Lines 184-186: `getCachedEdges(graphId, database)`**
```javascript
function getCachedEdges(graphId, database) {
    return getCoherentGraphData(graphId, database).edges;
}
```

**Performance note:** Every exported function calls BOTH `getCachedNodes()` and `getCachedEdges()` separately. On a cache miss, the first call triggers `getCoherentGraphData()` which fetches both. The second call hits the cache. On a cache hit, both are O(1). This is correct but means every function makes two function calls to get cached data that was fetched atomically.

---

## SECTION 12: buildAdjacency() — ADJACENCY MAP BUILDER (Lines 187-207)

```
Lines 187-207: buildAdjacency() — build outgoing and incoming adjacency maps from edges
- What triggers it: findPaths (273), analyzeReachability (336), computeImpactChain (424)
- What calls it: 3 exported functions
- Dependencies: None (operates on edge arrays)
- Status: WORKING
- Gap: Minor — self-referencing edge filter (line 196) uses === which is correct for integer comparison.
```

**Logic (lines 191-207):**
1. Lines 192-193: Create two Maps — `outgoing` (from → [to]) and `incoming` (to → [from]).
2. Lines 194-205: Iterate edges:
   - Line 196-198: **G-05 fix** — Skip self-referencing edges (from === to).
   - Lines 199-200: Initialize outgoing array if needed.
   - Lines 201-202: Initialize incoming array if needed.
   - Line 203: Push to outgoing.
   - Line 204: Push to incoming.
3. Line 206: Return both maps.

**Correctness:** The adjacency maps correctly represent directed edges. Self-referencing edges are filtered out (G-05). Multiple edges between the same pair of nodes are allowed (stored as multiple entries in the array). This is correct for multi-edge graphs.

---

## SECTION 13: normalizeDirPath() (Lines 208-221)

```
Lines 208-221: normalizeDirPath() — resolve symlinks and normalize directory paths
- What triggers it: getDirectorySubgraph (597), getDirectoryBoundary (653), getDataFlowMetrics (723)
- What calls it: 3 exported functions
- Dependencies: fs.realpathSync (line 213), path.resolve (line 218), path.sep (lines 214, 219)
- Status: WORKING
- Gap: The fallback (lines 217-219) uses path.resolve() which does NOT resolve symlinks. This means on systems where realpath fails (e.g., permission denied), the path comparison could fail if the actual file path uses symlinks.
```

**Logic (lines 211-221):**
1. Line 213: Try `fs.realpathSync(dirPath)` to resolve symlinks.
2. Line 214: Ensure path ends with separator (`/` on Unix, `\` on Windows).
3. Lines 216-219: If realpath fails (permission denied, path doesn't exist), fall back to `path.resolve()`.
4. Line 219: Ensure resolved path ends with separator.

**Bug potential (line 226):** `nodeIsInDirectory()` (line 222) compares resolved node paths against normalized directory paths. If the node path uses symlinks but the directory path was resolved via realpath, the `startsWith()` comparison could fail. Example:
- Actual dir: `/home/user/project/src/`
- Symlink: `/tmp/link/` → `/home/user/project/src/`
- Node path: `/tmp/link/file.js`
- If normalizeDirPath resolves to `/home/user/project/src/` but node path stays as `/tmp/link/file.js`, `startsWith()` fails.

---

## SECTION 14: nodeIsInDirectory() (Lines 222-227)

```
Lines 222-227: nodeIsInDirectory() — check if a node's path is within a directory
- What triggers it: getDirectorySubgraph (602), getDirectoryBoundary (659), getDataFlowMetrics (724)
- What calls it: 3 exported functions
- Dependencies: path.resolve (line 225)
- Status: WORKING
- Gap: The second condition (line 226) handles the edge case where the node path equals the directory path without trailing separator. This is correct.
```

**Logic (lines 222-227):**
```javascript
function nodeIsInDirectory(nodePath, normalizedDirPath) {
    if (!nodePath) return false;                    // Line 223: null guard
    const resolvedNodePath = path.resolve(nodePath); // Line 225: resolve node path
    return resolvedNodePath.startsWith(normalizedDirPath) || 
           resolvedNodePath === normalizedDirPath.slice(0, -1); // Line 226: handle dir path without trailing sep
}
```

**Correctness:** The `slice(0, -1)` removes the trailing separator for exact match. Example:
- `normalizedDirPath = "/home/user/project/"`
- `resolvedNodePath = "/home/user/project"` (no trailing slash)
- `resolvedNodePath === normalizedDirPath.slice(0, -1)` → `"/home/user/project" === "/home/user/project"` → true

---

## SECTION 15: PLATFORM-AWARE PATH HELPERS (Lines 228-244)

```
Lines 228-244: Platform-aware path comparison functions (G-08)
- What triggers it: findConsumersOf (522-524), getFileFlows (791-793)
- What calls it: 2 exported functions
- Dependencies: os.platform() (line 230)
- Status: WORKING
- Gap: isCaseInsensitiveFS() is called on every path comparison. This could be cached once at module load time for better performance.
```

**Lines 229-232: `isCaseInsensitiveFS()`**
```javascript
function isCaseInsensitiveFS() {
    const platform = os.platform();
    return platform === 'win32' || platform === 'darwin';
}
```
- Returns true for Windows and macOS (case-insensitive filesystems).
- Returns false for Linux (case-sensitive by default).

**Lines 233-238: `pathEquals(p1, p2)`**
```javascript
function pathEquals(p1, p2) {
    if (isCaseInsensitiveFS()) {
        return p1.toLowerCase() === p2.toLowerCase();
    }
    return p1 === p2;
}
```

**Lines 239-244: `pathEndsWith(fullPath, suffix)`**
```javascript
function pathEndsWith(fullPath, suffix) {
    if (isCaseInsensitiveFS()) {
        return fullPath.toLowerCase().endsWith(suffix.toLowerCase());
    }
    return fullPath.endsWith(suffix);
}
```

**Note:** `pathEndsWith` compares a full path against a suffix. This is used for partial path matching (e.g., checking if a node path ends with a relative file path). This is intentional but could produce false positives if the suffix matches a path component boundary incorrectly.

---

## SECTION 16: findPaths() — BFS PATH ENUMERATION (Lines 245-313)

```
Lines 245-313: findPaths() — BFS path enumeration between two nodes
- What triggers it: External caller via require('./graphTraversal').findPaths(...)
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges, buildAdjacency
- Status: NOT CONNECTED + HAS BUGS
- Gap: CRITICAL BUGS listed below
```

**Function signature (line 252):**
```javascript
function findPaths(graphId, startNodeId, endNodeId, maxDepth, maxResults, db)
```

**Parameters:**
- `graphId` (string): Graph identifier in SQLite
- `startNodeId` (string): Starting node name or node_id
- `endNodeId` (string): Target node name or node_id
- `maxDepth` (number, default 10): Maximum path depth
- `maxResults` (number, default 1000): Maximum paths to return
- `db` (optional): Pre-existing database connection

**BUG 1 — BFS does NOT find shortest paths (lines 277-303):**
The comment on line 277 says "BFS with path tracking" but the implementation is NOT standard BFS. It uses a queue but does NOT terminate when the end node is first found. Instead:
- Line 290-293: When end node is found, the path is added to `allPaths` but the loop CONTINUES.
- This means the algorithm explores ALL paths up to `maxDepth`, not just shortest paths.
- The `shortestPath` (line 304-306) is computed AFTER the loop by finding the minimum-length path from all found paths.

This is technically a "BFS-based path enumeration" not "BFS shortest path." The naming is misleading but the behavior is intentional (returns multiple paths, with shortestPath as a convenience).

**BUG 2 — Potential exponential explosion (lines 281-303):**
```javascript
while (queue.length > 0) {
    if (allPaths.length >= maxResultsLimit) {
        console.warn(`[GraphTraversal] Path enumeration limited to ${maxResultsLimit} results`);
        break;
    }
    const { nodeId, path: currentPath } = queue.shift();
    if (currentPath.length > limit + 1) continue;
    if (nodeId === endNode.node_id && currentPath.length > 1) {
        allPaths.push(currentPath);
        continue;
    }
    const neighbors = outgoing.get(nodeId) || [];
    for (const neighbor of neighbors) {
        if (!currentPath.includes(String(neighbor))) {
            queue.push({
                nodeId: neighbor,
                path: [...currentPath, String(neighbor)]
            });
        }
    }
}
```

- Line 296: `currentPath.includes(String(neighbor))` is O(path_length) per check.
- Line 299: `[...currentPath, String(neighbor)]` creates a new array copy for each neighbor.
- With high-degree nodes, this can create O(b^d) queue entries where b is branching factor and d is depth.
- The `maxResults` limit (line 283) provides a safety valve but doesn't prevent memory exhaustion from queue growth.

**BUG 3 — Node ID matching is inconsistent (lines 268-269):**
```javascript
const startNode = nodes.find(n => n.name === startNodeId || String(n.node_id) === startNodeId);
const endNode = nodes.find(n => n.name === endNodeId || String(n.node_id) === endNodeId);
```
- If multiple nodes share the same name, only the FIRST match is used.
- The `String(n.node_id)` comparison is correct for integer node_ids.

**BUG 4 — Variable shadowing (line 287):**
```javascript
const { nodeId, path: currentPath } = queue.shift();
```
- The destructured `path` is renamed to `currentPath` to avoid shadowing the imported `path` module. This is correct but worth noting.

---

## SECTION 17: analyzeReachability() (Lines 314-364)

```
Lines 314-364: analyzeReachability() — BFS reachability from a node in given direction
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges, buildAdjacency
- Status: NOT CONNECTED + MINOR BUG
- Gap: Bug in reachability score calculation
```

**Function signature (line 317):**
```javascript
function analyzeReachability(graphId, nodeId, direction, db)
```

**BUG — Reachability score denominator (line 356):**
```javascript
const totalNodes = nodes.length - 1; // Exclude start node
const reachabilityScore = totalNodes > 0 ? reachableNodes.length / totalNodes : 0;
```
- Line 356: `nodes.length - 1` excludes the start node from the denominator.
- But if the start node is NOT in the `nodes` array (e.g., it was deleted), the subtraction is wrong — we'd be excluding a node that doesn't exist.
- More importantly: the score doesn't account for nodes that are unreachable due to graph structure (disconnected components). A node in a disconnected component will have score 0 even though the graph has many nodes.

**Direction handling (line 337):**
```javascript
const adjacency = direction === 'outbound' ? outgoing : incoming;
```
- `'outbound'`: Follow edges FROM the start node outward.
- Anything else (including `'inbound'`): Follow edges TO the start node inward.
- There's no validation that `direction` is a valid value. Passing `'upbound'` would silently use `incoming`.

---

## SECTION 18: extractSubgraph() (Lines 365-401)

```
Lines 365-401: extractSubgraph() — extract induced subgraph for given node set
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges
- Status: NOT CONNECTED
- Gap: No bugs found. Clean implementation.
```

**Function signature (line 368):**
```javascript
function extractSubgraph(graphId, nodeIds, includeConnections, db)
```

**Logic:**
1. Line 383: Create Set from input `nodeIds` for O(1) lookup.
2. Line 384: Match nodes by `node_id` (string) OR `name`.
3. Line 385: Build Set of matched node_ids.
4. Lines 387-394: Two modes:
   - `includeConnections = true`: Include edges where at least ONE endpoint is in the set.
   - `includeConnections = false`: Include edges where BOTH endpoints are in the set (strict induced subgraph).

**Correctness:** This is a clean, correct implementation. The dual matching (by node_id and name) handles both string-based and integer-based node identification.

---

## SECTION 19: computeImpactChain() (Lines 402-464)

```
Lines 402-464: computeImpactChain() — cascading impact analysis
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges, buildAdjacency
- Status: NOT CONNECTED + MINOR BUG
- Gap: Severity thresholds are hardcoded magic numbers
```

**Function signature (line 405):**
```javascript
function computeImpactChain(graphId, nodeId, db)
```

**Logic:**
1. Line 424: Build adjacency maps.
2. Line 426: Get direct dependents (nodes with edges TO the start node).
3. Lines 428-442: BFS outward from direct dependents to find cascading impact.
4. Lines 444-457: Compute severity based on impact ratio.

**BUG — Severity thresholds are magic numbers (lines 449-457):**
```javascript
if (impactRatio > 0.3 || totalImpacted > 10) {
    severity = 'high';
} else if (impactRatio > 0.1 || totalImpacted > 3) {
    severity = 'medium';
} else {
    severity = 'low';
}
```
- `0.3`, `10`, `0.1`, `3` are undocumented magic numbers.
- The thresholds use OR logic, meaning either condition alone triggers the severity level.
- A graph with 100 nodes where 11 are impacted (11%) would be `'medium'` (ratio > 0.1).
- A graph with 100 nodes where 4 are impacted (4%) but they're all directly connected would still be `'low'`.

**Design note:** The `visited` set (line 429) includes both the start node AND direct dependents. This means the BFS for cascading impact correctly excludes already-visited nodes.

---

## SECTION 20: findImportsOf() (Lines 465-495)

```
Lines 465-495: findImportsOf() — find import edges matching a symbol name
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges
- Status: NOT CONNECTED
- Gap: No bugs found. Clean implementation.
```

**Function signature (line 469):**
```javascript
function findImportsOf(graphId, symbolName, db)
```

**Logic:**
1. Line 485: Find nodes matching symbol name (exact match on `n.name`).
2. Line 486: Build Set of matching node_ids.
3. Line 488: Filter edges where `edge_type === 'imports'` AND `to_node_id` is in the symbol set.

**Note:** This only finds edges where the symbol is the TARGET (imported BY other nodes). It does NOT find edges where the symbol is the SOURCE (imports FROM other nodes). This is intentional — "find imports of X" means "who imports X?"

---

## SECTION 21: findConsumersOf() (Lines 496-549)

```
Lines 496-549: findConsumersOf() — find nodes with edges pointing to a file
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges, pathEquals, pathEndsWith
- Status: NOT CONNECTED + MINOR BUG
- Gap: Platform-aware path comparison is correct but could produce false positives with pathEndsWith
```

**Function signature (line 501):**
```javascript
function findConsumersOf(graphId, filePath, db)
```

**Logic:**
1. Lines 517-525: Find target nodes matching the file path using three strategies:
   - `pathEquals(nodePath, resolvedPath)`: Exact resolved path match.
   - `pathEquals(n.path, filePath)`: Exact raw path match.
   - `pathEndsWith(n.path, filePath)`: Suffix match.
2. Lines 528-533: Find all edges pointing TO target nodes.
3. Lines 535-537: Remove self-references (target nodes consuming themselves).
4. Lines 539-542: Map node_ids back to node objects.

**Potential false positive (line 524):**
```javascript
pathEndsWith(n.path, filePath)
```
If `filePath` is `"index.js"` and multiple nodes have paths ending with `"index.js"`, all would match. This is intentional for convenience but could return unexpected results if the suffix is too generic.

---

## SECTION 22: findOrphans() (Lines 550-577)

```
Lines 550-577: findOrphans() — find nodes with zero edges
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges
- Status: NOT CONNECTED
- Gap: No bugs found. Clean implementation.
```

**Function signature (line 554):**
```javascript
function findOrphans(graphId, db)
```

**Logic:**
1. Lines 565-569: Build Set of all node_ids that appear in any edge (as source or target).
2. Line 570: Filter nodes NOT in the connected set.

**Correctness:** This correctly identifies truly isolated nodes — no inbound AND no outbound edges.

---

## SECTION 23: getDirectorySubgraph() (Lines 578-630)

```
Lines 578-630: getDirectorySubgraph() — get nodes/edges within a directory plus boundary edges
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges, normalizeDirPath, nodeIsInDirectory
- Status: NOT CONNECTED
- Gap: No bugs found. Clean implementation.
```

**Function signature (line 582):**
```javascript
function getDirectorySubgraph(graphId, dirPath, db)
```

**Logic:**
1. Line 597: Normalize directory path.
2. Lines 601-606: Identify internal nodes (those within the directory).
3. Lines 611-623: Classify edges:
   - `internalEdges`: Both endpoints in directory.
   - `inFlows`: Source outside, target inside.
   - `outFlows`: Source inside, target outside.

**Return structure:**
```javascript
{ internalNodes, internalEdges, inFlows, outFlows }
```

**Difference from getDirectoryBoundary():** This function returns raw edge objects. `getDirectoryBoundary()` returns enriched edge objects with path information and confidence scores.

---

## SECTION 24: getDirectoryBoundary() (Lines 631-698)

```
Lines 631-698: getDirectoryBoundary() — classify ALL edges touching a directory
- What triggers it: External caller, getDataFlowMetrics (line 715)
- What calls it: getDataFlowMetrics (715)
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges, normalizeDirPath, nodeIsInDirectory
- Status: WORKING (called by getDataFlowMetrics)
- Gap: No bugs found. Clean implementation.
```

**Function signature (line 637):**
```javascript
function getDirectoryBoundary(graphId, dirPath, db)
```

**Logic:**
1. Lines 655-662: Build node map and identify internal nodes.
2. Lines 666-691: For each edge touching the directory:
   - Line 670-671: Skip edges that don't touch the directory at all.
   - Lines 674-681: Build enriched `boundaryEdge` object with paths, type, status, confidence.
   - Lines 682-690: Classify as internal, in, or out.

**Enriched edge structure (lines 674-681):**
```javascript
{
    edgeId: String(edge.edge_id),
    fromPath: fromNode?.path || fromNode?.name || '',
    toPath: toNode?.path || toNode?.name || '',
    edgeType: edge.edge_type,
    status: edge.status || 'SAFE',
    confidence: edge.confidence ?? 1.0
}
```

**Note on line 680:** `edge.confidence ?? 1.0` uses nullish coalescing. If confidence is `null` or `undefined`, it defaults to `1.0`. If confidence is `0`, it stays `0`. This is correct.

---

## SECTION 25: getDataFlowMetrics() (Lines 699-764)

```
Lines 699-764: getDataFlowMetrics() — compute data flow metrics for a directory boundary
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getDirectoryBoundary, normalizeDirPath, nodeIsInDirectory
- Status: NOT CONNECTED + PERFORMANCE BUG
- Gap: normalizeDirPath called once per edge in the loop
```

**Function signature (line 702):**
```javascript
function getDataFlowMetrics(graphId, dirPath, db)
```

**BUG — normalizeDirPath called in loop (line 723):**
```javascript
for (const edge of allBoundaryEdges) {
    const normalizedDir = normalizeDirPath(dirPath);  // Called EVERY iteration!
    const fromIn = nodeIsInDirectory(edge.fromPath, normalizedDir);
    // ...
}
```
- `normalizeDirPath()` calls `fs.realpathSync()` which is an I/O operation.
- This is called inside the loop for EVERY boundary edge.
- Should be hoisted outside the loop (it's already computed in `getDirectoryBoundary()` but that value is not returned).

**Correctness of metrics:**
- `inFlowCount`: Count of edges flowing into the directory.
- `outFlowCount`: Count of edges flowing out of the directory.
- `uniqueConnectionCount`: Count of unique external file paths.
- `errorFlows`: Edges with status `'MISSING'`.
- `warningFlows`: Edges with status `'NEEDS_REWRITE'`.
- `ambiguityFlows`: Edges with status `'CONFLICT'`.

---

## SECTION 26: getFileFlows() (Lines 765-827)

```
Lines 765-827: getFileFlows() — get all inbound and outbound edges for a specific file
- What triggers it: External caller
- What calls it: Nothing in the codebase — NOT CONNECTED
- Dependencies: getDb, validateGraphId, getCachedNodes, getCachedEdges, pathEquals, pathEndsWith
- Status: NOT CONNECTED
- Gap: No bugs found. Clean implementation.
```

**Function signature (line 769):**
```javascript
function getFileFlows(graphId, filePath, db)
```

**Logic:**
1. Lines 786-794: Find target nodes matching the file path (same 3-strategy approach as `findConsumersOf`).
2. Lines 799-819: Classify edges:
   - `inbound`: Edge points TO target node but FROM a different node.
   - `outbound`: Edge points FROM target node but TO a different node.

**Note:** Edges where BOTH endpoints are the target file are excluded (self-references). This is correct.

**Difference from findConsumersOf():** `findConsumersOf()` returns only inbound consumers. `getFileFlows()` returns BOTH inbound and outbound edges with enriched metadata (path, type, status, confidence).

---

## SECTION 27: SOURCEMAP REFERENCE (Line 828)

```
Line 828: //# sourceMappingURL=graphTraversal.js.map
- What triggers it: Browser/Node.js devtools
- What calls it: Nothing (comment)
- Dependencies: graphTraversal.js.map (not checked if exists)
- Status: WORKING
- Gap: Sourcemap file may or may not exist. If missing, devtools silently ignore this.
```

---

## CONNECTION MAP

### What triggers graph traversal?

**Answer: NOTHING in the current codebase triggers graph traversal.** All 13 exported functions are dead code. No JavaScript file in `lib/commands/`, `lib/utils/`, or anywhere else in the project imports this module.

The MAESTRO documentation claims these files consume graphTraversal:
- `compositionAnalyzer.ts` — DOES NOT EXIST
- `patternDiscovery.ts` — DOES NOT EXIST
- `callGraphCluster.ts` — DOES NOT EXIST
- `multiPassAnalyzer.ts` — DOES NOT EXIST
- `unifiedQueryApi.ts` — DOES NOT EXIST

All five are phantom consumers — documented but never implemented.

### What other files get called?

| File | Function Called | Called From (line) |
|------|---------------|-------------------|
| `./integr8/databasePersister.js` | `getSharedDatabasePath()` | `getDb()` line 107 |
| `better-sqlite3` | `new Database()` | `getDb()` line 108 |
| `path` (Node.js built-in) | `resolve()`, `sep` | Multiple locations |
| `fs` (Node.js built-in) | `realpathSync()` | `normalizeDirPath()` line 213 |
| `os` (Node.js built-in) | `platform()` | `isCaseInsensitiveFS()` line 230 |

### What data flows out?

All functions return plain JavaScript objects (no classes, no streams). Return structures:

| Function | Return Type |
|----------|------------|
| `findPaths` | `{ error?, paths: string[][], shortestPath: string[] }` |
| `analyzeReachability` | `{ error?, reachableNodes: string[], depth: number, reachabilityScore: number }` |
| `extractSubgraph` | `{ error?, nodes: object[], edges: object[] }` |
| `computeImpactChain` | `{ error?, directImpact: string[], cascadingImpact: string[], severity: string }` |
| `findImportsOf` | `{ error?, edges: object[] }` |
| `findConsumersOf` | `{ error?, nodes: object[] }` |
| `findOrphans` | `{ nodes: object[] }` |
| `getDirectorySubgraph` | `{ error?, internalNodes: object[], internalEdges: object[], inFlows: object[], outFlows: object[] }` |
| `getDirectoryBoundary` | `{ error?, inEdges: object[], outEdges: object[], internalEdges: object[] }` |
| `getDataFlowMetrics` | `{ error?, inFlowCount, outFlowCount, uniqueConnectionCount, errorFlows, warningFlows, ambiguityFlows }` |
| `getFileFlows` | `{ error?, inbound: object[], outbound: object[] }` |

---

## @@@ HANDLING

**No `@@@` symbols found in this file.** The file is clean of placeholder markers.

---

## SUMMARY OF ALL BUGS AND ISSUES

### CRITICAL (3)

| # | Line(s) | Issue |
|---|---------|-------|
| 1 | ALL | **Entire module is disconnected.** Zero callers in the codebase. All 13 exported functions are dead code. The 5 documented consumers (compositionAnalyzer, patternDiscovery, callGraphCluster, multiPassAnalyzer, unifiedQueryApi) do not exist. |
| 2 | 162-163, 175-176 | **Silent data loss on database error.** `getAllNodes()` and `getAllEdges()` catch errors and return `[]`. When called from `getCoherentGraphData()`, these empty arrays get cached permanently. A transient database error makes the graph appear empty forever (until LRU eviction). |
| 3 | 290-303 | **BFS path enumeration can cause memory exhaustion.** For graphs with high branching factor, the queue grows exponentially. The `maxResults` limit (line 283) caps output but not queue size. A graph with branching factor 10 and depth 10 could create 10^10 queue entries before hitting the result limit. |

### WARNING (4)

| # | Line(s) | Issue |
|---|---------|-------|
| 1 | 723 | **`normalizeDirPath()` called inside loop.** In `getDataFlowMetrics()`, `normalizeDirPath()` (which calls `fs.realpathSync()`) is invoked once per boundary edge. Should be hoisted outside the loop. |
| 2 | 120, 124 | **Documentation inconsistency.** File header (lines 6-10) lists 4 indexes. `ensureIndexes()` creates 6 (adds compound indexes on `graph_id, name` and `graph_id, edge_type`). |
| 3 | 337 | **No direction validation.** `analyzeReachability()` accepts any string as `direction`. Only `'outbound'` is treated specially; everything else silently uses `incoming`. Should validate and return error for invalid direction. |
| 4 | 449-457 | **Hardcoded severity thresholds.** `computeImpactChain()` uses magic numbers (`0.3`, `10`, `0.1`, `3`) for severity classification. These should be configurable or at least documented. |

### INFO (3)

| # | Line(s) | Issue |
|---|---------|-------|
| 1 | 229-232 | **`isCaseInsensitiveFS()` called on every path comparison.** Could be cached at module load time since `os.platform()` doesn't change during execution. |
| 2 | 131 | **`console.warn` in production code.** `ensureIndexes()` logs warnings on index creation failure. Acceptable for debugging but should be removable. |
| 3 | 284 | **`console.warn` in production code.** `findPaths()` logs a warning when path enumeration hits the limit. Acceptable for debugging but should be removable. |

---

_Generated: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
