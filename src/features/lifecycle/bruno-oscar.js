#!/usr/bin/env node

/**
 * Bruno & Oscar — Automatic File Lifecycle Management
 *
 * Bruno scans for stale files (unaccessed for N sessions).
 * Oscar archives flagged files and manages expiry dates.
 */

'use strict';

// Lazy-required so a test or alt-config can construct BrunoOscar without
// pulling the hook-registry singleton. Required at first publish call.
let _hookRegistryCache = null;
function _getHookRegistry() {
    if (_hookRegistryCache) return _hookRegistryCache;
    try {
        _hookRegistryCache = require('../../core/hook-registry');
    } catch (err) {
        console.warn('[bruno-oscar] hook-registry unavailable:', err.message);
        _hookRegistryCache = null;
    }
    return _hookRegistryCache;
}

class BrunoOscar {
    constructor(persistence, notificationBus) {
        this.persistence = persistence;
        this.notificationBus = notificationBus;
        this.STALE_THRESHOLD = 5;
        this.GRACE_PERIOD = 7;
    }

    /**
     * Fire HOOKS.LIFECYCLE_TRANSITION for a brunoStatus transition.
     * Lazy-require + try/catch keeps the hook fire from blocking the
     * primary brunoStatus mutation if the registry is somehow broken.
     * Wave 4B ticket 10.
     */
    async _fireLifecycleTransition(file, oldPhase, newPhase) {
        try {
            const reg = _getHookRegistry();
            if (!reg) return;
            const { hookRegistry, HOOKS } = reg;
            await hookRegistry.execute(HOOKS.LIFECYCLE_TRANSITION, {
                file: { fingerprint: file.fingerprint, filepath: file.filepath },
                oldPhase,
                newPhase,
            });
        } catch (err) {
            console.error(`[bruno-oscar] LIFECYCLE_TRANSITION fire failed (${oldPhase}->${newPhase}):`, err.message);
        }
    }

    /**
     * Run Bruno's Call — scan for stale files and flag them.
     * Wired as a HOOKS.INDEX_START subscriber in default-subscribers.js
     * so it fires on every session start (Wave 4B ticket 9). Also
     * callable directly via POST /api/bruno-call.
     *
     * Async because each transition fires HOOKS.LIFECYCLE_TRANSITION
     * (Wave 4B ticket 10) which awaits subscribers.
     */
    async runBrunoCall(threshold) {
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

                // Wave 4B ticket 10: fire LIFECYCLE_TRANSITION for the
                // active → flagged brunoStatus change. The hook header in
                // hook-registry.js explicitly reserves this for "bruno+oscar
                // territory."
                await this._fireLifecycleTransition(file, 'active', 'flagged');

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
     *
     * Async because each archive fires HOOKS.LIFECYCLE_TRANSITION
     * (Wave 4B ticket 10) which awaits subscribers.
     */
    async runOscarHouse(gracePeriod) {
        const gp = gracePeriod || this.GRACE_PERIOD;
        const flaggedStmt = this.persistence.db.prepare(
            "SELECT * FROM file_registry WHERE brunoStatus = 'flagged'"
        );
        const flaggedFiles = flaggedStmt.all();
        const archived = [];

        for (const file of flaggedFiles) {
            try {
                // Wave 4B ticket 11: if the flagged file has an `associatedWith`
                // parent on disk, fold the child's content into the parent BEFORE
                // archive. The append is best-effort — a missing parent or read
                // error logs and continues with archive (the "fold" is a courtesy,
                // not an archive prerequisite). Returns false silently when
                // associatedWith is unset, so files without a parent take the
                // identical archive path as before.
                this._appendToParent(file);

                this.persistence.archiveFile(file.filepath);
                this.persistence.setExpiryDate(file.filepath, gp);

                this.notificationBus.publish({
                    fingerprint: file.fingerprint,
                    filepath: file.filepath,
                    mutationType: 'ARCHIVE',
                    actor: 'OSCAR',
                    expiryDate: new Date(Date.now() + gp * 86400000).toISOString()
                });

                // Wave 4B ticket 10: fire LIFECYCLE_TRANSITION for the
                // flagged → archived brunoStatus change.
                await this._fireLifecycleTransition(file, 'flagged', 'archived');

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
     *
     * Async because each un-archive fires HOOKS.LIFECYCLE_TRANSITION
     * (Wave 4B ticket 10) — the inverse of runOscarHouse's flagged→archived.
     */
    async onEventTriggered(event) {
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

                // Wave 4B ticket 10: fire LIFECYCLE_TRANSITION for the
                // archived → active brunoStatus change (file may also
                // have been 'flagged' if event triggered before oscar
                // ran, but the un-archive path is the same).
                await this._fireLifecycleTransition(file, 'archived', 'active');

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
