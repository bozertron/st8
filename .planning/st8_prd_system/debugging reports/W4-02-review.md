# W4-02 Review: Transaction Wrapping in persistence.js

**Reviewed:** 2026-05-13T22:45:00Z
**File:** `backend/persistence.js`
**Status:** ✅ All three checks pass

---

## Check 1: deleteFile() wrapped in transaction ✅

**Lines 208-222.** `deleteFile()` correctly uses `this.db.transaction()` to wrap all dependent deletes and the main file_registry DELETE in a single atomic operation.

```javascript
// Lines 212-221
const _deleteFileTx = this.db.transaction((fp, fingerprint) => {
    this.deleteConnectionsForFile(fingerprint);   // connections table
    this.deleteIntentForFile(fingerprint);         // file_intent table
    this.deleteMutationLogForFile(fingerprint);    // file_mutation_log table
    const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
    return stmt.run(fp);
});
```

Early return on line 210 (`if (!file) return { changes: 0 }`) correctly avoids opening a transaction for a non-existent file.

**Verdict:** PASS — all 4 deletes are atomic.

---

## Check 2: registerConceptFile() wrapped in transaction ✅

**Lines 346-383.** `registerConceptFile()` correctly uses `this.db.transaction()` to wrap both the INSERT into `file_registry` and the mutation log entry in a single atomic operation.

```javascript
// Lines 353-372
const _registerConceptTx = this.db.transaction((fp, fname, bts, entry, fpr) => {
    const stmt = this.db.prepare(`INSERT OR REPLACE INTO file_registry ...`);
    stmt.run(fpr, fp, fname, bts);
    this.logMutation({ fingerprint: fpr, ... });
});
```

**Verdict:** PASS — concept file registration and its mutation log are atomic.

---

## Check 3: No syntax errors ✅

`node -c backend/persistence.js` passes cleanly. No syntax errors detected.

**Verdict:** PASS

---

## Additional Findings

### WR-01: purgeDevelopmentData() is NOT wrapped in a transaction (WARNING)

**File:** `backend/persistence.js:387-422`

`purgeDevelopmentData()` performs 4 separate database operations without a transaction:

1. `SELECT COUNT(*)` from `file_mutation_log` (line 393)
2. `DELETE FROM file_mutation_log` (line 400)
3. `INSERT INTO file_mutation_log` via `this.logMutation()` (line 406)
4. `UPDATE file_registry SET lifecyclePhase = 'PRODUCTION'` (line 416)

If the process crashes between steps 2 and 3, mutations are deleted but no `PURGE` audit log exists. If it crashes between steps 3 and 4, the lifecycle phase remains stale.

This follows the same pattern that `deleteFile()` and `registerConceptFile()` already handle correctly with transactions.

**Fix:**
```javascript
purgeDevelopmentData(fingerprint) {
    const _purgeTx = this.db.transaction((fp) => {
        const countStmt = this.db.prepare(
            `SELECT COUNT(*) as count FROM file_mutation_log
             WHERE fp = ? AND mutationType NOT IN ('PRODUCTION', 'PURGE')`
        );
        const { count } = countStmt.get(fp);

        const deleteStmt = this.db.prepare(
            `DELETE FROM file_mutation_log
             WHERE fingerprint = ? AND mutationType NOT IN ('PRODUCTION', 'PURGE')`
        );
        deleteStmt.run(fp);

        this.logMutation({
            fingerprint: fp,
            sha256Hash: '',
            mutationType: 'PURGE',
            changedFields: JSON.stringify({ purgedMutations: count }),
            actor: 'INDEXER',
            metadata: '{}'
        });

        const updateStmt = this.db.prepare(
            `UPDATE file_registry SET lifecyclePhase = 'PRODUCTION' WHERE fingerprint = ?`
        );
        updateStmt.run(fp);

        return { purgedMutations: count };
    });

    return _purgeTx(fingerprint);
}
```

### IN-01: Duplicate require('./st8-types') (INFO)

**File:** `backend/persistence.js:349`

`require('./st8-types')` is already imported at the top of the file (line 17). Line 349 re-requires it inside `registerConceptFile()` to destructure `generateFingerprint`. Node caches modules so there's no runtime cost, but `generateFingerprint` should be destructured alongside `St8FileEntry`, `LifecyclePhase`, `FileStatus` at line 17.

**Fix:** Add `generateFingerprint` to the existing top-level import:
```javascript
const { St8FileEntry, LifecyclePhase, FileStatus, generateFingerprint } = require('./st8-types');
```
Then remove line 349.

---

## Summary

| Check | Result |
|-------|--------|
| deleteFile() wrapped in transaction | ✅ PASS |
| registerConceptFile() wrapped in transaction | ✅ PASS |
| No syntax errors | ✅ PASS |
| Additional: purgeDevelopmentData() missing transaction | ⚠️ WARNING |

The two methods targeted by W4-02 are correctly implemented. One related method (`purgeDevelopmentData`) was found to be missing the same transaction protection pattern.

---

_Reviewed: 2026-05-13T22:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
