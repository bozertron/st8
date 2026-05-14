# Code Review: `backend/schemaCardPrinter.js`

**Reviewed:** 2026-05-13T15:00:00Z
**File:** `backend/schemaCardPrinter.js` (196 lines)
**Status:** **PASS with issues**

---

## Summary

The `SchemaCardPrinter` class implements a human-readable `.txt` fallback output for ST8 schema cards. The module is syntactically valid, correctly imports Node.js built-ins, and both required methods (`printCard`, `printAllFromCards`) function as designed. The export is correct.

However, the review identified **5 warnings** related to defensive coding: missing input validation, incomplete filename sanitization, unguarded property access, and lack of I/O error handling within `printCard`. None are blockers given current call sites (both `printAllFromCards` and `notificationBus.js` wrap calls in try/catch), but the code is fragile against future callers or malformed input.

---

## Issues Found

### WR-01: No input validation on `card` parameter (line 44-46)

**Severity:** WARNING
**File:** `backend/schemaCardPrinter.js:44-46`

**Issue:** `printCard(card)` accesses `card.filepath` without checking that `card` is a valid object with expected fields. If `card` is `null`, `undefined`, or an object missing `filepath`, line 46 throws an unhelpful `TypeError: Cannot read properties of undefined (reading 'replace')`.

This is specifically triggered when `printAllFromCards` reads a `.json` file from the schema cards directory that is valid JSON but not a schema card (e.g., an empty object `{}` or a different schema). The `catch` block in `printAllFromCards` handles this, but the error message is cryptic.

**Fix:**
```javascript
printCard(card) {
    if (!card || typeof card.filepath !== 'string') {
        throw new Error('[st8:printer] Invalid card: missing or invalid filepath');
    }
    // ... rest of method
}
```

---

### WR-02: Unguarded `exp.kind.padEnd(12)` access (line 91)

**Severity:** WARNING
**File:** `backend/schemaCardPrinter.js:91`

**Issue:** `exp.kind.padEnd(12)` will throw `TypeError: Cannot read properties of undefined (reading 'padEnd')` if an export object in `card.exports` lacks a `kind` field. The code guards for `card.exports` existence on line 87 (`if (card.exports && card.exports.length > 0)`) but does not guard individual export object fields.

The `SchemaCardEmitter` constructs exports from AST parsing results, which should include `kind`, but the printer has no contract enforcement and could receive exports from other sources (e.g., a manually edited `.json` file).

**Fix:**
```javascript
const sig = exp.signature ? ` — ${exp.signature}` : '';
const ret = exp.returnType ? `: ${exp.returnType}` : '';
lines.push(`  ${(exp.kind || 'unknown').padEnd(12)} ${exp.name || '(unnamed)'}${sig}${ret}`);
```

---

### WR-03: Incomplete filename sanitization (line 46)

**Severity:** WARNING
**File:** `backend/schemaCardPrinter.js:46`

**Issue:** The filename sanitization only replaces `/` and `\` with `_`:
```javascript
const safeName = card.filepath.replace(/\//g, '_').replace(/\\/g, '_');
```

This does not sanitize characters that are problematic across operating systems:
- `:` — invalid on Windows, common in paths
- `<`, `>`, `"`, `|`, `?`, `*` — invalid on Windows
- Null bytes — invalid everywhere
- Extremely long filenames (no length check)

While the input paths come from the project indexer (which uses standard filesystem paths), the printer is a public API that could receive any card object. A path like `backend/aux:config.js` would produce `backend_aux:config.js.txt`, which is valid on Linux but invalid on Windows.

**Fix:**
```javascript
const safeName = card.filepath
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\x00/g, '')  // remove null bytes
    .substring(0, 200);    // prevent excessively long filenames
```

---

### WR-04: No `writeFileSync` error handling in `printCard` (lines 158, 162)

**Severity:** WARNING
**File:** `backend/schemaCardPrinter.js:158-162`

**Issue:** `printCard` performs two synchronous file writes without any error handling:
```javascript
fs.writeFileSync(outputPath, lines.join('\n'));  // line 158
// ...
fs.writeFileSync(latestPath, lines.join('\n'));   // line 162
```

If the first write succeeds but the second fails (e.g., disk full, permissions error), the output is left in an inconsistent state: a timestamped file exists but the `LATEST_` file is stale or missing.

While all current callers (`printAllFromCards` line 181-188, `notificationBus.js` lines 56-60) wrap calls in try/catch, the method itself does not handle I/O errors. A future direct caller without a try/catch would cause an unhandled exception crash.

**Fix:** Either wrap the writes in try/catch within `printCard`, or document that callers MUST wrap in try/catch. A defensive approach:
```javascript
try {
    fs.writeFileSync(outputPath, lines.join('\n'));
    fs.writeFileSync(latestPath, lines.join('\n'));
} catch (err) {
    throw new Error(`[st8:printer] Failed to write card for ${card.filepath}: ${err.message}`);
}
```

---

### WR-05: `specifiers` element access assumes object or string (line 104)

**Severity:** WARNING
**File:** `backend/schemaCardPrinter.js:104`

**Issue:** The specifier mapping uses `s.name || s`:
```javascript
imp.specifiers.map(s => s.name || s).join(', ')
```

This handles two shapes: `{name: 'foo'}` (object) and `'foo'` (string). However:
- If `s` is `null` or `undefined`, `s.name` throws `TypeError`
- If `s` is `0` or `false` or another falsy non-string, it renders as empty string
- If `s` is an object without `name` (e.g., `{local: 'foo'}`), it renders as `[object Object]`

The `SchemaCardEmitter` uses AST parser output for specifiers, which should produce consistent shapes, but the printer doesn't enforce this.

**Fix:**
```javascript
const names = imp.specifiers && imp.specifiers.length > 0
    ? ` {${imp.specifiers.map(s => {
        if (s && typeof s === 'object') return s.name || s.local || '?';
        if (typeof s === 'string') return s;
        return String(s);
    }).join(', ')}}`
    : '';
```

---

## Info

### IN-01: No CLI entry point (unlike peer modules)

**Severity:** INFO
**File:** `backend/schemaCardPrinter.js` (entire file)

**Issue:** Unlike `schemaCardEmitter.js` (lines 172-190) and `st8-types.js` (lines 200-224), `schemaCardPrinter.js` has no `if (require.main === module)` CLI block. This prevents running the printer standalone for testing or manual card generation:
```bash
node backend/schemaCardPrinter.js --dir .st8/schema-cards
```

**Fix:** Add a CLI block consistent with other backend modules:
```javascript
if (require.main === module) {
    const args = process.argv.slice(2);
    const targetDir = args[0] || process.cwd();
    const cardsDir = args[1] || path.join(targetDir, '.st8', 'schema-cards');
    const printer = new SchemaCardPrinter(targetDir);
    const result = printer.printAllFromCards(cardsDir);
    process.exit(result.errors > 0 ? 1 : 0);
}
```

---

### IN-02: No JSDoc `@returns` on `printCard`

**Severity:** INFO
**File:** `backend/schemaCardPrinter.js:43-44`

**Issue:** `printCard` returns `{ path: outputPath, latestPath }` (line 164), but the JSDoc only documents the `@param` and omits `@returns`. Callers that use the return value (e.g., for logging or verification) lack type documentation.

**Fix:**
```javascript
/**
 * Print a schema card as a human-readable .txt file.
 * @param {object} card - St8SchemaCard object
 * @returns {{ path: string, latestPath: string }} Paths of written files
 */
```

---

## Not Flagged (Reviewed and Passed)

- **Syntax:** `node -c` passes — no parse errors
- **Imports:** `path` and `fs` are correct Node.js built-ins
- **Export:** `module.exports = { SchemaCardPrinter }` is correct and matches all call sites
- **Constructor:** `_ensureOutputDir()` with `recursive: true` is correct
- **`printAllFromCards`:** Properly checks directory existence, filters `.json` files, wraps each iteration in try/catch, logs summary — all correct
- **Box-drawing characters:** Unicode `═┌└─┐┘` display correctly in modern UTF-8 environments
- **Null coalescing patterns:** `card.mutationCount || 0` and `card.intent.purpose || '(not set)'` are appropriate fallbacks
- **Connection section logic:** Lines 116-129 correctly handle all combinations of empty/non-empty `importedBy` and `imports` arrays

---

## Verdict

**PASS with 5 warnings and 2 info items.**

The code is functionally correct for its current usage patterns. All existing callers provide adequate error handling. The warnings are defensive-coding improvements that protect against future misuse or malformed input — none represent active bugs in the running system.

---

_Reviewed: 2026-05-13T15:00:00Z_
_Reviewer: GSD Code Reviewer_
_Depth: standard_
