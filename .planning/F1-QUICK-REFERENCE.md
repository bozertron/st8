# Item F1: Quick Reference — Stale Manifest Data After Indexing

## Issue
INDEX button shows stale data because indexing never actually happens.

## Root Cause
Broken signal path: `PhreakTerminal.execute('index /path')` tries to run `index` as a shell command (it's not).

## Key Code Locations

| What | Where | Line(s) |
|------|-------|---------|
| INDEX button handler | `file-explorer.js` | 561-603 |
| Broken PhreakTerminal call | `file-explorer.js` | 579-580 |
| `st8IndexingComplete()` | `st8.html` | 1867-1880 |
| `fetchManifest()` | `st8.html` | 1883-1905 |
| Stale data fetch | `st8.html` | 1886 |
| Proper `/api/index` endpoint | `server.js` | 223-237 |
| Coordination polling | `coordination.js` | 58-70 |

## The Problem

```
INDEX click
  → PhreakTerminal.execute('index /path')  ← BROKEN
  → st8IndexingComplete() called anyway
  → fetchManifest() reads stale disk data
  → UI shows old data
```

## The Fix

1. **Replace PhreakTerminal with direct `/api/index` call** (`file-explorer.js:579`)
2. **Add success verification** before calling `st8IndexingComplete()` (`file-explorer.js:590`)
3. **Add cache-busting** to `fetchManifest()` (`st8.html:1886`)
4. **Wire coordination polling** to `indexedFingerprints` (`st8.html:1600`)

## Impact
- TUI badges: show stale status counts
- Isolate files: shows stale file list
- File list: shows stale file statuses

## Status
**BLOCKER** — requires immediate fix

## Documentation
- `F1-INDEXING-STALE-DATA-REPORT.md` — detailed analysis
- `F1-INDEXING-STALE-DATA-SUMMARY.md` — executive summary
- `F1-VERIFICATION-REPORT.md` — verification results
- `F1-COMPLETE-ANALYSIS.md` — comprehensive analysis
- `F1-QUICK-REFERENCE.md` — this file
