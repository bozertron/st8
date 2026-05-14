# ST8 Server Debug Report — Security Fixes

**Date:** 2026-05-13
**File:** `backend/server.js` (+ `backend/notificationBus.js`)
**Issues:** CR-01 (SSE CORS Wildcard), CR-02 (Path Traversal)

---

## CR-01: SSE CORS Wildcard

### Problem Description

The SSE (Server-Sent Events) endpoint at `/api/mutations` sets `Access-Control-Allow-Origin: '*'` in its response headers. This allows **any origin** to connect to the mutation event stream and read real-time file mutation data, bypassing the server's intentional localhost-only CORS restriction.

### Root Cause Analysis

**Location:** `backend/notificationBus.js:79-84`

```javascript
// VULNERABLE CODE (before fix)
res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'  // ← VULNERABILITY
});
```

**Mechanism:**

1. The server's `_handleRequest()` method (line 60) correctly sets a restricted CORS header:
   ```javascript
   res.setHeader('Access-Control-Allow-Origin', 'http://localhost:' + this.port);
   ```

2. When a request hits `/api/mutations`, `_handleMutationsSSE()` delegates to `notificationBus.addSSEClient(res)`.

3. Inside `addSSEClient()`, `res.writeHead()` is called with `Access-Control-Allow-Origin: '*'`.

4. In Node.js, **`writeHead()` overrides headers previously set via `setHeader()`**. The wildcard wins, and the server's intentional restriction is silently replaced.

5. Any external website can now open an `EventSource` connection to `http://localhost:3847/api/mutations` and receive real-time mutation events containing file paths, fingerprints, and schema cards.

### Fix Applied

**File:** `backend/notificationBus.js` — `addSSEClient()` now accepts an `options` parameter:

```javascript
addSSEClient(res, options = {}) {
    // ...
    const allowedOrigin = options.allowedOrigin || 'http://localhost:3847';
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': allowedOrigin  // ← FIXED
    });
    // ...
}
```

**File:** `backend/server.js` — `_handleMutationsSSE()` now passes the server's port:

```javascript
_handleMutationsSSE(req, res) {
    const { notificationBus } = require('./notificationBus');
    notificationBus.addSSEClient(res, {
        allowedOrigin: 'http://localhost:' + this.port
    });
}
```

### Verification Results

| Test | Input | Expected | Result |
|------|-------|----------|--------|
| Default origin | `addSSEClient(res)` | `http://localhost:3847` | ✓ PASS |
| Custom origin | `addSSEClient(res, { allowedOrigin: 'http://localhost:9999' })` | `http://localhost:9999` | ✓ PASS |
| No wildcard | Any call | No `*` in headers | ✓ PASS |

---

## CR-02: Path Traversal in `_handleFileList`

### Problem Description

The `_handleFileList()` method uses `String.prototype.startsWith()` to validate that requested paths are within allowed directories. This check can be bypassed because `startsWith` performs **string prefix matching**, not **path-boundary matching**.

**Attack vector:** A request to `/api/files?path=/home/bozertron2/evil` passes the guard because `'/home/bozertron2/evil'.startsWith('/home/bozertron')` returns `true`.

### Root Cause Analysis

**Location:** `backend/server.js:409` (before fix)

```javascript
// VULNERABLE CODE (before fix)
const homeDir = os.homedir();  // e.g., '/home/bozertron'
if (!resolvedPath.startsWith(homeDir) && !resolvedPath.startsWith(this.targetDir)) {
    // Block access
}
```

**Why `startsWith` is wrong for path validation:**

| Input Path | `startsWith('/home/bozertron')` | Should Allow? |
|------------|--------------------------------|---------------|
| `/home/bozertron/Documents` | `true` | ✓ Yes |
| `/home/bozertron/.config` | `true` | ✓ Yes |
| `/home/bozertron2/evil` | `true` | ✗ **No — BYPASS** |
| `/home/bozertron-backdoor` | `true` | ✗ **No — BYPASS** |
| `/home/bozertronX` | `true` | ✗ **No — BYPASS** |

The string `/home/bozertron` is a prefix of `/home/bozertron2`, but they are **different directories**. The check doesn't enforce that the next character after the prefix must be a path separator (`/`).

### Fix Applied

**File:** `backend/server.js` — `_handleFileList()` now uses `path.relative()` for boundary-safe validation:

```javascript
const homeDir = os.homedir();
const relToHome = path.relative(homeDir, resolvedPath);
const relToTarget = this.targetDir ? path.relative(this.targetDir, resolvedPath) : null;
const insideHome = !relToHome.startsWith('..') && !path.isAbsolute(relToHome);
const insideTarget = relToTarget ? (!relToTarget.startsWith('..') && !path.isAbsolute(relToTarget)) : false;

if (!insideHome && !insideTarget) {
    // Block access
}
```

**Why `path.relative()` works:**

`path.relative('/home/bozertron', '/home/bozertron2/evil')` returns `'../bozertron2/evil'`, which starts with `..` — correctly indicating the path is **outside** the base directory.

`path.relative('/home/bozertron', '/home/bozertron/Documents')` returns `'Documents'`, which does NOT start with `..` and is NOT absolute — correctly indicating the path is **inside** the base directory.

### Verification Results

| Input Path | Old (startsWith) | New (path.relative) | Correct? |
|------------|------------------|---------------------|----------|
| `/home/bozertron` | PASS | PASS | ✓ |
| `/home/bozertron/Documents` | PASS | PASS | ✓ |
| `/home/bozertron/.config/st8` | PASS | PASS | ✓ |
| `/home/bozertron2/evil` | PASS (BUG) | **BLOCK** | ✓ |
| `/home/bozertron-backdoor` | PASS (BUG) | **BLOCK** | ✓ |
| `/home/bozertron2` | PASS (BUG) | **BLOCK** | ✓ |
| `/etc/passwd` | BLOCK | BLOCK | ✓ |
| `/tmp/evil` | BLOCK | BLOCK | ✓ |

---

## Summary

| Issue | Severity | Status | Files Changed |
|-------|----------|--------|---------------|
| CR-01: SSE CORS wildcard | HIGH | ✓ Fixed | `backend/notificationBus.js`, `backend/server.js` |
| CR-02: Path traversal | HIGH | ✓ Fixed | `backend/server.js` |

Both fixes are minimal, targeted, and preserve backward compatibility for legitimate use cases while blocking the identified attack vectors.
