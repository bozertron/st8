'use strict';

/**
 * intent-seeder FILENAME_PURPOSE_MAP ordering lock — ticket 0.
 *
 * FILENAME_PURPOSE_MAP is a ~70-entry regex table with first-match-wins
 * semantics. Order is load-bearing (e.g. /indexer/ precedes /index/ so
 * background-indexer.js gets "Codebase indexing and analysis" rather
 * than "Module entry point"). This test pins a representative set of
 * filename→purpose mappings so an accidental re-order trips loud.
 *
 * If you intentionally change a mapping, update the expected value
 * here AND record the rationale in intent-seeder.js's ordering policy
 * JSDoc.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { IntentSeeder } = require('../../../src/features/analysis/intent-seeder');

function makeSeeder(tmp) {
    const persistence = {
        upserts: [],
        getAllFiles() { return []; },
        upsertIntent(i) { this.upserts.push(i); },
        flagForAIReview() {},
    };
    return { seeder: new IntentSeeder(persistence, path.join(tmp, '.st8/schema-cards'), tmp), persistence };
}

function purposeFor(filename) {
    // Build a one-file scenario, run seedFile, return the purpose
    // prefix (before any " — " separator and the trailing ???).
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-ord-'));
    try {
        const target = path.join(tmp, filename);
        fs.writeFileSync(target, '// stub\nmodule.exports = {};\n');
        const persistence = {
            getAllFiles() {
                return [{
                    fingerprint: `${filename}||2026-01-01T00:00:00.000Z`,
                    filepath: filename,
                    filename,
                }];
            },
            upserts: [],
            upsertIntent(i) { this.upserts.push(i); },
            flagForAIReview() {},
        };
        const seeder = new IntentSeeder(persistence, path.join(tmp, '.st8/schema-cards'), tmp);
        const result = seeder.seedFile(`${filename}||2026-01-01T00:00:00.000Z`);
        if (!result.success) throw new Error(`seedFile failed: ${result.error}`);
        const purpose = persistence.upserts[0].purpose;
        // Strip the trailing " ???" marker and any " — comment" suffix
        // from the top-level JSDoc/// extraction.
        return purpose.replace(/ \?\?\?$/, '').split(' — ')[0];
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

const PINNED = [
    // SPECIFIC > GENERIC
    ['persistence.js',           'SQLite persistence layer'],
    ['database-persister.js',    'Database persistence operations'],   // /database[-_]?persister/ before /persistence/
    ['schema-card-emitter.js',   'Schema card emission'],                // /schema[-_]?card/ before /emitter/
    ['gap-analyzer.js',          'Gap analysis'],                        // /gap[-_]?analy/ before /analy/
    ['ast-parser.js',            'AST parsing and analysis'],            // /ast[-_]?parser/ before /ast/
    ['data-ingestion.js',        'Data ingestion pipeline'],             // /data[-_]?ingest/ before /ingest/

    // NAMED-ROLE > FRAMEWORK
    ['background-indexer.js',    'Codebase indexing and analysis'],      // /indexer/ before /index/
    ['file-indexer.js',          'Codebase indexing and analysis'],      // same

    // PLAIN MODULE-ROLE
    ['server.js',                'HTTP server and API routes'],
    ['watcher.js',               'File system change monitoring'],
    ['cli.js',                   'Command-line interface'],
    ['settings.js',              'Settings management'],

    // FALLBACK
    ['index.js',                 'Module entry point'],                  // /index/ matches when nothing earlier does
    ['main.js',                  'Application entry point'],             // /main/
];

for (const [filename, expectedPrefix] of PINNED) {
    test(`FILENAME_PURPOSE_MAP order: ${filename} → "${expectedPrefix}"`, () => {
        const got = purposeFor(filename);
        // The actual purpose is the prefix + possibly a comment suffix; we
        // pinned only the prefix.
        assert.equal(got, expectedPrefix,
            `${filename}: pattern-ordering changed. Got "${got}", expected "${expectedPrefix}". ` +
            `If this is intentional, update intent-seeder.js JSDoc + this test.`);
    });
}
