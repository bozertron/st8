# Task 01: Create Gap Analyzer Module

**Phase:** 3
**Single Concern:** Build 6-dimension gap analysis engine
**Files to Create:** `backend/gapAnalyzer.js`

---

## Specification Reference

**Gap Analysis:** All 6 dimensions (D1-D6)
**Vision Document:** Schema-Driven Gap Analysis plan

---

## Exact Implementation

Create `backend/gapAnalyzer.js` with:

### Class Structure
```javascript
class GapAnalyzer {
    constructor(schemaCardsDir, persistence, options = {}) {
        this.schemaCardsDir = schemaCardsDir;
        this.persistence = persistence;
        this.prdPath = options.prdPath || null;
    }
    
    analyze() { ... }  // Returns full GapReport
    _analyzeLifecycle(cards) { ... }  // D1
    _analyzeStatus(cards) { ... }  // D2
    _analyzeIntent(cards) { ... }  // D3
    _analyzeExports(cards) { ... }  // D4
    _analyzeConnections(cards) { ... }  // D5
    _analyzeArchitecture(cards) { ... }  // D6
    toMarkdown(report) { ... }
    writeReport(outputPath) { ... }
}
```

### D1: Lifecycle Progression
- Read `lifecyclePhase` from each card
- Count files in each phase
- Identify files that can progress (have intent)

### D2: Status Health
- Read `status` + `reachabilityScore`
- List RED files with potential root causes
- List GREEN files with low reachability

### D3: Intent Authoring
- Read `intent` from each card
- Count files with purpose vs "(not set)"
- Group by directory

### D4: Export Surface
- Read `exports` from each card
- Count files with exports vs empty
- Note CommonJS vs ES6

### D5: Connection Integrity
- Read `connections` from each card
- Verify imports resolve to existing files
- Find orphan imports

### D6: Architectural Completeness
- Check for required endpoints
- Check for SSE integration
- Check for PRD generation

---

## PARALLELIZATION

```
- Can start after: [00]
- Can run parallel with: [02]
- Must complete before: [03, 04]
- Conflict risk: [backend/gapAnalyzer.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/gapAnalyzer.js
node -e "
const { GapAnalyzer } = require('./backend/gapAnalyzer');
const { St8Persistence } = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const analyzer = new GapAnalyzer('.st8/schema-cards', p);
const report = analyzer.analyze();
console.log('Report sections:', Object.keys(report));
p.close();
"
```

---

## Success Criteria

- [ ] `GapAnalyzer` class created
- [ ] All 6 analysis methods implemented
- [ ] `toMarkdown()` generates readable report
- [ ] `writeReport()` writes to file
- [ ] `node -c` passes
- [ ] Report contains all 6 dimensions

---

## Report Format

When complete, report:
```
TASK 01 COMPLETE
- File created: backend/gapAnalyzer.js
- Lines: [count]
- Dimensions implemented: D1, D2, D3, D4, D5, D6
- Verification: PASS/FAIL
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (class exported, constructor works)
2. Error reporting is in place (try/catch around file reads)
3. Report covers every integration point with filepaths and line-specific details
