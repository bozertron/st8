# Roadmap — Persistence & Database

Derived from the persistence cluster fact-finding pass over `/home/user/st8/src/core/database/`, the bible's batch-002/010/022/026 entries, and the batch-031 tickets-table addition. Ordered by founder impact + risk-of-loss.

---

## Priority 1 — Foundational debt that's already biting

### P1.1 — SQLite migration framework

The single biggest debt in this cluster. Today every new column relies on either deleting `st8.sqlite` or applying an out-of-band `ALTER TABLE`. The five columns added after the initial DDL (`needsAIReview`, `tripleAtCount`, `aiContentInjected`, `templateVariables`, `hasUnfilledVariables`) silently don't exist on any DB created before they were added.

Surface area to build:

- `src/core/database/migrations/00X_name.sql` — numbered migration files (or .js for ones that need procedural logic).
- `_migrations` table tracking the highest applied migration number + applied-at timestamp.
- `applyMigrations()` step inside `St8Persistence.initialize()` that runs after the bare `ST8_SCHEMA` apply and brings any older DB up to current.
- A `npm run db:migrate` script for manual application.
- Migration 001 = "fold the five post-initial columns into a proper ALTER sequence" so they actually exist on legacy databases.

**Dependency:** none — this is purely additive to `persistence.js`. The schema string can stay as the "create everything fresh" path; migrations are the "bring stale DBs forward" path.

### P1.2 — Fix `activity_log.targetFingerprint` camel/snake mismatch

`app.js:1558` writes `target_fingerprint` while the schema and `logActivity` expect `targetFingerprint`. Every TICKET_CREATED activity row has a null fingerprint. Two-line fix in `app.js`; the cluster-wide question is whether `logActivity` should validate its input keys (throw on unknown) to prevent the next iteration of this bug.

Also flagged in `hooks-and-integration.json` — execute once, settles both clusters.

### P1.3 — Enable `PRAGMA foreign_keys = ON`

The schema declares FK relationships on connections, file_intent, file_mutation_log, and tickets, but SQLite doesn't enforce them because the pragma is never set. Manual JS-side cascade in `deleteFile` / `pruneFilesNotIn` is the only thing keeping integrity, and `deleteFile` has the known foot-gun (P2.2). Enabling FKs will likely surface latent orphans on first turn-on; the work is (a) flip the pragma in `initialize()`, (b) run on a real `st8.sqlite`, (c) clean up whatever orphan rows surface, (d) fix the producer that created them.

---

## Priority 2 — Quality-of-life and integrity tooling

### P2.1 — `db:doctor` CLI

A health-check command that boots persistence, runs:

- `SELECT COUNT(*)` against every one of the 9 tables → row count report.
- `PRAGMA integrity_check` → schema/index consistency.
- `PRAGMA foreign_key_check` → list of orphan rows by table.
- Filepath-to-fingerprint-count distribution (flags files with >1 fingerprint — the deleteFile foot-gun candidates).
- Open-tickets-without-file count (the cascade gap from the tickets ticket).

Output: a human-readable markdown table + an exit code. Useful both as a manual diagnostic and as a step in CI / `force-checks`.

### P2.2 — Schema-introspection helper at boot

Compare `ST8_SCHEMA`'s declared columns against `PRAGMA table_info(<each table>)` on the live DB. Log a diff if drift is detected. Pairs naturally with P1.1 (the migration framework decides what to do; the introspector decides whether to do it).

Implementation: parse `ST8_SCHEMA` once at boot (or maintain a parallel `EXPECTED_SCHEMA = {tables: {...}}` constant), iterate over each declared table, compare names + types + defaults. Log `[st8:persistence:drift]` warnings on mismatch.

### P2.3 — Fix `deleteFile` per-fingerprint, not per-filepath

Rewrite `deleteFile(filepath)` to iterate over **all** fingerprints associated with the filepath (via `SELECT fingerprint FROM file_registry WHERE filepath = ?`) and cascade each one — same shape as `pruneFilesNotIn` already does. Today's implementation works for the common case (one row per filepath) but FK-corrupts on the multi-row case. Once `PRAGMA foreign_keys` is on (P1.3), today's implementation will start throwing.

### P2.4 — Move `verify-persistence-fixes.js` to `scripts/`

Per batch 021's agent feedback: scripts belong under `scripts/`. The verifier is invoked only via the migration verify harness's sub-process probe — it has no library callers. Move to `/home/user/st8/scripts/verify-persistence-fixes.js`, update the single internal require, update any references in `scripts/migration/verify.js`.

### P2.5 — `tickets` cascade hook

Add `deleteTicketsForFile(fingerprint)` and call from both `deleteFile` and `pruneFilesNotIn`. Same shape as the existing three cascade helpers. Cheap to add, eliminates one dangling-FK class.

### P2.6 — Explicit fallback log line for maestro DatabasePersister

The current `[st8:persistence] Using better-sqlite3 directly` log line reads as a normal success message. It is actually the result of the maestro `typeof === 'function'` guard always failing (since `graph-persister.js` exports the class as a named export, not a callable default). Either:

- **(a)** Remove the dead branch entirely and document `[st8:persistence] Initialised better-sqlite3 (st8.sqlite owns its own schema; maestro DatabasePersister is project-scoped to scaffolder_data.sqlite)`.
- **(b)** Keep the branch but log the fallthrough as `[st8:persistence:warn] maestro DatabasePersister not callable — using better-sqlite3 directly`.

Option (a) is the cleaner finish; option (b) preserves the symmetry-with-maestro intent.

---

## Priority 3 — Strategic / longer-horizon

### P3.1 — `file_mutation_log` retention policy

Append-only with no rotation. A long-lived project will see this table grow to millions of rows. Define a policy:

- **Keep forever:** `PRODUCTION`, `PURGE`, lifecycle-transition mutations.
- **Prune after N days:** `CONCEPT`, dev-phase content mutations.
- **Compact:** group successive content-change mutations on the same file into a single span row.

Wire as a periodic INDEX_COMPLETE subscriber gated on `lastPrune > N days ago`, or a `db:prune` CLI for manual execution.

### P3.2 — Backup / restore CLI

`settings.json` currently has a `backup_schedule = daily` key with no implementation. Build:

- `npm run db:backup` — copies `st8.sqlite` + `st8.sqlite-wal` + `st8.sqlite-shm` to `.st8/backups/<ISO-timestamp>/`.
- `npm run db:restore <timestamp>` — atomic swap (rename current → `.broken`, rename backup → current).
- A boot-time check that enforces the scheduled cadence.

Cheap; the only subtlety is making it WAL-safe (`VACUUM INTO` or `.backup` are the two SQLite idioms).

### P3.3 — Provider table for tickets

`tickets.claimedBy` is freeform TEXT today. If the LLM-collaborator channel becomes load-bearing, introduce:

```sql
CREATE TABLE providers (
  id TEXT PRIMARY KEY,        -- 'anthropic', 'openai', 'local'
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL,         -- 'cloud', 'local', 'human'
  api_key_envvar TEXT,
  active INTEGER DEFAULT 1
);
```

Make `tickets.claimedBy` a FK to `providers.id`. Enables per-provider analytics and prevents typos. Today the constraint is unnecessary; the moment we add a UI that filters open tickets by provider, this matters.

### P3.4 — Table-aware ticket schema

`tickets.identityBundle` is JSON TEXT. Querying "all open tickets whose intent.purpose contains 'auth'" today requires a `LIKE` over JSON or full-row scan + parse-in-JS. SQLite's JSON1 extension supports indexed JSON paths; either:

- **(a)** Index the bundle via `CREATE INDEX idx_tickets_purpose ON tickets(json_extract(identityBundle, '$.intent.purpose'))`.
- **(b)** Denormalize the most-queried fields (purpose, valueStatement, status) into their own ticket columns and keep the bundle as the audit snapshot.

Decide once we have a real query pattern.

### P3.5 — Audit prd_projects usage

The `prd_projects` table has full CRUD methods (`createPRDProject`, `getPRDProject`, `getAllPRDProjects`, `updatePRDProject`, `deletePRDProject`). It is unclear whether anyone writes to it on a normal indexer pass. Audit consumers; if dormant, document as queued PRD-system support and leave; if dead, delete the table and methods.

### P3.6 — Bound `ai_content` with a FK or document the lack

`ai_content` references `filepath` as freeform TEXT. Either bring it under file_registry (FK on fingerprint, cascade on deleteFile/pruneFilesNotIn) or leave it loose and add a schema comment explaining the design (content may arrive before the file is indexed). Today's silent decoupling will eventually confuse anyone trying to reason about cascade rules.

---

## Cross-references

- The hooks-and-integration cluster owns the `target_fingerprint` write site — P1.2 is split work.
- The identity-and-analysis cluster owns `file_intent` semantics — schema lives here, contents live there.
- The frontend-experience cluster reads `tickets` via `/api/tickets` — P3.3/P3.4 will surface in UI work too.
