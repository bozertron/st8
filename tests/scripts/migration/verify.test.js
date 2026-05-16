'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { detectBrowserOnly } = require('../../../scripts/migration/verify.js');

describe('scripts/migration/verify.js — detectBrowserOnly heuristic (ticket 23)', () => {
  let tmp;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-verify-'));
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function write(name, src) {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, src);
    return p;
  }

  it('detects window.X member access as browser-only', () => {
    const p = write('w.js', 'window.foo = 1;\nmodule.exports = {};\n');
    assert.equal(detectBrowserOnly(p), true);
  });

  it('detects document.querySelector usage', () => {
    const p = write('d.js', 'const el = document.querySelector(".x");\n');
    assert.equal(detectBrowserOnly(p), true);
  });

  it('detects navigator, location, localStorage, sessionStorage', () => {
    for (const [name, src] of [
      ['nav.js', 'console.log(navigator.userAgent);'],
      ['loc.js', 'location.href = "/";'],
      ['ls.js',  'localStorage.setItem("k", "v");'],
      ['ss.js',  'sessionStorage.removeItem("k");'],
    ]) {
      const p = write(name, src);
      assert.equal(detectBrowserOnly(p), true, `${name} should be detected`);
    }
  });

  it('detects customElements and HTMLElement', () => {
    assert.equal(detectBrowserOnly(write('ce.js', 'customElements.define("x-y", X);')), true);
    assert.equal(detectBrowserOnly(write('he.js', 'class X extends HTMLElement {}')), true);
  });

  it('detects typeof window guards', () => {
    const p = write('iso.js', 'if (typeof window !== "undefined") { /* browser path */ }');
    assert.equal(detectBrowserOnly(p), true);
  });

  it('does NOT flag pure Node modules', () => {
    const p = write('node.js', `
      const fs = require('fs');
      module.exports = { read: (f) => fs.readFileSync(f) };
    `);
    assert.equal(detectBrowserOnly(p), false);
  });

  it('does NOT flag commented-out browser references in block comments', () => {
    const p = write('bc.js', `
      /* This module used to call window.localStorage but no longer does. */
      module.exports = {};
    `);
    assert.equal(detectBrowserOnly(p), false);
  });

  it('does NOT flag commented-out browser references in line comments', () => {
    const p = write('lc.js', `
      // window.foo used to live here
      // document.querySelector(".x")
      module.exports = {};
    `);
    assert.equal(detectBrowserOnly(p), false);
  });

  it('does NOT mistake similarly-named identifiers (myWindow, documentation)', () => {
    const p = write('lookalikes.js', `
      const myWindow = { width: 800 };
      const documentation = "see README";
      module.exports = { myWindow, documentation };
    `);
    assert.equal(detectBrowserOnly(p), false);
  });

  it('returns false for non-existent file without throwing', () => {
    assert.equal(detectBrowserOnly(path.join(tmp, 'does-not-exist.js')), false);
  });

  it('correctly flags a real frontend file as browser-only', () => {
    // Integration: pick a known frontend file and confirm the heuristic fires.
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const candidate = path.join(repoRoot, 'src', 'frontend', 'app.js');
    if (!fs.existsSync(candidate)) return; // skip if missing
    assert.equal(detectBrowserOnly(candidate), true,
      'src/frontend/app.js should match the browser-only heuristic');
  });

  it('does NOT flag a real pure-Node backend module', () => {
    // Note: persistence.js intentionally NOT used here — it embeds SQL
    // string literals that contain documentary references to frontend
    // call sites (e.g. "window.createPRDProject()"), which the regex
    // heuristic correctly cannot distinguish from real member access
    // without an AST. False positives of this shape are harmless (they
    // downgrade verify.js's probe from require() to `node --check`, not
    // the other way around). Use hook-registry.js as a clean negative.
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const candidate = path.join(repoRoot, 'src', 'core', 'hook-registry.js');
    if (!fs.existsSync(candidate)) return; // skip if missing
    assert.equal(detectBrowserOnly(candidate), false,
      'hook-registry.js is pure server code — heuristic must not flag it');
  });
});
