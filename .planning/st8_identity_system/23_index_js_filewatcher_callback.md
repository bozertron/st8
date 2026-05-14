# Task 23: index.js File Watcher Callback — Mutation Logging + Schema Card Emission

**Phase:** 3A (continued)
**Single Concern:** Wire mutation logging and schema card emission into the file watcher callback in index.js
**Files to Modify:** `backend/index.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1257-1370 (Phase 3A: index.js — Modify the file watcher onFileChange callback)

---

## Exact Implementation

### Step 1: Modify the `add` handler in the file watcher callback

Find the `if (change.type === 'add')` block and replace with:

```javascript
if (change.type === 'add') {
    try {
        const content = require('fs').readFileSync(change.path);
        const hash = require('crypto').createHash('sha256').update(content).digest('hex');
        const stat = require('fs').statSync(change.path);
        const birthTimestamp = stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString();
        const fingerprint = generateFingerprint(relativePath, birthTimestamp);

        const newFile = {
            fingerprint: fingerprint,
            filepath: relativePath,
            filename: path.basename(change.path),
            sha256Hash: hash,
            fileSizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
            birthTimestamp: birthTimestamp,
            imports: [],
            importedBy: [],
            status: 'RED',
            reachabilityScore: 0.0,
            impactRadius: 0,
            lifecyclePhase: 'DEVELOPMENT',
            isEntryPoint: false
        };

        result.files.push(newFile);
        persistence.upsertFile(newFile);

        persistence.logMutation({
            fingerprint: fingerprint,
            sha256Hash: hash,
            mutationType: 'CREATE',
            changedFields: '{}',
            actor: 'WATCHER',
            metadata: '{}'
        });

        notificationBus.publish({
            fingerprint: fingerprint,
            filepath: relativePath,
            mutationType: 'CREATE',
            actor: 'WATCHER',
            sha256Hash: hash
        });

        anyChanged = true;
    } catch (err) {
        console.error(`[st8] Failed to index new file ${relativePath}:`, err.message);
    }
}
```

### Step 2: Modify the `change` handler in the file watcher callback

Find the `else` block (for file changes) and replace with:

```javascript
else {
    const changedFile = result.files.find(f => f.filepath === relativePath);
    if (changedFile) {
        try {
            const newHash = require('crypto')
                .createHash('sha256')
                .update(require('fs').readFileSync(change.path))
                .digest('hex');
            if (newHash !== changedFile.sha256Hash) {
                const oldHash = changedFile.sha256Hash;
                changedFile.sha256Hash = newHash;
                changedFile.lastModified = new Date().toISOString();
                persistence.upsertFile(changedFile);

                persistence.logMutation({
                    fingerprint: changedFile.fingerprint,
                    sha256Hash: newHash,
                    mutationType: 'EDIT',
                    changedFields: JSON.stringify({ sha256Hash: [oldHash, newHash] }),
                    actor: 'WATCHER',
                    metadata: '{}'
                });

                notificationBus.publish({
                    fingerprint: changedFile.fingerprint,
                    filepath: relativePath,
                    mutationType: 'EDIT',
                    actor: 'WATCHER',
                    sha256Hash: newHash
                });

                // Emit updated schema card
                const card = emitter.emitCard(changedFile, { imports: [], exports: [] },
                    { importedBy: [], imports: [] }, null,
                    { count: persistence.getMutationCount(changedFile.fingerprint),
                      lastMutation: persistence.getLastMutation(changedFile.fingerprint) });

                notificationBus.publish({
                    fingerprint: changedFile.fingerprint,
                    filepath: relativePath,
                    mutationType: 'EDIT',
                    actor: 'WATCHER',
                    sha256Hash: newHash,
                    schemaCard: card  // Triggers .txt fallback
                });

                anyChanged = true;
            }
        } catch (err) {
            console.error(`[st8] Failed to hash ${relativePath}:`, err.message);
        }
    }
}
```

---

## PARALLELIZATION

```
- Can start after: [01, 02, 03, 04, 05, 06, 07]
- Can run parallel with: [08, 09, 10, 11]
- Must complete before: [12, 13, 14, 15, 16, 17]
- Conflict risk: [backend/index.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify fingerprint generation in add handler
grep -n "generateFingerprint(relativePath, birthTimestamp)" backend/index.js
# Expected: Found in file watcher callback section

# 2. Verify birthTimestamp extraction
grep -n "stat.birthtime" backend/index.js
# Expected: Found

# 3. Verify mutation logging in add handler
grep -A5 "change.type === 'add'" backend/index.js | grep "persistence.logMutation"
# Expected: Found

# 4. Verify mutation logging in change handler
grep -A10 "changedFile.sha256Hash = newHash" backend/index.js | grep "persistence.logMutation"
# Expected: Found

# 5. Verify notification publishing
grep -n "notificationBus.publish" backend/index.js
# Expected: At least 2 matches (add handler + change handler)

# 6. Verify schema card emission on change
grep -n "emitter.emitCard" backend/index.js
# Expected: Found

# 7. Test syntax
node -c backend/index.js
# Expected: No syntax errors

# 8. Test full flow (server must be running)
# Create a new file
echo "// test new file" > backend/test-new-file.js
sleep 2

# Verify CREATE mutation logged
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const testFile = files.find(f => f.filepath.includes('test-new-file'));
if (testFile) {
    console.log('File found:', testFile.filepath);
    console.log('Fingerprint:', testFile.fingerprint);
    console.log('Mutation count:', p.getMutationCount(testFile.fingerprint));
    console.log('Last mutation:', p.getLastMutation(testFile.fingerprint));
} else {
    console.log('Test file not found');
}
p.close();
"
# Expected: File found, Mutation count >= 1, Last mutation type: CREATE

# 9. Edit the test file
echo "// edit test" >> backend/test-new-file.js
sleep 2

# Verify EDIT mutation logged
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const testFile = files.find(f => f.filepath.includes('test-new-file'));
if (testFile) {
    console.log('Mutation count:', p.getMutationCount(testFile.fingerprint));
    const last = p.getLastMutation(testFile.fingerprint);
    console.log('Last mutation type:', last.mutationType);
} else {
    console.log('Test file not found');
}
p.close();
"
# Expected: Mutation count >= 2, Last mutation type: EDIT

# 10. Clean up
rm -f backend/test-new-file.js
```

---

## Success Criteria

- [ ] `add` handler generates stable fingerprint using `generateFingerprint(relativePath, birthTimestamp)`
- [ ] `add` handler extracts `birthTimestamp` from `stat.birthtime` or `stat.mtime`
- [ ] `add` handler creates `newFile` object with all required fields
- [ ] `add` handler calls `persistence.upsertFile(newFile)`
- [ ] `add` handler calls `persistence.logMutation()` with CREATE mutation type
- [ ] `add` handler calls `notificationBus.publish()` with mutation event
- [ ] `change` handler compares new hash with existing hash
- [ ] `change` handler updates `changedFile.sha256Hash` and `lastModified`
- [ ] `change` handler calls `persistence.upsertFile(changedFile)`
- [ ] `change` handler calls `persistence.logMutation()` with EDIT mutation type
- [ ] `change` handler calls `notificationBus.publish()` with mutation event
- [ ] `change` handler calls `emitter.emitCard()` to update schema card
- [ ] `change` handler publishes schema card event (triggers .txt fallback)
- [ ] File parses without syntax errors
- [ ] New files are detected and logged correctly
- [ ] File edits are detected and logged correctly

---

## Report Format

When complete, report:

```
TASK 23 COMPLETE
- File modified: backend/index.js
- add handler: fingerprint generation + mutation logging + notification
- change handler: hash comparison + mutation logging + schema card emission
- Test new file: PASS
- Test file edit: PASS
```
