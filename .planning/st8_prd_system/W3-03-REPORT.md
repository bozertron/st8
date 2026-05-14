# W3-03 Report: .txt File Cleanup/Rotation

**Task:** Add `pruneOldCards()` method to schemaCardPrinter.js
**File modified:** `backend/schemaCardPrinter.js`
**Status:** COMPLETE
**Syntax check:** PASSED (`node -c`)

---

## Integration Summary

### Integration 1: `pruneOldCards()` Method Added

| Attribute | Value |
|-----------|-------|
| **Pattern** | New method on existing class |
| **File** | `backend/schemaCardPrinter.js` |
| **Lines** | 187–257 |
| **Method signature** | `pruneOldCards(maxPerFile = 10)` |
| **Returns** | `{ pruned: number, kept: number }` |

**Logic:**
1. Reads all files in `this.outputDir` (line 199)
2. Filters to timestamped `.txt` files, excludes `LATEST_*` snapshots (lines 202–209)
3. Groups files by base filename extracted via regex `^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}[^_]+_(.+)\.txt$` (lines 214–221)
4. Sorts each group descending (newest first) via lexicographic sort (line 227)
5. Deletes files beyond the `maxPerFile` limit using `fs.unlinkSync()` (lines 239–245)
6. Logs pruning summary only when files were pruned (lines 249–251)
7. Entire operation wrapped in try/catch for resilience (lines 198, 252–254)

**Key design decisions:**
- `LATEST_*` files are **never pruned** — they serve as the always-current snapshot
- Default limit of 10 per base file (configurable via parameter)
- Per-file delete errors are caught and logged individually, not fatal (lines 243–245)

### Integration 2: Wired Call After `printAllFromCards()`

| Attribute | Value |
|-----------|-------|
| **Pattern** | Inline call after processing loop |
| **File** | `backend/schemaCardPrinter.js` |
| **Lines** | 287–290 (within `printAllFromCards()`) |
| **Call** | `this.pruneOldCards()` at line 288 |
| **Return updated** | `{ printed, errors, pruned }` at line 290 |

**Wiring point:** The call was inserted at line 288, after the `[st8:printer] Printed N cards, M errors` log (line 285) and before the return statement (line 290). This ensures pruning happens automatically every time cards are printed.

**Caller compatibility:** The existing caller at `backend/index.js:159` (`printer.printAllFromCards(...)`) discards the return value, so adding `pruned` to the return object is fully backward-compatible — no caller changes needed.

---

## Verification

```bash
$ node -c backend/schemaCardPrinter.js
# Exit code 0 — syntax valid
```

**Runtime verification steps:**
1. Run indexer to generate schema cards → `printAllFromCards()` called → `pruneOldCards()` fires automatically
2. Check `.planning/st8_identity_system/` for log message: `[st8:printer] Pruned N old card files, kept M`
3. Confirm `LATEST_*.txt` files survive pruning
4. Confirm only the 10 most recent timestamped files per base name remain

---

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `backend/schemaCardPrinter.js` | Added `pruneOldCards()` method | 187–257 (71 lines) |
| `backend/schemaCardPrinter.js` | Added call + updated return in `printAllFromCards()` | 287–290 |
