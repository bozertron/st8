'use strict';

/**
 * tests/core/server/ticket-lifecycle-routes.test.js — Wave 5F ticket 1.
 *
 * Integration tests for the new granular ticket lifecycle routes:
 *   POST /api/tickets/:id/claim
 *   POST /api/tickets/:id/resolve
 *
 * Boots a real St8Server on an ephemeral port, performs real HTTP
 * requests, and asserts:
 *
 *   - POST without X-St8-Secret → 401 (auth gate)
 *   - POST /:id/claim with unknown id → 404
 *   - POST /:id/claim happy path → 200 + ticket gets claimedBy set
 *   - POST /:id/resolve with unknown id → 404
 *   - POST /:id/resolve happy path → 200 + ticket leaves openTickets list
 *
 * Each test boots its own ephemeral server + temp targetDir to keep
 * tests parallel-safe (no shared port, no shared DB).
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
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-ticket-route-'));
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

function readSecret(targetDir) {
    return fs.readFileSync(path.join(targetDir, '.st8', 'server.secret'), 'utf8').trim();
}

async function seedTicket() {
    const persistence = await getSharedPersistence();
    // tickets.fingerprint has a FK to file_registry; seed a file row
    // so createTicket succeeds.
    persistence.upsertFile({
        fingerprint: 'fp-xyz',
        filepath: 'src/foo.js',
        filename: 'foo.js',
        sha256Hash: 'deadbeef',
    });
    return persistence.createTicket({
        fingerprint: 'fp-xyz',
        filepath: 'src/foo.js',
        userNote: 'needs investigation',
    });
}

// ─── /api/tickets/:id/claim ─────────────────────────────────

test('/api/tickets/:id/claim — POST without X-St8-Secret returns 401', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/tickets/1/claim', method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ providerId: 'anthropic' }));
    assert.equal(r.status, 401);
});

test('/api/tickets/:id/claim — unknown id returns 404', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = readSecret(ctx.targetDir);
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/tickets/99999/claim', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ providerId: 'anthropic' }));
    assert.equal(r.status, 404);
    assert.match(r.body, /not found/);
});

test('/api/tickets/:id/claim — happy path claims the ticket', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const ticket = await seedTicket();
    const secret = readSecret(ctx.targetDir);

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port,
        path: `/api/tickets/${ticket.id}/claim`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ providerId: 'anthropic' }));

    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.equal(body.ok, true);
    assert.equal(body.id, ticket.id);
    assert.equal(body.claimedBy, 'anthropic');

    // Probe persistence directly — the route must have actually
    // mutated the row, not just returned 200.
    const persistence = await getSharedPersistence();
    const row = persistence.db.prepare('SELECT claimedBy, claimedAt FROM tickets WHERE id = ?').get(ticket.id);
    assert.equal(row.claimedBy, 'anthropic');
    assert.ok(row.claimedAt, 'claimedAt must be set after claim');
});

// ─── /api/tickets/:id/resolve ───────────────────────────────

test('/api/tickets/:id/resolve — POST without X-St8-Secret returns 401', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/tickets/1/resolve', method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ resolution: 'done' }));
    assert.equal(r.status, 401);
});

test('/api/tickets/:id/resolve — unknown id returns 404', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const secret = readSecret(ctx.targetDir);
    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port, path: '/api/tickets/99999/resolve', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ resolution: 'fixed it' }));
    assert.equal(r.status, 404);
});

test('/api/tickets/:id/resolve — happy path resolves the ticket', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const ticket = await seedTicket();
    const secret = readSecret(ctx.targetDir);

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port,
        path: `/api/tickets/${ticket.id}/resolve`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({ resolution: 'patched in commit abc123', providerId: 'anthropic' }));

    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.equal(body.ok, true);
    assert.equal(body.id, ticket.id);
    assert.equal(body.resolved, true);

    // Probe persistence — row must be marked resolved with the note.
    const persistence = await getSharedPersistence();
    const row = persistence.db.prepare('SELECT resolution, resolvedAt FROM tickets WHERE id = ?').get(ticket.id);
    assert.equal(row.resolution, 'patched in commit abc123');
    assert.ok(row.resolvedAt, 'resolvedAt must be set after resolve');

    // And the open-tickets list must no longer include it.
    const open = persistence.getOpenTickets(200);
    assert.equal(open.find((t2) => t2.id === ticket.id), undefined);
});

test('/api/tickets/:id/resolve — missing resolution returns 400', async (t) => {
    const ctx = await bootServer();
    t.after(() => teardown(ctx));

    const ticket = await seedTicket();
    const secret = readSecret(ctx.targetDir);

    const r = await httpRequest({
        host: '127.0.0.1', port: ctx.port,
        path: `/api/tickets/${ticket.id}/resolve`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-St8-Secret': secret },
    }, JSON.stringify({}));
    assert.equal(r.status, 400);
});
