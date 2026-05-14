# Task 01: Schema Constants — persistence.js ST8_SCHEMA Replacement

**Phase:** 1A
**Single Concern:** Replace the ST8_SCHEMA constant in persistence.js
**Files to Modify:** `backend/persistence.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 279-377 (Phase 1A: persistence.js — New ST8_SCHEMA)

---

## Exact Implementation

### Step 1: Add import at top of persistence.js

Add after existing requires:
```javascript
const { St8FileEntry, LifecyclePhase, FileStatus } = require('./st8-types');
```

### Step 2: Replace ST8_SCHEMA constant

Find the existing `ST8_SCHEMA` constant (lines 46-96 in original) and replace with the exact schema from PHASE-SPECS.md lines 286-355.

Key changes:
- `sha256_hash` → `sha256Hash` (camelCase)
- `file_size_bytes` → `fileSizeBytes` (camelCase)
- `reachability_score` → `reachabilityScore` (camelCase)
- `impact_radius` → `impactRadius` (camelCase)
- `source_fingerprint` → `sourceFingerprint` (camelCase)
- `target_fingerprint` → `targetFingerprint` (camelCase)
- `connection_type` → `connectionType` (camelCase)
- `import_specifier` → `importSpecifier` (camelCase)
- `is_resolved` → `isResolved` (camelCase)
- `confidence_score` → `confidenceScore` (camelCase)
- `last_verified` → `lastVerified` (camelCase)
- `depends_on_behavior` → `dependsOnBehavior` (camelCase)
- `value_statement` → `valueStatement` (camelCase)
- `authored_by` → `authoredBy` (camelCase)
- `last_updated` (intent) → `lastUpdated` (camelCase)
- `target_fingerprint` (activity_log) → `targetFingerprint` (camelCase)
- NEW columns: `lifecyclePhase`, `birthTimestamp`, `isEntryPoint`
- NEW table: `file_mutation_log`
- NEW indexes: `idx_file_registry_lifecycle`, `idx_mutation_log_fingerprint`, `idx_mutation_log_timestamp`

---

## PARALLELIZATION

```
- Can start after: [00]
- Can run parallel with: [03, 05, 06, 07]
- Must complete before: [02, 08, 09, 11]
- Conflict risk: [backend/persistence.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Delete old DB (schema incompatible)
rm -f st8.sqlite

# 2. Test schema creation
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
console.log('Schema OK');
p.close();
"
# Expected: Schema OK

# 3. Verify camelCase columns exist
node -e "
const Database = require('better-sqlite3');
const db = new Database('st8.sqlite');
const info = db.prepare('PRAGMA table_info(file_registry)').all();
console.log('file_registry columns:', info.map(i => i.name));
const connInfo = db.prepare('PRAGMA table_info(connections)').all();
console.log('connections columns:', connInfo.map(i => i.name));
const intentInfo = db.prepare('PRAGMA table_info(file_intent)').all();
console.log('file_intent columns:', intentInfo.map(i => i.name));
const mutInfo = db.prepare('PRAGMA table_info(file_mutation_log)').all();
console.log('file_mutation_log columns:', mutInfo.map(i => i.name));
db.close();
"
# Expected: All column names in camelCase
```

---

## Success Criteria

- [ ] `require('./st8-types')` import added to persistence.js
- [ ] ST8_SCHEMA constant replaced with camelCase version
- [ ] `file_registry` table has `lifecyclePhase`, `birthTimestamp`, `isEntryPoint` columns
- [ ] `file_mutation_log` table created
- [ ] All column names in camelCase (no snake_case)
- [ ] Schema initializes without errors
- [ ] Old DB deleted (schema incompatible)

---

## Report Format

When complete, report:

```
TASK 01 COMPLETE
- File modified: backend/persistence.js
- Schema test: PASS
- New tables: file_mutation_log
- New columns: lifecyclePhase, birthTimestamp, isEntryPoint
- Column naming: camelCase verified
```
