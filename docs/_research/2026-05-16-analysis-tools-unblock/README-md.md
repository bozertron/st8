# Research: README.md — T4 scope analysis

**Wave:** analysis-tools-unblock-pass-1
**Ticket:** T4 — Wire route-manifest → CLAUDE.md + README API table generator + drift test
**Date:** 2026-05-16
**Mode:** read-only research; no edits proposed beyond T4 scope

---

## 1. Identity

- Path: `/home/user/st8/README.md`
- LOC: **278** (verified `wc -l README.md` → 278)
- Last modified: single commit only — `47bf1b7` "Initial commit: ST8 Full Stack Logic Analyzer v3", Tue May 12 21:18:27 2026 -0700 (`git log -- README.md` returns exactly one commit)
- Self-declared header: `Version: 0.1.0`, `Date: 2026-05-11`, `Status: Development` (lines 3–5)

## 2. Section inventory

| Section name | Line range | Description |
|---|---|---|
| Title + version banner | 1–7 | "ST8 — Full Stack Logic Analyzer" + version/date/status |
| What is ST8? | 9–17 | One-paragraph positioning ("st8 → integr8 → actu8 → orchestr8") |
| Quick Start | 19–40 | Shell snippet using `/home/bozertron/...` paths and `node start.js` |
| Architecture | 42–94 | ASCII tree of repo — **describes the old `backend/` + `lib/` layout** |
| Workspace Types | 96–117 | Standard / Full Stack Logic Analyzer / Pretext Dev |
| Features | 119–165 | File indexing, file list, notes, TUI toolbar, graph, settings, multi-LLM |
| Design Tokens (Non-Negotiable) | 167–186 | Colors, typography, idioms |
| **API Endpoints** | **188–200** | **Hand-written table of 7 endpoints — see §3** |
| Usage Workflow | 202–215 | 10-step numbered tutorial |
| Dependencies | 217–226 | Node ≥18, better-sqlite3, chokidar, @babel/parser, fast-glob, D3 |
| Development | 228–241 | Includes `node backend/indexer.js …` and `node backend/server.js …` |
| Roadmap | 243–261 | Phase 0–11 done, three open items |
| Related Projects | 263–270 | maestro-scaffolder-tool, stereOS, actu8, orchestr8 |
| License | 272–275 | Private — Benjamin Webster |
| Footer quote | 277–278 | "You can't integrate what you can't see." |

## 3. Does an API table exist in README today?

**YES.** Lines **188–200** (`## API Endpoints`).

- Header: `| Endpoint | Method | Description |` (line 190)
- Separator: line 191
- Data rows: **7 rows** (lines 192–198)

### Drift vs `src/core/server/route-manifest.js`

route-manifest defines **33 entries** (counted via `grep -c "^  {" src/core/server/route-manifest.js`).

| README row (line 192–198) | In route-manifest? |
|---|---|
| `/` GET — Serves st8.html | NOT in route-manifest (static root, not under `/api/`) |
| `/api/connection-state.json` GET | YES — line 55, handler `_serveManifest` |
| `/api/ai-signal.toml` GET | YES — line 58, handler `_serveToml` |
| `/api/health` GET | YES — line 61, handler `_serveHealth` |
| `/*.js` GET — JavaScript files | NOT API; static serve |
| `/*.css` GET — Stylesheets | NOT API; static serve |
| `/*.ttf` GET — Font files | NOT API; static serve |

**Three of seven** README rows correspond to manifest entries. **26** route-manifest entries (`/api/index`, `/api/file-intent`, `/api/verify`, `/api/files`, `/api/mutations`, `/api/concept-file`, `/api/mvp-lock`, `/api/production-promote`, `/api/prd`, `/api/gap-analysis`, `/api/prd-projects` ×2, `/api/bruno-call`, `/api/oscar-house`, `/api/needs-ai-review`, `/api/mark-reviewed`, `/api/templates`, `/api/settings`, `/api/record-commit`, `/api/tickets` + `/count` + `/:id/claim` + `/:id/resolve`, `/api/auth-token`, `/api/llm-call`, `/api/signal-path`, `/api/generate-report`, `/api/insights`, `/api/identity-risk`, `/api/exec`) are **absent** from the README table.

**Conclusion:** the table exists, drift is severe (≈8% coverage), T4's README scope is **live** — not a "skip + flag" case.

Note: README rows for `/`, `/*.js`, `/*.css`, `/*.ttf` are static-asset serves that live outside the route-manifest contract. T4's generator should emit only `/api/*` rows. The four static rows are out of scope for the generator (they should be dropped or kept verbatim outside the sentinel region).

## 4. Other stale content (NOT for T4 — flagging for P0.3)

Documenting only; no fixes proposed:

- Line 28: `cd /home/bozertron/1_AT_A_TIME/st8` — hard-codes the author's home directory; first-time users on any other path fail step 1.
- Lines 29, 32, 35, 232: `"/home/bozertron/Software Projects/maestro-scaffolder-tool"` — same.
- Lines 45–92: Architecture tree describes `backend/` + `lib/` + `OGB`-era files. Per CLAUDE.md §"NEVER target these paths", `backend/` and `lib/` no longer exist; canonical layout is `src/core/`, `src/features/`, `src/shared/`, `src/frontend/`. Files listed (`st8.html`, `file-explorer.js`, `phreak-terminal.js`, `graph-visualizer.js`, `settings-ui.js`, `coordination.js`, `void-engine.js`, `settings-reader.js`, `fake-stream.js`) do not exist at repo root today.
- Lines 235, 238: `node backend/indexer.js …` and `node backend/server.js …` — both paths deleted (CLAUDE.md line 72: "`backend/`, `lib/` — the **old** pre-refactor layout … no longer exist").
- Line 38: claims "server will start at `http://localhost:3847`" — correct default per `start.js` (not verified end-to-end here).
- Line 4: `Date: 2026-05-11` is stale relative to today (2026-05-16) and predates the entire 23-wave debugging sprint described in CLAUDE.md.
- Roadmap lines 243–261: phase-based; orthogonal to the current 23-wave sprint protocol — not actively maintained.
- No mention of: `start.js → main.js → app.js` entry-point chain, `st8-filemap.md`, `.st8/` directory, ticket system, schema-card flow, sonic daemon, hook registry, `X-St8-Secret` auth model, troubleshooting.

## 5. Prior work touching README.md

Exactly one commit ever touches this file:

- `47bf1b7` (2026-05-12) "Initial commit: ST8 Full Stack Logic Analyzer v3" — the file has not been edited since the initial bulk import. No ticket has touched it.

## 6. Existing tests

None directly assert on README.md content.
- `/home/user/st8/tests/features/schema-cards/emitter-prune.test.js:131,137` — references `README.txt` inside the schema-card output dir, unrelated.
- `/home/user/st8/tests/core/server/route-manifest-drift.test.js` — exists and asserts manifest ↔ `app.js` 1:1, **does not consult README.md**.
- No `README` drift / link-check / generator test exists.

## 7. Contracts

Target audience (inferred from prose): a first-time developer/user discovering st8.

Claims made to that reader that affect first-time use:
- **Install path**: `cd /home/bozertron/...` then `npm install` then `node start.js <project>` — install path is wrong for everyone except the original author.
- **API surface**: the 7-row table is the only declared public HTTP surface. Anyone consuming st8 as a service would believe `/api/tickets`, `/api/signal-path`, `/api/index`, etc. do not exist.
- **Workspace types**: three are listed; none correspond to current frontend reality (no audit performed here — out of T4 scope).
- **Run modes**: `--watch`, `--dev` documented in Quick Start; `--port`, `--serve` from main.js spawn are not.

T4 only touches the **API surface** claim. Everything else stays under P0.3.

## 8. Change vector for T4 in README specifically

**Case: table exists.** Apply the same shape as the planned CLAUDE.md change:

1. Add sentinel comments around lines 188–200, e.g.
   ```
   <!-- BEGIN: route-manifest-table -->
   ## API Endpoints
   | Route | Method | Auth | Description |
   |---|---|---|---|
   ...generated rows from route-manifest.js (filtered to /api/*)...
   <!-- END: route-manifest-table -->
   ```
2. Write `scripts/generate-api-table.js` (or equivalent under `docs/` alongside `docs/generate-filemap.js`) that:
   - Requires `src/core/server/route-manifest.js`.
   - Emits a markdown table from `ROUTES`.
   - Replaces the region between `<!-- BEGIN: route-manifest-table -->` and `<!-- END: route-manifest-table -->` in **both** `README.md` and `CLAUDE.md`.
3. Add a drift test at `tests/docs/api-table-drift.test.js` that:
   - Re-runs the generator output in memory.
   - Reads README.md + CLAUDE.md, extracts the sentinel-bounded region.
   - `assert.strictEqual` on the generated string vs file content. Same pattern as `route-manifest-drift.test.js`.
4. Decide row shape: `Route | Method | Auth | Description` matches `CLAUDE.md` lines 104–116 already. README's current shape is `Endpoint | Method | Description`; harmonize on the CLAUDE.md shape (Auth is load-bearing for the X-St8-Secret POST class).
5. Decide what happens to the 4 static-asset rows (`/`, `/*.js`, `/*.css`, `/*.ttf`) in README: simplest is move them above the sentinel region under a separate heading "Static assets" so the generator region stays a pure mirror of route-manifest.

**Explicit case selection:** The table exists. Scope **does NOT collapse**. T4 deliverable includes a README API table region.

## 9. Provisions already made

- `src/core/server/route-manifest.js` exists (180 LOC) as declared source of truth, with explicit drift contract in the header (lines 11–14). Manifest is `Object.freeze(ROUTES)` at line 53.
- `tests/core/server/route-manifest-drift.test.js` already enforces manifest ↔ `app.js` 1:1, so the generator can trust the manifest faithfully reflects implementation.
- `docs/generate-filemap.js` (referenced in CLAUDE.md line 63) is precedent for a generator-managed doc artifact — pattern is established.
- `CLAUDE.md` lines 102–116 already has the **same shape** of table T4 wants to generate, only stale and hand-written; that doubles as the spec for the row layout.

## 10. Gaps + open questions

1. **Should P0.3 wait for T4?** Strong yes. P0.3's scope explicitly says (`docs/_pending-tickets/mvp-polish-and-shipping.json` line 16) "API surface table (copy from CLAUDE.md)" — i.e. the P0.3 plan is to **hand-copy** the table from CLAUDE.md. If T4 lands first with a sentinel-bounded generator-managed region, P0.3 inherits a self-maintaining table and the "copy from CLAUDE.md" instruction becomes "leave the sentinel region alone." Sequencing T4 before P0.3 saves P0.3 from immediate decay.
2. **Generator location**: `docs/generate-api-table.js` (sibling of `docs/generate-filemap.js`) vs `scripts/generate-api-table.js`? CLAUDE.md only mentions the former pattern. Pick `docs/`.
3. **Auth column rendering** when `auth: 'X-St8-Secret'` vs `'loopback'` vs `'none'` — keep verbatim, or human-friendly ("secret" / "loopback" / "open")? CLAUDE.md current rows use a mix ("none", "POST: X-St8-Secret", "X-St8-Secret", "loopback"). T4 should pick one convention; the manifest uses literal strings, so emit verbatim for least magic.
4. **Multi-method rows** (`method: 'GET|POST'`) — emit as one row with "GET / POST" (CLAUDE.md current style, line 109, 113) or split? Emit one row to keep 1:1 with manifest entries.
5. **The 4 README static rows** (`/`, `/*.js`, `/*.css`, `/*.ttf`) — drop, or relocate outside the sentinel? Recommend relocate to preserve hand-curated content not in scope for the manifest.
6. **Should T4 also strip the stale `cd /home/bozertron/...` and `backend/` references?** No — out of scope per the founder note; flag for P0.3 (see §4 above).
7. **Does anyone consume the README API table programmatically today?** Search turns up no consumers; only `tests/` references to `README.txt` (schema-card sidecar) and `tests/README.md` (test conventions doc). Safe to restructure the table.
