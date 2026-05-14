# Task 03: Add Gap Analysis API Endpoint

**Phase:** 4
**Single Concern:** Wire gap analyzer into server.js
**Files to Modify:** `backend/server.js`

---

## Specification Reference

**Gap Analysis:** Phase 3 — Implementation
**Integration Point:** `GET /api/gap-analysis`

---

## Exact Implementation

### Step 1: Add route to switch statement (around line 120)

```javascript
case '/api/gap-analysis':
    this._handleGapAnalysis(req, res);
    break;
```

### Step 2: Add handler method

```javascript
_handleGapAnalysis(req, res) {
    if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use GET.' }));
        return;
    }
    
    try {
        const { GapAnalyzer } = require('./gapAnalyzer');
        const { St8Persistence } = require('./persistence');
        
        const persistence = new St8Persistence();
        persistence.initialize();
        
        const schemaCardsDir = require('path').join(this.targetDir, '.st8', 'schema-cards');
        const analyzer = new GapAnalyzer(schemaCardsDir, persistence);
        const report = analyzer.analyze();
        
        persistence.close();
        
        // Content negotiation
        const accept = req.headers.accept || '';
        if (accept.includes('text/markdown')) {
            const markdown = analyzer.toMarkdown(report);
            res.writeHead(200, { 'Content-Type': 'text/markdown' });
            res.end(markdown);
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(report, null, 2));
        }
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
}
```

---

## PARALLELIZATION

```
- Can start after: [01]
- Can run parallel with: [04]
- Must complete before: [05, 06]
- Conflict risk: [backend/server.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/server.js
# Start server and test:
# curl http://localhost:3847/api/gap-analysis
# curl -H "Accept: text/markdown" http://localhost:3847/api/gap-analysis
```

---

## Success Criteria

- [ ] Route added to switch statement
- [ ] `_handleGapAnalysis()` method added
- [ ] GET-only validation
- [ ] Content negotiation (JSON vs markdown)
- [ ] Error handling in place
- [ ] `node -c` passes

---

## Report Format

When complete, report:
```
TASK 03 COMPLETE
- Route added: /api/gap-analysis (line ~120)
- Handler added: _handleGapAnalysis() (line ~X)
- Content negotiation: JSON + markdown
- Verification: PASS/FAIL
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (route → handler → analyzer → response)
2. Error reporting is in place (try/catch, 500 response)
3. Report covers every integration point with filepaths and line-specific details
