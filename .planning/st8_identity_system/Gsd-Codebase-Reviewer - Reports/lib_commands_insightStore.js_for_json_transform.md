# DETAILED LINE-BY-LINE REPORT: `lib/commands/insightStore.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/insightStore.js`
**Lines:** 362 total
**Type:** Compiled TypeScript → JavaScript (ESM → CJS with `__createBinding`/`__setModuleDefault`/`__importStar`/`__importDefault` polyfills)
**Purpose:** SQLite-backed insight accumulation store. Each parse pass adds insights per file; queries allow retrieval by file, category, or recency.
**Source origin:** `src/commands/insightStore.ts` (TypeScript source — file NOT found in repo; only compiled `.js` exists)

---

## SECTION 1: TypeScript Helper Polyfills (Lines 1-40)

### Lines 1: `"use strict";`
- What triggers it: Module load
- What it calls: N/A
- What calls it: N/A (module-level directive)
- Dependencies: None
- Status: **WORKING**
- Gap: None

### Lines 2-4: Comments
- What triggers it: N/A (comments only)
- What it calls: N/A
- What calls it: N/A
- Dependencies: N/A
- Status: **N/A**
- Gap: Reveals this is compiled from `src/commands/insightStore.ts`. The `.ts` source file is missing from the repository — only the compiled `.js` exists. This means **no source-of-truth for TypeScript types** is available.

### Lines 5-15: `__createBinding` polyfill
- What triggers it: Module load (self-executing)
- What it calls: `Object.create`, `Object.getOwnPropertyDescriptor`, `Object.defineProperty`
- What calls it: Used by `__importStar` (line 21) to create named exports from CommonJS modules
- Dependencies: ES5 runtime
- Status: **WORKING**
- Gap: None — standard TypeScript `esModuleInterop` output

### Lines 16-20: `__setModuleDefault` polyfill
- What triggers it: Module load (self-executing)
- What it calls: `Object.defineProperty` or direct property assignment
- What calls it: Used by `__importStar` (line 34)
- Dependencies: ES5 runtime
- Status: **WORKING**
- Gap: None

### Lines 21-37: `__importStar` polyfill
- What triggers it: Module load (self-executing)
- What it calls: `Object.getOwnPropertyNames`, `Object.prototype.hasOwnProperty`, `__createBinding`, `__setModuleDefault`
- What calls it: Used for `require("crypto")` on line 45
- Dependencies: Lines 5-20 (`__createBinding`, `__setModuleDefault`)
- Status: **WORKING**
- Gap: None

### Lines 38-40: `__importDefault` polyfill
- What triggers it: Module load (self-executing)
- What it calls: Checks `mod.__esModule`
- What calls it: Used for `require("better-sqlite3")` on line 44
- Dependencies: None
- Status: **WORKING**
- Gap: None

---

## SECTION 2: Module Exports Declaration (Lines 41-43)

### Lines 41-43: `Object.defineProperty(exports, "__esModule", { value: true }); exports.InsightStore = void 0; exports.getInsightStore = getInsightStore;`
- What triggers it: Module load
- What it calls: `Object.defineProperty`
- What calls it: Module system (when `require("./insightStore.js")` is called)
- Dependencies: CommonJS `exports` object
- Status: **WORKING**
- Gap: `exports.InsightStore = void 0` on line 42 is a forward declaration placeholder. The actual assignment happens on line 350. Between lines 42 and 350, `InsightStore` is `undefined` on the exports object. This is normal for TypeScript compiled output, but means any code that tries to destructure `InsightStore` before the class definition executes would get `undefined`. Not a practical issue since all code runs sequentially.

---

## SECTION 3: IMPORTS (Lines 44-46)

### Line 44: `const better_sqlite3_1 = __importDefault(require("better-sqlite3"));`
- What triggers it: Module load
- What it calls: `require("better-sqlite3")` → loads native SQLite3 binding
- What calls it: `InsightStore.constructor()` (line 51)
- Dependencies: `better-sqlite3` npm package (native C++ addon)
- Status: **WORKING**
- Gap: None. `better-sqlite3` is a synchronous SQLite3 driver — correct choice for this use case.

### Line 45: `const crypto = __importStar(require("crypto"));`
- What triggers it: Module load
- What it calls: `require("crypto")` → Node.js built-in
- What calls it: `crypto.randomUUID()` (lines 130, 173), `crypto.createHash('sha256')` (line 327)
- Dependencies: Node.js `crypto` module (built-in)
- Status: **WORKING**
- Gap: None

### Line 46: `const databasePersister_js_1 = require("./integr8/databasePersister.js");`
- What triggers it: Module load
- What it calls: `require("./integr8/databasePersister.js")` → loads `getSharedDatabasePath` function
- What calls it: `InsightStore.constructor()` (line 50) as fallback when no `dbPath` provided
- Dependencies: `lib/commands/integr8/databasePersister.js` — specifically the `getSharedDatabasePath()` function (lines 53-66 of that file)
- Status: **WORKING**
- Gap: The import path `./integr8/databasePersister.js` uses a relative path. If the file is moved, this breaks. No dynamic resolution.

---

## SECTION 4: InsightStore CLASS (Lines 47-349)

### Lines 47: `// ============ INSIGHT STORE ============`
- Comment only

### Lines 48-55: `class InsightStore { constructor(dbPath) { ... } }`

#### Lines 48-55: Constructor
- What triggers it: `new InsightStore(dbPath)` — called by `getInsightStore()` (line 358) or directly
- What it calls:
  - `databasePersister_js_1.getSharedDatabasePath()` (line 50) — fallback DB path if none provided
  - `new better_sqlite3_1.default(resolvedPath)` (line 51) — opens SQLite database
  - `this.db.pragma('journal_mode = WAL')` (line 52) — enables Write-Ahead Logging
  - `this.db.pragma('busy_timeout = 5000')` (line 53) — 5-second busy timeout
  - `this.ensureTables()` (line 54) — creates tables if missing
- What calls it: `getInsightStore()` (line 358), or any direct `new InsightStore(path)` call
- Dependencies: `better-sqlite3`, `databasePersister.js`
- Status: **WORKING** — but with concerns (see Gap)
- Gap:
  - **No `fs.mkdirSync` call.** Unlike `DatabasePersister.constructor` (line 71 of `databasePersister.js`), the `InsightStore` constructor does NOT create the directory for the database file. If the directory doesn't exist, `better-sqlite3` will throw `SQLITE_CANTOPEN`. The `BackgroundIndexer` constructor (lines 81-83 of `backgroundIndexer.js`) does create the directory before calling `getInsightStore()`, so this works in practice — but the `InsightStore` class itself is fragile if used standalone.
  - **No error handling** on `new better_sqlite3_1.default(resolvedPath)`. If the file is corrupted or permissions are wrong, the constructor throws an unhandled exception.

---

### Lines 56-91: `ensureTables()` method

#### Lines 57-91: Table creation DDL
- What triggers it: Called from constructor (line 54) on every instantiation
- What it calls: `this.db.exec(sql)` — executes raw SQL
- What calls it: `InsightStore.constructor()` (line 54)
- Dependencies: `this.db` (better-sqlite3 database instance)
- Status: **WORKING**
- Tables created:
  1. **`FileInsightSlots`** (lines 59-66): Primary table for file-level insight metadata
     - `file_id TEXT PRIMARY KEY` — SHA-256 hash-based ID
     - `project_id TEXT NOT NULL`
     - `file_path TEXT NOT NULL`
     - `total_insights INTEGER DEFAULT 0`
     - `last_pass_number INTEGER DEFAULT 0`
     - `last_updated TEXT DEFAULT CURRENT_TIMESTAMP`
  2. **`InsightRecords`** (lines 68-82): Individual insight entries
     - `insight_id TEXT PRIMARY KEY` — UUID
     - `project_id TEXT NOT NULL`
     - `file_id TEXT NOT NULL` — FK to FileInsightSlots
     - `file_path TEXT NOT NULL` — denormalized for query convenience
     - `pass_number INTEGER NOT NULL`
     - `category TEXT NOT NULL`
     - `severity TEXT NOT NULL DEFAULT 'info'`
     - `description TEXT NOT NULL`
     - `evidence TEXT DEFAULT ''`
     - `related_node_ids TEXT DEFAULT '[]'` — JSON array stored as text
     - `context TEXT DEFAULT '{}'` — JSON object stored as text
     - `timestamp TEXT DEFAULT CURRENT_TIMESTAMP`
     - `FOREIGN KEY (file_id) REFERENCES FileInsightSlots(file_id) ON DELETE CASCADE`
  3. **Indexes** (lines 84-90):
     - `idx_insights_project` on `InsightRecords(project_id)`
     - `idx_insights_file` on `InsightRecords(file_id)`
     - `idx_insights_category` on `InsightRecords(category)`
     - `idx_insights_severity` on `InsightRecords(severity)`
     - `idx_insights_timestamp` on `InsightRecords(timestamp DESC)`
     - `idx_insight_slots_project` on `FileInsightSlots(project_id)`
- Gap:
  - **`related_node_ids` and `context` are stored as JSON strings** (lines 78-79). No JSON validation at INSERT time. If invalid JSON is inserted, `JSON.parse` in `rowToInsight()` (lines 344-345) will throw at read time.
  - **No `ON DELETE CASCADE` enforcement check.** SQLite requires `PRAGMA foreign_keys = ON` for FK enforcement. This pragma is NEVER set in this file. The FK on line 81 is decorative — cascading deletes will NOT work. **This is a bug.**

---

### Lines 92-124: File Slot Management

#### Lines 93-104: `ensureFileSlot(projectId, filePath)`
- What triggers it: Called before inserting insights (lines 133, 174), and from `BackgroundIndexer` (lines 460, 480, 508)
- What it calls:
  - `this.generateFileId(projectId, filePath)` (line 98) — creates hash-based ID
  - `this.db.prepare('SELECT ...').get(fileId)` (line 99) — checks if slot exists
  - `this.db.prepare('INSERT ...').run(...)` (line 101) — creates slot if missing
- What calls it: `addInsight()` (line 133), `addInsightsBatch()` (line 174), `BackgroundIndexer.extractInsights()` (lines 460, 480), `BackgroundIndexer.generateNodeInsights()` (line 508)
- Dependencies: `this.db`, `this.generateFileId()`
- Status: **WORKING**
- Gap:
  - **Race condition potential.** The SELECT then INSERT pattern (lines 99-101) is not atomic. If two concurrent calls try to insert the same file_id, the second INSERT will fail with `SQLITE_CONSTRAINT_PRIMARYKEY`. This is mitigated by `better-sqlite3` being synchronous (single-threaded Node.js), but if the database is accessed from multiple processes, this would fail.
  - The `ensureFileSlot` method uses `projectId` and `filePath` as parameters but the `fileId` is generated from both. The caller must pass consistent values.

#### Lines 105-124: `getFileSlot(projectId, filePath)`
- What triggers it: Called from external code needing file slot metadata
- What it calls:
  - `this.generateFileId(projectId, filePath)` (line 109)
  - `this.db.prepare('SELECT * FROM FileInsightSlots WHERE file_id = ?').get(fileId)` (line 110)
  - `this.db.prepare('SELECT DISTINCT category FROM InsightRecords WHERE file_id = ?').all(fileId)` (line 114)
- What calls it: **NOT CONNECTED** — grep shows no callers in the codebase. This method is exported as part of the class but never invoked.
- Dependencies: `this.db`, `this.generateFileId()`
- Status: **NOT CONNECTED** — dead code. No callers found.
- Gap: This method exists but is never called. It may be intended for future use or was orphaned during refactoring.

---

### Lines 125-182: Insight Recording

#### Lines 126-151: `addInsight(insight)` — Single insight insert
- What triggers it: Called to record a single insight for a file
- What it calls:
  - `crypto.randomUUID()` (line 130) — generates UUID for insight_id
  - `new Date().toISOString()` (line 131) — generates ISO timestamp
  - `this.ensureFileSlot(insight.projectId, insight.filePath)` (line 133) — ensures parent slot exists
  - `this.db.prepare(INSERT ...)` (line 134) — prepared statement for insight insert
  - `this.db.prepare(UPDATE ...)` (line 138) — prepared statement for slot counter update
  - `this.db.transaction(() => { ... })` (line 145) — wraps in transaction
  - `JSON.stringify(insight.relatedNodeIds)` (line 146) — serializes array to JSON string
  - `JSON.stringify(insight.context)` (line 146) — serializes object to JSON string
- What calls it: **NOT CONNECTED** — grep shows no callers in the codebase. The `BackgroundIndexer` uses `addInsightsBatch()` exclusively (lines 376, 497).
- Dependencies: `crypto`, `this.db`, `this.ensureFileSlot()`
- Status: **NOT CONNECTED** — dead code. The `BackgroundIndexer` always uses `addInsightsBatch()` instead.
- Gap:
  - **Dead code.** This method is never called. All callers use `addInsightsBatch()` which is more efficient.
  - **Bug in parameter usage (line 146).** The INSERT uses `insight.fileId` but the caller-provided `insight` object may not have `fileId` set. Looking at the `BackgroundIndexer` code (lines 461-472, 481-492, 511-519), the insight objects passed to `addInsightsBatch()` DO include `fileId`. But the `addInsight()` method calls `this.ensureFileSlot(insight.projectId, insight.filePath)` on line 133, which generates a `fileId` internally, but then the INSERT on line 146 uses `insight.fileId` (the one from the input object), NOT the one generated by `ensureFileSlot`. If these don't match, the FK constraint would fail (if FK enforcement were enabled). Since FK enforcement is disabled, this is a silent data integrity issue.

#### Lines 152-182: `addInsightsBatch(insights)` — Batch insight insert
- What triggers it: Called from `BackgroundIndexer.extractInsights()` (line 497) and `BackgroundIndexer.executeIncrementalIndex()` (line 376)
- What it calls:
  - `this.db.prepare(INSERT ...)` (line 158) — prepared statement
  - `this.db.prepare(UPDATE ...)` (line 162) — prepared statement
  - `new Date().toISOString()` (line 169) — single timestamp for all insights in batch
  - `crypto.randomUUID()` (line 173) — generates UUID per insight
  - `this.ensureFileSlot(...)` (line 174) — ensures parent slot exists per insight
  - `this.db.transaction(() => { ... })` (line 171) — wraps entire batch in single transaction
  - `JSON.stringify(...)` (line 175) — serializes related_node_ids and context
- What calls it: `BackgroundIndexer.extractInsights()` (line 497), `BackgroundIndexer.executeIncrementalIndex()` (line 376)
- Dependencies: `crypto`, `this.db`, `this.ensureFileSlot()`
- Status: **WORKING** — primary insertion path
- Gap:
  - **Same fileId mismatch risk as `addInsight()`.** Line 175 uses `insight.fileId` from the input, but line 174 generates a potentially different `fileId` via `ensureFileSlot`. The generated fileId is discarded. If the caller passes an incorrect `fileId`, the data is silently inconsistent.
  - **`ensureFileSlot` called inside transaction loop** (line 174). For a batch of 100 insights across 50 files, this calls `ensureFileSlot` 100 times, each doing a SELECT. This is inefficient but not incorrect.

---

### Lines 183-270: Query Methods

#### Lines 184-191: `getInsightsForFile(projectId, filePath)`
- What triggers it: Called to retrieve all insights for a specific file
- What it calls:
  - `this.generateFileId(projectId, filePath)` (line 188)
  - `this.db.prepare('SELECT * FROM InsightRecords WHERE file_id = ? ORDER BY pass_number ASC, timestamp ASC').all(fileId)` (line 189)
  - `rows.map(this.rowToInsight)` (line 190)
- What calls it: **NOT CONNECTED** — grep shows no callers in the codebase.
- Dependencies: `this.db`, `this.generateFileId()`, `this.rowToInsight()`
- Status: **NOT CONNECTED** — dead code. No callers found.
- Gap: Dead code. May be intended for future API endpoints.

#### Lines 192-209: `getInsightsByCategory(category, projectId, limit)`
- What triggers it: Called to retrieve insights filtered by category
- What it calls:
  - Dynamic SQL construction (lines 196-206)
  - `this.db.prepare(sql).all(...params)` (line 207)
  - `rows.map(this.rowToInsight)` (line 208)
- What calls it: **NOT CONNECTED** — grep shows no callers in the codebase.
- Dependencies: `this.db`, `this.rowToInsight()`
- Status: **NOT CONNECTED** — dead code.
- Gap: Dead code. The dynamic SQL construction is safe (uses parameterized queries), but the method is never called.

#### Lines 210-224: `getRecentInsights(projectId, limit = 50)`
- What triggers it: Called to retrieve most recent insights
- What it calls:
  - Dynamic SQL construction (lines 214-221)
  - `this.db.prepare(sql).all(...params)` (line 222)
  - `rows.map(this.rowToInsight)` (line 223)
- What calls it: **NOT CONNECTED** — grep shows no callers in the codebase.
- Dependencies: `this.db`, `this.rowToInsight()`
- Status: **NOT CONNECTED** — dead code.
- Gap: Dead code. Default limit of 50 is reasonable.

#### Lines 225-270: `queryInsights(query)` — Flexible query builder
- What triggers it: Called with a query object for flexible filtering
- What it calls:
  - Dynamic SQL construction with condition array (lines 229-267)
  - `this.db.prepare(sql).all(...params)` (line 268)
  - `rows.map(this.rowToInsight)` (line 269)
- What calls it: **NOT CONNECTED** — grep shows no callers in the codebase.
- Dependencies: `this.db`, `this.rowToInsight()`
- Status: **NOT CONNECTED** — dead code.
- Gap:
  - Dead code. This is the most flexible query method but is never called.
  - **`OFFSET` without `LIMIT` issue (lines 260-267).** If `query.offset` is set but `query.limit` is not, the SQL will have `OFFSET ?` without a preceding `LIMIT`. In SQLite, `OFFSET` without `LIMIT` is valid syntax (it just skips rows), but this is likely unintended behavior — the caller probably expects pagination with both.

#### Lines 271-281: `getCategorySummary(projectId)`
- What triggers it: Called to get category counts for a project
- What it calls:
  - `this.db.prepare('SELECT category, COUNT(*) as count FROM InsightRecords WHERE project_id = ? GROUP BY category').all(projectId)` (line 275)
- What calls it: **NOT CONNECTED** — grep shows no callers in the codebase.
- Dependencies: `this.db`
- Status: **NOT CONNECTED** — dead code.
- Gap: Dead code.

#### Lines 282-296: `getFileSlots(projectId)`
- What triggers it: Called to get all file slots for a project
- What it calls:
  - `this.db.prepare('SELECT * FROM FileInsightSlots WHERE project_id = ? ORDER BY last_updated DESC').all(projectId)` (line 286)
- What calls it: **NOT CONNECTED** — grep shows no callers in the codebase.
- Dependencies: `this.db`
- Status: **NOT CONNECTED** — dead code.
- Gap:
  - Dead code.
  - **Hardcoded empty `categories: []`** (line 295). Unlike `getFileSlot()` (line 114) which queries distinct categories, this method always returns empty categories. Inconsistent behavior.

---

### Lines 297-324: Cleanup Methods

#### Lines 298-307: `clearProject(projectId)`
- What triggers it: Called to remove all insights for a project
- What it calls:
  - `this.db.prepare('DELETE FROM InsightRecords WHERE project_id = ?').run(projectId)` (line 303)
  - `this.db.prepare('DELETE FROM FileInsightSlots WHERE project_id = ?').run(projectId)` (line 304)
  - `this.db.transaction(() => { ... })` (line 302)
- What calls it: `BackgroundIndexer.removeProject()` (line 176 of `backgroundIndexer.js`)
- Dependencies: `this.db`
- Status: **WORKING** — connected and used
- Gap:
  - **FK cascade not enforced.** The `InsightRecords` table has `FOREIGN KEY (file_id) REFERENCES FileInsightSlots(file_id) ON DELETE CASCADE`, but since `PRAGMA foreign_keys` is never enabled, the cascade doesn't work. The code manually deletes from both tables (lines 303-304), which works around this issue. But if someone only deletes from `FileInsightSlots`, orphaned `InsightRecords` would remain.

#### Lines 308-318: `clearFile(projectId, filePath)`
- What triggers it: Called to remove all insights for a specific file
- What it calls:
  - `this.generateFileId(projectId, filePath)` (line 312)
  - `this.db.prepare('DELETE FROM InsightRecords WHERE file_id = ?').run(fileId)` (line 314)
  - `this.db.prepare('DELETE FROM FileInsightSlots WHERE file_id = ?').run(fileId)` (line 315)
  - `this.db.transaction(() => { ... })` (line 313)
- What calls it: `BackgroundIndexer.executeIncrementalIndex()` (line 363 of `backgroundIndexer.js`)
- Dependencies: `this.db`, `this.generateFileId()`
- Status: **WORKING** — connected and used
- Gap: Same FK cascade issue as `clearProject()`. Manual deletion works around it.

#### Lines 319-324: `close()`
- What triggers it: Called during shutdown
- What it calls: `this.db.close()` (line 323)
- What calls it: `BackgroundIndexer.shutdown()` (line 242 of `backgroundIndexer.js`)
- Dependencies: `this.db`
- Status: **WORKING** — connected and used
- Gap: No check if `this.db` is already closed. Double-close would throw.

---

### Lines 325-348: Private Helpers

#### Lines 326-332: `generateFileId(projectId, filePath)`
- What triggers it: Called from `ensureFileSlot`, `getFileSlot`, `getInsightsForFile`, `clearFile`
- What it calls:
  - `crypto.createHash('sha256')` (line 327)
  - `.update(`${projectId}::${filePath}`)` (line 328) — template literal concatenation
  - `.digest('hex')` (line 329)
  - `.substring(0, 16)` (line 330) — truncates to 16 hex chars (64 bits)
- What calls it: Multiple methods within InsightStore
- Dependencies: `crypto`
- Status: **WORKING**
- Gap:
  - **Collision risk with 16-char hex truncation** (line 330). 16 hex characters = 64 bits. By birthday paradox, collision probability reaches ~50% at ~4 billion entries. Unlikely in practice but worth noting.
  - **Separator `::` could collide.** If `projectId` contains `::`, different inputs could produce same hash. For example, `("a::b", "c")` and `("a", "b::c")` would produce different hashes because the full string differs, so this is actually safe.

#### Lines 333-348: `rowToInsight(row)`
- What triggers it: Called from all query methods to transform DB rows to insight objects
- What it calls:
  - `JSON.parse(row.related_node_ids || '[]')` (line 344) — deserializes JSON array
  - `JSON.parse(row.context || '{}')` (line 345) — deserializes JSON object
- What calls it: `getInsightsForFile` (line 190), `getInsightsByCategory` (line 208), `getRecentInsights` (line 223), `queryInsights` (line 269)
- Dependencies: None
- Status: **WORKING** — but with risk
- Gap:
  - **No try/catch around `JSON.parse`** (lines 334-335). If the database contains malformed JSON in `related_node_ids` or `context` columns, `JSON.parse` will throw, crashing the caller. The `|| '[]'` and `|| '{}'` fallbacks only handle NULL values, not malformed strings.
  - **Property mapping is correct** — all DB columns map to camelCase properties matching the expected insight structure.

---

## SECTION 5: Singleton Factory (Lines 350-361)

### Lines 350: `exports.InsightStore = InsightStore;`
- What triggers it: Module load
- What it calls: N/A
- What calls it: N/A
- Dependencies: N/A
- Status: **WORKING**
- Gap: The `InsightStore` class is exported but only used internally via `getInsightStore()`. No external code directly instantiates it (based on grep results).

### Lines 351: `// ============ SINGLETON FACTORY ============`
- Comment only

### Lines 352: `let _insightStore = null;`
- What triggers it: Module load
- What it calls: N/A
- What calls it: N/A
- Dependencies: N/A
- Status: **WORKING**
- Gap: Module-level singleton state. If the module is required from multiple places, they share the same instance. This is intentional.

### Lines 353-361: `getInsightStore(dbPath)` function
- What triggers it: Called from `BackgroundIndexer.constructor()` (line 88 of `backgroundIndexer.js`)
- What it calls:
  - `new InsightStore(dbPath)` (line 358) — creates instance on first call
- What calls it: `BackgroundIndexer.constructor()` (line 88 of `backgroundIndexer.js`)
- Dependencies: `InsightStore` class (line 48)
- Status: **WORKING** — connected and used
- Gap:
  - **`dbPath` parameter is ignored on subsequent calls** (lines 356-360). Once the singleton is created, passing a different `dbPath` has no effect. This could be confusing if multiple callers try to use different database paths.
  - **No way to reset the singleton.** If the database path needs to change (e.g., during testing), there's no `resetInsightStore()` function. The module must be unloaded and re-required.

### Line 362: `//# sourceMappingURL=insightStore.js.map`
- What triggers it: N/A (source map reference)
- What it calls: N/A
- What calls it: N/A
- Dependencies: `insightStore.js.map` file (not verified to exist)
- Status: **N/A**
- Gap: The `.map` file may or may not exist. Not critical for runtime.

---

## CONNECTION MAP

### What triggers insight storage?
1. **BackgroundIndexer.extractInsights()** (line 436 of `backgroundIndexer.js`) — Primary path. Generates insights from graph nodes and structural analysis, then calls `addInsightsBatch()`.
2. **BackgroundIndexer.executeIncrementalIndex()** (line 355 of `backgroundIndexer.js`) — Incremental path. Clears old insights for changed files via `clearFile()`, then calls `addInsightsBatch()` for new insights.

### What other files get called?
1. `lib/commands/integr8/databasePersister.js` → `getSharedDatabasePath()` (line 50) — fallback database path
2. `better-sqlite3` (npm) — SQLite3 driver
3. `crypto` (Node.js built-in) — UUID generation and hashing

### What files call into InsightStore?
1. `lib/commands/backgroundIndexer.js` — ONLY consumer:
   - Line 88: `getInsightStore(dbPath)` — singleton access
   - Line 176: `clearProject(projectId)` — project removal
   - Line 242: `close()` — shutdown
   - Line 363: `clearFile(projectId, relativePath)` — incremental re-index cleanup
   - Line 376: `addInsightsBatch(insights)` — incremental insight insertion
   - Line 460: `ensureFileSlot(projectId, filePath)` — dependency coupling insights
   - Line 480: `ensureFileSlot(projectId, filePath)` — unused export insights
   - Line 497: `addInsightsBatch(allInsights)` — bulk insight insertion
   - Line 508: `ensureFileSlot(projectId, filePath)` — per-node insight generation

### What insights are stored?
From `BackgroundIndexer.generateNodeInsights()` (lines 502-559 of `backgroundIndexer.js`):
- **Category: `structural`** — File indexed, Pinia store, UI component
- **Category: `api_surface`** — Tauri command
- **Category: `dependency`** — High import count (>15 imports)
- **Category: `unused_export`** — Exports with no detected consumers

### @@@ HANDLING
**No `@@@` symbols found in this file.** The file does not contain any `@@@` markers.

---

## SUMMARY OF FINDINGS

### Dead Code (NOT CONNECTED)
| Method | Lines | Status |
|--------|-------|--------|
| `getFileSlot()` | 108-124 | **NOT CONNECTED** — no callers |
| `addInsight()` | 129-151 | **NOT CONNECTED** — `addInsightsBatch()` used instead |
| `getInsightsForFile()` | 187-191 | **NOT CONNECTED** — no callers |
| `getInsightsByCategory()` | 195-209 | **NOT CONNECTED** — no callers |
| `getRecentInsights()` | 213-224 | **NOT CONNECTED** — no callers |
| `queryInsights()` | 228-270 | **NOT CONNECTED** — no callers |
| `getCategorySummary()` | 274-281 | **NOT CONNECTED** — no callers |
| `getFileSlots()` | 285-296 | **NOT CONNECTED** — no callers |

**8 out of 14 methods are dead code.** Only `ensureFileSlot()`, `addInsightsBatch()`, `clearProject()`, `clearFile()`, `close()`, and the private helpers (`generateFileId()`, `rowToInsight()`) are actually used.

### Bugs
1. **FK enforcement disabled** (missing `PRAGMA foreign_keys = ON`) — Lines 68-82 define a FK constraint that is never enforced. Workaround: manual deletion in `clearProject()` and `clearFile()`.
2. **`JSON.parse` without try/catch** (lines 334-335) — Malformed JSON in DB crashes the reader.
3. **`addInsight()` uses caller-provided `fileId` instead of generated one** (line 146) — potential FK mismatch.
4. **`addInsightsBatch()` same `fileId` mismatch risk** (line 175) — uses `insight.fileId` from input, not the one generated by `ensureFileSlot()`.

### Security
- **No SQL injection risk** — all queries use parameterized statements (`?` placeholders).
- **No hardcoded secrets.**
- **No eval() or dynamic code execution.**

### Quality
- **64% of methods are dead code** — significant maintenance burden.
- **No TypeScript source file** — only compiled JS exists in repo.
- **Inconsistent `categories` field** — `getFileSlot()` populates it (line 122), `getFileSlots()` hardcodes empty array (line 295).
