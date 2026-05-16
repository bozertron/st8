#!/usr/bin/env node

/**
 * move-history reverse lookup
 *
 * Given any path observed during the refactor — a current path
 * (e.g. "src/features/indexing/background-indexer.js"), the original
 * pre-refactor path (e.g. "lib/commands/backgroundIndexer.js"), or the
 * OGB archive path (e.g. "OGB/lib/commands/typeParser.js.txt") — return
 * the batch that moved it and the move record (from/to).
 *
 * Why: move-history.json is structured for forward auditing
 * (batch -> moves[]), but humans investigating a file usually start
 * from the path. This helper inverts the lookup so 'which batch moved
 * this?' is a single call.
 *
 * Usage:
 *   const { findMoves } = require('./move-history-lookup');
 *   findMoves('src/features/indexing/background-indexer.js');
 *   // => [{ batch: 'background-indexer', match: 'to',
 *   //       move: { from: 'lib/commands/backgroundIndexer.js',
 *   //               to: 'src/features/indexing/background-indexer.js' },
 *   //       completedAt: '2026-05-14' }]
 *
 * CLI: `node scripts/migration/move-history-lookup.js <path>`
 *
 * Resolution rules (matched in this order, all results returned):
 *   1. Exact match on move.to  (current-path query)
 *   2. Exact match on move.from (original pre-refactor path query)
 *   3. OGB-prefixed path: strip leading "OGB/" and optional trailing
 *      ".txt" then re-match against move.from. Captures the convention
 *      that batch 019 archived originals as "OGB/<orig-path>.txt".
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_HISTORY_PATH = path.join(__dirname, 'move-history.json');

/**
 * Load and parse move-history.json. Errors propagate.
 * @param {string} [historyPath]
 * @returns {{ completedBatches: Array<{batch: string, completedAt: string, moves: Array<{from: string, to: string}>}> }}
 */
function loadHistory(historyPath = DEFAULT_HISTORY_PATH) {
  const raw = fs.readFileSync(historyPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.completedBatches)) {
    throw new Error(`move-history at ${historyPath} missing completedBatches[]`);
  }
  return parsed;
}

/**
 * Normalize a candidate query path:
 *   - strip leading "./"
 *   - strip leading "OGB/" if present
 *   - strip a trailing ".txt" if present (batch 019 convention)
 * Returns both the OGB-stripped form and the original — callers test both.
 * @param {string} input
 * @returns {{ raw: string, ogbStripped: string }}
 */
function normalize(input) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('move-history-lookup: query path must be a non-empty string');
  }
  let raw = input.startsWith('./') ? input.slice(2) : input;
  let ogbStripped = raw;
  if (ogbStripped.startsWith('OGB/')) {
    ogbStripped = ogbStripped.slice('OGB/'.length);
  }
  if (ogbStripped.endsWith('.txt')) {
    ogbStripped = ogbStripped.slice(0, -'.txt'.length);
  }
  return { raw, ogbStripped };
}

/**
 * Reverse-lookup. Returns every batch+move that matches the query.
 * @param {string} queryPath
 * @param {object} [opts]
 * @param {string} [opts.historyPath]
 * @param {object} [opts.history]  pre-loaded history (skip file read)
 * @returns {Array<{batch: string, completedAt: string, match: 'to'|'from'|'ogb', move: {from: string, to: string}}>}
 */
function findMoves(queryPath, opts = {}) {
  const history = opts.history || loadHistory(opts.historyPath);
  const { raw, ogbStripped } = normalize(queryPath);
  const out = [];
  for (const batch of history.completedBatches) {
    for (const move of batch.moves || []) {
      if (move.to === raw) {
        out.push({ batch: batch.batch, completedAt: batch.completedAt, match: 'to', move });
        continue;
      }
      if (move.from === raw) {
        out.push({ batch: batch.batch, completedAt: batch.completedAt, match: 'from', move });
        continue;
      }
      if (ogbStripped !== raw && move.from === ogbStripped) {
        out.push({ batch: batch.batch, completedAt: batch.completedAt, match: 'ogb', move });
      }
    }
  }
  return out;
}

function formatResult(result) {
  if (result.length === 0) return 'No batch in move-history.json moved that path.';
  return result.map(r =>
    `batch=${r.batch} (${r.completedAt}) matched on .${r.match}\n  from: ${r.move.from}\n  to:   ${r.move.to}`
  ).join('\n');
}

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write('Usage: node move-history-lookup.js <path>\n');
    process.exit(2);
  }
  try {
    const result = findMoves(arg);
    process.stdout.write(formatResult(result) + '\n');
    process.exit(result.length === 0 ? 1 : 0);
  } catch (err) {
    process.stderr.write(`move-history-lookup: ${err.message}\n`);
    process.exit(2);
  }
}

module.exports = { findMoves, loadHistory, normalize, formatResult };
