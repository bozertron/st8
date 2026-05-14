# Detailed Line-by-Line Report: `backend/schemaCardEmitter.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/schemaCardEmitter.js`
**Total Lines:** 209
**Report Generated:** 2026-05-13

---

## Lines 1-9: Shebang, Docblock & Module Purpose

```
#!/usr/bin/env node

/**
 * ST8 Schema Card Emitter
 *
 * Generates deterministic .st8/schema-card.json for each file.
 * Called after every index run and on every file change.
 * Schema cards are machine-readable, always in sync, and diffable in git.
 */
```

- **What triggers it:** CLI invocation (`node schemaCardEmitter.js [dir]`) or programmatic `require()`
- **What it calls:** Nothing
- **What calls it:** `backend/index.js:20` (`require('./schemaCardEmitter')`), `backend/server.js:853` (lazy require inside MVP lock handler)
- **Dependencies:** None in this section
- **Status:** WORKING
- **Gap:** Docblock says `.st8/schema-card.json` (singular) but actual output is `.st8/schema-cards/*.json` (plural, per-file). Minor doc inconsistency.

---

## Lines 11: Strict Mode

```
'use strict';
```

- **What triggers it:** Module load
- **What it calls:** Nothing
- **What calls it:** Node.js module loader
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

## Lines 13-15: Imports (require statements)

```
const path = require('path');
const fs = require('fs');
const { validateSt8SchemaCard, St8SchemaCard } = require('./st8-types');
```

- **What triggers it:** Module load time
- **What it calls:** `path` (Node built-in), `fs` (Node built-in), `backend/st8-types.js:169` (`validateSt8SchemaCard`), `backend/st8-types.js:80` (`St8SchemaCard` constant)
- **What calls it:** Node.js module loader
- **Dependencies:**
  - `backend/st8-types.js` — exports `validateSt8SchemaCard` (line 169), `St8SchemaCard` (line 80, frozen object used as canonical shape template)
- **Status:** WORKING
- **Gap:** None. Both imported symbols are used: `validateSt8SchemaCard` on line 66, `St8SchemaCard` on line 171.

---

## Lines 17-23: `SchemaCardEmitter` Constructor

```
class SchemaCardEmitter {
    constructor(targetDir, options = {}) {
        this.targetDir = targetDir;
        this.outputDir = options.outputDir || path.join(targetDir, '.st8', 'schema-cards');
        this.strict = options.strict || false;
        this._ensureOutputDir();
    }
```

- **What triggers it:** `new SchemaCardEmitter(targetDir, options)` — called from:
  - `backend/index.js:87` — `new SchemaCardEmitter(targetDir)` (no options)
  - `backend/index.js:308` — file watcher `add` handler (via `emitter.emitCard()`, reuses existing emitter)
  - `backend/index.js:361` — file watcher `change` handler (via `emitter.emitCard()`, reuses existing emitter)
  - `backend/server.js:894` — MVP lock endpoint `new SchemaCardEmitter(this.targetDir)`
  - `backend/schemaCardEmitter.js:201` — CLI entry point `new SchemaCardEmitter(targetDir)`
- **What it calls:** `_ensureOutputDir()` (line 22)
- **What calls it:** `backend/index.js:87`, `backend/server.js:894`, CLI at line 201
- **Dependencies:** `path`, `_ensureOutputDir`
- **Status:** WORKING (with a bug — see gap)
- **Gap (WARNING — WR-01):** `this.strict` is stored on line 21 but **never read anywhere in the class**. The `strict` option is intended to control validation behavior, but `validateSt8SchemaCard(card)` on line 66 calls `validateAgainstShape(obj, St8SchemaCard)` without passing `strict` (defaults to `false` per `st8-types.js:140`). This means `strict` mode does nothing — even if you pass `{ strict: true }`, validation still doesn't check for extra keys. The constructor stores a dead property.

---

## Lines 25-29: `_ensureOutputDir()`

```
    _ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
```

- **What triggers it:** Constructor call (line 22)
- **What it calls:** `fs.existsSync`, `fs.mkdirSync`
- **What calls it:** Constructor only
- **Dependencies:** `fs`
- **Status:** WORKING
- **Gap:** None. The `{ recursive: true }` flag correctly handles nested directories.

---

## Lines 31-85: `emitCard(file, astResult, connections, intent, mutationSummary)`

### Lines 31-38: JSDoc Comment

```
    /**
     * Emit a schema card for a single file.
     * @param {object} file - St8FileEntry with all fields populated
     * @param {object} astResult - Output from astParser.extractImportsAndExports()
     * @param {object} connections - { importedBy: [], imports: [] }
     * @param {object} intent - { purpose, dependsOnBehavior, valueStatement }
     * @param {object} mutationSummary - { count, lastMutation }
     */
```

- **What triggers it:** Part of `emitCard` method
- **Status:** WORKING
- **Gap:** None (documentation only)

### Lines 39-63: Card Object Construction

```
    emitCard(file, astResult, connections, intent, mutationSummary) {
        const card = {
            fingerprint: file.fingerprint,
            filepath: file.filepath,
            filename: file.filename,
            sha256Hash: file.sha256Hash,
            fileSizeBytes: file.fileSizeBytes,
            status: file.status,
            reachabilityScore: file.reachabilityScore,
            impactRadius: file.impactRadius,
            lifecyclePhase: file.lifecyclePhase || 'DEVELOPMENT',
            birthTimestamp: file.birthTimestamp,
            lastModified: file.lastModified,
            lastIndexed: file.lastIndexed,
            isEntryPoint: Boolean(file.isEntryPoint),

            exports: (astResult && astResult.exports) || [],
            imports: (astResult && astResult.imports) || [],

            connections: connections || { importedBy: [], imports: [] },
            intent: intent || { purpose: '', dependsOnBehavior: '', valueStatement: '' },

            mutationCount: (mutationSummary && mutationSummary.count) || 0,
            lastMutation: (mutationSummary && mutationSummary.lastMutation) || { type: '', actor: '', timestamp: '' }
        };
```

- **What triggers it:** Called from `emitAllCards()` (line 135), `backend/index.js:308` (file watcher add), `backend/index.js:361` (file watcher change), and potentially `backend/server.js:895` (via `emitAllCards`)
- **What it calls:** Reads properties from `file`, `astResult`, `connections`, `intent`, `mutationSummary` params
- **What calls it:** `emitAllCards` (line 135), `backend/index.js:308,361`
- **Dependencies:** All 5 parameters must be shaped correctly
- **Status:** WORKING (with issues — see gaps)
- **Gap (WARNING — WR-02):** When `intent` is `null` (as passed from `backend/index.js:309` and `backend/index.js:362`), the fallback `intent || { purpose: '', ... }` correctly provides defaults. However, this means **file watcher-triggered cards always have empty intent data** — the intent from the DB is never fetched during incremental updates. Only `emitAllCards()` (line 113-118) fetches intent from persistence. This is a **data loss inconsistency**: incremental card updates silently discard intent.
- **Gap (WARNING — WR-03):** When `connections` is `{ importedBy: [], imports: [] }` (as passed from `backend/index.js:309` and `backend/index.js:362`), the card always has empty connections during incremental updates. Only `emitAllCards()` (lines 129-133) computes actual connections from the persistence layer. This means **file watcher-triggered cards always have empty connections** until the next full `emitAllCards()` run. Cards written by the file watcher are stale regarding connections.
- **Gap (WARNING — WR-04):** `file.lastIndexed` (line 52) is passed through directly. In the persistence layer (`persistence.js:206`), `lastIndexed` is set to `CURRENT_TIMESTAMP` format (`YYYY-MM-DD HH:MM:SS`) which differs from the ISO 8601 format used by `birthTimestamp` and `lastModified`. This creates inconsistent timestamp formats within the same card (observable in the actual output: `lastIndexed: "2026-05-13 20:11:56"` vs `birthTimestamp: "2026-05-13T14:15:44.081Z"`).

### Lines 65-69: Validation

```
        // Validate against canonical shape
        const validation = validateSt8SchemaCard(card);
        if (!validation.valid) {
            console.warn(`[st8:emitter] Schema card validation warning for ${file.filepath}:`, validation.missing);
        }
```

- **What triggers it:** Every `emitCard` call
- **What it calls:** `validateSt8SchemaCard` (from `st8-types.js:169`), which calls `validateAgainstShape(obj, St8SchemaCard)` with `strict=false`
- **What calls it:** Part of `emitCard` method
- **Dependencies:** `st8-types.js` → `validateAgainstShape` (line 140)
- **Status:** PARTIAL
- **Gap (WARNING — WR-05):** Validation is **advisory only** — it logs a warning but always continues to write the card (line 82). Even with `this.strict = true`, the validation never blocks emission because: (a) `this.strict` is never passed to the validator, and (b) even if it were, the result is only logged, not acted upon. The `strict` mode concept is a no-op. If a card is malformed, it gets written to disk regardless.
- **Gap (WARNING — WR-06):** `validateAgainstShape` (st8-types.js:147) uses `typeof` comparison which treats all objects the same: `typeof [] === 'object'` and `typeof {} === 'object'`. So the validator cannot detect when `connections` is an array instead of an object, or when `exports` is an object instead of an array. It only checks that the key exists and is the right JavaScript primitive type.

### Lines 71-82: Deterministic JSON Write

```
        // Write deterministic JSON (sorted keys at every level for consistent diffs)
        const outputPath = path.join(this.outputDir, this._cardFilename(file.filepath));
        const sortedReplacer = (key, value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return Object.keys(value).sort().reduce((sorted, k) => {
                    sorted[k] = value[k];
                    return sorted;
                }, {});
            }
            return value;
        };
        fs.writeFileSync(outputPath, JSON.stringify(card, sortedReplacer, 2));
```

- **What triggers it:** Every `emitCard` call after card construction and validation
- **What it calls:** `_cardFilename()` (line 72), `fs.writeFileSync` (line 82), `JSON.stringify` with custom replacer (line 82)
- **What calls it:** Part of `emitCard` method
- **Dependencies:** `_cardFilename`, `fs`
- **Status:** WORKING
- **Gap (WARNING — WR-07):** The `sortedReplacer` creates a **new object** for every non-array object in the tree during serialization. This means nested objects like `connections`, `intent`, and `lastMutation` get reconstructed. While functionally correct, it's worth noting that the replacer does NOT sort array elements — arrays like `exports`, `imports`, `connections.importedBy` are written in their original order. This is correct behavior (array order is semantically meaningful), but if array elements are objects (like `exports` entries), their internal keys ARE sorted.
- **Gap (INFO — IN-01):** `fs.writeFileSync` is synchronous and blocks the event loop. For the CLI/batch case (`emitAllCards`), this could be slow with hundreds of files. However, performance is out of scope for this review.

### Lines 84-85: Return Value

```
        return card;
```

- **What triggers it:** End of `emitCard`
- **What it calls:** Nothing
- **What calls it:** Return value used by `backend/index.js:361` (`const card = emitter.emitCard(...)`) — though the returned card is never subsequently used in the watcher handler
- **Dependencies:** None
- **Status:** WORKING
- **Gap (INFO — IN-02):** In `backend/index.js:361`, the returned card is assigned to `const card` but never used. In `backend/index.js:308`, the return value is discarded entirely. The return is only useful for programmatic consumers.

---

## Lines 87-148: `emitAllCards(persistence)`

### Lines 87-90: JSDoc

```
    /**
     * Emit schema cards for all files.
     * @param {object} persistence - St8Persistence instance (must be initialized)
     */
```

- **Status:** WORKING
- **Gap:** None

### Lines 91-92: Lazy-loaded AST Parser

```
    emitAllCards(persistence) {
        const { extractImportsAndExports } = require(path.join(__dirname, '..', 'lib', 'utils', 'astParser.js'));
```

- **What triggers it:** `emitAllCards` call
- **What it calls:** `require()` → `lib/utils/astParser.js:147` (`extractImportsAndExports`)
- **What calls it:** `backend/index.js:160`, `backend/server.js:895`
- **Dependencies:** `lib/utils/astParser.js` — a compiled TypeScript file that uses `@babel/parser` for AST extraction
- **Status:** WORKING
- **Gap (INFO — IN-03):** The `require()` is inside the method body rather than at module top-level. Node.js caches modules, so subsequent calls are fast cache lookups. However, if `astParser.js` or its dependency `@babel/parser` is missing, the error occurs at call time rather than import time, making startup errors harder to diagnose.

### Lines 93-97: Data Fetching

```
        const files = persistence.getAllFiles();
        const allIntents = persistence.getAllIntents();
        let emitted = 0;
        let errors = 0;
```

- **What triggers it:** `emitAllCards` call
- **What it calls:** `persistence.getAllFiles()` (persistence.js:229), `persistence.getAllIntents()` (persistence.js:325)
- **What calls it:** Part of `emitAllCards`
- **Dependencies:** `backend/persistence.js` — `St8Persistence` class
- **Status:** WORKING
- **Gap:** None. Both methods return arrays/objects that are iterated below.

### Lines 99-110: Per-File Loop — AST Extraction

```
        for (const file of files) {
            try {
                const fullPath = path.join(this.targetDir, file.filepath);
                let astResult = { imports: [], exports: [] };

                if (fs.existsSync(fullPath)) {
                    try {
                        astResult = extractImportsAndExports(fullPath);
                    } catch (e) {
                        // AST parsing failed — use empty result
                    }
                }
```

- **What triggers it:** Each file in the registry
- **What it calls:** `fs.existsSync` (line 104), `extractImportsAndExports` (line 106)
- **What calls it:** Part of `emitAllCards` loop
- **Dependencies:** `fs`, `lib/utils/astParser.js`
- **Status:** WORKING
- **Gap (WARNING — WR-08):** When AST parsing fails (line 107), the error is silently swallowed. No warning is logged. If `@babel/parser` encounters a syntax error in a file, the card silently gets empty `imports` and `exports`. The outer catch (line 140) only catches errors from `emitCard`, not from AST parsing. This makes it impossible to distinguish "file has no imports/exports" from "AST parsing failed."
- **Gap (INFO — IN-04):** When a file doesn't exist on disk (line 104 `!fs.existsSync(fullPath)`), AST parsing is skipped and the card gets empty imports/exports. This is correct for CONCEPT files that haven't been created yet.

### Lines 112-118: Intent Extraction

```
                // Pick only canonical intent fields (exclude authoredBy, lastUpdated from DB)
                const rawIntent = allIntents[file.fingerprint] || null;
                const intent = rawIntent ? {
                    purpose: rawIntent.purpose || '',
                    dependsOnBehavior: rawIntent.dependsOnBehavior || '',
                    valueStatement: rawIntent.valueStatement || ''
                } : null;
```

- **What triggers it:** Each file in the loop
- **What it calls:** Reads from `allIntents` object (pre-fetched on line 95)
- **What calls it:** Part of `emitAllCards` loop
- **Dependencies:** `allIntents` from `persistence.getAllIntents()`
- **Status:** WORKING
- **Gap:** None. The filtering correctly strips `authoredBy` and `lastUpdated` DB fields from the intent before passing to `emitCard`.

### Lines 119-126: Mutation Data Fetching

```
                const mutationCount = persistence.getMutationCount(file.fingerprint);
                const rawLastMutation = persistence.getLastMutation(file.fingerprint);

                // Map SQLite row shape ({mutationType, actor, timestamp, ...})
                // to schema card shape ({type, actor, timestamp})
                const lastMutation = rawLastMutation
                    ? { type: rawLastMutation.mutationType, actor: rawLastMutation.actor, timestamp: rawLastMutation.timestamp }
                    : null;
```

- **What triggers it:** Each file in the loop
- **What it calls:** `persistence.getMutationCount()` (persistence.js:366), `persistence.getLastMutation()` (persistence.js:374)
- **What calls it:** Part of `emitAllCards` loop
- **Dependencies:** `backend/persistence.js`
- **Status:** WORKING
- **Gap (INFO — IN-05):** Two separate SQLite queries per file inside the loop (N+1 pattern). For 100 files, this is 200 queries. `getMutationCount` runs `SELECT COUNT(*)` and `getLastMutation` runs `SELECT * ... ORDER BY timestamp DESC LIMIT 1`. These could be batched. Performance is out of scope but worth noting.

### Lines 128-133: Connection Building

```
                // Build connections via persistence API (not direct db access)
                const allConnections = persistence.getConnectionsForFile(file.fingerprint);
                const connections = {
                    importedBy: allConnections.filter(c => c.targetFingerprint === file.fingerprint).map(c => c.sourceFingerprint),
                    imports: allConnections.filter(c => c.sourceFingerprint === file.fingerprint).map(c => c.targetFingerprint)
                };
```

- **What triggers it:** Each file in the loop
- **What it calls:** `persistence.getConnectionsForFile()` (persistence.js:298)
- **What calls it:** Part of `emitAllCards` loop
- **Dependencies:** `backend/persistence.js`
- **Status:** WORKING
- **Gap:** The connection mapping logic is **correct**:
  - `importedBy`: Files where THIS file is the `target` (other files import THIS file) → take `sourceFingerprint`
  - `imports`: Files where THIS file is the `source` (THIS file imports other files) → take `targetFingerprint`
- **Gap (INFO — IN-06):** `persistence.getConnectionsForFile()` (persistence.js:298-301) does a single query with `WHERE sourceFingerprint = ? OR targetFingerprint = ?`, fetching all connections for the file. This is correct but could be slow for files with many connections (full table scan on the OR clause if indexes don't cover both columns efficiently).

### Lines 135-139: Card Emission Call

```
                this.emitCard(file, astResult, connections, intent, {
                    count: mutationCount,
                    lastMutation: lastMutation || { type: '', actor: '', timestamp: '' }
                });
                emitted++;
```

- **What triggers it:** Each file in the loop after data assembly
- **What it calls:** `emitCard()` (line 39)
- **What calls it:** Part of `emitAllCards` loop
- **Dependencies:** `emitCard` method
- **Status:** WORKING
- **Gap:** None. The `mutationSummary` parameter is correctly shaped as `{ count, lastMutation }` matching what `emitCard` expects.

### Lines 140-144: Error Handling

```
            } catch (err) {
                console.error(`[st8:emitter] Error emitting card for ${file.filepath}:`, err.message);
                errors++;
            }
```

- **What triggers it:** Any error during the per-file loop
- **What it calls:** `console.error`
- **What calls it:** Error boundary for the per-file try/catch
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Errors are counted and logged; the loop continues to the next file.

### Lines 146-148: Summary and Return

```
        console.log(`[st8:emitter] Emitted ${emitted} schema cards, ${errors} errors`);
        return { emitted, errors };
```

- **What triggers it:** End of `emitAllCards` loop
- **What it calls:** `console.log`
- **What calls it:** Return value used by `backend/index.js:160` (discarded) and `backend/server.js:895` (discarded)
- **Dependencies:** None
- **Status:** WORKING
- **Gap (INFO — IN-07):** Return value `{ emitted, errors }` is never checked by callers. Both `backend/index.js:160` and `backend/server.js:895` discard it. The CLI (line 202) is the only consumer that uses the return value (`result.errors > 0 ? 1 : 0`).

---

## Lines 150-156: `_cardFilename(filepath)`

```
    /**
     * Convert filepath to safe filename for schema card.
     * e.g., "backend/server.js" → "backend_server.js.json"
     */
    _cardFilename(filepath) {
        return filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json';
    }
```

- **What triggers it:** `emitCard` (line 72), `diff` (line 163)
- **What it calls:** String `replace` operations
- **What calls it:** `emitCard` (line 72), `diff` (line 163), `backend/index.js:238` (inline duplicate of this logic)
- **Dependencies:** None
- **Status:** WORKING (with edge case issue)
- **Gap (WARNING — WR-09):** **Filename collision risk.** Two different filepaths could map to the same card filename. For example:
  - `a/b_c.js` → `a_b_c.js.json`
  - `a_b/c.js` → `a_b_c.js.json`
  
  Both produce the same output filename. The second card emitted would silently overwrite the first. In practice this is unlikely with typical project structures but represents a silent data loss bug.
- **Gap (INFO — IN-08):** This logic is **duplicated** in `backend/index.js:238`:
  ```javascript
  const cardPath = path.join(targetDir, '.st8', 'schema-cards', removed.filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json');
  ```
  This inline copy bypasses the `_cardFilename()` method, creating a maintenance risk if the naming logic ever changes.

---

## Lines 158-182: `diff(file, currentCard)`

```
    /**
     * Diff mode: compare current file state against last emitted schema card.
     * Returns { drift: boolean, differences: [...] }
     */
    diff(file, currentCard) {
        const outputPath = path.join(this.outputDir, this._cardFilename(file.filepath));
        if (!fs.existsSync(outputPath)) {
            return { drift: true, differences: ['No previous schema card found'] };
        }

        const previousCard = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
        const differences = [];

        for (const key of Object.keys(St8SchemaCard)) {
            if (JSON.stringify(previousCard[key]) !== JSON.stringify(currentCard[key])) {
                differences.push({
                    field: key,
                    previous: previousCard[key],
                    current: currentCard[key]
                });
            }
        }

        return { drift: differences.length > 0, differences };
    }
```

- **What triggers it:** Programmatic call to `emitter.diff(file, card)`
- **What it calls:** `_cardFilename` (line 163), `fs.existsSync` (line 164), `fs.readFileSync` (line 168), `JSON.parse` (line 168), `Object.keys(St8SchemaCard)` (line 171), `JSON.stringify` (line 172)
- **What calls it:** **NOTHING.** This method is never called from any production code. It is dead code in the current codebase. (Grep confirmed: no `.diff(` calls in `backend/`.)
- **Dependencies:** `St8SchemaCard` (from st8-types.js), `fs`, `_cardFilename`
- **Status:** NOT CONNECTED
- **Gap (WARNING — WR-10):** **Dead code.** `diff()` is never called from any production code path. It exists as an API surface but has no consumers. All references to `SchemaCardEmitter.diff()` in the codebase are in planning/spec documents (e.g., `D8-Change-Proposal-Workflow.md`, `D5-Lifecycle-Integration.md`), not in implementation files.
- **Gap (WARNING — WR-11):** `JSON.parse(fs.readFileSync(outputPath, 'utf-8'))` on line 168 has **no error handling**. If the schema card JSON file is corrupted (e.g., truncated write, invalid JSON), `JSON.parse` throws a `SyntaxError` that propagates uncaught to the caller. Unlike `emitAllCards` (which has a try/catch), `diff()` has no error boundary.
- **Gap (WARNING — WR-12):** The diff comparison iterates `Object.keys(St8SchemaCard)` which are the keys of the frozen template object. This only covers **top-level keys**. However, since the comparison uses `JSON.stringify(previousCard[key]) !== JSON.stringify(currentCard[key])` on line 172, nested objects like `connections` and `intent` are correctly deep-compared via their serialized form. This is functionally correct but could produce false positives if JSON key ordering differs between the previous card (read from disk) and the current card (constructed in memory). The `sortedReplacer` in `emitCard` should ensure consistent ordering, but `diff()` reads the previous card with a plain `JSON.parse` — the previous card was written with sorted keys, so its in-memory representation should also have sorted keys. This is correct.

---

## Lines 185-207: CLI Entry Point

```
// ─── CLI ─────────────────────────────────────────────────────

if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);

        if (args.includes('--diff')) {
            console.log('[st8:emitter] Diff mode not yet available from CLI — use programmatically');
            process.exit(0);
        }

        const targetDir = args[0] || process.cwd();
        const { St8Persistence } = require('./persistence');
        const persistence = new St8Persistence();
        await persistence.initialize();

        const emitter = new SchemaCardEmitter(targetDir);
        const result = emitter.emitAllCards(persistence);
        persistence.close();

        process.exit(result.errors > 0 ? 1 : 0);
    })();
}
```

### Lines 187-194: `--diff` Flag Handling

- **What triggers it:** CLI with `--diff` argument
- **What it calls:** `console.log`, `process.exit`
- **What calls it:** CLI user
- **Dependencies:** None
- **Status:** PARTIAL
- **Gap (INFO — IN-09):** The `--diff` flag is detected but not implemented. It prints a message and exits. This is a stub/placeholder.

### Lines 196-206: Full Card Emission

- **What triggers it:** CLI without `--diff` flag
- **What it calls:** `St8Persistence` constructor (persistence.js:167), `persistence.initialize()` (persistence.js:172), `SchemaCardEmitter` constructor (line 18), `emitter.emitAllCards()` (line 91), `persistence.close()` (persistence.js:685)
- **What calls it:** CLI user running `node schemaCardEmitter.js [dir]`
- **Dependencies:** `backend/persistence.js`, `backend/schemaCardEmitter.js` (self)
- **Status:** WORKING (with a bug)
- **Gap (BLOCKER — CR-01):** **Database path mismatch.** On line 198, `new St8Persistence()` is called without a `dbPath` argument. Per `persistence.js:168`, this defaults to `path.join(process.cwd(), 'st8.sqlite')`. However, `targetDir` (line 196) could be a different directory (e.g., `node schemaCardEmitter.js /some/other/project`). This means the DB is read from CWD but cards are written to `targetDir/.st8/schema-cards/`. The DB may contain data for a completely different project than the target directory, resulting in incorrect cards being written. The fix should be:
  ```javascript
  const persistence = new St8Persistence(path.join(targetDir, 'st8.sqlite'));
  ```

---

## Line 209: Module Export

```
module.exports = { SchemaCardEmitter };
```

- **What triggers it:** `require('./schemaCardEmitter')` from other modules
- **What it calls:** Nothing
- **What calls it:** `backend/index.js:20`, `backend/server.js:853`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

# CONNECTION MAP

## What Triggers Card Emission?

| Trigger | Method Called | Location | Data Quality |
|---------|-------------|----------|-------------|
| Initial index run | `emitter.emitAllCards(persistence)` | `backend/index.js:160` | **Full** — all data from DB |
| File added (watcher) | `emitter.emitCard(file, astResult, {empty}, null, mutationSummary)` | `backend/index.js:308` | **Partial** — empty connections, empty intent |
| File changed (watcher) | `emitter.emitCard(file, astResult, {empty}, null, mutationSummary)` | `backend/index.js:361` | **Partial** — empty connections, empty intent |
| MVP lock endpoint | `emitter.emitAllCards(persistence)` | `backend/server.js:895` | **Full** — all data from DB |
| CLI | `emitter.emitAllCards(persistence)` | `schemaCardEmitter.js:202` | **Full** — but DB path may be wrong |

## What Other Files Get Called?

| File | Called From | Method |
|------|-----------|--------|
| `backend/st8-types.js` | Import (line 15) | `validateSt8SchemaCard`, `St8SchemaCard` |
| `lib/utils/astParser.js` | Lazy require (line 92) | `extractImportsAndExports` |
| `backend/persistence.js` | Via param (line 91) | `getAllFiles`, `getAllIntents`, `getMutationCount`, `getLastMutation`, `getConnectionsForFile` |

## Where Do Cards Get Written?

| Location | Format |
|----------|--------|
| `{targetDir}/.st8/schema-cards/{sanitized_filename}.json` | Deterministic JSON with sorted keys |

---

# @@@ HANDLING

**`@@@` symbols are NOT handled in `schemaCardEmitter.js`.** No references to `@@@`, `tripleAt`, or `needsAIReview` exist in this file.

The `@@@` detection and storage happens in:
- `backend/intentSeeder.js:187-188` — `TRIPLE_AT_PATTERN` regex detection
- `backend/persistence.js:577-598` — `flagForAIReview()`, `markAIReviewed()`, `getFilesNeedingAIReview()` methods
- `backend/persistence.js:67-72` — DB schema fields `needsAIReview`, `tripleAtCount`, `aiContentInjected`

The `St8SchemaCard` shape (`st8-types.js:80-120`) does **not** include `@@@`-related fields (`needsAIReview`, `tripleAtCount`, `aiContentInjected`). Therefore, schema cards emitted by this module do **not** surface `@@@` data. The `@@@` information lives only in the SQLite database.

---

# SUMMARY OF ALL FINDINGS

## BLOCKER

| ID | Line(s) | Issue |
|----|---------|-------|
| CR-01 | 198 | **Database path mismatch in CLI mode.** `St8Persistence()` uses CWD for DB path, but `targetDir` may be different. Cards could be generated from wrong project's data. |

## WARNING

| ID | Line(s) | Issue |
|----|---------|-------|
| WR-01 | 21 | `this.strict` stored but never read; `strict` option is a dead property |
| WR-02 | 59, 309, 362 | File watcher passes `null` intent → incremental cards always have empty intent data |
| WR-03 | 58, 309, 362 | File watcher passes empty connections → incremental cards always have stale connections |
| WR-04 | 52 | `lastIndexed` uses SQLite `CURRENT_TIMESTAMP` format (`YYYY-MM-DD HH:MM:SS`) while other timestamps use ISO 8601 — inconsistent formats within same card |
| WR-05 | 66-69 | Validation is advisory-only; `strict` mode never passed to validator; malformed cards always written |
| WR-06 | st8-types.js:147 | `validateAgainstShape` uses `typeof` which can't distinguish arrays from objects |
| WR-07 | 73-81 | `sortedReplacer` creates new objects for every nested object during serialization (correct but worth noting) |
| WR-08 | 107-109 | Silent AST failure — no logging when `extractImportsAndExports` throws; card silently gets empty imports/exports |
| WR-09 | 154-156 | Filename collision risk — two different filepaths can map to same card filename (e.g., `a/b_c.js` and `a_b/c.js`) |
| WR-10 | 162-182 | `diff()` method is dead code — never called from any production code path |
| WR-11 | 168 | `diff()` has no error handling around `JSON.parse(fs.readFileSync(...))` — corrupted JSON crashes caller |
| WR-12 | 170-171 | `diff()` uses `Object.keys(St8SchemaCard)` which only iterates top-level keys (but JSON.stringify comparison handles nesting correctly) |

## INFO

| ID | Line(s) | Issue |
|----|---------|-------|
| IN-01 | 82 | `fs.writeFileSync` is synchronous — blocks event loop during batch writes |
| IN-02 | 84 | Return value of `emitCard` discarded by most callers |
| IN-03 | 92 | Lazy `require()` of astParser inside method body — module load error occurs at call time |
| IN-04 | 104 | Non-existent files correctly get empty imports/exports (CONCEPT file support) |
| IN-05 | 119-120 | N+1 query pattern — `getMutationCount` + `getLastMutation` per file in loop |
| IN-06 | 129 | `getConnectionsForFile` does OR query on two columns |
| IN-07 | 147 | Return value `{ emitted, errors }` never checked by callers except CLI |
| IN-08 | index.js:238 | `_cardFilename` logic duplicated inline in `backend/index.js` |
| IN-09 | 191-194 | `--diff` CLI flag detected but not implemented (stub) |

---

_Report: 2026-05-13_
_Depth: deep (cross-file analysis, call chain tracing, import graph)_
_Reviewer: Claude (gsd-code-reviewer)_
