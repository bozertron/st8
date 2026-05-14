# Task 05: Create schemaCardEmitter.js — JSON Schema Card Emitter

**Phase:** 2A
**Single Concern:** Create the SchemaCardEmitter class
**Files to Create:** `backend/schemaCardEmitter.js`
**Directories to Create:** `.st8/schema-cards/`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 669-854 (Phase 2A: schemaCardEmitter.js)

---

## Exact Implementation

Create `backend/schemaCardEmitter.js` with the exact code from PHASE-SPECS.md lines 671-854.

The file must contain:
1. `SchemaCardEmitter` class
2. Constructor with `targetDir`, `outputDir`, `strict` options
3. `_ensureOutputDir()` method
4. `emitCard(file, astResult, connections, intent, mutationSummary)` method
5. `emitAllCards(persistence)` method
6. `_cardFilename(filepath)` method
7. `diff(file, currentCard)` method
8. CLI mode (`--diff` flag)
9. Export `SchemaCardEmitter`

**Dependencies:**
- `path` (Node.js built-in)
- `fs` (Node.js built-in)
- `st8-types` (for `validateSt8SchemaCard`, `St8SchemaCard`)

---

## PARALLELIZATION

```
- Can start after: [00]
- Can run parallel with: [01, 02, 03, 06, 07]
- Must complete before: [08, 09, 12, 13]
- Conflict risk: [backend/schemaCardEmitter.js, .st8/schema-cards/]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. File exists
ls -la backend/schemaCardEmitter.js

# 2. Node can parse it
node -c backend/schemaCardEmitter.js

# 3. Class can be instantiated
node -e "
const {SchemaCardEmitter} = require('./backend/schemaCardEmitter');
const emitter = new SchemaCardEmitter('.');
console.log('Class:', typeof SchemaCardEmitter);
console.log('Instance:', typeof emitter);
console.log('emitCard:', typeof emitter.emitCard);
console.log('emitAllCards:', typeof emitter.emitAllCards);
console.log('diff:', typeof emitter.diff);
"

# 4. Output directory created
ls -la .st8/schema-cards/
```

---

## Success Criteria

- [ ] `backend/schemaCardEmitter.js` file exists
- [ ] `node -c backend/schemaCardEmitter.js` exits 0 (valid syntax)
- [ ] `SchemaCardEmitter` class can be instantiated
- [ ] `emitCard()` method exists
- [ ] `emitAllCards()` method exists
- [ ] `diff()` method exists
- [ ] `_cardFilename()` converts paths correctly (e.g., `backend/server.js` → `backend_server.js.json`)
- [ ] `.st8/schema-cards/` directory exists
- [ ] CLI mode works with `--diff` flag

---

## Report Format

When complete, report:

```
TASK 05 COMPLETE
- File created: backend/schemaCardEmitter.js
- Directory created: .st8/schema-cards/
- Class instantiation: PASS
- Methods verified: emitCard, emitAllCards, diff, _cardFilename
- CLI mode: PASS
```
