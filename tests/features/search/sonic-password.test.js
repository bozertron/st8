'use strict';

/**
 * Wave 5A ticket 9 — per-instance auth_password tests.
 *
 * Covers:
 *   - ensureSonicPassword() creates .st8/sonic.password on first call
 *   - second call returns the same password (no rotation)
 *   - file is mode 0600 (or platform best-effort on Windows)
 *   - the password is 64-hex-char (32 bytes)
 *   - SonicClient.setPassword() updates all three channels
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ensureSonicPassword } = require('../../../src/features/search/sonic-daemon');
const { SonicClient } = require('../../../src/features/search/sonic-client');

function mkTargetDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'st8-sonic-pw-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

test('ensureSonicPassword creates .st8/sonic.password on first call', () => {
  const dir = mkTargetDir();
  try {
    const pw = ensureSonicPassword(dir);
    assert.ok(pw, 'should return a password');
    assert.equal(pw.length, 64, 'should be 64 hex chars (32 bytes)');
    assert.match(pw, /^[0-9a-f]{64}$/);

    const onDisk = fs.readFileSync(path.join(dir, '.st8', 'sonic.password'), 'utf8').trim();
    assert.equal(onDisk, pw, 'on-disk file matches returned password');
  } finally {
    cleanup(dir);
  }
});

test('ensureSonicPassword is idempotent — second call returns the same password', () => {
  const dir = mkTargetDir();
  try {
    const pw1 = ensureSonicPassword(dir);
    const pw2 = ensureSonicPassword(dir);
    assert.equal(pw1, pw2, 'no rotation on re-call');
  } finally {
    cleanup(dir);
  }
});

test('ensureSonicPassword regenerates if existing file is too short', () => {
  const dir = mkTargetDir();
  try {
    fs.mkdirSync(path.join(dir, '.st8'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.st8', 'sonic.password'), 'short');
    const pw = ensureSonicPassword(dir);
    assert.equal(pw.length, 64, 'regenerated to full length');
  } finally {
    cleanup(dir);
  }
});

test('sonic.password file is mode 0600 on POSIX', { skip: process.platform === 'win32' }, () => {
  const dir = mkTargetDir();
  try {
    ensureSonicPassword(dir);
    const stat = fs.statSync(path.join(dir, '.st8', 'sonic.password'));
    // Lower 9 bits = permissions; expect 0600.
    assert.equal(stat.mode & 0o777, 0o600);
  } finally {
    cleanup(dir);
  }
});

test('SonicClient.setPassword updates all three channels', () => {
  const client = new SonicClient({ password: 'initial' });
  assert.equal(client.password, 'initial');
  assert.equal(client.searchChannel.options.password, 'initial');
  assert.equal(client.ingestChannel.options.password, 'initial');
  assert.equal(client.controlChannel.options.password, 'initial');

  client.setPassword('rotated-secret-value');
  assert.equal(client.password, 'rotated-secret-value');
  assert.equal(client.searchChannel.options.password, 'rotated-secret-value');
  assert.equal(client.ingestChannel.options.password, 'rotated-secret-value');
  assert.equal(client.controlChannel.options.password, 'rotated-secret-value');
});

test('SonicClient.setPassword ignores empty/non-string input', () => {
  const client = new SonicClient({ password: 'keep-me' });
  client.setPassword('');
  client.setPassword(null);
  client.setPassword(undefined);
  client.setPassword(12345);
  assert.equal(client.password, 'keep-me', 'unchanged after invalid inputs');
});

test('runtime config carries the per-instance password, not the canonical key', () => {
  // Simulate the daemon's materialization: copy template, replace inet + auth_password.
  const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
  const tpl = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'Sonic', 'sonic.cfg'), 'utf8');
  assert.match(tpl, /auth_password\s*=\s*"maestro_scaffolder_key"/,
    'canonical template should still ship the maestro shared key');

  const dir = mkTargetDir();
  try {
    const pw = ensureSonicPassword(dir);
    const patched = tpl
      .replace(/^\s*inet\s*=.*$/m, `inet = "127.0.0.1:1491"`)
      .replace(/^\s*auth_password\s*=.*$/m, `auth_password = "${pw}"`);

    assert.ok(!patched.includes('maestro_scaffolder_key'),
      'patched runtime config must not contain the canonical shared key');
    assert.ok(patched.includes(pw),
      'patched runtime config must contain the per-instance password');
  } finally {
    cleanup(dir);
  }
});
