# W1-03 Debug Report: Field Name Mapping Bug in File Watcher

**Date:** 2026-05-13
**Status:** RESOLVED
**File:** `backend/index.js`
**Line:** 289-292 (file watcher callback)

---

## Issue Summary

The file watcher callback in `index.js` passed `lastMutation` from `persistence.getLastMutation()` directly to `emitter.emitCard()` without mapping field names. The persistence layer returns `{ mutationType, actor, timestamp }` (SQLite column names), but the schema card emitter expects `{ type, actor, timestamp }` (card field names).

---

## Root Cause

**Mismatched field names between persistence layer and schema card emitter:**

| Source (`getLastMutation()`) | Expected (`emitCard()`) |
|------------------------------|-------------------------|
| `mutationType`               | `type`                  |
| `actor`                      | `actor`                 |
| `timestamp`                  | `timestamp`             |

The `emitAllCards()` method in `schemaCardEmitter.js` (lines 118-119) correctly maps these fields:
```javascript
const lastMutation = rawLastMutation
    ? { type: rawLastMutation.mutationType, actor: rawLastMutation.actor, timestamp: rawLastMutation.timestamp }
    : null;
```

But the file watcher callback in `index.js` passed the raw result without mapping:
```javascript
lastMutation: persistence.getLastMutation(changedFile.fingerprint)
```

---

## Fix Applied

**File:** `backend/index.js`
**Lines:** 289-295

**Before:**
```javascript
const card = emitter.emitCard(changedFile, astResult,
    { importedBy: [], imports: [] }, null,
    { count: persistence.getMutationCount(changedFile.fingerprint),
      lastMutation: persistence.getLastMutation(changedFile.fingerprint) });
```

**After:**
```javascript
const lastMutation = persistence.getLastMutation(changedFile.fingerprint);
const card = emitter.emitCard(changedFile, astResult,
    { importedBy: [], imports: [] }, null,
    { count: persistence.getMutationCount(changedFile.fingerprint),
      lastMutation: lastMutation ? { type: lastMutation.mutationType, actor: lastMutation.actor, timestamp: lastMutation.timestamp } : { type: '', actor: '', timestamp: '' } });
```

---

## Verification

- ✅ Fix maps `mutationType` → `type` correctly
- ✅ Fix handles `null` case (no mutations) with empty defaults
- ✅ Fix matches the pattern used in `schemaCardEmitter.js` `emitAllCards()` method
- ✅ No other callers of `emitCard()` found with this issue (initial indexing uses `emitAllCards()` which already handles mapping)

---

## Impact

- **Severity:** Medium — Schema cards written during file watch had `type: undefined` instead of correct mutation type
- **Scope:** Only affected incremental schema card generation during `--watch` mode
- **Initial indexing:** Not affected (uses `emitAllCards()` which has correct mapping)

---

## Files Changed

- `backend/index.js` — Lines 289-295: Added field name mapping for `lastMutation` object

---

## Lesson

When two modules use different naming conventions for the same data, ensure all call sites perform the mapping — not just the "main" path. The `emitAllCards()` bulk path was correct, but the `emitCard()` incremental path in the watcher was missed.
