# Item F1: Complete Research — Stale Manifest Data After Indexing

## Problem Statement

After clicking the INDEX button, `st8IndexingComplete()` displays stale manifest data instead of fresh data. TUI badges and isolate features show startup data, not re-index results.

## Root Cause

The INDEX button's signal path is broken — it never actually re-indexes. The `st8IndexingComplete()` function is called regardless of indexing success, and fetches whatever stale manifest exists on disk.

## Severity

**BLOCKER** — TUI badges/isolate features show startup data, not re-index results.

---

## Key Findings

### 1. Broken Signal Path

**Location:** `file-explorer.js:579-580`

```javascript
await window.PhreakTerminal.execute('index ' + targetPath);
```

**Issue:** Routes through `PhreakTerminal.execute()` which treats `'index /path'` as a shell command. There is no shell binary named `index`.

**Evidence:**
- `phreakExecute()` at `phreak-terminal.js:47` sends command to `/api/exec`
- `_handleExec()` at `server.js:206-221` runs `execSync(command)`
- Command fails silently (error shown in terminal only)

### 2. No Success Verification

**Location:** `file-explorer.js:589-592`

```javascript
if (window.st8IndexingComplete) {
    window.st8IndexingComplete(targetPath);
}
```

**Issue:** Called immediately after `PhreakTerminal.execute()` returns, regardless of success/failure.

### 3. Stale Data Fetch

**Location:** `st8.html:1886`

```javascript
const response = await fetch('/api/connection-state.json');
```

**Issue:** No cache-busting parameter. `_serveManifest()` at `server.js:148-170` reads from disk with `fs.readFileSync()`. Returns whatever is on disk (stale from startup or last successful indexing).

### 4. Proper Endpoint Never Used

**Location:** `server.js:94-95`

```javascript
case '/api/index':
    this._handleIndex(req, res);
```

**Issue:** `/api/index` endpoint defined at `server.js:223-237` properly calls `indexDirectory()` and `writeManifests()`. **No frontend code calls this endpoint.**

### 5. Coordination Polling Not Wired

**Location:** `st8.html:1600-1602`

```javascript
if (window.St8Coordination) {
    window.St8Coordination.startPolling('/api/connection-state.json');
}
```

**Issue:** `startPolling()` at `coordination.js:58-70` polls every 2 seconds. `addListener()` at `coordination.js:82-90` exists but is never called. Polling data is fetched but never propagated to `indexedFingerprints`.

---

## Data Flow Trace

### Current (Broken) Flow

```
INDEX Button Click
       │
       ▼
_indexCodebase()                    [file-explorer.js:561]
       │
       ▼
PhreakTerminal.execute('index /path') [file-explorer.js:579]
       │
       ▼
/api/exec → execSync('index /path')   [server.js:206-221]
       │
       ▼
FAILS (not a shell command)
       │
       ▼
st8IndexingComplete(targetPath)       [file-explorer.js:590]
       │
       ▼
fetchManifest(targetPath)             [st8.html:1871]
       │
       ▼
fetch('/api/connection-state.json')   [st8.html:1886]
       │
       ▼
server.js reads from disk             [server.js:155-161]
       │
       ▼
RETURNS STALE DATA
       │
       ▼
renderFileList(staleFiles)            [st8.html:1873]
setIndexedFingerprints(staleManifest) [st8.html:1876]
```

### Correct (Fixed) Flow

```
INDEX Button Click
       │
       ▼
_indexCodebase()                    [file-explorer.js:561]
       │
       ▼
fetch('/api/index', { method: 'POST' })
       │
       ▼
_handleIndex()                      [server.js:223-237]
       │
       ├─► indexDirectory()             [indexer.js:302]
       │       │
       │       ▼
       │   File discovery, hashing, parsing
       │       │
       │       ▼
       │   Returns fresh files
       │
       ├─► writeManifests()            [manifestGenerator.js:134]
       │       │
       │       ▼
       │   Writes FRESH connection-state.json to disk
       │
       ▼
Response: { status: 'ok', files: N }
       │
       ▼
st8IndexingComplete(targetPath)       [file-explorer.js:590]
       │
       ▼
fetchManifest(targetPath)             [st8.html:1871]
       │
       ▼
fetch('/api/connection-state.json?t=' + Date.now())
       │
       ▼
server.js reads FRESH data from disk   [server.js:155-161]
       │
       ▼
renderFileList(freshFiles)            [st8.html:1873]
setIndexedFingerprints(freshManifest) [st8.html:1876]
```

---

## Timing Analysis

| Event | Timing | Data Freshness |
|-------|--------|----------------|
| Server startup | Reads existing manifest | Stale (from previous session) |
| INDEX click | Triggers broken signal path | No indexing occurs |
| `st8IndexingComplete()` | Called immediately | Fetches stale data |
| UI update | Shows stale data | User sees old information |

## Race Condition Assessment

**No race condition exists** — it's worse. The indexing never happens at all.

If `/api/index` were called:
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

## Impact Assessment

| Feature | Impact | Severity |
|---------|--------|----------|
| TUI Badges | Show stale status counts | HIGH |
| Isolate Files | Shows stale file list | HIGH |
| File List | Shows stale file statuses | HIGH |
| Copy File Context | Copies stale data | MEDIUM |
| Coordination Polling | Polls stale manifest | LOW |

## User Experience

1. User clicks INDEX → button shows "INDEXING..."
2. PhreakTerminal shows error (if visible)
3. Button returns to "INDEX"
4. UI shows stale data (same as before)
5. User thinks indexing completed successfully
6. **Silent data corruption** — user makes decisions based on stale data

---

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

---

## File References

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

---

## Conclusion

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

---

## Documentation Files

- `F1-INDEXING-STALE-DATA-REPORT.md` — detailed analysis
- `F1-INDEXING-STALE-DATA-SUMMARY.md` — executive summary
- `F1-VERIFICATION-REPORT.md` — verification results
- `F1-COMPLETE-ANALYSIS.md` — comprehensive analysis
- `F1-QUICK-REFERENCE.md` — quick reference
- `F1-FINAL-SUMMARY.md` — final summary
- `F1-RESEARCH-REPORT.md` — research report
- `F1-COMPLETE-DOCUMENTATION.md` — complete documentation
- `F1-ACTIONABLE-SUMMARY.md` — actionable summary
- `F1-COMPLETE-RESEARCH.md` — this file
