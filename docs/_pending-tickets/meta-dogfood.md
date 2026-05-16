# Meta-Dogfood Report — st8 against itself (Wave 0)

Date: 2026-05-16
HEAD: 6b5300f
Tests baseline: 451 / 451 pass / 0 fail / 0 skipped / 0 todo
Boot time: ~50s to "Ready" (INDEX_COMPLETE @ ~30s)
Indexer completion: 345 files indexed (1 GREEN, 73 YELLOW, 271 RED)

## Summary

- **Boot works, but `--port 17723` flag is silently ignored** — server binds to the default `3847`. The flag passes through `start.js → main.js` but `app.js` reads `.st8/server.port` (existing file pinned to 3847) instead of CLI args. Honest finding: bad flag UX, not a fatal bug.
- **Most analysis endpoints work**: `/api/health`, `/api/insights`, `/api/identity-risk`, `/api/gap-analysis`, `/api/tickets`, `/api/tickets/count`, `/api/connection-state.json`, `/api/signal-path` all returned well-formed JSON.
- **Critical broken endpoints**: `/api/state` (404 — does not exist), `/api/manifests` (404 — does not exist). The CLAUDE.md API surface table is **aspirational**, not factual.
- **Critical wedge**: `/api/generate-report` POST **blocked the event loop indefinitely** — sustained ~78% CPU on the main thread, no response after 30+s, took down every other endpoint while it ran. Health checks returned HTTP 000 (connection failed). Killed the server to recover.
- **Insights are not persisted** — there is no `insights` table or `FileInsightSlots` table in `st8.sqlite`. `/api/insights` works only because the in-memory store survives within the same process; the next boot would re-derive from gap-analysis or lose them depending on hook ordering. The CLAUDE.md "insight store output" framing is misleading.
- **Indexer scope explosion**: st8 indexes itself across 345 files including `docs/`, `Louis/`, `OGB/*.txt`, `scripts/migration/results.*.json`, `st8_json/` (archived planning artifacts). The "271 RED files" headline is mostly noise from non-source files, not a real codebase health signal.
- **Signal-path is not a code-traversal tool** — it's a project-to-project **integration/migration planner** (steps like "Copy command-parser.js from source to target project"). Founder's "#1 feature" framing doesn't match what the endpoint actually does.

## Endpoint probe results

### /api/state
**404 — endpoint does not exist.** Returned `{"error":"API endpoint not found"}`. The CLAUDE.md "API surface" table lists this; either the table is stale or the route was removed. `/api/health` is the actual liveness check.

### /api/manifests
**404 — endpoint does not exist.** Returned `{"error":"API endpoint not found"}`. The closest working route is `/api/connection-state.json`, which returns the manifest payload. The CLAUDE.md table is inaccurate here too.

### /api/insights
HTTP 200. Returned a well-formed JSON envelope:
```json
{
  "ok": true,
  "projectId": "st8",
  "categorySummary": { "orphan": 271, "under-connected": 73 },
  "recent": [ ...20 entries... ]
}
```
- Severity breakdown: 271 errors, 73 warnings, 0 info.
- Categories observed: `orphan` (271) and `under-connected` (73). The "high-impact" and "under-imported" categories the doc mentions appear zero or never populated.
- **Top insights are noise**: the first three orphans are `.claude/settings.local.json`, `CLAUDE.md`, `Louis/DELIVERY_SUMMARY.md` — i.e., a settings file, the AI-instructions markdown, and an archived doc. Real source orphans are not in the top 5.
- **Not persisted**: no `insights` / `FileInsightSlots` table in `st8.sqlite`. In-memory only.

### /api/identity-risk
HTTP 200. Honest empty response:
```json
{ "ok": true, "count": 0, "records": [], "generatedAt": null, "note": "No identity-risk artefact present — clean run." }
```
`.st8/identity-risk.json` does **not** exist on disk. Either no Unix-epoch / pre-1980 birthtimes were seen on this filesystem (plausible), or the detector did not run / did not write. The "clean run" framing is honest but uninformative.

### /api/signal-path
HTTP 200, but the semantics are surprising. Probed `?filepath=src/features/indexing/command-parser.js` (the only GREEN file). Response:
```json
{
  "ok": true,
  "plan": {
    "outcome": "PARTIAL",
    "estimatedComplexity": "low",
    "steps": [
      { "step": 1, "action": "copy_file", "description": "Copy command-parser.js from source to target project", "from": "...", "to": "/home/user/st8/command-parser.js" },
      ...
      { "step": 4, "action": "verify", "description": "Verify integration integrity" }
    ]
  },
  "reasons": [ "Dependency reachability: 67% of external imports resolvable in target", "..." ]
}
```
This is a **migration planner**, not a "what depends on this file in our own codebase" tool. The source/target are both `/home/user/st8`, which makes the plan tautological (it suggests copying files from the project into itself). Latency was ~1-2s on the small case. **Second probe** with `src/core/server/app.js` timed out (HTTP 000) — likely because app.js has a richer import graph and the topological analysis is O(n²) or similar.

### /api/generate-report (POST)
**Broken in practice.** POST with `{}` and `{"format":"markdown"}` both hung for >30s, returning HTTP 000. The server became unresponsive to **all** endpoints during the call — `/api/health` also returned HTTP 000 while generate-report was running. The Node process sustained 60-78% CPU on a single core indefinitely. Had to `kill -9` to recover.

Source inspection (`src/features/analysis/report-generator.js`) reveals this is the **integr8 migration report** generator (`generateMigrationReport`), not a project-status report. It expects an `integr8 analysis output` shape with `migrationPlan`, `semanticGraph`, etc. The endpoint apparently invokes the signal-path adapter to synthesize that input, which on a self-target produces a degenerate graph that the generator walks pathologically.

### /api/tickets/count
HTTP 200. `{"count":139}`. Matches `SELECT COUNT(*) FROM tickets` in SQLite.

### /api/tickets
HTTP 200. Returned 139 tickets. All have `claimedBy=null` and `resolution=null` — i.e., 100% open. Ticket #613 sample: "Inline-style attribute soup — `ensureOverlay()` builds the entire dive-in DOM..." with rich identityBundle JSON including reviewer notes. Tickets appear well-populated by the sprint, but **nothing has been resolved** through the API — they were created and acked but the ticket lifecycle ends there.

### /api/gap-analysis
HTTP 200. Returns the full D1-D6 dimensional analysis (also persisted to `.st8/gap-analysis.md`, 717 lines). See "Gap-analyzer output" below.

### /api/connection-state.json
HTTP 200. The actual manifest. 345 files, broken down by status.

### /api/health
HTTP 200. `{"status":"ok","uptime":50.55,"targetDir":"/home/user/st8","lastManifestUpdate":null}`. **Note**: `lastManifestUpdate` is `null` even though manifests were just written 50s earlier — the field is wired to nothing.

## On-disk artifacts

### `.st8/` contents (final state)
```
force-check.md             708 B
gap-analysis.md         40,239 B   (717 lines)
index-complete-errors.json 86 B
schema-cards/                       (344 cards)
server.port                  5 B   "3847"
server.secret               65 B   (mode 0600)
sonic-store/                        (sonic search index)
sonic.password              65 B
```
- **No `identity-risk.json`** — endpoint reads it but it was never written.
- **`server.port` is sticky** — explains why `--port 17723` was ignored.
- **`index-complete-errors.json`** is only 86 bytes — likely `{"errors":[]}` or similar empty stub.

### SQLite (`/home/user/st8/st8.sqlite`, 2.8 MB)
Tables and row counts:
| Table | Rows |
|---|---|
| `file_registry` | 345 |
| `connections` | 375 |
| `file_intent` | 345 |
| `file_mutation_log` | 690 |
| `activity_log` | 702 |
| `tickets` | 139 |
| `providers` | 8 |
| `st8_settings` | 2 |
| `ai_content` | 0 |
| `prd_projects` | 0 |
| `sqlite_sequence` | 4 |

**Notably absent**: `insights`, `FileInsightSlots`. The insight store advertised in `src/features/analysis/insight-store.js` (which does `CREATE TABLE IF NOT EXISTS FileInsightSlots`) is **not actually called** during boot — `/api/insights` reads from a separate in-memory `insight-store-populator` cache.

### Schema cards
- Total emitted: **344** (one file failed to emit a card; printer reports 223 printed because some are JSON-only).
- src/ files on disk: **75** `.js`
- src/ files in registry: **74** (excludes `src/frontend/vendor/d3/d3.v7.min.js`)
- **Coverage gap**: only 1 file (third-party vendored d3) — effectively complete coverage of src/.

### Source-files-WITHOUT-cards comparison
Only `src/frontend/vendor/d3/d3.v7.min.js` is excluded. The schema-card emitter has 100% coverage of first-party src/ JavaScript.

### Indexed-but-questionable
The indexer pulls in **271 RED files** that are mostly **not first-party source**:
- 48 `OGB/*.txt` archived snapshots (CLAUDE.md says "OGB/ — retired code, reference only; never imported")
- 73 `docs/*.md` files
- 63 `st8_json/*` archived files (an old planning dir)
- 21 `docs/_pending-tickets/*.json` (the sprint's own metadata)
- 25 `scripts/migration/results.*.json` (build artifacts)

These represent **false-signal noise** — st8's own RED-count is dominated by docs and archived files, not real orphan source.

## Gap-analyzer output (D1–D6)

| Dim | Result | Honest read |
|---|---|---|
| **D1 Lifecycle** | 345 files, all in `DEVELOPMENT` phase | The lifecycle phase machinery is wired but **not actually progressing** anything — nothing has graduated to STAGING / PRODUCTION ever |
| **D2 Status Health** | RED=271, YELLOW=73, GREEN=1 | The single GREEN is `src/features/indexing/command-parser.js`. Everything else in src/ is YELLOW. The 271 RED is noise (see above) |
| **D3 Intent Authoring** | 345/345 (100%) have intent | All entries have a `purpose` field, but inspection of seeded intents shows they're auto-generated placeholders, not human-written |
| **D4 Export Surface** | 122/345 export (35.4%); 78 CommonJS, 0 ES6 modules | **0 ES6 modules detected** — but the codebase IS ES-compatible CommonJS via TS down-emit. The classifier appears not to recognize the actual module style |
| **D5 Connection Integrity** | 375/375 imports resolve, 189 isolated files | The "189 isolated files" includes all docs/, but also some src/ files. `connections` table has 375 rows but **most edges originate from OGB/*.txt files being parsed as live JavaScript** — see Critical Finding below |
| **D6 Architectural Completeness** | 8/8 components present; 14/14 endpoints covered | This is a sanity check, not a discovery; will always pass unless someone deletes a major file |

## What st8 can see about itself

st8 successfully **inventories** itself: 345 files registered, 375 import edges captured, 344 schema cards emitted, 139 tickets surfaced, 8 LLM providers + human registered, hooks fire in correct order (INDEX_START → FILE_INDEXED → INDEX_COMPLETE → insight-store populator → intent seeder → force-checks → HTTP listen). The `activity_log` table is honest about what happened and when. The `file_mutation_log` (690 rows) shows that the per-fingerprint mutation history is being recorded properly across reindex passes. Foreign key cascade for `pruneFilesNotIn` works — only 1 stale row was pruned, which is consistent with a 345-file project that hasn't seen file deletions. The `getSharedPersistence()` singleton is in use (no per-request init spam in the logs).

st8's gap-analyzer **D1-D6 dimensional model** is genuinely useful — D2 status, D4 export surface, and D5 connection integrity are real signals. The schema-card emitter has near-perfect coverage. The signal-path adapter, while misnamed, does produce a valid topological analysis with cycle detection (it correctly flagged the `app.js → auth.js` cycle in the boot log).

## What st8 CANNOT see about itself

**Residual concerns** (raise to their own waves if pursued):

1. **The OGB/*.txt parsing problem (residualConcern HIGH).** The AST parser treats `.txt` files as JavaScript because they have JS-shaped content. This is why D5 shows 375 import edges with most originating from `OGB/backend/*.js.txt` and resolving to `src/shared/utils/safe-fs.js`. **The connection graph is contaminated by retired code.** CLAUDE.md says OGB/ is reference-only, but the indexer doesn't honor that. Fix: extend file-extension allowlist or add an exclude rule to data-ingestion.js / indexer.js.

2. **Insights not persisted (residualConcern HIGH).** `src/features/analysis/insight-store.js` defines `FileInsightSlots` and a full SQLite schema, but no `CREATE TABLE` ever runs against `st8.sqlite` — the table is absent. The `/api/insights` endpoint serves from an in-memory cache populated by the default-subscribers' `INDEX_COMPLETE` hook. **Server restart loses insight history.** The CLAUDE.md "post-Wave-1 persistence invariants" section claims an insight store but it's smoke.

3. **`/api/generate-report` is an event-loop hazard (residualConcern CRITICAL).** A POST hangs the entire server for >30s on a 345-file project. This is a synchronous CPU-heavy graph traversal on the main thread. On a larger codebase it could be unbounded. Either offload to a worker thread or stream the response, or rename the endpoint to reflect what it actually does (integr8 migration report, not status report).

4. **CLAUDE.md API surface table is fiction in places.** `/api/state` and `/api/manifests` do not exist. The actual route table in `app.js` lines 401-488 should be the source of truth. This is a documentation drift hazard — agents reading CLAUDE.md will try those endpoints and get 404s, then waste time chasing imaginary bugs.

5. **`--port` CLI flag silently ignored.** `node start.js . --port 17723 --serve` results in binding to `.st8/server.port` (3847). The flag is plumbed through argv but a sticky `server.port` file beats it. Either honor CLI > file, or document the precedence.

6. **`lastManifestUpdate: null` in `/api/health`.** Field exists but is never updated. Trivial fix; flagged as a smell.

7. **Identity-risk has nothing to say.** `.st8/identity-risk.json` was not written despite the indexer running on a filesystem with normal birthtimes. Hard to tell if this is "correctly silent" or "subscriber never fires." A probe that deliberately triggers an unreliable-birthtime would clarify.

8. **D1 lifecycle phase is one-state.** Everything is `DEVELOPMENT`. The lifecycle-transition hook fires in tests but nothing in production actually graduates a file to STAGING. The dimension is decorative on this project.

9. **0 ES6 modules detected in D4.** Either the classifier is wrong or the project has zero ESM, which is plausible (TS down-emits CJS) — but it means D4 always shows the same thing and isn't informative.

10. **Tickets are write-only.** 139 tickets, all open, all `claimedBy=null`. The full claim/resolve lifecycle has no live producers. This may be intentional (tickets are a sprint artifact only) but it makes the table monotonic.

## Visualization candidates (forward-looking)

Ordered by which would help debugging-the-guts the most:

1. **Hook event timeline (highest value).** A live time-axis showing INDEX_START → FILE_INDEXED (×345) → INDEX_COMPLETE → insight-store populator → seeder → force-checks → ready. The current boot is opaque from the outside; a single horizontal sparkline per hook with subscriber latency bars would make the 30-second boot legible. Drives a "where did the time go" answer in one glance.

2. **The "noise filter" — first-party-only manifest view.** A toggle that hides docs/, OGB/, scripts/migration/, st8_json/ from the connection-state and gap-analysis. This single view would change the headline RED-count from 271 to ~5, which is the only number a human cares about. Pairs with the OGB/*.txt parsing fix.

3. **Connection graph (force-directed) for src/ only.** 74 nodes, ~30-40 edges if OGB contamination is filtered. Small enough to render at full fidelity, large enough to reveal cycles (app.js↔auth.js already found by signal-path) and clusters. Highlight: RED/YELLOW/GREEN status as node color, in-degree as size.

4. **Schema-card "what changed in this pass" diff.** The `file_mutation_log` already has 690 rows tracking mutation history. Visualize the last INDEX_COMPLETE pass as a sparkline per file: added imports, removed imports, status transitions. This turns the database into a story.

5. **Ticket-by-cluster heatmap.** 139 tickets grouped by their `identityBundle.cluster` (frontend-experience, persistence-and-database, etc.) on Y, severity on X. Reveals where the technical debt actually lives. The data is already in SQLite; just needs a SQL query and a grid.

## Confidence

**Medium-high confidence in negative findings, medium confidence in positive findings.**

The broken pieces — 404s on `/api/state` and `/api/manifests`, hanging `/api/generate-report`, missing `insights` table, OGB/*.txt parsing — were observed directly with bounded-timeout curl calls and a SQLite read-only inspection. These are reproducible.

The working pieces are confirmed insofar as their endpoints returned well-formed JSON, but I did **not** validate the **semantic correctness** of the gap-analyzer's D2 or the signal-path's topological output beyond surface-level shape checks. The OGB/*.txt contamination finding suggests D5 in particular is producing technically-correct-but-meaningless numbers.

I did NOT successfully probe `/api/generate-report` to a clean response — the server wedged. The only knowledge of what it does comes from reading `report-generator.js`. If the endpoint can be fixed to return, it might reveal more issues.

The CLI flag bug (`--port` ignored) was observed once. I didn't try a clean `rm .st8/server.port && node start.js --port 17723` to confirm the precedence order, so the root cause is inferred not proven.

The tests baseline (451 passing) was verified before any work. No edits were made to src/ or tests/.

---

**Probe duration**: ~12 minutes (within 20-minute budget).
**Server processes at probe end**: all killed; verified no stale `node start.js` or `main.js` running.
