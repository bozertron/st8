# H1: CORS + /api/exec RCE — Mitigation Design Report

**Research Agent:** Agent 2 of 2
**Date:** 2026-05-13
**Status:** Complete

---

## Executive Summary

The ST8 server has a **critical remote code execution (RCE) vulnerability** chain combining two issues:

1. **Wildcard CORS:** `Access-Control-Allow-Origin: *` on all responses (server.js:60)
2. **Unrestricted command execution:** `/api/exec` endpoint runs arbitrary `execSync(command)` (server.js:206-221)

**Attack Vector:** Any malicious website can execute arbitrary shell commands on the ST8 host by simply visiting the page while the ST8 server is running.

```javascript
// Attacker's website — executes on victim's browser
fetch('http://localhost:3847/api/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'rm -rf /' })
});
```

**Severity:** CRITICAL — Full RCE with no authentication required.

---

## Current State Analysis

### Vulnerability Components

| Component | Location | Current Value | Risk |
|-----------|----------|---------------|------|
| CORS Header | server.js:60 | `Access-Control-Allow-Origin: *` | Allows any origin |
| Exec Endpoint | server.js:91-92, 206-221 | `execSync(command)` | Arbitrary command execution |
| Server Binding | server.js:49 | `listen(port)` (0.0.0.0) | Accessible from all interfaces |
| Frontend Usage | phreak-terminal.js:90 | `fetch('/api/exec', ...)` | Uses exec as fallback |

### Legitimate Uses of `/api/exec`

Based on codebase analysis, the frontend uses `/api/exec` for:

1. **Terminal commands** — PhreakTerminal executes user-typed commands (phreak-terminal.js:90)
2. **INDEX button** — Routes through PhreakTerminal → `/api/exec` → `execSync('index /path')` (BROKEN — `index` is not a shell command)
3. **VERIFY button** — Routes through PhreakTerminal → `/api/exec` → `execSync('verify /path')` (BROKEN — `verify` is not a shell command)

**Key Finding:** The `/api/exec` endpoint is NOT used for any legitimate functionality that cannot be replaced with dedicated endpoints. The INDEX and VERIFY flows are already broken because they try to run non-shell commands via `execSync`.

### Existing Dedicated Endpoints

The server already has proper endpoints that bypass `/api/exec`:

| Endpoint | Handler | Purpose | Used by Frontend? |
|----------|---------|---------|-------------------|
| `/api/index` | `_handleIndex()` | Calls `indexDirectory()` + `writeManifests()` | ❌ NO (broken routing) |
| `/api/connection-state.json` | `_serveManifest()` | Serves manifest file | ✅ YES |
| `/api/ai-signal.toml` | `_serveToml()` | Serves TOML manifest | ✅ YES |
| `/api/health` | `_serveHealth()` | Health check | ✅ YES |
| `/api/file-intent` | `_handleFileIntent()` | Save file notes | ✅ YES |
| `/api/settings` | `_handleSettings()` | CRUD settings | ✅ YES |

---

## Mitigation Options

### Option A: Remove `/api/exec` + Restrict CORS + Bind to Localhost

**Approach:** Complete removal of the RCE endpoint, localhost-only CORS, and localhost binding.

**Changes:**
1. Remove `/api/exec` endpoint entirely from server.js
2. Change CORS to localhost-only origins
3. Bind server to `127.0.0.1` instead of `0.0.0.0`
4. Update frontend to use dedicated endpoints
5. Add `/api/verify` endpoint for verification functionality

**Pros:**
- ✅ Completely eliminates RCE vector
- ✅ Minimal attack surface
- ✅ No authentication overhead
- ✅ Follows principle of least privilege
- ✅ Simple implementation

**Cons:**
- ⚠️ Breaks PhreakTerminal command execution (but this is a feature, not a bug — arbitrary shell access via browser is dangerous)
- ⚠️ Requires frontend updates to use dedicated endpoints

**Security Rating:** ★★★★★ (Excellent)

---

### Option B: Restrict CORS + Command Allowlist

**Approach:** Keep `/api/exec` but restrict CORS and allowlist specific commands.

**Changes:**
1. Change CORS to localhost-only origins
2. Implement command allowlist in `_handleExec()`
3. Bind server to `127.0.0.1`
4. Add input validation and sanitization

**Allowlist Example:**
```javascript
const ALLOWED_COMMANDS = ['ls', 'cat', 'grep', 'find', 'pwd', 'echo'];
function _handleExec(req, res) {
    // Parse command
    const parts = command.split(' ');
    const cmd = parts[0];
    
    if (!ALLOWED_COMMANDS.includes(cmd)) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Command not allowed' }));
        return;
    }
    
    // Execute with timeout
    const result = execSync(command, { encoding: 'utf-8', timeout: 5000 });
    // ...
}
```

**Pros:**
- ✅ Preserves terminal functionality for safe commands
- ✅ CORS restriction prevents cross-origin attacks
- ✅ Allowlist limits damage from local attacks

**Cons:**
- ❌ Allowlist is hard to maintain correctly
- ❌ Risk of allowlist bypass (e.g., `ls; rm -rf /`)
- ❌ Still has command injection surface
- ❌ Violates principle of least privilege
- ❌ Complex implementation with edge cases

**Security Rating:** ★★☆☆☆ (Poor — allowlists are fragile)

---

### Option C: Authentication Token + Restrict CORS

**Approach:** Add token-based authentication to `/api/exec` and restrict CORS.

**Changes:**
1. Generate random token on server start
2. Require `Authorization: Bearer <token>` header for `/api/exec`
3. Change CORS to localhost-only origins
4. Bind server to `127.0.0.1`
5. Pass token to frontend via startup URL or config

**Pros:**
- ✅ Prevents cross-origin attacks (token not available to attacker)
- ✅ Preserves terminal functionality
- ✅ Standard authentication pattern

**Cons:**
- ❌ Token management complexity
- ❌ Token could leak via XSS
- ❌ Still has RCE if token is compromised
- ❌ Adds authentication overhead to every request
- ❌ Violates defense-in-depth (single point of failure)

**Security Rating:** ★★★☆☆ (Moderate)

---

### Option D: Remove `/api/exec` + Dedicated Endpoints + WebSocket for Terminal

**Approach:** Remove REST exec endpoint, use WebSocket for interactive terminal.

**Changes:**
1. Remove `/api/exec` endpoint entirely
2. Implement WebSocket server for interactive terminal
3. Authenticate WebSocket connections
4. Add dedicated REST endpoints for INDEX/VERIFY
5. Restrict CORS and bind to localhost

**Pros:**
- ✅ Eliminates REST-based RCE
- ✅ WebSocket provides better terminal experience
- ✅ Can implement proper session management
- ✅ Follows modern patterns (VS Code, Jupyter, etc.)

**Cons:**
- ❌ Significant implementation effort
- ❌ Adds WebSocket dependency
- ❌ More complex architecture
- ❌ Overkill for current use case

**Security Rating:** ★★★★★ (Excellent — but high effort)

---

## Tradeoff Analysis

| Criteria | Option A | Option B | Option C | Option D |
|----------|----------|----------|----------|----------|
| **Security** | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★★★★ |
| **Simplicity** | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ |
| **Implementation Effort** | Low | Medium | Medium | High |
| **Preserves Functionality** | Partial | Full | Full | Full |
| **Maintenance Burden** | Low | High | Medium | Medium |
| **Defense in Depth** | Strong | Weak | Moderate | Strong |

---

## Recommendation: Option A

**Recommended Approach:** Remove `/api/exec` + Restrict CORS + Bind to Localhost + Dedicated Endpoints

### Rationale

1. **Security First:** The `/api/exec` endpoint is fundamentally unsafe. No amount of allowlisting or authentication can make arbitrary command execution safe from a browser context.

2. **Broken Anyway:** The INDEX and VERIFY flows through `/api/exec` are already broken — they try to run `index` and `verify` as shell commands, which don't exist. The proper `/api/index` endpoint exists but is never called.

3. **Defense in Depth:** Removing the endpoint entirely eliminates the attack surface. CORS restriction and localhost binding provide additional layers.

4. **Simplicity:** Option A is the simplest to implement and maintain. No allowlists to manage, no tokens to rotate, no WebSocket complexity.

5. **Principle of Least Privilege:** A code analyzer tool does not need arbitrary shell command execution from the browser.

### What Functionality is Lost?

| Lost Functionality | Impact | Alternative |
|--------------------|--------|-------------|
| PhreakTerminal arbitrary commands | Medium | Terminal can be reimplemented with dedicated endpoints for specific operations |
| INDEX via `/api/exec` | None | Already broken — use `/api/index` directly |
| VERIFY via `/api/exec` | None | Already broken — implement `/api/verify` endpoint |

**Net Impact:** Minimal. The "lost" functionality is either broken or dangerous. Proper dedicated endpoints provide the same capabilities safely.

---

## Implementation Plan

### Step 1: Restrict CORS to Localhost (server.js)

**File:** `backend/server.js`
**Lines:** 59-68

```javascript
// BEFORE (VULNERABLE):
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

// AFTER (SECURE):
const origin = req.headers.origin || '';
const allowedOrigins = [
    `http://localhost:${this.port}`,
    `http://127.0.0.1:${this.port}`,
    `http://[::1]:${this.port}`  // IPv6 localhost
];

if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
}
```

### Step 2: Bind Server to Localhost (server.js)

**File:** `backend/server.js`
**Line:** 49

```javascript
// BEFORE:
this.server.listen(this.port, () => {
    console.log(`[st8:server] Server running on http://localhost:${this.port}`);
});

// AFTER:
this.server.listen(this.port, '127.0.0.1', () => {
    console.log(`[st8:server] Server running on http://localhost:${this.port}`);
});
```

### Step 3: Remove `/api/exec` Endpoint (server.js)

**File:** `backend/server.js`
**Lines:** 91-92, 206-221

```javascript
// REMOVE from _handleApiRequest():
case '/api/exec':
    this._handleExec(req, res);
    break;

// REMOVE entire _handleExec() method:
_handleExec(req, res) {
    // DELETE THIS ENTIRE METHOD
}
```

### Step 4: Add `/api/verify` Endpoint (server.js)

**File:** `backend/server.js`

```javascript
// Add to _handleApiRequest():
case '/api/verify':
    this._handleVerify(req, res);
    break;

// Add new method:
_handleVerify(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { path: verifyPath } = JSON.parse(body);
            const targetPath = verifyPath || this.targetDir;
            
            // Read manifest and verify integrity
            const manifestPath = path.join(targetPath, 'connection-state.json');
            if (!fs.existsSync(manifestPath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'error', 
                    error: 'No manifest found. Run indexing first.' 
                }));
                return;
            }
            
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            const files = manifest.files || [];
            
            // Verify each file exists
            const results = files.map(file => {
                const fullPath = path.join(targetPath, file.filepath);
                const exists = fs.existsSync(fullPath);
                return {
                    filepath: file.filepath,
                    status: exists ? 'ok' : 'missing',
                    hash: exists ? require('crypto')
                        .createHash('sha256')
                        .update(fs.readFileSync(fullPath))
                        .digest('hex') : null
                };
            });
            
            const allOk = results.every(r => r.status === 'ok');
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: allOk ? 'ok' : 'warning',
                verified: results.length,
                missing: results.filter(r => r.status === 'missing').length,
                results: results
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}
```

### Step 5: Update Frontend — INDEX Button (file-explorer.js)

**File:** `file-explorer.js`
**Lines:** 577-581

```javascript
// BEFORE (BROKEN):
if (window.PhreakTerminal && window.PhreakTerminal.execute) {
    await window.PhreakTerminal.execute('index ' + targetPath);
}

// AFTER (DIRECT API CALL):
const response = await fetch('/api/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: targetPath })
});
const result = await response.json();

if (result.status === 'ok') {
    console.info('[st8] Indexing complete:', result.files, 'files');
    // Update indexed fingerprints
    if (window.VoidFileExplorer && window.VoidFileExplorer.setIndexedFingerprints) {
        const manifestResponse = await fetch('/api/connection-state.json?t=' + Date.now());
        const manifest = await manifestResponse.json();
        window.VoidFileExplorer.setIndexedFingerprints(manifest);
    }
} else {
    console.error('[st8] Indexing failed:', result.error);
}
```

### Step 6: Update Frontend — VERIFY Button (file-explorer.js)

**File:** `file-explorer.js`
**Lines:** 620-626

```javascript
// BEFORE (BROKEN):
if (window.PhreakTerminal && window.PhreakTerminal.execute) {
    await window.PhreakTerminal.execute('verify ' + targetPath);
}

// AFTER (DIRECT API CALL):
const response = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: targetPath })
});
const result = await response.json();

if (result.status === 'ok') {
    console.info('[st8] Verification passed:', result.verified, 'files verified');
    alert('Verification passed! All ' + result.verified + ' files verified.');
} else {
    console.warn('[st8] Verification issues:', result.missing, 'files missing');
    alert('Verification found ' + result.missing + ' missing files.');
}
```

### Step 7: Update PhreakTerminal Fallback (phreak-terminal.js)

**File:** `phreak-terminal.js`
**Lines:** 87-112

```javascript
// BEFORE (RCE VECTOR):
} else {
    // Fallback to backend API when not connected to EPO
    try {
        const response = await fetch('/api/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        // ...
    }
}

// AFTER (SAFE FALLBACK):
} else {
    // No backend terminal available — show message
    phreakState.lines.push(_mkLine('stderr', 
        'Terminal not available. Use dedicated UI buttons for INDEX/VERIFY operations.'));
    phreakState.lines.push(_mkLine('system', 
        'Tip: Connect to EPO bus for full terminal functionality.'));
}
```

### Step 8: Update `_handleIndex` to Accept Path (server.js)

**File:** `backend/server.js`
**Lines:** 223-237

```javascript
// BEFORE:
_handleIndex(req, res) {
    const { indexDirectory } = require('./indexer');
    const { writeManifests } = require('./manifestGenerator');
    
    indexDirectory(this.targetDir, { write: true })
    // ...

// AFTER:
_handleIndex(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { indexDirectory } = require('./indexer');
            const { writeManifests } = require('./manifestGenerator');
            
            // Allow indexing specific path or default to targetDir
            let targetPath = this.targetDir;
            if (body) {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.path) {
                        targetPath = path.resolve(parsed.path);
                        // Security: ensure path is under targetDir or is targetDir
                        if (!targetPath.startsWith(this.targetDir)) {
                            res.writeHead(403, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Path outside target directory' }));
                            return;
                        }
                    }
                } catch (e) {
                    // Ignore parse errors, use default targetDir
                }
            }
            
            indexDirectory(targetPath, { write: true })
                .then(result => {
                    writeManifests(result.files, targetPath);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        status: 'ok', 
                        files: result.files.length,
                        path: targetPath
                    }));
                })
                .catch(err => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}
```

### Step 9: Remove Dead Constant (phreak-terminal.js)

**File:** `phreak-terminal.js`
**Line:** 43

```javascript
// REMOVE:
const PHREAK_API = '/api/v1/exec';
```

---

## Impact Assessment

### Functionality Impact

| Feature | Before | After | Impact |
|---------|--------|-------|--------|
| INDEX Button | ❌ Broken (routes through /api/exec) | ✅ Works (direct /api/index) | **Improved** |
| VERIFY Button | ❌ Broken (routes through /api/exec) | ✅ Works (direct /api/verify) | **Improved** |
| PhreakTerminal Commands | ✅ Works (arbitrary shell) | ⚠️ Limited (no backend exec) | **Reduced** |
| Manifest Serving | ✅ Works | ✅ Works | No change |
| File Intent Save | ✅ Works | ✅ Works | No change |
| Settings CRUD | ✅ Works | ✅ Works | No change |
| Health Check | ✅ Works | ✅ Works | No change |

### Security Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| RCE Surface | Full arbitrary exec | None | **100% reduction** |
| CORS Exposure | All origins | Localhost only | **99% reduction** |
| Network Exposure | All interfaces | Localhost only | **99% reduction** |
| Authentication | None | N/A (no exec endpoint) | N/A |

### Performance Impact

- **Negligible:** Removing `/api/exec` reduces request handling overhead
- **CORS check:** Single string comparison per request (~0.001ms)
- **Localhost binding:** No performance impact

---

## Testing Checklist

### Security Tests

- [ ] Verify CORS headers only allow localhost origins
- [ ] Verify `/api/exec` returns 404
- [ ] Verify server only listens on 127.0.0.1
- [ ] Verify cross-origin requests are blocked
- [ ] Verify `/api/verify` requires valid path

### Functionality Tests

- [ ] Verify INDEX button triggers re-indexing
- [ ] Verify VERIFY button checks file integrity
- [ ] Verify manifest serving still works
- [ ] Verify file intent save still works
- [ ] Verify settings CRUD still works
- [ ] Verify health endpoint still works

### Regression Tests

- [ ] Verify PhreakTerminal shows appropriate fallback message
- [ ] Verify no JavaScript errors in browser console
- [ ] Verify server starts without errors
- [ ] Verify file watcher still triggers re-indexing

---

## Rollback Plan

If issues arise, revert changes in this order:

1. **Restore `/api/exec` endpoint** (server.js:91-92, 206-221)
2. **Restore wildcard CORS** (server.js:60)
3. **Restore 0.0.0.0 binding** (server.js:49)
4. **Restore frontend routing** (file-explorer.js:577-581, 620-626)

**Note:** Rollback reintroduces the RCE vulnerability. Only use for emergency debugging.

---

## References

- **Gap Analysis:** `.planning/gap_analysis_action.md` (lines 361, 542-543)
- **Vulnerable Code:** `backend/server.js` (lines 60, 91-92, 206-221)
- **Frontend Usage:** `phreak-terminal.js` (line 90), `file-explorer.js` (lines 579, 626)
- **Existing Endpoints:** `backend/server.js` (lines 82-106)

---

## Conclusion

**Option A (Remove + Restrict + Bind)** is the clear winner. It:

1. **Eliminates the RCE vector entirely** — no exec endpoint, no attack surface
2. **Fixes broken functionality** — INDEX/VERIFY buttons will actually work
3. **Implements defense in depth** — CORS + binding + endpoint removal
4. **Minimal implementation effort** — ~100 lines of code changes
5. **Low maintenance burden** — no allowlists or tokens to manage

The "lost" arbitrary shell execution via browser is not a legitimate feature for a code analysis tool. Dedicated endpoints provide the same capabilities safely.

**Priority:** CRITICAL — This should be implemented immediately before any other work.
