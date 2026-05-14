# Task 04: Fingerprint Generation — indexer.js Update

**Phase:** 1D
**Single Concern:** Update fingerprint generation in indexDirectory()
**Files to Modify:** `backend/indexer.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 623-648 (Phase 1D: indexer.js — Update indexDirectory() fingerprint generation)

---

## Exact Implementation

### Update hashedFiles map in indexDirectory()

Find the `hashedFiles` map (around line 322-332) and replace with:

```javascript
const hashedFiles = files.map(file => {
    const hash = hashFile(file);
    const stat = fs.statSync(file);
    const filepath = path.relative(targetDir, file);
    const birthTimestamp = stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString();
    return {
        filepath: filepath,
        filename: path.basename(file),
        sha256Hash: hash,
        fileSizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
        birthTimestamp: birthTimestamp,
        fingerprint: generateFingerprint(filepath, birthTimestamp),
        lifecyclePhase: 'DEVELOPMENT',
        isEntryPoint: false
    };
});
```

**Key changes:**
- Added `birthTimestamp` (from stat.birthtime or stat.mtime)
- Added `fingerprint` (generated from filepath + birthTimestamp)
- Added `lifecyclePhase: 'DEVELOPMENT'`
- Added `isEntryPoint: false`

---

## PARALLELIZATION

```
- Can start after: [03]
- Can run parallel with: [02, 05, 06, 07, 08]
- Must complete before: [09, 12]
- Conflict risk: [backend/indexer.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify fingerprint generation code exists
grep -n "generateFingerprint" backend/indexer.js
# Expected: At least 2 matches (import + usage)

# 2. Verify birthTimestamp extraction
grep -n "birthTimestamp" backend/indexer.js
# Expected: At least 2 matches

# 3. Verify lifecyclePhase and isEntryPoint defaults
grep -n "lifecyclePhase.*DEVELOPMENT" backend/indexer.js
grep -n "isEntryPoint.*false" backend/indexer.js
# Expected: Both found

# 4. Test fingerprint generation
node -e "
const {generateFingerprint} = require('./backend/st8-types');
const fp = generateFingerprint('test.js', '2026-01-01T00:00:00.000Z');
console.log('Fingerprint:', fp);
console.log('Format correct:', fp === 'test.js:2026-01-01T00:00:00.000Z');
"
# Expected: Format correct: true
```

---

## Success Criteria

- [ ] `generateFingerprint` imported from st8-types
- [ ] `birthTimestamp` extracted from stat.birthtime or stat.mtime
- [ ] `fingerprint` generated using generateFingerprint(filepath, birthTimestamp)
- [ ] `lifecyclePhase: 'DEVELOPMENT'` added to hashedFiles output
- [ ] `isEntryPoint: false` added to hashedFiles output
- [ ] Fingerprint format is `filepath:birthTimestamp`

---

## Report Format

When complete, report:

```
TASK 04 COMPLETE
- File modified: backend/indexer.js
- Fingerprint generation: PASS
- Birth timestamp extraction: PASS
- Default values: PASS
```
