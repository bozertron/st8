# ST8 Identity System — Research Synthesis

**Date:** 2026-05-14
**Sources:** 9 research files in `.st8/`
**Scope:** Complete system architecture, signal paths, gaps, and recommendations

---

## 1. Executive Summary

The ST8 Identity System is a **file-level identity and lifecycle management layer** built on top of a codebase indexer. Its core innovation is the **fingerprint model** — every file gets a stable identity (`filepath:birthTimestamp`) that survives content changes, while a separate `sha256Hash` tracks content versions. This decouples "what is this file?" from "what's in this file?" — a critical distinction for mutation tracking, schema card emission, and lifecycle progression.

The system implements a **5-phase lifecycle** (CONCEPT → LOCKED → WIRING → DEVELOPMENT → PRODUCTION) with a **6-phase indexing pipeline** (Scan → Parse → Analyze → Persist → Index → Watch). Schema cards — deterministic JSON snapshots of each file's identity, exports, imports, connections, intent, and mutation history — are the system's primary output. They're emitted to `.st8/schema-cards/` as JSON and to `.planning/st8_identity_system/` as human-readable `.txt` fallbacks.

**The critical finding:** The system's architecture is sound but the implementation has significant **signal path gaps**. The indexer loses import specifier data during transformation, the file watcher wasn't being started (missing `--watch` flag), connections are hardcoded as empty arrays in incremental updates, and the integr8 orchestrator (`lib/commands/integr8/index.js`) is entirely dead code — its sub-components are called directly by `backgroundIndexer.js` instead. The gap analysis shows **29 of 42 files (69%) are RED status** — orphaned or with no consumers — indicating the connection resolution logic is fundamentally broken.

---

## 2. Architecture Overview

### 2.1 The Dual-Identity Model

```
┌─────────────────────────────────────────────────────────────┐
│                    FILE IDENTITY                             │
├─────────────────────────────────────────────────────────────┤
│  Fingerprint (stable)        │  SHA-256 Hash (volatile)     │
│  "filepath:birthTimestamp"   │  Content digest              │
│  Set once at creation        │  Changes on every edit       │
│  Survives renames? NO        │  Survives renames? YES       │
│  Purpose: Primary key        │  Purpose: Change detection   │
└──────────────────────────────┴──────────────────────────────┘
```

The fingerprint is the **primary key** in SQLite (`file_registry.fingerprint`). It's generated from `path.relative(targetDir, filePath)` concatenated with `stat.birthtime.toISOString()`. On Linux (ext3/ext4), `birthtime` falls back to `mtime` — set once at first index, never changes after.

### 2.2 Lifecycle Phases

```
CONCEPT ──→ LOCKED ──→ WIRING ──→ DEVELOPMENT ──→ PRODUCTION
   │           │          │            │               │
   │           │          │            │               └─ Mutation log purged
   │           │          │            └─ Watcher logs every mutation
   │           │          └─ Cross-file deps validated
   │           └─ Schema cards emitted, PRD generated
   └─ File doesn't exist on disk yet
```

All 42 indexed files are currently in `DEVELOPMENT` phase. No files have progressed to `LOCKED`, `WIRING`, or `PRODUCTION`.

### 2.3 Module Dependency Graph

```
backend/index.js (orchestrator)
├── backend/indexer.js          ─→ File discovery, hashing, import parsing, classification
│   ├── lib/utils/astParser.js  ─→ AST-based import/export extraction
│   └── lib/commands/graphBuilder.js ─→ Dependency graph construction
├── backend/persistence.js      ─→ SQLite CRUD (file_registry, connections, file_intent, etc.)
├── backend/schemaCardEmitter.js ─→ .st8/schema-cards/*.json generation
├── backend/schemaCardPrinter.js ─→ .planning/st8_identity_system/*.txt fallback
├── backend/notificationBus.js  ─→ EventEmitter + SSE + console + printer delegation
├── backend/fileWatcher.js      ─→ Chokidar wrapper with debounced change batching
├── backend/gapAnalyzer.js      ─→ 6-dimension gap analysis (D1-D6)
├── backend/intentSeeder.js     ─→ Heuristic intent extraction from file content
├── backend/manifestGenerator.js ─→ connection-state.json + ai-signal.toml
├── backend/server.js           ─→ HTTP server with SSE endpoint
└── backend/st8-types.js        ─→ Canonical type definitions (fingerprint, lifecycle, mutation)
```

**Dead code in the dependency tree:**
- `lib/commands/integr8/index.js` — `runIntegr8Command()` is exported but never called
- `backend/indexer.js` lines 79-157 — `ST8_SCHEMA` constant duplicated from `persistence.js`, never used
- `backend/indexer.js` lines 58-70 — `getDatabasePersister()` and `getTomlSerializer()` getters defined but never invoked
- `lib/commands/integr8/migrationExecutor.js` — 1837-line migration engine, never imported by orchestrator

### 2.4 The "Parse to Oblivion" Vision

The `backgroundIndexer.js` (812 lines) implements the vision of exhaustive background indexing:

1. **Non-blocking registration** — `addProject()` returns immediately, queues work
2. **6-phase full index pipeline:**
   - Phase 1: Scan — `fast-glob` discovers source files
   - Phase 2: Parse — `integr8/dataIngestion.js` runs 6 parsers (overview, store, route, command, type, UI)
   - Phase 3: Analyze — Extract insights (high import coupling, unused exports)
   - Phase 4: Persist — Save graph to SQLite via `parserPersistence.js`
   - Phase 5: Index — Push symbols to Sonic search engine
   - Phase 6: Watch — Set up chokidar file watcher with debounced re-indexing
3. **Incremental re-indexing** — Changed files trigger selective re-parse (but still runs full `ingestSingleProject`)
4. **Multi-pass analysis** — Queued after initial indexing completes

---

## 3. Key Components

### 3.1 Schema Cards

Schema cards are the system's **primary output artifact**. Each card contains:

| Field | Source | Purpose |
|-------|--------|---------|
| `fingerprint` | `generateFingerprint(filepath, birthTimestamp)` | Stable identity |
| `sha256Hash` | `crypto.createHash('sha256')` | Content version |
| `exports` | `astParser.extractImportsAndExports()` | What the file provides |
| `imports` | Same AST parser | What the file consumes |
| `connections` | SQLite `connections` table | Who imports this file / who this file imports |
| `intent` | SQLite `file_intent` table | Purpose, dependencies, value statement |
| `mutationCount` | `file_mutation_log` count | Change frequency |
| `lastMutation` | Latest `file_mutation_log` entry | Recent activity |

**Emission flow:**
```
index.js main() → emitter.emitAllCards(persistence)
                → printer.printAllFromCards(.st8/schema-cards/)
                
fileWatcher callback → emitter.emitCard(changedFile, ...)
                     → notificationBus.publish({ schemaCard: card })
                     → printer.printCard(card)  // .txt fallback
```

**Known issues with schema cards:**
- `imports` and `exports` are hardcoded as `[]` in incremental updates (watcher callback)
- `connections` are hardcoded as `{ importedBy: [], imports: [] }` in watcher callback
- Cards are never updated with connection data after initial full index

### 3.2 Mutation Logging

Every file change is logged to `file_mutation_log` with:
- `fingerprint` — which file changed
- `sha256Hash` — content version at mutation time
- `mutationType` — CONCEPT, CREATE, EDIT, RENAME, REFACTOR, LOCK, PRODUCTION, PURGE
- `changedFields` — JSON diff of what changed
- `actor` — DEVELOPER, INDEXER, WATCHER, AGENT
- `timestamp` — when it happened
- `metadata` — schema card snapshot at mutation time

**Bug:** Every file gets a `CREATE` mutation on every indexer run (lines 113-120 of `backend/index.js`). The mutation log doesn't check if the file already exists before logging CREATE.

### 3.3 Gap Analyzer (6 Dimensions)

| Dimension | What It Measures | Current Status |
|-----------|-----------------|----------------|
| D1: Lifecycle Progression | Phase distribution | 42/42 in DEVELOPMENT |
| D2: Status Health | GREEN/YELLOW/RED distribution | RED=29, GREEN=13 |
| D3: Intent Authoring | Files with purpose metadata | 42/42 (100%) |
| D4: Export Surface | Files that export symbols | 33/42 (78.6%) |
| D5: Connection Integrity | Import resolution success | 59/59 resolve, 11 isolated files |
| D6: Architectural Completeness | Core components present | 8/8 present, 14/14 endpoints |

**The critical gap:** D2 shows 69% RED files. This means the connection resolution logic fails to establish import relationships for most files. The root causes identified:
- "No importers — orphan file" — files aren't being marked as imported by others
- "No exports — cannot be consumed" — some files don't export anything parseable
- "Unknown" — the gap analyzer can't determine root cause

### 3.4 File Watcher Pipeline

```
chokidar 'change' event
    │
    ▼
FileWatcher._flush() — debounced batch (500ms)
    │
    ▼
index.js onFileChange callback
    │
    ├── ADD path:
    │   ├── Read file, hash with SHA-256
    │   ├── Generate fingerprint (filepath:birthTimestamp)
    │   ├── persistence.upsertFile()
    │   ├── persistence.logMutation(CREATE)
    │   ├── notificationBus.publish(CREATE)
    │   └── emitter.emitCard() — hardcoded empty imports/exports/connections
    │
    ├── CHANGE path:
    │   ├── Re-hash file
    │   ├── Compare with stored hash
    │   ├── persistence.upsertFile()
    │   ├── persistence.logMutation(EDIT)
    │   ├── notificationBus.publish(EDIT)
    │   └── emitter.emitCard() — hardcoded empty imports/exports/connections
    │
    └── UNLINK path:
        ├── persistence.logMutation(DELETE)
        ├── notificationBus.publish(DELETE)
        ├── Delete schema card file
        └── persistence.deleteFile()
```

**Root cause of watcher not working:** The backend was running without `--watch` flag. The file watcher is never instantiated. Fix: add `--watch` to startup command or make it default.

---

## 4. Signal Path Analysis

### 4.1 Full Index Pipeline (backend/index.js main())

```
indexDirectory(targetDir) ──→ { files: [...], manifest: {...} }
    │
    ├─ Pass 1: Upsert files to SQLite
    │   └─ BUG: Every file gets CREATE mutation on every run
    │
    ├─ Pass 2: Wire connections
    │   └─ BUG: O(n²) lookup with fuzzy matching (false positives)
    │   └─ BUG: Only resolves relative imports (./path), not bare specifiers
    │
    ├─ Activity log entry
    │
    ├─ writeManifests() — second write of connection-state.json
    │   └─ BUG: Redundant require() on line 155 (already imported line 16)
    │
    ├─ emitter.emitAllCards() — writes .st8/schema-cards/*.json
    │
    ├─ printer.printAllFromCards() — writes .txt fallbacks
    │
    ├─ GapAnalyzer.analyze() + writeReport()
    │   └─ BUG: analyze() runs twice (result discarded, then re-run inside writeReport)
    │
    └─ IntentSeeder.seedAll()
        └─ BUG: Re-seeds ALL files on every change (not just changed files)
```

### 4.2 Import Specifier Data Loss (Critical Bug)

In `backend/indexer.js` lines 399-403:

```javascript
// AST parser returns: { source, specifiers: [{name, kind}], importType, line }
// Code transforms to: { source, names: imp.names || [], isDefault: ... }
// 
// PROBLEM: imp.names is always undefined → names is always []
// The actual specifier data (imp.specifiers) is never read
```

This means **every schema card shows empty imports** even when the AST parser successfully extracts them. The transformation step discards the data.

### 4.3 Connection Resolution Failure

In `backend/index.js` lines 127-129:

```javascript
const targetFile = result.files.find(f =>
    f.filepath.endsWith(imp.source) ||
    f.filepath.includes(imp.source.replace(/^\.\//, ''))
);
```

Problems:
1. **O(n²) complexity** — `find()` inside nested loop
2. **Fuzzy matching** — `includes('utils')` matches `src/utils.js`, `lib/string-utils.js`, `test/utils.spec.js`
3. **Missing extension resolution** — `./utils` doesn't match `./utils.js`
4. **No bare specifier handling** — `require('lodash')` produces no connection

### 4.4 Dead Code Inventory

| File | Dead Code | Impact |
|------|-----------|--------|
| `lib/commands/integr8/index.js` | `runIntegr8Command()` — entire 140-line orchestrator | Sub-components called directly by backgroundIndexer.js |
| `backend/indexer.js` | `ST8_SCHEMA` constant (lines 79-157) | Duplicated in persistence.js, never referenced |
| `backend/indexer.js` | `getDatabasePersister()`, `getTomlSerializer()` | Getter functions defined, never called |
| `backend/indexer.js` | `_backgroundIndexer` variable | Declared, no getter function exists |
| `lib/commands/integr8/migrationExecutor.js` | 1837-line migration engine | Never imported by orchestrator |

---

## 5. Gaps and Issues

### 5.1 Critical Issues (Data Loss / Broken Functionality)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Import specifier data lost** | `indexer.js:399-403` | Schema cards show empty imports despite AST parser extracting them |
| 2 | **69% RED files** | Gap analysis D2 | Connection resolution fails for most files |
| 3 | **File watcher not started** | `start.js` / CLI flags | No automatic mutation tracking |
| 4 | **Duplicate CREATE mutations** | `index.js:113-120` | Mutation log fills with duplicates on every run |
| 5 | **Connections hardcoded empty in watcher** | `index.js:303-309, 361-364` | Incremental schema cards never show connections |

### 5.2 Warnings (Performance / Correctness)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | O(n²) connection resolution | `index.js:127-129` | Slow for large codebases |
| 7 | Fuzzy import matching | `index.js:128-129` | False positive connections |
| 8 | Gap analysis runs twice | `index.js:168-169` | Wasteful computation |
| 9 | IntentSeeder re-seeds all files | `index.js:381-388` | O(n) work per single file change |
| 10 | GapAnalyzer re-analyzes all cards | `index.js:390-397` | O(n) work per single file change |
| 11 | `parseInt()` on undefined port | `index.js:67` | NaN port, server bind failure |
| 12 | `unhandledRejection` silently swallowed | `index.js:29-32` | Masks bugs |

### 5.3 Dead Code / Duplication

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 13 | `ST8_SCHEMA` duplicated | `indexer.js:79-157` + `persistence.js:47` | Maintenance risk |
| 14 | `CODE_EXTENSIONS` duplicated | `indexer.js:161` + `index.js:187` | Sync risk |
| 15 | Redundant `require('./manifestGenerator')` | `index.js:16, 155, 377` | Dead code (harmless) |
| 16 | `integr8/index.js` orchestrator dead | Entire file | Never called, sub-components used directly |

### 5.4 Missing Features

| # | Feature | Status |
|---|---------|--------|
| 17 | CLI `--watch` mode in standalone indexer.js | "not yet implemented" |
| 18 | `isEntryPoint` detection | Hardcoded to `false` |
| 19 | Bare specifier resolution (npm packages) | Not implemented |
| 20 | File rename detection | Not implemented |
| 21 | External dependency tracking | Not implemented |

---

## 6. Recommendations

### 6.1 Immediate Fixes (Unblock Core Functionality)

**Fix 1: Start the file watcher**
```bash
# Change startup command from:
node backend/index.js . --serve --port 3847
# To:
node backend/index.js . --watch --serve --port 3847
```
Or make `--watch` the default in `start.js`.

**Fix 2: Fix import specifier data loss in indexer.js**

Replace lines 399-403:
```javascript
// BEFORE (broken):
imports: (file.imports || []).map(imp => ({
    source: imp.source,
    names: imp.names || [],        // ← always []
    isDefault: imp.isDefault || imp.importType === 'default'
})),

// AFTER (fixed):
imports: (file.imports || []).map(imp => ({
    source: imp.source,
    specifiers: imp.specifiers || [],  // ← preserve AST data
    importType: imp.importType || 'named',
    line: imp.line || 0
})),
```

**Fix 3: Fix duplicate CREATE mutations**

Add existence check before logging:
```javascript
const existing = persistence.getFileByPath(file.filepath);
if (!existing) {
    persistence.logMutation({ ..., mutationType: 'CREATE', ... });
}
```

**Fix 4: Fix O(n²) connection resolution**

Build a filepath lookup map:
```javascript
const fileMap = new Map(result.files.map(f => [f.filepath, f]));
for (const file of result.files) {
    for (const imp of file.imports) {
        const resolved = resolveImportPath(imp.source, file.filepath, targetDir);
        const targetFile = fileMap.get(resolved);
        if (targetFile) {
            persistence.insertConnection({ ... });
        }
    }
}
```

### 6.2 Short-Term Improvements (Next Sprint)

1. **Extract shared constants** — Move `ST8_SCHEMA`, `CODE_EXTENSIONS` to `backend/st8-types.js`
2. **Remove dead code** — Delete `integr8/index.js` orchestrator, unused getters in `indexer.js`
3. **Incremental operations** — `IntentSeeder.seedFile()` and `GapAnalyzer.analyzeFile()` for changed files only
4. **Add SIGTERM handler** — Graceful shutdown on `kill <pid>`
5. **Resolve bare specifiers** — Map `require('lodash')` to `node_modules/lodash/index.js`

### 6.3 Medium-Term Architecture (Phase 2+)

1. **Connection graph as first-class citizen** — Build a `Map<filepath, Set<filepath>>` during indexing, persist incrementally
2. **Schema card diff mode** — Compare current card against last emitted, only write if changed
3. **Lifecycle progression automation** — Auto-transition files from DEVELOPMENT → LOCKED when mutation rate drops below threshold
4. **PRD generation endpoint** — Already specified in Identity System.md Phase 6C, wire up
5. **Production purge endpoint** — Already specified in Phase 6D, wire up

### 6.4 Long-Term Vision

The "parse to oblivion" vision from `backgroundIndexer.js` is architecturally sound. The missing pieces:

1. **Wire backgroundIndexer into backend/index.js** — Currently they're separate systems
2. **Sonic search integration** — `sonicClient.js` exists but failures are silently swallowed
3. **Multi-pass analysis** — `multiPassAnalyzer.js` exists, `queueMultiPassAnalysis()` is called, but results aren't surfaced
4. **Frontend SSE visualization** — `st8.html` has `initMutationStream()` but the UI for displaying mutations is minimal

---

## Appendix A: Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Fingerprint model | HIGH | Well-specified in st8-types.js, verified in schema cards |
| Lifecycle phases | HIGH | Clear enum definitions, but no files progress past DEVELOPMENT |
| Schema card emission | MEDIUM | Working for full index, broken for incremental (empty imports/exports/connections) |
| Mutation logging | MEDIUM | Schema correct, but duplicate CREATE bug exists |
| Connection resolution | LOW | 69% RED files, fuzzy matching, O(n²) complexity |
| Import parsing | LOW | AST parser works but data lost in transformation |
| Gap analysis | HIGH | Accurate measurement, correctly identifies problems |
| File watcher | HIGH | Implementation complete, just not started |
| Integr8 orchestrator | HIGH | Confirmed dead code, sub-components work independently |

## Appendix B: File Statistics

| Metric | Value |
|--------|-------|
| Total indexed files | 42 |
| Schema cards emitted | 43 (includes test_newfile.js) |
| RED status files | 29 (69%) |
| GREEN status files | 13 (31%) |
| Files with exports | 33 (78.6%) |
| Isolated files (no connections) | 11 |
| Files with intent | 42 (100%) |
| Lifecycle phases represented | 1 (DEVELOPMENT only) |
| Dead code files | 3 (integr8/index.js, unused getters, ST8_SCHEMA duplicate) |

---

*Synthesized from: Identity System.md, backgroundIndexer.js analysis, backend/index.js analysis, integr8/index.js analysis, backend/indexer.js analysis, FILEWATCHER-ARCHITECTURE.md, index.js filewatcher callback, gap-analysis.md, layout.ts identity card*
