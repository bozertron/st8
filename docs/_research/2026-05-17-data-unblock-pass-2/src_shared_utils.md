# Research: `src/shared/utils/` — data-unblock pass 2

**Scope:** `/home/user/st8/src/shared/utils/` (6 files, 2,771 LOC)
**Date:** 2026-05-17
**Mode:** read-only research

---

## 1. Directory inventory

| File | LOC | Purpose (1 line) | Origin | Live callers (in `src/`) |
|---|---|---|---|---|
| `ast-parser.js` | 1102 | Babel-based import/export extractor + rich metadata (complexity, jsdoc, purity, paramTypes, re-export chain) | TS-vendored (compiled, `__createBinding` boilerplate present) | 2 (`indexer.js`, `emitter.js`) |
| `birth-timestamp.js` | 176 | `deriveBirthTimestamp` — identity-preserving with persistence reuse + unreliable-birthtime detection | hand-written (Wave 3A ticket 15) | 1 (`indexer.js`) |
| `ground-plane.js` | 273 | XDG directory verification — `data/cache/plugins/temp` with fallback paths | TS-vendored | 0 in live call graph (referenced in comments + frontend mention) |
| `io-chan.js` | 395 | Priority-based I/O channel router (CRITICAL/IMPORTANT/ANALYSIS/BEST_EFFORT) + CircuitBreaker | TS-vendored | 1 (`data-ingestion.js`) |
| `safe-fs.js` | 598 | Result<T,FsError> filesystem wrappers + `FileHandlePool` + `WriteBufferPool` | TS-vendored | 2 *function* call sites (`data-ingestion.js`, `ground-plane.js`). `FileHandlePool` and `WriteBufferPool` exports: **0 consumers** |
| `settings-crypto.js` | 227 | AES-256-GCM at-rest encryption for `st8_settings` apiKey rows | hand-written (Wave 5E ticket 2) | 1 (`persistence.js`), 4 test files |

**Bible's own audit (line 1559-1562):** `astParser` GREEN; `ioChan` GREEN; `safeFs` GREEN ("15 exports, 1 consumer"); `groundPlane` RED ("Orphaned — no consumers"). The `15 exports, 1 consumer` count for safe-fs is **known and accepted** — see §12 question 1.

---

## 2. Stated intent

- **`ast-parser.js`** — canonical AST extractor for the whole indexing/schema-card pipeline. Header documents a **14-shape SPECIFIER COVERAGE MATRIX** (6 imports + 7 exports + 1 source extraction) and explicitly names downstream consumers: `emitter.js`, `indexer.js (Pass-1)`, `intent-seeder.js`, `data-ingestion.js`. Returns *rich* per-export metadata: `signature`, `returnType`, `paramTypes`, `complexity {cyclomatic, cognitive, linesOfCode}`, `isPure`, `jsdocTags`, `reexportChain`, `originPath`, `exportVisibility`.
- **`birth-timestamp.js`** — fixes the identity bug from Wave 3A ticket 15 (epoch birthtime, stat fallback dead code). Returns `{birthTimestamp, origin}` where origin is `'stat-birthtime' | 'mtime-fallback' | 'reused-persisted'`. Includes a `createFallbackReporter()` that fuels `.st8/identity-risk.json`.
- **`ground-plane.js`** — directory-verification utility for a cross-tool exchange surface that was **never built**. Roadmap P1 in `docs/_pending-roadmap/sonic-and-search.md`: "Restore the founder-intended exchange surface".
- **`io-chan.js`** — priority-tiered I/O bus with circuit breakers, intended as the gatekeeper for all filesystem I/O. Today only `data-ingestion.js` routes through it.
- **`safe-fs.js`** — never-throws filesystem wrapper. Also bundles `FileHandlePool` (EMFILE-bounded handle pool with leak detection) and `WriteBufferPool` (batched-write pool with shutdown-flush hooks). Both classes are export-ready but **zero consumers** in the live tree.
- **`settings-crypto.js`** — wired end-to-end through `persistence.upsertSetting` / `getSetting` (Wave 5E ticket 2 verdict: live + tested).

---

## 3. Computed-but-discarded data candidates

The headline finding for this directory: `ast-parser.js` produces **rich per-export metadata** that flows into `data-ingestion.js` integr8 nodes and into schema-card JSON, but the live `st8.sqlite` persistence layer keeps **none of it**.

| Site | What's computed | Where it lands | Where it's lost | Canonical category |
|---|---|---|---|---|
| `ast-parser.js:1011` `computeComplexity()` | `{cyclomatic, cognitive, linesOfCode}` per export | (a) integr8 nodes via `data-ingestion.js:1141`, (b) JSON schema cards via `emitter.js:55` splat | `connections` table has no `complexity` column. No reader pulls `complexity` out of schema-cards. The only reader (`path-generator.js:634`) reads from in-memory integr8 nodes, not from persistence — so complexity is recomputed each call, never stored | **`complexity`** |
| `ast-parser.js:987` `detectPurity()` | `isPure: boolean` per export | Same as above (data-ingestion + schema cards) | Zero readers anywhere in `src/`. Field is written to `metadata.isPure` and never queried | **`pattern`** (impure-function flag) |
| `ast-parser.js:1060` `extractJsDocTags()` | Array of `{name, value}` JSDoc annotations | Same as above | Zero readers. `@deprecated`, `@throws`, `@returns`, `@private` tags are extracted but never surfaced as insights, gap-analyzer findings, or schema-card warnings | **`documentation`** (missing-docs / `@deprecated`) |
| `ast-parser.js:970` `extractParamTypes()` | TS type annotations per param | Same | Zero readers downstream of integr8 nodes. `relationship-analyzer.js:163` checks `signature` string mismatch but never inspects `paramTypes` array | **`type_issue`** |
| `ast-parser.js:916` `traceReexportChain()` | Full chain of files traversed to reach origin | Splat-flows to schema cards via `exp.reexportChain` | Zero readers. The chain is useful for "find the real definition" UX but nothing consults it | **`structural`** |
| `birth-timestamp.js:155` `createFallbackReporter().summary()` | Per-pass count of files with epoch-birthtime fallback | `.st8/identity-risk.json` artifact + `/api/identity-risk` endpoint (wired Wave 3C) | **NOT discarded — wired.** Listed here for completeness | n/a (`circular_dependency`-adjacent, identity-risk is its own surface) |

**Estimated unblock effort per candidate:** ~80-150 LOC each — adapter at `analysis/` layer reading schema-card JSON, emitting `InsightRecord`s keyed to the canonical category, calling `insightStore.addInsightsBatch`.

---

## 4. Heuristic-resolver candidates

| Site | Current heuristic | Connection-resolver-style fix |
|---|---|---|
| `ast-parser.js:715` `extractDynamicImportsViaRegex` + `:729` `extractRequireStatements` | Regex on raw source for `import('...')` and `(const|let|var) X = require('...')` | Already has AST-based primary at `:643` `extractDynamicImportsFromAST`. The regex is fallback only — **correct** as a belt-and-suspenders. Not a bug. |
| `ast-parser.js:822` `resolveModulePath` | Tries extensions `['.ts','.tsx','.js','.jsx','.vue','/index.ts','/index.js','/index.tsx']` in order; bails for non-relative paths | Mirrors Node module resolution roughly. **Missing**: `package.json` `"exports"` map, `tsconfig.json` `paths`, `.cjs`/`.mjs`/`.cts`/`.mts`. For an internal repo that doesn't use those, current impl is fine; for self-introspection of st8 (no path aliases) it's accurate. Lower priority than ast-parser metadata wiring. |
| `ast-parser.js:742` `extractImportsViaRegex` (fallback only — invoked when babel throws) | Regex catches `import ... from 'x'`, `import('x')`, `require('x')`, `export {x} from 'y'` | **Limitation:** does not flag `importType: 'default' \| 'namespace' \| 'side-effect'` — assigns everything `'named'`. Matters only when babel parse fails; covered by error path. |
| `safe-fs.js:161` `getFallbackPath` (registry lookup via `primaryPath.startsWith(f.primary)`) | Substring/prefix match | Could collide if two registered primaries are nested. Real-world risk is low (only `ground-plane` would register fallbacks; it never does today). |

**No high-value heuristic-resolver candidates in this directory** that mirror the connection-resolver bug. The substring/regex paths here are intentional fallbacks.

---

## 5. Type-failure candidates

| Site | TS-source field | JS-runtime gate? | Risk |
|---|---|---|---|
| `ast-parser.js` `ExportEntry` rich fields (`isPure`, `complexity`, `jsdocTags`, `paramTypes`, `reexportChain`, `exportVisibility`) | Originally TS interface (file is compiled-from-TS) | None — splat-spread into `metadata: {…}` on integr8 nodes and `card.exports` arrays. SQLite `connections` table has **no column** for any of these; schema-card JSON accepts the shape freely | Drift between what the extractor *can* emit and what consumers *can* read is invisible. A new field added in re-vendoring goes unread; a renamed field would silently produce `undefined` in downstream code. |
| `birth-timestamp.js` `origin` field | JSDoc says `'stat-birthtime'\|'mtime-fallback'\|'reused-persisted'` | No runtime enum gate — string returned bare | A typo in a future code path that constructs a 4th value would not be caught. Low risk; only 3 producers in one function. |
| `io-chan.js` `IoChannelPriority` | TS enum, transpiled to runtime object (lines 18-28) | Yes — `normalizePriority` validates against `Object.values(IoChannelPriority)` and falls back to `BEST_EFFORT` | Safe. |
| `safe-fs.js` `FsErrorCode` | TS union; classified via `classifyErrorCode` switch | Yes — exhaustive switch returns `'UNKNOWN'` for unmapped | Safe. |
| `settings-crypto.js` ciphertext format | Hand-coded format check in `isCiphertext` | Strict — 3 segments, IV=12B, tag=16B, canonical-base64 round-trip | Bulletproof. |

**Synthesis-level concern (out of scope but worth noting):** `src/features/analysis/insight-store-populator.js:111-145` uses ad-hoc categories `'orphan'`, `'red-status'`, `'under-connected'`, `'under-imported'`, `'high-impact'` — NONE of these are in the canonical 13 enum at `docs/Insight Store/insightStore.ts:11-24` (`structural | dependency | complexity | pattern | security | performance | unused_export | circular_dependency | anti_pattern | type_issue | api_surface | test_coverage | documentation`). This is the textbook "TS enum stripped at compile, populator drifts" the prompt names. Belongs to the synthesizer's roll-up; included here because **the rich metadata in ast-parser.js maps cleanly onto the canonical 13** and could populate them instead of populator's ad-hoc strings.

---

## 6. Dormant producer candidates

- **`ast-parser.js` emits canonical-category-ready signals** that no module consumes:
  - `isPure: false` on functions calling `console`/`fs`/`process`/`fetch` or using `this`/`await` → maps to `'pattern'` (impure-function-with-side-effects).
  - `complexity.cyclomatic > N` → maps to `'complexity'` (over-complex function).
  - `jsdocTags` containing `{name: 'deprecated'}` → maps to `'pattern'` (deprecated-API).
  - `jsdocTags` containing `{name: 'todo'}` / `{name: 'fixme'}` → maps to `'pattern'`.
  - Missing `jsdocTags` on exported function → maps to `'documentation'` (undocumented-export).
  - `reexportChain.length > 3` → maps to `'structural'` (deep re-export funnel).
  - **`exportVisibility: 'star'`** with `resolvedExports: []` → maps to `'unused_export'` (star-re-export resolving to nothing).
  - `extractCommonJSExportsFromAST` detecting both `module.exports = X` AND `exports.foo = ...` in the same file → maps to `'anti_pattern'` (mixed export styles).

- **`birth-timestamp.js` `createFallbackReporter().summary()`** — already wired to `/api/identity-risk` (Wave 3C). Not dormant.

- **`ground-plane.js`** — flagged as orphan in bible line 1560. The roadmap (`docs/_pending-roadmap/sonic-and-search.md` P1) explicitly defers wiring. Founder's stated guidance: "the cross-tool ground-plane bridge to MAESTRO was never built". **DO NOT MARK DEAD** — corpus says deferred-on-purpose.

- **`safe-fs.js` `FileHandlePool` (lines 327-439) and `WriteBufferPool` (lines 445-598)** — both classes have public `acquire/release`, `write/flush`, `getMetrics`. **Zero consumers in `src/` or `tests/`**. These are infrastructure-ready but not wired into indexer, schema-emitter, or sonic-indexer. Wiring `FileHandlePool` into the indexer's per-file read loop would prevent EMFILE on >1024-file projects.

---

## 7. Subscriber-not-registered candidates

None in this directory — shared/utils modules don't register with `HookRegistry`. They're called directly by features/core.

A negative-space observation: `birth-timestamp.js` `createFallbackReporter` exposes `summary()` but there is **no `INDEX_COMPLETE` subscriber** in `src/core/hooks/default-subscribers.js` that calls `reporter.summary()` to emit a single notification — currently the indexer does it inline at the end of `indexDirectory`. Pulling it into a subscriber would let other observers (e.g. a future telemetry sink) read identity-risk without grepping logs.

---

## 8. Schema-field-declared-but-not-populated candidates

None inside this directory (`shared/utils/` defines no SQL schema).

But **dual-direction findings**:
- The `connections` table (`persistence.js:93`) has columns `importSpecifier`, `isResolved`, `confidenceScore` — all of which could be populated using `ast-parser.js`'s rich `imports` output:
  - `importSpecifier` ← `imp.specifiers.map(s => s.name).join(',')` (currently populated by `connection-resolver.js`)
  - `isResolved` ← already set
  - `confidenceScore` ← currently always 1.0; could be lowered for `isDynamic` imports, template-literal requires, or unresolved-re-export-stars. Maps to canonical `'dependency'` insights when low.
- `file_registry` has no column for `complexity_max` / `complexity_total` / `jsdoc_completeness_pct` per file — adding any of these would give the persistence layer a queryable signal that `ast-parser.js` already computes.

---

## 9. Wired-but-empty endpoints / paths

`/api/identity-risk` (Wave 3C) — wired and fed by `birth-timestamp.createFallbackReporter`. Not empty.

No other endpoints originate from this directory.

**Adjacent observation:** schema-card JSON files written under `st8_json/schema-cards/` carry `exports[].complexity`, `exports[].isPure`, `exports[].jsdocTags`, `exports[].reexportChain` (because `emitter.js:55` splats `astResult.exports` verbatim). The cards are written and indexed by `manifest-generator.js`, served via `/api/manifests` — but **no API surface returns the rich per-export fields back to the frontend**. If a UI ever wanted "show me functions with cyclomatic > 10" it would need to (a) build a new endpoint or (b) re-derive from cards client-side.

---

## 10. TOP 3 QUICK WINS

### 10.1 Wire ast-parser's rich metadata into canonical insights (HIGHEST VALUE)

- **Concrete change:** Add a new module `src/features/analysis/ast-insight-emitter.js` (mirrors `cycle-insight-emitter.js` from batch 031). Subscribe to `HOOKS.INDEX_COMPLETE` (or `FILE_INDEXED`). For each file's `astResult.exports`, emit `InsightRecord`s into the InsightStore with the canonical 13 categories:
  - `complexity.cyclomatic > 10` → `{category: 'complexity', severity: 'medium', description: '<fnName> cyclomatic=N'}`
  - `isPure === false && exportVisibility === 'default'` → `{category: 'pattern', severity: 'info'}`
  - `jsdocTags` includes `deprecated` → `{category: 'pattern', severity: 'high'}`
  - missing `jsdocTags` on exported function → `{category: 'documentation', severity: 'low'}`
  - `reexportChain.length > 3` → `{category: 'structural', severity: 'low'}`
  - `exportStars[].resolvedExports.length === 0` → `{category: 'unused_export', severity: 'medium'}`
- **Data unblocked:** Six dormant canonical categories begin receiving real data on every index pass. `/api/insights` filtered by category goes from "structural-only" to "diverse".
- **Canonical category mapping:** `complexity`, `pattern`, `documentation`, `structural`, `unused_export`, `type_issue` (the last via `paramTypes` mismatch with importer expectations — stretch).
- **LOC delta:** ~250 (new file + subscriber registration + tests).
- **Effort:** 3-4 agent-hours.

### 10.2 Replace insight-store-populator's ad-hoc categories with canonical 13 (MEDIUM, cross-dir)

- **Concrete change:** `src/features/analysis/insight-store-populator.js:111-145` — rename `'orphan'` → `'unused_export'`, `'red-status'` → `'anti_pattern'` (or `'documentation'` if status reflects missing docs), `'under-connected'` → `'structural'`, `'under-imported'` → `'unused_export'`, `'high-impact'` → `'api_surface'`. Add a runtime guard in `insight-store.js` `addInsight` that asserts `category ∈ CANONICAL_13`.
- **Data unblocked:** Queries by canonical category from the frontend / API actually find rows. Today `getInsightsByCategory('unused_export')` returns empty even though `'orphan'` rows exist with that meaning.
- **LOC delta:** ~40 + guard (~20).
- **Effort:** 1-2 agent-hours.
- **Cross-dir:** lives in `src/features/analysis/` but anchored here because `ast-parser.js`'s rich fields are the natural producer for several of the canonical categories the populator currently misnames.

### 10.3 Wire `safe-fs.FileHandlePool` into the indexer's file-read loop

- **Concrete change:** `src/features/indexing/indexer.js` Pass-1 currently reads every project file via raw `fs.readFileSync` inside `extractImportsAndExports`. On a 5k-file repo with deep concurrency this hits EMFILE. Wrap the read in `safe-fs.safeReadFile` gated by a singleton `FileHandlePool` (`maxSize: 20`, `acquireTimeoutMs: 10000`).
- **Data unblocked:** Robust indexing on large repos; surfaces `FileHandlePool.getMetrics()` as a new observable for `/api/state`. **Not an insight unblock** — it's a reliability unblock that makes the rest of the data flow more dependable. Listed third because it's the one win that's purely infrastructure (no new canonical categories produced).
- **LOC delta:** ~60 (singleton, wire, expose metrics).
- **Effort:** 2-3 agent-hours.

---

## 11. Cross-directory dependencies

**This directory's outgoing imports:** none outside itself. `ground-plane.js` imports `./safe-fs.js`. `data-ingestion.js` (features/indexing) imports both `safe-fs.js` and `io-chan.js`; `indexer.js` imports `ast-parser.js` and `birth-timestamp.js`; `emitter.js` imports `ast-parser.js`; `persistence.js` imports `settings-crypto.js`.

**Incoming readers of the *rich fields* produced here:**

| Field | Producer | Reader | Read-back to UI? |
|---|---|---|---|
| `exp.complexity` | `ast-parser.js` | `data-ingestion.js:1141` (integr8 node metadata) → `path-generator.js:634` (cost estimation) | No |
| `exp.isPure` | `ast-parser.js` | `data-ingestion.js:1140` (integr8 node metadata) | No (used downstream by `path-generator` cost calc? — no) |
| `exp.jsdocTags` | `ast-parser.js` | `data-ingestion.js:1143` (integr8 node metadata) only. Schema cards include it via splat | No |
| `exp.reexportChain` / `originPath` | `ast-parser.js` | `data-ingestion.js:1133-1134` (integr8) + schema cards | No |
| `exp.signature` / `returnType` | `ast-parser.js` | `data-ingestion.js:1125-1126` + `relationship-analyzer.js:163-183` (signature-mismatch detection) + `schema-cards/printer.js:109` + `prd/generator.js:85` | Schema-cards printer renders to text; relationship-analyzer feeds gap-analyzer |
| `birthTimestamp` (reused-persisted) | `birth-timestamp.js` | `indexer.js` → `persistence.js` write path; reporter→`.st8/identity-risk.json` → `/api/identity-risk` | Yes (Wave 3C) |

**The pattern:** schema-card emitter is a faithful pass-through; integr8 data-ingestion is a faithful pass-through; **the gap is in `analysis/` modules that should be reading from one of those two sources and emitting canonical-category InsightRecords**. That's where the next batch's recipe applies.

**Cross-dir dependency for the synthesizer:** any plan that wires ast-parser metadata into insights will touch (1) `src/features/analysis/` (new emitter), (2) `src/core/hooks/default-subscribers.js` (registration), and (3) optionally `src/core/database/persistence.js` (if persisting alongside the InsightStore — the canonical store lives in `scaffolder_data.sqlite` per `insightStore.ts:7` `getSharedDatabasePath()`).

---

## 12. Gaps + open questions for the synthesizer

1. **Why are `FileHandlePool` and `WriteBufferPool` exported but never consumed?** Bible line 443-461 enumerates them as features of `safeFs.js` without flagging them as TBD. Was there an originally-planned consumer in `OGB/` that was retired? Quick win 10.3 assumes yes — would benefit from confirming with founder.

2. **Schema-cards already carry `complexity`/`jsdocTags`/`isPure` in their JSON.** Should the new ast-insight-emitter consume the cards (lazy, file-watcher-friendly, single source of truth) or call `extractImportsAndExports` directly (eager, in-memory, no IO)? The cycle-insight-emitter precedent uses persistence as the source. Schema-cards feel like the right analog here.

3. **Two insight-stores exist:** the canonical one at `docs/Insight Store/insightStore.ts` (compiled to `src/features/analysis/insight-store.js`, persisting to `scaffolder_data.sqlite` via `graph-persister.js`'s `com.scaffolder.app` path) AND no second store — but the populator writes ad-hoc category strings into it. Is the plan to extend the canonical 13 to include `'orphan'/'red-status'/'under-connected'/'under-imported'/'high-impact'`, or to remap the populator's strings to the existing 13? §10.2 assumed remap, but the populator's strings carry meaning the canonical 13 doesn't quite capture (`'red-status'` is a status — orthogonal to "what kind of code-smell").

4. **Identity-risk reporter is wired but `recordFallback`'s third argument (ts) is recorded; what *consumes* the per-file ts list?** `/api/identity-risk` returns the JSON artifact. Frontend reader?

5. **The TS-vendored files (`ast-parser.js`, `safe-fs.js`, `io-chan.js`, `ground-plane.js`) are compiled-from-TS** (visible `__createBinding`, `__importStar`, `__awaiter` blocks). The recent ast-parser SPECIFIER COVERAGE MATRIX header was *added by hand to the .js* (ticket 11). If TS sources are re-vendored, those edits revert. Should the synthesizer file a ticket to add `linguist-generated=true` + a re-vendor checklist, or commit to "we own these now, no upstream"?

---

## "Almost called this dead but the corpus said otherwise" notes

- **`ground-plane.js`** — 0 live callers in `src/`. The temptation is to mark it dead. But: `docs/_pending-roadmap/sonic-and-search.md` P1 explicitly defers wiring as "Restore the founder-intended exchange surface (ground-plane bridge)", and `sonic-and-search.review.md` line 105+126 shows the file received an *active* Wave 5B touch (`APP_ID` rename to `com.st8.app`). Bible line 1560 marks it RED-orphaned in the audit, but the founder-intended outcome is "wire it later, don't delete". **VERDICT: NOT DEAD, deferred-by-design.**

- **`safe-fs.js` `FileHandlePool` / `WriteBufferPool`** — zero consumers, looks dead. But these were hand-rolled to solve EMFILE / write-thrashing on heavy I/O — the bible's audit gave the file overall "GREEN | 15 exports, 1 consumer" which suggests the 1 consumer pattern (current data-ingestion) is acceptable. Pools probably stayed because they're cheap to keep and the indexer's eventual scale-up will need them. **VERDICT: dormant infrastructure, ready-to-wire (quick win 10.3), not dead.**

- **`ast-parser.js` `detectPurity` / `extractJsDocTags` / `computeComplexity`** — these felt "DEAD" because no analyzer consumes them. But: ticket 3 in `identity-and-analysis.for-review.json` mentions I-03 ("Enhanced Metadata") explicitly added these for downstream cost-estimation and they ARE wired into `path-generator.js:634` (`metadata.complexity`). The other fields (`isPure`, `jsdocTags`) are computed and stored but unused — those are the genuine **canonical-category-producer candidates** (§10.1), not dead code. The third-DEAD-CODE-verdict warning applies: don't recycle "no caller" into "delete me".
