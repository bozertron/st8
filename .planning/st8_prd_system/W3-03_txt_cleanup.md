# Task W3-03: Add .txt File Cleanup/Rotation (H5)

**Category:** HIGH
**Single Concern:** Timestamped file pruning

---

## Specification

Add to backend/schemaCardPrinter.js:

### New method: pruneOldCards(maxPerFile = 10)
1. List all .txt files in output directory
2. Group by base filename (without timestamp prefix)
3. For each group, keep only the N most recent files
4. Delete older files
5. Return { pruned: count, kept: count }

### Call after printAllFromCards():
In printAllFromCards(), call pruneOldCards() after processing all cards.

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/schemaCardPrinter.js
# Create multiple runs, verify old files are pruned
```

## Report Format
- Method added at line X
- Called at line Y
- Pruning logic verified