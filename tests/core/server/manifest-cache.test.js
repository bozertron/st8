'use strict';

/**
 * manifest-cache.test.js — Wave 5G ticket 2 (API-003).
 *
 * Verifies the in-process cache for `/api/connection-state.json`:
 *   (1) cache returns the same content on a repeat read without touching
 *       disk (we mutate the underlying file's mtime backwards to prove it
 *       was the cached copy, not a fresh disk read).
 *   (2) firing HOOKS.INDEX_COMPLETE invalidates the cache so the next
 *       read reflects the new on-disk content.
 *   (3) defence-in-depth: bumping the on-disk mtime FORWARD also forces
 *       a refresh even without a hook fire.
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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-mfcache-'));
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

function writeManifest(targetDir, obj) {
    fs.writeFileSync(path.join(targetDir, 'connection-state.json'), JSON.stringify(obj));
}

test('manifest cache: repeat request returns cached content', async () => {
    const { server, port, targetDir } = await bootServer();
    try {
        writeManifest(targetDir, { version: 'v1', files: [] });
        const r1 = await httpGet(port, '/api/connection-state.json');
        assert.equal(r1.status, 200);
        assert.match(r1.body, /v1/);

        // Overwrite the file but force mtime BACKWARDS so the cache's
        // mtime defence-in-depth check believes the file hasn't changed.
        // This proves the second response came from the cache, not disk.
        writeManifest(targetDir, { version: 'v2-but-cache-should-mask-this', files: [] });
        const cachedMtimeMs = server._manifestCacheEntry.mtimeMs;
        const past = new Date(cachedMtimeMs - 10000); // 10s before cache
        fs.utimesSync(path.join(targetDir, 'connection-state.json'), past, past);

        const r2 = await httpGet(port, '/api/connection-state.json');
        assert.equal(r2.status, 200);
        assert.equal(r2.body, r1.body, 'second read should match cached first read');
    } finally {
        server.stop();
    }
});

test('manifest cache: INDEX_COMPLETE hook invalidates cache', async () => {
    const { server, port, targetDir } = await bootServer();
    try {
        writeManifest(targetDir, { version: 'pre-hook' });
        const r1 = await httpGet(port, '/api/connection-state.json');
        assert.match(r1.body, /pre-hook/);
        assert.ok(server._manifestCacheEntry, 'cache should be populated after first read');

        // Update file + fire INDEX_COMPLETE — cache should bust and next
        // read should return the new content.
        writeManifest(targetDir, { version: 'post-hook' });
        await hookRegistry.execute(HOOKS.INDEX_COMPLETE, { targetDir });

        assert.equal(server._manifestCacheEntry, null, 'cache should be cleared by INDEX_COMPLETE subscriber');

        const r2 = await httpGet(port, '/api/connection-state.json');
        assert.match(r2.body, /post-hook/, 'next read should return fresh manifest');
        assert.doesNotMatch(r2.body, /pre-hook/);
    } finally {
        server.stop();
    }
});

test('manifest cache: forward mtime bump forces refresh (defence-in-depth)', async () => {
    const { server, port, targetDir } = await bootServer();
    try {
        writeManifest(targetDir, { version: 'first' });
        await httpGet(port, '/api/connection-state.json'); // populate cache

        // Out-of-band rewrite — no hook fire. mtime moves FORWARD so the
        // cache's per-request mtime check catches it.
        const manifestPath = path.join(targetDir, 'connection-state.json');
        writeManifest(targetDir, { version: 'second' });
        const future = new Date(Date.now() + 5000);
        fs.utimesSync(manifestPath, future, future);

        const r2 = await httpGet(port, '/api/connection-state.json');
        assert.match(r2.body, /second/, 'forward mtime bump should force a refresh even without hook fire');
    } finally {
        server.stop();
    }
});

test('manifest cache: subscriber registered with priority 200 + correct source tag', async () => {
    const { server } = await bootServer();
    try {
        const subscribers = hookRegistry.listHooks().find(h => h.name === HOOKS.INDEX_COMPLETE);
        assert.ok(subscribers, 'INDEX_COMPLETE should have subscribers');
        const cacheSubscriber = subscribers.sources.find(s => s.source === 'st8-server-manifest-cache');
        assert.ok(cacheSubscriber, 'st8-server-manifest-cache subscriber should be registered');
        assert.equal(cacheSubscriber.priority, 200, 'subscriber should run after default writers (priority 200)');
    } finally {
        server.stop();
    }
});
