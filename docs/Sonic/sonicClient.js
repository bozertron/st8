"use strict";
/**
 * SonicClient - Lightweight TCP client for Sonic search backend
 *
 * Implements the Sonic Channel protocol directly (no external dependencies).
 * Manages separate connections for search and ingest modes as Sonic requires.
 *
 * Protocol reference: https://github.com/valeriansaliou/sonic/blob/master/PROTOCOL.md
 */
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
exports.sonicClient = exports.SonicClient = void 0;
const net = __importStar(require("net"));
// --- Sonic Channel Connection ---
class SonicChannel {
    constructor(options) {
        this.connection = null;
        this.pendingCommands = [];
        this.eventHandlers = new Map();
        this.dataBuffer = '';
        this.connecting = false;
        this.options = Object.assign({ connectTimeout: 5000, commandTimeout: 10000 }, options);
    }
    /** Connect to Sonic and start the specified mode */
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if ((_a = this.connection) === null || _a === void 0 ? void 0 : _a.ready)
                return;
            if (this.connecting)
                return;
            this.connecting = true;
            try {
                const socket = yield this.createConnection();
                // Read CONNECTED banner
                const banner = yield this.readLine(socket);
                if (!banner.startsWith('CONNECTED')) {
                    socket.destroy();
                    throw new Error(`Unexpected banner: ${banner}`);
                }
                // Send START command
                socket.write(`START ${this.options.mode} ${this.options.password}\n`);
                const started = yield this.readLine(socket);
                if (!started.startsWith('STARTED')) {
                    socket.destroy();
                    throw new Error(`Failed to start ${this.options.mode} mode: ${started}`);
                }
                // Parse buffer size from STARTED response
                const bufferMatch = started.match(/buffer\((\d+)\)/);
                const buffer = bufferMatch ? parseInt(bufferMatch[1], 10) : 20000;
                this.connection = { socket, mode: this.options.mode, buffer, ready: true };
                // Set up data listener for async events
                socket.on('data', (data) => this.handleData(data.toString()));
                socket.on('error', () => this.handleDisconnect());
                socket.on('close', () => this.handleDisconnect());
            }
            finally {
                this.connecting = false;
            }
        });
    }
    /** Disconnect from Sonic */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.connection)
                return;
            try {
                this.connection.socket.write('QUIT\n');
                yield new Promise((resolve) => {
                    this.connection.socket.once('close', resolve);
                    setTimeout(() => {
                        var _a;
                        (_a = this.connection) === null || _a === void 0 ? void 0 : _a.socket.destroy();
                        resolve();
                    }, 1000);
                });
            }
            catch (_b) {
                (_a = this.connection) === null || _a === void 0 ? void 0 : _a.socket.destroy();
            }
            finally {
                this.connection = null;
                this.pendingCommands.forEach((cmd) => {
                    clearTimeout(cmd.timer);
                    cmd.reject(new Error('Connection closed'));
                });
                this.pendingCommands = [];
            }
        });
    }
    /** Check if connection is alive */
    isConnected() {
        var _a, _b;
        return (_b = (_a = this.connection) === null || _a === void 0 ? void 0 : _a.ready) !== null && _b !== void 0 ? _b : false;
    }
    /** Send PING and verify PONG response */
    ping() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.sendCommand('PING');
                return response === 'PONG';
            }
            catch (_a) {
                return false;
            }
        });
    }
    /** Send a command and wait for synchronous response (OK, RESULT, ERR) */
    sendCommand(command) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!((_a = this.connection) === null || _a === void 0 ? void 0 : _a.ready)) {
                throw new Error('Not connected to Sonic');
            }
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const idx = this.pendingCommands.findIndex((c) => c.timer === timer);
                    if (idx >= 0)
                        this.pendingCommands.splice(idx, 1);
                    reject(new Error(`Command timeout: ${command}`));
                }, this.options.commandTimeout);
                this.pendingCommands.push({ resolve, reject, timer });
                this.connection.socket.write(`${command}\n`);
            });
        });
    }
    /**
     * Send a command that returns results via EVENT (async pattern).
     * QUERY and SUGGEST use this pattern: PENDING marker -> EVENT TYPE marker results
     */
    sendEventCommand(command) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!((_a = this.connection) === null || _a === void 0 ? void 0 : _a.ready)) {
                throw new Error('Not connected to Sonic');
            }
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`Event command timeout: ${command}`));
                }, this.options.commandTimeout);
                // First we get PENDING <marker>
                const pendingHandler = {
                    resolve: (response) => {
                        if (response.startsWith('PENDING')) {
                            const marker = response.split(' ')[1];
                            // Now wait for EVENT with this marker
                            this.eventHandlers.set(marker, (eventData) => {
                                clearTimeout(timer);
                                this.eventHandlers.delete(marker);
                                // Parse results: "EVENT QUERY marker id1 id2 id3"
                                const parts = eventData.split(' ');
                                // Skip "EVENT", type, and marker — rest are results
                                const results = parts.slice(3).filter((p) => p.length > 0);
                                resolve(results);
                            });
                        }
                        else if (response.startsWith('ERR')) {
                            clearTimeout(timer);
                            reject(new Error(response));
                        }
                        else {
                            clearTimeout(timer);
                            resolve([]);
                        }
                    },
                    reject: (err) => {
                        clearTimeout(timer);
                        reject(err);
                    },
                    timer,
                };
                this.pendingCommands.push(pendingHandler);
                this.connection.socket.write(`${command}\n`);
            });
        });
    }
    // --- Private helpers ---
    createConnection() {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error('Connection timeout'));
            }, this.options.connectTimeout);
            socket.connect(this.options.port, this.options.host, () => {
                clearTimeout(timeout);
                resolve(socket);
            });
            socket.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    readLine(socket) {
        return new Promise((resolve, reject) => {
            let buffer = '';
            const timeout = setTimeout(() => {
                socket.removeAllListeners('data');
                reject(new Error('Read timeout'));
            }, this.options.connectTimeout);
            const onData = (data) => {
                buffer += data.toString();
                const newlineIdx = buffer.indexOf('\n');
                if (newlineIdx >= 0) {
                    clearTimeout(timeout);
                    socket.removeListener('data', onData);
                    resolve(buffer.substring(0, newlineIdx).trim());
                }
            };
            socket.on('data', onData);
        });
    }
    handleData(data) {
        this.dataBuffer += data;
        let newlineIdx;
        while ((newlineIdx = this.dataBuffer.indexOf('\n')) >= 0) {
            const line = this.dataBuffer.substring(0, newlineIdx).trim();
            this.dataBuffer = this.dataBuffer.substring(newlineIdx + 1);
            if (line.length === 0)
                continue;
            if (line.startsWith('EVENT')) {
                // Async event response: EVENT TYPE marker [results...]
                const parts = line.split(' ');
                const marker = parts.length >= 3 ? parts[2] : '';
                const handler = this.eventHandlers.get(marker);
                if (handler) {
                    handler(line);
                }
            }
            else {
                // Synchronous response (PONG, OK, RESULT, PENDING, ERR)
                const pending = this.pendingCommands.shift();
                if (pending) {
                    clearTimeout(pending.timer);
                    pending.resolve(line);
                }
            }
        }
    }
    handleDisconnect() {
        if (this.connection) {
            this.connection.ready = false;
            this.connection = null;
        }
        // Reject all pending commands
        this.pendingCommands.forEach((cmd) => {
            clearTimeout(cmd.timer);
            cmd.reject(new Error('Connection lost'));
        });
        this.pendingCommands = [];
        this.eventHandlers.clear();
    }
}
// --- Main SonicClient Class ---
class SonicClient {
    constructor(options) {
        var _a, _b, _c;
        this.host = (_a = options === null || options === void 0 ? void 0 : options.host) !== null && _a !== void 0 ? _a : '::1';
        this.port = (_b = options === null || options === void 0 ? void 0 : options.port) !== null && _b !== void 0 ? _b : 1491;
        this.password = (_c = options === null || options === void 0 ? void 0 : options.password) !== null && _c !== void 0 ? _c : 'maestro_scaffolder_key';
        this.searchChannel = new SonicChannel({
            host: this.host,
            port: this.port,
            password: this.password,
            mode: 'search',
        });
        this.ingestChannel = new SonicChannel({
            host: this.host,
            port: this.port,
            password: this.password,
            mode: 'ingest',
        });
        this.controlChannel = new SonicChannel({
            host: this.host,
            port: this.port,
            password: this.password,
            mode: 'control',
        });
    }
    // --- Connection Lifecycle ---
    /** Connect both search and ingest channels */
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield Promise.all([
                    this.searchChannel.connect(),
                    this.ingestChannel.connect(),
                ]);
            }
            catch (err) {
                // Graceful fallback: log warning but don't crash
                console.warn('[SonicClient] Failed to connect:', err.message);
            }
        });
    }
    /** Disconnect all channels */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.allSettled([
                this.searchChannel.disconnect(),
                this.ingestChannel.disconnect(),
                this.controlChannel.disconnect(),
            ]);
        });
    }
    /** Check if Sonic is reachable and responding */
    isHealthy() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.searchChannel.ping();
            }
            catch (_a) {
                return false;
            }
        });
    }
    // --- Search Methods ---
    /**
     * Query the Sonic index for matching object IDs
     * @param collection - Index collection (e.g., "codebase")
     * @param bucket - Bucket within collection (e.g., "default")
     * @param terms - Search terms
     * @param limit - Max results to return
     * @returns Array of matching object IDs
     */
    query(collection, bucket, terms, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.searchChannel.isConnected()) {
                    yield this.searchChannel.connect();
                }
                const escapedTerms = this.escapeText(terms);
                const limitStr = limit ? ` LIMIT(${limit})` : '';
                const cmd = `QUERY ${collection} ${bucket} "${escapedTerms}"${limitStr}`;
                return yield this.searchChannel.sendEventCommand(cmd);
            }
            catch (err) {
                console.warn('[SonicClient] Query failed:', err.message);
                return []; // Graceful fallback
            }
        });
    }
    /**
     * Get auto-complete suggestions for a word prefix
     * @param collection - Index collection
     * @param bucket - Bucket within collection
     * @param prefix - Word prefix to auto-complete
     * @param limit - Max suggestions to return
     * @returns Array of suggested complete words
     */
    suggest(collection, bucket, prefix, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.searchChannel.isConnected()) {
                    yield this.searchChannel.connect();
                }
                const escapedPrefix = this.escapeText(prefix);
                const limitStr = limit ? ` LIMIT(${limit})` : '';
                const cmd = `SUGGEST ${collection} ${bucket} "${escapedPrefix}"${limitStr}`;
                return yield this.searchChannel.sendEventCommand(cmd);
            }
            catch (err) {
                console.warn('[SonicClient] Suggest failed:', err.message);
                return []; // Graceful fallback
            }
        });
    }
    // --- Index Methods ---
    /**
     * Push text to the Sonic index for an object
     * @param collection - Index collection
     * @param bucket - Bucket within collection
     * @param objectId - External object identifier
     * @param text - Text to index
     * @returns true if push was acknowledged
     */
    push(collection, bucket, objectId, text) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.ingestChannel.isConnected()) {
                    yield this.ingestChannel.connect();
                }
                const escapedText = this.escapeText(text);
                const cmd = `PUSH ${collection} ${bucket} ${objectId} "${escapedText}"`;
                const response = yield this.ingestChannel.sendCommand(cmd);
                return response === 'OK';
            }
            catch (err) {
                console.warn('[SonicClient] Push failed:', err.message);
                return false; // Graceful fallback
            }
        });
    }
    /**
     * Pop (remove) text from the Sonic index for an object
     * @param collection - Index collection
     * @param bucket - Bucket within collection
     * @param objectId - External object identifier
     * @param text - Text to remove from index
     * @returns Number of words removed
     */
    pop(collection, bucket, objectId, text) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.ingestChannel.isConnected()) {
                    yield this.ingestChannel.connect();
                }
                const escapedText = this.escapeText(text);
                const cmd = `POP ${collection} ${bucket} ${objectId} "${escapedText}"`;
                const response = yield this.ingestChannel.sendCommand(cmd);
                const match = response.match(/RESULT (\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            }
            catch (err) {
                console.warn('[SonicClient] Pop failed:', err.message);
                return 0; // Graceful fallback
            }
        });
    }
    /**
     * Flush indexed data
     * @param collection - Index collection to flush
     * @param bucket - Optional bucket to flush (flushes entire collection if omitted)
     * @returns Number of items flushed
     */
    flush(collection, bucket) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.ingestChannel.isConnected()) {
                    yield this.ingestChannel.connect();
                }
                let cmd;
                if (bucket) {
                    cmd = `FLUSHB ${collection} ${bucket}`;
                }
                else {
                    cmd = `FLUSHC ${collection}`;
                }
                const response = yield this.ingestChannel.sendCommand(cmd);
                const match = response.match(/RESULT (\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            }
            catch (err) {
                console.warn('[SonicClient] Flush failed:', err.message);
                return 0; // Graceful fallback
            }
        });
    }
    /**
     * Flush all indexed data for a specific object within a bucket
     * @param collection - Index collection
     * @param bucket - Bucket within collection
     * @param objectId - Object to flush
     * @returns Number of items flushed
     */
    flushObject(collection, bucket, objectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.ingestChannel.isConnected()) {
                    yield this.ingestChannel.connect();
                }
                const cmd = `FLUSHO ${collection} ${bucket} ${objectId}`;
                const response = yield this.ingestChannel.sendCommand(cmd);
                const match = response.match(/RESULT (\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            }
            catch (err) {
                console.warn('[SonicClient] FlushObject failed:', err.message);
                return 0;
            }
        });
    }
    // --- Control Methods ---
    /**
     * Trigger FST consolidation (makes new words available in SUGGEST)
     */
    consolidate() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.controlChannel.isConnected()) {
                    yield this.controlChannel.connect();
                }
                const response = yield this.controlChannel.sendCommand('TRIGGER consolidate');
                return response === 'OK';
            }
            catch (err) {
                console.warn('[SonicClient] Consolidate failed:', err.message);
                return false;
            }
        });
    }
    /**
     * Get Sonic server info
     */
    info() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.controlChannel.isConnected()) {
                    yield this.controlChannel.connect();
                }
                return yield this.controlChannel.sendCommand('INFO');
            }
            catch (err) {
                console.warn('[SonicClient] Info failed:', err.message);
                return '';
            }
        });
    }
    // --- Utility ---
    /** Escape text for Sonic protocol (internal quotes) */
    escapeText(text) {
        return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
    }
}
exports.SonicClient = SonicClient;
// --- Singleton Instance ---
/** Default SonicClient instance configured for local Maestro Scaffolder use */
exports.sonicClient = new SonicClient({
    host: '::1',
    port: 1491,
    password: 'maestro_scaffolder_key',
});
exports.default = SonicClient;
//# sourceMappingURL=sonicClient.js.map