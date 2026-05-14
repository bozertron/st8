# Task 07: Run Full Gap Analysis

**Phase:** 6
**Single Concern:** Generate gap analysis report
**Files to Create:** `.st8/gap-analysis.md`

---

## Specification Reference

**Gap Analysis:** All 6 dimensions (D1-D6)
**Output:** `.st8/gap-analysis.md`

---

## Execution Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# Run gap analysis via API endpoint
# Start server first, then:
# curl -H "Accept: text/markdown" http://localhost:3847/api/gap-analysis > .st8/gap-analysis.md

# Or run directly:
node -e "
const { GapAnalyzer } = require('./backend/gapAnalyzer');
const { St8Persistence } = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const analyzer = new GapAnalyzer('.st8/schema-cards', p);
const report = analyzer.analyze();
analyzer.writeReport('.st8/gap-analysis.md');
console.log('Report written to .st8/gap-analysis.md');
console.log('Sections:', Object.keys(report));
p.close();
"
```

---

## PARALLELIZATION

```
- Can start after: [03, 04, 06]
- Can run parallel with: [none — final analysis]
- Must complete before: [08]
- Conflict risk: [.st8/gap-analysis.md]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# Check report exists and has content
ls -la .st8/gap-analysis.md
wc -l .st8/gap-analysis.md

# Check all 6 dimensions present
grep -c "D1:" .st8/gap-analysis.md
grep -c "D2:" .st8/gap-analysis.md
grep -c "D3:" .st8/gap-analysis.md
grep -c "D4:" .st8/gap-analysis.md
grep -c "D5:" .st8/gap-analysis.md
grep -c "D6:" .st8/gap-analysis.md
```

---

## Success Criteria

- [ ] `.st8/gap-analysis.md` created
- [ ] Report has all 6 dimensions (D1-D6)
- [ ] Executive summary present
- [ ] Action plan included
- [ ] File is non-empty (>100 lines)

---

## Report Format

When complete, report:
```
TASK 07 COMPLETE
- Report created: .st8/gap-analysis.md
- Lines: [count]
- Dimensions: D1, D2, D3, D4, D5, D6
- Verification: PASS/FAIL
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (analyzer → report → file)
2. Error reporting is in place (file write errors handled)
3. Report covers every integration point with filepaths and line-specific details
