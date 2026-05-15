# Persistence & Database

**Cluster:** persistence-and-database
**Scope:** the single SQLite layer that owns `st8.sqlite` — its schema, the `St8Persistence` API, the maestro-derived `DatabasePersister` fallthrough, FK semantics, and the built-in verification script.

Files in scope:
- `/home/user/st8/src/core/database/persistence.js` — the ~840-line wrapper around `better-sqlite3` and the home of `ST8_SCHEMA`.
- `/home/user/st8/src/core/database/graph-persister.js` — maestro-derived class (`DatabasePersister`) that st8 *tries* to load first, plus `getSharedDatabasePath()` used by insight-store.
- `/home/user/st8/src/core/database/verify-persistence-fixes.js` — built-in 10-test smoke script.

This is the only file in the codebase that issues `CREATE TABLE` statements against `st8.sqlite`. Every other module talks to the DB through a `St8Persistence` method.

---

## 1. The fingerprint contract

Everything FK-relevant hangs off the **fingerprint** — the same identifier defined in `/home/user/st8/src/shared/types/st8-types.js`:

```
fingerprint = "<filepath>||<ISO-birthTimestamp>"
```

Inside `st8.sqlite` the fingerprint is:

- The `PRIMARY KEY` of `file_registry`.
- The `PRIMARY KEY` of `file_intent` (and the FK back to `file_registry.fingerprint`).
- The FK targets `sourceFingerprint` + `targetFingerprint` on `connections`.
- The FK on `file_mutation_log.fingerprint`.
- The FK on `tickets.fingerprint`.

A given filepath can produce **multiple fingerprints** over time (one per `birthTimestamp` — re-created files get a new identity). The schema therefore has no UNIQUE constraint on `file_registry.filepath`; per-filepath queries can return more than one row. This is the root of the FK gotcha in §4.

---

## 2. Tables in `st8.sqlite`

Nine tables live in this database. All are declared in the single `ST8_SCHEMA` template literal at `persistence.js` L50-L198 and applied via `this.db.exec(ST8_SCHEMA)` during `initialize()`.

### 2.1 `file_registry` — the canonical file index

Primary key on `fingerprint`. Default `status='RED'`, default `lifecyclePhase='DEVELOPMENT'`, default `brunoStatus='active'`.

```sql
CREATE TABLE IF NOT EXISTS file_registry (
  fingerprint TEXT PRIMARY KEY,
  filepath TEXT NOT NULL,
  filename TEXT NOT NULL,
  sha256Hash TEXT NOT NULL,
  fileSizeBytes INTEGER,
  status TEXT DEFAULT 'RED',
  reachabilityScore REAL DEFAULT 0.0,
  impactRadius INTEGER DEFAULT 0,
  lifecyclePhase TEXT DEFAULT 'DEVELOPMENT',
  birthTimestamp TEXT,
  lastModified TEXT,
  lastIndexed TEXT DEFAULT CURRENT_TIMESTAMP,
  isEntryPoint INTEGER DEFAULT 0,
  lastAccessed TEXT,
  sessionsSinceAccess INTEGER DEFAULT 0,
  expiryDate TEXT,
  associatedWith TEXT,
  eventTrigger TEXT,
  brunoStatus TEXT DEFAULT 'active',
  needsAIReview INTEGER DEFAULT 0,
  tripleAtCount INTEGER DEFAULT 0,
  aiContentInjected INTEGER DEFAULT 0,
  templateVariables TEXT,
  hasUnfilledVariables INTEGER DEFAULT 0
);
```

Indexes: `status`, `sha256Hash`, `lifecyclePhase`, `brunoStatus`, `needsAIReview`, `hasUnfilledVariables`.

The last five columns (`needsAIReview`, `tripleAtCount`, `aiContentInjected`, `templateVariables`, `hasUnfilledVariables`) were added later — `CREATE TABLE IF NOT EXISTS` won't add them to an existing DB. New columns currently rely on `ALTER TABLE` patches applied elsewhere or a fresh-DB boot. See §8 (no migration framework).

### 2.2 `connections` — the import/export graph

```sql
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceFingerprint TEXT NOT NULL,
  targetFingerprint TEXT NOT NULL,
  connectionType TEXT DEFAULT 'IMPORT',
  importSpecifier TEXT,
  isResolved INTEGER DEFAULT 1,
  confidenceScore REAL DEFAULT 1.0,
  lastVerified TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sourceFingerprint) REFERENCES file_registry(fingerprint),
  FOREIGN KEY (targetFingerprint) REFERENCES file_registry(fingerprint),
  UNIQUE(sourceFingerprint, targetFingerprint, connectionType)
);
```

Indexes: `sourceFingerprint`, `targetFingerprint`. The composite UNIQUE on `(source, target, connectionType)` lets `INSERT OR REPLACE` upsert the same edge in different connectionType variants (one `IMPORT`, one `EXPORT`, one `DYNAMIC`, etc.).

### 2.3 `file_intent` — purpose/value/dependsOn

```sql
CREATE TABLE IF NOT EXISTS file_intent (
  fingerprint TEXT PRIMARY KEY,
  purpose TEXT,
  dependsOnBehavior TEXT,
  valueStatement TEXT,
  authoredBy TEXT DEFAULT 'INFERRED',
  lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);
```

One row per file. `authoredBy` is `'INFERRED'` for seeder output, `'HUMAN'` once a person edits it through the UI.

### 2.4 `file_mutation_log` — the WAL of change events

```sql
CREATE TABLE IF NOT EXISTS file_mutation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  sha256Hash TEXT NOT NULL,
  mutationType TEXT NOT NULL,
  changedFields TEXT,
  actor TEXT DEFAULT 'DEVELOPER',
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);
```

Indexes: `fingerprint`, `timestamp`. `mutationType` is freeform but the codebase consistently uses `'CONCEPT'`, `'PRODUCTION'`, `'PURGE'`, plus content-mutation strings. `changedFields` and `metadata` are JSON-as-TEXT.

### 2.5 `activity_log` — UI-facing event ledger

```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'INDEXER',
  action TEXT NOT NULL,
  targetFingerprint TEXT,
  details TEXT
);
```

Index: `timestamp`. Note: `targetFingerprint` is **not** an FK (deliberately — activity can reference a file that was later deleted). The column name is `targetFingerprint` (camelCase). See §8 / hooks-cluster bug: `app.js:1558` writes `target_fingerprint` (snake_case) which silently nulls.

### 2.6 `st8_settings` — composite-key kv store

```sql
CREATE TABLE IF NOT EXISTS st8_settings (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, key)
);
```

`value` is stored as TEXT — `upsertSetting` JSON-stringifies non-strings; getters try `JSON.parse` and fall back to raw.

### 2.7 `prd_projects` — PRD scaffold tracking

```sql
CREATE TABLE IF NOT EXISTS prd_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  template TEXT NOT NULL,
  variables TEXT,
  created TEXT DEFAULT CURRENT_TIMESTAMP,
  updated TEXT DEFAULT CURRENT_TIMESTAMP
);
```

Index: `name`. `variables` is JSON-as-TEXT. The PRD generator (`/home/user/st8/src/features/prd/`) is wired but only lightly exercised; consult the analysis cluster doc for current usage.

### 2.8 `ai_content` — `@@@`-flagged content store

```sql
CREATE TABLE IF NOT EXISTS ai_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filepath TEXT NOT NULL,
  content TEXT NOT NULL,
  reviewed INTEGER DEFAULT 0,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);
```

Indexes: `filepath`, `reviewed`. **No FK to `file_registry`** — by design or oversight? See §8.

### 2.9 `tickets` — the new (batch 031) human-to-LLM channel

```sql
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  filepath TEXT NOT NULL,
  sha256Hash TEXT,
  statusAtCreation TEXT,
  userNote TEXT NOT NULL,
  identityBundle TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  claimedAt TEXT,
  claimedBy TEXT,
  resolvedAt TEXT,
  resolution TEXT,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);
```

Indexes: `filepath`, `resolvedAt` (the "open tickets" filter), `fingerprint`.

Lifecycle (per persistence.js L172-178 comment): **created → [optional claimed by LLM] → resolved**. `identityBundle` is a JSON blob — schema card + intent + recent mutations — captured at ticket creation time so a later resolver can prove what changed. `claimedBy` is freeform TEXT — no `providers` enum/table.

---

## 3. The fingerprint as cross-table contract

| Table | Column | Role |
|---|---|---|
| `file_registry` | `fingerprint` | PRIMARY KEY |
| `file_intent` | `fingerprint` | PRIMARY KEY + FK |
| `connections` | `sourceFingerprint`, `targetFingerprint` | FK x2 |
| `file_mutation_log` | `fingerprint` | FK (no UNIQUE — many rows per file) |
| `tickets` | `fingerprint` | FK (snapshot of identity at creation) |
| `activity_log` | `targetFingerprint` | nullable, **no FK** (intentional — can outlive the file) |
| `ai_content` | (`filepath` only) | no fingerprint column, no FK |
| `prd_projects`, `st8_settings`, `GraphNodes/GraphEdges/...` | n/a | unrelated namespaces |

---

## 4. FK cascade rules (read this before deleting anything)

SQLite does **not** automatically cascade — `PRAGMA foreign_keys = ON` is also not set in `St8Persistence.initialize()`, so FKs are declarative only. Cascade is implemented manually in JS inside transactions.

### `deleteFile(filepath)` — L281

1. Look up the file by filepath (`getFileByPath`).
2. Inside a single `this.db.transaction`:
   - `deleteConnectionsForFile(fingerprint)` — drops every row where the file is source OR target.
   - `deleteIntentForFile(fingerprint)` — drops the `file_intent` row.
   - `deleteMutationLogForFile(fingerprint)` — drops every `file_mutation_log` row.
   - `DELETE FROM file_registry WHERE filepath = ?` — note: deletes BY FILEPATH.

**The FK-unsafe-at-scale gotcha.** `file_registry` allows multiple rows per filepath (different `birthTimestamp` → different `fingerprint`). If two such rows exist, `deleteFile(filepath)` will:
- Pick whichever row `getFileByPath` returns first (no `ORDER BY` — first row in physical layout).
- Cascade only **that one fingerprint's** child rows.
- Then delete **both** rows from `file_registry` via the filepath-keyed final statement.
- Leave the other fingerprint's children (connections, intent, mutation_log) dangling → FK violation in any consumer that re-enables `PRAGMA foreign_keys`.

The fix is `pruneFilesNotIn` (batch 026).

### `pruneFilesNotIn(currentFilepaths)` — L314

The correct shape. Operates **per-fingerprint** in a single transaction:

```js
for (const f of stale) {
  this.deleteConnectionsForFile(f.fingerprint);
  this.deleteIntentForFile(f.fingerprint);
  this.deleteMutationLogForFile(f.fingerprint);
  deleteRowStmt.run(f.fingerprint);  // <-- DELETE BY FINGERPRINT
}
```

Called as Pass-0 at the top of every indexer pass (`main.js`) so accumulated rows from prior runs are dropped before the new upsert wave.

The JSDoc on `pruneFilesNotIn` (L298-313) is the only place in the codebase that documents this gotcha. `deleteFile` itself has no warning comment.

### `tickets` cascade

There is **no cascade** for tickets. Deleting a `file_registry` row leaves its tickets orphaned with a dangling FK. This is currently safe only because `PRAGMA foreign_keys` is off; tickets queries don't JOIN on file_registry, they read denormalized `filepath` directly. See roadmap P3.4.

---

## 5. The `St8Persistence` public API

`St8Persistence` is the only class in `persistence.js`. Constructed with an optional `dbPath` (defaults to `cwd/st8.sqlite`). `initialize()` is async — it tries the maestro path, falls through to `better-sqlite3` direct, then applies the schema.

Methods grouped by purpose:

### File lifecycle (file_registry)

| Method | Notes |
|---|---|
| `upsertFile(file)` | `INSERT OR REPLACE` keyed on `fingerprint` |
| `getFileByPath(filepath)` | First match — no `ORDER BY` |
| `getFilesByStatus(status)` | Ordered by filepath |
| `getAllFiles()` | Ordered by filepath; coerces `isEntryPoint` to bool |
| `deleteFile(filepath)` | **FK-unsafe at scale** — see §4 |
| `pruneFilesNotIn(currentFilepaths)` | The safe bulk-clean — §4 |
| `registerConceptFile(conceptEntry)` | Inserts a `CONCEPT` lifecycle row + auto-logs mutation |
| `getStaleFiles(threshold)` | Bruno query (`sessionsSinceAccess >= threshold`) |
| `updateFileLifecycle(filepath, updates)` | Whitelisted field set (lastAccessed/sessionsSinceAccess/expiryDate/associatedWith/eventTrigger/brunoStatus) |
| `incrementSessionCounters()` | Bumps `sessionsSinceAccess` for all active rows |
| `markFileAccessed(filepath)` / `archiveFile(filepath)` / `setExpiryDate(filepath, days)` | Bruno + Oscar helpers |
| `flagForAIReview(filepath, count)` / `markAIReviewed(filepath)` / `getFilesNeedingAIReview()` | `@@@` symbol handling |
| `setTemplateVariables(filepath, vars)` / `getTemplateVariables(filepath)` | JSON-as-TEXT round-trip |

### Connections

| Method | Notes |
|---|---|
| `insertConnection(conn)` | `INSERT OR REPLACE` on the (source, target, type) UNIQUE |
| `getConnectionsForFile(fingerprint)` | Both directions |
| `deleteConnectionsForFile(fingerprint)` | Cascade helper |

### File intent

| Method | Notes |
|---|---|
| `upsertIntent(intent)` | `INSERT OR REPLACE` on fingerprint |
| `getIntent(fingerprint)` | Single row |
| `getAllIntents()` | Returns an object keyed by fingerprint (not an array) |
| `deleteIntentForFile(fingerprint)` | Cascade helper |

### Mutation log

| Method | Notes |
|---|---|
| `logMutation(mutation)` | Append-only |
| `getMutationLog(fingerprint, limit=50)` | Newest first |
| `getMutationCount(fingerprint)` | Row count |
| `getLastMutation(fingerprint)` | Newest row or null |
| `deleteMutationLogForFile(fingerprint)` | Cascade helper |
| `purgeDevelopmentData(fingerprint)` | Atomic: drops non-PRODUCTION/PURGE rows, writes a `PURGE` marker, flips lifecycle → PRODUCTION |

### Activity log

| Method | Notes |
|---|---|
| `logActivity(activity)` | `activity.targetFingerprint` is the **camelCase** key the method reads (snake_case is silently nulled) |
| `getRecentActivity(limit=50)` | Newest first |

### Settings

| Method | Notes |
|---|---|
| `upsertSetting(category, key, value)` | JSON-stringifies non-strings |
| `getSetting(category, key)` | Tries JSON.parse, falls back to raw |
| `getSettingsByCategory(category)` | Flat `{key: value}` |
| `getAllSettings()` | Nested `{category: {key: value}}` |
| `deleteSetting(category, key)` | Hard delete |

### PRD projects

| Method | Notes |
|---|---|
| `createPRDProject(name, path, template, variables)` | `variables` JSON-stringified |
| `getPRDProject(name)` / `getAllPRDProjects()` | Re-parses `variables` |
| `updatePRDProject(name, updates)` | Whitelisted (path/template/variables) |
| `deletePRDProject(name)` | Hard delete |

### AI content

| Method | Notes |
|---|---|
| `storeAIContent(filepath, content)` | `INSERT OR REPLACE` keyed on… nothing — duplicates accumulate |
| `getAIContent(filepath)` | All rows, newest first |

(Note: the method comment says "INSERT OR REPLACE" but no UNIQUE constraint exists on the table — each call is effectively an INSERT.)

### Tickets (new — batch 031)

| Method | Notes |
|---|---|
| `createTicket({fingerprint, filepath, sha256Hash, statusAtCreation, userNote, identityBundle})` | JSON-stringifies `identityBundle`; returns `{id, createdAt}` |
| `getOpenTickets(limit=200)` | `resolvedAt IS NULL`, newest first |
| `countOpenTickets()` | Drives the phreak> TUI badge |
| `claimTicket(id, claimedBy)` | Only sets if `claimedAt IS NULL` |
| `resolveTicket(id, resolution)` | Sets `resolvedAt = CURRENT_TIMESTAMP` |

### Utility

| Method | Notes |
|---|---|
| `initialize()` | Async — tries maestro, falls through to `better-sqlite3` direct, exec's `ST8_SCHEMA` |
| `close()` | Tolerates "Database is closed" |

---

## 6. The maestro `DatabasePersister` fallthrough

`St8Persistence.initialize()` first tries to load the maestro-derived class:

```js
const DatabasePersister = getDatabasePersister();
if (DatabasePersister && typeof DatabasePersister === 'function') {
    this.db = new DatabasePersister(this.dbPath);
    console.log('[st8:persistence] Using maestro DatabasePersister');
} else {
    const Database = require('better-sqlite3');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    console.log('[st8:persistence] Using better-sqlite3 directly');
}
```

`getDatabasePersister()` lazily loads `./graph-persister.js`. That module exports the class as `exports.DatabasePersister = DatabasePersister` — i.e. the module's default export is the `exports` object, not the class. So `typeof DatabasePersister === 'function'` is **always false**, the maestro path **never** runs at boot, and st8 always reaches the fallthrough.

Per batch 002 verification, this is **intentional** — st8's schema is the project-scoped `st8.sqlite`, not maestro's `scaffolder_data.sqlite`. The maestro path persists graph/migration data for the unrelated integr8 pipeline. The fallthrough log line `[st8:persistence] Using better-sqlite3 directly` is the expected outcome on every boot.

`graph-persister.js` is also imported separately by insight-store via its `getSharedDatabasePath()` export (Linux: `~/.local/share/com.scaffolder.app/scaffolder_data.sqlite`). That code path is a different database file and has nothing to do with `st8.sqlite`.

The `GraphNodes` / `GraphEdges` / `MigrationPlans` / `IntegrationSnapshots` tables defined in `graph-persister.js`'s `initializeDatabase()` are **not** part of `st8.sqlite`'s 9-table schema — they live in the maestro-scoped DB only.

---

## 7. The bundled verification script

`/home/user/st8/src/core/database/verify-persistence-fixes.js` runs 10 assertions against an in-memory SQLite (`:memory:`) and asserts the three "fix" tickets that prompted its creation:

- **CR-01** — `connections` UNIQUE constraint: same `(source, target, type)` triple inserts once and replaces the existing row; differing `connectionType` is allowed as a second row.
- **CR-02** — `deleteFile()` cascades through `file_mutation_log` (verified via `registerConceptFile` which auto-logs a mutation).
- **CR-03** — `confidenceScore: 0` is **preserved** by `insertConnection` (not coerced to the 1.0 default); `undefined` still defaults to 1.0.

Batch 010 verification: ran from both original and new location → `=== Results: 10 passed, 0 failed ===` identical output. The script `process.exit`s on completion — verify.js's sub-process probe (added batch 010) intercepts that so it doesn't kill the verifier.

It is a script, not a library — never imported anywhere. Living under `src/core/database/` makes the verifier discoverable next to its target but mixes script/library concerns in the same directory.

---

## 8. Known caveats

### 8.1 No migration framework

The schema is one giant template literal. Columns added after the initial DDL (`needsAIReview`, `tripleAtCount`, `aiContentInjected`, `templateVariables`, `hasUnfilledVariables`) only land in a **fresh** database — `CREATE TABLE IF NOT EXISTS` is a no-op against an existing one. Adding a column today requires either (a) deleting `st8.sqlite` and re-indexing or (b) a separate ad-hoc `ALTER TABLE` statement applied out-of-band.

There is no `_migrations` table, no version tracking, no idempotent migration script.

### 8.2 The `deleteFile`-by-filepath FK gotcha

§4 covers the mechanics. There is **no code comment on `deleteFile`** explaining the foot-gun. The JSDoc on `pruneFilesNotIn` is the only place the multi-fingerprint-per-filepath fact is recorded.

### 8.3 `activity_log.targetFingerprint` camel/snake mismatch (cross-cluster)

The column is `targetFingerprint` (camelCase). `logActivity` reads `activity.targetFingerprint`. But `src/core/server/app.js:1558` (the ticket handler) writes `target_fingerprint` (snake_case) when logging the TICKET_CREATED activity row → the fingerprint silently lands as `NULL`. Already flagged in `hooks-and-integration.json`; re-flagged here for DB-side visibility.

### 8.4 Verify script lives next to library code

Per batch 021 cleanup agent: scripts belong under `scripts/`, library files belong under `src/core/database/`. `verify-persistence-fixes.js` sits in the library directory and shells `process.exit` — it's clearly a script.

### 8.5 Schema string vs live DB drift

`ST8_SCHEMA` is a 150-line template literal. There is no helper that introspects the live DB (`PRAGMA table_info`, `sqlite_master`) at boot and compares to expected columns — drift between the schema literal and the actual `st8.sqlite` file is invisible. With no migration framework (§8.1), this drift accumulates silently.

### 8.6 No `PRAGMA foreign_keys = ON`

`initialize()` sets `journal_mode = WAL` and `synchronous = NORMAL` but does **not** enable foreign key enforcement. FK declarations in the schema are documentary only. Manual JS-side cascade in `deleteFile` / `pruneFilesNotIn` is the only thing keeping referential integrity.

### 8.7 `ai_content` has no FK to `file_registry`

`ai_content` references `filepath` (text) with no foreign-key relationship to `file_registry`. By design (file may not be indexed yet when content arrives) or oversight — see ticket.

### 8.8 `tickets.claimedBy` is freeform TEXT

No enum, no `providers` table — `claimedBy` accepts any string ('anthropic', 'openai', 'unknown', a typo, etc.). Queries that want to group by provider have no constraint help.

### 8.9 `file_mutation_log` grows unbounded

The mutation log is append-only with no retention policy. `purgeDevelopmentData()` exists for the lifecycle DEVELOPMENT→PRODUCTION transition but never runs automatically. Long-lived projects will accumulate millions of rows; the only index is on `(fingerprint, timestamp)`.

### 8.10 Silent maestro-fallthrough

§6 — the fallthrough log line says "Using better-sqlite3 directly". It does not flag this as a fallthrough — a reader might think it's an alternative success path rather than the result of the maestro class failing the `typeof === 'function'` guard. No warning at higher log levels.

---

## 9. How to add a new table

Today, the workflow is:

1. **Edit `ST8_SCHEMA`** in `persistence.js`. Add the `CREATE TABLE IF NOT EXISTS` block in the appropriate section (above/below the existing `tickets` block). Include any FK declarations (knowing they are documentary only — see §8.6). Add any indexes.
2. **Add methods on `St8Persistence`** for the table's CRUD. Conventions:
   - Bulk getters return arrays (`getAllX`).
   - Single getters return the row or `null`/`undefined`.
   - Mutating methods return the `better-sqlite3` `RunResult` (`{changes, lastInsertRowid}`).
   - JSON-shaped columns: stringify on insert, try-parse on read with raw-string fallback.
   - Use `this.db.transaction(() => {...})` for any multi-statement mutation.
3. **Delete `st8.sqlite`** before re-running (or write a one-off `ALTER` — see §8.1). New columns will not appear in an existing DB.
4. **Add the table's cascade hook** to `deleteFile` / `pruneFilesNotIn` if it FKs to `file_registry`. Forgetting this is the most common error.
5. **Verify** — extend `verify-persistence-fixes.js` with the new contract assertions, or write a fresh probe.

Skeleton for the schema string addition:

```sql
CREATE TABLE IF NOT EXISTS my_new_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  payload TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_my_new_table_fingerprint ON my_new_table(fingerprint);
```

Skeleton for a new method group:

```js
// ─── MY NEW TABLE ─────────────────────────────────────────
createMyThing(t) {
    const stmt = this.db.prepare(
        'INSERT INTO my_new_table (fingerprint, payload) VALUES (?, ?)'
    );
    return stmt.run(t.fingerprint, JSON.stringify(t.payload));
}

getMyThingsByFingerprint(fingerprint) {
    return this.db.prepare(
        'SELECT * FROM my_new_table WHERE fingerprint = ? ORDER BY createdAt DESC'
    ).all(fingerprint);
}

deleteMyThingsForFile(fingerprint) {
    return this.db.prepare(
        'DELETE FROM my_new_table WHERE fingerprint = ?'
    ).run(fingerprint);
}
```

And remember to call `deleteMyThingsForFile(fingerprint)` from the cascade inside `deleteFile` AND inside `pruneFilesNotIn`.
