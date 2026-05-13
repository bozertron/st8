#!/usr/bin/env node

/**
 * ST8 Backend — Main Entry Point
 * 
 * Ties together indexer, persistence, manifest generator, file watcher, and server.
 * 
 * Usage: node index.js <target-directory> [--watch] [--serve] [--port PORT]
 */

'use strict';

const path = require('path');
const { indexDirectory } = require('./indexer');
const { St8Persistence } = require('./persistence');
const { writeManifests } = require('./manifestGenerator');
const { FileWatcher } = require('./fileWatcher');
const { St8Server } = require('./server');

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help') {
        console.log('ST8 Backend — Full Stack Logic Analyzer');
        console.log('');
        console.log('Usage: node index.js <target-directory> [options]');
        console.log('');
        console.log('Options:');
        console.log('  --watch       Watch for file changes and re-index');
        console.log('  --serve       Start HTTP server for manifests');
        console.log('  --port PORT   Server port (default: 3847)');
        console.log('  --help        Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  node index.js /path/to/project');
        console.log('  node index.js /path/to/project --watch');
        console.log('  node index.js /path/to/project --watch --serve');
        process.exit(0);
    }
    
    const targetDir = path.resolve(args[0]);
    const watchMode = args.includes('--watch');
    const serveMode = args.includes('--serve');
    const portArg = args.indexOf('--port');
    const port = portArg !== -1 ? parseInt(args[portArg + 1]) : 3847;
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ST8 — Full Stack Logic Analyzer                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Target: ${targetDir}`);
    console.log(`Watch:  ${watchMode ? 'enabled' : 'disabled'}`);
    console.log(`Serve:  ${serveMode ? 'enabled' : 'disabled'}`);
    console.log('');
    
    // Initialize persistence
    const persistence = new St8Persistence();
    await persistence.initialize();
    
    // Run initial indexing
    console.log('[st8] Running initial indexing...');
    const result = await indexDirectory(targetDir, { write: true });
    
    // Store in SQLite
    if (result.files && result.files.length > 0) {
        console.log('[st8] Storing results in SQLite...');
        for (const file of result.files) {
            persistence.upsertFile({
                fingerprint: file.sha256Hash,
                filepath: file.filepath,
                filename: file.filename,
                sha256Hash: file.sha256Hash,
                fileSizeBytes: file.fileSizeBytes,
                status: file.status,
                reachabilityScore: file.reachabilityScore,
                impactRadius: file.impactRadius,
                lastModified: file.lastModified
            });
            
            // F1: Wire connections into persistence
            if (file.imports && file.imports.length > 0) {
                for (const imp of file.imports) {
                    const targetFile = result.files.find(f => 
                        f.filepath.endsWith(imp.source) || 
                        f.filepath.includes(imp.source.replace(/^\.\//, ''))
                    );
                    if (targetFile) {
                        persistence.insertConnection({
                            sourceFingerprint: file.sha256Hash,
                            targetFingerprint: targetFile.sha256Hash,
                            connectionType: 'IMPORT',
                            importSpecifier: imp.source,
                            isResolved: true,
                            confidenceScore: 1.0
                        });
                    }
                }
            }
        }
        
        persistence.logActivity({
            source: 'INDEXER',
            action: 'INDEX_COMPLETE',
            details: {
                totalFiles: result.files.length,
                statusCounts: result.manifest.metadata.statusCounts
            }
        });
        
        // F2: Call manifestGenerator after indexing
        const { writeManifests } = require('./manifestGenerator');
        writeManifests(result.files, targetDir);
        console.log('[st8] Manifests generated');
    }
    
    // Start file watcher if requested
    let watcher = null;
    if (watchMode) {
        console.log('[st8] Starting file watcher...');
        watcher = new FileWatcher(targetDir, {
            debounceMs: 500,
            onFileChange: async (changes) => {
                console.log(`[st8] Files changed: ${changes.length}`);
                
                // F3: Implement incremental re-index
                for (const change of changes) {
                    const changedFile = result.files.find(f => 
                        f.filepath === path.relative(targetDir, change.path)
                    );
                    if (changedFile) {
                        const newHash = require('crypto')
                            .createHash('sha256')
                            .update(require('fs').readFileSync(change.path))
                            .digest('hex');
                        if (newHash !== changedFile.sha256Hash) {
                            changedFile.sha256Hash = newHash;
                            persistence.upsertFile(changedFile);
                            console.log(`[st8] Updated hash for: ${changedFile.filepath}`);
                        }
                    }
                }
                
                // Regenerate manifest
                const { writeManifests } = require('./manifestGenerator');
                writeManifests(result.files, targetDir);
                console.log('[st8] Incremental re-index complete');
            }
        });
        watcher.start();
    }
    
    // Start server if requested
    let server = null;
    if (serveMode) {
        console.log('[st8] Starting HTTP server...');
        server = new St8Server({ port, targetDir });
        server.start();
    }
    
    console.log('');
    console.log('[st8] Ready!');
    console.log('');
    
    // Keep process alive if watching or serving
    if (watchMode || serveMode) {
        process.on('SIGINT', () => {
            console.log('\n[st8] Shutting down...');
            if (watcher) watcher.stop();
            if (server) server.stop();
            persistence.close();
            process.exit(0);
        });
    } else {
        persistence.close();
    }
}

// ─── RUN ─────────────────────────────────────────────────────

main().catch(err => {
    console.error('[st8] Fatal error:', err);
    process.exit(1);
});
