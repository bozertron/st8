---
scope: /api/concept-file endpoint (_handleConceptFile method)
reviewed: 2026-05-13T00:00:00Z
depth: standard
file: backend/server.js
lines: 650-712
findings:
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# /api/concept-file Endpoint Review

**Reviewed:** 2026-05-13
**File:** `backend/server.js:650-712`
**Status:** issues_found

## Summary

The `_handleConceptFile` method is correctly wired in the switch statement (line 109) and follows the same structural pattern as sibling endpoints. Core functionality — POST-only validation, persistence calls, notificationBus publish, and cleanup in `finally` — is properly implemented. Two warnings need attention: malformed JSON returns 500 instead of 400, and there is no body size limit.

## Checklist

| Check | Status | Notes |
|---|---|---|
| Route in switch statement | ✅ | Line 109: `case '/api/concept-file'` → `_handleConceptFile` |
| POST-only validation | ✅ | Line 651-655: returns 405 for non-POST |
| Body parsing | ⚠️ | JSON.parse in try/catch, but returns 500 for bad JSON |
| Input validation | ✅ | Line 664: `filepath` required check, returns 400 |
| `registerConceptFile()` | ✅ | Line 676: called with correct args, returns fingerprint |
| `upsertIntent()` | ✅ | Line 683: conditional on intent fields, correct args |
| `notificationBus.publish()` | ✅ | Line 693: called with fingerprint, filepath, mutationType |
| Error handling (try/catch) | ✅ | Line 702: catch with `headersSent` guard |
| Cleanup (finally) | ✅ | Line 708-710: `persistence.close()` if initialized |
| Syntax errors | ✅ | None found |

## Warnings

### WR-01: Malformed JSON returns 500 instead of 400

**File:** `backend/server.js:662`
**Issue:** `JSON.parse(body)` is inside the generic try/catch block. If the request body is malformed JSON, the thrown `SyntaxError` is caught at line 702 and returned as a 500 Internal Server Error. Malformed input is a client error and should return 400 Bad Request.
**Fix:**
```javascript
// At line 662, wrap JSON.parse with input-error handling:
let parsed;
try {
    parsed = JSON.parse(body);
} catch (parseErr) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
    return;
}
const { filepath, purpose, dependsOnBehavior, valueStatement } = parsed;
```

### WR-02: No body size limit on request payload

**File:** `backend/server.js:657-658`
**Issue:** The `req.on('data')` handler appends chunks to `body` without any size cap. A malicious client can send an arbitrarily large payload, causing unbounded memory allocation. This is a resource exhaustion risk.
**Fix:**
```javascript
let body = '';
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
req.on('data', chunk => {
    body += chunk;
    if (body.length > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        req.destroy();
        return;
    }
});
```

## Info

### IN-01: Error message leaks internal details to client

**File:** `backend/server.js:706`
**Issue:** The catch block sends `err.message` directly in the 500 response JSON. For database errors or unexpected failures, this can expose internal implementation details (table names, SQL errors, file paths) to the caller. The error is already logged server-side at line 703.
**Fix:** Send a generic message for 500 errors:
```javascript
if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
}
```

### IN-02: No `req.on('error')` handler for stream errors

**File:** `backend/server.js:657-711`
**Issue:** The request stream has `data` and `end` handlers but no `error` handler. If the underlying TCP connection drops or the request stream errors, the `end` event may never fire, leaving the response hanging until the client times out. Low risk in practice but worth noting for robustness.
**Fix:**
```javascript
req.on('error', (err) => {
    console.error('[st8:server] Concept file request stream error:', err.message);
    if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request stream error' }));
    }
});
```

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
