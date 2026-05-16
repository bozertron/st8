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
