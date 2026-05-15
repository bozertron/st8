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

        res.on('close', () => {
            this.sseClients.delete(res);
        });

        res.on('error', (err) => {
            // Socket error (network drop, client crash) — clean up and continue.
            // Without this handler, Node.js throws an uncaught 'error' exception
            // that crashes the entire server process.
            this.sseClients.delete(res);
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
