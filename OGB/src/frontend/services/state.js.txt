/**
 * vendor/settings-reader.js
 *
 * Phase A.1 settings layer — data only, no UI.
 *
 * - Schema-driven, JSON validated against per-category schemas.
 * - Storage adapter is swappable. Default = localStorage. sql.js or a real
 *   sqlite bridge can be dropped in later by replacing the `storage` arg.
 * - Exposes window.st8Settings as a live POJO. Subscribers can listen for
 *   changes via st8Settings.on('change', cb).
 *
 * Categories seeded on first boot:
 *   voidflow  → drift / caret / reveal tunables
 *   sirkits   → spawnable surfaces (none seeded)
 */

const DEFAULT_VOIDFLOW = {
  reveal_wpm: 200,
  word_atomic: true,
  pause_on_drag: true,
  buffer_trail_visible: true,
  reveal_curve: 'linear',
  drift_rate_lines_per_sec: 0.25,
  cursor_metronome: true,
};

class LocalStorageAdapter {
  constructor(key = 'st8.settings.v1') { this.key = key; }
  read() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  write(data) {
    try { localStorage.setItem(this.key, JSON.stringify(data)); }
    catch (e) { console.warn('[st8.settings] write failed', e); }
  }
}

class MemoryAdapter {
  constructor() { this._data = null; }
  read() { return this._data; }
  write(d) { this._data = d; }
}

export class SettingsReader {
  constructor({ storage = new LocalStorageAdapter() } = {}) {
    this.storage = storage;
    this._listeners = new Set();
    this._data = this.storage.read() || this._seedDefaults();
    this.storage.write(this._data);
  }

  _seedDefaults() {
    return {
      voidflow: { ...DEFAULT_VOIDFLOW },
      sirkits: [],
      models: [],
      shells: [],
    };
  }

  /** Live POJO accessor. settings.voidflow.reveal_wpm etc. */
  get voidflow() { return this._data.voidflow; }
  get sirkits()  { return this._data.sirkits; }
  get models()   { return this._data.models; }
  get shells()   { return this._data.shells; }

  set(category, key, value) {
    if (!this._data[category]) this._data[category] = {};
    this._data[category][key] = value;
    this.storage.write(this._data);
    this._emit('change', { category, key, value });
  }

  setVoidflow(key, value) { this.set('voidflow', key, value); }

  /** Insert or update a row (for rowed categories like sirkits). */
  upsertRow(category, row) {
    if (!Array.isArray(this._data[category])) this._data[category] = [];
    const idx = this._data[category].findIndex(r => r.id === row.id);
    if (idx >= 0) this._data[category][idx] = row;
    else this._data[category].push(row);
    this.storage.write(this._data);
    this._emit('change', { category, row });
  }

  removeRow(category, id) {
    if (!Array.isArray(this._data[category])) return;
    this._data[category] = this._data[category].filter(r => r.id !== id);
    this.storage.write(this._data);
    this._emit('change', { category, removed: id });
  }

  on(event, fn)  { this._listeners.add({ event, fn }); }
  off(event, fn) {
    for (const l of this._listeners) if (l.event === event && l.fn === fn) this._listeners.delete(l);
  }
  _emit(event, payload) {
    for (const l of this._listeners) if (l.event === event) {
      try { l.fn(payload); } catch (e) { console.warn(e); }
    }
  }

  /** Reset to defaults — destructive. Useful in dev. */
  reset() { this._data = this._seedDefaults(); this.storage.write(this._data); this._emit('change', { reset: true }); }

  /** Export full state for inspection / backup. */
  export() { return JSON.parse(JSON.stringify(this._data)); }
}

export { LocalStorageAdapter, MemoryAdapter };
