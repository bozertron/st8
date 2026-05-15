'use strict';

/**
 * hook-registry.js — Named hook system for ST8.
 *
 * Extends Node's EventEmitter with:
 *   - Named hook points (`file:indexed`, `index:complete`, etc.)
 *   - Priority-ordered subscribers (lower priority runs first; default 100)
 *   - Async-aware execution (handlers may return promises; runner awaits each)
 *   - Per-subscriber "source" tag for introspection (which module registered)
 *   - Try/catch per handler so one bad subscriber doesn't break others
 *
 * Replaces the inline hook chain that previously lived in
 * `backend/index.js` (now src/core/server/main.js). The HOOK-ARCHITECTURE-
 * RESEARCH.md doc identified that hook chain as 70% realized but
 * structurally inline — this module is the §8.1 fix.
 *
 * Usage:
 *
 *   const { HookRegistry, HOOKS } = require('./hook-registry');
 *   const registry = new HookRegistry();
 *
 *   // Register a handler — runs after persistence has written each file.
 *   registry.register(HOOKS.FILE_INDEXED, async (ctx) => {
 *     await ctx.emitter.emitCardForFile(ctx.file);
 *   }, { priority: 100, source: 'schema-card-emitter' });
 *
 *   // Fire the hook from anywhere with full context.
 *   await registry.execute(HOOKS.FILE_INDEXED, { file, persistence, emitter });
 *
 *   // Introspect.
 *   registry.listHooks();           // -> [{ name, count, sources }]
 */

const { EventEmitter } = require('events');

// Canonical hook point names. Source of truth — both publishers and
// subscribers should import from here rather than passing string literals.
const HOOKS = Object.freeze({
  // Bootstrap / batch lifecycle
  INDEX_START:    'index:start',        // { targetDir }
  INDEX_COMPLETE: 'index:complete',     // { targetDir, persistence, result }

  // Per-file lifecycle (fires once per file as the indexer commits its identity)
  FILE_INDEXED:        'file:indexed',         // { file, targetDir, persistence }

  // File-change lifecycle (file watcher → mutation chain)
  FILE_BEFORE_CHANGE:  'file:before-change',   // { change, targetDir, persistence }
  FILE_AFTER_CHANGE:   'file:after-change',    // { change, file, mutation, schemaCard, targetDir, persistence }

  // Lifecycle transitions (bruno+oscar territory)
  LIFECYCLE_TRANSITION: 'lifecycle:transition', // { file, oldPhase, newPhase }

  // Commit recorded — fires after a git post-commit hook POSTs to
  // /api/record-commit. Distinct from LIFECYCLE_TRANSITION because the
  // payload is a commit object, not a file-phase change.
  COMMIT_RECORDED: 'commit:recorded',           // { commit: {hash, shortHash, subject, author, timestamp, branch, filesChanged} }

  // PRD generation
  PRD_GENERATE: 'prd:generate',                 // { targetDir, options }

  // Ticket created from a particle click + user note. Subscribers:
  // future Sonic ticket-indexer; phreak> TUI badge counter; etc.
  // Payload contract is explicit — publisher is _handleTickets in app.js.
  TICKET_CREATED: 'ticket:created',             // { ticket: {id, fingerprint, filepath, userNote, sha256Hash, statusAtCreation, identityBundle, createdAt} }
});

class HookRegistry extends EventEmitter {
  constructor() {
    super();
    // Map<hookName, Array<{handler, priority, source, registeredAt}>>
    this._hooks = new Map();
    // Optional logging — set to true to console.log each execution.
    this.verbose = false;
  }

  /**
   * Register a handler for a named hook.
   * @param {string} name - Hook name (use HOOKS constants for canonical names)
   * @param {Function} handler - Receives a context object; may be async
   * @param {{priority?: number, source?: string}} [options]
   * @returns {Function} unregister function
   */
  register(name, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new TypeError(`HookRegistry.register: handler for "${name}" must be a function`);
    }
    const entry = {
      handler,
      priority: typeof options.priority === 'number' ? options.priority : 100,
      source: options.source || 'unknown',
      registeredAt: new Date().toISOString(),
    };
    if (!this._hooks.has(name)) this._hooks.set(name, []);
    const arr = this._hooks.get(name);
    arr.push(entry);
    arr.sort((a, b) => a.priority - b.priority);

    return () => this.unregister(name, handler);
  }

  /**
   * Remove a previously-registered handler.
   * @returns {boolean} true if a handler was removed
   */
  unregister(name, handler) {
    const arr = this._hooks.get(name);
    if (!arr) return false;
    const idx = arr.findIndex((e) => e.handler === handler);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    return true;
  }

  /**
   * Execute all handlers for a hook, in priority order, awaiting each.
   * Per-handler exceptions are caught + logged; one bad subscriber does
   * not break others (same policy as notification-bus.js).
   *
   * Zero-subscriber fast path: when no registered handler exists AND no
   * EventEmitter `.on()` listener is attached, return the empty summary
   * synchronously (still returned via the async wrapper so callers can
   * `await`). This matters for per-file hooks fired in tight loops —
   * `FILE_INDEXED` fires once per file in the bootstrap upsert path and
   * is by design without default subscribers. The fast path skips
   * Promise allocation + microtask flush + EventEmitter dispatch for the
   * common no-op case. Measured: ~0.8 ms saved across 283 fires on a
   * 281-file project (negligible in absolute terms, but the saving
   * compounds for any hot per-file hook and the path is provably safe
   * because both EventEmitter listenerCount and the _hooks map are
   * authoritative).
   *
   * @returns {Promise<{ok: number, fail: number, errors: Array<{source, error}>}>}
   */
  async execute(name, ctx = {}) {
    const arr = this._hooks.get(name);
    // Fast path: nothing registered and nothing listening — skip the whole
    // dance. Equivalent to the loop+emit producing zero side-effects.
    if ((!arr || arr.length === 0) && this.listenerCount(name) === 0) {
      if (this.verbose) console.log(`[hooks] execute "${name}" (0 subscribers — fast path)`);
      return { ok: 0, fail: 0, errors: [] };
    }
    const handlers = arr || [];
    const summary = { ok: 0, fail: 0, errors: [] };
    if (this.verbose) console.log(`[hooks] execute "${name}" (${handlers.length} subscriber${handlers.length === 1 ? '' : 's'})`);
    for (const entry of handlers) {
      try {
        await entry.handler(ctx);
        summary.ok++;
      } catch (err) {
        summary.fail++;
        summary.errors.push({ source: entry.source, error: err.message });
        console.error(`[hooks] "${name}" subscriber "${entry.source}" threw:`, err.message);
      }
    }
    // Also emit as a plain EventEmitter event so existing notificationBus-style
    // consumers can subscribe via .on() if they prefer.
    try { this.emit(name, ctx); } catch (_) { /* keep going */ }
    return summary;
  }

  /**
   * Introspection — list every registered hook + its subscribers.
   *
   * Each entry's `sources` is sorted by priority ascending so the order
   * matches the order `execute()` will invoke handlers. A `runOrder`
   * field holds just the source names in execution order — convenient
   * for consumers that only need the order, not the priorities.
   *
   * Hooks declared in the canonical HOOKS map but with zero subscribers are
   * NOT returned here — see `listAllHooks()` for that view.
   */
  listHooks() {
    const out = [];
    for (const [name, arr] of this._hooks.entries()) {
      // Sort by priority ascending so consumers see execution order at a
      // glance. Within a priority tier, registration order is preserved.
      const ordered = arr
        .map((e) => ({ source: e.source, priority: e.priority }))
        .sort((a, b) => a.priority - b.priority);
      out.push({
        name,
        count: arr.length,
        sources: ordered,
        runOrder: ordered.map((e) => e.source),
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Introspection — list every CANONICAL hook from the HOOKS map joined with
   * its registered subscriber count. Hooks with zero subscribers appear with
   * `count: 0` and `sources: []`. Useful for debugging plugin load order or
   * verifying that all expected defaults registered.
   *
   * Returns the same shape as listHooks() but with full coverage of the
   * canonical map plus any extra hooks registered under non-HOOKS names.
   */
  listAllHooks() {
    const byName = new Map();
    // Seed with the canonical map so zero-subscriber hooks appear too.
    for (const canonicalName of Object.values(HOOKS)) {
      byName.set(canonicalName, { name: canonicalName, count: 0, sources: [], runOrder: [] });
    }
    // Overlay actually-registered hooks (including any non-canonical names).
    for (const entry of this.listHooks()) {
      byName.set(entry.name, entry);
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Introspection — return the source names that will run for `name`, in
   * the exact priority order `execute()` will invoke them. Empty array if
   * no subscribers are registered. Cheaper than `listHooks()` when a caller
   * only needs the order for one hook.
   */
  introspectExecuteOrder(name) {
    const arr = this._hooks.get(name) || [];
    return arr
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((e) => e.source);
  }

  /**
   * Remove all subscribers (mainly for test isolation).
   */
  clear() {
    this._hooks.clear();
    this.removeAllListeners();
  }
}

// Singleton instance — the rest of st8 imports this so all subscribers land
// on the same registry. Tests can construct fresh HookRegistry() instances.
const hookRegistry = new HookRegistry();

module.exports = {
  HookRegistry,
  hookRegistry,
  HOOKS,
};
