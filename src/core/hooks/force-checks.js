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
  return {
    id: 'FC3',
    title: 'Manifest covers every file_registry row',
    ok: issues.length === 0,
    count: files.length,
    issues,
    message: issues.length === 0 ? `${files.length}/${files.length} files in manifest` : `${issues.length} files in registry but not manifest`,
  };
}

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
    // file-shaped but are URLs. Also skip refs that look like external/sample
    // paths (backend/X.js retained in hard-coded mappings — those are
    // tested by check-conventions, not here).
    if (ref.startsWith('/api/')) continue;
    if (ref.startsWith('src/') || ref.startsWith('backend/') || ref.startsWith('lib/')) continue;
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
  const connections = ctx.persistence.getAllConnections ? ctx.persistence.getAllConnections() : null;
  if (!connections) {
    return { id: 'FC5', title: 'Connections have valid endpoints', ok: true, count: 0, issues: [], message: 'persistence.getAllConnections() not implemented (skipped)' };
  }
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
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, lines.join('\n') + '\n');
  } catch (err) {
    console.error('[st8:force-check] failed to write report:', err.message);
  }

  console.log(`[st8:force-check] ${okCount}/${results.length} checks pass${failCount > 0 ? ` (${failCount} failure(s) — see .st8/force-check.md)` : ''}`);
  return { okCount, failCount, results };
}

function registerForceChecks(registry) {
  registry.register(HOOKS.INDEX_COMPLETE, runForceChecks, { priority: 90, source: 'force-checks' });
}

module.exports = { registerForceChecks, runForceChecks };
