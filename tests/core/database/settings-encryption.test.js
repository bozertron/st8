'use strict';

/**
 * tests/core/database/settings-encryption.test.js — Wave 5E ticket 2.
 *
 * Probes the at-rest encryption seam between upsertSetting and
 * SQLite for `models` category entries:
 *
 *   1. Round-trip: write an entry with a plaintext apiKey via
 *      upsertSetting → read back via getSetting → confirm the apiKey
 *      decrypts to the original plaintext.
 *   2. Raw-row probe: bypass the decryption layer (via the
 *      _getRawSetting test hook) and confirm the value persisted to
 *      SQLite is CIPHERTEXT, not plaintext. This is the kickback-
 *      worthy assertion the wave prompt names explicitly.
 *   3. Non-models categories pass through unencrypted.
 *   4. Idempotency: re-upserting an already-encrypted entry does NOT
 *      double-encrypt.
 *   5. Key file generation: encryption.key is created at
 *      <dbDir>/.st8/encryption.key with mode 0600.
 *   6. Decryption of a corrupt ciphertext returns the
 *      '[decrypt-failed]' marker without throwing.
 *   7. crypto module: encrypt → decrypt round-trip on a raw string.
 *   8. crypto module: isCiphertext() recognizes our shape and rejects
 *      plain strings.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Persistence } = require('../../../src/core/database/persistence');
const crypto = require('../../../src/shared/utils/settings-crypto');

function freshDb() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-crypto-test-'));
    return { dir, dbPath: path.join(dir, 'st8.sqlite') };
}

async function openPersistence(dbPath) {
    const p = new St8Persistence(dbPath);
    await p.initialize();
    return p;
}

test('crypto: encrypt + decrypt round-trip preserves plaintext', (t) => {
    const { dir, dbPath } = freshDb();
    t.after(() => { crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    const pt = 'sk-ant-test-12345-the-real-key';
    const ct = crypto.encrypt(pt, dbPath);
    assert.notEqual(ct, pt, 'ciphertext must differ from plaintext');
    assert.equal(ct.split(':').length, 3, 'ciphertext must have 3 colon-separated segments');

    const decoded = crypto.decrypt(ct, dbPath);
    assert.equal(decoded, pt, 'decrypt must restore the original plaintext');
});

test('crypto: isCiphertext recognizes our shape and rejects plaintext', (t) => {
    const { dir, dbPath } = freshDb();
    t.after(() => { crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    const ct = crypto.encrypt('hello', dbPath);
    assert.equal(crypto.isCiphertext(ct), true);
    assert.equal(crypto.isCiphertext('sk-ant-plain-key'), false);
    assert.equal(crypto.isCiphertext('foo:bar:baz'), false, 'three-segment string with non-base64 IV must be rejected');
    assert.equal(crypto.isCiphertext(''), false);
    assert.equal(crypto.isCiphertext(null), false);
});

test('crypto: key file is created at <dbDir>/.st8/encryption.key with mode 0600', (t) => {
    const { dir, dbPath } = freshDb();
    t.after(() => { crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    crypto.encrypt('trigger-key-creation', dbPath);
    const keyPath = path.join(dir, '.st8', 'encryption.key');
    assert.equal(fs.existsSync(keyPath), true, 'encryption.key must be written');

    // Mode check is meaningful on POSIX only; skip on Windows.
    if (process.platform !== 'win32') {
        const stat = fs.statSync(keyPath);
        const mode = stat.mode & 0o777;
        assert.equal(mode, 0o600, 'encryption.key must be mode 0600 (got ' + mode.toString(8) + ')');
    }

    const raw = fs.readFileSync(keyPath, 'utf8').trim();
    assert.equal(raw.length, 64, 'key file must contain 32 bytes hex-encoded (64 chars)');
});

test('persistence: round-trip — write plaintext apiKey, read back decrypted', async (t) => {
    const { dir, dbPath } = freshDb();
    crypto._resetCacheForTests();
    const p = await openPersistence(dbPath);
    t.after(() => { p.close(); crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    const entries = [
        { id: 'claude-1', name: 'Claude Sonnet', provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk-ant-test-real-secret', baseUrl: '', enabled: true },
        { id: 'gpt-1', name: 'GPT-4', provider: 'openai', model: 'gpt-4', apiKey: 'sk-openai-real-secret', baseUrl: '', enabled: false },
    ];
    p.upsertSetting('models', '_entries', entries);

    const out = p.getSetting('models', '_entries');
    assert.equal(out.length, 2);
    assert.equal(out[0].apiKey, 'sk-ant-test-real-secret', 'first entry apiKey must round-trip to plaintext');
    assert.equal(out[1].apiKey, 'sk-openai-real-secret', 'second entry apiKey must round-trip to plaintext');
    // Non-sensitive fields preserved.
    assert.equal(out[0].provider, 'anthropic');
    assert.equal(out[1].model, 'gpt-4');
    assert.equal(out[1].enabled, false);
});

test('persistence: RAW DB row contains ciphertext, NOT plaintext (kickback-worthy)', async (t) => {
    const { dir, dbPath } = freshDb();
    crypto._resetCacheForTests();
    const p = await openPersistence(dbPath);
    t.after(() => { p.close(); crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    const SECRET = 'sk-ant-LITERAL-SHOULD-NEVER-APPEAR-ON-DISK';
    p.upsertSetting('models', '_entries', [
        { id: 'x', name: 'X', provider: 'anthropic', model: 'm', apiKey: SECRET, baseUrl: '', enabled: true },
    ]);

    const raw = p._getRawSetting('models', '_entries');
    assert.equal(typeof raw, 'string', 'raw row must exist');
    assert.equal(raw.indexOf(SECRET), -1, 'plaintext apiKey must NOT appear in the raw row');

    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed), 'raw row is a JSON array');
    assert.equal(crypto.isCiphertext(parsed[0].apiKey), true, 'raw apiKey field must match the ciphertext shape');
});

test('persistence: non-models categories are NOT encrypted', async (t) => {
    const { dir, dbPath } = freshDb();
    crypto._resetCacheForTests();
    const p = await openPersistence(dbPath);
    t.after(() => { p.close(); crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    // Even if a different category had an apiKey-shaped field, it
    // must NOT be encrypted — encryption is scoped to models only.
    p.upsertSetting('sirkits', '_entries', [
        { id: 'fake', name: 'Fake', apiKey: 'should-stay-plaintext' },
    ]);
    const raw = p._getRawSetting('sirkits', '_entries');
    assert.ok(raw.indexOf('should-stay-plaintext') !== -1, 'sirkits apiKey-like field stays plaintext');
});

test('persistence: idempotent — re-upserting an encrypted entry does not double-encrypt', async (t) => {
    const { dir, dbPath } = freshDb();
    crypto._resetCacheForTests();
    const p = await openPersistence(dbPath);
    t.after(() => { p.close(); crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    const SECRET = 'sk-anthropic-idempotency-probe';
    p.upsertSetting('models', '_entries', [
        { id: 'a', name: 'A', provider: 'anthropic', apiKey: SECRET, enabled: true },
    ]);
    // Read decrypted, then write back (simulates a UI save after edit).
    const decryptedOnce = p.getSetting('models', '_entries');
    assert.equal(decryptedOnce[0].apiKey, SECRET);

    // Simulate a save flow that re-persists what the UI already has —
    // including, in a buggy world, the ciphertext-shape value still
    // sitting in the in-memory array. We send the already-encrypted
    // form back to upsertSetting. Idempotency requires that
    // round-tripping still yields the same plaintext (not double-encrypted).
    const raw = p._getRawSetting('models', '_entries');
    const arr = JSON.parse(raw);
    // arr[0].apiKey is ciphertext. Send it back.
    p.upsertSetting('models', '_entries', arr);
    const decryptedTwice = p.getSetting('models', '_entries');
    assert.equal(decryptedTwice[0].apiKey, SECRET, 'idempotent re-write must still decrypt to original plaintext');
});

test('persistence: corrupt ciphertext surfaces [decrypt-failed] marker', async (t) => {
    const { dir, dbPath } = freshDb();
    crypto._resetCacheForTests();
    const p = await openPersistence(dbPath);
    t.after(() => { p.close(); crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    // Build a syntactically valid ciphertext shape with wrong key/data.
    const fakeIv = Buffer.alloc(12, 1).toString('base64');
    const fakeTag = Buffer.alloc(16, 2).toString('base64');
    const fakeCt = Buffer.from('garbage').toString('base64');
    const corrupt = fakeIv + ':' + fakeTag + ':' + fakeCt;

    // Stuff the corrupt ciphertext directly into the DB to bypass
    // upsertSetting's encryption layer.
    p.db.prepare(`INSERT INTO st8_settings (category, key, value) VALUES (?, ?, ?)`)
        .run('models', '_entries', JSON.stringify([
            { id: 'broken', name: 'Broken', provider: 'anthropic', apiKey: corrupt, enabled: false },
        ]));

    // Silence the expected console.error for the duration of this test.
    const origErr = console.error;
    console.error = () => {};
    try {
        const out = p.getSetting('models', '_entries');
        assert.equal(out[0].apiKey, '[decrypt-failed]', 'corrupt ciphertext must yield a sentinel, not throw');
    } finally {
        console.error = origErr;
    }
});

test('persistence: getAllSettings + getSettingsByCategory decrypt models entries', async (t) => {
    const { dir, dbPath } = freshDb();
    crypto._resetCacheForTests();
    const p = await openPersistence(dbPath);
    t.after(() => { p.close(); crypto._resetCacheForTests(); fs.rmSync(dir, { recursive: true, force: true }); });

    const SECRET = 'sk-all-routes-decrypt';
    p.upsertSetting('models', '_entries', [
        { id: 'z', name: 'Z', provider: 'anthropic', apiKey: SECRET, enabled: true },
    ]);

    const all = p.getAllSettings();
    assert.equal(all.models._entries[0].apiKey, SECRET, 'getAllSettings must decrypt');

    const cat = p.getSettingsByCategory('models');
    assert.equal(cat._entries[0].apiKey, SECRET, 'getSettingsByCategory must decrypt');
});
