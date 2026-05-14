# W1-01 Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed two files for W1-01 changes: `backend/indexer.js` (IGNORE_DIRS additions) and `backend/schemaCardPrinter.js` (guard logic). The IGNORE_DIRS set and skip extensions are correctly implemented with all required entries present. However, one logic bug was found in `printAllFromCards` where the `printed` counter increments even when a card is skipped by guard logic, inflating the reported count.

## Findings

### WR-01: `printAllFromCards` counts skipped cards as "printed"

**File:** `backend/schemaCardPrinter.js:203-204`
**Issue:** In `printAllFromCards`, `printed++` executes unconditionally after calling `this.printCard(card)`. However, `printCard` returns `null` when a card is skipped by the guard logic (lines 50, 55, 62). This means the `printed` count in the log message (`Printed N cards, M errors`) is inflated — it includes cards that were actually skipped, not printed.

**Fix:**
```javascript
// Current (line 203-204):
this.printCard(card);
printed++;

// Fixed:
const result = this.printCard(card);
if (result !== null) {
    printed++;
}
```

---

## Verification: IGNORE_DIRS (indexer.js:161)

| Required Entry  | Present | Status |
|-----------------|---------|--------|
| `.archive`      | ✅      | PASS   |
| `.planning`     | ✅      | PASS   |
| `.st8`          | ✅      | PASS   |
| `vendor`        | ✅      | PASS   |
| `snapshots`     | ✅      | PASS   |

**Line 161:**
```javascript
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__', '.archive', '.planning', '.st8', 'vendor', 'snapshots']);
```

All required entries present. Additional entries (`node_modules`, `.git`, `dist`, `build`, `.venv`, `venv`, `__pycache__`) are standard and appropriate.

---

## Verification: Printer Guard Extensions (schemaCardPrinter.js:46)

| Required Extension | Present | Status |
|--------------------|---------|--------|
| `.txt`             | ✅      | PASS   |
| `.json`            | ✅      | PASS   |
| `.sqlite-wal`      | ✅      | PASS   |
| `.sqlite-shm`      | ✅      | PASS   |

**Line 46:**
```javascript
const skipExtensions = ['.txt', '.json', '.sqlite-wal', '.sqlite-shm'];
```

Guard logic (lines 47-52) correctly lowercases the filepath and uses `endsWith()` for case-insensitive extension matching.

---

## Verification: Additional Guard Logic

**Schema-cards directory guard (line 54):** ✅ Correctly prevents processing files inside `.st8/schema-cards`.

**Ignored directories guard (lines 58-63):** ✅ Correctly skips files with paths starting with or containing `.archive/`, `.planning/`, `.st8/`, `vendor/`, `snapshots/`.

**Syntax errors:** None found in either file.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
