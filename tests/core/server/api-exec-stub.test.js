'use strict';

/**
 * tests/core/server/api-exec-stub.test.js — Wave 5F ticket 3.
 *
 * POST /api/exec is intentionally not built. Before Wave 5F the route
 * was absent from the switch table; terminal.js phreakExecute() fell
 * back to it and got a silent 404. Now the route returns 501 Not
 * Implemented with a roadmap pointer so the verb is observable as
 * "deliberately deferred" rather than "missing".
 *
 * This test pins the contract: 501 + JSON body containing "not
 * implemented" + the roadmap document name.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Server } = require('../../../src/core/server/app');
const { closeSharedPersistence } = require('../../../src/core/database/persistence');
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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-exec-stub-'));
    const port = await freePort();
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

test('/api/exec — POST returns 501 with roadmap pointer', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/exec', method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ command: 'ls' }));

    assert.equal(r.status, 501);
    const body = JSON.parse(r.body);
    assert.equal(body.ok, false);
    assert.match(body.error, /not implemented/);
    assert.match(body.roadmap, /server-api-and-legacy-frontend/);
});

test('/api/exec — GET returns 405', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/exec', method: 'GET',
    });
    assert.equal(r.status, 405);
});
