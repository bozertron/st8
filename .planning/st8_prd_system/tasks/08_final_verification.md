# Task 08: Final Verification

**Phase:** 7
**Single Concern:** Verify all spec requirements met
**Files to Verify:** All implementation files

---

## Specification Reference

**All Phases:** Complete verification checklist

---

## Verification Checklist

### Phase 0: st8-types.js
- [ ] `node backend/st8-types.js --validate` passes

### Phase 1: Schema Changes
- [ ] persistence.js has camelCase schema
- [ ] indexer.js schema matches persistence.js

### Phase 2: New Modules
- [ ] schemaCardEmitter.js works
- [ ] schemaCardPrinter.js works
- [ ] notificationBus.js works

### Phase 3: Integration Wiring
- [ ] index.js wires all modules
- [ ] server.js has all endpoints
- [ ] fileWatcher.js callback works

### Phase 4: Normalization
- [ ] No snake_case column names

### Phase 5: Bootstrap
- [ ] Schema cards generated
- [ ] TXT fallbacks generated
- [ ] Mutations logged

### Phase 6: Advanced Features
- [ ] CommonJS exports detected
- [ ] Gap analysis generated
- [ ] Intent seeded with ??? flags
- [ ] SSE working

---

## PARALLELIZATION

```
- Can start after: [07]
- Can run parallel with: [none — final verification]
- Must complete before: [none — final task]
- Conflict risk: [none — read-only]
```

---

## Success Criteria

- [ ] All verification items pass
- [ ] No critical issues remaining
- [ ] System is fully functional

---

## Report Format

When complete, report:
```
TASK 08 COMPLETE
- Verification items: [X/Y] passed
- Critical issues: [count]
- System status: FULLY FUNCTIONAL / ISSUES REMAINING
- Final report: SUBMITTED
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (all modules connected)
2. Error reporting is in place (all error paths covered)
3. Report covers every integration point with filepaths and line-specific details
