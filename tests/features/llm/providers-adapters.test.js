'use strict';

/**
 * tests/features/llm/providers-adapters.test.js — Wave 5E ticket 1.
 *
 * Unit tests for the Anthropic + OpenAI provider adapters. Each test:
 *   - swaps globalThis.fetch for a recording mock
 *   - calls the adapter
 *   - asserts on the OUTGOING request (URL, headers, body shape)
 *   - asserts on the NORMALIZED response shape
 *   - restores globalThis.fetch in t.after
 *
 * Anti-cheat: no real network calls. Mocked fetch returns a synthetic
 * provider response so the adapter's response-parsing path runs
 * against realistic shapes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const anthropic = require('../../../src/features/llm/providers/anthropic');
const openai = require('../../../src/features/llm/providers/openai');

function installFetchMock(impl) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return () => { globalThis.fetch = original; };
}

function fakeRes({ status = 200, json = {} } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => json,
    };
}

// ─── Anthropic ──────────────────────────────────────────────

test('anthropic.call — sends correct URL, headers, body shape', async (t) => {
    let captured = null;
    const restore = installFetchMock(async (url, init) => {
        captured = { url, init };
        return fakeRes({
            status: 200,
            json: {
                id: 'msg_test',
                type: 'message',
                role: 'assistant',
                model: 'claude-sonnet-4-6',
                content: [{ type: 'text', text: 'pong' }],
                usage: { input_tokens: 3, output_tokens: 1 },
            },
        });
    });
    t.after(restore);

    const result = await anthropic.call({
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-ant-test-DECRYPTED',
        prompt: 'ping',
    });

    assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.headers['x-api-key'], 'sk-ant-test-DECRYPTED', 'apiKey must be sent as x-api-key header (decrypted form)');
    assert.equal(captured.init.headers['anthropic-version'], '2023-06-01');
    const body = JSON.parse(captured.init.body);
    assert.equal(body.model, 'claude-sonnet-4-6');
    assert.equal(body.messages[0].role, 'user');
    assert.equal(body.messages[0].content, 'ping');

    assert.equal(result.ok, true);
    assert.equal(result.response, 'pong');
    assert.equal(result.model, 'claude-sonnet-4-6');
    assert.deepEqual(result.usage, { input_tokens: 3, output_tokens: 1 });
});

test('anthropic.call — surfaces upstream error', async (t) => {
    const restore = installFetchMock(async () => fakeRes({
        status: 401,
        json: { error: { type: 'authentication_error', message: 'invalid x-api-key' } },
    }));
    t.after(restore);

    const result = await anthropic.call({
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-bad',
        prompt: 'ping',
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.match(result.error, /invalid x-api-key/);
});

test('anthropic.call — rejects missing fields', async (t) => {
    let called = false;
    const restore = installFetchMock(async () => { called = true; return fakeRes(); });
    t.after(restore);

    assert.equal((await anthropic.call({ apiKey: 'k', prompt: 'p' })).ok, false);
    assert.equal((await anthropic.call({ model: 'm', prompt: 'p' })).ok, false);
    assert.equal((await anthropic.call({ model: 'm', apiKey: 'k' })).ok, false);
    assert.equal(called, false, 'fetch must NOT be called on validation failure');
});

test('anthropic.call — baseUrl override is respected', async (t) => {
    let capturedUrl = null;
    const restore = installFetchMock(async (url) => {
        capturedUrl = url;
        return fakeRes({ status: 200, json: { content: [{ type: 'text', text: '' }] } });
    });
    t.after(restore);

    await anthropic.call({
        model: 'm', apiKey: 'k', prompt: 'p',
        baseUrl: 'https://proxy.example.com/anth',
    });
    assert.equal(capturedUrl, 'https://proxy.example.com/anth/v1/messages');
});

// ─── OpenAI ─────────────────────────────────────────────────

test('openai.call — sends correct URL, headers, body shape', async (t) => {
    let captured = null;
    const restore = installFetchMock(async (url, init) => {
        captured = { url, init };
        return fakeRes({
            status: 200,
            json: {
                id: 'chatcmpl_test',
                object: 'chat.completion',
                model: 'gpt-4',
                choices: [{ message: { role: 'assistant', content: 'pong' } }],
                usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
            },
        });
    });
    t.after(restore);

    const result = await openai.call({
        model: 'gpt-4',
        apiKey: 'sk-openai-DECRYPTED',
        prompt: 'ping',
        opts: { system: 'be terse', temperature: 0.5 },
    });

    assert.equal(captured.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(captured.init.headers['Authorization'], 'Bearer sk-openai-DECRYPTED', 'apiKey must be in Authorization Bearer header (decrypted)');
    const body = JSON.parse(captured.init.body);
    assert.equal(body.model, 'gpt-4');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[0].content, 'be terse');
    assert.equal(body.messages[1].role, 'user');
    assert.equal(body.messages[1].content, 'ping');
    assert.equal(body.temperature, 0.5);

    assert.equal(result.ok, true);
    assert.equal(result.response, 'pong');
    assert.equal(result.model, 'gpt-4');
});

test('openai.call — surfaces upstream error', async (t) => {
    const restore = installFetchMock(async () => fakeRes({
        status: 429,
        json: { error: { message: 'rate limit exceeded' } },
    }));
    t.after(restore);

    const result = await openai.call({ model: 'm', apiKey: 'k', prompt: 'p' });
    assert.equal(result.ok, false);
    assert.equal(result.status, 429);
    assert.match(result.error, /rate limit/);
});

test('openai.call — network failure surfaces ok:false status 0', async (t) => {
    const restore = installFetchMock(async () => { throw new Error('ECONNREFUSED'); });
    t.after(restore);

    const result = await openai.call({ model: 'm', apiKey: 'k', prompt: 'p' });
    assert.equal(result.ok, false);
    assert.equal(result.status, 0);
    assert.match(result.error, /network failure/);
});

// ─── Dispatcher ─────────────────────────────────────────────

test('dispatcher — routes anthropic provider to anthropic adapter', async (t) => {
    let captured = null;
    const restore = installFetchMock(async (url, init) => {
        captured = { url, init };
        return fakeRes({ status: 200, json: { content: [{ type: 'text', text: 'ok' }], model: 'm' } });
    });
    t.after(restore);

    const { dispatch } = require('../../../src/features/llm/dispatcher');
    const result = await dispatch({
        entry: {
            id: 'a', name: 'A', provider: 'anthropic', model: 'm',
            apiKey: 'sk-ant-decrypted-here', enabled: true,
        },
        prompt: 'hi',
    });
    assert.equal(result.ok, true);
    assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(captured.init.headers['x-api-key'], 'sk-ant-decrypted-here', 'dispatcher must pass the entry.apiKey straight through (the decryption already happened upstream)');
});

test('dispatcher — disabled entry refused without fetch', async (t) => {
    let fetched = false;
    const restore = installFetchMock(async () => { fetched = true; return fakeRes(); });
    t.after(restore);

    const { dispatch } = require('../../../src/features/llm/dispatcher');
    const result = await dispatch({
        entry: { id: 'a', provider: 'anthropic', model: 'm', apiKey: 'k', enabled: false },
        prompt: 'hi',
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /disabled/);
    assert.equal(fetched, false);
});

test('dispatcher — stub providers return 501 with roadmap pointer', async (t) => {
    let fetched = false;
    const restore = installFetchMock(async () => { fetched = true; return fakeRes(); });
    t.after(restore);

    const { dispatch } = require('../../../src/features/llm/dispatcher');
    for (const provider of ['google', 'ollama', 'lmstudio', 'openrouter', 'custom']) {
        const r = await dispatch({
            entry: { id: 'x', provider, model: 'm', apiKey: 'k', enabled: true },
            prompt: 'hi',
        });
        assert.equal(r.ok, false, provider + ' must return ok:false');
        assert.equal(r.status, 501);
        assert.match(r.error, /roadmap/);
    }
    assert.equal(fetched, false, 'no fetch for stub providers');
});

test('dispatcher — unknown provider returns 400 with allowed list', async (t) => {
    const { dispatch } = require('../../../src/features/llm/dispatcher');
    const r = await dispatch({
        entry: { id: 'x', provider: 'made-up-provider', model: 'm', apiKey: 'k', enabled: true },
        prompt: 'hi',
    });
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
    assert.match(r.error, /unknown provider/);
    assert.match(r.error, /anthropic/);
});

test('dispatcher — env var fallback for empty apiKey on supported provider', async (t) => {
    let captured = null;
    const restore = installFetchMock(async (url, init) => {
        captured = init;
        return fakeRes({ status: 200, json: { choices: [{ message: { content: 'ok' } }] } });
    });
    const origEnv = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-env-fallback-decrypted';
    t.after(() => {
        restore();
        if (origEnv === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = origEnv;
    });

    const { dispatch } = require('../../../src/features/llm/dispatcher');
    const r = await dispatch({
        entry: { id: 'x', provider: 'openai', model: 'gpt-4', apiKey: '', enabled: true },
        prompt: 'hi',
    });
    assert.equal(r.ok, true);
    assert.equal(captured.headers['Authorization'], 'Bearer sk-env-fallback-decrypted');
});
