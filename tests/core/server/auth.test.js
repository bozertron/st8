'use strict';

/**
 * tests/core/server/auth.test.js — shared-secret auth module probes
 * (ticket 27).
 *
 * Covers:
 *   - ensureSecret() generates a 64-hex-char secret on first call,
 *     writes the file with mode 0600, and is idempotent (second call
 *     returns the same value).
 *   - readSecret() reads back what ensureSecret wrote; returns null
 *     for missing dir / missing file / too-short content.
 *   - safeEqual() — true on equal strings, false on differing length
 *     or any byte; rejects non-string inputs.
 *   - checkRequest() returns ok:false with the correct reason for
 *     each rejection class (no-secret-on-disk, missing-header,
 *     wrong-secret) and ok:true on a valid header.
 *   - isLoopback() accepts 127.0.0.1, ::1, ::ffff:127.0.0.1 and
 *     rejects external addresses.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const auth = require('../../../src/core/server/auth');

function freshTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'st8-auth-test-'));
}

test('ensureSecret — generates a 64-hex-char secret on first call', () => {
  const dir = freshTempDir();
  try {
    const secret = auth.ensureSecret(dir);
    assert.equal(typeof secret, 'string');
    assert.equal(secret.length, 64, '32 bytes -> 64 hex chars');
    assert.match(secret, /^[0-9a-f]{64}$/);
    // File exists on disk.
    const p = path.join(dir, '.st8', auth.SECRET_FILENAME);
    assert.equal(fs.existsSync(p), true);
    // File contents match (sans trailing newline).
    const onDisk = fs.readFileSync(p, 'utf8').trim();
    assert.equal(onDisk, secret);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureSecret — is idempotent (second call returns the same secret)', () => {
  const dir = freshTempDir();
  try {
    const a = auth.ensureSecret(dir);
    const b = auth.ensureSecret(dir);
    assert.equal(a, b, 'second call must return the same secret, not regenerate');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureSecret — writes file with mode 0600', { skip: process.platform === 'win32' }, () => {
  const dir = freshTempDir();
  try {
    auth.ensureSecret(dir);
    const p = path.join(dir, '.st8', auth.SECRET_FILENAME);
    const stat = fs.statSync(p);
    // Mask off the file-type bits, look at the 9 permission bits.
    const mode = stat.mode & 0o777;
    assert.equal(mode, 0o600, `mode should be 0600, got 0${mode.toString(8)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureSecret — throws on missing targetDir', () => {
  assert.throws(() => auth.ensureSecret(null), /requires a targetDir/);
  assert.throws(() => auth.ensureSecret(undefined), /requires a targetDir/);
});

test('readSecret — returns null when file does not exist', () => {
  const dir = freshTempDir();
  try {
    assert.equal(auth.readSecret(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readSecret — returns the on-disk secret after ensureSecret', () => {
  const dir = freshTempDir();
  try {
    const wrote = auth.ensureSecret(dir);
    const read = auth.readSecret(dir);
    assert.equal(read, wrote);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readSecret — returns null on too-short / empty content', () => {
  const dir = freshTempDir();
  try {
    const st8Dir = path.join(dir, '.st8');
    fs.mkdirSync(st8Dir);
    fs.writeFileSync(path.join(st8Dir, auth.SECRET_FILENAME), 'short\n');
    assert.equal(auth.readSecret(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('safeEqual — true on equal strings, false on any difference', () => {
  assert.equal(auth.safeEqual('abc123', 'abc123'), true);
  assert.equal(auth.safeEqual('abc123', 'abc124'), false);
  assert.equal(auth.safeEqual('abc12', 'abc123'), false, 'length mismatch must be false');
  assert.equal(auth.safeEqual('', ''), true);
  // Non-string inputs are always false (no throw).
  assert.equal(auth.safeEqual(null, 'x'), false);
  assert.equal(auth.safeEqual('x', null), false);
  assert.equal(auth.safeEqual(undefined, undefined), false);
  assert.equal(auth.safeEqual({ secret: 'x' }, 'x'), false);
});

test('checkRequest — returns 503/no-secret-on-disk when secret file missing', () => {
  const dir = freshTempDir();
  try {
    const req = { headers: {} };
    const r = auth.checkRequest(req, dir);
    assert.equal(r.ok, false);
    assert.equal(r.status, 503);
    assert.equal(r.reason, 'no-secret-on-disk');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkRequest — returns 401/missing-header when header absent', () => {
  const dir = freshTempDir();
  try {
    auth.ensureSecret(dir);
    const req = { headers: {} };
    const r = auth.checkRequest(req, dir);
    assert.equal(r.ok, false);
    assert.equal(r.status, 401);
    assert.equal(r.reason, 'missing-header');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkRequest — returns 401/wrong-secret when header value mismatches', () => {
  const dir = freshTempDir();
  try {
    auth.ensureSecret(dir);
    const req = { headers: { 'x-st8-secret': 'totally-wrong-value-' + 'x'.repeat(40) } };
    const r = auth.checkRequest(req, dir);
    assert.equal(r.ok, false);
    assert.equal(r.status, 401);
    assert.equal(r.reason, 'wrong-secret');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkRequest — returns ok:true with the correct secret', () => {
  const dir = freshTempDir();
  try {
    const secret = auth.ensureSecret(dir);
    const req = { headers: { 'x-st8-secret': secret } };
    const r = auth.checkRequest(req, dir);
    assert.deepEqual(r, { ok: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('isLoopback — accepts standard loopback addresses', () => {
  assert.equal(auth.isLoopback({ socket: { remoteAddress: '127.0.0.1' } }), true);
  assert.equal(auth.isLoopback({ socket: { remoteAddress: '::1' } }), true);
  assert.equal(auth.isLoopback({ socket: { remoteAddress: '::ffff:127.0.0.1' } }), true);
});

test('isLoopback — rejects external addresses + missing socket', () => {
  assert.equal(auth.isLoopback({ socket: { remoteAddress: '192.168.1.5' } }), false);
  assert.equal(auth.isLoopback({ socket: { remoteAddress: '10.0.0.1' } }), false);
  assert.equal(auth.isLoopback({ socket: { remoteAddress: '8.8.8.8' } }), false);
  assert.equal(auth.isLoopback({ socket: {} }), false);
  assert.equal(auth.isLoopback({}), false);
});
