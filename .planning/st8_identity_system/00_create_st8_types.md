# Task 00: Create st8-types.js — Canonical Type Definitions

**Phase:** 0
**Single Concern:** Create the canonical type definitions file
**Files to Create:** `backend/st8-types.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 9-266 (Phase 0: st8-types.js)

---

## Exact Implementation

Create `backend/st8-types.js` with the exact code from PHASE-SPECS.md lines 16-258.

The file must contain:
1. `LifecyclePhase` enum (CONCEPT, LOCKED, WIRING, DEVELOPMENT, PRODUCTION)
2. `FileStatus` enum (GREEN, YELLOW, RED, CONCEPT, LOCKED, PRODUCTION)
3. `MutationType` enum (CONCEPT, CREATE, EDIT, RENAME, REFACTOR, LOCK, PRODUCTION, PURGE)
4. `ActorType` enum (DEVELOPER, INDEXER, WATCHER, AGENT)
5. `St8FileEntry` frozen object (canonical file shape)
6. `St8SchemaCard` frozen object (extended file shape for emission)
7. `St8MutationRecord` frozen object
8. `validateAgainstShape()` function
9. `validateSt8FileEntry()`, `validateSt8SchemaCard()`, `validateSt8MutationRecord()` validators
10. `generateFingerprint()` and `parseFingerprint()` functions
11. CLI validation mode (`--validate` flag)
12. All exports

---

## PARALLELIZATION

```
- Can start after: [nothing — first task]
- Can run parallel with: [nothing — must complete first]
- Must complete before: [01, 02, 03, 04, 05, 06, 07]
- Conflict risk: [backend/st8-types.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. File exists
ls -la backend/st8-types.js

# 2. Node can parse it
node -c backend/st8-types.js

# 3. Validation CLI works
node backend/st8-types.js --validate
# Expected output:
# [st8:types] Running type validation...
# [st8:types] St8FileEntry fields: fingerprint, filepath, filename, sha256Hash, fileSizeBytes, status, reachabilityScore, impactRadius, lifecyclePhase, birthTimestamp, lastModified, lastIndexed, isEntryPoint
# [st8:types] St8SchemaCard fields: fingerprint, filepath, filename, sha256Hash, fileSizeBytes, status, reachabilityScore, impactRadius, lifecyclePhase, birthTimestamp, lastModified, lastIndexed, isEntryPoint, exports, imports, connections, intent, mutationCount, lastMutation
# [st8:types] St8MutationRecord fields: fingerprint, sha256Hash, mutationType, changedFields, actor, timestamp, metadata
# [st8:types] LifecyclePhase values: CONCEPT, LOCKED, WIRING, DEVELOPMENT, PRODUCTION
# [st8:types] MutationType values: CONCEPT, CREATE, EDIT, RENAME, REFACTOR, LOCK, PRODUCTION, PURGE
# [st8:types] Self-test: PASS

# 4. Exports are accessible
node -e "
const types = require('./backend/st8-types');
console.log('LifecyclePhase:', types.LifecyclePhase);
console.log('FileStatus:', types.FileStatus);
console.log('MutationType:', types.MutationType);
console.log('ActorType:', types.ActorType);
console.log('St8FileEntry keys:', Object.keys(types.St8FileEntry));
console.log('generateFingerprint:', typeof types.generateFingerprint);
console.log('parseFingerprint:', typeof types.parseFingerprint);
"
```

---

## Success Criteria

- [ ] `backend/st8-types.js` file exists
- [ ] `node -c backend/st8-types.js` exits 0 (valid syntax)
- [ ] `node backend/st8-types.js --validate` exits 0 with "Self-test: PASS"
- [ ] All 4 enums exported (LifecyclePhase, FileStatus, MutationType, ActorType)
- [ ] All 3 shapes exported (St8FileEntry, St8SchemaCard, St8MutationRecord)
- [ ] `generateFingerprint()` returns `filepath:birthTimestamp` format
- [ ] `parseFingerprint()` correctly splits fingerprint back to components
- [ ] `validateAgainstShape()` returns `{ valid, missing, extra, wrongType }`
- [ ] All validator functions exported

---

## Report Format

When complete, report:

```
TASK 00 COMPLETE
- File created: backend/st8-types.js
- Validation: PASS
- Exports verified: [list all exports]
- Lines: [count]
```
