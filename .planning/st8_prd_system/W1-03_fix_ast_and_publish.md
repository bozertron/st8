# Task W1-03: Fix Empty AST on File Edit + Remove Duplicate Publish (C2)

**Category:** CRITICAL
**Single Concern:** File watcher callback correctness

---

## Specification

### Part 1: Fix Empty AST
In `backend/index.js` around line 281, change:
```javascript
const card = emitter.emitCard(changedFile, { imports: [], exports: [] }, ...);
```
To:
```javascript
const fullPath = require('path').join(targetDir, relativePath);
let astResult = { imports: [], exports: [] };
try {
    const { extractImportsAndExports } = require('./lib/utils/astParser.js');
    astResult = extractImportsAndExports(fullPath);
} catch (e) { /* AST parse failed - use empty */ }
const card = emitter.emitCard(changedFile, astResult, ...);
```

### Part 2: Remove Duplicate Publish
Remove the second `notificationBus.publish()` call (around line 286-293) that duplicates the first (around line 272-278).

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
# Start server, edit a file, check schema card has exports/imports
# Check console - should see only ONE publish per edit
```

## Report Format
- Lines modified
- AST call added at line X
- Duplicate publish removed at lines X-Y
- Verification output