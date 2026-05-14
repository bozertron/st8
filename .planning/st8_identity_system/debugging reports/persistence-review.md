# Persistence Review: `backend/persistence.js`

**Reviewed:** 2026-05-13T15:00:00Z
**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/persistence.js` (493 lines)
**Reference:** `/home/bozertron/1_AT_A_TIME/st8/backend/st8-types.js` (242 lines)
**Plans:** `01_schema_constants_persistence.md`, `02_new_methods_persistence.md`
**Status:** **FAIL** — 3 critical issues, 6 warnings, 2 info items found

---

## Summary

The file implements a SQLite persistence layer with correct camelCase column naming throughout the schema (except one table). SQL statements use parameterized queries (no injection risk). However, there are three critical bugs: (1) the `connections` table lacks a UNIQUE constraint making `INSERT OR REPLACE` silently produce duplicates, (2) `deleteFile()` doesn't clean up `file_mutation_log` creating orphaned records, and (3) `confidenceScore: 0` is silently overwritten to `1.0` due to a falsy-value bug. Several warnings cover dead imports, inconsistent defaults, and missing transactional safety.

---

## Critical Issues

### CR-01: `connections` table missing UNIQUE constraint — `INSERT OR REPLACE` always inserts duplicates

**File:** `backend/persistence.js:64-75` (schema) and `233-248` (`insertConnection`)
**Severity:** CRITICAL

The `connections` table uses `id INTEGER PRIMARY KEY AUTOINCREMENT` as its only key. There is no UNIQUE constraint on the business columns `(sourceFingerprint, targetFingerprint, connectionType)`. Because `INSERT OR REPLACE` resolves conflicts on PRIMARY KEY (the auto-increment `id`), and every new row gets a new `id`, the `OR REPLACE` clause never triggers — every call to `insertConnection()` creates a new duplicate row.

**Evidence:**
```sql
-- Schema (line 64): no UNIQUE constraint on business columns
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- only key
  sourceFingerprint TEXT NOT NULL,
  targetFingerprint TEXT NOT NULL,
  connectionType TEXT DEFAULT 'IMPORT',
  ...
);
```

```javascript
// insertConnection (line 234): INSERT OR REPLACE never replaces
const stmt = this.db.prepare(`
    INSERT OR REPLACE INTO connections
    (sourceFingerprint, targetFingerprint, connectionType, importSpecifier,
     isResolved, confidenceScore, lastVerified)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);
```

Calling `insertConnection({sourceFingerprint: 'A', targetFingerprint: 'B', connectionType: 'IMPORT'})` 10 times creates 10 rows instead of updating 1.

**Fix:**
```sql
-- Add UNIQUE constraint to the schema
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceFingerprint TEXT NOT NULL,
  targetFingerprint TEXT NOT NULL,
  connectionType TEXT DEFAULT 'IMPORT',
  importSpecifier TEXT,
  isResolved INTEGER DEFAULT 1,
  confidenceScore REAL DEFAULT 1.0,
  lastVerified TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sourceFingerprint, targetFingerprint, connectionType),
  FOREIGN KEY (sourceFingerprint) REFERENCES file_registry(fingerprint),
  FOREIGN KEY (targetFingerprint) REFERENCES file_registry(fingerprint)
);
```

---

### CR-02: `deleteFile()` does not clean up `file_mutation_log` — orphaned records

**File:** `backend/persistence.js:207-217`
**Severity:** CRITICAL

When a file is deleted, `deleteFile()` cascades deletes to `connections` and `file_intent`, but skips `file_mutation_log`. Orphaned mutation log records will persist indefinitely, causing stale data in `getMutationLog()`, `getMutationCount()`, and `getLastMutation()` calls with the old fingerprint.

**Evidence:**
```javascript
deleteFile(filepath) {
    const file = this.getFileByPath(filepath);
    if (!file) return { changes: 0 };

    this.deleteConnectionsForFile(file.fingerprint);
    this.deleteIntentForFile(file.fingerprint);
    // MISSING: this.deleteMutationsForFile(file.fingerprint);

    const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
    const result = stmt.run(filepath);
    return { changes: result.changes, fingerprint: file.fingerprint };
}
```

**Fix:**
```javascript
deleteFile(filepath) {
    const file = this.getFileByPath(filepath);
    if (!file) return { changes: 0 };

    this.deleteConnectionsForFile(file.fingerprint);
    this.deleteIntentForFile(file.fingerprint);
    this.deleteMutationsForFile(file.fingerprint);  // ADD THIS

    const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
    const result = stmt.run(filepath);
    return { changes: result.changes, fingerprint: file.fingerprint };
}

// Add new method
deleteMutationsForFile(fingerprint) {
    const stmt = this.db.prepare('DELETE FROM file_mutation_log WHERE fingerprint = ?');
    return stmt.run(fingerprint);
}
```

---

### CR-03: `insertConnection()` — `confidenceScore: 0` silently stored as `1.0`

**File:** `backend/persistence.js:247`
**Severity:** CRITICAL

The `||` operator treats `0` as falsy. If a caller explicitly passes `confidenceScore: 0` (meaning completely uncertain), it is silently stored as `1.0` (completely confident) — the exact opposite of the intended value.

**Evidence:**
```javascript
// Line 247
conn.confidenceScore || 1.0
// When conn.confidenceScore === 0:
// 0 || 1.0 → 1.0  ← WRONG: 0 is a valid confidence score
```

**Fix:**
```javascript
conn.confidenceScore !== undefined ? conn.confidenceScore : 1.0
```

---

## Warnings

### WR-01: Dead imports — `St8FileEntry`, `LifecyclePhase`, `FileStatus` never used

**File:** `backend/persistence.js:17`
**Severity:** WARNING

Three symbols are imported from `./st8-types` but never referenced anywhere in the file.

**Evidence:**
```javascript
const { St8FileEntry, LifecyclePhase, FileStatus } = require('./st8-types');
// St8FileEntry — never used
// LifecyclePhase — never used
// FileStatus — never used
```

**Fix:** Remove unused destructured imports, or keep only what's actually used:
```javascript
// Only import what's needed (currently nothing from this line is used in-file)
// If future use is planned, add a comment explaining why
```

---

### WR-02: `generateFingerprint` re-required inline instead of at top level

**File:** `backend/persistence.js:338`
**Severity:** WARNING

`generateFingerprint` is `require()`d inside `registerConceptFile()` on every call, even though `./st8-types` is already required at the top of the file (line 17). Node.js caching makes this functionally harmless, but it's inconsistent and misleading — it looks like a different module is being loaded.

**Fix:** Add `generateFingerprint` to the top-level import:
```javascript
// Line 17 — change to:
const { generateFingerprint } = require('./st8-types');

// Line 338 — remove the inline require:
// const { generateFingerprint } = require('./st8-types');  // DELETE THIS LINE
```

---

### WR-03: `st8_settings.updated_at` uses snake_case — breaks project convention

**File:** `backend/persistence.js:122`
**Severity:** WARNING

Every other table in the schema uses camelCase column names (per the migration plan `01_schema_constants_persistence.md`). The `st8_settings` table uses `updated_at` (snake_case), breaking the established convention. The plan explicitly migrated `last_updated` → `lastUpdated` in the `file_intent` table.

**Evidence:**
```sql
CREATE TABLE IF NOT EXISTS st8_settings (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,  -- ← snake_case
  PRIMARY KEY (category, key)
);
```

**Fix:** Rename to `updatedAt` and update all references (lines 432-433, 436):
```sql
CREATE TABLE IF NOT EXISTS st8_settings (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, key)
);
```

---

### WR-04: `upsertIntent()` default for `authoredBy` is `'USER'` — mismatches schema default `'INFERRED'`

**File:** `backend/persistence.js:268`
**Severity:** WARNING

The schema defines `authoredBy TEXT DEFAULT 'INFERRED'` (line 83). But `upsertIntent()` defaults to `'USER'`:
```javascript
intent.authoredBy || 'USER'   // code default: 'USER'
```
While `getAllIntents()` defaults to `'INFERRED'` (line 288):
```javascript
authoredBy: row.authoredBy || 'INFERRED',  // readback default: 'INFERRED'
```

This means: insert without `authoredBy` → stored as `'USER'`. Read back a null → shown as `'INFERRED'`. The inconsistency creates confusion about what the "real" default is.

**Fix:** Align with the schema default:
```javascript
// Line 268
intent.authoredBy || 'INFERRED'
```

---

### WR-05: No null guard on `this.db` — cryptic errors if `initialize()` not called

**File:** `backend/persistence.js` — all methods using `this.db`
**Severity:** WARNING

If `initialize()` is not called or throws, `this.db` remains `null`. Every subsequent method call will throw `TypeError: Cannot read properties of null (reading 'prepare')` with no indication of the root cause.

**Fix:** Add a guard method and call it from each data method:
```javascript
_assertDb() {
    if (!this.db) {
        throw new Error('St8Persistence not initialized. Call initialize() first.');
    }
}

// Example usage in upsertFile:
upsertFile(file) {
    this._assertDb();
    // ... rest of method
}
```

---

### WR-06: No transaction wrapping for multi-step operations

**File:** `backend/persistence.js:207-217` (`deleteFile`) and `335-367` (`registerConceptFile`)
**Severity:** WARNING

Both `deleteFile()` and `registerConceptFile()` perform multiple SQL statements that should be atomic. If an intermediate step fails, the database is left in an inconsistent state:
- `deleteFile()`: connections/intent deleted but file_registry row remains
- `registerConceptFile()`: file registered but mutation log entry not created

better-sqlite3 supports transactions via `this.db.transaction()`.

**Fix:**
```javascript
deleteFile(filepath) {
    this._assertDb();
    const file = this.getFileByPath(filepath);
    if (!file) return { changes: 0 };

    const deleteCascade = this.db.transaction(() => {
        this.deleteConnectionsForFile(file.fingerprint);
        this.deleteIntentForFile(file.fingerprint);
        this.deleteMutationsForFile(file.fingerprint);
        const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
        return stmt.run(filepath);
    });

    const result = deleteCascade();
    return { changes: result.changes, fingerprint: file.fingerprint };
}
```

---

## Info

### IN-01: `registerConceptFile` sets `lastModified` to empty string

**File:** `backend/persistence.js:347`
**Severity:** INFO

The `lastModified` column is set to `''` for concept files. While this is reasonable (the file doesn't exist on disk yet), the `St8FileEntry` type defines `lastModified` as an ISO timestamp string. This creates a type inconsistency for downstream consumers that expect a parseable timestamp.

**Suggestion:** Use `null` instead of `''` to explicitly signal "no value," or document this as an expected pattern for CONCEPT lifecycle files.

---

### IN-02: SQLite foreign keys are defined but not enforced

**File:** `backend/persistence.js:73-74, 84, 96` (FOREIGN KEY declarations)
**Severity:** INFO

The schema defines `FOREIGN KEY` constraints on `connections`, `file_intent`, and `file_mutation_log`, but SQLite requires `PRAGMA foreign_keys = ON` to enforce them (it's off by default). The `initialize()` method sets WAL mode and synchronous pragmas but does not enable foreign key enforcement. This means the foreign key declarations are purely documentary.

**Suggestion:** If enforcement is desired, add to `initialize()`:
```javascript
this.db.pragma('foreign_keys = ON');
```
Note: enabling this would cause `deleteFile()` to fail unless `ON DELETE CASCADE` is added to the FK definitions or explicit cleanup (CR-02 fix) is implemented first.

---

## Method-by-Method Checklist

| Method | Lines | SQL Correct? | Param Count Match? | camelCase? | Notes |
|--------|-------|-------------|-------------------|------------|-------|
| `upsertFile` | 162-184 | ✓ | 12 params / 12 `?` ✓ | ✓ | |
| `getFilesByStatus` | 186-189 | ✓ | 1/1 ✓ | ✓ | |
| `getAllFiles` | 191-200 | ✓ | 0/0 ✓ | ✓ | Boolean conversion ✓ |
| `getFileByPath` | 202-205 | ✓ | 1/1 ✓ | ✓ | |
| `deleteFile` | 207-217 | ✓ | 1/1 ✓ | ✓ | Missing mutation_log cleanup (CR-02) |
| `deleteConnectionsForFile` | 219-224 | ✓ | 2/2 ✓ | ✓ | |
| `deleteIntentForFile` | 226-229 | ✓ | 1/1 ✓ | ✓ | |
| `insertConnection` | 233-248 | ⚠️ | 6/6 ✓ | ✓ | Missing UNIQUE constraint (CR-01), falsy bug (CR-03) |
| `getConnectionsForFile` | 250-253 | ✓ | 2/2 ✓ | ✓ | |
| `upsertIntent` | 257-270 | ✓ | 5/5 ✓ | ✓ | Default mismatch (WR-04) |
| `getIntent` | 272-275 | ✓ | 1/1 ✓ | ✓ | |
| `getAllIntents` | 277-291 | ✓ | 0/0 ✓ | ✓ | |
| `logMutation` | 295-309 | ✓ | 6/6 ✓ | ✓ | |
| `getMutationLog` | 311-316 | ✓ | 2/2 ✓ | ✓ | |
| `getMutationCount` | 318-324 | ✓ | 1/1 ✓ | ✓ | |
| `getLastMutation` | 326-331 | ✓ | 1/1 ✓ | ✓ | |
| `registerConceptFile` | 335-367 | ✓ | 4/4 ✓ | ✓ | No transaction (WR-06) |
| `purgeDevelopmentData` | 371-406 | ✓ | 1/1 ✓ | ✓ | |
| `logActivity` | 410-422 | ✓ | 4/4 ✓ | ✓ | |
| `getRecentActivity` | 424-427 | ✓ | 1/1 ✓ | ✓ | |
| `upsertSetting` | 431-437 | ✓ | 3/3 ✓ | ⚠️ | `updated_at` snake_case (WR-03) |
| `getSetting` | 439-444 | ✓ | 2/2 ✓ | ✓ | |
| `getSettingsByCategory` | 446-454 | ✓ | 1/1 ✓ | ✓ | |
| `getAllSettings` | 456-465 | ✓ | 0/0 ✓ | ✓ | |
| `deleteSetting` | 467-470 | ✓ | 2/2 ✓ | ✓ | |
| `close` | 474-486 | N/A | N/A | N/A | Hardcoded error string check |

---

## Schema vs `st8-types.js` Cross-Reference

### `file_registry` ↔ `St8FileEntry`

| St8FileEntry Field | Schema Column | Match |
|---|---|---|
| `fingerprint` | `fingerprint` | ✓ |
| `filepath` | `filepath` | ✓ |
| `filename` | `filename` | ✓ |
| `sha256Hash` | `sha256Hash` | ✓ |
| `fileSizeBytes` | `fileSizeBytes` | ✓ |
| `status` | `status` | ✓ |
| `reachabilityScore` | `reachabilityScore` | ✓ |
| `impactRadius` | `impactRadius` | ✓ |
| `lifecyclePhase` | `lifecyclePhase` | ✓ |
| `birthTimestamp` | `birthTimestamp` | ✓ |
| `lastModified` | `lastModified` | ✓ |
| `lastIndexed` | `lastIndexed` | ✓ |
| `isEntryPoint` | `isEntryPoint` | ✓ |

**Result: All 13 fields match.** ✓

### `file_mutation_log` ↔ `St8MutationRecord`

| St8MutationRecord Field | Schema Column | Match |
|---|---|---|
| `fingerprint` | `fingerprint` | ✓ |
| `sha256Hash` | `sha256Hash` | ✓ |
| `mutationType` | `mutationType` | ✓ |
| `changedFields` | `changedFields` | ✓ |
| `actor` | `actor` | ✓ |
| `timestamp` | `timestamp` | ✓ |
| `metadata` | `metadata` | ✓ |

**Result: All 7 fields match.** ✓

### Enum Defaults Consistency

| Default Value | Source | Consistent? |
|---|---|---|
| Status `'RED'` | Schema (line 55), `St8FileEntry` (line 66), `upsertFile` (line 176) | ✓ |
| Lifecycle `'DEVELOPMENT'` | Schema (line 58), `St8FileEntry` (line 69), `upsertFile` (line 179) | ✓ |
| ConnectionType `'IMPORT'` | Schema (line 69), `insertConnection` (line 243) | ✓ |
| Actor `'DEVELOPER'` | Schema (line 93), `logMutation` (line 306) | ✓ |
| AuthoredBy `'INFERRED'` | Schema (line 83) — but `upsertIntent` defaults to `'USER'` | ⚠️ (WR-04) |

---

## Findings Summary

| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| CR-01 | CRITICAL | `connections` missing UNIQUE constraint — duplicates accumulate | Lines 64-75, 233-248 |
| CR-02 | CRITICAL | `deleteFile()` doesn't clean `file_mutation_log` — orphaned records | Lines 207-217 |
| CR-03 | CRITICAL | `confidenceScore: 0` silently becomes `1.0` (falsy `||` bug) | Line 247 |
| WR-01 | WARNING | Dead imports: `St8FileEntry`, `LifecyclePhase`, `FileStatus` | Line 17 |
| WR-02 | WARNING | `generateFingerprint` re-required inline | Line 338 |
| WR-03 | WARNING | `st8_settings.updated_at` uses snake_case | Line 122 |
| WR-04 | WARNING | `upsertIntent()` default `'USER'` vs schema default `'INFERRED'` | Line 268 |
| WR-05 | WARNING | No `this.db` null guard | All methods |
| WR-06 | WARNING | No transaction wrapping for multi-step operations | Lines 207-217, 335-367 |
| IN-01 | INFO | `registerConceptFile` sets `lastModified` to `''` | Line 347 |
| IN-02 | INFO | Foreign keys declared but not enforced (`PRAGMA foreign_keys` missing) | Line 134-157 |

---

_Reviewed: 2026-05-13T15:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
