# Item F1: Final Summary — Stale Manifest Data After Indexing

## Problem
After clicking INDEX, `st8IndexingComplete()` shows stale manifest data instead of fresh data.

## Root Cause
The INDEX button's signal path is broken — it never actually re-indexes. The `st8IndexingComplete()` function is called regardless of indexing success, and fetches whatever stale manifest exists on disk.

## Severity
**BLOCKER** — TUI badges/isolate features show startup data, not re-index results.

## Key Findings

### 1. Broken Signal Path
- **Location:** `file-explorer.js:579-580`
- **Issue:** `PhreakTerminal.execute('index /path')` tries to run `index` as a shell command
- **Result:** Fails silently, error shown in terminal only

### 2. No Success Verification
- **Location:** `file-explorer.js:589-592`
- **Issue:** `st8IndexingComplete()` called immediately after `PhreakTerminal.execute()` returns
- **Result:** Called even when indexing fails

### 3. Stale Data Fetch
- **Location:** `st8.html:1886`
- **Issue:** `fetch('/api/connection-state.json')` reads whatever is on disk
- **Result:** Always returns stale data (from startup or last successful indexing)

### 4. Proper Endpoint Never Used
- **Location:** `server.js:94-95,223-237`
- **Issue:** `/api/index` endpoint exists and works correctly
- **Result:** Nothing in frontend calls it

### 5. Coordination Polling Not Wired
- **Location:** `st8.html:1600-1602`
- **Issue:** Polling exists but never updates `indexedFingerprints`
- **Result:** UI never gets fresh data from polling

## Data Flow

### Current (Broken)
```
INDEX click
  → PhreakTerminal.execute('index /path')  ← BROKEN
  → st8IndexingComplete() called anyway
  → fetchManifest() reads stale disk data
  → UI shows old data
```

### Correct (Fixed)
```
INDEX click
  → fetch('/api/index', { method: 'POST' })
  → indexDirectory() + writeManifests()
  → st8IndexingComplete() called after success
  → fetchManifest() reads fresh disk data
  → UI shows new data
```

## Recommended Fixes

1. **Replace PhreakTerminal delegation** with direct `/api/index` call
2. **Add success verification** before calling `st8IndexingComplete()`
3. **Add cache-busting** to `fetchManifest()`
4. **Wire coordination polling** to `indexedFingerprints`

## Impact

| Feature | Impact | Severity |
|---------|--------|----------|
| TUI Badges | Show stale status counts | HIGH |
| Isolate Files | Shows stale file list | HIGH |
| File List | Shows stale file statuses | HIGH |
| Copy File Context | Copies stale data | MEDIUM |
| Coordination Polling | Polls stale manifest | LOW |

## Status
**BLOCKER** — requires immediate fix

## Documentation
- `F1-INDEXING-STALE-DATA-REPORT.md` — detailed analysis
- `F1-INDEXING-STALE-DATA-SUMMARY.md` — executive summary
- `F1-VERIFICATION-REPORT.md` — verification results
- `F1-COMPLETE-ANALYSIS.md` — comprehensive analysis
- `F1-QUICK-REFERENCE.md` — quick reference
- `F1-FINAL-SUMMARY.md` — this file
