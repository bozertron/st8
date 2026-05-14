# Task 02: New Methods — persistence.js Method Additions

**Phase:** 1B
**Single Concern:** Add new methods to persistence.js
**Files to Modify:** `backend/persistence.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 379-612 (Phase 1B: persistence.js — Updated Methods)

---

## Exact Implementation

### Step 1: Replace upsertFile() method

Replace entire method body with PHASE-SPECS.md lines 384-406.

### Step 2: Replace getAllFiles() method

Replace with PHASE-SPECS.md lines 412-421. Now returns camelCase objects matching St8FileEntry.

### Step 3: Add logMutation() method

Add PHASE-SPECS.md lines 427-441.

### Step 4: Add getMutationLog() method

Add PHASE-SPECS.md lines 447-452.

### Step 5: Add getMutationCount() method

Add PHASE-SPECS.md lines 458-464.

### Step 6: Add getLastMutation() method

Add PHASE-SPECS.md lines 470-475.

### Step 7: Add registerConceptFile() method

Add PHASE-SPECS.md lines 481-513. Note: requires `path` module and `generateFingerprint` from st8-types.

### Step 8: Add purgeDevelopmentData() method

Add PHASE-SPECS.md lines 519-554.

### Step 9: Update insertConnection() method

Replace with PHASE-SPECS.md lines 560-575 (camelCase column names).

### Step 10: Update getAllIntents() method

Replace with PHASE-SPECS.md lines 581-595 (camelCase column names).

### Step 11: Update deleteFile() method

Replace with PHASE-SPECS.md lines 601-611 (camelCase column names).

---

## PARALLELIZATION

```
- Can start after: [01]
- Can run parallel with: [03, 05, 06, 07]
- Must complete before: [08, 09, 11]
- Conflict risk: [backend/persistence.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify methods exist
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
console.log('upsertFile:', typeof p.upsertFile);
console.log('getAllFiles:', typeof p.getAllFiles);
console.log('logMutation:', typeof p.logMutation);
console.log('getMutationLog:', typeof p.getMutationLog);
console.log('getMutationCount:', typeof p.getMutationCount);
console.log('getLastMutation:', typeof p.getLastMutation);
console.log('registerConceptFile:', typeof p.registerConceptFile);
console.log('purgeDevelopmentData:', typeof p.purgeDevelopmentData);
console.log('insertConnection:', typeof p.insertConnection);
console.log('getAllIntents:', typeof p.getAllIntents);
console.log('deleteFile:', typeof p.deleteFile);
p.close();
"
# Expected: All methods are 'function'

# 2. Test logMutation
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();

// Insert a test file first
p.upsertFile({
    fingerprint: 'test.js:2026-01-01T00:00:00.000Z',
    filepath: 'test.js',
    filename: 'test.js',
    sha256Hash: 'abc123',
    fileSizeBytes: 100,
    status: 'GREEN',
    reachabilityScore: 0.5,
    impactRadius: 1,
    lifecyclePhase: 'DEVELOPMENT',
    birthTimestamp: '2026-01-01T00:00:00.000Z',
    lastModified: '2026-01-01T00:00:00.000Z',
    isEntryPoint: false
});

// Log a mutation
p.logMutation({
    fingerprint: 'test.js:2026-01-01T00:00:00.000Z',
    sha256Hash: 'abc123',
    mutationType: 'CREATE',
    changedFields: '{}',
    actor: 'DEVELOPER',
    metadata: '{}'
});

// Verify
const count = p.getMutationCount('test.js:2026-01-01T00:00:00.000Z');
console.log('Mutation count:', count);
const last = p.getLastMutation('test.js:2026-01-01T00:00:00.000Z');
console.log('Last mutation type:', last.mutationType);
const log = p.getMutationLog('test.js:2026-01-01T00:00:00.000Z');
console.log('Log entries:', log.length);

p.close();
"
# Expected: Mutation count: 1, Last mutation type: CREATE, Log entries: 1

# 3. Test registerConceptFile
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();

const fp = p.registerConceptFile({
    filepath: 'backend/test-concept.js',
    filename: 'test-concept.js',
    actor: 'DEVELOPER'
});

console.log('Concept fingerprint:', fp);
const file = p.getFileByPath('backend/test-concept.js');
console.log('Status:', file.status);
console.log('Lifecycle:', file.lifecyclePhase);

p.close();
"
# Expected: Status: CONCEPT, Lifecycle: CONCEPT
```

---

## Success Criteria

- [ ] `upsertFile()` uses camelCase column names
- [ ] `getAllFiles()` returns camelCase objects with boolean isEntryPoint
- [ ] `logMutation()` inserts into file_mutation_log table
- [ ] `getMutationLog()` returns array of mutation records
- [ ] `getMutationCount()` returns count for fingerprint
- [ ] `getLastMutation()` returns most recent mutation
- [ ] `registerConceptFile()` creates CONCEPT lifecycle entry
- [ ] `purgeDevelopmentData()` removes non-PRODUCTION mutations
- [ ] `insertConnection()` uses camelCase column names
- [ ] `getAllIntents()` uses camelCase column names
- [ ] `deleteFile()` uses camelCase column names

---

## Report Format

When complete, report:

```
TASK 02 COMPLETE
- File modified: backend/persistence.js
- Methods added: logMutation, getMutationLog, getMutationCount, getLastMutation, registerConceptFile, purgeDevelopmentData
- Methods updated: upsertFile, getAllFiles, insertConnection, getAllIntents, deleteFile
- All methods verified: PASS
```
