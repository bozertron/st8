# Item F1: Research Report — Stale Manifest Data After Indexing

## Executive Summary

**Issue:** After clicking INDEX, `st8IndexingComplete()` shows stale manifest data instead of fresh data.

**Root Cause:** The INDEX button's signal path is broken — it never actually re-indexes. The `st8IndexingComplete()` function is called regardless of indexing success, and fetches whatever stale manifest exists on disk.

**Severity:** BLOCKER — TUI badges/isolate features show startup data, not re-index results.

**Fix Complexity:** Low — 4 code changes in 2 files

---

## 1. Problem Analysis

### 1.1 The Issue

When a user clicks the INDEX button in the file explorer:
1. The button shows "INDEXING..." temporarily
2. The PhreakTerminal shows an error (if visible)
3. The button returns to "INDEX"
4. The UI shows stale data (same as before)
5. The user thinks indexing completed successfully
6. **Silent data corruption** — user makes decisions based on stale data

### 1.2 Root Cause

The INDEX button's signal path is broken:

```
INDEX click
  → _indexCodebase()                        [file-explorer.js:561]
  → PhreakTerminal.execute('index /path')   [file-explorer.js:579]
  → /api/exec → execSync('index /path')    [server.js:206-221]
  → FAILS (not a shell command)
  → st8IndexingComplete() called anyway     [file-explorer.js:590]
  → fetchManifest() reads stale disk data   [st8.html:1886]
  → UI shows old data
```

---

## 2. Detailed Analysis

### 2.1 `st8IndexingComplete()` Function

**Location:** `st8.html:1867-1880`

```javascript
window.st8IndexingComplete = function(targetPath) {
  console.info('[st8] indexing complete for:', targetPath);
  
  // Fetch the manifest and populate the file list
  fetchManifest(targetPath).then(function(manifest) {
    if (manifest && manifest.files) {
      renderFileList(manifest.files);
      // Store in explorer state
      if (window.VoidFileExplorer && window.VoidFileExplorer.setIndexedFingerprints) {
        window.VoidFileExplorer.setIndexedFingerprints(manifest);
      }
    }
  });
};
```

**Issues:**
1. No error handling — if fetch fails, silently does nothing
2. No verification — doesn't check if indexing actually succeeded
3. Always called regardless of indexing success

### 2.2 `fetchManifest()` Function

**Location:** `st8.html:1883-1905`

```javascript
async function fetchManifest(targetPath) {
  try {
    // Try to fetch from the backend server (relative path)
    const response = await fetch('/api/connection-state.json');
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[st8] Backend server not available, trying local file');
  }
  
  // Fallback: try to read from local file
  try {
    const response = await fetch(targetPath + '/connection-state.json');
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[st8] Local manifest not found');
  }
  
  return null;
}
```

**Issues:**
1. No cache-busting — always reads whatever is on disk
2. No freshness check — doesn't verify data is current
3. Returns stale data without warning

### 2.3 `_indexCodebase()` Function

**Location:** `file-explorer.js:561-603`

```javascript
async function _indexCodebase() {
    const indexBtn = document.getElementById('explorer-index-btn');
    if (!indexBtn) return;
    
    // Get current path
    const targetPath = explorerState.currentPath;
    if (!targetPath || targetPath === '~') {
        console.warn('[st8] Cannot index home directory');
        return;
    }
    
    // Update button state
    indexBtn.classList.add('indexing');
    indexBtn.textContent = 'INDEXING...';
    indexBtn.disabled = true;
    
    try {
        // Send indexing request to phreak terminal
        if (window.PhreakTerminal && window.PhreakTerminal.execute) {
            await window.PhreakTerminal.execute('index ' + targetPath);
        }
        
        // Show Verify button after indexing
        const verifyBtn = document.getElementById('explorer-verify-btn');
        if (verifyBtn) {
            verifyBtn.style.display = '';
        }
        
        // Notify UI
        if (window.st8IndexingComplete) {
            window.st8IndexingComplete(targetPath);
        }
        
        console.info('[st8] Indexing triggered for:', targetPath);
    } catch (err) {
        console.error('[st8] Indexing failed:', err);
    } finally {
        // Restore button state
        indexBtn.classList.remove('indexing');
        indexBtn.textContent = 'INDEX';
        indexBtn.disabled = false;
    }
}
```

**Issues:**
1. Routes through `PhreakTerminal.execute()` which treats `'index /path'` as a shell command
2. `st8IndexingComplete()` called immediately after `PhreakTerminal.execute()` returns
3. No success verification before calling `st8IndexingComplete()`

### 2.4 PhreakTerminal.execute() Function

**Location:** `phreak-terminal.js:47-119`

```javascript
async function phreakExecute(cmd) {
    if (!cmd.trim()) return;

    // Push to history
    phreakState.history.push(cmd);
    phreakState.historyIndex = -1;

    // Echo input line
    phreakState.lines.push(_mkLine('input', cmd));
    phreakState.isExecuting = true;
    _renderLines();

    try {
        // Built-in media commands (routed via EPO bus to media_control)
        var handled = await _tryMediaCommand(cmd);
        if (handled) {
            phreakState.isExecuting = false;
            _renderLines();
            return;
        }

        // Use EPO WebSocket for exec (replaces dead /api/v1/exec REST)
        if (window.epoClient && window.epoClient.connected) {
            const data = await window.epoClient.request('exec', { command: cmd });
            // ... handle stdout/stderr
        } else {
            // Fallback to backend API when not connected to EPO
            try {
                const response = await fetch('/api/exec', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: cmd })
                });
                const data = await response.json();
                // ... handle stdout/stderr
            } catch (fetchErr) {
                phreakState.lines.push(_mkLine('stderr', 'Backend not available: ' + fetchErr.message));
            }
        }
    } catch (err) {
        phreakState.lines.push(_mkLine('stderr', 'Error: ' + err.message));
    }

    phreakState.isExecuting = false;
    _renderLines();
}
```

**Issues:**
1. Treats `'index /path'` as a shell command
2. Routes to `/api/exec` which runs `execSync('index /path')`
3. `index` is not a shell command — fails silently

### 2.5 Server `/api/exec` Endpoint

**Location:** `server.js:206-221`

```javascript
_handleExec(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { command } = JSON.parse(body);
            const { execSync } = require('child_process');
            const result = execSync(command, { encoding: 'utf-8', timeout: 30000 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ stdout: result, stderr: '' }));
        } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ stdout: '', stderr: err.message }));
        }
    });
}
```

**Issues:**
1. Runs arbitrary shell commands
2. `index` is not a shell command — fails
3. Error returned as stderr, not thrown

### 2.6 Server `/api/index` Endpoint (Never Called)

**Location:** `server.js:223-237`

```javascript
_handleIndex(req, res) {
    const { indexDirectory } = require('./indexer');
    const { writeManifests } = require('./manifestGenerator');
    
    indexDirectory(this.targetDir, { write: true })
        .then(result => {
            writeManifests(result.files, this.targetDir);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', files: result.files.length }));
        })
        .catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
}
```

**This endpoint:**
1. Calls `indexDirectory()` (actual indexing)
2. Calls `writeManifests()` (writes fresh manifest to disk)
3. Returns success/failure

**But nothing in the frontend calls it.**

### 2.7 Coordination Polling

**Location:** `coordination.js:58-70`

```javascript
function startPolling(manifestPath) {
    coordinationState.manifestPath = manifestPath;
    
    // Initial load
    loadManifest(manifestPath);
    
    // Start polling
    coordinationState.pollInterval = setInterval(function() {
        loadManifest(manifestPath);
    }, coordinationState.pollMs);
    
    console.info('[st8:coordination] Polling started:', manifestPath);
}
```

**Location:** `coordination.js:82-90`

```javascript
function addListener(callback) {
    coordinationState.listeners.push(callback);
    return function() {
        var index = coordinationState.listeners.indexOf(callback);
        if (index !== -1) {
            coordinationState.listeners.splice(index, 1);
        }
    };
}
```

**Location:** `st8.html:1600-1602`

```javascript
if (window.St8Coordination) {
    window.St8Coordination.startPolling('/api/connection-state.json');
}
```

**Issues:**
1. Polling starts but `addListener()` is never called
2. Polling data is fetched but never propagated to `indexedFingerprints`
3. UI never gets fresh data from polling

---

## 3. Timing Analysis

### 3.1 Manifest Write Timing

| Event | Location | When |
|-------|----------|------|
| **Startup** | `server.js:227-229` | Server starts, may load existing manifest |
| **Manual indexing** | `indexer.js:359-361` | Only when `indexer.js` run directly via CLI |
| **`/api/index` endpoint** | `server.js:223-237` | **NEVER called from frontend** |
| **`/api/file-intent`** | `server.js:239-274` | Saves to SQLite, **does NOT regenerate manifest** |

### 3.2 Manifest Read Timing

| Event | Location | What It Reads |
|-------|----------|---------------|
| **Coordination polling** | `coordination.js:62-67` | `/api/connection-state.json` every 2s |
| **`st8IndexingComplete()`** | `st8.html:1886` | `/api/connection-state.json` on-demand |
| **`copyFileContext()`** | `st8.html:1688` | `VoidFileExplorer.getIndexedFingerprints()` (in-memory) |

### 3.3 Race Condition Assessment

**Is there a race condition?** **NO** — it's worse than a race condition.

**The problem is:**
1. The INDEX button never triggers actual indexing
2. `st8IndexingComplete()` is called regardless of indexing success
3. `fetchManifest()` reads stale data from disk
4. There's no race because indexing never happens

**If `/api/index` were called:**
- `indexDirectory()` takes time (file discovery, hashing, parsing)
- `writeManifests()` writes fresh data to disk
- `fetchManifest()` would need to wait for write to complete
- **Potential race:** if `fetchManifest()` called before `writeManifests()` completes

**Mitigation:**
1. `/api/index` endpoint waits for `writeManifests()` to complete before responding
2. `st8IndexingComplete()` is called after `/api/index` responds
3. `fetchManifest()` then reads fresh data from disk

**Status:** No race condition if properly implemented.

---

## 4. Impact Assessment

### 4.1 Affected Features

| Feature | Impact | Severity |
|---------|--------|----------|
| **TUI Badges** | Show stale status counts | HIGH |
| **Isolate Files** | Shows stale file list | HIGH |
| **File List** | Shows stale file statuses | HIGH |
| **Copy File Context** | Copies stale data | MEDIUM |
| **Coordination Polling** | Polls stale manifest | LOW |

### 4.2 User Experience

1. User clicks INDEX → button shows "INDEXING..."
2. PhreakTerminal shows error (if visible)
3. Button returns to "INDEX"
4. UI shows stale data (same as before)
5. User thinks indexing completed successfully
6. **Silent data corruption** — user makes decisions based on stale data

---

## 5. Recommended Fixes

### 5.1 Fix `_indexCodebase()` (Primary)

**File:** `file-explorer.js:577-581`

**Replace:**
```javascript
if (window.PhreakTerminal && window.PhreakTerminal.execute) {
    await window.PhreakTerminal.execute('index ' + targetPath);
}
```

**With:**
```javascript
const response = await fetch('/api/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: targetPath })
});
const result = await response.json();
if (result.error) {
    throw new Error(result.error);
}
```

### 5.2 Add Success Verification

**File:** `file-explorer.js:589-592`

**Add check:**
```javascript
// Only notify UI if indexing succeeded
if (response.ok) {
    if (window.st8IndexingComplete) {
        window.st8IndexingComplete(targetPath);
    }
}
```

### 5.3 Add Cache-Busting to `fetchManifest()`

**File:** `st8.html:1886`

**Add timestamp:**
```javascript
const response = await fetch('/api/connection-state.json?t=' + Date.now());
```

### 5.4 Wire Coordination Polling to `indexedFingerprints`

**File:** `st8.html:1600-1602`

**Add listener:**
```javascript
if (window.St8Coordination) {
    window.St8Coordination.startPolling('/api/connection-state.json');
    window.St8Coordination.addListener(function(manifest) {
        if (manifest && manifest.files) {
            renderFileList(manifest.files);
            if (window.VoidFileExplorer && window.VoidFileExplorer.setIndexedFingerprints) {
                window.VoidFileExplorer.setIndexedFingerprints(manifest);
            }
        }
    });
}
```

---

## 6. Verification Checklist

- [ ] INDEX button calls `/api/index` directly (not PhreakTerminal)
- [ ] `/api/index` endpoint receives POST request
- [ ] `indexDirectory()` runs successfully
- [ ] `writeManifests()` writes fresh manifest to disk
- [ ] `st8IndexingComplete()` called only after success
- [ ] `fetchManifest()` includes cache-busting timestamp
- [ ] `renderFileList()` receives fresh data
- [ ] `setIndexedFingerprints()` stores fresh manifest
- [ ] TUI badges show updated status counts
- [ ] Coordination polling wired to `indexedFingerprints`

---

## 7. File References

| File | Line(s) | Function | Issue |
|------|---------|----------|-------|
| `file-explorer.js` | 561-603 | `_indexCodebase()` | Routes through PhreakTerminal instead of `/api/index` |
| `file-explorer.js` | 579-580 | `PhreakTerminal.execute()` | Treats 'index' as shell command |
| `file-explorer.js` | 590-592 | `st8IndexingComplete()` call | No success verification |
| `file-explorer.js` | 661-662 | `get/setIndexedFingerprints()` | API works, but receives stale data |
| `st8.html` | 1867-1880 | `st8IndexingComplete()` | No error handling, no success check |
| `st8.html` | 1883-1905 | `fetchManifest()` | No cache-busting, reads stale disk data |
| `st8.html` | 1886 | `fetch('/api/connection-state.json')` | Always reads stale data |
| `st8.html` | 1600-1602 | Coordination polling start | Not wired to `indexedFingerprints` |
| `server.js` | 91-92 | `/api/exec` endpoint | Routes to `execSync()` (wrong for indexing) |
| `server.js` | 94-95 | `/api/index` endpoint | Proper indexing endpoint (never called) |
| `server.js` | 206-221 | `_handleExec()` | Runs arbitrary shell commands |
| `server.js` | 223-237 | `_handleIndex()` | Proper indexing handler (never called) |
| `server.js` | 148-170 | `_serveManifest()` | Reads stale file from disk |
| `coordination.js` | 58-70 | `startPolling()` | Polls stale manifest |
| `coordination.js` | 82-90 | `addListener()` | API exists but never consumed |

---

## 8. Conclusion

**Status:** BLOCKER — requires immediate fix

**Root Cause:** INDEX button's signal path is broken — never actually re-indexes

**Impact:** TUI badges/isolate features show startup data, not re-index results

**Fix Complexity:** Low — 4 code changes in 2 files

**Risk:** Low — changes are isolated and well-understood

**Next Steps:**
1. Implement Fix 1 (replace PhreakTerminal delegation)
2. Implement Fix 2 (add success verification)
3. Implement Fix 3 (add cache-busting)
4. Implement Fix 4 (wire coordination polling)
5. Test end-to-end indexing flow
6. Verify TUI badges update correctly
7. Verify isolate features show fresh data
