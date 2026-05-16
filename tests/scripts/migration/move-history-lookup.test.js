'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  findMoves,
  loadHistory,
  normalize,
  formatResult,
} = require('../../../scripts/migration/move-history-lookup');

const HISTORY_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'migration',
  'move-history.json'
);

test('loadHistory returns a parsed object with completedBatches[]', () => {
  const history = loadHistory(HISTORY_PATH);
  assert.ok(Array.isArray(history.completedBatches), 'completedBatches is an array');
  assert.ok(history.completedBatches.length > 0, 'has at least one batch');
});

test('normalize strips leading OGB/ and trailing .txt', () => {
  assert.deepEqual(normalize('OGB/lib/commands/typeParser.js.txt'), {
    raw: 'OGB/lib/commands/typeParser.js.txt',
    ogbStripped: 'lib/commands/typeParser.js',
  });
  assert.deepEqual(normalize('./src/x.js'), {
    raw: 'src/x.js',
    ogbStripped: 'src/x.js',
  });
});

test('normalize rejects empty / non-string input', () => {
  assert.throws(() => normalize(''), /non-empty string/);
  assert.throws(() => normalize(null), /non-empty string/);
  assert.throws(() => normalize(undefined), /non-empty string/);
});

test('findMoves locates a current path via .to (background-indexer.js)', () => {
  const r = findMoves('src/features/indexing/background-indexer.js');
  assert.equal(r.length, 1);
  assert.equal(r[0].batch, 'background-indexer');
  assert.equal(r[0].match, 'to');
  assert.equal(r[0].move.from, 'lib/commands/backgroundIndexer.js');
});

test('findMoves locates an original via .from (lib/commands/backgroundIndexer.js)', () => {
  const r = findMoves('lib/commands/backgroundIndexer.js');
  assert.equal(r.length, 1);
  assert.equal(r[0].batch, 'background-indexer');
  assert.equal(r[0].match, 'from');
});

test('findMoves resolves an OGB-archive path via the strip rule', () => {
  const r = findMoves('OGB/lib/commands/typeParser.js.txt');
  assert.equal(r.length, 1);
  assert.equal(r[0].batch, 'indexing-parsers');
  assert.equal(r[0].match, 'ogb');
  assert.equal(r[0].move.from, 'lib/commands/typeParser.js');
  assert.equal(r[0].move.to, 'src/features/indexing/type-parser.js');
});

test('findMoves returns [] for an unknown path', () => {
  const r = findMoves('src/no/such/file.js');
  assert.deepEqual(r, []);
});

test('findMoves accepts a pre-loaded history (no extra disk read)', () => {
  const history = loadHistory(HISTORY_PATH);
  const r = findMoves('src/shared/utils/safe-fs.js', { history });
  assert.equal(r.length, 1);
  assert.equal(r[0].batch, 'shared');
});

test('formatResult prints a human-readable single match', () => {
  const r = findMoves('src/features/indexing/background-indexer.js');
  const txt = formatResult(r);
  assert.match(txt, /batch=background-indexer/);
  assert.match(txt, /matched on \.to/);
  assert.match(txt, /lib\/commands\/backgroundIndexer\.js/);
});

test('formatResult handles empty result', () => {
  assert.equal(formatResult([]), 'No batch in move-history.json moved that path.');
});
