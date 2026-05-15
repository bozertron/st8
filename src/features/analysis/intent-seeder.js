#!/usr/bin/env node

/**
 * ST8 Intent Seeder — Auto-generate intent from AST + heuristics
 *
 * Generates purpose, dependsOnBehavior, and valueStatement for every file
 * in the registry using filename, imports, exports, and comment heuristics.
 * All generated fields are flagged with ??? to indicate INFERRED status.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── HEURISTIC MAPPINGS ──────────────────────────────────────

/**
 * Maps filename patterns to human-readable purpose descriptions.
 * Order matters — first match wins.
 */
const FILENAME_PURPOSE_MAP = [
    { pattern: /persistence/i, purpose: 'SQLite persistence layer' },
    { pattern: /server/i, purpose: 'HTTP server and API routes' },
    { pattern: /indexer/i, purpose: 'Codebase indexing and analysis' },
    { pattern: /types?$/i, purpose: 'Type definitions and constants' },
    { pattern: /schema[-_]?card/i, purpose: 'Schema card emission' },
    { pattern: /emitter/i, purpose: 'Event or data emission' },
    { pattern: /watcher/i, purpose: 'File system change monitoring' },
    { pattern: /generator/i, purpose: 'Code or data generation' },
    { pattern: /printer/i, purpose: 'Output formatting and display' },
    { pattern: /notification/i, purpose: 'Event notification system' },
    { pattern: /manifest/i, purpose: 'Project manifest generation' },
    { pattern: /config/i, purpose: 'Configuration management' },
    { pattern: /util/i, purpose: 'Utility functions' },
    { pattern: /helper/i, purpose: 'Helper functions' },
    { pattern: /test/i, purpose: 'Test suite' },
    { pattern: /index/i, purpose: 'Module entry point' },
    { pattern: /main/i, purpose: 'Application entry point' },
    { pattern: /app/i, purpose: 'Application core' },
    { pattern: /cli/i, purpose: 'Command-line interface' },
    { pattern: /db/i, purpose: 'Database operations' },
    { pattern: /graph[-_]?builder/i, purpose: 'Dependency graph construction' },
    { pattern: /graph[-_]?traversal/i, purpose: 'Graph traversal and querying' },
    { pattern: /graph[-_]?visual/i, purpose: 'Graph visualization' },
    { pattern: /insight[-_]?store/i, purpose: 'Insight storage and retrieval' },
    { pattern: /database[-_]?persister/i, purpose: 'Database persistence operations' },
    { pattern: /relationship[-_]?analy/i, purpose: 'Code relationship analysis' },
    { pattern: /toml[-_]?serial/i, purpose: 'TOML serialization' },
    { pattern: /ast[-_]?parser/i, purpose: 'AST parsing and analysis' },
    { pattern: /ast/i, purpose: 'AST parsing' },
    { pattern: /io[-_]?chan/i, purpose: 'I/O channel abstraction' },
    { pattern: /safe[-_]?fs/i, purpose: 'Safe file system operations' },
    { pattern: /coordination/i, purpose: 'Process coordination' },
    { pattern: /settings/i, purpose: 'Settings management' },
    { pattern: /void[-_]?engine/i, purpose: 'Rendering engine' },
    { pattern: /phreak/i, purpose: 'Terminal interface' },
    { pattern: /terminal/i, purpose: 'Terminal interface' },
    { pattern: /fake[-_]?stream/i, purpose: 'Stream mocking utility' },
    { pattern: /file[-_]?explorer/i, purpose: 'File explorer UI' },
    { pattern: /explorer/i, purpose: 'File explorer UI' },
    { pattern: /visuali/i, purpose: 'Data visualization' },
    { pattern: /overview/i, purpose: 'Project overview display' },
    { pattern: /parser/i, purpose: 'Parsing utilities' },
    { pattern: /background/i, purpose: 'Background processing' },
    { pattern: /migration/i, purpose: 'Database migration' },
    { pattern: /path[-_]?gen/i, purpose: 'Path generation' },
    { pattern: /report/i, purpose: 'Report generation' },
    { pattern: /data[-_]?ingest/i, purpose: 'Data ingestion pipeline' },
    { pattern: /ingest/i, purpose: 'Data ingestion' },
    { pattern: /ground[-_]?plane/i, purpose: 'Ground plane abstraction' },
    { pattern: /plane/i, purpose: 'Spatial plane abstraction' },
    { pattern: /verify/i, purpose: 'Verification and testing' },
    { pattern: /gap[-_]?analy/i, purpose: 'Gap analysis' },
    { pattern: /analy/i, purpose: 'Analysis module' },
    { pattern: /prd/i, purpose: 'Product Requirements Document' },
    { pattern: /seeder/i, purpose: 'Data seeding' },
    { pattern: /press[-_]?release/i, purpose: 'Press Release' },
    { pattern: /gtm[-_]?plan/i, purpose: 'Go-To-Market Plan' },
    { pattern: /stakeholder/i, purpose: 'Stakeholder Registry' },
    { pattern: /technical[-_]?spec/i, purpose: 'Technical Specification' },
    { pattern: /roadmap/i, purpose: 'Project Roadmap' },
    { pattern: /meeting[-_]?notes/i, purpose: 'Meeting Notes' },
    { pattern: /decision[-_]?log/i, purpose: 'Decision Log' },
    { pattern: /risk[-_]?register/i, purpose: 'Risk Register' },
    { pattern: /user[-_]?story/i, purpose: 'User Story' },
    { pattern: /acceptance[-_]?criteria/i, purpose: 'Acceptance Criteria' },
    { pattern: /changelog/i, purpose: 'Change Log' },
    { pattern: /readme/i, purpose: 'Project README' },
    { pattern: /todo/i, purpose: 'Todo List' },
    { pattern: /bug[-_]?report/i, purpose: 'Bug Report' },
    { pattern: /feature[-_]?request/i, purpose: 'Feature Request' },
];

/**
 * Maps import source patterns to behavior descriptions.
 */
const IMPORT_BEHAVIOR_MAP = [
    { pattern: /better-sqlite3/i, behavior: 'SQLite database engine' },
    { pattern: /chokidar/i, behavior: 'file system watching' },
    { pattern: /express/i, behavior: 'HTTP request handling' },
    { pattern: /path/i, behavior: 'file path manipulation' },
    { pattern: /fs/i, behavior: 'file system operations' },
    { pattern: /crypto/i, behavior: 'cryptographic hashing' },
    { pattern: /st8-types/i, behavior: 'type definitions and constants' },
    { pattern: /persistence/i, behavior: 'database persistence layer' },
    { pattern: /indexer/i, behavior: 'codebase indexing' },
    { pattern: /schema[-_]?card/i, behavior: 'schema card management' },
    { pattern: /ast/i, behavior: 'AST parsing' },
    { pattern: /graph/i, behavior: 'dependency graph building' },
];

/**
 * Maps export name patterns to value descriptions.
 */
const EXPORT_VALUE_MAP = [
    { pattern: /persistence/i, value: 'CRUD operations for file registry' },
    { pattern: /server/i, value: 'HTTP API endpoints' },
    { pattern: /index/i, value: 'codebase indexing pipeline' },
    { pattern: /emitter/i, value: 'schema card emission' },
    { pattern: /types?$/i, value: 'shared type definitions' },
    { pattern: /watcher/i, value: 'file change monitoring' },
    { pattern: /generator/i, value: 'automated code generation' },
    { pattern: /printer/i, value: 'formatted output' },
];

// ─── INTENT SEEDER CLASS ─────────────────────────────────────

class IntentSeeder {
    /**
     * @param {object} persistence - St8Persistence instance (must be initialized)
     * @param {string} schemaCardsDir - Path to schema cards directory
     * @param {string} [targetDir] - Project root the file_registry's relative filepaths
     *                               are relative to. If omitted, falls back to process.cwd()
     *                               (legacy behavior; reliable only when cwd === targetDir).
     */
    constructor(persistence, schemaCardsDir, targetDir) {
        this.persistence = persistence;
        this.schemaCardsDir = schemaCardsDir;
        this.targetDir = targetDir || process.cwd();
    }

    /**
     * Seed intent for all files in the registry.
     * @returns {{ seeded: number, errors: number, details: Array<{fingerprint: string, status: string}> }}
     */
    seedAll() {
        const files = this.persistence.getAllFiles();
        let seeded = 0;
        let errors = 0;
        const details = [];

        for (const file of files) {
            try {
                const result = this.seedFile(file.fingerprint);
                if (result.success) {
                    seeded++;
                    details.push({ fingerprint: file.fingerprint, filepath: file.filepath, status: 'seeded' });
                } else {
                    errors++;
                    details.push({ fingerprint: file.fingerprint, filepath: file.filepath, status: 'error', error: result.error });
                }
            } catch (err) {
                console.error(`[st8:seeder] Error seeding ${file.filepath}:`, err.message);
                errors++;
                details.push({ fingerprint: file.fingerprint, filepath: file.filepath, status: 'error', error: err.message });
            }
        }

        console.log(`[st8:seeder] Seeded ${seeded} files, ${errors} errors`);
        return { seeded, errors, details };
    }

    /**
     * Seed intent for a single file by fingerprint.
     * @param {string} fingerprint - File fingerprint
     * @returns {{ success: boolean, intent?: object, error?: string }}
     */
    seedFile(fingerprint) {
        try {
            // Get file from registry
            const files = this.persistence.getAllFiles();
            const file = files.find(f => f.fingerprint === fingerprint);
            if (!file) {
                return { success: false, error: `File not found: ${fingerprint}` };
            }

            // Parse file content for imports/exports heuristics
            const { imports, exports, comments } = this._parseFileContent(file.filepath);

            // Detect @@@ symbols in file content. Resolve relative to targetDir
            // (file_registry.filepath is project-relative, not cwd-relative).
            const TRIPLE_AT_PATTERN = /(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm;
            const detectionPath = path.isAbsolute(file.filepath) ? file.filepath : path.resolve(this.targetDir, file.filepath);
            const contentForDetection = fs.existsSync(detectionPath) ? fs.readFileSync(detectionPath, 'utf-8') : '';
            const tripleAtMatches = contentForDetection.match(TRIPLE_AT_PATTERN) || [];
            const tripleAtCount = tripleAtMatches.length;

            if (tripleAtCount > 0 && this.persistence) {
                this.persistence.flagForAIReview(file.filepath, tripleAtCount);
            }

            // Generate intent fields
            const purpose = this._generatePurpose(file.filepath, file.filename, imports, exports, comments);
            const dependsOnBehavior = this._generateDependsOn(imports);
            const valueStatement = this._generateValueStatement(file.filepath, exports);

            // Upsert intent to database
            const intent = {
                fingerprint: file.fingerprint,
                purpose,
                dependsOnBehavior,
                valueStatement,
                authoredBy: 'INFERRED'
            };

            this.persistence.upsertIntent(intent);

            return { success: true, intent };
        } catch (err) {
            console.error(`[st8:seeder] Error in seedFile for ${fingerprint}:`, err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Generate purpose from filename, imports, exports, and comments.
     * @private
     */
    _generatePurpose(filepath, filename, imports, exports, comments) {
        const parts = [];

        // 1. From filename
        const nameWithoutExt = path.basename(filename, path.extname(filename));
        for (const rule of FILENAME_PURPOSE_MAP) {
            if (rule.pattern.test(nameWithoutExt)) {
                parts.push(rule.purpose);
                break;
            }
        }

        // 2. From top-level comment (if it looks like a purpose)
        if (comments.length > 0) {
            const firstComment = comments[0];
            // Look for descriptive comments like "ST8 Schema Card Emitter"
            if (firstComment.length > 10 && firstComment.length < 100) {
                parts.push(firstComment);
            }
        }

        // 3. From imports (secondary signal)
        const importBehaviors = [];
        for (const imp of imports) {
            for (const rule of IMPORT_BEHAVIOR_MAP) {
                if (rule.pattern.test(imp.source)) {
                    importBehaviors.push(rule.behavior);
                    break;
                }
            }
        }
        if (importBehaviors.length > 0 && parts.length === 0) {
            parts.push(`Uses ${importBehaviors[0]}`);
        }

        // 4. From exports (secondary signal)
        const exportValues = [];
        for (const exp of exports) {
            for (const rule of EXPORT_VALUE_MAP) {
                if (rule.pattern.test(exp.name)) {
                    exportValues.push(rule.value);
                    break;
                }
            }
        }
        if (exportValues.length > 0 && parts.length === 0) {
            parts.push(`Provides ${exportValues[0]}`);
        }

        // Fallback if no heuristics matched
        if (parts.length === 0) {
            parts.push(`Source module at ${filepath}`);
        }

        // Combine and add ??? flag
        const purpose = parts.join(' — ');
        return `${purpose} ???`;
    }

    /**
     * Generate dependsOnBehavior from imports.
     * @private
     */
    _generateDependsOn(imports) {
        if (imports.length === 0) {
            return 'No external dependencies ???';
        }

        const behaviors = [];
        for (const imp of imports) {
            let matched = false;
            for (const rule of IMPORT_BEHAVIOR_MAP) {
                if (rule.pattern.test(imp.source)) {
                    behaviors.push(rule.behavior);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                // Use the module name directly
                const moduleName = imp.source.split('/').pop().replace(/\.(js|ts)$/, '');
                behaviors.push(moduleName);
            }
        }

        // Deduplicate
        const unique = [...new Set(behaviors)];
        const dependsOn = unique.join(', ');
        return `${dependsOn} ???`;
    }

    /**
     * Generate valueStatement from exports.
     * @private
     */
    _generateValueStatement(filepath, exports) {
        if (exports.length === 0) {
            // Check if it's a CLI/script file
            if (filepath.includes('cli') || filepath.endsWith('.cli.js')) {
                return 'Command-line interface for st8 operations ???';
            }
            return 'Internal module with no public exports ???';
        }

        const values = [];
        for (const exp of exports) {
            let matched = false;
            for (const rule of EXPORT_VALUE_MAP) {
                if (rule.pattern.test(exp.name)) {
                    values.push(rule.value);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                values.push(`${exp.name} API`);
            }
        }

        // Deduplicate
        const unique = [...new Set(values)];
        const valueStatement = unique.join(', ');
        return `Provides ${valueStatement} ???`;
    }

    /**
     * Parse file content to extract imports, exports, and comments using regex.
     * @private
     */
    _parseFileContent(filepath) {
        const imports = [];
        const exports = [];
        const comments = [];

        try {
            // Try to read from schema cards first (if available)
            const cardPath = path.join(this.schemaCardsDir, this._cardFilename(filepath));
            if (fs.existsSync(cardPath)) {
                const card = JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
                const cardImports = card.imports || [];
                const cardExports = card.exports || [];
                // If card has both imports and exports, use it directly
                if (cardImports.length > 0 && cardExports.length > 0) {
                    return { imports: cardImports, exports: cardExports, comments: [] };
                }
                // Otherwise, fall through to parse the actual file for better data
                // but keep card imports if they exist (more reliable than regex)
                if (cardImports.length > 0) {
                    imports.push(...cardImports);
                }
            }

            // Fallback: read the actual file and parse with regex. Resolve
            // relative to this.targetDir, NOT cwd — file_registry.filepath is
            // stored relative to the indexed project root and is unreliable
            // against cwd when the server's cwd differs.
            const fullPath = path.isAbsolute(filepath) ? filepath : path.resolve(this.targetDir, filepath);
            if (!fs.existsSync(fullPath)) {
                return { imports, exports, comments };
            }

            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');

            let inModuleExports = false;

            for (const line of lines) {
                const trimmed = line.trim();

                // Match require() imports: const X = require('module')
                const requireMatch = trimmed.match(/(?:const|let|var)\s+\w+\s*=\s*require\(['"]([^'"]+)['"]\)/);
                if (requireMatch) {
                    imports.push({ source: requireMatch[1], specifiers: [], importType: 'require' });
                }

                // Match ES module imports: import X from 'module' or import { X } from 'module'
                const importMatch = trimmed.match(/import\s+(?:(\w+)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/);
                if (importMatch) {
                    const specifiers = importMatch[2]
                        ? importMatch[2].split(',').map(s => s.trim())
                        : [importMatch[1]];
                    imports.push({
                        source: importMatch[3],
                        specifiers,
                        importType: importMatch[1] ? 'default' : 'named'
                    });
                }

                // Match module.exports: module.exports = { X, Y } (single-line)
                const moduleExportMatch = trimmed.match(/module\.exports\s*=\s*{([^}]+)}/);
                if (moduleExportMatch) {
                    const names = moduleExportMatch[1].split(',').map(s => s.trim().split(':')[0].trim());
                    for (const name of names) {
                        if (name) exports.push({ name, kind: 'named' });
                    }
                } else if (trimmed.match(/module\.exports\s*=\s*\{/)) {
                    // Start of multiline module.exports = { ... }
                    inModuleExports = true;
                    // Check if any names on the same line as the opening brace
                    const afterBrace = trimmed.match(/module\.exports\s*=\s*{\s*(.+)/);
                    if (afterBrace && afterBrace[1].trim() && afterBrace[1].trim() !== '}') {
                        const name = afterBrace[1].trim().replace(/,.*$/, '').trim().split(':')[0].trim();
                        if (name && name !== '}') exports.push({ name, kind: 'named' });
                    }
                } else if (inModuleExports) {
                    // Inside multiline module.exports block
                    if (trimmed === '}' || trimmed === '};') {
                        inModuleExports = false;
                    } else if (trimmed && !trimmed.startsWith('//')) {
                        // Extract name from "Name," or "Name" patterns
                        const nameMatch = trimmed.match(/^(\w+)/);
                        if (nameMatch) {
                            const name = nameMatch[1];
                            if (name !== 'module' && name !== 'exports') {
                                exports.push({ name, kind: 'named' });
                            }
                        }
                    }
                } else if (trimmed.match(/module\.exports\s*=\s*(\w+)/)) {
                    const name = trimmed.match(/module\.exports\s*=\s*(\w+)/)[1];
                    exports.push({ name, kind: 'default' });
                }

                // Match class exports
                const classMatch = trimmed.match(/class\s+(\w+)/);
                if (classMatch && !trimmed.startsWith('//')) {
                    exports.push({ name: classMatch[1], kind: 'class' });
                }

                // Match function exports
                const funcMatch = trimmed.match(/(?:async\s+)?function\s+(\w+)/);
                if (funcMatch && !trimmed.startsWith('//')) {
                    exports.push({ name: funcMatch[1], kind: 'function' });
                }

                // Match single-line comments at the top of the file
                const commentMatch = trimmed.match(/^\/\/\s*(.+)/);
                if (commentMatch && comments.length < 3) {
                    const comment = commentMatch[1].trim();
                    // Skip shebang and common noise
                    if (!comment.startsWith('#!') && !comment.startsWith('──') && comment.length > 5) {
                        comments.push(comment);
                    }
                }

                // Match JSDoc block comments
                const jsdocMatch = trimmed.match(/^\*\s*(.+)/);
                if (jsdocMatch && comments.length < 3) {
                    const comment = jsdocMatch[1].trim();
                    if (comment.length > 5 && !comment.startsWith('─')) {
                        comments.push(comment);
                    }
                }
            }

            // Deduplicate imports by source
            const seenImports = new Set();
            const uniqueImports = imports.filter(imp => {
                if (seenImports.has(imp.source)) return false;
                seenImports.add(imp.source);
                return true;
            });

            // Deduplicate exports by name
            const seenExports = new Set();
            const uniqueExports = exports.filter(exp => {
                if (seenExports.has(exp.name)) return false;
                seenExports.add(exp.name);
                return true;
            });

            return { imports: uniqueImports, exports: uniqueExports, comments };
        } catch (err) {
            console.error(`[st8:seeder] Error parsing ${filepath}:`, err.message);
            return { imports, exports, comments };
        }
    }

    /**
     * Convert filepath to safe filename for schema card lookup.
     * @private
     */
    _cardFilename(filepath) {
        return filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json';
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = { IntentSeeder };
