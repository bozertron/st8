#!/usr/bin/env node

/**
 * birth-timestamp — identity-preserving birthTimestamp derivation
 *
 * The fingerprint contract (docs/components/identity-and-analysis.md §1):
 *
 *     fingerprint = "<filepath>||<ISO-birthTimestamp>"
 *
 * birthTimestamp is "set once at creation, never changes" (st8-types.js
 * St8FileEntry comment). Identity (mutation_log, intent, connections,
 * tickets) hangs off fingerprint. A mutated birthTimestamp silently
 * cuts the identity thread.
 *
 * THE BUG THIS MODULE FIXES (identity-and-analysis ticket 15)
 * ──────────────────────────────────────────────────────────
 *
 * Two call sites — indexer.js:380 and main.js:106 — were:
 *
 *     const birthTimestamp = stat.birthtime
 *         ? stat.birthtime.toISOString()
 *         : stat.mtime.toISOString();
 *
 * Two problems:
 *
 *   (1) `stat.birthtime` is ALWAYS a Date object on Node — never falsy.
 *       The ternary fallback was dead code. On filesystems that don't
 *       record birthtime (ext3, certain NFS configs, some FUSE mounts),
 *       Node returns the Unix epoch (`1970-01-01T00:00:00.000Z`). The
 *       fingerprint then becomes `<filepath>||1970-01-01T00:00:00.000Z` —
 *       technically stable but identity-meaningless: every file claims
 *       the same birth, and a later git-checkout that flips mtime is
 *       indistinguishable from a real creation.
 *
 *   (2) When birthtime is reliable BUT we re-derive from disk every
 *       indexer run, a `touch` / `git checkout <old-rev>` / `rsync`
 *       without `-p` can shift mtime. If birthtime is ALSO unavailable
 *       (case 1), the next indexer pass derives a DIFFERENT timestamp
 *       and the fingerprint changes silently. mutation_log, intent,
 *       and connections rows point at a dead fingerprint.
 *
 * THE FIX (option b + a-lite from ticket 15's brief)
 * ──────────────────────────────────────────────────
 *
 *   - Detect epoch/unreliable birthtime explicitly.
 *   - When persistence is available, REUSE the first-observed
 *     birthTimestamp for a filepath — the persisted fingerprint
 *     wins over any newly-derived value. This is the identity-
 *     preserving move: once st8 has stamped a file with a birth,
 *     that birth IS the file's birth for the duration of st8's
 *     observation.
 *   - When persistence is unavailable (CLI one-shot, fresh DB) AND
 *     stat.birthtime is epoch, fall back to mtime AND log
 *     `[st8:identity-risk]` so the fallback is visible in stderr.
 *   - Return both the timestamp AND an `origin` tag so callers can
 *     surface fallback events to introspection / force-checks.
 *
 * @module shared/utils/birth-timestamp
 */

'use strict';

// A birthtime value is "unreliable" if it's the Unix epoch (filesystem
// doesn't record creation) or pre-1980 (sentinel returned by some FUSE
// filesystems instead of epoch). Real files in 2026 have birthtimes
// well after these thresholds.
const UNRELIABLE_BIRTHTIME_CUTOFF_MS = new Date('1980-01-01T00:00:00.000Z').getTime();

/**
 * @param {fs.Stats} stat - result of fs.statSync()
 * @returns {boolean} true if stat.birthtime is the epoch or pre-1980 sentinel
 */
function isUnreliableBirthtime(stat) {
    if (!stat || !stat.birthtime) return true;
    const ms = stat.birthtime.getTime();
    if (!Number.isFinite(ms)) return true;
    return ms < UNRELIABLE_BIRTHTIME_CUTOFF_MS;
}

/**
 * Derive a stable birthTimestamp for a file.
 *
 * Resolution order:
 *   1. If persistence is provided and has a prior fingerprint for this
 *      filepath, REUSE the persisted birthTimestamp. This is the
 *      identity-preservation path — first observation wins.
 *   2. Else if stat.birthtime is reliable (not epoch / pre-1980), use it.
 *   3. Else fall back to mtime AND log `[st8:identity-risk]`. The
 *      fallback timestamp WILL drift on future `touch`/checkout events;
 *      reporter.recordFallback (if provided) lets a downstream
 *      surface (e.g. introspectSchema / force-checks) count these.
 *
 * @param {object} args
 * @param {fs.Stats} args.stat
 * @param {string} args.filepath - relative path (the key for persistence lookup)
 * @param {object} [args.persistence] - optional St8Persistence with getFileByPath
 * @param {object} [args.reporter] - optional { recordFallback(filepath) } sink
 * @param {boolean} [args.silent] - suppress the warning log (used by tests)
 * @returns {{ birthTimestamp: string, origin: 'stat-birthtime'|'mtime-fallback'|'reused-persisted' }}
 */
function deriveBirthTimestamp({ stat, filepath, persistence, reporter, silent = false }) {
    // (1) Persistence-backed reuse — identity preservation across runs.
    if (persistence && typeof persistence.getFileByPath === 'function') {
        try {
            const existing = persistence.getFileByPath(filepath);
            if (existing && existing.birthTimestamp) {
                return { birthTimestamp: existing.birthTimestamp, origin: 'reused-persisted' };
            }
        } catch (err) {
            // Persistence may be in a weird state during boot. Log loudly but
            // don't crash identity derivation — fall through to stat.
            if (!silent) {
                console.error(`[st8:identity-risk] persistence.getFileByPath threw for ${filepath}:`, err.message);
            }
        }
    }

    // (2) Reliable stat.birthtime path — the happy case.
    if (!isUnreliableBirthtime(stat)) {
        return { birthTimestamp: stat.birthtime.toISOString(), origin: 'stat-birthtime' };
    }

    // (3) Unreliable birthtime — fall back to mtime and surface the risk.
    const fallbackMs = stat && stat.mtime ? stat.mtime.getTime() : Date.now();
    const birthTimestamp = new Date(fallbackMs).toISOString();
    if (!silent) {
        console.warn(
            `[st8:identity-risk] ${filepath}: stat.birthtime unreliable ` +
            `(${stat && stat.birthtime ? stat.birthtime.toISOString() : 'undefined'}); ` +
            `falling back to mtime=${birthTimestamp}. Fingerprint will drift if mtime changes ` +
            `before persistence captures the first observation.`
        );
    }
    if (reporter && typeof reporter.recordFallback === 'function') {
        try {
            reporter.recordFallback(filepath, birthTimestamp);
        } catch (err) {
            // Reporter is best-effort. Surface but don't abort.
            if (!silent) {
                console.error(`[st8:identity-risk] reporter.recordFallback threw:`, err.message);
            }
        }
    }
    return { birthTimestamp, origin: 'mtime-fallback' };
}

/**
 * Make a reporter that accumulates fallback observations in memory.
 * Used by indexer.js so the post-index hook chain can emit a single
 * summary line + a .st8/identity-risk.json artifact instead of N
 * console.warn lines.
 *
 * @returns {{ recordFallback(filepath, ts): void, summary(): {count: number, filepaths: string[]} }}
 */
function createFallbackReporter() {
    const records = [];
    return {
        recordFallback(filepath, ts) {
            records.push({ filepath, birthTimestamp: ts });
        },
        summary() {
            return {
                count: records.length,
                filepaths: records.map((r) => r.filepath),
                records: records.slice(),
            };
        },
    };
}

module.exports = {
    deriveBirthTimestamp,
    isUnreliableBirthtime,
    createFallbackReporter,
    UNRELIABLE_BIRTHTIME_CUTOFF_MS,
};
