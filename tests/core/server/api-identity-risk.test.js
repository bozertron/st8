'use strict';

/**
 * tests/core/server/api-identity-risk.test.js — integration test for the
 * Wave 3C `/api/identity-risk` consumer. Boots a real St8Server on an
 * ephemeral port, writes a synthetic `.st8/identity-risk.json` under the
 * server's targetDir, makes real HTTP requests, asserts on the response
 * envelope. No mocks of the SUT.
 *
 * Identity-and-analysis Wave 3C — wires the `.st8/identity-risk.json`
 * artefact (written by indexer.js when birthTimestamp falls back to
 * mtime) onto an HTTP surface so frontend / introspection tools have a
 * stable contract.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Server } = require('../../../src/core/server/app');
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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-id-risk-'));
    const port = await freePort();
    const server = new St8Server({ port, targetDir });
    server.start();
    // Wait one tick for listen callback + ensureSecret.
    await new Promise((r) => setTimeout(r, 100));
    return { server, port, targetDir };
}

function httpGet(port, urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port, method: 'GET', path: urlPath,
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

test('GET /api/identity-risk — file absent returns count=0 with clean-run note', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    // No identity-risk.json written under targetDir → clean state.
    const r = await httpGet(ctx.port, '/api/identity-risk');
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.equal(json.ok, true);
    assert.equal(json.count, 0);
    assert.deepEqual(json.records, []);
    assert.equal(json.generatedAt, null);
    assert.match(json.note || '', /clean run/i);
});

test('GET /api/identity-risk — file present returns count + records + generatedAt', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    // Write a synthetic identity-risk.json matching indexer.js's format.
    const st8Dir = path.join(ctx.targetDir, '.st8');
    fs.mkdirSync(st8Dir, { recursive: true });
    const synthetic = {
        generatedAt: '2026-05-15T12:34:56.000Z',
        fallbackCount: 2,
        records: [
            { filepath: 'src/a.js', reason: 'stat.birthtime epoch', recordedAt: '2026-05-15T12:34:55.000Z' },
            { filepath: 'src/b.js', reason: 'stat.birthtime pre-1980', recordedAt: '2026-05-15T12:34:55.500Z' },
        ],
    };
    fs.writeFileSync(path.join(st8Dir, 'identity-risk.json'), JSON.stringify(synthetic));

    const r = await httpGet(ctx.port, '/api/identity-risk');
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.equal(json.ok, true);
    assert.equal(json.count, 2);
    assert.equal(json.records.length, 2);
    assert.equal(json.records[0].filepath, 'src/a.js');
    assert.equal(json.generatedAt, '2026-05-15T12:34:56.000Z');
    // Should NOT carry the clean-run note when the file is real.
    assert.equal(json.note, undefined);
});

test('GET /api/identity-risk — malformed JSON returns 500 with error', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const st8Dir = path.join(ctx.targetDir, '.st8');
    fs.mkdirSync(st8Dir, { recursive: true });
    fs.writeFileSync(path.join(st8Dir, 'identity-risk.json'), 'this is not json {');

    const r = await httpGet(ctx.port, '/api/identity-risk');
    assert.equal(r.status, 500);
    const json = JSON.parse(r.body);
    assert.equal(json.ok, false);
    assert.match(json.error, /JSON|Unexpected/);
});

test('GET /api/identity-risk — POST returns 405', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port: ctx.port, method: 'POST',
            path: '/api/identity-risk',
            headers: { 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.end();
    });
    assert.equal(r.status, 405);
});

test('GET /api/identity-risk — records-only fallback when fallbackCount field missing', async (t) => {
    // Defensive: if an older/alternate writer emits records without a
    // fallbackCount field, the handler still surfaces the right count
    // by reading records.length.
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const st8Dir = path.join(ctx.targetDir, '.st8');
    fs.mkdirSync(st8Dir, { recursive: true });
    fs.writeFileSync(path.join(st8Dir, 'identity-risk.json'), JSON.stringify({
        generatedAt: '2026-05-15T00:00:00.000Z',
        records: [{ filepath: 'src/only.js', reason: 'whatever' }],
    }));

    const r = await httpGet(ctx.port, '/api/identity-risk');
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.equal(json.ok, true);
    assert.equal(json.count, 1);
    assert.equal(json.records.length, 1);
});
