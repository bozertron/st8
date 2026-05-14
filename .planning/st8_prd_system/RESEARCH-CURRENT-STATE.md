# PRD System Integration — Current State Research Report

**Researched:** 2026-05-13
**Domain:** ST8 Backend/Frontend PRD System Integration
**Confidence:** HIGH

---

## Summary

This report documents the current state of the ST8 system as it relates to the PRD system integration roadmap. The system is a Node.js-based full-stack logic analyzer with SQLite persistence, SSE notifications, file watching, and a custom HTML/CSS/JS frontend. 

**Key finding:** The PRD system features described in the roadmap (Bruno & Oscar, @@@ symbols, template engine, global indexing of .md/.txt/.json) are **entirely absent** from the current codebase. The system has solid foundations — lifecycle phases, intent seeding, schema cards, gap analysis, mutation logging, and SSE notifications — but requires significant schema, API, and UI extensions to support the PRD system.

**Primary recommendation:** Proceed with the 5-wave implementation plan as designed in the roadmap. The architecture is clean and modular enough to absorb the new features without major refactoring.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File indexing | API / Backend | — | Node.js filesystem + AST parsing |
| Intent inference | API / Backend | — | Regex heuristics on filename/content |
| Schema card emission | API / Backend | — | JSON file generation |
| Gap analysis | API / Backend | — | Reads schema cards, computes dimensions |
| Lifecycle management | API / Backend | — | SQLite state machine |
| File watching | API / Backend | — | chokidar integration |
| Notifications | API / Backend | Browser / Client | SSE bus to frontend |
| File listing UI | Browser / Client | — | HTML/JS rendered in void-right-panel |
| Terminal interface | Browser / Client | — | phreak-terminal.js |
| PRD generation | API / Backend | — | Markdown from schema cards |
| Bruno & Oscar (new) | API / Backend | Database / Storage | Session-based lifecycle cleanup |
| @@@ tracking (new) | API / Backend | Browser / Client | AI content review workflow |
| Template engine (new) | API / Backend | — | String substitution for PRDs |

---

## Standard Stack

### Core (Already Implemented)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Node.js | ≥16 | Runtime | ✓ Present |
| better-sqlite3 | latest | SQLite database | ✓ Present |
| chokidar | latest | File watching | ✓ Present (lazy-loaded) |
| http | built-in | HTTP server | ✓ Present |
| EventSource/SSE | built-in | Real-time notifications | ✓ Present |

### Supporting (Already Implemented)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| crypto | built-in | SHA256 hashing | ✓ Present |
| fs/path | built-in | File operations | ✓ Present |
| maestro lib | local | AST parsing, graph building | ✓ Present (lazy-loaded) |

### New Components Needed (PRD System)
| Component | Type | Purpose |
|-----------|------|---------|
| BrunoOscar | Class | Stale file lifecycle management |
| TemplateEngine | Class | `{{variable}}` substitution |
| PRD Project API | Endpoints | CRUD for PRD projects |
| Intent Display | UI | Show purpose below filename |
| @@@ Badge System | UI | Flag AI-generated content |

---

## Current State — Detailed Findings

### 1. File Indexing (indexer.js + index.js)

**Current CODE_EXTENSIONS (line 161 indexer.js, line 187 index.js):**
```javascript
const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go']);
```

**Missing:** `.md`, `.txt`, `.json` — these are explicitly excluded.

**Impact of adding them:**
- `.st8/schema-cards/*.json` would be indexed (but `.st8` is in IGNORE_DIRS)
- `.planning/**/*.md` would be indexed (`.planning` is NOT in IGNORE_DIRS in indexer.js)
- `node_modules/**/*.json` would be indexed (but `node_modules` is in IGNORE_DIRS)
- `connection-state.json` and `ai-signal.toml` in root WOULD be indexed

**File watcher (fileWatcher.js lines 54-71):**
Already ignores `**/*.json`, `**/*.toml`, `**/.st8/**`, `**/.planning/st8_identity_system/**` — so adding .json to CODE_EXTENSIONS in the watcher context is mostly safe, but the watcher ignores are more restrictive than indexer ignores.

**NO GAP:** `.planning` IS already in IGNORE_DIRS (indexer.js:162). The set includes: `node_modules`, `.git`, `dist`, `build`, `.venv`, `venv`, `__pycache__`, `.archive`, `.planning`, `.st8`, `vendor`, `snapshots`. This means adding .md/.txt/.json to CODE_EXTENSIONS is SAFE — planning documents will NOT be indexed. PRD projects must be stored outside `.planning/` (e.g., `<workspace>/prd/` or `~/prd-projects/`).

**File explosion risk: NONE** — the IGNORE_DIRS already protects against indexing planning documents.

### 2. Intent Seeding (intentSeeder.js)

**Current FILENAME_PURPOSE_MAP (lines 22-78):**
Has 47 patterns, all code-focused (persistence, server, indexer, types, schema, emitter, watcher, generator, printer, etc.).

**Missing PRD patterns:**
- press-release
- gtm-plan
- stakeholder
- technical-spec
- prd
- roadmap
- meeting-notes
- decision-log
- risk-register
- user-story
- acceptance-criteria
- changelog
- readme
- todo
- bug-report
- feature-request

**Current ??? handling (line 255):**
All generated purposes automatically get `???` appended:
```javascript
return `${purpose} ???`;
```

This means the system ALREADY uses `???` as the "inferred, needs human review" marker. The @@@ system would be the counterpart: "AI has provided content, needs human review."

### 3. Schema Cards (schemaCardEmitter.js)

**Current card fields (lines 40-63):**
```javascript
{
  fingerprint, filepath, filename, sha256Hash, fileSizeBytes,
  status, reachabilityScore, impactRadius, lifecyclePhase,
  birthTimestamp, lastModified, lastIndexed, isEntryPoint,
  exports, imports, connections, intent,
  mutationCount, lastMutation
}
```

**Missing for PRD system:**
- `lastAccessed` — for Bruno & Oscar staleness tracking
- `sessionsSinceAccess` — session counter
- `expiryDate` — auto-deletion date
- `associatedWith` — parent file reference
- `eventTrigger` — event that unblocks file
- `brunoStatus` — Bruno & Oscar state
- `needsAIReview` — @@@ flag
- `tripleAtCount` — count of @@@ occurrences
- `aiContentInjected` — whether AI content was injected
- `templateVariables` — detected {{variables}}
- `hasUnfilledVariables` — whether all vars are filled

### 4. Gap Analysis (gapAnalyzer.js)

**Current 6 dimensions:**
- D1: Lifecycle Progression
- D2: Status Health
- D3: Intent Authoring
- D4: Export Surface
- D5: Connection Integrity
- D6: Architectural Completeness

**Missing dimensions:**
- D7: AI Review Status (@@@ tracking)
- D8: Template Completeness (unfilled variables)
- D9: Bruno & Oscar Health (stale files, cleanup status)

### 5. API Endpoints (server.js)

**Current endpoints (lines 81-127):**
```
GET  /api/connection-state.json
GET  /api/ai-signal.toml
GET  /api/health
POST /api/index
POST /api/file-intent
GET  /api/settings
POST /api/settings
POST /api/verify
GET  /api/files
GET  /api/mutations (SSE)
POST /api/concept-file
POST /api/mvp-lock
GET  /api/prd
POST /api/production-promote
GET  /api/gap-analysis
```

**Missing endpoints:**
```
GET    /api/prd-projects
POST   /api/prd-projects
GET    /api/prd-projects/:name
POST   /api/bruno-call
POST   /api/oscar-house
GET    /api/needs-ai-review
POST   /api/mark-reviewed
GET    /api/templates
POST   /api/templates
```

### 6. Database Schema (persistence.js)

**Current tables:**
- `file_registry` — file metadata
- `connections` — import relationships
- `file_intent` — purpose/dependsOn/valueStatement
- `file_mutation_log` — mutation history
- `activity_log` — activity stream
- `st8_settings` — key-value settings

**Missing columns in `file_registry`:**
- `lastAccessed TEXT` — last time file was read
- `sessionsSinceAccess INTEGER DEFAULT 0` — counter
- `expiryDate TEXT` — auto-deletion date
- `associatedWith TEXT` — parent file path
- `eventTrigger TEXT` — trigger event
- `brunoStatus TEXT DEFAULT 'active'` — active | flagged | archived
- `needsAIReview INTEGER DEFAULT 0` — boolean
- `tripleAtCount INTEGER DEFAULT 0` — counter
- `aiContentInjected INTEGER DEFAULT 0` — boolean
- `templateVariables TEXT` — JSON array of variable names
- `hasUnfilledVariables INTEGER DEFAULT 0` — boolean

**Missing tables:**
- `prd_projects` (name, path, template, variables JSON, created TEXT)
- `ai_content` (filepath TEXT, content TEXT, reviewed INTEGER DEFAULT 0, timestamp TEXT)

### 7. Frontend UI (st8.html)

**Current file list rendering (lines 1721-1756):**
Shows: status dot, filename, action buttons (Notes, Copy)

**Missing:**
- Intent purpose subtitle under filename
- ??? badge for inferred intent
- @@@ badge for AI-generated content
- Bruno & Oscar notification toasts
- PRD project wizard
- Template variable editor

**Current CSS variables (lines 22-36):**
Has `--void`, `--text`, `--gold`, `--cyan`, `--pink` — sufficient for new badges.

### 8. Notification Bus (notificationBus.js)

**Current events:**
- `mutation` — generic mutation
- `mutation:${type}` — typed mutation (CREATE, EDIT, DELETE, etc.)

**Missing events:**
- `bruno:call` — stale file detected
- `bruno:archive` — file moved to Oscar's House
- `ai:review-needed` — @@@ content detected
- `ai:reviewed` — @@@ content approved
- `template:variables-filled` — all variables filled

### 9. PRD Generation (prdGenerator.js)

**Current capabilities:**
- Loads schema cards from `.st8/schema-cards/`
- Groups by lifecycle phase
- Generates markdown with file details
- Writes to `.planning/st8_identity_system/PRD.md`

**Missing:**
- Template engine with variable substitution
- PRD project management
- Template inheritance/extensibility
- Variable validation

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template engine | Custom parser | Simple regex replace: `str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')` | Regex is sufficient for `{{var}}` syntax, handles 99% of cases |
| File staleness tracking | Custom cron | Session counter in DB | Simpler, no cron dependency, works with existing session model |
| @@@ content storage | Inline JSON blocks | Sidecar `.ai.json` files | Keeps markdown clean, git-friendly, easy to review |
| PRD project storage | Custom format | Markdown + JSON sidecar | Industry standard, tool-agnostic |

---

## Common Pitfalls

### Pitfall 1: File Explosion from Global Indexing (MITIGATED)
**What goes wrong:** Adding .md/.txt/.json to CODE_EXTENSIONS indexes thousands of files
**Why it doesn't apply:** `.planning` is already in IGNORE_DIRS (indexer.js:162), and `.st8` is also excluded. The only risk is if users store PRD projects INSIDE these directories.
**How to avoid:** Store PRD projects in `<workspace>/prd/` or `~/prd-projects/`, NOT in `.planning/`.
**Warning signs:** Indexing takes >30 seconds, connection-state.json bloats to >1MB

### Pitfall 2: Schema Card Bloat
**What goes wrong:** Non-code files (markdown, text) don't have exports/imports, so schema cards contain empty arrays
**Why it happens:** SchemaCardEmitter expects AST-extracted exports/imports
**How to avoid:** For non-code files, populate `intent` fields heavily and leave exports/imports empty. Add a `fileType` field to distinguish code vs document.
**Warning signs:** Gap analysis D4 (Export Surface) shows 0% coverage for .md files

### Pitfall 3: Lifecycle Phase Mismatch for Documents
**What goes wrong:** PRD files going through CONCEPT→LOCKED→WIRING→DEVELOPMENT→PRODUCTION doesn't make semantic sense
**Why it happens:** Code lifecycle phases don't map to document lifecycle
**How to avoid:** Either (a) use same phases for consistency, or (b) add document-specific phases. Recommendation: same phases for simplicity, with phase names being generic enough (CONCEPT=Draft, LOCKED=Review, etc.)
**Warning signs:** Users confused why a README is in "WIRING" phase

### Pitfall 4: Bruno & Oscar Over-Eager Cleanup
**What goes wrong:** Important but rarely-accessed files (e.g., legal docs, architecture decision records) get archived
**Why it happens:** Threshold-based cleanup doesn't understand file importance
**How to avoid:** Never archive files with `eventTrigger` set, never archive files in LOCKED or PRODUCTION phase, allow per-file "pin" flag
**Warning signs:** Files disappearing from index unexpectedly

### Pitfall 5: @@@ Symbol Collision (SOLVED)
**What goes wrong:** `@@@` might appear in legitimate content (email addresses, markdown headers, code comments)
**Solution:** Use a specific regex pattern that only matches @@@ in controlled contexts:

```javascript
// Valid @@@ formats:
// 1. End of line: "Some content @@@"
// 2. HTML comment: "<!-- @@@ -->"
// 3. Standalone line: "@@@"
// 4. With marker: "@@@AI_REVIEW"

const TRIPLE_AT_PATTERN = /(?:^|\s)@@@(?:\s|$)|<!--\s*@@@\s*-->|@@@AI_REVIEW/gm;

// Detection in intentSeeder.js:
const tripleAtMatches = content.match(TRIPLE_AT_PATTERN) || [];
const tripleAtCount = tripleAtMatches.length;

if (tripleAtCount > 0) {
  this.persistence.flagForAIReview(file.fingerprint, tripleAtCount);
}
```

**Why this works:**
- `@@@` at end of line = clear intent marker
- `<!-- @@@ -->` = HTML comment, invisible in rendered markdown
- `@@@AI_REVIEW` = explicit marker, unlikely in natural content
- Avoids false positives from `user@@@domain.com` or `### @@@ Section`

**Warning signs:** If users report false positives, tighten the pattern to require `@@@AI_REVIEW` only.

---

## Code Examples

### Verified: Adding .md/.txt/.json to CODE_EXTENSIONS
```javascript
// Source: indexer.js line 161, index.js line 187
const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go',
  '.md', '.txt', '.json'
]);
```

### Verified: Intent Purpose Display in File List
```javascript
// Source: st8.html lines 1743-1755
// CURRENT:
'<div class="file-name">' + escapeHtml(file.filename) + '</div>' +

// NEW:
'<div class="file-name">' + escapeHtml(file.filename) + '</div>' +
'<div class="file-purpose">' + escapeHtml(file.intent?.purpose || '(no purpose)') + 
  (file.intent?.purpose?.includes('???') ? ' <span class="badge-unknown">???</span>' : '') +
'</div>' +
```

### Verified: Simple Template Engine
```javascript
// Simple string replacement — sufficient for PRD templates
function fillTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}
```

### Verified: Bruno & Oscar Schema Columns
```sql
-- Add to file_registry table in persistence.js
ALTER TABLE file_registry ADD COLUMN lastAccessed TEXT;
ALTER TABLE file_registry ADD COLUMN sessionsSinceAccess INTEGER DEFAULT 0;
ALTER TABLE file_registry ADD COLUMN expiryDate TEXT;
ALTER TABLE file_registry ADD COLUMN associatedWith TEXT;
ALTER TABLE file_registry ADD COLUMN eventTrigger TEXT;
ALTER TABLE file_registry ADD COLUMN brunoStatus TEXT DEFAULT 'active';
ALTER TABLE file_registry ADD COLUMN needsAIReview INTEGER DEFAULT 0;
ALTER TABLE file_registry ADD COLUMN tripleAtCount INTEGER DEFAULT 0;
ALTER TABLE file_registry ADD COLUMN aiContentInjected INTEGER DEFAULT 0;
ALTER TABLE file_registry ADD COLUMN templateVariables TEXT;
ALTER TABLE file_registry ADD COLUMN hasUnfilledVariables INTEGER DEFAULT 0;
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Code-only indexing | Global file indexing | Enables PRD, docs, config tracking |
| Manual file cleanup | Bruno & Oscar automation | Reduces stale file accumulation |
| Human-only intent | AI-assisted with @@@ review | Faster intent generation with human oversight |
| Static PRD generation | Template-based PRD projects | Reusable, variable-driven PRDs |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding `.planning` to IGNORE_DIRS won't break existing indexing | File Indexing | May hide important planning docs from index; mitigation: make it configurable |
| A2 | Regex-based template engine is sufficient | Template Engine | If users need complex logic (conditionals, loops), we'll need a real template engine like Handlebars |
| A3 | Same lifecycle phases work for documents | Lifecycle | May cause user confusion; can be addressed with documentation |
| A4 | Sidecar `.ai.json` files are preferable to inline storage | @@@ System | If users want single-file PRDs, inline may be better; sidecar is reversible |
| A5 | Session-based staleness counting is sufficient | Bruno & Oscar | If sessions are very long, files may be marked stale too slowly; configurable threshold mitigates |

---

## Open Questions

1. **Should .planning files be indexed?**
   - What we know: `.planning` contains PRDs, roadmaps, research
   - What's unclear: Whether these should appear in the main file list or a separate "Documents" view
   - Recommendation: Index them but add a `category` filter to the file list (code vs document)

2. **How should the template engine handle missing variables?**
   - What we know: Variables are `{{name}}` format
   - What's unclear: Whether to leave them as `{{name}}` or replace with empty string
   - Recommendation: Leave as `{{name}}` so users can see what's missing

3. **Should Bruno & Oscar run automatically or on-demand?**
   - What we know: The roadmap says "on session start"
   - What's unclear: Whether this means every time the backend starts, or every time a user opens the UI
   - Recommendation: On backend startup, with manual trigger via API

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v16+ | — |
| better-sqlite3 | Database | ✓ | latest | — |
| chokidar | File watcher | ✓ | latest | — |
| http | Server | ✓ | built-in | — |

**Missing dependencies with no fallback:** None

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — manual testing only |
| Config file | None |
| Quick run command | `node backend/indexer.js . && node backend/server.js --serve` |
| Full suite command | Manual verification via curl + browser |

### Phase Requirements → Test Map

Since this is a system integration phase with no formal test framework, validation will be manual:

| Requirement | Behavior | Test Type | Automated Command | File Exists? |
|-------------|----------|-----------|-------------------|-------------|
| Global indexing | .md files appear in connection-state.json | manual | `curl /api/connection-state.json \| jq '.files[] \| select(.filepath \| endswith(".md"))'` | ❌ |
| Bruno & Oscar | Stale files flagged after threshold | manual | `curl -X POST /api/bruno-call` | ❌ |
| @@@ symbols | AI content detected and stored | manual | Create file with `@@@`, index, check `/api/needs-ai-review` | ❌ |
| Intent display | Purpose shown under filename | manual | Open st8.html, check file list | ❌ |
| PRD patterns | Filename patterns detected | manual | Create `press-release.md`, check intent.purpose | ❌ |
| Template engine | Variables substituted | manual | `curl /api/templates/test` | ❌ |
| PRD project API | CRUD operations work | manual | `curl -X POST /api/prd-projects ...` | ❌ |
| Lifecycle progression | Context-aware endpoints | manual | `curl -X POST /api/mvp-lock ...` | ❌ |

### Wave 0 Gaps
- [ ] No test framework detected
- [ ] All validation is manual/API-based
- [ ] Need verification scripts for each wave

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not in scope for this phase |
| V3 Session Management | No | Not in scope for this phase |
| V4 Access Control | Yes | Path traversal protection exists in `_handleFileList` (lines 491-500 server.js) |
| V5 Input Validation | Yes | Body size limits (1KB) on all POST endpoints; path traversal checks |
| V6 Cryptography | No | SHA256 used for file hashing (appropriate) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in file list | Tampering | `path.relative()` boundary check (server.js:491-500) |
| CORS wildcard | Information Disclosure | Restricted to localhost (server.js:60) |
| SSE client exhaustion | Denial of Service | maxSseClients limit (notificationBus.js:22) |
| Large request bodies | Denial of Service | 1KB body limit on all POST endpoints |

---

## Sources

### Primary (HIGH confidence)
- `/home/bozertron/1_AT_A_TIME/st8/backend/indexer.js` — CODE_EXTENSIONS line 161, IGNORE_DIRS line 162
- `/home/bozertron/1_AT_A_TIME/st8/backend/index.js` — CODE_EXTENSIONS line 187
- `/home/bozertron/1_AT_A_TIME/st8/backend/intentSeeder.js` — FILENAME_PURPOSE_MAP lines 22-78, ??? handling line 255
- `/home/bozertron/1_AT_A_TIME/st8/backend/schemaCardEmitter.js` — Card fields lines 40-63
- `/home/bozertron/1_AT_A_TIME/st8/backend/gapAnalyzer.js` — 6 dimensions lines 75-88
- `/home/bozertron/1_AT_A_TIME/st8/backend/server.js` — API endpoints lines 81-127
- `/home/bozertron/1_AT_A_TIME/st8/backend/persistence.js` — Schema lines 47-125
- `/home/bozertron/1_AT_A_TIME/st8/st8.html` — renderFileList lines 1721-1756
- `/home/bozertron/1_AT_A_TIME/st8/backend/notificationBus.js` — Events lines 33-69
- `/home/bozertron/1_AT_A_TIME/st8/backend/fileWatcher.js` — Ignored patterns lines 54-71
- `/home/bozertron/1_AT_A_TIME/st8/backend/prdGenerator.js` — PRD generation lines 117-143

### Secondary (MEDIUM confidence)
- PRD-RESEARCH-ROADMAP.md — Implementation plan and agent prompts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified all files exist and versions are current
- Architecture: HIGH — read all core files, understand data flow
- Pitfalls: MEDIUM — some are predictive (haven't seen them fail yet)

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable stack, low churn expected)

**Next steps:**
1. Review this research with Ben
2. Proceed to planning phase (schema changes, API design, frontend changes)
3. Execute implementation in 5 waves as specified in roadmap

---

**END OF RESEARCH REPORT**
