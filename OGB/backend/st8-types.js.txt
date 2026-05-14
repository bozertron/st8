#!/usr/bin/env node

/**
 * ST8 Types — Canonical Type Definitions
 *
 * THE single source of truth for all st8 data shapes.
 * Every module must import from this file.
 * No module may define its own type shape for data that crosses module boundaries.
 */

'use strict';

// ─── LIFECYCLE PHASES ────────────────────────────────────────

const LifecyclePhase = Object.freeze({
    CONCEPT: 'CONCEPT',       // Pre-code — file doesn't exist on disk yet
    LOCKED: 'LOCKED',         // MVP Lock — schema cards emitted, PRD generated
    WIRING: 'WIRING',         // Cross-file deps validated against schema cards
    DEVELOPMENT: 'DEVELOPMENT', // Active coding — watcher logs every mutation
    PRODUCTION: 'PRODUCTION'  // Mutation log purged — lightweight card only
});

// ─── FILE STATUS ─────────────────────────────────────────────

const FileStatus = Object.freeze({
    GREEN: 'GREEN',           // Imported by other files, healthy
    YELLOW: 'YELLOW',         // Partially connected
    RED: 'RED',               // Orphaned or no consumers
    CONCEPT: 'CONCEPT',       // Pre-code placeholder
    LOCKED: 'LOCKED',         // MVP-locked, awaiting implementation
    PRODUCTION: 'PRODUCTION'  // Production-ready, lightweight tracking
});

// ─── MUTATION TYPES ──────────────────────────────────────────

const MutationType = Object.freeze({
    CONCEPT: 'CONCEPT',       // File registered before creation
    CREATE: 'CREATE',         // First write to disk
    EDIT: 'EDIT',             // Content changed
    RENAME: 'RENAME',         // File moved/renamed
    REFACTOR: 'REFACTOR',     // Structural change detected
    DELETE: 'DELETE',         // File removed from disk
    LOCK: 'LOCK',             // MVP Lock applied
    PRODUCTION: 'PRODUCTION', // Promoted to production
    PURGE: 'PURGE'            // Development data purged
});

// ─── ACTOR TYPES ─────────────────────────────────────────────

const ActorType = Object.freeze({
    DEVELOPER: 'DEVELOPER',   // Human via IDE/editor
    INDEXER: 'INDEXER',       // St8 indexer (batch)
    WATCHER: 'WATCHER',       // File watcher (incremental)
    AGENT: 'AGENT'            // AI agent or automated tool
});

// ─── St8FileEntry — CANONICAL FILE SHAPE ─────────────────────
// This is the shape that EVERY module must use when working with file data.
// Database columns, API responses, and internal objects all use this shape.

const St8FileEntry = Object.freeze({
    fingerprint: '',          // Stable identity: {filepath}||{birthTimestamp}
    filepath: '',             // Relative path from project root
    filename: '',             // Basename with extension
    sha256Hash: '',           // Content version (changes on every edit)
    fileSizeBytes: 0,
    status: 'RED',            // FileStatus enum value
    reachabilityScore: 0.0,   // 0.0 to 1.0
    impactRadius: 0,          // Transitive dependents count
    lifecyclePhase: 'DEVELOPMENT', // LifecyclePhase enum value
    birthTimestamp: '',        // ISO timestamp — set once at creation, never changes
    lastModified: '',         // ISO timestamp — updated on every content change
    lastIndexed: '',          // ISO timestamp — updated on every index run
    isEntryPoint: false       // Whether this file is an entry point
});

// ─── St8SchemaCard — EXTENDED FILE SHAPE FOR EMISSION ────────
// Includes AST-extracted metadata + connections + intent + mutation summary

const St8SchemaCard = Object.freeze({
    // Core identity (from St8FileEntry)
    fingerprint: '',
    filepath: '',
    filename: '',
    sha256Hash: '',
    fileSizeBytes: 0,
    status: 'RED',
    reachabilityScore: 0.0,
    impactRadius: 0,
    lifecyclePhase: 'DEVELOPMENT',
    birthTimestamp: '',
    lastModified: '',
    lastIndexed: '',
    isEntryPoint: false,

    // AST-extracted data
    exports: [],              // [{name, kind, signature, returnType, paramCount, ...}]
    imports: [],              // [{source, specifiers, importType, line}]

    // Connection data
    connections: {
        importedBy: [],       // [filepath, ...]
        imports: []           // [filepath, ...]
    },

    // Intent data (from file_intent table)
    intent: {
        purpose: '',
        dependsOnBehavior: '',
        valueStatement: ''
    },

    // Mutation summary
    mutationCount: 0,
    lastMutation: {
        type: '',             // MutationType enum value
        actor: '',            // ActorType enum value
        timestamp: ''
    }
});

// ─── St8MutationRecord ───────────────────────────────────────

const St8MutationRecord = Object.freeze({
    fingerprint: '',
    sha256Hash: '',           // Content version at this mutation
    mutationType: '',         // MutationType enum value
    changedFields: '',        // JSON string: {field: [oldValue, newValue]}
    actor: '',                // ActorType enum value
    timestamp: '',            // ISO timestamp
    metadata: ''              // JSON string: schema card snapshot at this mutation
});

// ─── VALIDATION ──────────────────────────────────────────────

/**
 * Validates an object against a canonical type shape.
 * Returns { valid: boolean, missing: string[], extra: string[], wrongType: string[] }
 */
function validateAgainstShape(obj, shape, strict = false) {
    const result = { valid: true, missing: [], extra: [], wrongType: [] };

    for (const key of Object.keys(shape)) {
        if (!(key in obj)) {
            result.missing.push(key);
            result.valid = false;
        } else if (typeof obj[key] !== typeof shape[key] && obj[key] !== null && obj[key] !== undefined) {
            result.wrongType.push(`${key}: expected ${typeof shape[key]}, got ${typeof obj[key]}`);
            result.valid = false;
        }
    }

    if (strict) {
        for (const key of Object.keys(obj)) {
            if (!(key in shape)) {
                result.extra.push(key);
                result.valid = false;
            }
        }
    }

    return result;
}

function validateSt8FileEntry(obj) {
    return validateAgainstShape(obj, St8FileEntry);
}

function validateSt8SchemaCard(obj) {
    return validateAgainstShape(obj, St8SchemaCard);
}

function validateSt8MutationRecord(obj) {
    return validateAgainstShape(obj, St8MutationRecord);
}

// ─── FINGERPRINT GENERATION ──────────────────────────────────

/**
 * Separator used in fingerprints. Chosen to avoid conflicts with:
 * - Filepaths (may contain `:` on Windows drives, but not `||`)
 * - ISO 8601 timestamps (contain `:` as in `T10:30:45.123Z`)
 *
 * MIGRATION NOTE: Old fingerprints used `:` as separator. `parseFingerprint()`
 * handles both formats, but legacy ISO 8601 fingerprints are already corrupted
 * (the original bug). Only legacy numeric timestamps parse correctly.
 * Existing DB records with ISO timestamps should be regenerated.
 */
const FINGERPRINT_SEPARATOR = '||';

/**
 * Generates a stable fingerprint from filepath and birth timestamp.
 * The fingerprint NEVER changes once generated.
 *
 * Uses `||` separator to avoid ambiguity with ISO 8601 timestamps
 * which contain colons (e.g., `T10:30:45.123Z`).
 */
function generateFingerprint(filepath, birthTimestamp) {
    return `${filepath}${FINGERPRINT_SEPARATOR}${birthTimestamp}`;
}

/**
 * Parses a fingerprint back into its components.
 *
 * Handles two formats:
 * 1. NEW format: `filepath||birthTimestamp` (split on `||`)
 * 2. LEGACY format: `filepath:birthTimestamp` (split on last `:` — only for simple timestamps)
 *
 * Legacy detection: if the fingerprint contains `||`, use new format.
 * Otherwise, fall back to lastIndexOf(':') for old records.
 *
 * CAVEAT: Legacy parsing only works for simple timestamps (e.g., numeric `0`).
 * ISO 8601 timestamps contain colons and CANNOT be correctly parsed with the
 * old `:` separator — those records are corrupted and must be regenerated
 * from source data (the original file's birth timestamp).
 */
function parseFingerprint(fingerprint) {
    // New format: split on `||`
    const doublePipe = fingerprint.indexOf('||');
    if (doublePipe !== -1) {
        return {
            filepath: fingerprint.substring(0, doublePipe),
            birthTimestamp: fingerprint.substring(doublePipe + 2)
        };
    }

    // Legacy format: split on last `:` (backward compatibility)
    // Only safe for non-ISO timestamps (e.g., numeric timestamps like `0`)
    const lastColon = fingerprint.lastIndexOf(':');
    if (lastColon === -1) return { filepath: fingerprint, birthTimestamp: '' };
    return {
        filepath: fingerprint.substring(0, lastColon),
        birthTimestamp: fingerprint.substring(lastColon + 1)
    };
}

// ─── CLI VALIDATION COMMAND ──────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--validate')) {
        console.log('[st8:types] Running type validation...');
        console.log('[st8:types] St8FileEntry fields:', Object.keys(St8FileEntry).join(', '));
        console.log('[st8:types] St8SchemaCard fields:', Object.keys(St8SchemaCard).join(', '));
        console.log('[st8:types] St8MutationRecord fields:', Object.keys(St8MutationRecord).join(', '));
        console.log('[st8:types] LifecyclePhase values:', Object.values(LifecyclePhase).join(', '));
        console.log('[st8:types] MutationType values:', Object.values(MutationType).join(', '));

        // Self-test
        const testEntry = { ...St8FileEntry, fingerprint: 'test.js||0', filepath: 'test.js' };
        const result = validateSt8FileEntry(testEntry);
        if (result.valid) {
            console.log('[st8:types] Self-test: PASS');
        } else {
            console.error('[st8:types] Self-test: FAIL', result);
            process.exit(1);
        }
        process.exit(0);
    }

    console.log('Usage: node st8-types.js --validate');
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    LifecyclePhase,
    FileStatus,
    MutationType,
    ActorType,
    St8FileEntry,
    St8SchemaCard,
    St8MutationRecord,
    validateAgainstShape,
    validateSt8FileEntry,
    validateSt8SchemaCard,
    validateSt8MutationRecord,
    generateFingerprint,
    parseFingerprint
};
