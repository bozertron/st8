# Roadmap — Settings & Providers

The settings cluster is data-complete and UI-incomplete. Categories, defaults, persistence, and the LLM provider registry are all in place. What's missing is the human-facing edge (a real entry editor) and the consumer edge (an actual LLM call path). This roadmap is ordered so the smallest unlock that lets a user send a prompt to a model ships first.

---

## P1 — unlocks the LLM loop

### P1.1 Build `editEntry()` for `models` entries

`src/frontend/components/settings/settings.js` line 251. Replace the `console.info` stub with a real form that renders fields against the `models` entry schema documented at line 33:

- `name` — text input
- `provider` — `<select>` populated from `window.St8Settings.getLLMProviders()` (the dropdown is the entire reason `LLM_PROVIDERS` exists)
- `model` — text input (provider-specific; no validation yet)
- `apiKey` — `<input type="password">`, with a "use env var (`{envKey}`)" toggle when the selected provider has one
- `baseUrl` — text input, optional (for `custom` / self-hosted `ollama` / `lmstudio`)
- `enabled` — boolean select

On Save, mutate `settingsState.entries.models[index]`, POST the full array via `updateValue('models', '...', ...)` (or migrate to a per-entry upsert), and re-render the list.

This is the smallest deliverable that turns `LLM_PROVIDERS` from plumbing into a product.

### P1.2 Add `/api/llm-call` (or `/api/chat`)

`src/core/server/app.js`. New route that takes `{ modelEntryId, prompt, ...opts }`, resolves the entry from `persistence.getSettingsByCategory('models')`, picks the right provider adapter (a new `src/core/llm/providers/{anthropic,openai,google,ollama,lmstudio,openrouter,custom}.js` directory), and returns the completion (streamed if the provider supports it).

Provider adapters should each export a single `call({ model, apiKey, baseUrl, prompt, opts })` function so the dispatch is a one-line switch on `entry.provider`. The `apiKey` fallback to `process.env[LLM_PROVIDERS[entry.provider].envKey]` lives in the dispatcher.

This is what the founder described as "the send-to-LLM loop." Until it lands, the entire `models` category is a database exercise.

### P1.3 Wire the shelf's middle slot to a chat input

Cross-cluster with **frontend-experience**. The current shelf middle is empty. Drop in a chat input that:

- Reads `settingsState.entries.models` and offers the user a dropdown of `enabled: true` entries.
- POSTs to `/api/llm-call` (P1.2) with the selected entry's id + the typed prompt.
- Renders the streamed response inline.

P1.1 + P1.2 + P1.3 together is the first end-to-end "configure provider → send prompt → see output" path in st8.

---

## P2 — robustness around the new loop

### P2.1 Schema migration framework for settings

`src/core/database/persistence.js`. Add a `_settings_migrations` table (or extend an existing migrations track) so renaming a `DEFAULT_SETTINGS` key (e.g. `reveal_wpm` → `reveal_words_per_minute`) carries the old row's value to the new key instead of orphaning it. Per-category migration functions keyed by from/to settings-shape versions.

### P2.2 Encrypted secret storage for `apiKey`

Today `models[].apiKey` lands plaintext in `st8.sqlite`. Options, in order of effort:

- **Easy**: env-only mode. If `LLM_PROVIDERS[provider].envKey` is non-null, refuse to persist a user-typed `apiKey`; instead store `apiKey: null` and read `process.env[envKey]` at call time. The UI shows "(using env var)" greyed in the field.
- **Better**: symmetric encryption at rest with a key derived from a user-set passphrase (prompted on first run, cached in-memory only).
- **Best**: OS keychain integration (`keytar` or equivalent) for the master key.

Pick the cheapest that the founder will accept; the plaintext status quo should not survive contact with a real `apiKey`.

### P2.3 Apply theme tokens

`DEFAULT_SETTINGS.theme` currently has `palette_overrides`, `font_sizes`, `spacing_scale` that nothing reads. After `loadSettings()` resolves, walk `theme.palette_overrides` and write each entry as a CSS custom property on `document.documentElement` (e.g. `--pink-override`). Wire `spacing_scale` to a `--scale` variable that the existing `var(--space-N)` tokens multiply through. Hide the theme category, or label it "preview only," until this is wired.

### P2.4 Sync check at module load

Tiny safety belt for the manual `SETTINGS_CATEGORIES` ↔ `DEFAULT_SETTINGS` contract. At the bottom of `settings.js`:

```js
(function _assertCategoriesMatchDefaults() {
    var catIds = SETTINGS_CATEGORIES.map(function(c){return c.id;}).sort();
    var defKeys = Object.keys(DEFAULT_SETTINGS).sort();
    if (catIds.join(',') !== defKeys.join(',')) {
        console.error('[st8] SETTINGS_CATEGORIES / DEFAULT_SETTINGS mismatch:',
                      { catIds: catIds, defKeys: defKeys });
    }
})();
```

### P2.5 Type validation on render

`renderCategoryEntries` should coerce/check `typeof entries[key]` against `typeof DEFAULT_SETTINGS[category][key]` and warn (or coerce) on mismatch before rendering. Prevents the `"200"` vs `200` rendering collapse from being silent.

---

## P3 — instrumentation and ergonomics

### P3.1 `providers` SQLite table for call telemetry

Once `/api/llm-call` exists, add a `provider_calls` table: `{id, modelEntryId, provider, model, promptHash, latencyMs, tokensIn, tokensOut, error, timestamp}`. Lets the founder later answer "which provider broke last Tuesday" and "what's my OpenAI burn rate" without standing up a separate observability stack.

### P3.2 Settings export / import

Two new routes: `GET /api/settings/export` → full JSON dump of `st8_settings`. `POST /api/settings/import` → upserts each row. Useful for moving config between machines and for support. Strip `apiKey` fields on export by default (with an explicit `?includeSecrets=true` opt-in that prints a warning).

### P3.3 Per-category schema docs in the UI

Each category panel could show a small `?` that opens the schema doc inline — what each field means, valid ranges, what consumes the value. The schemas live in `DEFAULT_SETTINGS` shapes anyway; the doc strings can live next to them.

---

## Priority distribution

- **P1**: 3 items (editEntry UI, /api/llm-call backend, shelf chat input)
- **P2**: 5 items (migrations, secret storage, theme application, category↔defaults assertion, type validation)
- **P3**: 3 items (provider_calls table, export/import, schema docs in UI)
