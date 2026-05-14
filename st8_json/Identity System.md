# ST8 Identity System — Phase Specifications

**Companion to EXECUTION-PLAN.md**
**Every code snippet is agent-executable. No ambiguity.**

---

# ═══════════════════════════════════════════════════════════════
# PHASE 0: st8-types.js — Canonical Type Definitions
# ═══════════════════════════════════════════════════════════════

**File to create:** `backend/st8-types.js`
**Dependencies:** None
**Verification:** `node backend/st8-types.js --validate` exits 0

```javascript
#!/usr/bin/env node

/**
 * ST8 Types — Canonical Type Definitions
 *
 * THE single source of truth for all st8 data shapes.
 * Every module must import from this file.
 * No module may define its own type shape for data that crosses module boundaries.
 */

'use strict';

// ─── LIFECYCLE PHASES ────────────────────────────────────────

const LifecyclePhase = Object.freeze({
    CONCEPT: 'CONCEPT',       // Pre-code — file doesn't exist on disk yet
    LOCKED: 'LOCKED',         // MVP Lock — schema cards emitted, PRD generated
    WIRING: 'WIRING',         // Cross-file deps validated against schema cards
    DEVELOPMENT: 'DEVELOPMENT', // Active coding — watcher logs every mutation
    PRODUCTION: 'PRODUCTION'  // Mutation log purged — lightweight card only
});

// ─── FILE STATUS ─────────────────────────────────────────────

const FileStatus = Object.freeze({
    GREEN: 'GREEN',           // Imported by other files, healthy
    YELLOW: 'YELLOW',         // Partially connected
    RED: 'RED',               // Orphaned or no consumers
    CONCEPT: 'CONCEPT',       // Pre-code placeholder
    LOCKED: 'LOCKED',         // MVP-locked, awaiting implementation
    PRODUCTION: 'PRODUCTION'  // Production-ready, lightweight tracking
});

// ─── MUTATION TYPES ──────────────────────────────────────────

const MutationType = Object.freeze({
    CONCEPT: 'CONCEPT',       // File registered before creation
    CREATE: 'CREATE',         // First write to disk
    EDIT: 'EDIT',             // Content changed
    RENAME: 'RENAME',         // File moved/renamed
    REFACTOR: 'REFACTOR',     // Structural change detected
    LOCK: 'LOCK',             // MVP Lock applied
    PRODUCTION: 'PRODUCTION', // Promoted to production
    PURGE: 'PURGE'            // Development data purged
});

// ─── ACTOR TYPES ─────────────────────────────────────────────

const ActorType = Object.freeze({
    DEVELOPER: 'DEVELOPER',   // Human via IDE/editor
    INDEXER: 'INDEXER',       // St8 indexer (batch)
    WATCHER: 'WATCHER',       // File watcher (incremental)
    AGENT: 'AGENT'            // AI agent or automated tool
});

// ─── St8FileEntry — CANONICAL FILE SHAPE ─────────────────────
// This is the shape that EVERY module must use when working with file data.
// Database columns, API responses, and internal objects all use this shape.

const St8FileEntry = Object.freeze({
    fingerprint: '',          // Stable identity: {filepath}:{birthTimestamp}
    filepath: '',             // Relative path from project root
    filename: '',             // Basename with extension
    sha256Hash: '',           // Content version (changes on every edit)
    fileSizeBytes: 0,
    status: 'RED',            // FileStatus enum value
    reachabilityScore: 0.0,   // 0.0 to 1.0
    impactRadius: 0,          // Transitive dependents count
    lifecyclePhase: 'DEVELOPMENT', // LifecyclePhase enum value
    birthTimestamp: '',        // ISO timestamp — set once at creation, never changes
    lastModified: '',         // ISO timestamp — updated on every content change
    lastIndexed: '',          // ISO timestamp — updated on every index run
    isEntryPoint: false       // Whether this file is an entry point
});

// ─── St8SchemaCard — EXTENDED FILE SHAPE FOR EMISSION ────────
// Includes AST-extracted metadata + connections + intent + mutation summary

const St8SchemaCard = Object.freeze({
    // Core identity (from St8FileEntry)
    fingerprint: '',
    filepath: '',
    filename: '',
    sha256Hash: '',
    fileSizeBytes: 0,
    status: 'RED',
    reachabilityScore: 0.0,
    impactRadius: 0,
    lifecyclePhase: 'DEVELOPMENT',
    birthTimestamp: '',
    lastModified: '',
    lastIndexed: '',
    isEntryPoint: false,

    // AST-extracted data
    exports: [],              // [{name, kind, signature, returnType, paramCount, ...}]
    imports: [],              // [{source, specifiers, importType, line}]

    // Connection data
    connections: {
        importedBy: [],       // [filepath, ...]
        imports: []           // [filepath, ...]
    },

    // Intent data (from file_intent table)
    intent: {
        purpose: '',
        dependsOnBehavior: '',
        valueStatement: ''
    },

    // Mutation summary
    mutationCount: 0,
    lastMutation: {
        type: '',             // MutationType enum value
        actor: '',            // ActorType enum value
        timestamp: ''
    }
});

// ─── St8MutationRecord ───────────────────────────────────────

const St8MutationRecord = Object.freeze({
    fingerprint: '',
    sha256Hash: '',           // Content version at this mutation
    mutationType: '',         // MutationType enum value
    changedFields: '',        // JSON string: {field: [oldValue, newValue]}
    actor: '',                // ActorType enum value
    timestamp: '',            // ISO timestamp
    metadata: ''              // JSON string: schema card snapshot at this mutation
});

// ─── VALIDATION ──────────────────────────────────────────────

/**
 * Validates an object against a canonical type shape.
 * Returns { valid: boolean, missing: string[], extra: string[], wrongType: string[] }
 */
function validateAgainstShape(obj, shape, strict = false) {
    const result = { valid: true, missing: [], extra: [], wrongType: [] };

    for (const key of Object.keys(shape)) {
        if (!(key in obj)) {
            result.missing.push(key);
            result.valid = false;
        } else if (typeof obj[key] !== typeof shape[key] && obj[key] !== null && obj[key] !== undefined) {
            result.wrongType.push(`${key}: expected ${typeof shape[key]}, got ${typeof obj[key]}`);
            result.valid = false;
        }
    }

    if (strict) {
        for (const key of Object.keys(obj)) {
            if (!(key in shape)) {
                result.extra.push(key);
                result.valid = false;
            }
        }
    }

    return result;
}

function validateSt8FileEntry(obj) {
    return validateAgainstShape(obj, St8FileEntry);
}

function validateSt8SchemaCard(obj) {
    return validateAgainstShape(obj, St8SchemaCard);
}

function validateSt8MutationRecord(obj) {
    return validateAgainstShape(obj, St8MutationRecord);
}

// ─── FINGERPRINT GENERATION ──────────────────────────────────

/**
 * Generates a stable fingerprint from filepath and birth timestamp.
 * The fingerprint NEVER changes once generated.
 */
function generateFingerprint(filepath, birthTimestamp) {
    return `${filepath}:${birthTimestamp}`;
}

/**
 * Parses a fingerprint back into its components.
 */
function parseFingerprint(fingerprint) {
    const lastColon = fingerprint.lastIndexOf(':');
    if (lastColon === -1) return { filepath: fingerprint, birthTimestamp: '' };
    return {
        filepath: fingerprint.substring(0, lastColon),
        birthTimestamp: fingerprint.substring(lastColon + 1)
    };
}

// ─── CLI VALIDATION COMMAND ──────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--validate')) {
        console.log('[st8:types] Running type validation...');
        console.log('[st8:types] St8FileEntry fields:', Object.keys(St8FileEntry).join(', '));
        console.log('[st8:types] St8SchemaCard fields:', Object.keys(St8SchemaCard).join(', '));
        console.log('[st8:types] St8MutationRecord fields:', Object.keys(St8MutationRecord).join(', '));
        console.log('[st8:types] LifecyclePhase values:', Object.values(LifecyclePhase).join(', '));
        console.log('[st8:types] MutationType values:', Object.values(MutationType).join(', '));

        // Self-test
        const testEntry = { ...St8FileEntry, fingerprint: 'test.js:0', filepath: 'test.js' };
        const result = validateSt8FileEntry(testEntry);
        if (result.valid) {
            console.log('[st8:types] Self-test: PASS');
        } else {
            console.error('[st8:types] Self-test: FAIL', result);
            process.exit(1);
        }
        process.exit(0);
    }

    console.log('Usage: node st8-types.js --validate');
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    LifecyclePhase,
    FileStatus,
    MutationType,
    ActorType,
    St8FileEntry,
    St8SchemaCard,
    St8MutationRecord,
    validateAgainstShape,
    validateSt8FileEntry,
    validateSt8SchemaCard,
    validateSt8MutationRecord,
    generateFingerprint,
    parseFingerprint
};
```

**Verification:**
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node backend/st8-types.js --validate
# Expected output: [st8:types] Self-test: PASS
```


# ═══════════════════════════════════════════════════════════════
# PHASE 1: Schema Changes — persistence.js + indexer.js
# ═══════════════════════════════════════════════════════════════

**Depends on:** Phase 0 (st8-types.js)
**Files to modify:**
- `backend/persistence.js` — ST8_SCHEMA constant + all SQL statements + method signatures
- `backend/indexer.js` — ST8_SCHEMA constant (duplicate, must match)
**Verification:** `node -e "const {St8Persistence}=require('./backend/persistence'); const p=new St8Persistence(); p.initialize(); console.log('OK'); p.close();"`

## 1A. persistence.js — New ST8_SCHEMA

Replace the existing `ST8_SCHEMA` constant (lines 46-96) with:

```javascript
const { St8FileEntry, LifecyclePhase, FileStatus } = require('./st8-types');

const ST8_SCHEMA = `
CREATE TABLE IF NOT EXISTS file_registry (
  fingerprint TEXT PRIMARY KEY,
  filepath TEXT NOT NULL,
  filename TEXT NOT NULL,
  sha256Hash TEXT NOT NULL,
  fileSizeBytes INTEGER,
  status TEXT DEFAULT 'RED',
  reachabilityScore REAL DEFAULT 0.0,
  impactRadius INTEGER DEFAULT 0,
  lifecyclePhase TEXT DEFAULT 'DEVELOPMENT',
  birthTimestamp TEXT,
  lastModified TEXT,
  lastIndexed TEXT DEFAULT CURRENT_TIMESTAMP,
  isEntryPoint INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceFingerprint TEXT NOT NULL,
  targetFingerprint TEXT NOT NULL,
  connectionType TEXT DEFAULT 'IMPORT',
  importSpecifier TEXT,
  isResolved INTEGER DEFAULT 1,
  confidenceScore REAL DEFAULT 1.0,
  lastVerified TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sourceFingerprint) REFERENCES file_registry(fingerprint),
  FOREIGN KEY (targetFingerprint) REFERENCES file_registry(fingerprint)
);

CREATE TABLE IF NOT EXISTS file_intent (
  fingerprint TEXT PRIMARY KEY,
  purpose TEXT,
  dependsOnBehavior TEXT,
  valueStatement TEXT,
  authoredBy TEXT DEFAULT 'INFERRED',
  lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);

CREATE TABLE IF NOT EXISTS file_mutation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  sha256Hash TEXT NOT NULL,
  mutationType TEXT NOT NULL,
  changedFields TEXT,
  actor TEXT DEFAULT 'DEVELOPER',
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'INDEXER',
  action TEXT NOT NULL,
  targetFingerprint TEXT,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_file_registry_status ON file_registry(status);
CREATE INDEX IF NOT EXISTS idx_file_registry_sha256Hash ON file_registry(sha256Hash);
CREATE INDEX IF NOT EXISTS idx_file_registry_lifecycle ON file_registry(lifecyclePhase);
CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(sourceFingerprint);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(targetFingerprint);
CREATE INDEX IF NOT EXISTS idx_mutation_log_fingerprint ON file_mutation_log(fingerprint);
CREATE INDEX IF NOT EXISTS idx_mutation_log_timestamp ON file_mutation_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp);
`;
```

**Key changes:**
- `sha256_hash` → `sha256Hash` (camelCase)
- `file_size_bytes` → `fileSizeBytes` (camelCase)
- `reachability_score` → `reachabilityScore` (camelCase)
- `impact_radius` → `impactRadius` (camelCase)
- `source_fingerprint` → `sourceFingerprint` (camelCase)
- `target_fingerprint` → `targetFingerprint` (camelCase)
- `connection_type` → `connectionType` (camelCase)
- `import_specifier` → `importSpecifier` (camelCase)
- `is_resolved` → `isResolved` (camelCase)
- `confidence_score` → `confidenceScore` (camelCase)
- `last_verified` → `lastVerified` (camelCase)
- `depends_on_behavior` → `dependsOnBehavior` (camelCase)
- `value_statement` → `valueStatement` (camelCase)
- `authored_by` → `authoredBy` (camelCase)
- `last_updated` → `lastUpdated` (camelCase)
- `target_fingerprint` (activity_log) → `targetFingerprint` (camelCase)
- NEW columns: `lifecyclePhase`, `birthTimestamp`, `isEntryPoint`
- NEW table: `file_mutation_log`
- NEW indexes: `idx_file_registry_lifecycle`, `idx_mutation_log_fingerprint`, `idx_mutation_log_timestamp`

## 1B. persistence.js — Updated Methods

### upsertFile() — Replace entire method body

```javascript
upsertFile(file) {
    const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_registry
        (fingerprint, filepath, filename, sha256Hash, fileSizeBytes, status,
         reachabilityScore, impactRadius, lifecyclePhase, birthTimestamp,
         lastModified, lastIndexed, isEntryPoint)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    return stmt.run(
        file.fingerprint,
        file.filepath,
        file.filename,
        file.sha256Hash,
        file.fileSizeBytes || 0,
        file.status || 'RED',
        file.reachabilityScore || 0.0,
        file.impactRadius || 0,
        file.lifecyclePhase || 'DEVELOPMENT',
        file.birthTimestamp || new Date().toISOString(),
        file.lastModified || new Date().toISOString(),
        file.isEntryPoint ? 1 : 0
    );
}
```

### getAllFiles() — Now returns camelCase objects matching St8FileEntry

```javascript
getAllFiles() {
    const stmt = this.db.prepare('SELECT * FROM file_registry ORDER BY filepath');
    const rows = stmt.all();
    // SQLite returns columns as defined — camelCase columns come back camelCase
    // Add isEntryPoint boolean conversion
    return rows.map(row => ({
        ...row,
        isEntryPoint: Boolean(row.isEntryPoint)
    }));
}
```

### NEW: logMutation() method

```javascript
logMutation(mutation) {
    const stmt = this.db.prepare(`
        INSERT INTO file_mutation_log
        (fingerprint, sha256Hash, mutationType, changedFields, actor, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    return stmt.run(
        mutation.fingerprint,
        mutation.sha256Hash,
        mutation.mutationType,
        mutation.changedFields || '{}',
        mutation.actor || 'DEVELOPER',
        mutation.metadata || '{}'
    );
}
```

### NEW: getMutationLog() method

```javascript
getMutationLog(fingerprint, limit = 50) {
    const stmt = this.db.prepare(
        'SELECT * FROM file_mutation_log WHERE fingerprint = ? ORDER BY timestamp DESC LIMIT ?'
    );
    return stmt.all(fingerprint, limit);
}
```

### NEW: getMutationCount() method

```javascript
getMutationCount(fingerprint) {
    const stmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM file_mutation_log WHERE fingerprint = ?'
    );
    const result = stmt.get(fingerprint);
    return result.count;
}
```

### NEW: getLastMutation() method

```javascript
getLastMutation(fingerprint) {
    const stmt = this.db.prepare(
        'SELECT * FROM file_mutation_log WHERE fingerprint = ? ORDER BY timestamp DESC LIMIT 1'
    );
    return stmt.get(fingerprint) || null;
}
```

### NEW: registerConceptFile() method — Pre-code phase

```javascript
registerConceptFile(conceptEntry) {
    // Register a file that doesn't exist on disk yet
    // fingerprint is generated from filepath + current timestamp
    const { generateFingerprint } = require('./st8-types');
    const birthTimestamp = new Date().toISOString();
    const fingerprint = generateFingerprint(conceptEntry.filepath, birthTimestamp);

    const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_registry
        (fingerprint, filepath, filename, sha256Hash, fileSizeBytes, status,
         reachabilityScore, impactRadius, lifecyclePhase, birthTimestamp,
         lastModified, lastIndexed, isEntryPoint)
        VALUES (?, ?, ?, '', 0, 'CONCEPT', 0.0, 0, 'CONCEPT', ?, '', CURRENT_TIMESTAMP, 0)
    `);
    stmt.run(
        fingerprint,
        conceptEntry.filepath,
        conceptEntry.filename || path.basename(conceptEntry.filepath),
        birthTimestamp
    );

    // Log the concept creation mutation
    this.logMutation({
        fingerprint,
        sha256Hash: '',
        mutationType: 'CONCEPT',
        changedFields: JSON.stringify({ lifecyclePhase: [null, 'CONCEPT'] }),
        actor: conceptEntry.actor || 'DEVELOPER',
        metadata: JSON.stringify(conceptEntry)
    });

    return fingerprint;
}
```

### NEW: purgeDevelopmentData() method — Production phase

```javascript
purgeDevelopmentData(fingerprint) {
    // Archive and remove development-phase mutation data
    // Keeps only PRODUCTION-type mutations and the latest schema card

    // 1. Count what we're about to purge
    const countStmt = this.db.prepare(
        `SELECT COUNT(*) as count FROM file_mutation_log
         WHERE fingerprint = ? AND mutationType NOT IN ('PRODUCTION', 'PURGE')`
    );
    const { count } = countStmt.get(fingerprint);

    // 2. Delete development mutations
    const deleteStmt = this.db.prepare(
        `DELETE FROM file_mutation_log
         WHERE fingerprint = ? AND mutationType NOT IN ('PRODUCTION', 'PURGE')`
    );
    deleteStmt.run(fingerprint);

    // 3. Log the purge
    this.logMutation({
        fingerprint,
        sha256Hash: '',
        mutationType: 'PURGE',
        changedFields: JSON.stringify({ purgedMutations: count }),
        actor: 'INDEXER',
        metadata: '{}'
    });

    // 4. Update lifecycle phase
    const updateStmt = this.db.prepare(
        `UPDATE file_registry SET lifecyclePhase = 'PRODUCTION' WHERE fingerprint = ?`
    );
    updateStmt.run(fingerprint);

    return { purgedMutations: count };
}
```

### Updated: insertConnection() — camelCase column names

```javascript
insertConnection(conn) {
    const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO connections
        (sourceFingerprint, targetFingerprint, connectionType, importSpecifier,
         isResolved, confidenceScore, lastVerified)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(
        conn.sourceFingerprint,
        conn.targetFingerprint,
        conn.connectionType || 'IMPORT',
        conn.importSpecifier || null,
        conn.isResolved !== undefined ? (conn.isResolved ? 1 : 0) : 1,
        conn.confidenceScore || 1.0
    );
}
```

### Updated: getAllIntents() — camelCase column names

```javascript
getAllIntents() {
    const stmt = this.db.prepare('SELECT * FROM file_intent');
    const rows = stmt.all();
    const intents = {};
    for (const row of rows) {
        intents[row.fingerprint] = {
            purpose: row.purpose || '',
            dependsOnBehavior: row.dependsOnBehavior || '',
            valueStatement: row.valueStatement || '',
            authoredBy: row.authoredBy || 'INFERRED',
            lastUpdated: row.lastUpdated
        };
    }
    return intents;
}
```

### Updated: deleteFile() — camelCase column names

```javascript
deleteFile(filepath) {
    const file = this.getFileByPath(filepath);
    if (!file) return { changes: 0 };

    this.deleteConnectionsForFile(file.fingerprint);
    this.deleteIntentForFile(file.fingerprint);

    const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
    const result = stmt.run(filepath);
    return { changes: result.changes, fingerprint: file.fingerprint };
}
```

## 1C. indexer.js — Mirror the same ST8_SCHEMA

The `ST8_SCHEMA` constant in indexer.js (lines 78-129) must be replaced with the **exact same** schema as persistence.js. This is a duplication that exists because indexer.js can run standalone (CLI mode). Both copies MUST be identical.

Also add at the top of indexer.js:
```javascript
const { generateFingerprint } = require('./st8-types');
```

## 1D. indexer.js — Update indexDirectory() fingerprint generation

In `indexDirectory()` (around line 322-332), the hashedFiles map must add fingerprint and birthTimestamp:

```javascript
const hashedFiles = files.map(file => {
    const hash = hashFile(file);
    const stat = fs.statSync(file);
    const filepath = path.relative(targetDir, file);
    const birthTimestamp = stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString();
    return {
        filepath: filepath,
        filename: path.basename(file),
        sha256Hash: hash,
        fileSizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
        birthTimestamp: birthTimestamp,
        fingerprint: generateFingerprint(filepath, birthTimestamp),
        lifecyclePhase: 'DEVELOPMENT',
        isEntryPoint: false
    };
});
```

**Note:** `stat.birthtime` gives us the actual file creation time. On Linux this is `stat.mtime` (no true birthtime), but that's fine — it's set once at first index and never changes after that.

**Verification:**
```bash
cd /home/bozertron/1_AT_A_TIME/st8
rm -f st8.sqlite  # Delete old DB — schema incompatible
node -e "const {St8Persistence}=require('./backend/persistence'); const p=new St8Persistence(); p.initialize(); console.log('Schema OK'); p.close();"
# Expected: Schema OK
```


# ═══════════════════════════════════════════════════════════════
# PHASE 2: New Modules — SchemaCardEmitter + Printer + NotificationBus
# ═══════════════════════════════════════════════════════════════

**Depends on:** Phase 0 (st8-types.js)
**Files to create:**
- `backend/schemaCardEmitter.js`
- `backend/schemaCardPrinter.js`
- `backend/notificationBus.js`
- `.st8/schema-cards/` (directory)

## 2A. schemaCardEmitter.js

```javascript
#!/usr/bin/env node

/**
 * ST8 Schema Card Emitter
 *
 * Generates deterministic .st8/schema-card.json for each file.
 * Called after every index run and on every file change.
 * Schema cards are machine-readable, always in sync, and diffable in git.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { validateSt8SchemaCard, St8SchemaCard } = require('./st8-types');

class SchemaCardEmitter {
    constructor(targetDir, options = {}) {
        this.targetDir = targetDir;
        this.outputDir = options.outputDir || path.join(targetDir, '.st8', 'schema-cards');
        this.strict = options.strict || false;
        this._ensureOutputDir();
    }

    _ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Emit a schema card for a single file.
     * @param {object} file - St8FileEntry with all fields populated
     * @param {object} astResult - Output from astParser.extractImportsAndExports()
     * @param {object} connections - { importedBy: [], imports: [] }
     * @param {object} intent - { purpose, dependsOnBehavior, valueStatement }
     * @param {object} mutationSummary - { count, lastMutation }
     */
    emitCard(file, astResult, connections, intent, mutationSummary) {
        const card = {
            fingerprint: file.fingerprint,
            filepath: file.filepath,
            filename: file.filename,
            sha256Hash: file.sha256Hash,
            fileSizeBytes: file.fileSizeBytes,
            status: file.status,
            reachabilityScore: file.reachabilityScore,
            impactRadius: file.impactRadius,
            lifecyclePhase: file.lifecyclePhase || 'DEVELOPMENT',
            birthTimestamp: file.birthTimestamp,
            lastModified: file.lastModified,
            lastIndexed: file.lastIndexed,
            isEntryPoint: Boolean(file.isEntryPoint),

            exports: (astResult && astResult.exports) || [],
            imports: (astResult && astResult.imports) || [],

            connections: connections || { importedBy: [], imports: [] },
            intent: intent || { purpose: '', dependsOnBehavior: '', valueStatement: '' },

            mutationCount: (mutationSummary && mutationSummary.count) || 0,
            lastMutation: (mutationSummary && mutationSummary.lastMutation) || { type: '', actor: '', timestamp: '' }
        };

        // Validate against canonical shape
        const validation = validateSt8SchemaCard(card);
        if (!validation.valid) {
            console.warn(`[st8:emitter] Schema card validation warning for ${file.filepath}:`, validation.missing);
        }

        // Write deterministic JSON (sorted keys for consistent diffs)
        const outputPath = path.join(this.outputDir, this._cardFilename(file.filepath));
        fs.writeFileSync(outputPath, JSON.stringify(card, Object.keys(St8SchemaCard).sort(), 2));

        return card;
    }

    /**
     * Emit schema cards for all files.
     * @param {object} persistence - St8Persistence instance (must be initialized)
     */
    emitAllCards(persistence) {
        const { extractImportsAndExports } = require(path.join(__dirname, '..', 'lib', 'utils', 'astParser.js'));

        const files = persistence.getAllFiles();
        const allIntents = persistence.getAllIntents();
        let emitted = 0;
        let errors = 0;

        for (const file of files) {
            try {
                const fullPath = path.join(this.targetDir, file.filepath);
                let astResult = { imports: [], exports: [] };

                if (fs.existsSync(fullPath)) {
                    try {
                        astResult = extractImportsAndExports(fullPath);
                    } catch (e) {
                        // AST parsing failed — use empty result
                    }
                }

                const intent = allIntents[file.fingerprint] || null;
                const mutationCount = persistence.getMutationCount(file.fingerprint);
                const lastMutation = persistence.getLastMutation(file.fingerprint);

                // Build connections from DB
                const connections = { importedBy: [], imports: [] };
                // TODO: Add connection query when connections table uses camelCase

                this.emitCard(file, astResult, connections, intent, {
                    count: mutationCount,
                    lastMutation: lastMutation || { type: '', actor: '', timestamp: '' }
                });
                emitted++;
            } catch (err) {
                console.error(`[st8:emitter] Error emitting card for ${file.filepath}:`, err.message);
                errors++;
            }
        }

        console.log(`[st8:emitter] Emitted ${emitted} schema cards, ${errors} errors`);
        return { emitted, errors };
    }

    /**
     * Convert filepath to safe filename for schema card.
     * e.g., "backend/server.js" → "backend_server.js.json"
     */
    _cardFilename(filepath) {
        return filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json';
    }

    /**
     * Diff mode: compare current file state against last emitted schema card.
     * Returns { drift: boolean, differences: [...] }
     */
    diff(file, currentCard) {
        const outputPath = path.join(this.outputDir, this._cardFilename(file.filepath));
        if (!fs.existsSync(outputPath)) {
            return { drift: true, differences: ['No previous schema card found'] };
        }

        const previousCard = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
        const differences = [];

        for (const key of Object.keys(St8SchemaCard)) {
            if (JSON.stringify(previousCard[key]) !== JSON.stringify(currentCard[key])) {
                differences.push({
                    field: key,
                    previous: previousCard[key],
                    current: currentCard[key]
                });
            }
        }

        return { drift: differences.length > 0, differences };
    }
}

// ─── CLI ─────────────────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--diff')) {
        console.log('[st8:emitter] Diff mode not yet available from CLI — use programmatically');
        process.exit(0);
    }

    const targetDir = args[0] || process.cwd();
    const { St8Persistence } = require('./persistence');
    const persistence = new St8Persistence();
    persistence.initialize();

    const emitter = new SchemaCardEmitter(targetDir);
    const result = emitter.emitAllCards(persistence);
    persistence.close();

    process.exit(result.errors > 0 ? 1 : 0);
}

module.exports = { SchemaCardEmitter };
```

## 2B. schemaCardPrinter.js — .txt Fallback Emitter

```javascript
#!/usr/bin/env node

/**
 * ST8 Schema Card Printer — Human-Readable Fallback
 *
 * Emits .txt files to .planning/st8_identity_system/ directory.
 * This is the fallback output for when the st8 visual system is offline.
 * Files follow naming convention: {timestamp}_{sanitized-filename}.txt
 *
 * Each file contains:
 * - Identity header (fingerprint, birth timestamp, lifecycle phase)
 * - Content version (sha256Hash)
 * - Exports (name, kind, signature, returnType)
 * - Imports (source, specifiers, importType)
 * - Connections (importedBy, imports)
 * - Intent (purpose, dependsOnBehavior, valueStatement)
 * - Mutation summary (count, last mutation type/actor/timestamp)
 */

'use strict';

const path = require('path');
const fs = require('fs');

class SchemaCardPrinter {
    constructor(targetDir, options = {}) {
        this.targetDir = targetDir;
        // Default output: .planning/st8_identity_system/
        this.outputDir = options.outputDir ||
            path.join(targetDir, '.planning', 'st8_identity_system');
        this._ensureOutputDir();
    }

    _ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Print a schema card as a human-readable .txt file.
     * @param {object} card - St8SchemaCard object
     */
    printCard(card) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = card.filepath.replace(/\//g, '_').replace(/\\/g, '_');
        const filename = `${timestamp}_${safeName}.txt`;
        const outputPath = path.join(this.outputDir, filename);

        const lines = [];

        lines.push('═'.repeat(72));
        lines.push(`  ST8 IDENTITY CARD — ${card.filepath}`);
        lines.push('═'.repeat(72));
        lines.push('');

        // Identity
        lines.push('┌─ IDENTITY ──────────────────────────────────────────────────┐');
        lines.push(`  Fingerprint:      ${card.fingerprint}`);
        lines.push(`  Filepath:         ${card.filepath}`);
        lines.push(`  Filename:         ${card.filename}`);
        lines.push(`  Birth Timestamp:  ${card.birthTimestamp}`);
        lines.push(`  Lifecycle Phase:  ${card.lifecyclePhase}`);
        lines.push(`  Is Entry Point:   ${card.isEntryPoint}`);
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Content Version
        lines.push('┌─ CONTENT VERSION ──────────────────────────────────────────┐');
        lines.push(`  SHA-256 Hash:     ${card.sha256Hash}`);
        lines.push(`  File Size:        ${card.fileSizeBytes} bytes`);
        lines.push(`  Last Modified:    ${card.lastModified}`);
        lines.push(`  Last Indexed:     ${card.lastIndexed}`);
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Classification
        lines.push('┌─ CLASSIFICATION ───────────────────────────────────────────┐');
        lines.push(`  Status:           ${card.status}`);
        lines.push(`  Reachability:     ${card.reachabilityScore}`);
        lines.push(`  Impact Radius:    ${card.impactRadius}`);
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Exports
        lines.push('┌─ EXPORTS ──────────────────────────────────────────────────┐');
        if (card.exports && card.exports.length > 0) {
            for (const exp of card.exports) {
                const sig = exp.signature ? ` — ${exp.signature}` : '';
                const ret = exp.returnType ? `: ${exp.returnType}` : '';
                lines.push(`  ${exp.kind.padEnd(12)} ${exp.name}${sig}${ret}`);
            }
        } else {
            lines.push('  (none)');
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Imports
        lines.push('┌─ IMPORTS ──────────────────────────────────────────────────┐');
        if (card.imports && card.imports.length > 0) {
            for (const imp of card.imports) {
                const names = imp.specifiers && imp.specifiers.length > 0
                    ? ` {${imp.specifiers.map(s => s.name || s).join(', ')}}`
                    : '';
                lines.push(`  ${(imp.importType || 'named').padEnd(12)} ${imp.source}${names}`);
            }
        } else {
            lines.push('  (none)');
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Connections
        lines.push('┌─ CONNECTIONS ──────────────────────────────────────────────┐');
        if (card.connections) {
            if (card.connections.importedBy && card.connections.importedBy.length > 0) {
                lines.push(`  Imported by:      ${card.connections.importedBy.join(', ')}`);
            }
            if (card.connections.imports && card.connections.imports.length > 0) {
                lines.push(`  Imports:          ${card.connections.imports.join(', ')}`);
            }
            if ((!card.connections.importedBy || card.connections.importedBy.length === 0) &&
                (!card.connections.imports || card.connections.imports.length === 0)) {
                lines.push('  (none)');
            }
        } else {
            lines.push('  (none)');
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Intent
        lines.push('┌─ INTENT ───────────────────────────────────────────────────┐');
        if (card.intent) {
            lines.push(`  Purpose:          ${card.intent.purpose || '(not set)'}`);
            lines.push(`  Depends On:       ${card.intent.dependsOnBehavior || '(not set)'}`);
            lines.push(`  Value Statement:  ${card.intent.valueStatement || '(not set)'}`);
        } else {
            lines.push('  (not set)');
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Mutations
        lines.push('┌─ MUTATIONS ────────────────────────────────────────────────┐');
        lines.push(`  Total Mutations:  ${card.mutationCount || 0}`);
        if (card.lastMutation && card.lastMutation.type) {
            lines.push(`  Last Mutation:    ${card.lastMutation.type} by ${card.lastMutation.actor}`);
            lines.push(`  Last Timestamp:   ${card.lastMutation.timestamp}`);
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push('');

        fs.writeFileSync(outputPath, lines.join('\n'));

        // Also write/update a "latest" version (overwrites on each emission)
        const latestPath = path.join(this.outputDir, `LATEST_${safeName}.txt`);
        fs.writeFileSync(latestPath, lines.join('\n'));

        return { path: outputPath, latestPath };
    }

    /**
     * Print all schema cards from .st8/schema-cards/ directory.
     */
    printAllFromCards(schemaCardsDir) {
        if (!fs.existsSync(schemaCardsDir)) {
            console.error('[st8:printer] Schema cards directory not found:', schemaCardsDir);
            return { printed: 0, errors: 0 };
        }

        const files = fs.readdirSync(schemaCardsDir).filter(f => f.endsWith('.json'));
        let printed = 0;
        let errors = 0;

        for (const file of files) {
            try {
                const card = JSON.parse(fs.readFileSync(path.join(schemaCardsDir, file), 'utf-8'));
                this.printCard(card);
                printed++;
            } catch (err) {
                console.error(`[st8:printer] Error printing ${file}:`, err.message);
                errors++;
            }
        }

        console.log(`[st8:printer] Printed ${printed} cards, ${errors} errors`);
        return { printed, errors };
    }
}

module.exports = { SchemaCardPrinter };
```

## 2C. notificationBus.js

```javascript
#!/usr/bin/env node

/**
 * ST8 Notification Bus
 *
 * Event-driven notification system for file mutations.
 * - EventEmitter for in-process subscribers
 * - SSE endpoint for frontend consumers
 * - Console output as immediate feedback
 * - Delegates to SchemaCardPrinter for .txt fallback
 */

'use strict';

const { EventEmitter } = require('events');

class NotificationBus extends EventEmitter {
    constructor(options = {}) {
        super();
        this.sseClients = new Set();
        this.printer = null; // Set later via setPrinter()
        this.maxSseClients = options.maxSseClients || 10;
    }

    setPrinter(printer) {
        this.printer = printer;
    }

    /**
     * Publish a mutation event.
     * Triggers: EventEmitter → SSE → Console → Printer fallback
     */
    publish(event) {
        const enriched = {
            ...event,
            publishedAt: new Date().toISOString()
        };

        // 1. EventEmitter for in-process subscribers
        this.emit('mutation', enriched);
        this.emit(`mutation:${event.mutationType}`, enriched);

        // 2. SSE for frontend consumers
        this._broadcastSSE(enriched);

        // 3. Console output
        const status = event.mutationType === 'EDIT' ? '✎' :
                       event.mutationType === 'CREATE' ? '+' :
                       event.mutationType === 'CONCEPT' ? '◈' :
                       event.mutationType === 'LOCK' ? '⊘' :
                       event.mutationType === 'PRODUCTION' ? '★' : '·';
        console.log(`[st8:notify] ${status} ${event.filepath || event.fingerprint} — ${event.mutationType} by ${event.actor}`);

        // 4. Printer fallback (writes .txt to .planning/st8_identity_system/)
        if (this.printer && event.schemaCard) {
            try {
                this.printer.printCard(event.schemaCard);
            } catch (err) {
                console.error('[st8:notify] Printer fallback failed:', err.message);
            }
        }
    }

    // ─── SSE ──────────────────────────────────────────────────

    addSSEClient(res) {
        if (this.sseClients.size >= this.maxSseClients) {
            res.writeHead(503);
            res.end('Too many SSE clients');
            return false;
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

        this.sseClients.add(res);

        res.on('close', () => {
            this.sseClients.delete(res);
        });

        return true;
    }

    _broadcastSSE(event) {
        const data = JSON.stringify(event);
        for (const client of this.sseClients) {
            try {
                client.write(`data: ${data}\n\n`);
            } catch (err) {
                this.sseClients.delete(client);
            }
        }
    }
}

// Singleton instance
const notificationBus = new NotificationBus();

module.exports = { NotificationBus, notificationBus };
```


# ═══════════════════════════════════════════════════════════════
# PHASE 3: Integration Wiring
# ═══════════════════════════════════════════════════════════════

**Depends on:** Phase 1 + Phase 2
**Files to modify:**
- `backend/index.js` — Wire mutation logging + schema card emission + notifications
- `backend/server.js` — Add SSE endpoint + fix _handleVerify + fix fingerprint usage
- `backend/fileWatcher.js` — Wire mutation + emission hooks into change callback

## 3A. index.js — Wire the Full Pipeline

### Add imports at top (after existing requires on lines 13-18):

```javascript
const { generateFingerprint, MutationType, ActorType } = require('./st8-types');
const { SchemaCardEmitter } = require('./schemaCardEmitter');
const { SchemaCardPrinter } = require('./schemaCardPrinter');
const { notificationBus } = require('./notificationBus');
```

### Modify the initial indexing loop (lines 83-115):

Replace `fingerprint: file.sha256Hash` with the stable identity:

```javascript
for (const file of result.files) {
    persistence.upsertFile({
        fingerprint: file.fingerprint,     // NOW uses stable identity
        filepath: file.filepath,
        filename: file.filename,
        sha256Hash: file.sha256Hash,
        fileSizeBytes: file.fileSizeBytes,
        status: file.status,
        reachabilityScore: file.reachabilityScore,
        impactRadius: file.impactRadius,
        lifecyclePhase: file.lifecyclePhase || 'DEVELOPMENT',
        birthTimestamp: file.birthTimestamp || new Date().toISOString(),
        lastModified: file.lastModified,
        isEntryPoint: false
    });

    // Log CREATE mutation for each file
    persistence.logMutation({
        fingerprint: file.fingerprint,
        sha256Hash: file.sha256Hash,
        mutationType: 'CREATE',
        changedFields: '{}',
        actor: 'INDEXER',
        metadata: '{}'
    });

    // Wire connections (camelCase field names)
    if (file.imports && file.imports.length > 0) {
        for (const imp of file.imports) {
            const targetFile = result.files.find(f =>
                f.filepath.endsWith(imp.source) ||
                f.filepath.includes(imp.source.replace(/^\.\//, ''))
            );
            if (targetFile) {
                persistence.insertConnection({
                    sourceFingerprint: file.fingerprint,
                    targetFingerprint: targetFile.fingerprint,
                    connectionType: 'IMPORT',
                    importSpecifier: imp.source,
                    isResolved: true,
                    confidenceScore: 1.0
                });
            }
        }
    }
}
```

### After manifest generation (after line 129), add schema card emission:

```javascript
// Emit schema cards
const emitter = new SchemaCardEmitter(targetDir);
const printer = new SchemaCardPrinter(targetDir);
notificationBus.setPrinter(printer);
emitter.emitAllCards(persistence);
printer.printAllFromCards(path.join(targetDir, '.st8', 'schema-cards'));
console.log('[st8] Schema cards emitted');
```

### Modify the file watcher onFileChange callback (lines 138-215):

The `add` handler must generate a stable fingerprint:

```javascript
if (change.type === 'add') {
    try {
        const content = require('fs').readFileSync(change.path);
        const hash = require('crypto').createHash('sha256').update(content).digest('hex');
        const stat = require('fs').statSync(change.path);
        const birthTimestamp = stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString();
        const fingerprint = generateFingerprint(relativePath, birthTimestamp);

        const newFile = {
            fingerprint: fingerprint,
            filepath: relativePath,
            filename: path.basename(change.path),
            sha256Hash: hash,
            fileSizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
            birthTimestamp: birthTimestamp,
            imports: [],
            importedBy: [],
            status: 'RED',
            reachabilityScore: 0.0,
            impactRadius: 0,
            lifecyclePhase: 'DEVELOPMENT',
            isEntryPoint: false
        };

        result.files.push(newFile);
        persistence.upsertFile(newFile);

        persistence.logMutation({
            fingerprint: fingerprint,
            sha256Hash: hash,
            mutationType: 'CREATE',
            changedFields: '{}',
            actor: 'WATCHER',
            metadata: '{}'
        });

        notificationBus.publish({
            fingerprint: fingerprint,
            filepath: relativePath,
            mutationType: 'CREATE',
            actor: 'WATCHER',
            sha256Hash: hash
        });

        anyChanged = true;
    } catch (err) {
        console.error(`[st8] Failed to index new file ${relativePath}:`, err.message);
    }
}
```

The `change` handler must log mutations and emit schema cards:

```javascript
else {
    const changedFile = result.files.find(f => f.filepath === relativePath);
    if (changedFile) {
        try {
            const newHash = require('crypto')
                .createHash('sha256')
                .update(require('fs').readFileSync(change.path))
                .digest('hex');
            if (newHash !== changedFile.sha256Hash) {
                const oldHash = changedFile.sha256Hash;
                changedFile.sha256Hash = newHash;
                changedFile.lastModified = new Date().toISOString();
                persistence.upsertFile(changedFile);

                persistence.logMutation({
                    fingerprint: changedFile.fingerprint,
                    sha256Hash: newHash,
                    mutationType: 'EDIT',
                    changedFields: JSON.stringify({ sha256Hash: [oldHash, newHash] }),
                    actor: 'WATCHER',
                    metadata: '{}'
                });

                notificationBus.publish({
                    fingerprint: changedFile.fingerprint,
                    filepath: relativePath,
                    mutationType: 'EDIT',
                    actor: 'WATCHER',
                    sha256Hash: newHash
                });

                // Emit updated schema card
                const card = emitter.emitCard(changedFile, { imports: [], exports: [] },
                    { importedBy: [], imports: [] }, null,
                    { count: persistence.getMutationCount(changedFile.fingerprint),
                      lastMutation: persistence.getLastMutation(changedFile.fingerprint) });

                notificationBus.publish({
                    fingerprint: changedFile.fingerprint,
                    filepath: relativePath,
                    mutationType: 'EDIT',
                    actor: 'WATCHER',
                    sha256Hash: newHash,
                    schemaCard: card  // Triggers .txt fallback
                });

                anyChanged = true;
            }
        } catch (err) {
            console.error(`[st8] Failed to hash ${relativePath}:`, err.message);
        }
    }
}
```

## 3B. server.js — Add SSE Endpoint + Fix Fingerprint + Fix _handleVerify

### Add SSE endpoint to route handler (in the switch statement around line 91):

```javascript
case '/api/mutations':
    this._handleMutationsSSE(req, res);
    break;
```

### Add the SSE handler method:

```javascript
_handleMutationsSSE(req, res) {
    const { notificationBus } = require('./notificationBus');
    notificationBus.addSSEClient(res);
}
```

### Fix _handleVerify (lines 484-525): Replace snake_case field access

Replace all `file.sha256_hash` with `file.sha256Hash`
Replace all `file.file_size_bytes` with `file.fileSizeBytes`

### Fix _handleIndex and _handleFileIntent: Replace fingerprint derivation

Replace `const fp = file.fingerprint || file.sha256Hash;` with just `file.fingerprint`
(Now that fingerprint is always set, the fallback is unnecessary)

## 3C. fileWatcher.js — No structural changes needed

The fileWatcher already calls the `onFileChange` callback on every event.
The mutation logging and schema card emission happen in index.js's callback.
No changes to fileWatcher.js itself are required — the hook is already in place.


# ═══════════════════════════════════════════════════════════════
# PHASE 4: Codebase Normalization
# ═══════════════════════════════════════════════════════════════

**Depends on:** Phase 1
**Goal:** Replace ALL snake_case references with camelCase across the entire codebase

## 4A. Complete Renaming Map

### persistence.js — ALL SQL statements and method bodies

| Old (snake_case) | New (camelCase) | Locations |
|-----------------|-----------------|-----------|
| `sha256_hash` | `sha256Hash` | ST8_SCHEMA, upsertFile, getFileByPath, getFilesByStatus, getAllFiles, _handleVerify references |
| `file_size_bytes` | `fileSizeBytes` | ST8_SCHEMA, upsertFile |
| `reachability_score` | `reachabilityScore` | ST8_SCHEMA, upsertFile |
| `impact_radius` | `impactRadius` | ST8_SCHEMA, upsertFile |
| `source_fingerprint` | `sourceFingerprint` | ST8_SCHEMA, insertConnection, deleteConnectionsForFile |
| `target_fingerprint` | `targetFingerprint` | ST8_SCHEMA, insertConnection, deleteConnectionsForFile |
| `connection_type` | `connectionType` | ST8_SCHEMA, insertConnection |
| `import_specifier` | `importSpecifier` | ST8_SCHEMA, insertConnection |
| `is_resolved` | `isResolved` | ST8_SCHEMA, insertConnection |
| `confidence_score` | `confidenceScore` | ST8_SCHEMA, insertConnection |
| `last_verified` | `lastVerified` | ST8_SCHEMA |
| `depends_on_behavior` | `dependsOnBehavior` | ST8_SCHEMA, getAllIntents, setIntent |
| `value_statement` | `valueStatement` | ST8_SCHEMA, getAllIntents, setIntent |
| `authored_by` | `authoredBy` | ST8_SCHEMA, getAllIntents, setIntent |
| `last_updated` (intent) | `lastUpdated` | ST8_SCHEMA |
| `target_fingerprint` (activity_log) | `targetFingerprint` | ST8_SCHEMA, logActivity |
| `idx_file_registry_sha256` | `idx_file_registry_sha256Hash` | ST8_SCHEMA |

### indexer.js — ST8_SCHEMA constant

Same column renaming as persistence.js. Both schemas MUST be identical.

### server.js — _handleVerify method

| Old | New |
|-----|-----|
| `file.sha256_hash` | `file.sha256Hash` |
| `file.file_size_bytes` | `file.fileSizeBytes` |
| `file.fingerprint \|\| file.sha256Hash` | `file.fingerprint` |

### manifestGenerator.js

No column references (works with JS objects, not SQL). But verify all object property access uses camelCase.

## 4B. Migration Strategy

Since st8 is pre-production, the simplest approach:

```bash
# Delete the old database (schema is incompatible)
rm -f /home/bozertron/1_AT_A_TIME/st8/st8.sqlite
```

The next `node index.js` run will create a fresh DB with the new schema.

For any existing deployments, provide a migration script:

```javascript
// migrate-schema.js — One-shot migration
const Database = require('better-sqlite3');
const db = new Database('st8.sqlite');

// Rename columns using the ALTER TABLE RENAME COLUMN syntax (SQLite 3.25+)
const renames = [
    ['file_registry', 'sha256_hash', 'sha256Hash'],
    ['file_registry', 'file_size_bytes', 'fileSizeBytes'],
    ['file_registry', 'reachability_score', 'reachabilityScore'],
    ['file_registry', 'impact_radius', 'impactRadius'],
    ['connections', 'source_fingerprint', 'sourceFingerprint'],
    ['connections', 'target_fingerprint', 'targetFingerprint'],
    ['connections', 'connection_type', 'connectionType'],
    ['connections', 'import_specifier', 'importSpecifier'],
    ['connections', 'is_resolved', 'isResolved'],
    ['connections', 'confidence_score', 'confidenceScore'],
    ['connections', 'last_verified', 'lastVerified'],
    ['file_intent', 'depends_on_behavior', 'dependsOnBehavior'],
    ['file_intent', 'value_statement', 'valueStatement'],
    ['file_intent', 'authored_by', 'authoredBy'],
    ['file_intent', 'last_updated', 'lastUpdated'],
    ['activity_log', 'target_fingerprint', 'targetFingerprint'],
];

for (const [table, oldCol, newCol] of renames) {
    try {
        db.exec(`ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`);
        console.log(`✓ ${table}.${oldCol} → ${newCol}`);
    } catch (e) {
        console.log(`✗ ${table}.${oldCol}: ${e.message}`);
    }
}

// Add new columns
try {
    db.exec(`ALTER TABLE file_registry ADD COLUMN lifecyclePhase TEXT DEFAULT 'DEVELOPMENT'`);
    db.exec(`ALTER TABLE file_registry ADD COLUMN birthTimestamp TEXT`);
    db.exec(`ALTER TABLE file_registry ADD COLUMN isEntryPoint INTEGER DEFAULT 0`);
    console.log('✓ New columns added to file_registry');
} catch (e) {
    console.log('✗ New columns:', e.message);
}

// Create new table
try {
    db.exec(`CREATE TABLE IF NOT EXISTS file_mutation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fingerprint TEXT NOT NULL,
        sha256Hash TEXT NOT NULL,
        mutationType TEXT NOT NULL,
        changedFields TEXT,
        actor TEXT DEFAULT 'DEVELOPER',
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
    )`);
    console.log('✓ file_mutation_log table created');
} catch (e) {
    console.log('✗ file_mutation_log:', e.message);
}

db.close();
console.log('Migration complete.');
```


# ═══════════════════════════════════════════════════════════════
# PHASE 5: Bootstrap — Apply System to st8 Itself
# ═══════════════════════════════════════════════════════════════

**Depends on:** Phase 2 + 3 + 4
**Goal:** Run the identity system on the st8 codebase and verify full lifecycle

## 5A. Delete old DB and run fresh index

```bash
cd /home/bozertron/1_AT_A_TIME/st8
rm -f st8.sqlite
node backend/index.js . --watch --serve --port 3847
```

This will:
1. Discover all .js files in the project
2. Hash each file with SHA-256
3. Generate stable fingerprints (filepath:birthTimestamp)
4. Store in SQLite with camelCase columns
5. Emit `.st8/schema-cards/*.json` for each file
6. Print `.txt` fallbacks to `.planning/st8_identity_system/`
7. Start watching for changes
8. Start HTTP server

## 5B. Verify Schema Cards Were Emitted

```bash
ls -la .st8/schema-cards/
# Should see one .json file per backend + frontend .js file

ls -la .planning/st8_identity_system/
# Should see LATEST_*.txt files and timestamped_*.txt files
```

## 5C. Verify Mutation Logging

```bash
# Make a change to any file
echo "// test mutation" >> backend/fileWatcher.js

# Wait 1-2 seconds (debounce), then check mutation log
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const fw = files.find(f => f.filepath.includes('fileWatcher'));
if (fw) {
    console.log('Mutation count:', p.getMutationCount(fw.fingerprint));
    console.log('Last mutation:', p.getLastMutation(fw.fingerprint));
}
p.close();
"
```

Expected: mutation count >= 1, lastMutation.type = 'EDIT'

## 5D. Revert the test mutation

```bash
# Remove the test comment
git checkout backend/fileWatcher.js
```

## 5E. Register Concept Files (Pre-code Phase)

```javascript
// test-concept.js — Verify pre-code concept registration
const { St8Persistence } = require('./backend/persistence');
const { LifecyclePhase } = require('./backend/st8-types');

const p = new St8Persistence();
p.initialize();

// Register a file that doesn't exist yet
const fp = p.registerConceptFile({
    filepath: 'backend/schemaValidator.js',
    filename: 'schemaValidator.js',
    actor: 'DEVELOPER'
});

console.log('Concept fingerprint:', fp);

// Verify it's in the DB
const file = p.getFileByPath('backend/schemaValidator.js');
console.log('Status:', file.status);           // 'CONCEPT'
console.log('Lifecycle:', file.lifecyclePhase); // 'CONCEPT'
console.log('SHA-256:', file.sha256Hash);       // '' (no content yet)

// Check mutation log
console.log('Mutations:', p.getMutationLog(fp));
p.close();
```

## 5F. MVP Lock Phase

```javascript
// test-mvp-lock.js — Verify MVP Lock transition
const { St8Persistence } = require('./backend/persistence');
const { MutationType } = require('./backend/st8-types');

const p = new St8Persistence();
p.initialize();

// Get all files
const files = p.getAllFiles();

// Transition each file to LOCKED
for (const file of files) {
    p.db.prepare(
        `UPDATE file_registry SET lifecyclePhase = 'LOCKED' WHERE fingerprint = ?`
    ).run(file.fingerprint);

    p.logMutation({
        fingerprint: file.fingerprint,
        sha256Hash: file.sha256Hash,
        mutationType: 'LOCK',
        changedFields: JSON.stringify({ lifecyclePhase: [file.lifecyclePhase, 'LOCKED'] }),
        actor: 'DEVELOPER',
        metadata: '{}'
    });
}

console.log(`Locked ${files.length} files`);
p.close();
```

## 5G. Generate PRD from Schema Cards

```javascript
// generate-prd.js — PRD falls out of schema cards
const fs = require('fs');
const path = require('path');

const cardsDir = '.st8/schema-cards';
const cards = fs.readdirSync(cardsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(cardsDir, f), 'utf-8')));

let prd = '# ST8 Product Requirements Document\n';
prd += `Generated: ${new Date().toISOString()}\n`;
prd += `Total Files: ${cards.length}\n\n`;

// Group by lifecycle phase
const byPhase = {};
for (const card of cards) {
    const phase = card.lifecyclePhase || 'UNKNOWN';
    if (!byPhase[phase]) byPhase[phase] = [];
    byPhase[phase].push(card);
}

for (const [phase, phaseCards] of Object.entries(byPhase)) {
    prd += `## Phase: ${phase} (${phaseCards.length} files)\n\n`;
    for (const card of phaseCards) {
        prd += `### ${card.filepath}\n`;
        prd += `- **Fingerprint:** ${card.fingerprint}\n`;
        prd += `- **Status:** ${card.status}\n`;
        prd += `- **Purpose:** ${card.intent?.purpose || '(not set)'}\n`;

        if (card.exports && card.exports.length > 0) {
            prd += `- **Exports:**\n`;
            for (const exp of card.exports) {
                prd += `  - ${exp.kind} \`${exp.name}\``;
                if (exp.signature) prd += ` — \`${exp.signature}\``;
                if (exp.returnType) prd += ` → ${exp.returnType}`;
                prd += '\n';
            }
        }

        if (card.imports && card.imports.length > 0) {
            prd += `- **Dependencies:** ${card.imports.map(i => i.source).join(', ')}\n`;
        }

        prd += `\n`;
    }
}

fs.writeFileSync('.planning/st8_identity_system/PRD.md', prd);
console.log('PRD written to .planning/st8_identity_system/PRD.md');
```


# ═══════════════════════════════════════════════════════════════
# PHASE 6: Advanced Features
# ═══════════════════════════════════════════════════════════════

**Depends on:** Phase 5
**Goal:** Full lifecycle support — concept → lock → wiring → development → production

## 6A. Pre-code Concept Phase — Full Implementation

**New API endpoint:** `POST /api/concept-file`

```javascript
// In server.js — add to route switch
case '/api/concept-file':
    this._handleConceptFile(req, res);
    break;
```

```javascript
_handleConceptFile(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const { filepath, purpose, dependsOnBehavior, valueStatement } = JSON.parse(body);

            if (!filepath) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'filepath is required' }));
                return;
            }

            const persistence = new St8Persistence();
            persistence.initialize();

            const fingerprint = persistence.registerConceptFile({
                filepath,
                filename: path.basename(filepath),
                actor: 'DEVELOPER'
            });

            // Also set intent if provided
            if (purpose || dependsOnBehavior || valueStatement) {
                persistence.setIntent(fingerprint, {
                    purpose: purpose || '',
                    dependsOnBehavior: dependsOnBehavior || '',
                    valueStatement: valueStatement || ''
                });
            }

            persistence.close();

            notificationBus.publish({
                fingerprint,
                filepath,
                mutationType: 'CONCEPT',
                actor: 'DEVELOPER'
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', fingerprint, lifecyclePhase: 'CONCEPT' }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}
```

**Usage from frontend:**
```javascript
fetch('/api/concept-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        filepath: 'backend/schemaValidator.js',
        purpose: 'Validates St8FileEntry objects against canonical type definitions',
        dependsOnBehavior: 'st8-types.js export shape',
        valueStatement: 'Prevents malformed data from entering the persistence layer'
    })
});
```

## 6B. MVP Lock Phase — Batch Transition Endpoint

**New API endpoint:** `POST /api/mvp-lock`

```javascript
_handleMvpLock(req, res) {
    const persistence = new St8Persistence();
    persistence.initialize();

    const files = persistence.getAllFiles();
    const results = [];

    for (const file of files) {
        if (file.lifecyclePhase === 'CONCEPT' || file.lifecyclePhase === 'DEVELOPMENT') {
            persistence.db.prepare(
                `UPDATE file_registry SET lifecyclePhase = 'LOCKED' WHERE fingerprint = ?`
            ).run(file.fingerprint);

            persistence.logMutation({
                fingerprint: file.fingerprint,
                sha256Hash: file.sha256Hash,
                mutationType: 'LOCK',
                changedFields: JSON.stringify({ lifecyclePhase: [file.lifecyclePhase, 'LOCKED'] }),
                actor: 'DEVELOPER',
                metadata: '{}'
            });

            results.push({ fingerprint: file.fingerprint, filepath: file.filepath, previousPhase: file.lifecyclePhase });
        }
    }

    // Re-emit all schema cards with LOCKED phase
    const emitter = new SchemaCardEmitter(this.targetDir);
    emitter.emitAllCards(persistence);

    persistence.close();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', lockedFiles: results.length, files: results }));
}
```

## 6C. PRD Generation from Schema Cards

The PRD generator script from Phase 5F should be integrated as a server endpoint:

**New API endpoint:** `GET /api/prd`

Returns the PRD markdown generated from all current schema cards. This is computed on-the-fly from the `.st8/schema-cards/` directory — no cached version.

## 6D. Production Purge

**New API endpoint:** `POST /api/production-promote`

```javascript
_handleProductionPromote(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const { fingerprint } = JSON.parse(body);
            const persistence = new St8Persistence();
            persistence.initialize();

            const result = persistence.purgeDevelopmentData(fingerprint);

            persistence.close();

            notificationBus.publish({
                fingerprint,
                mutationType: 'PRODUCTION',
                actor: 'DEVELOPER'
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', ...result }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}
```

## 6E. Frontend Notification UI — SSE Integration

**In st8.html or void-engine.js**, add an EventSource listener:

```javascript
// Connect to mutation notification stream
const mutationSource = new EventSource('http://localhost:3847/api/mutations');

mutationSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('[st8] Mutation:', data.mutationType, data.filepath);

    // Display notification in st8 UI
    // This is where the visual system would show:
    // - File change indicator
    // - Mutation type badge
    // - Timestamp
    // - Actor attribution
};

mutationSource.onerror = () => {
    console.warn('[st8] Mutation stream disconnected — will auto-reconnect');
};
```

**Fallback when UI is offline:** The `.txt` files in `.planning/st8_identity_system/` serve as the persistent record. The `LATEST_*.txt` files are always overwritten with the current state, while timestamped files provide the audit trail.

---

# ═══════════════════════════════════════════════════════════════
# .gitignore ADDITIONS
# ═══════════════════════════════════════════════════════════════

Add these lines to `.gitignore`:

```
# ST8 Identity System
.st8/
```

The `.st8/` directory (schema cards) is generated from source and should not be committed.
The `.planning/st8_identity_system/` directory SHOULD be committed — it's the human-readable fallback.
