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

// Post-move: __dirname is src/core/server/. The repo root (where st8.html,
// fonts/, and the old root-level frontend .js files live, AND where the
// new src/frontend/ tree sits) is three levels up.
const STATIC_DIR = path.join(__dirname, '..', '..', '..');
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
            case '/api/mutations':
                this._handleMutationsSSE(req, res);
                break;
            case '/api/concept-file':
                this._handleConceptFile(req, res);
                break;
            case '/api/mvp-lock':
                this._handleMvpLock(req, res);
                break;
            case '/api/prd':
                this._handlePrd(req, res);
                break;
            case '/api/production-promote':
                this._handleProductionPromote(req, res);
                break;
            case '/api/gap-analysis':
                this._handleGapAnalysis(req, res);
                break;
            case '/api/prd-projects':
                this._handlePrdProjects(req, res, url);
                break;
            case '/api/bruno-call':
                this._handleBrunoCall(req, res);
                break;
            case '/api/oscar-house':
                this._handleOscarHouse(req, res);
                break;
            case '/api/needs-ai-review':
                this._handleNeedsAIReview(req, res);
                break;
            case '/api/mark-reviewed':
                this._handleMarkReviewed(req, res);
                break;
            case '/api/templates':
                this._handleTemplates(req, res, url);
                break;
            default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API endpoint not found' }));
        }
    }
    
    _serveStaticFile(req, res, url) {
        let filePath = url.pathname;

        // `/` now serves the new slim shell (was: st8.html, which has been
        // moved to OGB/ — recover with `cp OGB/st8.html.txt st8.html` and
        // flip this branch back if anything regresses).
        // `/v2` retained as an alias for explicit reference.
        if (filePath === '/' || filePath === '/v2' || filePath === '/v2/') {
            filePath = '/src/frontend/index.html';
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
        // Method validation — POST only
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        // Body size limit: 1KB
        const MAX_BODY_SIZE = 1024;
        let body = '';
        let bodyTooLarge = false;

        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
            }
        });

        req.on('end', async () => {
            if (bodyTooLarge) return;
            let persistence;
            try {
                const { path: requestedPath } = JSON.parse(body || '{}');
                const targetDir = requestedPath || this.targetDir;
                
                if (!targetDir) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No target directory specified' }));
                    return;
                }
                
                const { indexDirectory } = require('../../features/indexing/indexer');
                const { writeManifests } = require('../../features/schema-cards/manifest-generator');
                const { St8Persistence } = require('../database/persistence');
                
                const result = await indexDirectory(targetDir, { write: false });
                
                // Enrich with intents
                persistence = new St8Persistence();
                await persistence.initialize();
                const allIntents = persistence.getAllIntents();
                for (const file of result.files) {
                    if (allIntents[file.fingerprint]) {
                        file.intent = allIntents[file.fingerprint];
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
        // Method validation — POST only
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        // Body size limit: 1KB
        const MAX_BODY_SIZE = 1024;
        let body = '';
        let bodyTooLarge = false;

        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
            }
        });

        req.on('end', () => {
            if (bodyTooLarge) return;
            try {
                const { fingerprint, purpose, dependsOnBehavior, valueStatement } = JSON.parse(body);
                const { St8Persistence } = require('../database/persistence');
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
                                if (allIntents[file.fingerprint]) {
                                    file.intent = allIntents[file.fingerprint];
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
                    persistence.close();
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
        const { St8Persistence } = require('../database/persistence');
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
                // Body size limit: 1KB
                const MAX_BODY_SIZE = 1024;
                let body = '';
                let bodyTooLarge = false;

                req.on('data', chunk => {
                    if (bodyTooLarge) return;
                    body += chunk;
                    if (body.length > MAX_BODY_SIZE) {
                        bodyTooLarge = true;
                        body = '';
                        req.destroy();
                        res.writeHead(413, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
                    }
                });

                req.on('end', () => {
                    if (bodyTooLarge) return;
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
            persistence.close();
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
        // CR-02 fix: use path.relative() to enforce path-boundary semantics.
        // String startsWith('/home/bozertron') would incorrectly allow
        // '/home/bozertron2/evil' — path.relative catches this because the
        // relative path starts with '..' when outside the base directory.
        const homeDir = os.homedir();
        const relToHome = path.relative(homeDir, resolvedPath);
        const relToTarget = this.targetDir ? path.relative(this.targetDir, resolvedPath) : null;
        const insideHome = !relToHome.startsWith('..') && !path.isAbsolute(relToHome);
        const insideTarget = relToTarget ? (!relToTarget.startsWith('..') && !path.isAbsolute(relToTarget)) : false;

        if (!insideHome && !insideTarget) {
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

        // Body size limit: 1KB
        const MAX_BODY_SIZE = 1024;
        let body = '';
        let bodyTooLarge = false;

        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
            }
        });

        req.on('end', async () => {
            if (bodyTooLarge) return;
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
                const { St8Persistence } = require('../database/persistence');
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
                        storedHash: file.sha256Hash,
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
                            if (currentHash !== file.sha256Hash) {
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
                            if (file.fileSizeBytes && stat.size !== file.fileSizeBytes) {
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
                const { discoverFiles } = require('../../features/indexing/indexer');
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

    _handleMutationsSSE(req, res) {
        const { notificationBus } = require('../notification-bus');
        // Pass the server's allowed origin so the SSE endpoint respects
        // the same CORS restriction as all other routes (CR-01 fix).
        notificationBus.addSSEClient(res, {
            allowedOrigin: 'http://localhost:' + this.port
        });
    }

    // ─── PHASE 6 ENDPOINTS ──────────────────────────────────────

    _handleConceptFile(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        // Body size limit: 1KB
        const MAX_BODY_SIZE = 1024;
        let body = '';
        let bodyTooLarge = false;

        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
            }
        });

        req.on('end', async () => {
            if (bodyTooLarge) return;

            let persistence;
            try {
                let parsed;
                try {
                    parsed = JSON.parse(body);
                } catch (parseErr) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON: ' + parseErr.message }));
                    return;
                }

                const { filepath, purpose, dependsOnBehavior, valueStatement } = parsed;

                if (!filepath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'filepath is required' }));
                    return;
                }

                const { St8Persistence } = require('../database/persistence');
                const { notificationBus } = require('../notification-bus');

                persistence = new St8Persistence();
                await persistence.initialize();

                const fingerprint = persistence.registerConceptFile({
                    filepath,
                    filename: path.basename(filepath),
                    actor: 'DEVELOPER'
                });

                // Set intent if provided
                if (purpose || dependsOnBehavior || valueStatement) {
                    persistence.upsertIntent({
                        fingerprint,
                        purpose: purpose || '',
                        dependsOnBehavior: dependsOnBehavior || '',
                        valueStatement: valueStatement || '',
                        authoredBy: 'DEVELOPER'
                    });
                }

                notificationBus.publish({
                    fingerprint,
                    filepath,
                    mutationType: 'CONCEPT',
                    actor: 'DEVELOPER'
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', fingerprint, lifecyclePhase: 'CONCEPT' }));
            } catch (err) {
                console.error('[st8:server] Concept file error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            } finally {
                if (persistence) persistence.close();
            }
        });
    }

    _handleMvpLock(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        // Consume the request body to drain the socket (prevents connection leak)
        // Body size limit: 1KB
        const MAX_BODY_SIZE = 1024;
        let body = '';
        let bodyTooLarge = false;

        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
            }
        });

        req.on('end', async () => {
            if (bodyTooLarge) return;
            let persistence;
            try {
                const { St8Persistence } = require('../database/persistence');
                const { SchemaCardEmitter } = require('../../features/schema-cards/emitter');
                const { notificationBus } = require('../notification-bus');

                persistence = new St8Persistence();
                await persistence.initialize();

                const files = persistence.getAllFiles();
                const results = [];

                for (const file of files) {
                    if (file.lifecyclePhase === 'CONCEPT' || file.lifecyclePhase === 'DEVELOPMENT') {
                        persistence.db.prepare(
                            `UPDATE file_registry SET lifecyclePhase = 'LOCKED' WHERE fingerprint = ?`
                        ).run(file.fingerprint);

                        persistence.logMutation({
                            fingerprint: file.fingerprint,
                            sha256Hash: file.sha256Hash,
                            mutationType: 'LOCK',
                            changedFields: JSON.stringify({ lifecyclePhase: [file.lifecyclePhase, 'LOCKED'] }),
                            actor: 'DEVELOPER',
                            metadata: '{}'
                        });

                        notificationBus.publish({
                            fingerprint: file.fingerprint,
                            filepath: file.filepath,
                            mutationType: 'LOCK',
                            actor: 'DEVELOPER'
                        });

                        results.push({
                            fingerprint: file.fingerprint,
                            filepath: file.filepath,
                            previousPhase: file.lifecyclePhase
                        });
                    }
                }

                // Re-emit all schema cards with LOCKED phase
                if (this.targetDir) {
                    const emitter = new SchemaCardEmitter(this.targetDir);
                    emitter.emitAllCards(persistence);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', lockedFiles: results.length, files: results }));
            } catch (err) {
                console.error('[st8:server] MVP lock error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            } finally {
                if (persistence) persistence.close();
            }
        });
    }

    _handlePrd(req, res) {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use GET.' }));
            return;
        }

        try {
            if (!this.targetDir) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No target directory configured' }));
                return;
            }

            const { loadSchemaCards, generatePRD } = require('../../features/prd/generator');
            const cardsDir = path.join(this.targetDir, '.st8', 'schema-cards');

            const cards = loadSchemaCards(cardsDir);
            const prd = generatePRD(cards);

            res.writeHead(200, { 'Content-Type': 'text/markdown' });
            res.end(prd);
        } catch (err) {
            console.error('[st8:server] PRD generation error:', err.message);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        }
    }

    _handleProductionPromote(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        const MAX_BODY_SIZE = 1024; // 1KB
        let body = '';
        let bodyTooLarge = false;
        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large. Maximum size is 1KB.' }));
            }
        });
        req.on('end', async () => {
            if (bodyTooLarge) return;

            let persistence;
            try {
                let fingerprint;
                try {
                    ({ fingerprint } = JSON.parse(body));
                } catch (parseErr) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                    return;
                }

                if (!fingerprint) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'fingerprint is required' }));
                    return;
                }

                const { St8Persistence } = require('../database/persistence');
                const { notificationBus } = require('../notification-bus');

                persistence = new St8Persistence();
                await persistence.initialize();

                const result = persistence.purgeDevelopmentData(fingerprint);

                notificationBus.publish({
                    fingerprint,
                    mutationType: 'PRODUCTION',
                    actor: 'DEVELOPER'
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', purgedMutations: result.purgedMutations }));
            } catch (err) {
                console.error('[st8:server] Production promote error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            } finally {
                if (persistence) persistence.close();
            }
        });
    }

    _handleGapAnalysis(req, res) {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use GET.' }));
            return;
        }
        
        let persistence;
        try {
            const { GapAnalyzer } = require('../../features/analysis/gap-analyzer');
            const { St8Persistence } = require('../database/persistence');
            
            persistence = new St8Persistence();
            persistence.initialize().then(() => {
                const schemaCardsDir = require('path').join(this.targetDir, '.st8', 'schema-cards');
                const analyzer = new GapAnalyzer(schemaCardsDir, persistence);
                const report = analyzer.analyze();
                
                // Content negotiation
                const accept = req.headers.accept || '';
                if (accept.includes('text/markdown')) {
                    const markdown = analyzer.toMarkdown(report);
                    res.writeHead(200, { 'Content-Type': 'text/markdown' });
                    res.end(markdown);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(report, null, 2));
                }
            }).catch(err => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }).finally(() => {
                if (persistence) persistence.close();
            });
        } catch (err) {
            if (persistence) persistence.close();
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    }

    _handlePrdProjects(req, res, url) {
        if (req.method === 'GET') {
            // Check for /api/prd-projects/:name
            const match = url.pathname.match(/^\/api\/prd-projects\/(.+)$/);
            if (match) {
                const name = decodeURIComponent(match[1]);
                const { St8Persistence } = require('../database/persistence');
                const persistence = new St8Persistence();
                try {
                    persistence.initialize();
                    const project = persistence.getPRDProject(name);
                    if (!project) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Project not found' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', project }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                } finally {
                    persistence.close();
                }
            } else {
                // List all projects
                const { St8Persistence } = require('../database/persistence');
                const persistence = new St8Persistence();
                try {
                    persistence.initialize();
                    const projects = persistence.getAllPRDProjects();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', projects }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                } finally {
                    persistence.close();
                }
            }
        } else if (req.method === 'POST') {
            // Body limit: 2KB for projects
            const MAX_BODY_SIZE = 2048;
            let body = '';
            let bodyTooLarge = false;

            req.on('data', chunk => {
                if (bodyTooLarge) return;
                body += chunk;
                if (body.length > MAX_BODY_SIZE) {
                    bodyTooLarge = true;
                    body = '';
                    req.destroy();
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Request body too large' }));
                }
            });

            req.on('end', async () => {
                if (bodyTooLarge) return;
                try {
                    const { name, template, variables } = JSON.parse(body);
                    if (!name || !template) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'name and template are required' }));
                        return;
                    }
                    const { St8Persistence } = require('../database/persistence');
                    const persistence = new St8Persistence();
                    try {
                        await persistence.initialize();
                        const projectPath = path.join(this.targetDir || '.', 'prd-projects', name);
                        persistence.createPRDProject(name, projectPath, template, variables || {});

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            status: 'ok',
                            project: { name, path: projectPath, template, variables: variables || {} }
                        }));
                    } catch (err) {
                        if (err.message && err.message.includes('UNIQUE constraint failed')) {
                            res.writeHead(409, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Project name already exists' }));
                            return;
                        }
                        throw err;
                    } finally {
                        persistence.close();
                    }
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }

    _handleBrunoCall(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        const MAX_BODY_SIZE = 1024;
        let body = '';
        let bodyTooLarge = false;

        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large' }));
            }
        });

        req.on('end', () => {
            if (bodyTooLarge) return;
            try {
                const parsed = body ? JSON.parse(body) : {};
                const threshold = parsed.threshold || 5;

                const { BrunoOscar } = require('../../features/lifecycle/bruno-oscar');
                const { St8Persistence } = require('../database/persistence');
                const { notificationBus } = require('../notification-bus');
                const persistence = new St8Persistence();

                persistence.initialize().then(() => {
                    try {
                        const bruno = new BrunoOscar(persistence, notificationBus);
                        const result = bruno.runBrunoCall(threshold);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } finally {
                        persistence.close();
                    }
                }).catch(err => {
                    persistence.close();
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    _handleOscarHouse(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        const MAX_BODY_SIZE = 1024;
        let body = '';
        let bodyTooLarge = false;

        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large' }));
            }
        });

        req.on('end', () => {
            if (bodyTooLarge) return;
            try {
                const parsed = body ? JSON.parse(body) : {};
                const gracePeriod = parsed.gracePeriod || 7;

                const { BrunoOscar } = require('../../features/lifecycle/bruno-oscar');
                const { St8Persistence } = require('../database/persistence');
                const { notificationBus } = require('../notification-bus');
                const persistence = new St8Persistence();

                persistence.initialize().then(() => {
                    try {
                        const oscar = new BrunoOscar(persistence, notificationBus);
                        const result = oscar.runOscarHouse(gracePeriod);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } finally {
                        persistence.close();
                    }
                }).catch(err => {
                    persistence.close();
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    _handleNeedsAIReview(req, res) {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use GET.' }));
            return;
        }

        const { St8Persistence } = require('../database/persistence');
        const persistence = new St8Persistence();

        persistence.initialize().then(() => {
            try {
                const files = persistence.getFilesNeedingAIReview();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', files }));
            } finally {
                persistence.close();
            }
        }).catch(err => {
            persistence.close();
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
    }

    _handleMarkReviewed(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
            return;
        }

        const MAX_BODY_SIZE = 1024;
        let body = '';
        let bodyTooLarge = false;

        req.on('data', chunk => {
            if (bodyTooLarge) return;
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                bodyTooLarge = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large' }));
            }
        });

        req.on('end', () => {
            if (bodyTooLarge) return;
            try {
                const { filepath, approved, notes } = JSON.parse(body || '{}');
                if (!filepath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'filepath is required' }));
                    return;
                }

                const { St8Persistence } = require('../database/persistence');
                const persistence = new St8Persistence();

                persistence.initialize().then(() => {
                    try {
                        persistence.markAIReviewed(filepath);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok', filepath, reviewed: true }));
                    } finally {
                        persistence.close();
                    }
                }).catch(err => {
                    persistence.close();
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    _handleTemplates(req, res, url) {
        if (req.method === 'GET') {
            const { TemplateEngine } = require('../../features/prd/template-engine');
            try {
                const engine = new TemplateEngine();
                const templates = engine.listTemplates();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', templates }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        } else if (req.method === 'POST') {
            const MAX_BODY_SIZE = 2048;
            let body = '';
            let bodyTooLarge = false;

            req.on('data', chunk => {
                if (bodyTooLarge) return;
                body += chunk;
                if (body.length > MAX_BODY_SIZE) {
                    bodyTooLarge = true;
                    body = '';
                    req.destroy();
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Request body too large' }));
                }
            });

            req.on('end', () => {
                if (bodyTooLarge) return;
                try {
                    const { name, content, description } = JSON.parse(body);
                    if (!name || !content) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'name and content are required' }));
                        return;
                    }

                    const { TemplateEngine } = require('../../features/prd/template-engine');
                    const engine = new TemplateEngine();
                    engine.saveTemplate(name, `# ${description || name}\n${content}`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok', name, variables: engine.detectVariables(content) }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
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
