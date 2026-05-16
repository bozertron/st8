'use strict';

/**
 * llm/dispatcher.js — provider-agnostic dispatch (Wave 5E, ticket 1).
 *
 * Takes a `models` entry (with a DECRYPTED apiKey — caller pre-
 * decrypts via persistence.getSettingsByCategory which handles the
 * crypto seam) plus a prompt, and routes to the right provider
 * adapter. Returns a uniform shape regardless of provider.
 *
 * The list of supported providers is exactly the set of adapter
 * modules in ./providers/. Currently anthropic + openai. Others
 * (google, ollama, lmstudio, openrouter, custom) are stubbed out at
 * the dispatch layer — they'll return a 501-shaped error pointing to
 * the roadmap. This keeps the API surface honest: a user with a
 * google-provider entry gets a clear "not yet supported" error
 * instead of a silent failure or a "success" with empty text.
 *
 * Anti-cheat: every supported provider must have a real adapter that
 * makes a real fetch. Stubbed providers explicitly say so.
 */

const SUPPORTED_PROVIDERS = new Set(['anthropic', 'openai']);
const STUB_PROVIDERS = new Set(['google', 'ollama', 'lmstudio', 'openrouter', 'custom']);

/**
 * Provider-id → env-var name for the fallback apiKey lookup. Mirrors
 * LLM_PROVIDERS in src/frontend/components/settings/settings.js. If
 * the entry's apiKey is empty AND this map has the provider, dispatch
 * reads process.env[envKey] before failing.
 */
const PROVIDER_ENV_KEYS = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
};

/**
 * @param {object} args
 * @param {object} args.entry  - the `models` settings entry
 *                               (id, name, provider, model, apiKey, baseUrl, enabled)
 *                               apiKey MUST be the decrypted plaintext
 * @param {string} args.prompt - user prompt
 * @param {object} [args.opts] - provider-specific options
 * @returns {Promise<{ok: boolean, ...}>}
 */
async function dispatch({ entry, prompt, opts }) {
    if (!entry || typeof entry !== 'object') {
        return { ok: false, status: 400, error: 'dispatch: entry required' };
    }
    if (entry.enabled === false) {
        return { ok: false, status: 400, error: 'dispatch: entry is disabled' };
    }
    const provider = entry.provider;
    if (!provider || typeof provider !== 'string') {
        return { ok: false, status: 400, error: 'dispatch: entry.provider required' };
    }

    // Env-var fallback for empty apiKey (matches LLM_PROVIDERS envKey).
    let apiKey = entry.apiKey;
    if ((!apiKey || apiKey.length === 0) && PROVIDER_ENV_KEYS[provider]) {
        apiKey = process.env[PROVIDER_ENV_KEYS[provider]] || '';
    }

    if (SUPPORTED_PROVIDERS.has(provider)) {
        // Lazy require so the test harness can swap globalThis.fetch
        // before the adapter loads. Both adapters are tiny so the
        // require cost is negligible.
        const adapter = require('./providers/' + provider);
        return adapter.call({
            model: entry.model,
            apiKey: apiKey,
            baseUrl: entry.baseUrl,
            prompt: prompt,
            opts: opts || {},
        });
    }

    if (STUB_PROVIDERS.has(provider)) {
        return {
            ok: false,
            status: 501,
            error: 'dispatch: provider "' + provider + '" recognized but not yet implemented. '
                + 'See docs/_pending-roadmap/settings-and-providers.md P1.2 — the adapter interface '
                + 'is in src/features/llm/providers/, drop a new file matching anthropic.js / openai.js.',
        };
    }

    return {
        ok: false,
        status: 400,
        error: 'dispatch: unknown provider "' + provider + '". '
            + 'Allowed: ' + [...SUPPORTED_PROVIDERS, ...STUB_PROVIDERS].sort().join(', '),
    };
}

module.exports = { dispatch, SUPPORTED_PROVIDERS, STUB_PROVIDERS, PROVIDER_ENV_KEYS };
