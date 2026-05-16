'use strict';

/**
 * tests/frontend/services/settings-reader.test.js
 *
 * Unit tests for src/frontend/services/settings-reader.js.
 *
 * The service is browser code (window globals, fetch). To exercise
 * it in node we load it into a vm sandbox with stubbed window/console
 * and a fetch shim that resolves against an in-process fake server.
 * The service's own MemoryAdapter then handles the cases where we
 * want to assert behavior without a fetch round-trip.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Cross-realm deep equality. Values created inside vm.createContext
// carry that sandbox's Object.prototype, which `deepStrictEqual`
// (the strict-mode default) rejects even when the structure matches.
// JSON-roundtrip flattens both sides into host-realm primitives.
function assertDeepEqJSON(actual, expected, message) {
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', '..',
        'src', 'frontend', 'services', 'settings-reader.js'),
    'utf8'
);

function makeSandbox(opts) {
    opts = opts || {};
    const fetchCalls = [];
    const consoleCalls = { warn: [], error: [], info: [] };
    const fetchImpl = opts.fetch || function (url, init) {
        fetchCalls.push({ url: url, init: init });
        return Promise.resolve({
            ok: true,
            status: 200,
            json: function () { return Promise.resolve({ status: 'ok', data: {} }); }
        });
    };
    const sandbox = {
        window: {},
        console: {
            warn: function () { consoleCalls.warn.push(Array.from(arguments)); },
            error: function () { consoleCalls.error.push(Array.from(arguments)); },
            info: function () { consoleCalls.info.push(Array.from(arguments)); },
            log: function () {}
        },
        fetch: fetchImpl
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(SRC, ctx, { filename: 'settings-reader.js' });
    return { sandbox: sandbox, fetchCalls: fetchCalls, consoleCalls: consoleCalls };
}

// ─── Module-load shape ─────────────────────────────────────────

test('exposes the documented public API on window.St8SettingsReader', () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    assert.ok(api, 'St8SettingsReader missing');
    ['loadAll', 'persist', 'addListener', 'removeListener',
     'setAdapter', 'getAdapter', 'BackendAdapter', 'MemoryAdapter']
        .forEach(function (key) {
            assert.equal(typeof api[key], key === 'BackendAdapter' || key === 'MemoryAdapter'
                ? 'function' : 'function', 'missing ' + key);
        });
});

test('default adapter is a BackendAdapter instance', () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    assert.ok(api.getAdapter() instanceof api.BackendAdapter);
});

// ─── BackendAdapter (default path) ────────────────────────────

test('loadAll() hits /api/settings via fetch', async () => {
    const { sandbox, fetchCalls } = makeSandbox();
    const result = await sandbox.window.St8SettingsReader.loadAll();
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/settings');
    assertDeepEqJSON(result, { status: 'ok', data: {} });
});

test('persist() POSTs to /api/settings with the right body and returns true on 2xx', async () => {
    const { sandbox, fetchCalls } = makeSandbox();
    const ok = await sandbox.window.St8SettingsReader.persist('voidflow', 'reveal_wpm', 240);
    assert.equal(ok, true);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/settings');
    assert.equal(fetchCalls[0].init.method, 'POST');
    const body = JSON.parse(fetchCalls[0].init.body);
    assertDeepEqJSON(body, { category: 'voidflow', key: 'reveal_wpm', value: 240 });
});

test('persist() returns false on non-2xx and does NOT emit', async () => {
    const calls = [];
    const { sandbox } = makeSandbox({
        fetch: function () {
            return Promise.resolve({ ok: false, status: 400, json: function () { return Promise.resolve({}); } });
        }
    });
    sandbox.window.St8SettingsReader.addListener(function (ev) { calls.push(ev); });
    const ok = await sandbox.window.St8SettingsReader.persist('voidflow', 'reveal_wpm', -1);
    assert.equal(ok, false);
    assert.equal(calls.length, 0, 'failed persist should not notify subscribers');
});

test('persist() returns false on network error and logs but does not throw', async () => {
    const { sandbox, consoleCalls } = makeSandbox({
        fetch: function () { return Promise.reject(new Error('net down')); }
    });
    const ok = await sandbox.window.St8SettingsReader.persist('voidflow', 'reveal_wpm', 240);
    assert.equal(ok, false);
    assert.ok(consoleCalls.warn.length >= 1);
});

test('loadAll() rejects when /api/settings is non-2xx', async () => {
    const { sandbox } = makeSandbox({
        fetch: function () {
            return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({}); } });
        }
    });
    await assert.rejects(
        () => sandbox.window.St8SettingsReader.loadAll(),
        /Failed to load settings: 500/
    );
});

// ─── MemoryAdapter (test path) ────────────────────────────────

test('MemoryAdapter starts empty (no seed) and persists values', async () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    const adapter = new api.MemoryAdapter();
    api.setAdapter(adapter);
    const initial = await api.loadAll();
    assertDeepEqJSON(initial.data, {});
    await api.persist('voidflow', 'reveal_wpm', 240);
    const after = await api.loadAll();
    assertDeepEqJSON(after.data, { voidflow: { reveal_wpm: 240 } });
});

test('MemoryAdapter accepts a seed and snapshots it (no aliasing)', async () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    const seed = { voidflow: { reveal_wpm: 200 } };
    const adapter = new api.MemoryAdapter(seed);
    api.setAdapter(adapter);
    // Mutate the original seed object — adapter should be unaffected.
    seed.voidflow.reveal_wpm = 999;
    const result = await api.loadAll();
    assert.equal(result.data.voidflow.reveal_wpm, 200);
});

test('MemoryAdapter persists array categories by replacing the whole array', async () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    api.setAdapter(new api.MemoryAdapter());
    await api.persist('models', '__list__', [{ id: 'a' }, { id: 'b' }]);
    const result = await api.loadAll();
    assertDeepEqJSON(result.data.models, [{ id: 'a' }, { id: 'b' }]);
});

// ─── Subscriber API ───────────────────────────────────────────

test('addListener receives a {category, key, value} payload on every successful persist', async () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    api.setAdapter(new api.MemoryAdapter());
    const events = [];
    api.addListener(function (ev) { events.push(ev); });
    await api.persist('voidflow', 'reveal_wpm', 240);
    await api.persist('voidflow', 'cursor_metronome', false);
    assert.equal(events.length, 2);
    assertDeepEqJSON(events[0], { category: 'voidflow', key: 'reveal_wpm', value: 240 });
    assertDeepEqJSON(events[1], { category: 'voidflow', key: 'cursor_metronome', value: false });
});

test('removeListener stops notifications for the unsubscribed callback only', async () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    api.setAdapter(new api.MemoryAdapter());
    const a = [];
    const b = [];
    const cbA = function (ev) { a.push(ev); };
    const cbB = function (ev) { b.push(ev); };
    api.addListener(cbA);
    api.addListener(cbB);
    await api.persist('voidflow', 'reveal_wpm', 240);
    api.removeListener(cbA);
    await api.persist('voidflow', 'reveal_wpm', 300);
    assert.equal(a.length, 1);
    assert.equal(b.length, 2);
});

test('listener that throws does not block other listeners or the persist', async () => {
    const { sandbox, consoleCalls } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    api.setAdapter(new api.MemoryAdapter());
    const good = [];
    api.addListener(function () { throw new Error('boom'); });
    api.addListener(function (ev) { good.push(ev); });
    const ok = await api.persist('voidflow', 'reveal_wpm', 240);
    assert.equal(ok, true);
    assert.equal(good.length, 1);
    assert.ok(consoleCalls.warn.some(function (line) {
        return String(line[0]).indexOf('listener threw') !== -1;
    }), 'expected the throw to be logged');
});

test('non-function values passed to addListener are ignored', async () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    api.setAdapter(new api.MemoryAdapter());
    api.addListener(null);
    api.addListener(undefined);
    api.addListener(42);
    // Should not throw on persist.
    const ok = await api.persist('voidflow', 'reveal_wpm', 240);
    assert.equal(ok, true);
});

// ─── Adapter swap ─────────────────────────────────────────────

test('setAdapter swaps the storage backend reflectively', async () => {
    const { sandbox } = makeSandbox();
    const api = sandbox.window.St8SettingsReader;
    assert.ok(api.getAdapter() instanceof api.BackendAdapter);
    const mem = new api.MemoryAdapter({ voidflow: { reveal_wpm: 123 } });
    api.setAdapter(mem);
    assert.equal(api.getAdapter(), mem);
    const result = await api.loadAll();
    assert.equal(result.data.voidflow.reveal_wpm, 123);
});
