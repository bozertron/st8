'use strict';

/**
 * persistence-cycle-detector — detect cycles directly from st8.sqlite.
 *
 * Batch 030 follow-up. The cycle-insight-emitter subscriber gets cycle
 * data from `ctx.result.cycles`, which comes from
 * `src/features/graph/builder.js:detectCircularDependencies` running
 * over the integr8 graph. For st8-on-itself, that graph has only ~1
 * edge (Vue/Pinia/Tauri parsers don't extract generic JS imports), so
 * 0 cycles are detected and the subscriber stays silent.
 *
 * This module is the alternate source: run textbook Tarjan SCC over
 * st8's OWN `file_registry` + `connections` tables. The connections
 * table is populated by main.js's Pass-2 wiring (currently a substring
 * matcher — see batch 030 bible entry) and has 279 rows for
 * st8-on-itself. Real cycles like `app.js ↔ auth.js` should surface.
 *
 * Output shape matches `builder.js`'s `detectCircularDependencies`:
 *   { cycle: [fp1, fp2, ...], files: [path1, path2, ...] }
 *
 * That contract lets the cycle-insight-emitter consume either source
 * (or both, merged + deduped) without any per-source plumbing.
 *
 * Reuses the textbook Tarjan SCC implementation in relationship-
 * analyzer.js (I-07). That function was previously dead code — only
 * called from the dormant integr8 CLI. This wires it into the live
 * INDEX_COMPLETE chain.
 */

const { computeTarjanSCC } = require('./relationship-analyzer');

/**
 * Run Tarjan SCC over the live st8.sqlite graph and return cycles in
 * the same `{cycle, files}` shape builder.js emits.
 *
 * @param {object} persistence  An St8Persistence instance.
 * @returns {Array<{cycle: string[], files: string[]}>}
 */
function detectCyclesFromPersistence(persistence) {
    if (!persistence || typeof persistence.getAllFiles !== 'function'
        || typeof persistence.getAllConnections !== 'function') {
        return [];
    }

    const files = persistence.getAllFiles();
    const connections = persistence.getAllConnections();

    if (!Array.isArray(files) || files.length === 0
        || !Array.isArray(connections) || connections.length === 0) {
        return [];
    }

    // Build the {nodes, edges} shape computeTarjanSCC expects. Nodes
    // are keyed by fingerprint (the canonical identity per the bible's
    // identity invariants). `name` is the filepath for downstream
    // rendering.
    const fingerprintToPath = new Map();
    const nodes = [];
    for (const f of files) {
        if (!f || !f.fingerprint) continue;
        fingerprintToPath.set(f.fingerprint, f.filepath || f.fingerprint);
        nodes.push({ id: f.fingerprint, name: f.filepath || f.fingerprint });
    }

    const edges = [];
    for (const c of connections) {
        if (!c || !c.sourceFingerprint || !c.targetFingerprint) continue;
        // Skip self-loops — Tarjan would emit them as SCCs of size 1
        // with cycle weight, but we treat "A imports A" as a malformed
        // edge to ignore at this layer.
        if (c.sourceFingerprint === c.targetFingerprint) continue;
        // Skip edges with endpoints not in file_registry. Tarjan would
        // otherwise treat the absent endpoint as a disconnected sink
        // and produce noise.
        if (!fingerprintToPath.has(c.sourceFingerprint)) continue;
        if (!fingerprintToPath.has(c.targetFingerprint)) continue;
        edges.push({ from: c.sourceFingerprint, to: c.targetFingerprint });
    }

    if (nodes.length === 0 || edges.length === 0) return [];

    const sccResult = computeTarjanSCC({ nodes, edges });

    // computeTarjanSCC returns `{components: [{id, size, members, ...}], ...}`
    // — see relationship-analyzer.js detectCyclesWithTarjan for the
    // members-shape contract. A component with size > 1 is a real
    // cycle. Size-1 SCCs are trivial (single nodes with no self-loop).
    const cycles = [];
    const components = (sccResult && Array.isArray(sccResult.components)) ? sccResult.components : [];
    for (const component of components) {
        if (!component || (component.size || 0) <= 1) continue;
        const members = Array.isArray(component.members) ? component.members : [];
        if (members.length < 2) continue;
        const cyclePaths = members
            .map(fp => fingerprintToPath.get(fp))
            .filter(Boolean);
        cycles.push({ cycle: members.slice(), files: cyclePaths });
    }
    return cycles;
}

/**
 * Merge cycle arrays from multiple sources, dedup by sorted-member
 * fingerprint set. Two cycles with the same set of participants
 * (regardless of order/rotation) are treated as one.
 *
 * @param {...Array<{cycle: string[], files: string[]}>} sources
 * @returns {Array<{cycle: string[], files: string[]}>}
 */
function mergeCycles(...sources) {
    const seen = new Map();
    for (const source of sources) {
        if (!Array.isArray(source)) continue;
        for (const c of source) {
            if (!c || !Array.isArray(c.cycle) || c.cycle.length < 2) continue;
            const key = c.cycle.slice().sort().join('|');
            if (!seen.has(key)) seen.set(key, c);
        }
    }
    return Array.from(seen.values());
}

module.exports = { detectCyclesFromPersistence, mergeCycles };
