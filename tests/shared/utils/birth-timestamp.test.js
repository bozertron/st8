'use strict';

/**
 * Tests for src/shared/utils/birth-timestamp.js — the identity-preservation
 * helper for ticket 15. Identity is the deepest contract in st8; these
 * tests must probe REAL stat shapes and REAL persistence behavior.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
    deriveBirthTimestamp,
    isUnreliableBirthtime,
    createFallbackReporter,
    UNRELIABLE_BIRTHTIME_CUTOFF_MS,
} = require('../../../src/shared/utils/birth-timestamp');

const EPOCH_DATE = new Date(0);
const PRE_1980_DATE = new Date('1970-06-15T00:00:00.000Z');
const REAL_DATE = new Date('2026-05-15T12:00:00.000Z');
const REAL_MTIME = new Date('2026-05-15T15:00:00.000Z');

function fakeStat({ birthtime, mtime }) {
    return { birthtime, mtime, size: 100 };
}

test('isUnreliableBirthtime: undefined is unreliable', () => {
    assert.equal(isUnreliableBirthtime({}), true);
    assert.equal(isUnreliableBirthtime({ birthtime: null }), true);
});

test('isUnreliableBirthtime: epoch is unreliable', () => {
    assert.equal(isUnreliableBirthtime(fakeStat({ birthtime: EPOCH_DATE })), true);
});

test('isUnreliableBirthtime: pre-1980 is unreliable', () => {
    assert.equal(isUnreliableBirthtime(fakeStat({ birthtime: PRE_1980_DATE })), true);
});

test('isUnreliableBirthtime: real birthtime is reliable', () => {
    assert.equal(isUnreliableBirthtime(fakeStat({ birthtime: REAL_DATE })), false);
});

test('isUnreliableBirthtime: cutoff is 1980-01-01', () => {
    assert.equal(
        UNRELIABLE_BIRTHTIME_CUTOFF_MS,
        new Date('1980-01-01T00:00:00.000Z').getTime()
    );
});

test('deriveBirthTimestamp: stat-birthtime origin when birthtime is reliable', () => {
    const r = deriveBirthTimestamp({
        stat: fakeStat({ birthtime: REAL_DATE, mtime: REAL_MTIME }),
        filepath: 'foo.js',
        silent: true,
    });
    assert.equal(r.origin, 'stat-birthtime');
    assert.equal(r.birthTimestamp, REAL_DATE.toISOString());
});

test('deriveBirthTimestamp: mtime-fallback when birthtime is epoch', () => {
    const r = deriveBirthTimestamp({
        stat: fakeStat({ birthtime: EPOCH_DATE, mtime: REAL_MTIME }),
        filepath: 'foo.js',
        silent: true,
    });
    assert.equal(r.origin, 'mtime-fallback');
    assert.equal(r.birthTimestamp, REAL_MTIME.toISOString());
});

test('deriveBirthTimestamp: fallback reporter records the event', () => {
    const reporter = createFallbackReporter();
    deriveBirthTimestamp({
        stat: fakeStat({ birthtime: EPOCH_DATE, mtime: REAL_MTIME }),
        filepath: 'foo.js',
        reporter,
        silent: true,
    });
    deriveBirthTimestamp({
        stat: fakeStat({ birthtime: REAL_DATE, mtime: REAL_MTIME }),
        filepath: 'bar.js',
        reporter,
        silent: true,
    });
    const summary = reporter.summary();
    assert.equal(summary.count, 1, 'only the epoch case should be recorded');
    assert.equal(summary.filepaths[0], 'foo.js');
    assert.equal(summary.records[0].birthTimestamp, REAL_MTIME.toISOString());
});

test('deriveBirthTimestamp: persisted birthTimestamp wins over fresh stat (identity preservation)', () => {
    // This is the core ticket-15 probe: a file that has been observed by
    // st8 before keeps its first-observed birthTimestamp even if stat
    // would return something different on a later pass.
    const persistedBirth = '2026-01-01T00:00:00.000Z';
    const fakePersistence = {
        getFileByPath(filepath) {
            return filepath === 'foo.js'
                ? { filepath, birthTimestamp: persistedBirth, fingerprint: `foo.js||${persistedBirth}` }
                : undefined;
        },
    };
    const r = deriveBirthTimestamp({
        stat: fakeStat({ birthtime: REAL_DATE, mtime: REAL_MTIME }),
        filepath: 'foo.js',
        persistence: fakePersistence,
        silent: true,
    });
    assert.equal(r.origin, 'reused-persisted');
    assert.equal(r.birthTimestamp, persistedBirth);
});

test('deriveBirthTimestamp: persisted reuse rescues mtime-fallback case (identity preserved across mtime drift)', () => {
    // The exact failure mode ticket 15 names: stat.birthtime is epoch AND
    // mtime drifted (touch, git checkout). Without reuse the fingerprint
    // would silently change. With reuse it doesn't.
    const persistedBirth = '2026-01-01T00:00:00.000Z';
    const fakePersistence = {
        getFileByPath() {
            return { filepath: 'foo.js', birthTimestamp: persistedBirth };
        },
    };
    const r = deriveBirthTimestamp({
        stat: fakeStat({ birthtime: EPOCH_DATE, mtime: new Date('2026-06-15T00:00:00.000Z') }),
        filepath: 'foo.js',
        persistence: fakePersistence,
        silent: true,
    });
    assert.equal(r.origin, 'reused-persisted');
    assert.equal(r.birthTimestamp, persistedBirth);
});

test('deriveBirthTimestamp: persistence throw degrades gracefully to stat path', () => {
    const fakePersistence = {
        getFileByPath() {
            throw new Error('db locked');
        },
    };
    const r = deriveBirthTimestamp({
        stat: fakeStat({ birthtime: REAL_DATE, mtime: REAL_MTIME }),
        filepath: 'foo.js',
        persistence: fakePersistence,
        silent: true,
    });
    assert.equal(r.origin, 'stat-birthtime');
    assert.equal(r.birthTimestamp, REAL_DATE.toISOString());
});

test('deriveBirthTimestamp: end-to-end with real fs.stat preserves identity across two passes', async () => {
    // Real-filesystem probe: write a file, derive once, mutate the file,
    // derive again WITH the prior result as a fake persistence. The
    // birthTimestamp must NOT change between passes.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-birth-test-'));
    const target = path.join(tmp, 'sample.js');
    fs.writeFileSync(target, 'exports.a = 1;\n');
    try {
        const stat1 = fs.statSync(target);
        const pass1 = deriveBirthTimestamp({
            stat: stat1,
            filepath: 'sample.js',
            silent: true,
        });
        assert.ok(pass1.birthTimestamp);

        // Simulate the persistence layer remembering pass 1
        const fakePersistence = {
            getFileByPath() {
                return { filepath: 'sample.js', birthTimestamp: pass1.birthTimestamp };
            },
        };

        // Mutate the file — mtime moves
        await new Promise((r) => setTimeout(r, 20));
        fs.writeFileSync(target, 'exports.a = 2;\n');
        const stat2 = fs.statSync(target);
        assert.notEqual(stat2.mtime.getTime(), stat1.mtime.getTime(), 'mtime must have moved for the test to be meaningful');

        const pass2 = deriveBirthTimestamp({
            stat: stat2,
            filepath: 'sample.js',
            persistence: fakePersistence,
            silent: true,
        });
        assert.equal(pass2.birthTimestamp, pass1.birthTimestamp, 'identity must persist across the edit');
        assert.equal(pass2.origin, 'reused-persisted');
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('createFallbackReporter: records list is a snapshot, not a live ref', () => {
    const reporter = createFallbackReporter();
    reporter.recordFallback('a.js', '2026-01-01T00:00:00.000Z');
    const snap = reporter.summary();
    reporter.recordFallback('b.js', '2026-01-02T00:00:00.000Z');
    assert.equal(snap.count, 1, 'summary() must snapshot at call time');
});
