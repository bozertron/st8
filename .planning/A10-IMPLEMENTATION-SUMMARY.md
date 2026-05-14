# A10: EPO Fallback — Quick Implementation Guide

**For:** Agent implementing the fix  
**Files:** `backend/server.js`, `file-explorer.js`

---

## Step 1: Backend — Add `/api/files` Route

### 1a. Add Route (server.js, after line 102)

```javascript
case '/api/files':
    this._handleFileList(req, res, url);
    break;
```

### 1b. Add Handler Method (server.js, before `stop()` method)

```javascript
_handleFileList(req, res, url) {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }
    
    let targetPath = url.searchParams.get('path') || this.targetDir;
    
    // Expand tilde
    if (targetPath.startsWith('~')) {
        const os = require('os');
        targetPath = targetPath.replace(/^~/, os.homedir());
    }
    
    const resolvedPath = path.resolve(targetPath);
    
    if (!fs.existsSync(resolvedPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Directory not found' }));
        return;
    }
    
    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Path is not a directory' }));
        return;
    }
    
    try {
        const dirents = fs.readdirSync(resolvedPath, { withFileTypes: true });
        const entries = dirents.map(dirent => {
            const entry = {
                name: dirent.name,
                isDirectory: dirent.isDirectory(),
                path: path.join(resolvedPath, dirent.name)
            };
            
            if (!dirent.isDirectory()) {
                try {
                    const fileStat = fs.statSync(entry.path);
                    entry.size = fileStat.size;
                    entry.modifiedAt = fileStat.mtime.toISOString();
                } catch (e) {
                    entry.size = null;
                    entry.modifiedAt = null;
                }
            }
            
            return entry;
        });
        
        entries.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ entries }));
    } catch (err) {
        const statusCode = err.code === 'EACCES' ? 403 : err.code === 'ENOENT' ? 404 : 500;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
}
```

---

## Step 2: Frontend — Add Fallback Logic

### 2a. Replace `_fetchViaWebSocket` (file-explorer.js, lines 146-158)

```javascript
async function _fetchDirectoryEntries(path) {
    let lastError = null;
    
    // Try EPO first
    if (typeof window.epoClient !== 'undefined') {
        try {
            if (!window.epoClient.connected) {
                await window.epoClient.connect();
            }
            const res = await window.epoClient.request('file_list', { path });
            if (res.error) throw new Error(res.error);
            console.info('[st8:explorer] Directory listing via EPO WebSocket');
            return res.entries || res;
        } catch (epoErr) {
            lastError = epoErr;
            console.warn('[st8:explorer] EPO failed, trying REST fallback:', epoErr.message);
        }
    }
    
    // REST fallback
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
        const attempted = [];
        if (typeof window.epoClient !== 'undefined') attempted.push('EPO WebSocket');
        attempted.push('REST /api/files');
        throw new Error(
            `Failed to load directory: ${restErr.message}. Attempted: ${attempted.join(', ')}`
        );
    }
}
```

### 2b. Update `explorerNavigate` (file-explorer.js, line 128)

```javascript
// Change:
entries = await _fetchViaWebSocket(path);
// To:
entries = await _fetchDirectoryEntries(path);
```

### 2c. Delete Old Function

Remove lines 146-158 (`_fetchViaWebSocket` function).

---

## Verification Checklist

- [ ] Server starts without errors
- [ ] `GET /api/files?path=.` returns directory listing
- [ ] `GET /api/files?path=~/Documents` expands tilde correctly
- [ ] `GET /api/files?path=/nonexistent` returns 404
- [ ] File Explorer navigates directories in standalone mode
- [ ] File Explorer shows error banner on failure
- [ ] RETRY button works after error
- [ ] Console shows "Directory listing via REST fallback" in standalone mode

---

## Expected Behavior

| Scenario | Expected Result |
|----------|-----------------|
| Standalone (no EPO) | REST fallback, works normally |
| EPO available | Uses EPO WebSocket |
| EPO fails | Transparent fallback to REST |
| Both fail | Error banner with RETRY button |
| Invalid path | "Directory not found" error |
| Permission denied | "Permission denied" error |

---

*Quick reference for A10 implementation*
