# Detailed Line-by-Line Report: `lib/commands/integr8/dataIngestion.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/integr8/dataIngestion.js`
**Total Lines:** 1102
**Source:** Compiled from `src/commands/integr8/dataIngestion.ts`
**Report Generated:** 2026-05-13

---

## Lines 1-3: File Header & Purpose
- **What this section does:** Declares strict mode and documents the file's role as "Stage 1: Data Ingestion Engine" — calls existing parsers and parses text output into graph nodes.
- **What triggers it:** Loaded as a module via `require()`.
- **What it calls:** N/A (header only).
- **What calls it:** N/A (header only).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** None.

---

## Lines 4-45: TypeScript Helper Functions (Compiled Output)
- **What this section does:** Contains TypeScript compiler-generated helper functions for ES module interop:
  - `__createBinding` (lines 4-14): Creates property bindings for module exports.
  - `__setModuleDefault` (lines 15-19): Sets the default export on a module.
  - `__importStar` (lines 20-36): Star-import helper (`import * as path from 'path'`).
  - `__awaiter` (lines 37-45): Async/await polyfill for Promise-based generators.
- **What triggers it:** Automatically invoked when ES module imports are used in the compiled code.
- **What it calls:** `Object.create`, `Object.defineProperty`, `Object.getOwnPropertyNames`, `Promise`.
- **What calls it:** Internal compiler output — used by `__importStar(require("path"))` on line 60 and all `async function` bodies.
- **Dependencies:** None (standard JS runtime).
- **Status:** ✅ WORKING
- **Gap:** None — standard TypeScript compilation output.

---

## Lines 46-50: Export Declarations
- **What this section does:** Marks the file as an ES module and declares the 4 public exports:
  - `getParserHealthReport` (line 47)
  - `resetParserHealth` (line 48)
  - `ingestSingleProject` (line 49)
  - `ingestProjectData` (line 50)
- **What triggers it:** Module system on require.
- **What it calls:** N/A.
- **What calls it:**
  - `ingestProjectData` → called by `integr8/index.js:71`, `graphBuilder.js:25`
  - `ingestSingleProject` → called by `backgroundIndexer.js:326`, `backgroundIndexer.js:367`
  - `getParserHealthReport` → exported but no callers found in codebase
  - `resetParserHealth` → exported but no callers found in codebase
- **Dependencies:** N/A.
- **Status:** ✅ WORKING
- **Gap:** `getParserHealthReport` and `resetParserHealth` are exported but never called by any other file — potential dead exports or intended for external/test use only.

---

## Lines 51-62: Import Declarations
- **What this section does:** Imports all dependencies via `require()`:

| Line | Import | Source | Exported Symbol | Exists? |
|------|--------|--------|-----------------|---------|
| 51 | `types_js_1` | `./types.js` | `NodeType`, `EdgeType` | ✅ YES |
| 52 | `overview_js_1` | `../overview.js` | `generateOverviewAndGetFileList` | ✅ YES |
| 53 | `storeParser_js_1` | `../storeParser.js` | `generateStoreReport` | ❌ **NO** |
| 54 | `routeParser_js_1` | `../routeParser.js` | `generateRouteReport` | ❌ **NO** |
| 55 | `commandParser_js_1` | `../commandParser.js` | `generateCommandReport` | ❌ **NO** |
| 56 | `typeParser_js_1` | `../typeParser.js` | `generateTypeReport` | ❌ **NO** |
| 57 | `uiParser_js_1` | `../uiParser.js` | `generateUiComponentReport` | ❌ **NO** |
| 58 | `parserPersistence_js_1` | `../parserPersistence.js` | `ParserPersistence` | ✅ YES |
| 59 | `astParser_js_1` | `../../utils/astParser.js` | `extractFromText`, `extractImportsAndExports` | ✅ YES |
| 60 | `path` | `path` (Node built-in) | `path.*` | ✅ YES |
| 61 | `safeFs_js_1` | `../../utils/safeFs.js` | `safeAccess`, `safeReadFile` | ✅ YES |
| 62 | `ioChan_js_1` | `../../utils/ioChan.js` | `ioChan`, `IoChannelPriority` | ✅ YES |

- **What triggers it:** Module load time.
- **What it calls:** `require()` for each dependency.
- **What calls it:** Module system.
- **Dependencies:** 12 modules.
- **Status:** ⚠️ **BROKEN** — 5 of 12 imports reference files that **do not exist on disk**:
  - `../storeParser.js` — **MISSING**
  - `../routeParser.js` — **MISSING**
  - `../commandParser.js` — **MISSING**
  - `../typeParser.js` — **MISSING**
  - `../uiParser.js` — **MISSING**
- **Gap:** **CRITICAL.** These 5 parser files are required at module load time. If this module is `require()`'d, Node.js will throw `MODULE_NOT_FOUND` immediately. The `require()` calls are at the **top level** (not lazy), so the entire module fails to load if any of these files are absent. The runtime will crash with:
  ```
  Error: Cannot find module '../storeParser.js'
  ```
  This means `ingestProjectData`, `ingestSingleProject`, and all other exports are completely unreachable. The parsers may exist in a different location (e.g., under a `src/` directory or as part of a monorepo package) or may need to be generated/built first.

---

## Lines 63-68: Circuit Breaker Configuration
- **What this section does:** Defines the `CIRCUIT_BREAKER_CONFIG` constant with:
  - `failureThreshold: 3` — trips after 3 consecutive failures
  - `resetTimeoutMs: 30000` — 30-second cooldown before half-open
  - `halfOpenMaxAttempts: 1` — one probe attempt in half-open state
- **What triggers it:** Used by `isCircuitOpen()` (line 100) and `recordFailure()` (line 130).
- **What it calls:** N/A (configuration object).
- **What calls it:** `isCircuitOpen` (line 107), `recordFailure` (line 141), `retryParser` (line 173).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** `halfOpenMaxAttempts` (line 67) is **defined but never read** anywhere in the file. The half-open logic in `isCircuitOpen` (line 108) simply transitions to half-open and allows one attempt, but doesn't reference this config value. Dead configuration.

---

## Lines 69-81: Adaptive Retry Configuration
- **What this section does:** Defines `ADAPTIVE_RETRY_CONFIG` with:
  - `baseDelayMs: 200` — base retry delay
  - `maxRetries: 3` — maximum retry attempts
  - `errorDelayMap` (lines 72-79): Maps error codes to delay multipliers (EACCES→3, EMFILE→5, ENOENT→0, etc.)
  - `skipErrors` (line 80): Error codes that should not be retried (ENOENT, ENOTDIR, EISDIR)
- **What triggers it:** Used by `retryParser()`, `computeAdaptiveDelay()`, `shouldSkipRetry()`.
- **What it calls:** N/A (configuration object).
- **What calls it:** `computeAdaptiveDelay` (line 155), `shouldSkipRetry` (line 162), `retryParser` (lines 176, 193).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** None — well-structured configuration.

---

## Lines 82-98: Health Monitor & `getOrCreateHealthEntry()`
- **What this section does:**
  - Line 83: Creates a module-level `Map` called `healthMonitor` to track per-parser health metrics.
  - Lines 84-98: `getOrCreateHealthEntry(parserName)` — lazily initializes a health entry with zeroed counters, `successRate: 1.0`, and `circuitState: 'closed'`.
- **What triggers it:** Called by `retryParser()` at line 170.
- **What it calls:** `healthMonitor.has()`, `healthMonitor.set()`, `healthMonitor.get()`.
- **What calls it:** `retryParser` (line 170).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** The initial `successRate: 1.0` (line 92) is optimistic — a brand-new parser with zero attempts shows 100% success rate. This could be misleading in health reports. Consider initializing to `0` or `null` to indicate "no data."

---

## Lines 99-115: `isCircuitOpen()`
- **What this section does:** Checks if the circuit breaker for a parser should prevent execution:
  - `closed` → returns `false` (allow execution)
  - `open` → checks if `resetTimeoutMs` has elapsed since `circuitOpenedAt`; if yes, transitions to `half-open` and allows one attempt; if no, returns `true` (block execution)
  - `half-open` → returns `false` (allow one attempt)
- **What triggers it:** Called by `retryParser()` at line 172.
- **What it calls:** `Date.now()`, `new Date()`.
- **What calls it:** `retryParser` (line 172).
- **Dependencies:** `CIRCUIT_BREAKER_CONFIG.resetTimeoutMs` (line 107).
- **Status:** ✅ WORKING
- **Gap:** Line 106: `new Date(entry.circuitOpenedAt).getTime()` — the `circuitOpenedAt` is stored as an ISO string (line 143, 149). Parsing ISO strings with `new Date()` is generally reliable but has edge cases with timezone handling. Minor robustness concern.

---

## Lines 116-128: `recordSuccess()`
- **What this section does:** Records a successful parser invocation:
  - Increments `totalAttempts` and `successCount`
  - Resets `consecutiveFailures` to 0
  - Records `lastSuccess` timestamp
  - Recomputes `successRate`
  - If in `half-open` state, transitions back to `closed` and logs recovery
- **What triggers it:** Called by `retryParser()` at line 179 on successful execution.
- **What it calls:** `console.log` (line 126).
- **What calls it:** `retryParser` (line 179).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** None.

---

## Lines 129-151: `recordFailure()`
- **What this section does:** Records a failed parser invocation:
  - Increments `totalAttempts`, `failureCount`, `consecutiveFailures`
  - Records `lastFailure` timestamp, `lastError` message, and error code counts
  - Recomputes `successRate`
  - If `consecutiveFailures >= failureThreshold` (3), trips circuit to `open` state
  - If in `half-open` state, single failure re-opens circuit
- **What triggers it:** Called by `retryParser()` at lines 187 and 191.
- **What it calls:** `console.warn` (line 144).
- **What calls it:** `retryParser` (lines 187, 191).
- **Dependencies:** `CIRCUIT_BREAKER_CONFIG.failureThreshold` (line 141).
- **Status:** ✅ WORKING
- **Gap:** None — circuit breaker logic is correct.

---

## Lines 152-163: `computeAdaptiveDelay()` and `shouldSkipRetry()`
- **What this section does:**
  - `computeAdaptiveDelay(attempt, errorCode)` (lines 153-157): Computes exponential backoff delay with error-specific multiplier. Formula: `baseDelay * 2^(attempt-1) * multiplier`.
  - `shouldSkipRetry(errorCode)` (lines 159-163): Returns `true` if the error code is in the `skipErrors` list.
- **What triggers it:** Called by `retryParser()` at lines 186 and 193.
- **What it calls:** N/A.
- **What calls it:** `retryParser` (lines 186, 193).
- **Dependencies:** `ADAPTIVE_RETRY_CONFIG` (lines 69-81).
- **Status:** ✅ WORKING
- **Gap:** None.

---

## Lines 164-204: `retryParser()`
- **What this section does:** Core retry logic with health monitoring, circuit breaker, and adaptive backoff:
  1. Gets/creates health entry for the parser (line 170)
  2. Checks circuit breaker — if open, returns fallback immediately (lines 172-175)
  3. Loops up to `maxRetries` (3) attempts (line 176)
  4. On success: records success, returns result (lines 178-180)
  5. On failure:
     - Checks if error is non-retryable (skipErrors) — if so, records failure and returns fallback (lines 186-190)
     - Records failure (line 191)
     - If more retries remain, computes adaptive delay and waits (lines 192-196)
     - If last attempt, logs error (lines 197-199)
  6. After all retries exhausted, returns fallback (line 202)
- **What triggers it:** Called by `ingestSingleProject()` for each parser (lines 836, 851, 863, 875, 890, 905).
- **What it calls:** `getOrCreateHealthEntry` (line 170), `isCircuitOpen` (line 172), `fn()` (line 178), `recordSuccess` (line 179), `shouldSkipRetry` (line 186), `recordFailure` (lines 187, 191), `computeAdaptiveDelay` (line 193), `console.warn` (lines 173, 188, 194), `console.error` (line 198).
- **What calls it:** `ingestSingleProject` (lines 836, 851, 863, 875, 890, 905), `fallbackChainParser` (line 211).
- **Dependencies:** Health monitor functions (lines 84-163), `ADAPTIVE_RETRY_CONFIG` (lines 69-81).
- **Status:** ✅ WORKING
- **Gap:** Line 183: `err.code` — assumes the error object has a `.code` property. If the parser throws a plain `Error` without a `.code`, this will be `undefined`, which is handled by the `|| ''` fallback. Acceptable.

---

## Lines 205-226: `fallbackChainParser()`
- **What this section does:** Implements a 3-tier fallback chain:
  1. Try primary parser with retry (line 211)
  2. If primary fails, try regex fallback (synchronous, line 217)
  3. If regex fails, return unparseable marker (line 223)
- **What triggers it:** **NOTHING.** This function is **never called** anywhere in the codebase.
- **What it calls:** `retryParser` (line 211), `regexFallbackFn()` (line 217), `console.log` (line 218), `console.warn` (line 222).
- **What calls it:** ❌ **NO CALLERS** — dead code.
- **Dependencies:** `retryParser` (line 168).
- **Status:** ⚠️ **NOT CONNECTED** — dead code.
- **Gap:** `fallbackChainParser` is defined but never invoked. The `ingestSingleProject` function uses `retryParser` directly (without the regex fallback tier). This means the "Tier 3" fallback chain described in the comment (line 206) is implemented but not wired up. **The regex fallback path is unreachable.**

---

## Lines 227-234: Health Monitor Exports
- **What this section does:**
  - `getParserHealthReport()` (lines 228-230): Returns all health entries as an array. Exported.
  - `resetParserHealth()` (lines 232-234): Clears the health monitor map. Exported (for testing).
- **What triggers it:** External callers via `require()`.
- **What it calls:** `healthMonitor.values()` (line 229), `healthMonitor.clear()` (line 233).
- **What calls it:** No callers found in codebase — exported for diagnostic/test use.
- **Dependencies:** `healthMonitor` Map (line 83).
- **Status:** ✅ WORKING
- **Gap:** Neither function is called within the project. May be intended for CLI diagnostic commands or tests.

---

## Lines 235-256: `detectSideEffectImports()`
- **What this section does:** Detects side-effect imports (e.g., `import './polyfill'`) using regex:
  - Pattern: `^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$` (line 242)
  - Returns array of import objects with `importType: 'side-effect'` and `isSideEffect: true`
- **What triggers it:** Called by `enhancedImportScan()` at line 359.
- **What it calls:** `RegExp.exec()` (line 244).
- **What calls it:** `enhancedImportScan` (line 359).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** The regex only matches single-line side-effect imports. Multi-line imports or imports with comments are not handled. Minor limitation.

---

## Lines 257-304: `detectConditionalDynamicImports()`
- **What this section does:** Detects three types of conditional/dynamic imports:
  1. **Dynamic `import()` with variable path** (lines 263-276): Pattern matches `import(variable)` or `` import(`template`) ``
  2. **`require.resolve()`** (lines 278-289): Pattern matches `require.resolve('module')`
  3. **Conditional `require()`** (lines 291-303): Pattern matches `if (...) require(...)` or `&& require(...)` or `|| require(...)`
- **What triggers it:** Called by `enhancedImportScan()` at line 360.
- **What it calls:** `RegExp.exec()` for each pattern.
- **What calls it:** `enhancedImportScan` (line 360).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** Line 263: The dynamic import regex `/import\(\s*(?!['"])([\w.`${}+\s/]+)\s*\)/g` uses a negative lookahead `(?!['"])` to skip string literals, but the character class `[\w.`${}+\s/]+` could match across multiple import() calls in a single line, potentially producing false positives. Minor regex precision concern.

---

## Lines 305-343: `detectBarrelReexports()`
- **What this section does:** Detects barrel file re-exports:
  1. Checks if the file is an `index.ts`/`index.js` barrel (line 311)
  2. Matches `export * from './module'` (lines 313-326)
  3. Matches `export { name } from './module'` (lines 328-341) with specifier extraction
- **What triggers it:** Called by `enhancedImportScan()` at line 361.
- **What it calls:** `RegExp.exec()`, `String.split()`, `String.trim()`.
- **What calls it:** `enhancedImportScan` (line 361).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** Line 330: The specifier parsing `match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())` handles `export { Foo as Bar }` correctly by taking the first part. However, it doesn't handle multi-line export blocks or comments within the export list. Minor limitation.

---

## Lines 344-363: `enhancedImportScan()`
- **What this section does:** Orchestrates all three enhanced import detection methods:
  1. Calls `detectSideEffectImports(text)` (line 359)
  2. Calls `detectConditionalDynamicImports(text)` (line 360)
  3. Calls `detectBarrelReexports(text, filePath)` (line 361)
  4. Deduplicates results using a `Set` keyed by `source:importType` (lines 349-358)
- **What triggers it:** Called by `parseImportsFromText()` at line 620.
- **What it calls:** `detectSideEffectImports` (line 359), `detectConditionalDynamicImports` (line 360), `detectBarrelReexports` (line 361).
- **What calls it:** `parseImportsFromText` (line 620).
- **Dependencies:** Lines 239-343 (detection functions).
- **Status:** ✅ WORKING
- **Gap:** None — clean orchestration.

---

## Lines 364-373: ID Generation Functions
- **What this section does:**
  - Line 365: Module-level `nodeCounter` (starts at 0, incremented per node).
  - `makeNodeId(prefix, name)` (lines 366-370): Generates unique node IDs like `file_src/main.ts_1`. Sanitizes name to `[a-zA-Z0-9_.-]`, truncates to 80 chars.
  - `makeEdgeId(from, to, type)` (lines 371-373): Generates deterministic edge IDs like `edge_node1__type__node2`.
- **What triggers it:** Called by all `parse*ToNodes()` functions and `buildEdges()`.
- **What it calls:** `String.replace()`, `String.substring()`.
- **What calls it:** `parseOverviewToNodes` (line 394), `parseStoreReportToNodes` (line 428), `parseRouteReportToNodes` (line 464), `parseCommandReportToNodes` (line 511), `parseTypeReportToNodes` (line 544), `parseUiReportToNodes` (line 581), `parseImportsFromText` (lines 608, 627), AST import/export creation (lines 975, 996, 1031), `buildEdges` (lines 748, 764, 779, 795, 810).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** `nodeCounter` is a **module-level mutable variable** (line 365). It is reset to 0 in `ingestProjectData` (line 1092) but NOT reset in `ingestSingleProject`. This means if `ingestSingleProject` is called directly (e.g., from `backgroundIndexer.js:326`), the counter accumulates across calls, producing non-deterministic IDs. This could cause issues if graphs from separate calls are compared or merged.

---

## Lines 374-377: `initialProperties()`
- **What this section does:** Returns a fresh properties object `{ reachability: 0, stability: 0, fragility: 0 }` — these are computed in Stage 2.
- **What triggers it:** Called by `ingestSingleProject()` at line 1072.
- **What it calls:** N/A.
- **What calls it:** `ingestSingleProject` (line 1072).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** None.

---

## Lines 378-402: `parseOverviewToNodes()`
- **What this section does:** Parses overview report text to extract file paths from a numbered index format (`1: src/main.ts`):
  - Regex: `/^\s*\d+:\s+(.+)$/gm` (line 386)
  - Skips `[COMPARE]`-prefixed entries (line 391)
  - Creates `FILE` type nodes with `projectPath` metadata
- **What triggers it:** Called by `ingestSingleProject()` at line 839.
- **What it calls:** `makeNodeId` (line 394), `types_js_1.NodeType.FILE` (line 395).
- **What calls it:** `ingestSingleProject` (line 839).
- **Dependencies:** `types.js` (NodeType), `makeNodeId` (line 366).
- **Status:** ✅ WORKING
- **Gap:** The regex assumes a very specific format. If the overview report has a different format (e.g., no line numbers, different separator), no nodes will be generated — silently returns empty array.

---

## Lines 403-443: `parseStoreReportToNodes()`
- **What this section does:** Parses store report text to extract store definitions:
  - Block regex: `/--- Store ID:\s*(.+?)\s*---\n([\s\S]*?)(?=\n---|\n===|$)/g` (line 416)
  - Extracts: `File`, `Exported As`, `Type`, `State Properties`, `Getters`, `Actions` via helper functions
  - Creates `STORE` type nodes
- **What triggers it:** Called by `ingestSingleProject()` at line 854.
- **What it calls:** `extractField` (lines 421-423), `extractListField` (lines 424-426), `makeNodeId` (line 428), `types_js_1.NodeType.STORE` (line 429).
- **What calls it:** `ingestSingleProject` (line 854).
- **Dependencies:** `types.js` (NodeType), field extraction helpers (lines 648-669), `makeNodeId`.
- **Status:** ✅ WORKING
- **Gap:** The block regex uses `\n` as line separator — will fail on Windows-style `\r\n` line endings if the parser output uses them.

---

## Lines 444-476: `parseRouteReportToNodes()`
- **What this section does:** Parses route report text to extract route definitions:
  - Regex: `/^\s*-\s*Path:\s*(.+)$/gm` (line 454)
  - Lookahead of 200 characters for `Name` and `Component` fields (line 460)
  - Creates `ROUTE` type nodes
- **What triggers it:** Called by `ingestSingleProject()` at line 866.
- **What it calls:** `extractInlineField` (lines 461-462), `makeNodeId` (line 464), `types_js_1.NodeType.ROUTE` (line 465).
- **What calls it:** `ingestSingleProject` (line 866).
- **Dependencies:** `types.js` (NodeType), `extractInlineField` (line 665), `makeNodeId`.
- **Status:** ✅ WORKING
- **Gap:** Line 460: The 200-character lookahead is a hardcoded magic number. If the route report has very long component paths or many fields between `Path:` and `Name:`, the lookahead may be insufficient, causing `Name` and `Component` to be `null`.

---

## Lines 477-524: `parseCommandReportToNodes()`
- **What this section does:** Parses command report text to extract Tauri command names:
  - Regex: `/^Command:\s*(.+)$/gm` (line 490)
  - Deduplicates commands using a `Set` (line 489)
  - 300-character lookahead for `Invoked in` and `Declared in` (line 499)
  - Collects file references from invocation list (lines 503-509)
  - Creates `COMMAND` type nodes
- **What triggers it:** Called by `ingestSingleProject()` at line 878.
- **What it calls:** `extractInlineField` (lines 500-501), `makeNodeId` (line 511), `types_js_1.NodeType.COMMAND` (line 512).
- **What calls it:** `ingestSingleProject` (line 878).
- **Dependencies:** `types.js` (NodeType), `extractInlineField`, `makeNodeId`.
- **Status:** ✅ WORKING
- **Gap:** Line 506: `lookahead.split(/\n(?=Command:|\n---|\n===)/)[0]` — the split pattern includes `\n---` and `\n===` but also `\n(?=Command:)` which means it splits on a newline followed by `Command:`. This could prematurely cut off the file reference list if there are nested command blocks.

---

## Lines 525-558: `parseTypeReportToNodes()`
- **What this section does:** Parses type report text to extract type/interface/enum definitions:
  - File block regex: `/--- File:\s*(.+?)\s*---\n([\s\S]*?)(?=\n--- File:|\n===|$)/g` (line 533)
  - Type definition regex: `/(?:export\s+)?(?:interface|type|enum)\s+([A-Z][a-zA-Z0-9_]*)/g` (line 539)
  - Creates `TYPE` type nodes
  - Line 554-555: Comment documents that fallback TYPE node creation was removed (I-11 fix)
- **What triggers it:** Called by `ingestSingleProject()` at line 893.
- **What it calls:** `makeNodeId` (line 544), `types_js_1.NodeType.TYPE` (line 545).
- **What calls it:** `ingestSingleProject` (line 893).
- **Dependencies:** `types.js` (NodeType), `makeNodeId`.
- **Status:** ✅ WORKING
- **Gap:** The type regex only matches types starting with an uppercase letter (`[A-Z]`). This is correct for TypeScript conventions but would miss unconventional type names.

---

## Lines 559-592: `parseUiReportToNodes()`
- **What this section does:** Parses UI component report text:
  - Regex: `/File Name:\s*(.+?)\s*\(([^)]+)\)/g` (line 568)
  - 300-character lookahead for `UI Elements (N): ...` (lines 574-579)
  - Creates `COMPONENT` type nodes with `uiElements` metadata
- **What triggers it:** Called by `ingestSingleProject()` at line 907.
- **What it calls:** `makeNodeId` (line 581), `types_js_1.NodeType.COMPONENT` (line 582).
- **What calls it:** `ingestSingleProject` (line 907).
- **Dependencies:** `types.js` (NodeType), `makeNodeId`.
- **Status:** ✅ WORKING
- **Gap:** None — straightforward parsing.

---

## Lines 593-645: `parseImportsFromText()`
- **What this section does:** Scans text reports for import-like references and creates `IMPORT` nodes:
  1. Uses `astParser.extractFromText()` to find standard imports (line 602)
  2. Deduplicates by source (lines 604-605)
  3. Calls `enhancedImportScan()` for side-effect/dynamic/barrel imports (line 620)
  4. Deduplicates enhanced imports by `enhanced:source:importType` key (lines 622-625)
  5. Creates `IMPORT` nodes with full metadata including `isSideEffect`, `isDynamic`, `isConditional`, `isBarrelReexport`, `variablePath`, `resolvedSource`
- **What triggers it:** Called by `ingestSingleProject()` at lines 843, 882, 897.
- **What it calls:** `astParser.extractFromText` (line 602), `enhancedImportScan` (line 620), `makeNodeId` (lines 608, 627), `types_js_1.NodeType.IMPORT` (lines 609, 628).
- **What calls it:** `ingestSingleProject` (lines 843, 882, 897).
- **Dependencies:** `astParser.js` (`extractFromText`), `enhancedImportScan` (line 347), `types.js`.
- **Status:** ✅ WORKING
- **Gap:** Line 615: `imp.specifiers.map(s => s.name)` — assumes specifiers have a `.name` property. This matches the `extractFromText` return type but could fail if the AST parser's output format changes.

---

## Lines 646-669: Field Extraction Helpers
- **What this section does:** Three utility functions for extracting fields from parsed text blocks:
  - `extractField(block, fieldName)` (lines 648-652): Extracts `FieldName: value` using multiline regex.
  - `extractListField(block, fieldName)` (lines 654-663): Extracts `FieldName (N): val1, val2` — handles `None` and empty strings.
  - `extractInlineField(lookahead, fieldName)` (lines 665-669): Same as `extractField` but for lookahead strings.
- **What triggers it:** Called by `parseStoreReportToNodes` (lines 421-426), `parseRouteReportToNodes` (lines 461-462), `parseCommandReportToNodes` (lines 500-501).
- **What it calls:** `RegExp`, `String.match()`, `String.split()`.
- **What calls it:** Multiple parse functions.
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** Line 649: `new RegExp(...)` is called each time — could be cached for performance, but not a correctness issue.

---

## Lines 670-723: Enhanced Metadata Helpers (I-12/I-03)
- **What this section does:**
  - `flattenPackageExports(exports)` (lines 675-689): Recursively flattens `package.json` exports field to extract all entry point paths. Handles conditional exports like `{ ".": { "import": "./dist/index.js" } }`.
  - `isPublicAPIExport(filePath, entryPoints)` (lines 693-708): Determines if a file is part of the public API by checking against package entry points. Also considers `src/index.ts` and `src/index.js` as public API.
  - `computeDependencyWeight(exportName, importCounts)` (lines 713-723): Computes how many times an export's module is imported across the project.
- **What triggers it:** Called by `ingestSingleProject()` during AST processing (lines 941, 992, 994).
- **What it calls:** `Object.values()` (line 682), `String.replace()`, `String.endsWith()`.
- **What calls it:** `ingestSingleProject` (lines 941, 992, 994).
- **Dependencies:** None.
- **Status:** ✅ WORKING
- **Gap:** Line 699: `normalizedPath.endsWith(normalizedEntry)` — this could produce false positives. For example, a file `src/foobar/index.ts` would match an entry point `bar/index.ts` because `endsWith` doesn't check path boundaries. Should use path-aware comparison.

---

## Lines 724-819: `buildEdges()`
- **What this section does:** Builds edges from collected nodes. Creates 5 types of edges:
  1. **STORE → FILE** (lines 742-755): `CONTAINS` edges connecting stores to their source files. Confidence: 1.0.
  2. **ROUTE → COMPONENT** (lines 757-771): `NAVIGATES_TO` edges connecting routes to components. Strips `.vue` suffix for matching. Confidence: 0.9.
  3. **COMMAND → FILE** (lines 773-787): `INVOKES` edges connecting files to commands they invoke. Confidence: 0.95.
  4. **TYPE → FILE** (lines 789-802): `CONTAINS` edges connecting types to their source files. Confidence: 1.0.
  5. **COMPONENT → FILE** (lines 804-817): `CONTAINS` edges connecting components to their file entries. Confidence: 1.0.
- **What triggers it:** Called by `ingestSingleProject()` at line 1067.
- **What it calls:** `nodes.filter()` (lines 735-740), `nodes.find()` (lines 745, 761, 776, 792, 807), `makeEdgeId` (lines 748, 764, 779, 795, 810).
- **What calls it:** `ingestSingleProject` (line 1067).
- **Dependencies:** `types.js` (NodeType, EdgeType), `makeEdgeId` (line 371).
- **Status:** ✅ WORKING
- **Gap:**
  1. **No IMPORT edges are built.** The function builds `CONTAINS`, `NAVIGATES_TO`, and `INVOKES` edges but never creates `IMPORTS` or `DEPENDS_ON` edges from the IMPORT nodes. The IMPORT nodes are created but never connected to anything via edges.
  2. **No EXPORT edges are built.** Similarly, EXPORT nodes (created in the AST section) are never connected via edges.
  3. **Line 761:** `c.name.replace(/\.vue$/, '') === compName` — only strips `.vue` suffix. If components use `.jsx` or `.tsx` extensions, the matching will fail.

---

## Lines 820-1075: `ingestSingleProject()`
- **What this section does:** The core function that runs all parsers against a single project path and builds a `SemanticGraph`. This is the main workhorse of the file.

### Sub-section: Parser Execution (lines 834-914)
- **Lines 834-849:** **Overview parser** — calls `generateOverviewAndGetFileList(projectPath)` with retry. On success, parses report into FILE nodes and IMPORT nodes. Falls back to empty `{ reportString: '', fileList: [] }`.
- **Lines 850-861:** **Store parser** — calls `generateStoreReport(projectPath)` with retry. Parses into STORE nodes.
- **Lines 862-873:** **Route parser** — calls `generateRouteReport(projectPath)` with retry. Parses into ROUTE nodes.
- **Lines 874-888:** **Command parser** — calls `generateCommandReport(projectPath)` with retry. Parses into COMMAND nodes. Also extracts IMPORT nodes from command text.
- **Lines 889-903:** **Type parser** — calls `generateTypeReport(projectPath)` with retry. Parses into TYPE nodes. Also extracts IMPORT nodes from type text.
- **Lines 904-914:** **UI parser** — calls `generateUiComponentReport(projectPath)` with retry. Parses into COMPONENT nodes.
- **Lines 916-918:** Logs warning if any parsers failed.

### Sub-section: AST-based Import/Export Extraction (lines 919-1052)
- **Lines 922-929:** Filters FILE nodes, initializes counters and `importCounts` Map.
- **Lines 928-949:** Reads `package.json` to detect entry points for module boundary detection. Uses `ioChan` for I/O scheduling and `safeFs` for safe file access. Silently ignores errors.
- **Lines 950-1049:** Iterates over all FILE nodes:
  - Resolves file path (line 951-953)
  - Filters to TS/JS/Vue extensions only (lines 957-959)
  - Checks file existence via `safeAccess` (lines 961-963)
  - Calls `astParser.extractImportsAndExports(filePath)` (line 965)
  - Tracks import counts for dependency weight (lines 967-970)
  - Creates IMPORT nodes with full metadata (lines 972-988)
  - Creates EXPORT nodes with rich metadata including re-export tracking, public API detection, dependency weight, complexity, JSDoc tags (lines 990-1025)
  - Creates special IMPORT nodes for `export *` relationships (lines 1027-1044)
  - Silently catches AST extraction errors per file (line 1046)

### Sub-section: Persistence (lines 1053-1065)
- **Lines 1054-1064:** If `persist=true`, creates a `ParserPersistence` instance, generates a snapshot ID, persists all parser data, and closes the connection. Catches and logs errors.

### Sub-section: Edge Building & Return (lines 1066-1074)
- **Line 1067:** Calls `buildEdges(allNodes)`.
- **Lines 1069-1073:** Returns `{ nodes, edges, properties }`.

- **What triggers it:** Called by `ingestProjectData()` (lines 1094-1095), `backgroundIndexer.js` (lines 326, 367).
- **What it calls:** All 6 parsers via `retryParser`, all `parse*ToNodes` functions, `parseImportsFromText`, `astParser.extractImportsAndExports`, `safeFs.safeAccess`, `ioChan.execute`, `parserPersistence`, `buildEdges`.
- **What calls it:** `ingestProjectData` (lines 1094-1095), `backgroundIndexer` (lines 326, 367).
- **Dependencies:** All imports (lines 51-62).
- **Status:** ⚠️ **BROKEN** (due to missing parser imports at lines 53-57 — see Line 51-62 analysis above)
- **Gap:**
  1. **Missing parser files** — `storeParser.js`, `routeParser.js`, `commandParser.js`, `typeParser.js`, `uiParser.js` do not exist. The entire function is unreachable.
  2. **Line 907:** `uiText` is collected but NOT stored in `rawResults` — unlike all other parsers (overview→`rawResults.overview`, store→`rawResults.stores`, etc.), the UI parser result is not persisted. Inconsistent.
  3. **Line 965:** `astParser.extractImportsAndExports(filePath)` is a **synchronous** call (no `yield`), but it's inside an `async` function. If this function does heavy I/O (file reading), it will block the event loop. The `extractFromText` variant (line 602) is used elsewhere with proper async handling.
  4. **Lines 961-963:** File existence check uses `ioChan.execute` (async) but the AST extraction on line 965 is synchronous — inconsistent I/O patterns.

---

## Lines 1076-1101: `ingestProjectData()` — Main Export
- **What this section does:** The main entry point for Stage 1 data ingestion:
  1. Logs configuration (lines 1085-1090)
  2. Resets `nodeCounter` to 0 for clean IDs (line 1092)
  3. Calls `ingestSingleProject` for external project (line 1094)
  4. Calls `ingestSingleProject` for current project (line 1095)
  5. Logs summary (lines 1096-1098)
  6. Returns `{ externalGraph, currentGraph }` (line 1099)
- **What triggers it:**
  - `integr8/index.js:71` — main integr8 command orchestrator
  - `graphBuilder.js:25` — dependency graph builder
- **What it calls:** `ingestSingleProject` (lines 1094-1095).
- **What calls it:** `integr8/index.js:71`, `graphBuilder.js:25`.
- **Dependencies:** `ingestSingleProject` (line 827).
- **Status:** ⚠️ **BROKEN** (depends on `ingestSingleProject` which depends on missing parser files)
- **Gap:**
  1. **`targetPages` is logged but never used** (line 1088). The function accepts `args.targetPages` but doesn't pass it to `ingestSingleProject` or use it for filtering. This means all parsers run on the entire project regardless of target pages — the filtering must happen downstream (in `relationshipAnalyzer` or `pathGenerator`).
  2. **`args.persist` is not passed from `integr8/index.js:71-75`.** The caller in `index.js` does not include `persist` in the args object, so it will be `undefined` (falsy), meaning persistence is never triggered from the main integr8 command. Only `backgroundIndexer.js` explicitly passes `persist=true`.

---

## Line 1102: Source Map Reference
- **What this section does:** `//# sourceMappingURL=dataIngestion.js.map` — references the source map for debugging.
- **Status:** ✅ WORKING
- **Gap:** None.

---

## @@@ Symbol Analysis

**No `@@@` symbols found in this file.** The file does not contain any `@@@` markers.

---

## Connection Map

### Inbound Connections (What calls this file)

| Caller File | Function Called | Line in Caller | Line in This File |
|-------------|---------------|----------------|-------------------|
| `integr8/index.js` | `ingestProjectData()` | 71 | 1083 |
| `graphBuilder.js` | `ingestProjectData()` | 25 | 1083 |
| `backgroundIndexer.js` | `ingestSingleProject()` | 326 | 827 |
| `backgroundIndexer.js` | `ingestSingleProject()` | 367 | 827 |

### Outbound Connections (What this file calls)

| Target File | Function Called | Line in This File | Status |
|-------------|---------------|-------------------|--------|
| `./types.js` | `NodeType.*`, `EdgeType.*` | 395, 429, 465, 512, 545, 582, 609, 628, 735-740, 976, 997, 1032 | ✅ EXISTS |
| `../overview.js` | `generateOverviewAndGetFileList()` | 836 | ✅ EXISTS |
| `../storeParser.js` | `generateStoreReport()` | 851 | ❌ **MISSING** |
| `../routeParser.js` | `generateRouteReport()` | 863 | ❌ **MISSING** |
| `../commandParser.js` | `generateCommandReport()` | 875 | ❌ **MISSING** |
| `../typeParser.js` | `generateTypeReport()` | 890 | ❌ **MISSING** |
| `../uiParser.js` | `generateUiComponentReport()` | 905 | ❌ **MISSING** |
| `../parserPersistence.js` | `ParserPersistence` | 1056 | ✅ EXISTS |
| `../../utils/astParser.js` | `extractFromText()`, `extractImportsAndExports()` | 602, 965 | ✅ EXISTS |
| `../../utils/safeFs.js` | `safeAccess()`, `safeReadFile()` | 931, 933, 961 | ✅ EXISTS |
| `../../utils/ioChan.js` | `ioChan.execute()`, `IoChannelPriority.ANALYSIS` | 931, 933, 961 | ✅ EXISTS |

### Data Flow Out

```
ingestProjectData(args)
  ├→ ingestSingleProject(externalPath, persist) → { nodes[], edges[], properties{} }
  └→ ingestSingleProject(currentPath, persist)  → { nodes[], edges[], properties{} }
      ↓
  Returns: { externalGraph, currentGraph }
      ↓
  Consumed by: integr8/index.js → relationshipAnalyzer → pathGenerator
  Consumed by: graphBuilder.js → dependency graph with health scoring
  Consumed by: backgroundIndexer.js → insight extraction → SQLite persistence
```

---

## Summary of Findings

### Critical Issues (BROKEN)

1. **5 Missing Parser Dependencies (Lines 53-57):** `storeParser.js`, `routeParser.js`, `commandParser.js`, `typeParser.js`, `uiParser.js` do not exist on disk. The module will throw `MODULE_NOT_FOUND` on load, making ALL exports unreachable.

### Dead Code

2. **`fallbackChainParser()` (Lines 208-226):** Defined but never called. The regex fallback tier is implemented but not wired into the ingestion pipeline.
3. **`CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts` (Line 67):** Defined but never read.
4. **`getParserHealthReport()` and `resetParserHealth()` (Lines 228-234):** Exported but no callers found in codebase.

### Design Issues

5. **`nodeCounter` module-level state (Line 365):** Not reset in `ingestSingleProject()`, only in `ingestProjectData()`. Direct callers of `ingestSingleProject` (like `backgroundIndexer`) get accumulating counters.
6. **`targetPages` accepted but unused (Line 1088):** The parameter is logged but never used for filtering.
7. **UI parser result not persisted (Line 907):** All other parser results are stored in `rawResults` for persistence, but `uiText` is not.
8. **IMPORT/EXPORT nodes created but never connected via edges:** `buildEdges()` creates `CONTAINS`, `NAVIGATES_TO`, and `INVOKES` edges but never creates `IMPORTS` or `DEPENDS_ON` edges from the IMPORT/EXPORT nodes.
9. **Synchronous AST extraction in async context (Line 965):** `extractImportsAndExports` is synchronous and may block the event loop on large projects.
10. **`isPublicAPIExport` path matching (Line 699):** `endsWith` can produce false positives for files with similar suffixes but different paths.
