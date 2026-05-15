#!/usr/bin/env node
/**
 * stage-originals.js — Stage originals for deletion.
 *
 * Reads scripts/migration/move-history.json. For every recorded `from` file:
 *   1. Copy it to OGB/<from-path>.txt (directory structure preserved inside
 *      OGB; suffix .txt appended so the file is no longer interpreted as JS
 *      by any tooling that walks the repo).
 *   2. Delete the original at its old path.
 *
 * Result: the migrated files live ONLY at their new src/ locations. The old
 * paths are empty (and git tracks the deletion). The OGB copies are inert
 * text snapshots in case the founder wants to inspect or restore anything
 * before destroying the directory at their leisure.
 *
 * st8.html and other root-level files NOT in move-history are left alone.
 *
 * Idempotent: re-running on an already-staged batch is a no-op (skips files
 * whose original is already gone AND whose OGB copy exists).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HISTORY_PATH = path.join(__dirname, 'move-history.json');
const OGB_ROOT = path.join(REPO_ROOT, 'OGB');

function main() {
  const hist = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  const moves = [];
  for (const batch of hist.completedBatches || []) {
    for (const m of batch.moves || []) moves.push({ ...m, batch: batch.batch });
  }

  console.log(`Total migrated files in move-history: ${moves.length}`);
  console.log(`Staging originals into: ${OGB_ROOT}`);
  console.log('');

  fs.mkdirSync(OGB_ROOT, { recursive: true });

  let staged = 0;
  let alreadyStaged = 0;
  let missingOriginal = 0;
  const results = [];

  for (const m of moves) {
    const fromAbs = path.resolve(REPO_ROOT, m.from);
    const ogbAbs = path.join(OGB_ROOT, m.from + '.txt');
    const ogbDir = path.dirname(ogbAbs);

    if (!fs.existsSync(fromAbs)) {
      // Original is gone. Did we already stage it?
      if (fs.existsSync(ogbAbs)) {
        console.log(`SKIP   ${m.from}  (already staged at ${path.relative(REPO_ROOT, ogbAbs)})`);
        alreadyStaged++;
        results.push({ ...m, status: 'already_staged' });
      } else {
        console.log(`MISS   ${m.from}  (original gone, no OGB copy — was it deleted manually?)`);
        missingOriginal++;
        results.push({ ...m, status: 'missing' });
      }
      continue;
    }

    fs.mkdirSync(ogbDir, { recursive: true });
    fs.copyFileSync(fromAbs, ogbAbs);
    fs.unlinkSync(fromAbs);
    console.log(`STAGE  ${m.from}  ->  OGB/${m.from}.txt`);
    staged++;
    results.push({ ...m, status: 'staged', ogbPath: path.relative(REPO_ROOT, ogbAbs) });
  }

  console.log('');
  console.log(`Staged this run: ${staged}`);
  console.log(`Already staged:  ${alreadyStaged}`);
  console.log(`Missing:         ${missingOriginal}`);
  console.log(`Total:           ${moves.length}`);

  fs.writeFileSync(
    path.join(__dirname, 'results.stage-originals.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), staged, alreadyStaged, missingOriginal, total: moves.length, results },
      null,
      2
    )
  );
}

main();
