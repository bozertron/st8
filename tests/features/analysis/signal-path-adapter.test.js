'use strict';

/**
 * Tests for src/features/analysis/signal-path-adapter.js
 *
 * Wave 3B ticket 4 — wires path-generator (founder priority #1) onto
 * st8's live persistence layer via /api/signal-path. These probes
 * verify the adapter contract: real graph in, real topologically-
 * ordered signal path out, with correct upstream/downstream counts
 * and scoped graph properties.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSemanticGraphFromPersistence,
  computeSignalPath,
} = require('../../../src/features/analysis/signal-path-adapter');

function fakePersistence({ files, connections }) {
  return {
    getAllFiles: () => files,
    getAllConnections: () => connections,
    getFileByPath: (fp) => {
      const matches = files
        .filter((f) => f.filepath === fp)
        .sort((a, b) => (b.birthTimestamp || '').localeCompare(a.birthTimestamp || ''));
      return matches[0];
    },
  };
}

const FILES = [
  {
    fingerprint: 'fp_a',
    filepath: 'src/a.js',
    birthTimestamp: '2026-01-01T00:00:00.000Z',
    sha256Hash: 'sha-a',
    status: 'GREEN',
    reachabilityScore: 0.8,
    impactRadius: 2,
  },
  {
    fingerprint: 'fp_b',
    filepath: 'src/b.js',
    birthTimestamp: '2026-01-01T00:00:00.000Z',
    sha256Hash: 'sha-b',
    status: 'GREEN',
    reachabilityScore: 0.5,
    impactRadius: 1,
  },
  {
    fingerprint: 'fp_c',
    filepath: 'src/c.js',
    birthTimestamp: '2026-01-01T00:00:00.000Z',
    sha256Hash: 'sha-c',
    status: 'GREEN',
    reachabilityScore: 0.0,
    impactRadius: 0,
  },
  {
    fingerprint: 'fp_d',
    filepath: 'src/d.js',
    birthTimestamp: '2026-01-01T00:00:00.000Z',
    sha256Hash: 'sha-d',
    status: 'RED',
    reachabilityScore: 0.0,
    impactRadius: 0,
  },
];

// a imports b; b imports c. d is an island. So upstream of 'a' = {b, c}.
const CONNECTIONS = [
  { sourceFingerprint: 'fp_a', targetFingerprint: 'fp_b', connectionType: 'IMPORT', confidenceScore: 1 },
  { sourceFingerprint: 'fp_b', targetFingerprint: 'fp_c', connectionType: 'IMPORT', confidenceScore: 1 },
];

test('buildSemanticGraphFromPersistence: produces nodes + edges + properties', () => {
  const persistence = fakePersistence({ files: FILES, connections: CONNECTIONS });
  const graph = buildSemanticGraphFromPersistence(persistence);
  assert.equal(graph.nodes.length, 4, 'one node per filepath');
  assert.equal(graph.edges.length, 2, 'two valid IMPORTS edges');
  assert.ok(graph.properties);
  assert.ok(typeof graph.properties.reachability === 'number');
  // b and c each have one inbound edge; a and d have none → 2/4
  assert.equal(graph.properties.reachability, 0.5);
});

test('buildSemanticGraphFromPersistence: dedups multi-fingerprint by newest birthTimestamp', () => {
  const dupFiles = [
    ...FILES,
    {
      fingerprint: 'fp_a_OLD',
      filepath: 'src/a.js',
      birthTimestamp: '2020-01-01T00:00:00.000Z',
      sha256Hash: 'sha-a-OLD',
      status: 'RED',
      reachabilityScore: 0,
      impactRadius: 0,
    },
  ];
  const persistence = fakePersistence({ files: dupFiles, connections: CONNECTIONS });
  const graph = buildSemanticGraphFromPersistence(persistence);
  // Still 4 unique paths (a/b/c/d) — older a.js dedup'd out
  assert.equal(graph.nodes.length, 4);
  const aNode = graph.nodes.find((n) => n.path === 'src/a.js');
  assert.equal(aNode.metadata.fingerprint, 'fp_a', 'newest fingerprint wins');
});

test('buildSemanticGraphFromPersistence: drops edges whose endpoints are not in deduped graph', () => {
  const filesMinusC = FILES.filter((f) => f.fingerprint !== 'fp_c');
  const persistence = fakePersistence({ files: filesMinusC, connections: CONNECTIONS });
  const graph = buildSemanticGraphFromPersistence(persistence);
  // b->c edge dropped (c not in graph). a->b remains.
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].from, 'file_fp_a');
  assert.equal(graph.edges[0].to, 'file_fp_b');
});

test('computeSignalPath: returns ok=false on missing filepath arg', () => {
  const persistence = fakePersistence({ files: FILES, connections: CONNECTIONS });
  const r = computeSignalPath({ persistence });
  assert.equal(r.ok, false);
  assert.match(r.error, /targetFilepath/);
});

test('computeSignalPath: returns ok=false when filepath has no registry row', () => {
  const persistence = fakePersistence({ files: FILES, connections: CONNECTIONS });
  const r = computeSignalPath({ persistence, targetFilepath: 'src/does-not-exist.js' });
  assert.equal(r.ok, false);
  assert.match(r.error, /No file_registry row/);
});

test('computeSignalPath: returns ok=false on empty registry', () => {
  const persistence = fakePersistence({ files: [], connections: [] });
  const r = computeSignalPath({ persistence, targetFilepath: 'src/a.js' });
  assert.equal(r.ok, false);
});

test('computeSignalPath: real signal path with correct topological order (a -> b -> c)', () => {
  const persistence = fakePersistence({ files: FILES, connections: CONNECTIONS });
  const r = computeSignalPath({ persistence, targetFilepath: 'src/a.js' });
  assert.equal(r.ok, true);
  assert.equal(r.pathSummary.focal, 'src/a.js');
  assert.equal(r.pathSummary.focalFingerprint, 'fp_a');
  // Scoped subgraph: a + b + c (d is excluded, no edges to/from a)
  assert.equal(r.pathSummary.totalNodes, 3);
  assert.equal(r.pathSummary.totalEdges, 2);
  // Upstream of a = {b, c}; downstream = {}.
  assert.equal(r.pathSummary.upstreamCount, 2);
  assert.equal(r.pathSummary.downstreamCount, 0);
  // Topological copy order: deepest dep first.
  // path-generator emits copy_file steps in this order, plus a final
  // verify step.
  const orderedFiles = r.pathSummary.orderedFiles;
  const indexOf = (name) => orderedFiles.indexOf(name);
  assert.ok(indexOf('c.js') >= 0, 'c.js must be in ordered path');
  assert.ok(indexOf('b.js') >= 0, 'b.js must be in ordered path');
  assert.ok(indexOf('a.js') >= 0, 'a.js must be in ordered path');
  assert.ok(indexOf('c.js') < indexOf('b.js'), 'c.js comes before b.js');
  assert.ok(indexOf('b.js') < indexOf('a.js'), 'b.js comes before a.js (focal last)');
});

test('computeSignalPath: focal file with no upstream returns just itself + verify', () => {
  const persistence = fakePersistence({ files: FILES, connections: CONNECTIONS });
  const r = computeSignalPath({ persistence, targetFilepath: 'src/d.js' });
  assert.equal(r.ok, true);
  // d is an island — scoped graph contains only d
  assert.equal(r.pathSummary.totalNodes, 1);
  assert.equal(r.pathSummary.upstreamCount, 0);
  assert.equal(r.pathSummary.downstreamCount, 0);
  assert.equal(r.pathSummary.orderedFiles.length, 1);
  assert.equal(r.pathSummary.orderedFiles[0], 'd.js');
});

test('computeSignalPath: graph properties recomputed for scoped subgraph (not full project)', () => {
  const persistence = fakePersistence({ files: FILES, connections: CONNECTIONS });
  const r = computeSignalPath({ persistence, targetFilepath: 'src/a.js' });
  // In the scoped subgraph (a, b, c, edges a->b and b->c) two of three
  // nodes have inbound edges (b and c). Full-project reach was 0.5 (2/4).
  // Scoped reach should be 2/3 ≈ 0.667.
  assert.ok(r.pathSummary.graphProperties.reachability > 0.6);
  assert.ok(r.pathSummary.graphProperties.reachability < 0.7);
  // Outcome should NOT be FAILURE on this healthy local subgraph.
  assert.notEqual(r.outcome, 'failure');
});

test('computeSignalPath: returns the full plan + reasons + topologicalAnalysis from path-generator', () => {
  const persistence = fakePersistence({ files: FILES, connections: CONNECTIONS });
  const r = computeSignalPath({ persistence, targetFilepath: 'src/a.js' });
  assert.ok(r.plan, 'has migration plan');
  assert.ok(Array.isArray(r.plan.steps), 'plan.steps is an array');
  assert.ok(r.plan.steps.length >= 4, '3 copy + 1 verify minimum');
  assert.ok(Array.isArray(r.reasons), 'reasons is an array');
  assert.ok(r.reasons.length > 0, 'at least one reason');
  assert.ok(r.topologicalAnalysis, 'topologicalAnalysis present');
});
