'use strict';

/**
 * OpenAI provider adapter (Wave 5E, ticket 1).
 *
 * Mirrors anthropic.js — one `call({ model, apiKey, baseUrl, prompt, opts })`
 * export, normalizes to the dispatcher's contract.
 *
 * API reference: https://platform.openai.com/docs/api-reference/chat
 *
 *   POST https://api.openai.com/v1/chat/completions
 *   Headers:
 *     Authorization: Bearer <apiKey>
 *     Content-Type: application/json
 *   Body:
 *     { model, messages: [{role:'user', content:prompt}], max_tokens, ... }
 *
 * `baseUrl` override lets the same adapter front Azure OpenAI,
 * OpenRouter, or any OpenAI-compatible local server (LM Studio,
 * ollama's OpenAI shim, etc.). Adapter does not validate that the
 * override hosts the chat-completions endpoint — that's the operator's
 * problem if they configure it wrong.
 */

const DEFAULT_BASE_URL = 'https://api.openai.com';
const DEFAULT_MAX_TOKENS = 1024;

/**
 * @param {object} args
 * @param {string} args.model    - e.g. 'gpt-4', 'gpt-4o'
 * @param {string} args.apiKey   - DECRYPTED OpenAI key (sk-...)
 * @param {string} [args.baseUrl] - override (default api.openai.com)
 * @param {string} args.prompt   - user message text
 * @param {object} [args.opts]   - { maxTokens?, system?, temperature? }
 * @returns {Promise<{ ok: true, response: string, model: string, usage?: object }
 *                 | { ok: false, status: number, error: string }>}
 */
async function call({ model, apiKey, baseUrl, prompt, opts }) {
    if (!model || typeof model !== 'string') {
        return { ok: false, status: 400, error: 'openai: model required' };
    }
    if (!apiKey || typeof apiKey !== 'string') {
        return { ok: false, status: 400, error: 'openai: apiKey required' };
    }
    if (typeof prompt !== 'string' || prompt.length === 0) {
        return { ok: false, status: 400, error: 'openai: prompt required' };
    }

    const base = (baseUrl && typeof baseUrl === 'string' && baseUrl.length > 0)
        ? baseUrl.replace(/\/+$/, '')
        : DEFAULT_BASE_URL;
    const url = base + '/v1/chat/completions';

    const messages = [];
    if (opts && typeof opts.system === 'string' && opts.system.length > 0) {
        messages.push({ role: 'system', content: opts.system });
    }
    messages.push({ role: 'user', content: prompt });

    const body = {
        model,
        messages,
        max_tokens: (opts && typeof opts.maxTokens === 'number') ? opts.maxTokens : DEFAULT_MAX_TOKENS,
    };
    if (opts && typeof opts.temperature === 'number') body.temperature = opts.temperature;

    let res;
    try {
        res = await globalThis.fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    } catch (err) {
        return { ok: false, status: 0, error: 'openai: network failure: ' + err.message };
    }

    let data;
    try {
        data = await res.json();
    } catch (err) {
        return { ok: false, status: res.status || 500, error: 'openai: non-JSON response: ' + err.message };
    }

    if (!res.ok) {
        const msg = (data && data.error && data.error.message) || ('HTTP ' + res.status);
        return { ok: false, status: res.status, error: 'openai: ' + msg };
    }

    // Response shape:
    //   { id, object:'chat.completion', model, choices:[{message:{role:'assistant', content:'...'}}], usage:{...} }
    let text = '';
    if (Array.isArray(data.choices) && data.choices.length > 0) {
        const msg = data.choices[0].message;
        if (msg && typeof msg.content === 'string') text = msg.content;
    }
    return {
        ok: true,
        response: text,
        model: data.model || model,
        usage: data.usage || undefined,
    };
}

module.exports = { call, DEFAULT_BASE_URL };
