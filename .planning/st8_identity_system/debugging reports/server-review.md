# Server Review: `backend/server.js`

**Reviewed:** 2026-05-13T17:30:00Z
**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/server.js` (635 lines)
**Cross-referenced:** `backend/notificationBus.js` (107 lines), `backend/persistence.js` (493 lines)
**Status:** **FAIL** — 2 critical issues, 8 warnings, 2 info items found

---

## Summary

The file implements an HTTP server with static file serving, REST API endpoints, and an SSE mutation stream. The core architecture is sound — parameterized persistence queries, bounded SSE clients, directory traversal checks on static files. However, there are two critical security issues: (1) the SSE endpoint's CORS header is set to `*` by `notificationBus.addSSEClient()`, overriding the server's intentional localhost-only CORS policy, and (2) the `_handleFileList` path traversal guard uses `startsWith` which can be bypassed by sibling directories (e.g., `/home/bozertron2` passes the check for `/home/bozertron`). Several warnings cover missing HTTP method validation on write endpoints, persistence resource leaks on initialization failure, and unbounded request body accumulation.

---

## Critical Issues

### CR-01: SSE endpoint CORS wildcard overrides restricted policy — any origin can read mutation stream

**File:** `backend/server.js:107` (dispatch) → `backend/notificationBus.js:73-78` (override)
**Severity:** CRITICAL

The server intentionally restricts CORS to `http://localhost:<port>` at line 60. However, when the SSE endpoint dispatches to `notificationBus.addSSEClient(res)`, that method calls `res.writeHead(200, { 'Access-Control-Allow-Origin': '*' })` which **overrides** the previously set header. In Node.js, `writeHead()` takes precedence over prior `setHeader()` calls for the same header name.

This means any malicious webpage can connect to `GET /api/mutations` and receive real-time mutation events (file paths, fingerprints, mutation types) via `EventSource`.

**Evidence:**
```javascript
// server.js:60 — restricted CORS (set via setHeader)
res.setHeader('Access-Control-Allow-Origin', 'http://localhost:' + this.port);

// server.js:107 — dispatches to notificationBus
case '/api/mutations':
    this._handleMutationsSSE(req, res);
    break;

// notificationBus.js:73-78 — overrides with wildcard via writeHead
res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'  // ← OVERRIDES server.js:60
});
```

**Fix:**
Option A — Pass the allowed origin into the notification bus:
```javascript
// notificationBus.js:66 — accept origin parameter
addSSEClient(res, allowedOrigin) {
    // ...
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': allowedOrigin || 'http://localhost:3847'
    });
```

```javascript
// server.js:619 — pass the origin
_handleMutationsSSE(req, res) {
    const { notificationBus } = require('./notificationBus');
    notificationBus.addSSEClient(res, 'http://localhost:' + this.port);
}
```

Option B — Set the CORS header in `server.js` before dispatch and remove it from `notificationBus.addSSEClient()`.

---

### CR-02: Path traversal in `_handleFileList` — `startsWith` bypassed by sibling directories

**File:** `backend/server.js:401-413`
**Severity:** CRITICAL

The directory traversal guard uses `String.startsWith()` which matches prefixes, not path boundaries. An attacker can access sibling directories whose names share the same prefix.

**Evidence:**
```javascript
// Line 408-409
const homeDir = os.homedir();  // e.g., '/home/bozertron'
if (!resolvedPath.startsWith(homeDir) && !resolvedPath.startsWith(this.targetDir)) {
```

Bypass examples:
```
homeDir = '/home/bozertron'

'/home/bozertron2/evil'.startsWith('/home/bozertron')     → true  ← BYPASS!
'/home/bozertronx/secrets'.startsWith('/home/bozertron')  → true  ← BYPASS!
```

Similarly for `targetDir`:
```
targetDir = '/home/bozertron/project'

'/home/bozertron/project-malicious'.startsWith('/home/bozertron/project')  → true  ← BYPASS!
```

**Fix:**
```javascript
// Use path.relative() to check containment, not string prefix
const homeDir = os.homedir();
const relToHome = path.relative(homeDir, resolvedPath);
const relToTarget = this.targetDir ? path.relative(this.targetDir, resolvedPath) : null;

const isUnderHome = !relToHome.startsWith('..') && !path.isAbsolute(relToHome);
const isUnderTarget = relToTarget && !relToTarget.startsWith('..') && !path.isAbsolute(relToTarget);

if (!isUnderHome && !isUnderTarget) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access denied: path outside allowed scope' }));
    return;
}
```

Or alternatively, append `path.sep` to the prefix:
```javascript
if (!resolvedPath.startsWith(homeDir + path.sep) && resolvedPath !== homeDir &&
    !resolvedPath.startsWith(this.targetDir + path.sep) && resolvedPath !== this.targetDir) {
```

---

## Warnings

### WR-01: No HTTP method validation on `/api/index` — GET triggers unintended re-index

**File:** `backend/server.js:91-93` (dispatch), `212-258` (handler)
**Severity:** WARNING

`_handleIndex` doesn't check `req.method`. A GET request to `/api/index` will parse an empty body as `{}`, resolve `requestedPath` to `undefined`, fall back to `this.targetDir`, and trigger a full directory re-index. This is a write operation exposed on GET.

**Evidence:**
```javascript
// Line 218 — empty body becomes {}
const { path: requestedPath } = JSON.parse(body || '{}');
// Line 219 — falls back to this.targetDir
const targetDir = requestedPath || this.targetDir;
// Proceeds to indexDirectory() → writeManifests() ← writes files
```

**Fix:**
```javascript
_handleIndex(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
        return;
    }
    // ... rest of handler
}
```

---

### WR-02: No HTTP method validation on `/api/file-intent` — GET triggers error path

**File:** `backend/server.js:94-96` (dispatch), `260-333` (handler)
**Severity:** WARNING

`_handleFileIntent` doesn't check `req.method`. A GET request will have an empty body, causing `JSON.parse(body)` at line 265 to throw `SyntaxError: Unexpected end of JSON input`. While the error is caught, it produces a confusing 500 error instead of a proper 405.

**Fix:**
```javascript
_handleFileIntent(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
        return;
    }
    // ... rest of handler
}
```

---

### WR-03: Persistence resource leak when `initialize()` rejects in `_handleFileIntent`

**File:** `backend/server.js:267-327`
**Severity:** WARNING

When `persistence.initialize()` rejects (e.g., corrupt database, permission error), the `.catch()` handler sends an error response but never closes the persistence instance. If `initialize()` partially opened the database before failing, the handle leaks.

**Evidence:**
```javascript
// Line 267-269
const persistence = new St8Persistence();
persistence.initialize().then(() => {
    try { /* ... */ } finally { persistence.close(); }
}).catch(err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
    // MISSING: persistence.close()
});
```

**Fix:**
```javascript
}).catch(err => {
    try { persistence.close(); } catch (_) {}  // safe cleanup
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
});
```

---

### WR-04: Same persistence resource leak in `_handleSettings`

**File:** `backend/server.js:336-393`
**Severity:** WARNING

Same pattern as WR-03. If `persistence.initialize()` rejects, the `.catch()` at line 389-392 sends an error response but doesn't close the persistence instance.

**Fix:**
```javascript
}).catch(err => {
    try { persistence.close(); } catch (_) {}
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
});
```

---

### WR-05: Redundant `require()` calls shadow top-level imports in `_handleVerify`

**File:** `backend/server.js:472-474`
**Severity:** WARNING

`_handleVerify` re-requires `path`, `fs`, and `crypto` inside the method body, shadowing the `path` and `fs` already imported at the module top level (lines 13-14). While Node.js module caching returns the same objects, this is redundant and misleading — it looks like different modules are being loaded.

**Evidence:**
```javascript
// Line 12-14 — top-level imports
const http = require('http');
const fs = require('fs');
const path = require('path');

// Lines 472-474 — redundant re-imports inside _handleVerify
const path = require('path');    // shadows line 14
const fs = require('fs');        // shadows line 13
const crypto = require('crypto'); // new, but should be at top
```

**Fix:** Remove lines 472-473, add `crypto` to the top-level imports:
```javascript
// Top of file (line 12-15)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Inside _handleVerify — delete lines 472-474
```

---

### WR-06: Health endpoint leaks internal filesystem path

**File:** `backend/server.js:207`
**Severity:** WARNING

The `/api/health` endpoint returns `targetDir` in its response, exposing the internal directory structure. While the server binds to localhost, this information could aid local attackers in path traversal or symlink attacks.

**Evidence:**
```javascript
// Line 203-209
res.writeHead(200, { 'Content-Type': 'application/json' });
res.end(JSON.stringify({
    status: 'ok',
    uptime: process.uptime(),
    targetDir: this.targetDir,      // ← leaks internal path
    lastManifestUpdate: this.lastManifestUpdate
}));
```

**Fix:** Return a boolean indicating whether a target is configured, not the path itself:
```javascript
res.end(JSON.stringify({
    status: 'ok',
    uptime: process.uptime(),
    hasTarget: !!this.targetDir,
    lastManifestUpdate: this.lastManifestUpdate
}));
```

---

### WR-07: No request body size limits on POST endpoints — memory exhaustion risk

**File:** `backend/server.js:213-214`, `261-262`, `359-360`
**Severity:** WARNING

All three body-collecting handlers (`_handleIndex`, `_handleFileIntent`, `_handleSettings` POST) accumulate request chunks into a string with no size limit. A malicious or buggy client could send a multi-megabyte body, consuming server memory.

**Evidence (all three have the same pattern):**
```javascript
let body = '';
req.on('data', chunk => body += chunk);
req.on('end', () => { /* process body */ });
```

**Fix:** Add a size guard:
```javascript
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
let body = '';
let bodySize = 0;
req.on('data', chunk => {
    bodySize += chunk.length;
    if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        req.destroy();
        return;
    }
    body += chunk;
});
```

---

### WR-08: Missing `req.on('close')` handler on `_handleIndex` and `_handleFileIntent` — resource leak on client disconnect

**File:** `backend/server.js:213-258` (`_handleIndex`), `261-333` (`_handleFileIntent`)
**Severity:** WARNING

If a client disconnects mid-request, the `req.on('end')` event never fires, so `persistence.close()` in the `finally` block is never reached. The `_handleSettings` POST path correctly handles this with `req.on('close', () => { persistence.close(); })` at line 380-382, but the other two body-collecting handlers don't.

**Evidence:**
```javascript
// _handleSettings (line 379-382) — CORRECT pattern
req.on('close', () => {
    if (persistence) persistence.close();
});

// _handleIndex (lines 213-258) — MISSING close handler
// _handleFileIntent (lines 261-333) — MISSING close handler
```

**Fix for `_handleIndex`:**
```javascript
_handleIndex(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        let persistence;
        try {
            // ... existing logic
        } catch (err) { /* ... */ }
        finally {
            if (persistence) persistence.close();
        }
    });
    // ADD: handle client disconnect
    req.on('close', () => {
        // Note: persistence is scoped inside 'end', so we need to restructure
        // Alternative: move persistence to outer scope
    });
}
```

Note: This requires restructuring to move the `persistence` variable to a scope accessible by both `end` and `close` handlers, similar to the pattern in `_handleSettings`.

---

## Info

### IN-01: SSE endpoint has no HTTP method validation

**File:** `backend/server.js:618-621`
**Severity:** INFO

`_handleMutationsSSE` doesn't validate that the request is GET. SSE (Server-Sent Events) spec requires GET. A POST to `/api/mutations` would establish a connection that never receives events (since `notificationBus` only writes to connected clients on mutation events), holding the connection open unnecessarily.

**Suggestion:**
```javascript
_handleMutationsSSE(req, res) {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use GET for SSE.' }));
        return;
    }
    const { notificationBus } = require('./notificationBus');
    notificationBus.addSSEClient(res);
}
```

---

### IN-02: Misleading indentation in `_handleVerify` try block

**File:** `backend/server.js:486-487`
**Severity:** INFO

The `try` keyword and the first statement inside it are at the same indentation level, making the code structure confusing to read. While syntactically correct (JavaScript doesn't use indentation for scoping), it misleads human readers.

**Evidence:**
```javascript
// Lines 486-487 — both at 16 spaces
                try {
                await persistence.initialize();
```

**Fix:**
```javascript
                try {
                    await persistence.initialize();
```

---

## Route-by-Route Checklist

| Route | Method Check? | Body Limit? | Close Handler? | Error Handling? | Notes |
|-------|:---:|:---:|:---:|:---:|-------|
| `/api/connection-state.json` | ✗ | N/A (GET) | N/A | ✓ | Read-only, no method check |
| `/api/ai-signal.toml` | ✗ | N/A (GET) | N/A | ✓ | Read-only, no method check |
| `/api/health` | ✗ | N/A (GET) | N/A | ✓ | Leaks targetDir (WR-06) |
| `/api/index` | ✗ | ✗ | ✗ | ✓ | GET triggers write (WR-01) |
| `/api/file-intent` | ✗ | ✗ | ✗ | ✓ | GET triggers error (WR-02) |
| `/api/settings` GET | ✓ (inside) | N/A | N/A | ✓ | |
| `/api/settings` POST | ✓ (inside) | ✗ | ✓ | ✓ | Pattern to replicate |
| `/api/verify` | ✓ | N/A (POST body) | ✗ | ✓ | Redundant requires (WR-05) |
| `/api/files` | ✗ | N/A (GET) | N/A | ✓ | Path traversal (CR-02) |
| `/api/mutations` (SSE) | ✗ | N/A (GET) | N/A | ✓ | CORS wildcard (CR-01) |

---

## Findings Summary

| ID | Severity | Issue | Location |
|----|----------|-------|----------|
| CR-01 | CRITICAL | SSE CORS wildcard overrides restricted policy — any origin can read mutations | server.js:107 → notificationBus.js:77 |
| CR-02 | CRITICAL | Path traversal bypass in `_handleFileList` via `startsWith` prefix matching | server.js:408-409 |
| WR-01 | WARNING | No method validation on `/api/index` — GET triggers unintended re-index | server.js:91, 212-258 |
| WR-02 | WARNING | No method validation on `/api/file-intent` — GET triggers 500 error | server.js:94, 260-333 |
| WR-03 | WARNING | Persistence leak when `initialize()` rejects in `_handleFileIntent` | server.js:324-327 |
| WR-04 | WARNING | Persistence leak when `initialize()` rejects in `_handleSettings` | server.js:389-392 |
| WR-05 | WARNING | Redundant `require()` shadowing top-level imports in `_handleVerify` | server.js:472-474 |
| WR-06 | WARNING | Health endpoint leaks internal `targetDir` filesystem path | server.js:207 |
| WR-07 | WARNING | No request body size limits — memory exhaustion risk | server.js:213, 261, 359 |
| WR-08 | WARNING | Missing `req.on('close')` on `_handleIndex` and `_handleFileIntent` | server.js:213-258, 261-333 |
| IN-01 | INFO | SSE endpoint has no HTTP method validation (should be GET) | server.js:618-621 |
| IN-02 | INFO | Misleading indentation in `_handleVerify` try block | server.js:486-487 |

---

_Reviewed: 2026-05-13T17:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (cross-file)_
