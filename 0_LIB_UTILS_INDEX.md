# LIB/UTILS FILE INDEX

**Directory:** `lib/utils/`
**Files:** 4
**Generated:** 2026-05-14

---

## 1. astParser.js (1066 lines)

**Purpose:** AST-based import/export extraction using @babel/parser
**Source:** Compiled from `src/utils/astParser.ts`
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `extractImportsAndExports` | function | 39 | Main extraction function (file path) |
| `extractFromText` | function | 40 | Text-based extraction (content string) |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `extractCommonJSExportsFromAST` | 48-139 | CommonJS export detection |
| `extractImportsAndExports` | 147-312 | Main AST-based extraction |
| `extractFromText` | 317-322 | Regex-based extraction fallback |
| `parseImportDeclaration` | 324-357 | Import statement parsing |
| `parseExportDeclaration` | 358-480 | Export statement parsing |
| `parseDefaultExport` | 481-520 | Default export parsing |
| `buildFunctionSignature` | 521-528 | Function signature builder |
| `buildArrowSignature` | 529-538 | Arrow function signature builder |
| `extractDynamicImportsFromAST` | 606-674 | Dynamic import detection |
| `extractRequireStatements` | 692-704 | Require statement detection |
| `extractImportsViaRegex` | 705-732 | Regex import fallback |
| `extractExportsViaRegex` | 733-755 | Regex export fallback |
| `extractScriptFromVue` | 762-779 | Vue SFC script extraction |
| `resolveModulePath` | 785-804 | Module path resolution |
| `resolveExportStar` | 809-874 | Star export resolution |
| `traceReexportChain` | 879-928 | Re-export chain tracing |
| `extractParamTypes` | 933-942 | Parameter type extraction |
| `detectPurity` | 950-969 | Purity detection heuristic |
| `computeComplexity` | 974-1019 | Complexity computation |
| `extractJsDocTags` | 1023-1065 | JSDoc tag extraction |

### Dependencies
- `@babel/parser` (external)
- `fs` (Node.js)
- `path` (Node.js)

### Proposed Target
- `src/0_shared/0_utils/0_ast-parser.js`

---

## 2. safeFs.js (598 lines)

**Purpose:** Fortified filesystem wrapper — never throws, always returns typed Result<T, FsError>
**Source:** Compiled from `src/utils/safeFs.ts`
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `isTransient` | function | 49 | Check if error is transient |
| `isPermission` | function | 50 | Check if error is permission-related |
| `isMissing` | function | 51 | Check if file is missing |
| `isCorrupt` | function | 52 | Check if file is corrupt |
| `registerFallback` | function | 53 | Register fallback path |
| `safeReadFile` | function | 54 | Safe file reading |
| `safeWriteFile` | function | 55 | Safe file writing |
| `safeReaddir` | function | 56 | Safe directory reading |
| `safeMkdir` | function | 57 | Safe directory creation |
| `safeStat` | function | 58 | Safe stat |
| `safeAccess` | function | 59 | Safe access check |
| `safeUnlink` | function | 60 | Safe file deletion |
| `safeLstat` | function | 61 | Safe lstat |
| `FileHandlePool` | class | 439 | File handle pooling |
| `WriteBufferPool` | class | 598 | Write buffer pooling |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `classifyErrorCode` | 65-78 | Error code classification |
| `classifySeverity` | 79-96 | Error severity classification |
| `isRetryable` | 97-99 | Retryability check |
| `buildFsError` | 100+ | Build structured error |
| `safeReadFile` | - | Safe file reading with retry |
| `safeWriteFile` | - | Safe file writing with retry |

### Dependencies
- `fs` (Node.js)
- `path` (Node.js)

### Proposed Target
- `src/0_shared/0_utils/0_safe-fs.js`

---

## 3. ioChan.js (395 lines)

**Purpose:** Priority-based I/O channel router with circuit breakers
**Source:** Compiled from `src/utils/ioChan.ts`
**Status:** ✅ Working

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `IoChannelPriority` | enum | 28 | Priority levels (CRITICAL, IMPORTANT, ANALYSIS, BEST_EFFORT) |
| `BreakerState` | enum | 35 | Circuit breaker states (CLOSED, OPEN, HALF_OPEN) |
| `CircuitBreaker` | class | 156 | Circuit breaker implementation |
| `IoChan` | class | 392 | I/O channel router |
| `ioChan` | singleton | 395 | Shared IoChan instance |

### Key Classes
| Class | Lines | Purpose |
|-------|-------|---------|
| `CircuitBreaker` | 36-155 | Circuit breaker with failure threshold, cooldown, probing |
| `IoChan` | 157-391 | Priority-based I/O router with concurrency control |

### Dependencies
- None (pure Node.js)

### Proposed Target
- `src/0_shared/0_utils/0_io-chan.js`

---

## 4. groundPlane.js (268 lines)

**Purpose:** Pre-verifies critical directory structure on startup
**Source:** Compiled from `src/utils/groundPlane.ts`
**Status:** ⚠️ RED — no consumers

### Exports
| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `initGroundPlane` | function | 49 | Initialize ground plane |
| `getVerifiedPath` | function | 50 | Get verified path for type |
| `validateGroundPlane` | function | 51 | Validate all paths |
| `getGroundPlanePaths` | function | 52 | Get all ground plane paths |

### Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `getDefaultPaths` | 59-83 | Get default directory paths |
| `initGroundPlane` | 92+ | Initialize and verify directories |
| `getVerifiedPath` | - | Get verified path for type |
| `validateGroundPlane` | - | Validate all paths |

### Dependencies
- `fs` (Node.js)
- `path` (Node.js)
- `os` (Node.js)
- `./safeFs.js`

### Proposed Target
- `src/0_shared/0_utils/0_ground-plane.js`

---

## Summary

| File | Lines | Exports | Status | Proposed Target |
|------|-------|---------|--------|-----------------|
| `astParser.js` | 1066 | 2 | ✅ Working | `src/0_shared/0_utils/0_ast-parser.js` |
| `safeFs.js` | 598 | 15 | ✅ Working | `src/0_shared/0_utils/0_safe-fs.js` |
| `ioChan.js` | 395 | 5 | ✅ Working | `src/0_shared/0_utils/0_io-chan.js` |
| `groundPlane.js` | 268 | 4 | ⚠️ RED | `src/0_shared/0_utils/0_ground-plane.js` |

**Total:** 2327 lines, 26 exports

---

*Generated for architecture refactoring reference*
