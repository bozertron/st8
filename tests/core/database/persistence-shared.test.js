'use strict';

/**
 * tests/core/database/persistence-shared.test.js — shared persistence
 * accessor probe (ticket 7).
 *
 * Proves:
 *   - getSharedPersistence() returns the SAME instance on repeated calls.
 *   - initialize() runs exactly ONCE across N callers (probed by spying
 *     on St8Persistence.prototype.initialize).
 *   - Concurrent first-callers (Promise.all) all resolve to the same
 *     instance and only one initialize() actually executes.
 *   - closeSharedPersistence() clears the cache; the next call opens a
 *     fresh instance.
 *   - Sanity: the returned instance has the methods app.js routes call.
 *
 * Tests use the real St8Persistence class against a temp dir, since
 * better-sqlite3 in :memory: mode would not survive a close+reopen
 * roundtrip the way the file-backed mode does. Each test resets state
 * via closeSharedPersistence() + process.chdir().
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const persistenceModule = require('../../../src/core/database/persistence');
const { St8Persistence, getSharedPersistence, closeSharedPersistence } = persistenceModule;

// Each test gets a fresh cwd so .st8/st8.sqlite is isolated.
function freshTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-shared-test-'));
  return dir;
}

test('getSharedPersistence — returns the same instance on repeated calls', async (t) => {
  const dir = freshTempDir();
  const origCwd = process.cwd();
  process.chdir(dir);
  t.after(() => {
    process.chdir(origCwd);
    closeSharedPersistence();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const a = await getSharedPersistence();
  const b = await getSharedPersistence();
  const c = await getSharedPersistence();

  assert.equal(a, b, 'instances must be reference-equal');
  assert.equal(b, c);
  assert.equal(a instanceof St8Persistence, true);
  // The DB handle must be open.
  assert.ok(a.db, 'persistence.db should be set after init');
});

test('getSharedPersistence — initialize() runs exactly once across N callers', async (t) => {
  const dir = freshTempDir();
  const origCwd = process.cwd();
  process.chdir(dir);

  // Spy on prototype.initialize. We restore in t.after so the spy doesn't
  // leak into sibling tests.
  const realInit = St8Persistence.prototype.initialize;
  let initCallCount = 0;
  St8Persistence.prototype.initialize = async function (...args) {
    initCallCount++;
    return realInit.apply(this, args);
  };
  t.after(() => {
    St8Persistence.prototype.initialize = realInit;
    process.chdir(origCwd);
    closeSharedPersistence();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Five sequential requests — simulates the post-commit hook + four
  // ticket POSTs hitting the server in succession.
  for (let i = 0; i < 5; i++) {
    const p = await getSharedPersistence();
    assert.ok(p.db);
  }
  assert.equal(initCallCount, 1, 'initialize() should fire exactly once for 5 callers');
});

test('getSharedPersistence — concurrent callers all share one init', async (t) => {
  const dir = freshTempDir();
  const origCwd = process.cwd();
  process.chdir(dir);

  const realInit = St8Persistence.prototype.initialize;
  let initCallCount = 0;
  let inFlightConcurrency = 0;
  let peakConcurrency = 0;
  St8Persistence.prototype.initialize = async function (...args) {
    initCallCount++;
    inFlightConcurrency++;
    if (inFlightConcurrency > peakConcurrency) peakConcurrency = inFlightConcurrency;
    try {
      return await realInit.apply(this, args);
    } finally {
      inFlightConcurrency--;
    }
  };
  t.after(() => {
    St8Persistence.prototype.initialize = realInit;
    process.chdir(origCwd);
    closeSharedPersistence();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Fire 10 callers in parallel. Without de-dup, this would spin up 10
  // initialize() runs. With the shared promise it should be one.
  const results = await Promise.all(
    Array.from({ length: 10 }, () => getSharedPersistence())
  );
  // All resolve to the same instance.
  for (const r of results) {
    assert.equal(r, results[0]);
  }
  // initialize() ran exactly once.
  assert.equal(initCallCount, 1, 'concurrent callers must share one init');
  assert.equal(peakConcurrency, 1, 'no concurrent init runs');
});

test('closeSharedPersistence — clears the cache; next call opens a fresh instance', async (t) => {
  const dir = freshTempDir();
  const origCwd = process.cwd();
  process.chdir(dir);
  t.after(() => {
    process.chdir(origCwd);
    closeSharedPersistence();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const a = await getSharedPersistence();
  assert.ok(a.db);

  closeSharedPersistence();

  const b = await getSharedPersistence();
  assert.notEqual(a, b, 'after close, a new instance should be returned');
  assert.ok(b.db, 'new instance must be initialized');
});

test('getSharedPersistence — instance exposes the methods the routes call', async (t) => {
  const dir = freshTempDir();
  const origCwd = process.cwd();
  process.chdir(dir);
  t.after(() => {
    process.chdir(origCwd);
    closeSharedPersistence();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const p = await getSharedPersistence();
  // Methods _handleRecordCommit + _handleTickets + _handleTicketsCount use:
  for (const fn of ['logActivity', 'createTicket', 'getOpenTickets', 'countOpenTickets']) {
    assert.equal(typeof p[fn], 'function', `persistence.${fn} must be a function`);
  }
});
