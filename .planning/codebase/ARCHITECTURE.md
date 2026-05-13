<!-- refreshed: 2026-05-11 -->
# Architecture

**Analysis Date:** 2026-05-11

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     st8.html (833 lines)                      │
│          HTML structure + CSS + inline panel controller       │
├──────────────────┬──────────────────┬───────────────────────┤
│  void-engine.js  │ file-explorer.js │  phreak-terminal.js   │
│  (ES module)     │ (script tag)     │  (script tag)         │
│  338 lines       │ 495 lines        │  899 lines            │
│  pretext reflow  │ overlay panel    │  overlay panel        │
└────────┬─────────┴──────────────────┴───────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              @chenglou/pretext (esm.sh CDN)                  │
│         DOM-free text measurement + line layout              │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| st8.html | Shell: HTML skeleton, CSS design tokens, panel controller, dock buttons | `st8.html` |
| void-engine | Text reflow surface: pretext integration, obstacle avoidance, cursor, keyboard input | `void-engine.js` |
| file-explorer | File browser panel: WebSocket navigation, virtual scroll, selection | `file-explorer.js` |
| phreak-terminal | Terminal panel: command execution, TUI mode, signal framework, phone toggle | `phreak-terminal.js` |
| settings-reader | Settings persistence: localStorage-backed, schema-driven, event emitter | `settings-reader.js` |
| fake-stream | Demo data: synthetic LLM token stream for Phase A demos | `fake-stream.js` |

## Pattern Overview

**Overall:** Vanilla HTML/JS single-page application with panel-based overlay UI

**Key Characteristics:**
- No build step, no bundler, no TypeScript — pure vanilla JS served directly
- Panel-based UI using fixed overlay modals (`.panel-overlay`) with backdrop blur
- void-engine is an ES module loaded via `<script type="module">`; panels are classic scripts
- CSS design tokens in `:root` provide the entire color palette
- All panels expose their API on `window.*` (global namespace pattern)
- Bottom dock with infinity-symbol button (explorer) and text button (phreak)

## Layers

**HTML Shell (`st8.html`):**
- Purpose: Application shell — structure, styles, and panel lifecycle
- Location: `st8.html`
- Contains: All CSS (lines 8–655), HTML structure (lines 657–699), panel controller JS (lines 705–831)
- Depends on: `file-explorer.js`, `phreak-terminal.js` (loaded as scripts)
- Used by: Browser directly (entry point)

**Void Engine (ES module):**
- Purpose: Real-time text reflow around draggable obstacles using pretext
- Location: `void-engine.js`
- Contains: Text layout, obstacle geometry, keyboard input, animation loop
- Depends on: `@chenglou/pretext` (loaded from `https://esm.sh/@chenglou/pretext@0.0.6`)
- Used by: `st8.html` via `<script type="module" src="vendor/void-engine.js">`

**Panel Modules (classic scripts):**
- Purpose: Self-contained UI panels that mount into overlay containers
- Location: `file-explorer.js`, `phreak-terminal.js`
- Contains: State management, rendering, event handling, public API
- Depends on: `window.escapeHtml` (defined in `st8.html`), `window.epoClient` (optional WebSocket)
- Used by: Panel controller in `st8.html` via `window.VoidFileExplorer.mount()` / `window.PhreakTerminal.mount()`

**Vendor / Utility Modules (ES modules):**
- Purpose: Settings persistence and demo data generation
- Location: `settings-reader.js`, `fake-stream.js`
- Contains: `SettingsReader` class, `FakeStream` class
- Depends on: `localStorage` API
- Used by: Not currently wired into `st8.html` (available for future integration)

## Data Flow

### Primary Request Path (Text Reflow)

1. User types a key → `keydown` handler in `void-engine.js:154` appends to `BODY_TEXT`
2. `bodyDirty` flag set → `animate()` loop detects at `void-engine.js:277`
3. `prepareWithSegments(BODY_TEXT, BODY_FONT)` called → pretext caches word widths
4. `layoutColumn()` computes line positions with obstacle avoidance → `void-engine.js:185`
5. DOM elements updated with `textContent`, `left`, `top` → `void-engine.js:306-314`
6. Cursor positioned at end of last line → `void-engine.js:324-333`

### Panel Open/Close Flow

1. User clicks dock button → `togglePanel('explorer')` → `st8.html:811`
2. `openPanel()` calls `p.mount()` (lazy, once) → `st8.html:796`
3. Panel's `mount()` renders into `#explorer-host` / `#phreak-host` → `st8.html:723-791`
4. Overlay gets `.open` class → CSS `display: flex` activates
5. Close: `.open` removed, `aria-pressed` reset → `st8.html:806-810`
6. Escape key closes all open panels (unless TUI mode) → `st8.html:824-830`

### Command Execution Flow (Phreak Terminal)

1. User presses Enter in input → `_handleInputKeydown()` → `phreak-terminal.js:322`
2. `phreakExecute(cmd)` echoes input, sets `isExecuting` → `phreak-terminal.js:47`
3. Tries media commands first (`_tryMediaCommand`) → `phreak-terminal.js:61`
4. Falls back to EPO WebSocket `exec` request → `phreak-terminal.js:70`
5. If no EPO client, uses `_simulateCommand()` fallback → `phreak-terminal.js:89`
6. stdout/stderr rendered as append-only lines → `phreak-terminal.js:225`

### File Explorer Navigation Flow

1. User clicks location or breadcrumb → `explorerNavigate(path)` → `file-explorer.js:115`
2. `_fetchViaWebSocket(path)` calls `epoClient.request('file_list', {path})` → `file-explorer.js:156`
3. On network error, falls back to `_mockEntries()` → `file-explorer.js:133`
4. Entries stored in `explorerState`, rendered via `_renderExplorer()` → `file-explorer.js:274`
5. Virtual scroll activates for >100 entries → `file-explorer.js:395`

**State Management:**
- Each panel module maintains its own state object (`explorerState`, `phreakState`)
- void-engine uses module-level variables (`BODY_TEXT`, `rects`, `pointerX/Y`)
- No shared state bus between panels — they communicate only through the panel controller's mount callbacks
- Settings use `SettingsReader` with localStorage adapter and event emitter pattern

## Key Abstractions

**Panel Overlay System:**
- Purpose: Consistent modal presentation for all panels
- Examples: `st8.html:219-286` (CSS), `st8.html:680-699` (HTML), `st8.html:716-831` (controller)
- Pattern: Each panel has an overlay div with `.panel-frame > .panel-titlebar + .panel-body`. Panel modules mount into `.panel-body`. Controller handles open/close/toggle lifecycle.

**Obstacle Geometry (void-engine):**
- Purpose: Text flows around rectangular obstacles in real-time
- Examples: `void-engine.js:14-33` (`carveTextLineSlots`), `void-engine.js:34-44` (`circleIntervalForBand`)
- Pattern: Each line band is tested against obstacles. Blocked intervals are subtracted from available width, producing slots. Text fills leftmost slots first.

**Line Pool (void-engine):**
- Purpose: DOM element reuse to avoid garbage collection
- Examples: `void-engine.js:173-184` (`syncPool`)
- Pattern: Pre-allocated pool of `.line` divs. Show/hide by index rather than create/destroy.

**Append-Only Rendering (phreak-terminal):**
- Purpose: Efficient terminal output without full re-renders
- Examples: `phreak-terminal.js:225-244` (`_renderLines`), `phreak-terminal.js:247-256` (`_fullRender`)
- Pattern: `lastRenderedIndex` tracks position. New lines appended via `insertAdjacentHTML('beforeend', ...)`. Full re-render only on clear/TUI toggle.

## Entry Points

**Main Application:**
- Location: `st8.html`
- Triggers: Browser loads the file directly (no server required for static mode)
- Responsibilities: Loads fonts, defines CSS tokens, mounts void-engine, provides panel infrastructure

**Standalone Engine Demo:**
- Location: `void-engine.html`
- Triggers: Browser loads directly
- Responsibilities: Minimal wrapper for void-engine.js without panels — useful for testing the reflow engine in isolation

## Architectural Constraints

- **No modules for panels:** `file-explorer.js` and `phreak-terminal.js` are loaded via `<script>` tags (not `type="module"`). They attach to `window.*` globals. Only `void-engine.js`, `settings-reader.js`, and `fake-stream.js` use ES module syntax.
- **Global state:** Each panel module has a module-scoped state object. `void-engine.js` uses module-level variables (`BODY_TEXT`, `rects`, etc.). No centralized state store.
- **No bundler:** All code is served raw. ES module imports use `https://esm.sh` CDN URLs. No tree-shaking, no minification.
- **Single-threaded:** All rendering runs on the main thread. The `requestAnimationFrame` loop in `void-engine.js` is the only animation driver.
- **EPO dependency (optional):** Both panels optionally use `window.epoClient` for WebSocket communication. Without it, explorer shows mock data and terminal uses command simulation.

## Anti-Patterns

### Inline HTML String Concatenation

**What happens:** Both `file-explorer.js` and `phreak-terminal.js` build HTML via template literals and string concatenation, injecting user data through `escapeHtml()`.

**Why it's risky:** Complex template strings are hard to debug. XSS protection depends entirely on consistent `escapeHtml()` usage.

**Do this instead:** Continue using `escapeHtml()` rigorously. Consider DOM API (`createElement`) for new features. Current pattern is acceptable for this project's scale.

### Duplicate `getState` Definition

**What happens:** `phreak-terminal.js` defines `getState` twice on `window.PhreakTerminal` (lines 858 and 888). The second definition silently overwrites the first.

**Why it's wrong:** The first `getState` (line 858) returns a different shape than the second (line 888). Any code using the first definition's shape will break silently.

**Do this instead:** Remove the duplicate. Use the second, more comprehensive definition at line 888.

## Error Handling

**Strategy:** Defensive with fallbacks — panels degrade gracefully when backend is unavailable.

**Patterns:**
- file-explorer: WebSocket errors caught → falls back to mock data with "Offline" banner → retry button available (`file-explorer.js:125-145`)
- phreak-terminal: EPO connection failure → falls back to `_simulateCommand()` with built-in commands (`phreak-terminal.js:87-90`)
- void-engine: No explicit error handling — pretext calls are assumed to succeed; `document.fonts.ready` awaited before layout (`void-engine.js:150`)

## Cross-Cutting Concerns

**Logging:** `console.info('[st8] ...')` for panel events, `console.warn` for settings failures. No structured logging framework.

**Validation:** No input validation on terminal commands (passed directly to backend). File paths validated only by the server.

**Authentication:** None. Single-user local application.

**Accessibility:** `aria-pressed` on dock buttons, `aria-modal` and `aria-label` on panel overlays, `prefers-reduced-motion` media query disables animations (`st8.html:129-131`, `st8.html:652-654`).

---

*Architecture analysis: 2026-05-11*
