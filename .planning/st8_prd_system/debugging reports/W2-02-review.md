# W2-02 Code Review: Connections Query in Schema Card Emitter

**File:** `backend/schemaCardEmitter.js`
**Reviewed:** 2026-05-13
**Depth:** standard
**Status:** issues_found

---

## Summary

The connection query implementation at lines 122-131 correctly replaces the TODO stub with actual `connections` table queries. The SQL column names match the schema, the result mapping is correct, and the output flows into the schema card in the expected `{ importedBy, imports }` shape. Syntax check passes.

However, two issues were found: one runtime crash risk when the maestro `DatabasePersister` path is used, and one data quality issue where extra fields leak into the schema card JSON output.

---

## Connection Query Verification

| Check | Status | Detail |
|-------|--------|--------|
| Column names match schema | ✅ | `sourceFingerprint`, `targetFingerprint` match `connections` table (persistence.js:64-76) |
| Query semantics correct | ✅ | `WHERE targetFingerprint = ?` → importedBy; `WHERE sourceFingerprint = ?` → imports |
| Indexes used | ✅ | Both columns have indexes (`idx_connections_source`, `idx_connections_target`) |
| Result mapping correct | ✅ | `.map(r => r.sourceFingerprint)` and `.map(r => r.targetFingerprint)` extract the right columns |
| Output shape matches type | ✅ | `{ importedBy, imports }` matches `St8SchemaCard.connections` |
| Downstream consumer compatible | ✅ | `schemaCardPrinter.js` reads `card.connections.importedBy` and `.imports` — format matches |
| Error handling in place | ✅ | Outer try/catch at line 138 catches runtime query errors |

---

## Warnings

### WR-01: Direct `persistence.db` access bypasses abstraction — may crash with DatabasePersister

**File:** `backend/schemaCardEmitter.js:123-128`
**Severity:** WARNING

The code accesses `persistence.db.prepare()` directly, reaching past the persistence abstraction layer.

`persistence.db` can be either:
1. A `better-sqlite3` `Database` instance (has `.prepare()`) — **works**
2. A maestro `DatabasePersister` instance (may NOT have `.prepare()`) — **may crash**

From `persistence.js:138-148`:
```javascript
if (DatabasePersister && typeof DatabasePersister === 'function') {
    this.db = new DatabasePersister(this.dbPath);  // ← different API
} else {
    const Database = require('better-sqlite3');
    this.db = new Database(this.dbPath);  // ← has .prepare()
}
```

The persistence layer already provides a proper abstraction method at `persistence.js:257`:
```javascript
getConnectionsForFile(fingerprint) {
    const stmt = this.db.prepare(
        'SELECT * FROM connections WHERE sourceFingerprint = ? OR targetFingerprint = ?'
    );
    return stmt.all(fingerprint, fingerprint);
}
```

**Fix:** Use the persistence API instead of reaching into `.db` directly:

```javascript
// Replace lines 122-131 with:
const rawConnections = persistence.getConnectionsForFile(file.fingerprint);
const importedBy = rawConnections
    .filter(r => r.targetFingerprint === file.fingerprint)
    .map(r => r.sourceFingerprint);
const imports = rawConnections
    .filter(r => r.sourceFingerprint === file.fingerprint)
    .map(r => r.targetFingerprint);
const connections = { importedBy, imports };
```

---

### WR-02: Extra non-canonical fields leak into schema card `intent` object

**File:** `backend/schemaCardEmitter.js:112` + `schemaCardEmitter.js:59`
**Severity:** WARNING

`persistence.getAllIntents()` returns objects with 5 fields (persistence.js:289-295):
```javascript
{
    purpose: row.purpose || '',
    dependsOnBehavior: row.dependsOnBehavior || '',
    valueStatement: row.valueStatement || '',
    authoredBy: row.authoredBy || 'INFERRED',   // ← extra
    lastUpdated: row.lastUpdated                  // ← extra
}
```

But `St8SchemaCard.intent` only defines 3 fields:
```javascript
intent: {
    purpose: '',
    dependsOnBehavior: '',
    valueStatement: ''
}
```

The extra `authoredBy` and `lastUpdated` fields flow through `emitCard` at line 59:
```javascript
intent: intent || { purpose: '', dependsOnBehavior: '', valueStatement: '' }
```

And get written into the deterministic JSON output. The validation at line 66 uses non-strict mode, so it doesn't catch extra fields. This means schema cards contain undocumented fields that aren't part of the canonical type definition, breaking the "deterministic, always in sync" contract stated in the file header.

**Fix:** Pick only canonical fields when building the intent:

```javascript
// At line 112, change to:
const rawIntent = allIntents[file.fingerprint] || null;
const intent = rawIntent
    ? { purpose: rawIntent.purpose, dependsOnBehavior: rawIntent.dependsOnBehavior, valueStatement: rawIntent.valueStatement }
    : null;
```

---

## Info

### IN-01: Prepared statements recreated per-file inside loop

**File:** `backend/schemaCardEmitter.js:123-128`
**Severity:** INFO

`persistence.db.prepare()` is called twice per file inside the `for` loop, creating N×2 statement objects for N files. The same SQL strings are prepared identically each iteration. Better-sqlite3 handles this gracefully (statements are lightweight), but the idiomatic pattern is to prepare once outside the loop.

**Fix (if using WR-01 fix):** This becomes moot since `getConnectionsForFile()` is used instead.

**Fix (if keeping direct DB access):**
```javascript
// Before the loop:
const importedByStmt = persistence.db.prepare(
    'SELECT sourceFingerprint FROM connections WHERE targetFingerprint = ?'
);
const importsStmt = persistence.db.prepare(
    'SELECT targetFingerprint FROM connections WHERE sourceFingerprint = ?'
);

// Inside the loop:
const importedBy = importedByStmt.all(file.fingerprint).map(r => r.sourceFingerprint);
const imports = importsStmt.all(file.fingerprint).map(r => r.targetFingerprint);
```

---

## Findings Summary

| ID | Severity | Description | Line(s) |
|----|----------|-------------|---------|
| WR-01 | WARNING | Direct `persistence.db` access may crash with DatabasePersister | 123-128 |
| WR-02 | WARNING | Extra `authoredBy`/`lastUpdated` fields leak into schema card JSON | 112, 59 |
| IN-01 | INFO | Prepared statements recreated per-file in loop | 123-128 |

---

_Reviewed: 2026-05-13_
_Depth: standard_
