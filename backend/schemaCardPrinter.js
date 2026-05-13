#!/usr/bin/env node

/**
 * ST8 Schema Card Printer — Human-Readable Fallback
 *
 * Emits .txt files to .planning/st8_identity_system/ directory.
 * This is the fallback output for when the st8 visual system is offline.
 * Files follow naming convention: {timestamp}_{sanitized-filename}.txt
 *
 * Each file contains:
 * - Identity header (fingerprint, birth timestamp, lifecycle phase)
 * - Content version (sha256Hash)
 * - Exports (name, kind, signature, returnType)
 * - Imports (source, specifiers, importType)
 * - Connections (importedBy, imports)
 * - Intent (purpose, dependsOnBehavior, valueStatement)
 * - Mutation summary (count, last mutation type/actor/timestamp)
 */

'use strict';

const path = require('path');
const fs = require('fs');

class SchemaCardPrinter {
    constructor(targetDir, options = {}) {
        this.targetDir = targetDir;
        // Default output: .planning/st8_identity_system/
        this.outputDir = options.outputDir ||
            path.join(targetDir, '.planning', 'st8_identity_system');
        this._ensureOutputDir();
    }

    _ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Print a schema card as a human-readable .txt file.
     * @param {object} card - St8SchemaCard object
     */
    printCard(card) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = card.filepath.replace(/\//g, '_').replace(/\\/g, '_');
        const filename = `${timestamp}_${safeName}.txt`;
        const outputPath = path.join(this.outputDir, filename);

        const lines = [];

        lines.push('═'.repeat(72));
        lines.push(`  ST8 IDENTITY CARD — ${card.filepath}`);
        lines.push('═'.repeat(72));
        lines.push('');

        // Identity
        lines.push('┌─ IDENTITY ──────────────────────────────────────────────────┐');
        lines.push(`  Fingerprint:      ${card.fingerprint}`);
        lines.push(`  Filepath:         ${card.filepath}`);
        lines.push(`  Filename:         ${card.filename}`);
        lines.push(`  Birth Timestamp:  ${card.birthTimestamp}`);
        lines.push(`  Lifecycle Phase:  ${card.lifecyclePhase}`);
        lines.push(`  Is Entry Point:   ${card.isEntryPoint}`);
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Content Version
        lines.push('┌─ CONTENT VERSION ──────────────────────────────────────────┐');
        lines.push(`  SHA-256 Hash:     ${card.sha256Hash}`);
        lines.push(`  File Size:        ${card.fileSizeBytes} bytes`);
        lines.push(`  Last Modified:    ${card.lastModified}`);
        lines.push(`  Last Indexed:     ${card.lastIndexed}`);
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Classification
        lines.push('┌─ CLASSIFICATION ───────────────────────────────────────────┐');
        lines.push(`  Status:           ${card.status}`);
        lines.push(`  Reachability:     ${card.reachabilityScore}`);
        lines.push(`  Impact Radius:    ${card.impactRadius}`);
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Exports
        lines.push('┌─ EXPORTS ──────────────────────────────────────────────────┐');
        if (card.exports && card.exports.length > 0) {
            for (const exp of card.exports) {
                const sig = exp.signature ? ` — ${exp.signature}` : '';
                const ret = exp.returnType ? `: ${exp.returnType}` : '';
                lines.push(`  ${exp.kind.padEnd(12)} ${exp.name}${sig}${ret}`);
            }
        } else {
            lines.push('  (none)');
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Imports
        lines.push('┌─ IMPORTS ──────────────────────────────────────────────────┐');
        if (card.imports && card.imports.length > 0) {
            for (const imp of card.imports) {
                const names = imp.specifiers && imp.specifiers.length > 0
                    ? ` {${imp.specifiers.map(s => s.name || s).join(', ')}}`
                    : '';
                lines.push(`  ${(imp.importType || 'named').padEnd(12)} ${imp.source}${names}`);
            }
        } else {
            lines.push('  (none)');
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Connections
        lines.push('┌─ CONNECTIONS ──────────────────────────────────────────────┐');
        if (card.connections) {
            if (card.connections.importedBy && card.connections.importedBy.length > 0) {
                lines.push(`  Imported by:      ${card.connections.importedBy.join(', ')}`);
            }
            if (card.connections.imports && card.connections.imports.length > 0) {
                lines.push(`  Imports:          ${card.connections.imports.join(', ')}`);
            }
            if ((!card.connections.importedBy || card.connections.importedBy.length === 0) &&
                (!card.connections.imports || card.connections.imports.length === 0)) {
                lines.push('  (none)');
            }
        } else {
            lines.push('  (none)');
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Intent
        lines.push('┌─ INTENT ───────────────────────────────────────────────────┐');
        if (card.intent) {
            lines.push(`  Purpose:          ${card.intent.purpose || '(not set)'}`);
            lines.push(`  Depends On:       ${card.intent.dependsOnBehavior || '(not set)'}`);
            lines.push(`  Value Statement:  ${card.intent.valueStatement || '(not set)'}`);
        } else {
            lines.push('  (not set)');
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        // Mutations
        lines.push('┌─ MUTATIONS ────────────────────────────────────────────────┐');
        lines.push(`  Total Mutations:  ${card.mutationCount || 0}`);
        if (card.lastMutation && card.lastMutation.type) {
            lines.push(`  Last Mutation:    ${card.lastMutation.type} by ${card.lastMutation.actor}`);
            lines.push(`  Last Timestamp:   ${card.lastMutation.timestamp}`);
        }
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');

        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push('');

        fs.writeFileSync(outputPath, lines.join('\n'));

        // Also write/update a "latest" version (overwrites on each emission)
        const latestPath = path.join(this.outputDir, `LATEST_${safeName}.txt`);
        fs.writeFileSync(latestPath, lines.join('\n'));

        return { path: outputPath, latestPath };
    }

    /**
     * Print all schema cards from .st8/schema-cards/ directory.
     */
    printAllFromCards(schemaCardsDir) {
        if (!fs.existsSync(schemaCardsDir)) {
            console.error('[st8:printer] Schema cards directory not found:', schemaCardsDir);
            return { printed: 0, errors: 0 };
        }

        const files = fs.readdirSync(schemaCardsDir).filter(f => f.endsWith('.json'));
        let printed = 0;
        let errors = 0;

        for (const file of files) {
            try {
                const card = JSON.parse(fs.readFileSync(path.join(schemaCardsDir, file), 'utf-8'));
                this.printCard(card);
                printed++;
            } catch (err) {
                console.error(`[st8:printer] Error printing ${file}:`, err.message);
                errors++;
            }
        }

        console.log(`[st8:printer] Printed ${printed} cards, ${errors} errors`);
        return { printed, errors };
    }
}

module.exports = { SchemaCardPrinter };
