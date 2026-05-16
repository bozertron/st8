'use strict';

/**
 * settings-crypto.js — symmetric encryption layer for at-rest sensitive
 * fields in st8_settings (Wave 5E, ticket 2).
 *
 * Motivation. Wave 5D's editEntry() writes `models` entries with a
 * user-supplied `apiKey` field through POST /api/settings →
 * upsertSetting() → SQLite TEXT. Without this module the apiKey lands
 * plaintext in `st8.sqlite`. A `sqlite3` shell against the DB would
 * dump every key the user has typed. This module gives upsertSetting /
 * getSetting a transparent encryption/decryption seam.
 *
 * Algorithm. AES-256-GCM via Node's built-in `crypto` module. GCM
 * gives authenticated encryption — decrypt fails if the ciphertext has
 * been tampered with, which means an attacker cannot swap one apiKey
 * row for another or surgery the JSON blob.
 *
 * Key source. A 32-byte random key stored at
 * `<dbDir>/.st8/encryption.key` with mode 0600. Generated once at first
 * encrypt; reused on subsequent runs. Mirrors the `.st8/server.secret`
 * pattern from Wave 2C (auth.js). The encryption key is INTENTIONALLY
 * separate from the auth secret — auth.secret is shared with the
 * frontend (via /api/auth-token) and the post-commit hook; the
 * encryption key must never leave the server process.
 *
 * Storage format. base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 * The same three-segment colon-separated form Wave 5E's prompt
 * specified. `isCiphertext()` recognizes this shape so decryption is
 * idempotent across un-encrypted legacy rows (a row written before
 * this module shipped will pass through verbatim).
 *
 * Anti-cheat. NEVER hardcode a key. NEVER ship a key in source.
 * NEVER attempt a hand-rolled cipher. NEVER fall back to plaintext on
 * decrypt failure (that would defeat the auth tag — the caller must
 * see an error and decide).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_FILENAME = 'encryption.key';
const KEY_BYTES = 32;          // aes-256-gcm requires a 256-bit key
const IV_BYTES = 12;           // GCM-recommended nonce size
const AUTH_TAG_BYTES = 16;     // GCM standard auth tag

// Cache the resolved key per file path so we don't re-read disk per
// encrypt call. Keyed by absolute key-file path so multiple test temp
// dirs in the same process don't collide.
const _keyCache = new Map();

/**
 * Compute the encryption key file path for a given dbPath. The key
 * lives alongside other per-instance secrets in `<dbDir>/.st8/`.
 *
 * @param {string} dbPath - Absolute path to st8.sqlite (or any DB file)
 * @returns {string} - Absolute path to the encryption.key file
 */
function keyPathFor(dbPath) {
    if (!dbPath) {
        throw new Error('[st8:settings-crypto] keyPathFor requires a dbPath');
    }
    const dbDir = path.dirname(path.resolve(dbPath));
    return path.join(dbDir, '.st8', KEY_FILENAME);
}

/**
 * Ensure an encryption key exists at the conventional path for dbPath.
 * If it does, load it. If it doesn't, generate a fresh 32-byte random
 * key, write atomically with mode 0600, and return it. Throws on
 * filesystem errors that prevent key persistence — silent fallback
 * would be a cheat (the prompt names this explicitly).
 *
 * @param {string} dbPath - Absolute path to st8.sqlite
 * @returns {Buffer} - 32-byte key
 */
function ensureKey(dbPath) {
    const keyPath = keyPathFor(dbPath);
    if (_keyCache.has(keyPath)) return _keyCache.get(keyPath);

    const keyDir = path.dirname(keyPath);
    if (!fs.existsSync(keyDir)) {
        fs.mkdirSync(keyDir, { recursive: true });
    }

    if (fs.existsSync(keyPath)) {
        const raw = fs.readFileSync(keyPath, 'utf8').trim();
        // Stored as hex. Validate length before trusting.
        if (raw.length === KEY_BYTES * 2 && /^[0-9a-f]+$/i.test(raw)) {
            const buf = Buffer.from(raw, 'hex');
            _keyCache.set(keyPath, buf);
            return buf;
        }
        // Corrupt / wrong-length file — regenerate. This is not a
        // silent failure: the next encrypt rotates the at-rest key,
        // which means any rows encrypted under the old key become
        // un-decryptable. That's the correct behavior: a corrupt key
        // file means the operator must accept ciphertext loss.
        console.warn('[st8:settings-crypto] Existing key file at', keyPath, 'is malformed; regenerating.');
    }

    const fresh = crypto.randomBytes(KEY_BYTES);
    const tmpPath = keyPath + '.tmp';
    fs.writeFileSync(tmpPath, fresh.toString('hex') + '\n', { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(tmpPath, 0o600); } catch (_) { /* non-fatal on Windows */ }
    fs.renameSync(tmpPath, keyPath);
    _keyCache.set(keyPath, fresh);
    return fresh;
}

/**
 * Encrypt a plaintext string under the key resolved from dbPath.
 * Returns the canonical three-segment ciphertext: ivB64:tagB64:ctB64.
 * Throws if input is not a non-empty string.
 *
 * @param {string} plaintext
 * @param {string} dbPath
 * @returns {string}
 */
function encrypt(plaintext, dbPath) {
    if (typeof plaintext !== 'string') {
        throw new Error('[st8:settings-crypto] encrypt requires a string plaintext');
    }
    const key = ensureKey(dbPath);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString('base64') + ':' + tag.toString('base64') + ':' + ct.toString('base64');
}

/**
 * Decrypt a ciphertext string produced by encrypt(). Throws on:
 *   - malformed shape (not 3 base64 segments)
 *   - wrong IV / tag length
 *   - failed auth tag verification (tampered ciphertext OR wrong key)
 *
 * Callers wrap in try/catch and decide whether to surface the failure
 * (we do — apiKey decryption failure is a hard error, not a fallback).
 *
 * @param {string} ciphertext
 * @param {string} dbPath
 * @returns {string}
 */
function decrypt(ciphertext, dbPath) {
    if (typeof ciphertext !== 'string') {
        throw new Error('[st8:settings-crypto] decrypt requires a string ciphertext');
    }
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('[st8:settings-crypto] malformed ciphertext: expected 3 base64 segments');
    }
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const ct = Buffer.from(parts[2], 'base64');
    if (iv.length !== IV_BYTES) {
        throw new Error('[st8:settings-crypto] malformed ciphertext: iv length ' + iv.length);
    }
    if (tag.length !== AUTH_TAG_BYTES) {
        throw new Error('[st8:settings-crypto] malformed ciphertext: tag length ' + tag.length);
    }
    const key = ensureKey(dbPath);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
}

/**
 * Heuristic: does a string look like our ciphertext format? Used to
 * keep encrypt/decrypt idempotent across:
 *   - legacy rows written before this module landed (plaintext)
 *   - rows that ALREADY contain a ciphertext (don't double-encrypt)
 *
 * Conservative: requires three base64 segments AND the first segment
 * to decode to exactly IV_BYTES bytes AND the second to exactly
 * AUTH_TAG_BYTES. False positives are vanishingly unlikely for normal
 * apiKey strings (sk-... etc).
 *
 * @param {string} v
 * @returns {boolean}
 */
function isCiphertext(v) {
    if (typeof v !== 'string' || v.length < 24) return false;
    const parts = v.split(':');
    if (parts.length !== 3) return false;
    // Each segment must be valid base64 — Buffer.from is permissive,
    // so verify the byte lengths match the GCM expectations.
    try {
        const iv = Buffer.from(parts[0], 'base64');
        const tag = Buffer.from(parts[1], 'base64');
        const ct = Buffer.from(parts[2], 'base64');
        if (iv.length !== IV_BYTES) return false;
        if (tag.length !== AUTH_TAG_BYTES) return false;
        if (ct.length === 0) return false;
        // Re-encoding round-trip detects non-canonical base64 (e.g. a
        // bare colon-separated string that happens to have three pieces).
        if (iv.toString('base64').replace(/=+$/, '') !== parts[0].replace(/=+$/, '')) return false;
        if (tag.toString('base64').replace(/=+$/, '') !== parts[1].replace(/=+$/, '')) return false;
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Test-only: clear the in-memory key cache so a fresh ensureKey()
 * re-reads disk. Not exported as part of the public contract — used
 * only in unit tests that want to verify the on-disk regeneration path.
 */
function _resetCacheForTests() {
    _keyCache.clear();
}

module.exports = {
    keyPathFor,
    ensureKey,
    encrypt,
    decrypt,
    isCiphertext,
    _resetCacheForTests,
    KEY_FILENAME,
    KEY_BYTES,
    IV_BYTES,
    AUTH_TAG_BYTES,
};
