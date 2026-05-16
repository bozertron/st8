"use strict";
// ─────────────────────────────────────────────────────────────────────
// GENERATED ARTIFACT — DO NOT HAND-EDIT.
//
// Provenance (ticket 14, Wave 1B decision, 2026-05-15):
//   Upstream:  maestro-scaffolder-tool/src/commands/integr8/databasePersister.ts
//   Compiler:  tsc (see the __createBinding / __importStar boilerplate
//              and the trailing `//# sourceMappingURL=databasePersister.js.map`
//              footer — both are tell-tale tsc output markers).
//
// Status:      READ-ONLY in this repo. Any change must be made in the
//              upstream .ts source and round-tripped back through tsc;
//              hand-edits here will be silently clobbered the next time
//              the maestro snapshot is re-vendored.
//
// Why we keep it:
//   * insight-store.js (src/features/analysis/) imports
//     getSharedDatabasePath() from this file to locate the project-
//     scoped scaffolder_data.sqlite — a DIFFERENT database file from
//     st8.sqlite, used by the integr8 pipeline.
//   * sonic-indexer, sonic-queries, traversal, integr8/index,
//     parser-persistence, background-indexer all reference the
//     DatabasePersister class for graph storage in scaffolder_data.sqlite.
//   * persistence.js (st8.sqlite owner) deliberately does NOT use the
//     DatabasePersister class — the maestro-fallthrough was removed in
//     ticket 6. The two databases are independent.
//
// .gitattributes marks this file with `linguist-generated=true` so
// review tools collapse the diff and surface only the upstream .ts edits.
//
// Original header from the tsc compile:
//   src/commands/integr8/databasePersister.ts
//   Direct Node.js-to-SQLite persistence for integr8's semantic graph.
// ─────────────────────────────────────────────────────────────────────
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
exports.DatabasePersister = void 0;
exports.getSharedDatabasePath = getSharedDatabasePath;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
/**
 * Returns the shared database path matching the Tauri backend convention.
 * Linux: ~/.local/share/com.scaffolder.app/scaffolder_data.sqlite
 * macOS: ~/Library/Application Support/com.scaffolder.app/scaffolder_data.sqlite
 * Windows: %APPDATA%/com.scaffolder.app/scaffolder_data.sqlite
 *
 * Wave 5B ticket 6 note: ground-plane.js renamed APP_ID to 'com.st8.app' to
 * match founder guidance ("st8 is its own thing"). This function intentionally
 * still points at 'com.scaffolder.app' because (a) InsightStore (compiled-from-TS,
 * risky to edit) and the legacy integr8 pipeline write to scaffolder_data.sqlite
 * at this path — renaming would orphan existing on-disk insight data on every
 * developer's machine, and (b) this is the *database file location*, not the
 * st8 identity. A future migration ticket can introduce a getSharedDatabasePath
 * v2 that reads from com.st8.app and migrates rows on first boot.
 */
function getSharedDatabasePath() {
    const platform = os.platform();
    let dataDir;
    if (platform === 'linux') {
        dataDir = path.join(os.homedir(), '.local', 'share');
    }
    else if (platform === 'darwin') {
        dataDir = path.join(os.homedir(), 'Library', 'Application Support');
    }
    else {
        dataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    }
    return path.join(dataDir, 'com.scaffolder.app', 'scaffolder_data.sqlite');
}
class DatabasePersister {
    constructor(dbPath) {
        const resolvedPath = dbPath || getSharedDatabasePath();
        // Ensure directory exists
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        this.db = new better_sqlite3_1.default(resolvedPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.initializeDatabase();
    }
    /**
     * Creates tables EXACTLY matching src-tauri/src/database/schema.rs
     * for the graph/migration tables (GraphNodes, GraphEdges, MigrationPlans, IntegrationSnapshots).
     */
    initializeDatabase() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS GraphNodes (
        node_id INTEGER PRIMARY KEY AUTOINCREMENT,
        graph_id TEXT NOT NULL,
        node_type TEXT NOT NULL CHECK(node_type IN ('file','store','route','command','type','import','export','component')),
        name TEXT NOT NULL,
        path TEXT,
        metadata_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS GraphEdges (
        edge_id INTEGER PRIMARY KEY AUTOINCREMENT,
        graph_id TEXT NOT NULL,
        from_node_id INTEGER NOT NULL,
        to_node_id INTEGER NOT NULL,
        edge_type TEXT NOT NULL CHECK(edge_type IN ('depends_on','imports','exports','navigates_to','invokes','conflicts_with','contains')),
        status TEXT CHECK(status IN ('SAFE','NEEDS_REWRITE','CONFLICT','MISSING')),
        confidence REAL DEFAULT 1.0,
        FOREIGN KEY (from_node_id) REFERENCES GraphNodes(node_id) ON DELETE CASCADE,
        FOREIGN KEY (to_node_id) REFERENCES GraphNodes(node_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS MigrationPlans (
        plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
        integration_id TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        outcome TEXT NOT NULL CHECK(outcome IN ('SUCCESS','PARTIAL','FAILURE','AMBIGUOUS','REDIRECT')),
        estimated_complexity TEXT CHECK(estimated_complexity IN ('low','medium','high')),
        steps_json TEXT NOT NULL,
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS IntegrationSnapshots (
        snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
        integration_id TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        snapshot_type TEXT NOT NULL CHECK(snapshot_type IN ('pre','post')),
        data_json TEXT NOT NULL,
        FOREIGN KEY (integration_id) REFERENCES MigrationPlans(integration_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON GraphNodes(graph_id);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_graph_id ON GraphEdges(graph_id);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON GraphEdges(from_node_id);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON GraphEdges(to_node_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_integration ON IntegrationSnapshots(integration_id);
    `);
    }
    /**
     * Persists graph nodes and edges into SQLite using a single transaction.
     * Maps string node IDs to database integer IDs for edge FK integrity.
     */
    saveGraph(graphId, nodes, edges, properties) {
        const insertNode = this.db.prepare('INSERT INTO GraphNodes (graph_id, node_type, name, path, metadata_json) VALUES (?, ?, ?, ?, ?)');
        const insertEdge = this.db.prepare('INSERT INTO GraphEdges (graph_id, from_node_id, to_node_id, edge_type, status, confidence) VALUES (?, ?, ?, ?, ?, ?)');
        // Map original string IDs to auto-incremented DB row IDs
        const nodeIdMap = new Map();
        const saveAll = this.db.transaction(() => {
            var _a;
            // Insert nodes
            for (const node of nodes) {
                const result = insertNode.run(graphId, node.type, node.name, node.path || null, node.metadata ? JSON.stringify(node.metadata) : null);
                nodeIdMap.set(node.id, Number(result.lastInsertRowid));
            }
            // Insert edges (map string IDs to database integer IDs)
            for (const edge of edges) {
                const fromId = nodeIdMap.get(edge.from);
                const toId = nodeIdMap.get(edge.to);
                if (fromId && toId) {
                    insertEdge.run(graphId, fromId, toId, edge.type, edge.status || null, (_a = edge.confidence) !== null && _a !== void 0 ? _a : 1.0);
                }
            }
        });
        saveAll();
    }
    /**
     * Persists a migration plan (INSERT OR REPLACE to handle re-runs).
     */
    saveMigrationPlan(plan) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO MigrationPlans (integration_id, outcome, estimated_complexity, steps_json, source_path, target_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(plan.id, plan.outcome, plan.estimatedComplexity, JSON.stringify(plan.steps), plan.sourcePath, plan.targetPath);
    }
    /**
     * Saves a pre/post integration snapshot for audit trail.
     */
    saveSnapshot(integrationId, type, data) {
        const stmt = this.db.prepare('INSERT INTO IntegrationSnapshots (integration_id, snapshot_type, data_json) VALUES (?, ?, ?)');
        stmt.run(integrationId, type, JSON.stringify(data));
    }
    /**
     * Retrieves a persisted graph by graphId, reconstructing the SemanticGraph structure.
     */
    queryGraph(graphId) {
        const nodes = this.db.prepare('SELECT * FROM GraphNodes WHERE graph_id = ?').all(graphId);
        const edges = this.db.prepare('SELECT * FROM GraphEdges WHERE graph_id = ?').all(graphId);
        if (nodes.length === 0)
            return null;
        return {
            nodes: nodes.map(n => ({
                id: `node_${n.node_id}`,
                type: n.node_type,
                name: n.name,
                path: n.path,
                metadata: n.metadata_json ? JSON.parse(n.metadata_json) : undefined
            })),
            edges: edges.map(e => ({
                id: `edge_${e.edge_id}`,
                from: `node_${e.from_node_id}`,
                to: `node_${e.to_node_id}`,
                type: e.edge_type,
                status: e.status,
                confidence: e.confidence
            })),
            properties: { reachability: 0, stability: 0, fragility: 0 }
        };
    }
    /**
     * Lists all persisted graphs with summary stats.
     */
    listGraphs() {
        const result = this.db.prepare(`
      SELECT graph_id,
        COUNT(*) as node_count,
        (SELECT COUNT(*) FROM GraphEdges WHERE graph_id = gn.graph_id) as edge_count,
        MIN(created_at) as created_at
      FROM GraphNodes gn GROUP BY graph_id
    `).all();
        return result.map(r => ({
            graphId: r.graph_id,
            nodeCount: r.node_count,
            edgeCount: r.edge_count,
            createdAt: r.created_at
        }));
    }
    /**
     * Closes the database connection.
     */
    close() {
        this.db.close();
    }
}
exports.DatabasePersister = DatabasePersister;
//# sourceMappingURL=databasePersister.js.map