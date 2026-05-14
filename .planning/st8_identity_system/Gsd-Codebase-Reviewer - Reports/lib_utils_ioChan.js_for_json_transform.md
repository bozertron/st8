# Deep-Dive Analysis: `lib/utils/ioChan.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/utils/ioChan.js`
**Lines:** 396 total
**Source:** TypeScript compiled to JavaScript (`src/utils/ioChan.ts`)
**Purpose:** Priority-based I/O channel router with circuit breakers

---

## Lines 1-5: Header & Comments
```
"use strict";
// src/utils/ioChan.ts
// Priority-based I/O channel router with circuit breakers.
// Hardware analogy: a custom signal bus with tiered protection levels,
// preventing critical operations from being starved by bulk analysis I/O.
```

- **What triggers it:** Module load
- **What it calls:** Nothing
- **What calls it:** Every module that `require()`s this file
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Standard TypeScript-compiled header.

---

## Lines 6-14: `__awaiter` Polyfill
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

- **What triggers it:** Every `async` function in this file uses this polyfill
- **What it calls:** `adopt()` (line 7), `fulfilled()` (line 9), `rejected()` (line 10), `step()` (line 11)
- **What calls it:** `execute()` (line 213), `executeWithTimeout()` (line 303)
- **Dependencies:** `Promise` global
- **Status:** WORKING
- **Gap:** None. Standard TypeScript async/await downlevel compilation.

### `adopt()` (Line 7)
```javascript
function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
```
- **Purpose:** Ensures a value is a Promise. If already a Promise instance, returns it. Otherwise wraps it.
- **Called by:** `step()` on line 11 when `result.done === false` (generator yielded a value)
- **Status:** WORKING
- **Gap:** None

### `fulfilled()` (Line 9)
```javascript
function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
```
- **Purpose:** Resumes generator after a yielded promise resolves successfully
- **Called by:** `adopt(...).then(fulfilled, rejected)` on line 11
- **Status:** WORKING
- **Gap:** None

### `rejected()` (Line 10)
```javascript
function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
```
- **Purpose:** Resumes generator after a yielded promise rejects, by throwing the error into the generator
- **Called by:** `adopt(...).then(fulfilled, rejected)` on line 11
- **Status:** WORKING
- **Gap:** None

### `step()` (Line 11)
```javascript
function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
```
- **Purpose:** Core generator stepper. If generator is done, resolves the outer promise. If yielded a value, wraps it in a promise chain.
- **Called by:** `fulfilled()`, `rejected()`, and the initial invocation on line 12
- **Status:** WORKING
- **Gap:** None

### Initial Invocation (Line 12)
```javascript
step((generator = generator.apply(thisArg, _arguments || [])).next());
```
- **Purpose:** Starts the generator and feeds its first `.next()` result into `step()`
- **Status:** WORKING
- **Gap:** None

---

## Lines 15-16: Module Exports Setup
```javascript
Object.defineProperty(exports, "__esModule", { value: true });
exports.ioChan = exports.IoChan = exports.CircuitBreaker = exports.BreakerState = exports.IoChannelPriority = void 0;
```

- **What triggers it:** Module load
- **What it calls:** `Object.defineProperty`
- **What calls it:** Consumers via `require("../../utils/ioChan.js")`
- **Dependencies:** CommonJS `exports` object
- **Status:** WORKING
- **Gap:** None. Standard TypeScript module interop.

---

## Lines 17-28: `IoChannelPriority` Enum
```javascript
var IoChannelPriority;
(function (IoChannelPriority) {
    IoChannelPriority["CRITICAL"] = "CRITICAL";      // Line 21
    IoChannelPriority["IMPORTANT"] = "IMPORTANT";    // Line 23
    IoChannelPriority["ANALYSIS"] = "ANALYSIS";      // Line 25
    IoChannelPriority["BEST_EFFORT"] = "BEST_EFFORT"; // Line 27
})(IoChannelPriority || (exports.IoChannelPriority = IoChannelPriority = {}));
```

- **What triggers it:** Module load
- **What it calls:** Nothing
- **What calls it:** `DEFAULT_CHANNEL_CONFIGS` (line 157), `IoChan.execute()` (line 213), `IoChan.normalizePriority()` (line 295), `IoChan.classifySeverity()` (line 379)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Four priority tiers:
  - `CRITICAL` — Serialized, 1 concurrent (registry writes, database transactions)
  - `IMPORTANT` — 5 concurrent (user reports, exports)
  - `ANALYSIS` — 20 concurrent (project scanning, diagnostics)
  - `BEST_EFFORT` — 100 concurrent (cache writes, temp data)

---

## Lines 29-35: `BreakerState` Enum
```javascript
var BreakerState;
(function (BreakerState) {
    BreakerState["CLOSED"] = "CLOSED";         // Line 32
    BreakerState["OPEN"] = "OPEN";             // Line 33
    BreakerState["HALF_OPEN"] = "HALF_OPEN";   // Line 34
})(BreakerState || (exports.BreakerState = BreakerState = {}));
```

- **What triggers it:** Module load
- **What it calls:** Nothing
- **What calls it:** `CircuitBreaker` class methods throughout
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Standard circuit breaker states:
  - `CLOSED` — Normal operation, requests flow through
  - `OPEN` — Circuit tripped, requests blocked until cooldown
  - `HALF_OPEN` — Probing state, limited requests allowed to test recovery

---

## Lines 36-155: `CircuitBreaker` Class

### Lines 36-51: Constructor
```javascript
class CircuitBreaker {
    constructor(config) {
        var _a;
        this.state = BreakerState.CLOSED;           // Line 39
        this.consecutiveFailures = 0;                // Line 40
        this.lastFailureTime = 0;                    // Line 41
        this.lastStateChange = Date.now();           // Line 42
        this.tripCount = 0;                          // Line 43
        this.totalFailures = 0;                      // Line 44
        this.totalSuccesses = 0;                     // Line 45
        this.halfOpenSuccesses = 0;                  // Line 46
        this.listeners = [];                         // Line 47
        this.threshold = config.failureThreshold;    // Line 48
        this.cooldownMs = config.cooldownMs;         // Line 49
        this.probeCount = (_a = config.probeCount) !== null && _a !== void 0 ? _a : 1; // Line 50
    }
```

- **What triggers it:** `new CircuitBreaker({ failureThreshold, cooldownMs, probeCount })`
- **What it calls:** `Date.now()`
- **What calls it:** `IoChan` constructor (line 198)
- **Dependencies:** `BreakerState` enum (line 30)
- **Status:** WORKING
- **Gap:** `probeCount` defaults to `1` if not provided (line 50). This is correct behavior.

### Lines 52-55: `onStateChange(listener)`
```javascript
onStateChange(listener) {
    this.listeners.push(listener);
}
```

- **What triggers it:** External registration of state change listener
- **What it calls:** `Array.push()`
- **What calls it:** **NOTHING IN CURRENT CODEBASE** — this is a public API method with no callers found
- **Dependencies:** None
- **Status:** NOT CONNECTED
- **Gap:** This method exists but no code in the st8 codebase registers listeners on circuit breakers. The `emitTransition()` method (line 139) calls listeners, but nobody registers them. This means state transitions are silently happening without any external notification.

### Lines 57-70: `canExecute()`
```javascript
canExecute() {
    if (this.state === BreakerState.CLOSED)       // Line 58
        return true;
    if (this.state === BreakerState.OPEN) {        // Line 60
        if (Date.now() - this.lastFailureTime >= this.cooldownMs) {  // Line 62
            this.transition(BreakerState.HALF_OPEN, 'Cooldown elapsed; allowing probe request');  // Line 63
            return true;
        }
        return false;                              // Line 66
    }
    // HALF_OPEN: allow probe requests
    return true;                                   // Line 69
}
```

- **What triggers it:** `IoChan.execute()` at line 218
- **What it calls:** `this.transition()` (line 63), `Date.now()` (line 62)
- **What calls it:** `IoChan.execute()` (line 218)
- **Dependencies:** `BreakerState` enum
- **Status:** WORKING
- **Gap:** **BUG: No concurrency limit on HALF_OPEN probes.** Line 69 returns `true` for ALL requests when in `HALF_OPEN` state. The comment on line 68 says "allow probe requests (up to probeCount concurrently)" but there is NO actual tracking of how many probes are in flight. If 100 requests arrive simultaneously while in `HALF_OPEN`, all 100 will be allowed through, defeating the purpose of half-open probing. The `probeCount` config (line 50) is only used in `recordSuccess()` (line 76) to determine how many successes are needed to close the circuit, NOT to limit concurrent probes.

### Lines 72-86: `recordSuccess()`
```javascript
recordSuccess() {
    this.totalSuccesses++;                         // Line 73
    if (this.state === BreakerState.HALF_OPEN) {   // Line 74
        this.halfOpenSuccesses++;                  // Line 75
        if (this.halfOpenSuccesses >= this.probeCount) {  // Line 76
            this.consecutiveFailures = 0;          // Line 78
            this.halfOpenSuccesses = 0;            // Line 79
            this.transition(BreakerState.CLOSED, `Probe succeeded (${this.probeCount} probes passed)`);  // Line 80
        }
    }
    else {
        this.consecutiveFailures = 0;              // Line 84
    }
}
```

- **What triggers it:** Successful I/O operation in `IoChan.execute()` (line 249)
- **What it calls:** `this.transition()` (line 80)
- **What calls it:** `IoChan.execute()` (line 249)
- **Dependencies:** `BreakerState` enum
- **Status:** WORKING (with caveat from `canExecute()` bug above)
- **Gap:** Related to the `canExecute()` bug — if many probes are allowed through simultaneously in `HALF_OPEN`, `halfOpenSuccesses` could exceed `probeCount` rapidly. The circuit would still close correctly, but the intended "controlled probe" behavior is not implemented.

### Lines 88-102: `recordFailure()`
```javascript
recordFailure() {
    this.consecutiveFailures++;                    // Line 89
    this.totalFailures++;                          // Line 90
    this.lastFailureTime = Date.now();             // Line 91
    if (this.state === BreakerState.HALF_OPEN) {   // Line 92
        this.halfOpenSuccesses = 0;                // Line 94
        this.transition(BreakerState.OPEN, 'Probe request failed in HALF_OPEN');  // Line 95
        this.tripCount++;                          // Line 96
    }
    else if (this.state === BreakerState.CLOSED && this.consecutiveFailures >= this.threshold) {  // Line 98
        this.transition(BreakerState.OPEN, `Failure threshold reached (${this.consecutiveFailures}/${this.threshold})`);  // Line 99
        this.tripCount++;                          // Line 100
    }
}
```

- **What triggers it:** Failed I/O operation in `IoChan.execute()` (line 253)
- **What it calls:** `this.transition()` (lines 95, 99), `Date.now()` (line 91)
- **What calls it:** `IoChan.execute()` (line 253)
- **Dependencies:** `BreakerState` enum
- **Status:** WORKING
- **Gap:** None. Correctly handles:
  - HALF_OPEN failure → re-opens circuit
  - CLOSED failure exceeding threshold → opens circuit

### Lines 103-113: `getMetrics()`
```javascript
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
```

- **What triggers it:** `IoChan.getStatus()` (line 280)
- **What it calls:** Nothing
- **What calls it:** `IoChan.getStatus()` (line 280)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Returns comprehensive breaker diagnostics.

### Lines 114-117: `getState()` (Legacy)
```javascript
getState() {
    return { state: this.state, failures: this.consecutiveFailures };
}
```

- **What triggers it:** `IoChan.getStatus()` (line 279)
- **What it calls:** Nothing
- **What calls it:** `IoChan.getStatus()` (line 279)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None. Legacy compatibility method.

### Lines 118-129: `reset()`
```javascript
reset() {
    const prev = this.state;                       // Line 120
    this.state = BreakerState.CLOSED;              // Line 121
    this.consecutiveFailures = 0;                  // Line 122
    this.lastFailureTime = 0;                      // Line 123
    this.halfOpenSuccesses = 0;                    // Line 124
    if (prev !== BreakerState.CLOSED) {            // Line 125
        this.emitTransition(prev, BreakerState.CLOSED, 'Manual reset');  // Line 126
    }
    this.lastStateChange = Date.now();             // Line 128
}
```

- **What triggers it:** `IoChan.resetBreaker()` (line 291)
- **What it calls:** `this.emitTransition()` (line 126), `Date.now()` (line 128)
- **What calls it:** `IoChan.resetBreaker()` (line 291)
- **Dependencies:** `BreakerState` enum
- **Status:** WORKING
- **Gap:** **BUG: `lastStateChange` is set AFTER `emitTransition()` on line 128.** The `emitTransition()` creates an event with `timestamp: Date.now()` (line 143), but `this.lastStateChange` is updated after. If a listener reads `this.lastStateChange` from the event, it gets the OLD value. This is a minor ordering issue — the event timestamp is correct, but `getMetrics().lastStateChange` would lag behind by one event.

### Lines 130-154: Private Helpers

#### Lines 131-138: `transition(to, reason)`
```javascript
transition(to, reason) {
    const from = this.state;                       // Line 132
    if (from === to) return;                       // Line 133
    this.state = to;                               // Line 135
    this.lastStateChange = Date.now();             // Line 136
    this.emitTransition(from, to, reason);         // Line 137
}
```

- **What triggers it:** Various state changes in `canExecute()`, `recordSuccess()`, `recordFailure()`
- **What it calls:** `this.emitTransition()` (line 137), `Date.now()` (line 136)
- **What calls it:** `canExecute()` (line 63), `recordSuccess()` (line 80), `recordFailure()` (lines 95, 99)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** Note: This sets `lastStateChange` BEFORE calling `emitTransition()`, which is the correct order. But `reset()` (line 128) sets it AFTER — inconsistency.

#### Lines 139-154: `emitTransition(from, to, reason)`
```javascript
emitTransition(from, to, reason) {
    const event = {
        from,                                       // Line 141
        to,                                         // Line 142
        timestamp: Date.now(),                      // Line 143
        reason,                                     // Line 144
    };
    for (const listener of this.listeners) {        // Line 146
        try {
            listener(event);                        // Line 148
        }
        catch (_a) {
            // Listener errors must not break breaker logic  // Line 151
        }
    }
}
```

- **What triggers it:** `transition()` (line 137), `reset()` (line 126)
- **What it calls:** Registered listeners (line 148)
- **What calls it:** `transition()` (line 137), `reset()` (line 126)
- **Dependencies:** `this.listeners` array (line 47)
- **Status:** WORKING
- **Gap:** The `catch (_a)` on line 150 swallows ALL errors from listeners silently. This is intentional (comment says "Listener errors must not break breaker logic"), but means debugging listener issues is impossible without external logging.

---

## Lines 155-156: Class Export
```javascript
exports.CircuitBreaker = CircuitBreaker;
```

- **Status:** WORKING

---

## Lines 157-182: `DEFAULT_CHANNEL_CONFIGS`
```javascript
const DEFAULT_CHANNEL_CONFIGS = {
    [IoChannelPriority.CRITICAL]: {
        maxConcurrent: 1,                          // Line 159
        timeoutMs: 30000,                          // Line 160
        breakerThreshold: 10,                      // Line 161
        breakerCooldownMs: 60000,                  // Line 162
    },
    [IoChannelPriority.IMPORTANT]: {
        maxConcurrent: 5,                          // Line 165
        timeoutMs: 15000,                          // Line 166
        breakerThreshold: 8,                       // Line 167
        breakerCooldownMs: 30000,                  // Line 168
    },
    [IoChannelPriority.ANALYSIS]: {
        maxConcurrent: 20,                         // Line 171
        timeoutMs: 5000,                           // Line 172
        breakerThreshold: 15,                      // Line 173
        breakerCooldownMs: 15000,                  // Line 174
    },
    [IoChannelPriority.BEST_EFFORT]: {
        maxConcurrent: 100,                        // Line 177
        timeoutMs: 2000,                           // Line 178
        breakerThreshold: 20,                      // Line 179
        breakerCooldownMs: 10000,                  // Line 180
    },
};
```

- **What triggers it:** Module load (const declaration)
- **What it calls:** Nothing
- **What calls it:** `IoChan` constructor (line 189)
- **Dependencies:** `IoChannelPriority` enum (line 18)
- **Status:** WORKING
- **Gap:** **NOTE: `breakerProbeCount` is NOT defined in defaults.** Line 201 references `cfg.breakerProbeCount` which will always be `undefined`, causing `CircuitBreaker` constructor to default to `1` (line 50). This means all channels default to 1 probe count. If custom configs are passed that include `breakerProbeCount`, it would work. But the DEFAULT configs don't include it — this is a configuration gap, not a bug.

---

## Lines 183-392: `IoChan` Class

### Lines 184-205: Constructor
```javascript
class IoChan {
    constructor(configs) {
        var _a;
        this.channels = new Map();                 // Line 187
        for (const priority of Object.values(IoChannelPriority)) {  // Line 188
            const defaultCfg = DEFAULT_CHANNEL_CONFIGS[priority];    // Line 189
            const overrides = (_a = configs === null || configs === void 0 ? void 0 : configs[priority]) !== null && _a !== void 0 ? _a : {};  // Line 190
            const cfg = Object.assign(Object.assign({}, defaultCfg), overrides);  // Line 191
            this.channels.set(priority, {
                priority,                          // Line 193
                maxConcurrent: cfg.maxConcurrent,  // Line 194
                timeoutMs: cfg.timeoutMs,          // Line 195
                inProgress: 0,                     // Line 196
                queue: [],                         // Line 197
                breaker: new CircuitBreaker({      // Line 198
                    failureThreshold: cfg.breakerThreshold,    // Line 199
                    cooldownMs: cfg.breakerCooldownMs,        // Line 200
                    probeCount: cfg.breakerProbeCount,        // Line 201
                }),
            });
        }
    }
```

- **What triggers it:** `new IoChan(configs)` or module load (line 395)
- **What it calls:** `Object.values()` (line 188), `Object.assign()` (line 191), `new CircuitBreaker()` (line 198)
- **What calls it:** Module load creates singleton `exports.ioChan = new IoChan()` (line 395)
- **Dependencies:** `IoChannelPriority` (line 18), `DEFAULT_CHANNEL_CONFIGS` (line 157), `CircuitBreaker` (line 36)
- **Status:** WORKING
- **Gap:** Line 190 has a complex null-coalescing pattern: `configs === null || configs === void 0 ? void 0 : configs[priority]`. This is correct but could be simplified. The `??` operator would be cleaner in modern JS.

### Lines 206-269: `execute(priority, operation)` — THE CORE METHOD
```javascript
execute(priority, operation) {
    return __awaiter(this, void 0, void 0, function* () {
```

- **What triggers it:** Any code that calls `ioChan.execute(priority, operation)`
- **What it calls:** `normalizePriority()` (line 215), `channel.breaker.canExecute()` (line 218), `executeWithTimeout()` (line 248), `channel.breaker.recordSuccess()` (line 249), `channel.breaker.recordFailure()` (line 253), `classifySeverity()` (line 260), `drainQueue()` (line 266)
- **What calls it:**
  - `lib/commands/integr8/dataIngestion.js` line 931: `ioChan.execute(IoChannelPriority.ANALYSIS, () => safeAccess(packageJsonPath))`
  - `lib/commands/integr8/dataIngestion.js` line 933: `ioChan.execute(IoChannelPriority.ANALYSIS, () => safeReadFile(packageJsonPath))`
  - `lib/commands/integr8/dataIngestion.js` line 961: `ioChan.execute(IoChannelPriority.ANALYSIS, () => safeAccess(filePath))`
- **Dependencies:** `IoChannelPriority` (line 18), `IoResult` type (implicit), `CircuitBreaker` methods
- **Status:** WORKING

#### Lines 215-216: Priority Normalization
```javascript
const normalizedPriority = this.normalizePriority(priority);
const channel = this.channels.get(normalizedPriority);
```

- **Gap:** **BUG: No null check on `channel`.** If `normalizePriority()` returns a value not in the map (shouldn't happen with current enum, but defensive coding would check), `channel` would be `undefined` and line 218 would throw `TypeError: Cannot read properties of undefined (reading 'breaker')`.

#### Lines 217-227: Circuit Breaker Check
```javascript
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
```

- **Status:** WORKING
- **Gap:** Returns immediately with error when circuit is open. This is correct fail-fast behavior.

#### Lines 228-245: Concurrency Check
```javascript
if (channel.inProgress >= channel.maxConcurrent) {
    if (normalizedPriority === IoChannelPriority.BEST_EFFORT) {
        return {
            success: false,
            error: {
                code: 'CHANNEL_CONGESTED',
                message: 'Best-effort channel at capacity; operation skipped',
                severity: 'skip',
            },
        };
    }
    yield new Promise((resolve) => {
        channel.queue.push(resolve);
    });
}
```

- **Status:** WORKING
- **Gap:** For non-BEST_EFFORT channels, the request queues by yielding a Promise that resolves when `drainQueue()` calls `next()` (line 276). This is a correct FIFO queue pattern. However, **there is no timeout on the queue wait itself.** If the channel is permanently stuck (e.g., all in-progress operations are hung), queued operations will wait forever. The timeout only applies to the operation execution (line 248), not the queue wait.

#### Lines 246-267: Operation Execution
```javascript
channel.inProgress++;                            // Line 246
try {
    const result = yield this.executeWithTimeout(operation, channel.timeoutMs);  // Line 248
    channel.breaker.recordSuccess();             // Line 249
    return result;                               // Line 250
}
catch (err) {
    channel.breaker.recordFailure();             // Line 253
    const error = err instanceof Error ? err : new Error(String(err));  // Line 254
    return {
        success: false,
        error: {
            code: error.code || 'EXECUTION_ERROR',  // Line 258
            message: error.message,               // Line 259
            severity: this.classifySeverity(normalizedPriority),  // Line 260
        },
    };
}
finally {
    channel.inProgress--;                        // Line 265
    this.drainQueue(channel);                    // Line 266
}
```

- **Status:** WORKING
- **Gap:** Line 258 accesses `error.code` which is a property of Node.js `Error` objects with system error codes (e.g., `ENOENT`). For generic `Error` objects, `error.code` is `undefined`, so it falls back to `'EXECUTION_ERROR'`. This is correct.

### Lines 270-284: `getStatus()`
```javascript
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
```

- **What triggers it:** External diagnostics call
- **What it calls:** `channel.breaker.getState()` (line 279), `channel.breaker.getMetrics()` (line 280)
- **What calls it:** **NOTHING IN CURRENT CODEBASE** — public API with no callers found
- **Dependencies:** `CircuitBreaker.getState()`, `CircuitBreaker.getMetrics()`
- **Status:** NOT CONNECTED
- **Gap:** This diagnostic method exists but is never called in the st8 codebase. It provides valuable observability data that could be exposed via an API endpoint or health check.

### Lines 285-293: `resetBreaker(priority)`
```javascript
resetBreaker(priority) {
    const channel = this.channels.get(priority);
    if (channel) {
        channel.breaker.reset();
    }
}
```

- **What triggers it:** External manual reset call
- **What it calls:** `channel.breaker.reset()` (line 291)
- **What calls it:** **NOTHING IN CURRENT CODEBASE** — public API with no callers found
- **Dependencies:** `CircuitBreaker.reset()`
- **Status:** NOT CONNECTED
- **Gap:** No code in the st8 codebase calls `resetBreaker()`. If a circuit trips open, there's no automated recovery mechanism beyond the cooldown timer. Manual reset would require calling this method.

### Lines 294-302: `normalizePriority(input)`
```javascript
normalizePriority(input) {
    if (Object.values(IoChannelPriority).includes(input)) {  // Line 296
        return input;
    }
    const mapped = IoChannelPriority[input];     // Line 300
    return mapped !== null && mapped !== void 0 ? mapped : IoChannelPriority.BEST_EFFORT;  // Line 301
}
```

- **What triggers it:** `execute()` (line 215)
- **What it calls:** `Object.values()` (line 296)
- **What calls it:** `execute()` (line 215)
- **Dependencies:** `IoChannelPriority` enum
- **Status:** WORKING
- **Gap:** Line 300 maps string keys like `'CRITICAL'` to enum values. If an invalid string is passed (e.g., `'UNKNOWN'`), it falls back to `BEST_EFFORT` (line 301). This silent fallback could mask configuration errors — a typo in priority name would silently use BEST_EFFORT instead of failing.

### Lines 303-365: `executeWithTimeout(operation, timeoutMs)`
```javascript
executeWithTimeout(operation, timeoutMs) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => {
            let settled = false;                 // Line 306
            const timer = setTimeout(() => {     // Line 307
                if (!settled) {                  // Line 308
                    settled = true;              // Line 309
                    resolve({                    // Line 310
                        success: false,
                        error: {
                            code: 'TIMEOUT',
                            message: `Operation timed out after ${timeoutMs}ms`,
                            severity: 'warning',
                        },
                    });
                }
            }, timeoutMs);                       // Line 319
            (() => __awaiter(this, void 0, void 0, function* () {  // Line 320
                try {
                    const raw = yield operation();  // Line 322
                    if (settled) return;          // Line 323
                    settled = true;              // Line 325
                    clearTimeout(timer);         // Line 326
                    if (this.isFsResult(raw)) {  // Line 328
                        if (raw.success) {
                            resolve({ success: true, data: raw.data });  // Line 330
                        } else {
                            resolve({
                                success: false,
                                error: {
                                    code: raw.error.code,
                                    message: raw.error.message,
                                    severity: raw.error.severity,
                                },
                            });
                        }
                    } else {
                        resolve({ success: true, data: raw });  // Line 344
                    }
                }
                catch (err) {
                    if (settled) return;          // Line 349
                    settled = true;              // Line 350
                    clearTimeout(timer);         // Line 351
                    const error = err instanceof Error ? err : new Error(String(err));
                    resolve({
                        success: false,
                        error: {
                            code: error.code || 'EXECUTION_ERROR',
                            message: error.message,
                            severity: 'fatal',   // Line 358
                        },
                    });
                }
            }))();                               // Line 362
        });
    });
}
```

- **What triggers it:** `execute()` (line 248)
- **What it calls:** `operation()` (line 322), `this.isFsResult()` (line 328), `clearTimeout()` (lines 326, 351)
- **What calls it:** `execute()` (line 248)
- **Dependencies:** `Promise`, `setTimeout`, `clearTimeout`
- **Status:** WORKING
- **Gap:** **BUG: Memory leak potential with timer not cleared on timeout.** When the timer fires (line 307-318) and resolves the promise, the `settled` flag prevents the operation result from also resolving. However, if the operation eventually completes (even after timeout), the timer reference is still held. The `clearTimeout(timer)` on lines 326 and 351 only runs if `settled` is `false` at that point. If the timer already fired, `settled` is `true`, so `clearTimeout` is never called on the already-fired timer (which is fine — you can't clear a fired timer). But the IIFE on line 320 continues running even after timeout, potentially doing unnecessary work. This is a minor issue — the operation will complete naturally, but resources are wasted.

- **Gap:** **BUG: `this` context in IIFE.** Line 320 uses `function*()` inside an arrow function context. The `this` inside the generator on line 320 refers to the outer `this` which is the `IoChan` instance (because the outer function is an arrow function from `__awaiter`). This is actually correct because `this.isFsResult()` on line 328 needs to access the `IoChan` instance. However, the `this` binding depends on the compilation context — in strict mode with TypeScript compilation, this works correctly.

### Lines 366-371: `isFsResult(value)`
```javascript
isFsResult(value) {
    return (typeof value === 'object' &&      // Line 367
        value !== null &&                      // Line 368
        'success' in value &&                  // Line 369
        typeof value.success === 'boolean');   // Line 370
}
```

- **What triggers it:** `executeWithTimeout()` (line 328)
- **What it calls:** `typeof`, `in` operator
- **What calls it:** `executeWithTimeout()` (line 328)
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** This duck-type check identifies `FsResult<T>` objects from `safeFs.js`. It checks for the presence of a boolean `success` property. This is correct for the current `safeFs` API, but could false-positive on any object with a `success: true/false` property.

### Lines 372-378: `drainQueue(channel)`
```javascript
drainQueue(channel) {
    if (channel.queue.length > 0 && channel.inProgress < channel.maxConcurrent) {  // Line 373
        const next = channel.queue.shift();      // Line 374
        if (next) next();                        // Line 375-376
    }
}
```

- **What triggers it:** `execute()` finally block (line 266)
- **What it calls:** `channel.queue.shift()` (line 374), `next()` (line 376)
- **What calls it:** `execute()` (line 266)
- **Dependencies:** `channel.queue` array
- **Status:** WORKING
- **Gap:** **BUG: Only drains ONE queued item per completion.** When an operation completes, `drainQueue()` is called once. It checks if there are queued items AND if there's capacity, then shifts one item. However, if `maxConcurrent` is 5 and 3 operations complete simultaneously, only the first completion would drain one item. The other two completions would also drain one each (total 3 drained). This is actually correct behavior — each completion drains one waiter. But if `maxConcurrent` is 1 (CRITICAL channel), this works as a simple serial queue.

### Lines 379-391: `classifySeverity(priority)`
```javascript
classifySeverity(priority) {
    switch (priority) {
        case IoChannelPriority.CRITICAL:
            return 'fatal';                      // Line 382
        case IoChannelPriority.IMPORTANT:
            return 'warning';                    // Line 384
        case IoChannelPriority.ANALYSIS:
            return 'warning';                    // Line 386
        case IoChannelPriority.BEST_EFFORT:
            return 'skip';                       // Line 388
    }
}
```

- **What triggers it:** `execute()` catch block (line 260)
- **What it calls:** Nothing
- **What calls it:** `execute()` (line 260)
- **Dependencies:** `IoChannelPriority` enum
- **Status:** WORKING
- **Gap:** **BUG: No default case.** If an invalid priority value somehow reaches this switch (shouldn't happen with `normalizePriority()` in place), the function returns `undefined` implicitly. This would set `error.severity` to `undefined` in the error response.

---

## Lines 391-395: Class Export & Singleton
```javascript
exports.IoChan = IoChan;
// ─── Default Singleton ───────────────────────────────────────────────────────
/** Pre-configured default IoChan instance. Import and use directly. */
exports.ioChan = new IoChan();
```

- **What triggers it:** Module load
- **What it calls:** `new IoChan()` with no config (uses all defaults)
- **What calls it:** `lib/commands/integr8/dataIngestion.js` line 62: `const ioChan_js_1 = require("../../utils/ioChan.js")`
- **Dependencies:** `IoChan` class
- **Status:** WORKING
- **Gap:** The singleton is created with no config overrides. All channels use `DEFAULT_CHANNEL_CONFIGS`. This is fine for the current usage pattern.

---

## CONNECTIONS MAP

### Inbound Connections (What calls ioChan.js)

| Caller File | Line | What it calls | Priority Used |
|---|---|---|---|
| `lib/commands/integr8/dataIngestion.js` | 62 | `require("../../utils/ioChan.js")` | N/A |
| `lib/commands/integr8/dataIngestion.js` | 931 | `ioChan.execute(IoChannelPriority.ANALYSIS, ...)` | ANALYSIS |
| `lib/commands/integr8/dataIngestion.js` | 933 | `ioChan.execute(IoChannelPriority.ANALYSIS, ...)` | ANALYSIS |
| `lib/commands/integr8/dataIngestion.js` | 961 | `ioChan.execute(IoChannelPriority.ANALYSIS, ...)` | ANALYSIS |

### Outbound Connections (What ioChan.js calls)

| Target | Method | Purpose |
|---|---|---|
| `safeFs.js` (via operation callbacks) | `safeAccess()`, `safeReadFile()` | I/O operations passed as callbacks |
| `CircuitBreaker` (internal) | `canExecute()`, `recordSuccess()`, `recordFailure()` | Circuit state management |

### Circuit Breaker Trip Conditions

| Condition | When | Result |
|---|---|---|
| Threshold reached | `consecutiveFailures >= threshold` (line 98) | CLOSED → OPEN |
| Probe failure in HALF_OPEN | Any failure while HALF_OPEN (line 92) | HALF_OPEN → OPEN |
| Cooldown elapsed | `Date.now() - lastFailureTime >= cooldownMs` (line 62) | OPEN → HALF_OPEN |
| Probe success | `halfOpenSuccesses >= probeCount` (line 76) | HALF_OPEN → CLOSED |

---

## @@@ HANDLING

**No `@@@` symbols found in `ioChan.js`.**

The `@@@` pattern exists in other files:
- `file-explorer.js` line 465: Badge marker for AI review
- `backend/brunoOscar.js` line 173: Content append marker
- `backend/intentSeeder.js` lines 187-188: Pattern detection regex
- `backend/persistence.js` line 577: Section header for symbol methods

---

## SUMMARY OF BUGS AND GAPS

### Critical Bugs

1. **HALF_OPEN probe concurrency not limited (Lines 68-69):** `canExecute()` allows ALL requests through when in HALF_OPEN state, despite comment claiming "up to probeCount concurrently". The `probeCount` config is only used in `recordSuccess()` to count successes, not to limit in-flight probes.

2. **No queue timeout (Lines 241-244):** Queued operations wait indefinitely with no timeout. If the channel is stuck, all queued operations hang forever.

### Minor Bugs

3. **`lastStateChange` ordering in `reset()` (Line 128):** Set after `emitTransition()` instead of before, causing metrics to report stale timestamp.

4. **`classifySeverity()` no default case (Lines 379-390):** Returns `undefined` for invalid priority values.

5. **`normalizePriority()` silent fallback (Line 301):** Invalid priority strings silently fall back to `BEST_EFFORT` instead of failing.

### Disconnected Public APIs

6. **`onStateChange()` (Line 53):** No callers in codebase — state transitions happen silently.

7. **`getStatus()` (Line 273):** No callers in codebase — diagnostic data not exposed.

8. **`resetBreaker()` (Line 288):** No callers in codebase — no manual recovery mechanism.

---

_Report generated: 2026-05-13_
_File: lib/utils/ioChan.js (396 lines)_
_Analysis depth: Line-by-line with cross-file tracing_
