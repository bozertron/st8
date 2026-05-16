#!/usr/bin/env node
/**
 * ogb-destroy.js — Automated OGB/ cleanup with backup tarball + reference audit.
 *
 * Background:
 *   Batch 019 (st8_bible.md L2374) staged the pre-refactor originals into
 *   OGB/ as a safety net. Now that the refactor has settled (batches 020-027,
 *   398/398 tests passing), the founder's plan is to destroy OGB/ once a
 *   final manual verification pass is done. Until this tool existed, that
 *   was a hand-rm followed by hand-cleanup of the resulting empty parent
 *   directories. This script automates the safe path.
 *
 * Invariants enforced:
 *
 *   A. No live src/, tests/, scripts/ require/import points at any OGB/ file.
 *      If any reference is found, abort with the offending grep hits — these
 *      MUST be migrated or pruned first. (Without this check, deletion would
 *      silently break runtime.)
 *
 *   B. A timestamped backup tarball is written to .st8/ogb-backup/
 *      BEFORE any rm happens. The tarball is the audit trail — git history
 *      still has the originals too, but this gives a single restorable file.
 *
 *   C. Bottom-up rm with empty-dir cleanup. After files are removed, walks
 *      OGB/ bottom-up and rmdirs any empty parent dirs (closes ticket 24's
 *      "empty subdirectories remain after founder cleanup" concern).
 *
 * Modes:
 *
 *   --dry-run    Default. Prints planned actions, exits 0 without touching FS.
 *   --yes        Performs the destruction.
 *
 * Exit codes:
 *
 *   0 — dry-run completed OR destruction succeeded
 *   1 — invariant violation (live references found, OGB missing, etc.)
 *   2 — runtime error (tar failed, permission denied, etc.)
 *
 * Run:
 *   node scripts/migration/ogb-destroy.js              # dry-run
 *   node scripts/migration/ogb-destroy.js --yes        # actually destroy
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OGB_DIR = path.join(REPO_ROOT, 'OGB');
const BACKUP_DIR = path.join(REPO_ROOT, '.st8', 'ogb-backup');

const COLOR = {
  ok: '\x1b[32m',
  warn: '\x1b[33m',
  fail: '\x1b[31m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

function log(level, msg) {
  const c = COLOR[level] || '';
  console.log(`${c}${level.toUpperCase().padEnd(4)}${COLOR.reset}  ${msg}`);
}

/**
 * Recursively walk a directory, returning file paths and directory paths
 * separately. Directories are returned bottom-up (deepest first) so
 * rmdir loops work without recursion.
 */
function walkOGB(dir) {
  const files = [];
  const dirs = [];
  function recurse(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        recurse(full);
        dirs.push(full); // post-order: children first
      } else if (e.isFile()) {
        files.push(full);
      }
    }
  }
  recurse(dir);
  return { files, dirs };
}

/**
 * Search the live tree (src/, tests/, scripts/, start.js, package.json) for
 * any require/import string that would resolve into OGB/. Pattern matches:
 *   require('OGB/...')
 *   require('./OGB/...')
 *   require('../OGB/...')
 *   require('../../OGB/...')
 *   from 'OGB/...'
 *   from './OGB/...'
 * etc.
 *
 * Returns an array of {file, line, snippet} hits. Empty array == clean.
 */
function findLiveOGBReferences() {
  const patterns = [
    "require\\([\"'](\\./|\\.\\./)*OGB/",
    "from [\"'](\\./|\\.\\./)*OGB/",
    "import\\(.*[\"'](\\./|\\.\\./)*OGB/",
  ];
  const combined = patterns.join('|');
  const targets = ['src', 'tests', 'scripts', 'start.js', 'package.json'];
  const selfPath = path.relative(REPO_ROOT, __filename);
  const hits = [];
  for (const target of targets) {
    const abs = path.join(REPO_ROOT, target);
    if (!fs.existsSync(abs)) continue;
    const res = spawnSync(
      'grep',
      ['-rnE', combined, abs, '--exclude-dir=node_modules', '--exclude-dir=.st8'],
      { encoding: 'utf8' }
    );
    if (res.stdout) {
      for (const line of res.stdout.split('\n')) {
        if (!line) continue;
        // grep output: <file>:<lineno>:<content>
        const m = line.match(/^([^:]+):(\d+):(.*)$/);
        if (m) {
          const relFile = path.relative(REPO_ROOT, m[1]);
          // Self-exclusion: don't flag our own doc comments.
          if (relFile === selfPath) continue;
          // Skip pure comment lines (// or *) — these are documentary, not live requires.
          const snippet = m[3].trim();
          if (/^(\/\/|\*|\/\*)/.test(snippet)) continue;
          hits.push({ file: relFile, line: Number(m[2]), snippet });
        }
      }
    }
  }
  return hits;
}

function makeBackupTarball() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tarballPath = path.join(BACKUP_DIR, `OGB-${stamp}.tar.gz`);
  execFileSync(
    'tar',
    ['-czf', tarballPath, '-C', REPO_ROOT, 'OGB'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const size = fs.statSync(tarballPath).size;
  return { tarballPath, size };
}

function run() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--yes');

  log('dim', `Mode: ${dryRun ? 'DRY-RUN' : 'DESTRUCTIVE (--yes)'}`);
  log('dim', `OGB dir: ${OGB_DIR}`);

  // ─── Existence check ────────────────────────────────────
  if (!fs.existsSync(OGB_DIR)) {
    log('warn', 'OGB/ does not exist — nothing to do.');
    process.exit(0);
  }

  // ─── Inventory ──────────────────────────────────────────
  const { files, dirs } = walkOGB(OGB_DIR);
  log('ok', `OGB/ inventory: ${files.length} files, ${dirs.length} subdirectories.`);

  // ─── Invariant A: no live references ────────────────────
  const refs = findLiveOGBReferences();
  if (refs.length > 0) {
    log('fail', `Aborting — ${refs.length} live require/import reference(s) into OGB/ detected:`);
    for (const h of refs.slice(0, 20)) {
      console.log(`        ${COLOR.dim}${h.file}:${h.line}:${COLOR.reset} ${h.snippet}`);
    }
    if (refs.length > 20) console.log(`        ${COLOR.dim}... ${refs.length - 20} more${COLOR.reset}`);
    log('fail', 'These references must be migrated or removed before destroying OGB/.');
    process.exit(1);
  }
  log('ok', 'Invariant A: no live require/import references into OGB/.');

  // ─── Plan preview ───────────────────────────────────────
  console.log('');
  log('dim', 'Planned actions:');
  console.log(`        ${COLOR.dim}1.${COLOR.reset} Write backup tarball to ${path.relative(REPO_ROOT, BACKUP_DIR)}/OGB-<timestamp>.tar.gz`);
  console.log(`        ${COLOR.dim}2.${COLOR.reset} Remove ${files.length} file(s) from OGB/`);
  console.log(`        ${COLOR.dim}3.${COLOR.reset} Remove ${dirs.length} empty subdirectories (bottom-up)`);
  console.log(`        ${COLOR.dim}4.${COLOR.reset} Remove OGB/ itself`);

  if (dryRun) {
    console.log('');
    log('ok', 'Dry-run complete. Re-run with --yes to execute.');
    process.exit(0);
  }

  // ─── Destructive path ───────────────────────────────────
  console.log('');
  log('dim', 'Executing destruction...');

  // Backup first
  let backup;
  try {
    backup = makeBackupTarball();
    log('ok', `Backup written: ${path.relative(REPO_ROOT, backup.tarballPath)} (${(backup.size / 1024).toFixed(1)} KB)`);
  } catch (e) {
    log('fail', `Backup failed: ${e.message}`);
    process.exit(2);
  }

  // Remove files
  let removedFiles = 0;
  for (const f of files) {
    try {
      fs.unlinkSync(f);
      removedFiles++;
    } catch (e) {
      log('fail', `Failed to remove ${path.relative(REPO_ROOT, f)}: ${e.message}`);
      process.exit(2);
    }
  }
  log('ok', `Removed ${removedFiles} file(s).`);

  // Bottom-up rmdir
  let removedDirs = 0;
  for (const d of dirs) {
    try {
      fs.rmdirSync(d);
      removedDirs++;
    } catch (e) {
      log('warn', `Could not rmdir ${path.relative(REPO_ROOT, d)}: ${e.message}`);
    }
  }
  log('ok', `Removed ${removedDirs} empty subdirectory/ies.`);

  // OGB/ root
  try {
    fs.rmdirSync(OGB_DIR);
    log('ok', 'Removed OGB/ root.');
  } catch (e) {
    log('warn', `Could not rmdir OGB/: ${e.message} (may have stray files)`);
  }

  console.log('');
  log('ok', `OGB destruction complete. Backup at ${path.relative(REPO_ROOT, backup.tarballPath)}.`);
  process.exit(0);
}

// Allow require() for tests, run() only when invoked directly.
if (require.main === module) {
  run();
}

module.exports = {
  walkOGB,
  findLiveOGBReferences,
  OGB_DIR,
  BACKUP_DIR,
};
