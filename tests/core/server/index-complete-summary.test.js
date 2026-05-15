'use strict';

/**
 * tests/core/server/index-complete-summary.test.js — ticket 26.
 *
 * INDEX_COMPLETE subscriber errors are now aggregated and surfaced in
 * two places:
 *   1. The execute() summary is returned by hookRegistry.execute and
 *      logged at the call site (main.js) with a per-source breakdown.
 *   2. A structured JSON dump is written to
 *      .st8/index-complete-errors.json via _writeIndexCompleteSummary.
 *
 * These tests probe both surfaces.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

const { HookRegistry, HOOKS } = require('../../../src/core/hook-registry');
const { _writeIndexCompleteSummary } = require('../../../src/core/server/main');

function freshTargetDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'st8-t26-'));
}

test('ticket 26 — _writeIndexCompleteSummary writes a JSON dump with ok/fail/errors', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const summary = {
    ok: 3,
    fail: 2,
    errors: [
      { source: 'manifest-generator', error: 'disk full' },
      { source: 'gap-analyzer', error: 'parse error' },
    ],
  };
  await _writeIndexCompleteSummary(dir, summary);

  const file = path.join(dir, '.st8', 'index-complete-errors.json');
  assert.equal(fs.existsSync(file), true);
  const out = JSON.parse(await fsp.readFile(file, 'utf8'));

  assert.equal(out.ok, 3);
  assert.equal(out.fail, 2);
  assert.equal(out.errors.length, 2);
  assert.equal(out.errors[0].source, 'manifest-generator');
  assert.equal(out.errors[1].error, 'parse error');
  assert.match(out.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('ticket 26 — _writeIndexCompleteSummary truncates previous-run errors on a clean run', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // First run: failures recorded.
  await _writeIndexCompleteSummary(dir, {
    ok: 1, fail: 1,
    errors: [{ source: 'a', error: 'fail-once' }],
  });
  // Second run: clean.
  await _writeIndexCompleteSummary(dir, { ok: 5, fail: 0, errors: [] });

  const file = path.join(dir, '.st8', 'index-complete-errors.json');
  const out = JSON.parse(await fsp.readFile(file, 'utf8'));

  assert.equal(out.fail, 0);
  assert.equal(out.errors.length, 0, 'previous-run errors must NOT survive a clean run');
});

test('ticket 26 — INDEX_COMPLETE chain aggregates throws from multiple subscribers into summary.errors', async (t) => {
  // End-to-end: register a few throwers + observers on a fresh registry,
  // fire INDEX_COMPLETE, and assert the returned summary captures every
  // throw with its source tag. This is what main.js logs + dumps.
  const r = new HookRegistry();

  let observerRan = false;
  r.register(HOOKS.INDEX_COMPLETE, () => { throw new Error('p10-boom'); }, { priority: 10, source: 'mock-p10' });
  r.register(HOOKS.INDEX_COMPLETE, () => { throw new Error('p20-boom'); }, { priority: 20, source: 'mock-p20' });
  r.register(HOOKS.INDEX_COMPLETE, () => { observerRan = true; }, { priority: 90, source: 'mock-observer' });

  const summary = await r.execute(HOOKS.INDEX_COMPLETE, {});

  assert.equal(observerRan, true, 'late observer must still run despite earlier throws (isolation)');
  assert.equal(summary.ok, 1);
  assert.equal(summary.fail, 2);
  assert.deepEqual(
    summary.errors.map((e) => ({ source: e.source, error: e.error })),
    [
      { source: 'mock-p10', error: 'p10-boom' },
      { source: 'mock-p20', error: 'p20-boom' },
    ]
  );

  // Sanity: feed that summary through the writer; the JSON file matches.
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await _writeIndexCompleteSummary(dir, summary);
  const out = JSON.parse(
    await fsp.readFile(path.join(dir, '.st8', 'index-complete-errors.json'), 'utf8')
  );
  assert.equal(out.fail, 2);
  assert.equal(out.errors[0].source, 'mock-p10');
});
