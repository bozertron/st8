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

/**
 * Subscribe st8's built-in handlers to the registry. Idempotent —
 * registering twice will fire each handler twice, so callers should
 * only call this once during bootstrap.
 */
function registerDefaultSubscribers(registry) {
  if (!registry || typeof registry.register !== 'function') {
    throw new TypeError('registerDefaultSubscribers: needs a HookRegistry');
  }

  // ─── INDEX_COMPLETE chain ───────────────────────────────────
  // Runs after the bootstrap Pass-1 upsert + Pass-2 connection wiring.
  // Each subscriber sees the full graph in persistence.

  // P=10 — Manifest generation. First because cards + gap reports may
  // reference manifest paths.
  registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
    const { writeManifests } = require('../../features/schema-cards/manifest-generator');
    writeManifests(ctx.result.files, ctx.targetDir);
    console.log('[st8] Manifests generated');
  }, { priority: 10, source: 'manifest-generator' });

  // P=20 — Schema card emission (batched). The emitter pulls from
  // persistence; printer renders .txt fallback from the emitted cards.
  registry.register(HOOKS.INDEX_COMPLETE, async (ctx) => {
    ctx.emitter.emitAllCards(ctx.persistence);
    ctx.printer.printAllFromCards(path.join(ctx.targetDir, '.st8', 'schema-cards'));
    console.log('[st8] Schema cards emitted');
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
}

module.exports = { registerDefaultSubscribers };
