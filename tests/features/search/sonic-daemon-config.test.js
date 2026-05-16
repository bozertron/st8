'use strict';

/**
 * Wave 5A ticket 8 — sonic.cfg boot-time validation tests.
 *
 * Covers validateSonicConfig() against:
 *   - the canonical docs/Sonic/sonic.cfg (must pass)
 *   - synthesized bad configs (each missing one expected field) → must fail
 *     with the expected reason code
 *   - missing file → config_read_failed
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateSonicConfig } = require('../../../src/features/search/sonic-daemon');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CANONICAL_CFG = path.join(REPO_ROOT, 'docs', 'Sonic', 'sonic.cfg');

function writeTempCfg(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-sonic-cfg-'));
  const file = path.join(dir, 'sonic.cfg');
  fs.writeFileSync(file, contents);
  return { file, dir };
}

function cleanup({ dir }) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

test('canonical docs/Sonic/sonic.cfg passes validation', () => {
  const result = validateSonicConfig(CANONICAL_CFG);
  assert.equal(result.ok, true, `Canonical cfg should pass; got: ${JSON.stringify(result)}`);
});

test('missing file → config_read_failed', () => {
  const result = validateSonicConfig('/nonexistent/path/sonic.cfg');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'config_read_failed');
});

test('missing [server] section → config_missing_sections', () => {
  const canonical = fs.readFileSync(CANONICAL_CFG, 'utf8');
  const broken = canonical.replace('[server]', '[oops_renamed]');
  const tmp = writeTempCfg(broken);
  try {
    const result = validateSonicConfig(tmp.file);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'config_missing_sections');
    assert.match(result.details, /\[server\]/);
  } finally {
    cleanup(tmp);
  }
});

test('missing [store.kv] section → config_missing_sections', () => {
  const canonical = fs.readFileSync(CANONICAL_CFG, 'utf8');
  const broken = canonical.replace('[store.kv]', '[store.was_renamed]');
  const tmp = writeTempCfg(broken);
  try {
    const result = validateSonicConfig(tmp.file);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'config_missing_sections');
  } finally {
    cleanup(tmp);
  }
});

test('missing inet line → config_missing_inet', () => {
  const canonical = fs.readFileSync(CANONICAL_CFG, 'utf8');
  const broken = canonical.replace(/^\s*inet\s*=.*$/m, '# inet removed');
  const tmp = writeTempCfg(broken);
  try {
    const result = validateSonicConfig(tmp.file);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'config_missing_inet');
  } finally {
    cleanup(tmp);
  }
});

test('wrong port → config_port_mismatch', () => {
  const canonical = fs.readFileSync(CANONICAL_CFG, 'utf8');
  const broken = canonical.replace(/inet\s*=\s*"[^"]+"/, 'inet = "[::1]:9999"');
  const tmp = writeTempCfg(broken);
  try {
    const result = validateSonicConfig(tmp.file);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'config_port_mismatch');
    assert.match(result.details, /9999/);
    assert.match(result.details, /1491/);
  } finally {
    cleanup(tmp);
  }
});

test('missing auth_password → config_missing_auth_password', () => {
  const canonical = fs.readFileSync(CANONICAL_CFG, 'utf8');
  const broken = canonical.replace(/^\s*auth_password\s*=.*$/m, '# removed');
  const tmp = writeTempCfg(broken);
  try {
    const result = validateSonicConfig(tmp.file);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'config_missing_auth_password');
  } finally {
    cleanup(tmp);
  }
});

test('missing ${SONIC_STORE_PATH} substitution → config_missing_store_path_subst', () => {
  const canonical = fs.readFileSync(CANONICAL_CFG, 'utf8');
  // Remove both occurrences (kv path + fst path)
  const broken = canonical.replace(/\$\{SONIC_STORE_PATH\}/g, '/hardcoded/path');
  const tmp = writeTempCfg(broken);
  try {
    const result = validateSonicConfig(tmp.file);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'config_missing_store_path_subst');
  } finally {
    cleanup(tmp);
  }
});

test('only one ${SONIC_STORE_PATH} substitution → still fails (need >=2)', () => {
  const canonical = fs.readFileSync(CANONICAL_CFG, 'utf8');
  // Strip the fst path substitution but keep kv
  const broken = canonical.replace(/^\s*path\s*=\s*"\$\{SONIC_STORE_PATH\}\/fst\/"\s*$/m, 'path = "/hardcoded/fst/"');
  const tmp = writeTempCfg(broken);
  try {
    const result = validateSonicConfig(tmp.file);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'config_missing_store_path_subst');
    assert.match(result.details, /1 time/);
  } finally {
    cleanup(tmp);
  }
});
