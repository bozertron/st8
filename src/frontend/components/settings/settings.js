/* ═══════════════════════════════════════════════════════════════
   ST8 SETTINGS — Configuration UI
   ═══════════════════════════════════════════════════════════════

   Schema-driven settings UI for st8 configuration.
   Categories: Sirkits, Models, Shells, Voidflow, Keybindings, Theme, Storage, Network

   Public API: window.St8Settings
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── SETTINGS CATEGORIES ─────────────────────────────────────

const SETTINGS_CATEGORIES = [
    { id: 'sirkits', name: 'SIRKITS', icon: '◇', description: 'Spawnable surfaces in the void' },
    { id: 'models', name: 'MODELS', icon: '◇', description: 'LLM integrations' },
    { id: 'shells', name: 'SHELLS', icon: '◇', description: 'Phreak terminal sessions' },
    { id: 'voidflow', name: 'VOIDFLOW', icon: '◇', description: 'Drift / caret / reveal tunables' },
    { id: 'keybindings', name: 'KEYBINDINGS', icon: '◇', description: 'Keyboard shortcuts' },
    { id: 'theme', name: 'THEME', icon: '◇', description: 'Visual customization' },
    { id: 'storage', name: 'STORAGE', icon: '◇', description: 'Database and file storage' },
    { id: 'network', name: 'NETWORK', icon: '◇', description: 'EPO bus and connections' }
];

// ─── LLM PROVIDER REGISTRY ───────────────────────────────────
//
// Canonical list of provider IDs that a `models` entry can declare via its
// `provider` field. Adding a new provider here is the single source of
// truth — the model-entry editor will read this list to populate its
// provider dropdown.
//
// Schema for a `models` entry (used in DEFAULT_SETTINGS.models below):
//   {
//     id:        '<stable-id>',      // user-chosen short slug
//     name:      '<display name>',
//     provider:  '<one of LLM_PROVIDERS.id>',
//     model:     '<provider-specific model name>',  // e.g. 'claude-sonnet-4-6'
//     apiKey:    '<opaque, server-side validated>', // optional — env var if blank
//     baseUrl:   '<override>',                       // optional — for self-hosted
//     enabled:   true/false
//   }

const LLM_PROVIDERS = [
    { id: 'anthropic', name: 'Anthropic',         docsUrl: 'https://docs.anthropic.com',                  envKey: 'ANTHROPIC_API_KEY' },
    { id: 'openai',    name: 'OpenAI',            docsUrl: 'https://platform.openai.com/docs',            envKey: 'OPENAI_API_KEY' },
    { id: 'google',    name: 'Google (Gemini)',   docsUrl: 'https://ai.google.dev/docs',                  envKey: 'GOOGLE_API_KEY' },
    { id: 'ollama',    name: 'Ollama (local)',    docsUrl: 'https://github.com/ollama/ollama',            envKey: null }, // local — no API key
    { id: 'lmstudio',  name: 'LM Studio (local)', docsUrl: 'https://lmstudio.ai/docs',                    envKey: null }, // local — no API key
    { id: 'openrouter',name: 'OpenRouter',        docsUrl: 'https://openrouter.ai/docs',                  envKey: 'OPENROUTER_API_KEY' },
    { id: 'custom',    name: 'Custom (URL)',      docsUrl: null,                                          envKey: null }, // bring-your-own
];

// ─── SETTINGS STATE ──────────────────────────────────────────

const settingsState = {
    activeCategory: null,
    entries: {},
    editingEntry: null,
    // Expose the provider registry to the rest of the UI without making it
    // mutable global state. Read-only by convention.
    llmProviders: LLM_PROVIDERS
};

// ─── MODEL ENTRY SCHEMA (ticket 0, Wave 5D) ──────────────────
//
// Editable shape for a `models` array entry. Declares each field's
// type (controls input element), label (display), and whether the
// value is sensitive (controls masking — apiKey is type:'password').
// buildModelEntryFields(entry, schema) is the pure helper that walks
// this schema and emits a {key, type, value, label, sensitive, options}
// list for the renderer to consume.
const MODEL_ENTRY_SCHEMA = [
    { key: 'id',       type: 'text',     label: 'ID',         placeholder: 'short-slug' },
    { key: 'name',     type: 'text',     label: 'Name',       placeholder: 'Display name' },
    { key: 'provider', type: 'select',   label: 'Provider',   optionsFrom: 'LLM_PROVIDERS' },
    { key: 'model',    type: 'text',     label: 'Model',      placeholder: 'e.g. claude-sonnet-4-6' },
    { key: 'apiKey',   type: 'password', label: 'API Key',    sensitive: true, placeholder: '(leave blank to use env var)' },
    { key: 'baseUrl',  type: 'text',     label: 'Base URL',   placeholder: '(optional, for self-hosted)' },
    { key: 'enabled',  type: 'boolean',  label: 'Enabled' }
];

// Per-array-category schema map. New array categories (sirkits,
// shells, keybindings) can register their own schemas here as their
// editors land in future waves.
const ENTRY_SCHEMAS = {
    models: MODEL_ENTRY_SCHEMA
};

// Pure helper: given an entry object + schema, returns an array of
// resolved fields ready for the renderer. Falls back to empty-string
// values for missing keys (so the form renders inputs even for a
// freshly-added entry). Exported via window.__test for node tests.
function buildModelEntryFields(entry, schema) {
    var safeEntry = entry || {};
    return schema.map(function(field) {
        var raw = Object.prototype.hasOwnProperty.call(safeEntry, field.key)
            ? safeEntry[field.key]
            : (field.type === 'boolean' ? false : '');
        return {
            key: field.key,
            type: field.type,
            label: field.label,
            value: raw,
            sensitive: !!field.sensitive,
            placeholder: field.placeholder || '',
            optionsFrom: field.optionsFrom || null
        };
    });
}

// ─── DEFAULT SETTINGS ────────────────────────────────────────

const DEFAULT_SETTINGS = {
    voidflow: {
        reveal_wpm: 200,
        word_atomic: true,
        pause_on_drag: true,
        buffer_trail_visible: true,
        reveal_curve: 'linear',
        drift_rate_lines_per_sec: 0.25,
        cursor_metronome: true
    },
    sirkits: [],
    // `models` entries now follow the provider-aware schema documented above
    // the LLM_PROVIDERS array. Empty by default — user adds entries via the
    // EDIT / ADD NEW affordances in the settings panel.
    models: [],
    shells: [],
    keybindings: [],
    // ─── theme (DORMANT BUT PLANNED — ticket 7 audit, Wave 5C) ──
    // The UI renders + persists edits to these keys but nothing
    // consumes them today (grep src/ for `palette_overrides`,
    // `font_sizes`, `spacing_scale` — only this object matches).
    //
    // Outcome (b) from the ticket: dormant but planned. The wiring is
    // already on the roadmap as P2.3 in
    // docs/_pending-roadmap/settings-and-providers.md ("Apply theme
    // tokens"), which describes the applyTheme(theme) pass that walks
    // these objects and writes CSS custom properties on
    // document.documentElement after loadSettings() resolves.
    //
    // Do NOT remove these keys without first deleting the P2.3 entry —
    // the category is intentionally write-only until P2.3 lands.
    theme: {
        palette_overrides: {},
        font_sizes: {},
        spacing_scale: 1.0
    },
    storage: {
        sqlite_path: 'st8.sqlite',
        backup_schedule: 'daily',
        export_targets: []
    },
    network: {
        epo_bus_endpoint: 'ws://localhost:3847',
        ports: {},
        proxies: [],
        websocket_retry_policy: 'exponential'
    }
};

// ─── SETTINGS RENDERING ──────────────────────────────────────

function renderSettingsPanel() {
    var container = document.getElementById('settings-panel');
    if (!container) return;
    
    var html = '<div class="settings-layout">' +
        '<div class="settings-sidebar">' +
            '<div class="settings-nav">';
    
    SETTINGS_CATEGORIES.forEach(function(cat) {
        var isActive = settingsState.activeCategory === cat.id;
        html += '<button class="settings-nav-item' + (isActive ? ' active' : '') + '" ' +
            'onclick="window.St8Settings.selectCategory(\'' + cat.id + '\')">' +
            '<span class="settings-nav-icon">' + cat.icon + '</span>' +
            '<span class="settings-nav-label">' + cat.name + '</span>' +
        '</button>';
    });
    
    html += '</div></div>' +
        '<div class="settings-main" id="settings-main">' +
            '<div class="settings-placeholder">Select a category to configure</div>' +
        '</div></div>';
    
    container.innerHTML = html;
}

function renderCategoryEntries(categoryId) {
    var main = document.getElementById('settings-main');
    if (!main) return;
    
    var category = SETTINGS_CATEGORIES.find(function(c) { return c.id === categoryId; });
    if (!category) return;
    
    var entries = settingsState.entries[categoryId] || DEFAULT_SETTINGS[categoryId] || {};
    
    var html = '<div class="settings-category-header">' +
        '<h2 class="settings-category-title">' + category.name + '</h2>' +
        '<p class="settings-category-desc">' + category.description + '</p>' +
    '</div>';
    
    if (Array.isArray(entries)) {
        // List of entries (e.g., sirkits, models)
        html += '<div class="settings-entry-list">';
        entries.forEach(function(entry, index) {
            html += '<div class="settings-entry-item">' +
                '<span class="settings-entry-name">' + (entry.name || entry.id || 'Entry ' + (index + 1)) + '</span>' +
                '<div class="settings-entry-actions">' +
                    '<button class="settings-action-btn" onclick="window.St8Settings.editEntry(\'' + categoryId + '\', ' + index + ')">EDIT</button>' +
                    '<button class="settings-action-btn" onclick="window.St8Settings.duplicateEntry(\'' + categoryId + '\', ' + index + ')">DUPLICATE</button>' +
                '</div>' +
            '</div>';
        });
        html += '</div>';
        html += '<button class="settings-add-btn" onclick="window.St8Settings.addEntry(\'' + categoryId + '\')">ADD NEW</button>';
    } else {
        // Key-value pairs (e.g., voidflow, theme)
        html += '<div class="settings-form">';
        Object.keys(entries).forEach(function(key) {
            // Ticket 4: coerce against DEFAULT_SETTINGS' expected type
            // so a SQLite round-trip that turned `200` into `"200"`
            // doesn't collapse a number input into a text input.
            var value = coerceSettingValue(categoryId, key, entries[key]);
            entries[key] = value;
            var type = typeof value;

            html += '<div class="settings-field">' +
                '<label class="settings-label">' + key.replace(/_/g, ' ').toUpperCase() + '</label>';
            
            if (type === 'boolean') {
                html += '<select class="settings-input" onchange="window.St8Settings.updateValue(\'' + categoryId + '\', \'' + key + '\', this.value === \'true\')">' +
                    '<option value="true"' + (value ? ' selected' : '') + '>TRUE</option>' +
                    '<option value="false"' + (!value ? ' selected' : '') + '>FALSE</option>' +
                '</select>';
            } else if (type === 'number') {
                html += '<input type="number" class="settings-input" value="' + value + '" ' +
                    'onchange="window.St8Settings.updateValue(\'' + categoryId + '\', \'' + key + '\', parseFloat(this.value))">';
            } else {
                html += '<input type="text" class="settings-input" value="' + escapeHtml(String(value)) + '" ' +
                    'onchange="window.St8Settings.updateValue(\'' + categoryId + '\', \'' + key + '\', this.value)">';
            }
            
            html += '</div>';
        });
        html += '</div>';
    }
    
    main.innerHTML = html;
}

// ─── SETTINGS ACTIONS ────────────────────────────────────────

function selectCategory(categoryId) {
    settingsState.activeCategory = categoryId;
    renderSettingsPanel();
    renderCategoryEntries(categoryId);
}

function updateValue(categoryId, key, value) {
    if (!settingsState.entries[categoryId]) {
        settingsState.entries[categoryId] = {};
    }
    // Capture the previous value so we can revert on persist failure
    // (ticket 9). `undefined` means "the key did not exist" — the
    // revert deletes it back out instead of writing `undefined`.
    var hadKey = Object.prototype.hasOwnProperty.call(settingsState.entries[categoryId], key);
    var prevValue = hadKey ? settingsState.entries[categoryId][key] : undefined;
    settingsState.entries[categoryId][key] = value;

    // Persist to backend. Ticket 9: read the response and revert UI
    // state on non-2xx so we don't silently retain bad data after a
    // ticket-8 enum rejection (or any other 4xx/5xx).
    return _persistSetting(categoryId, key, value).then(function(ok) {
        if (!ok) {
            if (hadKey) {
                settingsState.entries[categoryId][key] = prevValue;
            } else {
                delete settingsState.entries[categoryId][key];
            }
            // Re-render so the form reflects the rolled-back state.
            if (settingsState.activeCategory === categoryId &&
                typeof document !== 'undefined') {
                renderCategoryEntries(categoryId);
            }
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[st8] Settings rejected by server; reverted',
                             categoryId, key);
            }
        } else {
            console.info('[st8] Settings updated:', categoryId, key, value);
        }
        return ok;
    });
}

function _persistSetting(categoryId, key, value) {
    return fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: categoryId, key: key, value: value })
    }).then(function(res) {
        if (!res.ok) {
            console.warn('[st8] Failed to persist setting:', categoryId, key, res.status);
            return false;
        }
        return true;
    }).catch(function(err) {
        console.warn('[st8] Settings persistence error:', err.message);
        return false;
    });
}

function loadSettings() {
    return fetch('/api/settings')
        .then(function(res) {
            if (!res.ok) throw new Error('Failed to load settings: ' + res.status);
            return res.json();
        })
        .then(function(result) {
            if (result && result.data) {
                // Merge loaded settings into state — first migrate old
                // keys (ticket 5), then type-coerce values (ticket 4),
                // then unwrap array-category entries (ticket 0, 5D).
                Object.keys(result.data).forEach(function(category) {
                    var raw = result.data[category];
                    var migrated = migrateCategoryKeys(category, raw);
                    var coerced = coerceCategoryValues(category, migrated);
                    settingsState.entries[category] = unwrapArrayCategory(category, coerced);
                });
                console.info('[st8] Settings loaded from backend:', Object.keys(result.data).length, 'categories');
            }
            return result;
        })
        .catch(function(err) {
            console.warn('[st8] Could not load settings from backend, using defaults:', err.message);
            return null;
        });
}

function addEntry(categoryId) {
    if (!settingsState.entries[categoryId]) {
        settingsState.entries[categoryId] = [];
    }
    var newEntry = { id: 'new-entry', name: 'New Entry' };
    // For categories with a registered schema, seed empty fields so
    // the EDIT form has every input rendered immediately.
    var schema = ENTRY_SCHEMAS[categoryId];
    if (schema) {
        schema.forEach(function(f) {
            if (!Object.prototype.hasOwnProperty.call(newEntry, f.key)) {
                newEntry[f.key] = (f.type === 'boolean') ? false : '';
            }
        });
    }
    settingsState.entries[categoryId].push(newEntry);
    renderCategoryEntries(categoryId);
    // Persist the updated array. Best-effort: if the POST fails,
    // _persistSetting already logs; the in-memory state is rolled
    // back by the caller of editEntry (next save) if needed.
    _persistArrayEntries(categoryId, settingsState.entries[categoryId]);
}

function editEntry(categoryId, index) {
    // Ticket 0 (Wave 5D): real edit form for array-category entries.
    // Currently only the `models` category has a registered schema in
    // ENTRY_SCHEMAS; other array categories (sirkits, shells, etc.)
    // log a not-implemented notice instead of silently doing nothing
    // (the previous stub).
    var schema = ENTRY_SCHEMAS[categoryId];
    if (!schema) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[st8] editEntry: no schema registered for category ' + categoryId +
                         ' — add one to ENTRY_SCHEMAS in settings.js');
        }
        return;
    }

    var entries = settingsState.entries[categoryId];
    if (!Array.isArray(entries) || index < 0 || index >= entries.length) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[st8] editEntry: invalid entry at ' + categoryId + '[' + index + ']');
        }
        return;
    }

    // Snapshot the entry being edited so cancel can revert without a
    // re-fetch. Use a deep-clone so in-form mutations don't bleed.
    settingsState.editingEntry = {
        categoryId: categoryId,
        index: index,
        snapshot: JSON.parse(JSON.stringify(entries[index])),
        draft: JSON.parse(JSON.stringify(entries[index]))
    };

    _renderEditEntryForm();
}

function _renderEditEntryForm() {
    var main = (typeof document !== 'undefined') ? document.getElementById('settings-main') : null;
    if (!main) return;

    var editing = settingsState.editingEntry;
    if (!editing) return;
    var schema = ENTRY_SCHEMAS[editing.categoryId];
    if (!schema) return;

    var fields = buildModelEntryFields(editing.draft, schema);
    var html = '<div class="settings-category-header">' +
        '<h2 class="settings-category-title">EDIT ENTRY</h2>' +
        '<p class="settings-category-desc">' + escapeHtml(editing.categoryId) +
        ' [' + editing.index + ']</p>' +
    '</div>' +
    '<div class="settings-form" id="settings-edit-form">';

    fields.forEach(function(f) {
        html += '<div class="settings-field">' +
            '<label class="settings-label" for="se-' + escapeHtml(f.key) + '">' +
            escapeHtml(f.label) + '</label>';

        if (f.type === 'select' && f.optionsFrom === 'LLM_PROVIDERS') {
            // Ticket 6 consumer: provider dropdown from LLM_PROVIDERS.
            html += '<select id="se-' + escapeHtml(f.key) + '" class="settings-input" ' +
                'onchange="window.St8Settings.updateEditField(\'' + escapeHtml(f.key) + '\', this.value)">' +
                '<option value="">(select provider)</option>' +
                buildProviderOptions(f.value) +
                '</select>';
        } else if (f.type === 'boolean') {
            html += '<select id="se-' + escapeHtml(f.key) + '" class="settings-input" ' +
                'onchange="window.St8Settings.updateEditField(\'' + escapeHtml(f.key) + '\', this.value === \'true\')">' +
                '<option value="true"' + (f.value ? ' selected' : '') + '>TRUE</option>' +
                '<option value="false"' + (!f.value ? ' selected' : '') + '>FALSE</option>' +
                '</select>';
        } else if (f.type === 'password') {
            // SECURITY: apiKey MUST be masked. Even with at-rest
            // encryption (deferred to Wave 5E backend), shoulder-surfing
            // protection is a frontend-only concern.
            html += '<input type="password" id="se-' + escapeHtml(f.key) + '" class="settings-input" ' +
                'autocomplete="new-password" spellcheck="false" ' +
                'placeholder="' + escapeHtml(f.placeholder) + '" ' +
                'value="' + escapeHtml(String(f.value || '')) + '" ' +
                'oninput="window.St8Settings.updateEditField(\'' + escapeHtml(f.key) + '\', this.value)">';
        } else {
            html += '<input type="text" id="se-' + escapeHtml(f.key) + '" class="settings-input" ' +
                'placeholder="' + escapeHtml(f.placeholder) + '" ' +
                'value="' + escapeHtml(String(f.value || '')) + '" ' +
                'oninput="window.St8Settings.updateEditField(\'' + escapeHtml(f.key) + '\', this.value)">';
        }
        html += '</div>';
    });

    html += '</div>' +
        '<div class="settings-edit-actions">' +
            '<button class="settings-action-btn" onclick="window.St8Settings.cancelEdit()">CANCEL</button>' +
            '<button class="settings-add-btn" onclick="window.St8Settings.saveEntry()">SAVE</button>' +
        '</div>' +
        '<div class="settings-edit-error" id="settings-edit-error" style="display:none;"></div>';

    main.innerHTML = html;
}

function updateEditField(key, value) {
    if (!settingsState.editingEntry) return;
    settingsState.editingEntry.draft[key] = value;
}

function cancelEdit() {
    var editing = settingsState.editingEntry;
    settingsState.editingEntry = null;
    if (editing && settingsState.activeCategory === editing.categoryId) {
        renderCategoryEntries(editing.categoryId);
    }
}

function saveEntry() {
    var editing = settingsState.editingEntry;
    if (!editing) return Promise.resolve(false);

    var arr = settingsState.entries[editing.categoryId];
    if (!Array.isArray(arr)) return Promise.resolve(false);

    // Optimistic apply of the draft, then persist the full array.
    var prev = arr[editing.index];
    arr[editing.index] = editing.draft;

    return _persistArrayEntries(editing.categoryId, arr).then(function(ok) {
        if (!ok) {
            // Revert on persist failure — same ticket-9 pattern as
            // updateValue but for the whole-array shape.
            arr[editing.index] = prev;
            _showEditError('Save failed — server rejected the entry. Changes reverted.');
            return false;
        }
        // Success: close the editor and re-render the list.
        settingsState.editingEntry = null;
        if (settingsState.activeCategory === editing.categoryId) {
            renderCategoryEntries(editing.categoryId);
        }
        return true;
    });
}

function _showEditError(msg) {
    if (typeof document === 'undefined') return;
    var box = document.getElementById('settings-edit-error');
    if (!box) return;
    box.textContent = msg;
    box.style.display = 'block';
}

// Persist an entire array-shaped category under a single
// well-known key ('_entries'). Reuses _persistSetting's
// Promise<boolean> contract (ticket 9, Wave 5C) so failures are
// surfaced and revertible.
function _persistArrayEntries(categoryId, entries) {
    return _persistSetting(categoryId, '_entries', entries);
}

function duplicateEntry(categoryId, index) {
    if (!settingsState.entries[categoryId]) return;
    var entry = settingsState.entries[categoryId][index];
    if (entry) {
        var copy = JSON.parse(JSON.stringify(entry));
        copy.name = (copy.name || copy.id || 'Entry') + ' (copy)';
        settingsState.entries[categoryId].push(copy);
        renderCategoryEntries(categoryId);
        _persistArrayEntries(categoryId, settingsState.entries[categoryId]);
    }
}

// ─── SETTINGS POPUP ──────────────────────────────────────────

function showSettingsPopup() {
    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'settings-popup-overlay';
    overlay.innerHTML = '<div class="settings-popup">' +
        '<div class="settings-popup-header">' +
            '<span class="settings-popup-title">SETTINGS</span>' +
            '<button class="settings-popup-close" onclick="this.closest(\'.settings-popup-overlay\').remove()">◇</button>' +
        '</div>' +
        '<div class="settings-popup-body" id="settings-panel"></div>' +
    '</div>';
    
    document.body.appendChild(overlay);
    
    // Load persisted settings then render
    loadSettings().then(function() {
        renderSettingsPanel();
    });
}

// ─── SETTINGS IN EXPLORER ────────────────────────────────────

function showSettingsInExplorer() {
    var container = document.getElementById('explorer-root');
    if (!container) return;
    
    var html = '<div class="explorer-layout">' +
        '<aside class="explorer-sidebar">' +
            '<nav class="explorer-nav">' +
                '<button class="explorer-nav-item" onclick="window.VoidFileExplorer._navTo(\'HOME\', \'~\')">' +
                    '<span class="explorer-nav-icon">◇</span>' +
                    '<span class="explorer-nav-label">HOME</span>' +
                '</button>' +
                '<button class="explorer-nav-item" onclick="window.VoidFileExplorer._navTo(\'DOCUMENTS\', \'~/Documents\')">' +
                    '<span class="explorer-nav-icon">◇</span>' +
                    '<span class="explorer-nav-label">DOCUMENTS</span>' +
                '</button>' +
                '<button class="explorer-nav-item" onclick="window.VoidFileExplorer._navTo(\'DOWNLOADS\', \'~/Downloads\')">' +
                    '<span class="explorer-nav-icon">◇</span>' +
                    '<span class="explorer-nav-label">DOWNLOADS</span>' +
                '</button>' +
                '<button class="explorer-nav-item" onclick="window.VoidFileExplorer._showWorkspacePicker()">' +
                    '<span class="explorer-nav-icon">◈</span>' +
                    '<span class="explorer-nav-label">WORKSPACE</span>' +
                '</button>' +
                '<button class="explorer-nav-item active">' +
                    '<span class="explorer-nav-icon">◇</span>' +
                    '<span class="explorer-nav-label">SETTINGS</span>' +
                '</button>' +
            '</nav>' +
        '</aside>' +
        '<main class="explorer-main">' +
            '<header class="explorer-header">' +
                '<div class="explorer-breadcrumbs">' +
                    '<button class="crumb-btn crumb-btn--last">SETTINGS</button>' +
                '</div>' +
            '</header>' +
            '<div class="explorer-content" id="settings-explorer-content"></div>' +
        '</main>' +
    '</div>';
    
    container.innerHTML = html;
    
    // Render settings in the content area
    var content = document.getElementById('settings-explorer-content');
    if (content) {
        content.innerHTML = '<div class="settings-layout" style="height:100%;">' +
            '<div class="settings-sidebar" style="width:180px;border-right:1px solid var(--pink);padding:var(--space-3);background:#0a0a0b;">' +
                '<div class="settings-nav" id="settings-nav"></div>' +
            '</div>' +
            '<div class="settings-main" id="settings-main" style="flex:1;overflow-y:auto;padding:var(--space-4);">' +
                '<div class="settings-placeholder">Select a category to configure</div>' +
            '</div>' +
        '</div>';
        
        // Render category nav
        var nav = document.getElementById('settings-nav');
        if (nav) {
            nav.innerHTML = SETTINGS_CATEGORIES.map(function(cat) {
                return '<button class="settings-nav-item' + (settingsState.activeCategory === cat.id ? ' active' : '') + '" onclick="window.St8Settings.selectCategory(\'' + cat.id + '\')">' +
                    '<span class="settings-nav-icon">' + cat.icon + '</span>' +
                    '<span class="settings-nav-label">' + cat.name + '</span>' +
                '</button>';
            }).join('');
        }
    }

    // Load persisted settings
    loadSettings();
}

// ─── MODULE-LOAD ASSERTIONS ──────────────────────────────────
//
// Ticket 3 (Wave 5C): SETTINGS_CATEGORIES and DEFAULT_SETTINGS must
// stay in lock-step. A typo on one side (e.g. `void_flow` vs
// `voidflow`) silently produces an empty form because
// renderCategoryEntries falls through to `{}`. Assert at module load
// that the two sets of keys are identical.
//
// We *throw* in non-browser environments (test harness) so that the
// drift is caught loudly during CI. In a real browser we still throw
// — but settings.js loads early enough that the error surfaces in the
// console long before any user interaction.
(function _assertCategoriesMatchDefaults() {
    var catIds = SETTINGS_CATEGORIES.map(function(c) { return c.id; }).sort();
    var defKeys = Object.keys(DEFAULT_SETTINGS).sort();
    if (catIds.join(',') !== defKeys.join(',')) {
        var msg = '[st8] SETTINGS_CATEGORIES / DEFAULT_SETTINGS mismatch: ' +
                  'categories=[' + catIds.join(',') + '] defaults=[' + defKeys.join(',') + ']';
        // Surface on console for browser visibility, then throw so
        // tests + CI catch drift.
        if (typeof console !== 'undefined' && console.error) console.error(msg);
        throw new Error(msg);
    }
})();

// ─── TYPE VALIDATION (ticket 4) ──────────────────────────────
//
// Ticket 4 (Wave 5C): SQLite round-trips can return strings where
// DEFAULT_SETTINGS declares numbers/booleans (e.g. reveal_wpm stored
// as "200" instead of 200). renderCategoryEntries previously inferred
// input type from `typeof value` only, so a string-typed number
// collapsed to a text input. coerceSettingValue() compares the loaded
// value against DEFAULT_SETTINGS' type and coerces or warns.
//
// Returns the coerced value. If coercion is impossible (e.g. "hello"
// where a number is expected), returns the DEFAULT_SETTINGS value and
// logs a warning — never throws, never silently corrupts state.
function coerceSettingValue(categoryId, key, value) {
    var defaults = DEFAULT_SETTINGS[categoryId];
    // Arrays + missing categories: pass through (array categories
    // have per-entry shapes, not scalar key types).
    if (!defaults || Array.isArray(defaults)) return value;
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) return value;

    var expected = typeof defaults[key];
    var actual = typeof value;
    if (expected === actual) return value;

    // Cross-type coercion attempts.
    if (expected === 'number' && actual === 'string') {
        var n = parseFloat(value);
        if (!Number.isNaN(n) && Number.isFinite(n)) return n;
    }
    if (expected === 'boolean' && actual === 'string') {
        if (value === 'true') return true;
        if (value === 'false') return false;
    }
    if (expected === 'string' && (actual === 'number' || actual === 'boolean')) {
        return String(value);
    }
    if (expected === 'object' && actual === 'string') {
        try {
            var parsed = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) return parsed;
        } catch (_) { /* fall through to default below */ }
    }

    // Coercion impossible — fall back to default + warn.
    if (typeof console !== 'undefined' && console.warn) {
        console.warn('[st8] settings type mismatch ' + categoryId + '.' + key +
                     ': expected ' + expected + ', got ' + actual +
                     ' (' + JSON.stringify(value) + ') — using default');
    }
    return defaults[key];
}

// ─── ARRAY CATEGORY UNWRAP (ticket 0, Wave 5D) ───────────────
//
// Array categories (`models`, `sirkits`, `shells`, `keybindings`) are
// persisted under the single well-known key '_entries' as a JSON
// array. `getAllSettings()` returns `{models: {_entries: [...]}}`
// shape; unwrap to the bare array so `Array.isArray(entries)` is true
// downstream (renderCategoryEntries branches on it). If the key is
// missing OR the value isn't an array, fall back to the default empty
// array for array-shaped categories.
function unwrapArrayCategory(categoryId, raw) {
    var defaults = DEFAULT_SETTINGS[categoryId];
    if (!Array.isArray(defaults)) return raw;
    if (Array.isArray(raw)) return raw; // already an array
    if (raw && typeof raw === 'object' && Array.isArray(raw._entries)) {
        return raw._entries;
    }
    // Fallback: empty array (matches the DEFAULT_SETTINGS shape).
    return [];
}

function coerceCategoryValues(categoryId, entries) {
    var defaults = DEFAULT_SETTINGS[categoryId];
    if (!defaults || Array.isArray(defaults) || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
        return entries;
    }
    var out = {};
    Object.keys(entries).forEach(function(k) {
        out[k] = coerceSettingValue(categoryId, k, entries[k]);
    });
    return out;
}

// ─── SETTINGS KEY MIGRATIONS (ticket 5) ──────────────────────
//
// Ticket 5 (Wave 5C): st8_settings has no schema migration story.
// The full migration framework is deferred to P1.1 (see
// docs/_pending-roadmap/persistence-and-database.md). For settings
// SPECIFICALLY, we maintain a tiny per-key rename map: when
// loadSettings() reads from the backend, any row whose (category,key)
// matches an entry in SETTINGS_KEY_MIGRATIONS is rewritten to the new
// key client-side AND re-persisted under the new name so subsequent
// reads no longer trigger migration.
//
// Structure: { 'categoryId.oldKey': 'newKey' }
// Entries should be idempotent and added when DEFAULT_SETTINGS keys
// are renamed. Currently empty — the map is a placeholder ready to
// receive renames without requiring a schema-level framework.
var SETTINGS_KEY_MIGRATIONS = {
    // Example for future use:
    // 'voidflow.reveal_wpm': 'reveal_words_per_minute'
};

// ─── PROVIDER DROPDOWN HELPER (ticket 6) ─────────────────────
//
// Ticket 6 (Wave 5D): window.St8Settings.getLLMProviders() was added
// in batch 025 but had no caller in src/. The editEntry() form (ticket
// 0) now consumes the registry to populate the provider <select> when
// editing a `models` entry.
//
// buildProviderOptions(selectedId) returns an HTML <option> string for
// every entry in LLM_PROVIDERS, with the matching id pre-selected. The
// function is pure (no DOM, no fetch) so it's exercised by node tests.
function buildProviderOptions(selectedId) {
    return LLM_PROVIDERS.map(function(p) {
        var sel = (p.id === selectedId) ? ' selected' : '';
        return '<option value="' + escapeHtml(p.id) + '"' + sel + '>' +
               escapeHtml(p.name) + '</option>';
    }).join('');
}

function migrateCategoryKeys(categoryId, entries) {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return entries;
    var migrated = {};
    var renames = []; // [{oldKey, newKey}] — for re-persist
    Object.keys(entries).forEach(function(oldKey) {
        var newKey = SETTINGS_KEY_MIGRATIONS[categoryId + '.' + oldKey];
        if (newKey && !Object.prototype.hasOwnProperty.call(entries, newKey)) {
            migrated[newKey] = entries[oldKey];
            renames.push({ oldKey: oldKey, newKey: newKey, value: entries[oldKey] });
        } else {
            migrated[oldKey] = entries[oldKey];
        }
    });
    // Re-persist renames so the migration is idempotent + permanent.
    if (renames.length && typeof fetch !== 'undefined') {
        renames.forEach(function(r) {
            _persistSetting(categoryId, r.newKey, r.value);
            // Best-effort delete of the old key — not critical if the
            // backend doesn't support it; the new key will shadow it
            // on subsequent reads anyway because we don't read old
            // keys back.
            fetch('/api/settings?category=' + encodeURIComponent(categoryId) +
                  '&key=' + encodeURIComponent(r.oldKey), { method: 'DELETE' })
                  .catch(function() {});
        });
    }
    return migrated;
}

// ─── PUBLIC API ───────────────────────────────────────────────

window.St8Settings = {
    showSettingsPopup: showSettingsPopup,
    showSettingsInExplorer: showSettingsInExplorer,
    selectCategory: selectCategory,
    updateValue: updateValue,
    addEntry: addEntry,
    editEntry: editEntry,
    duplicateEntry: duplicateEntry,
    loadSettings: loadSettings,
    // Ticket 0 (Wave 5D): real edit-form lifecycle.
    updateEditField: updateEditField,
    cancelEdit: cancelEdit,
    saveEntry: saveEntry,
    getCategories: function() { return SETTINGS_CATEGORIES; },
    getDefaults: function() { return DEFAULT_SETTINGS; },
    getLLMProviders: function() { return LLM_PROVIDERS; }
};
