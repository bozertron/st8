# PERSISTENCE.JS FILE INDEX

**File:** `backend/persistence.js`
**Lines:** 704
**Generated:** 2026-05-14

---

## SECTION 1: HEADER & IMPORTS (Lines 1-17)

```
Lines 1-17: File header, shebang, docstring, imports
├─ Line 1: #!/usr/bin/env node
├─ Lines 3-11: Module docstring
├─ Line 13: 'use strict'
├─ Line 15: const path = require('path')
├─ Line 16: const fs = require('fs')
└─ Line 17: const { St8FileEntry, LifecyclePhase, FileStatus } = require('./st8-types')
```

**Imports:** `path`, `fs`, `./st8-types`
**Status:** ✅ Working (but St8FileEntry, LifecyclePhase, FileStatus are unused)

---

## SECTION 2: LIB MODULE LOADER (Lines 19-43)

```
Lines 19-43: Lib module loading utilities
├─ Line 21: LIB_DIR = path.join(__dirname, '..', 'lib')
├─ Line 23: _databasePersister = null
├─ Lines 25-36: loadLibModule(modulePath)
│   ├─ Line 27: fullPath = path.join(LIB_DIR, modulePath)
│   ├─ Line 28: fs.existsSync check
│   └─ Line 31: require(fullPath)
└─ Lines 38-43: getDatabasePersister()
    └─ Line 40: loadLibModule('commands/integr8/databasePersister.js')
```

**Purpose:** Lazy-loads lib modules with error handling
**Status:** ⚠️ Bug — getDatabasePersister() returns module object, not class

---

## SECTION 3: SCHEMA DEFINITION (Lines 45-162)

```
Lines 45-162: ST8_SCHEMA constant (SQL DDL)
├─ Lines 48-73: file_registry table (24 columns)
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
│   ├─ isEntryPoint INTEGER DEFAULT 0
│   ├─ lastAccessed TEXT
│   ├─ sessionsSinceAccess INTEGER DEFAULT 0
│   ├─ expiryDate TEXT
│   ├─ associatedWith TEXT
│   ├─ eventTrigger TEXT
│   ├─ brunoStatus TEXT DEFAULT 'active'
│   ├─ needsAIReview INTEGER DEFAULT 0
│   ├─ tripleAtCount INTEGER DEFAULT 0
│   ├─ aiContentInjected INTEGER DEFAULT 0
│   ├─ templateVariables TEXT
│   └─ hasUnfilledVariables INTEGER DEFAULT 0
├─ Lines 75-87: connections table (7 columns)
│   ├─ id INTEGER PRIMARY KEY AUTOINCREMENT
│   ├─ sourceFingerprint TEXT NOT NULL (FK)
│   ├─ targetFingerprint TEXT NOT NULL (FK)
│   ├─ connectionType TEXT DEFAULT 'IMPORT'
│   ├─ importSpecifier TEXT
│   ├─ isResolved INTEGER DEFAULT 1
│   ├─ confidenceScore REAL DEFAULT 1.0
│   └─ lastVerified TEXT DEFAULT CURRENT_TIMESTAMP
├─ Lines 89-97: file_intent table (6 columns)
│   ├─ fingerprint TEXT PRIMARY KEY (FK)
│   ├─ purpose TEXT
│   ├─ dependsOnBehavior TEXT
│   ├─ valueStatement TEXT
│   ├─ authoredBy TEXT DEFAULT 'INFERRED'
│   └─ lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP
├─ Lines 99-109: file_mutation_log table (7 columns)
│   ├─ id INTEGER PRIMARY KEY AUTOINCREMENT
│   ├─ fingerprint TEXT NOT NULL (FK)
│   ├─ sha256Hash TEXT NOT NULL
│   ├─ mutationType TEXT NOT NULL
│   ├─ changedFields TEXT
│   ├─ actor TEXT DEFAULT 'DEVELOPER'
│   ├─ timestamp TEXT DEFAULT CURRENT_TIMESTAMP
│   └─ metadata TEXT
├─ Lines 111-118: activity_log table (5 columns)
│   ├─ id INTEGER PRIMARY KEY AUTOINCREMENT
│   ├─ timestamp TEXT DEFAULT CURRENT_TIMESTAMP
│   ├─ source TEXT DEFAULT 'INDEXER'
│   ├─ action TEXT NOT NULL
│   ├─ targetFingerprint TEXT
│   └─ details TEXT
├─ Lines 120-127: Indexes (8 indexes)
│   ├─ idx_file_registry_status
│   ├─ idx_file_registry_sha256Hash
│   ├─ idx_file_registry_lifecycle
│   ├─ idx_connections_source
│   ├─ idx_connections_target
│   ├─ idx_mutation_log_fingerprint
│   ├─ idx_mutation_log_timestamp
│   └─ idx_activity_log_timestamp
├─ Lines 129-135: st8_settings table (4 columns)
│   ├─ category TEXT NOT NULL
│   ├─ key TEXT NOT NULL
│   ├─ value TEXT
│   ├─ updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
│   └─ PRIMARY KEY (category, key)
├─ Lines 137-145: prd_projects table (7 columns)
│   ├─ id INTEGER PRIMARY KEY AUTOINCREMENT
│   ├─ name TEXT NOT NULL UNIQUE
│   ├─ path TEXT NOT NULL
│   ├─ template TEXT NOT NULL
│   ├─ variables TEXT
│   ├─ created TEXT DEFAULT CURRENT_TIMESTAMP
│   └─ updated TEXT DEFAULT CURRENT_TIMESTAMP
├─ Line 147: Index: idx_prd_projects_name
├─ Lines 149-155: ai_content table (4 columns)
│   ├─ id INTEGER PRIMARY KEY AUTOINCREMENT
│   ├─ filepath TEXT NOT NULL
│   ├─ content TEXT NOT NULL
│   ├─ reviewed INTEGER DEFAULT 0
│   └─ timestamp TEXT DEFAULT CURRENT_TIMESTAMP
└─ Lines 157-161: Indexes (3 indexes)
    ├─ idx_ai_content_filepath
    ├─ idx_ai_content_reviewed
    ├─ idx_file_registry_bruno
    ├─ idx_file_registry_ai_review
    └─ idx_file_registry_unfilled
```

**Tables:** 7 (file_registry, connections, file_intent, file_mutation_log, activity_log, st8_settings, prd_projects, ai_content)
**Indexes:** 12
**Status:** ✅ Working

---

## SECTION 4: PERSISTENCE CLASS (Lines 164-698)

### 4.1 Constructor (Lines 166-170)
```
Lines 166-170: St8Persistence constructor
├─ Line 168: this.dbPath = dbPath || path.join(process.cwd(), 'st8.sqlite')
└─ Line 169: this.db = null
```

### 4.2 Initialize (Lines 172-196)
```
Lines 172-196: initialize() method
├─ Lines 174-178: Try maestro DatabasePersister
│   └─ Line 176: typeof DatabasePersister === 'function' (ALWAYS FALSE)
├─ Lines 179-186: Fallback to better-sqlite3
│   ├─ Line 181: require('better-sqlite3')
│   ├─ Line 183: pragma('journal_mode = WAL')
│   └─ Line 184: pragma('synchronous = NORMAL')
└─ Line 189: this.db.exec(ST8_SCHEMA)
```

**Status:** ⚠️ Bug — maestro path never taken

### 4.3 File Registry Methods (Lines 198-277)
```
Lines 198-222: upsertFile(file)
├─ Lines 201-207: INSERT OR REPLACE INTO file_registry
└─ Lines 208-221: Parameters (12 of 24 columns)

Lines 224-227: getFilesByStatus(status)
└─ SELECT * FROM file_registry WHERE status = ?

Lines 229-238: getAllFiles()
└─ SELECT * FROM file_registry ORDER BY filepath

Lines 240-243: getFileByPath(filepath)
└─ SELECT * FROM file_registry WHERE filepath = ?

Lines 245-260: deleteFile(filepath)
├─ Lines 249-256: Transaction
│   ├─ deleteConnectionsForFile(fingerprint)
│   ├─ deleteIntentForFile(fingerprint)
│   ├─ deleteMutationLogForFile(fingerprint)
│   └─ DELETE FROM file_registry
└─ Line 258: Return { changes, fingerprint }

Lines 262-267: deleteConnectionsForFile(fingerprint)
└─ DELETE FROM connections WHERE sourceFingerprint = ? OR targetFingerprint = ?

Lines 269-272: deleteIntentForFile(fingerprint)
└─ DELETE FROM file_intent WHERE fingerprint = ?

Lines 274-277: deleteMutationLogForFile(fingerprint)
└─ DELETE FROM file_mutation_log WHERE fingerprint = ?
```

**Status:** ⚠️ Bug — upsertFile only specifies 12 of 24 columns (data loss)

### 4.4 Connection Methods (Lines 279-301)
```
Lines 279-296: insertConnection(conn)
├─ Lines 282-287: INSERT OR REPLACE INTO connections
└─ Lines 288-295: Parameters

Lines 298-301: getConnectionsForFile(fingerprint)
└─ SELECT * FROM connections WHERE sourceFingerprint = ? OR targetFingerprint = ?
```

**Status:** ✅ Working

### 4.5 Intent Methods (Lines 303-339)
```
Lines 303-318: upsertIntent(intent)
├─ Lines 306-310: INSERT OR REPLACE INTO file_intent
└─ Lines 311-317: Parameters

Lines 320-323: getIntent(fingerprint)
└─ SELECT * FROM file_intent WHERE fingerprint = ?

Lines 325-339: getAllIntents()
└─ SELECT * FROM file_intent
```

**Status:** ✅ Working

### 4.6 Mutation Log Methods (Lines 341-379)
```
Lines 343-357: logMutation(mutation)
├─ Lines 344-348: INSERT INTO file_mutation_log
└─ Lines 349-356: Parameters

Lines 359-364: getMutationLog(fingerprint, limit)
└─ SELECT * FROM file_mutation_log WHERE fingerprint = ? ORDER BY timestamp DESC LIMIT ?

Lines 366-372: getMutationCount(fingerprint)
└─ SELECT COUNT(*) as count FROM file_mutation_log WHERE fingerprint = ?

Lines 374-379: getLastMutation(fingerprint)
└─ SELECT * FROM file_mutation_log WHERE fingerprint = ? ORDER BY timestamp DESC LIMIT 1
```

**Status:** ✅ Working

### 4.7 Concept File Methods (Lines 381-420)
```
Lines 383-420: registerConceptFile(conceptEntry)
├─ Line 386: require('./st8-types')
├─ Line 388: generateFingerprint(filepath, birthTimestamp)
├─ Lines 390-409: Transaction
│   ├─ Lines 391-398: INSERT OR REPLACE INTO file_registry
│   └─ Lines 401-408: logMutation(CONCEPT)
└─ Line 419: Return fingerprint
```

**Status:** ✅ Working

### 4.8 Purge Methods (Lines 422-461)
```
Lines 424-461: purgeDevelopmentData(fingerprint)
├─ Lines 429-433: Count mutations to purge
├─ Lines 436-456: Transaction
│   ├─ Lines 437-441: DELETE development mutations
│   ├─ Lines 443-450: logMutation(PURGE)
│   └─ Lines 452-455: UPDATE lifecyclePhase = 'PRODUCTION'
└─ Line 460: Return { purgedMutations }
```

**Status:** ✅ Working

### 4.9 Activity Log Methods (Lines 463-482)
```
Lines 465-477: logActivity(activity)
├─ Lines 466-470: INSERT INTO activity_log
└─ Lines 471-476: Parameters

Lines 479-482: getRecentActivity(limit)
└─ SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?
```

**Status:** ✅ Working

### 4.10 Settings Methods (Lines 484-525)
```
Lines 486-492: upsertSetting(category, key, value)
└─ INSERT OR REPLACE INTO st8_settings

Lines 494-499: getSetting(category, key)
└─ SELECT value FROM st8_settings WHERE category = ? AND key = ?

Lines 501-509: getSettingsByCategory(category)
└─ SELECT key, value FROM st8_settings WHERE category = ?

Lines 511-520: getAllSettings()
└─ SELECT category, key, value FROM st8_settings ORDER BY category, key

Lines 522-525: deleteSetting(category, key)
└─ DELETE FROM st8_settings WHERE category = ? AND key = ?
```

**Status:** ✅ Working

### 4.11 Bruno & Oscar Methods (Lines 527-575)
```
Lines 529-534: getStaleFiles(threshold)
└─ SELECT * FROM file_registry WHERE sessionsSinceAccess >= ? AND brunoStatus = 'active'

Lines 536-545: updateFileLifecycle(filepath, updates)
└─ UPDATE file_registry SET ${setClause} WHERE filepath = ?

Lines 547-552: incrementSessionCounters()
└─ UPDATE file_registry SET sessionsSinceAccess = sessionsSinceAccess + 1

Lines 554-559: markFileAccessed(filepath)
└─ UPDATE file_registry SET sessionsSinceAccess = 0, lastAccessed = CURRENT_TIMESTAMP

Lines 561-566: archiveFile(filepath)
└─ UPDATE file_registry SET brunoStatus = 'archived'

Lines 568-575: setExpiryDate(filepath, daysFromNow)
└─ UPDATE file_registry SET expiryDate = ?
```

**Status:** ✅ Working

### 4.12 @@@ Symbol Methods (Lines 577-612)
```
Lines 579-584: flagForAIReview(filepath, tripleAtCount)
└─ UPDATE file_registry SET needsAIReview = 1, tripleAtCount = ?

Lines 586-591: markAIReviewed(filepath)
└─ UPDATE file_registry SET needsAIReview = 0

Lines 593-598: getFilesNeedingAIReview()
└─ SELECT * FROM file_registry WHERE needsAIReview = 1

Lines 600-605: storeAIContent(filepath, content)
└─ INSERT OR REPLACE INTO ai_content

Lines 607-612: getAIContent(filepath)
└─ SELECT * FROM ai_content WHERE filepath = ?
```

**Status:** ✅ Working

### 4.13 Template Methods (Lines 614-636)
```
Lines 616-623: setTemplateVariables(filepath, variables)
└─ UPDATE file_registry SET templateVariables = ?, hasUnfilledVariables = ?

Lines 625-636: getTemplateVariables(filepath)
└─ SELECT templateVariables, hasUnfilledVariables FROM file_registry WHERE filepath = ?
```

**Status:** ✅ Working

### 4.14 PRD Project Methods (Lines 638-681)
```
Lines 640-645: createPRDProject(name, projectPath, template, variables)
└─ INSERT INTO prd_projects

Lines 647-654: getPRDProject(name)
└─ SELECT * FROM prd_projects WHERE name = ?

Lines 656-665: getAllPRDProjects()
└─ SELECT * FROM prd_projects ORDER BY created DESC

Lines 667-676: updatePRDProject(name, updates)
└─ UPDATE prd_projects SET ${setClause}

Lines 678-681: deletePRDProject(name)
└─ DELETE FROM prd_projects WHERE name = ?
```

**Status:** ✅ Working

### 4.15 Utility Methods (Lines 683-697)
```
Lines 685-697: close()
└─ this.db.close() with error handling
```

**Status:** ✅ Working

---

## SECTION 5: EXPORTS (Lines 700-704)

```
Lines 700-704: Module exports
└─ Line 702: module.exports = { St8Persistence }
```

**Exports:** `St8Persistence` (class)
**Status:** ✅ Working

---

## SUMMARY

| Section | Lines | Purpose | Status |
|---------|-------|---------|--------|
| Header & Imports | 1-17 | File setup | ✅ |
| Lib Module Loader | 19-43 | Lazy loading | ⚠️ Bug |
| Schema Definition | 45-162 | SQL DDL | ✅ |
| Persistence Class | 164-698 | All CRUD operations | ✅ |
| Exports | 700-704 | Module exports | ✅ |

### Methods by Category

| Category | Methods | Lines | Status |
|----------|---------|-------|--------|
| File Registry | upsertFile, getFilesByStatus, getAllFiles, getFileByPath, deleteFile | 198-277 | ⚠️ upsertFile bug |
| Connections | insertConnection, getConnectionsForFile | 279-301 | ✅ |
| Intent | upsertIntent, getIntent, getAllIntents | 303-339 | ✅ |
| Mutation Log | logMutation, getMutationLog, getMutationCount, getLastMutation | 341-379 | ✅ |
| Concept Files | registerConceptFile | 381-420 | ✅ |
| Purge | purgeDevelopmentData | 422-461 | ✅ |
| Activity Log | logActivity, getRecentActivity | 463-482 | ✅ |
| Settings | upsertSetting, getSetting, getSettingsByCategory, getAllSettings, deleteSetting | 484-525 | ✅ |
| Bruno & Oscar | getStaleFiles, updateFileLifecycle, incrementSessionCounters, markFileAccessed, archiveFile, setExpiryDate | 527-575 | ✅ |
| @@@ Symbol | flagForAIReview, markAIReviewed, getFilesNeedingAIReview, storeAIContent, getAIContent | 577-612 | ✅ |
| Template | setTemplateVariables, getTemplateVariables | 614-636 | ✅ |
| PRD Projects | createPRDProject, getPRDProject, getAllPRDProjects, updatePRDProject, deletePRDProject | 638-681 | ✅ |
| Utility | close | 683-697 | ✅ |

### Proposed Split

| Target File | Source Lines | Purpose |
|-------------|--------------|---------|
| `src/0_core/0_database/0_connection.js` | 166-196 | Constructor, initialize, close |
| `src/0_core/0_database/0_schema/0_001_initial.sql` | 47-162 | Schema DDL |
| `src/0_core/0_database/0_queries/0_file-registry.js` | 198-277 | File registry CRUD |
| `src/0_core/0_database/0_queries/0_connections.js` | 279-301 | Connection CRUD |
| `src/0_core/0_database/0_queries/0_file-intent.js` | 303-339 | Intent CRUD |
| `src/0_core/0_database/0_queries/0_mutation-log.js` | 341-379 | Mutation log CRUD |
| `src/0_core/0_database/0_queries/0_activity-log.js` | 463-482 | Activity log CRUD |
| `src/0_core/0_database/0_queries/0_settings.js` | 484-525 | Settings CRUD |
| `src/0_core/0_database/0_queries/0_prd-projects.js` | 638-681 | PRD projects CRUD |
| `src/0_features/0_lifecycle/0_bruno.js` | 527-575 | Bruno & Oscar methods |
| `src/0_features/0_analysis/0_intent-seeder.js` | 577-612 | @@@ symbol methods |

---

*Generated for architecture refactoring reference*
