# Task 07: Create notificationBus.js — Event Bus + SSE

**Phase:** 2C
**Single Concern:** Create the NotificationBus class
**Files to Create:** `backend/notificationBus.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1058-1167 (Phase 2C: notificationBus.js)

---

## Exact Implementation

Create `backend/notificationBus.js` with the exact code from PHASE-SPECS.md lines 1060-1167.

The file must contain:
1. `NotificationBus` class (extends EventEmitter)
2. Constructor with `maxSseClients` option
3. `setPrinter(printer)` method
4. `publish(event)` method
5. `addSSEClient(res)` method
6. `_broadcastSSE(event)` method
7. Singleton instance `notificationBus`
8. Export both `NotificationBus` class and `notificationBus` singleton

**Dependencies:**
- `events` (Node.js built-in)

**Event types:**
- `mutation` — generic mutation event
- `mutation:{type}` — specific mutation type (e.g., `mutation:EDIT`)

**SSE format:**
- Initial connection event: `{ type: 'connected', timestamp: '...' }`
- Mutation events: full event object with `publishedAt` field

---

## PARALLELIZATION

```
- Can start after: [00]
- Can run parallel with: [01, 02, 03, 04, 05, 06]
- Must complete before: [08, 09, 14, 18, 19, 20, 21, 22]
- Conflict risk: [backend/notificationBus.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. File exists
ls -la backend/notificationBus.js

# 2. Node can parse it
node -c backend/notificationBus.js

# 3. Class can be instantiated
node -e "
const {NotificationBus, notificationBus} = require('./backend/notificationBus');
console.log('Class:', typeof NotificationBus);
console.log('Singleton:', typeof notificationBus);
console.log('publish:', typeof notificationBus.publish);
console.log('addSSEClient:', typeof notificationBus.addSSEClient);
console.log('setPrinter:', typeof notificationBus.setPrinter);
"

# 4. Test event emission
node -e "
const {notificationBus} = require('./backend/notificationBus');

// Listen for events
notificationBus.on('mutation', (event) => {
    console.log('Received mutation:', event.mutationType);
    console.log('Has publishedAt:', !!event.publishedAt);
});

notificationBus.on('mutation:EDIT', (event) => {
    console.log('Received EDIT event:', event.filepath);
});

// Publish a test event
notificationBus.publish({
    fingerprint: 'test.js:2026-01-01T00:00:00.000Z',
    filepath: 'test.js',
    mutationType: 'EDIT',
    actor: 'DEVELOPER',
    sha256Hash: 'abc123'
});
"

# 5. Test printer integration
node -e "
const {notificationBus} = require('./backend/notificationBus');
const {SchemaCardPrinter} = require('./backend/schemaCardPrinter');

const printer = new SchemaCardPrinter('.');
notificationBus.setPrinter(printer);

// Mock schema card
const mockCard = {
    fingerprint: 'test.js:2026-01-01T00:00:00.000Z',
    filepath: 'test.js',
    filename: 'test.js',
    sha256Hash: 'abc123',
    fileSizeBytes: 100,
    status: 'GREEN',
    reachabilityScore: 0.5,
    impactRadius: 1,
    lifecyclePhase: 'DEVELOPMENT',
    birthTimestamp: '2026-01-01T00:00:00.000Z',
    lastModified: '2026-01-01T00:00:00.000Z',
    lastIndexed: '2026-01-01T00:00:00.000Z',
    isEntryPoint: false,
    exports: [],
    imports: [],
    connections: {importedBy: [], imports: []},
    intent: {purpose: '', dependsOnBehavior: '', valueStatement: ''},
    mutationCount: 1,
    lastMutation: {type: 'EDIT', actor: 'DEVELOPER', timestamp: '2026-01-01T00:00:00.000Z'}
};

notificationBus.publish({
    fingerprint: 'test.js:2026-01-01T00:00:00.000Z',
    filepath: 'test.js',
    mutationType: 'EDIT',
    actor: 'DEVELOPER',
    sha256Hash: 'abc123',
    schemaCard: mockCard
});

console.log('Printer integration: PASS');
"
```

---

## Success Criteria

- [ ] `backend/notificationBus.js` file exists
- [ ] `node -c backend/notificationBus.js` exits 0 (valid syntax)
- [ ] `NotificationBus` class extends EventEmitter
- [ ] `notificationBus` singleton instance exported
- [ ] `publish()` method emits `mutation` and `mutation:{type}` events
- [ ] `publish()` adds `publishedAt` timestamp to events
- [ ] `addSSEClient()` method exists and handles SSE connections
- [ ] `setPrinter()` method exists for printer integration
- [ ] `_broadcastSSE()` method exists for SSE broadcasting
- [ ] Console output shows mutation status icons

---

## Report Format

When complete, report:

```
TASK 07 COMPLETE
- File created: backend/notificationBus.js
- Class instantiation: PASS
- Methods verified: publish, addSSEClient, setPrinter, _broadcastSSE
- Event emission: PASS
- Printer integration: PASS
```
