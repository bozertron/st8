'use strict';

/**
 * tests/frontend/graph-popup-a11y.test.js — Wave 5I, ticket FRONT-005
 *
 * Verifies the four a11y enhancements added to showGraphPopup():
 *   1. ARIA dialog semantics (role/aria-modal/aria-label/aria-labelledby)
 *   2. Initial focus moves to the close button
 *   3. Escape key closes the popup AND restores focus to opener
 *   4. Tab/Shift+Tab focus trap cycles within the overlay
 *
 * graph-viewer.js imports D3 dynamically via a <script> tag injected
 * at runtime — we don't exercise loadD3 here. Instead we vm-load the
 * file with a stubbed document + window that records the popup's DOM
 * tree, then directly invoke showGraphPopup() with a minimal manifest.
 * The visualizer.initialize() promise rejects in this sandbox (no real
 * D3), but the popup wiring is synchronous and runs BEFORE the D3
 * promise — that's exactly what we want to test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_PATH = path.join(__dirname, '..', '..',
    'src', 'frontend', 'components', 'graph-viewer', 'graph-viewer.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

// ─── Minimal DOM stubs ───────────────────────────────────────────
// We need just enough to let showGraphPopup run end-to-end up to the
// async D3 load. Implements:
//   - document.createElement → returns a FakeElement
//   - document.body.appendChild → adds to body's children
//   - document.getElementById → looks up by id within tree
//   - element.querySelector/querySelectorAll (simple selectors)
//   - element.addEventListener/removeEventListener
//   - innerHTML setter that parses a SUBSET of the popup HTML
//     (we only need to find buttons by class/data-attr).
//
// The HTML we parse is the literal string in showGraphPopup; we use
// regex extraction to build child elements with the relevant
// attributes. This is acceptable because the HTML is OWN-AUTHORED
// inside the file under test — if it changes, the test will catch it.

function mkElement(tag) {
    const el = {
        tagName: (tag || 'div').toUpperCase(),
        children: [],
        attributes: {},
        classList: {
            _set: new Set(),
            add(c) { this._set.add(c); },
            remove(c) { this._set.delete(c); },
            contains(c) { return this._set.has(c); },
        },
        listeners: {},
        parentNode: null,
        offsetParent: { /* truthy stub — treated as "visible" */ },
        style: {},
        textContent: '',
        get className() { return Array.from(this.classList._set).join(' '); },
        set className(v) {
            this.classList._set = new Set(String(v || '').split(/\s+/).filter(Boolean));
        },
        setAttribute(k, v) { this.attributes[k] = String(v); },
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
        hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); },
        removeAttribute(k) { delete this.attributes[k]; },
        appendChild(c) {
            c.parentNode = this;
            this.children.push(c);
            return c;
        },
        removeChild(c) {
            const i = this.children.indexOf(c);
            if (i >= 0) {
                this.children.splice(i, 1);
                c.parentNode = null;
            }
            return c;
        },
        addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
        removeEventListener(t, fn) {
            const arr = this.listeners[t];
            if (!arr) return;
            const i = arr.indexOf(fn);
            if (i >= 0) arr.splice(i, 1);
        },
        dispatch(t, ev) {
            (this.listeners[t] || []).forEach((fn) => fn(ev));
        },
        contains(other) {
            if (other === this) return true;
            for (const c of this.children) if (c.contains && c.contains(other)) return true;
            return false;
        },
        focus() {
            currentSandbox.document.activeElement = this;
        },
        // crude querySelector: supports '[data-X]', '.cls', '#id',
        // and combinators ', ' (returns first match).
        querySelector(sel) {
            const all = this.querySelectorAll(sel);
            return all[0] || null;
        },
        querySelectorAll(sel) {
            const sels = sel.split(',').map((s) => s.trim());
            const out = [];
            (function walk(node) {
                for (const c of node.children) {
                    for (const s of sels) {
                        if (matches(c, s)) { out.push(c); break; }
                    }
                    walk(c);
                }
            })(this);
            return out;
        },
        get innerHTML() { return ''; },
        set innerHTML(html) {
            // Parse the literal popup HTML. Strip newlines/extra spaces.
            // Build children for each <div>, <span>, <button> in source order.
            const cleaned = String(html).replace(/\s+/g, ' ');
            const tagRegex = /<(div|span|button)\b([^>]*)>/g;
            const stack = [this];
            let m;
            let lastIndex = 0;
            // Use a balanced-ish approach: each open creates a child of
            // top, each close pops. We approximate by scanning tags in
            // order; for our HTML this is sufficient (no nested same-tag
            // shenanigans, all close tags present).
            const both = /<(\/?)(div|span|button)\b([^>]*)>/g;
            while ((m = both.exec(cleaned)) !== null) {
                const closing = m[1] === '/';
                const t = m[2];
                if (closing) {
                    if (stack.length > 1) stack.pop();
                } else {
                    const child = mkElement(t);
                    parseAttrs(child, m[3] || '');
                    // textContent — between this open tag and the next tag
                    const after = both.lastIndex;
                    const nextTag = cleaned.indexOf('<', after);
                    if (nextTag > after) {
                        child.textContent = cleaned.slice(after, nextTag).trim();
                    }
                    stack[stack.length - 1].appendChild(child);
                    stack.push(child);
                }
            }
        },
    };
    return el;
}

function parseAttrs(el, attrStr) {
    // attribute pattern: name="value" or name='value' (no boolean attrs).
    const re = /(\w[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(attrStr)) !== null) {
        const name = m[1];
        const val = m[2] !== undefined ? m[2] : m[3];
        if (name === 'class') el.className = val;
        else el.setAttribute(name, val);
    }
}

function matches(el, sel) {
    sel = sel.trim();
    if (!sel) return false;
    if (sel.startsWith('#')) return el.getAttribute('id') === sel.slice(1);
    if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
    if (sel.startsWith('[')) {
        // [attr] or [attr="val"]
        const inner = sel.slice(1, -1);
        const eq = inner.indexOf('=');
        if (eq === -1) return el.hasAttribute(inner);
        const name = inner.slice(0, eq).trim();
        const val = inner.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        return el.getAttribute(name) === val;
    }
    // tag-with-class: e.g. "button:not([disabled])" — best-effort,
    // strip pseudos and check just the tag.
    const colon = sel.indexOf(':');
    const cleanSel = colon >= 0 ? sel.slice(0, colon) : sel;
    if (/^[a-z]+$/i.test(cleanSel)) return el.tagName === cleanSel.toUpperCase();
    return false;
}

// Chainable proxy so any d3.foo(...).bar(...).baz returns itself.
// Covers d3.select / forceSimulation / zoom / etc — all D3 methods
// used in _createSVG and render. Enough to let initialize().then(...)
// settle without throwing in our sandbox.
function makeD3Stub() {
    const chain = new Proxy(function () { return chain; }, {
        get(target, prop) {
            if (prop === 'then') return undefined; // not thenable
            if (prop === Symbol.toPrimitive) return () => '';
            return chain;
        },
        apply() { return chain; },
    });
    return chain;
}

let currentSandbox = null;

function makeSandbox() {
    const body = mkElement('body');
    const opener = mkElement('button');
    opener.setAttribute('id', 'opener-button');
    body.appendChild(opener);

    const documentListeners = {};
    const doc = {
        body,
        activeElement: opener,
        createElement(tag) { return mkElement(tag); },
        getElementById(id) {
            return body.querySelector('#' + id);
        },
        addEventListener(t, fn, capture) {
            (documentListeners[t] = documentListeners[t] || []).push({ fn, capture });
        },
        removeEventListener(t, fn) {
            const arr = documentListeners[t];
            if (!arr) return;
            const i = arr.findIndex((r) => r.fn === fn);
            if (i >= 0) arr.splice(i, 1);
        },
        dispatch(t, ev) {
            (documentListeners[t] || []).forEach((r) => r.fn(ev));
        },
        get documentListeners() { return documentListeners; },
    };

    // Stub window.d3 so loadD3() resolves immediately via its
    // "window.d3 already present" short-circuit and never touches
    // document.head (which we don't model). The popup wiring under
    // test runs SYNCHRONOUSLY before visualizer.initialize() resolves;
    // we still want the promise chain to settle cleanly to avoid
    // unhandled-rejection warnings after the test ends.
    const d3Stub = makeD3Stub();
    const win = {
        d3: d3Stub,
        addEventListener() {},
        removeEventListener() {},
        location: { href: 'http://localhost/' },
        St8GraphVisualizer: null,
    };

    const sandbox = {
        window: win,
        document: doc,
        console: { log() {}, warn() {}, error() {}, info() {} },
        setTimeout, clearTimeout, setInterval, clearInterval,
        Promise,
    };
    sandbox.globalThis = sandbox;
    currentSandbox = sandbox;
    return sandbox;
}

function loadInSandbox() {
    const sandbox = makeSandbox();
    const ctx = vm.createContext(sandbox);
    vm.runInContext(SRC, ctx, { filename: 'graph-viewer.js' });
    return sandbox;
}

// ─── Tests ───────────────────────────────────────────────────────

test('FRONT-005 — popup overlay has ARIA dialog attributes', () => {
    const sb = loadInSandbox();
    sb.window.St8GraphVisualizer.showGraphPopup({ files: [] });

    const overlay = sb.document.body.querySelector('.graph-popup-overlay');
    assert.ok(overlay, 'overlay should be appended to body');
    assert.equal(overlay.getAttribute('role'), 'dialog');
    assert.equal(overlay.getAttribute('aria-modal'), 'true');
    assert.equal(overlay.getAttribute('aria-label'), 'Connection graph');
    assert.equal(overlay.getAttribute('aria-labelledby'), 'graph-popup-title');

    const closeBtn = overlay.querySelector('.graph-popup-close');
    assert.ok(closeBtn, 'close button should exist');
    assert.equal(closeBtn.getAttribute('aria-label'), 'Close connection graph');
});

test('FRONT-005 — initial focus moves to close button', () => {
    const sb = loadInSandbox();
    sb.window.St8GraphVisualizer.showGraphPopup({ files: [] });

    const overlay = sb.document.body.querySelector('.graph-popup-overlay');
    const closeBtn = overlay.querySelector('.graph-popup-close');
    assert.equal(sb.document.activeElement, closeBtn,
        'close button should be the active element after popup opens');
});

test('FRONT-005 — Escape key closes popup AND returns focus to opener', () => {
    const sb = loadInSandbox();
    const opener = sb.document.getElementById('opener-button');
    // Simulate the opener being focused (as if user clicked it).
    opener.focus();
    sb.document.activeElement = opener;

    sb.window.St8GraphVisualizer.showGraphPopup({ files: [] });

    // Sanity: overlay attached
    assert.ok(sb.document.body.querySelector('.graph-popup-overlay'),
        'overlay should exist before Escape');

    // Fire Escape. preventDefault/stopPropagation are no-ops here.
    let prevented = false, stopped = false;
    sb.document.dispatch('keydown', {
        key: 'Escape',
        shiftKey: false,
        preventDefault: () => { prevented = true; },
        stopPropagation: () => { stopped = true; },
    });

    assert.ok(prevented, 'Escape handler should call preventDefault');
    assert.ok(stopped, 'Escape handler should call stopPropagation');
    assert.equal(sb.document.body.querySelector('.graph-popup-overlay'), null,
        'overlay should be removed after Escape');
    assert.equal(sb.document.activeElement, opener,
        'focus should return to opener');
});

test('FRONT-005 — close button click closes popup', () => {
    const sb = loadInSandbox();
    sb.window.St8GraphVisualizer.showGraphPopup({ files: [] });

    const overlay = sb.document.body.querySelector('.graph-popup-overlay');
    const closeBtn = overlay.querySelector('.graph-popup-close');
    closeBtn.dispatch('click', {});

    assert.equal(sb.document.body.querySelector('.graph-popup-overlay'), null,
        'overlay should be removed after close button click');
});

test('FRONT-005 — Tab on last focusable cycles to first (focus trap)', () => {
    const sb = loadInSandbox();
    sb.window.St8GraphVisualizer.showGraphPopup({ files: [] });

    const overlay = sb.document.body.querySelector('.graph-popup-overlay');
    const focusables = overlay.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]),' +
        ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    assert.ok(focusables.length >= 2, 'popup should have multiple focusable buttons');

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Simulate focus on last element, then press Tab → should wrap to first.
    sb.document.activeElement = last;
    let prevented = false;
    sb.document.dispatch('keydown', {
        key: 'Tab',
        shiftKey: false,
        preventDefault: () => { prevented = true; },
        stopPropagation: () => {},
    });

    assert.ok(prevented, 'Tab from last focusable should preventDefault');
    assert.equal(sb.document.activeElement, first,
        'focus should wrap to first focusable');
});

test('FRONT-005 — Shift+Tab on first focusable cycles to last (focus trap)', () => {
    const sb = loadInSandbox();
    sb.window.St8GraphVisualizer.showGraphPopup({ files: [] });

    const overlay = sb.document.body.querySelector('.graph-popup-overlay');
    const focusables = overlay.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]),' +
        ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    sb.document.activeElement = first;
    let prevented = false;
    sb.document.dispatch('keydown', {
        key: 'Tab',
        shiftKey: true,
        preventDefault: () => { prevented = true; },
        stopPropagation: () => {},
    });

    assert.ok(prevented, 'Shift+Tab from first focusable should preventDefault');
    assert.equal(sb.document.activeElement, last,
        'focus should wrap to last focusable');
});

test('FRONT-005 — keydown listener is removed on close (no leak)', () => {
    const sb = loadInSandbox();
    sb.window.St8GraphVisualizer.showGraphPopup({ files: [] });

    const before = sb.document.documentListeners.keydown.length;
    assert.equal(before, 1, 'popup should register exactly one keydown listener');

    // Close via Escape
    sb.document.dispatch('keydown', {
        key: 'Escape', shiftKey: false,
        preventDefault: () => {}, stopPropagation: () => {},
    });

    const after = sb.document.documentListeners.keydown.length;
    assert.equal(after, 0, 'keydown listener should be removed after close');
});
