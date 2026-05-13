"use strict";
// src/commands/graphBuilder.ts
// Cross-file dependency graph builder with health scoring, circular dependency detection, and impact analysis.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDependencyGraph = buildDependencyGraph;
exports.getImpactAnalysis = getImpactAnalysis;
const types_js_1 = require("./integr8/types.js");
const dataIngestion_js_1 = require("./integr8/dataIngestion.js");
/**
 * Build a dependency graph with health analysis for a project
 */
function buildDependencyGraph(projectPath) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        // Get raw semantic graph from parsers
        const { externalGraph } = yield (0, dataIngestion_js_1.ingestProjectData)({
            externalPath: projectPath,
            currentPath: projectPath,
            targetPages: []
        });
        const nodes = externalGraph.nodes;
        const edges = externalGraph.edges;
        // Build adjacency lists
        const outgoing = new Map(); // node -> depends on
        const incoming = new Map(); // node -> consumed by
        for (const node of nodes) {
            outgoing.set(node.id, new Set());
            incoming.set(node.id, new Set());
        }
        for (const edge of edges) {
            (_a = outgoing.get(edge.from)) === null || _a === void 0 ? void 0 : _a.add(edge.to);
            (_b = incoming.get(edge.to)) === null || _b === void 0 ? void 0 : _b.add(edge.from);
        }
        // Detect circular dependencies (DFS-based)
        const circularDeps = detectCircularDependencies(nodes, outgoing);
        // Find orphaned files (no incoming AND no outgoing edges)
        const orphanedFiles = [];
        for (const node of nodes) {
            if (node.type === types_js_1.NodeType.FILE &&
                (((_c = outgoing.get(node.id)) === null || _c === void 0 ? void 0 : _c.size) || 0) === 0 &&
                (((_d = incoming.get(node.id)) === null || _d === void 0 ? void 0 : _d.size) || 0) === 0) {
                orphanedFiles.push(node.path || node.name);
            }
        }
        // Find dead imports (import nodes with no matching export edge)
        const deadImports = [];
        for (const node of nodes) {
            if (node.type === types_js_1.NodeType.IMPORT) {
                const hasResolution = edges.some(e => e.from === node.id && e.type === types_js_1.EdgeType.IMPORTS);
                if (!hasResolution && (((_e = outgoing.get(node.id)) === null || _e === void 0 ? void 0 : _e.size) || 0) === 0) {
                    deadImports.push(node.name);
                }
            }
        }
        // Compute impact radius for each node (BFS counting transitive dependents)
        const impactMap = new Map();
        for (const node of nodes) {
            impactMap.set(node.id, computeImpactRadius(node.id, incoming));
        }
        // Determine health for each node
        const cycleNodeIds = new Set(circularDeps.flatMap(c => c.cycle));
        const deadImportNames = new Set(deadImports);
        const healthyNodes = nodes.map(node => {
            const deps = Array.from(outgoing.get(node.id) || []);
            const consumers = Array.from(incoming.get(node.id) || []);
            const impact = impactMap.get(node.id) || 0;
            let health;
            if (cycleNodeIds.has(node.id)) {
                health = 'broken';
            }
            else if (node.type === types_js_1.NodeType.IMPORT && deadImportNames.has(node.name)) {
                health = 'broken';
            }
            else if (deps.length === 0 && consumers.length === 0 && node.type === types_js_1.NodeType.FILE) {
                health = 'unused';
            }
            else if (consumers.length === 0 && node.type !== types_js_1.NodeType.FILE) {
                health = 'partial';
            }
            else {
                health = 'healthy';
            }
            return Object.assign(Object.assign({}, node), { health,
                consumers, dependencies: deps, impactRadius: impact });
        });
        const healthyCount = healthyNodes.filter(n => n.health === 'healthy').length;
        const partialCount = healthyNodes.filter(n => n.health === 'partial').length;
        const unusedCount = healthyNodes.filter(n => n.health === 'unused').length;
        const brokenCount = healthyNodes.filter(n => n.health === 'broken').length;
        const healthScore = nodes.length > 0 ? healthyCount / nodes.length : 1;
        return {
            nodes: healthyNodes,
            circularDeps,
            orphanedFiles,
            deadImports,
            healthScore,
            totalNodes: nodes.length,
            healthyCount,
            partialCount,
            unusedCount,
            brokenCount
        };
    });
}
/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(nodes, outgoing) {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    function dfs(nodeId) {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        path.push(nodeId);
        for (const neighbor of outgoing.get(nodeId) || []) {
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            }
            else if (recursionStack.has(neighbor)) {
                // Found a cycle
                const cycleStart = path.indexOf(neighbor);
                const cycle = path.slice(cycleStart);
                const files = cycle
                    .map(id => nodeMap.get(id))
                    .filter(n => n)
                    .map(n => n.path || n.name);
                cycles.push({ cycle, files });
            }
        }
        path.pop();
        recursionStack.delete(nodeId);
    }
    for (const node of nodes) {
        if (!visited.has(node.id)) {
            dfs(node.id);
        }
    }
    return cycles;
}
/**
 * Compute transitive impact radius using BFS
 */
function computeImpactRadius(nodeId, incoming) {
    const visited = new Set();
    const queue = [nodeId];
    visited.add(nodeId);
    while (queue.length > 0) {
        const current = queue.shift();
        for (const consumer of incoming.get(current) || []) {
            if (!visited.has(consumer)) {
                visited.add(consumer);
                queue.push(consumer);
            }
        }
    }
    return visited.size - 1; // Exclude self
}
/**
 * Get impact analysis for a specific file
 */
function getImpactAnalysis(projectPath, filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const report = yield buildDependencyGraph(projectPath);
        // Find the node matching the file path
        const targetNode = report.nodes.find(n => { var _a; return n.path === filePath || n.name === filePath || ((_a = n.path) === null || _a === void 0 ? void 0 : _a.endsWith(filePath)); });
        if (!targetNode) {
            return { directConsumers: [], transitiveConsumers: [], impactRadius: 0 };
        }
        // Direct consumers
        const directConsumers = targetNode.consumers
            .map(id => report.nodes.find(n => n.id === id))
            .filter(n => n)
            .map(n => n.path || n.name);
        // Transitive (all nodes within impact radius)
        const visited = new Set();
        const queue = [targetNode.id];
        visited.add(targetNode.id);
        while (queue.length > 0) {
            const current = queue.shift();
            const node = report.nodes.find(n => n.id === current);
            if (node) {
                for (const consumer of node.consumers) {
                    if (!visited.has(consumer)) {
                        visited.add(consumer);
                        queue.push(consumer);
                    }
                }
            }
        }
        const transitiveConsumers = Array.from(visited)
            .filter(id => id !== targetNode.id)
            .map(id => report.nodes.find(n => n.id === id))
            .filter(n => n)
            .map(n => n.path || n.name);
        return {
            directConsumers,
            transitiveConsumers,
            impactRadius: targetNode.impactRadius
        };
    });
}
//# sourceMappingURL=graphBuilder.js.map