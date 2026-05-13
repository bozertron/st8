# External Integrations

**Analysis Date:** 2026-05-11

## APIs & External Services

**Text Layout Engine (CDN):**
- `@chenglou/pretext@0.0.6` — DOM-free text measurement and layout
  - Import: `https://esm.sh/@chenglou/pretext@0.0.6` (ESM CDN via esm.sh)
  - Functions used: `prepareWithSegments`, `layoutWithLines`, `layoutNextLine`, `walkLineRanges`
  - File: `void-engine.js:2-7`
  - Auth: None required (public CDN)
  - Fallback: None — app will not render text if CDN is unavailable

**EPO WebSocket Bus (Optional):**
- `window.epoClient` — Expected to be injected by external "actu8" runtime
  - Connection: WebSocket (URL configured externally)
  - Protocol: Request-response pattern via `epoClient.request(type, payload)`
  - Listener pattern: `epoClient.listen(callback)` for broadcast messages
  - Files: `file-explorer.js:156-164`, `phreak-terminal.js:68-93,686-725`
  - Graceful degradation: Falls back to simulation/offline mode when disconnected

## Data Storage

**Databases:**
- None — No database connections in this codebase

**Client-Side Storage:**
- `localStorage` — Settings persistence
  - Key: `st8.settings.v1`
  - Adapter: `LocalStorageAdapter` in `settings-reader.js:27-38`
  - Content: JSON object with categories: `voidflow`, `sirkits`, `models`, `shells`
  - Swappable: `MemoryAdapter` available for testing (`settings-reader.js:41-44`)

**File Storage:**
- No local file I/O — File explorer reads via EPO WebSocket bus
  - Request: `epoClient.request('file_list', { path })` (`file-explorer.js:164`)
  - Response: Array of `{ name, isDirectory, size?, modified? }` entries

**Caching:**
- pretext caches font metrics internally after first `prepareWithSegments` call
- No explicit HTTP caching or service worker

## Authentication & Identity

**Auth Provider:**
- None — No authentication in this codebase
- User identity: Hardcoded `bozertron` in prompt string (`phreak-terminal.js:748`)

## EPO Bus Message Types

**File System:**
- `file_list` — List directory contents (`file-explorer.js:164`)

**Terminal Execution:**
- `exec` — Execute shell command (`phreak-terminal.js:70`)
- `start_proxy` — Start media proxy stream (`phreak-terminal.js:182`)

**Media Control:**
- `get_streams` — List active streams (`phreak-terminal.js:141`)
- `get_status` — Stream health/bitrate (`phreak-terminal.js:142`)
- `get_health` — ZLMediaKit liveness check (`phreak-terminal.js:143`)
- `get_config` — Server configuration (`phreak-terminal.js:144`)

**Broadcast Signals (incoming via `epoClient.listen`):**
- `announcement` / `notify` → phreak signal type `announcement`
- `chat_response` / `chat_ack` → phreak signal type `message`
- `media` / `tts` → phreak signal type `media`
- `system` / `error` → phreak signal type `system`
- `heartbeat` / `ping` / `pong` / `registered` → ignored
- File: `phreak-terminal.js:697-710`

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, LogRocket, or similar
- Errors logged to `console.warn` (`settings-reader.js:37,102`)

**Logs:**
- `console.info` for panel mount events (`st8.html:727,756`)
- `console.warn` for settings write failures and listener errors
- `performance.now()` used for reflow timing in `void-engine.js:276,304`

## CI/CD & Deployment

**Hosting:**
- Static file hosting (no server-side code)
- Can be served from any HTTP server or `file://` protocol

**CI Pipeline:**
- None detected — No `.github/workflows`, no CI config files

## Environment Configuration

**Required env vars:**
- None — Standalone operation requires no environment variables

**Optional external config:**
- `window.actu8Config.workspace` — Override file explorer workspace path (`file-explorer.js:43`)
- `window.actu8Config.homeDir` — Override home directory for breadcrumb expansion (`file-explorer.js:67`)
- `window.epoClient` — EPO WebSocket client (injected by actu8 runtime)

**Secrets location:**
- No secrets in this codebase
- `.env` file: Not present

## Webhooks & Callbacks

**Incoming:**
- None — No webhook endpoints

**Outgoing:**
- None — No outbound HTTP requests (all communication via EPO WebSocket bus)

## Fallback Behavior

**When EPO bus is disconnected:**
- `file-explorer.js`: Shows error banner with retry button; no file listing available
- `phreak-terminal.js`: Falls back to built-in simulation commands (`ls`, `pwd`, `whoami`, `date`, `echo`, `clear`, `help`) via `_simulateCommand()` (`phreak-terminal.js:99-136`)
- Media commands: Returns "Not connected to EPO bus" error

**When pretext CDN is unavailable:**
- `void-engine.js` will fail to import; no text rendering possible
- No offline fallback for pretext

---

*Integration audit: 2026-05-11*
