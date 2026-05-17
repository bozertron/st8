# src/features/llm — data-unblock audit (pass 2)

Date: 2026-05-17. Read-only. Lens: canonical-category producer / accurate
resolver / persistence-derived analyzer / clear-then-rebuild (batch 031).

## 1. File inventory

```
src/features/llm/dispatcher.js               98 LOC
src/features/llm/providers/anthropic.js     114 LOC
src/features/llm/providers/openai.js        108 LOC
```

Total 320 LOC. Filemap entry was stale ("just dispatcher.js"); the
`providers/` subdirectory is real and shipped in Wave 5E ticket 1.

Tests (live, passing):
- `tests/features/llm/providers-adapters.test.js` — adapter + dispatcher unit tests (fetch-mocked)
- `tests/core/server/llm-call-route.test.js` — integration tests for POST /api/llm-call

## 2. `dispatcher.js` — exports + callers + provider integration

**Exports:** `dispatch`, `SUPPORTED_PROVIDERS`, `STUB_PROVIDERS`, `PROVIDER_ENV_KEYS`.

**Signature:** `async dispatch({ entry, prompt, opts }) → { ok, ... }`.
`entry` is a settings `models._entries[i]` row with **decrypted** `apiKey`.

**Routing:**
- `SUPPORTED_PROVIDERS = {anthropic, openai}` → lazy-`require` of `./providers/<id>` and call `adapter.call({model, apiKey, baseUrl, prompt, opts})`. Lazy require is a test seam (lets tests swap `globalThis.fetch` before the adapter loads).
- `STUB_PROVIDERS = {google, ollama, lmstudio, openrouter, custom}` → returns `{ok:false, status:501, error: "... See docs/_pending-roadmap/settings-and-providers.md P1.2 ..."}`.
- Unknown provider → 400 with sorted allow-list in the error string.

**Env-var fallback:** `PROVIDER_ENV_KEYS = {anthropic:ANTHROPIC_API_KEY, openai:OPENAI_API_KEY, google:GOOGLE_API_KEY, openrouter:OPENROUTER_API_KEY}`. If `entry.apiKey` empty AND the provider has an envKey, dispatcher reads `process.env[envKey]` before failing.

**Live callers:**
- `src/core/server/app.js:2596` — `_handleLlmCall` (the `/api/llm-call` handler).
- That is the **only** production caller. Tests call it directly.

## 3. `/api/llm-call` — handler shape, auth, body cap, callers

- Method: POST only; GET → 405.
- Auth: `auth.checkRequest(req, targetDir)` → standard `X-St8-Secret` (loopback also gates `/api/auth-token`). On miss: 401 with `'unauthorized'` and `[st8:auth] /api/llm-call rejected` log.
- Body: parsed via `parseRequestBody(req, { maxBytes: 8192 })` (8KB cap — note this matches the comment, but the route doc-comment at line 2529 still incorrectly says "1KB cap (matches /api/settings)" — minor doc drift).
- Required fields: `entryId:string`, `prompt:string`. `opts` optional. 400 on missing.
- Persistence lookup: `getSharedPersistence().getSettingsByCategory('models')` → `_entries.find(e => e.id === entryId)`. 404 if absent. `apiKey` arrives decrypted via the Wave 5E ticket-2 crypto seam.
- Returns adapter response verbatim on success; on failure, returns `{ok:false, error}` with HTTP status mapped from `result.status` (fallback 502).
- Registered in `src/core/server/route-manifest.js:154`.

**Frontend callers:** **NONE.** A wide `grep "llm-call\|llmCall"` across `src/frontend/` produces zero hits. The route is reachable only from tests today. Roadmap (`docs/_pending-roadmap/settings-and-providers.md` P1.3, "shelf chat input") is the unbuilt consumer.

## 4. Provider registry — how it's consumed at dispatch

Two parallel registries that don't talk to each other:

| Source | Used by | Contents |
|---|---|---|
| `src/frontend/components/settings/settings.js` `LLM_PROVIDERS` | UI dropdown + envKey hints | 7 ids: anthropic, openai, google, ollama, lmstudio, openrouter, custom |
| `providers` SQLite table (seeded in `persistence.js:444`) | `claimTicket()` FK validation | Same 7 + `'human'` |
| `SUPPORTED_PROVIDERS` + `STUB_PROVIDERS` in `dispatcher.js` | Dispatch routing | Same 7 ids partitioned 2/5 |

The dispatcher does NOT read the `providers` table. It does not consult `LLM_PROVIDERS`. The id set is hard-coded in `dispatcher.js:23-24`. **This is the canonical-category-style drift of batch 030**: three name-lists with no compile-time link. Adding `google` to the SQLite providers seed would not enable dispatch; flipping it to "supported" requires a dispatcher.js edit AND a new adapter file.

## 5. LLM-expert scaffolding (existing or absent)

**Absent.** No file mentions `PatternAnalyst`, `PerformanceAdvisor`, `ArchitectureReviewer`, or `SecurityAnalyst` anywhere in `src/` or `tests/`. The sonic-and-search roadmap P2 (line 75-95) names them, plus the hook types `NewInsight | Pattern | Threshold | Scheduled`, and the workflow:

> insights posted → InsightStore updated → `InsightHookManager.fireHooks()` → expert prompt formatted → LLM call → `Opportunity` written to `OpportunityCatalog`

None of `InsightHookManager`, `OpportunityCatalog`, `Opportunity` table, or any expert-prompt template exists. The 4 expert names are purely roadmap copy at the moment.

## 6. NewInsight-fires-LLM hook potential

Yes — the pieces are in place. The wiring required is tiny:

- Hook constants in `src/core/hook-registry.js` (currently end at `TICKET_CREATED`). Add `INSIGHT_RECORDED` (or reuse a publish from `addInsightsBatch`).
- `src/features/analysis/insight-store.js:addInsightsBatch` (line 172) is the natural publisher — add `hookRegistry.publish(INSIGHT_RECORDED, {insight})` per row at the end of the loop.
- A subscriber in `src/core/hooks/default-subscribers.js` (priority after the P=37 cycle-insight-emitter) that:
  1. Pulls the configured `models._entries[0]` (or a designated "expert" entry id from settings).
  2. Formats a per-category prompt from canonical categories (`circular_dependency` → "explain why this cycle hurts and propose a break point").
  3. Calls `dispatch({ entry, prompt })` directly (avoiding the HTTP roundtrip).
  4. Writes the response to a new `opportunities` table or back into the insight as `context.expertAnalysis`.

The cycle pipeline of batch 031 is already producing exactly one canonical-category insight per run. A SecurityAnalyst stub firing on `circular_dependency` insights would be the smallest non-trivial end-to-end Layer-3 demo. Stays within batch-031 recipe A (canonical producer pattern) — the LLM expert is "just another emitter" whose input is an InsightRecord and whose output is another InsightRecord (or Opportunity row) with `category` from a fixed allow-list.

## 7. TOP 3 QUICK WINS

1. **Wire the `providers` SQLite table to the dispatcher.** Replace the hard-coded `SUPPORTED_PROVIDERS`/`STUB_PROVIDERS` sets in `dispatcher.js` with a runtime read of `persistence.listProviders({onlyActive:true})` + a per-row `supported` flag (new column or by-id presence-of-adapter-file). One source of truth. Removes a category-name-drift class identical to the Insight `category` drift batch 030 caught. ~30 LOC + 1 migration.

2. **Fix the 1KB→8KB doc drift in `_handleLlmCall`** (`app.js:2529` comment). Trivial but exactly the kind of stale comment that misleads the next dispatcher-expansion ticket. Plus add a `console.warn` line item to `parseRequestBody` 413 path so reviewers can see the cap actually firing.

3. **Drop a `provider_calls` SQLite table** (roadmap P3.1) and have `_handleLlmCall` insert one row per dispatch on `result.ok` and on adapter failure. Schema is fully spec'd in the roadmap: `{id, modelEntryId, provider, model, promptHash, latencyMs, tokensIn, tokensOut, error, timestamp}`. This is recipe-C (persistence-derived analyzer) bait — once telemetry lands, a future `provider-health-emitter` can produce canonical-category `performance` insights without touching the dispatcher again.

## 8. Cross-directory dependencies

- `src/core/server/app.js:2596` — requires `../../features/llm/dispatcher`.
- `src/core/server/app.js:2583` — requires `../database/persistence` (`getSharedPersistence`, `getSettingsByCategory('models')`).
- `src/core/server/auth.js` (via `auth.checkRequest`) — X-St8-Secret gate.
- `src/core/server/route-manifest.js:154` — declarative registration.
- Provider adapters call `globalThis.fetch` only — no other src/ imports.

Reverse direction: nothing in `src/features/` outside this dir touches the dispatcher. Specifically, none of `src/features/analysis/cycle-insight-emitter.js`, `insight-store-populator.js`, or any subscriber in `default-subscribers.js` references the dispatcher. Layer-3 is a clean greenfield.

## 9. Gaps + open questions

- **Stale filemap entry.** `st8-filemap.md` apparently lists only `dispatcher.js`. The `providers/` subdir of 222 LOC across 2 files is undocumented there. Verify and patch on next `docs/generate-filemap.js` run.
- **`opts.maxTokens` defaults differ silently** — anthropic adapter defaults to 1024, openai default not inspected here. Cross-provider parity audit overdue.
- **No timeout / abort.** Both adapters await `globalThis.fetch` with no `AbortSignal`. A slow LLM upstream blocks the event loop for the whole 8KB-body POST. Quick-win candidate (~10 LOC).
- **Crypto seam unverified.** Comment says `getSettingsByCategory` transparently decrypts `apiKey`. Did not trace through `persistence.js` `getSettingsByCategory` to confirm the decryption seam still works for the `models._entries[i].apiKey` path; assumed working because `llm-call-route.test.js` "happy path" passes.
- **Frontend wire-up missing.** `getLLMProviders()` is exposed but unconsumed (per `settings-and-providers.md:207`). `editEntry()` is a TODO (settings.js:251). Without these the `/api/llm-call` route has no human-driven entrypoint.
- **Hook constant for insight emission absent.** No `INSIGHT_RECORDED` / `INSIGHT_EMITTED` / `OPPORTUNITY_PROPOSED` constant exists. Layer-3 work starts here.
