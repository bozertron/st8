# Task 06: Run Intent Seeder on All Files

**Phase:** 6
**Single Concern:** Generate intent for all 40 files with ??? flags
**Files to Modify:** Database (file_intent table)

---

## Specification Reference

**Gap Analysis:** D3 — Intent Authoring Gaps
**User Requirement:** Auto-apply for all files, add ??? flag

---

## Execution Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# Run intent seeder
node -e "
const { IntentSeeder } = require('./backend/intentSeeder');
const { St8Persistence } = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const seeder = new IntentSeeder(p, '.st8/schema-cards');
const result = seeder.seedAll();
console.log('Seeded:', result.seeded, 'files');
console.log('Errors:', result.errors);
p.close();
"
```

---

## PARALLELIZATION

```
- Can start after: [02, 05]
- Can run parallel with: [07]
- Must complete before: [08]
- Conflict risk: [database — file_intent table]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# Check intents in database
node -e "
const { St8Persistence } = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const intents = p.getAllIntents();
const withPurpose = Object.values(intents).filter(i => i.purpose).length;
const withFlags = Object.values(intents).filter(i => i.purpose && i.purpose.includes('???')).length;
console.log('Total intents:', Object.keys(intents).length);
console.log('With purpose:', withPurpose);
console.log('With ??? flags:', withFlags);
p.close();
"
```

---

## Success Criteria

- [ ] IntentSeeder runs without errors
- [ ] All 40 files have intent
- [ ] Every intent includes ??? flag
- [ ] Purposes are meaningful (not empty)

---

## Report Format

When complete, report:
```
TASK 06 COMPLETE
- Files seeded: [count]
- ??? flags added: [count]
- Sample purpose: "[example]"
- Verification: PASS/FAIL
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (seeder → persistence → database)
2. Error reporting is in place (per-file error handling)
3. Report covers every integration point with filepaths and line-specific details
