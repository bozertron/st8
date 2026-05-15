# Settings & Providers

The settings cluster is st8's schema-agnostic key-value configuration layer. It persists JSON values in a single SQLite table (`st8_settings`), exposes them through one HTTP route (`/api/settings`), and renders them through one front-end module (`src/frontend/components/settings/settings.js`). The cluster also owns the `LLM_PROVIDERS` registry — the foothold that batch 025 laid down for future model-call integration.

---

## Architecture

```
[ Settings Panel UI ]
       │
       │  toggle / input change
       ▼
window.St8Settings.updateValue(category, key, value)
       │
       ▼
_persistSetting(category, key, value)
       │  POST /api/settings  { category, key, value }
       ▼
src/core/server/app.js  →  _handleSettings(req, res, url)        (~line 430)
       │
       ▼
src/core/database/persistence.js  →  upsertSetting(category, key, value)
       │
       ▼
SQLite st8_settings  (PRIMARY KEY (category, key))
```

The flow is symmetric in reverse for reads: `loadSettings()` → `GET /api/settings` → `persistence.getAllSettings()` → category-keyed POJO returned to the front end and merged into `settingsState.entries`.

### The `st8_settings` table

Defined in `src/core/database/persistence.js` around line 132:

```sql
CREATE TABLE IF NOT EXISTS st8_settings (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category, key)
);
```

`value` is stored as TEXT. Non-string values are `JSON.stringify`'d on the way in (`upsertSetting`, line ~622) and `JSON.parse`'d on the way out (`getSetting`/`getSettingsByCategory`/`getAllSettings`, lines ~630–656), falling back to the raw string on parse failure. There is no schema discrimination — any category+key+value triple is acceptable.

### The `/api/settings` route

`_handleSettings` in `src/core/server/app.js` (line 430) supports:

- `GET /api/settings` — return all settings as a `{ category: { key: value } }` POJO.
- `GET /api/settings?category=voidflow` — return one category's flat key/value map.
- `POST /api/settings` body `{ category, key, value }` — upsert one cell. Validates that `category` and `key` are non-empty; otherwise returns 400.
- Body size cap: 1 KB. A larger body returns 413 and the request is destroyed.
- Other methods → 405.

The handler opens a fresh `St8Persistence` instance per request and closes it in `finally` (or on client `close`). Errors return JSON `{ error }` with 500.

---

## The 8 categories

Defined in `SETTINGS_CATEGORIES` (settings.js line 15). Each is a top-level key in `DEFAULT_SETTINGS`:

| id | name | icon | description | DEFAULT shape |
|---|---|---|---|---|
| `sirkits` | SIRKITS | ◇ | Spawnable surfaces in the void | `[]` (array of entries) |
| `models` | MODELS | ◇ | LLM integrations | `[]` (array of entries) |
| `shells` | SHELLS | ◇ | Phreak terminal sessions | `[]` (array of entries) |
| `voidflow` | VOIDFLOW | ◇ | Drift / caret / reveal tunables | POJO (7 keys) |
| `keybindings` | KEYBINDINGS | ◇ | Keyboard shortcuts | `[]` (array of entries) |
| `theme` | THEME | ◇ | Visual customization | POJO (`palette_overrides`, `font_sizes`, `spacing_scale`) |
| `storage` | STORAGE | ◇ | Database and file storage | POJO (`sqlite_path`, `backup_schedule`, `export_targets`) |
| `network` | NETWORK | ◇ | EPO bus and connections | POJO (`epo_bus_endpoint`, `ports`, `proxies`, `websocket_retry_policy`) |

The UI renderer (`renderCategoryEntries`, settings.js line 129) branches on `Array.isArray(entries)`:

- **Array categories** → an entry list with EDIT / DUPLICATE / ADD NEW affordances.
- **POJO categories** → a flat form. Field type is inferred from `typeof value`:
  - `boolean` → `<select>` TRUE / FALSE
  - `number` → `<input type="number">`
  - anything else → `<input type="text">`

There is no schema beyond the current value's runtime type.

### `DEFAULT_SETTINGS` shape

```js
{
  voidflow: { reveal_wpm: 200, word_atomic: true, pause_on_drag: true,
              buffer_trail_visible: true, reveal_curve: 'linear',
              drift_rate_lines_per_sec: 0.25, cursor_metronome: true },
  sirkits: [], models: [], shells: [], keybindings: [],
  theme: { palette_overrides: {}, font_sizes: {}, spacing_scale: 1.0 },
  storage: { sqlite_path: 'st8.sqlite', backup_schedule: 'daily', export_targets: [] },
  network: { epo_bus_endpoint: 'ws://localhost:3847', ports: {}, proxies: [],
             websocket_retry_policy: 'exponential' }
}
```

---

## The LLM_PROVIDERS registry

Added in batch 025 as the canonical source of truth for which LLM back-ends a `models` entry can declare. Defined at `settings.js` line 44:

| id | name | docsUrl | envKey |
|---|---|---|---|
| `anthropic` | Anthropic | https://docs.anthropic.com | `ANTHROPIC_API_KEY` |
| `openai` | OpenAI | https://platform.openai.com/docs | `OPENAI_API_KEY` |
| `google` | Google (Gemini) | https://ai.google.dev/docs | `GOOGLE_API_KEY` |
| `ollama` | Ollama (local) | https://github.com/ollama/ollama | `null` (local) |
| `lmstudio` | LM Studio (local) | https://lmstudio.ai/docs | `null` (local) |
| `openrouter` | OpenRouter | https://openrouter.ai/docs | `OPENROUTER_API_KEY` |
| `custom` | Custom (URL) | `null` | `null` (BYO) |

Exposed publicly via `window.St8Settings.getLLMProviders()`. Read-only by convention.

### The `models` entry schema

Documented in the header comment above `LLM_PROVIDERS`:

```js
{
  id:        '<stable-id>',                // user-chosen short slug
  name:      '<display name>',
  provider:  '<one of LLM_PROVIDERS.id>',
  model:     '<provider-specific model name>',  // e.g. 'claude-sonnet-4-6'
  apiKey:    '<opaque, server-side validated>', // optional — env var if blank
  baseUrl:   '<override>',                       // optional — for self-hosted
  enabled:   true | false
}
```

The provider abstraction is plumbed end-to-end on the data side. The UI side is **not yet wired** — see "Caveats" and the tickets.

---

## Public API surface

`window.St8Settings` (settings.js line 362):

| Method | Purpose |
|---|---|
| `showSettingsPopup()` | Modal overlay variant |
| `showSettingsInExplorer()` | Inline variant inside the explorer chrome |
| `selectCategory(id)` | Switch active category, re-render main pane |
| `updateValue(cat, key, value)` | Mutate state + persist via POST |
| `addEntry(cat)` | Push a stub `{id:'new-entry', name:'New Entry'}` onto an array category |
| `editEntry(cat, index)` | **TODO** — currently only logs |
| `duplicateEntry(cat, index)` | Deep-clone an entry and append `(copy)` to its name |
| `loadSettings()` | GET `/api/settings`, merge into state |
| `getCategories()` | Return `SETTINGS_CATEGORIES` |
| `getDefaults()` | Return `DEFAULT_SETTINGS` |
| `getLLMProviders()` | Return `LLM_PROVIDERS` |

---

## How to extend

### Add a new setting to an existing POJO category

One file, one line. Append `my_new_setting: <default>` to the right object inside `DEFAULT_SETTINGS` (settings.js line 67). The UI auto-renders the field with the appropriate input type based on `typeof <default>`.

### Add a new category

Two edits in one file (`settings.js`):

1. Add `{ id, name, icon, description }` to `SETTINGS_CATEGORIES`.
2. Add a matching top-level key to `DEFAULT_SETTINGS` (`[]` for entry-list categories, a POJO for flat form categories).

The retired `state.js` once duplicated `DEFAULT_VOIDFLOW`, but with state.js out of the picture there is now exactly **one** declaration site. The founder has flagged that **`SETTINGS_CATEGORIES` ↔ `DEFAULT_SETTINGS` must stay in sync manually** — a typo means the UI silently renders an empty form for the missing key.

### Add a new LLM provider

One line in `LLM_PROVIDERS` (settings.js line 44):

```js
{ id: 'mistral', name: 'Mistral', docsUrl: 'https://docs.mistral.ai', envKey: 'MISTRAL_API_KEY' },
```

That is the entire registry change. The actually-bigger work — surfacing the provider in an editEntry form and routing a chat call through it — has no UI or backend yet.

---

## The retired `state.js`

Originally `vendor/settings-reader.js`, moved into `src/frontend/services/state.js` during batch 012's frontend reorganization. It was a 114-line settings persistence layer built around a `SettingsReader` class with a swappable storage adapter (default: `LocalStorageAdapter` against `localStorage`). It seeded `DEFAULT_VOIDFLOW` and exposed `window.st8Settings` as a live POJO with a change-event subscriber pattern.

It was **never wired**: no `<script src="…/state.js">` in `index.html`, no consumer in the app code. Batch 025 retired it because:

- The name `state.js` was confusingly close to the unrelated `connection-state.json` (the indexer manifest).
- It carried its own copy of `DEFAULT_VOIDFLOW`, duplicating `settings.js`'s defaults. If anyone later imported it, the two copies would silently diverge.
- It had been dead since at least batch 012.

The file now lives at `/home/user/st8/OGB/src/frontend/services/state.js.txt` for historical reference only. Do not re-introduce it without first deleting the duplicated default block.

---

## Caveats

- **No validation.** Any string can be a category name, any JSON value can be stored. A typo in a category id silently breaks UI rendering (the form looks empty).
- **No migration.** `DEFAULT_SETTINGS` shape changes don't migrate existing rows. Renaming `reveal_wpm` to `reveal_words_per_minute` would orphan the old row and ignore the new key.
- **Type sniffing from current value.** The UI infers field type from `typeof settingsState.entries[cat][key]`. If the persisted JSON value is `"200"` instead of `200`, the rendered control collapses to a text input.
- **`apiKey` is plaintext.** A user-supplied `apiKey` in a `models` entry goes through POST → `JSON.stringify` → SQLite TEXT. No encryption, no env-only mode, no warning.
- **`editEntry()` is a TODO** (settings.js line 251). Today there is no form to actually populate a `models` entry's `provider` / `apiKey` / `baseUrl` fields. `addEntry()` only inserts the stub `{id:'new-entry', name:'New Entry'}`.
- **`getLLMProviders()` has no consumer.** The registry is exposed but nothing in the codebase calls it yet.
- **Theme tokens render but aren't applied.** `palette_overrides`, `font_sizes`, `spacing_scale` accept values but no CSS variable is wired to read them.
- **No backend route can actually call an LLM.** There is no `/api/llm-call` or `/api/chat`. Even a fully-populated `models` entry leads nowhere.

---

## Files in scope

- `/home/user/st8/src/frontend/components/settings/settings.js` — UI + `LLM_PROVIDERS` + `DEFAULT_SETTINGS` + `SETTINGS_CATEGORIES` + public API
- `/home/user/st8/src/frontend/components/settings/settings.css` — panel styling (extracted in batch 013)
- `/home/user/st8/src/core/server/app.js` — `_handleSettings` (line 430)
- `/home/user/st8/src/core/database/persistence.js` — `st8_settings` schema (line 132); `upsertSetting`/`getSetting`/`getSettingsByCategory`/`getAllSettings`/`deleteSetting` (lines 622–660)
- `/home/user/st8/OGB/src/frontend/services/state.js.txt` — retired `SettingsReader` (reference only)
- Bible: batch 012 (frontend-components move, settings.js relocated), batch 025 (LLM_PROVIDERS added, state.js retired)
