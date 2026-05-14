# Schema Card Review — lib/utils

**Reviewed:** 2026-05-14
**Source:** `.st8/schema-cards/lib_utils_*.json`
**Files:** 4 schema cards

---

## Exports Summary

| Module | Export | Kind | Line | Visibility |
|--------|--------|------|------|------------|
| `astParser.js` | `extractImportsAndExports` | variable | 39 | named |
| `astParser.js` | `extractFromText` | variable | 40 | named |
| `groundPlane.js` | `initGroundPlane` | variable | 49 | named |
| `groundPlane.js` | `getVerifiedPath` | variable | 50 | named |
| `groundPlane.js` | `validateGroundPlane` | variable | 51 | named |
| `groundPlane.js` | `getGroundPlanePaths` | variable | 52 | named |
| `ioChan.js` | `ioChan` | variable | 16 | named |
| `ioChan.js` | `IoChan` | variable | 16 | named |
| `ioChan.js` | `CircuitBreaker` | variable | 16 | named |
| `ioChan.js` | `BreakerState` | variable | 16 | named |
| `ioChan.js` | `IoChannelPriority` | variable | 16 | named |
| `safeFs.js` | `WriteBufferPool` | variable | 48 | named |
| `safeFs.js` | `FileHandlePool` | variable | 48 | named |
| `safeFs.js` | `isTransient` | variable | 49 | named |
| `safeFs.js` | `isPermission` | variable | 50 | named |
| `safeFs.js` | `isMissing` | variable | 51 | named |
| `safeFs.js` | `isCorrupt` | variable | 52 | named |
| `safeFs.js` | `registerFallback` | variable | 53 | named |
| `safeFs.js` | `safeReadFile` | variable | 54 | named |
| `safeFs.js` | `safeWriteFile` | variable | 55 | named |
| `safeFs.js` | `safeReaddir` | variable | 56 | named |
| `safeFs.js` | `safeMkdir` | variable | 57 | named |
| `safeFs.js` | `safeStat` | variable | 58 | named |
| `safeFs.js` | `safeAccess` | variable | 59 | named |
| `safeFs.js` | `safeUnlink` | variable | 60 | named |
| `safeFs.js` | `safeLstat` | variable | 61 | named |

---

## Imports (Source Modules)

| Module | Imports From | Type |
|--------|-------------|------|
| `astParser.js` | `@babel/parser` | npm (external) |
| `groundPlane.js` | `./safeFs.js` | internal |
| `ioChan.js` | *(none)* | — |
| `safeFs.js` | *(none)* | — |

---

## Dependency Graph

```
                   ┌─────────────────┐
                   │   astParser.js  │
                   │  (GREEN, ext.)  │
                   │  @babel/parser  │
                   └────────┬────────┘
                            │ (no internal consumers)
                            ▼
                   ┌─────────────────┐
                   │  groundPlane.js │
                   │    (RED)        │──────────┐
                   │  4 exports      │          │ imports
                   └─────────────────┘          ▼
                                        ┌─────────────────┐
                                        │   safeFs.js     │
                                        │  (GREEN)        │
                                        │  15 exports     │
                                        └─────────────────┘

                   ┌─────────────────┐
                   │   ioChan.js     │
                   │  (GREEN)        │
                   │  5 exports      │
                   │  no deps/consumers
                   └─────────────────┘
```

### Connection Details

| Module | importedBy (consumers) | imports (dependencies) |
|--------|----------------------|----------------------|
| `astParser.js` | *(none)* | *(external only: @babel/parser)* |
| `groundPlane.js` | *(none)* | `safeFs.js` |
| `ioChan.js` | *(none)* | *(none)* |
| `safeFs.js` | `groundPlane.js` | *(none)* |

---

## Intent & Purpose

| Module | Purpose | Depends On Behavior | Value Statement | Status |
|--------|---------|-------------------|-----------------|--------|
| `astParser.js` | AST parsing and analysis | parser | `extractImportsAndExports` API, `extractFromText` API | **GREEN** |
| `groundPlane.js` | Ground plane abstraction | file system operations | `initGroundPlane`, `getVerifiedPath`, `validateGroundPlane`, `getGroundPlanePaths` APIs | **RED** |
| `ioChan.js` | I/O channel abstraction | No external dependencies | `adopt`, `fulfilled`, `rejected`, `step`, `CircuitBreaker`, `IoChan` APIs | **GREEN** |
| `safeFs.js` | Safe file system operations | No external dependencies | 24 APIs covering safe fs wrappers, error classification, retry logic, resource pooling, fallbacks | **GREEN** |

---

## Per-Module Summary

### `astParser.js` — GREEN
AST parsing utility that extracts import/export declarations from JavaScript source using Babel parser. Exposes two functions: one for file-based extraction and one for raw text. Self-contained with no internal consumers detected.

### `groundPlane.js` — RED
Ground plane abstraction layer for managing and validating project file paths. Depends on `safeFs.js` for filesystem operations. **Status RED with reachabilityScore 0 and no consumers** — either unused/orphaned, or consumers exist outside the indexed scope.

### `ioChan.js` — GREEN
I/O channel abstraction implementing a circuit breaker pattern for resilient I/O operations. Defines priority levels and breaker state management. All 5 exports share line 16 (likely re-exported from a single declaration). No dependencies and no detected consumers.

### `safeFs.js` — GREEN
Comprehensive safe filesystem library providing error-classifying, retry-aware wrappers around Node.js `fs` operations. Includes resource pooling (`WriteBufferPool`, `FileHandlePool`), error classification helpers (`isTransient`, `isPermission`, `isMissing`, `isCorrupt`), and a fallback path registration system. Consumed by `groundPlane.js`.

---

## Observations & Flags

| # | Severity | Module | Observation |
|---|----------|--------|-------------|
| 1 | ⚠️ WARN | all | All `intent` fields contain `???` suffixes — indexer confidence is low; intent was auto-generated, not curated |
| 2 | 🔴 RED | `groundPlane.js` | Status is RED with `reachabilityScore: 0` and `importedBy: []` — this module appears orphaned or unvalidated |
| 3 | ⚠️ WARN | `astParser.js`, `ioChan.js` | `importedBy: []` with `reachabilityScore: 0.95` — high reachability but no indexed consumers is contradictory; graph may be incomplete |
| 4 | ℹ️ INFO | `ioChan.js` | All 5 exports on line 16 — likely a destructured re-export (`module.exports = { ioChan, IoChan, ... }`) |
| 5 | ℹ️ INFO | `safeFs.js` | Intent `valueStatement` lists 24+ internal APIs (adopt, fulfilled, rejected, step, classifyErrorCode, etc.) but only 15 are in `exports` — internal helpers not exported are listed in intent but not in exports array |
| 6 | ⚠️ WARN | `safeFs.js` | No `imports` recorded despite being a 23KB file — likely uses Node.js built-in `fs`/`path` which the indexer doesn't track, but worth verifying |
| 7 | ℹ️ INFO | `astParser.js` | Only module with npm external dependency (`@babel/parser`) — others are self-contained |
