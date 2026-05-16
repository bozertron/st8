'use strict';

/**
 * tests/core/server/validate-record-commit.test.js — input validation
 * for POST /api/record-commit (ticket 28).
 *
 * Probes the pure validator (validateRecordCommitPayload) AND drives a
 * couple of real HTTP requests against a real St8Server to confirm
 * the 400-with-clear-message contract end-to-end.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { St8Server, validateRecordCommitPayload } = require('../../../src/core/server/app');
const auth = require('../../../src/core/server/auth');
const { closeSharedPersistence } = require('../../../src/core/database/persistence');

// ─── PURE VALIDATOR PROBES ───────────────────────────────────

test('validateRecordCommitPayload — happy path: minimal {hash} succeeds with defaults', () => {
    const r = validateRecordCommitPayload({ hash: 'abc123' });
    assert.equal(r.ok, true);
    assert.equal(r.payload.hash, 'abc123');
    // Defaults applied.
    assert.equal(r.payload.shortHash, '');
    assert.equal(r.payload.subject, '');
    assert.equal(r.payload.author, '');
    assert.equal(r.payload.timestamp, '');
    assert.equal(r.payload.branch, '');
    assert.equal(r.payload.filesChanged, 0);
});

test('validateRecordCommitPayload — happy path: full canonical payload passes', () => {
    const r = validateRecordCommitPayload({
        hash: 'deadbeef1234',
        shortHash: 'dead',
        subject: 'fix: thing',
        author: 'A. Tester <a@b>',
        timestamp: '2026-05-15T00:00:00Z',
        branch: 'main',
        filesChanged: 5,
    });
    assert.equal(r.ok, true);
    assert.equal(r.payload.hash, 'deadbeef1234');
    assert.equal(r.payload.filesChanged, 5);
    assert.equal(r.payload.subject, 'fix: thing');
});

test('validateRecordCommitPayload — null / non-object inputs are rejected', () => {
    for (const bad of [null, undefined, 42, 'a string', [], [1, 2, 3]]) {
        const r = validateRecordCommitPayload(bad);
        assert.equal(r.ok, false, `should reject ${JSON.stringify(bad)}`);
        assert.match(r.error, /payload must be a JSON object/);
    }
});

test('validateRecordCommitPayload — missing hash → 400', () => {
    const r = validateRecordCommitPayload({});
    assert.equal(r.ok, false);
    assert.match(r.error, /hash required/);
});

test('validateRecordCommitPayload — non-string hash → 400', () => {
    for (const bad of [42, true, [], {}, null]) {
        const r = validateRecordCommitPayload({ hash: bad });
        assert.equal(r.ok, false);
        assert.match(r.error, /hash required/);
    }
});

test('validateRecordCommitPayload — empty-string hash → 400', () => {
    const r = validateRecordCommitPayload({ hash: '' });
    assert.equal(r.ok, false);
    assert.match(r.error, /hash required/);
});

test('validateRecordCommitPayload — overlong hash → 400', () => {
    const r = validateRecordCommitPayload({ hash: 'a'.repeat(201) });
    assert.equal(r.ok, false);
    assert.match(r.error, /hash too long/);
});

test('validateRecordCommitPayload — unknown field → 400', () => {
    const r = validateRecordCommitPayload({ hash: 'a', maliciousField: 'pwn' });
    assert.equal(r.ok, false);
    assert.match(r.error, /unknown field: maliciousField/);
});

test('validateRecordCommitPayload — non-string subject → 400 (ticket-flagged shape)', () => {
    // The userNote called out the brittleness on filesChanged but the
    // same brittleness exists on other string fields if a caller posts
    // {subject: ['array']}. Strict types means each gets its own line.
    for (const field of ['shortHash', 'subject', 'author', 'timestamp', 'branch']) {
        for (const bad of [42, true, [], {}]) {
            const input = { hash: 'a', [field]: bad };
            const r = validateRecordCommitPayload(input);
            assert.equal(r.ok, false, `${field}=${JSON.stringify(bad)} should fail`);
            assert.match(r.error, new RegExp(`${field} must be a string`));
        }
    }
});

test('validateRecordCommitPayload — overlong subject → 400', () => {
    const r = validateRecordCommitPayload({ hash: 'a', subject: 's'.repeat(501) });
    assert.equal(r.ok, false);
    assert.match(r.error, /subject too long/);
});

test('validateRecordCommitPayload — filesChanged: string → 400', () => {
    const r = validateRecordCommitPayload({ hash: 'a', filesChanged: '5' });
    assert.equal(r.ok, false);
    assert.match(r.error, /filesChanged must be a number/);
});

test('validateRecordCommitPayload — filesChanged: array/object → 400', () => {
    for (const bad of [[], [1, 2], {}, { n: 5 }]) {
        const r = validateRecordCommitPayload({ hash: 'a', filesChanged: bad });
        assert.equal(r.ok, false);
        assert.match(r.error, /filesChanged must be a number/);
    }
});

test('validateRecordCommitPayload — filesChanged: float → 400', () => {
    const r = validateRecordCommitPayload({ hash: 'a', filesChanged: 3.14 });
    assert.equal(r.ok, false);
    assert.match(r.error, /filesChanged must be an integer/);
});

test('validateRecordCommitPayload — filesChanged: negative → 400', () => {
    const r = validateRecordCommitPayload({ hash: 'a', filesChanged: -1 });
    assert.equal(r.ok, false);
    assert.match(r.error, /filesChanged must be >= 0/);
});

test('validateRecordCommitPayload — filesChanged: NaN / Infinity → 400', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
        const r = validateRecordCommitPayload({ hash: 'a', filesChanged: bad });
        assert.equal(r.ok, false);
        assert.match(r.error, /filesChanged must be (a number|finite)/);
    }
});

test('validateRecordCommitPayload — filesChanged: above sanity cap → 400', () => {
    const r = validateRecordCommitPayload({ hash: 'a', filesChanged: 10001 });
    assert.equal(r.ok, false);
    assert.match(r.error, /filesChanged exceeds sanity cap/);
});

test('validateRecordCommitPayload — filesChanged: 0 and MAX are accepted', () => {
    const r0 = validateRecordCommitPayload({ hash: 'a', filesChanged: 0 });
    assert.equal(r0.ok, true);
    assert.equal(r0.payload.filesChanged, 0);
    const rMax = validateRecordCommitPayload({ hash: 'a', filesChanged: 10000 });
    assert.equal(rMax.ok, true);
    assert.equal(rMax.payload.filesChanged, 10000);
});

test('validateRecordCommitPayload — null / undefined optional fields are treated as omitted', () => {
    const r = validateRecordCommitPayload({
        hash: 'a',
        shortHash: null,
        subject: undefined,
        filesChanged: null,
    });
    assert.equal(r.ok, true);
    assert.equal(r.payload.shortHash, '');
    assert.equal(r.payload.subject, '');
    assert.equal(r.payload.filesChanged, 0);
});

test('validateRecordCommitPayload — normalized payload is reference-fresh, not the input', () => {
    const input = { hash: 'a' };
    const r = validateRecordCommitPayload(input);
    assert.equal(r.ok, true);
    assert.notEqual(r.payload, input, 'normalized payload should be a fresh object');
});

// ─── INTEGRATION: real HTTP POST drives the 400 path ────────

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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-validate-test-'));
    const port = await freePort();
    const server = new St8Server({ port, targetDir });
    server.start();
    await new Promise((r) => setTimeout(r, 100));
    return { server, port, targetDir };
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

function postJson(port, path_, body, extraHeaders) {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port, method: 'POST', path: path_,
            headers: Object.assign({
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            }, extraHeaders || {}),
        }, (res) => {
            let buf = '';
            res.on('data', (c) => { buf += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: buf }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

test('integration — POST /api/record-commit with filesChanged="5" returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = auth.readSecret(ctx.targetDir);
    const r = await postJson(ctx.port, '/api/record-commit',
        { hash: 'abc', filesChanged: '5' },
        { 'X-St8-Secret': secret });
    assert.equal(r.status, 400);
    const json = JSON.parse(r.body);
    assert.match(json.error, /filesChanged must be a number/);
});

test('integration — POST /api/record-commit with filesChanged=[] returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = auth.readSecret(ctx.targetDir);
    const r = await postJson(ctx.port, '/api/record-commit',
        { hash: 'abc', filesChanged: [1, 2, 3] },
        { 'X-St8-Secret': secret });
    assert.equal(r.status, 400);
    const json = JSON.parse(r.body);
    assert.match(json.error, /filesChanged must be a number/);
});

test('integration — POST /api/record-commit with unknown field returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = auth.readSecret(ctx.targetDir);
    const r = await postJson(ctx.port, '/api/record-commit',
        { hash: 'abc', exploit: '<script>' },
        { 'X-St8-Secret': secret });
    assert.equal(r.status, 400);
    const json = JSON.parse(r.body);
    assert.match(json.error, /unknown field: exploit/);
});

test('integration — POST /api/record-commit with invalid JSON returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = auth.readSecret(ctx.targetDir);
    const r = await postJson(ctx.port, '/api/record-commit', 'not-json{',
        { 'X-St8-Secret': secret });
    assert.equal(r.status, 400);
    const json = JSON.parse(r.body);
    assert.match(json.error, /invalid JSON/);
});

test('integration — POST /api/record-commit happy path returns 200 with normalized echo', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = auth.readSecret(ctx.targetDir);
    const r = await postJson(ctx.port, '/api/record-commit',
        { hash: 'shipit', filesChanged: 7 },
        { 'X-St8-Secret': secret });
    assert.equal(r.status, 200);
    const json = JSON.parse(r.body);
    assert.equal(json.ok, true);
    assert.equal(json.hash, 'shipit');
});
