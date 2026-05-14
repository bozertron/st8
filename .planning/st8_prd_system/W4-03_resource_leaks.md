# Task W4-03: Resource Leak Fixes (WR-03/04)

**Category:** Agent Warnings
**Single Concern:** Persistence resource leak prevention

---

## Specification

Fix persistence resource leaks when initialize() fails:
- In _handleFileIntent: if initialize() rejects, persistence is never closed
- In _handleSettings: if initialize() rejects, persistence is never closed

Add try/catch around initialize() with persistence.close() in catch block.

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/server.js
```

## Report Format
- Handlers fixed with line numbers
- Leak prevention implementation