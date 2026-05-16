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
const { indexDirectory } = require('../../features/indexing/indexer');
const { St8Persistence, getSharedPersistence, closeSharedPersistence } = require('../database/persistence');
const { writeManifests } = require('../../features/schema-cards/manifest-generator');
const { FileWatcher } = require('../../features/watcher/file-watcher');
const { St8Server } = require('./app');
const { generateFingerprint, MutationType, ActorType } = require('../../shared/types/st8-types');
const { SchemaCardEmitter } = require('../../features/schema-cards/emitter');
const { SchemaCardPrinter } = require('../../features/schema-cards/printer');
const { notificationBus } = require('../notification-bus');
const { GapAnalyzer } = require('../../features/analysis/gap-analyzer');
const { IntentSeeder } = require('../../features/analysis/intent-seeder');
const { hookRegistry, HOOKS } = require('../hook-registry');
const { registerDefaultSubscribers } = require('../hooks/default-subscribers');
const { registerForceChecks } = require('../hooks/force-checks');

// ─── WATCHER — APPLY FILE CHANGE ─────────────────────────────
// Performs the must-be-inline portion of a file-watcher change: detect
// (hash / read / diff), update the in-memory result.files array, write
// to persistence, and log the mutation. Returns { file, mutation } for
// FILE_AFTER_CHANGE subscribers, or null on a no-op (unlink of unknown,
// change with unchanged hash, read failure).
//
// Lives at module scope (not inside main()) so it can be unit-tested and
// so the watcher orchestrator inside main() stays small. Pure orchestration
// — does NOT emit schema cards, broadcast SSE, or run gap analysis: those
// belong to FILE_AFTER_CHANGE subscribers and the post-batch step.
//
// @param {{path: string, type: 'add'|'change'|'unlink'}} change
// @param {{targetDir: string, persistence: object, resultFiles: object[]}} ctx
// @returns {{file: object, mutation: object} | null}
/**
 * Write a structured summary of the INDEX_COMPLETE subscriber chain to
 * `.st8/index-complete-errors.json`. Ticket 26.
 *
 * The file is overwritten every INDEX_COMPLETE pass, so a clean run
 * truncates the previous run's errors. CI and dashboards that want
 * historical errors should snapshot this file per build.
 *
 * Shape:
 *   {
 *     timestamp: '2026-05-15T...Z',
 *     ok: N,           // count of subscribers that returned cleanly
 *     fail: M,         // count of subscribers that threw
 *     errors: [{ source, error }]  // [] on a clean run
 *   }
 */
async function _writeIndexCompleteSummary(targetDir, summary) {
    const fsp = require('fs').promises;
    const out = {
        timestamp: new Date().toISOString(),
        ok: summary.ok,
        fail: summary.fail,
        errors: summary.errors,
    };
    const dir = path.join(targetDir, '.st8');
    const file = path.join(dir, 'index-complete-errors.json');
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(file, JSON.stringify(out, null, 2) + '\n');
}

function _applyFileChange(change, ctx) {
    const { targetDir, persistence, resultFiles } = ctx;
    const relativePath = path.relative(targetDir, change.path);

    try {
        if (change.type === 'unlink') {
            const idx = resultFiles.findIndex(f => f.filepath === relativePath);
            if (idx === -1) return null;  // unknown unlink — silently drop

            const removed = resultFiles[idx];
            resultFiles.splice(idx, 1);

            const mutation = {
                fingerprint: removed.fingerprint,
                sha256Hash: removed.sha256Hash,
                mutationType: 'DELETE',
                changedFields: JSON.stringify({ filepath: [removed.filepath, null] }),
                actor: ActorType.WATCHER,
                metadata: '{}',
            };
            persistence.logMutation(mutation);
            persistence.deleteFile(removed.filepath);
            console.log(`[st8] Removed deleted file: ${removed.filepath}`);
            return { file: removed, mutation };
        }

        if (change.type === 'add') {
            const fs = require('fs');
            const crypto = require('crypto');
            const { deriveBirthTimestamp } = require('../../shared/utils/birth-timestamp');
            const content = fs.readFileSync(change.path);
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            const stat = fs.statSync(change.path);
            // birthTimestamp is identity-load-bearing. Pass persistence in
            // so a re-added file (deleted then restored within the same st8
            // session) preserves its first-observed birthTimestamp — the
            // identity thread survives the round-trip. See
            // shared/utils/birth-timestamp.js for the full rationale.
            const { birthTimestamp } = deriveBirthTimestamp({
                stat,
                filepath: relativePath,
                persistence,
            });
            const fingerprint = generateFingerprint(relativePath, birthTimestamp);

            const newFile = {
                fingerprint,
                filepath: relativePath,
                filename: path.basename(change.path),
                sha256Hash: hash,
                fileSizeBytes: stat.size,
                lastModified: stat.mtime.toISOString(),
                birthTimestamp,
                imports: [],
                importedBy: [],
                status: 'RED',
                reachabilityScore: 0.0,
                impactRadius: 0,
                lifecyclePhase: 'DEVELOPMENT',
                isEntryPoint: false,
            };

            resultFiles.push(newFile);
            persistence.upsertFile(newFile);

            const mutation = {
                fingerprint,
                sha256Hash: hash,
                mutationType: MutationType.CREATE,
                changedFields: '{}',
                actor: ActorType.WATCHER,
                metadata: '{}',
            };
            persistence.logMutation(mutation);
            return { file: newFile, mutation };
        }

        // change.type === 'change'
        const changedFile = resultFiles.find(f => f.filepath === relativePath);
        if (!changedFile) return null;  // watcher saw a change for an unknown file

        const fs = require('fs');
        const crypto = require('crypto');
        const newHash = crypto.createHash('sha256').update(fs.readFileSync(change.path)).digest('hex');
        if (newHash === changedFile.sha256Hash) return null;  // no real change

        const oldHash = changedFile.sha256Hash;
        changedFile.sha256Hash = newHash;
        changedFile.lastModified = new Date().toISOString();
        persistence.upsertFile(changedFile);

        const mutation = {
            fingerprint: changedFile.fingerprint,
            sha256Hash: newHash,
            mutationType: MutationType.EDIT,
            changedFields: JSON.stringify({ sha256Hash: [oldHash, newHash] }),
            actor: ActorType.WATCHER,
            metadata: '{}',
        };
        persistence.logMutation(mutation);
        return { file: changedFile, mutation };
    } catch (err) {
        console.error(`[st8] _applyFileChange failed for ${relativePath} (${change.type}):`, err.message);
        return null;
    }
}

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
    
    // Initialize persistence via the module-level shared accessor so the
    // indexer, file watcher, and HTTP routes all share ONE St8Persistence
    // instance (and one better-sqlite3 connection) across the process
    // lifetime. Before ticket 7, app.js routes each constructed their own
    // and ran ST8_SCHEMA + introspectSchema per request.
    const persistence = await getSharedPersistence();
    
    // Run initial indexing. Pass the shared persistence in so the indexer
    // can REUSE first-observed birthTimestamps for filepaths it has seen
    // before — preserving the identity thread (mutation_log, intent,
    // connections, tickets) across runs on filesystems where stat.birthtime
    // is unreliable. See src/shared/utils/birth-timestamp.js for the
    // contract (identity-and-analysis ticket 15).
    console.log('[st8] Running initial indexing...');
    const result = await indexDirectory(targetDir, { write: true, persistence });

    // Initialize schema card emitter + printer (hoisted for file watcher access)
    const emitter = new SchemaCardEmitter(targetDir);
    const printer = new SchemaCardPrinter(targetDir);
    notificationBus.setPrinter(printer);

    // Wire st8's built-in modules as default subscribers to the hook
    // registry. After this call, INDEX_COMPLETE will drive manifest
    // generation, schema-card emission, gap analysis, and intent seeding
    // as discrete subscribers instead of inline procedural code.
    registerDefaultSubscribers(hookRegistry);

    // Force-check pass at P=90 — runs after the other 4 subscribers, writes
    // .st8/force-check.md with cross-tool integrity verdicts. Catches
    // emitter/manifest/gap-analyzer drift before it propagates.
    registerForceChecks(hookRegistry);

    // Fire INDEX_START so any future module that wants pre-pass setup
    // (e.g. clear stale .st8/ artifacts) has a hook point.
    await hookRegistry.execute(HOOKS.INDEX_START, { targetDir, persistence });

    // Store in SQLite
    if (result.files && result.files.length > 0) {
        console.log('[st8] Storing results in SQLite...');

        // Pass 0: Prune stale rows. file_registry accumulates across runs
        // (especially when the target dir changes), causing FC3 force-check
        // failures because the manifest is per-run while the registry isn't.
        // Drop any row whose filepath isn't in the current pass's results.
        // Cascades through connections + intent + mutation_log via deleteFile.
        const currentFilepaths = new Set(result.files.map((f) => f.filepath));
        const pruneResult = persistence.pruneFilesNotIn(currentFilepaths);
        if (pruneResult.prunedCount > 0) {
            console.log(`[st8] Pruned ${pruneResult.prunedCount} stale file_registry row(s) from prior runs`);
        }

        // Pass 1: Upsert all files first (so foreign keys exist for connections).
        // Per file, fire FILE_INDEXED so subscribers can react as each file's
        // identity lands in the registry — this is the "identification built
        // into the indexer" hook point (HOOK-ARCHITECTURE-RESEARCH §6).
        //
        // PERF NOTE (Wave 2B + Wave 5G ticket 15): the await below is
        // sequential — each FILE_INDEXED fire is awaited before the next
        // file is upserted. With ZERO default subscribers this is a no-op
        // path; HookRegistry.execute() short-circuits to {ok:0,fail:0} when
        // both _hooks map and EventEmitter listenerCount are empty, saving
        // Promise allocation + microtask flush. Wave 2B measured the
        // entire 281-file fire chain at 0.82 ms (sub-millisecond per
        // fire). Conclusion: DO NOT parallelise this loop unless a future
        // subscriber introduces a real per-file bottleneck. Parallelism
        // here would break ordered persistence reads (subscribers may
        // observe the DB after each upsert) and would NOT save measurable
        // wall-clock on the current zero-subscriber path. When the first
        // subscriber blocks > 5 ms per fire this becomes a real
        // bottleneck — at that point batch via a BULK_INDEXED hook
        // (sketch in docs/_pending-roadmap/server-api-and-legacy-frontend.md).
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

            // Hook: file's identity has landed. No default subscribers yet, but
            // this is the extension point for Louis lock checks, real-time UI
            // updates, etc.
            await hookRegistry.execute(HOOKS.FILE_INDEXED, { file, targetDir, persistence });
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

        // Fire the INDEX_COMPLETE hook — built-in subscribers (registered
        // above via registerDefaultSubscribers) handle manifest generation,
        // schema-card emission, gap analysis, and intent seeding. Any future
        // module can register additional handlers without touching main.js.
        //
        // Ticket 26: surface aggregated subscriber errors. Previously the
        // execute() summary was discarded — a failure in any subscriber
        // (e.g. manifest-generator) was visible only in scrollback as a
        // generic `[hooks] "index:complete" subscriber "<name>" threw:` log
        // line. Now we both log a one-line summary AND write a structured
        // error block to .st8/index-complete-errors.json (truncated on a
        // clean run) so a downstream consumer (CI, dashboard, the
        // force-check report itself) has a machine-readable view.
        const indexCompleteSummary = await hookRegistry.execute(HOOKS.INDEX_COMPLETE, {
            result,
            targetDir,
            persistence,
            emitter,
            printer,
        });
        try {
            await _writeIndexCompleteSummary(targetDir, indexCompleteSummary);
        } catch (writeErr) {
            console.error('[st8] Failed to write index-complete summary:', writeErr.message);
        }
        if (indexCompleteSummary.fail > 0) {
            console.error(
                `[st8] INDEX_COMPLETE finished with ${indexCompleteSummary.fail} subscriber error(s):`
            );
            for (const e of indexCompleteSummary.errors) {
                console.error(`[st8]   - ${e.source}: ${e.error}`);
            }
            console.error('[st8] See .st8/index-complete-errors.json for the full report.');
        }
    }
    
    // Start file watcher if requested
    const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go', '.md', '.txt', '.json']);
    let watcher = null;
    if (watchMode) {
        console.log('[st8] Starting file watcher...');
        watcher = new FileWatcher(targetDir, {
            debounceMs: 500,
            // Thin orchestrator — fires FILE_BEFORE_CHANGE + FILE_AFTER_CHANGE
            // per code change, runs the must-be-inline persistence write
            // between them, then runs the post-batch manifest/intent/gap
            // regen once (the latter three are batch-shaped, not per-change,
            // so they don't fit FILE_AFTER_CHANGE subscribers cleanly — kept
            // inline by design, documented in residualConcerns).
            onFileChange: async (changes) => {
                const codeChanges = changes.filter(c => CODE_EXTENSIONS.has(path.extname(c.path).toLowerCase()));
                if (codeChanges.length === 0) return;
                console.log(`[st8] Code files changed: ${codeChanges.length}`);

                let anyChanged = false;
                for (const change of codeChanges) {
                    // Hook 1: FILE_BEFORE_CHANGE — fired before any inline
                    // work. Subscribers can read change.path/type/etc. but
                    // cannot yet see the resolved file row (it may not
                    // exist or its hash may be pre-edit).
                    await hookRegistry.execute(HOOKS.FILE_BEFORE_CHANGE, { change, targetDir, persistence });

                    // Must-be-inline work: detect → mutate result.files →
                    // persistence write → mutation log. Encapsulated as a
                    // helper so the orchestrator stays small. Returns
                    // { file, mutation } when the change has effect, or
                    // null on no-op (unlink of unknown / change w/ same
                    // hash / read failure). On no-op, FILE_AFTER_CHANGE
                    // still fires with file:null so subscribers can
                    // observe attempted-but-skipped changes.
                    const applied = _applyFileChange(change, {
                        targetDir, persistence, resultFiles: result.files,
                    });

                    if (applied) anyChanged = true;

                    // Hook 2: FILE_AFTER_CHANGE — fired after the persistence
                    // write commits. Default subscribers handle schema-card
                    // emission (P=20) and SSE broadcast (P=30) — see
                    // src/core/hooks/default-subscribers.js.
                    await hookRegistry.execute(HOOKS.FILE_AFTER_CHANGE, {
                        change,
                        file: applied ? applied.file : null,
                        mutation: applied ? applied.mutation : null,
                        schemaCard: null,           // emitted by P=20 subscriber, not pre-populated
                        targetDir,
                        persistence,
                        emitter,                    // P=20 needs the emitter handle
                    });
                }

                // Batch post-loop: manifest + intent-seeding + gap-analysis.
                // These are batch-shaped (idempotent over the full file set)
                // — running them per FILE_AFTER_CHANGE would re-process the
                // entire project N times for an N-file change batch. Kept
                // inline by design; see residualConcerns on ticket 6 for the
                // tradeoff and the future batched-hook option.
                if (anyChanged) {
                    writeManifests(result.files, targetDir);
                    console.log('[st8] Incremental re-index complete');

                    try {
                        const schemaCardsDir = path.join(targetDir, '.st8', 'schema-cards');
                        const seeder = new IntentSeeder(persistence, schemaCardsDir, targetDir);
                        seeder.seedAll();
                    } catch (err) {
                        console.error('[st8] Incremental intent seeding failed:', err.message);
                    }

                    try {
                        const schemaCardsDir = path.join(targetDir, '.st8', 'schema-cards');
                        const analyzer = new GapAnalyzer(schemaCardsDir, persistence);
                        analyzer.writeReport(path.join(targetDir, '.st8', 'gap-analysis.md'));
                    } catch (err) {
                        console.error('[st8] Incremental gap analysis failed:', err.message);
                    }
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
            // closeSharedPersistence() also clears the module-level cache so
            // any post-SIGINT getSharedPersistence() call would re-open
            // cleanly (defensive against a future hot-reload mode).
            closeSharedPersistence();
            process.exit(0);
        });
    } else {
        closeSharedPersistence();
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────
// Module-level helpers exported for unit testing. main() itself is
// exported too so a test runner could in principle drive a full boot
// (today none does — keep this surface small).
module.exports = {
    main,
    _applyFileChange,
    _writeIndexCompleteSummary,
};

// ─── RUN ─────────────────────────────────────────────────────
// Auto-run main() ONLY when this file is invoked directly (e.g.
// `node src/core/server/main.js <targetDir>`), not when it is
// `require()`'d from a test. require.main === module is the canonical
// "am I the entry point" check.
if (require.main === module) {
    main().catch(err => {
        console.error('[st8] Fatal error:', err);
        process.exit(1);
    });
}
