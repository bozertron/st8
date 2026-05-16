'use strict';

/**
 * tests/core/hooks/file-after-change-printer-wire.test.js — Wave 4C
 * ticket 16 end-to-end probe for the printer chain wire-up.
 *
 * Audit verdict: outcome (c) — accidentally dead. setPrinter(printer)
 * was wired in main.js but the FILE_AFTER_CHANGE P=30 SSE-broadcaster
 * subscriber never attached the emitted card to the publish event, so
 * notification-bus.publish's `if (printer && event.schemaCard)` guard
 * never fired. Wave 4C threads the card through:
 *   P=20 emitter.emitCard → ctx.schemaCard
 *   P=30 publish({..., schemaCard: ctx.schemaCard || null})
 *
 * This test fires the real FILE_AFTER_CHANGE chain (real HookRegistry,
 * real default subscribers, real notification bus) with a stub
 * printer and asserts printCard is invoked with the same fingerprint
 * that the emitter wrote.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { HookRegistry, HOOKS } = require('../../../src/core/hook-registry');
const { registerDefaultSubscribers, _resetDefaultSubscribersFlag } = require('../../../src/core/hooks/default-subscribers');
const { NotificationBus, notificationBus } = require('../../../src/core/notification-bus');
const { SchemaCardEmitter } = require('../../../src/features/schema-cards/emitter');

function mkTmpTarget() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-wire-test-'));
    fs.mkdirSync(path.join(dir, '.st8', 'schema-cards'), { recursive: true });
    return dir;
}

// Minimal persistence stub — only the methods FILE_AFTER_CHANGE P=20
// actually calls.
function stubPersistence() {
    return {
        getLastMutation: () => null,
        getMutationCount: () => 1,
    };
}

test('ticket 16 — FILE_AFTER_CHANGE wires schemaCard from emitter to printer', async (t) => {
    const targetDir = mkTmpTarget();
    t.after(() => fs.rmSync(targetDir, { recursive: true, force: true }));

    // Write a real file the emitter can stat/parse.
    const relPath = 'foo.js';
    fs.writeFileSync(path.join(targetDir, relPath), 'module.exports = 42;\n');

    const registry = new HookRegistry();
    registerDefaultSubscribers(registry);
    t.after(() => _resetDefaultSubscribersFlag(registry));

    const emitter = new SchemaCardEmitter(targetDir);

    // Stub the printer on the SINGLETON notification bus (the
    // FILE_AFTER_CHANGE P=30 subscriber lazy-requires the singleton).
    // Save + restore the previous printer so we don't bleed into other tests.
    const calls = [];
    const prevPrinter = notificationBus.printer;
    notificationBus.setPrinter({
        printCard: (card) => { calls.push(card); return '/tmp/fake.txt'; },
    });
    t.after(() => notificationBus.setPrinter(prevPrinter));

    // Build ctx like main.js does for the watcher EDIT branch.
    const file = {
        fingerprint: 'fp-foo-1',
        filepath: relPath,
        filename: 'foo.js',
        sha256Hash: 'a'.repeat(64),
        fileSizeBytes: 21,
        status: 'GREEN',
        reachabilityScore: 0.5,
        impactRadius: 0,
        lifecyclePhase: 'DEVELOPMENT',
        birthTimestamp: new Date().toISOString(),
        lastModified: new Date().toISOString(),
    };

    await registry.execute(HOOKS.FILE_AFTER_CHANGE, {
        change: { path: relPath, type: 'change' },
        file,
        mutation: {
            mutationType: 'EDIT',
            actor: 'WATCHER',
            sha256Hash: file.sha256Hash,
        },
        schemaCard: null,
        targetDir,
        persistence: stubPersistence(),
        emitter,
    });

    // The wire-up MUST have fired the printer with the freshly-emitted
    // card. Previously this was zero (the bug ticket 16 documents).
    assert.equal(calls.length, 1, `printer.printCard must fire once after FILE_AFTER_CHANGE; got ${calls.length}`);
    assert.equal(calls[0].fingerprint, 'fp-foo-1', 'printed card must reference the right fingerprint');
    assert.equal(calls[0].filepath, relPath, 'printed card must reference the right filepath');
});

test('ticket 16 — DELETE mutation does NOT fire the printer (no card to print)', async (t) => {
    const targetDir = mkTmpTarget();
    t.after(() => fs.rmSync(targetDir, { recursive: true, force: true }));

    const registry = new HookRegistry();
    registerDefaultSubscribers(registry);
    t.after(() => _resetDefaultSubscribersFlag(registry));

    const emitter = new SchemaCardEmitter(targetDir);

    const calls = [];
    const prevPrinter = notificationBus.printer;
    notificationBus.setPrinter({
        printCard: (card) => { calls.push(card); },
    });
    t.after(() => notificationBus.setPrinter(prevPrinter));

    const file = {
        fingerprint: 'fp-gone-1',
        filepath: 'gone.js',
        filename: 'gone.js',
        sha256Hash: 'b'.repeat(64),
    };

    await registry.execute(HOOKS.FILE_AFTER_CHANGE, {
        change: { path: 'gone.js', type: 'unlink' },
        file,
        mutation: { mutationType: 'DELETE', actor: 'WATCHER', sha256Hash: file.sha256Hash },
        schemaCard: null,
        targetDir,
        persistence: stubPersistence(),
        emitter,
    });

    // DELETE path returns early in the P=20 subscriber; P=30 still
    // publishes but with schemaCard: null → printer guard skips.
    assert.equal(calls.length, 0, 'DELETE must not invoke printer');
});
