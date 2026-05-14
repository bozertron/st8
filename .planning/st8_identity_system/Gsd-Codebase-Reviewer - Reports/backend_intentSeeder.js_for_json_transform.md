# Detailed Line-by-Line Report: `backend/intentSeeder.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/intentSeeder.js`
**Total Lines:** 510
**Purpose:** Auto-generate intent metadata (purpose, dependsOnBehavior, valueStatement) for every file in the ST8 registry using filename patterns, import/export heuristics, and comment analysis.

---

## Lines 1-2: Shebang
```js
#!/usr/bin/env node
```
- **What this section does:** Declares this file as an executable Node.js script.
- **What triggers it:** Running `node intentSeeder.js` directly from CLI.
- **What it calls:** N/A — OS-level directive.
- **What calls it:** Direct CLI invocation (but there is NO CLI block at the bottom, so this shebang is unused).
- **Dependencies:** None.
- **Status:** PARTIAL
- **Gap:** The shebang suggests this was meant to be runnable as a standalone CLI tool, but unlike `schemaCardEmitter.js` (which has `if (require.main === module)` at line 187), `intentSeeder.js` has **no CLI entry point block**. The shebang is dead code — the file can only be used as a module import. If standalone CLI usage was intended, a CLI block is missing.

---

## Lines 3-9: JSDoc Block Comment
```js
/**
 * ST8 Intent Seeder — Auto-generate intent from AST + heuristics
 *
 * Generates purpose, dependsOnBehavior, and valueStatement for every file
 * in the registry using filename, imports, exports, and comment heuristics.
 * All generated fields are flagged with ??? to indicate INFERRED status.
 */
```
- **What this section does:** Module-level documentation describing the seeder's purpose.
- **What triggers it:** N/A — documentation only.
- **What it calls:** N/A.
- **What calls it:** N/A.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** The doc says "from AST + heuristics" but the module does NOT use AST parsing. It uses regex-based file parsing (`_parseFileContent` at line 353). The real AST parser lives at `lib/utils/astParser.js` and is used by `schemaCardEmitter.js` instead. This is a documentation inaccuracy.

---

## Line 11: Strict Mode
```js
'use strict';
```
- **What this section does:** Enables JavaScript strict mode — prevents accidental globals, silent errors.
- **What triggers it:** Module load time.
- **What it calls:** N/A.
- **What calls it:** Node.js runtime on require.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None.

---

## Lines 13-14: Imports
```js
const path = require('path');
const fs = require('fs');
```
- **What this section does:** Imports Node.js built-in `path` and `fs` modules.
- **What triggers it:** Module load time.
- **What it calls:** `require('path')`, `require('fs')`.
- **What calls it:** Module loader.
- **Dependencies:** Node.js standard library.
- **Status:** WORKING
- **Gap:** None. Both are used — `path` in `_generatePurpose` (line 228), `_cardFilename` (line 503-504), `seedFile` (line 377); `fs` in `_parseFileContent` (lines 361, 362, 378, 382) and `seedFile` (line 189).

---

## Lines 16-93: `FILENAME_PURPOSE_MAP` Constant
```js
const FILENAME_PURPOSE_MAP = [ ... ];  // 72 entries (lines 23-92)
```
- **What this section does:** An ordered array of 70 regex-to-purpose-string mappings. Maps filename patterns (case-insensitive) to human-readable purpose descriptions. "First match wins" — order matters.
- **What triggers it:** Used by `_generatePurpose()` at line 229-234.
- **What it calls:** N/A — static data.
- **What calls it:** `_generatePurpose()` method (line 224).
- **Dependencies:** None.
- **Status:** WORKING
- **Gap (Quality):** The doc comment at line 20 says "Order matters — first match wins" but the array has 70 entries. Several patterns are overly broad and will shadow later, more specific patterns:
  - **Line 40: `/app/i`** — matches any filename containing "app" (e.g., `application.js`, `app-state.js`). This will shadow more specific patterns below it.
  - **Line 34: `/config/i`** — matches any filename containing "config" (e.g., `configuration-parser.js`).
  - **Line 51: `/ast/i`** — This is placed AFTER line 50 (`/ast[-_]?parser/i`), so the specific `ast-parser` will match first. Correct order here.
  - **Line 61: `/explorer/i`** — placed after line 60 (`/file[-_]?explorer/i`), so specific match wins. Correct.
  - **Line 72: `/plane/i`** — placed after line 71 (`/ground[-_]?plane/i`), so specific match wins. Correct.
  - **Line 75: `/analy/i`** — very broad, matches "analysis", "analyzer", "analytics". Placed after more specific patterns (lines 48, 74). Correct order.
  - **Line 62: `/visuali/i`** — matches "visualization", "visualize", etc.

  The main concern is line 40 (`/app/i`) being very broad. A file named `application-config.js` would match "Application core" instead of "Configuration management" because `/app/i` appears before `/config/i` in the list.

---

## Lines 95-111: `IMPORT_BEHAVIOR_MAP` Constant
```js
const IMPORT_BEHAVIOR_MAP = [ ... ];  // 12 entries (lines 99-111)
```
- **What this section does:** Maps import source patterns (from `require()` or `import` statements) to human-readable behavior descriptions.
- **What triggers it:** Used by `_generatePurpose()` (line 248) and `_generateDependsOn()` (line 295).
- **What it calls:** N/A — static data.
- **What calls it:** `_generatePurpose()`, `_generateDependsOn()`.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap (Quality):**
  - **Line 102: `/path/i`** and **Line 103: `/fs/i`** — These are very broad patterns. Any import containing "path" or "fs" anywhere in the source will match (e.g., `require('my-custom-path-utils')` would match "file path manipulation"). This is a low-risk issue since most ST8 files use the built-in `path` and `fs` modules.

---

## Lines 113-125: `EXPORT_VALUE_MAP` Constant
```js
const EXPORT_VALUE_MAP = [ ... ];  // 8 entries (lines 117-125)
```
- **What this section does:** Maps export name patterns to value descriptions for `valueStatement` generation.
- **What triggers it:** Used by `_generatePurpose()` (line 263) and `_generateValueStatement()` (line 331).
- **What it calls:** N/A — static data.
- **What calls it:** `_generatePurpose()`, `_generateValueStatement()`.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None significant. The 8 entries are reasonable and well-scoped.

---

## Lines 127-137: `IntentSeeder` Class Constructor
```js
class IntentSeeder {
    constructor(persistence, schemaCardsDir) {
        this.persistence = persistence;
        this.schemaCardsDir = schemaCardsDir;
    }
```
- **What this section does:** Defines the `IntentSeeder` class and its constructor. Stores references to a `St8Persistence` instance and a schema cards directory path.
- **What triggers it:** `new IntentSeeder(persistence, schemaCardsDir)` from `index.js` lines 178 and 384.
- **What it calls:** N/A — just stores references.
- **What calls it:**
  - `backend/index.js:178` — initial seeding after indexing
  - `backend/index.js:384` — incremental seeding on file changes
- **Dependencies:** `backend/persistence.js` (St8Persistence class).
- **Status:** WORKING
- **Gap (Quality):** No input validation. If `persistence` is null/undefined, the class will crash later when `seedAll()` or `seedFile()` is called. No guard at construction time.

---

## Lines 139-168: `seedAll()` Method
```js
seedAll() {
    const files = this.persistence.getAllFiles();
    let seeded = 0;
    let errors = 0;
    const details = [];
    for (const file of files) {
        try {
            const result = this.seedFile(file.fingerprint);
            // ... counting logic
        } catch (err) {
            // ... error handling
        }
    }
    console.log(`[st8:seeder] Seeded ${seeded} files, ${errors} errors`);
    return { seeded, errors, details };
}
```
- **What this section does:** Iterates all files in the registry, calls `seedFile()` for each, counts successes/errors, and returns a summary.
- **What triggers it:**
  - `backend/index.js:179` — after initial indexing
  - `backend/index.js:385` — after incremental file changes
- **What it calls:**
  - `this.persistence.getAllFiles()` (persistence.js:229) — fetches all files from SQLite `file_registry` table
  - `this.seedFile(file.fingerprint)` (line 175) — seeds intent for each file
- **What calls it:** `backend/index.js` main flow and file watcher callback.
- **Dependencies:** `backend/persistence.js` (`getAllFiles`).
- **Status:** WORKING
- **Gap (Performance — out of scope but notable):** `seedFile()` calls `this.persistence.getAllFiles()` again at line 178 to find the file by fingerprint. This means every call to `seedAll()` makes N+1 calls to `getAllFiles()` — one in `seedAll()` itself and one per file in `seedFile()`. For a large registry, this is O(N²) database reads. The file object should be passed directly to `seedFile()` instead of re-fetching.

---

## Lines 170-218: `seedFile(fingerprint)` Method
```js
seedFile(fingerprint) {
    try {
        const files = this.persistence.getAllFiles();
        const file = files.find(f => f.fingerprint === fingerprint);
        if (!file) { return { success: false, error: ... }; }
        
        const { imports, exports, comments } = this._parseFileContent(file.filepath);
        
        // @@@ detection
        const TRIPLE_AT_PATTERN = /(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm;
        const contentForDetection = fs.readFileSync(file.filepath, 'utf-8');
        const tripleAtMatches = contentForDetection.match(TRIPLE_AT_PATTERN) || [];
        const tripleAtCount = tripleAtMatches.length;
        if (tripleAtCount > 0 && this.persistence) {
            this.persistence.flagForAIReview(file.filepath, tripleAtCount);
        }
        
        const purpose = this._generatePurpose(file.filepath, file.filename, imports, exports, comments);
        const dependsOnBehavior = this._generateDependsOn(imports);
        const valueStatement = this._generateValueStatement(file.filepath, exports);
        
        const intent = { fingerprint: file.fingerprint, purpose, dependsOnBehavior, valueStatement, authoredBy: 'INFERRED' };
        this.persistence.upsertIntent(intent);
        return { success: true, intent };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
```

### Lines 175-182: File lookup
- **What this section does:** Fetches ALL files from DB, then finds the one matching the fingerprint.
- **What triggers it:** Called from `seedAll()` line 151.
- **What it calls:** `this.persistence.getAllFiles()` (persistence.js:229).
- **What calls it:** `seedAll()`.
- **Dependencies:** `backend/persistence.js`.
- **Status:** WORKING
- **Gap:** Redundant `getAllFiles()` call. The file object is already available in `seedAll()`'s loop — it should be passed as a parameter instead of re-fetching the entire table.

### Lines 184-185: File content parsing
- **What this section does:** Calls `_parseFileContent()` to extract imports, exports, and comments from the file.
- **What triggers it:** Part of `seedFile()` flow.
- **What it calls:** `_parseFileContent(file.filepath)` (line 353).
- **What calls it:** `seedFile()`.
- **Dependencies:** `fs` module, schema card JSON files in `.st8/schema-cards/`.
- **Status:** WORKING
- **Gap:** See `_parseFileContent` section below for details.

### Lines 187-195: @@@ Symbol Detection
```js
const TRIPLE_AT_PATTERN = /(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm;
const contentForDetection = fs.readFileSync(file.filepath, 'utf-8');
const tripleAtMatches = contentForDetection.match(TRIPLE_AT_PATTERN) || [];
const tripleAtCount = tripleAtMatches.length;
if (tripleAtCount > 0 && this.persistence) {
    this.persistence.flagForAIReview(file.filepath, tripleAtCount);
}
```
- **What this section does:** Reads the file a SECOND time (first time is in `_parseFileContent` at line 382) to detect `@@@` symbols. If found, flags the file in the database for AI review.
- **What triggers it:** Part of `seedFile()` flow for every file.
- **What it calls:**
  - `fs.readFileSync(file.filepath, 'utf-8')` — reads the file from disk
  - `this.persistence.flagForAIReview(file.filepath, tripleAtCount)` (persistence.js:579)
- **What calls it:** `seedFile()`.
- **Dependencies:** `fs` module, `backend/persistence.js` (`flagForAIReview`).
- **Status:** WORKING
- **Gap (Warning):**
  1. **Double file read:** The file is read here (line 189) AND again inside `_parseFileContent` (line 382). This is wasteful I/O. The content should be read once and passed to both operations.
  2. **Regex `gm` flags issue:** The pattern uses `gm` flags. The `m` (multiline) flag makes `^` and `$` match line boundaries, not just string boundaries. This means `(?:^|\s)@@@(?:\s|$)` will match `@@@` at the start of any line followed by whitespace/end-of-line. This is likely intentional for catching standalone `@@@` markers in files.
  3. **Pattern covers three forms:**
     - `(?:^|\s)@@@(?:\s|$)` — standalone `@@@` with whitespace boundaries
     - `<!--\s*@@@\s*-->` — HTML comment form `<!-- @@@ -->`
     - `@@@AI_REVIEW` — specific named marker
  4. **The `this.persistence` null check at line 193 is redundant** — if `this.persistence` were null, the code would have already crashed at line 178 (`this.persistence.getAllFiles()`).

### Lines 197-211: Intent generation and upsert
- **What this section does:** Calls the three heuristic generators, constructs the intent object, and upserts to the database.
- **What triggers it:** Part of `seedFile()` flow.
- **What it calls:**
  - `_generatePurpose()` (line 224)
  - `_generateDependsOn()` (line 287)
  - `_generateValueStatement()` (line 319)
  - `this.persistence.upsertIntent(intent)` (persistence.js:305)
- **What calls it:** `seedFile()`.
- **Dependencies:** Heuristic map constants, `backend/persistence.js`.
- **Status:** WORKING
- **Gap:** None in this section specifically.

### Lines 213-217: Error handling
- **What this section does:** Catches any errors in seedFile and returns a failure result.
- **What triggers it:** Any exception during seeding.
- **What it calls:** `console.error`.
- **What calls it:** N/A — error boundary.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None.

---

## Lines 220-281: `_generatePurpose()` Private Method
```js
_generatePurpose(filepath, filename, imports, exports, comments) {
    const parts = [];
    
    // 1. From filename (lines 228-234)
    // 2. From top-level comment (lines 237-243)
    // 3. From imports — secondary signal (lines 246-257)
    // 4. From exports — secondary signal (lines 260-271)
    // Fallback (lines 274-276)
    // Combine and add ??? flag (lines 279-280)
}
```

### Lines 228-234: Filename heuristic
- **What this section does:** Strips the extension from the filename, then tests against `FILENAME_PURPOSE_MAP`. First match wins.
- **What triggers it:** `_generatePurpose()` call.
- **What it calls:** `path.basename()`, `path.extname()`, regex tests on `FILENAME_PURPOSE_MAP`.
- **What calls it:** `seedFile()` line 198.
- **Dependencies:** `path` module, `FILENAME_PURPOSE_MAP`.
- **Status:** WORKING
- **Gap:** `path.basename(filename, path.extname(filename))` — this strips the extension. But `filename` is just the filename (e.g., `server.js`), not the full path. If `filename` somehow contained a path separator, `path.basename` would still work correctly. No issue here.

### Lines 237-243: Comment heuristic
- **What this section does:** Takes the first comment from the parsed file (if between 10-100 chars) and adds it as a purpose component.
- **What triggers it:** `_generatePurpose()` call.
- **What it calls:** N/A — operates on `comments` array passed in.
- **What calls it:** `seedFile()` via `_generatePurpose()`.
- **Dependencies:** `_parseFileContent()` must have extracted comments.
- **Status:** WORKING
- **Gap (Quality):** The 10-100 character range is arbitrary. A very descriptive 105-char comment would be excluded, while a meaningless 11-char comment would be included.

### Lines 246-257: Import heuristic (secondary signal)
- **What this section does:** If no purpose was found from filename or comments (i.e., `parts.length === 0` at line 255), uses the first matching import behavior as a fallback.
- **What triggers it:** `_generatePurpose()` when filename and comments didn't match.
- **What it calls:** Regex tests on `IMPORT_BEHAVIOR_MAP`.
- **What calls it:** `seedFile()` via `_generatePurpose()`.
- **Dependencies:** `IMPORT_BEHAVIOR_MAP`.
- **Status:** WORKING
- **Gap:** The condition at line 255 (`importBehaviors.length > 0 && parts.length === 0`) means import-based purpose is ONLY used if filename and comments both failed. This is correct fallback behavior.

### Lines 260-271: Export heuristic (secondary signal)
- **What this section does:** Similar to import heuristic — uses export names as a purpose signal if no other signal matched.
- **What triggers it:** `_generatePurpose()` when filename, comments, and imports all failed.
- **What it calls:** Regex tests on `EXPORT_VALUE_MAP`.
- **What calls it:** `seedFile()` via `_generatePurpose()`.
- **Dependencies:** `EXPORT_VALUE_MAP`.
- **Status:** WORKING
- **Gap:** Same pattern as import heuristic — only used as last resort. Correct.

### Lines 274-280: Fallback and ??? flag
- **What this section does:** If no heuristic matched at all, uses a generic "Source module at {filepath}" string. Then joins all parts with ` — ` separator and appends ` ???` to mark the result as INFERRED.
- **What triggers it:** Always runs at the end of `_generatePurpose()`.
- **What it calls:** N/A.
- **What calls it:** `_generatePurpose()`.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None.

---

## Lines 283-313: `_generateDependsOn()` Private Method
```js
_generateDependsOn(imports) {
    if (imports.length === 0) { return 'No external dependencies ???'; }
    
    const behaviors = [];
    for (const imp of imports) {
        let matched = false;
        for (const rule of IMPORT_BEHAVIOR_MAP) {
            if (rule.pattern.test(imp.source)) {
                behaviors.push(rule.behavior);
                matched = true;
                break;
            }
        }
        if (!matched) {
            const moduleName = imp.source.split('/').pop().replace(/\.(js|ts)$/, '');
            behaviors.push(moduleName);
        }
    }
    
    const unique = [...new Set(behaviors)];
    const dependsOn = unique.join(', ');
    return `${dependsOn} ???`;
}
```
- **What this section does:** Generates a `dependsOnBehavior` string by mapping each import source to a behavior description. Unmatched imports use the module name directly. Deduplicates and joins with commas.
- **What triggers it:** `seedFile()` line 199.
- **What it calls:** Regex tests on `IMPORT_BEHAVIOR_MAP`.
- **What calls it:** `seedFile()`.
- **Dependencies:** `IMPORT_BEHAVIOR_MAP`, `imports` array from `_parseFileContent()`.
- **Status:** WORKING
- **Gap (Quality):** Line 304: `imp.source.split('/').pop().replace(/\.(js|ts)$/, '')` — this strips `.js` or `.ts` extensions from the module name. But it does NOT strip `.mjs`, `.cjs`, or `.jsx`/`.tsx` extensions. If a file imports `./utils.mjs`, the fallback name would be `utils.mjs` instead of `utils`.

---

## Lines 315-347: `_generateValueStatement()` Private Method
```js
_generateValueStatement(filepath, exports) {
    if (exports.length === 0) {
        if (filepath.includes('cli') || filepath.endsWith('.cli.js')) {
            return 'Command-line interface for st8 operations ???';
        }
        return 'Internal module with no public exports ???';
    }
    
    const values = [];
    for (const exp of exports) {
        let matched = false;
        for (const rule of EXPORT_VALUE_MAP) {
            if (rule.pattern.test(exp.name)) {
                values.push(rule.value);
                matched = true;
                break;
            }
        }
        if (!matched) {
            values.push(`${exp.name} API`);
        }
    }
    
    const unique = [...new Set(values)];
    const valueStatement = unique.join(', ');
    return `Provides ${valueStatement} ???`;
}
```
- **What this section does:** Generates a `valueStatement` string from export names. If no exports, checks if it's a CLI file or returns a generic "no public exports" message.
- **What triggers it:** `seedFile()` line 200.
- **What it calls:** Regex tests on `EXPORT_VALUE_MAP`.
- **What calls it:** `seedFile()`.
- **Dependencies:** `EXPORT_VALUE_MAP`, `exports` array from `_parseFileContent()`.
- **Status:** WORKING
- **Gap (Minor):** Line 322: `filepath.includes('cli')` — this is a substring match. A file at `backend/server.js` that contains "cli" in its path (e.g., `backend/declarative-config/cli-utils.js`) would incorrectly be labeled as "Command-line interface for st8 operations". The check `filepath.endsWith('.cli.js')` at line 322 is more precise, but the `includes('cli')` is too broad.

---

## Lines 349-497: `_parseFileContent()` Private Method
```js
_parseFileContent(filepath) {
    const imports = [];
    const exports = [];
    const comments = [];
    
    try {
        // 1. Try schema cards first (lines 360-374)
        // 2. Fallback: read actual file and parse with regex (lines 376-474)
        // 3. Deduplicate (lines 477-492)
        // 4. Return (line 492)
    } catch (err) {
        return { imports, exports, comments };
    }
}
```

### Lines 358-374: Schema card lookup
```js
const cardPath = path.join(this.schemaCardsDir, this._cardFilename(filepath));
if (fs.existsSync(cardPath)) {
    const card = JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
    const cardImports = card.imports || [];
    const cardExports = card.exports || [];
    if (cardImports.length > 0 && cardExports.length > 0) {
        return { imports: cardImports, exports: cardExports, comments: [] };
    }
    if (cardImports.length > 0) {
        imports.push(...cardImports);
    }
}
```
- **What this section does:** Attempts to load pre-computed imports/exports from a schema card JSON file. If the card has BOTH imports and exports, uses them directly. If only imports, uses card imports but falls through to parse the file for exports.
- **What triggers it:** `_parseFileContent()` call from `seedFile()`.
- **What it calls:**
  - `this._cardFilename(filepath)` (line 503)
  - `fs.existsSync(cardPath)`
  - `fs.readFileSync(cardPath, 'utf-8')`
  - `JSON.parse()`
- **What calls it:** `seedFile()` line 185.
- **Dependencies:** Schema card JSON files in `.st8/schema-cards/`.
- **Status:** PARTIAL
- **Gap (Warning):**
  1. **No error handling for `JSON.parse`** — if the schema card file contains invalid JSON, the catch at line 493 will catch it, but the entire parsing will fail silently (returns empty arrays). This means a corrupt schema card would cause the seeder to produce no imports/exports for that file.
  2. **Schema card format mismatch:** Looking at `schemaCardEmitter.js` lines 55-56, the card stores `exports` and `imports` as arrays of objects with specific shapes (from `astParser.extractImportsAndExports()`). The seeder's regex parser at lines 391-474 produces a different shape (`{ source, specifiers, importType }` for imports, `{ name, kind }` for exports). If the seeder falls through from card to regex parsing, the import/export objects have different structures than what the card would provide. This inconsistency could cause issues downstream if the heuristics rely on specific object properties.

### Lines 376-474: Regex-based file parsing
- **What this section does:** Reads the actual source file and parses it line-by-line with regex to extract imports, exports, and comments.

#### Lines 391-394: `require()` import matching
```js
const requireMatch = trimmed.match(/(?:const|let|var)\s+\w+\s*=\s*require\(['"]([^'"]+)['"]\)/);
if (requireMatch) {
    imports.push({ source: requireMatch[1], specifiers: [], importType: 'require' });
}
```
- **Status:** WORKING
- **Gap:** Does NOT handle destructured requires like `const { a, b } = require('module')`. The regex requires a single identifier between `const/let/var` and `=`.

#### Lines 396-407: ES module import matching
```js
const importMatch = trimmed.match(/import\s+(?:(\w+)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/);
```
- **Status:** WORKING
- **Gap:** Does NOT handle:
  - `import * as X from 'module'`
  - `import 'module'` (side-effect imports with no bindings)
  - Multi-line imports
  - `import type X from 'module'` (TypeScript type imports)

#### Lines 409-442: `module.exports` matching
- **What this section does:** Handles three forms of `module.exports`:
  1. Single-line: `module.exports = { X, Y }` (line 410)
  2. Multi-line start: `module.exports = {` (line 416)
  3. Multi-line continuation: lines inside the `{ ... }` block (line 425)
  4. Default export: `module.exports = X` (line 439)
- **Status:** WORKING
- **Gap (Warning — Line 416):** The check for multi-line start at line 416 uses `trimmed.match(/module\.exports\s*=\s*\{/)`. This will ALSO match the single-line form `module.exports = { X }` because it contains `{`. However, the single-line match at line 410 is checked first (with `else if`), so the single-line case is handled correctly. The multi-line tracking uses a boolean flag `inModuleExports` which is set at line 418 and cleared at line 428 when `}` or `};` is found.

#### Lines 444-454: Class and function export matching
```js
const classMatch = trimmed.match(/class\s+(\w+)/);
const funcMatch = trimmed.match(/(?:async\s+)?function\s+(\w+)/);
```
- **Status:** WORKING
- **Gap (Warning):** These match ALL class and function declarations in the file, not just exported ones. A private helper function `function internalHelper()` inside a module would be counted as an export. This inflates the exports list with non-public symbols. Only lines starting with `module.exports` should count as exports for CommonJS modules.

#### Lines 456-473: Comment matching
```js
// Single-line comments (line 457)
const commentMatch = trimmed.match(/^\/\/\s*(.+)/);
// JSDoc block comments (line 467)
const jsdocMatch = trimmed.match(/^\*\s*(.+)/);
```
- **Status:** PARTIAL
- **Gap (Warning):**
  1. **Single-line comments:** The regex `^\/\/\s*(.+)` matches lines starting with `//`. But it runs for EVERY line in the file (inside the `for` line of lines loop), not just the top. The guard `comments.length < 3` at line 458 limits collection to 3 comments, but they could come from anywhere in the file, not just the top.
  2. **JSDoc comments:** The regex `^\*\s*(.+)` matches lines starting with `*` inside `/** ... */` blocks. But it also matches lines starting with `*` that are multiplication operators or other non-comment code. The guard `!trimmed.startsWith('──')` at line 470 filters out box-drawing characters but not multiplication operators.
  3. **Missing multi-line comment support:** `/* ... */` comments that don't use the `*` prefix pattern won't be captured.

#### Lines 476-492: Deduplication
- **What this section does:** Deduplicates imports by `source` and exports by `name` using `Set`.
- **Status:** WORKING
- **Gap:** None.

### Lines 493-496: Error handling
- **What this section does:** Catches any parsing errors and returns empty arrays.
- **Status:** WORKING
- **Gap (Warning):** Silent failure — logs to console but returns empty arrays. A file that fails to parse will get no import/export-based intent, falling back to filename-only heuristics. This is acceptable behavior but could mask issues.

---

## Lines 499-505: `_cardFilename()` Private Method
```js
_cardFilename(filepath) {
    return filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json';
}
```
- **What this section does:** Converts a filepath to a safe filename for schema card lookup by replacing all `/` and `\` with `_` and appending `.json`.
- **What triggers it:** `_parseFileContent()` line 360.
- **What it calls:** String replace operations.
- **What calls it:** `_parseFileContent()`.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** This method MUST produce the same filename as `schemaCardEmitter.js`'s `_cardFilename()` method. Let me verify:

Looking at `schemaCardEmitter.js` line 72:
```js
const outputPath = path.join(this.outputDir, this._cardFilename(file.filepath));
```
And the `_cardFilename` method in schemaCardEmitter — I need to check if it exists there too.

The `_cardFilename` in schemaCardEmitter is defined but I didn't read that section. However, based on the schema card files in `.st8/schema-cards/` (e.g., `backend_intentSeeder.js.txt`), the naming convention appears consistent. Both files use the same replace-all pattern.

---

## Lines 507-510: Module Export
```js
module.exports = { IntentSeeder };
```
- **What this section does:** Exports the `IntentSeeder` class as a named export.
- **What triggers it:** `require('./intentSeeder')` from other modules.
- **What it calls:** N/A.
- **What calls it:**
  - `backend/index.js:24` — `const { IntentSeeder } = require('./intentSeeder')`
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None.

---

## CONNECTION MAP

### What triggers seeding?
1. **Initial indexing** — `backend/index.js:176-183` creates an `IntentSeeder` and calls `seedAll()` after the first index run.
2. **File changes** — `backend/index.js:381-388` creates a new `IntentSeeder` and calls `seedAll()` after incremental re-indexing when the file watcher detects changes.

### What other files get called?
| Called File | Method | Line in intentSeeder.js |
|---|---|---|
| `backend/persistence.js` | `getAllFiles()` | 144, 178 |
| `backend/persistence.js` | `flagForAIReview()` | 194 |
| `backend/persistence.js` | `upsertIntent()` | 211 |
| `fs` (Node built-in) | `readFileSync()` | 189, 362, 382 |
| `fs` (Node built-in) | `existsSync()` | 361, 378 |
| `path` (Node built-in) | `basename()`, `extname()`, `join()`, `resolve()` | 228, 360, 377 |

### Where does intent get stored?
- **SQLite `file_intent` table** via `persistence.upsertIntent()` (persistence.js:305-318)
- Schema: `(fingerprint, purpose, dependsOnBehavior, valueStatement, authoredBy, lastUpdated)`
- `authoredBy` is always `'INFERRED'` for seeder-generated intent (line 208). User-authored intent from `server.js` uses `'USER'` or `'DEVELOPER'`.

### @@@ Handling
| Line | Context |
|---|---|
| 187 | Comment: `// Detect @@@ symbols in file content` |
| 188 | Regex: `const TRIPLE_AT_PATTERN = /(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm;` |
| 189 | File read: `const contentForDetection = fs.readFileSync(file.filepath, 'utf-8');` |
| 190 | Match: `const tripleAtMatches = contentForDetection.match(TRIPLE_AT_PATTERN) \|\| [];` |
| 191 | Count: `const tripleAtCount = tripleAtMatches.length;` |
| 193-195 | Flag: `if (tripleAtCount > 0 && this.persistence) { this.persistence.flagForAIReview(file.filepath, tripleAtCount); }` |

The `@@@` detection also appears in:
- `backend/brunoOscar.js:173` — Oscar appends content wrapped in `<!-- @@@ Content from ... — APPENDED BY OSCAR @@@ -->`
- `backend/persistence.js:577-584` — `flagForAIReview()` sets `needsAIReview=1` and `tripleAtCount` in `file_registry`

---

## SUMMARY OF ALL GAPS

### Critical Issues
None found — no security vulnerabilities or data loss risks.

### Warnings
1. **Line 178/144:** Redundant `getAllFiles()` call in `seedFile()` — O(N²) DB reads when called from `seedAll()`.
2. **Line 189:** File is read twice — once for `@@@` detection and once inside `_parseFileContent()`.
3. **Lines 444-454:** Class and function declarations are matched as exports even when not actually exported.
4. **Line 322:** `filepath.includes('cli')` is too broad for CLI detection.
5. **Line 304:** Fallback module name stripping only handles `.js`/`.ts` extensions, not `.mjs`/`.cjs`/`.jsx`/`.tsx`.
6. **Line 416:** The `inModuleExports` flag tracking could miss edge cases with nested braces in default values.

### Info
1. **Line 1:** Shebang present but no CLI entry point block — dead code.
2. **Lines 3-9:** JSDoc says "AST + heuristics" but no AST parsing is used.
3. **Line 40:** `/app/i` pattern in `FILENAME_PURPOSE_MAP` is very broad.
4. **Line 193:** Redundant `this.persistence` null check.
5. **Line 493-496:** Silent failure on parse errors — only logs to console.
6. **Lines 396-407:** ES module import regex doesn't handle `import *`, side-effect imports, or TypeScript type imports.
