# src/features/watcher — data-unblock-pass-2 audit

**Date:** 2026-05-17
**Mode:** Read-only
**Lens:** batch 031's four recipes + constellation-SSE-coverage gap.

---

## 1. File inventory

Single file in scope:

| File | LOC | Role |
|---|---|---|
| `/home/user/st8/src/features/watcher/file-watcher.js` | 203 | Chokidar wrapper + debounce-flush + `getMetrics()` |

Tests: `/home/user/st8/tests/features/watcher/file-watcher.test.js` (11 probes, all passing per the 4A review).

Callers / consumers (outside `src/features/watcher/`):

- `/home/user/st8/src/core/server/main.js` lines 17, 443–521 — sole constructor site. `onFileChange(changes)` is a thin async orchestrator that fires `FILE_BEFORE_CHANGE` → `_applyFileChange()` → `FILE_AFTER_CHANGE` per change, then runs the post-loop batch (manifest + intent-seeder + gap-analyzer).
- `/home/user/st8/src/core/server/main.js` lines 74–179 — `_applyFileChange()` helper. Owns the persistence write (`upsertFile` + `logMutation`) and the in-memory `result.files` mutation. Returns `{ file, mutation } | null`.

---

## 2. Watcher event-detection surface

`file-watcher.js:137-139` subscribes to **three** chokidar events:

- `add`  → `_onFileChange(path, 'add')`
- `change` → `_onFileChange(path, 'change')`
- `unlink` → `_onFileChange(path, 'unlink')`

Not subscribed: `addDir`, `unlinkDir`, `ready`, `raw`. Directory-only creates/deletes (no contained file events) are invisible.

Configuration (lines 90–135):

- Single `targetDir` root. **No multi-root support** (deferred per roadmap P3 "Multiple-target-dir support").
- `awaitWriteFinish` 200ms stability + 100ms poll (coalesces editor save flurries).
- `depth: 10`, `followSymlinks: false`, `persistent: true`.
- Ignored: `node_modules`, `.git`, `dist`, `build`, `.venv`, `venv`, `__pycache__`, `*.sqlite[-wal|-shm]`, root-only `connection-state.json` + `ai-signal.toml`, `.st8/**`, `.planning/st8_identity_system/**`, `.archive/**`, `snapshots/**`. The previous broad `**/*.json` / `**/*.toml` globs were tightened in Wave 4A ticket 13 to two root-only paths so `package.json` / `tsconfig.json` edits flow through.

Debounce semantics:

- `pendingChanges: Map<"${path}::${type}", {path, type}>` (Wave 4A ticket 4 fixed the Set-of-fresh-literals bug).
- Composite key preserves a CREATE+EDIT pair on the same path within one window (verified by `tests/features/watcher/file-watcher.test.js` probe 3).
- `_flush()` snapshots `.values()`, clears the Map, awaits `this.onFileChange(changes)`. Errors caught and logged.

Metrics (Wave 4A ticket 14): `eventsReceived`, `debounceMergeCount`, `flushCalls`, `lastFlushAt`, `lastFlushSize`. `getMetrics()` returns a shallow copy — **not exposed via any HTTP route today** (roadmap P3 "Watch-mode performance metrics").

---

## 3. Hook fire shape (FILE_AFTER_CHANGE payload + invariants)

`HOOKS.FILE_AFTER_CHANGE` payload per `hook-registry.js:49` and `main.js:482`:

```js
{
  change:      { path, type },     // raw chokidar event
  file:        FileRow | null,     // null on no-op apply
  mutation:    MutationRow | null, // null on no-op apply
  schemaCard:  null,               // populated by P=20 subscriber
  targetDir:   string,
  persistence: St8Persistence,
  emitter:     SchemaCardEmitter,
}
```

`HOOKS.FILE_BEFORE_CHANGE` payload: `{ change, targetDir, persistence }`. No subscribers registered today.

Invariants:

- `_applyFileChange` returns `null` on three "no-op" cases: unknown unlink, hash-unchanged change, read failure. `FILE_AFTER_CHANGE` still fires with `file:null, mutation:null` so subscribers can observe attempted-but-skipped events. Every default subscriber guards with `if (!file || !mutation) return;`.
- Persistence write happens BEFORE `FILE_AFTER_CHANGE` fires — the schema-card emitter at P=20 and the SSE broadcaster at P=30 see committed state.
- `mutationType` is one of `CREATE | EDIT | DELETE` from the watcher path. **CONCEPT / LOCK / PRODUCTION / PURGE never originate here** — they come from `app.js` POST handlers and `bruno-oscar.js`.

---

## 4. Subscribers wired today

`/home/user/st8/src/core/hooks/default-subscribers.js`:

| Hook | Priority | Source tag | What it does |
|---|---|---|---|
| `FILE_AFTER_CHANGE` | 20 | `file-after-change/schema-card-emitter` | DELETE: unlink schema-card JSON on disk. CREATE/EDIT: parse AST, build `{count, lastMutation}` from `getLastMutation` + `getMutationCount`, call `emitter.emitCard`, attach to `ctx.schemaCard`. (lines 349–402) |
| `FILE_AFTER_CHANGE` | 30 | `file-after-change/sse-broadcaster` | Calls `notificationBus.publish({ fingerprint, filepath, mutationType, actor, sha256Hash, schemaCard: ctx.schemaCard || null })`. (lines 410–433) |
| `FILE_BEFORE_CHANGE` | — | — | **No subscribers** (contract reserved). |

Note: Wave 4C ticket 16 made the printer fallback in `notification-bus.publish` come alive — P=20 attaches `schemaCard`, P=30 forwards it, so `printer.printCard` finally runs on watcher events.

---

## 5. SSE publication path + what gets dropped

End-to-end watcher → SSE flow:

```
chokidar add/change/unlink
  → FileWatcher._onFileChange (debounce 500ms)
  → _flush → onFileChange(changes) in main.js:451
  → filter by CODE_EXTENSIONS  ⟵ FIRST DROP POINT
  → per change: FILE_BEFORE_CHANGE → _applyFileChange → FILE_AFTER_CHANGE
  → P=30 sse-broadcaster → notificationBus.publish
  → _broadcastSSE → every /api/mutations client
```

**CODE_EXTENSIONS allowlist** (`main.js:439`): `.js .ts .jsx .tsx .vue .py .rs .go .md .txt .json`. Anything else (`.css`, `.html`, `.toml`, `.yaml`, `.svg`, `.sql`, images, env files, binaries) is dropped before any hook fires. Note this contradicts the watcher's stated event surface — the allowlist is the de-facto gate, not the chokidar ignored: list.

**Constellation-coverage gap (the question posed):** the dropped types are NOT a watcher-side issue. From the watcher, CREATE/EDIT/DELETE all flow correctly to SSE. The other types (CONCEPT / LOCK / PRODUCTION / BRUNO_CALL / ARCHIVE / UNARCHIVE / AI_REVIEW_NEEDED) have non-watcher publishers in `app.js` (lines 1176, 1255, 1390) and `bruno-oscar.js` (lines 75, 138, 203) that DO call `notificationBus.publish`. All seven types reach `/api/mutations`. The drop is **frontend-side**: the constellation's `updateFileStatus` handler at `src/frontend/app.js:330-355` only reacts to events that imply a status change (and was wired in Wave 4D ticket 1 to drop only the manifest poll, NOT to fan-out all mutation types). Watcher is not the bottleneck for the constellation gap.

---

## 6. file_mutation_log feed integrity

Schema: `/home/user/st8/src/core/database/persistence.js:117` — single `logMutation(mutation)` writer at line 1022.

Callers:

| Caller | Type | Trigger |
|---|---|---|
| `src/core/server/main.js:94` | DELETE | watcher unlink |
| `src/core/server/main.js:147` | CREATE | watcher add |
| `src/core/server/main.js:173` | EDIT | watcher change (hash changed) |
| `src/core/server/main.js:321` | CREATE | indexer Pass-1 initial upsert (NOT watcher) |
| `src/core/server/app.js:1246` | LOCK | POST /api/mvp-lock |
| `src/core/database/persistence.js:1080` | PRODUCTION | `markProduction` self-write |
| `src/core/database/persistence.js:1122` | PURGE | `purgeNonProductionMutations` self-write |

Integrity assessment of the watcher feed:

- **Hash-unchanged change is silently dropped** (`main.js:158`). The mutation log does NOT see `touch`-style events. Defensible (it's the "did the content actually change" gate) but it means `file_mutation_log` is content-change-keyed, not event-keyed. Anyone analyzing "how often does the dev touch this file" against `file_mutation_log` will undercount.
- **Unknown unlinks are dropped** (`main.js:81`). If a file is deleted that isn't in `result.files` (race vs initial index), no DELETE row is logged. Probably correct, but invisible.
- **AST-parse failure does NOT prevent mutation log** — the persistence write happens before the schema-card emit; the AST failure only affects the emitted card.
- **CONCEPT mutations have no `logMutation` call site** — `_handleConceptFile` in `app.js` line 1176 publishes the notification but does NOT log to `file_mutation_log`. (Verified by grep: zero `logMutation` calls in the CONCEPT path.) This is a feed-integrity hole — the "894-row file_mutation_log table" cited in the earlier audit is missing every CONCEPT registration. Same likely applies to ARCHIVE/UNARCHIVE/BRUNO_CALL — they only publish to the bus.

---

## 7. TOP 3 QUICK WINS

1. **Log CONCEPT/LOCK-equivalents into `file_mutation_log` from `app.js` POST handlers.** The CONCEPT path (`app.js:1176`) calls `notificationBus.publish` but never `persistence.logMutation`. Recipe-D (clear-then-rebuild) doesn't apply here, but **recipe-A (canonical-producer pattern)** does: extract a `recordMutation(persistence, {mutationType, fingerprint, actor, ...})` helper in `src/core/database/` and have every publisher call BOTH it and the bus. Single-line fix per call site; closes the integrity hole that makes any persistence-derived analyzer (recipe C) over `file_mutation_log` undercount.

2. **Expose `FileWatcher.getMetrics()` via `GET /api/watcher/stats`.** Wave 4A landed the counters; the HTTP surface is missing. Two lines in `app.js` + an `app.js` route registration. Lets recipe-C analyzers compute debounce-merge ratios and flush latency on the live system instead of guessing.

3. **Audit `CODE_EXTENSIONS` for the `.css/.html/.toml/.yaml/.sql/.vue-style` drop.** `main.js:439` silently drops every non-allowlisted file. The connection-resolver in batch 031 left 100 unresolved relatives — some are likely `.css/.json/.vue` from import statements. If the watcher never fires `FILE_AFTER_CHANGE` for `.css` edits, those files' mutation log is always empty AND the resolver's extension try-list can never catch the live edit. Pair the CODE_EXTENSIONS extension with the resolver's `JS_EXTENSIONS` extension proposed in batch 031's "path we are on" item 1.

---

## 8. Cross-directory dependencies

`file-watcher.js` itself only requires `path`, `fs`, `chokidar`. **Zero dependencies** on other `src/` modules — it's a leaf.

Caller graph (inward):

- `src/core/server/main.js` — only constructor site.
- Indirectly via `FILE_AFTER_CHANGE` subscribers: `src/features/schema-cards/emitter.js`, `src/shared/utils/ast-parser.js`, `src/core/database/persistence.js`, `src/core/notification-bus.js`, `src/features/schema-cards/printer.js`.

Test files: `tests/features/watcher/file-watcher.test.js` (11 probes, no SUT mocks, real timers).

---

## 9. Gaps + open questions

- **No `FILE_BEFORE_CHANGE` subscribers.** The contract is reserved. Likely targets: a write-lock check (Louis), a pre-mutation snapshot for diff generation, a guard against `LOCKED`-phase edits.
- **`addDir` / `unlinkDir` ignored.** A `mkdir foo && touch foo/bar.js` storm produces `add foo/bar.js` only; the empty-dir signal is lost. Probably fine — depth-10 traversal handles it.
- **Multi-root deferral** (roadmap P3). `FileWatcher(targetDir)` is single-string. Refactoring to `roots: string[]` is a clean recipe-A-shaped change: the constructor switches to `Array.isArray(targetDir) ? targetDir : [targetDir]` and `chokidar.watch` already accepts arrays. Manifest writers downstream need the more invasive change.
- **The `main.js` orchestrator still does the BATCH post-loop inline** (lines 499–518): manifest + intent-seeder + gap-analyzer. Roadmap P1 calls for these to become a `FILE_BATCH_AFTER_CHANGE` (or similar) hook. Not blocking the data-unblock work but the structural cleanup is owed.
- **The cycle-insight-emitter (batch 031) runs on `INDEX_COMPLETE`, not on watcher mutations.** A user editing in `--watch` mode does not get cycle insights refreshed until the next full re-index. Recipe-A says: register a P=37-or-similar `FILE_AFTER_CHANGE` subscriber that calls `detectCyclesFromPersistence` + `emitCycleInsights` after a batch. Or push it to the inline post-loop in `main.js`. Open question for the founder: incremental cycle detection or full re-index gating?
- **No `mutationType: 'RENAME'` event.** Chokidar fires `unlink` + `add` for renames; the watcher faithfully forwards both, so `_applyFileChange` produces DELETE+CREATE pairs. `file_mutation_log` cannot reconstruct rename history. Probably out of scope but worth flagging — birthTimestamp reuse via `getFileByPath` (CLAUDE.md identity-invariants) handles content reuse but not path renames.

---

## Cross-references

- Bible batch 031 — `/home/user/st8/st8_bible.md` lines 3331–3441 (the four recipes).
- Lifecycle-and-eventing review — `/home/user/st8/docs/_pending-tickets/lifecycle-and-eventing.review.md` (Wave 4A verdicts for tickets 0/3/4/13/14, all ack).
- Lifecycle-and-eventing roadmap — `/home/user/st8/docs/_pending-roadmap/lifecycle-and-eventing.md` (P1 onFileChange decomp = resolved upstream; P3 multi-root, watcher metrics surface, pendingChanges Map — also resolved).
- Canonical category names — `/home/user/st8/docs/Insight Store/insightStore.ts` `InsightCategory` enum (13 values; watcher events do not currently feed any canonical category but the CONCEPT-feed gap is the bottleneck to fixing that).
