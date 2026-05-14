# Task 19: MVP Lock Endpoint — POST /api/mvp-lock

**Phase:** 6B
**Single Concern:** Add MVP lock batch transition endpoint to server.js
**Files to Modify:** `backend/server.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1801-1841 (Phase 6B: MVP Lock Phase — Batch Transition Endpoint)

---

## Exact Implementation

### Step 1: Add route to switch statement

```javascript
case '/api/mvp-lock':
    this._handleMvpLock(req, res);
    break;
```

### Step 2: Add handler method

```javascript
_handleMvpLock(req, res) {
    const persistence = new St8Persistence();
    persistence.initialize();

    const files = persistence.getAllFiles();
    const results = [];

    for (const file of files) {
        if (file.lifecyclePhase === 'CONCEPT' || file.lifecyclePhase === 'DEVELOPMENT') {
            persistence.db.prepare(
                `UPDATE file_registry SET lifecyclePhase = 'LOCKED' WHERE fingerprint = ?`
            ).run(file.fingerprint);

            persistence.logMutation({
                fingerprint: file.fingerprint,
                sha256Hash: file.sha256Hash,
                mutationType: 'LOCK',
                changedFields: JSON.stringify({ lifecyclePhase: [file.lifecyclePhase, 'LOCKED'] }),
                actor: 'DEVELOPER',
                metadata: '{}'
            });

            results.push({ fingerprint: file.fingerprint, filepath: file.filepath, previousPhase: file.lifecyclePhase });
        }
    }

    // Re-emit all schema cards with LOCKED phase
    const emitter = new SchemaCardEmitter(this.targetDir);
    emitter.emitAllCards(persistence);

    persistence.close();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', lockedFiles: results.length, files: results }));
}
```

---

## PARALLELIZATION

```
- Can start after: [12, 13, 14, 15, 16, 17]
- Can run parallel with: [18, 20, 21, 22]
- Must complete before: [none]
- Conflict risk: [backend/server.js, st8.sqlite — updates lifecyclePhase]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify route added
grep -n "'/api/mvp-lock'" backend/server.js
# Expected: Found

# 2. Verify handler method
grep -n "_handleMvpLock" backend/server.js
# Expected: Found

# 3. Test endpoint (server must be running)
curl -X POST http://localhost:3847/api/mvp-lock
# Expected: {"status":"ok","lockedFiles":[count],"files":[...]}

# 4. Verify all files locked
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const allLocked = files.every(f => f.lifecyclePhase === 'LOCKED');
console.log('All files locked:', allLocked);
p.close();
"
# Expected: All files locked: true

# 5. Verify schema cards re-emitted
ls -la .st8/schema-cards/
# Expected: JSON files updated with LOCKED lifecyclePhase
```

---

## Success Criteria

- [ ] `/api/mvp-lock` route added to switch statement
- [ ] `_handleMvpLock()` method added
- [ ] Endpoint accepts POST (no body required)
- [ ] Transitions CONCEPT/DEVELOPMENT files to LOCKED
- [ ] Logs LOCK mutation for each file
- [ ] Re-emits schema cards with LOCKED phase
- [ ] Returns 200 with lockedFiles count and file list

---

## Report Format

When complete, report:

```
TASK 19 COMPLETE
- Endpoint: POST /api/mvp-lock
- Handler: _handleMvpLock
- Test: PASS
- Files locked: [count]
```
