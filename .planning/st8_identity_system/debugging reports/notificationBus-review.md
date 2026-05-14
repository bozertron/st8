# notificationBus.js — Code Review

**Reviewed:** 2026-05-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** FAIL

---

## Summary

The `NotificationBus` module implements an event-driven notification system with four output channels: EventEmitter in-process pub/sub, SSE streaming, console logging, and a printer fallback. The module is 107 lines, well-structured, and uses `'use strict'` mode. However, it has **2 critical issues** related to unhandled error events that can crash the Node.js process, plus several warnings around SSE robustness and defensive coding.

---

## Critical Issues

### CR-01: Missing `res.on('error')` handler on SSE clients — can crash the process

**File:** `backend/notificationBus.js:85-87`

**Issue:** In `addSSEClient()`, only `res.on('close')` is registered. There is no `res.on('error')` handler. Node.js streams emit `'error'` events for network interruptions, client crashes, and socket timeouts. Per Node.js documentation, if an `'error'` event is emitted with no listener, it is thrown as an uncaught exception — crashing the entire server process.

The `'error'` event can fire before or instead of `'close'`, so the existing close handler does not protect against this.

**Fix:**
```javascript
res.on('close', () => {
    this.sseClients.delete(res);
});

res.on('error', () => {
    this.sseClients.delete(res);
});
```

Alternatively, a single handler can cover both:
```javascript
const cleanup = () => this.sseClients.delete(res);
res.on('close', cleanup);
res.on('error', cleanup);
```

---

### CR-02: Unhandled exception in EventEmitter listeners aborts entire `publish()` pipeline

**File:** `backend/notificationBus.js:40-41`

**Issue:** The `publish()` method calls `this.emit('mutation', enriched)` and `this.emit(\`mutation:${event.mutationType}\`, enriched)` with no try/catch. If any registered listener throws synchronously, the exception propagates up and the remaining pipeline is skipped: SSE broadcast, console output, and printer fallback all silently fail.

Additionally, Node.js `EventEmitter` has special-case behavior for the `'error'` event type. While this class doesn't explicitly emit `'error'`, a misbehaving subscriber could cause an unhandled throw that crashes the process.

**Fix:**
```javascript
// 1. EventEmitter for in-process subscribers
try {
    this.emit('mutation', enriched);
} catch (err) {
    console.error('[st8:notify] EventEmitter "mutation" listener error:', err.message);
}

try {
    this.emit(`mutation:${event.mutationType}`, enriched);
} catch (err) {
    console.error('[st8:notify] EventEmitter listener error:', err.message);
}
```

---

## Warnings

### WR-01: No SSE heartbeat/keepalive mechanism

**File:** `backend/notificationBus.js:66-90`

**Issue:** SSE connections are opened with no periodic keepalive. Any proxy, reverse proxy (nginx), or load balancer in the path will terminate idle connections (typically after 60s). The SSE spec supports sending comment lines (`:heartbeat\n\n`) as keepalive pings.

**Fix:** Add a keepalive interval in `addSSEClient()`:
```javascript
const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); }
    catch (err) { clearInterval(heartbeat); }
}, 30000);

res.on('close', () => {
    clearInterval(heartbeat);
    this.sseClients.delete(res);
});
```

---

### WR-02: No input validation on `event` parameter in `publish()`

**File:** `backend/notificationBus.js:33`

**Issue:** `publish()` accesses `event.mutationType`, `event.filepath`, `event.fingerprint`, `event.actor`, and `event.schemaCard` without any null/undefined guard. Calling `publish(null)` or `publish(undefined)` throws `TypeError: Cannot read properties of null (reading 'mutationType')`, which is an unhandled crash.

While callers in `index.js` always pass valid objects, the `NotificationBus` class is exported and part of the public API. Defensive validation is expected.

**Fix:**
```javascript
publish(event) {
    if (!event || typeof event !== 'object') {
        console.error('[st8:notify] publish() called with invalid event:', event);
        return;
    }
    // ... rest of method
}
```

---

### WR-03: Wildcard CORS header on SSE endpoint

**File:** `backend/notificationBus.js:77`

**Issue:** `'Access-Control-Allow-Origin': '*'` allows any origin to connect to the SSE stream and receive real-time mutation events. For a local development tool, this is likely acceptable. For any deployment scenario, this exposes file mutation data to any origin.

**Fix:** If this is intended for local-only use, consider restricting to the actual origin:
```javascript
'Access-Control-Allow-Origin': req.headers.origin || 'http://localhost:3000'
```
Or accept this as intentional for a dev tool and document the decision.

---

### WR-04: SSE events lack `id` field — breaks reconnection replay

**File:** `backend/notificationBus.js:96`

**Issue:** SSE events are written as `data: ${data}\n\n` without an `id:` field. The SSE spec supports `id:` fields which enable browsers to send `Last-Event-ID` on reconnection, allowing the server to replay missed events. Without IDs, any reconnection after a dropped connection silently loses events.

**Fix:**
```javascript
_broadcastSSE(event) {
    const data = JSON.stringify(event);
    const id = Date.now(); // or a monotonic counter
    for (const client of this.sseClients) {
        try {
            client.write(`id: ${id}\ndata: ${data}\n\n`);
        } catch (err) {
            this.sseClients.delete(client);
        }
    }
}
```

---

## Info

### IN-01: `maxSseClients` uses `||` instead of `??` — falsy value misinterpreted

**File:** `backend/notificationBus.js:22`

**Issue:** `options.maxSseClients || 10` treats `0` as falsy, so `new NotificationBus({ maxSseClients: 0 })` silently becomes `maxSseClients: 10`. Use nullish coalescing (`??`) to only apply the default for `null`/`undefined`.

**Fix:**
```javascript
this.maxSseClients = options.maxSseClients ?? 10;
```

---

### IN-02: Console output may log `undefined` for missing fields

**File:** `backend/notificationBus.js:52`

**Issue:** The expression `event.filepath || event.fingerprint` will evaluate to `undefined` if both are missing, producing log output like `[st8:notify] · undefined — undefined by undefined`.

**Fix:**
```javascript
const label = event.filepath || event.fingerprint || '(unknown)';
console.log(`[st8:notify] ${status} ${label} — ${event.mutationType || '?'} by ${event.actor || '?'}`);
```

---

## Findings Summary

| ID | Severity | Issue |
|----|----------|-------|
| CR-01 | CRITICAL | Missing `res.on('error')` — unhandled stream error crashes process |
| CR-02 | CRITICAL | Listener throw aborts entire publish pipeline |
| WR-01 | WARNING | No SSE heartbeat — proxies will kill idle connections |
| WR-02 | WARNING | No input validation on `publish()` — null crashes |
| WR-03 | WARNING | Wildcard `Access-Control-Allow-Origin` |
| WR-04 | WARNING | No SSE `id` field — reconnection loses events |
| IN-01 | INFO | `\|\|` vs `??` for maxSseClients default |
| IN-02 | INFO | Potential `undefined` in console output |

**Total: 2 CRITICAL, 4 WARNING, 2 INFO**

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
