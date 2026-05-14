# Code Review: `/api/mvp-lock` Endpoint

**Reviewed:** 2026-05-13  
**Scope:** `_handleMvpLock` method (lines 714-774, `backend/server.js`)  
**Status:** issues_found

## Summary

The `_handleMvpLock` endpoint correctly handles POST method validation, iterates files, updates lifecycle phases, logs mutations, and re-emits schema cards. However, it has several defects ranging from a critical request body leak to architectural violations against the persistence layer.

---

## Critical Issues

### CR-01: POST Request Body Never Consumed — Socket/Connection Leak

**File:** `backend/server.js:714-719`

**Issue:** The method validates `req.method === 'POST'` but never reads the request body (no `req.on('data', ...)` / `req.on('end', ...)`). Per Node.js HTTP semantics, if a POST request has a body and you don't consume it, the socket remains open. The client will hang waiting for a response on large payloads, and under load this causes connection leaks. Every other POST handler in this file (`_handleConceptFile` at line 657, `_handleProductionPromote` at line 864) properly consumes the body with `req.on('data'/'end')`.

**Impact:** Connection/socket leak under concurrent POST requests with bodies. Browsers/clients may retry, compounding the problem.

**Fix:** Consume and discard the request body (or parse it if future parameters are anticipated):

```javascript
_handleMvpLock(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
        return;
    }

    // Consume request body to prevent socket leak
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        // ... existing async logic moves here ...
    });
}
```

---

## Warnings

### WR-01: Direct `persistence.db.prepare()` — Bypasses Persistence Layer Encapsulation

**File:** `backend/server.js:735-737`

**Issue:** The method reaches into `persistence.db.prepare()` directly to run the `UPDATE file_registry SET lifecyclePhase = 'LOCKED'` query. The `St8Persistence` class encapsulates all DB access; every other mutation goes through a method (e.g., `registerConceptFile`, `purgeDevelopmentData`, `logMutation`). This breaks the abstraction and means:
1. If the schema changes (e.g., column rename, table refactor), this inline SQL silently breaks.
2. The persistence class cannot track or audit this mutation.
3. Inconsistent with `purgeDevelopmentData()` (line 407-408 in persistence.js) which also updates `lifecyclePhase` but does so through the class.

**Fix:** Add an `updateLifecyclePhase(fingerprint, newPhase)` method to `St8Persistence`:

```javascript
// In persistence.js
updateLifecyclePhase(fingerprint, newPhase) {
    const stmt = this.db.prepare(
        `UPDATE file_registry SET lifecyclePhase = ? WHERE fingerprint = ?`
    );
    return stmt.run(newPhase, fingerprint);
}
```

Then in `server.js`:
```javascript
persistence.updateLifecyclePhase(file.fingerprint, 'LOCKED');
```

### WR-02: No `targetDir` Guard Before SchemaCardEmitter

**File:** `backend/server.js:757-760`

**Issue:** The code checks `if (this.targetDir)` before creating `SchemaCardEmitter`, which is correct. However, if `this.targetDir` is falsy, the lock operation silently succeeds without re-emitting cards — the caller gets a 200 OK with locked files but schema cards are stale. There's no warning logged and no indication in the response that card emission was skipped.

**Fix:** Log a warning when cards are skipped, and/or include it in the response:

```javascript
if (this.targetDir) {
    const emitter = new SchemaCardEmitter(this.targetDir);
    emitter.emitAllCards(persistence);
} else {
    console.warn('[st8:server] MVP lock: skipping schema card emit — no targetDir configured');
}
```

### WR-03: No `notificationBus.publish()` Call — Inconsistent With Other Handlers

**File:** `backend/server.js:714-774`

**Issue:** Every other mutation endpoint publishes to `notificationBus` after performing its operation:
- `_handleConceptFile` (line 693): `notificationBus.publish({ mutationType: 'CONCEPT' })`
- `_handleProductionPromote` (line 884): `notificationBus.publish({ mutationType: 'PRODUCTION' })`

The `_handleMvpLock` handler does NOT publish a notification. This means SSE clients subscribed to `/api/mutations` will not receive real-time notification when files are locked.

**Fix:** Add notification after the lock loop:

```javascript
const { notificationBus } = require('./notificationBus');
// After the for loop, before schema card emit:
for (const result of results) {
    notificationBus.publish({
        fingerprint: result.fingerprint,
        filepath: result.filepath,
        mutationType: 'LOCK',
        actor: 'DEVELOPER'
    });
}
```

### WR-04: No Check for Empty File Set — Silent No-Op

**File:** `backend/server.js:730-754`

**Issue:** If `getAllFiles()` returns an empty array (no files registered), or no files are in `CONCEPT`/`DEVELOPMENT` phase, the endpoint returns `{ status: 'ok', lockedFiles: 0, files: [] }`. This is technically correct but may mask configuration errors (e.g., calling mvp-lock before indexing). A caller has no way to distinguish "nothing to lock" from "everything already locked."

**Fix:** Optionally include a more descriptive response:

```javascript
const alreadyLocked = files.filter(f => f.lifecyclePhase === 'LOCKED').length;
// In response:
{ status: 'ok', lockedFiles: results.length, alreadyLocked, files: results }
```

---

## Info

### IN-01: `require()` Called Inside Async Handler on Every Request

**File:** `backend/server.js:724-725`

**Issue:** `require('./persistence')` and `require('./schemaCardEmitter')` are called on every request. Node.js caches `require()` so this is functionally safe, but it's inconsistent — some handlers hoist requires to the top of the method or module, while this one re-requires inline. Minor style inconsistency only.

**Fix:** No functional impact. Could hoist to module level for consistency, but Node's require cache makes this a non-issue.

### IN-02: No Input Body Validation (Future-Proofing)

**File:** `backend/server.js:714-774`

**Issue:** The endpoint accepts POST but ignores the body entirely. If future changes add optional parameters (e.g., `{ dryRun: true }`, `{ phases: ['CONCEPT'] }`), the body consumption fix in CR-01 should also parse and validate. Currently this is a no-body endpoint, which is fine.

---

## Checklist Results

| Check | Status | Notes |
|-------|--------|-------|
| Route added in switch statement | ✅ | Line 112: `case '/api/mvp-lock'` correctly wired |
| Method validation (POST only) | ✅ | Line 715: Returns 405 for non-POST |
| Gets all files and updates lifecyclePhase | ⚠️ | Works but uses raw `db.prepare()` (WR-01) |
| Logs LOCK mutation | ✅ | Line 739-746: `logMutation()` called correctly |
| Re-emits schema cards | ✅ | Line 757-760: `emitAllCards()` called |
| Error handling | ✅ | try/catch/finally with `persistence.close()` |
| Consumes request body for POST | ❌ | **CR-01**: Body never read — socket leak |
| Uses persistence.db.prepare() directly | ⚠️ | **WR-01**: Should use persistence method |

---

_Reviewed: 2026-05-13_  
_Reviewer: Claude (gsd-code-reviewer)_
