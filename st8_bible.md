# ST8 Bible — Architecture Reference

**Version:** 0.1.0  
**Date:** 2026-05-13  
**Purpose:** Complete architecture reference for the ST8 Full Stack Logic Analyzer

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

**Commit:** (filled in below)
