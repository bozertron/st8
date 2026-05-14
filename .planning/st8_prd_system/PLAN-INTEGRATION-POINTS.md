# PRD System — Integration Point Planning

**Based on:** All research and planning documents
**Date:** 2026-05-13
**Status:** READY FOR IMPLEMENTATION

---

## File-by-File Integration Points

### 1. backend/indexer.js

| Line | Change | Description |
|------|--------|-------------|
| 161 | MODIFY | Add `.md`, `.txt`, `.json` to CODE_EXTENSIONS |
| 162 | MODIFY | Add `.planning` to IGNORE_DIRS |

```javascript
// Line 161
const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go',
  '.md', '.txt', '.json'
]);

// Line 162
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.venv', 'venv', 
  '__pycache__', '.archive', '.st8', 'vendor', 'snapshots',
  '.planning'  // ADD THIS
]);
```

**Impact:** .planning files will no longer be indexed. If PRD projects are stored in .planning, they'll need a different location.

---

### 2. backend/index.js

| Line | Change | Description |
|------|--------|-------------|
| 187 | MODIFY | Add `.md`, `.txt`, `.json` to CODE_EXTENSIONS |
| 78-183 | ADD | Initialize BrunoOscar, TemplateEngine |
| 186-402 | MODIFY | File watcher onFileChange to handle non-code files |

```javascript
// Line 187
const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go',
  '.md', '.txt', '.json'
]);

// After line 90 (after notificationBus.setPrinter)
const { BrunoOscar } = require('./brunoOscar');
const { TemplateEngine } = require('./templateEngine');
const brunoOscar = new BrunoOscar(persistence, notificationBus);
const templateEngine = new TemplateEngine();

// After line 183 (after intent seeding)
// Initialize session tracking (increments counters for all active files)
persistence.incrementSessionCounters();
console.log('[st8] Session counters incremented');

// Initialize Bruno & Oscar
brunoOscar.runBrunoCall();

// After line 196 (in file watcher, filter changes)
const codeChanges = changes.filter(c => {
  const ext = path.extname(c.path).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
});
```

---

### 3. backend/intentSeeder.js

| Line | Change | Description |
|------|--------|-------------|
| 22-78 | MODIFY | Add PRD patterns to FILENAME_PURPOSE_MAP |
| 170 | MODIFY | Detect @@@ symbols in file content |
| 255 | NO CHANGE | Keep ??? handling as-is |

```javascript
// REPLACE line 76 (existing pattern):
// OLD: { pattern: /prd/i, purpose: 'PRD generation' },
// NEW: { pattern: /prd/i, purpose: 'Product Requirements Document' },

// After line 78, ADD new patterns (prd pattern already replaced above):
{ pattern: /press[-_]?release/i, purpose: 'Press Release' },
{ pattern: /gtm[-_]?plan/i, purpose: 'Go-To-Market Plan' },
{ pattern: /stakeholder/i, purpose: 'Stakeholder Registry' },
{ pattern: /technical[-_]?spec/i, purpose: 'Technical Specification' },
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
```

---

### 4. backend/schemaCardEmitter.js

| Line | Change | Description |
|------|--------|-------------|
| 40-63 | MODIFY | Add new fields to card object |
| 91-148 | MODIFY | Read new fields from persistence |

```javascript
// Lines 40-63, add to card:
lastAccessed: file.lastAccessed || '',
sessionsSinceAccess: file.sessionsSinceAccess || 0,
expiryDate: file.expiryDate || '',
associatedWith: file.associatedWith || '',
eventTrigger: file.eventTrigger || '',
brunoStatus: file.brunoStatus || 'active',
needsAIReview: file.needsAIReview || 0,
tripleAtCount: file.tripleAtCount || 0,
aiContentInjected: file.aiContentInjected || 0,
templateVariables: file.templateVariables || '',
hasUnfilledVariables: file.hasUnfilledVariables || 0,

// In emitAllCards (line 91), when building file object:
const fileRow = persistence.getFileByPath(file.filepath);
if (fileRow) {
  Object.assign(file, fileRow);
}
```

---

### 5. backend/gapAnalyzer.js

| Line | Change | Description |
|------|--------|-------------|
| 75-88 | MODIFY | Add D7, D8, D9 dimensions |
| 379-456 | ADD | New analysis methods |

```javascript
// Line 75-88, add new dimensions:
D7_aiReview: this._analyzeAIReview(cards),
D8_templates: this._analyzeTemplates(cards),
D9_brunoOscar: this._analyzeBrunoOscar(cards),

// Add methods:
_analyzeAIReview(cards) {
  const needsReview = cards.filter(c => c.needsAIReview);
  return {
    totalFiles: cards.length,
    needsReviewCount: needsReview.length,
    needsReview: needsReview.map(c => ({ filepath: c.filepath, tripleAtCount: c.tripleAtCount })),
    summary: `${needsReview.length} files need AI review`
  };
}

_analyzeTemplates(cards) {
  const withTemplates = cards.filter(c => c.templateVariables);
  const unfilled = cards.filter(c => c.hasUnfilledVariables);
  return {
    totalFiles: cards.length,
    templateCount: withTemplates.length,
    unfilledCount: unfilled.length,
    summary: `${withTemplates.length} files have templates, ${unfilled.length} unfilled`
  };
}

_analyzeBrunoOscar(cards) {
  const flagged = cards.filter(c => c.brunoStatus === 'flagged');
  const archived = cards.filter(c => c.brunoStatus === 'archived');
  return {
    totalFiles: cards.length,
    flaggedCount: flagged.length,
    archivedCount: archived.length,
    flagged: flagged.map(c => ({ filepath: c.filepath, sessionsSinceAccess: c.sessionsSinceAccess })),
    summary: `${flagged.length} flagged, ${archived.length} archived`
  };
}
```

---

### 6. backend/notificationBus.js

| Line | Change | Description |
|------|--------|-------------|
| 53-59 | MODIFY | Add new status symbols |

```javascript
// Line 53-59, add:
const status = event.mutationType === 'EDIT' ? '✎' :
               event.mutationType === 'CREATE' ? '+' :
               event.mutationType === 'DELETE' ? '−' :
               event.mutationType === 'CONCEPT' ? '◈' :
               event.mutationType === 'LOCK' ? '⊘' :
               event.mutationType === 'PRODUCTION' ? '★' :
               event.mutationType === 'BRUNO_CALL' ? '⚠' :
               event.mutationType === 'ARCHIVE' ? '⚰' :
               event.mutationType === 'AI_REVIEW_NEEDED' ? '@' : '·';
```

---

### 7. backend/persistence.js

| Line | Change | Description |
|------|--------|-------------|
| 47-125 | MODIFY | Add new columns to ST8_SCHEMA |
| 483-504 | ADD | New methods before close() |

See PLAN-DATA-MODEL.md for complete method specifications.

**Critical:** Update `ST8_SCHEMA` to include new columns so new databases get them automatically. Existing databases will need ALTER TABLE statements.

---

### 8. backend/server.js

| Line | Change | Description |
|------|--------|-------------|
| 81-127 | MODIFY | Add new endpoints to switch statement |
| 732-1051 | ADD | New handler methods |

```javascript
// Lines 81-127, add cases:
case '/api/prd-projects':
    this._handlePrdProjects(req, res);
    break;
case '/api/prd-projects':
    // Handle with regex for /api/prd-projects/:name
    break;
case '/api/bruno-call':
    this._handleBrunoCall(req, res);
    break;
case '/api/oscar-house':
    this._handleOscarHouse(req, res);
    break;
case '/api/needs-ai-review':
    this._handleNeedsAIReview(req, res);
    break;
case '/api/mark-reviewed':
    this._handleMarkReviewed(req, res);
    break;
case '/api/templates':
    this._handleTemplates(req, res);
    break;

// Add handler methods after _handleGapAnalysis (line 1051)
_handlePrdProjects(req, res) { /* ... */ }
_handleBrunoCall(req, res) { /* ... */ }
_handleOscarHouse(req, res) { /* ... */ }
_handleNeedsAIReview(req, res) { /* ... */ }
_handleMarkReviewed(req, res) { /* ... */ }
_handleTemplates(req, res) { /* ... */ }
```

---

### 9. st8.html

| Line | Change | Description |
|------|--------|-------------|
| 1721-1756 | MODIFY | Add intent display to renderFileList |
| 2010-2136 | MODIFY | Add new mutation types to SSE handler |
| 2137 | ADD | PRD wizard modal HTML |
| 1548-1663 | ADD | PRD wizard JavaScript |

See PLAN-FRONTEND-IMPACT.md for detailed changes.

---

### 10. file-explorer.js

| Line | Change | Description |
|------|--------|-------------|
| ~400-500 | MODIFY | Add purpose column to table |
| ~600-700 | MODIFY | Add PRD actions to toolbar |

---

### 11. phreak-terminal.js

| Line | Change | Description |
|------|--------|-------------|
| ~200-300 | ADD | New commands: bruno-call, oscar-house, ai-review, prd-create |

---

## New Files to Create

### 12. backend/brunoOscar.js

**Purpose:** Stale file lifecycle management
**Size:** ~200 lines
**Exports:** `{ BrunoOscar }`

**Key methods:**
- `runBrunoCall(threshold)` — scan and flag stale files
- `archiveFile(filepath)` — move to Oscar's House
- `setEventTrigger(filepath, event)` — set unblock event
- `onEventTriggered(event)` — handle triggered events

### 13. backend/templateEngine.js

**Purpose:** Variable substitution for PRD templates
**Size:** ~150 lines
**Exports:** `{ TemplateEngine }`

**Key methods:**
- `fillTemplate(template, variables)` — replace {{vars}}
- `detectVariables(template)` — extract {{var}} names
- `loadTemplate(name)` — load from ~/.st8/templates/
- `saveTemplate(name, content)` — save custom template

### 14. backend/templates/ (directory)

**Purpose:** Default PRD templates
**Files:**
- `press-release.md`
- `technical-spec.md`
- `gtm-plan.md`
- `stakeholder-registry.md`
- `roadmap.md`

---

## Dependency Graph

```
Wave 1: Foundation
├── indexer.js (CODE_EXTENSIONS, IGNORE_DIRS)
├── index.js (CODE_EXTENSIONS)
├── persistence.js (schema + methods)
└── st8-types.js (updated shapes)

Wave 2: Backend Logic
├── brunoOscar.js (depends on persistence, notificationBus)
├── templateEngine.js (independent)
├── intentSeeder.js (add PRD patterns, @@@ detection)
└── schemaCardEmitter.js (add new fields)

Wave 3: API Endpoints
├── server.js (new endpoints, depends on all Wave 2)
└── gapAnalyzer.js (new dimensions)

Wave 4: Frontend
├── st8.html (intent display, badges, wizard)
├── file-explorer.js (purpose column, actions)
└── phreak-terminal.js (new commands)

Wave 5: Integration
├── index.js (wire BrunoOscar to session start)
├── gapAnalyzer.js (full integration)
└── schemaCardEmitter.js (template integration)
```

---

## Rollback Procedures

### If Wave 1 fails:
- Revert CODE_EXTENSIONS changes
- Remove new columns from schema (or recreate DB)
- Remove .planning from IGNORE_DIRS

### If Wave 2 fails:
- Delete brunoOscar.js, templateEngine.js
- Revert intentSeeder.js patterns
- Revert schemaCardEmitter.js fields

### If Wave 3 fails:
- Remove new server.js endpoints
- Revert gapAnalyzer.js dimensions

### If Wave 4 fails:
- Revert st8.html changes
- Revert file-explorer.js changes
- Frontend can be broken while backend works

### If Wave 5 fails:
- Remove BrunoOscar initialization from index.js
- Revert gapAnalyzer.js integration

---

## END OF INTEGRATION POINT PLAN
