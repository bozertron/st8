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
