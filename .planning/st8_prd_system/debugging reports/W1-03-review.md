# W1-03 Code Review: Fix Empty AST on File Edit + Remove Duplicate Publish

**Reviewed:** 2026-05-13T00:00:00Z
**File:** `backend/index.js` (345 lines)
**Depth:** standard
**Status:** issues_found

---

## Checklist Results

| Check | Result | Details |
|---|---|---|
| `extractImportsAndExports()` call correct | ✅ PASS | Path resolves to `/st8/lib/utils/astParser.js`, function exists, signature matches (1 arg: `filePath`) |
| Duplicate `notificationBus.publish()` removed | ✅ PASS | Only 2 calls remain: CREATE (line 237) + EDIT (line 272) — no duplicates in EDIT path |
| Error handling in place | ✅ PASS | try/catch wraps AST extraction with empty fallback (lines 283–286) |
| No syntax errors | ✅ PASS | `node --check` passes (confirmed in W1-03-REPORT.md) |

**All 4 specified checks pass.** The task was implemented correctly.

---

## Findings (Supplementary — Beyond Task Scope)

### WR-01: `lastMutation` field name mismatch with `emitCard()` contract

**File:** `backend/index.js:291-292`
**Severity:** WARNING

`persistence.getLastMutation()` returns a raw SQLite row from `file_mutation_log` with columns:
```
{ id, fingerprint, sha256Hash, mutationType, changedFields, actor, timestamp, metadata }
```

But `schemaCardEmitter.emitCard()` (line 62) writes the card's `lastMutation` field as:
```javascript
lastMutation: (mutationSummary && mutationSummary.lastMutation) || { type: '', actor: '', timestamp: '' }
```

The fallback expects `{ type, actor, timestamp }` — but the raw row has `mutationType`, not `type`.

**Impact:** The schema card's `lastMutation.type` will always be `undefined` (falls through to empty string), silently losing the mutation type in emitted cards.

Note: `schemaCardEmitter.emitAllCards()` (line 118–119) correctly maps this:
```javascript
const lastMutation = rawLastMutation
    ? { type: rawLastMutation.mutationType, actor: rawLastMutation.actor, timestamp: rawLastMutation.timestamp }
    : null;
```

But the inline call in `index.js` does NOT perform this mapping.

**Fix:**
```javascript
// Line 289-292 — replace with:
const rawLast = persistence.getLastMutation(changedFile.fingerprint);
const card = emitter.emitCard(changedFile, astResult,
    { importedBy: [], imports: [] }, null,
    { count: persistence.getMutationCount(changedFile.fingerprint),
      lastMutation: rawLast
          ? { type: rawLast.mutationType, actor: rawLast.actor, timestamp: rawLast.timestamp }
          : { type: '', actor: '', timestamp: '' } });
```

---

### IN-01: Redundant inline `require('./manifestGenerator')` (line 153)

**File:** `backend/index.js:153`
**Severity:** INFO

`writeManifests` is already imported at the top of the file (line 16). The inline `require` on line 153 is redundant. Node.js caches modules so this is not a bug, but it's unnecessary noise.

**Fix:** Remove line 153 and use the top-level import directly:
```javascript
writeManifests(result.files, targetDir);
```

---

### IN-02: Inline `require('fs')` and `require('crypto')` in watcher callback

**File:** `backend/index.js:202-204, 253-255`
**Severity:** INFO

`fs` and `crypto` are required inline inside the watcher callback (lines 202–204 for add path, lines 253–255 for change path) instead of at module scope. This works due to Node.js module caching but is inconsistent with the file's other imports and slightly harder to read.

**Fix:** Add to the top-level imports:
```javascript
const fs = require('fs');
const crypto = require('crypto');
```
Then replace inline `require('fs').readFileSync(...)` with `fs.readFileSync(...)`, etc.

---

## Summary

The W1-03 task was implemented correctly — all 4 specified checks pass. The AST extraction is wired up properly, the duplicate publish was removed, error handling is in place, and there are no syntax errors.

One **WARNING** finding was identified beyond the task scope: the `lastMutation` object passed to `emitCard()` has the wrong field name (`mutationType` vs `type`), causing mutation type data to be silently lost in schema cards emitted during file watch events. This same mismatch does NOT affect `emitAllCards()` which correctly maps the field.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
