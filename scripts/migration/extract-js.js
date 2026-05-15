#!/usr/bin/env node
/**
 * extract-js.js — st8.html peel-apart (JavaScript phase).
 *
 * Extracts the inline JS from st8.html into src/frontend/app.js.
 *
 * Omitted intentionally:
 *   - The void-engine loader (lines 1762-1779) — the founder confirmed
 *     void-engine has been moved to a separate project and should be
 *     removed from st8.
 *   - The external <script src="..."> includes (lines 1790-1794) — those
 *     become <script src="src/frontend/..."> entries in the new slim
 *     index.html shell, not part of app.js.
 *
 * st8.html itself is NOT modified by this script. The slim shell that
 * loads the new app.js is built in a follow-up batch.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(REPO_ROOT, 'st8.html');
const OUT = path.join(REPO_ROOT, 'src/frontend/app.js');

// Source line ranges (1-indexed, inclusive). Verbatim slices from st8.html.
const RANGES = [
  // window.escapeHtml utility (was its own <script> block)
  { lines: [1784, 1788], label: 'escapeHtml utility (was script block 2)' },
  // The main application code (was the third and largest <script> block)
  { lines: [1797, 2584], label: 'Main application (panels, wizard, file list, toasts, SSE)' },
];

function extractRanges(lines, ranges) {
  const out = [];
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    out.push(`// ──────────────────────────────────────────────────────────────`);
    out.push(`// ${r.label}`);
    out.push(`// Extracted from st8.html lines ${r.lines[0]}–${r.lines[1]}.`);
    out.push(`// ──────────────────────────────────────────────────────────────`);
    out.push('');
    const [start, end] = r.lines;
    for (let n = start - 1; n <= end - 1 && n < lines.length; n++) {
      out.push(lines[n]);
    }
    if (i < ranges.length - 1) out.push('');
  }
  return out;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('SOURCE not found:', SOURCE);
    process.exit(1);
  }
  const text = fs.readFileSync(SOURCE, 'utf8');
  const lines = text.split('\n');
  console.log(`Source: st8.html (${lines.length} lines)`);

  const fileLines = [
    `/*`,
    ` * src/frontend/app.js — extracted from st8.html`,
    ` *`,
    ` * Contains the inline JavaScript that used to live in st8.html's third`,
    ` * <script> block plus the escapeHtml utility from the second block.`,
    ` * Loaded in the new slim index.html AFTER the component scripts`,
    ` * (file-explorer.js, phreak-terminal.js, graph-viewer.js, settings.js,`,
    ` * coordination.js) — same load order as the original.`,
    ` *`,
    ` * Omitted from extraction (per founder direction):`,
    ` *   - The void-engine loader (st8.html lines 1762-1779) — void-engine`,
    ` *     has been moved to a separate project.`,
    ` */`,
    '',
  ];

  const body = extractRanges(lines, RANGES);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, [...fileLines, ...body].join('\n') + '\n');

  const totalExtracted = RANGES.reduce((s, r) => s + (r.lines[1] - r.lines[0] + 1), 0);
  console.log(`Wrote: src/frontend/app.js`);
  console.log(`Extracted: ${totalExtracted} source lines (across ${RANGES.length} ranges)`);
  console.log(`Output file lines: ${fileLines.length + body.length}`);

  fs.writeFileSync(
    path.join(__dirname, 'results.js-extract.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), source: 'st8.html', target: 'src/frontend/app.js', ranges: RANGES, sourceLinesUsed: totalExtracted }, null, 2)
  );
}

main();
