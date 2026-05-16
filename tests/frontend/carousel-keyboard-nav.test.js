'use strict';

/**
 * tests/frontend/carousel-keyboard-nav.test.js — Wave 7B, ticket 7
 *
 * Verifies the keyboard navigation helpers added to app.js for the
 * slide carousel:
 *   - nextSlideTarget(key, current) computes the right destination
 *     for ESC, ArrowLeft, ArrowRight, Home, End — and returns null
 *     for unhandled keys or no-op transitions (e.g. End from phreak).
 *   - shouldSuppressCarouselKey(e) returns true when a typeable
 *     element has focus, a modal overlay is open, the phreak TUI is
 *     active, or any non-Shift modifier is down.
 *
 * Extraction strategy:
 *   app.js is a single top-level IIFE that wires the DOM at parse
 *   time — vm-loading the whole file would require a kitchen-sink
 *   DOM. Instead we regex-extract the two pure-function bodies from
 *   the source text and vm-evaluate ONLY those, treating them as
 *   self-contained. If a future edit deletes the named function the
 *   extraction throws and the test fails loudly.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_PATH = path.join(__dirname, '..', '..', 'src', 'frontend', 'app.js');
const SRC = fs.readFileSync(APP_PATH, 'utf8');

function extractFn(name) {
    // Greedy match the function up to its closing brace at column 4
    // (matches the 4-space indent the file uses for top-level fns).
    const re = new RegExp(
        'function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n    \\}',
        'm'
    );
    const m = SRC.match(re);
    if (!m) {
        throw new Error('Could not extract function ' + name + ' from app.js');
    }
    return m[0];
}

const fnSources = [extractFn('nextSlideTarget'), extractFn('shouldSuppressCarouselKey')].join('\n');

function makeContext(extras) {
    const ctx = Object.assign({
        document: {
            querySelector: function() { return null; },
            getElementById: function() { return null; },
        },
        window: {},
    }, extras || {});
    vm.createContext(ctx);
    vm.runInContext(fnSources + '\n;', ctx);
    return ctx;
}

test('nextSlideTarget: ArrowRight advances explorer → st8 → phreak', () => {
    const ctx = makeContext();
    assert.equal(vm.runInContext("nextSlideTarget('ArrowRight','explorer')", ctx), 'st8');
    assert.equal(vm.runInContext("nextSlideTarget('ArrowRight','st8')", ctx), 'phreak');
    assert.equal(vm.runInContext("nextSlideTarget('ArrowRight','phreak')", ctx), null);
});

test('nextSlideTarget: ArrowLeft reverses phreak → st8 → explorer', () => {
    const ctx = makeContext();
    assert.equal(vm.runInContext("nextSlideTarget('ArrowLeft','phreak')", ctx), 'st8');
    assert.equal(vm.runInContext("nextSlideTarget('ArrowLeft','st8')", ctx), 'explorer');
    assert.equal(vm.runInContext("nextSlideTarget('ArrowLeft','explorer')", ctx), null);
});

test('nextSlideTarget: Escape returns to st8 from flanking panels and null at st8', () => {
    const ctx = makeContext();
    assert.equal(vm.runInContext("nextSlideTarget('Escape','explorer')", ctx), 'st8');
    assert.equal(vm.runInContext("nextSlideTarget('Escape','phreak')", ctx), 'st8');
    assert.equal(vm.runInContext("nextSlideTarget('Escape','st8')", ctx), null);
});

test('nextSlideTarget: Home jumps to explorer (no-op when already there)', () => {
    const ctx = makeContext();
    assert.equal(vm.runInContext("nextSlideTarget('Home','phreak')", ctx), 'explorer');
    assert.equal(vm.runInContext("nextSlideTarget('Home','st8')", ctx), 'explorer');
    assert.equal(vm.runInContext("nextSlideTarget('Home','explorer')", ctx), null);
});

test('nextSlideTarget: End jumps to phreak (no-op when already there)', () => {
    const ctx = makeContext();
    assert.equal(vm.runInContext("nextSlideTarget('End','explorer')", ctx), 'phreak');
    assert.equal(vm.runInContext("nextSlideTarget('End','st8')", ctx), 'phreak');
    assert.equal(vm.runInContext("nextSlideTarget('End','phreak')", ctx), null);
});

test('nextSlideTarget: unhandled keys and unknown panels return null', () => {
    const ctx = makeContext();
    assert.equal(vm.runInContext("nextSlideTarget('Tab','st8')", ctx), null);
    assert.equal(vm.runInContext("nextSlideTarget('a','st8')", ctx), null);
    assert.equal(vm.runInContext("nextSlideTarget('Enter','st8')", ctx), null);
    assert.equal(vm.runInContext("nextSlideTarget('ArrowLeft','bogus')", ctx), null);
});

test('shouldSuppressCarouselKey: modifier keys suppress', () => {
    const ctx = makeContext();
    const f = vm.runInContext('shouldSuppressCarouselKey', ctx);
    assert.equal(f({ ctrlKey: true,  target: null }), true);
    assert.equal(f({ metaKey: true,  target: null }), true);
    assert.equal(f({ altKey: true,   target: null }), true);
    assert.equal(f({ shiftKey: true, target: null }), false);
    assert.equal(f({ target: null }), false);
});

test('shouldSuppressCarouselKey: typeable element targets suppress', () => {
    const ctx = makeContext();
    const f = vm.runInContext('shouldSuppressCarouselKey', ctx);
    assert.equal(f({ target: { tagName: 'INPUT' } }), true);
    assert.equal(f({ target: { tagName: 'TEXTAREA' } }), true);
    assert.equal(f({ target: { tagName: 'SELECT' } }), true);
    assert.equal(f({ target: { tagName: 'DIV', isContentEditable: true } }), true);
    assert.equal(f({ target: { tagName: 'DIV' } }), false);
    assert.equal(f({ target: { tagName: 'BUTTON' } }), false);
});

test('shouldSuppressCarouselKey: open notes-popup-overlay suppresses', () => {
    const ctx = makeContext({
        document: {
            querySelector: function(sel) {
                return sel === '.notes-popup-overlay' ? { tagName: 'DIV' } : null;
            },
            getElementById: function() { return null; },
        },
        window: {},
    });
    const f = vm.runInContext('shouldSuppressCarouselKey', ctx);
    assert.equal(f({ target: { tagName: 'BODY' } }), true);
});

test('shouldSuppressCarouselKey: open PRD wizard overlay suppresses', () => {
    const overlay = {
        tagName: 'DIV',
        classList: { contains: function(c) { return c === 'open'; } },
    };
    const ctx = makeContext({
        document: {
            querySelector: function() { return null; },
            getElementById: function(id) {
                return id === 'overlay-prd-wizard' ? overlay : null;
            },
        },
        window: {},
    });
    const f = vm.runInContext('shouldSuppressCarouselKey', ctx);
    assert.equal(f({ target: { tagName: 'BODY' } }), true);
});

test('shouldSuppressCarouselKey: phreak TUI active suppresses', () => {
    const ctx = makeContext({
        document: {
            querySelector: function() { return null; },
            getElementById: function() { return null; },
        },
        window: {
            PhreakTerminal: {
                getState: function() { return { isTUI: true }; },
            },
        },
    });
    const f = vm.runInContext('shouldSuppressCarouselKey', ctx);
    assert.equal(f({ target: { tagName: 'BODY' } }), true);
});

test('shouldSuppressCarouselKey: defaults allow the keydown through', () => {
    const ctx = makeContext();
    const f = vm.runInContext('shouldSuppressCarouselKey', ctx);
    assert.equal(f({ target: { tagName: 'BODY' } }), false);
});
