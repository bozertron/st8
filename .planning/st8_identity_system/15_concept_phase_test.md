# Task 15: Concept Phase Test — Register Pre-Code File

**Phase:** 5E
**Single Concern:** Test concept file registration
**Test File:** `test-concept.js` (temporary)

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1600-1628 (Phase 5E: Register Concept Files)

---

## Exact Implementation

Create temporary test file `test-concept.js`:

```javascript
// test-concept.js — Verify pre-code concept registration
const { St8Persistence } = require('./backend/persistence');
const { LifecyclePhase } = require('./backend/st8-types');

const p = new St8Persistence();
p.initialize();

// Register a file that doesn't exist yet
const fp = p.registerConceptFile({
    filepath: 'backend/schemaValidator.js',
    filename: 'schemaValidator.js',
    actor: 'DEVELOPER'
});

console.log('Concept fingerprint:', fp);

// Verify it's in the DB
const file = p.getFileByPath('backend/schemaValidator.js');
console.log('Status:', file.status);           // 'CONCEPT'
console.log('Lifecycle:', file.lifecyclePhase); // 'CONCEPT'
console.log('SHA-256:', file.sha256Hash);       // '' (no content yet)

// Check mutation log
console.log('Mutations:', p.getMutationLog(fp));
p.close();
```

---

## PARALLELIZATION

```
- Can start after: [12]
- Can run parallel with: [13, 14, 16, 17]
- Must complete before: [18, 19, 20, 21, 22]
- Conflict risk: [st8.sqlite — adds concept file to database]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Run concept test
node test-concept.js
# Expected output:
# Concept fingerprint: backend/schemaValidator.js:[timestamp]
# Status: CONCEPT
# Lifecycle: CONCEPT
# SHA-256: (empty string)
# Mutations: [ { mutationType: 'CONCEPT', ... } ]

# 2. Verify concept file in database
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const file = p.getFileByPath('backend/schemaValidator.js');
console.log('File exists:', !!file);
console.log('Status:', file.status);
console.log('Lifecycle:', file.lifecyclePhase);
console.log('SHA-256:', file.sha256Hash);
p.close();
"
# Expected: File exists: true, Status: CONCEPT, Lifecycle: CONCEPT, SHA-256: (empty)

# 3. Clean up test file
rm -f test-concept.js
```

---

## Success Criteria

- [ ] Concept file registered with CONCEPT status
- [ ] Concept file registered with CONCEPT lifecyclePhase
- [ ] SHA-256 hash is empty (no content yet)
- [ ] Fingerprint generated from filepath + timestamp
- [ ] Mutation logged with type 'CONCEPT'
- [ ] Mutation actor is 'DEVELOPER'
- [ ] Test file cleaned up

---

## Report Format

When complete, report:

```
TASK 15 COMPLETE
- Concept registration: PASS
- Status: CONCEPT
- Lifecycle: CONCEPT
- SHA-256: empty
- Mutation logged: PASS
- Test file: cleaned up
```
