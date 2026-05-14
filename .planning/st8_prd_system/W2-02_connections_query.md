# Task W2-02: Implement Connections Query in Schema Card Emitter (H4)

**Category:** HIGH
**Single Concern:** Schema card connections population

---

## Specification

In backend/schemaCardEmitter.js, replace the TODO at line ~124:
```javascript
// TODO: Add connection query when connections table uses camelCase
const connections = { importedBy: [], imports: [] };
```

With actual queries to the connections table:
```javascript
// Query connections for this file
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

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/schemaCardEmitter.js
# Start server, check schema cards have non-empty connections
```

## Report Format
- Lines modified
- Query implementation
- Verification output