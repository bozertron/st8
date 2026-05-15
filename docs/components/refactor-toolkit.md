# Refactor Toolkit & Meta-Layer

**Cluster:** `refactor-toolkit-and-meta`
**Scope:** the migration scripts, signal tests, OGB safety-net, and st8_bible that together produced the entire layout refactor of st8 across 27 batches (001-027, with the layout-refactor proper running 001-021).

This is the META layer — how `backend/` + `lib/utils/` + `lib/commands/` + 6 root frontend files became the new `src/{shared,core,features,frontend}/` tree, byte-for-byte, with zero runtime regressions, while the bible recorded every step.

If you've lost context and you're picking this up cold: **read this doc, then read the bible's "Refactor Batch Log" section (`st8_bible.md` from L1705 onward), in that order.** That gets you to operational knowledge in under an hour.

---

## 1. The refactor as a whole

### Starting layout (pre-batch-001)

```
st8/
├── st8.html                    # 2587 lines — monolithic UI (CSS+JS+HTML)
├── coordination.js
├── settings-reader.js
├── file-explorer.js            # 6 root-level browser JS files
├── graph-visualizer.js
├── phreak-terminal.js
├── settings-ui.js
├── backend/                    # 14 .js files — server, persistence, indexer,
│   ├── index.js                #                schema cards, analysis,
│   ├── server.js               #                lifecycle, watcher, etc.
│   ├── persistence.js
│   ├── indexer.js
│   ├── manifestGenerator.js
│   ├── fileWatcher.js
│   ├── st8-types.js
│   ├── schemaCardEmitter.js
│   ├── schemaCardPrinter.js
│   ├── notificationBus.js
│   ├── gapAnalyzer.js
│   ├── intentSeeder.js
│   ├── prdGenerator.js
│   ├── templateEngine.js
│   ├── brunoOscar.js
│   └── verify-persistence-fixes.js
└── lib/
    ├── utils/                  # 4 leaf utilities (maestro heritage)
    │   ├── astParser.js
    │   ├── safeFs.js
    │   ├── ioChan.js
    │   └── groundPlane.js
    └── commands/               # parsers + analysis suite + integr8
        ├── graphBuilder.js
        ├── graphTraversal.js
        ├── backgroundIndexer.js
        ├── overview.js
        ├── parserPersistence.js
        ├── insightStore.js
        ├── storeParser.js
        ├── routeParser.js
        ├── commandParser.js
        ├── typeParser.js
        ├── uiParser.js
        └── integr8/
            ├── index.js
            ├── dataIngestion.js
            ├── relationshipAnalyzer.js
            ├── pathGenerator.js
            ├── reportGenerator.js
            ├── tomlSerializer.js
            ├── databasePersister.js
            ├── migrationExecutor.js
            └── types.js
```

### Ending layout (post-batch-021)

```
src/
├── shared/
│   ├── utils/                  # safe-fs, io-chan, ast-parser, ground-plane
│   └── types/                  # st8-types, integr8-types
├── core/
│   ├── notification-bus.js
│   ├── server/                 # main.js (was index.js), app.js (was server.js)
│   └── database/               # persistence.js, graph-persister.js (was databasePersister), verify-persistence-fixes.js
└── features/
    ├── analysis/               # gap-analyzer, intent-seeder, insight-store,
    │                           # relationship-analyzer, path-generator, report-generator
    ├── graph/                  # builder, traversal
    ├── indexing/               # indexer, overview, *-parser.js (6), parser-persistence,
    │                           # data-ingestion, background-indexer
    ├── integr8/                # index.js, toml-serializer, migration-executor
    ├── lifecycle/              # bruno-oscar
    ├── prd/                    # generator, template-engine
    ├── schema-cards/           # emitter, printer, manifest-generator
    └── watcher/                # file-watcher

src/frontend/
├── index.html                  # 142-line slim shell (down from 2587)
├── app.js                      # extracted inline JS
├── styles/                     # fonts, tokens, base, void, chat, file-list,
│                               # notes-popup, dock, panels (9 files)
├── services/                   # coordination.js, state.js (was settings-reader)
└── components/                 # file-explorer, graph-viewer, terminal, settings,
                                # notifications, prd-wizard (+css per component)
```

### Headline numbers

- **12 layout-refactor move batches** (Batches 001-012; 013-015 = HTML peel-apart; 016-018 = wiring + cleanup; 019-020 = OGB + flip; 021 = polish + signal tests)
- **~47 originals** retired to `OGB/<path>.txt` (46 in batch 019 + `st8.html` in batch 020) — currently 48 files in OGB across `backend/`, `lib/utils/`, `lib/commands/`, `lib/commands/integr8/`, `src/frontend/services/` (state.js was re-staged), and 7 at the OGB root
- **~25 K lines of code** moved byte-for-byte (SHA-256 verified)
- **138 zero-prefix planning stubs** deleted in batch 021 (`src/0_*` was a prior wave's empty-skeleton)
- **0 runtime regressions** — the end-to-end boot test in batch 011 + the v2 shell smoke test in batch 016 + the OGB-only boot test in batch 019 all passed before any destructive step

### Why batches?

Each batch is a unit that can be reviewed, verified, and reverted independently. The dependency graph determined the order: **leaves first** (shared utilities + types), then **mid-layer** (database, schema cards), then **features**, finally **the server/entry point** and **frontend**. By the time `backend/index.js` moved (batch 010 → `src/core/server/main.js`), every one of its 20+ requires already pointed at known, settled `src/` locations via the history-aware rewriter.

---

## 2. The migration scripts

All migration scripts live in `/home/user/st8/scripts/migration/` and are invoked manually in a strict sequence per batch. The general flow:

```
edit manifest.json
       │
       ▼
move-files.js             (Phase 1: copy, SHA-256 verify)
       │
       ▼
rewrite-imports.js        (Phase 2: AST-driven import rewriting, history-aware)
       │
       ▼
verify.js                 (Phase 3: subprocess require probe, appends to history)
       │
       ▼
[update bible with batch entry + commit]
       │
       ▼
[after a string of batches: stage-originals.js]
       │
       ▼
[after each batch: check-conventions.js for spot checks]
```

### 2.1 `move-files.js` — Phase 1: copy + SHA-256 verify

**File:** `/home/user/st8/scripts/migration/move-files.js` (117 lines)

**What it does.** Reads `manifest.json`. For each `{ from, to }`:
1. Copies `from` → `to` (`fs.copyFileSync`); originals stay untouched (non-destructive).
2. Computes `sha256(from)` and `sha256(to)`; if they differ after the copy, it's a hard fail.
3. Idempotent: if `to` already exists with the same SHA, it's reported as `SAME` (no rewrite, no failure).
4. Counts lines for the per-move record.
5. Writes `results.move.json` with per-move status, SHA, lines, action (`copied` / `already_in_sync`).

**When to run.** First step of every batch, after manifest is finalized. Exit code 1 if any move failed — stop and investigate.

**Guarantees.**
- Byte-identical copies (SHA-256 mismatch is a hard exit).
- Idempotent — re-running on an already-migrated batch is a no-op.
- Persistence-side work (mutation logging, `file_registry` filepath updates, schema-card regen) is **deliberately not** done here. That comes later, post-verify.

### 2.2 `rewrite-imports.js` — Phase 2: AST-driven, history-aware

**File:** `/home/user/st8/scripts/migration/rewrite-imports.js` (310 lines)

**What it does.** Walks each `to` file from `manifest.json`, parses with `@babel/parser` (sourceType `unambiguous`, plugins for JSX/TS/dynamic-import), collects every relative-specifier string in `require()`, `import`, `export from`, and dynamic `import()`. For each relative specifier:

1. Resolve it against the file's **original** location (`from`). That gives the absolute path of what the spec was originally pointing at.
2. Check the **move map**, which is `[ ...readHistoryMoves(), ...manifest.moves ]`. If the resolved target is itself a file that has moved (in this batch or any prior batch), find its new absolute path.
3. Compute the new specifier as `path.relative(newDir, newTargetAbs)`, normalized to POSIX separators, with `.js` stripped if the original specifier omitted it (preserves source aesthetic — bare names like `'./persistence'`).
4. Apply edits to the source text via offset surgery (highest offset first so earlier offsets stay valid). Formatting, comments, whitespace all preserved exactly.

**The "history-aware" upgrade.** Added in batch 002. Without it, batch N's rewriter would only know about batch N's moves and would leave specifiers pointing at files moved in batch N-1 untouched. With history-awareness, every batch sees the cumulative move map and rewrites correctly. This is the single most-important property of the toolkit — it's why 12 sequential batches landed without cross-batch breakage.

**When to run.** Immediately after `move-files.js` and before `verify.js`.

**Guarantees.**
- Only relative specifiers (`./` / `../`) considered. Non-relative names (`'fs'`, `'better-sqlite3'`) are never touched.
- If a specifier points at a file **not** in the manifest or history, it's left alone — the originals are still on disk at their old paths until `stage-originals.js` runs, so they still resolve.
- AST-based, not regex — handles multi-line imports, dynamic `import('...')`, `export ... from '...'`, etc.
- Idempotent: a second run finds nothing to rewrite and emits zero edits.

**What it can't see.** Dynamic requires built with `path.join()` / `__dirname` / template literals. The classic example is the `loadLibModule()` pattern (see §7). Those need hand-patches and are recorded as "Manual hand-patches" in the bible's batch entry.

### 2.3 `verify.js` — Phase 3: subprocess require probe

**File:** `/home/user/st8/scripts/migration/verify.js` (258 lines)

**What it does.** For each `{ from, to }` in `manifest.json`:

1. **Probe the old file** (`from`): spin a child Node process that intercepts `process.exit`, requires the path, and writes either `{ ok: true, keys, kind, exited }` or `{ ok: false, error }` to a temp file. Parent reads the result.
2. **Probe the new file** (`to`) the same way.
3. **Compare export surfaces.** Diff `Object.keys(oldMod)` vs `Object.keys(newMod)`. Equal → `OK`. Different → `WARN` (export drift) with `missing` / `added` lists.
4. **Both-broken-identically branch.** If both old and new throw at module load with the *same* error class (paths normalized for comparison), report `WARN` with parity confirmed (e.g. batch 017's `background-indexer.js` — both throw `Cannot find module './sonicClient.js'` identically).
5. **Client modules.** If the manifest entry has `client: true`, skip require — browser code references `window` / `document`. Instead run `node --check <path>` for syntax verification.
6. **On clean pass (all `ok` or `warn`, zero `fail`):** appends the batch entry to `move-history.json`. Idempotent: a batch already in history is skipped.

**Why subprocess?** Some files are entry points that call `process.exit()` at module load. The interceptor catches that exit, swallows the synthetic error, and reports the module as a successful `entrypoint`. Without this, the verifier would itself exit mid-run.

**When to run.** Immediately after `rewrite-imports.js`. Exit code is 1 if any file failed.

**Guarantees.**
- Every moved file at least parses + reaches module load.
- Export surfaces match the originals (or are explicitly flagged as drift).
- The cumulative `move-history.json` is updated only after a clean pass — so a failing batch can't pollute future rewriters with bad state.

### 2.4 `stage-originals.js` — retire originals to OGB

**File:** `/home/user/st8/scripts/migration/stage-originals.js` (90 lines)

**What it does.** Reads `move-history.json`. For every recorded `from` file:
1. Copy it to `OGB/<from-path>.txt` (directory structure preserved inside OGB; `.txt` suffix so the file is no longer interpreted as JS by anything walking the repo).
2. Delete the original at its old path.

So `lib/utils/safeFs.js` → `OGB/lib/utils/safeFs.js.txt` and the original is `rm`'d.

**When to run.** Not per-batch. Run **once**, after a string of move batches has settled and you're ready to retire the originals. Batch 019 did this for all 46 then-completed moves in one shot. **DO NOT** run this until you're confident the new `src/` tree works end-to-end — the originals are your last automatic fallback.

**Guarantees.**
- Idempotent: skips files whose original is already gone AND whose OGB copy exists.
- Reports `MISS` if the original is gone and no OGB copy exists (which would mean someone deleted manually).
- Preserves directory structure inside OGB so paths remain unambiguous.

**What's in OGB right now (48 files):**
- 7 at `OGB/` root: `coordination.js.txt`, `file-explorer.js.txt`, `graph-visualizer.js.txt`, `phreak-terminal.js.txt`, `settings-reader.js.txt`, `settings-ui.js.txt`, `st8.html.txt`
- 14 in `OGB/backend/`: index, server, persistence, indexer, manifestGenerator, fileWatcher, st8-types, schemaCardEmitter, schemaCardPrinter, notificationBus, gapAnalyzer, intentSeeder, prdGenerator, templateEngine, brunoOscar, verify-persistence-fixes
- 4 in `OGB/lib/utils/`: safeFs, ioChan, astParser, groundPlane
- 12 in `OGB/lib/commands/`: graphBuilder, graphTraversal, backgroundIndexer, overview, parserPersistence, insightStore, storeParser, routeParser, commandParser, typeParser, uiParser
- 9 in `OGB/lib/commands/integr8/`: index, dataIngestion, relationshipAnalyzer, pathGenerator, reportGenerator, tomlSerializer, databasePersister, migrationExecutor, types
- 1 in `OGB/src/frontend/services/`: state.js (probably a re-stage during the frontend-services consolidation)

**Rollback recipe.** Pick the OGB file you want back, drop the `.txt`, and overwrite the new path:

```bash
cp OGB/backend/persistence.js.txt backend/persistence.js
# or, to restore to the new location:
cp OGB/backend/persistence.js.txt src/core/database/persistence.js
```

Git also has full history of every deletion in batch 019, so `git show` against a pre-019 commit is another path.

### 2.5 `check-conventions.js` — 6-dimension gap analysis

**File:** `/home/user/st8/scripts/migration/check-conventions.js` (424 lines)

**What it does.** Run from repo root: `node scripts/migration/check-conventions.js`. Walks `src/` and emits 6 deterministic findings lists into `results.gap-analysis.md`. None of the checks judge severity — that's for the human reading the report.

The 6 checks:

| # | Check | What it catches |
|---|-------|-----------------|
| 1 | **NAMING** | camelCase / PascalCase in `.js / .css / .html / .json` filenames under `src/`. Convention is kebab-case. |
| 2 | **ZERO-PREFIX RESIDUE** | Paths containing a `0_` segment — leftover empty-stub planning skeleton. |
| 3 | **EMPTY DIRECTORIES** | Directories under `src/` with no files at any depth (after excluding `0_` skeletons). |
| 4 | **OLD-PATH REFERENCES** | String literals / comments in `src/` mentioning `backend/<file>.js`, `lib/utils/<file>.js`, `lib/commands/<file>.js`, `lib/commands/integr8/<file>.js`. Skips lines that look like historical documentation (e.g. JSDoc `* extracted from`, `* OGB/`, `previously`). |
| 5 | **ARCH BOUNDARY VIOLATIONS** | Imports that cross layers in the wrong direction. Rules: `shared` ← `shared/std/npm` only; `core` ← `core/shared/std/npm`; `features` ← `features/core/shared/std/npm`; `frontend` ← `frontend/std/npm` only (browser code). Also flags cross-feature coupling within `features/`. |
| 6 | **ORPHAN MODULES** | Files under `src/` whose exports are never imported anywhere in `src/`. Known entry points (`src/core/server/main.js`, `src/core/database/verify-persistence-fixes.js`, `src/frontend/app.js`) and all of `src/frontend/` (loaded via `<script src>`) are excluded. |

**When to run.** After every batch, plus on demand whenever the founder wants a hygiene snapshot. The script writes both stdout tally and `results.gap-analysis.md`.

**Cumulative reality check (per bible batch 021):** 282 raw findings on first run → 31 after the `0_*` deletion + `gap-analyzer.js` path fixes. The remaining 31 = 25 expected boundary violations (`core/server` orchestrating features, which is correct) + 6 orphan candidates needing human review (`ground-plane.js`, `integr8/index.js`, `migration-executor.js`, `background-indexer.js`, `graph/builder.js`, `graph/traversal.js`).

**Known gotcha.** Check 6 (orphan detection) over-reports for any module loaded via `<script src>` from `src/frontend/index.html`. The script already skips `src/frontend/` files entirely (line 336), but if a feature module were ever loaded directly in browser via `<script src>` from the `src/features/` tree, it would be reported as orphan. Not currently an issue since features are server-only.

### 2.6 `extract-css.js` — st8.html CSS peel-apart

**File:** `/home/user/st8/scripts/migration/extract-css.js` (105 lines)

**What it does.** Reads `st8.html`, extracts 15 documented CSS sections verbatim by 1-indexed inclusive line ranges into component-local / global stylesheets under `src/frontend/`. Original `st8.html` is **not modified** by this script — that flip happens in batch 020.

**Targets** (excerpt — see `TARGETS` in source):

```js
{ out: 'src/frontend/styles/tokens.css',  ranges: [[150, 165]],   label: 'CSS Custom Properties (:root)' }
{ out: 'src/frontend/styles/void.css',    ranges: [[180, 235], [817, 855]],   label: 'Void / Drift Surface' }
{ out: 'src/frontend/components/file-explorer/file-explorer.css',
  ranges: [[1012, 1226], [1228, 1288]], label: 'File Explorer + Workspace Picker' }
```

Some targets have multiple ranges (e.g. `void.css` has both the surface block and the cursor/pulse block, which lived in non-contiguous chunks of `st8.html`).

**When to run.** Once, in batch 013. The output is verbatim source slices — re-running would produce the same files.

**Aesthetic preservation.** Verbatim line copies. Indentation, comments, vendor prefixes, custom-property usage — all preserved. Each extracted file gets a small header comment with its source-of-truth line range for traceability.

**Verification.** Selector-count check: 273 CSS selectors in source `<style>` block = 273 across extracted files. Source `<style>` is 1549 lines; extracted total is 1530 lines; the 19-line diff is the blank-line separators between sections.

### 2.7 `extract-js.js` — st8.html inline JS peel-apart

**File:** `/home/user/st8/scripts/migration/extract-js.js` (93 lines)

**What it does.** Pulls inline JS from `st8.html` into `src/frontend/app.js`. Same shape as the CSS extractor — documented line ranges, verbatim slice, no transformation.

**Ranges:**
- `st8.html` 1784-1788 — `window.escapeHtml` utility
- `st8.html` 1797-2584 — Main application code (panels, PRD wizard, file list, toasts, SSE)

**Intentional omissions** (per founder direction):
- `st8.html` 1762-1779 — the void-engine loader. Void-engine was moved to a separate project; the loader is no longer needed.
- `st8.html` 1790-1794 — five `<script src="...">` includes for the now-moved components. These become `<script src="src/frontend/components/...">` in the new slim shell.

**Verification.** 41 function declarations in source slices = 41 in extracted file. `node --check src/frontend/app.js` passes. 15 critical `window.*` handlers spot-checked — all present.

---

## 3. The verification model

Two tiers built. Tier 1 was deferred.

### Tier 2 — Pipeline invariants

**File:** `/home/user/st8/scripts/signal-tests/check-invariants.js` (276 lines)

**What it does.** Spins up the indexer against a fixture target (`/tmp/st8-invariant-target` by default — a 3-file `alpha.js → beta.js → gamma.js` tree it creates if not provided), runs the indexer via `src/core/server/main.js`, then asserts 7 invariants on `connection-state.json`:

| # | Invariant | Catches |
|---|-----------|---------|
| I1 | Manifest exists and is valid JSON | Indexer didn't write manifest / corruption |
| I2 | `manifest.files.length == count(code files on disk)` | Parser drops files, glob misses extensions, status filter excludes good files |
| I3 | Every entry has `fingerprint, filepath, filename, sha256Hash, status, lifecyclePhase, birthTimestamp` | Field omission, null leaks |
| I4 | Every `sha256Hash` matches a freshly computed SHA of the file on disk | Hashing bug, stale entry, off-by-one |
| I5 | `GREEN + YELLOW + RED == files.length` (no OTHER) | Nullable status field, typo'd enum value, race in status writer |
| I6 | Two consecutive runs produce identical fingerprints + sha256s for every file | Non-deterministic hashing, timestamp contamination of fingerprint, race conditions |
| I7 | All `filepath` values are relative (not absolute) | `__dirname` / cwd contamination, path serialization bug |

**When to re-run.** After any change to the indexer, manifest generator, fingerprinting, or persistence layer. Also after any move that touches `src/features/indexing/` or `src/core/server/`. Cheap (~5s) so erring on running it often is fine.

**First-run result on the post-refactor codebase** (per bible batch 021): **5/7 pass**. I3 and I6 failed:

- **I3** — `lifecyclePhase` + `birthTimestamp` exist in the SQLite `file_registry` but aren't serialized into `connection-state.json`. Could be intentional (the manifest is the "stable surface" view, not the full DB row) or a manifest-omission bug.
- **I6** — File count drifts 3 → 4 on second run because the indexer indexes the `connection-state.json` it wrote on the first run. Easy fix: exclude `connection-state.json` and `ai-signal.toml` from the discover-files glob.

Neither of those is a refactor regression — both are pre-existing pipeline characteristics the test surfaces.

### Tier 6 — Schema-card identity delta

**File:** `/home/user/st8/scripts/signal-tests/check-identity-delta.js` (235 lines)

**What it does.** For each of the 43 schema cards in `st8_json/schema-cards/`:
1. Recover the original file path from the card filename (e.g. `backend_persistence.js.json` → `backend/persistence.js`).
2. Look up the current location via `scripts/migration/move-history.json`. Falls back to the original path if not moved.
3. Run a fresh AST extraction via `src/shared/utils/ast-parser.js → extractImportsAndExports()`.
4. Compare the saved card's exports + imports against today's AST extraction.

Tolerates known refactor noise:
- Builds a **rename map** from `move-history.json` for any file whose basename changed (e.g. `databasePersister` → `graph-persister`).
- Normalizes basenames by stripping separators and lowercasing (`safeFs` ≡ `safe-fs`).
- A **documented-drift** allowlist (`DOCUMENTED_DRIFT` set, 8 paths) flags expected drift from intentional hand-patches without failing the run.

**Buckets:**
- `MATCH` — exports + imports identical to pre-refactor card.
- `DOCUMENTED DRIFT` — identity changed, but the change was an intentional batch-X patch.
- `UNDOCUMENTED DRIFT` — **investigate**. Surface differs and isn't on the documented list.
- `MISSING ON DISK` — card exists but no file at expected path (e.g. void-engine, fake-stream — retired).
- `FAILED TO PARSE` — AST extractor threw on the new file.

**Last-known result on the post-refactor codebase** (per bible batch 021):

| Bucket | Count |
|--------|------:|
| MATCH | 37 |
| DOCUMENTED DRIFT | 3 |
| UNDOCUMENTED DRIFT | 0 ✅ |
| MISSING ON DISK | 3 |
| FAILED TO PARSE | 0 |

**The strongest end-to-end signal that the move-and-rewire didn't accidentally alter a module's external surface.** Of 43 cards, 37 fingerprint-perfect, 3 expected drift, 0 anomalies.

**When to re-run.** After any refactor that touches a file with a schema card. Also as a regression-check anchor — if undocumented drift ever appears, you've changed a file's identity without realising.

### What about Tier 1?

Tier 1 = schema contracts validated at internal handoffs (e.g. `indexer` → `manifestGenerator`, `parserPersistence` → `graphPersister`). **Deferred indefinitely.** Tier 2 (pipeline-end invariants) + Tier 6 (per-file identity) cover most of what Tier 1 would. If a future regression slips past both, that's the moment to add schema-contract validation at internal handoffs.

---

## 4. The OGB convention

**Founder coinage.** OGB = "Old Garbage Bin" / "Original Garage" — the inert holding directory for retired source code.

### The pattern

1. **Move + verify** files into `src/` with the migration scripts. Originals stay in place.
2. **Run end-to-end smoke tests** against the new tree. Multiple times if needed.
3. **Once confident**, run `stage-originals.js`:
   - For every file in `move-history.json`, copy `lib/utils/safeFs.js` → `OGB/lib/utils/safeFs.js.txt` (preserves dir structure, appends `.txt`).
   - Delete the original.
4. **Originals are now inert text snapshots** — `.txt` suffix means no tooling executes them or treats them as source.
5. **Run another full smoke test** to prove `src/` works without the originals.
6. **Founder destroys `OGB/` at their leisure** (manual `rm -rf OGB/` whenever they're confident).

### Why .txt instead of just deleting?

Two reasons:
1. **Recovery window.** Between staging and founder-driven destruction, anything that turns out to be needed can be `cp OGB/<path>.txt <path>` in one second.
2. **Git history is excellent for code recovery but lousy for cross-reference.** Searching `OGB/` with `grep` is instant. Searching git history for "where did this function go" is not.

### Current OGB state

48 files totaling roughly 1.1 MB. All inert (`.txt`). Founder has not yet destroyed.

### Rollback recipe

```bash
# Quick: bring back one file at its OLD location
cp OGB/backend/persistence.js.txt backend/persistence.js

# Or restore to a new src/ location (with potential renaming)
cp OGB/backend/persistence.js.txt src/core/database/persistence.js

# Last-resort full revert of the layout refactor:
#   1. cp OGB/<path>.txt back to each <path> (drop .txt)
#   2. rm -rf src/  (or git reset to before batch 001)
#   3. git revert the start.js + package.json edits from batch 011
```

### What's NOT in OGB

Per the founder's policy in batch 019:
- `backend/SCHEMA-CARD-EMITTER-REPORT.md`, `backend/SECURITY-AUDIT-H1.md`, `backend/package.json` — non-code documents/configs left in `backend/` for the founder to decide their fate separately.
- All of `st8_json/` — runtime artifacts (schema cards) + documentation, never part of the refactor.
- `start.js`, `ai-signal.toml`, `connection-state.json`, `st8.code-workspace` — root entry / config files.

---

## 5. The bible's role

**File:** `/home/user/st8/st8_bible.md` — 2943 lines as of batch 027.

The bible is an **append-only batch log**. Sections:

- **L1-1604** — Architecture reference, layer overviews, signal flow, design tokens, API endpoints, dependencies, planned features. Predates the refactor.
- **L1604-1704** — "Refactor Findings — 2026-05-14" — the pre-refactor inventory + decisions doc.
- **L1705+** — "Refactor Batch Log" — the running log. One section per batch.

### Batch entry shape

Each batch's entry follows the same template:

```
### Batch NNN — `batch-name`

**Goal:** (one sentence)

**Moves:** (markdown table — From / To / Lines / SHA-256 verified)

**Total:** (sum of lines moved)

**Import rewrites:** (count + table)

**Manual hand-patches:** (if any — the AST rewriter couldn't catch these)

**Tooling upgrades:** (if any — e.g. batch 002 added history-awareness, batch 017 added both-broken-identically)

**Verification:** (what was proven — usually a require + export-surface check, sometimes a full HTTP boot test)

**Commit:** `<short-hash>`
```

### Why it matters for future contributors

Three reasons.

1. **Layout decisions are written down.** Every "why is `databasePersister` named `graph-persister` now?" or "why does `intent-seeder` live under `analysis/` instead of `indexing/`?" has an answer in the bible.

2. **Manual hand-patches are recoverable.** The `loadLibModule()` pattern (now extinct) and other dynamic-require gotchas are all documented per-batch with the exact L# and the exact transformation. If a similar pattern shows up in a future move, the precedent is there.

3. **Commit hashes are recorded.** Twenty-six of the twenty-seven batches have commit hashes in their entry. You can `git show <hash>` for the exact diff per batch.

### Future contributors should

- Read this doc + the bible's "Refactor Batch Log" section **before changing layout**.
- Add a new entry to the bible for every move-batch. The pattern is the entire value.
- Don't squash batches when committing. One commit per batch keeps `git bisect` clean if a regression appears later.

### Known limitation

The bible has **no top-of-file index**. Finding "where is batch 014 documented?" requires `grep -n "^### Batch" st8_bible.md`. For a 3000-line doc with 27 batches, a nav index would help. (Roadmap item.)

---

## 6. What's left in `lib/` and `backend/`

```
$ find lib backend -type f
backend/SCHEMA-CARD-EMITTER-REPORT.md
backend/SECURITY-AUDIT-H1.md
backend/package.json

$ find lib backend -type d
lib
backend
lib/utils
lib/commands
lib/commands/integr8
```

So:
- **`lib/`, `lib/utils/`, `lib/commands/`, `lib/commands/integr8/`** — all empty directories. The `.js` originals were retired to OGB in batch 019, but `stage-originals.js` doesn't `rmdir` empty dirs.
- **`backend/`** — contains 3 files: two markdown reports and a `package.json`. Founder needs to decide their fate (probably: move to `docs/`, delete, or stay).

These empty dirs + leftover files are tracked as tickets — see `docs/_pending-tickets/refactor-toolkit.json`.

---

## 7. How to do the NEXT move

Step-by-step, assuming you have a target file and a desired destination.

### Step 0 — Decide what's moving

Pick a small batch. The toolkit can handle large batches (batch 008 was 11 files), but smaller batches are safer to revert. Look at the file's `require()` calls and make sure either (a) all callees are already moved (in `move-history.json`) or (b) they're in the same batch.

### Step 1 — Edit `manifest.json`

```jsonc
{
  "batch": "my-batch-name",
  "generatedAt": "2026-05-15",
  "description": "Move foo.js + bar.js into src/features/baz/.",
  "moves": [
    { "from": "lib/commands/foo.js", "to": "src/features/baz/foo.js" },
    { "from": "lib/commands/bar.js", "to": "src/features/baz/bar.js" }
  ]
}
```

For browser-only files, add `"client": true` to each entry — the verifier will run `node --check` instead of `require()`.

### Step 2 — Run move-files.js

```bash
node scripts/migration/move-files.js
```

Expect output like:

```
COPY lib/commands/foo.js -> src/features/baz/foo.js  (250 lines, sha256=abc...)
COPY lib/commands/bar.js -> src/features/baz/bar.js  (180 lines, sha256=def...)
Done: 2 ok, 0 fail
```

If anything fails, **stop**. Don't proceed to rewrite-imports.

### Step 3 — Run rewrite-imports.js

```bash
node scripts/migration/rewrite-imports.js
```

Expect output like:

```
EDIT  src/features/baz/foo.js  (2 rewrites):
        L  10  './sibling'         ->  '../other-feature/sibling'
        L  15  '../utils/safeFs'   ->  '../../shared/utils/safe-fs'
OK    src/features/baz/bar.js  (no rewrites needed)
```

**Spot-check the EDIT output.** If a rewrite looks wrong, fix the manifest or the destination layout before proceeding.

### Step 4 — Run verify.js

```bash
node scripts/migration/verify.js
```

Expected output:

```
OK    src/features/baz/foo.js  (object{3 keys}, 3 exports)
OK    src/features/baz/bar.js  (function(Bar), 1 export)
Done: 2 ok, 0 fail
Batch "my-batch-name" recorded in move-history.json
```

- `OK` — clean require + export-surface match.
- `WARN` — exports diverged, or both old/new are identically broken (dormant file). Inspect manually.
- `FAIL` — new file throws or has a real regression. **Stop and investigate.**

`verify.js` appends the batch to `move-history.json` only on a fully clean (`fail==0`) pass.

### Step 5 — Hand-patch dynamic requires if any

Grep the new files for runtime path-joins:

```bash
grep -n "loadLibModule\|path.join(__dirname" src/features/baz/*.js
```

Any matches need manual updating to the new layout. Document each patch in the bible entry.

### Step 6 — Run check-conventions.js

```bash
node scripts/migration/check-conventions.js
```

Skim the resulting `results.gap-analysis.md` for new findings introduced by this batch. Boundary violations + new orphans are worth a moment.

### Step 7 — Write the bible entry

Append a new `### Batch NNN — `<name>`` section using the template from §5 above. Include:
- Moves table with SHA-256 confirmations from `results.move.json`.
- Import rewrites from `results.rewrite.json`.
- Any manual hand-patches.
- Verification output.

### Step 8 — Commit

One commit per batch. Squash internally if you want, but don't merge two batches into one commit. Add the short hash to the bible entry.

### Step 9 — (Optional) Re-run signal tests

```bash
node scripts/signal-tests/check-invariants.js
node scripts/signal-tests/check-identity-delta.js
```

Both are fast (~5s each) and catch refactor-induced surprises immediately.

---

## 8. Known patterns / gotchas

### 8.1 The `loadLibModule` pattern (extinct, but instructive)

The original `backend/persistence.js` and `backend/manifestGenerator.js` shared this idiom:

```js
const LIB_DIR = path.join(__dirname, '..', 'lib');
function loadLibModule(name) {
  try {
    const mod = require(path.join(LIB_DIR, name));
    return mod.default || mod;
  } catch (_) { return null; }
}
const tomlSerializer = loadLibModule('commands/integr8/tomlSerializer.js');
```

The AST rewriter **cannot see** this. `require(path.join(...))` is a function call with a runtime-computed argument — the rewriter only matches string literals inside `require()`. Each `loadLibModule` call that survived a move had to be hand-patched.

Why "extinct"? In batch 007's wrap-up, the last `loadLibModule` was converted to a plain `require()` once its target (`toml-serializer.js`) finally moved into a known location. The pattern was a transitional pre-move artifact; it doesn't appear anywhere in current `src/`.

**Lesson:** if you introduce dynamic requires, the AST rewriter is blind. Either use static `require()` with literal paths or document the dynamic call site so future moves know to hand-patch it.

### 8.2 The `file_registry` FK-cascade gotcha

`file_registry` is FK-referenced by `connections`, `file_intent`, `file_mutation_log` (and indirectly by some others). **SQLite enforces foreign keys per row** but the DELETE order matters.

Look at `src/core/database/persistence.js` lines 285-294 and 319-327:

```js
const _deleteFileTx = this.db.transaction((fp, fingerprint) => {
  this.deleteConnectionsForFile(fingerprint);
  this.deleteIntentForFile(fingerprint);
  this.deleteMutationLogForFile(fingerprint);
  // ... THEN delete the file_registry row
});
```

The pruner walks **per-fingerprint** inside a transaction, deleting referencing rows first, then the registry row. **Not per-filepath.** If you ever write a query like `DELETE FROM file_registry WHERE filepath NOT IN (...)`, you'll get FK violations because connections/intent/mutation-log still reference the about-to-be-deleted rows.

**Lesson:** any cleanup of `file_registry` must (a) operate per-fingerprint, (b) delete children first, (c) wrap in a transaction. Don't try to bulk-DELETE.

### 8.3 Dynamic requires the AST rewriter can't see

Same shape as `loadLibModule` but elsewhere. Examples that have appeared:

- `const tomlSerializer = require('../lib/commands/integr8/tomlSerializer.js')` — visible (string literal), rewriter handles it.
- `const tomlSerializer = require(path.join(__dirname, '..', 'lib', ...))` — invisible.
- `const tomlSerializer = require(\`${LIB_DIR}/integr8/tomlSerializer.js\`)` — invisible (template literal).
- Conditional `if (cond) require(X); else require(Y);` — both Xs and Ys are visible if literal strings, but only those that resolve correctly against the source location get rewritten.

**Lesson:** after every batch, grep `path.join` + `require` co-locations in the moved files. The bible documents each instance in batch 002 and 004.

### 8.4 `client: true` manifest flag — easy to forget

`verify.js` checks `m.client === true` to decide between full `require()` and `node --check` syntax probe. If you forget the flag on a browser-only file, `verify.js` will try to `require()` it and the require will throw on `window`/`document` — the file gets flagged as broken.

**Mitigation today:** the both-broken-identically check (added batch 017) means a browser file that throws identically on old + new will produce a WARN-pass instead of a FAIL. So forgetting the flag often just produces a noisy warning. But it's still a noise source.

**Lesson:** if you're moving a browser file (anything under `src/frontend/`), set `client: true`. See batch 012's manifest for the canonical example.

### 8.5 `manifest.json` is overwritten each batch

There's no archive of "what was in batch 005's manifest." It's clobbered by batch 006. The cumulative `move-history.json` records the `from`/`to` pairs that successfully verified — but the per-batch metadata (description, generatedAt, etc.) is lost.

**Mitigation today:** the bible captures most of what was in each manifest at the time. But if you want to reconstruct batch N's manifest exactly, you can't without git.

(Roadmap: `scripts/migration/manifest-history/` to archive each manifest.json on verify.)

### 8.6 No stage-originals reverse map

Given the path `OGB/lib/commands/typeParser.js.txt`, finding **which batch** moved it requires reading `move-history.json` and scanning the moves array for a matching `from`. There's no `OGB/index.json` or `git log` shortcut.

(Roadmap: reverse-history check — given a fingerprint or OGB path, find the batch.)

### 8.7 `0_*` planning docs persist outside `src/`

Batch 021 deleted `src/0_core/`, `src/0_features/`, `src/0_shared/`, `src/0_frontend/` (138 zero-prefix findings → 0). But at repo root, twelve `0_*.md` planning docs remain:

```
0_BACKEND_INDEX.md
0_FRONTEND_INDEX.md
0_INDEX_JS_INDEX.md
0_INDEXER_JS_INDEX.md
0_LIB_COMMANDS_INDEX.md
0_LIB_UTILS_INDEX.md
0_LINE_COUNT_REPORT.md
0_LINE_COUNT_REPORT_V2.md
0_MASTER_INDEX.md
0_PERSISTENCE_JS_INDEX.md
0_PRESSURE_TEST.md
0_SERVER_JS_INDEX.md
```

These are stale snapshots from a prior planning wave. They reference the `backend/` and `lib/` paths that no longer exist. They aren't in `src/` so `check-conventions.js` doesn't see them. They're tracked as tickets.

### 8.8 Move-history references `from` paths that no longer exist

By design — once `stage-originals.js` runs, the `from` paths are gone. The rewriter and identity-delta both handle this (the rewriter only uses `from` to compute the original resolution; the identity-delta checks both `from` and `to` and reports MISSING for files that exist nowhere on disk).

**Lesson:** don't try to "tidy" `move-history.json` by removing entries with missing `from` paths. The rewriter's history-awareness depends on the cumulative log.

---

## 9. The 12 layout-refactor batches at a glance

| Batch | Name | Moves | Notes |
|------:|------|------:|-------|
| 001 | shared | 6 | Leaves — utils + types. Set the kebab-case convention. |
| 002 | core-database | 2 | persistence + graph-persister. **Added history-awareness to rewriter.** First `loadLibModule` hand-patch. |
| 003 | lifecycle-watcher | 2 | bruno-oscar + file-watcher. Warmup batch. |
| 004 | schema-cards | 3 | emitter + printer + manifest-generator. Two `loadLibModule` hand-patches. |
| 005 | prd | 2 | generator + template-engine. No patches needed. |
| 006 | analysis | 3 | gap-analyzer + intent-seeder + insight-store. |
| 007 | integr8-core | 5 | 5 of 7 integr8 modules. Retargeted batch-004's provisional LIB_DIR. |
| 008 | indexing-parsers | 11 | Biggest batch — emptied lib/commands/integr8/ + most of lib/commands/. 21 auto-rewrites. |
| 009 | indexing-engine | 2 | indexer + notification-bus. |
| 010 | server-and-entry | 3 | server/main.js + server/app.js + verify-persistence-fixes. |
| 011 | launcher-rewire | 0 moves | Patched start.js + package.json. **Full end-to-end boot test passed.** |
| 012 | frontend-components | 6 | All 6 root frontend .js files. Added `client: true` support. |

And the post-move batches:

| Batch | Name | Purpose |
|------:|------|---------|
| 013 | st8-html-css-extraction | extract-css.js → 15 stylesheets |
| 014 | st8-html-js-extraction | extract-js.js → src/frontend/app.js |
| 015 | frontend-shell | new 142-line `src/frontend/index.html` |
| 016 | backend-static-fix-and-v2-route | fixed STATIC_DIR after the server move, added `/v2` route |
| 017 | background-indexer | last file in lib/. Added both-broken-identically check. |
| 018 | void-engine-fake-stream-cleanup | metadata reconciliation in st8-filemap.md |
| 019 | stage-originals-to-OGB | 46 originals → OGB |
| 020 | flip-default-to-new-shell | `/` now serves the slim shell; st8.html → OGB |
| 021 | post-refactor-cleanup-and-signal-tests | deleted `0_*` skeleton, fixed gap-analyzer paths, built tier 2 + tier 6 tests |

---

## 10. If you lose context, do this

1. Open this doc.
2. Open `st8_bible.md` and jump to L1705 (the batch log).
3. `cat /home/user/st8/scripts/migration/move-history.json` — that's the canonical list of every move that ever landed.
4. `find /home/user/st8/src -type f | sort` — that's the destination layout.
5. `find /home/user/st8/OGB -type f` — that's the inventory of retired originals.
6. `node /home/user/st8/scripts/migration/check-conventions.js` — current hygiene state.
7. `node /home/user/st8/scripts/signal-tests/check-invariants.js` — current pipeline health.
8. `node /home/user/st8/scripts/signal-tests/check-identity-delta.js` — per-file identity preservation.

That sequence rebuilds the entire mental model in roughly 30 minutes.

---

## 11. Files referenced in this doc

- `/home/user/st8/scripts/migration/manifest.json`
- `/home/user/st8/scripts/migration/move-history.json`
- `/home/user/st8/scripts/migration/move-files.js`
- `/home/user/st8/scripts/migration/rewrite-imports.js`
- `/home/user/st8/scripts/migration/verify.js`
- `/home/user/st8/scripts/migration/stage-originals.js`
- `/home/user/st8/scripts/migration/check-conventions.js`
- `/home/user/st8/scripts/migration/extract-css.js`
- `/home/user/st8/scripts/migration/extract-js.js`
- `/home/user/st8/scripts/migration/results.move.json`
- `/home/user/st8/scripts/migration/results.rewrite.json`
- `/home/user/st8/scripts/migration/results.verify.json`
- `/home/user/st8/scripts/migration/results.gap-analysis.md`
- `/home/user/st8/scripts/migration/results.css-extract.json`
- `/home/user/st8/scripts/migration/results.js-extract.json`
- `/home/user/st8/scripts/migration/results.stage-originals.json`
- `/home/user/st8/scripts/signal-tests/check-invariants.js`
- `/home/user/st8/scripts/signal-tests/check-identity-delta.js`
- `/home/user/st8/scripts/signal-tests/results.invariants.json`
- `/home/user/st8/scripts/signal-tests/results.identity-delta.md`
- `/home/user/st8/OGB/` — 48 .txt snapshots
- `/home/user/st8/st8_bible.md` — append-only batch log
- `/home/user/st8/st8-filemap.md` — file inventory reconciled in batch 018
- `/home/user/st8/src/core/database/persistence.js` — see §8.2 for the FK-cascade pattern
