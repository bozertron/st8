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

// ─── LIB CODE REFERENCES ─────────────────────────────────────
// These paths reference the local lib directory.
// The indexer requires these modules by relative path.

const LIB_DIR = path.join(__dirname, '..', 'lib');

// Lazy-loaded lib modules
let _astParser = null;
let _graphBuilder = null;
let _databasePersister = null;
let _tomlSerializer = null;
let _backgroundIndexer = null;

function loadLibModule(modulePath) {
    try {
        const fullPath = path.join(LIB_DIR, modulePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Lib module not found: ${fullPath}`);
        }
        return require(fullPath);
    } catch (err) {
        console.error(`[st8:indexer] Failed to load lib module: ${modulePath}`, err.message);
        return null;
    }
}

function getAstParser() {
    if (!_astParser) {
        _astParser = loadLibModule('utils/astParser.js');
    }
    return _astParser;
}

function getGraphBuilder() {
    if (!_graphBuilder) {
        _graphBuilder = loadLibModule('commands/graphBuilder.js');
    }
    return _graphBuilder;
}

function getDatabasePersister() {
    if (!_databasePersister) {
        _databasePersister = loadLibModule('commands/integr8/databasePersister.js');
    }
    return _databasePersister;
}

function getTomlSerializer() {
    if (!_tomlSerializer) {
        _tomlSerializer = loadLibModule('commands/integr8/tomlSerializer.js');
    }
    return _tomlSerializer;
}

// ─── ST8 SCHEMA ──────────────────────────────────────────────
// The st8 schema is simpler than maestro's. We only need:
// - file_registry (fingerprint, filepath, filename, sha256, status, etc.)
// - connections (source, target, type, is_resolved)
// - file_intent (purpose, depends_on_behavior, value_statement)
// - activity_log (timestamp, source, action, target, details)

const ST8_SCHEMA = `
CREATE TABLE IF NOT EXISTS file_registry (
  fingerprint TEXT PRIMARY KEY,
  filepath TEXT NOT NULL,
  filename TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  file_size_bytes INTEGER,
  status TEXT DEFAULT 'GREEN',
  reachability_score REAL DEFAULT 0.0,
  impact_radius INTEGER DEFAULT 0,
  last_modified TEXT,
  last_indexed TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_fingerprint TEXT NOT NULL,
  target_fingerprint TEXT NOT NULL,
  connection_type TEXT DEFAULT 'IMPORT',
  import_specifier TEXT,
  is_resolved INTEGER DEFAULT 1,
  confidence_score REAL DEFAULT 1.0,
  last_verified TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_fingerprint) REFERENCES file_registry(fingerprint),
  FOREIGN KEY (target_fingerprint) REFERENCES file_registry(fingerprint)
);

CREATE TABLE IF NOT EXISTS file_intent (
  fingerprint TEXT PRIMARY KEY,
  purpose TEXT,
  depends_on_behavior TEXT,
  value_statement TEXT,
  authored_by TEXT DEFAULT 'INFERRED',
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fingerprint) REFERENCES file_registry(fingerprint)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'INDEXER',
  action TEXT NOT NULL,
  target_fingerprint TEXT,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_file_registry_status ON file_registry(status);
CREATE INDEX IF NOT EXISTS idx_file_registry_sha256 ON file_registry(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_fingerprint);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_fingerprint);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp);
`;

// ─── FILE DISCOVERY ──────────────────────────────────────────

const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__']);

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

function buildGraph(files, targetDir) {
    const graphBuilder = getGraphBuilder();
    if (!graphBuilder) {
        console.warn('[st8:indexer] Graph builder not available, using basic classification');
        return classifyBasic(files, targetDir);
    }
    
    try {
        // The maestro graphBuilder exports buildDependencyGraph
        if (typeof graphBuilder.buildDependencyGraph === 'function') {
            const result = graphBuilder.buildDependencyGraph(targetDir);
            return result;
        }
        return classifyBasic(files, targetDir);
    } catch (err) {
        console.error('[st8:indexer] Error building graph:', err.message);
        return classifyBasic(files, targetDir);
    }
}

function classifyBasic(files, targetDir) {
    // Basic classification: GREEN if imported by something, RED if not
    const importedBy = new Set();
    const allFiles = new Set(files.map(f => path.relative(targetDir, f)));
    
    for (const file of files) {
        const imports = parseImports(file);
        for (const imp of imports) {
            if (imp.source && imp.source.startsWith('.')) {
                // Resolve relative import
                const dir = path.dirname(file);
                const resolved = path.resolve(dir, imp.source);
                const relPath = path.relative(targetDir, resolved);
                importedBy.add(relPath);
            }
        }
    }
    
    return files.map(file => {
        const relPath = path.relative(targetDir, file);
        const status = importedBy.has(relPath) ? 'GREEN' : 'RED';
        return {
            filepath: relPath,
            filename: path.basename(file),
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
    
    // Hash files
    const hashedFiles = files.map(file => {
        const hash = hashFile(file);
        const stat = fs.statSync(file);
        return {
            filepath: path.relative(targetDir, file),
            filename: path.basename(file),
            sha256Hash: hash,
            fileSizeBytes: stat.size,
            lastModified: stat.mtime.toISOString()
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
    
    // Build graph and classify
    const classifiedFiles = buildGraph(parsedFiles, targetDir);
    
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
    
    return { files: finalFiles, manifest };
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
