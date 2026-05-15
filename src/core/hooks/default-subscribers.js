'use strict';

/**
 * default-subscribers.js — Registers st8's built-in modules as subscribers
 * to the named hook points exposed by hook-registry.js.
 *
 * Until this file existed, the post-indexing orchestration (schema card
 * emission, manifest generation, gap analysis, intent seeding) lived as
 * inline procedural code inside src/core/server/main.js. The HOOK-
 * ARCHITECTURE-RESEARCH.md doc flagged that as the primary gap: the
 * hook chain was 70% functional but structurally inline.
 *
 * Now the same logic runs as discrete subscribers. Behavior is preserved
 * verbatim. The structural payoff: any future module (Louis lock-panel,
 * external integrations, plugins) can register additional handlers on
 * these same hook points without editing main.js.
 *
 * Usage (from main.js):
 *
 *   const { hookRegistry, HOOKS } = require('../hook-registry');
 *   const { registerDefaultSubscribers } = require('../hooks/default-subscribers');
 *
 *   registerDefaultSubscribers(hookRegistry);
 *   ...
 *   await hookRegistry.execute(HOOKS.INDEX_COMPLETE, { result, targetDir, persistence, emitter, printer });
 */

const path = require('path');
const { HOOKS } = require('../hook-registry');

// Top-level require for the sonic-daemon module. Previously lazy-required
// inside the INDEX_START handler — that meant a moved/deleted module would
// crash only when the hook actually fired (potentially much later than
// bootstrap). Hoisting it surfaces missing-module errors at module load.
//
// Wrapped in try/catch because the sonic feature is optional — st8 must
// boot in SQLite-only mode if the daemon module is somehow unavailable
// (e.g. a partial install, a packaging step that dropped src/features/search).
// On success, sonicDaemon is the module; on failure it's null and the
// subscriber logs + no-ops. Ticket 14.
let sonicDaemon = null;
let sonicDaemonLoadError = null;
try {
  sonicDaemon = require('../../features/search/sonic-daemon');
} catch (err) {
  sonicDaemonLoadError = err;
  console.warn('[st8] Sonic daemon module unavailable at bootstrap:', err.message);
}

// Symbol-tagged flag so the guard cannot collide with any other property a
// caller might set on the registry. Per-registry — fresh `new HookRegistry()`
// instances are unaffected.
const DEFAULTS_REGISTERED = Symbol.for('st8.defaultSubscribersRegistered');

/**
 * Subscribe st8's built-in handlers to the registry.
 *
 * **Idempotent.** Calling this function twice on the same registry is a
 * no-op on the second call — the first call tags the registry with a
 * Symbol-keyed flag and subsequent calls short-circuit. This means tests
 * (or a future refactor that accidentally double-bootstraps) cannot
 * silently double every INDEX_COMPLETE subscriber. Ticket 12.
 *
 * To force a re-register (e.g. in tests that mutate the singleton across
 * cases), call `registry.clear()` first — `clear()` wipes the internal
 * `_hooks` map but not the symbol flag, so we also clear the flag
 * explicitly below if a caller clears() and re-registers.
 */
function registerDefaultSubscribers(registry) {
  if (!registry || typeof registry.register !== 'function') {
    throw new TypeError('registerDefaultSubscribers: needs a HookRegistry');
  }
  if (registry[DEFAULTS_REGISTERED]) {
    // Already registered on this registry — short-circuit. Honest no-op.
    return;
  }
  registry[DEFAULTS_REGISTERED] = true;

  // ─── INDEX_START chain ──────────────────────────────────────
  // P=10 — Sonic daemon spin-up. Optional; if Sonic isn't installed or
  // can't start, this subscriber logs a warning and st8 boots in
  // SQLite-only mode. The sonic-queries layer falls through to SQLite
  // automatically when sonic isn't available, so this is non-fatal.
  registry.register(HOOKS.INDEX_START, async (ctx) => {
    if (!sonicDaemon) {
      // Module failed to load at bootstrap; surfaced once already at module
      // load. Re-log with a more specific tag so the timeline is honest.
      console.warn(
        '[st8] Sonic daemon subscriber no-op (module load failed):',
        sonicDaemonLoadError ? sonicDaemonLoadError.message : 'unknown'
      );
      return;
    }
    try {
      await sonicDaemon.start({ targetDir: ctx.targetDir });
    } catch (err) {
      console.warn('[st8] Sonic daemon start failed:', err.message);
    }
  }, { priority: 10, source: 'sonic-daemon' });

  // ─── INDEX_COMPLETE chain ───────────────────────────────────
  // Runs after the bootstrap Pass-1 upsert + Pass-2 connection wiring.
  // Each subscriber sees the full graph in persistence.

  // P=10 — Manifest generation. First because cards + gap reports may
  // reference manifest paths.
  //
  // Convention (ticket 13): every default subscriber wraps its body in its
  // own try/catch with a module-tagged `[st8] <module> failed: …` log.
  // The registry catch is still active as a safety net but the inner
  // catches provide consistent, debuggable error surfaces across all
  // subscribers (manifest-generator, schema-card-emitter, gap-analyzer,
  // intent-seeder, mutation-log-retention).
  registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
    try {
      const { writeManifests } = require('../../features/schema-cards/manifest-generator');
      writeManifests(ctx.result.files, ctx.targetDir);
      console.log('[st8] Manifests generated');
    } catch (err) {
      console.error('[st8] Manifest generation failed:', err.message);
    }
  }, { priority: 10, source: 'manifest-generator' });

  // P=20 — Schema card emission (batched). The emitter pulls from
  // persistence; printer renders .txt fallback from the emitted cards.
  registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
    try {
      ctx.emitter.emitAllCards(ctx.persistence);
      ctx.printer.printAllFromCards(path.join(ctx.targetDir, '.st8', 'schema-cards'));
      console.log('[st8] Schema cards emitted');
    } catch (err) {
      console.error('[st8] Schema card emission failed:', err.message);
    }
  }, { priority: 20, source: 'schema-card-emitter' });

  // P=30 — Gap analysis (writes .st8/gap-analysis.md). Wrapped in
  // try/catch so a gap-analyzer bug can't break later subscribers.
  registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
    try {
      const { GapAnalyzer } = require('../../features/analysis/gap-analyzer');
      const schemaCardsDir = path.join(ctx.targetDir, '.st8', 'schema-cards');
      const analyzer = new GapAnalyzer(schemaCardsDir, ctx.persistence);
      analyzer.analyze();
      analyzer.writeReport(path.join(ctx.targetDir, '.st8', 'gap-analysis.md'));
      console.log('[st8] Gap analysis written to .st8/gap-analysis.md');
    } catch (err) {
      console.error('[st8] Gap analysis failed:', err.message);
    }
  }, { priority: 30, source: 'gap-analyzer' });

  // P=40 — Intent seeding. Heuristic-fills the file_intent table for
  // files that don't have user-authored intent.
  registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
    try {
      const { IntentSeeder } = require('../../features/analysis/intent-seeder');
      const schemaCardsDir = path.join(ctx.targetDir, '.st8', 'schema-cards');
      const seeder = new IntentSeeder(ctx.persistence, schemaCardsDir, ctx.targetDir);
      const seedResult = seeder.seedAll();
      console.log(`[st8] Intent seeding: ${seedResult.seeded} seeded, ${seedResult.errors} errors`);
    } catch (err) {
      console.error('[st8] Intent seeding failed:', err.message);
    }
  }, { priority: 40, source: 'intent-seeder' });

  // P=50 — file_mutation_log retention (ticket 10, Wave 1B).
  //
  // Policy:
  //   * KEEP forever:  mutationType in ('PRODUCTION','PURGE')
  //   * PRUNE after:   30 days for everything else (CONCEPT / content
  //                    mutations) — bounded by file_mutation_log's
  //                    append-only growth path.
  //
  // Gated to once-per-24h via the st8_settings table
  // ('persistence' / 'mutationLogLastPruneAt') so the prune runs at
  // most once per calendar day even if the indexer is re-run many
  // times. The gate is keyed in UTC ms.
  //
  // Failure isolation: wrapped in try/catch — a prune error must not
  // poison the rest of the INDEX_COMPLETE chain.
  const MUTATION_LOG_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
  const MUTATION_LOG_RETENTION_DAYS = 30;
  registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
    try {
      const persistence = ctx.persistence;
      if (!persistence || typeof persistence.pruneMutationLogRetention !== 'function') {
        return; // older persistence without the helper — no-op.
      }

      const now = Date.now();
      const lastRaw = persistence.getSetting('persistence', 'mutationLogLastPruneAt');
      const lastMs = typeof lastRaw === 'number' ? lastRaw : Number(lastRaw) || 0;
      if (lastMs && now - lastMs < MUTATION_LOG_PRUNE_INTERVAL_MS) {
        // Already pruned within the last 24h — skip silently.
        return;
      }

      const result = persistence.pruneMutationLogRetention(MUTATION_LOG_RETENTION_DAYS);
      persistence.upsertSetting('persistence', 'mutationLogLastPruneAt', now);
      console.log(
        `[st8] file_mutation_log retention: pruned ${result.prunedRows} row(s) older than ${result.retentionDays}d (cutoff ${result.cutoff})`
      );
    } catch (err) {
      console.error('[st8] file_mutation_log retention failed:', err.message);
    }
  }, { priority: 50, source: 'mutation-log-retention' });

  // ─── FILE_INDEXED — fires per-file during the Pass-1 upsert loop ───
  // No default subscribers in this batch; the per-file emission stays in
  // the batched INDEX_COMPLETE path so cards see the full connection
  // graph. This hook is now WIRED and READY for future subscribers
  // (e.g. real-time UI updates, Louis lock-on-indexed checks, etc.).
  //
  // Example of how a future module would subscribe:
  //   registry.register(HOOKS.FILE_INDEXED, async (ctx) => {
  //     await locks.checkAndApply(ctx.file);
  //   }, { source: 'louis-locks' });

  // ─── FILE_AFTER_CHANGE chain ────────────────────────────────
  // Fires once per file-watcher change AFTER the persistence write +
  // mutation_log row commit. Two default subscribers preserve the
  // pre-decomp visible ordering: schema-card-emitter runs first (P=20)
  // so a downstream notification consumer can read the freshly-written
  // card; SSE broadcast (P=30) follows.
  //
  // ctx shape: { change, file, mutation, schemaCard, targetDir, persistence, emitter }
  // file/mutation may be null when _applyFileChange short-circuits
  // (unknown unlink, unchanged hash, read failure); subscribers guard.

  // P=20 — schema-card emission. For CREATE/EDIT, emit a fresh card via
  // the shared emitter (parses AST, joins last-mutation, writes JSON).
  // For DELETE, remove the stale card on disk so it doesn't haunt
  // gap-analyzer's next pass.
  registry.register(HOOKS.FILE_AFTER_CHANGE, async (ctx) => {
    const { change, file, mutation, targetDir, persistence, emitter } = ctx;
    if (!file || !mutation) return;  // no-op apply, nothing to emit

    if (mutation.mutationType === 'DELETE') {
      // Delete stale schema card from disk.
      try {
        const fs = require('fs');
        const cardPath = path.join(
          targetDir,
          '.st8', 'schema-cards',
          file.filepath.replace(/\//g, '_').replace(/\\/g, '_') + '.json'
        );
        if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
      } catch (cardErr) {
        console.error(`[st8] Failed to delete schema card for ${file.filepath}:`, cardErr.message);
      }
      return;
    }

    // CREATE / EDIT — emit a fresh card.
    if (!emitter) return;  // defensive: nothing to do without the shared emitter handle
    try {
      const fullPath = path.join(targetDir, file.filepath);
      let astResult = { imports: [], exports: [] };
      try {
        const { extractImportsAndExports } = require('../../shared/utils/ast-parser');
        astResult = extractImportsAndExports(fullPath);
      } catch (_) { /* AST parse failed — emit with empty imports/exports */ }

      const lastMutation = persistence.getLastMutation(file.fingerprint);
      emitter.emitCard(
        file,
        astResult,
        { importedBy: [], imports: [] },
        null,
        {
          count: persistence.getMutationCount(file.fingerprint),
          lastMutation: lastMutation
            ? { type: lastMutation.mutationType, actor: lastMutation.actor, timestamp: lastMutation.timestamp }
            : { type: '', actor: '', timestamp: '' },
        }
      );
    } catch (cardErr) {
      console.error(`[st8] Failed to emit schema card for ${file.filepath} (${change.type}):`, cardErr.message);
    }
  }, { priority: 20, source: 'file-after-change/schema-card-emitter' });

  // P=30 — SSE broadcast via notification-bus. Runs after the card is
  // written so any consumer reading the bus event has the new card on
  // disk if it wants to load it.
  //
  // Wrapped in try/catch per the ticket-13 convention so a misbehaving
  // notification bus does not bubble out of FILE_AFTER_CHANGE.
  registry.register(HOOKS.FILE_AFTER_CHANGE, async (ctx) => {
    const { file, mutation } = ctx;
    if (!file || !mutation) return;
    try {
      const { notificationBus } = require('../notification-bus');
      notificationBus.publish({
        fingerprint: file.fingerprint,
        filepath: file.filepath,
        mutationType: mutation.mutationType,
        actor: mutation.actor,
        sha256Hash: mutation.sha256Hash,
      });
    } catch (err) {
      console.error('[st8] SSE broadcast failed:', err.message);
    }
  }, { priority: 30, source: 'file-after-change/sse-broadcaster' });
}

/**
 * Reset the idempotency flag on a registry. Tests that call `clear()` and
 * want to re-register the defaults should call this too. Not needed for
 * fresh `new HookRegistry()` instances.
 */
function _resetDefaultSubscribersFlag(registry) {
  if (registry) delete registry[DEFAULTS_REGISTERED];
}

module.exports = {
  registerDefaultSubscribers,
  _resetDefaultSubscribersFlag,
  DEFAULTS_REGISTERED,
};
