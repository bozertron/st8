# W4-02 Debug Report — Transaction Wrapping for purgeDevelopmentData()

**Date:** 2026-05-13
**Issue:** WR-01
**File:** `backend/persistence.js`
**Status:** FIXED

---

## Root Cause

`purgeDevelopmentData()` executed 3 mutating DB operations (DELETE, INSERT via `logMutation`, UPDATE) as independent statements without transaction wrapping. If any operation failed mid-method, the database would be left in an inconsistent state — e.g., development mutations deleted but no PURGE audit log recorded, or lifecycle phase not updated to PRODUCTION.

## Why It Matters

This is a **latent defect** — it won't crash under normal conditions, but in edge cases (disk full, I/O error, concurrent modification) it would produce:
- **Orphaned state:** Mutations deleted but lifecycle stuck at DEVELOPMENT
- **Missing audit trail:** Purge executed but no PURGE mutation logged
- **Partial rollback impossible:** No atomicity guarantee to undo partial work

## Pattern Match

The codebase already uses `this.db.transaction()` in two other methods:
- `deleteFile()` (lines 212-219) — wraps connection/intent/mutation cleanup + file delete
- `registerConceptFile()` (lines 353-372) — wraps file insert + mutation log

`purgeDevelopmentData()` was the only multi-statement mutating method missing this pattern.

## Fix Applied

**Before:** 3 standalone operations (deleteStmt.run, logMutation, updateStmt.run)

**After:** All 3 wrapped in `this.db.transaction()` via `_purgeDevTx`:

```javascript
const _purgeDevTx = this.db.transaction((fp, purgedCount) => {
    // 1. DELETE development mutations
    deleteStmt.run(fp);
    // 2. INSERT purge audit log
    this.logMutation({ ... });
    // 3. UPDATE lifecycle to PRODUCTION
    updateStmt.run(fp);
});

_purgeDevTx(fingerprint, count);
```

The read-only COUNT query stays outside the transaction (it's only used for the return value and the audit log metadata).

## Files Changed

| File | Change |
|------|--------|
| `backend/persistence.js` | Wrapped mutating operations in `purgeDevelopmentData()` with `this.db.transaction()` |

## Verification

- [x] Fix follows established `deleteFile()` / `registerConceptFile()` transaction pattern
- [x] Column names in SQL queries unchanged (`fingerprint`, `mutationType`)
- [x] Read-only COUNT query remains outside transaction
- [x] Return value `{ purgedMutations: count }` unchanged
- [x] Method signature unchanged — no API breakage
