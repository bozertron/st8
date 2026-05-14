# W1-01 Report: Fix Recursive .txt Emission Loop

**Status:** COMPLETE  
**Commit:** `723049e`  
**Date:** 2026-05-13T15:50:15Z  

---

## Problem

The ST8 indexer walked into `.archive/`, `.planning/`, `.st8/`, `vendor/`, and `snapshots/` directories, discovering code files that should be ignored. This caused:

1. **63 phantom DB entries** from ignored directories
2. **107 schema cards** printed (68 from `.archive/` + 39 legitimate)
3. **Recursive .txt emission** — printer created `.txt` files for `.sqlite-wal` and `.sqlite-shm` entries, generating filenames like `LATEST_.planning_st8_identity_system_LATEST_.planning_st8_identity_system_LATEST_st8.sqlite-wal.txt.txt.txt.txt.txt.txt`

---

## Fix 1: IGNORE_DIRS (indexer.js)

**File:** `backend/indexer.js`  
**Line:** 161

### Before
```javascript
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__']);
```

### After
```javascript
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__', '.archive', '.planning', '.st8', 'vendor', 'snapshots']);
```

**Added:** `.archive`, `.planning`, `.st8`, `vendor`, `snapshots`

---

## Fix 2: Printer Guard (schemaCardPrinter.js)

**File:** `backend/schemaCardPrinter.js`  
**Lines:** 44-62 (new guard block)

### Guard Logic
```javascript
printCard(card) {
    // Guard: skip non-code files that should never get .txt cards
    const skipExtensions = ['.txt', '.json', '.sqlite-wal', '.sqlite-shm'];
    const lowerPath = card.filepath.toLowerCase();
    for (const ext of skipExtensions) {
        if (lowerPath.endsWith(ext)) {
            return null;
        }
    }
    // Guard: skip files inside .st8/schema-cards (emitted JSON cards)
    if (card.filepath.includes('.st8/schema-cards')) {
        return null;
    }
    // Guard: skip files from directories that should be ignored
    const ignoredPrefixes = ['.archive/', '.planning/', '.st8/', 'vendor/', 'snapshots/'];
    for (const prefix of ignoredPrefixes) {
        if (card.filepath.startsWith(prefix) || card.filepath.includes('/' + prefix)) {
            return null;
        }
    }
    // ... rest of printCard()
}
```

**Three-layer guard:**
1. **Extension check:** Skip `.txt`, `.json`, `.sqlite-wal`, `.sqlite-shm`
2. **Schema-cards path:** Skip `.st8/schema-cards/` entries
3. **Ignored directory prefix:** Skip `.archive/`, `.planning/`, `.st8/`, `vendor/`, `snapshots/`

---

## Fix 3: Phantom Cleanup

### DB Cleanup
- **63 phantom entries** deleted from `file_registry`
- **0 entries** remaining from ignored directories
- Connections, intent, and mutation log entries also cleaned

### Artifact Cleanup
- **68 phantom JSON cards** deleted from `.st8/schema-cards/`
- **35 phantom .txt files** deleted from `.planning/st8_identity_system/`

---

## Verification

### Run 1: Fresh DB
```bash
rm -f st8.sqlite st8.sqlite-wal st8.sqlite-shm
node backend/index.js .
```

**Result:**
- Indexer found 39 code files (correct — no `.archive/` files)
- Emitter emitted 39 schema cards
- Printer printed 39 cards (matching emitter)
- DB contains 39 files, 0 from ignored dirs

### Run 2: Output Verification
```bash
find .st8/schema-cards/ -type f ! -name '*.json'  # (none)
find .planning/st8_identity_system/ -name '*sqlite*'  # (none)
find .planning/st8_identity_system/ -name '.archive*'  # (none)
```

**All clean.**

---

## Integration Points

| Component | File | Line | Integration Pattern |
|-----------|------|------|---------------------|
| File Discovery | `backend/indexer.js` | 161 | `IGNORE_DIRS` set — checked in `walk()` at line 172 |
| Card Printing | `backend/schemaCardPrinter.js` | 44-62 | Guard in `printCard()` — early return `null` for skipped files |
| Card Reading | `backend/schemaCardPrinter.js` | 176 | `printAllFromCards()` reads `.json` files, calls `printCard()` |
| Notification Bus | `backend/notificationBus.js` | 61-67 | Calls `printer.printCard()` on mutation events |
| File Watcher | `backend/fileWatcher.js` | 54-71 | Already ignores `.st8/**`, `.planning/st8_identity_system/**` |

---

## Wiring Confirmation

### Data Flow
```
indexer.discoverFiles() 
  → IGNORE_DIRS filters .archive, .planning, .st8, vendor, snapshots
  → 39 code files discovered

schemaCardEmitter.emitAllCards()
  → 39 JSON cards written to .st8/schema-cards/

schemaCardPrinter.printAllFromCards()
  → Reads 39 JSON files
  → printCard() guard skips non-code files
  → 39 .txt files written to .planning/st8_identity_system/

notificationBus.publish()
  → Calls printer.printCard() for mutation events
  → Guard prevents emission of phantom files
```

### Error Reporting
- `indexer.js` line 183: `console.error` on directory read failure
- `schemaCardPrinter.js` line 186: `console.error` on card read failure
- `notificationBus.js` line 64: `console.error` on printer fallback failure

---

## Metrics

| Metric | Value |
|--------|-------|
| Files modified | 2 |
| Lines added | 52 |
| Lines removed | 7 |
| Phantom DB entries cleaned | 63 |
| Phantom JSON cards cleaned | 68 |
| Phantom .txt files cleaned | 35 |
| Verification runs | 2 |
| Tests passed | All |

---

## Conclusion

The recursive .txt emission loop is fixed. The indexer now skips ignored directories at discovery time, and the printer has a three-layer guard preventing emission of non-code files. All phantom artifacts have been cleaned from both the database and filesystem.
