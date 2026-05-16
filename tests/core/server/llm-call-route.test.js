'use strict';

/**
 * tests/core/server/llm-call-route.test.js — Wave 5E ticket 1.
 *
 * Integration tests for POST /api/llm-call. Boots a real St8Server on
 * an ephemeral port, performs real HTTP requests against the route,
 * and asserts:
 *
 *   - GET / PUT → 405
 *   - POST without X-St8-Secret → 401
 *   - POST with wrong secret → 401
 *   - POST with valid auth but no entryId → 400
 *   - POST with valid auth but no prompt → 400
 *   - POST with valid auth + entryId that does not exist → 404
 *   - POST with valid auth + entry → fetches via the provider adapter
 *     (mocked globalThis.fetch) and returns 200 with response shape
 *   - The decrypted apiKey is what the provider sees — the route must
 *     pass plaintext (decrypted via persistence) to the adapter, NOT
 *     the ciphertext stored in SQLite. This is the dec-routing probe.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Server } = require('../../../src/core/server/app');
const { closeSharedPersistence, getSharedPersistence } = require('../../../src/core/database/persistence');
const cryptoModule = require('../../../src/shared/utils/settings-crypto');

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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-llm-route-'));
    const port = await freePort();
    // Persistence opens st8.sqlite in cwd by default; chdir so the DB +
    // encryption key both land inside the temp targetDir.
    const origCwd = process.cwd();
    process.chdir(targetDir);
    closeSharedPersistence();
    cryptoModule._resetCacheForTests();
    const server = new St8Server({ port, targetDir });
    server.start();
    await new Promise((r) => setTimeout(r, 100));
    return { server, port, targetDir, origCwd };
}

function teardown(ctx) {
    return new Promise((resolve) => {
        ctx.server.stop();
        closeSharedPersistence();
        cryptoModule._resetCacheForTests();
        process.chdir(ctx.origCwd);
        setTimeout(() => {
            try { fs.rmSync(ctx.targetDir, { recursive: true, force: true }); } catch (_) {}
            resolve();
        }, 100);
    });
}

function httpRequest(opts, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function readSecret(targetDir) {
    return fs.readFileSync(path.join(targetDir, '.st8', 'server.secret'), 'utf8').trim();
}

async function seedModelEntry(entry) {
    const persistence = await getSharedPersistence();
    persistence.upsertSetting('models', '_entries', [entry]);
}

function installFetchMock(impl) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return () => { globalThis.fetch = original; };
}

// ─── Method gate ────────────────────────────────────────────

test('/api/llm-call — GET returns 405', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({ host: '127.0.0.1', port: ctx.port, path: '/api/llm-call', method: 'GET' });
    assert.equal(r.status, 405);
});

// ─── Auth gate ──────────────────────────────────────────────

test('/api/llm-call — POST without X-St8-Secret returns 401', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/llm-call', method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ entryId: 'x', prompt: 'hi' }));
    assert.equal(r.status, 401);
    assert.match(r.body, /unauthorized/);
});

test('/api/llm-call — POST with wrong secret returns 401', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/llm-call', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': 'definitely-wrong' },
    }, JSON.stringify({ entryId: 'x', prompt: 'hi' }));
    assert.equal(r.status, 401);
});

// ─── Body validation ───────────────────────────────────────

test('/api/llm-call — POST missing entryId returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = readSecret(ctx.targetDir);
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/llm-call', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ prompt: 'hi' }));
    assert.equal(r.status, 400);
    assert.match(r.body, /entryId required/);
});

test('/api/llm-call — POST missing prompt returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = readSecret(ctx.targetDir);
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/llm-call', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ entryId: 'x' }));
    assert.equal(r.status, 400);
    assert.match(r.body, /prompt required/);
});

test('/api/llm-call — entryId not found returns 404', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    await seedModelEntry({
        id: 'claude-1', name: 'C', provider: 'anthropic', model: 'm',
        apiKey: 'sk-ant-test', enabled: true,
    });

    const secret = readSecret(ctx.targetDir);
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/llm-call', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ entryId: 'does-not-exist', prompt: 'hi' }));
    assert.equal(r.status, 404);
    assert.match(r.body, /no models entry/);
});

// ─── Happy path + decrypt-routing probe ─────────────────────

test('/api/llm-call — happy path: dispatches via adapter with DECRYPTED apiKey', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const PLAINTEXT_KEY = 'sk-ant-LIVE-DECRYPTED-MUST-REACH-PROVIDER';
    await seedModelEntry({
        id: 'claude-1', name: 'C', provider: 'anthropic', model: 'claude-sonnet-4-6',
        apiKey: PLAINTEXT_KEY, enabled: true,
    });

    // Confirm the DB row contains ciphertext (not plaintext) before
    // proceeding — otherwise the decrypt-routing probe is meaningless.
    const persistence = await getSharedPersistence();
    const rawRow = persistence._getRawSetting('models', '_entries');
    assert.equal(rawRow.indexOf(PLAINTEXT_KEY), -1, 'pre-condition: raw DB row must NOT contain plaintext');

    // Mock globalThis.fetch and record what the adapter sends.
    let captured = null;
    const restore = installFetchMock(async (url, init) => {
        captured = { url, init };
        return {
            ok: true,
            status: 200,
            json: async () => ({
                id: 'msg_x', type: 'message', role: 'assistant',
                model: 'claude-sonnet-4-6',
                content: [{ type: 'text', text: 'hello from mocked anthropic' }],
                usage: { input_tokens: 2, output_tokens: 5 },
            }),
        };
    });
    t.after(restore);

    const secret = readSecret(ctx.targetDir);
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/llm-call', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ entryId: 'claude-1', prompt: 'say hi' }));

    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.equal(body.ok, true);
    assert.equal(body.response, 'hello from mocked anthropic');
    assert.equal(body.model, 'claude-sonnet-4-6');

    // THE DECRYPT-ROUTING PROBE: the provider must have received the
    // DECRYPTED apiKey (matches the user's original input), NOT the
    // ciphertext stored in SQLite.
    assert.ok(captured, 'mocked fetch must have been called');
    assert.equal(captured.init.headers['x-api-key'], PLAINTEXT_KEY,
        'adapter must receive decrypted apiKey, not ciphertext');
});

test('/api/llm-call — provider error surfaces with adapter status', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    await seedModelEntry({
        id: 'a', name: 'A', provider: 'anthropic', model: 'm',
        apiKey: 'sk-bad', enabled: true,
    });

    const restore = installFetchMock(async () => ({
        ok: false, status: 401,
        json: async () => ({ error: { message: 'invalid x-api-key' } }),
    }));
    t.after(restore);

    const secret = readSecret(ctx.targetDir);
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/llm-call', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ entryId: 'a', prompt: 'hi' }));
    assert.equal(r.status, 401);
    const body = JSON.parse(r.body);
    assert.equal(body.ok, false);
    assert.match(body.error, /invalid x-api-key/);
});
