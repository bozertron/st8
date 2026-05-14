# Detailed Line-by-Line Report: `backend/index.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/index.js`
**Total Lines:** 435
**Generated:** 2026-05-13

---

## Lines 1-11: File Header & Strict Mode
```
1: #!/usr/bin/env node
2: (blank)
3-9: JSDoc comment block
10: (blank)
11: 'use strict';
```
- **What triggers it:** Node.js execution (`node index.js <target-dir>`)
- **What it calls:** N/A — declarative
- **What calls it:** CLI user, npm scripts, or process manager
- **Dependencies:** None
- **Status:** ✅ WORKING
- **Gap:** None. Standard Node.js entry point pattern.

---

## Lines 13-24: Imports (require() Statements)

### Line 13: `const path = require('path');`
- **What triggers it:** Module load (always)
- **What it calls:** Node.js built-in `path` module
- **What calls it:** Used throughout for `path.resolve()`, `path.join()`, `path.extname()`, `path.relative()`, `path.basename()`
- **Dependencies:** Node.js stdlib
- **Status:** ✅ WORKING

### Line 14: `const { indexDirectory } = require('./indexer');`
- **What triggers it:** Module load
- **What it calls:** `backend/indexer.js` — the `indexDirectory` async function
- **What calls it:** Line 84: `const result = await indexDirectory(targetDir, { write: true });`
- **Dependencies:** `backend/indexer.js`
- **Status:** ✅ WORKING
- **Gap:** None — `indexDirectory` is exported from `indexer.js` (line 474)

### Line 15: `const { St8Persistence } = require('./persistence');`
- **What triggers it:** Module load
- **What it calls:** `backend/persistence.js` — the `St8Persistence` class
- **What calls it:** Line 79: `const persistence = new St8Persistence();`
- **Dependencies:** `backend/persistence.js`, which depends on `better-sqlite3` or maestro's `DatabasePersister`
- **Status:** ✅ WORKING
- **Gap:** None — class is exported from `persistence.js` (line 702)

### Line 16: `const { writeManifests } = require('./manifestGenerator');`
- **What triggers it:** Module load
- **What it calls:** `backend/manifestGenerator.js` — the `writeManifests` function
- **What calls it:** Line 156: `writeManifests(result.files, targetDir);` (also re-imported redundantly at line 155)
- **Dependencies:** `backend/manifestGenerator.js`
- **Status:** ⚠️ WARNING — Redundant import (see Line 155 finding below)

### Line 17: `const { FileWatcher } = require('./fileWatcher');`
- **What triggers it:** Module load
- **What it calls:** `backend/fileWatcher.js` — the `FileWatcher` class
- **What calls it:** Line 191: `watcher = new FileWatcher(targetDir, { ... })`
- **Dependencies:** `backend/fileWatcher.js`, which depends on `chokidar` (lazy-loaded)
- **Status:** ✅ WORKING

### Line 18: `const { St8Server } = require('./server');`
- **What triggers it:** Module load
- **What it calls:** `backend/server.js` — the `St8Server` class
- **What calls it:** Line 408: `server = new St8Server({ port, targetDir });`
- **Dependencies:** `backend/server.js`
- **Status:** ✅ WORKING

### Line 19: `const { generateFingerprint, MutationType, ActorType } = require('./st8-types');`
- **What triggers it:** Module load
- **What it calls:** `backend/st8-types.js` — fingerprint generation and enum objects
- **What calls it:**
  - `generateFingerprint`: Line 259 (new file in watcher)
  - `MutationType`: Lines 116, 282, 335 (mutation logging)
  - `ActorType`: Lines 118, 223, 233, 283, 338 (actor identification)
- **Dependencies:** `backend/st8-types.js`
- **Status:** ✅ WORKING

### Line 20: `const { SchemaCardEmitter } = require('./schemaCardEmitter');`
- **What triggers it:** Module load
- **What it calls:** `backend/schemaCardEmitter.js` — the `SchemaCardEmitter` class
- **What calls it:** Line 87: `const emitter = new SchemaCardEmitter(targetDir);`
- **Dependencies:** `backend/schemaCardEmitter.js`
- **Status:** ✅ WORKING

### Line 21: `const { SchemaCardPrinter } = require('./schemaCardPrinter');`
- **What triggers it:** Module load
- **What it calls:** `backend/schemaCardPrinter.js` — the `SchemaCardPrinter` class
- **What calls it:** Line 88: `const printer = new SchemaCardPrinter(targetDir);`
- **Dependencies:** `backend/schemaCardPrinter.js`
- **Status:** ✅ WORKING

### Line 22: `const { notificationBus } = require('./notificationBus');`
- **What triggers it:** Module load
- **What it calls:** `backend/notificationBus.js` — singleton `notificationBus` instance
- **What calls it:**
  - Line 89: `notificationBus.setPrinter(printer);`
  - Lines 228, 290, 343: `notificationBus.publish(...)` in watcher callbacks
- **Dependencies:** `backend/notificationBus.js`
- **Status:** ✅ WORKING

### Line 23: `const { GapAnalyzer } = require('./gapAnalyzer');`
- **What triggers it:** Module load
- **What it calls:** `backend/gapAnalyzer.js` — the `GapAnalyzer` class
- **What calls it:**
  - Line 167: `const analyzer = new GapAnalyzer(schemaCardsDir, persistence);`
  - Line 393: `const analyzer = new GapAnalyzer(schemaCardsDir, persistence);` (incremental)
- **Dependencies:** `backend/gapAnalyzer.js`
- **Status:** ✅ WORKING

### Line 24: `const { IntentSeeder } = require('./intentSeeder');`
- **What triggers it:** Module load
- **What it calls:** `backend/intentSeeder.js` — the `IntentSeeder` class
- **What calls it:**
  - Line 178: `const seeder = new IntentSeeder(persistence, schemaCardsDir);`
  - Line 384: `const seeder = new IntentSeeder(persistence, schemaCardsDir);` (incremental)
- **Dependencies:** `backend/intentSeeder.js`
- **Status:** ✅ WORKING

---

## Lines 26-38: Global Error Handlers

### Lines 29-32: `unhandledRejection` handler
- **What triggers it:** Any unhandled promise rejection in the process
- **What it calls:** `console.error()` — logs and continues
- **What calls it:** Node.js process event system
- **Dependencies:** None
- **Status:** ⚠️ WARNING
- **Gap:** **Silent failure mode.** Swallowing unhandled rejections can mask bugs. In a production system, you'd want at minimum to track the count and potentially exit if it exceeds a threshold. The comment says "Don't crash — log and continue" but this means promises that reject without `catch` will silently lose errors. This is especially dangerous in the watcher callback (line 193) where `async` operations can fail silently.

### Lines 34-38: `uncaughtException` handler
- **What triggers it:** Any synchronous exception that escapes all try/catch blocks
- **What it calls:** `console.error()` then `process.exit(1)`
- **What calls it:** Node.js process event system
- **Dependencies:** None
- **Status:** ✅ WORKING
- **Gap:** Clean exit behavior is correct for uncaught exceptions.

---

## Lines 40-61: CLI Argument Parsing & Help Text

### Lines 42-61: `main()` function entry — argument parsing
- **What triggers it:** `main()` call at line 432
- **What it calls:** `process.argv.slice(2)` to parse CLI arguments
- **What calls it:** Line 432: `main().catch(err => { ... })`
- **Dependencies:** None
- **Status:** ✅ WORKING

### Line 63: `const targetDir = path.resolve(args[0]);`
- **What triggers it:** First CLI argument
- **What it calls:** `path.resolve()` to normalize the target directory path
- **What calls it:** CLI invocation: `node index.js /path/to/project`
- **Dependencies:** None
- **Status:** ✅ WORKING

### Lines 64-67: Mode flags and port parsing
- **What triggers it:** CLI arguments `--watch`, `--serve`, `--port`
- **What it calls:** `args.includes()`, `args.indexOf()`, `parseInt()`
- **What calls it:** CLI invocation with optional flags
- **Dependencies:** None
- **Status:** ✅ WORKING
- **Gap:** **No validation on `parseInt()` result.** Line 67: `parseInt(args[portArg + 1])` — if `--port` is the last argument, `args[portArg + 1]` is `undefined`, and `parseInt(undefined)` returns `NaN`. No check for this edge case. The port will be `NaN` and the server will fail to bind.

---

## Lines 69-76: Startup Banner
- **What triggers it:** Always on valid invocation
- **What it calls:** `console.log()` for banner display
- **What calls it:** `main()` function
- **Dependencies:** None
- **Status:** ✅ WORKING

---

## Lines 78-80: Persistence Initialization

### Line 79: `const persistence = new St8Persistence();`
- **What triggers it:** Always (even if no files found)
- **What it calls:** `St8Persistence` constructor from `persistence.js`
- **What calls it:** `main()` function
- **Dependencies:** `backend/persistence.js`
- **Status:** ✅ WORKING

### Line 80: `await persistence.initialize();`
- **What triggers it:** Always
- **What it calls:** `persistence.initialize()` — creates/opens SQLite database, applies schema
- **What calls it:** `main()` function
- **Dependencies:** `better-sqlite3` npm package (or maestro's `DatabasePersister`)
- **Status:** ✅ WORKING
- **Gap:** If `initialize()` fails (e.g., `better-sqlite3` not installed), the error propagates to the `main().catch()` at line 432, which exits with code 1. This is correct behavior.

---

## Lines 82-84: Initial Indexing

### Line 84: `const result = await indexDirectory(targetDir, { write: true });`
- **What triggers it:** Always
- **What it calls:** `indexer.indexDirectory()` — discovers files, hashes, parses imports, classifies, writes manifest
- **What calls it:** `main()` function
- **Dependencies:** `backend/indexer.js`
- **Status:** ✅ WORKING
- **Gap:** The `{ write: true }` option causes `indexer.js` to write `connection-state.json` to the target directory (line 426 of indexer.js). This manifest is later overwritten by `writeManifests()` at line 156. **Double-write:** The indexer writes its own manifest format, then `manifestGenerator.writeManifests()` overwrites it with a potentially different format. This is a minor redundancy.

---

## Lines 86-89: Schema Card Emitter & Printer Initialization

### Line 87: `const emitter = new SchemaCardEmitter(targetDir);`
- **What triggers it:** Always
- **What it calls:** `SchemaCardEmitter` constructor — sets up output directory at `.st8/schema-cards/`
- **What calls it:** `main()` function
- **Dependencies:** `backend/schemaCardEmitter.js`
- **Status:** ✅ WORKING

### Line 88: `const printer = new SchemaCardPrinter(targetDir);`
- **What triggers it:** Always
- **What it calls:** `SchemaCardPrinter` constructor — sets up output directory at `.planning/st8_identity_system/`
- **What calls it:** `main()` function
- **Dependencies:** `backend/schemaCardPrinter.js`
- **Status:** ✅ WORKING

### Line 89: `notificationBus.setPrinter(printer);`
- **What triggers it:** Always
- **What it calls:** `notificationBus.setPrinter()` — injects printer dependency for fallback `.txt` output on mutations
- **What calls it:** `main()` function
- **Dependencies:** `backend/notificationBus.js`
- **Status:** ✅ WORKING

---

## Lines 91-121: SQLite Storage — Pass 1: Upsert Files

### Line 92: `if (result.files && result.files.length > 0) {`
- **What triggers it:** Only when indexing found files
- **What it calls:** Null/length check on indexing result
- **What calls it:** `main()` function
- **Dependencies:** None
- **Status:** ✅ WORKING

### Lines 96-121: Loop to upsert each file + log CREATE mutation
- **What triggers it:** Each file in `result.files`
- **What it calls:**
  - `persistence.upsertFile()` (line 97) — INSERT OR REPLACE into file_registry
  - `persistence.logMutation()` (line 113) — INSERT into file_mutation_log
- **What calls it:** `main()` function
- **Dependencies:** `backend/persistence.js`
- **Status:** ✅ WORKING
- **Gap:** **Every file gets a CREATE mutation on every run.** Line 113-120 logs a `MutationType.CREATE` for every file every time the indexer runs. This means if you run `node index.js /project` twice, every file gets two CREATE mutation records. The mutation log should check if the file already exists before logging CREATE.

---

## Lines 123-143: SQLite Storage — Pass 2: Wire Connections

### Lines 124-142: Loop to insert import connections
- **What triggers it:** Each file with imports in `result.files`
- **What it calls:
  - `result.files.find()` (line 127) — O(n²) lookup to resolve import targets
  - `persistence.insertConnection()` (line 132) — INSERT OR REPLACE into connections
- **What calls it:** `main()` function
- **Dependencies:** `backend/persistence.js`
- **Status:** ⚠️ WARNING
- **Gap:**
  1. **O(n²) connection resolution.** Line 127-129 uses `result.files.find()` inside a nested loop. For large codebases (1000+ files), this becomes O(n²) per import. Should use a Map keyed by filepath.
  2. **Fuzzy matching logic.** Lines 128-129: `f.filepath.endsWith(imp.source) || f.filepath.includes(imp.source.replace(/^\.\//, ''))` — this can produce false positives. For example, if `imp.source` is `'utils'`, it will match any filepath containing "utils" (e.g., `src/utils.js`, `lib/string-utils.js`, `test/utils.spec.js`). Only relative imports starting with `.` should be resolved this way.
  3. **Missing resolution for non-relative imports.** If `imp.source` doesn't start with `.` (e.g., `'path'`, `'fs'`, `'lodash'`), no connection is recorded. External dependency tracking is entirely absent.

---

## Lines 145-152: Activity Log Entry
- **What triggers it:** Always (inside the `result.files.length > 0` block)
- **What it calls:** `persistence.logActivity()` — INSERT into activity_log
- **What calls it:** `main()` function
- **Dependencies:** `backend/persistence.js`
- **Status:** ✅ WORKING
- **Gap:** `result.manifest.metadata.statusCounts` (line 150) — if `result.manifest` is null (which `indexDirectory` returns when no files found, per indexer.js line 371), this will throw. However, this code is inside the `if (result.files && result.files.length > 0)` block, so `result.manifest` should not be null here. Safe but fragile.

---

## Lines 154-157: Manifest Generation (Second Write)

### Line 155: `const { writeManifests } = require('./manifestGenerator');`
- **What triggers it:** Always (inside the files block)
- **What it calls:** `require()` — **duplicate import** of `manifestGenerator`
- **What calls it:** `main()` function
- **Dependencies:** `backend/manifestGenerator.js`
- **Status:** ⚠️ WARNING
- **Gap:** **Redundant require().** `writeManifests` is already imported at line 16. This second `require()` is harmless (Node.js caches modules) but is dead code that suggests copy-paste from the watcher callback (line 377). Should be removed.

### Line 156: `writeManifests(result.files, targetDir);`
- **What triggers it:** Always (inside the files block)
- **What it calls:** `manifestGenerator.writeManifests()` — writes `connection-state.json` and `ai-signal.toml`
- **What calls it:** `main()` function
- **Dependencies:** `backend/manifestGenerator.js`
- **Status:** ✅ WORKING
- **Gap:** As noted in Line 84, this overwrites the manifest that `indexDirectory()` already wrote. Double-write.

---

## Lines 159-162: Schema Card Emission

### Line 160: `emitter.emitAllCards(persistence);`
- **What triggers it:** Always (inside the files block)
- **What it calls:** `SchemaCardEmitter.emitAllCards()` — generates `.json` schema cards for all files
- **What calls it:** `main()` function
- **Dependencies:** `backend/schemaCardEmitter.js`, `backend/persistence.js`
- **Status:** ✅ WORKING

### Line 161: `printer.printAllFromCards(path.join(targetDir, '.st8', 'schema-cards'));`
- **What triggers it:** Always (inside the files block)
- **What it calls:** `SchemaCardPrinter.printAllFromCards()` — reads `.json` cards, writes `.txt` human-readable versions
- **What calls it:** `main()` function
- **Dependencies:** `backend/schemaCardPrinter.js`
- **Status:** ✅ WORKING

---

## Lines 164-173: Gap Analysis

### Lines 165-173: Gap analysis with try/catch
- **What triggers it:** Always (inside the files block)
- **What it calls:**
  - `new GapAnalyzer(schemaCardsDir, persistence)` (line 167)
  - `analyzer.analyze()` (line 168)
  - `analyzer.writeReport()` (line 169)
- **What calls it:** `main()` function
- **Dependencies:** `backend/gapAnalyzer.js`
- **Status:** ✅ WORKING
- **Gap:** **`analyzer.analyze()` result is unused.** Line 168 calls `analyzer.analyze()` and stores it in `gapReport`, but `gapReport` is never read. Line 169 calls `analyzer.writeReport()` which internally calls `this.analyze()` again (gapAnalyzer.js line 622). This means the analysis runs twice — once for `gapReport` (discarded) and once inside `writeReport()`. Wasteful.

---

## Lines 175-183: Intent Seeding

### Lines 176-183: Intent seeding with try/catch
- **What triggers it:** Always (inside the files block)
- **What it calls:**
  - `new IntentSeeder(persistence, schemaCardsDir)` (line 178)
  - `seeder.seedAll()` (line 179)
- **What calls it:** `main()` function
- **Dependencies:** `backend/intentSeeder.js`
- **Status:** ✅ WORKING
- **Gap:** `seedResult` (line 180) is logged but not used for error handling. If `seedResult.errors > 0`, the process continues silently. This is acceptable for a heuristic seeder but should be documented.

---

## Lines 186-402: File Watcher (Watch Mode)

### Line 187: `const CODE_EXTENSIONS = new Set([...])`
- **What triggers it:** Always (hoisted outside the `if (watchMode)` block)
- **What it calls:** N/A — constant definition
- **What calls it:** Line 196: `return CODE_EXTENSIONS.has(ext);`
- **Dependencies:** None
- **Status:** ✅ WORKING
- **Gap:** This constant duplicates the `CODE_EXTENSIONS` in `indexer.js` (line 161). If one is updated, the other must be manually synced. Should be extracted to a shared constants file.

### Lines 189-402: `if (watchMode)` block — FileWatcher setup
- **What triggers it:** `--watch` CLI flag
- **What it calls:**
  - `new FileWatcher(targetDir, { ... })` (line 191)
  - `watcher.start()` (line 401)
- **What calls it:** `main()` function
- **Dependencies:** `backend/fileWatcher.js`, `chokidar` (lazy-loaded)
- **Status:** ✅ WORKING

### Lines 193-399: `onFileChange` callback — the core watcher logic
- **What triggers it:** File system change detected by chokidar (add/change/unlink)
- **What it calls:** Multiple subsystems (detailed below)
- **What calls it:** `FileWatcher._flush()` → `this.onFileChange(changes)`
- **Dependencies:** All imported modules
- **Status:** ✅ WORKING (with warnings)

### Lines 195-198: Extension filtering
- **What triggers it:** Every file change event
- **What it calls:** `path.extname()`, `CODE_EXTENSIONS.has()`
- **What calls it:** `onFileChange` callback
- **Dependencies:** None
- **Status:** ✅ WORKING

### Lines 206-373: Per-change processing loop

#### Lines 209-252: DELETE path (unlink)
- **What triggers it:** `change.type === 'unlink'`
- **What it calls:**
  - `result.files.findIndex()` (line 212) — in-memory lookup
  - `result.files.splice()` (line 215) — remove from in-memory array
  - `persistence.logMutation()` (line 218) — log DELETE mutation
  - `notificationBus.publish()` (line 228) — publish SSE event
  - `require('fs').existsSync()` + `require('fs').unlinkSync()` (lines 239-240) — delete schema card file
  - `persistence.deleteFile()` (line 246) — delete from SQLite
- **What calls it:** `onFileChange` callback
- **Dependencies:** `backend/persistence.js`, `backend/notificationBus.js`, `fs`
- **Status:** ✅ WORKING
- **Gap:** Lines 239, 240: `require('fs')` is called inline instead of using a top-level import. Harmless (cached) but inconsistent with style.

#### Lines 253-319: ADD path (new file)
- **What triggers it:** `change.type === 'add'`
- **What it calls:**
  - `require('fs').readFileSync()` (line 255) — read file content
  - `require('crypto').createHash('sha256')` (line 256) — hash content
  - `require('fs').statSync()` (line 257) — get file stats
  - `generateFingerprint()` (line 259) — generate stable identity
  - `result.files.push()` (line 278) — add to in-memory array
  - `persistence.upsertFile()` (line 279) — INSERT into SQLite
  - `persistence.logMutation()` (line 281) — log CREATE mutation
  - `notificationBus.publish()` (line 290) — publish SSE event
  - AST parser (lines 303-304) — extract imports/exports
  - `emitter.emitCard()` (line 308) — emit schema card JSON
- **What calls it:** `onFileChange` callback
- **Dependencies:** `backend/persistence.js`, `backend/notificationBus.js`, `backend/schemaCardEmitter.js`, `lib/utils/astParser.js`, `fs`, `crypto`
- **Status:** ✅ WORKING
- **Gap:**
  1. **Lines 303-305:** `require(path.join(__dirname, '..', 'lib', 'utils', 'astParser.js'))` — dynamic require inside a hot path. This is called on every file add. While Node.js caches modules, the path construction is repeated every time. Should be hoisted.
  2. **Line 309:** `{ importedBy: [], imports: [] }` — connections are hardcoded as empty for new files. This is correct (connections haven't been wired yet) but means the schema card for a new file will never show connections until the next full re-index.

#### Lines 320-372: CHANGE path (modified file)
- **What triggers it:** `change.type !== 'unlink' && change.type !== 'add'` (implicitly `'change'`)
- **What it calls:**
  - `require('crypto').createHash('sha256')` (lines 324-327) — hash new content
  - `persistence.upsertFile()` (line 332) — UPDATE SQLite
  - `persistence.logMutation()` (line 334) — log EDIT mutation
  - `notificationBus.publish()` (line 343) — publish SSE event
  - AST parser (lines 355-356) — extract imports/exports
  - `emitter.emitCard()` (line 361) — emit updated schema card JSON
- **What calls it:** `onFileChange` callback
- **Dependencies:** `backend/persistence.js`, `backend/notificationBus.js`, `backend/schemaCardEmitter.js`, `lib/utils/astParser.js`, `crypto`
- **Status:** ✅ WORKING
- **Gap:**
  1. **Lines 361-364:** `emitter.emitCard()` passes `{ importedBy: [], imports: [] }` as connections — same issue as ADD path. Connections are never updated incrementally.
  2. **Line 352:** `const fullPath = path.join(targetDir, changedFile.filepath);` — this is correct but note that `changedFile.filepath` is a relative path. If the file was moved/renamed, `changedFile.filepath` would still be the old path. No rename detection logic exists.

---

## Lines 375-398: Incremental Re-index (Post-Watcher)

### Lines 376-379: Conditional manifest regeneration
- **What triggers it:** `if (anyChanged)` — only when actual changes detected
- **What it calls:**
  - `require('./manifestGenerator').writeManifests()` (line 377-378) — re-write manifests
- **What calls it:** `onFileChange` callback (after processing all changes)
- **Dependencies:** `backend/manifestGenerator.js`
- **Status:** ⚠️ WARNING
- **Gap:** Line 377: `const { writeManifests } = require('./manifestGenerator');` — **third redundant require** of the same module. Already imported at lines 16 and 155. Should use the top-level import.

### Lines 381-388: Incremental intent seeding
- **What triggers it:** `if (anyChanged)`
- **What it calls:**
  - `new IntentSeeder(persistence, schemaCardsDir)` (line 384)
  - `seeder.seedAll()` (line 385)
- **What calls it:** `onFileChange` callback
- **Dependencies:** `backend/intentSeeder.js`
- **Status:** ⚠️ WARNING
- **Gap:** **Re-seeds ALL files on every change.** `seeder.seedAll()` iterates over every file in the registry, not just changed files. For a codebase with 500 files, a single file change triggers intent seeding for all 500 files. Should use `seedFile(fingerprint)` for only changed files.

### Lines 390-397: Incremental gap analysis
- **What triggers it:** `if (anyChanged)`
- **What it calls:**
  - `new GapAnalyzer(schemaCardsDir, persistence)` (line 393)
  - `analyzer.writeReport()` (line 394)
- **What calls it:** `onFileChange` callback
- **Dependencies:** `backend/gapAnalyzer.js`
- **Status:** ⚠️ WARNING
- **Gap:** **Re-analyzes ALL cards on every change.** `writeReport()` internally calls `analyze()` which loads all schema cards. For a single file change, the entire gap analysis re-runs. This is O(n) per change.

---

## Lines 404-410: Server Startup (Serve Mode)

### Lines 406-410: `if (serveMode)` block
- **What triggers it:** `--serve` CLI flag
- **What it calls:**
  - `new St8Server({ port, targetDir })` (line 408)
  - `server.start()` (line 409)
- **What calls it:** `main()` function
- **Dependencies:** `backend/server.js`
- **Status:** ✅ WORKING

---

## Lines 412-414: Ready Message
- **What triggers it:** Always
- **What it calls:** `console.log()`
- **What calls it:** `main()` function
- **Dependencies:** None
- **Status:** ✅ WORKING

---

## Lines 416-427: Process Lifecycle Management

### Lines 417-424: `if (watchMode || serveMode)` — SIGINT handler
- **What triggers it:** Ctrl+C or SIGINT signal (only when watching or serving)
- **What it calls:**
  - `watcher.stop()` (line 420)
  - `server.stop()` (line 421)
  - `persistence.close()` (line 422)
  - `process.exit(0)` (line 423)
- **What calls it:** OS signal
- **Dependencies:** `backend/fileWatcher.js`, `backend/server.js`, `backend/persistence.js`
- **Status:** ✅ WORKING
- **Gap:** No `SIGTERM` handler. If the process is killed with `kill <pid>` (SIGTERM), the watcher, server, and database won't be cleaned up gracefully. SQLite WAL mode protects against corruption, but connections won't be drained.

### Lines 425-427: `else` — immediate close
- **What triggers it:** Neither `--watch` nor `--serve` (one-shot mode)
- **What it calls:** `persistence.close()` (line 426)
- **What calls it:** `main()` function
- **Dependencies:** `backend/persistence.js`
- **Status:** ✅ WORKING

---

## Lines 430-435: Entry Point

### Lines 432-435: `main().catch(err => { ... })`
- **What triggers it:** Module load (runs immediately)
- **What it calls:** `main()` function, then error handler
- **What calls it:** Node.js module loader
- **Dependencies:** None
- **Status:** ✅ WORKING

---

## Connection Map

### What buttons/API calls trigger each section?

| Section | Trigger | Source |
|---------|---------|--------|
| Lines 42-61 (CLI parsing) | `node index.js <dir>` | User/CLI |
| Lines 82-84 (Initial indexing) | Automatic on startup | `main()` |
| Lines 91-121 (SQLite Pass 1) | After indexing completes | `main()` |
| Lines 123-143 (SQLite Pass 2) | After Pass 1 | `main()` |
| Lines 154-157 (Manifest write) | After Pass 2 | `main()` |
| Lines 159-162 (Schema cards) | After manifest write | `main()` |
| Lines 164-173 (Gap analysis) | After schema cards | `main()` |
| Lines 175-183 (Intent seeding) | After gap analysis | `main()` |
| Lines 189-402 (File watcher) | `--watch` flag | `main()` |
| Lines 404-410 (Server) | `--serve` flag | `main()` |
| Lines 417-424 (SIGINT) | Ctrl+C | OS signal |

### What other files does each section depend on?

| Section | Dependencies |
|---------|-------------|
| Imports (13-24) | `indexer.js`, `persistence.js`, `manifestGenerator.js`, `fileWatcher.js`, `server.js`, `st8-types.js`, `schemaCardEmitter.js`, `schemaCardPrinter.js`, `notificationBus.js`, `gapAnalyzer.js`, `intentSeeder.js` |
| Initial indexing (82-84) | `indexer.js` → `lib/utils/astParser.js`, `lib/commands/graphBuilder.js` |
| SQLite storage (91-143) | `persistence.js` → `better-sqlite3` |
| Schema cards (159-162) | `schemaCardEmitter.js` → `lib/utils/astParser.js`, `schemaCardPrinter.js` |
| Gap analysis (164-173) | `gapAnalyzer.js` |
| Intent seeding (175-183) | `intentSeeder.js` |
| File watcher (189-402) | `fileWatcher.js` → `chokidar`, `fs`, `crypto`, `lib/utils/astParser.js` |
| Server (404-410) | `server.js` → `http`, `fs` |

### What's NOT connected that should be?

1. **No connection to `brunoOscar.js`** — This file exists in the backend directory but is never imported or used in `index.js`. It may be a separate CLI tool or dead code.

2. **No connection to `templateEngine.js`** — Exists but never imported. May be used by the server or a separate CLI.

3. **No connection to `prdGenerator.js`** — Only used by the server (`server.js` line 926) but never in `index.js`'s main flow. The PRD is only generated on-demand via the `/api/prd` endpoint.

4. **No connection to `verify-persistence-fixes.js`** — Test/verification file, not imported.

---

## @@@ Symbol Handling

### In `backend/index.js` — **NONE FOUND**
- No `@@@` symbols appear in `index.js`.

### In `backend/intentSeeder.js` (called by index.js) — Lines 188-195:
```javascript
const TRIPLE_AT_PATTERN = /(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm;
const contentForDetection = fs.readFileSync(file.filepath, 'utf-8');
const tripleAtMatches = contentForDetection.match(TRIPLE_AT_PATTERN) || [];
const tripleAtCount = tripleAtMatches.length;

if (tripleAtCount > 0 && this.persistence) {
    this.persistence.flagForAIReview(file.filepath, tripleAtCount);
}
```
- **What triggers it:** `IntentSeeder.seedFile()` (called during intent seeding at lines 179 and 385)
- **What it does:** Scans file content for `@@@` markers, flags files for AI review in the database
- **What calls it:** `main()` → `seeder.seedAll()` → `seedFile()` → `_parseFileContent()` + `@@@` detection
- **Dependencies:** `backend/persistence.js` (flagForAIReview method)
- **Status:** ⚠️ WARNING
- **Gap:** The `@@@` detection reads the file from disk (`fs.readFileSync`) but the path used is `file.filepath` which is a **relative path**. Line 189: `fs.readFileSync(file.filepath, 'utf-8')` — this reads relative to `process.cwd()`, not relative to the target directory. If the process is started from a different directory than the target, this will fail with ENOENT. Should be `path.resolve(targetDir, file.filepath)` or similar.

---

## Summary of Findings

### Critical Issues (0)
None found.

### Warnings (8)
1. **Line 67:** `parseInt()` on potentially undefined `--port` argument produces `NaN`
2. **Lines 29-32:** `unhandledRejection` handler silently swallows errors
3. **Lines 113-120:** Every file gets CREATE mutation on every run (duplicate mutations)
4. **Lines 127-129:** O(n²) connection resolution with fuzzy matching can produce false positives
5. **Line 155:** Redundant `require('./manifestGenerator')` (already imported at line 16)
6. **Lines 168-169:** Gap analysis runs twice (result discarded, then re-run inside `writeReport`)
7. **Lines 381-388:** Incremental intent seeding re-seeds ALL files on every change
8. **Lines 390-397:** Incremental gap analysis re-analyzes ALL cards on every change

### Info (5)
1. **Line 187:** `CODE_EXTENSIONS` constant duplicated between `index.js` and `indexer.js`
2. **Line 377:** Third redundant `require('./manifestGenerator')` in watcher callback
3. **Lines 303-305:** Dynamic `require()` for AST parser inside hot path (should be hoisted)
4. **No SIGTERM handler** — only SIGINT is handled for graceful shutdown
5. **`intentSeeder.js` line 189:** `@@@` detection uses relative path without resolving to target directory

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
