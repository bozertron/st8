'use strict';

/**
 * Anthropic provider adapter (Wave 5E, ticket 1).
 *
 * One responsibility: turn a `{ model, apiKey, baseUrl, prompt, opts }`
 * tuple into a single Anthropic Messages API call and normalize the
 * response into the dispatcher's contract.
 *
 * API reference: https://docs.anthropic.com/en/api/messages
 *
 *   POST https://api.anthropic.com/v1/messages
 *   Headers:
 *     x-api-key: <apiKey>
 *     anthropic-version: 2023-06-01
 *     content-type: application/json
 *   Body:
 *     { model, max_tokens, messages: [{role:'user', content:prompt}] }
 *
 * The adapter NEVER assumes the caller pre-decrypted the apiKey — but
 * it does require a non-empty string. The dispatcher hands us the
 * decrypted form (or the env-var fallback). If we receive ciphertext
 * here that's a dispatcher bug, not an adapter bug.
 *
 * Test seam: the adapter calls `globalThis.fetch` (Node 18+'s built-in).
 * Tests override `globalThis.fetch` to a mock that asserts on the
 * outgoing request shape and returns a synthetic response, avoiding
 * the real network call.
 */

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MAX_TOKENS = 1024;
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * @param {object} args
 * @param {string} args.model    - e.g. 'claude-sonnet-4-6'
 * @param {string} args.apiKey   - DECRYPTED Anthropic key (sk-ant-...)
 * @param {string} [args.baseUrl] - override (default api.anthropic.com)
 * @param {string} args.prompt   - user message text
 * @param {object} [args.opts]   - { maxTokens?, system?, temperature? }
 * @returns {Promise<{ ok: true, response: string, model: string, usage?: object }
 *                 | { ok: false, status: number, error: string }>}
 */
async function call({ model, apiKey, baseUrl, prompt, opts }) {
    if (!model || typeof model !== 'string') {
        return { ok: false, status: 400, error: 'anthropic: model required' };
    }
    if (!apiKey || typeof apiKey !== 'string') {
        return { ok: false, status: 400, error: 'anthropic: apiKey required' };
    }
    if (typeof prompt !== 'string' || prompt.length === 0) {
        return { ok: false, status: 400, error: 'anthropic: prompt required' };
    }

    const base = (baseUrl && typeof baseUrl === 'string' && baseUrl.length > 0)
        ? baseUrl.replace(/\/+$/, '')
        : DEFAULT_BASE_URL;
    const url = base + '/v1/messages';

    const body = {
        model,
        max_tokens: (opts && typeof opts.maxTokens === 'number') ? opts.maxTokens : DEFAULT_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
    };
    if (opts && typeof opts.system === 'string') body.system = opts.system;
    if (opts && typeof opts.temperature === 'number') body.temperature = opts.temperature;

    let res;
    try {
        res = await globalThis.fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    } catch (err) {
        return { ok: false, status: 0, error: 'anthropic: network failure: ' + err.message };
    }

    let data;
    try {
        data = await res.json();
    } catch (err) {
        return { ok: false, status: res.status || 500, error: 'anthropic: non-JSON response: ' + err.message };
    }

    if (!res.ok) {
        const msg = (data && data.error && data.error.message) || ('HTTP ' + res.status);
        return { ok: false, status: res.status, error: 'anthropic: ' + msg };
    }

    // Response shape:
    //   { id, type:'message', role:'assistant', model, content:[{type:'text',text:'...'}], usage:{input_tokens,output_tokens} }
    let text = '';
    if (Array.isArray(data.content)) {
        for (const block of data.content) {
            if (block && block.type === 'text' && typeof block.text === 'string') {
                text += block.text;
            }
        }
    }
    return {
        ok: true,
        response: text,
        model: data.model || model,
        usage: data.usage || undefined,
    };
}

module.exports = { call, DEFAULT_BASE_URL, ANTHROPIC_VERSION };
