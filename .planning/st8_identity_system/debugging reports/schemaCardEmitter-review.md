# Code Review: `backend/schemaCardEmitter.js`

**Reviewed:** 2026-05-13T00:00:00Z  
**Status:** **FAIL** — 2 critical issues, 3 warnings, 2 informational items

---

## Summary

Reviewed `backend/schemaCardEmitter.js` (192 lines) and its dependencies (`st8-types.js`, `persistence.js`, `lib/utils/astParser.js`). The module implements deterministic JSON schema card generation for st8's file registry. Two critical issues were found: a missing `await` on an async initialization call, and a data-shape mismatch between the persistence layer's raw DB rows and the canonical schema card shape. Three warnings address silent error swallowing, stubbed-out functionality, and schema shape leakage.

---

## Critical Issues

### CR-01: `async initialize()` called without `await` in CLI entry point

**File:** `backend/schemaCardEmitter.js:183`
**Severity:** CRITICAL

`St8Persistence.initialize()` is declared `async` (persistence.js:134) but is called without `await`:

```javascript
// Line 182-183
const persistence = new St8Persistence();
persistence.initialize();  // ← returns a Promise, never awaited
```

The function body happens to be synchronous today (better-sqlite3 is sync), so it works by accident. But the `async` contract means: (a) any future `await` added inside `initialize()` will cause the CLI to call `emitAllCards()` before the DB is ready, and (b) if initialization throws, the rejection is unhandled (no `.catch()`), which will crash the process with an `UnhandledPromiseRejection` instead of the clean `process.exit(1)` path.

**Fix:**
```javascript
// Option A: Make the CLI entry point async
(async () => {
    const persistence = new St8Persistence();
    await persistence.initialize();
    const emitter = new SchemaCardEmitter(targetDir);
    const result = emitter.emitAllCards(persistence);
    persistence.close();
    process.exit(result.errors > 0 ? 1 : 0);
})();

// Option B: Remove `async` from initialize() in persistence.js
// if it truly has no async operations (but this changes the persistence API contract)
```

---

### CR-02: `lastMutation` data shape mismatch — DB row mapped directly into schema card

**File:** `backend/schemaCardEmitter.js:114-122`
**Severity:** CRITICAL

`persistence.getLastMutation()` returns a raw SQLite row with columns from the `file_mutation_log` table:

```
{ fingerprint, sha256Hash, mutationType, changedFields, actor, timestamp, metadata }
```

But the `St8SchemaCard.lastMutation` canonical shape (st8-types.js:114-118) expects:

```
{ type: '', actor: '', timestamp: '' }
```

The code passes the raw DB row directly into the card without transformation:

```javascript
// Line 120-123
this.emitCard(file, astResult, connections, intent, {
    count: mutationCount,
    lastMutation: lastMutation || { type: '', actor: '', timestamp: '' }
});
```

**Consequences:**
1. `lastMutation.type` will always be `undefined` — the DB column is `mutationType`, not `type`
2. The card will contain extra fields (`fingerprint`, `sha256Hash`, `changedFields`, `metadata`) not defined in the canonical shape
3. The `diff()` method (line 156-164) iterates `St8SchemaCard` keys, so it will compare `type: undefined` against the previous card, potentially causing false drift detection
4. `validateSt8SchemaCard()` (line 66-69) will report type mismatches if strict mode were ever enabled

**Fix:**
```javascript
// In emitAllCards, transform the DB row to canonical shape:
const rawLastMutation = persistence.getLastMutation(fingerprint);
const lastMutation = rawLastMutation ? {
    type: rawLastMutation.mutationType || '',
    actor: rawLastMutation.actor || '',
    timestamp: rawLastMutation.timestamp || ''
} : { type: '', actor: '', timestamp: '' };

this.emitCard(file, astResult, connections, intent, {
    count: mutationCount,
    lastMutation
});
```

---

## Warnings

### WR-01: Empty catch block silently swallows AST parsing errors

**File:** `backend/schemaCardEmitter.js:107-109`
**Severity:** WARNING

```javascript
try {
    astResult = extractImportsAndExports(fullPath);
} catch (e) {
    // AST parsing failed — use empty result
}
```

AST parsing can fail for many legitimate reasons (syntax errors, unsupported syntax, encoding issues). Silently swallowing the error makes it impossible to diagnose why schema cards have empty `exports`/`imports` fields. This is especially problematic because `hasErrors: true` is never checked either — the `extractImportsAndExports` function returns `{ hasErrors: true, errorMessage }` on certain failures (astParser.js:63), but the code doesn't distinguish between "file doesn't exist" and "file exists but has parse errors."

**Fix:**
```javascript
try {
    astResult = extractImportsAndExports(fullPath);
    if (astResult.hasErrors) {
        console.warn(`[st8:emitter] AST parse errors for ${file.filepath}: ${astResult.errorMessage || 'unknown'}`);
    }
} catch (e) {
    console.warn(`[st8:emitter] AST parsing exception for ${file.filepath}: ${e.message}`);
}
```

---

### WR-02: `connections` is always empty — feature is stubbed out

**File:** `backend/schemaCardEmitter.js:117-118`
**Severity:** WARNING

```javascript
const connections = { importedBy: [], imports: [] };
// TODO: Add connection query when connections table uses camelCase
```

Every schema card emitted by `emitAllCards()` will have `connections: { importedBy: [], imports: [] }` regardless of actual file relationships. This means:
- The `connections` field in schema cards is always meaningless data
- Any downstream consumer relying on `connections` (e.g., impact analysis, dependency visualization) will get incorrect results
- The `diff()` method will never detect connection drift because there's nothing to diff against

**Fix:** Implement the connection query or remove the stub and document that connections are not yet supported. At minimum, the TODO should track an issue number.

---

### WR-03: Intent object leaks extra fields from persistence layer

**File:** `backend/schemaCardEmitter.js:112`
**Severity:** WARNING

`persistence.getAllIntents()` (persistence.js:277-291) returns objects with extra fields `authoredBy` and `lastUpdated` that aren't part of the `St8SchemaCard.intent` canonical shape (`{ purpose, dependsOnBehavior, valueStatement }`):

```javascript
// persistence.js:282-288 — returned shape
{
    purpose: row.purpose || '',
    dependsOnBehavior: row.dependsOnBehavior || '',
    valueStatement: row.valueStatement || '',
    authoredBy: row.authoredBy || 'INFERRED',    // ← extra
    lastUpdated: row.lastUpdated                   // ← extra
}
```

These extra fields get embedded into the schema card (line 59: `intent: intent || ...`), creating a shape mismatch with `St8SchemaCard.intent`. The `diff()` method won't detect drift in these extra fields because it only iterates `St8SchemaCard` keys, but the JSON file on disk will contain them, violating the "canonical shape" contract.

**Fix:**
```javascript
const rawIntent = allIntents[file.fingerprint] || null;
const intent = rawIntent ? {
    purpose: rawIntent.purpose || '',
    dependsOnBehavior: rawIntent.dependsOnBehavior || '',
    valueStatement: rawIntent.valueStatement || ''
} : { purpose: '', dependsOnBehavior: '', valueStatement: '' };
```

---

## Informational

### IN-01: Dynamic require of `astParser.js` inside method body

**File:** `backend/schemaCardEmitter.js:92`
**Severity:** INFO

```javascript
const { extractImportsAndExports } = require(path.join(__dirname, '..', 'lib', 'utils', 'astParser.js'));
```

Node caches `require()` calls, so there's no performance penalty, but this is a code smell. The require should be at the module top-level for clarity and to fail fast if the module is missing. The dynamic path construction with `path.join(__dirname, '..', 'lib', ...)` is fragile — if the file is moved, this breaks silently.

**Fix:** Move to top of file alongside other requires, or use a static relative path if the directory structure is stable.

---

### IN-02: `_cardFilename` doesn't sanitize special filesystem characters

**File:** `backend/schemaCardEmitter.js:139-141`
**Severity:** INFO

```javascript
_cardFilename(filepath) {
    return filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json';
}
```

Only path separators are replaced. Filenames with characters like `:`, `*`, `?`, `"`, `<`, `>`, `|`, or leading/trailing spaces could cause issues on some filesystems (especially Windows). Not a security issue since the output is constrained to `outputDir`, but could cause silent failures or data loss on non-POSIX systems.

**Fix:** Consider a more robust sanitization or URL-encoding approach:
```javascript
_cardFilename(filepath) {
    return encodeURIComponent(filepath.replace(/\\/g, '/')) + '.json';
}
```

---

## Verification Notes

- **Imports verified:** `validateSt8SchemaCard` and `St8SchemaCard` are correctly exported from `st8-types.js` (lines 234, 238). `St8Persistence` is correctly exported from `persistence.js` (line 492). `extractImportsAndExports` is correctly exported from `astParser.js` (line 39).
- **No syntax errors** detected in the file.
- **No security vulnerabilities** (no eval, no injection vectors, no hardcoded secrets).
- **`_cardFilename` path traversal is safe** — slashes are replaced with underscores, so filenames stay within `outputDir`.
