'use strict';

/**
 * tests/frontend/status-colors.test.js — Wave 7C, ticket 9
 *
 * Verifies the single-source-of-truth shared module at
 * src/frontend/components/status-colors.js used by both
 * constellation.js (RGB triplets for particles.js) and dive-in.js
 * (integer hex for THREE.js).
 *
 * The module is designed to load as a browser <script> tag (sets
 * window.St8StatusColors) AND as a Node CommonJS module
 * (module.exports), so it can be required directly here.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const MOD_PATH = path.join(__dirname, '..', '..',
    'src', 'frontend', 'components', 'status-colors.js');

const StatusColors = require(MOD_PATH);

test('exports HEX, INT, RGB, resolve, resolveInt, hexToInt, hexToRgb', () => {
    assert.ok(StatusColors.HEX, 'HEX missing');
    assert.ok(StatusColors.INT, 'INT missing');
    assert.ok(StatusColors.RGB, 'RGB missing');
    assert.equal(typeof StatusColors.resolve,    'function');
    assert.equal(typeof StatusColors.resolveInt, 'function');
    assert.equal(typeof StatusColors.hexToInt,   'function');
    assert.equal(typeof StatusColors.hexToRgb,   'function');
});

test('HEX values match canonical st8 hues (must stay in sync with tokens.css)', () => {
    assert.equal(StatusColors.HEX.GREEN,  'D4AF37', 'gold');
    assert.equal(StatusColors.HEX.YELLOW, 'D4AF37', 'gold');
    assert.equal(StatusColors.HEX.RED,    '1FBDEA', 'cyan / bug-juice');
    assert.equal(StatusColors.HEX.LOCKED, 'C9748F', 'pink / louis-protected');
    assert.equal(StatusColors.HEX.COMBAT, '9D4EDD', 'purple / agents-active');
});

test('INT values are pre-derived integer forms', () => {
    assert.equal(StatusColors.INT.GREEN,  0xD4AF37);
    assert.equal(StatusColors.INT.YELLOW, 0xD4AF37);
    assert.equal(StatusColors.INT.RED,    0x1FBDEA);
    assert.equal(StatusColors.INT.LOCKED, 0xC9748F);
    assert.equal(StatusColors.INT.COMBAT, 0x9D4EDD);
});

test('RGB values are pre-derived {r,g,b} objects matching the constellation.js historical inline map', () => {
    // The previously-duplicated inline map was the assertion target —
    // RGB extraction from the canonical hex must reproduce it exactly.
    assert.deepEqual(StatusColors.RGB.GREEN,  { r: 212, g: 175, b: 55  });
    assert.deepEqual(StatusColors.RGB.YELLOW, { r: 212, g: 175, b: 55  });
    assert.deepEqual(StatusColors.RGB.RED,    { r: 31,  g: 189, b: 234 });
    assert.deepEqual(StatusColors.RGB.LOCKED, { r: 201, g: 116, b: 143 });
    assert.deepEqual(StatusColors.RGB.COMBAT, { r: 157, g: 78,  b: 221 });
});

test('hexToInt converts 6-char hex string to integer', () => {
    assert.equal(StatusColors.hexToInt('D4AF37'), 0xD4AF37);
    assert.equal(StatusColors.hexToInt('000000'), 0);
    assert.equal(StatusColors.hexToInt('FFFFFF'), 0xFFFFFF);
});

test('hexToRgb decomposes a 6-char hex string to {r,g,b}', () => {
    assert.deepEqual(StatusColors.hexToRgb('D4AF37'), { r: 212, g: 175, b: 55  });
    assert.deepEqual(StatusColors.hexToRgb('000000'), { r: 0,   g: 0,   b: 0   });
    assert.deepEqual(StatusColors.hexToRgb('FFFFFF'), { r: 255, g: 255, b: 255 });
});

test('resolve(file) returns RGB triplet honoring file.locked override', () => {
    assert.deepEqual(StatusColors.resolve({ locked: true,  status: 'RED'    }), StatusColors.RGB.LOCKED);
    assert.deepEqual(StatusColors.resolve({ locked: false, status: 'RED'    }), StatusColors.RGB.RED);
    assert.deepEqual(StatusColors.resolve({ status: 'GREEN'                 }), StatusColors.RGB.GREEN);
    assert.deepEqual(StatusColors.resolve({ status: 'COMBAT'                }), StatusColors.RGB.COMBAT);
    // Unknown status → fall through to GREEN.
    assert.deepEqual(StatusColors.resolve({ status: 'UNKNOWN_STATE'         }), StatusColors.RGB.GREEN);
    // Missing file → GREEN default.
    assert.deepEqual(StatusColors.resolve(null), StatusColors.RGB.GREEN);
});

test('resolveInt(file) returns integer form honoring file.locked override', () => {
    assert.equal(StatusColors.resolveInt({ locked: true,  status: 'RED' }), StatusColors.INT.LOCKED);
    assert.equal(StatusColors.resolveInt({ locked: false, status: 'RED' }), StatusColors.INT.RED);
    assert.equal(StatusColors.resolveInt({ status: 'GREEN'              }), StatusColors.INT.GREEN);
    assert.equal(StatusColors.resolveInt({ status: 'COMBAT'             }), StatusColors.INT.COMBAT);
    // Unknown status → GREEN.
    assert.equal(StatusColors.resolveInt({ status: 'UNKNOWN_STATE' }), StatusColors.INT.GREEN);
    assert.equal(StatusColors.resolveInt(null), StatusColors.INT.GREEN);
});

test('source-text guard — constellation.js no longer carries an inline STATUS_COLOR object literal as the primary definition', () => {
    const constSrc = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'frontend', 'components', 'constellation', 'constellation.js'),
        'utf8',
    );
    // The primary STATUS_COLOR binding should now reference the shared
    // module first. The inline object remains only as a fallback (the
    // `||` right-hand side of the alias).
    assert.ok(
        /STATUS_COLOR\s*=\s*\(?\s*window\.St8StatusColors[\s\S]*?RGB/.test(constSrc),
        'constellation.js STATUS_COLOR no longer reads from window.St8StatusColors.RGB',
    );
});

test('source-text guard — dive-in.js no longer carries an inline STATUS_COLOR object literal as the primary definition', () => {
    const diveSrc = fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'frontend', 'components', 'dive-in', 'dive-in.js'),
        'utf8',
    );
    assert.ok(
        /STATUS_COLOR\s*=\s*\(?[\s\S]*?window\.St8StatusColors[\s\S]*?INT/.test(diveSrc),
        'dive-in.js STATUS_COLOR no longer reads from window.St8StatusColors.INT',
    );
});
