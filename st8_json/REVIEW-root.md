# Schema Card Review — Root-Level Files

**Reviewed:** 2026-05-14
**Source:** `.st8/schema-cards/`
**Files Analyzed:** 3

---

## Summary Table

| File | Status | Exports | Imports (modules) | Connections | Has Intent | Notes |
|---|---|---|---|---|---|---|
| `start.js` | 🔴 RED | 0 | 4 (`path`, `fs`, `child_process`, `open`) | imports → `pathGenerator.js`; importedBy: none | Yes (partial) | Real file exists; schema card has ??? markers in intent |
| `test/newfile.js` | 🔴 RED | 0 | 0 | none | No | ⚠️ **PHANTOM** — source file does NOT exist |
| `void-engine.js` | 🔴 RED | 0 | 1 (`@chenglou/pretext@0.0.6`) | none | Yes (partial) | ⚠️ **MISSING** — source file not found at root |

---

## Detailed Analysis

### 1. `start.js`

**Summary:** Main entry-point script for ST8. Spawns the backend server, auto-installs npm dependencies if missing, and optionally opens the browser UI.

| Field | Value |
|---|---|
| **Exports** | 0 (none registered — functions `main`, `installDependencies`, `startBackend`, `openBrowser` are internal, no `module.exports`) |
| **Imports** | `path` (require), `fs` (require), `child_process` (require), `open` (require, dynamic inside `openBrowser()`) |
| **importedBy** | `[]` — no known callers in schema graph |
| **imports (connections)** | `lib/commands/integr8/pathGenerator.js` |
| **Purpose** | ST8 — Startup Script |
| **dependsOnBehavior** | File path manipulation, file system ops, child_process, open |
| **valueStatement** | Provides main, installDependencies, startBackend, openBrowser APIs |
| **Status** | 🔴 RED |
| **isEntryPoint** | `false` (note: schema says false, but the file IS `#!/usr/bin/env node` — likely should be `true`) |

**⚠️ Schema Issues:**
- All intent fields carry `???` suffix — intent inference was uncertain
- `isEntryPoint: false` contradicts the shebang line and `main().catch()` call pattern
- `connections.importedBy` is empty despite this being a launcher script
- `connections.imports` references `pathGenerator.js` but the actual code does NOT import it — stale/wrong edge

---

### 2. `test/newfile.js`

**Summary:** Orphan schema card — no corresponding source file exists in the repository. All fields are empty/default. Likely a test artifact or placeholder that was indexed but never materialized.

| Field | Value |
|---|---|
| **Exports** | 0 |
| **Imports** | 0 |
| **importedBy** | `[]` |
| **imports (connections)** | `[]` |
| **Purpose** | *(empty)* |
| **dependsOnBehavior** | *(empty)* |
| **valueStatement** | *(empty)* |
| **Status** | 🔴 RED |
| **isEntryPoint** | `false` |

**⚠️ Schema Issues:**
- **Source file does not exist** — `test/newfile.js` not found anywhere in repo
- `birthTimestamp: "2026-01-01"` — suspicious placeholder date (epoch-like)
- `sha256Hash: "abc123"` — fake hash, not a real SHA-256
- `lastMutation.actor` and `lastMutation.timestamp` are empty strings
- `mutationCount: 0` — never touched
- This card should be purged or the missing file should be created

---

### 3. `void-engine.js`

**Summary:** Rendering/layout engine that wraps `@chenglou/pretext` for text layout operations (line segmentation, layout, walking). Intended to power ST8's visual editor component.

| Field | Value |
|---|---|
| **Exports** | 0 (none registered — despite listing APIs: `carveTextLineSlots`, `circleIntervalForBand`, `of`, `participant`, `createRectEl`, `syncPool`, `layoutColumn`, `hitTestRects`, `animate`) |
| **Imports** | `@chenglou/pretext@0.0.6` (ESM named import: `prepareWithSegments`, `layoutWithLines`, `layoutNextLine`, `walkLineRanges`) |
| **importedBy** | `[]` — no known callers |
| **imports (connections)** | `[]` |
| **Purpose** | Rendering engine — "the-editorial-engine.ts" |
| **dependsOnBehavior** | pretext@0.0.6 |
| **valueStatement** | Provides carveTextLineSlots, circleIntervalForBand, of, participant, createRectEl, syncPool, layoutColumn, hitTestRects, animate APIs |
| **Status** | 🔴 RED |
| **isEntryPoint** | `false` |

**⚠️ Schema Issues:**
- **Source file not found** at `void-engine.js` in repo root — only a review report exists at `.planning/st8_identity_system/Gsd-Codebase-Reviewer - Reports/void-engine.js_for_json_transform.md`
- All intent fields carry `???` suffix — uncertain inference
- `fileSizeBytes: 22296` — a 22KB file that doesn't exist suggests it was deleted/moved after indexing
- 9 APIs listed in `valueStatement` but `exports: []` — contradiction (either exports weren't captured or APIs are internal)
- Uses ESM (`import ... from`) via `esm.sh` CDN — unusual for a Node project; likely browser-side code
- `importedBy` is empty — dead code or not yet wired up

---

## Cross-Cutting Findings

### 🔴 F-01: Two of three schema cards reference non-existent files
- `test/newfile.js` — file never existed (fake hash, placeholder dates)
- `void-engine.js` — file was likely deleted or moved after indexing

**Impact:** Schema graph has phantom nodes. Any tooling relying on these cards for dependency analysis, impact radius, or reachability will produce incorrect results.

**Fix:** Run a validation pass against the schema-cards directory: for each `.json` card, verify `filepath` resolves to an actual file. Remove or archive orphan cards.

### 🟡 F-02: All three cards have `exports: []`
Even `start.js` (148 lines, 4 functions) and `void-engine.js` (22KB, 9 listed APIs) register zero exports. The indexer either doesn't capture non-exported internal functions or is misconfigured for CommonJS/ESM detection.

### 🟡 F-03: All three cards are RED with no path to GREEN
No card documents what "GREEN" would require. No verification steps, no UAT criteria, no acceptance gates. The status field is set but not actionable.

### 🟡 F-04: `start.js` schema has stale connection edge
`connections.imports` points to `lib/commands/integr8/pathGenerator.js` but the actual `start.js` code never imports or requires it. The edge is incorrect.

---

## Recommendations

1. **Purge orphan cards** — Delete `test_newfile.js.json` or create the missing source file
2. **Re-index `void-engine.js`** — Locate the actual file (may be in a different directory) or remove the card
3. **Fix export detection** — Ensure the indexer captures `module.exports` and function declarations
4. **Fix `isEntryPoint`** for `start.js` — The shebang + `main()` pattern makes it an entry point
5. **Remove stale edge** — `start.js` → `pathGenerator.js` connection is false
6. **Add GREEN criteria** — Each card should document what conditions move it from RED → YELLOW → GREEN

---

_Reviewed: 2026-05-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
