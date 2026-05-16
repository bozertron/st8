# Research Report — `src/features/analysis/relationship-analyzer.js`

Cluster: identity-and-analysis · Wave: analysis-tools-unblock-pass-1 · Ticket: T1
Output slug: `src_features_analysis_relationship-analyzer.md`
Author: research agent · Date: 2026-05-16

---

## 1. Identity

- **Path:** `/home/user/st8/src/features/analysis/relationship-analyzer.js`
- **LOC:** 923 lines (`wc -l` confirms; sourceMappingURL comment on line 924).
- **Last commit touching this file:** `86de1d6 refactor(integr8-core): migrate 5 integr8 modules; retarget manifest-gen` (per `git log --oneline -- src/features/analysis/relationship-analyzer.js`). That is the original move-in commit from `lib/commands/integr8/relationshipAnalyzer.js` (see `scripts/migration/manifest-history.jsonl:7` — batch `integr8-core` of the Aria migration). No subsequent commits.
- **Wave/batch tag:** batch `integr8-core` (May 14, 2026). Not touched in Waves 3A / 3B / 3C.

## 2. Stated intent

- **Header comment** (lines 1-3): `// src/commands/integr8/relationshipAnalyzer.ts // Stage 2: Relationship Analysis Engine` — origin pathname betrays the maestro-scaffolder-tool source.
- **JSDoc on `analyzeRelationships`** (lines 11-14): "Analyzes relationships between two SemanticGraphs (external project and current project). Identifies dependency matches, conflicts, and computes integration properties."
- **JSDoc on `computeTarjanSCC`** (lines 708-720): "Tarjan's SCC Algorithm — textbook-correct implementation. Identifies ALL strongly connected components in O(V+E) time via single DFS pass." Plus algorithm steps.
- **JSDoc on `analyzeStructuralSubtyping`** (lines 418-420): "I-13 Tier 3: Analyze structural subtyping between two function signatures. Implements TypeScript-style structural compatibility with variance analysis."
- **JSDoc on `detectBreakingChanges`** (lines 611-614): "I-13 Tier 3: Detect breaking changes between two module's public APIs. Compares all exports and identifies incompatible changes."
- **JSDoc on `detectCyclesWithTarjan`** (lines 886-889): "Convenience function: Runs Tarjan's SCC and integrates results with conflict detection. Returns cycle-related conflicts as ConflictResolution entries."
- **Cluster doc** (`docs/components/identity-and-analysis.md` lines 247-253): documents this file as one of the **dead analysis modules** — "Stage 2 of the integr8 pipeline … Wiring missing: no INDEX_COMPLETE subscriber, no API route. Designed as part of the integr8 pipeline that's been retired."

## 3. Public surface

**Five exports** (CommonJS, lines 5-9):

| Export | Signature | Notes |
|---|---|---|
| `analyzeRelationships(externalGraph, currentGraph, targetPages)` | `(SemanticGraph, SemanticGraph, string[]) → {unifiedGraph, conflicts, dependencyMap}` | Lines 15-97. Iterates `targetPages`, matches IMPORT nodes in external to EXPORT nodes in current, classifies SAFE/NEEDS_REWRITE/CONFLICT/MISSING. |
| `analyzeStructuralSubtyping(source, target)` | `(FunctionSignature, FunctionSignature) → {compatible, direction, paramCompatibility, returnTypeCompatible, breakingChanges}` | Lines 421-540. Contravariant param + covariant return-type checks. |
| `detectBreakingChanges(previousExports, currentExports)` | `(Node[], Node[]) → BreakingChange[]` | Lines 615-645. Walks export pairs by name, runs structural subtyping per pair. |
| `computeTarjanSCC(graph)` | `(SemanticGraph) → {components, condensationDAG, totalCycles, largestComponentSize, hasCycles}` | Lines 721-865. Textbook Tarjan over `graph.nodes`/`graph.edges`. Returns structured break-point + recommendation per component. |
| `detectCyclesWithTarjan(graph, generateConflictId)` | `(SemanticGraph, () → string) → {sccResult, conflicts}` | Lines 890-923. Wraps `computeTarjanSCC`, generates `ConflictType.CIRCULAR_DEPENDENCY` entries for each SCC of size > 1. |

**Imports** (line 10):
- `require("../../shared/types/integr8-types.js")` — supplies `NodeType` (FILE/IMPORT/EXPORT/COMPONENT), `EdgeType` (IMPORTS/DEPENDS_ON/CONFLICTS_WITH), `DependencyStatus` (SAFE/NEEDS_REWRITE/CONFLICT/MISSING), `ConflictType` (MISSING_DEPENDENCY/NAME_COLLISION/TYPE_MISMATCH/CIRCULAR_DEPENDENCY/...), `ResolutionStrategy` (IGNORE/RENAME/MERGE/OVERWRITE/CUSTOM). Confirmed live at `src/shared/types/integr8-types.js:14-74`.

No other module-level requires. No filesystem, no DB, no network. Pure function library.

## 4. Callers (grep-verified)

`grep -rn "relationship-analyzer\|relationshipAnalyzer\|analyzeRelationships\|computeTarjanSCC\|detectCyclesWithTarjan\|analyzeStructuralSubtyping\|detectBreakingChanges" src/ tests/ scripts/`

**Prod consumers (live src/):**
- `src/features/integr8/index.js:51` — `const relationshipAnalyzer_js_1 = require("../analysis/relationship-analyzer.js");`
- `src/features/integr8/index.js:80` — `(0, relationshipAnalyzer_js_1.analyzeRelationships)(externalGraph, currentGraph, args.targetPages);`

`src/features/integr8/index.js` itself has **zero live consumers** — verified twice (Wave 3B reviewer at `identity-and-analysis.review.md:177-180`; Wave 3B executor at ticket 3 actionsTaken in `.for-review.json:59`). Hits for `features/integr8/` outside that module are only for `integr8-types` (used by signal-path-adapter, indexer, etc.) and `toml-serializer` (used by manifest-generator).

**Tests:** none. `tests/features/analysis/` contains `gap-analyzer.test.js`, `insight-store-populator.test.js`, `intent-seeder-ordering.test.js`, `intent-seeder.test.js`, `signal-path-adapter.test.js`. No `relationship-analyzer.test.js`.

**Docs:**
- `docs/components/identity-and-analysis.md:247-253` — "dead analysis modules" entry.
- `docs/_pending-roadmap/identity-and-analysis.md:49-54` — P2.1 wire-up brief.
- `docs/_pending-tickets/identity-and-analysis.for-review.json` ticket 3 — defer-confirmed.
- `scripts/migration/results.stage-originals.json:135-139`, `scripts/migration/move-history.json:116-117`, `scripts/migration/manifest-history.jsonl:7`, `scripts/signal-tests/results.identity-delta.md:64`, `scripts/migration/results.gap-analysis.md:34` — all historical refactor artifacts, not consumers.

**Effective live consumers: zero.** The integr8/index.js → relationship-analyzer.js chain is dead-tree-of-one.

## 5. Prior work

- **Ticket 3** in `docs/_pending-tickets/identity-and-analysis.for-review.json` (line ~46) — `filepath: src/features/analysis/relationship-analyzer.js`, `severity: medium`, `status: deferred`, `executedBy: wave-3b-executor`, `verdict: defer-confirmed`, `commitHash: null`. The deferral rationale is the **core prior judgement**: wiring against `(currentGraph, currentGraph)` "would produce an analysis whose every dependency is trivially SAFE (self-match) — a stub disguised as a wire-up." The executor explicitly flagged this as the cheat the brief warned against.
- **Wave 3A review** (`identity-and-analysis.review.md:106-107`): "relationship-analyzer.js decision (ticket 3) is independent of 3A's surface area."
- **Wave 3B review cross-cluster flag #4** (`identity-and-analysis.review.md:220-223`): "integr8/index.js + integr8/migration-executor.js + relationship-analyzer.js share the same retain-or-retire fate. The executor correctly groups them. Whichever cluster handles cross-project ingest later should make all three decisions together, not piecemeal."
- **Wave 3B residualConcern** on ticket 3: "If Wave 3C decides to delete integr8/index.js, relationship-analyzer can ALSO be retired to OGB — they share the same wiring fate."
- **No TODO/FIXME markers** in the file body. The comments `// I-07 FIX`, `// I-07: TARJAN'S STRONGLY CONNECTED COMPONENTS`, `// I-13 TIER 3: STRUCTURAL SUBTYPING ENGINE` reference internal integr8-origin ticket numbers, not st8 work items.
- **Bible batches:** the file was moved in batch `integr8-core` (May 14, 2026, commit `86de1d6`). Listed as a "dead analysis module" in batch 025's deep-dive (per cluster doc section 9). No other batch touches it.

## 6. Existing tests

- **None for this file.** `tests/features/analysis/` contains five test files, none of which reference `relationship-analyzer`, `analyzeRelationships`, `computeTarjanSCC`, or any of its other exports.
- **Coverage gaps:** 100%. All five exports are untested. The Tarjan SCC algorithm (≈145 LOC), structural subtyping engine (≈120 LOC), breaking-change detector (≈30 LOC), main `analyzeRelationships` (≈80 LOC), and recursive cycle walker (≈110 LOC) are all uncovered.
- **Inherited TS-origin tests:** none vendored. The maestro-scaffolder-tool source presumably has TypeScript tests for these algorithms, but only the compiled `.js` was copied in (per `scripts/migration/manifest-history.jsonl` and CLAUDE.md's "compiled-from-TS modules" note).

## 7. Contracts the code relies on

**Input-shape invariants:**
- `SemanticGraph = { nodes: Node[], edges: Edge[], properties?: {...} }` — per `integr8-types.js` (NodeType/EdgeType enums) and `signal-path-adapter.js:62-152` (where st8 builds one).
- `Node = { id: string, type: NodeType, name: string, path?: string, metadata?: object }`. The analyzer reads `node.id`, `node.type` (must match `NodeType.FILE | COMPONENT | IMPORT | EXPORT`), `node.name`, `node.path`, `node.metadata.{signature, paramCount, paramTypes, returnType, typeParams, name}`.
- `Edge = { from: nodeId, to: nodeId, type: EdgeType }`. Reads `edge.from`, `edge.to`, `edge.type` (filters on `EdgeType.IMPORTS | DEPENDS_ON`).
- `targetPages: string[]` — page names or substring-matched paths used to locate FILE/COMPONENT nodes in `externalGraph` (`findPageNode` at lines 132-140).

**Pre-existing wiring invariants from cluster:**
- INDEX_COMPLETE subscriber priorities (`src/core/hooks/default-subscribers.js:69-180`): P=10 manifest-generator, P=20 schema-card-emitter, P=30 gap-analyzer, P=35 insight-store-populator, P=40 intent-seeder, P=90 force-checks. **P=25 slot is free** and lies between schema-card-emitter (P=20, populates `.st8/schema-cards/`) and gap-analyzer (P=30, reads cards) — the roadmap-specified slot for relationship-analyzer (`docs/_pending-roadmap/identity-and-analysis.md:51`).
- Persistence access pattern: handlers create per-request `new St8Persistence(); await persistence.initialize(); ... persistence.close()` (see `app.js:1486-1510` for `_handleSignalPath`). Subscribers receive `ctx.persistence` from the registry.
- `registerDefaultSubscribers` idempotency: symbol-flag short-circuit at `default-subscribers.js:74-79` — re-registration is a no-op unless `registry.clear()` is called.
- `signal-path-adapter.buildSemanticGraphFromPersistence` (lines 62-152) is the **template pattern** the ticket calls out: dedup multi-fingerprint by newest birthTimestamp, filter dangling edges, compute reachability/stability/fragility, return `{nodes, edges, properties}`.

**Internal algorithmic invariants:**
- `findMatchingExport` (lines 144-156) — exact-path-match before name-match (`exactPathMatch: true|false`).
- `classifyDependency` (lines 160-172) — order: MISSING (no match) → CONFLICT (signature mismatch) → SAFE (exact path) → NEEDS_REWRITE (name only).
- `computeTarjanSCC` (lines 721-865) — uses recursive `strongConnect` DFS. **Will stack-overflow on graphs deeper than Node's default ~10k call-stack** (no iterative variant). A 305-file project should be fine; a 50k-file monorepo would not be.
- Multi-step cycle walker (lines 265-307) is heuristic and bounded by `visited.has(currentPath)` termination; cycle reporting requires `cycleNodes.length > 2`. Tarjan SCC is the textbook-correct alternative.

## 8. Change vector for T1

**Goal:** Build `src/features/analysis/relationship-adapter.js` mirroring `signal-path-adapter.js`. Wire as INDEX_COMPLETE P=25 subscriber. Expose at `POST /api/analyze-relationships`. Live-probe.

**Function-level changes (NEW file `relationship-adapter.js`):**

Mirror the `signal-path-adapter.js` shape (338 LOC template). Estimate ~250-320 LOC.

1. `buildSemanticGraphFromPersistence(persistence)` — **reuse signal-path-adapter's** verbatim, OR import it and re-export. Same dedup + edge-filter rules.
2. `analyzeProjectRelationships({persistence, targetPages, targetDir})` (the new core):
   - Build one SemanticGraph from st8's own persistence (single `currentGraph`).
   - Resolve `targetPages` defaults: if none provided, derive from file_registry rows with `status='YELLOW' OR 'RED'` (the "interesting" focal files) or default to top-N by impactRadius. **This is the open design question** (see §10).
   - Call `analyzeRelationships(currentGraph, currentGraph, targetPages)` — **but this is the cheat ticket 3 flagged.** All matches will be exact-path-match → universally SAFE. The interesting signal would come from `computeTarjanSCC(currentGraph)` (real cycle detection on internal connections) plus `detectBreakingChanges(prevSnapshot, currExports)` (real if we persist a previous snapshot).
   - **Reformulation suggestion**: invoke `computeTarjanSCC(currentGraph)` as the load-bearing analysis. Optionally invoke `detectCyclesWithTarjan(currentGraph, () => uuid())` to get `ConflictResolution[]`. Return `{unifiedGraph: currentGraph, conflicts, reachability: currentGraph.properties.reachability}` — matches the ticket's literal return-shape requirement (`{unifiedGraph, conflicts, reachability}`) without wire-against-self stub.
   - Per ticket: "feeds it to `analyzeRelationships()`" — strict reading requires that exact call. The strict reading is the cheat. The synthesizer needs to decide.

3. Export `analyzeProjectRelationships` (and optionally re-export `buildSemanticGraphFromPersistence`).

**Function-level changes (`src/core/hooks/default-subscribers.js`):**

Add new `registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => { ... }, { priority: 25, source: 'relationship-analyzer' })` block between the existing P=20 (schema-card-emitter, ~line 154) and P=30 (gap-analyzer, ~line 166). Pattern matches the gap-analyzer block at lines 164-178. Output target: `.st8/relationships.json` (or `relationships.md`). LOC delta: +15-25 lines.

**Function-level changes (`src/core/server/app.js`):**

1. Dispatcher: add `case '/api/analyze-relationships': this._handleAnalyzeRelationships(req, res, url); break;` near line 473 (alongside `/api/signal-path`).
2. Handler `_handleAnalyzeRelationships` modelled on `_handleSignalPath` (lines 1483-1543, ≈60 LOC). Accepts GET `?targetPages=foo,bar` or POST `{targetPages}`. LOC delta: +60-80 lines.

**Tests (`tests/features/analysis/relationship-adapter.test.js`):**

Mirror `signal-path-adapter.test.js` structure (≈220 LOC). Probes:
- `analyzeProjectRelationships`: stub persistence with synthetic file_registry+connections that include a real cycle (a→b→c→a) → assert `conflicts[0].type === CIRCULAR_DEPENDENCY` and `conflicts[0].details.cycleType === 'tarjan-scc'`.
- Returns `{unifiedGraph, conflicts, reachability}` shape.
- Handles empty registry gracefully.
- Multi-fingerprint dedup honored (newest wins, matches signal-path-adapter dedup test at lines ~50-80).
- Live probe section in actionsTaken (per the "Live probe required" requirement in T1 brief).

**LOC delta total estimate:** +400 to +500 lines (250 adapter + 60 handler + 220 test + 25 subscriber).

**Risks:**
1. **The stub-disguised-as-wire-up risk** (ticket 3's defer reason). `analyzeRelationships(currentGraph, currentGraph, ...)` is degenerate. The Tarjan-only reformulation avoids this but technically diverges from "feeds it to `analyzeRelationships()`."
2. **Recursive `strongConnect` stack overflow** on very deep dep chains. st8's own 305-node graph is safe; future deep monorepos are not. Wave-1 not on critical path.
3. **P=25 ordering invariant.** Gap-analyzer (P=30) currently reads ONLY `.st8/schema-cards/*.json`, not relationship output. To "feed conflict signal into D5," the gap-analyzer would also need a modification — that may be out of scope per "no extras per wave." The ticket says "before gap-analyzer at P=30 so conflict signal feeds into D5 connection integrity" but the wiring of D5 to read this output is a downstream task. Verify.
4. **No upstream tests** — the file is 923 LOC of unverified algorithm. Wiring it live without test coverage on the algorithm itself is a stability risk. The new adapter test would only cover the adapter, not the underlying Tarjan correctness.
5. **`targetPages` semantics for self-introspection** — undefined; see §10.

## 9. Provisions already made

- **Extension points:** the file is dependency-free (one require) and pure-functional. Easy to wire because there are no DB or fs side effects to plumb. Pure-input, pure-output design.
- **Companion graph builder ready:** `signal-path-adapter.buildSemanticGraphFromPersistence()` (lines 62-152) already produces a SemanticGraph in the exact shape `analyzeRelationships` and `computeTarjanSCC` expect. Re-use, do not re-derive.
- **Type contract reuse:** `integr8-types.js` is already loaded by `signal-path-adapter.js` (line 44-48). No new shared type work needed.
- **Free P=25 slot in the subscriber chain.** Confirmed by reading `default-subscribers.js:154-180` — schema-card-emitter (P=20) and gap-analyzer (P=30) bracket the slot.
- **Roadmap-anchored TODO:** `docs/_pending-roadmap/identity-and-analysis.md:49-54` (P2.1) names the exact priority (P=25), exact route (`POST /api/analyze-relationships`), and exact decision-space ("integrate the conflict signal into D5"). This research wave is unblocking P2.1.
- **Conflict-signal output target:** `gap-analyzer.js` D5 (Connection Integrity) is the named downstream consumer per roadmap. Cluster doc section 6 confirms D5 reads cards from `.st8/schema-cards/` — adding a `relationships.json` reader is a one-method add.
- **Cycle-detection convention:** `detectCyclesWithTarjan(graph, generateConflictId)` (lines 890-923) is the pre-built wrapper for this exact wire-up — the adapter can call it directly and get back `{sccResult, conflicts}` without invoking the broken-by-self-input `analyzeRelationships`.
- **`getAllConnections()` + `getAllFiles()` + `getFileByPath()` on `St8Persistence`** confirmed live at `src/core/database/persistence.js:563/589/953`. Identical to what signal-path-adapter already uses.

## 10. Gaps + open questions for the synthesizer

1. **Wire-against-self vs Tarjan-only.** The strict ticket text says "feeds it to `analyzeRelationships()`" but Wave 3B's defer-confirmed reasoning is that this is a stub. Two viable resolutions:
   (a) Implement `analyzeRelationships(currentGraph, currentGraph, targetPages)` literally — all matches SAFE, conflicts limited to internal CIRCULAR_DEPENDENCY signal. Honest if labeled.
   (b) Substitute `computeTarjanSCC` / `detectCyclesWithTarjan` as the core call. Yields real signal but diverges from literal ticket text.
   The synthesizer must pick. Recommendation: (b) plus documentation, with `analyzeRelationships` retained for the future cross-project case (preserves the file's value for the founder's stated end-state vision).

2. **`targetPages` semantics for single-project mode.** The function signature requires `targetPages: string[]`. For self-introspection there's no obvious "page" set. Candidates: (a) all RED+YELLOW files, (b) all entry-point files (per `file_registry.isEntryPoint`), (c) the request body's explicit list, (d) all files (every node). Wave 3B's signal-path-adapter solved an adjacent problem by taking a single `targetFilepath` argument. Same shape would let the route be `POST /api/analyze-relationships {targetPages?: string[]}` with sensible default.

3. **Does gap-analyzer D5 need a same-wave change, or is the conflict signal output to a separate file?** Ticket says "conflict signal feeds into D5 connection integrity" but "no extras per wave." Possible interpretations: (a) wire only the adapter + route + subscriber; D5 wiring is a follow-up ticket; (b) the conflict-output file is written, and D5 picks it up in a later wave; (c) D5 is patched here. (a) or (b) appears intended given the no-extras rule, but the synthesizer should confirm whether writing to `.st8/relationships.json` (or a similar artifact) is part of T1 or just the adapter+route+subscriber. Cluster doc section 6 implies gap-analyzer reads `.st8/schema-cards/`, not arbitrary `.st8/*.json` — so D5 reading new artifact would require a code change.

4. **Integr8/index.js retain-or-retire fate (cross-cluster flag #4).** Wave 3B reviewer noted relationship-analyzer "shares the same retain-or-retire fate" with `integr8/index.js` + `migration-executor.js`. T1 wires the adapter; should integr8/index.js be cleaned up at the same time, or left as a parallel-but-dead consumer? Out of T1 scope strictly, but worth noting.

5. **No upstream tests for the 923 LOC of algorithm.** Tarjan SCC + structural subtyping + breaking-change detection have zero coverage in this repo. Wiring them live without a test pass is a stability risk for INDEX_COMPLETE (P=25 runs before gap-analyzer; a crash here would surface in `.st8/gap-analysis.md` failing too). Wrapping the subscriber body in try/catch per the cluster convention (`default-subscribers.js:164-178` pattern) is mandatory, but won't catch silent wrong-answers from untested algorithms.

6. **Stack-overflow risk on deep graphs.** `strongConnect` is recursive; Node's default stack handles ~10k depth. st8's own 305-node graph is safe; consumers who run st8 against very deep monorepos are not. Not a Wave-1 blocker but worth flagging.

7. **Performance of full-graph analyzeRelationships.** Per Wave 3B mutation probe #2 (`identity-and-analysis.review.md:128-132`), running path-generator's surrounding O(V*E) passes on the full 305-node st8 graph hangs past 60s. The adapter pre-scopes for signal-path; would a similar scoping strategy apply here? Tarjan SCC is O(V+E), so global is fine. But if `analyzeRelationships` is called literally on the full graph (option 1a above), the same performance cliff may apply. Synthesizer should bound-test against st8 itself.
