"use strict";
// src/commands/integr8/dataIngestion.ts
// Stage 1: Data Ingestion Engine — calls existing parsers, parses text output into graph nodes.
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
exports.getParserHealthReport = getParserHealthReport;
exports.resetParserHealth = resetParserHealth;
exports.ingestSingleProject = ingestSingleProject;
exports.ingestProjectData = ingestProjectData;
const types_js_1 = require("../../shared/types/integr8-types.js");
const overview_js_1 = require("./overview.js");
const storeParser_js_1 = require("./store-parser.js");
const routeParser_js_1 = require("./route-parser.js");
const commandParser_js_1 = require("./command-parser.js");
const typeParser_js_1 = require("./type-parser.js");
const uiParser_js_1 = require("./ui-parser.js");
const parserPersistence_js_1 = require("./parser-persistence.js");
const astParser_js_1 = require("../../shared/utils/ast-parser.js");
const path = __importStar(require("path"));
const safeFs_js_1 = require("../../shared/utils/safe-fs.js");
const ioChan_js_1 = require("../../shared/utils/io-chan.js");
// ============ I-01 TIER 3: SOTA HEALTH MONITORING + CIRCUIT BREAKER ============
//
// Both configs were module-private constants pre-ticket-16. Now exposed
// via configureDataIngestion() + getDataIngestionConfig() so:
//   (a) tests can shrink failureThreshold / maxRetries to make
//       circuit-breaker behaviour observable in a single test pass
//       without sleeping 30 s.
//   (b) runtime callers (operators on slow / large codebases where
//       parsers genuinely take longer than 30 s to settle) can raise
//       resetTimeoutMs without forking the file.
//
// `let` not `const` so configureDataIngestion() can mutate. Default
// values preserve historical behaviour for any caller that doesn't
// invoke the configure entry point.
//
// SAFE-TUNE BOUNDS — configureDataIngestion validates inputs:
//   failureThreshold ≥ 1
//   resetTimeoutMs   ≥ 0
//   maxRetries       ≥ 0   (0 = no retry, attempt once and surrender)
//   baseDelayMs      ≥ 0
let CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 1,
};
let ADAPTIVE_RETRY_CONFIG = {
    baseDelayMs: 200,
    maxRetries: 3,
    errorDelayMap: {
        'EACCES': 3, // Permission errors: wait longer
        'EPERM': 3,
        'EMFILE': 5, // Too many open files: wait much longer
        'ENOENT': 0, // File not found: skip immediately
        'ENOTDIR': 0,
        'EISDIR': 0,
    },
    skipErrors: ['ENOENT', 'ENOTDIR', 'EISDIR'], // No point retrying these
};
const DATA_INGESTION_DEFAULTS = Object.freeze({
    circuitBreaker: Object.freeze({ failureThreshold: 3, resetTimeoutMs: 30000, halfOpenMaxAttempts: 1 }),
    adaptiveRetry: Object.freeze({ baseDelayMs: 200, maxRetries: 3 }),
});

/**
 * Replace circuit-breaker + adaptive-retry settings at runtime.
 *
 * Pass only the keys you want to change; omitted keys keep their
 * current values. Returns the resulting effective config so callers
 * can log what they ended up with.
 *
 * @param {{circuitBreaker?: object, adaptiveRetry?: object}} opts
 * @returns {{circuitBreaker: object, adaptiveRetry: object}}
 */
function configureDataIngestion(opts = {}) {
    const cb = opts.circuitBreaker || {};
    const ar = opts.adaptiveRetry || {};
    if (cb.failureThreshold !== undefined) {
        if (!Number.isFinite(cb.failureThreshold) || cb.failureThreshold < 1) {
            throw new RangeError(`configureDataIngestion: failureThreshold must be ≥ 1, got ${cb.failureThreshold}`);
        }
        CIRCUIT_BREAKER_CONFIG.failureThreshold = cb.failureThreshold;
    }
    if (cb.resetTimeoutMs !== undefined) {
        if (!Number.isFinite(cb.resetTimeoutMs) || cb.resetTimeoutMs < 0) {
            throw new RangeError(`configureDataIngestion: resetTimeoutMs must be ≥ 0, got ${cb.resetTimeoutMs}`);
        }
        CIRCUIT_BREAKER_CONFIG.resetTimeoutMs = cb.resetTimeoutMs;
    }
    if (cb.halfOpenMaxAttempts !== undefined) {
        if (!Number.isFinite(cb.halfOpenMaxAttempts) || cb.halfOpenMaxAttempts < 1) {
            throw new RangeError(`configureDataIngestion: halfOpenMaxAttempts must be ≥ 1, got ${cb.halfOpenMaxAttempts}`);
        }
        CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts = cb.halfOpenMaxAttempts;
    }
    if (ar.baseDelayMs !== undefined) {
        if (!Number.isFinite(ar.baseDelayMs) || ar.baseDelayMs < 0) {
            throw new RangeError(`configureDataIngestion: baseDelayMs must be ≥ 0, got ${ar.baseDelayMs}`);
        }
        ADAPTIVE_RETRY_CONFIG.baseDelayMs = ar.baseDelayMs;
    }
    if (ar.maxRetries !== undefined) {
        if (!Number.isFinite(ar.maxRetries) || ar.maxRetries < 0) {
            throw new RangeError(`configureDataIngestion: maxRetries must be ≥ 0, got ${ar.maxRetries}`);
        }
        ADAPTIVE_RETRY_CONFIG.maxRetries = ar.maxRetries;
    }
    if (ar.errorDelayMap !== undefined) {
        if (typeof ar.errorDelayMap !== 'object' || ar.errorDelayMap === null) {
            throw new TypeError('configureDataIngestion: errorDelayMap must be an object');
        }
        ADAPTIVE_RETRY_CONFIG.errorDelayMap = { ...ar.errorDelayMap };
    }
    if (ar.skipErrors !== undefined) {
        if (!Array.isArray(ar.skipErrors)) {
            throw new TypeError('configureDataIngestion: skipErrors must be an array');
        }
        ADAPTIVE_RETRY_CONFIG.skipErrors = ar.skipErrors.slice();
    }
    return getDataIngestionConfig();
}

/**
 * Snapshot the current effective config. Returns a deep copy so
 * callers can mutate the result without poisoning module state.
 */
function getDataIngestionConfig() {
    return {
        circuitBreaker: { ...CIRCUIT_BREAKER_CONFIG },
        adaptiveRetry: {
            baseDelayMs: ADAPTIVE_RETRY_CONFIG.baseDelayMs,
            maxRetries: ADAPTIVE_RETRY_CONFIG.maxRetries,
            errorDelayMap: { ...ADAPTIVE_RETRY_CONFIG.errorDelayMap },
            skipErrors: ADAPTIVE_RETRY_CONFIG.skipErrors.slice(),
        },
    };
}

/**
 * Reset to factory defaults — used by tests and operators who want to
 * undo a tuning experiment.
 */
function resetDataIngestionConfig() {
    CIRCUIT_BREAKER_CONFIG = {
        failureThreshold: DATA_INGESTION_DEFAULTS.circuitBreaker.failureThreshold,
        resetTimeoutMs: DATA_INGESTION_DEFAULTS.circuitBreaker.resetTimeoutMs,
        halfOpenMaxAttempts: DATA_INGESTION_DEFAULTS.circuitBreaker.halfOpenMaxAttempts,
    };
    ADAPTIVE_RETRY_CONFIG = {
        baseDelayMs: DATA_INGESTION_DEFAULTS.adaptiveRetry.baseDelayMs,
        maxRetries: DATA_INGESTION_DEFAULTS.adaptiveRetry.maxRetries,
        errorDelayMap: {
            'EACCES': 3, 'EPERM': 3, 'EMFILE': 5,
            'ENOENT': 0, 'ENOTDIR': 0, 'EISDIR': 0,
        },
        skipErrors: ['ENOENT', 'ENOTDIR', 'EISDIR'],
    };
}
exports.configureDataIngestion = configureDataIngestion;
exports.getDataIngestionConfig = getDataIngestionConfig;
exports.resetDataIngestionConfig = resetDataIngestionConfig;
exports.DATA_INGESTION_DEFAULTS = DATA_INGESTION_DEFAULTS;
/** Health monitor: tracks per-parser success/failure rates */
const healthMonitor = new Map();
function getOrCreateHealthEntry(parserName) {
    if (!healthMonitor.has(parserName)) {
        healthMonitor.set(parserName, {
            parserName,
            totalAttempts: 0,
            successCount: 0,
            failureCount: 0,
            consecutiveFailures: 0,
            successRate: 1.0,
            circuitState: 'closed',
            errorTypeCounts: {},
        });
    }
    return healthMonitor.get(parserName);
}
/** Check if circuit breaker should prevent execution */
function isCircuitOpen(entry) {
    if (entry.circuitState === 'closed')
        return false;
    if (entry.circuitState === 'open') {
        // Check if enough time has passed to try half-open
        if (entry.circuitOpenedAt) {
            const elapsed = Date.now() - new Date(entry.circuitOpenedAt).getTime();
            if (elapsed >= CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
                entry.circuitState = 'half-open';
                return false; // allow one attempt
            }
        }
        return true; // still open
    }
    return false; // half-open allows attempt
}
/** Record success in health monitor */
function recordSuccess(entry) {
    entry.totalAttempts++;
    entry.successCount++;
    entry.consecutiveFailures = 0;
    entry.lastSuccess = new Date().toISOString();
    entry.successRate = entry.successCount / entry.totalAttempts;
    // Reset circuit if in half-open
    if (entry.circuitState === 'half-open') {
        entry.circuitState = 'closed';
        console.log(`[dataIngestion] Circuit CLOSED for ${entry.parserName} (recovered)`);
    }
}
/** Record failure in health monitor */
function recordFailure(entry, error, errorCode) {
    entry.totalAttempts++;
    entry.failureCount++;
    entry.consecutiveFailures++;
    entry.lastFailure = new Date().toISOString();
    entry.lastError = error;
    entry.successRate = entry.successCount / entry.totalAttempts;
    if (errorCode) {
        entry.errorTypeCounts[errorCode] = (entry.errorTypeCounts[errorCode] || 0) + 1;
    }
    // Trip circuit breaker if threshold reached
    if (entry.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.failureThreshold && entry.circuitState !== 'open') {
        entry.circuitState = 'open';
        entry.circuitOpenedAt = new Date().toISOString();
        console.warn(`[dataIngestion] Circuit OPEN for ${entry.parserName} after ${entry.consecutiveFailures} consecutive failures`);
    }
    // In half-open, one failure re-opens
    if (entry.circuitState === 'half-open') {
        entry.circuitState = 'open';
        entry.circuitOpenedAt = new Date().toISOString();
    }
}
/** Compute adaptive delay based on error type */
function computeAdaptiveDelay(attempt, errorCode) {
    const baseDelay = ADAPTIVE_RETRY_CONFIG.baseDelayMs;
    const multiplier = errorCode ? (ADAPTIVE_RETRY_CONFIG.errorDelayMap[errorCode] || 1) : 1;
    return baseDelay * Math.pow(2, attempt - 1) * multiplier;
}
/** Check if error should skip retries entirely */
function shouldSkipRetry(errorCode) {
    if (!errorCode)
        return false;
    return ADAPTIVE_RETRY_CONFIG.skipErrors.includes(errorCode);
}
/**
 * SOTA Retry with health monitoring, circuit breaker, and adaptive backoff.
 * I-01 Tier 3: Full resilience pipeline.
 */
function retryParser(parserName, fn, fallback) {
    return __awaiter(this, void 0, void 0, function* () {
        const entry = getOrCreateHealthEntry(parserName);
        // Circuit breaker check
        if (isCircuitOpen(entry)) {
            console.warn(`[dataIngestion]   ${parserName}: circuit OPEN — skipping (will retry after ${CIRCUIT_BREAKER_CONFIG.resetTimeoutMs}ms)`);
            return { result: fallback, failed: true };
        }
        for (let attempt = 1; attempt <= ADAPTIVE_RETRY_CONFIG.maxRetries; attempt++) {
            try {
                const result = yield fn();
                recordSuccess(entry);
                return { result, failed: false };
            }
            catch (err) {
                const errorCode = err.code || '';
                const errorMessage = err.message || String(err);
                // Check if this error type should skip retries
                if (shouldSkipRetry(errorCode)) {
                    recordFailure(entry, errorMessage, errorCode);
                    console.warn(`[dataIngestion]   ${parserName}: non-retryable error (${errorCode}) — skipping`);
                    return { result: fallback, failed: true };
                }
                recordFailure(entry, errorMessage, errorCode);
                if (attempt < ADAPTIVE_RETRY_CONFIG.maxRetries) {
                    const delay = computeAdaptiveDelay(attempt, errorCode);
                    console.warn(`[dataIngestion]   ${parserName} attempt ${attempt} failed (${errorCode || 'unknown'}), retrying in ${delay}ms...`);
                    yield new Promise(resolve => setTimeout(resolve, delay));
                }
                else {
                    console.error(`[dataIngestion]   ${parserName} failed after ${ADAPTIVE_RETRY_CONFIG.maxRetries} attempts: ${errorMessage}`);
                }
            }
        }
        return { result: fallback, failed: true };
    });
}
/**
 * I-01 Tier 3: Fallback chain — primary parser → regex fallback → unparseable.
 */
function fallbackChainParser(parserName, primaryFn, regexFallbackFn, fallback) {
    return __awaiter(this, void 0, void 0, function* () {
        // Try primary parser with retry
        const { result: primaryResult, failed: primaryFailed } = yield retryParser(parserName, primaryFn, fallback);
        if (!primaryFailed) {
            return { result: primaryResult, source: 'primary', attempts: 1 };
        }
        // Try regex fallback (synchronous, no retry needed)
        try {
            const regexResult = regexFallbackFn();
            console.log(`[dataIngestion]   ${parserName}: using regex fallback`);
            return { result: regexResult, source: 'regex-fallback', attempts: 2 };
        }
        catch (regexErr) {
            console.warn(`[dataIngestion]   ${parserName}: regex fallback also failed — marking as unparseable`);
            return { result: fallback, source: 'unparseable', attempts: 3, error: regexErr.message };
        }
    });
}
/** Export health monitor for diagnostics */
function getParserHealthReport() {
    return Array.from(healthMonitor.values());
}
/** Reset health monitor (for testing) */
function resetParserHealth() {
    healthMonitor.clear();
}
// ============ I-10 TIER 3: ENHANCED IMPORT SCANNING ============
/**
 * I-10 Tier 3: Detect side-effect imports (import './polyfill')
 */
function detectSideEffectImports(text) {
    const results = [];
    // Side-effect imports: import 'module' or import './file'
    const sideEffectRegex = /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
    let match;
    while ((match = sideEffectRegex.exec(text)) !== null) {
        results.push({
            source: match[1],
            importType: 'side-effect',
            specifiers: [],
            isSideEffect: true,
            isDynamic: false,
            isConditional: false,
            isBarrelReexport: false,
        });
    }
    return results;
}
/**
 * I-10 Tier 3: Detect conditional/dynamic imports with variable paths
 */
function detectConditionalDynamicImports(text) {
    const results = [];
    // Dynamic import() with variable path: import(variable) or import(`template`)
    const dynamicVarRegex = /import\(\s*(?!['"])([\w.`${}+\s/]+)\s*\)/g;
    let match;
    while ((match = dynamicVarRegex.exec(text)) !== null) {
        results.push({
            source: match[1].trim(),
            importType: 'dynamic',
            specifiers: [],
            isSideEffect: false,
            isDynamic: true,
            isConditional: true,
            isBarrelReexport: false,
            variablePath: true,
        });
    }
    // require.resolve()
    const requireResolveRegex = /require\.resolve\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireResolveRegex.exec(text)) !== null) {
        results.push({
            source: match[1],
            importType: 'require',
            specifiers: [],
            isSideEffect: false,
            isDynamic: false,
            isConditional: true,
            isBarrelReexport: false,
        });
    }
    // Conditional require: if (...) require(...)
    const conditionalRequireRegex = /(?:if|&&|\|\|)\s*.*?require\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = conditionalRequireRegex.exec(text)) !== null) {
        results.push({
            source: match[1],
            importType: 'conditional',
            specifiers: [],
            isSideEffect: false,
            isDynamic: false,
            isConditional: true,
            isBarrelReexport: false,
        });
    }
    return results;
}
/**
 * I-10 Tier 3: Detect barrel file re-exports (index.ts that re-export from sub-modules)
 */
function detectBarrelReexports(text, filePath) {
    const results = [];
    // Detect if this file IS a barrel (index.ts with re-exports)
    const isBarrel = filePath ? /(?:^|[\\/])index\.[tj]sx?$/.test(filePath) : false;
    // export * from './module'
    const exportStarRegex = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = exportStarRegex.exec(text)) !== null) {
        results.push({
            source: match[1],
            importType: 'barrel',
            specifiers: ['*'],
            isSideEffect: false,
            isDynamic: false,
            isConditional: false,
            isBarrelReexport: true,
            resolvedSource: isBarrel ? match[1] : undefined,
        });
    }
    // export { name } from './module'
    const exportNamedFromRegex = /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = exportNamedFromRegex.exec(text)) !== null) {
        const specifiers = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        results.push({
            source: match[2],
            importType: 'barrel',
            specifiers,
            isSideEffect: false,
            isDynamic: false,
            isConditional: false,
            isBarrelReexport: true,
            resolvedSource: isBarrel ? match[2] : undefined,
        });
    }
    return results;
}
/**
 * I-10 Tier 3: Comprehensive enhanced import scanning combining all detection methods.
 */
function enhancedImportScan(text, filePath) {
    const allImports = [];
    const seen = new Set();
    const addUnique = (imports) => {
        for (const imp of imports) {
            const key = `${imp.source}:${imp.importType}`;
            if (!seen.has(key)) {
                seen.add(key);
                allImports.push(imp);
            }
        }
    };
    addUnique(detectSideEffectImports(text));
    addUnique(detectConditionalDynamicImports(text));
    addUnique(detectBarrelReexports(text, filePath));
    return allImports;
}
// ============ ID GENERATION ============
let nodeCounter = 0;
function makeNodeId(prefix, name) {
    nodeCounter++;
    const sanitized = name.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 80);
    return `${prefix}_${sanitized}_${nodeCounter}`;
}
function makeEdgeId(from, to, type) {
    return `edge_${from}__${type}__${to}`;
}
// ============ INITIAL PROPERTIES ============
function initialProperties() {
    return { reachability: 0, stability: 0, fragility: 0 };
}
// ============ TEXT → NODE PARSERS ============
/**
 * Parses overview report text to extract file paths from the numbered file index.
 * Expected format lines: "1: src/main.ts"
 */
function parseOverviewToNodes(text, projectPath) {
    const nodes = [];
    // Match numbered file entries like "1: src/main.ts" or "  42: src-tauri/src/main.rs"
    const fileLineRegex = /^\s*\d+:\s+(.+)$/gm;
    let match;
    while ((match = fileLineRegex.exec(text)) !== null) {
        const filePath = match[1].trim();
        // Skip comparison-prefixed files (those from [COMPARE] entries)
        if (filePath.startsWith('[COMPARE]'))
            continue;
        nodes.push({
            id: makeNodeId('file', filePath),
            type: types_js_1.NodeType.FILE,
            name: filePath,
            path: filePath,
            metadata: { projectPath },
        });
    }
    return nodes;
}
/**
 * Parses store report text to extract store definitions.
 * Looks for blocks like:
 *   --- Store ID: myStore ---
 *   File: src/stores/myStore.ts
 *   Exported As: useMyStore
 *   Type: Options Object
 *    State Properties (N): key1, key2
 *    Getters (N): getter1
 *    Actions (N): action1
 */
function parseStoreReportToNodes(text, projectPath) {
    const nodes = [];
    const storeBlockRegex = /--- Store ID:\s*(.+?)\s*---\n([\s\S]*?)(?=\n---|\n===|$)/g;
    let match;
    while ((match = storeBlockRegex.exec(text)) !== null) {
        const storeId = match[1].trim();
        const block = match[2];
        const filePath = extractField(block, 'File');
        const exportedAs = extractField(block, 'Exported As');
        const storeType = extractField(block, 'Type');
        const stateKeys = extractListField(block, 'State Properties');
        const getterKeys = extractListField(block, 'Getters');
        const actionKeys = extractListField(block, 'Actions');
        nodes.push({
            id: makeNodeId('store', storeId),
            type: types_js_1.NodeType.STORE,
            name: storeId,
            path: filePath || undefined,
            metadata: {
                projectPath,
                exportedAs,
                storeType,
                stateKeys,
                getterKeys,
                actionKeys,
            },
        });
    }
    return nodes;
}
/**
 * Parses route report text to extract route definitions.
 * Looks for lines like:
 *   - Path: /home
 *     Name: home
 *     Component: HomeView
 */
function parseRouteReportToNodes(text, projectPath) {
    const nodes = [];
    // Match route path entries (possibly indented for children)
    const routeRegex = /^\s*-\s*Path:\s*(.+)$/gm;
    let match;
    while ((match = routeRegex.exec(text)) !== null) {
        const routePath = match[1].trim();
        const startPos = match.index + match[0].length;
        // Look ahead for Name and Component on subsequent lines
        const lookahead = text.substring(startPos, startPos + 200);
        const name = extractInlineField(lookahead, 'Name');
        const component = extractInlineField(lookahead, 'Component');
        nodes.push({
            id: makeNodeId('route', routePath),
            type: types_js_1.NodeType.ROUTE,
            name: name || routePath,
            path: routePath,
            metadata: {
                projectPath,
                routePath,
                component,
            },
        });
    }
    return nodes;
}
/**
 * Parses command report text to extract Tauri command names.
 * Looks for lines like:
 *   Command: get_data
 *     Invoked in: N file(s)
 *       - src/views/DataView.vue
 * And backend declarations:
 *   Command: get_data
 *     Declared in: src-tauri/src/commands/data.rs
 */
function parseCommandReportToNodes(text, projectPath) {
    const nodes = [];
    const seenCommands = new Set();
    const commandRegex = /^Command:\s*(.+)$/gm;
    let match;
    while ((match = commandRegex.exec(text)) !== null) {
        const commandName = match[1].trim();
        if (seenCommands.has(commandName))
            continue;
        seenCommands.add(commandName);
        // Look ahead for context (invoked in / declared in)
        const startPos = match.index + match[0].length;
        const lookahead = text.substring(startPos, startPos + 300);
        const invokedIn = extractInlineField(lookahead, 'Invoked in');
        const declaredIn = extractInlineField(lookahead, 'Declared in');
        // Collect file references from the invocation list
        const fileRefs = [];
        const fileRefRegex = /^\s+-\s+(.+)$/gm;
        let fileMatch;
        const fileBlock = lookahead.split(/\n(?=Command:|\n---|\n===)/)[0] || '';
        while ((fileMatch = fileRefRegex.exec(fileBlock)) !== null) {
            fileRefs.push(fileMatch[1].trim());
        }
        nodes.push({
            id: makeNodeId('cmd', commandName),
            type: types_js_1.NodeType.COMMAND,
            name: commandName,
            path: declaredIn || undefined,
            metadata: {
                projectPath,
                invokedIn,
                declaredIn,
                invokedFiles: fileRefs,
            },
        });
    }
    return nodes;
}
/**
 * Parses type report text to extract type/interface definitions.
 * Looks for "--- File: path ---" blocks and scans content for
 * export interface/type/enum declarations.
 */
function parseTypeReportToNodes(text, projectPath) {
    const nodes = [];
    // Find file blocks: --- File: some/path.ts ---
    const fileBlockRegex = /--- File:\s*(.+?)\s*---\n([\s\S]*?)(?=\n--- File:|\n===|$)/g;
    let blockMatch;
    while ((blockMatch = fileBlockRegex.exec(text)) !== null) {
        const filePath = blockMatch[1].trim();
        const content = blockMatch[2];
        // Extract type/interface/enum names from the content block
        const typeDefRegex = /(?:export\s+)?(?:interface|type|enum)\s+([A-Z][a-zA-Z0-9_]*)/g;
        let typeMatch;
        while ((typeMatch = typeDefRegex.exec(content)) !== null) {
            const typeName = typeMatch[1];
            nodes.push({
                id: makeNodeId('type', typeName),
                type: types_js_1.NodeType.TYPE,
                name: typeName,
                path: filePath,
                metadata: {
                    projectPath,
                    sourceFile: filePath,
                },
            });
        }
        // I-11 FIX: Removed fallback TYPE node creation for files with no types.
        // Only legitimate TYPE nodes (actual type/interface/enum declarations) are created above.
    }
    return nodes;
}
/**
 * Parses UI component report text to extract component info.
 * Looks for patterns like:
 *   File Name: ExplorerView.vue (src/views/ExplorerView.vue)
 *     UI Elements (3): n-button, n-input, n-card
 */
function parseUiReportToNodes(text, projectPath) {
    const nodes = [];
    // Match "File Name: X (relative/path)"
    const fileRegex = /File Name:\s*(.+?)\s*\(([^)]+)\)/g;
    let match;
    while ((match = fileRegex.exec(text)) !== null) {
        const fileName = match[1].trim();
        const relativePath = match[2].trim();
        // Look ahead for UI Elements line
        const startPos = match.index + match[0].length;
        const lookahead = text.substring(startPos, startPos + 300);
        const elementsMatch = lookahead.match(/UI Elements\s*\(\d+\):\s*(.+)/);
        const uiElements = elementsMatch
            ? elementsMatch[1].split(',').map(e => e.trim()).filter(Boolean)
            : [];
        nodes.push({
            id: makeNodeId('comp', fileName),
            type: types_js_1.NodeType.COMPONENT,
            name: fileName,
            path: relativePath,
            metadata: {
                projectPath,
                uiElements,
            },
        });
    }
    return nodes;
}
/**
 * Scans any text report for import-like references and creates IMPORT nodes.
 * I-10 TIER 3: Enhanced with side-effect detection, conditional/dynamic imports,
 * barrel file resolution, and comprehensive import categorization.
 */
function parseImportsFromText(text, projectPath, filePath) {
    const nodes = [];
    const seen = new Set();
    // Use the enhanced extractFromText from AST parser
    const { imports } = (0, astParser_js_1.extractFromText)(text, projectPath);
    for (const imp of imports) {
        if (seen.has(imp.source))
            continue;
        seen.add(imp.source);
        nodes.push({
            id: makeNodeId('import', imp.source),
            type: types_js_1.NodeType.IMPORT,
            name: imp.source,
            path: imp.source,
            metadata: {
                projectPath,
                importType: imp.importType,
                specifiers: imp.specifiers.map(s => s.name),
            },
        });
    }
    // I-10 Tier 3: Enhanced import scanning for side-effects, dynamic, barrel re-exports
    const enhancedImports = enhancedImportScan(text, filePath);
    for (const enh of enhancedImports) {
        const key = `enhanced:${enh.source}:${enh.importType}`;
        if (seen.has(enh.source) || seen.has(key))
            continue;
        seen.add(key);
        nodes.push({
            id: makeNodeId('import', enh.source),
            type: types_js_1.NodeType.IMPORT,
            name: enh.source,
            path: enh.source,
            metadata: {
                projectPath,
                importType: enh.importType,
                specifiers: enh.specifiers,
                isSideEffect: enh.isSideEffect,
                isDynamic: enh.isDynamic,
                isConditional: enh.isConditional,
                isBarrelReexport: enh.isBarrelReexport,
                variablePath: enh.variablePath || false,
                resolvedSource: enh.resolvedSource,
            },
        });
    }
    return nodes;
}
// ============ FIELD EXTRACTION HELPERS ============
/** Extracts a single field value from "FieldName: value" lines. */
function extractField(block, fieldName) {
    const regex = new RegExp(`^\\s*${fieldName}:\\s*(.+)$`, 'm');
    const match = block.match(regex);
    return match ? match[1].trim() : null;
}
/** Extracts a comma-separated list from "FieldName (N): val1, val2" lines. */
function extractListField(block, fieldName) {
    const regex = new RegExp(`${fieldName}\\s*\\(\\d+\\):\\s*(.+)$`, 'm');
    const match = block.match(regex);
    if (!match)
        return [];
    const raw = match[1].trim();
    if (raw === 'None' || raw === '')
        return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}
/** Extracts a field from a lookahead string (indented lines after a match). */
function extractInlineField(lookahead, fieldName) {
    const regex = new RegExp(`^\\s*${fieldName}:\\s*(.+)$`, 'm');
    const match = lookahead.match(regex);
    return match ? match[1].trim() : null;
}
// ============ I-12/I-03: ENHANCED METADATA HELPERS ============
/**
 * I-12: Flattens the package.json "exports" field to extract all entry point paths.
 * Handles conditional exports: { ".": { "import": "./dist/index.js" } }
 */
function flattenPackageExports(exports) {
    const paths = [];
    function walk(obj) {
        if (typeof obj === 'string') {
            paths.push(obj);
        }
        else if (typeof obj === 'object' && obj !== null) {
            for (const value of Object.values(obj)) {
                walk(value);
            }
        }
    }
    walk(exports);
    return paths;
}
/**
 * I-12: Determines if a file is part of the public API (exported from package entry points).
 */
function isPublicAPIExport(filePath, entryPoints) {
    if (entryPoints.length === 0)
        return false;
    const normalizedPath = filePath.replace(/\\/g, '/');
    for (const entry of entryPoints) {
        const normalizedEntry = entry.replace(/\\/g, '/').replace(/^\.\//, '');
        if (normalizedPath === normalizedEntry || normalizedPath.endsWith(normalizedEntry)) {
            return true;
        }
    }
    // Also consider src/index.ts as public API
    if (normalizedPath === 'src/index.ts' || normalizedPath === 'src/index.js') {
        return true;
    }
    return false;
}
/**
 * I-03: Computes the dependency weight for an export.
 * Weight = number of times this export's module is imported across the project.
 */
function computeDependencyWeight(exportName, importCounts) {
    // Check how many files import something related to this export
    let weight = 0;
    for (const [source, count] of importCounts.entries()) {
        // If the source path contains the export name or related module
        if (source.includes(exportName) || source.endsWith(exportName)) {
            weight += count;
        }
    }
    return weight;
}
// ============ EDGE BUILDING ============
/**
 * Builds basic edges from the collected nodes.
 * - FILE → IMPORT edges when file nodes and import nodes share path prefixes
 * - ROUTE → COMPONENT edges when a route references a component name
 * - COMMAND → FILE edges when a command is invoked in known files
 * - STORE → FILE edges connecting store to its source file
 */
function buildEdges(nodes) {
    var _a, _b;
    const edges = [];
    const fileNodes = nodes.filter(n => n.type === types_js_1.NodeType.FILE);
    const storeNodes = nodes.filter(n => n.type === types_js_1.NodeType.STORE);
    const routeNodes = nodes.filter(n => n.type === types_js_1.NodeType.ROUTE);
    const commandNodes = nodes.filter(n => n.type === types_js_1.NodeType.COMMAND);
    const componentNodes = nodes.filter(n => n.type === types_js_1.NodeType.COMPONENT);
    const typeNodes = nodes.filter(n => n.type === types_js_1.NodeType.TYPE);
    // STORE → FILE: connect stores to their source files
    for (const store of storeNodes) {
        if (!store.path)
            continue;
        const matchingFile = fileNodes.find(f => f.path === store.path);
        if (matchingFile) {
            edges.push({
                id: makeEdgeId(matchingFile.id, store.id, types_js_1.EdgeType.CONTAINS),
                from: matchingFile.id,
                to: store.id,
                type: types_js_1.EdgeType.CONTAINS,
                confidence: 1,
            });
        }
    }
    // ROUTE → COMPONENT: connect routes to their component files
    for (const route of routeNodes) {
        const compName = (_a = route.metadata) === null || _a === void 0 ? void 0 : _a.component;
        if (!compName || compName === '(Dynamic Import)')
            continue;
        const matchingComp = componentNodes.find(c => c.name.replace(/\.vue$/, '') === compName);
        if (matchingComp) {
            edges.push({
                id: makeEdgeId(route.id, matchingComp.id, types_js_1.EdgeType.NAVIGATES_TO),
                from: route.id,
                to: matchingComp.id,
                type: types_js_1.EdgeType.NAVIGATES_TO,
                confidence: 0.9,
            });
        }
    }
    // COMMAND → FILE: connect commands to files where they're invoked
    for (const cmd of commandNodes) {
        const invokedFiles = ((_b = cmd.metadata) === null || _b === void 0 ? void 0 : _b.invokedFiles) || [];
        for (const invokedFile of invokedFiles) {
            const matchingFile = fileNodes.find(f => f.path === invokedFile);
            if (matchingFile) {
                edges.push({
                    id: makeEdgeId(matchingFile.id, cmd.id, types_js_1.EdgeType.INVOKES),
                    from: matchingFile.id,
                    to: cmd.id,
                    type: types_js_1.EdgeType.INVOKES,
                    confidence: 0.95,
                });
            }
        }
    }
    // TYPE → FILE: connect types to their source files
    for (const typeNode of typeNodes) {
        if (!typeNode.path)
            continue;
        const matchingFile = fileNodes.find(f => f.path === typeNode.path);
        if (matchingFile) {
            edges.push({
                id: makeEdgeId(matchingFile.id, typeNode.id, types_js_1.EdgeType.CONTAINS),
                from: matchingFile.id,
                to: typeNode.id,
                type: types_js_1.EdgeType.CONTAINS,
                confidence: 1,
            });
        }
    }
    // COMPONENT → FILE: connect components to their file entries
    for (const comp of componentNodes) {
        if (!comp.path)
            continue;
        const matchingFile = fileNodes.find(f => f.path === comp.path);
        if (matchingFile) {
            edges.push({
                id: makeEdgeId(matchingFile.id, comp.id, types_js_1.EdgeType.CONTAINS),
                from: matchingFile.id,
                to: comp.id,
                type: types_js_1.EdgeType.CONTAINS,
                confidence: 1,
            });
        }
    }
    return edges;
}
// ============ SINGLE-PROJECT INGESTION ============
/**
 * Runs all parsers against a single project path and builds a SemanticGraph.
 * I-01 FIX: Uses retry wrapper with exponential backoff; pipeline continues on parser failure.
 * I-02/I-12 FIX: Creates IMPORT and EXPORT nodes using AST parsing on discovered files.
 * When persist=true, also writes raw parser output to the shared SQLite database.
 */
function ingestSingleProject(projectPath, persist) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[dataIngestion] Ingesting project: ${projectPath}`);
        const allNodes = [];
        let failedParsers = 0;
        // Collect raw text results for optional persistence
        const rawResults = {};
        // 1. Overview → FILE nodes (with retry, I-01)
        const overviewFallback = { reportString: '', fileList: [] };
        const { result: overviewResult, failed: overviewFailed } = yield retryParser('overview', () => __awaiter(this, void 0, void 0, function* () { return (0, overview_js_1.generateOverviewAndGetFileList)(projectPath); }), overviewFallback);
        if (!overviewFailed) {
            rawResults.overview = overviewResult.reportString;
            const fileNodes = parseOverviewToNodes(overviewResult.reportString, projectPath);
            allNodes.push(...fileNodes);
            console.log(`[dataIngestion]   Overview: ${fileNodes.length} file nodes`);
            // Also extract imports from the overview report text
            const importNodes = parseImportsFromText(overviewResult.reportString, projectPath);
            allNodes.push(...importNodes);
        }
        else {
            failedParsers++;
            console.warn(`[dataIngestion]   Overview: FALLBACK — no file nodes generated`);
        }
        // 2. Store report → STORE nodes (with retry, I-01)
        const { result: storeText, failed: storeFailed } = yield retryParser('store', () => __awaiter(this, void 0, void 0, function* () { return (0, storeParser_js_1.generateStoreReport)(projectPath); }), '');
        if (!storeFailed && storeText) {
            rawResults.stores = storeText;
            const storeNodes = parseStoreReportToNodes(storeText, projectPath);
            allNodes.push(...storeNodes);
            console.log(`[dataIngestion]   Stores: ${storeNodes.length} store nodes`);
        }
        else if (storeFailed) {
            failedParsers++;
            console.warn(`[dataIngestion]   Store: FALLBACK — no store nodes generated`);
        }
        // 3. Route report → ROUTE nodes (with retry, I-01)
        const { result: routeText, failed: routeFailed } = yield retryParser('route', () => __awaiter(this, void 0, void 0, function* () { return (0, routeParser_js_1.generateRouteReport)(projectPath); }), '');
        if (!routeFailed && routeText) {
            rawResults.routes = routeText;
            const routeNodes = parseRouteReportToNodes(routeText, projectPath);
            allNodes.push(...routeNodes);
            console.log(`[dataIngestion]   Routes: ${routeNodes.length} route nodes`);
        }
        else if (routeFailed) {
            failedParsers++;
            console.warn(`[dataIngestion]   Routes: FALLBACK — no route nodes generated`);
        }
        // 4. Command report → COMMAND nodes (with retry, I-01)
        const { result: commandText, failed: commandFailed } = yield retryParser('command', () => __awaiter(this, void 0, void 0, function* () { return (0, commandParser_js_1.generateCommandReport)(projectPath); }), '');
        if (!commandFailed && commandText) {
            rawResults.commands = commandText;
            const commandNodes = parseCommandReportToNodes(commandText, projectPath);
            allNodes.push(...commandNodes);
            console.log(`[dataIngestion]   Commands: ${commandNodes.length} command nodes`);
            // Extract imports from type definitions in command reports
            const importNodes = parseImportsFromText(commandText, projectPath);
            allNodes.push(...importNodes);
        }
        else if (commandFailed) {
            failedParsers++;
            console.warn(`[dataIngestion]   Commands: FALLBACK — no command nodes generated`);
        }
        // 5. Type report → TYPE nodes (with retry, I-01)
        const { result: typeText, failed: typeFailed } = yield retryParser('type', () => __awaiter(this, void 0, void 0, function* () { return (0, typeParser_js_1.generateTypeReport)(projectPath); }), '');
        if (!typeFailed && typeText) {
            rawResults.types = typeText;
            const typeNodes = parseTypeReportToNodes(typeText, projectPath);
            allNodes.push(...typeNodes);
            console.log(`[dataIngestion]   Types: ${typeNodes.length} type nodes`);
            // Extract imports from type file contents
            const importNodes = parseImportsFromText(typeText, projectPath);
            allNodes.push(...importNodes);
        }
        else if (typeFailed) {
            failedParsers++;
            console.warn(`[dataIngestion]   Types: FALLBACK — no type nodes generated`);
        }
        // 6. UI component report → COMPONENT nodes (with retry, I-01)
        const { result: uiText, failed: uiFailed } = yield retryParser('ui', () => __awaiter(this, void 0, void 0, function* () { return (0, uiParser_js_1.generateUiComponentReport)(projectPath); }), '');
        if (!uiFailed && uiText) {
            const uiNodes = parseUiReportToNodes(uiText, projectPath);
            allNodes.push(...uiNodes);
            console.log(`[dataIngestion]   UI Components: ${uiNodes.length} component nodes`);
        }
        else if (uiFailed) {
            failedParsers++;
            console.warn(`[dataIngestion]   UI: FALLBACK — no UI component nodes generated`);
        }
        // I-01: Log parser health summary
        if (failedParsers > 0) {
            console.warn(`[dataIngestion]   ⚠ ${failedParsers}/6 parsers failed — pipeline continuing with partial data`);
        }
        // I-02/I-12 FIX: AST-based IMPORT and EXPORT node creation from real source files.
        // Enhanced: re-export tracking, metadata enrichment, module boundary detection,
        // complexity indicators, and dependency weight computation.
        const fileNodes = allNodes.filter(n => n.type === types_js_1.NodeType.FILE);
        let astImportCount = 0;
        let astExportCount = 0;
        // I-03: Track dependency weights (transitive dependency count per import)
        const importCounts = new Map();
        // I-12: Detect package entry point for module boundary detection
        const packageJsonPath = path.join(projectPath, 'package.json');
        let entryPoints = [];
        try {
            const pkgAccessResult = yield ioChan_js_1.ioChan.execute(ioChan_js_1.IoChannelPriority.ANALYSIS, () => (0, safeFs_js_1.safeAccess)(packageJsonPath));
            if (pkgAccessResult.success) {
                const pkgReadResult = yield ioChan_js_1.ioChan.execute(ioChan_js_1.IoChannelPriority.ANALYSIS, () => (0, safeFs_js_1.safeReadFile)(packageJsonPath));
                if (pkgReadResult.success) {
                    const pkgJson = JSON.parse(pkgReadResult.data);
                    if (pkgJson.main)
                        entryPoints.push(pkgJson.main);
                    if (pkgJson.module)
                        entryPoints.push(pkgJson.module);
                    if (pkgJson.exports) {
                        const flatExports = flattenPackageExports(pkgJson.exports);
                        entryPoints.push(...flatExports);
                    }
                }
            }
        }
        catch (_a) {
            // Ignore package.json read errors
        }
        for (const fileNode of fileNodes) {
            const filePath = fileNode.path
                ? path.resolve(projectPath, fileNode.path)
                : undefined;
            if (!filePath)
                continue;
            // Only parse TypeScript/JavaScript/Vue files
            const ext = path.extname(filePath).toLowerCase();
            if (!['.ts', '.tsx', '.js', '.jsx', '.vue'].includes(ext))
                continue;
            // Skip if file doesn't exist
            const fileAccessResult = yield ioChan_js_1.ioChan.execute(ioChan_js_1.IoChannelPriority.ANALYSIS, () => (0, safeFs_js_1.safeAccess)(filePath));
            if (!fileAccessResult.success)
                continue;
            try {
                const astResult = (0, astParser_js_1.extractImportsAndExports)(filePath);
                // I-03: Track import counts for dependency weight
                for (const imp of astResult.imports) {
                    const count = importCounts.get(imp.source) || 0;
                    importCounts.set(imp.source, count + 1);
                }
                // Create IMPORT nodes with full metadata (I-02, I-03)
                for (const imp of astResult.imports) {
                    const edgeType = imp.isDynamic ? 'dynamic' : imp.importType;
                    allNodes.push({
                        id: makeNodeId('import', imp.source),
                        type: types_js_1.NodeType.IMPORT,
                        name: imp.source,
                        path: imp.source,
                        metadata: {
                            projectPath,
                            importType: edgeType,
                            specifiers: imp.specifiers.map(s => s.name),
                            sourceFile: fileNode.path,
                            isDynamic: imp.isDynamic || false,
                        },
                    });
                    astImportCount++;
                }
                // Create EXPORT nodes with populated metadata (I-02, I-03, I-12)
                for (const exp of astResult.exports) {
                    // I-12: Determine if this export is part of the public API
                    const isPublicAPI = isPublicAPIExport(fileNode.path || '', entryPoints);
                    // I-03: Compute dependency weight for this export
                    const dependencyWeight = computeDependencyWeight(exp.name, importCounts);
                    allNodes.push({
                        id: makeNodeId('export', exp.name),
                        type: types_js_1.NodeType.EXPORT,
                        name: exp.name,
                        path: fileNode.path,
                        metadata: {
                            projectPath,
                            kind: exp.kind,
                            signature: exp.signature,
                            returnType: exp.returnType,
                            paramCount: exp.paramCount,
                            typeParams: exp.typeParams,
                            sourceFile: exp.sourceFile,
                            // I-12: Re-export chain tracking
                            isReexport: exp.isReexport || false,
                            reexportSource: exp.reexportSource,
                            reexportChain: exp.reexportChain,
                            originPath: exp.originPath,
                            // I-12: Module boundary detection
                            isPublicAPI,
                            exportVisibility: exp.exportVisibility || 'named',
                            // I-03: Enhanced metadata
                            paramTypes: exp.paramTypes,
                            isPure: exp.isPure,
                            complexity: exp.complexity,
                            dependencyWeight,
                            jsdocTags: exp.jsdocTags,
                        },
                    });
                    astExportCount++;
                }
                // I-02: Create edges for export star relationships
                if (astResult.exportStars && astResult.exportStars.length > 0) {
                    for (const star of astResult.exportStars) {
                        // Track star export as a special import relationship
                        allNodes.push({
                            id: makeNodeId('import', `star:${star.source}`),
                            type: types_js_1.NodeType.IMPORT,
                            name: star.source,
                            path: star.source,
                            metadata: {
                                projectPath,
                                importType: 'namespace',
                                isExportStar: true,
                                resolvedExports: star.resolvedExports || [],
                                sourceFile: fileNode.path,
                            },
                        });
                    }
                }
            }
            catch (_b) {
                // AST extraction failed for this file — continue silently
            }
        }
        if (astImportCount > 0 || astExportCount > 0) {
            console.log(`[dataIngestion]   AST extraction: ${astImportCount} imports, ${astExportCount} exports`);
        }
        // Persist raw parser output to SQLite if requested
        if (persist) {
            try {
                const persister = new parserPersistence_js_1.ParserPersistence();
                const snapshotId = persister.generateSnapshotId();
                persister.persistAllParserData(projectPath, snapshotId, rawResults);
                persister.close();
                console.log(`[dataIngestion]   Persisted parser data (snapshot: ${snapshotId})`);
            }
            catch (err) {
                console.error(`[dataIngestion]   Persistence failed: ${err.message}`);
            }
        }
        // Build edges from collected nodes
        const edges = buildEdges(allNodes);
        console.log(`[dataIngestion]   Total: ${allNodes.length} nodes, ${edges.length} edges`);
        return {
            nodes: allNodes,
            edges,
            properties: initialProperties(),
        };
    });
}
// ============ MAIN EXPORT ============
/**
 * Stage 1: Ingest project data from both external and current projects.
 * Calls all parsers on each project, parses text results into graph nodes,
 * builds basic containment/reference edges, and returns both graphs
 * with initial properties set to 0 (computed in Stage 2).
 */
function ingestProjectData(args) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[dataIngestion] === Stage 1: Data Ingestion ===`);
        console.log(`[dataIngestion]   External project: ${args.externalPath}`);
        console.log(`[dataIngestion]   Current project:  ${args.currentPath}`);
        console.log(`[dataIngestion]   Target pages:     ${args.targetPages.join(', ') || '(none)'}`);
        if (args.persist)
            console.log(`[dataIngestion]   Persistence:      ENABLED`);
        // Reset node counter for clean IDs per run
        nodeCounter = 0;
        // Run ingestion on both projects
        const externalGraph = yield ingestSingleProject(args.externalPath, args.persist);
        const currentGraph = yield ingestSingleProject(args.currentPath, args.persist);
        console.log(`[dataIngestion] === Ingestion Complete ===`);
        console.log(`[dataIngestion]   External graph: ${externalGraph.nodes.length} nodes, ${externalGraph.edges.length} edges`);
        console.log(`[dataIngestion]   Current graph:  ${currentGraph.nodes.length} nodes, ${currentGraph.edges.length} edges`);
        return { externalGraph, currentGraph };
    });
}
//# sourceMappingURL=dataIngestion.js.map