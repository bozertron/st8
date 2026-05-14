# Item A10: EPO Fallback — Architecture Decision

**Status:** BLOCKER  
**File:** `file-explorer.js:146-158`  
**Function:** `_fetchViaWebSocket()`  
**Decision Date:** 2026-05-13  

---

## Executive Summary

The File Explorer's directory listing functionality is **completely non-functional** in standalone mode. It depends entirely on a `window.epoClient` WebSocket client that:

1. **Is never defined** in the codebase
2. **Has no corresponding EPO server** implementation
3. **Has no REST fallback** (unlike phreak-terminal which has one)

**Recommendation:** Add REST fallback pattern (matching phreak-terminal's existing pattern) + implement `/api/file-list` endpoint in server.js.

---

## 1. Current State Analysis

### 1.1 EPO Client Dependency

**Location:** `file-explorer.js:146-158`

```javascript
async function _fetchViaWebSocket(path) {
    // Ensure epoClient is available and connected
    if (typeof window.epoClient === 'undefined') {
        throw new Error('EPO client not loaded');
    }
    if (!window.epoClient.connected) {
        await window.epoClient.connect();
    }
    const res = await window.epoClient.request('file_list', { path });
    if (res.error) throw new Error(res.error);
    // Accept { entries: [...] } or bare array
    return res.entries || res;
}
```

**Issues:**
- `window.epoClient` is **never instantiated** anywhere in the codebase
- No EPO client library is imported or loaded
- No EPO WebSocket server exists to handle `file_list` requests
- Function throws immediately if `window.epoClient` is undefined

### 1.2 EPO Server Status

**Finding:** No EPO WebSocket server implementation exists in this codebase.

**Evidence:**
- `backend/server.js` — Pure HTTP server (no WebSocket support)
- No `WebSocketServer`, `ws`, or `wss` imports found
- No `epoServer` or EPO-related server code found
- `grep` for `epoServer|WebSocketServer|new WebSocket` returns zero matches in source files

### 1.3 EPO Client Status

**Finding:** `window.epoClient` is referenced but never defined.

**Evidence:**
- Only reference in source: `file-explorer.js:148` (check if undefined)
- Mock pattern exists in `.planning/codebase/TESTING.md` for testing purposes
- No actual EPO client library imported or bundled
- No `<script>` tag loading EPO client found

### 1.4 Comparison: phreak-terminal.js Pattern

**phreak-terminal.js:68-94** already implements the correct fallback pattern:

```javascript
// Use EPO WebSocket for exec (replaces dead /api/v1/exec REST)
if (window.epoClient && window.epoClient.connected) {
    const data = await window.epoClient.request('exec', { command: cmd });
    // ... handle response
} else {
    // Fallback to backend API when not connected to EPO
    try {
        const response = await fetch('/api/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        const data = await response.json();
        // ... handle response
    } catch (fetchErr) {
        // ... handle error
    }
}
```

**Key difference:** phreak-terminal has a REST fallback; file-explorer does not.

---

## 2. Architecture Options

### Option A: Keep EPO + Add REST Fallback (Recommended)

**Approach:** Maintain EPO as primary path (for future use), add REST fallback.

**Pros:**
- Matches existing phreak-terminal pattern (consistency)
- Minimal code changes
- Preserves EPO integration path if EPO server is added later
- No breaking changes to potential EPO consumers

**Cons:**
- Maintains dead code path (EPO client never exists)
- Slightly more complex than REST-only

**Implementation:**
1. Add `/api/file-list` endpoint to `backend/server.js`
2. Modify `_fetchViaWebSocket()` to try EPO first, fallback to REST
3. Rename function to `_fetchDirectory()` for clarity

### Option B: Remove EPO, REST-Only

**Approach:** Remove all EPO references, use REST exclusively.

**Pros:**
- Simpler codebase
- No dead code paths
- Clearer architecture

**Cons:**
- Breaks pattern with phreak-terminal.js (inconsistency)
- Removes EPO integration path entirely
- Larger code change
- May conflict with future EPO server plans

### Option C: Implement EPO Server

**Approach:** Build a WebSocket server that handles `file_list`, `exec`, etc.

**Pros:**
- Full EPO architecture realized
- Real-time capabilities
- Bidirectional communication

**Cons:**
- Significant new infrastructure
- Over-engineering for file listing (simple request/response)
- Adds complexity without clear benefit for this use case
- Out of scope for A10 fix

---

## 3. Decision: Option A — Keep EPO + Add REST Fallback

**Rationale:**
1. **Consistency** — Matches phreak-terminal.js pattern already in codebase
2. **Minimal risk** — Small, focused change
3. **Future-proof** — Preserves EPO path if server is added later
4. **Pragmatic** — Fixes the BLOCKER without over-engineering

---

## 4. Implementation Plan

### 4.1 Backend: Add `/api/file-list` Endpoint

**File:** `backend/server.js`

**Changes:**
1. Add route in `_handleApiRequest()` switch:
   ```javascript
   case '/api/file-list':
       this._handleFileList(req, res, url);
       break;
   ```

2. Add handler method:
   ```javascript
   _handleFileList(req, res, url) {
       const targetPath = url.searchParams.get('path');
       if (!targetPath) {
           res.writeHead(400, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify({ error: 'path parameter required' }));
           return;
       }
       
       // Expand tilde to home directory
       const homeDir = require('os').homedir();
       const expandedPath = targetPath.replace(/^~/, homeDir);
       const resolvedPath = require('path').resolve(expandedPath);
       
       // Security: prevent directory traversal
       if (!resolvedPath.startsWith(homeDir)) {
           res.writeHead(403, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify({ error: 'Access denied' }));
           return;
       }
       
       try {
           const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
           const result = entries.map(entry => ({
               name: entry.name,
               isDirectory: entry.isDirectory(),
               path: require('path').join(resolvedPath, entry.name)
           }));
           
           res.writeHead(200, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify({ entries: result }));
       } catch (err) {
           res.writeHead(500, { 'Content-Type': 'application/json' });
           res.end(JSON.stringify({ error: err.message }));
       }
   }
   ```

### 4.2 Frontend: Add REST Fallback to file-explorer.js

**File:** `file-explorer.js`

**Changes:**
1. Rename `_fetchViaWebSocket()` to `_fetchDirectory()` for clarity
2. Add REST fallback pattern:

```javascript
async function _fetchDirectory(path) {
    // Try EPO WebSocket first (if available)
    if (window.epoClient && window.epoClient.connected) {
        try {
            const res = await window.epoClient.request('file_list', { path });
            if (res.error) throw new Error(res.error);
            return res.entries || res;
        } catch (epoErr) {
            console.warn('[file-explorer] EPO request failed, falling back to REST:', epoErr.message);
        }
    }
    
    // Fallback to REST API
    const response = await fetch('/api/file-list?path=' + encodeURIComponent(path));
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.entries || data;
}
```

3. Update `explorerNavigate()` to call `_fetchDirectory()` instead of `_fetchViaWebSocket()`

---

## 5. Security Considerations

### 5.1 Directory Traversal Prevention

**Risk:** User could request `../../../../etc/passwd` via path parameter.

**Mitigation:**
- Expand `~` to home directory
- Resolve path to absolute
- Verify resolved path starts with home directory
- Return 403 if path escapes home directory

### 5.2 Path Validation

**Risk:** Symlinks could escape home directory.

**Mitigation:**
- Use `fs.realpathSync()` to resolve symlinks
- Verify resolved path still under home directory

### 5.3 Error Information Leakage

**Risk:** Error messages could reveal system paths.

**Mitigation:**
- Generic error messages for 403/500
- Log detailed errors server-side only

---

## 6. Testing Strategy

### 6.1 Unit Tests

1. Test `/api/file-list` with valid path
2. Test `/api/file-list` with missing path parameter (400)
3. Test `/api/file-list` with directory traversal attempt (403)
4. Test `/api/file-list` with non-existent path (500)
5. Test `_fetchDirectory()` with EPO available
6. Test `_fetchDirectory()` with EPO unavailable (fallback)
7. Test `_fetchDirectory()` with both paths failing

### 6.2 Integration Tests

1. Mount File Explorer, navigate to `~`, verify entries load
2. Navigate to subdirectory, verify breadcrumbs update
3. Navigate to non-existent path, verify error message
4. Navigate with EPO mock available, verify EPO path used
5. Navigate with EPO mock unavailable, verify REST fallback used

---

## 7. Rollback Plan

If issues arise:

1. **Immediate:** Revert `file-explorer.js` changes
2. **Backend:** `/api/file-list` endpoint can remain (no harm)
3. **Alternative:** Revert entire commit and re-implement

---

## 8. Related Items

- **A8:** EPO `exec` request has no matching server handler (WARNING)
  - phreak-terminal.js already has REST fallback for `exec`
  - Same pattern applies; fix is less critical due to existing fallback

- **A13:** RETRACTED — `_fetchDirectory` function does not exist
  - Prior agent referenced phantom code
  - A10 fix covers the actual issue

---

## 9. Success Criteria

- [ ] `/api/file-list` endpoint implemented in server.js
- [ ] `_fetchDirectory()` function added to file-explorer.js
- [ ] REST fallback works when EPO unavailable
- [ ] EPO path still works if EPO client exists
- [ ] Directory traversal prevented
- [ ] Error messages displayed to user
- [ ] File Explorer navigates directories successfully in standalone mode

---

## 10. References

- `file-explorer.js:146-158` — Current `_fetchViaWebSocket()` implementation
- `phreak-terminal.js:68-94` — Reference pattern for EPO + REST fallback
- `backend/server.js:80-107` — Existing API route handler pattern
- `.planning/gap_analysis_action.md:77` — A10 BLOCKER definition
- `.planning/codebase/TESTING.md:110-114` — EPO mock pattern

---

**Decision:** Implement Option A (Keep EPO + Add REST Fallback)  
**Priority:** BLOCKER — File Explorer non-functional without this fix  
**Effort:** Small (2-3 hours)  
**Risk:** Low (pattern already proven in phreak-terminal.js)
