# Task 08: index.js Wiring — Mutation Logging + Schema Card Emission

**Phase:** 3A
**Single Concern:** Wire mutation logging and schema card emission in index.js
**Files to Modify:** `backend/index.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1181-1255 (Phase 3A: index.js — Wire the Full Pipeline)

---

## Exact Implementation

### Step 1: Add imports at top (after existing requires on lines 13-18)

```javascript
const { generateFingerprint, MutationType, ActorType } = require('./st8-types');
const { SchemaCardEmitter } = require('./schemaCardEmitter');
const { SchemaCardPrinter } = require('./schemaCardPrinter');
const { notificationBus } = require('./notificationBus');
```

### Step 2: Modify the initial indexing loop (lines 83-115)

Replace `fingerprint: file.sha256Hash` with the stable identity:

```javascript
for (const file of result.files) {
    persistence.upsertFile({
        fingerprint: file.fingerprint,     // NOW uses stable identity
        filepath: file.filepath,
        filename: file.filename,
        sha256Hash: file.sha256Hash,
        fileSizeBytes: file.fileSizeBytes,
        status: file.status,
        reachabilityScore: file.reachabilityScore,
        impactRadius: file.impactRadius,
        lifecyclePhase: file.lifecyclePhase || 'DEVELOPMENT',
        birthTimestamp: file.birthTimestamp || new Date().toISOString(),
        lastModified: file.lastModified,
        isEntryPoint: false
    });

    // Log CREATE mutation for each file
    persistence.logMutation({
        fingerprint: file.fingerprint,
        sha256Hash: file.sha256Hash,
        mutationType: 'CREATE',
        changedFields: '{}',
        actor: 'INDEXER',
        metadata: '{}'
    });

    // Wire connections (camelCase field names)
    if (file.imports && file.imports.length > 0) {
        for (const imp of file.imports) {
            const targetFile = result.files.find(f =>
                f.filepath.endsWith(imp.source) ||
                f.filepath.includes(imp.source.replace(/^\.\//, ''))
            );
            if (targetFile) {
                persistence.insertConnection({
                    sourceFingerprint: file.fingerprint,
                    targetFingerprint: targetFile.fingerprint,
                    connectionType: 'IMPORT',
                    importSpecifier: imp.source,
                    isResolved: true,
                    confidenceScore: 1.0
                });
            }
        }
    }
}
```

### Step 3: After manifest generation (after line 129), add schema card emission

```javascript
// Emit schema cards
const emitter = new SchemaCardEmitter(targetDir);
const printer = new SchemaCardPrinter(targetDir);
notificationBus.setPrinter(printer);
emitter.emitAllCards(persistence);
printer.printAllFromCards(path.join(targetDir, '.st8', 'schema-cards'));
console.log('[st8] Schema cards emitted');
```

---

## PARALLELIZATION

```
- Can start after: [01, 02, 03, 04, 05, 06, 07]
- Can run parallel with: [09, 10, 11, 23]
- Must complete before: [12, 13, 14, 15, 16, 17]
- Conflict risk: [backend/index.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify imports added
grep -n "require('./st8-types')" backend/index.js
grep -n "require('./schemaCardEmitter')" backend/index.js
grep -n "require('./schemaCardPrinter')" backend/index.js
grep -n "require('./notificationBus')" backend/index.js
# Expected: All 4 imports found

# 2. Verify fingerprint usage
grep -n "fingerprint: file.fingerprint" backend/index.js
# Expected: Found

# 3. Verify mutation logging
grep -n "persistence.logMutation" backend/index.js
# Expected: Found

# 4. Verify schema card emission
grep -n "emitter.emitAllCards" backend/index.js
grep -n "printer.printAllFromCards" backend/index.js
# Expected: Both found

# 5. Verify notificationBus.setPrinter
grep -n "notificationBus.setPrinter" backend/index.js
# Expected: Found

# 6. Test import resolution
node -c backend/index.js
# Expected: No syntax errors
```

---

## Success Criteria

- [ ] `require('./st8-types')` import added
- [ ] `require('./schemaCardEmitter')` import added
- [ ] `require('./schemaCardPrinter')` import added
- [ ] `require('./notificationBus')` import added
- [ ] `fingerprint: file.fingerprint` used in upsertFile (not sha256Hash)
- [ ] `persistence.logMutation()` called for CREATE mutations
- [ ] `emitter.emitAllCards()` called after manifest generation
- [ ] `printer.printAllFromCards()` called after emitter
- [ ] `notificationBus.setPrinter(printer)` called
- [ ] Connection wiring uses camelCase field names

---

## Report Format

When complete, report:

```
TASK 08 COMPLETE
- File modified: backend/index.js
- Imports added: 4
- Fingerprint usage: PASS
- Mutation logging: PASS
- Schema card emission: PASS
- Notification bus wiring: PASS
```
