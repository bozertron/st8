# Task 21: Production Promote Endpoint — POST /api/production-promote

**Phase:** 6D
**Single Concern:** Add production promotion endpoint to server.js
**Files to Modify:** `backend/server.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1851-1883 (Phase 6D: Production Purge)

---

## Exact Implementation

### Step 1: Add route to switch statement

```javascript
case '/api/production-promote':
    this._handleProductionPromote(req, res);
    break;
```

### Step 2: Add handler method

```javascript
_handleProductionPromote(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        try {
            const { fingerprint } = JSON.parse(body);
            const persistence = new St8Persistence();
            persistence.initialize();

            const result = persistence.purgeDevelopmentData(fingerprint);

            persistence.close();

            notificationBus.publish({
                fingerprint,
                mutationType: 'PRODUCTION',
                actor: 'DEVELOPER'
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', ...result }));
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
- Can run parallel with: [18, 19, 20, 22]
- Must complete before: [none]
- Conflict risk: [backend/server.js, st8.sqlite — purges development data]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify route added
grep -n "'/api/production-promote'" backend/server.js
# Expected: Found

# 2. Verify handler method
grep -n "_handleProductionPromote" backend/server.js
# Expected: Found

# 3. Get a test fingerprint
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
if (files.length > 0) {
    console.log('Test fingerprint:', files[0].fingerprint);
}
p.close();
"

# 4. Test endpoint (server must be running)
curl -X POST http://localhost:3847/api/production-promote \
  -H "Content-Type: application/json" \
  -d '{"fingerprint":"[test-fingerprint]"}'
# Expected: {"status":"ok","purgedMutations":[count]}

# 5. Verify production phase
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const file = p.getFileByFingerprint('[test-fingerprint]');
console.log('Lifecycle:', file.lifecyclePhase);
const mutations = p.getMutationLog('[test-fingerprint]');
const hasProduction = mutations.some(m => m.mutationType === 'PRODUCTION');
const hasPurge = mutations.some(m => m.mutationType === 'PURGE');
console.log('PRODUCTION mutation:', hasProduction);
console.log('PURGE mutation:', hasPurge);
p.close();
"
# Expected: Lifecycle: PRODUCTION, PRODUCTION mutation: true, PURGE mutation: true
```

---

## Success Criteria

- [ ] `/api/production-promote` route added to switch statement
- [ ] `_handleProductionPromote()` method added
- [ ] Endpoint accepts POST with JSON body containing fingerprint
- [ ] Purges development mutation data
- [ ] Logs PRODUCTION mutation
- [ ] Logs PURGE mutation
- [ ] Updates lifecyclePhase to PRODUCTION
- [ ] Returns 200 with purgedMutations count

---

## Report Format

When complete, report:

```
TASK 21 COMPLETE
- Endpoint: POST /api/production-promote
- Handler: _handleProductionPromote
- Test: PASS
- Production promotion: PASS
```
