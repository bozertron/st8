# Schema Card Review — Frontend Wave 2

**Reviewed:** 2026-05-14
**Files:** 3 schema cards from `.st8/schema-cards/`

---

## Exports

| File | Export Name | Kind | Line | Visibility |
|---|---|---|---|---|
| settings-reader.js | `SettingsReader` | class | 47 | named |
| settings-reader.js | `LocalStorageAdapter` | variable | 113 | named |
| settings-reader.js | `MemoryAdapter` | variable | 113 | named |
| settings-ui.js | *(none)* | — | — | — |
| fake-stream.js | `FakeStream` | class | 41 | named |

---

## Imports

| File | Imports (source modules) |
|---|---|
| settings-reader.js | *None* |
| settings-ui.js | *None* |
| fake-stream.js | *None* |

---

## Connections (Dependency Graph)

| File | importedBy | imports |
|---|---|---|
| settings-reader.js | *(none recorded)* | *(none recorded)* |
| settings-ui.js | *(none recorded)* | *(none recorded)* |
| fake-stream.js | *(none recorded)* | *(none recorded)* |

> All three cards show empty `importedBy` and `imports` arrays and `reachabilityScore: 0` / `impactRadius: 0`. This means the indexer has not yet resolved inter-module wiring. The connections data is incomplete — not necessarily that these files are truly standalone.

---

## Intent

| File | Purpose | dependsOnBehavior | valueStatement |
|---|---|---|---|
| settings-reader.js | Settings management — vendor/settings-reader.js | No external dependencies | Provides `LocalStorageAdapter` API, `MemoryAdapter` API, `SettingsReader` API |
| settings-ui.js | Settings management — list of entries (e.g., sirkits, models) | No external dependencies | Provides `renderSettingsPanel`, `renderCategoryEntries`, `selectCategory`, `updateValue`, `_persistSetting`, `loadSettings`, `addEntry`, `editEntry`, `duplicateEntry`, `showSettingsPopup`, `showSettingsInExplorer` APIs |
| fake-stream.js | Stream mocking utility — vendor/fake-stream.js | No external dependencies | Provides `FakeStream` API |

> Note: The `???` markers on every intent field indicate the indexer flagged these as low-confidence guesses. Treat intent descriptions as provisional.

---

## Status

| File | Status | Last Modified | Last Indexed | Mutation Count |
|---|---|---|---|---|
| settings-reader.js | **RED** | 2026-05-11 | 2026-05-13 | 4 |
| settings-ui.js | **RED** | 2026-05-13 | 2026-05-13 | 4 |
| fake-stream.js | **RED** | 2026-05-11 | 2026-05-13 | 4 |

All three cards are **RED** — connections unresolved, intent low-confidence.

---

## Summary

| File | Summary |
|---|---|
| settings-reader.js | A standalone settings persistence layer exporting a `SettingsReader` class with two storage backends: `LocalStorageAdapter` (browser storage) and `MemoryAdapter` (in-memory fallback). 3.5 KB. |
| settings-ui.js | The largest of the three (15 KB) — a UI controller for a settings panel with 11 public/private methods covering rendering, CRUD operations on entries (sirkits, models), persistence, and explorer integration. Exports nothing (likely side-effect module or uses global registration). |
| fake-stream.js | A test/utility module exporting a single `FakeStream` class for mocking stream behavior. 3.4 KB. |

---

## Observations

1. **settings-ui.js exports nothing** — The intent lists 11 API methods but the exports array is empty. Either these are attached to a global/namespace, the module uses a default export the indexer didn't capture, or the file is incomplete. This is a **RED flag** worth investigating.

2. **All connection data is empty** — Zero imports, zero importedBy, zero reachability. Either these files are truly orphaned (not wired into the app), or the indexer hasn't completed a full dependency pass. If these are actively used, the connection graph needs a rescan.

3. **settings-reader.js line 113 exports two items on the same line** — `LocalStorageAdapter` and `MemoryAdapter` both report line 113. This is valid (destructuring or comma-separated export) but worth verifying the actual source to confirm both are properly exported.

4. **Intent fields universally marked `???`** — The indexer's confidence is low on all purpose/dependsOnBehavior/valueStatement fields. Manual intent annotation would improve card quality.

---

_Reviewed: 2026-05-14_
_Source: .st8/schema-cards/*.json_
