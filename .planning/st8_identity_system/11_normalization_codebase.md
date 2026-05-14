# Task 11: Codebase Normalization — snake_case → camelCase

**Phase:** 4
**Single Concern:** Replace ALL snake_case references with camelCase across the codebase
**Files to Modify:** `backend/persistence.js`, `backend/indexer.js`, `backend/server.js`, `backend/manifestGenerator.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1408-1532 (Phase 4: Codebase Normalization)

---

## Exact Implementation

### persistence.js — ALL SQL statements and method bodies

| Old (snake_case) | New (camelCase) | Locations |
|-----------------|-----------------|-----------|
| `sha256_hash` | `sha256Hash` | ST8_SCHEMA, upsertFile, getFileByPath, getFilesByStatus, getAllFiles, _handleVerify references |
| `file_size_bytes` | `fileSizeBytes` | ST8_SCHEMA, upsertFile |
| `reachability_score` | `reachabilityScore` | ST8_SCHEMA, upsertFile |
| `impact_radius` | `impactRadius` | ST8_SCHEMA, upsertFile |
| `source_fingerprint` | `sourceFingerprint` | ST8_SCHEMA, insertConnection, deleteConnectionsForFile |
| `target_fingerprint` | `targetFingerprint` | ST8_SCHEMA, insertConnection, deleteConnectionsForFile |
| `connection_type` | `connectionType` | ST8_SCHEMA, insertConnection |
| `import_specifier` | `importSpecifier` | ST8_SCHEMA, insertConnection |
| `is_resolved` | `isResolved` | ST8_SCHEMA, insertConnection |
| `confidence_score` | `confidenceScore` | ST8_SCHEMA, insertConnection |
| `last_verified` | `lastVerified` | ST8_SCHEMA |
| `depends_on_behavior` | `dependsOnBehavior` | ST8_SCHEMA, getAllIntents, setIntent |
| `value_statement` | `valueStatement` | ST8_SCHEMA, getAllIntents, setIntent |
| `authored_by` | `authoredBy` | ST8_SCHEMA, getAllIntents, setIntent |
| `last_updated` (intent) | `lastUpdated` | ST8_SCHEMA |
| `target_fingerprint` (activity_log) | `targetFingerprint` | ST8_SCHEMA, logActivity |
| `idx_file_registry_sha256` | `idx_file_registry_sha256Hash` | ST8_SCHEMA |

### indexer.js — ST8_SCHEMA constant

Same column renaming as persistence.js. Both schemas MUST be identical.

### server.js — _handleVerify method

| Old | New |
|-----|-----|
| `file.sha256_hash` | `file.sha256Hash` |
| `file.file_size_bytes` | `file.fileSizeBytes` |
| `file.fingerprint \|\| file.sha256Hash` | `file.fingerprint` |

### manifestGenerator.js

No column references (works with JS objects, not SQL). But verify all object property access uses camelCase.

---

## PARALLELIZATION

```
- Can start after: [01, 02, 03, 04]
- Can run parallel with: [08, 09, 10, 23]
- Must complete before: [12, 13, 14, 15, 16, 17]
- Conflict risk: [backend/persistence.js, backend/indexer.js, backend/server.js, backend/manifestGenerator.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify no snake_case remains in persistence.js
grep -n "sha256_hash" backend/persistence.js
grep -n "file_size_bytes" backend/persistence.js
grep -n "reachability_score" backend/persistence.js
grep -n "impact_radius" backend/persistence.js
grep -n "source_fingerprint" backend/persistence.js
grep -n "target_fingerprint" backend/persistence.js
grep -n "connection_type" backend/persistence.js
grep -n "import_specifier" backend/persistence.js
grep -n "is_resolved" backend/persistence.js
grep -n "confidence_score" backend/persistence.js
grep -n "last_verified" backend/persistence.js
grep -n "depends_on_behavior" backend/persistence.js
grep -n "value_statement" backend/persistence.js
grep -n "authored_by" backend/persistence.js
grep -n "last_updated" backend/persistence.js
# Expected: None found

# 2. Verify no snake_case remains in indexer.js
grep -n "sha256_hash" backend/indexer.js
grep -n "file_size_bytes" backend/indexer.js
# Expected: None found

# 3. Verify no snake_case remains in server.js
grep -n "sha256_hash" backend/server.js
grep -n "file_size_bytes" backend/server.js
# Expected: None found

# 4. Verify schemas match
node -e "
const fs = require('fs');
const persistSchema = fs.readFileSync('backend/persistence.js', 'utf-8')
    .match(/const ST8_SCHEMA = \`(.*?)\`/s)[1];
const indexerSchema = fs.readFileSync('backend/indexer.js', 'utf-8')
    .match(/const ST8_SCHEMA = \`(.*?)\`/s)[1];
console.log('Schemas match:', persistSchema === indexerSchema);
"
# Expected: Schemas match: true

# 5. Verify all files parse
node -c backend/persistence.js
node -c backend/indexer.js
node -c backend/server.js
node -c backend/manifestGenerator.js
# Expected: No syntax errors
```

---

## Success Criteria

- [ ] No snake_case column names in persistence.js
- [ ] No snake_case column names in indexer.js
- [ ] No snake_case field access in server.js
- [ ] Schemas in persistence.js and indexer.js are identical
- [ ] All files parse without syntax errors
- [ ] manifestGenerator.js verified for camelCase property access

---

## Report Format

When complete, report:

```
TASK 11 COMPLETE
- Files modified: persistence.js, indexer.js, server.js, manifestGenerator.js
- Snake_case removed: PASS
- Schema consistency: PASS
- Syntax check: PASS
```
