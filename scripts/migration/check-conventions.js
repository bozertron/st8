#!/usr/bin/env node
/**
 * check-conventions.js — Deterministic gap analysis on src/.
 *
 * Run from repo root: `node scripts/migration/check-conventions.js`
 *
 * Checks (each emits its own findings list; nothing here judges severity —
 * that's for the human reading the report):
 *
 *   1. NAMING: every file under src/ should have a kebab-case filename
 *      (lowercase, hyphens between words, no camelCase).
 *
 *   2. ZERO-PREFIX RESIDUE: any path containing a "0_" segment is leftover
 *      from the prior planning wave's empty-stub skeleton and should be
 *      cleaned up.
 *
 *   3. EMPTY DIRECTORIES: directories under src/ that contain no files
 *      at any depth (after excluding 0_ skeletons).
 *
 *   4. OLD-PATH REFERENCES: any string literal or comment in src/ that
 *      mentions `backend/<file>.js`, `lib/utils/<file>.js`, `lib/commands/
 *      <file>.js` — those paths no longer exist; references are stale.
 *
 *   5. ARCH BOUNDARY VIOLATIONS: imports that cross layers in the wrong
 *      direction. Rules:
 *        - shared/  may only import from shared/, std lib, npm
 *        - core/    may only import from core/, shared/, std lib, npm
 *        - features may import from features/, core/, shared/, std lib, npm
 *        - frontend may import from frontend/, std lib, npm (browser code,
 *          may not require backend modules)
 *      Violations: features importing each other (cross-feature coupling),
 *      core importing from features, shared importing from core or features.
 *
 *   6. ORPHAN MODULES: files under src/ whose exports are never imported
 *      anywhere in src/. (Best-effort — entry points like main.js are
 *      expected orphans.)
 *
 * Output: a markdown report at scripts/migration/results.gap-analysis.md
 * plus a short tally on stdout.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');

// ─── FILE WALK ────────────────────────────────────────────────────

function walkFiles(root, predicate = () => true) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && predicate(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function walkDirs(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    out.push(dir);
    for (const e of entries) {
      if (e.isDirectory()) stack.push(path.join(dir, e.name));
    }
  }
  return out;
}

function rel(p) {
  return path.relative(REPO_ROOT, p);
}

// ─── CHECK 1 — NAMING ─────────────────────────────────────────────

function checkNaming(files) {
  const findings = [];
  for (const f of files) {
    const base = path.basename(f);
    // Allow uppercase only for README.md, LICENSE, etc. that aren't .js/.css
    if (/[A-Z]/.test(base) && /\.(js|css|html|json)$/.test(base)) {
      findings.push({ file: rel(f), issue: 'camelCase or PascalCase in filename', detail: base });
    }
  }
  return findings;
}

// ─── CHECK 2 — ZERO-PREFIX RESIDUE ────────────────────────────────

function checkZeroPrefix(dirs, files) {
  const findings = [];
  for (const d of dirs) {
    if (/(^|\/)0_/.test(rel(d))) {
      findings.push({ path: rel(d), kind: 'dir' });
    }
  }
  for (const f of files) {
    if (/(^|\/)0_[^\/]*$/.test(rel(f))) {
      findings.push({ path: rel(f), kind: 'file' });
    }
  }
  return findings;
}

// ─── CHECK 3 — EMPTY DIRECTORIES ──────────────────────────────────

function checkEmptyDirs(dirs) {
  const findings = [];
  for (const d of dirs) {
    // Skip if it contains a 0_ — that's check 2's concern
    if (/(^|\/)0_/.test(rel(d))) continue;
    const children = fs.readdirSync(d, { withFileTypes: true });
    if (children.length === 0) {
      findings.push({ path: rel(d) });
    }
  }
  return findings;
}

// ─── CHECK 4 — OLD-PATH REFERENCES ────────────────────────────────

function checkOldPathRefs(files) {
  const findings = [];
  const patterns = [
    /backend\/[a-zA-Z][a-zA-Z0-9\-]*\.js\b/,
    /lib\/utils\/[a-zA-Z][a-zA-Z0-9\-]*\.js\b/,
    /lib\/commands\/[a-zA-Z][a-zA-Z0-9\-]*\.js\b/,
    /lib\/commands\/integr8\/[a-zA-Z][a-zA-Z0-9\-]*\.js\b/,
  ];
  const jsLike = files.filter((f) => /\.(js|css|html)$/.test(f));
  for (const f of jsLike) {
    const text = fs.readFileSync(f, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pat of patterns) {
        if (pat.test(line)) {
          // Skip if it's part of a comment intentionally documenting history
          // (the bible patterns we wrote). Heuristic: lines starting with " *"
          // or containing "extracted from" or "moved from" or "OGB/".
          if (/^\s*(\*|\/\/|<!--)/.test(line) && /\b(extracted|moved|formerly|legacy|OGB|originals|previously)\b/i.test(line)) continue;
          findings.push({ file: rel(f), line: i + 1, match: line.trim().slice(0, 120) });
          break;
        }
      }
    }
  }
  return findings;
}

// ─── CHECK 5 — ARCH BOUNDARY VIOLATIONS ───────────────────────────

const LAYER_ALLOW = {
  shared: ['shared'],
  core: ['core', 'shared'],
  features: ['features', 'core', 'shared'],
  frontend: ['frontend'],
};

function layerOf(absPath) {
  const r = rel(absPath);
  const m = r.match(/^src\/(shared|core|features|frontend)\//);
  return m ? m[1] : null;
}

function resolveRel(fromAbs, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const dir = path.dirname(fromAbs);
  let resolved = path.resolve(dir, spec);
  for (const ext of ['', '.js', '.json', '/index.js']) {
    if (fs.existsSync(resolved + ext) && fs.statSync(resolved + ext).isFile()) {
      return resolved + ext;
    }
  }
  return resolved;
}

function checkBoundaryViolations(files) {
  const findings = [];
  const jsFiles = files.filter((f) => /\.js$/.test(f));
  for (const f of jsFiles) {
    const fromLayer = layerOf(f);
    if (!fromLayer) continue;
    const text = fs.readFileSync(f, 'utf8');
    let ast;
    try {
      ast = parser.parse(text, {
        sourceType: 'unambiguous',
        errorRecovery: true,
        plugins: ['jsx', 'typescript', 'classProperties', 'dynamicImport'],
      });
    } catch (_) {
      continue;
    }
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      let spec = null;
      let line = node.loc ? node.loc.start.line : null;
      if (
        node.type === 'CallExpression' &&
        node.callee &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'require' &&
        node.arguments[0] &&
        node.arguments[0].type === 'StringLiteral'
      ) {
        spec = node.arguments[0].value;
      } else if (
        (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
        node.source &&
        node.source.type === 'StringLiteral'
      ) {
        spec = node.source.value;
      }
      if (spec) {
        const targetAbs = resolveRel(f, spec);
        if (targetAbs) {
          const toLayer = layerOf(targetAbs);
          if (toLayer && toLayer !== fromLayer) {
            const allowed = LAYER_ALLOW[fromLayer] || [];
            if (!allowed.includes(toLayer)) {
              findings.push({
                file: rel(f),
                line,
                fromLayer,
                toLayer,
                target: spec,
              });
            }
          } else if (toLayer === fromLayer && fromLayer === 'features') {
            // Cross-feature within features/ — flag if it crosses a feature dir
            const fromFeat = (rel(f).match(/^src\/features\/([^/]+)\//) || [])[1];
            const toFeat = (rel(targetAbs).match(/^src\/features\/([^/]+)\//) || [])[1];
            if (fromFeat && toFeat && fromFeat !== toFeat) {
              findings.push({
                file: rel(f),
                line,
                fromLayer: `features/${fromFeat}`,
                toLayer: `features/${toFeat}`,
                target: spec,
                kind: 'cross_feature',
              });
            }
          }
        }
      }
      for (const k in node) {
        if (k === 'loc' || k.endsWith('Comments')) continue;
        const v = node[k];
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === 'object' && v.type) visit(v);
      }
    };
    visit(ast.program);
  }
  return findings;
}

// ─── CHECK 6 — ORPHAN MODULES ─────────────────────────────────────

/**
 * Scan an HTML file for <script src="..."> tags and resolve each src to an
 * absolute path on disk. Used so the orphan detector counts files referenced
 * by the frontend's index.html as "referenced", rather than blanket-skipping
 * src/frontend/.
 *
 * Returns a Set of absolute paths. Non-existent targets are dropped.
 */
function collectHtmlScriptRefs(htmlAbsPath) {
  const refs = new Set();
  if (!fs.existsSync(htmlAbsPath)) return refs;
  let text;
  try {
    text = fs.readFileSync(htmlAbsPath, 'utf8');
  } catch (_) {
    return refs;
  }
  const dir = path.dirname(htmlAbsPath);
  // Tolerant of single/double quotes and extra attrs in any order.
  const re = /<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const spec = m[1];
    if (/^https?:\/\//i.test(spec)) continue; // CDN/external
    if (spec.startsWith('/')) continue; // absolute URL, can't map
    const abs = path.resolve(dir, spec);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) refs.add(abs);
  }
  return refs;
}

function checkOrphans(files) {
  const jsFiles = files.filter((f) => /\.js$/.test(f) && !/\.css$/.test(f));
  const referenced = new Set();

  // Seed with explicit HTML <script src> references — frontend files loaded
  // by the browser are not require()'d from anywhere, but they are NOT
  // orphans. Previously the orphan check blanket-skipped src/frontend/,
  // which masked genuinely-unused frontend files. Treat HTML script tags
  // as a first-class reference source.
  const htmlShells = [path.join(SRC_ROOT, 'frontend', 'index.html')];
  for (const html of htmlShells) {
    for (const ref of collectHtmlScriptRefs(html)) referenced.add(ref);
  }

  for (const f of jsFiles) {
    const text = fs.readFileSync(f, 'utf8');
    let ast;
    try {
      ast = parser.parse(text, {
        sourceType: 'unambiguous',
        errorRecovery: true,
        plugins: ['jsx', 'typescript', 'classProperties', 'dynamicImport'],
      });
    } catch (_) {
      continue;
    }
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      let spec = null;
      if (
        node.type === 'CallExpression' &&
        node.callee &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'require' &&
        node.arguments[0] &&
        node.arguments[0].type === 'StringLiteral'
      ) spec = node.arguments[0].value;
      else if (
        (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
        node.source && node.source.type === 'StringLiteral'
      ) spec = node.source.value;
      if (spec && (spec.startsWith('./') || spec.startsWith('../'))) {
        const targetAbs = resolveRel(f, spec);
        if (targetAbs && fs.existsSync(targetAbs)) referenced.add(targetAbs);
      }
      for (const k in node) {
        if (k === 'loc' || k.endsWith('Comments')) continue;
        const v = node[k];
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === 'object' && v.type) visit(v);
      }
    };
    visit(ast.program);
  }
  const orphans = [];
  // Known entry points we expect to be orphans
  const expectedOrphans = new Set(
    ['src/core/server/main.js', 'scripts/verify-persistence-fixes.js', 'src/frontend/app.js'].map((p) => path.join(REPO_ROOT, p))
  );
  for (const f of jsFiles) {
    if (referenced.has(f)) continue;
    if (expectedOrphans.has(f)) continue;
    // Vendor bundles are referenced by HTML or bundled into other vendors
    // and aren't structural orphans; suppress to keep signal-to-noise high.
    if (/^src\/frontend\/vendor\//.test(rel(f))) continue;
    orphans.push(rel(f));
  }
  return orphans;
}

// Export internals for unit tests (no-op when run as CLI — main() still
// fires below). Keeping the export under module.exports preserves the
// shebang-driven `node scripts/migration/check-conventions.js` invocation.
module.exports = { collectHtmlScriptRefs, checkOrphans };

// ─── REPORT ──────────────────────────────────────────────────────

function main() {
  console.log('Scanning src/...');
  const allFiles = walkFiles(SRC_ROOT);
  const allDirs = walkDirs(SRC_ROOT);
  console.log(`  ${allFiles.length} files, ${allDirs.length} directories`);

  const naming = checkNaming(allFiles);
  const zeroPrefix = checkZeroPrefix(allDirs, allFiles);
  const emptyDirs = checkEmptyDirs(allDirs);
  const oldPaths = checkOldPathRefs(allFiles);
  const boundaries = checkBoundaryViolations(allFiles);
  const orphans = checkOrphans(allFiles);

  const lines = [];
  lines.push('# Gap Analysis — Deterministic Checks');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Source: \`src/\` (${allFiles.length} files, ${allDirs.length} directories)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push(`## 1. Naming (camelCase / PascalCase in filenames) — ${naming.length} finding(s)`);
  lines.push('');
  if (!naming.length) lines.push('_None._');
  for (const n of naming) lines.push(`- \`${n.file}\` — ${n.detail}`);
  lines.push('');

  lines.push(`## 2. Zero-prefix residue (\`0_\` paths) — ${zeroPrefix.length} finding(s)`);
  lines.push('');
  if (!zeroPrefix.length) lines.push('_None._');
  for (const z of zeroPrefix) lines.push(`- \`${z.path}\` (${z.kind})`);
  lines.push('');

  lines.push(`## 3. Empty directories — ${emptyDirs.length} finding(s)`);
  lines.push('');
  if (!emptyDirs.length) lines.push('_None._');
  for (const d of emptyDirs) lines.push(`- \`${d.path}\``);
  lines.push('');

  lines.push(`## 4. Stale references to OLD paths — ${oldPaths.length} finding(s)`);
  lines.push('');
  if (!oldPaths.length) lines.push('_None._');
  for (const o of oldPaths) lines.push(`- \`${o.file}\`:${o.line} — \`${o.match}\``);
  lines.push('');

  lines.push(`## 5. Architecture boundary violations — ${boundaries.length} finding(s)`);
  lines.push('');
  if (!boundaries.length) lines.push('_None._');
  for (const b of boundaries) {
    const tag = b.kind === 'cross_feature' ? ' (cross-feature)' : '';
    lines.push(`- \`${b.file}\`:${b.line} — ${b.fromLayer} -> ${b.toLayer}${tag} — \`${b.target}\``);
  }
  lines.push('');

  lines.push(`## 6. Orphan modules (no consumers in src/) — ${orphans.length} finding(s)`);
  lines.push('');
  if (!orphans.length) lines.push('_None._');
  for (const o of orphans) lines.push(`- \`${o}\``);
  lines.push('');

  const totals = naming.length + zeroPrefix.length + emptyDirs.length + oldPaths.length + boundaries.length + orphans.length;
  lines.push('---');
  lines.push(`**Total findings: ${totals}** — ${naming.length} naming, ${zeroPrefix.length} zero-prefix, ${emptyDirs.length} empty, ${oldPaths.length} stale paths, ${boundaries.length} boundary, ${orphans.length} orphans.`);

  const outPath = path.join(__dirname, 'results.gap-analysis.md');
  fs.writeFileSync(outPath, lines.join('\n') + '\n');

  console.log('\n=== TALLY ===');
  console.log(`Naming issues:           ${naming.length}`);
  console.log(`Zero-prefix residue:     ${zeroPrefix.length}`);
  console.log(`Empty directories:       ${emptyDirs.length}`);
  console.log(`Stale OLD-path refs:     ${oldPaths.length}`);
  console.log(`Boundary violations:     ${boundaries.length}`);
  console.log(`Orphan modules:          ${orphans.length}`);
  console.log(`-`.repeat(34));
  console.log(`Total:                   ${totals}`);
  console.log(`\nFull report: ${rel(outPath)}`);
}

// Only run main() when invoked directly via `node scripts/migration/...`.
// `require()` from a unit test should NOT trigger the report writer.
if (require.main === module) {
  main();
}
