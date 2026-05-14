# Task 14: Mutation Logging Verification — Edit and Verify

**Phase:** 5C
**Single Concern:** Verify mutation logging works on file edit
**Files to Modify:** `backend/fileWatcher.js` (test mutation, then revert)

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1570-1598 (Phase 5C: Verify Mutation Logging)

---

## Exact Implementation

### Step 1: Make a test mutation

```bash
echo "// test mutation" >> backend/fileWatcher.js
```

### Step 2: Wait for watcher to detect change

Wait 1-2 seconds (debounce).

### Step 3: Verify mutation logged

```javascript
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const fw = files.find(f => f.filepath.includes('fileWatcher'));
if (fw) {
    console.log('Mutation count:', p.getMutationCount(fw.fingerprint));
    console.log('Last mutation:', p.getLastMutation(fw.fingerprint));
}
p.close();
```

Expected: mutation count >= 1, lastMutation.type = 'EDIT'

### Step 4: Revert the test mutation

```bash
git checkout backend/fileWatcher.js
```

---

## PARALLELIZATION

```
- Can start after: [12]
- Can run parallel with: [13, 15, 16, 17]
- Must complete before: [18, 19, 20, 21, 22]
- Conflict risk: [backend/fileWatcher.js — temporary test mutation]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Make test mutation
echo "// test mutation" >> backend/fileWatcher.js

# 2. Wait for watcher
sleep 2

# 3. Verify mutation logged
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const fw = files.find(f => f.filepath.includes('fileWatcher'));
if (fw) {
    console.log('Mutation count:', p.getMutationCount(fw.fingerprint));
    console.log('Last mutation type:', p.getLastMutation(fw.fingerprint).mutationType);
    console.log('Last mutation actor:', p.getLastMutation(fw.fingerprint).actor);
} else {
    console.log('fileWatcher not found');
}
p.close();
"
# Expected: Mutation count: >= 1, Last mutation type: EDIT, Last mutation actor: WATCHER

# 4. Revert test mutation
git checkout backend/fileWatcher.js

# 5. Verify .txt file updated
ls -la .planning/st8_identity_system/LATEST_backend_fileWatcher.js.txt
# Expected: File exists with recent timestamp
```

---

## Success Criteria

- [ ] Test mutation made to fileWatcher.js
- [ ] Watcher detected change within 2 seconds
- [ ] Mutation logged in file_mutation_log table
- [ ] lastMutation.type is 'EDIT'
- [ ] lastMutation.actor is 'WATCHER'
- [ ] Mutation count >= 1
- [ ] .txt fallback file updated
- [ ] Test mutation reverted

---

## Report Format

When complete, report:

```
TASK 14 COMPLETE
- Test mutation: PASS
- Watcher detection: PASS
- Mutation logged: PASS
- Mutation type: EDIT
- Mutation actor: WATCHER
- Mutation count: [count]
- .txt fallback: PASS
- Reverted: PASS
```
