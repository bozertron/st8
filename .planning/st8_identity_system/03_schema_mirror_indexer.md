# Task 03: Schema Mirror — indexer.js ST8_SCHEMA Duplication

**Phase:** 1C
**Single Concern:** Mirror the ST8_SCHEMA constant in indexer.js
**Files to Modify:** `backend/indexer.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 614-621 (Phase 1C: indexer.js — Mirror the same ST8_SCHEMA)

---

## Exact Implementation

### Step 1: Add import at top of indexer.js

Add after existing requires:
```javascript
const { generateFingerprint } = require('./st8-types');
```

### Step 2: Replace ST8_SCHEMA constant

Find the existing `ST8_SCHEMA` constant (lines 78-129 in original) and replace with the **exact same** schema as persistence.js.

**CRITICAL:** Both schemas MUST be identical. Copy the schema from persistence.js after Task 01 is complete.

---

## PARALLELIZATION

```
- Can start after: [01]
- Can run parallel with: [02, 05, 06, 07]
- Must complete before: [04, 08, 09, 23]
- Conflict risk: [backend/indexer.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify import exists
grep -n "require('./st8-types')" backend/indexer.js
# Expected: Line with generateFingerprint import

# 2. Verify schema matches persistence.js
node -e "
const fs = require('fs');
const persistSchema = fs.readFileSync('backend/persistence.js', 'utf-8')
    .match(/const ST8_SCHEMA = \`(.*?)\`/s)[1];
const indexerSchema = fs.readFileSync('backend/indexer.js', 'utf-8')
    .match(/const ST8_SCHEMA = \`(.*?)\`/s)[1];
console.log('Schemas match:', persistSchema === indexerSchema);
"
# Expected: Schemas match: true

# 3. Verify camelCase columns
node -e "
const fs = require('fs');
const schema = fs.readFileSync('backend/indexer.js', 'utf-8');
const hasSnakeCase = schema.includes('sha256_hash') || 
                     schema.includes('file_size_bytes') ||
                     schema.includes('reachability_score');
console.log('Has snake_case:', hasSnakeCase);
"
# Expected: Has snake_case: false
```

---

## Success Criteria

- [ ] `require('./st8-types')` import added to indexer.js
- [ ] `generateFingerprint` imported from st8-types
- [ ] ST8_SCHEMA constant replaced with camelCase version
- [ ] Schema is identical to persistence.js schema
- [ ] No snake_case column names remain

---

## Report Format

When complete, report:

```
TASK 03 COMPLETE
- File modified: backend/indexer.js
- Import added: generateFingerprint from st8-types
- Schema test: PASS (matches persistence.js)
- Column naming: camelCase verified
```
