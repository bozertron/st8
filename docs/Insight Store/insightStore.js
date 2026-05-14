"use strict";
// src/commands/insightStore.ts
// FileInsightSlot-based insight accumulation store.
// Each parse pass adds insights per file; queries allow retrieval by file, category, or recency.
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
exports.InsightStore = void 0;
exports.getInsightStore = getInsightStore;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const crypto = __importStar(require("crypto"));
const databasePersister_js_1 = require("./integr8/databasePersister.js");
// ============ INSIGHT STORE ============
class InsightStore {
    constructor(dbPath) {
        const resolvedPath = dbPath || (0, databasePersister_js_1.getSharedDatabasePath)();
        this.db = new better_sqlite3_1.default(resolvedPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
        this.ensureTables();
    }
    // ─── Table Setup ────────────────────────────────────────────────────────────
    ensureTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS FileInsightSlots (
        file_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        total_insights INTEGER DEFAULT 0,
        last_pass_number INTEGER DEFAULT 0,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS InsightRecords (
        insight_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        pass_number INTEGER NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        description TEXT NOT NULL,
        evidence TEXT DEFAULT '',
        related_node_ids TEXT DEFAULT '[]',
        context TEXT DEFAULT '{}',
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES FileInsightSlots(file_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_insights_project ON InsightRecords(project_id);
      CREATE INDEX IF NOT EXISTS idx_insights_file ON InsightRecords(file_id);
      CREATE INDEX IF NOT EXISTS idx_insights_category ON InsightRecords(category);
      CREATE INDEX IF NOT EXISTS idx_insights_severity ON InsightRecords(severity);
      CREATE INDEX IF NOT EXISTS idx_insights_timestamp ON InsightRecords(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_insight_slots_project ON FileInsightSlots(project_id);
    `);
    }
    // ─── File Slot Management ───────────────────────────────────────────────────
    /**
     * Ensure a file insight slot exists. Creates if missing.
     * Returns the fileId.
     */
    ensureFileSlot(projectId, filePath) {
        const fileId = this.generateFileId(projectId, filePath);
        const existing = this.db.prepare('SELECT file_id FROM FileInsightSlots WHERE file_id = ?').get(fileId);
        if (!existing) {
            this.db.prepare('INSERT INTO FileInsightSlots (file_id, project_id, file_path) VALUES (?, ?, ?)').run(fileId, projectId, filePath);
        }
        return fileId;
    }
    /**
     * Get or create a file insight slot.
     */
    getFileSlot(projectId, filePath) {
        const fileId = this.generateFileId(projectId, filePath);
        const row = this.db.prepare('SELECT * FROM FileInsightSlots WHERE file_id = ?').get(fileId);
        if (!row)
            return null;
        // Get distinct categories for this file
        const categories = this.db.prepare('SELECT DISTINCT category FROM InsightRecords WHERE file_id = ?').all(fileId);
        return {
            fileId: row.file_id,
            projectId: row.project_id,
            filePath: row.file_path,
            totalInsights: row.total_insights,
            lastPassNumber: row.last_pass_number,
            lastUpdated: row.last_updated,
            categories: categories.map(c => c.category),
        };
    }
    // ─── Insight Recording ──────────────────────────────────────────────────────
    /**
     * Record a new insight for a file. Automatically updates the file slot counters.
     */
    addInsight(insight) {
        const insightId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        // Ensure file slot exists
        this.ensureFileSlot(insight.projectId, insight.filePath);
        const insertInsight = this.db.prepare(`
      INSERT INTO InsightRecords (insight_id, project_id, file_id, file_path, pass_number, category, severity, description, evidence, related_node_ids, context, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const updateSlot = this.db.prepare(`
      UPDATE FileInsightSlots 
      SET total_insights = total_insights + 1,
          last_pass_number = MAX(last_pass_number, ?),
          last_updated = ?
      WHERE file_id = ?
    `);
        const transaction = this.db.transaction(() => {
            insertInsight.run(insightId, insight.projectId, insight.fileId, insight.filePath, insight.passNumber, insight.category, insight.severity, insight.description, insight.evidence, JSON.stringify(insight.relatedNodeIds), JSON.stringify(insight.context), timestamp);
            updateSlot.run(insight.passNumber, timestamp, insight.fileId);
        });
        transaction();
        return Object.assign(Object.assign({}, insight), { insightId, timestamp });
    }
    /**
     * Record multiple insights in a single transaction (batch insert).
     */
    addInsightsBatch(insights) {
        if (insights.length === 0)
            return 0;
        const insertInsight = this.db.prepare(`
      INSERT INTO InsightRecords (insight_id, project_id, file_id, file_path, pass_number, category, severity, description, evidence, related_node_ids, context, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const updateSlot = this.db.prepare(`
      UPDATE FileInsightSlots 
      SET total_insights = total_insights + 1,
          last_pass_number = MAX(last_pass_number, ?),
          last_updated = ?
      WHERE file_id = ?
    `);
        const timestamp = new Date().toISOString();
        let count = 0;
        const transaction = this.db.transaction(() => {
            for (const insight of insights) {
                const insightId = crypto.randomUUID();
                this.ensureFileSlot(insight.projectId, insight.filePath);
                insertInsight.run(insightId, insight.projectId, insight.fileId, insight.filePath, insight.passNumber, insight.category, insight.severity, insight.description, insight.evidence, JSON.stringify(insight.relatedNodeIds), JSON.stringify(insight.context), timestamp);
                updateSlot.run(insight.passNumber, timestamp, insight.fileId);
                count++;
            }
        });
        transaction();
        return count;
    }
    // ─── Queries ────────────────────────────────────────────────────────────────
    /**
     * Get all insights for a specific file.
     */
    getInsightsForFile(projectId, filePath) {
        const fileId = this.generateFileId(projectId, filePath);
        const rows = this.db.prepare('SELECT * FROM InsightRecords WHERE file_id = ? ORDER BY pass_number ASC, timestamp ASC').all(fileId);
        return rows.map(this.rowToInsight);
    }
    /**
     * Get insights filtered by category.
     */
    getInsightsByCategory(category, projectId, limit) {
        let sql = 'SELECT * FROM InsightRecords WHERE category = ?';
        const params = [category];
        if (projectId) {
            sql += ' AND project_id = ?';
            params.push(projectId);
        }
        sql += ' ORDER BY timestamp DESC';
        if (limit) {
            sql += ' LIMIT ?';
            params.push(limit);
        }
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToInsight);
    }
    /**
     * Get most recent insights across all files.
     */
    getRecentInsights(projectId, limit = 50) {
        let sql = 'SELECT * FROM InsightRecords';
        const params = [];
        if (projectId) {
            sql += ' WHERE project_id = ?';
            params.push(projectId);
        }
        sql += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToInsight);
    }
    /**
     * Query insights with flexible filtering.
     */
    queryInsights(query) {
        const conditions = [];
        const params = [];
        if (query.projectId) {
            conditions.push('project_id = ?');
            params.push(query.projectId);
        }
        if (query.fileId) {
            conditions.push('file_id = ?');
            params.push(query.fileId);
        }
        if (query.filePath) {
            conditions.push('file_path = ?');
            params.push(query.filePath);
        }
        if (query.category) {
            conditions.push('category = ?');
            params.push(query.category);
        }
        if (query.severity) {
            conditions.push('severity = ?');
            params.push(query.severity);
        }
        if (query.minPassNumber !== undefined) {
            conditions.push('pass_number >= ?');
            params.push(query.minPassNumber);
        }
        let sql = 'SELECT * FROM InsightRecords';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY timestamp DESC';
        if (query.limit) {
            sql += ' LIMIT ?';
            params.push(query.limit);
        }
        if (query.offset) {
            sql += ' OFFSET ?';
            params.push(query.offset);
        }
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(this.rowToInsight);
    }
    /**
     * Get summary counts per category for a project.
     */
    getCategorySummary(projectId) {
        const rows = this.db.prepare('SELECT category, COUNT(*) as count FROM InsightRecords WHERE project_id = ? GROUP BY category').all(projectId);
        const summary = {};
        for (const row of rows) {
            summary[row.category] = row.count;
        }
        return summary;
    }
    /**
     * Get all file slots for a project.
     */
    getFileSlots(projectId) {
        const rows = this.db.prepare('SELECT * FROM FileInsightSlots WHERE project_id = ? ORDER BY last_updated DESC').all(projectId);
        return rows.map(row => ({
            fileId: row.file_id,
            projectId: row.project_id,
            filePath: row.file_path,
            totalInsights: row.total_insights,
            lastPassNumber: row.last_pass_number,
            lastUpdated: row.last_updated,
            categories: [],
        }));
    }
    // ─── Cleanup ────────────────────────────────────────────────────────────────
    /**
     * Remove all insights for a project.
     */
    clearProject(projectId) {
        const transaction = this.db.transaction(() => {
            this.db.prepare('DELETE FROM InsightRecords WHERE project_id = ?').run(projectId);
            this.db.prepare('DELETE FROM FileInsightSlots WHERE project_id = ?').run(projectId);
        });
        transaction();
    }
    /**
     * Remove all insights for a specific file.
     */
    clearFile(projectId, filePath) {
        const fileId = this.generateFileId(projectId, filePath);
        const transaction = this.db.transaction(() => {
            this.db.prepare('DELETE FROM InsightRecords WHERE file_id = ?').run(fileId);
            this.db.prepare('DELETE FROM FileInsightSlots WHERE file_id = ?').run(fileId);
        });
        transaction();
    }
    /**
     * Close the database connection.
     */
    close() {
        this.db.close();
    }
    // ─── Private Helpers ────────────────────────────────────────────────────────
    generateFileId(projectId, filePath) {
        const hash = crypto.createHash('sha256')
            .update(`${projectId}::${filePath}`)
            .digest('hex')
            .substring(0, 16);
        return `file_${hash}`;
    }
    rowToInsight(row) {
        return {
            insightId: row.insight_id,
            projectId: row.project_id,
            fileId: row.file_id,
            filePath: row.file_path,
            passNumber: row.pass_number,
            category: row.category,
            severity: row.severity,
            description: row.description,
            evidence: row.evidence || '',
            relatedNodeIds: JSON.parse(row.related_node_ids || '[]'),
            context: JSON.parse(row.context || '{}'),
            timestamp: row.timestamp,
        };
    }
}
exports.InsightStore = InsightStore;
// ============ SINGLETON FACTORY ============
let _insightStore = null;
/**
 * Get or create the shared InsightStore instance.
 */
function getInsightStore(dbPath) {
    if (!_insightStore) {
        _insightStore = new InsightStore(dbPath);
    }
    return _insightStore;
}
//# sourceMappingURL=insightStore.js.map