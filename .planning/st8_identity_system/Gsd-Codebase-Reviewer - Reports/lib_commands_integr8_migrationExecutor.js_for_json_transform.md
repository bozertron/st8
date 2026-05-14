# Detailed Line-by-Line Analysis: `migrationExecutor.js`

**File:** `lib/commands/integr8/migrationExecutor.js`
**Total Lines:** 1837
**Type:** Compiled TypeScript (CommonJS)
**Source Comment:** `// src/commands/integr8/migrationExecutor.ts` (line 2)

---

## SECTION 1: Module Boilerplate & TypeScript Helpers

### Lines 1-2: Strict Mode & Source Comment
```
"use strict";
// src/commands/integr8/migrationExecutor.ts
```
- **What this does:** Enables strict mode; documents source origin
- **Status:** WORKING

### Lines 3-35: TypeScript `__createBinding`, `__setModuleDefault`, `__importStar`
- **What this does:** TypeScript-compiled helpers for ES module interop. `__importStar` wraps `require()` results to simulate `import * as fs from 'fs-extra'` behavior.
- **What triggers it:** Called at lines 57-58 when `fs` and `path` are imported
- **Status:** WORKING — standard TypeScript output

### Lines 36-44: `__awaiter` Helper
- **What this does:** Converts `async/await` to generator-based promises for older Node.js compatibility
- **What triggers it:** Every `async function` in the file
- **Status:** WORKING — standard TypeScript output

### Lines 45-56: Module Exports Declaration
```js
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMigrationPlan = loadMigrationPlan;
exports.executeMigrationPlan = executeMigrationPlan;
exports.detectRouterFramework = detectRouterFramework;
exports.detectFrameworkFromPackageJson = detectFrameworkFromPackageJson;
exports.verifyIntegration = verifyIntegration;
exports.rollbackMigration = rollbackMigration;
exports.createPreMigrationSnapshot = createPreMigrationSnapshot;
exports.executeAtomicMigration = executeAtomicMigration;
exports.rollbackFromSnapshot = rollbackFromSnapshot;
exports.listAvailableSnapshots = listAvailableSnapshots;
exports.rollbackToLatest = rollbackToLatest;
```
- **What this does:** Declares all 11 exported functions
- **Status:** WORKING
- **Gap:** **NOT CONNECTED** — No file in the codebase imports from `migrationExecutor.js`. The `index.js` orchestrator does NOT import this module. All exports are orphaned.

---

## SECTION 2: Imports

### Lines 57-58: `fs-extra` and `path`
```js
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
```
- **What triggers it:** Module load time
- **Dependencies:** `fs-extra` npm package, Node.js `path` module
- **Status:** WORKING

### Line 59: `types` Import
```js
const types_1 = require("./types");
```
- **What it calls:** `lib/commands/integr8/types.js`
- **Used for:** `MigrationAction` enum (lines 95-111), `VerificationLevel` enum (lines 1264, 1278, 1300, etc.), `ResolutionStrategy` enum
- **Status:** WORKING

### Line 60: `tomlSerializer` Import
```js
const tomlSerializer_1 = require("./tomlSerializer");
```
- **What it calls:** `lib/commands/integr8/tomlSerializer.js`
- **Used for:** `parseMigrationPlanFromToml()` at line 67
- **Status:** WORKING

---

## SECTION 3: `loadMigrationPlan()`

### Lines 64-69: `loadMigrationPlan(planPath)`
```js
function loadMigrationPlan(planPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const tomlContent = yield fs.readFile(planPath, 'utf-8');
        return (0, tomlSerializer_1.parseMigrationPlanFromToml)(tomlContent);
    });
}
```
- **What this does:** Reads a TOML file from `planPath` and parses it into a migration plan object
- **What triggers it:** External caller passing a file path
- **What it calls:** `fs.readFile()` (line 66), `tomlSerializer.parseMigrationPlanFromToml()` (line 67)
- **What calls it:** NOTHING in the codebase — orphaned export
- **Dependencies:** `fs-extra`, `tomlSerializer.js`
- **Status:** WORKING functionally, NOT CONNECTED
- **Gap:** No error handling. If the file doesn't exist, the raw `ENOENT` error propagates up. No validation of the parsed plan structure.

---

## SECTION 4: `executeMigrationPlan()`

### Lines 73-129: `executeMigrationPlan(plan, options)`
- **What this does:** Iterates through `plan.steps` and executes each one based on `step.action` type
- **What triggers it:** Called by `executeAtomicMigration()` (line 1714) or external callers
- **What it calls:**
  - `executeCopyFile()` (line 96) — for `COPY_FILE` action
  - `executeRewriteImport()` (line 99) — for `REWRITE_IMPORT` action
  - `executeMergeRoute()` (line 102) — for `MERGE_ROUTE` action
  - `executeResolveConflict()` (line 105) — for `RESOLVE_CONFLICT` action
  - `executeRunCommand()` (line 108) — for `RUN_COMMAND` action
  - `executeVerifyStep()` (line 111) — for `VERIFY` action
- **What calls it:** `executeAtomicMigration()` at line 1714; NO other callers in codebase
- **Dependencies:** All step executor functions, `types.MigrationAction` enum
- **Status:** WORKING functionally, NOT CONNECTED

#### Key Logic:
- **Lines 75-81:** Initializes result object with `success: true`, `completedSteps: 0`, `totalSteps`, `errors: []`, `backupPaths: []`
- **Lines 82:** `baseDir` defaults to `plan.targetPath` if `options.baseDir` not set
- **Lines 88-91:** Dry run mode — logs but doesn't execute
- **Lines 94-115:** Switch on `step.action` — dispatches to appropriate executor
- **Lines 118-124:** **CATCH BLOCK** — On ANY failure: sets `result.success = false`, records `failedStep`, pushes error, and **BREAKS** (stops on first failure)
- **Line 116:** Increments `completedSteps` after each step (including after errors — this is a bug since line 123 `break`s before reaching 116 on error)

**BUG (Line 116 vs 123):** When a step fails, the `catch` block at line 118 executes `break` at line 123, which exits the loop BEFORE line 116 (`result.completedSteps++`). So `completedSteps` correctly reflects only successful steps. However, the step that FAILED is NOT counted, which could be confusing — the user sees "3/5 steps" but the 4th step is the one that failed.

---

## SECTION 5: Step Executors

### Lines 131-145: `executeCopyFile(step, sourcePath, baseDir, result)`
- **What this does:** Copies a file from `sourcePath/step.from` to `baseDir/step.to`
- **What triggers it:** `COPY_FILE` action in `executeMigrationPlan()`
- **What it calls:** `fs.pathExists()` (line 136), `fs.copy()` (lines 138, 142), `fs.ensureDir()` (line 141)
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING

#### Key Logic:
- **Line 133:** `src = path.resolve(sourcePath, step.from || '')` — resolves source path
- **Line 134:** `dest = path.resolve(baseDir, step.to || step.from || '')` — resolves destination
- **Lines 136-140:** If destination exists, creates backup at `dest + '.integr8-backup'`
- **Line 141:** Ensures destination directory exists
- **Line 142:** Copies file

**BUG (Line 133-134):** If `step.from` is `undefined` or empty, `src` resolves to just `sourcePath` (a directory), and `fs.copy()` at line 142 would copy the entire directory. No validation that `step.from` is provided.

### Lines 146-176: `executeRewriteImport(step, baseDir, result)`
- **What this does:** Reads a file, applies import path rewrite rules, writes it back
- **What triggers it:** `REWRITE_IMPORT` action
- **What it calls:**
  - `buildPathResolutionContext()` (line 158)
  - `validateImportRewritePath()` (line 162)
  - `fs.readFile()` (line 156), `fs.writeFile()` (line 173)
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING

#### Key Logic:
- **Line 148:** Resolves file path from `baseDir` and `step.file`
- **Lines 149-151:** Throws if file not found
- **Lines 153-155:** Creates backup
- **Line 158:** Builds path resolution context (workspace packages, tsconfig paths, exports)
- **Lines 159-172:** Iterates over `step.rules`, validates each rewritten path, then applies regex replacement
- **Line 169:** Escapes special regex characters in `rule.originalImport`
- **Line 170:** Creates global regex
- **Line 171:** Replaces all occurrences

**SECURITY (Line 169-171):** The regex replacement uses `rule.rewrittenImport` directly as the replacement string. If `rule.rewrittenImport` contains `$&`, `$1`, etc., these would be interpreted as regex replacement special characters. This could cause unexpected behavior but is not a direct injection vulnerability since the input comes from a TOML plan file.

### Lines 177-244: `buildPathResolutionContext(baseDir)` (I-14 Tier 3)
- **What this does:** Builds a context object with workspace packages, tsconfig paths, and package.json exports for import validation
- **What triggers it:** Called by `executeRewriteImport()` at line 158
- **What it calls:** `fs.pathExists()`, `fs.readFile()`, `fs.readdir()`, `JSON.parse()`
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING

#### Key Logic:
- **Lines 190-225:** Reads `package.json`, parses `workspaces` field, iterates workspace directories, reads each workspace's `package.json` to build `workspacePackages` Map
- **Lines 221-224:** Reads `exports` field from package.json
- **Lines 228-241:** Reads `tsconfig.json`, extracts `compilerOptions.paths` and `compilerOptions.baseUrl`
- **Lines 215, 227, 241:** Silent catch blocks — errors are silently swallowed

**WARNING (Lines 215, 227, 241):** Empty catch blocks with comments like "skip invalid package.json". If `JSON.parse()` fails on a malformed file, the error is silently ignored. This could hide real issues during migration.

### Lines 248-328: `validateImportRewritePath(rewrittenPath, fromFile, baseDir, ctx)` (I-14 Tier 3)
- **What this does:** Validates that a rewritten import path actually resolves to a real file/module
- **What triggers it:** Called by `executeRewriteImport()` at line 162
- **What it calls:** `resolvePackageExport()` (line 269), `fs.pathExistsSync()` (lines 288, 300, 320)
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING

#### Key Logic:
- **Lines 257-306:** Non-relative path resolution: checks workspace packages, package.json exports, tsconfig paths, node_modules
- **Lines 309-327:** Relative path resolution: resolves from `fromFile` directory, checks multiple extensions (.ts, .tsx, .js, .jsx, /index.ts, etc.)
- **Lines 275-296:** tsconfig path alias resolution with regex matching

**NOTE:** Returns `valid: false` with warnings but does NOT throw — the migration proceeds even if validation fails. This is intentional (line 326: "proceeding anyway").

### Lines 332-350: `resolvePackageExport(importPath, exports)`
- **What this does:** Checks if an import path matches a package.json `exports` field entry
- **What triggers it:** Called by `validateImportRewritePath()` at line 269
- **Status:** WORKING

**BUG (Line 338):** `const subpath = './' + importPath.split('/').slice(1).join('/');` — This assumes `importPath` has at least one `/`. If `importPath` is a bare package name (no `/`), `slice(1)` returns `[]`, and `subpath` becomes `'./'`. This would incorrectly match `exports['.']` even if the import was something like `lodash` (not the package root).

### Lines 351-432: `executeMergeRoute(step, baseDir, result)` (I-08 FIX)
- **What this does:** Merges a route definition into an existing router file
- **What triggers it:** `MERGE_ROUTE` action
- **What it calls:** `detectRouterFormat()` (line 363), `fs.readFile()` (line 360), `fs.writeFile()` (line 429)
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING

#### Key Logic:
- **Line 362:** Default route definition if `step.from` not provided
- **Line 363:** Detects router format (array, createRouter, programmatic, object)
- **Lines 365-428:** Switch on format — each case finds the insertion point and inserts the route definition
- **Line 367:** `content.lastIndexOf(']')` for array format — finds LAST `]` in file

**BUG (Line 367):** `content.lastIndexOf(']')` finds the LAST `]` in the entire file, not necessarily the routes array closing bracket. If there are other arrays (e.g., in component imports, middleware arrays), this could insert the route in the wrong location.

**BUG (Line 400):** `content.lastIndexOf('export')` for programmatic format — finds LAST `export` keyword. If there are multiple exports, this inserts the `addRoute` call before the last one, which may not be the correct location.

### Lines 438-448: `detectRouterFormat(content)`
- **What this does:** Wrapper that calls `detectRouterFramework()` and maps the result to a format string
- **Status:** WORKING

### Lines 452-552: `detectRouterFramework(content, packageJsonPath)` (I-08 Tier 3)
- **What this does:** Detects which router framework/format is used by analyzing file content patterns
- **What triggers it:** Called by `detectRouterFormat()` at line 439
- **Status:** WORKING

#### Detection Patterns:
- **Lines 458-470:** Vue Router 4: `createRouter()` + `createWebHistory/createWebHashHistory` → confidence 0.95
- **Lines 473-478:** React Router 6+: `createBrowserRouter` or `createRoutesFromElements` → confidence 0.95
- **Lines 480-487:** React Router 6: `<Route element={...}/>` → confidence 0.8
- **Lines 489-496:** Next.js App Router: `export default function Page/Layout` → confidence 0.75
- **Lines 498-505:** Next.js Pages Router: `getServerSideProps/getStaticProps` → confidence 0.85
- **Lines 507-514:** Programmatic: `router.addRoute()` → confidence 0.7
- **Lines 516-523:** Generic array: `routes = [` → confidence 0.6
- **Lines 525-532:** Generic object: `routes = {` → confidence 0.5
- **Lines 534-550:** Fallback: import statement detection → confidence 0.6

**NOTE:** `packageJsonPath` parameter (line 452) is accepted but NEVER USED. The function only analyzes `content`.

### Lines 556-579: `detectFrameworkFromPackageJson(baseDir)` (I-08 Tier 3)
- **What this does:** Detects framework from package.json dependencies
- **What triggers it:** External callers
- **What it calls:** `fs.pathExists()`, `fs.readFile()`, `JSON.parse()`
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING functionally, NOT CONNECTED (no internal callers)

**NOTE:** Line 567 checks for `app` directory to distinguish Next.js App Router vs Pages Router — this is a reasonable heuristic.

---

## SECTION 6: `executeResolveConflict()` — Conflict Resolution Engine

### Lines 580-713: `executeResolveConflict(step, baseDir, result)`
- **What this does:** Resolves conflicts using various strategies (rename, merge, overwrite, custom, ignore)
- **What triggers it:** `RESOLVE_CONFLICT` action in `executeMigrationPlan()`
- **What it calls:**
  - `executeStrategyChain()` (line 587) — if `step.strategyChain` exists
  - `computeConflictMetadata()` (line 591)
  - `performRecursiveMerge()` (line 625) — for 'merge' strategy
  - `generateCompatibilityAdapter()` (line 639) — fallback for failed merge
  - `executeSandboxedTransform()` (line 682) — for 'custom' strategy with `transformFn`
  - `escapeRegexStr()` (line 605)
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING

#### Resolution Strategies:

**RENAME (Lines 593-610):**
- Reads file, creates regex from `conflictId` last segment, appends `_external` to all matches
- **BUG (Line 604):** `const conflictItem = step.conflictId?.split('_').pop() || 'conflict'` — If `conflictId` contains no `_`, the entire ID is used as the rename target. This could rename unintended identifiers.

**MERGE (Lines 612-649):**
- Attempts recursive deep merge of two files
- Falls back to adapter generation if merge fails
- **Line 624:** `step.from` is treated as a FILE PATH to read, not content. If `step.from` is a string that's not a valid path, `fs.pathExists()` returns false and `sourceContent` becomes `''`.

**OVERWRITE (Lines 651-669):**
- Copies `step.from` file over the target file
- Creates backup before overwriting

**CUSTOM (Lines 671-704):**
- If `step.transformFn` exists, executes it in a sandboxed context
- Otherwise, generates a compatibility adapter
- **SECURITY (Line 682):** `executeSandboxedTransform()` uses `new Function()` — see security analysis below

**IGNORE (Lines 706-710):**
- Logs and skips

### Lines 720-753: `executeStrategyChain(step, baseDir, result)` (I-05 SOTA)
- **What this does:** Chains multiple resolution strategies with fallback — tries each in order
- **What triggers it:** Called by `executeResolveConflict()` when `step.strategyChain` exists
- **Status:** WORKING

**BUG (Line 730-731):** `if (condition && condition.when === 'on_failure' && i === 0) { continue; }` — This skips the FIRST strategy if its condition is `on_failure`. But `on_failure` should mean "only run this if the previous one failed", which doesn't apply to the first strategy. The logic is correct but the comment/intent is confusing — it should probably skip strategies with `on_failure` condition entirely when `i === 0`.

**BUG (Line 735):** `strategyChain: undefined` — Sets `strategyChain` to `undefined` to prevent recursion. But `executeResolveConflict()` checks `step.strategyChain && step.strategyChain.strategies.length > 0` at line 586. Since `undefined` is falsy, this correctly prevents recursion. However, if a step somehow has `strategyChain: { strategies: [] }` (empty array), the check at line 586 would be `false` (length 0), so it would also not recurse. This is safe.

### Lines 759-787: `performRecursiveMerge(targetContent, sourceContent, conflictId)` (I-05 SOTA)
- **What this does:** Attempts to merge two file contents — first tries object-level merge, falls back to line-level merge
- **What triggers it:** Called by `executeResolveConflict()` at line 625
- **What it calls:** `tryParseObjectLiteral()` (lines 771-772), `deepMergeObjects()` (line 775), `serializeObjectLiteral()` (line 776), `mergeByLines()` (line 781)
- **Status:** WORKING

#### Key Logic:
- **Lines 771-772:** Tries to parse both contents as JSON-like objects
- **Lines 773-777:** If both parse, does deep object merge
- **Lines 779-785:** Otherwise, does line-based merge (appends new lines from source)

**BUG (Line 777):** `result.merged = result.conflicts.length < Object.keys(sourceObj).length` — This considers the merge "successful" if the number of conflicts is less than the total keys in the source object. This is a heuristic, not a guarantee. A merge with 99 conflicts out of 100 keys would still be considered "successful".

### Lines 791-830: `deepMergeObjects(target, source, path, conflicts, provenance)` (I-05 SOTA)
- **What this does:** Recursively merges two objects, tracking conflicts and provenance
- **Status:** WORKING

#### Merge Rules:
- **Line 796-798:** New key from source → add it (provenance: 'source')
- **Lines 800-804:** Both are objects → recurse (provenance: 'merged')
- **Lines 806-816:** Both are arrays → concatenate unique values (provenance: 'merged')
- **Lines 818-820:** Same value → keep as-is (provenance: 'target')
- **Lines 822-827:** Different primitives → conflict, keep target (provenance: 'target')

**NOTE:** Line 808-814: Array deduplication uses `JSON.stringify()` comparison, which is order-sensitive. `[1,2]` and `[2,1]` would be considered different.

### Lines 834-851: `mergeByLines(targetContent, sourceContent, conflictId, conflicts)`
- **What this does:** Line-level merge — appends lines from source that don't exist in target
- **Status:** WORKING

**BUG (Line 839):** `const targetSet = new Set(targetLines.map(l => l.trim()))` — Uses trimmed lines for comparison. This means lines that differ only in whitespace are considered identical and would be skipped.

### Lines 857-899: `generateCompatibilityAdapter(step, targetContent, sourceContent)` (I-05 SOTA)
- **What this does:** Generates a TypeScript adapter file that bridges incompatible interfaces
- **What triggers it:** Called when recursive merge fails (line 639) or for 'custom' strategy without `transformFn` (line 694)
- **What it calls:** `extractExportNames()` (lines 863-864), `capitalize()` (line 878)
- **Status:** WORKING

#### Key Logic:
- **Lines 863-864:** Extracts export names from both target and source
- **Line 866:** Finds conflicting names (same export name in both)
- **Lines 870-882:** If conflicts found, generates adapter functions for each conflicting export
- **Lines 884-892:** If no conflicts, generates a generic adapter

**NOTE (Line 876):** Generated adapter code includes `TODO: Implement actual transformation logic` — the adapter is a stub, not a working solution.

### Lines 905-946: `executeSandboxedTransform(transformFnBody, content, context)` (I-05 SOTA)
- **What this does:** Executes user-defined transform function in a sandboxed context
- **What triggers it:** 'custom' conflict resolution with `step.transformFn` (line 682)
- **Status:** WORKING

#### Security Analysis (Lines 907-935):
```js
const sandboxedGlobals = {
    JSON, Math, String, Number, Array, Object, RegExp, Date,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent
};
const sandboxedFn = new Function('content', 'context', ...argNames, wrappedBody);
```

**SECURITY VULNERABILITY (Line 934):** Uses `new Function()` which is equivalent to `eval()`. The `transformFnBody` comes from the TOML migration plan file. While the sandbox restricts available globals, `new Function()` executes in the global scope and can:
1. Access `this` (which is `globalThis` in non-strict mode)
2. Access `arguments.callee`
3. Potentially escape the sandbox via constructor chain: `(function(){}).constructor('return this')()`

The "sandbox" only limits which globals are passed as parameters — it does NOT prevent access to the global object or arbitrary code execution. If an attacker can modify the migration plan TOML file, they can execute arbitrary code.

**Mitigation:** Use `vm.runInNewContext()` with a proper sandbox, or better yet, use a whitelist of allowed transform functions rather than executing arbitrary code.

### Lines 951-1015: `computeConflictMetadata(step, baseDir)` (I-05 SOTA)
- **What this does:** Computes metadata about a conflict: confidence score, impact assessment, affected dependents, risk level
- **What triggers it:** Called by `executeResolveConflict()` at line 591
- **Status:** WORKING

#### Key Logic:
- **Lines 955-961:** Confidence scores by strategy: rename=0.9, merge=0.6, overwrite=0.85, custom=0.5, ignore=1.0
- **Lines 963-969:** Impact assessment: overwrite=high, merge/merge=medium, others=low
- **Lines 971-999:** Scans sibling files for imports of the conflicting file to find affected dependents
- **Lines 1002-1007:** Risk level derived from confidence and impact

**BUG (Line 989):** `if (siblingContent.includes(baseName))` — This checks if ANY occurrence of the base name (without extension) appears in the sibling file. This would match comments, strings, or unrelated identifiers. A more accurate check would look for actual import statements.

### Lines 1016-1020: `executeRunCommand(step, _baseDir, _result)`
- **What this does:** Logs a warning that manual command execution is required
- **What triggers it:** `RUN_COMMAND` action
- **Status:** PARTIAL — Does NOT actually run the command. Only logs a message.

**GAP (Line 1018):** The `RUN_COMMAND` action is a no-op. It logs `⚠ Command step: ${step.command || 'no command specified'} (manual execution required)` but never executes anything. If the migration plan expects commands to run (e.g., `npm install`), the migration will silently skip them.

---

## SECTION 7: Utility Functions

### Lines 1022-1024: `escapeRegexStr(str)`
- **What this does:** Escapes special regex characters in a string
- **Status:** WORKING

### Lines 1029-1055: `tryParseObjectLiteral(content)`
- **What this does:** Attempts to parse content as a JSON or TypeScript object literal
- **Status:** WORKING

#### Key Logic:
- **Lines 1031-1037:** Try JSON.parse first
- **Lines 1039-1053:** Try to extract object literal from export/const patterns, then normalize to JSON
- **Line 1044:** `.replace(/(\w+)\s*:/g, '"$1":')` — Quotes unquoted keys

**BUG (Line 1044):** This regex would also match keys inside string values. For example: `{ greeting: "hello: world" }` would incorrectly quote the `:` inside the string. Also, it would match keys that are already quoted, resulting in `""key""`.

### Lines 1059-1075: `serializeObjectLiteral(obj, originalContent)`
- **What this does:** Serializes a merged object back to the original format (export default, const, etc.)
- **Status:** WORKING

### Lines 1079-1100: `extractExportNames(content)`
- **What this does:** Extracts exported names from TypeScript/JavaScript content using regex
- **Status:** WORKING

#### Patterns:
- `export function/class/const/let/var/enum/interface/type NAME`
- `export { name1, name2 }`
- `export default function/class NAME`

**BUG (Line 1091):** `const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim())` — For `export { foo as bar, baz }`, this correctly extracts `foo` and `baz` (the original names). But for `export { foo }`, it correctly extracts `foo`. However, for `export { default as foo }`, it would extract `default`, which is correct.

### Lines 1101-1103: `capitalize(str)`
- **What this does:** Capitalizes first letter of string
- **Status:** WORKING

---

## SECTION 8: Verification System

### Lines 1109-1162: `executeVerifyStep(baseDir, result)` (I-06)
- **What this does:** Post-migration verification — checks that backed-up files still exist, verifies imports resolve, checks brace balance
- **What triggers it:** `VERIFY` action in `executeMigrationPlan()`
- **Status:** WORKING

#### Key Logic:
- **Lines 1115-1119:** Checks that original files (pre-backup) still exist
- **Lines 1122-1149:** For TS/JS files, checks for unresolved imports and unbalanced braces
- **Line 1146:** `Math.abs(openBraces - closeBraces) > 2` — Only flags if imbalance is >2 (tolerance of 2)

**NOTE:** This verification is basic — it only checks backed-up files, not ALL files in the project.

### Lines 1168-1246: `verifyIntegration(currentProjectPath, outputDir)` (I-06 SOTA)
- **What this does:** Multi-level validation pipeline with 4 levels: syntax, import resolution, type checking, semantic compatibility
- **What triggers it:** External callers (exported function)
- **What it calls:**
  - `scanSourceFiles()` (line 1181)
  - `verifySyntax()` (line 1183)
  - `verifyImportResolution()` (line 1186)
  - `verifyTypeChecking()` (line 1189)
  - `verifySemanticCompatibility()` (line 1192)
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING functionally, NOT CONNECTED (no internal callers)

### Lines 1252-1317: `verifySyntax(files, projectPath)` (Level 1)
- **What this does:** Checks brace balance, parenthesis balance, and unterminated strings
- **Status:** WORKING

**BUG (Line 1262):** `if (Math.abs(openBraces - closeBraces) > 0)` — This flags ANY brace imbalance as an error/warning. But braces in strings, comments, and template literals are also counted. This would produce false positives for files containing JSON strings, regex patterns, or CSS-in-JS.

**BUG (Line 1293-1296):** The unterminated string check uses simple quote counting, which doesn't account for escaped quotes, template literals spanning multiple lines, or quotes inside comments.

### Lines 1321-1372: `verifyImportResolution(files, projectPath)` (Level 2)
- **What this does:** Verifies all relative imports resolve to actual files
- **Status:** WORKING

**NOTE (Line 1329):** Only checks relative imports (starting with `.`). Absolute imports (npm packages) are not checked.

### Lines 1376-1429: `verifyTypeChecking(projectPath)` (Level 3)
- **What this does:** Runs TypeScript compiler in check-only mode
- **What it calls:** `execSync('npx tsc --noEmit --pretty false 2>&1')` (line 1398)
- **Status:** WORKING

**SECURITY (Line 1398):** Uses `execSync()` to run `npx tsc`. While the command is hardcoded (not user-input), `npx` could execute malicious packages if the PATH is compromised. The 60-second timeout (line 1401) prevents hangs.

### Lines 1433-1497: `verifySemanticCompatibility(files, projectPath)` (Level 4)
- **What this does:** Verifies that named imports actually exist in their target files' exports
- **Status:** WORKING

**BUG (Line 1477):** `if (!targetExports.includes(name) && name !== 'default')` — Special-cases `default` exports but doesn't handle re-exports or namespace imports.

### Lines 1502-1554: Verification Helpers
- `parseTscOutput()` (lines 1502-1522): Parses TypeScript compiler error output
- `suggestImportFix()` (lines 1526-1536): Suggests fixes for unresolved imports
- `suggestTypeError()` (lines 1540-1554): Suggests fixes for TypeScript errors
- **Status:** All WORKING

### Lines 1558-1578: `scanSourceFiles(dir)`
- **What this does:** Recursively scans directory for .ts, .tsx, .js, .jsx, .vue files
- **What triggers it:** Called by `verifyIntegration()` at line 1181
- **Status:** WORKING

**NOTE (Line 1565):** Skips `node_modules` and `.git` directories. Does NOT skip other common directories like `dist`, `build`, `.next`, etc.

---

## SECTION 9: Rollback System

### Lines 1584-1651: `rollbackMigration(result, options)` (I-09 FIX)
- **What this does:** Restores files from `.integr8-backup` copies
- **What triggers it:** External callers when migration fails
- **What it calls:** `fs.pathExists()`, `fs.copy()`, `fs.remove()`
- **Dependencies:** `fs-extra`, `path`
- **Status:** WORKING functionally, NOT CONNECTED (no internal callers)

#### Key Logic:
- **Lines 1589-1597:** Restores all backed-up files from `result.backupPaths`
- **Lines 1599-1610:** Restores config files (package.json, tsconfig.json, .env, .env.local)
- **Lines 1613-1636:** Removes newly created files (reads from `.integr8-new-files.json` marker)
- **Lines 1638-1649:** Generates rollback manifest (not saved to file — only logged)

**NOTE (Line 1649):** The rollback manifest is only logged to console, not persisted to disk. This makes debugging rollback issues harder.

### Lines 1656-1703: `createPreMigrationSnapshot(baseDir, planId)` (I-09 Tier 3)
- **What this does:** Creates a full snapshot of config files with SHA-256 checksums before migration
- **What triggers it:** Called by `executeAtomicMigration()` at line 1712
- **What it calls:** `crypto.randomUUID()` or `Date.now().toString(36)` (line 1660), `crypto.createHash('sha256')` (line 1673), `fs.copy()`, `fs.writeFile()`
- **Dependencies:** `crypto` (Node.js built-in), `fs-extra`, `path`
- **Status:** WORKING

#### Key Logic:
- **Line 1660:** Generates unique snapshot ID using `crypto.randomUUID()` (Node 14.17+) or fallback to timestamp
- **Lines 1668-1683:** Snapshots config files: package.json, tsconfig.json, .env, .env.local, package-lock.json
- **Lines 1686-1694:** Snapshots SQLite database if it exists
- **Lines 1696-1701:** Saves snapshot manifest to `.integr8/snapshots/{id}.json`

**NOTE (Line 1668):** Only snapshots 5 config files. Does NOT snapshot source files that will be modified by the migration.

### Lines 1708-1728: `executeAtomicMigration(plan, options)` (I-09 Tier 3)
- **What this does:** All-or-nothing migration wrapper — creates snapshot, executes migration, rolls back on failure
- **What triggers it:** External callers
- **What it calls:** `createPreMigrationSnapshot()` (line 1712), `executeMigrationPlan()` (line 1714), `rollbackFromSnapshot()` (line 1718)
- **Status:** WORKING functionally, NOT CONNECTED (no internal callers)

#### Key Logic:
- **Line 1712:** Creates snapshot before migration
- **Line 1714:** Executes migration
- **Lines 1716-1724:** If migration failed AND not dry run, initiates automatic rollback from snapshot
- **Line 1719:** Logs rollback success
- **Line 1723:** Logs rollback errors

**BUG (Line 1716):** `if (!result.success && !options.dryRun)` — The rollback is triggered on failure. But `executeMigrationPlan()` already calls step executors that create their own backups (`.integr8-backup` files). The snapshot rollback (`rollbackFromSnapshot`) only restores the 5 config files, NOT the source files modified by step executors. So the "atomic" rollback is incomplete — source file changes are NOT rolled back.

### Lines 1732-1802: `rollbackFromSnapshot(snapshot)` (I-09 Tier 3)
- **What this does:** Restores files from a snapshot with checksum verification
- **What triggers it:** Called by `executeAtomicMigration()` at line 1718, `rollbackToLatest()` at line 1834
- **Status:** WORKING

#### Key Logic:
- **Lines 1743-1758:** Restores all snapshotted files
- **Lines 1760-1776:** Restores database
- **Lines 1778-1793:** Verifies rollback by checking SHA-256 checksums
- **Lines 1795-1798:** Cleans up snapshot manifest

**BUG (Line 1795-1798):** The snapshot manifest is REMOVED after rollback. This means there's no audit trail of what was rolled back. The manifest should be preserved (perhaps renamed) for debugging.

### Lines 1806-1824: `listAvailableSnapshots(baseDir)` (I-09 Tier 3)
- **What this does:** Lists all available snapshots sorted by timestamp (newest first)
- **Status:** WORKING

### Lines 1828-1836: `rollbackToLatest(baseDir)` (I-09 Tier 3)
- **What this does:** Convenience function — rolls back to the most recent snapshot
- **What it calls:** `listAvailableSnapshots()` (line 1830), `rollbackFromSnapshot()` (line 1834)
- **Status:** WORKING

---

## SECTION 10: Source Map Reference

### Line 1837: `//# sourceMappingURL=migrationExecutor.js.map`
- **Status:** Reference only

---

## CONNECTION MAP

### What triggers migration execution?
- **NOTHING in the codebase.** `migrationExecutor.js` is a dead module. No file imports from it.
- The `index.js` orchestrator (`lib/commands/integr8/index.js`) generates migration plans but does NOT execute them.

### What other files get called?
| Function | Calls | File |
|----------|-------|------|
| `loadMigrationPlan()` | `parseMigrationPlanFromToml()` | `tomlSerializer.js:6` |
| `executeMigrationPlan()` | All step executors | Internal |
| `executeRewriteImport()` | `buildPathResolutionContext()`, `validateImportRewritePath()` | Internal |
| `executeMergeRoute()` | `detectRouterFormat()` → `detectRouterFramework()` | Internal |
| `executeResolveConflict()` | `executeStrategyChain()`, `performRecursiveMerge()`, `generateCompatibilityAdapter()`, `executeSandboxedTransform()` | Internal |
| `verifyIntegration()` | `scanSourceFiles()`, `verifySyntax()`, `verifyImportResolution()`, `verifyTypeChecking()`, `verifySemanticCompatibility()` | Internal |
| `verifyTypeChecking()` | `execSync('npx tsc --noEmit')` | External (TypeScript compiler) |
| `createPreMigrationSnapshot()` | `crypto.randomUUID()`, `crypto.createHash()` | Node.js `crypto` |
| `rollbackFromSnapshot()` | `crypto.createHash()` | Node.js `crypto` |

### How does rollback work?
1. **Backup-based rollback** (`rollbackMigration()`): Restores `.integr8-backup` files
2. **Snapshot-based rollback** (`rollbackFromSnapshot()`): Restores config files from `.integr8/snapshots/` with checksum verification
3. **Atomic rollback** (`executeAtomicMigration()`): Creates snapshot → executes → rolls back from snapshot on failure

---

## @@@ SYMBOLS

No `@@@` symbols found in this file.

---

## SECURITY VULNERABILITIES

### CRITICAL: Arbitrary Code Execution via `new Function()` (Line 934)
- **Location:** `executeSandboxedTransform()` at line 934
- **Risk:** The `transformFnBody` parameter comes from TOML migration plan files. An attacker who can modify the plan file can execute arbitrary JavaScript.
- **Mitigation:** Replace `new Function()` with `vm.runInNewContext()` or use a whitelist of allowed transforms.

### HIGH: Command Injection via `execSync()` (Line 1398)
- **Location:** `verifyTypeChecking()` at line 1398
- **Risk:** While the command is hardcoded, `npx` resolves packages from the PATH. A compromised PATH could lead to malicious package execution.
- **Mitigation:** Use absolute path to `tsc` or validate the TypeScript installation before running.

---

## SUMMARY OF ALL BUGS

| # | Line | Severity | Description |
|---|------|----------|-------------|
| 1 | 133-134 | Medium | `executeCopyFile()` — No validation that `step.from` is provided; could copy entire directory |
| 2 | 338 | Low | `resolvePackageExport()` — Incorrect handling of bare package names without `/` |
| 3 | 367 | Medium | `executeMergeRoute()` — `lastIndexOf(']')` finds wrong bracket if other arrays exist |
| 4 | 400 | Medium | `executeMergeRoute()` — `lastIndexOf('export')` finds wrong export if multiple exist |
| 5 | 604 | Low | `executeResolveConflict()` RENAME — `conflictId.split('_').pop()` may rename wrong identifier |
| 6 | 777 | Low | `performRecursiveMerge()` — Merge "success" threshold is too lenient |
| 7 | 839 | Low | `mergeByLines()` — Trimmed line comparison loses whitespace differences |
| 8 | 989 | Low | `computeConflictMetadata()` — `includes(baseName)` matches comments/strings, not just imports |
| 9 | 1018 | High | `executeRunCommand()` — Command execution is a no-op; only logs |
| 10 | 1044 | Low | `tryParseObjectLiteral()` — Regex for quoting keys also matches inside strings |
| 11 | 1262 | Low | `verifySyntax()` — Counts braces in strings/comments, causing false positives |
| 12 | 1716 | High | `executeAtomicMigration()` — Snapshot rollback only restores config files, not source files |
| 13 | 1795-1798 | Low | `rollbackFromSnapshot()` — Deletes snapshot manifest, losing audit trail |

---

## NOT CONNECTED FUNCTIONS (Orphaned Exports)

All 11 exported functions are NOT imported by any file in the codebase:
1. `loadMigrationPlan()` — line 64
2. `executeMigrationPlan()` — line 73
3. `detectRouterFramework()` — line 452
4. `detectFrameworkFromPackageJson()` — line 556
5. `verifyIntegration()` — line 1168
6. `rollbackMigration()` — line 1584
7. `createPreMigrationSnapshot()` — line 1656
8. `executeAtomicMigration()` — line 1708
9. `rollbackFromSnapshot()` — line 1732
10. `listAvailableSnapshots()` — line 1806
11. `rollbackToLatest()` — line 1828

**This entire module appears to be dead code.** It implements migration execution functionality, but the main orchestrator (`index.js`) only generates migration plans — it never executes them.
