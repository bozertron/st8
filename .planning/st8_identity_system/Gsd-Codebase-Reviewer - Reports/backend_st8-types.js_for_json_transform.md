# GSD Codebase Reviewer Report: `backend/st8-types.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/st8-types.js`
**Total Lines:** 281
**Reviewed:** 2026-05-13
**Language:** JavaScript (Node.js, CommonJS)
**Purpose:** Canonical type definitions — single source of truth for all st8 data shapes

---

## Section-by-Section Analysis

---

### Lines 1-11: File Header & Strict Mode

```
Lines 1-11: [File header, shebang, docstring, 'use strict' directive]
- What triggers it: Module load (require/import)
- What it calls: N/A
- What calls it: Every module that requires st8-types
- Dependencies: None
- Status: WORKING
- Gap: None
```

**Notes:**
- Line 1: `#!/usr/bin/env node` — shebang allows direct CLI execution. Correct.
- Line 9: Docstring claims "No module may define its own type shape for data that crosses module boundaries." This is an architectural contract, not enforced by code.
- Line 11: `'use strict'` — correct for a Node.js module.

---

### Lines 13-21: LifecyclePhase Enum

```
Lines 13-21: [LifecyclePhase frozen enum — 5 values]
- What triggers it: Module load; referenced by other modules via destructured import
- What it calls: Object.freeze()
- What calls it:
  - persistence.js:17 (imported but NEVER USED in code — dead import)
  - st8-types.js:70 (default value in St8FileEntry shape)
  - st8-types.js:90 (default value in St8SchemaCard shape)
  - st8-types.js:247 (CLI self-test prints values)
- Dependencies: None
- Status: PARTIAL — exported, imported by persistence.js, but never referenced in persistence.js code
- Gap: persistence.js imports LifecyclePhase at line 17 but never uses it. Dead import.
```

**Values:** `CONCEPT`, `LOCKED`, `WIRING`, `DEVELOPMENT`, `PRODUCTION`

**Bug — Unused Import in persistence.js:**
- `persistence.js:17` destructures `LifecyclePhase` from the require but grepping the entire file shows zero references to `LifecyclePhase` outside that import line. This is a dead import.

---

### Lines 23-32: FileStatus Enum

```
Lines 23-32: [FileStatus frozen enum — 6 values]
- What triggers it: Module load; referenced by other modules via destructured import
- What it calls: Object.freeze()
- What calls it:
  - persistence.js:17 (imported but NEVER USED in code — dead import)
  - st8-types.js:67 (default value in St8FileEntry shape)
  - st8-types.js:87 (default value in St8SchemaCard shape)
- Dependencies: None
- Status: PARTIAL — exported, imported by persistence.js, but never referenced in persistence.js code
- Gap: persistence.js imports FileStatus at line 17 but never uses it. Dead import.
```

**Values:** `GREEN`, `YELLOW`, `RED`, `CONCEPT`, `LOCKED`, `PRODUCTION`

**Bug — Unused Import in persistence.js:**
- Same as LifecyclePhase. `persistence.js:17` destructures `FileStatus` but never references it.

---

### Lines 34-46: MutationType Enum

```
Lines 34-46: [MutationType frozen enum — 9 values]
- What triggers it: Module load; referenced by index.js via destructured import
- What it calls: Object.freeze()
- What calls it:
  - index.js:19 (imported)
  - index.js:116 (MutationType.CREATE)
  - index.js:284 (MutationType.CREATE)
  - index.js:293 (MutationType.CREATE)
  - index.js:337 (MutationType.EDIT)
  - index.js:346 (MutationType.EDIT)
  - st8-types.js:248 (CLI self-test prints values)
- Dependencies: None
- Status: WORKING — actively used in index.js
- Gap: None
```

**Values:** `CONCEPT`, `CREATE`, `EDIT`, `RENAME`, `REFACTOR`, `DELETE`, `LOCK`, `PRODUCTION`, `PURGE`

**Usage Verification:**
- Only `CREATE` and `EDIT` are actually used in consuming code. The other 7 values (`CONCEPT`, `RENAME`, `REFACTOR`, `DELETE`, `LOCK`, `PRODUCTION`, `PURGE`) are defined but never referenced outside this file. This may be intentional (future use) but is worth noting.

---

### Lines 48-55: ActorType Enum

```
Lines 48-55: [ActorType frozen enum — 4 values]
- What triggers it: Module load; referenced by index.js via destructured import
- What it calls: Object.freeze()
- What calls it:
  - index.js:19 (imported)
  - index.js:118 (ActorType.INDEXER)
  - index.js:146 (ActorType.INDEXER)
  - index.js:223 (ActorType.WATCHER)
  - index.js:232 (ActorType.WATCHER)
  - index.js:286 (ActorType.WATCHER)
  - index.js:294 (ActorType.WATCHER)
  - index.js:339 (ActorType.WATCHER)
  - index.js:347 (ActorType.WATCHER)
- Dependencies: None
- Status: WORKING — actively used in index.js
- Gap: `DEVELOPER` and `AGENT` values are defined but never used in any consuming code.
```

**Values:** `DEVELOPER`, `INDEXER`, `WATCHER`, `AGENT`

**Usage Verification:**
- Only `INDEXER` and `WATCHER` are used in consuming code. `DEVELOPER` and `AGENT` are defined but never referenced.

---

### Lines 57-75: St8FileEntry Shape (Template Object)

```
Lines 57-75: [St8FileEntry — canonical file shape, frozen template object]
- What triggers it: Module load; referenced by persistence.js and schemaCardEmitter.js
- What it calls: Object.freeze()
- What calls it:
  - persistence.js:17 (imported but NEVER USED — dead import)
  - schemaCardEmitter.js:33 (referenced in JSDoc comment only, not code)
  - st8-types.js:166 (used by validateSt8FileEntry)
  - st8-types.js:244 (CLI self-test)
  - st8-types.js:251 (CLI self-test spread)
- Dependencies: LifecyclePhase, FileStatus (values referenced in defaults)
- Status: PARTIAL — exported but never used as a code reference by any consumer
- Gap: See bugs below
```

**Fields:**
| Line | Field | Type | Default | Used Externally? |
|------|-------|------|---------|-----------------|
| 62 | fingerprint | string | `''` | Yes (all files) |
| 63 | filepath | string | `''` | Yes (all files) |
| 64 | filename | string | `''` | Yes (all files) |
| 65 | sha256Hash | string | `''` | Yes (persistence, indexer) |
| 66 | fileSizeBytes | number | `0` | Yes (persistence) |
| 67 | status | string | `'RED'` | Yes (persistence) |
| 68 | reachabilityScore | number | `0.0` | Yes (persistence) |
| 69 | impactRadius | number | `0` | Yes (persistence) |
| 70 | lifecyclePhase | string | `'DEVELOPMENT'` | Yes (persistence) |
| 71 | birthTimestamp | string | `''` | Yes (all files) |
| 72 | lastModified | string | `''` | Yes (persistence) |
| 73 | lastIndexed | string | `''` | Yes (persistence) |
| 74 | isEntryPoint | boolean | `false` | Yes (persistence) |

**BUG — Shallow Freeze Allows Nested Mutation:**
- `Object.freeze()` is shallow. However, `St8FileEntry` has no nested objects/arrays, so this is not a problem for this specific shape. The freeze is effective here.

**BUG — Shape Used as Schema but Never for Runtime Validation:**
- `St8FileEntry` is imported by `persistence.js:17` but never used. The persistence module builds its own SQL queries with hardcoded column names (e.g., `persistence.js:391-396`) rather than deriving them from this shape. This means if a field is added to `St8FileEntry`, persistence.js will NOT automatically pick it up — the shape is disconnected from actual database operations.

---

### Lines 77-120: St8SchemaCard Shape (Template Object)

```
Lines 77-120: [St8SchemaCard — extended file shape for emission, frozen template object]
- What triggers it: Module load; referenced by schemaCardEmitter.js
- What it calls: Object.freeze()
- What calls it:
  - schemaCardEmitter.js:15 (imported: validateSt8SchemaCard, St8SchemaCard)
  - schemaCardEmitter.js:171 (Object.keys(St8SchemaCard) in diff method)
  - st8-types.js:170 (used by validateSt8SchemaCard)
  - st8-types.js:245 (CLI self-test)
- Dependencies: None (inline values)
- Status: PARTIAL — works but has deep validation gap
- Gap: See bugs below
```

**Fields (Core Identity — from St8FileEntry):**
| Line | Field | Type | Default |
|------|-------|------|---------|
| 82 | fingerprint | string | `''` |
| 83 | filepath | string | `''` |
| 84 | filename | string | `''` |
| 85 | sha256Hash | string | `''` |
| 86 | fileSizeBytes | number | `0` |
| 87 | status | string | `'RED'` |
| 88 | reachabilityScore | number | `0.0` |
| 89 | impactRadius | number | `0` |
| 90 | lifecyclePhase | string | `'DEVELOPMENT'` |
| 91 | birthTimestamp | string | `''` |
| 92 | lastModified | string | `''` |
| 93 | lastIndexed | string | `''` |
| 94 | isEntryPoint | boolean | `false` |

**Fields (AST-extracted data):**
| Line | Field | Type | Default |
|------|-------|------|---------|
| 97 | exports | array | `[]` |
| 98 | imports | array | `[]` |

**Fields (Connection data):**
| Line | Field | Type | Default |
|------|-------|------|---------|
| 101-104 | connections | object | `{ importedBy: [], imports: [] }` |

**Fields (Intent data):**
| Line | Field | Type | Default |
|------|-------|------|---------|
| 107-111 | intent | object | `{ purpose: '', dependsOnBehavior: '', valueStatement: '' }` |

**Fields (Mutation summary):**
| Line | Field | Type | Default |
|------|-------|------|---------|
| 114 | mutationCount | number | `0` |
| 115-119 | lastMutation | object | `{ type: '', actor: '', timestamp: '' }` |

**CRITICAL BUG — Shallow Freeze + Nested Objects = Shared Mutable State:**
- `Object.freeze()` on line 80 is **shallow**. The nested objects `connections` (line 101), `intent` (line 107), and `lastMutation` (line 115) are **NOT frozen**.
- The arrays `exports` (line 97), `imports` (line 98), `connections.importedBy` (line 102), and `connections.imports` (line 103) are **NOT frozen**.
- If any consumer does `const card = { ...St8SchemaCard }` and then mutates `card.connections.importedBy.push('x')`, it **mutates the original template** because spread is shallow — `card.connections` is the same object reference as `St8SchemaCard.connections`.
- This is a **data corruption risk** in any code path that creates cards from the template.

**CRITICAL BUG — Validation is Shallow for Nested Objects:**
- `validateSt8SchemaCard()` calls `validateAgainstShape(obj, St8SchemaCard)` (line 170).
- `validateAgainstShape` (line 140) only checks `typeof` at the top level.
- For nested fields (`connections`, `intent`, `lastMutation`), it only checks `typeof === 'object'`. It does NOT:
  - Verify that `connections.importedBy` exists
  - Verify that `intent.purpose` exists
  - Verify that `lastMutation.type` exists
  - Distinguish between `{}` and `[]` (both are `typeof 'object'`)
- This means a schema card with `connections: {}` (missing `importedBy`/`imports`) passes validation.

---

### Lines 122-132: St8MutationRecord Shape (Template Object)

```
Lines 122-132: [St8MutationRecord — mutation log record shape, frozen template object]
- What triggers it: Module load; exported but NEVER imported by any file
- What it calls: Object.freeze()
- What calls it:
  - st8-types.js:174 (used by validateSt8MutationRecord)
  - st8-types.js:246 (CLI self-test)
- Dependencies: None
- Status: NOT CONNECTED — exported but never imported by any consuming module
- Gap: This shape is dead code in the current codebase. No module writes or reads mutation records using this shape.
```

**Fields:**
| Line | Field | Type | Default |
|------|-------|------|---------|
| 125 | fingerprint | string | `''` |
| 126 | sha256Hash | string | `''` |
| 127 | mutationType | string | `''` |
| 128 | changedFields | string | `''` (JSON string) |
| 129 | actor | string | `''` |
| 130 | timestamp | string | `''` |
| 131 | metadata | string | `''` (JSON string) |

**Design Note:** `changedFields` and `metadata` are stored as JSON strings (line 128, 131). This is a serialization pattern — the actual data is nested but stored as string. The validator cannot check the inner structure of these fields.

---

### Lines 134-163: `validateAgainstShape()` Function

```
Lines 134-163: [validateAgainstShape — generic shape validator]
- What triggers it: Called by validateSt8FileEntry, validateSt8SchemaCard, validateSt8MutationRecord
- What it calls: Object.keys(), typeof operator
- What calls it:
  - st8-types.js:166 (validateSt8FileEntry)
  - st8-types.js:170 (validateSt8SchemaCard)
  - st8-types.js:174 (validateSt8MutationRecord)
  - schemaCardEmitter.js:66 (via validateSt8SchemaCard)
- Dependencies: None
- Status: WORKING — but has multiple validation gaps
- Gap: See bugs below
```

**BUG (Line 147) — Null/Undefined Pass Type Check:**
```js
} else if (typeof obj[key] !== typeof shape[key] && obj[key] !== null && obj[key] !== undefined) {
```
- This condition explicitly skips type checking when `obj[key]` is `null` or `undefined`.
- Consequence: `{ filepath: null, fingerprint: undefined }` passes validation for `St8FileEntry` even though these should be strings.
- This is intentional leniency but undermines the purpose of the validator.

**BUG (Line 147) — Array vs Object Not Distinguished:**
- `typeof [] === 'object'` and `typeof {} === 'object'` are both `true`.
- For `St8SchemaCard`, the `exports` field defaults to `[]` (array). Passing `exports: {}` would pass validation because `typeof {} === typeof []` → `'object'`.
- Similarly, `connections: []` would pass when it should be `{ importedBy: [], imports: [] }`.

**BUG — No Recursive Validation:**
- The validator only checks top-level keys. Nested objects (`connections`, `intent`, `lastMutation` in `St8SchemaCard`) are not recursively validated.
- A card with `connections: { foo: 'bar' }` (missing `importedBy` and `imports`) passes validation.

**BUG (Line 140) — No Null Check on `obj` Parameter:**
- If `obj` is `null` or `undefined`, `Object.keys(shape)` succeeds but `key in obj` on line 144 throws `TypeError: Cannot use 'in' operator`.
- No defensive check at function entry.

**BUG (Line 140) — No Null Check on `shape` Parameter:**
- If `shape` is `null` or `undefined`, `Object.keys(shape)` throws `TypeError: Cannot convert undefined or null to object`.

---

### Lines 165-175: Validator Wrapper Functions

```
Lines 165-175: [validateSt8FileEntry, validateSt8SchemaCard, validateSt8MutationRecord]
- What triggers it: Called by consumers or CLI self-test
- What it calls: validateAgainstShape()
- What calls it:
  - validateSt8FileEntry: st8-types.js:252 (CLI self-test only — NEVER called externally)
  - validateSt8SchemaCard: schemaCardEmitter.js:66 (actively used)
  - validateSt8MutationRecord: NEVER called externally
- Dependencies: validateAgainstShape, St8FileEntry, St8SchemaCard, St8MutationRecord
- Status: PARTIAL — only validateSt8SchemaCard is connected to real code
- Gap: validateSt8FileEntry and validateSt8MutationRecord are dead code outside this file
```

**Usage Summary:**
| Function | External Callers | Status |
|----------|-----------------|--------|
| `validateSt8FileEntry` | None | DEAD CODE |
| `validateSt8SchemaCard` | schemaCardEmitter.js:66 | WORKING |
| `validateSt8MutationRecord` | None | DEAD CODE |

---

### Lines 177-189: FINGERPRINT_SEPARATOR Constant

```
Lines 177-189: [FINGERPRINT_SEPARATOR constant = '||']
- What triggers it: Module load
- What it calls: N/A
- What calls it:
  - st8-types.js:199 (used in generateFingerprint)
- Dependencies: None
- Status: WORKING — but NOT EXPORTED
- Gap: Not exported. Any module that needs to parse fingerprints without using parseFingerprint() cannot access the canonical separator. Currently no module needs it, but it breaks the "single source of truth" contract.
```

**Design Issue:**
- The constant is `const` (not exported). If any external module ever needs to construct or parse fingerprints manually, they'd have to hardcode `'||'` or import `parseFingerprint`/`generateFingerprint`.
- The docstring (lines 180-188) provides excellent migration context about the old `:` separator. This is good documentation.

---

### Lines 191-200: `generateFingerprint()` Function

```
Lines 191-200: [generateFingerprint — creates stable fingerprint from filepath + birthTimestamp]
- What triggers it: Called by index.js, indexer.js, persistence.js
- What it calls: String template literal with FINGERPRINT_SEPARATOR
- What calls it:
  - index.js:19 (imported), index.js:259 (called)
  - indexer.js:16 (imported), indexer.js:387 (called)
  - persistence.js:386 (re-imported inside function body), persistence.js:388 (called)
- Dependencies: FINGERPRINT_SEPARATOR
- Status: WORKING — actively used by 3 files
- Gap: See bugs below
```

**BUG (Line 198-199) — No Input Validation:**
```js
function generateFingerprint(filepath, birthTimestamp) {
    return `${filepath}${FINGERPRINT_SEPARATOR}${birthTimestamp}`;
}
```
- If `filepath` is `undefined`, produces `"undefined||..."`.
- If `birthTimestamp` is `undefined`, produces `"filepath||undefined"`.
- If `filepath` is `null`, produces `"null||..."`.
- No type checking, no assertion, no error thrown.
- Downstream consumers (database, schema cards) would store corrupted fingerprints silently.

**CODE SMELL (persistence.js:386) — Redundant Re-import:**
```js
// persistence.js:386
const { generateFingerprint } = require('./st8-types');
```
- `persistence.js` already imports from `st8-types` at line 17 but does NOT include `generateFingerprint` in that destructuring.
- At line 386, inside `registerConceptFile()`, it re-requires `st8-types` to get `generateFingerprint`.
- Node.js caches modules so this is functionally correct, but it's inconsistent with the pattern used by `index.js` and `indexer.js` (single top-level import).
- This suggests `generateFingerprint` was added to `persistence.js` after the initial import line was written, and nobody cleaned it up.

---

### Lines 202-235: `parseFingerprint()` Function

```
Lines 202-235: [parseFingerprint — parses fingerprint back into filepath + birthTimestamp]
- What triggers it: Exported but NEVER called by any module
- What it calls: String.indexOf(), String.lastIndexOf(), String.substring()
- What calls it: NOTHING — dead code in current codebase
- Dependencies: None
- Status: NOT CONNECTED — exported but never imported or called
- Gap: See bugs below
```

**BUG (Line 217) — No Null/Undefined Check:**
```js
function parseFingerprint(fingerprint) {
    const doublePipe = fingerprint.indexOf('||');
```
- If `fingerprint` is `null` or `undefined`, this throws `TypeError: Cannot read properties of null (reading 'indexOf')`.
- No defensive guard at function entry.

**BUG (Lines 229-234) — Legacy Parsing Ambiguity:**
```js
const lastColon = fingerprint.lastIndexOf(':');
if (lastColon === -1) return { filepath: fingerprint, birthTimestamp: '' };
return {
    filepath: fingerprint.substring(0, lastColon),
    birthTimestamp: fingerprint.substring(lastColon + 1)
};
```
- For legacy fingerprints with ISO 8601 timestamps (e.g., `path/file.js:2024-01-15T10:30:45.123Z`), `lastIndexOf(':')` splits at the last `:` in the timestamp, producing:
  - `filepath: "path/file.js:2024-01-15T10:30:45.123"` (WRONG — includes part of timestamp)
  - `birthTimestamp: "123Z"` (WRONG — truncated)
- The docstring (lines 212-216) acknowledges this is a known limitation, but the function still silently returns wrong results instead of throwing an error.
- The comment says "those records are corrupted and must be regenerated" but the function doesn't detect or flag this condition.

**DESIGN NOTE:** This function is exported (line 280) but never imported by any file in the codebase. It exists purely for future use or manual debugging.

---

### Lines 237-263: CLI Validation Command

```
Lines 237-263: [CLI self-test — runs when file is executed directly]
- What triggers it: `node st8-types.js --validate`
- What it calls: Object.keys(), Object.values(), validateSt8FileEntry(), process.exit()
- What calls it: Direct CLI execution only
- Dependencies: All shapes and enums defined above
- Status: WORKING
- Gap: Limited self-test coverage
```

**What the self-test does:**
1. Lines 243-248: Prints field names and enum values (diagnostic output)
2. Lines 251-252: Creates a test entry using spread of `St8FileEntry` + overrides
3. Lines 253-258: Validates and reports PASS/FAIL

**GAPS in self-test:**
- Only tests `St8FileEntry` validation. Does NOT test `St8SchemaCard` or `St8MutationRecord`.
- Does NOT test `generateFingerprint()` or `parseFingerprint()`.
- Does NOT test the `strict` mode of `validateAgainstShape()`.
- Does NOT test edge cases (null input, missing fields, wrong types).
- Does NOT test legacy fingerprint parsing.

---

### Lines 265-281: Module Exports

```
Lines 265-281: [module.exports — all public symbols]
- What triggers it: Module load (require)
- What it calls: N/A
- What calls it: Node.js module system
- Dependencies: All defined symbols
- Status: WORKING
- Gap: See usage analysis below
```

**Export Usage Matrix:**

| Export | Line | Imported By | Actually Used? | Status |
|--------|------|-------------|----------------|--------|
| `LifecyclePhase` | 268 | persistence.js:17 | NO (dead import) | ⚠️ UNUSED |
| `FileStatus` | 269 | persistence.js:17 | NO (dead import) | ⚠️ UNUSED |
| `MutationType` | 270 | index.js:19 | YES (5 refs) | ✅ WORKING |
| `ActorType` | 271 | index.js:19 | YES (8 refs) | ✅ WORKING |
| `St8FileEntry` | 272 | persistence.js:17 | NO (dead import) | ⚠️ UNUSED |
| `St8SchemaCard` | 273 | schemaCardEmitter.js:15 | YES (line 171) | ✅ WORKING |
| `St8MutationRecord` | 274 | (none) | NEVER IMPORTED | ❌ DEAD CODE |
| `validateAgainstShape` | 275 | (none) | NEVER IMPORTED | ❌ DEAD CODE |
| `validateSt8FileEntry` | 276 | (none) | NEVER IMPORTED | ❌ DEAD CODE |
| `validateSt8SchemaCard` | 277 | schemaCardEmitter.js:15 | YES (line 66) | ✅ WORKING |
| `validateSt8MutationRecord` | 278 | (none) | NEVER IMPORTED | ❌ DEAD CODE |
| `generateFingerprint` | 279 | index.js:19, indexer.js:16, persistence.js:386 | YES (3 files) | ✅ WORKING |
| `parseFingerprint` | 280 | (none) | NEVER IMPORTED | ❌ DEAD CODE |

**Not Exported (but should be?):**
| Symbol | Line | Reason |
|--------|------|--------|
| `FINGERPRINT_SEPARATOR` | 189 | Used internally only; breaks "single source of truth" if external code needs it |

---

## Cross-File Connection Map

```
st8-types.js
├── EXPORTS → index.js
│   ├── generateFingerprint (line 259)
│   ├── MutationType (lines 116, 284, 293, 337, 346)
│   └── ActorType (lines 118, 146, 223, 232, 286, 294, 339, 347)
│
├── EXPORTS → indexer.js
│   └── generateFingerprint (line 387)
│
├── EXPORTS → persistence.js
│   ├── St8FileEntry (IMPORTED BUT UNUSED)
│   ├── LifecyclePhase (IMPORTED BUT UNUSED)
│   ├── FileStatus (IMPORTED BUT UNUSED)
│   └── generateFingerprint (re-imported at line 386, used at line 388)
│
├── EXPORTS → schemaCardEmitter.js
│   ├── validateSt8SchemaCard (line 66)
│   └── St8SchemaCard (line 171)
│
└── NEVER IMPORTED BY ANY FILE:
    ├── St8MutationRecord
    ├── validateAgainstShape
    ├── validateSt8FileEntry
    ├── validateSt8MutationRecord
    └── parseFingerprint
```

---

## @@@ Symbol Scan

**Result: No `@@@` symbols found in this file.**

Grep for `@@@` across the file returned zero matches. This file is clean of placeholder markers.

---

## Summary of All Findings

### Critical Issues (3)

1. **Shallow Freeze on St8SchemaCard (Lines 80-120):** `Object.freeze()` is shallow. Nested objects (`connections`, `intent`, `lastMutation`) and arrays (`exports`, `imports`, `connections.importedBy`, `connections.imports`) are mutable. Spread operations `{ ...St8SchemaCard }` share references to these nested objects, risking template corruption.

2. **Shallow Validation for Nested Shapes (Lines 140-163):** `validateAgainstShape()` only checks `typeof` at the top level. For `St8SchemaCard`, nested objects like `connections` are only checked for `typeof === 'object'` — not for required inner keys. Arrays and objects are indistinguishable. `connections: {}` passes validation.

3. **No Input Validation on `generateFingerprint` (Lines 198-200):** `undefined` or `null` arguments produce corrupted fingerprints like `"undefined||undefined"` that get silently stored in the database.

### Warnings (5)

4. **Dead Imports in persistence.js (Line 17):** `St8FileEntry`, `LifecyclePhase`, and `FileStatus` are imported but never used.

5. **Redundant Re-import in persistence.js (Line 386):** `generateFingerprint` is re-required inside `registerConceptFile()` instead of being included in the top-level import.

6. **`parseFingerprint` Throws on Null Input (Line 217-219):** No null/undefined guard. Crashes with `TypeError` on bad input.

7. **`parseFingerprint` Silent Corruption for ISO Legacy Fingerprints (Lines 229-234):** Legacy parsing with `lastIndexOf(':')` silently returns wrong results for ISO 8601 timestamps instead of detecting and flagging the corruption.

8. **`validateAgainstShape` Allows Null for Any Field (Line 147):** The `&& obj[key] !== null && obj[key] !== undefined` guard means `null` passes for any field type, undermining validation.

### Info (4)

9. **5 Exported Symbols Never Imported:** `St8MutationRecord`, `validateAgainstShape`, `validateSt8FileEntry`, `validateSt8MutationRecord`, `parseFingerprint` are exported but never imported by any file.

10. **`FINGERPRINT_SEPARATOR` Not Exported (Line 189):** Breaks "single source of truth" contract if external code needs the separator value.

11. **Limited Self-Test Coverage (Lines 237-263):** CLI `--validate` only tests `St8FileEntry`. Does not test `St8SchemaCard`, `St8MutationRecord`, fingerprint functions, edge cases, or strict mode.

12. **Unused Enum Values:** `LifecyclePhase.WIRING`, `MutationType.RENAME/REFACTOR/DELETE/LOCK/PRODUCTION/PURGE`, `ActorType.DEVELOPER/AGENT`, and `FileStatus.YELLOW/GREEN/LOCKED/PRODUCTION` are defined but never referenced in consuming code.

---

_Reviewed: 2026-05-13_
_Reviewer: GSD Codebase Reviewer_
_Depth: standard (line-by-line)_
_File: backend/st8-types.js (281 lines)_
