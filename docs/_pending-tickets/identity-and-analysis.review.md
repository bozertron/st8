# Identity-and-Analysis Review

## Wave 3A Review

Reviewer audited 7 tickets executed by `wave-3a-executor`: [0, 1, 9, 10,
11, 15, 16]. All 7 verdicts: **ack**.

### Test-suite verification
- `npm test` → tests:175 / suites:0 / pass:175 / fail:0 / cancelled:0 /
  skipped:0 / todo:0 / duration ~2.4s. Confirms the executor's
  108 → 175 claim.
- Mutation probe: replaced the multi-fingerprint dedup block in
  `src/features/schema-cards/emitter.js` with a passthrough; reran
  `node --test tests/features/schema-cards/emitter-prune.test.js` →
  6 pass / 2 fail (both MULTI-FINGERPRINT probes failed in BOTH row
  orderings — exactly the bug claim). Restored the file. The test
  genuinely guards the bug, not a coincidence of iteration order.

### Live identity-preservation probe (ticket 15)
Manual reproduction with `St8Persistence` real instance + `fs.writeFile`
+ `fs.utimes`:
- PASS1 origin `stat-birthtime` → birthTimestamp recorded.
- File mutated; mtime advanced to 2027-01-01 via `utimesSync`.
- PASS2 origin `reused-persisted` → birthTimestamp UNCHANGED.
- `FP1 === FP2` → **true**. Identity preserved across mtime move.

### Live multi-fingerprint card-clobber probe (ticket 9)
Manual probe with two registry rows for `app.js` (2020 + 2027
birthTimestamps), tested in BOTH orderings:
- Original order `[older, newer]` → card on disk carries `sha-NEW` /
  `birthTimestamp=2027-01-01`. emitted=1, pruned=0.
- Reversed order `[newer, older]` → identical result, `sha-NEW`.
Newer wins regardless of input order. Confirmed.

### Cheats considered and dismissed
- **"persistence reuse only tested when persistence is brand-new"** — the
  birth-timestamp.test.js end-to-end probe uses a stub persistence (fake
  `getFileByPath`), not a real `St8Persistence`. This was the executor's
  declared shape and is acceptable: the unit-test scope is the helper's
  contract, not the SQLite layer. My live probe above used a real
  `St8Persistence` and the contract held end-to-end.
- **"single-read spy is incorrectly scoped"** — the test in
  `tests/features/analysis/intent-seeder.test.js:59` filters reads by
  exact absolute target path (`reads.filter((p) => p === target)`), so
  it counts ONLY reads of the file under test, ignoring schema-card
  JSON reads or other ambient fs.readFileSync traffic. Correctly scoped.
- **"multi-fingerprint test hides the bug via iteration order"** — the
  test file contains TWO probes (`MULTI-FINGERPRINT — two registry rows`
  and `MULTI-FINGERPRINT — reverse order`). Mutation probe confirmed
  BOTH fail when dedup is removed. Not order-coincidental.
- **"isUnreliableBirthtime misses real cases"** — cutoff is 1980-01-01.
  Covers epoch + pre-1980 FUSE sentinels. tmpfs/overlayfs/Docker volumes
  on modern kernels record real birthtime > 2020 → unaffected. The
  failure mode "tmpfs returns current time as birthtime" is harmless
  (real timestamp wins, no fallback). Heuristic is sound for the
  current node version.
- **"identity-risk.json is an unwired stub"** — TRUE in the strict
  sense: `grep -rn 'identity-risk' src/` finds writes in indexer.js
  but no readers anywhere. The executor's residualConcerns flag the
  write path's robustness (concern #3) but do NOT explicitly call it
  out as an unconsumed artifact. Logging this in the reviewNote.
  Not a kickback — the console.warn line IS the live introspection
  surface today; the JSON file is a forward-compatible extension
  point. Wave 3B/3C should wire a consumer.

### Cross-cluster flags worth founder attention
1. **Historical multi-fingerprint stale rows** in the live st8.sqlite
   (flagged by FC3 force-check; called out in tickets 9 + 15
   residualConcerns). Wave 3A's fixes prevent NEW drift; they do NOT
   clean existing accumulation. Requires either (a) a per-fingerprint
   `pruneFilesNotIn` variant in persistence or (b) a one-off cleanup
   migration. Should be a lifecycle-and-eventing ticket.
2. **`.st8/identity-risk.json` has no reader.** Future Wave 3B or 3C
   should wire it into force-checks or the gap-analyzer surface, or
   the executor's claim "consumed by introspection tools / force-
   checks" remains aspirational. Flagged here for the cluster's final
   reviewer.
3. **Parser files (ticket 10) + ast-parser.js (ticket 11) are compiled-
   from-TS artifacts.** New JSDoc headers are at risk of being
   overwritten if upstream maestro-scaffolder-tool re-vendors. The
   executor's recommendation to mark these as `linguist-generated=true`
   in `.gitattributes` (and to document the vendor-out recipe) should
   be acted on by whichever cluster owns vendor hygiene.
4. **`start.js` runs the backend with `cwd: __dirname`** (the st8
   install dir) regardless of the target arg. Schema cards, manifests,
   and `.st8/identity-risk.json` therefore land in /home/user/st8 not
   the target directory when invoked via start.js. This is pre-3A and
   out of scope for this audit, but observed during manual probes and
   worth surfacing.

### Safe for Wave 3B?
**Yes.** The identity contract is intact:
- birthTimestamp reuse works against a real persistence instance.
- Multi-fingerprint card emission is deterministic (newest wins).
- Single-read consolidation is properly scoped.
- Data-ingestion validators are present and tested.
- FILENAME_PURPOSE_MAP ordering is locked by a regression test.

Wave 3B can build on this foundation. Specifically:
- `path-generator.js` wiring (FOUNDER PRIORITY #1, ticket 4) can rely
  on stable fingerprints surviving across runs — the
  mutation_log / intent / connections graph is no longer at risk of
  silent drift.
- `insight-store.js` wiring (ticket 8) can use fingerprint as a stable
  primary key without ad-hoc reconciliation.
- `relationship-analyzer.js` decision (ticket 3) is independent of
  3A's surface area.

No source-code changes needed before 3B starts.

---

## Wave 3B Review

Reviewer audited 5 tickets executed by `wave-3b-executor`: [3, 4, 5, 6, 7].
Verdicts: **2 ack + 1 ack + 2 defer-confirmed** = 3 ack, 0 kickback,
2 defer-confirmed. No cheats found.

### Test-suite verification
- `npm test` → tests:192 / suites:0 / pass:192 / fail:0 / cancelled:0 /
  skipped:0 / todo:0 / duration ~2.4s. Confirms the executor's
  175 → 192 claim (17 new tests: 10 in signal-path-adapter, 7 in
  insight-store-populator).
- Mutation probe #1: replaced `reachability: scopedReachability` with
  `fullGraph.properties.reachability` in signal-path-adapter.js. Test
  "computeSignalPath: graph properties recomputed for scoped subgraph"
  failed (expected 0.6<reach<0.7, got project-wide 0.5). Restored.
- Mutation probe #2: forced `scopedNodes = fullGraph.nodes` and
  `scopedEdges = fullGraph.edges`. Restarted server. Live probe of
  `/api/signal-path?filepath=src/core/server/app.js` against the
  full 305-node graph **hung past 60s timeout (exit 124)** — confirms
  the executor's "7+ minutes on 317 nodes" claim. Restored.

### Live probe — FOUNDER PRIORITY #1 (`/api/signal-path`)
Against /home/user/st8 itself (305 file_registry rows, 308 connections):
- GET `?filepath=src/core/server/app.js` → ok=true, outcome=PARTIAL,
  6 orderedFiles, 5 upstream, scoped reachability 0.833, **22ms**.
  Chain: safe-fs.js → st8-types.js.txt → pathGenerator.js.txt →
  auth.js → bruno-oscar.js → app.js.
- POST `{filepath:"src/core/database/persistence.js"}` → ok=true,
  3 orderedFiles, 2 upstream.
- GET `?filepath=README.md` (no edges) → ok=true, outcome=FAILURE,
  orderedFiles=[README.md], **graceful** (no crash, no stub).
- GET `?filepath=does/not/exist.js` → HTTP 404 with clear error.
- GET `?filepath=start.js` (top-level config) → ok=true, 4 orderedFiles,
  3 upstream, totalNodes=4 (small subgraph correctly scoped).

### Live probe — `/api/generate-report`
- POST + `Accept: text/markdown` for indexer.js → 80-line markdown
  report with real metrics (Reachability 75%, Stability 98.4%, plan UUID,
  5 migration steps with real source paths). NOT a stub.
- POST + `Accept: application/json` → `{ok, report, pathSummary}`
  envelope, report length >200 chars.

### Live probe — `/api/insights`
- Summary: `categorySummary={orphan:237, under-connected:67}`,
  50-row recent feed.
- Per-file (`?filepath=src/core/server/app.js`) → one under-connected
  insight with real evidence (`status=YELLOW, reachabilityScore=0.1`)
  + fingerprint+sha256Hash context.
- Per-file (nonexistent) → ok=true, count=0 (no 500).
- Indexer log confirms P=35 subscriber firing:
  `[st8] Insight store: 304 insights across 305 files (errors=237, warnings=67, info=0)`.

### Roadmap pointer verification (deferrals)
- **P2.1** (relationship-analyzer): exists in
  docs/_pending-roadmap/identity-and-analysis.md lines 49-54. Names
  Tarjan SCC + SAFE/NEEDS_REWRITE/CONFLICT/MISSING vocabulary,
  prescribes P=25 INDEX_COMPLETE subscriber + `POST /api/analyze-relationships`,
  acknowledges the externalGraph/currentGraph/targetPages input
  requirement. Concrete pointer, defer is sound.
- **P2.3** (traversal.js): exists at lines 61-70. Names the exact two
  paths (lazy file_registry rewrite vs sonic-aligned GraphNodes/GraphEdges
  population during Pass-2). Concrete pointer, defer is sound.

Consumer-grep confirmations:
- `relationship-analyzer` → only `src/features/integr8/index.js:51,80`.
  `integr8/index.js` itself has zero live consumers (only docs/scripts/
  migration history).
- `graph/traversal` → zero consumers anywhere in src/ scripts/ tests/.

### Cheats considered and dismissed
- **"live probe was pasted but not reproducible"** — reproduced
  identically. The 22ms latency, the ordered-file chain, the 237/67
  category split, the 80-line markdown report all matched.
- **"scoping hides bugs by only working on tiny graphs"** — mutation
  probe #2 confirmed that without scoping path-generator's O(V*E)
  passes (computeStepCosts, computeCriticalPath, etc.) hang past 60s
  on the 305-node graph. Scoping is the load-bearing primitive, not a
  test-shrinking hack.
- **"deferred ticket roadmap pointers are vague"** — both P2.1 and
  P2.3 are specific, name the subscriber priority, the route surface,
  and the input/decision space. Acceptable.
- **"insights wired but written to wrong DB"** — TRUE: insights go to
  scaffolder_data.sqlite (maestro-shared), NOT st8.sqlite. The executor
  flags this explicitly in residualConcerns #5. Not a kickback because
  the InsightStore class is compiled-from-TS and `getSharedDatabasePath()`
  is its native contract; rerouting it would be a vendor-source edit.
  Flagged for a future cross-cluster ticket.
- **"return-shape-right-but-values-stale"** — orderedFiles, upstreamCount,
  graphProperties, and the markdown content all vary appropriately by
  focal file across the five probed files (app.js, persistence.js,
  indexer.js, README.md, start.js). Real computed values.

### Cross-cluster flags worth founder attention
1. **Insights persist in maestro-shared scaffolder_data.sqlite** —
   they survive `rm -rf /home/user/st8/.st8` but get clobbered by any
   other tool reusing the same shared DB. Cross-cluster: should be a
   persistence-and-database P3 ticket to decide retention policy.
2. **Report headlines inherit integr8's "Migration Report" framing** —
   cosmetic, well-flagged. A one-line edit to report-generator.js
   section headers would re-brand to "Signal Path Report" / "st8
   Analysis." Worth a small ticket if the founder cares about the
   constellation surface vocabulary.
3. **Per-request St8Persistence open+close adds ~30ms** to both
   `/api/signal-path` and `/api/generate-report`. For Wave 7 frontend
   integration (potentially polling dive-in panels), consider a
   request-scoped sharedPersistence or a pool — cross-cluster concern
   touching persistence-and-database.
4. **integr8/index.js + integr8/migration-executor.js + relationship-analyzer.js
   share the same retain-or-retire fate.** The executor correctly groups
   them. Whichever cluster handles cross-project ingest later should
   make all three decisions together, not piecemeal.
5. **`.st8/identity-risk.json` STILL has no reader.** Wave 3A flagged
   this; Wave 3B did not pick it up. The executor's `/api/insights`
   surface is the natural consumer pattern, but identity-risk uses a
   different schema (text reasons rather than insight records). Should
   be a P1 ticket for Wave 3C or whichever cluster owns the dive-in
   detail panel.

### Safe for Wave 3C (tests + audits + cross-cluster)?
**Yes.** The three founder-priority routes (`/api/signal-path`,
`/api/generate-report`, `/api/insights`) are live, real-data, and
performance-bounded by load-bearing scoping. The two deferred tickets
(3, 6) have concrete roadmap pointers and verified zero-consumer
status. The test suite is at 192/192. 3C can write end-to-end tests
against the live routes, audit the cross-cluster scaffolder_data.sqlite
split, and pick up identity-risk.json wiring without re-doing 3B's
work.

No source-code changes needed before 3C starts.

---

## Wave 3C Review

Reviewer audited 5 tickets executed by `wave-3c-executor`: [2, 8, 12, 13, 14].
Verdicts: **3 ack, 0 kickback, 2 defer-confirmed**. No cheats found.

### Test-suite verification
- `npm test` → tests:207 / suites:0 / pass:207 / fail:0 / cancelled:0 /
  skipped:0 / todo:0. Confirms the 192 → 207 delta (10 new gap-analyzer
  probes + 5 new identity-risk consumer probes).
- Targeted run `node --test tests/features/analysis/gap-analyzer.test.js`
  → 10/10 pass. All six dimensions covered (D1 lifecycle, D2 status,
  D3 intent, D4 exports, D5 connections, D6 architecture), plus a D6
  negative-case probe and a writeReport round-trip. No `assert.ok(true)`
  cheats.
- Targeted run `node --test tests/core/server/api-identity-risk.test.js`
  → 5/5 pass (missing artefact / present artefact / malformed JSON /
  POST returns 405 / records-only fallback when fallbackCount absent).

### Mutation probe (reviewer)
Picked ticket 2 (gap-analyzer D3 sentinel). Edited
`src/features/analysis/gap-analyzer.js:217`, removed the
`card.intent.purpose !== '(not set)'` sentinel from the hasPurpose
predicate. Reran the gap-analyzer suite: `not ok 3 - D3: intent
coverage treats empty AND "(not set)" sentinel as unauthored` —
exactly the regression lock the executor claimed. Restored the
sentinel, suite back to 10/10 pass. The pin is real, not
order-coincidental.

### Orchestrator-completed identity-risk consumer
The executor was aborted mid-run while finishing the `.st8/identity-risk.json`
consumer wire-up (a Wave 3B reviewer cross-cluster flag #5). After
abort, the orchestrator finished and committed the work that was in
the WIP commit (c5a1e5b → folded forward). Verified live:
- `src/core/server/app.js` line 322 dispatcher case
  `/api/identity-risk` → `_handleIdentityRisk`.
- `src/core/server/app.js` line 1582 handler — returns
  `{ok, count, records, generatedAt}` envelope on present file,
  count=0 envelope on absent file (clean run), HTTP 500 on parse
  error, HTTP 405 on non-GET. Surfaces `fallbackCount` as `count`
  for parity with `/api/insights`.
- `tests/core/server/api-identity-risk.test.js` — 5 probes covering
  every branch, all pass.

No additional ticket needed — this was the wave-level identity-risk
consumer flagged in Wave 3A and Wave 3B reviews and is now resolved.

### Per-ticket findings

**Ticket 2 (gap-analyzer D1-D6 tests) — ack.** 10 probes landed at
`tests/features/analysis/gap-analyzer.test.js`. D1 asserts phase
distribution and canProgress filtering (PRODUCTION excluded). D2
asserts RED root-cause inference for both 'No exports' and 'No
importers' independently and combined plus GREEN-low-reachability
0.3 threshold. D3 pins the load-bearing `(not set)` sentinel —
mutation probe confirmed. D4 pins the 'any import wins' CommonJS-vs-ES6
rule. D5 covers `||`-split fingerprint parsing for orphan-import
detection. D6 has both positive (8 cards seeded, endpointCoverage
expected) and negative (only server card, missingEndpoints
populated) probes. Includes a roll-up + edge-case + writeReport
round-trip.

**Ticket 8 (connection-state.json omissions) — ack.**
Documentation-only audit. The 45-line header in
`src/features/schema-cards/manifest-generator.js` explicitly cites
Wave 3A's birthTimestamp reuse as the strengthening rationale
(persistence is now the canonical authority for birthTimestamp;
adding the field to the manifest would create a second identity
surface consumers could disagree with the fingerprint on).
References the `parseFingerprint()` recipe for consumers who want
the timestamp. Matching MANIFEST OMISSION NOTE in
`src/shared/types/st8-types.js` cross-references the manifest
header. Roadmap P2.5 satisfied. residualConcern about a key-set
unit-test guard is a fair P3 follow-up.

**Ticket 12 (dive-in lock indicator) — defer-confirmed.**
JSON status=deferred. The DEFERRAL NOTE in
`src/frontend/components/dive-in/dive-in.js` correctly names both
upstream owners (louis-and-locking Phase L1 for the data source via
GET /api/locks; frontend-experience Wave 7 for the 3D render).
Sketches the wire-up recipe with concrete sprite-attach math
(`building.position + (0, height + offset, 0)`, color `0xFF3344`,
LOCK_STATE hook subscribe for mid-flight updates). Preserves the
founder's documentary intent from
`docs/Sonic/CODE_CITY_BARRADEAU_BUILDER.md`. Sequencing paragraph
makes the dependency order explicit. Pointer files exist:
`docs/_pending-roadmap/louis-and-locking.md` and
`docs/_pending-roadmap/frontend-experience.md`.

**Ticket 13 (needsAIReview annotation) — ack.** INFO-level
confirmation. Inline DOWNSTREAM WIRING comment at
`src/features/analysis/intent-seeder.js` adjacent to the
TRIPLE_AT_PATTERN producer correctly names the two render sites
(`app.js:466` badge-ai-review constellation span, and
`file-explorer.js:465` intent table). Traces the data path through
the persistence.js ALTER block + `getAllFiles()` + `/api/files`.
No behavior change. Closes the line item with adjacent
self-documentation; future readers won't re-flag.

**Ticket 14 (migration framework cross-link) — defer-confirmed.**
JSON status=deferred. Verified upstream:
`docs/_pending-tickets/persistence-and-database.for-review.json`
ticket 0 carries `status=deferred / verdict=defer-confirmed` (Wave
1B). The roadmap pointer (`docs/_pending-roadmap/persistence-and-database.md`
P1.1 SQLite migration framework) is the canonical owner. Follows
the Wave 2A upstream-resolved pattern correctly — no duplicate
migration framework invented locally. Inherited residualConcerns
reference the existing `[st8:persistence:drift]` warnings (Wave 1A
payoff) as the bridging surface until P1.1 lands.

### Cheats considered and dismissed
- **"D1-D6 tests trivially assert constructed values"** — read the
  test file. Each dimension probe constructs realistic synthetic
  cards, runs the real `GapAnalyzer.analyze()`, and asserts
  semantic outcomes (root-cause strings, percentage thresholds,
  fingerprint-parsing). Mutation probe confirmed D3 surfaces real
  regressions.
- **"connection-state.json omission docs without a test"** —
  acknowledged by the executor as residualConcern; not a kickback
  because the userNote scope was documentation, and the cross-file
  cross-references between manifest-generator.js and st8-types.js
  give a reviewer two failure surfaces to catch the regression at
  code review time. P3 follow-up worth filing.
- **"defer pointers are vague"** — both deferrals (12, 14) name
  concrete roadmap files, concrete phases (Louis L1, persistence
  P1.1, frontend Wave 7) and concrete API surfaces (GET /api/locks,
  _migrations table). Acceptable.
- **"identity-risk consumer is a stub"** — false. Live test surface
  covers every branch: present-file + count-N records, missing-file
  count=0 envelope, malformed JSON 500, POST 405, fallbackCount
  field-missing graceful fallback to records.length. Real handler,
  not a stub.

### Cluster-close drift audit
`git log --since="2026-05-14" --name-only --pretty=format: | grep -E
"^src/0_"` reports 0_* paths from commits 36d9c16 (skeleton create)
and d340af4 (cleanup), both dated 2026-05-14 and explicitly marked
historical in CLAUDE.md. Tightened query
`git log --since="2026-05-15"` returns empty. Working-tree check
(`git ls-files | grep "^src/0_"`) is empty. No live drift. Cluster
clear to close.

### Safe to rename to `.for-review.json`?
**Yes.** All 17 tickets in the cluster have terminal verdicts.
The .st8/identity-risk.json consumer surface — flagged in both
3A and 3B reviews as a cross-wave concern — is now live with test
coverage. Test suite at 207/207. Cluster ready for the founder.

---

## Cluster Summary

| Wave | Reviewer | ack | kickback | defer-confirmed |
|---|---|---|---|---|
| 3A | wave-3a-reviewer | 7 | 0 | 0 |
| 3B | wave-3b-reviewer | 3 | 0 | 2 |
| 3C | wave-3c-reviewer | 3 | 0 | 2 |
| **TOTAL** | — | **13** | **0** | **4** |

17 tickets total. 0 kickbacks across all three waves. The cluster
shipped:
- Identity reuse across runs (Wave 3A: birthTimestamp first-observed-
  wins, isUnreliableBirthtime sentinel, identity-risk.json producer,
  multi-fingerprint card dedup).
- The three founder-priority routes (Wave 3B: `/api/signal-path`,
  `/api/generate-report`, `/api/insights`).
- Gap-analyzer D1-D6 regression locks, connection-state.json
  contract documentation, downstream-wiring annotations, and two
  upstream-owned deferrals with concrete cross-links (Wave 3C).
- The Wave 3A/3B-flagged `.st8/identity-risk.json` consumer is now
  surfaced as `/api/identity-risk` with 5 test probes
  (orchestrator-completed at wave-3c hand-off).

The four defer-confirmed tickets (3 relationship-analyzer, 6 traversal,
12 dive-in lock indicator, 14 migration framework) all point at
specific roadmap phases owned by other clusters or future waves.
No work was punted without a forwarding address.

Cluster ready to close. Renaming JSON to
`.for-review.json`.

