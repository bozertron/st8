# Indexer Debug Report — CR-01 & CR-02

**Date:** 2026-05-13
**File:** `backend/indexer.js`
**Status:** FIXED

---

## Issue CR-01: `buildGraph()` returns Promise instead of resolved results

### Problem Description

`buildGraph()` (line 235) is a **synchronous** function, but it calls `graphBuilder.buildDependencyGraph(targetDir)` which is **async** (it's wrapped in `__awaiter` in `lib/commands/graphBuilder.js` line 22). Calling an async function from a synchronous context returns a **Promise object**, not the resolved value.

The downstream consumer in `indexDirectory()` does:
```javascript
const classifiedFiles = buildGraph(parsedFiles, targetDir);  // Promise, not Array
const classification = classifiedFiles.find(c => c.filepath === file.filepath) || {};
```

Since `classifiedFiles` is a Promise (not an array), `classifiedFiles.find` is `undefined`, and invoking it throws `TypeError: classifiedFiles.find is not a function`. This crashes the indexer whenever the graphBuilder module is available.

**Impact:** When `graphBuilder.js` is loadable (which is the normal case in the st8 project), the indexer always crashes. The only code path that works is the fallback `classifyBasic()` which is reached when the graphBuilder module is missing.

### Root Cause

Async/sync mismatch. The function `buildGraph` was written as synchronous but delegates to an async library function. JavaScript's `async`/`await` requires the caller to also be `async` and to `await` the result.

### Fix Applied

1. Made `buildGraph` an `async function`
2. Added `await` before the call to `graphBuilder.buildDependencyGraph(targetDir)`
3. Added `await` at the call site in `indexDirectory()` (line 407)

**Before:**
```javascript
function buildGraph(files, targetDir) {
    // ...
    const result = graphBuilder.buildDependencyGraph(targetDir);
    return result;  // Returns a Promise!
}
```

**After:**
```javascript
async function buildGraph(files, targetDir) {
    // ...
    const report = await graphBuilder.buildDependencyGraph(targetDir);
    // report is now the resolved object, not a Promise
}
```

---

## Issue CR-02: Shape mismatch between `buildDependencyGraph` return value and merge logic

### Problem Description

Even after fixing the async issue (CR-01), there's a data shape mismatch. `buildDependencyGraph()` in `graphBuilder.js` returns an **object** with this structure:

```javascript
{
    nodes: healthyNodes,        // Array of node objects with { id, type, path, name, health, consumers, dependencies, impactRadius }
    circularDeps: [...],        // Array of cycle objects
    orphanedFiles: [...],       // Array of file path strings
    deadImports: [...],         // Array of import name strings
    healthScore: 0.85,          // Number
    totalNodes: 42,             // Number
    healthyCount: 30,           // Number
    partialCount: 5,            // Number
    unusedCount: 4,             // Number
    brokenCount: 3              // Number
}
```

But the merge logic in `indexDirectory()` expects an **array** of classification objects:

```javascript
classifiedFiles.find(c => c.filepath === file.filepath)
// Expects: [{ filepath, status, reachabilityScore, impactRadius }, ...]
```

Additionally, the node properties don't match:
- Graph nodes use `path` → indexer expects `filepath`
- Graph nodes use `health` (`'healthy'`/`'broken'`/`'unused'`/`'partial'`) → indexer expects `status` (`'GREEN'`/`'RED'`/`'YELLOW'`)

Calling `.find()` on the returned object (which is not an array) would throw `TypeError: classifiedFiles.find is not a function`.

### Root Cause

The indexer was written assuming `buildDependencyGraph` returns a flat array of classification objects, but the actual library returns a structured report object with the node array nested under a `nodes` key, using different property names and health status values.

### Fix Applied

Added a transformation layer inside `buildGraph()` that converts the graphBuilder report into the format expected by the merge logic:

```javascript
const report = await graphBuilder.buildDependencyGraph(targetDir);

if (report && Array.isArray(report.nodes)) {
    const healthToStatus = {
        'healthy': 'GREEN',
        'broken': 'RED',
        'unused': 'YELLOW',
        'partial': 'YELLOW'
    };
    
    return report.nodes
        .filter(node => node.path)  // Only nodes with file paths (skip IMPORT nodes etc.)
        .map(node => ({
            filepath: node.path,
            filename: node.name || path.basename(node.path),
            status: healthToStatus[node.health] || 'RED',
            reachabilityScore: node.health === 'healthy' ? 0.95 : (node.health === 'unused' ? 0.1 : 0.0),
            impactRadius: node.impactRadius || 0
        }));
}
```

**Property mapping:**
| graphBuilder node | indexer classification | Transformation |
|---|---|---|
| `node.path` | `filepath` | Direct copy |
| `node.name` | `filename` | Fallback to `path.basename(node.path)` |
| `node.health` | `status` | `'healthy'→'GREEN'`, `'broken'→'RED'`, `'unused'/'partial'→'YELLOW'` |
| (derived from health) | `reachabilityScore` | `'healthy'→0.95`, `'unused'→0.1`, else `0.0` |
| `node.impactRadius` | `impactRadius` | Direct copy, default `0` |

A fallback to `classifyBasic()` is included if `report.nodes` is not an array (defensive programming for unexpected shapes).

---

## Verification Results

### Syntax Check
```
$ node -c backend/indexer.js
✓ No syntax errors
```

### Behavioral Analysis

| Scenario | Before Fix | After Fix |
|---|---|---|
| graphBuilder available | Crashes (TypeError on `.find()`) | Correctly classifies files using dependency graph |
| graphBuilder unavailable | Falls back to `classifyBasic()` | Same — falls back to `classifyBasic()` |
| `buildDependencyGraph` throws | Caught, falls back to `classifyBasic()` | Same — caught, falls back to `classifyBasic()` |
| Report has unexpected shape | N/A (crashed before reaching this) | Falls back to `classifyBasic()` with warning |

### Downstream Impact

- `indexDirectory()` is already `async` — no signature change needed
- `buildGraph` is exported but not imported by any other module — safe to change to async
- The CLI entry point (line 458) already uses `.then()/.catch()` — handles async correctly

---

## Files Changed

- `backend/indexer.js` — 2 changes:
  1. `buildGraph()`: Changed to `async`, added `await` on `buildDependencyGraph()` call, added result transformation from report shape to classification array
  2. `indexDirectory()`: Added `await` before `buildGraph()` call (line 407)
