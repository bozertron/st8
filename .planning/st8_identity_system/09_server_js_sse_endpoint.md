# Task 09: server.js — SSE Endpoint + Fingerprint Fixes

**Phase:** 3B
**Single Concern:** Add SSE endpoint and fix fingerprint usage in server.js
**Files to Modify:** `backend/server.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1372-1399 (Phase 3B: server.js — Add SSE Endpoint + Fix Fingerprint + Fix _handleVerify)

---

## Exact Implementation

### Step 1: Add SSE endpoint to route handler

In the switch statement around line 91, add:

```javascript
case '/api/mutations':
    this._handleMutationsSSE(req, res);
    break;
```

### Step 2: Add the SSE handler method

```javascript
_handleMutationsSSE(req, res) {
    const { notificationBus } = require('./notificationBus');
    notificationBus.addSSEClient(res);
}
```

### Step 3: Fix _handleVerify (lines 484-525)

Replace all `file.sha256_hash` with `file.sha256Hash`
Replace all `file.file_size_bytes` with `file.fileSizeBytes`

### Step 4: Fix _handleIndex and _handleFileIntent

Replace `const fp = file.fingerprint || file.sha256Hash;` with just `file.fingerprint`
(Now that fingerprint is always set, the fallback is unnecessary)

---

## PARALLELIZATION

```
- Can start after: [01, 02, 03, 04, 05, 06, 07]
- Can run parallel with: [08, 10, 11, 23]
- Must complete before: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
- Conflict risk: [backend/server.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify SSE endpoint added
grep -n "'/api/mutations'" backend/server.js
# Expected: Found

# 2. Verify SSE handler method
grep -n "_handleMutationsSSE" backend/server.js
# Expected: Found

# 3. Verify snake_case removed
grep -n "sha256_hash" backend/server.js
grep -n "file_size_bytes" backend/server.js
# Expected: Neither found

# 4. Verify fingerprint fallback removed
grep -n "fingerprint || file.sha256Hash" backend/server.js
# Expected: Not found

# 5. Test import resolution
node -c backend/server.js
# Expected: No syntax errors
```

---

## Success Criteria

- [ ] `/api/mutations` route added to switch statement
- [ ] `_handleMutationsSSE()` method added
- [ ] `notificationBus.addSSEClient(res)` called in handler
- [ ] No `sha256_hash` references remain
- [ ] No `file_size_bytes` references remain
- [ ] No `fingerprint || file.sha256Hash` fallback remains
- [ ] File parses without syntax errors

---

## Report Format

When complete, report:

```
TASK 09 COMPLETE
- File modified: backend/server.js
- SSE endpoint: /api/mutations
- SSE handler: _handleMutationsSSE
- Snake_case removed: PASS
- Fingerprint fallback removed: PASS
```
