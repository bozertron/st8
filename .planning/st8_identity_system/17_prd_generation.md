# Task 17: PRD Generation — Generate from Schema Cards

**Phase:** 5G
**Single Concern:** Generate PRD from schema cards
**Output File:** `.planning/st8_identity_system/PRD.md`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1663-1715 (Phase 5G: Generate PRD from Schema Cards)

---

## Exact Implementation

Create temporary script `generate-prd.js`:

```javascript
// generate-prd.js — PRD falls out of schema cards
const fs = require('fs');
const path = require('path');

const cardsDir = '.st8/schema-cards';
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

fs.writeFileSync('.planning/st8_identity_system/PRD.md', prd);
console.log('PRD written to .planning/st8_identity_system/PRD.md');
```

---

## PARALLELIZATION

```
- Can start after: [12, 13]
- Can run parallel with: [14, 15, 16]
- Must complete before: [18, 19, 20, 21, 22]
- Conflict risk: [.planning/st8_identity_system/PRD.md]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Generate PRD
node generate-prd.js
# Expected: PRD written to .planning/st8_identity_system/PRD.md

# 2. Verify PRD exists
ls -la .planning/st8_identity_system/PRD.md
# Expected: File exists

# 3. Verify PRD content
head -20 .planning/st8_identity_system/PRD.md
# Expected: 
# # ST8 Product Requirements Document
# Generated: [timestamp]
# Total Files: [count]

# 4. Verify PRD has all files
grep -c "### " .planning/st8_identity_system/PRD.md
# Expected: Same as number of .js files in project

# 5. Clean up script
rm -f generate-prd.js
```

---

## Success Criteria

- [ ] PRD generated at `.planning/st8_identity_system/PRD.md`
- [ ] PRD includes all files from schema cards
- [ ] Files grouped by lifecycle phase
- [ ] Each file has: fingerprint, status, purpose, exports, dependencies
- [ ] PRD header includes generation timestamp and total file count
- [ ] Script cleaned up

---

## Report Format

When complete, report:

```
TASK 17 COMPLETE
- PRD generated: .planning/st8_identity_system/PRD.md
- Files included: [count]
- Phases covered: [list]
- Script: cleaned up
```
