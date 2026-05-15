# Identity & Analysis

**Cluster:** identity-and-analysis
**Scope:** the file-identity system, indexing pipeline, schema cards, manifests, analysis suite (live + dormant), the parser ecosystem, and the AST extractor.

This is the substance of what makes st8 unique. Everything downstream — the constellation visualization, the terminal commands, the (planned) ticket pipeline — is a view on top of the identity layer described here.

---

## 1. What "identity" means in st8

A file in st8 is not a path. It is a `fingerprint` — the concatenation of two things that don't change with content:

```
fingerprint = "<filepath>||<ISO-birthTimestamp>"
```

`generateFingerprint(filepath, birthTimestamp)` lives in `/home/user/st8/src/shared/types/st8-types.js`. The fingerprint is the **roll-call ID** for a file across every overlapping circuit it participates in:

- **Database identity** — primary key of `file_registry`, `file_intent`, FK target of `connections` and `file_mutation_log`.
- **Schema-card filename** — `src_core_server_app.js.json` etc. (path-flattened).
- **Manifest reference** — emitted into both `connection-state.json` and `ai-signal.toml`.
- **Mutation log linkage** — `file_mutation_log` rows hang off `fingerprint`, never `filepath`.

Why `filepath||birthTimestamp` and not just `sha256Hash`? Because **content changes constantly** but identity doesn't. The sha256Hash is the *version*; the fingerprint is the *file*. If `app.js` is rewritten, the fingerprint stays put, the sha256 changes, and a row appears in `file_mutation_log`. If `app.js` is recreated after a delete (new `birthTimestamp`), it gets a new fingerprint — a different file with the same name.

Force-check FC6 (see batch 025) asserts every fingerprint matches `<filepath>||<ISO-timestamp>` format. Malformed identity is a hard signal.

**The five identity fields per file:**

| Field | Source | Stability |
|---|---|---|
| `fingerprint` | derived | never changes |
| `filepath` | filesystem | changes on rename (new fingerprint) |
| `birthTimestamp` | `fs.statSync().birthtime` (mtime fallback) | never changes for a given fingerprint |
| `sha256Hash` | file content | changes on every edit |
| `lastModified` | `fs.statSync().mtime` | changes on every save |

`birthTimestamp` is intentionally omitted from the connection-state manifest's per-file payload (per batch 025 deep dive — it's identity-internal, not consumer-facing). Same for `lifecyclePhase`. Cards keep both.

---

## 2. The indexing pass

`/home/user/st8/src/features/indexing/indexer.js` (483 lines) is the entry point. Pipeline:

1. **`discoverFiles(targetDir)`** — recursive `fs.readdirSync` walk, filtered through `CODE_EXTENSIONS` (`.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.py`, `.rs`, `.go`, `.md`, `.txt`, `.json`) and `IGNORE_DIRS` (`node_modules`, `.git`, `dist`, `build`, `.archive`, `.planning`, `.st8`, `vendor`, `snapshots`, etc.). Crucially also skips `SELF_WRITTEN_BASENAMES = {'connection-state.json', 'ai-signal.toml'}` — fix from batch 026 so st8 doesn't index its own output.
2. **`hashFile(file)`** — sha256 of file contents. `null` on read error.
3. **AST parse** — `parseImports(file)` calls `ast-parser.extractImportsAndExports(filePath)` and returns its `.imports` array.
4. **Per-file object construction** — combines path, `path.basename`, sha256, size, `stat.mtime`, `stat.birthtime` (fallback: mtime), and the derived `fingerprint`. Lifecycle phase defaults to `'DEVELOPMENT'`.
5. **`buildGraph(parsedFiles, targetDir)`** — async; delegates to `features/graph/builder.buildDependencyGraph(targetDir)`. Maps the builder's `health` enum (`healthy`/`broken`/`unused`/`partial`) → st8's `status` enum (`GREEN`/`RED`/`YELLOW`/`YELLOW`). Falls back to `classifyBasic` if the graph builder isn't available — a simple "imported-by-something? GREEN, else RED" heuristic.
6. **Merge** — each parsedFile gets `status`, `reachabilityScore`, `impactRadius` from the classifier.
7. **`indexDirectory` returns `{files, manifest}`** to `main.js`.

The indexer used to also write the manifest inline; post-refactor that responsibility moved to the manifest-generator subscriber.

---

## 3. The post-index hook chain

`main.js` no longer orchestrates inline (batch 023). The new flow:

```
INDEX_START   → P=10  sonic-daemon       (starts Sonic if available)
              [Pass-1 upsert loop fires FILE_INDEXED per file — no default subscribers]
INDEX_COMPLETE → P=10 manifest-generator  (writes connection-state.json + ai-signal.toml)
              → P=20 schema-card-emitter (writes .st8/schema-cards/*.json + .planning .txt fallbacks)
              → P=30 gap-analyzer        (writes .st8/gap-analysis.md)
              → P=40 intent-seeder       (heuristic intent → file_intent table)
              → P=90 force-checks        (writes .st8/force-check.md, 6 cross-tool integrity checks)
```

Registered in `/home/user/st8/src/core/hooks/default-subscribers.js` via `registerDefaultSubscribers(hookRegistry)` called from `main.js` once after persistence init. Each subscriber is wrapped in its own `try`/`catch` so one bad handler can't kill the chain. The chain is await-ordered by priority.

`FILE_INDEXED`, `FILE_BEFORE_CHANGE`, `FILE_AFTER_CHANGE`, `LIFECYCLE_TRANSITION`, `COMMIT_RECORDED`, `PRD_GENERATE` are also defined in the registry but have no default subscribers as of batch 027.

---

## 4. Schema cards

`/home/user/st8/src/features/schema-cards/emitter.js` writes deterministic JSON cards into `.st8/schema-cards/<flat-filepath>.json`.

**Filename encoding:** `src/core/server/app.js` → `src_core_server_app.js.json` (the `_cardFilename(filepath)` method substitutes `/` and `\` with `_`).

**Card shape (19 fields, matches `St8SchemaCard` in st8-types.js):**

| Field | Source |
|---|---|
| `fingerprint` | identity |
| `filepath` | identity |
| `filename` | identity |
| `sha256Hash` | content version |
| `fileSizeBytes` | stat |
| `status` | graph builder classification (`GREEN`/`YELLOW`/`RED`) |
| `reachabilityScore` | 0.0–1.0 |
| `impactRadius` | transitive dependents count |
| `lifecyclePhase` | `CONCEPT`/`LOCKED`/`WIRING`/`DEVELOPMENT`/`PRODUCTION` |
| `birthTimestamp` | identity |
| `lastModified` | mtime |
| `lastIndexed` | indexer run timestamp |
| `isEntryPoint` | bool |
| `exports` | AST-extracted, with `{name, kind, signature, returnType, ...}` |
| `imports` | AST-extracted, with `{source, specifiers, importType, line}` |
| `connections.importedBy` | fingerprints |
| `connections.imports` | fingerprints |
| `intent.{purpose, dependsOnBehavior, valueStatement}` | from `file_intent` row (DB-backed, only canonical fields) |
| `mutationCount` + `lastMutation.{type, actor, timestamp}` | from `file_mutation_log` summary |

**Determinism:** JSON is written with sorted-keys replacer at every object level, for diff-stable cards. `validateSt8SchemaCard` is called per card and logs warnings (non-fatal) for missing fields.

**Card prune (batch 026):** after writing all current cards, `emitAllCards()` reads every `.json` file in the output dir and `unlinkSync`s any whose filename doesn't correspond to a current `file_registry` row. Logs `pruned N stale`. Without this, gap-analyzer would read stale cards from prior runs.

### Printer fallback

`/home/user/st8/src/features/schema-cards/printer.js` (294 lines) renders human-readable `.txt` files into `.planning/st8_identity_system/`. Each file is `${timestamp}_${flat-filepath}.txt`. Guards exclude `.txt`/`.json`/`.sqlite-*` cards, cards inside `.st8/schema-cards`, and files under `.archive/`, `.planning/`, `.st8/`, `vendor/`, `snapshots/`. This is the **offline fallback** for when the visual system isn't running. The format uses box-drawing characters for human readability — IDENTITY, CONTENT VERSION, CLASSIFICATION, EXPORTS, IMPORTS, CONNECTIONS, INTENT, MUTATIONS sections.

---

## 5. Manifest output (manifest-generator.js)

`/home/user/st8/src/features/schema-cards/manifest-generator.js` (170 lines) writes two files to the target directory root after every index pass.

### connection-state.json

```json
{
  "metadata": {
    "timestamp": "...",
    "targetDirectory": "...",
    "totalFiles": N,
    "statusCounts": { "GREEN": ..., "YELLOW": ..., "RED": ... }
  },
  "files": [
    { "fingerprint", "filepath", "filename", "status",
      "reachabilityScore", "impactRadius", "sha256Hash",
      "imports": [...], "importedBy": [...],
      "intent": { "purpose", "dependsOnBehavior", "valueStatement" } }
  ]
}
```

Notably **does NOT include** `lifecyclePhase` or `birthTimestamp` per file. Per batch 025 reasoning: these are identity-internal, the manifest is consumer-facing. Cards still carry them.

**Consumers:**
- Frontend coordination polling — the constellation/file-explorer reads this for status/score data.
- Gap-analyzer (D6 dimension only — checks if `connection-state.json` endpoint is present).
- Force-checks FC3 — asserts every `file_registry` row is covered.

### ai-signal.toml

If `features/integr8/toml-serializer.js` is available, it's used. Otherwise manual TOML generation:

```toml
version = "1.0"
generated_at = "..."
target_directory = "..."

[status_distribution]
green = N
yellow = N
red = N

[[files]]
path = "..."
status = "..."
reachability_score = ...
impact_radius = ...

[files.ai_signal]
core_responsibility = "..."          # = intent.purpose
can_be_archived = true/false         # = (status == RED && impactRadius == 0)
```

**Consumer:** LLM-facing tooling. The `[files.ai_signal]` block is the headline — it's the "what should the AI know about this file" view.

---

## 6. Gap analyzer (6 dimensions)

`/home/user/st8/src/features/analysis/gap-analyzer.js` (652 lines). Reads cards from `.st8/schema-cards/` (NOT the DB — this is the second "tool verifies tool" relationship per batch 025: gap-analyzer reading the emitter's output).

Run as P=30 INDEX_COMPLETE subscriber, writes `.st8/gap-analysis.md`.

| Dim | Name | What it measures |
|---|---|---|
| D1 | Lifecycle Progression | Phase distribution; files with intent that can advance |
| D2 | Status Health | RED files + root causes (no importers, no exports); GREEN with low reachability; YELLOW listing |
| D3 | Intent Authoring | Per-directory coverage of `intent.purpose` (excluding `'(not set)'`); count of unauthored |
| D4 | Export Surface | Files with exports vs without; CommonJS vs ES6 module-type detection |
| D5 | Connection Integrity | Resolved-import count, orphan imports (target filepath not in `knownPaths`), isolated files |
| D6 | Architectural Completeness | URL-to-file table (`endpointModuleMap`) verifies each required endpoint has its handler module in cards |

**The URL-to-file map (batch 022 refactor):** D6 hardcodes the 14 required endpoints (`/api/health`, `/api/index`, `/api/file-intent`, ...) and the module each is expected to live in. Paths were updated post-refactor to point at the new `src/` tree. Force-check FC4 was tightened to skip `/api/*` paths so this table doesn't false-trip the gap-report-references-only-real-files check.

The renderer produces clean markdown sections per dimension with capped tables (top 20 RED, top 10 GREEN-low-reachability, etc.).

---

## 7. Intent seeder

`/home/user/st8/src/features/analysis/intent-seeder.js` (519 lines). Heuristic-only — generates `{purpose, dependsOnBehavior, valueStatement}` for every file in the registry, all flagged with trailing `???` to mark INFERRED status.

**Three heuristic tables (first-match-wins, order-sensitive):**

- `FILENAME_PURPOSE_MAP` — ~70 regex patterns mapping filename → purpose string ("SQLite persistence layer", "Application entry point", etc.).
- `IMPORT_BEHAVIOR_MAP` — `better-sqlite3` → "SQLite database engine", etc.
- `EXPORT_VALUE_MAP` — `persistence` → "CRUD operations for file registry", etc.

**Pipeline per file:**

1. `_parseFileContent(filepath)` — tries to read the schema card first (faster and more reliable than regex); falls back to regex-parsing the file directly if the card has no imports/exports.
2. Detects `@@@`, `<!-- @@@ -->`, `@@@AI_REVIEW` markers in file content and calls `persistence.flagForAIReview(filepath, tripleAtCount)`. The frontend surfaces this with a `<span class="badge-ai-review">@@@</span>` badge in both `app.js` and `file-explorer.js`.
3. `_generatePurpose` — combines filename match, top-level JSDoc/`//` comment (if 10–100 chars), import behaviors, export values. Falls back to `"Source module at <filepath>"`.
4. `_generateDependsOn` — maps imports via `IMPORT_BEHAVIOR_MAP` or falls back to the module name.
5. `_generateValueStatement` — same approach over exports.
6. `persistence.upsertIntent({fingerprint, purpose, dependsOnBehavior, valueStatement, authoredBy: 'INFERRED'})`.

**The batch 022 fix (path-resolution bug):**

The constructor now takes an optional `targetDir`. Before, both file reads at L193 (detection-pass `fs.readFileSync`) and L385 (`_parseFileContent` fallback) used `path.resolve(filepath)` — which is cwd-relative. But `file_registry.filepath` is project-relative, and when you run `node start.js /some/other/dir` the server's cwd ≠ targetDir. Result: ENOENT for every file. Fix: `path.isAbsolute(filepath) ? filepath : path.resolve(this.targetDir, filepath)` and `main.js:178` + `main.js:384` (watcher's incremental re-seed) updated to pass targetDir.

Verified before/after: `Seeded 1 files, 1 errors` → `Seeded 6 files, 0 errors`.

---

## 8. Insight store (dormant)

`/home/user/st8/src/features/analysis/insight-store.js` (361 lines). Compiled-from-TS module exporting `InsightStore` class + `getInsightStore(dbPath)` singleton factory. Uses its own `better-sqlite3` connection (shared DB path via `graph-persister.getSharedDatabasePath()`).

**Schema (two tables):**

- `FileInsightSlots` — one row per file: `{file_id, project_id, file_path, total_insights, last_pass_number, last_updated}`.
- `InsightRecords` — many rows per file: `{insight_id, project_id, file_id, file_path, pass_number, category, severity (info/warning/error), description, evidence, related_node_ids, context, timestamp}`.

**Method surface:** `ensureFileSlot`, `addInsight`, `addInsightsBatch`, `getInsightsForFile`, `getInsightsByCategory`, `getRecentInsights`, `queryInsights({projectId, fileId, category, severity, minPassNumber, limit, offset})`, `getCategorySummary`, `getFileSlots`, `clearProject`, `clearFile`.

**This is the data layer for "why is this file RED?"** A `getInsightsForFile(projectId, 'src/foo.js')` query would return the chain of errors/warnings that led to the classification.

**Currently dormant.** Only `src/features/indexing/background-indexer.js` requires it (line 64), and background-indexer itself has no live consumers — it's blocked on Sonic restoration and missing helper modules (`multiPassAnalyzer.js`, `precisionCapture.js`). The store table is created on first construction but no live code path calls `addInsight`.

---

## 9. The dead analysis modules

Four modules totaling **2,894 lines** are present, complete, and have **no live consumers** in `src/` outside of `features/integr8/index.js` (itself dead) and `background-indexer.js` (also dead).

### relationship-analyzer.js (924 lines)

**Stage 2 of the integr8 pipeline.** Compares two `SemanticGraph`s — an external project and the current project — and classifies dependencies as `SAFE` / `NEEDS_REWRITE` / `CONFLICT` / `MISSING`. Detects cycles via Tarjan SCC. Detects structural subtyping and breaking changes between matched exports.

Exports: `analyzeRelationships`, `analyzeStructuralSubtyping`, `detectBreakingChanges`, `computeTarjanSCC`, `detectCyclesWithTarjan`.

**Wiring missing:** no INDEX_COMPLETE subscriber, no API route. Designed as part of the integr8 pipeline that's been retired.

### path-generator.js (858 lines) — FOUNDER PRIORITY #1

**Stage 3.** Generates a `MigrationStep[]` array via topological sort over the analyzed semantic graph. Outputs the **"signal path"** the founder wants visualized — given a yellow file, return the chain of dependencies and the recommended order of operations to reach a target outcome.

Exports: `generateMigrationPath(graph, conflicts, targetPages, sourcePath, targetPath)`, `performTopologicalAnalysis`.

**Wiring missing:** no `/api/signal-path` route, no `show-path <file>` terminal command, no visualization layer in dive-in. The roadmap in batch 025 marks this as #1 priority: "gets the user from 'file is yellow' to 'here's the signal path.' Doesn't need background-indexer fixed; can run synchronously on a manual request."

### report-generator.js (283 lines)

**The "push to ticket / LLM" output stage.** Renders an integr8 analysis output as a Markdown report — executive summary, source/target paths, graph properties (reachability/stability/fragility), conflicts table, migration steps, risk assessment, next steps.

Exports: `generateMigrationReport(output)`.

**Wiring missing:** no `report` terminal command, no API route, no live caller. Should be wired downstream of `path-generator` once that's surfaced.

### graph/traversal.js (827 lines, 13 exports)

Powers path-generator with impact-chain queries. Exports include `findPaths`, `computeImpactChain`, `findImportsOf`, `findExportsOf`, plus cache management (`clearCache`, `ensureIndexes`).

Reads from the SQLite `GraphNodes` / `GraphEdges` tables (better-sqlite3) — different from st8's main `file_registry` table. Built on the assumption Sonic populates these via background-indexer.

**Wiring missing:** as above, no consumers in `src/`. Adjacent module `graph/builder.js` IS used (called by indexer's `buildGraph` and by `data-ingestion.js`).

---

## 10. The parser ecosystem

`/home/user/st8/src/features/indexing/data-ingestion.js` (1101 lines) is the orchestrator — Stage 1 of the integr8 pipeline. Exports `ingestProjectData({externalPath, currentPath, targetPages})` and `ingestSingleProject(...)`. Adds per-parser **health monitoring + circuit breaker + adaptive retry** (CIRCUIT_BREAKER_CONFIG, ADAPTIVE_RETRY_CONFIG, healthMonitor map keyed by parser name).

Calls the six specialized parsers and collates their output into a `SemanticGraph` (`nodes[]`, `edges[]`):

| Parser | File | Export | Looks for |
|---|---|---|---|
| `overview` | overview.js (349 lines) | `generateOverviewAndGetFileList` | High-level project shape: scans `src/`, `src-tauri/`, reads `package.json`, `vite.config.ts`, `tauri.conf.json`, `tsconfig.json`, detects frontend (Vue/Pinia/Naive UI) vs Rust (tauri/tokio) stacks. Returns a project-overview report + sorted relative file list. |
| `store-parser` | store-parser.js (340 lines) | `generateStoreReport` | Pinia/Vuex store definitions and their state shape |
| `route-parser` | route-parser.js (312 lines) | `generateRouteReport` | Vue Router / framework route declarations |
| `command-parser` | command-parser.js (270 lines) | `generateCommandReport` | Tauri commands and other RPC-style entry points |
| `type-parser` | type-parser.js (255 lines) | `generateTypeReport` | TypeScript type definitions / interfaces |
| `ui-parser` | ui-parser.js (250 lines) | `generateUiComponentReport` | UI component declarations (props/events/slots) |
| `parser-persistence` | parser-persistence.js (294 lines) | `ParserPersistence` class | Stores parser output in SQLite for downstream consumers |

All seven are compiled-from-TS modules retained intact from the integr8 origin. The frontend/backend coordination service does **not** consume them today — they're staged for the integr8 + sonic restoration work.

---

## 11. The AST extractor

`/home/user/st8/src/shared/utils/ast-parser.js` (1065 lines). Built on `@babel/parser`. Two public exports:

- `extractImportsAndExports(filePath)` — reads + parses a file from disk.
- `extractFromText(text, projectPath)` — parses an in-memory string.

**Specifier coverage:**

| Form | Handler |
|---|---|
| `import X from 'mod'` (default) | `parseImportDeclaration` |
| `import { a, b } from 'mod'` (named) | `parseImportDeclaration` |
| `import * as X from 'mod'` (namespace) | `parseImportDeclaration` |
| `import 'mod'` (side-effect) | `parseImportDeclaration` |
| `import('mod')` (dynamic) | `extractDynamicImportsFromAST` + regex fallback (`extractDynamicImportsViaRegex`) |
| `require('mod')` (CommonJS) | `extractRequireStatements` regex pass over content |
| `module.exports = ...`, `module.exports = { ... }`, `exports.foo = ...` | `extractCommonJSExportsFromAST` AST walk |
| `export { a, b }`, `export const x = ...`, `export default ...`, `export * from ...` | `parseExportDeclaration`, `parseDefaultExport`, `resolveExportStar`, `traceReexportChain` |
| `<script>` block in `.vue` files | `extractScriptFromVue` |

Also extracts signatures (`buildFunctionSignature`, `buildArrowSignature`), parameter types (`paramToString`, `typeAnnotationToString`), return types (`extractReturnType`), and TypeScript type parameters (`extractTypeParams`). Resolves relative module paths via `resolveModulePath`.

Used by: `indexer.js` (Pass-1 import extraction), `schema-cards/emitter.js` (per-card AST data), `intent-seeder.js` (heuristic input), `features/indexing/data-ingestion.js` (Stage-1 ingestion).

---

## 12. Identity preservation across the refactor

The refactor that moved everything from `backend/` + `lib/` into `src/` (batches 001-021) preserved file identity across **all 43 schema-card-tracked files**. From batch 021 Tier 6:

| Bucket | Count |
|---|---|
| MATCH (identity preserved) | 37 |
| DOCUMENTED DRIFT (hand-patched: main.js, app.js, emitter.js) | 3 |
| **UNDOCUMENTED DRIFT** | **0** |
| MISSING (fake-stream, void-engine, test/newfile — retired) | 3 |
| FAILED TO PARSE | 0 |

Tier 6 (`scripts/signal-tests/check-identity-delta.js`) iterates `st8_json/schema-cards/` (43 saved historical cards), recovers each card's original filepath from its flat filename, looks up the current location via `move-history.json`, AST-extracts today's exports + imports, and compares to the card. Tolerates known renames (`databasePersister` ↔ `graph-persister`) and basename case changes (`safeFs` ↔ `safe-fs`).

**Strongest end-to-end signal that the move-and-rewire didn't accidentally alter any module's external surface.**

---

## 13. How to add a new analysis module

The hook chain is the extension point. Register a P=50+ INDEX_COMPLETE subscriber:

```js
// src/features/analysis/my-analyzer.js
class MyAnalyzer {
  constructor(persistence, targetDir) { ... }
  analyze() { /* read from persistence; return findings */ }
  writeReport(outputPath) { /* writes .st8/my-analysis.md */ }
}
module.exports = { MyAnalyzer };

// src/core/hooks/default-subscribers.js
const path = require('path');

registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
  try {
    const { MyAnalyzer } = require('../../features/analysis/my-analyzer');
    const analyzer = new MyAnalyzer(ctx.persistence, ctx.targetDir);
    analyzer.analyze();
    analyzer.writeReport(path.join(ctx.targetDir, '.st8', 'my-analysis.md'));
    console.log('[st8] My analysis complete');
  } catch (err) {
    console.error('[st8] My analysis failed:', err.message);
  }
}, { priority: 50, source: 'my-analyzer' });
```

Picking the priority:

- P=10 — manifest-like outputs that other tools read
- P=20-30 — analyzers that read cards / persistence
- P=40-50 — anything that mutates `file_intent` or other DB tables
- P=80-90 — verification passes (force-checks lives at P=90)

If you need per-file insight (rather than batch analysis): subscribe to `HOOKS.FILE_INDEXED` instead — `ctx = {file, targetDir, persistence}`.

If you need write access to schema cards (rare): subscribe at P >= 30 so the emitter (P=20) has finished writing first.

The handler's `try`/`catch` is non-negotiable — the hook registry wraps every handler in its own isolation envelope (per `notification-bus` policy), but explicit try/catch makes the failure mode visible in logs.
