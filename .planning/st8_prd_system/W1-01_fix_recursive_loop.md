# Task W1-01: Fix Recursive .txt Emission Loop (C1)

**Category:** CRITICAL
**Single Concern:** Fix IGNORE_DIRS and add printer guard

---

## Specification

### Part 1: indexer.js IGNORE_DIRS
Add to the IGNORE_DIRS set at line 161:
- `.archive`
- `.planning`
- `.st8`
- `vendor`
- `snapshots`

### Part 2: schemaCardPrinter.js Guard
Add guard in `printCard()` to skip non-code files:
- Skip if filepath ends in `.txt`, `.json`, `.sqlite-wal`, `.sqlite-shm`
- Skip if filepath contains `.st8/schema-cards`

### Part 3: Clean phantom DB entries
After fixes, delete entries with `.sqlite-wal` or `.sqlite-shm` in filepath.

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
rm -f st8.sqlite
node backend/index.js . --watch --serve --port 3847
# Check .st8/schema-cards/ - should NOT contain .txt or .sqlite files
# Check .planning/st8_identity_system/ - should NOT have nested LATEST_ files
```

## Report Format
- Files modified with line numbers
- IGNORE_DIRS before/after
- Guard logic implemented
- Phantom entries cleaned count