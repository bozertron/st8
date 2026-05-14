#!/usr/bin/env node

/**
 * Bruno & Oscar — Automatic File Lifecycle Management
 *
 * Bruno scans for stale files (unaccessed for N sessions).
 * Oscar archives flagged files and manages expiry dates.
 */

'use strict';

class BrunoOscar {
    constructor(persistence, notificationBus) {
        this.persistence = persistence;
        this.notificationBus = notificationBus;
        this.STALE_THRESHOLD = 5;
        this.GRACE_PERIOD = 7;
    }

    /**
     * Run Bruno's Call — scan for stale files and flag them.
     * Called on every session start.
     */
    runBrunoCall(threshold) {
        const t = threshold || this.STALE_THRESHOLD;
        const staleFiles = this.persistence.getStaleFiles(t);
        const flagged = [];

        for (const file of staleFiles) {
            try {
                this.persistence.updateFileLifecycle(file.filepath, {
                    brunoStatus: 'flagged'
                });

                this.notificationBus.publish({
                    fingerprint: file.fingerprint,
                    filepath: file.filepath,
                    mutationType: 'BRUNO_CALL',
                    actor: 'BRUNO',
                    sessionsSinceAccess: file.sessionsSinceAccess
                });

                flagged.push({
                    filepath: file.filepath,
                    sessionsSinceAccess: file.sessionsSinceAccess
                });
            } catch (err) {
                console.error(`[bruno] Failed to flag ${file.filepath}:`, err.message);
            }
        }

        if (flagged.length > 0) {
            console.log(`[bruno] Flagged ${flagged.length} stale files for review`);
        }

        return {
            status: 'ok',
            flaggedFiles: flagged.length,
            files: flagged
        };
    }

    /**
     * Archive flagged files to Oscar's House.
     * Files will be auto-deleted after grace period.
     */
    runOscarHouse(gracePeriod) {
        const gp = gracePeriod || this.GRACE_PERIOD;
        const flaggedStmt = this.persistence.db.prepare(
            "SELECT * FROM file_registry WHERE brunoStatus = 'flagged'"
        );
        const flaggedFiles = flaggedStmt.all();
        const archived = [];

        for (const file of flaggedFiles) {
            try {
                this.persistence.archiveFile(file.filepath);
                this.persistence.setExpiryDate(file.filepath, gp);

                this.notificationBus.publish({
                    fingerprint: file.fingerprint,
                    filepath: file.filepath,
                    mutationType: 'ARCHIVE',
                    actor: 'OSCAR',
                    expiryDate: new Date(Date.now() + gp * 86400000).toISOString()
                });

                archived.push({
                    filepath: file.filepath,
                    expiryDate: new Date(Date.now() + gp * 86400000).toISOString()
                });
            } catch (err) {
                console.error(`[oscar] Failed to archive ${file.filepath}:`, err.message);
            }
        }

        if (archived.length > 0) {
            console.log(`[oscar] Archived ${archived.length} files to Oscar's House`);
        }

        return {
            status: 'ok',
            archivedFiles: archived.length,
            files: archived
        };
    }

    /**
     * Set an event trigger on a file.
     * When the event occurs, the file will be un-archived.
     */
    setEventTrigger(filepath, event) {
        this.persistence.updateFileLifecycle(filepath, {
            eventTrigger: event
        });
        console.log(`[bruno] Event trigger set on ${filepath}: ${event}`);
        return true;
    }

    /**
     * Handle an event being triggered.
     * Un-archives files with matching event triggers.
     */
    onEventTriggered(event) {
        const stmt = this.persistence.db.prepare(
            'SELECT * FROM file_registry WHERE eventTrigger = ?'
        );
        const files = stmt.all(event);

        for (const file of files) {
            try {
                this.persistence.updateFileLifecycle(file.filepath, {
                    brunoStatus: 'active',
                    sessionsSinceAccess: 0,
                    eventTrigger: null
                });

                this.notificationBus.publish({
                    fingerprint: file.fingerprint,
                    filepath: file.filepath,
                    mutationType: 'UNARCHIVE',
                    actor: 'BRUNO',
                    triggeredBy: event
                });

                console.log(`[bruno] Un-archived ${file.filepath} (triggered by: ${event})`);
            } catch (err) {
                console.error(`[bruno] Failed to un-archive ${file.filepath}:`, err.message);
            }
        }

        return {
            status: 'ok',
            unarchivedFiles: files.length
        };
    }

    /**
     * Append stale file content to its parent with ??? flag.
     * Called when archiving a file that has an associated parent.
     */
    _appendToParent(file) {
        if (!file.associatedWith) return false;

        const fs = require('fs');
        const path = require('path');

        try {
            const parentPath = path.resolve(file.associatedWith);
            if (!fs.existsSync(parentPath)) return false;

            const content = fs.readFileSync(file.filepath, 'utf-8');
            const appendText = `\n\n<!-- @@@ Content from ${path.basename(file.filepath)} — APPENDED BY OSCAR @@@ -->\n${content}\n`;

            fs.appendFileSync(parentPath, appendText);
            console.log(`[oscar] Appended ${file.filepath} to parent: ${file.associatedWith}`);
            return true;
        } catch (err) {
            console.error(`[oscar] Failed to append ${file.filepath}:`, err.message);
            return false;
        }
    }
}

module.exports = { BrunoOscar };
