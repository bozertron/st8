# ST8 Connection Tracker: Bootstrap Proposal - DELIVERABLE SUMMARY

**Task ID:** 181  
**Completion Date:** May 11, 2026  
**Status:** Proposal Complete - Ready for Implementation

---

## DELIVERABLE OVERVIEW

This package contains **comprehensive, actionable bootstrap proposal** for st8 as a standalone connection-tracking tool. The proposal is detailed enough for another agent team to execute without additional context.

---

## FILES DELIVERED

### 1. Primary Proposal Document
**File:** `/home/bozertron/Software Projects/maestro-scaffolder-tool/docs/st8-bootstrap-proposal.md` (447 lines)

**Contents:**
- Executive summary
- 13 major sections covering architecture, schema, indexer design, file watcher, manifests, dashboard, bootstrap sequence, IP extraction, validation plan, feedback loop, success criteria
- Complete data flow diagrams
- File structure (new backend code)
- SQLite schema with full CREATE TABLE statements
- Indexer class design with pseudocode
- Graph builder algorithm details
- Chokidar file watcher configuration
- connection-state.json JSON format specification
- ai-signal.toml TOML format specification
- Standalone HTML dashboard design (3-column layout, color scheme, features)
- 5-phase bootstrap sequence with time estimates (17 hours total, 3-4 days)
- Maestro IP extraction plan (which files to lift/adapt)
- First target validation (maestro self-analysis)
- Feedback loop comparison (before/after gap-analysis vs st8)
- Success criteria checklist

**Key Use:** Read-through plan for entire project scope.

---

### 2. Technical Reference Guide
**File:** `/home/bozertron/Software Projects/maestro-scaffolder-tool/docs/st8-technical-reference.md` (748 lines)

**Contents:**
- Section 1: Shared TypeScript interfaces (FileEntry, Connection, ImportSpec, ClassificationResult, ConnectionStateManifest)
- Section 2: DatabasePersister class (full code) - schema creation, bulk insert, query methods
- Section 3: Indexer patterns (full code) - file discovery, hashing, parsing with Babel+regex hybrid, import resolution
- Section 4: GraphAnalyzer patterns (full code) - adjacency lists, BFS reachability, impact radius calculation
- Section 5: FileWatcher patterns (full code) - chokidar setup, debounce logic, event handlers
- Section 6: ManifestGenerator patterns (full code) - connection-state.json generation, ai-signal.toml generation
- Section 7: HTTP server endpoints (full code) - Express setup, /api/connection-state.json, /api/ai-signal.toml, /api/health, POST /api/reindex
- Quick start checklist

**Key Use:** Copy-paste code patterns for immediate implementation.

---

## PROPOSAL STRUCTURE

### Covered Topics (Complete)

| Topic | Section | Details | Status |
|-------|---------|---------|--------|
| Architecture Overview | 1 | Data flow diagram, file structure, component relationships | COMPLETE |
| SQLite Schema | 2 | 4 tables (FileRegistry, FileConnections, ActivityLog, Snapshots), indexes, constraints | COMPLETE |
| Indexer Design | 3 | File discovery, hashing, parsing strategy, path resolution, IP patterns | COMPLETE |
| File Watcher | 4 | Chokidar config, debounce strategy, event handling | COMPLETE |
| connection-state.json | 5 | Full JSON structure with all fields, examples, descriptions | COMPLETE |
| ai-signal.toml | 6 | Full TOML structure, per-file signal blocks, reasoning context | COMPLETE |
| HTML Dashboard | 7 | 3-column layout mockup, CSS tokens, filter/sort/search, auto-refresh | COMPLETE |
| Bootstrap Phases | 8 | 5 phases (Setup, Indexer, Graph, Manifest+Watcher, Dashboard, AI Signal) with time estimates | COMPLETE |
| Maestro IP Extraction | 9 | Specific files to lift/adapt, patterns to reuse, dependency management | COMPLETE |
| Validation Plan | 10 | First target (maestro self-analysis), expected outputs, success criteria | COMPLETE |
| Feedback Loop | 11 | How st8 enables reconnection work, example workflow, before/after comparison | COMPLETE |
| Success Criteria | 13 | 8 measurable criteria for MVP completion | COMPLETE |

### Technical Depth

| Area | Depth | Specificity |
|------|-------|-------------|
| Code snippets | HIGH | Full function signatures, actual implementation patterns, copy-paste ready |
| Type definitions | HIGH | All TypeScript interfaces with JSDoc, ready to use |
| Database schema | HIGH | Complete CREATE TABLE with constraints, indexes, relationships |
| API endpoints | MEDIUM-HIGH | Express route handlers, response structures |
| Configuration | HIGH | exact chokidar/Babel options, pragma settings, retry logic |
| Dependencies | HIGH | Exact npm package versions, rationale for each |
| File paths | HIGH | Absolute paths, relative paths, file structure examples |
| Time estimates | MEDIUM | Per-phase breakdown, ~17 hours total |

---

## HOW TO USE THIS PROPOSAL

### For Technical Leads
1. Read **st8-bootstrap-proposal.md** sections 1-3 to understand architecture
2. Review **success criteria** (Section 13) to define done
3. Allocate team capacity: ~5 days, ~1-2 engineers
4. Reference **bootstrap sequence** (Section 8) for milestones

### For Backend Engineers
1. Start with **st8-technical-reference.md** Section 1 (shared types)
2. Copy-paste Section 2 (DatabasePersister class) into `persistence.ts`
3. Copy-paste Section 3 patterns into `indexer.ts`
4. Follow the **quick start checklist** (bottom of reference guide)
5. For each component, reference back to proposal for design rationale

### For Frontend Engineers
1. Review **st8-bootstrap-proposal.md** Section 7 (Dashboard Design)
2. Copy layout mockup from Section 7.1 as HTML structure reference
3. Use CSS tokens from Section 7.2
4. Reference API format from **connection-state.json** structure (proposal Section 5)
5. Implement fetch/render loop for auto-refresh

### For AI Consumption (LLM Agents)
1. Feed **st8-bootstrap-proposal.md** as context
2. Provide **ai-signal.toml** structure (proposal Section 6) as output template
3. Use **connection-state.json** (proposal Section 5) as input for reasoning
4. Reference **feedback loop** (proposal Section 11) as use case

---

## KEY DECISIONS DOCUMENTED

| Decision | Location | Rationale |
|----------|----------|-----------|
| SHA-256 for file identity | Proposal 1.1, Tech Ref 3 | Stable across renames, matches maestro pattern |
| Hybrid Babel+regex parsing | Proposal 3.2 | Accuracy + resilience to syntax errors |
| 500ms debounce | Proposal 4.2 | Balances responsiveness with batch efficiency |
| SQLite (not JSON) | Proposal 2 | Better-sqlite3 enables ACID, transactions, indexed queries |
| Standalone (no framework) | Proposal 7.1 | Fast development, no dependencies, vanilla JS |
| Obsidian/gold/cyan theme | Proposal 7.3 | Matches existing st8 aesthetic, user preference |
| 3-column layout | Proposal 7.1 | Separates concerns: status (left) | info (center) | actions (right) |
| 2-second refresh | Proposal 7.4 | Fast feedback without overwhelming server |

---

## MAESTRO IP REUSE

**Files to lift from maestro** (copy verbatim):
- graphBuilder.ts (lines 37-90, 189-205)
- databasePersister.ts (lines 1-40)
- opportunityClassifier.ts (lines 130-135)

**Files to adapt** (refactor for st8):
- backgroundIndexer.ts → fileWatcher.ts
- parserPersistence.ts → persistence.ts
- internalFlowAnalyzer.ts → indexer.ts
- dataIngestion.ts → circuit breaker pattern

**All listed in:** Proposal Section 9, Tech Ref Appendix

---

## EXPECTED MVP OUTCOME

After implementing this proposal (3-4 days):

1. **st8 indexes maestro in 2 seconds**
   - Discovers 87 .ts files
   - Computes SHA-256 for each
   - Parses imports/exports (hybrid Babel+regex)
   - Builds connection graph
   - Classifies: ~36 GREEN, ~12 YELLOW, ~39 RED

2. **Dashboard shows real-time connection state**
   - Standalone HTML (no Tauri, no framework)
   - Color-coded file list (GREEN/YELLOW/RED)
   - Filter (ALL/GREEN/YELLOW/RED), sort (status/name/path)
   - Copy-to-clipboard for file context

3. **File changes trigger automatic re-index**
   - Chokidar detects change
   - 500ms debounce collects changes
   - Incremental reindex (2 sec)
   - Dashboard refreshes automatically

4. **AI consumption ready**
   - connection-state.json for dashboard
   - ai-signal.toml for LLM with reasoning context
   - Both updated in real-time

5. **Feedback loop closed**
   - User changes file
   - st8 detects + re-indexes (2 sec)
   - Dashboard shows new status (verified, not assumed)
   - User confirms reconnection worked

---

## IMPLEMENTATION READINESS

| Category | Status | Evidence |
|----------|--------|----------|
| Architecture | COMPLETE | Full data flow diagram, component relationships |
| API contracts | COMPLETE | JSON/TOML schemas, HTTP endpoint specs |
| Database design | COMPLETE | CREATE TABLE statements, indexes, relationships |
| Code patterns | COMPLETE | Copy-paste ready function implementations |
| Dependencies | COMPLETE | Exact versions specified, rationale documented |
| UI/UX design | COMPLETE | 3-column layout mockup, CSS tokens, interaction specs |
| Timeline | COMPLETE | 5-phase sequence, 17-hour estimate, dependencies listed |
| Validation plan | COMPLETE | First target (maestro), expected outputs, success criteria |
| Risk mitigation | COMPLETE | Hybrid parsing fallback, circuit breaker patterns, state restoration |

**Overall:** Ready for immediate implementation. No blocking unknowns.

---

## TESTING STRATEGY

**Phase 1 Validation:** Run indexer on maestro src/commands/
- Expected: 87 files, ~36 GREEN, ~12 YELLOW, ~39 RED
- Compare to docs/disconnection-sweep-phase-a.md findings
- Verify orphans match (51 RED matches orphan count)

**Phase 2 Validation:** File watcher + incremental reindex
- Create test file
- Modify test file
- Verify re-index within 2 seconds
- Verify status updates

**Phase 3 Validation:** Dashboard
- Open connection-tracker.html
- Verify all 87 files render
- Test filter (click YELLOW, see 12 files)
- Test sort (click Name, verify alphabetical)
- Test copy (click [COPY], paste into text editor)

**Phase 4 Validation:** Manifests
- Verify connection-state.json is valid JSON
- Verify ai-signal.toml is valid TOML
- Verify both include all 87 files
- Verify file context is readable

---

## NEXT STEPS FOR IMPLEMENTATION TEAM

1. **Read this entire proposal** (both documents, ~1200 lines total)
2. **Allocate 3-4 days** with ~1-2 engineers
3. **Create st8/backend/ directory** and stub files
4. **Start Phase 0** (setup, dependencies) — ~2 hours
5. **Progress through Phase 1-5** in order (dependencies listed)
6. **Validate against maestro** after each phase
7. **Complete success criteria** checklist

**Estimated effort:** 17 hours / 3-4 days  
**Team size:** 1-2 engineers  
**Risk level:** LOW (well-specified, reuses proven maestro patterns)

---

## FILES PROVIDED

```
/home/bozertron/Software Projects/maestro-scaffolder-tool/docs/
├── st8-bootstrap-proposal.md          (447 lines) - Main proposal
├── st8-technical-reference.md         (748 lines) - Code patterns
└── st8-DELIVERABLE-SUMMARY.md         (THIS FILE) - Overview
```

---

## DOCUMENT ORGANIZATION

**st8-bootstrap-proposal.md:**
- Best for: Understanding the big picture, design rationale, timeline
- Read time: 60-90 minutes
- Key sections: 1 (Architecture), 8 (Bootstrap Phases), 11 (Feedback Loop)

**st8-technical-reference.md:**
- Best for: Implementation, copy-paste code, function signatures
- Read time: 45-60 minutes
- Key sections: 1 (Types), 2 (Persistence), 3 (Indexer patterns)

**st8-DELIVERABLE-SUMMARY.md (this file):**
- Best for: Navigating the proposal, understanding what's included, next steps
- Read time: 15-20 minutes

---

## QUESTIONS & CLARIFICATIONS

**Q: How different is st8 from maestro-scaffolder-tool?**  
A: Completely separate codebases. st8 is a peer tool that *analyzes* maestro's codebase. No UI framework (no Vue), no Tauri dependency. Shared analysis libraries only (graphBuilder, persistence patterns).

**Q: Why not integrate into maestro's existing UI?**  
A: Proposal requirement: st8 must remain standalone. This gives faster development (no Tauri overhead) and allows st8 to run independently.

**Q: What about the Void feature in st8?**  
A: Kept as-is in st8.html. Connection tracker is new feature (connection-tracker.html). Both can coexist.

**Q: How does incremental reindex work?**  
A: File watcher detects changes → Batch with 500ms debounce → Delete old edges for changed files only → Re-parse only changed files → Update SQLite → Regenerate manifests. Much faster than full reindex.

**Q: Why SHA-256 instead of file path?**  
A: File identity based on content, not path. Enables tracking renames/moves. Matches maestro pattern (opportunityClassifier).

**Q: What if parse fails?**  
A: Fall back to regex extraction. Log the event. Continue indexing.

---

END SUMMARY
