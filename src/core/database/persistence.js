#!/usr/bin/env node

/**
 * ST8 Persistence — SQLite Database Layer
 * 
 * References maestro-scaffolder-tool code for database operations.
 * DO NOT copy files from maestro. Import/require by path.
 * 
 * This module provides a simple SQLite persistence layer for st8's
 * file registry, connections, intent, and activity log.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { St8FileEntry, LifecyclePhase, FileStatus } = require('../../shared/types/st8-types');

// ─── LIB CODE REFERENCES ─────────────────────────────────────
// Post-move: graph-persister.js now lives alongside this file in
// src/core/database/. The dynamic-loader pattern is preserved (graceful
// fallback on missing module) but LIB_DIR now points at the local directory.

const LIB_DIR = __dirname;

let _databasePersister = null;

function loadLibModule(modulePath) {
    try {
        const fullPath = path.join(LIB_DIR, modulePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Lib module not found: ${fullPath}`);
        }
        return require(fullPath);
    } catch (err) {
        console.error(`[st8:persistence] Failed to load lib module: ${modulePath}`, err.message);
        return null;
    }
}

function getDatabasePersister() {
    if (!_databasePersister) {
        _databasePersister = loadLibModule('graph-persister.js');
    }
    return _databasePersister;
}

// ─── ST8 SCHEMA ──────────────────────────────────────────────

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
  isEntryPoint INTEGER DEFAULT 0,
  lastAccessed TEXT,
  sessionsSinceAccess INTEGER DEFAULT 0,
  expiryDate TEXT,
  associatedWith TEXT,
  eventTrigger TEXT,
  brunoStatus TEXT DEFAULT 'active',
  needsAIReview INTEGER DEFAULT 0,
  tripleAtCount INTEGER DEFAULT 0,
  aiContentInjected INTEGER DEFAULT 0,
  templateVariables TEXT,
  hasUnfilledVariables INTEGER DEFAULT 0
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
  FOREIGN KEY (targetFingerprint) REFERENCES file_registry(fingerprint),
  UNIQUE(sourceFingerprint, targetFingerprint, connectionType)
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

CREATE TABLE IF NOT EXISTS st8_settings (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, key)
);

CREATE TABLE IF NOT EXISTS prd_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  template TEXT NOT NULL,
  variables TEXT,
  created TEXT DEFAULT CURRENT_TIMESTAMP,
  updated TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prd_projects_name ON prd_projects(name);

CREATE TABLE IF NOT EXISTS ai_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filepath TEXT NOT NULL,
  content TEXT NOT NULL,
  reviewed INTEGER DEFAULT 0,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_content_filepath ON ai_content(filepath);
CREATE INDEX IF NOT EXISTS idx_ai_content_reviewed ON ai_content(reviewed);
CREATE INDEX IF NOT EXISTS idx_file_registry_bruno ON file_registry(brunoStatus);
CREATE INDEX IF NOT EXISTS idx_file_registry_ai_review ON file_registry(needsAIReview);
CREATE INDEX IF NOT EXISTS idx_file_registry_unfilled ON file_registry(hasUnfilledVariables);

-- ─── TICKETS ───────────────────────────────────────────────
-- Human-written notes about a file's bug-juice, ready to be picked up
-- by an LLM collaborator. Each ticket pins the file's identity at the
-- moment the ticket was created (fingerprint + sha256 + status) so a
-- later resolution can verify what changed.
--
-- Lifecycle:
--   created -> [optional: claimed by LLM] -> resolved
--
-- The intent is for the LLM colleague (e.g. via the docs/Sonic
-- shared-disk channel) to read open tickets, post a resolution,
-- mark resolvedAt. st8's UI shows the count of open tickets as a
-- badge on the phreak> terminal's "Ticket" button.
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,                  -- file at moment of ticket creation
  filepath TEXT NOT NULL,                     -- denormalized for convenience
  sha256Hash TEXT,                            -- snapshot of file content hash
  statusAtCreation TEXT,                      -- GREEN/YELLOW/RED at creation
  userNote TEXT NOT NULL,                     -- the human's words
  identityBundle TEXT,                        -- JSON: schema card + intent + recent mutations
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  claimedAt TEXT,                             -- when an LLM picked it up
  claimedBy TEXT,                             -- provider id (anthropic/openai/etc)
  resolvedAt TEXT,                            -- when human or LLM marked it done
  resolution TEXT,                            -- LLM's response / human's resolution note
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_tickets_filepath ON tickets(filepath);
CREATE INDEX IF NOT EXISTS idx_tickets_open ON tickets(resolvedAt);
CREATE INDEX IF NOT EXISTS idx_tickets_fingerprint ON tickets(fingerprint);
`;

// ─── EXPECTED SCHEMA (introspection target) ──────────────────
//
// Parallel to ST8_SCHEMA above. ST8_SCHEMA is what we CREATE; this is
// what we EXPECT at boot. introspectSchema() runs `PRAGMA table_info`
// on every listed table and logs a `[st8:persistence:drift]` warning
// for missing tables, missing columns, or extra columns.
//
// Why a parallel structure instead of parsing ST8_SCHEMA? Parsing a
// 150-line template literal at boot would be fragile (commented-out
// blocks, multi-line FK clauses, etc.). A hand-maintained constant
// keeps the diff explicit: anyone who touches ST8_SCHEMA is expected
// to touch EXPECTED_SCHEMA in the same edit.
//
// Pairs naturally with a future migration framework (P1.1): the
// migration runner mutates the live DB, the introspector confirms the
// mutation landed and flags any column ST8_SCHEMA expects that an
// older DB never gained (the five post-initial columns are the
// canonical example — needsAIReview, tripleAtCount, aiContentInjected,
// templateVariables, hasUnfilledVariables).
//
// Column-type comparison is intentionally case-insensitive and ignores
// the trailing `(N)` size annotation — SQLite treats type names as
// affinity hints, not strict types.
const EXPECTED_SCHEMA = {
    file_registry: [
        'fingerprint', 'filepath', 'filename', 'sha256Hash', 'fileSizeBytes',
        'status', 'reachabilityScore', 'impactRadius', 'lifecyclePhase',
        'birthTimestamp', 'lastModified', 'lastIndexed', 'isEntryPoint',
        'lastAccessed', 'sessionsSinceAccess', 'expiryDate', 'associatedWith',
        'eventTrigger', 'brunoStatus', 'needsAIReview', 'tripleAtCount',
        'aiContentInjected', 'templateVariables', 'hasUnfilledVariables',
    ],
    connections: [
        'id', 'sourceFingerprint', 'targetFingerprint', 'connectionType',
        'importSpecifier', 'isResolved', 'confidenceScore', 'lastVerified',
    ],
    file_intent: [
        'fingerprint', 'purpose', 'dependsOnBehavior', 'valueStatement',
        'authoredBy', 'lastUpdated',
    ],
    file_mutation_log: [
        'id', 'fingerprint', 'sha256Hash', 'mutationType', 'changedFields',
        'actor', 'timestamp', 'metadata',
    ],
    activity_log: [
        'id', 'timestamp', 'source', 'action', 'targetFingerprint', 'details',
    ],
    st8_settings: ['category', 'key', 'value', 'updatedAt'],
    prd_projects: [
        'id', 'name', 'path', 'template', 'variables', 'created', 'updated',
    ],
    ai_content: ['id', 'filepath', 'content', 'reviewed', 'timestamp'],
    tickets: [
        'id', 'fingerprint', 'filepath', 'sha256Hash', 'statusAtCreation',
        'userNote', 'identityBundle', 'createdAt', 'claimedAt', 'claimedBy',
        'resolvedAt', 'resolution',
    ],
};

// ─── PERSISTENCE CLASS ───────────────────────────────────────

class St8Persistence {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(process.cwd(), 'st8.sqlite');
        this.db = null;
    }
    
    async initialize() {
        try {
            // Try to use maestro's DatabasePersister
            const DatabasePersister = getDatabasePersister();
            if (DatabasePersister && typeof DatabasePersister === 'function') {
                this.db = new DatabasePersister(this.dbPath);
                console.log('[st8:persistence] Using maestro DatabasePersister');
            } else {
                // Fallback: use better-sqlite3 directly
                const Database = require('better-sqlite3');
                this.db = new Database(this.dbPath);
                this.db.pragma('journal_mode = WAL');
                this.db.pragma('synchronous = NORMAL');
                console.log('[st8:persistence] Using better-sqlite3 directly');
            }

            // Enforce declared FOREIGN KEY constraints. Without this pragma,
            // SQLite accepts orphan rows in connections, file_intent,
            // file_mutation_log, and tickets — making the schema's FK
            // declarations documentary only. Manual JS-side cascade in
            // deleteFile / pruneFilesNotIn is still required (SQLite does
            // not auto-cascade unless ON DELETE CASCADE is declared, which
            // we deliberately do not use — cascade semantics live in JS so
            // mutation_log + activity_log can be written before deletion).
            this.db.pragma('foreign_keys = ON');

            // Apply st8 schema
            this.db.exec(ST8_SCHEMA);
            console.log('[st8:persistence] Database initialized:', this.dbPath);

            // Detect drift between ST8_SCHEMA / EXPECTED_SCHEMA and the
            // live DB. Pre-existing st8.sqlite files predate post-initial
            // columns (needsAIReview, etc.) — without a migration framework
            // they only land in a fresh DB. introspectSchema() logs the
            // diff so the gap is visible, not silent. Throws are only on
            // catastrophic introspection failure (e.g. sqlite_master
            // unreadable) — column drift logs warnings and continues.
            try {
                const drift = this.introspectSchema();
                if (drift.hasDrift) {
                    for (const line of drift.report) {
                        console.warn('[st8:persistence:drift]', line);
                    }
                }
            } catch (driftErr) {
                console.error('[st8:persistence] Schema introspection failed:', driftErr.message);
            }

        } catch (err) {
            console.error('[st8:persistence] Failed to initialize database:', err.message);
            throw err;
        }
    }

    /**
     * Compare EXPECTED_SCHEMA to the live DB via PRAGMA table_info.
     * Returns a structured diff so callers can decide whether to log,
     * throw, or attempt migration. initialize() calls this after the
     * schema apply and logs warnings on any drift.
     *
     * @returns {{
     *   hasDrift: boolean,
     *   missingTables: string[],
     *   extraTables: string[],
     *   missingColumns: Record<string, string[]>,
     *   extraColumns: Record<string, string[]>,
     *   report: string[]
     * }}
     */
    introspectSchema() {
        const result = {
            hasDrift: false,
            missingTables: [],
            extraTables: [],
            missingColumns: {},
            extraColumns: {},
            report: [],
        };

        // Inventory of actual tables in the DB (skip sqlite internals).
        const actualTableRows = this.db.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        ).all();
        const actualTables = new Set(actualTableRows.map(r => r.name));
        const expectedTables = new Set(Object.keys(EXPECTED_SCHEMA));

        for (const t of expectedTables) {
            if (!actualTables.has(t)) {
                result.missingTables.push(t);
                result.hasDrift = true;
                result.report.push(`missing table: ${t}`);
            }
        }
        for (const t of actualTables) {
            if (!expectedTables.has(t)) {
                result.extraTables.push(t);
                result.hasDrift = true;
                result.report.push(`extra table (not in EXPECTED_SCHEMA): ${t}`);
            }
        }

        // Column diff for tables that exist on both sides.
        for (const table of Object.keys(EXPECTED_SCHEMA)) {
            if (!actualTables.has(table)) continue;
            const actualCols = this.db.pragma(`table_info(${table})`).map(c => c.name);
            const actualSet = new Set(actualCols);
            const expectedCols = EXPECTED_SCHEMA[table];
            const expectedSet = new Set(expectedCols);

            const missing = expectedCols.filter(c => !actualSet.has(c));
            const extra = actualCols.filter(c => !expectedSet.has(c));

            if (missing.length > 0) {
                result.missingColumns[table] = missing;
                result.hasDrift = true;
                result.report.push(`${table}: missing column(s) [${missing.join(', ')}]`);
            }
            if (extra.length > 0) {
                result.extraColumns[table] = extra;
                result.hasDrift = true;
                result.report.push(`${table}: extra column(s) not in EXPECTED_SCHEMA [${extra.join(', ')}]`);
            }
        }

        return result;
    }

    // ─── FILE REGISTRY ──────────────────────────────────────
    
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
    
    getFilesByStatus(status) {
        const stmt = this.db.prepare('SELECT * FROM file_registry WHERE status = ? ORDER BY filepath');
        return stmt.all(status);
    }
    
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
    
    /**
     * Look up a file_registry row by filepath.
     *
     * file_registry permits MULTIPLE rows per filepath (different
     * birthTimestamp → different fingerprint). Without an explicit
     * ORDER BY, SQLite returned whichever row sat first in physical
     * layout — non-deterministic across runs. We now sort by
     * birthTimestamp DESC so the most-recent identity wins.
     *
     * Callers that need to operate on EVERY fingerprint for a path
     * (e.g. deleteFile) must use getAllFilesByPath instead.
     *
     * @param {string} filepath
     * @returns {object|undefined} most-recent file_registry row
     */
    getFileByPath(filepath) {
        const stmt = this.db.prepare(
            'SELECT * FROM file_registry WHERE filepath = ? ORDER BY birthTimestamp DESC'
        );
        return stmt.get(filepath);
    }

    /**
     * Return ALL file_registry rows for a filepath, newest first.
     * Used by deleteFile to cascade across every fingerprint that
     * shares the filepath — see the §4 caveat in
     * docs/components/persistence-and-database.md.
     *
     * @param {string} filepath
     * @returns {object[]}
     */
    getAllFilesByPath(filepath) {
        const stmt = this.db.prepare(
            'SELECT * FROM file_registry WHERE filepath = ? ORDER BY birthTimestamp DESC'
        );
        return stmt.all(filepath);
    }

    /**
     * Delete every file_registry row for `filepath` and cascade through
     * connections, file_intent, file_mutation_log, and tickets.
     *
     * IMPORTANT: file_registry can have multiple rows per filepath
     * (different birthTimestamps = different fingerprints from different
     * runs). The old implementation looked up ONE row, cascaded that
     * fingerprint's children, then `DELETE FROM file_registry WHERE
     * filepath = ?` removed ALL rows — leaving connections/intent/
     * mutation_log/tickets for the other fingerprints orphaned. With
     * PRAGMA foreign_keys ON the orphan-creating delete now throws.
     *
     * Current shape: iterate every fingerprint, cascade per-fingerprint
     * (same as pruneFilesNotIn), DELETE BY FINGERPRINT not filepath.
     */
    deleteFile(filepath) {
        const files = this.getAllFilesByPath(filepath);
        if (files.length === 0) return { changes: 0 };

        const deleteRowStmt = this.db.prepare('DELETE FROM file_registry WHERE fingerprint = ?');

        const _deleteFileTx = this.db.transaction(() => {
            let changes = 0;
            const fingerprints = [];
            for (const f of files) {
                this.deleteConnectionsForFile(f.fingerprint);
                this.deleteIntentForFile(f.fingerprint);
                this.deleteMutationLogForFile(f.fingerprint);
                this.deleteTicketsForFile(f.fingerprint);
                const result = deleteRowStmt.run(f.fingerprint);
                if (result.changes > 0) {
                    changes += result.changes;
                    fingerprints.push(f.fingerprint);
                }
            }
            return { changes, fingerprints };
        });

        const { changes, fingerprints } = _deleteFileTx();
        // Backwards-compatible return shape: callers historically read
        // `fingerprint` (singular). Surface the most-recent fingerprint
        // (first in the DESC-ordered list) plus the full set.
        return {
            changes,
            fingerprint: fingerprints[0] || files[0].fingerprint,
            fingerprints,
        };
    }

    /**
     * Prune file_registry rows whose filepath is NOT in the provided set.
     * Used at the start of each indexer pass to drop stale rows accumulated
     * from prior runs (different target dirs, removed files, self-written
     * artifacts that slipped past discoverFiles).
     *
     * Operates per-fingerprint inside a single transaction. file_registry
     * can have MULTIPLE rows per filepath (different birthTimestamps =
     * different fingerprints from different runs), so cleaning by filepath
     * is FK-unsafe — it would leave connections/intent/mutation_log rows
     * referencing the other fingerprints. Per-fingerprint cleanup avoids
     * the violation.
     *
     * @param {Set<string>} currentFilepaths - Filepaths that survive
     * @returns {{ prunedCount: number, prunedFingerprints: string[] }}
     */
    pruneFilesNotIn(currentFilepaths) {
        const all = this.getAllFiles();
        const stale = all.filter((f) => !currentFilepaths.has(f.filepath));
        if (stale.length === 0) return { prunedCount: 0, prunedFingerprints: [] };

        const deleteRowStmt = this.db.prepare('DELETE FROM file_registry WHERE fingerprint = ?');

        const _pruneTx = this.db.transaction(() => {
            const pruned = [];
            for (const f of stale) {
                this.deleteConnectionsForFile(f.fingerprint);
                this.deleteIntentForFile(f.fingerprint);
                this.deleteMutationLogForFile(f.fingerprint);
                this.deleteTicketsForFile(f.fingerprint);
                const result = deleteRowStmt.run(f.fingerprint);
                if (result.changes > 0) pruned.push(f.fingerprint);
            }
            return pruned;
        });

        const prunedFingerprints = _pruneTx();
        return { prunedCount: prunedFingerprints.length, prunedFingerprints };
    }
    
    // ─── TICKETS ────────────────────────────────────────────

    /**
     * Create a new ticket from a user note + file context.
     * @param {object} t - { fingerprint, filepath, sha256Hash, statusAtCreation, userNote, identityBundle }
     * @returns {{ id: number, createdAt: string }}
     */
    createTicket(t) {
        const stmt = this.db.prepare(`
            INSERT INTO tickets (fingerprint, filepath, sha256Hash, statusAtCreation, userNote, identityBundle)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            t.fingerprint,
            t.filepath,
            t.sha256Hash || null,
            t.statusAtCreation || null,
            t.userNote || '',
            t.identityBundle ? JSON.stringify(t.identityBundle) : null
        );
        const row = this.db.prepare('SELECT id, createdAt FROM tickets WHERE id = ?').get(result.lastInsertRowid);
        return { id: row.id, createdAt: row.createdAt };
    }

    /** Open tickets (resolvedAt IS NULL), newest first. */
    getOpenTickets(limit) {
        const lim = typeof limit === 'number' ? limit : 200;
        return this.db.prepare(`
            SELECT * FROM tickets
            WHERE resolvedAt IS NULL
            ORDER BY createdAt DESC
            LIMIT ?
        `).all(lim);
    }

    /** Count of open tickets — for the phreak> TUI badge. */
    countOpenTickets() {
        const row = this.db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE resolvedAt IS NULL').get();
        return row ? row.n : 0;
    }

    /** Mark a ticket resolved. */
    resolveTicket(id, resolution) {
        const stmt = this.db.prepare(`
            UPDATE tickets
            SET resolvedAt = CURRENT_TIMESTAMP, resolution = ?
            WHERE id = ?
        `);
        return stmt.run(resolution || '', id);
    }

    /** Claim a ticket on behalf of an LLM provider. */
    claimTicket(id, claimedBy) {
        const stmt = this.db.prepare(`
            UPDATE tickets
            SET claimedAt = CURRENT_TIMESTAMP, claimedBy = ?
            WHERE id = ? AND claimedAt IS NULL
        `);
        return stmt.run(claimedBy || 'unknown', id);
    }

    deleteConnectionsForFile(fingerprint) {
        const stmt = this.db.prepare(
            'DELETE FROM connections WHERE sourceFingerprint = ? OR targetFingerprint = ?'
        );
        return stmt.run(fingerprint, fingerprint);
    }
    
    deleteIntentForFile(fingerprint) {
        const stmt = this.db.prepare('DELETE FROM file_intent WHERE fingerprint = ?');
        return stmt.run(fingerprint);
    }
    
    deleteMutationLogForFile(fingerprint) {
        const stmt = this.db.prepare('DELETE FROM file_mutation_log WHERE fingerprint = ?');
        return stmt.run(fingerprint);
    }

    /**
     * Cascade helper for tickets — drops every ticket referencing the
     * given fingerprint. Called from deleteFile and pruneFilesNotIn so
     * deleting a file_registry row never leaves orphan tickets behind
     * (which would FK-violate once PRAGMA foreign_keys is enforced).
     */
    deleteTicketsForFile(fingerprint) {
        const stmt = this.db.prepare('DELETE FROM tickets WHERE fingerprint = ?');
        return stmt.run(fingerprint);
    }
    
    // ─── CONNECTIONS ────────────────────────────────────────
    
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
            conn.connectionType ?? 'IMPORT',
            conn.importSpecifier ?? null,
            conn.isResolved !== undefined ? (conn.isResolved ? 1 : 0) : 1,
            conn.confidenceScore ?? 1.0
        );
    }
    
    getConnectionsForFile(fingerprint) {
        const stmt = this.db.prepare('SELECT * FROM connections WHERE sourceFingerprint = ? OR targetFingerprint = ?');
        return stmt.all(fingerprint, fingerprint);
    }
    
    // ─── FILE INTENT ────────────────────────────────────────
    
    upsertIntent(intent) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO file_intent 
            (fingerprint, purpose, dependsOnBehavior, valueStatement, authoredBy, lastUpdated)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(
            intent.fingerprint,
            intent.purpose || '',
            intent.dependsOnBehavior || '',
            intent.valueStatement || '',
            intent.authoredBy || 'INFERRED'
        );
    }
    
    getIntent(fingerprint) {
        const stmt = this.db.prepare('SELECT * FROM file_intent WHERE fingerprint = ?');
        return stmt.get(fingerprint);
    }

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
    
    // ─── MUTATION LOG ──────────────────────────────────────

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

    getMutationLog(fingerprint, limit = 50) {
        const stmt = this.db.prepare(
            'SELECT * FROM file_mutation_log WHERE fingerprint = ? ORDER BY timestamp DESC LIMIT ?'
        );
        return stmt.all(fingerprint, limit);
    }

    getMutationCount(fingerprint) {
        const stmt = this.db.prepare(
            'SELECT COUNT(*) as count FROM file_mutation_log WHERE fingerprint = ?'
        );
        const result = stmt.get(fingerprint);
        return result.count;
    }

    getLastMutation(fingerprint) {
        const stmt = this.db.prepare(
            'SELECT * FROM file_mutation_log WHERE fingerprint = ? ORDER BY timestamp DESC LIMIT 1'
        );
        return stmt.get(fingerprint) || null;
    }

    // ─── CONCEPT FILES ─────────────────────────────────────

    registerConceptFile(conceptEntry) {
        // Register a file that doesn't exist on disk yet
        // fingerprint is generated from filepath + current timestamp
        const { generateFingerprint } = require('../../shared/types/st8-types');
        const birthTimestamp = new Date().toISOString();
        const fingerprint = generateFingerprint(conceptEntry.filepath, birthTimestamp);

        const _registerConceptTx = this.db.transaction((fp, fname, bts, entry, fpr) => {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO file_registry
                (fingerprint, filepath, filename, sha256Hash, fileSizeBytes, status,
                 reachabilityScore, impactRadius, lifecyclePhase, birthTimestamp,
                 lastModified, lastIndexed, isEntryPoint)
                VALUES (?, ?, ?, '', 0, 'CONCEPT', 0.0, 0, 'CONCEPT', ?, '', CURRENT_TIMESTAMP, 0)
            `);
            stmt.run(fpr, fp, fname, bts);

            // Log the concept creation mutation
            this.logMutation({
                fingerprint: fpr,
                sha256Hash: '',
                mutationType: 'CONCEPT',
                changedFields: JSON.stringify({ lifecyclePhase: [null, 'CONCEPT'] }),
                actor: entry.actor || 'DEVELOPER',
                metadata: JSON.stringify(entry)
            });
        });

        _registerConceptTx(
            conceptEntry.filepath,
            conceptEntry.filename || path.basename(conceptEntry.filepath),
            birthTimestamp,
            conceptEntry,
            fingerprint
        );

        return fingerprint;
    }

    // ─── PURGE ─────────────────────────────────────────────

    purgeDevelopmentData(fingerprint) {
        // Archive and remove development-phase mutation data
        // Keeps only PRODUCTION-type mutations and the latest schema card

        // 1. Count what we're about to purge (read-only, outside transaction)
        const countStmt = this.db.prepare(
            `SELECT COUNT(*) as count FROM file_mutation_log
             WHERE fingerprint = ? AND mutationType NOT IN ('PRODUCTION', 'PURGE')`
        );
        const { count } = countStmt.get(fingerprint);

        // 2. Delete development mutations, log purge, update lifecycle — atomic
        const _purgeDevTx = this.db.transaction((fp, purgedCount) => {
            const deleteStmt = this.db.prepare(
                `DELETE FROM file_mutation_log
                 WHERE fingerprint = ? AND mutationType NOT IN ('PRODUCTION', 'PURGE')`
            );
            deleteStmt.run(fp);

            this.logMutation({
                fingerprint: fp,
                sha256Hash: '',
                mutationType: 'PURGE',
                changedFields: JSON.stringify({ purgedMutations: purgedCount }),
                actor: 'INDEXER',
                metadata: '{}'
            });

            const updateStmt = this.db.prepare(
                `UPDATE file_registry SET lifecyclePhase = 'PRODUCTION' WHERE fingerprint = ?`
            );
            updateStmt.run(fp);
        });

        _purgeDevTx(fingerprint, count);

        return { purgedMutations: count };
    }

    // ─── ACTIVITY LOG ───────────────────────────────────────
    
    logActivity(activity) {
        // Guard against the camelCase / snake_case drift that produced
        // silent NULL targetFingerprint rows for every TICKET_CREATED
        // activity (see persistence-and-database.md §8.3). The activity_log
        // schema uses camelCase column names; an upstream writer passing
        // `target_fingerprint` would previously be silently nulled.
        // Now we throw — loud bug beats quiet bug.
        const ALLOWED_KEYS = new Set([
            'source',
            'action',
            'targetFingerprint',
            'details',
        ]);
        const unknown = Object.keys(activity || {}).filter(k => !ALLOWED_KEYS.has(k));
        if (unknown.length > 0) {
            throw new Error(
                `[st8:persistence] logActivity: unknown key(s) [${unknown.join(', ')}]. ` +
                `activity_log columns are camelCase — did you mean targetFingerprint? ` +
                `Allowed keys: ${Array.from(ALLOWED_KEYS).join(', ')}.`
            );
        }
        const stmt = this.db.prepare(`
            INSERT INTO activity_log
            (source, action, targetFingerprint, details)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(
            activity.source || 'INDEXER',
            activity.action,
            activity.targetFingerprint || null,
            activity.details ? JSON.stringify(activity.details) : null
        );
    }
    
    getRecentActivity(limit = 50) {
        const stmt = this.db.prepare('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?');
        return stmt.all(limit);
    }
    
    // ─── SETTINGS ────────────────────────────────────────────

    upsertSetting(category, key, value) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO st8_settings (category, key, value, updatedAt)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(category, key, typeof value === 'string' ? value : JSON.stringify(value));
    }

    getSetting(category, key) {
        const stmt = this.db.prepare('SELECT value FROM st8_settings WHERE category = ? AND key = ?');
        const row = stmt.get(category, key);
        if (!row) return null;
        try { return JSON.parse(row.value); } catch { return row.value; }
    }

    getSettingsByCategory(category) {
        const stmt = this.db.prepare('SELECT key, value FROM st8_settings WHERE category = ?');
        const rows = stmt.all(category);
        const result = {};
        for (const row of rows) {
            try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
        }
        return result;
    }

    getAllSettings() {
        const stmt = this.db.prepare('SELECT category, key, value FROM st8_settings ORDER BY category, key');
        const rows = stmt.all();
        const result = {};
        for (const row of rows) {
            if (!result[row.category]) result[row.category] = {};
            try { result[row.category][row.key] = JSON.parse(row.value); } catch { result[row.category][row.key] = row.value; }
        }
        return result;
    }

    deleteSetting(category, key) {
        const stmt = this.db.prepare('DELETE FROM st8_settings WHERE category = ? AND key = ?');
        return stmt.run(category, key);
    }

    // ─── BRUNO & OSCAR METHODS ─────────────────────────────

    getStaleFiles(threshold) {
        const stmt = this.db.prepare(
            "SELECT * FROM file_registry WHERE sessionsSinceAccess >= ? AND brunoStatus = 'active'"
        );
        return stmt.all(threshold);
    }

    updateFileLifecycle(filepath, updates) {
        const allowedFields = ['lastAccessed', 'sessionsSinceAccess', 'expiryDate',
                              'associatedWith', 'eventTrigger', 'brunoStatus'];
        const fields = Object.keys(updates).filter(f => allowedFields.includes(f));
        if (fields.length === 0) return { changes: 0 };

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const stmt = this.db.prepare(`UPDATE file_registry SET ${setClause} WHERE filepath = ?`);
        return stmt.run(...fields.map(f => updates[f]), filepath);
    }

    incrementSessionCounters() {
        const stmt = this.db.prepare(
            "UPDATE file_registry SET sessionsSinceAccess = sessionsSinceAccess + 1 WHERE brunoStatus = 'active'"
        );
        return stmt.run();
    }

    markFileAccessed(filepath) {
        const stmt = this.db.prepare(
            'UPDATE file_registry SET sessionsSinceAccess = 0, lastAccessed = CURRENT_TIMESTAMP WHERE filepath = ?'
        );
        return stmt.run(filepath);
    }

    archiveFile(filepath) {
        const stmt = this.db.prepare(
            "UPDATE file_registry SET brunoStatus = 'archived' WHERE filepath = ?"
        );
        return stmt.run(filepath);
    }

    setExpiryDate(filepath, daysFromNow) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysFromNow);
        const stmt = this.db.prepare(
            'UPDATE file_registry SET expiryDate = ? WHERE filepath = ?'
        );
        return stmt.run(expiryDate.toISOString(), filepath);
    }

    // ─── @@@ SYMBOL METHODS ────────────────────────────────

    flagForAIReview(filepath, tripleAtCount) {
        const stmt = this.db.prepare(
            'UPDATE file_registry SET needsAIReview = 1, tripleAtCount = ? WHERE filepath = ?'
        );
        return stmt.run(tripleAtCount, filepath);
    }

    markAIReviewed(filepath) {
        const stmt = this.db.prepare(
            'UPDATE file_registry SET needsAIReview = 0 WHERE filepath = ?'
        );
        return stmt.run(filepath);
    }

    getFilesNeedingAIReview() {
        const stmt = this.db.prepare(
            'SELECT * FROM file_registry WHERE needsAIReview = 1 ORDER BY filepath'
        );
        return stmt.all();
    }

    storeAIContent(filepath, content) {
        const stmt = this.db.prepare(
            'INSERT OR REPLACE INTO ai_content (filepath, content, reviewed, timestamp) VALUES (?, ?, 0, CURRENT_TIMESTAMP)'
        );
        return stmt.run(filepath, content);
    }

    getAIContent(filepath) {
        const stmt = this.db.prepare(
            'SELECT * FROM ai_content WHERE filepath = ? ORDER BY timestamp DESC'
        );
        return stmt.all(filepath);
    }

    // ─── TEMPLATE METHODS ───────────────────────────────────

    setTemplateVariables(filepath, variables) {
        const varsJson = JSON.stringify(variables);
        const hasUnfilled = Object.values(variables).some(v => v === null || v === undefined || v === '');
        const stmt = this.db.prepare(
            'UPDATE file_registry SET templateVariables = ?, hasUnfilledVariables = ? WHERE filepath = ?'
        );
        return stmt.run(varsJson, hasUnfilled ? 1 : 0, filepath);
    }

    getTemplateVariables(filepath) {
        const stmt = this.db.prepare(
            'SELECT templateVariables, hasUnfilledVariables FROM file_registry WHERE filepath = ?'
        );
        const row = stmt.get(filepath);
        if (!row || !row.templateVariables) return { variables: {}, hasUnfilled: false };
        try {
            return { variables: JSON.parse(row.templateVariables), hasUnfilled: Boolean(row.hasUnfilledVariables) };
        } catch {
            return { variables: {}, hasUnfilled: false };
        }
    }

    // ─── PRD PROJECT METHODS ─────────────────────────────────

    createPRDProject(name, projectPath, template, variables) {
        const stmt = this.db.prepare(
            'INSERT INTO prd_projects (name, path, template, variables) VALUES (?, ?, ?, ?)'
        );
        return stmt.run(name, projectPath, template, JSON.stringify(variables));
    }

    getPRDProject(name) {
        const stmt = this.db.prepare('SELECT * FROM prd_projects WHERE name = ?');
        const row = stmt.get(name);
        if (row && row.variables) {
            try { row.variables = JSON.parse(row.variables); } catch { }
        }
        return row;
    }

    getAllPRDProjects() {
        const stmt = this.db.prepare('SELECT * FROM prd_projects ORDER BY created DESC');
        const rows = stmt.all();
        for (const row of rows) {
            if (row.variables) {
                try { row.variables = JSON.parse(row.variables); } catch { }
            }
        }
        return rows;
    }

    updatePRDProject(name, updates) {
        const allowedFields = ['path', 'template', 'variables'];
        const fields = Object.keys(updates).filter(f => allowedFields.includes(f));
        if (fields.length === 0) return { changes: 0 };

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const stmt = this.db.prepare(`UPDATE prd_projects SET ${setClause}, updated = CURRENT_TIMESTAMP WHERE name = ?`);
        const values = fields.map(f => f === 'variables' ? JSON.stringify(updates[f]) : updates[f]);
        return stmt.run(...values, name);
    }

    deletePRDProject(name) {
        const stmt = this.db.prepare('DELETE FROM prd_projects WHERE name = ?');
        return stmt.run(name);
    }

    // ─── UTILITY ────────────────────────────────────────────

    close() {
        if (this.db) {
            try {
                this.db.close();
            } catch (err) {
                // Ignore "Database is closed" errors
                if (!err.message.includes('Database is closed')) {
                    throw err;
                }
            }
            this.db = null;
        }
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    St8Persistence
};
