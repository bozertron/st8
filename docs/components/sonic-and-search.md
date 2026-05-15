# Sonic and Search

## Component cluster: `sonic-and-search`

The Sonic integration is the foundation (Layer 1) of the PM-1 vision — a "continuous insight engine" for codebases. It was shipped in `st8_bible.md` Batch 027 (`sonic-foundation`). This document covers the four files in `src/features/search/`, the dormant `background-indexer.js`, the ground-plane utility, and how they relate to the wider PM-1 plan.

---

## 1. What Sonic is, and why st8 uses it

[Sonic](https://github.com/valeriansaliou/sonic) is a sub-millisecond TCP search backend written in Rust. It is **not** Elasticsearch: it stores `word → [id1, id2, …]` mappings (identifiers only, not documents) in a RocksDB KV store, plus a memory-mapped FST (Finite-State Transducer) for autocomplete and typo correction. Crisp uses it at production scale (500M objects).

**Why st8 uses it** (per `docs/Sonic/sonic-integration-architecture.md`):

- **Warm cache for code-metadata queries.** Cold Node.js subprocess spawning was costing ~200 ms per Tauri command (2.3:1 overhead-to-execution ratio). Sonic stays warm and returns IDs in `<2 ms` for symbol/file/directory lookups. SQLite then enriches those IDs with full graph rows.
- **Pragmatic, lightweight.** ~28 MB RAM peak, ~21 MB on disk per million indexed objects. Stays out of the way; runs as a child process.
- **Per-project store.** Each target gets its own `<targetDir>/.st8/sonic-store/` so projects don't share an index.
- **Benchmarks (from upstream README):**
  - PUSH 4,000/sec/thread, 275 µs avg
  - QUERY 1,000/sec/thread, 880 µs avg

The architectural deal is: **Sonic returns IDs fast; SQLite returns rows behind those IDs**. Sonic does not replace the graph database — it makes lookups against it microsecond-fast.

---

## 2. The trio (client / indexer / queries)

These three files were pulled from `docs/Sonic/sonicClient.{js,ts}`, `sonicIndexer.{js,ts}`, `sonicQueries.{js,ts}` (originally MAESTRO assets) and re-homed into `src/features/search/` with kebab-cased filenames. Internal requires were rewritten for the st8 layout.

### `src/features/search/sonic-client.js`

- TCP client implementing the **Sonic Channel protocol** directly (no npm dependency on `sonic-channel`). 567 lines.
- Manages **separate connections** for `search` mode and `ingest` mode (Sonic protocol requires this).
- Exports `SonicChannel`, `SonicClient`, and a default singleton `sonicClient`.
- Default host changed from `[::1]` (upstream canonical) to `127.0.0.1` to match the daemon's IPv4 runtime config.

### `src/features/search/sonic-indexer.js`

- 446 lines. Pushes graph data into Sonic.
- Constants:
  - `COLLECTION = 'codebase'`
  - Buckets: `nodes`, `edges`, `files`, `dirs`
  - `BATCH_SIZE = 50`, `BATCH_DELAY_MS = 5`, `MAX_TEXT_LENGTH = 500`
- Public methods:
  - `indexGraphNodes(nodes, projectId)` — batched node PUSH with deduplication
  - (sibling methods for edges, files, directories — same shape)
- Reads/writes via `better-sqlite3` and `getSharedDatabasePath()` from `core/database/graph-persister.js`.
- Has its own session-scoped `indexedIds: Set` for deduplication.

### `src/features/search/sonic-queries.js`

- 659 lines. The **query layer with SQLite fallback**.
- Each public method follows the same pattern: try Sonic → if results, enrich with SQLite; if Sonic empty or unavailable, run pure-SQLite path:
  - `findImportsOf(symbol, graphId)` — Sonic FST + SQLite edge fetch (target `<5 ms`, baseline 325 ms)
  - `findConsumersOf(file, graphId)`
  - `searchSymbols(query, options)`
  - `getDirectorySubgraph(dir, graphId)`
  - `suggestSymbols(prefix, graphId, maxResults)` — Sonic SUGGEST first; SQLite prefix scan fallback
  - `findRelatedFiles(file, graphId)`
- All return shape: `{ data, source: 'sonic+sqlite' | 'sqlite', queryTimeMs, sonicTimeMs?, sqliteTimeMs? }`. Source-tagging is **already wired**, which means consumers can see whether they hit Sonic or fell through.
- SQLite implementations: `findImportsSQLite`, `findConsumersSQLite`, `searchSymbolsSQLite`, `fetchDirectorySubgraphSQLite`, `suggestFromSQLite`, `fetchRelatedFilesSQLite`. All present in the file.

### How they interlock

```
sonic-daemon (process)
        ▲
        │ spawn / TCP probe
        │
   sonic-client  ←──── singleton ────►  sonic-indexer
        │                                   │
        │                                   │ feeds Sonic at index-time
        │                                   ▼
        └──────── used by ────────►   sonic-queries
                                            │
                                            │ falls through to SQLite when daemon unavailable
                                            ▼
                                   core/database/graph-persister
```

---

## 3. The daemon (`sonic-daemon.js`) — Node-port of the Rust lifecycle manager

`src/features/search/sonic-daemon.js` is the Node-side rewrite of `docs/Sonic/sonic_daemon.rs` (which was Tauri-specific). It is a **singleton** (one Sonic process per Node process).

### Lifecycle

- **`start({ targetDir })`** — idempotent. Steps:
  1. Bail if `docs/Sonic/sonic` binary missing → `binary_missing`, SQLite-only mode.
  2. Bail if `docs/Sonic/sonic.cfg` template missing → `config_missing`.
  3. `chmod 0o755` the binary every start (idempotent).
  4. **Adopt-if-already-running**: TCP-ping `127.0.0.1:1491`; if up, mark available + return `external` reason without spawning.
  5. `mkdir -p <targetDir>/.st8/sonic-store/{kv,fst}` for per-project index.
  6. Materialize **runtime config** (see § 3.2) at `<targetDir>/.st8/sonic-store/sonic.runtime.cfg`.
  7. `spawn('docs/Sonic/sonic', ['-c', runtimeConfig], { env: { ...process.env, SONIC_STORE_PATH: storePath }, detached: false })`.
  8. Pipe child stdout/stderr through `[sonic] …` prefix to st8's stderr.
  9. Poll TCP port every 100 ms up to 5 s (`HEALTH_CHECK_MAX_MS`). If never opens → SIGTERM child, mark `health_check_failed`, return SQLite-only.

- **`stop()`** — SIGTERM, spin-wait up to `SHUTDOWN_GRACE_MS = 1500`, then SIGKILL.

- **`isAvailable()`** — boolean: process alive + healthy.

- **`getStatus()`** — `{ running, pid, port, host, since, restartCount, storePath, lastError }`.

### 3.1 Health-check semantics

Uses raw `net.Socket` (`pingPort`) with 500 ms socket timeout. Treats any of `connect` success → true; `timeout` or `error` → false. Polls until either healthy or deadline.

### 3.2 Runtime-config materialization (the IPv6 → IPv4 workaround)

`docs/Sonic/sonic.cfg` is **canonical** (synced from MAESTRO) and uses `inet = "[::1]:1491"`. Some hosts — sandboxed Linux, IPv6-disabled VMs, the smoke target — reject IPv6 binds and Sonic logs `error binding channel listener: Address family not supported by protocol`.

The daemon does not edit the canonical config. Instead, on every `start()` it reads the template, regex-replaces `^\s*inet\s*=.*$` with `inet = "127.0.0.1:1491"`, and writes the patched copy to `<targetDir>/.st8/sonic-store/sonic.runtime.cfg`. Sonic is launched with `-c <runtime>`. The canonical `[::1]` file is never touched.

### 3.3 Graceful degradation

Every failure path (`binary_missing`, `config_missing`, `store_mkdir_failed`, `config_write_failed`, `spawn_failed`, `health_check_failed`) logs **one** `console.warn` and returns `{ ok: false, reason, available: false }`. st8 continues to boot. `sonic-queries.*` paths fall through to SQLite. The bible verifies this: when Sonic crashed with `[::1]`, st8 still reached `force-check 6/6 pass`.

---

## 4. The hook integration

Wired in `src/core/hooks/default-subscribers.js`, priority **10** on the `INDEX_START` event:

```js
registry.register(HOOKS.INDEX_START, async (ctx) => {
  try {
    const daemon = require('../../features/search/sonic-daemon');
    await daemon.start({ targetDir: ctx.targetDir });
  } catch (err) {
    console.warn('[st8] Sonic daemon start failed:', err.message);
  }
}, { priority: 10, source: 'sonic-daemon' });
```

`INDEX_START` is fired from `src/core/server/main.js` line 107 (`await hookRegistry.execute(HOOKS.INDEX_START, { targetDir, persistence })`). The comment in the hook source notes: "Optional; if Sonic isn't installed or can't start, this subscriber logs a warning and st8 boots in SQLite-only mode."

This means future subscribers (Layer 2 multi-pass analyzer, `background-indexer`, etc.) can register on `INDEX_COMPLETE` and rely on Sonic being warm by the time their callbacks fire — as long as Sonic itself was available.

---

## 5. Ground plane (`src/shared/utils/ground-plane.js`)

A small XDG-shared-directory verifier. On startup it ensures these paths exist and are writable, falling back to `os.tmpdir()/maestro-<pid>/` if not:

| purpose  | primary                                           |
| -------- | ------------------------------------------------- |
| data     | `$XDG_DATA_HOME/com.scaffolder.app/`              |
| cache    | `$XDG_CACHE_HOME/com.scaffolder.app/`             |
| plugins  | `$XDG_DATA_HOME/com.scaffolder.app/plugins/`      |
| temp     | `$TMPDIR/maestro-<pid>/work/`                     |

`APP_ID = 'com.scaffolder.app'`. Exports `initGroundPlane()`, `getVerifiedPath(purpose)`, `validateGroundPlane()`, `getGroundPlanePaths()`.

### The maestro exchange-surface concept

The founder's intent: `~/.local/share/com.scaffolder.app/` is the **shared filesystem channel between st8 and MAESTRO** (the LLM-colleague Tauri app). The idea is that maestro writes resolution artifacts (LLM-discovered insights, opportunity catalog entries, etc.) into this directory, and st8 picks them up via a file-watcher. Symmetrically, st8 writes graph snapshots and ticket bundles here for maestro to consume.

This bridge is **not yet built**. The founder explicitly deferred it. Today, `ground-plane.js` only verifies the directories — nothing watches them, and no st8 code path writes into them. The `APP_ID` is still the maestro-era `com.scaffolder.app` rather than something st8-specific (see ticket).

---

## 6. The dormant `background-indexer.js`

`src/features/indexing/background-indexer.js` was pulled into st8 alongside the Sonic trio but **cannot load**. It is the would-be Layer 1 service from PM-1: queue-based async project indexing, FileWatcher for incremental updates, file-insight slots.

Three requires at the top are broken:

```js
const sonicClient_js_1     = require("./sonicClient.js");        // wrong path; should be ../search/sonic-client
const multiPassAnalyzer_js_1 = require("./multiPassAnalyzer.js"); // FILE DOES NOT EXIST
const precisionCapture_js_1  = require("./precisionCapture.js"); // FILE DOES NOT EXIST
```

Founder context (paraphrased from bible Batch 027): *"sonicClient referred to a library we were using" — i.e. the Sonic client was assumed available but the JS sources had not been brought across. Batch 027 brought the Sonic trio (which clears one of the three requires), but `multiPassAnalyzer.js` and `precisionCapture.js` are still missing and were never part of the drop.*

So today, `background-indexer.js` is:
- Loaded by no one (no caller `require`s it).
- Would throw `MODULE_NOT_FOUND` on first `require` if anyone tried.
- Captured here in case the founder eventually ports the missing pieces from MAESTRO OR rewrites the analyzer to write directly into `InsightStore` (see roadmap).

---

## 7. The PM-1 5-layer vision

Source: `docs/Sonic/pm1-background-indexer-vision.md`.

| Layer | Theme                                | Status (May 2026)                                   |
| ----- | ------------------------------------ | --------------------------------------------------- |
| 1     | Background Indexer + Cache           | **Foundation shipped (Sonic daemon).** Async indexing service itself is dormant. |
| 2     | Multi-Pass Analyzer (5 passes)       | Deferred. `multiPassAnalyzer.js` not ported.        |
| 3     | Hook system + LLM experts            | Hook system exists (`hook-registry.js`); LLM experts not wired. |
| 4     | Opportunity Classifier               | Not started. Schema in vision doc.                  |
| 5     | Visualization + Simulation Playground | Visualization partially shipped (Phase B+C); simulation engine unbuilt. |

### Layer 1 — Background Indexer (foundation shipped)

- `BackgroundIndexer` service with queue + job manager
- `.scaffolder-cache/index.db` (SQLite WAL) cache materialization
- FileWatcher for incremental updates
- Tables: `ProjectIndex`, `FileInsightSlots`, `AnalysisPass`
- **What shipped:** the Sonic daemon + trio (the *substrate*). What didn't: the `BackgroundIndexer` class itself (file exists but cannot load).
- Estimated effort in vision doc: 60h.

### Layer 2 — Multi-Pass Analysis Pipeline

Five iterative passes per file:
1. **Baseline** — file complexity, export/import ratios, structural metrics
2. **Dependency Health** — circular deps, breaking changes, version conflicts
3. **Pattern Detection** — recurring issues, anti-patterns
4. **Security** — vulnerabilities, compliance, sensitive data flows
5. **Meta-Architectural** — system-wide patterns, scaling limits, abstraction gaps

Each pass produces `InsightRecord`s stored in `FileInsightSlots`. Vision-doc effort: 140h.

### Layer 3 — Hook system + LLM experts

Hook types: `NewInsight`, `Pattern` (3+ similar insights in same module), `Threshold`, `Scheduled`. LLM experts: `PatternAnalyst`, `PerformanceAdvisor`, `ArchitectureReviewer`, `SecurityAnalyst`. Drive: when Sonic indexes tickets+insights, the shelf chat input can call an LLM expert via `LLM_PROVIDERS` config. Vision-doc effort: 90h.

### Layer 4 — Opportunity Classifier

Systematizes insights into a searchable `Opportunity` catalog (`granular` vs `meta_architectural`, severity, effort/impact, proposed optimization). Query API: `listOpportunities`, `getImpactRoadmap`, `getPatternInsights`. Vision-doc effort: 60h.

### Layer 5 — Interactive Playground

Three-panel UI: opportunity explorer / current architecture graph / proposed state + simulation controls. The visualization side is **partly done** (Phase B + C of an earlier batch shipped D3 graph rendering and the explorer chrome). The **simulation engine** — computing baseline metrics, applying proposed changes conceptually, delta-metrics output — is unbuilt. Vision-doc effort: 110h.

---

## 8. How to verify Sonic is healthy

From the bible's end-to-end verification (Batch 027):

```bash
$ node start.js /tmp/st8-smoke-target
…
[sonic-daemon] Sonic running on 127.0.0.1:1491 (pid <X>, store /tmp/st8-smoke-target/.st8/sonic-store)
[st8] Manifests generated
[st8] Schema cards emitted
[st8:force-check] 6/6 checks pass
[st8] Ready!
```

External raw-TCP probe (banner check):

```bash
$ curl http://127.0.0.1:1491
CONNECTED <sonic-server v1.4.9>
```

Programmatic check (Node REPL):

```js
const daemon = require('./src/features/search/sonic-daemon');
daemon.getStatus();
// → { running: true, pid: …, port: 1491, host: '127.0.0.1', since: '…', restartCount: 1, … }
```

Graceful-degrade signature (Sonic spawned but couldn't bind):

```
[sonic] error binding channel listener: Address family not supported by protocol
[sonic-daemon] Sonic spawned but port 1491 never opened — SQLite-only mode
[st8:force-check] 6/6 checks pass
```

---

## 9. Caveats

- **IPv6 vs IPv4.** Canonical `sonic.cfg` uses `[::1]`. Daemon writes a runtime override to IPv4. Do not "fix" the canonical config — it's synced from MAESTRO.
- **Runtime config location.** Per target: `<targetDir>/.st8/sonic-store/sonic.runtime.cfg`. If you move targets, you'll regenerate it. Safe to delete; daemon re-materializes on next start.
- **Sonic not installed.** Everything keeps working. `sonic-queries.*` falls through to SQLite. The bible verified this end-to-end.
- **`chmod 0o755` every start.** Daemon does it idempotently rather than demanding a manual chmod (see ticket — possibly overkill).
- **Sonic crash on broken pipe.** Smoke tests showed upstream Sonic panicking when clients disconnect uncleanly. This is an upstream bug; for now, st8's client carefully closes channels and the daemon's adopt-if-already-running path can recover after a crash if Sonic is restarted by systemd or similar.
- **Per-target stores.** Re-indexing the same target appends — Sonic's FST consolidates periodically (see `consolidate_after = 180` in `sonic.cfg`), but the on-disk KV grows. No GC of stale `node_*` IDs today.
- **Ground-plane bridge is conceptual only.** No code today reads or writes `~/.local/share/com.scaffolder.app/` for st8 ↔ maestro exchange. The directory is verified but unused.
- **No daemon tests.** Lifecycle (start/stop/restart/adopt-external) is exercised only by the smoke target.
