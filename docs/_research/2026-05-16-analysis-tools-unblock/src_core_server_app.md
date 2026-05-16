# Research Report — `src/core/server/app.js`

**Cluster:** server-api-and-legacy-frontend
**Wave:** analysis-tools-unblock-pass-1
**Tickets in scope:** T1 (relationship-analyzer wire), T2 (graph/traversal lazy wire), T5 (`/api/file-identity/<fingerprint>`), T6 (audit `/api/generate-report`)
**Date:** 2026-05-16
**Mode:** read-only research

---

## 1. Identity

- **Path:** `/home/user/st8/src/core/server/app.js`
- **LOC:** 2654 (`wc -l`).
- **HEAD touching the file (last 20):** `7f156be feat(server-api): manifest cache + INDEX_COMPLETE invalidation (ticket 2)` (Wave 5G ticket 2). Prior recent commits: `4fa9d0d` (ticket 14 convention JSDoc), `f5da7da` (ticket 11 path.relative annotation), `9bfb3f9` (ticket 1 `/api/tickets/:id/{claim,resolve}`), `63bcfcf` (ticket 10 body-cap matrix), `baa813c` (ticket 12 `parseRequestBody`), `cdfae98` (ticket 1 `/api/llm-call`), `4983772` (ticket 8 settings validation), `2be309f` (Wave 3B `/api/signal-path` + `/api/generate-report`), `3945847` / `fa3ffb2` (record-commit auth + validation), `a68142a` (shared persistence), `7b745bb` (LIFECYCLE + PRD_GENERATE publishers).
- Test count baseline: 373 pass / 0 fail (per the 5I cluster close).
- Exports: `St8Server`, `validateRecordCommitPayload`, `ALLOWED_SETTINGS_CATEGORIES`, `parseRequestBody` (`src/core/server/app.js:2642-2654`).

---

## 2. Stated intent

- **File-level JSDoc** (`src/core/server/app.js:3-8`): "ST8 Server — HTTP API for manifests. Serves connection-state.json and ai-signal.toml via HTTP. Also provides endpoints for triggering re-indexing." Minimal — the intent has expanded to ~33 routes since.
- **`_handleApiRequest` JSDoc** (`src/core/server/app.js:382-398`, Wave 5G ticket 14): the canonical statement of routing convention. Two coexisting forms:
  1. *Collection / verb routes* matched directly by the flat `switch` (`POST /api/tickets`, `POST /api/index`, `GET /api/tickets/count`).
  2. *Per-resource routes* with `:id` / `:name` path parameters matched by regex in the `default` branch (`GET /api/prd-projects/<name>`, `POST /api/tickets/:id/claim`, `POST /api/tickets/:id/resolve`).
  Cross-refs: `docs/components/server-api-and-legacy-frontend.md` (Part 1 → Routing convention) and `src/core/server/route-manifest.js` (asserted 1:1 by the drift test).
- **Cluster doc** (`docs/components/server-api-and-legacy-frontend.md:18-108`): expands the convention, lists 23 → 33 routes, and codifies "no router framework swap until count crosses ~30 or a fourth resource gains `:id` verbs."

---

## 3. Routing convention

`_handleApiRequest(req, res, url)` at `src/core/server/app.js:399-509`:

```
switch (url.pathname) {
    case '/api/connection-state.json': this._serveManifest(req, res); break;
    case '/api/ai-signal.toml': this._serveToml(req, res); break;
    …  (30 flat cases total, line 401-489)
    case '/api/exec': this._handleExec(req, res); break;
    default: {
        const claimMatch = url.pathname.match(/^\/api\/tickets\/(\d+)\/claim$/);
        if (claimMatch) { this._handleTicketClaim(req, res, Number(claimMatch[1])); break; }
        const resolveMatch = url.pathname.match(/^\/api\/tickets\/(\d+)\/resolve$/);
        if (resolveMatch) { this._handleTicketResolve(req, res, Number(resolveMatch[1])); break; }
        res.writeHead(404, …); res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }
}
```

Key invariants enforced by `tests/core/server/route-manifest-drift.test.js`:
- Every flat `case '/api/…':` line must have a matching `path:` entry in `route-manifest.js`, and vice versa (test 1, lines 85-103).
- Every `^/api/…$` regex literal inside the `_handleApiRequest` body (extracted by brace-matching, lines 34-51) must map to a manifest entry with a matching `:id`/`:name` path (test 2, lines 105-129). NOTE: `/api/prd-projects/:name` is explicitly excluded because that regex lives inside `_handlePrdProjects` itself, not the default branch (drift test line 116). T5's `/api/file-identity/:fingerprint` could choose either pattern — see §10.
- Every handler in the manifest must exist as a method on `St8Server` (test 3, lines 131-141, regex `\b<handler>\s*\(`).
- Every entry must have `method ∈ {GET,POST,GET|POST}`, `path` starts with `/api/`, `auth ∈ {none, X-St8-Secret, loopback}`, plus non-empty handler + description (test 4, lines 143-153).

---

## 4. Current route inventory

| Path | Method | Handler | Line | Auth |
|---|---|---|---|---|
| `/api/connection-state.json` | GET | `_serveManifest` | 554 | none |
| `/api/ai-signal.toml` | GET | `_serveToml` | 604 | none |
| `/api/health` | GET | `_serveHealth` | 628 | none |
| `/api/index` | POST | `_handleIndex` | 638 | none |
| `/api/file-intent` | POST | `_handleFileIntent` | 697 | none |
| `/api/settings` | GET/POST | `_handleSettings` | 784 | none (8KB cap) |
| `/api/verify` | POST | `_handleVerify` | 934 | none |
| `/api/files` | GET | `_handleFileList` | 883 | none |
| `/api/mutations` | GET (SSE) | `_handleMutationsSSE` | 1108 | none |
| `/api/concept-file` | POST | `_handleConceptFile` | 1129 | none |
| `/api/mvp-lock` | POST | `_handleMvpLock` | 1214 | none |
| `/api/prd` | GET | `_handlePrd` | (not grepped; in manifest) | none |
| `/api/production-promote` | POST | `_handleProductionPromote` | 1337 | none |
| `/api/gap-analysis` | GET | `_handleGapAnalysis` | 1426 | none |
| `/api/prd-projects` (+ `:name`) | GET/POST | `_handlePrdProjects` | 1745 | none |
| `/api/bruno-call` | POST | `_handleBrunoCall` | 1833 | none |
| `/api/oscar-house` | POST | `_handleOscarHouse` | 1878 | none |
| `/api/needs-ai-review` | GET | `_handleNeedsAIReview` | 1922 | none |
| `/api/mark-reviewed` | POST | `_handleMarkReviewed` | 1947 | none |
| `/api/templates` | GET/POST | `_handleTemplates` | 1992 | none |
| `/api/record-commit` | POST | `_handleRecordCommit` | 2060 | X-St8-Secret (8KB) |
| `/api/tickets` | GET/POST | `_handleTickets` | 2148 | POST: X-St8-Secret (8KB) |
| `/api/tickets/count` | GET | `_handleTicketsCount` | 2463 | none |
| `/api/tickets/:id/claim` | POST | `_handleTicketClaim` | 2331 | X-St8-Secret (1KB) |
| `/api/tickets/:id/resolve` | POST | `_handleTicketResolve` | 2409 | X-St8-Secret (4KB) |
| `/api/auth-token` | GET | `_handleAuthToken` | 2494 | loopback |
| `/api/signal-path` | GET/POST | `_handleSignalPath` | 1483 | none (4KB on POST) |
| `/api/generate-report` | POST | `_handleGenerateReport` | 1555 | none (4KB) |
| `/api/insights` | GET | `_handleInsights` | 1645 | none |
| `/api/identity-risk` | GET | `_handleIdentityRisk` | 1697 | none |
| `/api/llm-call` | POST | `_handleLlmCall` | 2541 | X-St8-Secret (8KB) |
| `/api/exec` | POST | `_handleExec` | 2286 | (501 stub, drains 1KB) |

**Total: 33 entries in `route-manifest.js`** (30 flat + 3 parameterised). The Wave 5G ticket-14 JSDoc explicitly flags the 30→~30 threshold for revisiting the table-driven router.

---

## 5. Handler patterns observed (canonical shapes)

### 5.1 Read-only data endpoint with own persistence
`_handleGapAnalysis` at `src/core/server/app.js:1426-1465` is the canonical template:
1. Method gate (`req.method !== 'GET'` → 405 JSON).
2. `let persistence;` declared OUTSIDE the try so `finally` can close it.
3. `try { const Foo = require(...); const { St8Persistence } = require('../database/persistence'); persistence = new St8Persistence(); persistence.initialize().then(...).catch(...).finally(() => persistence.close()); } catch (err) { if (persistence) persistence.close(); ...500... }`.
4. Inside the `.then`: do work, content-negotiate via `req.headers.accept`, write JSON (or `text/markdown`).
5. Outer-catch + finally both close persistence — defence in depth.

Similar: `_handleSignalPath` (1483-1542, but with GET-query + POST-body branches), `_handleGenerateReport` (1555-1635).

### 5.2 Read-only data endpoint using shared singleton
`_handleTicketsCount` at `src/core/server/app.js:2463-2478` and the GET branch of `_handleTickets` (2152-2168) both use `const { getSharedPersistence } = require('../database/persistence'); getSharedPersistence().then(persistence => { try { … } catch { …500 } })`. **No `.close()` on shared persistence** — the singleton manages its own lifecycle. The two patterns coexist: per-handler `new St8Persistence()` is the older shape; `getSharedPersistence()` is the post-`a68142a` perf path. For T5 with multiple downstream queries, *shared* is the cheaper choice.

### 5.3 Write endpoint with auth
`_handleTicketClaim` at 2331-2392 is the canonical template:
1. Method gate (POST-only → 405).
2. `const authCheck = auth.checkRequest(req, this.targetDir); if (!authCheck.ok) { console.warn(...); res.writeHead(authCheck.status, …); res.end(JSON.stringify({error:'unauthorized'})); return; }`.
3. `parseRequestBody(req, { maxBytes: 1024 }).then(async parsed => { if (!parsed.ok) { res.writeHead(parsed.status, …); res.end(JSON.stringify({error: parsed.error})); return; } … validate fields → 400 on missing … `getSharedPersistence` → mutate → `logActivity` → 200 })`.
4. TypeError / RangeError from persistence surface as **400** (not 500) — see `src/core/server/app.js:2362-2372` for the explicit `validationErr instanceof TypeError||RangeError` branch. `result.changes === 0` → 404.

### 5.4 Loopback-gated endpoint
`_handleAuthToken` at 2494-2514: `if (!auth.isLoopback(req)) { res.writeHead(403, …); res.end(...); return; }`. Imports from `src/core/server/auth.js`. None of T1/T2/T5/T6 need this gate.

### 5.5 SSE stream
`_handleMutationsSSE` at 1108-1127 delegates to `notificationBus.addSSEClient(res)`. Out of scope for the new tickets.

### 5.6 Regex-matched per-resource route (the default branch)
`_handleApiRequest` default branch at 491-508 — two cases today: `^\/api\/tickets\/(\d+)\/claim$` and `^\/api\/tickets\/(\d+)\/resolve$`. Captures the id as `Number(match[1])` then dispatches `this._handleTicketClaim(req, res, ticketId)`. The id is passed as the third positional argument to the handler. T5 will mirror this exactly (see §8).

Note on `_handlePrdProjects`: that handler does its OWN regex match for `/api/prd-projects/<name>` INSIDE the handler (`src/core/server/app.js:1748`: `url.pathname.match(/^\/api\/prd-projects\/(.+)$/)`), not in the default branch. The drift test explicitly carves this out at line 116. **Two acceptable patterns** therefore exist for per-resource routes — default-branch match OR self-match inside a flat-case handler.

---

## 6. Prior work (relevant waves)

Audit of recent commits + review log:

- **Wave 3B (`2be309f`)** introduced `_handleSignalPath` and `_handleGenerateReport` together — the latter wires `signal-path-adapter` → `report-generator.generateMigrationReport()`. Ticket 5 in `identity-and-analysis.for-review.json` (currently `executed`, status `ack`) documents the live curl probe and the synthesized Integr8Output envelope. **T6 audit anchor.**
- **Wave 5F (commits `9bfb3f9`, `cdfae98`, `4983772`, `63bcfcf`, `baa813c`)** added: regex default-branch routes for tickets/claim/resolve (the pattern T5 will mirror), POST `/api/llm-call`, settings category allowlist, body-cap matrix (1/2/4/8KB), and `parseRequestBody` helper. Review verdict: 5 ACK / 0 KICKBACK (review.md lines 1-89).
- **Wave 5G (`7f156be`, `4fa9d0d`, `f5da7da`)** added: manifest cache + INDEX_COMPLETE invalidator, routing-convention JSDoc, `path.relative()` security annotation. **Critical for T1/T2/T5: this is the wave that introduced `route-manifest.js` and the drift test.** Any new route MUST add a manifest entry or `tests/core/server/route-manifest-drift.test.js` will fail (review.md lines 92-164).
- **Wave 5H/5I** were frontend-only (D3 vendoring, dead-code removal, a11y) — no app.js touch.

---

## 7. Contracts (what we cannot break)

### 7.1 Per-handler St8Persistence lifecycle
Two acceptable shapes, both must close in `finally{}`:
- **Per-request:** `let persistence; try { persistence = new St8Persistence(); persistence.initialize().then(...).finally(() => persistence.close()); }` — see `_handleGapAnalysis` (1433-1464), `_handleSignalPath` (1485-1519), `_handleGenerateReport` (1568-1633).
- **Shared singleton:** `const { getSharedPersistence } = require('../database/persistence'); const p = await getSharedPersistence(); …` — see `_handleTickets`, `_handleTicketClaim`, `_handleTicketResolve`, `_handleLlmCall`, `_handleTicketsCount`. **Never `.close()` the shared singleton.** Picked when the route is called frequently or needs more than one query.

### 7.2 Body-cap matrix (Wave 5F ticket 10)
Routed via `parseRequestBody(req, { maxBytes: N })` at `src/core/server/app.js:197-252`. Caps observed:
- 1KB (1024): compute-only routes — index, file-intent, verify, concept-file, mvp-lock, production-promote, bruno-call, oscar-house, mark-reviewed, exec, ticket-claim.
- 2KB (2048): templates POST, prd-projects POST.
- 4KB (4096): signal-path POST, generate-report POST, ticket-resolve.
- 8KB (8192): settings, record-commit, tickets POST, llm-call (also the `parseRequestBody` default).
T1/T2 are GET-mostly read-only → no body. T5 GET-by-path. **No new caps needed unless a POST variant is added.**

### 7.3 X-St8-Secret enforcement
`const authCheck = auth.checkRequest(req, this.targetDir); if (!authCheck.ok) { console.warn(...); res.writeHead(authCheck.status, …); res.end(JSON.stringify({error:'unauthorized'})); return; }` — applied at `_handleRecordCommit`, `_handleTickets` POST (2178-2184), `_handleTicketClaim` (2337-2343), `_handleTicketResolve` (2415-2421), `_handleLlmCall` (2549-2555). Auth module: `src/core/server/auth.js` exports `ensureSecret`, `readSecret`, `checkRequest`, `isLoopback`.

### 7.4 Loopback gating
`if (!auth.isLoopback(req)) { res.writeHead(403, …); res.end(JSON.stringify({error:'forbidden'})); return; }` — only `_handleAuthToken` (2500-2505).

### 7.5 JSON response shape conventions
- Success (read endpoint): `{ ok: true, … }` or — older routes — raw payload. T6's `/api/generate-report` (1614-1617) returns either raw markdown (Accept: text/markdown) or `{ ok: true, report, pathSummary }`. `_handleSignalPath` (1502-1503) returns the adapter's result envelope verbatim (which includes `{ ok, plan, outcome, reasons, pathSummary }`). `_handleInsights` returns `{ ok: true, … }`.
- Success (write/mutate endpoint): `{ ok: true, id, … }` (e.g. ticket-claim returns `{ ok: true, id: ticketId, claimedBy: providerId }`).
- Error: `{ error: string }` for older routes (gap-analysis, tickets, prd-projects, settings, auth), `{ ok: false, error: string }` for newer routes (signal-path, generate-report, insights, identity-risk, exec). **For consistency with the analysis-tool family, T1/T2/T5 should adopt `{ ok: false, error }` and `{ ok: true, … }`.**
- All JSON responses set `Content-Type: application/json`.

### 7.6 Drift-test contract
EVERY new route added in `_handleApiRequest` MUST also be added to `src/core/server/route-manifest.js` with `{ method, path, handler, auth, description }`. The drift test catches mismatches in both directions. Drift test is load-bearing (mutation probe in 5G review confirmed: fake entry → tests 1 + 3 fail; restored → all pass).

---

## 8. Change vector — per ticket

### T1 — Wire `relationship-analyzer.js` via `/api/analyze-relationships`

**Roadmap source:** `docs/_pending-roadmap/identity-and-analysis.md:49-53` (P2.1) — `POST /api/analyze-relationships { currentGraphId, fileNodeId, targetPages }`. Identity-and-analysis ticket-3 currently deferred (defer-confirmed by Wave 3B reviewer) on the grounds that wiring against (currentGraph, currentGraph) is a stub-disguised-as-wire-up. **The synthesizer must read the relationship-analyzer research (`docs/_research/2026-05-16-analysis-tools-unblock/src_features_analysis_relationship-analyzer.md`) to know what input shape is honest.**

**Pattern to mirror:** `_handleSignalPath` at 1483-1542. Same shape applies — GET/POST flexible (probably POST-only given the multi-field body). Handler skeleton (sketch only):

```
// Switch case at ~app.js:476 (insert near _handleGenerateReport for thematic clustering)
case '/api/analyze-relationships':
    this._handleAnalyzeRelationships(req, res);
    break;

// Handler — mirror _handleGenerateReport (1555-1635):
_handleAnalyzeRelationships(req, res) {
    if (req.method !== 'POST') { res.writeHead(405, …); return; }
    parseRequestBody(req, { maxBytes: 4096 }).then((parsed) => {
        if (!parsed.ok) { …413/400… }
        let persistence;
        try {
            const { analyzeRelationships } = require('../../features/analysis/relationship-analyzer');
            const { St8Persistence } = require('../database/persistence');
            persistence = new St8Persistence();
            persistence.initialize().then(() => {
                try {
                    // Build externalGraph + currentGraph from persistence …
                    // (this is the load-bearing decision — see §10)
                    const result = analyzeRelationships(externalGraph, currentGraph, targetPages);
                    res.writeHead(200, {'Content-Type':'application/json'});
                    res.end(JSON.stringify({ ok: true, ...result }, null, 2));
                } catch (err) { …500… } finally { persistence.close(); }
            }).catch((err) => { persistence.close(); …500… });
        } catch (err) { if (persistence) persistence.close(); …500… }
    });
}
```

**Route-manifest entry to add** (around line 158-170, with the analysis routes):
```
{ method: 'POST', path: '/api/analyze-relationships', handler: '_handleAnalyzeRelationships',
  auth: 'none',
  description: 'Run relationship-analyzer over two SemanticGraphs; returns unifiedGraph + conflicts + dependencyMap. 4KB body cap.' },
```

**Insertion location for the switch case:** group with the analysis routes, around `src/core/server/app.js:476-483` (between `/api/signal-path` and `/api/generate-report` / `/api/insights`).

### T2 — Wire `graph/traversal.js` lazy: `/api/graph/deps` + `/api/graph/impacts`

**Roadmap source:** `docs/_pending-roadmap/identity-and-analysis.md:61-70` (P2.3). Two paths offered (lazy: rewrite traversal to read `file_registry`+`connections`; sonic-aligned: populate GraphNodes/GraphEdges). Brief says **lazy**.

**Critical input from prior research** (`docs/_research/.../src_features_graph_traversal.md`): `traversal.js` is `tsc`-emitted vendored output — hand-edits will be clobbered. The recommended approach is **a new wrapper module that adapts persistence queries to traversal's export shapes**, leaving the vendored `.js` untouched. The route handlers in `app.js` should call the wrapper, NOT `traversal.findImportsOf` / `computeImpactChain` directly with a `db` arg that doesn't fit st8's persistence model. Traversal exports `findImportsOf`, `findConsumersOf`, `computeImpactChain`, `findPaths`, `analyzeReachability` etc. (all 13 listed at lines 48-60). The natural mapping for T2:
- `/api/graph/deps?nodeId=…` → upstream/inbound (what does this file import) → likely `findImportsOf` or `analyzeReachability(direction='inbound')`.
- `/api/graph/impacts?nodeId=…` → downstream/outbound (who imports this file, transitively) → `computeImpactChain`.

**Pattern to mirror:** `_handleInsights` at 1645-1671 — a pure GET, no body, query-param parsing, no persistence-write, no auth.

```
// Switch cases at ~app.js:481-483:
case '/api/graph/deps':
    this._handleGraphDeps(req, res, url);
    break;
case '/api/graph/impacts':
    this._handleGraphImpacts(req, res, url);
    break;

// Handlers — mirror _handleInsights skeleton:
_handleGraphDeps(req, res, url) {
    if (req.method !== 'GET') { res.writeHead(405, …); return; }
    let persistence;
    try {
        const { findImportsOfFile /* or whatever the lazy wrapper exposes */ } = require('../../features/graph/lazy-traversal');
        const { St8Persistence } = require('../database/persistence');
        persistence = new St8Persistence();
        persistence.initialize().then(() => {
            try {
                const nodeId = url.searchParams.get('nodeId') || url.searchParams.get('filepath');
                if (!nodeId) { res.writeHead(400, …); res.end(JSON.stringify({ok:false,error:'nodeId required'})); return; }
                const result = findImportsOfFile(persistence, nodeId);
                res.writeHead(200, {'Content-Type':'application/json'});
                res.end(JSON.stringify({ ok: true, nodeId, deps: result }, null, 2));
            } catch (err) { …500… } finally { persistence.close(); }
        }).catch(…);
    } catch (err) { …500… }
}
// _handleGraphImpacts — same shape, calls computeImpactChain-equivalent.
```

**Route-manifest entries to add** (two new entries around line 168 with the analysis routes):
```
{ method: 'GET', path: '/api/graph/deps', handler: '_handleGraphDeps',
  auth: 'none', description: 'Direct + transitive dependencies of a file (lazy traversal over file_registry+connections).' },
{ method: 'GET', path: '/api/graph/impacts', handler: '_handleGraphImpacts',
  auth: 'none', description: 'Reverse-BFS impact chain — who depends on this file? (lazy traversal over file_registry+connections).' },
```

**Note:** the slashes inside the path (`/api/graph/deps`) are fine — the drift test extracts `case '/api/[^']+'` so multi-segment paths work. Manifest just stores the literal string.

### T5 — `/api/file-identity/<fingerprint>`

**Roadmap source:** `docs/_pending-roadmap/identity-and-analysis.md:28-43` (P1.3). Founder-flagged. Response shape: `{ file, intent, card, mutations, insights, connections: { imports, importedBy } }`.

**Pattern to mirror:** the regex-matched default branch (`_handleTicketClaim` dispatch at app.js:496-500). T5 is per-resource (the fingerprint is the resource id), so it goes in the **default branch**, not the flat switch.

**Insertion location:** `src/core/server/app.js:496-505`, inside `default: {`, BEFORE the 404 fallthrough at line 506-507. Add a new `const fpMatch = url.pathname.match(/^\/api\/file-identity\/([a-zA-Z0-9_-]+)$/); if (fpMatch) { this._handleFileIdentity(req, res, fpMatch[1]); break; }` block.

Fingerprints in st8 are 12-char base36 (per `src/shared/types/st8-types.js generateFingerprint`) — `[a-zA-Z0-9]+` or `[0-9a-z]+` will match. I'd choose `(\w+)` or `([0-9a-z]+)` for safety. The drift test's parameter-substitution code (`extractParamRoutes` lines 61-83) maps `(\d+)` → `:id` and any other capture group → `:name`. So for the manifest entry, the path will be `/api/file-identity/:name` (the parser doesn't know about `:fingerprint`). That's an aesthetic ding — see §10 question 2 below.

**Handler skeleton:** mirror `_handleTicketClaim` (which receives a third positional arg, `ticketId`), but it's a GET (no body, no auth). Like `_handleInsights` for the query shape, but using shared persistence:

```
_handleFileIdentity(req, res, fingerprint) {
    if (req.method !== 'GET') { res.writeHead(405, …); return; }
    const { getSharedPersistence } = require('../database/persistence');
    getSharedPersistence().then(async (persistence) => {
        try {
            const file = persistence.getFileByFingerprint(fingerprint);
            if (!file) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({ok:false,error:'unknown fingerprint'})); return; }
            const intent       = persistence.getFileIntent?.(fingerprint) || null;
            const mutations    = persistence.getFileMutations?.(fingerprint) || [];
            const imports      = persistence.getConnectionsFrom?.(fingerprint) || [];
            const importedBy   = persistence.getConnectionsTo?.(fingerprint) || [];
            const insights     = (() => { try { const { getInsightStore } = require('../../features/analysis/insight-store'); return getInsightStore().getInsightsForFile('st8', file.filepath); } catch { return []; }})();
            const card         = readCardForFile(this.targetDir, file); // helper TBD — reads .st8/schema-cards/<flat>.json
            res.writeHead(200, {'Content-Type':'application/json'});
            res.end(JSON.stringify({ ok: true, file, intent, card, mutations, insights, connections: { imports, importedBy } }, null, 2));
        } catch (err) { res.writeHead(500, …); res.end(JSON.stringify({ok:false,error:err.message})); }
    });
}
```

**Real persistence method names need verification.** The synthesizer must read `src/core/database/persistence.js` (or the persistence research report) to confirm exact getter names — `getFileByFingerprint` is the contract used elsewhere; `getFileIntent`, `getFileMutations`, `getConnectionsFrom/To` are plausible but not yet grepped. Card-on-disk read is similar to `_handleIdentityRisk` (1697-1743).

**Route-manifest entry** (around line 168):
```
{ method: 'GET', path: '/api/file-identity/:fingerprint', handler: '_handleFileIdentity',
  auth: 'none', description: 'Full identity bundle for a fingerprint: file + intent + card + mutations + insights + connections.' },
```

Caveat: the drift test maps `(\w+)` → `:name`, so the *manifest path* might need to be `/api/file-identity/:name` to satisfy the comparison (the test rewrites all non-`\d+` captures to `:name` at line 79). Verify by reading test-extraction lines 76-80 again at synthesis time. Workaround: use `(\d+)` if fingerprints can be restricted to digits (they cannot — base36 includes letters), OR accept `:name` in the manifest, OR push the regex match into the handler self-match style (like `_handlePrdProjects` does) and exempt it from the drift test the way `prd-projects/:name` is exempted at drift-test line 116. The cleanest path is **manifest entry `:fingerprint` + drift-test extension** but that's its own scope-creep ticket — recommend the synthesizer pick `:name` for now and document the lossy reverse-map as a follow-up.

### T6 — `/api/generate-report` audit

**Per Batch 1, this route already exists.** Confirmed:
- Switch case at `src/core/server/app.js:476-477`: `case '/api/generate-report': this._handleGenerateReport(req, res); break;`.
- Handler at `src/core/server/app.js:1555-1635`, 80 LOC.
- Manifest entry at `src/core/server/route-manifest.js:162-164`: `{ method: 'POST', path: '/api/generate-report', handler: '_handleGenerateReport', auth: 'none', description: 'Report-generator output as markdown or JSON. 4KB body cap.' }`.

**Current handler shape (1555-1635):**
1. POST-only (1556-1560).
2. `parseRequestBody(req, { maxBytes: 4096 }).then(parsed => ...)` (1562-1567).
3. Validate `parsed.body.filepath` is a string (1571-1576).
4. Lazy-require `signal-path-adapter.computeSignalPath`, `report-generator.generateMigrationReport`, `St8Persistence` (1577-1579).
5. `new St8Persistence()` + `initialize()` (1580-1581).
6. Call `computeSignalPath({ persistence, targetFilepath: filepath, targetDir: payload.targetDir || this.targetDir || '.' })` (1583-1587).
7. If `!sp.ok` → 404 + envelope (1588-1592).
8. **Synthesize a minimal Integr8Output envelope** (1598-1608) — `{ migrationPlan: sp.plan, migrationReport: '', semanticGraph: { nodes: [], edges: [], properties: sp.pathSummary.graphProperties }, outcome: sp.outcome, reasons: sp.reasons }`. The comment at 1593-1597 acknowledges nodes/edges are elided because `report-generator` only reads `properties`.
9. Call `generateMigrationReport(integr8Output)` → markdown string (1609).
10. Content-negotiate on `req.headers.accept`: `text/markdown` → raw markdown body; else JSON `{ ok: true, report: markdown, pathSummary: sp.pathSummary }` (1610-1617).
11. `finally { persistence.close(); }` (1621-1623).

**Per the ticket brief: the "wedge fix" (if needed) is in signal-path-adapter, not here.** This handler is well-shaped and matches the analysis-route family. **Recommendation: NO CHANGE to app.js for T6.** Any DELTA the synthesizer wants would have to come from a finding in the signal-path-adapter research report (`docs/_research/.../src_features_analysis_signal-path-adapter.md`), since this handler is a faithful pass-through. Specifically, the `semanticGraph.{nodes:[], edges:[]}` elision is documented and intentional, and the route already does proper persistence-close on every path (success, error, validation-fail).

The only observable thing the synthesizer might want to confirm by re-reading the adapter research: does `sp.pathSummary.graphProperties` always exist when `sp.ok===true`? If the adapter can return `ok:true` without `graphProperties`, line 1604 would NPE. The handler currently has no guard for this — that would be the only honest "wedge" if it exists in the adapter shape. Otherwise: app.js is clean for T6.

---

## 9. Provisions already made (extension points)

- **`parseRequestBody(req, { maxBytes, allowEmpty })`** at `src/core/server/app.js:197-252` — exported helper. Returns `Promise<{ ok, status?, error?, body? }>`. Settle-once semantics, idempotent, `req.destroy()` on cap exceed. Handles client abort + JSON parse errors uniformly. **Use this for any new POST.**
- **`auth.checkRequest(req, this.targetDir)`** at `src/core/server/auth.js:125` — returns `{ ok, status, reason }`. **Use this for any new X-St8-Secret-protected endpoint.**
- **`auth.isLoopback(req)`** at `src/core/server/auth.js:141` — for new loopback-gated endpoints.
- **`getSharedPersistence()`** in `../database/persistence` — preferred for read-heavy or multi-query handlers. Do not `.close()`.
- **`St8Persistence` (per-request)** — preferred for single-query handlers that already follow the close-in-finally template. Both T1's analyzer and T5's bundle could go either way; shared singleton is the modern default.
- **Hook-registry** at `../hook-registry` exports `hookRegistry` + `HOOKS` constants — only fire a new hook if a real subscriber exists (per CLAUDE.md). T1/T2/T5 are read-only with no obvious subscriber, so no new hook constants needed.
- **Default-branch regex slot** at 491-508 — append before the 404 fallthrough.
- **Insertion zone for analysis routes** — switch lines 473-483 group signal-path / generate-report / insights / identity-risk; T1 + T2 belong here. T5 belongs in the default branch.

---

## 10. Gaps + open questions

### 10.1 Route-manifest sync — IS REQUIRED for T1, T2, T5
**Yes, the drift test `tests/core/server/route-manifest-drift.test.js` enforces 1:1 in both directions** (see §3 and §7.6). Every new flat case must have a matching manifest entry; every new default-branch regex must have a matching `:id`/`:name` manifest entry. **The synthesizer MUST add 4 new entries to `route-manifest.js`** (T1: 1, T2: 2, T5: 1) or the test will fail. T6 already has its entry and needs none.

### 10.2 Parameter-name fidelity in the manifest path
The drift test's `extractParamRoutes` (test file lines 61-83) maps `(\d+)` → `:id` and any other capture group → `:name`. So `^\/api\/file-identity\/([a-zA-Z0-9]+)$` in app.js will require `/api/file-identity/:name` in the manifest, even though semantically the parameter is `:fingerprint`. Open question for synthesizer: accept the lossy reverse-map and document it inline, OR extend the drift test to recognize `:fingerprint` as a named alias (scope creep), OR push the regex match inside the handler (the `_handlePrdProjects` pattern) and exempt it the same way `prd-projects/:name` is exempted at drift-test line 116. Recommendation: simplest path is **manifest entry uses `:fingerprint` + the synthesizer also extends the drift test extractor to allow `:fingerprint`**, OR just accept `:name` in the manifest and put `:fingerprint` only in the description string.

### 10.3 Lazy-traversal wrapper module location
For T2, the prior research recommends a new wrapper module to adapt `traversal.js` (which is `tsc`-emitted vendored output) to st8's `file_registry`+`connections` schema rather than its native `GraphNodes`/`GraphEdges`. Open: where does the wrapper live? Options: `src/features/graph/lazy-traversal.js` (next to traversal.js), or `src/features/analysis/graph-adapter.js` (mirroring `signal-path-adapter`). The latter pattern aligns with how signal-path-adapter wraps path-generator. **The synthesizer needs to pick the wrapper path before writing the handler.** This is the load-bearing decision for T2 — the route handlers in app.js are thin glue once the wrapper exists.

### 10.4 T1 input shape — externalGraph vs currentGraph
The Wave 3B reviewer explicitly defer-confirmed wiring relationship-analyzer because `(currentGraph, currentGraph)` would be a stub-disguised-as-wire-up. **The synthesizer must decide whether this wave provides a real `externalGraph` ingest path (probably out of scope), or whether the wire-up is honest with a documented "self-introspection only" mode that flags the trivially-SAFE classification.** If the latter, the handler should reject the request with 501 + roadmap pointer (the `_handleExec` precedent at 2286-2304) rather than silently returning a trivial result. Re-check `docs/_research/.../src_features_analysis_relationship-analyzer.md` and `identity-and-analysis.for-review.json` ticket 3 before settling.

### 10.5 T6 — possible adapter-side wedge
The brief notes T6's wedge is in signal-path-adapter, not app.js. If the adapter research surfaces a wedge that requires app.js to pass an additional flag or wrap a try around `sp.pathSummary.graphProperties` access, that's a one-line addition in `_handleGenerateReport`. Otherwise: **no change to app.js for T6.**

### 10.6 Tests
- The drift test will catch missing/extra manifest entries automatically.
- New route handler tests would live in `tests/core/server/<route-name>.test.js` mirroring `ticket-lifecycle-routes.test.js` (boots a real `St8Server` on an ephemeral port + temp targetDir). Not required by the brief, but the existing ack-pattern in 5F review.md lines 56-58 suggests reviewers will probe handlers with curl + DB introspection.
- `_handleGenerateReport` currently has NO dedicated test — the adapter test in `signal-path-adapter.test.js` covers the inner path. If T6 ends up touching the handler, a route-level test would be wise.

### 10.7 Body-cap policy for T1
T1 is the only ticket with a real body shape. 4KB matches the analysis-route family (signal-path, generate-report). If `targetPages` is a large array, 8KB may be more appropriate — the synthesizer should bound it based on the relationship-analyzer research's input expectations.
