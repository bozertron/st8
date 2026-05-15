#!/usr/bin/env node
'use strict';

/**
 * submit-pending-tickets.js — Drain docs/_pending-tickets/*.json into the
 * SQLite tickets table.
 *
 * Run from repo root:
 *   node scripts/submit-pending-tickets.js
 *
 * What it does:
 *   1. Opens st8.sqlite via the same St8Persistence the server uses.
 *   2. Discovers st8's own source files under the repo root and upserts
 *      them into file_registry (fingerprint + sha256 + birthTimestamp +
 *      size). We need these rows so the tickets table's FK to
 *      file_registry(fingerprint) is satisfied. Existing rows are NOT
 *      overwritten — only new files are added.
 *   3. Walks every docs/_pending-tickets/<cluster>.json file, looks up
 *      the corresponding file_registry row by filepath, and inserts a
 *      ticket via persistence.createTicket().
 *   4. Reports inserted / skipped / errored counts.
 *
 * Tickets that reference filepaths not present in the registry after
 * step 2 are SKIPPED, not failed. This handles tickets that reference
 * intentionally-deleted files (e.g. retired OGB code) or paths the
 * agents may have hallucinated. The skip list is printed at the end so
 * you can spot-check.
 *
 * Safe to re-run: createTicket always INSERTs a new row, so re-running
 * would duplicate tickets. If you need to re-run, clear `tickets`
 * first with: DELETE FROM tickets WHERE identityBundle LIKE '%fact-finding%';
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const TICKETS_DIR = path.join(REPO_ROOT, 'docs', '_pending-tickets');

const { St8Persistence } = require(path.join(REPO_ROOT, 'src/core/database/persistence'));
const { generateFingerprint } = require(path.join(REPO_ROOT, 'src/shared/types/st8-types'));

// Mirror src/features/indexing/indexer.js's discovery rules so the file
// set we register matches what the indexer would register if you ran
// `node start.js .`. Keeps registry contents consistent.
const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go', '.md', '.txt', '.json', '.html', '.css']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__', '.archive', '.planning', '.st8', 'vendor', 'snapshots', 'OGB']);
const SELF_WRITTEN_BASENAMES = new Set(['connection-state.json', 'ai-signal.toml']);

function discoverFiles(targetDir) {
  const files = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile()) {
        if (SELF_WRITTEN_BASENAMES.has(entry.name)) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) files.push(full);
      }
    }
  }
  walk(targetDir);
  return files;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function main() {
  const persistence = new St8Persistence();
  await persistence.initialize();

  // ─── Stage 1: register st8 source files ──────────────────────
  console.log('Stage 1: registering st8 source files in file_registry');
  const sourceFiles = discoverFiles(REPO_ROOT);
  console.log(`  discovered ${sourceFiles.length} files`);

  const existingByPath = new Map(
    persistence.getAllFiles().map((f) => [f.filepath, f])
  );

  let registered = 0;
  let already = 0;
  for (const abs of sourceFiles) {
    const rel = path.relative(REPO_ROOT, abs);
    if (existingByPath.has(rel)) { already++; continue; }
    try {
      const stat = fs.statSync(abs);
      const birth = (stat.birthtime || stat.mtime).toISOString();
      const fingerprint = generateFingerprint(rel, birth);
      persistence.upsertFile({
        fingerprint,
        filepath: rel,
        filename: path.basename(abs),
        sha256Hash: sha256(abs),
        fileSizeBytes: stat.size,
        status: 'GREEN',
        reachabilityScore: 0,
        impactRadius: 0,
        lifecyclePhase: 'DEVELOPMENT',
        birthTimestamp: birth,
        lastModified: stat.mtime.toISOString(),
        isEntryPoint: false,
      });
      registered++;
    } catch (err) {
      console.error(`  ERROR registering ${rel}: ${err.message}`);
    }
  }
  console.log(`  registered ${registered} new (${already} already present)`);

  // Refresh the lookup table after the new upserts.
  const fpByPath = new Map(
    persistence.getAllFiles().map((f) => [f.filepath, f])
  );
  console.log(`  registry now has ${fpByPath.size} files`);

  // ─── Stage 2: submit tickets ─────────────────────────────────
  console.log('\nStage 2: submitting pending tickets to SQLite');
  const ticketFiles = fs.readdirSync(TICKETS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const skipped = [];
  const perClusterCounts = {};

  for (const tf of ticketFiles) {
    const cluster = tf.replace(/\.json$/, '');
    const raw = JSON.parse(fs.readFileSync(path.join(TICKETS_DIR, tf), 'utf8'));
    const arr = Array.isArray(raw) ? raw : (raw.tickets || []);

    let clusterInserted = 0;
    let clusterSkipped = 0;
    let clusterErrors = 0;

    for (const t of arr) {
      if (!t.filepath) {
        clusterSkipped++;
        skipped.push({ cluster, filepath: '(missing)', note: (t.userNote || '').slice(0, 80) });
        continue;
      }
      const file = fpByPath.get(t.filepath);
      if (!file) {
        clusterSkipped++;
        skipped.push({ cluster, filepath: t.filepath, note: (t.userNote || '').slice(0, 80) });
        continue;
      }
      try {
        persistence.createTicket({
          fingerprint:      file.fingerprint,
          filepath:         file.filepath,
          sha256Hash:       file.sha256Hash,
          statusAtCreation: t.status || 'YELLOW',
          userNote:         `[${cluster}/${t.severity || 'med'}] ${t.userNote || ''}`,
          identityBundle: {
            cluster,
            severity: t.severity || 'med',
            originalStatus: t.status || null,
            source: 'agent-fact-finding-wave',
          },
        });
        clusterInserted++;
      } catch (err) {
        clusterErrors++;
        console.error(`    ERROR ${cluster} ${t.filepath}: ${err.message}`);
      }
    }

    perClusterCounts[cluster] = { inserted: clusterInserted, skipped: clusterSkipped, errored: clusterErrors, total: arr.length };
    totalInserted += clusterInserted;
    totalSkipped += clusterSkipped;
    totalErrors += clusterErrors;
    console.log(`  ${cluster.padEnd(36)} inserted ${clusterInserted}/${arr.length}  (skipped ${clusterSkipped}, errored ${clusterErrors})`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Inserted into tickets table: ${totalInserted}`);
  console.log(`Skipped (filepath not in registry): ${totalSkipped}`);
  console.log(`Errored: ${totalErrors}`);
  console.log(`Total open tickets in DB now: ${persistence.countOpenTickets()}`);

  if (skipped.length > 0) {
    console.log(`\nSkipped ticket previews (first 25 of ${skipped.length}):`);
    skipped.slice(0, 25).forEach((s) => {
      console.log(`  [${s.cluster}] ${s.filepath}`);
      console.log(`      note: ${s.note}`);
    });
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
