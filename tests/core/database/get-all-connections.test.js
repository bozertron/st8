'use strict';

/**
 * tests/core/database/get-all-connections.test.js — ticket 18 probe.
 *
 * Verifies the new persistence.getAllConnections() method:
 *   - exists and returns an array (empty on a fresh DB)
 *   - returns inserted rows with the expected columns
 *   - is deterministic across runs (ORDER BY source, target)
 *
 * Uses a real St8Persistence against a tmp DB — no mocks of the SUT.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Persistence } = require('../../../src/core/database/persistence');

async function freshPersistence(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-gac-'));
  const origCwd = process.cwd();
  process.chdir(dir);
  const p = new St8Persistence();
  await p.initialize();
  t.after(() => {
    try { p.close(); } catch (_) {}
    process.chdir(origCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return p;
}

test('getAllConnections — exists as a function on St8Persistence', async (t) => {
  const p = await freshPersistence(t);
  assert.equal(typeof p.getAllConnections, 'function', 'method must be defined');
});

test('getAllConnections — returns [] on a fresh DB', async (t) => {
  const p = await freshPersistence(t);
  const rows = p.getAllConnections();
  assert.equal(Array.isArray(rows), true);
  assert.equal(rows.length, 0);
});

test('getAllConnections — returns inserted rows with source+target fingerprints', async (t) => {
  const p = await freshPersistence(t);

  // Insert two file_registry rows first (FK target — UNIQUE on (filepath, fingerprint)).
  p.upsertFile({
    fingerprint: 'a.js||t1', filepath: 'a.js', filename: 'a.js',
    sha256Hash: 'h1', birthTimestamp: '2026-01-01T00:00:00Z',
  });
  p.upsertFile({
    fingerprint: 'b.js||t1', filepath: 'b.js', filename: 'b.js',
    sha256Hash: 'h2', birthTimestamp: '2026-01-01T00:00:01Z',
  });

  p.insertConnection({
    sourceFingerprint: 'a.js||t1',
    targetFingerprint: 'b.js||t1',
    connectionType: 'IMPORT',
  });

  const rows = p.getAllConnections();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceFingerprint, 'a.js||t1');
  assert.equal(rows[0].targetFingerprint, 'b.js||t1');
  assert.equal(rows[0].connectionType, 'IMPORT');
});

test('getAllConnections — sorted by (sourceFingerprint, targetFingerprint) for deterministic output', async (t) => {
  const p = await freshPersistence(t);

  // Insert three files and three connections in non-sorted order.
  for (const fp of ['a.js||t1', 'b.js||t1', 'c.js||t1']) {
    p.upsertFile({
      fingerprint: fp, filepath: fp.split('||')[0], filename: fp.split('||')[0],
      sha256Hash: fp, birthTimestamp: '2026-01-01T00:00:00Z',
    });
  }
  // Insert in shuffled order.
  p.insertConnection({ sourceFingerprint: 'c.js||t1', targetFingerprint: 'a.js||t1', connectionType: 'IMPORT' });
  p.insertConnection({ sourceFingerprint: 'a.js||t1', targetFingerprint: 'b.js||t1', connectionType: 'IMPORT' });
  p.insertConnection({ sourceFingerprint: 'a.js||t1', targetFingerprint: 'c.js||t1', connectionType: 'IMPORT' });

  const rows = p.getAllConnections();
  const pairs = rows.map((r) => `${r.sourceFingerprint} -> ${r.targetFingerprint}`);
  assert.deepEqual(pairs, [
    'a.js||t1 -> b.js||t1',
    'a.js||t1 -> c.js||t1',
    'c.js||t1 -> a.js||t1',
  ]);
});
