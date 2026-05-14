# Emission-to-Conclusion Trace Report

**Date:** 2026-05-13
**System:** ST8 — Full Stack Logic Analyzer
**Scope:** Complete lifecycle trace of file changes from detection to final state

---

## Executive Summary

Traced 5 paths from file change detection through schema card emission, intent seeding, gap analysis, PRD generation, and SSE notification. Found **7 broken links** across the pipeline. All broken links have been fixed.

---

## Path 1: File Change Detection → Schema Card

### Trace

1. **`backend/fileWatcher.js:82-84`** — Chokidar watches for `add`, `change`, `unlink` events
2. **`backend/fileWatcher.js:93-105`** — `_onFileChange()` debounces (500ms), then calls `_flush()`
3. **`backend/fileWatcher.js:107-119`** — `_flush()` calls `onFileChange(changes)` callback
4. **`backend/index.js:193-399`** — Callback processes each change by type

### Sub-paths:

**`change` handler (index.js:320-371):**
- ✅ Computes new hash
- ✅ Updates `persistence.upsertFile()`
- ✅ Logs mutation via `persistence.logMutation()`
- ✅ Publishes SSE via `notificationBus.publish()`
- ✅ Extracts AST
- ✅ Emits schema card via `emitter.emitCard()`
- **VERDICT: COMPLETE CHAIN**

**`add` handler (index.js:253-319):**
- ✅ Reads file, computes hash, generates fingerprint
- ✅ Pushes to `result.files`, calls `persistence.upsertFile()`
- ✅ Logs mutation via `persistence.logMutation()`
- ✅ Publishes SSE via `notificationBus.publish()`
- ❌ **BROKEN:** No schema card emission — `emitter.emitCard()` never called for new files
- **VERDICT: BROKEN LINK #2**

**`unlink` handler (index.js:209-252):**
- ✅ Removes from `result.files`
- ❌ **BROKEN:** No mutation logged via `persistence.logMutation()`
- ❌ **BROKEN:** No SSE notification via `notificationBus.publish()`
- ❌ **BROKEN:** No schema card deleted from `.st8/schema-cards/`
- ✅ Calls `persistence.deleteFile()`
- **VERDICT: 3 BROKEN LINKS (#1, #1a, #1b)**

---

## Path 2: Schema Card → Intent Seeding

### Trace

1. **`backend/intentSeeder.js`** — `IntentSeeder` class exists with `seedAll()` and `seedFile()` methods
2. **`backend/index.js`** — `IntentSeeder` was NOT imported (missing `require()`)
3. **`backend/index.js`** — IntentSeeder was NEVER called during:
   - Initial indexing flow
   - File watcher incremental flow

### Verdict

❌ **BROKEN LINK #4:** Intent seeder module exists but is never invoked in the main pipeline. Files added by the watcher never get auto-generated intent.

### Fix Applied

- Added `const { IntentSeeder } = require('./intentSeeder');` import (index.js:24)
- Added intent seeding call after initial indexing (index.js:175-183)
- Added intent seeding re-run after watcher changes (index.js:381-388)

---

## Path 3: Intent → Gap Analysis

### Trace

1. **`backend/gapAnalyzer.js:201-248`** — D3 dimension reads `intent.purpose` from schema cards
2. **`backend/gapAnalyzer.js:42-69`** — `_loadCards()` reads from `.st8/schema-cards/` directory
3. **`backend/index.js:164-172`** — Gap analysis runs once during initial indexing

### Sub-issues

- ✅ Gap analysis correctly reads intent from schema cards
- ✅ D3 dimension properly identifies files with/without intent
- ❌ **BROKEN LINK #3:** Gap analysis never re-runs after watcher changes
- ❌ **BROKEN LINK #5:** Gap analysis becomes stale as schema cards update

### Fix Applied

- Added gap analysis re-run after watcher changes (index.js:390-397)

---

## Path 4: Gap Analysis → PRD

### Trace

1. **`backend/prdGenerator.js:23-50`** — `loadSchemaCards()` reads from `.st8/schema-cards/`
2. **`backend/prdGenerator.js:117-143`** — `generatePRD()` groups cards by lifecycle phase
3. **`backend/server.js:912-941`** — `/api/prd` endpoint generates PRD on-demand (GET)

### Verdict

⚠️ **DESIGN OBSERVATION:** PRD is purely on-demand via `/api/prd` endpoint. No automatic regeneration after file changes. This may be intentional — PRD is a snapshot artifact, not a live view. No fix applied.

---

## Path 5: Mutation → Notification

### Trace

1. **`backend/notificationBus.js:33-67`** — `publish()` method: EventEmitter → SSE → Console → Printer
2. **`backend/notificationBus.js:110-118`** — `_broadcastSSE()` sends to all SSE clients
3. **`backend/server.js:722-729`** — `/api/mutations` endpoint registers SSE clients
4. **`st8.html:2010-2135`** — Frontend `EventSource('/api/mutations')` receives events
5. **`st8.html:2040-2072`** — `showMutationToast()` displays notification

### Sub-issues

- ✅ `change` handler publishes SSE notifications
- ✅ `add` handler publishes SSE notifications
- ❌ **BROKEN LINK #7:** `unlink` handler does NOT publish SSE notifications
- ✅ Frontend handles reconnection with exponential backoff
- ✅ Frontend displays toast notifications

### Fix Applied

- Added `notificationBus.publish()` call in `unlink` handler (index.js:227-234)

---

## Broken Links Summary

| # | Path | Location | Issue | Fix |
|---|------|----------|-------|-----|
| 1 | unlink → mutation log | index.js:209-252 | No `persistence.logMutation()` for DELETE | Added mutation logging before DB delete |
| 1a | unlink → SSE | index.js:209-252 | No `notificationBus.publish()` for DELETE | Added SSE publish |
| 1b | unlink → schema card | index.js:209-252 | Stale schema card persists on disk | Added schema card file deletion |
| 2 | add → schema card | index.js:253-319 | No `emitter.emitCard()` for new files | Added AST extraction + schema card emission |
| 3 | watcher → gap analysis | index.js:375-398 | Gap analysis never re-runs after changes | Added gap analysis re-run |
| 4 | main flow → intent seeder | index.js imports | IntentSeeder never imported or invoked | Added import + calls at startup and in watcher |
| 5 | watcher → intent seeding | index.js:375-398 | Intent never re-seeded after changes | Added intent seeding re-run |

---

## Files Changed

### `backend/index.js` (4 fixes)
1. **Line 24:** Added `const { IntentSeeder } = require('./intentSeeder');` import
2. **Lines 175-183:** Added intent seeding after initial indexing
3. **Lines 209-252:** Rewrote `unlink` handler with mutation logging, SSE publish, schema card cleanup
4. **Lines 298-314:** Added schema card emission for `add` handler
5. **Lines 381-397:** Added intent seeding + gap analysis re-run after watcher changes

### `backend/st8-types.js` (1 fix)
1. **Line 42:** Added `DELETE: 'DELETE'` to `MutationType` enum

### `backend/notificationBus.js` (1 fix)
1. **Line 55:** Added `'−'` status icon for DELETE mutations in console output

### `st8.html` (1 fix)
1. **Line 2020:** Added `badge-purge` CSS class mapping for DELETE mutations in frontend

---

## Verification

### Syntax Checks
- ✅ `backend/index.js` — SYNTAX OK
- ✅ `backend/st8-types.js` — SYNTAX OK
- ✅ `backend/notificationBus.js` — SYNTAX OK

### Module Load Checks
- ✅ `backend/st8-types` — LOAD OK
- ✅ `backend/notificationBus` — LOAD OK
- ✅ `backend/intentSeeder` — LOAD OK

---

## Complete Pipeline After Fix

```
File Change Detected (chokidar)
    │
    ├── add ──────► upsertFile + logMutation + publish(SSE) + emitCard (schema card)
    │                  │
    │                  ├──► IntentSeeder.seedFile() (auto-generates intent)
    │                  └──► GapAnalyzer.writeReport() (updates gap analysis)
    │
    ├── change ──► upsertFile + logMutation + publish(SSE) + emitCard (schema card)
    │                  │
    │                  ├──► IntentSeeder.seedFile() (auto-generates intent)
    │                  └──► GapAnalyzer.writeReport() (updates gap analysis)
    │
    └── unlink ──► logMutation(DELETE) + publish(SSE) + deleteCard + deleteFile
                       │
                       ├──► IntentSeeder.seedFile() (re-seeds remaining files)
                       └──► GapAnalyzer.writeReport() (updates gap analysis)
```

### SSE Notification Chain (All Paths)
```
notificationBus.publish()
    ├── EventEmitter.emit('mutation') ──► in-process subscribers
    ├── _broadcastSSE() ────────────────► /api/mutations ──► EventSource ──► Toast UI
    └── console.log() ──────────────────► terminal output
```

---

## Remaining Design Observations (Not Bugs)

1. **PRD is on-demand only** — `/api/prd` generates PRD when requested. No auto-regeneration after changes. This appears intentional.
2. **Schema card printer** (`schemaCardPrinter.js`) writes `.txt` fallback files. Not called during watcher flow — only at startup. May be intentional for performance.
3. **Connection wiring** — The `add` handler creates connections with empty `{ importedBy: [], imports: [] }`. This is correct — AST parsing happens but cross-file connection resolution requires a full re-index.
