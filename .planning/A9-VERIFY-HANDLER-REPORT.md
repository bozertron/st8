# A9: VERIFY Button Routing — Backend Handler Research Report

## Agent 2 of 2: Backend Handler Design & Implementation

---

## Executive Summary

The VERIFY button in `file-explorer.js` currently routes through the generic `/api/exec` endpoint (shell command execution), which is insecure and unstructured. This report designs and implements a dedicated `/api/verify` endpoint that performs integrity checks against the ST8 database.

---

## Current State Analysis

### Frontend Flow (file-explorer.js)

```javascript
// Line 607-638: _verifyCodebase()
async function _verifyCodebase() {
    const targetPath = explorerState.currentPath;
    // ...
    await window.PhreakTerminal.execute('verify ' + targetPath);
}
```

The verify command goes through:
1. `PhreakTerminal.execute('verify <path>')` 
2. → EPO WebSocket OR `/api/exec` fallback
3. → `execSync(command)` — runs arbitrary shell command

**Problem:** No actual verification logic exists. The command runs through a generic shell executor.

### Backend Infrastructure Available

| Component | Location | Purpose |
|-----------|----------|---------|
| `hashFile(filePath)` | `backend/indexer.js:168` | SHA256 hash computation |
| `St8Persistence` | `backend/persistence.js` | SQLite database layer |
| `file_registry` table | persistence.js:47-58 | Stores file fingerprints, hashes, status |
| `connections` table | persistence.js:60-71 | Import/dependency relationships |
| `discoverFiles(targetDir)` | indexer.js:136 | File discovery with ignore patterns |

### Database Schema (file_registry)

```sql
CREATE TABLE file_registry (
  fingerprint TEXT PRIMARY KEY,
  filepath TEXT NOT NULL,
  filename TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  file_size_bytes INTEGER,
  status TEXT DEFAULT 'GREEN',
  reachability_score REAL DEFAULT 0.0,
  impact_radius INTEGER DEFAULT 0,
  last_modified TEXT,
  last_indexed TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Verification Logic Design

### What "Verify" Means in ST8

Verification checks the integrity of the indexed codebase against the database:

1. **Existence Check** — Do indexed files still exist on disk?
2. **Hash Integrity** — Do current file hashes match stored hashes?
3. **Orphan Detection** — Are there new files not in the index?
4. **Connection Validation** — Do imported files still exist?

### Verification Levels

| Level | Check | Severity |
|-------|-------|----------|
| 1 | File exists | CRITICAL |
| 2 | Hash matches | WARNING |
| 3 | Size matches | INFO |
| 4 | Connections valid | WARNING |

---

## API Contract Design

### Request

```
POST /api/verify
Content-Type: application/json

{
  "path": "/absolute/path/to/directory"  // optional, defaults to targetDir
}
```

### Response (Success)

```json
{
  "status": "ok",
  "timestamp": "2026-05-13T...",
  "targetDir": "/path/to/verified",
  "summary": {
    "totalFiles": 42,
    "verified": 38,
    "modified": 3,
    "missing": 1,
    "orphans": 2
  },
  "files": [
    {
      "filepath": "src/index.js",
      "fingerprint": "abc123...",
      "status": "VERIFIED",        // VERIFIED | MODIFIED | MISSING
      "storedHash": "abc123...",
      "currentHash": "abc123...",
      "hashMatch": true,
      "sizeMatch": true
    }
  ],
  "orphans": [
    {
      "filepath": "src/new-file.js",
      "reason": "not_in_index"
    }
  ],
  "issues": [
    {
      "filepath": "src/changed.js",
      "severity": "WARNING",
      "message": "Hash mismatch: file modified since last index"
    }
  ]
}
```

### Response (Error)

```json
{
  "error": "No target directory configured"
}
```

### HTTP Status Codes

| Code | Condition |
|------|-----------|
| 200 | Verification complete |
| 400 | Invalid request body |
| 405 | Method not allowed (not POST) |
| 500 | Server error / no target dir |

---

## Implementation Plan

### Files to Modify

1. **`backend/server.js`** — Add route and handler method

### New Dependencies

None — uses existing `hashFile()` from indexer.js and `St8Persistence` from persistence.js.

---

## Handler Implementation

### Changes Made

**File:** `backend/server.js`

1. **Route added** (line 103-105):
```javascript
case '/api/verify':
    this._handleVerify(req, res);
    break;
```

2. **Handler method** (lines 333-506): `_handleVerify(req, res)`

### Implementation Details

```javascript
_handleVerify(req, res) {
    // 1. Method validation — POST only (405 if not)
    // 2. Parse body for optional { path } parameter
    // 3. Resolve and validate target directory
    // 4. Initialize St8Persistence
    // 5. Get all indexed files from database
    // 6. For each file:
    //    - Check existence on disk
    //    - Compute current SHA256 hash
    //    - Compare with stored hash
    //    - Check file size match
    //    - Report VERIFIED | MODIFIED | MISSING | ERROR
    // 7. Detect orphan files (on disk but not in index)
    // 8. Log verification activity to database
    // 9. Return structured JSON response
}
```

### Key Design Decisions

1. **POST-only** — Verification is an action, not a read. POST is semantically correct.

2. **Optional path parameter** — Falls back to `this.targetDir` if not provided. Allows verification of subdirectories.

3. **Reuses existing infrastructure** — No new dependencies. Uses `hashFile()` pattern from indexer.js and `St8Persistence` for database access.

4. **Orphan detection** — Uses `discoverFiles()` from indexer.js to find files on disk that aren't in the index.

5. **Activity logging** — Every verification is logged to the `activity_log` table for audit trail.

6. **Structured response** — Returns summary counts, per-file status, orphan list, and issues array for UI consumption.

### Security Considerations

- Path traversal protection via `path.resolve()` (resolves `..` components)
- Method validation prevents GET-based probing
- No shell execution (unlike `/api/exec`)
- Database operations are parameterized (SQL injection safe)

---

## Integration Guide

### Frontend Update Required

The `_verifyCodebase()` function in `file-explorer.js` should be updated to call the new endpoint directly instead of routing through PhreakTerminal:

```javascript
async function _verifyCodebase() {
    const targetPath = explorerState.currentPath;
    if (!targetPath || targetPath === '~') {
        console.warn('[st8] Cannot verify home directory');
        return;
    }
    
    const verifyBtn = document.getElementById('explorer-verify-btn');
    if (!verifyBtn) return;
    
    verifyBtn.classList.add('verifying');
    verifyBtn.textContent = 'VERIFYING...';
    verifyBtn.disabled = true;
    
    try {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath })
        });
        const result = await response.json();
        
        if (result.status === 'ok') {
            // Update UI with verification results
            console.info('[st8] Verification complete:', result.summary);
            // Could trigger signal or update file list
            if (window.PhreakTerminal) {
                window.PhreakTerminal.receiveSignal({
                    type: 'system',
                    data: {
                        title: 'Verification Complete',
                        body: `${result.summary.verified} verified, ${result.summary.modified} modified, ${result.summary.missing} missing`
                    },
                    provisioned: true
                });
            }
        } else {
            console.error('[st8] Verification failed:', result.error);
        }
    } catch (err) {
        console.error('[st8] Verification error:', err);
    } finally {
        verifyBtn.classList.remove('verifying');
        verifyBtn.textContent = 'VERIFY';
        verifyBtn.disabled = false;
    }
}
```

---

## Testing

### Manual Test Commands

```bash
# Start server
node backend/server.js --target-dir /path/to/project

# Run verification
curl -X POST http://localhost:3847/api/verify \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project"}'

# Test method validation
curl http://localhost:3847/api/verify
# Expected: 405 Method not allowed

# Test missing directory
curl -X POST http://localhost:3847/api/verify \
  -H "Content-Type: application/json" \
  -d '{"path": "/nonexistent"}'
# Expected: 400 Directory not found
```

### Expected Response Shape

```json
{
  "status": "ok",
  "timestamp": "2026-05-13T...",
  "targetDir": "/path/to/project",
  "summary": {
    "totalFiles": 42,
    "verified": 38,
    "modified": 3,
    "missing": 1,
    "orphans": 2
  },
  "files": [...],
  "orphans": [...],
  "issues": [...]
}
```

---

## Conclusion

The `/api/verify` endpoint is now implemented and ready for integration. It provides structured verification of the indexed codebase against the database, reporting file integrity, modifications, missing files, and orphan detection.

**Status:** ✅ Implementation complete
**Next step:** Update frontend `_verifyCodebase()` to use the new endpoint directly
