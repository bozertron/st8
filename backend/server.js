#!/usr/bin/env node

/**
 * ST8 Server — HTTP API for manifests
 * 
 * Serves connection-state.json and ai-signal.toml via HTTP.
 * Also provides endpoints for triggering re-indexing.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── STATIC FILE SERVING ─────────────────────────────────────

const STATIC_DIR = path.join(__dirname, '..');
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.toml': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// ─── SERVER CLASS ────────────────────────────────────────────

class St8Server {
    constructor(options = {}) {
        this.port = options.port || 3847;
        this.targetDir = options.targetDir || null;
        this.server = null;
        this.manifestCache = null;
        this.lastManifestUpdate = null;
    }
    
    start() {
        this.server = http.createServer((req, res) => {
            this._handleRequest(req, res);
        });
        
        this.server.listen(this.port, () => {
            console.log(`[st8:server] Server running on http://localhost:${this.port}`);
        });
        
        return true;
    }
    
    _handleRequest(req, res) {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        // API routes
        if (url.pathname.startsWith('/api/')) {
            this._handleApiRequest(req, res, url);
            return;
        }
        
        // Static file serving
        this._serveStaticFile(req, res, url);
    }
    
    _handleApiRequest(req, res, url) {
        switch (url.pathname) {
            case '/api/connection-state.json':
                this._serveManifest(req, res);
                break;
            case '/api/ai-signal.toml':
                this._serveToml(req, res);
                break;
            case '/api/health':
                this._serveHealth(req, res);
                break;
            case '/api/exec':
                this._handleExec(req, res);
                break;
            case '/api/index':
                this._handleIndex(req, res);
                break;
            case '/api/file-intent':
                this._handleFileIntent(req, res);
                break;
            default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API endpoint not found' }));
        }
    }
    
    _serveStaticFile(req, res, url) {
        let filePath = url.pathname;
        
        // Default to st8.html
        if (filePath === '/') {
            filePath = '/st8.html';
        }
        
        const fullPath = path.join(STATIC_DIR, filePath);
        
        // Security: prevent directory traversal
        if (!fullPath.startsWith(STATIC_DIR)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        
        // Get MIME type
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
        
        // Serve file
        try {
            const content = fs.readFileSync(fullPath);
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(content);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal server error');
        }
    }
    
    _serveManifest(req, res) {
        if (!this.targetDir) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No target directory configured' }));
            return;
        }
        
        const manifestPath = path.join(this.targetDir, 'connection-state.json');
        
        try {
            if (fs.existsSync(manifestPath)) {
                const content = fs.readFileSync(manifestPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(content);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Manifest not found. Run indexer first.' }));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    }
    
    _serveToml(req, res) {
        if (!this.targetDir) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('# Error: No target directory configured');
            return;
        }
        
        const tomlPath = path.join(this.targetDir, 'ai-signal.toml');
        
        try {
            if (fs.existsSync(tomlPath)) {
                const content = fs.readFileSync(tomlPath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(content);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('# Error: TOML manifest not found. Run indexer first.');
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`# Error: ${err.message}`);
        }
    }
    
    _serveHealth(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            uptime: process.uptime(),
            targetDir: this.targetDir,
            lastManifestUpdate: this.lastManifestUpdate
        }));
    }
    
    _handleExec(req, res) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { command } = JSON.parse(body);
                const { execSync } = require('child_process');
                const result = execSync(command, { encoding: 'utf-8', timeout: 30000 });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ stdout: result, stderr: '' }));
            } catch (err) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ stdout: '', stderr: err.message }));
            }
        });
    }
    
    _handleIndex(req, res) {
        const { indexDirectory } = require('./indexer');
        const { writeManifests } = require('./manifestGenerator');
        
        indexDirectory(this.targetDir, { write: true })
            .then(result => {
                writeManifests(result.files, this.targetDir);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', files: result.files.length }));
            })
            .catch(err => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            });
    }
    
    _handleFileIntent(req, res) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { fingerprint, purpose, dependsOnBehavior, valueStatement } = JSON.parse(body);
                const { St8Persistence } = require('./persistence');
                const persistence = new St8Persistence();
                
                persistence.initialize().then(() => {
                    persistence.upsertIntent({
                        fingerprint,
                        purpose,
                        dependsOnBehavior,
                        valueStatement,
                        authoredBy: 'USER'
                    });
                    
                    persistence.logActivity({
                        source: 'USER_UI',
                        action: 'NOTE_ADDED',
                        targetFingerprint: fingerprint,
                        details: { purpose, dependsOnBehavior, valueStatement }
                    });
                    
                    persistence.close();
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', fingerprint }));
                });
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }
    
    stop() {
        if (this.server) {
            this.server.close();
            console.log('[st8:server] Server stopped');
        }
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    St8Server
};
