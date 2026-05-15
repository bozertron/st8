#!/usr/bin/env node
/**
 * Verification script for persistence.js fixes
 * Tests CR-01, CR-02, CR-03
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Use in-memory SQLite for testing
const testDbPath = ':memory:';

let St8Persistence;
try {
    // Try loading the persistence module (file moved scripts/ ← src/core/database/)
    const mod = require('../src/core/database/persistence');
    St8Persistence = mod.St8Persistence;
} catch (err) {
    console.error('Failed to load persistence module:', err.message);
    process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.error(`  ✗ ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n=== Persistence Fix Verification ===\n');

    // Initialize with in-memory DB
    const persistence = new St8Persistence(':memory:');
    await persistence.initialize();

    // ─── CR-01: UNIQUE constraint on connections ────────────────
    console.log('CR-01: connections UNIQUE constraint');

    // Insert two files first (foreign keys require them)
    persistence.upsertFile({
        fingerprint: 'fp_source',
        filepath: '/src/a.js',
        filename: 'a.js',
        sha256Hash: 'hash1'
    });
    persistence.upsertFile({
        fingerprint: 'fp_target',
        filepath: '/src/b.js',
        filename: 'b.js',
        sha256Hash: 'hash2'
    });

    // Insert connection
    persistence.insertConnection({
        sourceFingerprint: 'fp_source',
        targetFingerprint: 'fp_target',
        connectionType: 'IMPORT',
        confidenceScore: 0.8
    });

    // Insert SAME connection again (should REPLACE, not duplicate)
    persistence.insertConnection({
        sourceFingerprint: 'fp_source',
        targetFingerprint: 'fp_target',
        connectionType: 'IMPORT',
        confidenceScore: 0.9
    });

    const conns = persistence.getConnectionsForFile('fp_source');
    assert(conns.length === 1, `Same connection inserted once (got ${conns.length}, expected 1)`);
    assert(conns[0].confidenceScore === 0.9, `Confidence updated on replace (got ${conns[0].confidenceScore}, expected 0.9)`);

    // Insert different connectionType (should be allowed)
    persistence.insertConnection({
        sourceFingerprint: 'fp_source',
        targetFingerprint: 'fp_target',
        connectionType: 'EXPORT',
        confidenceScore: 1.0
    });
    const conns2 = persistence.getConnectionsForFile('fp_source');
    assert(conns2.length === 2, `Different connectionType allowed (got ${conns2.length}, expected 2)`);

    // ─── CR-02: deleteFile cleans file_mutation_log ─────────────
    console.log('\nCR-02: deleteFile() cleans file_mutation_log');

    // Register a concept file (creates mutation log entry)
    const conceptFp = persistence.registerConceptFile({
        filepath: '/src/concept.js',
        filename: 'concept.js',
        actor: 'TEST'
    });

    // Verify mutation log exists
    const mutationCount = persistence.getMutationCount(conceptFp);
    assert(mutationCount > 0, `Mutation log has entries (got ${mutationCount})`);

    // Delete the file
    const deleteResult = persistence.deleteFile('/src/concept.js');
    assert(deleteResult.changes === 1, `File deleted (changes: ${deleteResult.changes})`);

    // Verify mutation log is cleaned up
    const remainingMutations = persistence.getMutationCount(conceptFp);
    assert(remainingMutations === 0, `Mutation log cleaned up (remaining: ${remainingMutations})`);

    // ─── CR-03: confidenceScore 0 preserved ─────────────────────
    console.log('\nCR-03: confidenceScore 0 preserved (not converted to 1.0)');

    // Insert connection with confidenceScore: 0
    persistence.insertConnection({
        sourceFingerprint: 'fp_source',
        targetFingerprint: 'fp_target',
        connectionType: 'DYNAMIC',
        confidenceScore: 0
    });

    const conns3 = persistence.getConnectionsForFile('fp_source');
    const zeroConfConn = conns3.find(c => c.connectionType === 'DYNAMIC');
    assert(zeroConfConn !== undefined, 'Found DYNAMIC connection');
    assert(zeroConfConn.confidenceScore === 0, `confidenceScore 0 preserved (got ${zeroConfConn.confidenceScore}, expected 0)`);

    // Test undefined confidenceScore defaults to 1.0
    persistence.insertConnection({
        sourceFingerprint: 'fp_source',
        targetFingerprint: 'fp_target',
        connectionType: 'REQUIRE',
        // confidenceScore not set
    });
    const conns4 = persistence.getConnectionsForFile('fp_source');
    const defaultConfConn = conns4.find(c => c.connectionType === 'REQUIRE');
    assert(defaultConfConn !== undefined, 'Found REQUIRE connection');
    assert(defaultConfConn.confidenceScore === 1.0, `undefined confidenceScore defaults to 1.0 (got ${defaultConfConn.confidenceScore})`);

    // Cleanup
    persistence.close();

    // Summary
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
