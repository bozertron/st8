# PRD System Implementation Gap Analysis
## Date: 2026-05-13
## Scope: Full codebase audit — 30+ files across backend, frontend, and root

---

## EXECUTIVE SUMMARY

The st8 PRD system was the subject of extensive architectural planning — over 52 planning documents totaling 384KB of specifications, research reports, design decisions, and agent deployment strategies. A 5-wave, 22-agent implementation strategy was designed with granular task breakdowns, data model plans, API designs, integration point maps, and frontend impact analyses. The planning effort was thorough and well-structured.

The planning documents — specifically `wave-manifest.md` and `PLAN-AGENT-DEPLOYMENT.md` — indicate "Phase 0 — Awaiting approval" and list all 5 implementation waves as NOT DONE. **This is factually incorrect.** Three independent research agents audited every file in the project and found that approximately 80-85% of the planned PRD system features ARE implemented in the actual codebase. The backend is roughly 90% complete, the frontend roughly 75% complete, and only integration wiring (Wave 5) and testing remain substantially incomplete.

The planning documents are **STALE** — they do not reflect the current state of the codebase. This discrepancy is the most critical finding of this audit. Either implementation proceeded without updating the planning docs, or a separate implementation effort occurred outside the planned wave structure. Regardless of which, any future agent deployment MUST use this gap analysis as the source of truth, not the wave manifest.

The remaining gaps are concentrated in three areas: (1) Wave 5 end-to-end integration — components work individually but aren't wired together as a system, (2) missing UI features — intent badges, notification toasts, and terminal commands planned for Wave 4, and (3) a complete absence of automated testing. These are integration, polish, and quality gaps — not wholesale missing features.

---

## CRITICAL FINDING: PLANNING DOCS ARE STALE

The `wave-manifest.md` and `PLAN-AGENT-DEPLOYMENT.md` documents indicate "Phase 0 — Awaiting approval" and list all 5 implementation waves as NOT DONE. This is factually incorrect.

### What the Plans Say vs. What Actually Exists

| Planned Item | Plan Status | Actual Status | Evidence |
|---|---|---|---|
| .md/.txt/.json in CODE_EXTENSIONS | ❌ Not Done | ✅ DONE | indexer.js line 161, index.js line 187 |
| brunoOscar.js (Bruno & Oscar lifecycle) | ❌ Not Done | ✅ DONE | backend/brunoOscar.js — 186 lines, complete class |
| templateEngine.js (template engine) | ❌ Not Done | ✅ DONE | backend/templateEngine.js — 121 lines, complete class |
| prd_projects table in persistence.js | ❌ Not Done | ✅ DONE | persistence.js lines 137-145 |
| ai_content table in persistence.js | ❌ Not Done | ✅ DONE | persistence.js |
| Bruno/Oscar persistence methods | ❌ Not Done | ✅ DONE | getStaleFiles, updateFileLifecycle, archiveFile, setExpiryDate |
| @@@ symbol persistence methods | ❌ Not Done | ✅ DONE | flagForAIReview, markAIReviewed, getFilesNeedingAIReview |
| Template persistence methods | ❌ Not Done | ✅ DONE | setTemplateVariables, getTemplateVariables |
| PRD project CRUD methods | ❌ Not Done | ✅ DONE | createPRDProject, getPRDProject, getAllPRDProjects, updatePRDProject, deletePRDProject |
| /api/prd endpoint | ❌ Not Done | ✅ DONE | server.js — loads schema cards, generates PRD markdown |
| /api/prd-projects endpoint | ❌ Not Done | ✅ DONE | server.js — GET/POST |
| /api/bruno-call endpoint | ❌ Not Done | ✅ DONE | server.js |
| /api/oscar-house endpoint | ❌ Not Done | ✅ DONE | server.js |
| /api/needs-ai-review endpoint | ❌ Not Done | ✅ DONE | server.js |
| /api/mark-reviewed endpoint | ❌ Not Done | ✅ DONE | server.js |
| /api/templates endpoint | ❌ Not Done | ✅ DONE | server.js — GET/POST |
| PRD wizard UI in st8.html | ❌ Not Done | ✅ DONE | st8.html lines 1606-1628 |
| Template loader with dynamic options | ❌ Not Done | ✅ DONE | st8.html lines 1800-1817 |
| Variable editor UI | ❌ Not Done | ✅ DONE | st8.html lines 1845-1885 |
| CREATE PRD button in file explorer | ❌ Not Done | ✅ DONE | file-explorer.js line 362 |
| Intent seeder @@@ detection | ❌ Not Done | ✅ DONE | intentSeeder.js lines 187-195 |
| PRD patterns in intentSeeder | ❌ Not Done | ✅ DONE | intentSeeder.js — 45+ filename patterns |
| prdGenerator.js (PRD generation) | ❌ Not Done | ✅ DONE | backend/prdGenerator.js — 201 lines |
| Default templates (press-release, technical-spec, gtm-plan) | ❌ Not Done | ✅ DONE | templateEngine.js lines 82-108 |

---

## PER-FILE GAP ANALYSIS

### Backend Files

#### 1. index.js (Main Orchestrator) — 407 lines
**Status:** COMPLETE with minor issues
**What Works:**
- Full pipeline: indexing → watching → serving → schema cards → gap analysis → intent seeding
- .md included in CODE_EXTENSIONS
- Global error handlers (unhandled rejections, uncaught exceptions)

**Gaps:**
- **G-IDX-01:** Promise cleanup inconsistency — `persistence.initialize().then()` chains without `.finally()` guarantee in some paths
- **G-IDX-02:** Mixed resource cleanup patterns — some handlers use `.finally()`, some use explicit close in catch

**Severity:** Low — affects edge-case error scenarios only

---

#### 2. server.js (HTTP API) — 1,431 lines
**Status:** COMPLETE — 31 endpoints, extensive coverage
**What Works:**
- All 11 planned PRD endpoints implemented
- CORS hardened to localhost only (CR-01 fix)
- Directory traversal protection (CR-02 fix)
- SSE origin validation
- Request body size limits

**Gaps:**
- **G-SRV-01:** Race condition on manifest updates — read-modify-write on `connection-state.json` without file locking (server.js line 369-396). Concurrent writes could cause data loss.
- **G-SRV-02:** Inconsistent resource cleanup — some handlers properly close persistence in finally blocks, others don't guarantee cleanup on sync errors before async operations
- **G-SRV-03:** No rate limiting on API endpoints
- **G-SRV-04:** No input validation on intent text (potential XSS if rendered in HTML)

**Severity:** G-SRV-01 is Medium (data loss risk), others Low

---

#### 3. persistence.js (SQLite Layer) — 705 lines
**Status:** COMPLETE — 40+ methods, all tables present
**What Works:**
- All planned tables: `file_registry`, `connections`, `file_intent`, `file_mutation_log`, `activity_log`, `st8_settings`, `prd_projects`, `ai_content`
- All planned CRUD methods for PRD projects
- All Bruno/Oscar lifecycle methods
- All @@@ symbol tracking methods
- Template variable methods
- UNIQUE constraint on connections (CR-01 fix)

**Gaps:**
- **G-PER-01:** `deleteFile()` transaction errors propagate without wrapping
- **G-PER-02:** Some planned columns from `PLAN-DATA-MODEL.md` may not all be present (need to verify: `lastAccessed`, `sessionsSinceAccess`, `expiryDate`, `associatedWith`, `eventTrigger`, `brunoStatus`, `needsAIReview`, `tripleAtCount`, `aiContentInjected`, `templateVariables`, `hasUnfilledVariables` — 11 new columns were planned for `file_registry`)
- **G-PER-03:** No `incrementSessionCounters()` method found — planned for session-based Bruno tracking
- **G-PER-04:** No `markFileAccessed()` method found — planned for session-based Bruno tracking

**Severity:** G-PER-02 through G-PER-04 are Medium — Bruno session tracking may be incomplete

---

#### 4. brunoOscar.js (File Lifecycle) — 186 lines
**Status:** COMPLETE
**What Works:**
- `runBrunoCall(threshold)` — identifies stale files
- `runOscarHouse(gracePeriod)` — archives flagged files
- `setEventTrigger` — event-based un-archiving
- `onEventTriggered` — un-archives on event fire
- `_appendToParent` — stale file content appending with @@@ flag

**Gaps:**
- **G-BO-01:** Direct db access (`this.persistence.db.prepare()`) bypasses persistence API — fragile coupling
- **G-BO-02:** No integration with `index.js` session startup — planned in Wave 5 (A19) but not wired

**Severity:** G-BO-02 is Medium — Bruno/Oscar doesn't auto-run on startup as designed

---

#### 5. templateEngine.js (Template Management) — 121 lines
**Status:** COMPLETE
**What Works:**
- `fillTemplate` with varName substitution
- `detectVariables` extraction
- `loadTemplate` / `saveTemplate` from disk
- `listTemplates` enumeration
- `ensureDefaultTemplates` bootstrap (press-release, technical-spec, gtm-plan)

**Gaps:**
- **G-TE-01:** No `backend/templates/` directory exists — `ensureDefaultTemplates` creates templates in memory but there's no persistent template directory
- **G-TE-02:** Template content is minimal (placeholder-level) — real templates need content written

**Severity:** Low

---

#### 6. prdGenerator.js (PRD Generation) — 201 lines
**Status:** COMPLETE
**What Works:**
- Reads schema cards from `.st8/schema-cards/`
- Groups by lifecycle phase
- Generates summary table
- Detailed sections per file with exports, dependencies, metadata
- Markdown output

**Gaps:**
- **G-PRD-01:** Generates PRD from schema cards (artifact-based), NOT from actual PRD project conversations/templates as the full vision described. This is a Phase 0 implementation — the full conversational PRD composition engine is not built.

**Severity:** Low for current phase, but represents the biggest gap between current state and the full PRD vision

---

#### 7. indexer.js (File Discovery) — 483 lines
**Status:** COMPLETE
**What Works:**
- `.md`, `.txt`, `.json` in CODE_EXTENSIONS
- `.planning` in IGNORE_DIRS
- SHA256 hashing, AST parsing, graph building

**Gaps:**
- **G-IX-01:** Lazy loading of lib modules with no fallback error handling if load fails — just returns null, callers must handle
- **G-IX-02:** `.md` files will attempt AST parsing (designed for JS/TS) — likely fails silently and falls back to basic classification, but this is untested

**Severity:** Low

---

#### 8. intentSeeder.js (Intent Generation) — 511 lines
**Status:** COMPLETE
**What Works:**
- 45+ filename patterns including PRD patterns
- @@@ symbol detection (lines 187-195)
- Import/export pattern matching
- All generated intent flagged with `???` for INFERRED status

**Gaps:**
- **G-IS-01:** @@@ detection reads files synchronously (`fs.readFileSync`) — could crash if file deleted between lookup and read
- **G-IS-02:** `.md` file intent seeding relies on filename patterns only — no markdown-specific parsing (e.g., headings, front matter)

**Severity:** Low

---

#### 9. gapAnalyzer.js (6-Dimension Analysis) — 652 lines
**Status:** COMPLETE with missing planned dimensions
**What Works:**
- D1: Lifecycle phase distribution
- D2: Status health (RED/YELLOW/GREEN)
- D3: Intent authoring coverage
- D4: Export surface
- D5: Connection integrity
- D6: Architecture completeness

**Gaps:**
- **G-GA-01:** Planned dimensions D7, D8, D9 were NOT added (from `PLAN-INTEGRATION-POINTS.md` — gapAnalyzer.js lines 379-456 planned). D7 was @@@ symbol analysis, D8 was Bruno/Oscar health, D9 was template coverage.
- **G-GA-02:** D6 checks for `prdGenerator.js` presence but doesn't validate PRD project health

**Severity:** Medium — missing 3 planned analysis dimensions

---

#### 10. schemaCardEmitter.js (Schema Emission) — 210 lines
**Status:** COMPLETE with missing planned fields
**What Works:**
- Deterministic JSON output with sorted keys
- Schema card validation against canonical shape
- Diff mode and batch emission

**Gaps:**
- **G-SCE-01:** Planned new fields from Wave 5 (A21) not integrated — template state, @@@ count, Bruno status should be emitted into schema cards but aren't
- **G-SCE-02:** No fallback pattern for lib module load failure (unlike indexer.js which handles gracefully)

**Severity:** Medium — schema cards don't reflect full PRD system state

---

#### 11. notificationBus.js (Event System) — 127 lines
**Status:** COMPLETE
**What Works:**
- EventEmitter + SSE + console + printer channels
- Max SSE clients limit
- CORS-aware SSE (CR-01 fix)

**Gaps:**
- **G-NB-01:** Planned new status symbols not added — `BRUNO_CALL ⚠`, `ARCHIVE ⚰`, `AI_REVIEW_NEEDED @` (from `PLAN-INTEGRATION-POINTS.md`)

**Severity:** Low — cosmetic, notifications still work

---

#### 12. schemaCardPrinter.js — 295 lines
**Status:** COMPLETE — No gaps detected

---

#### 13. st8-types.js — 282 lines
**Status:** COMPLETE — No gaps detected

---

#### 14. manifestGenerator.js — 173 lines
**Status:** COMPLETE

**Gaps:**
- **G-MG-01:** Non-atomic writes — JSON and TOML written sequentially without transactional guarantee

**Severity:** Low

---

#### 15. fileWatcher.js — 140 lines
**Status:** COMPLETE — No gaps detected

---

#### 16. verify-persistence-fixes.js — 154 lines
**Status:** COMPLETE — Test script, not production code

---

### Frontend Files

#### 17. st8.html (Main UI) — 2,459 lines
**Status:** COMPLETE with PRD wizard
**What Works:**
- PRD Project Wizard (lines 1606-1628) with name, template, and variable fields
- Template loader with dynamic options
- Variable editor UI (lines 1845-1885)
- CREATE PROJECT button wired to `/api/prd-projects` POST
- Complete design system (void, text, gold, cyan, pink colors)
- Panel controller for explorer/phreak toggle

**Gaps:**
- **G-HTML-01:** Template loading uses bare `fetch()` without error recovery
- **G-HTML-02:** File list rendering uses inline click handlers with escaped strings — susceptible to XSS
- **G-HTML-03:** Generic popup builder without ARIA labels (accessibility gap)
- **G-HTML-04:** Intent display badges (`???`, `@@@`) in file list NOT present — planned in Wave 4 (A16) but not implemented
- **G-HTML-05:** Bruno & Oscar notification toasts NOT present — planned in Wave 4 (A15) but not implemented
- **G-HTML-06:** Mutation toast handlers for `BRUNO_CALL`, `ARCHIVE`, `AI_REVIEW_NEEDED` NOT present

**Severity:** G-HTML-04 through G-HTML-06 are Medium — planned UI features missing

---

#### 18. file-explorer.js (File Browser) — 749 lines
**Status:** COMPLETE with minor gaps
**What Works:**
- Virtual scrolling, breadcrumb navigation
- CREATE PRD button wired to `window.openPRDWizard()`
- INDEX and VERIFY buttons wired to backend

**Gaps:**
- **G-FE-01:** `_filterEntries()` is a pass-through stub — no actual filtering
- **G-FE-02:** No purpose column displayed — planned in Wave 4 but not implemented
- **G-FE-03:** No @@@ badge in file list — planned in Wave 4 (A16) but not implemented
- **G-FE-04:** INDEX and VERIFY buttons lack debouncing — rapid clicks trigger duplicate API calls
- **G-FE-05:** `/api/files` REST endpoint hardcoded but never verified to exist

**Severity:** G-FE-02 and G-FE-03 are Medium — planned features missing

---

#### 19. phreak-terminal.js (Terminal Emulator) — 1,087 lines
**Status:** COMPLETE with minor gaps
**What Works:**
- Streaming output, command history
- EPO WebSocket bus with REST fallback
- Media command routing
- Signal framework
- TUI overlay

**Gaps:**
- **G-PT-01:** New terminal commands NOT added — `bruno-call`, `oscar-house`, `ai-review`, `prd-create` were planned in Wave 4 but not implemented
- **G-PT-02:** Three different code paths for command execution with inconsistent error handling
- **G-PT-03:** Silent failure when EPO not connected — falls back to REST without user feedback
- **G-PT-04:** Signal pop-up auto-dismiss timer not cleaned up if overlay removed externally — memory leak
- **G-PT-05:** `_isolateFiles()` calls `window.VoidFileExplorer.getIndexedFingerprints()` without null check
- **G-PT-06:** Welcome message seeded with `false && ...` condition — unreachable dead code

**Severity:** G-PT-01 is Medium — planned commands missing

---

#### 20. graph-visualizer.js (D3 Graph) — 457 lines
**Status:** COMPLETE

**Gaps:**
- **G-GV-01:** CDN loader has no timeout — could hang indefinitely if d3js.org unreachable
- **G-GV-02:** Tooltip element created per link hover, not reused — DOM bloat

**Severity:** Low

---

#### 21. coordination.js (Manifest Sync) — 211 lines
**Status:** COMPLETE

**Gaps:**
- **G-CO-01:** Polling interval never cleared on errors — infinite retry loop
- **G-CO-02:** Memory allocation on every comparison (creates new arrays per poll)

**Severity:** Low

---

#### 22. settings-ui.js (Settings Panel) — 340 lines
**Status:** PARTIAL

**Gaps:**
- **G-SUI-01:** `editEntry()` is a TODO stub — no implementation
- **G-SUI-02:** `addEntry()` creates dummy entry with hardcoded `'new-entry'` id — no uniqueness
- **G-SUI-03:** `_persistSetting()` fires async fetch but never waits for response — race condition

**Severity:** G-SUI-01 is Medium — broken feature

---

#### 23. settings-reader.js — 114 lines
**Status:** COMPLETE — Minor: ES6 export incompatible with CommonJS

---

#### 24. fake-stream.js — 97 lines
**Status:** COMPLETE — Dev utility only, ES6 export incompatible with CommonJS

---

#### 25. start.js — 149 lines
**Status:** COMPLETE

**Gaps:**
- **G-ST-01:** Backend spawn never stores process reference — cannot programmatically kill on cleanup

**Severity:** Low

---

#### 26. void-engine.js — 339 lines
**Status:** COMPLETE — Pretext rendering engine, no PRD relation

---

#### 27. void-engine.html — 45 lines
**Status:** COMPLETE — No gaps

---

### Configuration / Data Files

#### 28. package.json (Root)

**Gaps:**
- **G-PKG-01:** `express` is imported in `backend/server.js` but NOT declared as a dependency — will fail on fresh install
- **G-PKG-02:** `open` package used in `start.js` but not declared (optional)

**Severity:** G-PKG-01 is **HIGH** — blocks fresh installs

---

#### 29. ai-signal.toml — 4 lines
**Status:** INCOMPLETE — Only placeholders for reachability, stability, fragility

**Severity:** Low — auto-generated by manifestGenerator

---

#### 30. connection-state.json — 1,330 lines
**Status:** COMPLETE but stale data

**Gaps:**
- **G-CS-01:** All 42 files have empty intent (`purpose`, `dependsOnBehavior`, `valueStatement` all blank)
- **G-CS-02:** 29 of 42 files are RED status with 0 reachability

**Severity:** Medium — intent system not fully seeded

---

## CROSS-CUTTING GAPS

### CC-01: Module System Mismatch
- **Backend:** CommonJS (`module.exports`)
- **fake-stream.js, settings-reader.js:** ES6 export (incompatible)
- **Most root files:** vanilla script (no export system)

**Impact:** `fake-stream.js` and `settings-reader.js` cannot be `require()`d by backend

---

### CC-02: API Client Fragmentation
- `st8.html` calls 4+ backend APIs directly
- `phreak-terminal.js` has 3 different exec paths (REST v1, REST, EPO WebSocket)
- `file-explorer.js` has its own REST + EPO fallback
- No centralized API client — each file implements its own error handling

**Impact:** Inconsistent error handling, hard to maintain

---

### CC-03: Wave 5 Integration NOT Done
The full end-to-end integration (planned Wave 5, agents A19-A22) was NOT completed:
- **A19:** Bruno & Oscar not integrated with session startup (`index.js`)
- **A20:** @@@ symbol not integrated with gap analysis (`gapAnalyzer.js` missing D7-D9)
- **A21:** Template engine not integrated with schema cards (`schemaCardEmitter.js`)
- **A22:** No end-to-end testing performed

**Impact:** Individual components work in isolation but are not wired together as a system

---

### CC-04: No Test Suite
- Only `verify-persistence-fixes.js` exists (tests 3 specific fixes)
- No unit tests for any backend module
- No integration tests
- No frontend tests

**Impact:** No regression safety net

---

### CC-05: Missing express Dependency
- `express` is used in `server.js` but not declared in either `package.json`
- Backend `package.json` lists `better-sqlite3`, `chokidar`, and babel packages
- Root `package.json` lists the same

**Impact:** Fresh `npm install` will fail to start the server

---

## GAP SEVERITY SUMMARY

### HIGH (Blocks functionality)

| ID | Description | File | Fix Effort |
|---|---|---|---|
| G-PKG-01 | express not in package.json | package.json | 1 min |

### MEDIUM (Missing planned features / Integration gaps)

| ID | Description | File | Fix Effort |
|---|---|---|---|
| G-GA-01 | Missing gap analysis dimensions D7-D9 | gapAnalyzer.js | 2-4 hours |
| G-SCE-01 | Schema cards missing PRD system fields | schemaCardEmitter.js | 1-2 hours |
| G-BO-02 | Bruno/Oscar not wired to startup | index.js | 30 min |
| G-PER-02 | Verify all 11 planned columns exist | persistence.js | 1-2 hours |
| G-PER-03 | Missing incrementSessionCounters() | persistence.js | 1 hour |
| G-PER-04 | Missing markFileAccessed() | persistence.js | 30 min |
| G-HTML-04 | Intent badges (???, @@@) not in file list | st8.html | 1-2 hours |
| G-HTML-05 | Bruno/Oscar notification toasts missing | st8.html | 1-2 hours |
| G-FE-02 | Purpose column not in file list | file-explorer.js | 1-2 hours |
| G-FE-03 | @@@ badge not in file list | file-explorer.js | 1 hour |
| G-PT-01 | New terminal commands not added | phreak-terminal.js | 2-3 hours |
| G-NB-01 | Missing notification status symbols | notificationBus.js | 30 min |
| G-SUI-01 | editEntry() is TODO stub | settings-ui.js | 1-2 hours |
| G-SRV-01 | Race condition on manifest writes | server.js | 2-3 hours |
| G-CS-01 | All intents empty in manifest | connection-state.json | 1 hour (re-run seeder) |
| CC-03 | Wave 5 integration not done | Multiple | 4-8 hours |

### LOW (Quality / Polish)

| ID | Description | File | Fix Effort |
|---|---|---|---|
| G-IDX-01 | Promise cleanup inconsistency | index.js | 1 hour |
| G-SRV-02 | Inconsistent resource cleanup | server.js | 2 hours |
| G-SRV-03 | No rate limiting | server.js | 2 hours |
| G-SRV-04 | No input validation on intent text | server.js | 1 hour |
| G-IX-01 | Lib module lazy load no fallback | indexer.js | 30 min |
| G-MG-01 | Non-atomic manifest writes | manifestGenerator.js | 1 hour |
| G-GV-01 | CDN loader no timeout | graph-visualizer.js | 30 min |
| G-CO-01 | Polling infinite retry loop | coordination.js | 30 min |
| G-HTML-01 | Template fetch no error recovery | st8.html | 30 min |
| G-HTML-02 | XSS risk in inline handlers | st8.html | 1-2 hours |
| G-HTML-03 | No ARIA labels on popups | st8.html | 1 hour |
| G-FE-01 | _filterEntries stub | file-explorer.js | 30 min |
| G-FE-04 | No debouncing on INDEX/VERIFY | file-explorer.js | 30 min |
| G-PT-02 | Inconsistent exec error handling | phreak-terminal.js | 1 hour |
| G-PT-04 | Signal timer memory leak | phreak-terminal.js | 30 min |
| G-PT-06 | Dead welcome message code | phreak-terminal.js | 5 min |
| G-ST-01 | Unkillable backend process | start.js | 30 min |
| CC-01 | Module system mismatch | Multiple | 2 hours |
| CC-02 | API client fragmentation | Multiple | 4-8 hours |
| CC-04 | No test suite | N/A | 8-16 hours |

---

## OVERALL ASSESSMENT

### Implementation Completion: ~80%

| Layer | Completion | Notes |
|---|---|---|
| **Backend** | ~90% | All files exist, all APIs work, core PRD pipeline functional |
| **Frontend** | ~75% | PRD wizard works, but badges/notifications/commands missing |
| **Integration** | ~40% | Components work individually but Wave 5 wiring not done |
| **Testing** | ~5% | Only 1 test file exists |
| **Planning docs accuracy** | 0% | Completely stale, claim nothing is implemented |

### Recommended Priority Order

1. **Immediate:** Add `express` to `package.json` (blocks everything)
2. **Day 1:** Run intent seeder to populate empty intents, wire Bruno/Oscar to startup
3. **Day 2:** Add missing gap analysis dimensions (D7-D9), update schema card emission
4. **Day 3:** Add UI badges/notifications (@@@ badges, intent display, Bruno toasts)
5. **Day 4:** Add terminal commands (`bruno-call`, `oscar-house`, `ai-review`, `prd-create`)
6. **Day 5:** End-to-end integration testing
7. **Ongoing:** Build test suite, standardize error handling, centralize API client

### Estimated Remaining Effort

| Category | Hours |
|---|---|
| HIGH fixes | < 1 hour |
| MEDIUM fixes | 15-25 hours |
| LOW fixes | 20-35 hours |
| **Total to 100%** | **~35-60 hours** |

### Final Notes

- The planning documentation (52+ files, 384KB) is valuable as architectural reference but **MUST NOT** be treated as current status — the codebase has progressed far beyond what the plans indicate.
- The "meltdown" likely occurred because the agent executing the plan couldn't reconcile the planned state with the actual state, or because multiple agents attempted to modify already-implemented code.
- **Update `wave-manifest.md` to reflect actual implementation status before any further agent deployment.**
- All gap IDs in this document (G-xxx-nn format) are stable references — use them in commit messages, task trackers, and agent instructions.
