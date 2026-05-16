# Research — `src/features/schema-cards/emitter.js`

Wave: analysis-tools-unblock-pass-1
Cluster: identity-and-analysis
Ticket in scope: **T5** — `GET /api/file-identity/<fingerprint>` (identity-and-analysis roadmap P1.3)
Mode: read-only research; no source edits.

---

## 1. Identity

- Absolute path: `/home/user/st8/src/features/schema-cards/emitter.js`
- LOC: 266 (single class `SchemaCardEmitter`, plus CLI block).
- Module shape: `module.exports = { SchemaCardEmitter };` (emitter.js:265).
- Owns: writes to `.st8/schema-cards/<flat>.json` deterministically, plus the **prune sweep** of stale cards.
- Sibling co-owner of the schema-cards bag: `manifest-generator.js` (connection-state.json + ai-signal.toml) and `printer.js` (.txt fallback).
- Source pedigree: pre-refactor was `backend/schemaCardEmitter.js`, migrated in commit `a1573d6` (`refactor(schema-cards): migrate emitter + printer + manifest-generator`) — see `scripts/migration/manifest-history.jsonl:4`.

## 2. Stated intent — 19-field `St8SchemaCard` shape

The canonical card shape is `St8SchemaCard` in `src/shared/types/st8-types.js:89-129`. The 19 fields written by `emitCard()` (emitter.js:40-63):

1. `fingerprint` (identity)
2. `filepath` (identity)
3. `filename` (identity)
4. `sha256Hash` (content version)
5. `fileSizeBytes`
6. `status` (`GREEN`/`YELLOW`/`RED`)
7. `reachabilityScore` (0.0–1.0)
8. `impactRadius`
9. `lifecyclePhase` (default `'DEVELOPMENT'`)
10. `birthTimestamp` (identity)
11. `lastModified` (mtime)
12. `lastIndexed`
13. `isEntryPoint` (coerced to boolean)
14. `exports` (AST-extracted)
15. `imports` (AST-extracted)
16. `connections.{importedBy, imports}`
17. `intent.{purpose, dependsOnBehavior, valueStatement}` (canonical fields only — `authoredBy`/`lastUpdated` from DB are stripped at emitter.js:151-155)
18. `mutationCount`
19. `lastMutation.{type, actor, timestamp}` (DB row's `mutationType` is mapped to `type` at emitter.js:161-163)

Validation happens via `validateSt8SchemaCard(card)` at emitter.js:66-69 — non-fatal `console.warn` on missing fields.

A concrete on-disk shape probe of `/home/user/st8/.st8/schema-cards/CLAUDE.md.json` confirmed all 19 fields at top-level (alphabetised by the sortedReplacer; see §7).

## 3. Public surface

- `class SchemaCardEmitter` (emitter.js:17)
  - `constructor(targetDir, options = {})` — accepts `options.outputDir` (default `<targetDir>/.st8/schema-cards`) and `options.strict`. Calls `_ensureOutputDir()` synchronously.
  - `emitCard(file, astResult, connections, intent, mutationSummary)` (emitter.js:39) — writes one card. Returns the card object.
  - `emitAllCards(persistence)` (emitter.js:110) — batched. Does dedup → emit loop → prune sweep. Returns `{ emitted, errors, pruned }`.
  - `_cardFilename(filepath)` (emitter.js:210) — `filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json'`. **Underscore-prefixed** (informally private), but called externally by sibling modules — see §8.
  - `diff(file, currentCard)` (emitter.js:218) — compares against last on-disk card. Currently dormant from CLI (`--diff` exits early at emitter.js:248).

- Multi-fingerprint dedup helper: an inline `Map<filepath, file>` reducer inside `emitAllCards` (emitter.js:120-131). Lexicographic ISO-8601 string compare on `birthTimestamp`; newer wins. **Not a separate exported function** — lives only inside `emitAllCards`.

## 4. Callers

| Caller | Site | Purpose |
|---|---|---|
| `src/core/hooks/default-subscribers.js:154-162` | INDEX_COMPLETE subscriber at **P=20** | The canonical production caller. Wraps `ctx.emitter.emitAllCards(ctx.persistence)` + `ctx.printer.printAllFromCards(...)` in try/catch with `[st8] Schema card emission failed: <msg>` log per ticket-13 isolation convention. |
| `src/core/server/main.js:20, 250` | `new SchemaCardEmitter(targetDir)` | Bootstrap; hoisted into `ctx.emitter` for the hook subscriber above. |
| `src/core/server/app.js:1231, 1272-1273` | manual `/api/index` handler | HTTP-triggered reindex; instantiates a fresh emitter, calls `emitAllCards`. |
| `src/features/schema-cards/emitter.js:243-262` | CLI block (`if (require.main === module)`) | Direct `node emitter.js` invocation. |
| `tests/features/schema-cards/emitter-prune.test.js` | 8 probes | Direct construction with fake persistence. |
| `tests/core/hooks/file-after-change-printer-wire.test.js:30, 59, 115` | smoke wiring | Constructs emitter for printer interplay tests. |
| `src/features/analysis/intent-seeder.js:448, 601` | reads cards | Does NOT import emitter; **reimplements** `_cardFilename` locally as a sibling method. See §8 / §10. |
| `src/features/analysis/gap-analyzer.js` | reads cards from outputDir directly | Same as intent-seeder — consumer of the on-disk output, not the class. |

Force-check FC2 (`src/core/hooks/force-checks.js:172`) treats `src/features/schema-cards/emitter.js` as a tracked-source identity touchstone.

## 5. Prior work

- **Wave 3A, ticket 9** (`docs/_pending-tickets/identity-and-analysis.for-review.json:152`, commit `c965a15`) — added the multi-fingerprint dedup block at emitter.js:118-131 + the 22-line JSDoc above `emitAllCards` (lines 87-109). Reviewer's mutation probe confirmed that removing the dedup block breaks BOTH `MULTI-FINGERPRINT — two registry rows` and `MULTI-FINGERPRINT — reverse order` probes in `tests/features/schema-cards/emitter-prune.test.js`.
- **Batch 026** (commit `c073bde`, "fix(little-stuff): indexer self-skip, registry prune, emitter card sweep") — introduced the prune sweep at emitter.js:188-199. Motivation: gap-analyzer reads the card dir directly, so stale cards from prior runs gave it false data and tripped force-check FC2.
- **Wave 3A, ticket 15** — birthTimestamp reuse in `src/shared/utils/birth-timestamp.js`. Strengthens the dedup contract because the registry's birthTimestamp is now stable across runs (newer-wins is meaningful, not racy).
- **Ticket 13 convention** — INDEX_COMPLETE subscriber's inner try/catch with `[st8] <module> failed: <msg>` log. Honored at `default-subscribers.js:154-162`.
- **Initial migration** — commit `a1573d6` (refactor(schema-cards)).
- **Wave 3A residual concern (still open)**: FC3 flags ~16 historical multi-fingerprint stale rows in the live `st8.sqlite` that this fix prevents going forward but does not retroactively clean. Out-of-scope for T5 too — flagged for the lifecycle cluster.

## 6. Existing tests

`tests/features/schema-cards/emitter-prune.test.js` — 8 probes, all relevant to T5's read path because they pin the on-disk filename and the card contents (read-side determinism):

| Test | What it pins |
|---|---|
| PASS — cards match registry | zero prunes |
| STALE — leftover card | unlinked |
| MULTI-FINGERPRINT — `[older, newer]` | newest wins, 1 card on disk |
| MULTI-FINGERPRINT — `[newer, older]` | newest wins regardless of input order |
| MIXED — 3 cards / 2 stale | exactly 1 remains |
| JSON-ONLY FILTER | non-`.json` files untouched |
| PATH-FLATTENING | `src/features/foo.js` → `src_features_foo.js.json` |
| NEW-OUTPUT-DIR | clean dir + 2 files → both cards |

No tests yet for `_cardFilename` in isolation. No tests for `emitCard` (single-card) directly. No tests for `diff()`.

## 7. Contracts

### Filename encoding (load-bearing for T5)
`_cardFilename(filepath)` at emitter.js:210-212:
```js
return filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json';
```
- POSIX `/` → `_`, Windows `\` → `_`.
- Trailing `.json`.
- **Inverse is lossy** — `src_features_foo.js.json` cannot be reliably reversed to a filepath because the source file might genuinely contain underscores. T5 must NOT derive filepath from the card filename; it must derive it from the `file_registry` row (keyed by fingerprint), then forward-encode to the card filename.
- Documented in `docs/components/identity-and-analysis.md` §4.

### Multi-fingerprint dedup
`emitAllCards` at emitter.js:118-131:
- Builds `Map<filepath, file>`.
- For each row, if `existing.birthTimestamp || ''` < `f.birthTimestamp || ''` (lex compare on ISO-8601), replace.
- **Newest birthTimestamp wins** — deterministic regardless of `getAllFiles()` iteration order. ISO-8601 lexicographic order is monotonic in time (the reviewer's note at identity-and-analysis.review.md:166 confirms this is intentional).
- Older identities persist in `file_registry` + `file_mutation_log` (history); only the on-disk card surfaces the **current** identity.

### 19-field card shape
See §2. `validateSt8SchemaCard` is non-strict — extra fields are tolerated. T5 reading a card can rely on all 19 keys being present (validation is at emit time, but a card on disk written by today's emitter has every field).

### Sorted-keys JSON write
`emitter.js:73-82` — a `JSON.stringify` replacer recursively re-sorts object keys at every level. **Diff-stable output** for git. T5 read path can `JSON.parse(...)` directly and trust the shape — no normalization needed for downstream comparison.

### Prune sweep
`emitter.js:188-199` — `readdirSync(outputDir)`, filter `endsWith('.json')`, unlink any whose filename is not in `validFilenames`. The valid set is computed from the **deduplicated** files map, so superseded fingerprints' cards get pruned in the same pass (they were never re-emitted). Sidecar files (`.txt`, `.lock`, `README.txt`) are filtered out.

## 8. Change vector for T5

### Read-path proposal (in `src/core/server/app.js`, NOT in emitter.js)
T5 endpoint: `GET /api/file-identity/<fingerprint>`. The card retrieval has four conceptual steps:

1. Given the fingerprint URL param, call `persistence.getFileByFingerprint(fingerprint)` (assumed extant; if not, parse via `parseFingerprint` in `st8-types.js` and `persistence.getFileByPath`). Get `file.filepath`.
2. Construct the card filename via the **same encoding as emitter.js:210-212**. Today the cleanest path is:
   ```js
   const { SchemaCardEmitter } = require('../../features/schema-cards/emitter');
   const emitter = new SchemaCardEmitter(this.targetDir);
   const cardPath = path.join(emitter.outputDir, emitter._cardFilename(file.filepath));
   ```
   — instantiates the emitter just to access the encoding helper. Cheap (no I/O beyond `_ensureOutputDir`).
3. `fs.readFileSync(cardPath, 'utf-8')` → `JSON.parse` → return as `card` field of the bundle.
4. If the card file is missing (newly-indexed file before the P=20 subscriber fires, or pruned multi-fingerprint loser), respond with `card: null` in the bundle and surface the absence to the consumer. **NO writes from T5.**

### Helper exposure recommendation
`_cardFilename` is informally private (underscore prefix) but is already called externally by `intent-seeder.js:601` (where it is **reimplemented** as a private method on `IntentSeeder` with identical body). This is duplication-by-copy, not import.

**Recommendation for T5 (advisory, no edits in this wave):**
- **Preferred:** expose a module-level `cardFilename(filepath)` function alongside the class export — `module.exports = { SchemaCardEmitter, cardFilename }` — and have both the class method and `intent-seeder.js` reuse it. T5 calls `cardFilename(file.filepath)` without constructing an emitter. Pure refactor, zero behavior change.
- **Acceptable for T5 in isolation:** instantiate a `SchemaCardEmitter` solely for `_cardFilename`. The constructor's only side-effect is `mkdirSync({recursive: true})` on `.st8/schema-cards/` — idempotent.
- **Avoid:** re-implementing the encoding inside `app.js`. That would be a third copy of a load-bearing convention.

Either way, **do not change the encoding** — it's a documented convention (CLAUDE.md, docs/components/identity-and-analysis.md §4) and dozens of cards on disk already use it.

## 9. Provisions already made

- The 19-field card shape is canonical (`St8SchemaCard` in `st8-types.js:89-129`) — T5 doesn't need to invent a card schema.
- Sorted-keys JSON output guarantees deterministic field ordering — T5 can trust the parse.
- Multi-fingerprint dedup means the on-disk card is the **current** identity for a filepath, which matches T5's "given a fingerprint, return that file's bundle" contract. Note: if a stale fingerprint is queried, the card on disk may belong to a **different** fingerprint (the newer one). T5 should compare the requested fingerprint to `card.fingerprint` and return `card: null` if they mismatch (or surface "superseded by fingerprint X").
- Prune sweep keeps `.st8/schema-cards/` honest — no orphan cards to mislead T5.
- Filename encoding (`/` and `\` → `_`) is single-source-of-truth at emitter.js:210-212, callable externally (informally private but accessible).

## 10. Gaps + open questions

1. **Stale-fingerprint query semantics.** If a caller asks for fingerprint `app.js||2020-01-01T...` but the current card on disk is `app.js||2027-01-01T...`, what does T5 return? Three options:
   - `card: null` + `superseded_by: <newer fingerprint>`.
   - The card on disk regardless (and let the consumer compare `card.fingerprint`).
   - 410 Gone for superseded identities.
   The reviewer notes (identity-and-analysis.review.md:67-70) flag this exact "historical multi-fingerprint stale rows" gap. T5 should pick a deterministic policy.

2. **`_cardFilename` exposure choice.** The roadmap (P1.3) doesn't prescribe whether to expose a public helper. Open question for the executor: take the small refactor (export `cardFilename` alongside the class), or live with the instantiate-just-for-helper pattern? See §8.

3. **Card missing for a registered file.** Between INDEX_START and the P=20 emitter subscriber firing, a `file_registry` row exists with no card on disk. T5's behavior in that gap should be specified. Most natural: return `card: null` + `mutations`/`intent`/`file` populated.

4. **`connections` field collision.** T5's bundle exposes a `connections` field reading the `connections` SQL table directly. The card ALSO carries `card.connections`. These should agree (they're derived from the same source) but consumers may compare. Decide whether the bundle's `connections` shadows `card.connections` or is rendered independently.

5. **Bundle response shape under a fingerprint with no `file_intent` / no mutations.** Trivial defaults (`intent: null`, `mutations: []`) suggested but worth pinning in T5's test fixtures.

6. **Identity-risk hook surface.** `/api/identity-risk` already exists (Wave 3C, `app.js:1582`). T5 may want to include an `identityRisk` field in the bundle by reading the same `.st8/identity-risk.json` file. Not in the P1.3 spec but a natural extension — open question for the founder.

7. **No test for `_cardFilename` in isolation.** A short unit-test pinning the encoding (POSIX, Windows, mixed, edge cases like leading `./`) would lock the contract that T5 depends on. Suggested as a follow-up ticket, not in T5 scope.

---

**End of research.** Read-only audit complete; no source files edited.
