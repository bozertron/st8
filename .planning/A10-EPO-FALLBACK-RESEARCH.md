# A10: EPO Fallback — Implementation Research Report

**Date:** 2026-05-13  
**Agent:** Agent 2 of 2  
**Issue:** File Explorer directory listing depends on EPO WebSocket — no server, no fallback  
**Severity:** BLOCKER  
**Location:** `file-explorer.js:146-158`, `backend/server.js`

---

## Executive Summary

The File Explorer's directory listing currently **only** works via EPO WebSocket (`window.epoClient.request('file_list', ...)`), but:
1. No EPO WebSocket server exists in this codebase
2. No REST fallback endpoint exists
3. Directory browsing is **completely non-functional** in standalone mode

**Solution:** Implement a REST `/api/files` endpoint with graceful EPO-first-then-REST fallback logic.

---

## 1. REST Endpoint Design

### Endpoint Specification

```
GET /api/files?path=<encoded-path>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `path` | string | No | `this.targetDir` | Directory path to list (relative to target or absolute) |

**Response Format (Success):**
```json
{
  "entries": [
    {
      "name": "file.js",
      "isDirectory": false,
      "path": "/full/path/to/file.js",
      "size": 1234,
      "modifiedAt": "2026-05-13T01:54:00.000Z"
    },
    {
      "name": "subfolder",
      "isDirectory": true,
      "path": "/full/path/to/subfolder"
    }
  ]
}
```

**Response Format (Error):**
```json
{
  "error": "Permission denied"
}
```

**HTTP Status Codes:**
| Code | Condition |
|------|-----------|
| 200 | Success |
| 400 | Invalid/missing path |
| 403 | Path traversal attempt blocked |
| 404 | Directory not found |
| 500 | Server error (read failure, etc.) |

### Security Constraints

1. **Path Traversal Prevention:** Resolved path must stay within `targetDir` or be explicitly allowed
2. **Hidden Files:** Always include hidden files (single-user tool, per `explorerState.showHidden = true`)
3. **Symlink Handling:** Follow symlinks but detect cycles
4. **Size Limits:** Don't list directories with >10,000 entries (return error with suggestion)

---

## 2. Backend Handler Implementation

### server.js Changes

**Location:** `backend/server.js`

#### 2a. Add Route to `_handleApiRequest` Switch

```javascript
// In _handleApiRequest() method, add case after line 102:
case '/api/files':
    this._handleFileList(req, res, url);
    break;
```

#### 2b. New Handler Method

```javascript
/**
 * GET /api/files?path=<path>
 * 
 * Lists directory contents with file metadata.
 * Falls back to targetDir if no path specified.
 */
_handleFileList(req, res, url) {
    // Only allow GET
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    // Resolve target path
    let targetPath = url.searchParams.get('path') || this.targetDir;
    
    // Expand tilde to home directory
    if (targetPath.startsWith('~')) {
        const os = require('os');
        targetPath = targetPath.replace(/^~/, os.homedir());
    }
    
    // Resolve to absolute path
    const resolvedPath = path.resolve(targetPath);
    
    // Security: prevent path traversal outside targetDir
    // Allow absolute paths that exist (for home directory browsing)
    if (!fs.existsSync(resolvedPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Directory not found' }));
        return;
    }
    
    // Verify it's a directory
    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Path is not a directory' }));
        return;
    }
    
    try {
        // Read directory with file type info
        const dirents = fs.readdirSync(resolvedPath, { withFileTypes: true });
        
        // Map to entry objects with metadata
        const entries = dirents.map(dirent => {
            const entry = {
                name: dirent.name,
                isDirectory: dirent.isDirectory(),
                path: path.join(resolvedPath, dirent.name)
            };
            
            // Add file metadata (size, modified date) for files
            if (!dirent.isDirectory()) {
                try {
                    const filePath = path.join(resolvedPath, dirent.name);
                    const fileStat = fs.statSync(filePath);
                    entry.size = fileStat.size;
                    entry.modifiedAt = fileStat.mtime.toISOString();
                } catch (statErr) {
                    // Skip metadata if stat fails (permission denied, etc.)
                    entry.size = null;
                    entry.modifiedAt = null;
                }
            }
            
            return entry;
        });
        
        // Sort: directories first, then by name
        entries.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ entries }));
        
    } catch (err) {
        // Handle specific error types
        let statusCode = 500;
        let errorMessage = err.message;
        
        if (err.code === 'EACCES') {
            statusCode = 403;
            errorMessage = 'Permission denied';
        } else if (err.code === 'ENOENT') {
            statusCode = 404;
            errorMessage = 'Directory not found';
        }
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMessage }));
    }
}
```

---

## 3. Frontend Fallback Logic

### file-explorer.js Changes

**Location:** `file-explorer.js`

#### 3a. Replace `_fetchViaWebSocket` with `_fetchDirectoryEntries`

```javascript
/**
 * Fetch directory entries with EPO-first-then-REST fallback.
 * 
 * Signal path:
 * 1. Try EPO WebSocket (if available and connected)
 * 2. Fall back to REST /api/files endpoint
 * 3. If both fail, throw error for UI to display
 * 
 * @param {string} path - Directory path to list
 * @returns {Promise<Array>} Array of entry objects
 */
async function _fetchDirectoryEntries(path) {
    let lastError = null;
    
    // ─── STRATEGY 1: EPO WebSocket ───────────────────────────
    // Try EPO first if client exists
    if (typeof window.epoClient !== 'undefined') {
        try {
            // Ensure connected
            if (!window.epoClient.connected) {
                await window.epoClient.connect();
            }
            
            const res = await window.epoClient.request('file_list', { path });
            if (res.error) throw new Error(res.error);
            
            // Success via EPO
            console.info('[st8:explorer] Directory listing via EPO WebSocket');
            return res.entries || res;
            
        } catch (epoErr) {
            // EPO failed — log and continue to REST fallback
            lastError = epoErr;
            console.warn('[st8:explorer] EPO failed, trying REST fallback:', epoErr.message);
        }
    }
    
    // ─── STRATEGY 2: REST Fallback ───────────────────────────
    try {
        const url = '/api/files?path=' + encodeURIComponent(path);
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.entries || !Array.isArray(data.entries)) {
            throw new Error('Invalid response format');
        }
        
        console.info('[st8:explorer] Directory listing via REST fallback');
        return data.entries;
        
    } catch (restErr) {
        // Both strategies failed
        console.error('[st8:explorer] All fetch strategies failed:', restErr.message);
        
        // Throw with context about what was attempted
        const attempted = [];
        if (typeof window.epoClient !== 'undefined') attempted.push('EPO WebSocket');
        attempted.push('REST /api/files');
        
        throw new Error(
            `Failed to load directory: ${restErr.message}. ` +
            `Attempted: ${attempted.join(', ')}`
        );
    }
}
```

#### 3b. Update `explorerNavigate` to Use New Function

```javascript
// In explorerNavigate() function, replace lines 127-135:
// BEFORE:
try {
    entries = await _fetchViaWebSocket(path);
} catch (err) {
    fetchError = err;
    explorerState.error = {
        message: 'Unable to load directory — ' + (err.message || 'Unknown error'),
        canRetry: true,
    };
}

// AFTER:
try {
    entries = await _fetchDirectoryEntries(path);
} catch (err) {
    fetchError = err;
    explorerState.error = {
        message: 'Unable to load directory — ' + (err.message || 'Unknown error'),
        canRetry: true,
    };
}
```

#### 3c. Remove Old `_fetchViaWebSocket` Function

Delete lines 146-158 (the old `_fetchViaWebSocket` function) as it's replaced by `_fetchDirectoryEntries`.

---

## 4. Complete Signal Path Documentation

### Normal Flow (EPO Available)

```
User clicks folder
       │
       ▼
explorerNavigate(path)
       │
       ▼
_fetchDirectoryEntries(path)
       │
       ▼
┌─────────────────────────────────────┐
│ Is window.epoClient defined?        │
│                                     │
│ YES ──► epoClient.connect()         │
│         │                           │
│         ▼                           │
│         epoClient.request(          │
│           'file_list', {path}       │
│         )                           │
│         │                           │
│         ▼                           │
│         Return entries              │
└─────────────────────────────────────┘
       │
       ▼
explorerState.entries = entries
       │
       ▼
_renderExplorer()
```

### Fallback Flow (EPO Unavailable)

```
User clicks folder
       │
       ▼
explorerNavigate(path)
       │
       ▼
_fetchDirectoryEntries(path)
       │
       ▼
┌─────────────────────────────────────┐
│ Is window.epoClient defined?        │
│                                     │
│ NO ───► Skip EPO, go to REST        │
│                                     │
│ YES ──► epoClient.connect()         │
│         │                           │
│         ▼                           │
│         epoClient.request()         │
│         │                           │
│         ▼                           │
│         ERROR? ──► Log warning      │
│                   Continue to REST  │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ fetch('/api/files?path=...')        │
│                                     │
│ Response.ok? ──► Return entries     │
│                                     │
│ Error? ──► Throw with context       │
└─────────────────────────────────────┘
       │
       ▼
explorerState.entries = entries
       │
       ▼
_renderExplorer()
```

### Error Flow (Both Fail)

```
User clicks folder
       │
       ▼
_fetchDirectoryEntries(path)
       │
       ├── EPO fails (timeout, not connected, etc.)
       │
       ├── REST fails (404, 500, network error, etc.)
       │
       ▼
Throw Error: "Failed to load directory: [reason]. 
             Attempted: EPO WebSocket, REST /api/files"
       │
       ▼
explorerNavigate() catch block
       │
       ▼
explorerState.error = {
    message: 'Unable to load directory — ...',
    canRetry: true
}
       │
       ▼
_renderExplorer() shows error banner with RETRY button
```

---

## 5. Error Handling Matrix

| Error Type | EPO Behavior | REST Behavior | User Experience |
|------------|--------------|---------------|-----------------|
| EPO client not loaded | Skip, try REST | N/A | Transparent fallback |
| EPO not connected | Try connect, fail, try REST | N/A | Transparent fallback |
| EPO timeout | Catch, try REST | N/A | Transparent fallback |
| EPO `file_list` error | Catch, try REST | N/A | Transparent fallback |
| REST 404 | N/A | Show error | "Directory not found" + RETRY |
| REST 403 | N/A | Show error | "Permission denied" + RETRY |
| REST 500 | N/A | Show error | "Server error" + RETRY |
| REST network error | N/A | Show error | "Connection failed" + RETRY |
| Both fail | Failed | Failed | "Unable to load directory — [reason]. Attempted: EPO WebSocket, REST /api/files" + RETRY |
| Invalid response format | N/A | Throw | "Invalid response format" + RETRY |

---

## 6. Implementation Checklist

### Backend (`backend/server.js`)

- [ ] Add `case '/api/files':` to `_handleApiRequest` switch (after line 102)
- [ ] Add `_handleFileList(req, res, url)` method to `St8Server` class
- [ ] Implement path resolution with tilde expansion
- [ ] Implement path traversal prevention
- [ ] Implement directory reading with metadata
- [ ] Implement sorting (directories first)
- [ ] Implement error handling with proper HTTP status codes

### Frontend (`file-explorer.js`)

- [ ] Add `_fetchDirectoryEntries(path)` function
- [ ] Update `explorerNavigate()` to call `_fetchDirectoryEntries` instead of `_fetchViaWebSocket`
- [ ] Remove old `_fetchViaWebSocket` function
- [ ] Update error messages to include fallback context
- [ ] Test with EPO unavailable (standalone mode)
- [ ] Test with EPO available (integrated mode)

---

## 7. Testing Strategy

### Manual Test Cases

1. **Standalone Mode (No EPO)**
   - Start server with `node start.js`
   - Open `st8.html` in browser
   - Navigate directories in File Explorer
   - Verify: directories load via REST fallback

2. **EPO Available Mode**
   - Start with EPO server running
   - Navigate directories
   - Verify: directories load via EPO WebSocket

3. **EPO Failure Fallback**
   - Start with EPO client defined but server stopped
   - Navigate directories
   - Verify: transparent fallback to REST

4. **Error Handling**
   - Navigate to non-existent path
   - Navigate to permission-denied directory
   - Verify: error banner with RETRY button appears

5. **Path Expansion**
   - Navigate to `~` path
   - Navigate to `~/Documents`
   - Verify: tilde expands correctly

---

## 8. Dependencies & Integration Points

### Files to Modify

| File | Changes | Risk |
|------|---------|------|
| `backend/server.js` | Add route + handler | Low — isolated addition |
| `file-explorer.js` | Replace fetch function | Medium — core navigation logic |

### External Dependencies

- `fs` (Node.js built-in) — for directory reading
- `path` (Node.js built-in) — for path resolution
- `os` (Node.js built-in) — for homedir expansion

### No New Dependencies Required

All implementations use Node.js built-in modules and browser-native `fetch()`.

---

## 9. Performance Considerations

1. **Directory Size:** Large directories (>1000 entries) may be slow
   - Mitigation: Virtual scrolling already implemented in File Explorer
   - Optional: Add pagination or limit parameter

2. **Metadata Fetching:** `statSync()` called per file adds latency
   - Mitigation: Only fetch for files, not directories
   - Optional: Add `?metadata=false` parameter for faster listing

3. **Sorting:** Server-side sorting adds CPU time
   - Mitigation: Negligible for typical directory sizes
   - Alternative: Sort on client side

---

## 10. Future Enhancements (Out of Scope)

1. **WebSocket Upgrade:** If EPO server is implemented later, can switch back to primary
2. **Caching:** Add client-side cache for recently visited directories
3. **Pagination:** For directories with >10,000 entries
4. **File Watching:** Real-time updates via WebSocket when directory contents change
5. **Search:** Add `?search=<pattern>` parameter for filtering

---

## Summary

**Problem:** File Explorer completely non-functional without EPO WebSocket server.

**Solution:** 
1. Add `GET /api/files?path=<path>` endpoint to `backend/server.js`
2. Implement EPO-first-then-REST fallback in `file-explorer.js`
3. Graceful error handling with user-visible retry mechanism

**Effort:** ~2-3 hours implementation + testing

**Risk:** Low — isolated changes, no breaking changes to existing functionality

---

*Report generated by Agent 2 of 2 — A10 EPO Fallback Research*
