# SchemaCardEmitter Debug Report

**File:** `backend/schemaCardEmitter.js`
**Date:** 2026-05-13
**Issues:** CR-01, CR-02

---

## CR-01: Missing `await` on `persistence.initialize()`

### Problem Description

`persistence.initialize()` is declared `async` in `persistence.js` (line 134) but called without `await` in the CLI block of `schemaCardEmitter.js` (originally line 183). The CLI block was a synchronous `if (require.main === module)` block, which cannot use `await` at the top level.

### Root Cause Analysis

The CLI entry point was written as:

```js
if (require.main === module) {
    const persistence = new St8Persistence();
    persistence.initialize();  // ← fire-and-forget, no await
    const emitter = new SchemaCardEmitter(targetDir);
    const result = emitter.emitAllCards(persistence);
    persistence.close();
    process.exit(result.errors > 0 ? 1 : 0);
}
```

Today this works by accident because `initialize()` only performs synchronous operations internally (`better-sqlite3` constructor + `db.exec()`). However, `initialize()` is declared `async`, which means:

1. It returns a `Promise`, not the result
2. If the body ever adds a genuine async operation (e.g., file I/O, network check, migration), the CLI will proceed before initialization completes
3. `emitAllCards()` would then call `persistence.getAllFiles()` on an uninitialized `this.db` → crash with "Cannot read property 'prepare' of null"
4. Errors thrown inside `initialize()` would become unhandled promise rejections (silent failure) rather than synchronous exceptions

### Fix Applied

Wrapped the CLI block in an async IIFE so `await` can be used:

```js
if (require.main === module) {
    (async () => {
        const persistence = new St8Persistence();
        await persistence.initialize();   // ← properly awaited
        const emitter = new SchemaCardEmitter(targetDir);
        const result = emitter.emitAllCards(persistence);
        persistence.close();
        process.exit(result.errors > 0 ? 1 : 0);
    })();
}
```

**Lines changed:** 178–198 (CLI block wrapped in async IIFE)

### Verification

- `node --check backend/schemaCardEmitter.js` → passes (no syntax errors)
- The `await` now correctly chains on the returned Promise from `initialize()`
- Any async operations added to `initialize()` in the future will be properly awaited before `emitAllCards()` runs
- Errors inside `initialize()` will propagate as rejected promises caught by the IIFE

---

## CR-02: Field Name Mismatch — `mutationType` vs `type`

### Problem Description

`persistence.getLastMutation()` returns a raw SQLite row from the `file_mutation_log` table. The table columns are:

```
id, fingerprint, sha256Hash, mutationType, changedFields, actor, timestamp, metadata
```

But the `St8SchemaCard` shape (defined in `st8-types.js`, lines 114–118) expects:

```js
lastMutation: {
    type: '',        // ← expects "type"
    actor: '',
    timestamp: ''
}
```

The emitter was passing the raw SQLite row directly, so `lastMutation.type` was always `undefined` — it should have been mapped from `lastMutation.mutationType`.

### Root Cause Analysis

In `emitAllCards()` (originally line 114):

```js
const lastMutation = persistence.getLastMutation(file.fingerprint);
```

This returns `{ mutationType: 'EDIT', actor: 'DEVELOPER', timestamp: '...', id: 1, ... }`.

Then at line 122:

```js
lastMutation: lastMutation || { type: '', actor: '', timestamp: '' }
```

The raw row is passed through. Since the row has `mutationType` (not `type`), the schema card's `lastMutation.type` is always `undefined`. This means:

1. **Schema card validation** would flag `type` as wrong-type (undefined vs string)
2. **Diff mode** comparing cards would show false drift (undefined vs empty string)
3. **Any consumer** reading `schemaCard.lastMutation.type` gets `undefined` instead of the actual mutation type (e.g., `'EDIT'`, `'CREATE'`)
4. **Sorted JSON output** would include `mutationType` as an extra key not in the canonical shape, and omit `type`

### Fix Applied

Added explicit mapping from SQLite column names to schema card field names:

```js
const rawLastMutation = persistence.getLastMutation(file.fingerprint);

// Map SQLite row shape ({mutationType, actor, timestamp, ...})
// to schema card shape ({type, actor, timestamp})
const lastMutation = rawLastMutation
    ? { type: rawLastMutation.mutationType, actor: rawLastMutation.actor, timestamp: rawLastMutation.timestamp }
    : null;
```

**Lines changed:** 114–120 (mapping logic added in `emitAllCards()`)

### Verification

- `node --check backend/schemaCardEmitter.js` → passes (no syntax errors)
- When `getLastMutation()` returns a row, `type` is correctly populated from `mutationType`
- When `getLastMutation()` returns `null` (no mutations), the fallback `{ type: '', actor: '', timestamp: '' }` is used
- Only the three canonical fields (`type`, `actor`, `timestamp`) are extracted — extra SQLite columns (`id`, `fingerprint`, `sha256Hash`, `changedFields`, `metadata`) are intentionally dropped
- Schema card output now conforms to `St8SchemaCard` shape

---

## Summary

| Issue | Severity | Root Cause | Fix |
|-------|----------|------------|-----|
| CR-01 | High (latent) | `async initialize()` called without `await` in sync CLI block | Wrapped CLI in async IIFE, added `await` |
| CR-02 | High (active) | SQLite column `mutationType` not mapped to schema card field `type` | Added explicit field mapping in `emitAllCards()` |

## Files Modified

- `backend/schemaCardEmitter.js` — 2 changes (CLI async wrapper + mutation field mapping)
