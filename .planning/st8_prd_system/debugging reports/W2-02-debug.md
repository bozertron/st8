# W2-02 Debug Report — schemaCardEmitter.js

**Date:** 2026-05-13
**Issues:** WR-01, WR-02
**File:** `backend/schemaCardEmitter.js`

---

## WR-01: Direct persistence.db access

**Root cause:** `emitAllCards()` bypassed the persistence abstraction layer by calling `persistence.db.prepare()` directly with raw SQL queries to fetch connection data (lines 123-131).

**Fix:** Replaced the two direct `db.prepare()` SQL queries with a single call to `persistence.getConnectionsForFile(file.fingerprint)`, then filtered/mapped the results to build `importedBy` and `imports` arrays.

**Before:**
```javascript
const importedByStmt = persistence.db.prepare(
    'SELECT sourceFingerprint FROM connections WHERE targetFingerprint = ?'
);
const importsStmt = persistence.db.prepare(
    'SELECT targetFingerprint FROM connections WHERE sourceFingerprint = ?'
);
const importedBy = importedByStmt.all(file.fingerprint).map(r => r.sourceFingerprint);
const imports = importsStmt.all(file.fingerprint).map(r => r.targetFingerprint);
```

**After:**
```javascript
const allConnections = persistence.getConnectionsForFile(file.fingerprint);
const connections = {
    importedBy: allConnections.filter(c => c.targetFingerprint === file.fingerprint).map(c => c.sourceFingerprint),
    imports: allConnections.filter(c => c.sourceFingerprint === file.fingerprint).map(c => c.targetFingerprint)
};
```

**Why this matters:** Direct DB access couples the emitter to SQLite internals. If persistence migrates to a different storage backend, the emitter breaks. The `getConnectionsForFile()` API is the contract.

---

## WR-02: Extra fields in intent

**Root cause:** `persistence.getAllIntents()` returns raw DB rows which include `authoredBy` and `lastUpdated` fields. These were passed straight through to `emitCard()` and written into the schema card, even though `St8SchemaCard.intent` only defines 3 canonical fields: `purpose`, `dependsOnBehavior`, `valueStatement`.

**Fix:** Added explicit field picking after retrieving the raw intent object, selecting only the 3 canonical fields with empty-string defaults.

**Before:**
```javascript
const intent = allIntents[file.fingerprint] || null;
```

**After:**
```javascript
const rawIntent = allIntents[file.fingerprint] || null;
const intent = rawIntent ? {
    purpose: rawIntent.purpose || '',
    dependsOnBehavior: rawIntent.dependsOnBehavior || '',
    valueStatement: rawIntent.valueStatement || ''
} : null;
```

**Why this matters:** Schema cards are a deterministic, machine-readable contract. Extra DB fields leaking into the JSON create non-deterministic diffs and break the `St8SchemaCard` type shape. This also mirrors the defensive pattern already used for `lastMutation` (line 125) where SQLite row shape is mapped to schema card shape.

---

## Verification

Both changes are internal refactors with identical external behavior:
- WR-01: Same connection data returned, sourced from the same underlying table via the persistence API.
- WR-02: Same 3 canonical fields, now with consistent empty-string defaults; extra DB fields no longer leak.
