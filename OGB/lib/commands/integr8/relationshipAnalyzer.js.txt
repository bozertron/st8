"use strict";
// src/commands/integr8/relationshipAnalyzer.ts
// Stage 2: Relationship Analysis Engine
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeRelationships = analyzeRelationships;
exports.analyzeStructuralSubtyping = analyzeStructuralSubtyping;
exports.detectBreakingChanges = detectBreakingChanges;
exports.computeTarjanSCC = computeTarjanSCC;
exports.detectCyclesWithTarjan = detectCyclesWithTarjan;
const types_js_1 = require("./types.js");
/**
 * Analyzes relationships between two SemanticGraphs (external project and current project).
 * Identifies dependency matches, conflicts, and computes integration properties.
 */
function analyzeRelationships(externalGraph, currentGraph, targetPages) {
    const unifiedNodes = [];
    const unifiedEdges = [];
    const conflicts = [];
    const dependencyMap = [];
    // Index current graph exports by name for fast lookup
    const currentExports = indexExportsByName(currentGraph);
    // Index current graph imports for circular dependency detection
    const currentImports = indexImportsBySource(currentGraph);
    let edgeCounter = 0;
    const generateEdgeId = () => `edge_rel_${++edgeCounter}`;
    let conflictCounter = 0;
    const generateConflictId = () => `conflict_${++conflictCounter}`;
    // STEP 1: For each target page, find its node in externalGraph
    for (const targetPage of targetPages) {
        const pageNode = findPageNode(externalGraph, targetPage);
        if (!pageNode)
            continue;
        // Add page node to unified graph
        addNodeIfMissing(unifiedNodes, pageNode);
        // STEP 2: Find all IMPORT nodes connected to this page
        const importEdges = externalGraph.edges.filter((e) => e.from === pageNode.id && (e.type === types_js_1.EdgeType.IMPORTS || e.type === types_js_1.EdgeType.DEPENDS_ON));
        for (const importEdge of importEdges) {
            const importNode = externalGraph.nodes.find((n) => n.id === importEdge.to);
            if (!importNode)
                continue;
            addNodeIfMissing(unifiedNodes, importNode);
            // STEP 3: Search currentGraph's EXPORT nodes for a match
            const matchResult = findMatchingExport(importNode, currentExports);
            // STEP 4: Classify the dependency
            const status = classifyDependency(importNode, matchResult);
            // Build dependency mapping entry
            const mapping = {
                externalNode: importNode.id,
                status,
                targetNode: matchResult === null || matchResult === void 0 ? void 0 : matchResult.node.id,
                rewritePath: status === types_js_1.DependencyStatus.NEEDS_REWRITE ? matchResult === null || matchResult === void 0 ? void 0 : matchResult.node.path : undefined
            };
            dependencyMap.push(mapping);
            // STEP 5: Build edges in unified graph
            // Add the import edge from page to import node
            unifiedEdges.push({
                id: generateEdgeId(),
                from: pageNode.id,
                to: importNode.id,
                type: types_js_1.EdgeType.IMPORTS,
                status,
                confidence: statusToConfidence(status)
            });
            // If match found, add the matching export node and connect
            if (matchResult) {
                addNodeIfMissing(unifiedNodes, matchResult.node);
                const resolvedEdgeType = status === types_js_1.DependencyStatus.CONFLICT
                    ? types_js_1.EdgeType.CONFLICTS_WITH
                    : types_js_1.EdgeType.DEPENDS_ON;
                unifiedEdges.push({
                    id: generateEdgeId(),
                    from: importNode.id,
                    to: matchResult.node.id,
                    type: resolvedEdgeType,
                    status,
                    confidence: statusToConfidence(status)
                });
            }
            // STEP 6: Detect conflicts
            const detectedConflicts = detectConflicts(importNode, matchResult, pageNode, currentImports, generateConflictId);
            conflicts.push(...detectedConflicts);
        }
    }
    // Add remaining current graph nodes/edges for completeness
    for (const node of currentGraph.nodes) {
        addNodeIfMissing(unifiedNodes, node);
    }
    // STEP 7: Compute graph properties
    const properties = computeGraphProperties(dependencyMap);
    // STEP 8: Return AnalysisResult
    const unifiedGraph = {
        nodes: unifiedNodes,
        edges: unifiedEdges,
        properties
    };
    return { unifiedGraph, conflicts, dependencyMap };
}
/**
 * Indexes all EXPORT nodes in a graph by their name for O(1) lookup.
 */
function indexExportsByName(graph) {
    const index = {};
    for (const node of graph.nodes) {
        if (node.type === types_js_1.NodeType.EXPORT) {
            if (!index[node.name]) {
                index[node.name] = [];
            }
            index[node.name].push(node);
        }
    }
    return index;
}
/**
 * Indexes import relationships to detect circular dependencies.
 * Returns a map of source paths → imported names.
 */
function indexImportsBySource(graph) {
    const importMap = new Map();
    for (const node of graph.nodes) {
        if (node.type === types_js_1.NodeType.IMPORT && node.path) {
            if (!importMap.has(node.path)) {
                importMap.set(node.path, new Set());
            }
            importMap.get(node.path).add(node.name);
        }
    }
    return importMap;
}
/**
 * Finds the page/file node in the external graph matching a target page name.
 */
function findPageNode(graph, targetPage) {
    return graph.nodes.find((node) => {
        if (node.type !== types_js_1.NodeType.FILE && node.type !== types_js_1.NodeType.COMPONENT)
            return false;
        // Match by name or path containing the target page
        return node.name === targetPage ||
            (node.path && node.path.includes(targetPage));
    });
}
/**
 * Searches for a matching export in the current graph's export index.
 */
function findMatchingExport(importNode, exportIndex) {
    const candidates = exportIndex[importNode.name];
    if (!candidates || candidates.length === 0)
        return null;
    // First check for exact path match
    for (const candidate of candidates) {
        if (importNode.path && candidate.path && candidate.path === importNode.path) {
            return { node: candidate, exactPathMatch: true };
        }
    }
    // Otherwise return first name match (path differs)
    return { node: candidates[0], exactPathMatch: false };
}
/**
 * Classifies a dependency based on match results.
 */
function classifyDependency(importNode, match) {
    if (!match)
        return types_js_1.DependencyStatus.MISSING;
    // Check for type/signature mismatch via metadata
    if (hasSignatureMismatch(importNode, match.node)) {
        return types_js_1.DependencyStatus.CONFLICT;
    }
    // Exact path match = SAFE
    if (match.exactPathMatch)
        return types_js_1.DependencyStatus.SAFE;
    // Name matches but path differs = NEEDS_REWRITE
    return types_js_1.DependencyStatus.NEEDS_REWRITE;
}
/**
 * Heuristic check for signature/type mismatch between import expectation and export reality.
 */
function hasSignatureMismatch(importNode, exportNode) {
    const importMeta = importNode.metadata;
    const exportMeta = exportNode.metadata;
    if (!importMeta || !exportMeta)
        return false;
    // Check type signature if available
    if (importMeta['signature'] && exportMeta['signature']) {
        return importMeta['signature'] !== exportMeta['signature'];
    }
    // Check return type if available
    if (importMeta['returnType'] && exportMeta['returnType']) {
        return importMeta['returnType'] !== exportMeta['returnType'];
    }
    // Check parameter count if available
    if (importMeta['paramCount'] !== undefined && exportMeta['paramCount'] !== undefined) {
        return importMeta['paramCount'] !== exportMeta['paramCount'];
    }
    return false;
}
/**
 * Detects conflicts for a given import and its match.
 */
function detectConflicts(importNode, match, pageNode, currentImports, generateId) {
    var _a, _b;
    const detected = [];
    // MISSING_DEPENDENCY: No match at all
    if (!match) {
        detected.push({
            id: generateId(),
            type: types_js_1.ConflictType.MISSING_DEPENDENCY,
            item: importNode.name,
            description: `Import "${importNode.name}" from "${importNode.path || 'unknown'}" has no matching export in the current project.`,
            resolutionOptions: [types_js_1.ResolutionStrategy.IGNORE, types_js_1.ResolutionStrategy.CUSTOM],
            recommended: types_js_1.ResolutionStrategy.IGNORE
        });
        return detected;
    }
    // NAME_COLLISION: Same name, but different implementations (path differs and metadata differs)
    if (!match.exactPathMatch && hasMetadataDifference(importNode, match.node)) {
        detected.push({
            id: generateId(),
            type: types_js_1.ConflictType.NAME_COLLISION,
            item: importNode.name,
            description: `Export "${importNode.name}" exists in both projects with different implementations.`,
            resolutionOptions: [types_js_1.ResolutionStrategy.RENAME, types_js_1.ResolutionStrategy.MERGE, types_js_1.ResolutionStrategy.OVERWRITE],
            recommended: types_js_1.ResolutionStrategy.RENAME,
            details: {
                externalPath: importNode.path,
                currentPath: match.node.path
            }
        });
    }
    // TYPE_MISMATCH: Export exists but type signature is incompatible
    if (hasSignatureMismatch(importNode, match.node)) {
        detected.push({
            id: generateId(),
            type: types_js_1.ConflictType.TYPE_MISMATCH,
            item: importNode.name,
            description: `Export "${importNode.name}" exists but has incompatible type signature.`,
            resolutionOptions: [types_js_1.ResolutionStrategy.OVERWRITE, types_js_1.ResolutionStrategy.CUSTOM],
            recommended: types_js_1.ResolutionStrategy.CUSTOM,
            details: {
                expectedSignature: (_a = importNode.metadata) === null || _a === void 0 ? void 0 : _a['signature'],
                actualSignature: (_b = match.node.metadata) === null || _b === void 0 ? void 0 : _b['signature']
            }
        });
    }
    // CIRCULAR_DEPENDENCY: Detect cycles using Tarjan's SCC (I-07 FIX)
    // Check direct circular: external imports from current AND current imports from external
    if (pageNode.path && currentImports.has(pageNode.path)) {
        const circularNames = currentImports.get(pageNode.path);
        if (circularNames.size > 0) {
            detected.push({
                id: generateId(),
                type: types_js_1.ConflictType.CIRCULAR_DEPENDENCY,
                item: importNode.name,
                description: `Circular dependency detected: "${pageNode.name}" imports from current project, and current project already imports from "${pageNode.path}".`,
                resolutionOptions: [types_js_1.ResolutionStrategy.IGNORE, types_js_1.ResolutionStrategy.CUSTOM],
                recommended: types_js_1.ResolutionStrategy.IGNORE,
                details: {
                    externalFile: pageNode.path,
                    circularImports: Array.from(circularNames),
                    cycleType: 'direct'
                }
            });
        }
    }
    // Multi-step cycle detection: check if importNode forms part of a longer cycle
    // via the currentImports map (A → B → C → A pattern)
    if (importNode.path) {
        const visited = new Set();
        const cycleNodes = [];
        let currentPath = importNode.path;
        while (currentPath && !visited.has(currentPath)) {
            visited.add(currentPath);
            cycleNodes.push(currentPath);
            // Find what this path imports
            const importsFromCurrent = currentImports.get(currentPath);
            if (!importsFromCurrent)
                break;
            // Check if any import points back to our original import
            let foundCycle = false;
            for (const importedName of importsFromCurrent) {
                if (importedName === importNode.name || importedName === importNode.path) {
                    foundCycle = true;
                    break;
                }
            }
            if (foundCycle && cycleNodes.length > 2) {
                detected.push({
                    id: generateId(),
                    type: types_js_1.ConflictType.CIRCULAR_DEPENDENCY,
                    item: importNode.name,
                    description: `Multi-step circular dependency detected: ${cycleNodes.join(' → ')} → ${importNode.path}`,
                    resolutionOptions: [types_js_1.ResolutionStrategy.IGNORE, types_js_1.ResolutionStrategy.CUSTOM],
                    recommended: types_js_1.ResolutionStrategy.IGNORE,
                    details: {
                        cycleNodes,
                        cycleLength: cycleNodes.length,
                        cycleType: 'multi-step',
                        suggestedBreakPoint: cycleNodes[Math.floor(cycleNodes.length / 2)]
                    }
                });
                break;
            }
            // Move to next node in chain (first import path found)
            currentPath = undefined;
            if (importsFromCurrent.size > 0) {
                currentPath = Array.from(importsFromCurrent)[0];
            }
        }
    }
    return detected;
}
/**
 * Checks if two nodes have meaningfully different metadata.
 * I-13 TIER 3: Full structural subtyping with variance analysis and breaking change detection.
 */
function hasMetadataDifference(nodeA, nodeB) {
    if (!nodeA.metadata && !nodeB.metadata)
        return false;
    if (!nodeA.metadata || !nodeB.metadata)
        return true;
    const metaA = nodeA.metadata;
    const metaB = nodeB.metadata;
    // I-13 Tier 3: Structural subtype comparison for function signatures
    if (metaA['signature'] || metaB['signature']) {
        const sigA = parseSignatureFromMetadata(metaA);
        const sigB = parseSignatureFromMetadata(metaB);
        if (sigA && sigB) {
            const subtypeResult = analyzeStructuralSubtyping(sigA, sigB);
            if (!subtypeResult.compatible || subtypeResult.breakingChanges.length > 0) {
                return true;
            }
            // If compatible via structural subtyping, they're not "different"
            return false;
        }
    }
    // Compare parameter count (quick check)
    if (metaA['paramCount'] !== undefined && metaB['paramCount'] !== undefined) {
        if (metaA['paramCount'] !== metaB['paramCount']) {
            // Check if it's just added optional params (non-breaking)
            const paramTypesA = metaA['paramTypes'] || [];
            const paramTypesB = metaB['paramTypes'] || [];
            const maxLen = Math.max(paramTypesA.length, paramTypesB.length);
            const minLen = Math.min(paramTypesA.length, paramTypesB.length);
            // If extra params are optional (contain '?'), it's not breaking
            const extraParams = maxLen > paramTypesA.length ? paramTypesB.slice(minLen) : paramTypesA.slice(minLen);
            const allOptional = extraParams.every(p => p.includes('?') || p.includes('undefined'));
            if (!allOptional)
                return true;
        }
    }
    // Compare return type with variance awareness
    if (metaA['returnType'] && metaB['returnType']) {
        if (!isReturnTypeCompatible(metaA['returnType'], metaB['returnType'])) {
            return true;
        }
    }
    // Compare type parameters (generic types)
    if (metaA['typeParams'] && metaB['typeParams']) {
        const tpA = Array.isArray(metaA['typeParams']) ? metaA['typeParams'] : [];
        const tpB = Array.isArray(metaB['typeParams']) ? metaB['typeParams'] : [];
        if (tpA.length !== tpB.length)
            return true;
    }
    // Deep equality for nested metadata structures (excluding projectPath)
    const keysA = Object.keys(metaA).filter(k => k !== 'projectPath' && k !== 'sourceFile');
    const keysB = Object.keys(metaB).filter(k => k !== 'projectPath' && k !== 'sourceFile');
    // Significant key count difference still indicates different implementations
    if (Math.abs(keysA.length - keysB.length) > 3)
        return true;
    // Check shared keys for deep differences
    const sharedKeys = keysA.filter(k => k in metaB);
    let differenceScore = 0;
    for (const key of sharedKeys) {
        const valA = metaA[key];
        const valB = metaB[key];
        if (valA === valB)
            continue;
        // Deep compare arrays and objects
        if (JSON.stringify(valA) !== JSON.stringify(valB)) {
            differenceScore++;
        }
    }
    // Threshold: more than 30% of shared keys differ
    return sharedKeys.length > 0 && (differenceScore / sharedKeys.length) > 0.3;
}
// ============ I-13 TIER 3: STRUCTURAL SUBTYPING ENGINE ============
/**
 * Parse a function signature from node metadata into structured form.
 */
function parseSignatureFromMetadata(meta) {
    var _a;
    const sig = meta['signature'];
    if (!sig || typeof sig !== 'string')
        return null;
    // Parse signature string: "(param1: Type1, param2?: Type2) => ReturnType"
    const params = [];
    const paramTypes = meta['paramTypes'] || [];
    const paramCount = meta['paramCount'] || 0;
    for (let i = 0; i < paramCount; i++) {
        const typeStr = paramTypes[i] || 'any';
        const isOptional = typeStr.includes('?') || typeStr.includes('undefined');
        const isRest = typeStr.startsWith('...');
        params.push({
            name: `param${i}`,
            type: typeStr.replace(/^\.\.\.|[?]$/g, ''),
            optional: isOptional,
            rest: isRest,
        });
    }
    return {
        name: meta['name'] || 'anonymous',
        params,
        returnType: meta['returnType'] || 'void',
        typeParams: meta['typeParams'] || [],
        isAsync: sig.includes('async') || ((_a = meta['returnType']) === null || _a === void 0 ? void 0 : _a.includes('Promise')),
        isGenerator: sig.includes('*') || sig.includes('Generator'),
    };
}
/**
 * I-13 Tier 3: Analyze structural subtyping between two function signatures.
 * Implements TypeScript-style structural compatibility with variance analysis.
 */
function analyzeStructuralSubtyping(source, target) {
    const paramCompatibility = [];
    const breakingChanges = [];
    // Parameter analysis: contravariant (target params must accept source args)
    const maxParams = Math.max(source.params.length, target.params.length);
    for (let i = 0; i < maxParams; i++) {
        const sourceParam = source.params[i];
        const targetParam = target.params[i];
        if (!sourceParam && targetParam) {
            // Target has extra param that source doesn't provide
            if (!targetParam.optional && !targetParam.rest) {
                breakingChanges.push({
                    kind: 'added-required-param',
                    description: `Parameter '${targetParam.name}: ${targetParam.type}' added as required at position ${i}`,
                    severity: 'breaking',
                    affectedSymbol: target.name,
                });
                paramCompatibility.push({
                    paramName: targetParam.name,
                    compatible: false,
                    reason: 'Required parameter added',
                    sourceType: 'undefined',
                    targetType: targetParam.type,
                });
            }
            else {
                paramCompatibility.push({
                    paramName: targetParam.name,
                    compatible: true,
                    reason: 'Optional parameter added (non-breaking)',
                    sourceType: 'undefined',
                    targetType: targetParam.type,
                });
            }
        }
        else if (sourceParam && !targetParam) {
            // Source has param that target removed
            breakingChanges.push({
                kind: 'removed-param',
                description: `Parameter '${sourceParam.name}: ${sourceParam.type}' removed at position ${i}`,
                severity: 'breaking',
                affectedSymbol: source.name,
            });
            paramCompatibility.push({
                paramName: sourceParam.name,
                compatible: false,
                reason: 'Parameter removed',
                sourceType: sourceParam.type,
                targetType: 'removed',
            });
        }
        else if (sourceParam && targetParam) {
            // Both have param at position i — check contravariant compatibility
            const typeCompat = isTypeAssignable(sourceParam.type, targetParam.type);
            if (!typeCompat && !targetParam.optional) {
                breakingChanges.push({
                    kind: 'type-narrowed',
                    description: `Parameter type changed from '${sourceParam.type}' to '${targetParam.type}' (incompatible)`,
                    severity: 'breaking',
                    affectedSymbol: targetParam.name,
                });
            }
            paramCompatibility.push({
                paramName: targetParam.name,
                compatible: typeCompat || targetParam.optional,
                reason: typeCompat ? 'Types compatible' : `Type narrowed: ${sourceParam.type} → ${targetParam.type}`,
                sourceType: sourceParam.type,
                targetType: targetParam.type,
            });
        }
    }
    // Return type analysis: covariant (source return must be assignable to target return)
    const returnTypeCompatible = isReturnTypeCompatible(source.returnType, target.returnType);
    if (!returnTypeCompatible) {
        breakingChanges.push({
            kind: 'return-type-changed',
            description: `Return type changed from '${source.returnType}' to '${target.returnType}'`,
            severity: 'breaking',
            affectedSymbol: target.name,
        });
    }
    // Generic type parameter analysis
    if (source.typeParams.length !== target.typeParams.length) {
        breakingChanges.push({
            kind: 'generic-constraint-added',
            description: `Type parameters changed from <${source.typeParams.join(', ')}> to <${target.typeParams.join(', ')}>`,
            severity: 'warning',
            affectedSymbol: target.name,
        });
    }
    // Async/sync change
    if (source.isAsync !== target.isAsync) {
        breakingChanges.push({
            kind: 'async-changed',
            description: `Function ${source.isAsync ? 'was async, now sync' : 'was sync, now async'}`,
            severity: 'breaking',
            affectedSymbol: target.name,
        });
    }
    // Determine overall variance direction
    let direction = 'invariant';
    const allParamsCompat = paramCompatibility.every(p => p.compatible);
    if (allParamsCompat && returnTypeCompatible) {
        direction = 'covariant';
    }
    else if (allParamsCompat && !returnTypeCompatible) {
        direction = 'contravariant';
    }
    else if (!allParamsCompat && returnTypeCompatible) {
        direction = 'contravariant';
    }
    const compatible = breakingChanges.filter(c => c.severity === 'breaking').length === 0;
    return {
        compatible,
        direction,
        paramCompatibility,
        returnTypeCompatible,
        breakingChanges,
    };
}
/**
 * I-13 Tier 3: Check if sourceType is assignable to targetType (covariant return check).
 * Implements TypeScript-style type assignability heuristics.
 */
function isReturnTypeCompatible(sourceType, targetType) {
    if (!sourceType || !targetType)
        return true;
    if (sourceType === targetType)
        return true;
    const src = sourceType.trim().toLowerCase();
    const tgt = targetType.trim().toLowerCase();
    // 'any' and 'unknown' are universally compatible
    if (src === 'any' || tgt === 'any' || tgt === 'unknown')
        return true;
    // 'void' is assignable to 'undefined' and vice versa
    if ((src === 'void' && tgt === 'undefined') || (src === 'undefined' && tgt === 'void'))
        return true;
    // 'never' is assignable to everything
    if (src === 'never')
        return true;
    // Promise<X> compatible with Promise<Y> if X compatible with Y
    const srcPromise = src.match(/^promise<(.+)>$/);
    const tgtPromise = tgt.match(/^promise<(.+)>$/);
    if (srcPromise && tgtPromise) {
        return isReturnTypeCompatible(srcPromise[1], tgtPromise[1]);
    }
    // Union types: source is assignable if it's a subset of target union
    if (tgt.includes('|')) {
        const targetUnion = tgt.split('|').map(t => t.trim());
        return targetUnion.includes(src);
    }
    // null/undefined assignable to nullable types
    if ((src === 'null' || src === 'undefined') && tgt.includes('null'))
        return true;
    // Array compatibility
    if (src.endsWith('[]') && tgt.endsWith('[]')) {
        return isReturnTypeCompatible(src.slice(0, -2), tgt.slice(0, -2));
    }
    return src === tgt;
}
/**
 * I-13 Tier 3: Check if sourceType is assignable to targetType for parameters (contravariant).
 */
function isTypeAssignable(sourceType, targetType) {
    if (!sourceType || !targetType)
        return true;
    if (sourceType === targetType)
        return true;
    const src = sourceType.trim().toLowerCase();
    const tgt = targetType.trim().toLowerCase();
    // any accepts everything
    if (src === 'any' || tgt === 'any')
        return true;
    // unknown accepts everything as parameter (contravariant)
    if (src === 'unknown')
        return true;
    // For parameters, target is wider (accepts more) = compatible
    // string | number is wider than string
    if (tgt.includes('|')) {
        const targetUnion = tgt.split('|').map(t => t.trim());
        if (targetUnion.includes(src))
            return true;
    }
    if (src.includes('|')) {
        const sourceUnion = src.split('|').map(t => t.trim());
        const targetUnion = tgt.includes('|') ? tgt.split('|').map(t => t.trim()) : [tgt];
        return sourceUnion.every(s => targetUnion.includes(s));
    }
    return src === tgt;
}
/**
 * I-13 Tier 3: Detect breaking changes between two module's public APIs.
 * Compares all exports and identifies incompatible changes.
 */
function detectBreakingChanges(previousExports, currentExports) {
    const changes = [];
    const prevByName = new Map(previousExports.map(n => [n.name, n]));
    const currByName = new Map(currentExports.map(n => [n.name, n]));
    // Check for removed exports (breaking)
    for (const [name, prevNode] of prevByName) {
        if (!currByName.has(name)) {
            changes.push({
                kind: 'removed-param',
                description: `Export '${name}' was removed from public API`,
                severity: 'breaking',
                affectedSymbol: name,
            });
        }
    }
    // Check for signature changes in existing exports
    for (const [name, currNode] of currByName) {
        const prevNode = prevByName.get(name);
        if (!prevNode)
            continue; // new export, not breaking
        const prevMeta = prevNode.metadata || {};
        const currMeta = currNode.metadata || {};
        const prevSig = parseSignatureFromMetadata(prevMeta);
        const currSig = parseSignatureFromMetadata(currMeta);
        if (prevSig && currSig) {
            const result = analyzeStructuralSubtyping(prevSig, currSig);
            changes.push(...result.breakingChanges);
        }
    }
    return changes;
}
/**
 * Computes unified graph properties from dependency analysis results.
 */
function computeGraphProperties(dependencyMap) {
    const total = dependencyMap.length;
    if (total === 0) {
        return {
            reachability: 1,
            stability: 1,
            fragility: 0,
            integrationDistance: 0
        };
    }
    let safeCount = 0;
    let rewriteCount = 0;
    let conflictCount = 0;
    let missingCount = 0;
    for (const dep of dependencyMap) {
        switch (dep.status) {
            case types_js_1.DependencyStatus.SAFE:
                safeCount++;
                break;
            case types_js_1.DependencyStatus.NEEDS_REWRITE:
                rewriteCount++;
                break;
            case types_js_1.DependencyStatus.CONFLICT:
                conflictCount++;
                break;
            case types_js_1.DependencyStatus.MISSING:
                missingCount++;
                break;
        }
    }
    // reachability = (SAFE + NEEDS_REWRITE) / total
    const reachability = (safeCount + rewriteCount) / total;
    // stability = SAFE / total
    const stability = safeCount / total;
    // fragility = (CONFLICT + MISSING) / total
    const fragility = (conflictCount + missingCount) / total;
    // integrationDistance = NEEDS_REWRITE + (CONFLICT * 3) + (MISSING * 5)
    const integrationDistance = rewriteCount + (conflictCount * 3) + (missingCount * 5);
    return { reachability, stability, fragility, integrationDistance };
}
/**
 * Converts a DependencyStatus to a confidence score for edge annotations.
 */
function statusToConfidence(status) {
    switch (status) {
        case types_js_1.DependencyStatus.SAFE: return 1.0;
        case types_js_1.DependencyStatus.NEEDS_REWRITE: return 0.7;
        case types_js_1.DependencyStatus.CONFLICT: return 0.3;
        case types_js_1.DependencyStatus.MISSING: return 0.0;
    }
}
/**
 * Adds a node to the collection only if it's not already present (by id).
 */
function addNodeIfMissing(nodes, node) {
    if (!nodes.some((n) => n.id === node.id)) {
        nodes.push(node);
    }
}
// ============ I-07: TARJAN'S STRONGLY CONNECTED COMPONENTS ============
/**
 * Tarjan's SCC Algorithm — textbook-correct implementation.
 * Identifies ALL strongly connected components in O(V+E) time via single DFS pass.
 *
 * Algorithm:
 *   1. Perform DFS, assigning each node an index and lowlink value
 *   2. Maintain a stack of visited nodes
 *   3. When a node's lowlink equals its index, pop the stack to form an SCC
 *
 * Returns structured SCC data including component members, break points,
 * cross-component edges, and the condensation DAG.
 */
function computeTarjanSCC(graph) {
    const nodes = graph.nodes;
    const edges = graph.edges;
    // Build adjacency list from graph edges
    const adjacency = new Map();
    const inDegreeMap = new Map();
    const outDegreeMap = new Map();
    for (const node of nodes) {
        adjacency.set(node.id, []);
        inDegreeMap.set(node.id, 0);
        outDegreeMap.set(node.id, 0);
    }
    for (const edge of edges) {
        const neighbors = adjacency.get(edge.from);
        if (neighbors) {
            neighbors.push(edge.to);
            outDegreeMap.set(edge.from, (outDegreeMap.get(edge.from) || 0) + 1);
            inDegreeMap.set(edge.to, (inDegreeMap.get(edge.to) || 0) + 1);
        }
    }
    // Tarjan's algorithm state
    let indexCounter = 0;
    const nodeIndex = new Map();
    const nodeLowlink = new Map();
    const onStack = new Set();
    const stack = [];
    const sccs = [];
    /**
     * Core Tarjan's DFS — recursive strongconnect function.
     */
    function strongConnect(nodeId) {
        // Set the depth index for this node
        nodeIndex.set(nodeId, indexCounter);
        nodeLowlink.set(nodeId, indexCounter);
        indexCounter++;
        stack.push(nodeId);
        onStack.add(nodeId);
        // Consider successors of nodeId
        const successors = adjacency.get(nodeId) || [];
        for (const successor of successors) {
            if (!nodeIndex.has(successor)) {
                // Successor has not yet been visited — recurse
                strongConnect(successor);
                // After recursion, update lowlink
                nodeLowlink.set(nodeId, Math.min(nodeLowlink.get(nodeId), nodeLowlink.get(successor)));
            }
            else if (onStack.has(successor)) {
                // Successor is on stack — it's part of current SCC
                nodeLowlink.set(nodeId, Math.min(nodeLowlink.get(nodeId), nodeIndex.get(successor)));
            }
        }
        // If nodeId is a root node (lowlink == index), pop the SCC
        if (nodeLowlink.get(nodeId) === nodeIndex.get(nodeId)) {
            const component = [];
            let w;
            do {
                w = stack.pop();
                onStack.delete(w);
                component.push(w);
            } while (w !== nodeId);
            sccs.push(component);
        }
    }
    // Run Tarjan's on all nodes (handles disconnected graphs)
    for (const node of nodes) {
        if (!nodeIndex.has(node.id)) {
            strongConnect(node.id);
        }
    }
    // Build structured SCC results
    const components = [];
    const nodeToSCC = new Map();
    let sccId = 0;
    for (const scc of sccs) {
        // Only consider SCCs with more than 1 member as actual cycles
        const isCycle = scc.length > 1;
        // Compute weight: sum of out-degree for all members
        let weight = 0;
        for (const memberId of scc) {
            weight += (outDegreeMap.get(memberId) || 0);
            nodeToSCC.set(memberId, sccId);
        }
        // Compute break points for cycle SCCs
        const breakPoints = [];
        if (isCycle) {
            for (const memberId of scc) {
                const outDeg = outDegreeMap.get(memberId) || 0;
                const inDeg = inDegreeMap.get(memberId) || 0;
                // Count edges that would need rewiring if this node is removed from cycle
                const internalEdges = (adjacency.get(memberId) || []).filter(target => scc.includes(target)).length;
                breakPoints.push({
                    nodeId: memberId,
                    outDegree: outDeg,
                    inDegree: inDeg,
                    breakCost: internalEdges,
                    recommendation: generateBreakRecommendation(memberId, inDeg, outDeg, internalEdges, nodes),
                });
            }
            // Sort break points by cost (lowest cost = best break candidate)
            breakPoints.sort((a, b) => a.breakCost - b.breakCost);
        }
        components.push({
            id: sccId,
            members: scc,
            size: scc.length,
            weight,
            breakPoints,
        });
        sccId++;
    }
    // Build condensation DAG: edges between different SCCs
    const condensationEdges = [];
    const condensationSeen = new Set();
    for (const edge of edges) {
        const fromSCC = nodeToSCC.get(edge.from);
        const toSCC = nodeToSCC.get(edge.to);
        if (fromSCC !== undefined && toSCC !== undefined && fromSCC !== toSCC) {
            const key = `${fromSCC}_${toSCC}`;
            if (!condensationSeen.has(key)) {
                condensationSeen.add(key);
                condensationEdges.push({
                    fromSCC,
                    toSCC,
                    crossEdgeCount: 1,
                });
            }
            else {
                // Increment cross-edge count
                const existing = condensationEdges.find(e => e.fromSCC === fromSCC && e.toSCC === toSCC);
                if (existing)
                    existing.crossEdgeCount++;
            }
        }
    }
    // Compute summary statistics
    const cycleComponents = components.filter(c => c.size > 1);
    const largestComponentSize = components.reduce((max, c) => Math.max(max, c.size), 0);
    return {
        components,
        condensationDAG: condensationEdges,
        totalCycles: cycleComponents.length,
        largestComponentSize,
        hasCycles: cycleComponents.length > 0,
    };
}
/**
 * Generates a human-readable break recommendation for an SCC node.
 */
function generateBreakRecommendation(nodeId, inDegree, outDegree, internalEdges, nodes) {
    const node = nodes.find(n => n.id === nodeId);
    const name = (node === null || node === void 0 ? void 0 : node.name) || nodeId;
    if (internalEdges === 0) {
        return `"${name}" has no internal cycle edges — already decoupled.`;
    }
    if (internalEdges === 1 && outDegree <= 2) {
        return `Break at "${name}" (low cost: only ${internalEdges} internal edge). Consider extracting an interface.`;
    }
    if (inDegree > outDegree) {
        return `"${name}" is a hub (${inDegree} incoming). Splitting this module would decouple dependents.`;
    }
    if (outDegree > inDegree) {
        return `"${name}" has many outgoing deps (${outDegree}). Consider dependency injection to break cycle.`;
    }
    return `"${name}" has ${internalEdges} internal cycle edges. Refactoring may require extracting shared interfaces.`;
}
/**
 * Convenience function: Runs Tarjan's SCC and integrates results with conflict detection.
 * Returns cycle-related conflicts as ConflictResolution entries.
 */
function detectCyclesWithTarjan(graph, generateConflictId) {
    const sccResult = computeTarjanSCC(graph);
    const conflicts = [];
    // For each SCC with size > 1 (actual cycle), generate a conflict entry
    for (const component of sccResult.components) {
        if (component.size <= 1)
            continue;
        const memberNames = component.members.map(id => {
            const node = graph.nodes.find(n => n.id === id);
            return (node === null || node === void 0 ? void 0 : node.name) || id;
        });
        const bestBreak = component.breakPoints[0]; // lowest cost
        conflicts.push({
            id: generateConflictId(),
            type: types_js_1.ConflictType.CIRCULAR_DEPENDENCY,
            item: memberNames.join(', '),
            description: `Strongly connected component with ${component.size} nodes: ${memberNames.slice(0, 5).join(' → ')}${component.size > 5 ? ' → ...' : ''}`,
            resolutionOptions: [types_js_1.ResolutionStrategy.IGNORE, types_js_1.ResolutionStrategy.CUSTOM],
            recommended: types_js_1.ResolutionStrategy.CUSTOM,
            details: {
                cycleType: 'tarjan-scc',
                componentId: component.id,
                members: component.members,
                memberNames,
                size: component.size,
                weight: component.weight,
                suggestedBreakPoint: bestBreak === null || bestBreak === void 0 ? void 0 : bestBreak.nodeId,
                breakCost: bestBreak === null || bestBreak === void 0 ? void 0 : bestBreak.breakCost,
                breakRecommendation: bestBreak === null || bestBreak === void 0 ? void 0 : bestBreak.recommendation,
            },
        });
    }
    return { sccResult, conflicts };
}
//# sourceMappingURL=relationshipAnalyzer.js.map