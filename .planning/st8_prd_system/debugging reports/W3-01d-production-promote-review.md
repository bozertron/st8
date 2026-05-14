# Code Review: `/api/production-promote` Endpoint

**Reviewed:** 2026-05-13T09:55:00Z  
**File:** `backend/server.js` (lines 856-902)  
**Scope:** `_handleProductionPromote` method only  
**Status:** issues_found  

---

## Summary

The `/api/production-promote` endpoint is correctly wired in the route switch (line 118-120) and the handler implements the required flow: POST validation → body parsing → fingerprint check → purge → notify → respond. However, there are two actionable issues: one security concern (no body size limit) and one robustness gap (JSON parse errors return 500 instead of 400).

---

## Critical Issues

None.

---

## Warnings

### WR-01: No request body size limit — potential memory exhaustion

**File:** `backend/server.js:863-864`  
**Issue:** The body accumulator `body += chunk` has no upper bound. A malicious or buggy client can send an arbitrarily large POST body, causing unbounded memory growth. This is a systemic issue across all POST handlers in this file, but since `/api/production-promote` is a destructive operation (purges data), a DoS via memory exhaustion is especially concerning.  
**Fix:** Add a body size check inside the `data` handler:
```javascript
const MAX_BODY = 1024; // 1KB is more than enough for { "fingerprint": "..." }
let body = '';
req.on('data', chunk => {
    body += chunk;
    if (body.length > MAX_BODY) {
        body = '';
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
    }
});
```

---

## Info

### IN-01: JSON parse errors return 500 instead of 400

**File:** `backend/server.js:868`  
**Issue:** If the POST body is empty or contains invalid JSON, `JSON.parse(body)` throws a `SyntaxError`. The catch block (line 892) returns HTTP 500 for all errors. A malformed request body is a client error (400), not a server error (500). This makes debugging harder for API consumers.  
**Fix:** Add a specific check before the generic catch:
```javascript
try {
    const { fingerprint } = JSON.parse(body);
} catch (parseErr) {
    if (parseErr instanceof SyntaxError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
        return;
    }
    throw parseErr; // re-throw non-parse errors
}
```
Alternatively, use the pattern already established in `_handleIndex` (line 230):
```javascript
const { fingerprint } = JSON.parse(body || '{}');
```
This gracefully handles empty bodies (fingerprint will be `undefined`, caught by the existing check on line 870).

### IN-02: Fingerprint value not validated beyond truthiness

**File:** `backend/server.js:870`  
**Issue:** The check `if (!fingerprint)` rejects `null`, `undefined`, `""`, `0`, and `false`, but accepts any other value — including non-string types like `true`, numbers, arrays, or objects. The downstream `purgeDevelopmentData` passes the fingerprint directly to SQL prepared statements (safe from injection), but passing unexpected types could cause silent data corruption (e.g., `fingerprint: 12345` would not match string fingerprints in the DB).  
**Fix:** Add a type/shape check:
```javascript
if (typeof fingerprint !== 'string' || fingerprint.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'fingerprint must be a non-empty string' }));
    return;
}
```

---

## Verification Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Route registered in switch statement | ✅ | Line 118: `case '/api/production-promote':` |
| Method validation (POST only) | ✅ | Line 857: returns 405 for non-POST |
| Body parsing | ✅ | Lines 863-864: standard chunk accumulation |
| Input validation (fingerprint required) | ✅ | Line 870: checks truthiness |
| Calls `persistence.purgeDevelopmentData()` | ✅ | Line 882: passes fingerprint, captures result |
| Publishes PRODUCTION mutation | ✅ | Lines 884-888: correct event shape |
| Error handling | ✅ | Lines 892-897: catch with `headersSent` guard |
| Persistence cleanup in finally | ✅ | Line 899: `if (persistence) persistence.close()` |
| No syntax errors | ✅ | Method is syntactically valid |
| `close()` handles partial init | ✅ | `persistence.close()` checks `if (this.db)` before closing (persistence.js:482) |

---

_Reviewed: 2026-05-13T09:55:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_  
