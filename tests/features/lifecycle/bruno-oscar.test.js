'use strict';

/**
 * tests/features/lifecycle/bruno-oscar.test.js — Wave 4B tickets 9, 10, 11.
 *
 * Covers:
 *   - Ticket 9: bruno-oscar wired as INDEX_START subscriber. A synthetic
 *     INDEX_START fire actually flags stale files via runBrunoCall.
 *   - Ticket 10: LIFECYCLE_TRANSITION publisher fires on
 *     active→flagged (runBrunoCall), flagged→archived (runOscarHouse),
 *     and archived→active (onEventTriggered).
 *   - Ticket 11: _appendToParent is wired into runOscarHouse and fires
 *     for files with associatedWith set (and is a no-op for files
 *     without).
 *
 * Tests use the real St8Persistence against a temp DB plus a real
 * HookRegistry (fresh instance, never the singleton, so other tests are
 * isolated). The notificationBus singleton is fine to share — it has
 * no in-process subscribers in the suite.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Persistence } = require('../../../src/core/database/persistence');
const { BrunoOscar } = require('../../../src/features/lifecycle/bruno-oscar');
const { notificationBus } = require('../../../src/core/notification-bus');
const { HookRegistry, HOOKS, hookRegistry: singletonRegistry } = require('../../../src/core/hook-registry');
const { registerDefaultSubscribers, _resetDefaultSubscribersFlag } = require('../../../src/core/hooks/default-subscribers');

function freshTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'st8-bruno-oscar-test-'));
}

function freshPersistence() {
    const dir = freshTempDir();
    const origCwd = process.cwd();
    process.chdir(dir);
    const p = new St8Persistence();
    p.initialize();
    return {
        persistence: p,
        targetDir: dir,
        cleanup: () => {
            try { p.close(); } catch (_) {}
            process.chdir(origCwd);
        },
    };
}

function insertFile(persistence, overrides = {}) {
    const fp = overrides.fingerprint || `fp-${Math.random().toString(36).slice(2)}`;
    const fields = {
        fingerprint: fp,
        filepath: overrides.filepath || `f/${fp}.js`,
        filename: overrides.filename || `${fp}.js`,
        sha256Hash: 'abc',
        sessionsSinceAccess: overrides.sessionsSinceAccess ?? 0,
        brunoStatus: overrides.brunoStatus || 'active',
        associatedWith: overrides.associatedWith || null,
        eventTrigger: overrides.eventTrigger || null,
    };
    persistence.db.prepare(
        `INSERT INTO file_registry
           (fingerprint, filepath, filename, sha256Hash, sessionsSinceAccess, brunoStatus, associatedWith, eventTrigger)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        fields.fingerprint, fields.filepath, fields.filename, fields.sha256Hash,
        fields.sessionsSinceAccess, fields.brunoStatus, fields.associatedWith, fields.eventTrigger
    );
    return fields;
}

// ─── Ticket 10: LIFECYCLE_TRANSITION publisher ───────────────────────────

test('runBrunoCall fires LIFECYCLE_TRANSITION active→flagged per stale file', async () => {
    const { persistence, cleanup } = freshPersistence();
    try {
        insertFile(persistence, { fingerprint: 'fp-stale-1', filepath: 's1.js', sessionsSinceAccess: 10 });
        insertFile(persistence, { fingerprint: 'fp-stale-2', filepath: 's2.js', sessionsSinceAccess: 10 });
        insertFile(persistence, { fingerprint: 'fp-fresh',   filepath: 'fresh.js', sessionsSinceAccess: 0 });

        // Wire a real subscriber on the singleton — bruno-oscar uses the
        // singleton via lazy require. Capture transitions in an array.
        const transitions = [];
        const unsubscribe = singletonRegistry.register(
            HOOKS.LIFECYCLE_TRANSITION,
            (ctx) => { transitions.push(ctx); },
            { priority: 100, source: 'test-capture' }
        );

        try {
            const bruno = new BrunoOscar(persistence, notificationBus);
            const result = await bruno.runBrunoCall(5);
            assert.equal(result.flaggedFiles, 2, 'only the two stale files should flip to flagged');
            assert.equal(transitions.length, 2, 'LIFECYCLE_TRANSITION should fire once per flagged file');
            for (const t of transitions) {
                assert.equal(t.oldPhase, 'active');
                assert.equal(t.newPhase, 'flagged');
                assert.ok(t.file && t.file.fingerprint, 'payload must carry file.fingerprint');
                assert.ok(t.file.filepath, 'payload must carry file.filepath');
            }
            const flaggedFps = new Set(transitions.map((t) => t.file.fingerprint));
            assert.ok(flaggedFps.has('fp-stale-1'));
            assert.ok(flaggedFps.has('fp-stale-2'));
            assert.ok(!flaggedFps.has('fp-fresh'));
        } finally {
            unsubscribe();
        }
    } finally {
        cleanup();
    }
});

test('runOscarHouse fires LIFECYCLE_TRANSITION flagged→archived per archive', async () => {
    const { persistence, cleanup } = freshPersistence();
    try {
        insertFile(persistence, { fingerprint: 'fp-f1', filepath: 'a.js', brunoStatus: 'flagged' });
        insertFile(persistence, { fingerprint: 'fp-f2', filepath: 'b.js', brunoStatus: 'flagged' });

        const transitions = [];
        const unsubscribe = singletonRegistry.register(
            HOOKS.LIFECYCLE_TRANSITION,
            (ctx) => { transitions.push(ctx); },
            { priority: 100, source: 'test-capture' }
        );

        try {
            const oscar = new BrunoOscar(persistence, notificationBus);
            const result = await oscar.runOscarHouse(7);
            assert.equal(result.archivedFiles, 2);
            assert.equal(transitions.length, 2);
            for (const t of transitions) {
                assert.equal(t.oldPhase, 'flagged');
                assert.equal(t.newPhase, 'archived');
            }
        } finally {
            unsubscribe();
        }
    } finally {
        cleanup();
    }
});

test('onEventTriggered fires LIFECYCLE_TRANSITION archived→active per un-archive', async () => {
    const { persistence, cleanup } = freshPersistence();
    try {
        insertFile(persistence, { fingerprint: 'fp-arch', filepath: 'arch.js', brunoStatus: 'archived', eventTrigger: 'ci-pass' });
        insertFile(persistence, { fingerprint: 'fp-other', filepath: 'other.js', brunoStatus: 'archived', eventTrigger: 'other' });

        const transitions = [];
        const unsubscribe = singletonRegistry.register(
            HOOKS.LIFECYCLE_TRANSITION,
            (ctx) => { transitions.push(ctx); },
            { priority: 100, source: 'test-capture' }
        );

        try {
            const bruno = new BrunoOscar(persistence, notificationBus);
            const result = await bruno.onEventTriggered('ci-pass');
            assert.equal(result.unarchivedFiles, 1);
            assert.equal(transitions.length, 1);
            assert.equal(transitions[0].oldPhase, 'archived');
            assert.equal(transitions[0].newPhase, 'active');
            assert.equal(transitions[0].file.fingerprint, 'fp-arch');
        } finally {
            unsubscribe();
        }
    } finally {
        cleanup();
    }
});

// ─── Ticket 11: _appendToParent wired into runOscarHouse ─────────────────

test('runOscarHouse calls _appendToParent for files with associatedWith set', async () => {
    const { persistence, targetDir, cleanup } = freshPersistence();
    try {
        const parentPath = path.join(targetDir, 'parent.md');
        const childPath = path.join(targetDir, 'child.md');
        fs.writeFileSync(parentPath, '# Parent\n');
        fs.writeFileSync(childPath, '# Child content — should land in parent\n');

        // The flagged file's filepath is what _appendToParent reads. It
        // passes file.filepath to fs.readFileSync directly, so we use the
        // absolute path as filepath (matches the bruno-oscar contract:
        // filepath is what the watcher recorded, typically absolute or
        // resolvable from cwd).
        insertFile(persistence, {
            fingerprint: 'fp-child',
            filepath: childPath,
            brunoStatus: 'flagged',
            associatedWith: parentPath,
        });

        const oscar = new BrunoOscar(persistence, notificationBus);
        const result = await oscar.runOscarHouse(7);
        assert.equal(result.archivedFiles, 1);

        // Parent must now contain the appended child block.
        const parentNow = fs.readFileSync(parentPath, 'utf-8');
        assert.match(parentNow, /APPENDED BY OSCAR/);
        assert.match(parentNow, /Child content/);
    } finally {
        cleanup();
    }
});

test('runOscarHouse no-ops _appendToParent for files without associatedWith', async () => {
    const { persistence, targetDir, cleanup } = freshPersistence();
    try {
        const orphanPath = path.join(targetDir, 'orphan.md');
        fs.writeFileSync(orphanPath, '# Orphan — no parent\n');

        insertFile(persistence, {
            fingerprint: 'fp-orphan',
            filepath: orphanPath,
            brunoStatus: 'flagged',
            associatedWith: null,
        });

        const oscar = new BrunoOscar(persistence, notificationBus);
        const result = await oscar.runOscarHouse(7);
        assert.equal(result.archivedFiles, 1);
        // Sanity: nothing crashed, file still on disk, brunoStatus flipped.
        const row = persistence.db.prepare('SELECT brunoStatus FROM file_registry WHERE fingerprint = ?').get('fp-orphan');
        assert.equal(row.brunoStatus, 'archived');
    } finally {
        cleanup();
    }
});

// ─── Ticket 9: bruno wired as INDEX_START subscriber ─────────────────────

test('bruno-session-start subscriber is registered on INDEX_START with correct priority', () => {
    // Static-shape probe: registerDefaultSubscribers must wire
    // bruno-session-start as an INDEX_START subscriber at P=20 (after
    // sonic-daemon at P=10, before any future consumer). This test does
    // NOT execute the hook (to avoid spawning sonic-daemon as a side
    // effect of a unit test) — it only verifies the registration shape.
    // The "does it actually fire bruno" probe is the next test below,
    // which uses a hand-built registry with only the bruno subscriber.
    const reg = new HookRegistry();
    registerDefaultSubscribers(reg);

    const sources = reg.introspectExecuteOrder(HOOKS.INDEX_START);
    assert.ok(sources.includes('bruno-session-start'),
        `INDEX_START should include bruno-session-start subscriber — got: ${sources.join(', ')}`);
    const sonicIdx = sources.indexOf('sonic-daemon');
    const brunoIdx = sources.indexOf('bruno-session-start');
    assert.ok(brunoIdx > sonicIdx,
        'bruno-session-start (P=20) should run after sonic-daemon (P=10)');

    _resetDefaultSubscribersFlag(reg);
    reg.clear();
});

test('INDEX_START fire actually flags stale files via bruno (hermetic — bruno-only)', async () => {
    const { persistence, targetDir, cleanup } = freshPersistence();
    try {
        insertFile(persistence, { fingerprint: 'fp-s1', filepath: 'i1.js', sessionsSinceAccess: 10 });
        insertFile(persistence, { fingerprint: 'fp-s2', filepath: 'i2.js', sessionsSinceAccess: 10 });
        insertFile(persistence, { fingerprint: 'fp-fresh', filepath: 'fresh.js', sessionsSinceAccess: 0 });

        // Hand-build a registry with ONLY the bruno subscriber to avoid
        // sonic-daemon spawn-on-INDEX_START side effects inside the test
        // process (sonic spawns a child process that keeps node alive
        // past test completion). The subscriber body itself is the
        // exact code from default-subscribers.js — copied verbatim so
        // we exercise the real fire path without registering the rest
        // of the chain.
        const reg = new HookRegistry();
        reg.register(HOOKS.INDEX_START, async (ctx) => {
            if (!ctx || !ctx.persistence) return;
            const bruno = new BrunoOscar(ctx.persistence, notificationBus);
            await bruno.runBrunoCall();
        }, { priority: 20, source: 'bruno-session-start' });

        const summary = await reg.execute(HOOKS.INDEX_START, { targetDir, persistence });
        assert.equal(summary.fail, 0, `expected no subscriber failures, got: ${JSON.stringify(summary.errors)}`);
        assert.equal(summary.ok, 1);

        const flagged = persistence.db.prepare(
            "SELECT fingerprint FROM file_registry WHERE brunoStatus = 'flagged' ORDER BY fingerprint"
        ).all();
        assert.equal(flagged.length, 2, 'both stale files should be flagged by the INDEX_START scan');
        assert.deepEqual(flagged.map((r) => r.fingerprint), ['fp-s1', 'fp-s2']);

        reg.clear();
    } finally {
        cleanup();
    }
});
