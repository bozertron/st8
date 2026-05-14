# ST8 Filewatcher Architecture Report

**Date:** 2026-05-13  
**Status:** ROOT CAUSE IDENTIFIED  
**Issue:** Filewatchers are not automatically updating memory systems

---

## Executive Summary

**Root Cause:** The backend is running WITHOUT the `--watch` flag, so the filewatcher is **never started**.

**Current Process:**
```
node /home/bozertron/1_AT_A_TIME/st8/backend/index.js /home/bozertron/1_AT_A_TIME/st8 --serve --port 3847
```

**Required Process:**
```
node /home/bozertron/1_AT_A_TIME/st8/backend/index.js /home/bozertron/1_AT_A_TIME/st8 --watch --serve --port 3847
```

---

## 1. All Filewatchers Found

### Backend Filewatcher
- **Location:** `/home/bozertron/1_AT_A_TIME/st8/backend/fileWatcher.js`
- **Class:** `FileWatcher`
- **Technology:** chokidar
- **Purpose:** Watches target directory for file changes and triggers re-indexing
- **Status:** ⚠️ **NOT STARTED** (requires `--watch` flag)

### Frontend SSE Client
- **Location:** `/home/bozertron/1_AT_A_TIME/st8/st8.html` (lines 2007-2135)
- **Function:** `initMutationStream()`
- **Technology:** EventSource (SSE)
- **Purpose:** Receives real-time mutation notifications from backend
- **Status:** ✅ Implemented and connects to `/api/mutations`

### Backend SSE Endpoint
- **Location:** `/home/bozertron/1_AT_A_TIME/st8/backend/server.js` (line 106, 722-727)
- **Route:** `/api/mutations`
- **Method:** `_handleMutationsSSE()`
- **Purpose:** Streams mutation events to frontend clients
- **Status:** ✅ Implemented

---

## 2. Automatic Startup Analysis

### How Filewatcher Starts

In `backend/index.js`:
```javascript
const watchMode = args.includes('--watch');  // Line 63

if (watchMode) {
    console.log('[st8] Starting file watcher...');
    watcher = new FileWatcher(targetDir, {
        debounceMs: 500,
        onFileChange: async (changes) => { ... }
    });
    watcher.start();
}
```

### How `start.js` Launches Backend

In `start.js`:
```javascript
const CONFIG = {
    watchMode: process.argv.includes('--watch'),  // Line 21
    ...
};

const args = [
    CONFIG.targetDir,
    '--port', CONFIG.port
];

if (CONFIG.watchMode) {
    args.push('--watch');  // Only adds if --watch passed to start.js
}

args.push('--serve');  // Always adds --serve
```

### Current Process Command
```bash
node /home/bozertron/1_AT_A_TIME/st8/backend/index.js /home/bozertron/1_AT_A_TIME/st8 --serve --port 3847
```

**Missing:** `--watch` flag

---

## 3. Server Dependency Analysis

### Does the filewatcher require the HTTP server?

**NO.** The filewatcher and server are independent:

```javascript
// File watcher (lines 178-325)
if (watchMode) {
    watcher = new FileWatcher(targetDir, { ... });
    watcher.start();
}

// Server (lines 329-333)
if (serveMode) {
    server = new St8Server({ port, targetDir });
    server.start();
}
```

### Can the filewatcher run standalone?

**YES.** You can run:
```bash
node backend/index.js /path/to/project --watch
```

This will:
- Run initial indexing
- Start filewatcher
- Log mutations to SQLite
- Emit schema cards
- **NOT start HTTP server** (no SSE streaming to frontend)

### What happens if the server isn't running?

If only `--watch` is used (no `--serve`):
- ✅ File changes detected
- ✅ Mutations logged to SQLite
- ✅ Schema cards updated
- ❌ No SSE streaming to frontend
- ❌ No HTTP API available

If only `--serve` is used (no `--watch`):
- ✅ HTTP server running
- ✅ SSE endpoint available
- ❌ No file changes detected
- ❌ No automatic updates

**Both flags are needed for full functionality:**
```bash
node backend/index.js /path/to/project --watch --serve
```

---

## 4. Intended vs Actual Hook Chain

### Intended Hook Chain (from PHASE-SPECS.md)

```
IDE Save / File Watcher Event
         │
         ▼
   chokidar 'change' event  (fileWatcher.js)
         │
         ▼
   FileWatcher._onFileChange()
         │
         ▼
   onFileChange callback (index.js)
         │
         ├──► persistence.logMutation()        → writes to file_mutation_log
         ├──► persistence.upsertFile()         → updates file_registry
         ├──► indexer.parseFile()              → re-extracts AST metadata
         ├──► schemaCardEmitter.emit(file)     → writes .st8/schema-card.json
         └──► notificationBus.publish(event)   → SSE to frontend / notification
```

### Actual Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| chokidar watcher | ✅ Implemented | `fileWatcher.js` class |
| `_onFileChange()` | ✅ Implemented | Debounced, handles add/change/unlink |
| `persistence.logMutation()` | ✅ Implemented | Logs to `file_mutation_log` table |
| `persistence.upsertFile()` | ✅ Implemented | Updates `file_registry` table |
| `schemaCardEmitter.emit()` | ✅ Implemented | Writes to `.st8/schema-cards/` |
| `notificationBus.publish()` | ✅ Implemented | SSE + console + printer fallback |
| SSE endpoint | ✅ Implemented | `/api/mutations` route |
| Frontend SSE client | ✅ Implemented | `st8.html` EventSource |
| **Filewatcher started** | ❌ **NOT STARTED** | Missing `--watch` flag |

---

## 5. Gap Analysis

### What's Missing

1. **Filewatcher not started automatically**
   - Current: Requires explicit `--watch` flag
   - Expected: Should start automatically when server starts
   - Fix: Either make `--watch` default, or add to startup script

2. **No background daemon mode**
   - Current: Process must stay running
   - Expected: Should run as background service
   - Fix: Add daemon mode or use process manager (pm2, systemd)

3. **No automatic restart on crash**
   - Current: If process exits, filewatcher stops
   - Expected: Should auto-restart
   - Fix: Use process manager or add restart logic

### What's Working

1. ✅ Filewatcher implementation is complete
2. ✅ Mutation logging is implemented
3. ✅ Schema card emission is implemented
4. ✅ SSE streaming is implemented
5. ✅ Frontend SSE client is implemented
6. ✅ All components are properly wired

---

## 6. Recommendations

### Immediate Fix

**Option A: Make `--watch` default in `start.js`**
```javascript
const CONFIG = {
    watchMode: !process.argv.includes('--no-watch'),  // Default to true
    ...
};
```

**Option B: Update startup command**
```bash
# Current (broken)
node backend/index.js . --serve --port 3847

# Fixed
node backend/index.js . --watch --serve --port 3847
```

**Option C: Add to `start.js` default args**
```javascript
const args = [
    CONFIG.targetDir,
    '--port', CONFIG.port,
    '--watch',  // Always enable watch mode
    '--serve'
];
```

### Long-term Improvements

1. **Process Manager Integration**
   - Use pm2 or systemd to manage the backend process
   - Auto-restart on crash
   - Log rotation

2. **Health Check Endpoint**
   - Add `/api/health` endpoint
   - Report filewatcher status
   - Report last mutation time

3. **Configuration File**
   - Move flags to `st8.config.js` or `.st8rc`
   - Allow persistent configuration
   - Environment-specific settings

---

## 7. Verification Steps

After applying fix:

1. **Check process is running with `--watch`:**
   ```bash
   ps aux | grep "node.*index.js"
   # Should show: --watch --serve
   ```

2. **Check filewatcher is active:**
   ```bash
   # Edit any .js file and save
   # Should see in console:
   # [st8:watcher] Flushing N changes
   # [st8] Code files changed: 1
   # [st8:notify] ✎ backend/fileWatcher.js — EDIT by WATCHER
   ```

3. **Check SSE is streaming:**
   ```bash
   curl -N http://localhost:3847/api/mutations
   # Should see: data: {"type":"connected","timestamp":"..."}
   # Then mutation events when files change
   ```

4. **Check schema cards update:**
   ```bash
   ls -la .st8/schema-cards/
   # Timestamps should update when files change
   ```

5. **Check SQLite mutations:**
   ```bash
   sqlite3 st8.sqlite "SELECT * FROM file_mutation_log ORDER BY timestamp DESC LIMIT 5;"
   # Should show recent mutations
   ```

---

## 8. Summary

| Question | Answer |
|----------|--------|
| Why aren't filewatchers updating memory? | **Filewatcher not started** (missing `--watch` flag) |
| Is the implementation complete? | Yes, all components are implemented |
| Is the server required? | No, but needed for SSE streaming to frontend |
| Can filewatcher run standalone? | Yes, with `--watch` flag only |
| What's the fix? | Add `--watch` to startup command or make it default |

**Root Cause:** The backend process is running without the `--watch` flag, so the `FileWatcher` class is never instantiated and never starts watching for file changes.

**Fix:** Restart the backend with `--watch --serve` flags, or modify `start.js` to make watch mode the default.
