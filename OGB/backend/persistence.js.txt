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
const { St8FileEntry, LifecyclePhase, FileStatus } = require('./st8-types');

// ─── LIB CODE REFERENCES ─────────────────────────────────────

const LIB_DIR = path.join(__dirname, '..', 'lib');

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
        _databasePersister = loadLibModule('commands/integr8/databasePersister.js');
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
`;

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
            
            // Apply st8 schema
            this.db.exec(ST8_SCHEMA);
            console.log('[st8:persistence] Database initialized:', this.dbPath);
            
        } catch (err) {
            console.error('[st8:persistence] Failed to initialize database:', err.message);
            throw err;
        }
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
    
    getFileByPath(filepath) {
        const stmt = this.db.prepare('SELECT * FROM file_registry WHERE filepath = ?');
        return stmt.get(filepath);
    }
    
    deleteFile(filepath) {
        const file = this.getFileByPath(filepath);
        if (!file) return { changes: 0 };

        const _deleteFileTx = this.db.transaction((fp, fingerprint) => {
            this.deleteConnectionsForFile(fingerprint);
            this.deleteIntentForFile(fingerprint);
            this.deleteMutationLogForFile(fingerprint);

            const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
            return stmt.run(fp);
        });

        const result = _deleteFileTx(filepath, file.fingerprint);
        return { changes: result.changes, fingerprint: file.fingerprint };
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
        const { generateFingerprint } = require('./st8-types');
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
