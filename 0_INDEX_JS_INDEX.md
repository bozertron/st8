# INDEX.JS FILE INDEX

**File:** `backend/index.js`
**Lines:** 435
**Generated:** 2026-05-14

---

## SECTION 1: HEADER & IMPORTS (Lines 1-25)

```
Lines 1-25: File header, shebang, docstring, imports
├─ Line 1: #!/usr/bin/env node
├─ Lines 3-9: Module docstring
├─ Line 11: 'use strict'
├─ Line 13: const path = require('path')
├─ Line 14: const { indexDirectory } = require('./indexer')
├─ Line 15: const { St8Persistence } = require('./persistence')
├─ Line 16: const { writeManifests } = require('./manifestGenerator')
├─ Line 17: const { FileWatcher } = require('./fileWatcher')
├─ Line 18: const { St8Server } = require('./server')
├─ Line 19: const { generateFingerprint, MutationType, ActorType } = require('./st8-types')
├─ Line 20: const { SchemaCardEmitter } = require('./schemaCardEmitter')
├─ Line 21: const { SchemaCardPrinter } = require('./schemaCardPrinter')
├─ Line 22: const { notificationBus } = require('./notificationBus')
├─ Line 23: const { GapAnalyzer } = require('./gapAnalyzer')
└─ Line 24: const { IntentSeeder } = require('./intentSeeder')
```

**Imports:** 11 modules
**Status:** ✅ Working

---

## SECTION 2: ERROR HANDLERS (Lines 26-38)

```
Lines 26-38: Global error handlers
├─ Lines 29-32: process.on('unhandledRejection')
│   └─ console.error, don't crash
└─ Lines 34-38: process.on('uncaughtException')
    └─ console.error, process.exit(1)
```

**Status:** ✅ Working

---

## SECTION 3: MAIN FUNCTION (Lines 40-428)

### 3.1 CLI Argument Parsing (Lines 42-76)
```
Lines 42-76: Parse CLI arguments
├─ Line 43: args = process.argv.slice(2)
├─ Lines 45-61: --help handler
├─ Line 63: targetDir = path.resolve(args[0])
├─ Line 64: watchMode = args.includes('--watch')
├─ Line 65: serveMode = args.includes('--serve')
├─ Line 66: portArg = args.indexOf('--port')
├─ Line 67: port = portArg !== -1 ? parseInt(args[portArg + 1]) : 3847
└─ Lines 69-76: Console output
```

**Status:** ✅ Working

### 3.2 Persistence Initialization (Lines 78-80)
```
Lines 78-80: Initialize persistence
├─ Line 79: persistence = new St8Persistence()
└─ Line 80: await persistence.initialize()
```

**Status:** ✅ Working

### 3.3 Initial Indexing (Lines 82-84)
```
Lines 82-84: Run initial indexing
└─ Line 84: result = await indexDirectory(targetDir, { write: true })
```

**Status:** ✅ Working

### 3.4 Schema Card Emitter Setup (Lines 86-89)
```
Lines 86-89: Initialize schema card emitter + printer
├─ Line 87: emitter = new SchemaCardEmitter(targetDir)
├─ Line 88: printer = new SchemaCardPrinter(targetDir)
└─ Line 89: notificationBus.setPrinter(printer)
```

**Status:** ✅ Working

### 3.5 Store in SQLite — Pass 1 (Lines 91-121)
```
Lines 91-121: Store files in SQLite
├─ Lines 96-110: Pass 1: Upsert all files
│   └─ persistence.upsertFile(file)
└─ Lines 113-120: Log CREATE mutation for each file
    └─ persistence.logMutation(CREATE)
```

**Status:** ⚠️ Bug — Every file gets CREATE mutation on every run

### 3.6 Store in SQLite — Pass 2 (Lines 123-143)
```
Lines 123-143: Wire connections
├─ Lines 124-142: For each file's imports
│   ├─ Lines 127-130: Find target file (fuzzy matching)
│   └─ Lines 132-139: insertConnection()
```

**Status:** ⚠️ Bug — O(n²) lookup, fuzzy matching causes false positives

### 3.7 Activity Logging (Lines 145-152)
```
Lines 145-152: Log INDEX_COMPLETE activity
└─ persistence.logActivity(INDEX_COMPLETE)
```

**Status:** ✅ Working

### 3.8 Manifest Generation (Lines 154-157)
```
Lines 154-157: Generate manifests
├─ Line 155: require('./manifestGenerator')
└─ Line 156: writeManifests(result.files, targetDir)
```

**Status:** ✅ Working

### 3.9 Schema Card Emission (Lines 159-162)
```
Lines 159-162: Emit schema cards
├─ Line 160: emitter.emitAllCards(persistence)
└─ Line 161: printer.printAllFromCards()
```

**Status:** ✅ Working

### 3.10 Gap Analysis (Lines 164-173)
```
Lines 164-173: Run gap analysis
├─ Line 167: new GapAnalyzer(schemaCardsDir, persistence)
├─ Line 168: analyzer.analyze()
└─ Line 169: analyzer.writeReport()
```

**Status:** ✅ Working

### 3.11 Intent Seeding (Lines 175-183)
```
Lines 175-183: Seed intent for files
├─ Line 178: new IntentSeeder(persistence, schemaCardsDir)
└─ Line 179: seeder.seedAll()
```

**Status:** ✅ Working

### 3.12 File Watcher Setup (Lines 186-402)
```
Lines 186-402: File watcher setup
├─ Line 187: CODE_EXTENSIONS constant
├─ Line 188: watcher = null
├─ Lines 189-401: if (watchMode)
│   ├─ Line 191: new FileWatcher(targetDir, { debounceMs: 500, onFileChange })
│   ├─ Lines 193-399: onFileChange callback
│   │   ├─ Lines 195-198: Filter to code files only
│   │   ├─ Lines 206-372: For each change
│   │   │   ├─ Lines 209-252: DELETE path (unlink)
│   │   │   │   ├─ Line 212: Find file in result.files
│   │   │   │   ├─ Line 215: Remove from array
│   │   │   │   ├─ Lines 218-225: Log DELETE mutation
│   │   │   │   ├─ Lines 228-234: Publish SSE notification
│   │   │   │   ├─ Lines 237-244: Delete schema card from disk
│   │   │   │   └─ Line 246: persistence.deleteFile()
│   │   │   ├─ Lines 253-319: ADD path
│   │   │   │   ├─ Lines 255-256: Read file, compute hash
│   │   │   │   ├─ Lines 257-258: Get birthTimestamp
│   │   │   │   ├─ Line 259: generateFingerprint()
│   │   │   │   ├─ Lines 261-276: Create newFile object
│   │   │   │   ├─ Line 278: Push to result.files
│   │   │   │   ├─ Line 279: persistence.upsertFile()
│   │   │   │   ├─ Lines 281-288: Log CREATE mutation
│   │   │   │   ├─ Lines 290-296: Publish SSE notification
│   │   │   │   └─ Lines 299-314: Emit schema card
│   │   │   └─ Lines 320-372: CHANGE path
│   │   │       ├─ Line 321: Find file in result.files
│   │   │       ├─ Lines 324-327: Compute new hash
│   │   │       ├─ Line 328: Compare with old hash
│   │   │       ├─ Lines 330-331: Update file object
│   │   │       ├─ Line 332: persistence.upsertFile()
│   │   │       ├─ Lines 334-341: Log EDIT mutation
│   │   │       ├─ Lines 343-349: Publish SSE notification
│   │   │       ├─ Lines 352-357: Extract AST
│   │   │       └─ Lines 360-364: Emit updated schema card
│   │   └─ Lines 375-398: Post-mutation (if anyChanged)
│   │       ├─ Lines 377-378: writeManifests()
│   │       ├─ Lines 382-388: Re-run intent seeding
│   │       └─ Lines 391-397: Re-run gap analysis
│   └─ Line 401: watcher.start()
```

**Status:** ✅ Working (but connections hardcoded empty in incremental updates)

### 3.13 Server Setup (Lines 404-410)
```
Lines 404-410: Start server if requested
├─ Line 408: new St8Server({ port, targetDir })
└─ Line 409: server.start()
```

**Status:** ✅ Working

### 3.14 Shutdown Handler (Lines 416-427)
```
Lines 416-427: Graceful shutdown
├─ Lines 417-424: if (watchMode || serveMode)
│   └─ process.on('SIGINT')
│       ├─ watcher.stop()
│       ├─ server.stop()
│       └─ persistence.close()
└─ Lines 425-427: else
    └─ persistence.close()
```

**Status:** ✅ Working

---

## SECTION 4: RUN (Lines 430-435)

```
Lines 430-435: Main execution
└─ Line 432: main().catch(err => { process.exit(1) })
```

**Status:** ✅ Working

---

## SUMMARY

| Section | Lines | Purpose | Status |
|---------|-------|---------|--------|
| Header & Imports | 1-25 | File setup | ✅ |
| Error Handlers | 26-38 | Global error handling | ✅ |
| Main Function | 40-428 | All application logic | ✅ |
| Run | 430-435 | Entry point | ✅ |

### Key Functions

| Function | Lines | Purpose |
|----------|-------|---------|
| main() | 42-428 | Main application entry point |

### Signal Flow

```
CLI Parse → Init Persistence → Index Directory → Store in SQLite (2 passes)
→ Write Manifests → Emit Schema Cards → Gap Analysis → Intent Seeding
→ [optional] Start Watcher / Server → Wait for SIGINT
```

### Bugs Identified

| Bug | Lines | Description |
|-----|-------|-------------|
| Duplicate CREATE mutations | 113-120 | Every file gets CREATE on every run |
| O(n²) connection resolution | 127-130 | Fuzzy matching causes false positives |
| Connections hardcoded empty | 308-309, 361-362 | Watcher callback passes empty arrays |

---

*Generated for architecture refactoring reference*
