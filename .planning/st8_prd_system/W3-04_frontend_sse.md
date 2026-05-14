# Task W3-04: Frontend SSE Integration (H2)

**Category:** HIGH
**Single Concern:** Frontend mutation notification

---

## Specification

Add to st8.html or void-engine.js:

### EventSource Listener:
```javascript
const mutationSource = new EventSource('http://localhost:3847/api/mutations');

mutationSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('[st8] Mutation:', data.mutationType, data.filepath);
    // Display notification in UI
};

mutationSource.onerror = () => {
    console.warn('[st8] Mutation stream disconnected — will auto-reconnect');
};
```

### UI Notification:
- Show mutation type badge (CREATE, EDIT, LOCK, etc.)
- Show filepath
- Show timestamp
- Auto-dismiss after 5 seconds

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
# Start server, open browser, edit a file, see notification
```

## Report Format
- EventSource added at line X
- UI notification implemented
- Auto-reconnect verified