# Task W1-03 Report: Fix Empty AST on File Edit + Remove Duplicate Publish

## Summary
Fixed the file watcher's `change` handler in `backend/index.js` to run the AST parser on changed files before emitting schema cards, and removed the duplicate `notificationBus.publish()` call in the EDIT path.

---

## Changes Made

### File: `backend/index.js`

#### Part 1: AST Extraction Added (lines 280–286)

**Before (line 281):**
```javascript
const card = emitter.emitCard(changedFile, { imports: [], exports: [] }, ...);
```

**After (lines 280–292):**
```javascript
// Extract AST before emitting schema card
const fullPath = path.join(targetDir, changedFile.filepath);
let astResult = { imports: [], exports: [] };
try {
    const { extractImportsAndExports } = require(path.join(__dirname, '..', 'lib', 'utils', 'astParser.js'));
    astResult = extractImportsAndExports(fullPath);
} catch (e) { /* AST parse failed - use empty */ }

// Emit updated schema card
const card = emitter.emitCard(changedFile, astResult, ...);
```

- **Pattern:** AST extraction before schema card emission, matching `schemaCardEmitter.emitAllCards()` pattern (line 92, 106)
- **Import path:** `path.join(__dirname, '..', 'lib', 'utils', 'astParser.js')` resolves to `/st8/lib/utils/astParser.js` (confirmed via glob)
- **Error handling:** try/catch falls back to empty `{ imports: [], exports: [] }` on failure

#### Part 2: Duplicate Publish Removed (was lines 286–293)

**Removed:**
```javascript
notificationBus.publish({
    fingerprint: changedFile.fingerprint,
    filepath: relativePath,
    mutationType: 'EDIT',
    actor: 'WATCHER',
    sha256Hash: newHash,
    schemaCard: card  // Triggers .txt fallback
});
```

- **Remaining publish:** Line 272 — single `notificationBus.publish()` for EDIT mutations
- **Verification:** `grep -n "notificationBus.publish"` confirms exactly 2 calls: CREATE (line 237) + EDIT (line 272)

---

## Integration Points

| Integration | File | Line(s) | Pattern |
|---|---|---|---|
| `extractImportsAndExports()` | `backend/index.js` | 284–285 | `require()` + try/catch, same as `schemaCardEmitter.js:92,106` |
| `emitter.emitCard()` | `backend/index.js` | 289–292 | Changed arg2 from empty literal to `astResult` |
| `notificationBus.publish()` | `backend/index.js` | 272–278 | Single publish per EDIT (duplicate at old 286–293 removed) |

---

## Verification

- ✅ `node --check backend/index.js` — SYNTAX OK
- ✅ Only 2 `notificationBus.publish()` calls remain: CREATE (line 237) + EDIT (line 272)
- ✅ AST parser imported from same path as `schemaCardEmitter.js` uses
- ✅ Error handling: try/catch with empty fallback on AST failure
- ✅ `emitCard()` now receives real `astResult` instead of hardcoded empty arrays
