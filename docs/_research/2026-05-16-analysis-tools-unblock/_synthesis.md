# Synthesis — analysis-tools-unblock-pass-1 research wave

**Wave:** analysis-tools-unblock-pass-1
**Date:** 2026-05-16
**Synthesizer mode:** read-only on source code; this is the sole deliverable.
**Inputs:** 15 research reports in this directory + a synthesizer-derived read of `src/core/database/persistence.js` (the 16th expected report was lost to a 30-minute harness timeout; that gap is filled in §3).

---

## 1. Executive summary

The wave's research is unusually high-fidelity: every one of the 15 landed reports cites file:line evidence and several ran live probes against the running server. The six-ticket proposal survives essentially intact in *intent* but needs concrete shape changes: **T1 must pick its non-stub input contract before launching** (Wave 3B's defer-confirmed verdict applies to (currentGraph, currentGraph)); **T2 is a wrapper module decision** (the vendored `traversal.js` cannot be hand-edited); **T3 reduces to a docs-vs-schema-move choice** (insights already persist, just in the wrong DB); **T4 is a docs-generator with a new drift test** (the existing CLAUDE.md API table is ~25% accurate vs the route-manifest's 33 entries); **T5 needs one new persistence method (`getFileByFingerprint`) and a `cardFilename` export decision**; **T6 has no app.js work — the audit conclusion is "wedge, if any, lives in signal-path-adapter, not app.js"**. The dominant headline shift is that **T1 and T6 are entangled with `signal-path-adapter.js`** — both reports recommend the same adjacency-index + scope-cap refactor of the adapter, which means T6 should ride into the same commit family as T1 rather than living as a standalone ticket.

---

## 2. Per-ticket reality check

### T1 — Wire `relationship-analyzer.js` end-to-end

#### Original framing
New adapter mirroring `signal-path-adapter`; build SemanticGraph from SQLite; register at INDEX_COMPLETE P=25; expose `POST /api/analyze-relationships`.

#### What the research reveals
- `src/features/analysis/relationship-analyzer.js` is 923 LOC of TS-compiled algorithm (Tarjan SCC, structural subtyping, breaking-change detection). Zero live consumers; the only `require()` is from the also-dead `src/features/integr8/index.js:51` (`relationship-analyzer.md` §4, §5).
- `analyzeRelationships(externalGraph, currentGraph, targetPages)` requires **two graphs**. st8 only has one at runtime. Wave 3B's ticket-3 defer-confirmed verdict (`identity-and-analysis.for-review.json:59`) frames `(currentGraph, currentGraph)` as a "stub disguised as a wire-up" — every match becomes trivially SAFE (`relationship-analyzer.md` §10 Q1; `default-subscribers.md` §10 Q1; `path-generator.md` §8.1; `signal-path-adapter.md` §8 last paragraph).
- A more-honest reformulation: call `computeTarjanSCC(currentGraph)` / `detectCyclesWithTarjan(currentGraph, uuid)` directly. Tarjan SCC on a single graph yields real cycle-detection signal; the file's `detectCyclesWithTarjan` (lines 890-923) is the pre-built wrapper for exactly this case (`relationship-analyzer.md` §9 "Cycle-detection convention").
- **P=25 slot is empty.** Priorities currently in use on INDEX_COMPLETE are 10, 20, 30, 35, 40, 50, 90 (`default-subscribers.md` §4, §9). Slot is exactly between schema-card-emitter (P=20) and gap-analyzer (P=30).
- **Test hard-pin:** `tests/core/hook-registry.test.js:390` and `:414` assert `INDEX_COMPLETE.count === 6`. Adding a P=25 subscriber forces a bump to 7 in both lines plus the comment block at 385–388 (`default-subscribers.md` §6, §10 Q2).
- Performance: same O(V·E) "scope-or-die" contract as path-generator. A relationship-adapter that calls `generateMigrationPath` on the full unifiedGraph will hit the same 7-minute hang the Wave 3B reviewer reproduced (`path-generator.md` §8.1 last paragraph).

#### Provisions already made
- `signal-path-adapter.js:62-152` (`buildSemanticGraphFromPersistence`) emits the exact SemanticGraph shape `analyzeRelationships` consumes (`signal-path-adapter.md` §8). Reuse verbatim or factor out into a shared `semantic-graph-bridge.js`.
- `persistence.getAllFiles()` (persistence.js:563), `getAllConnections()` (953), `getFileByPath()` (589) all exist and are used by the working adapter (`relationship-analyzer.md` §9).
- DRY+wrap subscriber convention is uniform in `default-subscribers.js` (lines 166-178 gap-analyzer is the canonical template; `default-subscribers.md` §7).
- `_handleSignalPath` (app.js:1483-1542) is the canonical request-scoped handler template (`app.md` §5.1, §8 T1).
- Roadmap P2.1 (`docs/_pending-roadmap/identity-and-analysis.md:49-54`) names the exact priority, route, and downstream consumer (gap-analyzer D5 connection-integrity).

#### Hidden dependencies / blockers
- **The stub-vs-real-input decision IS the ticket.** Two paths: (a) accept Wave 3B's defer reasoning, wire only `computeTarjanSCC` / `detectCyclesWithTarjan` and label honestly; (b) literally call `analyzeRelationships(currentGraph, currentGraph, targetPages)` and document that all matches are trivially SAFE. Recommend (a). Founder must confirm — this is a re-opening of a defer-confirmed verdict (`default-subscribers.md` §10 Q3).
- The roadmap says "before gap-analyzer at P=30 so D5 connection-integrity reads conflict signal." But gap-analyzer currently reads ONLY `.st8/schema-cards/*.json` — D5 wiring to read a new `.st8/relationships.json` would be an additional code change inside gap-analyzer (`relationship-analyzer.md` §10 Q3). Brief says "no extras per wave" — this argues for (i) write the output file in T1, defer the D5 reader to a follow-up, or (ii) merge into T1 with explicit scope expansion.
- Untested 923-LOC algorithm body. The subscriber's try/catch isolates failures, but silent wrong-answers on Tarjan / structural-subtyping cannot be caught by integration tests alone (`relationship-analyzer.md` §10 Q5).
- Stack overflow risk: recursive `strongConnect` on graphs >~10k nodes. Not a Wave-1 blocker for st8's 305-node self-introspection but flag for downstream consumers (`relationship-analyzer.md` §10 Q6).

#### Recommended adjustments
**Reshape: T1 → T1a + T1b.** Split:
- **T1a (this wave):** New `src/features/analysis/relationship-adapter.js` (~280 LOC) that calls `computeTarjanSCC(currentGraph)` + `detectCyclesWithTarjan` on the dedup'd-by-newest-birthTimestamp SemanticGraph; new `_handleAnalyzeRelationships` POST handler (~70 LOC); P=25 INDEX_COMPLETE subscriber writing `.st8/relationships.json`; bump `INDEX_COMPLETE.count === 6` → `=== 7` in two test lines; add manifest entry `/api/analyze-relationships`; new test `tests/features/analysis/relationship-adapter.test.js` (~200 LOC) including a synthetic-cycle probe.
- **T1b (next wave or deferred):** gap-analyzer D5 reads `.st8/relationships.json` and surfaces cycle-conflict count in the report. NOT in this wave's commit.

#### Estimated effort post-research
- **LOC delta:** +500-580 (adapter 280 + handler 70 + subscriber 25 + manifest 1 + tests 200 + hook-count fixes 4 + bumped assertions in default-subscribers comment 5).
- **Agent-hours:** 4-6h executor + 2h reviewer. Live-probe is mandatory ("does `[st8] Relationship analysis complete` show up in stdout after `/api/index`?").

#### Predicted false-positive completion
**Cheat watch:** "Adapter compiles + handler returns 200 OK with `unifiedGraph: currentGraph, conflicts: []`." This is the stub-disguised-as-wire-up Wave 3B already rejected. NO CHEATS bullet: **The 200 response MUST contain at least one entry in `conflicts[]` when run against a graph with a real cycle (the adapter's test fixture MUST include a synthetic 3-node cycle a→b→c→a, and the live probe MUST produce a non-empty conflicts array OR cite that st8's own graph is acyclic and `conflicts: []` is therefore honest).**

---

### T2 — Wire `graph/traversal.js` via the lazy path

#### Original framing
Rewrite `traversal.js` to read `file_registry`+`connections` directly. Expose `GET /api/graph/deps` and `/api/graph/impacts`.

#### What the research reveals
- `traversal.js` is 826-LOC `tsc`-emitted vendored output. `graph-persister.js`'s sibling banner (lines 11-14) declares hand-edits will be **silently clobbered** on next re-vendor (`traversal.md` §1; `graph-persister.md` §2). Same applies to `traversal.js`.
- 13 exports (NOT `findExportsOf` as the userNote claims — that name doesn't exist anywhere; the 13th is `getFileFlows`) (`traversal.md` §2, §10 Q7).
- Zero live consumers in `src/`, `tests/`, `scripts/` (`traversal.md` §4). Confirms Wave 3B reviewer's "defer-confirmed" finding.
- Vendored module reads `GraphNodes`/`GraphEdges` in `scaffolder_data.sqlite`. **Live probe (graph-persister.md §7.3): GraphNodes/GraphEdges TABLES DO NOT EXIST on this developer machine.** Only `FileInsightSlots` (300 rows) + `InsightRecords` (299 rows) live in that file. So every traversal call against the vendored DB path returns empty arrays today.
- Lazy approach is **rewrite to read from `file_registry` + `connections`** via persistence. The proven pattern is `signal-path-adapter.js` — which already does exactly this for the `path-generator` engine (`traversal.md` §4 final paragraph, §8 entire).

#### Provisions already made
- `signal-path-adapter.buildSemanticGraphFromPersistence()` (lines 62-152) — reusable verbatim. Dedup-by-newest-birthTimestamp + dangling-edge filter.
- `persistence.getAllConnections()` (953), `getConnectionsForFile(fingerprint)` (937), `getAllFiles()` (563), `getFileByPath(filepath)` (589) — all the lazy reads needed.
- `route-manifest.js` slot exists alongside the signal-path / generate-report / insights / identity-risk group (`route-manifest.md` §8 T2).
- `_handleInsights` (app.js:1645-1671) is the canonical thin-GET-with-query-param handler template (`app.md` §8 T2).

#### Hidden dependencies / blockers
- **Wrapper location open.** Options: `src/features/graph/traversal-lazy.js` (proximity) vs `src/features/analysis/graph-adapter.js` (mirror signal-path-adapter pattern). The `traversal.md` report recommends the former; `app.md` §10.3 calls it open. Founder ping; default: `src/features/graph/traversal-lazy.js`.
- **fingerprint-or-filepath nodeId.** Recommend accepting both and resolving filepath → newest fingerprint via `getFileByPath` (`traversal.md` §8 "nodeId/fingerprint translation").
- **Six of 13 exports ship in v1, seven stubbed.** v1: `computeImpactChain`, `findImportsOf`, `findConsumersOf`, `getFileFlows`, `findOrphans`, `analyzeReachability`, `clearCache`(no-op). Stubs: `findPaths`, `extractSubgraph`, `getDirectorySubgraph`, `getDirectoryBoundary`, `getDataFlowMetrics`, `ensureIndexes`(no-op). Stubs return well-shaped empty results with a `degraded: true` flag (`traversal.md` §8 export priority table).
- The `status` field in `BoundaryEdge`/`FileFlow` outputs will always be `'SAFE'` in v1 because `connections.connectionType` only carries `'IMPORT'` — `MISSING`/`NEEDS_REWRITE`/`CONFLICT` would have to come from a real relationship-analyzer (T1a output). Document as "lazy-mode degraded" (`traversal.md` §7 "Semantic translation gap", §10 Q5).
- **Drift-test param-name:** the drift test maps `(\d+)` → `:id` and any other capture → `:name`. Routes are flat `/api/graph/deps` and `/api/graph/impacts`, no path params — no drift-test friction (`route-manifest.md` §8 T2).

#### Recommended adjustments
**Keep-as-proposed, with shape pinned:**
1. NEW file `src/features/graph/traversal-lazy.js` (~280 LOC).
2. Two GET routes in `app.js`; two manifest entries; matching switch cases.
3. New test `tests/features/graph/traversal-lazy.test.js` (~150 LOC) covering the 6 v1 exports + the 7 stub-shape contracts.
4. Vendored `traversal.js` is untouched.

#### Estimated effort post-research
- **LOC delta:** +480-550 (lazy module 280 + 2 handlers 70 + 2 manifest entries 2 + tests 150 + switch cases 4).
- **Agent-hours:** 4-5h executor + 2h reviewer.

#### Predicted false-positive completion
**Cheat watch:** "Lazy module compiles, handler returns 200, but the wrapper just delegates to vendored `traversal.js` which queries empty `GraphNodes`/`GraphEdges` → result is empty regardless of input." NO CHEATS bullet: **`GET /api/graph/impacts?nodeId=<fingerprint-of-app.js>` on st8 itself MUST return at least one downstream-consumer fingerprint (e.g. `start.js`'s fingerprint), proven by curl probe in actionsTaken. Empty result is only acceptable if the live probe demonstrates the focal file genuinely has zero consumers in the indexed graph.**

---

### T3 — Reconcile insight-store persistence

#### Original framing
Pick one storage path, make survives-reboot the contract.

#### What the research reveals
- **Insights already survive reboot.** Live probe (`insight-store-populator.md` §7 "WHERE it writes — DEFINITIVE EVIDENCE"): 299 InsightRecords + 300 FileInsightSlots in `/root/.local/share/com.scaffolder.app/scaffolder_data.sqlite`. The meta-dogfood claim "in-memory only / lost on restart" is **factually wrong** (`insight-store.md` §5 "Note on the meta-dogfood claim"; `insight-store-populator.md` §7 "Why meta-dogfood missed it").
- **The real issue is cross-DB:** insights live in `scaffolder_data.sqlite` (shared with other maestro-scaffolder tooling, indexed by `projectId='st8'` only — cross-project pollution risk if any host runs another tool with the same project id). They are NOT covered by `EXPECTED_SCHEMA` / `introspectSchema` / `pruneFilesNotIn` cascade — st8's persistence invariants don't reach them (`insight-store.md` §5, §8 Option A2 pros).
- `insight-store.js` is compiled-from-TS (`linguist-generated=true`). Hand-edits will be clobbered. Same vendor contract as `traversal.js` and `graph-persister.js` (`insight-store.md` §1).
- Two paths: **Option A (relocate to st8.sqlite)** = ~150-LOC additions to `persistence.js` (CRUD methods + EXPECTED_SCHEMA entries + FK cascade); rewire `insight-store-populator.js` and `/api/insights` handler to use persistence directly; `insight-store.js` becomes dead. **Option B (declare cross-tool sharing intentional)** = docs-only fix; correct meta-dogfood; add CLAUDE.md bullet (`insight-store.md` §8; `insight-store-populator.md` §8).
- **Stale comment bug:** `default-subscribers.js:196` claims populator runs "after intent-seeding" but P=35 < P=40 means it runs **before**. Independent of A-vs-B (`default-subscribers.md` §8 T3; `insight-store-populator.md` §10 Q4).

#### Provisions already made
- `insight-store-populator.js` already uses `options.store` injection — test fixtures + Option-A rewire both ride on the same seam (`insight-store-populator.md` §9).
- `populator.context` already carries `fingerprint + sha256Hash` per insight — promoting fingerprint to a top-level `InsightRecords` column is one populator line + one schema line (`insight-store.md` §10 Q3). Synergy with T5 (see §4).
- `EXPECTED_SCHEMA` + `introspectSchema` infrastructure is the canonical extension point (persistence.js:336-374; my synthesizer-derived read, §3 below).

#### Hidden dependencies / blockers
- **Option A is a wave-spanning refactor.** Touches `persistence.js` (150 LOC additions including FK cascade + EXPECTED_SCHEMA), `insight-store-populator.js` (rewire), `app.js:1645-1671` (`_handleInsights` rewire), `tests/features/analysis/insight-store-populator.test.js` (still injects but injects a persistence-backed store), plus a new `tests/core/database/persistence.insights.test.js`. Effort: 6-8h executor + 3h reviewer.
- **Option B is docs-only + a 1-line comment fix.** Effort: 1-2h executor + 1h reviewer.
- **Cross-project pollution risk in `scaffolder_data.sqlite`** is real: two `st8` repos on one host silently merge. Only Option A eliminates it (`insight-store.md` §10 Q8).
- **Synergy with T5:** Option A + a `fingerprint` column on `InsightRecords` makes T5's bundle a single-query fetch instead of fingerprint→filepath→query (`insight-store.md` §10 Q3, §4 cross-ticket synergies below).

#### Recommended adjustments
**Founder choice (yellow-light).** The two options have different LOC deltas, different risk profiles, and different downstream synergies. Both are defensible. My recommendation matches the insight-store research: **Option A2** (relocate via new `persistence.js` methods, leave compiled-from-TS file alone). It unifies persistence invariants, eliminates cross-project pollution, enables T5's single-query bundle.

If founder picks A2: **also do the docstring fix at `default-subscribers.js:196`** (cosmetic, zero risk; the populator's actual dependency is on the indexer's Pass-2 graph build, not intent-seeder).

#### Estimated effort post-research
- **Option A2:** +250 LOC, 6-8h executor + 3h reviewer.
- **Option B:** +30 LOC docs, 1-2h executor + 1h reviewer.

#### Predicted false-positive completion
**Cheat watch (Option A):** "Insights tables added to `EXPECTED_SCHEMA`, but `pruneFilesNotIn` / `deleteFile` cascade NOT extended to insights — orphan rows accumulate on every reindex pass." NO CHEATS bullet: **Test fixture MUST verify that `pruneFilesNotIn` deletes orphan InsightRecords AND FileInsightSlots whose fingerprint no longer matches any `file_registry` row. Also: `introspectSchema()` MUST be live-probed and shown reporting zero drift after the new tables are added.**

---

### T4 — Wire route-manifest → CLAUDE.md + README API table generator + drift test

#### Original framing
Generator + drift test that keeps CLAUDE.md and README.md API tables in sync with `route-manifest.js`.

#### What the research reveals
- CLAUDE.md's "API surface" table at lines 102-118 lists **11 rows**; 3 are fictional (`/api/state`, `/api/manifests`, `/api/events` — none exist in `route-manifest.js`); the manifest has 22 routes the table omits (`CLAUDE-md.md` §3). Current accuracy: **~25%**.
- README.md's "API Endpoints" table at lines 188-200 lists **7 rows**; only 3 are actual API routes (the rest are static-asset routes); 26 manifest API routes are absent (`README-md.md` §3). Current accuracy: **~12%**.
- `route-manifest.js` is the source of truth (180 LOC, 33 entries — 30 flat + 3 parameterised). Header explicitly says "edit this file by hand … it is the source of truth; not auto-generated" (`route-manifest.md` §2, §7.3).
- Drift test at `tests/core/server/route-manifest-drift.test.js` (154 LOC, 4 sub-tests) is the canonical pattern. Mutation-probed by Wave 5G reviewer (`route-manifest-drift-test.md` §1, §2).
- **Three additional stale items in CLAUDE.md outside T4's scope** but worth flagging: "**207 passing**" (actual 451+), `app.js (2264 LOC)` (actual ~2364 with the post-Wave-5G additions), and the "Persistence invariants" wording about insight-store (which now needs reconciling with T3's decision). These should be Sub-T4.a/b/c follow-ups, NOT in T4's commit (`CLAUDE-md.md` §4, §8b).

#### Provisions already made
- `route-manifest.js` is Object.frozen and 33 entries (`route-manifest.md` §3).
- Description column already prose-ready (1-3 sentences each; mentions body-cap sizes) — generator can render verbatim (`route-manifest.md` §9).
- Drift-test extraction logic is regex + brace-counting; no AST dep (`route-manifest-drift-test.md` §3, §4).
- No pre-commit hook installed; drift caught at CI via `npm test` (`CLAUDE-md.md` §10 Q1).

#### Hidden dependencies / blockers
- **Row-shape harmonisation:** CLAUDE.md uses `Route | Method | Purpose | Auth`; README uses `Endpoint | Method | Description`. Pick one — recommend `Route | Method | Auth | Description` (matches manifest field order) (`CLAUDE-md.md` §8a row-shape; `README-md.md` §10 Q3).
- **README static assets** (`/`, `/*.js`, `/*.css`, `/*.ttf`) are not in the manifest. Relocate outside the sentinel region under a "Static assets" subheading — generator emits `/api/*` only (`README-md.md` §10 Q5).
- **Param-name lossy reverse-map** in drift test: `(\d+)` → `:id`, any other capture → `:name`. If T5's `/api/file-identity/<fingerprint>` is added in this wave, the manifest path must be `/api/file-identity/:name` (not `:fingerprint`) to satisfy the existing drift extractor (`route-manifest.md` §8 T5; `app.md` §10.2). This is a T5 concern, but T4's generator must handle whatever the manifest says verbatim.

#### Recommended adjustments
**Keep-as-proposed, with concrete shape:**
1. NEW `docs/generate-api-table.js` (~80 LOC) — sibling of `docs/generate-filemap.js`.
2. Sentinel blocks `<!-- BEGIN: route-manifest-table -->` / `<!-- END: route-manifest-table -->` inserted into both `CLAUDE.md` (around lines 104-116) and `README.md` (around lines 190-198).
3. NEW `tests/docs/api-table-drift.test.js` (~80 LOC) following the existing drift-test pattern.
4. npm script `docs:api-table` in `package.json`.

#### Estimated effort post-research
- **LOC delta:** +260-300 (generator 80 + sentinels in two docs ~6 + test 80 + npm script 1 + regenerated tables ~85).
- **Agent-hours:** 3-4h executor + 1.5h reviewer.

#### Predicted false-positive completion
**Cheat watch:** "Generator runs, drift test passes against today's manifest, but the test parses the WRONG region (sentinel boundaries off-by-one) or the assertion is loose enough that any non-empty region matches." NO CHEATS bullet: **The drift test MUST include a mutation probe in the executor's actionsTaken — temporarily add a fake manifest entry, observe the drift test fail in both docs, then revert. Generator output MUST be byte-identical to the in-doc region (use `assert.strictEqual` on trimmed strings, not regex/match).**

---

### T5 — Add `/api/file-identity/<fingerprint>` single-read bundle endpoint

#### Original framing
Single-read identity bundle endpoint.

#### What the research reveals
- **`getFileByFingerprint` does NOT exist on `St8Persistence` today** (synthesizer-derived; `grep` shows no method by that name). The closest existing lookups are `getFileByPath` (filepath-keyed, newest birthTimestamp wins) and `getAllFiles`. T5 needs a new method (`persistence.js` synthesizer findings §3 below).
- Existing reads available now: `getIntent(fingerprint)` (978), `getMutationLog(fingerprint, limit)` (1016), `getMutationCount(fingerprint)` (1023), `getLastMutation(fingerprint)` (1031), `getConnectionsForFile(fingerprint)` (937 — returns both inbound + outbound in one stmt).
- The bundle's `card` field comes from `.st8/schema-cards/<flat>.json`. Filename encoding lives at `emitter.js:210-212` (`/` and `\` → `_`, `.json` suffix). Currently informally private; `intent-seeder.js:601` reimplements the encoding inline — a pre-existing DRY violation (`emitter.md` §3, §10 Q2).
- Stale-fingerprint policy is undefined: if a caller queries an older fingerprint but the on-disk card belongs to a newer one (same path, different birthTimestamp), what response? Three options: `card: null` + `superseded_by`, return the newer card with comparison hint, or 410 Gone (`emitter.md` §10 Q1).
- Route-manifest drift test forces `path: '/api/file-identity/:name'` (not `:fingerprint`) until the extractor learns a new keyword (`route-manifest.md` §8 T5; `app.md` §10.2). Workaround: keep `:name` in the manifest path, explain "fingerprint" in the description column.
- Insertion location in `app.js`: regex match in the `default:` branch (lines 491-508), alongside `tickets/:id/claim` and `tickets/:id/resolve` (`app.md` §8 T5).

#### Provisions already made
- All sub-queries (intent, mutations, connections) already exist and are fingerprint-keyed (persistence.js synth findings §3).
- `emitter.js:210` encoding function is one require away from being importable (need to either export `cardFilename` standalone or instantiate `SchemaCardEmitter` just for the helper — emitter.md §8 recommends the former).
- `_handleTicketClaim` (app.js:2331-2392) is the canonical regex-matched-handler template; `_handleInsights` is the canonical thin-GET-with-query-param template.
- `getSharedPersistence()` (persistence.js:1559) is preferred for multi-query handlers — exactly T5's shape.
- 19-field card shape is canonical and sorted-keys-deterministic — T5 reads with `JSON.parse` and trusts (`emitter.md` §7).

#### Hidden dependencies / blockers
- **NEW persistence method:** `getFileByFingerprint(fingerprint)` — one prepared statement (`SELECT * FROM file_registry WHERE fingerprint = ?`). 5-10 LOC.
- **`cardFilename` export decision:** export module-level alongside `SchemaCardEmitter` class (cleanest), OR instantiate emitter just for `_cardFilename` (lazier). Recommend the export refactor as part of T5 — it kills the existing duplicate at `intent-seeder.js:601` simultaneously.
- **Stale-fingerprint policy** must be picked. Recommend: return whatever card matches the *requested* fingerprint exactly; if no card file exists or the on-disk card has a different fingerprint, return `card: null` plus a `cardStatus: 'missing' | 'superseded' | 'present'` discriminator. Founder ping.

#### Recommended adjustments
**Keep-as-proposed, with bundle shape pinned:**

```jsonc
{
  "ok": true,
  "fingerprint": "<requested>",
  "file": { /* file_registry row */ },
  "intent": { /* file_intent row or null */ },
  "card": { /* parsed .st8/schema-cards/<flat>.json or null */ },
  "cardStatus": "present" | "missing" | "superseded",
  "mutations": [ /* file_mutation_log rows, descending, limit 50 */ ],
  "connections": {
    "imports": [ /* connections WHERE sourceFingerprint=? */ ],
    "importedBy": [ /* connections WHERE targetFingerprint=? */ ]
  }
}
```

#### Estimated effort post-research
- **LOC delta:** +250-330 (new persistence method 10 + `getFileByFingerprint` test 30 + new `_handleFileIdentity` handler 80 + default-branch regex glue 6 + manifest entry 1 + `cardFilename` export + intent-seeder DRY-fix 15 + new `tests/core/server/api-file-identity.test.js` 150 + emitter test for `cardFilename` 20).
- **Agent-hours:** 4-5h executor + 2h reviewer.

#### Predicted false-positive completion
**Cheat watch:** "Bundle returns `ok: true` but every nested field is `null` because `getFileByFingerprint` returned undefined and the handler defaulted everything." NO CHEATS bullet: **Live curl probe in actionsTaken MUST hit an actual fingerprint of a real st8 file (e.g. fingerprint of `src/core/server/app.js`) AND the response MUST contain non-null `file`, non-null `card`, AND a non-empty `connections.imports` array (app.js has at least one import). If any of these three are null/empty for a live fingerprint, the handler is broken.**

---

### T6 — `/api/generate-report` payload audit

#### Original framing
Audit payload, route through adapter if it isn't already.

#### What the research reveals
- **The route already goes through signal-path-adapter.** `_handleGenerateReport` (app.js:1555-1635) calls `computeSignalPath` then synthesizes a minimal Integr8Output envelope for `generateMigrationReport` (`report-generator.md` §8 trace; `app.md` §8 T6; `signal-path-adapter.md` §4).
- **`report-generator.js` does zero graph traversal.** It treats `semanticGraph` as `(nodes.length, edges.length, properties)`. Cannot be the wedge cause (`report-generator.md` §7 "Critical finding").
- **The handler is clean.** POST-only, 4KB body cap, persistence open+close in finally, content-negotiates markdown/JSON, returns 404 on missing filepath. No change needed in `app.js` for T6 (`report-generator.md` §8 "Proposed minimal change"; `app.md` §8 T6).
- **The wedge, if real, lives in `signal-path-adapter.js`.** Two candidates: (a) unindexed BFS at lines 215-234 iterates `fullGraph.edges` per dequeue → O(scope · E); (b) `path-generator.computeParallelGroups` is O(V²) on cyclic-heavy scoped subgraphs (`report-generator.md` §8 candidates A/B/C; `signal-path-adapter.md` §8 T6 ranked candidates; `path-generator.md` §8.2 "Where is the wedge?").
- **Two surgical fixes proposed** by `report-generator.md` §8:
  1. Build `outAdj` + `inAdj` maps once in `buildSemanticGraphFromPersistence`; BFS uses `adj.get(cur)` instead of full-edge scan. O(V·E) → O(V+E).
  2. Hard-cap scoped-subgraph size (~100 nodes / 200 edges); return 413 `{ok:false, error:'scope too large; refine target'}` past the cap.
- **Discrepancy:** meta-dogfood claims a wedge; Wave 3B reviewer measured 22ms on `src/core/server/app.js` focal. The reproduction case is unclear (`report-generator.md` §10 Q1; `signal-path-adapter.md` §10 "Open questions").

#### Provisions already made
- The adapter is already the right code path; no T6 work needed in `app.js`.
- Scoping is already load-bearing (mutation probe #2 in Wave 3B hung past 60s when scoping disabled).
- Dedup + dangling-edge filter are reusable for T1 (the adapter is the canonical template for relationship-adapter).

#### Hidden dependencies / blockers
- **Same file as T1's potential refactor target.** If T1's adapter extracts a shared `semantic-graph-bridge.js` (helper for `buildSemanticGraphFromPersistence` + BFS scope + property recompute), T6's adjacency-index fix lives in the same module.
- **No wedge-reproducible test case from research.** Executor would need to either (a) find a focal file that wedges (try `src/core/server/app.js` against a larger codebase than st8 itself), or (b) declare the audit complete with "scoping is doing its job; wedge claim from meta-dogfood is stale" and document.

#### Recommended adjustments
**Reshape: T6 → T6-light (audit confirmation, no source edits) OR fold into T1.**
- **Option (i) — T6-light (recommended for this wave):** the audit deliverable is an `actionsTaken` paragraph confirming (a) the route already goes through the adapter (cite line numbers), (b) `report-generator.js` does no traversal, (c) the only wedge candidate is signal-path-adapter's unindexed BFS, (d) the post-Wave-3B 22ms live probe holds against st8's own graph. **No source edits in T6.** The two-line fix becomes a SEPARATE follow-up ticket "T6b — adjacency-index BFS in signal-path-adapter."
- **Option (ii) — Fold T6's optimization into T1:** when T1 builds its relationship-adapter and likely factors shared bridge code, the adjacency-index fix rides along. T1's commit family gets larger by ~30 LOC.

Recommend **Option (i)**. Keeps T1's scope tight; the optimization is a real ticket the founder can decide to schedule.

#### Estimated effort post-research
- **Option (i):** 1h executor (write the audit `actionsTaken`), 0.5h reviewer.
- **Option (ii) (folded):** +30 LOC inside T1's commit family, +1h executor.

#### Predicted false-positive completion
**Cheat watch (Option i):** "Audit says 'the wedge doesn't exist' without running a probe on a focal file with known fan-out, e.g. `src/core/server/app.js` (the highest-fan-in file in the repo)." NO CHEATS bullet: **The audit MUST include a live curl against `POST /api/generate-report` with `{"filepath":"src/core/server/app.js"}` and report wall-clock latency. If <100ms, audit confirms no wedge in current state. If ≥10s, T6-light is INVALID and T6 escalates to actually shipping the adjacency-index fix.**

---

## 3. Persistence.js findings (synthesizer-derived)

Directly inspected `src/core/database/persistence.js` (1589 LOC) — replacing the missing report.

### T2 (traversal-lazy): read methods for file_registry, connections, getFileByPath, newest-fingerprint pattern

- `getAllFiles()` at **persistence.js:563-572** — `SELECT * FROM file_registry ORDER BY filepath` + adds `isEntryPoint: Boolean(...)` coercion. Returns ALL rows (no dedup; multi-fingerprint per filepath possible).
- `getFileByPath(filepath)` at **persistence.js:589-594** — `SELECT * FROM file_registry WHERE filepath = ? ORDER BY birthTimestamp DESC` + `.get()` returns the **newest** row only. Multi-fingerprint dedup is encoded in the ORDER BY (lines 591-592). Doc-block at 574-588 explicitly calls out that "callers that need to operate on EVERY fingerprint for a path … must use getAllFilesByPath instead."
- `getAllFilesByPath(filepath)` at **persistence.js:605-610** — same SQL as above but `.all()`. Returns all rows newest-first.
- `getAllConnections()` at **persistence.js:953-958** — `SELECT * FROM connections ORDER BY sourceFingerprint, targetFingerprint`. Deterministic ordering matters for FC5.
- `getConnectionsForFile(fingerprint)` at **persistence.js:937-940** — single statement with `WHERE sourceFingerprint = ? OR targetFingerprint = ?`. **Returns BOTH inbound and outbound in one query.** For T5 the bundle needs the two halves split — either call twice with separate WHERE, or post-filter the result. Recommend two new prepared statements as part of T5.
- **Pattern for "newest-fingerprint-per-filepath":** the dedup is done OUTSIDE persistence (`signal-path-adapter.js:74-81` builds `Map<filepath, file>` and iterates `getAllFiles()` retaining newest-birthTimestamp). Persistence offers `getFileByPath` for single-file queries (uses ORDER BY in SQL) but `getAllFiles` returns the un-deduped set. T2's wrapper should reuse the adapter's dedup loop verbatim.

### T3 (insight persistence): EXPECTED_SCHEMA shape, file_intent CRUD mirror pattern, introspectSchema drift detection

- `EXPECTED_SCHEMA` constant at **persistence.js:336-374** — a frozen `Record<tableName, columnName[]>` keyed by the 10 owned tables. Each entry is a flat array of camelCase column names. Doc-block at 316-335 explains: drift detector runs `PRAGMA table_info` per table, diffs against this; missing tables/columns log `console.warn` lines under `[st8:persistence:drift]` (lines 433-442). Adding new insight tables means adding two new entries (e.g. `'FileInsightSlots'` and `'InsightRecords'`) with their full column lists.
- `introspectSchema()` at **persistence.js:474-530** — walks `sqlite_master` for actual tables, diffs against `EXPECTED_SCHEMA` keys, then for each shared table reads `PRAGMA table_info(<table>)` and diffs column names. Returns `{ hasDrift, missingTables, extraTables, missingColumns, extraColumns, report: string[] }`. Called once from `initialize()` at line 434. **Does not throw on drift — only logs.** A T3 Option-A migration must (a) add the two tables to `ST8_SCHEMA` (the DDL at top of the file) and (b) add them to `EXPECTED_SCHEMA`, otherwise drift reports "extra tables" silently on every boot.
- **`file_intent` CRUD as the mirror pattern** (lines 962-996):
  - `upsertIntent(intent)` (962-975): `INSERT OR REPLACE INTO file_intent (fingerprint, purpose, dependsOnBehavior, valueStatement, authoredBy, lastUpdated) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)`.
  - `getIntent(fingerprint)` (977-980): `SELECT * FROM file_intent WHERE fingerprint = ?` + `.get()`.
  - `getAllIntents()` (982-996): walks all rows, returns `Record<fingerprint, intent>`.
  - `deleteIntentForFile(fingerprint)` at **persistence.js:898** — used in the cascade. **`pruneFilesNotIn` (677-705) and `deleteFile` (627-659) both call this per-fingerprint inside a transaction.**
- **For new insight CRUD, mirror this pattern:** `upsertInsight`, `getInsightForFingerprint`, `getAllInsights`, `deleteInsightsForFile(fingerprint)`. Add the cascade call inside `deleteFile`'s per-fingerprint loop (lines 633-647) and `pruneFilesNotIn`'s per-fingerprint loop (synth: lines 680-700 area).
- **Foreign-key invariant:** `PRAGMA foreign_keys = ON` is set at **persistence.js:420**. New insight tables can declare `FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)` — but per the existing comment at 412-419, st8 does NOT use `ON DELETE CASCADE` declaratively; cascades are JS-side so mutation_log + activity_log can be written first. New insight cascade follows the same pattern.

### T5 (file-identity bundle): getters for file_registry row, file_intent, file_mutation_log, connections

- **`getFileByFingerprint(fingerprint)` DOES NOT EXIST.** `grep -n "getFileByFingerprint\|WHERE fingerprint = ?" persistence.js` — every fingerprint-keyed SELECT goes against a child table (intent/mutation_log/tickets), never `file_registry`. T5 must add this method:
  ```js
  getFileByFingerprint(fingerprint) {
    const stmt = this.db.prepare('SELECT * FROM file_registry WHERE fingerprint = ?');
    const row = stmt.get(fingerprint);
    if (!row) return undefined;
    return { ...row, isEntryPoint: Boolean(row.isEntryPoint) };
  }
  ```
  Place it adjacent to `getFileByPath` at ~line 595.
- `getIntent(fingerprint)` at **persistence.js:977-980** — direct fingerprint key. T5 uses verbatim.
- `getMutationLog(fingerprint, limit=50)` at **persistence.js:1016-1021** — DESC by timestamp. Suitable for the bundle's `mutations` field. Default limit of 50 matches the canonical limit elsewhere.
- `getMutationCount(fingerprint)` at **persistence.js:1023-1029** — for surfacing total count alongside the limited rows.
- `getLastMutation(fingerprint)` at **persistence.js:1031-1036** — for the card-style "last mutation" summary.
- `getConnectionsForFile(fingerprint)` at **persistence.js:937-940** — returns BOTH directions in one row-set. T5 must post-filter into `imports` (where `sourceFingerprint === fingerprint`) and `importedBy` (where `targetFingerprint === fingerprint`). Cleaner: add two new methods `getConnectionsFrom(fingerprint)` + `getConnectionsTo(fingerprint)` with single-direction WHERE clauses.
- `getSharedPersistence()` at **persistence.js:1559-1573** is the canonical multi-query handler accessor — T5's bundle does 5+ queries per request, so this is the right pattern (do NOT `.close()` the singleton).

**Effort delta on persistence.js for T5:** +20 LOC for `getFileByFingerprint` + `getConnectionsFrom` + `getConnectionsTo` + JSDoc. All trivial.

---

## 4. Cross-ticket synergies + sequencing constraints

### Synergies (where tickets unblock each other)

- **T3 + T5 (strong):** if T3 Option A2 lands, `InsightRecords` gains a `fingerprint` indexed column. T5's bundle then fetches insights via a single `WHERE fingerprint = ?` query instead of fingerprint→filepath→`getInsightsForFile`. Documented in `insight-store.md` §10 Q3.
- **T1 + T6 (strong):** both touch `signal-path-adapter.js`. T1 likely extracts shared graph-build logic; T6's adjacency-index fix lives in the same code. Co-locate.
- **T1 + T2 (medium):** both could share a `src/features/analysis/semantic-graph-bridge.js` helper (build graph, BFS-scope, property recompute). Extraction during T1 reduces T2's wrapper LOC by ~80. But YAGNI argues for keeping signal-path-adapter as the only consumer until T2 lands.
- **T5 + T1 (weak):** T5's `cardFilename` export refactor (kills `intent-seeder.js:601` duplicate) is independent but a natural pre-req for any code that needs to read cards. T1's relationship-adapter writes to `.st8/relationships.json` (NOT to `schema-cards/`), so no direct dependency.
- **T4 + (T1, T2, T5) (medium):** T4's generator runs on the post-T1/T2/T5 manifest. If T4 lands first, T1/T2/T5 each just add manifest entries and the generator regenerates the table on next run. If T4 lands last, executors must remember to update the hand-written tables AND the manifest — error-prone. **Strong sequencing preference: T4 before T1/T2/T5.**

### Hard sequencing constraints

- **None.** The 6 tickets are nearly independent at the source-code level. The only HARD coupling is `tests/core/hook-registry.test.js:390 (count === 6)` — T1 MUST bump that line in the same commit, otherwise the test fails.

### Soft sequencing preferences

1. **T4 first** (generator + sentinels in docs) — so subsequent T1/T2/T5 just add manifest rows and trust the table regenerates.
2. **T3 (Option A2 if chosen) second** — adds the `fingerprint` column to insights, which T5 then leverages.
3. **T1 third** — adds the P=25 subscriber. The hook-count assertion bump is in this commit. Co-locate with T6's audit deliverable (no source edits).
4. **T2 fourth** — wrapper module + two routes. Independent of T1's adapter shape.
5. **T5 fifth** — final endpoint; benefits from T3's `fingerprint` column.

---

## 5. Recommended wave shape

**Total tickets after research-driven adjustments:** **6 tickets** (kept the original count; reshaped T1 → T1a alone in this wave, deferred T1b to next wave; T6 reduced to audit-only).

**Wave count:** **2 sequential waves**, OR **1 wave with 2 sub-waves**.

### Wave 1 — Docs + Persistence Foundation (small, predictable)

Tickets: **T4**, **T3** (decision-gated).
- T4 lands first. Generator + drift test + sentinel insertion in CLAUDE.md + README.md.
- T3 lands second IF founder picks Option A2 (persistence schema change). If founder picks Option B (docs-only), T3 collapses into a small docs-only ticket that can ride alongside T4.

**Agents:** 1 executor + 1 reviewer per wave. T3 Option A2 may warrant a second reviewer pass for the persistence schema audit.

**Budget:** 8-12h executor + 4-6h reviewer total. Quiet wave.

### Wave 2 — Analysis Tools Wire-Up (the real work)

Tickets: **T1a**, **T2**, **T5**, **T6-light** (audit-only).
- T1a (relationship-adapter, INDEX_COMPLETE P=25, route, hook-count bump) — must include the live-probe-with-cycle assertion.
- T2 (`traversal-lazy.js` wrapper + 2 GET routes) — independent of T1a.
- T5 (`/api/file-identity/:name` + `getFileByFingerprint` + bundle handler + `cardFilename` DRY-fix).
- T6-light (one paragraph audit confirming the route already goes through the adapter + a wall-clock probe).

**Agents:** **Parallel executors viable** (T1a, T2, T5 touch mostly different files; only `app.js` is shared but in different regions). T6-light can be done by any executor in <1h.
- Option A: **3 parallel executors** (T1a, T2, T5) + 1 audit-only executor (T6-light) + 1 reviewer per executor.
- Option B: **1 executor sequential** (T1a → T2 → T5 → T6-light) + 1 reviewer.

**Recommend Option B** for first-pass: the three tickets share `app.js` real-estate and the route-manifest, so serial commits keep merge conflict risk near zero. Switch to parallel only after at least one executor has demonstrated the prompt template works end-to-end.

**Budget:** 14-18h executor + 7h reviewer. Solid full-day wave.

### Total wave budget

20-30 executor-hours + 11-13 reviewer-hours across both waves. Well within the cluster's recent cadence.

---

## 6. Cross-cluster flags (raise to founder)

1. **CLAUDE.md drift (Sub-T4.a/b/c):** "**207 passing**" is stale (actual 451+ per meta-dogfood baseline); `app.js (2264 LOC)` is stale (current ~2364 per `app.md` §1); persistence-invariants section's insight-store claim is content-drift vs T3 outcome. **Not in T4's commit.** File as three separate follow-up tickets after T4 lands the sentinels (`CLAUDE-md.md` §4, §8b).
2. **`hook-registry.test.js` asserts `INDEX_COMPLETE.count === 6`** (lines 390, 414) — T1a's executor MUST bump to 7 in the same commit (`default-subscribers.md` §6, §10 Q2).
3. **Two-DB design (st8.sqlite vs scaffolder_data.sqlite):** post-T3 Option A2, the `DatabasePersister.saveGraph` write side becomes near-unreachable (only `integr8/index.js --save-graph` CLI invokes it; no live route or hook subscriber). Founder pointer to a future "retire-or-keep" decision (`graph-persister.md` §10 Q3).
4. **Wave 3B's defer-confirmed verdict on identity-and-analysis ticket 3** (the relationship-analyzer "stub disguised as wire-up" concern). T1a re-opens it with the Tarjan-only reformulation. **Founder must signal: is the Tarjan reformulation acceptable as the "real wiring" Wave 3B was holding out for, OR is this a "decide retain-vs-retire" moment per Wave 3B reviewer flag #4?** (`relationship-analyzer.md` §10 Q1; `default-subscribers.md` §10 Q3).
5. **`_cardFilename` duplicated between `emitter.js:210` and `intent-seeder.js:601`** — pre-existing DRY violation. T5 has a natural reason to fix it by exporting `cardFilename` standalone (`emitter.md` §3, §10 Q2).
6. **Source-order vs runtime-order in `default-subscribers.js`:** insight-store-populator's register block at lines 193-224 sits between intent-seeder (181-191) and mutation-log-retention (243-266), but its P=35 priority runs it between gap-analyzer (P=30) and intent-seeder (P=40). The mismatch caused the docstring bug at line 196. Future-proof: move the source block to its priority slot. **Out of T3 strict scope; flag for a structural pass** (`default-subscribers.md` §10 Q4).
7. **No test asserts INDEX_COMPLETE run-order** — a `runOrder` snapshot test would have caught the docstring drift and would catch any future priority collision when T1a lands. Candidate follow-up ticket (`default-subscribers.md` §10 Q5).
8. **Cross-project pollution in `scaffolder_data.sqlite`:** 300 rows on this dev machine keyed only on `projectId='st8'`. Any other tool writing the same project_id silently merges. Only T3 Option A2 eliminates this (`insight-store.md` §10 Q8; `insight-store-populator.md` §10 Q5).

---

## 7. NO CHEATS bullets for the executor prompts

### Wave-level (all tickets)

- **Live probe is mandatory.** Every executor's `actionsTaken` MUST include a wall-clock-stamped curl probe against the live server. "It compiles" is not acceptance.
- **Hook-count tests:** if any ticket adds an INDEX_COMPLETE subscriber, `tests/core/hook-registry.test.js:390` and `:414` MUST be bumped in the same commit, AND the comment block at lines 385-388 MUST enumerate the new subscriber. The 6 → 7 bump is non-negotiable.
- **Route-manifest drift test is load-bearing.** Any new route in `app.js` MUST be matched by a `route-manifest.js` entry in the same commit. Mutation probe before commit: add a fake entry, watch `npm test` fail, remove, watch it pass.
- **Vendored files (`traversal.js`, `insight-store.js`, `path-generator.js`, `relationship-analyzer.js`, `report-generator.js`, `graph-persister.js`) MUST NOT be hand-edited.** All behavior changes happen via adapters/wrappers in non-vendored files. Reviewers will check the diff for unauthorized hand-edits.

### Per-ticket

- **T1a:** The 200 response MUST contain at least one entry in `conflicts[]` when run against a graph with a real cycle. The adapter's test fixture MUST include a synthetic 3-node cycle (a→b→c→a). Live probe MUST either produce a non-empty conflicts array OR explicitly cite that st8's own graph is acyclic and `conflicts: []` is therefore honest.
- **T2:** `GET /api/graph/impacts?nodeId=<fingerprint-of-app.js>` on st8 itself MUST return at least one downstream-consumer fingerprint, proven by curl in actionsTaken. Empty result is acceptable ONLY if the live probe demonstrates the focal file genuinely has zero consumers.
- **T3 (if Option A2):** Test fixture MUST verify `pruneFilesNotIn` deletes orphan `InsightRecords` AND `FileInsightSlots` rows. `introspectSchema()` MUST be live-probed and shown reporting zero drift after the new tables are added.
- **T4:** Drift test MUST be mutation-probed in the executor's actionsTaken — temporarily add a fake manifest entry, observe both doc drift tests fail, then revert. Generator output MUST be byte-identical to the in-doc region (use `assert.strictEqual` on trimmed strings).
- **T5:** Live curl probe MUST hit an actual fingerprint of a real st8 file (e.g. `src/core/server/app.js`'s fingerprint), AND the response MUST contain non-null `file`, non-null `card`, AND non-empty `connections.imports`. Any of these three null/empty for a live fingerprint = broken handler.
- **T6-light:** Audit MUST include a live `POST /api/generate-report` with `{"filepath":"src/core/server/app.js"}` and report wall-clock latency. <100ms = audit confirms no current wedge. ≥10s = T6-light is invalid and T6 escalates to actually shipping the adjacency-index fix.

---

## 8. Confidence assessment

### Per-ticket

- **T1a — yellow.** Research is sufficient for the executor IF the founder pre-confirms the Tarjan-only reformulation. Without that decision, the executor risks shipping the stub Wave 3B already rejected. **Founder pre-confirmation required before launching T1a's executor.**
- **T2 — green.** Research is excellent (the traversal report names exactly which 6 of 13 exports ship in v1 and which 7 are stubs). Executor can draft from the report verbatim.
- **T3 — yellow.** Research is excellent, but the Option-A-vs-B decision is founder-only. Once chosen, confidence flips to green.
- **T4 — green.** Research from both `CLAUDE-md.md` and `README-md.md` is detailed enough that an executor could draft the generator + sentinels from the existing material.
- **T5 — green.** Synthesizer-derived persistence findings confirm the missing piece (`getFileByFingerprint`) and the existing fingerprint-keyed reads. Bundle shape is pinned.
- **T6-light — green.** This is an audit deliverable, not a code change.

### Overall

**Yellow light.** Two founder-gated decisions (T1a Tarjan-vs-literal; T3 Option A vs B) block green. If the founder answers §9 questions 1 and 2 before deployment, the wave goes green.

---

## 9. Open questions for founder before deployment

1. **T1a: Tarjan-only reformulation acceptable, or insist on `analyzeRelationships(currentGraph, currentGraph)` literal call?** Wave 3B already defer-confirmed the literal call as a "stub disguised as a wire-up." Tarjan reformulation produces real signal but diverges from the literal text of the roadmap P2.1. (Recommended: Tarjan.)
2. **T3: Option A (relocate insights to st8.sqlite via persistence.js methods + introspectSchema drift coverage + FK cascade) OR Option B (docs-only, declare cross-tool sharing intentional)?** Both are honest; A unifies invariants, B is the smallest diff. Insights already survive reboot in `scaffolder_data.sqlite` (meta-dogfood was wrong on that point).
3. **T5: stale-fingerprint policy?** If a caller queries an older fingerprint but the on-disk card is the newer one (same filepath), return `card: null` + `cardStatus: 'superseded'`, OR return the newer card with comparison hints, OR 410 Gone? (Recommended: discriminator field `cardStatus: 'present' | 'missing' | 'superseded'`.)
4. **T2: wrapper module location?** `src/features/graph/traversal-lazy.js` (proximity to vendored sibling) OR `src/features/analysis/graph-adapter.js` (mirror signal-path-adapter pattern)? (Recommended: former.)
5. **T6: ship the adjacency-index BFS fix in this wave (folded into T1a or as standalone T6) OR defer to a follow-up after the audit confirms a real wedge exists?** Current research says wedge is unconfirmed against st8's own graph at 22ms. (Recommended: T6-light audit-only this wave; ship the fix when reproduced.)

---

**End of synthesis.** 15 research reports consumed + 1 synthesizer-derived persistence pass. No source-code edits made; this `_synthesis.md` is the sole deliverable.
