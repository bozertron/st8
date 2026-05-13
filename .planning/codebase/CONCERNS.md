# Codebase Concerns

**Analysis Date:** 2026-05-11

## Tech Debt

**Broken script path — void-engine fails to load:**
- Issue: `st8.html:702` references `vendor/void-engine.js` but the `vendor/` directory does not exist. The actual file lives at `void-engine.js` (project root). Opening `st8.html` in a browser silently fails to load the drift surface.
- Files: `st8.html:702`, `void-engine.js`
- Impact: The entire void/drift surface (the primary visual feature) is non-functional when served as-is. Only works if someone manually creates a `vendor/` symlink or moves the file.
- Fix approach: Change `st8.html:702` from `src="vendor/void-engine.js"` to `src="void-engine.js"`, or create the `vendor/` directory and move `void-engine.js` into it.

**Undefined variable `LS_SHOW_HIDDEN`:**
- Issue: `file-explorer.js:195` references `LS_SHOW_HIDDEN` which is never defined in the file. The `.archive/Reference Files/file-explorer.js:38` defines it as `const LS_SHOW_HIDDEN = 'void_explorer_showHidden';` but the definition was stripped during a refactor.
- Files: `file-explorer.js:195`
- Impact: `_toggleHidden()` throws a `ReferenceError` if called. The hidden-files toggle is broken.
- Fix approach: Add `const LS_SHOW_HIDDEN = 'void_explorer_showHidden';` near the top of `file-explorer.js` (after line 17).

**Dead code — unreachable status message in `togglePhoneOffHook`:**
- Issue: `phreak-terminal.js:649-659` — the function has `return;` on line 652, making lines 654-658 (the status message push and render) unreachable dead code.
- Files: `phreak-terminal.js:649-659`
- Impact: Toggling phone off-hook never shows a status message in the terminal output. The icon updates but the user gets no textual feedback.
- Fix approach: Either remove the dead code after `return;`, or remove the `return;` to restore the status message behavior.

**Dead code — disabled welcome message:**
- Issue: `phreak-terminal.js:778` uses `if (false && phreakState.lines.length === 0)` — the welcome message seeding is disabled via a hardcoded `false` guard.
- Files: `phreak-terminal.js:778-782`
- Impact: The terminal starts completely blank. No hint that it's a terminal or what commands are available. New users see an empty black panel.
- Fix approach: Either remove the dead block entirely, or re-enable it by removing `false &&`.

**Duplicate `getState` in public API:**
- Issue: `phreak-terminal.js:858` defines `getState` returning 3 fields (`isTUI`, `phoneOffHook`, `lineCount`). `phreak-terminal.js:888` redefines `getState` returning 6 fields (adds `historyCount`, `isExecuting`, `signalCount`). The second silently overwrites the first.
- Files: `phreak-terminal.js:858`, `phreak-terminal.js:888`
- Impact: The first `getState` is dead code. Any code expecting the 3-field version gets the 6-field version instead. Not a runtime error, but confusing and indicates a botched merge.
- Fix approach: Remove the first `getState` definition at line 858.

**Unused modules — `settings-reader.js` and `fake-stream.js`:**
- Issue: Neither file is loaded by `st8.html` or referenced by any other module. They exist as standalone ES module files with no consumers.
- Files: `settings-reader.js`, `fake-stream.js`
- Impact: Dead code in the repo. `settings-reader.js` provides a `SettingsReader` class with localStorage persistence that nothing uses. `fake-stream.js` provides a `FakeStream` class for demo mode that nothing consumes.
- Fix approach: Either wire them into `st8.html` via `<script type="module">` imports, or move them to `.archive/`.

**Inline CSS monolith:**
- Issue: `st8.html` contains ~600 lines of inline CSS (lines 8-655). All styles for void, dock, file-explorer, phreak-terminal, TUI overlay, signal popups, and virtual scroll are in a single `<style>` block.
- Files: `st8.html:8-655`
- Impact: Impossible to maintain styles independently. Any CSS change requires editing the 833-line HTML file. No CSS modules, no scoping, high collision risk as new panels are added.
- Fix approach: Extract CSS into separate files: `void.css`, `explorer.css`, `phreak-terminal.css`, `dock.css`.

## Known Bugs

**File explorer navigates to `~` but tilde expansion is fragile:**
- Symptoms: `_getBreadcrumbs()` at `file-explorer.js:64-77` tries to expand `~` using `window.actu8Config.homeDir` but falls back to `'~'` as a literal string. If `actu8Config` is not set, breadcrumbs show `~` as a literal path component rather than the home directory.
- Files: `file-explorer.js:41-48`, `file-explorer.js:64-77`
- Trigger: Opening the file explorer without `window.actu8Config` set (the default standalone case).
- Workaround: The mock data at `file-explorer.js:180-188` only covers the `~` path, so navigation appears to work for the root but fails for any subdirectory.

**Phreak terminal simulation is incomplete:**
- Symptoms: `_simulateCommand()` at `phreak-terminal.js:99-136` only handles 6 commands (`ls`, `pwd`, `whoami`, `date`, `echo`, `clear`, `help`). All other commands return "command not found (bridge offline)".
- Files: `phreak-terminal.js:99-136`
- Trigger: Any command not in the hardcoded list (e.g., `cat`, `grep`, `cd`, `git`).
- Workaround: None — this is by design for the simulation fallback, but it makes the terminal feel broken in standalone mode.

## Security Considerations

**No input sanitization on terminal commands:**
- Risk: `phreakExecute()` at `phreak-terminal.js:47-97` sends raw user input to `window.epoClient.request('exec', { command: cmd })`. If the EPO bus forwards this to a real shell, arbitrary command injection is possible.
- Files: `phreak-terminal.js:47-97`
- Current mitigation: The EPO bus doesn't exist in standalone mode, so the simulation fallback is safe. But if `epoClient` is ever connected to a real backend, this becomes a critical injection vector.
- Recommendations: Add command allowlisting or escaping before sending to the backend.

**XSS via `escapeHtml` global:**
- Risk: `st8.html:706-710` defines `window.escapeHtml()` which is used by `file-explorer.js` for rendering file names/paths. However, `phreak-terminal.js:276-282` defines its own `_escapeHtml()`. If either implementation has a gap, XSS is possible through crafted file names.
- Files: `st8.html:706-710`, `phreak-terminal.js:276-282`
- Current mitigation: Both implementations look correct, but the duplication is a maintenance risk.
- Recommendations: Consolidate into a single shared utility.

## Performance Bottlenecks

**No virtualization for large terminal output:**
- Problem: `phreak-terminal.js:225-243` uses append-only rendering (`insertAdjacentHTML`) for new lines, but `_fullRender()` at line 247 rebuilds the entire output HTML. After thousands of lines, full re-renders (triggered by clear, TUI toggle, remount) become slow.
- Files: `phreak-terminal.js:225-256`
- Cause: No DOM recycling or virtual scrolling for terminal output. Every line stays in the DOM forever.
- Improvement path: Implement a line buffer with a maximum visible window (similar to the file explorer's virtual scroll at `file-explorer.js:256-437`).

## Fragile Areas

**Panel controller inline script:**
- Files: `st8.html:715-831`
- Why fragile: 116 lines of inline JavaScript managing panel open/close/mount/escape logic. Uses `window.VoidFileExplorer` and `window.PhreakTerminal` globals that must be loaded in exact script order. Any script load failure breaks the entire panel system.
- Safe modification: Avoid editing the inline script. Extract to a separate `panel-controller.js` file and add null checks before accessing panel APIs.
- Test coverage: None.

**EPO bus dependency pattern:**
- Files: `file-explorer.js:156-168`, `phreak-terminal.js:69-90`, `phreak-terminal.js:686-726`
- Why fragile: Both modules assume `window.epoClient` may or may not exist. The pattern `if (window.epoClient && window.epoClient.connected)` is repeated 8+ times across both files. If the EPO client API changes, every occurrence must be updated.
- Safe modification: Create a thin wrapper module (`epo-bridge.js`) that provides a consistent API and handles the "not connected" case once.
- Test coverage: None.

## Scaling Limits

**No backend — entire proposal is unimplemented:**
- Current capacity: The application is a UI shell with 3 panels (void, file explorer, phreak terminal). The file explorer shows mock data. The terminal simulates 6 commands. The void surface starts empty.
- Limit: The `.planning/` directory contains ~1,500 lines of detailed proposals (`st8-bootstrap-proposal.md`, `st8-technical-reference.md`, `st8-DELIVERABLE-SUMMARY.md`) describing a complete connection-tracking system. **None of this is implemented.**
- Scaling path: The proposals specify:
  - `backend/` directory with 7 TypeScript files (indexer, graphBuilder, persistence, fileWatcher, manifestGenerator, server, types)
  - SQLite database via `better-sqlite3`
  - File watching via `chokidar`
  - HTTP server via `express`
  - `connection-tracker.html` dashboard
  - `ai-signal.toml` manifest
  - `package.json` with 6 dependencies
  - `tsconfig.json`
  - All of these are missing. The gap is total.

## Dependencies at Risk

**`@chenglou/pretext@0.0.6` via ESM CDN:**
- Risk: `void-engine.js:7` imports from `https://esm.sh/@chenglou/pretext@0.0.6`. This is an external CDN dependency pinned to a pre-release version (`0.0.6`). If esm.sh goes down or the package is unpublished, the void surface breaks.
- Impact: The entire text layout engine (pretext) is the core differentiator. Without it, the void is just a black screen.
- Migration plan: Vendor the pretext library locally (the `.archive/Reference Files/pretext-main/` directory contains the full source). Build and bundle it as the HANDOFF document describes.

**`window.epoClient` (does not exist):**
- Risk: Both `file-explorer.js` and `phreak-terminal.js` depend on `window.epoClient` for all real functionality (file listing, command execution, signal bus). This object does not exist in the codebase.
- Impact: All real I/O falls back to simulation mode. The file explorer shows 2 mock entries. The terminal handles 6 hardcoded commands.
- Migration plan: Either implement an EPO client module, or redesign the I/O layer to work without it (direct filesystem API, fetch to a local server, etc.).

## Missing Critical Features

**No `package.json`:**
- Problem: Cannot install dependencies, define scripts, or manage versions. The project has no package management at all.
- Blocks: Cannot add `better-sqlite3`, `chokidar`, `@babel/parser`, `fast-glob`, `express`, or any other dependency specified in the bootstrap proposal.

**No `tsconfig.json`:**
- Problem: Cannot compile TypeScript. The technical reference provides all code in TypeScript, but there's no compilation pipeline.
- Blocks: Cannot implement any of the backend code from the proposals without first setting up a build system.

**No `connection-tracker.html`:**
- Problem: The bootstrap proposal specifies a standalone HTML dashboard for viewing file connection status (GREEN/YELLOW/RED).
- Blocks: The core user-facing feature of st8 (connection tracking visualization) does not exist.

**No `backend/` directory:**
- Problem: The proposal specifies 7 files in `st8/backend/` — none exist.
- Blocks: Indexer, graph builder, persistence, file watcher, manifest generator, server — all missing.

**No `README.md`:**
- Problem: No documentation for what st8 is, how to run it, or what its current state is.
- Blocks: Onboarding. A new developer opening this repo has no idea what it does or how to use it.

**No `.gitignore`:**
- Problem: No `.gitignore` file. Snapshots, archive, and `.planning/` may be committed without filtering.
- Blocks: Clean git history. Potential accidental commit of large snapshot files.

## Test Coverage Gaps

**Zero tests exist:**
- What's not tested: Everything. No unit tests, no integration tests, no E2E tests. No test framework configured.
- Files: All source files are untested.
- Risk: Any change to `file-explorer.js` (495 lines), `phreak-terminal.js` (899 lines), or `void-engine.js` (338 lines) could break existing functionality with no automated detection.
- Priority: High — the codebase has complex state management (panel controller, virtual scroll, signal framework, phone toggle, TUI mode) that is impossible to refactor safely without tests.

**Specific untested behaviors:**
- Panel open/close/escape logic (`st8.html:715-831`)
- Virtual scroll rendering (`file-explorer.js:256-437`)
- Signal popup lifecycle (`phreak-terminal.js:404-492`)
- TUI mode enter/exit (`phreak-terminal.js:496-602`)
- Command history navigation (`phreak-terminal.js:304-353`)
- EPO bus listener wiring (`phreak-terminal.js:686-733`)

---

*Concerns audit: 2026-05-11*
