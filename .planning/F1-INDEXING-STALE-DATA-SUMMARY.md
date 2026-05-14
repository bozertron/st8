# Item F1: Stale Manifest Data After Indexing — Research Summary

## Issue
After clicking INDEX, `st8IndexingComplete()` shows stale manifest data instead of fresh data.

## Root Cause
The INDEX button's signal path is broken — it never actually re-indexes.

## Data Flow Trace

```
INDEX click → _indexCodebase()
  → PhreakTerminal.execute('index /path')     ← BROKEN: 'index' not a shell command
  → st8IndexingComplete(targetPath)           ← Called regardless of success
    → fetchManifest(targetPath)
      → fetch('/api/connection-state.json')   ← Reads STALE data from disk
        → renderFileList(staleFiles)
        → setIndexedFingerprints(staleManifest)
```

## Key Findings

### 1. Broken Signal Path
- **File:** `file-explorer.js:579-580`
- **Issue:** `PhreakTerminal.execute('index /path')` tries to run `index` as a shell command
- **Result:** Fails silently, error shown in terminal only

### 2. No Success Verification
- **File:** `file-explorer.js:590-592`
- **Issue:** `st8IndexingComplete()` called immediately after `PhreakTerminal.execute()` returns
- **Result:** Called even when indexing fails

### 3. Stale Data Fetch
- **File:** `st8.html:1886`
- **Issue:** `fetch('/api/connection-state.json')` reads whatever is on disk
- **Result:** Always returns stale data (from startup or last successful indexing)

### 4. Proper Endpoint Never Used
- **File:** `server.js:223-237`
- **Issue:** `/api/index` endpoint exists and works correctly
- **Result:** Nothing in frontend calls it

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

## Impact

| Feature | Impact |
|---------|--------|
| TUI Badges | Show stale status counts |
| Isolate Files | Shows stale file list |
| File List | Shows stale file statuses |
| Copy File Context | Copies stale data |

## Recommended Fix

1. **Replace PhreakTerminal delegation** with direct `/api/index` call
2. **Add success verification** before calling `st8IndexingComplete()`
3. **Add cache-busting** to `fetchManifest()` (`?t=` + Date.now())
4. **Wire coordination polling** to `indexedFingerprints`

## Files Involved

- `file-explorer.js:561-603` — `_indexCodebase()` (broken signal path)
- `st8.html:1867-1905` — `st8IndexingComplete()` and `fetchManifest()` (stale data)
- `server.js:94-95,223-237` — `/api/index` endpoint (never called)
- `coordination.js:58-90` — Polling exists but not wired to UI

## Status

**BLOCKER** — TUI badges/isolate features show startup data, not re-index results.
