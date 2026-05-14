# W3-01a Debug Report — /api/concept-file Endpoint Fixes

**Date:** 2026-05-13
**File:** `backend/server.js`
**Method:** `_handleConceptFile` (lines 650-712)

---

## Issues Addressed

### Issue 1: JSON.parse returns 500 for malformed JSON

**Root Cause:**
Line 662 had `JSON.parse(body)` inside a generic `try/catch` block. When malformed JSON was submitted, `JSON.parse` threw a `SyntaxError`, which was caught by the outer catch at line 702 and returned HTTP 500 with the error message. Malformed client input is a client error (400), not a server error (500).

**Fix Applied:**
Added a dedicated `try/catch` around `JSON.parse(body)` that catches `SyntaxError` specifically and returns HTTP 400 with a descriptive error message:

```javascript
let parsed;
try {
    parsed = JSON.parse(body);
} catch (parseErr) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON: ' + parseErr.message }));
    return;
}
```

**Before:** `POST /api/concept-file` with body `{invalid` → 500 Internal Server Error
**After:** `POST /api/concept-file` with body `{invalid` → 400 Bad Request

---

### Issue 2: No body size limit

**Root Cause:**
Lines 657-658 accumulated request body chunks without any size constraint:
```javascript
let body = '';
req.on('data', chunk => { body += chunk; });
```
An attacker could send arbitrarily large payloads, causing memory exhaustion.

**Fix Applied:**
Added a 1KB (1024 byte) body size limit with request destruction on overflow:

```javascript
const MAX_BODY_SIZE = 1024;
let body = '';
let bodyTooLarge = false;

req.on('data', chunk => {
    if (bodyTooLarge) return;
    body += chunk;
    if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        body = '';
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
    }
});
```

**Behavior:**
- Request body ≤ 1024 bytes: processed normally
- Request body > 1024 bytes: request destroyed, HTTP 413 returned, further data chunks ignored

---

## Verification

| Test Case | Expected | Status |
|-----------|----------|--------|
| Valid JSON with filepath | 200 OK | ✓ |
| Malformed JSON (`{invalid`) | 400 Bad Request | ✓ |
| Body > 1KB | 413 Request Entity Too Large | ✓ |
| Body exactly 1KB | 200 OK (processed) | ✓ |

---

## Files Changed

- `backend/server.js` — `_handleConceptFile` method: added JSON parse error handling and body size limit
