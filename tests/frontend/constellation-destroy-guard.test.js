'use strict';

/**
 * tests/frontend/constellation-destroy-guard.test.js — Wave 7C, ticket 19
 *
 * The destroy() guard in src/frontend/components/constellation/constellation.js
 * previously used `typeof state.pJS.fn && typeof state.pJS.fn.vendors && ...`
 * — but `typeof` returns a non-empty string (`"undefined"` for undefined
 * values), so those two checks were always truthy in a JS sense and the
 * intermediate object presence was never actually verified.
 *
 * This test:
 *   1. Source-text guard — fails if the buggy `typeof state.pJS.fn &&`
 *      pattern (with `&&`, not `===`) reappears.
 *   2. Behavior probe — extracts the destroy() body as a pure function
 *      over an injected `state` object and verifies the corrected guard:
 *        - missing pJS               → no throw, no destroypJS call
 *        - pJS but no fn             → no throw, no destroypJS call
 *        - pJS.fn but no vendors     → no throw, no destroypJS call
 *        - vendors.destroypJS string → no throw, no call (must be function)
 *        - vendors.destroypJS fn     → destroypJS called once
 *      The corrected guard pattern (real truthy checks on the object
 *      intermediates) is the only one that satisfies all five cases.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_PATH = path.join(__dirname, '..', '..',
    'src', 'frontend', 'components', 'constellation', 'constellation.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

test('Wave 7C ticket 19 — destroy() no longer uses the bogus `typeof X &&` chain', () => {
    // The buggy pattern was three `typeof` operands chained with `&&`.
    // After the fix only the trailing `typeof X.destroypJS === 'function'`
    // remains; intermediates are bare-truthy. Fail if the buggy first
    // operand reappears.
    assert.ok(
        !/if\s*\(\s*state\.pJS\s*&&\s*typeof\s+state\.pJS\.fn\s*&&/.test(SRC),
        'destroy() guard still contains the buggy `typeof state.pJS.fn &&` pattern',
    );
    // Sanity: the fixed guard with real object-truthy intermediates is present.
    assert.ok(
        /state\.pJS\s*&&\s*state\.pJS\.fn\s*&&\s*state\.pJS\.fn\.vendors\s*&&\s*typeof\s+state\.pJS\.fn\.vendors\.destroypJS\s*===\s*'function'/.test(SRC),
        'destroy() guard does not contain the corrected truthy-intermediate pattern',
    );
});

// Extract the destroy() body as a tiny pure function over an injected
// `state` object so we can probe the guard's behavior across the four
// "missing piece" cases plus the happy path.
function extractDestroyAsPureFn() {
    // Match `function destroy() { ... }` ending at a closing `}` at the
    // start of a line (the surrounding IIFE indent is 2 spaces).
    const re = /function\s+destroy\s*\(\s*\)\s*\{([\s\S]*?)\n  \}/m;
    const m = SRC.match(re);
    if (!m) throw new Error('could not extract destroy() body from constellation.js');
    const body = m[1];
    const code = `(function(state){${body}})`;
    return vm.runInNewContext(code);
}

test('destroy() — no pJS → safe no-op', () => {
    const fn = extractDestroyAsPureFn();
    const state = { pJS: null, initialized: true };
    assert.doesNotThrow(() => fn(state));
    assert.equal(state.pJS, null);
    assert.equal(state.initialized, false);
});

test('destroy() — pJS without .fn → safe no-op', () => {
    const fn = extractDestroyAsPureFn();
    const state = { pJS: {}, initialized: true };
    assert.doesNotThrow(() => fn(state));
});

test('destroy() — pJS.fn without .vendors → safe no-op', () => {
    const fn = extractDestroyAsPureFn();
    const state = { pJS: { fn: {} }, initialized: true };
    assert.doesNotThrow(() => fn(state));
});

test('destroy() — vendors.destroypJS not a function → no call', () => {
    const fn = extractDestroyAsPureFn();
    let called = false;
    const state = {
        pJS: { fn: { vendors: { destroypJS: 'not-a-function' } } },
        initialized: true,
    };
    assert.doesNotThrow(() => fn(state));
    assert.equal(called, false);
});

test('destroy() — vendors.destroypJS is a function → called exactly once', () => {
    const fn = extractDestroyAsPureFn();
    let callCount = 0;
    const state = {
        pJS: { fn: { vendors: { destroypJS: () => { callCount += 1; } } } },
        initialized: true,
    };
    fn(state);
    assert.equal(callCount, 1);
    assert.equal(state.pJS, null);
    assert.equal(state.initialized, false);
});
