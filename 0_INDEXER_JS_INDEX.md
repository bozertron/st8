# INDEXER.JS FILE INDEX

**File:** `backend/indexer.js`
**Lines:** 482
**Generated:** 2026-05-14

---

## SECTION 1: HEADER & IMPORTS (Lines 1-16)

```
Lines 1-16: File header, shebang, docstring, imports
├─ Line 1: #!/usr/bin/env node
├─ Lines 3-10: Module docstring
├─ Line 12: 'use strict'
├─ Line 14: const path = require('path')
├─ Line 15: const fs = require('fs')
└─ Line 16: const { generateFingerprint } = require('./st8-types')
```

**Imports:** `path`, `fs`, `./st8-types`
**Status:** ✅ Working

---

## SECTION 2: LIB MODULE LOADER (Lines 18-70)

```
Lines 18-70: Lib module loading utilities
├─ Line 22: LIB_DIR = path.join(__dirname, '..', 'lib')
├─ Lines 24-29: Lazy-loaded module variables
│   ├─ _astParser = null
│   ├─ _graphBuilder = null
│   ├─ _databasePersister = null
│   ├─ _tomlSerializer = null
│   └─ _backgroundIndexer = null
├─ Lines 31-42: loadLibModule(modulePath)
│   ├─ Line 33: fullPath = path.join(LIB_DIR, modulePath)
│   ├─ Line 34: fs.existsSync check
│   └─ Line 37: require(fullPath)
├─ Lines 44-49: getAstParser()
│   └─ loadLibModule('utils/astParser.js')
├─ Lines 51-56: getGraphBuilder()
│   └─ loadLibModule('commands/graphBuilder.js')
├─ Lines 58-63: getDatabasePersister()
│   └─ loadLibModule('commands/integr8/databasePersister.js')
└─ Lines 65-70: getTomlSerializer()
    └─ loadLibModule('commands/integr8/tomlSerializer.js')
```

**Purpose:** Lazy-loads lib modules with error handling
**Status:** ✅ Working

---

## SECTION 3: SCHEMA DEFINITION (Lines 72-157)

```
Lines 72-157: ST8_SCHEMA constant (SQL DDL)
├─ Lines 80-94: file_registry table (13 columns)
│   ├─ fingerprint TEXT PRIMARY KEY
│   ├─ filepath TEXT NOT NULL
│   ├─ filename TEXT NOT NULL
│   ├─ sha256Hash TEXT NOT NULL
│   ├─ fileSizeBytes INTEGER
│   ├─ status TEXT DEFAULT 'RED'
│   ├─ reachabilityScore REAL DEFAULT 0.0
│   ├─ impactRadius INTEGER DEFAULT 0
│   ├─ lifecyclePhase TEXT DEFAULT 'DEVELOPMENT'
│   ├─ birthTimestamp TEXT
│   ├─ lastModified TEXT
│   ├─ lastIndexed TEXT DEFAULT CURRENT_TIMESTAMP
│   └─ isEntryPoint INTEGER DEFAULT 0
├─ Lines 96-108: connections table (7 columns)
│   ├─ id INTEGER PRIMARY KEY AUTOINCREMENT
│   ├─ sourceFingerprint TEXT NOT NULL
│   ├─ targetFingerprint TEXT NOT NULL
│   ├─ connectionType TEXT DEFAULT 'IMPORT'
│   ├─ importSpecifier TEXT
│   ├─ isResolved INTEGER DEFAULT 1
│   ├─ confidenceScore REAL DEFAULT 1.0
│   └─ lastVerified TEXT DEFAULT CURRENT_TIMESTAMP
├─ Lines 110-118: file_intent table (6 columns)
│   ├─ fingerprint TEXT PRIMARY KEY
│   ├─ purpose TEXT
│   ├─ dependsOnBehavior TEXT
│   ├─ valueStatement TEXT
│   ├─ authoredBy TEXT DEFAULT 'INFERRED'
│   └─ lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP
├─ Lines 120-130: file_mutation_log table (7 columns)
│   ├─ id INTEGER PRIMARY KEY AUTOINCREMENT
│   ├─ fingerprint TEXT NOT NULL
│   ├─ sha256Hash TEXT NOT NULL
│   ├─ mutationType TEXT NOT NULL
│   ├─ changedFields TEXT
│   ├─ actor TEXT DEFAULT 'DEVELOPER'
│   ├─ timestamp TEXT DEFAULT CURRENT_TIMESTAMP
│   └─ metadata TEXT
├─ Lines 132-139: activity_log table (5 columns)
│   ├─ id INTEGER PRIMARY KEY AUTOINCREMENT
│   ├─ timestamp TEXT DEFAULT CURRENT_TIMESTAMP
│   ├─ source TEXT DEFAULT 'INDEXER'
│   ├─ action TEXT NOT NULL
│   ├─ targetFingerprint TEXT
│   └─ details TEXT
├─ Lines 141-148: Indexes (8 indexes)
│   ├─ idx_file_registry_status
│   ├─ idx_file_registry_sha256Hash
│   ├─ idx_file_registry_lifecycle
│   ├─ idx_connections_source
│   ├─ idx_connections_target
│   ├─ idx_mutation_log_fingerprint
│   ├─ idx_mutation_log_timestamp
│   └─ idx_activity_log_timestamp
└─ Lines 150-157: st8_settings table (4 columns)
    ├─ category TEXT NOT NULL
    ├─ key TEXT NOT NULL
    ├─ value TEXT
    ├─ updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    └─ PRIMARY KEY (category, key)
```

**Tables:** 5 (file_registry, connections, file_intent, file_mutation_log, activity_log, st8_settings)
**Indexes:** 8
**Status:** ⚠️ Duplicate of persistence.js schema

---

## SECTION 4: FILE DISCOVERY (Lines 159-190)

```
Lines 159-190: discoverFiles(targetDir)
├─ Line 161: CODE_EXTENSIONS constant
│   └─ .js, .ts, .jsx, .tsx, .vue, .py, .rs, .go, .md, .txt, .json
├─ Line 162: IGNORE_DIRS constant
│   └─ node_modules, .git, dist, build, .venv, venv, __pycache__, .archive, .planning, .st8, vendor, snapshots
└─ Lines 164-190: Recursive directory walker
    ├─ Line 168: fs.readdirSync(dir, { withFileTypes: true })
    ├─ Lines 172-176: Directory filtering
    └─ Lines 177-179: File filtering by extension
```

**Purpose:** Discovers all code files in target directory
**Status:** ✅ Working

---

## SECTION 5: HASHING (Lines 192-204)

```
Lines 192-204: hashFile(filePath)
├─ Line 194: crypto = require('crypto')
├─ Line 198: content = fs.readFileSync(filePath)
└─ Line 199: crypto.createHash('sha256').update(content).digest('hex')
```

**Purpose:** Computes SHA-256 hash of file contents
**Status:** ✅ Working

---

## SECTION 6: PARSING (Lines 206-232)

```
Lines 206-232: parseImports(filePath)
├─ Line 209: astParser = getAstParser()
├─ Lines 217-220: Try extractImportsAndExports(filePath)
│   └─ return result.imports || []
├─ Lines 222-226: Fallback to extractFromText(content)
│   └─ return result.imports || []
└─ Lines 228-231: Error handling
    └─ return []
```

**Purpose:** Extracts imports from file using AST parser
**Status:** ✅ Working

---

## SECTION 7: GRAPH BUILDING (Lines 234-317)

```
Lines 236-279: buildGraph(files, targetDir)
├─ Line 237: graphBuilder = getGraphBuilder()
├─ Lines 238-241: Fallback to classifyBasic if not available
├─ Lines 245-268: Try buildDependencyGraph(targetDir)
│   ├─ Line 246: report = await graphBuilder.buildDependencyGraph(targetDir)
│   ├─ Lines 251-267: Transform nodes to classification array
│   │   ├─ Line 252: healthToStatus mapping
│   │   │   ├─ 'healthy' → 'GREEN'
│   │   │   ├─ 'broken' → 'RED'
│   │   │   ├─ 'unused' → 'YELLOW'
│   │   │   └─ 'partial' → 'YELLOW'
│   │   └─ Lines 259-267: Map nodes to { filepath, status, reachabilityScore, impactRadius }
│   └─ Lines 271-272: Fallback if unexpected shape
└─ Lines 275-278: Error handling
    └─ return classifyBasic(files, targetDir)

Lines 281-317: classifyBasic(files, targetDir)
├─ Lines 283-287: Normalize file paths
├─ Lines 290-291: Create importedBy set
├─ Lines 293-304: For each file, parse imports
│   └─ If relative import, add to importedBy set
└─ Lines 306-316: Return classification array
    └─ GREEN if in importedBy, RED otherwise
```

**Purpose:** Builds dependency graph and classifies files
**Status:** ⚠️ Bug — classifyBasic doesn't resolve file extensions

---

## SECTION 8: MANIFEST GENERATION (Lines 319-358)

```
Lines 321-346: generateManifest(files, targetDir)
├─ Lines 322-332: Metadata object
│   ├─ timestamp
│   ├─ targetDirectory
│   ├─ totalFiles
│   └─ statusCounts (GREEN, YELLOW, RED)
└─ Lines 333-343: Files array
    └─ Map files to manifest format

Lines 348-358: writeManifest(manifest, targetDir)
├─ Line 349: outputPath = targetDir/connection-state.json
└─ Line 351: fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2))
```

**Purpose:** Generates and writes connection-state.json manifest
**Status:** ✅ Working

---

## SECTION 9: MAIN INDEXER (Lines 360-433)

```
Lines 362-433: indexDirectory(targetDir, options)
├─ Line 366: files = discoverFiles(targetDir)
├─ Lines 369-372: Early return if no files
├─ Lines 374-391: Hash files
│   ├─ Line 376: hash = hashFile(file)
│   ├─ Line 377: stat = fs.statSync(file)
│   ├─ Line 378: filepath = path.relative(targetDir, file)
│   ├─ Line 379: birthTimestamp = stat.birthtime || stat.mtime
│   └─ Line 387: fingerprint = generateFingerprint(filepath, birthTimestamp)
├─ Lines 393-405: Parse imports
│   ├─ Line 396: imports = parseImports(fullPath)
│   └─ Lines 399-403: Transform imports
│       └─ ⚠️ Bug: imp.names is always undefined
├─ Line 408: classifiedFiles = await buildGraph(parsedFiles, targetDir)
├─ Lines 410-419: Merge classification with parsed data
│   └─ Line 412: Find classification by filepath
├─ Line 422: manifest = generateManifest(finalFiles, targetDir)
├─ Lines 425-427: Write manifest if options.write !== false
└─ Lines 429-432: Console output and return
```

**Purpose:** Main indexing pipeline
**Status:** ⚠️ Bug — import specifier data lost (line 401)

---

## SECTION 10: CLI ENTRY POINT (Lines 435-470)

```
Lines 437-470: CLI entry point
├─ Lines 438-449: --help handler
├─ Line 451: targetDir = path.resolve(args[0])
├─ Line 452: watchMode = args.includes('--watch')
├─ Lines 454-457: Directory existence check
└─ Lines 459-469: indexDirectory(targetDir, { write: true })
    └─ Line 462: Watch mode not yet implemented
```

**Status:** ✅ Working

---

## SECTION 11: EXPORTS (Lines 472-482)

```
Lines 472-482: Module exports
├─ Line 474: indexDirectory
├─ Line 475: discoverFiles
├─ Line 476: hashFile
├─ Line 477: parseImports
├─ Line 478: buildGraph
├─ Line 479: generateManifest
└─ Line 480: writeManifest
```

**Exports:** 7 functions
**Status:** ✅ Working

---

## SUMMARY

| Section | Lines | Purpose | Status |
|---------|-------|---------|--------|
| Header & Imports | 1-16 | File setup | ✅ |
| Lib Module Loader | 18-70 | Lazy loading | ✅ |
| Schema Definition | 72-157 | SQL DDL (duplicate) | ⚠️ |
| File Discovery | 159-190 | Directory walker | ✅ |
| Hashing | 192-204 | SHA-256 hashing | ✅ |
| Parsing | 206-232 | Import extraction | ✅ |
| Graph Building | 234-317 | Dependency graph | ⚠️ |
| Manifest Generation | 319-358 | JSON manifest | ✅ |
| Main Indexer | 360-433 | Indexing pipeline | ⚠️ |
| CLI Entry Point | 435-470 | CLI interface | ✅ |
| Exports | 472-482 | Module exports | ✅ |

### Signal Flow

```
discoverFiles(targetDir)
    ↓
hashFile(file) × N
    ↓
parseImports(file) × N
    ↓
buildGraph(files, targetDir)
    ↓
generateManifest(files, targetDir)
    ↓
writeManifest(manifest, targetDir)
    ↓
return { files, manifest }
```

### Bugs Identified

| Bug | Lines | Description |
|-----|-------|-------------|
| Import specifier data lost | 399-403 | imp.names is always undefined |
| classifyBasic extension resolution | 296-300 | ./utils won't match ./utils.js |
| Duplicate schema | 72-157 | Same schema in persistence.js |

---

*Generated for architecture refactoring reference*
