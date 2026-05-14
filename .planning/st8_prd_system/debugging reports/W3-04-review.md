# W3-04 Code Review: Frontend SSE Integration

**Reviewer:** Claude (gsd-code-reviewer)
**Date:** 2026-05-13
**Depth:** standard
**File:** `st8.html` (lines 2007–2130)
**Status:** issues_found

---

## Summary

The SSE mutation stream implementation is **structurally sound**. The EventSource listener correctly matches the backend contract (unnamed `data:` events, `connected` handshake filtering), exponential backoff reconnection is properly implemented, and UI toast notifications render via DOM APIs (XSS-safe). The IIFE scoping prevents global leaks, and the `window.st8MutationStream` debug handle provides clean lifecycle control.

**Two issues found:** 1 warning (defensive coding gap in `formatTime`), 1 info (inconsistent `console.log` vs `console.info`).

---

## Findings

### WR-01: `formatTime()` returns `NaN:NaN:NaN` for undefined/null input

**File:** `st8.html:2028-2038`
**Severity:** WARNING

**Issue:** `new Date(undefined)` produces an Invalid Date object but does **not** throw an exception. The `try/catch` block only catches thrown errors. As a result, `d.getHours()` returns `NaN`, and `String(NaN).padStart(2, '0')` produces the literal string `"NaN"`. The toast would display "NaN:NaN:NaN" as the timestamp.

While the backend always sets `publishedAt` in `NotificationBus.publish()`, this path is reachable if the SSE event schema changes or a malformed event lacks both `publishedAt` and `timestamp`.

**Current code:**
```javascript
function formatTime(isoString) {
    try {
        var d = new Date(isoString);
        var h = String(d.getHours()).padStart(2, '0');
        var m = String(d.getMinutes()).padStart(2, '0');
        var s = String(d.getSeconds()).padStart(2, '0');
        return h + ':' + m + ':' + s;
    } catch (_) {
        return '';
    }
}
```

**Fix:**
```javascript
function formatTime(isoString) {
    try {
        var d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        var h = String(d.getHours()).padStart(2, '0');
        var m = String(d.getMinutes()).padStart(2, '0');
        var s = String(d.getSeconds()).padStart(2, '0');
        return h + ':' + m + ':' + s;
    } catch (_) {
        return '';
    }
}
```

---

### IN-01: `console.log` used instead of `console.info` (inconsistent with rest of file)

**File:** `st8.html:2096`
**Severity:** INFO

**Issue:** Line 2096 uses `console.log('[st8] Mutation:', ...)`. Every other diagnostic message in the file uses `console.info` (lines 1560, 1589, 1668, 1700, 1760, 1764, 1820, 1836, 1908, 1968, 2082, 2092). The backend's `notificationBus.js` also uses `console.log` at line 58, so this may be intentional for distinguishing frontend mutation logs from connection lifecycle logs.

**Fix (if consistency is desired):**
```javascript
// Line 2096: change console.log to console.info
console.info('[st8] Mutation:', data.mutationType, data.filepath);
```

---

## Verification Checklist

| Check | Result | Notes |
|-------|--------|-------|
| **EventSource URL matches backend** | ✅ | `/api/mutations` — matches `server.js` route (line 643) |
| **Event format matches backend** | ✅ | Backend sends `data: ${JSON.stringify(...)}\n\n` (unnamed events); client uses `onmessage` (correct) |
| **`connected` handshake filtered** | ✅ | `data.type === 'connected'` check at line 2091-2094 |
| **JSON.parse wrapped in try/catch** | ✅ | Lines 2087-2102 |
| **Exponential backoff** | ✅ | 1s → 2s → 4s → ... → 30s cap; resets on `onopen` |
| **Existing source closed before reconnect** | ✅ | `connect()` lines 2075-2077 |
| **Timer cleanup** | ✅ | `clearTimeout(reconnectTimer)` before `setTimeout` |
| **Toast uses DOM APIs (not innerHTML)** | ✅ | `createElement` + `textContent` throughout `showMutationToast` |
| **Auto-dismiss after 5s** | ✅ | `TOAST_DURATION = 5000`, fade-out animation |
| **`aria-live="polite"` on container** | ✅ | Line 1466 — screen reader accessibility |
| **`prefers-reduced-motion` respected** | ✅ | CSS media query at lines 1454-1457 |
| **IIFE scoping** | ✅ | Only `window.st8MutationStream` exposed for debug |
| **No syntax errors** | ✅ | Valid JavaScript (visual inspection) |
| **XSS in toast rendering** | ✅ | Uses `textContent`, never `innerHTML` with user data |

---

## Design Notes (not findings)

**Relative URL vs hardcoded URL:** The spec (`W3-04_frontend_sse.md` line 14) specifies `new EventSource('http://localhost:3847/api/mutations')`. The implementation uses `new EventSource('/api/mutations')` (relative URL). This is an **improvement** — it works regardless of host/port and avoids same-origin issues. Not a defect.

**No toast count limit:** Rapid mutations could accumulate toasts before the 5s auto-dismiss fires. Toasts do self-clean, so this is a UX concern, not a correctness bug. Consider adding a max (e.g., 5) if volume is expected to be high.

**No SSE `id:` field:** The backend doesn't send `id:` fields, so reconnection loses events in the gap. This is a backend concern (already flagged in `notificationBus-review.md` WR-04), not a frontend defect.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
