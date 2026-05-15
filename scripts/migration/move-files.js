#!/usr/bin/env node
/**
 * move-files.js — Phase 1 of the refactor migration.
 *
 * Reads scripts/migration/manifest.json and, for each { from, to } entry:
 *   1. Copies `from` -> `to` (originals stay; this is non-destructive).
 *   2. Verifies SHA-256(src) === SHA-256(dst) — byte-identical copy.
 *   3. Writes a results.json record per move (path, hash, line count).
 *
 * Idempotent: re-running on an already-migrated batch is a no-op aside from
 * re-verifying hashes.
 *
 * Persistence-side work (RENAME mutation logging, file_registry filepath
 * updates, schema card regeneration) is deliberately NOT performed here.
 * Those run in a separate pass after the move is verified end-to-end.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function sha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const results = [];
  let ok = 0;
  let fail = 0;

  console.log(`Migration batch: ${manifest.batch}`);
  console.log(`Repo root:       ${REPO_ROOT}`);
  console.log(`Moves:           ${manifest.moves.length}\n`);

  for (const m of manifest.moves) {
    const fromAbs = path.resolve(REPO_ROOT, m.from);
    const toAbs = path.resolve(REPO_ROOT, m.to);

    if (!fs.existsSync(fromAbs)) {
      console.log(`FAIL ${m.from} -> ${m.to}  (source missing)`);
      results.push({ ...m, status: 'fail', reason: 'source_missing' });
      fail++;
      continue;
    }

    fs.mkdirSync(path.dirname(toAbs), { recursive: true });

    // If destination exists and is non-empty, only overwrite if source hash differs
    // (idempotency). If destination is an empty stub from the prior 0_-skeleton
    // commit, overwrite it.
    let willCopy = true;
    if (fs.existsSync(toAbs) && fs.statSync(toAbs).size > 0) {
      const dstHash = sha256(toAbs);
      const srcHash = sha256(fromAbs);
      if (dstHash === srcHash) {
        willCopy = false;
      }
    }

    if (willCopy) {
      fs.copyFileSync(fromAbs, toAbs);
    }

    const srcHash = sha256(fromAbs);
    const dstHash = sha256(toAbs);

    if (srcHash !== dstHash) {
      console.log(`FAIL ${m.from} -> ${m.to}  (hash mismatch after copy)`);
      results.push({ ...m, status: 'fail', reason: 'hash_mismatch' });
      fail++;
      continue;
    }

    const lines = countLines(toAbs);
    const tag = willCopy ? 'COPY' : 'SAME';
    console.log(
      `${tag} ${m.from} -> ${m.to}  (${lines} lines, sha256=${srcHash.slice(0, 12)}…)`
    );
    results.push({
      ...m,
      status: 'ok',
      action: willCopy ? 'copied' : 'already_in_sync',
      sha256: srcHash,
      lines,
    });
    ok++;
  }

  const summary = {
    batch: manifest.batch,
    generatedAt: new Date().toISOString(),
    ok,
    fail,
    results,
  };

  fs.writeFileSync(
    path.join(__dirname, 'results.move.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\nDone: ${ok} ok, ${fail} fail`);
  console.log(`Results written to scripts/migration/results.move.json`);

  process.exit(fail > 0 ? 1 : 0);
}

main();
