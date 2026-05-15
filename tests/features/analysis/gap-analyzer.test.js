'use strict';

/**
 * Tests for src/features/analysis/gap-analyzer.js — the 6-dimension gap
 * analysis engine. Each dimension (D1..D6) computes summary metrics that
 * drive the .st8/gap-analysis.md report. These probes use synthetic
 * card-JSON fixtures dropped into a temp directory — the SUT (GapAnalyzer)
 * is exercised against real fs reads, not mocks.
 *
 * Conventions per tests/README.md:
 *   - node:test + node:assert/strict
 *   - one temp dir per test, cleaned up in t.after
 *   - assertions probe specific output metric values, not just shape
 *
 * Identity-and-analysis ticket 2 / roadmap P3.4 — Wave 3C.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { GapAnalyzer } = require('../../../src/features/analysis/gap-analyzer');

// ─── Fixture helpers ─────────────────────────────────────────────────

/**
 * Build a fresh temp schema-cards directory and write each card to a
 * file. Card filenames are derived from filepath (slashes → underscores)
 * matching emitter.js's on-disk naming.
 */
function makeCardsDir(cards) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-gap-analyzer-'));
    for (const card of cards) {
        const safe = (card.filepath || 'untitled').replace(/[\/\\]/g, '_');
        fs.writeFileSync(path.join(dir, safe + '.json'), JSON.stringify(card, null, 2));
    }
    return dir;
}

function cleanupDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

/**
 * Build a minimally-populated card with sensible defaults. Override per
 * test to control which dimension is being probed.
 */
function card(overrides = {}) {
    return {
        fingerprint: 'src/x.js||2026-01-01T00:00:00.000Z',
        filepath: 'src/x.js',
        filename: 'x.js',
        sha256Hash: 'sha-x',
        status: 'GREEN',
        reachabilityScore: 0.5,
        impactRadius: 0,
        lifecyclePhase: 'DEVELOPMENT',
        birthTimestamp: '2026-01-01T00:00:00.000Z',
        exports: [],
        imports: [],
        connections: { imports: [], importedBy: [] },
        intent: { purpose: '', dependsOnBehavior: '', valueStatement: '' },
        ...overrides,
    };
}

// ─── D1: Lifecycle Progression ────────────────────────────────────────

test('D1: lifecycle distribution + canProgress accounting', () => {
    const cards = [
        card({ filepath: 'src/a.js', lifecyclePhase: 'CONCEPT',     intent: { purpose: 'a' } }),
        card({ filepath: 'src/b.js', lifecyclePhase: 'DEVELOPMENT', intent: { purpose: 'b' } }),
        card({ filepath: 'src/c.js', lifecyclePhase: 'DEVELOPMENT', intent: { valueStatement: 'c' } }),
        // No intent → cannot progress
        card({ filepath: 'src/d.js', lifecyclePhase: 'DEVELOPMENT', intent: { purpose: '' } }),
        // PRODUCTION is the end state — intent or not, never counted in canProgress
        card({ filepath: 'src/e.js', lifecyclePhase: 'PRODUCTION',  intent: { purpose: 'e' } }),
    ];
    const dir = makeCardsDir(cards);
    try {
        const a = new GapAnalyzer(dir, /* persistence */ null);
        const r = a.analyze().D1_lifecycle;

        assert.equal(r.phaseDistribution.CONCEPT.count, 1);
        assert.equal(r.phaseDistribution.DEVELOPMENT.count, 3);
        assert.equal(r.phaseDistribution.PRODUCTION.count, 1);
        // a + b + c can progress (have intent + not PRODUCTION). d lacks intent.
        // e is PRODUCTION → excluded.
        assert.equal(r.canProgressCount, 3);
        const filesReady = r.canProgress.map((x) => x.filepath).sort();
        assert.deepEqual(filesReady, ['src/a.js', 'src/b.js', 'src/c.js']);
        // hasPurpose / hasValueStatement flags carry through accurately.
        const c_entry = r.canProgress.find((x) => x.filepath === 'src/c.js');
        assert.equal(c_entry.hasPurpose, false);
        assert.equal(c_entry.hasValueStatement, true);
        // Summary string mentions all phases.
        assert.match(r.summary, /5 files across 3 lifecycle phases/);
    } finally {
        cleanupDir(dir);
    }
});

// ─── D2: Status Health ────────────────────────────────────────────────

test('D2: status counts + RED root-cause inference + GREEN-low-reachability flag', () => {
    const cards = [
        // RED file with no importers AND no exports → both root causes flagged
        card({ filepath: 'src/orphan.js', status: 'RED', reachabilityScore: 0,
               exports: [], connections: { imports: [], importedBy: [] } }),
        // RED file WITH exports but no importers → only "No importers" cause
        card({ filepath: 'src/exporter-orphan.js', status: 'RED', reachabilityScore: 0,
               exports: [{ name: 'f' }], connections: { imports: [], importedBy: [] } }),
        // GREEN with low reachability
        card({ filepath: 'src/under-used.js', status: 'GREEN', reachabilityScore: 0.1 }),
        // GREEN with healthy reachability — NOT flagged
        card({ filepath: 'src/healthy.js', status: 'GREEN', reachabilityScore: 0.9 }),
        // YELLOW file
        card({ filepath: 'src/partial.js', status: 'YELLOW', reachabilityScore: 0.4 }),
    ];
    const dir = makeCardsDir(cards);
    try {
        const r = new GapAnalyzer(dir, null).analyze().D2_status;

        assert.equal(r.statusCounts.RED.count, 2);
        assert.equal(r.statusCounts.GREEN.count, 2);
        assert.equal(r.statusCounts.YELLOW.count, 1);
        assert.equal(r.redFileCount, 2);
        assert.equal(r.greenLowReachabilityCount, 1);
        assert.equal(r.yellowFileCount, 1);
        assert.equal(r.greenLowReachability[0].filepath, 'src/under-used.js');

        // Probe RED root-cause logic specifically — both causes must be inferred
        // independently and TOGETHER for the no-exports/no-importers file.
        const orphan = r.redFiles.find((f) => f.filepath === 'src/orphan.js');
        assert.deepEqual(
            orphan.rootCauses.sort(),
            ['No exports — cannot be consumed', 'No importers — orphan file'].sort(),
        );
        const exportOrphan = r.redFiles.find((f) => f.filepath === 'src/exporter-orphan.js');
        assert.deepEqual(exportOrphan.rootCauses, ['No importers — orphan file']);
    } finally {
        cleanupDir(dir);
    }
});

// ─── D3: Intent Authoring ─────────────────────────────────────────────

test('D3: intent coverage treats empty AND "(not set)" sentinel as unauthored', () => {
    const cards = [
        card({ filepath: 'src/x.js',     intent: { purpose: 'real purpose' } }),
        card({ filepath: 'src/y.js',     intent: { purpose: '(not set)' } }),       // sentinel
        card({ filepath: 'src/z.js',     intent: { purpose: '' } }),                 // empty
        card({ filepath: 'src/w.js',     intent: { purpose: '   ' } }),              // whitespace-only
        card({ filepath: 'lib/q.js',     intent: { purpose: 'another real' } }),
    ];
    const dir = makeCardsDir(cards);
    try {
        const r = new GapAnalyzer(dir, null).analyze().D3_intent;

        // Only 2 of 5 have authored purpose.
        assert.equal(r.withPurpose, 2);
        assert.equal(r.withoutPurpose, 3);
        assert.equal(r.intentCoverage, '40.0%');
        assert.equal(r.unauthoredCount, 3);

        // Directory grouping isolates lib/ from src/.
        assert.equal(r.directoryGroups['src'].total, 4);
        assert.equal(r.directoryGroups['src'].withIntent, 1);
        assert.equal(r.directoryGroups['lib'].total, 1);
        assert.equal(r.directoryGroups['lib'].withIntent, 1);
    } finally {
        cleanupDir(dir);
    }
});

// ─── D4: Export Surface ───────────────────────────────────────────────

test('D4: export coverage + CommonJS vs ES6 classification from imports', () => {
    const cards = [
        // CommonJS file: has exports + uses require()
        card({
            filepath: 'src/cjs.js',
            exports: [{ name: 'foo', kind: 'function' }],
            imports: [{ source: 'path', importType: 'require' }],
        }),
        // ES6 file: has exports + uses import
        card({
            filepath: 'src/esm.js',
            exports: [{ name: 'bar', kind: 'function' }, { name: 'baz', kind: 'const' }],
            imports: [{ source: 'fs', importType: 'import' }],
        }),
        // Mixed: hasImport AND hasRequire → classified as ES6 (per the
        // gap-analyzer rule: any `import` wins).
        card({
            filepath: 'src/mixed.js',
            exports: [{ name: 'mix' }],
            imports: [
                { source: 'path', importType: 'require' },
                { source: 'fs',   importType: 'import' },
            ],
        }),
        // No exports
        card({ filepath: 'src/noexports.js', exports: [], imports: [] }),
    ];
    const dir = makeCardsDir(cards);
    try {
        const r = new GapAnalyzer(dir, null).analyze().D4_exports;

        assert.equal(r.withExports, 3);
        assert.equal(r.withoutExports, 1);
        assert.equal(r.exportCoverage, '75.0%');
        assert.equal(r.commonJsCount, 1);
        // ES6 count includes both esm.js and mixed.js (import wins).
        assert.equal(r.es6Count, 2);
        assert.ok(r.es6Files.includes('src/mixed.js'));
        assert.ok(r.commonJsFiles.includes('src/cjs.js'));

        // exportDetails per-file count is preserved.
        const esmDetail = r.exportDetails.find((d) => d.filepath === 'src/esm.js');
        assert.equal(esmDetail.exportCount, 2);
    } finally {
        cleanupDir(dir);
    }
});

// ─── D5: Connection Integrity ─────────────────────────────────────────

test('D5: orphan-import detection + isolated-file roll-up + fingerprint parsing', () => {
    // Cards reference each other via fingerprint-shaped import entries
    // (`filepath||timestamp`). gap-analyzer splits on `||` to recover the
    // filepath, then checks against the known card set.
    const cards = [
        card({
            filepath: 'src/a.js',
            connections: {
                imports:    ['src/b.js||2026-01-01T00:00:00.000Z',
                             'src/missing.js||2026-01-01T00:00:00.000Z'],
                importedBy: [],
            },
        }),
        card({
            filepath: 'src/b.js',
            connections: { imports: [], importedBy: ['src/a.js||2026-01-01T00:00:00.000Z'] },
        }),
        // Isolated — no imports, no importedBy
        card({ filepath: 'src/isolated.js', connections: { imports: [], importedBy: [] } }),
    ];
    const dir = makeCardsDir(cards);
    try {
        const r = new GapAnalyzer(dir, null).analyze().D5_connections;

        assert.equal(r.totalImports, 2);
        assert.equal(r.resolvedConnections, 1);  // only b.js resolves
        assert.equal(r.orphanCount, 1);
        assert.equal(r.orphanImports[0].source, 'src/a.js');
        assert.equal(r.orphanImports[0].target, 'src/missing.js');

        // Isolated count = files with empty imports AND empty importedBy.
        // a.js has imports → not isolated. b.js has importedBy → not isolated.
        // Only src/isolated.js qualifies.
        assert.equal(r.isolatedCount, 1);
        assert.equal(r.isolatedFiles[0], 'src/isolated.js');
    } finally {
        cleanupDir(dir);
    }
});

// ─── D6: Architectural Completeness ────────────────────────────────────

test('D6: required-endpoint coverage + key-component detection', () => {
    // D6 looks for specific filepaths to declare endpoints + components
    // "present." We seed enough of the canonical set to exercise both
    // success (server, persistence, indexer, prd-generator) and absence
    // (notification-bus deliberately omitted).
    const cards = [
        card({ filepath: 'src/core/server/app.js' }),
        card({ filepath: 'src/core/database/persistence.js' }),
        card({ filepath: 'src/features/indexing/indexer.js' }),
        card({ filepath: 'src/features/prd/generator.js' }),
        card({ filepath: 'src/features/schema-cards/emitter.js' }),
        card({ filepath: 'src/features/schema-cards/manifest-generator.js' }),
        card({ filepath: 'src/features/watcher/file-watcher.js' }),
        card({ filepath: 'src/features/analysis/gap-analyzer.js' }),
        // Deliberately NOT including: src/core/notification-bus.js
    ];
    const dir = makeCardsDir(cards);
    try {
        const r = new GapAnalyzer(dir, null).analyze().D6_architecture;

        // 8 components, 7 present (notification-bus missing).
        assert.equal(r.componentCoverage, '7/8');
        assert.equal(r.architecturalComponents.persistence, true);
        assert.equal(r.architecturalComponents.notificationBus, false);
        assert.equal(r.hasSSE, false);
        assert.equal(r.hasPRD, true);

        // Endpoint coverage: /api/health is self-contained (always "present"),
        // and we seeded the handler modules for nearly every other endpoint.
        // /api/concept-file, /api/mvp-lock, /api/mutations, etc. all map to
        // persistence.js which IS present → they count. Score should be
        // 14/14 since persistence.js + indexer.js + prd/generator.js +
        // gap-analyzer.js + app.js are all present.
        assert.equal(r.endpointCoverage, '14/14');
        assert.equal(r.missingEndpoints.length, 0);
    } finally {
        cleanupDir(dir);
    }
});

// ─── D6 negative — missing handler module flags endpoints ─────────────

test('D6: missing handler module surfaces in missingEndpoints', () => {
    // Only ship the server card. Every other endpoint should be flagged
    // missing because its handler module is absent from the card set.
    const cards = [card({ filepath: 'src/core/server/app.js' })];
    const dir = makeCardsDir(cards);
    try {
        const r = new GapAnalyzer(dir, null).analyze().D6_architecture;

        // /api/health is self-contained → still present even with no
        // persistence card. All others miss.
        assert.equal(r.foundEndpoints.length, 1);
        assert.equal(r.foundEndpoints[0], '/api/health');
        assert.ok(r.missingEndpoints.length >= 12);
        // Each missing entry carries the expected handler module path.
        const persistenceMisses = r.missingEndpoints.filter(
            (m) => m.requiredModule === 'src/core/database/persistence.js',
        );
        assert.ok(persistenceMisses.length >= 5);
    } finally {
        cleanupDir(dir);
    }
});

// ─── Roll-up: report markdown includes every dimension marker ─────────

test('roll-up: toMarkdown report includes each D1..D6 section header', () => {
    // Realistic synthetic codebase exercising every dimension at once.
    const cards = [
        card({
            filepath: 'src/core/server/app.js',
            status: 'GREEN', reachabilityScore: 0.9,
            lifecyclePhase: 'DEVELOPMENT',
            intent: { purpose: 'HTTP server' },
            exports: [{ name: 'St8Server' }],
            imports: [{ source: 'http', importType: 'require' }],
            connections: {
                imports: ['src/core/database/persistence.js||2026-01-01T00:00:00.000Z'],
                importedBy: [],
            },
        }),
        card({
            filepath: 'src/core/database/persistence.js',
            status: 'GREEN', reachabilityScore: 0.8,
            lifecyclePhase: 'DEVELOPMENT',
            intent: { purpose: 'SQLite layer' },
            exports: [{ name: 'St8Persistence' }],
            connections: {
                imports: [],
                importedBy: ['src/core/server/app.js||2026-01-01T00:00:00.000Z'],
            },
        }),
        card({
            filepath: 'src/red.js',
            status: 'RED',
            reachabilityScore: 0,
            intent: { purpose: '(not set)' },
            connections: { imports: [], importedBy: [] },
        }),
    ];
    const dir = makeCardsDir(cards);
    try {
        const analyzer = new GapAnalyzer(dir, null);
        const report = analyzer.analyze();
        const md = analyzer.toMarkdown(report);

        // Every dimension's header is in the rendered markdown.
        assert.match(md, /## D1: Lifecycle Progression/);
        assert.match(md, /## D2: Status Health/);
        assert.match(md, /## D3: Intent Authoring/);
        assert.match(md, /## D4: Export Surface/);
        assert.match(md, /## D5: Connection Integrity/);
        assert.match(md, /## D6: Architectural Completeness/);

        // And each dimension's summary line appears.
        assert.match(md, /3 files across/);
        // RED section is rendered because at least one RED card exists.
        assert.match(md, /### RED Files/);
        assert.match(md, /src\/red\.js/);
    } finally {
        cleanupDir(dir);
    }
});

// ─── Edge case: empty schema-cards dir ────────────────────────────────

test('analyze() on empty schema-cards dir yields zero-counted dimensions', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-gap-empty-'));
    try {
        const r = new GapAnalyzer(dir, null).analyze();
        assert.equal(r.totalCards, 0);
        assert.equal(r.D1_lifecycle.canProgressCount, 0);
        assert.equal(r.D2_status.redFileCount, 0);
        assert.equal(r.D3_intent.withPurpose, 0);
        assert.equal(r.D3_intent.intentCoverage, '0%');
        assert.equal(r.D4_exports.withExports, 0);
        assert.equal(r.D5_connections.totalImports, 0);
        // D6 still runs — endpoints all miss, only /api/health self-contained.
        assert.equal(r.D6_architecture.foundEndpoints.length, 1);
    } finally {
        cleanupDir(dir);
    }
});

// ─── writeReport: produces a real file on disk ────────────────────────

test('writeReport: persists markdown to disk and round-trips through toMarkdown', () => {
    const cards = [card({ filepath: 'src/x.js', intent: { purpose: 'thing' } })];
    const dir = makeCardsDir(cards);
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-gap-out-'));
    const outPath = path.join(outDir, 'gap-analysis.md');
    try {
        const result = new GapAnalyzer(dir, null).writeReport(outPath);
        assert.equal(result.success, true);
        assert.ok(fs.existsSync(outPath));
        const onDisk = fs.readFileSync(outPath, 'utf-8');
        assert.match(onDisk, /# ST8 Gap Analysis Report/);
        assert.match(onDisk, /## D6: Architectural Completeness/);
    } finally {
        cleanupDir(dir);
        cleanupDir(outDir);
    }
});
