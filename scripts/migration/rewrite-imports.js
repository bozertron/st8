#!/usr/bin/env node
/**
 * rewrite-imports.js — Phase 2 of the refactor migration.
 *
 * Walks the moved tree (the `to` paths from manifest.json) and rewrites every
 * relative require()/import statement so its path points at the NEW location
 * of any file in the manifest.
 *
 * Rewrite rules:
 *   - Only relative specifiers (./ or ../) are considered.
 *   - The specifier is resolved against the file's ORIGINAL location (`from`)
 *     to find what the import was originally targeting.
 *   - If that target is itself in the manifest (i.e. it also moved), the
 *     specifier is rewritten to be relative from the file's NEW location
 *     (`to`) to the target's NEW location (`to`).
 *   - Specifiers pointing at files NOT in the manifest are left alone — the
 *     originals are still on disk at their old paths, so they still resolve.
 *
 * Uses @babel/parser to find string-literal positions, then does precise
 * string surgery on the original source text. Formatting, comments, and
 * whitespace are preserved exactly — only the path strings change.
 *
 * Handles: CommonJS `require('...')`, ESM `import ... from '...'`,
 * `export ... from '...'`, dynamic `import('...')`.
 *
 * Idempotent.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function tryResolve(absWithoutExt) {
  // CommonJS-style resolution for relative paths (no node_modules walk).
  const candidates = [
    absWithoutExt,
    absWithoutExt + '.js',
    absWithoutExt + '.mjs',
    absWithoutExt + '.cjs',
    absWithoutExt + '.json',
    path.join(absWithoutExt, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function buildMoveMap(manifest) {
  // Map of absolute-OLD-path -> absolute-NEW-path.
  const map = new Map();
  for (const m of manifest.moves) {
    const fromAbs = path.resolve(REPO_ROOT, m.from);
    const toAbs = path.resolve(REPO_ROOT, m.to);
    map.set(fromAbs, toAbs);
  }
  return map;
}

function parseFile(source, filename) {
  return parser.parse(source, {
    sourceType: 'unambiguous',
    sourceFilename: filename,
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    errorRecovery: true,
    plugins: [
      'jsx',
      'typescript',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'optionalChaining',
      'nullishCoalescingOperator',
      'dynamicImport',
      'topLevelAwait',
      'objectRestSpread',
    ],
  });
}

function collectStringNodes(ast) {
  /**
   * Returns an array of StringLiteral nodes that represent module specifiers
   * we want to consider for rewriting.
   */
  const nodes = [];

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    const t = node.type;

    // CommonJS require('...')
    if (
      t === 'CallExpression' &&
      node.callee &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'require' &&
      node.arguments &&
      node.arguments.length > 0 &&
      node.arguments[0].type === 'StringLiteral'
    ) {
      nodes.push(node.arguments[0]);
    }

    // Dynamic import('...')
    if (
      t === 'CallExpression' &&
      node.callee &&
      node.callee.type === 'Import' &&
      node.arguments &&
      node.arguments.length > 0 &&
      node.arguments[0].type === 'StringLiteral'
    ) {
      nodes.push(node.arguments[0]);
    }

    // import ... from '...'  /  import '...'
    if (t === 'ImportDeclaration' && node.source && node.source.type === 'StringLiteral') {
      nodes.push(node.source);
    }

    // export ... from '...'  /  export * from '...'
    if (
      (t === 'ExportNamedDeclaration' || t === 'ExportAllDeclaration') &&
      node.source &&
      node.source.type === 'StringLiteral'
    ) {
      nodes.push(node.source);
    }

    for (const key in node) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      if (key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
      const val = node[key];
      if (Array.isArray(val)) {
        for (const item of val) visit(item);
      } else if (val && typeof val === 'object' && val.type) {
        visit(val);
      }
    }
  }

  visit(ast.program);
  return nodes;
}

function rewriteOne(fileEntry, moveMap) {
  const fromAbs = path.resolve(REPO_ROOT, fileEntry.from);
  const toAbs = path.resolve(REPO_ROOT, fileEntry.to);

  if (!fs.existsSync(toAbs)) {
    return { status: 'skip', reason: 'dest_missing', file: fileEntry.to, edits: [] };
  }

  const source = fs.readFileSync(toAbs, 'utf8');
  let ast;
  try {
    ast = parseFile(source, fileEntry.to);
  } catch (e) {
    return {
      status: 'fail',
      reason: 'parse_error',
      file: fileEntry.to,
      error: e.message,
      edits: [],
    };
  }

  const nodes = collectStringNodes(ast);
  const edits = [];
  const oldDir = path.dirname(fromAbs);
  const newDir = path.dirname(toAbs);

  for (const node of nodes) {
    const spec = node.value;
    if (!spec.startsWith('./') && !spec.startsWith('../')) continue;

    const oldTargetAbsRaw = path.resolve(oldDir, spec);
    const oldTargetAbs = tryResolve(oldTargetAbsRaw) || oldTargetAbsRaw;

    // Look up if this old target is a file that moved.
    let newTargetAbs = null;
    if (moveMap.has(oldTargetAbs)) {
      newTargetAbs = moveMap.get(oldTargetAbs);
    } else {
      // Try the variant with/without .js suffix
      for (const [oldP, newP] of moveMap) {
        if (oldP === oldTargetAbsRaw || oldP === oldTargetAbsRaw + '.js') {
          newTargetAbs = newP;
          break;
        }
      }
    }

    if (!newTargetAbs) continue; // Target wasn't moved — leave specifier alone.

    let newSpec = path.relative(newDir, newTargetAbs);
    if (!newSpec.startsWith('.')) newSpec = './' + newSpec;
    // Normalize to POSIX separators for the source code.
    newSpec = newSpec.split(path.sep).join('/');
    // Drop the .js suffix (matches the original codebase style — most existing
    // requires use bare names like './persistence', not './persistence.js').
    // We only drop it when the original specifier also lacked the suffix.
    if (!spec.endsWith('.js') && newSpec.endsWith('.js')) {
      newSpec = newSpec.slice(0, -3);
    }

    if (newSpec === spec) continue;

    edits.push({
      start: node.start + 1, // skip opening quote
      end: node.end - 1, // skip closing quote
      oldSpec: spec,
      newSpec,
      line: node.loc ? node.loc.start.line : null,
    });
  }

  if (edits.length === 0) {
    return { status: 'ok', file: fileEntry.to, edits: [] };
  }

  // Apply edits highest offset first so earlier offsets remain valid.
  const sortedEdits = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of sortedEdits) {
    out = out.slice(0, e.start) + e.newSpec + out.slice(e.end);
  }

  fs.writeFileSync(toAbs, out);

  return { status: 'edit', file: fileEntry.to, edits };
}

function main() {
  const manifest = readJson(MANIFEST_PATH);
  const moveMap = buildMoveMap(manifest);

  console.log(`Rewriting imports in batch: ${manifest.batch}`);
  console.log(`Files: ${manifest.moves.length}\n`);

  const summary = [];
  let totalEdits = 0;
  let failures = 0;

  for (const entry of manifest.moves) {
    const result = rewriteOne(entry, moveMap);
    summary.push(result);

    if (result.status === 'fail') {
      console.log(`FAIL  ${result.file}: ${result.reason} (${result.error || ''})`);
      failures++;
      continue;
    }
    if (result.status === 'skip') {
      console.log(`SKIP  ${result.file}: ${result.reason}`);
      continue;
    }
    if (result.edits.length === 0) {
      console.log(`OK    ${result.file}  (no rewrites needed)`);
      continue;
    }

    console.log(`EDIT  ${result.file}  (${result.edits.length} rewrite${result.edits.length === 1 ? '' : 's'}):`);
    for (const e of result.edits) {
      console.log(`        L${String(e.line).padStart(4)}  '${e.oldSpec}'  ->  '${e.newSpec}'`);
    }
    totalEdits += result.edits.length;
  }

  fs.writeFileSync(
    path.join(__dirname, 'results.rewrite.json'),
    JSON.stringify(
      { batch: manifest.batch, generatedAt: new Date().toISOString(), totalEdits, failures, summary },
      null,
      2
    )
  );

  console.log(`\nDone: ${totalEdits} total rewrites across ${manifest.moves.length} files, ${failures} failure(s)`);
  console.log(`Results written to scripts/migration/results.rewrite.json`);

  process.exit(failures > 0 ? 1 : 0);
}

main();
