# Task 04: Wire Gap Analysis into Index Pipeline

**Phase:** 4
**Single Concern:** Run gap analysis after schema card emission
**Files to Modify:** `backend/index.js`

---

## Specification Reference

**Gap Analysis:** Phase 3 — Integration Point
**Location:** After `emitAllCards()` and `printAllFromCards()`

---

## Exact Implementation

### Step 1: Add imports (around line 22)

```javascript
const { GapAnalyzer } = require('./gapAnalyzer');
```

### Step 2: Add after schema card emission (after line ~159)

```javascript
// Run gap analysis
const schemaCardsDir = require('path').join(targetDir, '.st8', 'schema-cards');
const analyzer = new GapAnalyzer(schemaCardsDir, persistence);
const gapReport = analyzer.analyze();
analyzer.writeReport(require('path').join(targetDir, '.st8', 'gap-analysis.md'));
console.log('[st8] Gap analysis written to .st8/gap-analysis.md');
```

---

## PARALLELIZATION

```
- Can start after: [01]
- Can run parallel with: [03]
- Must complete before: [05, 06]
- Conflict risk: [backend/index.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/index.js
# Run full index and check for gap-analysis.md:
# node backend/index.js . --port 3847
# cat .st8/gap-analysis.md
```

---

## Success Criteria

- [ ] `GapAnalyzer` imported
- [ ] Gap analysis runs after schema card emission
- [ ] Report written to `.st8/gap-analysis.md`
- [ ] Console log shows completion
- [ ] `node -c` passes

---

## Report Format

When complete, report:
```
TASK 04 COMPLETE
- Import added: line ~22
- Integration point: after schema card emission (line ~159)
- Output: .st8/gap-analysis.md
- Verification: PASS/FAIL
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (import → analyzer → writeReport)
2. Error reporting is in place (try/catch around analysis)
3. Report covers every integration point with filepaths and line-specific details
