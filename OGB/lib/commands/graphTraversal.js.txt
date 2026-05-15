"use strict";
// src/commands/graphTraversal.ts
// Graph traversal and directory-boundary-aware query functions.
// Reads from SQLite database (better-sqlite3) or operates on in-memory structures.
//
// All queries assume the following indexes exist:
// - idx_graph_nodes_graph_id: ON GraphNodes(graph_id)
// - idx_graph_edges_graph_id: ON GraphEdges(graph_id)
// - idx_graph_edges_from: ON GraphEdges(from_node_id)
// - idx_graph_edges_to: ON GraphEdges(to_node_id)
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
exports.clearCache = clearCache;
exports.ensureIndexes = ensureIndexes;
exports.findPaths = findPaths;
exports.analyzeReachability = analyzeReachability;
exports.extractSubgraph = extractSubgraph;
exports.computeImpactChain = computeImpactChain;
exports.findImportsOf = findImportsOf;
exports.findConsumersOf = findConsumersOf;
exports.findOrphans = findOrphans;
exports.getDirectorySubgraph = getDirectorySubgraph;
exports.getDirectoryBoundary = getDirectoryBoundary;
exports.getDataFlowMetrics = getDataFlowMetrics;
exports.getFileFlows = getFileFlows;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const databasePersister_js_1 = require("./integr8/databasePersister.js");
const graphCache = new Map();
const MAX_CACHED_GRAPHS = 5;
const cacheOrder = [];
/** Clear the traversal query cache. */
function clearCache() {
    graphCache.clear();
    cacheOrder.length = 0;
}
/**
 * Fetch graph data (nodes + edges) coherently.
 * Both are always fetched together in one atomic operation,
 * eliminating the split-state bug where nodes could be cached without edges.
 */
function getCoherentGraphData(graphId, database) {
    // Check cache — if present, both nodes and edges are guaranteed coherent
    const cached = graphCache.get(graphId);
    if (cached) {
        return cached;
    }
    // Cache miss: fetch BOTH nodes and edges from SQLite together
    const nodes = getAllNodes(graphId, database);
    const edges = getAllEdges(graphId, database);
    const data = { nodes, edges };
    // LRU eviction: keep only MAX_CACHED_GRAPHS entries
    if (cacheOrder.length >= MAX_CACHED_GRAPHS) {
        const evictId = cacheOrder.shift();
        graphCache.delete(evictId);
    }
    // Remove existing entry from order if re-caching same graphId
    const existingIdx = cacheOrder.indexOf(graphId);
    if (existingIdx !== -1) {
        cacheOrder.splice(existingIdx, 1);
    }
    graphCache.set(graphId, data);
    cacheOrder.push(graphId);
    return data;
}
// ===== HELPERS =====
function getDb(db) {
    if (db)
        return db;
    const dbPath = (0, databasePersister_js_1.getSharedDatabasePath)();
    return new better_sqlite3_1.default(dbPath, { readonly: true });
}
function shouldCloseDb(db) {
    return !db;
}
/**
 * Ensure required indexes exist for efficient graph queries (G-12).
 * Safe to call multiple times - uses IF NOT EXISTS.
 */
function ensureIndexes(db) {
    const queries = [
        'CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON GraphNodes(graph_id)',
        'CREATE INDEX IF NOT EXISTS idx_graph_nodes_name ON GraphNodes(graph_id, name)',
        'CREATE INDEX IF NOT EXISTS idx_graph_edges_graph_id ON GraphEdges(graph_id)',
        'CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON GraphEdges(graph_id, from_node_id)',
        'CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON GraphEdges(graph_id, to_node_id)',
        'CREATE INDEX IF NOT EXISTS idx_graph_edges_type ON GraphEdges(graph_id, edge_type)',
    ];
    for (const query of queries) {
        try {
            db.exec(query);
        }
        catch (error) {
            console.warn('[GraphTraversal] Failed to create index:', query, error);
        }
    }
}
/**
 * Validate that a graphId exists in the database (G-03).
 */
function validateGraphId(graphId, database) {
    if (!graphId) {
        return { isValid: false, error: 'graphId must be non-empty' };
    }
    try {
        const result = database.prepare('SELECT COUNT(*) as count FROM GraphNodes WHERE graph_id = ?').get(graphId);
        if (!result || result.count === 0) {
            return { isValid: false, error: `Graph '${graphId}' not found or is empty` };
        }
        return { isValid: true };
    }
    catch (error) {
        return { isValid: false, error: `Failed to validate graphId: ${String(error)}` };
    }
}
/**
 * Query all nodes for a graph.
 * ASSUMES: Index on GraphNodes(graph_id) exists for O(log n) lookup.
 */
function getAllNodes(graphId, database) {
    try {
        return database.prepare('SELECT * FROM GraphNodes WHERE graph_id = ?').all(graphId);
    }
    catch (error) {
        console.error('[GraphTraversal] Failed to get all nodes:', error);
        return [];
    }
}
/**
 * Query all edges for a graph.
 * ASSUMES: Index on GraphEdges(graph_id) exists for O(log n) lookup.
 */
function getAllEdges(graphId, database) {
    try {
        return database.prepare('SELECT * FROM GraphEdges WHERE graph_id = ?').all(graphId);
    }
    catch (error) {
        console.error('[GraphTraversal] Failed to get all edges:', error);
        return [];
    }
}
/** Get nodes for a graph via coherent cache (G-11, C3/C4/C6 fix). */
function getCachedNodes(graphId, database) {
    return getCoherentGraphData(graphId, database).nodes;
}
/** Get edges for a graph via coherent cache (G-11, C3/C4/C6 fix). */
function getCachedEdges(graphId, database) {
    return getCoherentGraphData(graphId, database).edges;
}
/**
 * Build adjacency maps from edges.
 * Self-referencing edges (from_node_id === to_node_id) are filtered out (G-05).
 */
function buildAdjacency(edges) {
    const outgoing = new Map();
    const incoming = new Map();
    for (const edge of edges) {
        // G-05: Skip self-referencing edges
        if (edge.from_node_id === edge.to_node_id) {
            continue;
        }
        if (!outgoing.has(edge.from_node_id))
            outgoing.set(edge.from_node_id, []);
        if (!incoming.has(edge.to_node_id))
            incoming.set(edge.to_node_id, []);
        outgoing.get(edge.from_node_id).push(edge.to_node_id);
        incoming.get(edge.to_node_id).push(edge.from_node_id);
    }
    return { outgoing, incoming };
}
/**
 * Normalize directory path, resolving symlinks when possible (G-07).
 */
function normalizeDirPath(dirPath) {
    try {
        const realPath = fs.realpathSync(dirPath);
        return realPath.endsWith(path.sep) ? realPath : realPath + path.sep;
    }
    catch (_a) {
        // Fall back to resolve if realpath fails (permission denied, path doesn't exist, etc.)
        const resolved = path.resolve(dirPath);
        return resolved.endsWith(path.sep) ? resolved : resolved + path.sep;
    }
}
function nodeIsInDirectory(nodePath, normalizedDirPath) {
    if (!nodePath)
        return false;
    const resolvedNodePath = path.resolve(nodePath);
    return resolvedNodePath.startsWith(normalizedDirPath) || resolvedNodePath === normalizedDirPath.slice(0, -1);
}
// ===== Platform-aware path helpers (G-08) =====
function isCaseInsensitiveFS() {
    const platform = os.platform();
    return platform === 'win32' || platform === 'darwin';
}
function pathEquals(p1, p2) {
    if (isCaseInsensitiveFS()) {
        return p1.toLowerCase() === p2.toLowerCase();
    }
    return p1 === p2;
}
function pathEndsWith(fullPath, suffix) {
    if (isCaseInsensitiveFS()) {
        return fullPath.toLowerCase().endsWith(suffix.toLowerCase());
    }
    return fullPath.endsWith(suffix);
}
// ===== TRAVERSAL FUNCTIONS =====
/**
 * BFS path enumeration between two nodes.
 * @param maxDepth - Maximum path depth (default: 10)
 * @param maxResults - Maximum number of paths to return (default: 1000) (G-04)
 * Returns up to maxResults shortest/best paths.
 */
function findPaths(graphId, startNodeId, endNodeId, maxDepth, maxResults, db) {
    // G-06: Validate parameters
    if (!startNodeId || !endNodeId) {
        return { error: 'startNodeId and endNodeId must be non-empty', paths: [], shortestPath: [] };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, paths: [], shortestPath: [] };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        // Map string node IDs to internal node_id
        const startNode = nodes.find(n => n.name === startNodeId || String(n.node_id) === startNodeId);
        const endNode = nodes.find(n => n.name === endNodeId || String(n.node_id) === endNodeId);
        if (!startNode || !endNode) {
            return { paths: [], shortestPath: [] };
        }
        const { outgoing } = buildAdjacency(edges);
        const limit = maxDepth !== null && maxDepth !== void 0 ? maxDepth : 10;
        const maxResultsLimit = maxResults !== null && maxResults !== void 0 ? maxResults : 1000; // G-04: Branching factor limit
        const allPaths = [];
        // BFS with path tracking
        const queue = [
            { nodeId: startNode.node_id, path: [String(startNode.node_id)] }
        ];
        while (queue.length > 0) {
            // G-04: Early exit when max results reached
            if (allPaths.length >= maxResultsLimit) {
                console.warn(`[GraphTraversal] Path enumeration limited to ${maxResultsLimit} results`);
                break;
            }
            const { nodeId, path: currentPath } = queue.shift();
            if (currentPath.length > limit + 1)
                continue;
            if (nodeId === endNode.node_id && currentPath.length > 1) {
                allPaths.push(currentPath);
                continue;
            }
            const neighbors = outgoing.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (!currentPath.includes(String(neighbor))) {
                    queue.push({
                        nodeId: neighbor,
                        path: [...currentPath, String(neighbor)]
                    });
                }
            }
        }
        const shortestPath = allPaths.length > 0
            ? allPaths.reduce((a, b) => a.length <= b.length ? a : b)
            : [];
        return { paths: allPaths, shortestPath };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * BFS reachability from a node in given direction.
 */
function analyzeReachability(graphId, nodeId, direction, db) {
    // G-06: Validate parameters
    if (!nodeId) {
        return { error: 'nodeId must be non-empty', reachableNodes: [], depth: 0, reachabilityScore: 0 };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, reachableNodes: [], depth: 0, reachabilityScore: 0 };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        const startNode = nodes.find(n => n.name === nodeId || String(n.node_id) === nodeId);
        if (!startNode) {
            return { reachableNodes: [], depth: 0, reachabilityScore: 0 };
        }
        const { outgoing, incoming } = buildAdjacency(edges);
        const adjacency = direction === 'outbound' ? outgoing : incoming;
        const visited = new Set();
        const queue = [{ id: startNode.node_id, depth: 0 }];
        visited.add(startNode.node_id);
        let maxDepth = 0;
        while (queue.length > 0) {
            const { id, depth } = queue.shift();
            maxDepth = Math.max(maxDepth, depth);
            const neighbors = adjacency.get(id) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ id: neighbor, depth: depth + 1 });
                }
            }
        }
        const reachableNodes = Array.from(visited)
            .filter(id => id !== startNode.node_id)
            .map(id => String(id));
        const totalNodes = nodes.length - 1; // Exclude start node
        const reachabilityScore = totalNodes > 0 ? reachableNodes.length / totalNodes : 0;
        return { reachableNodes, depth: maxDepth, reachabilityScore };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Extract induced subgraph for given node set.
 */
function extractSubgraph(graphId, nodeIds, includeConnections, db) {
    // G-06: Validate parameters
    if (!nodeIds || nodeIds.length === 0) {
        return { error: 'nodeIds must be a non-empty array', nodes: [], edges: [] };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, nodes: [], edges: [] };
        }
        const allNodes = getCachedNodes(graphId, database);
        const allEdges = getCachedEdges(graphId, database);
        const nodeIdSet = new Set(nodeIds);
        const matchedNodes = allNodes.filter(n => nodeIdSet.has(String(n.node_id)) || nodeIdSet.has(n.name));
        const matchedNodeIds = new Set(matchedNodes.map(n => n.node_id));
        let resultEdges;
        if (includeConnections) {
            // Include all edges that touch at least one node in the set
            resultEdges = allEdges.filter(e => matchedNodeIds.has(e.from_node_id) || matchedNodeIds.has(e.to_node_id));
        }
        else {
            // Include only edges where BOTH endpoints are in the set
            resultEdges = allEdges.filter(e => matchedNodeIds.has(e.from_node_id) && matchedNodeIds.has(e.to_node_id));
        }
        return { nodes: matchedNodes, edges: resultEdges };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Cascading impact analysis.
 */
function computeImpactChain(graphId, nodeId, db) {
    // G-06: Validate parameters
    if (!nodeId) {
        return { error: 'nodeId must be non-empty', directImpact: [], cascadingImpact: [], severity: 'low' };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, directImpact: [], cascadingImpact: [], severity: 'low' };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        const startNode = nodes.find(n => n.name === nodeId || String(n.node_id) === nodeId);
        if (!startNode) {
            return { directImpact: [], cascadingImpact: [], severity: 'low' };
        }
        const { incoming } = buildAdjacency(edges);
        // Direct impact: nodes that directly depend on this node
        const directIds = incoming.get(startNode.node_id) || [];
        const directImpact = directIds.map(id => String(id));
        // Cascading impact: BFS from direct dependents outward
        const visited = new Set([startNode.node_id, ...directIds]);
        const queue = [...directIds];
        const cascading = [];
        while (queue.length > 0) {
            const current = queue.shift();
            const dependents = incoming.get(current) || [];
            for (const dep of dependents) {
                if (!visited.has(dep)) {
                    visited.add(dep);
                    cascading.push(dep);
                    queue.push(dep);
                }
            }
        }
        const cascadingImpact = cascading.map(id => String(id));
        // Severity based on total impact relative to graph size
        const totalImpacted = directImpact.length + cascadingImpact.length;
        const totalNodes = nodes.length;
        const impactRatio = totalNodes > 0 ? totalImpacted / totalNodes : 0;
        let severity;
        if (impactRatio > 0.3 || totalImpacted > 10) {
            severity = 'high';
        }
        else if (impactRatio > 0.1 || totalImpacted > 3) {
            severity = 'medium';
        }
        else {
            severity = 'low';
        }
        return { directImpact, cascadingImpact, severity };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Find all edges where type=imports matching symbol name.
 * Returns object wrapper for consistency (G-10).
 */
function findImportsOf(graphId, symbolName, db) {
    // G-06: Validate parameters
    if (!symbolName) {
        return { error: 'symbolName must be non-empty', edges: [] };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, edges: [] };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        // Find nodes matching the symbol name
        const symbolNodes = nodes.filter(n => n.name === symbolName);
        const symbolNodeIds = new Set(symbolNodes.map(n => n.node_id));
        // Find edges of type 'imports' that point to these nodes
        const result = edges.filter(e => e.edge_type === 'imports' && symbolNodeIds.has(e.to_node_id));
        return { edges: result };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Find all nodes with edges pointing to given file.
 * Returns object wrapper for consistency (G-10).
 * Uses platform-aware path comparison (G-08).
 */
function findConsumersOf(graphId, filePath, db) {
    // G-06: Validate parameters
    if (!filePath) {
        return { error: 'filePath must be non-empty', nodes: [] };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, nodes: [] };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        // Find node(s) matching the file path (G-08: platform-aware comparison)
        const resolvedPath = path.resolve(filePath);
        const targetNodes = nodes.filter(n => {
            if (!n.path)
                return false;
            const nodePath = path.resolve(n.path);
            return pathEquals(nodePath, resolvedPath) ||
                pathEquals(n.path, filePath) ||
                pathEndsWith(n.path, filePath);
        });
        const targetNodeIds = new Set(targetNodes.map(n => n.node_id));
        // Find all edges pointing TO these target nodes
        const consumerIds = new Set();
        for (const edge of edges) {
            if (targetNodeIds.has(edge.to_node_id)) {
                consumerIds.add(edge.from_node_id);
            }
        }
        // Remove self-references
        for (const id of targetNodeIds) {
            consumerIds.delete(id);
        }
        // Return the consumer nodes
        const nodeMap = new Map(nodes.map(n => [n.node_id, n]));
        const result = Array.from(consumerIds)
            .map(id => nodeMap.get(id))
            .filter((n) => n !== undefined);
        return { nodes: result };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Nodes with zero inbound AND zero outbound edges.
 * Returns object wrapper for consistency (G-10).
 */
function findOrphans(graphId, db) {
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, nodes: [] };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        const connectedNodes = new Set();
        for (const edge of edges) {
            connectedNodes.add(edge.from_node_id);
            connectedNodes.add(edge.to_node_id);
        }
        const result = nodes.filter(n => !connectedNodes.has(n.node_id));
        return { nodes: result };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Get all nodes/edges within a directory, plus boundary-crossing edges.
 * A node "is in" a directory if its path starts with dirPath.
 */
function getDirectorySubgraph(graphId, dirPath, db) {
    // G-06: Validate parameters
    if (!dirPath) {
        return { error: 'dirPath must be non-empty', internalNodes: [], internalEdges: [], inFlows: [], outFlows: [] };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, internalNodes: [], internalEdges: [], inFlows: [], outFlows: [] };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        const normalizedDir = normalizeDirPath(dirPath);
        // Identify internal nodes
        const internalNodeIds = new Set();
        const internalNodes = [];
        for (const node of nodes) {
            if (nodeIsInDirectory(node.path, normalizedDir)) {
                internalNodeIds.add(node.node_id);
                internalNodes.push(node);
            }
        }
        // Classify edges
        const internalEdges = [];
        const inFlows = [];
        const outFlows = [];
        for (const edge of edges) {
            const sourceIn = internalNodeIds.has(edge.from_node_id);
            const targetIn = internalNodeIds.has(edge.to_node_id);
            if (sourceIn && targetIn) {
                internalEdges.push(edge);
            }
            else if (!sourceIn && targetIn) {
                inFlows.push(edge);
            }
            else if (sourceIn && !targetIn) {
                outFlows.push(edge);
            }
        }
        return { internalNodes, internalEdges, inFlows, outFlows };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Classifies ALL edges touching a directory as IN, OUT, or INTERNAL.
 * - IN: target node is in dir, source node is NOT in dir
 * - OUT: source node is in dir, target node is NOT in dir
 * - INTERNAL: both source and target are in dir
 */
function getDirectoryBoundary(graphId, dirPath, db) {
    var _a;
    // G-06: Validate parameters
    if (!dirPath) {
        return { error: 'dirPath must be non-empty', inEdges: [], outEdges: [], internalEdges: [] };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, inEdges: [], outEdges: [], internalEdges: [] };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        const normalizedDir = normalizeDirPath(dirPath);
        // Build node map for path lookups
        const nodeMap = new Map();
        const internalNodeIds = new Set();
        for (const node of nodes) {
            nodeMap.set(node.node_id, node);
            if (nodeIsInDirectory(node.path, normalizedDir)) {
                internalNodeIds.add(node.node_id);
            }
        }
        const inEdges = [];
        const outEdges = [];
        const internalEdges = [];
        for (const edge of edges) {
            const sourceIn = internalNodeIds.has(edge.from_node_id);
            const targetIn = internalNodeIds.has(edge.to_node_id);
            // Only process edges that touch the directory
            if (!sourceIn && !targetIn)
                continue;
            const fromNode = nodeMap.get(edge.from_node_id);
            const toNode = nodeMap.get(edge.to_node_id);
            const boundaryEdge = {
                edgeId: String(edge.edge_id),
                fromPath: (fromNode === null || fromNode === void 0 ? void 0 : fromNode.path) || (fromNode === null || fromNode === void 0 ? void 0 : fromNode.name) || '',
                toPath: (toNode === null || toNode === void 0 ? void 0 : toNode.path) || (toNode === null || toNode === void 0 ? void 0 : toNode.name) || '',
                edgeType: edge.edge_type,
                status: edge.status || 'SAFE',
                confidence: (_a = edge.confidence) !== null && _a !== void 0 ? _a : 1.0
            };
            if (sourceIn && targetIn) {
                internalEdges.push(boundaryEdge);
            }
            else if (!sourceIn && targetIn) {
                inEdges.push(boundaryEdge);
            }
            else if (sourceIn && !targetIn) {
                outEdges.push(boundaryEdge);
            }
        }
        return { inEdges, outEdges, internalEdges };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Compute data flow metrics for a directory boundary.
 */
function getDataFlowMetrics(graphId, dirPath, db) {
    // G-06: Validate parameters
    if (!dirPath) {
        return { error: 'dirPath must be non-empty', inFlowCount: 0, outFlowCount: 0, uniqueConnectionCount: 0, errorFlows: [], warningFlows: [], ambiguityFlows: [] };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, inFlowCount: 0, outFlowCount: 0, uniqueConnectionCount: 0, errorFlows: [], warningFlows: [], ambiguityFlows: [] };
        }
        const boundary = getDirectoryBoundary(graphId, dirPath, database);
        const allBoundaryEdges = [...boundary.inEdges, ...boundary.outEdges];
        const externalPaths = new Set();
        const errorFlows = [];
        const warningFlows = [];
        const ambiguityFlows = [];
        for (const edge of allBoundaryEdges) {
            // Track unique external connections
            const normalizedDir = normalizeDirPath(dirPath);
            const fromIn = nodeIsInDirectory(edge.fromPath, normalizedDir);
            const externalPath = fromIn ? edge.toPath : edge.fromPath;
            if (externalPath)
                externalPaths.add(externalPath);
            // Classify by status
            if (edge.status === 'MISSING') {
                errorFlows.push({
                    from: edge.fromPath,
                    to: edge.toPath,
                    reason: `Dependency is missing (status: MISSING)`
                });
            }
            else if (edge.status === 'NEEDS_REWRITE') {
                warningFlows.push({
                    from: edge.fromPath,
                    to: edge.toPath,
                    reason: `Dependency needs rewrite (status: NEEDS_REWRITE)`
                });
            }
            else if (edge.status === 'CONFLICT') {
                ambiguityFlows.push({
                    from: edge.fromPath,
                    to: edge.toPath,
                    reason: `Dependency has conflict (status: CONFLICT)`
                });
            }
        }
        return {
            inFlowCount: boundary.inEdges.length,
            outFlowCount: boundary.outEdges.length,
            uniqueConnectionCount: externalPaths.size,
            errorFlows,
            warningFlows,
            ambiguityFlows
        };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
/**
 * Get all edges flowing IN to and OUT from a specific file.
 * Uses platform-aware path comparison (G-08).
 */
function getFileFlows(graphId, filePath, db) {
    var _a, _b;
    // G-06: Validate parameters
    if (!filePath) {
        return { error: 'filePath must be non-empty', inbound: [], outbound: [] };
    }
    const database = getDb(db);
    const closeDb = shouldCloseDb(db);
    try {
        // G-03: Validate graphId
        const validation = validateGraphId(graphId, database);
        if (!validation.isValid) {
            return { error: validation.error, inbound: [], outbound: [] };
        }
        const nodes = getCachedNodes(graphId, database);
        const edges = getCachedEdges(graphId, database);
        // Find node(s) matching the file path (G-08: platform-aware comparison)
        const resolvedPath = path.resolve(filePath);
        const targetNodes = nodes.filter(n => {
            if (!n.path)
                return n.name === filePath;
            const nodePath = path.resolve(n.path);
            return pathEquals(nodePath, resolvedPath) ||
                pathEquals(n.path, filePath) ||
                pathEndsWith(n.path, filePath);
        });
        const targetNodeIds = new Set(targetNodes.map(n => n.node_id));
        const nodeMap = new Map(nodes.map(n => [n.node_id, n]));
        const inbound = [];
        const outbound = [];
        for (const edge of edges) {
            if (targetNodeIds.has(edge.to_node_id) && !targetNodeIds.has(edge.from_node_id)) {
                const fromNode = nodeMap.get(edge.from_node_id);
                inbound.push({
                    fromNodeId: String(edge.from_node_id),
                    fromPath: (fromNode === null || fromNode === void 0 ? void 0 : fromNode.path) || (fromNode === null || fromNode === void 0 ? void 0 : fromNode.name) || '',
                    edgeType: edge.edge_type,
                    status: edge.status || 'SAFE',
                    confidence: (_a = edge.confidence) !== null && _a !== void 0 ? _a : 1.0
                });
            }
            if (targetNodeIds.has(edge.from_node_id) && !targetNodeIds.has(edge.to_node_id)) {
                const toNode = nodeMap.get(edge.to_node_id);
                outbound.push({
                    toNodeId: String(edge.to_node_id),
                    toPath: (toNode === null || toNode === void 0 ? void 0 : toNode.path) || (toNode === null || toNode === void 0 ? void 0 : toNode.name) || '',
                    edgeType: edge.edge_type,
                    status: edge.status || 'SAFE',
                    confidence: (_b = edge.confidence) !== null && _b !== void 0 ? _b : 1.0
                });
            }
        }
        return { inbound, outbound };
    }
    finally {
        if (closeDb)
            database.close();
    }
}
//# sourceMappingURL=graphTraversal.js.map