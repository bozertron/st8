"use strict";
// src/commands/parserPersistence.ts
// Database-first parser persistence layer.
// Persists parser output to the shared SQLite database.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserPersistence = void 0;
/**
 * parser-persistence — SQLite sink for the six specialised parsers.
 *
 * INPUT CONTRACT:
 *   - new ParserPersistence(dbPath?). Defaults dbPath via
 *     graph-persister.getSharedDatabasePath() so all integr8 tooling
 *     writes to the same scaffolder_data.sqlite alongside the main
 *     st8.sqlite. NOT the same DB as the rest of st8 — separate file.
 *   - persistAllParserData(projectId, snapshotId, { storeText,
 *     routeText, commandText, typeText, uiText, propertyData,
 *     verificationIssues }) is the omnibus call from data-ingestion.js.
 *   - Per-parser persistXxxData() entry points exist for independent
 *     invocation (testing, replays).
 *
 * OUTPUT CONTRACT (side effect — writes to SQLite):
 *   - ProjectFiles (file_id PK, project_id, snapshot_id, file_path,
 *     file_name, file_size, created_at)
 *   - Stores, Routes, Commands, Types, UiComponents, StoreProperties
 *     — one row per extracted artefact, all keyed by
 *     (project_id, snapshot_id). snapshot_id is what enables
 *     before/after diffs of the same project across runs.
 *   - VerificationIssues — staged for the integr8 verification stage.
 *
 * CONSUMERS:
 *   - data-ingestion.js (Stage 1 orchestrator).
 *   - Sonic / background-indexer (currently dormant; will read these
 *     tables for impact-chain queries per the batch-025 wiring plan).
 *
 * KNOWN LIMITATIONS:
 *   - No FK constraints on the parser tables. snapshot_id integrity is
 *     maintained by convention (data-ingestion.js generates one
 *     snapshotId per ingestion). A bug there could orphan rows.
 *   - close() must be called explicitly. The class does NOT register a
 *     SIGINT handler.
 *   - Tables are CREATE TABLE IF NOT EXISTS in ensureProjectTables();
 *     column additions are NOT picked up on existing databases (same
 *     migration-framework gap as ST8_SCHEMA in persistence.js).
 *
 * ORIGIN: compiled from maestro-scaffolder-tool's src/parserPersistence.ts.
 */
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const crypto = __importStar(require("crypto"));
const databasePersister_js_1 = require("../../core/database/graph-persister.js");
class ParserPersistence {
    constructor(dbPath) {
        const resolvedPath = dbPath || (0, databasePersister_js_1.getSharedDatabasePath)();
        // Note: Don't create dir here - databasePersister already handles it
        // Just open and ensure our additional tables exist
        this.db = new better_sqlite3_1.default(resolvedPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
        this.ensureProjectTables();
    }
    ensureProjectTables() {
        // These tables should already exist from schema.rs / databasePersister
        // But ensure they exist for standalone CLI usage
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS ProjectFiles (
        file_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS Stores (
        store_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file_path TEXT,
        exported_as TEXT,
        state_keys TEXT,
        getters TEXT,
        actions TEXT
      );
      CREATE TABLE IF NOT EXISTS Routes (
        route_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        path TEXT NOT NULL,
        name TEXT,
        component TEXT,
        parent_route TEXT
      );
      CREATE TABLE IF NOT EXISTS Commands (
        command_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file_path TEXT,
        command_type TEXT,
        is_async INTEGER DEFAULT 0,
        stability_status TEXT DEFAULT 'stable',
        deprecation_version TEXT
      );
      CREATE TABLE IF NOT EXISTS CommandInvocations (
        invocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        command_name TEXT NOT NULL,
        invoked_in_file TEXT NOT NULL,
        line_number INTEGER
      );
      CREATE TABLE IF NOT EXISTS Imports (
        import_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        source_file TEXT NOT NULL,
        imported_from TEXT NOT NULL,
        imported_names TEXT,
        is_default INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS Exports (
        export_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        source_file TEXT NOT NULL,
        exported_name TEXT NOT NULL,
        export_type TEXT,
        is_default INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_project_files_project ON ProjectFiles(project_id);
      CREATE INDEX IF NOT EXISTS idx_stores_project ON Stores(project_id);
      CREATE INDEX IF NOT EXISTS idx_routes_project ON Routes(project_id);
      CREATE INDEX IF NOT EXISTS idx_commands_project ON Commands(project_id);
      CREATE INDEX IF NOT EXISTS idx_imports_project ON Imports(project_id);
      CREATE INDEX IF NOT EXISTS idx_exports_project ON Exports(project_id);
    `);
    }
    generateSnapshotId() {
        return crypto.randomUUID();
    }
    persistOverviewData(projectId, snapshotId, fileList) {
        const stmt = this.db.prepare('INSERT INTO ProjectFiles (project_id, snapshot_id, file_path, file_name) VALUES (?, ?, ?, ?)');
        const insertAll = this.db.transaction(() => {
            for (const filePath of fileList) {
                const fileName = filePath.split('/').pop() || filePath;
                stmt.run(projectId, snapshotId, filePath, fileName);
            }
        });
        insertAll();
    }
    persistStoreData(projectId, snapshotId, storeText) {
        // Parse store report text using regex (same patterns as dataIngestion)
        const storeBlocks = storeText.split(/---\s*Store\s*(?:ID|#)?[:\s]*\d+\s*---/i).filter(b => b.trim());
        const stmt = this.db.prepare('INSERT INTO Stores (project_id, snapshot_id, name, file_path, exported_as, state_keys, getters, actions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const insertAll = this.db.transaction(() => {
            for (const block of storeBlocks) {
                const nameMatch = block.match(/(?:Store Name|Exported As)[:\s]*(\w+)/i);
                const fileMatch = block.match(/File[:\s]*([\w\/.\\-]+)/i);
                const stateMatch = block.match(/State[:\s]*\[([^\]]*)\]/i);
                const getterMatch = block.match(/Getters?[:\s]*\[([^\]]*)\]/i);
                const actionMatch = block.match(/Actions?[:\s]*\[([^\]]*)\]/i);
                if (nameMatch) {
                    stmt.run(projectId, snapshotId, nameMatch[1], (fileMatch === null || fileMatch === void 0 ? void 0 : fileMatch[1]) || null, nameMatch[1], (stateMatch === null || stateMatch === void 0 ? void 0 : stateMatch[1]) || null, (getterMatch === null || getterMatch === void 0 ? void 0 : getterMatch[1]) || null, (actionMatch === null || actionMatch === void 0 ? void 0 : actionMatch[1]) || null);
                }
            }
        });
        insertAll();
    }
    persistRouteData(projectId, snapshotId, routeText) {
        const stmt = this.db.prepare('INSERT INTO Routes (project_id, snapshot_id, path, name, component) VALUES (?, ?, ?, ?, ?)');
        const insertAll = this.db.transaction(() => {
            const routeMatches = routeText.matchAll(/[-•]\s*Path[:\s]*(\/[^\n]*)/gi);
            for (const match of routeMatches) {
                const path = match[1].trim();
                const nameMatch = routeText.slice(match.index).match(/Name[:\s]*(\w+)/i);
                const compMatch = routeText.slice(match.index).match(/Component[:\s]*([\w./\\-]+)/i);
                stmt.run(projectId, snapshotId, path, (nameMatch === null || nameMatch === void 0 ? void 0 : nameMatch[1]) || null, (compMatch === null || compMatch === void 0 ? void 0 : compMatch[1]) || null);
            }
        });
        insertAll();
    }
    persistCommandData(projectId, snapshotId, commandText) {
        const cmdStmt = this.db.prepare('INSERT INTO Commands (project_id, snapshot_id, name, file_path, command_type, is_async) VALUES (?, ?, ?, ?, ?, ?)');
        const invStmt = this.db.prepare('INSERT INTO CommandInvocations (project_id, snapshot_id, command_name, invoked_in_file) VALUES (?, ?, ?, ?)');
        const insertAll = this.db.transaction(() => {
            const cmdMatches = commandText.matchAll(/Command[:\s]*(\w+)/gi);
            for (const match of cmdMatches) {
                const name = match[1];
                const context = commandText.slice(match.index, match.index + 200);
                const fileMatch = context.match(/(?:File|Declared in)[:\s]*([\w./\\-]+)/i);
                const isAsync = context.includes('async');
                cmdStmt.run(projectId, snapshotId, name, (fileMatch === null || fileMatch === void 0 ? void 0 : fileMatch[1]) || null, 'tauri', isAsync ? 1 : 0);
            }
        });
        insertAll();
    }
    persistTypeData(projectId, snapshotId, typeText) {
        const importStmt = this.db.prepare('INSERT INTO Imports (project_id, snapshot_id, source_file, imported_from, imported_names) VALUES (?, ?, ?, ?, ?)');
        const exportStmt = this.db.prepare('INSERT INTO Exports (project_id, snapshot_id, source_file, exported_name, export_type) VALUES (?, ?, ?, ?, ?)');
        const insertAll = this.db.transaction(() => {
            // Parse imports
            const importMatches = typeText.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g);
            for (const match of importMatches) {
                importStmt.run(projectId, snapshotId, 'unknown', match[2], match[1].trim());
            }
            // Parse exports (interfaces, types, enums)
            const exportMatches = typeText.matchAll(/export\s+(interface|type|enum)\s+(\w+)/g);
            for (const match of exportMatches) {
                exportStmt.run(projectId, snapshotId, 'unknown', match[2], match[1]);
            }
        });
        insertAll();
    }
    persistAllParserData(projectId, snapshotId, results) {
        if (results.overview) {
            // Extract file paths from overview text
            const fileLines = results.overview.match(/\d+[:.]\s*(.+)/g) || [];
            const files = fileLines.map(l => l.replace(/^\d+[:.]\s*/, '').trim());
            this.persistOverviewData(projectId, snapshotId, files);
        }
        if (results.stores)
            this.persistStoreData(projectId, snapshotId, results.stores);
        if (results.routes)
            this.persistRouteData(projectId, snapshotId, results.routes);
        if (results.commands)
            this.persistCommandData(projectId, snapshotId, results.commands);
        if (results.types)
            this.persistTypeData(projectId, snapshotId, results.types);
    }
    /**
     * Persist store properties (state keys, getters, actions) to StoreProperties table.
     * Maps store names to store_id_fk via Stores table join.
     */
    persistStorePropertiesData(projectId, snapshotId, propertyData) {
        // Ensure StoreProperties table exists for standalone CLI usage
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS StoreProperties (
        prop_id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id_fk INTEGER NOT NULL,
        prop_name TEXT NOT NULL,
        prop_type TEXT NOT NULL,
        FOREIGN KEY (store_id_fk) REFERENCES Stores(store_id_pk) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_storeprops_store_id ON StoreProperties(store_id_fk);
    `);
        const findStoreStmt = this.db.prepare('SELECT store_id INTEGER FROM Stores WHERE name = ? AND project_id = ? AND snapshot_id = ? LIMIT 1');
        const insertStmt = this.db.prepare('INSERT INTO StoreProperties (store_id_fk, prop_name, prop_type) VALUES (?, ?, ?)');
        const insertAll = this.db.transaction(() => {
            for (const store of propertyData) {
                const row = findStoreStmt.get(store.storeName, projectId, snapshotId);
                if (!row)
                    continue;
                const storeId = row.store_id;
                for (const prop of store.properties) {
                    insertStmt.run(storeId, prop.name, prop.type);
                }
            }
        });
        insertAll();
    }
    /**
     * Persist verification issues (import validation errors, type issues, etc.)
     * to the VerificationIssues table.
     */
    persistVerificationIssues(projectId, snapshotId, issues) {
        // Ensure VerificationIssues table exists for standalone CLI usage
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS VerificationIssues (
        issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_file_id INTEGER,
        issue_type TEXT NOT NULL,
        details TEXT,
        target_item TEXT,
        status TEXT DEFAULT 'New',
        FOREIGN KEY (source_file_id) REFERENCES ProjectFiles(file_id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_verification_source_file ON VerificationIssues(source_file_id);
    `);
        const findFileStmt = this.db.prepare('SELECT file_id FROM ProjectFiles WHERE file_path = ? AND project_id = ? AND snapshot_id = ? LIMIT 1');
        const insertStmt = this.db.prepare('INSERT INTO VerificationIssues (source_file_id, issue_type, details, target_item, status) VALUES (?, ?, ?, ?, ?)');
        const insertAll = this.db.transaction(() => {
            for (const issue of issues) {
                let fileId = null;
                if (issue.sourceFile) {
                    const row = findFileStmt.get(issue.sourceFile, projectId, snapshotId);
                    if (row)
                        fileId = row.file_id;
                }
                insertStmt.run(fileId, issue.issueType, issue.details, issue.targetItem || null, issue.status || 'New');
            }
        });
        insertAll();
    }
    close() {
        this.db.close();
    }
}
exports.ParserPersistence = ParserPersistence;
//# sourceMappingURL=parserPersistence.js.map