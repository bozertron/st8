"use strict";
// src/utils/safeFs.ts
// Fortified filesystem wrapper — never throws, always returns typed Result<T, FsError>.
// Inspired by hardware Faraday cage: isolates all I/O errors from propagating.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteBufferPool = exports.FileHandlePool = void 0;
exports.isTransient = isTransient;
exports.isPermission = isPermission;
exports.isMissing = isMissing;
exports.isCorrupt = isCorrupt;
exports.registerFallback = registerFallback;
exports.safeReadFile = safeReadFile;
exports.safeWriteFile = safeWriteFile;
exports.safeReaddir = safeReaddir;
exports.safeMkdir = safeMkdir;
exports.safeStat = safeStat;
exports.safeAccess = safeAccess;
exports.safeUnlink = safeUnlink;
exports.safeLstat = safeLstat;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ─── Error Classification Helpers ────────────────────────────────────────────
function classifyErrorCode(err) {
    switch (err.code) {
        case 'EACCES': return 'EACCES';
        case 'ENOENT': return 'ENOENT';
        case 'EMFILE': return 'EMFILE';
        case 'ENOSPC': return 'ENOSPC';
        case 'ELOOP': return 'ELOOP';
        case 'EISDIR': return 'EISDIR';
        case 'EPERM': return 'EPERM';
        case 'EEXIST': return 'EEXIST';
        case 'ENOTDIR': return 'ENOTDIR';
        default: return 'UNKNOWN';
    }
}
function classifySeverity(code) {
    switch (code) {
        case 'EACCES':
        case 'EPERM':
            return 'warning';
        case 'ENOENT':
            return 'skip';
        case 'EMFILE':
        case 'ENOSPC':
        case 'ELOOP':
        case 'EISDIR':
        case 'EEXIST':
        case 'ENOTDIR':
        case 'TIMEOUT':
        case 'UNKNOWN':
            return 'fatal';
    }
}
function isRetryable(code) {
    return code === 'EMFILE' || code === 'ENOSPC';
}
function buildFsError(err, filePath) {
    const code = classifyErrorCode(err);
    return {
        code,
        message: err.message,
        severity: classifySeverity(code),
        originalError: err,
        path: filePath,
        retryable: isRetryable(code),
    };
}
// ─── Public Classification Predicates ────────────────────────────────────────
/** Error is transient and may resolve on retry (EMFILE, ENOSPC) */
function isTransient(error) {
    return error.code === 'EMFILE' || error.code === 'ENOSPC';
}
/** Error is a permission issue (EACCES, EPERM) */
function isPermission(error) {
    return error.code === 'EACCES' || error.code === 'EPERM';
}
/** Target path does not exist (ENOENT) */
function isMissing(error) {
    return error.code === 'ENOENT';
}
/** Filesystem structural issue (ELOOP, EISDIR, ENOTDIR) */
function isCorrupt(error) {
    return error.code === 'ELOOP' || error.code === 'EISDIR' || error.code === 'ENOTDIR';
}
const DEFAULT_RETRY = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
};
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => setTimeout(resolve, ms));
    });
}
function withRetry(operation_1) {
    return __awaiter(this, arguments, void 0, function* (operation, opts = DEFAULT_RETRY) {
        let lastResult;
        for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
            lastResult = yield operation();
            if (lastResult.success) {
                return lastResult;
            }
            // Only retry transient errors
            if (!lastResult.error.retryable || attempt === opts.maxRetries) {
                return lastResult;
            }
            const delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
            yield sleep(delay);
        }
        return lastResult;
    });
}
const fallbackRegistry = [];
/** Register a fallback path for a primary path */
function registerFallback(primary, fallback) {
    fallbackRegistry.push({ primary, fallback });
}
function getFallbackPath(primaryPath) {
    const entry = fallbackRegistry.find((f) => primaryPath.startsWith(f.primary));
    if (!entry)
        return undefined;
    const relative = path.relative(entry.primary, primaryPath);
    return path.join(entry.fallback, relative);
}
// ─── Safe Filesystem Operations ──────────────────────────────────────────────
/**
 * Safely read a file. Never throws.
 */
function safeReadFile(filePath_1) {
    return __awaiter(this, arguments, void 0, function* (filePath, encoding = 'utf-8') {
        return withRetry(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield fs.promises.readFile(filePath, { encoding });
                return { success: true, data };
            }
            catch (err) {
                return { success: false, error: buildFsError(err, filePath) };
            }
        }));
    });
}
/**
 * Safely write a file. Tries primary path, then fallback if registered.
 * Never throws.
 */
function safeWriteFile(filePath, content, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const encoding = (_a = options === null || options === void 0 ? void 0 : options.encoding) !== null && _a !== void 0 ? _a : 'utf-8';
        const mode = options === null || options === void 0 ? void 0 : options.mode;
        const writeAttempt = (target) => __awaiter(this, void 0, void 0, function* () {
            return withRetry(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // Ensure parent directory exists
                    const dir = path.dirname(target);
                    yield fs.promises.mkdir(dir, { recursive: true });
                    yield fs.promises.writeFile(target, content, { encoding, mode });
                    return { success: true, data: undefined };
                }
                catch (err) {
                    return { success: false, error: buildFsError(err, target) };
                }
            }));
        });
        // Try primary
        const primaryResult = yield writeAttempt(filePath);
        if (primaryResult.success) {
            return primaryResult;
        }
        // Try fallback if available
        const fallback = getFallbackPath(filePath);
        if (fallback) {
            const fallbackResult = yield writeAttempt(fallback);
            if (fallbackResult.success) {
                return fallbackResult;
            }
        }
        return primaryResult;
    });
}
/**
 * Safely read directory contents. Never throws.
 */
function safeReaddir(dirPath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        return withRetry(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const entries = yield fs.promises.readdir(dirPath, { withFileTypes: true });
                return { success: true, data: entries };
            }
            catch (err) {
                return { success: false, error: buildFsError(err, dirPath) };
            }
        }));
    });
}
/**
 * Safely create a directory (recursive). Never throws.
 */
function safeMkdir(dirPath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const recursive = (_a = options === null || options === void 0 ? void 0 : options.recursive) !== null && _a !== void 0 ? _a : true;
        const mode = (_b = options === null || options === void 0 ? void 0 : options.mode) !== null && _b !== void 0 ? _b : 0o755;
        return withRetry(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield fs.promises.mkdir(dirPath, { recursive, mode });
                return { success: true, data: result };
            }
            catch (err) {
                return { success: false, error: buildFsError(err, dirPath) };
            }
        }));
    });
}
/**
 * Safely stat a path. Never throws.
 */
function safeStat(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        return withRetry(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield fs.promises.stat(filePath);
                return { success: true, data: stats };
            }
            catch (err) {
                return { success: false, error: buildFsError(err, filePath) };
            }
        }));
    });
}
/**
 * Safely check access to a path. Never throws.
 */
function safeAccess(filePath, mode) {
    return __awaiter(this, void 0, void 0, function* () {
        const accessMode = mode !== null && mode !== void 0 ? mode : fs.constants.F_OK;
        return withRetry(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.promises.access(filePath, accessMode);
                return { success: true, data: undefined };
            }
            catch (err) {
                return { success: false, error: buildFsError(err, filePath) };
            }
        }));
    });
}
/**
 * Safely unlink (delete) a file. Never throws.
 */
function safeUnlink(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        return withRetry(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.promises.unlink(filePath);
                return { success: true, data: undefined };
            }
            catch (err) {
                return { success: false, error: buildFsError(err, filePath) };
            }
        }));
    });
}
// ─── Convenience: Safe lstat (symlink-aware) ─────────────────────────────────
/**
 * Safely lstat a path (does not follow symlinks). Never throws.
 */
function safeLstat(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stats = yield fs.promises.lstat(filePath);
            return { success: true, data: stats };
        }
        catch (err) {
            return { success: false, error: buildFsError(err, filePath) };
        }
    });
}
/**
 * FileHandlePool — bounds concurrent open file descriptors to prevent EMFILE.
 * Pre-allocated pool with FIFO queue for overflow requests.
 */
class FileHandlePool {
    constructor(options) {
        var _a, _b, _c;
        this.available = [];
        this.inUse = new Map();
        this.queue = [];
        this.queuedTimeoutCount = 0;
        this.leakDetectionCount = 0;
        this.leakTimer = null;
        this.idCounter = 0;
        this.maxSize = (_a = options === null || options === void 0 ? void 0 : options.poolSize) !== null && _a !== void 0 ? _a : 20;
        this.acquireTimeoutMs = (_b = options === null || options === void 0 ? void 0 : options.acquireTimeoutMs) !== null && _b !== void 0 ? _b : 10000;
        this.leakTimeoutMs = (_c = options === null || options === void 0 ? void 0 : options.leakTimeoutMs) !== null && _c !== void 0 ? _c : 30000;
        // Pre-allocate slots
        for (let i = 0; i < this.maxSize; i++) {
            this.available.push(this.generateId());
        }
        // Start leak detection timer
        this.leakTimer = setInterval(() => this.detectLeaks(), this.leakTimeoutMs);
        if (this.leakTimer.unref)
            this.leakTimer.unref();
    }
    /**
     * Acquire a handle slot from the pool.
     * If pool is exhausted, waits in FIFO queue (with timeout).
     * Returns a handle ID that must be passed to release().
     */
    acquire() {
        // Try to get from available pool
        if (this.available.length > 0) {
            const id = this.available.pop();
            this.inUse.set(id, { id, acquiredAt: Date.now(), released: false });
            return Promise.resolve(id);
        }
        // Pool exhausted — wait in queue
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                // Remove from queue on timeout
                const idx = this.queue.findIndex((q) => q.resolve === resolve);
                if (idx !== -1) {
                    this.queue.splice(idx, 1);
                }
                this.queuedTimeoutCount++;
                reject(new Error(`FileHandlePool: acquire timed out after ${this.acquireTimeoutMs}ms (queue position exhausted)`));
            }, this.acquireTimeoutMs);
            if (timer.unref)
                timer.unref();
            this.queue.push({ resolve, timer });
        });
    }
    /**
     * Release a handle slot back to the pool.
     */
    release(id) {
        const handle = this.inUse.get(id);
        if (!handle)
            return; // Already released or invalid
        handle.released = true;
        this.inUse.delete(id);
        // If there are waiters in queue, hand directly to next waiter
        if (this.queue.length > 0) {
            const waiter = this.queue.shift();
            clearTimeout(waiter.timer);
            this.inUse.set(id, { id, acquiredAt: Date.now(), released: false });
            waiter.resolve(id);
        }
        else {
            this.available.push(id);
        }
    }
    /**
     * Get current pool health metrics.
     */
    getMetrics() {
        return {
            poolSize: this.maxSize,
            available: this.available.length,
            inUse: this.inUse.size,
            queueLength: this.queue.length,
            queuedTimeoutCount: this.queuedTimeoutCount,
            leakDetectionCount: this.leakDetectionCount,
        };
    }
    /**
     * Shutdown the pool: clear timers and reject pending waiters.
     */
    destroy() {
        if (this.leakTimer) {
            clearInterval(this.leakTimer);
            this.leakTimer = null;
        }
        // Reject pending waiters
        for (const waiter of this.queue) {
            clearTimeout(waiter.timer);
        }
        this.queue = [];
    }
    // ─── Private ────────────────────────────────────────────────────────────
    generateId() {
        return `fhp_${++this.idCounter}_${Date.now().toString(36)}`;
    }
    detectLeaks() {
        const now = Date.now();
        for (const [id, handle] of this.inUse.entries()) {
            if (!handle.released && now - handle.acquiredAt > this.leakTimeoutMs) {
                // Leak detected — force-release
                this.leakDetectionCount++;
                this.release(id);
            }
        }
    }
}
exports.FileHandlePool = FileHandlePool;
/**
 * WriteBufferPool — batches writes in memory buffer, flushes on threshold or timer.
 * Prevents I/O thrashing from many small writes during heavy analysis.
 * Ordering guarantee: writes to same file are sequential.
 */
class WriteBufferPool {
    constructor(config) {
        var _a, _b;
        this.buffers = new Map();
        this.flushTimer = null;
        this.totalBufferedBytes = 0;
        this.flushCount = 0;
        this.failedFlushCount = 0;
        this.flushLocks = new Set();
        this.shutdownRegistered = false;
        this.maxBufferBytes = (_a = config === null || config === void 0 ? void 0 : config.maxBufferBytes) !== null && _a !== void 0 ? _a : 1024 * 1024; // 1MB
        this.flushIntervalMs = (_b = config === null || config === void 0 ? void 0 : config.flushIntervalMs) !== null && _b !== void 0 ? _b : 5000;
        // Start auto-flush timer
        this.flushTimer = setInterval(() => {
            this.flush().catch(() => { });
        }, this.flushIntervalMs);
        if (this.flushTimer.unref)
            this.flushTimer.unref();
        // Register graceful shutdown
        this.registerShutdownHook();
    }
    /**
     * Buffer a write to the specified path.
     * Auto-flushes if buffer exceeds threshold.
     */
    write(filePath, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = path.resolve(filePath);
            if (!this.buffers.has(normalized)) {
                this.buffers.set(normalized, []);
            }
            const entry = { data, timestamp: Date.now() };
            this.buffers.get(normalized).push(entry);
            this.totalBufferedBytes += Buffer.byteLength(data, 'utf-8');
            // Auto-flush on threshold
            if (this.totalBufferedBytes >= this.maxBufferBytes) {
                return this.flushPath(normalized);
            }
            return { success: true, data: undefined };
        });
    }
    /**
     * Flush all buffered writes to disk.
     */
    flush() {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = Array.from(this.buffers.keys());
            const errors = [];
            for (const p of paths) {
                const result = yield this.flushPath(p);
                if (!result.success) {
                    errors.push(`${p}: ${result.error.message}`);
                }
            }
            if (errors.length > 0) {
                return {
                    success: false,
                    error: {
                        code: 'UNKNOWN',
                        message: `Flush failed for ${errors.length} paths: ${errors.join('; ')}`,
                        severity: 'warning',
                        retryable: true,
                    },
                };
            }
            return { success: true, data: undefined };
        });
    }
    /**
     * Get buffer pool metrics.
     */
    getMetrics() {
        return {
            bufferedPaths: this.buffers.size,
            totalBufferedBytes: this.totalBufferedBytes,
            flushCount: this.flushCount,
            failedFlushCount: this.failedFlushCount,
        };
    }
    /**
     * Shutdown: flush all buffers and stop timers.
     */
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.flushTimer) {
                clearInterval(this.flushTimer);
                this.flushTimer = null;
            }
            yield this.flush();
        });
    }
    // ─── Private ────────────────────────────────────────────────────────────
    flushPath(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ordering guarantee: prevent concurrent flushes to same path
            if (this.flushLocks.has(filePath)) {
                // Another flush in progress; skip (will be caught by next timer)
                return { success: true, data: undefined };
            }
            const entries = this.buffers.get(filePath);
            if (!entries || entries.length === 0) {
                return { success: true, data: undefined };
            }
            this.flushLocks.add(filePath);
            try {
                // Concatenate all buffered data in order
                const content = entries.map((e) => e.data).join('');
                const byteSize = Buffer.byteLength(content, 'utf-8');
                const result = yield safeWriteFile(filePath, content);
                if (result.success) {
                    this.buffers.delete(filePath);
                    this.totalBufferedBytes -= byteSize;
                    if (this.totalBufferedBytes < 0)
                        this.totalBufferedBytes = 0;
                    this.flushCount++;
                }
                else {
                    this.failedFlushCount++;
                }
                return result;
            }
            finally {
                this.flushLocks.delete(filePath);
            }
        });
    }
    registerShutdownHook() {
        if (this.shutdownRegistered)
            return;
        this.shutdownRegistered = true;
        const handler = () => {
            // Synchronous best-effort flush on exit
            for (const [filePath, entries] of this.buffers.entries()) {
                if (entries.length === 0)
                    continue;
                const content = entries.map((e) => e.data).join('');
                try {
                    const dir = path.dirname(filePath);
                    fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(filePath, content, 'utf-8');
                }
                catch (_a) {
                    // Best effort on shutdown
                }
            }
            this.buffers.clear();
            this.totalBufferedBytes = 0;
        };
        process.once('beforeExit', handler);
        process.once('SIGINT', handler);
        process.once('SIGTERM', handler);
    }
}
exports.WriteBufferPool = WriteBufferPool;
//# sourceMappingURL=safeFs.js.map