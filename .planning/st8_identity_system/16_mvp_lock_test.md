# Task 16: MVP Lock Test — Batch Transition

**Phase:** 5F
**Single Concern:** Test MVP Lock phase transition
**Test File:** `test-mvp-lock.js` (temporary)

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1630-1661 (Phase 5F: MVP Lock Phase)

---

## Exact Implementation

Create temporary test file `test-mvp-lock.js`:

```javascript
// test-mvp-lock.js — Verify MVP Lock transition
const { St8Persistence } = require('./backend/persistence');
const { MutationType } = require('./backend/st8-types');

const p = new St8Persistence();
p.initialize();

// Get all files
const files = p.getAllFiles();

// Transition each file to LOCKED
for (const file of files) {
    p.db.prepare(
        `UPDATE file_registry SET lifecyclePhase = 'LOCKED' WHERE fingerprint = ?`
    ).run(file.fingerprint);

    p.logMutation({
        fingerprint: file.fingerprint,
        sha256Hash: file.sha256Hash,
        mutationType: 'LOCK',
        changedFields: JSON.stringify({ lifecyclePhase: [file.lifecyclePhase, 'LOCKED'] }),
        actor: 'DEVELOPER',
        metadata: '{}'
    });
}

console.log(`Locked ${files.length} files`);
p.close();
```

---

## PARALLELIZATION

```
- Can start after: [12]
- Can run parallel with: [13, 14, 15, 17]
- Must complete before: [18, 19, 20, 21, 22]
- Conflict risk: [st8.sqlite — updates lifecyclePhase for all files]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Run MVP lock test
node test-mvp-lock.js
# Expected: Locked [N] files

# 2. Verify all files locked
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const allLocked = files.every(f => f.lifecyclePhase === 'LOCKED');
console.log('All files locked:', allLocked);
console.log('Total files:', files.length);

// Check mutation log for LOCK entries
const lockMutations = p.getMutationLog(files[0].fingerprint);
const hasLock = lockMutations.some(m => m.mutationType === 'LOCK');
console.log('LOCK mutation logged:', hasLock);
p.close();
"
# Expected: All files locked: true, LOCK mutation logged: true

# 3. Clean up test file
rm -f test-mvp-lock.js
```

---

## Success Criteria

- [ ] All files transitioned to LOCKED lifecyclePhase
- [ ] LOCK mutation logged for each file
- [ ] Mutation actor is 'DEVELOPER'
- [ ] changedFields shows lifecyclePhase transition
- [ ] Test file cleaned up

---

## Report Format

When complete, report:

```
TASK 16 COMPLETE
- Files locked: [count]
- All locked: PASS
- LOCK mutations: PASS
- Test file: cleaned up
```
