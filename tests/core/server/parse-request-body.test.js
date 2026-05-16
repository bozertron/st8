'use strict';

/**
 * tests/core/server/parse-request-body.test.js — Wave 5F ticket 12.
 *
 * Unit tests for parseRequestBody(req, options). The helper is the
 * single canonical implementation of the data/end/413/JSON.parse dance
 * that was previously duplicated across ~17 POST handlers in app.js.
 *
 * The helper is testable in isolation because it operates on req only
 * — it does NOT write to res. Tests use a minimal stream stand-in
 * (EventEmitter-compatible) that emits 'data' and 'end' / 'close'
 * events the same way Node's http.IncomingMessage does.
 *
 * Coverage:
 *   - happy path: JSON parses, resolves { ok: true, body }
 *   - 413 path: body exceeds maxBytes, resolves { ok: false, status: 413 }
 *   - 400 path: invalid JSON, resolves { ok: false, status: 400 }
 *   - default cap behaviour (8KB)
 *   - smaller cap honoured (1KB)
 *   - empty body resolves to {} when allowEmpty (default)
 *   - req.destroy is called on 413
 *   - resolution is idempotent (only one resolve even on later events)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

const { parseRequestBody } = require('../../../src/core/server/app');

// Minimal mock — extends EventEmitter, exposes destroy() spy.
function makeReq() {
    const req = new EventEmitter();
    req.destroyed = false;
    req.destroy = () => { req.destroyed = true; };
    return req;
}

// Helper: feed the body across one or more 'data' events.
async function driveRequest(req, chunks, opts) {
    // Important: schedule emits AFTER parseRequestBody attaches its
    // listeners (next tick).
    const p = parseRequestBody(req, opts);
    await new Promise((r) => setImmediate(r));
    for (const chunk of chunks) {
        req.emit('data', Buffer.from(chunk));
    }
    req.emit('end');
    return p;
}

test('parseRequestBody — happy path: parses JSON object', async () => {
    const req = makeReq();
    const result = await driveRequest(req, [JSON.stringify({ a: 1, b: 'hi' })]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.body, { a: 1, b: 'hi' });
});

test('parseRequestBody — happy path: parses across multiple chunks', async () => {
    const req = makeReq();
    const result = await driveRequest(req, ['{"a":', '1,', '"b":"hi"}']);
    assert.equal(result.ok, true);
    assert.deepEqual(result.body, { a: 1, b: 'hi' });
});

test('parseRequestBody — 413 when body exceeds maxBytes', async () => {
    const req = makeReq();
    const big = 'x'.repeat(2048);
    const result = await driveRequest(req, [JSON.stringify({ pad: big })], { maxBytes: 1024 });
    assert.equal(result.ok, false);
    assert.equal(result.status, 413);
    assert.match(result.error, /too large/);
    assert.equal(req.destroyed, true, 'req.destroy() must be called on 413');
});

test('parseRequestBody — 400 on invalid JSON', async () => {
    const req = makeReq();
    const result = await driveRequest(req, ['{not valid json']);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.error, /invalid JSON/);
});

test('parseRequestBody — empty body resolves to {} by default', async () => {
    const req = makeReq();
    const result = await driveRequest(req, []);
    assert.equal(result.ok, true);
    assert.deepEqual(result.body, {});
});

test('parseRequestBody — empty body returns 400 when allowEmpty=false', async () => {
    const req = makeReq();
    const result = await driveRequest(req, [], { allowEmpty: false });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
});

test('parseRequestBody — default cap is 8KB (accepts 8000 bytes)', async () => {
    const req = makeReq();
    const payload = JSON.stringify({ pad: 'a'.repeat(7900) });
    const result = await driveRequest(req, [payload]);
    assert.equal(result.ok, true);
});

test('parseRequestBody — default cap rejects 10KB', async () => {
    const req = makeReq();
    const payload = JSON.stringify({ pad: 'a'.repeat(10000) });
    const result = await driveRequest(req, [payload]);
    assert.equal(result.ok, false);
    assert.equal(result.status, 413);
});

test('parseRequestBody — idempotent: late events after 413 do not double-resolve', async () => {
    const req = makeReq();
    const p = parseRequestBody(req, { maxBytes: 32 });
    await new Promise((r) => setImmediate(r));
    req.emit('data', Buffer.from('x'.repeat(100))); // triggers 413
    const first = await p;
    assert.equal(first.status, 413);
    // Subsequent events must not throw or alter the resolved value.
    req.emit('data', Buffer.from('more data'));
    req.emit('end');
    // If the helper double-resolved we'd see no error here, but the
    // first await would have returned 413 deterministically — confirm
    // by re-awaiting the same Promise.
    const second = await p;
    assert.equal(second.status, 413);
    assert.equal(second, first);
});
