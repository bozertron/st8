'use strict';

/**
 * force-checks.js — Cross-tool integrity verification.
 *
 * Registers a single high-priority subscriber on INDEX_COMPLETE (P=90,
 * after the existing 4 subscribers at P=10..40) that runs cross-tool
 * sanity checks and writes a report to `.st8/force-check.md`.
 *
 * Pre-existing baseline: gap-analyzer.js read the schema cards that
 * emitter.js wrote — the only "one tool verifies another" relationship
 * in the project. This module is the second.
 *
 * Checks performed:
 *
 *   FC1. For every file in persistence.getAllFiles(), a schema card file
 *        exists at .st8/schema-cards/<safe-name>.json. (Catches emitter
 *        silently skipping files.)
 *
 *   FC2. For every schema card on disk, a matching file_registry row
 *        exists. (Catches stale cards left over after a file was deleted
 *        but the .st8/ wasn't cleaned.)
 *
 *   FC3. The manifest written by manifest-generator (connection-state.json)
 *        contains every fingerprint in persistence.getAllFiles().
 *        (Catches manifest serialization skips.)
 *
 *   FC4. The gap-analysis.md file mentions only filepaths that exist in
 *        file_registry. (Catches gap-analyzer referencing stale paths.)
 *
 *   FC5. Every connection's source AND target fingerprint exists as a row
 *        in file_registry. (Catches dangling edges in the graph.)
 *
 *   FC6. Every fingerprint in file_registry follows the format
 *        `<filepath>||<ISO-timestamp>`. (Catches malformed identity.)
 *
 * Each check returns { ok, count, issues, message }. The report file is
 * machine-readable on top + human-readable below. The hook does NOT
 * throw — even if multiple checks fail, subscribers further down the
 * priority chain still run.
 *
 * To opt out: don't call registerForceChecks() in main.js.
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { HOOKS } = require('../hook-registry');

// ─── Individual checks ───────────────────────────────────────────

function checkFC1_filesHaveCards(ctx) {
  const files = ctx.persistence.getAllFiles();
  const cardsDir = path.join(ctx.targetDir, '.st8', 'schema-cards');
  const issues = [];
  for (const f of files) {
    const safe = f.filepath.replace(/[\/\\]/g, '_');
    const cardPath = path.join(cardsDir, safe + '.json');
    if (!fs.existsSync(cardPath)) issues.push({ filepath: f.filepath, expected: cardPath });
  }
  return {
    id: 'FC1',
    title: 'Every file_registry row has a schema card',
    ok: issues.length === 0,
    count: files.length,
    issues,
    message: issues.length === 0 ? `${files.length}/${files.length} files have cards` : `${issues.length}/${files.length} files missing cards`,
  };
}

function checkFC2_cardsHaveFiles(ctx) {
  const cardsDir = path.join(ctx.targetDir, '.st8', 'schema-cards');
  if (!fs.existsSync(cardsDir)) {
    return { id: 'FC2', title: 'Every schema card has a file_registry row', ok: true, count: 0, issues: [], message: 'no cards dir (skipped)' };
  }
  const cards = fs.readdirSync(cardsDir).filter((n) => n.endsWith('.json'));
  const files = ctx.persistence.getAllFiles();
  const fingerprints = new Set(files.map((f) => f.filepath.replace(/[\/\\]/g, '_') + '.json'));
  const issues = [];
  for (const c of cards) {
    if (!fingerprints.has(c)) issues.push({ card: c, reason: 'no matching file_registry row' });
  }
  return {
    id: 'FC2',
    title: 'Every schema card has a file_registry row',
    ok: issues.length === 0,
    count: cards.length,
    issues,
    message: issues.length === 0 ? `${cards.length}/${cards.length} cards backed by registry` : `${issues.length} orphan card(s)`,
  };
}

function checkFC3_manifestCoversFiles(ctx) {
  const manifestPath = path.join(ctx.targetDir, 'connection-state.json');
  if (!fs.existsSync(manifestPath)) {
    return { id: 'FC3', title: 'Manifest covers every file_registry row', ok: false, count: 0, issues: [{ reason: 'manifest not produced' }], message: 'manifest missing' };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifestFingerprints = new Set((manifest.files || []).map((f) => f.fingerprint));
  const files = ctx.persistence.getAllFiles();
  const issues = [];
  for (const f of files) {
    if (!manifestFingerprints.has(f.fingerprint)) issues.push({ filepath: f.filepath, fingerprint: f.fingerprint });
  }
  // Ticket 17: classify the failure mode. If file_registry has multiple
  // rows per filepath, the manifest (per-run, latest-only) cannot cover
  // them all — that's the cross-run accumulation signature batch 025
  // surfaced and batch 026 fixed via persistence.pruneFilesNotIn(). If
  // we ever see this signature again, the link back to the cleanup
  // mechanism should be obvious in the report.
  let staleAccumulationDetected = false;
  if (issues.length > 0) {
    const filepathCounts = new Map();
    for (const f of files) {
      filepathCounts.set(f.filepath, (filepathCounts.get(f.filepath) || 0) + 1);
    }
    for (const issue of issues) {
      if (filepathCounts.get(issue.filepath) > 1) {
        staleAccumulationDetected = true;
        break;
      }
    }
  }
  let message;
  if (issues.length === 0) {
    message = `${files.length}/${files.length} files in manifest`;
  } else if (staleAccumulationDetected) {
    message = `${issues.length} files in registry but not manifest — STALE ACCUMULATION DETECTED (multiple fingerprints per filepath). The Pass-0 prune in main.js (persistence.pruneFilesNotIn) should have removed these; verify it ran.`;
  } else {
    message = `${issues.length} files in registry but not manifest — check manifest-generator output coverage`;
  }
  return {
    id: 'FC3',
    title: 'Manifest covers every file_registry row',
    ok: issues.length === 0,
    count: files.length,
    issues,
    message,
    staleAccumulationDetected,
  };
}

// Ticket 4: Explicit allowlist of refs the gap-analyzer hard-codes as
// architectural endpoint→module mappings. These look filepath-shaped
// when surfaced in `.st8/gap-analysis.md` but aren't expected to live in
// file_registry as user-authored files — they're "known intentional
// mentions" that FC4 should ignore.
//
// Previously FC4 used a coarse prefix-skip on `src/`, `backend/`, `lib/`,
// `/api/`. The prefix-skip swallowed real broken `src/...` refs along
// with the intended cross-tree refs (a false-negative generator —
// ticket 4 raised this exact trade-off).
//
// The allowlist is mirrored from
// src/features/analysis/gap-analyzer.js#_analyzeArchitecture's
// `endpointModuleMap`. If that map changes, this list should be updated
// in lockstep — ideally by exporting the map from gap-analyzer and
// importing it here, but that requires a cross-module API which is out
// of scope for this ticket. For now the duplication is documented.
//
// Also kept: `/api/...` URL-shape skip (these aren't filepaths at all
// and would never appear in file_registry by design).
const FC4_KNOWN_ARCH_REFS = new Set([
  // Endpoint-handler modules from gap-analyzer's endpointModuleMap.
  'src/features/indexing/indexer.js',
  'src/core/database/persistence.js',
  'src/features/prd/generator.js',
  'src/features/analysis/gap-analyzer.js',
  // Architectural component refs the gap-analyzer also mentions explicitly.
  'src/core/notification-bus.js',
  'src/features/watcher/file-watcher.js',
  'src/features/schema-cards/emitter.js',
]);

function checkFC4_gapReportRefsExist(ctx) {
  const gapPath = path.join(ctx.targetDir, '.st8', 'gap-analysis.md');
  if (!fs.existsSync(gapPath)) {
    return { id: 'FC4', title: 'Gap report refs all exist in file_registry', ok: true, count: 0, issues: [], message: 'gap report not produced (skipped)' };
  }
  const text = fs.readFileSync(gapPath, 'utf8');
  const files = ctx.persistence.getAllFiles();
  const known = new Set(files.map((f) => f.filepath));
  // Find filepath-like backtick refs in the gap report.
  const matches = text.match(/`[a-zA-Z0-9_\-\/\.]+\.(js|ts|css|html|json|md|toml)`/g) || [];
  const referenced = new Set(matches.map((m) => m.slice(1, -1)));
  const issues = [];
  for (const ref of referenced) {
    // Skip API endpoint refs (like /api/connection-state.json) — those look
    // file-shaped but are URLs, never present in file_registry.
    if (ref.startsWith('/api/')) continue;
    // Skip refs in the architectural allowlist — known intentional mentions
    // from gap-analyzer's hardcoded endpointModuleMap. These may or may
    // not be in file_registry (e.g. when the target project is itself st8,
    // they are; when target is a different project, they aren't), and
    // either way they are NOT signals of gap-analyzer drift.
    if (FC4_KNOWN_ARCH_REFS.has(ref)) continue;
    if (!known.has(ref)) issues.push({ ref });
  }
  return {
    id: 'FC4',
    title: 'Gap report refs exist in file_registry',
    ok: issues.length === 0,
    count: referenced.size,
    issues,
    message: issues.length === 0 ? `${referenced.size} refs all known` : `${issues.length} unknown refs in gap report`,
  };
}

function checkFC5_connectionsResolve(ctx) {
  // Ticket 18: missing getAllConnections used to return ok:true with
  // a 'skipped' message — a silent-pass cheat. Now that persistence
  // implements getAllConnections, the legitimate path is always taken
  // for the real persistence. If the method is missing (a custom test
  // double or stripped-down persistence), FAIL the check so the gap
  // is visible — not silently green.
  if (typeof ctx.persistence.getAllConnections !== 'function') {
    return {
      id: 'FC5',
      title: 'Connections have valid endpoints',
      ok: false,
      count: 0,
      issues: [{ reason: 'persistence.getAllConnections() not implemented — cannot verify connection endpoints' }],
      message: 'persistence.getAllConnections() not implemented (FAIL — was silent-pass before ticket 18)',
    };
  }
  const connections = ctx.persistence.getAllConnections();
  const files = ctx.persistence.getAllFiles();
  const known = new Set(files.map((f) => f.fingerprint));
  const issues = [];
  for (const c of connections) {
    if (!known.has(c.sourceFingerprint)) issues.push({ source: c.sourceFingerprint, target: c.targetFingerprint, reason: 'source missing' });
    if (!known.has(c.targetFingerprint)) issues.push({ source: c.sourceFingerprint, target: c.targetFingerprint, reason: 'target missing' });
  }
  return {
    id: 'FC5',
    title: 'Connections have valid endpoints',
    ok: issues.length === 0,
    count: connections.length,
    issues,
    message: issues.length === 0 ? `${connections.length} connections all resolved` : `${issues.length} dangling endpoint(s)`,
  };
}

function checkFC6_fingerprintFormat(ctx) {
  const files = ctx.persistence.getAllFiles();
  const pat = /^[^\|]+\|\|.+/;
  const issues = [];
  for (const f of files) {
    if (typeof f.fingerprint !== 'string' || !pat.test(f.fingerprint)) {
      issues.push({ filepath: f.filepath, fingerprint: f.fingerprint });
    }
  }
  return {
    id: 'FC6',
    title: 'Fingerprints follow <filepath>||<timestamp> format',
    ok: issues.length === 0,
    count: files.length,
    issues,
    message: issues.length === 0 ? `${files.length}/${files.length} well-formed` : `${issues.length} malformed`,
  };
}

// ─── Driver ──────────────────────────────────────────────────────

async function runForceChecks(ctx) {
  const checks = [
    checkFC1_filesHaveCards,
    checkFC2_cardsHaveFiles,
    checkFC3_manifestCoversFiles,
    checkFC4_gapReportRefsExist,
    checkFC5_connectionsResolve,
    checkFC6_fingerprintFormat,
  ];

  const results = [];
  for (const fn of checks) {
    try {
      results.push(fn(ctx));
    } catch (err) {
      results.push({ id: fn.name, title: fn.name, ok: false, count: 0, issues: [{ reason: 'check threw: ' + err.message }], message: 'check failed to run' });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  // Render report
  const lines = [];
  lines.push('# Force-Check Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Target:    ${ctx.targetDir}`);
  lines.push('');
  lines.push(`**Result: ${okCount}/${results.length} checks pass**`);
  lines.push('');
  lines.push('| Check | Status | Detail |');
  lines.push('|-------|--------|--------|');
  for (const r of results) {
    const status = r.ok ? '✅ ok' : '❌ fail';
    lines.push(`| **${r.id}** ${r.title} | ${status} | ${r.message} |`);
  }
  lines.push('');
  // Per-check failure details
  for (const r of results) {
    if (r.ok || r.issues.length === 0) continue;
    lines.push(`## ${r.id} — ${r.title}`);
    lines.push('');
    for (const iss of r.issues.slice(0, 20)) {
      lines.push(`- ${JSON.stringify(iss)}`);
    }
    if (r.issues.length > 20) lines.push(`- ...and ${r.issues.length - 20} more`);
    lines.push('');
  }

  const reportPath = path.join(ctx.targetDir, '.st8', 'force-check.md');
  try {
    // Async write — runs inside an async INDEX_COMPLETE handler, so we avoid
    // blocking the event loop on a large report. Ticket 19.
    await fsp.mkdir(path.dirname(reportPath), { recursive: true });
    await fsp.writeFile(reportPath, lines.join('\n') + '\n');
  } catch (err) {
    console.error('[st8:force-check] failed to write report:', err.message);
  }

  console.log(`[st8:force-check] ${okCount}/${results.length} checks pass${failCount > 0 ? ` (${failCount} failure(s) — see .st8/force-check.md)` : ''}`);
  return { okCount, failCount, results };
}

function registerForceChecks(registry) {
  registry.register(HOOKS.INDEX_COMPLETE, runForceChecks, { priority: 90, source: 'force-checks' });
}

module.exports = {
  registerForceChecks,
  runForceChecks,
  // Exported for unit testing (ticket 3) — each check is a pure function of
  // `ctx`, so probes can construct synthetic ctx objects without touching
  // a real persistence DB or filesystem (except for FC1/FC2/FC3/FC4 which
  // read the .st8/ directory and connection-state.json under ctx.targetDir).
  checkFC1_filesHaveCards,
  checkFC2_cardsHaveFiles,
  checkFC3_manifestCoversFiles,
  checkFC4_gapReportRefsExist,
  checkFC5_connectionsResolve,
  checkFC6_fingerprintFormat,
  FC4_KNOWN_ARCH_REFS,
};
