# Task W2-01: Sync indexer.js Schema with persistence.js (M2)

**Category:** MEDIUM
**Single Concern:** Schema synchronization

---

## Specification

Sync the ST8_SCHEMA in indexer.js with persistence.js:
1. Add UNIQUE constraint to connections table: `UNIQUE(sourceFingerprint, targetFingerprint, connectionType)`
2. Add st8_settings table (if missing)

Both schemas MUST be identical per PHASE-SPECS.md line 616.

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/indexer.js
# Compare schemas manually or with diff tool
```

## Report Format
- Lines modified
- UNIQUE constraint added at line X
- st8_settings table added at lines X-Y