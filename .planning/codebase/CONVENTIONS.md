# Coding Conventions

**Analysis Date:** 2026-05-11

## Project Type

Vanilla HTML/JS application with no build system, no package manager, no bundler. Files are loaded directly via `<script>` tags and `<script type="module">` in `st8.html`.

## Module System

**Mixed — two patterns coexist:**

**ES Modules (import/export):**
- Used by: `void-engine.js`, `settings-reader.js`, `fake-stream.js`
- Loaded via: `<script type="module" src="...">`
- Example from `void-engine.js`:
  ```js
  import {
    prepareWithSegments,
    layoutWithLines,
    layoutNextLine,
    walkLineRanges
  } from "https://esm.sh/@chenglou/pretext@0.0.6";
  ```
- Example from `settings-reader.js`:
  ```js
  export class SettingsReader { ... }
  export { LocalStorageAdapter, MemoryAdapter };
  ```

**Classic Scripts (window globals):**
- Used by: `file-explorer.js`, `phreak-terminal.js`
- Loaded via: `<script src="...">`
- Public API exposed on `window`:
  ```js
  if (typeof window !== 'undefined') {
      window.VoidFileExplorer = { ... };
  }
  ```
- Always guard with `typeof window !== 'undefined'` check

**When adding new modules:**
- Use ES module syntax (`import`/`export`) if the file is self-contained or imports from CDN
- Use classic script + `window` global if the module must be accessible from inline `<script>` blocks in `st8.html`
- Never mix both patterns in a single file

## Naming Patterns

**Files:**
- kebab-case: `file-explorer.js`, `phreak-terminal.js`, `void-engine.js`, `settings-reader.js`, `fake-stream.js`
- HTML files match their primary JS: `void-engine.html`, `st8.html`

**Functions:**
- Public functions: camelCase — `phreakExecute`, `explorerNavigate`, `toggleTUI`
- Private/internal functions: underscore prefix — `_renderLines`, `_buildLineHTML`, `_escapeHtml`, `_tryMediaCommand`, `_fetchViaWebSocket`
- Event handlers: `_handle` prefix — `_handleInputKeydown`, `_handleOutputClick`, `_handleRowClick`

**Variables/Constants:**
- Module-level constants: UPPER_SNAKE_CASE — `BODY_FONT`, `BODY_LINE_HEIGHT`, `GUTTER`, `COL_GAP`, `VIRTUAL_SCROLL_THRESHOLD`, `ROW_HEIGHT`
- Configuration constants: UPPER_SNAKE_CASE — `PHREAK_API`, `TOKEN_RATE_HZ`, `JITTER_MS`
- State objects: camelCase — `phreakState`, `explorerState`, `_virtualScroll`
- CSS custom properties: kebab-case with prefix — `--void`, `--text`, `--gold`, `--cyan`, `--pink`, `--space-1`

**Classes:**
- PascalCase: `SettingsReader`, `LocalStorageAdapter`, `MemoryAdapter`, `FakeStream`

**CSS Classes:**
- Component-prefixed BEM-like: `phreak-line`, `phreak-line--input`, `phreak-copy-btn`, `explorer-file-row`, `explorer-nav-item`
- State classes: `selected`, `open`, `visible`, `active`, `phreak-phone--offhook`
- Modifiers use double dash: `phreak-line--stdout`, `phreak-line--stderr`, `crumb-btn--last`

## Code Style

**Formatting:**
- No linter or formatter configured (no `.eslintrc`, `.prettierrc`, or `biome.json`)
- 4-space indentation in `void-engine.js` (ES module)
- 4-space indentation in `file-explorer.js` and `phreak-terminal.js` (classic scripts)
- `settings-reader.js` and `fake-stream.js` use 2-space indentation
- **Prescriptive: Use 4-space indentation for new files** (matches majority of codebase)

**Semicolons:**
- Always use semicolons — all files terminate statements with `;`

**Quotes:**
- Single quotes for JS strings: `'use strict'`, `'explorer-root'`
- Template literals for HTML building and string interpolation
- Double quotes in HTML attributes

**Variable Declarations:**
- `const` for bindings that don't reassign (preferred)
- `let` for mutable bindings
- `var` appears in older code (`phreak-terminal.js`) — **do not use `var` in new code**

**Arrow Functions vs Function Declarations:**
- Function declarations for named functions: `function phreakExecute(cmd) { ... }`
- Arrow functions in callbacks and short handlers: `e => togglePanel('explorer')`
- `function` keyword for object methods and event handlers

## Import Organization

**ES Module imports:**
1. External CDN imports first (`https://esm.sh/...`)
2. No local module imports currently (each file is standalone)

**Classic script dependencies:**
- `st8.html` defines `window.escapeHtml` globally before loading `file-explorer.js` and `phreak-terminal.js`
- `void-engine.js` is loaded as a module and operates independently on `#stage`
- Dependencies are implicit via `window` globals — no import mechanism

## Error Handling

**Patterns:**
- Try/catch with fallback for async operations:
  ```js
  try {
      entries = await _fetchViaWebSocket(path);
  } catch (err) {
      // Smart fallback: only use mock if it's a network/connectivity error
      const isNetworkError = _isNetworkError(err);
      const mock = _mockEntries(path);
      if (isNetworkError && mock !== null) {
          entries = mock;
          explorerState.error = { message: 'Offline — showing cached data', canRetry: true };
      }
  }
  ```
- Error state stored in component state objects: `explorerState.error = { message, canRetry }`
- Error UI rendered inline with retry button
- Silent catch for non-critical failures: `catch (e) { /* ignore */ }`
- Console.warn for operational warnings: `console.warn('[st8.settings] write failed', e);`

**Error display:**
- Terminal: errors shown as `stderr` line type (pink color)
- File explorer: error banner with retry button
- Never silently swallow errors that affect user-visible state

## Logging

**Framework:** `console` only (no logging library)

**Patterns:**
- `console.info('[st8] selected:', paths)` — user actions
- `console.warn('[st8.settings] write failed', e)` — operational warnings
- Prefix with `[st8]` or `[st8.settings]` for grep-ability

## DOM Manipulation

**HTML Building:**
- Template literals with `${expression}` for dynamic content
- `_buildLineHTML(line)` returns HTML string, inserted via `insertAdjacentHTML('beforeend', fragment)`
- Full re-renders via `element.innerHTML = htmlString`
- **Always escape user content** with `_escapeHtml()` before inserting into HTML

**Element Creation:**
- `document.createElement` for interactive elements (popups, cursor, rects)
- Template literals for static/repeated content (table rows, line items)

**Event Handling:**
- Event delegation preferred over per-element listeners
- `data-action` attributes for delegated click handling:
  ```js
  output.addEventListener('click', function(e) {
      var copyBtn = e.target.closest('.phreak-copy-btn');
      if (!copyBtn) return;
      // handle
  });
  ```
- `data-*` attributes for element metadata: `data-line-id`, `data-path`, `data-is-dir`, `data-action`, `data-panel`, `data-close`
- `onclick` attributes used in template-literal HTML (file-explorer) — acceptable for generated content

## State Management

**Pattern:** Module-level state objects (singletons)
```js
const phreakState = {
    lines: [],
    history: [],
    historyIndex: -1,
    isExecuting: false,
    // ...
};
```

- Each component owns its state object at module scope
- No shared state between components
- State mutations happen directly: `phreakState.lines.push(line)`
- No reactive framework — manual DOM updates after state changes
- Settings use observer pattern: `st8Settings.on('change', cb)`

## CSS Design Tokens

**Defined in `:root` in `st8.html`:**
```css
:root {
    --void:   #0A0A0B;     /* Background */
    --text:   #E0E0E0;     /* Primary text */
    --gold:   #D4AF37;     /* Accent (st8 mark, system messages) */
    --cyan:   #1FBDEA;     /* Interactive elements, prompts, links */
    --pink:   #C9748F;     /* Borders, errors, secondary accent */

    --space-1:  4px;       /* Spacing scale */
    --space-2:  8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-7: 32px;
}
```

**Prescriptive:**
- Use `var(--void)` for backgrounds, `var(--text)` for text color
- Use `var(--cyan)` for interactive/hover states and terminal prompts
- Use `var(--pink)` for borders, errors, and secondary accents
- Use `var(--gold)` for branding (st8 mark) and system messages
- Use `var(--space-N)` for spacing (4px increments)
- Hardcode colors only for subtle variations (e.g., `rgba(31, 189, 234, 0.18)` for hover backgrounds)

**Typography:**
- Display/branding: `'Monoton', cursive` (st8 mark only)
- UI text: `'Poiret One', system-ui, sans-serif` (headings, labels, explorer)
- Terminal: `'Courier New', ui-monospace, monospace` (phreak terminal)
- Body/reading: `"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif` (void-engine text)

**Font loading:**
- Custom fonts via `@font-face` with `font-display: swap`
- Font files in `fonts/` directory: `Monoton-Regular.ttf`, `PoiretOne-Regular.ttf`
- void-engine loads fonts via `document.fonts.ready` before layout

## Accessibility

**Patterns observed:**
- `aria-label` on buttons: `aria-label="Open file explorer"`
- `aria-pressed` for toggle buttons: `aria-pressed="false"`
- `aria-hidden="true"` on decorative elements
- `role="dialog"` and `aria-modal="true"` on panel overlays
- `prefers-reduced-motion` media query disables animations

## Panel/Overlay Architecture

**Pattern:**
1. Panel overlay in HTML: `<div class="panel-overlay" id="overlay-{name}">`
2. Mount point inside: `<div class="panel-body" id="{name}-host">`
3. JS mounts component into host on first open (lazy)
4. Open/close via CSS class `open` on overlay
5. Escape key closes all open panels
6. Click outside panel frame closes overlay

**When adding a new panel:**
1. Add overlay HTML to `st8.html` following existing pattern
2. Add button to dock
3. Add entry to `panels` object in inline `<script>`
4. Create JS module with `mount(panelBodyEl, ...)` function
5. Expose public API on `window.ModuleName`

## Security

**XSS Prevention:**
- All user content escaped via `_escapeHtml()` before HTML insertion
- `window.escapeHtml` defined globally in `st8.html` for shared use
- `_escapeHtml` also defined locally in `phreak-terminal.js`

**Input Sanitization:**
- Terminal input treated as text, not HTML
- File paths escaped before insertion into HTML attributes

---

*Convention analysis: 2026-05-11*
