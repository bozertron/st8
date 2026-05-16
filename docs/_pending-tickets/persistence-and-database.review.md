# Persistence-and-Database — Wave 1A Review

## Summary
- Tickets reviewed: 9 (1A — indices 1, 2, 3, 5, 6, 7, 9, 12, 13)
- Tickets still open: 6 (1B — indices 0, 4, 8, 10, 11, 14 — not in scope)
- Ack: 9
- Kickback: 0
- Defer-confirmed: 0
- Wave **is** safe for Wave 1B to build on. Every behavioral claim in
  the executor's `actionsTaken` was independently verified — FK
  enforcement is live, drift detection is live, the cascade gap that
  fired SQLITE_CONSTRAINT_FOREIGNKEY on first boot under enforcement
  is closed, and the camel/snake validator forbids silent NULLs at
  the call site.

## Per-ticket findings

### Ticket idx 1 — deleteFile rewritten per-fingerprint
- Commit: 1363afe
- Verdict: ack
- What I verified:
  - `deleteFile` (persistence.js L490+) uses `getAllFilesByPath`,
    iterates every fingerprint, calls all four cascade helpers
    (connections / intent / mutation_log / tickets), then DELETEs
    BY FINGERPRINT.
  - Multi-fingerprint probe: inserted two rows for `foo.js` at
    different birthTimestamps, ran `deleteFile('foo.js')` → both
    rows removed, `.fingerprint` returns the newest one, `.fingerprints`
    returns the full set newest-first, FK check returns `[]`.
  - Prominent JSDoc on `deleteFile` records the foot-gun (was the
    userNote's lowest-cost option; executor did the rewrite instead).
- Concerns: none.

### Ticket idx 2 — PRAGMA foreign_keys = ON
- Commit: 1363afe
- Verdict: ack
- What I verified:
  - `this.db.pragma('foreign_keys = ON')` at persistence.js L303,
    runs after WAL/synchronous and before `ST8_SCHEMA` apply.
  - Live probe: `pragma('foreign_keys')` returns `[{foreign_keys:1}]`;
    `foreign_key_check` returns `[]`; `integrity_check` returns `ok`.
  - `node start.js .` boots, indexes 281 files, no FK errors.
  - Inline comment in initialize() explains why JS-side cascade is
    still required (no `ON DELETE CASCADE` — deliberate, so
    mutation_log can be written before deletion).
  - Residual concern (future writers + logMutation/insertConnection
    needing a validator like logActivity's) is honest and bounded:
    main.js calls `upsertFile` before every `logMutation` /
    `insertConnection` at lines 129→145, 297→299, 350→352.
- Concerns: none.

### Ticket idx 3 — snake → camel in _handleTickets + logActivity validator
- Commit: bec7145
- Verdict: ack
- What I verified:
  - `grep target_fingerprint src/core/server/app.js` → no matches.
  - app.js:1558 now writes `targetFingerprint: payload.fingerprint`.
  - `logActivity` in persistence.js whitelists
    `{source, action, targetFingerprint, details}` and **throws**
    (not logs) on unknown keys with a descriptive message.
  - In-memory probe: snake_case rejected, camelCase passes.
- Concerns: none. The "throw, don't log" choice is the right
  asymmetry for a bug pattern that would otherwise recur silently.

### Ticket idx 5 — EXPECTED_SCHEMA + boot-time introspection
- Commit: 477dbee
- Verdict: ack
- What I verified:
  - `EXPECTED_SCHEMA` const sits above the class (L201+) listing
    all 9 tables and their columns; matches `ST8_SCHEMA` exactly.
  - `introspectSchema()` runs `sqlite_master` + `PRAGMA table_info`,
    returns structured diff, `initialize()` logs
    `[st8:persistence:drift]` warnings.
  - Drift probe: ALTER ADD COLUMN bogusCol + CREATE TABLE rogue_table
    → `hasDrift=true`, both flagged.
  - Catch block uses `console.error` (not silent) — drift detection
    never blocks boot, which is correct.
  - Residual concern (name-only, no type check) is honestly flagged.
- Concerns: none.

### Ticket idx 6 — dead maestro DatabasePersister branch removed
- Commit: 1f238e0
- Verdict: ack
- What I verified:
  - Executor chose option (a) — branch removed entirely, not
    log-leveled. `loadLibModule`, `getDatabasePersister`,
    `_databasePersister`, and the unused `fs` import all gone.
  - `initialize()` unconditionally constructs better-sqlite3.
  - New log line records design intent in-line.
  - `graph-persister.js` correctly retained for insight-store's
    `getSharedDatabasePath()` (separate DB).
- Concerns: none.

### Ticket idx 7 — ai_content's intentional decoupling documented
- Commit: 3396fb7 (with 8f0b27c as the intermediate that broke
  module load by using backticks inside the template literal)
- Verdict: ack
- What I verified:
  - 19-line block-comment above the `ai_content` DDL in `ST8_SCHEMA`.
  - Real explanation, not a one-liner: covers WHY filepath
    (not fingerprint), WHY no FK, WHY NOT in cascade, plus the
    explicit four-step reversal checklist.
  - Caller audit (`grep storeAIContent|appendAIContent`) returns
    only the two definitions inside persistence.js — no external
    consumers exist, so the loose-coupling decision is safe.
  - Executor honestly disclosed the backtick-escape regression
    they caused and fixed in the actionsTaken — exactly the kind
    of disclosure that builds trust.
- Concerns: none.

### Ticket idx 9 — tickets cascade hook
- Commit: 1363afe (bundled with 1/2/13)
- Verdict: ack
- What I verified:
  - `deleteTicketsForFile(fingerprint)` exists at persistence.js L659.
  - Wired into BOTH cascade paths: `deleteFile` (per-fingerprint
    loop) and `pruneFilesNotIn` (per-fingerprint loop at L399).
  - End-to-end: upsertFile → createTicket → deleteFile under
    `foreign_keys = ON` → `foreign_key_check` returns `[]`.
- Concerns: `verify-persistence-fixes.js` doesn't yet probe ticket
  cascade specifically. The smoke script's CR-02 only covers
  `file_mutation_log` cascade. Adding a CR-04 for tickets cascade
  is a low-cost improvement but **not a kickback** — out of scope
  for this ticket's brief.

### Ticket idx 12 — storeAIContent → appendAIContent rename
- Commit: 10946cd
- Verdict: ack
- What I verified:
  - `appendAIContent` at L1013 — plain INSERT, no OR REPLACE.
  - `storeAIContent` at L1026 retained as `@deprecated` thin alias.
  - userNote allowed either option; retaining the alias is the
    lower-risk choice.
  - "Internal callers updated" is vacuously true — no external
    consumers.
- Concerns: none.

### Ticket idx 13 — getFileByPath ORDER BY birthTimestamp DESC
- Commit: 1363afe (bundled with 1/2/9)
- Verdict: ack
- What I verified:
  - SQL is exactly `... WHERE filepath = ? ORDER BY birthTimestamp DESC`.
  - `.get()` returns newest row; new `getAllFilesByPath` returns `.all()`.
  - Multi-fingerprint probe: 2025 fingerprint wins in `getFileByPath`;
    both fingerprints returned newest-first in `getAllFilesByPath`.
  - Design choice (preserve one-row return shape for ~10 server.js
    consumers, add `getAllFilesByPath` for callers that need the
    full set) is the right minimum-blast-radius fix.
- Concerns: none.

## Cross-cluster flags

None for Wave 1A. The two cross-cluster touchpoints are:

- **Ticket 3** (`src/core/server/app.js:1558`): the executor's diff
  touched `app.js` per the userNote, which explicitly invited the
  cross-cluster edit. The original ticket lives in
  `hooks-and-integration.json`; that cluster's reviewer should
  confirm closure on their side. Not a flag — it's the documented
  cross-cluster pair.
- **`graph-persister.js`**: ticket 6 deliberately did NOT touch it
  (it's still imported by insight-store). No orphan introduced.

## Recommendation for Wave 1B

Wave 1A leaves the cluster in a state where:

1. FK enforcement is live and every existing INSERT path tested
   clean. The migration framework (ticket 0, Wave 1B) inherits a
   DB where `foreign_keys = ON` from boot — migrations must be
   FK-safe by construction or wrap in a `PRAGMA foreign_keys = OFF`
   transaction explicitly. Document the choice in the migration
   harness.
2. `EXPECTED_SCHEMA` exists and is the right place to assert the
   migration-runner mutation landed. Wave 1B's migration framework
   should call `introspectSchema()` after each migration step and
   throw on residual drift.
3. `appendAIContent` is now the canonical method. Any new caller
   (Wave 1B's `@@@` pipeline wire-up, if any) should target
   `appendAIContent`, not `storeAIContent`.
4. The `deleteTicketsForFile` cascade pattern is the template
   for any new FK'd table Wave 1B introduces (tickets 0, 4 may
   land such tables). The two cascade paths to wire are
   `deleteFile` AND `pruneFilesNotIn` — easy to miss the latter,
   which is exactly the bug ticket 9 caught.

One non-actionable observation for the founder: the executor's
choice to **throw** on logActivity unknown-keys (rather than log
and continue) is the right shape and should probably propagate
to `logMutation` and `insertConnection` in a future ticket — the
executor flagged this as a residual concern under ticket 2.
Worth keeping on the radar.

---

## Wave 1B Review

### Summary
- Tickets reviewed: 6 (1B — indices 0, 4, 8, 10, 11, 14)
- Ack: 5
- Kickback: 0
- Defer-confirmed: 1 (ticket 0 — migration framework)
- Cluster total: 14 ack / 0 kickback / 1 defer-confirmed across all
  15 persistence tickets.
- Cluster **is** safe for Wave 2 (hooks) to build on. The new
  P=50 mutation-log-retention subscriber slots cleanly between the
  P=40 intent-seeder and the P=90 force-check chain — Wave 2's hook
  work inherits a registry that already demonstrates the
  isolation-via-try/catch pattern under load.

### Per-ticket findings

#### Ticket idx 0 — Migration framework (DEFERRED)
- Commit: none (deferral)
- Verdict: defer-confirmed
- What I verified:
  - Opened `docs/_pending-roadmap/persistence-and-database.md:9` —
    line 9 is exactly the P1.1 "SQLite migration framework"
    heading. The roadmap bullet list (numbered migration files,
    `_migrations` table, `applyMigrations()` step, `db:migrate`
    CLI, migration 001 to fold the five post-initial columns)
    matches the executor's actionsTaken nearly verbatim.
  - The deferral pointer in actionsTaken (`persistence.js (L245+, L431+)`,
    `deleteTicketsForFile cascade pattern (L659)`) lines up with
    Wave 1A's actual landing sites — those are the surfaces a
    future migration framework will integrate with.
  - residualConcerns honestly notes the workaround contributors
    must keep using (`delete st8.sqlite` or one-off ALTER) and
    that the introspection diff will surface the gap as
    `[st8:persistence:drift]` warnings.
- Concerns: none. This is roadmap-shaped multi-day work; a
  half-implementation in a sub-wave would have been the dishonest
  choice. Deferral confirmed legitimate.

#### Ticket idx 4 — verify-persistence-fixes.js → scripts/
- Commit: d53906f
- Verdict: ack
- What I verified:
  - `git ls-files scripts/verify-persistence-fixes.js` returns the
    path; `git ls-files src/core/database/verify-persistence-fixes.js`
    returns nothing.
  - `git show --stat d53906f` confirms 97% rename similarity →
    git rename history preserved.
  - Internal `require('./persistence')` updated to
    `require('../src/core/database/persistence')` — visible in
    the diff.
  - `node scripts/verify-persistence-fixes.js` from the new
    location reports `=== Results: 10 passed, 0 failed ===`.
  - The check-conventions.js entry-points list update at line 330
    is real — the diff shows the single-line swap from
    `'src/core/database/verify-persistence-fixes.js'` to
    `'scripts/verify-persistence-fixes.js'` inside
    `expectedOrphans`.
- Concerns: none. Surgical move; no behavior change.

#### Ticket idx 8 — providers table + claimTicket validator
- Commit: 53a9fd0
- Verdict: ack
- What I verified:
  - In-memory boot seeds 8 providers exactly as listed
    (anthropic, custom, google, human, lmstudio, ollama, openai,
    openrouter).
  - `claimTicket(id, 'nonsense-provider')` throws RangeError with
    the descriptive message listing all 8 known providers.
  - `claimTicket(validId, 'anthropic')` returns `changes=1`.
  - EXPECTED_SCHEMA row for `providers` exists so the
    introspector confirms the table landed.
  - The block comment above the providers DDL records the
    deferred SQL-level FK rationale and points at ticket 0's
    migration framework as the gate — the executor honestly
    flagged the FK as out-of-scope rather than hand-waving it.
  - residualConcern (3) about `src/frontend/components/settings/settings.js:44`
    LLM_PROVIDERS duplication is real — confirmed by reading the
    frontend file: lines 44-53 are the duplicated 7-entry
    registry. The executor's note matches.
- Concerns: none. The JS-side validator-throw mirrors Wave 1A's
  logActivity pattern — loud-bug-beats-quiet-bug propagated
  correctly.

#### Ticket idx 10 — mutation_log retention policy
- Commit: 8a570f5
- Verdict: ack
- What I verified (this was the trickiest one to audit):
  - `pruneMutationLogRetention` exists in persistence.js with the
    correct WHERE clause:
    `DELETE FROM file_mutation_log WHERE mutationType NOT IN ('PRODUCTION','PURGE') AND timestamp < ?`.
  - Note: the reviewer brief sketched the filter as
    `lifecyclePhase IN ('CONCEPT','DEVELOPMENT','CONTENT')`, but
    `docs/components/persistence-and-database.md §2.4` is
    explicit that `mutationType` (not `lifecyclePhase`) takes the
    values `CONCEPT`/`PRODUCTION`/`PURGE`/content-strings.
    Executor used the doc-aligned dimension and inverted the
    filter correctly.
  - Synthetic probe: inserted old CONCEPT (2025-01-01), old
    PRODUCTION (2025-01-01), new CONCEPT (today), called
    `pruneMutationLogRetention(30)` directly → `prunedRows=1`,
    PRODUCTION preserved, new CONCEPT preserved. Policy correct.
  - P=50 priority confirmed in `default-subscribers.js` between
    intent-seeder (P=40) and force-checks (P=90).
  - The 24h gate is **real** persistence-backed via
    `getSetting('persistence','mutationLogLastPruneAt')` +
    `upsertSetting(...)`. This is the form the brief required —
    NOT a hardcoded module-scope variable that resets on each
    boot.
  - try/catch wraps the whole subscriber, with
    `console.error('[st8] file_mutation_log retention failed:', err.message)`
    on the catch path — failures surface, not swallowed.
  - Method-presence guard
    (`typeof persistence.pruneMutationLogRetention !== 'function'`)
    keeps the subscriber compat with older persistence instances.
- Concerns: none. The hardcoded-30-days residualConcern is
  honest and explicitly out-of-scope per the brief.

#### Ticket idx 11 — prd_projects audit (LIVE)
- Commit: 5690285
- Verdict: ack
- What I verified:
  - 22-line block comment above the `prd_projects` DDL in
    ST8_SCHEMA — git stat confirms exactly 22 insertions.
  - Every wiring claim in the comment verified independently:
    - `src/frontend/index.html:143` — CREATE PROJECT button with
      `onclick="createPRDProject()"`.
    - `src/frontend/app.js:277` — `window.createPRDProject = async function()`.
    - `src/core/server/app.js:127 + 1088` — `/api/prd-projects`
      routes (GET list / GET :name / POST create).
  - `grep -rn 'updatePRDProject\|deletePRDProject' src/ scripts/`
    returns only the method definitions in persistence.js plus
    the documentation comment itself — zero external callers,
    confirming "reserved for future PRD UI" is honestly
    truthful, not a hand-wave.
- Concerns: none. Pure documentation commit; no code-path
  change.

#### Ticket idx 14 — graph-persister.js provenance
- Commit: 952410f
- Verdict: ack
- What I verified:
  - Header block runs lines 2-34 of
    `src/core/database/graph-persister.js` and documents:
    upstream source location
    (`maestro-scaffolder-tool/src/commands/integr8/databasePersister.ts`),
    regeneration process (tsc, evidenced by the
    `__createBinding`/`__importStar` boilerplate + trailing
    source-map footer), READ-ONLY status, every live importer's
    purpose, pointer to .gitattributes. Original 2-line tsc
    header preserved as the final comment line.
  - `/home/user/st8/.gitattributes` exists with
    `src/core/database/graph-persister.js linguist-generated=true`
    plus an explanatory comment block.
  - 7-importer claim verified via `grep -rn 'require.*graph-persister' src/`:
    sonic-indexer.js:22, sonic-queries.js:57, traversal.js:65,
    integr8/index.js:55, insight-store.js:46,
    parser-persistence.js:45, background-indexer.js:60 — exactly
    seven under `src/features/`. The persistence.js match is a
    documentation reference (correctly excluded).
- Concerns: none. The "no automated sync" residualConcern is
  honest about the cost of the read-only-vendored decision.

### No-cheats sweep findings

- `git diff 7c49b51..d834c4c -- src/ scripts/` is 452 lines, all
  hand-reviewed.
- Zero `TODO` / `FIXME` / `implement later` / `XXX` markers.
- Two new try/catch blocks audited — both surface failures via
  `console.error` (provider-seed + retention-prune). Neither
  swallows silently. The retention catch was specifically
  flagged in the brief as intentional and verified to log.
- Zero `process.env.NODE_ENV === 'test'` or `if (skipReal)`
  style bypasses.
- Zero empty function bodies.
- All deferrals (just ticket 0) point at a real, multi-day
  roadmap item with surface area enumerated.

### Cross-cluster flags for the founder

1. **LLM_PROVIDERS duplication** —
   `src/frontend/components/settings/settings.js:44-53` is now a
   duplicate of the backend `CANONICAL_PROVIDERS` in
   `persistence.js`. The settings-and-providers cluster (Wave
   5b) is the natural owner; the cleanest follow-up is to expose
   `/api/providers` (read) and have the frontend fetch the list
   rather than hard-code it. Flagged in ticket 8's
   residualConcerns; surfacing here for cross-cluster visibility.
2. **Wave 5b dependency** — `getAllProviders` /
   `upsertProvider` / `deactivateProvider` are persistence-side
   ready but have no HTTP routes yet. Wave 5b owns wiring them.
3. **Hard SQL FK on `tickets.claimedBy` → `providers.id`** is
   gated on ticket 0's migration framework. JS-side enforcement
   is equivalent for correctness today (single mutation method),
   but a future founder reading the schema should know the FK is
   declared in the providers block comment as a
   migration-framework deliverable.

### Recommendation for Wave 2

Wave 1B leaves the cluster in a state where:

1. The hook registry has its first non-trivial persistence-side
   subscriber (P=50 mutation-log retention) demonstrating the
   isolation-via-try/catch + method-presence-guard + persistence-backed-gate
   pattern. Wave 2 should adopt this shape for any new
   persistence-touching subscribers.
2. The providers table is the first new FK'd table since the
   tickets table — Wave 2 hook work that wants to introduce more
   provider-typed event sources can build against
   `getAllProviders` directly without re-touching the persistence
   layer.
3. The migration framework deferral is a known, named follow-up;
   any Wave 2 hook work that needs new columns should expect to
   land alongside the migration framework, not before it.
