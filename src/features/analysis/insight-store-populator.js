'use strict';

/**
 * insight-store-populator.js — Walks file_registry after each indexer
 * pass and writes per-file insights to the InsightRecords table.
 *
 * This is the producer side of P1.2 in
 * docs/_pending-roadmap/identity-and-analysis.md ("Wire insight-store.js
 * as INDEX_COMPLETE subscriber"). Wave 3B ticket 7.
 *
 * Insight categories produced:
 *
 *   - orphan          (severity=error)   RED status file: no incoming
 *                                        connections AND no exports
 *                                        (impactRadius === 0)
 *   - under-connected (severity=warning) YELLOW status file
 *   - under-imported  (severity=warning) GREEN status with
 *                                        reachabilityScore < 0.3
 *   - high-impact     (severity=info)    impactRadius >= 10 — the
 *                                        "this file moves a lot of
 *                                        weight" tag the dive-in panel
 *                                        will surface.
 *
 * Project id defaults to 'st8' — single-project assumption for now.
 *
 * Idempotency: clearProject(projectId) is called at the top so the
 * second run of a pass doesn't double-count. We treat the insight
 * store as a snapshot derived from the current file_registry state,
 * not an append-only log. (file_mutation_log is the append-only log;
 * insights mirror current state.)
 *
 * Returns { files, inserted, severityCounts } so the subscriber can
 * log a useful summary.
 */

const fs = require('fs');
const path = require('path');
const insightStoreModule = require('./insight-store');
const { getSharedDatabasePath } = require('../../core/database/graph-persister');

const SEVERITY = { ERROR: 'error', WARNING: 'warning', INFO: 'info' };

function populateInsightsFromRegistry(persistence, options = {}) {
  if (!persistence || typeof persistence.getAllFiles !== 'function') {
    throw new TypeError('insight-store-populator: persistence with getAllFiles required');
  }

  const projectId = options.projectId || 'st8';
  const passNumber = options.passNumber || Date.now();

  // The InsightStore constructor delegates to better-sqlite3 directly
  // and does NOT mkdir parent dirs (DatabasePersister does, InsightStore
  // doesn't — different code paths in the maestro vendored sources).
  // On a fresh box the shared maestro data dir may not exist; we create
  // it here so getInsightStore() at the singleton boundary can open the
  // file without "directory does not exist" errors.
  if (!options.store) {
    try {
      const sharedPath = getSharedDatabasePath();
      fs.mkdirSync(path.dirname(sharedPath), { recursive: true });
    } catch (err) {
      // If mkdir fails (read-only filesystem etc.), let the subsequent
      // better-sqlite3 open call surface the real error.
    }
  }

  // Late binding via the module reference (not a destructure at top)
  // so tests can swap getInsightStore on the module to point at a temp db.
  // Also allows callers to inject a pre-built store via options.store.
  const store = options.store || insightStoreModule.getInsightStore();
  // Snapshot semantics: drop prior insights for this project before
  // re-seeding from the current file_registry state.
  store.clearProject(projectId);

  const files = persistence.getAllFiles();

  // Dedup by filepath, newest birthTimestamp wins (matches the
  // schema-card emitter contract — see Wave 3A ticket 9).
  const filesByPath = new Map();
  for (const f of files) {
    const existing = filesByPath.get(f.filepath);
    if (!existing || (f.birthTimestamp || '') > (existing.birthTimestamp || '')) {
      filesByPath.set(f.filepath, f);
    }
  }
  const dedupedFiles = Array.from(filesByPath.values());

  const insights = [];
  const severityCounts = { error: 0, warning: 0, info: 0 };

  for (const file of dedupedFiles) {
    const status = file.status || 'RED';
    const impactRadius = typeof file.impactRadius === 'number' ? file.impactRadius : 0;
    const reachability = typeof file.reachabilityScore === 'number' ? file.reachabilityScore : 0;

    const fileId = store.ensureFileSlot(projectId, file.filepath);

    const baseRecord = {
      projectId,
      fileId,
      filePath: file.filepath,
      passNumber,
      evidence: `status=${status}, reachabilityScore=${reachability}, impactRadius=${impactRadius}`,
      relatedNodeIds: [],
      context: { fingerprint: file.fingerprint, sha256Hash: file.sha256Hash },
    };

    if (status === 'RED' && impactRadius === 0) {
      insights.push({
        ...baseRecord,
        category: 'orphan',
        severity: SEVERITY.ERROR,
        description: `Orphan file: no incoming connections and no transitive impact. Either dead code or a missing wire-up.`,
      });
      severityCounts.error += 1;
    } else if (status === 'RED') {
      insights.push({
        ...baseRecord,
        category: 'red-status',
        severity: SEVERITY.ERROR,
        description: `RED status: classification flagged the file as broken. Impact radius ${impactRadius} means downstream effects.`,
      });
      severityCounts.error += 1;
    } else if (status === 'YELLOW') {
      insights.push({
        ...baseRecord,
        category: 'under-connected',
        severity: SEVERITY.WARNING,
        description: `YELLOW status: partial wiring detected. Reachability ${reachability.toFixed ? reachability.toFixed(2) : reachability}.`,
      });
      severityCounts.warning += 1;
    } else if (status === 'GREEN' && reachability < 0.3) {
      insights.push({
        ...baseRecord,
        category: 'under-imported',
        severity: SEVERITY.WARNING,
        description: `GREEN but low reachability (${reachability.toFixed ? reachability.toFixed(2) : reachability}). File is wired but downstream visibility is thin.`,
      });
      severityCounts.warning += 1;
    }

    if (impactRadius >= 10) {
      insights.push({
        ...baseRecord,
        category: 'high-impact',
        severity: SEVERITY.INFO,
        description: `High-impact node: impactRadius=${impactRadius}. Changes here ripple widely — handle with care.`,
      });
      severityCounts.info += 1;
    }
  }

  const inserted = store.addInsightsBatch(insights);

  return {
    files: dedupedFiles.length,
    inserted,
    severityCounts,
    projectId,
  };
}

module.exports = {
  populateInsightsFromRegistry,
};
