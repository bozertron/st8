---
file: backend/index.js
reviewed: 2026-05-13T00:00:00Z
depth: standard
status: issues_found
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
---

# `backend/index.js` — Code Review Report

**Reviewed:** 2026-05-13
**Depth:** Standard (cross-file analysis of imports + API contracts)
**Status:** ⚠️ ISSUES FOUND — 0 Critical, 5 Warning, 3 Info

---

## Summary

The main entry point for the ST8 backend is syntactically valid, all imports resolve to real exports in their respective modules, and the overall pipeline (index → persist → emit schema cards → watch → notify) is wired correctly. However, several quality issues were found: a duplicate notification publish for EDIT mutations, missing NaN validation on the `--port` argument, imported enum constants (`MutationType`, `ActorType`) that are never used (string literals used instead), degraded schema card data in the watcher, and redundant inline `require()` calls.

---

## Import Verification

| Import | Source Module | Export Exists? | Status |
|--------|-------------|---------------|--------|
| `indexDirectory` | `./indexer` | ✅ line 449 | OK |
| `St8Persistence` | `./persistence` | ✅ line 492 | OK |
| `writeManifests` | `./manifestGenerator` | ✅ line 171 | OK |
| `FileWatcher` | `./fileWatcher` | ✅ line 138 | OK |
| `St8Server` | `./server` | ✅ line 634 | OK |
| `generateFingerprint` | `./st8-types` | ✅ line 241 | OK |
| `MutationType` | `./st8-types` | ✅ line 36 | OK |
| `ActorType` | `./st8-types` | ✅ line 49 | OK |
| `SchemaCardEmitter` | `./schemaCardEmitter` | ✅ line 192 | OK |
| `SchemaCardPrinter` | `./schemaCardPrinter` | ✅ line 196 | OK |
| `notificationBus` | `./notificationBus` | ✅ line 107 | OK |

All 11 imports resolve correctly. No broken requires.

---

## Pipeline Wiring Verification

| Step | Code Location | Status |
|------|--------------|--------|
| Initial indexing | line 82: `indexDirectory(targetDir, { write: true })` | ✅ OK |
| SQLite persistence | lines 94-118: upsertFile + logMutation per file | ✅ OK |
| Connection wiring | lines 122-141: Pass 2 resolves imports | ✅ OK (fuzzy match — see WR-04 info note) |
| Activity logging | lines 143-150: logActivity after indexing | ✅ OK |
| Manifest generation | line 154: `writeManifests(result.files, targetDir)` | ✅ OK |
| Schema card emission | line 158: `emitter.emitAllCards(persistence)` | ✅ OK |
| Schema card printing | line 159: `printer.printAllFromCards(...)` | ✅ OK |
| Notification bus printer | line 87: `notificationBus.setPrinter(printer)` | ✅ OK |
| Watcher mutation logging | lines 228-235, 263-270: logMutation on CREATE/EDIT | ✅ OK |
| Watcher notifications | lines 237-243, 272-278: notificationBus.publish | ⚠️ Duplicate on EDIT |
| Watcher schema card | line 281: `emitter.emitCard(...)` | ⚠️ Degraded data |
| Watcher manifest regen | lines 305-308: `writeManifests` on change | ✅ OK |
| Graceful shutdown | lines 329-335: SIGINT handler | ✅ OK |

---

## Warnings

### WR-01: Duplicate `notificationBus.publish()` for EDIT Mutations

**File:** `backend/index.js:272-293`
**Severity:** WARNING

When a file changes (hash mismatch in the `else` branch), the code publishes **two** notifications:

1. **Line 272-278:** Publishes EDIT mutation without schema card
2. **Line 286-293:** Publishes the same EDIT mutation again, this time with `schemaCard`

This means SSE clients receive two events, the console logs the mutation twice, and the printer fallback fires on the second one. The first publish is redundant.

**Fix:** Remove the first `notificationBus.publish()` call (lines 272-278) and keep only the second one (lines 286-293) which includes the schema card:

```javascript
// DELETE lines 272-278 (first publish)
// KEEP lines 286-293 (second publish with schemaCard)
```

---

### WR-02: `--port` Argument Not Validated — `parseInt(undefined)` → `NaN`

**File:** `backend/index.js:65`
**Severity:** WARNING

```javascript
const port = portArg !== -1 ? parseInt(args[portArg + 1]) : 3847;
```

If `--port` is the last argument (no value follows), `args[portArg + 1]` is `undefined`, and `parseInt(undefined)` returns `NaN`. The server will then try to listen on port `NaN`, which will fail with a confusing error. Similarly, if a non-numeric value follows `--port`, the same issue occurs.

**Fix:**
```javascript
const port = portArg !== -1 ? (parseInt(args[portArg + 1], 10) || 3847) : 3847;
```

Or, for stricter validation:
```javascript
let port = 3847;
if (portArg !== -1) {
    const parsed = parseInt(args[portArg + 1], 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
        console.error(`[st8] Invalid port: ${args[portArg + 1]}`);
        process.exit(1);
    }
    port = parsed;
}
```

---

### WR-03: Imported `MutationType` and `ActorType` Constants Never Used

**File:** `backend/index.js:19` (import) vs lines 114, 116, 229, 233, 264, 268 (usage)
**Severity:** WARNING

Line 19 imports `MutationType` and `ActorType`:
```javascript
const { generateFingerprint, MutationType, ActorType } = require('./st8-types');
```

But every mutation logging call uses raw string literals instead:
- Line 114: `mutationType: 'CREATE'` → should be `mutationType: MutationType.CREATE`
- Line 116: `actor: 'INDEXER'` → should be `actor: ActorType.INDEXER`
- Line 229: `mutationType: 'CREATE'` → `mutationType: MutationType.CREATE`
- Line 233: `actor: 'WATCHER'` → `actor: ActorType.WATCHER`
- Line 264: `mutationType: 'EDIT'` → `mutationType: MutationType.EDIT`
- Line 268: `actor: 'WATCHER'` → `actor: ActorType.WATCHER`

This defeats the purpose of having a single source of truth for enum values. A typo in a string literal would silently corrupt data.

**Fix:** Replace all string literals with the imported constants.

---

### WR-04: Schema Card Emission in Watcher Passes Empty/Null Data

**File:** `backend/index.js:281-284`
**Severity:** WARNING

```javascript
const card = emitter.emitCard(changedFile, { imports: [], exports: [] },
    { importedBy: [], imports: [] }, null,
    { count: persistence.getMutationCount(changedFile.fingerprint),
      lastMutation: persistence.getLastMutation(changedFile.fingerprint) });
```

When a file changes, the emitted schema card has:
- **Empty exports** — no AST parsing performed
- **Empty imports** — no AST parsing performed
- **Empty connections** — not queried from DB
- **Null intent** — not loaded from DB

This means schema cards emitted during watch mode are degraded compared to those emitted during initial indexing. Any downstream consumer relying on schema card completeness will get stale/incomplete data.

**Fix:** At minimum, load intent from persistence and query connections:
```javascript
const intent = persistence.getIntent(changedFile.fingerprint);
const connections = persistence.getConnectionsForFile(changedFile.fingerprint);
// Parse connections into importedBy/imports arrays
```

AST parsing may be intentionally skipped for performance, but intent and connections should be loaded.

---

### WR-05: Redundant `require()` Calls Inside Already-Scoped Function

**File:** `backend/index.js:153` and `backend/index.js:306`
**Severity:** WARNING

`writeManifests` is already imported at the top of the file (line 16):
```javascript
const { writeManifests } = require('./manifestGenerator');
```

It is then redundantly re-required at:
- **Line 153:** Inside the `if (result.files && result.files.length > 0)` block
- **Line 306:** Inside the watcher `onFileChange` callback

While `require()` caches modules so there's no performance cost, this creates confusion about which scope the function is in and suggests the author may have forgotten about the top-level import.

**Fix:** Remove the redundant `require()` at lines 153 and 306. The top-level import at line 16 is sufficient.

---

## Info

### IN-01: Inline `require('fs')` and `require('crypto')` in Watcher Callback

**File:** `backend/index.js:202-203, 253-255`
**Severity:** INFO

The watcher callback uses inline `require('fs')` and `require('crypto')`:
```javascript
const content = require('fs').readFileSync(change.path);
const hash = require('crypto').createHash('sha256').update(content).digest('hex');
```

Neither `fs` nor `crypto` is imported at the top of `index.js`. While `require()` caches modules, hoisting these to the top would improve readability and follow standard Node.js conventions.

**Fix:** Add to the top-level imports:
```javascript
const fs = require('fs');
const crypto = require('crypto');
```

---

### IN-02: `unhandledRejection` Handler Swallows Errors

**File:** `backend/index.js:27-30`
**Severity:** INFO

```javascript
process.on('unhandledRejection', (reason, promise) => {
    console.error('[st8] Unhandled Promise Rejection:', reason);
    // Don't crash — log and continue
});
```

This intentionally swallows unhandled promise rejections. The comment indicates this is deliberate, but in production this can hide serious bugs. In Node.js 15+, unhandled rejections crash by default — this handler suppresses that safety net.

**Consideration:** This may be acceptable for a development tool, but should be reviewed if the tool is ever used in production.

---

### IN-03: Fuzzy Import Resolution in Pass 2 Could Produce False Positives

**File:** `backend/index.js:125-128`
**Severity:** INFO

```javascript
const targetFile = result.files.find(f =>
    f.filepath.endsWith(imp.source) ||
    f.filepath.includes(imp.source.replace(/^\.\//, ''))
);
```

The `endsWith` match could produce false positives (e.g., `imp.source = 'utils.js'` matches both `backend/utils.js` and `src/utils.js`). The `includes` fallback makes this even more ambiguous. This same logic also exists in the watcher callback. For a small codebase this is unlikely to cause issues, but for larger projects with identically-named files, wrong connections could be wired.

---

## Verdict

The file is **syntactically correct**, all **imports resolve**, and the **pipeline is properly wired** (index → persist → emit → watch → notify → shutdown). The issues found are quality/robustness concerns, not showstoppers. The most impactful fix would be **WR-01** (duplicate notifications) and **WR-03** (use enum constants instead of string literals) as both affect data correctness and debugging clarity.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
