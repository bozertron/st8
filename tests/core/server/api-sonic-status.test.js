'use strict';

/**
 * tests/core/server/api-sonic-status.test.js — Batch 032.
 *
 * Smoke test for GET /api/sonic/status. The route is a thin
 * passthrough of sonic-daemon.getStatus(), which exports a stable
 * shape regardless of whether Sonic is currently running.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Server } = require('../../../src/core/server/app');

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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-sonic-status-'));
    const port = await freePort();
    const server = new St8Server({ port, targetDir });
    server.start();
    await new Promise((r) => setTimeout(r, 50));
    return { server, port, targetDir };
}

function httpRequest(port, method, urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port, method, path: urlPath,
            headers: { 'Accept': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.end();
    });
}

test('/api/sonic/status returns 200 with the daemon status envelope', async () => {
    const { server, port } = await bootServer();
    try {
        const r = await httpRequest(port, 'GET', '/api/sonic/status');
        assert.equal(r.status, 200);
        const j = JSON.parse(r.body);
        // Shape lock — must mirror sonic-daemon.getStatus() output
        for (const key of ['running', 'pid', 'port', 'host', 'since', 'restartCount', 'storePath', 'lastError']) {
            assert.ok(key in j, `envelope missing ${key}`);
        }
        assert.equal(typeof j.running, 'boolean');
        assert.equal(typeof j.port, 'number');
        assert.equal(typeof j.host, 'string');
    } finally {
        server.stop();
    }
});

test('/api/sonic/status rejects non-GET with 405', async () => {
    const { server, port } = await bootServer();
    try {
        const r = await httpRequest(port, 'POST', '/api/sonic/status');
        assert.equal(r.status, 405);
        const j = JSON.parse(r.body);
        assert.match(j.error, /Method not allowed/);
    } finally {
        server.stop();
    }
});
