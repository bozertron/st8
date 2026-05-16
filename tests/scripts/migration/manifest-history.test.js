'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  appendManifestHistory,
  readManifestHistory,
  MANIFEST_HISTORY_PATH,
} = require('../../../scripts/migration/verify.js');

describe('scripts/migration/verify.js — manifest-history.jsonl (ticket 25)', () => {
  let tmp;
  let logPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-manifest-hist-'));
    logPath = path.join(tmp, 'manifest-history.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const sampleManifest = {
    batch: 'shared',
    generatedAt: '2026-05-14',
    description: 'Pure file moves with case-style normalization.',
    moves: [
      { from: 'lib/utils/safeFs.js', to: 'src/shared/utils/safe-fs.js' },
    ],
  };

  it('appends a single line containing a valid JSON record', () => {
    const ok = appendManifestHistory(sampleManifest, {
      historyPath: logPath,
      gitCommit: 'abc1234',
    });
    assert.equal(ok, true);
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    const rec = JSON.parse(lines[0]);
    assert.equal(rec.batch, 'shared');
    assert.equal(rec.description, sampleManifest.description);
    assert.equal(rec.generatedAt, '2026-05-14');
    assert.equal(rec.gitCommit, 'abc1234');
    assert.deepEqual(rec.moves, sampleManifest.moves);
    assert.ok(rec.verifiedAt && rec.verifiedAt.endsWith('Z'),
      'verifiedAt should be an ISO timestamp');
  });

  it('is idempotent across re-runs at the same commit', () => {
    appendManifestHistory(sampleManifest, { historyPath: logPath, gitCommit: 'aaa' });
    const second = appendManifestHistory(sampleManifest, { historyPath: logPath, gitCommit: 'aaa' });
    assert.equal(second, false);
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
  });

  it('is idempotent even when called from a later HEAD (same moves signature)', () => {
    // Ticket-25 design choice: a batch is identified by (batch name, moves)
    // — re-verifying after later commits land does NOT pollute the audit
    // log with duplicate entries for the same logical batch.
    appendManifestHistory(sampleManifest, { historyPath: logPath, gitCommit: 'aaa' });
    const again = appendManifestHistory(sampleManifest, { historyPath: logPath, gitCommit: 'bbb' });
    assert.equal(again, false, 'same batch+moves at later commit must not duplicate');
    const recs = readManifestHistory(logPath);
    assert.equal(recs.length, 1);
  });

  it('records distinct batches as separate lines', () => {
    appendManifestHistory(sampleManifest, { historyPath: logPath, gitCommit: 'aaa' });
    appendManifestHistory(
      { batch: 'analysis', generatedAt: '2026-05-14', description: 'A', moves: [{ from: 'a.js', to: 'b.js' }] },
      { historyPath: logPath, gitCommit: 'bbb' }
    );
    const recs = readManifestHistory(logPath);
    assert.equal(recs.length, 2);
    assert.deepEqual(recs.map((r) => r.batch).sort(), ['analysis', 'shared']);
  });

  it('preserves optional notes + followUps fields when present', () => {
    appendManifestHistory(
      {
        batch: 'integr8-core',
        generatedAt: '2026-05-14',
        description: 'core',
        moves: [{ from: 'a', to: 'b' }],
        notes: ['dynamic loader hand-patched'],
        followUps: ['retarget manifest-generator'],
      },
      { historyPath: logPath, gitCommit: 'cdf' }
    );
    const recs = readManifestHistory(logPath);
    assert.deepEqual(recs[0].notes, ['dynamic loader hand-patched']);
    assert.deepEqual(recs[0].followUps, ['retarget manifest-generator']);
  });

  it('readManifestHistory returns [] for missing file', () => {
    const recs = readManifestHistory(path.join(tmp, 'no-such.jsonl'));
    assert.deepEqual(recs, []);
  });

  it('readManifestHistory skips malformed lines without throwing', () => {
    fs.writeFileSync(logPath,
      JSON.stringify({ batch: 'good', moves: [] }) + '\n' +
      'not valid json\n' +
      JSON.stringify({ batch: 'also-good', moves: [] }) + '\n'
    );
    const recs = readManifestHistory(logPath);
    assert.equal(recs.length, 2);
    assert.deepEqual(recs.map((r) => r.batch), ['good', 'also-good']);
  });

  it('real repo manifest-history.jsonl backfill contains all 12 known batches', () => {
    const recs = readManifestHistory(MANIFEST_HISTORY_PATH);
    if (!recs.length) return; // CI without backfill: skip
    const expected = [
      'shared',
      'core-database',
      'lifecycle-watcher',
      'schema-cards',
      'prd',
      'analysis',
      'integr8-core',
      'indexing-parsers',
      'indexing-engine',
      'server-and-entry',
      'frontend-components',
      'background-indexer',
    ];
    const got = new Set(recs.map((r) => r.batch));
    for (const batch of expected) {
      assert.equal(got.has(batch), true, `manifest-history.jsonl missing batch "${batch}"`);
    }
  });
});
