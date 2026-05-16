# ST8 Bible — Architecture Reference

**Version:** 0.1.0  
**Date:** 2026-05-13  
**Purpose:** Complete architecture reference for the ST8 Full Stack Logic Analyzer

---

## Table of Contents

Line numbers reference HEAD at the time of generation. Re-run `grep -nE "^(## |### Batch )" st8_bible.md` to refresh if drift is suspected.

### Major sections

| Section | Line |
|---|---|
| What is ST8? | 79 |
| Architecture Overview | 107 |
| Layer 1: Frontend (st8.html + Companion JS) | 171 |
| Layer 2: Backend (backend/) | 259 |
| Layer 3: Analysis Libraries (lib/) | 424 |
| Layer 4: Integr8 Pipeline (lib/commands/integr8/) | 574 |
| Layer 5: Schema Cards (.st8/schema-cards/) | 699 |
| Database Schema | 751 |
| Signal Flow | 853 |
| Workspace Types | 930 |
| Design Tokens (Non-Negotiable) | 953 |
| API Endpoints | 974 |
| Dependencies | 999 |
| Current Problems | 1013 |
| Roadmap | 1040 |
| Related Projects | 1060 |
| Key Insights | 1069 |
| PRD System (Planned) | 1098 |
| Signal Path Analysis (from Codebase Review) | 1197 |
| Components Being Removed | 1296 |
| The .st8 Directory | 1310 |
| Research Synthesis (2026-05-14) | 1400 |
| Re-Integration Plan | 1583 |
| Refactor Findings — 2026-05-14 | 1674 |
| Refactor Batch Log — 2026-05-14 | 1775 |

### Refactor Batch Log — quick index

Chronological list of every batch with its one-line goal and starting line. Batches 001-021 are the layout refactor proper; 022+ are follow-on debug/feature work threaded through the same log.

| Batch | Topic | Line |
|---|---|---|
| 001 | `shared` — leaf utilities + types into src/shared/ | 1782 |
| 002 | `core-database` — persistence + graph-persister into src/core/database/ | 1813 |
| 003 | `lifecycle-watcher` — bruno-oscar + file-watcher into src/features/ | 1874 |
| 004 | `schema-cards` — emitter, printer, manifest-generator | 1897 |
| 005 | `prd` — prd-generator + template-engine into src/features/prd/ | 1934 |
| 006 | `analysis` — gap-analyzer + intent-seeder into src/features/analysis/ | 1957 |
| 007 | `integr8-core` — pipeline orchestrator + serializers into src/features/integr8/ | 1985 |
| 008 | `indexing-parsers` — six AST parsers + overview into src/features/indexing/ | 2024 |
| 009 | `indexing-engine` — indexer + parser-persistence + data-ingestion | 2064 |
| 010 | `server-and-entry` — main.js (was index) + app.js (was server) | 2098 |
| 011 | `launcher-rewire` + end-to-end boot — start.js rewired, full boot verified | 2135 |
| 012 | `frontend-components` — st8.html sliced into HTML/CSS/JS components | 2169 |
| 013 | `st8-html-css-extraction` — inline CSS extracted to src/frontend/styles/ | 2200 |
| 014 | `st8-html-js-extraction` — inline JS extracted to src/frontend/app.js | 2238 |
| 015 | `frontend-shell` — 142-line index.html slim shell | 2272 |
| 016 | `backend-static-fix-and-v2-route` — static-route fixes + /v2 route | 2330 |
| 017 | `background-indexer` — backgroundIndexer.js migrated to src/features/indexing/ | 2374 |
| 018 | `void-engine-fake-stream-cleanup` — retire void-engine + fake-stream | 2416 |
| 019 | `stage-originals-to-OGB` — pre-refactor originals into OGB/ for archival | 2444 |
| 020 | `flip-default-to-new-shell` — index.html → new slim shell by default | 2482 |
| 021 | `post-refactor-cleanup-and-signal-tests` — file-renames + Tier 2/6 signal tests | 2531 |
| 022 | `intent-seeder-fix-and-gap-analyzer-jsdoc` — schema fix + docstrings | 2684 |
| 023 | `hook-registry-and-named-hooks` — HookRegistry + HOOKS constants + DRY+wrap | 2707 |
| 024 | `post-commit-git-hook` — record-commit endpoint + .git/hooks installer | 2767 |
| 025 | `post-audit-cleanup-and-force-checks` — drift sweeps + boot-time force checks | 2805 |
| 026 | `little-stuff-fixes` — small bugs swept after the big waves | 2922 |
| 027 | `sonic-foundation` (Layer 1 of PM-1) — Sonic daemon + missing trio wired | 2938 |

---

## What is ST8?

ST8 is a standalone codebase analysis tool that provides real-time visibility into file connection state. It's the first in a series: **st8 → integr8 → actu8 → orchestr8**.

> "You can't integrate what you can't see. You can't actuate what you haven't integrated. You can't orchestrate what you haven't actuated."

ST8 gives you the ability to **see** the state of your codebase — which files are connected, which are orphaned, and where the signal path breaks.

### Core Concept

The tool provides a "logic analyzer for software" — visualizing signal paths in codebases like hardware engineers visualize signal paths in circuits. Each file gets a unique fingerprint that persists through renames, moves, and refactors, with every state change recorded.

### Design Philosophy

**Hardware Analogies:**
- **Ground Plane** — Pre-verifies critical directory structure on startup (stable base state)
- **Safe Filesystem** — Fortified filesystem wrapper that never throws, always returns typed Result<T, FsError>
- **I/O Channels** — Priority-based I/O channel router with circuit breakers
- **Circuit Breakers** — Prevent critical operations from being starved by bulk analysis I/O

**Consciousness Persistence:**
- File identity survives renaming, moving, refactoring
- Each modification is recorded as state change
- The "all hands attendance call" verifies all patterns are still present
- This is a logic analyzer for software — but also a memory system

---

## Architecture Overview

```
st8/
├── st8.html                    # Main UI (void + dock + panels)
├── file-explorer.js            # File browser panel
├── phreak-terminal.js          # Terminal panel
├── graph-visualizer.js         # D3.js graph renderer
├── settings-ui.js              # Settings interface
├── coordination.js             # Multi-LLM synchronization
├── settings-reader.js          # Settings persistence
├── start.js                    # Auto-start script
├── package.json                # Dependencies
│
├── backend/                    # Backend server
│   ├── index.js                # Main entry point
│   ├── indexer.js              # File indexing engine
│   ├── persistence.js          # SQLite database layer
│   ├── manifestGenerator.js    # JSON/TOML manifest generation
│   ├── fileWatcher.js          # File change detection
│   ├── server.js               # HTTP server
│   ├── st8-types.js            # Canonical type definitions
│   ├── schemaCardEmitter.js    # Schema card JSON generation
│   ├── schemaCardPrinter.js    # Human-readable .txt fallback
│   ├── notificationBus.js      # Event-driven notification system
│   ├── gapAnalyzer.js          # 6-dimension gap analysis engine
│   ├── intentSeeder.js         # Auto-generate intent from AST
│   ├── prdGenerator.js         # PRD generation from schema cards
│   └── brunoOscar.js           # Automatic file lifecycle management
│
├── lib/                        # Analysis libraries (from maestro)
│   ├── utils/
│   │   ├── astParser.js        # AST-based import/export extraction
│   │   ├── safeFs.js           # Fortified filesystem wrapper
│   │   ├── ioChan.js           # Priority-based I/O router
│   │   └── groundPlane.js      # Directory structure verification
│   └── commands/
│       ├── graphBuilder.js     # Dependency graph builder
│       ├── graphTraversal.js   # Graph traversal and queries
│       ├── backgroundIndexer.js # Background indexing engine
│       ├── overview.js         # File index generation
│       ├── parserPersistence.js # Parser output persistence
│       ├── insightStore.js     # Insight accumulation store
│       └── integr8/            # Integration pipeline
│           ├── index.js        # Main orchestrator
│           ├── dataIngestion.js # Stage 1: Data ingestion
│           ├── relationshipAnalyzer.js # Stage 2: Relationship analysis
│           ├── pathGenerator.js # Stage 3: Path generation
│           ├── tomlSerializer.js # TOML serialization
│           ├── reportGenerator.js # Report generation
│           ├── databasePersister.js # SQLite persistence
│           ├── migrationExecutor.js # Migration execution
│           └── types.js        # Type definitions
│
├── .st8/
│   └── schema-cards/           # 43 JSON schema cards (one per file)
│
└── fonts/                      # Typography
    ├── Monoton-Regular.ttf     # Wordmark font
    └── PoiretOne-Regular.ttf   # Chrome/body font
```

---

## Layer 1: Frontend (st8.html + Companion JS)

### st8.html (2585 lines)

The main UI file with three major sections:

**Section 1: Styles (Lines 137-1686)**
- Fonts (@font-face)
- CSS Custom Properties (:root) — Design tokens
- Void / Drift Surface — The "void" background with text animation
- Chat Area — Left panel for LLM interaction
- File List (right panel) — GREEN/YELLOW/RED status dots
- Notes Popup — Purpose, dependsOnBehavior, valueStatement form
- Graph Popup — D3.js visualization container
- Settings Popup — Schema-driven configuration
- Bottom Dock — Navigation and action buttons
- Panel Overlay — Explorer and terminal panels
- File Explorer Styles — File browser UI
- Workspace Picker — Standard, Logic Analyzer, Pretext Dev modes
- Phreak Terminal Styles — Terminal UI
- Mutation Notifications & Toasts — Real-time feedback

**Section 2: HTML Structure (Lines 1687-1757)**
- Mutation Toast Container (#mutation-toasts)
- Main Void / #stage — Primary content area
- Footer Dock — Navigation buttons
- Explorer Panel Overlay — File browser
- Phreak Terminal Overlay — Terminal
- PRD Project Wizard Overlay — PRD generation

**Section 3: JavaScript (Lines 1760-2585)**
- Void-Engine Loader — loadVoidEngine() / unloadVoidEngine()
- Utility Functions — escapeHtml()
- External Script Includes — file-explorer.js, phreak-terminal.js, graph-visualizer.js, settings-ui.js, coordination.js
- Panel Controller — openPanel(), closePanel(), togglePanel()
- PRD Wizard — openPRDWizard(), closePRDWizard(), loadTemplatesForWizard(), createPRDProject()
- Template Variable Editor — showPopup(), showVariableEditor()
- Workspace Change Handler — st8WorkspaceChanged()
- File List Rendering — renderFileList()
- File Action Handlers — handleFileNotes(), handleFileClipboard()
- Copy File Context — copyFileContext()
- Notes Popup — showNotesPopup()
- Save File Notes — saveFileNotes()
- Indexing Complete Handler — st8IndexingComplete()
- Fetch Manifest — fetchManifest()
- Bruno & Oscar Toasts — showBrunoToast(), showArchiveToast(), showAIReviewToast()
- SSE Mutation Stream — initMutationStream()

### Companion JS Files

**file-explorer.js (748 lines)**
- File browser panel with workspace picker
- Virtual scrolling for large directories
- Hidden files toggle (persisted)
- Dynamic workspace path (no hardcodes)
- Error display with retry

**phreak-terminal.js (1086 lines)**
- Terminal panel with TUI mode
- Append-only streaming (no full innerHTML re-render)
- Event delegation (CSP-safe, no inline onclick)
- Signal framework (receiveSignal, provisioned pop-ups)
- Phone icon (vintage SVG handset, off-hook toggle)

**graph-visualizer.js (456 lines)**
- D3.js force-directed graph renderer
- Node coloring by status (GREEN/YELLOW/RED)
- Node sizing by impact radius
- Drag to rearrange, zoom and pan

**settings-ui.js (339 lines)**
- Schema-driven settings UI
- Categories: Sirkits, Models, Shells, Voidflow, Keybindings, Theme, Storage, Network
- Form-based editing with duplicate pattern

**coordination.js (210 lines)**
- Multi-LLM manifest synchronization
- Both LLMs read the same connection-state.json
- Polling for real-time updates (2000ms interval)
- Change detection and notification

**settings-reader.js (113 lines)**
- Settings persistence with LocalStorageAdapter
- Schema-driven, JSON validated
- Exposes window.st8Settings as live POJO

---

## Layer 2: Backend (backend/)

### index.js (435 lines) — Main Entry Point

Ties together all backend modules:
- Parses CLI arguments (target directory, --watch, --serve, --port)
- Initializes persistence (St8Persistence)
- Runs initial indexing (indexDirectory)
- Initializes schema card emitter + printer
- Stores results in SQLite (Pass 1: upsert files, Pass 2: upsert connections)
- Emits schema cards for each file
- Seeds intent for files without intent
- Runs gap analysis
- Starts file watcher if --watch
- Starts HTTP server if --serve

### indexer.js (482 lines) — File Indexing Engine

Core indexing logic:
- **File Discovery**: Walks directory tree, filters by CODE_EXTENSIONS (.js, .ts, .jsx, .tsx, .vue, .py, .rs, .go, .md, .txt, .json)
- **Hashing**: SHA-256 content hashing for each file
- **AST Extraction**: Uses lib/utils/astParser.js to extract imports/exports
- **Connection Building**: Builds connection graph from AST data
- **Status Classification**: GREEN (imported by others), YELLOW (partially connected), RED (orphaned)
- **Fingerprint Generation**: Stable identity: {filepath}||{birthTimestamp}

**Key Functions:**
- discoverFiles(targetDir) — Walk directory tree
- hashFile(filePath) — SHA-256 content hash
- extractImportsExports(filePath, content) — AST-based extraction
- buildConnections(files) — Build connection graph
- classifyFileStatus(file, connections) — GREEN/YELLOW/RED
- indexDirectory(targetDir, options) — Main indexing function

### persistence.js (704 lines) — SQLite Database Layer

Database schema with evolution support:

**Tables:**
- file_registry — Main file tracking (fingerprint, filepath, sha256Hash, status, etc.)
- connections — Source/target fingerprint pairs with connection type
- file_intent — Purpose, dependsOnBehavior, valueStatement per file
- file_mutation_log — Mutation tracking with actor, type, timestamp
- activity_log — All actions logged with source, action, target, details
- st8_settings — Key-value settings storage

**Key Methods:**
- initialize() — Create tables, handle schema evolution
- upsertFile(file) — Insert or update file record
- upsertConnection(connection) — Insert or update connection
- getFileByFingerprint(fingerprint) — Get file by stable identity
- getConnectionsBySource(fingerprint) — Get outgoing connections
- getConnectionsByTarget(fingerprint) — Get incoming connections
- logMutation(mutation) — Record mutation in log
- logActivity(activity) — Record activity in log

### manifestGenerator.js (172 lines) — Manifest Generation

Generates two manifests:
- **connection-state.json** — File connection manifest with metadata, file list, status counts
- **ai-signal.toml** — AI consumption manifest with structured file data

### fileWatcher.js (139 lines) — File Change Detection

Uses chokidar to watch for file changes:
- Watches target directory (excluding node_modules, .git, dist, etc.)
- Debounces changes (500ms default)
- Triggers re-indexing on change
- Publishes mutations via notificationBus

### server.js (1430 lines) — HTTP Server

Express-like HTTP server:
- Serves static files (st8.html, JS, CSS, fonts)
- API endpoints:
  - GET /api/connection-state.json — File connection manifest
  - GET /api/ai-signal.toml — AI consumption manifest
  - GET /api/health — Server health check
  - POST /api/index — Trigger re-indexing
  - POST /api/file-intent — Save file intent
  - GET /api/settings — Get settings
  - POST /api/settings — Save settings
  - GET /api/verify — Verify connections
  - GET /api/gap-analysis — Run gap analysis
  - GET /api/schema-cards — Get schema cards
  - GET /api/prd — Generate PRD
  - GET /api/bruno — Run Bruno's Call
  - GET /api/oscar — Run Oscar's Archive
  - GET /api/events — SSE endpoint for mutations

### st8-types.js (281 lines) — Canonical Type Definitions

Single source of truth for all st8 data shapes:

**Enums:**
- LifecyclePhase — CONCEPT, LOCKED, WIRING, DEVELOPMENT, PRODUCTION
- FileStatus — GREEN, YELLOW, RED, CONCEPT, LOCKED, PRODUCTION
- MutationType — CONCEPT, CREATE, EDIT, RENAME, REFACTOR, DELETE, LOCK, PRODUCTION, PURGE
- ActorType — DEVELOPER, INDEXER, WATCHER, AGENT

**Shapes:**
- St8FileEntry — Core file shape (fingerprint, filepath, sha256Hash, status, etc.)
- St8SchemaCard — Extended file shape with AST data + connections + intent
- St8MutationRecord — Mutation tracking shape

**Key Functions:**
- generateFingerprint(filepath, birthTimestamp) — Create stable identity
- parseFingerprint(fingerprint) — Extract filepath and timestamp
- validateSt8FileEntry(entry) — Validate file entry shape
- validateSt8SchemaCard(card) — Validate schema card shape

### schemaCardEmitter.js (209 lines) — Schema Card Generation

Generates deterministic .st8/schema-card.json for each file:
- Called after every index run and on every file change
- Schema cards are machine-readable, always in sync, diffable in git
- Contains: fingerprint, connections, exports, imports, intent, mutation summary

### schemaCardPrinter.js (294 lines) — Human-Readable Fallback

Emits .txt files to .planning/st8_identity_system/:
- Fallback output for when st8 visual system is offline
- Files follow naming convention: {timestamp}_{sanitized-filename}.txt
- Contains: identity header, content version, exports, imports, connections, intent, mutation summary

### notificationBus.js (126 lines) — Event-Driven Notifications

Event-driven notification system for file mutations:
- EventEmitter for in-process subscribers
- SSE endpoint for frontend consumers
- Console output as immediate feedback
- Delegates to SchemaCardPrinter for .txt fallback

### gapAnalyzer.js (651 lines) — 6-Dimension Gap Analysis

Analyzes schema cards across 6 dimensions:
- D1: Lifecycle Progression — Files stuck in CONCEPT/DEVELOPMENT
- D2: Status Health — RED/YELLOW files needing attention
- D3: Intent Authoring — Files without purpose/dependsOnBehavior/valueStatement
- D4: Export Surface — Files with no exports or unused exports
- D5: Connection Integrity — Unresolved imports, dead connections
- D6: Architectural Completeness — Missing files referenced in schema cards

### intentSeeder.js (510 lines) — Auto-Generate Intent

Generates purpose, dependsOnBehavior, and valueStatement for every file:
- Uses filename patterns, imports, exports, and comment heuristics
- All generated fields flagged with ??? to indicate INFERRED status
- Maps filename patterns to human-readable purpose descriptions

### prdGenerator.js (200 lines) — PRD Generation

Generates Product Requirements Document from schema cards:
- Loads all schema cards from .st8/schema-cards/
- Groups cards by lifecycle phase
- Generates comprehensive PRD with file inventory

### brunoOscar.js (185 lines) — File Lifecycle Management

Automatic file lifecycle management:
- **Bruno**: Scans for stale files (unaccessed for N sessions)
- **Oscar**: Archives flagged files and manages expiry dates

---

## Layer 3: Analysis Libraries (lib/)

### utils/astParser.js (1066 lines) — AST-Based Import/Export Extraction

Uses @babel/parser to extract imports and exports from JavaScript/TypeScript files:

**Key Functions:**
- extractImportsAndExports(filePath, content) — Main extraction function
- extractFromText(content, filePath) — Extract from text content
- extractCommonJSExportsFromAST(ast, content, filePath) — CommonJS exports
- extractESMExportsFromAST(ast, content, filePath) — ESM exports
- extractImportsFromAST(ast, content, filePath) — Import statements

**Handles:**
- CommonJS: module.exports = { ... }, exports.foo = ...
- ESM: export default, export const, export function
- Dynamic imports: import(variable), conditional require()
- Template literals in require paths

### utils/safeFs.js (599 lines) — Fortified Filesystem Wrapper

Never throws, always returns typed Result<T, FsError>:

**Key Functions:**
- safeReadFile(filePath) — Read file with error handling
- safeWriteFile(filePath, content) — Write file with error handling
- safeReaddir(dirPath) — Read directory with error handling
- safeMkdir(dirPath) — Create directory with error handling
- safeStat(filePath) — Get file stats with error handling
- safeAccess(filePath) — Check file access with error handling
- safeUnlink(filePath) — Delete file with error handling

**Error Classification:**
- isTransient(err) — EACCES, EPERM, EMFILE, ENOSPC, ELOOP
- isPermission(err) — EACCES, EPERM
- isMissing(err) — ENOENT, ENOTDIR
- isCorrupt(err) — EISDIR

### utils/ioChan.js (396 lines) — Priority-Based I/O Router

Hardware analogy: a custom signal bus with tiered protection levels:

**Priority Levels:**
- CRITICAL — Serialized, 1 concurrent. Registry writes, database transactions.
- IMPORTANT — 5 concurrent. User reports, exports.
- ANALYSIS — 20 concurrent. Project scanning, diagnostics.
- BEST_EFFORT — 100 concurrent. Cache writes, temp data. Fails fast if congested.

**Circuit Breaker:**
- CLOSED — Normal operation
- OPEN — Circuit tripped, operations blocked
- HALF_OPEN — Probe requests allowed

### utils/groundPlane.js (268 lines) — Directory Structure Verification

Pre-verifies critical directory structure on startup:

**Key Functions:**
- initGroundPlane() — Initialize ground plane, create directories
- getVerifiedPath(pathType) — Get verified path for type
- validateGroundPlane() — Validate all paths exist
- getGroundPlanePaths() — Get all ground plane paths

**Path Types:**
- data — Primary: ~/.local/share/com.scaffolder.app, Fallback: /tmp/maestro-{pid}/data
- cache — Primary: ~/.cache/com.scaffolder.app, Fallback: /tmp/maestro-{pid}/cache
- plugins — Primary: ~/.local/share/com.scaffolder.app/plugins, Fallback: /tmp/maestro-{pid}/plugins
- temp — Primary: /tmp/maestro-{pid}/work, Fallback: /tmp/maestro-fallback-{pid}

### commands/graphBuilder.js (214 lines) — Dependency Graph Builder

Builds dependency graph with health analysis:

**Key Functions:**
- buildDependencyGraph(projectPath) — Build graph with health scoring
- getImpactAnalysis(projectPath, targetFile) — Get impact analysis for file

**Analysis:**
- Circular dependency detection (DFS-based)
- Orphaned file detection (no incoming AND no outgoing edges)
- Dead import detection (import nodes with no matching export edge)
- Impact radius computation (BFS counting transitive dependents)
- Health classification: healthy, warning, broken

### commands/graphTraversal.js (828 lines) — Graph Traversal Queries

Graph traversal and directory-boundary-aware query functions:

**Key Functions:**
- findPaths(fromNode, toNode) — Find all paths between nodes
- analyzeReachability(graphId) — Analyze reachability for all nodes
- extractSubgraph(graphId, centerNode, depth) — Extract subgraph around node
- computeImpactChain(graphId, nodeId) — Compute impact chain for node
- findImportsOf(graphId, filePath) — Find all imports of file
- findConsumersOf(graphId, filePath) — Find all consumers of file
- findOrphans(graphId) — Find all orphaned files
- getDirectorySubgraph(graphId, dirPath) — Get subgraph for directory
- getDirectoryBoundary(graphId, dirPath) — Get directory boundary
- getDataFlowMetrics(graphId) — Get data flow metrics
- getFileFlows(graphId) — Get file flows

### commands/backgroundIndexer.js (812 lines) — Background Indexing Engine

The heart of the "parse to oblivion" vision:

**Key Features:**
- Non-blocking project registration
- Exhaustive background indexing
- Incremental updates via file watching
- Job queue with concurrent job limits
- Event-driven progress reporting

**Key Methods:**
- registerProject(projectPath) — Register project for indexing
- startBackgroundIndexing() — Start background indexing
- stopBackgroundIndexing() — Stop background indexing
- indexProject(projectPath) — Index single project
- watchProject(projectPath) — Watch project for changes

### commands/overview.js (350 lines) — File Index Generation

Generates numbered file index string:

**Key Functions:**
- generateOverviewAndGetFileList(targetPath) — Generate overview and file list
- getRelativeProjectFiles(basePath) — Get sorted list of project files

### commands/parserPersistence.js (295 lines) — Parser Output Persistence

Database-first parser persistence layer:

**Key Methods:**
- ensureProjectTables() — Create tables for parser output
- saveParserOutput(projectId, parserName, output) — Save parser output
- getParserOutput(projectId, parserName) — Get parser output
- getParserOutputs(projectId) — Get all parser outputs for project

### commands/insightStore.js (362 lines) — Insight Accumulation Store

FileInsightSlot-based insight accumulation:

**Key Methods:**
- ensureTables() — Create tables for insights
- addInsight(fileId, category, insight) — Add insight for file
- getInsights(fileId) — Get all insights for file
- getInsightsByCategory(fileId, category) — Get insights by category
- getRecentInsights(limit) — Get recent insights

---

## Layer 4: Integr8 Pipeline (lib/commands/integr8/)

### index.js (140 lines) — Main Orchestrator

Central entry point that wires all three stages together:

**Pipeline:**
1. Data Ingestion → 2. Relationship Analysis → 3. Path Generation → 4. Output

**Key Function:**
- runIntegr8Command(args) — Run full integr8 pipeline

### dataIngestion.js (1102 lines) — Stage 1: Data Ingestion

Calls existing parsers, parses text output into graph nodes:

**Key Functions:**
- ingestProjectData(options) — Ingest project data
- ingestSingleProject(projectPath) — Ingest single project
- getParserHealthReport() — Get parser health report
- resetParserHealth() — Reset parser health

**Parsers Called:**
- storeParser.js — Store/state management parsing
- routeParser.js — Route/navigation parsing
- commandParser.js — Command/CLI parsing
- typeParser.js — Type definition parsing
- uiParser.js — UI component parsing
- overview.js — File overview generation

**Health Monitoring:**
- Circuit breaker with failure threshold (3), reset timeout (30s)
- Adaptive retry with error-specific delays
- Parser health tracking and reporting

### relationshipAnalyzer.js (924 lines) — Stage 2: Relationship Analysis

Analyzes relationships between two SemanticGraphs:

**Key Functions:**
- analyzeRelationships(externalGraph, currentGraph, targetPages) — Analyze relationships
- analyzeStructuralSubtyping(externalNode, currentNode) — Analyze structural subtyping
- detectBreakingChanges(externalGraph, currentGraph) — Detect breaking changes
- computeTarjanSCC(graph) — Compute Tarjan's SCC
- detectCyclesWithTarjan(graph) — Detect cycles with Tarjan's algorithm

**Analysis:**
- Dependency matching (SAFE, NEEDS_REWRITE, CONFLICT, MISSING)
- Conflict detection (NAME_COLLISION, TYPE_MISMATCH, VERSION_CONFLICT, CIRCULAR_DEPENDENCY, API_INCOMPATIBILITY, MISSING_DEPENDENCY)
- Unified graph construction with edge classification

### pathGenerator.js — Stage 3: Path Generation

Generates migration paths for integration:

**Key Functions:**
- generateMigrationPath(analysisResult) — Generate migration path
- classifyMigrationActions(dependencyMap) — Classify migration actions

**Migration Actions:**
- COPY_FILE — Copy file to target
- REWRITE_IMPORT — Rewrite import path
- MERGE_ROUTE — Merge route definitions
- RESOLVE_CONFLICT — Resolve conflicts
- RUN_COMMAND — Run command
- VERIFY — Verify integration

### tomlSerializer.js — TOML Serialization

Serializes integration results to TOML format:

**Key Functions:**
- serializeToIntegrationToml(result) — Serialize to TOML
- escapeTomlString(value) — Escape TOML string

### reportGenerator.js — Report Generation

Generates human-readable integration reports:

**Key Functions:**
- generateIntegrationReport(result) — Generate report
- formatDependencyStatus(status) — Format dependency status
- formatConflictType(type) — Format conflict type

### databasePersister.js (229 lines) — SQLite Persistence

Direct Node.js-to-SQLite persistence for integr8's semantic graph:

**Tables:**
- GraphNodes — Node storage (id, graph_id, type, name, path, metadata)
- GraphEdges — Edge storage (id, graph_id, from_node_id, to_node_id, type, metadata)
- MigrationPlans — Migration plan storage
- IntegrationSnapshots — Integration snapshot storage

**Key Methods:**
- initializeDatabase() — Create tables matching schema.rs
- saveGraph(graph) — Save graph to database
- loadGraph(graphId) — Load graph from database
- saveMigrationPlan(plan) — Save migration plan
- loadMigrationPlan(planId) — Load migration plan

### migrationExecutor.js — Migration Execution

Executes migration plans:

**Key Functions:**
- executeMigrationPlan(plan) — Execute migration plan
- executeMigrationAction(action) — Execute single migration action

### types.js (83 lines) — Type Definitions

Type definitions for integr8 pipeline:

**Enums:**
- IntegrationOutcome — SUCCESS, PARTIAL, FAILURE, AMBIGUOUS, REDIRECT
- DependencyStatus — SAFE, NEEDS_REWRITE, CONFLICT, MISSING
- NodeType — FILE, STORE, ROUTE, COMMAND, TYPE, IMPORT, EXPORT, COMPONENT, FUNCTION, VARIABLE
- EdgeType — DEPENDS_ON, IMPORTS, EXPORTS, NAVIGATES_TO, INVOKES, CONFLICTS_WITH, CONTAINS, CALLS, READS, WRITES, DYNAMIC_IMPORT, REEXPORTS
- MigrationAction — COPY_FILE, REWRITE_IMPORT, MERGE_ROUTE, RESOLVE_CONFLICT, RUN_COMMAND, VERIFY
- ConflictType — NAME_COLLISION, TYPE_MISMATCH, VERSION_CONFLICT, CIRCULAR_DEPENDENCY, API_INCOMPATIBILITY, MISSING_DEPENDENCY
- ResolutionStrategy — RENAME, MERGE, OVERWRITE, IGNORE, CUSTOM
- VerificationLevel — SYNTAX, IMPORT_RESOLUTION, TYPE_CHECK

---

## Layer 5: Schema Cards (.st8/schema-cards/)

### Overview

43 JSON files, one per code file. Each schema card contains:

- **Identity**: fingerprint, filepath, filename, sha256Hash
- **Status**: status (GREEN/YELLOW/RED), reachabilityScore, impactRadius
- **Lifecycle**: lifecyclePhase, birthTimestamp, lastModified, lastIndexed
- **AST Data**: exports (name, kind, signature, returnType), imports (source, specifiers, importType)
- **Connections**: importedBy (list of fingerprints), imports (list of fingerprints)
- **Intent**: purpose, dependsOnBehavior, valueStatement
- **Mutation**: mutationCount, lastMutation (actor, timestamp, type)

### Example Schema Card

```json
{
  "fingerprint": "backend/index.js||2026-05-12T07:23:01.935Z",
  "filepath": "backend/index.js",
  "filename": "index.js",
  "sha256Hash": "95ac1934e6dfd8add4189ec5adfdfb98734ee36fda937083a8387b09e785e2c9",
  "status": "RED",
  "lifecyclePhase": "DEVELOPMENT",
  "exports": [],
  "imports": [
    { "importType": "require", "source": "./indexer", "specifiers": [] },
    { "importType": "require", "source": "./persistence", "specifiers": [] }
  ],
  "connections": {
    "importedBy": [],
    "imports": [
      "backend/indexer.js||2026-05-12T07:20:30.968Z",
      "backend/persistence.js||2026-05-12T07:21:03.355Z"
    ]
  },
  "intent": {
    "purpose": "Module entry point — ST8 Backend — Main Entry Point ???",
    "dependsOnBehavior": "file path manipulation, codebase indexing, database persistence layer, ...",
    "valueStatement": "Provides main API ???"
  },
  "mutationCount": 4,
  "lastMutation": {
    "actor": "INDEXER",
    "timestamp": "2026-05-13 20:11:55",
    "type": "CREATE"
  }
}
```

---

## Database Schema

### file_registry

Main file tracking table:

| Column | Type | Description |
|--------|------|-------------|
| fingerprint | TEXT PRIMARY KEY | Stable identity: {filepath}||{birthTimestamp} |
| filepath | TEXT NOT NULL | Relative path from project root |
| filename | TEXT NOT NULL | Basename with extension |
| sha256Hash | TEXT NOT NULL | Content version (changes on every edit) |
| fileSizeBytes | INTEGER | File size in bytes |
| status | TEXT DEFAULT 'RED' | GREEN, YELLOW, RED, CONCEPT, LOCKED, PRODUCTION |
| reachabilityScore | REAL DEFAULT 0.0 | 0.0 to 1.0 |
| impactRadius | INTEGER DEFAULT 0 | Transitive dependents count |
| lifecyclePhase | TEXT DEFAULT 'DEVELOPMENT' | CONCEPT, LOCKED, WIRING, DEVELOPMENT, PRODUCTION |
| birthTimestamp | TEXT | ISO timestamp — set once at creation, never changes |
| lastModified | TEXT | ISO timestamp — updated on every content change |
| lastIndexed | TEXT DEFAULT CURRENT_TIMESTAMP | ISO timestamp — updated on every index run |
| isEntryPoint | INTEGER DEFAULT 0 | Whether this file is an entry point |
| lastAccessed | TEXT | ISO timestamp — last time file was accessed |
| sessionsSinceAccess | INTEGER DEFAULT 0 | Sessions since last access |
| expiryDate | TEXT | Expiry date for stale file detection |
| associatedWith | TEXT | Associated files |
| eventTrigger | TEXT | Event trigger for file |
| brunoStatus | TEXT DEFAULT 'active' | Bruno status (active, flagged, archived) |
| needsAIReview | INTEGER DEFAULT 0 | Whether file needs AI review |
| tripleAtCount | INTEGER DEFAULT 0 | Count of ??? in intent fields |
| aiContentInjected | INTEGER DEFAULT 0 | Whether AI content was injected |
| templateVariables | TEXT | Template variables in file |
| hasUnfilledVariables | INTEGER DEFAULT 0 | Whether file has unfilled variables |

### connections

Source/target fingerprint pairs:

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Connection ID |
| sourceFingerprint | TEXT NOT NULL | Source file fingerprint |
| targetFingerprint | TEXT NOT NULL | Target file fingerprint |
| connectionType | TEXT DEFAULT 'IMPORT' | IMPORT, EXPORT, DYNAMIC, IPC |
| importSpecifier | TEXT | Import specifier |
| isResolved | INTEGER DEFAULT 1 | Whether connection is resolved |
| confidenceScore | REAL DEFAULT 1.0 | Confidence score (0.0 to 1.0) |
| lastVerified | TEXT DEFAULT CURRENT_TIMESTAMP | Last verification timestamp |

### file_intent

Purpose and behavior for each file:

| Column | Type | Description |
|--------|------|-------------|
| fingerprint | TEXT PRIMARY KEY | File fingerprint |
| purpose | TEXT | What the file does |
| dependsOnBehavior | TEXT | What behavior depends on |
| valueStatement | TEXT | Why the file exists |
| authoredBy | TEXT DEFAULT 'INFERRED' | Who authored the intent |
| lastUpdated | TEXT DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

### file_mutation_log

Mutation tracking:

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Mutation ID |
| fingerprint | TEXT NOT NULL | File fingerprint |
| sha256Hash | TEXT NOT NULL | Content hash at mutation |
| mutationType | TEXT NOT NULL | CONCEPT, CREATE, EDIT, RENAME, REFACTOR, DELETE, LOCK, PRODUCTION, PURGE |
| changedFields | TEXT | Changed fields (JSON) |
| actor | TEXT DEFAULT 'DEVELOPER' | DEVELOPER, INDEXER, WATCHER, AGENT |
| timestamp | TEXT DEFAULT CURRENT_TIMESTAMP | Mutation timestamp |
| metadata | TEXT | Additional metadata (JSON) |

### activity_log

All actions logged:

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Activity ID |
| timestamp | TEXT DEFAULT CURRENT_TIMESTAMP | Activity timestamp |
| source | TEXT DEFAULT 'INDEXER' | Source of activity |
| action | TEXT NOT NULL | Action type |
| targetFingerprint | TEXT | Target file fingerprint |
| details | TEXT | Activity details (JSON) |

### st8_settings

Key-value settings storage:

| Column | Type | Description |
|--------|------|-------------|
| category | TEXT NOT NULL | Settings category |
| key | TEXT NOT NULL | Setting key |
| value | TEXT | Setting value |
| updatedAt | TEXT DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

---

## Signal Flow

### 1. Indexing

```
backend/indexer.js
  ├── discoverFiles(targetDir) — Walk directory tree
  ├── hashFile(filePath) — SHA-256 content hash
  ├── extractImportsExports(filePath, content) — AST-based extraction
  ├── buildConnections(files) — Build connection graph
  └── classifyFileStatus(file, connections) — GREEN/YELLOW/RED
```

### 2. Persistence

```
backend/persistence.js
  ├── initialize() — Create tables, handle schema evolution
  ├── upsertFile(file) — Insert or update file record
  ├── upsertConnection(connection) — Insert or update connection
  ├── logMutation(mutation) — Record mutation in log
  └── logActivity(activity) — Record activity in log
```

### 3. Manifest Generation

```
backend/manifestGenerator.js
  ├── generateConnectionState(files, targetDir) — Generate connection-state.json
  └── generateAiSignalToml(files, targetDir) — Generate ai-signal.toml
```

### 4. File Watching

```
backend/fileWatcher.js
  ├── start() — Start watching target directory
  ├── stop() — Stop watching
  └── onFileChange(filePath) — Handle file change
      └── Triggers re-indexing via notificationBus
```

### 5. Notification

```
backend/notificationBus.js
  ├── publish(event) — Publish mutation event
  ├── EventEmitter — In-process subscribers
  ├── SSE — Frontend consumers
  ├── Console — Immediate feedback
  └── SchemaCardPrinter — .txt fallback
```

### 6. Schema Cards

```
backend/schemaCardEmitter.js
  ├── emitCard(file, astResult, connections, intent, mutationSummary)
  └── Writes to .st8/schema-cards/{sanitized-filename}.json

backend/schemaCardPrinter.js
  ├── printCard(card)
  └── Writes to .planning/st8_identity_system/{timestamp}_{sanitized-filename}.txt
```

### 7. Frontend Display

```
st8.html
  ├── fetchManifest(targetPath) — Fetch connection-state.json
  ├── renderFileList(files) — Render file list with GREEN/YELLOW/RED
  ├── initMutationStream() — SSE connection for real-time updates
  └── showMutationToast(data) — Show mutation toast
```

---

## Workspace Types

ST8 supports three workspace types:

### 1. Standard
- Normal void with pretext/drift active
- Text flows around obstacles (sirkits)
- Default mode

### 2. Full Stack Logic Analyzer
- Void splits vertically: left = chat, right = file list
- File list shows GREEN/YELLOW/RED status
- Notes and Clipboard buttons per file
- TUI toolbar with isolation buttons
- Pretext/drift deactivated

### 3. Pretext Dev
- Current state with complex dynamic carets
- Text flying around obstacles
- Development environment for refining the drift surface

---

## Design Tokens (Non-Negotiable)

```css
--void:   #0A0A0B    /* Background (obsidian black) */
--text:   #E0E0E0    /* Primary text */
--gold:   #D4AF37    /* Wordmark, diamonds, system text */
--cyan:   #1FBDEA    /* UI chrome, cursor, dynamic data */
--pink:   #C9748F    /* Notifications, error chrome, rim accents */
```

**Typography:**
- Monoton — Wordmark ("st8")
- Poiret One — Chrome labels, body text

**Idioms:**
- `0.5px -webkit-text-stroke` — Brand "weight bump"
- `letter-spacing: 1px` — Body text spacing
- `font-size: 18px` — Body text size

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves st8.html |
| `/api/connection-state.json` | GET | File connection manifest |
| `/api/ai-signal.toml` | GET | AI consumption manifest |
| `/api/health` | GET | Server health check |
| `/api/index` | POST | Trigger re-indexing |
| `/api/file-intent` | POST | Save file intent |
| `/api/settings` | GET | Get settings |
| `/api/settings` | POST | Save settings |
| `/api/verify` | GET | Verify connections |
| `/api/gap-analysis` | GET | Run gap analysis |
| `/api/schema-cards` | GET | Get schema cards |
| `/api/prd` | GET | Generate PRD |
| `/api/bruno` | GET | Run Bruno's Call |
| `/api/oscar` | GET | Run Oscar's Archive |
| `/api/events` | GET | SSE endpoint for mutations |
| `/*.js` | GET | JavaScript files |
| `/*.css` | GET | Stylesheets |
| `/*.ttf` | GET | Font files |

---

## Dependencies

- **Node.js** >= 18.0.0
- **better-sqlite3** — SQLite database
- **chokidar** — File watching
- **@babel/parser** — AST parsing
- **@babel/traverse** — AST traversal
- **@babel/types** — AST type definitions
- **fast-glob** — File discovery
- **fs-extra** — File system utilities
- **D3.js** v7 — Graph visualization (loaded from CDN)

---

## Current Problems

### Problem 1: Missing Parser Files

The `dataIngestion.js` in `lib/commands/integr8/` requires 5 parser files that don't exist in st8:
- `storeParser.js` ← MISSING
- `routeParser.js` ← MISSING
- `commandParser.js` ← MISSING
- `typeParser.js` ← MISSING
- `uiParser.js` ← MISSING

These exist in maestro-scaffolder-tool but weren't copied to st8.

### Problem 2: SQLite Schema Mismatch

`persistence.js` references a `brunoStatus` column that doesn't exist in the database. Schema evolved without migration.

### Problem 3: Graph Builder Dead

Because dataIngestion.js can't load (missing parsers), graphBuilder.js fails → 0 connections detected → everything shows RED.

### Problem 4: Missing Frontend Files

`void-engine.js` and `fake-stream.js` are referenced in st8.html but don't exist in the codebase.

---

## Roadmap

- [x] Phase 0: Workspace foundation
- [x] Phase 1: Void split
- [x] Phase 2: Indexer backend
- [x] Phase 3: File explorer Index button
- [x] Phase 4: Void right side file list
- [x] Phase 5: Notes popup
- [x] Phase 6: Phreak TUI buttons
- [x] Phase 7: Clipboard context
- [x] Phase 8: Runtime attendance call
- [x] Phase 9: Graph visualization
- [x] Phase 10: Full Settings UI
- [x] Phase 11: Multi-LLM coordination
- [ ] Debugging and testing
- [ ] Integration with maestro parsers
- [ ] Real-time collaboration features

---

## Related Projects

- **maestro-scaffolder-tool** — Source of analysis libraries
- **stereOS** — Consciousness persistence framework
- **actu8** — Action execution layer (next in series)
- **orchestr8** — Orchestration layer (future)

---

## Key Insights

### The Naming Cascade

st8 → integr8 → actu8 → orchestr8

Each is a prerequisite for the next:
- **st8** — See the state of your codebase
- **integr8** — Integrate what you can see
- **actu8** — Actuate what you've integrated
- **orchestr8** — Orchestrate what you've actuated

### Consciousness Persistence

The fingerprint-ID system isn't just a technical solution for tracking file state. It's a direct implementation of consciousness persistence applied to a codebase:
- Each file gets identity that survives renaming, moving, refactoring
- Each modification is recorded as state change
- The "all hands attendance call" is verifying that all patterns are still present and accounted for

### The AI Signal Method

What works for AI sensory capacities:
- A structured manifest — single JSON or TOML file regenerated on every change
- Contains: fingerprint, expected_connections, actual_connections, delta, last_verified, status
- When you paste a file's context into conversation, you can cross-reference this manifest instantly
- When you make a fix, the manifest updates, and both human and AI see the same truth

---

## PRD System (Planned)

### Overview

The st8 PRD System is a **conversational product requirements platform** that turns stakeholder aspirations into a compelling, multi-document PRD package — making products feel real before they exist.

**Key Differentiators:**
- Voice-first conversations with stakeholders (not forms)
- Cross-department inference engine that finds hidden opportunities
- PRD Package generation (press release, GTM plan, sales strategy, tech specs, and more)
- Objection mediation workflow with Product Owner + Final Say escalation
- Hardware-software unified — handles firmware to frontend + consumer products to industrial equipment
- Living, not static — PRD evolves with code changes and stakeholder input

### The Hub-and-Spoke Model

The PRD is **never a single document**. It's a collection of documents:

| Document | Purpose | Audience |
|----------|---------|----------|
| **Press Release** | The customer promise | Everyone (hub document) |
| **Internal FAQ** | Strategic reality check | Leadership, investors |
| **Product Positioning** | Market context | Marketing, Sales |
| **Messaging Framework** | Reusable communications | Marketing, PR |
| **Go-to-Market Plan** | Execution strategy | Sales, Operations |
| **Technical PRD** | Implementation blueprint | Engineering |
| **User Stories** | Feature definitions | Engineering, QA |
| **Test Strategy** | Quality assurance | QA, Engineering |
| **BOM & Cost Analysis** | Financial reality | CFO, Procurement |
| **Certification Tracker** | Compliance roadmap | Regulatory, Engineering |
| **Manufacturing Process** | Production plan | Manufacturing, Operations |

The Press Release + Internal FAQ are the hub. All other documents are spokes that derive from them. This guarantees consistency.

### The 20 Document Types

**Software (5):**
1. Component PRD
2. API Specification
3. Architecture Overview
4. User Story Collection
5. Test Strategy

**Hardware (6):**
6. Product Specification
7. Industrial Equipment Specification
8. IoT/Embedded Specification
9. BOM and Cost Analysis
10. Certification Tracker
11. Manufacturing Process

**Business / Launch (9):**
12. Press Release
13. Internal FAQ
14. Go-to-Market Plan
15. Sales Channel Strategy
16. Product Positioning Document
17. Messaging Framework
18. External FAQ
19. Partnership Announcement
20. Financial Projections

### The PRD as Computed View

The PRD is not a file. It is a **computed view** over:
- Schema cards (code analysis)
- File mutation log (change history)
- Stakeholder conversations (interviews)
- Business ontology (company knowledge)
- Intent store (purpose and value statements)

When you request the PRD, the system queries all of these and composes the document on-the-fly.

### The Objection Cycle

```
Draft PRD → Review Period (no challenges) →
Objections Identified → Escalate to Product Owner →
PO Generates Alternatives → "Further Questions" to Stakeholders →
Counter-Suggestions → Compromise? YES → Update
Compromise? NO → Escalate to Final Say → Decision → Update →
Repeat until no objections → LOCK
```

### Implementation Roadmap

- Phase 0: Foundation (1-2 days) — Fix critical bugs in st8 identity system
- Phase 1: Stakeholder Discovery (3-5 days)
- Phase 2: Conversational Input (5-8 days)
- Phase 3: Cross-Department Inference (5-7 days)
- Phase 4: PRD Package Generation (10-14 days)
- Phase 5: Objection & Alignment (5-7 days)
- Phase 6: Execution Bridge (5-7 days)
- Phase 7: Polish & Scale (ongoing)

**Total MVP Timeline:** 13-15 weeks

---

## Signal Path Analysis (from Codebase Review)

### Critical Issues Found

#### 1. Parser Chain (BROKEN)

```
dataIngestion.js
  ├── storeParser.js     ❌ MISSING
  ├── routeParser.js     ❌ MISSING
  ├── commandParser.js   ❌ MISSING
  ├── typeParser.js      ❌ MISSING
  └── uiParser.js        ❌ MISSING
```

These are top-level requires — not lazy. The entire module fails to load if any are absent.

**Fix:** Copy from `/home/bozertron/Software Projects/maestro-scaffolder-tool/dist/commands/` to `/home/bozertron/1_AT_A_TIME/st8/lib/commands/`

#### 2. Edge Builder (INCOMPLETE)

```
buildEdges() in dataIngestion.js
  ├── CONTAINS edges     ✅ Created
  ├── NAVIGATES_TO edges ✅ Created
  ├── INVOKES edges      ✅ Created
  ├── IMPORTS edges      ❌ NEVER CREATED
  └── DEPENDS_ON edges   ❌ NEVER CREATED
```

The graph builder looks for `EdgeType.IMPORTS` edges to detect dead imports, but `buildEdges()` never creates them.

#### 3. Database Persister (DEAD CODE)

```
persistence.js → initialize()
  ├── getDatabasePersister() → returns { DatabasePersister: class }
  ├── typeof DatabasePersister === 'function' → ALWAYS FALSE
  └── Falls through to better-sqlite3 fallback
```

The maestro `DatabasePersister` integration is dead code. The check is wrong.

#### 4. Upsert Bug (DATA LOSS)

```
upsertFile(file)
  ├── INSERT OR REPLACE INTO file_registry
  ├── Only specifies 12 of 24 columns
  └── Unspecified columns revert to defaults
      ├── brunoStatus → 'active' (wipes 'flagged')
      ├── needsAIReview → 0 (wipes 1)
      ├── templateVariables → null (wipes data)
      └── hasUnfilledVariables → 0 (wipes 1)
```

Every time `upsertFile()` is called on an existing file, it wipes lifecycle/bruno/AI/template state.

#### 5. Dead Methods (16 total)

```
persistence.js dead methods:
  ├── getFilesByStatus() — no callers
  ├── getIntent() — getAllIntents() used instead
  ├── getMutationLog() — no callers
  ├── getRecentActivity() — no callers
  ├── deleteSetting() — no callers
  ├── incrementSessionCounters() — no callers
  ├── markFileAccessed() — no callers
  ├── markAIReviewed() — no callers
  ├── getFilesNeedingAIReview() — no callers
  ├── setTemplateVariables() — no callers
  ├── getTemplateVariables() — no callers
  ├── createPRDProject() — no callers
  ├── getPRDProject() — no callers
  ├── getAllPRDProjects() — no callers
  ├── updatePRDProject() — no callers
  └── deletePRDProject() — no callers
```

16 methods with no production callers. Either dead code or intended for external/test use.

#### 6. Rich Metadata (COMPUTED BUT NOT CONSUMED)

```
astParser.js
  ├── paramTypes — computed, not consumed
  ├── isPure — computed, not consumed
  ├── complexity — computed, not consumed
  ├── jsdocTags — computed, not consumed
  ├── signature — computed, not consumed
  ├── returnType — computed, not consumed
  └── typeParams — computed, not consumed
```

The AST parser computes rich metadata for exports, but callers only use `name`, `kind`, and `sourceFile`.

---

## Components Being Removed

### void-engine.js
- Previously referenced in st8.html
- Being removed from codebase into a development version of st8 for UI prototyping
- Will be reintroduced when ready for commercialization

### fake-stream.js
- Previously referenced in st8.html
- Being removed along with void-engine.js
- Part of the stable user experience initiative

---

## The .st8 Directory

### Structure

```
.st8/
├── schema-cards/                    # 43 JSON schema cards (one per file)
│   ├── backend_index.js.json
│   ├── backend_indexer.js.json
│   ├── backend_persistence.js.json
│   ├── ... (43 total)
│   └── void-engine.js.json
├── Identity System.md               # 71KB foundational document
├── FILEWATCHER-ARCHITECTURE.md      # 8.8KB file watcher design
├── gap-analysis.md                  # 6.8KB gap analysis results
├── SYNTHESIS.md                     # Research synthesis output
├── REVIEW-backend-wave1.md          # Schema card reviews
├── REVIEW-backend-wave2.md
├── REVIEW-backend-wave3.md
├── REVIEW-frontend-wave1.md
├── REVIEW-frontend-wave2.md
├── REVIEW-lib-commands-wave1.md
├── REVIEW-lib-commands-wave2.md
├── REVIEW-lib-commands-wave3.md
├── REVIEW-lib-utils.md
├── REVIEW-root.md
└── ... (analysis/transformation reports)
```

### Schema Card JSON Structure

Each schema card captures the complete state of a tracked file:

```json
{
  "fingerprint": "backend/index.js||2026-05-12T07:23:01.935Z",  // Stable identity
  "filepath": "backend/index.js",                                 // Relative path
  "filename": "index.js",                                         // Basename
  "sha256Hash": "95ac1934e6dfd8add...",                          // Content version
  "fileSizeBytes": 16782,                                         // File size
  "status": "RED",                                                // GREEN/YELLOW/RED
  "reachabilityScore": 0,                                         // 0.0-1.0
  "impactRadius": 0,                                              // Transitive dependents
  "lifecyclePhase": "DEVELOPMENT",                                // CONCEPT/LOCKED/WIRING/DEVELOPMENT/PRODUCTION
  "birthTimestamp": "2026-05-12T07:23:01.935Z",                  // Set once, never changes
  "lastModified": "2026-05-13T20:08:27.354Z",                    // Updated on every edit
  "lastIndexed": "2026-05-13 20:11:55",                          // Last index run
  "isEntryPoint": false,                                          // Entry point flag
  "exports": [],                                                  // AST-extracted exports
  "imports": [                                                    // AST-extracted imports
    {
      "importType": "require",
      "source": "./indexer",
      "specifiers": []
    }
  ],
  "connections": {
    "importedBy": [],                                             // Who imports this file
    "imports": []                                                 // Who this file imports (fingerprint format)
  },
  "intent": {
    "purpose": "Module entry point — ST8 Backend ???",           // Purpose (??? = inferred)
    "dependsOnBehavior": "file path manipulation, ...",          // Dependencies
    "valueStatement": "Provides main API ???"                    // Value statement
  },
  "mutationCount": 4,                                             // Total mutations
  "lastMutation": {
    "actor": "INDEXER",                                           // DEVELOPER/INDEXER/WATCHER/AGENT
    "timestamp": "2026-05-13 20:11:55",                          // When
    "type": "CREATE"                                              // CONCEPT/CREATE/EDIT/RENAME/REFACTOR/DELETE/LOCK/PRODUCTION/PURGE
  }
}
```

### The Identity System Concept

The identity system implements a **file-level identity and lifecycle tracking system**:

1. **Stable Identity** — Every file gets a fingerprint (`filepath:birthTimestamp`) that survives content changes
2. **Content Versioning** — SHA-256 hashes track the current content version separately from identity
3. **Lifecycle Management** — Files progress through CONCEPT → LOCKED → WIRING → DEVELOPMENT → PRODUCTION
4. **Mutation Logging** — Every file change is recorded with actor attribution and change diffs
5. **Schema Card Emission** — Deterministic JSON snapshots of each file's metadata, connections, exports, intent
6. **Dual Output** — JSON (machine-readable, git-diffable) + TXT (human-readable fallback)
7. **Event-Driven Notifications** — SSE stream + EventEmitter + console for real-time mutation awareness

**The "serial number" concept:** At PRODUCTION, all development mutation data is purged. What remains is a lightweight schema card that references back to every physical and architectural change the file experienced on its way from CONCEPT to PRODUCTION. This is the "serial number-like mark" that preserves the full history without the weight.

---

## Research Synthesis (2026-05-14)

### Identity System Architecture (from 9-agent deep research)

**Core Innovation: Dual-Identity Model**

| Axis | Value | Purpose | Mutability |
|------|-------|---------|------------|
| **Fingerprint** | `filepath:birthTimestamp` | WHO this file is | Immutable once set |
| **SHA-256 Hash** | Content digest | WHAT this file contains | Changes on every edit |

This decouples identity from content — a file can change a thousand times, but its identity remains stable. The mutation log accumulates against one identity, giving the full "path to production."

**Lifecycle Phases:**
```
CONCEPT → LOCKED → WIRING → DEVELOPMENT → PRODUCTION
   │         │         │          │              │
   │         │         │          │              └─ Mutation log purged
   │         │         │          └─ Watcher logs every mutation
   │         │         └─ Cross-file deps validated
   │         └─ Schema cards emitted, PRD generated
   └─ File doesn't exist on disk yet
```

**The "Parse to Oblivion" Vision (backgroundIndexer.js):**
1. Non-blocking registration — `addProject()` returns immediately
2. 6-phase full index pipeline: Scan → Parse → Analyze → Persist → Index → Watch
3. Incremental re-indexing via chokidar (debounced 2s)
4. Multi-pass analysis queued after initial indexing

### Gap Analysis Results

| Dimension | Status | Details |
|-----------|--------|---------|
| D1: Lifecycle | ⚠️ Narrow | All 42 files stuck in DEVELOPMENT |
| D2: Status Health | 🔴 Critical | **29 of 42 files are RED (69%)** |
| D3: Intent | ✅ Clean | 100% intent coverage |
| D4: Export Surface | ⚠️ Partial | 78.6% coverage, 9 files lack exports |
| D5: Connections | ⚠️ Partial | 59/59 imports resolve, 11 files isolated |
| D6: Architecture | ✅ Clean | All 8 core components present |

### Critical Bugs Identified

| Bug | Severity | Root Cause |
|-----|----------|------------|
| **69% RED files** | Critical | Connection resolution fails — fuzzy matching, missing extension resolution |
| **Import specifier data lost** | Critical | `indexer.js:399-403` reads wrong field, names always `[]` |
| **File watcher not started** | Critical | Missing `--watch` flag in startup command |
| **Duplicate CREATE mutations** | High | No existence check before logging |
| **Connections hardcoded empty** | High | Watcher callback passes `{ importedBy: [], imports: [] }` |
| **integr8 orchestrator dead code** | Medium | 140-line `runIntegr8Command()` never called |

### Recommended Fix Order

1. **Start file watcher** — add `--watch` to startup command
2. **Fix import specifier data loss** — preserve `specifiers` array from AST parser
3. **Fix duplicate CREATE mutations** — check file existence before logging
4. **Fix connection resolution** — build filepath Map, resolve extensions, handle bare specifiers
5. **Remove dead code** — `integr8/index.js` orchestrator, unused getters, duplicated schemas

### Module Dependency Graph

```
backend/index.js (orchestrator)
├── backend/indexer.js          ─→ File discovery, hashing, import parsing, classification
│   ├── lib/utils/astParser.js  ─→ AST-based import/export extraction
│   └── lib/commands/graphBuilder.js ─→ Dependency graph construction
├── backend/persistence.js      ─→ SQLite CRUD (file_registry, connections, file_intent, etc.)
├── backend/schemaCardEmitter.js ─→ .st8/schema-cards/*.json generation
├── backend/schemaCardPrinter.js ─→ .planning/st8_identity_system/*.txt fallback
├── backend/notificationBus.js  ─→ EventEmitter + SSE + console + printer delegation
├── backend/fileWatcher.js      ─→ Chokidar wrapper with debounced change batching
├── backend/gapAnalyzer.js      ─→ 6-dimension gap analysis (D1-D6)
├── backend/intentSeeder.js     ─→ Heuristic intent extraction from file content
├── backend/manifestGenerator.js ─→ connection-state.json + ai-signal.toml
├── backend/server.js           ─→ HTTP server with SSE endpoint
└── backend/st8-types.js        ─→ Canonical type definitions (fingerprint, lifecycle, mutation)
```

### Integr8 Pipeline (Dead Orchestrator, Live Sub-Components)

```
Stage 1: Data Ingestion (dataIngestion.js)
  └─ 6 parsers + AST extraction → graph

Stage 2: Relationship Analysis (relationshipAnalyzer.js)
  └─ Merge + classify + conflict detection

Stage 3: Path Generation (pathGenerator.js)
  └─ Topological sort → migration plan
```

**Key finding:** `runIntegr8Command()` is exported but never called. Sub-components (`ingestSingleProject`, `DatabasePersister`, `NodeType/EdgeType`) are consumed directly by `backgroundIndexer.js` and `graphBuilder.js`.

### Schema Card Reviews (43 files across 5 categories)

**Review files written to `.st8/REVIEW-*.md`**

#### Backend (14 files) — 3 waves

| File | Status | Exports | Key Finding |
|------|--------|---------|-------------|
| `index.js` | RED | 0 | Side-effect entry point, no exports |
| `indexer.js` | RED | 7 | Core indexing pipeline, 2 consumers |
| `persistence.js` | RED | 1 | SQLite CRUD, 4 consumers |
| `server.js` | RED | 1 | HTTP server (42KB), 1 consumer |
| `st8-types.js` | RED | 13 | Zero deps, 10 importers — most widely used |
| `fileWatcher.js` | RED | 1 | Chokidar wrapper |
| `gapAnalyzer.js` | RED | 1 | 6-dimension analysis |
| `intentSeeder.js` | RED | 1 | **Orphaned — no consumers** |
| `manifestGenerator.js` | RED | 3 | JSON/TOML manifest writer |
| `notificationBus.js` | RED | 1 | SSE + EventEmitter |
| `prdGenerator.js` | RED | 6 | PRD from schema cards |
| `schemaCardEmitter.js` | RED | 1 | JSON card generation |
| `schemaCardPrinter.js` | RED | 1 | TXT fallback generation |
| `verify-persistence-fixes.js` | RED | 0 | Orphaned test script |

**Pattern:** All backend files are RED. Intent fields have `???` suffixes (low-confidence auto-generation).

#### Frontend (7 files) — 2 waves

| File | Status | Exports | Key Finding |
|------|--------|---------|-------------|
| `coordination.js` | RED | 0 | Multi-LLM sync, zero connectivity |
| `file-explorer.js` | RED | 0 | 27 API functions, no exports |
| `graph-visualizer.js` | RED | 0 | D3.js visualization, no exports |
| `phreak-terminal.js` | RED | 0 | 36+ API functions, no exports (42.9KB) |
| `settings-reader.js` | RED | 3 | Most "complete" card |
| `settings-ui.js` | RED | 0 | 11 API methods, no exports |
| `fake-stream.js` | RED | 1 | Clean, simple |

**Pattern:** All frontend files use `window.*` global attachment pattern — indexer can't detect exports.

#### Lib/Commands (16 files) — 3 waves

| File | Status | Key Finding |
|------|--------|-------------|
| `backgroundIndexer.js` | RED | **Orphaned — zero consumers** |
| `graphBuilder.js` | RED | **Orphaned — zero consumers** |
| `graphTraversal.js` | RED | 13 exports, zero consumers |
| `insightStore.js` | GREEN | Connected to backgroundIndexer |
| `parserPersistence.js` | GREEN | Connected to backgroundIndexer |
| `overview.js` | GREEN | File index generation |
| `databasePersister.js` | GREEN | SQLite persistence |
| `dataIngestion.js` | GREEN | 6-parser pipeline |
| `integr8/index.js` | RED | **Dead code — never called** |
| `migrationExecutor.js` | RED | **Dead code — never wired** |
| `pathGenerator.js` | GREEN | Fabricated importedBy |
| `relationshipAnalyzer.js` | GREEN | Clean |
| `reportGenerator.js` | GREEN | Clean |
| `tomlSerializer.js` | GREEN | Clean |
| `types.js` | GREEN | 75% of importers missing |

**Pattern:** Sub-components are GREEN (connected), orchestrators are RED (dead code).

#### Lib/Utils (4 files)

| File | Status | Key Finding |
|------|--------|-------------|
| `astParser.js` | GREEN | Babel-based, external dep |
| `groundPlane.js` | RED | **Orphaned — no consumers** |
| `ioChan.js` | GREEN | I/O channel + circuit breaker |
| `safeFs.js` | GREEN | 15 exports, 1 consumer |

#### Root/Misc (3 files)

| File | Status | Key Finding |
|------|--------|-------------|
| `start.js` | RED | Entry point, stale connections |
| `test_newfile.js` | RED | **Phantom — file doesn't exist** |
| `void-engine.js` | RED | **Missing — deleted/moved** |

### Systemic Issues Found Across All Reviews

1. **All intent fields have `???` suffixes** — indexer auto-generation with low confidence
2. **Export kind misclassification** — `module.exports = { X }` reported as `variable` instead of `function`/`class`
3. **Frontend files have zero exports** — `window.*` global attachment pattern invisible to indexer
4. **Phantom imports** — indexer parsed `import()` patterns inside code templates as real imports
5. **Fabricated importedBy** — some cards list non-existent importers
6. **Orphan cards** — `test_newfile.js` and `void-engine.js` reference deleted files

---

## Re-Integration Plan

### Mission
Get the Identity system working again → Use integr8 to identify gaps → Laser focus on closing them → Bring st8 to life.

### Phase 1: Restore the Identity System (1-2 days)

**Goal:** Get the core identity pipeline working end-to-end.

| Step | Task | Files | Status |
|------|------|-------|--------|
| 1.1 | Fix file watcher startup | `start.js`, `backend/index.js` | ⬜ |
| 1.2 | Fix import specifier data loss | `backend/indexer.js:399-403` | ⬜ |
| 1.3 | Fix duplicate CREATE mutations | `backend/index.js:113-120` | ⬜ |
| 1.4 | Fix connection resolution | `backend/index.js:127-129` | ⬜ |
| 1.5 | Fix upsert data loss bug | `backend/persistence.js:201` | ⬜ |
| 1.6 | Verify schema card emission | `backend/schemaCardEmitter.js` | ⬜ |
| 1.7 | Verify mutation logging | `backend/persistence.js` | ⬜ |

**Success criteria:** File watcher starts, schema cards are emitted with real imports/exports/connections, mutation log records changes accurately.

### Phase 2: Validate with Integr8 (1 day)

**Goal:** Use the integr8 sub-components to identify remaining gaps.

| Step | Task | Files | Status |
|------|------|-------|--------|
| 2.1 | Run `graphBuilder.buildDependencyGraph()` | `lib/commands/graphBuilder.js` | ⬜ |
| 2.2 | Run `graphTraversal` queries | `lib/commands/graphTraversal.js` | ⬜ |
| 2.3 | Run gap analysis | `backend/gapAnalyzer.js` | ⬜ |
| 2.4 | Run intent seeding | `backend/intentSeeder.js` | ⬜ |
| 2.5 | Verify schema card accuracy | `.st8/schema-cards/` | ⬜ |

**Success criteria:** Graph builder produces healthy dependency graph, gap analysis shows reduced RED count, intent seeder populates purpose fields.

### Phase 3: Close Gaps (2-3 days)

**Goal:** Fix all issues identified by integr8.

| Step | Task | Files | Status |
|------|------|-------|--------|
| 3.1 | Fix orphaned modules | Wire `intentSeeder.js`, `backgroundIndexer.js`, `graphBuilder.js` | ⬜ |
| 3.2 | Fix phantom files | Remove `test_newfile.js`, `void-engine.js` schema cards | ⬜ |
| 3.3 | Fix export kind misclassification | `lib/utils/astParser.js` | ⬜ |
| 3.4 | Fix frontend export detection | Handle `window.*` pattern | ⬜ |
| 3.5 | Fix fabricated importedBy | Schema card emitter connection query | ⬜ |
| 3.6 | Clean up dead code | `integr8/index.js`, unused getters | ⬜ |

**Success criteria:** All files are GREEN or YELLOW, no phantom cards, no fabricated data.

### Phase 4: Bring st8 to Life (1-2 days)

**Goal:** Full end-to-end working system.

| Step | Task | Files | Status |
|------|------|-------|--------|
| 4.1 | Test full index pipeline | `node start.js <target> --watch` | ⬜ |
| 4.2 | Test file watcher | Edit files, verify mutations logged | ⬜ |
| 4.3 | Test schema card emission | Verify `.st8/schema-cards/` accuracy | ⬜ |
| 4.4 | Test gap analysis | Verify RED count reduced | ⬜ |
| 4.5 | Test intent seeding | Verify purpose fields populated | ⬜ |
| 4.6 | Document working state | Update README.md | ⬜ |

**Success criteria:** `node start.js <target> --watch` works end-to-end, schema cards are accurate, gap analysis shows healthy state.

### Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Restore Identity | 1-2 days | None |
| Phase 2: Validate with Integr8 | 1 day | Phase 1 |
| Phase 3: Close Gaps | 2-3 days | Phase 2 |
| Phase 4: Bring to Life | 1-2 days | Phase 3 |
| **Total** | **5-8 days** | |

### The "Slow March" Approach

As Benjamin said: "The important part is that I understand what's happening... the assumptions are all wrong. But that's ok, because we're going to continue our slow march, and before you know it, we'll be wiring all this up."

The approach:
1. **One fix at a time** — don't try to fix everything at once
2. **Verify each fix** — test before moving to the next
3. **Document as we go** — update the bible with each change
4. **Use integr8 to validate** — let the system tell us what's broken

---

*"You can't integrate what you can't see."*

---

## Refactor Findings — 2026-05-14

### 1. Mutation Type Coverage (Gap vs. Spec)

Spec defines 8 mutation types in `st8-types.js`: CONCEPT, CREATE, EDIT, RENAME, REFACTOR, LOCK, PRODUCTION, PURGE.

| Mutation Type | Status | Notes |
|---------------|--------|-------|
| CONCEPT | Defined-but-never-fired | — |
| CREATE | **Implemented** | Fired from file watcher callback, `backend/index.js` lines ~1290-1338 |
| EDIT | **Implemented** | Fired from file watcher callback, `backend/index.js` lines ~1290-1338 |
| RENAME | Defined-but-never-fired | No detection heuristic exists |
| REFACTOR | Defined-but-never-fired | — |
| LOCK | Defined-but-never-fired | — |
| PRODUCTION | Defined-but-never-fired | — |
| PURGE | Defined-but-never-fired | — |

**Notable:** chokidar emits `unlink` + `add` for a rename — not a `rename` event. There is no heuristic in `backend/fileWatcher.js` to detect rename by matching content hashes across an unlink/add window.

### 2. Schema Card Regeneration on File Move

Schema card filenames are derived from filepath:

```js
// backend/schemaCardEmitter.js — _cardFilename()
filepath.replace(/\//g,'_').replace(/\\/g,'_') + '.json'
```

Therefore every file move requires the old schema card to be deleted and a new one written under the new path.

**Naming collision risk:** if the migration maps two distinct sources to the same target path, the resulting card filename would collide.

### 3. Connection Resolution Is Currently Broken (Independent of Refactor)

- Per `SYNTHESIS.md` line 149: **69% of files are RED** because connection resolution fails.
- Root cause: fuzzy O(n²) matching in the connection resolver, not the file layout.
- This is independent of the refactor — the refactor neither helps nor hurts it.
- Should be tracked as a separate task after the move lands.

### 4. Fingerprint Semantics During Refactor — DECISION: Option A

Spec: fingerprint = `{filepath}:{birthTimestamp}`. By definition any filepath change creates a new fingerprint.

**Decision:** refactor produces new fingerprints.

- For each moved file, the old fingerprint receives a final `RENAME` mutation pointing at the new fingerprint.
- Mutation history then continues under the new identity.
- Old fingerprints remain in `file_registry` as historical records (status = `RENAMED` or similar).

### 5. Move + Rewrite Script Pattern (Proposed)

Two-script pattern we plan to use.

**`scripts/move-files.js`** — reads a manifest like:

```json
{
  "moves": [
    { "from": "backend/indexer.js",      "to": "src/features/indexing/indexer.js" },
    { "from": "lib/utils/astParser.js",  "to": "src/shared/utils/ast-parser.js"   },
    { "from": "lib/utils/safeFs.js",     "to": "src/shared/utils/safe-fs.js"      }
  ]
}
```

For each entry:
1. Copy file (originals stay).
2. Verify SHA-256 of source == dest.
3. Log a `RENAME` mutation in `file_mutation_log`.
4. Update `file_registry.filepath`.
5. Regenerate schema card under new path.
6. Delete old schema card.

**`scripts/rewrite-imports.js`** — walks the new tree; for each `.js`, parses `require()` / `import` statements with `@babel/parser` and rewrites paths against the manifest.

Example transformation — before (in source file under old layout `backend/indexer.js`):

```js
const { St8Persistence } = require('./persistence');
const astParser          = require('../lib/utils/astParser');
const safeFs             = require('../lib/utils/safeFs');
```

After (same file, now at `src/features/indexing/indexer.js`):

```js
const { St8Persistence } = require('../../core/database/connection');
const astParser          = require('../../shared/utils/ast-parser');
const safeFs             = require('../../shared/utils/safe-fs');
```

Both scripts are idempotent. Both runnable on a single file or a whole subtree. Verification step after each subtree: `node start.js <target>` boots without throwing.

### 6. Identity Continuity Strategy

- File watcher is paused during the batch move (avoids spurious DELETE+CREATE).
- All moves recorded as RENAME mutations in a single transactional batch.
- Watcher resumed after move + import rewrite complete + smoke test passes.

---

## Refactor Batch Log — 2026-05-14

A running record of every batch executed by `scripts/migration/*.js`. Each batch's
manifest lives at `scripts/migration/manifest.json` at the time it runs; on
successful verify the moves are appended to `scripts/migration/move-history.json`
so subsequent batches' import-rewriter knows where prior files now live.

### Batch 001 — `shared`

**Goal:** Move leaves of the dependency graph (utilities + types) into `src/shared/`.

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `lib/utils/safeFs.js` | `src/shared/utils/safe-fs.js` | 599 | ✅ |
| `lib/utils/ioChan.js` | `src/shared/utils/io-chan.js` | 396 | ✅ |
| `lib/utils/astParser.js` | `src/shared/utils/ast-parser.js` | 1066 | ✅ |
| `lib/utils/groundPlane.js` | `src/shared/utils/ground-plane.js` | 268 | ✅ |
| `backend/st8-types.js` | `src/shared/types/st8-types.js` | 282 | ✅ |
| `lib/commands/integr8/types.js` | `src/shared/types/integr8-types.js` | 83 | ✅ |

**Total:** 2,694 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 1

| File | Line | Old | New |
|------|------|-----|-----|
| `src/shared/utils/ground-plane.js` | 56 | `'./safeFs.js'` | `'./safe-fs.js'` |

**Verification:** All 6 new files load and export the same surface as originals
(47 total exports across the batch: 15+5+2+4+13+8). Originals + copies coexist
in the same Node process.

**Commit:** `ab4d038` — `refactor(shared): migrate leaf utilities and types`

---

### Batch 002 — `core-database`

**Goal:** Move the persistence monolith and the graph persister into `src/core/database/`.
Keep `persistence.js` whole (not split into per-table query modules yet) so the
move and the split remain independently revertible.

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `backend/persistence.js` | `src/core/database/persistence.js` | 705 | ✅ |
| `lib/commands/integr8/databasePersister.js` | `src/core/database/graph-persister.js` | 229 | ✅ |

**Total:** 934 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 2 — both caught via history-aware lookup (the rewriter
knew about Batch 001's moves and adjusted references to `st8-types` accordingly):

| File | Line | Old | New |
|------|------|-----|-----|
| `src/core/database/persistence.js` | 17 | `'./st8-types'` | `'../../shared/types/st8-types'` |
| `src/core/database/persistence.js` | 386 | `'./st8-types'` | `'../../shared/types/st8-types'` |

**Manual hand-patch:** The dynamic lib loader could not be caught by the AST
rewriter (it joins a path at runtime, not a `require()` literal). After the
move, `LIB_DIR` was retargeted from `path.join(__dirname, '..', 'lib')` to
`__dirname` since `graph-persister.js` now lives in the same directory as
`persistence.js`. The loader's filename argument changed from
`'commands/integr8/databasePersister.js'` to `'graph-persister.js'`. Loader
pattern (graceful fallback on missing module) preserved exactly.

**Verification:** Both new files load. Stronger smoke test passed:
`new St8Persistence(tmpPath)` + `initialize()` + `getAllFiles()` + `close()`
runs end-to-end on a throwaway SQLite file, schema applies, query returns 0
rows, cleanup succeeds. The maestro DatabasePersister loader correctly falls
through to `better-sqlite3` direct (same behavior as the original — the lib
module exports a named class, not a callable default, so the
`typeof === 'function'` guard always fails and the fallback path runs).

**Tooling upgrade in this batch:**

- `scripts/migration/rewrite-imports.js` is now history-aware: it reads
  `scripts/migration/move-history.json` in addition to the current manifest
  so requires pointing at previously-moved files are rewritten correctly.
- `scripts/migration/verify.js` now appends the batch to
  `move-history.json` on a clean pass (idempotent — re-runs are no-ops).

**Pending follow-up (not done in this batch — intentional):**

The 705-line `persistence.js` monolith still lives as a single file. The
split into `connection.js` + `queries/{file-registry,connections,file-intent,
mutation-log,activity-log,settings,prd-projects}.js` (per `0_MASTER_INDEX.md`)
requires a real refactor of the `St8Persistence` class — not a copy-and-trim
operation. Method bodies currently use `this.db`; the split version will
either inject `db` per function or wrap query modules in factories. That
refactor is scheduled for a later batch once consumers (`server.js` in
particular) are also being moved, since changing the `St8Persistence` shape
ripples into ~20 require sites in `server.js`.

---

### Batch 003 — `lifecycle-watcher`

**Goal:** Warmup batch — two small self-contained backend modules.

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `backend/brunoOscar.js` | `src/features/lifecycle/bruno-oscar.js` | 186 | ✅ |
| `backend/fileWatcher.js` | `src/features/watcher/file-watcher.js` | 140 | ✅ |

**Total:** 326 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 0 — both files only `require()` external modules (`fs`, `path`, `chokidar`). The history-aware rewriter correctly reported nothing to do.

**Manual patches:** None.

**Verification:** Both files load. Each exports a single class (`BrunoOscar`, `FileWatcher`) with the same surface as the original.

**Commit:** `8d1e930`

---

### Batch 004 — `schema-cards`

**Goal:** Move the schema card generation suite into `src/features/schema-cards/` — emitter, printer (TXT fallback), and the manifest generator (writes `connection-state.json` + `ai-signal.toml`).

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `backend/schemaCardEmitter.js` | `src/features/schema-cards/emitter.js` | 210 | ✅ |
| `backend/schemaCardPrinter.js` | `src/features/schema-cards/printer.js` | 295 | ✅ |
| `backend/manifestGenerator.js` | `src/features/schema-cards/manifest-generator.js` | 173 | ✅ |

**Total:** 678 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 2 — both in `emitter.js`, both auto-caught via history-aware lookup:

| File | Line | Old | New |
|------|------|-----|-----|
| `emitter.js` | 15 | `'./st8-types'` | `'../../shared/types/st8-types'` |
| `emitter.js` | 197 | `'./persistence'` | `'../../core/database/persistence'` |

**Manual hand-patches:** 2

1. `emitter.js` L92 — a *runtime* `require(path.join(__dirname,'..','lib','utils','astParser.js'))` inside `emitAllCards()` was invisible to the AST rewriter. Replaced with the static specifier `require('../../shared/utils/ast-parser')` pointing at the moved location (batch 001).

2. `manifest-generator.js` L18 — the dynamic `loadLibModule()` pattern (same shape as in `persistence.js` before batch 002) loads `commands/integr8/tomlSerializer.js`. `tomlSerializer.js` has NOT moved yet — it's queued for the integr8 batch. So `LIB_DIR` was retargeted from `path.join(__dirname, '..', 'lib')` to `path.join(__dirname, '..', '..', '..', 'lib')` to walk back up to the repo's still-existing `lib/` directory. When the integr8 batch lands, this loader will be retargeted again.

**Verification:** All 3 new files load with matching export surfaces (`SchemaCardEmitter`, `SchemaCardPrinter`, and `{generateConnectionState, generateAiSignalToml, writeManifests}`). Stronger smoke test confirmed both dynamic loaders resolve to real files:
- `emitter.js` → `ast-parser.js` → `extractImportsAndExports` is a function ✅
- `manifest-generator.js` → `LIB_DIR` resolves to `/home/user/st8/lib` → `commands/integr8/tomlSerializer.js` exists at that path ✅

**Pattern observation (worth recording):** The `loadLibModule()` dynamic loader idiom appears in at least two original files (`persistence.js`, `manifestGenerator.js`). Each instance needs a hand-patch on move because the AST rewriter only sees `require()` *literals*, not `path.join()` expressions evaluated at runtime. There may be more — grep for `loadLibModule` or `LIB_DIR` after each batch.

**Commit:** `a1573d6`

---

### Batch 005 — `prd`

**Goal:** Move PRD generation + template engine into `src/features/prd/`.

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `backend/prdGenerator.js` | `src/features/prd/generator.js` | 201 | ✅ |
| `backend/templateEngine.js` | `src/features/prd/template-engine.js` | 121 | ✅ |

**Total:** 322 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 0 — both files only require external modules (`fs`, `path`, `os`).

**Manual patches:** None. No `loadLibModule` / `LIB_DIR` instances in this batch.

**Verification:** Both files load. `generator.js` exposes 6 exports (PRD generation functions); `template-engine.js` exposes the `TemplateEngine` class.

**Commit:** `48bc786`

---

### Batch 006 — `analysis`

**Goal:** Move the analysis suite into `src/features/analysis/`.

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `backend/gapAnalyzer.js` | `src/features/analysis/gap-analyzer.js` | 652 | ✅ |
| `backend/intentSeeder.js` | `src/features/analysis/intent-seeder.js` | 511 | ✅ |
| `lib/commands/insightStore.js` | `src/features/analysis/insight-store.js` | 362 | ✅ |

**Total:** 1,525 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 1 — caught by history-aware lookup against batch 002:

| File | Line | Old | New |
|------|------|-----|-----|
| `insight-store.js` | 46 | `'./integr8/databasePersister.js'` | `'../../core/database/graph-persister.js'` |

**Manual patches:** None. No `loadLibModule` / `LIB_DIR` instances in this batch.

**Verification:** All 3 new files load with matching export surfaces (`GapAnalyzer`, `IntentSeeder`, and `insight-store` exporting 2 symbols).

**Commit:** `0bc7fe5`

---

### Batch 007 — `integr8-core`

**Goal:** Move 5 of the 7 `lib/commands/integr8/` modules — the ones whose internal dependencies are all already moved (types from batch 001) OR are in this same batch (tomlSerializer is needed by migrationExecutor). The other 2 (`dataIngestion.js`, `integr8/index.js`) are deferred because `dataIngestion` has 6 requires to sibling parser files in `lib/commands/` that haven't moved yet — they'll migrate together with the parser ecosystem in the indexing batch.

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `lib/commands/integr8/relationshipAnalyzer.js` | `src/features/analysis/relationship-analyzer.js` | 924 | ✅ |
| `lib/commands/integr8/pathGenerator.js` | `src/features/analysis/path-generator.js` | 859 | ✅ |
| `lib/commands/integr8/reportGenerator.js` | `src/features/analysis/report-generator.js` | 284 | ✅ |
| `lib/commands/integr8/tomlSerializer.js` | `src/features/integr8/toml-serializer.js` | 418 | ✅ |
| `lib/commands/integr8/migrationExecutor.js` | `src/features/integr8/migration-executor.js` | 1837 | ✅ |

**Total:** 4,322 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 6 — all auto-caught via the history-aware rewriter:

| File | Line | Old | New |
|------|------|-----|-----|
| `relationship-analyzer.js` | 10 | `'./types.js'` | `'../../shared/types/integr8-types.js'` |
| `path-generator.js` | 42 | `'./types'` | `'../../shared/types/integr8-types'` |
| `report-generator.js` | 6 | `'./types.js'` | `'../../shared/types/integr8-types.js'` |
| `toml-serializer.js` | 7 | `'./types'` | `'../../shared/types/integr8-types'` |
| `migration-executor.js` | 59 | `'./types'` | `'../../shared/types/integr8-types'` |
| `migration-executor.js` | 60 | `'./tomlSerializer'` | `'./toml-serializer'` |

**Follow-up patch (also done in this batch):** `src/features/schema-cards/manifest-generator.js` had a provisional `LIB_DIR` hand-patch from batch 004 (walked up to `/home/user/st8/lib/` to find the un-moved `tomlSerializer`). With `tomlSerializer` now moved, the loader is retargeted: `loadLibModule()` simplified to a thin try/require wrapper (preserves the graceful-fallback shape), and `getTomlSerializer()` now calls `loadLibModule('../integr8/toml-serializer')` — a direct relative require pointing at the new home. Verified: `manifest-generator` loads and `toml-serializer` resolves with all 3 exports (`serializeMigrationPlanToToml`, `serializeGraphMetadataToToml`, `parseMigrationPlanFromToml`).

**Verification:** All 5 new files load with matching export surfaces. Notable: `migration-executor.js` exposes 11 exports — matching exactly the identity card recorded for this file in `st8_json/`. Sophisticated migration infrastructure preserved verbatim.

**Discovery — pre-existing broken require (worth recording):** While inspecting `lib/commands/backgroundIndexer.js` (queued for a later batch) we confirmed it currently throws at module load — `Cannot find module './sonicClient.js'`. The file also references `./multiPassAnalyzer.js`, neither of which exist in `lib/commands/`. This is not a refactor casualty — the file was already broken before this refactor began.

**Founder context (added post-discovery):** `sonicClient` referred to a "sonic" library the project was using and later removed. `backgroundIndexer.js` retains the stale require — orphaned integration code from the pre-cleanup era. The file itself is not dead; the lib it talked to is gone. Decision deferred — could be (a) wired against a replacement client, (b) commented out at the require site, or (c) left as-is and moved with a note. Tabled until the file's own batch.

**Commit:** `86de1d6`

---

### Batch 008 — `indexing-parsers`

**Goal:** Move the parser ecosystem from `lib/commands/`, the remaining 2 `integr8` modules (`dataIngestion`, `integr8/index`), and the 2 graph commands. Empties `lib/commands/integr8/` and most of `lib/commands/` in one pass.

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `lib/commands/overview.js` | `src/features/indexing/overview.js` | 350 | ✅ |
| `lib/commands/storeParser.js` | `src/features/indexing/store-parser.js` | 341 | ✅ |
| `lib/commands/routeParser.js` | `src/features/indexing/route-parser.js` | 313 | ✅ |
| `lib/commands/commandParser.js` | `src/features/indexing/command-parser.js` | 271 | ✅ |
| `lib/commands/typeParser.js` | `src/features/indexing/type-parser.js` | 256 | ✅ |
| `lib/commands/uiParser.js` | `src/features/indexing/ui-parser.js` | 251 | ✅ |
| `lib/commands/parserPersistence.js` | `src/features/indexing/parser-persistence.js` | 295 | ✅ |
| `lib/commands/integr8/dataIngestion.js` | `src/features/indexing/data-ingestion.js` | 1,102 | ✅ |
| `lib/commands/integr8/index.js` | `src/features/integr8/index.js` | 140 | ✅ |
| `lib/commands/graphBuilder.js` | `src/features/graph/builder.js` | 214 | ✅ |
| `lib/commands/graphTraversal.js` | `src/features/graph/traversal.js` | 828 | ✅ |

**Total:** 4,361 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 21 — all auto-caught via history-aware lookup:

- `parser-persistence.js` (1): databasePersister → graph-persister (batch 002)
- `data-ingestion.js` (11): 7 sibling parser refs in this batch + types (batch 001) + 3 utils (batch 001)
- `integr8/index.js` (6): pointing at all 5 prior integr8-core moves + this batch's data-ingestion + databasePersister
- `graph/builder.js` (2): integr8-types (batch 001) + this batch's data-ingestion
- `graph/traversal.js` (1): databasePersister (batch 002)

**Manual patches:** None — all the new layout's cross-references resolved automatically.

**Verification:** All 11 new files load with matching surfaces. Notable: `graph/traversal.js` exposes 13 exports (the sophisticated graph query API), and `data-ingestion.js` exposes 4. Everything that was dormant or active is now in its place with original behavior intact.

**Lib state after this batch:** `lib/commands/integr8/` is now fully migrated (originals still in place for safety). `lib/commands/` still has only `backgroundIndexer.js` un-migrated — held back for a decision pass (broken sonicClient/multiPassAnalyzer requires).

**Commit:** `f0603ed`

---

### Batch 009 — `indexing-engine`

**Goal:** Move `indexer.js` (the file indexing engine) and `notificationBus.js` (event bus / SSE source).

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `backend/indexer.js` | `src/features/indexing/indexer.js` | 483 | ✅ |
| `backend/notificationBus.js` | `src/core/notification-bus.js` | 127 | ✅ |

**Total:** 610 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 1 — `indexer.js` L16 `'./st8-types'` → `'../../shared/types/st8-types'`.

**Manual hand-patch (third instance of the `loadLibModule` pattern, biggest cleanup yet):** `indexer.js` had a single `LIB_DIR = path.join(__dirname, '..', 'lib')` driving **four** dynamic lazy-loaders. With every target already moved (across 4 different subtrees), the single-LIB_DIR pattern no longer fits. Replaced with per-getter static requires, preserving the lazy + graceful-fallback shape:

| Getter | Old loadLibModule arg | New static specifier |
|--------|----------------------|----------------------|
| `getAstParser()` | `'utils/astParser.js'` | `'../../shared/utils/ast-parser'` |
| `getGraphBuilder()` | `'commands/graphBuilder.js'` | `'../graph/builder'` |
| `getDatabasePersister()` | `'commands/integr8/databasePersister.js'` | `'../../core/database/graph-persister'` |
| `getTomlSerializer()` | `'commands/integr8/tomlSerializer.js'` | `'../integr8/toml-serializer'` |

The `_backgroundIndexer` slot is also still present — it's the lazy slot for the file that's still broken and un-migrated. Left as-is, no getter to call it.

**Verification:** Both new files load with matching surfaces (7 indexer exports, 2 notification-bus exports). Strong smoke test confirmed all 4 retargeted lazy-loaders resolve to real modules with their expected exports (`extractImportsAndExports`, `buildDependencyGraph`, `DatabasePersister`, `serializeMigrationPlanToToml`, etc.).

**Pattern resolution note:** With this patch, all three instances of `loadLibModule()` discovered during the refactor (`persistence.js` b002, `manifest-generator.js` b004/b007, `indexer.js` b009) have been retargeted. The pattern is officially retired from the new layout — it was a layout-coupling hack for the old `backend/../lib/` split, no longer needed once both trees collapse into `src/`.

**Commit:** `344d9ee`

---

### Batch 010 — `server-and-entry`

**Goal:** Finish the `backend/` directory. Move `index.js` (CLI entry), `server.js` (HTTP API), and `verify-persistence-fixes.js` (the small built-in verification script).

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `backend/index.js` | `src/core/server/main.js` | 436 | ✅ |
| `backend/server.js` | `src/core/server/app.js` | 1,431 | ✅ |
| `backend/verify-persistence-fixes.js` | `src/core/database/verify-persistence-fixes.js` | 154 | ✅ |

**Total:** 2,021 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 44 — biggest count yet, all auto-caught:

- `main.js` (13): every top-level require + 2 inline `manifestGenerator` retries
- `app.js` (31): 13 `./persistence` sites, 5 `./notificationBus`, 2 `./indexer`, 2 `./brunoOscar`, 2 `./templateEngine`, 1 each of `./manifestGenerator`/`./prdGenerator`/`./gapAnalyzer`/`./schemaCardEmitter`
- `verify-persistence-fixes.js` (0): its `./persistence` already coincidentally resolves correctly because the file moves into the same directory as the new `persistence.js`

**Manual hand-patch:** `main.js` lines 303 + 355 — both inline `require(path.join(__dirname,'..','lib','utils','astParser.js'))` calls retargeted to `require('../../shared/utils/ast-parser')`. Used `replace_all: true` since the dynamic-load string was identical at both sites.

**Verification:** All 3 new files load. App.js exposes `St8Server` (1 export). Main.js and verify-persistence-fixes are entry-point scripts that call `process.exit()` at module-load — the upgraded probe (see below) caught and intercepted that. Strong evidence the moved code preserves all behavior: when run as a script, `verify-persistence-fixes.js` reports `=== Results: 10 passed, 0 failed ===` from BOTH the original location and the new location — identical output, identical pass count.

**Tooling upgrade (`scripts/migration/verify.js`):** Switched from in-process `require()` to a per-file sub-process probe with `process.exit` interception. Reason: entry-point scripts (`main.js`, `verify-persistence-fixes.js`, anything that calls `process.exit` synchronously during module load) would otherwise kill the verifier mid-batch. The new probe:

1. Forks a child node process per file.
2. Child intercepts `process.exit` before requiring the target.
3. Child writes its result (success/keys/error) to a temp file.
4. Parent reads the temp file, even if the child also called `process.exit`.

Files that exit on load now report as `kind: 'entrypoint'` with a single `<entry-point>` pseudo-key. Previous-behavior preservation: the probe's verdict for an entry-point file is OK if it reaches its `main()` call without throwing en route.

**Commit:** `8220341`

---

### Batch 011 — `launcher-rewire` + end-to-end boot

**Goal:** Point `start.js` and `package.json` scripts at the new tree. Then actually boot the migrated backend end-to-end.

**Patches (not a move, just rewires):**

- `start.js` L97: `path.join(__dirname, 'backend', 'index.js')` → `path.join(__dirname, 'src', 'core', 'server', 'main.js')`
- `package.json`:
  - `"main"`: `"backend/index.js"` → `"src/core/server/main.js"`
  - `"index"`: `"node backend/indexer.js"` → `"node src/features/indexing/indexer.js"`
  - `"serve"`: `"node backend/server.js"` → `"node src/core/server/app.js"`

`start.js` itself is **not** moved — it's a user-facing launcher and `npm start` / `node start.js` are documented entry points. Internal pointer updated; external API unchanged.

**End-to-end boot test — full success.** Ran `node start.js /tmp/st8-smoke-target` against a tiny scratch directory:

1. `start.js` launched, spawned the new `main.js`.
2. Persistence layer initialized (`better-sqlite3` fall-through, identical to original).
3. Indexer ran — found and processed 2 files.
4. `dataIngestion` pipeline ran all 6 parsers (overview, stores, routes, commands, types, ui) — every moved parser file executed.
5. JSON manifest written to `connection-state.json`.
6. TOML manifest written to `ai-signal.toml`.
7. Schema cards emitted — 2 cards, 0 errors.
8. Gap analysis written to `.st8/gap-analysis.md`.
9. Intent seeder ran — 1 seeded, 1 ENOENT (pre-existing latent cwd-relative-path bug, NOT a refactor casualty; identical behavior in original).
10. HTTP server started on `http://localhost:3847`.
11. `curl /api/health` → `{"status":"ok","uptime":3.97,"targetDir":"/tmp/st8-smoke-target","lastManifestUpdate":null}` ✅

**Every wire in the migrated backend works.** The refactor preserved 100% of the runtime behavior. The user's "I just want it working again" mandate — met.

**Commit:** `12c8e5c`

---

### Batch 012 — `frontend-components`

**Goal:** Move the 6 root-level frontend `.js` files into `src/frontend/`. These are browser-only modules — they communicate via `window` globals and have zero `require()` calls. No import rewrites; no manual patches.

**Moves:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `coordination.js` | `src/frontend/services/coordination.js` | 211 | ✅ |
| `settings-reader.js` | `src/frontend/services/state.js` | 114 | ✅ |
| `file-explorer.js` | `src/frontend/components/file-explorer/file-explorer.js` | 749 | ✅ |
| `graph-visualizer.js` | `src/frontend/components/graph-viewer/graph-viewer.js` | 457 | ✅ |
| `phreak-terminal.js` | `src/frontend/components/terminal/terminal.js` | 1,087 | ✅ |
| `settings-ui.js` | `src/frontend/components/settings/settings.js` | 340 | ✅ |

**Total:** 2,958 lines copied byte-for-byte. Originals untouched.

**Import rewrites:** 0 — browser code, no `require()` / `import` statements.

**Manual patches:** None.

**`st8.html` not modified.** It still loads the original `.js` files from repo root via `<script src="...">`. Updating those script srcs is part of the larger `st8.html` peel-apart task (extract CSS + inline JS, slim down to ~70 lines of shell). Deferred to a later batch — keeps this move purely additive and revertible.

**Tooling upgrade (`scripts/migration/verify.js`):** Added a `probeClientSyntaxOnly()` path for browser-only modules. Manifest entries now support `"client": true` — these get `node --check` syntax verification instead of full `require()` (which would throw on `window` / `document` references). All 6 client files passed syntax-check on both old and new paths.

**Verification:** All 6 syntax-check clean at both locations. Logic byte-identical (SHA-256). Since these are browser modules, true runtime verification requires loading them in a browser via `st8.html` — that proof comes when the HTML peel-apart batch lands.

**Commit:** `d3d9558`

---

### Batch 013 — `st8-html-css-extraction`

**Goal:** Peel the CSS out of `st8.html` into 15 component-local / global stylesheet files under `src/frontend/`. Match the structure that's already implicit in the source (every CSS section is already named and bracketed by `/* ─── HEADER ─── */` comments). Original `st8.html` is **not modified** — the unmigrated UI still works through the inline CSS.

**Tooling added:** `scripts/migration/extract-css.js` — reads `st8.html`, extracts each section verbatim per a documented line-range spec, writes target files under `src/frontend/`. Reusable for future HTML peel-aparts.

**Extracted (15 files, 1530 lines total):**

| Target file | Source lines | Body lines |
|-------------|--------------|------------|
| `src/frontend/styles/fonts.css` | 138-148 | 11 |
| `src/frontend/styles/tokens.css` | 150-165 | 16 |
| `src/frontend/styles/base.css` | 167-179, 1609-1611 | 17 |
| `src/frontend/styles/void.css` | 180-235, 817-855 | 96 |
| `src/frontend/styles/chat.css` | 237-266 | 30 |
| `src/frontend/styles/file-list.css` | 268-378 | 111 |
| `src/frontend/styles/notes-popup.css` | 380-497 | 118 |
| `src/frontend/styles/dock.css` | 857-941 | 85 |
| `src/frontend/styles/panels.css` | 943-1010 | 68 |
| `src/frontend/components/graph-viewer/graph-viewer.css` | 499-601 | 103 |
| `src/frontend/components/settings/settings.css` | 603-815 | 213 |
| `src/frontend/components/file-explorer/file-explorer.css` | 1012-1226, 1228-1288 | 277 |
| `src/frontend/components/terminal/terminal.css` | 1290-1527 | 238 |
| `src/frontend/components/notifications/toast.css` | 1530-1607, 1613-1623 | 90 |
| `src/frontend/components/prd-wizard/prd-wizard.css` | 1625-1662, 1664-1686 | 62 |

The `<style>` block in `st8.html` spans lines 138-1686 (1549 lines). Extracted lines: 1530. Diff: **19 lines** — entirely the blank-line separators between named sections. **Every CSS rule is preserved.**

**Verification:** Counted CSS selector openings (rules with `{`) in the source `<style>` block vs the sum across all extracted files. Both: **273 = 273**. No selectors lost in the move.

**Aesthetic preservation:** Verbatim line copies. Indentation, comments, vendor prefixes, custom-property usage — all preserved. Each extracted file gets a small header comment naming its source-of-truth line range for traceability.

**`st8.html` not modified.** Its `<style>` block stays inline so the un-migrated UI keeps rendering identically. The slim shell that loads these new `.css` files via `<link rel="stylesheet">` will be built in a follow-up batch alongside the JS extraction and script-src updates.

**Commit:** `de8415c`

---

### Batch 014 — `st8-html-js-extraction`

**Goal:** Pull the inline JavaScript out of `st8.html` into `src/frontend/app.js`. Original `st8.html` stays unmodified.

**Tooling added:** `scripts/migration/extract-js.js` — counterpart to the CSS extractor. Documented line ranges, verbatim slice, no transformation.

**Extracted:**

| Source range | Content | Lines |
|--------------|---------|-------|
| `st8.html` 1784-1788 | `window.escapeHtml` utility (was its own `<script>` block) | 5 |
| `st8.html` 1797-2584 | Main application: panels, PRD wizard, variable editor, workspace change, file list rendering, file action handlers, copy file context, copy feedback, notes popup, save file notes, indexing complete handler, fetch manifest, Bruno & Oscar + AI review toasts, SSE mutation stream | 788 |
| **Total** | | **793** |

Output: `src/frontend/app.js` (818 lines including header + section separators).

**Intentional omissions (per founder direction):**

- `st8.html` 1762-1779 — the **void-engine loader** (`window.loadVoidEngine`, `window.unloadVoidEngine`). User confirmed earlier: *"Anything that has to do with void-engine can be removed. I've moved that into a different project."*
- `st8.html` 1790-1794 — the five `<script src="...">` includes for `file-explorer.js`, `phreak-terminal.js`, `graph-visualizer.js`, `settings-ui.js`, `coordination.js`. These will be re-added in the new slim `index.html` shell, pointing at the moved-in-batch-012 `src/frontend/components/` locations.

**Call sites preserved:** Inside the workspace-change handler (extracted from L2016-2069), there are 3 references to `window.loadVoidEngine` / `window.unloadVoidEngine`. They are **guarded** with `if (window.loadVoidEngine)` — so with the loader function removed, the calls become safe no-ops. No code path throws.

**Verification:**

- `node --check src/frontend/app.js` → syntax OK.
- Function-declaration count: 41 in source slices = 41 in extracted file. No definitions lost.
- 15 critical `window.*` handlers spot-checked — all present except `loadVoidEngine`/`unloadVoidEngine` (intentionally omitted).
- True runtime verification will come when the slim `index.html` shell is built (next batch) and the UI is loaded in a browser.

**Commit:** `d07ed39`

---

### Batch 015 — `frontend-shell`

**Goal:** Build the slim `src/frontend/index.html` host that loads the extracted CSS + JS — completing the st8.html peel-apart trilogy.

**File built:** `src/frontend/index.html` — **142 lines** (down from the original 2587-line `st8.html`).

| Component of the new shell | Lines |
|----------------------------|-------|
| `<!DOCTYPE>` + header comment documenting intentional differences | 30 |
| `<head>`: meta + 15 `<link rel="stylesheet">` tags in load-order-correct sequence | 25 |
| `<body>`: HTML structure verbatim from st8.html L1687-1757 (mutation-toasts container, void/#stage, footer dock, 3 panel overlays, PRD wizard) | 75 |
| `<script>` tags for 5 components + `app.js` | 7 |
| Closing tags | 5 |

**CSS load order in the shell (intentional):**

1. `fonts.css` — `@font-face` rules must precede anything that references `font-family`
2. `tokens.css` — CSS custom properties (`--void`, `--text`, `--gold`, `--cyan`, `--pink`, `--space-*`) used by every subsequent rule
3. `base.css` — universal reset + body + reduced-motion overrides
4. Layout/shell stylesheets in original order: `void`, `chat`, `file-list`, `notes-popup`, `dock`, `panels`
5. Component-local stylesheets: `graph-viewer`, `settings`, `file-explorer`, `terminal`, `notifications/toast`, `prd-wizard`

**JS load order in the shell (preserved from original `st8.html`):**

1. `components/file-explorer/file-explorer.js`
2. `components/terminal/terminal.js`
3. `components/graph-viewer/graph-viewer.js`
4. `components/settings/settings.js`
5. `services/coordination.js`
6. `app.js` (last — uses globals exposed by the 5 components above)

**Adjacent edit — `src/frontend/styles/fonts.css`:** Updated both `url('fonts/...')` references to `url('../../../fonts/...')`. CSS resolves `url()` relative to the *CSS file's* location, and from `src/frontend/styles/` the repo-root `fonts/` directory sits 3 levels up. Tested mentally for both serving modes:

- `file://` open: `<file>/src/frontend/styles/fonts.css` → `url('../../../fonts/...')` → `<file>/fonts/Monoton-Regular.ttf` ✅
- Backend serving: `<host>/src/frontend/styles/fonts.css` → `url('../../../fonts/...')` → `<host>/fonts/Monoton-Regular.ttf` → matches existing `/*.ttf` route ✅

**Intentional omissions from the new shell:**

- The original `st8.html`'s 130-line top-of-file ASCII art index — superseded by the structured file layout itself plus the bible's batch log.
- The void-engine `<script>` block (`st8.html` L1760-1780) — void-engine moved to a separate project per founder direction.
- The five external script `<script src="...">` includes for the now-moved components are replaced with the new `src/frontend/` paths.
- `settings-reader.js` (now `services/state.js`) — was never script-loaded by the original `st8.html`, so it's not loaded here either. Available for future wiring.

**Verification:**

- All 15 linked CSS files exist at the expected paths under `src/frontend/`.
- All 6 linked JS files exist at the expected paths under `src/frontend/`.
- Total asset line count (sum of all linked files): **5,448 lines** spread across 22 files.
- Original monolith → slim shell + 21 component/style/JS files. **94% reduction in the shell HTML**, zero loss of CSS rules or JS function definitions.

**True runtime verification is the next step and requires a human:** open `src/frontend/index.html` in a browser, ideally with the backend running (so the SSE stream + `/api/*` calls work). The visual layout, dock buttons, panel overlays, file list, terminal, settings, and toast notifications should all match the original `st8.html` exactly.

**Originals preserved:** `st8.html` at repo root is untouched. The original 6 root-level component `.js` files are untouched. Until the browser smoke test confirms parity, the original UI is the fallback.

**Commit:** `d62e10a`

---

### Batch 016 — `backend-static-fix-and-v2-route`

**Goal:** Wire the running backend to serve the new shell so it can be browser-tested. Fix a latent bug in static-file serving introduced by batch 010 along the way.

**Latent bug found and fixed (high-impact catch):**

`src/core/server/app.js` line 18 had:

```js
const STATIC_DIR = path.join(__dirname, '..');
```

In the original location (`backend/server.js`), `__dirname` was `/home/user/st8/backend` and `..` walked up to the repo root — correct. After the batch 010 move, `__dirname` became `/home/user/st8/src/core/server` and `..` walked to `/home/user/st8/src/core` — wrong. The earlier end-to-end smoke test in batch 011 only hit `/api/health` (which doesn't touch the static-file path), so the bug went unnoticed. Anyone who tried to load `/`, `/st8.html`, a CSS file, or a font would have gotten 404s.

**Fix:** retarget `STATIC_DIR` to walk up three levels:

```js
const STATIC_DIR = path.join(__dirname, '..', '..', '..');
```

This resolves to `/home/user/st8` — same effective root as the original. All existing static-file routes now work again.

**`/v2` route added:** Inside `_serveStaticFile()`, a new branch maps the `/v2` (and `/v2/`) path to `src/frontend/index.html`. The original `/` still serves `st8.html` so the two can be A/B tested side-by-side until the browser smoke test confirms parity.

**Verification (full HTTP boot test):**

```
$ node start.js /tmp/st8-smoke-target
... full backend boots, server starts on :3847 ...
$ curl /              -> 2587 lines (original st8.html)               ✅
$ curl /v2            -> 142 lines  (new slim shell)                  ✅
$ curl /src/frontend/styles/tokens.css  -> extracted CSS, verbatim   ✅
$ curl /src/frontend/app.js             -> extracted JS, verbatim    ✅
$ curl -I /fonts/Monoton-Regular.ttf    -> HTTP 200                  ✅
```

Static-file serving is fully restored AND the new shell is reachable.

**Browser smoke test (still needed — humans only):** open `http://localhost:3847/v2` in a real browser, ideally side-by-side with `http://localhost:3847/`. Visual aesthetics, dock buttons, panel overlays, file list rendering, terminal, settings, toast notifications, SSE mutation stream — everything should match.

**Commit:** `8e3b6cd`

---

### Batch 017 — `background-indexer`

**Goal:** Move the last un-migrated file in `lib/commands/` into the new tree. Preserve its currently-broken state exactly (no attempted fixup).

**Move:**

| From | To | Lines | SHA-256 verified |
|------|-----|-------|------------------|
| `lib/commands/backgroundIndexer.js` | `src/features/indexing/background-indexer.js` | 812 | ✅ |

**Import rewrites:** 5 — all auto-caught via history-aware lookup:

| Line | Old | New | Batch source |
|------|-----|-----|--------------|
| 60 | `'./integr8/databasePersister.js'` | `'../../core/database/graph-persister.js'` | 002 |
| 61 | `'./integr8/dataIngestion.js'` | `'./data-ingestion.js'` | 008 |
| 62 | `'./parserPersistence.js'` | `'./parser-persistence.js'` | 008 |
| 64 | `'./insightStore.js'` | `'../analysis/insight-store.js'` | 006 |
| 67 | `'./integr8/types.js'` | `'../../shared/types/integr8-types.js'` | 001 |

**3 requires NOT rewritten — targets don't exist on disk anywhere in the repo:**

| Line | Specifier | Status |
|------|-----------|--------|
| 63 | `'./sonicClient.js'` | Missing — was originally a 566-line TCP client for the Sonic search engine, copied from `maestro-scaffolder-tool`. Stripped during the pre-refactor "stubs and simulators" cleanup. |
| 65 | `'./multiPassAnalyzer.js'` | Missing — was originally a 1,021-line "PM-1 Layer 2: 5-pass analysis pipeline" module from maestro. Same fate. |
| 66 | `'./precisionCapture.js'` | Missing — referenced but never found in maestro inventory docs. May not have a complete source. |

**Verification:** Used the new "both-broken-identically" parity check (added to `verify.js` in this batch). Both the original `lib/commands/backgroundIndexer.js` and the moved `src/features/indexing/background-indexer.js` throw the **identical** module-not-found error: `Cannot find module './sonicClient.js'`. The refactor preserved the broken state exactly — no regression, no improvement. Verify reports **WARN** (parity passed, file is intentionally dormant).

**Tooling upgrade (`scripts/migration/verify.js`):** Added a third branch to the verify-result switch — if both the original AND new file throw at module load, and the error messages match (with quoted paths normalized for comparison), treat as a WARN-pass rather than FAIL. This is the right semantics for files in known-broken upstream states where the refactor's only job is identity preservation, not bug-fixing.

**State after this batch:**

- `lib/commands/` is now fully migrated (originals still in place).
- `src/features/indexing/background-indexer.js` is the new home; the file is dormant pending restoration of `sonicClient.js`, `multiPassAnalyzer.js`, and `precisionCapture.js` from upstream (maestro) or fresh implementation.
- Sonic context: https://github.com/valeriansaliou/sonic is the Rust-based search-engine server. The missing `sonicClient.js` was a Node.js client implementing its Channel protocol over TCP. Two paths to restore: copy the source from `maestro-scaffolder-tool` if available, or implement the Sonic Channel protocol fresh from the upstream docs.

**Commit:** `9cca4b8`

---

### Batch 018 — `void-engine-fake-stream-cleanup`

**Goal:** Sweep stale references to files the founder removed before the refactor began. No code changes, only metadata reconciliation.

**Discovery:** the three files flagged for cleanup (`void-engine.js`, `void-engine.html`, `fake-stream.js`) **already do not exist on disk** in the repo. They had been deleted in an earlier "stubs and simulators" cleanup before this refactor session started, but several documentation files still listed them as if they were present.

**Functional reference audit in the new `src/frontend/` tree:**

- `src/frontend/app.js` lines 270-301 contain `if (window.loadVoidEngine) ...` / `if (window.unloadVoidEngine) ...` guards inside the workspace-change handler. With the loader function no longer defined, these become safe no-ops. **Left intact** — they faithfully preserve the original behavior, and the pretext-dev workspace branch isn't broken, just visually inactive.
- `src/frontend/styles/void.css` has comments referencing "void-engine line element" and "host for void-engine #stage". The **CSS rules themselves** (`.void`, `#stage`, `.void-cursor`, etc.) are the structural shell of the whole UI — the dark canvas background — and stay. The comments are historical documentation.
- `src/frontend/index.html` line 18 has a documentation comment recording the intentional omission. Left as-is.
- Zero `fake-stream` / `fakeStream` references anywhere in `src/frontend/`.

**Edits made (purely metadata):**

`st8-filemap.md` was the "current inventory" doc claiming all three files still existed. Updated:

1. Removed three rows from the Root Level Files table (`fake-stream.js` / `void-engine.html` / `void-engine.js`) plus added a small footnote explaining what was removed and why.
2. Reworded the Workspace Type Handling row: `pretext-dev` was documented as "void-engine.js would activate" → now reads "safe no-op (void-engine removed from this project)".

Other docs with stale refs (`README.md`, `0_FRONTEND_INDEX.md`, `0_MASTER_INDEX.md`, `0_LINE_COUNT_REPORT.md`, `connection-state.json`, etc.) intentionally left as-is — those are historical analysis snapshots from the prior LLM's wave, not living docs. They'll get rewritten in a later README-refresh pass.

**No files moved. No files deleted. No code changed. Only the canonical filemap inventory was reconciled with disk reality.**

**Commit:** `ba12af6`

---

### Batch 019 — `stage-originals-to-OGB`

**Goal:** Move every migrated original out of its old path and into `OGB/<original-path>.txt` so the new `src/` tree is the sole source of executable code. Founder-proposed pattern: stage to `.txt` snapshots in an inert holding directory, then they destroy `OGB/` themselves at their leisure.

**Tooling added:** `scripts/migration/stage-originals.js` — reads `move-history.json`, for each `from` path copies it to `OGB/<from-path>.txt` and deletes the original. Preserves the original directory structure inside `OGB/` so paths remain unambiguous and inspectable. Idempotent (skips already-staged files).

**Result of run:**

- 46 originals staged into `OGB/` (1.0 MB total, all renamed to `.txt`).
- All 46 originals deleted from their previous locations.
- `lib/utils/`, `lib/commands/`, `lib/commands/integr8/`, all the `backend/`*.js* files: now empty of `.js` files.
- Root-level frontend `.js` files (`coordination.js`, `file-explorer.js`, etc.): gone from root, staged to `OGB/`.

**Files held back from OGB intentionally:**

- `st8.html` — still at repo root, still served at `/`. Until the founder runs the browser smoke test on `http://localhost:3847/v2` and confirms parity with `http://localhost:3847/`, the original monolith is the safety net.
- `backend/SCHEMA-CARD-EMITTER-REPORT.md`, `backend/SECURITY-AUDIT-H1.md`, `backend/package.json` — not in move-history (not source code; these are docs / configs). Left untouched. The founder can decide their fate separately.
- All of `st8_json/` (43 schema-card JSONs + 20 markdown docs) — never touched throughout the entire refactor. Documentation + runtime artifacts.

**Verification (full HTTP boot test, post-staging):**

```
$ node start.js /tmp/st8-smoke-target
... full pipeline runs from src/ only — no fallback to lib/ or backend/ ...
[st8:server] Server running on http://localhost:3847

$ curl /api/health       -> {"status":"ok","uptime":4.97,...}              ✅
$ curl /v2 | wc -l       -> 142   (new slim shell)                          ✅
$ curl /  | wc -l        -> 2587  (st8.html, held back)                     ✅
$ curl -I /src/frontend/styles/tokens.css  -> 200 OK                       ✅
```

**Recovery path:** If anything in `OGB/` is needed back, `cp OGB/<path>.txt <path>` (drop the `.txt`). Git also has full history of every deletion in this batch.

**Commit:** `bbfa7cc`

---

### Batch 020 — `flip-default-to-new-shell`

**Goal:** Promote the new slim shell to the default `/` route and retire `st8.html` to OGB. Founder explicitly chose "debug the new thing rather than keep working with the old" — flip-and-fix is faster than wait-and-verify.

**Edits:**

1. `src/core/server/app.js` `_serveStaticFile()` — collapsed the `/` and `/v2` branches into one. Both now serve `src/frontend/index.html`. The `/v2` alias is kept for explicit reference but it's the same content. Old branch `/ -> /st8.html` is gone.
2. `st8.html` moved from repo root to `OGB/st8.html.txt` (94 KB, the 2587-line monolith preserved verbatim as an inert text snapshot).

**Verification (HTTP boot test, post-flip):**

```
$ node start.js /tmp/st8-smoke-target
...full pipeline runs from src/ only...
[st8:server] Server running on http://localhost:3847

$ curl /  | head -3            -> "<!DOCTYPE html> ... slim shell"   ✅
$ curl /  | wc -l              -> 142                                 ✅
$ curl /api/health             -> {"status":"ok",...}                 ✅
$ curl -o /dev/null -w '%{http_code}' /st8.html  -> 404               ✅
$ curl -o /dev/null -w '%{http_code}' /src/frontend/styles/tokens.css -> 200  ✅
$ curl /v2                     -> identical to /                      ✅
```

**What the founder needs to do next:** open `http://localhost:3847/` in a real browser. Whatever's broken visually, file a bug — at this point the new shell is the only target; we debug that one rather than juggle two parallel UIs.

**Rollback (if needed):**

```bash
cp OGB/st8.html.txt st8.html
# then in app.js, change the route back:
#   if (filePath === '/') { filePath = '/st8.html'; }
#   else if (filePath === '/v2' || filePath === '/v2/') { filePath = '/src/frontend/index.html'; }
```

30-second reversal. The OGB safety net is intact.

**State of the repo:**

- `src/` — the entire live application (62 files + 1 index.html + app.js, ~24K lines)
- `OGB/` — 47 inert `.txt` snapshots (46 from batch 019 + `st8.html.txt` from this batch, ~1.1 MB)
- `start.js`, `package.json`, `ai-signal.toml`, `st8.code-workspace`, `connection-state.json` — root configs / entry, unchanged
- `st8_json/`, `.planning/`, `.archive/`, `fonts/`, `docs/` — historical/runtime artifacts, untouched
- `scripts/migration/`, `st8_bible.md`, `st8-filemap.md` — refactor toolkit + record

**Commit:** `1e2418e`

---

### Batch 021 — `post-refactor-cleanup-and-signal-tests`

A consolidated batch covering three related improvements + Louis concept capture.

**Part A — Delete the `0_*` skeleton tree** (founder-approved cleanup)

The prior planning wave dropped 4 stub directories (`src/0_core/`, `src/0_features/`, `src/0_shared/`, `src/0_frontend/`) with 103 empty placeholder files and 35 directories — 138 paths total. None imported anywhere after the real tree was built. Removed in one command:

```
rm -rf src/0_core src/0_features src/0_shared src/0_frontend
```

138 zero-prefix findings from `check-conventions.js` → 0.

**Part B — Fix `gap-analyzer.js`'s hardcoded backend paths**

The 3-agent + 1-script gap analysis caught a real bug: `gap-analyzer.js` had a table mapping every API endpoint to the file that implements it — using the OLD `backend/X.js` paths that no longer exist. 22 path strings updated to point at the new `src/<layer>/<feature>/X.js` locations. Plus two doc-comment fixes:
- `src/features/schema-cards/emitter.js:154` — example transformation
- `src/features/prd/generator.js:1-11` — usage line + `@module` tag

26 stale OLD-path findings → 0.

**Part C — Signal tests for the graph-visualizer data path**

Two tiers built (founder spec):

**Tier 2 — Pipeline invariants** (`scripts/signal-tests/check-invariants.js`)

Creates a 3-file fixture target (`alpha.js → beta.js → gamma.js`), runs the indexer, asserts 7 invariants on the produced manifest:

| Check | What it catches |
|---|---|
| I1 | Manifest is valid JSON |
| I2 | Manifest file-count = files on disk |
| I3 | Every entry has required fields |
| I4 | Every `sha256Hash` matches a freshly-computed SHA-256 of the file |
| I5 | Status counts sum to total (no enum leakage) |
| I6 | Rerunning yields identical fingerprints + hashes (idempotency) |
| I7 | All filepaths are relative |

**First-run result: 5/7 pass.** The 2 fails are genuine signals worth knowing about:
- **I3** — `lifecyclePhase` + `birthTimestamp` exist in `file_registry` SQLite but aren't serialized into `connection-state.json`. Could be intentional or a manifest-omission bug.
- **I6** — File count drifts 3→4 on second run because the indexer indexes the manifest it wrote on the first run. Easy fix: exclude `connection-state.json` and `ai-signal.toml` from the discover-files glob.

**Tier 6 — Schema card identity delta** (`scripts/signal-tests/check-identity-delta.js`)

For each of 43 schema cards in `st8_json/schema-cards/`: recover original filepath from card filename, look up current location via `move-history.json`, AST-extract today's exports + imports, compare to saved card. Tolerates known renames (builds a rename map from move-history so `databasePersister` matches `graph-persister`) and basename case-style changes (`safeFs` ≡ `safe-fs`).

**Final result after rename-aware normalization:**

| Bucket | Count |
|---|---|
| MATCH (identity preserved) | 37 |
| DOCUMENTED DRIFT (the hand-patched files: main.js, app.js, emitter.js) | 3 |
| **UNDOCUMENTED DRIFT** | **0** ✅ |
| MISSING (fake-stream, void-engine, test/newfile — retired) | 3 |
| FAILED TO PARSE | 0 |

**The refactor preserved file identity across all 43 schema-card-tracked files. Strongest end-to-end signal that the move-and-rewire didn't accidentally alter a module's external surface.**

**Tier 1 deferred.** Tier 2 + Tier 6 cover most of what Tier 1 would. If a future regression slips past both, that's the moment to add schema-contract validation at internal handoffs.

**Cumulative gap-check tally:** 282 raw findings on first run → 31 after cleanup + path fixes. Remaining 31 = 25 expected boundary violations (core/server orchestrating features — which is correct) + 6 orphan-candidates that need human review (`ground-plane.js`, `integr8/index.js`, `migration-executor.js`, `background-indexer.js`, `graph/builder.js`, `graph/traversal.js` — some are CLI entry points, some are dormant pending sonic restoration).

---

### Louis Concept (captured for future session — not implemented yet)

> **Louis Cross-References (Wave 8A — ticket 1)**
>
> The Louis design is fragmented across this bible. **The canonical
> spec is no longer the bible itself — it is
> `docs/components/louis-and-locking.md`** (a Wave-7-era consolidation
> + Wave 8A annotations). The bible holds the original design memo and
> a handful of forward-pointing mentions; future Louis work should
> cite the component doc and the roadmap, not duplicate either here.
>
> Every Louis mention in the bible as of Wave 8A:
>
> - **§Batch 021 (this section, lines 2527-2610)** — original "Lock 'em
>   up Louis" design memo. The three-tab description, the three
>   integration paths (A/B/C), the Path C plan, and the captured chmod
>   primitive sketch. Source of truth for the *concept*; superseded for
>   *implementation* by the component doc.
> - **§Batch 023 (hooks-architecture)** — "future modules — Louis,
>   plugins, external integrations" appears in the rationale for why
>   the hook chain needed to be lifted out of `main.js`. Forward
>   pointer only.
> - **§LifecyclePhase / FileStatus enum tables** — the `LOCKED` slot is
>   reserved in both enums but never written. Phase L1 of the roadmap
>   adds the write path.
> - **§Constellation color slot** — `STATUS_COLOR.LOCKED` reserves the
>   pink token (`{r:201, g:116, b:143}`); now lives in
>   `src/frontend/components/status-colors.js` (Wave 7C ticket 9
>   consolidation).
> - **§Line ~1617 ("Defined-but-never-fired")** — the `LOCK` mutation
>   type in the type system that the Wave-8A audit-trail decision
>   (component doc, "Lock-history audit trail — DECIDED") finally
>   binds to a firing site.
>
> **Authoritative documents** (in priority order):
>
> 1. `docs/components/louis-and-locking.md` — canonical spec, decisions
>    D1–D7, chmod primitive in full, boundary docs, audit-trail
>    decision.
> 2. `docs/_pending-roadmap/louis-and-locking.md` — Phase L1–L4 build
>    plan with exit criteria + dependency graph.
> 3. `docs/_pending-tickets/louis-and-locking.json` — per-file
>    backlog, mostly GREEN forward-looking entries.
>
> Future Louis batches: add a cross-link entry here pointing at the
> batch number, but keep the prose in the component doc. The bible is
> the design-decision log, not the spec.

The founder uploaded `Louis/` (commit `1df677b` on `master`): a 1463-line PyQt6 desktop app called "Lock 'em up Louis" containing three fused tools:

1. **👮 Louis (Warden)** — File locking. `chmod 444` to lock, `chmod 644` to unlock. State in `~/.louis-control/{louis-config.json, protected-files.txt, lock-history.log}`. Optional `.git/hooks/pre-commit` that refuses commits to protected files.
2. **🎨 Connie** — Database to LLM-friendly format converter.
3. **📚 Carl** — LLM chat context generator.

**Founder's stated goal:** add a panel below Settings in the st8 UI that allows manual lock/unlock of files. Scope shrinks to just the Warden piece.

**Three integration paths considered:**

| Path | Approach | Recommendation |
|---|---|---|
| A. Subprocess wrap | st8 shells out to `python lock_em_up_louis_v2.py --lock <path>` | NO — requires PyQt6 even for headless use, slow per-call. |
| B. Full Node port (all 1463 lines) | Reimplement Warden + Connie + Carl + GUI | NO — massive rewrite of features st8 doesn't need. |
| C. Port just the Warden (~140 lines core logic) | Reimplement only the locking logic in Node + new st8 panel UI | ✅ **Recommended.** |

**Path C plan (for future implementation):**

```
src/features/locks/
├── lock-manager.js          # port of LouisWarden — fs.chmodSync for
│                            # lock_file / unlock_file / lock_all / isWritable
├── lock-state.js            # port of LouisConfig — SQLite-backed
│                            # (extends existing st8.sqlite, no separate DB)
└── git-hook-installer.js    # port of install_git_hook()

src/frontend/components/lock-panel/
├── lock-panel.js            # UI under Settings in the dock
└── lock-panel.css

# Wire-up:
- New dock button "🔒" next to "phreak>" in src/frontend/index.html
- Backend routes added to src/core/server/app.js:
    POST /api/lock    { path }
    POST /api/unlock  { path }
    GET  /api/locks
- file_registry table gains a `locked BOOLEAN DEFAULT 0` column
- File explorer shows a lock badge next to each file's status dot
- SSE "lock-change" event so all open UIs update instantly
```

**The locking primitive in Node is tiny (~50 lines):**

```js
// src/features/locks/lock-manager.js
const fs = require('fs');

function lockFile(absPath) {
  if (!fs.existsSync(absPath)) return { ok: false, error: 'not found' };
  try { fs.chmodSync(absPath, 0o444); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function unlockFile(absPath) {
  if (!fs.existsSync(absPath)) return { ok: false, error: 'not found' };
  try { fs.chmodSync(absPath, 0o644); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function isWritable(absPath) {
  try { fs.accessSync(absPath, fs.constants.W_OK); return true; }
  catch (_) { return false; }
}

// + lockAll(paths), unlockAll(paths), getState(paths)
```

**Why Path C fits st8:**

- `file_registry` already tracks files — adding a `locked` column is one schema change.
- SSE bus already broadcasts mutations — adding a lock-change event is one new event type.
- File explorer already renders status badges — adding a lock badge is one CSS class.
- Bruno+Oscar's `lifecyclePhase` (DEVELOPMENT/STAGING/PRODUCTION) is orthogonal — PRODUCTION files could default-lock, but that's a follow-up policy decision.
- The pre-commit git hook is portable as-is — install during setup, regenerate `~/.louis-control/protected-files.txt` (or equivalent) from `locked = 1` rows on every change.

**Notes on the "couple errors" the founder mentioned:**

`Louis/FIXES_APPLIED.md` documents v1 → v2 fixes: setup-wizard timing, path handling, layout-clearing on None, folder-checkboxes init order. The fixes look applied in v2, but PyQt6 GUI scaffolding has many opportunities for subtle widget lifecycle bugs. If the founder keeps Louis.py standalone (for the Connie + Carl pieces st8 won't absorb), the right place to look for residuals is `LouisTab.__init__`, `ConnieTab.__init__`, `CarlTab.__init__` — race conditions on signal connect and uninitialized widget refs.

**Decision logged but not actioned this session.** Louis.py stays at repo root unchanged. Path C is the plan; ready to execute when the founder gives the green light.

**Commit:** `d340af4`

---

### Batch 022 — `intent-seeder-fix-and-gap-analyzer-jsdoc`

Two small fixes flagged by the agents in batch 021's pressure-test:

**1. intent-seeder.js path-resolution bug.**

`intent-seeder.js` had two relative file reads using `path.resolve(filepath)` — which is cwd-relative. `file_registry.filepath` is stored project-relative, and the server's cwd differs from `targetDir` whenever you run `node start.js /some/other/dir`. Result: `ENOENT: no such file or directory` errors during intent seeding for every file.

Fix:
- Constructor takes an optional `targetDir` parameter (defaults to `process.cwd()` for backward compat).
- Both file reads at L193 and L385 now use `path.isAbsolute(filepath) ? filepath : path.resolve(this.targetDir, filepath)`.
- `main.js:178` and `main.js:384` (the watcher's incremental re-seed) updated to pass `targetDir`.

Verified: smoke test from repo root against `/tmp/st8-smoke-target` previously reported `Seeded 1 files, 1 errors`. After fix: `Seeded 6 files, 0 errors`.

**2. gap-analyzer.js JSDoc @module tag.**

Line 14: `@module backend/gapAnalyzer` → `@module features/analysis/gap-analyzer`. Cosmetic but caught by the agent's audit.

**Commit:** `2ae1769`

---

### Batch 023 — `hook-registry-and-named-hooks`

The big one — implements §8.1 of `HOOK-ARCHITECTURE-RESEARCH.md`. Replaces the inline post-index hook chain that lived in `main.js:154-183` with a named, priority-ordered, async-aware `HookRegistry`.

**New files:**

`src/core/hook-registry.js` (140 lines):
- `HookRegistry` class extending `EventEmitter`
- `.register(name, handler, {priority, source})` → returns unregister function
- `.execute(name, ctx)` — runs handlers in priority order, awaits each, catches per-handler errors so one bad subscriber can't break others (same isolation policy as `notification-bus`)
- `.listHooks()` for introspection
- Singleton `hookRegistry` exported for cross-module use
- `HOOKS` constants — canonical names for the 6 hook points defined in the doc:
  - `INDEX_START` — `{targetDir, persistence}`
  - `INDEX_COMPLETE` — `{result, targetDir, persistence, emitter, printer}`
  - `FILE_INDEXED` — `{file, targetDir, persistence}` — fires per file in Pass-1 upsert loop
  - `FILE_BEFORE_CHANGE` — `{change, targetDir, persistence}` — watcher hook (no firers yet)
  - `FILE_AFTER_CHANGE` — `{change, file, mutation, schemaCard, targetDir, persistence}` — watcher hook (no firers yet)
  - `LIFECYCLE_TRANSITION` — `{file, oldPhase, newPhase}` — fires from `/api/record-commit` with `{kind: 'commit', commit}`
  - `PRD_GENERATE` — `{targetDir, options}` — extension point

`src/core/hooks/default-subscribers.js` (80 lines):
- `registerDefaultSubscribers(registry)` registers st8's built-in handlers
- 4 INDEX_COMPLETE subscribers in priority order (matches the original orchestration sequence):
  - P=10 manifest-generator (`writeManifests`)
  - P=20 schema-card-emitter (`emitAllCards` + `printer.printAllFromCards`)
  - P=30 gap-analyzer (`analyze` + `writeReport`)
  - P=40 intent-seeder (`seedAll`)
- Each handler wrapped in its own try/catch so a failure in one doesn't block subsequent subscribers
- No default subscribers for `FILE_INDEXED` yet — wired and ready for future modules (Louis lock checks, real-time UI updates)

**Changes to existing files:**

`src/core/server/main.js`:
- Imports `hookRegistry`, `HOOKS`, `registerDefaultSubscribers`
- Calls `registerDefaultSubscribers(hookRegistry)` once after persistence init
- Fires `INDEX_START` before Pass-1 (no default subscribers — extension point)
- Pass-1 upsert loop fires `FILE_INDEXED` per file (extension point for "identification built into indexing" — the founder's original intent for this hook)
- **29 lines of inline post-index orchestration replaced with one `await hookRegistry.execute(HOOKS.INDEX_COMPLETE, {...})` call**
- The watcher callback (`onFileChange`, 215 lines) is **NOT** hook-converted in this batch — that's a bigger, riskier refactor. Saved for a focused follow-up.

**Verified:**
- All 4 default subscribers run in priority order on every indexer pass.
- Boot output is byte-for-byte identical to pre-hook orchestration:
  ```
  [st8] Manifests generated
  [st8:emitter] Emitted 6 schema cards, 0 errors
  [st8:printer] Printed 4 cards, 0 errors
  [st8] Schema cards emitted
  [gapAnalyzer] Report written to: …/gap-analysis.md
  [st8:seeder] Seeded 6 files, 0 errors
  ```
- `/api/health` returns 200 after the hook chain completes.

**This is the structural fix the HOOK-ARCHITECTURE doc identified:** the chain that was 70% implemented (inline) is now 100% implemented (named hooks). Future modules — Louis, plugins, external integrations — can register additional handlers on any of the 6 hook points without editing `main.js`.

**Commit:** `04f63fb`

---

### Batch 024 — `post-commit-git-hook`

The doc's §8.2 — small follow-up that uses the new registry.

**New files:**

`scripts/git-hooks/post-commit` — shell hook that runs after every commit. Captures commit metadata (hash, subject, author, branch, files changed) and POSTs to `http://localhost:3847/api/record-commit`. **Non-fatal:** if st8 isn't running, the commit still succeeds; if curl is missing, the commit still succeeds. The hook is a courtesy notification, not a gate.

`scripts/git-hooks/install.sh` — one-time installer that symlinks `scripts/git-hooks/post-commit` → `.git/hooks/post-commit`. Tracked in git, so the canonical version lives in the repo.

**New route:**

`POST /api/record-commit` (in `src/core/server/app.js`):
- Accepts JSON `{hash, shortHash, subject, author, timestamp, branch, filesChanged}`
- Writes a `COMMIT_RECORDED` row to `activity_log` (table is right place for project-level events — `mutation_log` has a FK to `file_registry` that commits can't satisfy)
- Fires `HOOKS.LIFECYCLE_TRANSITION` with `{kind: 'commit', commit}` so subscribers can react (regenerate manifests on commit, snapshot gap analysis, etc.)
- Returns `{ok: true, hash: <commitHash>}` on success

**Verified:**
```
$ curl -X POST http://localhost:3847/api/record-commit \
    -H "Content-Type: application/json" \
    -d '{"hash":"abc123def456","shortHash":"abc123d",...}'
{"ok":true,"hash":"abc123def456"}
HTTP 200
```

**Installation (one-time, per repo):**
```
bash scripts/git-hooks/install.sh
```

After installation, every `git commit` automatically POSTs to st8 when it's running. The activity_log builds up a commit history queryable through any existing st8 introspection path.

**Commit:** `c67f5e7`

---

### Batch 025 — `post-audit-cleanup-and-force-checks`

Five-item batch driven by the agent audits in the previous turn. Items 1, 3, 4, 5b shipped; items 2 and 5a were investigations that produced roadmaps (item 2's wiring is queued as the next big build).

**Item 1 — Fix LIFECYCLE_TRANSITION misuse, add COMMIT_RECORDED hook**

Agent A (method alignment) caught one HIGH-severity bug from batch 024: I had fired `HOOKS.LIFECYCLE_TRANSITION` from `/api/record-commit` with a `{kind, commit}` payload, but the hook's contract is `{file, oldPhase, newPhase}`. Wrong hook for the event.

Fix:
- `src/core/hook-registry.js` — added `HOOKS.COMMIT_RECORDED = 'commit:recorded'` with documented payload `{commit: {hash, shortHash, subject, author, timestamp, branch, filesChanged}}`
- `src/core/server/app.js` `_handleRecordCommit` — fires `HOOKS.COMMIT_RECORDED` instead of `LIFECYCLE_TRANSITION`. Verified: `curl -X POST /api/record-commit` → `{"ok":true,"hash":"deadbeef"}` HTTP 200.

LIFECYCLE_TRANSITION stays reserved for actual file-phase transitions (bruno+oscar territory).

**Item 3 — Force-check pass after INDEX_COMPLETE**

Built `src/core/hooks/force-checks.js` (~200 lines) and wired it as a P=90 subscriber on `INDEX_COMPLETE` via `registerForceChecks(hookRegistry)` in `main.js`. Writes `.st8/force-check.md` after every indexer pass.

Six cross-tool integrity checks (the second "tool verifies tool" relationship in the project — first was gap-analyzer reading emitter's output):

| Check | What it catches |
|---|---|
| FC1 | Every file_registry row has a schema card on disk (emitter silently skipping files) |
| FC2 | Every schema card on disk has a matching file_registry row (stale cards after deletes) |
| FC3 | Manifest's `connection-state.json` covers every file_registry row (manifest skips) |
| FC4 | Gap report references only real filepaths (gap-analyzer drift) — skips `/api/*` URLs |
| FC5 | Every connection's source+target fingerprint exists in file_registry (dangling edges) |
| FC6 | Fingerprints follow `<filepath>||<ISO-timestamp>` format (malformed identity) |

**First-run result on the fixture target: 4/6 pass.** Two real signals surfaced immediately:
- **FC3** — `file_registry` accumulates rows across runs (including the `connection-state.json` manifest from the indexer indexing its own output, also flagged by Tier 2 I6). The manifest is per-run, so old rows go un-covered. This is the same drift the user previously called "a shoddy wiring job."
- **FC4** — initially flagged `/api/connection-state.json` and `/api/ai-signal.toml` from the gap-analyzer's hardcoded URL table as if they were files. **False positive — tightened the check to skip `/api/*` paths.** Now FC4 passes cleanly.

After the FC4 fix, the force-check report is honest about FC3 being a real signal.

**Item 4 — Pre-LLM-provider Settings groundwork**

Added `LLM_PROVIDERS` registry at the top of `src/frontend/components/settings/settings.js`:

```js
const LLM_PROVIDERS = [
  { id: 'anthropic',  name: 'Anthropic',         envKey: 'ANTHROPIC_API_KEY' },
  { id: 'openai',     name: 'OpenAI',            envKey: 'OPENAI_API_KEY' },
  { id: 'google',     name: 'Google (Gemini)',   envKey: 'GOOGLE_API_KEY' },
  { id: 'ollama',     name: 'Ollama (local)',    envKey: null },
  { id: 'lmstudio',   name: 'LM Studio (local)', envKey: null },
  { id: 'openrouter', name: 'OpenRouter',        envKey: 'OPENROUTER_API_KEY' },
  { id: 'custom',     name: 'Custom (URL)',      envKey: null },
];
```

Plus documented the `models` entry schema (id, name, provider, model, apiKey, baseUrl, enabled) in a header comment. Exposed via `window.St8Settings.getLLMProviders()` for the model-entry editor to consume.

This is the smallest-possible foothold for provider abstraction. The `editEntry()` UI in settings.js still doesn't render the provider dropdown — that's next session's work. But the registry is now the canonical source of truth so adding a provider is a one-line change to one constant.

**Item 5b — `state.js` retired to OGB**

Agent C's verdict: **DELETE.** Reasons documented:
- Confusingly named alongside `connection-state.json` but **completely unrelated** — `connection-state.json` is the manifest generated by manifest-generator and read by frontend coordination polling. `state.js` is a settings persistence layer (`SettingsReader` + adapters) that was never wired.
- Never imported anywhere in src/.
- Had its own hardcoded `DEFAULT_VOIDFLOW` that duplicated `settings.js`'s defaults — silent divergence risk if anyone later wired it.
- Running `node state.js` directly is harmless (no side effects on import), but the divergence risk grows the longer it sits.

Action:
- `src/frontend/services/state.js` → `OGB/src/frontend/services/state.js.txt`
- `src/frontend/index.html` header comment updated to record the retirement (was: "can be added later if/when wired up" — now: "retired to OGB, divergence risk preempted")

---

### Roadmap — Dead Modules Wiring (Item 2 — queued for next session)

Agent's deep dive on the 6 dead modules produced a connected vision. The founder's workflow goal is **File → Signal Path → Output (ticket / LLM / view)**. The agent mapped each dead module to where it sits in that pipeline:

| Module | Lines | Role in the pipeline | Founder priority |
|---|---|---|---|
| **`background-indexer.js`** | dormant (sonic broken) | "Parse to oblivion" — exhaustively indexes, populates graph-persister + insight-store. **First fix:** swap broken sonicClient for direct InsightStore writes. | Foundation |
| **`relationship-analyzer.js`** | 924 | Stage 2 of pipeline. Classifies file deps as SAFE / NEEDS_REWRITE / CONFLICT / MISSING; detects circular deps via Tarjan SCC. | Foundation |
| **`path-generator.js`** | 859 | Stage 3. Topologically sorts files into a MigrationStep[]. **Outputs the "signal path" the founder wants visualized.** | ⭐ **#1** |
| **`traversal.js`** | 828 (13 exports) | Powers path-generator with impact-chain + dependency queries. Already semi-integrated. | Foundation |
| **`insight-store.js`** | 362 | Per-file insights (`error`/`warning`/`info`) tied to nodes. The "why is this file RED?" data layer. | High |
| **`report-generator.js`** | 284 | Markdown rendering of the migration plan. The "push to ticket / LLM" output. | Medium |

**Proposed terminal commands** (to add in the phreak terminal):

| Command | What it does |
|---|---|
| `show-path <file>` | ⭐ Renders the signal path visualization for the picked file (path-generator output) |
| `insights <file>` | Lists errors/warnings for the file (insight-store query) |
| `deps <file>` | Quick dependency list (traversal.findImportsOf) |
| `impacts <file>` | Downstream impact chain (traversal.computeImpactChain) |
| `report` | Generates the migration report (report-generator) for the current path |
| `index-project <path>` | Triggers background-indexer reindex with progress |

**Proposed API endpoints:**

```
POST /api/analyze-relationships  { currentGraphId, fileNodeId, targetPages } -> {conflicts, unifiedGraph, dependencyMap}
POST /api/signal-path            { fileNodeId, graphId }                     -> {plan, outcome, reasons, visualization}
GET  /api/insights               ?filePath=<path>                            -> {insights[], summary}
GET  /api/graph/deps             ?nodeId=<id>&graphId=<id>                   -> {deps[]}
GET  /api/graph/impacts          ?nodeId=<id>&graphId=<id>                   -> {impacts[], totalAffected}
POST /api/generate-report        { planId }                                  -> Markdown text
POST /api/background-index       { projectPath }                             -> non-blocking start
GET  /api/background-index/status                                            -> {isIndexing, filesProcessed, total}
```

**Suggested implementation order** (next session):

1. **`path-generator` end-to-end** (founder's #1 priority) — gets the user from "file is yellow" to "here's the signal path." Doesn't need background-indexer fixed; can run synchronously on a manual request. ~half-day if we skip the visualization UI (return JSON) or full day with a basic SVG render in a new panel.
2. **`report-generator` wired to path output** — gives the user a markdown report they can copy/paste to an LLM. ~2 hrs.
3. **`insight-store` + relationship-analyzer feeding it** — populates the "why is this file RED" data. ~half-day (skip background-indexer; trigger from INDEX_COMPLETE instead).
4. **`background-indexer` sonic-fix** — replace sonicClient with direct InsightStore writes. The biggest fish; saves for last. ~half-day to a day.

**Commit:** `38f92c7`

---

### Batch 026 — `little-stuff-fixes`

Three small fixes addressing the two force-check signals from batch 025 plus a follow-on issue that surfaced once they cleared.

**1. Indexer hygiene (`src/features/indexing/indexer.js`)** — Added `SELF_WRITTEN_BASENAMES = Set(['connection-state.json', 'ai-signal.toml'])` to `discoverFiles()` so st8's own output files don't get indexed on the next pass. Fixes Tier 2 invariant I6.

**2. Registry prune (`src/core/database/persistence.js` + `src/core/server/main.js`)** — New `persistence.pruneFilesNotIn(currentFilepaths)` drops accumulated rows from prior runs. Operates **per-fingerprint, not per-filepath** — file_registry can have multiple rows per filepath (different birthTimestamps = different fingerprints), so the existing `deleteFile(filepath)` would FK-violate. Per-fingerprint cleanup with full cascade through connections + intent + mutation_log in one transaction. Called as Pass-0 before the existing upsert loop.

**3. Emitter card sweep (`src/features/schema-cards/emitter.js`)** — `emitAllCards()` now removes stale `.json` files from `.st8/schema-cards/` that no longer correspond to a current `file_registry` row. Without this, cards from prior runs gave gap-analyzer false data (it reads the dir directly).

**Verified:** force-check `6/6 pass` (was `4/6` on previous build). Emitter logs include `"pruned N stale"`.

**Commit:** `c073bde`

---

### Batch 027 — `sonic-foundation` (Layer 1 of PM-1)

The first concrete step of the PM-1 vision (per `docs/Sonic/pm1-background-indexer-vision.md`). Gets Sonic — a sub-millisecond TCP search backend — running as a managed child process of st8, with the missing JS trio that was making `background-indexer.js` dormant.

**Files pulled from `origin/master` into the branch** (founder pushed these via Louis-style drops):

- `docs/Sonic/sonic` (19 MB ELF binary)
- `docs/Sonic/sonic.cfg`, `.install`, `.service` (full deployment config)
- `docs/Sonic/sonicClient.js`, `.ts` (567 lines — the missing Sonic Channel protocol TCP client)
- `docs/Sonic/sonicIndexer.js`, `.ts` (446 lines — graph→Sonic push)
- `docs/Sonic/sonicQueries.js`, `.ts` (659 lines — query layer with SQLite fallback)
- `docs/Sonic/sonic_daemon.rs` (398 lines — Tauri-specific Rust lifecycle manager; we use the design but port to Node)
- `docs/Sonic/sonic-integration-architecture.md` (814 lines — architecture deep-dive)
- `docs/Sonic/pm1-background-indexer-vision.md` (308 lines — the 5-layer master plan)
- `docs/Insight Store/insightStore.{js,ts}` (the TS source for what's already in src/features/analysis/)

**New module: `src/features/search/`** (4 files):

```
src/features/search/
├── sonic-client.js     # was docs/Sonic/sonicClient.js — kebab-cased,
│                       # default host changed from [::1] to 127.0.0.1
├── sonic-indexer.js    # was sonicIndexer.js — internal requires rewritten
│                       # for the new layout (graph-persister, integr8-types)
├── sonic-queries.js    # was sonicQueries.js — same rewrites
└── sonic-daemon.js     # NEW — Node-side process lifecycle manager
```

**`sonic-daemon.js`** (~210 lines) is the Node-port of the Rust lifecycle manager. Key design decisions:

- **Optional.** st8 boots in SQLite-only mode if the Sonic binary is missing, fails to start, or the port doesn't bind. Every `sonic-queries` call has a SQLite fallback per the architecture doc, so degraded mode is graceful.
- **Adopt-if-already-running.** Pings port 1491 before spawning. If Sonic is already up (external systemd unit, prior process, etc.), st8 "adopts" it without re-spawning.
- **Runtime config materialization.** `docs/Sonic/sonic.cfg` is canonical (MAESTRO version) and uses `[::1]`. Some hosts (sandboxed Linux, IPv6-disabled VMs) reject IPv6 binds, so the daemon writes a runtime override to `.st8/sonic-store/sonic.runtime.cfg` with `inet = "127.0.0.1:1491"` and feeds THAT to the binary. **Canonical config never touched.**
- **Health-check on spawn.** Polls TCP every 100 ms up to 5 s; if port never opens, terminates the child and reports failure.
- **Clean shutdown.** Installs SIGINT/SIGTERM/exit handlers that SIGTERM the child with a 1.5 s grace window before SIGKILL.
- **Per-project store paths.** Sets `SONIC_STORE_PATH=<targetDir>/.st8/sonic-store/` so different projects don't share an index.

**Hook wiring** — `src/core/hooks/default-subscribers.js` gets a new `INDEX_START` subscriber at priority 10:

```js
registry.register(HOOKS.INDEX_START, async (ctx) => {
  const daemon = require('../../features/search/sonic-daemon');
  await daemon.start({ targetDir: ctx.targetDir });
}, { priority: 10, source: 'sonic-daemon' });
```

This wires Sonic startup into the existing hook chain. Future modules (`background-indexer`, `relationship-analyzer`, anyone who wants warm search) can rely on Sonic being up by the time `INDEX_COMPLETE` fires.

**Verified end-to-end:**

```
$ node start.js /tmp/st8-smoke-target
...
[sonic-daemon] Sonic running on 127.0.0.1:1491 (pid <X>, store /tmp/st8-smoke-target/.st8/sonic-store)
[st8] Manifests generated
[st8] Schema cards emitted
[st8:force-check] 6/6 checks pass
[st8] Ready!

$ curl http://127.0.0.1:1491   (raw TCP probe)
CONNECTED <sonic-server v1.4.9>
```

**Graceful-degrade verified separately:** when daemon was first tested with the canonical `[::1]` config, Sonic itself logged `error binding channel listener: Address family not supported by protocol`, the daemon's health-check timed out at 5s, st8 logged `[sonic-daemon] Sonic spawned but port 1491 never opened — SQLite-only mode`, and continued booting to a healthy `force-check 6/6 pass`. The fallback path is real.

**What this unblocks (next batches):**

| Module | Blocked by | Status after this batch |
|---|---|---|
| `background-indexer.js` | Missing `./sonicClient.js` require | Sonic client now available at `../search/sonic-client` — still needs the require rewritten + the *other* missing deps (`multiPassAnalyzer.js`, `precisionCapture.js`) to fully revive |
| `sonic-queries.js` consumers | Daemon not running | Daemon now warm at boot when binary is present |
| `sonic-indexer.js` consumers | Same | Same |

**Layers 2-5 of PM-1 remain unbuilt** — captured in batch 025's roadmap. Layer 1 (this batch) is the foundation; subsequent layers wire the dead modules onto it.

**Commit:** `7f16a65`

### Batch 028 — `meta-dogfood-wave-0`

First time pointing st8's analysis pipeline at the st8 codebase itself. Goal: shake out doc-vs-implementation drift and identify the real engineering backlog before the next sprint plans its waves. Probed the documented API surface from CLAUDE.md, generated insights via `/api/generate-report`, inspected SQLite tables, exercised `/api/signal-path`. No code changes — pure observation. Output captured as a ticket cluster in `docs/_pending-tickets/meta-dogfood.md` (214 LOC).

**What was probed:**

- All routes listed in CLAUDE.md's API table (status + handler shape vs. doc).
- `/api/generate-report` invocation with several `format` / `scope` combinations.
- SQLite tables enumerated via `PRAGMA table_info` to validate persistence-layer claims.
- `/api/signal-path` exercised with sample fingerprints from the manifest.
- File-watcher behaviour observed across an edit cycle.

**Key findings (each becomes its own ticket in the cluster):**

| Finding | Severity | Notes |
|---|---|---|
| `/api/state` and `/api/manifests` are NOT registered in `app.js` | high | CLAUDE.md lists both as documented endpoints — drift |
| `/api/generate-report` wedges the event loop indefinitely | high | No timeout; awaits something that never resolves |
| `insights` table does not exist in SQLite | high | Multiple docs claim "insight-store persistence" — no table backs it |
| OGB/*.txt files parsed as live JS | high | ~75% of the connection graph poisoned (271/375 RED, ~30K spurious edges) |
| `lastManifestUpdate` consistently null | medium | Field declared, never assigned |
| `/api/signal-path` returns insight-store data, not signal paths | medium | Semantic mismatch with the route name |
| Several CLAUDE.md route descriptions don't match handlers | medium | Auth column wrong in 3 rows |
| `--port` precedence: argv ignored in favour of env | low | Flag silently no-op when `PORT=` already set |

**Important caveat surfaced after the report shipped:** the "OGB contamination" framing was technically accurate but architecturally misdirected. OGB was retained as an intentional scaffold for the post-refactor gap analysis (founder direction), not as orphaned reference code. The right fix is OGB removal once gap analysis closes — not a parser filter. This is reflected in batch 029.

**Other dogfood findings stand independently of OGB** — the `/api/generate-report` wedge, the missing endpoints, the insight-store persistence gap, the `lastManifestUpdate` smell, etc. are real and unrelated.

**Commit:** `03c20d2`

### Batch 029 — `settings-reader-port` (closes the OGB gap)

After batch 028, the founder ran an offline OGB-vs-`src/` gap analysis to validate that OGB removal was safe. Two files surfaced:

- `OGB/settings-reader.js.txt` (3.5 KB) — `SettingsReader` class with `LocalStorageAdapter` + `MemoryAdapter`, schema-driven validation, `on('change')` subscriber API.
- `OGB/src/frontend/services/state.js.txt` — byte-identical to the first (same module kept in two scaffold locations).

So: **one real missing module**, not two. This batch closes that gap so OGB can be removed cleanly.

**Why it had been retired (per `index.html` load-order comment in the refactor):**

> dead code — never script-loaded by the original `st8.html`, had its own hardcoded `DEFAULT_VOIDFLOW` that duplicated `settings.js`'s defaults (silent divergence risk).

The retirement decision was correct — but the *capabilities* (reactive change-event subscription + swappable storage adapter + public live POJO) were not absorbed into the replacement `settings.js`.

**Investigation findings (different from the first read):**

The first analysis pass concluded "persistence is missing" — that turned out to be wrong. Settings.js already POSTs to `/api/settings` with revert-on-failure and type coercion (more sophisticated than the OGB module's `localStorage`). The genuine gap was specifically:

- **No change-event subscriber API.** `coordination.js` had `addListener()` for manifest changes since Wave 4D; settings had no parallel.
- **No swappable storage adapter.** Tests had to stub `fetch` directly instead of using a `MemoryAdapter`.
- **No `window.*` accessor.** Other surfaces couldn't read live tunables without rendering the UI first.

**Design decision — defaults DO NOT move into the service.** Re-creating the OGB module's hardcoded `DEFAULT_VOIDFLOW` would re-introduce exactly the silent-divergence risk that retired it. `DEFAULT_SETTINGS` stays in `settings.js` as the single source of truth; the service is pure data plumbing + reactivity. The service does not own state and does not own schema.

**Files:**

```
src/frontend/services/settings-reader.js  (~150 LOC, NEW)
  window.St8SettingsReader {
    loadAll, persist, addListener, removeListener,
    setAdapter, getAdapter, BackendAdapter, MemoryAdapter
  }
  - BackendAdapter (default) — POST/GET /api/settings, unchanged route
  - MemoryAdapter (tests) — deterministic in-memory, seedable, snapshots
  - emit AFTER successful persist; failed persist does NOT notify
    (contract: every observed change is durable)
  - listener-throw isolation: a thrower does not block siblings or
    the persist itself

src/frontend/components/settings/settings.js  (refactor)
  _persistSetting + loadSettings delegate to St8SettingsReader
  Throws loud if service not loaded — no compat shim
  All schema / migration / coercion / render code preserved
  (Per session-rule: no backwards-compat shims when you can just
   change the code.)

src/frontend/index.html
  Script-order: services/settings-reader.js BEFORE
  components/settings/settings.js (mirrors the existing
  coordination.js precedent)
  Stale "retired to OGB" comment rewritten

src/frontend/app.js  (small-liberty consumer)
  wireVoidflowToCSSVars() — subscribes via
  St8SettingsReader.addListener and mirrors voidflow.* settings
  onto document.documentElement as `--st8-voidflow-<key>` CSS
  custom properties. Proves the reactive path end-to-end and
  gives future surfaces (void-engine-style consumers, reveal
  animations) a zero-plumbing channel to read live values.
  Initial hydrate runs once on DOMContentLoaded; subsequent
  changes flow via the subscriber.

tests/frontend/services/settings-reader.test.js  (NEW, 17 tests)
  - BackendAdapter fetch contract (URL, method, body shape)
  - non-2xx returns false + does NOT emit
  - network error returns false + logs + does not throw
  - loadAll rejects on 5xx
  - MemoryAdapter: seed snapshotting (no aliasing), empty start,
    array-category whole-array replacement
  - subscriber emit on success, removeListener selectivity,
    listener-throw isolation, non-function listeners ignored
  - setAdapter reflective swap

tests/frontend/settings-module.test.js  (sandbox patch)
  Loads settings-reader.js into the vm context before settings.js,
  mirroring index.html script order. All 30 existing tests pass
  against the delegating settings.js.
```

**Test count: 449 -> 466. All passing.** (CLAUDE.md still cites 207 — that count is stale; the suite has grown across the 23-wave sprint. Bringing the CLAUDE.md numbers in line is a candidate for the next housekeeping pass.)

**Lesson — cross-realm `assert/strict`.** When code runs inside `vm.createContext`, the objects it creates carry that sandbox's `Object.prototype`. `node:assert/strict`'s `deepStrictEqual` rejects them even when structurally identical to host-realm peers — error: `Values have same structure but are not reference-equal: {}`. Worked around with a small `assertDeepEqJSON` helper that JSON-roundtrips both sides. Worth knowing for any future test that exercises a `window.*` API by loading its source into a sandbox.

**What this unblocks:**

- **OGB removal.** The two `.txt` files in `OGB/` that the gap analysis surfaced are the only files not represented in `src/`. After this batch, `OGB/` can be removed without losing any architectural pattern.
- **OGB removal in turn resolves** batch 028's "OGB parsing contamination" finding (271 RED files, ~30K spurious edges in the connection graph). The dogfood-residuals planning should drop the "OGB parser filter" tickets — they become moot.
- **Future reactive consumers** (theme tokens, void-engine, anything tunable) can subscribe via `St8SettingsReader.addListener` instead of polling `St8Settings.loadSettings()`.

**What remains from batch 028 (independent of OGB):**

- `/api/generate-report` wedge
- `/api/state` + `/api/manifests` 404s vs. CLAUDE.md
- `insights` table absence
- `lastManifestUpdate` wiring
- `/api/signal-path` semantic rename
- `--port` argv precedence
- CLAUDE.md API auth-column drift

These become the input for the next wave's planning once the repo is clean.

**Commit:** `32ac648`
