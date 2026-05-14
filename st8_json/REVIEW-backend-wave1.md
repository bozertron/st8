# Backend Wave 1 — Schema Card Review

**Reviewed:** 2026-05-14
**Source:** `.st8/schema-cards/` (5 files)
**Status:** All 5 cards report `status: RED`

---

## 1. Summary Table

| # | File | Status | Size | Exports | Imports (unique) | ImportedBy | Summary |
|---|------|--------|------|---------|-------------------|------------|---------|
| 1 | `backend_index.js` | 🔴 RED | 16.8 KB | 0 | 11 modules | 0 (entry) | Main backend entry point that bootstraps all subsystems (indexer, persistence, server, fileWatcher, etc.). No exports — side-effect-only require chain. |
| 2 | `backend_indexer.js` | 🔴 RED | 17.7 KB | 7 | 4 modules | 2 (`index.js`, `server.js`) | Codebase indexing pipeline — file discovery, hashing, import parsing, graph building, and manifest generation/write. |
| 3 | `backend_persistence.js` | 🔴 RED | 19.3 KB | 1 | 4 modules | 4 (`index.js`, `server.js`, `schemaCardEmitter.js`, `verify-persistence-fixes.js`) | SQLite persistence layer (via `better-sqlite3`) providing CRUD operations for the file registry. Exports `St8Persistence` class/object. |
| 4 | `backend_server.js` | 🔴 RED | 42.0 KB | 1 | 8 modules | 1 (`index.js`) | HTTP server (`http` module) exposing ST8 backend API routes. Orchestrates indexer, persistence, notificationBus, schemaCardEmitter, prdGenerator, gapAnalyzer. Largest module. |
| 5 | `backend_st8-types.js` | 🔴 RED | 11.1 KB | 13 | 0 modules | 10 modules | Canonical type definitions, enums, validation functions, and fingerprint utilities. Zero external dependencies. Most widely imported module in the backend. |

---

## 2. Exports Detail

### `backend_index.js`
| Name | Kind | Line | Notes |
|------|------|------|-------|
| *(none)* | — | — | No exports. Side-effect entry point only. |

### `backend_indexer.js`
| Name | Kind | Line | Notes |
|------|------|------|-------|
| `indexDirectory` | variable | 474 | Core indexing function |
| `discoverFiles` | variable | 474 | File discovery API |
| `hashFile` | variable | 474 | Single-file hash API |
| `parseImports` | variable | 474 | Import statement parser |
| `buildGraph` | variable | 474 | Dependency graph builder |
| `generateManifest` | variable | 474 | Manifest generation |
| `writeManifest` | variable | 474 | Manifest file writer |

### `backend_persistence.js`
| Name | Kind | Line | Notes |
|------|------|------|-------|
| `St8Persistence` | variable | 509 | Main persistence class/object |

### `backend_server.js`
| Name | Kind | Line | Notes |
|------|------|------|-------|
| `St8Server` | variable | 1063 | HTTP server class/object |

### `backend_st8-types.js`
| Name | Kind | Line | Notes |
|------|------|------|-------|
| `LifecyclePhase` | variable | 266 | Enum — lifecycle phases |
| `FileStatus` | variable | 266 | Enum — file statuses |
| `MutationType` | variable | 266 | Enum — mutation types |
| `ActorType` | variable | 266 | Enum — actor types |
| `St8FileEntry` | variable | 266 | Type — file entry shape |
| `St8SchemaCard` | variable | 266 | Type — schema card shape |
| `St8MutationRecord` | variable | 266 | Type — mutation record shape |
| `validateAgainstShape` | variable | 266 | Generic shape validator |
| `validateSt8FileEntry` | variable | 266 | File entry validator |
| `validateSt8SchemaCard` | variable | 266 | Schema card validator |
| `validateSt8MutationRecord` | variable | 266 | Mutation record validator |
| `generateFingerprint` | variable | 266 | Fingerprint generator |
| `parseFingerprint` | variable | 266 | Fingerprint parser |

---

## 3. Import (Source Module) Detail

| File | Import Sources |
|------|---------------|
| `backend_index.js` | `path`, `fs`, `crypto`, `./indexer`, `./persistence`, `./manifestGenerator`, `./fileWatcher`, `./server`, `./st8-types`, `./schemaCardEmitter`, `./schemaCardPrinter`, `./notificationBus`, `./gapAnalyzer` |
| `backend_indexer.js` | `path`, `fs`, `crypto`, `./st8-types` |
| `backend_persistence.js` | `path`, `fs`, `./st8-types`, `better-sqlite3` |
| `backend_server.js` | `http`, `fs`, `path`, `os`, `crypto`, `./indexer`, `./manifestGenerator`, `./persistence`, `./notificationBus`, `./schemaCardEmitter`, `./prdGenerator`, `./gapAnalyzer` |
| `backend_st8-types.js` | *(none — zero dependencies)* |

---

## 4. Connection Graph

```
st8-types.js  ◄──────────────────────────────────────────────────┐
    (leaf)     ◄── index.js, indexer.js, persistence.js,         │
                    schemaCardEmitter.js,                         │
                    dataIngestion.js, migrationExecutor.js,       │
                    pathGenerator.js, relationshipAnalyzer.js,    │
                    reportGenerator.js, tomlSerializer.js         │
                                                                  │
indexer.js ◄── index.js, server.js                                │
    │                                                             │
    ├──► st8-types.js ────────────────────────────────────────────┘
    └──► pathGenerator.js                                         │
                                                                  │
persistence.js ◄── index.js, server.js, schemaCardEmitter.js,     │
                   verify-persistence-fixes.js                     │
    │                                                             │
    ├──► st8-types.js                                             │
    └──► pathGenerator.js                                         │
                                                                  │
server.js ◄── index.js                                            │
    │                                                             │
    ├──► indexer.js                                               │
    ├──► persistence.js                                           │
    ├──► manifestGenerator.js                                     │
    ├──► notificationBus.js                                       │
    ├──► schemaCardEmitter.js                                     │
    ├──► prdGenerator.js                                          │
    ├──► gapAnalyzer.js                                           │
    └──► pathGenerator.js                                         │
                                                                  │
index.js  (entry — imports everything, nothing imports it)        │
    │                                                             │
    ├──► indexer.js                                               │
    ├──► persistence.js                                           │
    ├──► manifestGenerator.js                                     │
    ├──► fileWatcher.js                                           │
    ├──► server.js                                                │
    ├──► st8-types.js                                             │
    ├──► schemaCardEmitter.js                                     │
    ├──► schemaCardPrinter.js                                     │
    ├──► notificationBus.js                                       │
    ├──► gapAnalyzer.js                                           │
    └──► pathGenerator.js                                         │
```

---

## 5. Observations & Anomalies

### All cards report `status: RED`
Every schema card has `"status": "RED"`. This likely indicates the indexer flagged these files as needing attention (possibly incomplete intent fields with `???` markers, or high mutation count). **Not a code bug** — but the intent metadata is clearly auto-generated stubs with placeholder `???` text that should be cleaned up.

### Duplicate `require()` entries detected

**`backend_index.js`** — duplicate requires in the `imports[]` array:
- `./manifestGenerator` appears **3 times** (lines 42–45, 81–85, 107–110)
- `fs` appears **2 times** (lines 87–90, 97–100)
- `crypto` appears **2 times** (lines 91–95, 101–105)

**`backend_server.js`** — heavily duplicated requires:
- `./persistence` appears **6 times**
- `./notificationBus` appears **3 times**
- `./indexer` appears **2 times**
- `path` appears **2 times**
- `fs` appears **2 times**

**`backend_persistence.js`** — duplicate require:
- `./st8-types` appears **2 times** (lines 40–44, 50–54)

These duplicates in the `imports[]` array likely reflect duplicate `require()` calls in the actual source files — a code quality issue (redundant but not harmful in Node.js due to module caching).

### `index.js` has zero exports
The entry point file exports nothing. It's purely a side-effect bootstrapper. This is valid for an entry point but means:
- Nothing can `require('./index')` and get a usable API
- Testing this module requires running it and observing side effects

### `index.js` has zero `importedBy`
Consistent with being the top-level entry point — nothing else imports it.

### All exports report `kind: "variable"`
Even what should be classes (`St8Persistence`, `St8Server`) or functions (`indexDirectory`, `validateSt8FileEntry`) are reported as `variable`. This is likely an indexer limitation — it doesn't distinguish `const fn = () => {}` from `class Foo {}` from `function bar() {}` when they're exported as named exports on a single line (all appear on line 266 or 474 or 509/1063).

### `st8-types.js` — all exports on line 266
All 13 exports share the same line number (266). This strongly suggests a single `module.exports = { ... }` block at line 266 that bundles everything.

### `indexer.js` — all exports on line 474
Same pattern — single `module.exports = { ... }` at line 474.

### `st8-types.js` — zero dependencies, maximum dependents
This is the foundational leaf module — imported by 10 other files across backend and lib layers. Correct architecture for a types/constants module.

### `server.js` is the largest file (42 KB)
At 42 KB / ~1063+ lines, this is a monolithic HTTP server. High fan-out (8 unique module dependencies). Candidate for decomposition.

---

## 6. Dependency Layering

```
Layer 0 (leaf):     st8-types.js
Layer 1:            indexer.js, persistence.js
Layer 2:            server.js, schemaCardEmitter.js, manifestGenerator.js, ...
Layer 3 (entry):    index.js
```

No circular dependencies detected among these 5 files. Clean layering.

---

_Reviewed: 2026-05-14_
_Source: .st8/schema-cards/ (5 JSON files)_
_Analyzer: Claude (manual schema card review)_
