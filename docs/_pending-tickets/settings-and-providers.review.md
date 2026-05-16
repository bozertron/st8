# Settings-and-Providers Review

## Wave 5C Review

Reviewer: wave-5c-reviewer
Reviewed commits: 4983772, de7f5d8, b13c39e, d0baf2c
Baseline before: 271 tests. After 5C: 292 tests. Delta: +21. Suite: 292 pass / 0 fail / 0 skip / 0 todo.

### Ticket 3 (lock-step assertion) — ACK
- IIFE `_assertCategoriesMatchDefaults` at settings.js:422 sorts both key sets and throws (also `console.error`s) on mismatch. Runs at module load — NOT lazy.
- Tests inject a mutated source via vm-sandbox to prove the throw path: extra category id (line 87) and extra DEFAULT_SETTINGS key (line 100). Both real probes (mutation actually changes SRC, then assert.throws).

### Ticket 4 (type coercion) — ACK
- `coerceSettingValue` at settings.js:447 handles every primitive cross-type path: string→number, string→boolean, primitive→string, JSON-string→object. Garbage values (e.g. `'definitely not a number'` for `reveal_wpm`) fall back to `defaults[key]` and emit `console.warn` with type-mismatch message. No silent corruption.
- 6 tests cover happy path, fallback-with-warn, pass-through, unknown key, array category passthrough, and the `coerceCategoryValues` mapper. Each test is a real probe, not assert.ok(true).
- Wired into both `loadSettings()` (post-migration) and `renderCategoryEntries()` (before the typeof branch).

### Ticket 5 (migration map) — ACK
- `SETTINGS_KEY_MIGRATIONS` at settings.js:513 is a plain `{ 'category.oldKey': 'newKey' }` map, currently empty. `migrateCategoryKeys` runs at load before coercion. Re-persists under the new key and best-effort DELETEs the old (`.catch(()=>{})` is acceptable as best-effort and not a silent-failure cheat — the next read won't surface the old key).
- New-key-wins-on-collision branch is real: tests patch SRC to seed one migration and verify (a) rename, (b) no-clobber when new key already present.
- Schema-level framework deferral to persistence roadmap P1.1 — appropriate, not a cheat.

### Ticket 7 (theme audit) — ACK
- Outcome (b) chosen: comment block above `theme:` (settings.js:84-97) names absent consumers (`palette_overrides`, `font_sizes`, `spacing_scale`), points to roadmap P2.3, and warns against deletion. Confirmed `docs/_pending-roadmap/settings-and-providers.md` line 60 contains `### P2.3 Apply theme tokens` — the pointer is live.

### Ticket 8 (category enum) — ACK
- `ALLOWED_SETTINGS_CATEGORIES` at app.js is `Object.freeze`d, 8 ids matching frontend exactly.
- `_handleSettings` POST branch returns 400 with `{error:'unknown settings category', category, allowed}` body.
- Drift test regex is bounded: first matches `const SETTINGS_CATEGORIES = [...]` block, then extracts `id: '<name>'` only from inside that captured group. Tight.
- **MUTATION PROBE**: removed `'network'` from ALLOWED_SETTINGS_CATEGORIES; ran the test file: 2 of 7 failed (the drift `deepEqual` test and the count assertion `>= 8`). Restored. Mutation probe PASSED.

### Ticket 9 (Promise<boolean> revert) — ACK
- `_persistSetting` returns Promise<boolean>: `true` on `res.ok`, `false` on non-2xx, `false` on network error (warn + return). Real revert logic in `updateValue` (settings.js:228): snapshots `hadKey` + `prevValue`, applies optimistically, awaits, on `false` deletes the key if it didn't exist before or restores prev, then `renderCategoryEntries()` to re-render. Returns the Promise so callers/tests can chain.
- Direct unit test for the revert path is indirect (DOM-coupled), but the persist Promise contract is exercised by the migration tests and the backend ticket-8 reject path is fully covered. Acceptable.

### Verdicts
All six 5C tickets: ACK. No kickbacks. Safe to proceed to 5D (frontend LLM UI work, tickets 1/2/6).

## Wave 5D Review

Reviewer: wave-5d-reviewer
Reviewed commits: a7f7073, 0d0f42b, 2f8fe89
Baseline before: 292 tests. After 5D: 308 tests. Delta: +16. Suite: 308 pass / 0 fail / 0 skip / 0 todo.

### Ticket 6 (getLLMProviders consumer / buildProviderOptions) — ACK
- `buildProviderOptions(selectedId)` at settings.js:763 is a pure helper. It walks `LLM_PROVIDERS` via `.map()` and emits one `<option value="<id>"<sel>><name></option>` per registry entry — no hardcoded provider IDs, no enum duplication. Selected attribute applied only when `p.id === selectedId`.
- Consumed inside `_renderEditEntryForm` (settings.js:427) for the provider field — live caller, registry no longer a dead export.
- 4 new tests are real probes: (a) one option per provider with HTML-escaped name, (b) `selected` attribute applied to exactly one matching id, (c) unknown id → zero selected (graceful), (d) public `getLLMProviders()` returns the same list internal helper consumes (parity check).

### Ticket 0 (real editEntry form) — ACK
- `MODEL_ENTRY_SCHEMA` at settings.js:73 declares exactly the 7 documented fields: id, name, provider, model, apiKey, baseUrl, enabled. `ENTRY_SCHEMAS` map registers per-category schemas, extensible for future sirkits/shells editors.
- **apiKey masking confirmed in SOURCE**: MODEL_ENTRY_SCHEMA line 78 has `type: 'password', sensitive: true`. Renderer branch at settings.js:435 emits `<input type="password" ... autocomplete="new-password" spellcheck="false" ...>` — all three masking attributes present.
- **apiKey masking confirmed in TEST**: tests/frontend/settings-module.test.js:217 asserts both `apiKeyField.type === 'password'` and `apiKeyField.sensitive === true` as a "security invariant".
- `editEntry` validates schema-registered + index-in-range; warns + returns on miss. Snapshots both `.snapshot` and `.draft` via `JSON.parse(JSON.stringify(...))` deep-clone — verified by the bleed test (mutate draft.apiKey, live entry untouched).
- `updateEditField` writes draft only; verified by test that mutates `apiKey` to `'new-secret'` and asserts `entries.models[0].apiKey === ''`.
- `cancelEdit` clears `editingEntry`, re-renders the list, does NOT POST — verified by test asserting fetchCalls has no POST after cancel.
- `saveEntry` returns `Promise<boolean>`. Success path: optimistic `arr[i] = draft`, await `_persistArrayEntries` (POSTs `{category, key:'_entries', value: array}` shape), on `true` clear editingEntry + re-render. Failure path: revert `arr[editing.index] = prev`, call `_showEditError` with inline `.settings-edit-error` UI, return false. Test forces fetch to return `{ok:false, status:400}` and asserts (a) returned `false`, (b) live entry reverted to `'orig'`.
- `unwrapArrayCategory` at settings.js:710 detects `{_entries:[...]}` shape and returns bare array so the `Array.isArray` branch in renderer fires. Verified by loadSettings round-trip test injecting the wrapped shape and asserting the unwrapped state. POJO categories (voidflow) untouched.
- CSS: `.settings-edit-actions` + `.settings-edit-error` present at settings.css:221 and 227.
- **MUTATION PROBE PASSED**: temporarily changed apiKey schema entry from `type: 'password'` to `type: 'text'`. Re-ran settings-module test file: 2 tests failed (test 15 "apiKey field is marked sensitive and uses type=password" AND test 16 "buildModelEntryFields resolves a full entry into typed field descriptors" which asserts `byKey.apiKey.type === 'password'`). Restored. Mutation probe genuinely catches a type weakening.

### Verdicts
Both 5D tickets: ACK. No kickbacks. Safe to proceed to 5E (backend LLM call route + apiKey crypto-at-rest, tickets 1 + 2). The frontend now feeds a real schema-aware editor with masked apiKey, validated provider, and proper revert-on-failure — backend can assume well-formed `{provider, apiKey, model}` entries arriving via the `_entries` array POST.

## Wave 5E Review

Reviewer: wave-5e-reviewer
Reviewed commits: 8e806ea (encryption), cdfae98 (route)
Baseline before: 308 tests. After 5E: 337 tests. Delta: +29. Suite: 337 pass / 0 fail / 0 skip / 0 todo.

### Ticket 2 (apiKey encryption at rest) — ACK
- `src/shared/utils/settings-crypto.js` uses aes-256-gcm via `crypto.createCipheriv`. 12B random IV (line 126), 16B authTag retrieved via `cipher.getAuthTag()` (line 129). Format `ivB64:tagB64:ctB64` (line 130) — matches the prompt spec exactly.
- `ensureKey()` (line 78) generates 32B random key, writes tmp+rename with explicit `mode: 0o600` (line 105), defensive `chmodSync(..., 0o600)` after (line 106) for FS where mode-on-write was ignored. Cache keyed by absolute path so multi-temp-dir tests don't collide.
- `isCiphertext()` does shape check + canonical base64 round-trip (lines 199-200) — rejects `foo:bar:baz`-style strings that have 3 colon-separated segments but aren't actual base64. Verified by test at settings-encryption.test.js:68.
- Persistence seam at persistence.js:1198 (`_encryptModelEntries`) and :1225 (`_decryptModelEntries`) intercepts only category='models'. `upsertSetting` (line 1252) encrypts on write, `getSetting` / `getSettingsByCategory` / `getAllSettings` symmetrically decrypt on read. Non-models pass through verbatim — verified by test 7.
- Corrupt ciphertext surfaces literal `'[decrypt-failed]'` rather than throwing (persistence.js:1240) — one bad row cannot DoS `/api/settings`. Verified by test 8.
- **LIVE DB PROBE**: fresh DB at `/tmp/st8-5e-probe/.st8/st8.sqlite`. Wrote entry with `apiKey='sk-ant-PROBE-KEY-MUST-BE-CIPHERTEXT'`, then read raw row via better-sqlite3 readonly. RAW ROW: `[{"id":"a",...,"apiKey":"IGpUd/6aI6GpemA3:jaHRzAFq5zXoWQRak8h7qw==:UK659F4hA5ZdLKQmlOiq3mrv/N6m7kGmUqdBXx/ZuhUgFyc="}]`. **PLAINTEXT FOUND: false**. The literal apiKey is absent from the on-disk row.
- **KEY FILE MODE PROBE**: `stat -c '%a' /tmp/st8-5e-probe/.st8/.st8/encryption.key` → **600**. Note: keyPathFor places the key at `<dbDir>/.st8/encryption.key`, so when dbPath itself contains `.st8/` the key lands at `.st8/.st8/encryption.key`. Functional but the doubled `.st8/` is mildly awkward — not a kickback (it matches the documented behavior).
- Idempotency test at settings-encryption.test.js:149 re-upserts an already-ciphertext entry and asserts no double-encryption. The `isCiphertext()` gate at persistence.js:1205 short-circuits before re-encrypt.
- Targeted tests: 9/9 pass.

### Ticket 1 (/api/llm-call route + adapters) — ACK
- Route handler at app.js:2317 (`_handleLlmCall`): method check (405), auth gate via `auth.checkRequest` (401 on miss), 8KB body cap → 413 (line 2346), JSON parse → 400, entryId+prompt validation → 400, load via `persistence.getSettingsByCategory('models')` (the decrypt seam), 404 on missing id, dispatch via `src/features/llm/dispatcher.js`, response status mapped from `result.status`.
- Adapters at `src/features/llm/providers/anthropic.js` and `openai.js` both use `globalThis.fetch` (anthropic.js:71, openai.js:71) — Node 18+ built-in, no SDK deps. URL/headers/body match documented Anthropic + OpenAI shapes. Network failures surface as `{ok:false, status:0, error}` not silent.
- Dispatcher at `src/features/llm/dispatcher.js`: SUPPORTED_PROVIDERS = anthropic + openai; STUB_PROVIDERS = google + ollama + lmstudio + openrouter + custom return 501 with a roadmap pointer (lines 80-88). Verified by providers-adapters.test.js:224 which also asserts NO fetch is called for stub providers (line 239).
- Env-var fallback at dispatcher.js:62 — empty entry.apiKey reads from `process.env[PROVIDER_ENV_KEYS[provider]]`.
- Tests use `globalThis.fetch` override (route test line 95-97 installs + returns restore). NO real network calls — verified by reading both test files.
- **DECRYPT-ROUTING PROBE in test**: llm-call-route.test.js:183-234. Pre-condition assertion at line 197: `rawRow.indexOf(PLAINTEXT_KEY) === -1` (raw DB row does NOT contain plaintext). Post-call assertion at line 232: `captured.init.headers['x-api-key'] === PLAINTEXT_KEY` (the mocked-fetch saw the decrypted key). Real two-sided probe.
- **MUTATION PROBE PASSED**: temporarily replaced `getSettingsByCategory('models')` in app.js:2378 with `_getRawSetting('models', '_entries')` (bypassing decrypt). Re-ran llm-call-route.test.js: test 7 (happy-path decrypt-routing probe) FAILED — mocked fetch saw the ciphertext, not PLAINTEXT_KEY. Restored. The decrypt step is genuinely load-bearing.
- Adapter + route tests: 20/20 pass.

### Verdicts
Both 5E tickets: ACK. No kickbacks. No deferrals at the ticket level (5 deferred providers are correctly stubbed to 501 with a live roadmap pointer to P1.2 — verified the dispatcher returns the right shape and tests assert no fetch fires).

## Cluster Summary

Settings-and-providers cluster — 10 tickets total across 3 sub-waves:

- **5C**: 6 ack / 0 kickback / 0 defer (lock-step assertion, type coercion, migration map, theme audit, category enum, promise<boolean> revert)
- **5D**: 2 ack / 0 kickback / 0 defer (real editEntry form, buildProviderOptions consumer)
- **5E**: 2 ack / 0 kickback / 0 defer (apiKey encryption at rest, /api/llm-call route + adapters)

**Cluster total: 10 ack / 0 kickback / 0 defer.**

Tests: 271 (pre-cluster) → 337 (post-5E). Delta: +66 across the cluster.

End-to-end story now complete: user opens settings → fills out a models entry via the schema-aware editor → apiKey lands ciphertext on disk → POSTs to /api/llm-call → backend decrypts → routes to provider adapter → real fetch to anthropic/openai → response surfaces in UI. Five providers are stubbed at 501 with a roadmap pointer for future drops. No work was deferred outside the cluster's own roadmap (P1.2, P2.3) — those pointers are live and verified.

Cluster ready to close.
