# Task 20: PRD Endpoint — GET /api/prd

**Phase:** 6C
**Single Concern:** Add PRD generation endpoint to server.js
**Files to Modify:** `backend/server.js`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1843-1849 (Phase 6C: PRD Generation from Schema Cards)

---

## Exact Implementation

### Step 1: Add route to switch statement

```javascript
case '/api/prd':
    this._handlePrd(req, res);
    break;
```

### Step 2: Add handler method

```javascript
_handlePrd(req, res) {
    try {
        const fs = require('fs');
        const path = require('path');
        
        const cardsDir = path.join(this.targetDir, '.st8', 'schema-cards');
        const cards = fs.readdirSync(cardsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(cardsDir, f), 'utf-8')));

        let prd = '# ST8 Product Requirements Document\n';
        prd += `Generated: ${new Date().toISOString()}\n`;
        prd += `Total Files: ${cards.length}\n\n`;

        // Group by lifecycle phase
        const byPhase = {};
        for (const card of cards) {
            const phase = card.lifecyclePhase || 'UNKNOWN';
            if (!byPhase[phase]) byPhase[phase] = [];
            byPhase[phase].push(card);
        }

        for (const [phase, phaseCards] of Object.entries(byPhase)) {
            prd += `## Phase: ${phase} (${phaseCards.length} files)\n\n`;
            for (const card of phaseCards) {
                prd += `### ${card.filepath}\n`;
                prd += `- **Fingerprint:** ${card.fingerprint}\n`;
                prd += `- **Status:** ${card.status}\n`;
                prd += `- **Purpose:** ${card.intent?.purpose || '(not set)'}\n`;

                if (card.exports && card.exports.length > 0) {
                    prd += `- **Exports:**\n`;
                    for (const exp of card.exports) {
                        prd += `  - ${exp.kind} \`${exp.name}\``;
                        if (exp.signature) prd += ` — \`${exp.signature}\``;
                        if (exp.returnType) prd += ` → ${exp.returnType}`;
                        prd += '\n';
                    }
                }

                if (card.imports && card.imports.length > 0) {
                    prd += `- **Dependencies:** ${card.imports.map(i => i.source).join(', ')}\n`;
                }

                prd += `\n`;
            }
        }

        res.writeHead(200, { 'Content-Type': 'text/markdown' });
        res.end(prd);
    } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
    }
}
```

---

## PARALLELIZATION

```
- Can start after: [12, 13, 14, 15, 16, 17]
- Can run parallel with: [18, 19, 21, 22]
- Must complete before: [none]
- Conflict risk: [backend/server.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Verify route added
grep -n "'/api/prd'" backend/server.js
# Expected: Found

# 2. Verify handler method
grep -n "_handlePrd" backend/server.js
# Expected: Found

# 3. Test endpoint (server must be running)
curl http://localhost:3847/api/prd
# Expected: Markdown content with PRD

# 4. Verify PRD structure
curl -s http://localhost:3847/api/prd | head -10
# Expected:
# # ST8 Product Requirements Document
# Generated: [timestamp]
# Total Files: [count]
```

---

## Success Criteria

- [ ] `/api/prd` route added to switch statement
- [ ] `_handlePrd()` method added
- [ ] Endpoint accepts GET request
- [ ] Returns PRD as markdown
- [ ] PRD includes all files from schema cards
- [ ] Files grouped by lifecycle phase
- [ ] Returns 200 with Content-Type: text/markdown

---

## Report Format

When complete, report:

```
TASK 20 COMPLETE
- Endpoint: GET /api/prd
- Handler: _handlePrd
- Test: PASS
- PRD format: markdown
```
