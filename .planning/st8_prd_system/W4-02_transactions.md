# Task W4-02: Transaction Wrapping (WR-06)

**Category:** Agent Warnings
**Single Concern:** Database transaction safety

---

## Specification

Add transaction wrapping to multi-step operations:
- deleteFile() — deletes from file_registry, connections, file_intent, file_mutation_log
- registerConceptFile() — inserts file + logs mutation

Use persistence.db.transaction() for atomicity.

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/persistence.js
```

## Report Format
- Methods wrapped with line numbers
- Transaction implementation