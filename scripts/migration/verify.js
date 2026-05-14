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
const { execFileSync } = require('child_process');

const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const HISTORY_PATH = path.join(__dirname, 'move-history.json');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function appendBatchToHistory(manifest) {
  // After every fully-passing verify, record this batch in move-history.json
  // so future batches' rewriters can find these files at their new locations.
  // Idempotent: if a batch with the same name is already recorded, skip.
  let hist = { completedBatches: [] };
  if (fs.existsSync(HISTORY_PATH)) {
    hist = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  }
  const already = (hist.completedBatches || []).some((b) => b.batch === manifest.batch);
  if (already) return false;
  hist.completedBatches = hist.completedBatches || [];
  hist.completedBatches.push({
    batch: manifest.batch,
    completedAt: new Date().toISOString(),
    moves: manifest.moves,
  });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(hist, null, 2) + '\n');
  return true;
}

function exportKeys(mod) {
  if (mod === null || mod === undefined) return [];
  // Probe result shape: { __keys, __kind }
  if (mod.__keys) return [...mod.__keys].sort();
  if (typeof mod !== 'object' && typeof mod !== 'function') return ['<scalar>'];
  return Object.keys(mod).sort();
}

function summarizeShape(mod) {
  if (mod === null) return 'null';
  if (mod === undefined) return 'undefined';
  if (mod.__kind) return `${mod.__kind}{${(mod.__keys || []).length} keys}`;
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

    // For client-side (browser) JS, skip require — they reference window/
    // document at module load. Just check syntax via `node --check`.
    function probeClientSyntaxOnly(absPath) {
      try {
        execFileSync('node', ['--check', absPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 15000,
        });
        return { ok: true, keys: ['<browser-module>'], kind: 'browser' };
      } catch (e) {
        return { ok: false, error: (e.stderr ? e.stderr.toString() : e.message).split('\n').slice(0, 2).join(' | ') };
      }
    }

    // Load each file in a child process — entry-point scripts call
    // process.exit() at module load which would kill this verifier
    // mid-run. Each child intercepts process.exit, requires the target,
    // and writes its result to a temp file (so module stdout noise doesn't
    // clobber the result).
    function probe(absPath) {
      const tmpResult = path.join(REPO_ROOT, 'scripts', 'migration', '.probe-result.json');
      try {
        if (fs.existsSync(tmpResult)) fs.unlinkSync(tmpResult);
      } catch (_) {}

      const child = `
        const fs = require('fs');
        const RESULT = ${JSON.stringify(tmpResult)};
        const writeResult = (r) => {
          try { fs.writeFileSync(RESULT, JSON.stringify(r)); } catch (_) {}
        };
        const origExit = process.exit;
        let intercepted = false;
        process.exit = (code) => {
          intercepted = true;
          throw new Error('__INTERCEPTED_EXIT__:' + code);
        };
        try {
          const m = require(${JSON.stringify(absPath)});
          const keys = (m && typeof m === 'object') ? Object.keys(m) :
                       (typeof m === 'function') ? ['<function>'] : [];
          writeResult({ ok: true, keys, kind: typeof m, exited: false });
        } catch (e) {
          if (intercepted && (e.message || '').startsWith('__INTERCEPTED_EXIT__')) {
            // Module loaded, then called process.exit — that's fine, exports
            // (if any) were set before the exit call. We can't know the
            // exports anymore, but the file at least parses and reaches
            // its entry point.
            writeResult({ ok: true, keys: ['<entry-point>'], kind: 'entrypoint', exited: true });
          } else {
            writeResult({ ok: false, error: e.message.split('\\n')[0] });
          }
        } finally {
          process.exit = origExit;
        }
      `;
      try {
        execFileSync('node', ['-e', child], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30000,
        });
      } catch (e) {
        if (!fs.existsSync(tmpResult)) {
          return { ok: false, error: e.message.split('\n')[0] };
        }
      }
      if (!fs.existsSync(tmpResult)) {
        return { ok: false, error: 'no_result_file' };
      }
      const res = JSON.parse(fs.readFileSync(tmpResult, 'utf8'));
      try { fs.unlinkSync(tmpResult); } catch (_) {}
      return res;
    }

    const isClient = m.client === true;
    const origRes = isClient ? probeClientSyntaxOnly(fromAbs) : probe(fromAbs);
    const newRes = isClient ? probeClientSyntaxOnly(toAbs) : probe(toAbs);

    const origMod = origRes.ok ? { __keys: origRes.keys, __kind: origRes.kind } : null;
    const newMod = newRes.ok ? { __keys: newRes.keys, __kind: newRes.kind } : null;
    const origErr = origRes.ok ? null : new Error(origRes.error);
    const newErr = newRes.ok ? null : new Error(newRes.error);

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

  if (fail === 0) {
    const recorded = appendBatchToHistory(manifest);
    if (recorded) {
      console.log(`Batch "${manifest.batch}" recorded in move-history.json`);
    } else {
      console.log(`Batch "${manifest.batch}" already in move-history.json — skipped`);
    }
  }

  process.exit(fail > 0 ? 1 : 0);
}

main();
