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

// ─── SETTINGS STATE ──────────────────────────────────────────

const settingsState = {
    activeCategory: null,
    entries: {},
    editingEntry: null
};

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
    models: [],
    shells: [],
    keybindings: [],
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
            var value = entries[key];
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
    settingsState.entries[categoryId][key] = value;
    
    // TODO: Persist to backend
    console.info('[st8] Settings updated:', categoryId, key, value);
}

function addEntry(categoryId) {
    if (!settingsState.entries[categoryId]) {
        settingsState.entries[categoryId] = [];
    }
    settingsState.entries[categoryId].push({ id: 'new-entry', name: 'New Entry' });
    renderCategoryEntries(categoryId);
}

function editEntry(categoryId, index) {
    // TODO: Show edit form
    console.info('[st8] Edit entry:', categoryId, index);
}

function duplicateEntry(categoryId, index) {
    if (!settingsState.entries[categoryId]) return;
    var entry = settingsState.entries[categoryId][index];
    if (entry) {
        var copy = JSON.parse(JSON.stringify(entry));
        copy.name = (copy.name || copy.id || 'Entry') + ' (copy)';
        settingsState.entries[categoryId].push(copy);
        renderCategoryEntries(categoryId);
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
    
    // Initialize settings
    renderSettingsPanel();
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
    getCategories: function() { return SETTINGS_CATEGORIES; },
    getDefaults: function() { return DEFAULT_SETTINGS; }
};
