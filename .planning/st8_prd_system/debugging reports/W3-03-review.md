# W3-03 Code Review Report

**Reviewed:** 2026-05-13T00:00:00Z  
**Depth:** standard  
**Files Reviewed:** 1  
**Status:** issues_found

## Summary

Reviewed `backend/schemaCardPrinter.js` for Task W3-03. The four requested checks were applied:

1. ✅ **pruneOldCards() method correct** — Logic is sound. Correctly groups timestamped `.txt` files by base filename, sorts chronologically, and prunes beyond the `maxPerFile` limit. LATEST_ files are correctly excluded.
2. ✅ **Called at right location** — Invoked at the end of `printAllFromCards()` (line 288), after all cards are printed. Reasonable placement.
3. ⚠️ **Error handling in place** — Outer and inner try-catch blocks present. One minor gap: `printCard()` does not wrap `writeFileSync` calls (lines 178, 182), relying on the caller's try-catch.
4. ✅ **No syntax errors** — File parses correctly.

## Warnings

### WR-01: `pruneOldCards` return value creates confusing nested property name

**File:** `backend/schemaCardPrinter.js:288-290`
**Issue:** `pruneOldCards()` returns `{ pruned, kept }`, but the result is stored in a variable also named `pruned`. This creates a nested structure where `printAllFromCards()` returns `{ printed, errors, pruned: { pruned: number, kept: number } }`. A consumer accessing `result.pruned` gets an object instead of a number, and the actual count requires `result.pruned.pruned`.
**Fix:** Rename the variable to avoid shadowing:
```js
// Instead of:
const pruned = this.pruneOldCards();
return { printed, errors, pruned };

// Use:
const pruneResult = this.pruneOldCards();
return { printed, errors, ...pruneResult };
// Or: return { printed, errors, prunedCount: pruneResult.pruned, keptCount: pruneResult.kept };
```

### WR-02: `printCard()` does not wrap `writeFileSync` in try-catch

**File:** `backend/schemaCardPrinter.js:178, 182`
**Issue:** `printCard()` calls `fs.writeFileSync()` twice without its own error handling. If either write fails (disk full, permission denied), the error propagates uncaught to the caller. While `printAllFromCards()` catches these errors (line 279), direct callers of `printCard()` outside that method would see unhandled exceptions.
**Fix:** Either add a try-catch inside `printCard()`, or document that callers must wrap calls in try-catch:
```js
try {
    fs.writeFileSync(outputPath, lines.join('\n'));
    fs.writeFileSync(latestPath, lines.join('\n'));
} catch (err) {
    console.error(`[st8:printer] Failed to write card for ${card.filepath}:`, err.message);
    return null;
}
```

## Info

### IN-01: Return value of `printAllFromCards` discarded by caller

**File:** `backend/index.js:159`
**Issue:** The caller does `printer.printAllFromCards(...)` without capturing the return value. The `{ printed, errors, pruned }` stats are only available through internal `console.log` statements. Not a bug, but the return value is unused dead computation.
**Fix:** Either capture the return value for logging/status, or change the return to `void`:
```js
// Option A: Use the return value
const result = printer.printAllFromCards(path.join(targetDir, '.st8', 'schema-cards'));
console.log(`[st8] Schema cards: ${result.printed} printed, ${result.pruned.pruned} pruned`);

// Option B: Remove the return (if stats aren't needed externally)
// Change printAllFromCards to return void
```

### IN-02: `safeName` does not sanitize all special filesystem characters

**File:** `backend/schemaCardPrinter.js:66`
**Issue:** The filename sanitization only replaces `/` and `\` with underscores. Characters like `:`, `*`, `?`, `"`, `<`, `>`, `|` are not sanitized. On Linux, only `/` and null are truly forbidden, but filenames with these characters can cause issues with shell scripts and cross-platform tools.
**Fix:** Consider a more comprehensive sanitization:
```js
const safeName = card.filepath.replace(/[^a-zA-Z0-9._-]/g, '_');
```

---

_Reviewed: 2026-05-13T00:00:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
