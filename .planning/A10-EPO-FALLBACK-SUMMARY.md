# A10 EPO Fallback — Research Summary

**Status:** BLOCKER → Ready for Implementation  
**Researcher:** Agent 1 of 2  
**Date:** 2026-05-13  

---

## Key Findings

### 1. EPO Client: Never Defined
- `window.epoClient` referenced in `file-explorer.js:148` but **never instantiated**
- No EPO client library imported or bundled
- Only exists as mock pattern in testing docs

### 2. EPO Server: Does Not Exist
- `backend/server.js` is HTTP-only (no WebSocket)
- No `WebSocketServer`, `ws`, or EPO server code found
- Zero EPO server handlers in entire codebase

### 3. File Explorer: Completely Non-Functional
- `_fetchViaWebSocket()` at lines 146-158 is **only** path for directory listing
- Throws `'EPO client not loaded'` immediately in standalone mode
- No REST fallback (unlike phreak-terminal which has one)

### 4. Reference Pattern Exists
- `phreak-terminal.js:68-94` already implements EPO + REST fallback for `exec`
- Same pattern can be applied to file-explorer.js

---

## Architecture Decision

**Selected: Option A — Keep EPO + Add REST Fallback**

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **A: EPO + REST** | Consistent with phreak-terminal, minimal change, future-proof | Dead EPO code path | ✅ SELECTED |
| B: REST-only | Simpler, no dead code | Inconsistent, removes EPO path | ❌ |
| C: Implement EPO Server | Full architecture | Over-engineering, out of scope | ❌ |

**Rationale:**
1. Matches existing pattern in phreak-terminal.js
2. Minimal code changes (low risk)
3. Preserves EPO integration if server added later
4. Fixes BLOCKER without over-engineering

---

## Implementation Summary

### Backend (`backend/server.js`)
1. Add `/api/file-list` route
2. Add `_handleFileList()` handler with:
   - Path expansion (`~` → home directory)
   - Directory traversal prevention
   - `fs.readdirSync()` with `withFileTypes: true`
   - Returns `{ entries: [{ name, isDirectory, path }] }`

### Frontend (`file-explorer.js`)
1. Rename `_fetchViaWebSocket()` → `_fetchDirectory()`
2. Add REST fallback pattern:
   ```
   if (epoClient && connected) → try EPO
   catch → log warning, fall through
   fetch('/api/file-list?path=...') → REST fallback
   ```
3. Update `explorerNavigate()` to call `_fetchDirectory()`

---

## Security Measures

1. **Directory Traversal:** Expand `~`, resolve to absolute, verify under home directory
2. **Symlink Escape:** Use `fs.realpathSync()` to resolve symlinks
3. **Error Leakage:** Generic messages to client, detailed logs server-side

---

## Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `backend/server.js` | Add `/api/file-list` route + handler | ~30 lines |
| `file-explorer.js` | Rename + add REST fallback | ~15 lines |

---

## Success Criteria

- [ ] `/api/file-list` endpoint returns directory entries
- [ ] `_fetchDirectory()` tries EPO first, falls back to REST
- [ ] File Explorer navigates directories in standalone mode
- [ ] Directory traversal attacks blocked
- [ ] Error messages displayed to user

---

## Related Items

- **A8:** EPO `exec` has no server handler — phreak-terminal already has REST fallback (less critical)
- **A13:** RETRACTED — phantom code reference, A10 covers actual issue

---

**Full Decision Document:** `A10-EPO-FALLBACK-DECISION.md`  
**Implementation Effort:** Small (2-3 hours)  
**Risk:** Low (proven pattern in phreak-terminal.js)
