# Research — `src/features/integr8/` (data-unblock-pass-2)

Scope: 3 files, 2392 LOC. Read-only audit through the unblock lens
defined by batch 031's four recipes (canonical-category producer /
accurate resolver / persistence-derived analyzer / clear-then-rebuild).

---

## 1. File inventory

| File | LOC | Origin | Status | Notes |
|---|--:|---|---|---|
| `index.js` | 139 | TS-vendored from `commands/integr8/index.ts` | **dormant** | `runIntegr8Command(args)` — only export. No `src/` callers. Reachable nowhere from `start.js` / `main.js` / `app.js` / `package.json` bin. |
| `migration-executor.js` | 1836 | TS-vendored from `commands/integr8/migrationExecutor.ts` | **dormant** | 11 exports (`loadMigrationPlan`, `executeMigrationPlan`, `verifyIntegration`, `rollbackMigration`, snapshot lifecycle...). Zero `src/` callers via grep. |
| `toml-serializer.js` | 417 | TS-vendored | **partially live** | `serializeMigrationPlanToToml` / `parseMigrationPlanFromToml` / `serializeGraphMetadataToToml`. Lazy-required by `src/features/indexing/indexer.js:67` + `src/features/schema-cards/manifest-generator.js:76` via `loadLibModule`. |

The pre-refactor analogues in `st8_json/schema-cards/` exist for all
three (`lib_commands_integr8_index.js.json`,
`lib_commands_integr8_migrationExecutor.js.json`,
`lib_commands_integr8_tomlSerializer.js.json`) — confirming these are
the same modules that pre-existed the kebab-case migration, not
late additions.

---

## 2. `migration-executor.js` subsystem map (by line range)

| Lines | Subsystem | Public? |
|---|---|:-:|
| 46-72 | exports surface (11 functions) | — |
| 64-71 | `loadMigrationPlan(planPath)` — TOML→plan via tomlSerializer | yes |
| 73-129 | `executeMigrationPlan(plan, options)` — top-level switch over `step.action` (COPY_FILE / REWRITE_IMPORT / MERGE_ROUTE / RESOLVE_CONFLICT / RUN_COMMAND / VERIFY); stop-on-first-error semantics | yes |
| 131-145 | `executeCopyFile` — fs.copy with .integr8-backup | — |
| 146-176 | `executeRewriteImport` — regex import rewrite + I-14 Tier-3 path validation | — |
| 177-349 | **Path-resolution context subsystem** (I-14 Tier 3): `buildPathResolutionContext` (workspaces + tsconfig paths + package exports), `validateImportRewritePath`, `resolvePackageExport` | — |
| 351-578 | **Router-merge subsystem**: `executeMergeRoute`, `detectRouterFormat`, `detectRouterFramework`, `detectFrameworkFromPackageJson` (Vue Router / React Router / Next.js) | yes (`detectRouterFramework`, `detectFrameworkFromPackageJson`) |
| 580-713 | `executeResolveConflict` — strategy switch (rename/merge/overwrite/custom/ignore) with metadata logging | — |
| 720-753 | `executeStrategyChain` — I-05 SOTA strategy composition (chain with fallback) | — |
| 759-833 | **Recursive deep-merge subsystem**: `performRecursiveMerge`, `deepMergeObjects` (with provenance tracking + conflict accumulation) | — |
| 834-904 | `mergeByLines`, `generateCompatibilityAdapter` — line-merge + adapter codegen | — |
| 905-950 | `executeSandboxedTransform` — vm-sandboxed user-defined transform function | — |
| 951-1015 | **`computeConflictMetadata`** — confidence/impact/dependents/risk per resolution. Strategy-confidence table baked in. Scans siblings for dependents. | — |
| 1016-1108 | `executeRunCommand` + object-literal helpers (`tryParseObjectLiteral`, `serializeObjectLiteral`, `extractExportNames`, `capitalize`) | — |
| 1109-1162 | `executeVerifyStep` — post-migration smoke: orphan-backup detection, relative-import brokenness, brace balance | — |
| 1168-1245 | **`verifyIntegration` (PUBLIC)** — I-06 SOTA 4-level pipeline orchestrator | yes |
| 1252-1501 | **Verification levels 1-4**: `verifySyntax` (braces/parens/quotes), `verifyImportResolution`, `verifyTypeChecking` (spawns `tsc --noEmit`), `verifySemanticCompatibility` (exported-types parity) | — |
| 1502-1557 | `parseTscOutput`, `suggestImportFix`, `suggestTypeError`, `scanSourceFiles` — verification helpers | — |
| 1584-1655 | `rollbackMigration` — restore from `.integr8-backup` files | yes |
| 1656-1736 | `createPreMigrationSnapshot`, `executeAtomicMigration` — `.st8/snapshots/<planId>/` snapshot then-execute pattern | yes |
| 1732-1830 | `rollbackFromSnapshot`, `listAvailableSnapshots`, `rollbackToLatest` | yes |

### Per-file emissions that could become canonical InsightRecords

Several subsystems silently emit actionable per-file findings to
`console.log` or to a `result.errors`/`result.autoFixSuggestions`
array that dies with the call frame. These would map cleanly to the
canonical 13 categories:

| Source | Today | Canonical category fit |
|---|---|---|
| `verifySyntax` errors (brace/paren/quote imbalance) | logged, returned, dropped | `anti_pattern` or `type_issue` |
| `verifyImportResolution` "Unresolved import" | logged + `result.errors` | `dependency` or `anti_pattern` |
| `verifyTypeChecking` parsed `tsc` errors | logged, dropped | `type_issue` |
| `verifySemanticCompatibility` exported-types mismatch | logged, dropped | `api_surface` |
| `computeConflictMetadata.affectedDependents` per conflict | logged | `structural` |
| `executeVerifyStep.brokenImports` scan | `result.errors` | `dependency` |
| `result.autoFixSuggestions[]` | written to `post_snapshot.json`, never read | `pattern` / `anti_pattern` |

All currently dropped on the floor — recipe-A canonical-category
producer pattern (`cycle-insight-emitter.js` template) applies one-
for-one. But: the entire executor is unreachable from live st8 (no
`/api/*` route, no CLI shim). Wiring would also need an invocation
trigger.

---

## 3. `toml-serializer` schema vs current emission

**Schema accepted by `parseMigrationPlanFromToml`:**

```
[metadata]: id, timestamp, source_path, target_path, outcome,
            estimated_complexity, conflict_count
[[steps]]:  step, action, description, from?, to?, file?,
            conflict_id?, resolution?, command?, rules[]?
[[steps.rules]]: original_import, rewritten_import, reason
[[conflicts]]: id, type, item, description,
               resolution_options[], recommended, details?
```

Plus `serializeGraphMetadataToToml` emits a `[graph_properties]`
section with `reachability`, `stability`, `fragility`,
`integration_distance?`.

**Validators in parse path:** `IntegrationOutcome`,
`MigrationAction`, `ResolutionStrategy`, `ConflictType` enums from
`shared/types/integr8-types`. Invalid values throw — actual runtime
contract enforcement, unlike `InsightCategory` (stripped at JS
compile per batch 030).

**Live callers via `loadLibModule`:**
- `src/features/indexing/indexer.js:67`
- `src/features/schema-cards/manifest-generator.js:76`

(Both lazy-require — neither path appears to invoke
`serializeMigrationPlanToToml` directly today; the require is held
for future use.)

**Richer-than-st8-emits?** Yes — the schema accepts (a) per-step
`rules` arrays with provenance reasons, (b) `conflicts.details`
inline tables for arbitrary metadata, (c) `strategyChain`-flavour
step data (though `strategyChain` itself is NOT in the TOML schema
— only in `executor.js`'s in-memory `step` shape). The TOML schema
is a clean subset of MigrationPlan, but st8 currently has no live
producer feeding it.

---

## 4. `integr8/index.js` entry — reachability + conditional Stage-1 skip

**Reachability today:** ZERO live entry points.

- `grep runIntegr8Command src/` → only the export and its own
  definition. No `app.js` route. No `main.js` wiring. Not in `start.js`.
- The `--save-graph` flag (the only writer of `MigrationPlans`)
  is documented in graph-persister.js's header but unreachable.

**Would a conditional Stage-1 skip unblock self-introspection?**

The `signal-path-adapter.js` (Wave 3B) already proved this exact
pattern: it bypasses `dataIngestion.ingestProjectData()` entirely
(skips the six Vue/Pinia/Tauri parsers) and synthesizes a
`SemanticGraph` from `file_registry` + `connections` directly. Then
it calls `path-generator.generateMigrationPath()` (Stage 3) for
self-introspection — Stage 2's heavy `analyzeRelationships()` is
also skipped because there's no `external` graph to merge.

So the conditional-skip path is already implemented for the
signal-path use case. What's NOT yet built:

- A `runIntegr8FromPersistence(persistence, targetPages)` orchestrator
  that swaps `ingestProjectData` for `buildSemanticGraphFromPersistence`
  + runs `analyzeRelationships(graph, EMPTY_GRAPH, pages)` + persists
  via `DatabasePersister.saveGraph` / `saveMigrationPlan`.
- An HTTP entry that takes a target-page set and returns the
  resulting `MigrationPlan`.

`relationshipAnalyzer`'s `analyzeRelationships()` currently expects
both `externalGraph` AND `currentGraph` — its conflict-detection
logic assumes two-source input. An empty external graph would produce
zero conflicts (already the natural answer for self-introspection)
but the function path needs verification that it tolerates
`externalGraph.nodes.length === 0` without divide-by-zero in
reachability/fragility computation.

---

## 5. `MigrationPlans` table — populated when? consumed by what?

**Writer:** `DatabasePersister.saveMigrationPlan(plan)` at
`src/core/database/graph-persister.js:202`. INSERT OR REPLACE.

**Sole caller:** `src/features/integr8/index.js:127` —
`runIntegr8Command` when `args.saveGraph === true`. That arg
originates from a `--save-graph` CLI flag that has no live entry
point in current st8 (no CLI parser routes to `runIntegr8Command`).

**Therefore:** `MigrationPlans` table exists in
`scaffolder_data.sqlite` schema, is never written, is never read by
anything in `src/`. `graph-persister.js` exposes `queryGraph(graphId)`
and `listGraphs()`, but no route or subscriber calls them either.

This is a dormant writer/reader pair. The graph-persister research
in 2026-05-16 already flagged this.

---

## 6. Canonical-category producer candidates in this dir

Following recipe A (cycle-insight-emitter template), the
migration-executor's verification subsystems are the highest-fit
candidates IF the executor were ever wired live. As a self-
introspection tool today they are not — but the verifyIntegration
PUBLIC function (line 1168) is the cleanest extractable: takes
`(currentProjectPath, outputDir)`, returns a structured
multi-level error array, and DOES NOT require a MigrationPlan to
run. It could be invoked standalone post-INDEX_COMPLETE against
the project under st8.

Candidates:

1. **`verifyImportResolution` → `dependency` insights.** Already
   computes per-file unresolved-import errors with line numbers and
   auto-fix suggestions. Maps 1:1 onto an InsightRecord shape.
   Overlap with the new `connection-resolver.js`'s 100 unresolved
   relatives (batch 031 residual) — both could share output sink.

2. **`verifyTypeChecking` → `type_issue` insights.** Wraps `tsc
   --noEmit`. Already has `parseTscOutput` + `suggestTypeError`.
   Output structure (`file`, `line`, `message`, `severity`,
   `autoFixSuggestion`) is insight-record shaped.

3. **`verifySemanticCompatibility` → `api_surface` insights.**
   Exported-types parity check — same shape.

4. **`verifySyntax` → `anti_pattern` insights** (brace/paren/quote
   imbalance). Lower-quality (heuristic-only) but free signal.

Toml-serializer is NOT a producer candidate — it's a pure
serialization layer, not an analysis emitter.

index.js's 3-stage orchestrator has no per-file emission to
re-route; its outputs are consumed by report-generator (already
wired via `/api/generate-report` through `signal-path-adapter`).

---

## 7. TOP 3 QUICK WINS

### QW-1 (highest value, lowest risk): extract `verifyImportResolution` as a P=38 INDEX_COMPLETE subscriber emitting `dependency` insights.

The function (line 1321) is self-contained — takes `(files,
projectPath)`, returns `{level, passed, errors[], duration}`.
Extract a thin module `src/features/analysis/import-resolution-
insight-emitter.js` modelled on `cycle-insight-emitter.js`. Subscribes
post-cycle (P=38 to run after P=37). Reads
`persistence.getAllFiles()` for the file list (no need to rescan
disk). Emits one `dependency` insight per unresolved import with
the existing `suggestImportFix` text as `evidence`.

This addresses the 100 unresolved-relative-imports residual called
out in batch 031 without inventing a new pass.

### QW-2: extract `parseTscOutput` + `suggestTypeError` into a `type-issue-insight-emitter`.

Same template. INDEX_COMPLETE subscriber, spawns `tsc --noEmit`
once, parses stderr, emits canonical `type_issue` insights. Cost:
adds a `tsc` invocation to every index pass — may need throttling
to once-per-N-passes or gating on a settings flag. Future value:
the only persistent surface of TS type errors anywhere in st8 today.

### QW-3: write a `runIntegr8FromPersistence` orchestrator (recipe-C analog) for cross-project migration plans.

A 50-100 LOC adapter that mirrors `signal-path-adapter.js`'s skip-
Stage-1 pattern but executes Stages 2+3 for a real two-project
migration (external = another st8 instance's persistence, current
= local). Optionally calls `DatabasePersister.saveMigrationPlan` so
the dormant `MigrationPlans` table finally has a writer. Exposed
via `POST /api/migration-plan` (X-St8-Secret-gated). Unblocks the
ENTIRE integr8 pipeline for non-Vue codebases without invoking the
six dormant calibrated parsers.

---

## 8. Cross-directory dependencies

`index.js` imports:
- `../indexing/data-ingestion.js` (Stage 1)
- `../analysis/relationship-analyzer.js` (Stage 2)
- `../analysis/path-generator.js` (Stage 3)
- `./toml-serializer.js`
- `../analysis/report-generator.js`
- `../../core/database/graph-persister.js`

`migration-executor.js` imports:
- `../../shared/types/integr8-types.js` (`MigrationAction`,
  `ResolutionStrategy`, `VerificationLevel`)
- `fs-extra`, `path`, `vm`, `child_process` (for `tsc`)

`toml-serializer.js` imports:
- `../../shared/types/integr8-types.js` (`IntegrationOutcome`,
  `MigrationAction`, `ResolutionStrategy`, `ConflictType`)

Inverse (who imports integr8/*):
- `src/features/indexing/indexer.js:67` — lazy `loadLibModule('../integr8/toml-serializer')`
- `src/features/schema-cards/manifest-generator.js:76` — same
- nothing imports `migration-executor.js` or `index.js`

---

## 9. Gaps + open questions

1. **Why is `migration-executor.js` ~1836 LOC vendored without ANY
   live caller?** Three plausible reads: (a) "preserved for future
   migration UX" (intent doc would live in `docs/integr8/` — not
   surveyed here), (b) "extractable verification primitives we
   weren't ready to lift yet," (c) "dead-code candidate kept because
   the founder's plan calls for it later." Recipe-A wiring (QW-1/2)
   would resolve this gracefully — the executor's value subsystems
   become live without invoking the unreachable orchestrator.

2. **Does `analyzeRelationships` tolerate an empty external graph?**
   Required check for QW-3 + for any future "self-introspection
   integr8" path. The signal-path-adapter sidesteps this by going
   straight to `path-generator` — but a true integr8-from-persistence
   adapter needs Stage 2 to not divide-by-zero.

3. **`autoFixSuggestions` is written to `post_snapshot.json` but no
   reader exists.** This is a "data flowing nowhere" pattern from
   the mission brief. Even without wiring the full executor, the
   structure suggests an `auto_fix` InsightRecord category that
   isn't in the canonical 13 — possibly an extension target.

4. **TOML round-trip is asymmetric.** `serializeMigrationPlanToToml`
   serializes `strategyChain` and `conflictMetadata` fields that
   `parseMigrationPlanFromToml` does NOT parse back (the parser
   only knows the original ts-vendored schema). If a `MigrationPlan`
   ever round-trips through TOML, it loses strategy-chain info. Not
   a current bug (no live producer), but a latent one.

5. **`DatabasePersister.saveGraph`'s string-id-to-rowid mapping is
   transient.** Each save run generates new auto-increment node IDs;
   edges keyed by string IDs are remapped each call. For incremental
   updates this means every `saveGraph` is full-rewrite. Acceptable
   for QW-3's MigrationPlan use case (each plan has its own
   `graph_id`), but worth noting if anyone tries to use the table
   for live st8 graph sync.

6. **`migration-executor.js`'s `executeSandboxedTransform`** uses
   `vm.createContext` for user-supplied transforms. Currently
   unreachable, but if exposed via an HTTP route would be a
   significant attack surface — gate at minimum behind X-St8-Secret
   and probably behind a settings opt-in. Flagging for any future
   wire-up.

---

**File locations referenced:**
- `/home/user/st8/src/features/integr8/index.js`
- `/home/user/st8/src/features/integr8/migration-executor.js`
- `/home/user/st8/src/features/integr8/toml-serializer.js`
- `/home/user/st8/src/features/analysis/signal-path-adapter.js`
- `/home/user/st8/src/features/analysis/cycle-insight-emitter.js`
- `/home/user/st8/src/core/database/graph-persister.js`
- `/home/user/st8/docs/Insight Store/insightStore.ts`
- `/home/user/st8/st8_json/schema-cards/lib_commands_integr8_*.json`
