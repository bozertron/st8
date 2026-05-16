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

const ROUTES = Object.freeze([
  // --- Read-only manifest / health (no auth) -----------------------------
  { method: 'GET',  path: '/api/connection-state.json', handler: '_serveManifest',
    auth: 'none',
    description: 'Read live manifest JSON from <targetDir>/connection-state.json. In-process cache invalidated on INDEX_COMPLETE (Wave 5G ticket 2).' },
  { method: 'GET',  path: '/api/ai-signal.toml', handler: '_serveToml',
    auth: 'none',
    description: 'Read live TOML manifest from <targetDir>/ai-signal.toml.' },
  { method: 'GET',  path: '/api/health', handler: '_serveHealth',
    auth: 'none',
    description: '{ status, uptime, targetDir, lastManifestUpdate }.' },

  // --- Indexer / file lifecycle ------------------------------------------
  { method: 'POST', path: '/api/index', handler: '_handleIndex',
    auth: 'none',
    description: 'Re-index a path; writes manifests, returns file count. 1KB body cap.' },
  { method: 'POST', path: '/api/file-intent', handler: '_handleFileIntent',
    auth: 'none',
    description: 'Upsert {purpose, dependsOnBehavior, valueStatement} for a fingerprint; rewrites manifest in place. 1KB body cap.' },
  { method: 'POST', path: '/api/verify', handler: '_handleVerify',
    auth: 'none',
    description: 'Walk indexed files, recompute SHA-256, report verified / modified / missing / orphan counts. 1KB body cap.' },
  { method: 'GET',  path: '/api/files', handler: '_handleFileList',
    auth: 'none',
    description: 'List directory entries at ?path=. Tilde expansion + path.relative() traversal protection (must be inside $HOME or targetDir).' },

  // --- Mutations / SSE ---------------------------------------------------
  { method: 'GET',  path: '/api/mutations', handler: '_handleMutationsSSE',
    auth: 'none',
    description: 'Server-sent events stream of mutation notifications.' },

  // --- Phase / lifecycle transitions ------------------------------------
  { method: 'POST', path: '/api/concept-file', handler: '_handleConceptFile',
    auth: 'none',
    description: 'Phase-6: register a CONCEPT-phase file, set optional intent, publish CONCEPT mutation. 1KB body cap.' },
  { method: 'POST', path: '/api/mvp-lock', handler: '_handleMvpLock',
    auth: 'none',
    description: 'Transition every CONCEPT/DEVELOPMENT file to LOCKED, log mutations, re-emit schema cards. 1KB body cap.' },
  { method: 'POST', path: '/api/production-promote', handler: '_handleProductionPromote',
    auth: 'none',
    description: 'Purge development-only mutation history for a fingerprint. 1KB body cap.' },

  // --- PRD / analysis ----------------------------------------------------
  { method: 'GET',  path: '/api/prd', handler: '_handlePrd',
    auth: 'none',
    description: 'Generate the cross-card PRD markdown via features/prd/generator.' },
  { method: 'GET',  path: '/api/gap-analysis', handler: '_handleGapAnalysis',
    auth: 'none',
    description: 'Run GapAnalyzer over schema cards; content-negotiate JSON or text/markdown.' },
  { method: 'GET|POST', path: '/api/prd-projects', handler: '_handlePrdProjects',
    auth: 'none',
    description: 'List or create PRD project records. 2KB body cap on POST.' },
  { method: 'GET',  path: '/api/prd-projects/:name', handler: '_handlePrdProjects',
    auth: 'none',
    description: 'Fetch a single PRD project by name (per-resource regex match in default branch).' },

  // --- Lifecycle (Bruno / Oscar) ----------------------------------------
  { method: 'POST', path: '/api/bruno-call', handler: '_handleBrunoCall',
    auth: 'none',
    description: 'Run BrunoOscar.runBrunoCall(threshold) — lifecycle alarm pass. 1KB body cap.' },
  { method: 'POST', path: '/api/oscar-house', handler: '_handleOscarHouse',
    auth: 'none',
    description: 'Run BrunoOscar.runOscarHouse(gracePeriod) — lifecycle reaper pass. 1KB body cap.' },

  // --- AI review ---------------------------------------------------------
  { method: 'GET',  path: '/api/needs-ai-review', handler: '_handleNeedsAIReview',
    auth: 'none',
    description: 'List files flagged needsAIReview.' },
  { method: 'POST', path: '/api/mark-reviewed', handler: '_handleMarkReviewed',
    auth: 'none',
    description: 'Mark a file as reviewed by AI; requires filepath. 1KB body cap.' },

  // --- Templates / settings ---------------------------------------------
  { method: 'GET|POST', path: '/api/templates', handler: '_handleTemplates',
    auth: 'none',
    description: 'GET lists PRD templates; POST saves a named template {name, content, description}. 2KB body cap on POST.' },
  { method: 'GET|POST', path: '/api/settings', handler: '_handleSettings',
    auth: 'none',
    description: 'GET returns settings (optional ?category=); POST upserts {category, key, value}. 8KB body cap.' },

  // --- Commit / tickets (write surface — requires X-St8-Secret) --------
  { method: 'POST', path: '/api/record-commit', handler: '_handleRecordCommit',
    auth: 'X-St8-Secret',
    description: 'Receive post-commit hook payload; log to activity_log; fire HOOKS.COMMIT_RECORDED. 8KB body cap.' },
  { method: 'GET|POST', path: '/api/tickets', handler: '_handleTickets',
    auth: 'X-St8-Secret',
    description: 'GET lists 200 newest open tickets (no auth); POST creates a ticket and fires HOOKS.TICKET_CREATED (X-St8-Secret required, 8KB body cap).' },
  { method: 'GET',  path: '/api/tickets/count', handler: '_handleTicketsCount',
    auth: 'none',
    description: '{ count } of open tickets — phreak> TUI badge source.' },
  { method: 'POST', path: '/api/tickets/:id/claim', handler: '_handleTicketClaim',
    auth: 'X-St8-Secret',
    description: 'Claim a ticket by id; requires {providerId}. Per-resource regex match in default branch. 1KB body cap.' },
  { method: 'POST', path: '/api/tickets/:id/resolve', handler: '_handleTicketResolve',
    auth: 'X-St8-Secret',
    description: 'Resolve a ticket by id; requires {resolution, providerId?}. Per-resource regex match in default branch. 4KB body cap.' },

  // --- Auth + LLM dispatch ----------------------------------------------
  { method: 'GET',  path: '/api/auth-token', handler: '_handleAuthToken',
    auth: 'loopback',
    description: 'Return the shared X-St8-Secret value to a loopback caller so the frontend can include it on subsequent POSTs. Non-loopback callers get 403.' },
  { method: 'POST', path: '/api/llm-call', handler: '_handleLlmCall',
    auth: 'X-St8-Secret',
    description: 'Dispatch a chat-completion to a configured provider. 8KB body cap.' },

  // --- Signal-path / reports / insights / identity ---------------------
  { method: 'GET|POST', path: '/api/signal-path', handler: '_handleSignalPath',
    auth: 'none',
    description: 'Path-generator (FOUNDER P1). 4KB body cap on POST.' },
  { method: 'POST', path: '/api/generate-report', handler: '_handleGenerateReport',
    auth: 'none',
    description: 'Report-generator output as markdown or JSON. 4KB body cap.' },
  { method: 'GET',  path: '/api/insights', handler: '_handleInsights',
    auth: 'none',
    description: 'Insight-store consumer.' },
  { method: 'GET',  path: '/api/identity-risk', handler: '_handleIdentityRisk',
    auth: 'none',
    description: 'Identity-risk consumer (Wave 3C).' },

  // --- Deferred / placeholder routes ------------------------------------
  { method: 'POST', path: '/api/exec', handler: '_handleExec',
    auth: 'X-St8-Secret',
    description: 'Deliberately deferred — returns 501 with roadmap pointer. Real implementation requires a strict command allowlist (see roadmap).' },
]);

module.exports = {
  ROUTES,
};
