'use strict';

/**
 * tests/core/server/app-auth-routes.test.js — integration test for the
 * ticket-27 auth gate on /api/record-commit and /api/tickets POST,
 * plus the loopback gate on /api/auth-token.
 *
 * Boots a real St8Server on an ephemeral port, makes real HTTP
 * requests, asserts on the actual response codes/bodies. No mocks of
 * the SUT.
 *
 * Each test scopes its own temp directory (with .st8/server.secret
 * generated on listen) and tears down the server in t.after.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Server } = require('../../../src/core/server/app');
const auth = require('../../../src/core/server/auth');
const { closeSharedPersistence } = require('../../../src/core/database/persistence');

// Find a free port by binding-and-releasing.
function freePort() {
    return new Promise((resolve) => {
        const srv = http.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}

async function bootServer() {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-app-test-'));
    const port = await freePort();
    const server = new St8Server({ port, targetDir });
    server.start();
    // Wait one tick for listen callback + ensureSecret.
    await new Promise((r) => setTimeout(r, 100));
    return { server, port, targetDir };
}

function httpRequest(opts, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                resolve({ status: res.statusCode, headers: res.headers, body: data });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function teardown(ctx) {
    return new Promise((resolve) => {
        ctx.server.stop();
        // close any sqlite handle the routes opened
        closeSharedPersistence();
        // give Node a beat to release the port + DB lock
        setTimeout(() => {
            try { fs.rmSync(ctx.targetDir, { recursive: true, force: true }); } catch (_) {}
            resolve();
        }, 100);
    });
}

test('boot — .st8/server.secret is generated on listen', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secretPath = path.join(ctx.targetDir, '.st8', 'server.secret');
    assert.equal(fs.existsSync(secretPath), true, 'secret file must be present after boot');
    const secret = fs.readFileSync(secretPath, 'utf8').trim();
    assert.match(secret, /^[0-9a-f]{64}$/);
});

test('POST /api/record-commit — missing X-St8-Secret returns 401', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const body = JSON.stringify({
        hash: 'deadbeef', shortHash: 'dead', subject: 'test',
        author: 'tester', timestamp: '2026-05-15T00:00:00Z',
        branch: 'main', filesChanged: 1,
    });
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'POST',
        path: '/api/record-commit',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body);

    assert.equal(r.status, 401);
    const json = JSON.parse(r.body);
    assert.equal(json.error, 'unauthorized');
});

test('POST /api/record-commit — wrong X-St8-Secret returns 401', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const body = JSON.stringify({ hash: 'deadbeef', filesChanged: 1 });
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'POST',
        path: '/api/record-commit',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-St8-Secret': 'absolutely-not-the-real-secret-' + 'x'.repeat(32),
        },
    }, body);
    assert.equal(r.status, 401);
});

test('POST /api/record-commit — correct X-St8-Secret returns 200', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = auth.readSecret(ctx.targetDir);
    assert.ok(secret, 'precondition: secret must be on disk');

    const body = JSON.stringify({
        hash: 'cafef00d', shortHash: 'cafe', subject: 'with secret',
        author: 'tester', timestamp: '2026-05-15T00:00:00Z',
        branch: 'main', filesChanged: 2,
    });
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'POST',
        path: '/api/record-commit',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-St8-Secret': secret,
        },
    }, body);
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.equal(json.ok, true);
    assert.equal(json.hash, 'cafef00d');
});

test('POST /api/tickets — missing X-St8-Secret returns 401', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const body = JSON.stringify({
        fingerprint: 'src/foo.js||2026-05-15T00:00:00Z',
        filepath: 'src/foo.js',
        userNote: 'this is broken',
    });
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'POST',
        path: '/api/tickets',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body);
    assert.equal(r.status, 401);
});

test('POST /api/tickets — wrong X-St8-Secret returns 401', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const body = JSON.stringify({
        fingerprint: 'src/foo.js||2026-05-15T00:00:00Z',
        filepath: 'src/foo.js',
        userNote: 'broken',
    });
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'POST',
        path: '/api/tickets',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-St8-Secret': 'nope',
        },
    }, body);
    assert.equal(r.status, 401);
});

test('POST /api/tickets — correct X-St8-Secret returns 200', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    // Pre-populate file_registry so the ticket FK (fingerprint →
    // file_registry.fingerprint) holds; otherwise the create fails
    // with SQLITE_CONSTRAINT_FOREIGNKEY (proves Wave 1A's FK enforce
    // is working).
    const { getSharedPersistence } = require('../../../src/core/database/persistence');
    const persistence = await getSharedPersistence();
    const fingerprint = 'src/foo.js||2026-05-15T00:00:00Z';
    persistence.upsertFile({
        fingerprint,
        filepath: 'src/foo.js',
        filename: 'foo.js',
        sha256Hash: 'a'.repeat(64),
        fileSizeBytes: 100,
        birthTimestamp: '2026-05-15T00:00:00Z',
    });

    const secret = auth.readSecret(ctx.targetDir);
    const body = JSON.stringify({
        fingerprint,
        filepath: 'src/foo.js',
        userNote: 'this is the real one',
    });
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'POST',
        path: '/api/tickets',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-St8-Secret': secret,
        },
    }, body);
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.equal(json.ok, true);
    assert.equal(typeof json.id, 'number');
});

test('GET /api/tickets — does NOT require auth (read-only route)', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'GET',
        path: '/api/tickets',
    });
    assert.equal(r.status, 200, 'GET /api/tickets is unauthenticated by design');
    const json = JSON.parse(r.body);
    assert.equal(Array.isArray(json.tickets), true);
    assert.equal(typeof json.count, 'number');
});

test('GET /api/auth-token — returns secret to loopback caller', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'GET',
        path: '/api/auth-token',
    });
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.equal(typeof json.secret, 'string');
    assert.equal(json.secret.length, 64);
    // And it matches the on-disk secret.
    assert.equal(json.secret, auth.readSecret(ctx.targetDir));
});

test('GET /api/auth-token — rejects non-GET method', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'POST',
        path: '/api/auth-token',
    });
    assert.equal(r.status, 405);
});
