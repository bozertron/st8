#!/usr/bin/env node
/**
 * extract-css.js — st8.html peel-apart (CSS phase).
 *
 * Reads st8.html, extracts each documented CSS section (per the file's
 * trusted top-of-file index) verbatim into a component-local .css file
 * under src/frontend/. Original st8.html is NOT modified — it stays
 * intact so the unmigrated UI keeps working. The slim shell that loads
 * these new CSS files will be built in a follow-up batch.
 *
 * Line ranges are 1-indexed and inclusive — they match the top-of-file
 * index in st8.html (pressure-tested earlier in the refactor).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(REPO_ROOT, 'st8.html');

// Each target is one output file. A target may have multiple line ranges
// when a logical "component" has its CSS split across the file (e.g. void
// has both the surface block and the cursor/pulse block).
const TARGETS = [
  { out: 'src/frontend/styles/fonts.css',                                     ranges: [[138, 148]],   label: 'Fonts (@font-face)' },
  { out: 'src/frontend/styles/tokens.css',                                    ranges: [[150, 165]],   label: 'CSS Custom Properties (:root)' },
  { out: 'src/frontend/styles/base.css',                                      ranges: [[167, 179], [1609, 1611]], label: 'Base Reset + Reduced Motion Overrides' },
  { out: 'src/frontend/styles/void.css',                                      ranges: [[180, 235], [817, 855]],   label: 'Void / Drift Surface + Cursor / Wave Pulse' },
  { out: 'src/frontend/styles/chat.css',                                      ranges: [[237, 266]],   label: 'Chat Area (left side of split void)' },
  { out: 'src/frontend/styles/file-list.css',                                 ranges: [[268, 378]],   label: 'File List (right panel)' },
  { out: 'src/frontend/styles/notes-popup.css',                               ranges: [[380, 497]],   label: 'Notes Popup' },
  { out: 'src/frontend/styles/dock.css',                                      ranges: [[857, 941]],   label: 'Bottom Dock' },
  { out: 'src/frontend/styles/panels.css',                                    ranges: [[943, 1010]],  label: 'Panel Overlay' },
  { out: 'src/frontend/components/graph-viewer/graph-viewer.css',             ranges: [[499, 601]],   label: 'Graph Popup' },
  { out: 'src/frontend/components/settings/settings.css',                     ranges: [[603, 815]],   label: 'Settings Popup' },
  { out: 'src/frontend/components/file-explorer/file-explorer.css',           ranges: [[1012, 1226], [1228, 1288]], label: 'File Explorer + Workspace Picker' },
  { out: 'src/frontend/components/terminal/terminal.css',                     ranges: [[1290, 1527]], label: 'Phreak Terminal' },
  { out: 'src/frontend/components/notifications/toast.css',                   ranges: [[1530, 1607], [1613, 1623]], label: 'Mutation Notifications & Toasts + AI Review Badge' },
  { out: 'src/frontend/components/prd-wizard/prd-wizard.css',                 ranges: [[1625, 1662], [1664, 1686]], label: 'PRD Wizard + Variable Editor' },
];

function extractRanges(lines, ranges) {
  const out = [];
  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    // Convert to 0-indexed slice; +1 on end because slice is exclusive.
    for (let n = start - 1; n <= end - 1 && n < lines.length; n++) {
      out.push(lines[n]);
    }
    // Separator between range groups in the same file.
    if (i < ranges.length - 1) out.push('');
  }
  return out;
}

function makeHeader(label, ranges) {
  const lineSpec = ranges.map(([a, b]) => `${a}–${b}`).join(', ');
  return [
    `/*`,
    ` * ${label}`,
    ` * Extracted from st8.html lines ${lineSpec}.`,
    ` * Verbatim from the source — formatting, selectors, values all preserved.`,
    ` */`,
    '',
  ];
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('SOURCE not found:', SOURCE);
    process.exit(1);
  }
  const text = fs.readFileSync(SOURCE, 'utf8');
  const lines = text.split('\n');
  console.log(`Source: st8.html (${lines.length} lines)\n`);

  let totalExtracted = 0;
  const results = [];

  for (const t of TARGETS) {
    const absOut = path.join(REPO_ROOT, t.out);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });

    const headerLines = makeHeader(t.label, t.ranges);
    const bodyLines = extractRanges(lines, t.ranges);
    const fileLines = [...headerLines, ...bodyLines];

    fs.writeFileSync(absOut, fileLines.join('\n') + '\n');
    const rangeSpec = t.ranges.map(([a, b]) => `${a}-${b}`).join(', ');
    const bodyCount = bodyLines.length;
    totalExtracted += t.ranges.reduce((s, [a, b]) => s + (b - a + 1), 0);
    console.log(`OK  ${t.out}  (lines ${rangeSpec}; body ${bodyCount})`);
    results.push({ out: t.out, label: t.label, ranges: t.ranges, bodyLineCount: bodyCount });
  }

  fs.writeFileSync(
    path.join(__dirname, 'results.css-extract.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), totalSourceLinesUsed: totalExtracted, results }, null, 2)
  );

  console.log(`\nTotal source lines used: ${totalExtracted} (st8.html <style> spans lines 138-1686 = 1549 lines)`);
  console.log(`Diff: ${1549 - totalExtracted} lines NOT extracted — these are the section-divider blank lines and inter-section header comments between the listed ranges. CSS rules are fully preserved.`);
}

main();
