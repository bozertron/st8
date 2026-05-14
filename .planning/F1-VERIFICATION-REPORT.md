# Item F1: Verification Report

## Verification Date
2026-05-13

## Files Examined

1. **st8.html** (1908 lines)
   - `st8IndexingComplete()` — lines 1867-1880
   - `fetchManifest()` — lines 1883-1905
   - `renderFileList()` — lines 1639-1674
   - Coordination polling start — lines 1600-1602

2. **file-explorer.js** (664 lines)
   - `_indexCodebase()` — lines 561-603
   - `explorerState.indexedFingerprints` — line 30
   - `setIndexedFingerprints()` — line 662
   - `getIndexedFingerprints()` — line 661

3. **server.js** (342 lines)
   - `/api/exec` endpoint — lines 91-92, handler lines 206-221
   - `/api/index` endpoint — lines 94-95, handler lines 223-237
   - `/api/connection-state.json` endpoint — lines 82-83, handler lines 148-170

4. **coordination.js** (210 lines)
   - `startPolling()` — lines 58-70
   - `addListener()` — lines 82-90
   - `loadManifest()` — lines 27-44

5. **phreak-terminal.js** (1046 lines)
   - `phreakExecute()` — lines 47-119

## Verification Results

### ✅ Confirmed: Broken Signal Path

**Location:** `file-explorer.js:579-580`
```javascript
await window.PhreakTerminal.execute('index ' + targetPath);
```

**Evidence:** 
- `phreakExecute()` at `phreak-terminal.js:47` sends command to `/api/exec`
- `_handleExec()` at `server.js:206-221` runs `execSync(command)`
- There is no shell binary named `index` — command fails

### ✅ Confirmed: No Success Verification

**Location:** `file-explorer.js:589-592`
```javascript
if (window.st8IndexingComplete) {
    window.st8IndexingComplete(targetPath);
}
```

**Evidence:** Called immediately after `PhreakTerminal.execute()` returns, regardless of success/failure.

### ✅ Confirmed: Stale Data Fetch

**Location:** `st8.html:1886`
```javascript
const response = await fetch('/api/connection-state.json');
```

**Evidence:** 
- No cache-busting parameter
- `_serveManifest()` at `server.js:148-170` reads from disk with `fs.readFileSync()`
- Returns whatever is on disk (stale from startup or last successful indexing)

### ✅ Confirmed: Proper Endpoint Never Called

**Location:** `server.js:94-95`
```javascript
case '/api/index':
    this._handleIndex(req, res);
```

**Evidence:** 
- `/api/index` endpoint defined at `server.js:223-237`
- Properly calls `indexDirectory()` and `writeManifests()`
- **No frontend code calls this endpoint** (verified via grep)

### ✅ Confirmed: Coordination Polling Not Wired

**Location:** `st8.html:1600-1602`
```javascript
if (window.St8Coordination) {
    window.St8Coordination.startPolling('/api/connection-state.json');
}
```

**Evidence:**
- `startPolling()` at `coordination.js:58-70` polls every 2 seconds
- `addListener()` at `coordination.js:82-90` exists but is never called
- Polling data is fetched but never propagated to `indexedFingerprints`

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT (BROKEN) FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INDEX Button Click                                             │
│       │                                                         │
│       ▼                                                         │
│  _indexCodebase()                    [file-explorer.js:561]     │
│       │                                                         │
│       ▼                                                         │
│  PhreakTerminal.execute('index /path') [file-explorer.js:579]   │
│       │                                                         │
│       ▼                                                         │
│  /api/exec → execSync('index /path')   [server.js:206-221]     │
│       │                                                         │
│       ▼                                                         │
│  FAILS (not a shell command)                                    │
│       │                                                         │
│       ▼                                                         │
│  st8IndexingComplete(targetPath)       [file-explorer.js:590]   │
│       │                                                         │
│       ▼                                                         │
│  fetchManifest(targetPath)             [st8.html:1871]          │
│       │                                                         │
│       ▼                                                         │
│  fetch('/api/connection-state.json')   [st8.html:1886]          │
│       │                                                         │
│       ▼                                                         │
│  server.js reads from disk             [server.js:155-161]      │
│       │                                                         │
│       ▼                                                         │
│  RETURNS STALE DATA                                             │
│       │                                                         │
│       ▼                                                         │
│  renderFileList(staleFiles)            [st8.html:1873]          │
│  setIndexedFingerprints(staleManifest) [st8.html:1876]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Correct Flow (What Should Happen)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORRECT (FIXED) FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INDEX Button Click                                             │
│       │                                                         │
│       ▼                                                         │
│  _indexCodebase()                    [file-explorer.js:561]     │
│       │                                                         │
│       ▼                                                         │
│  fetch('/api/index', { method: 'POST' })                        │
│       │                                                         │
│       ▼                                                         │
│  _handleIndex()                      [server.js:223-237]        │
│       │                                                         │
│       ├─► indexDirectory()             [indexer.js:302]          │
│       │       │                                                 │
│       │       ▼                                                 │
│       │   File discovery, hashing, parsing                      │
│       │       │                                                 │
│       │       ▼                                                 │
│       │   Returns fresh files                                   │
│       │                                                         │
│       ├─► writeManifests()            [manifestGenerator.js:134] │
│       │       │                                                 │
│       │       ▼                                                 │
│       │   Writes FRESH connection-state.json to disk            │
│       │                                                         │
│       ▼                                                         │
│  Response: { status: 'ok', files: N }                           │
│       │                                                         │
│       ▼                                                         │
│  st8IndexingComplete(targetPath)       [file-explorer.js:590]   │
│       │                                                         │
│       ▼                                                         │
│  fetchManifest(targetPath)             [st8.html:1871]          │
│       │                                                         │
│       ▼                                                         │
│  fetch('/api/connection-state.json?t=' + Date.now())            │
│       │                                                         │
│       ▼                                                         │
│  server.js reads FRESH data from disk   [server.js:155-161]     │
│       │                                                         │
│       ▼                                                         │
│  renderFileList(freshFiles)            [st8.html:1873]          │
│  setIndexedFingerprints(freshManifest) [st8.html:1876]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Race Condition Analysis

### Is there a race condition? **NO**

The problem is not a race condition — it's a **broken signal path**. The indexing never happens at all.

### If `/api/index` were called, would there be a race?

**Potential race:** If `fetchManifest()` is called before `writeManifests()` completes.

**Mitigation:** 
1. `/api/index` endpoint waits for `writeManifests()` to complete before responding
2. `st8IndexingComplete()` is called after `/api/index` responds
3. `fetchManifest()` then reads fresh data from disk

**Status:** No race condition if properly implemented.

## Impact Assessment

| Feature | Impact | Severity |
|---------|--------|----------|
| TUI Badges | Show stale status counts | HIGH |
| Isolate Files | Shows stale file list | HIGH |
| File List | Shows stale file statuses | HIGH |
| Copy File Context | Copies stale data | MEDIUM |
| Coordination Polling | Polls stale manifest | LOW |

## Recommended Fixes

### Fix 1: Replace PhreakTerminal Delegation (Primary)

**File:** `file-explorer.js:577-581`

**Current:**
```javascript
if (window.PhreakTerminal && window.PhreakTerminal.execute) {
    await window.PhreakTerminal.execute('index ' + targetPath);
}
```

**Fixed:**
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

### Fix 2: Add Success Verification

**File:** `file-explorer.js:589-592`

**Current:**
```javascript
if (window.st8IndexingComplete) {
    window.st8IndexingComplete(targetPath);
}
```

**Fixed:**
```javascript
if (response.ok && window.st8IndexingComplete) {
    window.st8IndexingComplete(targetPath);
}
```

### Fix 3: Add Cache-Busting

**File:** `st8.html:1886`

**Current:**
```javascript
const response = await fetch('/api/connection-state.json');
```

**Fixed:**
```javascript
const response = await fetch('/api/connection-state.json?t=' + Date.now());
```

### Fix 4: Wire Coordination Polling

**File:** `st8.html:1600-1602`

**Current:**
```javascript
if (window.St8Coordination) {
    window.St8Coordination.startPolling('/api/connection-state.json');
}
```

**Fixed:**
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

## Verification Checklist

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

## Conclusion

**Status:** BLOCKER — requires immediate fix

**Root Cause:** INDEX button's signal path is broken — never actually re-indexes

**Impact:** TUI badges/isolate features show startup data, not re-index results

**Fix Complexity:** Low — 4 code changes in 2 files

**Risk:** Low — changes are isolated and well-understood
