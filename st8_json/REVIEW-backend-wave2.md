# Backend Wave 2 — Schema Card Review

**Reviewed:** 2026-05-14
**Files:** 5 schema cards from `.st8/schema-cards/`

---

## File Summaries

| # | File | Summary | Status |
|---|------|---------|--------|
| 1 | `backend_fileWatcher.js.json` | Monitors the filesystem for changes using `fs` and `path`. Exports a `FileWatcher` variable used by `backend/index.js`. | 🔴 RED |
| 2 | `backend_gapAnalyzer.js.json` | Analyzes gaps (likely coverage or schema gaps) using `fs` and `path`. Exports `GapAnalyzer`, consumed by both `backend/index.js` and `backend/server.js`. | 🔴 RED |
| 3 | `backend_intentSeeder.js.json` | Seeds intent data into the system using `fs`, `path`, and `module`. Exports `IntentSeeder`. **Not imported by any module** — orphaned or not yet wired. | 🔴 RED |
| 4 | `backend_manifestGenerator.js.json` | Generates manifests and connection state TOML. Exports 3 functions: `generateConnectionState`, `generateAiSignalToml`, `writeManifests`. Used by `backend/index.js` and `backend/server.js`. | 🔴 RED |
| 5 | `backend_notificationBus.js.json` | Event-based notification system built on Node `events`. Exports both `NotificationBus` (class) and `notificationBus` (singleton instance). Used by `backend/index.js` and `backend/server.js`. | 🔴 RED |

---

## Exports

| File | Export Name | Kind | Line | Visibility |
|------|------------|------|------|------------|
| `fileWatcher.js` | `FileWatcher` | variable | 137 | named |
| `gapAnalyzer.js` | `GapAnalyzer` | variable | 651 | named |
| `intentSeeder.js` | `IntentSeeder` | variable | 485 | named |
| `manifestGenerator.js` | `generateConnectionState` | variable | 168 | named |
| `manifestGenerator.js` | `generateAiSignalToml` | variable | 168 | named |
| `manifestGenerator.js` | `writeManifests` | variable | 168 | named |
| `notificationBus.js` | `NotificationBus` | variable | 125 | named |
| `notificationBus.js` | `notificationBus` | variable | 125 | named |

---

## Imports (Source Modules)

| File | Import Type | Source |
|------|------------|--------|
| `fileWatcher.js` | require | `path` |
| `fileWatcher.js` | require | `fs` |
| `gapAnalyzer.js` | require | `fs` |
| `gapAnalyzer.js` | require | `path` |
| `intentSeeder.js` | require | `path` |
| `intentSeeder.js` | require | `fs` |
| `intentSeeder.js` | require | `module` |
| `manifestGenerator.js` | require | `path` |
| `manifestGenerator.js` | require | `fs` |
| `notificationBus.js` | require | `events` |

---

## Connections (Dependency Graph)

```
backend/index.js ──┬──► fileWatcher.js
                   ├──► gapAnalyzer.js
                   ├──► manifestGenerator.js
                   └──► notificationBus.js

backend/server.js ─┬──► gapAnalyzer.js
                   ├──► manifestGenerator.js
                   └──► notificationBus.js

intentSeeder.js ─────── (orphan — no importers)

fileWatcher.js ────────► pathGenerator.js
gapAnalyzer.js ────────► pathGenerator.js
intentSeeder.js ───────► pathGenerator.js
manifestGenerator.js ──► pathGenerator.js
notificationBus.js ────► (none — leaf node)
```

---

## Intent

| File | Purpose | dependsOnBehavior | valueStatement |
|------|---------|-------------------|----------------|
| `fileWatcher.js` | File system change monitoring | file path manipulation, file system operations | Provides file change monitoring |
| `gapAnalyzer.js` | Gap analysis | file system operations, file path manipulation | Provides GapAnalyzer API |
| `intentSeeder.js` | Data seeding | file path manipulation, file system operations, module | Provides IntentSeeder API |
| `manifestGenerator.js` | Code or data generation | file path manipulation, file system operations | Provides `generateConnectionState`, `generateAiSignalToml`, `writeManifests` APIs |
| `notificationBus.js` | Event notification system | events | Provides `NotificationBus` class and `notificationBus` singleton |

> **Note:** All intent fields end with `???` — the indexer flagged uncertainty. Intent metadata should be refined once module behavior is confirmed.

---

## Observations

1. **All 5 modules are RED status.** This likely reflects lifecycle/development stage, not defects.
2. **`intentSeeder.js` is orphaned** — `importedBy` is empty. Either it's not yet integrated or it's dead code.
3. **All 4 non-orphan modules share the same two consumers:** `backend/index.js` and `backend/server.js` (except `fileWatcher.js`, only imported by `index.js`).
4. **All modules depend on `pathGenerator.js`** (via `lib/commands/integr8/pathGenerator.js`), except `notificationBus.js` which is a pure `events`-based leaf.
5. **All exports are `variable` kind at `named` visibility** — consistent pattern across the codebase.
6. **`manifestGenerator.js` exports 3 functions from the same line (168)** — likely a destructured export or object literal.
7. **`notificationBus.js` exports both a class and instance** — the lowercase `notificationBus` is presumably the singleton.
8. **Intent metadata is universally placeholder** (`???` suffix) — all 5 cards need intent refinement pass.
