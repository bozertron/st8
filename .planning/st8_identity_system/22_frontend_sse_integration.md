# Task 22: Frontend SSE Integration — EventSource Listener

**Phase:** 6E
**Single Concern:** Add SSE listener to frontend for mutation notifications
**Files to Modify:** `st8.html` or `void-engine.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1885-1910 (Phase 6E: Frontend Notification UI — SSE Integration)

---

## Exact Implementation

Add EventSource listener to `st8.html` or `void-engine.js`:

```javascript
// Connect to mutation notification stream
const mutationSource = new EventSource('http://localhost:3847/api/mutations');

mutationSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('[st8] Mutation:', data.mutationType, data.filepath);

    // Display notification in st8 UI
    // This is where the visual system would show:
    // - File change indicator
    // - Mutation type badge
    // - Timestamp
    // - Actor attribution
};

mutationSource.onerror = () => {
    console.warn('[st8] Mutation stream disconnected — will auto-reconnect');
};
```

**Fallback when UI is offline:** The `.txt` files in `.planning/st8_identity_system/` serve as the persistent record. The `LATEST_*.txt` files are always overwritten with the current state, while timestamped files provide the audit trail.

---

## PARALLELIZATION

```
- Can start after: [12, 13, 14, 15, 16, 17]
- Can run parallel with: [18, 19, 20, 21]
- Must complete before: [none]
- Conflict risk: [st8.html, void-engine.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify EventSource code added
grep -n "EventSource" st8.html void-engine.js
# Expected: Found in one of the files

# 2. Verify endpoint URL
grep -n "localhost:3847/api/mutations" st8.html void-engine.js
# Expected: Found

# 3. Verify onmessage handler
grep -n "onmessage" st8.html void-engine.js
# Expected: Found

# 4. Verify onerror handler
grep -n "onerror" st8.html void-engine.js
# Expected: Found

# 5. Test in browser (manual)
# Open http://localhost:3847 in browser
# Open browser console
# Make a file change
# Verify console shows: [st8] Mutation: EDIT [filepath]
```

---

## Success Criteria

- [ ] EventSource listener added to frontend
- [ ] Endpoint URL is `http://localhost:3847/api/mutations`
- [ ] `onmessage` handler exists
- [ ] `onerror` handler exists
- [ ] Console logs mutation type and filepath
- [ ] Fallback .txt files documented

---

## Report Format

When complete, report:

```
TASK 22 COMPLETE
- File modified: [st8.html or void-engine.js]
- EventSource: PASS
- Endpoint: http://localhost:3847/api/mutations
- Handlers: onmessage, onerror
```
