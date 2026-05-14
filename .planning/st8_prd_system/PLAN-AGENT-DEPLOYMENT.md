  # PRD System — Agent Deployment Plan

**Based on:** All research and planning documents
**Date:** 2026-05-13
**Status:** READY FOR REVIEW

---

## Agent Deployment Summary

| Wave | Agents | Files Touched | Parallel? | Dependencies |
|------|--------|---------------|-----------|--------------|
| Wave 1: Foundation | A1-A5 | 4 files | Yes | None |
| Wave 2: Backend Logic | A6-A10 | 5 files | Partial | A2-A4 |
| Wave 3: API Endpoints | A11-A14 | 1 file | Yes | A5-A8 |
| Wave 4: Frontend | A15-A18 | 3 files | Yes | A11-A14 |
| Wave 5: Integration | A19-A22 | 3 files | No | A1-A21 |

---

## Wave 1: Foundation (Day 3)

### Agent A1: Add .md/.txt/.json to CODE_EXTENSIONS
**Files:** `backend/indexer.js:161`, `backend/index.js:187`
**Change:**
```javascript
const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go',
  '.md', '.txt', '.json'
]);
```
**Verification:**
```bash
node -c backend/indexer.js
node -c backend/index.js
```
**Rollback:** Revert the two lines

### Agent A2: Add Bruno & Oscar schema columns
**Files:** `backend/persistence.js`
**Change:** Add to ST8_SCHEMA and create methods (see PLAN-DATA-MODEL.md)
**Verification:**
```bash
node -e "const { St8Persistence } = require('./backend/persistence'); const p = new St8Persistence(); p.initialize(); console.log('Schema OK'); p.close();"
```
**Rollback:** Remove new methods, revert ST8_SCHEMA

### Agent A3: Add @@@ symbol schema columns
**Files:** `backend/persistence.js`
**Change:** Add columns and methods for AI review tracking (see PLAN-DATA-MODEL.md)
**Verification:** Same as A2
**Rollback:** Remove new methods

### Agent A4: Add template variable schema columns
**Files:** `backend/persistence.js`
**Change:** Add columns and methods for template tracking (see PLAN-DATA-MODEL.md)
**Verification:** Same as A2
**Rollback:** Remove new methods

### Agent A5: Add PRD project table
**Files:** `backend/persistence.js`
**Change:** Add `prd_projects` table and CRUD methods (see PLAN-DATA-MODEL.md)
**Verification:**
```bash
node -e "const { St8Persistence } = require('./backend/persistence'); const p = new St8Persistence(); p.initialize(); p.createPRDProject('test', '/tmp/test', 'press-release', {}); console.log('PRD table OK'); p.close();"
```
**Rollback:** Remove table creation and methods

---

## Wave 2: Backend Logic (Day 4)

### Agent A6: Implement Bruno & Oscar class
**Files:** NEW `backend/brunoOscar.js`
**Requirements:**
- Class with constructor(persistence, notificationBus)
- `runBrunoCall(threshold=5)` — finds stale files, flags them
- `archiveFile(filepath)` — moves to Oscar's House
- `setEventTrigger(filepath, event)` — sets unblock event
- `onEventTriggered(event)` — handles triggered events
- Configuration: STALE_THRESHOLD=5, GRACE_PERIOD=7

**Verification:**
```bash
node -c backend/brunoOscar.js
node -e "const { BrunoOscar } = require('./backend/brunoOscar'); console.log('BrunoOscar OK');"
```
**Rollback:** Delete file

### Agent A7: Implement @@@ symbol detection
**Files:** `backend/intentSeeder.js`, `backend/schemaCardEmitter.js`
**Change:**
- intentSeeder.js: Detect `@@@` in file content, call `flagForAIReview`
- schemaCardEmitter.js: Include `needsAIReview`, `tripleAtCount` in cards

**Verification:**
```bash
echo "Test content @@@" > /tmp/test-ai.md
node -e "const { IntentSeeder } = require('./backend/intentSeeder'); console.log('IntentSeeder OK');"
```
**Rollback:** Revert changes to both files

### Agent A8: Implement template engine
**Files:** NEW `backend/templateEngine.js`
**Requirements:**
- `fillTemplate(template, variables)` — simple regex replace
- `detectVariables(template)` — extract {{var}} names
- `loadTemplate(name)` — from `~/.st8/templates/`
- `saveTemplate(name, content)` — save custom template

**Verification:**
```bash
node -c backend/templateEngine.js
node -e "const { TemplateEngine } = require('./backend/templateEngine'); const t = TemplateEngine.fillTemplate('Hello {{name}}', {name: 'World'}); console.log(t);"
```
**Rollback:** Delete file

### Agent A9: Add PRD patterns to intentSeeder
**Files:** `backend/intentSeeder.js:22-78`
**Change:** Add 16 PRD patterns (see PLAN-INTEGRATION-POINTS.md)
**Verification:**
```bash
node -c backend/intentSeeder.js
```
**Rollback:** Remove added patterns

### Agent A10: Add intent display to file list
**Files:** `st8.html`
**Change:** Add `file-purpose` div and CSS (see PLAN-FRONTEND-IMPACT.md)
**Verification:** Open st8.html in browser, check file list
**Rollback:** Revert HTML/JS changes

---

## Wave 3: API Endpoints (Day 5)

### Agent A11: Add PRD project endpoints
**Files:** `backend/server.js`
**Change:** Add handlers for GET/POST `/api/prd-projects`, GET `/api/prd-projects/:name`
**Verification:**
```bash
curl -X POST http://localhost:3847/api/prd-projects -H "Content-Type: application/json" -d '{"name":"test","template":"press-release","variables":{"product_name":"Test"}}'
curl http://localhost:3847/api/prd-projects/test
```
**Rollback:** Remove endpoint cases and handlers

### Agent A12: Modify lifecycle endpoints
**Files:** `backend/server.js`
**Change:**
- `/api/mvp-lock`: Now emits schema cards for documents
- `/api/production-promote`: Resets template state
**Verification:**
```bash
curl -X POST http://localhost:3847/api/mvp-lock -H "Content-Type: application/json" -d '{"filepath":"test.md"}'
```
**Rollback:** Revert handler changes

### Agent A13: Add Bruno & Oscar API
**Files:** `backend/server.js`
**Change:** Add handlers for POST `/api/bruno-call`, POST `/api/oscar-house`
**Verification:**
```bash
curl -X POST http://localhost:3847/api/bruno-call
curl -X POST http://localhost:3847/api/oscar-house
```
**Rollback:** Remove endpoint cases and handlers

### Agent A14: Add @@@ symbol API
**Files:** `backend/server.js`
**Change:** Add handlers for GET `/api/needs-ai-review`, POST `/api/mark-reviewed`
**Verification:**
```bash
curl http://localhost:3847/api/needs-ai-review
curl -X POST http://localhost:3847/api/mark-reviewed -H "Content-Type: application/json" -d '{"filepath":"test.md","approved":true}'
```
**Rollback:** Remove endpoint cases and handlers

---

## Wave 4: Frontend (Day 6)

### Agent A15: Add Bruno & Oscar notifications
**Files:** `st8.html`, `phreak-terminal.js`
**Change:**
- st8.html: Add toast handlers for BRUNO_CALL, ARCHIVE events
- phreak-terminal.js: Add `bruno-call` and `oscar-house` commands
**Verification:** Manual testing in browser
**Rollback:** Revert changes

### Agent A16: Add @@@ symbol badges
**Files:** `st8.html`, `file-explorer.js`
**Change:**
- st8.html: Show @@@ badge in file list
- file-explorer.js: Show @@@ badge in table
**Verification:** Create file with @@@, index it, check badges
**Rollback:** Revert changes

### Agent A17: Add PRD project wizard
**Files:** `st8.html`, `file-explorer.js`
**Change:**
- st8.html: Add modal HTML and JavaScript for PRD creation
- file-explorer.js: Add "Create PRD" button
**Verification:** Click "Create PRD", fill form, check creation
**Rollback:** Revert changes

### Agent A18: Add template variable editor
**Files:** `st8.html`
**Change:** Add inline editor for filling {{variables}}
**Verification:** Open template file, click "Fill Variables", save
**Rollback:** Revert changes

---

## Wave 5: Integration (Day 7)

### Agent A19: Integrate Bruno & Oscar with session start
**Files:** `backend/index.js`
**Change:** Call `brunoOscar.runBrunoCall()` on startup, `incrementSessionCounters()` on shutdown
**Verification:** Start backend, check for stale file notifications
**Rollback:** Remove initialization

### Agent A20: Integrate @@@ symbol with gap analysis
**Files:** `backend/gapAnalyzer.js`
**Change:** Add D7 (AI Review) dimension to analysis
**Verification:** Run gap analysis, check for @@@ section in report
**Rollback:** Remove dimension

### Agent A21: Integrate template engine with schema cards
**Files:** `backend/schemaCardEmitter.js`
**Change:** Detect template variables when emitting cards, store in DB
**Verification:** Create template file, check schema card has `templateVariables`
**Rollback:** Revert changes

### Agent A22: End-to-end testing
**Files:** All files
**Change:** Manual testing of complete workflow
**Verification:**
1. Create PRD project
2. Index it
3. Check schema cards
4. Check gap analysis
5. Check Bruno & Oscar cleanup
6. Check @@@ symbol handling
**Rollback:** N/A (final verification)

---

## Parallelization Opportunities

### Wave 1: All agents can run in parallel
- A1 (CODE_EXTENSIONS) is independent
- A2-A5 (schema changes) can run together if coordinated

### Wave 2: Partial parallelization
- A6 (BrunoOscar) and A8 (TemplateEngine) can run in parallel
- A7 (@@@ detection) and A9 (PRD patterns) can run in parallel
- A10 (intent display) can run anytime

### Wave 3: All agents can run in parallel
- A11-A14 are all server.js changes but touch different handler methods

### Wave 4: All agents can run in parallel
- A15-A18 are all frontend changes in different areas

### Wave 5: Sequential
- A19-A21 have dependencies on previous waves
- A22 must run last

---

## Verification Checklist per Wave

### Wave 1
- [ ] .md files are discovered by indexer
- [ ] Database initializes without errors
- [ ] New columns are queryable
- [ ] PRD project table exists

### Wave 2
- [ ] BrunoOscar class instantiates
- [ ] Template engine fills variables correctly
- [ ] @@@ symbols are detected in files
- [ ] PRD patterns match filenames
- [ ] Intent purpose displays in file list

### Wave 3
- [ ] PRD project API creates/reads projects
- [ ] Bruno & Oscar API triggers actions
- [ ] @@@ API lists/reviews files
- [ ] Lifecycle endpoints work for documents

### Wave 4
- [ ] Bruno & Oscar toasts appear
- [ ] @@@ badges show in file list
- [ ] PRD wizard creates projects
- [ ] Variable editor fills templates

### Wave 5
- [ ] Bruno runs on session start
- [ ] Gap analysis includes AI review
- [ ] Schema cards track templates
- [ ] End-to-end workflow complete

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| File explosion from .md indexing | Medium | High | Add .planning to IGNORE_DIRS |
| Schema migration fails | Low | High | All new columns have defaults |
| Frontend breaks during Wave 4 | Medium | Medium | Backend works independently |
| Bruno & Oscar over-cleans | Medium | High | Never archive LOCKED/PRODUCTION files |
| @@@ false positives | Medium | Low | Require specific format <!-- @@@ --> |

---

## END OF AGENT DEPLOYMENT PLAN
