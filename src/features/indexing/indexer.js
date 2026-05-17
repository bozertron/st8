#!/usr/bin/env node

/**
 * ST8 Indexer — Backend CLI Script
 * 
 * References maestro-scaffolder-tool code for parsing, graph building, and persistence.
 * DO NOT copy files from maestro. Import/require by path.
 * 
 * Usage: node indexer.js <target-directory> [--watch]
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { generateFingerprint } = require('../../shared/types/st8-types');
const {
    deriveBirthTimestamp,
    createFallbackReporter,
} = require('../../shared/utils/birth-timestamp');

// ─── LIB CODE REFERENCES ─────────────────────────────────────
// Post-move: all 4 modules below now live under src/. The original
// loadLibModule pattern joined paths against a single LIB_DIR — that walked
// from backend/.. to lib/. With the new layout the targets are in distinct
// trees, so each getter now requires its target directly. The lazy-load +
// graceful-fallback shape is preserved.

let _astParser = null;
let _graphBuilder = null;
let _databasePersister = null;
let _tomlSerializer = null;
let _backgroundIndexer = null;

function loadLibModule(modulePath) {
    try {
        return require(modulePath);
    } catch (err) {
        console.error(`[st8:indexer] Failed to load module: ${modulePath}`, err.message);
        return null;
    }
}

function getAstParser() {
    if (!_astParser) {
        _astParser = loadLibModule('../../shared/utils/ast-parser');
    }
    return _astParser;
}

function getGraphBuilder() {
    if (!_graphBuilder) {
        _graphBuilder = loadLibModule('../graph/builder');
    }
    return _graphBuilder;
}

function getDatabasePersister() {
    if (!_databasePersister) {
        _databasePersister = loadLibModule('../../core/database/graph-persister');
    }
    return _databasePersister;
}

function getTomlSerializer() {
    if (!_tomlSerializer) {
        _tomlSerializer = loadLibModule('../integr8/toml-serializer');
    }
    return _tomlSerializer;
}

// ─── FILE DISCOVERY ──────────────────────────────────────────

const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go', '.md', '.txt', '.json']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__', '.archive', '.planning', '.st8', 'vendor', 'snapshots']);
// Files st8 itself writes into the target during a run. Re-indexing must
// skip these or they end up as accumulating registry rows (caught by Tier 2
// I6 invariant + force-check FC3).
const SELF_WRITTEN_BASENAMES = new Set(['connection-state.json', 'ai-signal.toml']);

function discoverFiles(targetDir) {
    const files = [];

    function walk(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!IGNORE_DIRS.has(entry.name)) {
                        walk(fullPath);
                    }
                } else if (entry.isFile()) {
                    if (SELF_WRITTEN_BASENAMES.has(entry.name)) continue;
                    const ext = path.extname(entry.name).toLowerCase();
                    if (CODE_EXTENSIONS.has(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (err) {
            console.error(`[st8:indexer] Error reading directory: ${dir}`, err.message);
        }
    }

    walk(targetDir);
    return files;
}

// ─── HASHING ─────────────────────────────────────────────────

const crypto = require('crypto');

function hashFile(filePath) {
    try {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
    } catch (err) {
        console.error(`[st8:indexer] Error hashing file: ${filePath}`, err.message);
        return null;
    }
}

// ─── PARSING ─────────────────────────────────────────────────

function parseImports(filePath) {
    const astParser = getAstParser();
    if (!astParser) {
        console.warn('[st8:indexer] AST parser not available, skipping:', filePath);
        return [];
    }
    
    try {
        // The maestro astParser exports extractImportsAndExports
        if (typeof astParser.extractImportsAndExports === 'function') {
            const result = astParser.extractImportsAndExports(filePath);
            return result.imports || [];
        }
        // Fallback: try extractFromText
        const content = fs.readFileSync(filePath, 'utf-8');
        if (typeof astParser.extractFromText === 'function') {
            const result = astParser.extractFromText(content);
            return result.imports || [];
        }
        return [];
    } catch (err) {
        console.error(`[st8:indexer] Error parsing imports: ${filePath}`, err.message);
        return [];
    }
}

// ─── GRAPH BUILDING ──────────────────────────────────────────

async function buildGraph(files, targetDir) {
    const graphBuilder = getGraphBuilder();
    if (!graphBuilder) {
        console.warn('[st8:indexer] Graph builder not available, using basic classification');
        return { classifications: classifyBasic(files, targetDir), cycles: [] };
    }

    try {
        // The maestro graphBuilder exports buildDependencyGraph (async)
        if (typeof graphBuilder.buildDependencyGraph === 'function') {
            const report = await graphBuilder.buildDependencyGraph(targetDir);

            // CR-02 FIX: Transform from { nodes: [...], circularDeps: [...], ... }
            // to array of { filepath, status, reachabilityScore, impactRadius }.
            // The merge loop in indexDirectory expects an array with .find().
            //
            // Batch 030: ALSO surface report.circularDeps so the
            // cycle-insight-emitter subscriber (INDEX_COMPLETE P=37) can write
            // canonical `circular_dependency` InsightRecords. Without this the
            // DFS-detected cycles get computed and dropped on every index pass.
            // See bible batch 030 + docs/_pending-roadmap/sonic-and-search.md
            // (P2 Layer 2 Pass-2 — "each pass be its own hook subscriber").
            if (report && Array.isArray(report.nodes)) {
                const healthToStatus = {
                    'healthy': 'GREEN',
                    'broken': 'RED',
                    'unused': 'YELLOW',
                    'partial': 'YELLOW'
                };

                const classifications = report.nodes
                    .filter(node => node.path) // Only nodes with file paths
                    .map(node => ({
                        filepath: node.path,
                        filename: node.name || path.basename(node.path),
                        status: healthToStatus[node.health] || 'RED',
                        reachabilityScore: node.health === 'healthy' ? 0.95 : (node.health === 'unused' ? 0.1 : 0.0),
                        impactRadius: node.impactRadius || 0
                    }));
                return {
                    classifications,
                    cycles: Array.isArray(report.circularDeps) ? report.circularDeps : []
                };
            }

            // Fallback if unexpected shape
            console.warn('[st8:indexer] buildDependencyGraph returned unexpected shape, using basic classification');
            return { classifications: classifyBasic(files, targetDir), cycles: [] };
        }
        return { classifications: classifyBasic(files, targetDir), cycles: [] };
    } catch (err) {
        console.error('[st8:indexer] Error building graph:', err.message);
        return { classifications: classifyBasic(files, targetDir), cycles: [] };
    }
}

function classifyBasic(files, targetDir) {
    // Normalize: accept either string paths or file objects (with .filepath)
    const filePaths = files.map(f => {
        if (typeof f === 'string') return f;
        // File objects have relative filepath; join with targetDir for absolute path
        return path.join(targetDir, f.filepath);
    });

    // Basic classification: GREEN if imported by something, RED if not
    const importedBy = new Set();
    const allFiles = new Set(filePaths.map(f => path.relative(targetDir, f)));

    for (const filePath of filePaths) {
        const imports = parseImports(filePath);
        for (const imp of imports) {
            if (imp.source && imp.source.startsWith('.')) {
                // Resolve relative import
                const dir = path.dirname(filePath);
                const resolved = path.resolve(dir, imp.source);
                const relPath = path.relative(targetDir, resolved);
                importedBy.add(relPath);
            }
        }
    }

    return filePaths.map(filePath => {
        const relPath = path.relative(targetDir, filePath);
        const status = importedBy.has(relPath) ? 'GREEN' : 'RED';
        return {
            filepath: relPath,
            filename: path.basename(filePath),
            status: status,
            reachabilityScore: status === 'GREEN' ? 0.95 : 0.0,
            impactRadius: 0
        };
    });
}

// ─── MANIFEST GENERATION ─────────────────────────────────────

function generateManifest(files, targetDir) {
    const manifest = {
        metadata: {
            timestamp: new Date().toISOString(),
            targetDirectory: targetDir,
            totalFiles: files.length,
            statusCounts: {
                GREEN: files.filter(f => f.status === 'GREEN').length,
                YELLOW: files.filter(f => f.status === 'YELLOW').length,
                RED: files.filter(f => f.status === 'RED').length
            }
        },
        files: files.map(f => ({
            filepath: f.filepath,
            filename: f.filename,
            status: f.status,
            reachabilityScore: f.reachabilityScore,
            impactRadius: f.impactRadius,
            sha256Hash: f.sha256Hash,
            imports: f.imports || [],
            importedBy: f.importedBy || []
        }))
    };
    
    return manifest;
}

function writeManifest(manifest, targetDir) {
    const outputPath = path.join(targetDir, 'connection-state.json');
    try {
        fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
        console.log(`[st8:indexer] Manifest written to: ${outputPath}`);
        return outputPath;
    } catch (err) {
        console.error('[st8:indexer] Error writing manifest:', err.message);
        return null;
    }
}

// ─── MAIN INDEXER ────────────────────────────────────────────

async function indexDirectory(targetDir, options = {}) {
    console.log(`[st8:indexer] Indexing: ${targetDir}`);
    
    // Discover files
    const files = discoverFiles(targetDir);
    console.log(`[st8:indexer] Found ${files.length} code files`);
    
    if (files.length === 0) {
        console.log('[st8:indexer] No code files found');
        return { files: [], manifest: null };
    }
    
    // Hash files. birthTimestamp derivation is identity-load-bearing —
    // see src/shared/utils/birth-timestamp.js for the contract. When
    // options.persistence is passed, prior fingerprints are reused so
    // the identity thread (mutation_log, intent, connections) survives
    // even on filesystems that don't record birthtime reliably.
    const fallbackReporter = options.fallbackReporter || createFallbackReporter();
    const persistence = options.persistence || null;
    const hashedFiles = files.map(file => {
        const hash = hashFile(file);
        const stat = fs.statSync(file);
        const filepath = path.relative(targetDir, file);
        const { birthTimestamp } = deriveBirthTimestamp({
            stat,
            filepath,
            persistence,
            reporter: fallbackReporter,
        });
        return {
            filepath: filepath,
            filename: path.basename(file),
            sha256Hash: hash,
            fileSizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
            birthTimestamp: birthTimestamp,
            fingerprint: generateFingerprint(filepath, birthTimestamp),
            lifecyclePhase: 'DEVELOPMENT',
            isEntryPoint: false
        };
    });
    
    // Parse imports
    const parsedFiles = hashedFiles.map(file => {
        const fullPath = path.join(targetDir, file.filepath);
        const imports = parseImports(fullPath);
        return {
            ...file,
            imports: imports.map(imp => ({
                source: imp.source,
                names: imp.names || [],
                isDefault: imp.isDefault || false
            }))
        };
    });
    
    // Build graph and classify (await: buildGraph is now async due to async graphBuilder).
    // Batch 030: destructure into classifications + cycles so the cycle data
    // (previously dropped by the CR-02 transformation) survives to indexDirectory's
    // return value and reaches INDEX_COMPLETE subscribers via result.cycles.
    const { classifications: classifiedFiles, cycles } = await buildGraph(parsedFiles, targetDir);

    // Merge classification with parsed data
    const finalFiles = parsedFiles.map(file => {
        const classification = classifiedFiles.find(c => c.filepath === file.filepath) || {};
        return {
            ...file,
            status: classification.status || 'RED',
            reachabilityScore: classification.reachabilityScore || 0.0,
            impactRadius: classification.impactRadius || 0
        };
    });
    
    // Generate manifest
    const manifest = generateManifest(finalFiles, targetDir);
    
    // Write manifest
    if (options.write !== false) {
        writeManifest(manifest, targetDir);
    }
    
    console.log(`[st8:indexer] Indexing complete: ${finalFiles.length} files`);
    console.log(`[st8:indexer] Status: ${manifest.metadata.statusCounts.GREEN} GREEN, ${manifest.metadata.statusCounts.YELLOW} YELLOW, ${manifest.metadata.statusCounts.RED} RED`);

    // Surface birthTimestamp mtime-fallback events. A non-zero count means
    // identity drift can occur on those files if mtime ever changes before
    // persistence records the first observation. The .st8/identity-risk.json
    // artifact is consumed by introspection tools / force-checks.
    const fbSummary = fallbackReporter.summary();
    if (fbSummary.count > 0) {
        console.warn(
            `[st8:identity-risk] ${fbSummary.count} file(s) used mtime-fallback for birthTimestamp ` +
            `(stat.birthtime was epoch/pre-1980). See .st8/identity-risk.json.`
        );
        try {
            const st8Dir = path.join(targetDir, '.st8');
            if (!fs.existsSync(st8Dir)) fs.mkdirSync(st8Dir, { recursive: true });
            fs.writeFileSync(
                path.join(st8Dir, 'identity-risk.json'),
                JSON.stringify({
                    generatedAt: new Date().toISOString(),
                    fallbackCount: fbSummary.count,
                    records: fbSummary.records,
                }, null, 2)
            );
        } catch (err) {
            console.error('[st8:identity-risk] Failed to write identity-risk.json:', err.message);
        }
    } else {
        // Clean run — remove any stale identity-risk.json so consumers
        // don't read an out-of-date file.
        try {
            const riskPath = path.join(targetDir, '.st8', 'identity-risk.json');
            if (fs.existsSync(riskPath)) fs.unlinkSync(riskPath);
        } catch (err) {
            // Stale-file cleanup is best-effort.
            console.error('[st8:identity-risk] Failed to clean stale identity-risk.json:', err.message);
        }
    }

    // Batch 030: include `cycles` (empty array when the graph builder didn't
    // produce any) so the INDEX_COMPLETE cycle-insight-emitter subscriber
    // can emit canonical `circular_dependency` insights via the existing
    // insight-store.addInsightsBatch() path.
    return { files: finalFiles, manifest, identityRisk: fbSummary, cycles: cycles || [] };
}

// ─── CLI ENTRY POINT ─────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help') {
        console.log('Usage: node indexer.js <target-directory> [--watch]');
        console.log('');
        console.log('Indexes a codebase and generates connection-state.json');
        console.log('');
        console.log('Options:');
        console.log('  --watch    Watch for file changes and re-index');
        console.log('  --help     Show this help message');
        process.exit(0);
    }
    
    const targetDir = path.resolve(args[0]);
    const watchMode = args.includes('--watch');
    
    if (!fs.existsSync(targetDir)) {
        console.error(`[st8:indexer] Target directory does not exist: ${targetDir}`);
        process.exit(1);
    }
    
    indexDirectory(targetDir, { write: true })
        .then(result => {
            if (watchMode) {
                console.log('[st8:indexer] Watch mode not yet implemented');
                // TODO: Phase 4 - File watcher
            }
        })
        .catch(err => {
            console.error('[st8:indexer] Indexing failed:', err);
            process.exit(1);
        });
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    indexDirectory,
    discoverFiles,
    hashFile,
    parseImports,
    buildGraph,
    generateManifest,
    writeManifest
};
