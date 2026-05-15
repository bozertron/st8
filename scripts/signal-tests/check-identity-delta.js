#!/usr/bin/env node
/**
 * check-identity-delta.js — Tier 6 signal-path test.
 *
 * For each historical schema card in st8_json/schema-cards/, find the file's
 * current location (using move-history.json if it was migrated, OGB/ if it
 * was retired), run a fresh AST extraction, and diff the exports + imports
 * against the saved card.
 *
 * The point: schema cards captured file IDENTITY before the refactor.
 * If a file's external surface (export names + import sources/specifiers)
 * differs today, that's drift worth examining.
 *
 * Expected drift (documented):
 *   - persistence.js: LIB_DIR retargeted (batch 002)
 *   - manifest-generator.js: LIB_DIR retargeted (batch 004 + 007)
 *   - indexer.js: 4 lazy-loaders retargeted (batch 009)
 *   - main.js (was index.js): 2 inline dynamic loads patched (batch 010)
 *   - emitter.js (was schemaCardEmitter.js): 1 dynamic load patched (batch 004)
 *   - gap-analyzer.js: hardcoded backend/* paths updated (batch 021)
 *   - prd/generator.js: doc-comment header updated (batch 021)
 *
 * Anything BEYOND that documented drift is a signal worth flagging.
 *
 * Run: node scripts/signal-tests/check-identity-delta.js
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CARDS_DIR = path.join(REPO_ROOT, 'st8_json', 'schema-cards');
const HISTORY_PATH = path.join(REPO_ROOT, 'scripts', 'migration', 'move-history.json');

const { extractImportsAndExports } = require(path.join(REPO_ROOT, 'src', 'shared', 'utils', 'ast-parser.js'));

// Known-and-documented drifts; flagged but not failed.
const DOCUMENTED_DRIFT = new Set([
  'src/core/database/persistence.js',
  'src/features/schema-cards/manifest-generator.js',
  'src/features/indexing/indexer.js',
  'src/core/server/main.js',                // was backend/index.js
  'src/core/server/app.js',                 // was backend/server.js — many call-site rewrites
  'src/features/schema-cards/emitter.js',
  'src/features/analysis/gap-analyzer.js',
  'src/features/prd/generator.js',
]);

function buildHistoryMap() {
  // Returns map of OLD_path -> NEW_path for every move recorded.
  const map = new Map();
  if (!fs.existsSync(HISTORY_PATH)) return map;
  const hist = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  for (const batch of hist.completedBatches || []) {
    for (const m of batch.moves || []) map.set(m.from, m.to);
  }
  return map;
}

function normalize(name) {
  return name.replace(/.*\//, '').replace(/\.js$/, '').replace(/[-_]/g, '').toLowerCase();
}

function buildRenameMap(historyMap) {
  // Maps normalized(old basename) -> normalized(new basename) for any file
  // whose basename actually changed during the refactor (not just relocated).
  // Example: databasePersister.js -> graph-persister.js
  //          db basename "databasepersister" -> "graphpersister"
  const renames = new Map();
  for (const [oldPath, newPath] of historyMap.entries()) {
    const oldBase = normalize(oldPath);
    const newBase = normalize(newPath);
    if (oldBase !== newBase) renames.set(oldBase, newBase);
  }
  return renames;
}

function cardFilenameToOldPath(cardFilename) {
  // Cards are named like "backend_persistence.js.json" -> "backend/persistence.js"
  // The transformation is: replace _ with / for everything except the last segment.
  // We just trim .json, then replace _ with /.
  const trimmed = cardFilename.replace(/\.json$/, '');
  return trimmed.replace(/_/g, '/');
}

function compareSurfaces(oldCard, newAst, renameMap) {
  // Returns { exportsMatch, importsMatch, exportDiff, importDiff }
  const oldExportNames = new Set((oldCard.exports || []).map((e) => e.name).filter(Boolean));
  const newExportNames = new Set((newAst.exports || []).map((e) => e.name || e.specifier || '').filter(Boolean));

  const exportsAdded = [...newExportNames].filter((n) => !oldExportNames.has(n));
  const exportsRemoved = [...oldExportNames].filter((n) => !newExportNames.has(n));

  // Tolerant import-key: strips separators + applies the rename map so the
  // OLD card's "databasePersister" matches the NEW file's "graph-persister".
  function importKey(imp) {
    let src = normalize(imp.source || '');
    if (renameMap.has(src)) src = renameMap.get(src);
    const specs = (imp.specifiers || []).map((s) => (typeof s === 'string' ? s : (s.local || s.imported || s.name || ''))).sort().join(',');
    return `${src}::${specs}`;
  }
  const oldImportKeys = new Set((oldCard.imports || []).map(importKey));
  const newImportKeys = new Set((newAst.imports || []).map(importKey));

  const importsAdded = [...newImportKeys].filter((k) => !oldImportKeys.has(k));
  const importsRemoved = [...oldImportKeys].filter((k) => !newImportKeys.has(k));

  return {
    exportsMatch: exportsAdded.length === 0 && exportsRemoved.length === 0,
    importsMatch: importsAdded.length === 0 && importsRemoved.length === 0,
    exportsAdded,
    exportsRemoved,
    importsAdded,
    importsRemoved,
  };
}

function main() {
  const historyMap = buildHistoryMap();
  const renameMap = buildRenameMap(historyMap);
  const cardFiles = fs.readdirSync(CARDS_DIR).filter((n) => n.endsWith('.json')).sort();

  console.log(`Comparing ${cardFiles.length} schema cards against current file state...\n`);

  const buckets = { match: [], doc_drift: [], drift: [], missing: [], failed: [] };

  for (const cardFile of cardFiles) {
    const oldPath = cardFilenameToOldPath(cardFile);
    const newPath = historyMap.get(oldPath);
    let inspectPath;

    if (newPath) {
      inspectPath = path.join(REPO_ROOT, newPath);
    } else {
      // Maybe the card represents a file that wasn't moved (e.g. removed —
      // sonicClient, multiPassAnalyzer — or root-only).
      inspectPath = path.join(REPO_ROOT, oldPath);
    }

    if (!fs.existsSync(inspectPath)) {
      buckets.missing.push({ card: cardFile, oldPath, expected: newPath || oldPath });
      continue;
    }

    const oldCard = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, cardFile), 'utf8'));
    let newAst;
    try {
      newAst = extractImportsAndExports(inspectPath);
    } catch (e) {
      buckets.failed.push({ card: cardFile, path: newPath || oldPath, error: e.message.split('\n')[0] });
      continue;
    }

    const diff = compareSurfaces(oldCard, newAst, renameMap);
    const currentPath = newPath || oldPath;
    const isDocumented = DOCUMENTED_DRIFT.has(currentPath);
    const entry = { card: cardFile, oldPath, currentPath, ...diff };

    if (diff.exportsMatch && diff.importsMatch) {
      buckets.match.push(entry);
    } else if (isDocumented) {
      buckets.doc_drift.push(entry);
    } else {
      buckets.drift.push(entry);
    }
  }

  // ── Report ───────────────────────────────────────────────────
  const lines = [];
  lines.push('# Tier 6 — Schema Card Identity Delta');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Cards inspected: ${cardFiles.length}`);
  lines.push('');
  lines.push('| Bucket | Count | Meaning |');
  lines.push('|---|---|---|');
  lines.push(`| MATCH (identity preserved) | ${buckets.match.length} | exports + imports identical to pre-refactor card |`);
  lines.push(`| DOCUMENTED DRIFT | ${buckets.doc_drift.length} | identity changed, but the change was an intentional batch-X patch |`);
  lines.push(`| UNDOCUMENTED DRIFT | ${buckets.drift.length} | **investigate** — surface differs and isn't on the documented list |`);
  lines.push(`| MISSING ON DISK | ${buckets.missing.length} | card exists but no file at expected path (probably retired to OGB / removed) |`);
  lines.push(`| FAILED TO PARSE | ${buckets.failed.length} | the AST extractor threw on the new file |`);
  lines.push('');
  lines.push('---');

  for (const [bucket, label] of [
    ['drift', 'UNDOCUMENTED DRIFT (investigate)'],
    ['doc_drift', 'DOCUMENTED DRIFT'],
    ['missing', 'MISSING ON DISK'],
    ['failed', 'FAILED TO PARSE'],
    ['match', 'MATCH'],
  ]) {
    const items = buckets[bucket];
    lines.push('');
    lines.push(`## ${label} — ${items.length}`);
    lines.push('');
    if (items.length === 0) { lines.push('_None._'); continue; }
    for (const it of items) {
      if (bucket === 'match') {
        lines.push(`- \`${it.currentPath}\``);
        continue;
      }
      if (bucket === 'missing') {
        lines.push(`- \`${it.expected}\`  (card was \`${it.card}\`)`);
        continue;
      }
      if (bucket === 'failed') {
        lines.push(`- \`${it.path}\`  -  ${it.error}`);
        continue;
      }
      // drift / doc_drift
      lines.push(`- \`${it.currentPath}\``);
      if (it.exportsAdded.length) lines.push(`    - exports +: ${it.exportsAdded.join(', ')}`);
      if (it.exportsRemoved.length) lines.push(`    - exports -: ${it.exportsRemoved.join(', ')}`);
      if (it.importsAdded.length) lines.push(`    - imports +: ${it.importsAdded.slice(0, 5).join('; ') || '0'}`);
      if (it.importsRemoved.length) lines.push(`    - imports -: ${it.importsRemoved.slice(0, 5).join('; ') || '0'}`);
    }
  }

  const reportPath = path.join(__dirname, 'results.identity-delta.md');
  fs.writeFileSync(reportPath, lines.join('\n') + '\n');

  // stdout tally
  console.log('=== TALLY ===');
  console.log(`MATCH:               ${buckets.match.length}`);
  console.log(`DOCUMENTED DRIFT:    ${buckets.doc_drift.length}`);
  console.log(`UNDOCUMENTED DRIFT:  ${buckets.drift.length}  <- the signal`);
  console.log(`MISSING ON DISK:     ${buckets.missing.length}`);
  console.log(`FAILED TO PARSE:     ${buckets.failed.length}`);
  console.log(`Total cards:         ${cardFiles.length}`);
  console.log(`\nFull report: ${path.relative(REPO_ROOT, reportPath)}`);

  process.exit(buckets.drift.length > 0 ? 1 : 0);
}

main();
