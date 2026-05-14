"use strict";
// src/commands/sonicIndexer.ts
// SonicIndexer — transforms graph data into optimized Sonic push operations.
// Handles batch indexing, deduplication, incremental updates, and full re-index.
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
exports.SonicIndexer = void 0;
exports.getSonicIndexer = getSonicIndexer;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const sonicClient_js_1 = require("./sonicClient.js");
const databasePersister_js_1 = require("./integr8/databasePersister.js");
const types_js_1 = require("./integr8/types.js");
// ============ CONSTANTS ============
const COLLECTION = 'codebase';
const BUCKET_NODES = 'nodes';
const BUCKET_EDGES = 'edges';
const BUCKET_FILES = 'files';
const BUCKET_DIRS = 'dirs';
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 5;
const MAX_TEXT_LENGTH = 500;
// ============ SONIC INDEXER ============
class SonicIndexer {
    constructor(client) {
        this.indexedIds = new Set();
        this.connected = false;
        this.client = client !== null && client !== void 0 ? client : sonicClient_js_1.sonicClient;
    }
    // ─── Connection Management ──────────────────────────────────────────────────
    ensureConnected() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connected)
                return true;
            try {
                yield this.client.connect();
                const healthy = yield this.client.isHealthy();
                this.connected = healthy;
                return healthy;
            }
            catch (_a) {
                this.connected = false;
                return false;
            }
        });
    }
    // ─── Graph Node Indexing ────────────────────────────────────────────────────
    /**
     * Push all graph nodes with searchable text (name, type, metadata).
     * Batches pushes for efficiency and flushes after each batch.
     */
    indexGraphNodes(nodes, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.ensureConnected()))
                return 0;
            const bucket = projectId || BUCKET_NODES;
            let pushCount = 0;
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const objectId = this.nodeObjectId(node, projectId);
                // Deduplication: skip if already indexed in this session
                if (this.indexedIds.has(objectId))
                    continue;
                const text = this.buildNodeSearchText(node);
                if (!text)
                    continue;
                try {
                    const ok = yield this.client.push(COLLECTION, bucket, objectId, text);
                    if (ok) {
                        pushCount++;
                        this.indexedIds.add(objectId);
                    }
                }
                catch (_a) {
                    // Non-fatal: continue with remaining nodes
                }
                // Rate limiting: pause after every batch
                if ((i + 1) % BATCH_SIZE === 0) {
                    yield sleep(BATCH_DELAY_MS);
                }
            }
            return pushCount;
        });
    }
    /**
     * Push edge relationships for relationship queries.
     * Indexes edge type + connected node names for searchability.
     */
    indexGraphEdges(edges, nodes, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.ensureConnected()))
                return 0;
            const bucket = projectId || BUCKET_EDGES;
            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            let pushCount = 0;
            for (let i = 0; i < edges.length; i++) {
                const edge = edges[i];
                const objectId = this.edgeObjectId(edge, projectId);
                if (this.indexedIds.has(objectId))
                    continue;
                const fromNode = nodeMap.get(edge.from);
                const toNode = nodeMap.get(edge.to);
                const text = this.buildEdgeSearchText(edge, fromNode, toNode);
                if (!text)
                    continue;
                try {
                    const ok = yield this.client.push(COLLECTION, bucket, objectId, text);
                    if (ok) {
                        pushCount++;
                        this.indexedIds.add(objectId);
                    }
                }
                catch (_a) {
                    // Non-fatal
                }
                if ((i + 1) % BATCH_SIZE === 0) {
                    yield sleep(BATCH_DELAY_MS);
                }
            }
            return pushCount;
        });
    }
    /**
     * Push file paths, exports, and directory structure.
     */
    indexFileMetadata(files, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.ensureConnected()))
                return 0;
            const bucket = projectId || BUCKET_FILES;
            let pushCount = 0;
            const indexedDirs = new Set();
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const objectId = `file:${projectId || 'default'}:${file.path}`;
                if (this.indexedIds.has(objectId))
                    continue;
                const text = this.buildFileSearchText(file);
                if (!text)
                    continue;
                try {
                    const ok = yield this.client.push(COLLECTION, bucket, objectId, text);
                    if (ok) {
                        pushCount++;
                        this.indexedIds.add(objectId);
                    }
                }
                catch (_a) {
                    // Non-fatal
                }
                // Also index the directory if not yet indexed
                if (file.directory && !indexedDirs.has(file.directory)) {
                    const dirObjectId = `dir:${projectId || 'default'}:${file.directory}`;
                    if (!this.indexedIds.has(dirObjectId)) {
                        const dirParts = file.directory.split('/').filter(Boolean);
                        const dirText = dirParts.join(' ') + ' directory';
                        try {
                            yield this.client.push(COLLECTION, projectId || BUCKET_DIRS, dirObjectId, dirText);
                            this.indexedIds.add(dirObjectId);
                        }
                        catch ( /* non-fatal */_b) { /* non-fatal */ }
                    }
                    indexedDirs.add(file.directory);
                }
                if ((i + 1) % BATCH_SIZE === 0) {
                    yield sleep(BATCH_DELAY_MS);
                }
            }
            return pushCount;
        });
    }
    // ─── Full Re-Index ──────────────────────────────────────────────────────────
    /**
     * Full re-index from SQLite data for a given project.
     * Flushes existing Sonic data, then re-pushes everything.
     */
    reindexProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const stats = {
                nodesIndexed: 0,
                edgesIndexed: 0,
                filesIndexed: 0,
                duplicatesSkipped: 0,
                errors: 0,
                elapsedMs: 0,
            };
            if (!(yield this.ensureConnected())) {
                stats.elapsedMs = Date.now() - startTime;
                return stats;
            }
            // Reset deduplication tracker for this project
            this.clearProjectFromTracker(projectId);
            let db = null;
            try {
                const dbPath = (0, databasePersister_js_1.getSharedDatabasePath)();
                db = new better_sqlite3_1.default(dbPath, { readonly: true });
                // Flush existing Sonic data for this project
                yield this.client.flush(COLLECTION, projectId);
                // Fetch all nodes from SQLite
                const nodeRows = db.prepare('SELECT * FROM GraphNodes WHERE graph_id = ?').all(projectId);
                const graphNodes = nodeRows.map(row => ({
                    id: String(row.node_id),
                    type: (row.node_type || 'file'),
                    name: row.name,
                    path: row.path || undefined,
                    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
                }));
                stats.nodesIndexed = yield this.indexGraphNodes(graphNodes, projectId);
                // Fetch all edges from SQLite
                const edgeRows = db.prepare('SELECT * FROM GraphEdges WHERE graph_id = ?').all(projectId);
                const graphEdges = edgeRows.map(row => {
                    var _a;
                    return ({
                        id: String(row.edge_id),
                        from: String(row.from_node_id),
                        to: String(row.to_node_id),
                        type: (row.edge_type || 'depends_on'),
                        status: row.status || undefined,
                        confidence: (_a = row.confidence) !== null && _a !== void 0 ? _a : 1.0,
                    });
                });
                stats.edgesIndexed = yield this.indexGraphEdges(graphEdges, graphNodes, projectId);
                // Build file metadata from FILE-type nodes
                const fileNodes = graphNodes.filter(n => n.type === types_js_1.NodeType.FILE);
                const fileInfos = fileNodes.map(n => {
                    var _a;
                    const filePath = n.path || n.name;
                    const parts = filePath.split('/');
                    return {
                        path: filePath,
                        exports: (_a = n.metadata) === null || _a === void 0 ? void 0 : _a.exports,
                        directory: parts.slice(0, -1).join('/'),
                        name: parts[parts.length - 1] || n.name,
                    };
                });
                stats.filesIndexed = yield this.indexFileMetadata(fileInfos, projectId);
                // Consolidate FST for SUGGEST to work
                yield this.client.consolidate();
            }
            catch (err) {
                stats.errors++;
                console.warn(`[SonicIndexer] reindexProject failed: ${err.message}`);
            }
            finally {
                if (db)
                    db.close();
            }
            stats.elapsedMs = Date.now() - startTime;
            return stats;
        });
    }
    // ─── Incremental Index ──────────────────────────────────────────────────────
    /**
     * Update only changed files in the Sonic index.
     * Handles add/modify/delete operations.
     */
    incrementalIndex(changes, nodes, edges, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const stats = {
                nodesIndexed: 0,
                edgesIndexed: 0,
                filesIndexed: 0,
                duplicatesSkipped: 0,
                errors: 0,
                elapsedMs: 0,
            };
            if (!(yield this.ensureConnected())) {
                stats.elapsedMs = Date.now() - startTime;
                return stats;
            }
            const bucket = projectId;
            for (const change of changes) {
                try {
                    if (change.type === 'delete') {
                        // Flush objects for the deleted file
                        const objectId = `file:${projectId}:${change.path}`;
                        yield this.client.flushObject(COLLECTION, bucket, objectId);
                        this.indexedIds.delete(objectId);
                        // Also flush any nodes associated with this file
                        if (change.oldNodeIds) {
                            for (const nodeId of change.oldNodeIds) {
                                const nodeObjId = `node:${projectId}:${nodeId}`;
                                yield this.client.flushObject(COLLECTION, bucket, nodeObjId);
                                this.indexedIds.delete(nodeObjId);
                            }
                        }
                    }
                    else {
                        // For add/modify: flush old data, then re-push
                        const fileObjectId = `file:${projectId}:${change.path}`;
                        yield this.client.flushObject(COLLECTION, bucket, fileObjectId);
                        this.indexedIds.delete(fileObjectId);
                        // Find nodes belonging to this file
                        const fileNodes = nodes.filter(n => n.path === change.path);
                        for (const node of fileNodes) {
                            const nodeObjId = this.nodeObjectId(node, projectId);
                            yield this.client.flushObject(COLLECTION, bucket, nodeObjId);
                            this.indexedIds.delete(nodeObjId);
                        }
                        // Re-index nodes for this file
                        const indexedCount = yield this.indexGraphNodes(fileNodes, projectId);
                        stats.nodesIndexed += indexedCount;
                        // Re-index edges involving these nodes
                        const fileNodeIds = new Set(fileNodes.map(n => n.id));
                        const relatedEdges = edges.filter(e => fileNodeIds.has(e.from) || fileNodeIds.has(e.to));
                        stats.edgesIndexed += yield this.indexGraphEdges(relatedEdges, nodes, projectId);
                        // Re-index file metadata
                        const parts = change.path.split('/');
                        const fileInfo = {
                            path: change.path,
                            directory: parts.slice(0, -1).join('/'),
                            name: parts[parts.length - 1],
                        };
                        stats.filesIndexed += yield this.indexFileMetadata([fileInfo], projectId);
                    }
                }
                catch (err) {
                    stats.errors++;
                    console.warn(`[SonicIndexer] incrementalIndex error for ${change.path}: ${err.message}`);
                }
            }
            // Consolidate after batch of changes
            try {
                yield this.client.consolidate();
            }
            catch ( /* non-fatal */_a) { /* non-fatal */ }
            stats.elapsedMs = Date.now() - startTime;
            return stats;
        });
    }
    // ─── Text Building ──────────────────────────────────────────────────────────
    buildNodeSearchText(node) {
        const parts = [];
        // Name is always searchable
        parts.push(node.name);
        // Node type helps with filtered searches
        parts.push(node.type);
        // File path components
        if (node.path) {
            const pathParts = node.path.split('/').filter(Boolean);
            parts.push(...pathParts);
        }
        // Metadata enrichment
        if (node.metadata) {
            if (node.metadata.exportedAs)
                parts.push(node.metadata.exportedAs);
            if (node.metadata.kind)
                parts.push(node.metadata.kind);
            if (node.metadata.stateKeys)
                parts.push(...node.metadata.stateKeys);
            if (node.metadata.actionKeys)
                parts.push(...node.metadata.actionKeys);
            if (node.metadata.getterKeys)
                parts.push(...node.metadata.getterKeys);
            if (node.metadata.uiElements)
                parts.push(...node.metadata.uiElements);
            if (node.metadata.specifiers)
                parts.push(...node.metadata.specifiers);
            if (node.metadata.description)
                parts.push(node.metadata.description);
        }
        return parts.filter(Boolean).join(' ').substring(0, MAX_TEXT_LENGTH);
    }
    buildEdgeSearchText(edge, fromNode, toNode) {
        const parts = [];
        parts.push(edge.type);
        if (fromNode)
            parts.push(fromNode.name);
        if (toNode)
            parts.push(toNode.name);
        if (edge.type === types_js_1.EdgeType.IMPORTS && toNode) {
            parts.push('import', toNode.name);
        }
        if (edge.type === types_js_1.EdgeType.EXPORTS && fromNode) {
            parts.push('export', fromNode.name);
        }
        return parts.filter(Boolean).join(' ').substring(0, MAX_TEXT_LENGTH);
    }
    buildFileSearchText(file) {
        const parts = [];
        parts.push(file.name);
        parts.push(file.path);
        // Directory components
        const dirParts = file.path.split('/').filter(Boolean);
        parts.push(...dirParts);
        // Exports
        if (file.exports && file.exports.length > 0) {
            parts.push('exports');
            parts.push(...file.exports);
        }
        return parts.filter(Boolean).join(' ').substring(0, MAX_TEXT_LENGTH);
    }
    // ─── Object ID Helpers ──────────────────────────────────────────────────────
    nodeObjectId(node, projectId) {
        const prefix = projectId ? `${projectId}:` : '';
        return `node:${prefix}${node.id}`;
    }
    edgeObjectId(edge, projectId) {
        const prefix = projectId ? `${projectId}:` : '';
        return `edge:${prefix}${edge.id}`;
    }
    // ─── Deduplication Management ───────────────────────────────────────────────
    /** Clear tracked IDs for a specific project (used before re-index). */
    clearProjectFromTracker(projectId) {
        const prefix = projectId + ':';
        for (const id of this.indexedIds) {
            if (id.includes(prefix)) {
                this.indexedIds.delete(id);
            }
        }
    }
    /** Reset the entire deduplication tracker. */
    resetTracker() {
        this.indexedIds.clear();
    }
    /** Get count of tracked indexed objects. */
    getTrackedCount() {
        return this.indexedIds.size;
    }
}
exports.SonicIndexer = SonicIndexer;
// ============ SINGLETON ============
let _indexerInstance = null;
function getSonicIndexer(client) {
    if (!_indexerInstance) {
        _indexerInstance = new SonicIndexer(client);
    }
    return _indexerInstance;
}
// ============ UTILITY ============
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=sonicIndexer.js.map