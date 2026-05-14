# Backend Server.js — Line-by-Line Analysis Report

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/server.js`  
**Total Lines:** 1065  
**Reviewed:** 2026-05-13T20:30:00Z  
**Status:** ISSUES FOUND — 2 bugs, 3 security concerns, 4 code quality issues

---

## Lines 1-8: File Header / Docstring
- **What this section does:** Shebang + JSDoc describing the server as HTTP API for manifests and re-indexing
- **What triggers it:** N/A (static)
- **What it calls:** Nothing
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None — clean header

---

## Lines 10-14: Strict Mode + Node Built-in Imports
```js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
```
- **What this section does:** Enables strict mode and imports Node.js built-in modules
- **What triggers it:** Module load
- **What it calls:** Node's require() system
- **What calls it:** Module loader
- **Dependencies:** Node.js built-ins only
- **Status:** WORKING
- **Gap:** None. `path`, `fs`, `http` are all used throughout the file.

---

## Lines 16-31: Static File Configuration
```js
const STATIC_DIR = path.join(__dirname, '..');
const MIME_TYPES = { ... };
```
- **What this section does:** Defines the root directory for static file serving (parent of `backend/`) and a MIME type map
- **What triggers it:** Module load (constant initialization)
- **What it calls:** `path.join(__dirname, '..')`
- **What calls it:** Used by `_serveStaticFile()` at line 130
- **Dependencies:** `path` module
- **Status:** WORKING
- **Gap:** The MIME map is incomplete. Missing `.ico` (favicon requests will get `application/octet-stream` instead of `image/x-icon`), `.mp4`, `.webp`, `.json` is fine, but `.wasm` is missing. Minor.

---

## Lines 33-54: Server Class — Constructor + start()
```js
class St8Server {
    constructor(options = {}) { ... }
    start() { ... }
```
- **What this section does:** Defines the `St8Server` class with port (default 3847), targetDir, server instance, manifestCache, lastManifestUpdate. `start()` creates an HTTP server, binds to `127.0.0.1`, and begins listening.
- **What triggers it:** `backend/index.js:408` — `new St8Server({ port, targetDir })`
- **What it calls:** `http.createServer()`, `this._handleRequest()`, `this.server.listen()`
- **What calls it:** `backend/index.js:409` — `server.start()`
- **Dependencies:** `http` module; requires `targetDir` to be passed from `index.js`
- **Status:** WORKING
- **Gap:** 
  - `this.manifestCache` (line 40) and `this.lastManifestUpdate` (line 41) are initialized but **never written to anywhere in the file**. Dead code — these properties serve no purpose.
  - `start()` returns `true` but the return value is never checked by the caller (`index.js:409`).
  - **No error handling on `server.listen()`** — if the port is already in use, the error event is unhandled and will crash the process. Should add `this.server.on('error', ...)`.

---

## Lines 56-78: _handleRequest() — Main Request Router
```js
_handleRequest(req, res) { ... }
```
- **What this section does:** Parses URL, sets CORS headers, handles OPTIONS preflight, routes `/api/*` to `_handleApiRequest()`, everything else to `_serveStaticFile()`
- **What triggers it:** Every incoming HTTP request (line 46)
- **What it calls:** `new URL()`, `_handleApiRequest()` (line 72), `_serveStaticFile()` (line 77)
- **What calls it:** The `http.createServer` callback at line 45
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **CORS header (line 60):** Sets `Access-Control-Allow-Origin` to `'http://localhost:' + this.port`. This is correct and secure (prevents the RCE chain documented in H1-CORS-RCE-MITIGATION-DESIGN.md). ✅ Fixed.
  - **No error wrapping** — if `new URL()` throws (malformed URL), the entire request handler crashes with no response sent to the client. Should wrap in try/catch.

---

## Lines 80-128: _handleApiRequest() — API Route Switch
```js
_handleApiRequest(req, res, url) { ... }
```
- **What this section does:** Routes 14 API endpoints via a switch statement
- **What triggers it:** Any request starting with `/api/`
- **What it calls:** 14 handler methods
- **What calls it:** `_handleRequest()` at line 72
- **Dependencies:** All downstream handler methods
- **Status:** WORKING
- **Gap:** 
  - **Dead references:** The `/api/exec` endpoint was removed (confirmed in security audit), which is correct. However, `phreak-terminal.js:90` still calls `fetch('/api/exec', ...)` — this will get a 404 at runtime. **This is a frontend bug, not a server bug**, but worth noting.
  - All 14 routes are GET-or-POST only (no PUT/DELETE/PATCH), which is fine for this use case.

---

## Lines 130-167: _serveStaticFile() — Static File Serving
```js
_serveStaticFile(req, res, url) { ... }
```
- **What this section does:** Serves files from the parent directory. Defaults `/` to `/st8.html`. Includes directory traversal protection.
- **What triggers it:** Any non-`/api/` request
- **What it calls:** `fs.existsSync()`, `fs.readFileSync()`, `path.join()`, `path.extname()`
- **What calls it:** `_handleRequest()` at line 77
- **Dependencies:** `fs`, `path`, `STATIC_DIR` constant, `MIME_TYPES` map
- **Status:** WORKING
- **Gap:**
  - **Line 141 — Directory traversal check:** `if (!fullPath.startsWith(STATIC_DIR))` — This is correct but can be bypassed on case-insensitive filesystems or with null bytes on older Node versions. However, `path.join()` normalizes `..` segments, so the main traversal vector is blocked. ✅ Adequate.
  - **Line 160 — Synchronous file read:** `fs.readFileSync(fullPath)` blocks the entire event loop for every static file request. For a local dev tool this is acceptable but would be a problem at scale.

---

## Lines 169-191: _serveManifest() — GET /api/connection-state.json
```js
_serveManifest(req, res) { ... }
```
- **What this section does:** Serves the `connection-state.json` manifest from `targetDir`
- **What triggers it:** `GET /api/connection-state.json`
- **What it calls:** `fs.existsSync()`, `fs.readFileSync()`
- **What calls it:**
  - `st8.html:1974` — `fetch('/api/connection-state.json')` (refresh button)
  - `st8.html:2014` — `fetch('/api/connection-state.json')` (initial load)
  - `st8.html:1704` — polling via `St8Coordination.startPolling('/api/connection-state.json')`
- **Dependencies:** `this.targetDir` (must be set), `connection-state.json` file on disk
- **Status:** WORKING
- **Gap:** No method validation — responds to POST/PUT/DELETE too, not just GET. Should restrict to GET only.

---

## Lines 193-215: _serveToml() — GET /api/ai-signal.toml
```js
_serveToml(req, res) { ... }
```
- **What this section does:** Serves the `ai-signal.toml` file from `targetDir`
- **What triggers it:** `GET /api/ai-signal.toml`
- **What it calls:** `fs.existsSync()`, `fs.readFileSync()`
- **What calls it:** No frontend code calls this directly (verified by grep). Potential external AI tool consumer.
- **Dependencies:** `this.targetDir`, `ai-signal.toml` file on disk
- **Status:** **NOT CONNECTED** (to any frontend)
- **Gap:** No frontend consumer found. Works but is orphaned from the UI. No method validation.

---

## Lines 217-225: _serveHealth() — GET /api/health
```js
_serveHealth(req, res) { ... }
```
- **What this section does:** Returns JSON with server status, uptime, targetDir, lastManifestUpdate
- **What triggers it:** `GET /api/health`
- **What it calls:** `process.uptime()`, `JSON.stringify()`
- **What calls it:** No frontend code calls this directly (verified by grep). Monitoring endpoint.
- **Dependencies:** None
- **Status:** **NOT CONNECTED** (to any frontend)
- **Gap:** No frontend consumer. `lastManifestUpdate` (line 223) is always `null` since the property is never updated. No method validation.

---

## Lines 227-296: _handleIndex() — POST /api/index
```js
_handleIndex(req, res) { ... }
```
- **What this section does:** Triggers a full re-index of a directory. Reads POST body for optional `path`, calls `indexDirectory()`, enriches results with intents from persistence, writes manifests.
- **What triggers it:** `POST /api/index`
- **What it calls:**
  - `require('./indexer').indexDirectory` (line 265)
  - `require('./manifestGenerator').writeManifests` (line 266)
  - `require('./persistence').St8Persistence` (line 267)
  - `persistence.initialize()`, `persistence.getAllIntents()`, `persistence.close()`
- **What calls it:**
  - `file-explorer.js:585` — `fetch('/api/index', { method: 'POST', ... })` (INDEX button)
- **Dependencies:** `backend/indexer.js`, `backend/manifestGenerator.js`, `backend/persistence.js`
- **Status:** WORKING
- **Gap:**
  - **Line 272:** `persistence = new St8Persistence()` — creates a new DB connection for every index request. This is fine but means each request opens/closes SQLite.
  - **Line 269:** `{ write: false }` — the indexer doesn't write manifests itself, but `writeManifests` is called separately at line 281. Correct separation.
  - **Missing `req.on('error')` handler** — if the request stream errors, there's no cleanup. Minor for local dev.

---

## Lines 298-395: _handleFileIntent() — POST /api/file-intent
```js
_handleFileIntent(req, res) { ... }
```
- **What this section does:** Saves a user-written intent (purpose, dependsOnBehavior, valueStatement) for a file. Updates the manifest on disk with the new intent.
- **What triggers it:** `POST /api/file-intent`
- **What it calls:**
  - `require('./persistence').St8Persistence` (line 327)
  - `persistence.upsertIntent()` (line 332)
  - `persistence.logActivity()` (line 340)
  - `persistence.getAllIntents()` (line 348)
  - `fs.readFileSync()` / `fs.writeFileSync()` (lines 354, 378)
- **What calls it:**
  - `st8.html:1952` — `fetch('/api/file-intent', { method: 'POST', ... })` (save intent button)
- **Dependencies:** `backend/persistence.js`, `fs` module, `connection-state.json` on disk
- **Status:** WORKING (with issues)
- **Gap:**
  - 🐛 **BUG (Line 326):** `const { fingerprint, purpose, dependsOnBehavior, valueStatement } = JSON.parse(body)` — If `body` is empty string (no POST body sent), `JSON.parse('')` throws a SyntaxError. The outer catch at line 390 handles this, BUT if `body` is `'{}'` (empty object), then `fingerprint` is `undefined`, and `persistence.upsertIntent()` at line 332 will attempt to insert with a null fingerprint, which violates the PRIMARY KEY constraint in the `file_intent` table. **Should validate that `fingerprint` is present before proceeding.**
  - 🐛 **BUG (Line 385-389):** The `.catch()` handler calls `persistence.close()` then sends a response. But if the `.then()` handler at line 331 also called `persistence.close()` in its `finally` block (line 382-384) and THEN threw, the `.catch()` would try to close an already-closed DB. The `persistence.close()` method has a guard (`if (this.db)`) so this won't crash, but it's a fragile pattern. The `finally` at line 382 runs before the `.catch()` at line 385, so this path is actually: `finally` closes → `.catch` tries to close again (no-op) → sends error response. **This is actually safe but confusing.**

---

## Lines 397-472: _handleSettings() — GET/POST /api/settings
```js
_handleSettings(req, res, url) { ... }
```
- **What this section does:** GET returns all settings or settings filtered by `?category=`. POST upserts a setting with `category`, `key`, `value`.
- **What triggers it:** `GET /api/settings` or `POST /api/settings`
- **What it calls:**
  - `require('./persistence').St8Persistence` (line 398)
  - `persistence.getSettingsByCategory()` (line 409)
  - `persistence.getAllSettings()` (line 411)
  - `persistence.upsertSetting()` (line 447)
- **What calls it:**
  - `settings-ui.js:188` — `fetch('/api/settings')` (load settings)
  - `settings-ui.js:174` — `fetch('/api/settings', { method: 'POST', ... })` (save setting)
- **Dependencies:** `backend/persistence.js`
- **Status:** WORKING (with issues)
- **Gap:**
  - 🐛 **BUG (Line 458-460):** `req.on('close', () => { if (persistence) persistence.close(); })` — This handler is registered ONLY in the POST branch, AFTER `persistence.initialize().then(...)` has already started executing. There's a race condition: if `initialize()` completes synchronously (better-sqlite3 is synchronous), the `req.on('end')` handler fires, closes persistence in the `finally` block (line 454), and THEN the `req.on('close')` handler fires later (when the socket closes) and tries to close again. The `close()` guard prevents a crash, but the intent of this handler is to handle **client abort** (where `req.on('end')` never fires). However, by the time the `close` handler is registered, the `req.on('data')` and `req.on('end')` handlers have already been registered too, so the close handler fires after end in the normal case. **The `close` handler should be registered BEFORE the `initialize()` call, not inside the `.then()`.**
  - **No method validation on GET path** — responds to POST, PUT, etc. on the GET branch. Actually, looking more carefully: the GET branch is inside `if (req.method === 'GET')` at line 402, so it IS validated. The 405 at line 462 handles other methods. ✅ Correct.

---

## Lines 474-524: _handleFileList() — GET /api/files
```js
_handleFileList(req, res, url) { ... }
```
- **What this section does:** Lists directory contents. Supports `?path=` query parameter with tilde expansion. Includes directory traversal protection restricting access to home directory or targetDir.
- **What triggers it:** `GET /api/files?path=...`
- **What it calls:**
  - `require('os').homedir()` (lines 475, 491)
  - `path.resolve()`, `path.relative()`, `path.isAbsolute()` (lines 484, 492-495)
  - `fs.existsSync()`, `fs.readdirSync()` (lines 504, 511)
- **What calls it:**
  - `file-explorer.js:158` — `fetch('/api/files?path=' + encodeURIComponent(path))` (directory browser)
- **Dependencies:** `os`, `path`, `fs` modules
- **Status:** WORKING (with security concern)
- **Gap:**
  - ⚠️ **SECURITY (Lines 491-501):** The traversal protection allows access to the **entire home directory** (`os.homedir()`), not just `targetDir`. The `insideHome` check at line 494 means any path under `~` is accessible. This means `GET /api/files?path=~/.ssh` would list SSH keys, `GET /api/files?path=~/.aws` would list AWS credentials, etc. **The response also includes full absolute paths** (line 515: `path: path.join(resolvedPath, entry.name)`), leaking the filesystem layout. For a local-only dev tool bound to 127.0.0.1 this is low-risk, but the comment at line 486 says "restrict to home dir or targetDir" — the home dir restriction is too broad.
  - **Line 515:** Returns full absolute paths in the response. Could be a minor information disclosure.

---

## Lines 526-720: _handleVerify() — POST /api/verify
```js
_handleVerify(req, res) { ... }
```
- **What this section does:** Verifies file integrity — checks every indexed file exists on disk, computes current SHA-256 hash, compares with stored hash, detects orphan files on disk not in index.
- **What triggers it:** `POST /api/verify`
- **What it calls:**
  - `require('./persistence').St8Persistence` (line 588)
  - `require('./indexer').discoverFiles` (line 680)
  - `persistence.getAllFiles()`, `persistence.logActivity()`
  - `fs.existsSync()`, `fs.readFileSync()`, `fs.statSync()`
  - `crypto.createHash('sha256')`
- **What calls it:**
  - `file-explorer.js:638` — `fetch('/api/verify', ...)` (VERIFY button)
- **Dependencies:** `backend/persistence.js`, `backend/indexer.js`, `crypto` module
- **Status:** WORKING (with code quality issues)
- **Gap:**
  - 🐛 **BUG (Lines 576-578):** Variable shadowing — `const path = require('path')`, `const fs = require('fs')`, `const crypto = require('crypto')` are re-required INSIDE the `req.on('end')` handler, shadowing the module-level `path` and `fs` imports at lines 13-14. While this works (same module, cached by require), it's confusing and wasteful. The `crypto` import IS needed (not imported at module level), but `path` and `fs` should use the module-level imports.
  - **Line 590-710:** The indentation is inconsistent — `await persistence.initialize()` at line 591 is indented differently from the `try` at line 590, suggesting the code was hastily edited.
  - **Line 657-664:** Size mismatch detection — if a file is VERIFIED by hash but has a size mismatch, the code changes status to MODIFIED and decrements `verified` count. This double-counting logic is fragile.

---

## Lines 722-729: _handleMutationsSSE() — GET /api/mutations (SSE)
```js
_handleMutationsSSE(req, res) { ... }
```
- **What this section does:** Establishes a Server-Sent Events connection for real-time mutation notifications. Delegates to `notificationBus.addSSEClient()`.
- **What triggers it:** `GET /api/mutations`
- **What it calls:**
  - `require('./notificationBus').notificationBus` (line 723)
  - `notificationBus.addSSEClient(res, { allowedOrigin: ... })` (line 726)
- **What calls it:**
  - `st8.html:2108` — `mutationSource = new EventSource('/api/mutations')` (SSE connection)
- **Dependencies:** `backend/notificationBus.js`
- **Status:** WORKING
- **Gap:**
  - ✅ CORS is properly restricted — `allowedOrigin` is set to `'http://localhost:' + this.port` (line 727), matching the main CORS header. This is the CR-01 fix referenced in the notificationBus code.
  - **No method validation** — accepts POST, PUT, etc. Should be GET-only for SSE (EventSource only sends GET).
  - The notificationBus limits SSE clients to 10 (`maxSseClients` default). This is fine for a local dev tool.

---

## Lines 731-821: _handleConceptFile() — POST /api/concept-file (Phase 6)
```js
_handleConceptFile(req, res) { ... }
```
- **What this section does:** Registers a new concept file — creates a DB entry with `lifecyclePhase: 'CONCEPT'`, optionally sets intent, publishes SSE notification.
- **What triggers it:** `POST /api/concept-file`
- **What it calls:**
  - `require('./persistence').St8Persistence` (line 779)
  - `require('./notificationBus').notificationBus` (line 780)
  - `persistence.registerConceptFile()` (line 785)
  - `persistence.upsertIntent()` (line 793)
  - `notificationBus.publish()` (line 802)
- **What calls it:** No frontend code calls this endpoint (verified by grep). UI may not be built yet.
- **Dependencies:** `backend/persistence.js`, `backend/notificationBus.js`
- **Status:** **NOT CONNECTED** (no frontend consumer)
- **Gap:** Works correctly in isolation but has no UI integration. The `notificationBus.publish()` at line 802 broadcasts a CONCEPT mutation via SSE, but no frontend is listening for this specific mutation type in a meaningful way.

---

## Lines 823-910: _handleMvpLock() — POST /api/mvp-lock (Phase 6)
```js
_handleMvpLock(req, res) { ... }
```
- **What this section does:** Locks all CONCEPT/DEVELOPMENT phase files to LOCKED phase. Updates DB, logs mutations, publishes SSE notifications, re-emits schema cards.
- **What triggers it:** `POST /api/mvp-lock`
- **What it calls:**
  - `require('./persistence').St8Persistence` (line 852)
  - `require('./schemaCardEmitter').SchemaCardEmitter` (line 853)
  - `require('./notificationBus').notificationBus` (line 854)
  - `persistence.db.prepare(...).run()` (line 864-866) — **direct DB access**
  - `persistence.logMutation()` (line 868)
  - `notificationBus.publish()` (line 877)
  - `emitter.emitAllCards()` (line 895)
- **What calls it:** No frontend code calls this endpoint (verified by grep).
- **Dependencies:** `backend/persistence.js`, `backend/schemaCardEmitter.js`, `backend/notificationBus.js`
- **Status:** **NOT CONNECTED** (no frontend consumer)
- **Gap:**
  - ⚠️ **Line 864-866:** Accesses `persistence.db.prepare(...)` directly instead of going through a persistence method. This breaks encapsulation — if the DB layer changes, this code will break silently. Should add a `persistence.updateLifecyclePhase(fingerprint, phase)` method.
  - **Line 830-846:** Consumes the POST body even though it doesn't use it (the comment says "to drain the socket"). This is correct — prevents connection leak.

---

## Lines 912-941: _handlePrd() — GET /api/prd (Phase 6)
```js
_handlePrd(req, res) { ... }
```
- **What this section does:** Generates and returns a PRD (Product Requirements Document) as Markdown from schema cards.
- **What triggers it:** `GET /api/prd`
- **What it calls:**
  - `require('./prdGenerator').loadSchemaCards` (line 926)
  - `require('./prdGenerator').generatePRD` (line 926)
  - `path.join(this.targetDir, '.st8', 'schema-cards')` (line 927)
- **What calls it:** No frontend code calls this endpoint (verified by grep).
- **Dependencies:** `backend/prdGenerator.js`, schema card files on disk
- **Status:** **NOT CONNECTED** (no frontend consumer)
- **Gap:** Works correctly. Returns `text/markdown` content type. No method validation (responds to POST too).

---

## Lines 943-1010: _handleProductionPromote() — POST /api/production-promote (Phase 6)
```js
_handleProductionPromote(req, res) { ... }
```
- **What this section does:** Promotes a file to PRODUCTION phase — purges development mutation data, logs a PRODUCTION mutation, publishes SSE notification.
- **What triggers it:** `POST /api/production-promote`
- **What it calls:**
  - `require('./persistence').St8Persistence` (line 984)
  - `require('./notificationBus').notificationBus` (line 985)
  - `persistence.purgeDevelopmentData(fingerprint)` (line 990)
  - `notificationBus.publish()` (line 992)
- **What calls it:** No frontend code calls this endpoint (verified by grep).
- **Dependencies:** `backend/persistence.js`, `backend/notificationBus.js`
- **Status:** **NOT CONNECTED** (no frontend consumer)
- **Gap:**
  - **Line 978:** `if (!fingerprint)` — Validates fingerprint is present. Good.
  - **Line 990:** `persistence.purgeDevelopmentData(fingerprint)` — This is a destructive operation (deletes mutation history). No confirmation mechanism or undo. For a local dev tool this is acceptable.

---

## Lines 1012-1051: _handleGapAnalysis() — GET /api/gap-analysis (Phase 6)
```js
_handleGapAnalysis(req, res) { ... }
```
- **What this section does:** Runs a 6-dimension gap analysis on schema cards and returns the report as JSON or Markdown (content negotiation via Accept header).
- **What triggers it:** `GET /api/gap-analysis`
- **What it calls:**
  - `require('./gapAnalyzer').GapAnalyzer` (line 1021)
  - `require('./persistence').St8Persistence` (line 1022)
  - `new GapAnalyzer(schemaCardsDir, persistence)` (line 1027)
  - `analyzer.analyze()` (line 1028)
  - `analyzer.toMarkdown()` (line 1033) — if Accept: text/markdown
- **What calls it:** No frontend code calls this endpoint (verified by grep).
- **Dependencies:** `backend/gapAnalyzer.js`, `backend/persistence.js`, schema card files
- **Status:** **NOT CONNECTED** (no frontend consumer)
- **Gap:**
  - ⚠️ **ANTI-PATTERN (Lines 1025):** Uses `.then()` chain instead of `async/await`. The `try/catch` at line 1020 only catches synchronous errors from `require()` calls. The `.catch()` at line 1040 catches promise rejections. This works but is inconsistent with the rest of the file which uses `async/await` in other handlers.
  - **Line 1026:** Uses `require('path')` inline instead of the module-level `path` import. Redundant.

---

## Lines 1053-1058: stop() — Server Shutdown
```js
stop() { ... }
```
- **What this section does:** Gracefully closes the HTTP server
- **What triggers it:** `backend/index.js:421` — `server.stop()` on SIGINT
- **What it calls:** `this.server.close()`
- **What calls it:** SIGINT handler in `index.js`
- **Dependencies:** `this.server` (must be started)
- **Status:** WORKING
- **Gap:** None

---

## Lines 1061-1065: Module Exports
```js
module.exports = { St8Server };
```
- **What this section does:** Exports the `St8Server` class
- **What triggers it:** `require('./server')` from other modules
- **What it calls:** Nothing
- **What calls it:** `backend/index.js:18`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

## Summary: @@@ Symbol Handling

The `@@@` symbol pattern is **not present in server.js**. It is handled in:
- `backend/intentSeeder.js:187-188` — Regex pattern `@@@AI_REVIEW` detection in file content
- `backend/persistence.js:577-612` — `@@@` symbol methods: `flagForAIReview()`, `markAIReviewed()`, `getFilesNeedingAIReview()`, `storeAIContent()`, `getAIContent()`
- `backend/brunoOscar.js:173` — `@@@ Content from ... @@@` appended by Oscar agent

Server.js does **not** expose any `@@@`-related endpoints. The `@@@` handling is entirely internal to the indexer/seeder pipeline.

---

## Summary: Endpoint Connectivity Map

| Endpoint | Method | Handler | Frontend Consumer | Status |
|---|---|---|---|---|
| `/api/connection-state.json` | GET | `_serveManifest` (L169) | `st8.html:1974,2014,1704` | ✅ CONNECTED |
| `/api/ai-signal.toml` | GET | `_serveToml` (L193) | None found | ❌ NOT CONNECTED |
| `/api/health` | GET | `_serveHealth` (L217) | None found | ❌ NOT CONNECTED |
| `/api/index` | POST | `_handleIndex` (L227) | `file-explorer.js:585` | ✅ CONNECTED |
| `/api/file-intent` | POST | `_handleFileIntent` (L298) | `st8.html:1952` | ✅ CONNECTED |
| `/api/settings` | GET/POST | `_handleSettings` (L397) | `settings-ui.js:174,188` | ✅ CONNECTED |
| `/api/verify` | POST | `_handleVerify` (L526) | `file-explorer.js:638` | ✅ CONNECTED |
| `/api/files` | GET | `_handleFileList` (L474) | `file-explorer.js:158` | ✅ CONNECTED |
| `/api/mutations` | GET (SSE) | `_handleMutationsSSE` (L722) | `st8.html:2108` | ✅ CONNECTED |
| `/api/concept-file` | POST | `_handleConceptFile` (L733) | None found | ❌ NOT CONNECTED |
| `/api/mvp-lock` | POST | `_handleMvpLock` (L823) | None found | ❌ NOT CONNECTED |
| `/api/prd` | GET | `_handlePrd` (L912) | None found | ❌ NOT CONNECTED |
| `/api/production-promote` | POST | `_handleProductionPromote` (L943) | None found | ❌ NOT CONNECTED |
| `/api/gap-analysis` | GET | `_handleGapAnalysis` (L1012) | None found | ❌ NOT CONNECTED |
| `/api/exec` | REMOVVED | N/A | `phreak-terminal.js:90` still calls it | 🐛 DEAD CODE in frontend |

---

## Summary: Bugs Found

| # | Severity | Lines | Description |
|---|---|---|---|
| 1 | 🐛 Bug | 326 | `_handleFileIntent`: Missing fingerprint validation — `JSON.parse(body)` can produce `{}` with undefined fingerprint, causing PRIMARY KEY violation |
| 2 | 🐛 Bug | 576-578 | `_handleVerify`: Unnecessary variable shadowing of `path` and `fs` with redundant `require()` calls |
| 3 | ⚠️ Security | 491-501 | `_handleFileList`: Home directory exposure — allows browsing entire `~` directory, not just targetDir |
| 4 | ⚠️ Security | 515 | `_handleFileList`: Returns full absolute paths in response (information disclosure) |
| 5 | ⚠️ Code Quality | 458-460 | `_handleSettings` POST: `req.on('close')` handler registered too late — race condition with `req.on('end')` |
| 6 | ⚠️ Code Quality | 1025-1045 | `_handleGapAnalysis`: Uses `.then()` pattern instead of `async/await`, inconsistent with rest of file |
| 7 | ℹ️ Info | 40-41 | `manifestCache` and `lastManifestUpdate` are initialized but never used (dead properties) |
| 8 | ℹ️ Info | 1026 | Redundant inline `require('path')` when module-level `path` is already imported |
| 9 | ℹ️ Info | 60 | `/api/ai-signal.toml`, `/api/health`, `/api/concept-file`, `/api/mvp-lock`, `/api/prd`, `/api/production-promote`, `/api/gap-analysis` have no frontend consumers |
| 10 | ℹ️ Info | — | `phreak-terminal.js:90` still calls removed `/api/exec` endpoint (dead code in frontend) |

---

_Reviewed: 2026-05-13T20:30:00Z_  
_Reviewer: Gsd-Codebase-Reviewer_  
_Depth: standard_  
_File: backend/server.js (1065 lines)_
