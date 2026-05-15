# Roadmap items — hooks-and-integration cluster

Future improvements, refactors, and integrations for the named hook system,
default subscribers, force-check pass, post-commit hook, and TICKET_CREATED
plumbing. Bugs and stale code live in `_pending-tickets/hooks-and-integration.json`;
this file is the forward-looking list.

---

- **Priority 1 — Convert the file-watcher onFileChange handler to publish FILE_BEFORE_CHANGE and FILE_AFTER_CHANGE.**
  The 215-line inline orchestration in `main.js` is the largest remaining piece of pre-hook procedural code. Batch 023 explicitly deferred it as "bigger, riskier." Converting it gives plugins (Louis lock checks, real-time UI mirrors, audit trails) a single seam for every file mutation, and finally retires those two declared-but-unfired hook constants. This unblocks the entire "react to a single file changing" plugin surface — today that requires patching main.js.

- **Priority 1 — Add a test suite for hook-registry.js.**
  Zero tests cover priority ordering, async sequencing, error isolation, unregister semantics, listHooks introspection, or the EventEmitter re-emit path. The registry is load-bearing infrastructure — every subscriber depends on its contract. ~50 lines of tape/jest gets us from "honor system" to "regression-proof." This is the prerequisite for trusting future hook refactors.

- **Priority 1 — Subscribe Sonic indexer to TICKET_CREATED.**
  The hook fires but has no subscribers. The frontend's MAKE TICKET button comment (`src/frontend/app.js:594`) explicitly anticipates a Sonic-side indexer picking up tickets via the shared ground-plane channel. Wiring it is the close-the-loop step for the founder's user-spots-bug-juice → LLM-collaborator flow. Without it, tickets sit in SQLite waiting for a human to query them.

- **Priority 2 — Subscribe a manifest-snapshot writer to COMMIT_RECORDED.**
  Today the hook fires but no subscribers exist. The original rationale for the post-commit hook (batch 024) was "snapshot the manifest at each commit so we can diff state across commits." Implementation: a P=50 subscriber that copies `connection-state.json` into `.st8/commit-snapshots/<shortHash>.json`. Unlocks per-commit state diffs and a commit-keyed timeline view in the UI.

- **Priority 2 — Shared persistence instance for app.js route handlers.**
  Every route currently constructs `new St8Persistence()` and calls `initialize()` per request, including the two hook-publishing routes. Hoist to a single `app.persistence` initialized at server start. Cuts per-request DB-open overhead and makes the hook-fire path cheaper, which matters once subscribers start doing real work synchronously.

- **Priority 2 — Auto-detect server port for the post-commit hook.**
  Today the shell hook hardcodes 3847 and reads ST8_PORT from a possibly-empty env (git invokes hooks with minimal env). On server start, write the live port to `.st8/server.port`; have the shell hook read that file before falling back to env/default. Removes the silent-failure mode where st8 runs on a different port and commits silently miss the hook.

- **Priority 2 — Chained-hook awareness for git-hooks/install.sh.**
  The installer unconditionally clobbers any pre-existing `.git/hooks/post-commit`. Detect a non-symlink file, refuse to overwrite, and either print a manual-chain snippet or write a small dispatcher that calls both. Critical for any user already running husky / lefthook / lint-staged.

- **Priority 2 — Surface listHooks introspection via an HTTP endpoint.**
  `GET /api/hooks` returning `registry.listHooks()` gives the dashboard a live view of "what's registered, in what order, from what source." Useful for debugging plugin load order, verifying that all defaults registered, and writing tests that assert the expected subscriber list. ~20 lines of glue.

- **Priority 2 — Idempotency guard on registerDefaultSubscribers.**
  Tag the registry on first call and short-circuit on re-entry. Cheap insurance against a future refactor that accidentally calls bootstrap twice and silently doubles every INDEX_COMPLETE subscriber.

- **Priority 3 — Plugin loader: scan .st8/plugins/ and auto-register handlers.**
  Once the file-watcher conversion (P1) and listHooks endpoint (P2) ship, the natural next step is a plugin directory where third-party modules drop in `register(registry)` functions. Removes the need to edit `default-subscribers.js` to add a subscriber. Aligned with the HOOK-ARCHITECTURE doc's "external integrations" vision.

- **Priority 3 — Hook-level metrics: per-subscriber timing.**
  Wrap each handler invocation in `execute()` with `performance.now()` + log a per-source timing. Today there is no visibility into which subscriber dominates an INDEX_COMPLETE pass. Useful once subscriber count grows past five.

- **Priority 3 — Fail-fast mode for development.**
  Currently a subscriber throw is logged and the chain continues. Add `registry.failFast = true` for dev runs so a throw aborts the chain — surfaces silent failures (e.g. manifest-generator throwing but downstream subscribers running on stale data) immediately.

- **Priority 3 — Replace force-check FC4's prefix skip with an explicit allowlist.**
  Today FC4 skips any backtick ref starting with `/api/`, `src/`, `backend/`, `lib/` to avoid flagging hardcoded mapping-table paths in the gap report. That means real broken `src/...` references are also silently ignored. Pass the gap-analyzer's known hardcoded list into the check directly; flag everything else.

- **Priority 3 — TICKET_RESOLVED and TICKET_CLAIMED hooks.**
  The tickets table already supports claim and resolve lifecycle, but only TICKET_CREATED has a hook. For LLM-collaborator workflows the resolve step is the more interesting event (subscriber: "regenerate that file's schema card now that the ticket is closed"). Symmetrically, TICKET_CLAIMED would let a real-time UI dim a claimed ticket.

- **Priority 3 — PRD_GENERATE hook publisher.**
  The constant exists in HOOKS but has no firers. The PRD generation flow (separate cluster) is the natural publisher — fire before generation with the resolved targetDir + options so subscribers can pre-validate, post-process, or short-circuit. Wire when PRD generation gets its own refactor pass.

- **Priority 3 — Persistence-backed activity_log → hook replay tool.**
  Every TICKET_CREATED and COMMIT_RECORDED activity row contains the full payload. A small CLI tool could re-fire the corresponding hooks from activity_log to drive backfill of new subscribers ("I added a Sonic indexer subscriber today, please process every TICKET_CREATED from the last 30 days"). Closes the at-most-once delivery gap noted in the tickets file.
