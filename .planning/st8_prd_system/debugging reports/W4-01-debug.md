# W4-01 Debug Report — CR-01: _handleProductionPromote Body Size Limit

**Date:** 2026-05-13
**Status:** FIXED
**File:** `backend/server.js`
**Endpoint:** `POST /api/production-promote`

---

## Root Cause

`_handleProductionPromote` (line 940) had a broken body size limit implementation. When the 1KB limit was exceeded, it set `bodyTooLarge = true` but **continued accumulating data** — no early return guard, no buffer clearing, no connection destruction.

The broken code (lines 950-955):
```javascript
req.on('data', chunk => {
    body += chunk;                     // ← keeps accumulating after limit hit
    if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;           // ← flag set but never checked in this handler
    }
});
```

The 413 response was deferred to the `end` event handler, meaning:
- Data kept accumulating unbounded (potential memory exhaustion)
- The request socket stayed open until the client finished sending
- No resource cleanup (`req.destroy()`) occurred

## Why It Wasn't Caught Earlier

All other POST endpoints (`_handleIndex`, `_handleFileIntent`, `_handleSettings`, `_handleVerify`, `_handleConceptFile`, `_handleMvpLock`) use the correct pattern. `_handleProductionPromote` was added in W3-01d and was likely copy-pasted from an earlier draft before the body size pattern was finalized across the codebase.

## Fix Applied

Replaced the broken pattern with the standard pattern used by all other POST endpoints:

```javascript
req.on('data', chunk => {
    if (bodyTooLarge) return;          // ← early return guard
    body += chunk;
    if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        body = '';                      // ← clear accumulated buffer
        req.destroy();                  // ← destroy connection immediately
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
    }
});
req.on('end', async () => {
    if (bodyTooLarge) return;          // ← guard in end handler too
    // ... normal processing
});
```

### Four changes:
1. **Early return guard** — `if (bodyTooLarge) return;` at top of `data` handler stops accumulation
2. **Buffer clear** — `body = ''` releases the accumulated memory
3. **Connection destroy** — `req.destroy()` kills the socket immediately
4. **Immediate 413** — response sent in `data` handler, not deferred to `end`

## Verification

The fixed code now matches the exact pattern in:
- `_handleIndex` (line 237)
- `_handleFileIntent` (line 308)
- `_handleSettings` POST branch (line 423)
- `_handleVerify` (line 536)
- `_handleConceptFile` (line 742)
- `_handleMvpLock` (line 833)

## Security Impact

**Before fix:** An attacker could send a multi-GB POST body to `/api/production-promote` and the server would buffer the entire thing in memory before rejecting it. This is a denial-of-service vector.

**After fix:** Connection is destroyed and buffer freed the moment 1KB is exceeded. No further data is accepted.
