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
const { generateFingerprint, MutationType, ActorType } = require('./st8-types');
const { SchemaCardEmitter } = require('./schemaCardEmitter');
const { SchemaCardPrinter } = require('./schemaCardPrinter');
const { notificationBus } = require('./notificationBus');

// ─── GLOBAL ERROR HANDLERS ───────────────────────────────────
// Prevent process crash from unhandled rejections

process.on('unhandledRejection', (reason, promise) => {
    console.error('[st8] Unhandled Promise Rejection:', reason);
    // Don't crash — log and continue
});

process.on('uncaughtException', (err) => {
    console.error('[st8] Uncaught Exception:', err.message);
    // For uncaught exceptions, we should exit gracefully
    process.exit(1);
});

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

    // Initialize schema card emitter + printer (hoisted for file watcher access)
    const emitter = new SchemaCardEmitter(targetDir);
    const printer = new SchemaCardPrinter(targetDir);
    notificationBus.setPrinter(printer);
    
    // Store in SQLite
    if (result.files && result.files.length > 0) {
        console.log('[st8] Storing results in SQLite...');

        // Pass 1: Upsert all files first (so foreign keys exist for connections)
        for (const file of result.files) {
            persistence.upsertFile({
                fingerprint: file.fingerprint,     // NOW uses stable identity
                filepath: file.filepath,
                filename: file.filename,
                sha256Hash: file.sha256Hash,
                fileSizeBytes: file.fileSizeBytes,
                status: file.status,
                reachabilityScore: file.reachabilityScore,
                impactRadius: file.impactRadius,
                lifecyclePhase: file.lifecyclePhase || 'DEVELOPMENT',
                birthTimestamp: file.birthTimestamp || new Date().toISOString(),
                lastModified: file.lastModified,
                isEntryPoint: false
            });

            // Log CREATE mutation for each file
            persistence.logMutation({
                fingerprint: file.fingerprint,
                sha256Hash: file.sha256Hash,
                mutationType: MutationType.CREATE,
                changedFields: '{}',
                actor: ActorType.INDEXER,
                metadata: '{}'
            });
        }

        // Pass 2: Wire connections (all files now exist in DB)
        for (const file of result.files) {
            if (file.imports && file.imports.length > 0) {
                for (const imp of file.imports) {
                    const targetFile = result.files.find(f =>
                        f.filepath.endsWith(imp.source) ||
                        f.filepath.includes(imp.source.replace(/^\.\//, ''))
                    );
                    if (targetFile) {
                        persistence.insertConnection({
                            sourceFingerprint: file.fingerprint,
                            targetFingerprint: targetFile.fingerprint,
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
            source: ActorType.INDEXER,
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

        // Emit schema cards
        emitter.emitAllCards(persistence);
        printer.printAllFromCards(path.join(targetDir, '.st8', 'schema-cards'));
        console.log('[st8] Schema cards emitted');
    }
    
    // Start file watcher if requested
    const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go']);
    let watcher = null;
    if (watchMode) {
        console.log('[st8] Starting file watcher...');
        watcher = new FileWatcher(targetDir, {
            debounceMs: 500,
            onFileChange: async (changes) => {
                // Filter to only process code files
                const codeChanges = changes.filter(c => {
                    const ext = path.extname(c.path).toLowerCase();
                    return CODE_EXTENSIONS.has(ext);
                });
                
                if (codeChanges.length === 0) return;
                
                console.log(`[st8] Code files changed: ${codeChanges.length}`);
                
                let anyChanged = false;
                
                for (const change of codeChanges) {
                    const relativePath = path.relative(targetDir, change.path);
                    
                    if (change.type === 'unlink') {
                        // DELETE PATH — remove from array and DB without reading file
                        try {
                            const idx = result.files.findIndex(f => f.filepath === relativePath);
                            if (idx !== -1) {
                                const removed = result.files[idx];
                                result.files.splice(idx, 1);
                                persistence.deleteFile(removed.filepath);
                                anyChanged = true;
                                console.log(`[st8] Removed deleted file: ${removed.filepath}`);
                            }
                        } catch (err) {
                            console.error(`[st8] Failed to remove file ${relativePath}:`, err.message);
                        }
                    } else if (change.type === 'add') {
                        try {
                            const content = require('fs').readFileSync(change.path);
                            const hash = require('crypto').createHash('sha256').update(content).digest('hex');
                            const stat = require('fs').statSync(change.path);
                            const birthTimestamp = stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString();
                            const fingerprint = generateFingerprint(relativePath, birthTimestamp);

                            const newFile = {
                                fingerprint: fingerprint,
                                filepath: relativePath,
                                filename: path.basename(change.path),
                                sha256Hash: hash,
                                fileSizeBytes: stat.size,
                                lastModified: stat.mtime.toISOString(),
                                birthTimestamp: birthTimestamp,
                                imports: [],
                                importedBy: [],
                                status: 'RED',
                                reachabilityScore: 0.0,
                                impactRadius: 0,
                                lifecyclePhase: 'DEVELOPMENT',
                                isEntryPoint: false
                            };

                            result.files.push(newFile);
                            persistence.upsertFile(newFile);

                            persistence.logMutation({
                                fingerprint: fingerprint,
                                sha256Hash: hash,
                                mutationType: MutationType.CREATE,
                                changedFields: '{}',
                                actor: ActorType.WATCHER,
                                metadata: '{}'
                            });

                            notificationBus.publish({
                                fingerprint: fingerprint,
                                filepath: relativePath,
                                mutationType: MutationType.CREATE,
                                actor: ActorType.WATCHER,
                                sha256Hash: hash
                            });

                            anyChanged = true;
                        } catch (err) {
                            console.error(`[st8] Failed to index new file ${relativePath}:`, err.message);
                        }
                    } else {
                        const changedFile = result.files.find(f => f.filepath === relativePath);
                        if (changedFile) {
                            try {
                                const newHash = require('crypto')
                                    .createHash('sha256')
                                    .update(require('fs').readFileSync(change.path))
                                    .digest('hex');
                                if (newHash !== changedFile.sha256Hash) {
                                    const oldHash = changedFile.sha256Hash;
                                    changedFile.sha256Hash = newHash;
                                    changedFile.lastModified = new Date().toISOString();
                                    persistence.upsertFile(changedFile);

                                    persistence.logMutation({
                                        fingerprint: changedFile.fingerprint,
                                        sha256Hash: newHash,
                                        mutationType: MutationType.EDIT,
                                        changedFields: JSON.stringify({ sha256Hash: [oldHash, newHash] }),
                                        actor: ActorType.WATCHER,
                                        metadata: '{}'
                                    });

                                    notificationBus.publish({
                                        fingerprint: changedFile.fingerprint,
                                        filepath: relativePath,
                                        mutationType: MutationType.EDIT,
                                        actor: ActorType.WATCHER,
                                        sha256Hash: newHash
                                    });

                                    // Extract AST before emitting schema card
                                    const fullPath = path.join(targetDir, changedFile.filepath);
                                    let astResult = { imports: [], exports: [] };
                                    try {
                                        const { extractImportsAndExports } = require(path.join(__dirname, '..', 'lib', 'utils', 'astParser.js'));
                                        astResult = extractImportsAndExports(fullPath);
                                    } catch (e) { /* AST parse failed - use empty */ }

                                    // Emit updated schema card
                                    const lastMutation = persistence.getLastMutation(changedFile.fingerprint);
                                    const card = emitter.emitCard(changedFile, astResult,
                                        { importedBy: [], imports: [] }, null,
                                        { count: persistence.getMutationCount(changedFile.fingerprint),
                                          lastMutation: lastMutation ? { type: lastMutation.mutationType, actor: lastMutation.actor, timestamp: lastMutation.timestamp } : { type: '', actor: '', timestamp: '' } });

                                    anyChanged = true;
                                }
                            } catch (err) {
                                console.error(`[st8] Failed to hash ${relativePath}:`, err.message);
                            }
                        }
                    }
                }
                
                // Only regenerate manifest if something actually changed
                if (anyChanged) {
                    const { writeManifests } = require('./manifestGenerator');
                    writeManifests(result.files, targetDir);
                    console.log('[st8] Incremental re-index complete');
                }
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
