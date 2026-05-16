# Research: tests/core/server/route-manifest-drift.test.js — T4 pattern extension

**Wave:** analysis-tools-unblock-pass-1
**Ticket primarily in scope:** T4 — Wire route-manifest -> CLAUDE.md + README API table generator + drift test
**Cluster:** server-api-and-legacy-frontend
**Mode:** read-only research; the existing drift test is the canonical pattern; T4 extends it for docs (CLAUDE.md + README)

---

## 1. Identity

- Path: `/home/user/st8/tests/core/server/route-manifest-drift.test.js`
- LOC: **154** (4 sub-tests; zero deps beyond `node:test`, `node:assert`, `fs`, `path`)
- Provenance: single commit `e0e5636` "feat(server-api): machine-readable route manifest + drift test (ticket 13)" (verified via `git log -- tests/core/server/route-manifest-drift.test.js`).
- Wave: 5G ticket 13 (API-008). Companion to `/home/user/st8/src/core/server/route-manifest.js` (lines 11-14 of that file declare this test as the authoritative enforcer).
- Status: 4/4 pass; mutation-probed by the Wave 5G reviewer (`docs/_pending-tickets/server-api-and-legacy-frontend.for-review.json` line 233) — adding `{path:'/api/fake-drift', handler:'_handleFakeDrift'}` correctly fails sub-tests 1 and 3.

## 2. Stated intent

From the file's header JSDoc (lines 3-19): "Asserts 1:1 correspondence between the declared manifest at `src/core/server/route-manifest.js` and the actual routes implemented in `src/core/server/app.js`. If a developer adds a route to one but not the other, this test fails loudly."

The contract is bidirectional: **manifest <-> app.js**. Manifest is the declared source of truth; `app.js` is checked against it AND it is checked against `app.js` (`missingFromManifest` + `extraInManifest`, lines 92-93, 118-119). The direction matches CLAUDE.md's "manifest is canon, code is checked" anti-cheat — but is symmetric to prevent stub manifests.

## 3. Test structure (4 sub-tests)

| # | Line | Sub-test | Asserts |
|---|---|---|---|
| 1 | 85-103 | "route-manifest covers every flat case in app.js _handleApiRequest" | Set equality between flat `case '/api/...':` labels in the switch and `ROUTES.filter(r => !r.path.includes(':'))` paths. Two-sided: `missingFromManifest` AND `extraInManifest`. |
| 2 | 105-129 | "route-manifest covers every parameterised route in app.js default branch" | Set equality between regex literals `/^\/api\/...$/` in the switch's default branch and `ROUTES.filter(r => r.path.includes(':'))`, minus `/api/prd-projects/:name` (matched inside `_handlePrdProjects`, not in default branch — see line 116). |
| 3 | 131-141 | "every route in the manifest has a handler method declared on St8Server" | For each `r.handler`, regex `\b<handler>\s*\(` must match somewhere in `app.js` source. Loose existence check, NOT method-on-class — see Gaps below. |
| 4 | 143-153 | "every manifest entry has the required shape" | `method` in `{GET, POST, GET|POST}`, `path` starts with `/api/`, `handler` non-empty string, `auth` in `{none, X-St8-Secret, loopback}`, `description` non-empty string. |

Parsing pipeline:
1. `fs.readFileSync(APP_PATH, 'utf8')` once at module top (line 30).
2. `extractHandleApiRequestBody(src)` (lines 34-51): substring from `'_handleApiRequest(req, res, url) {'` (literal marker) to the brace-balanced closing `}`. This scopes parsing to one method body, avoiding false positives in JSDoc / static-file serving / other handlers.
3. `extractFlatRoutes(body)` (lines 53-59): `/case\s+'(\/api\/[^']+)'\s*:/g`.
4. `extractParamRoutes(body)` (lines 61-83): `/\/\^(.*?)\$\//g`, then canonicalise `\/` -> `/`, `(\d+)` -> `:id`, any other capture -> `:name`, filter to `/api/...`.

## 4. The parsing approach

**Regex over a brace-counted substring.** Not AST, not eval, not requiring `app.js`. This is deliberate:

- `app.js` is 2264 LOC and references SQLite + features modules at top-level `require()`. Requiring it would boot the full St8Server class (CLAUDE.md note: `app.js` is the HTTP layer with side effects). The drift test must remain hermetic — runnable with no DB, no env.
- AST would add a dev dep (`@babel/parser` or `acorn`); the project's stance (`tests/README.md` line 53-63) is "no jest, no transitive deps".
- Regex with a brace-balanced scoping pass is the minimal correct approach for the current switch shape.

Brace counting (lines 40-50): iterate from the opening `{` after the marker, increment on `{`, decrement on `}`, return the slice when depth hits 0. No string/comment awareness (a literal `'}'` inside a string in the body would corrupt the count). In practice the body has none — but this is a sharp edge.

## 5. Prior work

- Wave 5G ticket 13 (this file's birth): manifest + drift test.
- Wave 5G ticket 14 (`for-review.json` line 245-248): documented the dual-form routing convention (flat switch + default-regex) in `app.js` JSDoc above `_handleApiRequest` and in `docs/components/server-api-and-legacy-frontend.md:58-84`. The drift test's bifurcated assertion (sub-test 1 = flat, sub-test 2 = param) operationalises that convention.
- Reviewer verdict (`docs/_pending-tickets/server-api-and-legacy-frontend.review.md:117`): "Ticket 13 (API-008) -> route manifest + drift -> `ack`. Drift test is sound after restoration. 4/4 pass."
- Sibling research already done: `/home/user/st8/docs/_research/2026-05-16-analysis-tools-unblock/README-md.md` covers README.md scope for T4 and recommends a sentinel-region + generator + `tests/docs/api-table-drift.test.js`. The drift test described there is meant to be a sibling to this file, not an extension of it.

## 6. Existing coverage gaps

The drift test compares **paths** and **handler-name existence**, but not all manifest fields are cross-checked against `app.js`:

| Field | Cross-checked vs app.js? | Notes |
|---|---|---|
| `path` | YES (sub-tests 1 + 2) | Set equality both directions. |
| `method` | NO | The switch in `app.js` doesn't carry method info per-case; method dispatch happens inside each handler. There's no canonical place in `app.js` to mine `GET`/`POST` per route — the test would need to walk each handler and find its `req.method` guards. Currently only shape-asserted (sub-test 4). |
| `handler` | YES, but loose (sub-test 3) | Asserts `\b<handler>\s*\(` matches *anywhere* in `app.js` — would match a call site in another method, not necessarily a class method definition. Could mask a typo if the handler name happens to match a function reference. |
| `auth` | NO | Not cross-checked. A manifest entry with `auth: 'none'` but an actual `_authorize()` call in the handler would not be flagged. Audit risk for the X-St8-Secret class. |
| `description` | NO (only shape — non-empty) | No semantic check; description can be stale relative to the handler's actual behavior. |

**Multi-fingerprint coexistence with parameterised paths**: sub-test 2 hard-codes the exclusion of `/api/prd-projects/:name` (line 116). If a future per-resource route is matched inside its own collection handler rather than the default branch, the exclusion list grows; there is no general mechanism for "matched-elsewhere" routes.

## 7. Contracts

### Symmetry direction
**Both directions.** Sub-tests 1 and 2 compute both `missingFromManifest` (path in app.js, not in manifest) and `extraInManifest` (path in manifest, not in app.js). Failure on either set fails the test. This is NOT `manifest ⊇ app-routes`; it is **strict equality**, with one carved-out exception.

### Strict equality vs symmetric difference
`assert.deepStrictEqual(missingFromManifest, [], '...')` and `assert.deepStrictEqual(extraInManifest, [], '...')` — sets are arrays compared deep-equal to `[]`. Either non-empty fails the test with a specific message naming the offending paths.

### Per-resource path treatment (e.g. `/api/tickets/:id/claim`)
Asserted in sub-test 2 (param routes). The regex literal in `app.js` default branch — e.g. `/^\/api\/tickets\/(\d+)\/claim$/` — is canonicalised by `extractParamRoutes` to `/api/tickets/:id/claim` and compared against the manifest's `:id`-shaped path. The carve-out at line 116 covers the one case (`/api/prd-projects/:name`) that doesn't go through the default branch.

### Failure ergonomics
Each `assert.deepStrictEqual` carries an explicit message string interpolating the offending paths, e.g. line 97: `route-manifest.js is missing flat routes that exist in app.js: ${missingFromManifest.join(', ')}`. Sub-test 3 lists missing handlers; sub-test 4 names the bad field per-entry. Failure output is human-readable without needing to grep the diff.

## 8. Change vector for T4 — analogous docs drift test

T4's goal is to wire route-manifest -> CLAUDE.md + README API tables with a generator + drift test. The sibling research file `README-md.md` (§8 lines 105-127) already sketches the shape. The drift-test piece, viewed from this file as the pattern:

### Recommended placement
**New file**, not extension of this one. Rationale:
- This file's subject is "manifest vs implementation". The new test's subject is "manifest vs documentation". Different anti-cheat axis.
- This file requires `route-manifest` + reads `app.js`. The new test requires `route-manifest` + reads `CLAUDE.md` + `README.md`. Different inputs.
- `tests/` mirrors `src/`; CLAUDE.md and README.md are root-level docs. Convention: `tests/docs/api-table-drift.test.js` (the sibling research recommends this path; `tests/docs/` is a new directory but consistent with `tests/_helpers/`, `tests/_fixtures/`).

### Test sketch (preserving this file's idioms)

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROUTES } = require('../../src/core/server/route-manifest');
const { renderApiTable } = require('../../docs/generate-api-table'); // T4's generator

const REPO_ROOT = path.resolve(__dirname, '../..');
const BEGIN = '<!-- BEGIN: route-manifest-table -->';
const END = '<!-- END: route-manifest-table -->';

function extractRegion(src, file) {
  const start = src.indexOf(BEGIN);
  const end = src.indexOf(END);
  if (start === -1 || end === -1) {
    throw new Error(`drift test: sentinels missing in ${file}`);
  }
  return src.slice(start + BEGIN.length, end).trim();
}

for (const docFile of ['CLAUDE.md', 'README.md']) {
  test(`${docFile} API table is in sync with route-manifest`, () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, docFile), 'utf8');
    const region = extractRegion(src, docFile);
    const expected = renderApiTable(ROUTES).trim();
    assert.strictEqual(region, expected,
      `${docFile} API table region is stale. Run \`node docs/generate-api-table.js\` to regenerate.`);
  });
}
```

This preserves:
- `node:test` + `node:assert` + `fs` + `path` only (no new deps; matches `tests/README.md` line 53-63 stance).
- "Manifest is canon, doc is checked" direction (mirrors this file's anti-cheat).
- Sentinel-bounded substring (mirrors this file's `extractHandleApiRequestBody` brace-counted scoping — same idea, different delimiter).
- Clear failure message with remediation pointer.

### Sentinel comments
HTML comments survive both CLAUDE.md and README.md rendering (and the slightly stricter Github flavor used in this repo's docs). Recommended pair:

```
<!-- BEGIN: route-manifest-table -->
<!-- Auto-generated from src/core/server/route-manifest.js by docs/generate-api-table.js. Do not edit by hand. -->
| Route | Method | Auth | Description |
|---|---|---|---|
| /api/connection-state.json | GET | none | ... |
...
<!-- END: route-manifest-table -->
```

The second comment (the "do not edit" warning) is informational and not parsed by the test.

### Row shape decision
Manifest provides `{method, path, handler, auth, description}`. CLAUDE.md's current table (lines 104-116) uses `Route | Method | Purpose | Auth`. Recommended emit: `Route | Method | Auth | Description` (matches `README-md.md` research §8 line 124, drops `handler` because docs readers don't need internal method names — handlers are already cross-checked by sub-test 3 of this file).

`method: 'GET|POST'` -> render as `GET / POST` (matches CLAUDE.md current style at lines 109, 113). Confirmed by `README-md.md` §10 question 4.

## 9. Provisions already made

- `src/core/server/route-manifest.js` is `Object.freeze`d (line 53), so the generator can `require()` it safely without state risk.
- Manifest fields are stable: shape sub-test (4) guarantees `method`, `path`, `handler`, `auth`, `description` for every entry.
- This file's two-direction equality already enforces manifest <-> app.js. The new docs drift test can fully trust the manifest as a faithful proxy for implementation.
- Precedent for repo-managed generator artifacts exists: `docs/generate-filemap.js` (referenced in CLAUDE.md line 63) is the model for `docs/generate-api-table.js`.
- The bifurcation flat/param is already canonicalised in `extractParamRoutes` (lines 61-83); the same canonicalisation logic can be reused inside the generator (e.g. extract `:id`/`:name` rows specifically) if T4 needs to distinguish them in the rendered table — but the simpler design is to emit `r.path` verbatim from the manifest since manifest entries are already in canonical form.

**The parser in this file is NOT directly reusable** for the docs drift test — it parses JS source, not markdown. The reusable concept is the **brace-counted scoping pattern**, applied as `BEGIN`/`END` sentinel scoping for markdown.

## 10. Gaps + open questions

1. **String-aware brace counting (existing test):** The brace counter at lines 40-50 doesn't skip string/comment contexts. A literal `'}'` inside a string in `_handleApiRequest` would break it. Currently safe by inspection; add a regression test or upgrade to a lightweight tokenizer when `app.js` grows.
2. **Handler existence check is too loose (existing test, sub-test 3):** `\b<handler>\s*\(` matches any call site, not class-method definition. Could be tightened to `^\s+<handler>\s*\(` (method declarations are indented). Not in T4 scope, but worth flagging for a sub-wave.
3. **Method + auth not enforced against app.js (existing test):** Sub-test 4 only shape-asserts. Real cross-check would walk each handler and parse its `req.method`/`_authorize()` guards. Significant scope; defer to a separate ticket.
4. **Where does the new test live?** Convention says `tests/` mirrors `src/`, but CLAUDE.md and README.md are root. Sibling research recommends `tests/docs/api-table-drift.test.js`. Confirm new top-level `tests/docs/` directory is acceptable (the `tests/_helpers/`, `tests/_fixtures/` precedent suggests yes).
5. **Should the new test live in this file as a 5th sub-test?** Recommend no (see §8). Conceptual axis differs; failure dx and module-load surface stay cleaner separated.
6. **Generator location:** `docs/generate-api-table.js` vs `scripts/generate-api-table.js`? CLAUDE.md only references the `docs/` pattern. Pick `docs/`.
7. **What if T4 lands first and CLAUDE.md sentinel region currently does not exist?** T4 must seed it: replace lines 102-116 of CLAUDE.md with the sentinel-bounded auto-generated block. README.md lines 188-198 same treatment (with the four static rows relocated above the sentinel per `README-md.md` §8.5).
8. **Should the new test also fail if the BEGIN/END sentinels are absent?** Yes — `extractRegion` throws if either is missing. This prevents a developer from "fixing" a drift failure by deleting the sentinels.
