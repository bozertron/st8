#!/usr/bin/env node
/**
 * check-invariants.js — Tier 2 signal-path tests.
 *
 * Boots the indexer against a controlled fixture target, then asserts
 * pipeline invariants on the produced artifacts (manifest + SQLite +
 * recomputed hashes).
 *
 * Run: node scripts/signal-tests/check-invariants.js [target-dir]
 *      Default target: a tiny scratch tree we create at /tmp/st8-invariant-target.
 *
 * Invariants asserted:
 *
 *   I1. Manifest exists and parses as valid JSON.
 *
 *   I2. Manifest file_registry count == count of code files actually in target.
 *       (Catches: parser drops files, glob misses extensions, status filter
 *        accidentally excludes good files.)
 *
 *   I3. Every entry has the required fields (fingerprint, filepath, filename,
 *       sha256Hash, status, lifecyclePhase, birthTimestamp).
 *
 *   I4. Every sha256Hash in the manifest matches a freshly-recomputed SHA-256
 *       of the file on disk. (Catches: hashing bug, off-by-one, stale entry.)
 *
 *   I5. Status counts (GREEN + YELLOW + RED) == total file count. No files
 *       leak out of the status enum. (Catches: nullable status field, typo'd
 *       enum value, race in the status writer.)
 *
 *   I6. Rerunning the indexer produces a manifest with the same fingerprints
 *       and same SHA-256s. (Catches: non-deterministic hashing, timestamp
 *       contamination of fingerprint, race conditions during indexing.)
 *
 *   I7. All filepaths in manifest are RELATIVE (not absolute paths leaking
 *       through). (Catches: __dirname / cwd contamination, path serialization
 *       bug.)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_TARGET = '/tmp/st8-invariant-target';

const COLOR = { ok: '\x1b[32m', warn: '\x1b[33m', fail: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' };

function log(level, msg) {
  const colorCode = COLOR[level] || '';
  console.log(`${colorCode}${level.toUpperCase().padEnd(4)}${COLOR.reset}  ${msg}`);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listCodeFiles(dir) {
  // Match the indexer's glob: .js, .ts, .vue, .py, .rs, .json — keep it simple.
  const exts = ['.js', '.ts', '.tsx', '.vue', '.py', '.rs', '.json', '.md'];
  const out = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && exts.includes(path.extname(e.name))) out.push(full);
    }
  }
  walk(dir);
  return out;
}

function makeFixtureTarget(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'alpha.js'), "module.exports = function alpha() { return 1; }\n");
  fs.writeFileSync(path.join(dir, 'beta.js'), "const { alpha } = require('./alpha');\nmodule.exports = function beta() { return alpha() + 2; }\n");
  fs.writeFileSync(path.join(dir, 'gamma.js'), "const { beta } = require('./beta');\nmodule.exports = function gamma() { return beta() * 3; }\n");
}

function runIndexer(target) {
  // Use the migrated main.js entry point. We let it run a full indexing pass
  // (no --serve so it exits after producing the manifest).
  const main = path.join(REPO_ROOT, 'src', 'core', 'server', 'main.js');
  execFileSync('node', [main, target], {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  });
}

function readManifest(target) {
  const manifestPath = path.join(target, 'connection-state.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not produced at ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

// ─── INVARIANT CHECKS ────────────────────────────────────────────

function checkI1_ManifestValid(target) {
  const manifestPath = path.join(target, 'connection-state.json');
  if (!fs.existsSync(manifestPath)) return { ok: false, detail: 'manifest not produced' };
  try {
    JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: 'manifest is invalid JSON: ' + e.message };
  }
}

function checkI2_FileCount(manifest, target) {
  const filesInTarget = listCodeFiles(target).filter((p) => path.basename(p) !== 'connection-state.json' && path.basename(p) !== 'ai-signal.toml');
  const entriesInManifest = manifest.files ? manifest.files.length : 0;
  if (entriesInManifest === filesInTarget.length) return { ok: true, detail: `${entriesInManifest} files` };
  return {
    ok: false,
    detail: `Indexer found ${entriesInManifest}, but ${filesInTarget.length} code files exist on disk`,
    extra: { onDisk: filesInTarget.map((p) => path.relative(target, p)) },
  };
}

function checkI3_RequiredFields(manifest) {
  const required = ['fingerprint', 'filepath', 'filename', 'sha256Hash', 'status', 'lifecyclePhase', 'birthTimestamp'];
  const files = manifest.files || [];
  const missing = [];
  for (const f of files) {
    const fileMissing = required.filter((k) => !(k in f) || f[k] === null || f[k] === undefined);
    if (fileMissing.length > 0) missing.push({ filepath: f.filepath, missing: fileMissing });
  }
  if (missing.length === 0) return { ok: true, detail: `${files.length} files, all required fields present` };
  return { ok: false, detail: `${missing.length} files missing required fields`, extra: missing.slice(0, 5) };
}

function checkI4_HashesMatch(manifest, target) {
  const files = manifest.files || [];
  const mismatches = [];
  for (const f of files) {
    const abs = path.join(target, f.filepath);
    if (!fs.existsSync(abs)) {
      mismatches.push({ filepath: f.filepath, reason: 'file does not exist on disk' });
      continue;
    }
    const actualHash = sha256(abs);
    if (actualHash !== f.sha256Hash) {
      mismatches.push({ filepath: f.filepath, recorded: f.sha256Hash.slice(0, 12), actual: actualHash.slice(0, 12) });
    }
  }
  if (mismatches.length === 0) return { ok: true, detail: `${files.length} hashes verified` };
  return { ok: false, detail: `${mismatches.length} hash mismatch(es)`, extra: mismatches.slice(0, 5) };
}

function checkI5_StatusCovers(manifest) {
  const files = manifest.files || [];
  const validStatuses = new Set(['GREEN', 'YELLOW', 'RED']);
  const counts = { GREEN: 0, YELLOW: 0, RED: 0, OTHER: 0 };
  const offenders = [];
  for (const f of files) {
    if (validStatuses.has(f.status)) counts[f.status]++;
    else {
      counts.OTHER++;
      offenders.push({ filepath: f.filepath, status: f.status });
    }
  }
  const sum = counts.GREEN + counts.YELLOW + counts.RED;
  if (sum === files.length && counts.OTHER === 0) {
    return { ok: true, detail: `GREEN ${counts.GREEN}, YELLOW ${counts.YELLOW}, RED ${counts.RED} (sum = ${files.length})` };
  }
  return {
    ok: false,
    detail: `Status sum ${sum} ≠ file count ${files.length} (OTHER: ${counts.OTHER})`,
    extra: offenders.slice(0, 5),
  };
}

function checkI6_Idempotent(target) {
  // Capture fingerprints from first run (already done by caller), rerun, compare.
  const manifest1 = readManifest(target);
  const fps1 = new Map((manifest1.files || []).map((f) => [f.filepath, { fingerprint: f.fingerprint, sha256Hash: f.sha256Hash }]));
  runIndexer(target);
  const manifest2 = readManifest(target);
  const fps2 = new Map((manifest2.files || []).map((f) => [f.filepath, { fingerprint: f.fingerprint, sha256Hash: f.sha256Hash }]));

  if (fps1.size !== fps2.size) {
    return { ok: false, detail: `File count drift: ${fps1.size} -> ${fps2.size}` };
  }
  const diffs = [];
  for (const [fp, v1] of fps1.entries()) {
    const v2 = fps2.get(fp);
    if (!v2) {
      diffs.push({ filepath: fp, reason: 'missing after rerun' });
    } else {
      if (v1.fingerprint !== v2.fingerprint) diffs.push({ filepath: fp, fingerprint: { before: v1.fingerprint, after: v2.fingerprint } });
      if (v1.sha256Hash !== v2.sha256Hash) diffs.push({ filepath: fp, sha256: { before: v1.sha256Hash.slice(0, 12), after: v2.sha256Hash.slice(0, 12) } });
    }
  }
  if (diffs.length === 0) return { ok: true, detail: `${fps1.size} files identical across two runs` };
  return { ok: false, detail: `${diffs.length} field(s) drifted between runs`, extra: diffs.slice(0, 5) };
}

function checkI7_RelativePaths(manifest) {
  const files = manifest.files || [];
  const absolute = files.filter((f) => path.isAbsolute(f.filepath));
  if (absolute.length === 0) return { ok: true, detail: `${files.length} paths, all relative` };
  return {
    ok: false,
    detail: `${absolute.length} entries with absolute paths`,
    extra: absolute.slice(0, 5).map((f) => f.filepath),
  };
}

// ─── DRIVER ──────────────────────────────────────────────────────

function run() {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_TARGET;
  const usingFixture = target === DEFAULT_TARGET;

  if (usingFixture) {
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    makeFixtureTarget(target);
    log('dim', `Created fixture target at ${target}`);
  } else {
    log('dim', `Using user-provided target: ${target}`);
  }

  log('dim', 'Running indexer (first pass)...');
  try {
    runIndexer(target);
  } catch (e) {
    log('fail', 'Indexer failed to run: ' + e.message.split('\n')[0]);
    process.exit(1);
  }

  const manifest = readManifest(target);

  const checks = [
    ['I1 Manifest valid JSON', () => checkI1_ManifestValid(target)],
    ['I2 File count = on-disk count', () => checkI2_FileCount(manifest, target)],
    ['I3 Required fields present', () => checkI3_RequiredFields(manifest)],
    ['I4 SHA-256 hashes match disk', () => checkI4_HashesMatch(manifest, target)],
    ['I5 Status enum covers all files', () => checkI5_StatusCovers(manifest)],
    ['I6 Idempotent across 2 runs', () => checkI6_Idempotent(target)],
    ['I7 Filepaths are relative', () => checkI7_RelativePaths(manifest)],
  ];

  const results = [];
  let okCount = 0;
  for (const [name, fn] of checks) {
    let r;
    try {
      r = fn();
    } catch (e) {
      r = { ok: false, detail: 'check threw: ' + e.message };
    }
    results.push({ name, ...r });
    if (r.ok) {
      log('ok', `${name}  -  ${r.detail || ''}`);
      okCount++;
    } else {
      log('fail', `${name}  -  ${r.detail}`);
      if (r.extra) console.log(`        ${COLOR.dim}extra: ${JSON.stringify(r.extra)}${COLOR.reset}`);
    }
  }

  console.log('');
  log('dim', `${okCount}/${checks.length} invariants pass`);

  fs.writeFileSync(
    path.join(__dirname, 'results.invariants.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), target, results }, null, 2)
  );

  process.exit(okCount === checks.length ? 0 : 1);
}

run();
