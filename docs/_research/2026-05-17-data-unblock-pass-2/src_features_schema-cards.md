# Research — `src/features/schema-cards/`

Wave: `data-unblock-pass-2` (2026-05-17)
Cluster: identity-and-analysis
Mode: read-only.
Lens: the **manifest is the gating data surface** for the constellation + graph-viewer + dive-in. Most frontend "missing data" complaints land here.

---

## 1. File inventory

| File | LOC | Role | Live? |
|---|---|---|---|
| `emitter.js` | 265 | `SchemaCardEmitter` class. Writes `.st8/schema-cards/<flat>.json` per file (19 canonical fields, sorted-keys deterministic). Dedup-by-newest-birthTimestamp (Wave 3A ticket 9). Prune sweep (batch 026). | LIVE. P=20 INDEX_COMPLETE subscriber (`default-subscribers.js:154-162`). Also called from `app.js` reindex handler and CLI. |
| `manifest-generator.js` | 211 | `generateConnectionState(files, targetDir)` + `generateAiSignalToml(...)` + `writeManifests(...)`. Writes `connection-state.json` + `ai-signal.toml` to project root. | LIVE. P=10 INDEX_COMPLETE subscriber (`default-subscribers.js:142-150`). Also called from `main.js:500` and `app.js:665, 680`. |
| `printer.js` | 294 | `SchemaCardPrinter` — renders `.txt` boxes to `.planning/st8_identity_system/`. Timestamped + `LATEST_*` snapshot. Pruner keeps `maxPerFile=10`. | LIVE. Invoked from the same P=20 subscriber via `ctx.printer.printAllFromCards(...)`. 246 cards printed per latest boot log. |

Indexer-side sibling: `src/features/indexing/indexer.js:337 generateManifest()` — **dead code by every observable test.** See §3.

---

## 2. `manifest-generator.js` — emitted vs dropped

### Emitted today (per-file)

```js
{ fingerprint, filepath, filename, status, reachabilityScore,
  impactRadius, sha256Hash, imports[], importedBy[], intent{} }
```

Top-level: `metadata{timestamp, targetDirectory, totalFiles, statusCounts{GREEN,YELLOW,RED}}`. Live probe of `connection-state.json` (322 files) confirms exactly these keys.

### Dropped from `result.files` / `ctx.result`

| Field on file row | In manifest? | Notes |
|---|---|---|
| `fileSizeBytes` | NO | Cheap; could ride |
| `lastModified` (mtime) | NO | Frontend currently has no source of file age |
| `birthTimestamp` | NO | **Intentional** per the load-bearing header block (lines 10-50) — encoded inside `fingerprint`. DO NOT add naively. |
| `lifecyclePhase` | NO | **Intentional** per same block. CONCEPT/DEVELOPMENT/PRODUCTION lives in `file_registry`; UI reads `/api/files`. |
| `isEntryPoint` | NO | Boolean, useful to constellation root highlighting; no documented "intentional omission" rationale. |
| `lastIndexed` | NO | Indexer fills it; could surface "is this file stale" hints. |
| `exports[]` | NO | AST-extracted per file in `indexer.js`. Cards carry it; manifest doesn't. |
| `imports[]` shape | PARTIAL | Manifest carries raw `{source, names, isDefault}` strings (unresolved). Cards carry the same AST shape. |
| `importedBy[]` | "PRESENT" but ALWAYS EMPTY | `f.importedBy` is never populated upstream of `generateConnectionState`. **Confirmed via graph-viewer research** (line 47). Emitter cards DO populate this from `persistence.getConnectionsForFile`; manifest does not. |

### Dropped from `ctx.result` envelope

| Field | Status |
|---|---|
| `result.cycles` | **DROPPED.** Threaded through INDEX_COMPLETE (batch 030/031) but `writeManifests(ctx.result.files, ctx.targetDir)` only forwards `files`. Cycles are consumed by `cycle-insight-emitter` (P=37) and written to `scaffolder_data.sqlite` as InsightRecords. Never reaches `connection-state.json`. |
| `result.identityRisk` (`fbSummary`) | DROPPED from manifest. Written separately by Wave 3C subscriber to `.st8/identity-risk.json` (`/api/identity-risk`). |
| `result.manifest` | The indexer pre-builds a manifest object that `writeManifests` then ignores — see §3. |

---

## 3. Two-emitter divergence — who wins?

There are **two `generateManifest`-equivalent functions** in the tree:

| Function | Path:line | Shape of `files[]` | Caller |
|---|---|---|---|
| `generateConnectionState(files, targetDir)` | `manifest-generator.js:83-114` | 10 fields incl. `fingerprint`, `intent`, `importedBy:[]` | `default-subscribers.js:145` (P=10 INDEX_COMPLETE), `main.js:500`, `app.js:665/680` (reindex handler) |
| `generateManifest(files, targetDir)` | `indexer.js:337-362` | 8 fields, **no `fingerprint`, no `intent`**, `importedBy: f.importedBy \|\| []` | Called once inside `indexDirectory()` (line 452); the returned `manifest` object is stuffed into `result.manifest` and then **never written to disk and never read** anywhere else. Its sibling `writeManifest` (singular, line 364) has zero callers. |

**Verdict: `manifest-generator.js:generateConnectionState` wins on disk; `indexer.js:generateManifest` is dead.** It survives only because `indexDirectory()` still calls it and includes the result in its return tuple. The two shapes are *not* compatible (indexer's lacks `fingerprint` and `intent`) — if a consumer ever switched to it, the constellation would lose its identity key.

**Retire candidate:** drop `generateManifest`+`writeManifest` from `indexer.js` (and stop returning `manifest:` in `indexDirectory`'s return value). Pure deletion, ~30 LOC. Reduces the "which manifest am I looking at?" confusion documented by the graph-viewer report (lines 150-156).

---

## 4. `emitter.js` — dormant features

1. **`diff(file, currentCard)` (lines 218-238).** Compares a candidate card against the last on-disk card and returns `{drift, differences[]}`. Zero live callers in `src/`, `tests/`, `scripts/`. The CLI `--diff` flag is wired but exits with "not yet available from CLI — use programmatically" (line 248). Drift detection is currently FC2's job (`force-checks.js`) at the directory level — `diff()` could power a per-file `/api/card-diff/:fingerprint` endpoint or a watcher-driven mutation event surface, but neither exists today.

2. **`validateSt8SchemaCard` failures are silent.** Line 67-69: any missing field logs `console.warn` and continues. No counter, no surfacing on `/api/state`, no escalation to FC. Cross-cluster: `src/shared/types` research flagged this. If a future emitter change drops a required field, the warning scrolls past unnoticed.

3. **`options.strict`** (line 21) is captured into `this.strict` and never read. Half-built escalation path for #2.

4. **The `_cardFilename` encoding is duplicated** at `intent-seeder.js:601` (and now in any reader needing the path → `intent-and-analysis` notes from prior wave). T5's bundle plan recommended exporting `cardFilename` standalone; still not done.

---

## 5. `printer.js` — does the `.txt` carry data the JSON doesn't?

**No new data.** The `.txt` is a strict pretty-print projection of the 19-field card. Every field appears in the card already. The unique characteristics are:

- **Human-readability:** box-drawing characters, padded columns, expanded `kind/signature/returnType` per export.
- **Snapshot duality:** writes BOTH a timestamped file `${iso}_<flat>.txt` AND an overwriting `LATEST_<flat>.txt`. The `LATEST_` snapshot is never pruned (line 206) and acts as a stable per-file path for tooling.
- **Guards** (lines 46-63) skip `.txt/.json/.sqlite-*`, anything under `.archive/.planning/.st8/vendor/snapshots/`, and `.st8/schema-cards` to avoid self-recursion.
- **Pruner** keeps 10 timestamped versions per base file — primitive but functional version-history slice.

If the visual system is online, printer output is dead weight on disk. If it's offline, it's the **only** human-readable identity surface. No graph-viewer or constellation consumer reads it.

**Implication for unblock:** printer carries no unique signal and need not be enriched. Effort should go to JSON manifest + cards.

---

## 6. Carrying canonical insights in `connection-state.json` (avoid second-fetch)

Today the frontend (graph-viewer, constellation, dive-in) fetches `connection-state.json` and then would need separate calls to:

- `/api/insights` → cycles, orphan, under-connected, etc. (canonical-13 categories per `insightStore.ts:11-24`)
- `/api/identity-risk` → birthtime-fallback risk
- `/api/files` → `lifecyclePhase`

Frontend reports confirm constellation+graph-viewer ONLY fetch `connection-state.json` on boot and never round-trip again. So whatever is missing from the manifest is **invisible to the UI**.

### What's cheap to add (no new query at write time)

`ctx.result.cycles` is ALREADY in scope inside the P=10 manifest subscriber. The shape is `Array<{members: string[]}>` (filepaths or fingerprints — verify against `cycle-insight-emitter`). Adding:

```js
manifest.cycles = ctx.result.cycles || [];
manifest.cycleMembership = buildCycleMembership(cycles); // Map<filepath, cycleId[]>
```

…is a 6-line change. Frontend gets `manifest.files[i].cycleId` (or check membership) without a second fetch.

### What needs persistence reads (still cheap)

The P=10 subscriber currently calls `writeManifests(ctx.result.files, ctx.targetDir)` — but `ctx.persistence` is available. Adding a single `persistence.getAllConnections()` pass (already used by `getConnectionsForFile`) lets the manifest:

- Populate **resolved** `imports[]` (filepath strings, post-batch-031 connection-resolver) — the graph-viewer report explicitly asks for this (line 104-118)
- Populate `importedBy[]` (currently always empty)
- Optionally emit a top-level `connectionsResolved: N` count + the **100 unresolved relatives** residual flagged in batch 031

### What's structural

A `manifest.insightsSummary` block carrying `categorySummary` (calling `insightStore.getCategorySummary('st8')`) gives the constellation a per-file count badge with no extra fetch. Couples the manifest to the cross-DB `scaffolder_data.sqlite` (per batch 030 insight-store research) — defer until founder decides T3 Option A vs B.

---

## 7. TOP 3 QUICK WINS

### #1 — Populate `importedBy[]` + resolved `imports[]` in the manifest (highest leverage)

Today: `connection-state.json` ships `importedBy: []` for every file (322 empty arrays). Graph-viewer's hover-1-hop feature is gated on this. The data EXISTS in `persistence.connections` (188 rows post-batch-031) and the **card emitter already reads it** (`emitter.js:166-170`). The manifest just forgot.

Patch: change the P=10 subscriber to take `(ctx.result.files, ctx.targetDir, ctx.persistence)`; inside `generateConnectionState`, hydrate `imports`/`importedBy` from `persistence.getAllConnections()` (one query, bucket by source/target fingerprint). ~20-30 LOC.

Frontend impact: graph-viewer + constellation + dive-in all gain trustworthy edges with zero frontend code change. Tests: snapshot fixture + multi-fingerprint dedup.

### #2 — Thread `result.cycles` into `connection-state.json`

Today: cycles are in `ctx.result.cycles` AT MANIFEST WRITE TIME but dropped. They flow only to `InsightRecords` in `scaffolder_data.sqlite`. The constellation has no way to render cycle membership without a second fetch (and there isn't even a frontend route to fetch it).

Patch: add `manifest.cycles: [...]` + `manifest.files[i].cycleId: string|null`. ~10 LOC.

Frontend impact: enables "color cycle members red-ringed in constellation" — already-funded UI gap per the constellation report (line 174).

### #3 — Retire `indexer.js:generateManifest` + `writeManifest`

Today: 30 LOC of dead manifest-emit code in the indexer, shape-incompatible with the live one, returned in `indexDirectory()`'s tuple, never written, never read. Documented in graph-viewer research (lines 150-156) as confusion source.

Patch: delete the two functions, drop `manifest:` from `indexDirectory`'s return. Adjust the one test that destructures `{files, manifest}` if any (likely zero — needs `grep` confirmation by executor). ~30 LOC removed.

Impact: removes one of two competing answers to "what shape is the manifest?"; future readers see a single emitter.

---

## 8. Cross-directory dependencies

- **`src/shared/types/st8-types.js`** — `St8SchemaCard` shape + `validateSt8SchemaCard` + `parseFingerprint`. Annotated to point AT the load-bearing-omission block in `manifest-generator.js`. Symbiotic.
- **`src/shared/utils/ast-parser.js`** — `extractImportsAndExports(fullPath)` called from `emitter.js:113`. Card's `imports[]`/`exports[]` is post-AST shape, manifest's is raw indexer shape — divergence flagged in §2.
- **`src/shared/utils/birth-timestamp.js`** — feeds the registry's `birthTimestamp` which the emitter dedup keys on.
- **`src/core/database/persistence.js`** — emitter calls `getAllFiles, getAllIntents, getMutationCount, getLastMutation, getConnectionsForFile`. Manifest generator currently calls NOTHING on persistence (gap behind quick-win #1).
- **`src/features/integr8/toml-serializer.js`** — `manifest-generator.js:76` late-loads it; gracefully falls back to manual TOML on absence.
- **`src/features/analysis/gap-analyzer.js`** + **`intent-seeder.js`** — both read `.st8/schema-cards/*.json` directly (not via the emitter API). Stale cards mislead them, hence the prune sweep.
- **`src/features/analysis/cycle-insight-emitter.js`** — consumes `ctx.result.cycles` at P=37, parallel to the P=10 manifest subscriber. Both have access to the same data; only one uses it.
- **`src/core/server/app.js:401, 553-602`** — `_serveManifest` reads the on-disk JSON with an in-process mtime-gated cache. Invalidates on INDEX_COMPLETE + on `_handleFileIntent`. Already correct.
- **`src/frontend/app.js:245, 942, 982`** — sole frontend consumer of `/api/connection-state.json`. No `/api/cards` or per-card fetch exists.

---

## 9. Gaps + open questions

1. **Cycle field name + shape.** If we add `manifest.cycles`, do we mirror `cycle-insight-emitter`'s output (sorted-member fingerprint set) or `ctx.result.cycles`'s raw integr8 shape? They differ slightly — pick once, document.

2. **Resolved-imports node ID convention.** Cards carry connections as **fingerprints** (`emitter.js:167-169`). The manifest's `imports[]` carries raw **source strings**. Quick-win #1 must pick: fingerprint, filepath, or both. Frontend currently joins on `filepath` (graph-viewer line 53). Recommend filepath for manifest (consumer-facing) + keep fingerprint in cards (identity-internal). Matches the existing `connection-state.json` consumer convention.

3. **Manifest cache invalidation on cycles update.** `_serveManifest`'s in-process cache invalidates on file mtime. Adding cycles means a cycle-only change (no source file edit) must still bump the manifest mtime — already happens because INDEX_COMPLETE writes the manifest unconditionally.

4. **Multi-fingerprint dedup in the manifest.** `emitAllCards` dedups by `filepath` keeping newest `birthTimestamp` (Wave 3A ticket 9). `generateConnectionState` does NOT — it ships every row from `result.files`. The indexer's `discoverFiles` only finds extant files so this MIGHT be moot in practice, but if persistence rows outlive disk, the manifest could ship duplicates. Worth a single unit test.

5. **`isEntryPoint` is silently absent from the manifest** even though it's a Boolean on every file row. Constellation root highlighting has no signal source today. Cheap to add; no documented "intentional omission" rationale (unlike `birthTimestamp`/`lifecyclePhase`).

6. **`validateSt8SchemaCard` warnings vanish.** No surface, no counter. A degrade-in-place is invisible. Promote to `ctx.indexCompleteSummary` somewhere.

7. **`/api/manifests` is documented in CLAUDE.md but does not exist** — only `/api/connection-state.json`. Cross-cluster doc-drift (called out by route-manifest research from prior wave).

---

**End of research.** Read-only audit; no source files edited.
