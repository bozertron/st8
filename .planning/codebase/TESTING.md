# Testing Patterns

**Analysis Date:** 2026-05-11

## Test Framework

**Runner:**
- No test framework configured for the active codebase
- No `package.json`, `jest.config.*`, `vitest.config.*`, or any test runner present
- The only test file found is in archived reference code: `.archive/Reference Files/pretext-main/src/layout.test.ts` (not part of st8)

**Assertion Library:**
- None

**Run Commands:**
```bash
# No test commands available
# No package.json scripts section exists
```

## Test File Organization

**Location:**
- No test files exist in the active codebase
- No `test/`, `tests/`, `__tests__/`, or `spec/` directories

**Naming:**
- Not applicable — no testing infrastructure

## Current Testing Approach

**Manual testing only.** The application is tested by:
1. Opening `st8.html` in a browser
2. Interacting with the void surface (typing, dragging sirkit rectangles)
3. Opening the file explorer panel and navigating directories
4. Opening the phreak terminal and running commands
5. Verifying visual output matches expectations

**No automated tests, no CI, no test coverage tracking.**

## Testability Assessment

**What CAN be tested (unit-testable without DOM):**

- `settings-reader.js` — Pure data logic, localStorage adapter can be swapped for `MemoryAdapter`
  - File: `settings-reader.js`
  - Testable: `set()`, `upsertRow()`, `removeRow()`, `reset()`, `export()`, event emission
  - Already has `MemoryAdapter` for test isolation

- `fake-stream.js` — Stream simulation with injectable engine
  - File: `fake-stream.js`
  - Testable: token emission timing, pause/resume, script cycling
  - Constructor accepts engine dependency — testable with mock engine

- `void-engine.js` — Layout math functions
  - File: `void-engine.js`
  - Testable: `carveTextLineSlots()`, `circleIntervalForBand()` — pure geometry functions
  - Requires: canvas API mock for `measureText` (or Node.js canvas)

**What is HARD to test (requires DOM/browser):**

- `file-explorer.js` — Heavy DOM manipulation, WebSocket dependency
  - File: `file-explorer.js`
  - Challenge: `_renderExplorer()` builds full HTML via `innerHTML`, virtual scroll depends on DOM measurements
  - Would require: JSDOM or Playwright, WebSocket mock

- `phreak-terminal.js` — DOM rendering, event delegation, EPO bus integration
  - File: `phreak-terminal.js`
  - Challenge: `_renderLines()` manipulates DOM directly, signal popups depend on DOM timing
  - Would require: JSDOM or Playwright, EPO client mock

- `st8.html` inline scripts — Panel controller, event wiring
  - File: `st8.html` (lines 715-831)
  - Challenge: Inline scripts, no module boundary, tight DOM coupling

## Recommended Testing Strategy (If Implemented)

**Tier 1 — Unit tests (Node.js, no DOM):**
```javascript
// settings-reader.test.js — use MemoryAdapter
const { SettingsReader, MemoryAdapter } = require('./settings-reader.js');
const settings = new SettingsReader({ storage: new MemoryAdapter() });
// Test set/get, event emission, reset
```

**Tier 2 — Pure function tests (Node.js):**
```javascript
// void-engine-math.test.js
const { carveTextLineSlots, circleIntervalForBand } = require('./void-engine.js');
// Test geometry calculations with known inputs/outputs
```

**Tier 3 — Integration tests (Playwright):**
```javascript
// st8.spec.js
test('typing adds text to void', async ({ page }) => {
    await page.goto('st8.html');
    await page.keyboard.type('hello');
    // Assert text appears in #stage
});
```

## Mocking Patterns

**No existing mocks.** If testing were added:

**WebSocket/EPO mock:**
```javascript
// Mock window.epoClient for file-explorer and phreak-terminal
window.epoClient = {
    connected: true,
    request: async (type, data) => { return mockResponse; },
    listen: (cb) => { /* store cb for test injection */ return () => {}; },
};
```

**localStorage mock (for settings-reader):**
```javascript
// Already built in — use MemoryAdapter
const { SettingsReader, MemoryAdapter } = require('./settings-reader.js');
const settings = new SettingsReader({ storage: new MemoryAdapter() });
```

**Canvas mock (for void-engine):**
```javascript
// Mock measureText for layout calculations
global.document = {
    fonts: { ready: Promise.resolve() },
    getElementById: () => ({ clientWidth: 1200, clientHeight: 800, appendChild: () => {} }),
    createElement: () => ({ className: '', textContent: '', appendChild: () => {} }),
};
```

## Coverage

**Requirements:** None enforced

**Current coverage:** 0% — no tests exist

**Priority gaps:**
1. `settings-reader.js` — Easiest to test, already has testable design
2. `void-engine.js` geometry functions — Pure math, high value
3. `file-explorer.js` error handling and fallback logic — Critical for offline use

## Test Data

**Fixtures:**
- No test fixtures exist
- `fake-stream.js` contains hardcoded demo scripts (`SCRIPTS` array) that could serve as test data
- `file-explorer.js` has `_mockEntries()` for offline fallback — reusable as test fixture

**Location:**
- Not applicable — no test infrastructure

## CI/CD

**Pipeline:** None

**No automated checks:**
- No linting (no ESLint/Prettier/Biome config)
- No type checking (no TypeScript in active code)
- No build step (vanilla JS, no compilation)
- No test runner
- No deployment pipeline

---

*Testing analysis: 2026-05-11*
