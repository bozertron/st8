# Research Report: ST8 Identity/Fingerprint System

**Date:** 2026-05-13
**Researcher:** GSD-Domain-Researcher
**Scope:** Full codebase investigation of the Identity and Fingerprint system

---

## Executive Summary

The ST8 Identity/Fingerprint system is **functional and operational**. It generates stable fingerprints, stores them in SQLite, tracks mutations, logs lifecycle phases, and emits schema cards. The system works end-to-end for its designed purpose: tracking file identity across the development lifecycle.

**Key answers to the three research questions:**

| # | Question | Answer |
|---|----------|--------|
| 1 | Is the Identity/Fingerprint system functional now? | **YES** — fully operational end-to-end |
| 2 | Can the parser/AST/Analyzers compare files by fingerprint? | **NO** — they extract structure, not identity |
| 3 | Can migrationExecutor.js perform that comparison? | **NO** — it handles migration plans, not fingerprint comparison |

---

## 1. Fingerprint System Architecture

### 1.1 Fingerprint Generation (`st8-types.js:198-200`)

**Format:** `{filepath}||{birthTimestamp}`

```javascript
const FINGERPRINT_SEPARATOR = '||';

function generateFingerprint(filepath, birthTimestamp) {
    return `${filepath}${FINGERPRINT_SEPARATOR}${birthTimestamp}`;
}
```

**Example:** `backend/persistence.js||2026-05-12T07:22:16.663Z`

**Design Properties:**
- **Stable:** Once generated, the fingerprint NEVER changes for a file
- **Unique:** Combines relative path + birth timestamp (filesystem `birthtime`)
- **Parseable:** `parseFingerprint()` at line 217 splits on `||` to recover components
- **Legacy-safe:** Handles old `:` separator format via `lastIndexOf(':')` fallback

**Callers (3 locations):**
- `backend/indexer.js:387` — batch indexing
- `backend/index.js:259` — file watcher `add` event
- `backend/persistence.js:386-388` — concept file registration

### 1.2 Fingerprint Storage (`persistence.js`)

**Table: `file_registry`** (primary key = `fingerprint`)
```sql
CREATE TABLE IF NOT EXISTS file_registry (
  fingerprint TEXT PRIMARY KEY,
  filepath TEXT NOT NULL,
  filename TEXT NOT NULL,
  sha256Hash TEXT NOT NULL,
  -- ... 20+ columns for lifecycle tracking
);
```

**Related tables that reference fingerprint:**
| Table | FK Column | Purpose |
|-------|-----------|---------|
| `connections` | `sourceFingerprint`, `targetFingerprint` | Import/export dependency graph |
| `file_intent` | `fingerprint` (PK) | Purpose/value statement per file |
| `file_mutation_log` | `fingerprint` | Every mutation event logged |
| `activity_log` | `targetFingerprint` | System activity audit trail |

### 1.3 Fingerprint Usage Flow

```
                    ┌─────────────────┐
                    │  File on disk   │
                    │  (birthtime)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────────┐
        │ indexer  │  │ index.js │  │ persistence  │
        │ (batch)  │  │ (watcher)│  │ (concept)    │
        └────┬─────┘  └────┬─────┘  └──────┬───────┘
             │              │               │
             └──────────────┼───────────────┘
                            ▼
                   ┌─────────────────┐
                   │  generateFp()   │
                   │  fp||birthTs    │
                   └────────┬────────┘
                            ▼
                   ┌─────────────────┐
                   │  SQLite INSERT  │
                   │  file_registry  │
                   └────────┬────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ connections│  │ mutation   │  │ schema     │
     │    table   │  │    log     │  │   cards    │
     └────────────┘  └────────────┘  └────────────┘
```

### 1.4 End-to-End Status: ✅ WORKING

The fingerprint system works end-to-end:

1. **Generation:** `generateFingerprint()` produces stable `filepath||birthTimestamp` strings
2. **Storage:** `persistence.upsertFile()` stores via `INSERT OR REPLACE` into `file_registry`
3. **Retrieval:** `persistence.getAllFiles()`, `getFileByPath()` retrieve by fingerprint
4. **Logging:** `persistence.logMutation()` records every CREATE/EDIT/DELETE with fingerprint
5. **Connections:** `persistence.insertConnection()` links source→target fingerprints
6. **Schema Cards:** `SchemaCardEmitter.emitAllCards()` reads from DB, writes `.json` per file
7. **File Watcher:** `index.js` generates fingerprints for new files, tracks edits by fingerprint
8. **API Verification:** `server.js` `/api/verify` endpoint compares stored sha256Hash vs current disk hash

**Evidence from `connection-state.json`:**
```json
{
  "fingerprint": "backend/fileWatcher.js||2026-05-12T07:22:16.663Z",
  "filepath": "backend/fileWatcher.js",
  "sha256Hash": "cc5007dc88248f76ec5c89fa3889c912e6d6931518148a09f02c8b0c9ab9d1ac",
  ...
}
```
This confirms the indexer ran successfully and produced fingerprinted output.

---

## 2. Identity System Architecture

### 2.1 File Identity Tracking

Every file gets a unique, stable identity via fingerprint. The system tracks:

| Field | Purpose | Updated When |
|-------|---------|--------------|
| `fingerprint` | Stable identity (PK) | Once at creation |
| `filepath` | Relative path | On rename (fingerprint changes) |
| `sha256Hash` | Content hash | On every edit |
| `status` | GREEN/YELLOW/RED health | On every index run |
| `lifecyclePhase` | CONCEPT→LOCKED→WIRING→DEVELOPMENT→PRODUCTION | On lifecycle transitions |
| `birthTimestamp` | File creation time | Once at creation |
| `lastModified` | Last content change | On every edit |
| `lastIndexed` | Last index run | On every index run |

### 2.2 Mutation Logging

Every state change is logged to `file_mutation_log`:

```sql
CREATE TABLE IF NOT EXISTS file_mutation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,        -- FK → file_registry
  sha256Hash TEXT NOT NULL,         -- Content version at this mutation
  mutationType TEXT NOT NULL,       -- CREATE/EDIT/DELETE/LOCK/PRODUCTION/PURGE
  changedFields TEXT,               -- JSON: {field: [old, new]}
  actor TEXT DEFAULT 'DEVELOPER',   -- DEVELOPER/INDEXER/WATCHER/AGENT
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT                     -- JSON: additional context
);
```

**Mutation types tracked:**
- `CONCEPT` — File registered before creation
- `CREATE` — First write to disk
- `EDIT` — Content changed (hash mismatch detected)
- `DELETE` — File removed from disk
- `LOCK` — MVP Lock applied
- `PRODUCTION` — Promoted to production
- `PURGE` — Development data purged

### 2.3 Lifecycle Phase Progression

```
CONCEPT → LOCKED → WIRING → DEVELOPMENT → PRODUCTION
   │         │                  │              │
   │         │                  │              └─ purgeDevelopmentData()
   │         │                  └─ watcher logs every edit
   │         └─ server.js /api/mvp-lock
   └─ server.js /api/concept-file (registerConceptFile)
```

**Implemented transitions:**
- `→ CONCEPT`: `persistence.registerConceptFile()` (server.js:803)
- `CONCEPT/DEVELOPMENT → LOCKED`: `server.js` `/api/mvp-lock` endpoint
- `→ DEVELOPMENT`: Default for indexed files (indexer.js:388)
- `→ PRODUCTION`: `persistence.purgeDevelopmentData()` (server.js:1008)

### 2.4 End-to-End Status: ✅ WORKING

The identity system tracks files from concept through production:
1. Files are registered with stable fingerprints
2. Every mutation is logged with actor, timestamp, and changed fields
3. Lifecycle phases progress through the defined state machine
4. Schema cards are emitted at each stage with full metadata

---

## 3. Parser/AST/Analyzers — Can They Compare Files by Fingerprint?

### 3.1 What `astParser.js` Extracts

**File:** `lib/utils/astParser.js` (1066 lines)

**Capabilities:**
- Extracts **imports** (ES modules, CommonJS require, dynamic imports, re-exports)
- Extracts **exports** (named, default, class, function, type, interface, enum)
- Parses **Vue SFC** files (`<script>` and `<script setup>`)
- Tracks **re-export chains** back to origin
- Computes **function signatures** (params, return types, generics)
- Detects **function purity** and **cyclomatic complexity**
- Extracts **JSDoc tags**

**What it does NOT do:**
- ❌ Does NOT generate fingerprints
- ❌ Does NOT compare files by fingerprint
- ❌ Does NOT reference `st8-types.js` or the fingerprint system
- ❌ Does NOT read from or write to the SQLite database
- ❌ Does NOT know about `file_registry` or `file_mutation_log`

**Verdict:** `astParser.js` is a **structural analysis tool**, not an identity comparison tool. It extracts WHAT a file contains, not WHO the file is.

### 3.2 What `graphBuilder.js` Analyzes

**File:** `lib/commands/graphBuilder.js` (214 lines)

**Capabilities:**
- Builds a **dependency graph** from parsed imports/exports
- Detects **circular dependencies** via DFS
- Computes **impact radius** (transitive dependents via BFS)
- Classifies files as **healthy/broken/unused/partial**
- Returns health score, orphaned files, dead imports

**What it does NOT do:**
- ❌ Does NOT generate or reference fingerprints
- ❌ Does NOT compare files by identity
- ❌ Does NOT read from SQLite
- ❌ Works on path-based node IDs, not fingerprint-based

**Verdict:** `graphBuilder.js` analyzes **dependency topology**, not file identity.

### 3.3 What `relationshipAnalyzer.js` Detects

**File:** `lib/commands/integr8/relationshipAnalyzer.js` (924 lines)

**Capabilities:**
- Analyzes relationships between **two SemanticGraphs** (external vs current project)
- Detects **dependency matches** by export name
- Classifies dependencies as SAFE/NEEDS_REWRITE/CONFLICT/MISSING
- Detects **breaking changes** via structural subtyping analysis
- Implements **Tarjan's SCC** for cycle detection
- Computes **variance analysis** for function signatures

**What it does NOT do:**
- ❌ Does NOT generate or reference fingerprints
- ❌ Does NOT compare files by fingerprint identity
- ❌ Does NOT read from SQLite
- ❌ Operates on **export names** and **file paths**, not fingerprints

**Verdict:** `relationshipAnalyzer.js` compares **API surfaces between projects**, not individual file identities.

### 3.4 Summary: Parser/AST/Analyzer Fingerprint Comparison

| Component | Extracts Structure | Uses Fingerprints | Can Compare by FP |
|-----------|-------------------|-------------------|-------------------|
| `astParser.js` | ✅ Imports, exports, signatures | ❌ No | ❌ No |
| `graphBuilder.js` | ✅ Dependency graph, health | ❌ No | ❌ No |
| `relationshipAnalyzer.js` | ✅ Cross-project relationships | ❌ No | ❌ No |

**Answer to Q2:** The parsers/analyzers **cannot** compare files by fingerprint. They are structural analysis tools that work with file paths and export names. The fingerprint system is a separate concern handled by `st8-types.js`, `persistence.js`, and `indexer.js`.

---

## 4. Migration Executor — Can It Compare Files?

### 4.1 What `migrationExecutor.js` Does

**File:** `lib/commands/integr8/migrationExecutor.js` (1837 lines)

This is a **code migration executor** for the Integr8 system. It handles:

- **Loading migration plans** from TOML files
- **Executing step-by-step migrations:**
  - `COPY_FILE` — Copy files between source and target
  - `REWRITE_IMPORT` — Rewrite import paths in files
  - `MERGE_ROUTE` — Merge route definitions into router files
  - `RESOLVE_CONFLICT` — Handle naming/implementation conflicts
  - `RUN_COMMAND` — Execute shell commands
  - `VERIFY` — Post-migration verification
- **Conflict resolution strategies:** rename, merge, overwrite, custom
- **Atomic execution** with snapshot/rollback support
- **Multi-level verification:** syntax, import resolution, type checking, semantic compatibility

### 4.2 Can It Compare Files?

**What it CAN compare:**
- ✅ **Hash-based comparison:** `createPreMigrationSnapshot()` creates SHA-256 checksums of config files for rollback verification
- ✅ **Content comparison:** `mergeByLines()` compares line-level differences
- ✅ **Export name comparison:** `extractExportNames()` finds conflicting exports
- ✅ **Signature comparison:** `hasSignatureMismatch()` compares function signatures
- ✅ **Pre/post state comparison:** `verifyIntegration()` compares syntax, imports, types, and semantics before/after migration

**What it CANNOT do:**
- ❌ Does NOT generate or reference ST8 fingerprints
- ❌ Does NOT read from `file_registry` or `file_mutation_log`
- ❌ Does NOT import from `st8-types.js`
- ❌ Does NOT use the `||` fingerprint format
- ❌ Works with **file paths** and **content hashes**, not ST8 fingerprints

### 4.3 Fingerprint Awareness Gap

The `migrationExecutor.js` uses its own SHA-256 hashing for snapshot integrity:
```javascript
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update(content).digest('hex');
```

This is **independent** of the ST8 fingerprint system. The migration executor:
- Uses `sha256Hash` for content verification (same concept, different implementation)
- Uses file paths for identity (not `filepath||birthTimestamp` fingerprints)
- Has no awareness of `file_registry`, `file_mutation_log`, or lifecycle phases

**Answer to Q3:** `migrationExecutor.js` **cannot** perform ST8 fingerprint-based file comparison. It has its own hash-based comparison for migration integrity, but it operates in a completely separate domain (Integr8 migration plans) from the ST8 identity system.

---

## 5. System Integration Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        ST8 IDENTITY SYSTEM                       │
│                                                                   │
│  st8-types.js ──────► generateFingerprint() ──► parseFingerprint()│
│       │                                                           │
│       ▼                                                           │
│  persistence.js ────► file_registry (SQLite)                      │
│       │              ├─ connections table                         │
│       │              ├─ file_intent table                         │
│       │              └─ file_mutation_log table                   │
│       ▼                                                           │
│  indexer.js ────────► discover → hash → parse → classify → store │
│       │                                                           │
│       ▼                                                           │
│  index.js ──────────► FileWatcher → onFileChange → upsert/log    │
│       │                                                           │
│       ▼                                                           │
│  schemaCardEmitter ► emitAllCards() → .st8/schema-cards/*.json   │
│       │                                                           │
│       ▼                                                           │
│  server.js ────────► /api/verify (hash comparison)                │
│                      /api/concept-file (register)                 │
│                      /api/mvp-lock (lifecycle transition)         │
│                      /api/production-promote (purge)              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     ANALYZER SYSTEM (separate)                    │
│                                                                   │
│  astParser.js ──────► extractImportsAndExports()                 │
│  graphBuilder.js ───► buildDependencyGraph()                     │
│  relationshipAnalyzer ► analyzeRelationships()                   │
│                                                                   │
│  These do NOT use fingerprints. They analyze structure.           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   MIGRATION SYSTEM (separate)                     │
│                                                                   │
│  migrationExecutor ► executeMigrationPlan()                      │
│                      verifyIntegration()                          │
│                      createPreMigrationSnapshot()                 │
│                                                                   │
│  This does NOT use ST8 fingerprints. It has its own hashing.     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Known Issues and Gaps

### 6.1 Working Correctly
- ✅ Fingerprint generation with `||` separator
- ✅ SQLite storage with proper schema
- ✅ Mutation logging for all lifecycle events
- ✅ Schema card emission with full metadata
- ✅ File watcher incremental updates
- ✅ API verification endpoint (hash comparison)
- ✅ Concept file registration
- ✅ MVP Lock lifecycle transition
- ✅ Production promotion with data purge
- ✅ Delete cascade (connections, intent, mutation_log)

### 6.2 Minor Issues (Non-blocking)
- ⚠️ `generateFingerprint` re-required inline in `persistence.js:386` instead of top-level import
- ⚠️ No `getFileByFingerprint()` method — callers use `getAllFiles().find()`
- ⚠️ `parseFingerprint()` throws on null/undefined input
- ⚠️ Concept files generate non-deterministic fingerprints (timestamp-based)
- ⚠️ `insertConnection` doesn't verify FK existence (relies on caller ordering)
- ⚠️ Duplicate `ST8_SCHEMA` definition in both `persistence.js` and `indexer.js`

### 6.3 Architectural Gap: No Cross-System Fingerprint Bridge
The three subsystems (Identity, Analyzers, Migration) operate independently:
- Identity system uses `filepath||birthTimestamp` fingerprints
- Analyzers use file paths and export names
- Migration executor uses content hashes and file paths

There is **no mechanism** to compare an ST8 fingerprint against the analyzer's structural output or the migration executor's hash-based comparisons.

---

## 7. Recommendations

### 7.1 If Fingerprint-Based File Comparison Is Needed

To enable the parsers/analyzers to compare files by fingerprint:

1. **Add fingerprint to AST results:** Have `astParser.js` accept an optional fingerprint parameter and include it in the result object
2. **Add fingerprint to graph nodes:** Have `graphBuilder.js` include fingerprint in node metadata when available from the database
3. **Create a bridge module:** A new module that joins SQLite `file_registry` data with analyzer output using fingerprint as the join key

### 7.2 If Migration Executor Needs Fingerprint Awareness

To enable `migrationExecutor.js` to work with ST8 fingerprints:

1. **Import `st8-types.js`:** Add `generateFingerprint` to the migration executor
2. **Read from `file_registry`:** Before migration, load the ST8 database to get current fingerprints
3. **Log migrations as mutations:** After successful migration, log to `file_mutation_log`

### 7.3 Quick Wins
- Move `generateFingerprint` import to top-level in `persistence.js`
- Add `getFileByFingerprint(fingerprint)` convenience method to `St8Persistence`
- Add null guard to `parseFingerprint()` to prevent TypeError
- De-duplicate `ST8_SCHEMA` between `persistence.js` and `indexer.js`

---

## Conclusion

The ST8 Identity/Fingerprint system is a **well-designed, functional subsystem** that successfully tracks file identity across the development lifecycle. It generates stable fingerprints, stores them in SQLite, logs every mutation, and emits rich schema cards.

However, it operates as a **siloed system**. The AST parser, graph builder, relationship analyzer, and migration executor are all independent subsystems that do not participate in the fingerprint identity model. If cross-system fingerprint comparison is needed, intentional bridging must be built.

---

*Report generated: 2026-05-13T20:30:00Z*
*Researcher: GSD-Domain-Researcher*
*Files analyzed: st8-types.js, persistence.js, indexer.js, index.js, server.js, schemaCardEmitter.js, astParser.js, graphBuilder.js, relationshipAnalyzer.js, migrationExecutor.js*
