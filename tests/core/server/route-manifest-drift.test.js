'use strict';

/**
 * route-manifest-drift.test.js — Wave 5G ticket 13 (API-008).
 *
 * Asserts 1:1 correspondence between the declared manifest at
 * `src/core/server/route-manifest.js` and the actual routes implemented
 * in `src/core/server/app.js`. If a developer adds a route to one but
 * not the other, this test fails loudly.
 *
 * Detection strategy:
 *   - Flat routes are extracted by regex over `app.js` for the
 *     `case '/api/...':` lines inside `_handleApiRequest`.
 *   - Parameterised routes (default-branch regex matchers) are detected
 *     by scanning for `url.pathname.match(/^\/api\/.../$)` patterns in
 *     the same method body.
 *
 * The test is independent of test ordering and does not boot a server.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '../../../src/core/server/app.js');
const { ROUTES } = require('../../../src/core/server/route-manifest');

// Read app.js source once.
const appSrc = fs.readFileSync(APP_PATH, 'utf8');

// Extract just the body of _handleApiRequest to avoid false positives
// from elsewhere in the file (e.g. JSDoc examples that mention paths).
function extractHandleApiRequestBody(src) {
  const startMarker = '_handleApiRequest(req, res, url) {';
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) throw new Error('drift test: _handleApiRequest not found in app.js');
  // Find the matching closing brace by counting braces from after the
  // opening one.
  let depth = 0;
  let i = startIdx + startMarker.length - 1; // points at the opening '{'
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  throw new Error('drift test: unterminated _handleApiRequest body');
}

function extractFlatRoutes(body) {
  const re = /case\s+'(\/api\/[^']+)'\s*:/g;
  const out = new Set();
  let m;
  while ((m = re.exec(body)) !== null) out.add(m[1]);
  return out;
}

function extractParamRoutes(body) {
  // Look for regex literals like /^\/api\/tickets\/(\d+)\/claim$/ in the
  // default branch. We grab everything between `/^` and `$/` and then
  // canonicalise.
  const re = /\/\^(.*?)\$\//g;
  const out = new Set();
  let m;
  while ((m = re.exec(body)) !== null) {
    let pattern = m[1];
    // Strip the backslash-escape on forward slashes that JS regex literals
    // require (`\/` → `/`).
    pattern = pattern.replace(/\\\//g, '/');
    // Filter to /api/... routes only — there may be other regex literals
    // elsewhere in the body (e.g. accept-header parsing).
    if (!pattern.startsWith('/api/')) continue;
    // Capture group (\d+) → :id
    pattern = pattern.replace(/\(\\d\+\)/g, ':id');
    // Any other capture group → :name
    pattern = pattern.replace(/\([^)]+\)/g, ':name');
    out.add(pattern);
  }
  return out;
}

test('route-manifest covers every flat case in app.js _handleApiRequest', () => {
  const body = extractHandleApiRequestBody(appSrc);
  const flatInApp = extractFlatRoutes(body);
  const flatInManifest = new Set(
    ROUTES.filter(r => !r.path.includes(':')).map(r => r.path)
  );

  const missingFromManifest = [...flatInApp].filter(p => !flatInManifest.has(p));
  const extraInManifest = [...flatInManifest].filter(p => !flatInApp.has(p));

  assert.deepStrictEqual(
    missingFromManifest, [],
    `route-manifest.js is missing flat routes that exist in app.js: ${missingFromManifest.join(', ')}`
  );
  assert.deepStrictEqual(
    extraInManifest, [],
    `route-manifest.js declares flat routes that do NOT exist in app.js: ${extraInManifest.join(', ')}`
  );
});

test('route-manifest covers every parameterised route in app.js default branch', () => {
  const body = extractHandleApiRequestBody(appSrc);
  const paramInApp = extractParamRoutes(body);
  const paramInManifest = new Set(
    ROUTES.filter(r => r.path.includes(':')).map(r => r.path)
  );

  // /api/prd-projects/:name is matched by regex elsewhere (inside
  // _handlePrdProjects rather than the default branch). The drift test
  // only enforces 1:1 for routes routed via the default-branch regex.
  // Drop it from the manifest side when comparing.
  paramInManifest.delete('/api/prd-projects/:name');

  const missingFromManifest = [...paramInApp].filter(p => !paramInManifest.has(p));
  const extraInManifest = [...paramInManifest].filter(p => !paramInApp.has(p));

  assert.deepStrictEqual(
    missingFromManifest, [],
    `route-manifest.js is missing parameterised routes that exist in app.js default branch: ${missingFromManifest.join(', ')}`
  );
  assert.deepStrictEqual(
    extraInManifest, [],
    `route-manifest.js declares parameterised routes routed via default-branch regex that do NOT exist in app.js: ${extraInManifest.join(', ')}`
  );
});

test('every route in the manifest has a handler method declared on St8Server', () => {
  const declaredHandlers = new Set(ROUTES.map(r => r.handler));
  const missing = [];
  for (const h of declaredHandlers) {
    // Each handler is declared as a method, so we look for `<handler>(`
    // preceded by start-of-line indentation.
    const re = new RegExp(`\\b${h}\\s*\\(`);
    if (!re.test(appSrc)) missing.push(h);
  }
  assert.deepStrictEqual(missing, [], `route-manifest.js references handlers absent from app.js: ${missing.join(', ')}`);
});

test('every manifest entry has the required shape', () => {
  const allowedAuth = new Set(['none', 'X-St8-Secret', 'loopback']);
  const allowedMethod = new Set(['GET', 'POST', 'GET|POST']);
  for (const r of ROUTES) {
    assert.ok(allowedMethod.has(r.method), `bad method on ${r.path}: ${r.method}`);
    assert.ok(typeof r.path === 'string' && r.path.startsWith('/api/'), `bad path: ${r.path}`);
    assert.ok(typeof r.handler === 'string' && r.handler.length > 0, `bad handler on ${r.path}`);
    assert.ok(allowedAuth.has(r.auth), `bad auth on ${r.path}: ${r.auth}`);
    assert.ok(typeof r.description === 'string' && r.description.length > 0, `missing description on ${r.path}`);
  }
});
