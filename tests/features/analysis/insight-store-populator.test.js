'use strict';

/**
 * Tests for src/features/analysis/insight-store-populator.js
 *
 * Wave 3B ticket 7 — wires insight-store from "schema-only on first
 * construction" to a populated table reflecting current file_registry
 * state. Verifies the contract: RED files → error, YELLOW →
 * warning/under-connected, low-reachability GREEN → warning/under-
 * imported, high-impactRadius → info/high-impact.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { populateInsightsFromRegistry } = require('../../../src/features/analysis/insight-store-populator');
const { InsightStore } = require('../../../src/features/analysis/insight-store');

function fakePersistence(files) {
  return { getAllFiles: () => files };
}

function makeTempStore() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-insight-pop-'));
  const dbPath = path.join(tmp, 'test.sqlite');
  const store = new InsightStore(dbPath);
  return { tmp, dbPath, store };
}

test('populateInsightsFromRegistry: throws on missing persistence', () => {
  assert.throws(() => populateInsightsFromRegistry(null), /persistence/);
  assert.throws(() => populateInsightsFromRegistry({}), /persistence/);
});

test('populateInsightsFromRegistry: RED file with impactRadius=0 → error/orphan', () => {
  const { store } = makeTempStore();
  try {
    const persistence = fakePersistence([
      {
        fingerprint: 'fp_orphan',
        filepath: 'src/dead.js',
        status: 'RED',
        impactRadius: 0,
        reachabilityScore: 0,
        sha256Hash: 'sha-orphan',
        birthTimestamp: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const result = populateInsightsFromRegistry(persistence, { projectId: 'test', store });
    assert.equal(result.files, 1);
    assert.equal(result.severityCounts.error, 1);
    const insights = store.getInsightsForFile('test', 'src/dead.js');
    assert.equal(insights.length, 1);
    assert.equal(insights[0].category, 'orphan');
    assert.equal(insights[0].severity, 'error');
  } finally {
    store.close();
  }
});

test('populateInsightsFromRegistry: YELLOW file → warning/under-connected', () => {
  const { store } = makeTempStore();
  try {
    const persistence = fakePersistence([
      {
        fingerprint: 'fp_y',
        filepath: 'src/yellow.js',
        status: 'YELLOW',
        impactRadius: 2,
        reachabilityScore: 0.4,
        birthTimestamp: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const result = populateInsightsFromRegistry(persistence, { projectId: 'test', store });
    assert.equal(result.severityCounts.warning, 1);
    const ins = store.getInsightsForFile('test', 'src/yellow.js');
    assert.equal(ins.length, 1);
    assert.equal(ins[0].category, 'under-connected');
    assert.equal(ins[0].severity, 'warning');
  } finally {
    store.close();
  }
});

test('populateInsightsFromRegistry: GREEN low-reachability → warning/under-imported', () => {
  const { store } = makeTempStore();
  try {
    const persistence = fakePersistence([
      {
        fingerprint: 'fp_g',
        filepath: 'src/green-thin.js',
        status: 'GREEN',
        impactRadius: 1,
        reachabilityScore: 0.1,
        birthTimestamp: '2026-01-01T00:00:00.000Z',
      },
    ]);
    populateInsightsFromRegistry(persistence, { projectId: 'test', store });
    const ins = store.getInsightsForFile('test', 'src/green-thin.js');
    assert.equal(ins.length, 1);
    assert.equal(ins[0].category, 'under-imported');
    assert.equal(ins[0].severity, 'warning');
  } finally {
    store.close();
  }
});

test('populateInsightsFromRegistry: high impactRadius adds an info/high-impact insight', () => {
  const { store } = makeTempStore();
  try {
    const persistence = fakePersistence([
      {
        fingerprint: 'fp_hot',
        filepath: 'src/hot.js',
        status: 'YELLOW',
        impactRadius: 25,
        reachabilityScore: 0.5,
        birthTimestamp: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const result = populateInsightsFromRegistry(persistence, { projectId: 'test', store });
    assert.equal(result.severityCounts.warning, 1);
    assert.equal(result.severityCounts.info, 1);
    const ins = store.getInsightsForFile('test', 'src/hot.js');
    assert.equal(ins.length, 2);
    const categories = ins.map((i) => i.category).sort();
    assert.deepEqual(categories, ['high-impact', 'under-connected']);
  } finally {
    store.close();
  }
});

test('populateInsightsFromRegistry: is idempotent (snapshot semantics, not append)', () => {
  const { store } = makeTempStore();
  try {
    const persistence = fakePersistence([
      {
        fingerprint: 'fp_a',
        filepath: 'src/a.js',
        status: 'RED',
        impactRadius: 0,
        reachabilityScore: 0,
        birthTimestamp: '2026-01-01T00:00:00.000Z',
      },
    ]);
    populateInsightsFromRegistry(persistence, { projectId: 'test', store });
    populateInsightsFromRegistry(persistence, { projectId: 'test', store });
    populateInsightsFromRegistry(persistence, { projectId: 'test', store });
    const ins = store.getInsightsForFile('test', 'src/a.js');
    assert.equal(ins.length, 1, 'second/third run must not double-count');
  } finally {
    store.close();
  }
});

test('populateInsightsFromRegistry: dedups multi-fingerprint by newest birthTimestamp', () => {
  const { store } = makeTempStore();
  try {
    const persistence = fakePersistence([
      {
        fingerprint: 'fp_old',
        filepath: 'src/dup.js',
        status: 'RED',
        impactRadius: 0,
        reachabilityScore: 0,
        birthTimestamp: '2020-01-01T00:00:00.000Z',
      },
      {
        fingerprint: 'fp_new',
        filepath: 'src/dup.js',
        status: 'GREEN',
        impactRadius: 5,
        reachabilityScore: 0.9,
        birthTimestamp: '2027-01-01T00:00:00.000Z',
      },
    ]);
    const result = populateInsightsFromRegistry(persistence, { projectId: 'test', store });
    assert.equal(result.files, 1, 'dedup-by-newest counted as 1');
    const ins = store.getInsightsForFile('test', 'src/dup.js');
    assert.equal(ins.length, 0, 'newer (GREEN) wins; no insight emitted');
  } finally {
    store.close();
  }
});
