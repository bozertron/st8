# Research: `src/features/analysis/report-generator.js`

Ticket: T6 — `/api/generate-report` payload audit
Cluster: identity-and-analysis
Wave: analysis-tools-unblock-pass-1
Date: 2026-05-16

---

## 1. Identity (TS-compiled provenance)

- Path: `/home/user/st8/src/features/analysis/report-generator.js` (283 LOC; `wc -l` reports 283).
- File-header comment: `// src/commands/integr8/reportGenerator.ts` (line 2). This is a TypeScript-compiled artifact; tail line `//# sourceMappingURL=reportGenerator.js.map` (line 284) confirms.
- CJS shape: `"use strict";` + `Object.defineProperty(exports, "__esModule", { value: true });` (lines 1, 4). Imports compiled output of `../../shared/types/integr8-types.js` (line 6).
- Migration provenance: `scripts/migration/move-history.json:124-125` moves `lib/commands/integr8/reportGenerator.js` → `src/features/analysis/report-generator.js` in batch `integr8-core` (commit `86de1d6`).
- Treat as vendored: per cluster review (`docs/_pending-tickets/identity-and-analysis.review.md:210-214`) and per CLAUDE.md cluster doctrine (Wave 3A vendor-hygiene flag, residualConcerns #2 in `identity-and-analysis.for-review.json:96`). **Do not hand-edit; wrap.**

## 2. Stated intent

Top-of-file docstring (lines 7-10):
> Generates a professional Markdown report from the integr8 analysis output. Includes executive summary, graph analysis, conflicts, steps, risk assessment, and next steps.

So: a deterministic pure-function pretty-printer that turns an Integr8Output object into Markdown. Per `docs/components/identity-and-analysis.md:263-269` it is "the push-to-ticket / LLM output stage" downstream of `path-generator`.

## 3. Public surface (generateMigrationReport signature)

Single export at line 5: `exports.generateMigrationReport = generateMigrationReport;`.

Signature: `generateMigrationReport(output) -> string` (line 11).

Destructures `{ migrationPlan, semanticGraph, outcome, reasons }` from `output` (line 12). All four fields are required (no defensive defaults). Returns the joined markdown via `lines.join('\n')` (line 149).

Helpers (all module-internal, no exports): `formatOutcomeBadge`, `formatPercent`, `formatConflictType`, `formatResolution`, `formatAction`, `getActionIcon`, `interpretReachability`, `interpretStability`, `interpretFragility`, `computeRiskLevel`, `generateNextSteps`.

## 4. Callers

`grep -rn "report-generator\|generateMigrationReport\|reportGenerator" src/ tests/ scripts/` yields two **live** call sites:

1. `src/core/server/app.js:1578` — the `_handleGenerateReport` HTTP handler (POST `/api/generate-report`). Routed from the dispatcher at `src/core/server/app.js:476`.
2. `src/features/integr8/index.js:54,99` — the vendored integr8 orchestrator (`output.migrationReport = generateMigrationReport(output)`). Per `docs/components/identity-and-analysis.md` and the cluster review, `features/integr8/index.js` itself has **zero live consumers** (only migration history / docs reference it). So path #2 is dormant.

Route manifest: `src/core/server/route-manifest.js:162` registers `{ method: 'POST', path: '/api/generate-report', handler: '_handleGenerateReport' }`.

## 5. Prior work

- Wave 3B ticket 5 wired `/api/generate-report` (commit `2be309f` — "feat(identity): wire path-generator + report-generator via /api/signal-path and /api/generate-report (tickets 4, 5)").
- The executor's `actionsTaken` in `identity-and-analysis.for-review.json:91` explicitly documents the chosen design: `computeSignalPath` provides the synth Integr8Output; `semanticGraph.{nodes,edges}` are passed as `[]` because report-generator only reads `properties` from that field; live-probed with `Accept: text/markdown` and JSON; ~30ms latency observed.
- The cluster reviewer (`identity-and-analysis.review.md:148-153`) reproduced the live probe at 80-line markdown output for `indexer.js` (Reachability 75%, Stability 98.4%, 5 migration steps, real plan UUID).
- `docs/_pending-roadmap/identity-and-analysis.md:55-59` — original P2.2 design proposed `POST /api/generate-report { planId }` (plan-store cache). The shipped surface is `{ filepath }` instead; residualConcerns #3 captures the deferred plan-store option.

## 6. Existing tests

- `tests/features/analysis/signal-path-adapter.test.js` — exists (per `ls tests/features/analysis/`). Covers `computeSignalPath`, which is the input pipe.
- **No dedicated test for `/api/generate-report` or for `generateMigrationReport` directly.** The executor justified this on the grounds that the wrapper is a ~40-LOC pass-through (`identity-and-analysis.for-review.json:91`, last paragraph).
- `tests/core/server/` has no `api-generate-report*.test.js`.

## 7. Contracts (input shape)

`generateMigrationReport(output)` reads exactly these fields:

| Source field | Used at | Notes |
|---|---|---|
| `output.migrationPlan.timestamp` | line 17 | string (ISO) |
| `output.migrationPlan.id` | line 18 | UUID |
| `output.migrationPlan.estimatedComplexity` | line 26 | string enum |
| `output.migrationPlan.steps[]` | lines 27, 86-113 | per-step `action/description/from/to/file/rules/conflictId/resolution/command` |
| `output.migrationPlan.conflictCount` | lines 28, 126 | number |
| `output.migrationPlan.conflicts[]` | lines 56-81 | conflict-detail rows |
| `output.migrationPlan.sourcePath` / `.targetPath` | lines 37-38 | strings |
| `output.semanticGraph.nodes.length` | line 29 | only counts; **does not iterate** |
| `output.semanticGraph.edges.length` | line 30 | only counts; **does not iterate** |
| `output.semanticGraph.properties.{reachability,stability,fragility,integrationDistance?}` | lines 43-51, 123-125 | the only `semanticGraph` field substantively read |
| `output.outcome` | lines 25, 131, 140 | enum |
| `output.reasons[]` | lines 133-135 | string[] |

**Critical finding**: `report-generator.js` itself **does no graph traversal**. It treats `semanticGraph` as `(nodes.length, edges.length, properties)`. The endpoint's executor already exploits this (passes `nodes: []`, `edges: []` — `app.js:1602-1603`). Report-generator therefore **cannot** be the source of the wedge.

## 8. Change vector for T6 — TRACE THE HANDLER

### Trace

```
POST /api/generate-report
  └─ app.js:476           dispatcher case
     └─ app.js:1555       _handleGenerateReport
        ├─ parseRequestBody (4KB cap)            app.js:1562
        ├─ require signal-path-adapter           app.js:1577
        ├─ require report-generator              app.js:1578
        ├─ new St8Persistence + initialize       app.js:1580-1581  (NOT shared)
        ├─ computeSignalPath({persistence, targetFilepath, targetDir})
        │     signal-path-adapter.js:167
        │     ├─ buildSemanticGraphFromPersistence (full graph)         line 187
        │     ├─ BFS upstream over fullGraph.edges                      lines 213-223
        │     ├─ BFS downstream over fullGraph.edges                    lines 224-234
        │     ├─ scope filter                                           lines 236-237
        │     └─ generateMigrationPath(graph={scopedNodes, scopedEdges}, [], [targetFilepath], …)
        │           path-generator.js:69
        │           ├─ topologicalSortFiles                             line 71
        │           ├─ generateSteps                                    line 73
        │           ├─ evaluateOutcome                                  line 75
        │           ├─ generateReasons                                  line 77
        │           └─ performTopologicalAnalysis                       line 81
        │                 ├─ computeStepCosts        path-generator.js:630 — O(V·E)
        │                 ├─ computeCriticalPath     path-generator.js:673 — O(V+E)
        │                 ├─ computeParallelGroups   path-generator.js:733 — O(V²) worst-case
        │                 └─ generateOptimizations
        └─ generateMigrationReport(synthesized Integr8Output)  app.js:1609
```

### Is input scoped?

**Yes — already scoped.** `signal-path-adapter.js:212-237` runs upstream + downstream BFS from the focal fingerprint and filters `fullGraph.nodes`/`fullGraph.edges` down to the connected component before invoking `generateMigrationPath`. The same scoping path that powers `/api/signal-path`. The handler in `app.js:1583-1587` calls `computeSignalPath` directly — there is no full-graph fallback path through this handler.

### Where is the wedge?

The wedge cannot be in `report-generator.js` (it does no traversal). Three real candidates upstream of report-generator:

**A. `buildSemanticGraphFromPersistence` constructs the FULL graph first.** Even though the focal component is later scoped, the BFS at lines 213-234 iterates `fullGraph.edges` inside a `while (q.length)` loop — **O(V*E)** for the BFS-frontier traversal because there is no adjacency map. On 345 files with hundreds of edges this is the prime suspect. The comment at `signal-path-adapter.js:196-203` calls out the path-generator passes as the wedge cause, but the BFS *inside the adapter itself* is also unindexed.

**B. `path-generator.computeParallelGroups` (path-generator.js:733-779).** Iterates orderedNodes inside `while (changed && iterations < orderedNodes.length)` — quadratic on the scoped subgraph. If the scoped subgraph for a hub file (e.g. `app.js`) is most of the project, the scope buys little and we get the same wedge anyway.

**C. `computeStepCosts` (path-generator.js:630-655)** filters `graph.edges` per node — `O(V·E)` on the scoped graph.

Meta-dogfood (`meta-dogfood.md:69-71`) describes the wedge on `/api/generate-report` POST `{}` with **no filepath**. The handler 400s on missing filepath (`app.js:1572-1576`), so an empty-body POST should fail fast. But the dogfood probe used `{"format":"markdown"}` (no filepath), which would also 400. The wedge therefore implies either (a) the probe used a real filepath (and the dogfood writeup is loose), or (b) a previous version of the handler defaulted differently. The cluster reviewer's later live probe DID succeed at ~30ms, suggesting the wedge is **filepath-dependent** — high-fan-in / high-fan-out focal files yield near-full-graph scopes where the upstream cost reasserts.

### Proposed minimal change (NEW wrapper, not a hand-edit of report-generator)

`report-generator.js` is innocent — leave it alone. The minimal T6 fix lives in **`signal-path-adapter.js`** (already wave-3B code, not vendored) plus the handler. Two surgical edits:

1. **Index the edges once** in `signal-path-adapter.buildSemanticGraphFromPersistence` (build `outAdj` + `inAdj` Maps) and pass the adjacency maps out alongside `fullGraph`. The two BFS loops in `computeSignalPath` (lines 213-234) then do `adj.get(cur)` instead of scanning `fullGraph.edges` — turns O(V*E) into O(V+E).
2. **Hard-cap the scoped subgraph size** before invoking `generateMigrationPath`. If `scopedNodes.length > MAX_SCOPED_NODES` (e.g. 100) or `scopedEdges.length > MAX_SCOPED_EDGES`, return `{ ok: false, error: 'scope too large; refine target', scopedNodes.length, scopedEdges.length }` so the handler returns 413 quickly instead of grinding the event loop. This is the "circuit breaker" pattern.

A third optional measure: split `_handleGenerateReport` so the heavy phase (computeSignalPath + report assembly) happens in a worker thread or via `setImmediate` chunking — but that's bigger surgery and out of T6's "minimal change" framing.

### Predicted wedge location

90% in **`signal-path-adapter.js`** (the unindexed BFS at lines 213-234 + the eager full-graph build at line 187) and `path-generator.performTopologicalAnalysis` on scoped subgraphs that happen to be near-full-graph for hub files. **0%** in `report-generator.js` itself — its hot loops (`migrationPlan.conflicts`, `migrationPlan.steps`, `reasons`) iterate small bounded arrays.

## 9. Provisions already made

- **Adapter exists**: `signal-path-adapter.computeSignalPath` (`src/features/analysis/signal-path-adapter.js:167`). The handler uses it (`app.js:1583`).
- **Subgraph scoping in adapter**: lines 212-237 — comment at lines 195-203 explicitly documents the perf rationale ("turns a sub-second sort into multi-minute analysis ... pre-scope to the focal file's connected component").
- **Re-derived scoped graph properties** (lines 245-263) — avoids inheriting project-wide reachability which would skew outcome to FAILURE.
- **No timeout / no event-loop budget** on the handler. `app.js:1555-1635` has try/catch + finally `persistence.close()`, but no `setTimeout` watchdog and no abort signaling.
- **No request-scoped persistence pool**: handler does `new St8Persistence()` + `initialize()` + `close()` per request (`app.js:1580-1622`). Cross-cluster concern flagged in `identity-and-analysis.review.md:215-219`.
- **No plan-store cache**: the original P2.2 design's `{ planId }` addressing was not shipped (`for-review.json:96` residualConcerns #3).

## 10. Gaps + open questions

1. **Discrepancy between meta-dogfood "wedge >30s" and reviewer's "30ms live probe"**: both probes are real-data. Which focal file caused the wedge? Was the probe on `src/core/server/app.js` (highest fan-in, 2264 LOC)? If so, the scope likely degenerates to ~most of the project and the adapter's BFS is the hot loop. Need: repro instructions naming the exact focal filepath that wedges.
2. **Path-generator's worst-case complexity on near-full-graph scopes**: `computeParallelGroups` iterates `O(V²)` for cyclic graphs. The adapter's `fragility` computation is a cheap approximation — does the scoped subgraph contain cycles? If yes, parallel-groups + critical-path become unbounded-ish.
3. **Should `report-generator.js` even be exposed via HTTP?** Its native vocabulary is "Migration Report: integr8 Analysis" / "Source (External) / Target (Current)" — tautological for self-introspection. Reviewer flagged in `identity-and-analysis.review.md:210-214`. Possible alternative: write a new st8-native `signal-path-report-generator.js` (small, pure) that consumes `sp.plan + sp.pathSummary` directly, and retire the integr8 wrapper. Out of T6 scope but worth a follow-up ticket.
4. **No timeout / no abort path**: even with adjacency-indexed BFS, a pathological project could still wedge. Should the handler enforce a wall-clock budget (e.g. `AbortController` + 5s deadline) and 503 on overrun?
5. **`semanticGraph.{nodes,edges}` deliberately elided** to `[]` (`app.js:1602-1603`). Is the "Files in Graph: 0 nodes / Relationships: 0 edges" line in the rendered report (report-generator.js:29-30) a known UX wart? Reviewer's live probe shows real counts (75% reachability etc.) but the node/edge counts in the report would render as `0`. Worth verifying.
6. **No test for `_handleGenerateReport`**: signal-path-adapter has coverage; the 40-LOC HTTP wrapper does not. A `tests/core/server/api-generate-report.test.js` modeled on `api-identity-risk.test.js` would lock in the contract.

---

## File:line reference index

- `src/features/analysis/report-generator.js:1-284` — file under study (whole-file read)
- `src/features/analysis/report-generator.js:5,11` — export + signature
- `src/features/analysis/report-generator.js:12` — destructure of input shape
- `src/features/analysis/report-generator.js:29-30` — only place `semanticGraph.nodes/edges` are read (length only)
- `src/features/analysis/report-generator.js:43-51,123-125` — `semanticGraph.properties` reads
- `src/core/server/app.js:476` — dispatcher case `/api/generate-report`
- `src/core/server/app.js:1544-1635` — `_handleGenerateReport` full body
- `src/core/server/app.js:1577` — `require('../../features/analysis/signal-path-adapter')`
- `src/core/server/app.js:1583-1587` — `computeSignalPath` call (scoping is here)
- `src/core/server/app.js:1598-1608` — synthesized Integr8Output envelope
- `src/core/server/app.js:1602-1603` — `nodes: []`, `edges: []` (deliberate)
- `src/core/server/route-manifest.js:162` — route registration
- `src/features/analysis/signal-path-adapter.js:62-152` — `buildSemanticGraphFromPersistence`
- `src/features/analysis/signal-path-adapter.js:167-333` — `computeSignalPath`
- `src/features/analysis/signal-path-adapter.js:195-203` — perf-scoping rationale comment
- `src/features/analysis/signal-path-adapter.js:212-237` — unindexed BFS (likely wedge)
- `src/features/analysis/path-generator.js:69-95` — `generateMigrationPath` orchestration
- `src/features/analysis/path-generator.js:582-626` — `performTopologicalAnalysis`
- `src/features/analysis/path-generator.js:630-655` — `computeStepCosts`
- `src/features/analysis/path-generator.js:733-810` — `computeParallelGroups`
- `src/features/integr8/index.js:54,99` — second (dormant) caller of `generateMigrationReport`
- `docs/_pending-tickets/identity-and-analysis.review.md:148-153,210-219` — Wave 3B reviewer's live-probe results + cross-cluster flags
- `docs/_pending-tickets/identity-and-analysis.for-review.json:85-98` — Wave 3B ticket 5 actionsTaken / residualConcerns
- `docs/_pending-tickets/meta-dogfood.md:68-71,167` — wedge observation
- `docs/_pending-roadmap/identity-and-analysis.md:55-59` — P2.2 (originating roadmap entry)
