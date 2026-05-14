# Task 18: Concept File Endpoint — POST /api/concept-file

**Phase:** 6A
**Single Concern:** Add concept file registration endpoint to server.js
**Files to Modify:** `backend/server.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1725-1799 (Phase 6A: Pre-code Concept Phase — Full Implementation)

---

## Exact Implementation

### Step 1: Add route to switch statement

```javascript
case '/api/concept-file':
    this._handleConceptFile(req, res);
    break;
```

### Step 2: Add handler method

```javascript
_handleConceptFile(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const { filepath, purpose, dependsOnBehavior, valueStatement } = JSON.parse(body);

            if (!filepath) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'filepath is required' }));
                return;
            }

            const persistence = new St8Persistence();
            persistence.initialize();

            const fingerprint = persistence.registerConceptFile({
                filepath,
                filename: path.basename(filepath),
                actor: 'DEVELOPER'
            });

            // Also set intent if provided
            if (purpose || dependsOnBehavior || valueStatement) {
                persistence.setIntent(fingerprint, {
                    purpose: purpose || '',
                    dependsOnBehavior: dependsOnBehavior || '',
                    valueStatement: valueStatement || ''
                });
            }

            persistence.close();

            notificationBus.publish({
                fingerprint,
                filepath,
                mutationType: 'CONCEPT',
                actor: 'DEVELOPER'
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', fingerprint, lifecyclePhase: 'CONCEPT' }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}
```

---

## PARALLELIZATION

```
- Can start after: [12, 13, 14, 15, 16, 17]
- Can run parallel with: [19, 20, 21, 22]
- Must complete before: [none]
- Conflict risk: [backend/server.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify route added
grep -n "'/api/concept-file'" backend/server.js
# Expected: Found

# 2. Verify handler method
grep -n "_handleConceptFile" backend/server.js
# Expected: Found

# 3. Test endpoint (server must be running)
curl -X POST http://localhost:3847/api/concept-file \
  -H "Content-Type: application/json" \
  -d '{"filepath":"backend/testConcept.js","purpose":"Test concept","dependsOnBehavior":"","valueStatement":""}'
# Expected: {"status":"ok","fingerprint":"backend/testConcept.js:[timestamp]","lifecyclePhase":"CONCEPT"}

# 4. Verify concept file in database
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const file = p.getFileByPath('backend/testConcept.js');
console.log('File exists:', !!file);
console.log('Status:', file.status);
console.log('Lifecycle:', file.lifecyclePhase);
p.close();
"
# Expected: File exists: true, Status: CONCEPT, Lifecycle: CONCEPT

# 5. Clean up test concept
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
p.deleteFile('backend/testConcept.js');
p.close();
"
```

---

## Success Criteria

- [ ] `/api/concept-file` route added to switch statement
- [ ] `_handleConceptFile()` method added
- [ ] Endpoint accepts POST with JSON body
- [ ] Returns 400 if filepath missing
- [ ] Registers concept file in database
- [ ] Sets intent if provided
- [ ] Publishes CONCEPT mutation event
- [ ] Returns 200 with fingerprint and lifecyclePhase

---

## Report Format

When complete, report:

```
TASK 18 COMPLETE
- Endpoint: POST /api/concept-file
- Handler: _handleConceptFile
- Test: PASS
- Concept registration: PASS
```
