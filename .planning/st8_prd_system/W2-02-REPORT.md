# Task W2-02: Implement Connections Query in Schema Card Emitter — Report

**Status:** COMPLETE
**Date:** 2026-05-13

---

## What Changed

Replaced the stub/TODO at line 122-124 in `backend/schemaCardEmitter.js` with actual connection queries to the `connections` table.

### File Modified

**backend/schemaCardEmitter.js** — `emitAllCards()` method, lines 122-131

### Before (stub)
```javascript
const connections = { importedBy: [], imports: [] };
// TODO: Add connection query when connections table uses camelCase
```

### After (wired)
```javascript
const importedByStmt = persistence.db.prepare(
    'SELECT sourceFingerprint FROM connections WHERE targetFingerprint = ?'
);
const importsStmt = persistence.db.prepare(
    'SELECT targetFingerprint FROM connections WHERE sourceFingerprint = ?'
);
const importedBy = importedByStmt.all(file.fingerprint).map(r => r.sourceFingerprint);
const imports = importsStmt.all(file.fingerprint).map(r => r.targetFingerprint);
const connections = { importedBy, imports };
```

---

## Integration Pattern

| Aspect | Detail |
|--------|--------|
| **Pattern** | Prepared statement query against better-sqlite3 `persistence.db` |
| **File** | `backend/schemaCardEmitter.js` |
| **Method** | `SchemaCardEmitter.emitAllCards(persistence)` |
| **Lines** | 122-131 |
| **Table** | `connections` (schema in `backend/persistence.js` lines 64-76) |
| **Columns queried** | `sourceFingerprint`, `targetFingerprint` |

### Query Semantics

- **`importedBy`**: Files that import the current file — queried by `targetFingerprint = file.fingerprint`
- **`imports`**: Files that the current file imports — queried by `sourceFingerprint = file.fingerprint`

Both use indexed columns (`idx_connections_target`, `idx_connections_source`).

---

## Verification

```
$ node -c backend/schemaCardEmitter.js
(exit 0, no syntax errors)
```

### Wiring Confirmation

1. `persistence.db` is a `better-sqlite3` `Database` instance (confirmed in `persistence.js` line 145)
2. `persistence.db.prepare()` returns a `Statement` with `.all()` method (better-sqlite3 API)
3. The `connections` table uses camelCase columns (`sourceFingerprint`, `targetFingerprint`) — matching the queries exactly
4. The result flows into `this.emitCard(file, astResult, connections, intent, ...)` at line 133, which writes it to the schema card JSON
5. The existing `try/catch` at line 138 will capture any runtime query errors

### Downstream Consumers

- `backend/schemaCardPrinter.js` reads `card.connections.importedBy` and `card.connections.imports` (lines 136-144) — format matches
- `backend/st8-types.js` defines the `connections` shape with `{ importedBy: [], imports: [] }` (line 100) — format matches

---

## Error Handling

- Runtime query errors are caught by the existing `try/catch` block at line 138, logged via `console.error`, and counted in `errors`
- No additional error handling needed — the prepared statements will throw on DB corruption or schema mismatch, which is the correct behavior
