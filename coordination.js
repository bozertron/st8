/* ═══════════════════════════════════════════════════════════════
   ST8 COORDINATION — Multi-LLM Manifest Synchronization
   ═══════════════════════════════════════════════════════════════

   Uses connection-state.json and ai-signal.toml as the coordination
   layer between multiple LLMs. Both LLMs read the same manifest.
   When one makes a fix, watcher fires, manifest updates, other LLM sees truth.

   Public API: window.St8Coordination
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── COORDINATION STATE ──────────────────────────────────────

const coordinationState = {
    manifestPath: null,
    lastManifest: null,
    lastUpdate: null,
    listeners: [],
    pollInterval: null,
    pollMs: 2000
};

// ─── MANIFEST LOADING ────────────────────────────────────────

async function loadManifest(manifestPath) {
    try {
        var response = await fetch(manifestPath);
        if (response.ok) {
            var manifest = await response.json();
            coordinationState.lastManifest = manifest;
            coordinationState.lastUpdate = new Date().toISOString();
            
            // Notify listeners
            notifyListeners(manifest);
            
            return manifest;
        }
    } catch (err) {
        console.warn('[st8:coordination] Failed to load manifest:', err.message);
    }
    return null;
}

function notifyListeners(manifest) {
    coordinationState.listeners.forEach(function(listener) {
        try {
            listener(manifest);
        } catch (err) {
            console.error('[st8:coordination] Listener error:', err.message);
        }
    });
}

// ─── POLLING ─────────────────────────────────────────────────

function startPolling(manifestPath) {
    coordinationState.manifestPath = manifestPath;
    
    // Initial load
    loadManifest(manifestPath);
    
    // Start polling
    coordinationState.pollInterval = setInterval(function() {
        loadManifest(manifestPath);
    }, coordinationState.pollMs);
    
    console.info('[st8:coordination] Polling started:', manifestPath);
}

function stopPolling() {
    if (coordinationState.pollInterval) {
        clearInterval(coordinationState.pollInterval);
        coordinationState.pollInterval = null;
        console.info('[st8:coordination] Polling stopped');
    }
}

// ─── LISTENER MANAGEMENT ─────────────────────────────────────

function addListener(callback) {
    coordinationState.listeners.push(callback);
    return function() {
        var index = coordinationState.listeners.indexOf(callback);
        if (index !== -1) {
            coordinationState.listeners.splice(index, 1);
        }
    };
}

// ─── MANIFEST COMPARISON ─────────────────────────────────────

function compareManifests(oldManifest, newManifest) {
    if (!oldManifest || !newManifest) return null;
    
    var changes = {
        added: [],
        removed: [],
        statusChanged: [],
        intentChanged: []
    };
    
    var oldFiles = {};
    var newFiles = {};
    
    if (oldManifest.files) {
        oldManifest.files.forEach(function(f) {
            oldFiles[f.filepath] = f;
        });
    }
    
    if (newManifest.files) {
        newManifest.files.forEach(function(f) {
            newFiles[f.filepath] = f;
        });
    }
    
    // Find added files
    Object.keys(newFiles).forEach(function(path) {
        if (!oldFiles[path]) {
            changes.added.push(newFiles[path]);
        }
    });
    
    // Find removed files
    Object.keys(oldFiles).forEach(function(path) {
        if (!newFiles[path]) {
            changes.removed.push(oldFiles[path]);
        }
    });
    
    // Find status changes
    Object.keys(newFiles).forEach(function(path) {
        if (oldFiles[path] && oldFiles[path].status !== newFiles[path].status) {
            changes.statusChanged.push({
                filepath: path,
                oldStatus: oldFiles[path].status,
                newStatus: newFiles[path].status
            });
        }
    });
    
    // Find intent changes
    Object.keys(newFiles).forEach(function(path) {
        if (oldFiles[path] && newFiles[path].intent) {
            var oldIntent = oldFiles[path].intent || {};
            var newIntent = newFiles[path].intent || {};
            if (oldIntent.purpose !== newIntent.purpose ||
                oldIntent.dependsOnBehavior !== newIntent.dependsOnBehavior ||
                oldIntent.valueStatement !== newIntent.valueStatement) {
                changes.intentChanged.push({
                    filepath: path,
                    oldIntent: oldIntent,
                    newIntent: newIntent
                });
            }
        }
    });
    
    return changes;
}

// ─── AI CONTEXT GENERATION ───────────────────────────────────

function generateAiContext(manifest) {
    if (!manifest || !manifest.files) return '';
    
    var context = 'ST8 CODEBASE CONTEXT\n';
    context += '===================\n\n';
    context += 'Target: ' + (manifest.metadata ? manifest.metadata.targetDirectory : 'Unknown') + '\n';
    context += 'Total Files: ' + manifest.files.length + '\n';
    
    if (manifest.metadata && manifest.metadata.statusCounts) {
        context += 'Status: ' + manifest.metadata.statusCounts.GREEN + ' GREEN, ' +
            manifest.metadata.statusCounts.YELLOW + ' YELLOW, ' +
            manifest.metadata.statusCounts.RED + ' RED\n';
    }
    
    context += '\nFILES:\n';
    
    manifest.files.forEach(function(file) {
        context += '\n' + file.filepath + '\n';
        context += '  Status: ' + file.status + '\n';
        context += '  Hash: ' + (file.sha256Hash || 'N/A') + '\n';
        
        if (file.imports && file.imports.length > 0) {
            context += '  Imports: ' + file.imports.map(function(i) { return i.source; }).join(', ') + '\n';
        }
        
        if (file.intent && file.intent.purpose) {
            context += '  Purpose: ' + file.intent.purpose + '\n';
        }
    });
    
    return context;
}

// ─── PUBLIC API ───────────────────────────────────────────────

window.St8Coordination = {
    loadManifest: loadManifest,
    startPolling: startPolling,
    stopPolling: stopPolling,
    addListener: addListener,
    compareManifests: compareManifests,
    generateAiContext: generateAiContext,
    getLastManifest: function() { return coordinationState.lastManifest; },
    getLastUpdate: function() { return coordinationState.lastUpdate; }
};
