# Detailed Line-by-Line Report: lib/commands/backgroundIndexer.js

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/backgroundIndexer.js`
**Total Lines:** 812
**Generated:** 2026-05-13

---

## Executive Summary

BackgroundIndexer is the core background indexing engine for the st8 project. It implements a non-blocking project registration system with exhaustive background indexing, incremental updates, file watching, and multi-pass analysis. The class extends EventEmitter to provide real-time progress reporting.

---

## Section-by-Section Documentation

### Lines 1-2: File Header
```
"use strict";
// src/commands/backgroundIndexer.ts
```
- **What this section does:** Enables strict mode and indicates this is compiled from TypeScript
- **What triggers it:** N/A (static)
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** N/A
- **Status:** WORKING
- **Gap:** None

---

### Lines 3-4: Documentation Comment
```
// PM-1 Layer 1: Background Indexer — the heart of the "parse to oblivion" vision.
// Non-blocking project registration, exhaustive background indexing, incremental updates.
```
- **What this section does:** Documents the component's purpose and architectural layer
- **What triggers it:** N/A
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** N/A
- **Status:** WORKING
- **Gap:** None

---

### Lines 5-15: TypeScript Helper `__createBinding`
```javascript
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
```
- **What this section does:** TypeScript compiled helper for creating property bindings on module objects
- **What triggers it:** Module initialization
- **What it calls:** `Object.getOwnPropertyDescriptor()`, `Object.defineProperty()`
- **What calls it:** `__importStar()` (line 21)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None (TypeScript boilerplate)

---

### Lines 16-20: TypeScript Helper `__setModuleDefault`
```javascript
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
```
- **What this section does:** Sets default export on module objects
- **What triggers it:** Module initialization
- **What it calls:** `Object.defineProperty()`
- **What calls it:** `__importStar()` (line 34)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None (TypeScript boilerplate)

---

### Lines 21-37: TypeScript Helper `__importStar`
```javascript
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
```
- **What this section does:** Imports all exports from a module (used for `import * as`)
- **What triggers it:** Module require statements
- **What it calls:** `__createBinding()`, `__setModuleDefault()`, `Object.getOwnPropertyNames()`
- **What calls it:** Lines 54-56 (path, crypto, fs imports)
- **Dependencies:** `__createBinding`, `__setModuleDefault`
- **Status:** WORKING
- **Gap:** None (TypeScript boilerplate)

---

### Lines 38-46: TypeScript Helper `__awaiter`
```javascript
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
```
- **What this section does:** Async/await polyfill for TypeScript
- **What triggers it:** All async method calls
- **What it calls:** Promise constructor
- **What calls it:** Every `async` method in the class
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None (TypeScript boilerplate)

---

### Lines 47-49: TypeScript Helper `__importDefault`
```javascript
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
```
- **What this section does:** Handles default imports from CommonJS modules
- **What triggers it:** `require()` calls with default imports
- **What it calls:** None
- **What calls it:** Lines 57, 59 (better-sqlite3, fast-glob imports)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None (TypeScript boilerplate)

---

### Lines 50-52: Module Exports
```javascript
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundIndexer = void 0;
exports.getBackgroundIndexer = getBackgroundIndexer;
```
- **What this section does:** Sets up module exports for ES module compatibility
- **What triggers it:** Module loading
- **What it calls:** `Object.defineProperty()`
- **What calls it:** N/A (exported symbols)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

### Lines 53-67: Import Statements
```javascript
const events_1 = require("events");
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const chokidar_1 = require("chokidar");
const fast_glob_1 = __importDefault(require("fast-glob"));
const databasePersister_js_1 = require("./integr8/databasePersister.js");
const dataIngestion_js_1 = require("./integr8/dataIngestion.js");
const parserPersistence_js_1 = require("./parserPersistence.js");
const sonicClient_js_1 = require("./sonicClient.js");
const insightStore_js_1 = require("./insightStore.js");
const multiPassAnalyzer_js_1 = require("./multiPassAnalyzer.js");
const precisionCapture_js_1 = require("./precisionCapture.js");
const types_js_1 = require("./integr8/types.js");
```
- **What this section does:** Imports all required modules
- **What triggers it:** Module initialization
- **What it calls:** `require()` for each module
- **What calls it:** Module loader
- **Dependencies:**
  - `events` (Node.js built-in) - EventEmitter base class
  - `path` (Node.js built-in) - Path manipulation
  - `crypto` (Node.js built-in) - Hash generation
  - `fs` (Node.js built-in) - File system operations
  - `better-sqlite3` - SQLite database driver
  - `chokidar` - File watcher
  - `fast-glob` - File pattern matching
  - `./integr8/databasePersister.js` - Database path management
  - `./integr8/dataIngestion.js` - Data ingestion pipeline
  - `./parserPersistence.js` - Parser persistence layer
  - `./sonicClient.js` - Sonic search client
  - `./insightStore.js` - Insight storage
  - `./multiPassAnalyzer.js` - Multi-pass analysis
  - `./precisionCapture.js` - Precision capture modes
  - `./integr8/types.js` - Type definitions
- **Status:** WORKING
- **Gap:** None

---

### Lines 68-69: Class Declaration
```javascript
// ============ BACKGROUND INDEXER ============
class BackgroundIndexer extends events_1.EventEmitter {
```
- **What this section does:** Declares BackgroundIndexer class extending EventEmitter
- **What triggers it:** N/A (class definition)
- **What it calls:** `EventEmitter` constructor
- **What calls it:** N/A (class definition)
- **Dependencies:** `events` module
- **Status:** WORKING
- **Gap:** None

---

### Lines 70-90: Constructor
```javascript
constructor(options) {
    var _a;
    super();
    this.jobQueue = [];
    this.activeJobs = new Map();
    this.watchers = new Map();
    this.processing = false;
    this.shutdownRequested = false;
    this.maxConcurrentJobs = (_a = options === null || options === void 0 ? void 0 : options.maxConcurrentJobs) !== null && _a !== void 0 ? _a : 2;
    const dbPath = (options === null || options === void 0 ? void 0 : options.dbPath) || (0, databasePersister_js_1.getSharedDatabasePath)();
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    this.db = new better_sqlite3_1.default(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.insightStore = (0, insightStore_js_1.getInsightStore)(dbPath);
    this.ensureTables();
}
```
- **What this section does:** Initializes BackgroundIndexer instance
- **What triggers it:** `new BackgroundIndexer(options)` or `getBackgroundIndexer(options)`
- **What it calls:**
  - `EventEmitter` constructor (line 72)
  - `databasePersister.getSharedDatabasePath()` (line 79)
  - `path.dirname()` (line 81)
  - `fs.existsSync()` (line 82)
  - `fs.mkdirSync()` (line 83)
  - `better-sqlite3` constructor (line 85)
  - `this.db.pragma()` (lines 86-87)
  - `insightStore.getInsightStore()` (line 88)
  - `this.ensureTables()` (line 89)
- **What calls it:** `getBackgroundIndexer()` function (line 802)
- **Dependencies:**
  - `./integr8/databasePersister.js` - `getSharedDatabasePath()`
  - `better-sqlite3` - SQLite database
  - `./insightStore.js` - `getInsightStore()`
- **Status:** WORKING
- **Gap:**
  - Line 78: `maxConcurrentJobs` defaults to 2, but no validation if user passes invalid value
  - Line 79: If `dbPath` is invalid, the constructor will throw
  - Line 86-87: Pragma settings are synchronous but not wrapped in try/catch

---

### Lines 91-111: `ensureTables()` Method
```javascript
ensureTables() {
    this.db.exec(`
  CREATE TABLE IF NOT EXISTS IndexedProjects (
    project_id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    file_count INTEGER DEFAULT 0,
    insight_count INTEGER DEFAULT 0,
    last_indexed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    watch_enabled INTEGER DEFAULT 0,
    capture_mode TEXT DEFAULT 'balanced'
  );

  CREATE INDEX IF NOT EXISTS idx_indexed_projects_status ON IndexedProjects(status);
  CREATE INDEX IF NOT EXISTS idx_indexed_projects_path ON IndexedProjects(project_path);
`);
}
```
- **What this section does:** Creates IndexedProjects table and indexes if they don't exist
- **What triggers it:** Constructor (line 89)
- **What it calls:** `this.db.exec()` - raw SQL execution
- **What calls it:** Constructor
- **Dependencies:** SQLite database
- **Status:** WORKING
- **Gap:**
  - No error handling if `db.exec()` fails
  - Table schema uses `INTEGER` for boolean `watch_enabled` - works but unconventional

---

### Lines 112-116: `addProject()` Method Documentation
```javascript
// ─── Public API ─────────────────────────────────────────────────────────────
/**
 * Register a project for indexing. Returns immediately (non-blocking).
 * The project is queued for background indexing.
 */
```
- **What this section does:** Documents the addProject method
- **What triggers it:** N/A
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** N/A
- **Status:** WORKING
- **Gap:** None

---

### Lines 117-160: `addProject()` Method
```javascript
addProject(projectPath, options) {
    var _a;
    const resolvedPath = path.resolve(projectPath);
    const projectId = this.generateProjectId(resolvedPath);
    const name = (options === null || options === void 0 ? void 0 : options.name) || path.basename(resolvedPath);
    const captureMode = (options === null || options === void 0 ? void 0 : options.captureMode) || 'balanced';
    const watchEnabled = (options === null || options === void 0 ? void 0 : options.watch) !== false; // default to true
    const priority = (_a = options === null || options === void 0 ? void 0 : options.priority) !== null && _a !== void 0 ? _a : 5;
    // Check if already registered
    const existing = this.db.prepare('SELECT project_id, status FROM IndexedProjects WHERE project_path = ?').get(resolvedPath);
    if (existing) {
        // Re-queue if in error state, otherwise return existing
        if (existing.status === 'error') {
            this.db.prepare('UPDATE IndexedProjects SET status = ?, error_message = NULL WHERE project_id = ?').run('queued', existing.project_id);
            this.enqueueJob({
                jobId: crypto.randomUUID(),
                projectId: existing.project_id,
                projectPath: resolvedPath,
                type: 'full',
                priority,
                createdAt: Date.now(),
            });
            this.processQueue();
        }
        return existing.project_id;
    }
    // Insert new project record
    this.db.prepare(`
  INSERT INTO IndexedProjects (project_id, project_path, name, status, watch_enabled, capture_mode)
  VALUES (?, ?, ?, 'queued', ?, ?)
`).run(projectId, resolvedPath, name, watchEnabled ? 1 : 0, captureMode);
    // Queue initial full index job
    this.enqueueJob({
        jobId: crypto.randomUUID(),
        projectId,
        projectPath: resolvedPath,
        type: 'full',
        priority,
        createdAt: Date.now(),
    });
    this.emit('project-added', { projectId, projectPath: resolvedPath, name });
    this.processQueue();
    return projectId;
}
```
- **What this section does:** Registers a new project for background indexing
- **What triggers it:** API call to add a project
- **What it calls:**
  - `path.resolve()` (line 119)
  - `this.generateProjectId()` (line 120)
  - `path.basename()` (line 121)
  - `this.db.prepare().get()` (line 126)
  - `this.db.prepare().run()` (line 130)
  - `this.enqueueJob()` (lines 131-138)
  - `this.processQueue()` (lines 139, 158)
  - `crypto.randomUUID()` (lines 132, 150)
  - `Date.now()` (lines 137, 155)
  - `this.db.prepare().run()` (line 144)
  - `this.emit()` (line 157)
- **What calls it:** External API consumers
- **Dependencies:**
  - `path` module
  - `crypto` module
  - SQLite database
- **Status:** WORKING
- **Gap:**
  - Line 119: No validation that `projectPath` exists or is accessible
  - Line 120: `generateProjectId()` truncates SHA-256 to 12 chars - potential collision risk (though very low)
  - Line 123: `watchEnabled` defaults to `true` even if not specified
  - Line 124: `priority` defaults to 5 with no validation of range
  - Line 130: If project is in error state, re-queues but doesn't emit event
  - Line 144: SQL injection possible if `name` contains single quotes (though prepared statements should prevent this)
  - **BUG:** Line 130: Re-queues error projects but doesn't emit 'project-added' event, only 'project-added' is emitted for new projects

---

### Lines 161-181: `removeProject()` Method
```javascript
removeProject(projectId) {
    const project = this.getProjectRecord(projectId);
    if (!project)
        return false;
    // Stop watcher if active
    this.stopWatcher(projectId);
    // Remove from job queue
    this.jobQueue = this.jobQueue.filter(j => j.projectId !== projectId);
    // Update status
    this.db.prepare('UPDATE IndexedProjects SET status = ? WHERE project_id = ?')
        .run('removing', projectId);
    // Clear insights
    this.insightStore.clearProject(projectId);
    // Remove project record
    this.db.prepare('DELETE FROM IndexedProjects WHERE project_id = ?').run(projectId);
    this.emit('project-removed', { projectId, projectPath: project.projectPath });
    return true;
}
```
- **What this section does:** Removes a project from the indexer and cleans up resources
- **What triggers it:** API call to remove a project
- **What it calls:**
  - `this.getProjectRecord()` (line 165)
  - `this.stopWatcher()` (line 169)
  - `this.insightStore.clearProject()` (line 176)
  - `this.db.prepare().run()` (lines 173-174, 178)
  - `this.emit()` (line 179)
- **What calls it:** External API consumers
- **Dependencies:**
  - `./insightStore.js` - `clearProject()`
  - SQLite database
- **Status:** WORKING
- **Gap:**
  - Line 173-174: Sets status to 'removing' but immediately deletes on line 178 - the 'removing' status is never visible
  - No error handling if `insightStore.clearProject()` fails
  - No cleanup of Sonic index data
  - **BUG:** Race condition possible if jobs are actively running for this project

---

### Lines 182-188: `getProjectStatus()` Method
```javascript
getProjectStatus(projectId) {
    const row = this.db.prepare('SELECT status FROM IndexedProjects WHERE project_id = ?').get(projectId);
    return row ? row.status : null;
}
```
- **What this section does:** Gets the current status of a project
- **What triggers it:** API call to query project status
- **What it calls:**
  - `this.db.prepare().get()` (line 186)
- **What calls it:** External API consumers
- **Dependencies:** SQLite database
- **Status:** WORKING
- **Gap:** None

---

### Lines 189-206: `listProjects()` Method
```javascript
listProjects() {
    const rows = this.db.prepare('SELECT * FROM IndexedProjects ORDER BY created_at DESC').all();
    return rows.map(row => ({
        projectId: row.project_id,
        projectPath: row.project_path,
        name: row.name,
        status: row.status,
        fileCount: row.file_count,
        insightCount: row.insight_count,
        lastIndexedAt: row.last_indexed_at,
        createdAt: row.created_at,
        error: row.error_message || undefined,
        watchEnabled: row.watch_enabled === 1,
    }));
}
```
- **What this section does:** Lists all registered projects with their status
- **What triggers it:** API call to list projects
- **What it calls:**
  - `this.db.prepare().all()` (line 193)
- **What calls it:** External API consumers
- **Dependencies:** SQLite database
- **Status:** WORKING
- **Gap:**
  - Line 193: Uses `SELECT *` which is fragile if schema changes
  - No pagination for large result sets

---

### Lines 207-226: `getProject()` Method
```javascript
getProject(idOrName) {
    const row = this.db.prepare('SELECT * FROM IndexedProjects WHERE project_id = ? OR name = ?').get(idOrName, idOrName);
    if (!row)
        return null;
    return {
        projectId: row.project_id,
        projectPath: row.project_path,
        name: row.name,
        status: row.status,
        fileCount: row.file_count,
        insightCount: row.insight_count,
        lastIndexedAt: row.last_indexed_at,
        createdAt: row.created_at,
        error: row.error_message || undefined,
        watchEnabled: row.watch_enabled === 1,
    };
}
```
- **What this section does:** Gets a single project record by ID or name
- **What triggers it:** API call to get project details
- **What it calls:**
  - `this.db.prepare().get()` (line 211)
- **What calls it:** External API consumers
- **Dependencies:** SQLite database
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 211: Queries by `name` which is not unique - could return wrong project if multiple projects have same name
  - Uses `SELECT *` which is fragile

---

### Lines 227-245: `shutdown()` Method
```javascript
shutdown() {
    return __awaiter(this, void 0, void 0, function* () {
        this.shutdownRequested = true;
        // Stop all watchers
        for (const [projectId] of this.watchers) {
            this.stopWatcher(projectId);
        }
        // Wait for active jobs to complete (with timeout)
        const timeout = Date.now() + 30000;
        while (this.activeJobs.size > 0 && Date.now() < timeout) {
            yield sleep(100);
        }
        this.insightStore.close();
        this.db.close();
    });
}
```
- **What this section does:** Gracefully shuts down the indexer
- **What triggers it:** API call to shutdown
- **What it calls:**
  - `this.stopWatcher()` (line 235)
  - `sleep()` (line 240)
  - `this.insightStore.close()` (line 242)
  - `this.db.close()` (line 243)
- **What calls it:** External API consumers
- **Dependencies:**
  - `./insightStore.js` - `close()`
  - SQLite database
  - `sleep()` utility (line 809)
- **Status:** WORKING
- **Gap:**
  - Line 239-241: Waits 30 seconds max but doesn't force-kill active jobs
  - No cleanup of Sonic connection
  - No event emission on shutdown complete
  - **BUG:** If active jobs don't complete in 30 seconds, they continue running after db.close() - potential crash

---

### Lines 246-256: `enqueueJob()` Method
```javascript
// ─── Job Queue Management ───────────────────────────────────────────────────
enqueueJob(job) {
    // Insert into priority queue (higher priority = processed first)
    const insertIdx = this.jobQueue.findIndex(j => j.priority < job.priority);
    if (insertIdx === -1) {
        this.jobQueue.push(job);
    }
    else {
        this.jobQueue.splice(insertIdx, 0, job);
    }
}
```
- **What this section does:** Adds a job to the priority queue
- **What triggers it:** `addProject()`, `setupWatcher()`, error recovery
- **What it calls:**
  - `this.jobQueue.findIndex()` (line 249)
  - `this.jobQueue.push()` (line 251)
  - `this.jobQueue.splice()` (line 254)
- **What calls it:** `addProject()`, `setupWatcher()` (via scheduleReindex)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 249: `findIndex` uses `<` which means jobs with equal priority are added to the end (FIFO within same priority). This is correct behavior but not documented.
  - No duplicate job detection

---

### Lines 257-285: `processQueue()` Method
```javascript
processQueue() {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.processing || this.shutdownRequested)
            return;
        this.processing = true;
        try {
            while (this.jobQueue.length > 0 && this.activeJobs.size < this.maxConcurrentJobs) {
                if (this.shutdownRequested)
                    break;
                const job = this.jobQueue.shift();
                if (!job)
                    break;
                this.activeJobs.set(job.jobId, job);
                // Fire and forget — job runs in background
                this.executeJob(job).finally(() => {
                    this.activeJobs.delete(job.jobId);
                    // Continue processing if more jobs
                    if (this.jobQueue.length > 0) {
                        this.processing = false;
                        this.processQueue();
                    }
                });
            }
        }
        finally {
            this.processing = false;
        }
    });
}
```
- **What this section does:** Processes jobs from the queue with concurrency control
- **What triggers it:** `addProject()`, `setupWatcher()`, job completion
- **What it calls:**
  - `this.jobQueue.shift()` (line 266)
  - `this.activeJobs.set()` (line 269)
  - `this.executeJob()` (line 271)
  - `this.activeJobs.delete()` (line 272)
  - `this.processQueue()` (recursive, line 276)
- **What calls it:** `addProject()`, `setupWatcher()`, self (recursively)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 271-278: "Fire and forget" pattern means errors in `executeJob()` are swallowed if no error handler attached
  - **BUG:** Line 275-276: Sets `this.processing = false` then calls `this.processQueue()` which checks `this.processing` - race condition possible
  - Line 260: Guard `this.processing` check is not atomic

---

### Lines 286-310: `executeJob()` Method
```javascript
executeJob(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const { projectId, projectPath, type, changedFiles } = job;
        try {
            // Update status
            this.updateProjectStatus(projectId, 'indexing');
            if (type === 'full') {
                yield this.executeFullIndex(projectId, projectPath);
            }
            else {
                yield this.executeIncrementalIndex(projectId, projectPath, changedFiles || []);
            }
            // Mark as ready
            this.updateProjectStatus(projectId, 'ready');
            this.db.prepare('UPDATE IndexedProjects SET last_indexed_at = ? WHERE project_id = ?').run(new Date().toISOString(), projectId);
            this.emit('index-complete', { projectId, projectPath, type });
        }
        catch (err) {
            const errorMessage = err.message || 'Unknown indexing error';
            this.updateProjectStatus(projectId, 'error', errorMessage);
            this.emit('index-error', { projectId, projectPath, error: errorMessage });
        }
    });
}
```
- **What this section does:** Executes a single indexing job
- **What triggers it:** `processQueue()`
- **What it calls:**
  - `this.updateProjectStatus()` (lines 292, 300, 306)
  - `this.executeFullIndex()` (line 294)
  - `this.executeIncrementalIndex()` (line 297)
  - `this.db.prepare().run()` (line 301)
  - `this.emit()` (lines 302, 307)
- **What calls it:** `processQueue()`
- **Dependencies:**
  - `this.executeFullIndex()`
  - `this.executeIncrementalIndex()`
- **Status:** WORKING
- **Gap:**
  - Line 301: Uses `new Date().toISOString()` instead of `CURRENT_TIMESTAMP` - inconsistent with table default
  - Error handling catches all errors but doesn't differentiate between recoverable and fatal errors

---

### Lines 311-351: `executeFullIndex()` Method
```javascript
executeFullIndex(projectId, projectPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const captureMode = this.getProjectCaptureMode(projectId);
        const captureManager = (0, precisionCapture_js_1.createCaptureManager)(captureMode);
        // Phase 1: Scan — discover all source files
        this.emitProgress(projectId, projectPath, 'scanning', 0, 0, 0, 'Discovering source files...');
        const sourceFiles = yield this.discoverSourceFiles(projectPath);
        const totalFiles = sourceFiles.length;
        this.updateFileCount(projectId, totalFiles);
        this.emitProgress(projectId, projectPath, 'scanning', totalFiles, totalFiles, 0, `Found ${totalFiles} source files`);
        // Phase 2: Parse — run integr8 data ingestion
        this.emitProgress(projectId, projectPath, 'parsing', 0, totalFiles, 0, 'Running integr8 data ingestion pipeline...');
        const graph = yield (0, dataIngestion_js_1.ingestSingleProject)(projectPath, true);
        this.emitProgress(projectId, projectPath, 'parsing', totalFiles, totalFiles, graph.nodes.length, `Parsed ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
        // Phase 3: Analyze — extract insights from graph nodes
        this.emitProgress(projectId, projectPath, 'analyzing', 0, totalFiles, 0, 'Analyzing relationships and patterns...');
        const insightCount = yield this.extractInsights(projectId, projectPath, graph, sourceFiles, captureManager);
        this.emitProgress(projectId, projectPath, 'analyzing', totalFiles, totalFiles, insightCount, `Extracted ${insightCount} insights`);
        // Phase 4: Persist — save graph to SQLite
        this.emitProgress(projectId, projectPath, 'persisting', 0, totalFiles, insightCount, 'Persisting graph data...');
        yield this.persistGraph(projectId, graph);
        this.emitProgress(projectId, projectPath, 'persisting', totalFiles, totalFiles, insightCount, 'Graph persisted');
        // Phase 5: Index — push symbols/files to Sonic
        this.emitProgress(projectId, projectPath, 'indexing', 0, totalFiles, insightCount, 'Populating search index...');
        yield this.populateSonicIndex(projectId, graph);
        this.emitProgress(projectId, projectPath, 'indexing', totalFiles, totalFiles, insightCount, 'Search index populated');
        // Phase 6: Watch — set up file watcher
        const project = this.getProjectRecord(projectId);
        if (project === null || project === void 0 ? void 0 : project.watchEnabled) {
            this.emitProgress(projectId, projectPath, 'watching', totalFiles, totalFiles, insightCount, 'Setting up file watcher...');
            this.setupWatcher(projectId, projectPath);
        }
        // Update final counts
        this.db.prepare('UPDATE IndexedProjects SET file_count = ?, insight_count = ? WHERE project_id = ?').run(totalFiles, insightCount, projectId);
        // PM-1 Layer 2: Queue multi-pass analysis after initial indexing completes
        this.queueMultiPassAnalysis(projectId, projectPath);
    });
}
```
- **What this section does:** Full index pipeline with 6 phases
- **What triggers it:** `executeJob()` when job type is 'full'
- **What it calls:**
  - `this.getProjectCaptureMode()` (line 316)
  - `precisionCapture.createCaptureManager()` (line 317)
  - `this.emitProgress()` (lines 319, 323, 325, 327, 329, 331, 333, 335, 337, 339, 343)
  - `this.discoverSourceFiles()` (line 320)
  - `this.updateFileCount()` (line 322)
  - `dataIngestion.ingestSingleProject()` (line 326)
  - `this.extractInsights()` (line 330)
  - `this.persistGraph()` (line 334)
  - `this.populateSonicIndex()` (line 338)
  - `this.getProjectRecord()` (line 341)
  - `this.setupWatcher()` (line 344)
  - `this.db.prepare().run()` (line 347)
  - `this.queueMultiPassAnalysis()` (line 349)
- **What calls it:** `executeJob()`
- **Dependencies:**
  - `./precisionCapture.js` - `createCaptureManager()`
  - `./integr8/dataIngestion.js` - `ingestSingleProject()`
  - `this.extractInsights()`
  - `this.persistGraph()`
  - `this.populateSonicIndex()`
  - `this.setupWatcher()`
  - `this.queueMultiPassAnalysis()`
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 342: Optional chaining `project?.watchEnabled` uses void 0 check which is confusing - could be simplified
  - No error handling for individual phases - if Phase 3 fails, Phases 4-6 are skipped
  - Line 349: `queueMultiPassAnalysis` is called even if earlier phases failed

---

### Lines 352-399: `executeIncrementalIndex()` Method
```javascript
executeIncrementalIndex(projectId, projectPath, changedFiles) {
    return __awaiter(this, void 0, void 0, function* () {
        if (changedFiles.length === 0)
            return;
        this.emitProgress(projectId, projectPath, 'parsing', 0, changedFiles.length, 0, `Re-indexing ${changedFiles.length} changed files...`);
        // Clear old insights for changed files
        for (const filePath of changedFiles) {
            const relativePath = path.relative(projectPath, filePath);
            this.insightStore.clearFile(projectId, relativePath);
        }
        // Re-run full ingestion (the integr8 pipeline handles the full project)
        // For efficiency, we still run the full parse but only update insights for changed files
        const graph = yield (0, dataIngestion_js_1.ingestSingleProject)(projectPath, false);
        // Extract insights only for changed files
        const relativeChanged = new Set(changedFiles.map(f => path.relative(projectPath, f)));
        const changedNodes = graph.nodes.filter(n => n.path && relativeChanged.has(n.path));
        let insightCount = 0;
        for (const node of changedNodes) {
            if (node.path) {
                const insights = this.generateNodeInsights(projectId, node, 1);
                if (insights.length > 0) {
                    insightCount += this.insightStore.addInsightsBatch(insights);
                }
            }
        }
        // Update Sonic index for changed files
        for (const node of changedNodes) {
            if (node.path) {
                const objectId = `${projectId}:${node.path}`;
                yield sonicClient_js_1.sonicClient.flushObject('codebase', projectId, objectId);
                const searchText = this.buildSearchText(node);
                if (searchText) {
                    yield sonicClient_js_1.sonicClient.push('codebase', projectId, objectId, searchText);
                }
            }
        }
        // Update counts
        const totalInsights = this.db.prepare('SELECT COUNT(*) as cnt FROM InsightRecords WHERE project_id = ?').get(projectId);
        if (totalInsights) {
            this.db.prepare('UPDATE IndexedProjects SET insight_count = ? WHERE project_id = ?')
                .run(totalInsights.cnt, projectId);
        }
        this.emitProgress(projectId, projectPath, 'indexing', changedFiles.length, changedFiles.length, insightCount, `Incremental re-index complete: ${insightCount} insights updated`);
    });
}
```
- **What this section does:** Incremental index for changed files only
- **What trigger it:** `executeJob()` when job type is 'incremental'
- **What it calls:**
  - `this.emitProgress()` (lines 359, 397)
  - `path.relative()` (lines 362, 369)
  - `this.insightStore.clearFile()` (line 363)
  - `dataIngestion.ingestSingleProject()` (line 367)
  - `this.generateNodeInsights()` (line 374)
  - `this.insightStore.addInsightsBatch()` (line 376)
  - `sonicClient.flushObject()` (line 384)
  - `sonicClient.push()` (line 387)
  - `this.buildSearchText()` (line 385)
  - `this.db.prepare().get()` (line 392)
  - `this.db.prepare().run()` (line 394)
- **What calls it:** `executeJob()`
- **Dependencies:**
  - `./integr8/dataIngestion.js` - `ingestSingleProject()`
  - `./insightStore.js` - `clearFile()`, `addInsightsBatch()`
  - `./sonicClient.js` - `flushObject()`, `push()`
  - `path` module
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 365-367: Comment says "still run the full parse" which defeats the purpose of incremental indexing
  - Line 367: Passes `false` to `ingestSingleProject` but still runs full parse
  - No error handling for individual file processing
  - **BUG:** Line 384: `sonicClient.flushObject()` signature might not match - needs verification

---

### Lines 400-434: `discoverSourceFiles()` Method
```javascript
discoverSourceFiles(projectPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const patterns = [
                '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
                '**/*.vue', '**/*.svelte',
                '**/*.rs', '**/*.toml',
                '**/*.json', '**/*.yaml', '**/*.yml',
            ];
            const files = yield (0, fast_glob_1.default)(patterns, {
                cwd: projectPath,
                absolute: false,
                ignore: [
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/build/**',
                    '**/target/**',
                    '**/.git/**',
                    '**/coverage/**',
                    '**/.next/**',
                    '**/.nuxt/**',
                    '**/vendor/**',
                ],
                dot: false,
                followSymbolicLinks: false,
            });
            return files;
        }
        catch (err) {
            console.warn(`[BackgroundIndexer] File discovery failed for ${projectPath}: ${err.message}`);
            return [];
        }
    });
}
```
- **What this section does:** Discovers source files using glob patterns
- **What triggers it:** `executeFullIndex()`
- **What it calls:**
  - `fast_glob()` (line 410)
  - `console.warn()` (line 430)
- **What calls it:** `executeFullIndex()`
- **Dependencies:**
  - `fast-glob` module
- **Status:** WORKING
- **Gap:**
  - Line 404-409: Pattern list includes `.json`, `.yaml`, `.yml` which are config files - may not be appropriate for all projects
  - Line 425: `dot: false` excludes dotfiles but no option to configure
  - Line 430: Uses `console.warn` instead of proper logging

---

### Lines 435-501: `extractInsights()` Method
```javascript
extractInsights(projectId, projectPath, graph, sourceFiles, captureManager) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const allInsights = [];
        captureManager.beginSession(graph.nodes.length, 'parsing');
        // Generate insights from graph nodes
        for (const node of graph.nodes) {
            const insights = this.generateNodeInsights(projectId, node, 1);
            allInsights.push(...insights);
        }
        // Generate structural insights from edges (dependency patterns)
        const importNodes = graph.nodes.filter(n => n.type === types_js_1.NodeType.IMPORT);
        const exportNodes = graph.nodes.filter(n => n.type === types_js_1.NodeType.EXPORT);
        const fileNodes = graph.nodes.filter(n => n.type === types_js_1.NodeType.FILE);
        // Insight: files with high import count (potential coupling)
        const importsByFile = new Map();
        for (const imp of importNodes) {
            const sourceFile = (_a = imp.metadata) === null || _a === void 0 ? void 0 : _a.sourceFile;
            if (sourceFile) {
                importsByFile.set(sourceFile, (importsByFile.get(sourceFile) || 0) + 1);
            }
        }
        for (const [filePath, count] of importsByFile) {
            if (count > 15) {
                const fileId = this.insightStore.ensureFileSlot(projectId, filePath);
                allInsights.push({
                    projectId,
                    fileId,
                    filePath,
                    passNumber: 1,
                    category: 'dependency',
                    severity: count > 25 ? 'high' : 'medium',
                    description: `High import count (${count} imports) suggests tight coupling`,
                    evidence: `File imports from ${count} different modules`,
                    relatedNodeIds: [],
                    context: { importCount: count },
                });
            }
        }
        // Insight: unused exports (exports not referenced in other files)
        for (const exp of exportNodes) {
            if (((_b = exp.metadata) === null || _b === void 0 ? void 0 : _b.dependencyWeight) === 0 && exp.name !== 'default') {
                const filePath = exp.path || ((_c = exp.metadata) === null || _c === void 0 ? void 0 : _c.sourceFile) || '';
                if (filePath) {
                    const fileId = this.insightStore.ensureFileSlot(projectId, filePath);
                    allInsights.push({
                        projectId,
                        fileId,
                        filePath,
                        passNumber: 1,
                        category: 'unused_export',
                        severity: 'low',
                        description: `Export '${exp.name}' has no detected consumers`,
                        evidence: `Dependency weight = 0 for export: ${exp.name}`,
                        relatedNodeIds: [exp.id],
                        context: { exportName: exp.name, kind: (_d = exp.metadata) === null || _d === void 0 ? void 0 : _d.kind },
                    });
                }
            }
        }
        // Batch insert all insights
        const count = this.insightStore.addInsightsBatch(allInsights);
        captureManager.endSession();
        return count;
    });
}
```
- **What this section does:** Extracts insights from graph nodes and edges
- **What triggers it:** `executeFullIndex()`
- **What it calls:**
  - `captureManager.beginSession()` (line 440)
  - `this.generateNodeInsights()` (line 443)
  - `graph.nodes.filter()` (lines 447-449)
  - `this.insightStore.ensureFileSlot()` (lines 460, 480)
  - `this.insightStore.addInsightsBatch()` (line 497)
  - `captureManager.endSession()` (line 498)
- **What calls it:** `executeFullIndex()`
- **Dependencies:**
  - `./insightStore.js` - `ensureFileSlot()`, `addInsightsBatch()`
  - `./precisionCapture.js` - capture manager
  - `./integr8/types.js` - `NodeType`
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 449: `fileNodes` is declared but never used
  - Line 459: Magic number 15 for import count threshold - should be configurable
  - Line 467: Magic number 25 for high severity threshold - should be configurable
  - **BUG:** Line 477: `dependencyWeight === 0` check assumes 0 means unused, but what if weight is not set?

---

### Lines 502-560: `generateNodeInsights()` Method
```javascript
generateNodeInsights(projectId, node, passNumber) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const insights = [];
    const filePath = node.path || '';
    if (!filePath)
        return insights;
    const fileId = this.insightStore.ensureFileSlot(projectId, filePath);
    switch (node.type) {
        case types_js_1.NodeType.FILE:
            insights.push({
                projectId, fileId, filePath, passNumber,
                category: 'structural',
                severity: 'info',
                description: `File indexed: ${node.name}`,
                evidence: `Path: ${filePath}`,
                relatedNodeIds: [node.id],
                context: { nodeType: 'file' },
            });
            break;
        case types_js_1.NodeType.STORE:
            insights.push({
                projectId, fileId, filePath, passNumber,
                category: 'structural',
                severity: 'info',
                description: `Pinia store: ${node.name}`,
                evidence: `Store with ${(((_b = (_a = node.metadata) === null || _a === void 0 ? void 0 : _a.stateKeys) === null || _b === void 0 ? void 0 : _b.length) || 0)} state keys, ${(((_d = (_c = node.metadata) === null || _c === void 0 ? void 0 : _c.actionKeys) === null || _d === void 0 ? void 0 : _d.length) || 0)} actions`,
                relatedNodeIds: [node.id],
                context: {
                    stateKeys: (_e = node.metadata) === null || _e === void 0 ? void 0 : _e.stateKeys,
                    actionKeys: (_f = node.metadata) === null || _f === void 0 ? void 0 : _f.actionKeys,
                    getterKeys: (_g = node.metadata) === null || _g === void 0 ? void 0 : _g.getterKeys,
                },
            });
            break;
        case types_js_1.NodeType.COMMAND:
            insights.push({
                projectId, fileId, filePath, passNumber,
                category: 'api_surface',
                severity: 'info',
                description: `Tauri command: ${node.name}`,
                evidence: `Invoked in ${(((_j = (_h = node.metadata) === null || _h === void 0 ? void 0 : _h.invokedFiles) === null || _j === void 0 ? void 0 : _j.length) || 0)} files`,
                relatedNodeIds: [node.id],
                context: { invokedFiles: (_k = node.metadata) === null || _k === void 0 ? void 0 : _k.invokedFiles },
            });
            break;
        case types_js_1.NodeType.COMPONENT:
            insights.push({
                projectId, fileId, filePath, passNumber,
                category: 'structural',
                severity: 'info',
                description: `UI component: ${node.name}`,
                evidence: `Uses ${(((_m = (_l = node.metadata) === null || _l === void 0 ? void 0 : _l.uiElements) === null || _m === void 0 ? void 0 : _m.length) || 0)} UI elements`,
                relatedNodeIds: [node.id],
                context: { uiElements: (_o = node.metadata) === null || _o === void 0 ? void 0 : _o.uiElements },
            });
            break;
    }
    return insights;
}
```
- **What this section does:** Generates insights for individual nodes based on type
- **What triggers it:** `extractInsights()`, `executeIncrementalIndex()`
- **What it calls:**
  - `this.insightStore.ensureFileSlot()` (line 508)
- **What calls it:** `extractInsights()`, `executeIncrementalIndex()`
- **Dependencies:**
  - `./insightStore.js` - `ensureFileSlot()`
  - `./integr8/types.js` - `NodeType`
- **Status:** WORKING
- **Gap:**
  - **BUG:** Lines 527-534: Only handles FILE, STORE, COMMAND, COMPONENT types - missing handling for IMPORT, EXPORT, and other types
  - Line 508: `ensureFileSlot()` is called for every node, even if no insights are generated
  - **BUG:** The switch statement has no `default` case - unknown node types are silently ignored

---

### Lines 561-577: `persistGraph()` Method
```javascript
persistGraph(projectId, graph) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const persister = new parserPersistence_js_1.ParserPersistence();
            const snapshotId = persister.generateSnapshotId();
            // Extract file paths from FILE nodes
            const fileNodes = graph.nodes.filter(n => n.type === types_js_1.NodeType.FILE);
            const filePaths = fileNodes.map(n => n.path || n.name).filter(Boolean);
            persister.persistOverviewData(projectId, snapshotId, filePaths);
            persister.close();
        }
        catch (err) {
            console.warn(`[BackgroundIndexer] Graph persistence failed: ${err.message}`);
        }
    });
}
```
- **What this section does:** Persists graph data to SQLite via ParserPersistence
- **What triggers it:** `executeFullIndex()`
- **What it calls:**
  - `new ParserPersistence()` (line 565)
  - `persister.generateSnapshotId()` (line 566)
  - `persister.persistOverviewData()` (line 570)
  - `persister.close()` (line 571)
  - `console.warn()` (line 574)
- **What calls it:** `executeFullIndex()`
- **Dependencies:**
  - `./parserPersistence.js` - `ParserPersistence` class
- **Status:** WORKING
- **Gap:**
  - Line 565: Creates new `ParserPersistence` instance for each call - could be singleton
  - Line 574: Uses `console.warn` instead of proper logging
  - **BUG:** If `persistOverviewData()` fails, `close()` is never called - resource leak

---

### Lines 578-608: `populateSonicIndex()` Method
```javascript
populateSonicIndex(projectId, graph) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield sonicClient_js_1.sonicClient.connect();
            // Flush existing data for this project bucket
            yield sonicClient_js_1.sonicClient.flush('codebase', projectId);
            // Push each node into Sonic for search
            let pushCount = 0;
            for (const node of graph.nodes) {
                const searchText = this.buildSearchText(node);
                if (!searchText)
                    continue;
                const objectId = `${projectId}:${node.id}`;
                const success = yield sonicClient_js_1.sonicClient.push('codebase', projectId, objectId, searchText);
                if (success)
                    pushCount++;
                // Rate limit: don't overwhelm Sonic
                if (pushCount % 100 === 0) {
                    yield sleep(10);
                }
            }
            // Consolidate for suggestions to work
            yield sonicClient_js_1.sonicClient.consolidate();
        }
        catch (err) {
            // Sonic failures are non-fatal — search just won't work until next index
            console.warn(`[BackgroundIndexer] Sonic index population failed: ${err.message}`);
        }
    });
}
```
- **What this section does:** Populates Sonic search index with graph nodes
- **What triggers it:** `executeFullIndex()`
- **What it calls:**
  - `sonicClient.connect()` (line 582)
  - `sonicClient.flush()` (line 584)
  - `this.buildSearchText()` (line 588)
  - `sonicClient.push()` (line 592)
  - `sonicClient.consolidate()` (line 601)
  - `sleep()` (line 597)
  - `console.warn()` (line 605)
- **What calls it:** `executeFullIndex()`
- **Dependencies:**
  - `./sonicClient.js` - `connect()`, `flush()`, `push()`, `consolidate()`
  - `sleep()` utility
- **Status:** WORKING
- **Gap:**
  - Line 596-598: Rate limiting only triggers every 100 pushes - could still overwhelm Sonic with burst
  - Line 605: Uses `console.warn` instead of proper logging
  - **BUG:** If `sonicClient.connect()` fails, the entire method fails but error is swallowed

---

### Lines 609-629: `buildSearchText()` Method
```javascript
buildSearchText(node) {
    const parts = [node.name];
    if (node.path) {
        parts.push(node.path);
    }
    if (node.metadata) {
        if (node.metadata.exportedAs)
            parts.push(node.metadata.exportedAs);
        if (node.metadata.stateKeys)
            parts.push(...node.metadata.stateKeys);
        if (node.metadata.actionKeys)
            parts.push(...node.metadata.actionKeys);
        if (node.metadata.getterKeys)
            parts.push(...node.metadata.getterKeys);
        if (node.metadata.uiElements)
            parts.push(...node.metadata.uiElements);
        if (node.metadata.specifiers)
            parts.push(...node.metadata.specifiers);
    }
    return parts.filter(Boolean).join(' ').substring(0, 500);
}
```
- **What this section does:** Builds searchable text from node data
- **What triggers it:** `populateSonicIndex()`, `executeIncrementalIndex()`
- **What it calls:** None
- **What calls it:** `populateSonicIndex()`, `executeIncrementalIndex()`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - Line 628: Hardcoded 500 character limit - should be configurable
  - No deduplication of parts array

---

### Lines 630-710: `setupWatcher()` Method
```javascript
setupWatcher(projectId, projectPath) {
    // Stop existing watcher if any
    this.stopWatcher(projectId);
    const watcher = (0, chokidar_1.watch)(projectPath, {
        ignored: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/target/**',
            '**/.git/**',
            '**/coverage/**',
        ],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100,
        },
    });
    // Debounce mechanism: batch changes before re-indexing
    let pendingChanges = new Set();
    let debounceTimer = null;
    const scheduleReindex = () => {
        if (debounceTimer)
            clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (pendingChanges.size > 0) {
                const changedFiles = Array.from(pendingChanges);
                pendingChanges = new Set();
                // Queue incremental re-index
                this.enqueueJob({
                    jobId: crypto.randomUUID(),
                    projectId,
                    projectPath,
                    type: 'incremental',
                    priority: 3, // Lower priority than initial full index
                    changedFiles,
                    createdAt: Date.now(),
                });
                this.emit('files-changed', { projectId, projectPath, changedFiles });
                this.processQueue();
            }
        }, 2000); // Wait 2s after last change before re-indexing
    };
    const isSourceFile = (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        return ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.rs'].includes(ext);
    };
    watcher
        .on('change', (filePath) => {
        if (isSourceFile(filePath)) {
            pendingChanges.add(filePath);
            scheduleReindex();
        }
    })
        .on('add', (filePath) => {
        if (isSourceFile(filePath)) {
            pendingChanges.add(filePath);
            scheduleReindex();
        }
    })
        .on('unlink', (filePath) => {
        if (isSourceFile(filePath)) {
            pendingChanges.add(filePath);
            scheduleReindex();
        }
    })
        .on('error', (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[BackgroundIndexer] Watcher error for ${projectPath}: ${msg}`);
    });
    this.watchers.set(projectId, watcher);
}
```
- **What this section does:** Sets up file watcher for incremental updates
- **What triggers it:** `executeFullIndex()`, `addProject()` (via processQueue)
- **What it calls:**
  - `this.stopWatcher()` (line 633)
  - `chokidar.watch()` (line 634)
  - `clearTimeout()` (line 654)
  - `setTimeout()` (line 656)
  - `this.enqueueJob()` (line 661)
  - `crypto.randomUUID()` (line 662)
  - `Date.now()` (line 668)
  - `this.emit()` (line 670)
  - `this.processQueue()` (line 671)
  - `path.extname()` (line 676)
  - `console.warn()` (line 700)
- **What calls it:** `executeFullIndex()`
- **Dependencies:**
  - `chokidar` - file watcher
  - `crypto` module
  - `path` module
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 676-678: `isSourceFile()` only checks for specific extensions - missing `.toml`, `.json`, `.yaml`, `.yml` from `discoverSourceFiles()`
  - Line 656-673: Debounce timer of 2 seconds may be too long for rapid development
  - Line 700: Uses `console.warn` instead of proper logging
  - **BUG:** Line 666: Priority 3 for incremental jobs means they run after full index (priority 5) - may cause delays
  - No maximum queue size for pending changes

---

### Lines 711-736: `queueMultiPassAnalysis()` Method
```javascript
queueMultiPassAnalysis(projectId, projectPath) {
    // Run in background — don't await
    setImmediate(() => __awaiter(this, void 0, void 0, function* () {
        try {
            const analyzer = (0, multiPassAnalyzer_js_1.getMultiPassAnalyzer)();
            this.emit('multipass-start', { projectId, projectPath });
            const result = yield analyzer.runAllPasses(projectId);
            // Update insight count after multi-pass analysis
            const totalInsights = this.db.prepare('SELECT COUNT(*) as cnt FROM InsightRecords WHERE project_id = ?').get(projectId);
            if (totalInsights) {
                this.db.prepare('UPDATE IndexedProjects SET insight_count = ? WHERE project_id = ?')
                    .run(totalInsights.cnt, projectId);
            }
            this.emit('multipass-complete', { projectId, projectPath, result });
        }
        catch (err) {
            console.warn(`[BackgroundIndexer] Multi-pass analysis failed for ${projectPath}: ${err.message}`);
            this.emit('multipass-error', { projectId, projectPath, error: err.message });
        }
    }));
}
```
- **What this section does:** Queues multi-pass analysis in background
- **What triggers it:** `executeFullIndex()`
- **What it calls:**
  - `setImmediate()` (line 718)
  - `multiPassAnalyzer.getMultiPassAnalyzer()` (line 720)
  - `this.emit()` (lines 721, 729, 733)
  - `analyzer.runAllPasses()` (line 722)
  - `this.db.prepare().get()` (line 724)
  - `this.db.prepare().run()` (line 726)
  - `console.warn()` (line 732)
- **What calls it:** `executeFullIndex()`
- **Dependencies:**
  - `./multiPassAnalyzer.js` - `getMultiPassAnalyzer()`, `runAllPasses()`
  - SQLite database
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 718: Uses `setImmediate` with async - if async fails, error is swallowed
  - Line 732: Uses `console.warn` instead of proper logging
  - No cancellation mechanism if project is removed during analysis

---

### Lines 737-744: `generateProjectId()` Method
```javascript
generateProjectId(projectPath) {
    const hash = crypto.createHash('sha256')
        .update(projectPath)
        .digest('hex')
        .substring(0, 12);
    return `proj_${hash}`;
}
```
- **What this section does:** Generates unique project ID from path
- **What triggers it:** `addProject()`
- **What it calls:**
  - `crypto.createHash()` (line 739)
  - `.update()` (line 740)
  - `.digest()` (line 741)
  - `.substring()` (line 742)
- **What calls it:** `addProject()`
- **Dependencies:**
  - `crypto` module
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 742: Truncates SHA-256 to 12 characters (48 bits) - collision probability is ~1 in 2^48 for different paths. While low, not zero for large codebases.

---

### Lines 745-761: `getProjectRecord()` Method
```javascript
getProjectRecord(projectId) {
    const row = this.db.prepare('SELECT * FROM IndexedProjects WHERE project_id = ?').get(projectId);
    if (!row)
        return null;
    return {
        projectId: row.project_id,
        projectPath: row.project_path,
        name: row.name,
        status: row.status,
        fileCount: row.file_count,
        insightCount: row.insight_count,
        lastIndexedAt: row.last_indexed_at,
        createdAt: row.created_at,
        error: row.error_message || undefined,
        watchEnabled: row.watch_enabled === 1,
    };
}
```
- **What this section does:** Gets project record by ID
- **What triggers it:** Multiple internal methods
- **What it calls:**
  - `this.db.prepare().get()` (line 746)
- **What calls it:** `removeProject()`, `executeFullIndex()`
- **Dependencies:** SQLite database
- **Status:** WORKING
- **Gap:**
  - Uses `SELECT *` which is fragile

---

### Lines 762-765: `getProjectCaptureMode()` Method
```javascript
getProjectCaptureMode(projectId) {
    const row = this.db.prepare('SELECT capture_mode FROM IndexedProjects WHERE project_id = ?').get(projectId);
    return (row === null || row === void 0 ? void 0 : row.capture_mode) || 'balanced';
}
```
- **What this section does:** Gets capture mode for a project
- **What triggers it:** `executeFullIndex()`
- **What it calls:**
  - `this.db.prepare().get()` (line 763)
- **What calls it:** `executeFullIndex()`
- **Dependencies:** SQLite database
- **Status:** WORKING
- **Gap:** None

---

### Lines 766-776: `updateProjectStatus()` Method
```javascript
updateProjectStatus(projectId, status, error) {
    if (error) {
        this.db.prepare('UPDATE IndexedProjects SET status = ?, error_message = ? WHERE project_id = ?')
            .run(status, error, projectId);
    }
    else {
        this.db.prepare('UPDATE IndexedProjects SET status = ?, error_message = NULL WHERE project_id = ?')
            .run(status, projectId);
    }
    this.emit('status-changed', { projectId, status, error });
}
```
- **What this section does:** Updates project status in database
- **What triggers it:** `executeJob()`
- **What it calls:**
  - `this.db.prepare().run()` (lines 768-769, 772-773)
  - `this.emit()` (line 775)
- **What calls it:** `executeJob()`
- **Dependencies:** SQLite database
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 775: Emits `error` parameter even when it's `undefined` - inconsistent

---

### Lines 777-780: `updateFileCount()` Method
```javascript
updateFileCount(projectId, fileCount) {
    this.db.prepare('UPDATE IndexedProjects SET file_count = ? WHERE project_id = ?')
        .run(fileCount, projectId);
}
```
- **What this section does:** Updates file count in database
- **What triggers it:** `executeFullIndex()`
- **What it calls:**
  - `this.db.prepare().run()` (line 779)
- **What calls it:** `executeFullIndex()`
- **Dependencies:** SQLite database
- **Status:** WORKING
- **Gap:** None

---

### Lines 781-794: `emitProgress()` Method
```javascript
emitProgress(projectId, projectPath, phase, filesScanned, totalFiles, insightsFound, message) {
    const percentComplete = totalFiles > 0 ? Math.round((filesScanned / totalFiles) * 100) : 0;
    const progress = {
        projectId,
        projectPath,
        phase,
        filesScanned,
        totalFiles,
        insightsFound,
        percentComplete,
        message,
    };
    this.emit('progress', progress);
}
```
- **What this section does:** Emits progress events
- **What triggers it:** Multiple methods
- **What it calls:**
  - `this.emit()` (line 793)
- **What calls it:** `executeFullIndex()`, `executeIncrementalIndex()`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

### Lines 795-796: Class Export
```javascript
}
exports.BackgroundIndexer = BackgroundIndexer;
```
- **What this section does:** Closes class and exports
- **What triggers it:** Module loading
- **What it calls:** None
- **What calls it:** N/A
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

### Lines 797-807: Singleton Pattern
```javascript
// ============ SINGLETON ============
let _indexerInstance = null;
/**
 * Get or create the global BackgroundIndexer instance.
 */
function getBackgroundIndexer(options) {
    if (!_indexerInstance) {
        _indexerInstance = new BackgroundIndexer(options);
    }
    return _indexerInstance;
}
```
- **What this section does:** Implements singleton pattern for BackgroundIndexer
- **What triggers it:** Module consumers calling `getBackgroundIndexer()`
- **What it calls:**
  - `new BackgroundIndexer()` (line 804)
- **What calls it:** External consumers
- **Dependencies:** None
- **Status:** WORKING
- **Gap:**
  - **BUG:** Line 802-806: `options` parameter is only used on first call - subsequent calls ignore options even if different

---

### Lines 808-812: Utility Functions
```javascript
// ============ UTILITY ============
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=backgroundIndexer.js.map
```
- **What this section does:** Utility sleep function
- **What triggers it:** `processQueue()`, `populateSonicIndex()`, `shutdown()`
- **What it calls:**
  - `setTimeout()` (line 810)
- **What calls it:** `processQueue()`, `populateSonicIndex()`, `shutdown()`
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

## Summary of Findings

### Critical Issues (Bugs)
1. **Line 211**: `getProject()` queries by name which is not unique - could return wrong project
2. **Line 240-243**: If active jobs don't complete in 30 seconds, they continue running after db.close() - potential crash
3. **Line 275-276**: Race condition in processQueue - sets processing=false then calls processQueue recursively
4. **Line 342**: Optional chaining with void 0 check is confusing
5. **Line 365-367**: Incremental index still runs full parse - defeats purpose
6. **Line 449**: `fileNodes` declared but never used
7. **Line 477**: `dependencyWeight === 0` check may miss undefined weights
8. **Line 502-558**: Missing handling for IMPORT, EXPORT, and other node types
9. **Line 571**: If `persistOverviewData()` fails, `close()` is never called - resource leak
10. **Line 676-678**: `isSourceFile()` missing extensions from `discoverSourceFiles()`
11. **Line 742**: SHA-256 truncation to 12 chars has collision risk
12. **Line 802-806**: Singleton ignores options on subsequent calls

### Warnings
1. **Line 130**: Re-queued error projects don't emit events
2. **Line 173-174**: 'removing' status is set but immediately deleted
3. **Line 271-278**: Fire-and-forget pattern swallows errors
4. **Line 301**: Uses `new Date().toISOString()` instead of `CURRENT_TIMESTAMP`
5. **Line 349**: `queueMultiPassAnalysis` called even if earlier phases failed
6. **Line 384**: `sonicClient.flushObject()` signature needs verification
7. **Line 459**: Magic numbers 15/25 for import thresholds
8. **Line 596-598**: Rate limiting only every 100 pushes
9. **Line 628**: Hardcoded 500 character limit
10. **Line 666**: Priority 3 for incremental jobs may cause delays
11. **Line 775**: Emits undefined error parameter

### Code Quality Issues
1. Multiple `console.warn` calls instead of proper logging (lines 430, 574, 605, 700, 732)
2. Uses `SELECT *` in multiple queries (lines 193, 211, 746)
3. No pagination for large result sets
4. No validation of input parameters
5. Inconsistent error handling patterns

---

## Connections Map

### What Triggers Background Indexing?
- `addProject()` API call
- File watcher changes (debounced 2s)
- Error recovery re-queue

### What Other Files Get Called?
- `./integr8/databasePersister.js` - Database path management
- `./integr8/dataIngestion.js` - Data ingestion pipeline
- `./parserPersistence.js` - Parser persistence layer
- `./sonicClient.js` - Sonic search client
- `./insightStore.js` - Insight storage
- `./multiPassAnalyzer.js` - Multi-pass analysis
- `./precisionCapture.js` - Precision capture modes
- `./integr8/types.js` - Type definitions

### How Does It Differ from backend/indexer.js?
This is the **background** indexer - it runs asynchronously with job queues, file watching, and multi-pass analysis. The backend indexer is likely synchronous and focused on single operations.

---

_Reviewed: 2026-05-13_
_Reviewer: GSD-Code-Reviewer_
_Depth: standard_
