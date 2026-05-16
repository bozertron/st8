# mvp-polish-and-shipping — roadmap

Forward-looking work to take st8 from "sprint-stabilized" to "shippable." This cluster has no existing tickets; the items below were surfaced during the 31-wave debugging sprint as residualConcerns or cross-cluster flags that didn't have a natural home in any cluster's roadmap. Pre-sprint state assumed these would be discovered via gap analysis; the sprint's audits found them organically.

## MVP definition (working assumption — confirm with founder)

st8 ships when:
1. `node start.js .` against any well-formed JS/TS project boots, indexes, serves the UI, and the constellation populates within 5s
2. A user can click a non-green particle, dive in, write a note, click Make Ticket, and see the ticket land in `st8.sqlite` with no manual intervention
3. The LLM-collaborator loop works end-to-end: ticket created → `/api/tickets` returns the ticket payload → an external LLM can consume it via the shared filesystem channel
4. `npm test` passes 100% on every fresh checkout
5. A non-developer can install + run st8 following a README

## P0 — true blockers

### P0.1 — End-to-end Make Ticket smoke
**Why**: Wave 7B's `showCopyFeedback` fix (REAL BUG) was caught in code review but no E2E test covers the full Make Ticket flow (click particle → notes popup → POST /api/tickets → SQLite row + HOOKS.TICKET_CREATED fires).

**Scope**: Add a Puppeteer or Playwright headless test that:
- Boots st8 against a tmp dir with synthetic particles
- Clicks a non-green particle
- Types in the notes popup
- Clicks Make Ticket
- Asserts the SQLite `tickets` table has a new row matching the payload
- Asserts the `/api/events` SSE stream emitted TICKET_CREATED

**Files likely touched**: `tests/e2e/` (NEW directory + browser test runner choice), possibly a dev dependency on Puppeteer/Playwright. Document the trade-off — headless tests add a heavy dependency, but the alternative is shipping without coverage on the most-important UX path.

### P0.2 — Cluster-close audit false-positive fix
**Why**: The PRE_FLIGHT.md cluster-close audit uses `git log master..HEAD --name-only` which still surfaces the historical `36d9c16` add + `d340af4` delete pair of `src/0_*` files (both on master itself). Reviewers had to manually interpret this as "documented historical artifact" every cluster close.

**Scope**: Switch the audit to `find src -maxdepth 2 -name "0_*"` (working-tree state, not git history). The simpler check is also the more correct one — what matters is the CURRENT state, not historical adds. Update PRE_FLIGHT.md cluster-close audit section.

### P0.3 — README rewrite for first-time users
**Why**: Current README predates the sprint and references pre-refactor paths. A non-developer can't install + run st8 from it.

**Scope**: Rewrite from scratch. Sections needed:
- What st8 is (one paragraph)
- Quickstart (3 commands max)
- Entry-point chain (start.js → main.js → app.js — copy from CLAUDE.md)
- API surface table (copy from CLAUDE.md)
- Troubleshooting (sonic daemon failed to bind, port already in use, etc.)
- Pointer to st8-filemap.md as the inventory

## P1 — shipping prerequisites

### P1.1 — Migration framework (cross-cluster)
**Status**: deferred-confirmed in persistence cluster. See `docs/_pending-roadmap/persistence-and-database.md` P1.1.

**Why it lives here too**: 4 different clusters (persistence ticket 0, identity ticket 14, settings ticket 5, refactor-toolkit ticket 29) all blocked on this. Until it lands, every schema change is a manual ALTER + risk of drift. Tests use `CREATE TABLE IF NOT EXISTS` which is fine for new DBs but means existing DBs miss any column added after their initial creation.

**Scope**: Documented in persistence roadmap. Estimated 1-2 days for a competent agent. Likely 2 sub-waves (framework + migration scripts for all 5 known drift points).

### P1.2 — Cross-target watcher (cross-cluster, server-api)
**Status**: deferred-confirmed in lifecycle cluster ticket 12.

**Why it lives here too**: Current FileWatcher is constructed once with the single targetDir from argv. Multi-target setups (monorepos, multiple projects in one st8) is a user-visible feature gap. Until this lands, st8 is single-project-at-a-time.

### P1.3 — Headless test infrastructure
**Why**: Multiple cluster reviewers shipped tickets with "option (b) — manual smoke notes" because frontend code can't be Node-tested. P0.1 needs this. P1.4 below needs it.

**Scope**: Decide headless tool (Puppeteer vs Playwright vs Cypress). Establish `tests/e2e/` convention. Migrate at least 3 manual-smoke commitments to real E2E tests (Make Ticket flow, slide carousel keyboard nav, dive-in emergence animation).

### P1.4 — Frontend smoke harness
**Why**: Currently the only way to verify a frontend change works is to manually open the browser. P1.3 provides the tooling, this fills it in.

**Scope**: A `npm run smoke` script that boots st8 against a fixture project + opens the UI headless + walks 5-10 critical user journeys + reports pass/fail per journey.

## P2 — quality of life

### P2.1 — Install script
A real `install.sh` (or `npx st8 init`) that:
- Checks Node 18+
- Installs deps
- Runs first-time setup (creates `.st8/`, configures git hooks, etc.)
- Prints the launch command

### P2.2 — Sonic daemon error UX
Currently if Sonic fails to start, st8 silently falls back to SQLite-only and the user has no idea search is degraded. Add a visible status indicator in the UI + a log line that's obvious.

### P2.3 — `--version` flag + `package.json` version sync
`node start.js --version` should print the version string. Currently it does nothing.

### P2.4 — Cross-platform paths
Wave 5E observed encryption.key lands at `<dbDir>/.st8/encryption.key`, which doubles to `.st8/.st8/encryption.key`. Audit all path-construction sites for similar double-anchoring.

## P3 — nice-to-haves

### P3.1 — Onboarding video / GIF
A 60-second screencast showing the full Make Ticket → LLM-resolves loop. Shippable to README + project homepage.

### P3.2 — Performance baseline doc
Document the perf numbers the sprint surfaced:
- Boot time: ~2-3s for 281-file project
- Indexer fire cost: 0.82ms total for FILE_INDEXED across 281 files
- `/api/signal-path` median latency: 22ms (after scoping fix)
- Tests: 451 passing in ~12s

So future regressions are detectable.

### P3.3 — Telemetry opt-in
Anonymous usage stats (which features are used, which fail) to inform future priorities. Opt-in only; off by default.

## What gets unblocked by closing this cluster

- LLM-collaborator loop becomes self-evident from README (P0.3) + E2E test (P0.1)
- Schema evolution becomes safe (P1.1)
- Multi-project monorepo support (P1.2)
- Real frontend test coverage (P1.3 + P1.4)
- Non-developer onboarding (P0.3 + P2.1)
