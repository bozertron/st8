# PRD System Research Roadmap

**Created**: 2026-05-13
**Status**: READY FOR REVIEW
**Owner**: Ben (Product Owner) → Agent Execution

---

## 🎯 Executive Summary

This roadmap implements the PRD (Product Requirements Document) system for ST8, including:
1. **Bruno & Oscar** — Automatic file lifecycle management (stale file cleanup)
2. **@@@ Symbol System** — AI-generated content tracking and review
3. **Intent Display UX** — Surface intent in file list
4. **PRD Patterns** — Auto-detect PRD file purposes
5. **Template Engine** — Variable substitution for PRD templates
6. **PRD Project API** — Create/manage PRD projects
7. **Lifecycle Phase Progression** — Context-aware phase endpoints
8. **Global .md/.txt/.json Indexing** — Index ALL file types across ALL directories

**Estimated Time**: 5-7 days
**Agent Deployments**: 12-15 agents

---

## 📋 Phase 1: Research (Day 1)

### 1.1 Research Objectives

| # | Objective | Questions to Answer |
|---|-----------|---------------------|
| 1 | Current State Audit | What's already implemented? What's missing? |
| 2 | Integration Points | Where do new features hook into existing code? |
| 3 | Data Model Changes | What schema changes are needed? |
| 4 | API Design | What new endpoints are needed? |
| 5 | Frontend Impact | What UI changes are needed? |
| 6 | Edge Cases | What could go wrong? |

### 1.2 Research Agents

#### Agent R1: Current State Audit
**Prompt**:
```
Research the current state of the ST8 system and identify what's already implemented vs what's missing for PRD support.

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/backend/indexer.js (lines 160-170: CODE_EXTENSIONS)
- /home/bozertron/1_AT_A_TIME/st8/backend/intentSeeder.js (lines 22-78: FILENAME_PURPOSE_MAP)
- /home/bozertron/1_AT_A_TIME/st8/backend/schemaCardEmitter.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/gapAnalyzer.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/server.js (lines 100-200: API endpoints)
- /home/bozertron/1_AT_A_TIME/st8/backend/persistence.js (lines 50-100: schema)
- /home/bozertron/1_AT_A_TIME/st8/st8.html (lines 1740-1760: renderFileList)

QUESTIONS TO ANSWER:
1. What file extensions are currently indexed?
2. What intent patterns exist in FILENAME_PURPOSE_MAP?
3. What schema card fields are emitted?
4. What gap analysis dimensions exist?
5. What API endpoints exist?
6. What database tables/columns exist?
7. What UI components show file information?

OUTPUT: Research report with findings and gaps identified
```

#### Agent R2: Bruno & Oscar Feasibility
**Prompt**:
```
Research the feasibility of implementing Bruno & Oscar (automatic file lifecycle management).

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/backend/persistence.js (full file: database schema)
- /home/bozertron/1_AT_A_TIME/st8/backend/notificationBus.js (full file: event system)
- /home/bozertron/1_AT_A_TIME/st8/backend/schemaCardEmitter.js (full file: card emission)
- /home/bozertron/1_AT_A_TIME/st8/backend/fileWatcher.js (full file: change detection)

QUESTIONS TO ANSWER:
1. How is file access currently tracked?
2. How are lifecycle phases currently managed?
3. How does the notification bus work?
4. How does the file watcher detect changes?
5. What database tables would need to change?
6. How would "sessions since access" be tracked?
7. How would "associated files" be determined?

DESIGN QUESTIONS:
1. Should Bruno & Oscar run on every session start?
2. Should it be configurable (thresholds, grace periods)?
3. How should it handle files with @@@ symbols?
4. How should it handle files with event triggers?
5. How should it handle files that are skills?

OUTPUT: Feasibility report with implementation approach
```

#### Agent R3: @@@ Symbol System Design
**Prompt**:
```
Research and design the @@@ symbol system for AI-generated content tracking.

CONTEXT:
- ??? = "human needs to provide context"
- @@@ = "AI has provided context, needs human review"
- When @@@ is detected, the system should:
  1. Auto-inject AI content as .json
  2. Track the content for human review
  3. Surface it to the user via notifications/badges
  4. Preserve it when Bruno & Oscar archives the file

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/backend/intentSeeder.js (full file: how ??? is handled)
- /home/bozertron/1_AT_A_TIME/st8/backend/schemaCardEmitter.js (full file: card structure)
- /home/bozertron/1_AT_A_TIME/st8/backend/gapAnalyzer.js (full file: gap detection)
- /home/bozertron/1_AT_A_TIME/st8/backend/notificationBus.js (full file: notifications)

QUESTIONS TO ANSWER:
1. How does the system currently detect and handle ????
2. How are schema cards structured?
3. How does gap analysis detect gaps?
4. How do notifications work?

DESIGN QUESTIONS:
1. Where should @@@ content be stored?
2. How should @@@ content be structured?
3. How should @@@ content be surfaced to users?
4. How should @@@ content be preserved during Bruno & Oscar cleanup?
5. How should @@@ content be validated?
6. How should @@@ content be marked as "reviewed"?

OUTPUT: Design document with data structures, API design, and integration points
```

#### Agent R4: PRD Template System Design
**Prompt**:
```
Research and design the PRD template system with variable substitution.

CONTEXT:
- PRD templates are .md files with {{variables}}
- When created, variables should be detected and tracked
- When filled, the system should update lifecycle status
- Templates should be extensible (users can add their own)

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/backend/prdGenerator.js (full file: PRD generation)
- /home/bozertron/1_AT_A_TIME/st8/backend/server.js (lines 100-200: API endpoints)
- /home/bozertron/1_AT_A_TIME/st8/backend/persistence.js (full file: database schema)

QUESTIONS TO ANSWER:
1. How does prdGenerator.js currently work?
2. What API endpoints exist for PRD?
3. How is PRD data stored?

DESIGN QUESTIONS:
1. Where should templates be stored?
2. How should variables be detected?
3. How should variables be tracked?
4. How should variable filling be validated?
5. How should custom templates be supported?
6. How should template inheritance work?

DESIGN REQUIREMENTS:
- Template engine must be simple (string replacement)
- Variables must be detectable in schema cards
- Variable filling must trigger lifecycle progression
- Templates must be extensible

OUTPUT: Design document with template format, variable handling, and API design
```

#### Agent R5: Global File Indexing Design
**Prompt**:
```
Research the impact of adding .md, .txt, .json to CODE_EXTENSIONS globally.

CONTEXT:
- Currently only code files are indexed (.js, .ts, .jsx, .tsx, .vue, .py, .rs, .go)
- We want to index ALL file types across ALL directories
- Bruno & Oscar will handle cleanup of stale files
- This enables PRD files, documentation, configuration, etc.

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/backend/indexer.js (lines 160-170: CODE_EXTENSIONS)
- /home/bozertron/1_AT_A_TIME/st8/backend/index.js (lines 185-195: watcher CODE_EXTENSIONS)
- /home/bozertron/1_AT_A_TIME/st8/backend/schemaCardEmitter.js (full file: card emission)
- /home/bozertron/1_AT_A_TIME/st8/backend/schemaCardPrinter.js (full file: txt emission)
- /home/bozertron/1_AT_A_TIME/st8/backend/intentSeeder.js (full file: intent seeding)

QUESTIONS TO ANSWER:
1. What happens if we add .md, .txt, .json to CODE_EXTENSIONS?
2. How many files would be indexed?
3. What's the performance impact?
4. What schema card fields are needed for non-code files?
5. How should intent be seeded for non-code files?
6. How should Bruno & Oscar handle non-code files?

RISKS:
1. File explosion (too many files indexed)
2. Performance degradation (indexing takes too long)
3. Schema card bloat (too many cards emitted)
4. Gap analysis noise (too many gaps detected)

MITIGATIONS:
1. Bruno & Oscar cleanup
2. Configurable CODE_EXTENSIONS
3. Lazy indexing (only index when accessed)
4. Gap analysis filtering (by file type)

OUTPUT: Risk assessment with mitigation strategies
```

### 1.3 Research Deliverables

| # | Deliverable | Owner | Due |
|---|-------------|-------|-----|
| 1 | Current State Audit Report | Agent R1 | Day 1 AM |
| 2 | Bruno & Oscar Feasibility Report | Agent R2 | Day 1 AM |
| 3 | @@@ Symbol Design Document | Agent R3 | Day 1 PM |
| 4 | PRD Template Design Document | Agent R4 | Day 1 PM |
| 5 | Global Indexing Risk Assessment | Agent R5 | Day 1 PM |

---

## 📋 Phase 2: Planning (Day 2)

### 2.1 Planning Objectives

| # | Objective | Deliverable |
|---|-----------|-------------|
| 1 | Data Model Changes | Database schema changes |
| 2 | API Design | New endpoints and modifications |
| 3 | Frontend Impact | UI changes and new components |
| 4 | Integration Points | Exact file/line locations |
| 5 | Agent Deployment Plan | Prompts for each agent |
| 6 | Testing Strategy | How to verify each feature |

### 2.2 Planning Agents

#### Agent P1: Data Model Planning
**Prompt**:
```
Based on research findings, design the database schema changes needed for PRD system.

RESEARCH INPUT:
- Bruno & Oscar feasibility report
- @@@ symbol design document
- PRD template design document
- Global indexing risk assessment

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/backend/persistence.js (full file: current schema)

DELIVERABLES:
1. New tables needed
2. New columns needed
3. Migration scripts
4. Index recommendations
5. Foreign key relationships

SCHEMA CHANGES TO DESIGN:
1. Bruno & Oscar fields (lastAccessed, sessionsSinceAccess, expiryDate, associatedWith, eventTrigger, status)
2. @@@ symbol fields (needsAIReview, tripleAtCount, aiContentInjected)
3. Template fields (templateVariables, hasUnfilledVariables)
4. PRD project fields (name, path, template, variables, created)

OUTPUT: Database schema change document with migration scripts
```

#### Agent P2: API Design Planning
**Prompt**:
```
Based on research findings, design the API endpoints needed for PRD system.

RESEARCH INPUT:
- Current state audit report
- Bruno & Oscar feasibility report
- @@@ symbol design document
- PRD template design document

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/backend/server.js (full file: current endpoints)

DELIVERABLES:
1. New endpoints needed
2. Modified endpoints needed
3. Request/response formats
4. Error handling
5. Validation rules

ENDPOINTS TO DESIGN:
1. PRD Projects: GET/POST /api/prd-projects, GET /api/prd-projects/:name
2. Bruno & Oscar: POST /api/bruno-call, POST /api/oscar-house
3. @@@ Symbol: GET /api/needs-ai-review, POST /api/mark-reviewed
4. Templates: GET /api/templates, POST /api/templates
5. Lifecycle: POST /api/mvp-lock (modified), POST /api/production-promote (modified)

OUTPUT: API design document with endpoint specifications
```

#### Agent P3: Frontend Impact Planning
**Prompt**:
```
Based on research findings, design the frontend changes needed for PRD system.

RESEARCH INPUT:
- Current state audit report
- Bruno & Oscar feasibility report
- @@@ symbol design document

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/st8.html (full file: current UI)
- /home/bozertron/1_AT_A_TIME/st8/file-explorer.js (full file: file list)
- /home/bozertron/1_AT_A_TIME/st8/phreak-terminal.js (full file: terminal UI)

DELIVERABLES:
1. UI components to add
2. UI components to modify
3. CSS changes needed
4. JavaScript changes needed
5. Event handling changes

COMPONENTS TO DESIGN:
1. Intent display in file list (subtitle with purpose)
2. Bruno & Oscar notifications (action buttons)
3. @@@ symbol badges (file explorer, terminal)
4. PRD project wizard (create/open/import)
5. Template variable editor (fill in variables)

OUTPUT: Frontend change document with component specifications
```

#### Agent P4: Integration Point Planning
**Prompt**:
```
Based on research findings, map all integration points for PRD system.

RESEARCH INPUT:
- All research reports
- All planning documents

FILES TO READ:
- /home/bozertron/1_AT_A_TIME/st8/backend/indexer.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/index.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/schemaCardEmitter.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/intentSeeder.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/gapAnalyzer.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/notificationBus.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/persistence.js (full file)
- /home/bozertron/1_AT_A_TIME/st8/backend/server.js (full file)

DELIVERABLES:
1. File-by-file integration points
2. Line-by-line changes needed
3. Function-by-function modifications
4. New functions to add
5. Dependencies between changes

OUTPUT: Integration point document with exact file/line locations
```

#### Agent P5: Agent Deployment Planning
**Prompt**:
```
Based on all planning documents, create the agent deployment plan.

CONTEXT:
- Each agent should be single-concern
- Agents should be deployable in parallel where possible
- Each agent needs a clear prompt with file paths and line numbers
- Each agent needs verification steps

DELIVERABLES:
1. Agent list with prompts
2. Dependency graph between agents
3. Parallelization opportunities
4. Verification steps for each agent
5. Rollback procedures if agent fails

OUTPUT: Agent deployment plan with prompts and verification steps
```

### 2.3 Planning Deliverables

| # | Deliverable | Owner | Due |
|---|-------------|-------|-----|
| 1 | Database Schema Changes | Agent P1 | Day 2 AM |
| 2 | API Design Document | Agent P2 | Day 2 AM |
| 3 | Frontend Change Document | Agent P3 | Day 2 PM |
| 4 | Integration Point Document | Agent P4 | Day 2 PM |
| 5 | Agent Deployment Plan | Agent P5 | Day 2 PM |

---

## 📋 Phase 3: Implementation (Days 3-7)

### 3.1 Implementation Waves

#### Wave 1: Foundation (Day 3)
**Focus**: Database schema + Global indexing

| Agent | Task | Files | Dependencies |
|-------|------|-------|--------------|
| A1 | Add .md/.txt/.json to CODE_EXTENSIONS | `indexer.js:161`, `index.js:187` | None |
| A2 | Add Bruno & Oscar schema columns | `persistence.js` | None |
| A3 | Add @@@ symbol schema columns | `persistence.js` | None |
| A4 | Add template variable schema columns | `persistence.js` | None |
| A5 | Add PRD project table | `persistence.js` | None |

**Verification**:
```bash
# Verify .md files are indexed
echo "test" > /tmp/test.md
node -e "const { Indexer } = require('./backend/indexer'); const i = new Indexer('/tmp'); i.indexDirectory(); console.log('Indexed:', i.files.length);"

# Verify schema changes
node -e "const { St8Persistence } = require('./backend/persistence'); const p = new St8Persistence(); p.initialize(); console.log('Schema OK'); p.close();"
```

#### Wave 2: Backend Logic (Day 4)
**Focus**: Bruno & Oscar + @@@ symbol + Template engine

| Agent | Task | Files | Dependencies |
|-------|------|-------|--------------|
| A6 | Implement Bruno & Oscar class | New file: `backend/brunoOscar.js` | A2 |
| A7 | Implement @@@ symbol detection | `intentSeeder.js`, `schemaCardEmitter.js` | A3 |
| A8 | Implement template engine | New file: `backend/templateEngine.js` | A4 |
| A9 | Add PRD patterns to intentSeeder | `intentSeeder.js:22-78` | None |
| A10 | Add intent display to file list | `st8.html:1743-1755` | None |

**Verification**:
```bash
# Verify Bruno & Oscar
node -e "const { BrunoOscar } = require('./backend/brunoOscar'); console.log('BrunoOscar OK');"

# Verify template engine
node -e "const { TemplateEngine } = require('./backend/templateEngine'); const t = TemplateEngine.fillTemplate('Hello {{name}}', {name: 'World'}); console.log(t);"
```

#### Wave 3: API Endpoints (Day 5)
**Focus**: PRD project API + Lifecycle progression

| Agent | Task | Files | Dependencies |
|-------|------|-------|--------------|
| A11 | Add PRD project endpoints | `server.js` | A5 |
| A12 | Modify lifecycle endpoints | `server.js` | A2, A3, A4 |
| A13 | Add Bruno & Oscar API | `server.js` | A6 |
| A14 | Add @@@ symbol API | `server.js` | A7 |

**Verification**:
```bash
# Verify PRD project API
curl -X POST http://localhost:3847/api/prd-projects -H "Content-Type: application/json" -d '{"name":"test","template":"press-release","variables":{"product_name":"Test"}}'

# Verify lifecycle endpoints
curl -X POST http://localhost:3847/api/mvp-lock -H "Content-Type: application/json" -d '{"filepath":"test.md"}'
```

#### Wave 4: Frontend (Day 6)
**Focus**: UI components + Notifications

| Agent | Task | Files | Dependencies |
|-------|------|-------|--------------|
| A15 | Add Bruno & Oscar notifications | `st8.html`, `phreak-terminal.js` | A13 |
| A16 | Add @@@ symbol badges | `st8.html`, `file-explorer.js` | A14 |
| A17 | Add PRD project wizard | `st8.html`, `file-explorer.js` | A11 |
| A18 | Add template variable editor | `st8.html` | A8 |

**Verification**:
```bash
# Verify UI changes
# Manual testing: Open st8.html, check file list shows intent, check Bruno & Oscar notifications
```

#### Wave 5: Integration (Day 7)
**Focus**: End-to-end testing + Gap analysis

| Agent | Task | Files | Dependencies |
|-------|------|-------|--------------|
| A19 | Integrate Bruno & Oscar with session start | `index.js` | A6 |
| A20 | Integrate @@@ symbol with gap analysis | `gapAnalyzer.js` | A7 |
| A21 | Integrate template engine with schema cards | `schemaCardEmitter.js` | A8 |
| A22 | End-to-end testing | All files | A1-A21 |

**Verification**:
```bash
# End-to-end test
# 1. Create PRD project
# 2. Index it
# 3. Check schema cards
# 4. Check gap analysis
# 5. Check Bruno & Oscar cleanup
# 6. Check @@@ symbol handling
```

### 3.2 Agent Deployment Prompts

#### Agent A1: Add .md/.txt/.json to CODE_EXTENSIONS
**Prompt**:
```
Add .md, .txt, and .json to CODE_EXTENSIONS in two files.

FILE 1: /home/bozertron/1_AT_A_TIME/st8/backend/indexer.js
LINE: 161
CURRENT: const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go']);
NEW: const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go', '.md', '.txt', '.json']);

FILE 2: /home/bozertron/1_AT_A_TIME/st8/backend/index.js
LINE: 187
CURRENT: const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go']);
NEW: const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go', '.md', '.txt', '.json']);

VERIFICATION:
node -c backend/indexer.js
node -c backend/index.js
```

#### Agent A6: Implement Bruno & Oscar Class
**Prompt**:
```
Create a new file: /home/bozertron/1_AT_A_TIME/st8/backend/brunoOscar.js

REQUIREMENTS:
1. Class with constructor(persistence, notificationBus)
2. Method: runBrunoCall() - called on session start, finds stale files
3. Method: _appendToParent(file) - appends file content to parent with ??? flag
4. Method: _flagForReview(file) - emits BRUNO_CALL notification
5. Method: _moveToOscarHouse(file) - archives file and marks for deletion
6. Method: setEventTrigger(filepath, event) - sets event trigger on file
7. Method: onEventTriggered(event) - handles event trigger

CONFIGURATION:
- STALE_THRESHOLD = 5 (sessions without access)
- GRACE_PERIOD = 7 (days before auto-delete)

INTEGRATION POINTS:
- persistence.getStaleFiles(threshold) - query files with sessionsSinceAccess > threshold
- persistence.updateFileLifecycle(filepath, updates) - update lifecycle fields
- persistence.archiveFile(file) - move to Oscar's House
- persistence.markForDeletion(filepath, gracePeriod) - mark for auto-delete
- notificationBus.publish(event) - emit notifications

EXPORTS:
module.exports = { BrunoOscar };

VERIFICATION:
node -c backend/brunoOscar.js
node -e "const { BrunoOscar } = require('./backend/brunoOscar'); console.log('OK');"
```

#### Agent A9: Add PRD Patterns to Intent Seeder
**Prompt**:
```
Add PRD-specific patterns to FILENAME_PURPOSE_MAP in intentSeeder.js.

FILE: /home/bozertron/1_AT_A_TIME/st8/backend/intentSeeder.js
LOCATION: Lines 22-78 (FILENAME_PURPOSE_MAP array)

PATTERNS TO ADD:
{ pattern: /press[-_]?release/i, purpose: 'Press Release' },
{ pattern: /gtm[-_]?plan/i, purpose: 'Go-To-Market Plan' },
{ pattern: /stakeholder/i, purpose: 'Stakeholder Registry' },
{ pattern: /technical[-_]?spec/i, purpose: 'Technical Specification' },
{ pattern: /prd/i, purpose: 'Product Requirements Document' },
{ pattern: /roadmap/i, purpose: 'Project Roadmap' },
{ pattern: /meeting[-_]?notes/i, purpose: 'Meeting Notes' },
{ pattern: /decision[-_]?log/i, purpose: 'Decision Log' },
{ pattern: /risk[-_]?register/i, purpose: 'Risk Register' },
{ pattern: /user[-_]?story/i, purpose: 'User Story' },
{ pattern: /acceptance[-_]?criteria/i, purpose: 'Acceptance Criteria' },
{ pattern: /changelog/i, purpose: 'Change Log' },
{ pattern: /readme/i, purpose: 'Project README' },
{ pattern: /todo/i, purpose: 'Todo List' },
{ pattern: /bug[-_]?report/i, purpose: 'Bug Report' },
{ pattern: /feature[-_]?request/i, purpose: 'Feature Request' },

VERIFICATION:
node -c backend/intentSeeder.js
node -e "const { IntentSeeder } = require('./backend/intentSeeder'); console.log('OK');"
```

#### Agent A10: Add Intent Display to File List
**Prompt**:
```
Add intent.purpose as subtitle under filename in renderFileList().

FILE: /home/bozertron/1_AT_A_TIME/st8/st8.html
LOCATION: Lines 1743-1755 (renderFileList function)

CURRENT CODE (approximate):
'<div class="file-name">' + escapeHtml(file.filename) + '</div>' +
'<div class="file-actions">' +

NEW CODE:
'<div class="file-name">' + escapeHtml(file.filename) + '</div>' +
'<div class="file-purpose">' + escapeHtml(file.intent?.purpose || '(no purpose)') + 
  (file.intent?.purpose?.includes('???') ? ' <span class="badge-unknown">???</span>' : '') +
'</div>' +
'<div class="file-actions">' +

CSS ADDITION (in <style> section):
.file-purpose {
  font-size: 11px;
  color: var(--cyan);
  opacity: 0.7;
  margin-top: 2px;
  font-style: italic;
}

.badge-unknown {
  background: var(--pink);
  color: var(--void);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: bold;
  margin-left: 4px;
}

VERIFICATION:
# Open st8.html in browser, check file list shows intent purpose
# Check that ??? badges appear for files with ??? in purpose
```

---

## 📋 Phase 4: Validation (Day 8)

### 4.1 Validation Objectives

| # | Objective | Method |
|---|-----------|--------|
| 1 | All features work end-to-end | Manual testing |
| 2 | No regressions in existing features | Automated tests |
| 3 | Performance acceptable | Load testing |
| 4 | Edge cases handled | Edge case testing |
| 5 | Documentation complete | Documentation review |

### 4.2 Validation Tests

#### Test 1: Global Indexing
```bash
# Create test files
echo "# Test PRD" > /tmp/test-prd.md
echo '{"key": "value"}' > /tmp/test-config.json
echo "Test notes" > /tmp/test-notes.txt

# Index them
curl -X POST http://localhost:3847/api/index

# Verify they appear in file list
curl http://localhost:3847/api/files | jq '.files[] | select(.filename | test("test-prd|test-config|test-notes"))'
```

#### Test 2: Bruno & Oscar
```bash
# Create a stale file (simulate 5 sessions without access)
# ... (requires mocking or time travel)

# Trigger Bruno call
curl -X POST http://localhost:3847/api/bruno-call

# Verify notification sent
# Check SSE stream for BRUNO_CALL event
```

#### Test 3: @@@ Symbol
```bash
# Create file with @@@ symbols
echo "AI content here @@@" > /tmp/test-ai.md

# Index it
curl -X POST http://localhost:3847/api/index

# Verify it's flagged
curl http://localhost:3847/api/needs-ai-review | jq '.files[] | select(.filepath | test("test-ai"))'
```

#### Test 4: PRD Template
```bash
# Create PRD project
curl -X POST http://localhost:3847/api/prd-projects \
  -H "Content-Type: application/json" \
  -d '{"name":"test-project","template":"press-release","variables":{"product_name":"Test Product","launch_date":"2026-06-01"}}'

# Verify project created
curl http://localhost:3847/api/prd-projects/test-project

# Verify template variables filled
cat /path/to/test-project/press-release.md | grep "Test Product"
```

#### Test 5: Lifecycle Progression
```bash
# Lock a PRD file
curl -X POST http://localhost:3847/api/mvp-lock \
  -H "Content-Type: application/json" \
  -d '{"filepath":"test-project/press-release.md"}'

# Verify it's locked
curl http://localhost:3847/api/files | jq '.files[] | select(.filepath | test("press-release")) | .lifecyclePhase'
```

---

## 📋 Phase 5: Documentation (Day 9)

### 5.1 Documentation Deliverables

| # | Document | Owner | Due |
|---|----------|-------|-----|
| 1 | PRD System README | Agent D1 | Day 9 AM |
| 2 | API Documentation | Agent D2 | Day 9 AM |
| 3 | User Guide | Agent D3 | Day 9 PM |
| 4 | Developer Guide | Agent D4 | Day 9 PM |

### 5.2 Documentation Agents

#### Agent D1: PRD System README
**Prompt**:
```
Create a README for the PRD system.

FILE: /home/bozertron/1_AT_A_TIME/st8/.planning/st8_prd_system/README.md

SECTIONS:
1. Overview
2. Features
3. Architecture
4. Getting Started
5. Configuration
6. Troubleshooting
7. Contributing

INCLUDE:
- Bruno & Oscar system
- @@@ symbol system
- Intent display
- PRD patterns
- Template engine
- PRD project API
- Lifecycle progression
- Global indexing
```

---

## 🔍 Open Questions for Ben

### Q1: Bruno & Oscar Configuration
**Question**: Should Bruno & Oscar thresholds be configurable per-file or global?
- **Option A**: Global threshold (e.g., 5 sessions for all files)
- **Option B**: Per-file threshold (e.g., PRD files get 10 sessions, code files get 5)
- **Option C**: Per-type threshold (e.g., .md files get 10 sessions, .js files get 5)

**Recommendation**: Option C (per-type threshold) — simpler than per-file, more flexible than global

### Q2: @@@ Symbol AI Content
**Question**: Where should @@@ AI content be stored?
- **Option A**: Inline in the file (as JSON block)
- **Option B**: Separate .json file (e.g., `file.ai.json`)
- **Option C**: Database table (e.g., `ai_content`)

**Recommendation**: Option B (separate .json file) — keeps file clean, easy to version, easy to review

### Q3: PRD Template Storage
**Question**: Where should PRD templates be stored?
- **Option A**: In the workspace (e.g., `.st8/templates/`)
- **Option B**: In user home (e.g., `~/.st8/templates/`)
- **Option C**: In the application (e.g., `backend/templates/`)

**Recommendation**: Option B (user home) — templates are user-specific, persist across workspaces

### Q4: Bruno & Oscar Grace Period
**Question**: How long should files stay in Oscar's House before auto-deletion?
- **Option A**: 7 days
- **Option B**: 14 days
- **Option C**: 30 days
- **Option D**: Configurable

**Recommendation**: Option D (configurable) — default 7 days, user can adjust

### Q5: @@@ Symbol Review Workflow
**Question**: How should @@@ content be reviewed?
- **Option A**: Manual review (user clicks "Review" button)
- **Option B**: Automatic review (AI validates content)
- **Option C**: Hybrid (AI validates, user confirms)

**Recommendation**: Option C (hybrid) — AI does initial validation, user confirms

### Q6: PRD Project Location
**Question**: Where should PRD projects be stored?
- **Option A**: In the workspace (e.g., `prd/`)
- **Option B**: In user home (e.g., `~/prd-projects/`)
- **Option C**: Configurable

**Recommendation**: Option A (in workspace) — PRD projects are workspace-specific, easy to version control

### Q7: Lifecycle Phase for Non-Code Files
**Question**: Should non-code files (.md, .txt, .json) follow the same lifecycle phases?
- **Option A**: Same phases (CONCEPT → LOCKED → WIRING → DEVELOPMENT → PRODUCTION)
- **Option B**: Simplified phases (DRAFT → REVIEW → APPROVED → ARCHIVED)
- **Option C**: Custom phases per file type

**Recommendation**: Option A (same phases) — consistent with existing system, easier to implement

### Q8: Bruno & Oscar for Skills Files
**Question**: How should Bruno & Oscar handle skills files?
- **Option A**: Never archive skills files
- **Option B**: Archive skills files but preserve in skills schema
- **Option C**: Ask user before archiving skills files

**Recommendation**: Option B (archive but preserve) — skills files can go stale, but should be preserved for reference

---

## 📊 Timeline Summary

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| Research | Day 1 | Understand current state | 5 research reports |
| Planning | Day 2 | Design implementation | 5 planning documents |
| Implementation | Days 3-7 | Build features | 22 agents deployed |
| Validation | Day 8 | Test end-to-end | 5 validation tests |
| Documentation | Day 9 | Document everything | 4 documentation files |
| **Total** | **9 days** | | **41 deliverables** |

---

## 🚀 Next Steps

1. **Ben reviews this roadmap** — Provide feedback on open questions
2. **Deploy research agents (R1-R5)** — Day 1
3. **Deploy planning agents (P1-P5)** — Day 2
4. **Begin implementation** — Day 3

---

## 📎 Appendix: File Reference

### Files to Modify
- `backend/indexer.js` — CODE_EXTENSIONS
- `backend/index.js` — CODE_EXTENSIONS, session start hook
- `backend/intentSeeder.js` — FILENAME_PURPOSE_MAP, @@@ detection
- `backend/schemaCardEmitter.js` — Bruno & Oscar fields, @@@ fields, template fields
- `backend/gapAnalyzer.js` — @@@ dimension, template dimension
- `backend/notificationBus.js` — BRUNO_CALL event, NEEDS_AI_REVIEW event
- `backend/persistence.js` — Schema changes, new methods
- `backend/server.js` — New endpoints, modified endpoints
- `st8.html` — Intent display, Bruno & Oscar notifications, @@@ badges, PRD wizard
- `file-explorer.js` — @@@ badges
- `phreak-terminal.js` — Bruno & Oscar notifications

### Files to Create
- `backend/brunoOscar.js` — Bruno & Oscar class
- `backend/templateEngine.js` — Template engine class
- `backend/templates/` — Default PRD templates

### Database Changes
- New columns in `files` table: `lastAccessed`, `sessionsSinceAccess`, `expiryDate`, `associatedWith`, `eventTrigger`, `brunoStatus`, `needsAIReview`, `tripleAtCount`, `aiContentInjected`, `templateVariables`, `hasUnfilledVariables`
- New table: `prd_projects` (name, path, template, variables, created)
- New table: `ai_content` (filepath, content, reviewed, timestamp)

---

**END OF ROADMAP**
