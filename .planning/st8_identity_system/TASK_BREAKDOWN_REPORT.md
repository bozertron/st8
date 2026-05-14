# ST8 Identity System — Task Breakdown Report

**Date:** 2026-05-13
**Status:** READY FOR EXECUTION
**Total Tasks:** 24 (00-23)

---

## Summary

The ST8 Identity System execution plan has been broken down into **24 single-concern tasks** to avoid context drift and ensure each change is properly verified.

---

## Task List

| Task | Phase | Name | Description | Dependencies |
|------|-------|------|-------------|--------------|
| 00 | 0 | st8-types.js | Create canonical type definitions | None |
| 01 | 1A | Schema Constants | Replace ST8_SCHEMA in persistence.js | 00 |
| 02 | 1B | New Methods | Add new methods to persistence.js | 01 |
| 03 | 1C | Schema Mirror | Mirror ST8_SCHEMA in indexer.js | 01 |
| 04 | 1D | Fingerprint Generation | Update fingerprint generation in indexer.js | 03 |
| 05 | 2A | Schema Card Emitter | Create schemaCardEmitter.js | 00 |
| 06 | 2B | Schema Card Printer | Create schemaCardPrinter.js | 00 |
| 07 | 2C | Notification Bus | Create notificationBus.js | 00 |
| 08 | 3A | index.js Wiring | Wire mutation logging + schema card emission | 01-07 |
| 09 | 3B | server.js SSE | Add SSE endpoint + fix fingerprint | 01-07 |
| 10 | 3C | fileWatcher.js | Verify no changes needed | 00 |
| 11 | 4 | Normalization | snake_case → camelCase across codebase | 01-04 |
| 12 | 5A | Bootstrap | Delete DB + fresh index | 08-11, 23 |
| 13 | 5B | Schema Card Verification | Verify JSON files emitted | 12 |
| 14 | 5C | Mutation Logging | Test mutation logging | 12 |
| 15 | 5E | Concept Phase | Test concept file registration | 12 |
| 16 | 5F | MVP Lock | Test MVP lock transition | 12 |
| 17 | 5G | PRD Generation | Generate PRD from schema cards | 12, 13 |
| 18 | 6A | Concept Endpoint | POST /api/concept-file | 12-17 |
| 19 | 6B | MVP Lock Endpoint | POST /api/mvp-lock | 12-17 |
| 20 | 6C | PRD Endpoint | GET /api/prd | 12-17 |
| 21 | 6D | Production Endpoint | POST /api/production-promote | 12-17 |
| 22 | 6E | Frontend SSE | EventSource listener | 12-17 |
| 23 | 3A | index.js FileWatcher Callback | Wire mutation logging + schema card emission into watcher | 01-07 |

---

## Dependency Graph

```
Phase 0: [00] st8-types.js
    │
    ├─► Phase 1: [01] Schema Constants ─► [02] New Methods
    │   │
    │   └─► [03] Schema Mirror (needs 01) ─► [04] Fingerprint Generation
    │
    ├─► Phase 2: [05] Schema Card Emitter
    │           [06] Schema Card Printer
    │           [07] Notification Bus
    │
    ├─► Phase 3: [08] index.js Wiring (needs 01-07)
    │           [09] server.js SSE (needs 01-07)
    │           [10] fileWatcher.js (needs 00)
    │           [23] index.js FileWatcher Callback (needs 01-07)
    │
    ├─► Phase 4: [11] Normalization (needs 01-04)
    │
    ├─► Phase 5: [12] Bootstrap (needs 08-11, 23)
    │   │
    │   ├─► [13] Schema Card Verification
    │   ├─► [14] Mutation Logging
    │   ├─► [15] Concept Phase
    │   ├─► [16] MVP Lock
    │   └─► [17] PRD Generation (needs 12, 13)
    │
    └─► Phase 6: [18] Concept Endpoint (needs 12-17)
                [19] MVP Lock Endpoint (needs 12-17)
                [20] PRD Endpoint (needs 12-17)
                [21] Production Endpoint (needs 12-17)
                [22] Frontend SSE (needs 12-17)
```

---

## Parallelization Waves

### Wave 1: Foundation (Sequential)
- **Task 00** — st8-types.js (must complete first)

### Wave 2: Schema + Modules (Parallel)
- **Task 01** — Schema Constants (persistence.js)
- **Task 05** — Schema Card Emitter
- **Task 06** — Schema Card Printer
- **Task 07** — Notification Bus
- **Task 10** — fileWatcher.js Verification

### Wave 3: Methods + Fingerprint + Schema Mirror (Parallel)
- **Task 02** — New Methods (persistence.js) — needs 01
- **Task 03** — Schema Mirror (indexer.js) — needs 01
- **Task 04** — Fingerprint Generation (indexer.js) — needs 03

### Wave 4: Integration Wiring (Parallel)
- **Task 08** — index.js Wiring — needs 01-07
- **Task 09** — server.js SSE — needs 01-07
- **Task 11** — Normalization — needs 01-04
- **Task 23** — index.js FileWatcher Callback — needs 01-07

### Wave 5: Bootstrap (Sequential)
- **Task 12** — Bootstrap — needs 08-11, 23

### Wave 6: Verification (Parallel)
- **Task 13** — Schema Card Verification — needs 12
- **Task 14** — Mutation Logging — needs 12
- **Task 15** — Concept Phase — needs 12
- **Task 16** — MVP Lock — needs 12
- **Task 17** — PRD Generation — needs 12, 13

### Wave 7: Advanced Features (Parallel)
- **Task 18** — Concept Endpoint — needs 12-17
- **Task 19** — MVP Lock Endpoint — needs 12-17
- **Task 20** — PRD Endpoint — needs 12-17
- **Task 21** — Production Endpoint — needs 12-17
- **Task 22** — Frontend SSE — needs 12-17

---

## Agent Slot Requirements

### Minimum Sequential Execution
- **1 agent**, 24 tasks
- Estimated: 24 task completions

### Maximum Parallel Execution
- **Wave 1:** 1 agent (Task 00)
- **Wave 2:** 5 agents (Tasks 01, 05, 06, 07, 10)
- **Wave 3:** 3 agents (Tasks 02, 03, 04)
- **Wave 4:** 4 agents (Tasks 08, 09, 11, 23)
- **Wave 5:** 1 agent (Task 12)
- **Wave 6:** 5 agents (Tasks 13, 14, 15, 16, 17)
- **Wave 7:** 5 agents (Tasks 18, 19, 20, 21, 22)

**Maximum agents needed:** 5 (Waves 2, 6, 7)

### Recommended Agent Assignment
- **Agent A:** Tasks 00, 01, 02, 03, 04, 11 (Foundation + Schema + Normalization)
- **Agent B:** Tasks 05, 06, 07 (New Modules)
- **Agent C:** Tasks 08, 09, 10, 23 (Integration Wiring)
- **Agent D:** Tasks 12, 13, 14, 15, 16, 17 (Bootstrap + Verification)
- **Agent E:** Tasks 18, 19, 20, 21, 22 (Advanced Features)

**Total agents:** 5

---

## Risk Assessment

### Low Risk
- **Task 00:** Simple file creation, no dependencies
- **Task 10:** Verification only, no changes
- **Task 13-16:** Verification tasks, isolated

### Medium Risk
- **Task 01, 03:** Schema changes must be identical in both files
- **Task 02:** Many method additions, must match spec exactly
- **Task 08, 09:** Integration wiring touches many code paths
- **Task 11:** Normalization across multiple files, must be comprehensive

### High Risk
- **Task 12:** Bootstrap creates fresh database, must verify all prior changes work
- **Task 18-21:** New endpoints must handle errors gracefully
- **Task 22:** Frontend integration must handle SSE reconnection

### Mitigation Strategies
1. **Schema consistency:** Task 03 explicitly checks that indexer.js schema matches persistence.js
2. **Normalization completeness:** Task 11 includes comprehensive grep checks for snake_case
3. **Bootstrap verification:** Task 12 includes multiple verification steps
4. **Endpoint testing:** Tasks 18-21 include curl commands and database verification
5. **Frontend resilience:** Task 22 includes onerror handler for reconnection

---

## File Conflict Matrix

| File | Tasks | Conflict Risk |
|------|-------|---------------|
| `backend/st8-types.js` | 00 | None (creation only) |
| `backend/persistence.js` | 01, 02, 11 | HIGH — must sequence 01 → 02 → 11 |
| `backend/indexer.js` | 03, 04, 11 | HIGH — must sequence 03 → 04, then 11 |
| `backend/schemaCardEmitter.js` | 05 | None (creation only) |
| `backend/schemaCardPrinter.js` | 06 | None (creation only) |
| `backend/notificationBus.js` | 07 | None (creation only) |
| `backend/index.js` | 08, 23 | MEDIUM — must sequence 08 → 23 |
| `backend/server.js` | 09, 18, 19, 20, 21 | MEDIUM — must sequence 09 → 18-21 |
| `backend/fileWatcher.js` | 10, 14 | LOW — 10 is verification, 14 is temporary |
| `backend/manifestGenerator.js` | 11 | LOW — verification only |
| `st8.html` / `void-engine.js` | 22 | None (single task) |
| `st8.sqlite` | 12, 14, 15, 16 | MEDIUM — 12 creates, 14-16 modify |
| `.st8/schema-cards/` | 05, 12, 13, 19 | LOW — creation + verification |
| `.planning/st8_identity_system/` | 06, 13, 14, 17 | LOW — creation + verification |

---

## Execution Recommendations

### For Single Agent Execution
1. Execute tasks in order: 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 23 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22
2. Verify each task before proceeding
3. Total: 24 task completions

### For Parallel Agent Execution
1. **Wave 1:** Agent A completes Task 00
2. **Wave 2:** Agents A, B, C execute Tasks 01, 05, 06, 07, 10 in parallel
3. **Wave 3:** Agents A, B execute Tasks 02, 03, 04 in parallel
4. **Wave 4:** Agents A, B, C execute Tasks 08, 09, 11, 23 in parallel
5. **Wave 5:** Agent D executes Task 12
6. **Wave 6:** Agent D executes Tasks 13, 14, 15, 16, 17 in parallel
7. **Wave 7:** Agent E executes Tasks 18, 19, 20, 21, 22 in parallel

### Critical Path
```
00 → 01 → 02 → 08 → 23 → 12 → 13 → 17 → 18
```

**Critical path length:** 9 tasks

---

## Verification Checklist

After all tasks complete, run the full verification from EXECUTION-PLAN.md:

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Types validation
node backend/st8-types.js --validate

# 2. Start st8 on itself
node backend/index.js . --watch --serve

# 3. Check schema cards
ls -la .st8/schema-cards/

# 4. Check .txt fallbacks
ls -la .planning/st8_identity_system/

# 5. Edit file and verify mutation
echo "// test" >> backend/fileWatcher.js
sleep 2
# Check mutation log

# 6. Verify .txt updated
ls -la .planning/st8_identity_system/LATEST_backend_fileWatcher.js.txt

# 7. Test SSE endpoint
curl -N http://localhost:3847/api/mutations

# 8. Test schema card diff
node backend/schemaCardEmitter.js --diff

# 9. Revert test
git checkout backend/fileWatcher.js
```

---

## Conclusion

The 24-task breakdown ensures:
- **Single concern** per task — no context drift
- **Exact specifications** — references to PHASE-SPECS.md with line numbers
- **Clear dependencies** — each task knows what it needs and what needs it
- **Parallelization instructions** — tasks can run in parallel where safe
- **Verification steps** — exact commands to verify success
- **Success criteria** — observable outcomes for each task
- **Report format** — standardized completion reporting

**Ready for agent deployment.**
