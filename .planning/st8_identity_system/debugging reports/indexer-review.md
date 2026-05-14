# Code Review Report: `backend/indexer.js`

**Reviewed:** 2026-05-13T14:30:00Z
**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/indexer.js`
**Depth:** standard
**Status:** FAIL — 2 critical issues found

---

## Summary

Reviewed `indexer.js` against `persistence.js`, `st8-types.js`, and the upstream lib modules (`graphBuilder.js`, `astParser.js`). The file has two critical async/shape-mismatch bugs that cause silent data loss when the graph builder is available, plus two warnings around import data loss and path resolution logic.

**Schema consistency: PASS** — The ST8_SCHEMA in `indexer.js` (lines 79–156) is identical to `persistence.js` (lines 47–124). Column naming is consistent throughout (camelCase).

**Fingerprint generation: PASS** — `generateFingerprint` from `st8-types.js` is used correctly at line 361. The `filepath:birthTimestamp` format matches the `parseFingerprint` implementation (uses `lastIndexOf(':')` to handle colons in paths).

**Import statements: PASS** — `require('./st8-types')` correctly imports `generateFingerprint` which is the only symbol used from that module.

---

## Critical Issues

### CR-01: `buildGraph` doesn't await async `buildDependencyGraph` — silent data loss

**File:** `indexer.js:235-253` and `indexer.js:382-393`

**Issue:** `buildGraph()` is a synchronous function, but `graphBuilder.buildDependencyGraph()` (in `lib/commands/graphBuilder.js:21`) is `async` — it returns a Promise, not a result array. When the graph builder is available:

1. Line 245: `graphBuilder.buildDependencyGraph(targetDir)` returns a `Promise`
2. Line 246: `return result` returns the Promise as-is (no `await`)
3. Line 382: `classifiedFiles` is now a Promise object
4. Line 386: `classifiedFiles.find(...)` — Promises don't have a `.find()` method, so `classification` is always `undefined` → `{}`
5. Lines 389-391: Every file gets default values: `status: 'RED'`, `reachabilityScore: 0.0`, `impactRadius: 0`

**Impact:** When the lib graph builder module exists on disk, ALL classification data is silently discarded. Every file is marked RED/0.0/0 regardless of actual dependency analysis.

**Fix:** Make `buildGraph` async and await the result in `indexDirectory`:

```javascript
// indexer.js:235
async function buildGraph(files, targetDir) {
    const graphBuilder = getGraphBuilder();
    if (!graphBuilder) {
        console.warn('[st8:indexer] Graph builder not available, using basic classification');
        return classifyBasic(files, targetDir);
    }

    try {
        if (typeof graphBuilder.buildDependencyGraph === 'function') {
            const result = await graphBuilder.buildDependencyGraph(targetDir);
            return result;  // Now properly awaited
        }
        return classifyBasic(files, targetDir);
    } catch (err) {
        console.error('[st8:indexer] Error building graph:', err.message);
        return classifyBasic(files, targetDir);
    }
}

// indexer.js:382 (in indexDirectory)
const classifiedFiles = await buildGraph(parsedFiles, targetDir);
```

---

### CR-02: `buildDependencyGraph` return shape doesn't match merge logic

**File:** `indexer.js:382-393`

**Issue:** Even if CR-01 is fixed (async is resolved), `buildDependencyGraph` returns a completely different shape than what the merge logic expects:

- **Expected by indexer (from `classifyBasic`):** An array of `{ filepath, filename, status, reachabilityScore, impactRadius }`
- **Actual from `buildDependencyGraph`:** `{ nodes: [...], circularDeps: [...], orphanedFiles: [...], deadImports: [...], healthScore: N, totalNodes: N, ... }`

The merge at line 386 does:
```javascript
const classification = classifiedFiles.find(c => c.filepath === file.filepath) || {};
```

But `classifiedFiles` is an object (not an array), so `.find()` will throw a TypeError. Additionally, node objects in the `nodes` array use `path` (not `filepath`) and `health` (not `status`).

**Fix:** Add an adapter after awaiting `buildDependencyGraph`:

```javascript
async function buildGraph(files, targetDir) {
    const graphBuilder = getGraphBuilder();
    if (!graphBuilder) {
        return classifyBasic(files, targetDir);
    }

    try {
        if (typeof graphBuilder.buildDependencyGraph === 'function') {
            const report = await graphBuilder.buildDependencyGraph(targetDir);
            // Adapt graphBuilder shape to classifyBasic shape
            return (report.nodes || [])
                .filter(n => n.type === 'FILE')  // Only file nodes
                .map(n => ({
                    filepath: n.path || n.name,
                    filename: path.basename(n.path || n.name),
                    status: mapHealthToStatus(n.health),
                    reachabilityScore: n.health === 'healthy' ? 0.95 :
                                       n.health === 'partial' ? 0.5 : 0.0,
                    impactRadius: n.impactRadius || 0
                }));
        }
        return classifyBasic(files, targetDir);
    } catch (err) {
        console.error('[st8:indexer] Error building graph:', err.message);
        return classifyBasic(files, targetDir);
    }
}

function mapHealthToStatus(health) {
    const map = { healthy: 'GREEN', partial: 'YELLOW', unused: 'RED', broken: 'RED' };
    return map[health] || 'RED';
}
```

---

## Warnings

### WR-01: Import specifier data silently discarded during mapping

**File:** `indexer.js:373-378`

**Issue:** The AST parser (`astParser.js:224-257`) returns import objects shaped as:
```javascript
{ source: string, specifiers: [{ name, alias, isType }], importType: string, line: number }
```

But the indexer maps them to:
```javascript
{ source: imp.source, names: imp.names || [], isDefault: imp.isDefault || false }
```

- `imp.names` is always `undefined` → `names` is always `[]`
- `imp.isDefault` is always `undefined` → `isDefault` is always `false`

All parsed import specifier information (actual imported names, default vs named vs namespace) is lost.

**Fix:** Map from the correct AST parser fields:

```javascript
imports: imports.map(imp => ({
    source: imp.source,
    names: (imp.specifiers || []).map(s => s.name),
    isDefault: imp.importType === 'default'
}))
```

---

### WR-02: `classifyBasic` import resolution doesn't handle file extensions

**File:** `indexer.js:271-276`

**Issue:** When resolving relative imports like `import { x } from './utils'`:

```javascript
const resolved = path.resolve(dir, imp.source);  // → /abs/path/utils (no extension)
const relPath = path.relative(targetDir, resolved);  // → utils (no extension)
importedBy.add(relPath);  // Adds "utils"
```

But `allFiles` contains entries like `utils.js` (with extension). The check `importedBy.has(relPath)` at line 282 compares `utils` against `utils.js` — no match. Files imported without explicit extensions (the common case in JS/TS) may be incorrectly classified as RED.

**Fix:** Try resolving with common extensions:

```javascript
const dir = path.dirname(filePath);
const resolved = path.resolve(dir, imp.source);
let relPath = path.relative(targetDir, resolved);

// Try matching with extensions if exact match fails
if (!allFiles.has(relPath)) {
    for (const ext of CODE_EXTENSIONS) {
        if (allFiles.has(relPath + ext)) {
            relPath = relPath + ext;
            break;
        }
    }
}
importedBy.add(relPath);
```

---

## Info

### IN-01: `require('crypto')` placed mid-file instead of with top-level imports

**File:** `indexer.js:193`

**Issue:** `const crypto = require('crypto')` is on line 193, between section headers, while all other `require` statements are at lines 14–16. Node.js handles this fine, but it's inconsistent with standard module conventions and the project's own style.

**Fix:** Move to the top of the file with other imports:
```javascript
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { generateFingerprint } = require('./st8-types');
```

---

### IN-02: Lazy-loaded modules retry file existence check on every call when missing

**File:** `indexer.js:44-49`

**Issue:** When a lib module is missing, `loadLibModule` returns `null`, which is assigned to the cache variable (e.g., `_astParser = null`). Since `null` is falsy, the next call to `getAstParser()` re-enters the `if (!_astParser)` branch and retries the file existence check. This means a missing module triggers `fs.existsSync()` on every call to the getter.

**Fix:** Use a sentinel value to distinguish "not yet loaded" from "loaded as null":
```javascript
const NOT_LOADED = Symbol('NOT_LOADED');
let _astParser = NOT_LOADED;

function getAstParser() {
    if (_astParser === NOT_LOADED) {
        _astParser = loadLibModule('utils/astParser.js');
    }
    return _astParser;
}
```

---

## Checklist

| Check | Result |
|-------|--------|
| Syntax errors | ✅ None |
| Schema consistency (indexer ↔ persistence) | ✅ Identical |
| Fingerprint generation correctness | ✅ Correct |
| Import statements | ✅ Correct |
| Column naming consistency | ✅ Consistent camelCase |
| Async/await correctness | ❌ CR-01, CR-02 |
| Data shape compatibility | ❌ CR-02, WR-01 |
| Path resolution correctness | ⚠️ WR-02 |

---

_Reviewed: 2026-05-13T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
