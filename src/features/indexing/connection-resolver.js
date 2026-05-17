'use strict';

/**
 * connection-resolver — maps an `import` / `require` specifier to a
 * concrete first-party file from the index, or returns null.
 *
 * Batch 030 follow-up. Replaces the substring-matcher in main.js's
 * Pass-2 wiring (lines 340-343 before this change):
 *
 *     const targetFile = result.files.find(f =>
 *         f.filepath.endsWith(imp.source) ||
 *         f.filepath.includes(imp.source.replace(/^\.\//, '')));
 *
 * That matcher had three documented failure modes (bible batch 030,
 * meta-dogfood probes, and the cycle-source pressure-test in this
 * batch's commit chain):
 *
 *   1. Node built-ins matched local files containing the substring.
 *      `require('fs')` resolved to `src/shared/utils/safe-fs.js`.
 *      `require('path')` to `src/features/analysis/path-generator.js`.
 *      `require('crypto')` to `src/shared/utils/settings-crypto.js`.
 *      Pure false positives — these are Node stdlib, not first-party.
 *
 *   2. Relative imports starting with `../` were UNRESOLVABLE.
 *      The `.replace(/^\.\//, '')` only strips a single leading `./`,
 *      so `../../features/indexing/indexer` was substring-matched
 *      verbatim and matched no first-party file (none contains `../`
 *      in its filepath). Result: 15 of main.js's 18 imports never
 *      formed connection rows.
 *
 *   3. Same-name files collapsed to whichever the iteration order
 *      yielded first. `require('./app')` from `src/core/server/main.js`
 *      matched `docs/particles.js-master/demo/js/app.js` (a vendored
 *      demo) instead of the correct sibling `src/core/server/app.js`.
 *      `require('path')` matched both `path-generator.js` AND the
 *      research-doc `_research/.../path-generator.md` as separate rows.
 *
 * The new resolver:
 *
 *   - Skips Node built-ins (NODE_BUILTINS allowlist + `node:` prefix).
 *   - Skips npm packages (anything not starting with `./` or `../`).
 *   - Resolves relative paths from the importer's directory using
 *     path.posix.normalize, then looks up the result in the file map.
 *   - Tries common JS/TS extensions (.js, .jsx, .ts, .tsx, .mjs, .cjs)
 *     and directory-index variants if the exact path doesn't match.
 *   - Returns null when no first-party file resolves — main.js's caller
 *     simply doesn't create a connection row for that case.
 *
 * Forward edges are now correct AND bidirectional where they exist.
 * This is what unblocks Tarjan SCC's ability to find real cycles in
 * the persistence-cycle-detector path that landed earlier in batch 030.
 */

const path = require('path');

// Node.js built-in module names (Node 22). Anything in this set
// is stdlib, not first-party code — never resolve to a local file.
const NODE_BUILTINS = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
    'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel',
    'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
    'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
    'process', 'punycode', 'querystring', 'readline', 'repl',
    'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
    'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
]);

const JS_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

/**
 * Resolve an import specifier to a first-party file from the index.
 *
 * @param {string} importerFilepath
 *   Relative path of the file doing the import (from targetDir).
 * @param {string} importSource
 *   The raw specifier as written in the source (e.g. `./app`, `fs`,
 *   `../../features/indexing/indexer`, `lodash`, `node:fs`).
 * @param {Map<string, object>} fileMap
 *   Map of `relativePath → file` for fast lookup. Caller builds this
 *   once per Pass-2 (O(N)) and reuses across all imports for O(1)
 *   lookups instead of O(N²) Array.find calls.
 * @returns {object|null}
 *   The resolved file entry, or null if not a first-party import or
 *   the resolved path doesn't exist in the index.
 */
function resolveImportTarget(importerFilepath, importSource, fileMap) {
    if (!importSource || typeof importSource !== 'string') return null;

    // (1) Skip Node built-ins. Both bare ('fs') and node:-prefixed
    //     ('node:fs') forms.
    if (NODE_BUILTINS.has(importSource)) return null;
    if (importSource.startsWith('node:')) return null;

    // (2) Skip npm packages. Anything that isn't a relative path is
    //     either a package (`lodash`, `@scope/pkg`) or an absolute
    //     path (`/usr/local/...`) — both are out of scope for the
    //     first-party connection graph.
    if (!importSource.startsWith('./') && !importSource.startsWith('../')) return null;

    // (3) Resolve relative to the importer's directory. path.posix is
    //     used so the lookup keys are stable regardless of host OS —
    //     file paths in result.files come from path.relative(targetDir, ...)
    //     which uses OS-native separators on POSIX (which is what st8
    //     runs in) → consistent forward-slash representation.
    const importerDir = path.posix.dirname(importerFilepath.replace(/\\/g, '/'));
    const resolved = path.posix.normalize(path.posix.join(importerDir, importSource));

    // Strip any redundant leading `./` from the normalised path so
    // it can be looked up directly in the fileMap (which is keyed
    // on `path.relative(targetDir, ...)`, never prefixed with `./`).
    // Then strip a single trailing slash — path.posix.normalize
    // preserves it (e.g. `./utils/` → `src/utils/`), and without
    // this strip the subsequent extension + directory-index probes
    // produce junk candidates (`src/utils/.js`, `src/utils//index.js`)
    // that never match anything in the fileMap. Both `./utils` and
    // `./utils/` now resolve identically to the directory's index file.
    let lookupKey = resolved.startsWith('./') ? resolved.slice(2) : resolved;
    if (lookupKey.length > 1 && lookupKey.endsWith('/')) {
        lookupKey = lookupKey.slice(0, -1);
    }

    // (4) Exact match first. Cheapest case: import already names the
    //     full file with extension.
    if (fileMap.has(lookupKey)) return fileMap.get(lookupKey);

    // (5) Try common JS/TS extensions.
    for (const ext of JS_EXTENSIONS) {
        const withExt = lookupKey + ext;
        if (fileMap.has(withExt)) return fileMap.get(withExt);
    }

    // (6) Try directory-index variants. `./utils` matches `./utils/index.js`.
    for (const ext of JS_EXTENSIONS) {
        const indexPath = lookupKey + '/index' + ext;
        if (fileMap.has(indexPath)) return fileMap.get(indexPath);
    }

    return null;
}

/**
 * Build a fileMap (relativePath → file entry) for fast resolveImportTarget
 * lookups. O(N) once; resolveImportTarget then runs O(1) per import.
 *
 * @param {Array<object>} files  result.files from indexDirectory
 * @returns {Map<string, object>}
 */
function buildFileMap(files) {
    const m = new Map();
    if (!Array.isArray(files)) return m;
    for (const f of files) {
        if (f && f.filepath) {
            // Normalize to forward-slash keys to match the resolver's
            // posix-style lookup.
            m.set(f.filepath.replace(/\\/g, '/'), f);
        }
    }
    return m;
}

module.exports = {
    resolveImportTarget,
    buildFileMap,
    NODE_BUILTINS,
    JS_EXTENSIONS,
};
