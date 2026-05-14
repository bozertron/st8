# Task 06: Create schemaCardPrinter.js — Human-Readable Fallback

**Phase:** 2B
**Single Concern:** Create the SchemaCardPrinter class
**Files to Create:** `backend/schemaCardPrinter.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 857-1055 (Phase 2B: schemaCardPrinter.js)

---

## Exact Implementation

Create `backend/schemaCardPrinter.js` with the exact code from PHASE-SPECS.md lines 859-1055.

The file must contain:
1. `SchemaCardPrinter` class
2. Constructor with `targetDir`, `outputDir` options
3. `_ensureOutputDir()` method
4. `printCard(card)` method
5. `printAllFromCards(schemaCardsDir)` method
6. Export `SchemaCardPrinter`

**Dependencies:**
- `path` (Node.js built-in)
- `fs` (Node.js built-in)

**Output format:**
- Timestamped files: `{timestamp}_{sanitized-filename}.txt`
- Latest files: `LATEST_{sanitized-filename}.txt`
- Output directory: `.planning/st8_identity_system/`

---

## PARALLELIZATION

```
- Can start after: [00]
- Can run parallel with: [01, 02, 03, 04, 05, 07]
- Must complete before: [08, 09, 14]
- Conflict risk: [backend/schemaCardPrinter.js, .planning/st8_identity_system/]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. File exists
ls -la backend/schemaCardPrinter.js

# 2. Node can parse it
node -c backend/schemaCardPrinter.js

# 3. Class can be instantiated
node -e "
const {SchemaCardPrinter} = require('./backend/schemaCardPrinter');
const printer = new SchemaCardPrinter('.');
console.log('Class:', typeof SchemaCardPrinter);
console.log('Instance:', typeof printer);
console.log('printCard:', typeof printer.printCard);
console.log('printAllFromCards:', typeof printer.printAllFromCards);
"

# 4. Test printCard with mock data
node -e "
const {SchemaCardPrinter} = require('./backend/schemaCardPrinter');
const printer = new SchemaCardPrinter('.');

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
    exports: [{name: 'test', kind: 'function', signature: '()', returnType: 'void'}],
    imports: [{source: 'fs', specifiers: ['readFile'], importType: 'named'}],
    connections: {importedBy: [], imports: []},
    intent: {purpose: 'Test file', dependsOnBehavior: '', valueStatement: ''},
    mutationCount: 1,
    lastMutation: {type: 'CREATE', actor: 'DEVELOPER', timestamp: '2026-01-01T00:00:00.000Z'}
};

const result = printer.printCard(mockCard);
console.log('Output path:', result.path);
console.log('Latest path:', result.latestPath);
"

# 5. Verify .txt files created
ls -la .planning/st8_identity_system/LATEST_test.js.txt
ls -la .planning/st8_identity_system/*_test.js.txt
```

---

## Success Criteria

- [ ] `backend/schemaCardPrinter.js` file exists
- [ ] `node -c backend/schemaCardPrinter.js` exits 0 (valid syntax)
- [ ] `SchemaCardPrinter` class can be instantiated
- [ ] `printCard()` method exists and writes .txt files
- [ ] `printAllFromCards()` method exists
- [ ] Output files follow naming convention: `{timestamp}_{sanitized-filename}.txt`
- [ ] Latest files follow naming convention: `LATEST_{sanitized-filename}.txt`
- [ ] Output directory is `.planning/st8_identity_system/`
- [ ] .txt files contain all sections: Identity, Content Version, Classification, Exports, Imports, Connections, Intent, Mutations

---

## Report Format

When complete, report:

```
TASK 06 COMPLETE
- File created: backend/schemaCardPrinter.js
- Class instantiation: PASS
- Methods verified: printCard, printAllFromCards
- Output format: PASS
- Directory: .planning/st8_identity_system/
```
