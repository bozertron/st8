# `src/shared/types/` — Research Report (data-unblock pass 2)

**Date:** 2026-05-17
**Scope:** read-only audit of `/home/user/st8/src/shared/types/`
**Frame:** the type-failure pattern (TS enum stripped at compile, SQLite `TEXT NOT NULL` accepts anything, producers emit off-spec values) is *literally* about this dir.

---

## 1. Directory inventory

| File | LOC | Origin | Authority |
|---|---:|---|---|
| `st8-types.js` | 290 | hand-written JS, canonical | THE source of truth for st8 data shapes (per file header) |
| `integr8-types.js` | 82 | TS-compiled (note `__esModule`, `Object.defineProperty`, `sourceMappingURL`) | Vendored from `src/commands/integr8/types.ts` upstream; do **not** hand-edit (mirrors batch-030 rule for `insight-store.js`) |

`st8-types.js` is plain CommonJS, freezes everything, and ships with a CLI self-test (`node st8-types.js --validate`). `integr8-types.js` is a single block of IIFE-wrapped enum assignments — all interfaces/types from the TS source were already stripped before this file landed in `src/`.

---

## 2. Canonical enums + interfaces — by-name table

### From `st8-types.js`

| Name | Kind | Declared lines | Live refs (outside dir) | Runtime enforcement |
|---|---|---|---|---|
| `LifecyclePhase` | frozen enum (5 vals) | 15–21 | imported in `persistence.js:16` (not used at call sites) | **YES** — `file_registry.lifecyclePhase` has `CHECK (lifecyclePhase IN (...))` (persistence.js:75). Only enum with a SQL CHECK. |
| `FileStatus` | frozen enum (6 vals) | 25–32 | imported in `persistence.js:16` (not referenced); literal `'GREEN'/'YELLOW'/'RED'` used in indexer.js, frontend (~10 sites) | **NO** — `file_registry.status TEXT DEFAULT 'RED'`, no CHECK. Indexer emits strings directly; classifier maps `health → status` with literal strings. |
| `MutationType` | frozen enum (9 vals) | 36–46 | `main.js` lines 91,142,168,324,394 (`MutationType.CREATE`, `EDIT`); literal strings elsewhere | **NO** — `file_mutation_log.mutationType TEXT NOT NULL`, no CHECK. |
| `ActorType` | frozen enum (4 vals) | 50–55 | `main.js` (4 uses: `ActorType.WATCHER`, `INDEXER`) | **NO** — `file_mutation_log.actor TEXT DEFAULT 'DEVELOPER'`, no CHECK; `activity_log.source TEXT DEFAULT 'INDEXER'`, no CHECK. |
| `St8FileEntry` | shape (13 fields) | 61–75 | imported in `persistence.js:16` (not used at call sites); referenced doc-only in `emitter.js:33`, `birth-timestamp.js:11` | **NO** — `validateSt8FileEntry` is exported but never called outside the in-file self-test. |
| `St8SchemaCard` | shape (~22 fields) | 89–129 | **USED** in `emitter.js:15,66,227` (real call to `validateSt8SchemaCard`) | **PARTIAL** — emitter calls validator on every card; on failure it only `console.warn`s (does not throw). Tier-1 schema-contracts test (`tests/scripts/signal-tests/tier-1-schema-contracts.test.js`) pins the shape. |
| `St8MutationRecord` | shape (7 fields) | 133–141 | none outside dir | **NO** — validator exists but no caller. |
| `generateFingerprint` / `parseFingerprint` | fn | 207–244 | 8 ref sites across `src/` and tests (incl. `main.js`, `indexer.js`, `persistence.js`) | LIVE — the `||` separator + legacy `:` fallback is the only invariant carried by code, not data. |
| `validateAgainstShape` / `validateSt8FileEntry` / `validateSt8MutationRecord` | fn | 149–184 | none outside dir + self-test | **DORMANT** — only `validateSt8SchemaCard` has a live caller. |

### From `integr8-types.js`

| Name | Vals | Live consumers | Notes |
|---|---|---|---|
| `IntegrationOutcome` | 5 | `report-generator.js` (switch on SUCCESS/PARTIAL/FAILURE/AMBIGUOUS/REDIRECT) | live |
| `DependencyStatus` | 4 | `signal-path-adapter.js:108` (`DependencyStatus.SAFE` constant) | live but only `SAFE` is ever assigned |
| `NodeType` | 10 | `graph/builder.js`, `data-ingestion.js`, `sonic-indexer.js` | live; **the de-facto vocabulary for the graph layer** |
| `EdgeType` | 12 | `graph/builder.js`, `sonic-indexer.js`, `signal-path-adapter.js` | live |
| `MigrationAction` | 6 | `migration-executor.js` switch + `report-generator.js` formatter | live |
| `ConflictType` | 6 | `relationship-analyzer.js` (5 emit sites), `report-generator.js`, `toml-serializer.js:390` does an `Object.values(ConflictType).includes(typeRaw)` — the **only place in either file where the enum gates a value at runtime** | live + ONE real gate |
| `ResolutionStrategy` | 5 | `report-generator.js` formatter only | live, surface-only |
| `VerificationLevel` | 4 | `migration-executor.js` (~14 sites) | live, only `SYNTAX/IMPORT_RESOLUTION/TYPE_CHECK/SEMANTIC` are ever emitted |

**Key finding:** of the 8 integr8 enums, `ConflictType` is the one true runtime gate (`toml-serializer.js:390` validates `typeRaw` membership before accepting). Every other enum is *referenced* but never *enforced* — code reads its own enum back, which is a tautology, not a contract.

---

## 3. The InsightRecord shape — declared vs emitted

### Declared (`docs/Insight Store/insightStore.ts:28-41`)

```
InsightRecord {
  insightId: string;       // assigned by addInsight (crypto.randomUUID)
  projectId: string;
  fileId: string;
  filePath: string;
  passNumber: number;
  category: InsightCategory;       // ← the 13-value enum
  severity: InsightSeverity;       // 'info'|'low'|'medium'|'high'|'critical'
  description: string;
  evidence: string;
  relatedNodeIds: string[];
  context: Record<string, any>;
  timestamp: string;       // assigned by addInsight
}
```

### Canonical `InsightCategory` (13)

`structural, dependency, complexity, pattern, security, performance, unused_export, circular_dependency, anti_pattern, type_issue, api_surface, test_coverage, documentation`

### Emitted by `cycle-insight-emitter.js:78-89` (canonical producer pattern)

| Field | Value | Match? |
|---|---|---|
| `projectId` | `'st8'` | yes |
| `fileId` | from `store.ensureFileSlot` | yes |
| `filePath` | `files[0]` | yes |
| `passNumber` | `2` | yes |
| `category` | `'circular_dependency'` | **YES — in the 13** |
| `severity` | `'high'` | yes |
| `description` | string | yes |
| `evidence` | string (arrow chain) | yes |
| `relatedNodeIds` | array of strings | yes |
| `context` | `{participants, length}` | yes |

→ Exact match. This is the template.

### Emitted by `insight-store-populator.js:108-150` (off-spec producer)

| `category` value | In canonical 13? |
|---|---|
| `'orphan'` | NO |
| `'red-status'` | NO |
| `'under-connected'` | NO |
| `'under-imported'` | NO |
| `'high-impact'` | NO |

All five categories are invented. Worse: populator uses `severity: SEVERITY.ERROR/WARNING/INFO` with `SEVERITY = {ERROR:'error', WARNING:'warning', INFO:'info'}` (line 41). `'error'` and `'warning'` are NOT in the canonical `InsightSeverity` union (`'info'|'low'|'medium'|'high'|'critical'`). So even severity is off-spec.

That's two off-spec axes per row × 300 rows in `scaffolder_data.sqlite` (per bible batch 030).

---

## 4. Runtime-enforcement gaps

Per-enum, what a gate would look like and where it would live.

| Enum | Gap | Suggested gate (LOC) | Location |
|---|---|---|---|
| `FileStatus` | persistence accepts any string | `assertFileStatus(s)` throws on unknown; called in `persistence.upsertFile` / indexer's `upsertFiles` payload; also add SQL `CHECK (status IN (...))` to `file_registry` schema | `src/shared/utils/validate-enum.js` (new, ~30 LOC) + `persistence.js` (+2 LOC) + `ST8_SCHEMA` (+1 LOC) |
| `MutationType` | `logMutation` accepts anything | `assertMutationType(t)` in shared/utils; called in `persistence.logMutation`; SQL CHECK on `file_mutation_log.mutationType` | shared/utils + persistence (+1 LOC) |
| `ActorType` | `logMutation` / `logActivity` accept anything | `assertActorType(a)` for both `actor` and `source` columns | shared/utils + persistence (+2 LOC) |
| `LifecyclePhase` | SQL CHECK present but no JS-side message; any drift surfaces as opaque `SQLITE_CONSTRAINT` | `assertLifecyclePhase(p)` thin wrapper that yields a useful `[st8:types] unknown lifecyclePhase: <x>` error before the DB call | shared/utils + persistence (+1 LOC) |
| `InsightCategory` | no enforcement; populator drifted | The canonical 13 are defined in TS only. Re-declare them as a frozen array in `st8-types.js` (or new `shared/types/insight-types.js`); add `assertInsightCategory(c)`; wrap `InsightStore.addInsight` / `addInsightsBatch` to validate at the JS boundary. SQL CHECK on `InsightRecords.category` (would require introspectSchema parity) | New `src/shared/types/insight-types.js` (~40 LOC) + monkey-wrap in `src/features/analysis/insight-store.js` shim (~10 LOC) |
| `InsightSeverity` | same; populator emits `'error'`/`'warning'` | declare as frozen array; `assertInsightSeverity(s)` | same file |
| `ConflictType` | already gated in `toml-serializer.js:390` (the pattern!) | extend to relationship-analyzer.js emit sites | (existing pattern, port outward) |
| `NodeType`/`EdgeType` | producers and consumers agree because they import the same enum; no gate at the DB layer though | `assertNodeType`/`assertEdgeType` at `data-ingestion` write boundary if/when graph nodes/edges land in SQLite | future |

**Shape for `validate-enum.js`:**

```js
function makeAsserter(name, enumObj) {
  const set = new Set(Object.values(enumObj));
  return (v) => {
    if (!set.has(v)) throw new TypeError(`[st8:types] ${name}: unknown value ${JSON.stringify(v)}; expected one of ${[...set].join('|')}`);
    return v;
  };
}
```

One module, eight asserters, ~30 LOC. The `validateAgainstShape` helper already in `st8-types.js` covers *shape*; this covers *enum values*. They compose.

---

## 5. Drift / silent-divergence candidates

1. **Schema vs canonical enum** — `ST8_SCHEMA` declares `status TEXT DEFAULT 'RED'` and `mutationType TEXT NOT NULL` with no CHECK; canonical `FileStatus`/`MutationType` enums exist but aren't bound to the column. `lifecyclePhase` is the **only** column with both. This is exactly the type-failure pattern described in the bible.
2. **`St8FileEntry` shape ≠ `file_registry` columns** — the table has at least 8 extra columns (`lastAccessed`, `sessionsSinceAccess`, `expiryDate`, `associatedWith`, `eventTrigger`, `brunoStatus`, `needsAIReview`, `tripleAtCount`, `aiContentInjected`, `templateVariables`, `hasUnfilledVariables`) that the canonical shape never mentions. If `validateSt8FileEntry(row, strict=true)` were ever called on a row, every row would fail with `extra: [...]`. Today no caller exists, so the drift is invisible.
3. **`SEVERITY` constant in populator** — `{ERROR:'error', WARNING:'warning', INFO:'info'}` shadows canonical `InsightSeverity` (`info|low|medium|high|critical`). `'info'` is the only overlap.
4. **`integr8-types.js` types are gone** — the TS source has interfaces (`Node`, `Edge`, `Conflict`, `MigrationStep`, etc.) but the compiled JS only ships the enums. Any place a function signature said "expects a `Conflict`" is now a `{}` shape contract. Recovery: regenerate from `src/commands/integr8/types.ts` (if it still exists upstream) and ship type comments in the JS — or, more honestly, declare the missing shapes in a JS-friendly form alongside.
5. **Fingerprint legacy parsing** — `parseFingerprint` warns in its own docstring that ISO-8601 birthTimestamps under the old `:` separator are unrecoverable. No runtime gate flags such rows in `file_registry.fingerprint`.
6. **Two `ST8_SCHEMA` constants** — both `indexer.js:79` and `persistence.js:65` define a `ST8_SCHEMA` block. They overlap (file_registry, connections, file_intent, file_mutation_log, activity_log, st8_settings) but persistence.js has more tables (prd_projects, ai_content, tickets, providers). If both run, the indexer's version of `file_registry` lacks the lifecyclePhase CHECK. Need to confirm which one wins at boot — the bigger refactor concern.

---

## 6. Dead types vs live-but-unenforced

| Class | Type/fn | Evidence |
|---|---|---|
| **Live + enforced** | `LifecyclePhase` (SQL CHECK), `St8SchemaCard` (emitter validates), `generateFingerprint`/`parseFingerprint`, `ConflictType` (toml-serializer gates) | — |
| **Live + unenforced (the type-failure pattern)** | `FileStatus`, `MutationType`, `ActorType`, `IntegrationOutcome`, `DependencyStatus`, `NodeType`, `EdgeType`, `MigrationAction`, `ResolutionStrategy`, `VerificationLevel` | producer reads its own enum back; no gate at consumer/storage boundary |
| **Imported but unused** | `St8FileEntry`, `FileStatus`, `LifecyclePhase` in `persistence.js:16` — imported, never referenced in the file | `grep -c` returned 1 (the import line) |
| **Validators with no callers** | `validateSt8FileEntry`, `validateSt8MutationRecord`, `validateAgainstShape` (callable only via `validateSt8SchemaCard`) | grep across `src/` + `tests/` |
| **Almost-dead saved by corpus** | `St8MutationRecord` — no live caller, but its shape mirrors `file_mutation_log` columns and `main.js` emits objects matching that shape positionally (without import). The shape is documentary. | `main.js` lines 142-170 build literal objects with the same field names. |
| **Truly dead (so far)** | None confirmed. Even seemingly-unused integr8 enums (`IntegrationOutcome`, `ResolutionStrategy`) are referenced by `report-generator.js`. | — |

**"I almost called this dead but corpus said otherwise":**
- `St8MutationRecord` (no JS imports anywhere) is in fact the documentary contract for what `main.js`'s `persistence.logMutation()` calls build. It functions as a comment that happens to be runnable.
- `St8FileEntry` looks dead (imported, never referenced) but is the shape echoed throughout `persistence.upsertFile`/`indexer.upsertFiles` payloads. Removing the import is fine; removing the constant would silently de-document the data layer.
- `validateAgainstShape(strict=true)` is exported but never called with `strict=true`. Looks dead; corpus says it's a tier-1 contract test's tool.

---

## 7. TOP 3 QUICK WINS

Ranked by (impact × confidence) / effort.

### Win 1 — `validate-enum.js` + bind `FileStatus`/`MutationType`/`ActorType` at write boundaries

**Change:** New `src/shared/utils/validate-enum.js` (~30 LOC) with `makeAsserter` factory + pre-built `assertFileStatus`/`assertMutationType`/`assertActorType`/`assertLifecyclePhase`. Wire calls into `persistence.upsertFile` (status), `persistence.logMutation` (mutationType, actor), `persistence.logActivity` (source).
**Data integrity locked down:** every write path that touches the three biggest enum columns throws on off-spec values BEFORE SQLite stores them. Catches future producers drifting the way the populator did.
**Estimated LOC delta:** +35 new, +5 in persistence.js. ~6 tests in `tests/shared/utils/validate-enum.test.js`.
**Risk:** existing rows may already contain off-spec values; the gate only catches NEW writes. Sweeping legacy rows is a separate ticket.

### Win 2 — declare canonical InsightCategory + InsightSeverity in JS; gate `addInsightsBatch`

**Change:** New `src/shared/types/insight-types.js` exporting `InsightCategory` (frozen array of the 13), `InsightSeverity` (frozen array of the 5), plus asserters. Patch the JS shim around the vendored `insight-store.js` (or wrap `addInsight`/`addInsightsBatch` in a thin adapter at `src/features/analysis/insight-store.js`) so every insight write asserts both fields. Populator and emitter call through the gate.
**Data integrity locked down:** kills the populator's 5 ad-hoc categories + off-spec `'error'`/`'warning'` severities at the boundary. Forces the founder-call from batch 031 (whether to retire the ad-hoc taxonomy) to be made explicitly — either map them to canonical names or fail loud.
**Estimated LOC delta:** +50 (types file), +10 (adapter wrap), 0 LOC of upstream-TS edits (per batch-030 prohibition).
**Risk:** populator will throw on its current emissions; need to translate the 5 ad-hoc → 5 canonical (e.g., `orphan`→`unused_export`, `red-status`→`anti_pattern`, `high-impact`→`api_surface`) in the same patch, or feature-flag the gate.

### Win 3 — escalate `emitter.js`'s `validateSt8SchemaCard` console.warn to a metric (and `strict=true` in tests)

**Change:** `emitter.js:67` currently logs `console.warn` and continues — silent in production. Track the count via the existing notification bus (or write to `.st8/schema-card-violations.json`); flip the test harness's emitter invocation to `validateAgainstShape(card, St8SchemaCard, true)` so any extra/missing field fails the build.
**Data integrity locked down:** schema-card drift becomes loud (in tests) without breaking prod, and observable in prod via the existing telemetry seams. Tier-1 schema-contracts test already pins the shape; this closes the producer-side gap.
**Estimated LOC delta:** ~+15 emitter.js, +5 in the schema-cards test.
**Risk:** minimal. Validator already exists, return value already inspected.

---

## 8. Cross-directory dependencies

`src/shared/types/` is consumed by 16 distinct call sites:

- `src/core/server/main.js` — `generateFingerprint`, `MutationType`, `ActorType`
- `src/core/database/persistence.js` — imports `St8FileEntry`, `LifecyclePhase`, `FileStatus` (unused); `generateFingerprint` lazily-required at line 1065
- `src/features/indexing/indexer.js` — `generateFingerprint`
- `src/features/indexing/background-indexer.js` — `integr8-types`
- `src/features/indexing/data-ingestion.js` — `integr8-types` (NodeType, EdgeType heavy)
- `src/features/schema-cards/emitter.js` — `validateSt8SchemaCard`, `St8SchemaCard` (THE live validator caller)
- `src/features/schema-cards/printer.js` / `manifest-generator.js` — doc references only
- `src/features/graph/builder.js` — `integr8-types` (NodeType, EdgeType)
- `src/features/analysis/path-generator.js` — `integr8-types`
- `src/features/analysis/signal-path-adapter.js` — `integr8-types` (NodeType, EdgeType, DependencyStatus)
- `src/features/analysis/relationship-analyzer.js` — `integr8-types` (ConflictType emit, 5 sites)
- `src/features/analysis/report-generator.js` — `integr8-types` (IntegrationOutcome, ConflictType, ResolutionStrategy, MigrationAction formatters)
- `src/features/analysis/insight-store-populator.js` — does NOT import either types file (smoking gun)
- `src/features/analysis/cycle-insight-emitter.js` — does NOT import either types file (uses literal string but it happens to be canonical)
- `src/features/integr8/migration-executor.js` — `integr8-types` (MigrationAction, VerificationLevel)
- `src/features/integr8/toml-serializer.js` — `integr8-types`; **only file that performs `Object.values(Enum).includes(x)` at runtime — the pattern to copy**
- `src/features/search/sonic-indexer.js` — `integr8-types`
- `src/shared/utils/birth-timestamp.js` — doc reference to `St8FileEntry`
- `tests/scripts/signal-tests/tier-1-schema-contracts.test.js` — direct require of `st8-types.js`, pins `St8SchemaCard` keys

Note: `insight-store-populator.js` and `cycle-insight-emitter.js` — the two producers of insight categories — **import neither shared/types/ nor insight-types** (because the latter doesn't exist yet). This is exactly the surface area Win 2 closes.

---

## 9. Gaps + open questions

1. **Are there pre-existing rows in `scaffolder_data.sqlite` with off-spec categories that survive a Win-2 gate?** Bible says ~300 rows; whether to migrate or purge is a founder call.
2. **Two `ST8_SCHEMA` declarations (indexer.js vs persistence.js) — which one runs?** If both execute against the same DB (different boot paths), the schema is whichever ran first because of `IF NOT EXISTS`. Worth a short test to confirm.
3. **`insightStore.ts` defines tables (`FileInsightSlots`, `InsightRecords`) that aren't in `EXPECTED_SCHEMA`** in persistence.js — drift detector doesn't cover them. Adding a CHECK on `InsightRecords.category` requires extending the drift detector.
4. **`integr8-types.js` lost all of its interface declarations during TS→JS compile.** Is the upstream `src/commands/integr8/types.ts` still extant and can we regenerate, OR do we hand-write companion `Shape` constants the way `st8-types.js` does for `St8FileEntry`?
5. **Should canonical-emitter pattern be codified as a one-liner template?** Right now `cycle-insight-emitter.js` is the example by inspection; a `docs/recipes/canonical-emitter.md` referencing it would let the next 12 InsightCategory producers land without re-discovering the pattern.
6. **`validateAgainstShape` with `strict=true` — does any test invoke it?** Grep says no. Setting this in tier-1 contract tests would catch field-drift between code and shape.
7. **`status === 'PRODUCTION'` and `status === 'CONCEPT'/'LOCKED'`** — the `FileStatus` enum declares 6 values, but every literal-string usage in indexer/frontend handles only the original 3 (`GREEN`/`YELLOW`/`RED`). Are the lifecycle-derived states (`CONCEPT`, `LOCKED`, `PRODUCTION`) ever set on `status`, or did the enum get over-engineered? If the latter, the `FileStatus` enum should be split from `LifecyclePhase`.
