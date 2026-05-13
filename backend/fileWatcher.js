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
        this.pendingChanges = new Set();
    }
    
    start() {
        const chokidar = loadChokidar();
        if (!chokidar) {
            console.error('[st8:watcher] Chokidar not available');
            return false;
        }
        
        console.log(`[st8:watcher] Starting watcher on: ${this.targetDir}`);
        
        this.watcher = chokidar.watch(this.targetDir, {
            ignored: [
                '**/node_modules',
                '**/.git',
                '**/dist',
                '**/build',
                '**/.venv',
                '**/venv',
                '**/__pycache__',
                '**/*.sqlite',
                '**/*.json',
                '**/*.toml'
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
        this.pendingChanges.add({ path: filePath, type: eventType });
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this._flush();
        }, this.debounceMs);
    }
    
    _flush() {
        const changes = Array.from(this.pendingChanges);
        this.pendingChanges.clear();
        
        console.log(`[st8:watcher] Flushing ${changes.length} changes`);
        
        if (this.onFileChange) {
            try {
                this.onFileChange(changes);
            } catch (err) {
                console.error('[st8:watcher] Error in onFileChange callback:', err.message);
            }
        }
    }
    
    stop() {
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
