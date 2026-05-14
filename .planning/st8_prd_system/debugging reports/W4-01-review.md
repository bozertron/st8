# W4-01 Code Review: POST Validation & Body Size Limits

**Reviewed:** 2026-05-13T10:05:00Z
**Depth:** standard
**File:** `backend/server.js`
**Status:** issues_found

---

## Summary

POST-only validation and body size limits were added to API endpoints. Both `/api/index` and `/api/file-intent` correctly enforce POST-only. However, `_handleProductionPromote` has an **inconsistent** body size limit implementation that fails to stop data accumulation after the limit is hit, potentially allowing unbounded memory consumption.

No syntax errors found.

---

## Critical Issues

### CR-01: `_handleProductionPromote` body size limit does not stop data accumulation

**File:** `backend/server.js:950-955`
**Issue:** The body size check in `_handleProductionPromote` sets `bodyTooLarge = true` but does **not**:
1. Return early from the `data` handler (so subsequent chunks still append to `body`)
2. Clear `body` (so the full oversized payload stays in memory)
3. Call `req.destroy()` (so the connection stays open until the client finishes sending)
4. Send the 413 response immediately (it's deferred to the `end` handler)

Every other POST endpoint in this file uses the correct pattern. This one was missed.

**Current code (broken):**
```javascript
req.on('data', chunk => {
    body += chunk;
    if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        // body continues to grow!
        // connection stays open!
    }
});
req.on('end', async () => {
    if (bodyTooLarge) {
        res.writeHead(413, ...);
        res.end(...);
        return;
    }
    // ...
});
```

**Fix — match the pattern used by all other endpoints:**
```javascript
req.on('data', chunk => {
    if (bodyTooLarge) return;       // ← ADD: stop processing
    body += chunk;
    if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        body = '';                   // ← ADD: free memory
        req.destroy();               // ← ADD: terminate connection
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large (max 1KB)' }));
    }
});
req.on('end', async () => {
    if (bodyTooLarge) return;
    // ... rest of handler unchanged
});
```

**Impact:** A client can send an arbitrarily large POST body to `/api/production-promote`. The server will buffer the entire payload in memory before rejecting it at the `end` event. This is a resource exhaustion vector.

---

## Warnings

### WR-01: Redundant `require()` calls shadow top-level imports

**File:** `backend/server.js:573-575`
**Issue:** Inside `_handleVerify`, `path` and `fs` are re-required despite being imported at the top of the file (lines 13-14). Only `crypto` is new.

```javascript
// Lines 573-575 (inside _handleVerify)
const path = require('path');   // redundant — already line 14
const fs = require('fs');       // redundant — already line 13
const crypto = require('crypto'); // new, keep this one
```

**Fix:** Remove the redundant re-requires:
```javascript
const crypto = require('crypto');
// path and fs are already available from top-level imports
```

---

## Verified Correct

| Endpoint | POST-only guard | Body size limit |
|---|---|---|
| `/api/index` → `_handleIndex` | ✅ line 226 | ✅ line 233 (1KB, proper pattern) |
| `/api/file-intent` → `_handleFileIntent` | ✅ line 297 | ✅ line 304 (1KB, proper pattern) |
| `/api/settings` → `_handleSettings` | ✅ line 416 | ✅ line 419 (1KB, proper pattern) |
| `/api/verify` → `_handleVerify` | ✅ line 524 | ✅ line 532 (1KB, proper pattern) |
| `/api/concept-file` → `_handleConceptFile` | ✅ line 731 | ✅ line 738 (1KB, proper pattern) |
| `/api/mvp-lock` → `_handleMvpLock` | ✅ line 821 | ✅ line 829 (1KB, proper pattern) |
| `/api/production-promote` → `_handleProductionPromote` | ✅ line 941 | ❌ line 947 (inconsistent — see CR-01) |

---

## Info

No info-level findings.

---

_Reviewed: 2026-05-13T10:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
