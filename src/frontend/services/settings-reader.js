/* ═══════════════════════════════════════════════════════════════
   ST8 SETTINGS READER — Reactive Settings Service
   ═══════════════════════════════════════════════════════════════

   Data + reactivity layer for settings, complementing the settings UI
   in src/frontend/components/settings/settings.js.

   Responsibilities:
     - Read/write settings via a swappable storage adapter
       (BackendAdapter hits /api/settings; MemoryAdapter is for tests).
     - Notify subscribers on every successful persist, so other
       surfaces can react without polling.

   Non-responsibilities:
     - This module does NOT own defaults, schemas, migrations, or
       coercion. Those live in settings.js (single source of truth).
       This avoids the silent-divergence risk that retired the
       pre-refactor version (see index.html load-order comment).

   Public API: window.St8SettingsReader
       loadAll()                 — Promise<{ status, data }>
       persist(category, k, v)   — Promise<boolean>  (true on 2xx)
       addListener(cb)           — cb({ category, key, value })
       removeListener(cb)
       setAdapter(adapter)       — swap storage (default BackendAdapter)
       getAdapter()              — current adapter (for inspection)

   ═══════════════════════════════════════════════════════════════ */

'use strict';

(function () {
    // ─── ADAPTERS ────────────────────────────────────────────

    // BackendAdapter: the production storage. Talks to /api/settings,
    // which validates against the canonical category list and writes
    // to the SQLite st8_settings table. The 8KB cap + enum/type
    // validation is enforced server-side; this adapter just reports
    // success/failure as a boolean (callers handle revert).
    function BackendAdapter() {}
    BackendAdapter.prototype.loadAll = function () {
        return fetch('/api/settings').then(function (res) {
            if (!res.ok) throw new Error('Failed to load settings: ' + res.status);
            return res.json();
        });
    };
    BackendAdapter.prototype.persist = function (category, key, value) {
        return fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: category, key: key, value: value })
        }).then(function (res) {
            return !!res.ok;
        });
    };

    // MemoryAdapter: deterministic in-memory storage for tests.
    // Mirrors the BackendAdapter contract (loadAll returns the same
    // {status,data} envelope as /api/settings). No persistence
    // across instances — construct one per test.
    function MemoryAdapter(seed) {
        this._data = seed ? JSON.parse(JSON.stringify(seed)) : {};
    }
    MemoryAdapter.prototype.loadAll = function () {
        var data = this._data;
        return Promise.resolve({ status: 'ok', data: JSON.parse(JSON.stringify(data)) });
    };
    MemoryAdapter.prototype.persist = function (category, key, value) {
        if (!this._data[category]) this._data[category] = {};
        if (Array.isArray(this._data[category]) || Array.isArray(value)) {
            // Array categories (sirkits, models, shells, keybindings)
            // are persisted as the WHOLE array under a sentinel key,
            // matching the backend's array-category shape.
            this._data[category] = value;
        } else {
            this._data[category][key] = value;
        }
        return Promise.resolve(true);
    };
    MemoryAdapter.prototype._dump = function () {
        // Test inspector. Not part of the adapter contract.
        return JSON.parse(JSON.stringify(this._data));
    };

    // ─── READER ──────────────────────────────────────────────

    var listeners = new Set();
    var adapter = new BackendAdapter();

    function loadAll() {
        return adapter.loadAll();
    }

    function persist(category, key, value) {
        return adapter.persist(category, key, value).then(function (ok) {
            if (ok) {
                // Emit AFTER successful persist. A failed persist
                // does not emit — settings.js reverts the in-memory
                // state on its own and re-renders, so subscribers
                // would only see noise. The "what should listeners
                // see" contract is: every observed change is durable.
                _emit({ category: category, key: key, value: value });
            }
            return ok;
        }).catch(function (err) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[st8.settings-reader] persist error:', err && err.message);
            }
            return false;
        });
    }

    function addListener(cb) {
        if (typeof cb === 'function') listeners.add(cb);
    }
    function removeListener(cb) {
        listeners.delete(cb);
    }
    function _emit(payload) {
        listeners.forEach(function (cb) {
            try { cb(payload); }
            catch (e) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[st8.settings-reader] listener threw:', e && e.message);
                }
            }
        });
    }

    function setAdapter(next) {
        adapter = next;
    }
    function getAdapter() {
        return adapter;
    }

    // ─── PUBLIC API ──────────────────────────────────────────

    window.St8SettingsReader = {
        loadAll: loadAll,
        persist: persist,
        addListener: addListener,
        removeListener: removeListener,
        setAdapter: setAdapter,
        getAdapter: getAdapter,
        // Adapter constructors exposed so tests / advanced callers
        // can construct fresh ones without re-implementing the
        // shape. Not for everyday use.
        BackendAdapter: BackendAdapter,
        MemoryAdapter: MemoryAdapter
    };
}());
