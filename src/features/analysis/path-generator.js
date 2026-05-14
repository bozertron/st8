"use strict";
// src/commands/integr8/pathGenerator.ts
// Stage 3: Path Generation and Outcome Evaluation
// Generates a migration plan from an analyzed semantic graph and evaluates integration outcome.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMigrationPath = generateMigrationPath;
exports.performTopologicalAnalysis = performTopologicalAnalysis;
const crypto = __importStar(require("crypto"));
const types_1 = require("../../shared/types/integr8-types");
// ============ UUID GENERATION (I-16 FIX) ============
/**
 * Generate a UUID with fallback for environments without crypto.randomUUID.
 */
function generateUUID() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback: use crypto.randomBytes
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
// ============ MAIN ENTRY POINT ============
/**
 * Generates a complete migration plan with outcome evaluation from an analyzed semantic graph.
 *
 * @param graph - The unified semantic graph from Stage 2 analysis
 * @param conflicts - Array of detected conflicts with resolution recommendations
 * @param targetPages - Pages being integrated from the external project
 * @param sourcePath - Path to the external (source) project
 * @param targetPath - Path to the current (target) project
 * @returns PathGenerationResult with plan, outcome, and explanatory reasons
 */
function generateMigrationPath(graph, conflicts, targetPages, sourcePath, targetPath) {
    // STEP 1: Determine file copy order via topological sort
    const orderedFiles = topologicalSortFiles(graph, targetPages);
    // STEP 2: Generate MigrationStep[] array
    const steps = generateSteps(graph, conflicts, orderedFiles, sourcePath, targetPath);
    // STEP 3: Evaluate outcome based on graph properties and conflicts
    const outcome = evaluateOutcome(graph.properties, conflicts);
    // STEP 4: Generate reasons explaining the outcome
    const reasons = generateReasons(graph, conflicts, steps, outcome);
    // STEP 5: Compute estimated complexity
    const estimatedComplexity = computeComplexity(steps.length);
    // STEP 6: I-04 SOTA — Enhanced topological analysis
    const topologicalAnalysis = performTopologicalAnalysis(graph, orderedFiles);
    // STEP 7: Assemble MigrationPlan
    const plan = {
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        sourcePath,
        targetPath,
        outcome,
        estimatedComplexity,
        conflictCount: conflicts.length,
        steps,
        conflicts
    };
    return { plan, outcome, reasons, topologicalAnalysis };
}
// ============ STEP 1: TOPOLOGICAL SORT ============
/**
 * Performs a topological sort on file nodes based on dependency edges.
 * I-04 FIX: Expands BFS to include ALL transitive dependencies from both directions.
 * I-15 FIX: Cycles handled with deterministic ordering (sorted by name).
 * Uses Kahn's algorithm for cycle-safe ordering.
 */
function topologicalSortFiles(graph, targetPages) {
    // Collect all file nodes relevant to the target pages
    const fileNodes = graph.nodes.filter(n => n.type === types_1.NodeType.FILE);
    const targetFileNodes = fileNodes.filter(n => targetPages.some(page => { var _a; return n.name.includes(page) || ((_a = n.path) === null || _a === void 0 ? void 0 : _a.includes(page)); }));
    // Build adjacency list and in-degree map from dependency edges
    // Edge semantics: if edge.from imports edge.to, then edge.to must come first
    const dependencyEdges = graph.edges.filter(e => e.type === types_1.EdgeType.IMPORTS || e.type === types_1.EdgeType.DEPENDS_ON);
    // Map node IDs to nodes for quick lookup
    const nodeMap = new Map();
    for (const node of fileNodes) {
        nodeMap.set(node.id, node);
    }
    // I-04 FIX: Collect all relevant node IDs via BFS in BOTH directions
    // Include dependencies that transitively affect target nodes
    const relevantIds = new Set(targetFileNodes.map(n => n.id));
    const visited = new Set();
    // BFS forward: find all transitive dependencies (things target files depend on)
    const forwardQueue = [...relevantIds];
    while (forwardQueue.length > 0) {
        const current = forwardQueue.shift();
        if (visited.has(current))
            continue;
        visited.add(current);
        for (const edge of dependencyEdges) {
            // edge.from depends on edge.to
            if (edge.from === current && nodeMap.has(edge.to)) {
                relevantIds.add(edge.to);
                if (!visited.has(edge.to)) {
                    forwardQueue.push(edge.to);
                }
            }
        }
    }
    // BFS reverse: find nodes that depend on our relevant nodes (for complete ordering)
    const reverseVisited = new Set();
    const reverseQueue = [...relevantIds];
    while (reverseQueue.length > 0) {
        const current = reverseQueue.shift();
        if (reverseVisited.has(current))
            continue;
        reverseVisited.add(current);
        for (const edge of dependencyEdges) {
            // edge.from depends on edge.to; if edge.to is in relevant, include edge.from
            if (edge.to === current && nodeMap.has(edge.from)) {
                relevantIds.add(edge.from);
                if (!reverseVisited.has(edge.from)) {
                    reverseQueue.push(edge.from);
                }
            }
        }
    }
    // Build in-degree map for Kahn's algorithm (only among relevant nodes)
    const inDegree = new Map();
    const adjacency = new Map();
    for (const id of relevantIds) {
        inDegree.set(id, 0);
        adjacency.set(id, []);
    }
    for (const edge of dependencyEdges) {
        if (relevantIds.has(edge.from) && relevantIds.has(edge.to)) {
            // edge.from depends on edge.to → edge.to must come before edge.from
            // So edge is: edge.to → edge.from in topological order
            adjacency.get(edge.to).push(edge.from);
            inDegree.set(edge.from, (inDegree.get(edge.from) || 0) + 1);
        }
    }
    // Kahn's algorithm
    const sorted = [];
    const zeroInDegree = [];
    for (const [id, degree] of inDegree) {
        if (degree === 0) {
            zeroInDegree.push(id);
        }
    }
    // Sort zero-degree nodes by name for deterministic output
    zeroInDegree.sort((a, b) => {
        const nodeA = nodeMap.get(a);
        const nodeB = nodeMap.get(b);
        return ((nodeA === null || nodeA === void 0 ? void 0 : nodeA.name) || '').localeCompare((nodeB === null || nodeB === void 0 ? void 0 : nodeB.name) || '');
    });
    while (zeroInDegree.length > 0) {
        const current = zeroInDegree.shift();
        const node = nodeMap.get(current);
        if (node) {
            sorted.push(node);
        }
        const neighbors = adjacency.get(current) || [];
        for (const neighbor of neighbors) {
            const newDegree = (inDegree.get(neighbor) || 1) - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) {
                // Insert sorted by name for deterministic ordering
                const insertIdx = zeroInDegree.findIndex(id => {
                    const n = nodeMap.get(id);
                    const neighborNode = nodeMap.get(neighbor);
                    return ((n === null || n === void 0 ? void 0 : n.name) || '').localeCompare((neighborNode === null || neighborNode === void 0 ? void 0 : neighborNode.name) || '') > 0;
                });
                if (insertIdx === -1) {
                    zeroInDegree.push(neighbor);
                }
                else {
                    zeroInDegree.splice(insertIdx, 0, neighbor);
                }
            }
        }
    }
    // I-15 TIER 3: Intelligent cycle handling with cost-based break point selection
    const cycledNodes = [];
    for (const id of relevantIds) {
        const alreadySorted = sorted.some(n => n.id === id);
        if (!alreadySorted) {
            const node = nodeMap.get(id);
            if (node) {
                cycledNodes.push(node);
            }
        }
    }
    if (cycledNodes.length > 0) {
        // I-15 Tier 3: Cost-based sorting within cycle — process lowest-cost nodes first
        const cycleAnalysis = analyzeCycleBreakPoints(cycledNodes, dependencyEdges, nodeMap, graph);
        // Sort by cost (ascending) — least costly to break first
        const costSorted = cycleAnalysis.costSortedMembers;
        const sortedCycled = [];
        for (const entry of costSorted) {
            const node = nodeMap.get(entry.nodeId);
            if (node)
                sortedCycled.push(node);
        }
        // Add any remaining cycled nodes not in analysis (fallback by name)
        for (const node of cycledNodes) {
            if (!sortedCycled.some(n => n.id === node.id)) {
                sortedCycled.push(node);
            }
        }
        sorted.push(...sortedCycled);
        // Log break suggestions
        if (cycleAnalysis.selectedBreakPoint) {
            const bp = cycleAnalysis.selectedBreakPoint;
            console.warn(`[pathGenerator] ⚠ Cycle detected: ${cycledNodes.length} nodes. Suggested break: ${bp.edgeFrom} → ${bp.edgeTo} (cost: ${bp.cost})`);
            console.warn(`[pathGenerator]   Recommendation: ${bp.recommendation}`);
        }
        else {
            console.warn(`[pathGenerator] ⚠ Cycle detected: ${cycledNodes.length} nodes could not be topologically sorted. Appended by cost-weight order.`);
        }
    }
    return sorted;
}
// ============ I-15 TIER 3: CYCLE BREAK POINT ANALYSIS ============
/**
 * I-15 Tier 3: Analyze cycle members and compute optimal break points.
 * Considers dependency count, file importance, and change frequency.
 */
function analyzeCycleBreakPoints(cycledNodes, edges, nodeMap, graph) {
    const cycleIds = new Set(cycledNodes.map(n => n.id));
    const breakSuggestions = [];
    const costSortedMembers = [];
    // Compute cost for each node in cycle
    for (const node of cycledNodes) {
        // Cost = number of dependents (things that import this node)
        const dependentCount = edges.filter(e => e.to === node.id && cycleIds.has(e.from)).length;
        // Importance = number of things this node depends on
        const dependencyCount = edges.filter(e => e.from === node.id && cycleIds.has(e.to)).length;
        // Total edges (higher = more central, harder to break)
        const totalEdges = edges.filter(e => (e.from === node.id || e.to === node.id) && (cycleIds.has(e.from) && cycleIds.has(e.to))).length;
        // Cost: fewer internal edges = cheaper to break
        const cost = totalEdges;
        // Importance: more dependents = more important (don't break)
        const importance = dependentCount;
        costSortedMembers.push({ nodeId: node.id, cost, importance });
    }
    // Sort by cost ascending, then by importance ascending (break cheap, unimportant edges first)
    costSortedMembers.sort((a, b) => {
        if (a.cost !== b.cost)
            return a.cost - b.cost;
        return a.importance - b.importance;
    });
    // Find actual edges within the cycle that could be broken
    const internalEdges = edges.filter(e => cycleIds.has(e.from) && cycleIds.has(e.to));
    for (const edge of internalEdges) {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode)
            continue;
        // Cost = how many other nodes depend on this specific edge
        const fromDependents = edges.filter(e => e.to === edge.from).length;
        const toDependents = edges.filter(e => e.to === edge.to).length;
        const edgeCost = Math.min(fromDependents, toDependents);
        // Generate recommendation
        const recommendation = generateBreakPointRecommendation(fromNode, toNode, edgeCost, edges);
        const alternatives = generateAlternativeApproaches(fromNode, toNode);
        breakSuggestions.push({
            edgeFrom: edge.from,
            edgeTo: edge.to,
            cost: edgeCost,
            reason: `Edge from '${fromNode.name}' → '${toNode.name}' has lowest break cost (${edgeCost} dependents affected)`,
            recommendation,
            alternativeApproaches: alternatives,
        });
    }
    // Sort break suggestions by cost
    breakSuggestions.sort((a, b) => a.cost - b.cost);
    return {
        cycleMembers: cycledNodes.map(n => n.id),
        breakSuggestions,
        selectedBreakPoint: breakSuggestions[0] || null,
        costSortedMembers,
    };
}
/**
 * I-15 Tier 3: Generate a human-readable recommendation for breaking a cycle at a specific edge.
 */
function generateBreakPointRecommendation(fromNode, toNode, cost, edges) {
    const fromDeps = edges.filter(e => e.from === fromNode.id).length;
    const toDeps = edges.filter(e => e.from === toNode.id).length;
    if (cost === 0) {
        return `Remove import of '${toNode.name}' from '${fromNode.name}' — no other dependents affected.`;
    }
    if (fromDeps > toDeps) {
        return `Extract shared interface between '${fromNode.name}' and '${toNode.name}' into a separate module. '${fromNode.name}' has more outgoing dependencies, making it the better candidate for refactoring.`;
    }
    if (toDeps > fromDeps) {
        return `Inject '${toNode.name}' as a dependency rather than importing directly. Use dependency injection or event-based communication.`;
    }
    return `Consider lazy-loading '${toNode.name}' from '${fromNode.name}' using dynamic import() to break the static cycle.`;
}
/**
 * I-15 Tier 3: Generate alternative approaches for breaking a cycle.
 */
function generateAlternativeApproaches(fromNode, toNode) {
    return [
        `Extract shared types/interfaces into a separate '${fromNode.name}.types' module`,
        `Use dependency injection pattern: inject '${toNode.name}' at runtime instead of static import`,
        `Convert to event-based communication using an EventEmitter or pub/sub pattern`,
        `Use dynamic import(): const mod = await import('./${toNode.name}') at point of use`,
    ];
}
// ============ STEP 2: GENERATE MIGRATION STEPS ============
/**
 * Generates an ordered array of MigrationSteps covering:
 * - copy_file for each needed file
 * - rewrite_import for NEEDS_REWRITE edges
 * - merge_route for route nodes
 * - resolve_conflict for each conflict
 * - verify as the final step
 */
function generateSteps(graph, conflicts, orderedFiles, sourcePath, targetPath) {
    const steps = [];
    let stepNum = 1;
    // 2a: Copy file steps (dependencies first due to topological ordering)
    for (const fileNode of orderedFiles) {
        const fromPath = fileNode.path || `${sourcePath}/${fileNode.name}`;
        const toPath = `${targetPath}/${fileNode.name}`;
        steps.push({
            step: stepNum++,
            action: types_1.MigrationAction.COPY_FILE,
            description: `Copy ${fileNode.name} from source to target project`,
            from: fromPath,
            to: toPath,
            file: fileNode.name
        });
    }
    // 2b: Rewrite import steps for NEEDS_REWRITE edges
    const rewriteEdges = graph.edges.filter(e => e.status === types_1.DependencyStatus.NEEDS_REWRITE);
    if (rewriteEdges.length > 0) {
        // Group rewrites by source file
        const rewritesByFile = new Map();
        for (const edge of rewriteEdges) {
            const existing = rewritesByFile.get(edge.from) || [];
            existing.push(edge);
            rewritesByFile.set(edge.from, existing);
        }
        for (const [fileNodeId, edges] of rewritesByFile) {
            const fileNode = graph.nodes.find(n => n.id === fileNodeId);
            const fileName = (fileNode === null || fileNode === void 0 ? void 0 : fileNode.name) || fileNodeId;
            const rules = edges.map(edge => {
                const targetNode = graph.nodes.find(n => n.id === edge.to);
                const originalImport = (targetNode === null || targetNode === void 0 ? void 0 : targetNode.path) || (targetNode === null || targetNode === void 0 ? void 0 : targetNode.name) || edge.to;
                const rewrittenImport = computeRewrittenPath(originalImport, sourcePath, targetPath);
                return {
                    originalImport,
                    rewrittenImport,
                    reason: `Path changed from source to target project structure`
                };
            });
            steps.push({
                step: stepNum++,
                action: types_1.MigrationAction.REWRITE_IMPORT,
                description: `Rewrite ${rules.length} import(s) in ${fileName}`,
                file: fileName,
                rules
            });
        }
    }
    // 2c: Merge route steps for route nodes
    const routeNodes = graph.nodes.filter(n => n.type === types_1.NodeType.ROUTE);
    if (routeNodes.length > 0) {
        for (const routeNode of routeNodes) {
            steps.push({
                step: stepNum++,
                action: types_1.MigrationAction.MERGE_ROUTE,
                description: `Merge route "${routeNode.name}" into target router configuration`,
                file: routeNode.path || 'router/index.ts',
                from: routeNode.name
            });
        }
    }
    // 2d: Resolve conflict steps
    for (const conflict of conflicts) {
        steps.push({
            step: stepNum++,
            action: types_1.MigrationAction.RESOLVE_CONFLICT,
            description: `Resolve ${conflict.type} conflict: ${conflict.description}`,
            conflictId: conflict.id,
            resolution: conflict.recommended
        });
    }
    // 2e: Final verify step (always last)
    steps.push({
        step: stepNum++,
        action: types_1.MigrationAction.VERIFY,
        description: 'Verify integration integrity'
    });
    return steps;
}
// ============ STEP 3: OUTCOME EVALUATION ============
/**
 * Evaluates the integration outcome based on graph properties and conflict state.
 *
 * Decision matrix:
 * - SUCCESS: reachability > 0.95 AND fragility < 0.05 AND conflictCount === 0
 * - PARTIAL: reachability >= 0.5 AND all conflicts have recommended resolutions
 * - FAILURE: reachability < 0.5 OR unresolvable conflicts exist
 * - AMBIGUOUS: Multiple equally-valid resolution paths (>2 conflicts with no clear recommendation)
 * - REDIRECT: Critical dependency missing with no workaround
 */
function evaluateOutcome(properties, conflicts) {
    const { reachability, fragility } = properties;
    // Check for REDIRECT: critical missing dependency (no resolution options at all)
    const hasCriticalMissing = conflicts.some(c => c.type === 'missing_dependency' && c.resolutionOptions.length === 0);
    if (hasCriticalMissing) {
        return types_1.IntegrationOutcome.REDIRECT;
    }
    // Check for FAILURE: low reachability or unresolvable conflicts
    const unresolvableConflicts = conflicts.filter(c => c.resolutionOptions.length === 0);
    if (reachability < 0.5 || unresolvableConflicts.length > 0) {
        return types_1.IntegrationOutcome.FAILURE;
    }
    // Check for AMBIGUOUS: >2 conflicts where no single resolution is clearly better
    const ambiguousConflicts = conflicts.filter(c => c.resolutionOptions.length > 1 && c.recommended === types_1.ResolutionStrategy.CUSTOM);
    if (ambiguousConflicts.length > 2) {
        return types_1.IntegrationOutcome.AMBIGUOUS;
    }
    // Check for SUCCESS: high reachability, low fragility, no conflicts
    if (reachability > 0.95 && fragility < 0.05 && conflicts.length === 0) {
        return types_1.IntegrationOutcome.SUCCESS;
    }
    // Check for PARTIAL: moderate reachability, all conflicts have resolutions
    const allConflictsResolvable = conflicts.every(c => c.resolutionOptions.length > 0);
    if (reachability >= 0.5 && allConflictsResolvable) {
        return types_1.IntegrationOutcome.PARTIAL;
    }
    // Default fallback
    return types_1.IntegrationOutcome.FAILURE;
}
// ============ STEP 4: GENERATE REASONS ============
/**
 * Produces human-readable reasons explaining the outcome determination.
 */
function generateReasons(graph, conflicts, steps, outcome) {
    const reasons = [];
    const { reachability, fragility, stability } = graph.properties;
    // Reachability summary
    const reachPct = Math.round(reachability * 100);
    reasons.push(`Dependency reachability: ${reachPct}% of external imports resolvable in target`);
    // Import resolution summary
    const rewriteSteps = steps.filter(s => s.action === types_1.MigrationAction.REWRITE_IMPORT);
    const totalRewrites = rewriteSteps.reduce((sum, s) => { var _a; return sum + (((_a = s.rules) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0);
    if (totalRewrites > 0) {
        reasons.push(`${totalRewrites} import(s) resolved via path rewriting`);
    }
    // Copy summary
    const copySteps = steps.filter(s => s.action === types_1.MigrationAction.COPY_FILE);
    if (copySteps.length > 0) {
        reasons.push(`${copySteps.length} file(s) to be copied from source project`);
    }
    // Route merge summary
    const routeSteps = steps.filter(s => s.action === types_1.MigrationAction.MERGE_ROUTE);
    if (routeSteps.length > 0) {
        reasons.push(`${routeSteps.length} route(s) to be merged into target router`);
    }
    // Conflict summary
    if (conflicts.length === 0) {
        reasons.push('No conflicts detected');
    }
    else {
        const resolvable = conflicts.filter(c => c.resolutionOptions.length > 0).length;
        const unresolvable = conflicts.length - resolvable;
        if (resolvable > 0) {
            reasons.push(`${resolvable} conflict(s) with recommended resolution strategy`);
        }
        if (unresolvable > 0) {
            reasons.push(`${unresolvable} conflict(s) require manual review`);
        }
        // Detail specific conflict types
        const nameCollisions = conflicts.filter(c => c.type === 'name_collision');
        if (nameCollisions.length > 0) {
            reasons.push(`${nameCollisions.length} name collision(s) detected`);
        }
    }
    // Fragility/stability context
    if (fragility > 0.1) {
        reasons.push(`Elevated fragility score (${Math.round(fragility * 100)}%) — post-integration breakage risk`);
    }
    if (stability < 0.7) {
        reasons.push(`Low stability confidence (${Math.round(stability * 100)}%) — integration may be unreliable`);
    }
    // Outcome-specific explanations
    switch (outcome) {
        case types_1.IntegrationOutcome.SUCCESS:
            reasons.push('All dependencies resolved, integration can proceed automatically');
            break;
        case types_1.IntegrationOutcome.PARTIAL:
            reasons.push('Integration feasible with manual conflict resolution steps');
            break;
        case types_1.IntegrationOutcome.FAILURE:
            reasons.push('Integration blocked — insufficient dependency coverage or unresolvable conflicts');
            break;
        case types_1.IntegrationOutcome.AMBIGUOUS:
            reasons.push('Multiple valid resolution paths exist — human guidance required');
            break;
        case types_1.IntegrationOutcome.REDIRECT:
            reasons.push('Critical dependency unavailable — consider alternative integration approach');
            break;
    }
    return reasons;
}
// ============ STEP 5: COMPLEXITY COMPUTATION ============
/**
 * Determines estimated complexity based on total step count.
 * - low: < 5 steps
 * - medium: 5-15 steps
 * - high: > 15 steps
 */
function computeComplexity(totalSteps) {
    if (totalSteps < 5)
        return 'low';
    if (totalSteps <= 15)
        return 'medium';
    return 'high';
}
// ============ UTILITY FUNCTIONS ============
/**
 * Computes the rewritten import path by replacing the source project prefix
 * with the target project prefix.
 */
function computeRewrittenPath(originalPath, sourcePath, targetPath) {
    // Normalize paths for comparison
    const normalizedSource = sourcePath.replace(/\\/g, '/').replace(/\/$/, '');
    const normalizedOriginal = originalPath.replace(/\\/g, '/');
    // If the original path starts with the source path, replace prefix
    if (normalizedOriginal.startsWith(normalizedSource)) {
        const relativePart = normalizedOriginal.slice(normalizedSource.length);
        return `${targetPath.replace(/\\/g, '/')}${relativePart}`;
    }
    // If it's a relative path, preserve it (likely internal to the copied files)
    if (normalizedOriginal.startsWith('./') || normalizedOriginal.startsWith('../')) {
        return normalizedOriginal;
    }
    // Otherwise, assume it needs to be mapped into target's structure
    return `${targetPath.replace(/\\/g, '/')}/${normalizedOriginal}`;
}
// ============ I-04 SOTA: ENHANCED TOPOLOGICAL ANALYSIS ============
/**
 * Performs enhanced topological analysis including:
 * - Critical path identification (longest dependency chain)
 * - Parallel execution planning (independent step groups)
 * - Cost estimation per step (file size, complexity)
 * - Optimization suggestions
 */
function performTopologicalAnalysis(graph, orderedNodes) {
    const dependencyEdges = graph.edges.filter(e => e.type === types_1.EdgeType.IMPORTS || e.type === types_1.EdgeType.DEPENDS_ON);
    // Build adjacency structures for analysis
    const nodeMap = new Map();
    for (const node of orderedNodes) {
        nodeMap.set(node.id, node);
    }
    const forwardAdj = new Map(); // dependencies: node → what it depends on
    const reverseAdj = new Map(); // dependents: node → what depends on it
    for (const node of orderedNodes) {
        forwardAdj.set(node.id, []);
        reverseAdj.set(node.id, []);
    }
    for (const edge of dependencyEdges) {
        if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
            forwardAdj.get(edge.from).push(edge.to);
            reverseAdj.get(edge.to).push(edge.from);
        }
    }
    // Compute step costs
    const stepCosts = computeStepCosts(orderedNodes, graph);
    // Compute critical path (longest path through DAG)
    const criticalPath = computeCriticalPath(orderedNodes, forwardAdj, stepCosts);
    // Compute parallel groups (nodes that can execute simultaneously)
    const parallelGroups = computeParallelGroups(orderedNodes, forwardAdj, nodeMap);
    // Compute optimization suggestions
    const optimizationSuggestions = generateOptimizations(orderedNodes, parallelGroups, stepCosts, criticalPath);
    // Compute timing estimates
    const costMap = new Map(stepCosts.map(c => [c.nodeId, c.estimatedDurationMs]));
    const sequentialDuration = stepCosts.reduce((sum, c) => sum + c.estimatedDurationMs, 0);
    const totalEstimatedDuration = parallelGroups.reduce((sum, g) => sum + g.estimatedCost, 0);
    const parallelSpeedup = sequentialDuration > 0
        ? sequentialDuration / Math.max(totalEstimatedDuration, 1)
        : 1;
    return {
        orderedNodes,
        criticalPath,
        parallelGroups,
        stepCosts,
        optimizationSuggestions,
        totalEstimatedDuration,
        sequentialDuration,
        parallelSpeedup
    };
}
/**
 * Compute cost estimates for each step based on node metadata and complexity.
 */
function computeStepCosts(orderedNodes, graph) {
    return orderedNodes.map(node => {
        // Extract complexity from metadata if available (from Tier 1 enrichment)
        const metadata = node.metadata || {};
        const complexity = metadata.complexity;
        const linesOfCode = (complexity === null || complexity === void 0 ? void 0 : complexity.linesOfCode) || estimateLOC(node);
        const cyclomaticComplexity = (complexity === null || complexity === void 0 ? void 0 : complexity.cyclomatic) || 1;
        // Estimate file size (heuristic: ~50 bytes per line)
        const fileSizeBytes = linesOfCode * 50;
        // Complexity score combines LOC and cyclomatic complexity
        const complexityScore = Math.min(10, (linesOfCode / 100) + (cyclomaticComplexity / 5));
        // Duration estimate: base 50ms + 1ms per line + 10ms per complexity unit
        const estimatedDurationMs = 50 + linesOfCode + (cyclomaticComplexity * 10);
        // Risk factor based on dependency count and complexity
        const dependencyCount = graph.edges.filter(e => e.from === node.id || e.to === node.id).length;
        const riskFactor = Math.min(1, (dependencyCount * 0.1) + (complexityScore * 0.05));
        return {
            nodeId: node.id,
            fileName: node.name,
            fileSizeBytes,
            complexityScore,
            estimatedDurationMs,
            riskFactor
        };
    });
}
/**
 * Estimate lines of code for a node without metadata.
 */
function estimateLOC(node) {
    // Heuristic based on node type
    switch (node.type) {
        case types_1.NodeType.FILE: return 150; // Average file
        case types_1.NodeType.COMPONENT: return 200; // Vue/React components tend to be larger
        case types_1.NodeType.STORE: return 100; // Stores are typically moderate
        case types_1.NodeType.ROUTE: return 30; // Route definitions are small
        default: return 80;
    }
}
/**
 * Compute the critical path (longest weighted path) through the dependency DAG.
 * Uses dynamic programming on the topological order.
 */
function computeCriticalPath(orderedNodes, forwardAdj, stepCosts) {
    var _a;
    const costMap = new Map(stepCosts.map(c => [c.nodeId, c.estimatedDurationMs]));
    // dist[node] = longest path ending at node
    const dist = new Map();
    const predecessor = new Map();
    for (const node of orderedNodes) {
        dist.set(node.id, costMap.get(node.id) || 0);
        predecessor.set(node.id, null);
    }
    // Process in topological order: for each node, relax outgoing edges
    for (const node of orderedNodes) {
        const currentDist = dist.get(node.id) || 0;
        const deps = forwardAdj.get(node.id) || [];
        for (const dep of deps) {
            const depCost = costMap.get(dep) || 0;
            const newDist = currentDist + depCost;
            if (newDist > (dist.get(dep) || 0)) {
                dist.set(dep, newDist);
                predecessor.set(dep, node.id);
            }
        }
    }
    // Find the node with the longest distance (end of critical path)
    let maxDist = 0;
    let endNode = ((_a = orderedNodes[0]) === null || _a === void 0 ? void 0 : _a.id) || '';
    for (const [nodeId, d] of dist) {
        if (d > maxDist) {
            maxDist = d;
            endNode = nodeId;
        }
    }
    // Reconstruct path
    const pathIds = [];
    let current = endNode;
    while (current !== null) {
        pathIds.unshift(current);
        current = predecessor.get(current) || null;
    }
    // Find bottleneck (highest individual cost on path)
    let bottleneckNode;
    let maxNodeCost = 0;
    for (const id of pathIds) {
        const cost = costMap.get(id) || 0;
        if (cost > maxNodeCost) {
            maxNodeCost = cost;
            bottleneckNode = id;
        }
    }
    return {
        path: pathIds,
        length: pathIds.length,
        estimatedDuration: maxDist,
        bottleneckNode
    };
}
/**
 * Compute parallel execution groups: sets of independent nodes that can run simultaneously.
 * Uses the "level" concept from topological sort — nodes at the same level have no dependencies on each other.
 */
function computeParallelGroups(orderedNodes, forwardAdj, nodeMap) {
    if (orderedNodes.length === 0)
        return [];
    // Compute the "level" of each node (longest path from any source)
    const nodeLevel = new Map();
    const nodeIds = new Set(orderedNodes.map(n => n.id));
    // Initialize: nodes with no dependencies get level 0
    for (const node of orderedNodes) {
        const deps = (forwardAdj.get(node.id) || []).filter(d => nodeIds.has(d));
        if (deps.length === 0) {
            nodeLevel.set(node.id, 0);
        }
    }
    // Iteratively assign levels
    let changed = true;
    let iterations = 0;
    while (changed && iterations < orderedNodes.length) {
        changed = false;
        iterations++;
        for (const node of orderedNodes) {
            if (nodeLevel.has(node.id))
                continue;
            const deps = (forwardAdj.get(node.id) || []).filter(d => nodeIds.has(d));
            const allDepsResolved = deps.every(d => nodeLevel.has(d));
            if (allDepsResolved) {
                const maxDepLevel = deps.reduce((max, d) => Math.max(max, nodeLevel.get(d) || 0), -1);
                nodeLevel.set(node.id, maxDepLevel + 1);
                changed = true;
            }
        }
    }
    // Assign remaining (cyclic) nodes to last level + 1
    const maxLevel = Math.max(0, ...Array.from(nodeLevel.values()));
    for (const node of orderedNodes) {
        if (!nodeLevel.has(node.id)) {
            nodeLevel.set(node.id, maxLevel + 1);
        }
    }
    // Group by level
    const levelGroups = new Map();
    for (const node of orderedNodes) {
        const level = nodeLevel.get(node.id) || 0;
        if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
        }
        levelGroups.get(level).push(node.id);
    }
    // Convert to ParallelGroup[]
    const groups = [];
    const sortedLevels = [...levelGroups.keys()].sort((a, b) => a - b);
    for (const level of sortedLevels) {
        const nodeIdsInGroup = levelGroups.get(level) || [];
        const dependsOnGroups = level > 0 ? [level - 1] : [];
        groups.push({
            groupIndex: level,
            nodeIds: nodeIdsInGroup,
            estimatedCost: 0, // will be computed below
            dependsOnGroups
        });
    }
    return groups;
}
/**
 * Generate optimization suggestions based on analysis results.
 */
function generateOptimizations(orderedNodes, parallelGroups, stepCosts, criticalPath) {
    const suggestions = [];
    const costMap = new Map(stepCosts.map(c => [c.nodeId, c]));
    // Update parallel group costs
    for (const group of parallelGroups) {
        group.estimatedCost = group.nodeIds.reduce((max, id) => {
            var _a;
            const cost = ((_a = costMap.get(id)) === null || _a === void 0 ? void 0 : _a.estimatedDurationMs) || 0;
            return Math.max(max, cost);
        }, 0);
    }
    // Suggestion 1: Identify parallelizable bottlenecks
    for (const group of parallelGroups) {
        if (group.nodeIds.length === 1) {
            const nodeId = group.nodeIds[0];
            const cost = costMap.get(nodeId);
            if (cost && cost.estimatedDurationMs > 200) {
                suggestions.push({
                    type: 'parallelize',
                    description: `Step '${cost.fileName}' is a serial bottleneck (${cost.estimatedDurationMs}ms). Consider splitting into sub-tasks.`,
                    estimatedSaving: cost.estimatedDurationMs * 0.3,
                    affectedSteps: [nodeId]
                });
            }
        }
    }
    // Suggestion 2: Batch similar operations
    const copyNodes = orderedNodes.filter(n => n.type === types_1.NodeType.FILE);
    if (copyNodes.length > 5) {
        const batchSaving = copyNodes.length * 20; // overhead savings from batching
        suggestions.push({
            type: 'batch',
            description: `Batch ${copyNodes.length} file copy operations to reduce I/O overhead`,
            estimatedSaving: batchSaving,
            affectedSteps: copyNodes.map(n => n.id)
        });
    }
    // Suggestion 3: Skip low-impact nodes
    const lowImpactNodes = stepCosts.filter(c => c.riskFactor < 0.1 && c.complexityScore < 1);
    if (lowImpactNodes.length > 3) {
        suggestions.push({
            type: 'skip',
            description: `${lowImpactNodes.length} trivial files could be deferred to reduce initial migration time`,
            estimatedSaving: lowImpactNodes.reduce((s, n) => s + n.estimatedDurationMs, 0),
            affectedSteps: lowImpactNodes.map(n => n.nodeId)
        });
    }
    // Suggestion 4: Reorder for risk reduction
    if (criticalPath.bottleneckNode) {
        const bottleneck = costMap.get(criticalPath.bottleneckNode);
        if (bottleneck && bottleneck.riskFactor > 0.5) {
            suggestions.push({
                type: 'reorder',
                description: `Move high-risk step '${bottleneck.fileName}' earlier in execution to fail-fast`,
                estimatedSaving: criticalPath.estimatedDuration * 0.1,
                affectedSteps: [criticalPath.bottleneckNode]
            });
        }
    }
    return suggestions;
}
//# sourceMappingURL=pathGenerator.js.map