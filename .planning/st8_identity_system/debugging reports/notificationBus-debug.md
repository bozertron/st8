# notificationBus.js — Debug Report

**File:** `backend/notificationBus.js`
**Date:** 2026-05-13
**Issues:** CR-01, CR-02

---

## CR-01: Missing `res.on('error')` on SSE clients

### Problem

The `addSSEClient()` method registers a `'close'` event handler on each SSE response object but does **not** register an `'error'` handler.

In Node.js, if an `'error'` event fires on a stream/socket with no registered listener, the error is thrown as an **uncaught exception**. This crashes the entire server process.

### Root Cause

Line 85–87 (original) only handled graceful disconnects:

```js
res.on('close', () => {
    this.sseClients.delete(res);
});
```

Socket-level errors — network drops, client browser crashes, proxy timeouts, firewall resets — emit an `'error'` event, not a `'close'` event. Without a handler, Node.js default behavior is to throw:

```
Error: read ECONNRESET
    at TCP.onStreamRead (node:internal/stream_base_commons:217:20)
```

This is a **process-fatal** unhandled exception in production.

### Fix

Added `res.on('error', ...)` handler that:
1. Removes the client from `this.sseClients` (same cleanup as `'close'`)
2. Attempts `res.end()` wrapped in try/catch (socket may already be destroyed)
3. Logs nothing to avoid noise — SSE client errors are expected in production

```js
res.on('error', (err) => {
    this.sseClients.delete(res);
    try { res.end(); } catch (_) { /* already destroyed */ }
});
```

### Impact

| Before | After |
|--------|-------|
| Any SSE socket error crashes the server | Socket errors are silently cleaned up |
| Single client network drop kills all clients | Only the affected client is removed |
| No recovery path — requires process restart | Self-healing, server continues normally |

---

## CR-02: Uncaught listener exceptions abort `publish()` pipeline

### Problem

The `publish()` method calls `this.emit('mutation', enriched)` and `this.emit(...)` **without try/catch**. In Node.js `EventEmitter`, if any listener registered for an event throws, the exception propagates back to the `emit()` caller.

This means:
1. A single buggy subscriber can crash the entire `publish()` call
2. SSE broadcast (step 2), console output (step 3), and printer fallback (step 4) are **all silently skipped**
3. No error is logged — the failure is invisible

### Root Cause

Lines 40–41 (original) were bare `emit()` calls:

```js
this.emit('mutation', enriched);
this.emit(`mutation:${event.mutationType}`, enriched);
```

If a subscriber does something like:

```js
bus.on('mutation', (event) => {
    // Bug: accessing undefined property
    console.log(event.metadata.nested.value); // throws TypeError
});
```

The TypeError propagates out of `publish()`, and the remaining pipeline (SSE → console → printer) never executes. The mutation is effectively lost for all downstream consumers.

### Fix

Wrapped the `emit()` calls in try/catch with a descriptive error message:

```js
try {
    this.emit('mutation', enriched);
    this.emit(`mutation:${event.mutationType}`, enriched);
} catch (err) {
    console.error('[st8:notify] Subscriber listener threw:', err.message);
}
```

### Impact

| Before | After |
|--------|-------|
| One bad subscriber silences all downstream consumers | Bad subscriber is isolated; pipeline continues |
| SSE clients never receive the event | SSE broadcast proceeds normally |
| Console output is skipped (no audit trail) | Console log still prints |
| Printer fallback is skipped | Printer fallback still executes |
| No error logging | Error is logged with descriptive prefix |

---

## Verification

1. **Syntax check:** `node -c notificationBus.js` — passes with no errors
2. **CR-01 test scenario:** Connect an SSE client, then kill the client process (simulating network drop). Before fix: server crashes with `ECONNRESET`. After fix: client is removed from `sseClients`, server continues.
3. **CR-02 test scenario:** Register a throwing listener:
   ```js
   bus.on('mutation', () => { throw new Error('bad listener'); });
   bus.publish({ mutationType: 'EDIT', filepath: '/test', actor: 'test' });
   ```
   Before fix: `publish()` throws, SSE/console/printer all skipped. After fix: error is logged, SSE/console/printer all execute normally.

---

## Files Changed

- `backend/notificationBus.js` — 2 changes
  - Added `res.on('error', ...)` handler in `addSSEClient()` (lines 95–101)
  - Wrapped `this.emit()` calls in try/catch in `publish()` (lines 42–47)
