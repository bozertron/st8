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
        
        this.server.listen(this.port, '127.0.0.1', () => {
            console.log(`[st8:server] Server running on http://localhost:${this.port} (bound to 127.0.0.1)`);
        });
        
        return true;
    }
    
    _handleRequest(req, res) {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        
        // CORS headers — restricted to localhost origins only (security fix: prevent RCE via CORS wildcard)
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:' + this.port);
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
            case '/api/index':
                this._handleIndex(req, res);
                break;
            case '/api/file-intent':
                this._handleFileIntent(req, res);
                break;
            case '/api/settings':
                this._handleSettings(req, res, url);
                break;
            case '/api/verify':
                this._handleVerify(req, res);
                break;
            case '/api/files':
                this._handleFileList(req, res, url);
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
    
    _handleIndex(req, res) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            let persistence;
            try {
                const { path: requestedPath } = JSON.parse(body || '{}');
                const targetDir = requestedPath || this.targetDir;
                
                if (!targetDir) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No target directory specified' }));
                    return;
                }
                
                const { indexDirectory } = require('./indexer');
                const { writeManifests } = require('./manifestGenerator');
                const { St8Persistence } = require('./persistence');
                
                const result = await indexDirectory(targetDir, { write: false });
                
                // Enrich with intents
                persistence = new St8Persistence();
                await persistence.initialize();
                const allIntents = persistence.getAllIntents();
                for (const file of result.files) {
                    const fp = file.fingerprint || file.sha256Hash;
                    if (allIntents[fp]) {
                        file.intent = allIntents[fp];
                    }
                }
                
                writeManifests(result.files, targetDir);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'ok', 
                    files: result.files.length,
                    path: targetDir
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            } finally {
                if (persistence) persistence.close();
            }
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
                    try {
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

                        // Regenerate manifest with updated intent
                        const allIntents = persistence.getAllIntents();

                        // Load current manifest
                        const manifestPath = path.join(this.targetDir, 'connection-state.json');
                        let manifest;
                        if (fs.existsSync(manifestPath)) {
                            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                        } else {
                            // Create minimal manifest if it doesn't exist
                            manifest = {
                                metadata: {
                                    timestamp: new Date().toISOString(),
                                    targetDirectory: this.targetDir,
                                    totalFiles: 0,
                                    statusCounts: { GREEN: 0, YELLOW: 0, RED: 0 }
                                },
                                files: []
                            };
                        }

                        // Update intent for the saved file
                        if (manifest.files) {
                            for (const file of manifest.files) {
                                const fp = file.fingerprint || file.sha256Hash;
                                if (allIntents[fp]) {
                                    file.intent = allIntents[fp];
                                }
                            }
                        }

                        // Write updated manifest
                        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok', fingerprint }));
                    } finally {
                        persistence.close();
                    }
                }).catch(err => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    _handleSettings(req, res, url) {
        const { St8Persistence } = require('./persistence');
        const persistence = new St8Persistence();

        persistence.initialize().then(() => {
            if (req.method === 'GET') {
                // GET /api/settings — return all settings
                // GET /api/settings?category=voidflow — return settings for a category
                try {
                    const category = url.searchParams.get('category');
                    let data;
                    if (category) {
                        data = persistence.getSettingsByCategory(category);
                    } else {
                        data = persistence.getAllSettings();
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', data }));
                } finally {
                    persistence.close();
                }

            } else if (req.method === 'POST') {
                // POST /api/settings — upsert a setting
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const { category, key, value } = JSON.parse(body);
                        if (!category || !key) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'category and key are required' }));
                            return;
                        }
                        persistence.upsertSetting(category, key, value);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok', category, key }));
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message }));
                    } finally {
                        persistence.close();
                    }
                });
                // Handle client abort — req.on('end') never fires → connection leak
                req.on('close', () => {
                    if (persistence) persistence.close();
                });

            } else {
                persistence.close();
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
    }
    
    _handleFileList(req, res, url) {
        const os = require('os');
        const requestedPath = url.searchParams.get('path') || this.targetDir;

        // Tilde expansion — resolve ~ and ~/... to user home directory
        let dirPath = requestedPath;
        if (dirPath === '~' || dirPath.startsWith('~/')) {
            dirPath = path.join(os.homedir(), dirPath.slice(1));
        }

        const resolvedPath = path.resolve(dirPath);

        // Directory traversal protection — restrict to home dir or targetDir
        const homeDir = os.homedir();
        if (!resolvedPath.startsWith(homeDir) && !resolvedPath.startsWith(this.targetDir)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Access denied: path outside allowed scope' }));
            return;
        }

        // Security: validate path exists
        if (!fs.existsSync(resolvedPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Directory not found' }));
            return;
        }

        try {
            const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
            const result = entries.map(entry => ({
                name: entry.name,
                isDirectory: entry.isDirectory(),
                path: path.join(resolvedPath, entry.name)
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ entries: result }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    }

    _handleVerify(req, res) {
        // Method validation — POST only
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                // Parse request body
                let targetDir = this.targetDir;
                if (body) {
                    try {
                        const parsed = JSON.parse(body);
                        if (parsed.path) {
                            targetDir = parsed.path;
                        }
                    } catch (parseErr) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                        return;
                    }
                }

                if (!targetDir) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No target directory configured' }));
                    return;
                }

                // Resolve and validate path
                const path = require('path');
                const fs = require('fs');
                const crypto = require('crypto');
                const resolvedDir = path.resolve(targetDir);

                if (!fs.existsSync(resolvedDir)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Directory not found: ${resolvedDir}` }));
                    return;
                }

                // Initialize persistence
                const { St8Persistence } = require('./persistence');
                const persistence = new St8Persistence();
                try {
                await persistence.initialize();

                // Get all indexed files from database
                const indexedFiles = persistence.getAllFiles();
                const results = {
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    targetDir: resolvedDir,
                    summary: {
                        totalFiles: indexedFiles.length,
                        verified: 0,
                        modified: 0,
                        missing: 0,
                        orphans: 0
                    },
                    files: [],
                    orphans: [],
                    issues: []
                };

                // Verify each indexed file
                for (const file of indexedFiles) {
                    const fullPath = path.join(resolvedDir, file.filepath);
                    const verification = {
                        filepath: file.filepath,
                        fingerprint: file.fingerprint,
                        storedHash: file.sha256_hash,
                        status: 'VERIFIED',
                        hashMatch: true,
                        sizeMatch: true
                    };

                    // Check existence
                    if (!fs.existsSync(fullPath)) {
                        verification.status = 'MISSING';
                        verification.hashMatch = false;
                        verification.sizeMatch = false;
                        results.summary.missing++;
                        results.issues.push({
                            filepath: file.filepath,
                            severity: 'CRITICAL',
                            message: 'File missing from disk'
                        });
                    } else {
                        // Compute current hash
                        try {
                            const content = fs.readFileSync(fullPath);
                            const currentHash = crypto.createHash('sha256').update(content).digest('hex');
                            verification.currentHash = currentHash;

                            // Check hash match
                            if (currentHash !== file.sha256_hash) {
                                verification.status = 'MODIFIED';
                                verification.hashMatch = false;
                                results.summary.modified++;
                                results.issues.push({
                                    filepath: file.filepath,
                                    severity: 'WARNING',
                                    message: 'Hash mismatch: file modified since last index'
                                });
                            } else {
                                results.summary.verified++;
                            }

                            // Check size match
                            const stat = fs.statSync(fullPath);
                            if (file.file_size_bytes && stat.size !== file.file_size_bytes) {
                                verification.sizeMatch = false;
                                if (verification.status === 'VERIFIED') {
                                    verification.status = 'MODIFIED';
                                    results.summary.modified++;
                                    results.summary.verified--;
                                }
                            }
                        } catch (hashErr) {
                            verification.status = 'ERROR';
                            verification.hashMatch = false;
                            results.issues.push({
                                filepath: file.filepath,
                                severity: 'ERROR',
                                message: `Failed to hash file: ${hashErr.message}`
                            });
                        }
                    }

                    results.files.push(verification);
                }

                // Detect orphan files (on disk but not in index)
                const { discoverFiles } = require('./indexer');
                const diskFiles = discoverFiles(resolvedDir);
                const indexedPaths = new Set(indexedFiles.map(f => f.filepath));

                for (const diskFile of diskFiles) {
                    const relPath = path.relative(resolvedDir, diskFile);
                    if (!indexedPaths.has(relPath)) {
                        results.orphans.push({
                            filepath: relPath,
                            reason: 'not_in_index'
                        });
                        results.summary.orphans++;
                    }
                }

                // Log verification activity
                persistence.logActivity({
                    source: 'API',
                    action: 'VERIFY',
                    details: {
                        targetDir: resolvedDir,
                        summary: results.summary
                    }
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(results, null, 2));

                } finally {
                    persistence.close();
                }

            } catch (err) {
                console.error('[st8:server] Verify error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
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
