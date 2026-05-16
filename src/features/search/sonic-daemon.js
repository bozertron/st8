'use strict';

/**
 * sonic-daemon.js — Manages the Sonic search daemon process lifecycle.
 *
 * Sonic (https://github.com/valeriansaliou/sonic) is a sub-millisecond TCP
 * search backend used by background-indexer, sonic-queries, and
 * sonic-indexer to keep code-metadata lookups warm.
 *
 * This module is the Node-side counterpart to docs/Sonic/sonic_daemon.rs
 * (which is a Tauri-specific lifecycle manager). We don't ship Sonic IN
 * st8 — the binary lives at docs/Sonic/sonic and is expected to be either
 * installed system-wide or runnable from there.
 *
 * Design decisions:
 *
 *   - **Optional.** st8 boots without Sonic. If the binary isn't found OR
 *     it fails to start OR the port doesn't bind, we log a single warning
 *     and mark the daemon as "unavailable". Every sonic-queries call has a
 *     SQLite fallback path (per the architecture doc), so degraded mode
 *     is graceful.
 *
 *   - **Auto-start opt-in.** Don't start automatically on st8 boot — wait
 *     for an explicit start() call. Wired as an INDEX_START hook subscriber
 *     so a future SONIC_ENABLED flag in settings can gate it.
 *
 *   - **Single instance per process.** Singleton pattern. If start() is
 *     called twice, second call returns the existing process.
 *
 *   - **Health-check on connect.** After spawn, poll the TCP port until
 *     it accepts connections (max 5s). If the port never opens, treat as
 *     failure and degrade.
 *
 *   - **Clean shutdown.** On process.exit / SIGINT / SIGTERM, send SIGTERM
 *     to the Sonic child, wait briefly, then SIGKILL if needed.
 *
 * Public API:
 *
 *   const daemon = require('./sonic-daemon');
 *   await daemon.start({ targetDir });
 *   daemon.isAvailable();   // boolean
 *   daemon.getStatus();     // { running, pid, port, since, restartCount }
 *   await daemon.stop();
 */

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

// ─── Config ─────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SONIC_BINARY = path.join(REPO_ROOT, 'docs', 'Sonic', 'sonic');
// docs/Sonic/sonic.cfg is canonical (synced from MAESTRO) and uses [::1].
// Some environments (sandboxed Linux, IPv6-disabled hosts) reject IPv6 binds,
// so we don't pass it to the binary directly. Instead, materialize a runtime
// config inside the target's .st8/sonic-store/ that uses 127.0.0.1.
const SONIC_TEMPLATE_CONFIG = path.join(REPO_ROOT, 'docs', 'Sonic', 'sonic.cfg');
const SONIC_HOST = '127.0.0.1';
const SONIC_PORT = 1491;
const HEALTH_CHECK_MAX_MS = 5000;
const HEALTH_CHECK_INTERVAL_MS = 100;
const SHUTDOWN_GRACE_MS = 1500;

// ─── State (singleton) ──────────────────────────────────────────

let _state = {
  process: null,
  available: false,
  since: null,
  restartCount: 0,
  storePath: null,
  lastError: null,
};

let _exitHandlerInstalled = false;
let _binaryEnsuredExecutable = false;

// Wave 5A ticket 4: previously `fs.chmodSync(SONIC_BINARY, 0o755)` ran on every
// start(). The binary only needs the executable bit set once (post-clone or
// post-CI-extract); re-chmoding on every restart is wasteful and could mask
// intentional permission tightening. We now do it at most once per process,
// and only if the binary is not already executable for the current user.
function ensureBinaryExecutable() {
  if (_binaryEnsuredExecutable) return;
  try {
    if (!fs.existsSync(SONIC_BINARY)) return;
    // Check before chmod: skip if owner already has +x.
    const mode = fs.statSync(SONIC_BINARY).mode;
    const ownerExecutable = (mode & 0o100) !== 0;
    if (!ownerExecutable) {
      fs.chmodSync(SONIC_BINARY, 0o755);
    }
    _binaryEnsuredExecutable = true;
  } catch (err) {
    // Non-fatal: start() will detect and report a failure to spawn.
    console.warn(`[sonic-daemon] Could not chmod Sonic binary: ${err.message}`);
  }
}

// Run once at module load so re-starts in the same process don't repeat
// the syscall. If the binary appears later (post-CI extract during a long-
// running test session), start() falls back to a second check on demand.
ensureBinaryExecutable();

// ─── Helpers ────────────────────────────────────────────────────

function pingPort(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const cleanup = () => { try { socket.destroy(); } catch (_) {} };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(true);
    });
    socket.once('timeout', () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(false);
    });
    socket.once('error', () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForHealth() {
  const deadline = Date.now() + HEALTH_CHECK_MAX_MS;
  while (Date.now() < deadline) {
    if (await pingPort(SONIC_HOST, SONIC_PORT)) return true;
    await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL_MS));
  }
  return false;
}

function installExitHandlers() {
  if (_exitHandlerInstalled) return;
  _exitHandlerInstalled = true;
  const handler = () => {
    try { stop(); } catch (_) {}
  };
  process.on('exit', handler);
  process.on('SIGINT', () => { handler(); process.exit(130); });
  process.on('SIGTERM', () => { handler(); process.exit(143); });
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Start the Sonic daemon. Idempotent — repeated calls return the existing
 * process. Always resolves; on failure, daemon is marked unavailable and
 * callers should fall through to SQLite-only mode.
 *
 * @param {{targetDir: string}} options
 * @returns {Promise<{ok: boolean, reason?: string, available: boolean}>}
 */
async function start(options = {}) {
  if (_state.available && _state.process && !_state.process.killed) {
    return { ok: true, available: true };
  }

  // Binary check
  if (!fs.existsSync(SONIC_BINARY)) {
    _state.lastError = 'binary_missing';
    console.warn(`[sonic-daemon] Sonic binary not found at ${SONIC_BINARY} — running in SQLite-only mode`);
    return { ok: false, reason: 'binary_missing', available: false };
  }
  if (!fs.existsSync(SONIC_TEMPLATE_CONFIG)) {
    _state.lastError = 'config_missing';
    console.warn(`[sonic-daemon] Sonic template config not found at ${SONIC_TEMPLATE_CONFIG} — running in SQLite-only mode`);
    return { ok: false, reason: 'config_missing', available: false };
  }

  // Ensure binary is executable. The module-load helper already ran once,
  // but if the binary materialized late (CI extract after this module was
  // first required) we give it one more chance — still gated by the
  // already-executable check so the chmod syscall does not fire on warm
  // re-starts.
  ensureBinaryExecutable();

  // Maybe Sonic is already running externally — check before spawning.
  if (await pingPort(SONIC_HOST, SONIC_PORT)) {
    _state.available = true;
    _state.since = new Date().toISOString();
    _state.lastError = null;
    console.log(`[sonic-daemon] Sonic already running on ${SONIC_HOST}:${SONIC_PORT} (external) — adopting`);
    return { ok: true, available: true, reason: 'external' };
  }

  // Resolve the store path. sonic.cfg uses ${SONIC_STORE_PATH} as the
  // base — we point it at .st8/sonic-store/ inside the target dir so
  // per-project indexes don't collide.
  const targetDir = options.targetDir || process.cwd();
  const storePath = path.join(targetDir, '.st8', 'sonic-store');
  try {
    fs.mkdirSync(path.join(storePath, 'kv'), { recursive: true });
    fs.mkdirSync(path.join(storePath, 'fst'), { recursive: true });
  } catch (err) {
    _state.lastError = 'store_mkdir_failed';
    console.warn(`[sonic-daemon] Could not create Sonic store dirs: ${err.message}`);
    return { ok: false, reason: 'store_mkdir_failed', available: false };
  }
  _state.storePath = storePath;

  // Materialize a runtime config by overriding the inet host in the template
  // to IPv4 (canonical template uses [::1] which fails in IPv6-disabled hosts).
  const runtimeConfig = path.join(storePath, 'sonic.runtime.cfg');
  try {
    const tpl = fs.readFileSync(SONIC_TEMPLATE_CONFIG, 'utf8');
    const patched = tpl.replace(/^\s*inet\s*=.*$/m, `inet = "${SONIC_HOST}:${SONIC_PORT}"`);
    fs.writeFileSync(runtimeConfig, patched);
  } catch (err) {
    _state.lastError = 'config_write_failed';
    console.warn(`[sonic-daemon] Could not materialize runtime config: ${err.message}`);
    return { ok: false, reason: 'config_write_failed', available: false };
  }

  // Spawn — Sonic CLI is: sonic -c <config>
  let child;
  try {
    child = spawn(SONIC_BINARY, ['-c', runtimeConfig], {
      env: { ...process.env, SONIC_STORE_PATH: storePath },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });
  } catch (err) {
    _state.lastError = 'spawn_failed';
    console.warn(`[sonic-daemon] Spawn failed: ${err.message} — SQLite-only mode`);
    return { ok: false, reason: 'spawn_failed', available: false };
  }

  // Hook child output through to stderr with a prefix so we can see Sonic
  // logs without polluting st8's normal output.
  child.stdout.on('data', (chunk) => process.stderr.write(`[sonic] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[sonic] ${chunk}`));

  child.on('exit', (code, signal) => {
    if (_state.process === child) {
      _state.process = null;
      _state.available = false;
      _state.lastError = signal ? `signal:${signal}` : `exit:${code}`;
    }
  });

  _state.process = child;
  _state.restartCount++;

  // Wait for the TCP port to start accepting connections.
  const healthy = await waitForHealth();
  if (!healthy) {
    _state.available = false;
    _state.lastError = 'health_check_failed';
    try { child.kill('SIGTERM'); } catch (_) {}
    console.warn(`[sonic-daemon] Sonic spawned but port ${SONIC_PORT} never opened — SQLite-only mode`);
    return { ok: false, reason: 'health_check_failed', available: false };
  }

  _state.available = true;
  _state.since = new Date().toISOString();
  _state.lastError = null;
  installExitHandlers();
  console.log(`[sonic-daemon] Sonic running on ${SONIC_HOST}:${SONIC_PORT} (pid ${child.pid}, store ${storePath})`);
  return { ok: true, available: true };
}

function stop() {
  const child = _state.process;
  if (!child || child.killed) {
    _state.process = null;
    _state.available = false;
    return;
  }
  try {
    child.kill('SIGTERM');
  } catch (_) {}
  // Best-effort grace window for clean shutdown
  const start = Date.now();
  while (Date.now() - start < SHUTDOWN_GRACE_MS && !child.killed) {
    // Spin briefly — node's spawn child doesn't expose a sync wait.
  }
  try {
    if (!child.killed) child.kill('SIGKILL');
  } catch (_) {}
  _state.process = null;
  _state.available = false;
}

function isAvailable() {
  return _state.available && _state.process != null && !_state.process.killed;
}

function getStatus() {
  return {
    running: isAvailable(),
    pid: _state.process ? _state.process.pid : null,
    port: SONIC_PORT,
    host: SONIC_HOST,
    since: _state.since,
    restartCount: _state.restartCount,
    storePath: _state.storePath,
    lastError: _state.lastError,
  };
}

module.exports = { start, stop, isAvailable, getStatus };
