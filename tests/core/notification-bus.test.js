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

// ─── TICKET 16 — printer chain wiring ───────────────────────
// Audit verdict: outcome (c) accidentally dead → wired correctly.
// The schema-card emitter (FILE_AFTER_CHANGE P=20) already produces a
// card via emitter.emitCard(); the SSE broadcaster (P=30) now attaches
// that card to the notification-bus publish event so the printer
// fallback fires. End-to-end coverage of the wire-up lives in
// tests/core/hooks/file-after-change-printer-wire.test.js.

test('ticket 16 — printer.printCard fires when event carries schemaCard', async (t) => {
    const bus = new NotificationBus();
    const calls = [];
    bus.setPrinter({
        printCard: (card) => { calls.push(card); return '/tmp/fake.txt'; },
    });

    bus.publish({
        mutationType: 'EDIT',
        filepath: 'x.js',
        actor: 'WATCHER',
        fingerprint: 'fp-1',
        schemaCard: { fingerprint: 'fp-1', filepath: 'x.js' },
    });

    assert.equal(calls.length, 1, 'printCard must fire once');
    assert.equal(calls[0].fingerprint, 'fp-1');
});

test('ticket 16 — printer.printCard skipped when event omits schemaCard', async (t) => {
    const bus = new NotificationBus();
    const calls = [];
    bus.setPrinter({ printCard: (card) => { calls.push(card); } });

    bus.publish({
        mutationType: 'EDIT',
        filepath: 'x.js',
        actor: 'WATCHER',
        fingerprint: 'fp-1',
    });

    assert.equal(calls.length, 0, 'no schemaCard → no printer call');
});

test('ticket 16 — printer.printCard skipped when schemaCard is null', async (t) => {
    // The Wave-4C wire-up passes schemaCard: ctx.schemaCard || null
    // when the P=20 emitter failed. The publish() guard must treat
    // null the same as missing — no printer call.
    const bus = new NotificationBus();
    const calls = [];
    bus.setPrinter({ printCard: (card) => { calls.push(card); } });

    bus.publish({
        mutationType: 'EDIT',
        filepath: 'x.js',
        actor: 'WATCHER',
        fingerprint: 'fp-1',
        schemaCard: null,
    });

    assert.equal(calls.length, 0, 'null schemaCard → no printer call');
});

test('ticket 16 — printer throw is caught, does not abort publish chain', async (t) => {
    const bus = new NotificationBus();
    let emitterFired = false;
    bus.on('mutation', () => { emitterFired = true; });
    bus.setPrinter({
        printCard: () => { throw new Error('printer broke'); },
    });

    // Should not throw to caller.
    bus.publish({
        mutationType: 'EDIT',
        filepath: 'x.js',
        actor: 'WATCHER',
        fingerprint: 'fp-1',
        schemaCard: { fingerprint: 'fp-1', filepath: 'x.js' },
    });

    assert.equal(emitterFired, true, 'emitter must still have fired (runs before printer)');
});

// ─── TICKET 8 — heartbeat keepalive ─────────────────────────

test('ticket 8 — SSE heartbeat emits at configured interval', async (t) => {
    // Use a short heartbeatMs so the test stays fast.
    const ctx = await bootBusServer({ heartbeatMs: 80 });
    t.after(() => ctx.teardown());

    const client = await openSSEClient(ctx.port);
    t.after(() => { try { client.req.destroy(); } catch (_) {} });

    // Collect frames for ~300ms — expect >=2 heartbeats.
    let received = '';
    client.res.on('data', (chunk) => { received += chunk; });
    await sleep(300);

    const heartbeats = (received.match(/^: heartbeat$/gm) || []).length;
    assert.ok(heartbeats >= 2, `expected >=2 heartbeats in 300ms @ 80ms interval, got ${heartbeats} (frames=${JSON.stringify(received)})`);
});

test('ticket 8 — heartbeat stops + timer cleared on client close', async (t) => {
    const ctx = await bootBusServer({ heartbeatMs: 50 });
    t.after(() => ctx.teardown());

    const client = await openSSEClient(ctx.port);
    await sleep(40);
    assert.equal(ctx.bus.sseClients.size, 1);
    // Heartbeat timer must be attached to the response object (per impl).
    const res = Array.from(ctx.bus.sseClients)[0];
    assert.ok(res._st8HeartbeatTimer, 'heartbeat timer must be attached to res');

    client.req.destroy();
    const deadline = Date.now() + 1000;
    while (ctx.bus.sseClients.size !== 0 && Date.now() < deadline) await sleep(20);
    assert.equal(ctx.bus.sseClients.size, 0);
    // After cleanup, the timer reference is cleared.
    assert.equal(res._st8HeartbeatTimer, null, 'heartbeat timer must be nulled on cleanup');
});

test('ticket 8 — heartbeatMs=0 disables the heartbeat entirely', async (t) => {
    const ctx = await bootBusServer({ heartbeatMs: 0 });
    t.after(() => ctx.teardown());

    const client = await openSSEClient(ctx.port);
    t.after(() => { try { client.req.destroy(); } catch (_) {} });
    await sleep(40);

    const res = Array.from(ctx.bus.sseClients)[0];
    assert.equal(res._st8HeartbeatTimer, null, 'no heartbeat timer when disabled');

    // Collect 200ms — no heartbeats should arrive.
    let received = '';
    client.res.on('data', (chunk) => { received += chunk; });
    await sleep(200);
    const heartbeats = (received.match(/^: heartbeat$/gm) || []).length;
    assert.equal(heartbeats, 0, 'disabled heartbeat must not emit');
});

// ─── TICKET 6 — CREATE + EDIT double-fire posture ───────────
// Decision: outcome (a) — KEEP BOTH FIRES.
//
// Rationale: the Wave 4A composite-key dedup (`${path}::${type}`)
// explicitly preserves CREATE vs EDIT as distinct entries within a
// single debounce window. Each branch in main.js's onFileChange loop
// has different downstream semantics:
//
//   CREATE — file_registry INSERT, fingerprint generation, initial
//            schema-card emission (no prior card to diff against),
//            mutation_log CREATE row
//   EDIT   — hash-change diff, sha256Hash update, mutation_log EDIT
//            row with changedFields, re-emit of the schema card
//
// Merging CREATE+EDIT into a single EDIT publish would silently drop
// the CREATE branch's downstream consumers (persistence INSERT,
// fingerprint registration, initial card emission). The printer
// chain newly activated by ticket 16 also has per-fingerprint
// timestamp-prefixed filenames, so two near-simultaneous printCard
// calls produce two distinct .txt files — exactly the audit trail
// the printer fallback is designed to capture.
//
// Verifying the publish count is exactly 2 (not 1) is the
// anti-cheat probe for this decision.

test('ticket 6 — CREATE and EDIT for same path produce two distinct publishes', async (t) => {
    const bus = new NotificationBus();
    const seen = [];
    bus.on('mutation', (ev) => seen.push({ type: ev.mutationType, fp: ev.fingerprint, fp_path: ev.filepath }));

    // Simulate main.js's per-change loop firing both branches on the
    // same path inside one debounce window.
    bus.publish({
        mutationType: 'CREATE',
        filepath: 'new.js',
        fingerprint: 'fp-new',
        actor: 'WATCHER',
    });
    bus.publish({
        mutationType: 'EDIT',
        filepath: 'new.js',
        fingerprint: 'fp-new',
        actor: 'WATCHER',
    });

    assert.equal(seen.length, 2, `CREATE+EDIT must produce 2 publishes (decision a, preserve both); got ${seen.length}`);
    assert.equal(seen[0].type, 'CREATE', 'first event is CREATE');
    assert.equal(seen[1].type, 'EDIT', 'second event is EDIT');
    // Both reference the same file; the duplication is intentional.
    assert.equal(seen[0].fp, seen[1].fp);
    assert.equal(seen[0].fp_path, seen[1].fp_path);
});

test('ticket 6 — typed listeners also see both fires (mutation:CREATE + mutation:EDIT)', async (t) => {
    // Subscribers listening on a typed channel (mutation:CREATE) must
    // also fire — not just the catch-all 'mutation' listener. Proves
    // the EventEmitter typed-emit isn't accidentally short-circuited.
    const bus = new NotificationBus();
    const createSeen = [];
    const editSeen = [];
    bus.on('mutation:CREATE', (ev) => createSeen.push(ev));
    bus.on('mutation:EDIT', (ev) => editSeen.push(ev));

    bus.publish({ mutationType: 'CREATE', filepath: 'a.js', fingerprint: 'fp-a', actor: 'WATCHER' });
    bus.publish({ mutationType: 'EDIT', filepath: 'a.js', fingerprint: 'fp-a', actor: 'WATCHER' });

    assert.equal(createSeen.length, 1);
    assert.equal(editSeen.length, 1);
});

test('ticket 6 — SSE clients receive both frames on CREATE+EDIT', async (t) => {
    // Heartbeat off so we see only mutation frames.
    const ctx = await bootBusServer({ heartbeatMs: 0 });
    t.after(() => ctx.teardown());

    const client = await openSSEClient(ctx.port);
    t.after(() => { try { client.req.destroy(); } catch (_) {} });

    let received = '';
    client.res.on('data', (chunk) => { received += chunk; });
    await sleep(40);

    ctx.bus.publish({ mutationType: 'CREATE', filepath: 'x.js', fingerprint: 'fp-x', actor: 'WATCHER' });
    ctx.bus.publish({ mutationType: 'EDIT', filepath: 'x.js', fingerprint: 'fp-x', actor: 'WATCHER' });
    await sleep(80);

    // Count CREATE and EDIT data frames separately.
    const dataFrames = received.split('\n\n').filter(f => f.startsWith('data:'));
    const types = dataFrames
        .map(f => { try { return JSON.parse(f.slice(5).trim()).mutationType; } catch (_) { return null; } })
        .filter(t => t === 'CREATE' || t === 'EDIT');
    assert.deepEqual(types, ['CREATE', 'EDIT'], `SSE must deliver both frames; got ${JSON.stringify(types)}`);
});
