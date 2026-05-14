#!/usr/bin/env node

/**
 * ST8 Schema Card Emitter
 *
 * Generates deterministic .st8/schema-card.json for each file.
 * Called after every index run and on every file change.
 * Schema cards are machine-readable, always in sync, and diffable in git.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { validateSt8SchemaCard, St8SchemaCard } = require('../../shared/types/st8-types');

class SchemaCardEmitter {
    constructor(targetDir, options = {}) {
        this.targetDir = targetDir;
        this.outputDir = options.outputDir || path.join(targetDir, '.st8', 'schema-cards');
        this.strict = options.strict || false;
        this._ensureOutputDir();
    }

    _ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Emit a schema card for a single file.
     * @param {object} file - St8FileEntry with all fields populated
     * @param {object} astResult - Output from astParser.extractImportsAndExports()
     * @param {object} connections - { importedBy: [], imports: [] }
     * @param {object} intent - { purpose, dependsOnBehavior, valueStatement }
     * @param {object} mutationSummary - { count, lastMutation }
     */
    emitCard(file, astResult, connections, intent, mutationSummary) {
        const card = {
            fingerprint: file.fingerprint,
            filepath: file.filepath,
            filename: file.filename,
            sha256Hash: file.sha256Hash,
            fileSizeBytes: file.fileSizeBytes,
            status: file.status,
            reachabilityScore: file.reachabilityScore,
            impactRadius: file.impactRadius,
            lifecyclePhase: file.lifecyclePhase || 'DEVELOPMENT',
            birthTimestamp: file.birthTimestamp,
            lastModified: file.lastModified,
            lastIndexed: file.lastIndexed,
            isEntryPoint: Boolean(file.isEntryPoint),

            exports: (astResult && astResult.exports) || [],
            imports: (astResult && astResult.imports) || [],

            connections: connections || { importedBy: [], imports: [] },
            intent: intent || { purpose: '', dependsOnBehavior: '', valueStatement: '' },

            mutationCount: (mutationSummary && mutationSummary.count) || 0,
            lastMutation: (mutationSummary && mutationSummary.lastMutation) || { type: '', actor: '', timestamp: '' }
        };

        // Validate against canonical shape
        const validation = validateSt8SchemaCard(card);
        if (!validation.valid) {
            console.warn(`[st8:emitter] Schema card validation warning for ${file.filepath}:`, validation.missing);
        }

        // Write deterministic JSON (sorted keys at every level for consistent diffs)
        const outputPath = path.join(this.outputDir, this._cardFilename(file.filepath));
        const sortedReplacer = (key, value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return Object.keys(value).sort().reduce((sorted, k) => {
                    sorted[k] = value[k];
                    return sorted;
                }, {});
            }
            return value;
        };
        fs.writeFileSync(outputPath, JSON.stringify(card, sortedReplacer, 2));

        return card;
    }

    /**
     * Emit schema cards for all files.
     * @param {object} persistence - St8Persistence instance (must be initialized)
     */
    emitAllCards(persistence) {
        // Post-move: ast-parser now lives in src/shared/utils/. The original
        // used a dynamic path.join() that the AST rewriter cannot see.
        const { extractImportsAndExports } = require('../../shared/utils/ast-parser');

        const files = persistence.getAllFiles();
        const allIntents = persistence.getAllIntents();
        let emitted = 0;
        let errors = 0;

        for (const file of files) {
            try {
                const fullPath = path.join(this.targetDir, file.filepath);
                let astResult = { imports: [], exports: [] };

                if (fs.existsSync(fullPath)) {
                    try {
                        astResult = extractImportsAndExports(fullPath);
                    } catch (e) {
                        // AST parsing failed — use empty result
                    }
                }

                // Pick only canonical intent fields (exclude authoredBy, lastUpdated from DB)
                const rawIntent = allIntents[file.fingerprint] || null;
                const intent = rawIntent ? {
                    purpose: rawIntent.purpose || '',
                    dependsOnBehavior: rawIntent.dependsOnBehavior || '',
                    valueStatement: rawIntent.valueStatement || ''
                } : null;
                const mutationCount = persistence.getMutationCount(file.fingerprint);
                const rawLastMutation = persistence.getLastMutation(file.fingerprint);

                // Map SQLite row shape ({mutationType, actor, timestamp, ...})
                // to schema card shape ({type, actor, timestamp})
                const lastMutation = rawLastMutation
                    ? { type: rawLastMutation.mutationType, actor: rawLastMutation.actor, timestamp: rawLastMutation.timestamp }
                    : null;

                // Build connections via persistence API (not direct db access)
                const allConnections = persistence.getConnectionsForFile(file.fingerprint);
                const connections = {
                    importedBy: allConnections.filter(c => c.targetFingerprint === file.fingerprint).map(c => c.sourceFingerprint),
                    imports: allConnections.filter(c => c.sourceFingerprint === file.fingerprint).map(c => c.targetFingerprint)
                };

                this.emitCard(file, astResult, connections, intent, {
                    count: mutationCount,
                    lastMutation: lastMutation || { type: '', actor: '', timestamp: '' }
                });
                emitted++;
            } catch (err) {
                console.error(`[st8:emitter] Error emitting card for ${file.filepath}:`, err.message);
                errors++;
            }
        }

        // Prune stale cards — any .json file in outputDir that doesn't
        // correspond to a current file_registry row is leftover from a
        // previous run with a different target / different file set.
        // Without this sweep, cards-on-disk drift causes FC2 (force-check)
        // and gives gap-analyzer false data (it reads the dir directly).
        let pruned = 0;
        try {
            const validFilenames = new Set(files.map((f) => this._cardFilename(f.filepath)));
            for (const name of fs.readdirSync(this.outputDir)) {
                if (!name.endsWith('.json')) continue;
                if (validFilenames.has(name)) continue;
                fs.unlinkSync(path.join(this.outputDir, name));
                pruned++;
            }
        } catch (err) {
            console.error('[st8:emitter] Card-prune sweep failed:', err.message);
        }

        const pruneNote = pruned > 0 ? `, pruned ${pruned} stale` : '';
        console.log(`[st8:emitter] Emitted ${emitted} schema cards, ${errors} errors${pruneNote}`);
        return { emitted, errors, pruned };
    }

    /**
     * Convert filepath to safe filename for schema card.
     * e.g., "src/core/server/app.js" → "src_core_server_app.js.json"
     */
    _cardFilename(filepath) {
        return filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json';
    }

    /**
     * Diff mode: compare current file state against last emitted schema card.
     * Returns { drift: boolean, differences: [...] }
     */
    diff(file, currentCard) {
        const outputPath = path.join(this.outputDir, this._cardFilename(file.filepath));
        if (!fs.existsSync(outputPath)) {
            return { drift: true, differences: ['No previous schema card found'] };
        }

        const previousCard = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
        const differences = [];

        for (const key of Object.keys(St8SchemaCard)) {
            if (JSON.stringify(previousCard[key]) !== JSON.stringify(currentCard[key])) {
                differences.push({
                    field: key,
                    previous: previousCard[key],
                    current: currentCard[key]
                });
            }
        }

        return { drift: differences.length > 0, differences };
    }
}

// ─── CLI ─────────────────────────────────────────────────────

if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);

        if (args.includes('--diff')) {
            console.log('[st8:emitter] Diff mode not yet available from CLI — use programmatically');
            process.exit(0);
        }

        const targetDir = args[0] || process.cwd();
        const { St8Persistence } = require('../../core/database/persistence');
        const persistence = new St8Persistence();
        await persistence.initialize();

        const emitter = new SchemaCardEmitter(targetDir);
        const result = emitter.emitAllCards(persistence);
        persistence.close();

        process.exit(result.errors > 0 ? 1 : 0);
    })();
}

module.exports = { SchemaCardEmitter };
