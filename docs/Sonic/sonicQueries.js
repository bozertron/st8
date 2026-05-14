"use strict";
// src/commands/sonicQueries.ts
// Sonic-powered query layer: fast Sonic lookup → SQLite enrichment, with graceful fallback.
// Each function: try Sonic first, fall back to pure SQLite if Sonic unavailable.
// Performance metrics: track and log query times for Sonic vs SQLite paths.
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SonicQueries = void 0;
exports.getSonicQueries = getSonicQueries;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const sonicClient_js_1 = require("./sonicClient.js");
const databasePersister_js_1 = require("./integr8/databasePersister.js");
// ============ CONSTANTS ============
const COLLECTION = 'codebase';
// ============ QUERY CLASS ============
class SonicQueries {
    constructor(client, dbPath) {
        this.client = client !== null && client !== void 0 ? client : sonicClient_js_1.sonicClient;
        this.dbPath = dbPath !== null && dbPath !== void 0 ? dbPath : (0, databasePersister_js_1.getSharedDatabasePath)();
    }
    // ─── findImportsOf ──────────────────────────────────────────────────────────
    /**
     * Find all import edges for a given symbol.
     * Sonic query → SQLite edge fetch (<5ms target vs 325ms pure SQLite).
     */
    findImportsOf(symbol, graphId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            let sonicTimeMs;
            let sqliteTimeMs;
            let source = 'sqlite';
            // Try Sonic first
            const sonicNodeIds = yield this.trySonicQuery(symbol, graphId);
            if (sonicNodeIds.length > 0) {
                sonicTimeMs = performance.now() - startTime;
                source = 'sonic+sqlite';
                // Use Sonic IDs to do targeted SQLite edge fetch
                const sqlStart = performance.now();
                const edges = this.fetchImportEdgesForNodeIds(sonicNodeIds, graphId);
                sqliteTimeMs = performance.now() - sqlStart;
                return {
                    data: edges,
                    source,
                    queryTimeMs: performance.now() - startTime,
                    sonicTimeMs,
                    sqliteTimeMs,
                };
            }
            // Fallback: pure SQLite
            const sqlStart = performance.now();
            const edges = this.findImportsSQLite(symbol, graphId);
            sqliteTimeMs = performance.now() - sqlStart;
            return {
                data: edges,
                source: 'sqlite',
                queryTimeMs: performance.now() - startTime,
                sqliteTimeMs,
            };
        });
    }
    // ─── findConsumersOf ────────────────────────────────────────────────────────
    /**
     * Find all nodes that consume (import/depend on) a given file.
     * Sonic query → SQLite relationship fetch.
     */
    findConsumersOf(file, graphId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            let sonicTimeMs;
            let sqliteTimeMs;
            // Try Sonic to find the file's node IDs
            const fileName = path.basename(file);
            const sonicNodeIds = yield this.trySonicQuery(fileName, graphId);
            if (sonicNodeIds.length > 0) {
                sonicTimeMs = performance.now() - startTime;
                const sqlStart = performance.now();
                const consumers = this.fetchConsumersForNodeIds(sonicNodeIds, file, graphId);
                sqliteTimeMs = performance.now() - sqlStart;
                return {
                    data: consumers,
                    source: 'sonic+sqlite',
                    queryTimeMs: performance.now() - startTime,
                    sonicTimeMs,
                    sqliteTimeMs,
                };
            }
            // Fallback: pure SQLite
            const sqlStart = performance.now();
            const consumers = this.findConsumersSQLite(file, graphId);
            sqliteTimeMs = performance.now() - sqlStart;
            return {
                data: consumers,
                source: 'sqlite',
                queryTimeMs: performance.now() - startTime,
                sqliteTimeMs,
            };
        });
    }
    // ─── searchSymbols ──────────────────────────────────────────────────────────
    /**
     * Full-text symbol search with fuzzy matching.
     * Uses Sonic for initial lookup, SQLite for full details.
     */
    searchSymbols(query, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = performance.now();
            const limit = (_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : 20;
            const graphId = options === null || options === void 0 ? void 0 : options.graphId;
            let sonicTimeMs;
            let sqliteTimeMs;
            // Try Sonic first
            const sonicIds = yield this.trySonicQuery(query, graphId, limit);
            if (sonicIds.length > 0) {
                sonicTimeMs = performance.now() - startTime;
                const sqlStart = performance.now();
                const results = this.fetchSymbolDetails(sonicIds, options);
                sqliteTimeMs = performance.now() - sqlStart;
                return {
                    data: results,
                    source: 'sonic+sqlite',
                    queryTimeMs: performance.now() - startTime,
                    sonicTimeMs,
                    sqliteTimeMs,
                };
            }
            // Fallback: SQLite LIKE search
            const sqlStart = performance.now();
            const results = this.searchSymbolsSQLite(query, options);
            sqliteTimeMs = performance.now() - sqlStart;
            return {
                data: results,
                source: 'sqlite',
                queryTimeMs: performance.now() - startTime,
                sqliteTimeMs,
            };
        });
    }
    // ─── getDirectorySubgraph ───────────────────────────────────────────────────
    /**
     * Fast directory content lookup.
     * Uses Sonic to find file IDs in a directory, then SQLite for full graph data.
     */
    getDirectorySubgraph(dir, graphId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            let sonicTimeMs;
            let sqliteTimeMs;
            // Extract directory name for Sonic lookup
            const dirName = path.basename(dir) || dir;
            const sonicIds = yield this.trySonicQuery(dirName, graphId, 100);
            if (sonicIds.length > 0) {
                sonicTimeMs = performance.now() - startTime;
                const sqlStart = performance.now();
                const result = this.fetchDirectorySubgraphSQLite(dir, sonicIds, graphId);
                sqliteTimeMs = performance.now() - sqlStart;
                return {
                    data: result,
                    source: 'sonic+sqlite',
                    queryTimeMs: performance.now() - startTime,
                    sonicTimeMs,
                    sqliteTimeMs,
                };
            }
            // Fallback: pure SQLite path scan
            const sqlStart = performance.now();
            const result = this.fetchDirectorySubgraphSQLite(dir, [], graphId);
            sqliteTimeMs = performance.now() - sqlStart;
            return {
                data: result,
                source: 'sqlite',
                queryTimeMs: performance.now() - startTime,
                sqliteTimeMs,
            };
        });
    }
    // ─── suggestCompletions ─────────────────────────────────────────────────────
    /**
     * Autocomplete via Sonic suggest().
     * Pure Sonic operation — no SQLite fallback needed for suggestions.
     */
    suggestCompletions(prefix, graphId, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            const bucket = graphId || 'nodes';
            const maxResults = limit !== null && limit !== void 0 ? limit : 10;
            try {
                const suggestions = yield this.client.suggest(COLLECTION, bucket, prefix, maxResults);
                return {
                    data: suggestions,
                    source: 'sonic',
                    queryTimeMs: performance.now() - startTime,
                    sonicTimeMs: performance.now() - startTime,
                };
            }
            catch (_a) {
                // Fallback: SQLite prefix search
                const sqlStart = performance.now();
                const results = this.suggestFromSQLite(prefix, graphId, maxResults);
                return {
                    data: results,
                    source: 'sqlite',
                    queryTimeMs: performance.now() - startTime,
                    sqliteTimeMs: performance.now() - sqlStart,
                };
            }
        });
    }
    // ─── findRelatedFiles ──────────────────────────────────────────────────────
    /**
     * Find files connected to a given file via imports/exports.
     */
    findRelatedFiles(file, graphId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            let sonicTimeMs;
            let sqliteTimeMs;
            const fileName = path.basename(file);
            const sonicIds = yield this.trySonicQuery(fileName, graphId);
            if (sonicIds.length > 0) {
                sonicTimeMs = performance.now() - startTime;
                const sqlStart = performance.now();
                const related = this.fetchRelatedFilesSQLite(sonicIds, file, graphId);
                sqliteTimeMs = performance.now() - sqlStart;
                return {
                    data: related,
                    source: 'sonic+sqlite',
                    queryTimeMs: performance.now() - startTime,
                    sonicTimeMs,
                    sqliteTimeMs,
                };
            }
            // Fallback
            const sqlStart = performance.now();
            const related = this.fetchRelatedFilesSQLite([], file, graphId);
            sqliteTimeMs = performance.now() - sqlStart;
            return {
                data: related,
                source: 'sqlite',
                queryTimeMs: performance.now() - startTime,
                sqliteTimeMs,
            };
        });
    }
    // ─── Sonic Helpers ──────────────────────────────────────────────────────────
    trySonicQuery(terms, graphId, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bucket = graphId || 'nodes';
                const results = yield this.client.query(COLLECTION, bucket, terms, limit);
                return results;
            }
            catch (_a) {
                return [];
            }
        });
    }
    // ─── SQLite Query Implementations ───────────────────────────────────────────
    getDb() {
        return new better_sqlite3_1.default(this.dbPath, { readonly: true });
    }
    fetchImportEdgesForNodeIds(sonicObjectIds, graphId) {
        const db = this.getDb();
        try {
            // Parse node IDs from Sonic object IDs (format: "node:projectId:nodeId" or "projectId:nodeId")
            const nodeIds = this.extractNodeIds(sonicObjectIds);
            if (nodeIds.length === 0)
                return [];
            const placeholders = nodeIds.map(() => '?').join(',');
            let query = `SELECT * FROM GraphEdges WHERE edge_type = 'imports' AND to_node_id IN (${placeholders})`;
            const params = [...nodeIds];
            if (graphId) {
                query += ' AND graph_id = ?';
                params.push(graphId);
            }
            return db.prepare(query).all(...params);
        }
        catch (err) {
            console.warn(`[SonicQueries] fetchImportEdges failed: ${err.message}`);
            return [];
        }
        finally {
            db.close();
        }
    }
    findImportsSQLite(symbol, graphId) {
        const db = this.getDb();
        try {
            let query;
            const params = [];
            if (graphId) {
                query = `
          SELECT e.* FROM GraphEdges e
          JOIN GraphNodes n ON e.to_node_id = n.node_id AND e.graph_id = n.graph_id
          WHERE e.edge_type = 'imports' AND n.name = ? AND e.graph_id = ?
        `;
                params.push(symbol, graphId);
            }
            else {
                query = `
          SELECT e.* FROM GraphEdges e
          JOIN GraphNodes n ON e.to_node_id = n.node_id AND e.graph_id = n.graph_id
          WHERE e.edge_type = 'imports' AND n.name = ?
        `;
                params.push(symbol);
            }
            return db.prepare(query).all(...params);
        }
        catch (err) {
            console.warn(`[SonicQueries] findImportsSQLite failed: ${err.message}`);
            return [];
        }
        finally {
            db.close();
        }
    }
    fetchConsumersForNodeIds(sonicObjectIds, filePath, graphId) {
        const db = this.getDb();
        try {
            // First find the target file nodes
            let fileQuery;
            const fileParams = [];
            if (graphId) {
                fileQuery = `SELECT node_id FROM GraphNodes WHERE (path LIKE ? OR name = ?) AND graph_id = ?`;
                fileParams.push(`%${path.basename(filePath)}`, filePath, graphId);
            }
            else {
                fileQuery = `SELECT node_id FROM GraphNodes WHERE (path LIKE ? OR name = ?)`;
                fileParams.push(`%${path.basename(filePath)}`, filePath);
            }
            const fileNodes = db.prepare(fileQuery).all(...fileParams);
            const fileNodeIds = fileNodes.map((r) => r.node_id);
            if (fileNodeIds.length === 0)
                return [];
            // Find all edges pointing TO these file nodes
            const placeholders = fileNodeIds.map(() => '?').join(',');
            let edgeQuery = `SELECT DISTINCT from_node_id FROM GraphEdges WHERE to_node_id IN (${placeholders})`;
            const edgeParams = [...fileNodeIds];
            if (graphId) {
                edgeQuery += ' AND graph_id = ?';
                edgeParams.push(graphId);
            }
            const edgeRows = db.prepare(edgeQuery).all(...edgeParams);
            const consumerIds = edgeRows.map((r) => r.from_node_id).filter((id) => !fileNodeIds.includes(id));
            if (consumerIds.length === 0)
                return [];
            const cPlaceholders = consumerIds.map(() => '?').join(',');
            let nodeQuery = `SELECT * FROM GraphNodes WHERE node_id IN (${cPlaceholders})`;
            const nodeParams = [...consumerIds];
            if (graphId) {
                nodeQuery += ' AND graph_id = ?';
                nodeParams.push(graphId);
            }
            return db.prepare(nodeQuery).all(...nodeParams);
        }
        catch (err) {
            console.warn(`[SonicQueries] fetchConsumers failed: ${err.message}`);
            return [];
        }
        finally {
            db.close();
        }
    }
    findConsumersSQLite(filePath, graphId) {
        return this.fetchConsumersForNodeIds([], filePath, graphId);
    }
    fetchSymbolDetails(sonicObjectIds, options) {
        const db = this.getDb();
        try {
            const nodeIds = this.extractNodeIds(sonicObjectIds);
            if (nodeIds.length === 0)
                return [];
            const placeholders = nodeIds.map(() => '?').join(',');
            let query = `SELECT * FROM GraphNodes WHERE node_id IN (${placeholders})`;
            const params = [...nodeIds];
            if (options === null || options === void 0 ? void 0 : options.graphId) {
                query += ' AND graph_id = ?';
                params.push(options.graphId);
            }
            if (options === null || options === void 0 ? void 0 : options.type) {
                query += ' AND node_type = ?';
                params.push(options.type);
            }
            if (options === null || options === void 0 ? void 0 : options.limit) {
                query += ` LIMIT ${options.limit}`;
            }
            const rows = db.prepare(query).all(...params);
            return rows.map(this.mapToSymbolResult);
        }
        catch (err) {
            console.warn(`[SonicQueries] fetchSymbolDetails failed: ${err.message}`);
            return [];
        }
        finally {
            db.close();
        }
    }
    searchSymbolsSQLite(query, options) {
        var _a;
        const db = this.getDb();
        try {
            const limit = (_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : 20;
            let sql;
            const params = [];
            if (options === null || options === void 0 ? void 0 : options.graphId) {
                sql = `SELECT * FROM GraphNodes WHERE name LIKE ? AND graph_id = ?`;
                params.push(`%${query}%`, options.graphId);
            }
            else {
                sql = `SELECT * FROM GraphNodes WHERE name LIKE ?`;
                params.push(`%${query}%`);
            }
            if (options === null || options === void 0 ? void 0 : options.type) {
                sql += ' AND node_type = ?';
                params.push(options.type);
            }
            sql += ` LIMIT ${limit}`;
            const rows = db.prepare(sql).all(...params);
            return rows.map(this.mapToSymbolResult);
        }
        catch (err) {
            console.warn(`[SonicQueries] searchSymbolsSQLite failed: ${err.message}`);
            return [];
        }
        finally {
            db.close();
        }
    }
    fetchDirectorySubgraphSQLite(dir, _sonicIds, graphId) {
        const db = this.getDb();
        try {
            // Find all nodes whose path starts with this directory
            let nodeQuery;
            const nodeParams = [];
            if (graphId) {
                nodeQuery = `SELECT * FROM GraphNodes WHERE path LIKE ? AND graph_id = ?`;
                nodeParams.push(`${dir}%`, graphId);
            }
            else {
                nodeQuery = `SELECT * FROM GraphNodes WHERE path LIKE ?`;
                nodeParams.push(`${dir}%`);
            }
            const nodes = db.prepare(nodeQuery).all(...nodeParams);
            const nodeIdSet = new Set(nodes.map(n => n.node_id));
            if (nodes.length === 0) {
                return { nodes: [], edges: [] };
            }
            // Find edges where both endpoints are in this directory
            const placeholders = nodes.map(() => '?').join(',');
            let edgeQuery = `SELECT * FROM GraphEdges WHERE from_node_id IN (${placeholders}) OR to_node_id IN (${placeholders})`;
            const edgeParams = [...nodes.map(n => n.node_id), ...nodes.map(n => n.node_id)];
            if (graphId) {
                edgeQuery += ' AND graph_id = ?';
                edgeParams.push(graphId);
            }
            const allEdges = db.prepare(edgeQuery).all(...edgeParams);
            // Filter to only edges internal to the directory
            const edges = allEdges.filter(e => nodeIdSet.has(e.from_node_id) && nodeIdSet.has(e.to_node_id));
            return { nodes, edges };
        }
        catch (err) {
            console.warn(`[SonicQueries] fetchDirectorySubgraph failed: ${err.message}`);
            return { nodes: [], edges: [] };
        }
        finally {
            db.close();
        }
    }
    suggestFromSQLite(prefix, graphId, limit) {
        const db = this.getDb();
        try {
            const maxResults = limit !== null && limit !== void 0 ? limit : 10;
            let query;
            const params = [];
            if (graphId) {
                query = `SELECT DISTINCT name FROM GraphNodes WHERE name LIKE ? AND graph_id = ? LIMIT ?`;
                params.push(`${prefix}%`, graphId, maxResults);
            }
            else {
                query = `SELECT DISTINCT name FROM GraphNodes WHERE name LIKE ? LIMIT ?`;
                params.push(`${prefix}%`, maxResults);
            }
            const rows = db.prepare(query).all(...params);
            return rows.map((r) => r.name);
        }
        catch (err) {
            console.warn(`[SonicQueries] suggestFromSQLite failed: ${err.message}`);
            return [];
        }
        finally {
            db.close();
        }
    }
    fetchRelatedFilesSQLite(sonicObjectIds, filePath, graphId) {
        const db = this.getDb();
        try {
            // Find the target file's node IDs
            let fileQuery;
            const fileParams = [];
            if (graphId) {
                fileQuery = `SELECT node_id FROM GraphNodes WHERE (path LIKE ? OR path = ?) AND graph_id = ?`;
                fileParams.push(`%${path.basename(filePath)}`, filePath, graphId);
            }
            else {
                fileQuery = `SELECT node_id FROM GraphNodes WHERE (path LIKE ? OR path = ?)`;
                fileParams.push(`%${path.basename(filePath)}`, filePath);
            }
            const fileNodes = db.prepare(fileQuery).all(...fileParams);
            const fileNodeIds = fileNodes.map((r) => r.node_id);
            if (fileNodeIds.length === 0)
                return [];
            const results = [];
            const placeholders = fileNodeIds.map(() => '?').join(',');
            // Outbound: edges FROM this file
            let outQuery = `
        SELECT e.edge_type, n.node_id, n.path
        FROM GraphEdges e
        JOIN GraphNodes n ON e.to_node_id = n.node_id AND e.graph_id = n.graph_id
        WHERE e.from_node_id IN (${placeholders}) AND n.path IS NOT NULL
      `;
            const outParams = [...fileNodeIds];
            if (graphId) {
                outQuery += ' AND e.graph_id = ?';
                outParams.push(graphId);
            }
            const outRows = db.prepare(outQuery).all(...outParams);
            for (const row of outRows) {
                if (row.path && !fileNodeIds.includes(row.node_id)) {
                    results.push({
                        filePath: row.path,
                        nodeId: row.node_id,
                        relationship: row.edge_type,
                        direction: 'outbound',
                    });
                }
            }
            // Inbound: edges TO this file
            let inQuery = `
        SELECT e.edge_type, n.node_id, n.path
        FROM GraphEdges e
        JOIN GraphNodes n ON e.from_node_id = n.node_id AND e.graph_id = n.graph_id
        WHERE e.to_node_id IN (${placeholders}) AND n.path IS NOT NULL
      `;
            const inParams = [...fileNodeIds];
            if (graphId) {
                inQuery += ' AND e.graph_id = ?';
                inParams.push(graphId);
            }
            const inRows = db.prepare(inQuery).all(...inParams);
            for (const row of inRows) {
                if (row.path && !fileNodeIds.includes(row.node_id)) {
                    results.push({
                        filePath: row.path,
                        nodeId: row.node_id,
                        relationship: row.edge_type,
                        direction: 'inbound',
                    });
                }
            }
            // Deduplicate by filePath
            const seen = new Set();
            return results.filter(r => {
                if (seen.has(r.filePath))
                    return false;
                seen.add(r.filePath);
                return true;
            });
        }
        catch (err) {
            console.warn(`[SonicQueries] fetchRelatedFiles failed: ${err.message}`);
            return [];
        }
        finally {
            db.close();
        }
    }
    // ─── Utility ────────────────────────────────────────────────────────────────
    /**
     * Extract numeric node IDs from Sonic object ID strings.
     * Handles formats: "node:projId:123", "projId:123", "123"
     */
    extractNodeIds(objectIds) {
        const ids = [];
        for (const oid of objectIds) {
            const parts = oid.split(':');
            const lastPart = parts[parts.length - 1];
            const num = parseInt(lastPart, 10);
            if (!isNaN(num)) {
                ids.push(num);
            }
        }
        return ids;
    }
    mapToSymbolResult(row) {
        return {
            nodeId: row.node_id,
            graphId: row.graph_id,
            name: row.name,
            nodeType: row.node_type,
            path: row.path || null,
            metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
        };
    }
}
exports.SonicQueries = SonicQueries;
// ============ SINGLETON ============
let _queryInstance = null;
function getSonicQueries(client, dbPath) {
    if (!_queryInstance) {
        _queryInstance = new SonicQueries(client, dbPath);
    }
    return _queryInstance;
}
//# sourceMappingURL=sonicQueries.js.map