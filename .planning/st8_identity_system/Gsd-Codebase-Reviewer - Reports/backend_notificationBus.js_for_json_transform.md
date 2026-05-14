# Detailed Line-by-Line Report: `backend/notificationBus.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/notificationBus.js`
**Total Lines:** 126
**Reviewed:** 2026-05-13T20:45:00Z

---

## Lines 1-11: Shebang + JSDoc Module Header

**What this section does:** Declares the file as a Node.js executable (`#!/usr/bin/env node`) and provides a high-level JSDoc comment describing the module's four notification channels: EventEmitter, SSE, Console, and Printer fallback.

- **What triggers it:** Module load (`require('./notificationBus')`)
- **What it calls:** Nothing
- **What calls it:** N/A (declarative)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Standard Node.js convention.

---

## Line 13: `'use strict';`

**What this section does:** Enables strict mode for the entire file, disabling implicit globals and other loose behaviors.

- **What triggers it:** Module load
- **What it calls:** Nothing
- **What calls it:** N/A (declarative)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None.

---

## Line 15: `const { EventEmitter } = require('events');`

**What this section does:** Imports Node.js's built-in `EventEmitter` class from the `events` module. This is the ONLY import in the entire file.

- **What triggers it:** Module load
- **What it calls:** Node.js `events` module (stdlib)
- **What calls it:** N/A (top-level import)
- **Dependencies:** `events` (Node.js stdlib — no npm packages)
- **Status:** WORKING
- **Gap:** None. Clean dependency — zero external packages.

---

## Lines 17-23: `class NotificationBus extends EventEmitter` — Constructor

**What this section does:** Defines the `NotificationBus` class extending `EventEmitter`. Initializes three instance properties:

- `this.sseClients = new Set()` (line 20) — tracks active SSE response objects
- `this.printer = null` (line 21) — placeholder for `SchemaCardPrinter`, set later via `setPrinter()`
- `this.maxSseClients = options.maxSseClients || 10` (line 22) — caps concurrent SSE connections at 10

```javascript
constructor(options = {}) {
    super();
    this.sseClients = new Set();
    this.printer = null;
    this.maxSseClients = options.maxSseClients || 10;
}
```

- **What triggers it:** `new NotificationBus()` or `new NotificationBus({ maxSseClients: 20 })`
- **What it calls:** `super()` → `EventEmitter` constructor (line 19)
- **What calls it:**
  - `backend/notificationBus.js:124` — singleton creation: `const notificationBus = new NotificationBus();`
  - (Potentially) any test that instantiates the class directly
- **Dependencies:** `EventEmitter` (inherited)
- **Status:** WORKING
- **Gap:**
  - **No validation on `maxSseClients`**: If someone passes `options.maxSseClients = -1` or `0`, the size check at line 74 (`this.sseClients.size >= this.maxSseClients`) would always be true, permanently rejecting all SSE clients. No guard against negative/zero values.
  - **`this.printer` starts null**: This is by design (set later), but `publish()` at line 62 guards it with `if (this.printer && event.schemaCard)` — this is correct defensive code.

---

## Lines 25-27: `setPrinter(printer)`

**What this section does:** Setter method to inject the `SchemaCardPrinter` instance after construction. Stores it as `this.printer`.

```javascript
setPrinter(printer) {
    this.printer = printer;
}
```

- **What triggers it:** Called during startup wiring
- **What it calls:** Nothing (pure assignment)
- **What calls it:**
  - `backend/index.js:89` — `notificationBus.setPrinter(printer);` — called once during `main()` after `SchemaCardPrinter` is instantiated
- **Dependencies:** `backend/schemaCardPrinter.js` (caller provides the printer)
- **Status:** WORKING
- **Gap:**
  - **No type validation**: No check that `printer` has a `printCard()` method. If a non-printer object is passed, `publish()` will throw at line 64 when calling `this.printer.printCard(event.schemaCard)`. The try/catch at line 63 catches this, so it won't crash, but the error message will be cryptic.

---

## Lines 29-69: `publish(event)` — Core Event Publishing Method

**What this section does:** The central method of the entire notification bus. Takes an `event` object, enriches it with a timestamp, and dispatches through four channels in order:

1. **EventEmitter** (lines 42-47) — in-process subscribers
2. **SSE broadcast** (line 50) — frontend consumers
3. **Console output** (lines 53-59) — immediate terminal feedback
4. **Printer fallback** (lines 62-68) — `.txt` file output

### Line 34-37: Event Enrichment

```javascript
const enriched = {
    ...event,
    publishedAt: new Date().toISOString()
};
```

- **What triggers it:** Any caller invoking `notificationBus.publish({...})`
- **What it calls:** `new Date().toISOString()` — creates ISO 8601 timestamp
- **What calls it:** Every publish caller (see full list below)
- **Status:** WORKING
- **Gap:**
  - **No schema validation on `event`**: The `event` object is expected to have `mutationType`, `filepath`/`fingerprint`, and `actor` — but none are validated. If `event` is `null`, `undefined`, or missing fields, the spread operator won't crash but downstream consumers (console.log, SSE clients) will get `undefined` values silently.

### Lines 39-47: Channel 1 — EventEmitter Dispatch

```javascript
try {
    this.emit('mutation', enriched);
    this.emit(`mutation:${event.mutationType}`, enriched);
} catch (err) {
    console.error('[st8:notify] Subscriber listener threw:', err.message);
}
```

- **What triggers it:** `publish()` call
- **What it calls:**
  - `this.emit('mutation', enriched)` — generic mutation event
  - `this.emit(`mutation:${event.mutationType}`, enriched)` — type-specific event (e.g., `mutation:EDIT`, `mutation:CREATE`, `mutation:DELETE`, `mutation:CONCEPT`, `mutation:LOCK`, `mutation:PRODUCTION`, `mutation:BRUNO_CALL`, `mutation:ARCHIVE`, `mutation:UNARCHIVE`)
- **What calls it:** All `publish()` callers
- **Status:** WORKING
- **Gap:**
  - **No in-process subscribers found**: Grep for `on('mutation` across all `.js` files returned **zero results**. The EventEmitter channel is fully wired but has **no listeners attached anywhere**. This means the generic `mutation` and typed `mutation:${type}` events are emitted into the void. This is not a bug — the SSE and console channels work — but it's dead infrastructure. If someone adds a subscriber later, it will work correctly.
  - **try/catch pattern is correct**: A throwing listener won't block SSE/console/printer. Good defensive coding.

### Line 50: Channel 2 — SSE Broadcast

```javascript
this._broadcastSSE(enriched);
```

- **What triggers it:** `publish()` call
- **What it calls:** `_broadcastSSE(enriched)` (line 111)
- **What calls it:** `publish()`
- **Status:** WORKING (see `_broadcastSSE` analysis below)

### Lines 52-59: Channel 3 — Console Output with Status Symbols

```javascript
const status = event.mutationType === 'EDIT' ? '✎' :
               event.mutationType === 'CREATE' ? '+' :
               event.mutationType === 'DELETE' ? '−' :
               event.mutationType === 'CONCEPT' ? '◈' :
               event.mutationType === 'LOCK' ? '⊘' :
               event.mutationType === 'PRODUCTION' ? '★' : '·';
console.log(`[st8:notify] ${status} ${event.filepath || event.fingerprint} — ${event.mutationType} by ${event.actor}`);
```

- **What triggers it:** `publish()` call
- **What it calls:** `console.log()` — terminal output
- **What calls it:** `publish()`
- **Status:** WORKING
- **Gap:**
  - **Status symbol mapping is incomplete**: The symbol map covers 6 mutation types (`EDIT`, `CREATE`, `DELETE`, `CONCEPT`, `LOCK`, `PRODUCTION`), but `brunoOscar.js` publishes 3 additional types:
    - `'BRUNO_CALL'` (brunoOscar.js:38) → falls through to `'·'`
    - `'ARCHIVE'` (brunoOscar.js:83) → falls through to `'·'`
    - `'UNARCHIVE'` (brunoOscar.js:141) → falls through to `'·'`
  - These will all display as `'·'` (dot), which is a valid default but loses the visual distinction. Consider adding: `'BRUNO_CALL' → '⚑'`, `'ARCHIVE' → '📦'`, `'UNARCHIVE' → '↩'`.

### Lines 61-68: Channel 4 — Printer Fallback

```javascript
if (this.printer && event.schemaCard) {
    try {
        this.printer.printCard(event.schemaCard);
    } catch (err) {
        console.error('[st8:notify] Printer fallback failed:', err.message);
    }
}
```

- **What triggers it:** `publish()` call, but only if `this.printer` is set AND `event.schemaCard` is truthy
- **What it calls:** `this.printer.printCard(event.schemaCard)` → `backend/schemaCardPrinter.js:44`
- **What calls it:** `publish()`
- **Dependencies:** `backend/schemaCardPrinter.js` (injected via `setPrinter()`)
- **Status:** PARTIAL
- **Gap:**
  - **`event.schemaCard` is never provided by any caller**: Grep for all `publish()` call sites reveals that NONE of them include a `schemaCard` property in the event object:
    - `server.js:820` — `{ fingerprint, filepath, mutationType: 'CONCEPT', actor }` — NO schemaCard
    - `server.js:895` — `{ fingerprint, filepath, mutationType: 'LOCK', actor }` — NO schemaCard
    - `server.js:1010` — `{ fingerprint, mutationType: 'PRODUCTION', actor }` — NO schemaCard
    - `index.js:228` — `{ fingerprint, filepath, mutationType: 'DELETE', actor, sha256Hash }` — NO schemaCard
    - `index.js:290` — `{ fingerprint, filepath, mutationType: CREATE, actor, sha256Hash }` — NO schemaCard
    - `index.js:343` — `{ fingerprint, filepath, mutationType: EDIT, actor, sha256Hash }` — NO schemaCard
    - `brunoOscar.js:35` — `{ fingerprint, filepath, mutationType: 'BRUNO_CALL', actor, sessionsSinceAccess }` — NO schemaCard
    - `brunoOscar.js:80` — `{ fingerprint, filepath, mutationType: 'ARCHIVE', actor, expiryDate }` — NO schemaCard
    - `brunoOscar.js:138` — `{ fingerprint, filepath, mutationType: 'UNARCHIVE', actor, triggeredBy }` — NO schemaCard
  - **This means the printer fallback channel (lines 62-68) is effectively DEAD CODE.** The `this.printer` is set correctly via `setPrinter()`, but `event.schemaCard` is never truthy, so `printCard()` is never called through the notification bus. The `SchemaCardPrinter` is called elsewhere (in `index.js` directly via `emitter.emitCard()`), but the notification bus fallback path is never triggered.

---

## Lines 71-109: `addSSEClient(res, options)` — SSE Client Registration

**What this section does:** Registers an HTTP response object (`res`) as an SSE client. Sets up SSE headers, sends an initial handshake event, and manages client lifecycle (cleanup on close/error).

### Lines 73-78: Capacity Check

```javascript
addSSEClient(res, options = {}) {
    if (this.sseClients.size >= this.maxSseClients) {
        res.writeHead(503);
        res.end('Too many SSE clients');
        return false;
    }
```

- **What triggers it:** HTTP GET to `/api/mutations`
- **What it calls:** `res.writeHead(503)`, `res.end()`
- **What calls it:**
  - `backend/server.js:744` — `notificationBus.addSSEClient(res, { allowedOrigin: 'http://localhost:' + this.port })`
- **Dependencies:** `backend/server.js` (caller provides `res`)
- **Status:** WORKING
- **Gap:**
  - **503 response has no Content-Type header**: The error response `res.writeHead(503); res.end('Too many SSE clients')` doesn't set `Content-Type`. The client will receive the error as plain text with default headers. Minor inconsistency — all other error paths in `server.js` set `Content-Type: application/json`.

### Lines 80-89: SSE Headers

```javascript
const allowedOrigin = options.allowedOrigin || 'http://localhost:3847';

res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': allowedOrigin
});
```

- **What triggers it:** `addSSEClient()` call
- **What it calls:** `res.writeHead(200, {...})`
- **Status:** WORKING
- **Gap:**
  - **Hardcoded fallback origin**: The default `'http://localhost:3847'` assumes port 3847. In practice, `server.js:745` always passes `allowedOrigin: 'http://localhost:' + this.port`, so the fallback is never hit. But if someone calls `addSSEClient()` directly without options, it would use the hardcoded port.

### Line 92: Initial Handshake Event

```javascript
res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
```

- **What triggers it:** `addSSEClient()` call
- **What it calls:** `res.write()` with SSE-formatted data
- **Status:** WORKING
- **Gap:**
  - **No `event:` field**: The SSE spec supports named events via `event: eventName\ndata: ...\n\n`. This sends only `data:` without an `event:` field, meaning the frontend's `onmessage` handler receives it. The frontend at `st8.html:2120` handles this correctly by checking `data.type === 'connected'` and returning early.

### Lines 94-108: Client Lifecycle Management

```javascript
this.sseClients.add(res);

res.on('close', () => {
    this.sseClients.delete(res);
});

res.on('error', (err) => {
    this.sseClients.delete(res);
    try { res.end(); } catch (_) { /* already destroyed */ }
});

return true;
```

- **What triggers it:** `addSSEClient()` call
- **What it calls:** `this.sseClients.add()`, `res.on('close')`, `res.on('error')`
- **Status:** WORKING
- **Gap:**
  - **No heartbeat/keep-alive**: SSE connections that go idle may be terminated by proxies, load balancers, or the browser. There's no periodic heartbeat (`:keepalive\n\n` comment in SSE). The frontend at `st8.html:2139` has exponential backoff reconnection, which handles disconnections gracefully, but a server-side heartbeat would be more robust.
  - **Error handler is defensive**: The `try { res.end(); } catch (_)` pattern correctly handles already-destroyed sockets. Good.

---

## Lines 111-120: `_broadcastSSE(event)` — SSE Event Broadcasting

**What this section does:** Iterates over all connected SSE clients and writes the event as an SSE `data:` message. Removes clients that throw errors during write.

```javascript
_broadcastSSE(event) {
    const data = JSON.stringify(event);
    for (const client of this.sseClients) {
        try {
            client.write(`data: ${data}\n\n`);
        } catch (err) {
            this.sseClients.delete(client);
        }
    }
}
```

- **What triggers it:** `publish()` → `_broadcastSSE(enriched)` (line 50)
- **What it calls:** `JSON.stringify(event)`, `client.write()` for each SSE client
- **What calls it:** `publish()` exclusively
- **Status:** WORKING
- **Gap:**
  - **No `event:` field in SSE output**: Same as line 92 — sends `data:` only, no named event type. The frontend handles this via `data.mutationType` field inspection.
  - **Synchronous iteration over `Set` during mutation**: If a `client.write()` throws, `this.sseClients.delete(client)` modifies the `Set` while iterating. In JavaScript, `for...of` over a `Set` is safe during deletion of the current element (the iterator continues correctly). This is safe per the ECMAScript spec.
  - **No backpressure handling**: `client.write()` returns a boolean indicating whether the internal buffer has been flushed. If a slow client's buffer is full, `write()` returns `false` but the code doesn't wait for `'drain'` events. For SSE with small mutation events, this is unlikely to be a practical issue.

---

## Lines 121-126: Singleton Export

```javascript
}

// Singleton instance
const notificationBus = new NotificationBus();

module.exports = { NotificationBus, notificationBus };
```

**What this section does:** Creates a singleton `notificationBus` instance and exports both the class (for testing/subclassing) and the singleton (for production use).

- **What triggers it:** Module load
- **What it calls:** `new NotificationBus()` (constructor at line 18)
- **What calls it:**
  - `backend/index.js:22` — `const { notificationBus } = require('./notificationBus');`
  - `backend/server.js:741` — `const { notificationBus } = require('./notificationBus');` (inside `_handleMutationsSSE`)
  - `backend/server.js:798` — `const { notificationBus } = require('./notificationBus');` (inside `_handleConceptFile`)
  - `backend/server.js:872` — `const { notificationBus } = require('./notificationBus');` (inside `_handleMvpLock`)
  - `backend/server.js:1003` — `const { notificationBus } = require('./notificationBus');` (inside `_handleProductionPromote`)
  - `backend/server.js:1202` — `const { notificationBus } = require('./notificationBus');` (inside `_handleBrunoCall`)
  - `backend/server.js:1257` — `const { notificationBus } = require('./notificationBus');` (inside `_handleOscarHouse`)
- **Status:** WORKING
- **Gap:**
  - **Singleton pattern with multiple `require()` calls**: Node.js caches modules, so all `require('./notificationBus')` calls return the same singleton. This is correct. However, `server.js` re-requires it inside each handler function (lines 741, 798, 872, 1003, 1202, 1257) rather than at module top level. This works but is unusual — the `require()` is cached after the first call, so it's effectively free, but it's a code smell.

---

## CONNECTION MAP

### What triggers notifications?

| Trigger Source | File | Line | mutationType | Actor |
|---|---|---|---|---|
| Concept file creation | `server.js` | 820 | `'CONCEPT'` | `'DEVELOPER'` |
| MVP Lock | `server.js` | 895 | `'LOCK'` | `'DEVELOPER'` |
| Production promote | `server.js` | 1010 | `'PRODUCTION'` | `'DEVELOPER'` |
| File deleted (watcher) | `index.js` | 228 | `'DELETE'` | `ActorType.WATCHER` |
| File added (watcher) | `index.js` | 290 | `MutationType.CREATE` | `ActorType.WATCHER` |
| File edited (watcher) | `index.js` | 343 | `MutationType.EDIT` | `ActorType.WATCHER` |
| Bruno flags stale file | `brunoOscar.js` | 35 | `'BRUNO_CALL'` | `'BRUNO'` |
| Oscar archives file | `brunoOscar.js` | 80 | `'ARCHIVE'` | `'OSCAR'` |
| Bruno un-archives file | `brunoOscar.js` | 138 | `'UNARCHIVE'` | `'BRUNO'` |

### What clients receive SSE events?

| Client | File | Line | Connection Method |
|---|---|---|---|
| Frontend browser | `st8.html` | 2108 | `new EventSource('/api/mutations')` |
| Server SSE handler | `server.js` | 744 | `notificationBus.addSSEClient(res, {...})` |

### What other files depend on notificationBus?

| File | Import Line | Usage |
|---|---|---|
| `backend/index.js` | 22 | `setPrinter()` + 3× `publish()` calls |
| `backend/server.js` | 741, 798, 872, 1003, 1202, 1257 | `addSSEClient()` + 3× `publish()` calls |
| `backend/brunoOscar.js` | 13 (constructor param) | 3× `publish()` calls |
| `backend/gapAnalyzer.js` | 423, 434 | Existence check only (not a real dependency) |

---

## @@@ SYMBOL HANDLING

The `notificationBus.js` file itself contains **ZERO** `@@@` symbols. However, `@@@` symbols are handled elsewhere in the system and are relevant to the notification pipeline:

| File | Line | Context |
|---|---|---|
| `backend/brunoOscar.js` | 173 | `<!-- @@@ Content from ${path.basename(file.filepath)} — APPENDED BY OSCAR @@@ -->` — Oscar appends archived file content to parent files wrapped in `@@@` markers |
| `backend/intentSeeder.js` | 187-188 | Detects `@@@` symbols in file content using regex `/(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm` and flags files for AI review |
| `backend/persistence.js` | 577+ | `flagForAIReview()`, `markAIReviewed()`, `getFilesNeedingAIReview()` — database methods for `@@@`-flagged files |

The `@@@` symbols are NOT routed through the notification bus. They are handled by the persistence layer and intent seeder directly.

---

## STATUS SYMBOLS (Mutation Type Icons)

| mutationType | Symbol | Unicode | Line |
|---|---|---|---|
| `EDIT` | `✎` | U+270E (Pencil) | 53 |
| `CREATE` | `+` | ASCII plus | 54 |
| `DELETE` | `−` | U+2212 (Minus sign) | 55 |
| `CONCEPT` | `◈` | U+25C8 (White diamond containing black small diamond) | 56 |
| `LOCK` | `⊘` | U+29D8 (Circled division slash) | 57 |
| `PRODUCTION` | `★` | U+2605 (Black star) | 58 |
| (default/unknown) | `·` | U+00B7 (Middle dot) | 58 |

**Missing from symbol map** (published by `brunoOscar.js` but fall through to `'·'`):
- `BRUNO_CALL`
- `ARCHIVE`
- `UNARCHIVE`

---

## COMPLETE PUBLISH() CALL SITE INVENTORY

| # | File | Line | mutationType | Has `schemaCard`? | Has `filepath`? |
|---|---|---|---|---|---|
| 1 | `server.js` | 820 | CONCEPT | ❌ | ✅ |
| 2 | `server.js` | 895 | LOCK | ❌ | ✅ |
| 3 | `server.js` | 1010 | PRODUCTION | ❌ | ❌ (fingerprint only) |
| 4 | `index.js` | 228 | DELETE | ❌ | ✅ |
| 5 | `index.js` | 290 | CREATE | ❌ | ✅ |
| 6 | `index.js` | 343 | EDIT | ❌ | ✅ |
| 7 | `brunoOscar.js` | 35 | BRUNO_CALL | ❌ | ✅ |
| 8 | `brunoOscar.js` | 80 | ARCHIVE | ❌ | ✅ |
| 9 | `brunoOscar.js` | 138 | UNARCHIVE | ❌ | ✅ |

**Result:** 0/9 call sites provide `schemaCard`. The printer fallback channel (lines 62-68) is unreachable dead code.

---

## SUMMARY OF FINDINGS

### Working Correctly
- ✅ Singleton pattern with proper Node.js module caching
- ✅ SSE client lifecycle (connect, close, error cleanup)
- ✅ EventEmitter with try/catch isolation
- ✅ Console output with status symbols for 6 mutation types
- ✅ Capacity limiting (maxSseClients)
- ✅ CORS origin restriction (not using wildcard `*`)
- ✅ Frontend SSE client with exponential backoff reconnection
- ✅ `Set` mutation during `for...of` iteration is spec-safe

### Issues Found
1. **DEAD CODE (Printer fallback, lines 62-68):** `event.schemaCard` is never provided by any `publish()` caller. The `SchemaCardPrinter` is wired via `setPrinter()` but `printCard()` is never invoked through the notification bus.
2. **Incomplete status symbol map (lines 53-58):** `BRUNO_CALL`, `ARCHIVE`, `UNARCHIVE` mutation types published by `brunoOscar.js` fall through to default `'·'` symbol.
3. **No `EventEmitter` subscribers anywhere:** The `mutation` and `mutation:${type}` events are emitted but no code in the project listens for them.
4. **No SSE heartbeat/keepalive:** Idle connections may be dropped by proxies. Frontend handles reconnection but server-side heartbeat would be more robust.
5. **No input validation on `event` parameter:** `publish()` doesn't validate that `event` has required fields (`mutationType`, `filepath`/`fingerprint`, `actor`).
6. **Repeated `require()` in `server.js`:** The notification bus is required inside 6 different handler functions instead of at module top level. Functionally correct (cached) but unusual pattern.
