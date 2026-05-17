# Research — `src/features/search` (Data Unblock Pass 2)

Read-only audit under the analysis-tools-unblock lens. Date: 2026-05-17.
Mission anchor: batch 027 (sonic-foundation, Layer 1 of PM-1) shipped; Layers 2-5 unbuilt; ticket-indexer P1 unbuilt.

---

## 1. File inventory

```
/home/user/st8/src/features/search/
├── sonic-client.js   594 LOC  TS-compiled-from .ts; TCP Sonic Channel protocol
├── sonic-daemon.js   630 LOC  Hand-written Node lifecycle manager (singleton)
├── sonic-indexer.js  453 LOC  TS-compiled; graph -> Sonic push
└── sonic-queries.js  680 LOC  TS-compiled; Sonic-then-SQLite query layer
                                                       Total 2357 LOC
```

Tests:
- `tests/features/search/sonic-daemon-lifecycle.test.js` — 10 lifecycle tests
- `tests/features/search/sonic-daemon-config.test.js` — 9 cfg-drift tests
- `tests/features/search/sonic-password.test.js` — 7 password-lifecycle tests
- No tests for `sonic-indexer.js` or `sonic-queries.js` end-to-end.

Vendoring note: client / indexer / queries are compiled JS with `__awaiter`/`__importDefault` headers. Per batch-030 corpus rules, treat them as TS-vendored (hand-editing prohibited; canonical source under `docs/Sonic/sonicIndexer.ts` etc.). `sonic-daemon.js` is hand-written and editable.

---

## 2. Sonic daemon lifecycle + health

`sonic-daemon.js` is a singleton with the Wave 5A/5B hardening landed:

| Concern | State |
|---|---|
| Boot | INDEX_START P=10 subscriber in `default-subscribers.js:84-99` invokes `daemon.start({ targetDir })` |
| Optional | binary_missing / config_missing / health_check_failed all single-warn + SQLite-only |
| Adopt-if-running | TCP ping `127.0.0.1:1491` pre-spawn (line 422) |
| Config validation | `validateSonicConfig()` at lines 190-245 — checks 5 sections, port, auth_password, `${SONIC_STORE_PATH}` ≥2 |
| Per-instance auth | `.st8/sonic.password` mode 0600 + `sonicClient.setPassword()` push (lines 258-278) |
| Panic recovery | `schedulePanicRestart()` — backoff `[1s, 5s, 30s]`, cap 3 (lines 326-352) |
| Async stop | SIGTERM → race child.once('exit') vs setTimeout(1500) → SIGKILL fallback; spin-wait gone (lines 559-599) |
| Health-check surface | `getStatus()` returns `{ running, pid, port, host, since, restartCount, storePath, lastError }` (lines 605-616) — NOT exposed via HTTP |

**The full `getStatus()` shape is ready to wire as `/api/sonic/status` (P2 in roadmap). One handler, no new state needed.**

---

## 3. What's indexed in Sonic today

By the trio's design, the indexed surface:
```
COLLECTION = 'codebase'
BUCKETS    = 'nodes' | 'edges' | 'files' | 'dirs'   (per-project when projectId given)
```
- `indexGraphNodes`: name + type + path parts + metadata (exportedAs, kind, stateKeys, actionKeys, getterKeys, uiElements, specifiers, description). Capped at `MAX_TEXT_LENGTH=500`.
- `indexGraphEdges`: edge.type + fromNode.name + toNode.name; imports/exports get keyword expansion.
- `indexFileMetadata`: name + path + dir parts + exports.
- Re-index is destructive-flush (FLUSHB) + re-push. Incremental uses per-fingerprint FLUSHO. GC is correct (Wave 5B audit at sonic-daemon.js:53-92).

**But none of this runs today.** The only live caller of `sonic-indexer.SonicIndexer` is `background-indexer.js:populateSonicIndex()` (line 620) — and `background-indexer.js` has zero callers in `src/` (grep confirmed). The closest thing to live indexing is `sonic-indexer` instantiated by tests only.

The daemon SPINS UP at INDEX_START (P=10) but nothing pushes data, so the on-disk store stays empty across boots. `sonic-queries` always falls through to SQLite (its `source` tag never reads `sonic+sqlite` in production — confirmed via the JSDoc note at sonic-queries.js:79).

---

## 4. What's NOT indexed but could be

Three obvious feeds, all cheap because the producer-side data already lives in SQLite:

1. **Insights** (canonical-13 categories + the 5 ad-hoc populator categories). Already persisted to `scaffolder_data.sqlite::InsightRecords` per batch 030. Bucket: `BUCKET_INSIGHTS = 'insights'`; objectId `insight:<projectId>:<insightId>`; text = `category + severity + description + evidence`. Wires SUGGEST / QUERY for "find files with circular_dependency near X".
2. **Tickets**. Already in `st8.sqlite::tickets` (filepath, fingerprint, userNote, identityBundle). P1 in the roadmap. Bucket `BUCKET_TICKETS = 'tickets'`; objectId `ticket:<id>`; text = `userNote + filepath + scope`. Wires shelf chat search-as-you-type.
3. **Files-with-cycles / connection topology**. `connections` table + `circular_dependency` insights exist post-batch-031. A composed bucket `BUCKET_CYCLES = 'cycles'` (one row per cycle, text = `fingerprints + filenames`) makes "show me cycles near alpha.js" a Sonic SUGGEST + KV intersect.

The taxonomy gap from batch 030 (canonical-13 vs 5 ad-hoc) does not block any of these — Sonic stores opaque text, no schema enforcement needed.

---

## 5. Query API surface + live callers

`sonic-queries.SonicQueries` exposes:
- `findImportsOf(symbol, graphId)`
- `findConsumersOf(file, graphId)`
- `searchSymbols(query, options)`
- `getDirectorySubgraph(dir, graphId)`
- `suggestCompletions(prefix, graphId, limit)` — pure Sonic, falls back to SQLite `LIKE`
- `findRelatedFiles(file, graphId)`

All return `{ data, source: 'sonic+sqlite'|'sqlite', queryTimeMs, sonicTimeMs?, sqliteTimeMs? }`.

**Live caller audit:** `grep -rn "getSonicQueries\|sonic-queries\|SonicQueries" src/` → zero hits outside `src/features/search/`. The query layer has NO production consumer. Wired but unused (parallel to the `source` tag observation in the JSDoc at sonic-queries.js:79).

---

## 6. `/api/sonic/*` — what exists, what's missing

**Grep `/api/sonic` against `src/core/server/app.js` → 0 matches.** No Sonic routes at all. The /api/* switch in `app.js:401-490` enumerates 24 routes; Sonic is absent.

Missing endpoints (roadmap P2 + reasonable extras):
- `GET /api/sonic/status` — already-ready handler (`daemon.getStatus()`). ~15 LOC.
- `GET /api/sonic/search?q=foo&bucket=insights` — passthrough to `sonicQueries.searchSymbols` or raw `client.query`. ~20 LOC.
- `GET /api/sonic/suggest?prefix=cir&bucket=insights` — passthrough to `sonicQueries.suggestCompletions`. ~15 LOC.

CLAUDE.md API table has 12 rows today; adding `/api/sonic/*` would not increase test count meaningfully (handlers are thin pass-throughs).

---

## 7. PM-1 Layer 2-5 readiness — cheapest Layer-2 pass

Recipe-A precedent (batch 031): `cycle-insight-emitter.js` already proves the pattern for one canonical category (`circular_dependency`) wired as INDEX_COMPLETE P=37 subscriber.

The 5 PM-1 Layer-2 passes (Baseline, Dependency Health, Pattern Detection, Security, Meta-Architectural) all want to be INDEX_COMPLETE subscribers. The cheapest next one is **Pass-1 Baseline complexity**:
- No new dep needed — `src/shared/utils/ast-parser.js` already produces AST. Compute cyclomatic complexity inline (count `if/for/while/case/&&/||` nodes in the AST).
- Emit canonical category `complexity` per the InsightCategory enum.
- Subscribe at P=38 (after `cycle-insight-emitter` P=37), source `'baseline-complexity-emitter'`.
- Follow recipe A: pure `emitComplexityInsights(persistence, opts)`, late-binds `getInsightStore()`, tests use fakeStore.

Even cheaper signal: **emit `unused_export` as a canonical-category producer** — `background-indexer.js:527-580` already has the emitter logic inline, dormant. A 100-LOC adapter that reads exports from `parser-persistence` + intersects with `connections` table (Persistence-derived analyzer recipe C) wires it without porting any maestro helper.

Layer 3 (LLM experts) needs the `LLM_PROVIDERS` config first (the `providers` table mirrors it but no provider abstraction exists). Layer 4 needs Layer 3 output. Layer 5 visualization partially shipped; simulation needs Layer 4.

---

## 8. TOP 3 QUICK WINS

1. **`GET /api/sonic/status`** — wire `daemon.getStatus()` into `app.js`. ~15 LOC + 1 test. Unlocks frontend "Sonic up?" badge + ops smoke checks. Zero risk; daemon-side already returns the shape.
2. **Sonic ticket-indexer subscriber (P1 in roadmap)** — INDEX_COMPLETE P=45 (after retention P=50? no, before, e.g. P=42) subscriber that reads `persistence.getOpenTickets()`, pushes `text = userNote + filepath` into bucket `tickets`. ~80 LOC + 3 tests. The persistence handle is already in ctx; sonicClient singleton is already live. Result: `GET /api/tickets?q=foo` can route through Sonic in a follow-up wave.
3. **Canonical-category Insight-to-Sonic bridge** — INDEX_COMPLETE P=46 subscriber that snapshots `InsightRecords` and pushes into bucket `insights`. Per recipe A but with the Sonic-push side-effect substituted for the InsightStore write. ~100 LOC + 4 tests. Unlocks SUGGEST-driven "find insights near X" without building Layer 3.

All three are pure additions, no edits to TS-vendored files, recipe-A-shaped.

---

## 9. Cross-directory dependencies

- `sonic-indexer.js:21` → `./sonic-client.js`
- `sonic-indexer.js:30` → `../../core/database/graph-persister.js` (`getSharedDatabasePath`)
- `sonic-indexer.js:31` → `../../shared/types/integr8-types.js`
- `sonic-queries.js:56` → `./sonic-client.js`
- `sonic-queries.js:57` → `../../core/database/graph-persister.js`
- `sonic-daemon.js:457` → `./sonic-client` (for `setPassword` injection)
- `sonic-daemon.js` reads `docs/Sonic/sonic` (binary) and `docs/Sonic/sonic.cfg` (template).
- Inbound: `src/core/hooks/default-subscribers.js:44` requires `sonic-daemon` only. `src/features/indexing/background-indexer.js:65` requires `sonic-client` (dormant). No other inbound edges.

Watcher comment at `sonic-indexer.js:24-29` flags that any future move of `graph-persister.js` silently breaks the trio.

---

## 10. Gaps + open questions

- **`background-indexer.js` revival is the binary fork** — port maestro helpers (multiPassAnalyzer + precisionCapture) vs replace with direct InsightStore writes (roadmap P1). Founder-deferred. Quick-win path 3 above is the third option: skip background-indexer entirely; wire each Layer-2 pass as its own subscriber.
- **`/api/sonic/status` is documented in roadmap but not in CLAUDE.md** — the API table at CLAUDE.md's top would need a row added when shipped.
- **Sonic store GC (P3)** — Wave 5B audit established FLUSHB+FLUSHO covers per-pass GC; RocksDB tombstones plateau via `consolidate_after = 180`. No urgent action.
- **APP_ID divergence** — `ground-plane.js` switched to `com.st8.app` (Wave 5B ticket 6); `graph-persister.js:105` still uses `com.scaffolder.app` for `scaffolder_data.sqlite` (deferred migration). Independent of Sonic but relevant to the ground-plane bridge P1.
- **No tests for `sonic-indexer.js` or `sonic-queries.js`** — Wave 5B tested the daemon; the push/query paths are uncovered. Mutating either silently breaks insights→Sonic when ticket-indexer or insight-bridge ships.
- **Source-tag never read** — sonic-queries.js JSDoc notes the wire is there; first consumer that reads `source === 'sonic+sqlite'` would unlock a Sonic-hit-rate gauge essentially for free.
- **No Sonic data flows today.** Daemon is up but the index is empty until something pushes. Until quick-win 2 or 3 lands, every Sonic-aware route would just return empty + fall through.
