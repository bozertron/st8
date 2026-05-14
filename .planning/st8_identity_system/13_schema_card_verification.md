# Task 13: Schema Card Verification — JSON Files Emitted

**Phase:** 5B
**Single Concern:** Verify schema cards were emitted to .st8/schema-cards/
**Files to Verify:** `.st8/schema-cards/*.json`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1560-1568 (Phase 5B: Verify Schema Cards Were Emitted)

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Check JSON schema cards exist
ls -la .st8/schema-cards/
# Expected: One .json file per backend + frontend .js file

# 2. Count schema cards
ls .st8/schema-cards/*.json | wc -l
# Expected: Same as number of .js files in project

# 3. Verify schema card structure
node -e "
const fs = require('fs');
const path = require('path');
const cardsDir = '.st8/schema-cards';
const files = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'));
console.log('Schema cards:', files.length);

// Check first card
if (files.length > 0) {
    const card = JSON.parse(fs.readFileSync(path.join(cardsDir, files[0]), 'utf-8'));
    console.log('Card keys:', Object.keys(card));
    console.log('Has fingerprint:', !!card.fingerprint);
    console.log('Has filepath:', !!card.filepath);
    console.log('Has sha256Hash:', !!card.sha256Hash);
    console.log('Has lifecyclePhase:', !!card.lifecyclePhase);
    console.log('Has exports:', Array.isArray(card.exports));
    console.log('Has imports:', Array.isArray(card.imports));
    console.log('Has connections:', !!card.connections);
    console.log('Has intent:', !!card.intent);
}
"

# 4. Verify naming convention
ls .st8/schema-cards/ | head -5
# Expected: Files named like backend_server.js.json, backend_persistence.js.json

# 5. Check .txt fallbacks exist
ls -la .planning/st8_identity_system/
# Expected: LATEST_*.txt files and timestamped_*.txt files
```

---

## Success Criteria

- [ ] `.st8/schema-cards/` directory exists
- [ ] JSON files exist for each backend .js file
- [ ] JSON files exist for each frontend .js file
- [ ] Each JSON file has required fields: fingerprint, filepath, sha256Hash, lifecyclePhase, exports, imports, connections, intent
- [ ] File naming follows convention: `{sanitized-path}.json`
- [ ] `.planning/st8_identity_system/` has LATEST_*.txt files
- [ ] `.planning/st8_identity_system/` has timestamped_*.txt files

---

## Report Format

When complete, report:

```
TASK 13 COMPLETE
- Schema cards: [count] JSON files
- Naming convention: PASS
- Card structure: PASS
- .txt fallbacks: [count] files
```
