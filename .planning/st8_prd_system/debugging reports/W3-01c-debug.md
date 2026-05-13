# W3-01c Debug Report: Duplicate PRD Logic in server.js

**Date:** 2026-05-13
**Debug Session:** duplicate-prd-logic
**Status:** RESOLVED

---

## Issue

`_handlePrd` in `server.js` was a hand-copied subset of `prdGenerator.js` that had already diverged from the canonical implementation. This violated DRY and created a maintenance burden where any PRD enhancement had to be applied in two places.

## Root Cause

The `_handlePrd` method (originally lines 776-854) contained inline PRD generation logic that duplicated:

1. **Schema card loading** (lines 798-805) — duplicated `loadSchemaCards()` from prdGenerator.js
2. **PRD markdown generation** (lines 811-843) — duplicated `generatePRD()` + `generateCardMarkdown()` from prdGenerator.js

## Divergences Already Present

| Feature | prdGenerator.js | _handlePrd (before fix) |
|---------|-----------------|-------------------------|
| Summary table | ✅ Included | ❌ Missing |
| Lifecycle Phases count | ✅ In header | ❌ Missing |
| Dependency deduplication | ✅ `[...new Set(...)]` | ❌ No dedup |
| `isEntryPoint` metadata | ✅ Shown | ❌ Missing |
| `reachabilityScore` metadata | ✅ Shown | ❌ Missing |
| `impactRadius` metadata | ✅ Shown | ❌ Missing |

## Fix Applied

**File:** `backend/server.js`

Replaced 47 lines of inline PRD generation logic with 6 lines that import and call the existing module:

```javascript
const { loadSchemaCards, generatePRD } = require('./prdGenerator');
const cardsDir = path.join(this.targetDir, '.st8', 'schema-cards');

const cards = loadSchemaCards(cardsDir);
const prd = generatePRD(cards);

res.writeHead(200, { 'Content-Type': 'text/markdown' });
res.end(prd);
```

## Verification

- ✅ `require('./prdGenerator')` imports resolve correctly
- ✅ Smoke test: 39 schema cards loaded, 9099-char PRD generated
- ✅ PRD output now includes summary table, lifecycle phases count, deduped dependencies, and all metadata fields
- ✅ Error handling preserved (catches and returns 500 on failure)
- ✅ No test files exist in backend/ — no regressions possible from test suite

## Lines Changed

- **Removed:** ~47 lines of duplicated inline logic
- **Added:** 3 lines (import + 2 function calls)
- **Net reduction:** ~44 lines

## Impact

- Single source of truth for PRD generation
- Future PRD enhancements only need to be made in `prdGenerator.js`
- Server automatically benefits from all PRD features (summary table, metadata, dedup)
