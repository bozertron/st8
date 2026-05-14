# W4-03 Review: Resource Leak Fixes in server.js

**Reviewed:** 2026-05-13T00:00:00Z
**File:** `backend/server.js`
**Scope:** Verify `_handleFileIntent` and `_handleSettings` resource leak fixes + syntax check

---

## Summary

Reviewed `backend/server.js` (1020 lines) for the three specified criteria. Both resource leak fixes are present and correct. No syntax errors found. One minor robustness concern noted.

---

## 1. `_handleFileIntent` Resource Leak — ✅ FIXED

**Lines 295–392**

The `persistence` instance is created inside the `req.on('end')` callback and is properly closed:

- **`finally` block (line 379–381):** Calls `persistence.close()` after successful operations.
- **`.catch()` handler (line 382–386):** Calls `persistence.close()` if `persistence.initialize()` rejects.
- **Outer `catch` (line 387–389):** Handles errors before `persistence` is created (e.g., `JSON.parse` failure), so no leak in that path.

**Verdict:** Resource leak is fixed. Every code path that creates a `St8Persistence` instance now ensures `.close()` is called.

---

## 2. `_handleSettings` Resource Leak — ✅ FIXED

**Lines 394–469**

The `persistence` instance is created at the top of the method and closed in all paths:

- **GET path (line 412–414):** `finally { persistence.close(); }` wraps the synchronous operations.
- **POST path (line 450–452):** `finally { persistence.close(); }` wraps the async body handling.
- **`req.on('close')` handler (line 455–457):** Additional safeguard for client disconnects during POST.
- **Method-not-allowed path (line 460):** Calls `persistence.close()` before returning 405.
- **`.catch()` handler (line 464–468):** Calls `persistence.close()` if `persistence.initialize()` rejects.

**Verdict:** Resource leak is fixed. All code paths close the persistence connection.

---

## 3. Syntax Errors — ✅ NONE

The file is syntactically correct JavaScript. All braces, parentheses, and brackets are balanced. Promise chains (`.then()/.catch()`) are properly structured. Try/catch/finally blocks are well-formed.

---

## Findings

### IN-01: `_handleFileIntent` Missing `req.on('close')` Handler

**File:** `backend/server.js:320–392`
**Severity:** Info (robustness, not a bug)

Unlike `_handleSettings` POST path (which has a `req.on('close')` handler at line 455), `_handleFileIntent` does not handle client disconnects. If a client sends a POST to `/api/file-intent` and then disconnects before the async persistence operations complete, the `persistence` connection will remain open until the promise settles (which it will, so no permanent leak). However, adding a `req.on('close')` guard would match the pattern used in `_handleSettings` and provide faster cleanup.

**Suggested fix (optional):**
```javascript
// After line 386, add:
req.on('close', () => {
    if (persistence) persistence.close();
});
```

**Note:** This is informational only — the existing `finally`/`.catch()` handlers guarantee eventual cleanup, so this is not a resource leak.

---

## Conclusion

| Check | Result |
|-------|--------|
| `_handleFileIntent` leak fixed | ✅ Yes |
| `_handleSettings` leak fixed | ✅ Yes |
| Syntax errors | ✅ None |

The W4-03 fixes are correct and complete. No blockers or warnings.

---

_Reviewed: 2026-05-13_
_Reviewer: GSD Code Reviewer_
_Depth: standard_
