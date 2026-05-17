# src/frontend/services — Data-Layer Audit (data-unblock pass 2)

Date: 2026-05-17
Agent: research-only
Scope: `/home/user/st8/src/frontend/services/`
Bible refs: batch 029 (settings-reader port), batch 030 (insight-system reality check), batch 031 (cycle pipeline + connection-resolver fix)

---

## 1. File inventory

| File | LOC | Origin | Status | Public global |
|---|--:|---|---|---|
| `coordination.js` | 294 | Hand-written; Wave 4D SSE-ified | LIVE | `window.St8Coordination` |
| `settings-reader.js` | 160 | Batch 029 (ported from `OGB/settings-reader.js.txt` + retired `state.js`) | LIVE | `window.St8SettingsReader` |

Total: 2 files, 454 LOC. Both load via `<script>` includes in `src/frontend/index.html` BEFORE their consumer components (script-order pattern).

**Historical clarification (corpus blind-spot rule, per batch 030):**

- The pre-refactor `services/state.js` was correctly retired (silent-divergence risk via duplicate `DEFAULT_VOIDFLOW`). It was *not* "dead code" — the capabilities (reactive subscriber, swappable adapter) were missing from `settings.js`. Batch 029 ported them cleanly into the new `settings-reader.js`, defaults staying in `settings.js`.
- Three prior "DEAD CODE" verdicts were applied to its predecessor (`state.js`) before it was correctly understood. Do not re-classify the current `settings-reader.js` as orphaned because callers look thin — it is the canonical data plumbing layer.
- The "OGB" gap is now closed; nothing else from `OGB/` needs porting.

---

## 2. Existing services + their subscriber APIs

### `window.St8SettingsReader` (batch 029)

```
loadAll()                  -> Promise<{status, data}>
persist(category, k, v)    -> Promise<boolean>           // true iff durable
addListener(cb)            -> cb({category, key, value}) // emits AFTER persist
removeListener(cb)
setAdapter(adapter)        // BackendAdapter (default) | MemoryAdapter (tests)
getAdapter()
BackendAdapter, MemoryAdapter   // exported ctors for advanced callers/tests
```

Contract: every observed change is durable. Failed persist does NOT emit (settings.js handles revert). Listener throws are isolated.

Adapters route through `window.st8AuthFetch` so `X-St8-Secret` is attached when present (forward-compat: `/api/settings` doesn't gate today, but the wrapper is in place).

### `window.St8Coordination` (Wave 4D, post-SSE)

```
loadManifest(path)         -> Promise<manifest|null>
startPolling(path)         // misnamed; opens /api/mutations SSE + initial fetch
stopPolling()              // closes ES + clears reconnect timer
addListener(cb)            -> cb(manifest); returns unsubscribe fn
compareManifests(old, new) -> {added, removed, statusChanged, intentChanged}
generateAiContext(manifest)-> string (AI prompt context)
getLastManifest(), getLastUpdate()
```

Built-in exponential reconnect (1s → 30s cap), idempotent start, EventSource-undefined degrade-to-bootstrap-fetch.

`startPolling` name is now a misnomer (SSE since Wave 4D). Kept for call-site compatibility with `app.js:626/640`.

---

## 3. Backend endpoints with NO service-layer wrapper

Routes (from `CLAUDE.md` table) and their service status:

| Route | Service wrapper? | Frontend caller |
|---|---|---|
| `/api/state` | NO | (none in frontend) |
| `/api/manifests` | NO | (none in frontend) |
| `/api/events` | NO | (none — `/api/mutations` is the used SSE channel) |
| `/api/mutations` | partial — `coordination.js` consumes; `app.js:1155` opens a SECOND EventSource | app.js + coordination.js |
| `/api/tickets` GET/POST | NO | `app.js:859` direct `st8AuthFetch` |
| `/api/tickets/count` | NO | (none located) |
| `/api/record-commit` | NO (server-side hook) | n/a |
| `/api/auth-token` | NO; bootstrap in `app.js:49` | app.js |
| `/api/signal-path` | NO | (none located; surfaced as gap in batch 028) |
| `/api/generate-report` | NO | (none located; "wedge" per batch 028) |
| `/api/insights` | NO | (none located) |
| `/api/identity-risk` | NO | (none located) |
| `/api/settings` | YES (`St8SettingsReader`) | settings.js delegates |
| `/api/connection-state.json` | partial (`St8Coordination` for SSE refresh) but app.js + file-explorer also fetch it directly | app.js x3, coordination.js |
| `/api/files`, `/api/index`, `/api/verify` | NO | file-explorer.js |
| `/api/exec` | NO | terminal.js |
| `/api/templates`, `/api/prd-projects` | NO | app.js (PRD wizard) |
| `/api/file-intent`, `/api/oscar-house` | NO | app.js |

Eight Wave-3+ endpoints have ZERO frontend consumer at all: `/api/state`, `/api/manifests`, `/api/events`, `/api/tickets/count`, `/api/signal-path`, `/api/generate-report`, `/api/insights`, `/api/identity-risk`. Three (`signal-path`, `generate-report`, `insights`) are the data-flow surfaces batch 030/031 just made accurate.

---

## 4. Components that call `/api/*` directly

Grep summary (outside `services/`):

| File:line | Endpoint | Method | Would benefit from |
|---|---|---|---|
| `app.js:245, 942, 982` | `/api/connection-state.json` | GET (3x direct) | `St8Coordination.fetchManifest()` (extract from current loadManifest) |
| `app.js:524` | `/api/templates` | GET | `St8PrdService` (new) |
| `app.js:549` | `/api/prd-projects` | POST | `St8PrdService` (new) |
| `app.js:859` | `/api/tickets` | POST | `St8TicketService` (new) |
| `app.js:920` | `/api/file-intent` | POST | `St8IntentService` or `St8Coordination` extension |
| `app.js:1071` | `/api/oscar-house` | POST | `St8LifecycleService` (new) |
| `app.js:1155` | `/api/mutations` (EventSource) | SSE | already in coordination.js — duplicate EventSource is a smell |
| `file-explorer.js:190` | `/api/files` | GET | `St8FilesService` (new) |
| `file-explorer.js:657` | `/api/index` | POST | `St8IndexService` or `St8FilesService` |
| `file-explorer.js:710` | `/api/verify` | POST | `St8FilesService` |
| `terminal.js:122` | `/api/exec` | POST | `St8ExecService` (low priority — single caller) |
| `settings.js:794` | `/api/settings?category=...` | DELETE | should route through `St8SettingsReader.delete()` (missing method) |

The most acute pattern: **`/api/connection-state.json` is fetched four times across the frontend** (app.js x3 + file-explorer's wiring path), with `coordination.js` already owning a cached `lastManifest`. Surfaces should be reading `St8Coordination.getLastManifest()` after a one-time start.

The settings.js DELETE at line 794 bypasses the reader entirely (the adapter has no delete affordance). This is an internal-consistency gap, not a missing service.

---

## 5. SSE / event-source handling

Two `EventSource('/api/mutations')` instances co-exist in the live frontend:

1. **`coordination.js:91`** — refresh trigger for the cached manifest, with full reconnect/backoff machinery (1s→30s). Owns no toasts. Started/stopped by workspace-switch logic in `app.js:626/640`.
2. **`app.js:1155`** — user-visible mutation toasts + constellation updates. Comment at app.js:331 explicitly acknowledges "the SAME `/api/mutations` stream the mutation toast handler uses."

Two ES instances on the same endpoint is functional but doubles server fan-out cost per tab and duplicates reconnect logic. Candidate for a single `St8EventBus` service that multiplexes subscribers over one EventSource. Not a bug today — flagged for the gap section.

No frontend code consumes `/api/events` (the alternative SSE endpoint declared in CLAUDE.md).

---

## 6. New service candidates

Ranked by data-flow leverage (highest first):

| Proposed service | Wraps | Justification |
|---|---|---|
| **`St8EventBus`** | single `/api/mutations` ES + typed event filtering | Eliminates duplicate EventSources; gives toast + manifest-refresh + future constellation-live both a clean subscribe API and consolidates reconnect logic. Highest impact, ~80 LOC. |
| **`St8GraphService`** | `/api/graph/deps`, `/api/graph/impacts` (when traversal-lazy lands — refactor-toolkit P1) | Constellation + future dependency views need these. Pre-wire the service so the lazy-path ticket can ship without UI scaffold churn. |
| **`St8InsightsService`** | `/api/insights` (Wave 3B), `/api/identity-risk` (Wave 3C) | Both consumers are batch-030/031 outputs. Today they have zero frontend readers — a tiny service makes adopting them in surfaces a one-liner. Critical for data-unblock pass 2 to deliver visible value. |
| **`St8SignalPathService`** | `/api/signal-path` (FOUNDER P1) | Batch 028 flagged a semantic-mismatch (route returns insight-store data, not signal paths). Wrapping in a service forces a contract decision before the next consumer arrives. |
| **`St8ReportService`** | `/api/generate-report` POST (Markdown / JSON) | Batch 028 "report wedge". A thin wrapper that exposes `generate(format)` + an event for "report available" would surface this to the UI. |
| **`St8TicketService`** | `/api/tickets`, `/api/tickets/count` | High-frequency surface; currently 1-2 direct callers but the count endpoint has none. Would also be the natural home for ticket-list subscription. |
| **`St8FilesService`** | `/api/files`, `/api/index`, `/api/verify`, `/api/connection-state.json` | Three file-explorer fetches + the manifest belong together. Could absorb `St8Coordination`'s manifest cache + extend it with per-file intent/identity. |

The pattern from batch 029 (BackendAdapter + MemoryAdapter + addListener) is the right template for all of these. Settings-reader's adapter swap unlocked the test suite; every new service should adopt the same shape so vm-sandboxed tests don't have to stub `fetch` per-call.

---

## 7. TOP 3 QUICK WINS

1. **Add `St8InsightsService` (~60 LOC).** Wraps `/api/insights` + `/api/identity-risk`. Following the batch-029 template (BackendAdapter + MemoryAdapter + addListener). Cost: low. Unblock: surfaces 300+ persisted insight rows that today have zero frontend readers. **Also resolves the gap that components have no way to consume batch 031's canonical-category emitter output.** This is the highest leverage move for the "data unblock" theme.

2. **Promote `/api/connection-state.json` reads to `St8Coordination.getLastManifest()`.** Replace the three direct `fetch('/api/connection-state.json')` in app.js (lines 245, 942, 982) with a one-time `St8Coordination.startPolling()` + `getLastManifest()` reads. Cost: ~30 minute refactor. Unblock: one cache instead of four parallel ones; aligns the constellation boot with the SSE refresh loop already running.

3. **Consolidate the two `/api/mutations` EventSources into `St8EventBus`.** Single ES, typed `subscribe(eventType, cb)` API. Coordination.js becomes a thin consumer (`bus.subscribe('FILE_AFTER_CHANGE', () => this.loadManifest())`). App.js mutation-toast handler becomes another consumer. Cost: ~120 LOC + careful migration. Unblock: halves server SSE fan-out per tab, removes duplicate reconnect logic, gives future surfaces (constellation live updates, ticket-count refresh) a zero-plumbing channel. This mirrors the `St8SettingsReader` listener pattern at the event-stream level.

---

## 8. Cross-directory dependencies

Inbound (who calls these services):

```
src/frontend/index.html       <script> loads both services BEFORE components
src/frontend/app.js           lines 49, 245, 297, 307, 315, 318, 626, 627, 639, 640
src/frontend/components/settings/settings.js  lines 298, 304, 308, 310, 319, 320, 322
```

Outbound (what services depend on):

```
window.st8AuthFetch           defined in src/frontend/app.js (boot)
                              consumed by settings-reader.js BackendAdapter
window.EventSource            browser global; coordination.js degrades if absent
window.fetch                  coordination.js (raw fetch — does not go through authFetch
                              because /api/connection-state.json is a static JSON GET, no
                              secret required)
```

Tests:

```
tests/frontend/services/settings-reader.test.js     17 tests (batch 029)
tests/frontend/settings-module.test.js              30 tests; sandboxes the reader
```

No dedicated coordination.js test file located (the SSE machinery is exercised indirectly).

---

## 9. Gaps + open questions

1. **No service for the three Wave-3+ output endpoints** (`/api/insights`, `/api/identity-risk`, `/api/signal-path`). Batch 031 just made the underlying data accurate; without a service wrapper, the frontend has no on-ramp to display it. This is the central gap for data-unblock pass 2.

2. **`/api/signal-path` semantic mismatch** (batch 028 finding, still open). The route returns insight-store data rather than signal paths. A service wrapper either resolves the naming or surfaces the mismatch to consumers cleanly. Open question: rename route, or keep route + have service expose `getInsights()` rather than `getSignalPath()`?

3. **Duplicate `/api/mutations` consumers.** Two EventSources, two reconnect loops. Not broken today; would benefit from `St8EventBus` consolidation.

4. **`St8SettingsReader` has no `delete()` method** even though `settings.js:794` DELETEs settings directly. Adapter contract gap — should `MemoryAdapter` support delete for test parity?

5. **`coordination.js:startPolling` misnomer.** It opens an SSE stream, not a poll. Rename to `start()`/`stop()` would clarify; current name is back-compat-driven.

6. **No graph service yet** (refactor-toolkit P1 traversal-lazy is upcoming). Pre-creating `St8GraphService` would let the lazy-path ticket ship without UI scaffold churn — bind it now so consumers exist when the endpoints land.

7. **Coordination addListener has no listeners today.** Comment at line 17 acknowledges "today the `loadManifest -> notifyListeners` path runs even with zero listeners so adding one later is a pure subscribe operation." Constellation init in `app.js:254` is the obvious candidate (current pattern: one-shot fetch on boot, never refreshed) — this would be a third quick-win-adjacent move.

8. **No test for `coordination.js`** (cf. 17-test suite for `settings-reader.js`). If `St8EventBus` consolidation lands, this becomes more important to backfill.

9. **`/api/state` + `/api/manifests` 404 vs. CLAUDE.md** (batch 028 finding). Until the route disposition is decided, no service should wrap them.
