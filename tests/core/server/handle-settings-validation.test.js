'use strict';

/**
 * tests/core/server/handle-settings-validation.test.js — Wave 5C,
 * tickets 8 + lock-step assertion that the backend
 * ALLOWED_SETTINGS_CATEGORIES mirror matches the frontend
 * SETTINGS_CATEGORIES (settings.js line 15).
 *
 * The route should:
 *   - reject empty category/key with 400 (existing behavior)
 *   - reject unknown category with 400 + error body listing the
 *     allowed set (new in ticket 8)
 *   - accept known categories with 200
 *
 * Boots a real St8Server on an ephemeral port and exercises real HTTP.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Server, ALLOWED_SETTINGS_CATEGORIES } = require('../../../src/core/server/app');
const { closeSharedPersistence } = require('../../../src/core/database/persistence');

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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-settings-val-'));
    const port = await freePort();
    const server = new St8Server({ port, targetDir });
    server.start();
    await new Promise((r) => setTimeout(r, 100));
    return { server, port, targetDir };
}

function httpRequest(opts, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                resolve({ status: res.statusCode, body: data });
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
        closeSharedPersistence();
        setTimeout(() => {
            try { fs.rmSync(ctx.targetDir, { recursive: true, force: true }); } catch (_) {}
            resolve();
        }, 100);
    });
}

function postSetting(port, payload) {
    const body = JSON.stringify(payload);
    return httpRequest({
        host: '127.0.0.1', port, method: 'POST', path: '/api/settings',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
}

test('ALLOWED_SETTINGS_CATEGORIES is exported and non-empty', () => {
    assert.ok(Array.isArray(ALLOWED_SETTINGS_CATEGORIES));
    assert.ok(ALLOWED_SETTINGS_CATEGORIES.length >= 8);
});

test('ALLOWED_SETTINGS_CATEGORIES matches frontend SETTINGS_CATEGORIES (drift guard)', () => {
    // Read the frontend file and parse the SETTINGS_CATEGORIES literal
    // by extracting each `id: '<name>'` from inside the array. This
    // intentionally does NOT import the frontend module (it sets
    // window.St8Settings and depends on browser globals); we just need
    // the canonical id list.
    const fePath = path.join(__dirname, '..', '..', '..',
        'src', 'frontend', 'components', 'settings', 'settings.js');
    const src = fs.readFileSync(fePath, 'utf8');
    const block = src.match(/const SETTINGS_CATEGORIES = \[([\s\S]*?)\];/);
    assert.ok(block, 'could not locate SETTINGS_CATEGORIES literal in settings.js');
    const ids = [];
    const re = /id:\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(block[1])) !== null) ids.push(m[1]);
    assert.ok(ids.length >= 8, 'expected to extract >= 8 category ids');

    assert.deepEqual(
        [...ids].sort(),
        [...ALLOWED_SETTINGS_CATEGORIES].sort(),
        'backend ALLOWED_SETTINGS_CATEGORIES must mirror frontend SETTINGS_CATEGORIES'
    );
});

test('POST /api/settings — missing category returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));
    const r = await postSetting(ctx.port, { key: 'reveal_wpm', value: 200 });
    assert.equal(r.status, 400);
    const json = JSON.parse(r.body);
    assert.match(json.error, /category and key are required/);
});

test('POST /api/settings — missing key returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));
    const r = await postSetting(ctx.port, { category: 'voidflow', value: 200 });
    assert.equal(r.status, 400);
});

test('POST /api/settings — unknown category returns 400 + lists allowed', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));
    const r = await postSetting(ctx.port, {
        category: 'voidfloow', // typo
        key: 'reveal_wpm',
        value: 200,
    });
    assert.equal(r.status, 400);
    const json = JSON.parse(r.body);
    assert.equal(json.category, 'voidfloow');
    assert.match(json.error, /unknown settings category/);
    assert.ok(Array.isArray(json.allowed));
    assert.ok(json.allowed.includes('voidflow'));
});

test('POST /api/settings — known category succeeds with 200', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));
    const r = await postSetting(ctx.port, {
        category: 'voidflow',
        key: 'reveal_wpm',
        value: 250,
    });
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.equal(json.status, 'ok');
    assert.equal(json.category, 'voidflow');
    assert.equal(json.key, 'reveal_wpm');
});

test('POST /api/settings — unknown category does NOT create a DB row', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));
    await postSetting(ctx.port, {
        category: 'bogus_category_xyz',
        key: 'whatever',
        value: 'evil',
    });
    // Read back all settings — bogus_category_xyz must not be present.
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, method: 'GET', path: '/api/settings',
    });
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.ok(!json.data || !json.data.bogus_category_xyz,
        'rejected category must not appear in /api/settings GET');
});
