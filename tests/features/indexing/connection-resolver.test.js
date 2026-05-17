'use strict';

/**
 * tests/features/indexing/connection-resolver.test.js — Batch 030 follow-up.
 *
 * Covers resolveImportTarget + buildFileMap. No SQLite, no real fs —
 * the resolver is pure and operates over an in-memory file map.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    resolveImportTarget,
    buildFileMap,
    NODE_BUILTINS,
    JS_EXTENSIONS,
} = require('../../../src/features/indexing/connection-resolver');

function makeFileMap(paths) {
    return buildFileMap(paths.map(p => ({ filepath: p, fingerprint: p + '||t' })));
}

// ─── Module shape ──────────────────────────────────────────────

test('NODE_BUILTINS contains the modern Node stdlib core', () => {
    // Spot-check the names whose substring-collision originally
    // motivated the resolver replacement.
    assert.ok(NODE_BUILTINS.has('fs'));
    assert.ok(NODE_BUILTINS.has('path'));
    assert.ok(NODE_BUILTINS.has('crypto'));
    assert.ok(NODE_BUILTINS.has('events'));
    assert.ok(NODE_BUILTINS.has('http'));
    assert.ok(NODE_BUILTINS.has('os'));
    assert.ok(NODE_BUILTINS.has('child_process'));
    assert.ok(NODE_BUILTINS.has('stream'));
});

test('JS_EXTENSIONS covers JS + TS + ESM/CJS variants', () => {
    assert.deepEqual(JS_EXTENSIONS, ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
});

// ─── buildFileMap ──────────────────────────────────────────────

test('buildFileMap: empty/non-array input → empty Map', () => {
    assert.equal(buildFileMap().size, 0);
    assert.equal(buildFileMap(null).size, 0);
    assert.equal(buildFileMap('nope').size, 0);
});

test('buildFileMap: indexes files by relative path', () => {
    const m = buildFileMap([
        { filepath: 'src/a.js', fingerprint: 'fp-a' },
        { filepath: 'src/b.js', fingerprint: 'fp-b' },
    ]);
    assert.equal(m.size, 2);
    assert.equal(m.get('src/a.js').fingerprint, 'fp-a');
    assert.equal(m.get('src/b.js').fingerprint, 'fp-b');
});

test('buildFileMap: normalises backslash paths to forward-slash keys', () => {
    const m = buildFileMap([
        { filepath: 'src\\windows\\style.js', fingerprint: 'fp-w' },
    ]);
    assert.equal(m.get('src/windows/style.js').fingerprint, 'fp-w');
});

// ─── Node built-in rejection ───────────────────────────────────

test('rejects bare Node built-ins (fs, path, crypto, etc.)', () => {
    const m = makeFileMap(['src/shared/utils/safe-fs.js', 'src/features/analysis/path-generator.js']);
    assert.equal(resolveImportTarget('src/core/server/main.js', 'fs', m), null);
    assert.equal(resolveImportTarget('src/core/server/main.js', 'path', m), null);
    assert.equal(resolveImportTarget('src/core/server/main.js', 'crypto', m), null);
    assert.equal(resolveImportTarget('src/core/server/main.js', 'os', m), null);
    assert.equal(resolveImportTarget('src/core/server/main.js', 'events', m), null);
});

test('rejects `node:`-prefixed built-ins', () => {
    const m = makeFileMap(['src/shared/utils/safe-fs.js']);
    assert.equal(resolveImportTarget('src/main.js', 'node:fs', m), null);
    assert.equal(resolveImportTarget('src/main.js', 'node:path', m), null);
    assert.equal(resolveImportTarget('src/main.js', 'node:crypto/promises', m), null);
});

test('rejects npm packages (bare specifiers that are not built-ins)', () => {
    const m = makeFileMap(['src/lodash-thing.js']);
    assert.equal(resolveImportTarget('src/main.js', 'lodash', m), null);
    assert.equal(resolveImportTarget('src/main.js', '@scope/pkg', m), null);
    assert.equal(resolveImportTarget('src/main.js', 'better-sqlite3', m), null);
});

// ─── Relative-path resolution ──────────────────────────────────

test('exact-match relative import resolves to the right file', () => {
    const m = makeFileMap([
        'src/core/server/main.js',
        'src/core/server/app.js',
    ]);
    const r = resolveImportTarget('src/core/server/main.js', './app.js', m);
    assert.ok(r);
    assert.equal(r.filepath, 'src/core/server/app.js');
});

test('extensionless relative import → tries .js, .jsx, .ts, .tsx, .mjs, .cjs', () => {
    const m = makeFileMap([
        'src/core/server/main.js',
        'src/core/server/app.js',
    ]);
    const r = resolveImportTarget('src/core/server/main.js', './app', m);
    assert.ok(r);
    assert.equal(r.filepath, 'src/core/server/app.js');
});

test('parent-directory relative imports (`../..`) resolve correctly', () => {
    const m = makeFileMap([
        'src/core/server/main.js',
        'src/features/indexing/indexer.js',
        'src/core/database/persistence.js',
    ]);
    const r1 = resolveImportTarget('src/core/server/main.js', '../../features/indexing/indexer', m);
    assert.ok(r1);
    assert.equal(r1.filepath, 'src/features/indexing/indexer.js');

    const r2 = resolveImportTarget('src/core/server/main.js', '../database/persistence', m);
    assert.ok(r2);
    assert.equal(r2.filepath, 'src/core/database/persistence.js');
});

test('directory imports resolve to index.js / index.ts inside the dir', () => {
    const m = makeFileMap([
        'src/main.js',
        'src/utils/index.js',
        'src/types/index.ts',
    ]);
    const r1 = resolveImportTarget('src/main.js', './utils', m);
    assert.ok(r1);
    assert.equal(r1.filepath, 'src/utils/index.js');

    const r2 = resolveImportTarget('src/main.js', './types', m);
    assert.ok(r2);
    assert.equal(r2.filepath, 'src/types/index.ts');
});

test('relative import to a file that does NOT exist → null', () => {
    const m = makeFileMap(['src/main.js']);
    assert.equal(resolveImportTarget('src/main.js', './nonexistent', m), null);
    assert.equal(resolveImportTarget('src/main.js', '../also-not-there', m), null);
});

test('same-name files no longer collapse — relative path disambiguates', () => {
    // The pre-Batch-030 substring matcher returned the FIRST file whose
    // basename matched. Three `app.js` files would collapse to one. The
    // new resolver picks the correct one based on the importer's
    // directory.
    const m = makeFileMap([
        'src/core/server/main.js',
        'src/core/server/app.js',
        'src/frontend/app.js',
        'docs/particles.js-master/demo/js/app.js',
    ]);
    const r = resolveImportTarget('src/core/server/main.js', './app', m);
    assert.ok(r);
    assert.equal(r.filepath, 'src/core/server/app.js');
});

// ─── Hygiene ───────────────────────────────────────────────────

test('empty / non-string import source → null (no crash)', () => {
    const m = makeFileMap(['src/main.js']);
    assert.equal(resolveImportTarget('src/main.js', '', m), null);
    assert.equal(resolveImportTarget('src/main.js', null, m), null);
    assert.equal(resolveImportTarget('src/main.js', undefined, m), null);
    assert.equal(resolveImportTarget('src/main.js', 42, m), null);
});

test('windows-style backslash importer path is normalised', () => {
    const m = buildFileMap([
        { filepath: 'src\\core\\server\\main.js', fingerprint: 'a' },
        { filepath: 'src\\core\\server\\app.js', fingerprint: 'b' },
    ]);
    // The buildFileMap normalised the keys; the resolver also normalises
    // the importer path internally.
    const r = resolveImportTarget('src\\core\\server\\main.js', './app', m);
    assert.ok(r);
    assert.equal(r.fingerprint, 'b');
});

test('absolute paths are NOT first-party — return null', () => {
    const m = makeFileMap(['src/main.js']);
    assert.equal(resolveImportTarget('src/main.js', '/usr/local/lib/foo', m), null);
});
