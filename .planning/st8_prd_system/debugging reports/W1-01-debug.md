# W1-01 Debug Report — printAllFromCards() Skipped Card Count

**Date:** 2026-05-13
**File:** `backend/schemaCardPrinter.js`
**Status:** FIXED

---

## Issue

`printAllFromCards()` counted skipped cards as "printed" because it ignored the return value of `printCard()`.

## Root Cause

In `printAllFromCards()` (line 203-204), the call to `this.printCard(card)` was fire-and-forget — the return value was discarded, and `printed++` executed unconditionally.

`printCard()` returns `null` when a card is skipped due to guard clauses:
- **Skip extensions:** `.txt`, `.json`, `.sqlite-wal`, `.sqlite-shm` (line 46-52)
- **Schema card directory:** files inside `.st8/schema-cards` (line 54-56)
- **Ignored prefixes:** `.archive/`, `.planning/`, `.st8/`, `vendor/`, `snapshots/` (line 58-63)

This meant the `{ printed, errors }` return value and the log line `[st8:printer] Printed X cards` reported inflated counts.

## Fix Applied

**Before:**
```javascript
this.printCard(card);
printed++;
```

**After:**
```javascript
const result = this.printCard(card);
if (result !== null) {
    printed++;
}
```

## Verification

- Fix is minimal and targeted — only the counter logic changed
- No behavioral change to actual card printing
- `printCard()` return contract unchanged (`null` = skipped, `{ path, latestPath }` = printed)
- Adjacent `errors` counter unaffected
