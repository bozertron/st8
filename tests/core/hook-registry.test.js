'use strict';

/**
 * tests/core/hook-registry.test.js — real probes of HookRegistry.
 *
 * Covers:
 *   - register/execute basic shape (ok/fail/errors)
 *   - priority ordering (lower runs first)
 *   - registration order within the same priority tier
 *   - error isolation: a throw in an earlier subscriber does NOT prevent
 *     later subscribers from running, and surfaces in summary.errors
 *   - async handlers awaited in sequence (shared counter probe)
 *   - zero-subscriber fast path returns the canonical empty shape
 *   - listHooks() omits hooks with no subscribers; listAllHooks()
 *     includes every canonical HOOKS constant
 *   - introspectExecuteOrder() returns sources in priority order
 *   - unregister() actually removes a handler AND returns true/false
 *     correctly; the returned unregister function from register() works
 *   - clear() resets both the _hooks map and the EventEmitter listeners
 *   - the EventEmitter re-emit fires after the loop completes
 *   - register() throws on a non-function handler (validates the
 *     TypeError contract)
 *
 * Every test constructs `new HookRegistry()` — never the singleton —
 * so test state cannot leak. No assert.ok(true), no mocks of the SUT.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { HookRegistry, HOOKS, hookRegistry } = require('../../src/core/hook-registry');

test('HookRegistry — basic register + execute returns ok:1, fail:0', async () => {
  const r = new HookRegistry();
  let called = 0;
  r.register('test:basic', () => { called++; }, { source: 'sub-a' });

  const summary = await r.execute('test:basic', { hello: 'world' });

  assert.equal(summary.ok, 1);
  assert.equal(summary.fail, 0);
  assert.deepEqual(summary.errors, []);
  assert.equal(called, 1, 'handler should have fired exactly once');
});

test('HookRegistry — handler receives the ctx passed to execute', async () => {
  const r = new HookRegistry();
  let received = null;
  r.register('test:ctx', (ctx) => { received = ctx; });

  const ctx = { foo: 1, bar: 'baz' };
  await r.execute('test:ctx', ctx);

  assert.equal(received, ctx, 'handler should receive the same ctx object reference');
  assert.equal(received.foo, 1);
  assert.equal(received.bar, 'baz');
});

test('HookRegistry — priority ordering: P=10 runs before P=100', async () => {
  const r = new HookRegistry();
  const order = [];
  // Register out of priority order to prove the registry sorts, not the
  // registration sequence.
  r.register('test:order', () => { order.push('late'); }, { priority: 100, source: 'late' });
  r.register('test:order', () => { order.push('early'); }, { priority: 10, source: 'early' });
  r.register('test:order', () => { order.push('mid'); }, { priority: 50, source: 'mid' });

  await r.execute('test:order');

  assert.deepEqual(order, ['early', 'mid', 'late']);
});

test('HookRegistry — same priority preserves registration order (stable sort)', async () => {
  const r = new HookRegistry();
  const order = [];
  r.register('test:tie', () => { order.push('first'); }, { priority: 10, source: 'first' });
  r.register('test:tie', () => { order.push('second'); }, { priority: 10, source: 'second' });
  r.register('test:tie', () => { order.push('third'); }, { priority: 10, source: 'third' });

  await r.execute('test:tie');

  assert.deepEqual(order, ['first', 'second', 'third']);
});

test('HookRegistry — error isolation: throw in P=10 does NOT block P=20', async () => {
  const r = new HookRegistry();
  let p20Ran = false;
  let p30Ran = false;
  r.register('test:isolation', () => { throw new Error('boom'); }, { priority: 10, source: 'thrower' });
  r.register('test:isolation', () => { p20Ran = true; }, { priority: 20, source: 'p20-ok' });
  r.register('test:isolation', () => { p30Ran = true; }, { priority: 30, source: 'p30-ok' });

  const summary = await r.execute('test:isolation');

  assert.equal(p20Ran, true, 'P=20 must run even though P=10 threw');
  assert.equal(p30Ran, true, 'P=30 must run even though P=10 threw');
  assert.equal(summary.ok, 2);
  assert.equal(summary.fail, 1);
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].source, 'thrower');
  assert.equal(summary.errors[0].error, 'boom');
});

test('HookRegistry — async handlers are awaited in sequence (not parallel)', async () => {
  const r = new HookRegistry();
  // Shared counter; each handler reads counter, awaits, writes counter+1.
  // If execute() ran in parallel, all three would read 0 and write 1.
  // Sequential execution yields 1 → 2 → 3.
  let counter = 0;
  const reads = [];

  const makeHandler = (delayMs) => async () => {
    const seen = counter;
    reads.push(seen);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    counter = seen + 1;
  };

  r.register('test:async', makeHandler(20), { priority: 10, source: 'h1' });
  r.register('test:async', makeHandler(20), { priority: 20, source: 'h2' });
  r.register('test:async', makeHandler(20), { priority: 30, source: 'h3' });

  await r.execute('test:async');

  assert.equal(counter, 3, 'three sequential increments should yield 3, not 1');
  assert.deepEqual(reads, [0, 1, 2], 'each handler must observe the previous handler\'s write');
});

test('HookRegistry — zero-subscriber fast path returns canonical empty shape', async () => {
  const r = new HookRegistry();
  // Hook is registered nowhere — no handlers, no EventEmitter listeners.
  const summary = await r.execute('this:hook:has:no:subscribers');

  assert.deepEqual(summary, { ok: 0, fail: 0, errors: [] });
});

test('HookRegistry — fast path skipped if an EventEmitter listener is attached', async () => {
  const r = new HookRegistry();
  let emitterFired = false;
  // Attach via .on() — no entry in _hooks map, but listenerCount() > 0,
  // so execute() must take the slow path and re-emit.
  r.on('test:emit-only', () => { emitterFired = true; });

  const summary = await r.execute('test:emit-only', { tag: 'ctx' });

  // ok/fail counts cover registered handlers only — there are none, but
  // the EventEmitter re-emit at the end of the slow path still fires.
  assert.equal(summary.ok, 0);
  assert.equal(summary.fail, 0);
  assert.equal(emitterFired, true, 'EventEmitter listener should fire on the slow path');
});

test('HookRegistry — EventEmitter re-emit fires AFTER the priority loop completes', async () => {
  const r = new HookRegistry();
  const order = [];
  r.register('test:reemit', () => { order.push('handler'); }, { priority: 10, source: 'h' });
  r.on('test:reemit', () => { order.push('emitter'); });

  await r.execute('test:reemit');

  assert.deepEqual(order, ['handler', 'emitter']);
});

test('HookRegistry — listHooks() omits zero-sub hooks; lists registered ones', () => {
  const r = new HookRegistry();
  r.register('test:listed', () => {}, { priority: 10, source: 'a' });
  r.register('test:listed', () => {}, { priority: 20, source: 'b' });
  r.register('test:other', () => {}, { priority: 5, source: 'x' });

  const hooks = r.listHooks();
  const names = hooks.map((h) => h.name);

  assert.deepEqual(names, ['test:listed', 'test:other'], 'sorted alphabetically');
  const listed = hooks.find((h) => h.name === 'test:listed');
  assert.equal(listed.count, 2);
  assert.deepEqual(listed.runOrder, ['a', 'b']);
  assert.deepEqual(
    listed.sources,
    [{ source: 'a', priority: 10 }, { source: 'b', priority: 20 }]
  );
});

test('HookRegistry — listAllHooks() includes every canonical HOOKS constant', () => {
  const r = new HookRegistry();
  const all = r.listAllHooks();
  const names = all.map((h) => h.name);
  for (const canonical of Object.values(HOOKS)) {
    assert.equal(
      names.includes(canonical),
      true,
      `listAllHooks should include canonical hook "${canonical}"`
    );
  }
  // Zero-subscriber canonical hooks should have count:0 and empty sources.
  const indexStart = all.find((h) => h.name === HOOKS.INDEX_START);
  assert.equal(indexStart.count, 0);
  assert.deepEqual(indexStart.sources, []);
  assert.deepEqual(indexStart.runOrder, []);
});

test('HookRegistry — introspectExecuteOrder returns sources in priority order', () => {
  const r = new HookRegistry();
  // Register out of order: 99, 1, 50.
  r.register('test:introspect', () => {}, { priority: 99, source: 'late' });
  r.register('test:introspect', () => {}, { priority: 1, source: 'early' });
  r.register('test:introspect', () => {}, { priority: 50, source: 'mid' });

  assert.deepEqual(
    r.introspectExecuteOrder('test:introspect'),
    ['early', 'mid', 'late']
  );
  // Unknown hook → empty array.
  assert.deepEqual(r.introspectExecuteOrder('nope'), []);
});

test('HookRegistry — unregister() removes a handler and returns true', async () => {
  const r = new HookRegistry();
  let fired = 0;
  const handler = () => { fired++; };
  r.register('test:unreg', handler, { source: 'h' });

  // First execute — handler runs.
  await r.execute('test:unreg');
  assert.equal(fired, 1);

  const removed = r.unregister('test:unreg', handler);
  assert.equal(removed, true);

  // Second execute — handler is gone; fast path returns empty.
  const summary = await r.execute('test:unreg');
  assert.equal(fired, 1, 'handler should not fire after unregister');
  assert.deepEqual(summary, { ok: 0, fail: 0, errors: [] });
});

test('HookRegistry — unregister() returns false for unknown handler / hook', () => {
  const r = new HookRegistry();
  // Hook never registered → false.
  assert.equal(r.unregister('nope', () => {}), false);
  // Hook registered, but with a different handler → false.
  r.register('test:unreg2', () => {}, { source: 'a' });
  assert.equal(r.unregister('test:unreg2', () => {}), false);
});

test('HookRegistry — the function returned by register() also unregisters', async () => {
  const r = new HookRegistry();
  let fired = 0;
  const off = r.register('test:returned-off', () => { fired++; }, { source: 'h' });

  await r.execute('test:returned-off');
  assert.equal(fired, 1);

  off();
  await r.execute('test:returned-off');
  assert.equal(fired, 1, 'unregister via returned function should stop firing');
});

test('HookRegistry — clear() wipes both _hooks and EventEmitter listeners', async () => {
  const r = new HookRegistry();
  let regCalled = 0;
  let emCalled = 0;
  r.register('test:clear', () => { regCalled++; }, { source: 'h' });
  r.on('test:clear', () => { emCalled++; });

  r.clear();

  const summary = await r.execute('test:clear');
  assert.deepEqual(summary, { ok: 0, fail: 0, errors: [] });
  assert.equal(regCalled, 0);
  assert.equal(emCalled, 0);
  // No registered hooks left.
  assert.deepEqual(r.listHooks(), []);
  // And the canonical map view shows everything at count:0.
  for (const entry of r.listAllHooks()) {
    assert.equal(entry.count, 0, `${entry.name} should be empty after clear`);
  }
});

test('HookRegistry — register() throws TypeError on non-function handler', () => {
  const r = new HookRegistry();
  assert.throws(
    () => r.register('test:bad', 'not a function'),
    /handler for "test:bad" must be a function/
  );
  assert.throws(
    () => r.register('test:bad', null),
    TypeError
  );
});

test('HookRegistry — default priority is 100 when omitted', () => {
  const r = new HookRegistry();
  r.register('test:defaults', () => {}, {}); // no priority
  const hooks = r.listHooks();
  const entry = hooks.find((h) => h.name === 'test:defaults');
  assert.equal(entry.sources[0].priority, 100);
});

test('HookRegistry — default source is "unknown" when omitted', () => {
  const r = new HookRegistry();
  r.register('test:defaults2', () => {}); // no options at all
  const hooks = r.listHooks();
  const entry = hooks.find((h) => h.name === 'test:defaults2');
  assert.equal(entry.sources[0].source, 'unknown');
});

test('HookRegistry — HOOKS map is frozen + all canonical names are non-empty strings', () => {
  // Frozen so accidental mutation is impossible.
  assert.equal(Object.isFrozen(HOOKS), true);
  for (const [key, value] of Object.entries(HOOKS)) {
    assert.equal(typeof value, 'string', `HOOKS.${key} must be a string`);
    assert.equal(value.length > 0, true, `HOOKS.${key} must be non-empty`);
  }
});

test('HookRegistry — module-level singleton is exported and distinct from new instances', () => {
  // The singleton exists.
  assert.equal(hookRegistry instanceof HookRegistry, true);
  // A new instance is a different object — tests should always use new
  // instances, never the singleton.
  const fresh = new HookRegistry();
  assert.notEqual(fresh, hookRegistry);
});

// ─── Ticket 15: EventEmitter re-emit listener throws are isolated + counted ───

test('HookRegistry — ticket 15: throw from .on() listener is counted in summary.fail', async () => {
  // Before ticket 15, throws from listeners attached via .on() (the
  // EventEmitter re-emit path after the priority loop) were not caught
  // by the registry's try/catch — they propagated as uncaught
  // exceptions. The fix: iterate rawListeners() and call each inside
  // its own try/catch, count failures in summary.fail.
  const r = new HookRegistry();
  let registeredFired = false;
  r.register('test:t15', () => { registeredFired = true; }, { source: 'reg', priority: 10 });
  r.on('test:t15', () => { throw new Error('listener-boom'); });

  let executeDidThrow = false;
  let summary;
  try {
    summary = await r.execute('test:t15', {});
  } catch (_) {
    executeDidThrow = true;
  }

  assert.equal(executeDidThrow, false, 'execute() must not throw — listener throw was contained');
  assert.equal(registeredFired, true, 'priority-loop handler still ran');
  assert.equal(summary.ok, 1, 'registered handler counted as ok');
  assert.equal(summary.fail, 1, 'listener throw counted as fail');
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].source, 'event-listener');
  assert.equal(summary.errors[0].error, 'listener-boom');
});

test('HookRegistry — ticket 15: one listener throwing does not block other listeners', async () => {
  // Two .on() listeners; the first throws; the second must still fire.
  const r = new HookRegistry();
  let secondFired = false;
  r.on('test:t15-multi', () => { throw new Error('first-listener-boom'); });
  r.on('test:t15-multi', () => { secondFired = true; });

  const summary = await r.execute('test:t15-multi', {});

  assert.equal(secondFired, true, 'second listener must run even though first threw');
  assert.equal(summary.fail, 1);
  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].source, 'event-listener');
});

// ─── Ticket 12: registerDefaultSubscribers idempotency ───

test('registerDefaultSubscribers — ticket 12: idempotent (calling twice does not duplicate handlers)', async () => {
  const { registerDefaultSubscribers, _resetDefaultSubscribersFlag } =
    require('../../src/core/hooks/default-subscribers');
  const r = new HookRegistry();

  registerDefaultSubscribers(r);
  const firstSnapshot = r.listHooks().map((h) => ({ name: h.name, count: h.count }));

  // Second call: must be a no-op.
  registerDefaultSubscribers(r);
  const secondSnapshot = r.listHooks().map((h) => ({ name: h.name, count: h.count }));

  assert.deepEqual(firstSnapshot, secondSnapshot, 'subscriber counts must be identical after second register');

  // Spot-check: INDEX_COMPLETE has exactly 5 default subscribers
  // (manifest, schema-card-emitter, gap-analyzer, intent-seeder,
  // mutation-log-retention). force-checks is registered separately.
  const idxComplete = r.listHooks().find((h) => h.name === HOOKS.INDEX_COMPLETE);
  assert.equal(idxComplete.count, 5, 'INDEX_COMPLETE should have exactly 5 default subscribers, not 10');

  // INDEX_START has exactly 1 (sonic-daemon), not 2.
  const idxStart = r.listHooks().find((h) => h.name === HOOKS.INDEX_START);
  assert.equal(idxStart.count, 1, 'INDEX_START should have exactly 1 default subscriber');

  // Cleanup so the symbol flag does not leak (cosmetic — registry is GC'd).
  _resetDefaultSubscribersFlag(r);
});

test('registerDefaultSubscribers — ticket 12: _resetDefaultSubscribersFlag unblocks re-register', () => {
  const { registerDefaultSubscribers, _resetDefaultSubscribersFlag } =
    require('../../src/core/hooks/default-subscribers');
  const r = new HookRegistry();

  registerDefaultSubscribers(r);
  // Second call would have been a no-op; clear() wipes subscribers but
  // not the flag, so we MUST also reset the flag to re-register.
  r.clear();
  _resetDefaultSubscribersFlag(r);
  registerDefaultSubscribers(r);

  const idxComplete = r.listHooks().find((h) => h.name === HOOKS.INDEX_COMPLETE);
  assert.equal(idxComplete.count, 5, 'after clear+reset, defaults re-register cleanly');
});

// ─── Ticket 14: sonic-daemon subscriber survives missing module ───

test('default-subscribers — ticket 14: sonic-daemon module is required at top-level (not in handler)', () => {
  // The module exports sonicDaemon as an internal — we cannot inspect it
  // directly. But we CAN verify the previous behavior is gone: the handler
  // body no longer contains require('../../features/search/sonic-daemon').
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'core', 'hooks', 'default-subscribers.js'),
    'utf8'
  );
  // Top-level require must exist.
  assert.match(
    source,
    /^try \{\s*sonicDaemon = require\('\.\.\/\.\.\/features\/search\/sonic-daemon'\);/m,
    'top-level try/catch require of sonic-daemon must exist'
  );
  // No lazy require inside the handler body.
  const handlerBody = source.split('registry.register(HOOKS.INDEX_START')[1];
  assert.equal(
    /require\(['"]\.\.\/\.\.\/features\/search\/sonic-daemon['"]\)/.test(handlerBody.split('}, { priority: 10')[0]),
    false,
    'sonic-daemon must NOT be lazy-required inside the INDEX_START handler'
  );
});

test('default-subscribers — ticket 14: subscriber survives an INDEX_START fire (no throw)', async () => {
  // We register the defaults against a fresh registry and fire INDEX_START
  // with a targetDir that points at a tmp dir. The sonic-daemon module
  // is real (loaded at top-level of default-subscribers); calling
  // daemon.start in a test environment may fail (no sonic binary), but
  // the handler must catch that and NOT throw out of execute().
  const { registerDefaultSubscribers, _resetDefaultSubscribersFlag } =
    require('../../src/core/hooks/default-subscribers');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  const r = new HookRegistry();
  registerDefaultSubscribers(r);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-t14-'));
  try {
    let threw = false;
    let summary;
    try {
      summary = await r.execute(HOOKS.INDEX_START, { targetDir: tmp });
    } catch (_) {
      threw = true;
    }
    assert.equal(threw, false, 'INDEX_START execute must not throw');
    // The subscriber either succeeded (ok:1) or failed-internally and the
    // registry's catch surfaced fail:1. Both are acceptable — the
    // contract is "must not throw out of execute()".
    assert.equal(summary.ok + summary.fail, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    _resetDefaultSubscribersFlag(r);
    // Stop the sonic daemon if it started, so the test doesn't leak a process.
    try {
      const daemon = require('../../src/features/search/sonic-daemon');
      if (typeof daemon.stop === 'function') await daemon.stop();
    } catch (_) { /* daemon module unavailable — fine */ }
  }
});

// ─── Ticket 13: subscriber try/catch convention ───

test('default-subscribers — ticket 13: every INDEX_COMPLETE subscriber survives a bare-ctx INDEX_COMPLETE fire', async () => {
  // Ticket 13 convention: every default subscriber wraps its body in
  // its own try/catch with a module-tagged log line. Effect: a bare ctx
  // (no ctx.result, ctx.emitter, ctx.persistence) fires the entire
  // chain to completion. Each subscriber either short-circuits cleanly
  // (defensive guards) or its inner catch swallows the throw — and the
  // outer registry catch is the safety net.
  //
  // What we assert: execute() returns a summary, does not throw, and
  // every subscriber position was visited (ok + fail accounts for all
  // 5). Whether each one ok'd or fail'd is implementation-detail —
  // both branches still pass the convention because BOTH paths leave
  // the priority chain intact.
  const { registerDefaultSubscribers, _resetDefaultSubscribersFlag } =
    require('../../src/core/hooks/default-subscribers');
  const r = new HookRegistry();
  registerDefaultSubscribers(r);

  let threw = false;
  let summary;
  try {
    summary = await r.execute(HOOKS.INDEX_COMPLETE, {});
  } catch (_) {
    threw = true;
  }
  assert.equal(threw, false, 'execute(INDEX_COMPLETE, {}) must not throw');
  // All 5 default subscribers ran.
  assert.equal(summary.ok + summary.fail, 5, 'all 5 subscribers must have been visited');

  _resetDefaultSubscribersFlag(r);
});

test('default-subscribers — ticket 13: registry catch isolates a P=10 throw from later subscribers', async () => {
  // Most direct probe: register a thrower at P=5 (before manifest), and
  // assert that the 5 default INDEX_COMPLETE subscribers AND a P=99
  // observer both still run. Proves the convention isn't load-bearing
  // on the inner catches alone — the registry's outer catch is the
  // safety net.
  const { registerDefaultSubscribers, _resetDefaultSubscribersFlag } =
    require('../../src/core/hooks/default-subscribers');
  const r = new HookRegistry();
  // Register an early thrower BEFORE the defaults so it runs first.
  r.register(HOOKS.INDEX_COMPLETE, () => { throw new Error('early-boom'); }, { priority: 5, source: 'test-thrower' });
  registerDefaultSubscribers(r);
  let observerRan = false;
  r.register(HOOKS.INDEX_COMPLETE, () => { observerRan = true; }, { priority: 99, source: 'test-observer' });

  const summary = await r.execute(HOOKS.INDEX_COMPLETE, {});

  assert.equal(observerRan, true, 'P=99 observer must run even though P=5 threw');
  // 5 defaults + 1 thrower + 1 observer = 7 subscribers visited.
  assert.equal(summary.ok + summary.fail, 7);
  // The thrower contributed at least 1 fail.
  assert.equal(summary.fail >= 1, true);
  assert.equal(
    summary.errors.some((e) => e.source === 'test-thrower'),
    true,
    'thrower must surface in summary.errors'
  );

  _resetDefaultSubscribersFlag(r);
});
