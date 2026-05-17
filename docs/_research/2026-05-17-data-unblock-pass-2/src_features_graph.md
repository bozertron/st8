# Research — `src/features/graph/` (data-unblock pass 2)

**Cluster:** data-unblock-pass-2
**Wave:** 2026-05-17 audit of features/graph through three lenses
**Mode:** read-only

---

## 1. File inventory

| File | LOC | Origin | Status |
|---|---|---|---|
| `src/features/graph/builder.js` | 213 | TS-compiled vendored from `src/commands/graphBuilder.ts` (maestro scaffolder upstream). `linguist-generated=true` by sibling `graph-persister.js` banner. | LIVE — called by `src/features/indexing/indexer.js:251` (`buildGraph` → `buildDependencyGraph(targetDir)`). |
| `src/features/graph/traversal.js` | 827 | TS-compiled vendored from `src/commands/graphTraversal.ts`. Same banner. | DORMANT — zero consumers anywhere in `src/` / `tests/` / `scripts/` (per the prior wave's research file, confirmed unchanged since `f0603ed` migration). Reads `GraphNodes` + `GraphEdges` (scaffolder_data.sqlite) which nothing populates. |

Both files are TS-vendored; hand-edits silently lost on next maestro re-vendor. **All unblock work must take the wrapper-module form** (per the corpus-blind-spot rule formalized in bible batch 031).

---

## 2. `builder.js` outputs — consumed vs discarded

`buildDependencyGraph(projectPath)` returns (`builder.js:100-111`):

```
{ nodes, circularDeps, orphanedFiles, deadImports,
  healthScore, totalNodes, healthyCount, partialCount,
  unusedCount, brokenCount }
```

Plus per-node fields on `nodes[]` (`builder.js:92-94`): `health`, `consumers`, `dependencies`, `impactRadius`.

The `buildGraph` wrapper in `indexer.js:241-295` extracts EXACTLY two fields and discards the rest:

| Field | Source | Currently consumed? | Canonical category if wired | Wire-up cost |
|---|---|---|---|---|
| `nodes[].health` + `nodes[].impactRadius` | builder.js | YES → flattened into `classifications` (filepath/status/reachabilityScore/impactRadius) for `file_registry.status` merge in indexDirectory | n/a (already wired) | — |
| `circularDeps` | builder.js DFS | YES → threaded as `ctx.result.cycles` (batch 030/031), consumed by P=37 cycle-insight-emitter, merged with persistence-cycle-detector's Tarjan output | `circular_dependency` (high) | already wired |
| **`orphanedFiles`** | builder.js:46-53 (zero in + zero out) | **NO — dropped** | `unused_export` OR `structural` (low/medium) | New subscriber + 1 line in indexer to surface as `ctx.result.orphanedFiles`. ~80 LOC emitter + tests. Caveat: the *populator's* existing ad-hoc `orphan` category overlaps; canonicalizing this is a partial dedupe opportunity. |
| **`deadImports`** | builder.js:55-63 (import-type nodes with no resolution edge) | **NO — dropped** | `dependency` (medium) — closest canonical match; "broken import" semantics | New subscriber + indexer surface. ~80 LOC. Caveat: builder's source is the integr8 graph; for st8-on-itself only Vue/Pinia parsers populate IMPORT nodes (so likely 0 emissions today — same TRUE-NEGATIVE shape as the cycle pipeline pre-batch-031). |
| **`healthScore`** (scalar 0..1) | builder.js:99 | **NO — dropped** | Project-level summary, NOT a per-file `InsightRecord`. Fits a `categorySummary`-style top-level stat or a single project-scoped `structural` insight at fileId = `__project__` | ~30 LOC. Could be added to `/api/state` as `graphHealth` instead of an insight (lower-friction surface). |
| **`totalNodes` / healthyCount / partialCount / unusedCount / brokenCount`** | builder.js:95-98 | **NO — dropped** | Distribution telemetry. Same shape as healthScore. | Bundle with healthScore in a single `health-summary-emitter` subscriber. |
| **`nodes[].consumers` + `nodes[].dependencies`** (per-node) | builder.js:73-74 | **NO — dropped (only `health` + `impactRadius` survive)** | `dependency` per-file | This IS the data traversal.js's `findConsumersOf` / `findImportsOf` would surface. Caching in `ctx.result` + serving via a new lazy traversal module avoids recomputing. See §5. |

**Note:** unlike `circularDeps`, the dead `orphanedFiles` / `deadImports` fields come from the same integr8-graph source — for non-Vue projects (st8-on-itself) they will be sparse/empty until the integr8 parser calibration lands OR a persistence-derived alternative source (mirroring `persistence-cycle-detector`) is added.

---

## 3. `traversal.js` 13 exports — lazy-path data-source mapping

(Cross-checked against prior research `2026-05-16-analysis-tools-unblock/src_features_graph_traversal.md` §2.)

| # | Export | What it does | Canonical category if wired | Current source (dead) | Lazy-path equivalent (st8.sqlite) |
|---|---|---|---|---|---|
| 1 | `clearCache` | Clear 5-graph LRU | n/a | in-process | No-op stub OR hook into `INDEX_COMPLETE` |
| 2 | `ensureIndexes` | Create six idx on GraphNodes/GraphEdges | n/a | DDL | No-op (persistence.js already has `idx_connections_source/target` at lines 141-142) |
| 3 | `findPaths(start,end,maxDepth,maxResults)` | BFS path enumeration | `dependency` / `structural` | GraphEdges | BFS over `connections` adjacency built from `getAllConnections()` |
| 4 | `analyzeReachability(nodeId, direction)` | reachable nodes + depth + score | `structural` (overlaps `file_registry.reachabilityScore` cache) | GraphEdges | BFS over `connections`; or use cached `file_registry.reachabilityScore` |
| 5 | `extractSubgraph(nodeIds, includeConns)` | Induced subgraph | `structural` | GraphNodes+GraphEdges | Filter `getAllFiles()` + `getAllConnections()` by id-set |
| 6 | `computeImpactChain(nodeId)` | Reverse-BFS dependents + severity bucket | `dependency` (low/medium/high tracks severity field) | GraphEdges | Reverse-BFS over `connections` — same pattern as `signal-path-adapter.js:62-111` |
| 7 | `findImportsOf(symbolName)` | Edges of type 'imports' matching symbol | `dependency` | GraphEdges | Query `connections WHERE importSpecifier LIKE ?` |
| 8 | `findConsumersOf(filePath)` | Nodes pointing to a filepath | `dependency` | GraphEdges | `getConnectionsForFile(fp)` reverse direction |
| 9 | `findOrphans` | Zero-in zero-out nodes | `unused_export` / `structural` | GraphNodes/Edges | Single SQL: `file_registry` LEFT JOIN `connections` GROUP BY having 0 — **directly duplicates** builder.js's `orphanedFiles` |
| 10 | `getDirectorySubgraph(dirPath)` | Internal nodes/edges + boundary flows | `structural` | GraphNodes/Edges | Filter by `filepath LIKE 'dirPath/%'`; classify each `connections` row as in/out/internal |
| 11 | `getDirectoryBoundary(dirPath)` | Classify edges as IN/OUT/INTERNAL with status/confidence | `structural` (degraded — `status` always 'SAFE' until relationship-analyzer ships) | GraphEdges | Same as #10 but returns BoundaryEdge shape |
| 12 | `getDataFlowMetrics(dirPath)` | Counts + error/warning/ambiguity flow tables | `structural` (degraded — flow categories always 0 until P2.1) | GraphEdges | Same |
| 13 | `getFileFlows(filePath)` | Inbound + outbound edges for a file | `dependency` | GraphEdges | `getConnectionsForFile(fp)` split by direction |

**Semantic translation gap (carry-over from prior research §7):** st8 only writes `connections.connectionType = 'IMPORT'` today, mirroring `GraphEdges.edge_type = 'imports'`. The other six edge types (`depends_on`, `exports`, `navigates_to`, `invokes`, `conflicts_with`, `contains`) have no source in st8.sqlite. Six of the 13 exports (#3-8, #13) work fine; four (#10-12, #11) operate in degraded mode (status field always 'SAFE'); three (#1, #2, #5) are trivial or no-op.

---

## 4. Sonic-aligned vs lazy-path — post-batch-031 reassessment

The prior wave deferred this decision pending the PM-1 sonic timeline. **Batch 031 materially changes the calculus.** Three reasons:

1. **`connections` is now accurate.** Batch 031's `connection-resolver.js` replaced the substring matcher; for st8-on-itself the table went from 363 mostly-wrong rows to 188 correct ones, with 355 resolved. The lazy path's input data is now trustworthy.

2. **`persistence-cycle-detector.js` is the proven template.** Recipe C in batch 031 ("Persistence-derived analyzer pattern") is precisely the shape every export of `traversal-lazy.js` would take: read `getAllFiles()` + `getAllConnections()`, build the input the algorithm expects, run the algorithm, map back to the same output shape. The pattern is verified end-to-end against a synthetic three-file cycle fixture and on st8-on-itself.

3. **Sonic restoration remains founder-deferred** (`background-indexer.js` revival explicitly NOT touched in batch 031 per `sonic-and-search.md` P1). Option (b) sonic-aligned therefore stays gated on a decision that hasn't shifted, while option (a) lazy is now actively enabled.

**Conclusion:** the two-path roadmap collapses to **option (a) lazy is unblocked now**; option (b) sonic-aligned is the eventual end-state when background-indexer lands. They are no longer mutually exclusive — the lazy wrapper can read `connections` today, and if/when GraphEdges gets populated by Pass-2 sonic wiring, the wrapper can be swapped for the vendored `traversal.js` by changing one require line in `app.js` (no consumer-side change because the wrapper preserves the 13-export signature). The lazy wrapper is a **bridge**, not a permanent fork.

---

## 5. New wrapper module candidate

**`src/features/graph/traversal-lazy.js`** — same 13-export public surface, reads from `persistence.js` directly. Pattern:

- Headers cite `persistence-cycle-detector.js` (recipe C) and `signal-path-adapter.js` (the dedup-by-newest-birthTimestamp template at lines 62-111) as templates.
- Accepts an injected `persistence` (St8Persistence instance) for testability — same as `detectCyclesFromPersistence(persistence)`.
- Builds adjacency from `getAllFiles()` + `getAllConnections()` once per call; per-request, no cross-request cache (mirrors batch 031's "data changes on every indexer run anyway" reasoning).
- Resolves nodeId-or-filepath to fingerprint via `getFileByPath()`, newest-birthTimestamp wins (the schema-card-emitter / signal-path-adapter dedup contract).
- v1 ships six functional exports (`computeImpactChain`, `findImportsOf`, `findConsumersOf`, `getFileFlows`, `findOrphans`, `analyzeReachability`) + `clearCache`/`ensureIndexes` no-ops + four directory-boundary exports stubbed with `'lazy-mode degraded — status field always SAFE'` documentation.
- Routes: `GET /api/graph/deps?nodeId=<fp>` (calls `findImportsOf` or `getFileFlows.outbound`) and `GET /api/graph/impacts?nodeId=<fp>` (calls `computeImpactChain`). Mirrors the `/api/signal-path` handler shape at `app.js:1468-1577`.

**LOC estimate:** ~250-300 LOC wrapper + ~80 LOC two routes in app.js + ~6 LOC route-manifest + ~150 LOC tests = ~500 total. Half-day (matches roadmap `docs/_pending-roadmap/identity-and-analysis.md:65`).

---

## 6. Top 3 quick wins (impact × confidence / effort)

### Win #1 — `orphan-insight-emitter` subscriber (mirrors cycle-insight-emitter)

**Impact:** HIGH. Wires a *second* canonical category (`unused_export` or `structural` — TBD per founder, recommend `unused_export` since the populator's existing ad-hoc `orphan` category would collapse cleanly into it). Proves recipe A scales beyond the first slice.

**Confidence:** VERY HIGH. The data is already computed at `builder.js:46-53` (zero-in zero-out filter); plumbing is identical to `circularDeps` plumbing in batch 030 (indexer surfaces `ctx.result.orphanedFiles`, subscriber consumes).

**Effort:**
- `src/features/indexing/indexer.js` — add `orphanedFiles: report.orphanedFiles` to the `buildGraph` return shape (~3 LOC).
- `src/features/analysis/orphan-insight-emitter.js` — NEW, ~90 LOC. Mirrors `cycle-insight-emitter.js` exactly.
- `src/core/hooks/default-subscribers.js` — register at P=38 (just after P=37 cycle-insight-emitter), ~25 LOC.
- Pair with `persistence-orphan-detector.js` (~80 LOC, recipe C) — `getAllFiles()` minus the set of fingerprints in any `connections` row (source OR target). Gives a true-negative-resilient path for non-Vue projects, exactly as the persistence Tarjan adapter does for cycles.
- Tests: ~120 LOC across two files.
- **Total ~3 hours, ~320 LOC.**

**Canonical category:** `unused_export` (severity `low`, since orphan-file is informational not architecturally broken).

### Win #2 — `traversal-lazy.js` wrapper + two routes

**Impact:** HIGH. Closes roadmap P2.3 (the residual concern flagged in `identity-and-analysis.review.md:172-180`). Unblocks Wave 7 dive-in panel.

**Confidence:** HIGH. Detailed approach already in prior research file §8. Recipe C (persistence-derived analyzer) proven by batch 031. Six of 13 exports ship cleanly; four degraded; three trivial — same shape as `persistence-cycle-detector` but for traversal queries.

**Effort:** ~500 LOC, half-day (see §5 above). Concrete files:
- `src/features/graph/traversal-lazy.js` (NEW, ~280 LOC)
- `src/core/server/app.js` (+~80 LOC, two routes mirroring `_handleSignalPath`)
- `src/core/server/route-manifest.js` (+~6 LOC)
- `tests/features/graph/traversal-lazy.test.js` (NEW, ~150 LOC)

**Canonical category mapping:** routes return raw graph shapes (paths, edges) — NOT InsightRecords. Per-export category mapping for any future emitter spin-off lives in §3 above.

### Win #3 — `health-summary` exposure via `/api/state`

**Impact:** MEDIUM. Surfaces the four currently-dropped scalar fields (`healthScore`, `totalNodes`, healthyCount/partialCount/unusedCount/brokenCount) as project-level telemetry. Cheap, immediately useful for dive-in panel headers.

**Confidence:** VERY HIGH. Already computed, just discarded.

**Effort:**
- `indexer.js` — surface `graphHealth: { healthScore, ... }` in `ctx.result` (~5 LOC).
- `main.js` or a small subscriber — persist into `st8_settings` or a new `graph_health` snapshot table; OR (simpler) cache in-memory in the `St8Server` instance and expose via existing `/api/state` handler.
- ~30 LOC plus ~40 LOC of tests.
- **Total ~1 hour, ~70 LOC.**

**Canonical category:** none (project-level scalar, not per-file insight). Pure API surface addition.

---

## 7. Cross-directory dependencies

- `builder.js` requires `../../shared/types/integr8-types.js` (NodeType/EdgeType enums) + `../indexing/data-ingestion.js` (ingestProjectData — runs the seven parsers). No persistence dependency.
- `traversal.js` requires `../../core/database/graph-persister.js` (dead path) + `../../shared/types/integr8-types.js`. No `persistence.js` dependency.
- `indexer.js:251` is the only call site for `builder.js:buildDependencyGraph`. Threads result into `ctx.result` for INDEX_COMPLETE subscribers via `main.js`.
- Recipe A subscribers (`cycle-insight-emitter`, future `orphan-insight-emitter`) require both `./insight-store` and the corresponding `persistence-X-detector`.
- The proposed `traversal-lazy.js` would require only `../../core/database/persistence.js` — no graph-persister, no integr8-types (uses raw fingerprints + filepaths).

**Coupling that batch 031 created:** `default-subscribers.js` now requires BOTH `cycle-insight-emitter` AND `persistence-cycle-detector` in the same P=37 handler — the merge happens in the subscriber, not in either source module. Future emitters following recipe A will likely keep the same shape: two sources merged at the subscriber, dedup helper paired with the persistence detector.

---

## 8. Gaps + open questions

1. **`orphan` taxonomy collision.** The insight-store-populator already emits an ad-hoc `orphan` category (per bible batch 030 type-failure-pattern note). A canonical `orphan-insight-emitter` writing `unused_export` would coexist with the ad-hoc `orphan` rows until the populator is canonicalized. Recommendation: emit `unused_export`; flag the populator's `orphan` for a future single-shot rename. Mirrors how `circular_dependency` was added alongside the 5 ad-hoc categories in batch 031 without breakage.

2. **builder.js's integr8-source means st8-on-itself stays near-empty for `orphanedFiles` / `deadImports`.** The Vue/Pinia/Tauri parsers don't populate IMPORT nodes for plain JS. The cycle pipeline solved this with a SECOND source (persistence Tarjan); the same solution applies here (persistence orphan detector — Win #1's "pair with"). Without the pairing the canonical-producer wires up but stays silent for st8 itself — exactly the situation cycles were in before batch 031's Tarjan adapter.

3. **`healthScore` semantics.** builder.js's healthScore (healthy/total) is computed over the integr8-parser node set, NOT over `file_registry`. For st8-on-itself the integr8 nodes are ~0 useful, so healthScore is misleading. A persistence-derived healthScore (over `file_registry.status` distribution) would be more accurate. Open question: ship builder's scalar as-is (Win #3) or compute from `file_registry` instead?

4. **`<fp>` URL semantics for the two new routes.** Carry-over from prior research §10 Q2. Recommend: accept either fingerprint or filepath; encode test for the `||` separator surviving URL encoding.

5. **graph-persister.js fate.** If `traversal-lazy.js` ships and `traversal.js` stays untouched, `graph-persister.js` loses ~all its consumer surface. Already flagged in identity-and-analysis review concern (3). Out of scope here.

6. **Pass numbering.** `cycle-insight-emitter` uses `PASS_NUMBER = 2`. Orphan-emitter would also be Pass 2 ("Dependency Health"). DeadImports-emitter — Pass 2 or a new pass? Roadmap is silent. Recommend Pass 2 for all three (same conceptual pass; the subscriber priorities P=37/38/39 differentiate ordering).

7. **`getDataFlowMetrics` / `getDirectoryBoundary` degraded mode.** Even with the lazy wrapper, the `status` field (`SAFE`/`NEEDS_REWRITE`/`CONFLICT`/`MISSING`) and the flow categories (`errorFlows`/`warningFlows`/`ambiguityFlows`) have no st8.sqlite source — they originate from the dormant `relationship-analyzer.js` (P2.1). If Wave 7 dive-in colour-codes by status, monochrome output until P2.1 ships. Document loudly.
