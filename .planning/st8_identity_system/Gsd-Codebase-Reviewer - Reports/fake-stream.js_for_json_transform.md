# Deep-Dive Analysis: `fake-stream.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/fake-stream.js`
**Lines:** 96 total
**Source:** Native ES module (not compiled)
**Purpose:** Synthetic LLM stream emitter for Phase A demos — fakes streaming chat responses to DriftEngine without any real provider wiring

---

## Lines 1-11: Module Header & JSDoc Comment
```javascript
/**
 * vendor/fake-stream.js
 *
 * Synthetic LLM stream emitter for Phase A demos.
 * Feeds DriftEngine.pushTokens(role, text) at realistic rates so the
 * void *feels* like a chat — without any provider wiring.
 *
 * Each "turn" emits tokens at ~60 tok/sec with mild jitter, which is faster
 * than the configured reveal WPM, so the buffer trail visibly grows during
 * generation and drains as the user reads.
 */
```

- **What triggers it:** Module load (comment only)
- **What it calls:** Nothing
- **What calls it:** Every module that imports this file
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** The comment header says `vendor/fake-stream.js` but the actual file path is the project root `/home/bozertron/1_AT_A_TIME/st8/fake-stream.js`. The comment is stale — the file was likely moved out of `vendor/` during refactoring and the header was never updated.

---

## Lines 13-14: Token Rate & Jitter Constants
```javascript
const TOKEN_RATE_HZ = 60;
const JITTER_MS = 25;
```

- **What triggers it:** Module load (constant declaration)
- **What it calls:** Nothing
- **What calls it:** `_emitTurn()` on lines 82 and 91
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. `TOKEN_RATE_HZ = 60` means 60 tokens/sec = ~16.67ms per token. `JITTER_MS = 25` means ±12.5ms random jitter. Combined delay range: ~4.17ms to ~29.17ms per token. This is realistic LLM streaming behavior.

---

## Lines 16-39: `SCRIPTS` — Pre-written Demo Conversation
```javascript
const SCRIPTS = [
  {
    role: 'system',
    text: 'st8 / sirkits — phase A drift surface online. type from the line.',
  },
  {
    role: 'user',
    text: 'okay show me what this thing can do.',
  },
  {
    role: 'assistant',
    text: 'sure. words enter from the cyan line and rise through the void at reading pace. the cursor pulses on each reveal tick — that is the conversation\'s heartbeat. when the model is ahead of you, a faint trail of dots extends from the cursor showing how many words are queued. when the model stalls, the trail thins. the void shows you what the model is doing.',
  },
  {
    role: 'user',
    text: 'and the obstacles?',
  },
  {
    role: 'assistant',
    text: 'sirkits sit anywhere in the void. drifting prose wraps around them via pretext — line by line, in real time, no flicker. drag a sirkit and the reveal queue pauses; release it and the prose resumes against the new geometry. this is the foundation. file explorers, terminals, music embeds, images — every spawnable surface plugs into this same drift field as another rect. one mental model, no chrome, no boxes, just a line and a void.',
  },
];
```

- **What triggers it:** Module load (constant declaration)
- **What it calls:** Nothing
- **What calls it:** `FakeStream` constructor on line 42 (as default value for `scripts` parameter)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** This is a hardcoded 5-turn demo conversation. The roles include `system`, `user`, and `assistant` in a realistic chat flow. The `system` turn (line 17-19) is unusual — in real LLM APIs, system messages are typically not "streamed" to the UI. If `engine.pushTokens('system', ...)` displays system messages in the void, this will render the system prompt visibly, which may or may not be intentional.

---

## Lines 41-49: `FakeStream` Class — Constructor
```javascript
export class FakeStream {
  constructor(engine, { scripts = SCRIPTS, betweenTurnsMs = 1200 } = {}) {
    this.engine = engine;
    this.scripts = scripts;
    this.betweenTurnsMs = betweenTurnsMs;
    this._stopped = false;
    this._paused  = false;
    this._idx = 0;
  }
```

- **What triggers it:** `new FakeStream(engine, options?)` from an importing module
- **What it calls:** Nothing (initialization only)
- **What calls it:** **NOTHING IN THE CURRENT CODEBASE.** No file imports `fake-stream.js`. The `DriftEngine` class referenced in the JSDoc (line 5) does not exist anywhere in the project. The `vendor/drift-engine.js` file referenced in the Phase A handoff doc (`snapshots/v1-pre-pretext/HANDOFF-phase-a-v2.md` line 284) does not exist.
- **Dependencies:** Requires an `engine` object with `.pushTokens(role, text)` and `.endTurn()` methods
- **Status:** 🔴 **NOT CONNECTED — DEAD CODE**
- **Gap:** This class is **exported but never imported**. The `engine` parameter expects a `DriftEngine` instance that was planned but never implemented in the current codebase. The class is entirely orphaned.

### Constructor Parameters Detail
| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `engine` | Object with `pushTokens()` and `endTurn()` | (required) | The target engine to feed tokens into |
| `scripts` | Array of `{role, text}` | `SCRIPTS` (lines 16-39) | The conversation turns to play |
| `betweenTurnsMs` | Number | `1200` | Delay between conversation turns in ms |

---

## Lines 51-54: `start()` Method
```javascript
  start() {
    if (this._stopped) return;
    this._runNext();
  }
```

- **What triggers it:** External call — `fakeStream.start()`
- **What it calls:** `_runNext()` (line 60)
- **What calls it:** Nothing in current codebase (class is not imported)
- **Dependencies:** `_runNext()` method
- **Status:** 🔴 **NOT CONNECTED**
- **Gap:** If `start()` is called after `stop()` has been called, it silently does nothing. There is no way to restart a stopped stream — `_stopped` is never reset to `false`. This is a design limitation: once stopped, the instance is permanently dead.

---

## Lines 56-58: `stop()`, `pause()`, `resume()` Methods
```javascript
  stop()   { this._stopped = true; }
  pause()  { this._paused  = true; }
  resume() { if (!this._paused) return; this._paused = false; if (!this._stopped) this._runNext(); }
```

- **What triggers it:** External calls
- **What it calls:** `stop()` sets `_stopped`; `pause()` sets `_paused`; `resume()` calls `_runNext()` (line 60)
- **What calls it:** Nothing in current codebase
- **Dependencies:** `_runNext()` method
- **Status:** 🔴 **NOT CONNECTED**
- **Gap:**
  - `stop()` is irreversible — no `restart()` method exists
  - `resume()` has a guard: `if (!this._paused) return` — calling resume when not paused is a no-op. But calling resume after stop also does nothing (checks `!this._stopped`). This is correct behavior.
  - `resume()` calls `_runNext()` which will pick up from `this._idx` — so it continues where it left off. However, if the stream was paused *mid-token-emit* (inside `_emitTurn`), the pause is only checked at the next token iteration (line 86), not immediately. The in-flight `_emitTurn` continues until it hits the pause check.

---

## Lines 60-71: `_runNext()` — Turn Scheduler
```javascript
  _runNext() {
    if (this._stopped || this._paused) return;
    if (this._idx >= this.scripts.length) {
      // Loop back to start after a longer pause.
      setTimeout(() => { this._idx = 0; this._runNext(); }, this.betweenTurnsMs * 4);
      return;
    }
    const turn = this.scripts[this._idx++];
    this._emitTurn(turn).then(() => {
      setTimeout(() => this._runNext(), this.betweenTurnsMs);
    });
  }
```

- **What triggers it:** `start()` (line 53), `resume()` (line 58), or recursive call after turn completion (line 69)
- **What it calls:** `_emitTurn()` (line 73), `setTimeout()` (lines 64, 69)
- **What calls it:** Self-recursive via `setTimeout` callback chain
- **Dependencies:** `_emitTurn()` method, `this.scripts` array, `this._idx` counter
- **Status:** 🔴 **NOT CONNECTED** (mechanism works, but nothing invokes it)
- **Gap:**
  - **Line 64: Infinite loop potential.** When all scripts are exhausted (`this._idx >= this.scripts.length`), it resets `_idx` to 0 and loops forever with `betweenTurnsMs * 4` = 4800ms delay. This means the demo conversation repeats infinitely. There is no `once` mode or completion callback.
  - **Line 67: `this._idx++` post-increment.** The index is incremented *before* `_emitTurn` completes (it's async). This is fine because `_runNext()` won't be called again until the `.then()` on line 68 resolves.
  - **Line 68: Unhandled promise rejection.** If `_emitTurn()` throws or rejects, the `.then()` callback never fires, and `_runNext()` is never called again. The stream silently dies. There is no `.catch()` handler. This is a **bug** — any error in token emission permanently kills the stream with no error reporting.

---

## Lines 73-95: `_emitTurn(turn)` — Token Emitter (Async)
```javascript
  async _emitTurn(turn) {
    // Tokenize into ~3-char chunks like a real subword stream.
    const tokens = [];
    let i = 0;
    while (i < turn.text.length) {
      const len = 2 + Math.floor(Math.random() * 4);
      tokens.push(turn.text.slice(i, i + len));
      i += len;
    }
    const baseDelay = 1000 / TOKEN_RATE_HZ;
    for (const t of tokens) {
      if (this._stopped) return;
      // Wait out any pause before emitting the next token.
      while (this._paused && !this._stopped) {
        await new Promise(r => setTimeout(r, 80));
      }
      if (this._stopped) return;
      this.engine.pushTokens(turn.role, t);
      const jitter = (Math.random() - 0.5) * JITTER_MS;
      await new Promise(r => setTimeout(r, baseDelay + jitter));
    }
    this.engine.endTurn();
  }
```

### Lines 74-81: Tokenization Logic
```javascript
    const tokens = [];
    let i = 0;
    while (i < turn.text.length) {
      const len = 2 + Math.floor(Math.random() * 4);
      tokens.push(turn.text.slice(i, i + len));
      i += len;
    }
```

- **What triggers it:** Called by `_runNext()` on line 68
- **What it calls:** `Math.random()` (line 78), `String.slice()` (line 79)
- **What calls it:** `_runNext()`
- **Dependencies:** `Math.random()`
- **Status:** WORKING (but has a subtle bug)
- **Gap:**
  - **Line 78: Token length range is 2-5 chars.** `Math.floor(Math.random() * 4)` produces 0, 1, 2, or 3. Adding 2 gives 2, 3, 4, or 5. This creates ~3.5 char average chunks, which is reasonable for subword tokenization simulation.
  - **Bug: Token boundaries split words mid-character.** The tokenizer doesn't respect word boundaries — it blindly slices at random positions. This means tokens like `"su"`, `"re."`, `" wo"`, `"rds"` will be emitted. For the `engine.pushTokens()` consumer, this should be fine if it concatenates tokens. But if the engine tries to interpret tokens as semantic units, this will produce garbled output.

### Lines 82-93: Token Emission Loop
```javascript
    const baseDelay = 1000 / TOKEN_RATE_HZ;
    for (const t of tokens) {
      if (this._stopped) return;
      while (this._paused && !this._stopped) {
        await new Promise(r => setTimeout(r, 80));
      }
      if (this._stopped) return;
      this.engine.pushTokens(turn.role, t);
      const jitter = (Math.random() - 0.5) * JITTER_MS;
      await new Promise(r => setTimeout(r, baseDelay + jitter));
    }
```

- **What triggers it:** Part of `_emitTurn()` execution
- **What it calls:** `this._stopped` check (lines 84, 89), `this._paused` check (line 86), `this.engine.pushTokens()` (line 90), `Math.random()` (line 91), `setTimeout()` (lines 87, 92)
- **What calls it:** The `for` loop iterates over tokens from lines 75-81
- **Dependencies:** `this.engine.pushTokens()`, `Math.random()`, `setTimeout`
- **Status:** WORKING (mechanically correct, but see gaps)
- **Gap:**
  - **Line 82: `baseDelay = 1000 / 60 ≈ 16.67ms`.** With jitter of ±12.5ms, actual delay range is ~4.17ms to ~29.17ms. This is realistic.
  - **Lines 86-88: Busy-wait pause loop.** When paused, the code polls every 80ms using `await new Promise(r => setTimeout(r, 80))`. This is a **busy-wait pattern** — it creates timer churn while paused. A more elegant approach would be a single Promise that resolves when `resume()` is called. However, for a demo, this is acceptable.
  - **Line 90: `this.engine.pushTokens(turn.role, t)`** — This is the core output call. The `engine` object must have a `pushTokens(role, text)` method. **No such object exists in the current codebase.** The `DriftEngine` class was planned (documented in `snapshots/v1-pre-pretext/HANDOFF-phase-a-v2.md` line 370) but never implemented.

### Line 94: Turn Completion
```javascript
    this.engine.endTurn();
```

- **What triggers it:** After all tokens for a turn have been emitted
- **What it calls:** `this.engine.endTurn()`
- **What calls it:** The `for` loop completing naturally (not via `return` on line 84 or 89)
- **Dependencies:** `this.engine.endTurn()` method
- **Status:** 🔴 **NOT CONNECTED** — `endTurn()` is only called if the turn completes without being stopped. If `_stopped` becomes true mid-turn, the function returns early on line 84 or 89, and `endTurn()` is never called. This is correct behavior for cancellation.

---

## @@@ Symbol Scan

**No `@@@` symbols found in this file.** The file is clean of any `@@@` markers.

---

## CONNECTION MAP

### What triggers stream creation?
**Nothing in the current codebase.** The `FakeStream` class is exported (line 41: `export class FakeStream`) but never imported by any file. The following were searched:
- All `.js` files in the project root and subdirectories
- All `.html` files (`st8.html`, `void-engine.html`)
- All files in `vendor/`, `backend/`, `lib/`, `snapshots/`

### What other files get called?
- `this.engine.pushTokens(role, text)` — calls into whatever engine object is passed to the constructor
- `this.engine.endTurn()` — calls into the same engine object
- **No engine implementation exists.** The `DriftEngine` class was designed in `snapshots/v1-pre-pretext/HANDOFF-phase-a-v2.md` (line 370) but was never built. The current `void-engine.js` (both root and `vendor/` versions) is a plain pretext layout engine with no `pushTokens()` or `endTurn()` methods.

### Why is it in root?
The comment on line 2 says `vendor/fake-stream.js`, suggesting it was originally in the `vendor/` directory. It appears to have been moved to root at some point, but the header comment was not updated. The file uses ES module `export` syntax (line 41), which is appropriate for browser-side code loaded via `<script type="module">`.

### Module System Compatibility Issue
The file uses `export class FakeStream` (ES module syntax), but:
- `void-engine.js` uses ES module `import` from ESM CDN (`https://esm.sh/...`)
- `void-engine.html` loads it via `<script type="module" src="./void-engine.js">`
- `st8.html` uses inline `<script>` tags (not modules)
- `start.js` uses CommonJS `require()` (Node.js)

If `fake-stream.js` were to be imported, it would need to be via `<script type="module">` in an HTML file, or by a module-aware bundler. It is incompatible with the CommonJS `start.js` entry point.

---

## SUMMARY OF FINDINGS

| Lines | Section | Status | Key Issue |
|-------|---------|--------|-----------|
| 1-11 | Header comment | WORKING | Stale path: says `vendor/fake-stream.js`, actually in root |
| 13-14 | Constants | WORKING | None |
| 16-39 | SCRIPTS array | WORKING | Hardcoded demo conversation; system message may render visibly |
| 41-49 | Constructor | 🔴 NOT CONNECTED | Exported but never imported; `DriftEngine` doesn't exist |
| 51-54 | `start()` | 🔴 NOT CONNECTED | No restartability after `stop()` |
| 56-58 | `stop()`/`pause()`/`resume()` | 🔴 NOT CONNECTED | `stop()` is irreversible |
| 60-71 | `_runNext()` | 🔴 NOT CONNECTED | Missing `.catch()` on promise; infinite loop with no exit |
| 73-81 | Tokenization | WORKING | Tokens split mid-word (by design, but no word-boundary awareness) |
| 82-93 | Token emission | WORKING | Busy-wait pause polling; depends on non-existent engine |
| 94 | `endTurn()` | 🔴 NOT CONNECTED | `endTurn()` not called on early stop |

### Critical Issues
1. **Dead code:** The entire file is exported but never imported. The `DriftEngine` it depends on was never implemented.
2. **Unhandled promise rejection (line 68):** If `_emitTurn()` rejects, the stream silently dies with no error reporting. Missing `.catch()`.
3. **Infinite loop with no exit (line 64):** When scripts are exhausted, the conversation repeats forever. No completion callback or `once` mode.

### Minor Issues
4. **Irreversible stop (line 56):** No way to restart after `stop()` is called.
5. **Busy-wait pause (lines 86-88):** Polls every 80ms during pause instead of using a deferred Promise.
6. **Stale header comment (line 2):** Says `vendor/fake-stream.js` but file is in project root.
7. **No `endTurn()` on cancellation (lines 84, 89):** When stopped mid-turn, `endTurn()` is never called. The consuming engine must handle this gracefully.
