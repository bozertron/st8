/* ═══════════════════════════════════════════════════════════════
   ST8 COORDINATION — Manifest Synchronization Service
   ═══════════════════════════════════════════════════════════════

   Loads the project manifest (connection-state.json) and exposes
   change-comparison + AI context helpers built on top of it.

   Refresh model (post Wave 4D): the service subscribes to the
   backend mutation stream at /api/mutations (SSE) and reloads the
   manifest on each FILE_AFTER_CHANGE event. The legacy 2s setInterval
   polling has been removed — the SSE bus delivers the same signal
   with <1s latency and zero idle round-trips.

   Current consumers: the split-mode workspace ("standard" / "pretext-
   review") starts the service when the right-hand file panel is
   active and stops it on workspace switch. addListener() is exposed
   for future surfaces (per-manifest-change subscribers); today the
   loadManifest -> notifyListeners path runs even with zero listeners
   so adding one later is a pure subscribe operation.

   Public API: window.St8Coordination
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── COORDINATION STATE ──────────────────────────────────────

const coordinationState = {
    manifestPath: null,
    lastManifest: null,
    lastUpdate: null,
    listeners: [],
    // Wave 4D ticket 2: legacy `pollInterval` (setInterval handle) replaced
    // by an EventSource handle. Same semantic — "service is currently
    // listening for manifest updates" — different transport.
    mutationSource: null,
    // Reconnect-on-error housekeeping. Kept tiny on purpose: this service
    // is a courtesy refresher, not a critical channel (the main mutation
    // stream in app.js owns user-visible toasts + constellation updates).
    reconnectTimer: null,
    reconnectDelay: 1000
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

// ─── REFRESH (SSE-driven, post Wave 4D) ──────────────────────
//
// startPolling() retains its name for call-site compatibility with the
// existing workspace-switch code in app.js, but the underlying mechanism
// is now a /api/mutations EventSource. Each mutation event triggers
// loadManifest(); we do not parse the event payload here because the
// manifest is the source of truth for compareManifests / generateAiContext.

function _openMutationSource(manifestPath) {
    // EventSource is a browser global. In a non-browser context (tests
    // running this file under node), it may be undefined — bail rather
    // than throw so the service degrades to "initial fetch only".
    if (typeof EventSource === 'undefined') {
        console.warn('[st8:coordination] EventSource unavailable; skipping live refresh');
        return null;
    }
    var src = new EventSource('/api/mutations');

    src.onopen = function() {
        coordinationState.reconnectDelay = 1000;
        console.info('[st8:coordination] Mutation stream connected');
    };

    src.onmessage = function(event) {
        try {
            var data = JSON.parse(event.data);
            // Skip the server's initial handshake frame
            if (data && data.type === 'connected') return;
            // Any real mutation = manifest is now stale; reload it.
            loadManifest(manifestPath);
        } catch (err) {
            console.warn('[st8:coordination] Mutation parse failed:', err && err.message);
        }
    };

    src.onerror = function() {
        // Don't tear the service down — just log + schedule a single
        // retry with linear backoff (capped). The user-facing mutation
        // stream in app.js owns aggressive reconnect; we ride along.
        console.warn('[st8:coordination] Mutation stream lost; retrying');
        try { src.close(); } catch (_) {}
        if (coordinationState.mutationSource === src) {
            coordinationState.mutationSource = null;
        }
        clearTimeout(coordinationState.reconnectTimer);
        coordinationState.reconnectTimer = setTimeout(function() {
            coordinationState.reconnectDelay = Math.min(
                coordinationState.reconnectDelay * 2, 30000
            );
            if (coordinationState.manifestPath) {
                coordinationState.mutationSource = _openMutationSource(
                    coordinationState.manifestPath
                );
            }
        }, coordinationState.reconnectDelay);
    };

    return src;
}

function startPolling(manifestPath) {
    coordinationState.manifestPath = manifestPath;

    // Initial load — one-shot bootstrap so consumers have data
    // before any mutation arrives. The SSE stream takes over from here.
    loadManifest(manifestPath);

    // Idempotent: tear down any prior stream before opening a new one.
    if (coordinationState.mutationSource) {
        try { coordinationState.mutationSource.close(); } catch (_) {}
        coordinationState.mutationSource = null;
    }
    coordinationState.mutationSource = _openMutationSource(manifestPath);

    console.info('[st8:coordination] Refresh stream opened:', manifestPath);
}

function stopPolling() {
    if (coordinationState.mutationSource) {
        try { coordinationState.mutationSource.close(); } catch (_) {}
        coordinationState.mutationSource = null;
    }
    if (coordinationState.reconnectTimer) {
        clearTimeout(coordinationState.reconnectTimer);
        coordinationState.reconnectTimer = null;
    }
    console.info('[st8:coordination] Refresh stream stopped');
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
