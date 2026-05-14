# W3-01 Report: Phase 6 API Endpoints

**Task:** Add 4 new API endpoints to backend/server.js
**Status:** COMPLETE
**Date:** 2026-05-13

---

## Summary

Added 4 Phase 6 lifecycle endpoints to `backend/server.js` enabling the full st8 file lifecycle: concept → lock → wiring → development → production.

---

## Routes Added

| # | Route | Method | Handler | Switch Line |
|---|-------|--------|---------|-------------|
| 1 | `/api/concept-file` | POST | `_handleConceptFile` | 109 |
| 2 | `/api/mvp-lock` | POST | `_handleMvpLock` | 112 |
| 3 | `/api/prd` | GET | `_handlePrd` | 115 |
| 4 | `/api/production-promote` | POST | `_handleProductionPromote` | 118 |

---

## Handler Methods Added

| # | Method | Lines | Description |
|---|--------|-------|-------------|
| 1 | `_handleConceptFile` | 650-712 | Register pre-code concept file with optional intent |
| 2 | `_handleMvpLock` | 714-774 | Batch transition CONCEPT/DEVELOPMENT files to LOCKED |
| 3 | `_handlePrd` | 776-854 | Generate markdown PRD from schema cards |
| 4 | `_handleProductionPromote` | 856-902 | Purge development data and promote to PRODUCTION |

---

## Integration Points

### 1. POST /api/concept-file (lines 650-712)

**Pattern:** Body parsing → persistence → notificationBus publish → response

| Integration | Module | Method | Line in server.js |
|-------------|--------|--------|-------------------|
| Register concept file | `persistence.js` | `registerConceptFile()` | 676 |
| Set file intent | `persistence.js` | `upsertIntent()` | 684 |
| Publish CONCEPT mutation | `notificationBus.js` | `publish()` | 693 |

**Dependencies required inline:**
- `const { St8Persistence } = require('./persistence')` — line 670
- `const { notificationBus } = require('./notificationBus')` — line 671

**Request body:** `{ filepath, purpose, dependsOnBehavior, valueStatement }`
**Response:** `{ status: 'ok', fingerprint, lifecyclePhase: 'CONCEPT' }`

---

### 2. POST /api/mvp-lock (lines 714-774)

**Pattern:** Persistence query → batch update → mutation logging → schema card re-emission → response

| Integration | Module | Method | Line in server.js |
|-------------|--------|--------|-------------------|
| Get all files | `persistence.js` | `getAllFiles()` | 730 |
| Update lifecycle phase | `persistence.js` | `persistence.db.prepare().run()` | 735-737 |
| Log LOCK mutation | `persistence.js` | `logMutation()` | 739 |
| Re-emit schema cards | `schemaCardEmitter.js` | `emitAllCards()` | 759 |

**Dependencies required inline:**
- `const { St8Persistence } = require('./persistence')` — line 724
- `const { SchemaCardEmitter } = require('./schemaCardEmitter')` — line 725

**Request body:** None (POST with no body)
**Response:** `{ status: 'ok', lockedFiles: count, files: [...] }`

---

### 3. GET /api/prd (lines 776-854)

**Pattern:** Filesystem read → JSON parse → markdown generation → response

| Integration | Module | Method | Line in server.js |
|-------------|--------|--------|-------------------|
| Read schema cards dir | `fs` | `readdirSync()` | 798 |
| Parse card JSON | `fs` | `readFileSync()` + `JSON.parse()` | 801 |
| Group by lifecycle phase | inline | Object.entries loop | 812-843 |

**Dependencies:** None additional (uses existing `fs` and `path` imports)

**Schema cards directory:** `{targetDir}/.st8/schema-cards/`
**Response:** `text/markdown` PRD document

---

### 4. POST /api/production-promote (lines 856-902)

**Pattern:** Body parsing → persistence purge → notificationBus publish → response

| Integration | Module | Method | Line in server.js |
|-------------|--------|--------|-------------------|
| Purge dev data | `persistence.js` | `purgeDevelopmentData()` | 882 |
| Publish PRODUCTION mutation | `notificationBus.js` | `publish()` | 884 |

**Dependencies required inline:**
- `const { St8Persistence } = require('./persistence')` — line 876
- `const { notificationBus } = require('./notificationBus')` — line 877

**Request body:** `{ fingerprint }`
**Response:** `{ status: 'ok', purgedMutations: count }`

---

## Error Handling

All handlers include:
- Method validation (POST/GET enforced with 405 response)
- Input validation (required fields checked with 400 response)
- try/catch with `console.error` logging
- `res.headersSent` check to prevent double-write
- `finally` block closing persistence connection
- 500 error responses with JSON error message

---

## Verification

```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/server.js
# Exit code 0 — syntax valid
```

---

## Files Modified

- `backend/server.js` — 4 route cases + 4 handler methods added (648→916 lines, +268 lines)

---

## Deviations from Spec

1. **`persistence.setIntent()` → `persistence.upsertIntent()`**: The PHASE-SPECS.md spec references `setIntent()` but the actual persistence module has `upsertIntent()`. Used the existing method name.

2. **Added method validation**: Spec handlers didn't include POST/GET method validation. Added 405 responses for consistency with existing `_handleVerify` pattern.

3. **Added `res.headersSent` check**: Spec handlers had bare `res.writeHead(500)` in catch blocks. Added `headersSent` guard to prevent double-write errors when body parsing fails mid-stream.

4. **Used `async/await` for persistence.initialize()**: Spec showed `persistence.initialize()` without await. Used `await` because `initialize()` returns a Promise (consistent with existing `_handleVerify` pattern).
