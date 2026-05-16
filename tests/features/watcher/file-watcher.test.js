'use strict';

/**
 * tests/features/watcher/file-watcher.test.js — real probes of FileWatcher.
 *
 * Covers (ticket 3, wave 4A):
 *   - Debounce window collapses multiple events on same (path, type)
 *     into one flush entry (post-ticket-4 dedup)
 *   - Multiple distinct paths within window all get flushed
 *   - CREATE+EDIT on same path stays as two entries (composite key
 *     preserves the type distinction so main.js's dispatch is intact)
 *   - Flush passes the pendingChanges values array to the handler
 *   - Timer resets on each new event (debounce, not throttle)
 *   - stop() cancels pending timer and prevents flush
 *   - Watcher recovers if the onFileChange callback throws / rejects
 *   - Metrics counters (ticket 14): eventsReceived, debounceMergeCount,
 *     flushCalls, lastFlushAt, lastFlushSize advance correctly
 *   - getMetrics() returns a snapshot — mutating the snapshot does not
 *     affect internal state
 *
 * These probes drive the real `_onFileChange` / `_flush` / `stop`
 * methods directly. Chokidar is never started — the tests do NOT
 * require a watcher to be running. Debounce is set to 30 ms; every
 * await waits ~80 ms (well past one debounce window, well under
 * runner timeout). No setTimeout-based test runs for >2 s.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { FileWatcher } = require('../../../src/features/watcher/file-watcher.js');

const DEBOUNCE_MS = 30;
const FLUSH_WAIT_MS = 80; // > DEBOUNCE_MS + scheduler slop

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('FileWatcher — multiple events on same (path,type) collapse to one flush entry', async () => {
  const flushed = [];
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: (changes) => { flushed.push(changes); }
  });

  for (let i = 0; i < 25; i++) {
    w._onFileChange('/tmp/storm.js', 'change');
  }

  await wait(FLUSH_WAIT_MS);

  assert.equal(flushed.length, 1, 'exactly one flush should have fired');
  assert.equal(flushed[0].length, 1, '25 same-(path,type) events should dedup to 1');
  assert.deepEqual(flushed[0][0], { path: '/tmp/storm.js', type: 'change' });
  w.stop();
});

test('FileWatcher — distinct paths within window all flush, in one batch', async () => {
  const flushed = [];
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: (changes) => { flushed.push(changes); }
  });

  w._onFileChange('/tmp/a.js', 'change');
  w._onFileChange('/tmp/b.js', 'change');
  w._onFileChange('/tmp/c.js', 'add');

  await wait(FLUSH_WAIT_MS);

  assert.equal(flushed.length, 1, 'one flush');
  assert.equal(flushed[0].length, 3, 'three distinct entries');
  const paths = flushed[0].map((c) => c.path).sort();
  assert.deepEqual(paths, ['/tmp/a.js', '/tmp/b.js', '/tmp/c.js']);
  w.stop();
});

test('FileWatcher — CREATE+EDIT on same path preserved as two entries (composite key)', async () => {
  // This guards against the trap of using Map<path> last-write-wins,
  // which would silently drop the CREATE branch in main.js's
  // per-change dispatch (no upsertFile, no initial schema-card emit).
  const flushed = [];
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: (changes) => { flushed.push(changes); }
  });

  w._onFileChange('/tmp/x.js', 'add');
  w._onFileChange('/tmp/x.js', 'change');

  await wait(FLUSH_WAIT_MS);

  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].length, 2, 'add + change must coexist');
  const types = flushed[0].map((c) => c.type).sort();
  assert.deepEqual(types, ['add', 'change']);
  w.stop();
});

test('FileWatcher — flush handler receives values array, not the Map', async () => {
  let received = null;
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: (changes) => { received = changes; }
  });

  w._onFileChange('/tmp/y.js', 'unlink');
  await wait(FLUSH_WAIT_MS);

  assert.ok(Array.isArray(received), 'handler should receive an Array');
  assert.equal(received.length, 1);
  assert.equal(received[0].path, '/tmp/y.js');
  assert.equal(received[0].type, 'unlink');
  w.stop();
});

test('FileWatcher — timer resets on each new event (debounce, not throttle)', async () => {
  // Drip an event every DEBOUNCE_MS - 10ms for 3 windows; if the
  // behavior were throttle, multiple flushes would fire. Under
  // debounce, exactly one flush should fire after the final event.
  const flushed = [];
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: (changes) => { flushed.push(changes); }
  });

  w._onFileChange('/tmp/drip.js', 'change');
  await wait(DEBOUNCE_MS - 10);
  w._onFileChange('/tmp/drip.js', 'change');
  await wait(DEBOUNCE_MS - 10);
  w._onFileChange('/tmp/drip.js', 'change');
  await wait(DEBOUNCE_MS - 10);
  // Still pending — no flush yet
  assert.equal(flushed.length, 0, 'no flush mid-stream — timer keeps resetting');

  await wait(FLUSH_WAIT_MS);
  assert.equal(flushed.length, 1, 'exactly one flush after the storm settles');
  w.stop();
});

test('FileWatcher — stop() cancels pending timer and prevents flush', async () => {
  const flushed = [];
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: (changes) => { flushed.push(changes); }
  });

  w._onFileChange('/tmp/cancelme.js', 'change');
  assert.ok(w.debounceTimer !== null, 'timer should be pending pre-stop');

  w.stop();
  assert.equal(w.debounceTimer, null, 'stop() must null out the timer handle');

  await wait(FLUSH_WAIT_MS);
  assert.equal(flushed.length, 0, 'no flush should fire after stop()');
});

test('FileWatcher — recovers when onFileChange rejects (next event still flushes)', async () => {
  let callCount = 0;
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: async (changes) => {
      callCount++;
      if (callCount === 1) throw new Error('boom');
    }
  });

  w._onFileChange('/tmp/first.js', 'change');
  await wait(FLUSH_WAIT_MS);
  assert.equal(callCount, 1, 'first flush ran (and threw)');

  // Second event after a failed flush — the watcher must still be alive.
  w._onFileChange('/tmp/second.js', 'change');
  await wait(FLUSH_WAIT_MS);
  assert.equal(callCount, 2, 'watcher recovered — second flush ran');
  w.stop();
});

test('FileWatcher metrics — eventsReceived counts every input event', async () => {
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: () => {}
  });

  assert.equal(w.getMetrics().eventsReceived, 0, 'fresh watcher starts at 0');

  w._onFileChange('/tmp/m1.js', 'change');
  w._onFileChange('/tmp/m2.js', 'change');
  w._onFileChange('/tmp/m1.js', 'change');

  assert.equal(w.getMetrics().eventsReceived, 3, 'every event counts pre-dedup');
  await wait(FLUSH_WAIT_MS);
  w.stop();
});

test('FileWatcher metrics — debounceMergeCount counts only duplicates', async () => {
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: () => {}
  });

  w._onFileChange('/tmp/uniq-a.js', 'change');
  w._onFileChange('/tmp/uniq-b.js', 'add');
  // No merges yet — two distinct keys
  assert.equal(w.getMetrics().debounceMergeCount, 0);

  w._onFileChange('/tmp/uniq-a.js', 'change'); // merge
  w._onFileChange('/tmp/uniq-a.js', 'change'); // merge
  w._onFileChange('/tmp/uniq-b.js', 'add');    // merge

  const m = w.getMetrics();
  assert.equal(m.eventsReceived, 5);
  assert.equal(m.debounceMergeCount, 3, 'three merge hits on existing keys');
  await wait(FLUSH_WAIT_MS);
  w.stop();
});

test('FileWatcher metrics — flushCalls + lastFlushAt + lastFlushSize update on flush', async () => {
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: () => {}
  });

  let m = w.getMetrics();
  assert.equal(m.flushCalls, 0);
  assert.equal(m.lastFlushAt, null);
  assert.equal(m.lastFlushSize, 0);

  w._onFileChange('/tmp/f1.js', 'change');
  w._onFileChange('/tmp/f2.js', 'change');
  await wait(FLUSH_WAIT_MS);

  m = w.getMetrics();
  assert.equal(m.flushCalls, 1, 'one flush');
  assert.equal(m.lastFlushSize, 2, 'two distinct entries flushed');
  assert.equal(typeof m.lastFlushAt, 'string', 'ISO timestamp string');
  // Sanity: ISO format
  assert.ok(!Number.isNaN(Date.parse(m.lastFlushAt)), 'lastFlushAt is parseable');

  // Trigger a second flush window
  w._onFileChange('/tmp/f3.js', 'add');
  await wait(FLUSH_WAIT_MS);
  m = w.getMetrics();
  assert.equal(m.flushCalls, 2, 'second flush counted');
  assert.equal(m.lastFlushSize, 1);
  w.stop();
});

test('FileWatcher metrics — getMetrics() returns an isolated snapshot', async () => {
  const w = new FileWatcher('/tmp', {
    debounceMs: DEBOUNCE_MS,
    onFileChange: () => {}
  });

  w._onFileChange('/tmp/iso.js', 'change');
  const snap = w.getMetrics();
  snap.eventsReceived = 9999;
  snap.flushCalls = 9999;

  const fresh = w.getMetrics();
  assert.equal(fresh.eventsReceived, 1, 'mutating the snapshot must not affect internal state');
  assert.equal(fresh.flushCalls, 0);
  await wait(FLUSH_WAIT_MS);
  w.stop();
});
