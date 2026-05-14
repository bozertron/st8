# W4-01 Report: HTTP Method Validation + Body Limits

**Task:** W4-01 — HTTP Method Validation + Body Limits (WR-01/02 + WR-07)
**File Modified:** `backend/server.js`
**Syntax Check:** `node -c backend/server.js` — PASSED (no errors)

---

## Summary

Added POST-only method validation to 2 unprotected endpoints and 1KB body size limits to 5 endpoints that were collecting request bodies without size constraints. 2 additional endpoints already had both protections (concept-file, production-promote).

---

## Part 1: POST-Only Method Validation

### Newly Hardened Endpoints

| Endpoint | Handler | Method Check Line | Status |
|---|---|---|---|
| `/api/index` | `_handleIndex` | Line 226 | **NEW** |
| `/api/file-intent` | `_handleFileIntent` | Line 297 | **NEW** |

### Already Hardened (no changes needed)

| Endpoint | Handler | Method Check Line |
|---|---|---|
| `/api/verify` | `_handleVerify` | Line 525 |
| `/api/concept-file` | `_handleConceptFile` | Line 731 |
| `/api/mvp-lock` | `_handleMvpLock` | Line 821 |
| `/api/production-promote` | `_handleProductionPromote` | Line 941 |

### GET-Only Endpoints (no POST body, no validation needed)

| Endpoint | Handler | Reason |
|---|---|---|
| `/api/connection-state.json` | `_serveManifest` (line 166) | Read-only manifest serving |
| `/api/ai-signal.toml` | `_serveToml` (line 190) | Read-only TOML serving |
| `/api/health` | `_serveHealth` (line 214) | Health check, no body |
| `/api/files` | `_handleFileList` (line 471) | Uses query params only |
| `/api/mutations` | `_handleMutationsSSE` (line 719) | SSE stream, GET-based |
| `/api/prd` | `_handlePrd` (line 909) | GET-only PRD generation |

### Dual-Method Endpoint (already handled)

| Endpoint | Handler | Notes |
|---|---|---|
| `/api/settings` | `_handleSettings` (line 394) | GET/POST branching with 405 for other methods (line 455) |

**Implementation Pattern:**
```javascript
// Method validation — POST only
if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
}
```

---

## Part 2: Body Size Limits (1KB)

### Newly Protected Endpoints

| Endpoint | Handler | Body Limit Line | Guard Lines |
|---|---|---|---|
| `/api/index` | `_handleIndex` | Line 233 | `bodyTooLarge` at 235, 238, 241, 250 |
| `/api/file-intent` | `_handleFileIntent` | Line 304 | `bodyTooLarge` at 306, 309, 312, 321 |
| `/api/settings` (POST path) | `_handleSettings` | Line 419 | `bodyTooLarge` at 421, 424, 427, 436 |
| `/api/verify` | `_handleVerify` | Line 532 | `bodyTooLarge` at 534, 537, 540, 549 |
| `/api/mvp-lock` | `_handleMvpLock` | Line 829 | `bodyTooLarge` at 831, 834, 837, 846 |

### Already Protected (no changes needed)

| Endpoint | Handler | Body Limit Line |
|---|---|---|
| `/api/concept-file` | `_handleConceptFile` | Line 738 |
| `/api/production-promote` | `_handleProductionPromote` | Line 947 |

**Implementation Pattern:**
```javascript
// Body size limit: 1KB
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

req.on('end', () => {
    if (bodyTooLarge) return;
    // ... rest of handler
});
```

---

## Integration Points — Line-Specific Detail

### 1. `/api/index` → `_handleIndex` (line 224)

- **POST check:** Line 226 — `if (req.method !== 'POST')` → 405 response
- **Body limit declared:** Line 233 — `const MAX_BODY_SIZE = 1024`
- **Overflow detection:** Line 238-244 — chunk accumulation with early `req.destroy()` + 413 response
- **End guard:** Line 250 — `if (bodyTooLarge) return` prevents JSON parsing on oversized body
- **Body parse:** Line 259 — `JSON.parse(body || '{}')` (unchanged, guarded by bodyTooLarge)

### 2. `/api/file-intent` → `_handleFileIntent` (line 295)

- **POST check:** Line 297 — `if (req.method !== 'POST')` → 405 response
- **Body limit declared:** Line 304 — `const MAX_BODY_SIZE = 1024`
- **Overflow detection:** Line 309-315 — chunk accumulation with early `req.destroy()` + 413 response
- **End guard:** Line 321 — `if (bodyTooLarge) return` prevents JSON parsing on oversized body
- **Body parse:** Line 330 — `JSON.parse(body)` (unchanged, guarded by bodyTooLarge)

### 3. `/api/settings` POST path → `_handleSettings` (line 394)

- **POST check:** Already existed at line 455 (else clause with 405)
- **Body limit declared:** Line 419 — `const MAX_BODY_SIZE = 1024` (inside POST branch)
- **Overflow detection:** Line 424-430 — chunk accumulation with early `req.destroy()` + 413 response
- **End guard:** Line 436 — `if (bodyTooLarge) return` prevents JSON parsing on oversized body
- **Body parse:** Line 438 — `JSON.parse(body)` (unchanged, guarded by bodyTooLarge)

### 4. `/api/verify` → `_handleVerify` (line 523)

- **POST check:** Already existed at line 525
- **Body limit declared:** Line 532 — `const MAX_BODY_SIZE = 1024`
- **Overflow detection:** Line 537-543 — chunk accumulation with early `req.destroy()` + 413 response
- **End guard:** Line 549 — `if (bodyTooLarge) return` prevents JSON parsing on oversized body
- **Body parse:** Line 555 — `JSON.parse(body)` (unchanged, guarded by bodyTooLarge)

### 5. `/api/mvp-lock` → `_handleMvpLock` (line 820)

- **POST check:** Already existed at line 821
- **Body limit declared:** Line 829 — `const MAX_BODY_SIZE = 1024`
- **Overflow detection:** Line 834-840 — chunk accumulation with early `req.destroy()` + 413 response
- **End guard:** Line 846 — `if (bodyTooLarge) return` prevents JSON parsing on oversized body
- **Body parse:** Body is consumed but not parsed (socket drain only) — limit still prevents memory abuse

### 6. `/api/concept-file` → `_handleConceptFile` (line 730) — PRE-EXISTING

- **POST check:** Line 731
- **Body limit:** Line 738
- **No changes made**

### 7. `/api/production-promote` → `_handleProductionPromote` (line 940) — PRE-EXISTING

- **POST check:** Line 941
- **Body limit:** Line 947
- **No changes made**

---

## Error Response Summary

| HTTP Code | Condition | Response Body |
|---|---|---|
| 405 | GET/PUT/DELETE/etc. on POST-only endpoint | `{ "error": "Method not allowed. Use POST." }` |
| 413 | Body exceeds 1KB | `{ "error": "Request body too large. Maximum size is 1KB." }` |
| 400 | Invalid JSON body | `{ "error": "Invalid JSON: ..." }` (existing, preserved) |

---

## Coverage Matrix

| Endpoint | POST-Only | Body Limit (1KB) | Status |
|---|---|---|---|
| `/api/connection-state.json` | N/A (GET) | N/A (no body) | ✓ N/A |
| `/api/ai-signal.toml` | N/A (GET) | N/A (no body) | ✓ N/A |
| `/api/health` | N/A (GET) | N/A (no body) | ✓ N/A |
| `/api/index` | ✓ Line 226 | ✓ Line 233 | **HARDENED** |
| `/api/file-intent` | ✓ Line 297 | ✓ Line 304 | **HARDENED** |
| `/api/settings` | ✓ Line 455 | ✓ Line 419 | **HARDENED** (POST path) |
| `/api/verify` | ✓ Line 525 | ✓ Line 532 | **HARDENED** |
| `/api/files` | N/A (GET) | N/A (no body) | ✓ N/A |
| `/api/mutations` | N/A (SSE) | N/A (no body) | ✓ N/A |
| `/api/concept-file` | ✓ Line 731 | ✓ Line 738 | ✓ Pre-existing |
| `/api/mvp-lock` | ✓ Line 821 | ✓ Line 829 | **HARDENED** |
| `/api/prd` | N/A (GET) | N/A (no body) | ✓ N/A |
| `/api/production-promote` | ✓ Line 941 | ✓ Line 947 | ✓ Pre-existing |

**Total endpoints:** 13
**Endpoints needing POST validation:** 8 → All 8 have it (2 new + 6 pre-existing)
**Endpoints needing body limits:** 7 → All 7 have it (5 new + 2 pre-existing)
**Endpoints N/A (GET/SSE, no body):** 6 → Correctly excluded

---

## Verification

```bash
$ node -c backend/server.js
# Exit 0 — syntax valid
```

Manual test: `curl -X GET http://localhost:3847/api/index` should return 405.
Manual test: `curl -X POST http://localhost:3847/api/index -d '{"path":"/tmp"}' -H 'Content-Type: application/json'` should work (if target dir configured).
Manual test: `curl -X POST http://localhost:3847/api/index -d '{"data":"'$(python3 -c "print('x'*2000)")'"}'` should return 413.
