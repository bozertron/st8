#!/usr/bin/env node
/**
 * backfill-manifest-history.js — One-shot tool to seed manifest-history.jsonl
 * from the git log of `scripts/migration/manifest.json`.
 *
 * The active manifest.json is overwritten each batch, so a single `cat` only
 * shows the latest. This walker uses `git log` to enumerate every commit that
 * touched manifest.json, extracts the file's contents at each commit via
 * `git show <sha>:scripts/migration/manifest.json`, parses it, and appends a
 * record per unique batch to manifest-history.jsonl.
 *
 * Idempotent: re-running skips any (batch, gitCommit) pair already on disk.
 * Run from repo root:  `node scripts/migration/backfill-manifest-history.js`
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { appendManifestHistory, readManifestHistory, MANIFEST_HISTORY_PATH } =
  require('./verify.js');

function listManifestCommits() {
  // --diff-filter=AM: commits where manifest.json was Added or Modified
  // (exclude Deleted). --reverse: chronological order, oldest first.
  // --format=%H: full SHA for git show.
  const out = execFileSync(
    'git',
    [
      'log',
      '--reverse',
      '--diff-filter=AM',
      '--format=%H',
      '--',
      'scripts/migration/manifest.json',
    ],
    { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 }
  ).toString();
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function manifestAt(sha) {
  try {
    const text = execFileSync(
      'git',
      ['show', `${sha}:scripts/migration/manifest.json`],
      { cwd: REPO_ROOT, stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }
    ).toString();
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function shortSha(sha) {
  try {
    return execFileSync('git', ['rev-parse', '--short', sha], {
      cwd: REPO_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    }).toString().trim();
  } catch (_) {
    return sha.slice(0, 7);
  }
}

function main() {
  console.log(`Reading existing entries from ${path.relative(REPO_ROOT, MANIFEST_HISTORY_PATH)}...`);
  const existing = readManifestHistory();
  console.log(`  ${existing.length} existing record(s)`);

  const commits = listManifestCommits();
  console.log(`\nFound ${commits.length} commit(s) touching manifest.json.\n`);

  let appended = 0;
  let skipped = 0;
  for (const sha of commits) {
    const manifest = manifestAt(sha);
    if (!manifest || !manifest.batch) {
      console.log(`  ${sha.slice(0, 7)}  (unparseable manifest — skipping)`);
      skipped++;
      continue;
    }
    const short = shortSha(sha);
    const ok = appendManifestHistory(manifest, { gitCommit: short });
    if (ok) {
      console.log(`  ${short}  +  batch="${manifest.batch}" (${(manifest.moves || []).length} moves)`);
      appended++;
    } else {
      console.log(`  ${short}     batch="${manifest.batch}" already recorded — skipped`);
      skipped++;
    }
  }

  console.log(`\nDone: ${appended} appended, ${skipped} skipped.`);
  console.log(`History file: ${path.relative(REPO_ROOT, MANIFEST_HISTORY_PATH)}`);
}

if (require.main === module) {
  main();
}

module.exports = { listManifestCommits, manifestAt };
