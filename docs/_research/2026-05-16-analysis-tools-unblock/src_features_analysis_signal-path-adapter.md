# Research — `src/features/analysis/signal-path-adapter.js`

Cluster: `identity-and-analysis` · Wave: analysis-tools-unblock-pass-1
Tickets in scope: **T1** (wire `relationship-analyzer.js`) and **T6** (`/api/generate-report` payload audit).

---

## 1. Identity

- Path: `/home/user/st8/src/features/analysis/signal-path-adapter.js`
- Size: 339 LOC.
- Single git commit: `2be309f feat(identity): wire path-generator + report-generator via /api/signal-path and /api/generate-report (tickets 4, 5)` — created in Wave 3B; never touched since.
- Companion test: `/home/user/st8/tests/features/analysis/signal-path-adapter.test.js` (199 LOC, 10 probes — all passing within the 207/207 suite).
- The file is the **FOUNDER PRIORITY #1** wire-up (roadmap P1.1, batch 025).

## 2. Stated intent

The file's own JSDoc (lines 3-40) says it bridges st8's live persistence (`file_registry` + `connections`) to `path-generator.generateMigrationPath()`. Reasons enumerated in-file:

- `path-generator` was authored for integr8's external→current migration pipeline and consumes a `SemanticGraph` produced by the six integr8 parsers (overview/store/route/command/type/ui). That pipeline is heavy and oriented around migrating-an-app-into-another-app.
- For self-introspection ("what is this file's signal path within my own project?") the migration framing is unnecessary. st8 already has the dependency graph in SQLite.
- The adapter materializes a `SemanticGraph` from those two tables and hands it to `generateMigrationPath()` with the focal file as the lone `targetPages` entry. `sourcePath === targetPath` makes the migration-step framing a no-op tail; `pathSummary.orderedFiles` is the consumer-friendly surface.

Two exports (line 36 docstring, lines 335-338 module.exports):

- `buildSemanticGraphFromPersistence(persistence) → SemanticGraph`
- `computeSignalPath({persistence, targetFilepath, targetDir}) → { ok, plan, outcome, reasons, topologicalAnalysis, pathSummary }`

## 3. Public surface

`buildSemanticGraphFromPersistence(persistence)` (lines 62-152):

- Requires `persistence.getAllFiles` (`TypeError` at line 64 otherwise).
- Calls `persistence.getAllFiles()` and `persistence.getAllConnections()`.
- Returns `{ nodes, edges, properties: { reachability, stability, fragility } }`.
- Node ids are `file_${fingerprint}` (stable across runs — line 85).
- Edge ids are sequential `edge_N` (line 104).
- Properties are computed over the **full** graph here; `computeSignalPath` recomputes `reachability` over the scoped subgraph (lines 245-253).

`computeSignalPath({ persistence, targetFilepath, targetDir })` (lines 167-333):

- Argument validation at lines 168-173 (returns `{ ok: false, error }` rather than throwing).
- File resolution via `persistence.getFileByPath(targetFilepath)` (line 178). Returns `ok:false` on miss.
- Empty-registry guard at lines 188-193.
- Returns shape (lines 314-332):
  `{ ok, plan, outcome, reasons, topologicalAnalysis, pathSummary: { focal, focalFingerprint, orderedFiles, upstreamCount, downstreamCount, totalNodes, totalEdges, totalProjectNodes, totalProjectEdges, graphProperties } }`.

## 4. Callers

`grep -rn 'signal-path-adapter\|computeSignalPath\|buildSemanticGraphFromPersistence' src/ tests/ scripts/` returns these live callers:

- `src/core/server/app.js:1492` — inside `_handleSignalPath` (lines 1483-1542). Dispatched via the `/api/signal-path` case at line 473.
- `src/core/server/app.js:1577` — inside `_handleGenerateReport` (lines 1555-1635). Dispatched via the `/api/generate-report` case at line 476.
- `tests/features/analysis/signal-path-adapter.test.js:17-19` — the test imports.
- `scripts/migration/results.gap-analysis.md` — documentation references only.

**No INDEX_COMPLETE subscriber.** The adapter is request-scoped: `_handleSignalPath` constructs a fresh `St8Persistence` per request (lines 1493-1494) and closes it in `finally` (line 1508). `_handleGenerateReport` does the same (lines 1579-1580, 1622).

## 5. Prior work

From `docs/_pending-tickets/identity-and-analysis.for-review.json` ticket 4 (`actionsTaken`, lines 73-78 of that JSON):

- The adapter was chosen over running the full integr8 data-ingestion pipeline because (a) the six TS-vendored parsers look for Vue/Pinia/Tauri patterns absent from st8; (b) st8 already has a high-fidelity dependency graph in SQLite via the indexer's Pass-2; (c) self-introspection is the founder's stated daily-driver use case.
- An early version (no scoping) ran for **7+ minutes on 317 nodes** because path-generator's surrounding analysis passes (`computeStepCosts`, `computeCriticalPath`, `computeParallelGroups`, `performTopologicalAnalysis`) are O(V*E) on the full input.
- Scoping reduces a typical query to **5-25ms** by handing path-generator a 3-10-node local subgraph.

From `docs/_pending-tickets/identity-and-analysis.review.md` Wave 3B mutation probes (reviewer):

- Mutation probe #1 replaced `scopedReachability` with `fullGraph.properties.reachability` → scoping test failed (expected 0.6<reach<0.7, got 0.5). Restored.
- Mutation probe #2 forced `scopedNodes = fullGraph.nodes` and re-ran live → request **hung past 60s timeout (exit 124)**. Confirms scoping is load-bearing, not test-shrinking.
- Live `/api/signal-path?filepath=src/core/server/app.js` against the real 305-node graph returned `ok=true`, `outcome=PARTIAL`, 6 ordered files, scoped reachability 0.833, latency 22ms.

## 6. Existing tests

`tests/features/analysis/signal-path-adapter.test.js` (199 LOC, 10 probes):

- L79 — `buildSemanticGraphFromPersistence` shape (nodes, edges, properties; project reachability = 0.5 = 2/4).
- L90 — dedup by newest birthTimestamp — older `fp_a_OLD` is dropped, newer `fp_a` wins.
- L111 — dangling edges dropped when an endpoint is missing from the deduped graph (b→c dropped when c absent).
- L121 — `computeSignalPath` returns `ok:false` on missing `targetFilepath` arg.
- L128 — `ok:false` when filepath has no registry row.
- L135 — `ok:false` on empty registry.
- L141 — real topological order: `c.js` < `b.js` < `a.js` in `orderedFiles` when `a` imports `b` imports `c`; focal `a` placed last; `totalNodes=3`, `totalEdges=2`.
- L165 — island focal (`d.js`) returns single-element ordered path; `totalNodes=1`, `upstream=0`.
- L177 — scoped subgraph reachability is 2/3 ≈ 0.667 (between 0.6 and 0.7), NOT the project-wide 0.5; outcome ≠ `failure`.
- L189 — full plan + reasons + topologicalAnalysis passthrough from `path-generator`.

Tests use `fakePersistence` stub (lines 21-32) with hand-built `FILES` + `CONNECTIONS` arrays. Real `St8Persistence` paths are exercised by the live curl probes documented in the Wave 3B reviewNote.

## 7. Contracts

The adapter encodes four load-bearing contracts:

1. **BFS scoping** (lines 196-237): two BFS passes from the focal node — upstream (follow `e.from === cur` → `e.to`) and downstream (follow `e.to === cur` → `e.from`). Union of visited nodes plus induced edges (`scopedEdges = edges.filter(e => scopedIds.has(e.from) && scopedIds.has(e.to))`) is the subgraph passed to `generateMigrationPath`. This is the **load-bearing performance primitive** — without it the request hangs past 60s on a 300-node graph (Wave 3B mutation probe #2).

2. **Dedup by newest birthTimestamp** (lines 74-81): `file_registry` can carry multiple rows per filepath (multi-fingerprint state from rename history). For each filepath, the row whose `birthTimestamp` sorts highest wins. Matches the schema-card emitter's dedup contract (Wave 3A ticket 9 from `identity-and-analysis.review.md`). Identity-internal; the consumer never sees the older row.

3. **Dangling-edge filter** (lines 100-102): an edge is admitted only if BOTH `sourceFingerprint` and `targetFingerprint` are present in `validFingerprints` (the post-dedup set). Without this, the connections table could leak edges referencing dropped older fingerprints — those would produce graph nodes that path-generator's Kahn algorithm couldn't index.

4. **Scoped property recomputation** (lines 245-253, 258-263): `reachability` is recomputed over the scoped subgraph. Without recompute, a healthy file inside a sprawling repo (markdown/doc orphans) gets `outcome=FAILURE` because project-wide reachability falls below `evaluateOutcome`'s 0.5 threshold. The reviewer's mutation probe #1 confirmed this is the load-bearing primitive that flips outcome from FAILURE to PARTIAL for `app.js`. `stability` and `fragility` are inherited from the full graph (lines 260-261) — the in-file comment at lines 117-122 acknowledges the cycle check is an approximation and that path-generator's own Tarjan would refine it.

Performance constraints (in-file lines 195-203): the surrounding analysis passes are O(V*E); scoping is what enables sub-second response on 300+ node graphs.

## 8. Change vector

### T1 — relationship-analyzer wire-up template

**Why this file is a good template for T1.** The four contracts above plus the persistence-bridge pattern map almost 1:1 onto what a hypothetical `relationship-adapter.js` would need:

- `relationship-analyzer.analyzeRelationships(externalGraph, currentGraph, targetPages)` (declared at `src/features/analysis/relationship-analyzer.js:15`) consumes the SAME `SemanticGraph` shape that `buildSemanticGraphFromPersistence` already produces. The dedup + dangling-edge contract is reusable verbatim.
- The four-stage call pattern (build graph → BFS-scope → recompute properties → call vendored analyzer) is the load-bearing template. A relationship-adapter would inherit stages 1-3 unchanged and substitute `analyzeRelationships` for `generateMigrationPath` at stage 4.
- The `_handleSignalPath` / `_handleGenerateReport` HTTP handler pattern (lines 1483-1542, 1555-1635 of app.js) — per-request `St8Persistence` + try/catch + `finally { persistence.close() }` — is reusable as-is for `_handleAnalyzeRelationships`.

**Shared-helper proposal (not a directive — observation).** If T1 lands, three blocks would be candidates for extraction into a shared module (e.g. `src/features/analysis/semantic-graph-bridge.js`):

- `buildSemanticGraphFromPersistence` itself (lines 62-152) — currently only one consumer.
- The BFS scoping logic (lines 196-237).
- The scoped-property recompute (lines 245-253).

If a second adapter were authored without extraction it would copy ~120 LOC of contract-encoding logic. The risk of drift between the two adapters is the strongest argument for extraction; the strongest argument against is YAGNI given the founder priority of single-adapter (P1.1) over relationship-adapter (P2.1).

**Roadmap P2.1 input mismatch.** Per `identity-and-analysis.for-review.json` ticket 3 `actionsTaken`: `analyzeRelationships` requires `(externalGraph, currentGraph, targetPages)`. st8's runtime only has one graph (the current project's). Wiring it as `analyzeRelationships(currentGraph, currentGraph, targetPages)` produces an analysis where every dep is trivially `SAFE` (self-match) — the cheat the Wave 3B reviewer flagged. T1 should answer **which second graph** the adapter feeds — an external project (cross-project ingest), an earlier snapshot of the same project, or a "synthetic baseline" derived from the same `connections` table at a previous timestamp.

**INDEX_COMPLETE subscriber registration.** Roadmap P2.1 prescribes `P=25` priority (before gap-analyzer at P=30 so D5 can incorporate the conflict signal). The signal-path-adapter explicitly does **not** register as an INDEX_COMPLETE subscriber — it's request-scoped. T1's relationship-adapter would diverge from this template by ALSO registering a subscriber (per the roadmap), which means T1 needs both the request-scoped pattern (for ad-hoc API queries) AND a batched subscriber that writes results somewhere readable by the next analyzer.

### T6 — /api/generate-report payload audit

**Handler location.** `src/core/server/app.js:476` dispatches `/api/generate-report` → `_handleGenerateReport(req, res)` at line 1555.

**Routing trace.** The handler (lines 1555-1635) calls:

1. `computeSignalPath` from this adapter (lines 1577-1587) — same code path as `/api/signal-path`.
2. If `sp.ok === true`, synthesizes an `Integr8Output` envelope (lines 1598-1608):
   - `migrationPlan: sp.plan` (from path-generator)
   - `semanticGraph: { nodes: [], edges: [], properties: sp.pathSummary.graphProperties }` — nodes/edges elided because per the ticket 5 `actionsTaken` (identity-and-analysis.for-review.json), `report-generator` only inspects `properties` from that field.
   - `outcome: sp.outcome`, `reasons: sp.reasons`.
3. Calls `generateMigrationReport(integr8Output)` from `src/features/analysis/report-generator.js` (required at line 1578).
4. Content-negotiates: `Accept: text/markdown` returns raw markdown; otherwise JSON envelope `{ ok, report, pathSummary }`.

**Does it route through this adapter or through integr8?** **Through this adapter.** It does NOT go through `src/features/integr8/index.js` (which has zero live consumers — confirmed by `grep -rn 'integr8/index\|require.*integr8/index' src/`: only the file's own self-reference and a graph-persister docstring naming it as dead). The handler is the FAST, scoped path — same `computeSignalPath` invocation, same 5-25ms latency, same scoping protection.

**Required payload.** Body is `{ filepath: string, targetDir?: string }` (lines 1570-1575). Validates `filepath` is a present string (returns 400 otherwise). 4KB body cap (line 1561). `targetDir` defaults to `this.targetDir || '.'` (line 1586).

**The T6 "wedge on valid input" finding.** The brief asks whether `/api/generate-report` "may wedge on valid input on a 345-file project." Per the trace above:

- The handler routes through `computeSignalPath`, which applies BFS scoping at lines 196-237. The Wave 3B mutation probe #2 demonstrated that **without scoping**, even a single-file request hangs past 60s on a 305-node graph.
- With scoping, Wave 3B's live probe at the reviewer's hand returned an 80-line markdown report for `indexer.js` (Reachability 75%, Stability 98.4%, 5 migration steps) with no observed wedge. Same scoping protection applies on the 345-file dogfood.
- The integr8 entry (`src/features/integr8/index.js`) — the slow, full-graph path — is NOT invoked by this handler. It has no live consumers anywhere in `src/`. T6's wedge hypothesis would apply if `/api/generate-report` routed there; it does not.

**Therefore the T6 finding for this file: the wedge cause is NOT in the signal-path-adapter path.** If a 345-file project wedges on `/api/generate-report`, the candidate causes are:

1. The per-request `new St8Persistence()` + `initialize()` (line 1580). On a large DB the first-touch initialize can be slow; Wave 3B reviewer flag #3 (cluster summary) already named "Per-request St8Persistence open+close adds ~30ms" as a cross-cluster concern.
2. `path-generator`'s O(V*E) passes when the scoped subgraph is itself large (a focal file with dozens of transitive deps in both directions). The adapter does NOT cap scoped-subgraph size; on a hub-like file the subgraph could approach the full graph.
3. `generateMigrationReport` itself if the plan has many steps (it walks `plan.steps` and emits markdown lines per step). On a deep chain this is linear and unlikely to wedge.

A meta-dogfood reproduction at `meta-dogfood.md` would localize the wedge if one exists. The fix space, if confirmed, is (1) shared persistence reuse (already flagged as Wave 3B residualConcern #3) or (2) a max-radius cap on the BFS scope (currently unbounded — see Gaps below).

## 9. Provisions already made

- `pathSummary` (lines 320-331) exposes `totalProjectNodes` and `totalProjectEdges` alongside the scoped counts — consumers can already see the scoping ratio.
- `graphProperties` is exposed in `pathSummary` so report-generator can reuse the scoped properties without re-deriving (used at app.js line 1604).
- The focal node "absent from graph" guard (lines 204-211) handles the case where dedup drops the focal file — early failure with a diagnostic error message.
- The "empty migration framing" handling (path-generator's `targetPages = [targetFilepath]` at line 268, `sourcePath === targetPath === resolvedTargetDir` at lines 273-275) intentionally feeds the migration engine inputs that make the migration-step framing a no-op tail. The user-friendly surface is `pathSummary.orderedFiles` (lines 279-282) which extracts the topologically-ordered file chain from `plan.steps`.

## 10. Gaps + open questions

**Gaps:**

- The BFS scope is **unbounded**. A hub-like focal file (e.g. `app.js` with dozens of imports + dozens of consumers) could pull in a large fraction of the project. No `maxDepth` or `maxNodes` cap exists. Whether this matters in practice on the 345-file dogfood is open.
- `stability` and `fragility` are inherited from the full graph (lines 260-261) even though `reachability` is recomputed. The in-file comment (lines 117-122) acknowledges this is approximate. For T6 reports the discrepancy between scoped-reachability and project-wide stability could confuse consumers reading the markdown table.
- Cycle warnings in `path-generator` go to `console.warn` (the file's own residualConcern #4 in the ticket JSON), not into `pathSummary.cycles[]`. Frontend consumers would need a different surface.
- `start.js` runs the backend with `cwd: __dirname` (the st8 install dir) per the Wave 3A reviewer flag #4 — the `targetDir` parameter passed to `computeSignalPath` may not be what the user thinks it is on cross-project invocations.

**Open questions:**

- **T1:** Which second graph does the relationship-adapter feed? Same-project-at-different-snapshot (requires a snapshot table), external-project-from-ingest (requires UI for `externalPath`), or some baseline derived from the connections table? The roadmap P2.1 leaves this open.
- **T1:** Should the BFS-scoping + dangling-edge filter logic be extracted to a shared helper before authoring a second adapter, or is YAGNI the right call? Drift risk vs. premature abstraction.
- **T6:** Has the 345-file dogfood wedge actually been reproduced against the current handler (post-Wave-3B), or does the brief carry forward an older symptom from before scoping landed? Reviewer's Wave 3B live probe at 22ms on the 305-node graph suggests scoping is doing its job today.
- **T6:** Should `/api/generate-report` honor a `maxRadius` query/body param to cap BFS scope when the founder wants a fast summary versus a full chain?
- Cross-cluster: per the Wave 3B reviewer flag, `report-generator`'s markdown still says "Migration Report: integr8 Analysis" because it inherits integr8's vocabulary. Cosmetic but visible in T6's output.
