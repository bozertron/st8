#!/usr/bin/env node

/**
 * gapAnalyzer.js — 6-Dimension Gap Analysis Engine
 *
 * Analyzes schema cards across 6 dimensions to identify gaps in:
 * - D1: Lifecycle Progression
 * - D2: Status Health
 * - D3: Intent Authoring
 * - D4: Export Surface
 * - D5: Connection Integrity
 * - D6: Architectural Completeness
 *
 * @module features/analysis/gap-analyzer
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * GapAnalyzer — 6-dimension gap analysis engine
 */
class GapAnalyzer {
    /**
     * @param {string} schemaCardsDir - Path to schema-cards directory
     * @param {object} persistence - St8Persistence instance
     * @param {object} options - Optional configuration
     * @param {string} options.prdPath - Path to PRD file for D6 analysis
     */
    constructor(schemaCardsDir, persistence, options = {}) {
        this.schemaCardsDir = schemaCardsDir;
        this.persistence = persistence;
        this.prdPath = options.prdPath || null;
    }

    /**
     * Load all schema cards from the directory
     * @returns {Array<object>} Parsed schema cards
     */
    _loadCards() {
        try {
            if (!fs.existsSync(this.schemaCardsDir)) {
                console.warn(`[gapAnalyzer] Schema cards directory not found: ${this.schemaCardsDir}`);
                return [];
            }

            const files = fs.readdirSync(this.schemaCardsDir)
                .filter(f => f.endsWith('.json'));

            const cards = [];
            for (const file of files) {
                try {
                    const filePath = path.join(this.schemaCardsDir, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const card = JSON.parse(content);
                    cards.push(card);
                } catch (err) {
                    console.error(`[gapAnalyzer] Error parsing ${file}: ${err.message}`);
                }
            }

            return cards;
        } catch (err) {
            console.error(`[gapAnalyzer] Failed to load schema cards: ${err.message}`);
            return [];
        }
    }

    /**
     * Run full 6-dimension gap analysis
     * @returns {object} Complete GapReport
     */
    analyze() {
        const cards = this._loadCards();
        const timestamp = new Date().toISOString();

        return {
            timestamp,
            totalCards: cards.length,
            D1_lifecycle: this._analyzeLifecycle(cards),
            D2_status: this._analyzeStatus(cards),
            D3_intent: this._analyzeIntent(cards),
            D4_exports: this._analyzeExports(cards),
            D5_connections: this._analyzeConnections(cards),
            D6_architecture: this._analyzeArchitecture(cards)
        };
    }

    /**
     * D1: Lifecycle Progression
     * Read lifecyclePhase from each card, count files in each phase,
     * identify files that can progress (have intent)
     */
    _analyzeLifecycle(cards) {
        const phases = {};
        const canProgress = [];

        for (const card of cards) {
            const phase = card.lifecyclePhase || 'UNKNOWN';
            if (!phases[phase]) {
                phases[phase] = { count: 0, files: [] };
            }
            phases[phase].count++;
            phases[phase].files.push(card.filepath);

            // Files with intent can progress to next phase
            const hasIntent = card.intent &&
                (card.intent.purpose || card.intent.valueStatement);
            if (hasIntent && phase !== 'PRODUCTION') {
                canProgress.push({
                    filepath: card.filepath,
                    currentPhase: phase,
                    hasPurpose: !!card.intent.purpose,
                    hasValueStatement: !!card.intent.valueStatement
                });
            }
        }

        return {
            phaseDistribution: phases,
            canProgressCount: canProgress.length,
            canProgress,
            summary: `Found ${cards.length} files across ${Object.keys(phases).length} lifecycle phases. ${canProgress.length} files have intent and can progress.`
        };
    }

    /**
     * D2: Status Health
     * Read status + reachabilityScore, list RED files with potential root causes,
     * list GREEN files with low reachability
     */
    _analyzeStatus(cards) {
        const statusCounts = {};
        const redFiles = [];
        const greenLowReachability = [];
        const yellowFiles = [];

        for (const card of cards) {
            const status = card.status || 'UNKNOWN';
            if (!statusCounts[status]) {
                statusCounts[status] = { count: 0, files: [] };
            }
            statusCounts[status].count++;
            statusCounts[status].files.push(card.filepath);

            // RED files — identify potential root causes
            if (status === 'RED') {
                const rootCauses = [];
                const importedBy = card.connections?.importedBy || [];
                if (importedBy.length === 0) {
                    rootCauses.push('No importers — orphan file');
                }
                const hasExports = card.exports && card.exports.length > 0;
                if (!hasExports) {
                    rootCauses.push('No exports — cannot be consumed');
                }
                redFiles.push({
                    filepath: card.filepath,
                    reachabilityScore: card.reachabilityScore || 0,
                    rootCauses
                });
            }

            // GREEN files with low reachability
            if (status === 'GREEN' && (card.reachabilityScore || 0) < 0.3) {
                greenLowReachability.push({
                    filepath: card.filepath,
                    reachabilityScore: card.reachabilityScore || 0,
                    importedBy: card.connections?.importedBy || []
                });
            }

            // YELLOW files
            if (status === 'YELLOW') {
                yellowFiles.push({
                    filepath: card.filepath,
                    reachabilityScore: card.reachabilityScore || 0
                });
            }
        }

        return {
            statusCounts,
            redFileCount: redFiles.length,
            redFiles,
            greenLowReachabilityCount: greenLowReachability.length,
            greenLowReachability,
            yellowFileCount: yellowFiles.length,
            yellowFiles,
            summary: `Status distribution: ${Object.entries(statusCounts).map(([s, d]) => `${s}=${d.count}`).join(', ')}. ${redFiles.length} RED files, ${greenLowReachability.length} GREEN with low reachability.`
        };
    }

    /**
     * D3: Intent Authoring
     * Read intent from each card, count files with purpose vs "(not set)",
     * group by directory
     */
    _analyzeIntent(cards) {
        const directoryGroups = {};
        let withPurpose = 0;
        let withoutPurpose = 0;
        const unauthored = [];

        for (const card of cards) {
            const dir = path.dirname(card.filepath || '');
            if (!directoryGroups[dir]) {
                directoryGroups[dir] = { total: 0, withIntent: 0, withoutIntent: 0, files: [] };
            }
            directoryGroups[dir].total++;

            const hasPurpose = card.intent &&
                card.intent.purpose &&
                card.intent.purpose.trim() !== '' &&
                card.intent.purpose !== '(not set)';

            if (hasPurpose) {
                withPurpose++;
                directoryGroups[dir].withIntent++;
            } else {
                withoutPurpose++;
                directoryGroups[dir].withoutIntent++;
                unauthored.push({
                    filepath: card.filepath,
                    hasPurpose: false,
                    hasValueStatement: !!(card.intent?.valueStatement)
                });
            }

            directoryGroups[dir].files.push({
                filepath: card.filepath,
                hasPurpose
            });
        }

        return {
            totalFiles: cards.length,
            withPurpose,
            withoutPurpose,
            intentCoverage: cards.length > 0 ? (withPurpose / cards.length * 100).toFixed(1) + '%' : '0%',
            directoryGroups,
            unauthoredCount: unauthored.length,
            unauthored,
            summary: `Intent coverage: ${withPurpose}/${cards.length} files have purpose (${cards.length > 0 ? (withPurpose / cards.length * 100).toFixed(1) : 0}%). ${unauthored.length} files lack intent.`
        };
    }

    /**
     * D4: Export Surface
     * Read exports from each card, count files with exports vs empty,
     * note CommonJS vs ES6
     */
    _analyzeExports(cards) {
        let withExports = 0;
        let withoutExports = 0;
        const exportDetails = [];
        const commonJsFiles = [];
        const es6Files = [];

        for (const card of cards) {
            const exports = card.exports || [];
            const hasExports = exports.length > 0;

            if (hasExports) {
                withExports++;
                exportDetails.push({
                    filepath: card.filepath,
                    exportCount: exports.length,
                    exports: exports.map(e => ({
                        name: e.name || 'default',
                        kind: e.kind || 'unknown'
                    }))
                });

                // Detect module type from imports
                const imports = card.imports || [];
                const hasRequire = imports.some(i => i.importType === 'require');
                const hasImport = imports.some(i => i.importType === 'import');

                if (hasRequire && !hasImport) {
                    commonJsFiles.push(card.filepath);
                } else if (hasImport) {
                    es6Files.push(card.filepath);
                }
            } else {
                withoutExports++;
            }
        }

        return {
            totalFiles: cards.length,
            withExports,
            withoutExports,
            exportCoverage: cards.length > 0 ? (withExports / cards.length * 100).toFixed(1) + '%' : '0%',
            commonJsCount: commonJsFiles.length,
            es6Count: es6Files.length,
            commonJsFiles,
            es6Files,
            exportDetails,
            summary: `Export coverage: ${withExports}/${cards.length} files export (${cards.length > 0 ? (withExports / cards.length * 100).toFixed(1) : 0}%). ${commonJsFiles.length} CommonJS, ${es6Files.length} ES6 modules.`
        };
    }

    /**
     * D5: Connection Integrity
     * Read connections from each card, verify imports resolve to existing files,
     * find orphan imports
     */
    _analyzeConnections(cards) {
        // Build a set of all known filepaths
        const knownPaths = new Set(cards.map(c => c.filepath));
        const orphanImports = [];
        let totalImports = 0;
        let resolvedConnections = 0;
        let totalImportedBy = 0;
        const connectionGraph = {};

        for (const card of cards) {
            const connections = card.connections || {};
            const imports = connections.imports || [];
            const importedBy = connections.importedBy || [];

            totalImports += imports.length;
            totalImportedBy += importedBy.length;

            connectionGraph[card.filepath] = {
                imports: imports.length,
                importedBy: importedBy.length
            };

            // Check each import target
            for (const importEntry of imports) {
                // Import entries in connections.imports are fingerprints like "src/core/server/app.js||timestamp"
                // We need to extract the filepath part
                const separatorIndex = importEntry.indexOf('||');
                const importPath = separatorIndex !== -1
                    ? importEntry.substring(0, separatorIndex)
                    : importEntry;

                if (knownPaths.has(importPath)) {
                    resolvedConnections++;
                } else {
                    orphanImports.push({
                        source: card.filepath,
                        target: importPath,
                        targetFingerprint: importEntry
                    });
                }
            }
        }

        // Find isolated files (no connections at all)
        const isolated = cards.filter(c => {
            const conns = c.connections || {};
            return (!conns.imports || conns.imports.length === 0) &&
                   (!conns.importedBy || conns.importedBy.length === 0);
        }).map(c => c.filepath);

        return {
            totalFiles: cards.length,
            totalImports,
            totalImportedBy,
            resolvedConnections,
            orphanCount: orphanImports.length,
            orphanImports,
            isolatedCount: isolated.length,
            isolatedFiles: isolated,
            connectionGraph,
            summary: `Connection integrity: ${resolvedConnections}/${totalImports} imports resolve. ${orphanImports.length} orphan imports, ${isolated.length} isolated files.`
        };
    }

    /**
     * D6: Architectural Completeness
     * Check for required endpoints, SSE integration, PRD generation
     */
    _analyzeArchitecture(cards) {
        // Required API endpoints for ST8 and the module that handles each.
        // Paths updated post-refactor to point at the new src/ tree.
        const endpointModuleMap = {
            '/api/health': null,                                            // Self-contained in server
            '/api/index': 'src/features/indexing/indexer.js',
            '/api/file-intent': 'src/core/database/persistence.js',
            '/api/settings': 'src/core/database/persistence.js',
            '/api/verify': 'src/core/database/persistence.js',
            '/api/files': 'src/features/indexing/indexer.js',
            '/api/mutations': 'src/core/database/persistence.js',
            '/api/concept-file': 'src/core/database/persistence.js',
            '/api/mvp-lock': 'src/core/database/persistence.js',
            '/api/prd': 'src/features/prd/generator.js',
            '/api/production-promote': 'src/core/database/persistence.js',
            '/api/gap-analysis': 'src/features/analysis/gap-analyzer.js',
            '/api/connection-state.json': 'src/core/database/persistence.js',
            '/api/ai-signal.toml': 'src/core/database/persistence.js'
        };

        const requiredEndpoints = Object.keys(endpointModuleMap);

        // Build set of known filepaths for module resolution
        const knownPaths = new Set(cards.map(c => c.filepath));

        // Check which endpoints have their handler modules present
        const foundEndpoints = [];
        const missingEndpoints = [];

        for (const endpoint of requiredEndpoints) {
            const handlerModule = endpointModuleMap[endpoint];
            if (handlerModule === null) {
                // Self-contained endpoints (like /api/health) require only the server
                foundEndpoints.push(endpoint);
            } else if (knownPaths.has(handlerModule)) {
                foundEndpoints.push(endpoint);
            } else {
                missingEndpoints.push({
                    endpoint,
                    requiredModule: handlerModule
                });
            }
        }

        // Check for SSE integration
        const hasSSE = cards.some(c => c.filepath === 'src/core/notification-bus.js');

        // Check for PRD generation
        const hasPRD = cards.some(c => c.filepath === 'src/features/prd/generator.js');

        // Check for key architectural components
        const architecturalComponents = {
            persistence: cards.some(c => c.filepath === 'src/core/database/persistence.js'),
            indexer: cards.some(c => c.filepath === 'src/features/indexing/indexer.js'),
            fileWatcher: cards.some(c => c.filepath === 'src/features/watcher/file-watcher.js'),
            schemaCardEmitter: cards.some(c => c.filepath === 'src/features/schema-cards/emitter.js'),
            notificationBus: cards.some(c => c.filepath === 'src/core/notification-bus.js'),
            server: cards.some(c => c.filepath === 'src/core/server/app.js'),
            prdGenerator: cards.some(c => c.filepath === 'src/features/prd/generator.js'),
            manifestGenerator: cards.some(c => c.filepath === 'src/features/schema-cards/manifest-generator.js')
        };

        const componentCount = Object.values(architecturalComponents).filter(Boolean).length;
        const totalComponents = Object.keys(architecturalComponents).length;

        return {
            requiredEndpoints,
            foundEndpoints,
            missingEndpoints,
            endpointCoverage: `${foundEndpoints.length}/${requiredEndpoints.length}`,
            endpointCoveragePercent: (foundEndpoints.length / requiredEndpoints.length * 100).toFixed(1) + '%',
            hasSSE,
            hasPRD,
            architecturalComponents,
            componentCoverage: `${componentCount}/${totalComponents}`,
            componentCoveragePercent: (componentCount / totalComponents * 100).toFixed(1) + '%',
            summary: `Architecture: ${componentCount}/${totalComponents} components present. SSE: ${hasSSE ? 'yes' : 'no'}. PRD generation: ${hasPRD ? 'yes' : 'no'}. Endpoints: ${foundEndpoints.length}/${requiredEndpoints.length} covered.`
        };
    }

    /**
     * Convert GapReport to Markdown format
     * @param {object} report - GapReport from analyze()
     * @returns {string} Markdown formatted report
     */
    toMarkdown(report) {
        const lines = [];

        lines.push('# ST8 Gap Analysis Report');
        lines.push('');
        lines.push(`**Generated:** ${report.timestamp}`);
        lines.push(`**Total Schema Cards:** ${report.totalCards}`);
        lines.push('');

        // D1: Lifecycle Progression
        lines.push('## D1: Lifecycle Progression');
        lines.push('');
        lines.push(report.D1_lifecycle.summary);
        lines.push('');
        lines.push('### Phase Distribution');
        lines.push('');
        lines.push('| Phase | Count | Files |');
        lines.push('|-------|-------|-------|');
        for (const [phase, data] of Object.entries(report.D1_lifecycle.phaseDistribution)) {
            lines.push(`| ${phase} | ${data.count} | ${data.files.slice(0, 3).join(', ')}${data.files.length > 3 ? '...' : ''} |`);
        }
        lines.push('');
        if (report.D1_lifecycle.canProgress.length > 0) {
            lines.push('### Files Ready to Progress');
            lines.push('');
            for (const file of report.D1_lifecycle.canProgress) {
                lines.push(`- \`${file.filepath}\` — Phase: ${file.currentPhase}`);
            }
            lines.push('');
        }

        // D2: Status Health
        lines.push('## D2: Status Health');
        lines.push('');
        lines.push(report.D2_status.summary);
        lines.push('');
        if (report.D2_status.redFiles.length > 0) {
            lines.push('### RED Files');
            lines.push('');
            lines.push('| File | Reachability | Root Causes |');
            lines.push('|------|--------------|-------------|');
            for (const file of report.D2_status.redFiles.slice(0, 20)) {
                const causes = file.rootCauses.join('; ') || 'Unknown';
                lines.push(`| \`${file.filepath}\` | ${file.reachabilityScore} | ${causes} |`);
            }
            if (report.D2_status.redFiles.length > 20) {
                lines.push(`| ... | ... | *${report.D2_status.redFiles.length - 20} more* |`);
            }
            lines.push('');
        }
        if (report.D2_status.greenLowReachability.length > 0) {
            lines.push('### GREEN Files with Low Reachability');
            lines.push('');
            for (const file of report.D2_status.greenLowReachability.slice(0, 10)) {
                lines.push(`- \`${file.filepath}\` — Score: ${file.reachabilityScore}`);
            }
            lines.push('');
        }

        // D3: Intent Authoring
        lines.push('## D3: Intent Authoring');
        lines.push('');
        lines.push(report.D3_intent.summary);
        lines.push('');
        lines.push('### Coverage by Directory');
        lines.push('');
        lines.push('| Directory | Total | With Intent | Coverage |');
        lines.push('|-----------|-------|-------------|----------|');
        for (const [dir, data] of Object.entries(report.D3_intent.directoryGroups)) {
            const coverage = data.total > 0 ? (data.withIntent / data.total * 100).toFixed(0) + '%' : '0%';
            lines.push(`| ${dir} | ${data.total} | ${data.withIntent} | ${coverage} |`);
        }
        lines.push('');

        // D4: Export Surface
        lines.push('## D4: Export Surface');
        lines.push('');
        lines.push(report.D4_exports.summary);
        lines.push('');
        if (report.D4_exports.exportDetails.length > 0) {
            lines.push('### Files with Exports');
            lines.push('');
            lines.push('| File | Export Count | Exports |');
            lines.push('|------|--------------|---------|');
            for (const file of report.D4_exports.exportDetails.slice(0, 15)) {
                const exports = file.exports.map(e => e.name).join(', ');
                lines.push(`| \`${file.filepath}\` | ${file.exportCount} | ${exports} |`);
            }
            lines.push('');
        }

        // D5: Connection Integrity
        lines.push('## D5: Connection Integrity');
        lines.push('');
        lines.push(report.D5_connections.summary);
        lines.push('');
        if (report.D5_connections.orphanImports.length > 0) {
            lines.push('### Orphan Imports');
            lines.push('');
            lines.push('| Source | Target |');
            lines.push('|--------|--------|');
            for (const orphan of report.D5_connections.orphanImports.slice(0, 20)) {
                lines.push(`| \`${orphan.source}\` | \`${orphan.target}\` |`);
            }
            if (report.D5_connections.orphanImports.length > 20) {
                lines.push(`| ... | *${report.D5_connections.orphanImports.length - 20} more* |`);
            }
            lines.push('');
        }
        if (report.D5_connections.isolatedFiles.length > 0) {
            lines.push('### Isolated Files (No Connections)');
            lines.push('');
            for (const file of report.D5_connections.isolatedFiles) {
                lines.push(`- \`${file}\``);
            }
            lines.push('');
        }

        // D6: Architectural Completeness
        lines.push('## D6: Architectural Completeness');
        lines.push('');
        lines.push(report.D6_architecture.summary);
        lines.push('');
        lines.push('### Endpoint Coverage');
        lines.push('');
        lines.push(`**Coverage:** ${report.D6_architecture.endpointCoverage} (${report.D6_architecture.endpointCoveragePercent})`);
        lines.push('');
        if (report.D6_architecture.missingEndpoints.length > 0) {
            lines.push('### Missing Endpoints');
            lines.push('');
            lines.push('| Endpoint | Required Module |');
            lines.push('|----------|-----------------|');
            for (const ep of report.D6_architecture.missingEndpoints) {
                lines.push(`| \`${ep.endpoint}\` | \`${ep.requiredModule}\` |`);
            }
            lines.push('');
        }
        lines.push('### Component Status');
        lines.push('');
        lines.push('| Component | Present |');
        lines.push('|-----------|---------|');
        for (const [comp, present] of Object.entries(report.D6_architecture.architecturalComponents)) {
            lines.push(`| ${comp} | ${present ? '✓' : '✗'} |`);
        }
        lines.push('');
        lines.push(`**SSE Integration:** ${report.D6_architecture.hasSSE ? '✓ Present' : '✗ Missing'}`);
        lines.push(`**PRD Generation:** ${report.D6_architecture.hasPRD ? '✓ Present' : '✗ Missing'}`);
        lines.push('');

        return lines.join('\n');
    }

    /**
     * Write gap analysis report to file
     * @param {string} outputPath - Path to write the report
     * @returns {object} Result with success status and path
     */
    writeReport(outputPath) {
        try {
            const report = this.analyze();
            const markdown = this.toMarkdown(report);

            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(outputPath, markdown, 'utf-8');

            console.log(`[gapAnalyzer] Report written to: ${outputPath}`);
            return {
                success: true,
                path: outputPath,
                report
            };
        } catch (err) {
            console.error(`[gapAnalyzer] Failed to write report: ${err.message}`);
            return {
                success: false,
                error: err.message
            };
        }
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = { GapAnalyzer };
