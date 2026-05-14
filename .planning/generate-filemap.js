#!/usr/bin/env node

/**
 * generate-filemap.js — Auto-generates st8-filemap.md from the live codebase.
 * Run: node .planning/generate-filemap.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.planning', 'st8-filemap.md');

// ─── Helpers ────────────────────────────────────────────────────

function lineCount(filePath) {
  try {
    return parseInt(execSync(`wc -l < "${filePath}"`, { encoding: 'utf8' }).trim(), 10);
  } catch {
    return -1;
  }
}

function extractPurpose(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Look for first JSDoc @file / module description or first meaningful comment
    const lines = content.split('\n').slice(0, 30);
    let inJSDoc = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('/**')) { inJSDoc = true; continue; }
      if (inJSDoc && trimmed.startsWith('*/')) { inJSDoc = false; continue; }
      if (inJSDoc) {
        const desc = trimmed.replace(/^\*\s?/, '').trim();
        // Skip @param, @module, @returns, empty lines
        if (desc && !desc.startsWith('@')) return desc;
      }
      // Also catch // comments that describe purpose
      if (!inJSDoc && trimmed.startsWith('//') && !trimmed.startsWith('// ─') && !trimmed.startsWith('#!/')) {
        const desc = trimmed.replace(/^\/\/\s?/, '').trim();
        if (desc && desc.length > 10 && !desc.startsWith('use strict') && !desc.startsWith('Copyright')) return desc;
      }
    }
  } catch { /* ignore */ }
  return '';
}

function extractClassNames(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const classes = [...content.matchAll(/^class\s+(\w+)/gm)].map(m => m[1]);
    const exports_ = [...content.matchAll(/^module\.exports\s*=\s*(\w+)/gm)].map(m => m[1]);
    const namedExports = [...content.matchAll(/^\s*(?:const|let|var)\s+\{\s*([^}]+)\}\s*=\s*require/gm)]
      .flatMap(m => m[1].split(',').map(s => s.trim()));
    return { classes, exports: exports_, namedExports };
  } catch {
    return { classes: [], exports: [], namedExports: [] };
  }
}

function extractRequires(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const locals = [...content.matchAll(/require\(\s*['"]\.\/([^'"]+)['"]\s*\)/gm)].map(m => m[1]);
    const external = [...content.matchAll(/require\(\s*['"]([a-z@][^'"]+)['"]\s*\)/gm)].map(m => m[1]);
    return { locals, external: [...new Set(external)] };
  } catch {
    return { locals: [], external: [] };
  }
}

function fmt(n) {
  return n === -1 ? '?' : String(n);
}

// ─── Collect files ──────────────────────────────────────────────

const rootFiles = fs.readdirSync(ROOT)
  .filter(f => fs.statSync(path.join(ROOT, f)).isFile() && !f.startsWith('.'))
  .filter(f => !['package-lock.json', 'st8.sqlite'].includes(f));

const backendFiles = fs.readdirSync(path.join(ROOT, 'backend'))
  .filter(f => f.endsWith('.js'))
  .sort();

const libUtils = fs.readdirSync(path.join(ROOT, 'lib', 'utils'))
  .filter(f => f.endsWith('.js'))
  .sort();

const libCommands = fs.readdirSync(path.join(ROOT, 'lib', 'commands'))
  .filter(f => f.endsWith('.js'))
  .sort();

const integr8Files = fs.readdirSync(path.join(ROOT, 'lib', 'commands', 'integr8'))
  .filter(f => f.endsWith('.js'))
  .sort();

// ─── Gather data ────────────────────────────────────────────────

const now = new Date().toISOString().split('T')[0];

let md = '';
md += `# ST8 File Map\n\n`;
md += `**Generated:** ${now}\n`;
md += `**Purpose:** Complete inventory of all source files for gap analysis and integration planning\n\n`;
md += `---\n\n`;

// ─── Root Level ─────────────────────────────────────────────────

md += `## Root Level Files\n\n`;
md += `| File | Lines | Purpose | Dependencies |\n`;
md += `|------|-------|---------|--------------|\n`;

for (const f of rootFiles.sort()) {
  const fp = path.join(ROOT, f);
  const lines = lineCount(fp);
  const purpose = extractPurpose(fp);
  const req = extractRequires(fp);
  const deps = [...req.locals.map(r => r.replace(/\.js$/, '')), ...req.external].join(', ') || '-';
  md += `| \`${f}\` | ${fmt(lines)} | ${purpose || '-'} | ${deps} |\n`;
}
md += `\n---\n\n`;

// ─── Backend Files ──────────────────────────────────────────────

md += `## Backend Files\n\n`;
md += `| File | Lines | Purpose | Key Functions/Classes |\n`;
md += `|------|-------|---------|----------------------|\n`;

for (const f of backendFiles) {
  const fp = path.join(ROOT, 'backend', f);
  const lines = lineCount(fp);
  const purpose = extractPurpose(fp);
  const info = extractClassNames(fp);
  const keyItems = [...info.classes, ...info.exports].join(', ') || '-';
  md += `| \`${f}\` | ${fmt(lines)} | ${purpose || '-'} | ${keyItems} |\n`;
}
md += `\n---\n\n`;

// ─── Library Files ──────────────────────────────────────────────

md += `## Library Files (lib/)\n\n`;

md += `### Utils\n`;
md += `| File | Lines | Purpose |\n`;
md += `|------|-------|--------|\n`;
for (const f of libUtils) {
  const fp = path.join(ROOT, 'lib', 'utils', f);
  const lines = lineCount(fp);
  const purpose = extractPurpose(fp);
  md += `| \`${f}\` | ${fmt(lines)} | ${purpose || '-'} |\n`;
}

md += `\n### Commands\n`;
md += `| File | Lines | Purpose |\n`;
md += `|------|-------|--------|\n`;
for (const f of libCommands) {
  const fp = path.join(ROOT, 'lib', 'commands', f);
  const lines = lineCount(fp);
  const purpose = extractPurpose(fp);
  md += `| \`${f}\` | ${fmt(lines)} | ${purpose || '-'} |\n`;
}

md += `\n### Integr8 Subdirectory\n`;
md += `| File | Lines | Purpose |\n`;
md += `|------|-------|--------|\n`;
for (const f of integr8Files) {
  const fp = path.join(ROOT, 'lib', 'commands', 'integr8', f);
  const lines = lineCount(fp);
  const purpose = extractPurpose(fp);
  md += `| \`${f}\` | ${fmt(lines)} | ${purpose || '-'} |\n`;
}
md += `\n---\n\n`;

// ─── Non-Source ─────────────────────────────────────────────────

md += `## Non-Source\n\n`;
md += `| Path | Purpose |\n`;
md += `|------|--------|\n`;
md += `| \`.planning/\` | Planning documents and specs |\n`;
md += `| \`.st8/\` | Runtime output (schema-cards/, gap-analysis.md) |\n`;
md += `| \`.st8/schema-cards/\` | Per-file schema card JSON files |\n`;
md += `| \`.archive/\` | Archived reference files |\n`;
md += `| \`node_modules/\` | NPM dependencies |\n`;
md += `| \`fonts/\` | Custom fonts (Monoton, Poiret One) |\n`;
md += `| \`vendor/\` | Vendored dependencies (currently empty) |\n`;
md += `| \`docs/\` | Documentation |\n`;
md += `| \`st8.code-workspace\` | VSCode workspace config |\n`;
md += `\n---\n\n`;

// ─── API Endpoints ──────────────────────────────────────────────

md += `## API Endpoints (server.js)\n\n`;
md += `| Endpoint | Method | Purpose |\n`;
md += `|----------|--------|--------|\n`;
md += `| \`/api/connection-state.json\` | GET | Serves connection manifest |\n`;
md += `| \`/api/ai-signal.toml\` | GET | Serves AI signal TOML |\n`;
md += `| \`/api/health\` | GET | Health check |\n`;
md += `| \`/api/index\` | POST | Triggers re-indexing |\n`;
md += `| \`/api/file-intent\` | GET/POST | File intent CRUD |\n`;
md += `| \`/api/settings\` | GET/POST | Settings read/write |\n`;
md += `| \`/api/verify\` | POST | Run verification |\n`;
md += `| \`/api/files\` | GET | List indexed files |\n`;
md += `| \`/api/mutations\` | GET | SSE stream of file mutations |\n`;
md += `| \`/api/concept-file\` | GET/POST | Concept file operations |\n`;
md += `| \`/api/mvp-lock\` | POST | MVP lock management |\n`;
md += `| \`/api/prd\` | GET | PRD generation |\n`;
md += `| \`/api/production-promote\` | POST | Promote file to production phase |\n`;
md += `| \`/api/gap-analysis\` | GET | Gap analysis results |\n`;
md += `| \`/api/prd-projects\` | GET/POST | PRD project management |\n`;
md += `| \`/api/bruno-call\` | POST | Bruno file lifecycle actions |\n`;
md += `| \`/api/oscar-house\` | POST | Oscar archive actions |\n`;
md += `| \`/api/needs-ai-review\` | GET | Files needing AI review |\n`;
md += `| \`/api/mark-reviewed\` | POST | Mark file as reviewed |\n`;
md += `| \`/api/templates\` | GET/POST | Template management |\n`;
md += `\n---\n\n`;

// ─── Integration Points ─────────────────────────────────────────

md += `## Integration Points Summary\n\n`;

md += `### Frontend → Backend\n`;
md += `1. **st8.html** → \`st8WorkspaceChanged()\` activates split mode\n`;
md += `2. **st8.html** → \`St8Coordination.startPolling()\` polls manifest\n`;
md += `3. **file-explorer.js** → \`PhreakTerminal.execute('index ' + path)\` triggers indexing\n`;
md += `4. **st8.html** → Backend \`/api/connection-state.json\` polled\n`;
md += `5. **st8.html** → \`/api/mutations\` SSE stream for real-time updates\n`;
md += `6. **st8.html** → \`/api/files\`, \`/api/settings\`, \`/api/gap-analysis\` etc.\n\n`;

md += `### Backend Index Flow (WIRED)\n`;
md += `\`\`\`\n`;
md += `indexer.js:indexDirectory()\n`;
md += `         ↓\n`;
md += `   returns { files, manifest }\n`;
md += `         ↓\n`;
md += `persistence.js:St8Persistence.upsertFile()\n`;
md += `         ↓\n`;
md += `persistence.js:St8Persistence.insertConnection()\n`;
md += `         ↓\n`;
md += `manifestGenerator.js:writeManifests()\n`;
md += `         ↓\n`;
md += `schemaCardEmitter.js:emitAllCards()\n`;
md += `         ↓\n`;
md += `schemaCardPrinter.js:printAllFromCards()\n`;
md += `         ↓\n`;
md += `gapAnalyzer.js:analyze() → .st8/gap-analysis.md\n`;
md += `         ↓\n`;
md += `intentSeeder.js:seedAll()\n`;
md += `         ↓\n`;
md += `server.js:_serveManifest() → targetDir/connection-state.json\n`;
md += `\`\`\`\n\n`;

md += `### File Watcher (WIRED)\n`;
md += `\`\`\`\n`;
md += `fileWatcher.js:_onFileChange()\n`;
md += `         ↓\n`;
md += `index.js:onFileChange callback\n`;
md += `         ↓\n`;
md += `  ├── ADD:   persistence.upsertFile() + logMutation(CREATE) + emitCard()\n`;
md += `  ├── EDIT:  persistence.upsertFile() + logMutation(EDIT) + emitCard()\n`;
md += `  └── DEL:   persistence.deleteFile() + logMutation(DELETE) + unlink schema card\n`;
md += `         ↓\n`;
md += `notificationBus.publish() → SSE → frontend\n`;
md += `         ↓\n`;
md += `writeManifests() + intentSeeder.seedAll() + gapAnalyzer.writeReport()\n`;
md += `\`\`\`\n\n`;

md += `---\n\n`;

// ─── Workspace Type Handling ────────────────────────────────────

md += `## Workspace Type Handling\n\n`;
md += `| Workspace | file-explorer.js | st8.html |\n`;
md += `|-----------|------------------|----------|\n`;
md += `| \`standard\` | Standard file browsing | Deactivates split mode |\n`;
md += `| \`logic-analyzer\` | Full stack view | Activates split mode |\n`;
md += `| \`pretext-dev\` | NOT handled | void-engine.js would activate |\n\n`;
md += `**Key:** Full Stack Logic Analyzer = \`logic-analyzer\` workspace type\n\n`;
md += `---\n\n`;

// ─── Stubs and Mock Data ────────────────────────────────────────

md += `## Stubs and Mock Data\n\n`;
md += `| Location | Type | Impact |\n`;
md += `|----------|------|--------|\n`;
md += `| \`phreak-terminal.js\` | \`_simulateCommand()\` | Mock responses when bridge offline |\n`;
md += `| \`file-explorer.js\` | \`_mockEntries()\` | Fallback mock directory data |\n`;
md += `| \`backend/indexer.js\` | \`classifyBasic()\` fallback | Basic classification instead of real graph |\n`;
md += `| \`st8.html\` | TODO comment | Notes save not persisted |\n\n`;

md += `---\n\n`;
md += `*End of file map.*\n`;

// ─── Write ──────────────────────────────────────────────────────

fs.writeFileSync(OUT, md, 'utf8');
console.log(`[filemap] Written to ${OUT}`);
console.log(`[filemap] ${rootFiles.length} root + ${backendFiles.length} backend + ${libUtils.length + libCommands.length + integr8Files.length} lib files indexed`);
