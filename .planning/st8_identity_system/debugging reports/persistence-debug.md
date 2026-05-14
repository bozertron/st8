# Persistence Layer Debug Report

**File:** `backend/persistence.js`
**Date:** 2026-05-13
**Issues:** CR-01, CR-02, CR-03

---

## CR-01: connections table missing UNIQUE constraint

### Problem Description

The `connections` table uses `INSERT OR REPLACE` to upsert connections, but the table only has `id INTEGER PRIMARY KEY AUTOINCREMENT` — no UNIQUE constraint on the logical key `(sourceFingerprint, targetFingerprint, connectionType)`.

### Root Cause Analysis

**How `INSERT OR REPLACE` works in SQLite:**
- `INSERT OR REPLACE` only replaces an existing row when the new row would violate a PRIMARY KEY or UNIQUE constraint.
- Since `id` is AUTOINCREMENT, each insert gets a NEW unique id.
- No UNIQUE constraint on `(sourceFingerprint, targetFingerprint, connectionType)` means no constraint is ever violated.
- Result: **every call to `insertConnection()` creates a new duplicate row**.

**Before fix:**
```sql
-- Calling insertConnection() twice with same source/target/type:
-- Row 1: id=1, source=A, target=B, type=IMPORT
-- Row 2: id=2, source=A, target=B, type=IMPORT  ← DUPLICATE
```

### Fix Applied

Added `UNIQUE(sourceFingerprint, targetFingerprint, connectionType)` constraint to the CREATE TABLE statement (line 75).

**After fix:**
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
  UNIQUE(sourceFingerprint, targetFingerprint, connectionType)  -- ← ADDED
);
```

**Behavior change:** `INSERT OR REPLACE` now correctly replaces existing connections when `(source, target, type)` matches, updating `importSpecifier`, `isResolved`, `confidenceScore`, and `lastVerified`.

### Verification

- ✅ Same connection inserted twice → only 1 row exists
- ✅ Second insert updates `confidenceScore` correctly
- ✅ Different `connectionType` allowed as separate row

**Note:** Existing databases with duplicate rows will need a migration to:
1. Deduplicate existing rows (keep latest by `lastVerified`)
2. Drop and recreate the table with the UNIQUE constraint

---

## CR-02: deleteFile() doesn't clean up file_mutation_log

### Problem Description

When `deleteFile()` removes a file from `file_registry`, it cleans up `connections` and `file_intent` tables but **not** `file_mutation_log`. This leaves orphaned mutation log records with `fingerprint` values pointing to non-existent files.

### Root Cause Analysis

**Lines 208-218 (before fix):**
```javascript
deleteFile(filepath) {
    const file = this.getFileByPath(filepath);
    if (!file) return { changes: 0 };

    this.deleteConnectionsForFile(file.fingerprint);  // ✓ cleaned
    this.deleteIntentForFile(file.fingerprint);        // ✓ cleaned
    // ← file_mutation_log NOT cleaned!

    const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
    const result = stmt.run(filepath);
    return { changes: result.changes, fingerprint: file.fingerprint };
}
```

**Impact:**
- `file_mutation_log.fingerprint` has a FOREIGN KEY to `file_registry(fingerprint)`
- Depending on SQLite FK enforcement settings (PRAGMA foreign_keys), this either:
  - Silently leaves orphaned records (if FK enforcement is OFF, which is SQLite default)
  - Causes a FOREIGN KEY constraint violation error (if FK enforcement is ON)
- Either way, the mutation history for deleted files accumulates indefinitely

### Fix Applied

1. Added `deleteMutationLogForFile(fingerprint)` method:
```javascript
deleteMutationLogForFile(fingerprint) {
    const stmt = this.db.prepare('DELETE FROM file_mutation_log WHERE fingerprint = ?');
    return stmt.run(fingerprint);
}
```

2. Added call in `deleteFile()`:
```javascript
this.deleteConnectionsForFile(file.fingerprint);
this.deleteIntentForFile(file.fingerprint);
this.deleteMutationLogForFile(file.fingerprint);  // ← ADDED
```

### Verification

- ✅ File with mutation log entries deleted successfully
- ✅ Mutation log entries cleaned up (count = 0 after delete)

---

## CR-03: confidenceScore: 0 silently becomes 1.0

### Problem Description

When `insertConnection()` is called with `confidenceScore: 0`, the value is silently converted to `1.0`. This is a classic JavaScript falsy-value bug.

### Root Cause Analysis

**Line 253 (before fix):**
```javascript
conn.confidenceScore || 1.0
```

**JavaScript evaluation:**
```javascript
0 || 1.0    // → 1.0   (0 is falsy!)
0.0 || 1.0  // → 1.0   (0.0 is falsy!)
null || 1.0 // → 1.0   (null is falsy — this IS correct behavior)
```

The `||` operator returns the right-hand side when the left-hand side is **any falsy value**, including `0`, `0.0`, `""`, `null`, `undefined`, `NaN`, and `false`.

**Why this matters for confidenceScore:**
- A confidence score of `0` is a valid, meaningful value (representing zero confidence)
- The intended default was `1.0` (for when the score is not provided)
- `|| 1.0` conflates "not provided" with "explicitly zero"

### Fix Applied

Changed `||` to `??` (nullish coalescing operator):
```javascript
conn.confidenceScore ?? 1.0
```

**Nullish coalescing (`??`) behavior:**
```javascript
0 ?? 1.0       // → 0     (0 is NOT nullish)
0.0 ?? 1.0     // → 0.0   (0.0 is NOT nullish)
null ?? 1.0    // → 1.0   (null IS nullish — correct default)
undefined ?? 1.0 // → 1.0 (undefined IS nullish — correct default)
```

Also applied same fix to `connectionType` and `importSpecifier` parameters for consistency:
```javascript
conn.connectionType ?? 'IMPORT',    // was: || 'IMPORT'
conn.importSpecifier ?? null,       // was: || null
```

### Verification

- ✅ `confidenceScore: 0` → stored as `0` (not `1.0`)
- ✅ `confidenceScore: undefined` → stored as `1.0` (default)
- ✅ `confidenceScore: 0.5` → stored as `0.5`

---

## Summary

| Issue | Severity | Root Cause | Fix | Verification |
|-------|----------|------------|-----|--------------|
| CR-01 | High | Missing UNIQUE constraint causes `INSERT OR REPLACE` to always insert | Added `UNIQUE(sourceFingerprint, targetFingerprint, connectionType)` | ✅ 3 tests pass |
| CR-02 | Medium | `deleteFile()` skips `file_mutation_log` cleanup | Added `deleteMutationLogForFile()` call | ✅ 3 tests pass |
| CR-03 | High | `\|\|` operator treats `0` as falsy, converting to default | Changed to `??` (nullish coalescing) | ✅ 4 tests pass |

**Total verification:** 10/10 tests passing

---

## Files Changed

- `backend/persistence.js` — All three fixes applied
- `backend/verify-persistence-fixes.js` — Verification script (can be run with `node backend/verify-persistence-fixes.js`)

## Migration Note

For existing databases with the old schema:
```sql
-- Deduplicate connections before adding UNIQUE constraint
DELETE FROM connections WHERE id NOT IN (
    SELECT MAX(id) FROM connections
    GROUP BY sourceFingerprint, targetFingerprint, connectionType
);
```
