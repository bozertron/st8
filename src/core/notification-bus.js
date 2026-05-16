#!/usr/bin/env node

/**
 * ST8 Notification Bus
 *
 * Event-driven notification system for file mutations.
 * - EventEmitter for in-process subscribers
 * - SSE endpoint for frontend consumers
 * - Console output as immediate feedback
 * - Delegates to SchemaCardPrinter for .txt fallback
 */

'use strict';

const { EventEmitter } = require('events');

class NotificationBus extends EventEmitter {
    constructor(options = {}) {
        super();
        this.sseClients = new Set();
        this.printer = null; // Set later via setPrinter()
        this.maxSseClients = options.maxSseClients || 10;
        // Wave 4C ticket 8: per-client SSE heartbeat interval. Real SSE
        // deployments need a periodic ping (`: heartbeat\n\n` is a SSE
        // comment, swallowed by the client parser) to keep proxies /
        // reverse-proxies / load balancers / NAT tables from killing
        // an idle TCP connection. The write-error path in the
        // heartbeat tick also catches half-open TCPs that never fire
        // 'close' or 'error' on their own (machine-sleep scenario).
        // Default 30s; tests pass a shorter value to keep wallclock
        // small. Set to 0 to disable.
        this.heartbeatMs = options.heartbeatMs != null ? options.heartbeatMs : 30000;
    }

    setPrinter(printer) {
        this.printer = printer;
    }

    /**
     * Publish a mutation event.
     * Triggers: EventEmitter → SSE → Console → Printer fallback
     */
    publish(event) {
        const enriched = {
            ...event,
            publishedAt: new Date().toISOString()
        };

        // 1. EventEmitter for in-process subscribers
        //    Wrapped in try/catch so a throwing listener does not abort
        //    the SSE broadcast, console output, and printer fallback below.
        try {
            this.emit('mutation', enriched);
            this.emit(`mutation:${event.mutationType}`, enriched);
        } catch (err) {
            console.error('[st8:notify] Subscriber listener threw:', err.message);
        }

        // 2. SSE for frontend consumers
        this._broadcastSSE(enriched);

        // 3. Console output
        const status = event.mutationType === 'EDIT' ? '✎' :
                       event.mutationType === 'CREATE' ? '+' :
                       event.mutationType === 'DELETE' ? '−' :
                       event.mutationType === 'CONCEPT' ? '◈' :
                       event.mutationType === 'LOCK' ? '⊘' :
                       event.mutationType === 'PRODUCTION' ? '★' : '·';
        console.log(`[st8:notify] ${status} ${event.filepath || event.fingerprint} — ${event.mutationType} by ${event.actor}`);

        // 4. Printer fallback (writes .txt to .planning/st8_identity_system/)
        if (this.printer && event.schemaCard) {
            try {
                this.printer.printCard(event.schemaCard);
            } catch (err) {
                console.error('[st8:notify] Printer fallback failed:', err.message);
            }
        }
    }

    // ─── SSE ──────────────────────────────────────────────────

    addSSEClient(res, options = {}) {
        if (this.sseClients.size >= this.maxSseClients) {
            res.writeHead(503);
            res.end('Too many SSE clients');
            return false;
        }

        // Use the caller-provided allowed origin instead of '*' wildcard.
        // This prevents any origin from reading the mutation event stream.
        const allowedOrigin = options.allowedOrigin || 'http://localhost:3847';

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': allowedOrigin
        });

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

        this.sseClients.add(res);

        // Wave 4C ticket 8: per-client SSE heartbeat. Schedules a
        // recurring write of `: heartbeat\n\n` (an SSE comment line,
        // parsed and discarded by EventSource) to keep proxies / NAT
        // tables from killing an idle connection AND to surface
        // half-open TCPs as broken-pipe write errors that trigger
        // cleanup. Stored on the res object (NOT on `this`) so it
        // tears down naturally when the response is destroyed.
        res._st8HeartbeatTimer = null;
        if (this.heartbeatMs > 0) {
            res._st8HeartbeatTimer = setInterval(() => {
                try {
                    res.write(`: heartbeat\n\n`);
                } catch (_) {
                    // Write failed — peer is gone. Clean up and stop
                    // the heartbeat; 'close'/'error' may also fire but
                    // we belt-and-suspenders the cleanup here.
                    this.sseClients.delete(res);
                    if (res._st8HeartbeatTimer) {
                        clearInterval(res._st8HeartbeatTimer);
                        res._st8HeartbeatTimer = null;
                    }
                }
            }, this.heartbeatMs);
            // Node would keep the event loop alive on a long-running
            // server with active heartbeats. Unref so the timer is
            // honest about its role (a passive keepalive, not a
            // process-keeper).
            if (typeof res._st8HeartbeatTimer.unref === 'function') {
                res._st8HeartbeatTimer.unref();
            }
        }

        const cleanup = () => {
            this.sseClients.delete(res);
            if (res._st8HeartbeatTimer) {
                clearInterval(res._st8HeartbeatTimer);
                res._st8HeartbeatTimer = null;
            }
        };

        res.on('close', cleanup);

        res.on('error', (err) => {
            // Socket error (network drop, client crash) — clean up and continue.
            // Without this handler, Node.js throws an uncaught 'error' exception
            // that crashes the entire server process.
            cleanup();
            try { res.end(); } catch (_) { /* already destroyed */ }
        });

        return true;
    }

    _broadcastSSE(event) {
        const data = JSON.stringify(event);
        for (const client of this.sseClients) {
            try {
                client.write(`data: ${data}\n\n`);
            } catch (err) {
                this.sseClients.delete(client);
            }
        }
    }
}

// Singleton instance
const notificationBus = new NotificationBus();

module.exports = { NotificationBus, notificationBus };
