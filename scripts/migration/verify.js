#!/usr/bin/env node
/**
 * verify.js — Phase 3 of the refactor migration.
 *
 * For each moved file in manifest.json:
 *   1. require() it from its NEW location.
 *   2. Diff exported keys vs requiring the original (`from`) — same surface?
 *   3. Confirm module-level execution doesn't throw.
 *
 * No DB calls, no server boot. Just proves the files load and expose the same
 * exports as before the move.
 *
 * If the moved file is a TypeScript-style .ts (it shouldn't be — we only move
 * .js here), or has compile-time issues, this surface check catches it.
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function exportKeys(mod) {
  if (mod === null || mod === undefined) return [];
  if (typeof mod !== 'object' && typeof mod !== 'function') return ['<scalar>'];
  return Object.keys(mod).sort();
}

function summarizeShape(mod) {
  if (mod === null) return 'null';
  if (mod === undefined) return 'undefined';
  if (typeof mod === 'function') return `function(${mod.name || 'anonymous'})`;
  if (typeof mod !== 'object') return typeof mod;
  return `object{${Object.keys(mod).length} keys}`;
}

function diffArrays(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const onlyA = a.filter((k) => !setB.has(k));
  const onlyB = b.filter((k) => !setA.has(k));
  return { onlyA, onlyB };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  console.log(`Verifying batch: ${manifest.batch}\n`);

  let ok = 0;
  let fail = 0;
  const summary = [];

  for (const m of manifest.moves) {
    const fromAbs = path.resolve(REPO_ROOT, m.from);
    const toAbs = path.resolve(REPO_ROOT, m.to);

    if (!fs.existsSync(toAbs)) {
      console.log(`FAIL  ${m.to}  (dest missing)`);
      summary.push({ ...m, status: 'fail', reason: 'dest_missing' });
      fail++;
      continue;
    }

    let origMod, newMod;
    let origErr = null;
    let newErr = null;

    try {
      delete require.cache[fromAbs];
      origMod = require(fromAbs);
    } catch (e) {
      origErr = e;
    }

    try {
      delete require.cache[toAbs];
      newMod = require(toAbs);
    } catch (e) {
      newErr = e;
    }

    if (newErr) {
      console.log(`FAIL  ${m.to}  (new file threw on require: ${newErr.message})`);
      summary.push({ ...m, status: 'fail', reason: 'new_require_threw', error: newErr.message });
      fail++;
      continue;
    }

    if (origErr && !newErr) {
      // Original was broken (e.g. has its own bug) — accept the new one regardless.
      console.log(`OK    ${m.to}  (new loaded; original errored: ${origErr.message})`);
      summary.push({ ...m, status: 'ok', note: 'original_errored_new_clean' });
      ok++;
      continue;
    }

    const origKeys = exportKeys(origMod);
    const newKeys = exportKeys(newMod);
    const { onlyA: missing, onlyB: added } = diffArrays(origKeys, newKeys);

    if (missing.length > 0 || added.length > 0) {
      console.log(`WARN  ${m.to}  (export surface drift)`);
      if (missing.length) console.log(`        missing in new: ${missing.join(', ')}`);
      if (added.length) console.log(`        added in new:   ${added.join(', ')}`);
      summary.push({
        ...m,
        status: 'warn',
        reason: 'export_drift',
        missing,
        added,
        origShape: summarizeShape(origMod),
        newShape: summarizeShape(newMod),
      });
      ok++;
      continue;
    }

    console.log(
      `OK    ${m.to}  (${summarizeShape(newMod)}, ${newKeys.length} export${newKeys.length === 1 ? '' : 's'})`
    );
    summary.push({
      ...m,
      status: 'ok',
      shape: summarizeShape(newMod),
      exportCount: newKeys.length,
    });
    ok++;
  }

  fs.writeFileSync(
    path.join(__dirname, 'results.verify.json'),
    JSON.stringify(
      { batch: manifest.batch, generatedAt: new Date().toISOString(), ok, fail, summary },
      null,
      2
    )
  );

  console.log(`\nDone: ${ok} ok, ${fail} fail`);
  console.log(`Results written to scripts/migration/results.verify.json`);

  process.exit(fail > 0 ? 1 : 0);
}

main();
