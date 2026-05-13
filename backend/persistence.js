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
  sha256_hash TEXT NOT NULL,
  file_size_bytes INTEGER,
  status TEXT DEFAULT 'GREEN',
  reachability_score REAL DEFAULT 0.0,
  impact_radius INTEGER DEFAULT 0,
  last_modified TEXT,
  last_indexed TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_fingerprint TEXT NOT NULL,
  target_fingerprint TEXT NOT NULL,
  connection_type TEXT DEFAULT 'IMPORT',
  import_specifier TEXT,
  is_resolved INTEGER DEFAULT 1,
  confidence_score REAL DEFAULT 1.0,
  last_verified TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_fingerprint) REFERENCES file_registry(fingerprint),
  FOREIGN KEY (target_fingerprint) REFERENCES file_registry(fingerprint)
);

CREATE TABLE IF NOT EXISTS file_intent (
  fingerprint TEXT PRIMARY KEY,
  purpose TEXT,
  depends_on_behavior TEXT,
  value_statement TEXT,
  authored_by TEXT DEFAULT 'INFERRED',
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'INDEXER',
  action TEXT NOT NULL,
  target_fingerprint TEXT,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_file_registry_status ON file_registry(status);
CREATE INDEX IF NOT EXISTS idx_file_registry_sha256 ON file_registry(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_fingerprint);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_fingerprint);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_unique 
ON connections(source_fingerprint, target_fingerprint, connection_type);

CREATE TABLE IF NOT EXISTS st8_settings (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, key)
);
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
            (fingerprint, filepath, filename, sha256_hash, file_size_bytes, status, reachability_score, impact_radius, last_modified, last_indexed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(
            file.fingerprint || file.sha256Hash,
            file.filepath,
            file.filename,
            file.sha256Hash,
            file.fileSizeBytes || 0,
            file.status || 'RED',
            file.reachabilityScore || 0.0,
            file.impactRadius || 0,
            file.lastModified || new Date().toISOString()
        );
    }
    
    getFilesByStatus(status) {
        const stmt = this.db.prepare('SELECT * FROM file_registry WHERE status = ? ORDER BY filepath');
        return stmt.all(status);
    }
    
    getAllFiles() {
        const stmt = this.db.prepare('SELECT * FROM file_registry ORDER BY filepath');
        return stmt.all();
    }
    
    getFileByPath(filepath) {
        const stmt = this.db.prepare('SELECT * FROM file_registry WHERE filepath = ?');
        return stmt.get(filepath);
    }
    
    deleteFile(filepath) {
        const file = this.getFileByPath(filepath);
        if (!file) return { changes: 0 };
        
        // Cascade delete FK-dependent rows
        this.deleteConnectionsForFile(file.fingerprint);
        this.deleteIntentForFile(file.fingerprint);
        
        // Delete the file
        const stmt = this.db.prepare('DELETE FROM file_registry WHERE filepath = ?');
        const result = stmt.run(filepath);
        return { changes: result.changes, fingerprint: file.fingerprint };
    }
    
    deleteConnectionsForFile(fingerprint) {
        const stmt = this.db.prepare(
            'DELETE FROM connections WHERE source_fingerprint = ? OR target_fingerprint = ?'
        );
        return stmt.run(fingerprint, fingerprint);
    }
    
    deleteIntentForFile(fingerprint) {
        const stmt = this.db.prepare('DELETE FROM file_intent WHERE fingerprint = ?');
        return stmt.run(fingerprint);
    }
    
    // ─── CONNECTIONS ────────────────────────────────────────
    
    insertConnection(conn) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO connections 
            (source_fingerprint, target_fingerprint, connection_type, import_specifier, is_resolved, confidence_score)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            conn.sourceFingerprint,
            conn.targetFingerprint,
            conn.connectionType || 'IMPORT',
            conn.importSpecifier || '',
            conn.isResolved ? 1 : 0,
            conn.confidenceScore || 1.0
        );
    }
    
    getConnectionsForFile(fingerprint) {
        const stmt = this.db.prepare('SELECT * FROM connections WHERE source_fingerprint = ? OR target_fingerprint = ?');
        return stmt.all(fingerprint, fingerprint);
    }
    
    // ─── FILE INTENT ────────────────────────────────────────
    
    upsertIntent(intent) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO file_intent 
            (fingerprint, purpose, depends_on_behavior, value_statement, authored_by, last_updated)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(
            intent.fingerprint,
            intent.purpose || '',
            intent.dependsOnBehavior || '',
            intent.valueStatement || '',
            intent.authoredBy || 'USER'
        );
    }
    
    getIntent(fingerprint) {
        const stmt = this.db.prepare('SELECT * FROM file_intent WHERE fingerprint = ?');
        return stmt.get(fingerprint);
    }

    getAllIntents() {
        const stmt = this.db.prepare('SELECT * FROM file_intent');
        const rows = stmt.all();
        const map = {};
        for (const row of rows) {
            map[row.fingerprint] = {
                purpose: row.purpose || '',
                dependsOnBehavior: row.depends_on_behavior || '',
                valueStatement: row.value_statement || ''
            };
        }
        return map;
    }
    
    // ─── ACTIVITY LOG ───────────────────────────────────────
    
    logActivity(activity) {
        const stmt = this.db.prepare(`
            INSERT INTO activity_log 
            (source, action, target_fingerprint, details)
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
            INSERT OR REPLACE INTO st8_settings (category, key, value, updated_at)
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

    // ─── UTILITY ────────────────────────────────────────────

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    St8Persistence
};
