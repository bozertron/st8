# ST8 Backend Architecture — Research Synthesis

**Project:** ST8 — Full Stack Logic Analyzer
**Domain:** Codebase intelligence / file lifecycle management
**Researched:** 2026-05-14
**Confidence:** HIGH (based on direct source code analysis of all 16 backend modules)

## Executive Summary

ST8 is a **codebase intelligence system** that indexes, classifies, and tracks the lifecycle of every file in a software project. It operates as a CLI tool with three modes (one-shot indexing, file watching, HTTP server) and produces a layered output: SQLite database → schema cards → gap analysis reports → PRD documents. The architecture follows a **sequential pipeline pattern** where each stage enriches the output of the previous one, creating a self-describing model of the codebase.

The backend is a **Node.js monolith** with 16 modules organized around a central SQLite persistence layer. The core loop is: **Index → Persist → Emit Schema Cards → Analyze Gaps → Seed Intent**. A file watcher provides incremental updates, and an HTTP server exposes the full pipeline via REST API + SSE. The system uses a **fingerprint-based identity model** (filepath + birth timestamp) that remains stable across file renames, and tracks every mutation in an append-only log.

Key architectural decisions include: (1) a 7-table SQLite schema with Bruno & Oscar lifecycle management for automatic stale file detection, (2) a 6-dimension gap analysis engine that evaluates lifecycle progression, status health, intent authoring, export surface, connection integrity, and architectural completeness, and (3) a dual-output schema card system (JSON for machines, TXT for humans). The main risk is **tight coupling between modules** — the indexer, persistence, and schema card emitter share implicit state through the in-memory `result.files` array, and the file watcher's incremental logic duplicates significant code from the initial indexing pipeline.

## Key Findings

### Recommended Stack

**Runtime & Dependencies:**
- **Node.js** (CommonJS modules) — all backend code uses `require()` / `module.exports`
- **better-sqlite3** — synchronous SQLite bindings for the persistence layer (with WAL mode enabled)
- **chokidar** — file system watching with debounced change batching (500ms)
- **Native `http` module** — no Express; raw HTTP server with manual routing
- **Native `crypto`** — SHA-256 hashing for content versioning

**No external frameworks** — the server, routing, CORS, SSE, and static file serving are all hand-rolled. This is intentional (minimizes dependencies) but increases maintenance burden.

### Module Architecture

**16 backend modules, 5 functional layers:**

#### Layer 1: Entry Point & Orchestration
| Module | Responsibility |
|--------|---------------|
| `index.js` | CLI argument parsing, sequential pipeline orchestration, file watcher callback wiring |
| `server.js` | HTTP server with 20+ API routes, static file serving, SSE endpoint |

#### Layer 2: Indexing & Parsing
| Module | Responsibility |
|--------|---------------|
| `indexer.js` | Recursive file discovery, SHA-256 hashing, AST-based import/export extraction, graph building, status classification (GREEN/YELLOW/RED) |
| `st8-types.js` | Canonical type definitions (St8FileEntry, St8SchemaCard, St8MutationRecord), enums (LifecyclePhase, FileStatus, MutationType, ActorType), fingerprint generation/validation |

#### Layer 3: Persistence & Storage
| Module | Responsibility |
|--------|---------------|
| `persistence.js` | SQLite database layer with 8 tables, CRUD operations, Bruno/Oscar lifecycle methods, @@@ symbol detection, template variable management |

#### Layer 4: Output & Emission
| Module | Responsibility |
|--------|---------------|
| `schemaCardEmitter.js` | Generates deterministic JSON schema cards (.st8/schema-cards/*.json), validates against canonical shape, diff mode for drift detection |
| `schemaCardPrinter.js` | Human-readable TXT fallback (.planning/st8_identity_system/*.txt), LATEST_* files + timestamped audit trail |
| `manifestGenerator.js` | Generates connection-state.json and ai-signal.toml manifests |

#### Layer 5: Analysis & Intelligence
| Module | Responsibility |
|--------|---------------|
| `gapAnalyzer.js` | 6-dimension gap analysis (D1-D6), Markdown report generation |
| `intentSeeder.js` | Auto-generates intent (purpose, dependsOnBehavior, valueStatement) from filename patterns, imports, exports, and @@@ markers |
| `brunoOscar.js` | Automatic file lifecycle management — Bruno scans for stale files, Oscar archives flagged files with grace periods |
| `notificationBus.js` | EventEmitter-based notification system with SSE broadcast, console output, and printer fallback |

#### Layer 6: Supporting Modules
| Module | Responsibility |
|--------|---------------|
| `fileWatcher.js` | Chokidar integration with debounced change batching, event filtering |
| `templateEngine.js` | Template variable management |
| `prdGenerator.js` | PRD document generation from schema cards |
| `verify-persistence-fixes.js` | Verification script for persistence fixes |

### Database Schema

**8 tables in SQLite (WAL mode):**

```sql
-- Core file registry (22 columns)
file_registry (
  fingerprint TEXT PRIMARY KEY,      -- Stable identity: filepath||birthTimestamp
  filepath, filename, sha256Hash, fileSizeBytes,
  status DEFAULT 'RED',              -- GREEN/YELLOW/RED/CONCEPT/LOCKED/PRODUCTION
  reachabilityScore REAL DEFAULT 0.0,
  impactRadius INTEGER DEFAULT 0,
  lifecyclePhase DEFAULT 'DEVELOPMENT',  -- CONCEPT/LOCKED/WIRING/DEVELOPMENT/PRODUCTION
  birthTimestamp, lastModified, lastIndexed, isEntryPoint,
  -- Bruno & Oscar fields:
  lastAccessed, sessionsSinceAccess, expiryDate, associatedWith, eventTrigger,
  brunoStatus DEFAULT 'active',      -- active/flagged/archived
  -- AI review fields:
  needsAIReview, tripleAtCount, aiContentInjected,
  -- Template fields:
  templateVariables, hasUnfilledVariables
)

-- Dependency graph edges
connections (
  id, sourceFingerprint, targetFingerprint,
  connectionType DEFAULT 'IMPORT',
  importSpecifier, isResolved, confidenceScore, lastVerified
)

-- File intent (purpose/behavior/value)
file_intent (
  fingerprint PRIMARY KEY,
  purpose, dependsOnBehavior, valueStatement,
  authoredBy DEFAULT 'INFERRED',    -- INFERRED/USER
  lastUpdated
)

-- Append-only mutation log
file_mutation_log (
  id, fingerprint, sha256Hash,
  mutationType,                     -- CONCEPT/CREATE/EDIT/RENAME/REFACTOR/DELETE/LOCK/PRODUCTION/PURGE
  changedFields, actor, timestamp, metadata
)

-- System activity log
activity_log (id, timestamp, source, action, targetFingerprint, details)

-- Key-value settings
st8_settings (category, key, value, updatedAt)  -- PK: (category, key)

-- PRD project registry
prd_projects (id, name, path, template, variables, created, updated)

-- AI content cache
ai_content (id, filepath, content, reviewed, timestamp)
```

**Key indexes:** status, sha256Hash, lifecyclePhase, connection source/target, mutation log fingerprint/timestamp, activity log timestamp, brunoStatus, needsAIReview, hasUnfilledVariables.

### Signal Flow

```
                    ┌─────────────────────────────────────────────┐
                    │              CLI / API Trigger               │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         1. FILE DISCOVERY (indexer)          │
                    │    recursive readdirSync → CODE_EXTENSIONS   │
                    │    ignore: node_modules, .git, dist, etc.    │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         2. HASHING & PARSING (indexer)       │
                    │    SHA-256 content hash                      │
                    │    AST-based import/export extraction        │
                    │    Fingerprint generation (filepath||birth)  │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         3. GRAPH BUILDING (indexer)          │
                    │    graphBuilder.buildDependencyGraph()       │
                    │    → health classification (GREEN/YELLOW/RED)│
                    │    → reachabilityScore, impactRadius         │
                    │    Fallback: classifyBasic() via import sets │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         4. PERSISTENCE (persistence.js)      │
                    │    Pass 1: Upsert all files (FK exists)      │
                    │    Pass 2: Wire connections                  │
                    │    Log CREATE mutations + activity           │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         5. MANIFEST GENERATION               │
                    │    connection-state.json (JSON)              │
                    │    ai-signal.toml (TOML)                     │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         6. SCHEMA CARD EMISSION              │
                    │    .st8/schema-cards/*.json (machine)        │
                    │    .planning/st8_identity_system/*.txt (human)│
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         7. GAP ANALYSIS (gapAnalyzer.js)     │
                    │    D1: Lifecycle Progression                 │
                    │    D2: Status Health                         │
                    │    D3: Intent Authoring                      │
                    │    D4: Export Surface                        │
                    │    D5: Connection Integrity                  │
                    │    D6: Architectural Completeness            │
                    │    → .st8/gap-analysis.md                    │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         8. INTENT SEEDING (intentSeeder.js)  │
                    │    Filename pattern matching (93 rules)      │
                    │    Import behavior mapping (12 rules)        │
                    │    Export value mapping (8 rules)            │
                    │    @@@ marker detection → flagForAIReview()  │
                    │    All fields suffixed with ???: INFERRED    │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │         9. FILE WATCHER (incremental)        │
                    │    Chokidar → 500ms debounce → batch flush   │
                    │    add: hash+upsert+emit card+notify         │
                    │    change: rehash+upsert+emit card+notify    │
                    │    unlink: delete from DB+disk+notify        │
                    │    Re-run: manifest + intent seeding + gap   │
                    └─────────────────────────────────────────────┘
```

### Key Features

#### Bruno & Oscar Lifecycle Management
- **Bruno** scans for stale files (unaccessed for N sessions, default 5), flags them
- **Oscar** archives flagged files with a grace period (default 7 days), sets expiry dates
- **Event triggers** can un-archive files when specific events occur
- **Session counter** increments on each session start; resets when file is accessed
- **Append-to-parent** — Oscar can merge archived file content into a parent file with `@@@` markers

#### @@@ Symbol System
- Files containing `@@@` or `<!-- @@@ -->` or `@@@AI_REVIEW` are flagged for AI review
- `tripleAtCount` tracks the number of markers per file
- `needsAIReview` boolean flag for batch processing
- `ai_content` table stores generated content awaiting review

#### Template Variable System
- `templateVariables` column stores JSON of template variables per file
- `hasUnfilledVariables` boolean tracks completion status
- Used by PRD generator and template engine

#### Production Promotion
- `purgeDevelopmentData()` removes all non-PRODUCTION/PURGE mutations
- Logs a PURGE mutation with count of purged records
- Transitions lifecyclePhase to PRODUCTION
- Lightweight tracking thereafter

#### Dual Schema Card Output
- **JSON** (`.st8/schema-cards/*.json`) — deterministic, sorted keys, git-diffable
- **TXT** (`.planning/st8_identity_system/*.txt`) — human-readable with box-drawing characters
  - `LATEST_*.txt` — overwritten each run (current snapshot)
  - `{timestamp}_*.txt` — immutable audit trail (pruned to 10 per file)

### Critical Pitfalls

1. **Fingerprint separator migration** — Old fingerprints used `:` as separator, which conflicts with ISO 8601 timestamps (e.g., `T10:30:45.123Z`). New format uses `||`. `parseFingerprint()` handles both, but legacy ISO timestamps are corrupted and must be regenerated. **Prevention:** Run fingerprint migration before any data-dependent operations.

2. **In-memory state coupling** — The file watcher's `onFileChange` callback modifies `result.files` (the initial indexing result array) in-place. This means the in-memory state and database can diverge if a DB write fails after the array is modified. **Prevention:** Consider transactional updates or a state reconciliation step.

3. **Duplicated incremental logic** — The file watcher's add/change/delete handlers contain ~150 lines of logic that partially duplicates the initial indexing pipeline (hashing, upserting, mutation logging, schema card emission). **Prevention:** Extract shared functions for hash+upsert+emit+notify.

4. **No connection graph rebuild on incremental** — When a file changes, the watcher updates its hash and emits a new schema card, but does NOT rebuild the dependency graph or re-classify status. Only intent seeding and gap analysis are re-run. **Prevention:** Add incremental graph edge updates to the watcher.

5. **SSE CORS restriction** — The SSE endpoint restricts CORS to `http://localhost:{port}`. This prevents cross-origin attacks but also prevents legitimate cross-origin consumers. **Prevention:** Make the allowed origin configurable via settings.

6. **Body size limits** — All POST endpoints enforce a 1KB body limit (hardcoded). This prevents DoS but may be too restrictive for some operations (e.g., PRD project creation with variables). **Prevention:** Make limits configurable per endpoint.

7. **No connection cleanup on file delete** — `deleteFile()` calls `deleteConnectionsForFile()` which removes connections where the file is source OR target. However, the in-memory `result.files` array is spliced before the DB delete, meaning a crash between splice and DB delete leaves orphaned DB records. **Prevention:** Delete from DB first, then splice from memory.

## Implications for Roadmap

Based on the architecture analysis, the ST8 backend is a **mature but tightly-coupled system** that would benefit from refactoring before feature additions. The suggested phase structure prioritizes stabilization before extension.

### Phase 1: Stabilize Core Pipeline
**Rationale:** The in-memory state coupling and duplicated incremental logic are the highest-risk areas. Stabilizing the core loop prevents cascading bugs in all subsequent phases.
**Delivers:** Transactional state management, shared hash+upsert functions, incremental graph rebuild
**Addresses:** Pitfalls #2, #3, #4, #7
**Avoids:** Building new features on an unstable foundation

### Phase 2: Harden API Surface
**Rationale:** The server has 20+ endpoints with repeated boilerplate (body parsing, error handling, persistence lifecycle). Standardizing this reduces bugs and enables faster feature development.
**Delivers:** Request validation middleware, configurable body limits, standardized error responses, OpenAPI spec
**Addresses:** Pitfalls #5, #6
**Avoids:** Security regressions from hand-rolled HTTP handling

### Phase 3: Enhance Bruno & Oscar
**Rationale:** The lifecycle management system is functional but has hard-coded thresholds and no user-facing configuration. Enhancing it enables automated codebase hygiene.
**Delivers:** Configurable thresholds via st8_settings, event trigger UI integration, Oscar archive visualization
**Addresses:** Bruno & Oscar lifecycle management gaps
**Avoids:** Stale file accumulation in large codebases

### Phase 4: Intelligence Layer
**Rationale:** The gap analyzer and intent seeder provide valuable insights but operate on heuristics. Adding configurable rules and ML-assisted intent generation would significantly increase value.
**Delivers:** Configurable gap analysis rules, improved intent seeding accuracy, @@@ review workflow
**Addresses:** D3 Intent Authoring gaps, AI content review pipeline
**Avoids:** Low intent coverage in large codebases

### Phase 5: Multi-Project & Team Features
**Rationale:** The prd_projects table exists but is underutilized. Multi-project support and team collaboration features would expand ST8's reach.
**Delivers:** Multi-project dashboard, shared settings, team activity feeds
**Addresses:** prd_projects table utilization, activity_log team features
**Avoids:** Single-user limitation

### Phase Ordering Rationale

- **Stabilize first** — The core pipeline has known bugs (in-memory coupling, missing graph rebuild) that would compound with new features
- **API hardening before features** — New features will add endpoints; standardizing the pattern first prevents technical debt accumulation
- **Bruno & Oscar before Intelligence** — The lifecycle system feeds data to the gap analyzer; improving data quality improves analysis quality
- **Intelligence before Multi-Project** — Single-project intelligence must work well before scaling to multi-project

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Incremental graph rebuild strategies — need to research incremental topological sort algorithms
- **Phase 4:** ML-assisted intent generation — need to evaluate local LLM options vs. API-based approaches

Phases with standard patterns (skip research-phase):
- **Phase 2:** HTTP middleware patterns — well-documented Express-like patterns, no research needed
- **Phase 3:** Configuration management — standard CRUD patterns, no research needed
- **Phase 5:** Multi-tenant patterns — well-documented, no research needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Module Architecture | HIGH | Direct source analysis of all 16 modules |
| Database Schema | HIGH | Schema DDL extracted from persistence.js and indexer.js |
| Signal Flow | HIGH | Traced through index.js main() and file watcher callbacks |
| Bruno & Oscar | HIGH | Full implementation analyzed in brunoOscar.js |
| Gap Analysis | HIGH | 6-dimension engine fully documented in gapAnalyzer.js |
| Intent Seeding | HIGH | 93 filename rules, 12 import rules, 8 export rules catalogued |
| Security Posture | MEDIUM | CORS, body limits, path traversal protections observed; no penetration testing |
| Performance | LOW | No benchmarks; SQLite WAL mode suggests awareness but no profiling data |
| Error Recovery | MEDIUM | try/catch blocks present but no systematic error recovery strategy |

**Overall confidence:** HIGH for architecture understanding, MEDIUM for operational concerns (performance, security, error recovery).

### Gaps to Address

- **Performance profiling:** No data on indexing time for large codebases (>10K files). Need benchmarks before Phase 1 optimization work.
- **Migration strategy:** Fingerprint separator change (`:` → `||`) requires data migration. No migration scripts found — need to create before any data-dependent work.
- **Test coverage:** No test files observed in the backend directory. Need to establish testing patterns before refactoring.
- **Error recovery:** The `unhandledRejection` handler logs and continues, but `uncaughtException` calls `process.exit(1)`. Need a consistent strategy.
- **Configuration management:** Many values are hardcoded (port 3847, debounce 500ms, body limit 1KB, stale threshold 5 sessions, grace period 7 days). Need to centralize in st8_settings.

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of all 16 backend modules
- SQLite schema DDL from persistence.js and indexer.js
- Signal flow traced through index.js main() function

### Secondary (MEDIUM confidence)
- Existing planning documents in .planning/ directory
- Code comments and JSDoc documentation within modules

### Tertiary (LOW confidence)
- Performance characteristics (no benchmarks available)
- Security posture (no penetration testing data)

---
*Research completed: 2026-05-14*
*Ready for roadmap: yes*
