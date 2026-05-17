#!/usr/bin/env node

/**
 * ST8 Manifest Generator
 *
 * Generates connection-state.json and ai-signal.toml manifests.
 * References maestro-scaffolder-tool code for TOML serialization.
 * DO NOT copy files from maestro. Import/require by path.
 *
 * ─── INTENTIONAL OMISSIONS FROM connection-state.json ─────────
 * (identity-and-analysis ticket 8, roadmap P2.5)
 *
 * The per-file entries emitted by generateConnectionState() OMIT
 * two fields that are present on the canonical St8SchemaCard shape
 * (src/shared/types/st8-types.js): `lifecyclePhase` and
 * `birthTimestamp`. This is by design — load-bearing — and dates
 * back to the batch 025 deep dive. DO NOT add either field to the
 * `files.map(...)` projection below without first reading the
 * reasoning in this header.
 *
 *   1. `birthTimestamp` is already encoded inside `fingerprint`
 *      (format: `<filepath>||<ISO-timestamp>`, see
 *      generateFingerprint() in st8-types.js). Emitting it as a
 *      separate top-level field would create two identity surfaces
 *      that consumers could disagree on — exactly the failure mode
 *      st8 exists to prevent. After Wave 3A's birthTimestamp REUSE
 *      work (src/shared/utils/birth-timestamp.js), persistence is
 *      the canonical authority for birthTimestamp across runs; the
 *      manifest defers to that via `fingerprint`. Consumers wanting
 *      the timestamp should `parseFingerprint(fingerprint)`.
 *
 *   2. `lifecyclePhase` (CONCEPT / DEVELOPMENT / PRODUCTION) is
 *      identity-internal and lives in `file_registry` for the
 *      production-promotion workflow. It is NOT consumer-facing on
 *      the manifest surface — UI views that care (file-explorer,
 *      dive-in) read it directly from /api/files. Adding it to
 *      `connection-state.json` would (a) imply external consumers
 *      should branch on it without the surrounding workflow context
 *      and (b) bloat the manifest for the common case where no UI
 *      cares about the per-file phase at manifest read-time.
 *
 * If a future need surfaces (e.g. external tooling that wants a
 * static snapshot of phases without hitting /api/files), prefer a
 * separate `connection-state-lifecycle.json` companion artefact
 * over expanding this manifest's contract.
 *
 * The canonical St8SchemaCard shape in st8-types.js carries a
 * matching annotation referencing this comment block as the
 * load-bearing-omission rationale.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── LIB CODE REFERENCES ─────────────────────────────────────
// Post-batch-007: tomlSerializer has moved to src/features/integr8/. The
// dynamic LIB_DIR walk-up from batch 004 is retired in favor of a direct
// require. The loadLibModule pattern is kept for parity with persistence.js
// and for the graceful-fallback behavior (returns null on failure).

let _tomlSerializer = null;

function loadLibModule(modulePath) {
    try {
        return require(modulePath);
    } catch (err) {
        console.error(`[st8:manifest] Failed to load module: ${modulePath}`, err.message);
        return null;
    }
}

function getTomlSerializer() {
    if (!_tomlSerializer) {
        _tomlSerializer = loadLibModule('../integr8/toml-serializer');
    }
    return _tomlSerializer;
}

// ─── JSON MANIFEST ───────────────────────────────────────────

function generateConnectionState(files, targetDir, options = {}) {
    // Batch 032 (QW-1) — hydrate the manifest with three pieces of
    // already-computed data that previously hit a wall here:
    //
    //   1. `importedBy[]` — pre-fix the field was declared (the legacy
    //      `importedBy: f.importedBy || []` projection) but the upstream
    //      `f.importedBy` was never populated. Live probe pre-fix: 0 of
    //      322 files had a non-empty array. We now reverse-walk the
    //      connections table (when options.persistence is provided) so
    //      each file gets the list of files that import it, rendered as
    //      filepaths (graph-viewer joins on filepath, not fingerprint).
    //
    //   2. `cycles` — the SCC list from persistence-cycle-detector
    //      (batch 031) was previously discarded at indexer.js:269 and
    //      never reached the manifest. We surface it in
    //      `manifest.metadata.cycles` so constellation / graph-viewer
    //      can highlight cycle members without a separate /api/insights
    //      round-trip.
    //
    //   3. `imports[].targetFilepath` — when persistence is available,
    //      each parsed import gets its resolved target filepath added.
    //      Graph-viewer can then draw edges by exact filepath lookup
    //      instead of the current filename guess.
    //
    // Cost on st8-on-itself: O(N) extra prepared-statement reads per
    // index pass. Per-file cost is microseconds; negligible vs. parse.
    //
    // Backward compatibility: callers that don't pass options
    // (e.g. legacy tests) get the prior projection — empty importedBy,
    // no targetFilepath, empty cycles array.
    const persistence = options.persistence || null;
    const cycles = Array.isArray(options.cycles) ? options.cycles : [];

    // Pre-compute fingerprint→filepath so importedBy + targetFilepath
    // render human-readable paths instead of raw `<path>||<ts>` blobs.
    const fingerprintToPath = new Map();
    for (const f of files) {
        if (f && f.fingerprint && f.filepath) {
            fingerprintToPath.set(f.fingerprint, f.filepath);
        }
    }

    function importedByForFile(fingerprint) {
        if (!persistence || !fingerprint) return [];
        try {
            const all = persistence.getConnectionsForFile(fingerprint);
            return all
                .filter(c => c.targetFingerprint === fingerprint)
                .map(c => fingerprintToPath.get(c.sourceFingerprint) || c.sourceFingerprint);
        } catch (_) {
            return [];
        }
    }

    function resolveImports(rawImports, sourceFingerprint) {
        if (!Array.isArray(rawImports)) return [];
        if (!persistence || !sourceFingerprint) {
            return rawImports.slice();
        }
        let specToTarget;
        try {
            const all = persistence.getConnectionsForFile(sourceFingerprint);
            specToTarget = new Map(
                all.filter(c => c.sourceFingerprint === sourceFingerprint)
                   .map(c => [c.importSpecifier, c.targetFingerprint])
            );
        } catch (_) {
            return rawImports.slice();
        }
        return rawImports.map(imp => {
            const targetFp = specToTarget.get(imp.source);
            const targetFilepath = targetFp ? fingerprintToPath.get(targetFp) || null : null;
            return targetFilepath ? Object.assign({}, imp, { targetFilepath }) : imp;
        });
    }

    const manifest = {
        metadata: {
            timestamp: new Date().toISOString(),
            targetDirectory: targetDir,
            totalFiles: files.length,
            statusCounts: {
                GREEN: files.filter(f => f.status === 'GREEN').length,
                YELLOW: files.filter(f => f.status === 'YELLOW').length,
                RED: files.filter(f => f.status === 'RED').length
            },
            // Batch 032 (QW-1): rotation-invariant SCC participant sets.
            // Empty for healthy / acyclic projects (the normal case).
            cycles: cycles.map(c => ({
                files: Array.isArray(c && c.files) ? c.files.slice() : []
            }))
        },
        // NB: expression-body arrow is load-bearing — the
        // tier-1-schema-contracts.test.js extractor (P1.2) parses the
        // `files.map(f => ({ ... }))` form to verify the projection's
        // consumed-fields set. Block-bodied refactors break that contract test.
        files: files.map(f => ({
            fingerprint: f.fingerprint || f.sha256Hash,
            filepath: f.filepath,
            filename: f.filename,
            status: f.status,
            reachabilityScore: f.reachabilityScore || 0.0,
            impactRadius: f.impactRadius || 0,
            sha256Hash: f.sha256Hash,
            imports: resolveImports(f.imports, f.fingerprint || f.sha256Hash),
            importedBy: (Array.isArray(f.importedBy) && f.importedBy.length > 0)
                ? f.importedBy.slice()
                : importedByForFile(f.fingerprint || f.sha256Hash),
            intent: f.intent || {
                purpose: '',
                dependsOnBehavior: '',
                valueStatement: ''
            }
        }))
    };

    return manifest;
}

// ─── TOML MANIFEST ───────────────────────────────────────────

function escapeTomlString(value) {
    if (typeof value !== 'string') return String(value);
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

function generateAiSignalToml(files, targetDir) {
    const tomlSerializer = getTomlSerializer();
    
    // Try to use maestro's TOML serializer
    if (tomlSerializer && typeof tomlSerializer.serializeGraphMetadataToToml === 'function') {
        try {
            const metadata = {
                version: '1.0',
                generatedAt: new Date().toISOString(),
                targetDirectory: targetDir,
                totalFiles: files.length,
                statusDistribution: {
                    green: files.filter(f => f.status === 'GREEN').length,
                    yellow: files.filter(f => f.status === 'YELLOW').length,
                    red: files.filter(f => f.status === 'RED').length
                }
            };
            return tomlSerializer.serializeGraphMetadataToToml(metadata);
        } catch (err) {
            console.warn('[st8:manifest] Maestro TOML serializer failed, using manual generation');
        }
    }
    
    // Manual TOML generation
    let toml = `# AI Signal Manifest
version = "1.0"
generated_at = "${escapeTomlString(new Date().toISOString())}"
target_directory = "${escapeTomlString(targetDir)}"

[status_distribution]
green = ${files.filter(f => f.status === 'GREEN').length}
yellow = ${files.filter(f => f.status === 'YELLOW').length}
red = ${files.filter(f => f.status === 'RED').length}

`;
    
    for (const file of files) {
        toml += `[[files]]
path = "${escapeTomlString(file.filepath)}"
status = "${escapeTomlString(file.status)}"
reachability_score = ${file.reachabilityScore || 0.0}
impact_radius = ${file.impactRadius || 0}

[files.ai_signal]
core_responsibility = "${escapeTomlString((file.intent && file.intent.purpose) || '')}"
can_be_archived = ${file.status === 'RED' && (file.impactRadius || 0) === 0}

`;
    }
    
    return toml;
}

// ─── WRITE MANIFESTS ─────────────────────────────────────────

function writeManifests(files, targetDir, options = {}) {
    const jsonPath = path.join(targetDir, 'connection-state.json');
    const tomlPath = path.join(targetDir, 'ai-signal.toml');

    try {
        // Write JSON manifest. options ({ persistence, cycles }) is
        // passed through to generateConnectionState so the hydration
        // (importedBy / targetFilepath / cycles) lands in the output.
        const jsonManifest = generateConnectionState(files, targetDir, options);
        fs.writeFileSync(jsonPath, JSON.stringify(jsonManifest, null, 2));
        console.log(`[st8:manifest] JSON manifest written to: ${jsonPath}`);
        
        // Write TOML manifest
        const tomlContent = generateAiSignalToml(files, targetDir);
        fs.writeFileSync(tomlPath, tomlContent);
        console.log(`[st8:manifest] TOML manifest written to: ${tomlPath}`);
        
        return { jsonPath, tomlPath };
    } catch (err) {
        console.error('[st8:manifest] Error writing manifests:', err.message);
        return null;
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    generateConnectionState,
    generateAiSignalToml,
    writeManifests
};
