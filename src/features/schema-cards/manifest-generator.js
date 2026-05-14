#!/usr/bin/env node

/**
 * ST8 Manifest Generator
 * 
 * Generates connection-state.json and ai-signal.toml manifests.
 * References maestro-scaffolder-tool code for TOML serialization.
 * DO NOT copy files from maestro. Import/require by path.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── LIB CODE REFERENCES ─────────────────────────────────────
// Post-move: this file lives at src/features/schema-cards/. tomlSerializer
// has NOT moved yet (scheduled for the integr8 batch). For now, LIB_DIR walks
// back up to the repo's lib/ directory. When the integr8 batch lands and
// tomlSerializer relocates, this loader will be retargeted at that time.

const LIB_DIR = path.join(__dirname, '..', '..', '..', 'lib');

let _tomlSerializer = null;

function loadLibModule(modulePath) {
    try {
        const fullPath = path.join(LIB_DIR, modulePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Lib module not found: ${fullPath}`);
        }
        return require(fullPath);
    } catch (err) {
        console.error(`[st8:manifest] Failed to load lib module: ${modulePath}`, err.message);
        return null;
    }
}

function getTomlSerializer() {
    if (!_tomlSerializer) {
        _tomlSerializer = loadLibModule('commands/integr8/tomlSerializer.js');
    }
    return _tomlSerializer;
}

// ─── JSON MANIFEST ───────────────────────────────────────────

function generateConnectionState(files, targetDir) {
    const manifest = {
        metadata: {
            timestamp: new Date().toISOString(),
            targetDirectory: targetDir,
            totalFiles: files.length,
            statusCounts: {
                GREEN: files.filter(f => f.status === 'GREEN').length,
                YELLOW: files.filter(f => f.status === 'YELLOW').length,
                RED: files.filter(f => f.status === 'RED').length
            }
        },
        files: files.map(f => ({
            fingerprint: f.fingerprint || f.sha256Hash,
            filepath: f.filepath,
            filename: f.filename,
            status: f.status,
            reachabilityScore: f.reachabilityScore || 0.0,
            impactRadius: f.impactRadius || 0,
            sha256Hash: f.sha256Hash,
            imports: f.imports || [],
            importedBy: f.importedBy || [],
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

function writeManifests(files, targetDir) {
    const jsonPath = path.join(targetDir, 'connection-state.json');
    const tomlPath = path.join(targetDir, 'ai-signal.toml');
    
    try {
        // Write JSON manifest
        const jsonManifest = generateConnectionState(files, targetDir);
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
