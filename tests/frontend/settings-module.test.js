'use strict';

/**
 * tests/frontend/settings-module.test.js — Wave 5C, tickets 3 / 4 / 5
 *
 * settings.js is browser code: it talks to `document`, `window`, and
 * `fetch`. To test its three new module-load guarantees in node we
 * read the source, stub the minimum browser globals (`window`,
 * `console`, `document`, `fetch`) and `eval()` the file in a sandboxed
 * scope. The IIFE assertion (ticket 3) runs during the eval. The
 * helper functions become accessible via `window.St8Settings` +
 * locals captured via a small instrumentation suffix.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SETTINGS_PATH = path.join(__dirname, '..', '..',
    'src', 'frontend', 'components', 'settings', 'settings.js');
const SRC = fs.readFileSync(SETTINGS_PATH, 'utf8');

// settings.js now delegates persistence + initial load to
// window.St8SettingsReader (src/frontend/services/settings-reader.js).
// Load that script into every sandbox before settings.js, mirroring
// the script-tag order in index.html.
const READER_PATH = path.join(__dirname, '..', '..',
    'src', 'frontend', 'services', 'settings-reader.js');
const READER_SRC = fs.readFileSync(READER_PATH, 'utf8');

// Build a sandbox with minimum browser-like globals + capture the
// internal helpers we want to test (coerceSettingValue,
// migrateCategoryKeys) by appending a tiny instrumentation tail. The
// tail attaches the symbols to window for test access — it does NOT
// modify production behavior.
const INSTRUMENT_TAIL = `
;window.__test = {
    coerceSettingValue: coerceSettingValue,
    coerceCategoryValues: coerceCategoryValues,
    migrateCategoryKeys: migrateCategoryKeys,
    SETTINGS_KEY_MIGRATIONS: SETTINGS_KEY_MIGRATIONS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    SETTINGS_CATEGORIES: SETTINGS_CATEGORIES,
    LLM_PROVIDERS: LLM_PROVIDERS,
    buildProviderOptions: buildProviderOptions,
    buildModelEntryFields: typeof buildModelEntryFields === 'function' ? buildModelEntryFields : null,
    MODEL_ENTRY_SCHEMA: typeof MODEL_ENTRY_SCHEMA !== 'undefined' ? MODEL_ENTRY_SCHEMA : null,
    settingsState: settingsState,
};
`;

function makeSandbox() {
    const fetchCalls = [];
    const consoleCalls = { warn: [], error: [], info: [] };
    const sandbox = {
        window: {},
        console: {
            warn: (...args) => consoleCalls.warn.push(args),
            error: (...args) => consoleCalls.error.push(args),
            info: (...args) => consoleCalls.info.push(args),
            log: () => {},
        },
        document: {
            getElementById: () => null,
            documentElement: {},
        },
        fetch: (url, opts) => {
            fetchCalls.push({ url, opts });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ status: 'ok', data: {} }),
            });
        },
        // Used by JSON.parse fallbacks in settings.js value handling
        // (no-op in browser; settings.js calls escapeHtml only inside
        // renderCategoryEntries, which these tests do not exercise).
        escapeHtml: (s) => String(s),
    };
    sandbox.globalThis = sandbox;
    return { sandbox, fetchCalls, consoleCalls };
}

function loadSettingsInSandbox(srcOverride) {
    const { sandbox, fetchCalls, consoleCalls } = makeSandbox();
    const ctx = vm.createContext(sandbox);
    // Mirror index.html script order: settings-reader BEFORE settings.
    vm.runInContext(READER_SRC, ctx, { filename: 'settings-reader.js' });
    const src = (srcOverride || SRC) + INSTRUMENT_TAIL;
    vm.runInContext(src, ctx, { filename: 'settings.js' });
    return { sandbox, fetchCalls, consoleCalls };
}

// ─── Ticket 3 — module-load lock-step assertion ──────────────────

test('ticket 3 — module loads cleanly when SETTINGS_CATEGORIES matches DEFAULT_SETTINGS', () => {
    assert.doesNotThrow(() => loadSettingsInSandbox());
});

test('ticket 3 — module THROWS if SETTINGS_CATEGORIES has a key DEFAULT_SETTINGS lacks', () => {
    // Inject an extra category id into the SETTINGS_CATEGORIES literal.
    const mutated = SRC.replace(
        "{ id: 'network', name: 'NETWORK', icon: '◇', description: 'EPO bus and connections' }",
        "{ id: 'network', name: 'NETWORK', icon: '◇', description: 'EPO bus and connections' },\n    { id: 'phantom', name: 'PHANTOM', icon: '◇', description: 'unmatched' }"
    );
    assert.notEqual(mutated, SRC, 'mutation must actually change the source');
    assert.throws(
        () => loadSettingsInSandbox(mutated),
        /SETTINGS_CATEGORIES \/ DEFAULT_SETTINGS mismatch/
    );
});

test('ticket 3 — module THROWS if DEFAULT_SETTINGS has a key SETTINGS_CATEGORIES lacks', () => {
    // Inject an extra DEFAULT_SETTINGS top-level key.
    const mutated = SRC.replace(
        "network: {\n        epo_bus_endpoint:",
        "phantom_only: {},\n    network: {\n        epo_bus_endpoint:"
    );
    assert.notEqual(mutated, SRC, 'mutation must actually change the source');
    assert.throws(
        () => loadSettingsInSandbox(mutated),
        /SETTINGS_CATEGORIES \/ DEFAULT_SETTINGS mismatch/
    );
});

// ─── Ticket 4 — type coercion ────────────────────────────────────

test('ticket 4 — coerceSettingValue: string→number for known numeric key', () => {
    const { sandbox } = loadSettingsInSandbox();
    const coerced = sandbox.window.__test.coerceSettingValue('voidflow', 'reveal_wpm', '200');
    assert.equal(coerced, 200);
    assert.equal(typeof coerced, 'number');
});

test('ticket 4 — coerceSettingValue: string→boolean for known boolean key', () => {
    const { sandbox } = loadSettingsInSandbox();
    assert.equal(sandbox.window.__test.coerceSettingValue('voidflow', 'word_atomic', 'true'), true);
    assert.equal(sandbox.window.__test.coerceSettingValue('voidflow', 'word_atomic', 'false'), false);
});

test('ticket 4 — coerceSettingValue: garbage string for numeric key falls back to default + warns', () => {
    const { sandbox, consoleCalls } = loadSettingsInSandbox();
    const coerced = sandbox.window.__test.coerceSettingValue('voidflow', 'reveal_wpm', 'definitely not a number');
    // Default reveal_wpm is 200
    assert.equal(coerced, 200);
    assert.ok(consoleCalls.warn.length >= 1, 'expected a type mismatch warning');
    assert.match(String(consoleCalls.warn[0]), /type mismatch/);
});

test('ticket 4 — coerceSettingValue: pass-through when types match', () => {
    const { sandbox } = loadSettingsInSandbox();
    assert.equal(sandbox.window.__test.coerceSettingValue('voidflow', 'reveal_wpm', 250), 250);
    assert.equal(sandbox.window.__test.coerceSettingValue('voidflow', 'word_atomic', false), false);
    assert.equal(sandbox.window.__test.coerceSettingValue('storage', 'sqlite_path', '/tmp/x.db'), '/tmp/x.db');
});

test('ticket 4 — coerceSettingValue: unknown key passes through', () => {
    const { sandbox } = loadSettingsInSandbox();
    assert.equal(sandbox.window.__test.coerceSettingValue('voidflow', 'unknown_key_xyz', 'hello'), 'hello');
});

test('ticket 4 — coerceSettingValue: array categories pass through (no scalar shape)', () => {
    const { sandbox } = loadSettingsInSandbox();
    assert.equal(sandbox.window.__test.coerceSettingValue('models', '0', { id: 'x' }).id, 'x');
});

test('ticket 4 — coerceCategoryValues: coerces every key in a POJO category', () => {
    const { sandbox } = loadSettingsInSandbox();
    const out = sandbox.window.__test.coerceCategoryValues('voidflow', {
        reveal_wpm: '300',      // string → number
        word_atomic: 'false',   // string → boolean
        reveal_curve: 'ease',   // string (matches default type)
    });
    assert.equal(out.reveal_wpm, 300);
    assert.equal(out.word_atomic, false);
    assert.equal(out.reveal_curve, 'ease');
});

// ─── Ticket 5 — key migration map ────────────────────────────────

test('ticket 5 — SETTINGS_KEY_MIGRATIONS exists as a plain object', () => {
    const { sandbox } = loadSettingsInSandbox();
    const map = sandbox.window.__test.SETTINGS_KEY_MIGRATIONS;
    assert.ok(map && typeof map === 'object');
    assert.ok(!Array.isArray(map));
});

test('ticket 5 — migrateCategoryKeys: no-op when no migrations defined for this category', () => {
    const { sandbox } = loadSettingsInSandbox();
    const out = sandbox.window.__test.migrateCategoryKeys('voidflow', { reveal_wpm: 200 });
    // deepEqual can't cross vm contexts (different Object prototype),
    // so compare per-key.
    assert.equal(out.reveal_wpm, 200);
    assert.equal(Object.keys(out).length, 1);
});

test('ticket 5 — migrateCategoryKeys: renames an old key when a migration is registered', () => {
    // Patch SRC to seed one migration entry, then re-evaluate.
    const mutated = SRC.replace(
        '// Example for future use:\n    // \'voidflow.reveal_wpm\': \'reveal_words_per_minute\'',
        "'voidflow.reveal_wpm': 'reveal_words_per_minute'"
    );
    assert.notEqual(mutated, SRC);
    const { sandbox } = loadSettingsInSandbox(mutated);
    const out = sandbox.window.__test.migrateCategoryKeys('voidflow', {
        reveal_wpm: 200,
        word_atomic: true,
    });
    assert.equal(out.reveal_words_per_minute, 200, 'old value carried to new key');
    assert.equal(out.word_atomic, true, 'other keys preserved');
    assert.equal(out.reveal_wpm, undefined, 'old key removed');
});

// ─── Ticket 0 — editEntry form (Wave 5D) ─────────────────────────

test('ticket 0 — MODEL_ENTRY_SCHEMA declares the documented model fields', () => {
    const { sandbox } = loadSettingsInSandbox();
    const schema = sandbox.window.__test.MODEL_ENTRY_SCHEMA;
    assert.ok(Array.isArray(schema) && schema.length >= 5);
    const keys = schema.map((f) => f.key);
    ['id', 'name', 'provider', 'model', 'apiKey', 'baseUrl', 'enabled']
        .forEach((k) => assert.ok(keys.includes(k), 'schema must include ' + k));
});

test('ticket 0 — apiKey field is marked sensitive and uses type=password', () => {
    const { sandbox } = loadSettingsInSandbox();
    const schema = sandbox.window.__test.MODEL_ENTRY_SCHEMA;
    const apiKeyField = schema.find((f) => f.key === 'apiKey');
    assert.ok(apiKeyField, 'apiKey field must exist');
    assert.equal(apiKeyField.type, 'password',
        'apiKey MUST be type:password for masking — security invariant');
    assert.equal(apiKeyField.sensitive, true,
        'apiKey MUST be flagged sensitive');
});

test('ticket 0 — buildModelEntryFields resolves a full entry into typed field descriptors', () => {
    const { sandbox } = loadSettingsInSandbox();
    const schema = sandbox.window.__test.MODEL_ENTRY_SCHEMA;
    const entry = {
        id: 'claude-main',
        name: 'Claude (primary)',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-test-abc123',
        baseUrl: '',
        enabled: true
    };
    const fields = sandbox.window.__test.buildModelEntryFields(entry, schema);
    assert.equal(fields.length, schema.length);
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    assert.equal(byKey.apiKey.value, 'sk-test-abc123');
    assert.equal(byKey.apiKey.sensitive, true);
    assert.equal(byKey.apiKey.type, 'password');
    assert.equal(byKey.provider.value, 'anthropic');
    assert.equal(byKey.provider.optionsFrom, 'LLM_PROVIDERS');
    assert.equal(byKey.enabled.value, true);
});

test('ticket 0 — buildModelEntryFields supplies empty defaults for missing keys', () => {
    const { sandbox } = loadSettingsInSandbox();
    const schema = sandbox.window.__test.MODEL_ENTRY_SCHEMA;
    const fields = sandbox.window.__test.buildModelEntryFields({}, schema);
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    assert.equal(byKey.id.value, '');
    assert.equal(byKey.apiKey.value, '');
    assert.equal(byKey.enabled.value, false, 'boolean field defaults to false');
});

test('ticket 0 — buildModelEntryFields handles a null entry without crashing', () => {
    const { sandbox } = loadSettingsInSandbox();
    const schema = sandbox.window.__test.MODEL_ENTRY_SCHEMA;
    const fields = sandbox.window.__test.buildModelEntryFields(null, schema);
    assert.equal(fields.length, schema.length);
    fields.forEach((f) => {
        if (f.type === 'boolean') assert.equal(f.value, false);
        else assert.equal(f.value, '');
    });
});

test('ticket 0 — editEntry on unknown category warns and does not crash', () => {
    const { sandbox, consoleCalls } = loadSettingsInSandbox();
    sandbox.window.St8Settings.editEntry('voidflow', 0); // POJO, no schema
    assert.ok(consoleCalls.warn.length >= 1);
    assert.match(String(consoleCalls.warn.map((a) => a.join(' ')).join('|')), /no schema registered/);
});

test('ticket 0 — editEntry on models populates editingEntry with a deep-cloned draft', () => {
    const { sandbox } = loadSettingsInSandbox();
    const state = sandbox.window.__test.settingsState;
    state.entries.models = [{ id: 'm1', name: 'M1', provider: 'anthropic', model: 'x', apiKey: 'k', baseUrl: '', enabled: true }];
    sandbox.window.St8Settings.editEntry('models', 0);
    assert.ok(state.editingEntry, 'editingEntry must be set');
    assert.equal(state.editingEntry.categoryId, 'models');
    assert.equal(state.editingEntry.index, 0);
    assert.equal(state.editingEntry.draft.apiKey, 'k');
    // Mutating the draft must not affect the live entry (deep clone).
    state.editingEntry.draft.apiKey = 'mutated';
    assert.equal(state.entries.models[0].apiKey, 'k');
});

test('ticket 0 — updateEditField mutates draft only', () => {
    const { sandbox } = loadSettingsInSandbox();
    const state = sandbox.window.__test.settingsState;
    state.entries.models = [{ id: 'm', name: 'M', provider: 'openai', model: 'gpt-4', apiKey: '', baseUrl: '', enabled: false }];
    sandbox.window.St8Settings.editEntry('models', 0);
    sandbox.window.St8Settings.updateEditField('apiKey', 'new-secret');
    assert.equal(state.editingEntry.draft.apiKey, 'new-secret');
    // Live entry unchanged until save.
    assert.equal(state.entries.models[0].apiKey, '');
});

test('ticket 0 — cancelEdit clears editingEntry without persisting', async () => {
    const { sandbox, fetchCalls } = loadSettingsInSandbox();
    const state = sandbox.window.__test.settingsState;
    state.entries.models = [{ id: 'm', name: 'M', provider: 'openai', model: 'gpt-4', apiKey: 'orig', baseUrl: '', enabled: false }];
    sandbox.window.St8Settings.editEntry('models', 0);
    sandbox.window.St8Settings.updateEditField('apiKey', 'new-value');
    const fetchCallsBefore = fetchCalls.length;
    sandbox.window.St8Settings.cancelEdit();
    assert.equal(state.editingEntry, null);
    assert.equal(state.entries.models[0].apiKey, 'orig', 'live entry untouched by cancel');
    assert.equal(fetchCalls.length, fetchCallsBefore, 'cancel must NOT POST');
});

test('ticket 0 — saveEntry persists the array via _entries key and applies the draft', async () => {
    const { sandbox, fetchCalls } = loadSettingsInSandbox();
    const state = sandbox.window.__test.settingsState;
    state.entries.models = [{ id: 'm', name: 'M', provider: 'openai', model: 'gpt-4', apiKey: '', baseUrl: '', enabled: false }];
    sandbox.window.St8Settings.editEntry('models', 0);
    sandbox.window.St8Settings.updateEditField('apiKey', 'sk-saved');
    sandbox.window.St8Settings.updateEditField('enabled', true);
    const ok = await sandbox.window.St8Settings.saveEntry();
    assert.equal(ok, true);
    assert.equal(state.entries.models[0].apiKey, 'sk-saved');
    assert.equal(state.entries.models[0].enabled, true);
    assert.equal(state.editingEntry, null, 'editingEntry cleared after save');
    // Verify POST shape
    const post = fetchCalls.find((c) => c.opts && c.opts.method === 'POST');
    assert.ok(post, 'expected at least one POST');
    const body = JSON.parse(post.opts.body);
    assert.equal(body.category, 'models');
    assert.equal(body.key, '_entries');
    assert.ok(Array.isArray(body.value));
    assert.equal(body.value[0].apiKey, 'sk-saved');
});

test('ticket 0 — saveEntry reverts the live entry when persist returns non-2xx', async () => {
    const { sandbox } = loadSettingsInSandbox();
    // Override fetch to return 400.
    sandbox.fetch = () => Promise.resolve({
        ok: false, status: 400,
        json: () => Promise.resolve({ error: 'rejected' }),
    });
    const state = sandbox.window.__test.settingsState;
    state.entries.models = [{ id: 'm', name: 'M', provider: 'openai', model: 'gpt-4', apiKey: 'orig', baseUrl: '', enabled: false }];
    sandbox.window.St8Settings.editEntry('models', 0);
    sandbox.window.St8Settings.updateEditField('apiKey', 'should-be-reverted');
    const ok = await sandbox.window.St8Settings.saveEntry();
    assert.equal(ok, false, 'saveEntry must return false on non-2xx');
    assert.equal(state.entries.models[0].apiKey, 'orig',
        'live entry must be reverted to pre-save value on persist failure');
});

test('ticket 0 — unwrapArrayCategory converts {_entries:[...]} shape back to bare array', () => {
    const { sandbox } = loadSettingsInSandbox();
    // unwrapArrayCategory isn't on __test directly; exercise via the
    // public load path: synthesize a load response with the _entries
    // shape and run loadSettings.
    sandbox.fetch = () => Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({
            status: 'ok',
            data: {
                models: { _entries: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
                voidflow: { reveal_wpm: 200 },
            },
        }),
    });
    return sandbox.window.St8Settings.loadSettings().then(() => {
        const state = sandbox.window.__test.settingsState;
        assert.ok(Array.isArray(state.entries.models),
            'models must be unwrapped to an array');
        assert.equal(state.entries.models.length, 2);
        assert.equal(state.entries.models[0].id, 'a');
        // voidflow (POJO) untouched.
        assert.equal(state.entries.voidflow.reveal_wpm, 200);
    });
});

// ─── Ticket 6 — getLLMProviders consumer / buildProviderOptions ──

test('ticket 6 — buildProviderOptions emits one <option> per LLM_PROVIDERS entry', () => {
    const { sandbox } = loadSettingsInSandbox();
    const html = sandbox.window.__test.buildProviderOptions(null);
    const providers = sandbox.window.__test.LLM_PROVIDERS;
    providers.forEach((p) => {
        assert.ok(html.includes('value="' + p.id + '"'),
            'expected option for provider ' + p.id);
        assert.ok(html.includes(p.name) || html.includes(p.name.replace(/&/g, '&amp;')),
            'expected display name for ' + p.id);
    });
    // No selected attribute when selectedId is null
    assert.ok(!html.includes(' selected>'),
        'no option should be pre-selected when selectedId is null');
});

test('ticket 6 — buildProviderOptions marks the matching id as selected', () => {
    const { sandbox } = loadSettingsInSandbox();
    const html = sandbox.window.__test.buildProviderOptions('anthropic');
    assert.match(html, /<option value="anthropic" selected>/);
    // Only one selected option
    assert.equal((html.match(/ selected>/g) || []).length, 1);
});

test('ticket 6 — buildProviderOptions: unknown selectedId selects nothing (graceful)', () => {
    const { sandbox } = loadSettingsInSandbox();
    const html = sandbox.window.__test.buildProviderOptions('nonexistent-provider');
    assert.equal((html.match(/ selected>/g) || []).length, 0);
});

test('ticket 6 — getLLMProviders() public API returns the same list buildProviderOptions consumes', () => {
    const { sandbox } = loadSettingsInSandbox();
    const fromApi = sandbox.window.St8Settings.getLLMProviders();
    const internal = sandbox.window.__test.LLM_PROVIDERS;
    assert.equal(fromApi.length, internal.length);
    fromApi.forEach((p, i) => assert.equal(p.id, internal[i].id));
});

test('ticket 5 — migrateCategoryKeys: if new key already exists, keep new (no clobber)', () => {
    const mutated = SRC.replace(
        '// Example for future use:\n    // \'voidflow.reveal_wpm\': \'reveal_words_per_minute\'',
        "'voidflow.reveal_wpm': 'reveal_words_per_minute'"
    );
    const { sandbox } = loadSettingsInSandbox(mutated);
    const out = sandbox.window.__test.migrateCategoryKeys('voidflow', {
        reveal_wpm: 999,                    // old
        reveal_words_per_minute: 250,       // already-migrated value present
    });
    // New key wins, old key passed through to caller for cleanup.
    assert.equal(out.reveal_words_per_minute, 250);
});
