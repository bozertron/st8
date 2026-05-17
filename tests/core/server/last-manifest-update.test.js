'use strict';

/**
 * tests/core/server/last-manifest-update.test.js — Batch 032 (QW-0).
 *
 * Verifies the INDEX_COMPLETE P=15 subscriber that assigns
 * `this.lastManifestUpdate` on the St8Server instance:
 *   (1) Fresh server has lastManifestUpdate === null.
 *   (2) Firing HOOKS.INDEX_COMPLETE sets it to a valid ISO 8601 string.
 *   (3) Subsequent fires update it monotonically.
 *   (4) /api/health surfaces the value.
 *   (5) stop() unregisters cleanly (no leaked subscribers across boots).
 *
 * Pre-fix, the field was declared in the constructor as null and
 * never assigned anywhere. /api/health always returned null. This is
 * QW-0 — prereq for /api/state (QW-3) which exposes the same signal.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Server } = require('../../../src/core/server/app');
const { hookRegistry, HOOKS } = require('../../../src/core/hook-registry');

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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-lmu-'));
    const port = await freePort();
    const server = new St8Server({ port, targetDir });
    server.start();
    await new Promise((r) => setTimeout(r, 50));
    return { server, port, targetDir };
}

function httpGet(port, urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port, method: 'GET', path: urlPath,
        }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.end();
    });
}

const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

test('lastManifestUpdate — fresh server is null, INDEX_COMPLETE sets ISO timestamp', async () => {
    const { server, port } = await bootServer();
    try {
        assert.equal(server.lastManifestUpdate, null, 'fresh server starts with null');

        // /api/health probe pre-fire
        const pre = await httpGet(port, '/api/health');
        const preJson = JSON.parse(pre.body);
        assert.equal(preJson.lastManifestUpdate, null, '/api/health reflects null pre-INDEX_COMPLETE');

        // Fire INDEX_COMPLETE — the P=15 subscriber should set the field
        await hookRegistry.execute(HOOKS.INDEX_COMPLETE, {});

        assert.ok(typeof server.lastManifestUpdate === 'string', 'set to string after fire');
        assert.match(server.lastManifestUpdate, ISO_8601_RE, 'set to ISO 8601 timestamp');

        // /api/health probe post-fire
        const post = await httpGet(port, '/api/health');
        const postJson = JSON.parse(post.body);
        assert.equal(postJson.lastManifestUpdate, server.lastManifestUpdate,
            '/api/health reflects updated timestamp');
    } finally {
        server.stop();
    }
});

test('lastManifestUpdate — monotonically advances across re-fires', async () => {
    const { server } = await bootServer();
    try {
        await hookRegistry.execute(HOOKS.INDEX_COMPLETE, {});
        const t1 = server.lastManifestUpdate;
        assert.ok(t1, 'first fire sets value');

        // Wait a couple ms so the next ISO timestamp is strictly greater
        await new Promise((r) => setTimeout(r, 10));

        await hookRegistry.execute(HOOKS.INDEX_COMPLETE, {});
        const t2 = server.lastManifestUpdate;

        assert.ok(t2 > t1, `second fire advances timestamp (${t1} → ${t2})`);
    } finally {
        server.stop();
    }
});

test('lastManifestUpdate — server.stop() unregisters cleanly (no leaked subscribers)', async () => {
    // Snapshot the INDEX_COMPLETE subscriber count BEFORE boot.
    const before = hookRegistry.listHooks().find((h) => h.name === HOOKS.INDEX_COMPLETE);
    const baseCount = before ? before.count : 0;

    const { server } = await bootServer();
    const duringBoot = hookRegistry.listHooks().find((h) => h.name === HOOKS.INDEX_COMPLETE);
    // The St8Server constructor registers TWO subscribers: manifest-cache
    // invalidator (P=200) AND lastManifestUpdate (P=15) — net delta +2.
    assert.equal(duringBoot.count - baseCount, 2,
        'St8Server boot adds exactly 2 INDEX_COMPLETE subscribers (cache + lastManifestUpdate)');

    server.stop();

    const afterStop = hookRegistry.listHooks().find((h) => h.name === HOOKS.INDEX_COMPLETE);
    const afterCount = afterStop ? afterStop.count : 0;
    assert.equal(afterCount, baseCount, 'stop() unregisters both subscribers');
});
