"use strict";
// src/commands/backgroundIndexer.ts
// PM-1 Layer 1: Background Indexer — the heart of the "parse to oblivion" vision.
// Non-blocking project registration, exhaustive background indexing, incremental updates.
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundIndexer = void 0;
exports.getBackgroundIndexer = getBackgroundIndexer;
const events_1 = require("events");
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const chokidar_1 = require("chokidar");
const fast_glob_1 = __importDefault(require("fast-glob"));
const databasePersister_js_1 = require("../../core/database/graph-persister.js");
const dataIngestion_js_1 = require("./data-ingestion.js");
const parserPersistence_js_1 = require("./parser-persistence.js");
const sonicClient_js_1 = require("./sonicClient.js");
const insightStore_js_1 = require("../analysis/insight-store.js");
const multiPassAnalyzer_js_1 = require("./multiPassAnalyzer.js");
const precisionCapture_js_1 = require("./precisionCapture.js");
const types_js_1 = require("../../shared/types/integr8-types.js");
// ============ BACKGROUND INDEXER ============
class BackgroundIndexer extends events_1.EventEmitter {
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
    // ─── Table Setup ────────────────────────────────────────────────────────────
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
    // ─── Public API ─────────────────────────────────────────────────────────────
    /**
     * Register a project for indexing. Returns immediately (non-blocking).
     * The project is queued for background indexing.
     */
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
    /**
     * Remove a project from the index. Stops watcher and cleans up data.
     */
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
    /**
     * Get the current status of a project.
     */
    getProjectStatus(projectId) {
        const row = this.db.prepare('SELECT status FROM IndexedProjects WHERE project_id = ?').get(projectId);
        return row ? row.status : null;
    }
    /**
     * List all registered projects with their status.
     */
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
    /**
     * Get a single project record by ID or name.
     */
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
    /**
     * Gracefully shut down the indexer. Stops all watchers, drains queue.
     */
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
    // ─── Job Execution Pipeline ─────────────────────────────────────────────────
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
    /**
     * Full index pipeline: scan → parse → analyze → persist → index → watch
     */
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
    /**
     * Incremental index: re-process only changed files.
     */
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
    // ─── File Discovery ─────────────────────────────────────────────────────────
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
    // ─── Insight Extraction ─────────────────────────────────────────────────────
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
    // ─── Graph Persistence ──────────────────────────────────────────────────────
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
    // ─── Sonic Index Population ─────────────────────────────────────────────────
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
    // ─── File Watcher ───────────────────────────────────────────────────────────
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
    stopWatcher(projectId) {
        const watcher = this.watchers.get(projectId);
        if (watcher) {
            watcher.close();
            this.watchers.delete(projectId);
        }
    }
    // ─── Multi-Pass Analysis Hook ─────────────────────────────────────────────
    /**
     * PM-1 Layer 2: After initial indexing completes, trigger multi-pass analysis.
     * Runs asynchronously so it doesn't block the indexer completion.
     */
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
    // ─── Helper Methods ─────────────────────────────────────────────────────────
    generateProjectId(projectPath) {
        const hash = crypto.createHash('sha256')
            .update(projectPath)
            .digest('hex')
            .substring(0, 12);
        return `proj_${hash}`;
    }
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
    getProjectCaptureMode(projectId) {
        const row = this.db.prepare('SELECT capture_mode FROM IndexedProjects WHERE project_id = ?').get(projectId);
        return (row === null || row === void 0 ? void 0 : row.capture_mode) || 'balanced';
    }
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
    updateFileCount(projectId, fileCount) {
        this.db.prepare('UPDATE IndexedProjects SET file_count = ? WHERE project_id = ?')
            .run(fileCount, projectId);
    }
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
}
exports.BackgroundIndexer = BackgroundIndexer;
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
// ============ UTILITY ============
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=backgroundIndexer.js.map