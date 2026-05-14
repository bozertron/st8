# Task W3-02: Implement PRD Generation (H3)

**Category:** HIGH
**Single Concern:** PRD generator module

---

## Specification

Create new file: backend/prdGenerator.js

### Functionality:
1. Read all .json files from .st8/schema-cards/ directory
2. Parse each schema card
3. Group cards by lifecyclePhase
4. Generate markdown PRD with:
   - Header with generation timestamp and file count
   - Sections per lifecycle phase
   - Per-file details: fingerprint, status, purpose, exports, dependencies
5. Write to .planning/st8_identity_system/PRD.md

### CLI Mode:
```bash
node backend/prdGenerator.js [targetDir]
```

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/prdGenerator.js
node backend/prdGenerator.js .
cat .planning/st8_identity_system/PRD.md
```

## Report Format
- File created with line count
- CLI mode works
- PRD output verified