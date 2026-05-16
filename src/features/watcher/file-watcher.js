#!/usr/bin/env node

/**
 * ST8 File Watcher
 * 
 * Watches for file changes and triggers re-indexing.
 * References maestro-scaffolder-tool code for chokidar integration.
 * DO NOT copy files from maestro. Import/require by path.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ─── CHOKIDAR LOADING ────────────────────────────────────────

let _chokidar = null;

function loadChokidar() {
    if (!_chokidar) {
        try {
            // Try to load chokidar from local node_modules
            _chokidar = require('chokidar');
        } catch (err) {
            console.error('[st8:watcher] Failed to load chokidar:', err.message);
            _chokidar = null;
        }
    }
    return _chokidar;
}

// ─── FILE WATCHER CLASS ──────────────────────────────────────

class FileWatcher {
    constructor(targetDir, options = {}) {
        this.targetDir = targetDir;
        this.debounceMs = options.debounceMs || 500;
        this.onFileChange = options.onFileChange || null;
        this.watcher = null;
        this.debounceTimer = null;
        // Map keyed by `${path}::${type}` so successive events for the
        // same (path, type) within one debounce window collapse to one
        // entry. The previous `new Set()` with object-literal entries
        // never deduped — each `{ path, type }` literal is reference-
        // unique, so 100 chokidar 'change' events on one file produced
        // 100 entries in the flush array (ticket 4). The composite key
        // preserves the (path, type) distinction so a CREATE followed
        // by an EDIT in the same window still produces two entries.
        this.pendingChanges = new Map();
    }
    
    start() {
        const chokidar = loadChokidar();
        if (!chokidar) {
            console.error('[st8:watcher] Chokidar not available');
            return false;
        }
        
        console.log(`[st8:watcher] Starting watcher on: ${this.targetDir}`);
        
        this.watcher = chokidar.watch(this.targetDir, {
            // ── IGNORE LIST AUDIT (ticket 13, wave 4A) ──────────────
            // The previous broad `**/*.json` and `**/*.toml` globs
            // existed to prevent st8's own manifest writes
            // (connection-state.json + ai-signal.toml at targetDir
            // root) from re-triggering the watcher. After Wave 2B
            // decomposed the watcher callback into FILE_AFTER_CHANGE
            // subscribers AND the indexer's SELF_WRITTEN_BASENAMES
            // guard (src/features/indexing/indexer.js:166) already
            // skips those exact basenames at index time, the broad
            // globs were over-scoped — they silently swallowed
            // legitimate user config edits (package.json,
            // tsconfig.json, pyproject.toml, Cargo.toml, etc.) so
            // a `package.json` change never triggered re-index.
            //
            // Scope tightened to the two known manifest basenames at
            // the target root only. Anything deeper (e.g. user
            // package.json in a subdir) now flows through the
            // watcher and is filtered downstream by main.js
            // CODE_EXTENSIONS + indexer SELF_WRITTEN_BASENAMES.
            ignored: [
                '**/node_modules',
                '**/.git',
                '**/dist',
                '**/build',
                '**/.venv',
                '**/venv',
                '**/__pycache__',
                '**/*.sqlite',
                '**/*.sqlite-wal',
                '**/*.sqlite-shm',
                path.join(this.targetDir, 'connection-state.json'),
                path.join(this.targetDir, 'ai-signal.toml'),
                '**/.st8/**',
                '**/.planning/st8_identity_system/**',
                '**/.archive/**',
                '**/snapshots/**'
            ],
            persistent: true,
            awaitWriteFinish: {
                stabilityThreshold: 200,
                pollInterval: 100
            },
            depth: 10,
            followSymlinks: false
        });
        
        this.watcher.on('add', (filePath) => this._onFileChange(filePath, 'add'));
        this.watcher.on('change', (filePath) => this._onFileChange(filePath, 'change'));
        this.watcher.on('unlink', (filePath) => this._onFileChange(filePath, 'unlink'));
        this.watcher.on('error', (err) => {
            console.error('[st8:watcher] Error:', err.message);
        });
        
        console.log('[st8:watcher] Watcher started');
        return true;
    }
    
    _onFileChange(filePath, eventType) {
        const key = `${filePath}::${eventType}`;
        this.pendingChanges.set(key, { path: filePath, type: eventType });

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this._flush().catch(err => {
                console.error('[st8:watcher] Flush failed:', err.message);
            });
        }, this.debounceMs);
    }

    async _flush() {
        const changes = Array.from(this.pendingChanges.values());
        this.pendingChanges.clear();
        
        console.log(`[st8:watcher] Flushing ${changes.length} changes`);
        
        if (this.onFileChange) {
            try {
                await this.onFileChange(changes);
            } catch (err) {
                console.error('[st8:watcher] Error in onFileChange callback:', err.message);
            }
        }
    }
    
    stop() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            console.log('[st8:watcher] Watcher stopped');
        }
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    FileWatcher
};
