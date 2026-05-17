'use strict';

/**
 * tests/core/server/api-state-and-manifests.test.js — Batch 032 (QW-3).
 *
 * Integration tests for the two new endpoints that close the
 * CLAUDE.md-documented 404s surfaced by meta-dogfood batch 028:
 *
 *   GET /api/state      — server-state envelope
 *   GET /api/manifests  — schema-card index + aggregate health
 *
 * Boots a real St8Server on an ephemeral port, makes real HTTP
 * requests, asserts on response shape. No mocks of the SUT.
 * /api/manifests aggregates from the freshly-seeded file_registry —
 * does NOT call buildGraph (event-loop-safe, per external QW-3
 * verification's wedge concern).
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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-state-mf-'));
    const port = await freePort();
    const server = new St8Server({ port, targetDir });
    server.start();
    await new Promise((r) => setTimeout(r, 100));
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

// ─── /api/state ───────────────────────────────────────────────

test('/api/state returns 200 with the documented envelope shape', async () => {
    const { server, port } = await bootServer();
    try {
        const r = await httpRequest(port, 'GET', '/api/state');
        assert.equal(r.status, 200);
        const j = JSON.parse(r.body);
        assert.ok('status' in j, 'envelope has status');
        assert.ok('uptime' in j, 'envelope has uptime');
        assert.ok('targetDir' in j, 'envelope has targetDir');
        assert.ok('lastManifestUpdate' in j, 'envelope has lastManifestUpdate');
        assert.ok('totalFiles' in j, 'envelope has totalFiles');
        assert.equal(j.status, 'ok');
        assert.ok(typeof j.uptime === 'number' && j.uptime >= 0);
        assert.equal(typeof j.totalFiles, 'number');
    } finally {
        server.stop();
    }
});

test('/api/state surfaces lastManifestUpdate after INDEX_COMPLETE fire', async () => {
    const { server, port } = await bootServer();
    try {
        await hookRegistry.execute(HOOKS.INDEX_COMPLETE, {});
        const r = await httpRequest(port, 'GET', '/api/state');
        assert.equal(r.status, 200);
        const j = JSON.parse(r.body);
        assert.ok(typeof j.lastManifestUpdate === 'string',
            'lastManifestUpdate should be an ISO timestamp after fire');
        assert.match(j.lastManifestUpdate, /^\d{4}-\d{2}-\d{2}T/);
    } finally {
        server.stop();
    }
});

test('/api/state rejects non-GET with 405', async () => {
    const { server, port } = await bootServer();
    try {
        const r = await httpRequest(port, 'POST', '/api/state');
        assert.equal(r.status, 405);
        const j = JSON.parse(r.body);
        assert.match(j.error, /Method not allowed/);
    } finally {
        server.stop();
    }
});

// ─── /api/manifests ────────────────────────────────────────────

test('/api/manifests returns 200 with the documented envelope shape', async () => {
    // Note: St8Persistence is a singleton against the repo's st8.sqlite,
    // not scoped to the test's ephemeral targetDir. So `count` reflects
    // whatever the working repo has indexed. We assert SHAPE, not value.
    const { server, port } = await bootServer();
    try {
        const r = await httpRequest(port, 'GET', '/api/manifests');
        assert.equal(r.status, 200);
        const j = JSON.parse(r.body);
        assert.ok('count' in j, 'envelope has count');
        assert.ok('manifests' in j, 'envelope has manifests');
        assert.ok('summary' in j, 'envelope has summary');
        assert.ok(Array.isArray(j.manifests));
        assert.equal(typeof j.count, 'number');
        assert.equal(typeof j.summary.totalFiles, 'number');
        assert.equal(j.count, j.summary.totalFiles, 'count == summary.totalFiles');
        assert.ok('GREEN' in j.summary.statusCounts);
        assert.ok('YELLOW' in j.summary.statusCounts);
        assert.ok('RED' in j.summary.statusCounts);
        assert.ok(typeof j.summary.healthScore === 'number');
        assert.ok(j.summary.healthScore >= 0 && j.summary.healthScore <= 1.0);
    } finally {
        server.stop();
    }
});

test('/api/manifests per-file healthScore is a numeric coercion of status', async () => {
    const { server, port } = await bootServer();
    try {
        const r = await httpRequest(port, 'GET', '/api/manifests');
        assert.equal(r.status, 200);
        const j = JSON.parse(r.body);
        // For whatever is in the registry, every entry must follow the
        // GREEN=1.0 / YELLOW=0.5 / RED=0.0 contract.
        const expected = { GREEN: 1.0, YELLOW: 0.5, RED: 0.0 };
        for (const m of j.manifests) {
            const exp = expected[m.status];
            if (exp !== undefined) {
                assert.equal(
                    m.healthScore, exp,
                    `${m.filepath}: status=${m.status} should map to healthScore=${exp}, got ${m.healthScore}`
                );
            }
            // Every manifest entry must have the required shape
            assert.ok('fingerprint' in m);
            assert.ok('filepath' in m);
            assert.ok('status' in m);
            assert.ok('lifecyclePhase' in m);
            assert.ok('healthScore' in m);
        }
        // The aggregate summary must equal GREEN count / total
        if (j.count > 0) {
            const expectedAgg = j.summary.statusCounts.GREEN / j.count;
            assert.ok(
                Math.abs(j.summary.healthScore - expectedAgg) < 1e-9,
                `aggregate healthScore should be GREEN/total (${expectedAgg}), got ${j.summary.healthScore}`
            );
        }
    } finally {
        server.stop();
    }
});

test('/api/manifests rejects non-GET with 405', async () => {
    const { server, port } = await bootServer();
    try {
        const r = await httpRequest(port, 'POST', '/api/manifests');
        assert.equal(r.status, 405);
    } finally {
        server.stop();
    }
});
