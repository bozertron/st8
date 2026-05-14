# Task 02: Create Intent Seeder Module

**Phase:** 3
**Single Concern:** Auto-generate intent from AST + heuristics
**Files to Create:** `backend/intentSeeder.js`

---

## Specification Reference

**Gap Analysis:** D3 — Intent Authoring Gaps
**User Requirement:** Auto-apply for all files, add ??? flag to every file

---

## Exact Implementation

Create `backend/intentSeeder.js` with:

### Class Structure
```javascript
class IntentSeeder {
    constructor(persistence, schemaCardsDir) {
        this.persistence = persistence;
        this.schemaCardsDir = schemaCardsDir;
    }
    
    seedAll() { ... }  // Seed intent for all files
    seedFile(fingerprint) { ... }  // Seed intent for one file
    _generatePurpose(filepath, filename, imports, exports) { ... }
    _generateDependsOn(imports) { ... }
    _generateValueStatement(filepath, exports) { ... }
}
```

### Heuristics for Purpose
1. From filename: `persistence.js` → "SQLite persistence layer"
2. From imports: imports `st8-types` → "depends on type definitions"
3. From exports: exports `St8Persistence` → "provides database operations"
4. From comments: `// ST8 Schema Card Emitter` → purpose statement

### ??? Flag Requirement
Every generated intent must include ??? at the end:
```
purpose: "SQLite persistence layer for st8 data ???"
dependsOnBehavior: "st8-types.js type definitions ???"
valueStatement: "Provides CRUD operations for file registry ???"
```

---

## PARALLELIZATION

```
- Can start after: [00]
- Can run parallel with: [01]
- Must complete before: [03, 04]
- Conflict risk: [backend/intentSeeder.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/intentSeeder.js
node -e "
const { IntentSeeder } = require('./backend/intentSeeder');
const { St8Persistence } = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const seeder = new IntentSeeder(p, '.st8/schema-cards');
const result = seeder.seedAll();
console.log('Seeded:', result.seeded, 'files');
console.log('Sample intent:', p.getAllIntents()[Object.keys(p.getAllIntents())[0]]);
p.close();
"
```

---

## Success Criteria

- [ ] `IntentSeeder` class created
- [ ] `seedAll()` generates intent for all files
- [ ] Every intent includes ??? flag
- [ ] Purpose derived from filename + imports
- [ ] DependsOn derived from imports
- [ ] ValueStatement derived from exports
- [ ] `node -c` passes
- [ ] Intents saved to database

---

## Report Format

When complete, report:
```
TASK 02 COMPLETE
- File created: backend/intentSeeder.js
- Lines: [count]
- Files seeded: [count]
- ??? flags added: YES
- Verification: PASS/FAIL
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (class exported, persistence integration works)
2. Error reporting is in place (try/catch around DB operations)
3. Report covers every integration point with filepaths and line-specific details
