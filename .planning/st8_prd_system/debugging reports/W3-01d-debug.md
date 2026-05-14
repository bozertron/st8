# W3-01d Debug Report — /api/production-promote

**Date:** 2026-05-13
**File:** backend/server.js
**Method:** `_handleProductionPromote` (line 882)
**Status:** FIXED

---

## Issues Found

### Issue 1: No Body Size Limit

**Problem:** The handler accumulated request body chunks with no size limit:
```js
let body = '';
req.on('data', chunk => { body += chunk; });
```
An attacker could send an arbitrarily large POST body, consuming unbounded memory.

**Fix:** Added a 1KB (`MAX_BODY_SIZE = 1024`) body size limit with early termination. When the accumulated body exceeds the limit, the `bodyTooLarge` flag is set. On `'end'`, if the flag is set, responds with `413 Payload Too Large`.

### Issue 2: JSON Parse Errors Return 500 Instead of 400

**Problem:** `JSON.parse(body)` was inside the outer `try/catch` block that catches all errors and returns `500 Internal Server Error`. A malformed JSON body (e.g. `{invalid}`) would trigger a `SyntaxError`, caught by the outer handler, resulting in a misleading 500 response.

**Fix:** Wrapped `JSON.parse(body)` in its own inner `try/catch`. On `SyntaxError`, responds with `400 Bad Request` and `{ error: 'Invalid JSON body' }` before reaching the outer catch.

---

## Changes Made

**File:** `backend/server.js`

| Lines | Change |
|-------|--------|
| 889-903 | Added `MAX_BODY_SIZE` constant, `bodyTooLarge` flag in `data` handler, and 413 response check in `end` handler |
| 907-914 | Wrapped `JSON.parse(body)` in inner `try/catch`, returning 400 for `SyntaxError` |

---

## Verification

- **Body limit:** A POST with body > 1KB now returns `413 Payload Too Large`
- **Invalid JSON:** A POST with malformed JSON now returns `400 Bad Request` with `{ error: 'Invalid JSON body' }`
- **Valid request:** Normal requests with valid JSON and body ≤ 1KB continue to work unchanged
