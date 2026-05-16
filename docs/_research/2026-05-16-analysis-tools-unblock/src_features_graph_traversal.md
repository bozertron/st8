# Research — `src/features/graph/traversal.js`

**Cluster:** identity-and-analysis
**Ticket in scope:** T2 — wire via the **lazy** path (roadmap P2.3 option (a))
**Wave:** analysis-tools-unblock-pass-1
**Date:** 2026-05-16

---

## 1. Identity (TS-vendored note)

`src/features/graph/traversal.js` is **compiled-from-TypeScript output**. Tell-tale markers:

- Line 1: `"use strict";` followed immediately by the original `.ts` header comment (`src/commands/graphTraversal.ts` — `src/features/graph/traversal.js:2`).
- The `__createBinding` / `__importStar` / `__importDefault` boilerplate at `src/features/graph/traversal.js:11-46` — standard `tsc` emit.
- `Object.defineProperty(exports, "__esModule", { value: true });` at `src/features/graph/traversal.js:47`.
- `require("../../core/database/graph-persister.js")` is named `databasePersister_js_1` — the upstream filename was `databasePersister.ts` (`src/features/graph/traversal.js:65`).

Its sibling `src/core/database/graph-persister.js` carries a **vendored / generated-artifact** banner stating the upstream is `maestro-scaffolder-tool/src/commands/integr8/databasePersister.ts`, that the file is `linguist-generated=true`, and that **hand-edits will be silently clobbered next time the maestro snapshot is re-vendored** (`src/core/database/graph-persister.js:1-34`). Traversal is the same provenance — origin reference `scripts/migration/manifest-history.jsonl:8` (`from: lib/commands/graphTraversal.js`, `to: src/features/graph/traversal.js`, batch `indexing-parsers`, commit `f0603ed`).

**Treatment for T2:** since the file is `tsc` output from an upstream `.ts` we don't own here, hand-editing the `.js` is fragile. **Recommended approach: write a new wrapper module that adapts `persistence.js` queries to traversal's export shapes, leaving the vendored `.js` untouched.** See §8.

---

## 2. Stated intent (the 13 exports)

From `src/features/graph/traversal.js:48-60`:

| # | Export | Stated intent |
|---|---|---|
| 1 | `clearCache` | Clear the in-process traversal query cache (`src/features/graph/traversal.js:69-73`) |
| 2 | `ensureIndexes` | Create six idempotent indexes on `GraphNodes` + `GraphEdges` (`src/features/graph/traversal.js:117-134`) |
| 3 | `findPaths` | BFS path enumeration between two nodes — returns `{paths, shortestPath}` capped at `maxDepth`/`maxResults` (`src/features/graph/traversal.js:252-313`) |
| 4 | `analyzeReachability` | BFS reachability count + depth + score, direction = `'outbound'`/`'inbound'` (`src/features/graph/traversal.js:317-364`) |
| 5 | `extractSubgraph` | Induced subgraph for a node-id set, with `includeConnections` toggle (`src/features/graph/traversal.js:368-401`) |
| 6 | `computeImpactChain` | Reverse-BFS — direct + cascading dependents + severity bucket low/medium/high (`src/features/graph/traversal.js:405-464`) |
| 7 | `findImportsOf` | Edges of type `imports` whose target name matches a symbol (`src/features/graph/traversal.js:469-495`) |
| 8 | `findConsumersOf` | Nodes whose edges point to a given filepath, platform-aware comparison (`src/features/graph/traversal.js:501-549`) |
| 9 | `findOrphans` | Nodes with zero inbound AND outbound edges (`src/features/graph/traversal.js:554-577`) |
| 10 | `getDirectorySubgraph` | Internal nodes/edges + boundary in/out flows for a dir (`src/features/graph/traversal.js:582-630`) |
| 11 | `getDirectoryBoundary` | Classify every edge touching a dir as IN/OUT/INTERNAL, returning `BoundaryEdge` shapes (`src/features/graph/traversal.js:637-698`) |
| 12 | `getDataFlowMetrics` | Counts + error/warning/ambiguity flow tables for a directory boundary (`src/features/graph/traversal.js:702-764`) |
| 13 | `getFileFlows` | Inbound + outbound edges for a single file (`src/features/graph/traversal.js:769-826`) |

Note: the userNote for T2 says "13 exports … findImportsOf, findExportsOf". There is **no `findExportsOf`** in the file. The 13th export is `getFileFlows`. The `findExportsOf` name appears nowhere in `src/features/graph/`. (Possibly a userNote scribe error; `findImportsOf` does exist.)

---

## 3. Public surface (signatures)

All signatures take an optional final `db` (a `better-sqlite3` handle); when omitted, the function opens `getSharedDatabasePath()` read-only and closes it in `finally`.

```js
clearCache(): void
ensureIndexes(db): void                                    // requires db
findPaths(graphId, startNodeId, endNodeId, maxDepth?, maxResults?, db?)
   → { paths: string[][], shortestPath: string[], error? }
analyzeReachability(graphId, nodeId, direction, db?)
   → { reachableNodes: string[], depth: number, reachabilityScore: number, error? }
extractSubgraph(graphId, nodeIds, includeConnections, db?)
   → { nodes: GraphNodeRow[], edges: GraphEdgeRow[], error? }
computeImpactChain(graphId, nodeId, db?)
   → { directImpact: string[], cascadingImpact: string[],
       severity: 'low'|'medium'|'high', error? }
findImportsOf(graphId, symbolName, db?)        → { edges: GraphEdgeRow[], error? }
findConsumersOf(graphId, filePath, db?)        → { nodes: GraphNodeRow[], error? }
findOrphans(graphId, db?)                      → { nodes: GraphNodeRow[], error? }
getDirectorySubgraph(graphId, dirPath, db?)
   → { internalNodes, internalEdges, inFlows, outFlows, error? }
getDirectoryBoundary(graphId, dirPath, db?)
   → { inEdges: BoundaryEdge[], outEdges: BoundaryEdge[],
       internalEdges: BoundaryEdge[], error? }
getDataFlowMetrics(graphId, dirPath, db?)
   → { inFlowCount, outFlowCount, uniqueConnectionCount,
       errorFlows, warningFlows, ambiguityFlows, error? }
getFileFlows(graphId, filePath, db?)
   → { inbound: FileFlow[], outbound: FileFlow[], error? }
```

`BoundaryEdge` (built at `src/features/graph/traversal.js:674-681`):
```
{ edgeId, fromPath, toPath, edgeType, status, confidence }
```
`FileFlow` (built at `src/features/graph/traversal.js:802-818`):
```
{ fromNodeId|toNodeId, fromPath|toPath, edgeType, status, confidence }
```

Every signature is **graph-scoped via `graphId`** — a TEXT key into `GraphNodes.graph_id` / `GraphEdges.graph_id` (`src/core/database/graph-persister.js:124-138`). st8's `connections` table has no analogous partition key (it's a flat per-project table at `src/core/database/persistence.js:93-105`).

---

## 4. Callers — verify the "zero consumers" claim

`grep -rn "graph/traversal\|computeImpactChain\|findImportsOf\|findConsumersOf\|getDirectorySubgraph\|findExportsOf\|getDataFlowMetrics\|getDirectoryBoundary" src/ tests/ scripts/` returns:

- **Zero `require`** of `src/features/graph/traversal.js` from anywhere in `src/`, `tests/`, or `scripts/`. Confirmed.
- Name collisions only:
  - `src/features/search/sonic-queries.js:68-211` defines its OWN `findImportsOf` / `findConsumersOf` / `getDirectorySubgraph` methods on a Sonic-queries class — separate surface, not an importer (`src/features/search/sonic-queries.js:88-211`).
  - `src/features/analysis/intent-seeder.js:30, 77` mentions `graph[-_]?traversal` only as a filename → purpose regex pattern.
  - `scripts/migration/results.gap-analysis.md:80`, `scripts/signal-tests/results.identity-delta.md:57`, `scripts/migration/results.stage-originals.json:241`, `scripts/migration/move-history.json:183` — historical migration manifests, not consumers.
- No test file imports it — `find tests -name "*traversal*"` returns nothing. `tests/scripts/signal-tests/tier-1-schema-contracts.test.js:191-193` references GraphNodes only to assert the DDL CHECK constraint, not the traversal module.

**Wave 3B reviewer's `defer-confirmed` finding holds: zero live consumers.**

A near-sibling that **does NOT** use traversal — `src/features/analysis/signal-path-adapter.js` — is worth flagging. It deliberately bypasses traversal and walks `connections` directly (`src/features/analysis/signal-path-adapter.js:62-111`). Its docstring at `src/features/analysis/signal-path-adapter.js:4-40` is essentially the lazy-path argument already implemented at the adapter layer — proof that the "lazy" approach is viable and shipped for the path-generator use case.

---

## 5. Prior work

- **Bible batch reference:** the file was last *moved* in batch `indexing-parsers` (commit `f0603ed`, see `scripts/migration/manifest-history.jsonl:8`). No subsequent functional edits.
- **Identity ticket (defer-confirmed):** the traversal entry in `docs/_pending-tickets/identity-and-analysis.for-review.json` (search `"src/features/graph/traversal.js"`) is the authoritative context. Verdict: `defer-confirmed`. Reasoning summary:
  - Reads from `GraphNodes`/`GraphEdges` (scaffolder_data.sqlite); the indexer's Pass-2 writes to st8.sqlite's `connections` instead — so **traversal queries against a fresh db return empty arrays**.
  - The 13 exports remain "the right interface surface for the dive-in panel's downstream-impact view (Wave 7 scope)". Deleting now means re-vendoring later.
  - Roadmap P2.3 (`docs/_pending-roadmap/identity-and-analysis.md:61-70`) names the two paths: **(a) lazy** — rewrite to read `file_registry` + `connections`; **(b) sonic-aligned** — populate GraphNodes/GraphEdges in Pass-2.
  - The decision was deferred to a cross-cluster wave once PM-1 sonic timing was set. **T2 picks (a) — lazy.**
- **Wave 3B's path-generator wire-up (ticket 4)** intentionally did NOT use traversal: the signal-path-adapter walks `connections` directly via BFS — bypassing `computeImpactChain` because `GraphEdges` isn't populated. That adapter is the template for the T2 wrapper.

---

## 6. Existing tests

None. No file under `tests/` imports `features/graph/traversal` or invokes any of its exports. `find /home/user/st8/tests -name "*traversal*" -o -name "*graph*"` returns only `tests/frontend/graph-popup-a11y.test.js` (UI a11y, unrelated).

For T2 the new wrapper will need its own test file under `tests/features/graph/` (does not yet exist).

---

## 7. Contracts

### Input — `GraphNodes` (vendored, `src/core/database/graph-persister.js:123-131`)
```
node_id INTEGER PK
graph_id TEXT NOT NULL
node_type TEXT CHECK IN ('file','store','route','command','type','import','export','component')
name TEXT NOT NULL
path TEXT
metadata_json TEXT
created_at TEXT
```

### Input — `GraphEdges` (`src/core/database/graph-persister.js:133-143`)
```
edge_id INTEGER PK
graph_id TEXT NOT NULL
from_node_id INTEGER FK → GraphNodes.node_id
to_node_id   INTEGER FK → GraphNodes.node_id
edge_type TEXT CHECK IN ('depends_on','imports','exports','navigates_to',
                         'invokes','conflicts_with','contains')
status    TEXT CHECK IN ('SAFE','NEEDS_REWRITE','CONFLICT','MISSING')
confidence REAL DEFAULT 1.0
```

### Alternative input (lazy source) — `file_registry` + `connections` (`src/core/database/persistence.js:66-105`)
```
file_registry: fingerprint PK, filepath, filename, sha256Hash, status,
               reachabilityScore, impactRadius, lifecyclePhase,
               birthTimestamp, lastModified, ... (no graph_id)

connections:   id PK, sourceFingerprint FK, targetFingerprint FK,
               connectionType DEFAULT 'IMPORT',
               importSpecifier, isResolved, confidenceScore, lastVerified
```

Persistence API already exposes `getAllFiles()` (`src/core/database/persistence.js:563`) and `getAllConnections()` (`src/core/database/persistence.js:953`). `getConnectionsForFile(fingerprint)` (`src/core/database/persistence.js:937`) returns both sides.

### Output shapes
See §3. Note `BoundaryEdge` and `FileFlow` carry `status`/`confidence` that come from `GraphEdges` — in the lazy world only `confidence` (`connections.confidenceScore`) has a real source; `status` would always be `'SAFE'` (same defaulting that signal-path-adapter uses, `src/features/analysis/signal-path-adapter.js:108`).

### Semantic translation gap

The `connections.connectionType` enum is `'IMPORT'` by default (and currently only `'IMPORT'` is written). `GraphEdges.edge_type` is a seven-value enum. Mapping: `'IMPORT'` → `'imports'`. The other six (`depends_on`, `exports`, `navigates_to`, `invokes`, `conflicts_with`, `contains`) **have no source in st8.sqlite today**. For `findImportsOf` this is fine — only the `'imports'` edge type matters. For `getDirectoryBoundary` / `getDataFlowMetrics` the consumer would never see `MISSING` / `NEEDS_REWRITE` / `CONFLICT` status because those come from `relationship-analyzer.js`, which is itself dead (P2.1). So `errorFlows` / `warningFlows` / `ambiguityFlows` would always be empty in v1 — acceptable; deliver the structural metrics and document the integr8-status fields as null-able.

---

## 8. Change vector for T2 (option a — lazy)

### Concrete approach: **new wrapper module**, do NOT hand-edit the vendored `.js`

Recommended layout:

```
src/features/graph/
   traversal.js           ← vendored TS-compiled (untouched, kept for parity
                            with sonic-aligned future path)
   traversal-lazy.js      ← NEW: same 13-export public surface, but reads
                            from persistence.js instead of GraphNodes/GraphEdges
```

The `app.js` HTTP routes (`GET /api/graph/deps?nodeId=<fp>` and `GET /api/graph/impacts?nodeId=<fp>`) require `'../../features/graph/traversal-lazy'`. This:

- **Honors the vendored hand-off** in `graph-persister.js:1-14` — neither the upstream `.ts` nor the compiled `.js` is touched.
- Mirrors the proven `signal-path-adapter` pattern: a thin adapter module sits between the live persistence layer and a vendored algorithm (`src/features/analysis/signal-path-adapter.js:1-40` is the same shape).
- Keeps the door open for future sonic-aligned wiring (option b): when GraphNodes/GraphEdges actually get populated, `app.js` flips its `require` back to `traversal.js` and the wrapper deletes cleanly.

### v1 export priority (for the two new routes)

| Export | v1? | Why |
|---|---|---|
| `computeImpactChain` | **YES** | Backs `GET /api/graph/impacts?nodeId=<fp>` |
| `findConsumersOf` | **YES** | "Who imports me" — natural for `/api/graph/deps` (deps = reverse direction) OR the route is `findImportsOf`-style — caller's pick. |
| `findImportsOf` | **YES** | If `/api/graph/deps` means "what does THIS file import," this is the call. |
| `getFileFlows` | YES | Both inbound + outbound for one file; cheap to include — useful for dive-in. |
| `findOrphans` | YES (cheap) | Lazy version is one SQL scan; almost free. |
| `analyzeReachability` | YES | Already cached at the file level in `file_registry.reachabilityScore`; the dynamic recompute is the variant the dive-in panel will want. |
| `findPaths` | DEFER | BFS over the full graph is the expensive call; no caller asked for it yet. Stub returning `{paths:[], shortestPath:[]}` is acceptable v1. |
| `extractSubgraph` | DEFER | Used by integr8 visualization layer that isn't wired. |
| `getDirectorySubgraph` | DEFER | Useful for Wave 7 dive-in directory views — not yet a caller. |
| `getDirectoryBoundary` | DEFER | Same — degraded data (`status` always 'SAFE') would mislead. |
| `getDataFlowMetrics` | DEFER | Same. |
| `clearCache` | YES (no-op) | Trivial. |
| `ensureIndexes` | NO | `connections` already has `idx_connections_source` / `idx_connections_target` (`src/core/database/persistence.js:141-142`). No-op stub. |

**The two API routes** the T2 ticket calls out need only: `computeImpactChain`, `findImportsOf` (or `findConsumersOf`), plus a `nodeId`-resolver — see §10 question 2 below for the `<fp>` semantics.

### nodeId/fingerprint translation

- `GraphNodes.node_id` is an autoincremented integer; `name`/`path` are searched for the user-supplied id (`src/features/graph/traversal.js:268, 332, 384, 420, 485, 517-525`).
- In the lazy world, the natural stable id is the **fingerprint** (already the `file_registry` primary key, already what schema-cards reference). The route says `?nodeId=<fp>` which matches.
- The wrapper should:
  1. Accept either a fingerprint or a filepath; resolve filepath → newest fingerprint via `getFileByPath` (`src/core/database/persistence.js:589`).
  2. Return fingerprint strings everywhere the vendored returns `String(node_id)` — caller can hydrate to filepaths via `file_registry`.

### LOC estimate

- `traversal-lazy.js`: ~250-300 LOC. Two SQL queries (full `getAllFiles` + `getAllConnections`, dedup by newest birthTimestamp matching signal-path-adapter contract `src/features/analysis/signal-path-adapter.js:74-80`), build adjacency, six implemented functions + seven stubs.
- `app.js`: two new route cases + handlers, ~80 LOC (mirror the `/api/signal-path` case at `src/core/server/app.js:1468-1577`).
- `route-manifest.js`: two new entries, ~6 LOC.
- Tests: `tests/features/graph/traversal-lazy.test.js`, ~150 LOC.

Total: **~500-550 LOC, half-day** — matches the roadmap estimate at `docs/_pending-roadmap/identity-and-analysis.md:65`.

### Risks (signature compatibility with future Wave 7 dive-in consumers)

1. The vendored `findPaths(graphId, startNodeId, endNodeId, maxDepth, maxResults, db)` signature has `graphId` first. Lazy world has no `graphId`. Wrapper can either (a) keep `graphId` as a positional/ignored arg for shape-parity (preserves drop-in replacement if Wave 7 starts on the vendored module), or (b) drop it and break drop-in but cleaner. **Recommended (a)** — `graphId` accepted, ignored, defaulted to `'st8'`.
2. `node_id` vs fingerprint: vendored returns `String(node_id)` (integers). Lazy returns fingerprints (`<filepath>||<ISO>`). Future Wave 7 code written against the vendored shape would need to switch identifiers. Document loudly in the wrapper header.
3. `status` field always `'SAFE'` in v1. If Wave 7 builds UI that color-codes by `status` (`MISSING` red, `NEEDS_REWRITE` yellow), the lazy adapter's output will be monochrome until `relationship-analyzer.js` (roadmap P2.1) lands. Acceptable; document.

---

## 9. Provisions already made

- **`signal-path-adapter.js`** is the working reference for the lazy approach. It already builds a SemanticGraph from `file_registry` + `connections` with newest-birthTimestamp dedup and edge confidence carry-over (`src/features/analysis/signal-path-adapter.js:62-111`). Reuse its dedup logic verbatim.
- **`persistence.getAllConnections()`** (`src/core/database/persistence.js:953`) exists, returns every `connections` row. Used by force-check FC5 and by signal-path-adapter.
- **`persistence.getConnectionsForFile(fingerprint)`** (`src/core/database/persistence.js:937-939`) returns both inbound AND outbound for a single fingerprint — saves a full-table scan when only one file is queried.
- **`/api/signal-path` route at `src/core/server/app.js:1468-1577`** is the template for `/api/graph/deps` and `/api/graph/impacts`. Same `_handle…` method pattern, same error envelope.
- **Branch point for lazy-vs-sonic pivot:** the only `require` of the traversal module lives in `app.js`. Changing the import path is the entire pivot — wrapper-vs-vendored cost is one line. This is precisely why the wrapper approach beats hand-editing the vendored `.js`.

No existing wrapper attempts. Nothing in `src/features/graph/` other than `traversal.js` itself and `builder.js` (live, used by indexer).

---

## 10. Gaps + open questions

1. **Q: Does `GraphEdges.edge_type` semantically differ from `connections.connectionType` enough to require translation?**
   **A: Yes, but trivially.** st8 only writes `connectionType = 'IMPORT'` today; `GraphEdges.edge_type = 'imports'` is the one-to-one mirror. The other six `edge_type` values have **no source in st8.sqlite**. For v1 the wrapper hardcodes `edgeType: 'imports'`. If Wave 7 dive-in needs `navigates_to` / `invokes` semantics, that requires upstream signal (data-ingestion / sonic restoration) — orthogonal to T2.

2. **Q: What exactly is `<fp>` for `?nodeId=<fp>` — the full `filepath||ISO` fingerprint, the filepath alone, or a `node_id` integer?**
   The T2 ticket text says `nodeId=<fp>` which implies fingerprint. The vendored module accepts both `node.name` and `String(node.node_id)`. **Recommendation: accept either fingerprint or filepath; if filepath, resolve via `getFileByPath()` → newest fingerprint, mirroring schema-card-emitter dedup (Wave 3A ticket 9).** Document the URL-encoding gotcha — `||` survives `encodeURIComponent` but should be tested.

3. **Q: Should the route names match traversal's verbs (`/impacts`, `/deps`) or extend the existing `/api/signal-path` family?**
   The T2 spec is explicit: `/api/graph/deps` and `/api/graph/impacts`. The reviewer's residual concern #2 in the for-review JSON flagged that *if* a future wave picks lazy, the 13 export signatures change — that risk lives at the **module** layer; the **route** layer is new and consequence-free.

4. **Q: Multi-fingerprint deduplication — apply at the wrapper or in the route handler?**
   Apply in the wrapper to match the schema-card-emitter and signal-path-adapter dedup contract (newer birthTimestamp wins). Otherwise consumers of all three surfaces would see different "current" identities for the same path.

5. **Q: When P2.1 (`relationship-analyzer.js`) eventually lands, do `status` flows surface through the lazy wrapper or only through a sonic-aligned reboot?**
   Open. The relationship-analyzer writes to `MigrationPlans` in scaffolder_data.sqlite — a separate database. If it ever produces per-edge status that should colour st8's own files, it needs its own bridge into `connections` (perhaps a `connections.status` column added by P2.1). **Flag for the P2.1 ticket author.**

6. **Q: `clearCache` semantics in the wrapper?**
   The vendored module has a 5-graph LRU cache (`src/features/graph/traversal.js:66-101`) keyed by `graphId`. In the lazy world we can either (a) cache `getAllFiles + getAllConnections` per-request, no cross-request memo (simpler, the data changes on every indexer run anyway), or (b) attach a cache invalidation to the `INDEX_COMPLETE` hook. **Recommended (a) for v1.**

7. **Q: Does the `findExportsOf` mentioned in the userNote actually exist somewhere?**
   No. Searched. The 13 exports of `traversal.js` do not include `findExportsOf`. Closest is `findImportsOf`. Treating as a userNote typo — no action.

---

## Summary

T2 is a half-day wrapper module (`src/features/graph/traversal-lazy.js`, ~250-300 LOC) plus two `app.js` routes plus tests. The vendored TS-compiled `traversal.js` stays untouched per the `graph-persister.js` linguist-generated banner. Six of the 13 exports ship in v1 (impact + imports/consumers + flows + orphans + reachability + clearCache no-op); the seven directory-boundary and integr8-status-dependent exports are stubbed with documented "lazy-mode degraded" behaviour because their data sources (`relationship-analyzer.js`, integr8 status fields) are not yet wired. The `signal-path-adapter.js` shape is the proven template — its dedup-by-newest-birthTimestamp and confidence carry-over should be copied verbatim into the wrapper.
