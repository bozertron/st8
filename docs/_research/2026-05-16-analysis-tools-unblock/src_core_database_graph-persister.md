# Research — `src/core/database/graph-persister.js`

**Cluster:** persistence-and-database
**Ticket primarily in scope:** T2 — wire `graph/traversal.js` via the **lazy path** (this file is the abstraction we are SKIPPING)
**Adjacent ticket:** T3 — insight-store relocation (this file is the shared owner of `scaffolder_data.sqlite`)
**Wave:** analysis-tools-unblock-pass-1
**Date:** 2026-05-16

---

## 1. Identity (vendored, linguist-generated, single SHA)

`src/core/database/graph-persister.js` is a **vendored `tsc`-compiled artifact**. The first 34 lines are an explicit provenance banner (`src/core/database/graph-persister.js:2-34`); the rest is the compiled module body, ending with the source-map footer at `src/core/database/graph-persister.js:269` (`//# sourceMappingURL=databasePersister.js.map`).

Generator markers:
- `__createBinding` / `__importStar` / `__importDefault` helpers (`src/core/database/graph-persister.js:35-70`) — standard `tsc` emit.
- `Object.defineProperty(exports, "__esModule", { value: true })` (`src/core/database/graph-persister.js:71`).
- Trailing source-map line (`src/core/database/graph-persister.js:269`).

Repo-level provenance:
- `.gitattributes:13` — `src/core/database/graph-persister.js linguist-generated=true` with an explanatory header block (`/home/user/st8/.gitattributes:1-12`). GitHub collapses the diff and excludes the file from language statistics.
- Upstream: `maestro-scaffolder-tool/src/commands/integr8/databasePersister.ts` (named in `src/core/database/graph-persister.js:6` and `src/core/database/graph-persister.js:32`).

Git history is **three commits only** (`git log -- src/core/database/graph-persister.js`):

| SHA (short) | Subject |
|---|---|
| `cfb0f2e` | `chore(sonic): rename APP_ID to com.st8.app — st8 owns its identity (ticket 6)` |
| `57a3b3c` | `docs(persistence): document graph-persister.js as vendored tsc artifact (ticket 14)` |
| `8ddd4e7` | `refactor(core-database): migrate persistence + graph-persister to src/` |

Original landing path was `lib/commands/integr8/databasePersister.js`, moved in batch `core-database` (`scripts/migration/manifest-history.jsonl:2`). Other than the move and the two documentation-only commits, the body of the file has not been hand-edited — consistent with the READ-ONLY status declared in the banner.

---

## 2. Stated intent (header comment — exceptional documentation)

The banner at `src/core/database/graph-persister.js:2-34` is unusually thorough. Key bullets, verbatim:

> "**GENERATED ARTIFACT — DO NOT HAND-EDIT.**" (`src/core/database/graph-persister.js:3`)

> "Upstream: `maestro-scaffolder-tool/src/commands/integr8/databasePersister.ts` … Compiler: `tsc` (see the `__createBinding` / `__importStar` boilerplate and the trailing `//# sourceMappingURL=databasePersister.js.map` footer — both are tell-tale tsc output markers)." (`src/core/database/graph-persister.js:5-9`)

> "**READ-ONLY in this repo.** Any change must be made in the upstream `.ts` source and round-tripped back through `tsc`; hand-edits here will be silently clobbered the next time the maestro snapshot is re-vendored." (`src/core/database/graph-persister.js:11-14`)

> "`insight-store.js` (`src/features/analysis/`) imports `getSharedDatabasePath()` from this file to locate the project-scoped `scaffolder_data.sqlite` — a **DIFFERENT database file** from `st8.sqlite`, used by the integr8 pipeline." (`src/core/database/graph-persister.js:17-20`)

> "`sonic-indexer`, `sonic-queries`, `traversal`, `integr8/index`, `parser-persistence`, `background-indexer` all reference the `DatabasePersister` class for graph storage in `scaffolder_data.sqlite`." (`src/core/database/graph-persister.js:21-23`)

> "`persistence.js` (`st8.sqlite` owner) **deliberately does NOT use** the `DatabasePersister` class — **the maestro-fallthrough was removed in ticket 6**. The two databases are independent." (`src/core/database/graph-persister.js:24-26`)

The header also includes a second documentation block at `src/core/database/graph-persister.js:78-92` (above `getSharedDatabasePath()`) explaining the deliberate divergence between `com.scaffolder.app` (DB file location, stable) and `com.st8.app` (st8 identity, renamed in `ground-plane.js`/sonic — Wave 5B ticket 6 in **a different ticket numbering**: `cfb0f2e`).

This is among the best self-documented files in the tree; any T2 / T3 reasoning should treat the banner as authoritative.

---

## 3. Public surface

Two exports.

### 3.1 `getSharedDatabasePath(): string` (`src/core/database/graph-persister.js:93-106`)

Returns the platform-conventional Tauri-backend data path:

| Platform | Path |
|---|---|
| Linux | `~/.local/share/com.scaffolder.app/scaffolder_data.sqlite` |
| macOS | `~/Library/Application Support/com.scaffolder.app/scaffolder_data.sqlite` |
| Windows | `%APPDATA%/com.scaffolder.app/scaffolder_data.sqlite` (or `~/AppData/Roaming/...`) |

Pure function. Does not touch disk. The `com.scaffolder.app` suffix is intentionally retained even though `ground-plane.js` and sonic now use `com.st8.app` — see `src/core/database/graph-persister.js:84-91` for the rationale (renaming would orphan every developer's existing insights database; a future v2 must migrate rows).

### 3.2 `class DatabasePersister` (`src/core/database/graph-persister.js:107-267`)

Constructor: `new DatabasePersister(dbPath?)` — defaults to `getSharedDatabasePath()`. `mkdirSync` ensures the parent dir, opens better-sqlite3, sets `journal_mode = WAL`, `synchronous = NORMAL`, then calls `initializeDatabase()` (`src/core/database/graph-persister.js:108-116`).

| Method | Signature / Purpose | Location |
|---|---|---|
| `initializeDatabase()` | `CREATE TABLE IF NOT EXISTS` for `GraphNodes`, `GraphEdges`, `MigrationPlans`, `IntegrationSnapshots` + 5 indexes | L121-171 |
| `saveGraph(graphId, nodes, edges, properties)` | Insert nodes (with string-id → DB int-id remap), then insert edges in a single `db.transaction()` | L176-198 |
| `saveMigrationPlan(plan)` | `INSERT OR REPLACE` on `integration_id` UNIQUE | L202-208 |
| `saveSnapshot(integrationId, type, data)` | `INSERT` into `IntegrationSnapshots`; `type` is `'pre'` or `'post'` | L212-215 |
| `queryGraph(graphId)` | Re-read nodes + edges, reconstruct `SemanticGraph`-shaped object with `id: "node_<rowid>"` / `id: "edge_<rowid>"` reshape, `properties` stubbed to `{reachability:0, stability:0, fragility:0}` | L219-242 |
| `listGraphs()` | Aggregated summary `[{graphId, nodeCount, edgeCount, createdAt}]` | L246-260 |
| `close()` | `this.db.close()` | L264-266 |

`properties` argument to `saveGraph` is **accepted but never persisted** — `queryGraph` returns hard-coded zeros (`src/core/database/graph-persister.js:240`).

---

## 4. Callers

Verified via `grep -rn "require.*graph-persister" src/ tests/ scripts/`. **No tests import this file directly.**

| Caller | What it uses | Site |
|---|---|---|
| `src/features/analysis/insight-store.js:46` | `getSharedDatabasePath()` only — uses path to open its own DB and `CREATE TABLE IF NOT EXISTS` for `InsightRecords` / `FileInsightSlots` | (insight-store.js:50) |
| `src/features/analysis/insight-store-populator.js:39` | `getSharedDatabasePath()` for parent-dir mkdir before instantiating `InsightStore` | (insight-store-populator.js:59) |
| `src/features/graph/traversal.js:65` | `getSharedDatabasePath()` only — opens read-only better-sqlite3 against the path, queries `GraphNodes` / `GraphEdges` **directly via raw SQL** (does not instantiate `DatabasePersister`) | (traversal.js:107) |
| `src/features/integr8/index.js:55` | `new DatabasePersister(); persister.saveGraph(...); persister.saveMigrationPlan(plan);` | (integr8/index.js:124-128) |
| `src/features/indexing/background-indexer.js:60` | `getSharedDatabasePath()` for `options.dbPath` default | (background-indexer.js:120) |
| `src/features/indexing/parser-persistence.js:85` | `getSharedDatabasePath()` for default `resolvedPath` | (parser-persistence.js:88) |
| `src/features/search/sonic-indexer.js:30` | `getSharedDatabasePath()` for the sonic-side DB path | (sonic-indexer.js:214) |
| `src/features/search/sonic-queries.js:57` | `getSharedDatabasePath()` for query path default | (sonic-queries.js:86) |
| `src/features/indexing/indexer.js:60` | Dynamic load (`loadLibModule('../../core/database/graph-persister')`) — historical, see §5 | (indexer.js:58-60) |

**`persistence.js` does NOT import this file** (confirmed by the comment at `src/core/database/persistence.js:19-27`). The `loadLibModule`/`getDatabasePersister` helpers in `persistence.js` were dropped in ticket 6.

**Of the 8 importers under `src/features/`, only ONE instantiates the `DatabasePersister` class:** `src/features/integr8/index.js:125-127`, and only when `args.saveGraph` is truthy (the CLI's `--save-graph` flag). Everyone else takes `getSharedDatabasePath()` and runs raw SQL.

**Critical observation:** `src/features/graph/traversal.js` reads `GraphNodes` / `GraphEdges` rows but **nothing writes them** in normal indexer flow. Only `integr8/index.js`'s opt-in `--save-graph` populates them, and there is no `/api/save-graph` route or hook subscriber that invokes it. Probe of the live DB confirms (§7).

---

## 5. Prior work

### Ticket 6 (Wave 1A, persistence cluster) — the **"maestro-fallthrough was removed"** event

- **Commit:** `1f238e0` (per the review JSON; in the trimmed log the relevant DB commits are `cfb0f2e` / `57a3b3c` / `8ddd4e7`).
- **Source userNote:** "The maestro DatabasePersister fallthrough is silently degraded. `graph-persister.js` exports the class as `exports.DatabasePersister = DatabasePersister`, so the loaded module is the namespace object — `typeof === 'function'` is ALWAYS false, the maestro path NEVER runs, and we always reach the better-sqlite3 fallback." (`docs/_pending-tickets/persistence-and-database.for-review.json:88`)
- **Resolution:** Option (a) — dead branch removed. `loadLibModule`, `getDatabasePersister`, `_databasePersister`, and the unused `fs` import all deleted from `persistence.js`. `initialize()` now unconditionally constructs better-sqlite3 (`src/core/database/persistence.js:387-408`). **`graph-persister.js` itself was NOT modified** — left in place because `insight-store.js` still imports `getSharedDatabasePath()`.
- **Reviewer verdict:** ack (`docs/_pending-tickets/persistence-and-database.review.md:81-92`).
- **Cross-cluster note in the review:** "**`graph-persister.js`**: ticket 6 deliberately did NOT touch it (it's still imported by insight-store). No orphan introduced." (`docs/_pending-tickets/persistence-and-database.review.md:162-163`).

### Ticket 14 (Wave 1B, persistence cluster) — vendored provenance

- **Commit:** `57a3b3c` (`docs(persistence): document graph-persister.js as vendored tsc artifact (ticket 14)`).
- **Resolution:** Chose option (b) — READ-ONLY vendored. Shipped the 34-line header banner + new `.gitattributes` entry. `(docs/_pending-tickets/persistence-and-database.for-review.json:199-210)`.
- **Reviewer verdict:** ack. Confirmed 7 live importers under `src/features/` (the 8th in `indexer.js` is a dynamic load).

### Sonic-aligned Wave 5A/B (ticket 6 in a DIFFERENT numbering)

- **Commit:** `cfb0f2e`.
- Renamed `APP_ID` to `'com.st8.app'` in sonic / `ground-plane.js`, but **deliberately left `getSharedDatabasePath()` pointing at `com.scaffolder.app`** because the path is the on-disk DB location, not an identity (`src/core/database/graph-persister.js:84-91`).

### Roadmap

- **P2.6** (`docs/_pending-roadmap/persistence-and-database.md:67-74`) — explicit fallback log for maestro DatabasePersister. Option (a) was executed in ticket 6.
- **No roadmap item** suggests modifying `graph-persister.js`. The roadmap explicitly treats it as outside the `st8.sqlite` scope.

---

## 6. Existing tests

No tests under `tests/` import `graph-persister.js`. Confirmed:

```
grep -rn "graph-persister\|DatabasePersister\|getSharedDatabasePath" /home/user/st8/tests/
```

returns only `tests/scripts/signal-tests/tier-1-schema-contracts.test.js:188+229` — and that test **does not import the module**, it `fs.readFileSync`'s the JS source as text and runs regexes against the `CHECK(node_type IN (...))` / `CHECK(edge_type IN (...))` strings to assert the enums cover every parser-emitted entity kind. So even that file is a **textual contract check**, not a runtime test.

No unit tests for `saveGraph`, `saveMigrationPlan`, `queryGraph`, `listGraphs`, `getSharedDatabasePath`. None of the methods has any runtime test coverage.

---

## 7. Contracts

### 7.1 Tables in `scaffolder_data.sqlite` (declared by THIS file)

`initializeDatabase()` (`src/core/database/graph-persister.js:121-171`):

```sql
CREATE TABLE GraphNodes (
  node_id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_id TEXT NOT NULL,
  node_type TEXT CHECK(node_type IN
    ('file','store','route','command','type','import','export','component')),
  name TEXT NOT NULL,
  path TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE GraphEdges (
  edge_id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_id TEXT NOT NULL,
  from_node_id INTEGER NOT NULL,
  to_node_id INTEGER NOT NULL,
  edge_type TEXT CHECK(edge_type IN
    ('depends_on','imports','exports','navigates_to','invokes','conflicts_with','contains')),
  status TEXT CHECK(status IN ('SAFE','NEEDS_REWRITE','CONFLICT','MISSING')),
  confidence REAL DEFAULT 1.0,
  FOREIGN KEY (from_node_id) REFERENCES GraphNodes(node_id) ON DELETE CASCADE,
  FOREIGN KEY (to_node_id)   REFERENCES GraphNodes(node_id) ON DELETE CASCADE
);

CREATE TABLE MigrationPlans (
  plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  outcome TEXT CHECK(outcome IN
    ('SUCCESS','PARTIAL','FAILURE','AMBIGUOUS','REDIRECT')),
  estimated_complexity TEXT CHECK(estimated_complexity IN ('low','medium','high')),
  steps_json TEXT NOT NULL,
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL
);

CREATE TABLE IntegrationSnapshots (
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  integration_id TEXT NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  snapshot_type TEXT CHECK(snapshot_type IN ('pre','post')),
  data_json TEXT NOT NULL,
  FOREIGN KEY (integration_id) REFERENCES MigrationPlans(integration_id) ON DELETE CASCADE
);

CREATE INDEX idx_graph_nodes_graph_id  ON GraphNodes(graph_id);
CREATE INDEX idx_graph_edges_graph_id  ON GraphEdges(graph_id);
CREATE INDEX idx_graph_edges_from      ON GraphEdges(from_node_id);
CREATE INDEX idx_graph_edges_to        ON GraphEdges(to_node_id);
CREATE INDEX idx_snapshots_integration ON IntegrationSnapshots(integration_id);
```

Comment at L118-120 declares the schema must match the Tauri backend's `src-tauri/src/database/schema.rs` exactly — these tables are the Tauri side's view of `scaffolder_data.sqlite`, and this `.js` file is the Node-side mirror.

### 7.2 Tables in `scaffolder_data.sqlite` (declared by `insight-store.js`)

Declared at `src/features/analysis/insight-store.js:58-90`:

```sql
CREATE TABLE FileInsightSlots (
  file_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  total_insights INTEGER DEFAULT 0,
  last_pass_number INTEGER DEFAULT 0,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE InsightRecords (
  insight_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  pass_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  description TEXT NOT NULL,
  evidence TEXT DEFAULT '',
  related_node_ids TEXT DEFAULT '[]',
  context TEXT DEFAULT '{}',
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES FileInsightSlots(file_id) ON DELETE CASCADE
);
```

Five indexes (project, file, category, severity, timestamp DESC) plus an index on slots(project_id).

**Important:** these are NOT in `graph-persister.js` — `insight-store.js` runs its own `db.exec(...)` against the same file. The "shared owner" relationship is that **`graph-persister.js` only owns the path constant**; each consumer is responsible for declaring its own tables idempotently. This is what makes the file the de-facto "shared anchor" of `scaffolder_data.sqlite` even though it never sees the insight tables.

### 7.3 Live state of `scaffolder_data.sqlite` (PROBE)

```
node -e "open ~/.local/share/com.scaffolder.app/scaffolder_data.sqlite readonly"
```

| Table | Row count |
|---|---|
| `FileInsightSlots` | **300** |
| `InsightRecords` | **299** |
| `GraphNodes` | **(table does not exist)** |
| `GraphEdges` | **(table does not exist)** |
| `MigrationPlans` | **(table does not exist)** |
| `IntegrationSnapshots` | **(table does not exist)** |

**On this developer's machine, `DatabasePersister` has never been instantiated.** The DB was created by `insight-store.js`'s `ensureTables()` (which only declares its own two tables). The four tables declared by `graph-persister.js:initializeDatabase()` are not present because nothing has called `new DatabasePersister(...)` to trigger that DDL. The integr8 `--save-graph` flag (`src/features/integr8/index.js:124`) is the only path that would land them, and no normal indexer / server flow invokes integr8.

### 7.4 Vendored contract — no hand-edits ever

- Banner (`src/core/database/graph-persister.js:11-14`) is explicit: edits will be silently clobbered next re-vendor.
- `.gitattributes:13` makes review tools collapse the diff.
- Ticket 14 reviewNote: "Honest, well-scoped vendor-marking work." Any T2 / T3 work that requires *behavior* changes from this module must either (a) round-trip through the upstream `.ts` (out of scope and impractical here) or (b) write a thin wrapper / adapter elsewhere in `src/` and leave the vendored `.js` untouched.

---

## 8. Change vector

### 8.1 T2 — `graph/traversal.js` via the lazy path: **this file is NOT touched**

T2's chosen approach (per the traversal research report at `docs/_research/2026-05-16-analysis-tools-unblock/src_features_graph_traversal.md`) is to write a wrapper module that adapts `persistence.js` (`st8.sqlite`) queries to traversal's exported shapes, leaving the vendored `.js` untouched.

`graph-persister.js`'s relationship to T2:

- The **sonic-aligned (option b) alternative** that T2 is rejecting would populate `GraphNodes` / `GraphEdges` in `scaffolder_data.sqlite` from indexer output, making `graph-persister.js`'s `DatabasePersister.saveGraph` the write-side counterpart of `traversal.js`'s read-side raw SQL. The cost of that path is: it requires either standing up the integr8 pipeline as a first-class hook subscriber (currently `--save-graph` is CLI-opt-in only — `src/features/integr8/index.js:124`) or writing a new st8-side populator that re-implements `saveGraph` against the same vendored schema. Either way, **the schema is fixed by the Tauri side** (`src/core/database/graph-persister.js:118-120` declares parity with `src-tauri/src/database/schema.rs`), so any st8-driven population must conform to the `node_type` / `edge_type` / `status` enums — which is exactly what `tests/scripts/signal-tests/tier-1-schema-contracts.test.js` exists to assert.
- The **lazy (option a) path that T2 is choosing** routes traversal's reads against `st8.sqlite` via `persistence.js`, bypassing this file entirely. No part of `graph-persister.js` needs to change. The `linguist-generated=true` marker remains correct.

**T2 "skip" decision rationale, summarised:**

1. **Vendored / read-only.** Editing `DatabasePersister` to add a hook-driven `saveGraph` call would violate the banner at `src/core/database/graph-persister.js:11-14` and be clobbered on re-vendor.
2. **Dual-DB design is intentional and documented.** The banner (`src/core/database/graph-persister.js:24-26`), the `persistence.js` comment block (`src/core/database/persistence.js:387-401`), and `docs/components/persistence-and-database.md §6` all assert that `st8.sqlite` and `scaffolder_data.sqlite` are independent by design and that ticket 6 closed the only bridge between them.
3. **The integr8 pipeline isn't a runtime dependency of normal st8 flow.** Probe in §7.3 confirms `GraphNodes` table doesn't exist on a live machine — nothing populates it in normal operation. Wiring traversal to it would require building a new populator just to feed an empty table that the rest of st8 doesn't read.
4. **Tier-1 schema-contracts test already constrains the file via textual assertion** — `tests/scripts/signal-tests/tier-1-schema-contracts.test.js:184-240`. So the file's schema is treated as a fixed external contract, not a moving part.

### 8.2 T3 — insight-store relocation to `st8.sqlite`: residual surface after the move

If T3 moves `InsightRecords` / `FileInsightSlots` into `st8.sqlite` (the choice the insight-store research recommends), the implications for this file:

**What stays load-bearing:**

- `getSharedDatabasePath()` remains called by `src/features/graph/traversal.js:107`, `src/features/search/sonic-indexer.js:214`, `src/features/search/sonic-queries.js:86`, `src/features/indexing/parser-persistence.js:88`, `src/features/indexing/background-indexer.js:120`, `src/features/integr8/index.js:128`. These are the integr8 / sonic pipelines, which T3 is NOT relocating.
- `class DatabasePersister` remains the write-side for `--save-graph` (`src/features/integr8/index.js:125-127`).
- The four tables declared in `initializeDatabase()` remain the schema the Tauri backend mirrors (`src/core/database/graph-persister.js:118-120`).

**What's lost:**

- `insight-store.js:46` no longer imports the path helper — one importer drops out.
- `insight-store-populator.js:39` no longer needs the mkdir-parent dance — another importer drops out.

**What becomes a candidate for future cleanup (NOT this wave):**

- `DatabasePersister.saveGraph` / `saveMigrationPlan` / `saveSnapshot` / `queryGraph` / `listGraphs` — the entire **class** surface — is currently exercised by exactly one CLI flag (`--save-graph`). If `integr8` is ever retired or its persistence is moved into `st8.sqlite` too, the class becomes pure dead surface. Today: integr8 is vendored toolkit + read-only per `CLAUDE.md`; do not touch.
- `getSharedDatabasePath()` would still be called by the sonic / parser-persistence / background-indexer / traversal paths. Those would have to be re-pointed at `st8.sqlite` (and at `St8Persistence` getters) before this file could be removed.

**Residual sketch (post-T3 ONLY):**

```
src/core/database/graph-persister.js
├── getSharedDatabasePath()       ← still used by 6 sonic/integr8/graph files
└── class DatabasePersister
    ├── initializeDatabase()      ← creates 4 unused tables
    ├── saveGraph()               ← called only by integr8 --save-graph
    ├── saveMigrationPlan()       ← called only by integr8 --save-graph
    ├── saveSnapshot()            ← uncalled
    ├── queryGraph()              ← uncalled
    ├── listGraphs()              ← uncalled
    └── close()
```

Still meaningful as a vendored Tauri-mirror module; not meaningful as anything st8-internal.

---

## 9. Provisions already made

- **Vendored marker.** `.gitattributes:13` + the 34-line banner. Review tools collapse the diff; future readers cannot mistake the file for hand-edited.
- **Provenance trail.** Banner names the upstream path (`maestro-scaffolder-tool/src/commands/integr8/databasePersister.ts`), names the compiler (`tsc`), points at the tell-tale markers (`__createBinding`, source-map footer), and preserves the original two-line tsc header at the bottom of the block.
- **Dual-DB design committed.** Ticket 6 removed the bridge; `persistence.js:387-401` documents the choice in-line; `docs/components/persistence-and-database.md §6` documents it cluster-wide; the new boot log line records the design rationale on every startup (`src/core/database/persistence.js:408`).
- **Identity divergence handled.** `getSharedDatabasePath()` deliberately retains `com.scaffolder.app` after the `com.st8.app` rename in sonic — the comment block at `src/core/database/graph-persister.js:84-91` enumerates why and points at a future migration ticket.
- **Schema contract under test.** `tests/scripts/signal-tests/tier-1-schema-contracts.test.js` asserts the `node_type` / `edge_type` enums cover every parser-persistence entity kind via regex over the JS source. The file is treated as an external schema, not internal code.
- **Caller list audited.** Ticket 14's reviewNote independently verified all 7 (8 with `indexer.js`'s dynamic load) live importers under `src/features/` — and the absence of a `persistence.js` importer.

---

## 10. Gaps + open questions

1. **`scaffolder_data.sqlite` has no `GraphNodes` table on this machine.** The probe in §7.3 shows the database exists with 599 insight rows, but the four `DatabasePersister`-owned tables are absent. Is anything in the integr8 / sonic / traversal flows expected to write to those tables in normal st8 operation, or is the entire class genuinely cold storage waiting for a `--save-graph` invocation that never comes? If the latter, the case for the sonic-aligned T2 (option b) approach gets *weaker*, not stronger — you'd be building a populator for a table no consumer reads.

2. **Re-vendor cadence is undefined.** The banner says re-vendoring will clobber hand-edits, but there is no script in `scripts/` that pulls a fresh `databasePersister.ts` snapshot from upstream. Ticket 14's `residualConcerns` flagged this honestly: "If the maestro-scaffolder-tool upstream ships a breaking change … the seven importers under `src/features/` will silently break until someone re-vendors this file. There is no automated sync." Open question: is `maestro-scaffolder-tool` actively maintained, or is this effectively a frozen one-way vendor and the READ-ONLY status is in practice "WRITTEN ONCE, IGNORED FOREVER"?

3. **Post-T3, does this file's vendor sync still earn its keep?** If T3 lands and `insight-store.js` no longer imports `getSharedDatabasePath()`, the remaining importers are all sonic / integr8 / graph-traversal — each of which is itself a candidate for being routed into `st8.sqlite` in a later wave. If/when those follow, every callsite of `graph-persister.js` evaporates and the file becomes a dead vendor mirror. A future wave should consider: (a) leave it (cheap, accurate banner stays accurate), (b) delete it and let `tier-1-schema-contracts.test.js` re-read the schema from the Tauri-side `schema.rs` instead, (c) replace it with a 30-line `src/shared/utils/scaffolder-data-path.js` that exports just `getSharedDatabasePath()` and drop the `class` entirely.

4. **`DatabasePersister.saveGraph` accepts but ignores the `properties` argument.** `queryGraph` returns hardcoded zeros for `reachability` / `stability` / `fragility` (`src/core/database/graph-persister.js:240`). Is the Tauri upstream supposed to round-trip these somewhere we're not reading, or is this a known upstream gap? Out of scope here, but worth surfacing for whoever owns the maestro snapshot next.

5. **`integr8/index.js`'s `--save-graph` flag is the only writer.** No `/api/save-graph` route, no hook subscriber, no `npm run` script invokes it. Is the CLI flag itself reachable through any documented workflow today? If not, the entire write side of `DatabasePersister` is unreachable code in practice — and T2's "skip" decision is even more clearly correct.
