# Line-by-Line Review: `backend/persistence.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/persistence.js` (704 lines)
**Reviewed:** 2026-05-13
**Reviewer:** GSD-Code-Reviewer (deep analysis)

---

## FILE OVERVIEW

SQLite persistence layer for the ST8 file registry, connections, intent tracking, mutation logging, activity logging, settings, PRD projects, AI content, template variables, and Bruno/Oscar lifecycle management.

**Dependencies:**
- `path` (Node.js built-in)
- `fs` (Node.js built-in)
- `./st8-types` — type constants, `generateFingerprint`
- `better-sqlite3` — direct SQLite driver (fallback)
- `lib/commands/integr8/databasePersister.js` — maestro DatabasePersister (primary, currently broken)

**Exports:** `{ St8Persistence }`

---

## SECTION-BY-SECTION ANALYSIS

---

### Lines 1-11: Shebang + Module Docstring
```js
#!/usr/bin/env node
/**
 * ST8 Persistence — SQLite Database Layer
 * ...
 */
```
- **What triggers it:** Module load
- **What it calls:** N/A
- **What calls it:** N/A (documentation)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

### Lines 13-17: Imports
```js
'use strict';
const path = require('path');
const fs = require('fs');
const { St8FileEntry, LifecyclePhase, FileStatus } = require('./st8-types');
```
- **What triggers it:** Module load
- **What it calls:** `require('./st8-types')`
- **What calls it:** Module loader
- **Dependencies:** `./st8-types`
- **Status:** PARTIAL — **Three imported symbols (`St8FileEntry`, `LifecyclePhase`, `FileStatus`) are NEVER used anywhere in this file.**
- **Gap:**
  - `St8FileEntry` — unused (line 17). Imported but never referenced.
  - `LifecyclePhase` — unused (line 17). Hardcoded strings like `'DEVELOPMENT'`, `'CONCEPT'`, `'PRODUCTION'` are used instead (lines 57, 58, 118, 396, 453).
  - `FileStatus` — unused (line 17). Hardcoded strings like `'RED'` are used instead (lines 54, 214, 396).
  - **Missing import:** `generateFingerprint` is needed (used at line 388) but is re-required inside `registerConceptFile()` instead of being imported here. Should be:
    ```js
    const { generateFingerprint } = require('./st8-types');
    ```
  - **`fs` import** is used only in `loadLibModule()` (line 28). `path` is used throughout.

---

### Lines 19-43: Lib Module Loader + `getDatabasePersister()`
```js
const LIB_DIR = path.join(__dirname, '..', 'lib');
let _databasePersister = null;

function loadLibModule(modulePath) { ... }
function getDatabasePersister() { ... }
```
- **What triggers it:** Called from `initialize()` (line 175)
- **What it calls:** `require(fullPath)` for `lib/commands/integr8/databasePersister.js`
- **What calls it:** `initialize()` → `getDatabasePersister()`
- **Dependencies:** `lib/commands/integr8/databasePersister.js`, `path`, `fs`
- **Status:** **BROKEN** — Maestro DatabasePersister integration is dead code.
- **Gap:**
  - **CRITICAL BUG (lines 175-178):** `getDatabasePersister()` returns the full `module.exports` object from `databasePersister.js`, which is `{ DatabasePersister: class, getSharedDatabasePath: function }` (see lib file lines 41-42, 228). Line 176 checks `typeof DatabasePersister === 'function'` — but since the returned value is an **object** (not a class/function), this check **always evaluates to `false`**. The code always falls through to the `better-sqlite3` fallback at line 181. The maestro `DatabasePersister` path is **never taken**.
  - **Fix:** Line 175-178 should be:
    ```js
    const DatabasePersisterModule = getDatabasePersister();
    if (DatabasePersisterModule && DatabasePersisterModule.DatabasePersister) {
        this.db = new DatabasePersisterModule.DatabasePersister(this.dbPath);
    }
    ```
  - **`loadLibModule` error handling (line 33):** Returns `null` on failure, which causes silent fallback. Errors are logged to console but never surfaced to callers. If the lib module is critical, this should throw instead.

---

### Lines 47-162: `ST8_SCHEMA` — Schema Definition

This is the DDL that creates all tables and indexes. Executed via `this.db.exec(ST8_SCHEMA)` at line 189.

#### Table: `file_registry` (lines 48-73)
| Column | Type | Default | Notes |
|---|---|---|---|
| `fingerprint` | TEXT | — | **PRIMARY KEY**. Format: `filepath\|\|birthTimestamp` |
| `filepath` | TEXT | — | NOT NULL |
| `filename` | TEXT | — | NOT NULL |
| `sha256Hash` | TEXT | — | NOT NULL |
| `fileSizeBytes` | INTEGER | — | |
| `status` | TEXT | `'RED'` | FileStatus enum |
| `reachabilityScore` | REAL | `0.0` | |
| `impactRadius` | INTEGER | `0` | |
| `lifecyclePhase` | TEXT | `'DEVELOPMENT'` | LifecyclePhase enum |
| `birthTimestamp` | TEXT | — | |
| `lastModified` | TEXT | — | |
| `lastIndexed` | TEXT | `CURRENT_TIMESTAMP` | |
| `isEntryPoint` | INTEGER | `0` | Boolean (0/1) |
| `lastAccessed` | TEXT | — | |
| `sessionsSinceAccess` | INTEGER | `0` | |
| `expiryDate` | TEXT | — | |
| `associatedWith` | TEXT | — | |
| `eventTrigger` | TEXT | — | |
| `brunoStatus` | TEXT | `'active'` | |
| `needsAIReview` | INTEGER | `0` | Boolean (0/1) |
| `tripleAtCount` | INTEGER | `0` | `@@@` symbol count |
| `aiContentInjected` | INTEGER | `0` | |
| `templateVariables` | TEXT | — | JSON string |
| `hasUnfilledVariables` | INTEGER | `0` | Boolean (0/1) |

- **Status:** WORKING
- **Gap:**
  - Columns `aiContentInjected` (line 70) is defined but **never written to** by any method in this file. No method sets or reads it. Dead column.
  - `sessionsSinceAccess` (line 63) — incremented by `incrementSessionCounters()` but no method decrements it except `markFileAccessed()` which resets to 0.

#### Table: `connections` (lines 75-87)
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | INTEGER | AUTOINCREMENT | PRIMARY KEY |
| `sourceFingerprint` | TEXT | — | NOT NULL, FK → file_registry |
| `targetFingerprint` | TEXT | — | NOT NULL, FK → file_registry |
| `connectionType` | TEXT | `'IMPORT'` | |
| `importSpecifier` | TEXT | — | |
| `isResolved` | INTEGER | `1` | |
| `confidenceScore` | REAL | `1.0` | |
| `lastVerified` | TEXT | `CURRENT_TIMESTAMP` | |

**UNIQUE constraint:** `(sourceFingerprint, targetFingerprint, connectionType)` (line 86)

- **Status:** WORKING
- **Gap:**
  - **FK enforcement NOT enabled:** Foreign keys are declared (lines 84-85) but `PRAGMA foreign_keys = ON` is never set in `initialize()`. SQLite does NOT enforce FK constraints by default. All FK declarations are **decorative**. Related records can be orphaned.
  - `isResolved` column is declared but never written to by `insertConnection()` — actually it IS written (line 293), but the `getConnectionsForFile()` method returns raw rows without converting it to boolean.

#### Table: `file_intent` (lines 89-97)
| Column | Type | Default | Notes |
|---|---|---|---|
| `fingerprint` | TEXT | — | PRIMARY KEY, FK → file_registry |
| `purpose` | TEXT | — | |
| `dependsOnBehavior` | TEXT | — | |
| `valueStatement` | TEXT | — | |
| `authoredBy` | TEXT | `'INFERRED'` | |
| `lastUpdated` | TEXT | `CURRENT_TIMESTAMP` | |

- **Status:** WORKING
- **Gap:** FK not enforced (same as above).

#### Table: `file_mutation_log` (lines 99-109)
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | INTEGER | AUTOINCREMENT | PRIMARY KEY |
| `fingerprint` | TEXT | — | NOT NULL, FK → file_registry |
| `sha256Hash` | TEXT | — | NOT NULL |
| `mutationType` | TEXT | — | NOT NULL |
| `changedFields` | TEXT | — | JSON |
| `actor` | TEXT | `'DEVELOPER'` | |
| `timestamp` | TEXT | `CURRENT_TIMESTAMP` | |
| `metadata` | TEXT | — | JSON |

- **Status:** WORKING
- **Gap:** FK not enforced.

#### Table: `activity_log` (lines 111-118)
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | INTEGER | AUTOINCREMENT | PRIMARY KEY |
| `timestamp` | TEXT | `CURRENT_TIMESTAMP` | |
| `source` | TEXT | `'INDEXER'` | |
| `action` | TEXT | — | NOT NULL |
| `targetFingerprint` | TEXT | — | No FK constraint |
| `details` | TEXT | — | JSON |

- **Status:** WORKING
- **Gap:**
  - `targetFingerprint` has **no FK constraint** (intentional — activity log may reference deleted files for audit trail).

#### Table: `st8_settings` (lines 129-135)
| Column | Type | Default | Notes |
|---|---|---|---|
| `category` | TEXT | — | NOT NULL, composite PK |
| `key` | TEXT | — | NOT NULL, composite PK |
| `value` | TEXT | — | |
| `updatedAt` | TEXT | `CURRENT_TIMESTAMP` | |

- **Status:** WORKING
- **Gap:** None.

#### Table: `prd_projects` (lines 137-145)
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | INTEGER | AUTOINCREMENT | PRIMARY KEY |
| `name` | TEXT | — | NOT NULL, UNIQUE |
| `path` | TEXT | — | NOT NULL |
| `template` | TEXT | — | NOT NULL |
| `variables` | TEXT | — | JSON |
| `created` | TEXT | `CURRENT_TIMESTAMP` | |
| `updated` | TEXT | `CURRENT_TIMESTAMP` | |

- **Status:** WORKING
- **Gap:** None.

#### Table: `ai_content` (lines 149-155)
| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | INTEGER | AUTOINCREMENT | PRIMARY KEY |
| `filepath` | TEXT | — | NOT NULL |
| `content` | TEXT | — | NOT NULL |
| `reviewed` | INTEGER | `0` | Boolean (0/1) |
| `timestamp` | TEXT | `CURRENT_TIMESTAMP` | |

- **Status:** WORKING
- **Gap:**
  - **No UNIQUE constraint on `filepath`.** The `storeAIContent()` method uses `INSERT OR REPLACE` (line 602), but since the PK is `id` (AUTOINCREMENT), `INSERT OR REPLACE` never triggers a replace — it always inserts a **new row**. Each call creates a duplicate. See line 600-605 analysis.

#### Indexes (lines 120-161)
| Index | Table | Column(s) |
|---|---|---|
| `idx_file_registry_status` | file_registry | status |
| `idx_file_registry_sha256Hash` | file_registry | sha256Hash |
| `idx_file_registry_lifecycle` | file_registry | lifecyclePhase |
| `idx_connections_source` | connections | sourceFingerprint |
| `idx_connections_target` | connections | targetFingerprint |
| `idx_mutation_log_fingerprint` | file_mutation_log | fingerprint |
| `idx_mutation_log_timestamp` | file_mutation_log | timestamp |
| `idx_activity_log_timestamp` | activity_log | timestamp |
| `idx_prd_projects_name` | prd_projects | name |
| `idx_ai_content_filepath` | ai_content | filepath |
| `idx_ai_content_reviewed` | ai_content | reviewed |
| `idx_file_registry_bruno` | file_registry | brunoStatus |
| `idx_file_registry_ai_review` | file_registry | needsAIReview |
| `idx_file_registry_unfilled` | file_registry | hasUnfilledVariables |

- **Status:** WORKING
- **Gap:** None (indexes are reasonable).

---

### Lines 166-196: `St8Persistence` Class — Constructor + `initialize()`

```js
class St8Persistence {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(process.cwd(), 'st8.sqlite');
        this.db = null;
    }
    
    async initialize() { ... }
}
```

- **What triggers it:** `new St8Persistence()` then `await persistence.initialize()`
- **What it calls:** `getDatabasePersister()`, `require('better-sqlite3')`, `this.db.exec(ST8_SCHEMA)`
- **What calls it:** `index.js:79-80`, `server.js:272-273,328-330,399-401,589-591,782-783,856-857,987-988,1024-1025`
- **Dependencies:** `better-sqlite3`, `lib/commands/integr8/databasePersister.js`
- **Status:** PARTIAL
- **Gap:**
  - **`async` without `await` (line 172):** `initialize()` is declared `async` but contains zero `await` statements. All operations are synchronous (better-sqlite3 is sync). The `async` keyword makes it return a Promise, which works with `await persistence.initialize()` callers, but is misleading. If the intent was to support async DatabasePersister, the maestro path would need `await`.
  - **Maestro path broken (line 175-178):** See line 19-43 analysis. `typeof DatabasePersister === 'function'` is always false because `loadLibModule` returns an object, not a class.
  - **No `PRAGMA foreign_keys = ON` (line 183-184):** Only `journal_mode = WAL` and `synchronous = NORMAL` are set. Foreign key constraints in the schema are never enforced. This means:
    - Deleting a file_registry row does NOT cascade to connections, intent, or mutation_log.
    - The `deleteFile()` method (line 245) works around this by manually deleting related records in a transaction, but this is fragile — any new table with FK references will be missed.
  - **Default dbPath uses `process.cwd()` (line 168):** If the working directory changes between runs, different databases are created. Callers should pass an explicit path.

---

### Lines 200-222: `upsertFile(file)`

```js
upsertFile(file) {
    const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_registry
        (fingerprint, filepath, filename, sha256Hash, fileSizeBytes, status,
         reachabilityScore, impactRadius, lifecyclePhase, birthTimestamp,
         lastModified, lastIndexed, isEntryPoint)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    return stmt.run(
        file.fingerprint, file.filepath, file.filename, file.sha256Hash,
        file.fileSizeBytes || 0, file.status || 'RED', file.reachabilityScore || 0.0,
        file.impactRadius || 0, file.lifecyclePhase || 'DEVELOPMENT',
        file.birthTimestamp || new Date().toISOString(),
        file.lastModified || new Date().toISOString(),
        file.isEntryPoint ? 1 : 0
    );
}
```

- **What triggers it:** Initial indexing (`index.js:97`), file watcher changes (`index.js:279,332`)
- **What it calls:** `this.db.prepare()`, `stmt.run()`
- **What calls it:** `index.js:97`, `index.js:279`, `index.js:332`
- **Dependencies:** `better-sqlite3`
- **Status:** PARTIAL
- **Gap:**
  - **`INSERT OR REPLACE` data loss risk (line 201):** `INSERT OR REPLACE` internally does DELETE + INSERT when the PK (`fingerprint`) already exists. If `PRAGMA foreign_keys = ON` is ever enabled with `ON DELETE CASCADE`, this would silently delete all connections, intent, and mutation_log records for the file. With `ON DELETE RESTRICT` (the default), the DELETE would fail, causing the entire upsert to fail for files with related records.
  - **Missing columns:** Does NOT update `lastAccessed`, `sessionsSinceAccess`, `expiryDate`, `associatedWith`, `eventTrigger`, `brunoStatus`, `needsAIReview`, `tripleAtCount`, `aiContentInjected`, `templateVariables`, `hasUnfilledVariables`. These columns get their DEFAULT values on first insert and are preserved on `INSERT OR REPLACE` only because SQLite preserves column values on conflict — wait, no, `INSERT OR REPLACE` DELETES the old row and INSERTS a new one with only the specified columns. **All unspecified columns revert to their defaults.** This means:
    - If a file has `brunoStatus = 'flagged'` and `upsertFile()` is called, `brunoStatus` resets to `'active'`.
    - If a file has `needsAIReview = 1` and `upsertFile()` is called, it resets to `0`.
    - If a file has `templateVariables` set, they're lost.
  - **This is a data corruption bug.** Any call to `upsertFile()` on an existing file wipes lifecycle/bruno/AI/template state.
  - **`|| 0` falsy coercion (lines 213-216):** `file.fileSizeBytes || 0` — if `fileSizeBytes` is legitimately `0` (empty file), this correctly returns `0`. OK. But `file.reachabilityScore || 0.0` — if reachabilityScore is `0.0`, `|| 0.0` returns `0.0`. OK. However, `file.status || 'RED'` — if status is empty string `''`, it defaults to `'RED'`. This might mask bugs.
  - **`file.isEntryPoint ? 1 : 0` (line 220):** Correctly converts boolean to integer for SQLite.
  - **No `return` of meaningful data:** Returns `stmt.run()` result (changes, lastInsertRowid) but callers don't use it.

---

### Lines 224-227: `getFilesByStatus(status)`

```js
getFilesByStatus(status) {
    const stmt = this.db.prepare('SELECT * FROM file_registry WHERE status = ? ORDER BY filepath');
    return stmt.all(status);
}
```

- **What triggers it:** Not called by any production code found. Only referenced in planning docs.
- **What it calls:** `this.db.prepare()`, `stmt.all()`
- **What calls it:** **None found in production code.** Dead method.
- **Dependencies:** None
- **Status:** NOT CONNECTED
- **Gap:** This method appears to be dead code. No caller found in `index.js`, `server.js`, `brunoOscar.js`, `intentSeeder.js`, `schemaCardEmitter.js`, or `gapAnalyzer.js`.

---

### Lines 229-238: `getAllFiles()`

```js
getAllFiles() {
    const stmt = this.db.prepare('SELECT * FROM file_registry ORDER BY filepath');
    const rows = stmt.all();
    return rows.map(row => ({
        ...row,
        isEntryPoint: Boolean(row.isEntryPoint)
    }));
}
```

- **What triggers it:** Indexing, schema card emission, gap analysis, intent seeding, MVP lock, verify, concept file
- **What it calls:** `this.db.prepare()`, `stmt.all()`
- **What calls it:** `index.js` (not directly but via schemaCardEmitter), `server.js:594`, `server.js:859`, `intentSeeder.js:144,178`, `schemaCardEmitter.js:94`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **Only `isEntryPoint` gets boolean conversion.** Other boolean-like INTEGER columns (`needsAIReview`, `hasUnfilledVariables`, `aiContentInjected`) are returned as raw integers (0/1). Inconsistent.
  - **`SELECT *` includes all columns** — callers may get columns they don't expect if schema evolves.

---

### Lines 240-243: `getFileByPath(filepath)`

```js
getFileByPath(filepath) {
    const stmt = this.db.prepare('SELECT * FROM file_registry WHERE filepath = ?');
    return stmt.get(filepath);
}
```

- **What triggers it:** Called internally by `deleteFile()` (line 246)
- **What it calls:** `this.db.prepare()`, `stmt.get()`
- **What calls it:** `deleteFile()` (line 246), `server.js` (not directly, but via `deleteFile`)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **No `getFileByFingerprint()` method.** The fingerprint is the primary identity key used everywhere, but there's no method to look up a single file by fingerprint. Callers must use `getAllFiles()` + `.find()` (e.g., `intentSeeder.js:178-179`).

---

### Lines 245-260: `deleteFile(filepath)`

```js
deleteFile(filepath) {
    const file = this.getFileByPath(filepath);
    if (!file) return { changes: 0 };

    const _deleteFileTx = this.db.transaction((fp, fingerprint) => {
        this.deleteConnectionsForFile(fingerprint);
        this.deleteIntentForFile(fingerprint);
        this.deleteMutationLogForFile(fingerprint);
        const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
        return stmt.run(fp);
    });

    const result = _deleteFileTx(filepath, file.fingerprint);
    return { changes: result.changes, fingerprint: file.fingerprint };
}
```

- **What triggers it:** File watcher unlink event (`index.js:246`)
- **What it calls:** `getFileByPath()`, `this.db.transaction()`, `deleteConnectionsForFile()`, `deleteIntentForFile()`, `deleteMutationLogForFile()`, `this.db.prepare()`
- **What calls it:** `index.js:246`
- **Dependencies:** `getFileByPath()`, `deleteConnectionsForFile()`, `deleteIntentForFile()`, `deleteMutationLogForFile()`
- **Status:** WORKING
- **Gap:**
  - **Does NOT clean up `ai_content` table (line 245-260).** If the deleted file had AI content stored, those rows become orphaned. No `deleteAIContentForFile()` method exists.
  - **Does NOT clean up `activity_log` table.** Activity log entries with `targetFingerprint` pointing to the deleted file remain. This is arguably intentional (audit trail) but inconsistent with the cleanup pattern.
  - **Transaction closure captures `this` correctly** (line 249 — arrow function inherits `this` from constructor scope).
  - **Early return for non-existent file (line 247):** Returns `{ changes: 0 }` without error. Callers must check `changes` to know if deletion occurred.

---

### Lines 262-277: Cascade Delete Helpers

```js
deleteConnectionsForFile(fingerprint) { ... }
deleteIntentForFile(fingerprint) { ... }
deleteMutationLogForFile(fingerprint) { ... }
```

- **What triggers it:** Called from `deleteFile()` transaction (lines 250-252)
- **What it calls:** `this.db.prepare()`, `stmt.run()`
- **What calls it:** `deleteFile()`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **`deleteConnectionsForFile` deletes BOTH directions (line 264):** `WHERE sourceFingerprint = ? OR targetFingerprint = ?`. This is correct — when a file is deleted, all connections where it's source OR target should be removed.
  - These are public methods but are only called internally from `deleteFile()`. Consider making them private (prefix with `_`).

---

### Lines 281-296: `insertConnection(conn)`

```js
insertConnection(conn) {
    const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO connections
        (sourceFingerprint, targetFingerprint, connectionType, importSpecifier,
         isResolved, confidenceScore, lastVerified)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(
        conn.sourceFingerprint, conn.targetFingerprint,
        conn.connectionType ?? 'IMPORT', conn.importSpecifier ?? null,
        conn.isResolved !== undefined ? (conn.isResolved ? 1 : 0) : 1,
        conn.confidenceScore ?? 1.0
    );
}
```

- **What triggers it:** Initial indexing connections pass (`index.js:132`)
- **What it calls:** `this.db.prepare()`, `stmt.run()`
- **What calls it:** `index.js:132`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **`INSERT OR REPLACE` with UNIQUE constraint (line 283):** The UNIQUE constraint on `(sourceFingerprint, targetFingerprint, connectionType)` means `INSERT OR REPLACE` correctly updates existing connections. This is the intended behavior. ✓
  - **`conn.confidenceScore ?? 1.0` (line 294):** Uses nullish coalescing, so `0` is preserved correctly (unlike `||` which would convert `0` to `1.0`). Verified by `verify-persistence-fixes.js` test. ✓
  - **`conn.isResolved !== undefined ? (conn.isResolved ? 1 : 0) : 1` (line 293):** Correctly handles boolean-to-integer conversion with default. ✓

---

### Lines 298-301: `getConnectionsForFile(fingerprint)`

```js
getConnectionsForFile(fingerprint) {
    const stmt = this.db.prepare('SELECT * FROM connections WHERE sourceFingerprint = ? OR targetFingerprint = ?');
    return stmt.all(fingerprint, fingerprint);
}
```

- **What triggers it:** Schema card emission (`schemaCardEmitter.js:129`)
- **What it calls:** `this.db.prepare()`, `stmt.all()`
- **What calls it:** `schemaCardEmitter.js:129`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Returns both directions (as source and as target).

---

### Lines 305-318: `upsertIntent(intent)`

```js
upsertIntent(intent) {
    const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_intent 
        (fingerprint, purpose, dependsOnBehavior, valueStatement, authoredBy, lastUpdated)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(
        intent.fingerprint, intent.purpose || '', intent.dependsOnBehavior || '',
        intent.valueStatement || '', intent.authoredBy || 'INFERRED'
    );
}
```

- **What triggers it:** File intent endpoint (`server.js:332`), concept file registration (`server.js:793`), intent seeding (`intentSeeder.js:211`)
- **What it calls:** `this.db.prepare()`, `stmt.run()`
- **What calls it:** `server.js:332`, `server.js:793`, `intentSeeder.js:211`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **`|| ''` falsy coercion (lines 313-316):** If `intent.purpose` is `null` or `undefined`, defaults to `''`. If it's `0` (unlikely but possible), it also becomes `''`. Acceptable for string fields.

---

### Lines 320-339: Intent Read Methods

```js
getIntent(fingerprint) { ... }
getAllIntents() { ... }
```

- **What triggers it:** `getAllIntents()` — server.js:274,348; schemaCardEmitter.js:95
- **What it calls:** `this.db.prepare()`, `stmt.get()/stmt.all()`
- **What calls it:** `server.js:274`, `server.js:348`, `schemaCardEmitter.js:95`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **`getIntent()` (line 320) not called by any production code.** Only `getAllIntents()` is used. `getIntent()` appears to be dead code.
  - **`getAllIntents()` returns object keyed by fingerprint** (line 328-338) — includes `authoredBy` and `lastUpdated` from DB. `schemaCardEmitter.js:114-118` correctly strips these to only include `purpose`, `dependsOnBehavior`, `valueStatement`.

---

### Lines 343-379: Mutation Log Methods

```js
logMutation(mutation) { ... }         // Line 343
getMutationLog(fingerprint, limit) { ... }  // Line 359
getMutationCount(fingerprint) { ... }       // Line 366
getLastMutation(fingerprint) { ... }        // Line 374
```

- **What triggers it:** Indexing, file watcher, MVP lock, production promote, concept registration
- **What it calls:** `this.db.prepare()`, `stmt.run()/all()/get()`
- **What calls it:** `index.js:113,218,281,334`, `server.js:868`, `registerConceptFile()` (line 401), `purgeDevelopmentData()` (line 443)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **`logMutation` (line 343):** Uses `INSERT` (not `INSERT OR REPLACE`). Correct — mutation logs are append-only. ✓
  - **`getMutationLog` (line 359):** Not called by any production code found. Dead method.
  - **`getMutationCount` (line 366):** Called by `schemaCardEmitter.js:119` and `index.js:310,363`.
  - **`getLastMutation` (line 374):** Returns `null` if no mutations found (line 378: `|| null`). Called by `index.js:307,360` and `schemaCardEmitter.js:120`.

---

### Lines 383-420: `registerConceptFile(conceptEntry)`

```js
registerConceptFile(conceptEntry) {
    const { generateFingerprint } = require('./st8-types');  // Duplicate require!
    const birthTimestamp = new Date().toISOString();
    const fingerprint = generateFingerprint(conceptEntry.filepath, birthTimestamp);
    ...
}
```

- **What triggers it:** Concept file endpoint (`server.js:785`)
- **What it calls:** `require('./st8-types')`, `generateFingerprint()`, `this.db.transaction()`, `this.logMutation()`
- **What calls it:** `server.js:785`
- **Dependencies:** `./st8-types` (re-required)
- **Status:** WORKING
- **Gap:**
  - **Duplicate `require('./st8-types')` (line 386):** Already imported at line 17. Node.js caches modules so no runtime cost, but `generateFingerprint` should be destructured at line 17 instead. This is a code smell, not a bug.
  - **Non-deterministic fingerprint (line 388):** `generateFingerprint(filepath, birthTimestamp)` uses `new Date().toISOString()` as the timestamp. If `registerConceptFile()` is called twice for the same filepath (e.g., duplicate POST request), each call generates a **different** fingerprint (different timestamp). This creates two concept entries for the same file. No deduplication check.
  - **Transaction with 5 params (line 390):** `_registerConceptTx(fp, fname, bts, entry, fpr)` — the `entry` param is only used for `this.logMutation()` metadata (line 407). The function signature is confusing.
  - **`logMutation` inside transaction (line 401):** Calls `this.logMutation()` which does its own `this.db.prepare()` + `stmt.run()`. Inside a `this.db.transaction()` callback, this works because better-sqlite3 transactions are synchronous and reuse the same connection. But it's unusual to call instance methods from within a transaction callback.

---

### Lines 424-461: `purgeDevelopmentData(fingerprint)`

```js
purgeDevelopmentData(fingerprint) {
    // Count outside transaction, then delete + log + update inside transaction
    ...
}
```

- **What triggers it:** Production promote endpoint (`server.js:990`)
- **What it calls:** `this.db.prepare()`, `this.db.transaction()`, `this.logMutation()`
- **What calls it:** `server.js:990`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **Count query outside transaction (lines 429-433):** The count is read before the transaction starts. If another process modifies the mutation log between the count and the transaction, the logged `purgedMutations` count could be stale. Minor race condition, unlikely in practice (single-process Node.js).
  - **`logMutation` inside transaction (line 443):** Same pattern as `registerConceptFile`. Works but unusual.

---

### Lines 465-482: Activity Log Methods

```js
logActivity(activity) { ... }
getRecentActivity(limit) { ... }
```

- **What triggers it:** Indexing, file intent, settings, verify endpoints
- **What it calls:** `this.db.prepare()`, `stmt.run()/all()`
- **What calls it:** `index.js:145`, `server.js:340,696`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **`getRecentActivity` (line 479):** Not called by any production code found. Dead method.
  - **`activity.details` JSON serialization (line 476):** Only stringifies if `activity.details` is truthy. If `details` is `null`, stores `null`. If `details` is `0` or `false`, stores `null` (falsy check). Acceptable.

---

### Lines 486-525: Settings CRUD

```js
upsertSetting(category, key, value) { ... }
getSetting(category, key) { ... }
getSettingsByCategory(category) { ... }
getAllSettings() { ... }
deleteSetting(category, key) { ... }
```

- **What triggers it:** Settings endpoint (`server.js:409,411,447`)
- **What it calls:** `this.db.prepare()`, `stmt.run()/get()/all()`
- **What calls it:** `server.js:409,411,447`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **Empty catch blocks (lines 498, 506, 517):** `catch { return row.value; }` — swallows ALL errors, not just `JSON.parse` errors. If `row.value` is `undefined` or the DB returns an unexpected shape, the error is silently suppressed. Should be `catch (e) { if (e instanceof SyntaxError) return row.value; throw e; }`.
  - **`upsertSetting` JSON serialization (line 491):** `typeof value === 'string' ? value : JSON.stringify(value)` — correctly handles string values vs objects/numbers/booleans. ✓
  - **`deleteSetting` (line 522):** Not called by any production code found. Dead method.

---

### Lines 529-575: Bruno & Oscar Lifecycle Methods

```js
getStaleFiles(threshold) { ... }           // Line 529
updateFileLifecycle(filepath, updates) { ... } // Line 536
incrementSessionCounters() { ... }         // Line 547
markFileAccessed(filepath) { ... }         // Line 554
archiveFile(filepath) { ... }              // Line 561
setExpiryDate(filepath, daysFromNow) { ... } // Line 568
```

- **What triggers it:** Bruno & Oscar lifecycle management (`brunoOscar.js`)
- **What it calls:** `this.db.prepare()`, `stmt.run()/all()`
- **What calls it:** `brunoOscar.js:26,31,77,78,113,132`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **`updateFileLifecycle` SQL injection risk (line 543):** Column names are interpolated directly into SQL: `` `UPDATE file_registry SET ${setClause} WHERE filepath = ?` ``. The `allowedFields` whitelist (lines 537-538) mitigates this, but the pattern is dangerous:
    ```js
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    ```
    If `allowedFields` is ever expanded to include user-controllable data, this becomes a SQL injection vector. Current whitelist is safe: `['lastAccessed', 'sessionsSinceAccess', 'expiryDate', 'associatedWith', 'eventTrigger', 'brunoStatus']`.
  - **`incrementSessionCounters` (line 547):** Not called by any production code in `backend/`. May be called externally or is dead code.
  - **`markFileAccessed` (line 554):** Not called by any production code in `backend/`. May be called externally or is dead code.

---

### Lines 579-612: `@@@` Symbol Methods

```js
flagForAIReview(filepath, tripleAtCount) { ... }   // Line 579
markAIReviewed(filepath) { ... }                     // Line 586
getFilesNeedingAIReview() { ... }                    // Line 593
storeAIContent(filepath, content) { ... }            // Line 600
getAIContent(filepath) { ... }                       // Line 607
```

- **What triggers it:** Intent seeder detects `@@@` symbols (`intentSeeder.js:194`), AI review workflow
- **What it calls:** `this.db.prepare()`, `stmt.run()/all()`
- **What calls it:** `intentSeeder.js:194` (flagForAIReview)
- **Dependencies:** `ai_content` table
- **Status:** PARTIAL
- **Gap:**
  - **`@@@` symbol context (line 577):** The `@@@` symbol is a marker in source files indicating "needs AI review." The `intentSeeder.js:188` pattern `/(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm` detects these. When found, `flagForAIReview()` sets `needsAIReview = 1` and `tripleAtCount`.
  - **`storeAIContent` bug (line 600-605):** Uses `INSERT OR REPLACE INTO ai_content (filepath, content, reviewed, timestamp) VALUES (?, ?, 0, CURRENT_TIMESTAMP)`. But the PRIMARY KEY is `id` (AUTOINCREMENT), not `filepath`. `INSERT OR REPLACE` only triggers on PK conflict, which NEVER happens with AUTOINCREMENT. Every call inserts a **new row** with a new `id`. The method name implies it should update existing content, but it always creates duplicates.
  - **Fix:** Either:
    1. Add a UNIQUE constraint on `filepath` to the `ai_content` table schema (line 149), OR
    2. Use `INSERT INTO ai_content ... ON CONFLICT(filepath) DO UPDATE SET content = ?, reviewed = 0, timestamp = CURRENT_TIMESTAMP` (requires UNIQUE constraint), OR
    3. Check for existing row first: `DELETE FROM ai_content WHERE filepath = ?` then `INSERT`.
  - **`markAIReviewed` (line 586):** Not called by any production code found. Dead method.
  - **`getFilesNeedingAIReview` (line 593):** Not called by any production code found. Dead method.
  - **`getAIContent` (line 607):** Returns ALL records for filepath (ordered by timestamp DESC). Due to `storeAIContent` bug, this returns growing duplicates.

---

### Lines 616-636: Template Variable Methods

```js
setTemplateVariables(filepath, variables) { ... }
getTemplateVariables(filepath) { ... }
```

- **What triggers it:** Template system (external callers)
- **What it calls:** `this.db.prepare()`, `stmt.run()/get()`
- **What calls it:** No callers found in production code.
- **Dependencies:** None
- **Status:** NOT CONNECTED
- **Gap:**
  - **No production callers found.** Both methods appear to be dead code in the current codebase.
  - **`setTemplateVariables` (line 616):** Correctly detects unfilled variables: `Object.values(variables).some(v => v === null || v === undefined || v === '')`. ✓

---

### Lines 640-681: PRD Project CRUD

```js
createPRDProject(name, projectPath, template, variables) { ... }
getPRDProject(name) { ... }
getAllPRDProjects() { ... }
updatePRDProject(name, updates) { ... }
deletePRDProject(name) { ... }
```

- **What triggers it:** PRD project management endpoints
- **What it calls:** `this.db.prepare()`, `stmt.run()/get()/all()`
- **What calls it:** No callers found in production code (`server.js`, `index.js`).
- **Dependencies:** None
- **Status:** NOT CONNECTED
- **Gap:**
  - **No production callers found.** All PRD project methods appear to be dead code in the current codebase.
  - **`updatePRDProject` SQL injection risk (line 673):** Same pattern as `updateFileLifecycle`. Column names interpolated directly into SQL. Whitelist mitigates: `['path', 'template', 'variables']`.
  - **`getPRDProject` / `getAllPRDProjects` empty catch (lines 651, 661):** `try { row.variables = JSON.parse(row.variables); } catch { }` — silently swallows JSON parse errors. If `variables` is corrupted JSON, the raw string is silently returned.
  - **`createPRDProject` (line 640):** Uses `INSERT` (not `INSERT OR REPLACE`). Will throw if name already exists (UNIQUE constraint). Callers must handle the error.

---

### Lines 685-697: `close()`

```js
close() {
    if (this.db) {
        try {
            this.db.close();
        } catch (err) {
            if (!err.message.includes('Database is closed')) {
                throw err;
            }
        }
        this.db = null;
    }
}
```

- **What triggers it:** Cleanup in all server endpoints and index.js
- **What it calls:** `this.db.close()`
- **What calls it:** `index.js:422,426`, all `server.js` endpoint handlers in `finally` blocks
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **"Database is closed" error suppression (line 691):** Intentionally ignores double-close errors. This is a safety net for multiple `finally` blocks or error paths. Acceptable pattern.
  - **No `close()` idempotency issue:** `this.db = null` after close prevents double-close from crashing. ✓

---

### Lines 702-704: Exports

```js
module.exports = {
    St8Persistence
};
```

- **Status:** WORKING
- **Gap:** Only `St8Persistence` is exported. The helper functions (`loadLibModule`, `getDatabasePersister`) and `ST8_SCHEMA` constant are private. This is correct encapsulation.

---

## CROSS-FILE CONNECTION MAP

### Callers of `St8Persistence` methods

| Method | Called From | Line(s) |
|---|---|---|
| `new St8Persistence()` | `index.js:79`, `server.js:272,328,399,589,782,856,987,1024` | Multiple |
| `initialize()` | `index.js:80`, `server.js:273,330,401,591,783,857,988,1025` | Multiple |
| `upsertFile()` | `index.js:97,279,332` | 3 callers |
| `logMutation()` | `index.js:113,218,281,334`, `server.js:868`, internal (lines 401,443) | 6+ callers |
| `insertConnection()` | `index.js:132` | 1 caller |
| `logActivity()` | `index.js:145`, `server.js:340,696` | 3 callers |
| `deleteFile()` | `index.js:246` | 1 caller |
| `getLastMutation()` | `index.js:307,360`, `schemaCardEmitter.js:120` | 3 callers |
| `getMutationCount()` | `index.js:310,363`, `schemaCardEmitter.js:119` | 3 callers |
| `close()` | `index.js:422,426`, all `server.js` finally blocks | Multiple |
| `getAllFiles()` | `server.js:594,859`, `intentSeeder.js:144,178`, `schemaCardEmitter.js:94` | 5 callers |
| `getAllIntents()` | `server.js:274,348`, `schemaCardEmitter.js:95` | 3 callers |
| `upsertIntent()` | `server.js:332,793`, `intentSeeder.js:211` | 3 callers |
| `upsertSetting()` | `server.js:447` | 1 caller |
| `getSettingsByCategory()` | `server.js:409` | 1 caller |
| `getAllSettings()` | `server.js:411` | 1 caller |
| `registerConceptFile()` | `server.js:785` | 1 caller |
| `purgeDevelopmentData()` | `server.js:990` | 1 caller |
| `flagForAIReview()` | `intentSeeder.js:194` | 1 caller |
| `getStaleFiles()` | `brunoOscar.js:26` | 1 caller |
| `updateFileLifecycle()` | `brunoOscar.js:31,113,132` | 3 callers |
| `archiveFile()` | `brunoOscar.js:77` | 1 caller |
| `setExpiryDate()` | `brunoOscar.js:78` | 1 caller |
| `getConnectionsForFile()` | `schemaCardEmitter.js:129` | 1 caller |

### Dead Methods (No Production Callers)

| Method | Line | Notes |
|---|---|---|
| `getFilesByStatus()` | 224 | Not called by any production code |
| `getIntent()` | 320 | `getAllIntents()` used instead |
| `getMutationLog()` | 359 | Not called by any production code |
| `getRecentActivity()` | 479 | Not called by any production code |
| `deleteSetting()` | 522 | Not called by any production code |
| `incrementSessionCounters()` | 547 | Not called by any production code |
| `markFileAccessed()` | 554 | Not called by any production code |
| `markAIReviewed()` | 586 | Not called by any production code |
| `getFilesNeedingAIReview()` | 593 | Not called by any production code |
| `setTemplateVariables()` | 616 | Not called by any production code |
| `getTemplateVariables()` | 625 | Not called by any production code |
| `createPRDProject()` | 640 | Not called by any production code |
| `getPRDProject()` | 647 | Not called by any production code |
| `getAllPRDProjects()` | 656 | Not called by any production code |
| `updatePRDProject()` | 667 | Not called by any production code |
| `deletePRDProject()` | 678 | Not called by any production code |

### Abstraction Leaks (`persistence.db.prepare()` Direct Access)

| Caller | File | Line | Context |
|---|---|---|---|
| `brunoOscar.js` | `brunoOscar.js` | 69 | Direct SQL: `SELECT * FROM file_registry WHERE brunoStatus = 'flagged'` |
| `brunoOscar.js` | `brunoOscar.js` | 125 | Direct SQL: `SELECT * FROM file_registry WHERE eventTrigger = ?` |
| `server.js` | `server.js` | 864 | Direct SQL: `UPDATE file_registry SET lifecyclePhase = 'LOCKED'` |

These bypass the persistence API and access `this.db` / `persistence.db` directly. If the database layer is ever wrapped or the schema changes, these break silently.

---

## `@@@` HANDLING

| Location | Line | Context |
|---|---|---|
| `persistence.js` | 577 | Section header: `// ─── @@@ SYMBOL METHODS ────────────────────────` |
| `persistence.js` | 579-584 | `flagForAIReview(filepath, tripleAtCount)` — sets `needsAIReview=1`, `tripleAtCount` |
| `persistence.js` | 586-591 | `markAIReviewed(filepath)` — sets `needsAIReview=0` (dead code) |
| `persistence.js` | 593-598 | `getFilesNeedingAIReview()` — query for `needsAIReview=1` (dead code) |
| `persistence.js` | 600-605 | `storeAIContent(filepath, content)` — stores AI-generated content (buggy — always inserts) |
| `persistence.js` | 607-612 | `getAIContent(filepath)` — retrieves AI content by filepath |
| `intentSeeder.js` | 187-195 | Detection: `TRIPLE_AT_PATTERN = /(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm` |
| `intentSeeder.js` | 194 | Calls `persistence.flagForAIReview(file.filepath, tripleAtCount)` |
| `brunoOscar.js` | 173 | Writes `@@@` marker: `<!-- @@@ Content from ... — APPENDED BY OSCAR @@@ -->` |

The `@@@` system works as follows:
1. `intentSeeder.js` scans file content for `@@@` patterns
2. If found, calls `persistence.flagForAIReview()` to set `needsAIReview=1`
3. `persistence.getFilesNeedingAIReview()` returns flagged files (but is dead code — no caller)
4. `persistence.storeAIContent()` stores AI responses (but has the always-insert bug)
5. `brunoOscar.js` uses `@@@` as a marker when appending archived file content to parents

---

## FINDINGS SUMMARY

### Critical Issues

| ID | Line(s) | Issue |
|---|---|---|
| CR-01 | 175-178 | **Maestro DatabasePersister integration is dead.** `typeof DatabasePersister === 'function'` always returns `false` because `loadLibModule` returns `{ DatabasePersister: class }` (an object). The code always falls through to `better-sqlite3`. |
| CR-02 | 201 | **`upsertFile` uses `INSERT OR REPLACE` which DELETEs + re-INSERTs.** Unspecified columns revert to defaults, wiping `brunoStatus`, `needsAIReview`, `templateVariables`, and all other lifecycle state for existing files. |
| CR-03 | 602 | **`storeAIContent` never replaces.** `INSERT OR REPLACE` on an AUTOINCREMENT PK always inserts a new row. No UNIQUE constraint on `filepath` means duplicate records accumulate on every call. |

### Warnings

| ID | Line(s) | Issue |
|---|---|---|
| WR-01 | 17 | **Unused imports:** `St8FileEntry`, `LifecyclePhase`, `FileStatus` imported from `./st8-types` but never referenced. All enum values are hardcoded as strings. |
| WR-02 | 386 | **Duplicate `require('./st8-types')`** inside `registerConceptFile()`. Should destructure `generateFingerprint` at line 17. |
| WR-03 | 172 | **`async initialize()` with no `await`.** All operations are synchronous. The `async` keyword is misleading. |
| WR-04 | 183-184 | **No `PRAGMA foreign_keys = ON`.** All FK constraints in the schema are decorative. Orphaned records possible. |
| WR-05 | 498,506,517,651,661 | **Empty `catch` blocks** in JSON.parse fallbacks. Swallows all errors, not just `SyntaxError`. |
| WR-06 | 245-260 | **`deleteFile` does not clean up `ai_content` table.** Orphaned AI content records. |
| WR-07 | 543,673 | **SQL column name interpolation** in `updateFileLifecycle` and `updatePRDProject`. Whitelist mitigates, but pattern is fragile. |

### Info

| ID | Line(s) | Issue |
|---|---|---|
| IN-01 | 224,320,359,479,522,547,554,586,593,616,625,640,647,656,667,678 | **16 dead methods** with no production callers. Significant code surface with no consumers. |
| IN-02 | 69,125 (brunoOscar.js), 864 (server.js) | **Abstraction leak:** Three callers access `persistence.db.prepare()` directly instead of using persistence methods. |
| IN-03 | 70 | **Dead column:** `aiContentInjected` defined in schema but never written to by any method. |
| IN-04 | 178 | **`console.log` artifacts:** Multiple `console.log`/`console.error` calls throughout for debugging (lines 33, 178, 185, 190, 193). |

---

_Reviewed: 2026-05-13_
_Reviewer: GSD-Code-Reviewer_
_Depth: deep_
