# DETAILED LINE-BY-LINE REPORT: `lib/utils/astParser.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/utils/astParser.js`
**Total Lines:** 1066
**Source:** Compiled from `src/utils/astParser.ts` (TypeScript → JavaScript, Babel helpers generated)
**Status:** PARTIAL — Core AST parsing works, but several internal helper functions are dead code or have correctness gaps.

---

## SECTION 1: FILE HEADER & STRICT MODE (Lines 1-4)

```
Lines 1-4: File header and strict mode declaration
- What triggers it: Module load time
- What it calls: Nothing
- What calls it: Node.js runtime on `require()`
- Dependencies: None
- Status: WORKING
- Gap: None
```

**Notes:**
- Line 1: `"use strict"` — enforced strict mode, correct for CommonJS.
- Line 2: Comment `// src/utils/astParser.ts` — reveals this is compiled TypeScript output.
- Lines 3-4: Comments referencing `@babel/parser` and fixing issues `I-02, I-03, I-10, I-12`. These are issue tracker references from the st8 project.

---

## SECTION 2: TYPESCRIPT COMPILE HELPERS (Lines 5-37)

```
Lines 5-37: TypeScript __createBinding, __setModuleDefault, __importStar helper functions
- What triggers it: Module load time (hoisted function declarations, self-executing initializers)
- What it calls: Object.create, Object.defineProperty, Object.getOwnPropertyNames
- What calls it: Lines 42-43 (fs and path imports)
- Dependencies: None (standard ES polyfills)
- Status: WORKING
- Gap: None — standard TypeScript emit for `import * as` syntax
```

**Notes:**
- `__createBinding` (lines 5-15): Creates property descriptors to re-export module properties without copying the value.
- `__setModuleDefault` (lines 16-20): Sets a `.default` property on the module wrapper.
- `__importStar` (lines 21-37): Star-import helper — wraps a CommonJS module to expose all named exports as properties.
- These are **auto-generated** by TypeScript compiler when `esModuleInterop` or `importHelpers` is enabled. Not hand-written code.

---

## SECTION 3: MODULE EXPORTS REGISTRATION (Lines 38-40)

```
Lines 38-40: Public API registration — exports.__esModule, exports.extractImportsAndExports, exports.extractFromText
- What triggers it: Module load time
- What it calls: Nothing
- What calls it: Callers via destructured require: `const { extractImportsAndExports } = require(...)`
- Dependencies: None
- Status: WORKING
- Gap: Only 2 of ~25 internal functions are exported. extractCommonJSExportsFromAST, resolveExportStar, traceReexportChain, detectPurity, computeComplexity, extractJsDocTags are all internal-only.
```

**Notes:**
- Line 38: `exports.__esModule = { value: true }` — marks this as a TypeScript-compiled module.
- Line 39: `exports.extractImportsAndExports = extractImportsAndExports` — **PRIMARY PUBLIC API**
- Line 40: `exports.extractFromText = extractFromText` — **SECONDARY PUBLIC API** (regex-only, no AST)

---

## SECTION 4: IMPORTS / DEPENDENCIES (Lines 41-43)

```
Lines 41-43: External dependency imports
- What triggers it: Module load time (synchronous require)
- What it calls: Node.js module resolution
- What calls it: Module initialization
- Dependencies: @babel/parser, fs, path
- Status: WORKING
- Gap: None
```

**Line-by-line:**
- **Line 41:** `const parser_1 = require("@babel/parser")` — **@babel/parser** is installed at `/home/bozertron/1_AT_A_TIME/st8/node_modules/@babel/parser/package.json` (confirmed present). This is the AST parser engine.
- **Line 42:** `const fs = __importStar(require("fs"))` — Node.js filesystem module.
- **Line 43:** `const path = __importStar(require("path"))` — Node.js path module.

---

## SECTION 5: `extractCommonJSExportsFromAST()` (Lines 48-139)

```
Lines 48-139: extractCommonJSExportsFromAST(ast, content, filePath) — INTERNAL, NOT EXPORTED
- What triggers it: Called once at line 301 inside extractImportsAndExports()
- What it calls: walkNode() (recursive, internal), recursive AST traversal
- What calls it: extractImportsAndExports() at line 301
- Dependencies: Babel AST node structure
- Status: WORKING — but has a subtle gap
- Gap: The `content` parameter (line 48) is accepted but NEVER USED. It was likely intended for source-level fallback but the function only operates on the AST.
```

**Detailed breakdown:**

**Lines 48-50: Function signature and initialization**
- `exports = []` — accumulates detected exports
- `seen = Set` — deduplication by export name

**Lines 52-135: `walkNode(node)` — recursive AST walker**
- **Lines 56-85: `module.exports = { ... }` detection**
  - Lines 56-59: Checks for `AssignmentExpression` where left side is `module.exports`.
  - Lines 61-74: If right side is `ObjectExpression`, iterates properties and extracts each key name. Each gets `kind: 'variable'`, `exportVisibility: 'named'`.
  - Lines 75-84: If right side is `Identifier` (e.g., `module.exports = myObj`), records it as `kind: 'default'`, `exportVisibility: 'default'`.
  - **⚠️ GAP (line 75):** When `module.exports = someIdentifier`, this records the identifier name, not `'default'`. The name is the variable being assigned, which may not be the intended export name for consumers.

- **Lines 88-102: `exports.foo = ...` detection**
  - Lines 88-90: Checks for `exports.foo` pattern (non-computed MemberExpression on `exports`).
  - Line 91: Also handles `exports['foo']` via `computed && property.value`.
  - Records as `kind: 'variable'`, `exportVisibility: 'named'`.

- **Lines 105-121: `module.exports.foo = ...` detection**
  - Lines 105-109: Checks for chained member expression: `module.exports.foo`.
  - Line 110: Also handles `module.exports['foo']`.
  - **⚠️ NOTE:** This and lines 88-102 overlap when code does `module.exports.foo = ...` — both conditions could theoretically match on different parts of the AST, but the AST structure prevents double-matching since the `object` type differs (`Identifier` vs `MemberExpression`).

- **Lines 124-134: Recursive child traversal**
  - Line 125: Skips `loc`, `start`, `end`, `leadingComments`, `trailingComments` (non-AST properties).
  - Lines 127-133: Recurses into arrays and objects.

- **Line 137: Entry point** — `walkNode(ast.program)` — starts traversal from the program root.

**Status: WORKING** — Correctly detects CommonJS export patterns from AST.

---

## SECTION 6: `extractImportsAndExports()` — MAIN FUNCTION (Lines 147-312)

```
Lines 147-312: extractImportsAndExports(filePath) — PRIMARY PUBLIC API
- What triggers it: Called from 4 locations:
  1. backend/index.js:303 (file watcher 'add' event)
  2. backend/index.js:355 (file watcher 'change' event)
  3. backend/schemaCardEmitter.js:92 (emitAllCards)
  4. lib/commands/integr8/dataIngestion.js:965 (full codebase analysis)
  5. backend/indexer.js:218 (parseImports)
- What it calls: fs.readFileSync (line 157), extractScriptFromVue (line 164), parser_1.parse (line 167), parseImportDeclaration (line 183), resolveModulePath (line 195), resolveExportStar (line 197), parseExportDeclaration (line 262), parseDefaultExport (line 279), extractDynamicImportsFromAST (line 295), extractRequireStatements (line 298), extractCommonJSExportsFromAST (line 301), extractImportsViaRegex (line 308), extractExportsViaRegex (line 309)
- What calls it: 5 external call sites (see above)
- Dependencies: @babel/parser, fs, path
- Status: WORKING with gaps
- Gap 1: Lines 163-165 — Vue script extraction happens BEFORE AST parse, but the `content` variable is reassigned. If the .vue file has no <script> block, extractScriptFromVue returns the raw content, which will likely fail AST parsing.
- Gap 2: Lines 167-179 — errorRecovery:true means partial AST on syntax errors, which may produce incomplete results silently.
- Gap 3: Lines 304-310 — The catch block silently falls back to regex without logging. Callers have no way to know results came from regex fallback vs. AST.
- Gap 4: Lines 297-299 — extractRequireStatements is called AFTER the AST loop. This means require() calls are found via regex even though the AST was already parsed. This is redundant with the AST walk but necessary because the AST walker doesn't handle require() expressions.
```

**Detailed line-by-line:**

**Lines 147-154: Result initialization**
- `imports: []`, `exports: []`, `exportStars: []`, `hasErrors: false`

**Lines 155-161: File read with error handling**
- `fs.readFileSync(filePath, 'utf-8')` — synchronous file read
- On error: returns `{ imports: [], exports: [], exportStars: [], hasErrors: true, errorMessage: ... }`
- **⚠️ NOTE:** Error shape includes `errorMessage` field that isn't in the success type definition.

**Lines 162-165: Vue SFC handling**
- If file ends with `.vue`, calls `extractScriptFromVue(content)` which extracts `<script>` and `<script setup>` blocks.
- **⚠️ BUG RISK:** If a `.vue` file has only `<template>` and `<style>` (no `<script>`), `extractScriptFromVue` returns the raw file content, which will fail Babel parsing since it contains HTML.

**Lines 166-179: Babel AST parsing**
- `sourceType: 'module'` — enables ESM syntax parsing.
- **Plugins list (lines 169-176):** typescript, jsx, decorators-legacy, classProperties, optionalChaining, nullishCoalescingOperator, dynamicImport.
  - **⚠️ GAP:** `dynamicImport` plugin is listed but this is a Stage 4 proposal that may not be needed in newer Babel versions. Could produce deprecation warnings.
- **Line 178:** `errorRecovery: true` — **CRITICAL BEHAVIOR:** Parse errors don't throw; they produce an AST with an `errors` array. This means the function silently produces partial results on syntax errors.

**Lines 180-293: AST node iteration — ESM export/import handling**
- **Line 181:** Iterates `ast.program.body` — only top-level statements. This misses nested exports (unlikely but possible with `export default` inside a block).

- **Lines 182-186: Import declarations**
  - Delegates to `parseImportDeclaration(node)` (line 183).

- **Lines 187-221: `export * from './module'` (ExportAllDeclaration)**
  - Line 195: Calls `resolveModulePath(filePath, starSource)` to resolve the target file.
  - Line 197: Calls `resolveExportStar(resolvedPath)` to recursively extract all exports from the target.
  - Lines 200-211: Creates individual export entries for each resolved export, with `exportVisibility: 'star'`.
  - Lines 215-220: Also records the star-export as an import dependency (namespace import).
  - **⚠️ NOTE:** This creates BOTH exports AND imports for the same star-export, which is correct for dependency graph building.

- **Lines 222-258: Re-exports with chain tracking (`export { x } from './y'`)**
  - Lines 225-237: Creates an import record for the re-export source.
  - Lines 239-258: For each specifier, traces the re-export chain back to origin via `traceReexportChain()`.
  - **⚠️ PERFORMANCE NOTE:** `traceReexportChain` reads and parses files from disk. For large codebases with deep re-export chains, this could be slow. The depth limit of 5 (line 881) prevents infinite loops but doesn't cap total work.

- **Lines 261-264: Named export declarations (export function/class/const)**
  - Delegates to `parseExportDeclaration()` (line 262).

- **Lines 265-276: Named exports without declaration (`export { a, b }`)**
  - Lines 267-275: Iterates specifiers, creates export entries.

- **Lines 278-282: Default export**
  - Delegates to `parseDefaultExport()` (line 279).

- **Lines 284-292: TypeScript `export =` (TSExportAssignment)**
  - Creates a default export entry.

**Lines 294-302: Post-AST extraction**
- **Line 295:** `extractDynamicImportsFromAST(ast, content)` — walks AST for `import()` calls.
- **Line 298:** `extractRequireStatements(content)` — regex-based `require()` detection. **⚠️ NOTE:** This is regex-based even though the AST is available. The AST walker doesn't handle `CallExpression` with `require` callee.
- **Line 301:** `extractCommonJSExportsFromAST(ast, content, filePath)` — CJS export detection from AST.

**Lines 304-310: Error fallback**
- On AST parse failure: sets `hasErrors: true`, falls back to regex extraction.
- **⚠️ GAP:** No distinction between "AST failed, regex used" and "AST succeeded with errors" (errorRecovery mode).

---

## SECTION 7: `extractFromText()` (Lines 317-322)

```
Lines 317-322: extractFromText(text, projectPath) — SECONDARY PUBLIC API
- What triggers it: 
  1. lib/commands/integr8/dataIngestion.js:602 (parseImportsFromText)
  2. backend/indexer.js:224 (parseImports fallback)
- What it calls: extractImportsViaRegex(text) (line 319), extractExportsViaRegex(text, projectPath) (line 320)
- What calls it: 2 external call sites
- Dependencies: None (regex-only)
- Status: WORKING
- Gap: This function does NOT use AST parsing at all — it's pure regex. Callers using this get weaker detection than extractImportsAndExports(). The function name is misleading ("extractFromText" suggests AST parsing but it's regex).
```

**Notes:**
- Line 319: Passes raw text to regex import extractor.
- Line 320: `projectPath` is passed as `filePath` to `extractExportsViaRegex` — this means `sourceFile` in export results will be the project path, not the actual file being analyzed. **⚠️ BUG:** When called from `dataIngestion.js:602`, the second argument is `projectPath` (the root directory), not the specific file path.

---

## SECTION 8: `parseImportDeclaration()` (Lines 324-357)

```
Lines 324-357: parseImportDeclaration(node) — INTERNAL HELPER
- What triggers it: extractImportsAndExports() line 183
- What it calls: Nothing (reads AST node properties)
- What calls it: extractImportsAndExports()
- Dependencies: None
- Status: WORKING
- Gap: None — handles all import specifier types correctly
```

**Detailed:**
- **Line 326-328:** Returns null if no source value (malformed import).
- **Lines 331-333:** Empty specifiers = `importType: 'side-effect'` (e.g., `import './polyfill'`).
- **Lines 336-338:** `ImportDefaultSpecifier` → `importType: 'default'`, tracks `isType` from `importKind`.
- **Lines 340-342:** `ImportNamespaceSpecifier` → `importType: 'namespace'`.
- **Lines 344-353:** `ImportSpecifier` → named import. Tracks alias if local name differs from imported name. Preserves `isType` from both specifier-level and declaration-level `importKind`.

---

## SECTION 9: `parseExportDeclaration()` (Lines 358-480)

```
Lines 358-480: parseExportDeclaration(declaration, filePath, line, sourceContent) — INTERNAL HELPER
- What triggers it: extractImportsAndExports() line 262
- What it calls: extractParamTypes (line 365), computeComplexity (line 367), detectPurity (line 369), extractJsDocTags (line 370), buildFunctionSignature (line 374), extractReturnType (line 375), extractTypeParams (line 377), buildArrowSignature (line 416)
- What calls it: extractImportsAndExports()
- Dependencies: Multiple internal helpers
- Status: WORKING
- Gap: The complexity/purity/JSDoc metadata enrichments (lines 365-384, 407-438) are computed but the callers (backend/index.js, schemaCardEmitter.js) don't use these fields — they only use name, kind, and sourceFile.
```

**Detailed by declaration type:**

- **Lines 362-387: FunctionDeclaration / TSDeclareFunction**
  - Extracts: name, kind='function', signature, returnType, paramCount, typeParams, paramTypes, isPure, complexity, jsdocTags.
  - **⚠️ NOTE:** `TSDeclareFunction` (ambient declarations) gets full metadata treatment, but these have no body — `detectPurity` and `computeComplexity` will behave strangely on them.

- **Lines 388-400: ClassDeclaration**
  - Extracts: name, kind='class', jsdocTags.

- **Lines 401-442: VariableDeclaration**
  - Lines 406-428: If init is `ArrowFunctionExpression` or `FunctionExpression`, treats as function export with full metadata.
  - Lines 429-439: Otherwise, exports as kind='const' or 'variable'.
  - **⚠️ NOTE:** Uses `declaration.kind === 'const'` (line 404) to distinguish const from var/let.

- **Lines 443-454: TSTypeAliasDeclaration**
  - kind='type', includes typeParams.

- **Lines 455-466: TSInterfaceDeclaration**
  - kind='interface', includes typeParams.

- **Lines 467-477: TSEnumDeclaration**
  - kind='enum'.

---

## SECTION 10: `parseDefaultExport()` (Lines 481-520)

```
Lines 481-520: parseDefaultExport(node, filePath, sourceContent) — INTERNAL HELPER
- What triggers it: extractImportsAndExports() line 279
- What it calls: extractParamTypes, computeComplexity, detectPurity, buildFunctionSignature, extractReturnType
- What calls it: extractImportsAndExports()
- Dependencies: Internal helpers
- Status: WORKING
- Gap: Line 491 — name defaults to 'default' if function has no id. Anonymous default export functions always get name='default'.
```

**Detailed:**
- **Lines 486-503:** Function/Arrow function default export — full metadata.
- **Lines 504-512:** Class default export — minimal metadata.
- **Lines 513-519:** Fallback for expression exports (e.g., `export default 42`).

---

## SECTION 11: SIGNATURE BUILDERS (Lines 521-586)

```
Lines 521-586: Function signature string builders and type annotation converters
- What triggers it: parseExportDeclaration (lines 374, 416), parseDefaultExport (line 493)
- What it calls: paramToString, typeAnnotationToString, extractReturnType
- What calls it: parseExportDeclaration, parseDefaultExport
- Dependencies: None
- Status: WORKING
- Gap: These produce human-readable signatures but the field is stored as `signature` in export objects. No callers in backend/ or schemaCardEmitter.js appear to use the `signature` field.
```

**`buildFunctionSignature` (lines 522-528):**
- Constructs `"name(param1: type, param2: type): returnType"` string.
- Falls back to `'anonymous'` for unnamed functions.

**`buildArrowSignature` (lines 529-538):**
- Same pattern but for variable declarations containing arrow functions.

**`paramToString` (lines 539-559):**
- **Identifier:** `"name: typeName"` (defaults to `'any'` if no type annotation).
- **AssignmentPattern:** `"name?"` (optional param).
- **RestElement:** `"...name"`.
- **ObjectPattern / ArrayPattern:** `'{ ... }'` / `'[ ... ]'` (destructuring — doesn't extract individual property types).

**`typeAnnotationToString` (lines 560-586):**
- Maps TS keyword types to string names.
- **Line 576:** `TSTypeReference` uses `typeName.name` — handles custom types.
- **Line 578:** `TSArrayType` — recursive: `"Type[]"`.
- **Line 580:** `TSUnionType` — joins with `" | "`.
- **Line 582:** `TSFunctionType` — returns generic `'Function'`.
- **⚠️ GAP:** Missing `TSIntersectionType`, `TSTupleType`, `TSLiteralType`, `TSConditionalType`, `TSIndexedAccess` — these all return `'unknown'`.

---

## SECTION 12: `extractReturnType()` and `extractTypeParams()` (Lines 587-600)

```
Lines 587-600: Return type and type parameter extraction
- What triggers it: buildFunctionSignature, parseExportDeclaration, parseDefaultExport
- What it calls: typeAnnotationToString
- What calls it: Multiple export parsing functions
- Dependencies: None
- Status: WORKING
- Gap: extractTypeParams (line 599) falls back to 'T' for unnamed type params — this is a best-effort guess.
```

---

## SECTION 13: `extractDynamicImportsFromAST()` (Lines 606-674)

```
Lines 606-674: extractDynamicImportsFromAST(ast, content) — INTERNAL
- What triggers it: extractImportsAndExports() line 295
- What it calls: Recursive AST walk + regex fallback (lines 660-672)
- What calls it: extractImportsAndExports()
- Dependencies: None
- Status: WORKING
- Gap 1: Line 616 — only detects StringLiteral arguments to import(). Dynamic imports with variable args (import(path)) are silently ignored.
- Gap 2: Lines 626-639 — Template literals with expressions (import(`./dir/${file}`)) are also ignored (only quasis.length === 1 is handled).
- Gap 3: Lines 660-672 — Regex fallback after AST walk finds the same patterns. This is defensive but the regex doesn't track `line` numbers (missing from the push at line 665).
```

**Detailed:**
- **Lines 614-625:** `import('literal')` — detects `StringLiteral` first argument.
- **Lines 626-639:** `` import(`template`) `` — detects `TemplateLiteral` with exactly one quasi (no interpolations).
- **Lines 642-656:** Recursive child traversal (same pattern as extractCommonJSExportsFromAST).
- **Lines 660-672:** Regex fallback catches `import('...')` patterns missed by AST.
  - **⚠️ NOTE:** Regex fallback entries (line 665) lack `line` field, while AST-derived entries have it. This creates inconsistent objects.

---

## SECTION 14: `extractDynamicImportsViaRegex()` (Lines 678-691)

```
Lines 678-691: extractDynamicImportsViaRegex(content) — INTERNAL
- What triggers it: extractImportsViaRegex() line 719
- What it calls: Regex exec
- What calls it: extractImportsViaRegex()
- Dependencies: None
- Status: WORKING
- Gap: Line 690 — missing `line` field in returned objects. Dynamic imports found via this path have no line number metadata.
```

---

## SECTION 15: `extractRequireStatements()` (Lines 692-704)

```
Lines 692-704: extractRequireStatements(content) — INTERNAL
- What triggers it: extractImportsAndExports() line 298
- What it calls: Regex exec
- What calls it: extractImportsAndExports()
- Dependencies: None
- Status: WORKING with gaps
- Gap 1: Regex only matches `const/let/var { ... } = require('...')` and `const/let/var x = require('...')`. Misses: bare require() calls (require('fs')), require() inside expressions, require() with template literals.
- Gap 2: Line 702 — no `line` number tracking. All require imports have no line metadata.
- Gap 3: Line 700 — importType is always 'require' regardless of destructuring pattern.
```

**Regex breakdown (line 694):**
```
/(?:const|let|var)\s+(?:\{[^}]+\}|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g
```
- Matches: `const foo = require('bar')` or `const { a, b } = require('bar')`
- Does NOT match: `require('bar')` standalone, `x = require('bar')` without const/let/var

---

## SECTION 16: `extractImportsViaRegex()` (Lines 705-732)

```
Lines 705-732: extractImportsViaRegex(content) — INTERNAL FALLBACK
- What triggers it: extractImportsAndExports() line 308 (error fallback), extractFromText() line 319
- What it calls: extractDynamicImportsViaRegex (line 719), extractRequireStatements (line 721)
- What calls it: extractImportsAndExports (on AST failure), extractFromText
- Dependencies: Internal regex helpers
- Status: WORKING
- Gap: The importFromRegex (line 709) is extremely complex regex that may produce false positives on comments or strings containing import-like syntax. No comment/string stripping before regex.
```

**Regex breakdown (line 709):**
```
/import\s+(?:(?:type\s+)?(?:\{[^}]*\}|[a-zA-Z_$][a-zA-Z0-9_$]*|\*\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*,\s*(?:\{[^}]*\}|[a-zA-Z_$][a-zA-Z0-9_$]*|\*\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*))*\s+from\s+)?['"]([^'"]+)['"]/g
```
- Matches: `import foo from 'bar'`, `import { a, b } from 'bar'`, `import * as x from 'bar'`, `import 'bar'` (side-effect)
- Also handles `import type { Foo } from 'bar'` (TypeScript type imports)

**Line 723:** Re-export regex: `export \{...\} from '...'`

---

## SECTION 17: `extractExportsViaRegex()` (Lines 733-755)

```
Lines 733-755: extractExportsViaRegex(content, filePath) — INTERNAL FALLBACK
- What triggers it: extractImportsAndExports() line 309, extractFromText() line 320
- What it calls: Regex exec
- What calls it: extractImportsAndExports (on AST failure), extractFromText
- Dependencies: None
- Status: WORKING with gaps
- Gap 1: Regex on line 737 doesn't handle `export default class` or `export default function` — the `(?:default\s+)?` is there but the regex group captures the keyword AFTER default, not the default itself.
- Gap 2: No `export * from '...'` detection in regex fallback. Star exports are completely missed.
- Gap 3: No `line` number in export results from regex.
```

---

## SECTION 18: `extractScriptFromVue()` (Lines 762-779)

```
Lines 762-779: extractScriptFromVue(content) — INTERNAL
- What triggers it: extractImportsAndExports() line 164, resolveExportStar() line 817, traceReexportChain() line 887
- What it calls: Regex match
- What calls it: 3 call sites (see above)
- Dependencies: None
- Status: WORKING with a gap
- Gap: Line 765 — `<script setup>` regex uses non-greedy `*?` which is correct. But if there are multiple `<script>` blocks (possible in Vue 3), only the FIRST regular script block is captured per iteration. The `while` loop (line 772) handles this correctly.
- GAP: Line 778 — If NO script blocks found, returns raw HTML content. This will fail AST parsing with Babel. Should return empty string or throw.
```

---

## SECTION 19: `resolveModulePath()` (Lines 785-804)

```
Lines 785-804: resolveModulePath(importerPath, modulePath) — INTERNAL
- What triggers it: extractImportsAndExports() lines 195, 243; resolveExportStar() line 862; traceReexportChain() lines 901, 912
- What it calls: path.dirname, path.resolve, fs.existsSync, fs.statSync
- What calls it: 5 call sites
- Dependencies: fs, path
- Status: WORKING
- Gap 1: Lines 793-794 — fs.statSync on a file that might be a directory could throw. Only existsSync is checked, not isFile() for the initial basePath.
- Gap 2: Line 791 — Extension list doesn't include `.mts`, `.cts` (newer TS extensions).
- Gap 3: No handling of `package.json` `exports` field or `main` field for non-relative paths (line 787 returns undefined for non-relative).
```

---

## SECTION 20: `resolveExportStar()` (Lines 809-874)

```
Lines 809-874: resolveExportStar(filePath, depth = 0) — INTERNAL
- What triggers it: extractImportsAndExports() line 197, resolveExportStar() recursive at line 864, traceReexportChain() line 914
- What it calls: fs.readFileSync, extractScriptFromVue, parser_1.parse, resolveModulePath, resolveExportStar (recursive)
- What calls it: extractImportsAndExports, itself (recursive), traceReexportChain
- Dependencies: @babel/parser, fs
- Status: WORKING
- Gap 1: Line 811 — depth > 3 stops recursion. But each call reads and parses a file from disk. A re-export chain of 3 levels means up to 3 file reads + parses per star export.
- Gap 2: Lines 819-823 — Parser options here (line 821) are a SUBSET of those in extractImportsAndExports (line 169). Missing: optionalChaining, nullishCoalescingOperator. This could cause parse failures on files using those features.
- Gap 3: Line 871 — catch block swallows ALL errors silently, returns empty array. File not found, permission errors, parse errors — all silently produce [].
```

---

## SECTION 21: `traceReexportChain()` (Lines 879-928)

```
Lines 879-928: traceReexportChain(filePath, exportName, depth = 0) — INTERNAL
- What triggers it: extractImportsAndExports() line 245, traceReexportChain() recursive at lines 903, 916
- What it calls: fs.readFileSync, extractScriptFromVue, parser_1.parse, resolveModulePath, resolveExportStar, traceReexportChain (recursive)
- What calls it: extractImportsAndExports, itself (recursive)
- Dependencies: @babel/parser, fs
- Status: WORKING
- Gap 1: Line 881 — depth > 5 stops recursion (higher than resolveExportStar's 3).
- Gap 2: Lines 889-893 — Same parser option subset issue as resolveExportStar (missing optionalChaining, nullishCoalescingOperator).
- Gap 3: Line 903 — When tracing `local || exportName`, if `local` is undefined, it uses `exportName`. But the re-export may have aliased the name, so tracing by the original local name might be wrong.
- Gap 4: Lines 911-919 — Star export resolution inside traceReexportChain calls resolveExportStar which itself may call traceReexportChain. This creates potential for circular calls despite depth limits.
```

---

## SECTION 22: `extractParamTypes()` (Lines 933-942)

```
Lines 933-942: extractParamTypes(node) — INTERNAL
- What triggers it: parseExportDeclaration lines 365, 407; parseDefaultExport line 487
- What it calls: paramToString
- What calls it: parseExportDeclaration, parseDefaultExport
- Dependencies: paramToString
- Status: WORKING
- Gap: None
```

---

## SECTION 23: `detectPurity()` (Lines 950-969)

```
Lines 950-969: detectPurity(node) — INTERNAL
- What triggers it: parseExportDeclaration lines 369, 411; parseDefaultExport line 489
- What it calls: JSON.stringify
- What calls it: parseExportDeclaration, parseDefaultExport
- Dependencies: None
- Status: WORKING but imprecise
- Gap 1: Line 953 — JSON.stringify of the entire AST body for pattern matching is BRUTE FORCE. It serializes the entire function body to JSON and does string-include checks. This is fragile: it would match `console` in a string literal like `const x = "use console.log for debugging"`.
- Gap 2: Line 958 — Pattern '"type":"AwaitExpression"' means ALL async functions are considered impure, even if they have no side effects. This is overly conservative.
- Gap 3: Missing patterns: DOM manipulation, setTimeout/setInterval, new Date(), Math.random(), event emitter calls.
```

---

## SECTION 24: `computeComplexity()` (Lines 974-1019)

```
Lines 974-1019: computeComplexity(node, sourceContent) — INTERNAL
- What triggers it: parseExportDeclaration lines 367, 409; parseDefaultExport line 488
- What it calls: String.split, regex test, JSON string operations
- What calls it: parseExportDeclaration, parseDefaultExport
- Dependencies: None
- Status: WORKING but imprecise
- Gap 1: Lines 985-1017 — Counts complexity from raw source lines, not from the AST. This means comments and strings containing 'if', 'for', etc. inflate the count.
- Gap 2: Line 988 — regex `\b(if|else if|\?\s*)\b` — the `\?` pattern could match ternary operators in strings. Also `else if` as a single word boundary match is imprecise.
- Gap 3: Lines 1012-1016 — Nesting tracking by counting `{` and `}` in raw text. Comment braces, string braces, and regex braces all inflate the nesting level.
- Gap 4: Line 976 — Returns undefined if `node.loc` is missing. With errorRecovery:true, some nodes may lack location info.
```

---

## SECTION 25: `extractJsDocTags()` (Lines 1023-1065)

```
Lines 1023-1065: extractJsDocTags(node, sourceContent) — INTERNAL
- What triggers it: parseExportDeclaration lines 370, 390, 412, 430
- What it calls: Regex exec, string operations
- What calls it: parseExportDeclaration
- Dependencies: None
- Status: WORKING
- Gap 1: Line 1029 — `comment.value.startsWith('*')` checks for JSDoc (`/**...*/`) vs regular block comment (`/*...*/`). But the value starts after `/*` or `/**`, so a JSDoc comment's value starts with `*`. A regular `/* */` comment's value starts with `*` too if the content starts with `*`. This could produce false positives.
- Gap 2: Lines 1043-1062 — Fallback scans up to 10 lines backwards from the node start. This is reasonable but could miss JSDoc for functions defined far from their documentation.
- Gap 3: Line 1031 — Tag regex `@(\w+)(?:\s+(.+?))?` with lookahead — handles simple tags but misses multi-line tag values.
```

---

## SECTION 26: SOURCE MAP REFERENCE (Line 1066)

```
Line 1066: //# sourceMappingURL=astParser.js.map
- Status: SOURCE MAP NOT FOUND
- Gap: The .map file does not exist at the expected location. Stack traces will not map back to TypeScript source.
```

---

## CONNECTION MAP

### What Triggers AST Parsing?

| Trigger | Call Site | Function Called |
|---------|-----------|-----------------|
| File watcher detects new file | `backend/index.js:303` | `extractImportsAndExports(fullPath)` |
| File watcher detects changed file | `backend/index.js:355` | `extractImportsAndExports(fullPath)` |
| Schema card emission for all files | `backend/schemaCardEmitter.js:92` | `extractImportsAndExports(fullPath)` |
| Full codebase analysis | `lib/commands/integr8/dataIngestion.js:965` | `extractImportsAndExports(filePath)` |
| Indexer import parsing | `backend/indexer.js:218` | `extractImportsAndExports(filePath)` |
| Text-based import extraction | `lib/commands/integr8/dataIngestion.js:602` | `extractFromText(text, projectPath)` |
| Indexer text fallback | `backend/indexer.js:224` | `extractFromText(content)` |

### Data Flow Out

| Consumer | What It Receives | Fields Used |
|----------|-----------------|-------------|
| `backend/index.js` (schema card) | `{ imports, exports, exportStars, hasErrors }` | Passed to `emitter.emitCard()` |
| `backend/schemaCardEmitter.js` | `{ imports, exports }` | `imports[].source`, `exports[].name`, `exports[].kind` |
| `backend/indexer.js` | `result.imports` | `imports[].source` |
| `lib/commands/integr8/dataIngestion.js` | `{ imports }` and full result | `imports[].source`, `imports[].isDynamic`, `imports[].importType`, `exports[].name`, `exports[].kind`, `exports[].isReexport`, `exports[].exportVisibility` |

---

## @@@ SYMBOLS

No `@@@` symbols found in this file.

---

## SUMMARY OF BUGS AND GAPS

### Critical Issues

1. **Line 778:** `extractScriptFromVue()` returns raw HTML content when no `<script>` block exists in a `.vue` file. This feeds HTML into Babel parser, which will either throw (caught by fallback) or produce garbage AST. **Fix:** Return empty string `''` when no script blocks are found.

2. **Lines 819-823, 889-893:** `resolveExportStar()` and `traceReexportChain()` use a SUBSET of Babel plugins (missing `optionalChaining`, `nullishCoalescingOperator`). Files using these features will fail to parse in these code paths, silently returning empty results. **Fix:** Use the same plugin list as `extractImportsAndExports()` (line 169).

3. **Lines 660-672:** Regex fallback in `extractDynamicImportsFromAST` produces entries without `line` field, while AST-derived entries have it. This creates inconsistent objects that downstream consumers may not handle. **Fix:** Add `line` tracking to regex fallback or omit the field consistently.

### Warnings

4. **Line 320:** `extractFromText()` passes `projectPath` as `filePath` to `extractExportsViaRegex`. Export results will have `sourceFile` set to the project root directory instead of the actual file. **Fix:** Add a `filePath` parameter to `extractFromText` or document that `projectPath` is used as the source file.

5. **Lines 167-178:** `errorRecovery: true` means partial results on syntax errors. Callers have no way to distinguish "complete AST results" from "partial AST results with errors." **Fix:** Check `ast.errors.length > 0` and set a flag in the result.

6. **Line 953:** `detectPurity()` uses `JSON.stringify` of AST body for string-include pattern matching. This is fragile — string literals and comments containing "console" etc. will cause false "impure" determinations. **Fix:** Walk the AST properly instead of string-serializing it.

7. **Line 958:** `detectPurity()` marks ALL async functions as impure due to `'AwaitExpression'` pattern. Many async functions are pure (e.g., pure data transformations with async I/O at boundaries). **Fix:** Either remove the AwaitExpression check or document it as intentionally conservative.

8. **Lines 705-732:** `extractImportsViaRegex()` operates on raw text without stripping comments or string literals. Import-like syntax in comments (e.g., `// import foo from 'bar'`) will produce false positives. **Fix:** Strip single-line and multi-line comments before regex matching.

### Info

9. **Line 1066:** Source map file `astParser.js.map` does not exist. Stack traces will not map back to TypeScript source.

10. **Lines 365-384, 407-438:** Rich metadata (paramTypes, isPure, complexity, jsdocTags, signature, returnType, typeParams) is computed for exports but **no caller in backend/ or schemaCardEmitter.js appears to use these fields**. They only consume `name`, `kind`, and `sourceFile`. This metadata enrichment work is done but not consumed.

11. **Lines 692-704:** `extractRequireStatements()` only detects `const/let/var x = require('...')` patterns. Bare `require('...')` calls, `require()` inside expressions, and `require()` with template literals are missed.

12. **Line 560-586:** `typeAnnotationToString()` is missing several TypeScript types: `TSIntersectionType`, `TSTupleType`, `TSLiteralType`, `TSConditionalType`, `TSIndexedAccess`. These all return `'unknown'`.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
