# Data-Unblock Pass 2 — Synthesis of 14 Research Reports

**Date:** 2026-05-17
**Branch:** `claude/explain-plan-AseSe`
**Reports synthesized:** 14 (src/core + 9 src/features dirs + 3 src/frontend dirs + 2 src/shared dirs)
**Total LOC audited:** ~3,460 LOC of research over ~25,000 LOC of src

---

## 1. Executive summary

The wave taught us that **st8 is not data-poor, it is plumbing-poor**: rich signal is computed at indexing time and dropped on the floor before it can become canonical insights, manifest fields, or UI affordances. Every one of the 14 reports independently fingered the same chokepoints — most consistently `manifest-generator.js:generateConnectionState` and the gap between what's emitted into `ctx.result` and what's actually serialized to `connection-state.json` (`src_features_schema-cards.md:34-54`, `src_features_graph.md:32-43`, `src_frontend_components_constellation.md:42-48`, `src_frontend_components_graph-viewer.md:40-65`). The headline shift is that **batch 031's pattern works and replicates**: 5 of the 12 remaining canonical-13 categories can ship as Recipe-A / Recipe-C emitters this wave with zero new computation (gap-analyzer already produces the data, ast-parser already produces the metadata, builder.js already produces orphan/dead-import lists). What we thought was true ("the constellation needs a backend rewrite to see cycles"); what's actually true ("the constellation needs 6 LOC in manifest-generator.js plus a frontend subscriber"). We also confirmed batch 030's NO CHEATS rule paid off: each agent flagged ≥1 "almost called this dead but corpus said otherwise" moment (`safe-fs.FileHandlePool`, `relationship-analyzer.detectBreakingChanges`, `gap-analyzer.analyze().report`, `ground-plane.js`, `St8MutationRecord`).

---

## 2. The data-unblock cascade map (definitive)

End-to-end view, link by link. **Bold = chokepoint named by ≥3 reports.**

```
[1] AST extraction        : src/shared/utils/ast-parser.js               LIVE (rich metadata: complexity/isPure/jsdocTags/reexportChain/paramTypes)
                            └─ shared/utils report §3 — six dormant signals
[2] data-ingestion        : src/features/indexing/data-ingestion.js      LIVE (writes integr8 nodes in-memory only)
                            └─ indexing report §4 — parser-persistence's 9 tables EMPTY because persist=false on st8 path
[3] indexer Pass-1        : src/features/indexing/indexer.js             LIVE (upserts file_registry + emits FILE_INDEXED with 0 subscribers)
                            └─ core report §2 — FILE_INDEXED has zero subscribers; indexer.js:79 has DEAD ST8_SCHEMA
[4] connection-resolver   : src/features/indexing/connection-resolver.js LIVE (Recipe B; 363→188 accurate rows)
[5] builder.js            : src/features/graph/builder.js                LIVE for 2 of 10 fields; 8 dropped (orphanedFiles, deadImports, healthScore, totals, per-node consumers/dependencies)
                            └─ graph report §2 — bold drop
[6] gap-analyzer          : src/features/analysis/gap-analyzer.js        LIVE writes .md; D1-D6 per-file findings DROPPED never reach InsightStore
                            └─ analysis report §3 — single largest discarded-output surface
[7] manifest-generator    : **src/features/schema-cards/manifest-generator.js**   GATING. Writes connection-state.json. Drops cycles, importedBy, locked, isEntryPoint, lastModified, fileSizeBytes, exports[], resolved imports.
                            └─ schema-cards §2; graph-viewer §3; constellation §3; dive-in §3 — converging headline chokepoint
[8] schema-card emitter   : src/features/schema-cards/emitter.js         LIVE; populates importedBy on cards but cards are not what /api/connection-state.json reads
[9] InsightStore writers  : src/features/analysis/{insight-store-populator, cycle-insight-emitter}.js
                            populator emits 5 NON-canonical strings (orphan/red-status/under-connected/under-imported/high-impact) with off-spec severity ('error','warning')
                            cycle-insight-emitter emits 1 canonical (circular_dependency) — batch 031
                            └─ analysis §6; shared/types §3; shared/utils §10.2
[10] InsightStore         : src/features/analysis/insight-store.js       LIVE (scaffolder_data.sqlite); no JS-side category/severity gate
[11] API surface          : src/core/server/app.js                       LIVE for /api/connection-state.json, /api/insights, /api/signal-path, /api/identity-risk, /api/generate-report
                            └─ core §3 — /api/state + /api/manifests documented but 404; /api/events vs /api/mutations name drift
[12] Frontend services    : src/frontend/services/{coordination,settings-reader}.js
                            Only 2 services for 22 routes; 8 Wave-3+ endpoints have ZERO frontend consumer
                            └─ services §3
[13] Frontend components  : constellation, dive-in, graph-viewer, file-explorer, terminal
                            All read from /api/connection-state.json only. Zero consumption of /api/insights, /api/signal-path, /api/identity-risk.
                            └─ constellation §3; dive-in §2; graph-viewer §2
```

**The dominant chokepoint:** `manifest-generator.js:generateConnectionState` (`/home/user/st8/src/features/schema-cards/manifest-generator.js:83-114`). Four reports independently fingered it. Fixing it (Recipe-A-shaped, ~30 LOC) cascades data through to constellation + graph-viewer + dive-in with **zero frontend code change required**.

---

## 3. Cross-directory patterns

Patterns surfaced by 2+ reports independently.

### a. 14 endpoints with zero frontend consumers
Named by `src_frontend_services.md:71-87` (8 Wave-3+ explicitly: `/api/state`, `/api/manifests`, `/api/events`, `/api/tickets/count`, `/api/signal-path`, `/api/generate-report`, `/api/insights`, `/api/identity-risk`); confirmed independently by `src_frontend_components_dive-in.md:22-31` (signal-path/insights/identity-risk all live + accurate + unconsumed); confirmed by `src_features_llm.md:49` (`/api/llm-call` has zero frontend callers); confirmed by `src_features_search.md:96` (zero `/api/sonic/*` endpoints exist). Six additional routes (CRUD on tickets/templates/PRD/intent/oscar-house/files/index/verify/exec) are called from `app.js` directly, bypassing any service layer (`src_frontend_services.md:94-109`). **Pattern: backend wave 3-5 outpaced frontend wave 7 by ~10 endpoints.**

### b. `manifest-generator.js` as the dominant gating file
Named by `src_features_schema-cards.md:34-54`, `src_features_graph.md:38-43`, `src_frontend_components_constellation.md:42-48`, `src_frontend_components_graph-viewer.md:40-65`, `src_frontend_components_dive-in.md:107` (indirectly via `_st8FileIndex`). Five reports. Recipe-A-shaped fix (~30 LOC) unblocks three frontend components.

### c. Three parallel provider/category/schema registries
- **LLM providers:** `src/frontend/components/settings/settings.js:LLM_PROVIDERS` (7 ids) vs `providers` SQLite table (7+human) vs `dispatcher.js:SUPPORTED_PROVIDERS+STUB_PROVIDERS` (hard-coded same 7) — `src_features_llm.md:55-62`.
- **InsightCategory:** `docs/Insight Store/insightStore.ts:11-24` (canonical 13) vs `insight-store-populator.js:108-150` (5 ad-hoc) vs `cycle-insight-emitter.js:78-89` (1 canonical) — `src_shared_types.md:75-107`; `src_features_analysis.md:28-46`; `src_shared_utils.md:75`.
- **`ST8_SCHEMA` declarations:** `indexer.js:79` (78 LOC, dead, no .exec() caller) vs `persistence.js:65` (224 LOC, live canonical with CHECK constraints) — `src_core.md:107-132`; `src_shared_types.md:149`.

### d. Computed-but-discarded data (the headline pattern)
Multiple reports independently catalogued discarded fields:
- **builder.js drops 4 fields** (`orphanedFiles`, `deadImports`, `healthScore`, `totalNodes`/healthy/partial/unused/broken counts + per-node consumers/dependencies) — `src_features_graph.md:32-43`.
- **ast-parser drops 5 per-export fields** (`complexity`, `isPure`, `jsdocTags`, `paramTypes`, `reexportChain`) into integr8 in-memory + schema cards, with zero readers in `src/` — `src_shared_utils.md:39-49`.
- **verifyIntegration drops 4 categories** of per-file emissions (syntax errors → anti_pattern; import-resolution → dependency; tsc-output → type_issue; semantic-compat → api_surface) — `src_features_integr8.md:54-72`.
- **gap-analyzer drops D1-D6 report object** entirely; only `.st8/gap-analysis.md` markdown survives — `src_features_analysis.md:55-79`.
- **manifest drops `result.cycles`** even though it's in scope at P=10 manifest-emit time — `src_features_schema-cards.md:47-54`.

**Total estimated canonical-13 unlocks from discarded data: 8 of 12 remaining categories** (structural, dependency, complexity, pattern, unused_export, anti_pattern, type_issue, api_surface, documentation — minus 1 already-shipped circular_dependency).

### e. Hook-orphan publishers
6 of 9 hook types fire with zero subscribers (`src_core.md:30-46`):
- `FILE_INDEXED` (fires per-file, 281×/pass) — extension point only
- `FILE_BEFORE_CHANGE` — reserved
- `LIFECYCLE_TRANSITION` — 5 publishers (concept-file, production-promote, bruno-oscar×3) zero subscribers
- `COMMIT_RECORDED` — 1 publisher, zero subscribers
- `PRD_GENERATE` — 1 publisher, zero subscribers
- `TICKET_CREATED` — 1 publisher, zero subscribers

Each is a canonical-category-producer slot waiting to be filled. Confirmed by `src_features_search.md:127` flagging `TICKET_CREATED` as sonic-indexer subscriber target; `src_features_llm.md:75-81` flagging insight-emitter publish as LLM expert trigger; `src_features_watcher.md:163` flagging FILE_BEFORE_CHANGE for write-lock checks.

### f. Two-emitter / two-schema drift
- **Two `generateManifest`-equivalent functions:** `manifest-generator.js:generateConnectionState` (live, on-disk) vs `indexer.js:generateManifest` (dead, returned-but-never-written). Shape-incompatible. `src_features_schema-cards.md:60-66`; `src_frontend_components_graph-viewer.md:150-159`.
- **Two `ST8_SCHEMA`:** see §3c above.
- **Two `EventSource('/api/mutations')`:** `coordination.js:91` + `app.js:1155` — duplicate per tab; `src_frontend_services.md:117-126`.

---

## 4. Top global quick wins, ranked

Ranking criterion: `(data-unblock-impact × confidence) / effort`. The first 3 are obvious founder go/no-go's; 4-10 are the wave queue; 11-15 are runners-up.

### QW-1. Hydrate `connection-state.json` with `importedBy[]` + resolved `imports[].targetFilepath` + `cycles`

- **Executor ticket title:** "manifest-generator: hydrate importedBy + resolved imports + cycles"
- **Files touched:**
  - `src/features/schema-cards/manifest-generator.js` (+~30 LOC)
  - `src/core/hooks/default-subscribers.js` (P=10 subscriber signature)
  - `tests/features/schema-cards/manifest-generator.test.js` (+snapshot test)
- **Canonical category unblocked:** none direct, but **enables QW-7 and unblocks 3 frontend components**.
- **LOC delta:** ~+50 production + ~+80 tests
- **Agent-hours:** ~3
- **Predicted false-positive completion (NO CHEATS):** "I'll declare it done because the field appears in the JSON" — verify by loading constellation + graph-viewer popup + dive-in show(file) and confirming non-empty edges in all three.
- **Dependencies:** none. Recipe A (manifest is the canonical-producer here). Honors batch 030 lesson: does not re-orphan `emitter.js`'s working `importedBy` — that path stays live for cards.

### QW-2. `gap-analyzer-insight-adapter.js` (5 canonical categories in one ticket)

- **Executor ticket title:** "gap-analyzer-canonical-adapter: re-emit D1-D6 per-file findings as canonical InsightRecords"
- **Files touched:**
  - `src/features/analysis/gap-analyzer-insight-adapter.js` (NEW, ~140 LOC)
  - `src/core/hooks/default-subscribers.js` (P=32 subscriber, ~25 LOC)
  - `tests/features/analysis/gap-analyzer-insight-adapter.test.js` (NEW, ~120 LOC, fakeStore)
- **Canonical categories unblocked:** `documentation` (D3), `dependency` (D5), `anti_pattern` (D2+D5), `api_surface` (D6), `structural` (D1) — **5 of 12 remaining in a single ticket**.
- **LOC delta:** ~+285
- **Agent-hours:** ~3
- **Predicted false-positive:** "categories now present, ship it" — verify by `getInsightsByCategory('documentation')` returning at least the unauthored set count from gap-analyzer's own report.
- **Dependencies:** must coordinate with populator deprecation (founder gate §6). Honors batch 030: does not delete the populator yet; ad-hoc rows coexist until founder retires them.

### QW-3. Implement `/api/state` + `/api/manifests` (close documented 404s)

- **Executor ticket title:** "core/server: implement /api/state + /api/manifests"
- **Files touched:**
  - `src/core/server/app.js` (+~90 LOC for both handlers)
  - `src/core/server/route-manifest.js` (+2 entries)
  - `src/core/database/persistence.js` (+~25 LOC `getFileMetrics()`)
  - `tests/core/server/state-route.test.js` + `manifests-route.test.js` (NEW)
- **Canonical category unblocked:** none direct; closes documentation drift in CLAUDE.md.
- **LOC delta:** ~+200 with tests
- **Agent-hours:** ~4
- **Predicted false-positive:** "200 OK with empty object" — verify shape against `src_core.md:72-100` proposal (`{targetDir, lastIndexed, healthScore, statusCounts, fileCount, openTicketCount, lifecyclePhaseCounts}`).
- **Dependencies:** none. Standard route-manifest drift-test recipe.

### QW-4. `LIFECYCLE_TRANSITION` activity-log subscriber

- **Executor ticket title:** "default-subscribers: log LIFECYCLE_TRANSITION to activity_log"
- **Files touched:**
  - `src/core/hooks/default-subscribers.js` (+~25 LOC P=50 subscriber)
  - `tests/core/hooks/default-subscribers.test.js` (+1 test)
- **Canonical category unblocked:** none; closes a 5-publisher / 0-subscriber gap (`src_core.md:39`).
- **LOC delta:** ~+50
- **Agent-hours:** ~2
- **Predicted false-positive:** "test passes against fake hookRegistry" — verify on st8-on-itself by triggering a CONCEPT publish via POST /api/file-intent and reading back from activity_log.
- **Dependencies:** none. Pairs with watcher report's QW-1 (`src_features_watcher.md:139-142`) — CONCEPT path today publishes to the bus but does NOT call `logMutation`; this subscriber would solve both.

### QW-5. `validate-enum.js` + bind FileStatus/MutationType/ActorType/InsightCategory at write boundaries

- **Executor ticket title:** "shared/utils: add validate-enum + gate persistence + InsightStore writes"
- **Files touched:**
  - `src/shared/utils/validate-enum.js` (NEW, ~30 LOC)
  - `src/shared/types/insight-types.js` (NEW, ~40 LOC declaring canonical 13 + 5 severities)
  - `src/core/database/persistence.js` (+~10 LOC asserter calls in upsertFile/logMutation/logActivity)
  - `src/features/analysis/insight-store.js` (+~10 LOC adapter wrap on addInsight/addInsightsBatch)
  - `tests/shared/utils/validate-enum.test.js` (NEW, ~80 LOC)
- **Canonical category unblocked:** none direct; **makes future canonical producers safe** (loud bug beats quiet bug, batch 030 lesson).
- **LOC delta:** ~+150 production + ~+80 tests
- **Agent-hours:** ~4
- **Predicted false-positive:** "tests pass" — verify by intentionally writing `category: 'orphan'` and confirming the assert fires. Must NOT break populator until QW-6 lands (sequence).
- **Dependencies:** QW-6 (populator translation) must land in same wave or with feature-flag gate.

### QW-6. Translate populator's 5 ad-hoc → canonical 13

- **Executor ticket title:** "insight-store-populator: map 5 ad-hoc categories to canonical 13"
- **Files touched:**
  - `src/features/analysis/insight-store-populator.js` (rename strings, fix severity enum, ~30 LOC delta)
  - `tests/features/analysis/insight-store-populator.test.js` (update fixtures)
- **Canonical category unblocked:** activates `unused_export`, `anti_pattern`, `structural`, `api_surface` for existing 300 rows (mapping per `src_shared_utils.md:147-149`: orphan→unused_export, red-status→anti_pattern, under-connected→structural, under-imported→unused_export, high-impact→api_surface). Severity drift fixed.
- **LOC delta:** ~+60
- **Agent-hours:** ~2
- **Predicted false-positive:** "renamed strings, done" — verify `getInsightsByCategory('unused_export')` returns the orphan-set count, AND `severity` field is one of `info|low|medium|high|critical` only.
- **Dependencies:** **Founder gate** — see §6. Pairs with QW-5.

### QW-7. Constellation: subscribe to manifest.cycles + handle CREATE/DELETE SSE

- **Executor ticket title:** "constellation: render cycles + handle particle CREATE/DELETE"
- **Files touched:**
  - `src/frontend/components/constellation/constellation.js` (+~30 LOC for cycle highlight)
  - `src/frontend/app.js` (+~25 LOC for CREATE/DELETE branch in mutation handler)
  - `tests/frontend/constellation-cycles.test.js` (NEW)
- **Canonical category unblocked:** consumes `circular_dependency` from QW-1's enriched manifest.
- **LOC delta:** ~+100
- **Agent-hours:** ~3
- **Predicted false-positive:** "cycle rings on synthetic fixture" — verify on st8-on-itself (0 cycles) renders nothing and doesn't crash; on `alpha→beta→gamma→alpha` synthetic shows 3 ringed particles.
- **Dependencies:** **QW-1** (needs `manifest.cycles` field).

### QW-8. Dive-in: wire `/api/signal-path` + `/api/insights` (FOUNDER P1.1)

- **Executor ticket title:** "dive-in: fetch signal-path + insights on show(file)"
- **Files touched:**
  - `src/frontend/components/dive-in/dive-in.js` (+~80 LOC)
  - `src/frontend/components/dive-in/dive-in.css` (left-rail styles)
  - `src/frontend/services/insights-service.js` (NEW, ~60 LOC, batch-029 adapter pattern)
- **Canonical category unblocked:** consumes the entire insights pipeline (1 + 5 from QW-2).
- **LOC delta:** ~+200
- **Agent-hours:** ~5
- **Predicted false-positive:** "fetch returns data, displayed" — verify the orderedFiles chain matches the chain produced by manual signal-path query for the same file.
- **Dependencies:** **founder's stated P1** per `dive-in.js:28-66` + `signal-path-adapter.js` header. Best executed after QW-1 + QW-2 land so insights are meaningful.

### QW-9. Recipe-C `unused-export-emitter.js` (persistence-derived)

- **Executor ticket title:** "analysis: add unused-export-emitter (Recipe C off connections table)"
- **Files touched:**
  - `src/features/analysis/unused-export-detector.js` (NEW, ~80 LOC)
  - `src/features/analysis/unused-export-emitter.js` (NEW, ~70 LOC)
  - `src/core/hooks/default-subscribers.js` (P=38 subscriber)
  - `tests/features/analysis/unused-export-*.test.js` (NEW)
- **Canonical category unblocked:** `unused_export` (true persistence-derived signal, not just renamed orphan).
- **LOC delta:** ~+250
- **Agent-hours:** ~3
- **Predicted false-positive:** "rows inserted" — verify true-negative on a synthetic where every export has a known importer (count=0), then true-positive on a synthetic with deliberate orphan exports.
- **Dependencies:** none; can run parallel to QW-6.

### QW-10. Graph-viewer: hydrate edges from resolved imports + cycle highlight

- **Executor ticket title:** "graph-viewer: consume resolved imports + render cycle nodes"
- **Files touched:**
  - `src/frontend/components/graph-viewer/graph-viewer.js` (+~40 LOC; lines 116-131 + status filter)
  - `tests/frontend/graph-popup-edges.test.js` (NEW)
- **Canonical category unblocked:** visualizes `circular_dependency`.
- **LOC delta:** ~+80
- **Agent-hours:** ~2
- **Predicted false-positive:** "edges rendered" — verify edge count > 0 for st8-on-itself (16 expected per batch 031), not just "some edges drawn".
- **Dependencies:** **QW-1** (needs resolved imports in manifest).

### QW-11. Recipe-C `test-coverage-emitter.js` (cheapest standalone canonical producer)

- **Executor ticket title:** "analysis: add test-coverage-emitter (Recipe C, mirror-path check)"
- **Files touched:** `src/features/analysis/test-coverage-{detector,emitter}.js` (NEW), default-subscribers (+P=39)
- **Canonical category unblocked:** `test_coverage`
- **LOC delta:** ~+200
- **Agent-hours:** ~2
- **Dependencies:** none. The 207-test suite + tests/README mirror convention makes accuracy high on st8-on-itself (`src_features_analysis.md:194-207`).

### QW-12. `St8InsightsService` (frontend service wrapper)

- **Executor ticket title:** "frontend/services: add InsightsService following batch-029 adapter pattern"
- **Files touched:** `src/frontend/services/insights-service.js` (NEW, ~60 LOC)
- **Canonical category unblocked:** none; **service layer for all future canonical consumers**.
- **LOC delta:** ~+100 + ~+80 tests
- **Agent-hours:** ~2
- **Dependencies:** none. Pairs with QW-8.

### QW-13. Retire `indexer.js:generateManifest` + `writeManifest` + dead `ST8_SCHEMA`

- **Executor ticket title:** "indexer: delete dead generateManifest/writeManifest/ST8_SCHEMA"
- **Files touched:** `src/features/indexing/indexer.js` (~-110 LOC), drop `manifest:` from `indexDirectory` return.
- **LOC delta:** ~-110 (pure deletion)
- **Agent-hours:** ~1
- **Dependencies:** none. Confirmed dead by `src_features_schema-cards.md:60-66` + `src_core.md:107-132`.

### QW-14. Recipe-C `dependency-coupling-emitter.js`

- **Executor ticket title:** "analysis: add dependency-coupling-emitter (SQL: COUNT(*) > 15)"
- **Files touched:** `src/features/analysis/dependency-coupling-emitter.js` (NEW), default-subscribers (+P=40)
- **Canonical category unblocked:** `dependency` (high-imports variant; overlaps with QW-2 D5 but at file level)
- **LOC delta:** ~+170
- **Agent-hours:** ~2
- **Dependencies:** none. Persistence-derived after batch 031 (`src_features_indexing.md:369-390`).

### QW-15. `St8EventBus` consolidation (two SSE → one)

- **Executor ticket title:** "frontend/services: consolidate /api/mutations consumers into St8EventBus"
- **Files touched:** `src/frontend/services/event-bus.js` (NEW), `app.js` + `coordination.js` migration
- **LOC delta:** ~+120 net
- **Agent-hours:** ~4
- **Dependencies:** none; gates future SSE-driven UI work.

---

## 5. Recommended wave shape

**Three waves of 4-5 tickets each**, single-concern discipline preserved.

### Wave 032 — "Manifest hydration + dead-code retirement" (foundations)
- QW-1 (manifest hydration) — highest leverage; unblocks 3 frontend reports
- QW-3 (/api/state + /api/manifests) — closes documented drift
- QW-4 (LIFECYCLE_TRANSITION subscriber) — proves the 6 orphan-hook pattern
- QW-13 (retire dead manifest/schema code) — preventive
- **Executor budget:** ~10 agent-hours / 5 tickets

**Rationale:** these are pure-additions or pure-deletions; no cross-cutting decisions. Sets the table so wave 033's canonical-category emitters consume a hydrated manifest.

### Wave 033 — "Canonical-category producers" (the data-unblock heart)
- QW-2 (gap-analyzer-insight-adapter — 5 categories in 1 ticket)
- QW-5 (validate-enum + gates)
- QW-6 (populator translation — paired with QW-5)
- QW-9 (unused-export Recipe C)
- QW-11 (test-coverage Recipe C)
- **Executor budget:** ~14 agent-hours / 5 tickets
- **Canonical-13 coverage after wave 033:** 1 (existing) + 5 (QW-2) + 1 (QW-6 net-new) + 1 (QW-9) + 1 (QW-11) = **9 of 13** (69%)

**Rationale:** QW-5 + QW-6 must be paired to avoid breaking populator. QW-9 + QW-11 are independent Recipe-C ships with zero dependencies. QW-2 produces the biggest jump.

### Wave 034 — "Frontend consumption" (visible delivery)
- QW-7 (constellation cycles + CREATE/DELETE)
- QW-8 (dive-in signal-path + insights — FOUNDER P1.1)
- QW-10 (graph-viewer edges)
- QW-12 (St8InsightsService)
- QW-15 (St8EventBus) — optional 5th
- **Executor budget:** ~16 agent-hours / 4-5 tickets

**Rationale:** UI delivery wave. All depend on wave 032's manifest hydration; insights consumers depend on wave 033's canonical categories existing.

**Sequencing constraint:** wave 032 must precede wave 034; wave 033 should precede wave 034's insight-consuming tickets (QW-8, QW-10). Waves 032 and 033 can interleave if executor capacity exists.

---

## 6. Founder-gated decisions

1. **Retire populator's 5 ad-hoc categories vs grandfather them?** QW-5 + QW-6 assume retire-by-rename (`orphan→unused_export`, etc.). The mappings per `src_shared_utils.md:147-149` are semantically close but not identical (`red-status` is a status, `anti_pattern` is a smell — orthogonal axes). Founder call: rename, or extend the canonical 13 to 18?

2. **14th canonical category for `autoFixSuggestions`?** Migration-executor's `result.autoFixSuggestions` doesn't fit any of the 13 (`src_features_integr8.md:299-303`). Adding `auto_fix` would break the canonical-TS contract. Defer or extend?

3. **APP_ID consolidation (`com.scaffolder.app` vs `com.st8.app`)?** Ground-plane switched to `com.st8.app` (Wave 5B); graph-persister still uses `com.scaffolder.app` for scaffolder_data.sqlite (`src_features_search.md:153`; `src_features_analysis.md` data-flow). Migrate scaffolder_data.sqlite path, or accept the split?

4. **`background-indexer.js` revival — wave 035 candidate?** `src_features_indexing.md:455-470` flags that QW-9/QW-2 emitters duplicate dormant inline emitters in background-indexer.js. If founder approves revival, dedup work is owed. If not, keep deferred. **Stated guidance in sonic-and-search.md P1 = founder-deferred** — don't touch this wave.

5. **Conditional Stage-1 skip in integr8 wave-extras?** `src_features_indexing.md:438-442` proposes `ingestion-dispatcher.js` to skip Vue/Pinia/Tauri parsers on JS-only projects. Real perf benefit (~200ms-1s/pass), but "extras per wave" rule says ask. **Recommend defer to wave 035.**

6. **Sonic Imports/Exports tables empty — re-vendor or sibling?** `src_features_indexing.md:252-260` proposes T-PP-1 (rewrite data-ingestion.js writer) which violates TS-vendored hand-edit prohibition. Three paths: (a) re-vendor, (b) sibling writer module, (c) skip parser-persistence entirely and use AST-on-the-fly. **Recommend founder picks (b) or (c) before wave 033.**

7. **`/api/events` vs `/api/mutations` rename?** CLAUDE.md says `/api/events`; code says `/api/mutations`. `src_core.md:325-329` recommends rename to `/api/events`. Cosmetic but breaks `coordination.js` + `app.js` SSE clients. **Defer or do it in wave 034 alongside St8EventBus?**

---

## 7. Anti-cheat bullets for executor prompts

Bake these into every wave 032-034 executor prompt:

1. **The corpus-blind-spot anti-cheat (mandatory, from batch 031):** "Before declaring any module 'dead' or any data 'missing', cross-reference against `docs/<Tool>/`, `st8_json/schema-cards/<basename>.json`, `st8_bible.md` batches, and the cluster's `.for-review.json` prior verdicts."

2. **Wave 032 specific:** "If your test passes by emitting `manifest.importedBy: []` for every file, you've reproduced the existing bug. Verify on st8-on-itself that at least 16 files have non-empty `importedBy` (the post-batch-031 count). Use the assertion `assert(files.filter(f => f.importedBy.length > 0).length >= 16)`."

3. **Wave 033 specific (canonical-category producers):** "If your emitter inserts a row with `category: 'orphan'` or `severity: 'error'`, you've drifted off canonical. Hard-code the literal from `docs/Insight Store/insightStore.ts:11-24`. If the validate-enum gate (QW-5) is live, your test will fail loud — DO NOT bypass with `category: 'orphan' || 'unused_export'`."

4. **Wave 033 QW-2 specific:** "Gap-analyzer's `analyze()` returns a report object you must NOT recompute — call `analyze()` once at P=30 and re-emit at P=32 by reading the report. Re-running `analyze()` doubles the cost and is the most likely false-positive completion path."

5. **Wave 034 specific (frontend consumers):** "If your `/api/insights` fetch returns 0 rows on st8-on-itself, do not declare 'no insights to show'. Either (a) confirm post-wave-033 the row count is the expected 300+, or (b) verify the fetch URL matches the route-manifest entry. A zero-row response is a feature flag, not an empty state."

6. **All waves — re-orphaning anti-cheat:** "Before deleting any code, confirm via grep across `src/`, `tests/`, AND `scripts/` that no caller exists. Then re-confirm via `docs/components/<cluster>.md` that the feature isn't documented as 'deferred'. Three modules have been wrongly called dead in prior waves (`computeTarjanSCC`, `state.js` capabilities, `ground-plane.js`); do not be the fourth."

7. **Sequence-violation anti-cheat:** "If your ticket depends on QW-N landing first per the wave sequence in synthesis §5, refuse to start until you observe its commit hash in HEAD's git log."

---

## 8. Confidence assessment + open questions

### Per-ticket readiness

| Ticket | Research sufficient? | 2nd-pass needed? |
|---|---|---|
| QW-1 (manifest hydration) | YES | no |
| QW-2 (gap-analyzer adapter) | YES | no |
| QW-3 (/api/state) | YES | no |
| QW-4 (LIFECYCLE subscriber) | YES | no |
| QW-5 (validate-enum) | YES | no |
| QW-6 (populator translation) | YES, BUT mapping decisions are founder-gated | needs founder answer §6.1 |
| QW-7 (constellation) | YES | no |
| QW-8 (dive-in signal-path) | YES | no; signal-path-adapter contract verified in prior wave |
| QW-9 (unused-export) | YES | no |
| QW-10 (graph-viewer) | YES | no |
| QW-11 (test-coverage) | YES | no |
| QW-12 (InsightsService) | YES | no |
| QW-13 (delete dead code) | YES | no |
| QW-14 (dep-coupling) | YES | minor: threshold (15 vs lower) is tunable, expose as config |
| QW-15 (EventBus) | YES | no |

### Conflicts I had to reconcile

- **Constellation SSE-drop gap.** `src_frontend_components_constellation.md:75-87` initially read as "constellation needs SSE handler upgrades." `src_features_watcher.md:108-110` corrected this: the watcher fan-out is correct; the gap is purely frontend-side in `app.js:330-355`. **Winner: watcher report.** Reflected in QW-7 (frontend-only fix).
- **`unused_export` source: dormant background-indexer extract vs Recipe-C fresh write?** `src_features_indexing.md:62-92` proposes extracting from background-indexer; `src_features_analysis.md:176-191` proposes Recipe-C from scratch. **Winner: Recipe-C fresh write (QW-9)** — honors batch 030's no-revive-background-indexer rule. Adapter extraction can come later if/when founder gates revival.
- **`unused_export` mapping for populator's `orphan` vs `under-imported`.** `src_features_analysis.md` and `src_shared_utils.md:147-149` both map `orphan → unused_export`; `src_features_analysis.md` also maps `under-imported → unused_export` (collision). Net: two populator categories collapse to one canonical; document the collision in QW-6.
- **`healthScore` source: builder.js scalar vs persistence-derived?** `src_features_graph.md:167` flags builder's healthScore as "near-useless on st8-on-itself because integr8 nodes empty"; proposes persistence-derived alternative. **Winner: persistence-derived** (folded into QW-3's `getFileMetrics()`).

### Single highest-leverage finding

**`manifest-generator.js:generateConnectionState` is the rate-limiting step for the entire frontend.** It's 30 LOC of additions to unblock 3 frontend components, 1 documented FOUNDER P1, and the consumption of every canonical-category producer the next two waves will land. Five reports converged on this independently. Wave 032 QW-1 is the single ticket with the biggest cascade ratio in the queue.

### Overall confidence

**GREEN.** The 14 reports converge cleanly. Every Q-W in §4 has a named template (Recipe A/B/C/D), named files, named tests. The founder-gated decisions in §6 are real but small in number (7), bounded in scope, and all have a recommended default. Wave 032 can launch immediately; wave 033 launches once founder answers §6.1 (populator retire) and §6.6 (Imports/Exports vendor question if QW-9 chooses the parser-persistence path — recommended path avoids both).

---

**End of synthesis.**
