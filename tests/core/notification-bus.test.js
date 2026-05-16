'use strict';

/**
 * tests/core/notification-bus.test.js
 *
 * Wave 4C tests for notification-bus.js — exercises the real SSE
 * client set (addSSEClient + _broadcastSSE), the heartbeat timer
 * (ticket 8), the printer fallback wiring (ticket 16), and the
 * double-fire posture (ticket 6).
 *
 * No mocks of the SUT. Every test boots a real HTTP server that
 * pipes /api/mutations through to notificationBus.addSSEClient,
 * connects with a real Node http.request, and asserts on observable
 * side effects (sseClients.size, on-disk .txt files, etc.).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { NotificationBus } = require('../../src/core/notification-bus');

function freePort() {
    return new Promise((resolve) => {
        const srv = http.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}

// Boot a minimal HTTP server that hands every request to the bus
// as if it were /api/mutations. Returns { server, port, bus, teardown }.
async function bootBusServer(busOptions = {}) {
    const bus = new NotificationBus(busOptions);
    const port = await freePort();
    const sockets = new Set();
    const server = http.createServer((req, res) => {
        bus.addSSEClient(res, { allowedOrigin: `http://127.0.0.1:${port}` });
    });
    server.on('connection', (s) => {
        sockets.add(s);
        s.on('close', () => sockets.delete(s));
    });
    await new Promise((r) => server.listen(port, '127.0.0.1', r));
    const teardown = () => new Promise((resolve) => {
        for (const s of sockets) { try { s.destroy(); } catch (_) {} }
        server.close(() => resolve());
    });
    return { server, port, bus, teardown };
}

// Open an SSE connection and resolve when the handshake `connected`
// frame arrives. The req object is exposed so tests can close it.
function openSSEClient(port) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port, method: 'GET', path: '/api/mutations',
            headers: { 'Accept': 'text/event-stream' },
        });
        req.on('error', reject);
        req.on('response', (res) => {
            const frames = [];
            res.setEncoding('utf8');
            res.on('data', (chunk) => frames.push(chunk));
            // resolve on first frame (handshake)
            res.once('data', () => {
                resolve({ req, res, frames });
            });
        });
        req.end();
    });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── TICKET 7 — SSE cleanup on close ────────────────────────

test('ticket 7 — SSE client cleanup on req.destroy (close event)', async (t) => {
    const ctx = await bootBusServer();
    t.after(() => ctx.teardown());

    assert.equal(ctx.bus.sseClients.size, 0, 'baseline must be 0');

    const client = await openSSEClient(ctx.port);
    // Give the server a tick to run addSSEClient.add().
    await sleep(50);
    assert.equal(ctx.bus.sseClients.size, 1, 'one client after connect');

    // Disconnect — req.destroy() triggers 'close' on the server res.
    client.req.destroy();

    // Wait for the close handler to delete the entry.
    const deadline = Date.now() + 1000;
    while (ctx.bus.sseClients.size !== 0 && Date.now() < deadline) {
        await sleep(20);
    }
    assert.equal(ctx.bus.sseClients.size, 0, 'cleanup must drop the client');
});

test('ticket 7 — SSE client cleanup on broadcast write error', async (t) => {
    const ctx = await bootBusServer();
    t.after(() => ctx.teardown());

    const client = await openSSEClient(ctx.port);
    await sleep(50);
    assert.equal(ctx.bus.sseClients.size, 1);

    // Kill the underlying socket so a subsequent write fails.
    client.req.socket.destroy();
    // Tiny delay so the destroy lands before the write.
    await sleep(20);

    // Publish — _broadcastSSE catches the write error and deletes the client.
    ctx.bus.publish({
        mutationType: 'EDIT',
        filepath: 'x.js',
        actor: 'WATCHER',
        fingerprint: 'fp-1',
    });

    // The close handler OR the broadcast-catch will remove the client.
    const deadline = Date.now() + 1000;
    while (ctx.bus.sseClients.size !== 0 && Date.now() < deadline) {
        await sleep(20);
    }
    assert.equal(ctx.bus.sseClients.size, 0, 'broken-pipe broadcast must clean up');
});

test('ticket 7 — multiple clients independent cleanup', async (t) => {
    const ctx = await bootBusServer();
    t.after(() => ctx.teardown());

    const a = await openSSEClient(ctx.port);
    const b = await openSSEClient(ctx.port);
    const c = await openSSEClient(ctx.port);
    await sleep(50);
    assert.equal(ctx.bus.sseClients.size, 3);

    b.req.destroy();
    const deadline1 = Date.now() + 1000;
    while (ctx.bus.sseClients.size !== 2 && Date.now() < deadline1) await sleep(20);
    assert.equal(ctx.bus.sseClients.size, 2, 'only middle client gone');

    a.req.destroy();
    c.req.destroy();
    const deadline2 = Date.now() + 1000;
    while (ctx.bus.sseClients.size !== 0 && Date.now() < deadline2) await sleep(20);
    assert.equal(ctx.bus.sseClients.size, 0);
});
