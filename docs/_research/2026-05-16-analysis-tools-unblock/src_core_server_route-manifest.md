# Research: `src/core/server/route-manifest.js`

Wave: `analysis-tools-unblock-pass-1`
Cluster: `server-api-and-legacy-frontend`
Mode: read-only research; no source edits, no commits.
File under study: `/home/user/st8/src/core/server/route-manifest.js` (180 LOC).

---

## 1. Identity

- **Path:** `/home/user/st8/src/core/server/route-manifest.js`
- **Size:** 180 LOC (33 frozen route entries + header JSDoc).
- **Created:** single commit `e0e5636 feat(server-api): machine-readable route manifest + drift test (ticket 13)`
  (`git log --oneline -- src/core/server/route-manifest.js`).
- **Ticket lineage:** Wave 5G, ticket 13, ID `API-008`
  (`/home/user/st8/docs/_pending-tickets/server-api-and-legacy-frontend.for-review.json:221`).
- **Module shape:** `'use strict';` CommonJS exporting a single
  `Object.freeze`'d array under the name `ROUTES`
  (`route-manifest.js:53`, `route-manifest.js:178-180`).
- **Sole consumer in tree:** `tests/core/server/route-manifest-drift.test.js:27`
  (`const { ROUTES } = require('../../../src/core/server/route-manifest')`).
  No runtime consumer in `src/` today — the manifest is **doc + test**
  glue, not router glue (`app.js` still routes by hand-written
  `switch`).

---

## 2. Stated intent (full quote of the header purpose comment)

The 1-51 header block is the canonical statement of intent. Verbatim from
`src/core/server/route-manifest.js:1-51`:

```
'use strict';

/**
 * route-manifest.js — Machine-readable description of the st8 HTTP API.
 *
 * Wave 5G ticket 13 (API-008). The router in `app.js` is a flat `switch`
 * plus a `default` branch with regex matchers for parameterised paths.
 * That switch is the implementation; this file is the **declared
 * contract** consumed by:
 *
 *   - Documentation (cluster docs in `docs/components/`)
 *   - The drift test `tests/core/server/route-manifest-drift.test.js`,
 *     which enforces 1:1 between this manifest and the actual routes in
 *     `app.js`. If you add a route in `app.js`, you MUST add it here.
 *   - Future consumers (Sonic, LLM collaborators) that need to
 *     introspect the API surface without reading source.
 *
 * Routing convention (also documented in
 * `docs/components/server-api-and-legacy-frontend.md` and in the JSDoc
 * above `_handleApiRequest` in `app.js`):
 *
 *   - **Collection / verb routes** use a flat path matched directly by
 *     the switch. Examples: `POST /api/tickets`, `POST /api/index`,
 *     `GET /api/tickets/count`. These act on the collection itself or
 *     are pure-verb actions (no resource identifier in the URL).
 *   - **Per-resource routes** carry a path parameter (`:id` or `:name`)
 *     and are matched by regex in the `default` branch of the switch.
 *     Examples: `GET /api/prd-projects/<name>`,
 *     `POST /api/tickets/:id/claim`, `POST /api/tickets/:id/resolve`.
 *
 * The two forms coexist intentionally — no router framework is needed
 * for the current route count (~26). When the count crosses ~30 or a
 * fourth resource gains `:id` verbs, switch to the table-driven approach
 * described in this cluster's roadmap (P2.5).
 *
 * Entry shape:
 *
 *   {
 *     method: 'GET' | 'POST' | 'GET|POST',
 *     path: string,           // exact for flat routes; ':id' / ':name'
 *                             // for parameterised routes (matches the
 *                             // regex in app.js's default branch)
 *     handler: string,        // method name on St8Server
 *     auth: 'none' | 'X-St8-Secret' | 'loopback',
 *     description: string
 *   }
 *
 * To regenerate after a route change: edit this file by hand (it is the
 * source of truth; not auto-generated). The drift test will fail if your
 * edit doesn't match app.js or vice versa.
 */
```

Key load-bearing claims in the quote:
- "this file is the **declared contract**" (`route-manifest.js:9`).
- "If you add a route in `app.js`, you MUST add it here." (`:14`).
- "no router framework is needed for the current route count (~26)" (`:32`) — note
  the header says ~26 but the array actually holds 33 entries (see §4 — the
  comment is mildly stale).
- "When the count crosses ~30 or a fourth resource gains `:id` verbs, switch to
  the table-driven approach described in this cluster's roadmap (P2.5)." (`:32-34`).
  That trigger is **already crossed** at 33 entries; P2.5 is therefore live.
- "it is the source of truth; not auto-generated" (`:48-49`). Crucial for T4 below.

---

## 3. Public surface (the manifest array + exports + entry shape)

### Module exports
- `module.exports = { ROUTES };` (`route-manifest.js:178-180`).
- Single named export. No factory, no default, no schema validator function.
- Array is `Object.freeze`d at construction time (`:53`). Entries themselves are
  plain objects (not deep-frozen) — mutation of an entry would not throw, but
  no consumer mutates so the practical contract is immutable.

### Entry shape (canonical, restated from `:36-46`)
```
{
  method: 'GET' | 'POST' | 'GET|POST',
  path: string,                       // '/api/foo' or '/api/foo/:id'
  handler: string,                    // St8Server method name, e.g. '_handleTickets'
  auth: 'none' | 'X-St8-Secret' | 'loopback',
  description: string                 // free-form prose (1-3 sentences typical)
}
```

Allowed-value enforcement is at the test layer
(`tests/core/server/route-manifest-drift.test.js:144-152`), not in the manifest
itself. The shape test holds the closed sets:
```
const allowedAuth = new Set(['none', 'X-St8-Secret', 'loopback']);
const allowedMethod = new Set(['GET', 'POST', 'GET|POST']);
```

### Layout convention
Entries are grouped by section header comment, in this order
(per `route-manifest.js:54-175`):

1. `// --- Read-only manifest / health (no auth) ---`        — 3 entries
2. `// --- Indexer / file lifecycle ---`                     — 4
3. `// --- Mutations / SSE ---`                              — 1
4. `// --- Phase / lifecycle transitions ---`                — 3
5. `// --- PRD / analysis ---`                               — 4
6. `// --- Lifecycle (Bruno / Oscar) ---`                    — 2
7. `// --- AI review ---`                                    — 2
8. `// --- Templates / settings ---`                         — 2
9. `// --- Commit / tickets (write surface — X-St8-Secret) -` — 5
10. `// --- Auth + LLM dispatch ---`                          — 2
11. `// --- Signal-path / reports / insights / identity ---`  — 4
12. `// --- Deferred / placeholder routes ---`                — 1

These section dividers are pure documentation — neither `app.js` nor the
drift test references them.

---

## 4. Current route count + the 1:1 contract with app.js

### Count

- 33 entries total in `ROUTES` (`route-manifest.js:53-176`).
  - **30 flat routes** (path has no `:`).
  - **3 parameterised routes** with `:id` / `:name`:
    - `/api/prd-projects/:name` (`:105`)
    - `/api/tickets/:id/claim` (`:143`)
    - `/api/tickets/:id/resolve` (`:146`)
- `app.js` has **30 `case '/api/…':` labels** inside `_handleApiRequest`
  (per the Wave 5G reviewer's cross-check at `review.md:119-122`).
  Delta of 3 == the three parameterised routes — they are NOT in the
  switch; they are handled by regex matchers in the `default` branch
  (claim + resolve) or inside `_handlePrdProjects` itself (the `:name`
  variant, which is excluded from the drift test's regex sweep —
  `route-manifest-drift.test.js:113-116`).

### Drift-test exclusion

`/api/prd-projects/:name` is the **one exception** to the
"default-branch regex == manifest parameterised entry" rule. The drift
test removes it from the manifest side before comparing
(`route-manifest-drift.test.js:115-116`) because that route is matched
inside `_handlePrdProjects` rather than in the default branch's regex
chain. T5's new parameterised route will follow the default-branch
pattern (the same as `:id/claim` and `:id/resolve`), so this exclusion
does **not** apply to T5.

### The 1:1 contract

Codified in `tests/core/server/route-manifest-drift.test.js` (see §6).
The contract has four assertions:

1. Every flat case label in `app.js` `_handleApiRequest` switch is in the manifest.
2. Every flat path in the manifest is a switch case in `app.js`.
3. Every default-branch regex matcher (`/^\/api\/.../$/`) in `_handleApiRequest`
   has a `:id`/`:name` manifest entry (and vice versa, modulo the
   `prd-projects/:name` carve-out).
4. Every `handler` string resolves to a method present on `St8Server`
   (regex match on `\\b<handler>\\s*\\(` against `app.js` source).

Add a route to `app.js` without updating the manifest → tests 1 or 3 fail.
Add a manifest entry without the route → tests 2 or 4 fail. The reviewer
ran a mutation probe in 5G and confirmed both directions break the build
(`review.md:122-128`).

---

## 5. Prior work (Wave 5G ticket 13 / API-008 and any extensions)

### Origin (Wave 5G, ticket 13 / API-008)

- Built in single commit `e0e5636` (`git log -- src/core/server/route-manifest.js`).
- Executor narrative
  (`docs/_pending-tickets/server-api-and-legacy-frontend.for-review.json:230`):
  - 33 entries (30 flat + 3 parameterised).
  - Entry shape `{method, path, handler, auth, description}`.
  - Auth tri-value: `'none'` / `'X-St8-Secret'` / `'loopback'`.
  - Drift test parses `app.js` by reading source + brace-counting to the
    `_handleApiRequest` body (no AST dep).
  - Test count moved 355 → 359 (+4 sub-tests).
- Reviewer ACKed with a mutation probe
  (`review.md:117-128`): inserted a fake entry, watched tests 1 and 3
  fail, restored. Verdict: "Drift test is load-bearing, not theatre."

### Companion work in the same wave

- **Ticket 14 (API-009)** — codified the **routing convention** (flat vs
  `:id` regex) as intentional. Added JSDoc above `_handleApiRequest`
  (`app.js:382-398`) and a "Routing convention" subsection to the cluster
  component doc (`docs/components/server-api-and-legacy-frontend.md:58-84`).
  The manifest's header quotes this convention; the convention's authoring
  doc and the manifest cross-reference each other.

### Cross-references currently in the tree

- `app.js:396-397` JSDoc points at the manifest.
- `docs/components/server-api-and-legacy-frontend.md:81-84` names the
  manifest + drift test as the machine-readable contract.
- `scripts/migration/results.gap-analysis.md:81` lists `route-manifest.js`
  among migration outputs.
- The two analysis-tools-unblock research notes already reference specific
  manifest line numbers — `src_features_analysis_report-generator.md:42`
  and `src_features_graph_traversal.md:229`.

### Extensions since 5G

None at HEAD. The file has had exactly **one commit**
(`git log --oneline -- src/core/server/route-manifest.js` → 1 line).
Roadmap P2.5 (table-driven routing) is the documented evolution path
but is unscoped at this wave.

---

## 6. Existing tests (the drift test — what it asserts, lines)

File: `/home/user/st8/tests/core/server/route-manifest-drift.test.js` (154 LOC).

### Setup
- `APP_PATH` = `src/core/server/app.js` (`:26`).
- Imports `ROUTES` from the manifest (`:27`).
- `appSrc = fs.readFileSync(APP_PATH, 'utf8')` once (`:30`).
- `extractHandleApiRequestBody(src)` (`:34-51`) — finds
  `_handleApiRequest(req, res, url) {`, brace-counts to the matching `}`,
  returns the body slice. Throws if not found or unterminated. No AST.
- `extractFlatRoutes(body)` (`:53-59`) — regex `/case\s+'(\/api\/[^']+)'\s*:/g`,
  returns a `Set` of literal switch cases.
- `extractParamRoutes(body)` (`:61-83`) — regex `/\/\^(.*?)\$\//g`, then
  `\/` → `/`, `(\d+)` → `:id`, any other capture group → `:name`. Filters to
  `/api/...` prefix.

### Assertions (four `test(...)` calls)

1. **`route-manifest covers every flat case in app.js _handleApiRequest`**
   (`:85-103`). Symmetric `assert.deepStrictEqual(..., [])` for both
   `missingFromManifest` and `extraInManifest`. Closes the
   "add-but-not-declare" and "declare-but-not-add" loopholes.

2. **`route-manifest covers every parameterised route in app.js default branch`**
   (`:105-129`). Same symmetric assertions, with one carve-out at
   `:113-116`:
   `paramInManifest.delete('/api/prd-projects/:name');`
   because that route is matched inside `_handlePrdProjects` rather than
   the default-branch regex chain.

3. **`every route in the manifest has a handler method declared on St8Server`**
   (`:131-141`). For each handler name, regex
   `\\b<handler>\\s*\\(` against `appSrc`. Catches typos and stale
   manifests referencing renamed/removed methods.

4. **`every manifest entry has the required shape`** (`:143-153`). Iterates
   `ROUTES`, asserts method ∈ `{'GET','POST','GET|POST'}`, path is a
   string starting `/api/`, handler is a non-empty string, auth ∈
   `{'none','X-St8-Secret','loopback'}`, description is a non-empty string.
   This is where T4's generator-extension assertions can live (see §8 T4).

### Test independence
- Does not boot a server (`route-manifest-drift.test.js:18`).
- No filesystem writes; reads only `app.js` and the manifest module.
- Order-independent.

---

## 7. Contracts

### 7.1 Entry shape
Five required fields, fully closed sets for `method` and `auth`, no
optional fields today (every entry in `ROUTES` has all five — verified by
test 4). Adding a field is non-breaking as long as test 4 keeps allowing
it; removing/renaming a field breaks every consumer.

### 7.2 Parameterised path encoding
- `:id` ← matched in `app.js` by `(\d+)` (numeric id capture).
  Example pair: regex `/^\/api\/tickets\/(\d+)\/claim$/` ↔ manifest
  `/api/tickets/:id/claim`. The mapping is performed in the test at
  `route-manifest-drift.test.js:77`.
- `:name` ← matched in `app.js` by any non-numeric capture group.
  Mapping at `route-manifest-drift.test.js:79`
  (`pattern.replace(/\([^)]+\)/g, ':name')` AFTER the `:id` substitution).
- No multi-param paths exist today, but the test's regex would label every
  capture group after the first `(\d+)` as `:name` — there is no convention
  for `:name1` / `:name2` or for `:id` + `:name` combinations. Document
  this if a future ticket adds nested resource paths.

### 7.3 Source-of-truth role (hand-edited, not auto-generated)
Explicit in the header (`route-manifest.js:48-50`):
> "To regenerate after a route change: edit this file by hand (it is the
> source of truth; not auto-generated). The drift test will fail if your
> edit doesn't match app.js or vice versa."

This is the constraint that makes T4's generator viable in one direction
only: `ROUTES` → doc tables, **never** doc tables → `ROUTES` and never
`app.js` → `ROUTES`. The human edits the manifest; tooling reads it.

### 7.4 Drift-test enforcement (1:1 with app.js's switch)
- Flat: bidirectional set equality (test 1).
- Parameterised: bidirectional set equality with `prd-projects/:name`
  carve-out (test 2).
- Handler resolution: existence-only (test 3) — does not assert handler
  arity or signature.
- Shape closure: test 4 enforces the allowed sets above.

The carve-out for `prd-projects/:name` is the only sharp edge — anyone
adding a parameterised route should follow the **default-branch regex**
pattern (`tickets/:id/...`) so they don't need a new carve-out.

---

## 8. Change vector

### T1 — `POST /api/analyze-relationships`

One new entry. Sketch (anchor: alongside the "Signal-path / reports /
insights / identity" group at `route-manifest.js:158-170`, since the
sibling research at
`docs/_research/2026-05-16-analysis-tools-unblock/src_features_analysis_relationship-analyzer.md:100`
puts this in the same analysis-output cluster):

```js
{ method: 'POST', path: '/api/analyze-relationships', handler: '_handleAnalyzeRelationships',
  auth: 'none',
  description: 'Run RelationshipAnalyzer over schema cards; returns JSON page-coverage. Mirror of /api/signal-path. 4KB body cap on POST.' },
```

- `method`: matches sibling `/api/signal-path` POST → 4KB body cap.
- `auth`: `'none'` matches the rest of the analysis-output group
  (signal-path, generate-report, insights, identity-risk).
- `handler`: must literally exist as `_handleAnalyzeRelationships(...)`
  on `St8Server`, or drift test 3 fails.
- After adding, the switch case `case '/api/analyze-relationships':` must
  exist in `app.js` `_handleApiRequest`, or drift test 1 fails.

### T2 — `GET /api/graph/deps` + `GET /api/graph/impacts`

Two new entries. Both are flat (no `:id`); they take `?nodeId=<fp>` as
query string per `docs/_research/.../src_features_graph_traversal.md:191`.

Sketch (anchor: new section `// --- Graph traversal ---` after AI review,
or appended to "Signal-path / reports / insights / identity"):

```js
{ method: 'GET',  path: '/api/graph/deps', handler: '_handleGraphDeps',
  auth: 'none',
  description: 'Return outbound dependency fan-out for ?nodeId=<fingerprint>. Backed by features/graph/traversal.' },
{ method: 'GET',  path: '/api/graph/impacts', handler: '_handleGraphImpacts',
  auth: 'none',
  description: 'Return impact chain (transitive consumers) for ?nodeId=<fingerprint>. Backed by features/graph/traversal.computeImpactChain.' },
```

Notes:
- Both routes are **flat** — `nodeId` rides in the query string, not the path.
  This keeps them in the switch, not the default-branch regex pool. Drift
  test 1 will enforce 1:1 directly. No exclusion logic needed.
- `auth: 'none'` matches sibling read-only paths.
- Handler-naming follows the convention `_handle<RouteCamel>` —
  `_handleGraphDeps` / `_handleGraphImpacts`.

### T5 — `GET /api/file-identity/:fingerprint`

One new parameterised entry. **Confirmation of the encoding convention:**
`:fingerprint` is **not** the `:id` (numeric) or `:name` (any-string)
shape currently encoded by the drift test
(`route-manifest-drift.test.js:77-79`). Two choices:

(a) **Reuse `:id` convention.** The drift test maps `(\d+)` → `:id`.
    Fingerprints in st8 are SHA-256-derived hex strings (per `shared/types`
    `generateFingerprint`), not numeric. Using `:id` would lie about the
    capture pattern — `app.js`'s regex would need `([0-9a-f]+)` or
    similar, which the test currently lumps under `:name` (since it's not
    `(\d+)`).

(b) **Reuse `:name` convention.** The drift test maps any non-`\d+` capture
    group → `:name`. So `app.js` regex `/^\/api\/file-identity\/([0-9a-f]+)$/`
    would be normalised to `/api/file-identity/:name` by
    `extractParamRoutes` — and the **manifest must use `:name`** to match.

The drift-test encoding is the binding constraint. The manifest entry
must read `:name`, not `:fingerprint`, until the test learns a third
keyword. Sketch (compromise — declare manifest with `:name` to match
the test, document the semantic in the description):

```js
{ method: 'GET',  path: '/api/file-identity/:name', handler: '_handleFileIdentity',
  auth: 'none',
  description: 'Fetch file identity record by fingerprint hex. Per-resource regex match in default branch — :name is the SHA-256 fingerprint.' },
```

If the executor prefers `:fingerprint` for readability, the drift test
must be extended first (add `:fingerprint` to the regex normaliser at
`route-manifest-drift.test.js:77-79`) — that is a separate change with
test churn. **Recommended path:** keep `:name` to honor the existing
contract; explain "fingerprint" in `description`.

The `app.js` side must put the matcher in the **default branch** (alongside
`tickets/:id/claim` etc.), not inside another handler — otherwise the
drift test will require a new carve-out like `prd-projects/:name`.

### T4 — Wire route-manifest → CLAUDE.md + README API table generator

This file becomes the source for the generator. **No source edits in this
pass.** Documentation-only research.

#### Current API table SHAPE in the docs

- **CLAUDE.md** has an "API surface (post-Wave-3B + 3C)" table at lines
  102-118 (per the file's quoted excerpt in §init context). Columns:
  `| Route | Method | Purpose | Auth |`. The table is **stale** — it
  lists only 11 routes (`/api/state`, `/api/manifests`, `/api/events`,
  `/api/tickets`, `/api/tickets/count`, `/api/record-commit`,
  `/api/auth-token`, `/api/signal-path`, `/api/generate-report`,
  `/api/insights`, `/api/identity-risk`). The first three (`/api/state`,
  `/api/manifests`, `/api/events`) don't even exist in the manifest;
  they look like names that were renamed before 5G locked the manifest.
  Generator will need to **replace** this section, not merge.

- **README.md** has an "API Endpoints" table at lines 188-198. Columns:
  `| Endpoint | Method | Description |`. Lists only 3 API routes
  (`/api/connection-state.json`, `/api/ai-signal.toml`, `/api/health`)
  plus static file routes (`/`, `/*.js`, `/*.css`, `/*.ttf`). Also
  stale.

Both tables are doc-drift hotspots that ticket 13 left untouched.

#### Proposed generator approach (documentation only — no edits in this pass)

(a) **Regex-bounded sentinel comments in the docs.** Place HTML comment
fences in both files:

```
<!-- BEGIN ROUTE-MANIFEST (auto-generated; edit src/core/server/route-manifest.js) -->
| Route | Method | Auth | Purpose |
|---|---|---|---|
... rows ...
<!-- END ROUTE-MANIFEST -->
```

The generator script:
1. `require('../src/core/server/route-manifest')` to read `ROUTES`.
2. Emits the table body (one row per entry, ordered by manifest order so
   section grouping is preserved — or grouped by `auth` for the CLAUDE.md
   "API surface" framing).
3. For each target doc (`CLAUDE.md`, `README.md`), reads file, regex-
   replaces the bounded region with `BEGIN…END`-wrapped freshly-rendered
   table, writes back.
4. Idempotent: running with no changes is a no-op.

CLAUDE.md row format (keeps existing 4-column shape):
`| `/api/<path>` | <method> | <description> | <auth> |`

README.md row format (keeps existing 3-column shape):
`| `/api/<path>` | <method> | <description> |`
(README is a public/external surface; auth detail may be too much. Open
question — see §10.)

(b) **Drift test extends to assert the bounded region matches generator output.**
Add a fifth `test(...)` to `route-manifest-drift.test.js`:

```
test('CLAUDE.md and README.md API tables are in sync with route-manifest', () => {
  const expected = renderTable(ROUTES);          // pure function
  for (const docPath of ['CLAUDE.md','README.md']) {
    const src = fs.readFileSync(docPath, 'utf8');
    const region = src.match(/<!-- BEGIN ROUTE-MANIFEST.*?-->\n([\s\S]*?)<!-- END ROUTE-MANIFEST -->/);
    assert.ok(region, `${docPath} missing ROUTE-MANIFEST fence`);
    assert.strictEqual(region[1].trim(), expected.trim(), `${docPath} table drift`);
  }
});
```

This keeps the file's "source of truth" claim honest (§7.3) and matches
the existing drift-test ethos (load-bearing, mutation-probed,
non-AST-dependent). The `renderTable` function should live in the same
script that performs the rewrite, exported for the test to import — this
avoids duplicating row-formatting logic.

(c) **Generator location.** Most natural home is
`docs/generate-filemap.js` (already an established docs-generator
pattern per CLAUDE.md "Authoritative file inventory") or a sibling
`docs/generate-api-table.js`. Wire to an npm script (`npm run
gen:api-table`) so `package.json` is one-shot discoverable. **Not a
runtime hook** — this is build-time/dev-time. See §10 for open Q.

#### Non-goals for T4 in this wave

- Do NOT alter the entry shape (no schema migration to
  `{ method, path, handler, auth, description, sourceLine, ... }` —
  that's a future enhancement; the drift test would have to learn the
  new field).
- Do NOT generate OpenAPI in this pass (roadmap P2.3 is the OpenAPI
  story; T4 is the documentation slice only).

---

## 9. Provisions already made (extension points)

- **`description` field already exists** for every entry
  (`route-manifest.js:53-176`) — it is **already** doc-ready prose, 1-3
  sentences, mentioning body-cap sizes where relevant. The T4 generator
  can render this directly; no enrichment needed.
- **Auth tri-value** (`'none' | 'X-St8-Secret' | 'loopback'`) is already
  policy-ready for the CLAUDE.md table (which has an Auth column).
- **`Object.freeze`** on the array (`:53`) prevents accidental in-process
  mutation when consumers iterate (test 4 walks `ROUTES`, future
  generator will too).
- **Section comments** (`// --- ... ---`) provide a natural grouping
  axis if the generator wants to render sub-headings rather than one
  flat table.
- **Routing convention JSDoc cross-reference loop** is already coherent:
  `route-manifest.js:18-34` ↔ `app.js:382-398` ↔
  `docs/components/server-api-and-legacy-frontend.md:58-84` ↔
  `docs/_pending-roadmap/server-api-and-legacy-frontend.md` P2.5. The
  generator can lean on this — it doesn't have to invent terminology.
- **Test 4** (`route-manifest-drift.test.js:143-153`) is the natural
  extension point for new field-shape assertions when the manifest
  gains fields (e.g. `bodyCapBytes`, `since`, `deprecated`).

---

## 10. Gaps + open questions

### Gaps

1. **Header line `~26` is stale.** `route-manifest.js:32` says "the
   current route count (~26)"; the array holds 33. The trigger condition
   ("when the count crosses ~30") has already fired. Either bump the
   comment or treat P2.5 (table-driven routing) as live. Not a blocker
   for T1/T2/T5 but should be noted in any header edit.

2. **No `since` / `wave` field per entry.** Tracing a route back to its
   originating wave currently requires `git log -L` or grepping the
   for-review JSONs. T4 could add a `since: 'Wave 5G'` field, but that
   requires test 4 to accept it. Not in scope this pass.

3. **No `bodyCapBytes` field.** The cap is described in prose inside
   `description`. Mining caps for the docs table currently requires
   regex over the description string. Adding `bodyCapBytes: 1024` would
   be cleaner but is a schema change.

4. **README.md API table** lists three static file routes (`/`, `/*.js`,
   `/*.css`, `/*.ttf`) that aren't `/api/*` routes at all. The manifest
   only covers `/api/*` (test 4 asserts `path.startsWith('/api/')`).
   The generator must decide: rewrite the full README table (and drop
   the static routes) or scope the fenced region to API rows only?
   **Recommended:** scope fence to API rows only — leave static routes
   above/below the fence as today.

5. **`/api/prd-projects/:name` carve-out** is currently hard-coded in
   the drift test (`route-manifest-drift.test.js:113-116`). If a second
   "handled-inside-its-own-method" parameterised route appears, the
   carve-out becomes a list and the comment must be updated.

### Open questions

1. **Generator: npm script or hook?**
   - **Recommendation:** npm script (`npm run gen:api-table`), like
     `docs/generate-filemap.js`. Hooks (pre-commit, `husky`) are easy
     to bypass and add a dep. The drift test catches the drift at CI
     time regardless of when the script ran. Hook is bonus convenience,
     not the contract.

2. **When does drift get caught — pre-commit, CI, or runtime?**
   - **CI** via `npm test` (existing path). Pre-commit is a friendly
     local fast-fail. Runtime catch is not appropriate — this is a
     static doc contract, not a server behaviour. Match the existing
     drift-test cadence: it runs in the standard `node --test` suite
     and so already executes in CI.

3. **README table: should it carry the Auth column?** README is public
   docs. Auth-method exposure isn't a secret (the server's bind address
   `127.0.0.1` keeps auth from being security-load-bearing) but it
   adds width. Open for the executor; the generator can flag-gate
   per-doc column subset.

4. **Should the generator preserve manifest section ordering, or
   re-sort?** Manifest groups by purpose; alphabetical or
   group-by-auth might be more useful for the table consumer. No
   strong existing precedent — current CLAUDE.md table groups by what
   looks like a mix of "Wave 3B/3C order" and "auth ascending."
   **Recommendation:** preserve manifest order (section comments map
   to natural `## Sub-heading` rows in the doc).

5. **T5 `:fingerprint` vs `:name` naming.** Per §8 T5, the drift test
   only recognises `:id` and `:name` today. Picking `:name` is the
   cheap path; renaming requires a test extension. Confirm with the
   executor which path to take before T5 work starts.

6. **Does T4 also touch the cluster doc** at
   `docs/components/server-api-and-legacy-frontend.md` (which has its
   own route table at lines 29-54)? If yes, the generator should add a
   third bounded region there. If no, that table becomes a third
   drift surface to maintain by hand. **Recommendation:** include it
   in the generator — three docs, three fenced regions, one
   `renderTable(ROUTES)` source.

---

End of research.
