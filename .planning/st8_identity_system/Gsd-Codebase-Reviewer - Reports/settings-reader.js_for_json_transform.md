# Detailed Line-by-Line Report: `settings-reader.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/settings-reader.js`
**Lines:** 113
**Language:** JavaScript (ES Module)
**Last Modified:** 2026-05-11T21:48:30.642Z
**Status:** ⚠️ **DEAD CODE — Completely disconnected from the running application**

---

## Executive Summary

`settings-reader.js` is a settings persistence layer that uses **localStorage** as its storage backend. It is a fully self-contained ES module with two storage adapters, an event emitter, and a clean API. However, it is **completely dead** — nothing in `st8.html` imports it, nothing calls its exported classes, and it is entirely disconnected from the actual settings system (`settings-ui.js` + backend `/api/settings` + SQLite). The comment on line 9 claims it "Exposes `window.st8Settings`" but this never happens — the code uses ES module `export` syntax and is never loaded as a module.

---

## Section 1: Header Comment Block

**Lines 1-15:** JSDoc-style header comment describing the module's purpose.

- **What triggers it:** Nothing — it's a comment.
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** N/A
- **Status:** MISLEADING
- **Gap:** 
  - Line 2 says `vendor/settings-reader.js` but the file lives at the project root (`settings-reader.js`), not in `vendor/`.
  - Line 9 claims: *"Exposes `window.st8Settings` as a live POJO"* — **THIS NEVER HAPPENS**. The file uses `export class SettingsReader` (ES module syntax) but no code ever creates `window.st8Settings`. The global `window.st8Settings` is **never assigned anywhere in the codebase** (grep confirms 0 matches for `window.st8Settings` outside this comment).
  - Line 10 says subscribers can listen via `st8Settings.on('change', cb)` — this would only work if someone instantiated `SettingsReader` and assigned it to `window.st8Settings`, which never occurs.

---

## Section 2: DEFAULT_VOIDFLOW Constant

**Lines 17-25:** Default configuration values for the "voidflow" settings category.

```javascript
const DEFAULT_VOIDFLOW = {
  reveal_wpm: 200,           // line 18
  word_atomic: true,         // line 19
  pause_on_drag: true,       // line 20
  buffer_trail_visible: true,// line 21
  reveal_curve: 'linear',    // line 22
  drift_rate_lines_per_sec: 0.25, // line 23
  cursor_metronome: true,    // line 24
};
```

- **What triggers it:** Read by `_seedDefaults()` on line 57.
- **What it calls:** N/A (pure data)
- **What calls it:** `_seedDefaults()` (line 57) via `{ ...DEFAULT_VOIDFLOW }` spread.
- **Dependencies:** None
- **Status:** WORKING (internally consistent) but NOT CONNECTED
- **Gap:** These defaults are **duplicated** in `settings-ui.js:36-45` (`DEFAULT_SETTINGS.voidflow`) with identical values. The two default objects are maintained independently — if one changes, the other won't. This is a maintenance hazard even though both are dead/orphaned from the SQLite-backed system.

---

## Section 3: LocalStorageAdapter Class

**Lines 27-39:** Adapter that persists settings data to `localStorage` under a namespaced key.

### Constructor (line 28)
```javascript
constructor(key = 'st8.settings.v1') { this.key = key; }
```
- **Default key:** `'st8.settings.v1'`
- The key is customizable via constructor argument.

### `read()` Method (lines 29-34)
```javascript
read() {
  try {
    const raw = localStorage.getItem(this.key);  // line 31
    return raw ? JSON.parse(raw) : null;           // line 32
  } catch { return null; }                         // line 33
}
```
- **What triggers it:** Called by `SettingsReader` constructor (line 51) via `this.storage.read()`.
- **What it calls:** `localStorage.getItem()`, `JSON.parse()`
- **What calls it:** `SettingsReader` constructor (line 51)
- **Dependencies:** Browser `localStorage` API
- **Status:** WORKING (code is correct)
- **Gap:** 
  - Line 33: Empty `catch` block — if `localStorage` contains corrupted JSON, the error is silently swallowed and `null` is returned. The corrupted data remains in localStorage. No logging, no cleanup. This is a **minor quality issue** — in production, you'd want at least a `console.warn` to aid debugging.
  - No schema validation on read — if the stored data has a different shape than expected (e.g., from a previous version), it will be used as-is.

### `write()` Method (lines 35-38)
```javascript
write(data) {
  try { localStorage.setItem(this.key, JSON.stringify(data)); }  // line 36
  catch (e) { console.warn('[st8.settings] write failed', e); }  // line 37
}
```
- **What triggers it:** Called by `SettingsReader` constructor (line 52), `set()` (line 73), `upsertRow()` (line 85), `removeRow()` (line 92), `reset()` (line 107).
- **What it calls:** `localStorage.setItem()`, `JSON.stringify()`
- **What calls it:** Multiple `SettingsReader` methods
- **Dependencies:** Browser `localStorage` API
- **Status:** WORKING
- **Gap:** If `localStorage` is full (quota exceeded), the `catch` logs a warning but the in-memory `this._data` is already updated — the object and storage will be **out of sync**. Callers have no way to know the write failed.

---

## Section 4: MemoryAdapter Class

**Lines 41-45:** In-memory storage adapter, intended for testing.

```javascript
class MemoryAdapter {
  constructor() { this._data = null; }  // line 42
  read() { return this._data; }          // line 43
  write(d) { this._data = d; }           // line 44
}
```

- **What triggers it:** Instantiated when `SettingsReader` is constructed with `{ storage: new MemoryAdapter() }`.
- **What it calls:** Nothing — pure in-memory.
- **What calls it:** 
  - `SettingsReader` constructor (line 48) — if explicitly passed.
  - Referenced in `TESTING.md` as the test adapter (lines 80-82, 119-121).
- **Dependencies:** None
- **Status:** WORKING (internally consistent) but NOT CONNECTED
- **Gap:** This adapter exists purely for testability but **no test files exist** for `settings-reader.js`. The TESTING.md documents how tests *should* use it, but no actual test suite was ever written.

---

## Section 5: SettingsReader Class — Export & Constructor

**Lines 47-53:** The main class, exported as an ES module.

```javascript
export class SettingsReader {
  constructor({ storage = new LocalStorageAdapter() } = {}) {  // line 48
    this.storage = storage;                                      // line 49
    this._listeners = new Set();                                 // line 50
    this._data = this.storage.read() || this._seedDefaults();   // line 51
    this.storage.write(this._data);                              // line 52
  }
```

- **What triggers it:** Must be explicitly instantiated: `new SettingsReader()`.
- **What it calls:**
  - `LocalStorageAdapter` constructor (line 28) — default storage
  - `this.storage.read()` — reads existing data from storage
  - `this._seedDefaults()` (line 55) — if no stored data
  - `this.storage.write()` — writes back (seeds storage on first use)
- **What calls it:** **NOTHING** in the codebase. No file imports or instantiates `SettingsReader`.
- **Dependencies:** `LocalStorageAdapter` (line 27) or `MemoryAdapter` (line 41)
- **Status:** ⚠️ **NOT CONNECTED — NEVER INSTANTIATED**
- **Gap:** 
  - Line 48: The destructured default `{ storage = new LocalStorageAdapter() }` means if someone calls `new SettingsReader()` with no arguments, it silently uses localStorage. This is fine for browser use but would throw in Node.js (no `localStorage` global).
  - Line 51: `this.storage.read() || this._seedDefaults()` — the `||` operator means if stored data is any falsy value (0, empty string, false, null, undefined), defaults are used. Since `read()` returns parsed JSON or null, this is safe, but if someone stored `{}` (empty object), it would be used as-is (truthy) rather than getting defaults seeded.
  - Line 52: **Always writes back** on construction — even if data was read successfully. This means every page load triggers a write cycle.

---

## Section 6: _seedDefaults() Method

**Lines 55-62:** Returns the default settings structure.

```javascript
_seedDefaults() {
  return {
    voidflow: { ...DEFAULT_VOIDFLOW },  // line 57
    sirkits: [],                         // line 58
    models: [],                          // line 59
    shells: [],                          // line 60
  };
}
```

- **What triggers it:** Called by constructor (line 51) when no stored data exists.
- **What it calls:** Spreads `DEFAULT_VOIDFLOW` (line 17).
- **What calls it:** `SettingsReader` constructor (line 51), `reset()` (line 107).
- **Dependencies:** `DEFAULT_VOIDFLOW` constant (line 17)
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** 
  - Only 4 categories: `voidflow`, `sirkits`, `models`, `shells`.
  - The actual app (`settings-ui.js:15-24`) defines **8 categories**: `sirkits`, `models`, `shells`, `voidflow`, `keybindings`, `theme`, `storage`, `network`.
  - Missing 4 categories: `keybindings`, `theme`, `storage`, `network`. If this were ever used, those categories would be undefined until explicitly set.

---

## Section 7: Property Getters

**Lines 64-68:** Live POJO accessors for each category.

```javascript
get voidflow() { return this._data.voidflow; }  // line 65
get sirkits()  { return this._data.sirkits; }    // line 66
get models()   { return this._data.models; }     // line 67
get shells()   { return this._data.shells; }     // line 68
```

- **What triggers it:** Property access, e.g., `settings.voidflow.reveal_wpm`.
- **What it calls:** Returns direct references to `this._data` sub-objects.
- **What calls it:** Hypothetical consumers (none exist).
- **Dependencies:** `_seedDefaults()` must have been called.
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** 
  - These return **direct references** to the internal `_data` objects, not copies. A consumer could mutate `settings.voidflow.reveal_wpm = 999` directly, bypassing `set()` and the event emitter. This defeats the purpose of having `set()` as the mutation API.
  - No getters for `keybindings`, `theme`, `storage`, `network` — the other 4 categories from the real settings system.

---

## Section 8: set() Method

**Lines 70-75:** Generic key-value setter for any category.

```javascript
set(category, key, value) {
  if (!this._data[category]) this._data[category] = {};  // line 71
  this._data[category][key] = value;                       // line 72
  this.storage.write(this._data);                          // line 73
  this._emit('change', { category, key, value });          // line 74
}
```

- **What triggers it:** Called by `setVoidflow()` (line 77) or directly by consumers.
- **What it calls:**
  - `this.storage.write()` (LocalStorageAdapter:35 or MemoryAdapter:44)
  - `this._emit()` (line 100)
- **What calls it:** `setVoidflow()` (line 77). No external callers.
- **Dependencies:** Storage adapter, event listeners.
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** 
  - Line 71: If category doesn't exist, it creates a new **empty object** `{}`. This means `set('newCat', 'key', 'val')` works but the category won't have any defaults. Contrast with `_seedDefaults()` which pre-populates `voidflow` with specific keys.
  - No validation on `value` — any value type is accepted. If someone passes a function or circular reference, `JSON.stringify` in the storage adapter will throw (caught by the adapter, but data won't persist).
  - No validation on `key` — no schema enforcement. The file header says "Schema-driven, JSON validated against per-category schemas" (line 6) but **no schema validation exists anywhere in this file**.

---

## Section 9: setVoidflow() Convenience Method

**Line 77:** Shorthand for setting voidflow category keys.

```javascript
setVoidflow(key, value) { this.set('voidflow', key, value); }
```

- **What triggers it:** Direct call by consumers.
- **What it calls:** `this.set('voidflow', key, value)` (line 70).
- **What calls it:** Nothing — no external callers exist.
- **Dependencies:** `set()` method (line 70)
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** This is the only category-specific convenience setter. No `setSirkits()`, `setModels()`, etc. Inconsistent API design.

---

## Section 10: upsertRow() Method

**Lines 79-87:** Insert or update a row in array-based categories (sirkits, models, shells).

```javascript
upsertRow(category, row) {
  if (!Array.isArray(this._data[category])) this._data[category] = [];  // line 81
  const idx = this._data[category].findIndex(r => r.id === row.id);     // line 82
  if (idx >= 0) this._data[category][idx] = row;                        // line 83
  else this._data[category].push(row);                                   // line 84
  this.storage.write(this._data);                                        // line 85
  this._emit('change', { category, row });                               // line 86
}
```

- **What triggers it:** Direct call by consumers.
- **What it calls:**
  - `Array.findIndex()` (line 82)
  - `this.storage.write()` (line 85)
  - `this._emit()` (line 86)
- **What calls it:** Nothing — no external callers exist.
- **Dependencies:** Storage adapter, event listeners.
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** 
  - Line 82: `r.id === row.id` — assumes every row has an `id` property. If `row.id` is undefined, this will match the first row with `undefined` id, or always push a new row (since `undefined === undefined` is true, it would match index 0 if the first row also has no id).
  - Line 81: If the category was previously set to an object (via `set()`), this **overwrites it with an empty array**. The `set()` and `upsertRow()` methods have conflicting type assumptions for the same data structure.
  - The payload `{ category, row }` differs from `set()`'s payload `{ category, key, value }` — event listeners must handle both shapes.

---

## Section 11: removeRow() Method

**Lines 89-94:** Remove a row by id from an array-based category.

```javascript
removeRow(category, id) {
  if (!Array.isArray(this._data[category])) return;                    // line 90
  this._data[category] = this._data[category].filter(r => r.id !== id);// line 91
  this.storage.write(this._data);                                       // line 92
  this._emit('change', { category, removed: id });                     // line 93
}
```

- **What triggers it:** Direct call by consumers.
- **What it calls:**
  - `Array.filter()` (line 91)
  - `this.storage.write()` (line 92)
  - `this._emit()` (line 93)
- **What calls it:** Nothing — no external callers exist.
- **Dependencies:** Storage adapter, event listeners.
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** 
  - Line 90: If category is not an array, silently returns. No error, no warning. The caller has no way to know the removal failed.
  - Line 91: If the id doesn't exist in the array, `filter` returns the original array (unchanged), but `write()` and `_emit()` still fire — emitting a "change" event when nothing actually changed.

---

## Section 12: Event Emitter (on/off/_emit)

**Lines 96-104:** Simple pub/sub event system.

### `on()` (line 96)
```javascript
on(event, fn) { this._listeners.add({ event, fn }); }
```
- Registers a listener. Uses a `Set` of `{event, fn}` objects.

### `off()` (lines 97-99)
```javascript
off(event, fn) {
  for (const l of this._listeners) if (l.event === event && l.fn === fn) this._listeners.delete(l);
}
```
- Removes a listener by iterating the Set and deleting matching entries.

### `_emit()` (lines 100-104)
```javascript
_emit(event, payload) {
  for (const l of this._listeners) if (l.event === event) {
    try { l.fn(payload); } catch (e) { console.warn(e); }  // line 102
  }
}
```
- Fires all listeners for a given event.

- **What triggers it:** `set()`, `upsertRow()`, `removeRow()`, `reset()`.
- **What it calls:** Registered callback functions.
- **What calls it:** Internal mutation methods.
- **Dependencies:** None
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** 
  - **Duplicate listener bug:** `on()` uses `Set.add()` with an object literal `{ event, fn }`. Each call creates a **new object**, so calling `on('change', myFn)` twice will register **two separate listeners** — the Set uses object identity for dedup, not value equality. There's no guard against double-registration. This can cause callbacks to fire multiple times.
  - Line 102: Listener errors are caught and warned, which is good — prevents one bad listener from breaking others.
  - No support for `once()` — no way to listen for a single change.
  - No event name validation — any string works (e.g., `on('typo', cb)` silently registers).

---

## Section 13: reset() Method

**Line 107:** Destructive reset to defaults.

```javascript
reset() {
  this._data = this._seedDefaults();
  this.storage.write(this._data);
  this._emit('change', { reset: true });
}
```

- **What triggers it:** Direct call by consumers.
- **What it calls:** `_seedDefaults()` (line 55), `this.storage.write()`, `this._emit()`.
- **What calls it:** Nothing — no external callers exist.
- **Dependencies:** `_seedDefaults()`, storage adapter.
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** 
  - No confirmation mechanism — this is destructive and irreversible. The comment says "Useful in dev" but there's no guard for production.
  - The event payload `{ reset: true }` has a different shape than `set()` or `upsertRow()` events — listeners must handle yet another payload format.

---

## Section 14: export() Method

**Lines 109-110:** Deep-clones internal state for inspection/backup.

```javascript
export() { return JSON.parse(JSON.stringify(this._data)); }
```

- **What triggers it:** Direct call by consumers.
- **What it calls:** `JSON.parse(JSON.stringify(...))` — structured clone via serialization.
- **What calls it:** Nothing — no external callers exist.
- **Dependencies:** None
- **Status:** WORKING (internally) but NOT CONNECTED
- **Gap:** 
  - The method name `export` is a **reserved word** in ES module context. While it works as a method name on a class instance, it could confuse developers and linters. `exportData()` or `snapshot()` would be clearer.
  - `JSON.parse(JSON.stringify(...))` will silently drop any non-JSON-serializable values (functions, undefined, Symbols, BigInt, circular references). No warning is given.

---

## Section 15: Module Exports

**Lines 112-113:** ES module exports.

```javascript
export { LocalStorageAdapter, MemoryAdapter };
```

- **What triggers it:** ES module import by another module.
- **What it calls:** N/A
- **What calls it:** **NOTHING** — no file in the codebase imports from `settings-reader.js`.
- **Dependencies:** N/A
- **Status:** ⚠️ **NOT CONNECTED — NEVER IMPORTED**
- **Gap:** The file uses `export class` and `export { ... }` (ES module syntax), but `st8.html` loads scripts via plain `<script src="...">` tags (lines 1661-1665), not `<script type="module">`. This file **cannot be loaded by the HTML page** without changing the script tag to `type="module"`. It's also not referenced in any `<script>` tag at all.

---

## @@@ Symbol Scan

**No `@@@` symbols found** in `settings-reader.js`. The file contains no `@@@` markers.

---

## Connection Map

### What Triggers Settings Reading?

| Trigger | Mechanism | File | Status |
|---------|-----------|------|--------|
| App boot (HTML load) | N/A | `st8.html` | ❌ `settings-reader.js` is NOT loaded |
| Opening settings panel | `fetch('/api/settings')` | `settings-ui.js:188` | ✅ Uses backend API, NOT `settings-reader.js` |
| Settings panel render | `settingsState.entries` | `settings-ui.js:30` | ✅ In-memory state in `settings-ui.js`, NOT `SettingsReader` |
| Programmatic access | `new SettingsReader()` | None | ❌ Never instantiated |

### What Other Files Get Called?

| Called File | Relationship | Status |
|-------------|-------------|--------|
| None | `settings-reader.js` has zero imports | N/A — self-contained |
| `settings-ui.js` | Alternative/competing settings system | ❌ No connection |
| `backend/server.js` | Backend `/api/settings` endpoint | ❌ No connection |
| `backend/persistence.js` | SQLite persistence | ❌ No connection |

### Why Two Adapters?

| Adapter | Purpose | Used? |
|---------|---------|-------|
| `LocalStorageAdapter` (line 27) | Browser localStorage persistence | ❌ No — never instantiated |
| `MemoryAdapter` (line 41) | In-memory for testing | ❌ No — no tests exist |

The adapter pattern is a **good design** (allows swapping storage backends), but it's dead code. The comment on line 7 says "sql.js or a real sqlite bridge can be dropped in later" — this never happened. The actual app uses `backend/persistence.js` with real SQLite via the `/api/settings` HTTP API.

---

## Comparison: `settings-reader.js` vs Actual Settings System

| Aspect | `settings-reader.js` | `settings-ui.js` + Backend |
|--------|---------------------|---------------------------|
| Storage | `localStorage` | SQLite via `/api/settings` |
| Module type | ES module (`export`) | Global script (`window.St8Settings`) |
| Loaded in `st8.html`? | ❌ No | ✅ Yes (line 1664) |
| Categories | 4 (voidflow, sirkits, models, shells) | 8 (+ keybindings, theme, storage, network) |
| Event system | `on('change', cb)` | None (direct state mutation) |
| Schema validation | Comment claims it, code doesn't | None |
| Instantiated? | ❌ Never | ✅ Always (via global object) |
| Consumers | 0 | `st8.html` onclick handlers, `loadSettings()` |

---

## Summary of All Findings

| Lines | Section | Status | Key Issue |
|-------|---------|--------|-----------|
| 1-15 | Header comment | MISLEADING | Claims `window.st8Settings` exposure; never happens. Wrong file path. |
| 17-25 | `DEFAULT_VOIDFLOW` | NOT CONNECTED | Duplicated in `settings-ui.js:36-45`; maintenance hazard. |
| 27-39 | `LocalStorageAdapter` | NOT CONNECTED | Correct code, but never instantiated. Silent error swallowing on read (line 33). |
| 41-45 | `MemoryAdapter` | NOT CONNECTED | Correct code, but never used (no tests). |
| 47-53 | `SettingsReader` constructor | NOT CONNECTED | Never instantiated anywhere. Always writes on construction. |
| 55-62 | `_seedDefaults()` | NOT CONNECTED | Only 4 of 8 categories. |
| 64-68 | Property getters | NOT CONNECTED | Return mutable references (bypass event system). |
| 70-75 | `set()` | NOT CONNECTED | No schema validation despite header claiming it. |
| 77 | `setVoidflow()` | NOT CONNECTED | Only convenience setter; inconsistent API. |
| 79-87 | `upsertRow()` | NOT CONNECTED | Type conflict with `set()` (array vs object). Silent id assumptions. |
| 89-94 | `removeRow()` | NOT CONNECTED | Silent no-op on invalid category. Fires event even when nothing removed. |
| 96-104 | Event emitter | NOT CONNECTED | Duplicate listener bug (object identity in Set). |
| 107 | `reset()` | NOT CONNECTED | Destructive with no guard. |
| 109-110 | `export()` | NOT CONNECTED | Method name shadows ES keyword. |
| 112-113 | Module exports | NOT CONNECTED | Never imported by any file. |

---

## Verdict

**`settings-reader.js` is completely dead code.** It is:
1. **Never loaded** — no `<script type="module" src="settings-reader.js">` in `st8.html`
2. **Never imported** — `grep` for `import.*settings-reader` and `require.*settings-reader` returns 0 production matches (only `TESTING.md` examples)
3. **Never instantiated** — `new SettingsReader()` appears nowhere in the codebase
4. **Competing system** — `settings-ui.js` + backend `/api/settings` + SQLite is the actual settings system
5. **Storage mismatch** — uses `localStorage`, the real system uses SQLite

**Recommendation:** Archive or remove this file. If the adapter pattern is desired in the future, refactor to use it as the backing store for the `settings-ui.js` system rather than maintaining a parallel dead system.

---

*Report generated: 2026-05-13*
*Reviewer: GSD Code Review Agent*
*Depth: deep (line-by-line analysis with cross-file connection mapping)*
