# hooks-and-integration

Cluster: **hooks-and-integration-plumbing** — the named hook system, its built-in
subscribers, the force-check integrity layer, the post-commit git hook, and the
HTTP routes that fire cross-process hooks.

Source files in scope:

| File | Role |
|---|---|
| `src/core/hook-registry.js` | `HookRegistry` class + `HOOKS` name constants + singleton |
| `src/core/hooks/default-subscribers.js` | Built-in subscribers wired by `registerDefaultSubscribers()` |
| `src/core/hooks/force-checks.js` | 6-check integrity report, P=90 `INDEX_COMPLETE` subscriber |
| `src/core/server/main.js` | Calls `registerDefaultSubscribers`/`registerForceChecks`; fires `INDEX_START`, `FILE_INDEXED`, `INDEX_COMPLETE` |
| `src/core/server/app.js` | `_handleRecordCommit` fires `COMMIT_RECORDED`; `_handleTickets` fires `TICKET_CREATED` |
| `scripts/git-hooks/post-commit` | Shell hook: POSTs commit metadata to `/api/record-commit` |
| `scripts/git-hooks/install.sh` | Symlink installer for the shell hook |

Design context: `.planning/st8_prd_system/HOOK-ARCHITECTURE-RESEARCH.md` §8.1
identified the inline post-index orchestration in `main.js` as 70% implemented;
batch 023 replaced it with the named registry. Batch 024 added the post-commit
hook. Batch 025 added the force-check pass and fixed a wrong-hook bug (commit
events were briefly fired on `LIFECYCLE_TRANSITION` before `COMMIT_RECORDED` was
introduced). Batch 027 added the Sonic daemon `INDEX_START` subscriber. The
`TICKET_CREATED` hook is the most recently added — it was wired into the
canonical `HOOKS` map but is not yet covered in the bible.

---

## Purpose

The hook system is the structural seam between st8's pipeline stages. The
indexer, manifest writer, schema-card emitter, gap analyzer, intent seeder,
force-check pass, Sonic daemon, and any future plugins all coordinate through
named hook points instead of inline procedural code. Subscribers register with a
priority and a source tag; the registry runs them in priority order, awaits each
async handler, and isolates failures so one bad subscriber cannot break the
chain. The same registry is also fired from cross-process entry points —
specifically the post-commit git hook (`/api/record-commit` → `COMMIT_RECORDED`)
and the ticket-creation route (`POST /api/tickets` → `TICKET_CREATED`) — so
external events join the same publish/subscribe surface as in-process events.

---

## The named hook points

All canonical names live in `src/core/hook-registry.js` as the frozen `HOOKS`
constant. Publishers and subscribers should import from there; passing string
literals works (the registry uses string keys) but loses grep-ability.

| Constant | String | Payload | Publishers | Subscribers (defaults) |
|---|---|---|---|---|
| `INDEX_START` | `index:start` | `{ targetDir, persistence }` | `src/core/server/main.js:107` | `sonic-daemon` (P=10) |
| `FILE_INDEXED` | `file:indexed` | `{ file, targetDir, persistence }` | `src/core/server/main.js:157` (per-file in Pass-1 upsert) | none — extension point |
| `INDEX_COMPLETE` | `index:complete` | `{ result, targetDir, persistence, emitter, printer }` | `src/core/server/main.js:195` | `manifest-generator` (P=10), `schema-card-emitter` (P=20), `gap-analyzer` (P=30), `intent-seeder` (P=40), `force-checks` (P=90) |
| `FILE_BEFORE_CHANGE` | `file:before-change` | `{ change, targetDir, persistence }` | **no firers** | none |
| `FILE_AFTER_CHANGE` | `file:after-change` | `{ change, file, mutation, schemaCard, targetDir, persistence }` | **no firers** | none |
| `LIFECYCLE_TRANSITION` | `lifecycle:transition` | `{ file, oldPhase, newPhase }` | **no firers** | none |
| `COMMIT_RECORDED` | `commit:recorded` | `{ commit: { hash, shortHash, subject, author, timestamp, branch, filesChanged } }` | `src/core/server/app.js:1484` (`POST /api/record-commit`) | none — extension point |
| `PRD_GENERATE` | `prd:generate` | `{ targetDir, options }` | **no firers** | none |
| `TICKET_CREATED` | `ticket:created` | `{ ticket: { id, fingerprint, filepath, userNote, sha256Hash, status, identityBundle, createdAt } }` | `src/core/server/app.js:1569` (`POST /api/tickets`) | none — extension point |

"No firers" hook points are declared extension seams. They are documented
contract; nothing currently emits them. They are kept in the constants table so
that the first publisher to wire one in does not have to invent a name.

---

## The `HookRegistry` class

Located in `src/core/hook-registry.js`. Extends Node's `EventEmitter`. Key
methods:

- `register(name, handler, { priority = 100, source = 'unknown' })` — returns
  an unregister function. Handlers may be sync or async. Lower priority runs
  first. The internal list is re-sorted on every register.
- `execute(name, ctx)` — runs every registered handler for `name` in priority
  order, awaiting each. Per-handler exceptions are caught and logged; the
  return value is `{ ok, fail, errors: [{ source, error }] }`. After all
  handlers run, the same payload is re-emitted as a plain EventEmitter event,
  so `.on()` consumers also receive it.
- `unregister(name, handler)` — removes a previously-registered handler.
- `listHooks()` — returns `[{ name, count, sources: [{ source, priority }] }]`
  sorted by name. Introspection only; no consumers in the codebase yet.
- `clear()` — wipes everything (intended for tests).

A module-level singleton `hookRegistry` is exported so all subscribers land on
the same instance. Tests can construct fresh `new HookRegistry()` instances.

There is also a `verbose` flag on the instance; set to `true` to `console.log`
each `execute()` call.

---

## Default subscribers

`src/core/hooks/default-subscribers.js` exposes `registerDefaultSubscribers(registry)`.
This is the single bootstrap call (from `src/core/server/main.js:98`) that
attaches st8's built-in modules to the registry.

### INDEX_START — 1 subscriber

| Priority | Source | What it does | Failure semantics |
|---|---|---|---|
| 10 | `sonic-daemon` | `require('../../features/search/sonic-daemon').start({ targetDir })` — spins up the Sonic TCP search backend as a child process | Wrapped in try/catch inside the handler. Logs `[st8] Sonic daemon start failed: …` and continues. st8 boots in SQLite-only mode (sonic-queries has SQLite fallback). |

### INDEX_COMPLETE — 5 subscribers (in run order)

| Priority | Source | What it does | Failure semantics |
|---|---|---|---|
| 10 | `manifest-generator` | `writeManifests(ctx.result.files, ctx.targetDir)` — writes `connection-state.json` etc. | No internal try/catch. A throw here is caught by `HookRegistry.execute` and surfaces as a `[hooks] "index:complete" subscriber "manifest-generator" threw:` line. Subsequent subscribers still run. |
| 20 | `schema-card-emitter` | `ctx.emitter.emitAllCards(ctx.persistence)` then `ctx.printer.printAllFromCards(...)` | Same registry-level isolation. |
| 30 | `gap-analyzer` | Instantiates `GapAnalyzer(schemaCardsDir, persistence)`, calls `.analyze()` + `.writeReport(...)` to `.st8/gap-analysis.md` | Has its own try/catch — logs `[st8] Gap analysis failed: …` and returns. Belt-and-braces with the registry-level catch. |
| 40 | `intent-seeder` | `IntentSeeder(...).seedAll()` — heuristic-fills `file_intent` rows. | Internal try/catch. |
| 90 | `force-checks` | `runForceChecks(ctx)` — see next section. | Internal try/catch per check; writes `.st8/force-check.md`. |

The P=10..40 sequence preserves the byte-for-byte boot output the inline
orchestration produced before batch 023.

### FILE_INDEXED — 0 subscribers

Wired and fired per file in the Pass-1 upsert loop (`main.js:157`). No default
subscribers; reserved for future Louis lock checks, real-time UI cards, etc.
The example in `default-subscribers.js`'s closing comment shows the intended
shape.

---

## Force-checks

`src/core/hooks/force-checks.js` is registered as a single `INDEX_COMPLETE`
subscriber at P=90 (after all four feature subscribers). The driver
`runForceChecks(ctx)` runs six checks in sequence, collects their results,
renders a Markdown report to `.st8/force-check.md`, and logs a one-line
summary. **The hook never throws** even if every check fails — subscribers
further down the priority chain still run.

| ID | Title | What it catches | Fail condition |
|---|---|---|---|
| FC1 | Every `file_registry` row has a schema card | Emitter silently skipping a file | A file in `persistence.getAllFiles()` whose `<safe-name>.json` is missing in `.st8/schema-cards/` |
| FC2 | Every schema card has a `file_registry` row | Stale cards left over after a delete | A card filename whose fingerprint isn't in the current registry |
| FC3 | Manifest covers every `file_registry` row | Manifest serialization skips, cross-run registry drift | A registry fingerprint that isn't in `connection-state.json#files[].fingerprint` |
| FC4 | Gap report references only real filepaths | Gap-analyzer drift | A backtick-quoted `.js/.ts/.css/.html/.json/.md/.toml` token in `gap-analysis.md` that isn't a known filepath (skips `/api/*`, `src/`, `backend/`, `lib/` prefixes) |
| FC5 | Connections have valid endpoints | Dangling edges in the graph | A connection whose `sourceFingerprint` or `targetFingerprint` is not in `persistence.getAllFiles()`. Skipped if `getAllConnections()` isn't implemented. |
| FC6 | Fingerprints follow `<filepath>\|\|<timestamp>` format | Malformed identity | A `file_registry` row whose `fingerprint` doesn't match `/^[^\|]+\|\|.+/` |

The report file is machine-readable on top (status table) and human-readable
below (per-failure issue lists, capped at 20 entries per check). Output also
goes to stdout: `[st8:force-check] N/6 checks pass`.

### FC4 false-positive history

Batch 025 initially flagged `/api/connection-state.json` and similar URL-shaped
strings from the gap-analyzer's hardcoded mapping table. The fix added the
`/api/` prefix skip plus prefix skips for `src/`, `backend/`, and `lib/`. That
fix has no automated test — only manual smoke covers it. (See ticket file.)

### Opt-out

Don't call `registerForceChecks(hookRegistry)` from `main.js`. The module
exports both `registerForceChecks` and the raw `runForceChecks` for callers
that want to invoke the suite directly without going through the registry.

---

## External hooks

### Post-commit git hook

`scripts/git-hooks/post-commit` is a `bash` script that runs after every
`git commit`. It captures commit metadata via `git rev-parse` / `git log` and
POSTs a JSON body to `http://${ST8_HOST}:${ST8_PORT}/api/record-commit` with
`curl --silent --max-time ${ST8_TIMEOUT_S}`. Defaults are `localhost`, `3847`,
and 2 seconds.

**Non-fatal by design.** Three independent shortcuts ensure the commit succeeds
no matter what:

1. Every `git` subshell call is followed by `|| exit 0` — missing fields exit
   cleanly.
2. The `curl` invocation has `|| true` after it.
3. The script ends with `exit 0`.

Installation:

```
bash scripts/git-hooks/install.sh
```

The installer symlinks `.git/hooks/post-commit → ../../scripts/git-hooks/post-commit`
so the canonical hook lives in the repo and is moved with it.

### `POST /api/record-commit` → `COMMIT_RECORDED`

In `src/core/server/app.js:_handleRecordCommit` (line 1447). Required body
field: `hash`. The route:

1. Requires `POST` (else `405`).
2. Validates `payload.hash` (else `400`).
3. Constructs a fresh `St8Persistence`, calls `initialize()`.
4. Writes an `activity_log` row with `source='GIT', action='COMMIT_RECORDED',
   details=<full payload>`. Note: commits are project-level, not per-file —
   they cannot satisfy the `mutation_log.fingerprint → file_registry` FK, which
   is why the activity_log was chosen.
5. Lazy-requires `hook-registry` and fires `HOOKS.COMMIT_RECORDED` with
   `{ commit: payload }`. Lazy require avoids a circular dep with `main.js`.
6. Returns `{ ok: true, hash }` on success.

### `POST /api/tickets` → `TICKET_CREATED`

In `src/core/server/app.js:_handleTickets` (line 1510). Required body fields:
`fingerprint`, `filepath`. The route:

1. `GET` returns `{ tickets, count }` from `persistence.getOpenTickets(200)`.
2. `POST`:
   - Validates `fingerprint` + `filepath` (else `400`).
   - Calls `persistence.createTicket(...)` — inserts into the `tickets` table.
   - Logs `activity_log` row with `source='USER_UI', action='TICKET_CREATED'`.
   - Lazy-requires `hook-registry` and fires `HOOKS.TICKET_CREATED || 'ticket:created'`
     with `{ ticket: { id, ...payload, createdAt } }`. The `|| 'ticket:created'`
     fallback is dead code now that the constant is part of the canonical map
     (added later) — but harmless.
   - Returns `{ ok: true, id, createdAt }`.
3. `GET /api/tickets/count` (separate route handler) returns
   `{ count: persistence.countOpenTickets() }` for the phreak> TUI badge.

The ticket source flow is documented in `src/frontend/app.js:594`:
**user spots bug-juice in the void → clicks particle → notes popup → writes a
note → MAKE TICKET button → POST /api/tickets → backend fires HOOKS.TICKET_CREATED
→ (future) Sonic indexer / LLM colleague picks it up.**

---

## How to add a new subscriber

Pattern (from `default-subscribers.js`):

```js
const { hookRegistry, HOOKS } = require('../hook-registry');

hookRegistry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
  try {
    // ctx is { result, targetDir, persistence, emitter, printer }
    await myModule.doWork(ctx);
    console.log('[st8] my-module did work');
  } catch (err) {
    console.error('[st8] my-module failed:', err.message);
  }
}, { priority: 50, source: 'my-module' });
```

Priority guidance:

- 10–40: per-feature work that other subscribers may read (manifests, cards,
  intent).
- 50–80: derived/secondary work (notifications, dashboards, mirrors).
- 90+: verification / integrity passes that read everything else's output.

Wrap the handler body in your own try/catch if you want a tighter error message
than the registry's generic `[hooks] "<name>" subscriber "<source>" threw: …`.
The registry will catch unwrapped throws too, but you lose context.

For tests, prefer constructing `new HookRegistry()` and registering against
that instance, not the singleton.

---

## How to add a new hook point

1. Add a constant to `HOOKS` in `src/core/hook-registry.js`. Keep the
   comment-style payload signature on the same line as the value.
2. Document the payload in this file's table.
3. Find the publisher site and call:

```js
const { hookRegistry, HOOKS } = require('./hook-registry');
await hookRegistry.execute(HOOKS.MY_NEW_HOOK, { ...payload });
```

4. If the publisher is in a route handler (cross-process / HTTP), prefer a
   **lazy require** of `hook-registry` inside the request handler. This matches
   the pattern in `_handleRecordCommit` and `_handleTickets` and avoids
   circular requires with `main.js`.
5. Subscribers register the same way as above. A hook with zero subscribers is
   valid — `execute()` is a no-op and returns `{ ok: 0, fail: 0, errors: [] }`.

---

## Known caveats

- **`activity_log` has no FK on `targetFingerprint`.** That column accepts any
  string (including null). This is deliberate — commits and other system-level
  events have no file identity. Don't add an FK here without a migration plan
  for existing rows.
- **`mutation_log` does have an FK to `file_registry(fingerprint)`.** This is
  why `COMMIT_RECORDED` writes to `activity_log` instead. Anyone tempted to
  also write commits to `mutation_log` will hit a FK constraint failure.
- **Lazy requires in HTTP routes are load-bearing.** Both `_handleRecordCommit`
  and `_handleTickets` require `hook-registry` inside the request handler, not
  at module top. Moving them to the top would re-introduce a circular require
  with `main.js`.
- **`execute()` awaits each handler sequentially, not in parallel.** This is
  by design — gap-analyzer reads schema cards that the emitter wrote, so
  ordering matters. Don't switch to `Promise.all`.
- **Per-handler isolation is at the registry level, not at the persistence
  level.** If a subscriber writes half a manifest and then throws, the half-
  written file stays on disk. Subscribers that mutate the filesystem should be
  idempotent or write atomically (temp file + rename).
- **`HookRegistry.execute` re-emits via `EventEmitter`.** That second emit
  fires after all priority-ordered handlers complete. Listeners attached via
  `.on(name, fn)` run synchronously and uncaught throws from those listeners
  are not caught by the registry's try/catch — they will surface as
  unhandled-rejection / uncaught-exception. Prefer `.register()` over `.on()`.
- **`registerDefaultSubscribers` is not idempotent.** Calling it twice
  registers each subscriber twice. The bootstrap calls it exactly once from
  `main.js:98`. Tests using the singleton should call `hookRegistry.clear()`
  between runs.
- **The `HOOKS.TICKET_CREATED || 'ticket:created'` fallback in `_handleTickets`
  is dead defensive code** — the constant has been in the map since the hook
  was added. Safe to remove next time you're in that route.
- **`_handleRecordCommit`'s JSDoc claims it fires `LIFECYCLE_TRANSITION`.**
  The doc is stale; the code fires `COMMIT_RECORDED` (correct). Batch 025 fixed
  the implementation but the docstring above the method still references the
  old wrong hook.
- **`_handleTickets` uses snake_case `target_fingerprint` in the
  `logActivity()` call.** `logActivity()` reads `activity.targetFingerprint`
  (camelCase). The field never makes it into the DB row — `targetFingerprint`
  is silently null for `TICKET_CREATED` activity rows. Compare to
  `main.js:376` which uses the camelCase name correctly.
- **The post-commit hook hardcodes port `3847`.** If a user runs st8 on a
  different port (st8 supports `ST8_PORT` env var elsewhere) the shell hook
  needs that env exported too. The shell hook reads `ST8_PORT` from its own
  env, but git invokes hooks with a minimal env so the user has to export it
  globally for it to take effect.
- **Force-check FC4 skips prefixes `src/`, `backend/`, `lib/` to avoid
  flagging hardcoded reference paths.** This means a real broken `src/foo.js`
  reference in the gap report will also be skipped. The check trades false
  positives for false negatives.
- **No tests cover the hook registry, default subscribers, or force-checks.**
  The repo has no `*.test.js` files under `src/`. All verification has been
  manual smoke.
