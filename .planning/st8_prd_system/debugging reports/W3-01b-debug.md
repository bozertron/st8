# W3-01b Debug Report — `/api/mvp-lock` Endpoint

**File:** `backend/server.js` — `_handleMvpLock()` method (lines 740–801)  
**Date:** 2026-05-13  
**Status:** RESOLVED

---

## Issues Found

### 1. CRITICAL: POST Request Body Never Consumed → Socket Leak

**Root Cause:**  
The `_handleMvpLock` handler launched an async IIFE immediately on invocation without attaching `req.on('data')` or `req.on('end')` listeners. The POST request body was never drained from the socket.

**Impact:**  
- Node.js HTTP server holds the TCP connection open waiting for the request body to be consumed
- Under load, unclosed sockets accumulate → `ENFILE` / `EMFILE` errors
- Clients experience hung connections (timeout after ~2 minutes)
- SSE connections may also be affected if the server hits its connection limit

**Fix:**  
Wrapped the async logic inside `req.on('end')` callback, with `req.on('data')` to accumulate chunks. This mirrors the pattern used by all other POST handlers in the same file (`_handleIndex`, `_handleFileIntent`, `_handleSettings`, `_handleVerify`, `_handleConceptFile`, `_handleProductionPromote`).

```javascript
// BEFORE (broken)
_handleMvpLock(req, res) {
    // ...method check...
    let persistence;
    (async () => {
        // body never consumed — socket leaks
    })();
}

// AFTER (fixed)
_handleMvpLock(req, res) {
    // ...method check...
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        // body consumed — socket drains properly
    });
}
```

---

### 2. WARNING: No `notificationBus.publish()` Call

**Root Cause:**  
After locking files and logging mutations, the handler did not publish events to the notification bus. All other mutation endpoints (`_handleConceptFile`, `_handleProductionPromote`) publish to the bus to trigger SSE broadcasts and console output.

**Impact:**  
- SSE clients (frontend) never receive `LOCK` mutation events
- No console feedback when files are locked via API
- Frontend state becomes stale — UI doesn't reflect locked files without manual refresh

**Fix:**  
Added `notificationBus.publish()` call inside the lock loop, immediately after `logMutation()`. Each locked file emits a `LOCK` event with `fingerprint`, `filepath`, `mutationType`, and `actor` — consistent with the event schema used by other endpoints.

```javascript
notificationBus.publish({
    fingerprint: file.fingerprint,
    filepath: file.filepath,
    mutationType: 'LOCK',
    actor: 'DEVELOPER'
});
```

---

## Changes Made

| File | Lines | Change |
|------|-------|--------|
| `backend/server.js` | 747–749 | Added `req.on('data')` and `req.on('end')` body consumption |
| `backend/server.js` | 755 | Added `notificationBus` require |
| `backend/server.js` | 778–783 | Added `notificationBus.publish()` call for each locked file |

---

## Verification

- [x] Body is consumed via `req.on('data')` / `req.on('end')` — matches all other POST handlers
- [x] `notificationBus` is required and `publish()` called per locked file
- [x] Event schema (`fingerprint`, `filepath`, `mutationType`, `actor`) matches `_handleConceptFile` and `_handleProductionPromote`
- [x] No changes to response format or status codes
- [x] `persistence.close()` still executes in `finally` block
