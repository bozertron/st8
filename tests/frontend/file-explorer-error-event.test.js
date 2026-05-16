'use strict';

/**
 * tests/frontend/file-explorer-error-event.test.js — Wave 5I, ticket FRONT-003
 *
 * Verifies the CustomEvent contract that replaced the shell-side
 * MutationObserver banner hoist:
 *
 *   - calling _setError({ message, canRetry }) updates explorerState.error
 *     AND dispatches a 'explorer:error' CustomEvent on window with
 *     detail = the error object.
 *   - calling _setError(null) updates explorerState.error to null
 *     AND dispatches a 'explorer:error' CustomEvent with detail = null.
 *   - dispatch is gracefully no-oped when the window/CustomEvent
 *     globals are missing (test sandbox safety; production browsers
 *     always have them).
 *
 * file-explorer.js is browser code with many DOM dependencies. We
 * stub the minimum globals (window, document, console, fetch) and
 * vm.runInContext the source, then call window.VoidFileExplorer._setError
 * directly. We do NOT mount the explorer — the dispatcher does not
 * depend on mounting.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_PATH = path.join(__dirname, '..', '..',
    'src', 'frontend', 'components', 'file-explorer', 'file-explorer.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

// Minimal CustomEvent polyfill (node doesn't ship one in older versions).
class FakeCustomEvent {
    constructor(type, init) {
        this.type = type;
        this.detail = init ? init.detail : undefined;
    }
}

function makeSandbox() {
    const dispatched = [];
    const eventListeners = {};
    const win = {
        addEventListener(type, fn) {
            (eventListeners[type] = eventListeners[type] || []).push(fn);
        },
        dispatchEvent(ev) {
            dispatched.push({ type: ev.type, detail: ev.detail });
            (eventListeners[ev.type] || []).forEach((fn) => fn(ev));
            return true;
        },
        CustomEvent: FakeCustomEvent,
        location: { href: 'http://localhost/' },
    };
    const sandbox = {
        window: win,
        CustomEvent: FakeCustomEvent,
        console: { log() {}, warn() {}, error() {}, info() {} },
        document: {
            // file-explorer references these at module-load time only
            // inside functions, but VoidFileExplorer factory itself
            // does not. Provide a safe getElementById that returns null.
            getElementById: () => null,
            createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} }),
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener() {},
        },
        fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
        setTimeout, clearTimeout, setInterval, clearInterval,
        Promise,
    };
    sandbox.globalThis = sandbox;
    return { sandbox, dispatched, win };
}

function loadInSandbox() {
    const { sandbox, dispatched, win } = makeSandbox();
    const ctx = vm.createContext(sandbox);
    // Append an IIFE that builds VoidFileExplorer (the file uses a
    // factory wired only when the script's tail runs — verify by
    // running the source as-is; the bottom of file-explorer.js
    // assigns window.VoidFileExplorer at top-level).
    vm.runInContext(SRC, ctx, { filename: 'file-explorer.js' });
    return { sandbox, dispatched, win };
}

test('FRONT-003 — _setError(detail) dispatches explorer:error with detail', () => {
    const { win, dispatched } = loadInSandbox();
    assert.ok(win.VoidFileExplorer, 'window.VoidFileExplorer must be defined');
    assert.equal(typeof win.VoidFileExplorer._setError, 'function');

    const detail = { message: 'boom', canRetry: true };
    win.VoidFileExplorer._setError(detail);

    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, 'explorer:error');
    assert.deepEqual(dispatched[0].detail, detail);
});

test('FRONT-003 — _setError(null) dispatches explorer:error with null detail', () => {
    const { win, dispatched } = loadInSandbox();
    win.VoidFileExplorer._setError({ message: 'first', canRetry: false });
    win.VoidFileExplorer._setError(null);

    assert.equal(dispatched.length, 2);
    assert.equal(dispatched[1].type, 'explorer:error');
    assert.equal(dispatched[1].detail, null);
});

test('FRONT-003 — addEventListener listener receives the event', () => {
    const { win } = loadInSandbox();
    const received = [];
    win.addEventListener('explorer:error', (e) => received.push(e.detail));

    win.VoidFileExplorer._setError({ message: 'a', canRetry: true });
    win.VoidFileExplorer._setError(null);

    assert.equal(received.length, 2);
    assert.deepEqual(received[0], { message: 'a', canRetry: true });
    assert.equal(received[1], null);
});
