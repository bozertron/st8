# Task 05: Verify SSE Integration

**Phase:** 5
**Single Concern:** Verify SSE mutation streaming works end-to-end
**Files to Verify:** `st8.html`, `backend/server.js`, `backend/notificationBus.js`

---

## Specification Reference

**Gap Analysis:** D6 — Architectural Completeness
**SSE Endpoint:** `/api/mutations`

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Check SSE endpoint exists in server.js
grep -n "/api/mutations" backend/server.js

# 2. Check EventSource in st8.html
grep -n "EventSource" st8.html

# 3. Check notificationBus has SSE support
grep -n "addSSEClient" backend/notificationBus.js

# 4. Start server and test SSE
# node backend/index.js . --port 3847
# curl -N http://localhost:3847/api/mutations
```

---

## PARALLELIZATION

```
- Can start after: [03, 04]
- Can run parallel with: [06]
- Must complete before: [07]
- Conflict risk: [none — read-only verification]
```

---

## Success Criteria

- [ ] `/api/mutations` endpoint exists in server.js
- [ ] EventSource listener exists in st8.html
- [ ] `addSSEClient()` method exists in notificationBus.js
- [ ] SSE connection established
- [ ] Mutation events received

---

## Report Format

When complete, report:
```
TASK 05 COMPLETE
- SSE endpoint: PRESENT (line ~106)
- EventSource: PRESENT (line ~X)
- addSSEClient: PRESENT (line ~X)
- End-to-end: WORKING/NOT WORKING
- Verification: PASS/FAIL
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (server → notificationBus → SSE → frontend)
2. Error reporting is in place (connection errors handled)
3. Report covers every integration point with filepaths and line-specific details
