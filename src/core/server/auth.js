'use strict';

/**
 * auth.js — minimum-viable shared-secret authentication for write
 * routes that fire hooks (ticket 27).
 *
 * The server binds to 127.0.0.1 by default (app.js:52), so for the
 * standard configuration any caller is already on the loopback
 * interface. But the userNote correctly flags two real risks:
 *
 *   1. Some configs bind to 0.0.0.0 — at that point any host that can
 *      reach the port can POST to /api/record-commit or /api/tickets
 *      and pollute activity_log / create fake tickets.
 *   2. A malicious page loaded in the user's browser could CSRF
 *      /api/tickets via fetch() (same-origin cookies don't help
 *      because the server uses no cookies — but the page can still
 *      POST against localhost from anywhere). The CORS allowlist
 *      reduces this surface but a determined attacker with a same-
 *      origin XSS or a permissive CORS misconfiguration could still
 *      hit the routes.
 *
 * The mitigation here is a per-instance shared secret:
 *
 *   - `.st8/server.secret` holds 32 bytes of crypto-random hex,
 *     written once at server boot, chmod 0600.
 *   - POST /api/record-commit and POST /api/tickets require the
 *     header `X-St8-Secret: <secret>`. Missing or wrong → 401.
 *   - The post-commit shell hook reads `.st8/server.secret` and
 *     includes the header.
 *   - The frontend page calls `GET /api/auth-token` once on load to
 *     fetch the secret. That endpoint is gated to loopback
 *     `remoteAddress` (127.0.0.1, ::1, ::ffff:127.0.0.1) so an
 *     external host that reaches a 0.0.0.0-bound server cannot
 *     trivially harvest the secret.
 *
 * Comparison is constant-time via crypto.timingSafeEqual to avoid
 * timing-attack leakage of the secret prefix.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRET_FILENAME = 'server.secret';
const SECRET_BYTES = 32;            // 64-hex-char secret
const HEADER_NAME = 'x-st8-secret'; // Node lowercases incoming headers

/**
 * Ensure `.st8/<SECRET_FILENAME>` exists under targetDir; if it does
 * not, generate a fresh 32-byte hex secret and write it with mode 0600.
 * If it already exists, leave it alone (rotation is out of scope).
 * Returns the secret string.
 *
 * Throws on filesystem errors that prevent secret persistence — auth
 * cannot operate without a known secret on disk, so silent fallback
 * would be a cheat.
 */
function ensureSecret(targetDir) {
    if (!targetDir) {
        throw new Error('[st8:auth] ensureSecret requires a targetDir');
    }
    const st8Dir = path.join(targetDir, '.st8');
    if (!fs.existsSync(st8Dir)) {
        fs.mkdirSync(st8Dir, { recursive: true });
    }
    const secretPath = path.join(st8Dir, SECRET_FILENAME);
    if (fs.existsSync(secretPath)) {
        const existing = fs.readFileSync(secretPath, 'utf8').trim();
        if (existing.length >= 16) return existing;
        // Empty or stub file — regenerate.
    }
    const secret = crypto.randomBytes(SECRET_BYTES).toString('hex');
    // Write atomically: tmp + rename so a crash mid-write can't leave
    // a half-empty secret file.
    const tmpPath = secretPath + '.tmp';
    fs.writeFileSync(tmpPath, secret + '\n', { encoding: 'utf8', mode: 0o600 });
    try {
        fs.chmodSync(tmpPath, 0o600); // belt-and-braces in case umask widened it
    } catch (_) { /* non-fatal on Windows */ }
    fs.renameSync(tmpPath, secretPath);
    return secret;
}

/**
 * Load the on-disk secret. Returns null if the file is missing or
 * unreadable — callers should treat null as "auth not yet
 * initialized" and refuse to authorize.
 */
function readSecret(targetDir) {
    if (!targetDir) return null;
    try {
        const p = path.join(targetDir, '.st8', SECRET_FILENAME);
        if (!fs.existsSync(p)) return null;
        const v = fs.readFileSync(p, 'utf8').trim();
        return v.length >= 16 ? v : null;
    } catch (_) {
        return null;
    }
}

/**
 * Constant-time compare of two strings. Returns false on length
 * mismatch or any byte difference; true only on exact equality.
 */
function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

/**
 * Validate the X-St8-Secret header on `req` against the on-disk
 * secret. Returns one of:
 *   - { ok: true }
 *   - { ok: false, status: 401, reason: 'missing-header' }
 *   - { ok: false, status: 401, reason: 'wrong-secret' }
 *   - { ok: false, status: 503, reason: 'no-secret-on-disk' }
 *
 * Callers should write the status + a JSON body with a generic
 * 'unauthorized' message — do NOT echo the reason to the client.
 * The reason is for server-side logging only.
 */
function checkRequest(req, targetDir) {
    const expected = readSecret(targetDir);
    if (!expected) return { ok: false, status: 503, reason: 'no-secret-on-disk' };
    const provided = req.headers[HEADER_NAME];
    if (!provided) return { ok: false, status: 401, reason: 'missing-header' };
    if (!safeEqual(String(provided), expected)) {
        return { ok: false, status: 401, reason: 'wrong-secret' };
    }
    return { ok: true };
}

/**
 * True if the request came from the loopback interface. Used to gate
 * /api/auth-token so a remote attacker on a 0.0.0.0-bound server
 * cannot trivially harvest the secret.
 */
function isLoopback(req) {
    const addr = req.socket && req.socket.remoteAddress;
    if (!addr) return false;
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

module.exports = {
    ensureSecret,
    readSecret,
    checkRequest,
    isLoopback,
    safeEqual,
    HEADER_NAME,
    SECRET_FILENAME,
};
