# Research — src/features/analysis (Data Unblock Pass 2)

Date: 2026-05-17. Read-only audit. Mission: map canonical-13 InsightCategory
producers in this dir, identify gap-analyzer D1-D6 outputs that never become
InsightRecords, and surface dormant-but-ready code on the cycle-emitter pattern.

═══════════════════════════════════════════════════════════════════
## 1. File inventory (live / dormant / role / LOC / origin)
═══════════════════════════════════════════════════════════════════

| File | LOC | Origin | Status | Role |
|---|--:|---|---|---|
| `gap-analyzer.js` | 652 | Hand-written, st8-native | **LIVE** — P=30 INDEX_COMPLETE | 6-dim report → writes `.st8/gap-analysis.md`. Output never lands in InsightRecords. |
| `insight-store.js` | 361 | TS-vendored (`docs/Insight Store/insightStore.ts`) | **LIVE** (data layer) | SQLite sink for canonical InsightRecords. **Has been declared "dead" 3× — corpus-blind-spot per batch 030.** Hand-edits prohibited. |
| `insight-store-populator.js` | 165 | Hand-written, Wave 3B | **LIVE** — P=35 INDEX_COMPLETE | Emits 5 **ad-hoc** categories (`orphan` / `red-status` / `under-connected` / `under-imported` / `high-impact`). Drives /api/insights today. |
| `cycle-insight-emitter.js` | 96 | Hand-written, Batch 031 | **LIVE** — P=37 INDEX_COMPLETE | Canonical `circular_dependency` producer. **Template for Recipe A.** |
| `persistence-cycle-detector.js` | 124 | Hand-written, Batch 031 | **LIVE** — invoked from P=37 | Wraps `computeTarjanSCC` over live SQLite. **Template for Recipe C.** |
| `relationship-analyzer.js` | 923 | TS-vendored from maestro integr8 | **PARTIALLY LIVE** | `computeTarjanSCC` now live via P=37. `analyzeRelationships`, `analyzeStructuralSubtyping`, `detectBreakingChanges`, `detectCyclesWithTarjan` still callable ONLY from dormant `src/features/integr8/index.js:80`. |
| `path-generator.js` | 858 | TS-vendored | **LIVE** via signal-path-adapter | `generateMigrationPath` + `performTopologicalAnalysis` reached from `/api/signal-path`. Also called by dormant integr8 CLI. |
| `signal-path-adapter.js` | 338 | Hand-written, Wave 3B | **LIVE** | Builds SemanticGraph from persistence + scopes to focal subgraph. Now reads accurate edges post-batch-031. |
| `report-generator.js` | 283 | TS-vendored | **LIVE** | Reached from `/api/generate-report` (app.js:1578) and dormant integr8 CLI. Markdown output not converted to insights. |
| `intent-seeder.js` | 608 | Hand-written | **LIVE** — P=40 INDEX_COMPLETE | 70+ regex-pattern map → fills `file_intent`. Heuristic precision gap (P3.1 in roadmap). |

Total: 4,408 LOC. All 10 files are reachable in the live pipeline; the
dormancy is at the **function** level (sub-modules of relationship-analyzer).

═══════════════════════════════════════════════════════════════════
## 2. Canonical-13 producers — per-category status
═══════════════════════════════════════════════════════════════════

| Category | Producer? | Where | Wireable? | Notes |
|---|---|---|---|---|
| `circular_dependency` | **LIVE** | `cycle-insight-emitter.js` | shipped batch 031 | Two sources merged + deduped. |
| `structural` | DORMANT emitter | `background-indexer.js:554, 565, 591` | **YES** — extract emitter via Recipe A | Three emit sites (FILE / STORE / COMPONENT node types). Vue/Pinia-specific; for st8 itself need adaptation against `file_registry` rows. |
| `dependency` | DORMANT emitter | `background-indexer.js:507` | **YES** — Recipe A | "High import count > 15" — directly portable. |
| `unused_export` | DORMANT emitter | `background-indexer.js:527` | **YES** — Recipe A | Reads `metadata.dependencyWeight === 0`; needs adaptation since st8 doesn't compute dependencyWeight on file_registry. **Easier path:** scan exports vs connections.targetFingerprint in a Recipe-C-style detector. |
| `api_surface` | DORMANT emitter | `background-indexer.js:580` | **YES** — Recipe A | Tauri-command-specific. For st8 → adapt to surface "exported function never imported by frontend" / route-handler exports. |
| `complexity` | NO producer | — | NEW from scratch (Recipe A/C) | Inputs available: `file_registry.cyclomaticComplexity` if added; alternately use AST node-count + LOC heuristics from intent-seeder's read pass. |
| `pattern` | NO producer | — | NEW | Lowest priority — needs taxonomy decision. |
| `security` | NO producer | — | NEW (Recipe C) | Could grep for `eval`/`child_process.exec`/`new Function`/secrets. AST-driven. |
| `performance` | NO producer | — | NEW | Probably defer. |
| `anti_pattern` | NO producer | — | NEW | Could reuse gap-analyzer's "GREEN with low reachability" but reclassified as canonical. |
| `type_issue` | NO producer | — | NEW | Heuristic-only; runtime can't enforce TS. |
| `test_coverage` | NO producer | — | NEW (Recipe C) | Check if a file in `src/` has a sibling `tests/` mirror — straightforward query. |
| `documentation` | NO producer | — | NEW (Recipe C) | Gap-analyzer's D3 already has the data — files without `card.intent.purpose`. Almost-free conversion. |

**Bottom line:** 1 of 13 canonical categories wired (`circular_dependency`).
Four more have emitters already written in `background-indexer.js` (lines
507/527/554/580/591) — dormant only because background-indexer is unwired
per batch 027/030. **Recipe A makes each one a per-pass-as-hook-subscriber
without acquiring the missing maestro helpers.**

═══════════════════════════════════════════════════════════════════
## 3. Gap-analyzer D1-D6 outputs as InsightRecord candidates
═══════════════════════════════════════════════════════════════════

Gap-analyzer's `analyze()` returns a 6-dimension report and writes
`.st8/gap-analysis.md`. Every dimension's per-file findings are **discarded
after Markdown rendering** — never persisted as InsightRecords. This is the
**single biggest discarded-output surface in the dir.**

| Dimension | Per-file finding | Canonical category | Mapping |
|---|---|---|---|
| **D1 lifecycle** | `canProgress[]` (intent present but not in PRODUCTION) | `structural` | `description: "ready to progress to <next-phase>"`. |
| **D2 status** | `redFiles[].rootCauses` | `anti_pattern` (or new) | "No importers — orphan file" / "No exports — cannot be consumed" map cleanly. |
| **D2 status** | `greenLowReachability[]` | `dependency` or `anti_pattern` | "GREEN but reachability < 0.3". Currently re-computed by populator's `under-imported`. **Duplicate work.** |
| **D3 intent** | `unauthored[]` | `documentation` | "File lacks intent.purpose" — direct one-liner. **Fastest single quick win.** |
| **D4 exports** | `withoutExports` set | `unused_export` (inverse) or `structural` | "File has no exports — internal-only" — partial; the canonical `unused_export` is per-export not per-file. |
| **D4 exports** | `commonJsFiles` + `es6Files` split | `pattern` | Module-system heterogeneity insight. |
| **D5 connections** | `orphanImports[]` | `dependency` (severity high) | "Import target doesn't resolve to file_registry" — already accurate post-batch-031 connection-resolver fix. |
| **D5 connections** | `isolatedFiles[]` | `anti_pattern` | No imports AND no importedBy — true orphans. |
| **D6 architecture** | `missingEndpoints[]` | `api_surface` | "Required endpoint X has no handler module" — surfaces architectural completeness as canonical. |

**Concrete proposal:** introduce `gap-analyzer-insight-adapter.js`
(Recipe A) that takes the `report` object gap-analyzer already builds
and re-emits each per-file finding through `insightStore.addInsightsBatch`.
**Zero new computation.** Register at P=32 (after gap-analyzer at P=30,
before populator at P=35 so the populator's ad-hoc `under-imported`/`orphan`
can be deprecated in a later wave).

═══════════════════════════════════════════════════════════════════
## 4. Dormant-but-ready functions in relationship-analyzer.js
═══════════════════════════════════════════════════════════════════

Now that `computeTarjanSCC` is live, the next dormant tier in the same file:

1. **`detectBreakingChanges(previousExports, currentExports)`** (line 615).
   Takes two arrays of nodes, returns `BreakingChange[]`. Maps cleanly to
   `category: 'type_issue'` or `api_surface` (severity: 'breaking'). Inputs:
   we already store `exports` on schema cards across mutation log
   snapshots — two passes' worth of card data is all that's needed. Wire as
   Recipe C: `detectBreakingChangesFromMutationLog(persistence)`.

2. **`analyzeStructuralSubtyping(source, target)`** (line 421). Function
   signature compatibility. Internal to `detectBreakingChanges` but
   independently callable. No standalone wiring required if (1) lands.

3. **`detectCyclesWithTarjan(graph, generateConflictId)`** (line 890).
   This is the "conflicts" wrapper around `computeTarjanSCC` already used
   by integr8. The cycle-emitter went a different route (raw SCC + custom
   InsightRecord shape). Future: replace persistence-cycle-detector's
   custom shape with `detectCyclesWithTarjan` output for richer
   `breakRecommendation` field — currently dropped on the floor.

4. **`analyzeRelationships(externalGraph, currentGraph, targetPages)`**
   (line 15). The Stage-2 integr8 entry point. **Not directly applicable
   for self-introspection** — it's two-graph migration analysis. Skip.

═══════════════════════════════════════════════════════════════════
## 5. Substring / regex heuristics that should become precision resolvers
═══════════════════════════════════════════════════════════════════

| Site | Heuristic | Risk |
|---|---|---|
| `intent-seeder.js:55-126` FILENAME_PURPOSE_MAP | 71 regex patterns, first-match-wins on basename | Order is load-bearing AND brittle. Roadmap P3.1 already targets AST-driven replacement. |
| `intent-seeder.js:131-144` IMPORT_BEHAVIOR_MAP | 12 patterns | `/path/i` matches anything containing "path" — `pathGenerator.js`, `safe-path.js`. False positives. |
| `intent-seeder.js:149-158` EXPORT_VALUE_MAP | 8 patterns | Same first-match-wins fragility. |
| `path-generator.js:106` topologicalSortFiles | `n.name.includes(page) || n.path.includes(page)` | Substring match on target page name. signal-path-adapter passes full filepath which usually disambiguates, but **same-name files in different dirs collapse**. This is the exact bug class batch 031 fixed in connection-resolver. |
| `gap-analyzer.js:336` orphan-import resolution | Uses `||` fingerprint separator | OK now — accurate via batch 031 resolver. |

**Highest-value cleanup:** the path-generator substring match (Recipe-B-style
fix needed if/when we extend signal-path to ambiguous targets). The
intent-seeder map is roadmap-tagged P3.1.

═══════════════════════════════════════════════════════════════════
## 6. Type-failure patterns (TS schemas not enforced at runtime)
═══════════════════════════════════════════════════════════════════

Per batch 030, this is the systemic risk this dir embodies:

- **`InsightStore.addInsight` / `addInsightsBatch`** accept ANY string for
  `category` and `severity`. The TS source declares `InsightCategory` enum
  and `InsightSeverity = 'info'|'low'|'medium'|'high'|'critical'` — JS
  compile strips both. SQLite `category TEXT NOT NULL` rubber-stamps.
- Populator emits `severity: 'error'|'warning'|'info'` — `'error'` and
  `'warning'` are **NOT in InsightSeverity**. Cycle-emitter correctly
  uses `'high'`. **Silent drift in same table.**
- `path-generator.js` returns `MigrationStep[]` whose `action` enum
  values are stripped at compile. signal-path-adapter filters
  `s.action === 'copy_file'` (string-compared), would silently fail if
  the enum ever shifted.
- `signal-path-adapter` builds nodes with `type: NodeType.FILE` from
  integr8-types; if that enum changes upstream, downstream consumers
  silently desynchronize.

**Mitigation candidate (cross-cutting):** add a thin
`assertCanonicalCategory(category)` helper in `insight-store.js` (would
have to live in the TS source per the no-hand-edit rule). For now, every
new producer hard-codes a string literal from the enum.

═══════════════════════════════════════════════════════════════════
## 7. TOP 3 QUICK WINS
═══════════════════════════════════════════════════════════════════

### Win 1 — `gap-analyzer-insight-adapter.js` (Recipe A re-emit)

**The killer move.** Gap-analyzer already computes every per-file finding
needed for ~6 canonical categories. Just reshape and emit through the
same InsightStore path the cycle emitter uses.

- Touch: `src/features/analysis/gap-analyzer-insight-adapter.js` (new,
  ~140 LOC), `src/core/hooks/default-subscribers.js` (+ ~25 LOC,
  P=32 subscriber that calls `analyzer.analyze()` once and forwards),
  optionally refactor P=30 to share the analysis (compute once, reuse).
- Tests: `tests/features/analysis/gap-analyzer-insight-adapter.test.js`
  (~120 LOC, fakeStore fixture).
- Canonical categories shipped in one batch: `documentation` (D3
  unauthored), `dependency` (D5 orphan imports), `anti_pattern` (D2
  red files + D5 isolated), `api_surface` (D6 missing endpoints),
  `structural` (D1 canProgress).
- **5 canonical categories from 1 module. Largest single jump in canonical
  coverage achievable from this dir.**
- Effort: ~3 agent-hours including review.

### Win 2 — `unused-export-emitter.js` (Recipe C, persistence-derived)

Skip the dormant background-indexer entirely. Re-implement the canonical
`unused_export` detector from scratch reading `file_registry.exports` +
`connections` — same Recipe C pattern as `persistence-cycle-detector`.

- Touch: `src/features/analysis/unused-export-detector.js` (new, ~80 LOC),
  `unused-export-emitter.js` (new, ~70 LOC), default-subscribers P=38
  subscriber (+ ~20 LOC).
- Tests: ~100 LOC, fakeStore + synthetic file-registry rows.
- Algorithm: for each `file_registry` row, parse `exports` (already a
  JSON column on the card), check whether any `connections` row targets
  the file's fingerprint. If 0 incoming connections AND has exports, emit
  one `unused_export` per export name.
- **De-risks future `background-indexer` revival** — once that lands the
  two can be reconciled or one deprecated.
- Effort: ~2.5 agent-hours.

### Win 3 — `test-coverage-emitter.js` (Recipe C, no upstream deps)

Cheapest concrete canonical-category producer.

- Touch: `src/features/analysis/test-coverage-detector.js` (new, ~60 LOC),
  `test-coverage-emitter.js` (new, ~50 LOC), default-subscribers P=39
  subscriber (+ ~20 LOC).
- Tests: ~80 LOC.
- Algorithm: for each `src/**/*.js` file in `file_registry`, check
  existence of `tests/**/*.test.js` mirror (filesystem stat OR another
  file_registry lookup). If absent → emit `test_coverage` severity
  'medium' with evidence `expected: tests/<mirror>`.
- The 207-test suite + tests/README's mirror convention makes this
  high-accuracy on st8-on-itself.
- Effort: ~2 agent-hours.

**Combined: 3 PRs, ~7.5 agent-hours, +7 canonical categories live
(1 from circular_dependency already + 5 from Win 1 + 1 from Win 2 + 1
from Win 3 = 8 of 13).**

═══════════════════════════════════════════════════════════════════
## 8. Cross-directory dependencies
═══════════════════════════════════════════════════════════════════

| This dir | Depends on |
|---|---|
| `cycle-insight-emitter`, `insight-store-populator` | `src/core/database/graph-persister.js` (`getSharedDatabasePath`) |
| `persistence-cycle-detector` | `src/core/database/persistence.js` (`getAllFiles`, `getAllConnections`) |
| `signal-path-adapter`, `relationship-analyzer`, `path-generator`, `report-generator` | `src/shared/types/integr8-types.js` (enums) |
| `gap-analyzer` | `.st8/schema-cards/*.json` filesystem (NOT persistence directly) |
| `intent-seeder` | `persistence.flagForAIReview`, `upsertIntent`, `getAllFiles` |
| All emitters | `src/core/hooks/default-subscribers.js` (registration point) |

| Consumers of this dir |  |
|---|---|
| `src/core/server/app.js` | `/api/signal-path` → signal-path-adapter, `/api/generate-report` → report-generator, `/api/insights` → insight-store |
| `src/core/hooks/default-subscribers.js` | P=30 gap-analyzer, P=35 populator, P=37 cycle-emitter, P=40 intent-seeder |
| `src/features/integr8/index.js` | dormant CLI — only entrypoint for `analyzeRelationships`, `detectBreakingChanges`, `detectCyclesWithTarjan` standalone |

═══════════════════════════════════════════════════════════════════
## 9. Gaps + open questions
═══════════════════════════════════════════════════════════════════

1. **Severity-enum drift.** Populator emits `'error'/'warning'/'info'`;
   cycle-emitter emits `'high'`. Canonical enum is
   `'info'|'low'|'medium'|'high'|'critical'`. Should Win 1's adapter use
   canonical and trigger a coordinated populator-rewrite? Or leave the
   ad-hoc taxonomy alone and emit only canonical for net-new categories?
   (Founder call — batch 031 explicitly deferred.)

2. **Gap-analyzer / populator overlap.** `under-imported` (populator) and
   `greenLowReachability` (D2) are the **same predicate** computed twice.
   Same for `orphan` (populator) and D2 `redFiles`. Win 1 inevitably
   raises the deprecation question for the ad-hoc populator categories.

3. **`detectBreakingChanges` needs cross-pass card data** — does
   `file_mutation_log` retain enough export-shape history to feed it,
   or does this require a new "exports snapshot per pass" table? Not
   audited.

4. **`path-generator`'s topological sort substring match (line 106)** —
   pre-existing latent risk. Should signal-path-adapter pass node ID
   instead of filepath to bypass it?

5. **`gap-analyzer` reads from `.st8/schema-cards/` filesystem, not
   persistence.** Means it lags by one INDEX_COMPLETE pass (cards are
   written at P=20, gap-analyzer reads at P=30 — actually OK in same
   pass, but worth confirming with executor).

═══════════════════════════════════════════════════════════════════
## "I almost called this dead but corpus said otherwise"
═══════════════════════════════════════════════════════════════════

- **`relationship-analyzer.js:analyzeStructuralSubtyping` + 7 helpers
  (lines 384-610).** Reads like vendored TS scaffolding with no runtime
  callers; tempting to flag dead. **But:** `detectBreakingChanges` (line
  615) DOES call it, AND `detectBreakingChanges` is exported, AND its
  contract (compare two `GraphNode[]` exports across two passes) is
  *exactly* the type_issue/api_surface canonical-category producer
  shape. Not dead — **next-in-line for Recipe C wire-up.**

- **`path-generator.js:performTopologicalAnalysis`** (line 582). Only
  internal-call (from `generateMigrationPath` line 81). Looked
  superfluous; **but** signal-path-adapter (which is the FOUNDER #1 P1
  surface) consumes `result.topologicalAnalysis` directly (line 319).
  Live + load-bearing.

- **`report-generator.js`.** Almost flagged "dormant — only integr8 CLI
  caller" — corrected by grep: live caller in `app.js:1578` at
  `/api/generate-report`. Already wired.

- **`gap-analyzer.js`'s `analyze()` return value.** I was about to
  flag the report-object as "computed and thrown away" because only
  `toMarkdown(report)` is consumed. **But:** the report object IS in
  scope at line 171 in default-subscribers.js — it's just that
  `analyzer.analyze()` is called, the return value ignored, then
  `analyzer.writeReport()` recomputes internally. Not dead — **wasted
  work**, exactly the angle Win 1 captures.
