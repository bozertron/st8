# W2-03 Code Review Report

**Reviewed:** 2026-05-13T00:00:00Z  
**Depth:** standard  
**Files Reviewed:** 2  
**Status:** issues_found

## Summary

Reviewed `backend/persistence.js` and `backend/index.js` for Task W2-03. The four requested checks were applied:

1. ✅ **upsertIntent default is 'INFERRED'** — Confirmed correct at `persistence.js:275`
2. ⚠️ **Enum constants used correctly** — Mixed usage; string literals in schema/code instead of enum constants
3. ✅ **updated_at renamed to updatedAt** — Confirmed correct in `st8_settings` table schema (line 122) and `upsertSetting` method (line 440)
4. ✅ **No syntax errors** — Both files parse correctly

## Warnings

### WR-01: Unused imports `LifecyclePhase` and `FileStatus` in persistence.js

**File:** `backend/persistence.js:17`
**Issue:** `LifecyclePhase` and `FileStatus` are imported from `./st8-types` but never referenced anywhere in the file. The schema and methods use hardcoded string literals instead (e.g., `'RED'`, `'DEVELOPMENT'`, `'INFERRED'`).
**Fix:** Either remove the unused imports, or replace the string literals with the enum constants for consistency and type safety:
```js
// Option A: Remove unused imports
const { St8FileEntry } = require('./st8-types');

// Option B: Use enum constants in defaults (preferred for maintainability)
file.status || FileStatus.RED,
file.lifecyclePhase || LifecyclePhase.DEVELOPMENT,
```

### WR-02: Schema defaults use string literals instead of enum constants

**File:** `backend/persistence.js:54-62`
**Issue:** The `ST8_SCHEMA` DDL uses hardcoded string literals for `status` (`'RED'`), `lifecyclePhase` (`'DEVELOPMENT'`), `connectionType` (`'IMPORT'`), `authoredBy` (`'INFERRED'`), and `actor` (`'DEVELOPER'`). These should reference the enum constants from `st8-types.js` to prevent drift if enum values change.
**Fix:** This is a design tension — SQLite DDL is a string template, so enum constants can't be interpolated directly. Acceptable as-is if the enum values in `st8-types.js` are treated as the canonical source and the DDL is kept in sync manually. Document this coupling with a comment:
```js
// NOTE: Schema string literals must match enum values in st8-types.js
const ST8_SCHEMA = `...`;
```

### WR-03: `index.js` uses enum constants inconsistently with `persistence.js`

**File:** `backend/index.js:114-117`
**Issue:** `index.js` correctly imports and uses `MutationType.CREATE`, `ActorType.INDEXER`, and `ActorType.WATCHER` from `st8-types.js`, but `persistence.js` does not use any enum constants. This creates an inconsistent pattern across the two files.
**Fix:** Align `persistence.js` to also import and use enum constants where possible (at minimum in the class methods, even if the DDL uses literals).

## Info

### IN-01: `writeManifests` imported twice in index.js

**File:** `backend/index.js:16` and `backend/index.js:153`
**Issue:** `writeManifests` is imported at the top of the file (line 16) and then re-imported inside the `if (result.files)` block (line 153). The top-level import is unused since the inner `require()` shadows it.
**Fix:** Remove the duplicate import at line 153 and use the top-level import:
```js
// Remove this at line 153:
// const { writeManifests } = require('./manifestGenerator');
writeManifests(result.files, targetDir);
```

### IN-02: `generateFingerprint` imported but unused at top level in index.js

**File:** `backend/index.js:19`
**Issue:** `generateFingerprint` is imported at the top of `index.js` but is only used inside the `onFileChange` callback (line 206). This is not a bug, but the import scope is broader than needed.
**Fix:** No action required — the import is valid and used. Just noting the scope.

---

_Reviewed: 2026-05-13T00:00:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
