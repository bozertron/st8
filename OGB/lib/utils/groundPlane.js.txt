"use strict";
// src/utils/groundPlane.ts
// Pre-verifies critical directory structure on startup.
// Hardware analogy: a clean, isolated ground plane that ensures
// a stable base state for all filesystem operations.
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
exports.initGroundPlane = initGroundPlane;
exports.getVerifiedPath = getVerifiedPath;
exports.validateGroundPlane = validateGroundPlane;
exports.getGroundPlanePaths = getGroundPlanePaths;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const safeFs_js_1 = require("./safeFs.js");
// ─── Constants ───────────────────────────────────────────────────────────────
const APP_ID = 'com.scaffolder.app';
function getDefaultPaths() {
    const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    const cacheHome = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
    const appData = path.join(dataHome, APP_ID);
    const appCache = path.join(cacheHome, APP_ID);
    const tmpBase = path.join(os.tmpdir(), `maestro-${process.pid}`);
    return {
        data: {
            primary: appData,
            fallback: path.join(tmpBase, 'data'),
        },
        cache: {
            primary: appCache,
            fallback: path.join(tmpBase, 'cache'),
        },
        plugins: {
            primary: path.join(appData, 'plugins'),
            fallback: path.join(tmpBase, 'plugins'),
        },
        temp: {
            primary: path.join(tmpBase, 'work'),
            fallback: path.join(os.tmpdir(), `maestro-fallback-${process.pid}`),
        },
    };
}
// ─── Ground Plane State ──────────────────────────────────────────────────────
let directories = new Map();
let initialized = false;
// ─── Core Functions ──────────────────────────────────────────────────────────
/**
 * Initialize the ground plane. Verifies or creates all critical directories.
 * Call once at startup. Safe to call multiple times (idempotent).
 */
function initGroundPlane() {
    return __awaiter(this, void 0, void 0, function* () {
        const status = {
            healthy: true,
            verified: [],
            created: [],
            inaccessible: [],
            warnings: [],
            fallbackActive: false,
        };
        const paths = getDefaultPaths();
        for (const [purpose, config] of Object.entries(paths)) {
            const entry = {
                purpose,
                primary: config.primary,
                fallback: config.fallback,
                verified: false,
                useFallback: false,
            };
            // Try to verify/create primary path
            const primaryOk = yield verifyOrCreateDir(config.primary);
            if (primaryOk) {
                // Confirm write access
                const writable = yield testWriteAccess(config.primary);
                if (writable) {
                    entry.verified = true;
                    status.verified.push(config.primary);
                }
                else {
                    status.warnings.push(`${purpose}: ${config.primary} exists but not writable`);
                    // Fall through to fallback
                    const fallbackOk = yield verifyOrCreateDir(config.fallback);
                    if (fallbackOk) {
                        entry.verified = true;
                        entry.useFallback = true;
                        status.fallbackActive = true;
                        status.created.push(config.fallback);
                    }
                    else {
                        entry.verified = false;
                        status.inaccessible.push(`${purpose}: both primary and fallback failed`);
                        status.healthy = false;
                    }
                }
            }
            else {
                // Primary creation failed — try fallback
                status.warnings.push(`${purpose}: cannot create ${config.primary}`);
                const fallbackOk = yield verifyOrCreateDir(config.fallback);
                if (fallbackOk) {
                    entry.verified = true;
                    entry.useFallback = true;
                    status.fallbackActive = true;
                    status.created.push(config.fallback);
                }
                else {
                    entry.verified = false;
                    status.inaccessible.push(`${purpose}: both primary and fallback failed`);
                    status.healthy = false;
                }
            }
            directories.set(purpose, entry);
        }
        initialized = true;
        return status;
    });
}
/**
 * Get a verified, writable path for the given purpose.
 * If ground plane hasn't been initialized, initializes lazily.
 */
function getVerifiedPath(purpose) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!initialized) {
            yield initGroundPlane();
        }
        const entry = directories.get(purpose);
        if (!entry || !entry.verified) {
            // Last resort: use OS temp directory
            const emergencyPath = path.join(os.tmpdir(), `maestro-emergency-${purpose}`);
            try {
                yield fs.promises.mkdir(emergencyPath, { recursive: true });
            }
            catch (_a) {
                // If even this fails, return the path anyway — caller will handle the error
            }
            return emergencyPath;
        }
        return entry.useFallback ? entry.fallback : entry.primary;
    });
}
/**
 * Run a health check on the ground plane.
 * Returns current status without modifying state.
 */
function validateGroundPlane() {
    return __awaiter(this, void 0, void 0, function* () {
        const status = {
            healthy: true,
            verified: [],
            created: [],
            inaccessible: [],
            warnings: [],
            fallbackActive: false,
        };
        if (!initialized) {
            status.warnings.push('Ground plane not initialized');
            status.healthy = false;
            return status;
        }
        for (const [purpose, entry] of directories.entries()) {
            const activePath = entry.useFallback ? entry.fallback : entry.primary;
            const accessible = yield (0, safeFs_js_1.safeAccess)(activePath, fs.constants.W_OK);
            if (accessible.success) {
                status.verified.push(activePath);
            }
            else {
                status.inaccessible.push(`${purpose}: ${activePath} is no longer accessible`);
                status.healthy = false;
            }
            if (entry.useFallback) {
                status.fallbackActive = true;
            }
        }
        return status;
    });
}
/**
 * Get all verified paths as a record (sync access after initialization).
 */
function getGroundPlanePaths() {
    if (!initialized)
        return null;
    const result = {
        cache: '',
        data: '',
        plugins: '',
        temp: '',
    };
    for (const [purpose, entry] of directories.entries()) {
        result[purpose] = entry.useFallback ? entry.fallback : entry.primary;
    }
    return result;
}
// ─── Internal Helpers ────────────────────────────────────────────────────────
function verifyOrCreateDir(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stat = yield fs.promises.stat(dirPath);
            return stat.isDirectory();
        }
        catch (_a) {
            // Does not exist — try to create
            try {
                yield fs.promises.mkdir(dirPath, { recursive: true, mode: 0o755 });
                return true;
            }
            catch (_b) {
                return false;
            }
        }
    });
}
function testWriteAccess(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const testFile = path.join(dirPath, `.groundplane-write-test-${Date.now()}`);
        try {
            yield fs.promises.writeFile(testFile, 'ok', 'utf-8');
            yield fs.promises.unlink(testFile);
            return true;
        }
        catch (_a) {
            return false;
        }
    });
}
//# sourceMappingURL=groundPlane.js.map