'use strict';

/**
 * signal-path-adapter.js — Bridge between st8's live persistence
 * (file_registry + connections) and the path-generator module.
 *
 * THE FOUNDER'S #1 PRIORITY (per st8_bible.md batch 025): take a yellow/red
 * file, return the "signal path" — the chain of upstream dependencies plus
 * the recommended order of operations to reach the file.
 *
 * path-generator.generateMigrationPath() takes a SemanticGraph (nodes[],
 * edges[], properties{}) produced by integr8's data-ingestion pipeline.
 * That pipeline runs six parsers (overview/store/route/command/type/ui)
 * over the target project to extract a richly-typed graph for an
 * external-→-current MIGRATION analysis. Heavy and oriented around
 * migrating-an-app-into-another-app.
 *
 * For self-introspection ("what is this file's signal path within my own
 * project?") we don't need the migration framing. st8 already has the
 * dependency graph in SQLite:
 *
 *   - file_registry rows give us FILE-typed nodes (one per indexed file).
 *   - connections rows give us IMPORTS edges between fingerprints.
 *
 * This adapter materializes a SemanticGraph from those two tables and
 * feeds it to generateMigrationPath() with the target file as the lone
 * "page" entry. The topological sort + ordered-files output is exactly
 * the signal-path the founder is after; the migration-step framing is
 * a no-op tail (sourcePath === targetPath, no rewrites needed).
 *
 * The route at POST /api/signal-path consumes this. Frontend integration
 * (dive-in panel visualization) is Wave 7 scope — captured in the
 * roadmap. Backend wiring is done.
 *
 * Exports:
 *   - buildSemanticGraphFromPersistence(persistence) → SemanticGraph
 *   - computeSignalPath({persistence, targetFilepath, targetDir})
 *       → { ok, plan, outcome, reasons, topologicalAnalysis,
 *           pathSummary: { orderedFiles, focal, upstreamCount, downstreamCount } }
 */

const path = require('path');
const { generateMigrationPath } = require('./path-generator');
const {
  NodeType,
  EdgeType,
  DependencyStatus,
} = require('../../shared/types/integr8-types');

/**
 * Build a SemanticGraph from the persistence layer.
 *
 * Nodes: every file_registry row becomes a FILE node with id =
 *   `file_${fingerprint}` (so the node id is stable across runs).
 * Edges: every connections row becomes an IMPORTS edge from
 *   sourceFingerprint to targetFingerprint, with status SAFE
 *   (we're not classifying conflicts here — this is intra-project).
 *
 * properties.{reachability, stability, fragility} are computed from
 * the graph shape so evaluateOutcome() has real signal to work with.
 */
function buildSemanticGraphFromPersistence(persistence) {
  if (!persistence || typeof persistence.getAllFiles !== 'function') {
    throw new TypeError('signal-path-adapter: persistence with getAllFiles required');
  }

  const files = persistence.getAllFiles();
  const connections = persistence.getAllConnections();

  // Dedup files by filepath (newest birthTimestamp wins), matching the
  // schema-card-emitter's dedup contract (Wave 3A ticket 9). file_registry
  // can have multiple rows per filepath; signal-path should reflect the
  // current identity only.
  const filesByPath = new Map();
  for (const f of files) {
    const existing = filesByPath.get(f.filepath);
    if (!existing || (f.birthTimestamp || '') > (existing.birthTimestamp || '')) {
      filesByPath.set(f.filepath, f);
    }
  }
  const dedupedFiles = Array.from(filesByPath.values());
  const validFingerprints = new Set(dedupedFiles.map((f) => f.fingerprint));

  const nodes = dedupedFiles.map((f) => ({
    id: `file_${f.fingerprint}`,
    type: NodeType.FILE,
    name: path.basename(f.filepath),
    path: f.filepath,
    metadata: {
      fingerprint: f.fingerprint,
      sha256Hash: f.sha256Hash,
      status: f.status,
      reachabilityScore: f.reachabilityScore,
      impactRadius: f.impactRadius,
    },
  }));

  const edges = [];
  let edgeCounter = 0;
  for (const conn of connections) {
    if (!validFingerprints.has(conn.sourceFingerprint)) continue;
    if (!validFingerprints.has(conn.targetFingerprint)) continue;
    edges.push({
      id: `edge_${++edgeCounter}`,
      from: `file_${conn.sourceFingerprint}`,
      to: `file_${conn.targetFingerprint}`,
      type: EdgeType.IMPORTS,
      status: DependencyStatus.SAFE,
      confidence: typeof conn.confidenceScore === 'number' ? conn.confidenceScore : 1.0,
    });
  }

  // Compute graph properties so evaluateOutcome() has signal.
  // reachability = fraction of nodes with at least one inbound edge
  //   (i.e. they are imported by something). A high score means most
  //   files are wired into the dependency tree.
  // fragility    = fraction of nodes that participate in a cycle, capped
  //   crudely by self-edges and back-references. Approximate; the
  //   path-generator's own Tarjan would refine this. For our purposes
  //   a single-digit fragility is fine — the goal is to get evaluateOutcome
  //   to return something other than FAILURE on a healthy graph.
  // stability   = 1 - fragility.
  const incoming = new Map();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) {
    incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
  }
  let reachable = 0;
  for (const count of incoming.values()) {
    if (count > 0) reachable += 1;
  }
  const reachability = nodes.length === 0 ? 1 : reachable / nodes.length;

  // Cheap cycle approximation: any edge where both endpoints have edges
  // back to each other contributes to fragility. Real cycle detection
  // happens inside path-generator's analyzeCycleBreakPoints.
  const outAdj = new Map();
  for (const n of nodes) outAdj.set(n.id, new Set());
  for (const e of edges) outAdj.get(e.from).add(e.to);
  let bidirectional = 0;
  for (const e of edges) {
    if (outAdj.get(e.to) && outAdj.get(e.to).has(e.from)) bidirectional += 1;
  }
  const fragility = edges.length === 0 ? 0 : Math.min(1, bidirectional / Math.max(1, edges.length));
  const stability = 1 - fragility;

  return {
    nodes,
    edges,
    properties: { reachability, stability, fragility },
  };
}

/**
 * Compute the signal path for a target file.
 *
 * @param {Object} args
 * @param {Object} args.persistence — open St8Persistence instance
 * @param {string} args.targetFilepath — project-relative filepath
 *   (e.g. 'src/core/server/app.js'). The function will resolve it to a
 *   file_registry row by filepath equality.
 * @param {string} [args.targetDir] — used for sourcePath/targetPath of
 *   the generated MigrationPlan. Defaults to '.'.
 * @returns {Object} { ok, plan, outcome, reasons, topologicalAnalysis,
 *                     pathSummary, error }
 */
function computeSignalPath({ persistence, targetFilepath, targetDir }) {
  if (!persistence) {
    return { ok: false, error: 'persistence required' };
  }
  if (!targetFilepath || typeof targetFilepath !== 'string') {
    return { ok: false, error: 'targetFilepath (string) required' };
  }

  const resolvedTargetDir = targetDir || '.';

  // Resolve the file
  const targetFile = persistence.getFileByPath(targetFilepath);
  if (!targetFile) {
    return {
      ok: false,
      error: `No file_registry row for filepath '${targetFilepath}'. Index the project first.`,
    };
  }

  // Build the full graph
  const fullGraph = buildSemanticGraphFromPersistence(persistence);
  if (fullGraph.nodes.length === 0) {
    return {
      ok: false,
      error: 'Empty file_registry — index the project before requesting a signal path.',
    };
  }

  // PERFORMANCE SCOPING: path-generator's topologicalSortFiles does its
  // own BFS internally, but the surrounding analysis passes
  // (computeStepCosts, computeCriticalPath, computeParallelGroups,
  // performTopologicalAnalysis) are O(V*E) on the FULL input graph.
  // On a 300+ node st8.sqlite that turns a sub-second sort into
  // multi-minute analysis. Pre-scope to the focal file's connected
  // component (upstream deps + downstream consumers + edges among them)
  // so path-generator works on the local subgraph instead of the
  // whole project.
  const focalNodeIdEarly = `file_${targetFile.fingerprint}`;
  const focalExistsInGraph = fullGraph.nodes.some((n) => n.id === focalNodeIdEarly);
  if (!focalExistsInGraph) {
    return {
      ok: false,
      error: `Focal file is in file_registry but absent from graph — possible stale dedup. Fingerprint: ${targetFile.fingerprint}`,
    };
  }
  const scopedIds = new Set([focalNodeIdEarly]);
  // BFS upstream (followed by file we depend on)
  const upQ = [focalNodeIdEarly];
  while (upQ.length) {
    const cur = upQ.shift();
    for (const e of fullGraph.edges) {
      if (e.from === cur && !scopedIds.has(e.to)) {
        scopedIds.add(e.to);
        upQ.push(e.to);
      }
    }
  }
  // BFS downstream (followed by files that depend on us)
  const downQ = [focalNodeIdEarly];
  while (downQ.length) {
    const cur = downQ.shift();
    for (const e of fullGraph.edges) {
      if (e.to === cur && !scopedIds.has(e.from)) {
        scopedIds.add(e.from);
        downQ.push(e.from);
      }
    }
  }

  const scopedNodes = fullGraph.nodes.filter((n) => scopedIds.has(n.id));
  const scopedEdges = fullGraph.edges.filter((e) => scopedIds.has(e.from) && scopedIds.has(e.to));

  // Recompute graph properties OVER THE SCOPED SUBGRAPH so
  // evaluateOutcome's reachability check reflects "are this file's
  // local dependencies present and wired" rather than "is the whole
  // project well-connected." Without this, a healthy file in an
  // otherwise sprawling repo gets a FAILURE outcome because the
  // project-wide reachability is low (lots of doc/markdown orphans).
  const scopedIncoming = new Map();
  for (const n of scopedNodes) scopedIncoming.set(n.id, 0);
  for (const e of scopedEdges) {
    scopedIncoming.set(e.to, (scopedIncoming.get(e.to) || 0) + 1);
  }
  let scopedReachable = 0;
  for (const c of scopedIncoming.values()) if (c > 0) scopedReachable += 1;
  const scopedReachability =
    scopedNodes.length === 0 ? 1 : scopedReachable / scopedNodes.length;

  const graph = {
    nodes: scopedNodes,
    edges: scopedEdges,
    properties: {
      reachability: scopedReachability,
      stability: fullGraph.properties.stability,
      fragility: fullGraph.properties.fragility,
    },
  };

  // path-generator's topologicalSortFiles uses substring match on
  // node.name OR node.path against each entry in targetPages. We pass
  // the full filepath so the match is exact for our focal file.
  const targetPages = [targetFilepath];

  const result = generateMigrationPath(
    graph,
    [], // no integr8-style conflicts in self-introspection
    targetPages,
    resolvedTargetDir,
    resolvedTargetDir,
  );

  // Summarize the path for consumers that don't want the full MigrationPlan.
  const orderedFiles = (result.plan.steps || [])
    .filter((s) => s.action === 'copy_file')
    .map((s) => s.file)
    .filter(Boolean);

  const focalNodeId = `file_${targetFile.fingerprint}`;
  const upstream = new Set();
  const downstream = new Set();
  const queueUp = [focalNodeId];
  const seenUp = new Set();
  while (queueUp.length) {
    const cur = queueUp.shift();
    if (seenUp.has(cur)) continue;
    seenUp.add(cur);
    for (const e of graph.edges) {
      if (e.from === cur && !seenUp.has(e.to)) {
        upstream.add(e.to);
        queueUp.push(e.to);
      }
    }
  }
  const queueDown = [focalNodeId];
  const seenDown = new Set();
  while (queueDown.length) {
    const cur = queueDown.shift();
    if (seenDown.has(cur)) continue;
    seenDown.add(cur);
    for (const e of graph.edges) {
      if (e.to === cur && !seenDown.has(e.from)) {
        downstream.add(e.from);
        queueDown.push(e.from);
      }
    }
  }

  return {
    ok: true,
    plan: result.plan,
    outcome: result.outcome,
    reasons: result.reasons,
    topologicalAnalysis: result.topologicalAnalysis,
    pathSummary: {
      focal: targetFilepath,
      focalFingerprint: targetFile.fingerprint,
      orderedFiles,
      upstreamCount: upstream.size,
      downstreamCount: downstream.size,
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      totalProjectNodes: fullGraph.nodes.length,
      totalProjectEdges: fullGraph.edges.length,
      graphProperties: graph.properties,
    },
  };
}

module.exports = {
  buildSemanticGraphFromPersistence,
  computeSignalPath,
};
