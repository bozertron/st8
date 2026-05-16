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
const auth = require('./auth');

// ─── SETTINGS CATEGORY ALLOWLIST (ticket 8, Wave 5C) ─────────
//
// Backend mirror of SETTINGS_CATEGORIES from
// src/frontend/components/settings/settings.js (line 15). The frontend
// is the canonical source of truth; this mirror exists so the POST
// /api/settings handler can reject typos like `voidfloow` at write
// time rather than persisting permanently-orphaned rows that no UI
// category will ever read.
//
// If you add a category in settings.js, you MUST add it here too.
// A drift test in tests/core/server/handle-settings-validation.test.js
// asserts the two lists stay in sync.
const ALLOWED_SETTINGS_CATEGORIES = Object.freeze([
    'sirkits',
    'models',
    'shells',
    'voidflow',
    'keybindings',
    'theme',
    'storage',
    'network'
]);

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

// ─── INPUT VALIDATION ────────────────────────────────────────
//
// validateRecordCommitPayload (ticket 28) — strict-shape validator for
// POST /api/record-commit. Returns:
//   { ok: true, payload }   — normalized payload (defaults applied,
//                              unknown keys stripped, types coerced
//                              to canonical forms where unambiguous)
//   { ok: false, error }    — human-readable error string the route
//                              should return as the 400 body
//
// Rules:
//   - hash:         REQUIRED string, 1..200 chars
//   - shortHash:    optional string, 0..40 chars   (default '')
//   - subject:      optional string, 0..500 chars  (default '')
//   - author:       optional string, 0..300 chars  (default '')
//   - timestamp:    optional string, 0..50 chars   (default '')
//   - branch:       optional string, 0..200 chars  (default '')
//   - filesChanged: optional integer 0..10000      (default 0)
//
// Unknown keys → 400. The shell hook only ever produces the seven
// canonical fields, so strict mode prevents arbitrary callers from
// polluting activity_log.details with attacker-controlled fields.
//
// Exposed via module.exports for direct unit-testability.

const RECORD_COMMIT_ALLOWED_KEYS = new Set([
    'hash', 'shortHash', 'subject', 'author', 'timestamp', 'branch', 'filesChanged',
]);
const RECORD_COMMIT_STRING_LIMITS = {
    hash: 200,
    shortHash: 40,
    subject: 500,
    author: 300,
    timestamp: 50,
    branch: 200,
};
const FILES_CHANGED_MAX = 10000;

function validateRecordCommitPayload(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        return { ok: false, error: 'payload must be a JSON object' };
    }
    // Reject unknown keys up front so a typo isn't silently accepted.
    for (const key of Object.keys(input)) {
        if (!RECORD_COMMIT_ALLOWED_KEYS.has(key)) {
            return { ok: false, error: `unknown field: ${key}` };
        }
    }

    // hash — required, non-empty string.
    if (typeof input.hash !== 'string') {
        return { ok: false, error: 'hash required (string)' };
    }
    if (input.hash.length === 0) {
        return { ok: false, error: 'hash required (non-empty)' };
    }
    if (input.hash.length > RECORD_COMMIT_STRING_LIMITS.hash) {
        return { ok: false, error: `hash too long (max ${RECORD_COMMIT_STRING_LIMITS.hash})` };
    }

    const out = { hash: input.hash };

    // Other string fields — optional; if present must be strings; default ''.
    for (const field of ['shortHash', 'subject', 'author', 'timestamp', 'branch']) {
        if (field in input && input[field] !== undefined && input[field] !== null) {
            if (typeof input[field] !== 'string') {
                return { ok: false, error: `${field} must be a string` };
            }
            if (input[field].length > RECORD_COMMIT_STRING_LIMITS[field]) {
                return {
                    ok: false,
                    error: `${field} too long (max ${RECORD_COMMIT_STRING_LIMITS[field]})`,
                };
            }
            out[field] = input[field];
        } else {
            out[field] = '';
        }
    }

    // filesChanged — optional integer 0..FILES_CHANGED_MAX. Reject:
    //   string, array, object, float, negative, NaN, Infinity, >MAX.
    if ('filesChanged' in input && input.filesChanged !== undefined && input.filesChanged !== null) {
        const v = input.filesChanged;
        if (typeof v !== 'number') {
            return { ok: false, error: 'filesChanged must be a number' };
        }
        if (!Number.isFinite(v)) {
            return { ok: false, error: 'filesChanged must be finite' };
        }
        if (!Number.isInteger(v)) {
            return { ok: false, error: 'filesChanged must be an integer' };
        }
        if (v < 0) {
            return { ok: false, error: 'filesChanged must be >= 0' };
        }
        if (v > FILES_CHANGED_MAX) {
            return { ok: false, error: `filesChanged exceeds sanity cap (${FILES_CHANGED_MAX})` };
        }
        out.filesChanged = v;
    } else {
        out.filesChanged = 0;
    }

    return { ok: true, payload: out };
}

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
            this._writePortFile();
            this._ensureAuthSecret();
        });

        return true;
    }

    /**
     * Write the live server port to <targetDir>/.st8/server.port so the
     * post-commit git hook (and any other out-of-process tooling) can
     * auto-discover where st8 is listening, rather than hardcoding 3847
     * or relying on git invoking hooks with a usable env.
     *
     * Silent on success; logs a warning on failure (non-fatal — the server
     * runs fine without the file).
     */
    _writePortFile() {
        if (!this.targetDir) return;
        try {
            const st8Dir = path.join(this.targetDir, '.st8');
            if (!fs.existsSync(st8Dir)) {
                fs.mkdirSync(st8Dir, { recursive: true });
            }
            const portPath = path.join(st8Dir, 'server.port');
            fs.writeFileSync(portPath, String(this.port) + '\n', 'utf8');
        } catch (err) {
            console.warn('[st8:server] Could not write .st8/server.port:', err.message);
        }
    }

    /**
     * Generate (or load) the shared auth secret stored at
     * <targetDir>/.st8/server.secret. Writes the file with mode 0600 if
     * it does not yet exist. The post-commit shell hook reads this
     * file; the frontend fetches it via the loopback-gated
     * /api/auth-token endpoint.
     *
     * Logs a warning on failure — the server can still serve static
     * files and read-only endpoints, but the auth-required write
     * endpoints will return 503 until a secret is present.
     */
    _ensureAuthSecret() {
        if (!this.targetDir) return;
        try {
            auth.ensureSecret(this.targetDir);
        } catch (err) {
            console.warn('[st8:server] Could not initialize auth secret:', err.message);
        }
    }

    _handleRequest(req, res) {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        
        // CORS headers — restricted to localhost origins only (security fix: prevent RCE via CORS wildcard).
        // X-St8-Secret is the ticket-27 auth header; must be in
        // Access-Control-Allow-Headers so browser fetch() preflights
        // don't strip it.
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:' + this.port);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-St8-Secret');
        
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
            case '/api/record-commit':
                this._handleRecordCommit(req, res);
                break;
            case '/api/tickets':
                this._handleTickets(req, res, url);
                break;
            case '/api/tickets/count':
                this._handleTicketsCount(req, res);
                break;
            case '/api/auth-token':
                this._handleAuthToken(req, res);
                break;
            case '/api/signal-path':
                this._handleSignalPath(req, res, url);
                break;
            case '/api/generate-report':
                this._handleGenerateReport(req, res);
                break;
            case '/api/insights':
                this._handleInsights(req, res, url);
                break;
            case '/api/identity-risk':
                this._handleIdentityRisk(req, res);
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
                        // Ticket 8: reject unknown categories so typos
                        // like `voidfloow` don't create permanently
                        // orphaned rows.
                        if (!ALLOWED_SETTINGS_CATEGORIES.includes(category)) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                error: 'unknown settings category',
                                category: category,
                                allowed: ALLOWED_SETTINGS_CATEGORIES
                            }));
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
        //
        // Wave 4C ticket 8: keepalive heartbeat is owned by the
        // NotificationBus itself (per-client `: heartbeat\n\n` write
        // every heartbeatMs, default 30s). The bus also installs the
        // 'close' / 'error' cleanup handlers + clears the heartbeat
        // timer on disconnect. This route stays a one-liner —
        // robustness lives in addSSEClient where it can be tested in
        // isolation against the real Set without booting the full
        // St8Server. See tests/core/notification-bus.test.js for the
        // 7 heartbeat + cleanup probes.
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

                // Fire LIFECYCLE_TRANSITION: this is the canonical null → CONCEPT
                // phase transition (file did not exist as a registry row before
                // this call; registerConceptFile inserts the row with
                // lifecyclePhase='CONCEPT'). Lazy require avoids the circular
                // dep with main.js — same pattern as _handleRecordCommit and
                // _handleTickets.
                try {
                    const { hookRegistry, HOOKS } = require('../hook-registry');
                    await hookRegistry.execute(HOOKS.LIFECYCLE_TRANSITION, {
                        file: { fingerprint, filepath },
                        oldPhase: null,
                        newPhase: 'CONCEPT',
                    });
                } catch (hookErr) {
                    console.error('[st8:concept-file] hook fire failed:', hookErr.message);
                }

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

    async _handlePrd(req, res) {
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

            // Fire PRD_GENERATE BEFORE the generator runs so subscribers can
            // pre-validate, pre-process, or short-circuit. Payload mirrors
            // the canonical HOOKS contract { targetDir, options }. No options
            // are surfaced today (the route is a simple GET); kept as an
            // empty object so the contract stays stable when query-string
            // options are added later.
            try {
                const { hookRegistry, HOOKS } = require('../hook-registry');
                await hookRegistry.execute(HOOKS.PRD_GENERATE, {
                    targetDir: this.targetDir,
                    options: {},
                });
            } catch (hookErr) {
                console.error('[st8:prd] hook fire failed:', hookErr.message);
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

                // Capture the pre-purge phase + filepath so the
                // LIFECYCLE_TRANSITION fire below has the real oldPhase rather
                // than guessing. Lookup is by fingerprint (production-promote's
                // primary key); inline SQL because the persistence layer
                // doesn't expose a getFileByFingerprint helper today.
                let oldPhase = null;
                let filepath = null;
                try {
                    const row = persistence.db.prepare(
                        'SELECT filepath, lifecyclePhase FROM file_registry WHERE fingerprint = ?'
                    ).get(fingerprint);
                    if (row) {
                        oldPhase = row.lifecyclePhase || null;
                        filepath = row.filepath || null;
                    }
                } catch (lookupErr) {
                    // Lookup failure is non-fatal — we'll fire the hook with
                    // oldPhase=null so subscribers at least get the transition
                    // signal. Log loudly so the gap is observable.
                    console.error('[st8:promote] pre-purge fingerprint lookup failed:', lookupErr.message);
                }

                const result = persistence.purgeDevelopmentData(fingerprint);

                notificationBus.publish({
                    fingerprint,
                    mutationType: 'PRODUCTION',
                    actor: 'DEVELOPER'
                });

                // Fire LIFECYCLE_TRANSITION for the DEVELOPMENT → PRODUCTION
                // promotion. purgeDevelopmentData sets lifecyclePhase to
                // 'PRODUCTION' inside its transaction, so by this point the
                // row is in the new phase. oldPhase came from the pre-purge
                // lookup above.
                try {
                    const { hookRegistry, HOOKS } = require('../hook-registry');
                    await hookRegistry.execute(HOOKS.LIFECYCLE_TRANSITION, {
                        file: { fingerprint, filepath },
                        oldPhase,
                        newPhase: 'PRODUCTION',
                    });
                } catch (hookErr) {
                    console.error('[st8:promote] hook fire failed:', hookErr.message);
                }

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

    /**
     * POST /api/signal-path  body: { filepath: 'src/foo.js' }
     * GET  /api/signal-path?filepath=src/foo.js
     *
     * Returns the signal path (topologically-ordered upstream dependency
     * chain) for the given file. Backed by signal-path-adapter, which
     * wraps path-generator over a SemanticGraph built from
     * file_registry + connections. Wave 3B founder-priority wire-up.
     *
     * Body / query: { filepath: string, targetDir?: string }
     * Response: { ok: true, plan, outcome, reasons, pathSummary }
     *        or { ok: false, error }
     *
     * Frontend integration (dive-in panel visualization) is roadmap
     * P1.1 / Wave 7. Backend probed via curl is the milestone here.
     */
    _handleSignalPath(req, res, url) {
        const handle = (filepath, targetDirOverride) => {
            let persistence;
            try {
                if (!filepath || typeof filepath !== 'string') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: 'filepath (string) required' }));
                    return;
                }
                const { computeSignalPath } = require('../../features/analysis/signal-path-adapter');
                const { St8Persistence } = require('../database/persistence');
                persistence = new St8Persistence();
                persistence.initialize().then(() => {
                    try {
                        const result = computeSignalPath({
                            persistence,
                            targetFilepath: filepath,
                            targetDir: targetDirOverride || this.targetDir || '.',
                        });
                        res.writeHead(result.ok ? 200 : 404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result, null, 2));
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: false, error: err.message }));
                    } finally {
                        if (persistence) persistence.close();
                    }
                }).catch((err) => {
                    if (persistence) persistence.close();
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: err.message }));
                });
            } catch (err) {
                if (persistence) persistence.close();
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        };

        if (req.method === 'GET') {
            const filepath = url.searchParams.get('filepath');
            const targetDir = url.searchParams.get('targetDir');
            handle(filepath, targetDir);
            return;
        }
        if (req.method === 'POST') {
            const MAX = 4096;
            let body = '';
            let over = false;
            req.on('data', (chunk) => {
                if (over) return;
                body += chunk;
                if (body.length > MAX) {
                    over = true;
                    body = '';
                    req.destroy();
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: 'Request body too large (max 4KB)' }));
                }
            });
            req.on('end', () => {
                if (over) return;
                try {
                    const payload = JSON.parse(body || '{}');
                    handle(payload.filepath, payload.targetDir);
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
                }
            });
            return;
        }
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Method not allowed. Use GET or POST.' }));
    }

    /**
     * POST /api/generate-report  body: { filepath: 'src/foo.js' }
     *
     * Computes the signal path for `filepath`, feeds the resulting
     * Integr8Output-shaped object into report-generator's
     * generateMigrationReport(), and returns Markdown. Sits downstream
     * of /api/signal-path. Wave 3B ticket 5 wire-up.
     *
     * Accept negotiation: text/markdown → raw markdown; otherwise
     * returns JSON envelope with the markdown in `report`.
     */
    _handleGenerateReport(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }));
            return;
        }
        const MAX = 4096;
        let body = '';
        let over = false;
        req.on('data', (chunk) => {
            if (over) return;
            body += chunk;
            if (body.length > MAX) {
                over = true;
                body = '';
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'Request body too large (max 4KB)' }));
            }
        });
        req.on('end', () => {
            if (over) return;
            let persistence;
            try {
                const payload = JSON.parse(body || '{}');
                const filepath = payload.filepath;
                if (!filepath || typeof filepath !== 'string') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: 'filepath (string) required' }));
                    return;
                }
                const { computeSignalPath } = require('../../features/analysis/signal-path-adapter');
                const { generateMigrationReport } = require('../../features/analysis/report-generator');
                const { St8Persistence } = require('../database/persistence');
                persistence = new St8Persistence();
                persistence.initialize().then(() => {
                    try {
                        const sp = computeSignalPath({
                            persistence,
                            targetFilepath: filepath,
                            targetDir: payload.targetDir || this.targetDir || '.',
                        });
                        if (!sp.ok) {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(sp));
                            return;
                        }
                        // Synthesize an Integr8Output for report-generator.
                        // The report-generator inspects: migrationPlan,
                        // semanticGraph, outcome, reasons. We build a
                        // minimal but real envelope from the signal-path
                        // adapter output — no stub fields.
                        const integr8Output = {
                            migrationPlan: sp.plan,
                            migrationReport: '',
                            semanticGraph: {
                                nodes: [], // not consumed by report-generator's surface; safe to elide
                                edges: [],
                                properties: sp.pathSummary.graphProperties,
                            },
                            outcome: sp.outcome,
                            reasons: sp.reasons,
                        };
                        const markdown = generateMigrationReport(integr8Output);
                        const accept = req.headers.accept || '';
                        if (accept.includes('text/markdown')) {
                            res.writeHead(200, { 'Content-Type': 'text/markdown' });
                            res.end(markdown);
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ ok: true, report: markdown, pathSummary: sp.pathSummary }, null, 2));
                        }
                    } catch (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: false, error: err.message }));
                    } finally {
                        if (persistence) persistence.close();
                    }
                }).catch((err) => {
                    if (persistence) persistence.close();
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: err.message }));
                });
            } catch (err) {
                if (persistence) persistence.close();
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
    }

    /**
     * GET /api/insights[?filepath=<path>]
     *
     * Returns insight records for a file (or all files when filepath is
     * omitted). Insights are produced by the INDEX_COMPLETE subscriber
     * that walks file_registry and writes to InsightRecords. Wave 3B
     * ticket 7 wire-up.
     */
    _handleInsights(req, res, url) {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Method not allowed. Use GET.' }));
            return;
        }
        let store;
        try {
            const { getInsightStore } = require('../../features/analysis/insight-store');
            store = getInsightStore();
            const filepath = url.searchParams.get('filepath');
            const projectId = url.searchParams.get('projectId') || 'st8';
            if (filepath) {
                const insights = store.getInsightsForFile(projectId, filepath);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, filepath, projectId, insights, count: insights.length }, null, 2));
            } else {
                const summary = store.getCategorySummary(projectId);
                const recent = store.getRecentInsights(projectId, 50);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, projectId, categorySummary: summary, recent, recentCount: recent.length }, null, 2));
            }
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: err.message }));
        }
    }

    /**
     * GET /api/identity-risk
     *
     * Wave 3C consumer for the `.st8/identity-risk.json` artefact written
     * by the indexer when one or more files used the mtime-fallback path
     * for birthTimestamp (stat.birthtime was epoch / pre-1980). Surfaces
     * the identity-drift risk count + per-file record list so
     * frontend / introspection tools have a stable contract instead of
     * each having to find and parse the file themselves.
     *
     * Shape:
     *   - file present:   { ok: true, count: N, records: [...], generatedAt }
     *   - file absent:    { ok: true, count: 0, records: [], generatedAt: null }
     *   - parse failure:  500 { ok: false, error }
     *
     * "File absent" is a CLEAN state (the indexer deletes the file on a
     * clean run so consumers don't read stale data — see indexer.js
     * around L476). We return 200 with count=0 rather than 404 so
     * polling clients can render "no risks" without special-casing.
     *
     * No auth gate — matches the GET-route pattern used by /api/insights
     * and /api/signal-path. The data is read-only and the underlying file
     * is only accessible to anyone with FS access to the target dir.
     */
    _handleIdentityRisk(req, res) {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Method not allowed. Use GET.' }));
            return;
        }
        if (!this.targetDir) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'No target directory configured' }));
            return;
        }
        const riskPath = path.join(this.targetDir, '.st8', 'identity-risk.json');
        try {
            if (!fs.existsSync(riskPath)) {
                // Clean run — indexer deleted the stale artefact. Return
                // a count-zero envelope so callers don't need to special-
                // case absence.
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    ok: true,
                    count: 0,
                    records: [],
                    generatedAt: null,
                    note: 'No identity-risk artefact present — clean run.',
                }, null, 2));
                return;
            }
            const raw = fs.readFileSync(riskPath, 'utf-8');
            const parsed = JSON.parse(raw);
            // Indexer writes { generatedAt, fallbackCount, records }.
            // Surface fallbackCount as `count` for parity with the
            // /api/insights envelope.
            const count = typeof parsed.fallbackCount === 'number'
                ? parsed.fallbackCount
                : (Array.isArray(parsed.records) ? parsed.records.length : 0);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                ok: true,
                count,
                records: Array.isArray(parsed.records) ? parsed.records : [],
                generatedAt: parsed.generatedAt || null,
            }, null, 2));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: err.message }));
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

                persistence.initialize().then(async () => {
                    try {
                        const bruno = new BrunoOscar(persistence, notificationBus);
                        // Wave 4B ticket 10: runBrunoCall is now async (it
                        // awaits HOOKS.LIFECYCLE_TRANSITION subscribers).
                        const result = await bruno.runBrunoCall(threshold);
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

                persistence.initialize().then(async () => {
                    try {
                        const oscar = new BrunoOscar(persistence, notificationBus);
                        // Wave 4B ticket 10: runOscarHouse is now async.
                        const result = await oscar.runOscarHouse(gracePeriod);
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

    /**
     * POST /api/record-commit
     *
     * Receives commit metadata from the post-commit git hook
     * (scripts/git-hooks/post-commit) and:
     *   1. Logs a COMMIT_RECORDED activity row in the activity_log table.
     *      (Commits are project-level events — they cannot satisfy the
     *      mutation_log.fingerprint → file_registry FK, so they live in
     *      activity_log, not mutation_log.)
     *   2. Fires the COMMIT_RECORDED hook (for subscribers that want to
     *      react to commits — e.g. snapshot the manifest, regenerate gap
     *      analysis). Batch 025 corrected this from LIFECYCLE_TRANSITION
     *      (wrong payload contract) to a dedicated COMMIT_RECORDED hook.
     *
     * Body shape (from the shell hook):
     *   { hash, shortHash, subject, author, timestamp, branch, filesChanged }
     *
     * Validation (ticket 28): the shell hook always produces well-typed
     * fields, but the route is also reachable from `curl` and from the
     * frontend (and any future external integration), so types are
     * enforced here. Strict mode: extra fields are rejected so callers
     * cannot pollute activity_log.details with arbitrary payloads.
     */
    _handleRecordCommit(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        // Auth gate (ticket 27). Missing/wrong secret → 401 with a
        // generic body; reason logged server-side for debugging.
        const authCheck = auth.checkRequest(req, this.targetDir);
        if (!authCheck.ok) {
            console.warn('[st8:auth] /api/record-commit rejected:', authCheck.reason);
            res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'unauthorized' }));
            return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
            try {
                let rawPayload;
                try {
                    rawPayload = JSON.parse(body || '{}');
                } catch (parseErr) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'invalid JSON: ' + parseErr.message }));
                    return;
                }

                const validation = validateRecordCommitPayload(rawPayload);
                if (!validation.ok) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: validation.error }));
                    return;
                }
                // Use the NORMALIZED payload (defaults applied, extras
                // stripped) so activity_log.details + the hook payload
                // see a well-typed shape, not whatever the client sent.
                const payload = validation.payload;

                // Shared, memoized persistence instance — see persistence.js
                // getSharedPersistence(). First call opens better-sqlite3 +
                // runs ST8_SCHEMA + introspection; subsequent calls are O(1).
                const { getSharedPersistence } = require('../database/persistence');
                const persistence = await getSharedPersistence();

                // Commits are project-level events, not per-file mutations
                // (mutation_log.fingerprint has a FK to file_registry that
                // a commit-level row can't satisfy). Record into activity_log
                // instead — that table is exactly for system-level events.
                persistence.logActivity({
                    source: 'GIT',
                    action: 'COMMIT_RECORDED',
                    details: payload,
                });

                // Fire COMMIT_RECORDED so subscribers can react (regenerate
                // manifests, refresh dashboard widgets, etc.). Loaded lazily
                // to avoid a circular require with main.js.
                try {
                    const { hookRegistry, HOOKS } = require('../hook-registry');
                    await hookRegistry.execute(HOOKS.COMMIT_RECORDED, {
                        commit: payload,
                    });
                } catch (hookErr) {
                    // Non-fatal — hook registry may not be initialized.
                    console.error('[st8:record-commit] hook fire failed:', hookErr.message);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, hash: payload.hash }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    /**
     * /api/tickets
     *   GET  → list open tickets (newest first)
     *   POST → create a ticket from a user note
     *     body: { fingerprint, filepath, userNote, sha256Hash?, status?, identityBundle? }
     *     - Returns { ok, id, createdAt }
     *     - Fires HOOKS.TICKET_CREATED so phreak / SSE / future LLM
     *       claim-watchers can react.
     */
    _handleTickets(req, res, url) {
        // Shared persistence — see getSharedPersistence() in persistence.js.
        const { getSharedPersistence } = require('../database/persistence');

        if (req.method === 'GET') {
            // No hook fired here by design — queries are read-only and have
            // no subscribers today. If a future subscriber needs to observe
            // ticket reads (e.g. a phreak> session marking itself "aware"),
            // fire a TICKETS_QUERIED hook here. Don't add the constant
            // prematurely — wait for a real subscriber to drive the contract.
            getSharedPersistence().then(function(persistence) {
                try {
                    const tickets = persistence.getOpenTickets(200);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ tickets: tickets, count: tickets.length }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        // Auth gate (ticket 27). Same shape as _handleRecordCommit.
        const authCheck = auth.checkRequest(req, this.targetDir);
        if (!authCheck.ok) {
            console.warn('[st8:auth] /api/tickets POST rejected:', authCheck.reason);
            res.writeHead(authCheck.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'unauthorized' }));
            return;
        }

        let body = '';
        req.on('data', function(chunk) { body += chunk; });
        req.on('end', async function() {
            try {
                const payload = JSON.parse(body || '{}');
                if (!payload.fingerprint || !payload.filepath) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'fingerprint + filepath required' }));
                    return;
                }
                const persistence = await getSharedPersistence();
                const ticket = persistence.createTicket({
                    fingerprint: payload.fingerprint,
                    filepath: payload.filepath,
                    sha256Hash: payload.sha256Hash || null,
                    statusAtCreation: payload.status || null,
                    userNote: payload.userNote || '',
                    identityBundle: payload.identityBundle || null,
                });

                persistence.logActivity({
                    source: 'USER_UI',
                    action: 'TICKET_CREATED',
                    targetFingerprint: payload.fingerprint,
                    details: { ticketId: ticket.id, filepath: payload.filepath },
                });

                // Fire the hook so subscribers (future Sonic indexer,
                // phreak's badge counter, etc.) can react. The payload is
                // an EXPLICIT shape — do not spread the raw request body
                // here, since clients can post arbitrary extra fields that
                // would silently land in the hook context and confuse
                // subscribers expecting a fixed contract.
                try {
                    const { hookRegistry, HOOKS } = require('../hook-registry');
                    const ticketPayload = {
                        id: ticket.id,
                        fingerprint: payload.fingerprint,
                        filepath: payload.filepath,
                        userNote: payload.userNote || '',
                        sha256Hash: payload.sha256Hash || null,
                        statusAtCreation: payload.status || null,
                        identityBundle: payload.identityBundle || null,
                        createdAt: ticket.createdAt,
                    };
                    await hookRegistry.execute(HOOKS.TICKET_CREATED, {
                        ticket: ticketPayload,
                    });
                } catch (hookErr) {
                    console.error('[st8:tickets] hook fire failed:', hookErr.message);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, id: ticket.id, createdAt: ticket.createdAt }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    /** GET /api/tickets/count → { count } for the phreak> TUI badge. */
    _handleTicketsCount(req, res) {
        // No hook fired here by design — see the matching note in
        // _handleTickets GET. Fire TICKETS_QUERIED here if query
        // subscribers are introduced.
        const { getSharedPersistence } = require('../database/persistence');
        getSharedPersistence().then(function(persistence) {
            try {
                const count = persistence.countOpenTickets();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ count: count }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }

    /**
     * GET /api/auth-token → returns the shared secret to a loopback
     * caller so the frontend can include it as X-St8-Secret on
     * subsequent POSTs. Non-loopback callers get 403.
     *
     * This endpoint is itself NOT secret-gated — the gate is the
     * loopback check. Rationale: the frontend is loaded same-origin
     * over HTTP and needs SOME way to obtain the header value. Any
     * caller that can reach this endpoint over loopback already has
     * read access to anything else served by st8 (manifests, schema
     * cards) and could read .st8/server.secret directly if the
     * filesystem is accessible. So the loopback constraint is the
     * meaningful boundary.
     */
    _handleAuthToken(req, res) {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }
        if (!auth.isLoopback(req)) {
            console.warn('[st8:auth] /api/auth-token rejected non-loopback:', req.socket && req.socket.remoteAddress);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'forbidden' }));
            return;
        }
        const secret = auth.readSecret(this.targetDir);
        if (!secret) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'auth not initialized' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ secret: secret }));
    }

    stop() {
        if (this.server) {
            this.server.close();
            console.log('[st8:server] Server stopped');
        }
        // Remove the port file so stale readers don't keep hitting a dead
        // port. Best-effort — missing file is fine.
        if (this.targetDir) {
            try {
                const portPath = path.join(this.targetDir, '.st8', 'server.port');
                if (fs.existsSync(portPath)) fs.unlinkSync(portPath);
            } catch (_) { /* non-fatal */ }
        }
    }
}

// ─── EXPORTS ─────────────────────────────────────────────────

module.exports = {
    St8Server,
    // Exposed for unit testing (ticket 28). Not part of the runtime API
    // — internal helpers documented at the top of this file.
    validateRecordCommitPayload,
    // Ticket 8 (Wave 5C): exposed so the drift test can compare against
    // the frontend's SETTINGS_CATEGORIES list.
    ALLOWED_SETTINGS_CATEGORIES,
};
