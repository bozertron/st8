# Task W4-01: HTTP Method Validation + Body Limits (WR-01/02 + WR-07)

**Category:** Agent Warnings
**Single Concern:** Request validation hardening

---

## Specification

### Part 1: Method Validation
Add POST-only validation to:
- /api/index (currently accepts any method)
- /api/file-intent (currently accepts any method)

### Part 2: Body Size Limits
Add 1KB body size limit to all POST endpoints that parse JSON body.

---

## Verification
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -c backend/server.js
# Test GET to POST endpoints returns 405
```

## Report Format
- Routes hardened with line numbers
- Body limit implementation