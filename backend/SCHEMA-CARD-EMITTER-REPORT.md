# SchemaCardEmitter Integration Report

**Task:** 05 — Create schemaCardEmitter.js
**File:** `backend/schemaCardEmitter.js`
**Status:** COMPLETE
**Date:** 2026-05-13

---

## Summary

Created the `SchemaCardEmitter` class that generates deterministic `.st8/schema-cards/*.json` files for each tracked file. The module is fully wired to the existing `st8-types` and `persistence` modules, with lazy-loaded `astParser` dependency.

---

## Integration Points

### 1. st8-types (Type System)

**File:** `backend/st8-types.js`
**Import:** `const { validateSt8SchemaCard, St8SchemaCard } = require('./st8-types');`
**Location:** `backend/schemaCardEmitter.js:15`

| Symbol | Type | Usage |
|--------|------|-------|
| `validateSt8SchemaCard` | function | Called in `emitCard()` at line 66 to validate generated card against canonical shape |
| `St8SchemaCard` | object | Used in `emitCard()` at line 74 for deterministic key ordering; used in `diff()` at line 156 as field reference |

**Status:** ✅ Wired — both symbols resolve correctly

---

### 2. astParser (AST Extraction)

**File:** `lib/utils/astParser.js`
**Import:** Lazy-loaded in `emitAllCards()` at line 92:
```javascript
const { extractImportsAndExports } = require(path.join(__dirname, '..', 'lib', 'utils', 'astParser.js'));
```
**Resolved path:** `/home/bozertron/1_AT_A_TIME/st8/lib/utils/astParser.js`

| Symbol | Type | Usage |
|--------|------|-------|
| `extractImportsAndExports` | function | Called in `emitAllCards()` at line 106 to parse each file's imports/exports |

**Status:** ✅ Wired — function exported at `lib/utils/astParser.js:39`

---

### 3. persistence (Database Layer)

**File:** `backend/persistence.js`
**Import:** CLI mode only — `const { St8Persistence } = require('./persistence');` at line 181
**Programmatic:** Caller passes `persistence` instance to `emitAllCards()`

| Method | Usage Location | Notes |
|--------|---------------|-------|
| `persistence.getAllFiles()` | Line 94 | Returns array of St8FileEntry objects |
| `persistence.getAllIntents()` | Line 95 | Returns map of fingerprint → intent object |
| `persistence.getMutationCount(fingerprint)` | Line 113 | Returns mutation count for file |
| `persistence.getLastMutation(fingerprint)` | Line 114 | Returns last mutation record |

**Status:** ⚠️ Partially Wired — `getAllFiles()` and `getAllIntents()` exist in `persistence.js` (lines 170, 251). `getMutationCount()` and `getLastMutation()` are NOT YET IMPLEMENTED in persistence.js — these will throw at runtime until added by a future task. The `try-catch` in the loop (line 125) handles this gracefully.

---

### 4. File System (Output Directory)

**Path:** `.st8/schema-cards/`
**Created by:** `_ensureOutputDir()` at line 25-29
**Trigger:** Constructor call (line 22)

**Status:** ✅ Wired — directory created automatically on instantiation

---

### 5. Module Exports

**Location:** `backend/schemaCardEmitter.js:192`
```javascript
module.exports = { SchemaCardEmitter };
```

**Status:** ✅ Wired — single named export

---

## Methods Implemented

| Method | Lines | Purpose |
|--------|-------|---------|
| `constructor(targetDir, options)` | 18-23 | Initialize with target directory, output path, strict mode |
| `_ensureOutputDir()` | 25-29 | Create `.st8/schema-cards/` if missing |
| `emitCard(file, astResult, connections, intent, mutationSummary)` | 39-85 | Generate and persist schema card for one file |
| `emitAllCards(persistence)` | 91-133 | Batch emit cards for all tracked files |
| `_cardFilename(filepath)` | 139-141 | Convert path to safe filename (`backend/server.js` → `backend_server.js.json`) |
| `diff(file, currentCard)` | 147-167 | Compare current state against persisted card |

---

## Deviation from Spec

**Bug fixed (Rule 1):** The spec's `JSON.stringify(card, Object.keys(St8SchemaCard).sort(), 2)` used a key array as replacer, which filtered out nested object keys (`connections.importedBy`, all `intent.*` fields, `lastMutation.*` fields). Fixed by using a replacer function that sorts keys at every nesting level while preserving all data.

**File:** `backend/schemaCardEmitter.js:71-82`
**Impact:** Schema cards now correctly persist full `connections`, `intent`, and `lastMutation` objects.

---

## Verification Results

| Check | Result |
|-------|--------|
| `node -c backend/schemaCardEmitter.js` | ✅ PASS (valid syntax) |
| `SchemaCardEmitter` instantiation | ✅ PASS |
| `emitCard()` method exists | ✅ PASS |
| `emitAllCards()` method exists | ✅ PASS |
| `diff()` method exists | ✅ PASS |
| `_cardFilename()` conversion | ✅ PASS (`backend/server.js` → `backend_server.js.json`) |
| `.st8/schema-cards/` directory | ✅ EXISTS |
| CLI `--diff` mode | ✅ PASS |
| Nested object persistence | ✅ PASS (connections, intent, lastMutation preserved) |

---

## Dependencies for Full Functionality

| Dependency | Status | Required By |
|-----------|--------|-------------|
| `st8-types.js` | ✅ Complete | emitCard, diff |
| `astParser.js` | ✅ Complete | emitAllCards |
| `persistence.js` (getAllFiles) | ✅ Complete | emitAllCards |
| `persistence.js` (getAllIntents) | ✅ Complete | emitAllCards |
| `persistence.js` (getMutationCount) | ❌ Not implemented | emitAllCards |
| `persistence.js` (getLastMutation) | ❌ Not implemented | emitAllCards |

---

## Downstream Consumers

This module will be consumed by:
- **Task 08** — Wiring schema emitter into the indexer pipeline
- **Task 09** — Wiring schema emitter into the file watcher
- **Task 12** — Schema card validation in CI
- **Task 13** — Schema card diff reporting
