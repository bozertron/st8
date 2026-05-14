# Deep Line-by-Line Analysis: `lib/commands/integr8/databasePersister.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/integr8/databasePersister.js`
**Lines:** 229 (compiled TypeScript output)
**Source:** `src/commands/integr8/databasePersister.ts` (TypeScript source — no .ts file or .map file found in repo)
**Purpose:** Direct Node.js-to-SQLite persistence layer for integr8's semantic graph (GraphNodes, GraphEdges, MigrationPlans, IntegrationSnapshots).

---

## Lines 1: Strict mode
```js
"use strict";
```
- **What triggers it:** Module load
- **What it calls:** N/A (runtime directive)
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

## Lines 2-3: Source map comment
```js
// src/commands/integr8/databasePersister.ts
// Direct Node.js-to-SQLite persistence for integr8's semantic graph.
```
- **What triggers it:** N/A (comments)
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** The original `.ts` source file does not exist in the repo. The `.js.map` file referenced at line 229 also doesn't exist. These comments are vestigial from the build process.

---

## Lines 4-36: TypeScript Helper — `__createBinding`, `__setModuleDefault`, `__importStar`
```js
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) { ... }) : (function(o, m, k, k2) { ... }));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) { ... }) : function(o, v) { ... });
var __importStar = (this && this.__importStar) || (function () { ... })();
```
- **What triggers it:** Module load
- **What it calls:** `Object.getOwnPropertyNames`, `Object.defineProperty`, `Object.create`, `Object.prototype.hasOwnProperty`
- **What calls it:** Used by `__importStar(require("path"))`, `__importStar(require("fs"))`, `__importStar(require("os"))` at lines 44-46
- **Dependencies:** ECMAScript 5+ runtime
- **Status:** WORKING
- **Gap:** None. Standard TypeScript CJS helper boilerplate. These are compiled helpers for `import * as X from 'Y'` syntax.

---

## Lines 37-39: TypeScript Helper — `__importDefault`
```js
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
```
- **What triggers it:** Module load
- **What it calls:** N/A
- **What calls it:** `__importDefault(require("better-sqlite3"))` at line 43
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Standard TypeScript CJS helper.

---

## Lines 40-42: Module Exports Declaration
```js
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabasePersister = void 0;
exports.getSharedDatabasePath = getSharedDatabasePath;
```
- **What triggers it:** Module load
- **What it calls:** N/A
- **What calls it:** Any `require("./databasePersister.js")` consumer
- **Dependencies:** CommonJS `exports` object
- **Status:** WORKING
- **Gap:** `exports.DatabasePersister = void 0;` sets the class to `undefined` initially, then line 228 reassigns it to the actual class. This is a TypeScript-compiled pattern for forward-declaring the export. **However**, any code that reads `exports.DatabasePersister` between lines 41 and 228 would get `undefined`. In practice this is fine because module evaluation is synchronous.

---

## Lines 43-46: Imports / `require()` Statements
```js
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
```

### Line 43: `better-sqlite3`
- **What triggers it:** Module load
- **What it calls:** `require("better-sqlite3")` → loads native SQLite3 binding
- **What calls it:** Constructor (line 72), prepared statements (lines 137-138), all query methods
- **Dependencies:** `better-sqlite3` npm package (native addon)
- **Status:** WORKING (assumes `better-sqlite3` is installed)
- **Gap:** **`better-sqlite3` is a native addon** requiring compilation at install time. If the package isn't installed or the native build failed, this `require()` throws synchronously and the entire module fails to load. There's no graceful fallback. All sibling classes (`InsightStore`, `ParserPersistence`, `BackgroundIndexer`) also depend on it, so this is a project-wide dependency.

### Line 44: `path`
- **What triggers it:** Module load
- **What it calls:** `require("path")`
- **What calls it:** `path.dirname()` (line 71), `path.join()` (lines 57-60, 65)
- **Dependencies:** Node.js built-in
- **Status:** WORKING
- **Gap:** None

### Line 45: `fs`
- **What triggers it:** Module load
- **What it calls:** `require("fs")`
- **What calls it:** `fs.mkdirSync()` (line 71)
- **Dependencies:** Node.js built-in
- **Status:** WORKING
- **Gap:** None

### Line 46: `os`
- **What triggers it:** Module load
- **What it calls:** `require("os")`
- **What calls it:** `os.platform()` (line 54), `os.homedir()` (lines 57, 60, 63)
- **Dependencies:** Node.js built-in
- **Status:** WORKING
- **Gap:** None

---

## Lines 47-66: `getSharedDatabasePath()` Function (Exported)

```js
function getSharedDatabasePath() {
    const platform = os.platform();
    let dataDir;
    if (platform === 'linux') {
        dataDir = path.join(os.homedir(), '.local', 'share');
    }
    else if (platform === 'darwin') {
        dataDir = path.join(os.homedir(), 'Library', 'Application Support');
    }
    else {
        dataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    }
    return path.join(dataDir, 'com.scaffolder.app', 'scaffolder_data.sqlite');
}
```

### Lines 53-65: Platform detection and path resolution
- **What triggers it:** Called by `DatabasePersister` constructor (line 69) when no `dbPath` is provided, or by external callers using `getSharedDatabasePath()` directly
- **What it calls:** `os.platform()` (line 54), `os.homedir()` (lines 57, 60, 63), `process.env.APPDATA` (line 63), `path.join()` (lines 57, 60, 63, 65)
- **What calls it:**
  - `lib/commands/integr8/databasePersister.js:69` (this file's constructor)
  - `lib/commands/integr8/index.js:128` (logging the path)
  - `lib/commands/insightStore.js:50` (InsightStore constructor fallback)
  - `lib/commands/parserPersistence.js:48` (ParserPersistence constructor fallback)
  - `lib/commands/backgroundIndexer.js:79` (BackgroundIndexer constructor fallback)
  - `lib/commands/graphTraversal.js:107` (getDb helper fallback)
- **Dependencies:** `path`, `fs`, `os` modules; `process.env.APPDATA`
- **Status:** WORKING
- **Gap 1 (WARNING):** **Hardcoded app identifier `"com.scaffolder.app"` on line 65.** The project is named `st8` but the database path uses `com.scaffolder.app`. This is either an intentional legacy name from a Tauri app convention, or a copy-paste from a template. If the Tauri app name changes, this path won't match.
  - **Affected files:** All 6 consumers listed above will read/write the same `scaffolder_data.sqlite` file.
- **Gap 2 (WARNING):** **No FreeBSD/SunOS support.** The `else` branch (line 62-63) assumes Windows (`APPDATA`). On any non-Linux, non-macOS platform (e.g., FreeBSD, WSL), it falls through to the Windows logic. If `APPDATA` isn't set, it defaults to `~/AppData/Roaming` which is incorrect on non-Windows systems.
- **Gap 3 (WARNING):** **No environment variable override.** There's no way to set a custom database path via environment variable (e.g., `ST8_DB_PATH`). All consumers must pass `dbPath` explicitly to their constructors or accept the default.

---

## Lines 67-76: `DatabasePersister` Class — Constructor

```js
class DatabasePersister {
    constructor(dbPath) {
        const resolvedPath = dbPath || getSharedDatabasePath();
        // Ensure directory exists
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        this.db = new better_sqlite3_1.default(resolvedPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.initializeDatabase();
    }
```

### Line 68: `constructor(dbPath)`
- **What triggers it:** `new DatabasePersister()` or `new DatabasePersister('/path/to/db.sqlite')`
- **What it calls:** `getSharedDatabasePath()` (line 69 if no dbPath), `fs.mkdirSync()` (line 71), `better_sqlite3_1.default()` (line 72), `this.db.pragma()` (lines 73-74), `this.initializeDatabase()` (line 75)
- **What calls it:**
  - `lib/commands/integr8/index.js:125` — `new databasePersister_js_1.DatabasePersister()` (no path — uses default)
  - `backend/persistence.js:177` — `new DatabasePersister(this.dbPath)` (**BROKEN** — see connection bug below)
- **Dependencies:** `better-sqlite3`, `fs`, `path`, `os`
- **Status:** WORKING (for direct callers)

### Line 69: `const resolvedPath = dbPath || getSharedDatabasePath();`
- **Status:** WORKING
- **Gap:** If `dbPath` is an empty string `""`, this evaluates to falsy and falls through to `getSharedDatabasePath()`. Edge case but unlikely in practice.

### Line 71: `fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });`
- **Status:** WORKING
- **Gap:** If the directory creation fails (permissions, disk full), `mkdirSync` throws synchronously, crashing the caller. No try-catch wrapper. This is consistent with the file's pattern of letting errors propagate.

### Line 72: `this.db = new better_sqlite3_1.default(resolvedPath);`
- **Status:** WORKING
- **Gap:** If the file path is invalid or `better-sqlite3` can't open it, this throws. No graceful error handling.

### Line 73-74: WAL mode and synchronous pragma
```js
this.db.pragma('journal_mode = WAL');
this.db.pragma('synchronous = NORMAL');
```
- **Status:** WORKING
- **Gap (WARNING):** **Missing `busy_timeout` pragma.** All sibling classes that share the same database file set `busy_timeout = 5000`:
  - `lib/commands/insightStore.js:53`: `this.db.pragma('busy_timeout = 5000');`
  - `lib/commands/parserPersistence.js:53`: `this.db.pragma('busy_timeout = 5000');`
  - `lib/commands/backgroundIndexer.js:87`: `this.db.pragma('busy_timeout = 5000');`
  
  Without `busy_timeout`, concurrent access to the same SQLite file (e.g., `BackgroundIndexer` and `DatabasePersister` running simultaneously) can cause `SQLITE_BUSY` errors immediately instead of waiting up to 5 seconds.

### Line 75: `this.initializeDatabase();`
- **Status:** WORKING
- **Gap:** If `initializeDatabase()` throws (SQL syntax error), the constructor fails. The `this.db` connection is left open (no cleanup on error).

---

## Lines 81-131: `initializeDatabase()` Method

```js
initializeDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS GraphNodes ( ... );
      CREATE TABLE IF NOT EXISTS GraphEdges ( ... );
      CREATE TABLE IF NOT EXISTS MigrationPlans ( ... );
      CREATE TABLE IF NOT EXISTS IntegrationSnapshots ( ... );
      CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON GraphNodes(graph_id);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_graph_id ON GraphEdges(graph_id);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON GraphEdges(from_node_id);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON GraphEdges(to_node_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_integration ON IntegrationSnapshots(integration_id);
    `);
}
```

### Lines 83-91: `GraphNodes` Table
```sql
CREATE TABLE IF NOT EXISTS GraphNodes (
  node_id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK(node_type IN ('file','store','route','command','type','import','export','component')),
  name TEXT NOT NULL,
  path TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```
- **What triggers it:** Constructor (line 75)
- **What it calls:** SQLite `CREATE TABLE IF NOT EXISTS`
- **What calls it:** `initializeDatabase()` → constructor
- **Dependencies:** SQLite engine
- **Status:** WORKING
- **Gap 1 (WARNING):** **`node_type` CHECK constraint is rigid.** The allowed values are `('file','store','route','command','type','import','export','component')`. If future node types are needed (e.g., `'config'`, `'test'`, `'schema'`), the schema must be altered. No migration mechanism exists.
- **Gap 2 (INFO):** **No `UNIQUE` constraint on `(graph_id, name, path)`.** Saving the same graph twice will create duplicate nodes. There's no upsert or deduplication logic in `saveGraph()`.
- **Gap 3 (INFO):** **`created_at` uses `CURRENT_TIMESTAMP`** which is UTC. No timezone handling.

### Lines 93-103: `GraphEdges` Table
```sql
CREATE TABLE IF NOT EXISTS GraphEdges (
  edge_id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_id TEXT NOT NULL,
  from_node_id INTEGER NOT NULL,
  to_node_id INTEGER NOT NULL,
  edge_type TEXT NOT NULL CHECK(edge_type IN ('depends_on','imports','exports','navigates_to','invokes','conflicts_with','contains')),
  status TEXT CHECK(status IN ('SAFE','NEEDS_REWRITE','CONFLICT','MISSING')),
  confidence REAL DEFAULT 1.0,
  FOREIGN KEY (from_node_id) REFERENCES GraphNodes(node_id) ON DELETE CASCADE,
  FOREIGN KEY (to_node_id) REFERENCES GraphNodes(node_id) ON DELETE CASCADE
);
```
- **What triggers it:** Constructor (line 75)
- **Status:** WORKING
- **Gap 1 (WARNING):** **`edge_type` CHECK constraint is rigid.** Same issue as `node_type` — adding new relationship types requires schema migration.
- **Gap 2 (WARNING):** **Foreign keys require `PRAGMA foreign_keys = ON`.** SQLite has foreign keys OFF by default. **This pragma is never set in the file.** The `ON DELETE CASCADE` on lines 101-102 will NOT work — deleting a `GraphNodes` row will NOT cascade-delete its edges, violating referential integrity. This is a silent data integrity bug.
  - **Verification:** Grep confirms no `foreign_keys` pragma anywhere in this file.
  - **Impact:** Orphaned edges can accumulate when nodes are deleted (though no delete method exists in this class).
- **Gap 3 (INFO):** **No `UNIQUE` constraint on `(graph_id, from_node_id, to_node_id, edge_type)`.** Saving the same graph twice creates duplicate edges.

### Lines 105-114: `MigrationPlans` Table
```sql
CREATE TABLE IF NOT EXISTS MigrationPlans (
  plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  outcome TEXT NOT NULL CHECK(outcome IN ('SUCCESS','PARTIAL','FAILURE','AMBIGUOUS','REDIRECT')),
  estimated_complexity TEXT CHECK(estimated_complexity IN ('low','medium','high')),
  steps_json TEXT NOT NULL,
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL
);
```
- **Status:** WORKING
- **Gap:** The `UNIQUE` constraint on `integration_id` works with `INSERT OR REPLACE` in `saveMigrationPlan()`. However, `INSERT OR REPLACE` deletes and re-inserts the row, which will also cascade-delete any `IntegrationSnapshots` referencing this `integration_id` (if foreign keys were enabled). Since foreign keys are NOT enabled (see above), this causes orphaned snapshots instead.

### Lines 116-123: `IntegrationSnapshots` Table
```sql
CREATE TABLE IF NOT EXISTS IntegrationSnapshots (
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id TEXT NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  snapshot_type TEXT NOT NULL CHECK(snapshot_type IN ('pre','post')),
  data_json TEXT NOT NULL,
  FOREIGN KEY (integration_id) REFERENCES MigrationPlans(integration_id) ON DELETE CASCADE
);
```
- **Status:** WORKING (schema creation)
- **Gap (WARNING):** Same foreign key issue as GraphEdges — `ON DELETE CASCADE` won't work without `PRAGMA foreign_keys = ON`.

### Lines 125-129: Index Creation
```sql
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON GraphNodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_graph_id ON GraphEdges(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON GraphEdges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON GraphEdges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_integration ON IntegrationSnapshots(integration_id);
```
- **Status:** WORKING
- **Gap (INFO):** Missing composite index on `MigrationPlans(integration_id, outcome)` for common query patterns.

### Overall `initializeDatabase()` Status:
- **Status:** WORKING
- **Gap (WARNING):** **All 9 statements run in a single `exec()` call, which is NOT wrapped in a transaction.** While `CREATE TABLE IF NOT EXISTS` is idempotent, running these on every constructor call is wasteful for repeated instantiation. Better-sqlite3's `exec()` does NOT wrap multiple statements in a transaction by default.

---

## Lines 132-158: `saveGraph()` Method

```js
saveGraph(graphId, nodes, edges, properties) {
    const insertNode = this.db.prepare('INSERT INTO GraphNodes (graph_id, node_type, name, path, metadata_json) VALUES (?, ?, ?, ?, ?)');
    const insertEdge = this.db.prepare('INSERT INTO GraphEdges (graph_id, from_node_id, to_node_id, edge_type, status, confidence) VALUES (?, ?, ?, ?, ?, ?)');
    const nodeIdMap = new Map();
    const saveAll = this.db.transaction(() => {
        var _a;
        for (const node of nodes) {
            const result = insertNode.run(graphId, node.type, node.name, node.path || null, node.metadata ? JSON.stringify(node.metadata) : null);
            nodeIdMap.set(node.id, Number(result.lastInsertRowid));
        }
        for (const edge of edges) {
            const fromId = nodeIdMap.get(edge.from);
            const toId = nodeIdMap.get(edge.to);
            if (fromId && toId) {
                insertEdge.run(graphId, fromId, toId, edge.type, edge.status || null, (_a = edge.confidence) !== null && _a !== void 0 ? _a : 1.0);
            }
        }
    });
    saveAll();
}
```

### Line 136: Method signature
- **What triggers it:** Called from `lib/commands/integr8/index.js:126`
- **What it calls:** `this.db.prepare()` (lines 137-138), `this.db.transaction()` (line 141), `insertNode.run()` (line 145), `insertEdge.run()` (line 153)
- **What calls it:** `lib/commands/integr8/index.js:126` — `persister.saveGraph(plan.id, analysis.unifiedGraph.nodes, analysis.unifiedGraph.edges, analysis.unifiedGraph.properties)`
- **Dependencies:** `better-sqlite3` prepared statements and transactions
- **Status:** PARTIAL

### Line 137: Node insert prepared statement
```js
const insertNode = this.db.prepare('INSERT INTO GraphNodes (graph_id, node_type, name, path, metadata_json) VALUES (?, ?, ?, ?, ?)');
```
- **Status:** WORKING
- **Gap:** Uses `INSERT` (not `INSERT OR REPLACE` or `INSERT OR IGNORE`). Re-running `saveGraph` with the same `graphId` will create **duplicate nodes**. No idempotency.

### Line 138: Edge insert prepared statement
```js
const insertEdge = this.db.prepare('INSERT INTO GraphEdges (graph_id, from_node_id, to_node_id, edge_type, status, confidence) VALUES (?, ?, ?, ?, ?, ?)');
```
- **Status:** WORKING
- **Gap:** Same duplicate issue as nodes.

### Line 140: `const nodeIdMap = new Map();`
- **Status:** WORKING
- **Gap:** None

### Line 141: Transaction wrapper
```js
const saveAll = this.db.transaction(() => { ... });
```
- **Status:** WORKING
- **Gap:** None. This correctly wraps the inserts in a single transaction for atomicity.

### Line 142: `var _a;`
- **Status:** WORKING
- **Gap (INFO):** Compiled TypeScript artifact. `_a` is used on line 153 for nullish coalescing. The `var` declaration hoists to the transaction function scope.

### Lines 144-147: Node insertion loop
```js
for (const node of nodes) {
    const result = insertNode.run(graphId, node.type, node.name, node.path || null, node.metadata ? JSON.stringify(node.metadata) : null);
    nodeIdMap.set(node.id, Number(result.lastInsertRowid));
}
```
- **Status:** WORKING
- **Gap 1 (WARNING):** **`node.path || null`** — If `node.path` is `0` (number) or `""` (empty string), this evaluates to `null`. For a path field, empty string might be semantically different from null (e.g., "root path" vs "no path").
- **Gap 2 (WARNING):** **`node.metadata ? JSON.stringify(node.metadata) : null`** — If `node.metadata` is `0`, `false`, `""`, or an empty object `{}`, this evaluates to `null` for the first three or serializes `"{}"` for the last. An empty object is truthy so it gets serialized correctly, but `0`, `false`, `""` would be lost.
- **Gap 3 (INFO):** **`Number(result.lastInsertRowid)`** — `better-sqlite3` returns `lastInsertRowid` as a `BigInt`. `Number()` converts it, but this will lose precision for row IDs > `Number.MAX_SAFE_INTEGER` (9007199254740991). In practice, this won't be hit for autoincrement IDs.
- **Gap 4 (WARNING):** **No validation of `node.type`** against the CHECK constraint values. If a node has `type: 'unknown'`, the INSERT will throw a CHECK constraint violation, causing the entire transaction to roll back and all nodes to be lost.

### Lines 149-155: Edge insertion loop
```js
for (const edge of edges) {
    const fromId = nodeIdMap.get(edge.from);
    const toId = nodeIdMap.get(edge.to);
    if (fromId && toId) {
        insertEdge.run(graphId, fromId, toId, edge.type, edge.status || null, (_a = edge.confidence) !== null && _a !== void 0 ? _a : 1.0);
    }
}
```

### **Line 152: `if (fromId && toId)` — BUG**
- **Status:** BUG
- **Gap (BLOCKER):** **Truthiness check instead of existence check.** `nodeIdMap.get()` returns `undefined` if the key doesn't exist, and a number (e.g., `1`, `2`, `3`) if it does. The `&&` check works correctly for `undefined`, but would **silently skip** any edge where `fromId` or `toId` is `0`. While SQLite AUTOINCREMENT starts at 1 (so `0` won't occur from the DB), this is semantically wrong. The correct check is:
  ```js
  if (fromId !== undefined && toId !== undefined) {
  ```
  Additionally, if an edge references a node ID that wasn't in the `nodes` array (e.g., external reference), the edge is **silently dropped** with no warning or error logging.

### Line 153: Edge data insertion
```js
insertEdge.run(graphId, fromId, toId, edge.type, edge.status || null, (_a = edge.confidence) !== null && _a !== void 0 ? _a : 1.0);
```
- **Status:** WORKING
- **Gap 1 (WARNING):** **`edge.status || null`** — Same pattern as line 145. Empty string or `0` would become null.
- **Gap 2 (WARNING):** **No validation of `edge.type`** against CHECK constraint. Invalid types cause transaction rollback.
- **Gap 3 (INFO):** The compiled `_a` pattern for `edge.confidence ?? 1.0` works correctly — if `edge.confidence` is `null` or `undefined`, it defaults to `1.0`. But `0` would be preserved (since `0 !== null && 0 !== undefined`).

### Line 157: `saveAll();`
- **Status:** WORKING
- **Gap:** The transaction function is invoked. If it throws, the transaction is automatically rolled back by `better-sqlite3`. The error propagates to the caller.

### Overall `saveGraph()` Status:
- **Status:** PARTIAL
- **Gap 1 (BLOCKER):** **`properties` parameter is accepted but NEVER stored.** The method signature accepts `properties` (line 136) but the value is completely ignored — it's never inserted into any table. This means `reachability`, `stability`, and `fragility` metrics passed from `integr8/index.js:126` are silently lost.
- **Gap 2 (WARNING):** **No idempotency.** Calling `saveGraph` twice with the same `graphId` creates duplicate data. No `DELETE WHERE graph_id = ?` before insert, no `INSERT OR REPLACE`, no `UNIQUE` constraint on `(graph_id, node_id)`.

---

## Lines 162-168: `saveMigrationPlan()` Method

```js
saveMigrationPlan(plan) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO MigrationPlans (integration_id, outcome, estimated_complexity, steps_json, source_path, target_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(plan.id, plan.outcome, plan.estimatedComplexity, JSON.stringify(plan.steps), plan.sourcePath, plan.targetPath);
}
```

### Line 162: Method signature
- **What triggers it:** Called from `lib/commands/integr8/index.js:127`
- **What it calls:** `this.db.prepare()` (line 163), `stmt.run()` (line 167)
- **What calls it:** `lib/commands/integr8/index.js:127` — `persister.saveMigrationPlan(plan)`
- **Dependencies:** `better-sqlite3` prepared statements
- **Status:** WORKING

### Line 163-166: Prepared statement
- **Status:** WORKING
- **Gap:** Uses `INSERT OR REPLACE` which is correct for idempotent re-runs. However, as noted above, `INSERT OR REPLACE` triggers `DELETE + INSERT` under the hood, which would cascade-delete snapshots if foreign keys were enabled.

### Line 167: Field mapping
```js
stmt.run(plan.id, plan.outcome, plan.estimatedComplexity, JSON.stringify(plan.steps), plan.sourcePath, plan.targetPath);
```
- **Status:** WORKING
- **Gap 1 (WARNING):** **Field name mapping mismatch risk.** The method maps `plan.id` → `integration_id`, `plan.estimatedComplexity` → `estimated_complexity`, `plan.steps` → `steps_json`, `plan.sourcePath` → `source_path`, `plan.targetPath` → `target_path`. If the plan object shape changes (e.g., `plan.integrationId` instead of `plan.id`), this silently inserts wrong data or `undefined` values.
- **Gap 2 (WARNING):** **No validation of `plan.outcome`** against CHECK constraint. Invalid outcomes cause an error.
- **Gap 3 (INFO):** **`JSON.stringify(plan.steps)`** — If `plan.steps` contains circular references, this throws. No try-catch.

---

## Lines 172-175: `saveSnapshot()` Method

```js
saveSnapshot(integrationId, type, data) {
    const stmt = this.db.prepare('INSERT INTO IntegrationSnapshots (integration_id, snapshot_type, data_json) VALUES (?, ?, ?)');
    stmt.run(integrationId, type, JSON.stringify(data));
}
```

### Line 172: Method signature
- **What triggers it:** **NEVER CALLED.** No callers found in the codebase.
- **What it calls:** `this.db.prepare()` (line 173), `stmt.run()` (line 174)
- **What calls it:** **Nothing.** Grep for `saveSnapshot` across all `.js` and `.ts` files returns only this file's definition (line 172).
- **Dependencies:** `better-sqlite3` prepared statements
- **Status:** NOT CONNECTED
- **Gap (WARNING):** **Dead code.** This method is exported as part of the class but never invoked anywhere. The `IntegrationSnapshots` table is created in `initializeDatabase()` but never populated. This suggests incomplete implementation — the intent was to save pre/post integration snapshots for audit trails, but the wiring was never completed.

---

## Lines 179-202: `queryGraph()` Method

```js
queryGraph(graphId) {
    const nodes = this.db.prepare('SELECT * FROM GraphNodes WHERE graph_id = ?').all(graphId);
    const edges = this.db.prepare('SELECT * FROM GraphEdges WHERE graph_id = ?').all(graphId);
    if (nodes.length === 0) return null;
    return {
        nodes: nodes.map(n => ({
            id: `node_${n.node_id}`,
            type: n.node_type,
            name: n.name,
            path: n.path,
            metadata: n.metadata_json ? JSON.parse(n.metadata_json) : undefined
        })),
        edges: edges.map(e => ({
            id: `edge_${e.edge_id}`,
            from: `node_${e.from_node_id}`,
            to: `node_${e.to_node_id}`,
            type: e.edge_type,
            status: e.status,
            confidence: e.confidence
        })),
        properties: { reachability: 0, stability: 0, fragility: 0 }
    };
}
```

### Line 179: Method signature
- **What triggers it:** **NEVER CALLED directly by any other module.** No callers found outside this file.
- **What it calls:** `this.db.prepare().all()` (lines 180-181), `JSON.parse()` (line 190)
- **What calls it:** **Nothing in the codebase.**
- **Dependencies:** `better-sqlite3` query methods
- **Status:** NOT CONNECTED

### Lines 180-181: Query execution
```js
const nodes = this.db.prepare('SELECT * FROM GraphNodes WHERE graph_id = ?').all(graphId);
const edges = this.db.prepare('SELECT * FROM GraphEdges WHERE graph_id = ?').all(graphId);
```
- **Status:** WORKING
- **Gap (INFO):** `SELECT *` is used instead of explicit column names. If columns are added to the schema later, this returns extra fields that could cause issues.

### Lines 182-183: Empty result check
```js
if (nodes.length === 0) return null;
```
- **Status:** WORKING
- **Gap (WARNING):** Returns `null` if no nodes exist, but doesn't check if edges exist without nodes. A graph with edges but no nodes (orphaned) would return the edges mapped below if there's a matching node. Actually wait — it returns `null` only when `nodes.length === 0`, so if there are edges with no matching nodes, those edges are still included in the result. This is correct behavior.

### Lines 184-201: Graph reconstruction
- **Status:** PARTIAL

### Line 186: **Synthetic ID generation — `id: \`node_${n.node_id}\``**
- **Gap (BLOCKER):** **Original node IDs are lost.** When `saveGraph()` saves nodes, the `node.id` field is NEVER stored in the database. The `GraphNodes` table has no `original_id` column. When `queryGraph()` reads the data back, it generates synthetic IDs like `"node_1"`, `"node_2"`, etc. This means:
  - **Round-trip breaks node identity.** A graph saved with `node.id = "src/utils/auth.ts"` comes back as `"node_1"`.
  - **Edge references become synthetic too** (lines 193-195): `from: \`node_${e.from_node_id}\``, `to: \`node_${e.to_node_id}\``. These synthetic IDs are consistent within the reconstructed graph, but they DON'T match the original graph's node IDs.
  - Any code that depends on matching node IDs between original and persisted graphs will break.

### Line 190: **JSON.parse without error handling**
```js
metadata: n.metadata_json ? JSON.parse(n.metadata_json) : undefined
```
- **Gap (WARNING):** If `metadata_json` is corrupted (e.g., truncated write, manual edit), `JSON.parse` throws, crashing the entire `queryGraph()` call. No try-catch.

### Line 200: **Hardcoded zero properties**
```js
properties: { reachability: 0, stability: 0, fragility: 0 }
```
- **Gap (BLOCKER):** **Properties are never persisted and always return as zeros.** This is the companion to the `saveGraph()` bug — properties are accepted but never stored, and `queryGraph()` hardcodes zeros. Any code relying on `queryGraph().properties` will always see zeros, regardless of the actual graph metrics.

### Overall `queryGraph()` Status:
- **Status:** NOT CONNECTED (dead code) + has 2 BLOCKER-level data integrity issues

---

## Lines 206-220: `listGraphs()` Method

```js
listGraphs() {
    const result = this.db.prepare(`
      SELECT graph_id,
        COUNT(*) as node_count,
        (SELECT COUNT(*) FROM GraphEdges WHERE graph_id = gn.graph_id) as edge_count,
        MIN(created_at) as created_at
      FROM GraphNodes gn GROUP BY graph_id
    `).all();
    return result.map(r => ({
        graphId: r.graph_id,
        nodeCount: r.node_count,
        edgeCount: r.edge_count,
        createdAt: r.created_at
    }));
}
```

### Line 206: Method signature
- **What triggers it:** **NEVER CALLED.** No callers found in the codebase.
- **What it calls:** `this.db.prepare().all()` (line 207)
- **What calls it:** **Nothing.**
- **Dependencies:** `better-sqlite3` query methods
- **Status:** NOT CONNECTED
- **Gap (WARNING):** **Dead code.** Never invoked. Would be useful for listing persisted graphs, but no UI or CLI command exposes it.

### Lines 207-213: SQL query
- **Status:** WORKING
- **Gap (INFO):** The correlated subquery `(SELECT COUNT(*) FROM GraphEdges WHERE graph_id = gn.graph_id)` runs once per group. For large datasets, this could be slow. A JOIN or window function would be more efficient.

### Lines 214-219: Result mapping
- **Status:** WORKING
- **Gap:** None

---

## Lines 224-226: `close()` Method

```js
close() {
    this.db.close();
}
```

### Line 224: Method signature
- **What triggers it:** Called from `lib/commands/integr8/index.js:131` — `persister.close()`
- **What it calls:** `this.db.close()` — closes the SQLite connection
- **What calls it:**
  - `lib/commands/integr8/index.js:131` — after `saveGraph` + `saveMigrationPlan`
- **Dependencies:** `better-sqlite3` close method
- **Status:** WORKING
- **Gap (WARNING):** **No guard against double-close.** If `close()` is called twice, `better-sqlite3` throws. No `if (this.db.open)` check.

---

## Lines 228-229: Export and Source Map Comment
```js
exports.DatabasePersister = DatabasePersister;
//# sourceMappingURL=databasePersister.js.map
```
- **Status:** WORKING
- **Gap (INFO):** The `.map` file referenced at line 229 doesn't exist in the repository. The comment is harmless but vestigial.

---

## CONNECTION ANALYSIS

### What Triggers Persistence Operations?

| Trigger | Method Called | Source File | Line |
|---------|-------------|-------------|------|
| `--save-graph` CLI flag | `saveGraph()` + `saveMigrationPlan()` | `lib/commands/integr8/index.js` | 124-131 |
| (nothing) | `saveSnapshot()` | — | NEVER CALLED |
| (nothing) | `queryGraph()` | — | NEVER CALLED |
| (nothing) | `listGraphs()` | — | NEVER CALLED |
| After persistence ops | `close()` | `lib/commands/integr8/index.js` | 131 |

### What Other Files Get Called?

| This File Calls | External Dependency | Line |
|----------------|-------------------|------|
| `require("better-sqlite3")` | Native SQLite binding | 43 |
| `require("path")` | Node.js built-in | 44 |
| `require("fs")` | Node.js built-in | 45 |
| `require("os")` | Node.js built-in | 46 |

### What Tables Are Managed?

| Table | Created | Written | Read | Deleted |
|-------|---------|---------|------|---------|
| `GraphNodes` | ✅ line 83 | ✅ `saveGraph()` line 145 | ✅ `queryGraph()` line 180 | ❌ |
| `GraphEdges` | ✅ line 93 | ✅ `saveGraph()` line 153 | ✅ `queryGraph()` line 181 | ❌ |
| `MigrationPlans` | ✅ line 105 | ✅ `saveMigrationPlan()` line 167 | ❌ | ❌ |
| `IntegrationSnapshots` | ✅ line 116 | ❌ (method exists but never called) | ❌ | ❌ |

### Who Imports This Module?

| Consumer File | What It Imports | How It Uses It |
|--------------|----------------|---------------|
| `lib/commands/integr8/index.js:55` | `DatabasePersister` class, `getSharedDatabasePath` fn | Instantiates directly (line 125), calls `saveGraph`, `saveMigrationPlan`, `close`, logs path |
| `lib/commands/insightStore.js:46` | `getSharedDatabasePath` fn only | Uses as fallback path for InsightStore's own DB (line 50) |
| `lib/commands/parserPersistence.js:45` | `getSharedDatabasePath` fn only | Uses as fallback path for ParserPersistence's own DB (line 48) |
| `lib/commands/backgroundIndexer.js:60` | `getSharedDatabasePath` fn only | Uses as fallback path for BackgroundIndexer's own DB (line 79) |
| `lib/commands/graphTraversal.js:65` | `getSharedDatabasePath` fn only | Uses as fallback path for graph traversal's own read-only DB (line 107) |
| `backend/persistence.js:23,40` | Full module (lazy-loaded) | **BROKEN** — loads module object, checks `typeof === 'function'` which is always false (line 176), always falls through to direct better-sqlite3 |
| `backend/indexer.js:27,60` | Full module (lazy-loaded) | Defines `getDatabasePersister()` but **never calls it** — dead code |

### Backend Connection Bug (in `backend/persistence.js`, not this file)
**Lines 174-178 of `backend/persistence.js`:**
```js
const DatabasePersister = getDatabasePersister();
if (DatabasePersister && typeof DatabasePersister === 'function') {
    this.db = new DatabasePersister(this.dbPath);
```
`getDatabasePersister()` returns the module `{ DatabasePersister: class, getSharedDatabasePath: fn }` — an object, not a function. `typeof obj === 'function'` is always `false`. The code **always** falls through to the `better-sqlite3` direct fallback. The `DatabasePersister` class is **never used** from `backend/persistence.js`.

---

## @@@ HANDLING

**No `@@@` symbols found in this file.** Grep returned zero matches.

---

## SUMMARY OF ALL FINDINGS

### BLOCKER Issues (3)

| # | Line | Issue |
|---|------|-------|
| 1 | 152 | **`if (fromId && toId)` uses truthiness instead of existence check** — edges with mapped ID `0` (theoretically impossible with AUTOINCREMENT but semantically wrong) are silently skipped; more importantly, edges referencing nodes NOT in the input array are silently dropped with no logging |
| 2 | 136,200 | **`properties` parameter never stored, always returns zeros** — `saveGraph()` accepts `properties` but discards it; `queryGraph()` hardcodes `{ reachability: 0, stability: 0, fragility: 0 }` — data loss on round-trip |
| 3 | 186 | **Original node IDs lost on persistence** — `saveGraph()` never stores `node.id`; `queryGraph()` generates synthetic `node_${n.node_id}` IDs that don't match originals — round-trip identity broken |

### WARNING Issues (10)

| # | Line | Issue |
|---|------|-------|
| 1 | 73-74 | **Missing `busy_timeout` pragma** — all sibling classes set `busy_timeout = 5000`; concurrent access can cause `SQLITE_BUSY` |
| 2 | 82-130 | **Foreign keys not enabled** — `PRAGMA foreign_keys = ON` never set; `ON DELETE CASCADE` on GraphEdges and IntegrationSnapshots is inert |
| 3 | 172-175 | **`saveSnapshot()` is dead code** — method exists but is never called anywhere in the codebase |
| 4 | 179-202 | **`queryGraph()` is dead code** — method exists but is never called anywhere in the codebase |
| 5 | 206-220 | **`listGraphs()` is dead code** — method exists but is never called anywhere in the codebase |
| 6 | 145 | **Falsy coercion for `node.path`** — `node.path || null` converts `""` and `0` to `null` |
| 7 | 153 | **Falsy coercion for `edge.status`** — `edge.status || null` converts `""` and `0` to `null` |
| 8 | 190 | **`JSON.parse` without error handling** — corrupted `metadata_json` crashes `queryGraph()` |
| 9 | 224 | **No double-close guard** — calling `close()` twice throws from `better-sqlite3` |
| 10 | 65 | **Hardcoded `com.scaffolder.app` identifier** — app name in path may not match current project identity |

### INFO Issues (5)

| # | Line | Issue |
|---|------|-------|
| 1 | 83-123 | **Rigid CHECK constraints** — `node_type` and `edge_type` enums require schema migration to extend |
| 2 | 83-123 | **No UNIQUE constraints on graph data** — duplicate inserts on re-run |
| 3 | 137 | **Uses INSERT not INSERT OR IGNORE** — no idempotency for `saveGraph()` |
| 4 | 207-213 | **Correlated subquery in `listGraphs()`** — could be slow at scale |
| 5 | 229 | **`.js.map` file doesn't exist** — source map reference is vestigial |
