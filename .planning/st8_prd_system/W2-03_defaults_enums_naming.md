# Task W2-03: Fix upsertIntent Default + Use Enum Constants + Rename updated_at (M1 + WR-03 + WR-04)

**Category:** MEDIUM + Agent Warnings
**Single Concern:** Schema consistency and enum usage

---

## Specification

### Part 1: Fix upsertIntent Default (WR-04)
In persistence.js, upsertIntent() defaults authoredBy to 'USER'. Change to 'INFERRED' to match schema default.

### Part 2: Use Enum Constants (WR-03)
In index.js, replace string literals with imported constants:
- 'CREATE' → MutationType.CREATE
- 'EDIT' → MutationType.EDIT
- 'INDEXER' → ActorType.INDEXER
- 'WATCHER' → ActorType.WATCHER

### Part 3: Rename updated_at (M1)
In both persistence.js and indexer.js, rename `updated_at` to `updatedAt` in st8_settings table.

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/persistence.js
node -c backend/indexer.js
node -c backend/index.js
```

## Report Format
- Files modified with line numbers
- Default changed from X to Y
- Enum constants used at lines X, Y, Z
- Column renamed at lines X, Y