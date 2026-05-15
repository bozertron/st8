"use strict";
// src/utils/ioChan.ts
// Priority-based I/O channel router with circuit breakers.
// Hardware analogy: a custom signal bus with tiered protection levels,
// preventing critical operations from being starved by bulk analysis I/O.
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
exports.ioChan = exports.IoChan = exports.CircuitBreaker = exports.BreakerState = exports.IoChannelPriority = void 0;
// ─── Types ───────────────────────────────────────────────────────────────────
var IoChannelPriority;
(function (IoChannelPriority) {
    /** Serialized, 1 concurrent. Registry writes, database transactions. */
    IoChannelPriority["CRITICAL"] = "CRITICAL";
    /** 5 concurrent. User reports, exports. */
    IoChannelPriority["IMPORTANT"] = "IMPORTANT";
    /** 20 concurrent. Project scanning, diagnostics. */
    IoChannelPriority["ANALYSIS"] = "ANALYSIS";
    /** 100 concurrent. Cache writes, temp data. Fails fast if congested. */
    IoChannelPriority["BEST_EFFORT"] = "BEST_EFFORT";
})(IoChannelPriority || (exports.IoChannelPriority = IoChannelPriority = {}));
// ─── Circuit Breaker ─────────────────────────────────────────────────────────
var BreakerState;
(function (BreakerState) {
    BreakerState["CLOSED"] = "CLOSED";
    BreakerState["OPEN"] = "OPEN";
    BreakerState["HALF_OPEN"] = "HALF_OPEN";
})(BreakerState || (exports.BreakerState = BreakerState = {}));
class CircuitBreaker {
    constructor(config) {
        var _a;
        this.state = BreakerState.CLOSED;
        this.consecutiveFailures = 0;
        this.lastFailureTime = 0;
        this.lastStateChange = Date.now();
        this.tripCount = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
        this.halfOpenSuccesses = 0;
        this.listeners = [];
        this.threshold = config.failureThreshold;
        this.cooldownMs = config.cooldownMs;
        this.probeCount = (_a = config.probeCount) !== null && _a !== void 0 ? _a : 1;
    }
    /** Register a listener for state transitions */
    onStateChange(listener) {
        this.listeners.push(listener);
    }
    /** Check if the circuit allows operations */
    canExecute() {
        if (this.state === BreakerState.CLOSED)
            return true;
        if (this.state === BreakerState.OPEN) {
            // Check if cooldown has elapsed
            if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
                this.transition(BreakerState.HALF_OPEN, 'Cooldown elapsed; allowing probe request');
                return true;
            }
            return false;
        }
        // HALF_OPEN: allow probe requests (up to probeCount concurrently)
        return true;
    }
    /** Record a successful operation */
    recordSuccess() {
        this.totalSuccesses++;
        if (this.state === BreakerState.HALF_OPEN) {
            this.halfOpenSuccesses++;
            if (this.halfOpenSuccesses >= this.probeCount) {
                // Probe succeeded; close circuit
                this.consecutiveFailures = 0;
                this.halfOpenSuccesses = 0;
                this.transition(BreakerState.CLOSED, `Probe succeeded (${this.probeCount} probes passed)`);
            }
        }
        else {
            this.consecutiveFailures = 0;
        }
    }
    /** Record a failed operation */
    recordFailure() {
        this.consecutiveFailures++;
        this.totalFailures++;
        this.lastFailureTime = Date.now();
        if (this.state === BreakerState.HALF_OPEN) {
            // Probe failed; re-open circuit
            this.halfOpenSuccesses = 0;
            this.transition(BreakerState.OPEN, 'Probe request failed in HALF_OPEN');
            this.tripCount++;
        }
        else if (this.state === BreakerState.CLOSED && this.consecutiveFailures >= this.threshold) {
            this.transition(BreakerState.OPEN, `Failure threshold reached (${this.consecutiveFailures}/${this.threshold})`);
            this.tripCount++;
        }
    }
    /** Get current breaker metrics for diagnostics */
    getMetrics() {
        return {
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
            currentState: this.state,
            lastStateChange: this.lastStateChange,
            tripCount: this.tripCount,
            consecutiveFailures: this.consecutiveFailures,
        };
    }
    /** Get current breaker state for diagnostics (legacy compat) */
    getState() {
        return { state: this.state, failures: this.consecutiveFailures };
    }
    /** Manual reset */
    reset() {
        const prev = this.state;
        this.state = BreakerState.CLOSED;
        this.consecutiveFailures = 0;
        this.lastFailureTime = 0;
        this.halfOpenSuccesses = 0;
        if (prev !== BreakerState.CLOSED) {
            this.emitTransition(prev, BreakerState.CLOSED, 'Manual reset');
        }
        this.lastStateChange = Date.now();
    }
    // ─── Private Helpers ────────────────────────────────────────────────────
    transition(to, reason) {
        const from = this.state;
        if (from === to)
            return;
        this.state = to;
        this.lastStateChange = Date.now();
        this.emitTransition(from, to, reason);
    }
    emitTransition(from, to, reason) {
        const event = {
            from,
            to,
            timestamp: Date.now(),
            reason,
        };
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (_a) {
                // Listener errors must not break breaker logic
            }
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
const DEFAULT_CHANNEL_CONFIGS = {
    [IoChannelPriority.CRITICAL]: {
        maxConcurrent: 1,
        timeoutMs: 30000,
        breakerThreshold: 10,
        breakerCooldownMs: 60000,
    },
    [IoChannelPriority.IMPORTANT]: {
        maxConcurrent: 5,
        timeoutMs: 15000,
        breakerThreshold: 8,
        breakerCooldownMs: 30000,
    },
    [IoChannelPriority.ANALYSIS]: {
        maxConcurrent: 20,
        timeoutMs: 5000,
        breakerThreshold: 15,
        breakerCooldownMs: 15000,
    },
    [IoChannelPriority.BEST_EFFORT]: {
        maxConcurrent: 100,
        timeoutMs: 2000,
        breakerThreshold: 20,
        breakerCooldownMs: 10000,
    },
};
// ─── IoChan Class ────────────────────────────────────────────────────────────
class IoChan {
    constructor(configs) {
        var _a;
        this.channels = new Map();
        for (const priority of Object.values(IoChannelPriority)) {
            const defaultCfg = DEFAULT_CHANNEL_CONFIGS[priority];
            const overrides = (_a = configs === null || configs === void 0 ? void 0 : configs[priority]) !== null && _a !== void 0 ? _a : {};
            const cfg = Object.assign(Object.assign({}, defaultCfg), overrides);
            this.channels.set(priority, {
                priority,
                maxConcurrent: cfg.maxConcurrent,
                timeoutMs: cfg.timeoutMs,
                inProgress: 0,
                queue: [],
                breaker: new CircuitBreaker({
                    failureThreshold: cfg.breakerThreshold,
                    cooldownMs: cfg.breakerCooldownMs,
                    probeCount: cfg.breakerProbeCount,
                }),
            });
        }
    }
    /**
     * Execute an I/O operation through the priority channel.
     * Never throws — always returns IoResult<T>.
     *
     * Usage:
     *   await ioChan.execute('CRITICAL', () => safeFs.safeWriteFile(path, data))
     */
    execute(priority, operation) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedPriority = this.normalizePriority(priority);
            const channel = this.channels.get(normalizedPriority);
            // Circuit breaker check
            if (!channel.breaker.canExecute()) {
                return {
                    success: false,
                    error: {
                        code: 'CIRCUIT_OPEN',
                        message: `Circuit breaker open for ${normalizedPriority} channel (cooldown active)`,
                        severity: 'warning',
                    },
                };
            }
            // Concurrency check
            if (channel.inProgress >= channel.maxConcurrent) {
                if (normalizedPriority === IoChannelPriority.BEST_EFFORT) {
                    // Best-effort: fail fast, don't wait
                    return {
                        success: false,
                        error: {
                            code: 'CHANNEL_CONGESTED',
                            message: 'Best-effort channel at capacity; operation skipped',
                            severity: 'skip',
                        },
                    };
                }
                // Other priorities: wait in queue
                yield new Promise((resolve) => {
                    channel.queue.push(resolve);
                });
            }
            channel.inProgress++;
            try {
                const result = yield this.executeWithTimeout(operation, channel.timeoutMs);
                channel.breaker.recordSuccess();
                return result;
            }
            catch (err) {
                channel.breaker.recordFailure();
                const error = err instanceof Error ? err : new Error(String(err));
                return {
                    success: false,
                    error: {
                        code: error.code || 'EXECUTION_ERROR',
                        message: error.message,
                        severity: this.classifySeverity(normalizedPriority),
                    },
                };
            }
            finally {
                channel.inProgress--;
                this.drainQueue(channel);
            }
        });
    }
    /**
     * Get diagnostics for all channels.
     */
    getStatus() {
        const result = {};
        for (const [priority, channel] of this.channels.entries()) {
            result[priority] = {
                inProgress: channel.inProgress,
                queued: channel.queue.length,
                breakerState: channel.breaker.getState().state,
                breakerMetrics: channel.breaker.getMetrics(),
            };
        }
        return result;
    }
    /**
     * Reset a channel's circuit breaker (e.g., after fixing underlying issue).
     */
    resetBreaker(priority) {
        const channel = this.channels.get(priority);
        if (channel) {
            channel.breaker.reset();
        }
    }
    // ─── Private Helpers ─────────────────────────────────────────────────────
    normalizePriority(input) {
        if (Object.values(IoChannelPriority).includes(input)) {
            return input;
        }
        // Handle string keys like 'CRITICAL'
        const mapped = IoChannelPriority[input];
        return mapped !== null && mapped !== void 0 ? mapped : IoChannelPriority.BEST_EFFORT;
    }
    executeWithTimeout(operation, timeoutMs) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                let settled = false;
                const timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        resolve({
                            success: false,
                            error: {
                                code: 'TIMEOUT',
                                message: `Operation timed out after ${timeoutMs}ms`,
                                severity: 'warning',
                            },
                        });
                    }
                }, timeoutMs);
                (() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const raw = yield operation();
                        if (settled)
                            return;
                        settled = true;
                        clearTimeout(timer);
                        // Handle both raw values and FsResult<T> returns
                        if (this.isFsResult(raw)) {
                            if (raw.success) {
                                resolve({ success: true, data: raw.data });
                            }
                            else {
                                resolve({
                                    success: false,
                                    error: {
                                        code: raw.error.code,
                                        message: raw.error.message,
                                        severity: raw.error.severity,
                                    },
                                });
                            }
                        }
                        else {
                            resolve({ success: true, data: raw });
                        }
                    }
                    catch (err) {
                        if (settled)
                            return;
                        settled = true;
                        clearTimeout(timer);
                        const error = err instanceof Error ? err : new Error(String(err));
                        resolve({
                            success: false,
                            error: {
                                code: error.code || 'EXECUTION_ERROR',
                                message: error.message,
                                severity: 'fatal',
                            },
                        });
                    }
                }))();
            });
        });
    }
    isFsResult(value) {
        return (typeof value === 'object' &&
            value !== null &&
            'success' in value &&
            typeof value.success === 'boolean');
    }
    drainQueue(channel) {
        if (channel.queue.length > 0 && channel.inProgress < channel.maxConcurrent) {
            const next = channel.queue.shift();
            if (next)
                next();
        }
    }
    classifySeverity(priority) {
        switch (priority) {
            case IoChannelPriority.CRITICAL:
                return 'fatal';
            case IoChannelPriority.IMPORTANT:
                return 'warning';
            case IoChannelPriority.ANALYSIS:
                return 'warning';
            case IoChannelPriority.BEST_EFFORT:
                return 'skip';
        }
    }
}
exports.IoChan = IoChan;
// ─── Default Singleton ───────────────────────────────────────────────────────
/** Pre-configured default IoChan instance. Import and use directly. */
exports.ioChan = new IoChan();
//# sourceMappingURL=ioChan.js.map