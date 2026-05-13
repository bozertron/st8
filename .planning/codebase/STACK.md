# Technology Stack

**Analysis Date:** 2026-05-11

## Languages

**Primary:**
- JavaScript (ES2020+) — All application logic (`void-engine.js`, `file-explorer.js`, `phreak-terminal.js`, `settings-reader.js`, `fake-stream.js`)
- HTML5 — Single-page application shell (`st8.html`, `void-engine.html`)
- CSS3 — Inline styles in HTML, design tokens via CSS custom properties

**Secondary:**
- None — No TypeScript, no build step, no transpilation

## Runtime

**Environment:**
- Browser (ES Modules with `type="module"` script tags)
- No Node.js runtime required
- No server-side code in this repository

**Package Manager:**
- None — Zero npm/yarn/pnpm dependencies
- No `package.json` present
- No lockfile

## Frameworks

**Core:**
- None (vanilla JS) — No framework; raw DOM manipulation
- `@chenglou/pretext@0.0.6` — DOM-free text measurement and layout engine loaded via ESM CDN (`https://esm.sh/@chenglou/pretext@0.0.6`)

**Testing:**
- None — No test framework configured, no test files present

**Build/Dev:**
- None — No build step; files served directly to browser

## Key Dependencies

**Critical:**
- `@chenglou/pretext@0.0.6` — The core text layout engine; provides `prepareWithSegments`, `layoutWithLines`, `layoutNextLine`, `walkLineRanges` functions. Enables real-time text reflow around obstacles without DOM measurements. Imported in `void-engine.js:2-7`.

**Infrastructure:**
- None — Zero external runtime dependencies beyond pretext

## Custom Fonts

**Bundled (local `.ttf` files):**
- `fonts/Monoton-Regular.ttf` (51KB) — Display font for "st8" brand mark
- `fonts/PoiretOne-Regular.ttf` (48KB) — Primary UI font (body, navigation, terminal prompt)

**Font Loading:**
- `@font-face` declarations in `st8.html:10-19`
- `font-display: swap` used for both fonts
- `document.fonts.ready` awaited in `void-engine.js:150` before layout

## Configuration

**Environment:**
- No `.env` files present
- No environment variables required for standalone operation
- Optional: `window.actu8Config` object for workspace path override (`file-explorer.js:43`)

**Build:**
- No build configuration files
- No bundler (Webpack, Vite, Rollup, esbuild)
- No transpiler (Babel, SWC)

**Runtime Config:**
- `settings-reader.js` — Schema-driven settings with `localStorage` adapter
- Storage key: `st8.settings.v1` in localStorage
- Default settings in `DEFAULT_VOIDFLOW` object (`settings-reader.js:17-25`)
- Categories: `voidflow`, `sirkits`, `models`, `shells`

## Platform Requirements

**Development:**
- Any static file server (or `file://` protocol)
- Modern browser with ES Module support
- No build tools, no Node.js, no npm

**Production:**
- Static file hosting (any web server)
- No server-side processing required for standalone mode
- Optional: EPO WebSocket bus connection for live features (file system, terminal execution, signals)

## CSS Design Tokens

**Color Palette (defined in `st8.html:22-27`):**
```css
--void:   #0A0A0B    /* Background */
--text:   #E0E0E0    /* Primary text */
--gold:   #D4AF37    /* Brand/accent (st8 mark, system messages) */
--cyan:   #1FBDEA    /* Interactive/active (links, cursor, selected) */
--pink:   #C9748F    /* Borders, errors, panel chrome */
```

**Spacing Scale (defined in `st8.html:28-35`):**
```css
--space-1:  4px
--space-2:  8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-7: 32px
```

## Script Loading Order

**In `st8.html`:**
1. Inline `<style>` block (all CSS)
2. `vendor/void-engine.js` — `<script type="module">` (ESM, loads pretext from CDN)
3. Inline `escapeHtml` utility script
4. `file-explorer.js` — `<script>` (classic, exposes `window.VoidFileExplorer`)
5. `phreak-terminal.js` — `<script>` (classic, exposes `window.PhreakTerminal`)
6. Inline panel controller script

**Note:** `void-engine.js` uses ES modules (`import`); `file-explorer.js` and `phreak-terminal.js` use classic scripts with `window.*` global API pattern.

---

*Stack analysis: 2026-05-11*
