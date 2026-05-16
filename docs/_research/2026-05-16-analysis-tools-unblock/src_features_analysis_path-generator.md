# Research: `src/features/analysis/path-generator.js`

**Cluster:** identity-and-analysis
**Wave:** analysis-tools-unblock-pass-1
**Date:** 2026-05-16
**Mode:** read-only research; no edits, no commits.

---

## 1. Identity (TS-vendored — provenance + upstream)

- File: `/home/user/st8/src/features/analysis/path-generator.js`, 858 lines, single TS-compiled CommonJS module.
- Provenance trail in the header:
  - Line 2: `// src/commands/integr8/pathGenerator.ts` — original TS source path.
  - Lines 5–37: standard `tsc` boilerplate (`__createBinding`, `__setModuleDefault`, `__importStar`) — diagnostic for compiled output.
  - Line 859: `//# sourceMappingURL=pathGenerator.js.map`.
- Migration record: `scripts/migration/results.stage-originals.json:142-146` and `scripts/migration/move-history.json:120-121` show the file was moved from `lib/commands/integr8/pathGenerator.js` → `src/features/analysis/path-generator.js` in commit `86de1d6` ("refactor(integr8-core): migrate 5 integr8 modules; retarget manifest-gen", 2026-05-14). That is the ONLY commit that touches this file (`git log -- src/features/analysis/path-generator.js` → single SHA).
- Upstream owner: maestro-scaffolder-tool / integr8. Vendor-out recipe applies (per Wave 3A reviewer cross-cluster flag 3 in `docs/_pending-tickets/identity-and-analysis.review.md:78-83`): treat as `linguist-generated=true`, do not hand-edit. Header JSDoc comments survive across vendor passes as long as TS source is edited upstream — the doc-block style throughout (lines 44–46, 59–68, 96–101, 250–253, 427–436, 467–469, 574–581, 627–629, 656–658, 669–672, 729–732, 795–797) is auto-emitted from the original `.ts`.

**Treatment per cluster contract:** vendored module. Behavior changes must happen at the consumer/adapter boundary (signal-path-adapter, app.js route, or a future relationship-adapter), not by editing path-generator.js itself.

---

## 2. Stated intent

From the file header (line 3): "Stage 3: Path Generation and Outcome Evaluation. Generates a migration plan from an analyzed semantic graph and evaluates integration outcome."

From `docs/components/identity-and-analysis.md:255-262` ("path-generator.js (858 lines) — FOUNDER PRIORITY #1"): "Generates a `MigrationStep[]` array via topological sort over the analyzed semantic graph. Outputs the 'signal path' the founder wants visualized — given a yellow file, return the chain of dependencies and the recommended order of operations to reach a target outcome."

From the integr8 origin (`src/features/integr8/index.js:84-89`): stage 3 of the 3-stage pipeline `data-ingestion → relationship-analyzer → path-generator`. Consumes the `analysis.unifiedGraph` + `analysis.conflicts` produced by `analyzeRelationships()`.

---

## 3. Public surface (`generateMigrationPath` + helpers)

Two exports declared at the top (path-generator.js:39-40):

```
exports.generateMigrationPath = generateMigrationPath;
exports.performTopologicalAnalysis = performTopologicalAnalysis;
```

### `generateMigrationPath(graph, conflicts, targetPages, sourcePath, targetPath)`
Defined path-generator.js:69-95. Returns `{ plan, outcome, reasons, topologicalAnalysis }`. Pipeline:
1. `topologicalSortFiles(graph, targetPages)` (line 71, defined 103-249) — Kahn's algorithm with bidirectional BFS expansion (forward+reverse) over `EdgeType.IMPORTS | DEPENDS_ON` edges, deterministic name-sorted tie-breaking, fallback cost-based cycle handling.
2. `generateSteps(graph, conflicts, orderedFiles, sourcePath, targetPath)` (line 73, defined 348-426) — emits `MigrationStep[]` in this order: `copy_file` per ordered file, `rewrite_import` per NEEDS_REWRITE edge group, `merge_route` per ROUTE node, `resolve_conflict` per conflict, final `verify`.
3. `evaluateOutcome(graph.properties, conflicts)` (line 75, defined 438-466) — decision matrix on `{reachability, fragility}` + conflict resolvability. Outputs `SUCCESS / PARTIAL / FAILURE / AMBIGUOUS / REDIRECT`.
4. `generateReasons(graph, conflicts, steps, outcome)` (line 77, defined 471-538) — human-readable strings.
5. `computeComplexity(steps.length)` (line 79, defined 546-552) — `low` (<5), `medium` (5-15), `high` (>15).
6. `performTopologicalAnalysis(graph, orderedFiles)` (line 81, exported, defined 582-626).
7. Plan assembly with `crypto.randomUUID()` id (line 84; UUID fallback at lines 47-57 for envs without `crypto.randomUUID`).

### `performTopologicalAnalysis(graph, orderedNodes)`
Returns `{ orderedNodes, criticalPath, parallelGroups, stepCosts, optimizationSuggestions, totalEstimatedDuration, sequentialDuration, parallelSpeedup }`. Internal helpers (all module-local, not exported):
- `computeStepCosts(orderedNodes, graph)` (line 630) — per-node cost/risk; iterates `graph.edges` per node ⇒ **O(V·E)**.
- `computeCriticalPath(orderedNodes, forwardAdj, stepCosts)` (line 673) — DP over topo order, O(V+E).
- `computeParallelGroups(orderedNodes, forwardAdj, nodeMap)` (line 733) — iterative level assignment up to `orderedNodes.length` iterations × per-node `deps` scan ⇒ **O(V²) worst case**.
- `generateOptimizations(...)` (line 798).

### Module-local helpers (not exported, behaviorally load-bearing)
- `topologicalSortFiles` (line 103) — Kahn + bidirectional BFS over the full edge list; **inner loop iterates ALL `dependencyEdges` per dequeue** (lines 126-134 and 144-152) ⇒ **O(V·E)** in the BFS expansion alone.
- `analyzeCycleBreakPoints(cycledNodes, edges, nodeMap, graph)` (line 255) — Tarjan-flavored break-point cost analysis; iterates `edges` 3× per cycled node (lines 262, 264, 266) ⇒ **O(C·E)** with C = cycle size.
- `generateBreakPointRecommendation`, `generateAlternativeApproaches` (lines 314-338).
- `generateSteps` rewrite-grouping (line 367 onward).
- `computeRewrittenPath` (line 558).
- `estimateLOC` (line 659).

---

## 4. Callers

`grep -rn "path-generator|generateMigrationPath|pathGenerator" src/ tests/ scripts/` produces two live callers + tests:

1. **`src/features/analysis/signal-path-adapter.js:43`** — `const { generateMigrationPath } = require('./path-generator');` Live consumer for self-introspection.
2. **`src/features/integr8/index.js:52,86`** — `pathGenerator_js_1.generateMigrationPath(analysis.unifiedGraph, analysis.conflicts, args.targetPages, args.externalProjectPath, args.currentProjectPath)`. The original 3-stage integr8 orchestrator. **Dead** transitively: `grep -rn 'features/integr8/index|require.*integr8/index'` shows only docs/migration-history references, no live `require()` of `integr8/index.js`. Confirmed by ticket 3's reviewer in `identity-and-analysis.for-review.json:62`.
3. **`src/core/server/app.js:1472-1473`** — JSDoc reference within `_handleSignalPath` (the route forwards to signal-path-adapter, not to path-generator directly). Indirect caller via the adapter.
4. **Tests:** `tests/features/analysis/signal-path-adapter.test.js` — 10-11 probes (counts vary across review notes; current file lists 11 `test(...)` declarations) covering the adapter contract, including the scope/dedup/ordering invariants. No direct test of `generateMigrationPath` — it's exercised through the adapter.

**No `/api/generate-path` route exists.** path-generator is only reached via the adapter through `/api/signal-path` and `/api/generate-report`.

---

## 5. Prior work (ticket 73 / Wave 3B ticket 4 — the 7-min → 25 ms perf delta)

Identity-and-analysis ticket 4 (Wave 3B executor, see `identity-and-analysis.for-review.json:66-83`, verdict ack) is the single landmark.

Key prior-art claims, all reviewer-verified (`identity-and-analysis.review.md:115-203`):

- **Pre-scoping behavior:** "an early version (no scoping) ran for 7+ minutes on 317 nodes because path-generator's surrounding analysis passes (computeStepCosts, computeCriticalPath, computeParallelGroups, performTopologicalAnalysis) are O(V*E) on the full input" (for-review.json:73, residual concerns paragraph).
- **Reviewer mutation probe #2:** "forced `scopedNodes = fullGraph.nodes` and `scopedEdges = fullGraph.edges`. Restarted server. Live probe of `/api/signal-path?filepath=src/core/server/app.js` against the full 305-node graph **hung past 60s timeout (exit 124)** — confirms the executor's '7+ minutes on 317 nodes' claim. Restored." (review.md:130-133).
- **Post-scoping numbers:** GET `/api/signal-path?filepath=src/core/server/app.js` → 6 orderedFiles, scoped reachability 0.833, **22 ms** (review.md:135-141). POST persistence.js → 2-upstream chain. Different files yield different chains and reach values — verified non-stub by reviewer (for-review.json:73, "outcomes vary").
- **The scoping fix:** `signal-path-adapter.js:204-237` — BFS upstream from focal (line 215-223), BFS downstream from focal (line 225-234), induced edges only (line 237). Reduces a typical query input to "a 3-10 node local subgraph" (for-review.json:73, paragraph 1.PERFORMANCE).
- **Bonus side effect of scoping:** `evaluateOutcome` returns PARTIAL instead of FAILURE for healthy files. Without scoping, project-wide reachability 0.16 (dominated by markdown/doc orphans) tripped the `<0.5` FAILURE threshold at path-generator.js:447 (for-review.json:73, paragraph 1; review.md mutation probe #1 confirms).

The scope-fix is **load-bearing** — both reviewer probes (review.md:127-133) demonstrate the engine cannot be invoked unscoped on a real codebase.

---

## 6. Existing tests

No direct test on path-generator.js. Tested transitively via `tests/features/analysis/signal-path-adapter.test.js` (11 declared `test(...)` blocks). The relevant invariants pinned for path-generator:
- `signal-path-adapter.test.js:148-188` — "real topological order: a → b → c upstream chain, focal a placed last." Asserts path-generator's Kahn output via the adapter.
- `signal-path-adapter.test.js:189-...` — "returns the full plan + reasons + topologicalAnalysis from path-generator" — asserts the four-field return shape.
- No-upstream-focal probe (graceful single-element output).
- Scoped-graph-property recomputation probe (mutation-confirmed by Wave 3B reviewer).

The 858-line TS-compiled body has no dedicated unit tests. Per the cluster's prior guidance on TS-vendored files, this is correct — testing should live at the adapter boundary, not the vendored output.

---

## 7. Contracts

### 7.1 SemanticGraph input shape

Defined by `../../shared/types/integr8-types` (referenced path-generator.js:42). Inferred from in-file use:
```
graph = {
  nodes: [{ id, type, name, path?, metadata? }, ...],     // NodeType: FILE, COMPONENT, STORE, ROUTE, ...
  edges: [{ from, to, type, status, confidence? }, ...],  // EdgeType: IMPORTS, DEPENDS_ON, ...
  properties: { reachability: 0..1, stability: 0..1, fragility: 0..1 }
}
```
- `topologicalSortFiles` filters `nodes.type === FILE` (line 105) and `edges.type === IMPORTS|DEPENDS_ON` (line 109).
- `generateSteps` reads `edges.status === NEEDS_REWRITE` (line 365) and `nodes.type === ROUTE` (line 397).
- `evaluateOutcome` reads `properties.reachability` + `properties.fragility` (line 439) plus `conflicts[].type === 'missing_dependency'` and `conflicts[].resolutionOptions[]` (lines 441, 446).

The adapter (`signal-path-adapter.js:62-152`) materializes exactly this shape from `file_registry` rows (one FILE node per deduped row, line 84-96) and `connections` rows (one IMPORTS edge per surviving connection, line 98-111), then computes `properties` from the scoped subgraph (line 245-263).

### 7.2 MigrationPlan output shape

From path-generator.js:83-94:
```
plan = {
  id: uuid,
  timestamp: ISO,
  sourcePath, targetPath,
  outcome: IntegrationOutcome,           // SUCCESS|PARTIAL|FAILURE|AMBIGUOUS|REDIRECT
  estimatedComplexity: 'low'|'medium'|'high',
  conflictCount: number,
  steps: MigrationStep[],                // copy_file | rewrite_import | merge_route | resolve_conflict | verify
  conflicts: Conflict[]
}
return { plan, outcome, reasons: string[], topologicalAnalysis }
```

`topologicalAnalysis` (path-generator.js:616-625): `{ orderedNodes, criticalPath: {path, length, estimatedDuration, bottleneckNode}, parallelGroups: ParallelGroup[], stepCosts: StepCost[], optimizationSuggestions: OptimizationSuggestion[], totalEstimatedDuration, sequentialDuration, parallelSpeedup }`.

### 7.3 Performance scaling (the O(V·E) reality)

Single-pass cost per `generateMigrationPath` call, in approximate descending dominance:

| Helper | Complexity | Source |
|---|---|---|
| `topologicalSortFiles` bidirectional BFS | **O(V·E)** — `for (const edge of dependencyEdges)` inside each BFS dequeue | path-generator.js:126-134, 144-152 |
| `analyzeCycleBreakPoints` | O(C·E) where C = cycle size | path-generator.js:262-266 |
| `computeStepCosts` | O(V·E) — `graph.edges.filter(...)` per node | path-generator.js:644 |
| `computeCriticalPath` | O(V+E) — single DP pass over topo order | path-generator.js:684-695 |
| `computeParallelGroups` | **O(V²)** worst case — `while (changed && iterations < orderedNodes.length)` × per-node neighbor scan | path-generator.js:749-763 |
| `generateOptimizations` | O(V) | path-generator.js:801-823 |

On a 305-node graph with ~308 edges, the integral O(V·E) cost is ~94 K per pass × multiple passes = ~minutes wall clock on Node V8 (reviewer mutation probe hung past 60 s; pre-scope claim was 7+ min). On a 3-10 node scoped subgraph, each pass is in single-digit-K operations, completing in 5-25 ms.

### 7.4 Why scoping is mandatory before invocation

The engine has no internal escape hatch. Its assumptions, in order:
1. `topologicalSortFiles` BFS already does internal expansion (path-generator.js:115-153), but it expands over **the input graph** — it does not skip over nodes that are irrelevant to the target.
2. `computeStepCosts` (line 630) iterates `graph.edges` per node with no early-exit predicate.
3. `computeParallelGroups` (line 733) is bounded by `orderedNodes.length` iterations and gets quadratic on cyclic-heavy graphs.
4. `evaluateOutcome` (line 438) uses **whole-graph** reachability/fragility, so unscoped invocation also produces misleading FAILURE outcomes for healthy local files in sprawling repos.

Therefore: the **only safe invocation pattern** is "scope first, then invoke" — implemented by signal-path-adapter at `signal-path-adapter.js:195-237` and 245-263. Any future caller (relationship-adapter, /api/generate-report, /api/analyze-relationships) MUST replicate this contract.

---

## 8. Change vector — T1 (relationship-adapter) and T6 (/api/generate-report)

### 8.1 T1 — wire `relationship-analyzer.js` end-to-end

**Does relationship-adapter need to feed this?** *Potentially yes, but not for the current self-introspection flow.* The hard facts:

- In the integr8 3-stage pipeline (`src/features/integr8/index.js:69-89`), Stage 2 (`analyzeRelationships`) outputs `{unifiedGraph, conflicts}` which is then fed verbatim to Stage 3 (`generateMigrationPath(analysis.unifiedGraph, analysis.conflicts, ...)`). path-generator's `conflicts` argument exists ONLY because relationship-analyzer produces it.
- The Wave 3B self-introspection wire-up bypasses Stage 2 by handing `generateMigrationPath` an empty `conflicts: []` (signal-path-adapter.js:272). The path-generator return is well-defined for `conflicts === []`:
  - `evaluateOutcome` skips the missing-dependency/unresolvable branches (path-generator.js:441-453) and goes straight to SUCCESS or PARTIAL by reachability (path-generator.js:456-462).
  - `generateSteps` skips the `resolve_conflict` branch (path-generator.js:410-418) and the `rewrite_import` branch when no `NEEDS_REWRITE` edges exist (path-generator.js:365-395).
  - `generateReasons` emits "No conflicts detected" (path-generator.js:495).
- So **adding a relationship-adapter that populates non-empty `conflicts` will not break the contract** — it will instead activate currently-dormant code paths in `generateSteps` and `evaluateOutcome`. The shape that path-generator expects is documented in `src/features/integr8/index.js:80` and aligns with `relationship-analyzer.js`'s exported `analyzeRelationships()` return shape: `{ unifiedGraph: SemanticGraph, conflicts: Conflict[] }`.
- **Required shape if a relationship-adapter is built:**
  - `unifiedGraph` — same SemanticGraph contract as section 7.1, but with `edges[].status` carrying the SAFE/NEEDS_REWRITE/CONFLICT/MISSING classification (currently all SAFE in the adapter, signal-path-adapter.js:108).
  - `conflicts[]` — each `{ id, type, description, resolutionOptions: [], recommended, ... }`. path-generator inspects `type === 'missing_dependency'`, `resolutionOptions.length`, and `recommended === CUSTOM` (lines 441, 446, 451).
- **Performance caveat:** the same O(V·E) scope-or-die contract applies. A relationship-adapter that calls `generateMigrationPath` on `analyzeRelationships`' full unifiedGraph will hit the same 7-minute hang. The adapter must scope to a focal file BEFORE handing the graph to path-generator, OR be invoked only on a pre-scoped per-file basis. The cluster roadmap P2.1 (`docs/_pending-roadmap/identity-and-analysis.md:49-54`) suggests an INDEX_COMPLETE P=25 subscriber + `POST /api/analyze-relationships`; this surface MUST decide its scope before invoking path-generator (likely: run analyzeRelationships once, then scope per-file when path-generator runs).
- **Cross-project shape gap:** relationship-analyzer requires `{ externalGraph, currentGraph, targetPages }` (review.md:170-171, for-review.json:59 deferral notes). Until cross-project ingest exists, the relationship-adapter has no data source to feed it. Wiring against `(currentGraph, currentGraph)` would emit all-SAFE conflicts and is identified by the ticket-3 deferral as a "cheat disguised as a wire-up" (for-review.json:59). The current self-introspection adapter is the only honest configuration today.

**Verdict for T1's path-generator surface:** **no breaking change** to path-generator itself. A future relationship-adapter must (a) match the `{unifiedGraph, conflicts}` shape, (b) scope to a focal file before invoking generateMigrationPath, (c) keep status classification populated on edges so `generateSteps` can emit rewrite/conflict steps. The existing self-introspection adapter at signal-path-adapter.js continues to work in parallel; both can coexist.

### 8.2 T6 — `/api/generate-report` wedge >30 s

**Cause analysis from the current code, not speculation:**

The `/api/generate-report` handler at `src/core/server/app.js:1555-1635` does the following per request:
1. Opens a fresh `St8Persistence` (line 1580, ~30 ms — for-review.json:80 residual concern 3).
2. Calls `computeSignalPath({persistence, targetFilepath, ...})` (line 1583) — this is the SAME engine path as `/api/signal-path`.
3. Feeds the result into `generateMigrationReport()` (line 1609) — string-renders markdown, no further graph traversal.

`computeSignalPath` (`signal-path-adapter.js:167-333`) does:
- `buildSemanticGraphFromPersistence` over **the full file_registry + connections** (line 187, ~all 305 files + 308 connections in st8's own DB).
- The dedup loop (line 75-81) is O(F).
- The incoming/outgoing tally for whole-graph properties (line 123-145) is O(V+E) — small.
- BFS upstream + downstream from focal (line 212-234) — uses the full edge list, **inner loop iterates `fullGraph.edges` per dequeue**: O(scope · E).
- Then path-generator on the scoped graph: 5-25 ms.

**If `/api/generate-report` wedges >30 s, the most likely cause is NOT the scoped path-generator pass** (that's bounded at ~25 ms per the live probe at review.md:148). Candidates, ranked:
1. **The full-graph build** at signal-path-adapter.js:187 — `buildSemanticGraphFromPersistence` over a much-larger-than-305-node target. If a user runs against a 5000-file repo, the dedup + edge construction + property tally is still O(F+E), but the BFS scope-out loops at line 215-234 are O(scope · E_full). If the focal file's connected component is large (e.g. asking for the signal path of a hub file like `app.js` in a sprawling repo), the BFS itself can be slow.
2. **Per-request persistence open cost** + an unindexed connections table on a large DB. The for-review.json residual concern 3 flags ~30 ms today; on a much larger DB this can climb.
3. **Identity-ticket-73 unscoped scenario re-emerging**: if a future caller adds a non-self-introspection path that bypasses the BFS scoping (e.g. someone wires path-generator directly to the full graph, replicating the integr8/index.js pattern), the 7-minute hang re-emerges. Reviewer mutation probe #2 (review.md:127-133) proved this is reproducible.

**Call site to inspect for the wedge:** `src/core/server/app.js:1583` is the only `/api/generate-report` invocation point. It goes through the same scoping primitive as `/api/signal-path` (which is fast per probe). So if the wedge is observed on generate-report but NOT signal-path on the same focal file, the cause is in the report-generator stage (`generateMigrationReport`, post path-generator). Read `src/features/analysis/report-generator.js` for the markdown string assembly — but per ticket 5 review (review.md:148-153, for-review.json:91), live probes have shown 80-line reports in normal latency on the indexer.js focal file. No O(V*E) cost is documented inside report-generator.

If the wedge is observed on both signal-path AND generate-report for a specific focal file, the cause is the focal file's scoped subgraph being unexpectedly large — that is the signal-path-adapter BFS, not path-generator. In that case the fix lives in the adapter (e.g. cap BFS depth or breadth), not in path-generator.

---

## 9. Provisions already made

- **Scope-aware design baked in at the adapter boundary** — signal-path-adapter.js:195-237 (upstream BFS), 225-234 (downstream BFS), 237 (induced edges only).
- **Scoped graph properties recomputed** — signal-path-adapter.js:245-263 — so `evaluateOutcome` reflects local subgraph health, not project-wide noise.
- **Multi-fingerprint dedup** — signal-path-adapter.js:74-81 — newest birthTimestamp wins, matching Wave 3A ticket 9's schema-card emitter contract.
- **Dangling-edge filter** — signal-path-adapter.js:101-102 — edges whose endpoints didn't survive dedup are dropped.
- **Deterministic ordering at the engine** — path-generator.js:178-182 (zero-degree node sort by name), 194-205 (insertion-sorted ready queue). Idempotent re-runs produce stable plans.
- **UUID fallback** — path-generator.js:47-57 — works on Node versions without `crypto.randomUUID`.
- **Cycle handling** — path-generator.js:209-247 — Tarjan-like break-point analysis with `console.warn` recommendations. Doesn't throw on cycles; appends cycled nodes in cost-sorted order.
- **Graceful empty-edge focal** — signal-path-adapter.js:188-193 (empty registry → ok:false) and the no-upstream test case (focal file alone returns `[focal, verify]` plan, outcome FAILURE, gracefully). Verified by reviewer with `README.md` probe (review.md:142).

---

## 10. Gaps + open questions

1. **`conflicts: []` is the only tested mode.** The adapter always passes empty conflicts (signal-path-adapter.js:272). The `rewrite_import`/`resolve_conflict`/`AMBIGUOUS`/`REDIRECT` code paths in path-generator are exercised only by the dead integr8/index.js. If T1's relationship-adapter populates non-empty conflicts, those branches will activate for the first time on real data — they have no regression tests at the engine level.

2. **`NodeType.ROUTE` / `merge_route` is also untested in the wired flow.** The adapter never emits ROUTE nodes (signal-path-adapter.js:84-96, all FILE). `generateSteps` route-merge branch (path-generator.js:397-408) is dormant in the live path. A relationship-adapter for cross-project work would activate it.

3. **`performTopologicalAnalysis` per-request cost on the scoped subgraph.** Even on 3-10 nodes, `computeParallelGroups` runs its `while (changed && iterations < N)` loop. For a 10-node scoped graph this is a no-op (<1 ms), but the scaling isn't documented anywhere. If a frontend Wave 7 dive-in panel polls signal-path for every file in a large project, the aggregate cost may matter — flagged but not measured.

4. **Cycle warnings go to stdout, not the response.** path-generator.js:241-245 emits `console.warn`. Frontend can't surface cycle break-point recommendations without a code change. Wave 3B residual concern #4 (for-review.json:80) calls this out. No `pathSummary.cycles[]` field exists today.

5. **`generateMigrationReport` framing.** Headlines say "Migration Report: integr8 Analysis" not "Signal Path Report" (for-review.json:91, residual paragraph). Cosmetic but visible in any LLM brief.

6. **Single SHA git history.** `git log --oneline -- src/features/analysis/path-generator.js` returns only commit `86de1d6`. Any future TS revendor will wipe local diagnostics if hand-edited — must edit upstream.

7. **No relationship-adapter exists today.** T1's brief implies one needs to be built; the *shape* it would need to feed into path-generator is documented (section 8.1) but no scaffolding is in place. The currently-deferred ticket 3 (relationship-analyzer) in `identity-and-analysis.for-review.json:53-64` blocks this — see for-review.json:59 "Why not wire."

8. **`/api/generate-report` wedge >30 s** — not directly reproducible from the call graph as currently coded. The expected fast path is `~30 ms persistence + ~25 ms signal-path + ~few ms markdown render`. A wedge implies either (a) a focal file with a pathological scoped-subgraph blowup in signal-path-adapter BFS, (b) a much larger target than st8 itself, or (c) a future caller bypassing the adapter and invoking generateMigrationPath on the full graph (re-creating the 7-minute hang). The research did not have a wedge-reproducible test case to dissect.

9. **Per-request St8Persistence open** (~30 ms each on `/api/signal-path` AND `/api/generate-report` — for-review.json:80 concern 3). On the meta-dogfood path that hits both routes in sequence, this is 60 ms of pure overhead before any computation. Cross-cluster persistence-and-database P3 work.

10. **`computeRewrittenPath`** at path-generator.js:558-573 assumes Unix-style normalization. For Windows path inputs to a future cross-project flow, the `replace(/\\/g, '/')` is present but not exhaustively tested. Vendored — out of scope for hand-edit.
