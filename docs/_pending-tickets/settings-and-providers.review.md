# Settings-and-Providers Review

## Wave 5C Review

Reviewer: wave-5c-reviewer
Reviewed commits: 4983772, de7f5d8, b13c39e, d0baf2c
Baseline before: 271 tests. After 5C: 292 tests. Delta: +21. Suite: 292 pass / 0 fail / 0 skip / 0 todo.

### Ticket 3 (lock-step assertion) — ACK
- IIFE `_assertCategoriesMatchDefaults` at settings.js:422 sorts both key sets and throws (also `console.error`s) on mismatch. Runs at module load — NOT lazy.
- Tests inject a mutated source via vm-sandbox to prove the throw path: extra category id (line 87) and extra DEFAULT_SETTINGS key (line 100). Both real probes (mutation actually changes SRC, then assert.throws).

### Ticket 4 (type coercion) — ACK
- `coerceSettingValue` at settings.js:447 handles every primitive cross-type path: string→number, string→boolean, primitive→string, JSON-string→object. Garbage values (e.g. `'definitely not a number'` for `reveal_wpm`) fall back to `defaults[key]` and emit `console.warn` with type-mismatch message. No silent corruption.
- 6 tests cover happy path, fallback-with-warn, pass-through, unknown key, array category passthrough, and the `coerceCategoryValues` mapper. Each test is a real probe, not assert.ok(true).
- Wired into both `loadSettings()` (post-migration) and `renderCategoryEntries()` (before the typeof branch).

### Ticket 5 (migration map) — ACK
- `SETTINGS_KEY_MIGRATIONS` at settings.js:513 is a plain `{ 'category.oldKey': 'newKey' }` map, currently empty. `migrateCategoryKeys` runs at load before coercion. Re-persists under the new key and best-effort DELETEs the old (`.catch(()=>{})` is acceptable as best-effort and not a silent-failure cheat — the next read won't surface the old key).
- New-key-wins-on-collision branch is real: tests patch SRC to seed one migration and verify (a) rename, (b) no-clobber when new key already present.
- Schema-level framework deferral to persistence roadmap P1.1 — appropriate, not a cheat.

### Ticket 7 (theme audit) — ACK
- Outcome (b) chosen: comment block above `theme:` (settings.js:84-97) names absent consumers (`palette_overrides`, `font_sizes`, `spacing_scale`), points to roadmap P2.3, and warns against deletion. Confirmed `docs/_pending-roadmap/settings-and-providers.md` line 60 contains `### P2.3 Apply theme tokens` — the pointer is live.

### Ticket 8 (category enum) — ACK
- `ALLOWED_SETTINGS_CATEGORIES` at app.js is `Object.freeze`d, 8 ids matching frontend exactly.
- `_handleSettings` POST branch returns 400 with `{error:'unknown settings category', category, allowed}` body.
- Drift test regex is bounded: first matches `const SETTINGS_CATEGORIES = [...]` block, then extracts `id: '<name>'` only from inside that captured group. Tight.
- **MUTATION PROBE**: removed `'network'` from ALLOWED_SETTINGS_CATEGORIES; ran the test file: 2 of 7 failed (the drift `deepEqual` test and the count assertion `>= 8`). Restored. Mutation probe PASSED.

### Ticket 9 (Promise<boolean> revert) — ACK
- `_persistSetting` returns Promise<boolean>: `true` on `res.ok`, `false` on non-2xx, `false` on network error (warn + return). Real revert logic in `updateValue` (settings.js:228): snapshots `hadKey` + `prevValue`, applies optimistically, awaits, on `false` deletes the key if it didn't exist before or restores prev, then `renderCategoryEntries()` to re-render. Returns the Promise so callers/tests can chain.
- Direct unit test for the revert path is indirect (DOM-coupled), but the persist Promise contract is exercised by the migration tests and the backend ticket-8 reject path is fully covered. Acceptable.

### Verdicts
All six 5C tickets: ACK. No kickbacks. Safe to proceed to 5D (frontend LLM UI work, tickets 1/2/6).
