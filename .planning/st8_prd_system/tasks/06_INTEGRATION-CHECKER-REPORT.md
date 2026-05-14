# Task 06 Integration Checker Report: Run Intent Seeder

**Verified:** 2026-05-13
**Status:** ISSUES FOUND — 2 BLOCKERs, 4 WARNINGs

---

## Verification Summary

| Check | Result | Details |
|-------|--------|---------|
| All 42 files have intent | ✅ PASS | file_registry: 42, file_intent: 42, 1:1 match |
| All intents have ??? flags | ✅ PASS | 42/42 purpose, 42/42 dependsOnBehavior, 42/42 valueStatement |
| Purposes are meaningful | ⚠️ PARTIAL | 14 files have leaked comment/filepath pollution in purpose |
| No orphan intents | ✅ PASS | 0 orphan intents, 0 files without intent |
| Intent data accuracy | ❌ FAIL | 2 files have semantically wrong `dependsOnBehavior` values |
| Purpose uniqueness | ⚠️ PARTIAL | 4 sets of files share identical generic purposes |

---

## BLOCKER Issues

### BL-01: Dynamic imports from schema cards pollute `dependsOnBehavior`

**Files affected:**
- `lib/commands/integr8/pathGenerator.js` — dependsOnBehavior contains `${toNode.name}` (a template literal, not a module)
- `lib/commands/integr8/migrationExecutor.js` — dependsOnBehavior contains `NewView.vue` (a Vue component reference, not a runtime dependency)

**Root cause:** `backend/intentSeeder.js:334-348` — `_parseFileContent()` treats schema card data as authoritative when `cardImports.length > 0 && cardExports.length > 0`. Schema cards mark dynamic imports with `isDynamic: true`, but `_generateDependsOn()` at lines 262-288 does not filter these out. Dynamic import sources like `./${toNode.name}` are template expressions evaluated at runtime, not static dependencies.

**Evidence from schema cards:**
```json
// lib_commands_integr8_pathGenerator.js.json
{ "importType": "dynamic", "isDynamic": true, "source": "./${toNode.name}", "specifiers": [] }

// lib_commands_integr8_migrationExecutor.js.json
{ "importType": "dynamic", "isDynamic": true, "source": "./views/NewView.vue", "specifiers": [] }
```

**Current output:**
```
pathGenerator:    dependsOnBehavior: "${toNode.name}, types ???"
migrationExecutor: dependsOnBehavior: "NewView.vue, types, tomlSerializer, child_process, cryptographic hashing ???"
```

**Fix:** Filter out dynamic imports in `_generateDependsOn()` or in `_parseFileContent()`:

```javascript
// In _parseFileContent(), after reading schema card imports:
const cardImports = (card.imports || []).filter(i => !i.isDynamic);
```

---

### BL-02: `persistence.initialize()` is `async` but callers do not `await`

**File:** `backend/persistence.js:135`
**Issue:** `St8Persistence.initialize()` is declared `async` and returns a Promise, but ALL callers in the seeder flow (and the executor report's verification script) call it without `await`:

```javascript
// Executor report verification (line 126):
const p = new St8Persistence();
p.initialize();  // Returns Promise, not awaited!
const seeder = new IntentSeeder(p, '.st8/schema-cards');
```

This works **by coincidence** because `better-sqlite3` operations are synchronous and the DB is fully initialized before the next line executes. If `initialize()` ever becomes truly async (e.g., adding network calls or fs operations with `await`), all callers will silently break — the seeder would attempt DB operations before the connection is ready.

**Fix:** Either remove `async` from `initialize()` (since all internal operations are synchronous) or ensure callers `await` the result:

```javascript
// Option A: Remove async (best if better-sqlite3 stays synchronous)
initialize() {
    // ... same body without async
}

// Option B: Keep async, fix callers
const p = new St8Persistence();
await p.initialize();
```

---

## WARNING Issues

### WR-01: Pattern ordering causes generic purpose before specific match

**File:** `backend/intentSeeder.js:22-78` — `FILENAME_PURPOSE_MAP`
**Issue:** The `/generator/i` pattern at index 8 matches before more specific patterns lower in the list. Since "first match wins," these files get overly generic purposes:

| File | Expected Purpose | Actual Purpose |
|------|-----------------|----------------|
| `backend/manifestGenerator.js` | Project manifest generation | Code or data generation |
| `backend/prdGenerator.js` | PRD generation | Code or data generation |
| `lib/commands/integr8/pathGenerator.js` | Path generation | Code or data generation |
| `lib/commands/integr8/reportGenerator.js` | Report generation | Code or data generation |

Similarly, `/schema[-_]?card/i` at index 7 matches before `/printer/i` at index 11:
| File | Expected Purpose | Actual Purpose |
|------|-----------------|----------------|
| `backend/schemaCardPrinter.js` | Output formatting and display | Schema card emission |

**Fix:** Reorder patterns so specific compound patterns come before generic ones:

```javascript
const FILENAME_PURPOSE_MAP = [
    { pattern: /manifest[-_]?gen/i, purpose: 'Project manifest generation' },
    { pattern: /prd[-_]?gen/i, purpose: 'PRD generation' },
    { pattern: /path[-_]?gen/i, purpose: 'Path generation' },
    { pattern: /report[-_]?gen/i, purpose: 'Report generation' },
    { pattern: /schema[-_]?card[-_]?print/i, purpose: 'Output formatting and display' },
    { pattern: /schema[-_]?card/i, purpose: 'Schema card emission' },
    { pattern: /generator/i, purpose: 'Code or data generation' },  // Generic last
    // ... rest of patterns
];
```

---

### WR-02: Source code comments used as purpose descriptors are often implementation notes

**File:** `backend/intentSeeder.js:212-218` — `_generatePurpose()` comment handling
**Issue:** The seeder picks up top-of-file comments (10-100 chars) and appends them to the purpose with `—` separator. Many of these are implementation notes, not purpose statements:

| File | Leaked Comment | Full Purpose |
|------|---------------|--------------|
| `phreak-terminal.js` | "Push to history" | "Terminal interface — Push to history ???" |
| `file-explorer.js` | "Hidden files are always shown (single-user tool, no toggle)" | "File explorer UI — Hidden files are always shown ..." |
| `graph-visualizer.js` | "Try to load D3 from CDN" | "Graph visualization — Try to load D3 from CDN ???" |
| `settings-ui.js` | "List of entries (e.g., sirkits, models)" | "Settings management — List of entries ..." |
| `overview.js` | "C:\orchestr8\scripts\prd src\overview.ts" | "Project overview display — C:\orchestr8\..." |
| `void-engine.js` | "the-editorial-engine.ts" | "Rendering engine — the-editorial-engine.ts ???" |
| `fake-stream.js` | "vendor/fake-stream.js" | "Stream mocking utility — vendor/fake-stream.js ???" |
| `settings-reader.js` | "vendor/settings-reader.js" | "Settings management — vendor/settings-reader.js ???" |
| `databasePersister.js` | "src/commands/integr8/databasePersister.ts" | "Database persistence operations — src/commands/..." |
| `ioChan.js` | "src/utils/ioChan.ts" | "I/O channel abstraction — src/utils/ioChan.ts ???" |
| `safeFs.js` | "src/utils/safeFs.ts" | "Safe file system operations — src/utils/safeFs.ts ???" |

**Fix:** Add comment filtering to skip filepaths, Windows paths, and obvious implementation notes:

```javascript
if (firstComment.length > 10 && firstComment.length < 100) {
    // Skip filepaths, Windows paths, and vendor references
    if (!firstComment.match(/^[A-Z]:\\/) &&
        !firstComment.match(/^vendor\//) &&
        !firstComment.match(/^src\//) &&
        !firstComment.match(/\.(ts|js|vue)$/) &&
        !firstComment.match(/^(Push|Try|List|Hidden)/)) {
        parts.push(firstComment);
    }
}
```

---

### WR-03: 4 file pairs share identical purpose — not distinguishable

**Files and shared purposes:**

| Purpose | Files |
|---------|-------|
| "Codebase indexing and analysis" | `backend/indexer.js`, `lib/commands/backgroundIndexer.js` |
| "Code or data generation" | `backend/manifestGenerator.js`, `backend/prdGenerator.js`, `lib/commands/integr8/pathGenerator.js`, `lib/commands/integr8/reportGenerator.js` |
| "SQLite persistence layer" | `backend/persistence.js`, `lib/commands/parserPersistence.js` |
| "Schema card emission" | `backend/schemaCardEmitter.js`, `backend/schemaCardPrinter.js` |

**Issue:** After the `???` flag is stripped, these files would be indistinguishable by purpose alone. The schema card comment/appended text does not sufficiently differentiate them.

**Fix:** This is partially addressed by WR-01 (fixing pattern ordering) and WR-02 (filtering bad comments). After those fixes, use comment-based differentiation or fallback to filepath as a secondary differentiator:

```javascript
// In _generatePurpose(), after combining parts:
if (parts.length === 1) {
    // Add relative path context for disambiguation
    const dir = path.dirname(filepath);
    if (dir !== '.') {
        parts.push(`in ${dir}/`);
    }
}
```

---

### WR-04: `migrationExecutor.js` has duplicate `crypto` import in schema card

**File:** `.st8/schema-cards/lib_commands_integr8_migrationExecutor.js.json`
**Issue:** The schema card lists `crypto` as an import twice:
```json
{ "importType": "require", "source": "crypto", "specifiers": [] },
{ "importType": "require", "source": "crypto", "specifiers": [] }
```

The seeder's deduplication in `_parseFileContent()` (lines 452-457) deduplicates by `imp.source`, so this doesn't cause duplicate output. However, the schema card itself has bad data. This is an upstream data quality issue in the schema card emitter (Task 05), not the seeder.

**Impact:** None on current output (deduplicated), but indicates schema card emission may produce duplicates.

---

## INFO Items

### IN-01: Executor report claims 40 files, actual count is 42

**File:** `06_EXECUTOR-REPORT.md:18`
**Issue:** Task spec referenced 40 files but the file registry contains 42. The executor report correctly notes this discrepancy. This is informational — the executor correctly seeded all 42 files.

### IN-02: All 42 intents authored by `INFERRED`

**Confirmed:** Every `authoredBy` field is `'INFERRED'`, which is correct for auto-generated intent data. No manual authorship was expected at this stage.

---

## Database State Verification

```
file_registry:  42 files
file_intent:    42 intents
Match:          YES (1:1 mapping)

Field-level ??? check:
  purpose with ???           : 42/42 ✅
  dependsOnBehavior with ??? : 42/42 ✅
  valueStatement with ???    : 42/42 ✅
  authoredBy = 'INFERRED'    : 42/42 ✅

Quality check:
  Empty purposes:              0 ✅
  Generic purposes:            0 ✅
  Files with polluted purpose: 14 ⚠️ (leaked comments/filepaths)
  Files with wrong dependsOn:  2 ❌ (dynamic import pollution)
```

---

## Verdict

| Criterion | Result |
|-----------|--------|
| IntentSeeder runs without errors | ✅ PASS |
| All files have intent | ✅ PASS (42/42) |
| Every intent includes ??? flag | ✅ PASS (42/42 on all 3 fields) |
| Purposes are meaningful | ⚠️ PARTIAL (14/42 have leaked noise, 4 sets are duplicates) |
| `dependsOnBehavior` is accurate | ❌ FAIL (2 files have semantically wrong values) |

**Overall:** The seeder successfully seeds all 42 files with ??? flags, but produces **semantically incorrect `dependsOnBehavior`** for 2 files (BLOCKER) and **low-quality purposes** for 14 files (WARNING). The `async initialize()` issue is a latent correctness risk.

**Recommended fix order:**
1. BL-01: Filter `isDynamic` imports in schema card processing
2. BL-02: Remove `async` from `initialize()` or add `await` to callers
3. WR-01: Reorder FILENAME_PURPOSE_MAP patterns
4. WR-02: Add comment quality filtering

---

_Reviewed: 2026-05-13_
_Reviewer: GSD Integration Checker_
_Depth: deep (cross-file verification + database state audit)_
