# W3-04 Report: Frontend SSE Integration

**Status:** COMPLETE
**Date:** 2026-05-13

---

## Summary

Added EventSource listener to `st8.html` for real-time mutation notifications from the backend SSE endpoint at `/api/mutations`. Includes toast-style UI notifications with mutation type badges, filepath display, timestamps, and 5-second auto-dismiss. Reconnection with exponential backoff is built in.

---

## Integration Points

### 1. CSS Styles — Mutation Notification Toasts

**File:** `st8.html`  
**Location:** Lines 1381–1458 (inside `<style>` block)

| Element | Line | Purpose |
|---------|------|---------|
| `.mutation-toast-container` | 1381 | Fixed-position container, top-right, z-index 300 |
| `.mutation-toast` | 1391 | Individual toast: flexbox row, dark bg, cyan border, entry animation |
| `.mutation-toast.dismissing` | 1411 | Exit animation (slide right + fade) |
| `.mutation-badge` | 1406 | Base badge style (inline-block, rounded) |
| `.badge-create` | 1407 | Gold background — CREATE mutations |
| `.badge-edit` | 1408 | Cyan background — EDIT mutations |
| `.badge-lock` | 1409 | Pink background — LOCK mutations |
| `.badge-concept` | 1410 | Cyan outline — CONCEPT mutations |
| `.badge-production` | 1411 | Gold background — PRODUCTION mutations |
| `.badge-purge` | 1412 | Pink outline — PURGE mutations |
| `.mutation-filepath` | 1413 | Cyan text, ellipsis overflow |
| `.mutation-time` | 1414 | Dim timestamp, right-aligned |
| `@keyframes toast-in` | 1415 | Slide-in from right |
| `@keyframes toast-out` | 1419 | Slide-out to right |
| `@media prefers-reduced-motion` | 1423 | Disables animations for accessibility |

### 2. HTML Container

**File:** `st8.html`  
**Line:** 1466

```html
<div class="mutation-toast-container" id="mutation-toasts" aria-live="polite" aria-label="Mutation notifications"></div>
```

- Uses `aria-live="polite"` for screen reader announcements
- Placed before `<main>` so toasts render above all content

### 3. EventSource Listener + Toast Logic

**File:** `st8.html`  
**Lines:** 2010–2131 (inside last `<script>` block)

| Component | Line | Description |
|-----------|------|-------------|
| `initMutationStream()` IIFE | 2010 | Self-executing module, no globals leaked except debug handle |
| `reconnectDelay` | 2014 | Starts at 1s, doubles on each failure, caps at 30s |
| `getBadgeClass()` | 2018 | Maps mutationType → CSS badge class |
| `formatTime()` | 2028 | Formats ISO timestamp → `HH:MM:SS` |
| `showMutationToast()` | 2038 | Creates toast DOM, appends to container, schedules auto-dismiss |
| `connect()` | 2072 | Creates `new EventSource('/api/mutations')`, wires handlers |
| `mutationSource.onopen` | 2081 | Logs connection, resets backoff |
| `mutationSource.onmessage` | 2086 | Parses JSON, skips `type: 'connected'` handshake, calls `showMutationToast()` |
| `mutationSource.onerror` | 2105 | Closes source, schedules reconnect with exponential backoff |
| `window.st8MutationStream` | 2123 | Debug handle: `.reconnect()` and `.close()` methods |

---

## Data Flow

```
Backend (notificationBus.js)
  → _broadcastSSE() writes `data: {JSON}\n\n` to all SSE clients
    → GET /api/mutations (server.js line 106)
      → EventSource('/api/mutations') in st8.html
        → onmessage parses JSON
          → showMutationToast() renders badge + filepath + time
            → Auto-dismiss after 5 seconds
```

---

## Event Schema (from backend)

```json
{
  "mutationType": "EDIT",       // CREATE | EDIT | LOCK | CONCEPT | PRODUCTION | PURGE
  "filepath": "/path/to/file",  // File path or fingerprint
  "actor": "DEVELOPER",         // Who triggered the mutation
  "publishedAt": "2026-05-13T...", // ISO timestamp from NotificationBus
  "sha256Hash": "...",           // Content hash
  "changedFields": "{}",        // JSON string of changed fields
  "metadata": "{}"              // JSON string of schema card snapshot
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Server not running | EventSource fires `onerror`, reconnects with backoff |
| Network drop | Browser auto-reconnects EventSource; onerror resets backoff |
| Malformed JSON | `try/catch` in `onmessage`, warning logged, toast skipped |
| Initial `connected` event | Filtered out (no toast shown for handshake) |
| Too many SSE clients | Server returns 503, EventSource retries automatically |

---

## Verification

1. Start the backend: `node backend/index.js --path .`
2. Open `http://localhost:3847/` in browser
3. Edit a file in the watched directory
4. Toast appears in top-right showing: badge (EDIT), filepath, timestamp
5. Toast auto-dismisses after 5 seconds
6. Check console for `[st8] Mutation stream connected` and `[st8] Mutation: EDIT ...`

---

## Files Modified

| File | Changes |
|------|---------|
| `st8.html` | +CSS styles (lines 1381–1458), +HTML container (line 1466), +JS EventSource + toast logic (lines 2010–2131) |

---

## Syntax Verification

All 3 inline `<script>` blocks pass `new Function()` syntax check in Node.js v24.14.0.
