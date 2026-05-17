# Research — src/features/indexing (Data Unblock Pass 2)

Date: 2026-05-17. Read-only audit. Wave: data-unblock-pass-2.
Mission: identify what ELSE in `src/features/indexing/` can yield canonical-13
InsightCategory data via the four proven recipes (A=canonical-category producer,
B=accurate resolver, C=persistence-derived analyzer, D=clear-then-rebuild).

Prior corpus consulted:
- `st8_bible.md` batches 027 (sonic-foundation), 030 (indexing-dir-audit),
  031 (cycle-pipeline-wire + connection-resolver).
- `docs/Insight Store/insightStore.ts` — 13-category canonical enum.
- `docs/_pending-roadmap/sonic-and-search.md` — P1 (background-indexer revival,
  founder-deferred) + P2 Layer 2 ("each pass be its own hook subscriber").
- `docs/_pending-roadmap/identity-and-analysis.md`.
- `docs/_pending-tickets/identity-and-analysis.review.md` + `.for-review.json`.
- `docs/_research/2026-05-16-analysis-tools-unblock/_synthesis.md`.
- `st8_json/schema-cards/` pre-refactor inventory (16 cards survive of relevance:
  `lib_commands_backgroundIndexer`, `lib_commands_overview`,
  `lib_commands_integr8_dataIngestion`, `lib_commands_parserPersistence`,
  `lib_utils_astParser`, etc.).
- Templates: `cycle-insight-emitter.js` (A), `connection-resolver.js` (B),
  `persistence-cycle-detector.js` (C). `persistence.clearAllConnections` (D).

═══════════════════════════════════════════════════════════════════
## 1. File inventory (live/dormant + role + LOC + origin)
═══════════════════════════════════════════════════════════════════

| File | LOC | Origin | Status | Role |
|---|--:|---|---|---|
| `background-indexer.js` | 852 | TS-vendored (maestro `commands/backgroundIndexer.ts`) | **DORMANT — zero `require()` callers in `src/`** | PM-1 Layer 1. Inert no-op stubs (Wave 5A ticket 0) make it loadable. Internally has emit code paths for 4 canonical categories. |
| `command-parser.js` | 305 | TS-vendored (maestro `commandParser.ts`) | LIVE via data-ingestion | Tauri-command + frontend `invoke()` extractor. Hardcoded `src-tauri/src/commands` path. st8 → 0 nodes. |
| `connection-resolver.js` | 157 | Hand-written, **Batch 031** | **LIVE** — main.js Pass-2 | Recipe-B template. Path-aware import-target resolver. Replaces the old substring matcher. |
| `data-ingestion.js` | 1223 | TS-vendored (maestro `integr8/dataIngestion.ts`) | LIVE via builder.js + integr8/index.js | Stage 1 orchestrator. Circuit-breaker + adaptive-retry + enhanced-import-scan. **Has reusable resilience primitive (§3).** Calls all six specialised parsers. |
| `indexer.js` | 552 | **Hand-written, st8-native** | LIVE — boot indexer | `indexDirectory`, `discoverFiles`, `hashFile`, `parseImports`, `buildGraph`, `generateManifest`, `writeManifest`. `buildGraph` now returns `{classifications, cycles}` (batch 031). Two `Set` heuristics in §6. |
| `overview.js` | 386 | TS-vendored (orchestr8 PRD `overview.ts`) | LIVE via data-ingestion | Project-shape ingestion. Reads `package.json`/`vite.config.ts`/`tauri.conf.json`/`tsconfig.json`. **Already detects Tauri/Vue/Rust signals** (CORE_DEPS, RUST_CORE_DEPS) — re-usable as project-shape probe for conditional parser dispatch (§5). |
| `parser-persistence.js` | 334 | TS-vendored (maestro `parserPersistence.ts`) | LIVE via data-ingestion + background-indexer | SQLite sink → `scaffolder_data.sqlite` (NOT the main `st8.sqlite`). 9 tables (see §4). |
| `route-parser.js` | 342 | TS-vendored | LIVE — degenerate output on st8 | Vue Router only. 0 nodes on st8-on-itself. |
| `store-parser.js` | 377 | TS-vendored | LIVE — degenerate | Pinia/Vuex only. 0 nodes on st8. |
| `type-parser.js` | 287 | TS-vendored | LIVE — narrow | Regex-based scan of `<root>/src/types/`. st8 → ~0 nodes. |
| `ui-parser.js` | 286 | TS-vendored | LIVE — degenerate | Vue SFC with NaiveUI `n-` prefix. 0 nodes on st8. |

Total: 5,101 LOC across 11 files. Net live producers reaching canonical
InsightRecords today: **0** (all canonical InsightRecord writes come from
`cycle-insight-emitter.js` in `src/features/analysis/`, P=37).

═══════════════════════════════════════════════════════════════════
## 2. background-indexer's 4 emit paths — can a NEW thin adapter call them?
═══════════════════════════════════════════════════════════════════

The four emit sites carry canonical category names. They run inside two
instance methods on `BackgroundIndexer`. The emit logic itself is pure data
shaping — the only class-state dependencies are `this.insightStore` (a real
InsightStore handle) and `projectId` (string). Both injectable from outside.

| Site | Method | Category | Severity | Input shape | Class-state deps |
|---|---|---|---|---|---|
| L499–515 | `extractInsights` | `dependency` | medium/high | `importNodes` filtered by `metadata.sourceFile`, `importsByFile` Map counting > 15 | `this.insightStore` |
| L516–536 | `extractInsights` | `unused_export` | low | `exportNodes` with `metadata.dependencyWeight === 0 && name !== 'default'` | `this.insightStore` |
| L550–600 | `generateNodeInsights` | `structural` | info | per-node switch on `node.type` for `FILE`, `STORE`, `COMPONENT` | `this.insightStore` |
| L577–587 | `generateNodeInsights` | `api_surface` | info | per-node switch on `node.type === COMMAND` | `this.insightStore` |

**Verdict: extractable.** Each one can be lifted into its own Recipe-A
emitter module (~40-90 LOC) following the cycle-insight-emitter.js shape:

```
src/features/analysis/dependency-coupling-emitter.js     (Recipe A from L499–515)
src/features/analysis/unused-export-emitter.js           (Recipe A from L516–536)
src/features/analysis/structural-node-emitter.js         (Recipe A from L550–600)
src/features/analysis/api-surface-emitter.js             (Recipe A from L577–587)
```

What each adapter needs as input — the discriminator:

1. **`dependency`** — needs a graph with IMPORT nodes carrying
   `metadata.sourceFile`. **Available today** from `data-ingestion.ingestSingleProject`
   output (already returns `{nodes, edges, properties}`; IMPORT nodes are
   created at L1094–1108 with `metadata.sourceFile` set). Also derivable
   from st8.sqlite via Recipe C: SELECT source_fingerprint, COUNT(*) FROM
   connections GROUP BY source_fingerprint HAVING COUNT(*) > 15.

2. **`unused_export`** — needs EXPORT nodes with computed `dependencyWeight`.
   **Available today** from `data-ingestion.ingestSingleProject` (L1117–1145
   sets `dependencyWeight` via `computeDependencyWeight`). Also derivable
   from st8.sqlite via Recipe C if a future indexer pass records exports
   into a new `file_exports` table (does NOT exist yet — would need a
   schema addition or AST-on-the-fly read).
   - **Lower-friction alternative**: skip dependencyWeight entirely; use
     `EXPORT` nodes from data-ingestion + a "consumer count" query against
     `connections` (export count of exports - count of inbound connections).
     For st8-on-itself this means most JS export names won't surface
     (st8's connection rows are file-level, not symbol-level), so this
     gives partial signal at best until symbol-level edges land.

3. **`structural`** — three sub-emitters (FILE / STORE / COMPONENT). The
   FILE one is **st8-friendly** (every file_registry row produces one);
   STORE + COMPONENT are degenerate on non-Vue projects. Recommend split:
   - `structural-file-emitter.js` — one info-severity insight per file
     ("File indexed: <name>" + path) sourced from `persistence.getAllFiles()`.
     **Pure Recipe C.** Trivial. Would emit ~320 rows for st8 today.
   - `structural-store-emitter.js` / `structural-component-emitter.js` —
     defer until conditional parser dispatch (§5) lands.

4. **`api_surface`** — st8 has no Tauri commands. **For st8 itself**, the
   useful adaptation is "exported function never imported by another file"
   (analogous to unused_export but at the file level, not symbol level).
   That's already covered by `gap-analyzer.js`'s D-dimension output —
   convertible to canonical `api_surface` via a thin wrapper subscriber
   that reads gap-analyzer's output and re-emits with the canonical
   category name. (Cross-dir: see §8.)

### Minimum wrapper template (per emitter)

Every adapter is the same shape as `cycle-insight-emitter.js:emitCycleInsights`:

```js
function emitXInsights(input, options = {}) {
  const projectId = options.projectId || 'st8';
  if (!Array.isArray(input) || input.length === 0) return { inserted: 0, skipped: 0 };
  const store = options.store || require('./insight-store').getInsightStore();
  const insights = [];
  for (const item of input) {
    if (!item.filePath) continue;
    const fileId = store.ensureFileSlot(projectId, item.filePath);
    insights.push({
      projectId, fileId, filePath: item.filePath,
      passNumber: 2, // Pass 2 = Dependency Health
      category: 'dependency' | 'unused_export' | 'structural' | 'api_surface',
      severity: ...,
      description: ..., evidence: ...,
      relatedNodeIds: [...], context: {...},
    });
  }
  return { inserted: store.addInsightsBatch(insights), skipped: 0 };
}
module.exports = { emitXInsights };
```

Subscriber registration mirrors P=37 cycle slot — each gets its own free
priority slot in the 37–49 range (38=dependency, 39=unused_export,
36=structural-file, 41=api_surface). Test scaffold = `fakeStore` (already
proven in `tests/features/analysis/cycle-insight-emitter.test.js`).

**`background-indexer.js` itself stays dormant.** The adapters do NOT
revive it; they bypass it. The founder-deferred status is respected.

═══════════════════════════════════════════════════════════════════
## 3. data-ingestion's circuit-breaker — promote to shared primitive?
═══════════════════════════════════════════════════════════════════

The pattern lives at `data-ingestion.js:83–326` and is genuinely well-designed:

- `CIRCUIT_BREAKER_CONFIG` (configurable: failureThreshold/resetTimeoutMs/halfOpenMaxAttempts).
- `ADAPTIVE_RETRY_CONFIG` (configurable: baseDelayMs/maxRetries/errorDelayMap/skipErrors).
- `healthMonitor` Map → per-parser entries with state machine
  `closed → open → half-open → closed`.
- `retryParser(name, fn, fallback)` — wraps any async producer.
- `fallbackChainParser(name, primary, regexFallback, fallback)` — three-tier.
- `getParserHealthReport()` — observability.
- `configureDataIngestion()` exposed since ticket 16 with safe-tune bounds.
- Already covered by `tests/features/indexing/data-ingestion-config.test.js`.

**Reusable primitive verdict: YES, but the lift is mid-weight, not light.**
Current state: module-private state (the `healthMonitor` Map keyed by
parserName) is global to data-ingestion.js. Promoting to shared primitive
requires either:

(a) **Refactor in place** — extract `src/shared/utils/circuit-breaker.js`
exposing a class `CircuitBreaker({ failureThreshold, resetTimeoutMs, ... })`
with methods `wrap(fn, fallback)` / `getHealth()`. `data-ingestion.js`
imports it and keeps its singleton instance for parser monitoring. Other
consumers (signal-path-adapter, generate-report) instantiate their own.
- Pros: clean separation, testable independently, no global state surprise.
- Cons: data-ingestion.js is TS-vendored — hand-editing prohibited per
  batch 030 rule. **Blocker.** Would need either: (i) maestro re-vendor with
  the extraction, or (ii) a sibling `circuit-breaker.js` plus updating the
  no-edit policy for data-ingestion.js to allow an internal `require` rewrite,
  or (iii) ship a NEW `src/shared/utils/circuit-breaker.js` and have other
  callers use it WITHOUT touching data-ingestion.js (leaves duplication).

(b) **Option (iii) — duplicate the small bit, share the new bit.** Write
~120 LOC of shared `circuit-breaker.js`. Adopt in:
- `src/features/analysis/signal-path-adapter.js` — currently no protection
  against malformed graphs causing the path-generator to hang (the very
  wedge bible batch 028 surfaced for `/api/generate-report`).
- `src/features/analysis/report-generator.js` — same wedge risk.
- `src/features/analysis/path-generator.js` — has scope caps but not
  resilience-style backoff on retry. Marginal benefit.
- **Stage 3 candidate** — `src/features/search/sonic-client.js`. The
  daemon-graceful-degrade pattern (batch 027) is half a circuit breaker
  already; formalising it would let SQLite-fallback decisions be
  instrumented and exposed via a `/api/sonic-health` endpoint.

**Recommendation:** ship a small `src/shared/utils/circuit-breaker.js`
(~120 LOC) that re-implements the pattern verbatim. Have `signal-path`
and `generate-report` opt in. Leave data-ingestion.js untouched (vendored).
Eventually re-vendor data-ingestion.js to consume the shared primitive.

The PRIMARY value: a `/api/generate-report wedge` (batch 028 finding,
still open) becomes a CIRCUIT-OPEN telemetry event instead of an
indefinite hang. That's a real ops win.

═══════════════════════════════════════════════════════════════════
## 4. parser-persistence.js's 9 tables — populated? read? insight-bearing?
═══════════════════════════════════════════════════════════════════

Database: `scaffolder_data.sqlite` (NOT `st8.sqlite`). Path resolved via
`graph-persister.getSharedDatabasePath()`.

Tables created (`ensureProjectTables` + ad-hoc in two methods):

| Table | Purpose | Populated by | Read by (live) |
|---|---|---|---|
| `ProjectFiles` | file_path + file_name keyed by project_id + snapshot_id | `persistOverviewData` (called by `data-ingestion` when `persist=true`) AND `background-indexer.persistGraph` | NONE in `src/` |
| `Stores` | Pinia store metadata | `persistStoreData` | NONE — degenerate on st8 |
| `Routes` | Vue Router routes | `persistRouteData` | NONE — degenerate on st8 |
| `Commands` | Tauri commands | `persistCommandData` | NONE — degenerate on st8 |
| `CommandInvocations` | invoke() call sites | `persistCommandData` | NONE — degenerate on st8 |
| `Imports` | imports parsed from type-text | `persistTypeData` (uses regex over typeText only) | NONE |
| `Exports` | exports (interfaces/types/enums) from type-text | `persistTypeData` | NONE |
| `StoreProperties` | state-key/getter/action breakdown per store | `persistStorePropertiesData` (only called from background-indexer.queueMultiPassAnalysis path → dormant) | NONE |
| `VerificationIssues` | from integr8 verification stage | `persistVerificationIssues` (only called from integr8 pipeline tail → dormant) | NONE |

**Critical observation:** the `ingestSingleProject(projectPath, persist)`
parameter `persist` controls whether parser-persistence writes happen at
all (data-ingestion.js:1176–1186). In `src/features/graph/builder.js`'s
call path and the live `INDEX_COMPLETE` chain, **`persist` is never set to
`true` for st8-on-itself** — only the dormant `integr8/index.js:80` and
the dormant background-indexer pass `true`. So in normal st8 operation,
**every table above is EMPTY on disk today.**

Verifiable: `scaffolder_data.sqlite` for st8-on-itself contains only
`FileInsightSlots` (300 rows) + `InsightRecords` (299 rows) per the
graph-persister.md research from batch 030 (§7.3). The 9 parser tables
exist as CREATE TABLE definitions but are empty.

**Insight-source potential:**

- `Imports` / `Exports` would be high-value IF populated correctly. They
  currently parse from `typeText` regex output only, which is degenerate
  on st8. The right way to populate them is to redirect `data-ingestion.js`'s
  AST-extraction loop (L1086–1170) to write into these tables for ALL
  files, not just types. **Pure schema migration + writer change.**
- Once Imports/Exports are populated, **canonical `unused_export` becomes
  a Recipe C analyzer** (`SELECT e.* FROM Exports e LEFT JOIN Imports i
  ON i.imported_from = e.source_file AND i.imported_names LIKE
  '%' || e.exported_name || '%' WHERE i.import_id IS NULL`) without any
  background-indexer dependency.
- `ProjectFiles` is partly redundant with st8.sqlite's `file_registry`
  — they're parallel tables in different DBs. Reconciliation is
  out-of-scope but flag-worthy.

**Recommend tickets**:
- T-PP-1: Move AST-Import/AST-Export persistence from in-memory-only
  to `Imports` / `Exports` tables (rewriter of `data-ingestion.js:1086–1170`).
  **Note** — TS-vendored constraint applies. Either re-vendor or write a
  thin sibling that consumes data-ingestion's in-memory output and writes
  to the tables on its own.
- T-PP-2: Recipe-C `unused-export-detector.js` reading from `Exports` ⊖
  `Imports`. Subscriber at P=39 emits canonical `unused_export`.

═══════════════════════════════════════════════════════════════════
## 5. Specialised parsers — conditional-skip for non-Vue/Tauri projects
═══════════════════════════════════════════════════════════════════

Five of the six specialised parsers are Vue/Pinia/Tauri-calibrated.
On st8-on-itself, they spend cycles producing 0 nodes:

- `store-parser.js` — Pinia stores
- `route-parser.js` — Vue Router routes
- `command-parser.js` — Tauri `#[tauri::command]` + `invoke()`
- `type-parser.js` — `<root>/src/types/*` regex scan
- `ui-parser.js` — Vue SFC + NaiveUI `n-` prefix

Each is wrapped in `retryParser()` so a failed parse is logged but doesn't
crash the pipeline. They DON'T fail on st8 — they return empty text reports
(0 nodes), which is silent. **The cost is glob scans + I/O, not exceptions.**

**The detector already exists.** `overview.js:58–68` declares:
```js
const SCAN_DIRS = ['src', 'src-tauri'];
const KEY_CONFIG_FILES = ['package.json', 'vite.config.ts',
                          'tauri.conf.json', 'tsconfig.json'];
const ENTRY_POINTS = ['src/main.ts', 'src-tauri/src/main.rs'];
const CORE_DEPS = ['vue', 'pinia', 'vue-router', 'naive-ui',
                   '@tauri-apps/api', 'fs-extra'];
const RUST_CORE_DEPS = ['tauri ', 'tokio ', 'serde ', 'rusqlite '];
```

This IS a project-shape probe. Today it only produces a text report.

**Recommendation: extract `src/shared/utils/project-shape.js`**
returning `{ hasVue, hasPinia, hasVueRouter, hasNaiveUi, hasTauri,
hasRustSide }` from one read of `package.json` + `Cargo.toml`. Then
modify the dispatch logic in `data-ingestion.ingestSingleProject` to:

- Always run `overview` + `type` (file-list + types are project-agnostic).
- Skip `store` when `!hasPinia`.
- Skip `route` when `!hasVueRouter`.
- Skip `command` when `!hasTauri`.
- Skip `ui` when `!hasVue` AND `!hasNaiveUi`.

This shaves five glob scans on JS-only projects (estimated ~200ms-1s
wall-clock per index pass on a 320-file project; bigger payoff on larger
trees). It also removes noise from the `[dataIngestion]` log output.

**Constraint:** `data-ingestion.js` is TS-vendored. Either re-vendor with
the dispatcher tweak, or write a NEW wrapper `src/features/indexing/
ingestion-dispatcher.js` that exports `ingestSingleProjectShaped` which
internally pre-computes the shape, sets dummy fallbacks for skipped
parsers, then calls the existing data-ingestion functions. The wrapper
approach keeps the vendored file untouched.

═══════════════════════════════════════════════════════════════════
## 6. Other substring heuristics in indexer.js
═══════════════════════════════════════════════════════════════════

After Batch 031's connection-resolver, the per-import substring matcher
is gone. Two other heuristic sets remain in `indexer.js`:

| Heuristic | Lines | Type | Precision concern |
|---|---|---|---|
| `IGNORE_DIRS` | 162 | `Set` of basenames | **Basename-only**, no path-context check. A `vendor/` inside any depth is dropped (intended), but a project-relevant directory named e.g. `dist-original/` is NOT (unrelated). False-negative risk low; false-positive risk near-zero. **Acceptable as-is.** |
| `SELF_WRITTEN_BASENAMES` | 166 | `Set` of basenames | `connection-state.json`, `ai-signal.toml`. Both st8-emitted at TARGET_ROOT. If a target project happens to have a file with one of those names at any depth, it gets skipped — **false-positive risk for misnamed conflicts**. Low real-world likelihood. |
| `parseImports → imp.source.startsWith('.')` | 312 | `classifyBasic` fallback only | Used only when `getGraphBuilder()` returns null. Resolution via `path.resolve(dir, imp.source)` — actually correct (uses node's `path.resolve`, the right primitive). **Not a substring matcher.** Acceptable. |
| `CODE_EXTENSIONS` | 161 | `Set` extension list | Includes `.md` and `.txt` and `.json` — **interesting**: indexer picks up Markdown + plain text as "code files." This is why st8's own `.md` files end up in `file_registry`. Intentional per `discoverFiles` design (documentation is code in the st8 worldview). Not a heuristic to fix but a fact to know. |

**Verdict: no new substring resolvers needed.** The remaining heuristics
are either (a) basename allowlists with low false-positive risk or (b)
already use the correct `path.resolve` primitive. The connection-resolver
work in Batch 031 already addressed the load-bearing case.

**One small future-precision opportunity** — `SELF_WRITTEN_BASENAMES` could
be path-anchored to TARGET_ROOT (only skip the file when at depth=0). That's
~3 lines of code, near-zero benefit on real-world projects, NOT
recommended for this wave.

═══════════════════════════════════════════════════════════════════
## 7. TOP 3 QUICK WINS (rank by impact × confidence / effort)
═══════════════════════════════════════════════════════════════════

### Win 1 — `structural-file-emitter.js` (Recipe C)
**Impact: medium. Confidence: very high. Effort: ~80 LOC + ~6 tests.**

The smallest possible second canonical-category emitter. Reads
`persistence.getAllFiles()`, emits one `category='structural'`,
`severity='info'`, `description='File indexed: <name>'` row per
file. **No external dependencies, no probability of regression**,
mirrors `cycle-insight-emitter.js` exactly. Wires at P=36 (free slot
between schema-card-emitter P=20 and insight-store-populator P=35 …
actually P=36 between populator and cycle-emitter; trivial). For
st8-on-itself produces ~320 rows.

Validates the recipe-A pattern can produce N>1 canonical categories
without re-orphaning anything. Demonstration value > raw signal value.

### Win 2 — `shared/utils/circuit-breaker.js` + signal-path/report-gen adoption
**Impact: high. Confidence: high. Effort: ~120 LOC primitive + ~30 LOC per consumer + ~15 tests.**

Promote the data-ingestion circuit-breaker pattern to a shared utility
WITHOUT touching the vendored data-ingestion.js. Two consumers adopt it
on Day 1: `signal-path-adapter` and `report-generator`. **Closes batch
028's `/api/generate-report` wedge** by converting indefinite hangs into
circuit-open telemetry events. Pairs with a `/api/circuit-health` endpoint
or surfaces health into `/api/state`.

Risk: minimal — net-new code. Test-first: fake-fn → 3 consecutive
failures trips → reset-timeout-elapsed half-open → recovery closes.

### Win 3 — `dependency-coupling-emitter.js` (Recipe C off persistence)
**Impact: medium. Confidence: high. Effort: ~100 LOC + ~8 tests.**

Read st8.sqlite directly (post-batch-031 the connections table is accurate):
```sql
SELECT sourceFingerprint, COUNT(*) c
FROM connections WHERE isResolved = 1
GROUP BY sourceFingerprint HAVING c > 15
```
For each row, emit canonical `category='dependency'`, severity=medium/high
(>25 → high). One subscriber at P=38. Mirrors background-indexer's L499–515
emit logic but sourced from persistence (Recipe C, not Recipe A). For
st8-on-itself today (188 connection rows, 320 files), this likely emits
0–3 rows — a TRUE NEGATIVE signal proving the pipeline works on calibrated
data, like the cycle pipeline.

**Threshold of 15** is the maestro default and may be too lenient OR too
strict for JS projects; expose as `configureCouplingThreshold()` for tunability.

(Win 4 candidate — `unused-export-detector` — requires the `Exports`
parser-persistence table to be populated first; see §4 T-PP-1/T-PP-2.
Two-wave dependency; deferred.)

═══════════════════════════════════════════════════════════════════
## 8. Cross-directory dependencies
═══════════════════════════════════════════════════════════════════

`src/features/indexing/` reaches outside the dir for:

- `src/core/database/graph-persister.js` (`getSharedDatabasePath`,
  `getSharedDatabaseInit`) — required from `background-indexer`,
  `parser-persistence`, `data-ingestion`-derived flow. The shared-DB-path
  convention is the contract binding indexing → core.
- `src/features/search/sonic-client.js` — required from `background-indexer`
  only (dormant call site). No live dependency from this dir to search.
- `src/features/analysis/insight-store.js` — required from `background-indexer`
  only. The proposed emitters in §2 would each re-require it; that's
  exactly the cycle-insight-emitter.js pattern (the require sits in
  `src/features/analysis/`, not in indexing).
- `src/features/graph/builder.js` — calls `data-ingestion.ingestSingleProject`
  AND `indexer.buildGraph` calls `builder.buildDependencyGraph`. Two-way
  edge; not a cycle (different functions in each direction).
- `src/shared/utils/ast-parser.js` — `indexer.js`, `data-ingestion.js`,
  `route-parser.js`, `store-parser.js`, `command-parser.js`, `type-parser.js`,
  `ui-parser.js`, `overview.js` all reach into shared/utils. Sane.
- `src/shared/utils/safe-fs.js` + `io-chan.js` — data-ingestion's
  resilience layer for FS reads.
- `src/shared/types/integr8-types.js` + `st8-types.js` — NodeType enum
  + `generateFingerprint`.

**No bi-directional cycles** between this dir and any other. The Pass-2
proposals (§7 wins 1+3) live in `src/features/analysis/` (per the
existing cycle-insight-emitter precedent) and consume persistence — no
dependency direction reversal.

**Gap-analyzer ↔ canonical category bridge** (§2 entry 4 / api_surface):
- `gap-analyzer.js` currently writes `.st8/gap-analysis.md` (P=30) but
  its 6 D-dimensional output never becomes InsightRecords.
- A "gap-analyzer-canonical-bridge.js" subscriber at P=42 (after
  intent-seeder P=40, after the per-pass canonical emitters) could read
  the gap-analyzer's output and re-emit selected D-dimensions as canonical
  `documentation` / `anti_pattern` / `api_surface` InsightRecords. This
  is a separate wave but worth flagging — it's the cheapest path to 3
  more canonical-13 categories landing.

═══════════════════════════════════════════════════════════════════
## 9. Gaps + open questions
═══════════════════════════════════════════════════════════════════

1. **Founder gate on §5 — does the conditional-skip dispatcher count as
   "extras" per the wave-discipline rule?** The vendored data-ingestion.js
   can't be hand-edited, so the wrapper approach is the only path. The
   parsers themselves do no harm being run on st8 (silent zero-output).
   Skip optimisation is real but small. Ask before doing.

2. **`scaffolder_data.sqlite` vs `st8.sqlite` reconciliation question.**
   Two DBs with overlapping file-identity data (`ProjectFiles` vs
   `file_registry`). The "right" design is one of: (a) merge to single
   DB; (b) document the snapshot-vs-canonical split and lean into it.
   Out-of-scope for data-unblock-pass-2 but a known weight.

3. **Symbol-level vs file-level connections.** Today's `connections`
   table is file-to-file. The `unused_export` canonical category and
   the future `api_surface` adapter need symbol-level edges. Two paths:
   (a) add `connections.importSpecifier` IS already there but unindexed;
   (b) introduce `connections_symbols` join table. Open design question.

4. **`background-indexer.js` revival path.** §2's emitter extraction
   means each individual canonical-category producer ships standalone
   without reviving background-indexer. **But** if/when the founder
   does choose to revive it (P1 in sonic-and-search.md), the four
   in-file emitters would be redundant with the extracted versions.
   Recommend: when extracting an emitter to its own file, leave a
   comment in background-indexer.js noting "duplicated by
   src/features/analysis/<x>-emitter.js — revive path must reconcile."

5. **Sonic gating.** `populateSonicIndex` (background-indexer L620) is
   the search-side counterpart. If/when the founder approves Recipe-A
   producers feeding Sonic separately, the architecture splits into
   "InsightStore writers" + "Sonic pushers" with one optional shared
   primitive. Not in scope here.

6. **Project-id is hardcoded to `'st8'`** across cycle-insight-emitter
   and insight-store-populator. Multi-project indexing is a future
   concern but every new emitter I'm proposing also hardcodes 'st8' —
   carries the same debt forward. Flag for the multi-project wave.

7. **Test 207 vs 504.** CLAUDE.md still says 207 passing; bible batch
   031 reports 504. Confirmed CLAUDE.md is stale. Already known per
   batch 029 closing notes — flagging for completeness.

—

End of report. 5,101 LOC audited across 11 files in
`src/features/indexing/`. Top recommendation: ship Win 1 + Win 3 in this
wave (two new Recipe-C canonical-category emitters), defer Win 2
(circuit-breaker primitive) to its own follow-up because its impact
profile is "ops resilience" rather than "data unblock."
