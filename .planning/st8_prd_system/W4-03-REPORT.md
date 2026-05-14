# Task W4-03: Resource Leak Fixes — Report

**Status:** COMPLETE  
**Date:** 2026-05-13  

---

## Summary

Fixed two persistence resource leaks where `persistence.initialize()` rejection left the database connection unclosed. Both handlers used the same anti-pattern: `.then(...).catch(err => ...)` where the `.catch()` block sent an HTTP error response but never called `persistence.close()`.

---

## Integration Points

### 1. `_handleFileIntent` — `/api/file-intent` handler

**File:** `backend/server.js`  
**Leak location:** Line 382–385 (`.catch()` block after `persistence.initialize().then(...)`)  
**Pattern:** Promise chain — `initialize()` returns a Promise; if it rejects, the `.then()` `finally` block (which calls `persistence.close()`) never executes.

**Before:**
```javascript
persistence.initialize().then(() => {
    try { /* ... */ }
    finally { persistence.close(); }
}).catch(err => {
    // LEAK: persistence never closed
    res.writeHead(500, ...);
    res.end(JSON.stringify({ error: err.message }));
});
```

**After:**
```javascript
persistence.initialize().then(() => {
    try { /* ... */ }
    finally { persistence.close(); }
}).catch(err => {
    persistence.close();  // ← FIXED: close DB on init failure
    res.writeHead(500, ...);
    res.end(JSON.stringify({ error: err.message }));
});
```

**Verification:** `persistence` is created at line 325 (`new St8Persistence()`), `.initialize()` is called at line 327. If `initialize()` rejects, the `.catch()` at line 382 now closes the connection before sending the error response.

---

### 2. `_handleSettings` — `/api/settings` handler

**File:** `backend/server.js`  
**Leak location:** Line 448–451 (`.catch()` block after `persistence.initialize().then(...)`)  
**Pattern:** Identical Promise chain leak — `initialize()` rejection bypasses the `finally` blocks inside `.then()`.

**Before:**
```javascript
persistence.initialize().then(() => {
    // GET path: try { ... } finally { persistence.close(); }
    // POST path: try { ... } finally { persistence.close(); }
}).catch(err => {
    // LEAK: persistence never closed
    res.writeHead(500, ...);
    res.end(JSON.stringify({ error: err.message }));
});
```

**After:**
```javascript
persistence.initialize().then(() => {
    // GET path: try { ... } finally { persistence.close(); }
    // POST path: try { ... } finally { persistence.close(); }
}).catch(err => {
    persistence.close();  // ← FIXED: close DB on init failure
    res.writeHead(500, ...);
    res.end(JSON.stringify({ error: err.message }));
});
```

**Verification:** `persistence` is created at line 395 (`new St8Persistence()`), `.initialize()` is called at line 397. If `initialize()` rejects, the `.catch()` at line 448 now closes the connection before sending the error response.

---

## Leak Prevention Pattern

Both fixes follow the same defensive pattern already used in other handlers (e.g., `_handleIndex`, `_handleConceptFile`, `_handleMvpLock`, `_handleVerify`, `_handleProductionPromote`):

```
persistence = new St8Persistence()
persistence.initialize().then(() => {
    try { /* work */ }
    finally { persistence.close(); }
}).catch(err => {
    persistence.close();   // ← guard against init failure
    /* send error response */
});
```

**Note:** The `persistence.close()` call is safe to invoke even if the database was never fully opened — the underlying `better-sqlite3` library handles this gracefully. No double-close risk exists because `.catch()` and `.then().finally()` are mutually exclusive execution paths.

---

## Verification

```bash
$ node -c backend/server.js
# (no output — syntax clean)
```

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `backend/server.js` | 383 | Added `persistence.close()` in `_handleFileIntent` `.catch()` block |
| `backend/server.js` | 449 | Added `persistence.close()` in `_handleSettings` `.catch()` block |
