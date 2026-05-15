# tests/ — st8 test suite

Runner: **Node's built-in test runner** (`node --test`, available since
Node 18). Zero new dependencies. `package.json` declares
`"engines": { "node": ">=18.0.0" }` so this is safe.

## Running

```
npm test                                        # run every *.test.js under tests/
node --test tests/core/hook-registry.test.js    # one file
```

`npm test` uses Node's default test discovery (scans `test/` and `tests/`
plus `**/*.test.js`). Passing `tests/` as a positional argument is
**not** equivalent — `node --test tests/` tries to `require()` the
directory and fails. Leave the script bare.

## Layout

`tests/` mirrors `src/`. A test for `src/<path>/foo.js` goes under
`tests/<path>/foo.test.js`. Examples:

| Source                                  | Test                                           |
|-----------------------------------------|------------------------------------------------|
| `src/core/hook-registry.js`             | `tests/core/hook-registry.test.js`             |
| `src/core/server/app.js`                | `tests/core/server/app.test.js`                |
| `src/core/hooks/default-subscribers.js` | `tests/core/hooks/default-subscribers.test.js` |

Helpers shared across suites live under `tests/_helpers/`.
Fixtures live under `tests/_fixtures/` (created on demand).

## Conventions

- **Use `node:test` and `node:assert/strict`.** Both are core; no install
  step. Pin to `strict` so `assert.equal(0, '0')` fails as expected.
- **Construct fresh instances under test.** Never test the module-level
  `hookRegistry` singleton — its state leaks across tests. Use
  `new HookRegistry()` in every test, or call `registry.clear()` between
  cases inside one `describe`.
- **No mocks of the System Under Test.** A registry test must exercise
  the real `HookRegistry` class. A persistence test must open a real
  better-sqlite3 (in-memory `:memory:` is fine).
- **No `assert.ok(true)` smoke tests.** A test that passes by construction
  is a stub. Every test must probe a real code path and assert on a
  real observable.
- **Async correctness matters.** Use `async () =>` test bodies and
  `await` every registry/persistence call. The runner times out at 30 s
  by default; long tests should explicitly set `timeout`.
- **Test isolation.** Use `t.beforeEach` / `t.afterEach` inside
  `describe` blocks. Tests must not depend on file-system or DB state
  from a previous test.

## Why `node --test` and not jest/vitest

- Node 18+ already on `engines`. Adding jest would be ~250 MB of
  transitive deps just to assert.
- The runner is fast (~50 ms cold start) and has parallelism out of
  the box.
- Output is TAP, which any CI can parse without plugins.
- Reviewer note for Wave 2D: if a future ticket needs jest-only
  features (snapshot tests, jsdom), revisit then — for unit tests on
  pure-Node modules, the built-in is sufficient.
