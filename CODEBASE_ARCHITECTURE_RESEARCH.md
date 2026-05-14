# ST8 Codebase Architecture Research & Proposed Structure

## Executive Summary

ST8 is a **standalone codebase analysis tool** with a Node.js backend (SQLite, file watching, HTTP server) and vanilla JS frontend. The current structure has grown organically and suffers from oversized files, inconsistent patterns, and unclear separation of concerns.

**Key Findings:**
- `server.js` (1430 lines) and `persistence.js` (704 lines) need decomposition
- `st8.html` (2585 lines) mixes CSS, HTML, and JS in one file
- `lib/` directory contains both reusable utilities and domain-specific commands
- Frontend uses `window.*` global attachment pattern (acceptable for vanilla JS, but needs organization)
- Dead code exists in `lib/commands/integr8/` (orchestrator never called)
- No testing framework, no structured logging, no consistent error handling

---

## 1. Current State Analysis

### 1.1 File Size Hotspots

| File | Lines | Issue |
|------|-------|-------|
| `st8.html` | 2587 | CSS + HTML + JS all in one file |
| `backend/server.js` | 1430 | Monolithic HTTP server with all routes |
| `phreak-terminal.js` | 1086 | Large but acceptable for a feature module |
| `lib/utils/astParser.js` | 1065 | Core utility, acceptable size |
| `backend/persistence.js` | 704 | Schema + queries + business logic mixed |
| `backend/gapAnalyzer.js` | 651 | Domain logic, acceptable |
| `lib/utils/safeFs.js` | 598 | Utility, acceptable |

### 1.2 Dependency Graph (Current)

```
backend/index.js (entry point)
├── backend/indexer.js
├── backend/persistence.js
│   └── lib/commands/integr8/databasePersister.js
├── backend/manifestGenerator.js
├── backend/fileWatcher.js
├── backend/server.js
├── backend/st8-types.js
├── backend/schemaCardEmitter.js
├── backend/schemaCardPrinter.js
├── backend/notificationBus.js
├── backend/gapAnalyzer.js
└── backend/intentSeeder.js

lib/utils/
├── astParser.js (used by indexer, index.js)
├── safeFs.js (used by indexer)
├── ioChan.js (used by indexer)
└── groundPlane.js (used by indexer)

lib/commands/
├── graphBuilder.js
├── graphTraversal.js
├── backgroundIndexer.js
├── overview.js
├── parserPersistence.js
├── insightStore.js
└── integr8/ (DEAD CODE - orchestrator never called)
```

### 1.3 Identified Problems

1. **Oversized Files:**
   - `server.js`: All HTTP routes, static serving, SSE, WebSocket in one file
   - `persistence.js`: Schema definition, migrations, queries, business logic
   - `st8.html`: 1500+ lines of CSS, 70+ lines of HTML, 800+ lines of JS

2. **Inconsistent Module Patterns:**
   - Some modules use classes (`St8Server`, `St8Persistence`)
   - Some use plain functions (`indexDirectory`, `writeManifests`)
   - Some export singletons (`notificationBus`)
   - Mix of `require()` at top vs. inline `require()`

3. **Unclear Separation:**
   - `lib/` contains both reusable utilities and domain-specific commands
   - `backend/` mixes infrastructure (server, persistence) with domain logic (gapAnalyzer, intentSeeder)
   - Frontend files at root level alongside backend

4. **Dead Code:**
   - `lib/commands/integr8/index.js` - Compiled TypeScript orchestrator, never called
   - Duplicate schema definitions in `persistence.js` and `indexer.js`

5. **Missing Infrastructure:**
   - No testing framework
   - No structured logging
   - No consistent error handling pattern
   - No configuration management
   - No build tooling (ESLint, Prettier)

---

## 2. Best Practices Research

### 2.1 Node.js Project Structure Patterns

**Pattern 1: Layer-Based (Current Approach)**
```
backend/
  controllers/
  services/
  repositories/
frontend/
  components/
  services/
shared/
  types/
  utils/
```
✅ Good for: Small teams, clear backend/frontend split
❌ Bad for: Feature cohesion, large codebases

**Pattern 2: Feature-Based (Recommended for ST8)**
```
features/
  indexing/
    indexer.js
    indexer.test.js
    indexer.routes.js
  persistence/
    schema.js
    queries.js
    migrations.js
  analysis/
    gapAnalyzer.js
    intentSeeder.js
shared/
  utils/
  types/
```
✅ Good for: Feature cohesion, scalability
❌ Bad for: Cross-cutting concerns

**Pattern 3: Hybrid (Recommended for ST8's Scale)**
```
src/
  core/           # Shared infrastructure
    database/
    server/
    config/
    logging/
  features/       # Domain features
    indexing/
    analysis/
    schema-cards/
    prd/
  frontend/       # UI layer
    components/
    services/
    styles/
  shared/         # Cross-cutting
    types/
    utils/
```
✅ Good for: Balance of cohesion and separation
❌ Bad for: Very small projects (overhead)

### 2.2 SQLite Organization Best Practices

**Recommended Pattern:**
```
database/
  schema/
    001_initial.sql
    002_add_prd_tables.sql
  migrations/
    runner.js
    migrations.js
  queries/
    file-registry.js
    connections.js
    activity-log.js
  connection.js          # Single connection factory
```

**Key Principles:**
- Separate schema definition from query logic
- Use migration files (numbered, timestamped)
- One query file per table/feature
- Single connection factory with pooling

### 2.3 Frontend Organization (Vanilla JS)

**Recommended Pattern:**
```
frontend/
  components/
    file-explorer/
      file-explorer.js
      file-explorer.css
      file-explorer.test.js
    terminal/
      terminal.js
      terminal.css
    graph/
      visualizer.js
      visualizer.css
  services/
    api.js              # HTTP client
    state.js            # Simple state management
    events.js           # Event bus
  styles/
    base.css            # Reset, variables
    layout.css          # Grid, panels
    themes.css          # Color schemes
  app.js                # Entry point
  index.html            # Minimal shell
```

**Key Principles:**
- One component per directory (JS + CSS + test)
- Services layer for API communication
- Separate CSS by concern (base, layout, components)
- Minimal HTML shell, components inject into DOM

### 2.4 Configuration Management

**Recommended Pattern:**
```
config/
  default.js            # Default configuration
  development.js        # Dev overrides
  production.js         # Prod overrides
  schema.js             # Config validation schema
  loader.js             # Config loading logic
```

**Key Principles:**
- Environment-based configuration
- Validation on startup
- Single source of truth
- No hardcoded paths

### 2.5 Error Handling Patterns

**Recommended Pattern:**
```javascript
// Custom error classes
class St8Error extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

class DatabaseError extends St8Error { ... }
class ValidationError extends St8Error { ... }

// Centralized error handler
function handleError(err, req, res, next) {
  if (err instanceof St8Error) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details
    });
  }
  // Unknown error
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'INTERNAL_ERROR' });
}
```

### 2.6 Logging Best Practices

**Recommended Pattern:**
```javascript
// Use pino or winston
const logger = require('pino')({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined
});

// Structured logging
logger.info({ file: 'indexer.js', action: 'index_start', target: dir }, 'Starting index');
logger.error({ error: err, file: path }, 'Index failed');
```

**Key Principles:**
- Structured JSON logging (pino/winston)
- Log levels (error, warn, info, debug)
- Context injection (file, action, request_id)
- Performance logging (timing)

### 2.7 Testing Strategy

**Recommended Pattern:**
```
tests/
  unit/
    backend/
      persistence.test.js
      indexer.test.js
    lib/
      astParser.test.js
  integration/
    api.test.js
    database.test.js
  e2e/
    workflow.test.js
  fixtures/
    sample-files/
    expected-outputs/
  helpers/
    test-db.js
    mock-server.js
```

**Key Principles:**
- Unit tests for utilities and business logic
- Integration tests for database and API
- E2E tests for critical workflows
- Test fixtures for reproducible scenarios

---

## 3. Proposed Directory Structure

### 3.1 High-Level Overview

```
st8/
├── src/                          # All source code
│   ├── core/                     # Infrastructure layer
│   │   ├── database/             # SQLite management
│   │   ├── server/               # HTTP server
│   │   ├── config/               # Configuration
│   │   ├── logging/              # Structured logging
│   │   └── errors/               # Error handling
│   │
│   ├── features/                 # Domain features
│   │   ├── indexing/             # File indexing engine
│   │   ├── analysis/             # Gap analysis, intent seeding
│   │   ├── schema-cards/         # Schema card generation
│   │   ├── prd/                  # PRD generation
│   │   ├── graph/                # Graph building/traversal
│   │   └── watcher/              # File watching
│   │
│   ├── frontend/                 # UI layer
│   │   ├── components/           # UI components
│   │   ├── services/             # Frontend services
│   │   ├── styles/               # CSS organization
│   │   ├── app.js                # Entry point
│   │   └── index.html            # HTML shell
│   │
│   └── shared/                   # Cross-cutting concerns
│       ├── types/                # Type definitions
│       ├── utils/                # Reusable utilities
│       └── constants/            # Shared constants
│
├── tests/                        # Test suite
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│
├── scripts/                      # Build/dev scripts
│   ├── build.js
│   ├── dev.js
│   └── migrate.js
│
├── docs/                         # Documentation
│   ├── architecture.md
│   ├── api.md
│   └── contributing.md
│
├── .st8/                         # Output directory
├── .planning/                    # Planning documents
├── package.json
└── README.md
```

### 3.2 Detailed Structure

#### `src/core/database/`

```
database/
├── connection.js                 # SQLite connection factory
├── schema/
│   ├── 001_initial.sql           # Initial schema
│   ├── 002_prd_tables.sql        # PRD-related tables
│   └── 003_indexes.sql           # Performance indexes
├── migrations/
│   ├── runner.js                 # Migration executor
│   └── migrations.js             # Migration registry
├── queries/
│   ├── file-registry.js          # file_registry CRUD
│   ├── connections.js            # connections CRUD
│   ├── file-intent.js            # file_intent CRUD
│   ├── mutation-log.js           # file_mutation_log CRUD
│   ├── activity-log.js           # activity_log CRUD
│   ├── settings.js               # st8_settings CRUD
│   └── prd-projects.js           # prd_projects CRUD
└── index.js                      # Public API
```

**Migration from `persistence.js`:**
- Extract schema → `schema/001_initial.sql`
- Extract queries → `queries/*.js`
- Keep connection logic → `connection.js`
- Add migration runner → `migrations/runner.js`

#### `src/core/server/`

```
server/
├── app.js                        # Express app setup
├── routes/
│   ├── index.js                  # Route registry
│   ├── api/
│   │   ├── files.js              # /api/files endpoints
│   │   ├── connections.js        # /api/connections endpoints
│   │   ├── schema-cards.js       # /api/schema-cards endpoints
│   │   ├── settings.js           # /api/settings endpoints
│   │   ├── health.js             # /api/health endpoint
│   │   └── sse.js                # Server-Sent Events
│   └── static.js                 # Static file serving
├── middleware/
│   ├── error-handler.js          # Centralized error handling
│   ├── request-logger.js         # Request logging
│   └── cors.js                   # CORS configuration
└── index.js                      # Server startup
```

**Migration from `server.js`:**
- Extract routes → `routes/api/*.js`
- Extract middleware → `middleware/*.js`
- Keep app setup → `app.js`
- Keep startup → `index.js`

#### `src/core/config/`

```
config/
├── default.js                    # Default configuration
├── development.js                # Dev overrides
├── production.js                 # Prod overrides
├── schema.js                     # Validation schema
├── loader.js                     # Config loading logic
└── index.js                      # Public API
```

**Configuration Keys:**
```javascript
{
  database: {
    path: './.st8/st8.db',
    walMode: true
  },
  server: {
    port: 3847,
    host: '127.0.0.1'
  },
  indexing: {
    watchDebounceMs: 500,
    codeExtensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go', '.md', '.txt', '.json']
  },
  logging: {
    level: 'info',
    pretty: false
  }
}
```

#### `src/core/logging/`

```
logging/
├── logger.js                     # Logger factory (pino)
├── formatters.js                 # Custom formatters
└── index.js                      # Public API
```

#### `src/core/errors/`

```
errors/
├── st8-error.js                  # Base error class
├── database-error.js             # Database errors
├── validation-error.js           # Validation errors
├── indexing-error.js             # Indexing errors
├── handler.js                    # Centralized handler
└── index.js                      # Public API
```

#### `src/features/indexing/`

```
indexing/
├── indexer.js                    # Main indexing engine
├── ast-parser.js                 # AST extraction (moved from lib/utils/)
├── file-scanner.js               # File discovery
├── fingerprint.js                # File identity generation
├── indexer.test.js               # Unit tests
└── index.js                      # Public API
```

**Migration from:**
- `backend/indexer.js` → `indexing/indexer.js`
- `lib/utils/astParser.js` → `indexing/ast-parser.js`
- `backend/st8-types.js` (fingerprint) → `indexing/fingerprint.js`

#### `src/features/analysis/`

```
analysis/
├── gap-analyzer.js               # 6-dimension gap analysis
├── intent-seeder.js              # Auto-generate intent from AST
├── gap-analyzer.test.js
├── intent-seeder.test.js
└── index.js                      # Public API
```

**Migration from:**
- `backend/gapAnalyzer.js` → `analysis/gap-analyzer.js`
- `backend/intentSeeder.js` → `analysis/intent-seeder.js`

#### `src/features/schema-cards/`

```
schema-cards/
├── emitter.js                    # Schema card JSON generation
├── printer.js                    # Human-readable .txt fallback
├── emitter.test.js
├── printer.test.js
└── index.js                      # Public API
```

**Migration from:**
- `backend/schemaCardEmitter.js` → `schema-cards/emitter.js`
- `backend/schemaCardPrinter.js` → `schema-cards/printer.js`

#### `src/features/prd/`

```
prd/
├── generator.js                  # PRD generation from schema cards
├── templates/                    # PRD templates
│   ├── default.md
│   └── technical.md
├── generator.test.js
└── index.js                      # Public API
```

**Migration from:**
- `backend/prdGenerator.js` → `prd/generator.js`

#### `src/features/graph/`

```
graph/
├── builder.js                    # Dependency graph builder
├── traversal.js                  # Graph traversal and queries
├── visualizer.js                 # D3.js graph renderer
├── builder.test.js
├── traversal.test.js
└── index.js                      # Public API
```

**Migration from:**
- `lib/commands/graphBuilder.js` → `graph/builder.js`
- `lib/commands/graphTraversal.js` → `graph/traversal.js`
- `graph-visualizer.js` → `graph/visualizer.js`

#### `src/features/watcher/`

```
watcher/
├── file-watcher.js               # File change detection
├── debounce.js                   # Debounce utility
├── file-watcher.test.js
└── index.js                      # Public API
```

**Migration from:**
- `backend/fileWatcher.js` → `watcher/file-watcher.js`

#### `src/frontend/components/`

```
components/
├── file-explorer/
│   ├── file-explorer.js          # File browser component
│   ├── file-explorer.css         # Component styles
│   └── file-explorer.test.js
├── terminal/
│   ├── terminal.js               # Terminal component
│   ├── terminal.css
│   └── terminal.test.js
├── graph-viewer/
│   ├── graph-viewer.js           # Graph visualization
│   ├── graph-viewer.css
│   └── graph-viewer.test.js
├── settings/
│   ├── settings.js               # Settings UI
│   ├── settings.css
│   └── settings.test.js
├── prd-wizard/
│   ├── prd-wizard.js             # PRD creation wizard
│   ├── prd-wizard.css
│   └── prd-wizard.test.js
└── notifications/
    ├── toast.js                  # Toast notifications
    └── toast.css
```

**Migration from:**
- `file-explorer.js` → `components/file-explorer/file-explorer.js`
- `phreak-terminal.js` → `components/terminal/terminal.js`
- `graph-visualizer.js` → `components/graph-viewer/graph-viewer.js`
- `settings-ui.js` → `components/settings/settings.js`

#### `src/frontend/services/`

```
services/
├── api.js                        # HTTP client (fetch wrapper)
├── state.js                      # Simple state management
├── events.js                     # Event bus (replaces window.*)
├── workspace.js                  # Workspace management
└── coordination.js               # Multi-LLM synchronization
```

**Migration from:**
- `coordination.js` → `services/coordination.js`
- New: `api.js`, `state.js`, `events.js`

#### `src/frontend/styles/`

```
styles/
├── base.css                      # Reset, CSS variables, typography
├── layout.css                    # Grid, panels, responsive
├── themes.css                    # Color schemes (dark/light)
├── animations.css                # Transitions, keyframes
└── index.css                     # Import all styles
```

**Migration from:**
- Extract from `st8.html` lines 137-1686

#### `src/shared/types/`

```
types/
├── st8-types.js                  # Canonical type definitions
├── file-entry.js                 # St8FileEntry shape
├── schema-card.js                # St8SchemaCard shape
└── index.js                      # Public API
```

**Migration from:**
- `backend/st8-types.js` → `types/st8-types.js`

#### `src/shared/utils/`

```
utils/
├── safe-fs.js                    # Fortified filesystem wrapper
├── io-chan.js                     # Priority-based I/O router
├── ground-plane.js               # Directory structure verification
├── crypto.js                     # Hashing utilities
├── path.js                       # Path utilities
└── index.js                      # Public API
```

**Migration from:**
- `lib/utils/safeFs.js` → `utils/safe-fs.js`
- `lib/utils/ioChan.js` → `utils/io-chan.js`
- `lib/utils/groundPlane.js` → `utils/ground-plane.js`

#### `src/shared/constants/`

```
constants/
├── file-extensions.js            # CODE_EXTENSIONS set
├── lifecycle-phases.js           # LifecyclePhase enum
├── file-status.js                # FileStatus enum
├── mutation-types.js             # MutationType enum
└── index.js                      # Public API
```

---

## 4. Migration Plan

### Phase 1: Foundation (Week 1)

**Goal:** Set up infrastructure without breaking existing functionality.

1. **Create directory structure:**
   ```bash
   mkdir -p src/{core,features,frontend,shared}
   mkdir -p src/core/{database,server,config,logging,errors}
   mkdir -p src/features/{indexing,analysis,chema-cards,prd,graph,watcher}
   mkdir -p src/frontend/{components,services,styles}
   mkdir -p src/shared/{types,utils,constants}
   mkdir -p tests/{unit,integration,e2e,fixtures}
   mkdir -p scripts docs
   ```

2. **Add tooling:**
   ```bash
   npm install --save-dev eslint prettier jest nodemon
   npm install pino pino-pretty
   ```

3. **Create configuration:**
   - `src/core/config/default.js`
   - `src/core/config/loader.js`
   - `src/core/config/index.js`

4. **Create logging:**
   - `src/core/logging/logger.js` (pino)
   - `src/core/logging/index.js`

5. **Create error handling:**
   - `src/core/errors/st8-error.js`
   - `src/core/errors/handler.js`
   - `src/core/errors/index.js`

### Phase 2: Database Decomposition (Week 2)

**Goal:** Split `persistence.js` into focused modules.

1. **Extract schema:**
   - `src/core/database/schema/001_initial.sql`
   - Copy schema from `persistence.js` lines 47-150

2. **Create connection factory:**
   - `src/core/database/connection.js`
   - Extract connection logic from `persistence.js`

3. **Extract queries:**
   - `src/core/database/queries/file-registry.js`
   - `src/core/database/queries/connections.js`
   - `src/core/database/queries/file-intent.js`
   - `src/core/database/queries/mutation-log.js`
   - `src/core/database/queries/activity-log.js`
   - `src/core/database/queries/settings.js`
   - `src/core/database/queries/prd-projects.js`

4. **Create migration runner:**
   - `src/core/database/migrations/runner.js`
   - `src/core/database/migrations/migrations.js`

5. **Create public API:**
   - `src/core/database/index.js`
   - Export: `getConnection()`, `runMigration()`, `queries`

6. **Update `backend/index.js`:**
   - Replace `require('./persistence')` with `require('../src/core/database')`
   - Verify functionality

### Phase 3: Server Decomposition (Week 3)

**Goal:** Split `server.js` into focused modules.

1. **Extract routes:**
   - `src/core/server/routes/api/files.js`
   - `src/core/server/routes/api/connections.js`
   - `src/core/server/routes/api/schema-cards.js`
   - `src/core/server/routes/api/settings.js`
   - `src/core/server/routes/api/health.js`
   - `src/core/server/routes/api/sse.js`

2. **Extract middleware:**
   - `src/core/server/middleware/error-handler.js`
   - `src/core/server/middleware/request-logger.js`
   - `src/core/server/middleware/cors.js`

3. **Create app setup:**
   - `src/core/server/app.js`
   - Wire routes and middleware

4. **Create startup:**
   - `src/core/server/index.js`
   - Extract startup logic

5. **Update `backend/index.js`:**
   - Replace `require('./server')` with `require('../src/core/server')`

### Phase 4: Feature Extraction (Week 4)

**Goal:** Move domain features to `src/features/`.

1. **Indexing:**
   - Move `backend/indexer.js` → `src/features/indexing/indexer.js`
   - Move `lib/utils/astParser.js` → `src/features/indexing/ast-parser.js`
   - Create `src/features/indexing/fingerprint.js`
   - Create `src/features/indexing/index.js`

2. **Analysis:**
   - Move `backend/gapAnalyzer.js` → `src/features/analysis/gap-analyzer.js`
   - Move `backend/intentSeeder.js` → `src/features/analysis/intent-seeder.js`
   - Create `src/features/analysis/index.js`

3. **Schema Cards:**
   - Move `backend/schemaCardEmitter.js` → `src/features/schema-cards/emitter.js`
   - Move `backend/schemaCardPrinter.js` → `src/features/schema-cards/printer.js`
   - Create `src/features/schema-cards/index.js`

4. **PRD:**
   - Move `backend/prdGenerator.js` → `src/features/prd/generator.js`
   - Create `src/features/prd/index.js`

5. **Graph:**
   - Move `lib/commands/graphBuilder.js` → `src/features/graph/builder.js`
   - Move `lib/commands/graphTraversal.js` → `src/features/graph/traversal.js`
   - Move `graph-visualizer.js` → `src/features/graph/visualizer.js`
   - Create `src/features/graph/index.js`

6. **Watcher:**
   - Move `backend/fileWatcher.js` → `src/features/watcher/file-watcher.js`
   - Create `src/features/watcher/index.js`

### Phase 5: Frontend Reorganization (Week 5)

**Goal:** Reorganize frontend code.

1. **Extract CSS:**
   - `src/frontend/styles/base.css` (lines 137-179)
   - `src/frontend/styles/layout.css` (lines 180-1010)
   - `src/frontend/styles/animations.css` (lines 817-855)
   - `src/frontend/styles/themes.css` (colors, fonts)

2. **Extract components:**
   - `src/frontend/components/file-explorer/file-explorer.js`
   - `src/frontend/components/file-explorer/file-explorer.css`
   - `src/frontend/components/terminal/terminal.js`
   - `src/frontend/components/terminal/terminal.css`
   - `src/frontend/components/graph-viewer/graph-viewer.js`
   - `src/frontend/components/graph-viewer/graph-viewer.css`
   - `src/frontend/components/settings/settings.js`
   - `src/frontend/components/settings/settings.css`
   - `src/frontend/components/prd-wizard/prd-wizard.js`
   - `src/frontend/components/prd-wizard/prd-wizard.css`
   - `src/frontend/components/notifications/toast.js`
   - `src/frontend/components/notifications/toast.css`

3. **Create services:**
   - `src/frontend/services/api.js`
   - `src/frontend/services/state.js`
   - `src/frontend/services/events.js`
   - `src/frontend/services/workspace.js`
   - `src/frontend/services/coordination.js`

4. **Create entry point:**
   - `src/frontend/app.js`
   - `src/frontend/index.html` (minimal shell)

5. **Update `st8.html`:**
   - Reduce to minimal shell (50-100 lines)
   - Import CSS and JS from `src/frontend/`

### Phase 6: Shared Utilities (Week 6)

**Goal:** Consolidate shared code.

1. **Types:**
   - Move `backend/st8-types.js` → `src/shared/types/st8-types.js`
   - Create `src/shared/types/index.js`

2. **Utils:**
   - Move `lib/utils/safeFs.js` → `src/shared/utils/safe-fs.js`
   - Move `lib/utils/ioChan.js` → `src/shared/utils/io-chan.js`
   - Move `lib/utils/groundPlane.js` → `src/shared/utils/ground-plane.js`
   - Create `src/shared/utils/crypto.js`
   - Create `src/shared/utils/path.js`
   - Create `src/shared/utils/index.js`

3. **Constants:**
   - Create `src/shared/constants/file-extensions.js`
   - Create `src/shared/constants/lifecycle-phases.js`
   - Create `src/shared/constants/file-status.js`
   - Create `src/shared/constants/mutation-types.js`
   - Create `src/shared/constants/index.js`

### Phase 7: Cleanup & Testing (Week 7)

**Goal:** Remove dead code, add tests.

1. **Remove dead code:**
   - Delete `lib/commands/integr8/` (entire directory)
   - Delete `backend/verify-persistence-fixes.js`
   - Delete `lib/commands/backgroundIndexer.js` (if unused)
   - Delete `lib/commands/overview.js` (if unused)
   - Delete `lib/commands/parserPersistence.js` (if unused)
   - Delete `lib/commands/insightStore.js` (if unused)

2. **Add tests:**
   - `tests/unit/backend/persistence.test.js`
   - `tests/unit/backend/indexer.test.js`
   - `tests/unit/lib/astParser.test.js`
   - `tests/integration/api.test.js`
   - `tests/integration/database.test.js`
   - `tests/e2e/workflow.test.js`

3. **Update package.json:**
   ```json
   {
     "scripts": {
       "start": "node src/core/server/index.js",
       "dev": "nodemon src/core/server/index.js",
       "test": "jest",
       "test:watch": "jest --watch",
       "lint": "eslint src/",
       "format": "prettier --write src/"
     }
   }
   ```

4. **Add configuration files:**
   - `.eslintrc.js`
   - `.prettierrc`
   - `jest.config.js`
   - `.gitignore` (update)

---

## 5. Migration Checklist

### Phase 1: Foundation
- [ ] Create directory structure
- [ ] Install dependencies (eslint, prettier, jest, pino)
- [ ] Create config module
- [ ] Create logging module
- [ ] Create error handling module
- [ ] Verify existing functionality works

### Phase 2: Database Decomposition
- [ ] Extract schema to SQL files
- [ ] Create connection factory
- [ ] Extract queries to separate files
- [ ] Create migration runner
- [ ] Create public API
- [ ] Update imports in `backend/index.js`
- [ ] Test database operations

### Phase 3: Server Decomposition
- [ ] Extract API routes
- [ ] Extract middleware
- [ ] Create app setup
- [ ] Create startup module
- [ ] Update imports in `backend/index.js`
- [ ] Test HTTP endpoints

### Phase 4: Feature Extraction
- [ ] Move indexing module
- [ ] Move analysis module
- [ ] Move schema-cards module
- [ ] Move PRD module
- [ ] Move graph module
- [ ] Move watcher module
- [ ] Update all imports
- [ ] Test each feature

### Phase 5: Frontend Reorganization
- [ ] Extract CSS files
- [ ] Extract components
- [ ] Create services layer
- [ ] Create entry point
- [ ] Update HTML imports
- [ ] Test UI functionality

### Phase 6: Shared Utilities
- [ ] Move types
- [ ] Move utils
- [ ] Create constants
- [ ] Update all imports
- [ ] Test shared code

### Phase 7: Cleanup & Testing
- [ ] Remove dead code
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Add E2E tests
- [ ] Update documentation
- [ ] Update README

---

## 6. Naming Conventions

### Files
- **Kebab-case:** `file-registry.js`, `gap-analyzer.js`, `ast-parser.js`
- **Test files:** `*.test.js` or `*.spec.js`
- **Index files:** `index.js` for public API

### Directories
- **Kebab-case:** `schema-cards/`, `file-explorer/`, `prd-wizard/`
- **Feature names:** `indexing/`, `analysis/`, `graph/`

### Variables & Functions
- **camelCase:** `fileRegistry`, `gapAnalyzer`, `extractImports`
- **PascalCase:** `St8Server`, `St8Persistence`, `SchemaCardEmitter`
- **UPPER_SNAKE:** `CODE_EXTENSIONS`, `DEFAULT_PORT`

### Constants
- **Enums:** `LifecyclePhase`, `FileStatus`, `MutationType`
- **Config keys:** `database.path`, `server.port`

---

## 7. Key Architectural Decisions

### 7.1 Module Pattern
**Decision:** Use CommonJS (`require`/`module.exports`) for Node.js, ES modules for frontend.

**Rationale:**
- Node.js ecosystem primarily uses CommonJS
- Frontend can use ES modules with bundler
- Avoids mixing module systems in backend

### 7.2 State Management
**Decision:** Simple singleton pattern for shared state (database connection, config).

**Rationale:**
- ST8 is a single-process application
- No need for complex state management (Redux, MobX)
- Singleton pattern is simple and sufficient

### 7.3 Error Handling
**Decision:** Custom error classes + centralized error handler.

**Rationale:**
- Typed errors enable specific handling
- Centralized handler ensures consistent responses
- Stack traces preserved for debugging

### 7.4 Logging
**Decision:** Use `pino` for structured logging.

**Rationale:**
- Fast, low-overhead logger
- JSON output for production
- Pretty-print for development
- Well-maintained, widely used

### 7.5 Testing
**Decision:** Use Jest for unit/integration tests, Playwright for E2E.

**Rationale:**
- Jest: Fast, built-in mocking, good DX
- Playwright: Cross-browser E2E testing
- Both widely used, well-documented

### 7.6 Build Tooling
**Decision:** No bundler for backend, optional bundler for frontend.

**Rationale:**
- Node.js doesn't need bundling
- Frontend can use esbuild/rollup if needed
- Keeps setup simple

---

## 8. Success Metrics

### Code Quality
- **File size:** No file > 500 lines (except tests)
- **Complexity:** Cyclomatic complexity < 10 per function
- **Coverage:** > 80% test coverage for core modules
- **Linting:** Zero ESLint errors

### Performance
- **Startup:** < 2 seconds for indexing
- **API response:** < 100ms for most endpoints
- **Memory:** < 200MB for typical projects

### Developer Experience
- **Onboarding:** New developer productive in < 1 hour
- **Debugging:** Stack traces point to correct source
- **Testing:** Tests run in < 30 seconds
- **Hot reload:** Changes visible in < 2 seconds

---

## 9. Risks & Mitigations

### Risk 1: Breaking Changes
**Mitigation:**
- Migrate one module at a time
- Keep old imports working with re-exports
- Run tests after each migration step

### Risk 2: Import Path Confusion
**Mitigation:**
- Use barrel exports (`index.js`)
- Document import conventions
- Use ESLint `no-restricted-imports` rule

### Risk 3: Frontend Complexity
**Mitigation:**
- Keep vanilla JS (no framework)
- Use simple component pattern
- Avoid over-engineering

### Risk 4: Database Migration Issues
**Mitigation:**
- Test migrations on copy of database
- Keep rollback scripts
- Version all migrations

---

## 10. Next Steps

1. **Review this document** with team
2. **Prioritize phases** based on immediate needs
3. **Create Phase 1 tasks** in planning tool
4. **Set up tooling** (ESLint, Prettier, Jest)
5. **Begin Phase 1** (Foundation)

---

## Appendix A: Current vs Proposed File Mapping

| Current File | Proposed Location | Notes |
|--------------|-------------------|-------|
| `backend/index.js` | `src/core/server/index.js` | Entry point |
| `backend/server.js` | `src/core/server/app.js` + routes | Split into modules |
| `backend/persistence.js` | `src/core/database/` | Split into modules |
| `backend/indexer.js` | `src/features/indexing/indexer.js` | Feature module |
| `backend/gapAnalyzer.js` | `src/features/analysis/gap-analyzer.js` | Feature module |
| `backend/intentSeeder.js` | `src/features/analysis/intent-seeder.js` | Feature module |
| `backend/schemaCardEmitter.js` | `src/features/schema-cards/emitter.js` | Feature module |
| `backend/schemaCardPrinter.js` | `src/features/schema-cards/printer.js` | Feature module |
| `backend/prdGenerator.js` | `src/features/prd/generator.js` | Feature module |
| `backend/fileWatcher.js` | `src/features/watcher/file-watcher.js` | Feature module |
| `backend/st8-types.js` | `src/shared/types/st8-types.js` | Shared types |
| `backend/notificationBus.js` | `src/core/server/events.js` | Server events |
| `backend/brunoOscar.js` | `src/features/lifecycle/bruno.js` | Feature module |
| `backend/templateEngine.js` | `src/features/prd/templates.js` | Feature module |
| `lib/utils/astParser.js` | `src/features/indexing/ast-parser.js` | Feature module |
| `lib/utils/safeFs.js` | `src/shared/utils/safe-fs.js` | Shared utility |
| `lib/utils/ioChan.js` | `src/shared/utils/io-chan.js` | Shared utility |
| `lib/utils/groundPlane.js` | `src/shared/utils/ground-plane.js` | Shared utility |
| `lib/commands/graphBuilder.js` | `src/features/graph/builder.js` | Feature module |
| `lib/commands/graphTraversal.js` | `src/features/graph/traversal.js` | Feature module |
| `file-explorer.js` | `src/frontend/components/file-explorer/` | Component |
| `phreak-terminal.js` | `src/frontend/components/terminal/` | Component |
| `graph-visualizer.js` | `src/frontend/components/graph-viewer/` | Component |
| `settings-ui.js` | `src/frontend/components/settings/` | Component |
| `coordination.js` | `src/frontend/services/coordination.js` | Service |
| `settings-reader.js` | `src/frontend/services/settings.js` | Service |
| `st8.html` | `src/frontend/index.html` | Minimal shell |

## Appendix B: Dead Code to Remove

| File | Reason |
|------|--------|
| `lib/commands/integr8/index.js` | Compiled TypeScript, never called |
| `lib/commands/integr8/dataIngestion.js` | Part of dead orchestrator |
| `lib/commands/integr8/relationshipAnalyzer.js` | Part of dead orchestrator |
| `lib/commands/integr8/pathGenerator.js` | Part of dead orchestrator |
| `lib/commands/integr8/tomlSerializer.js` | Part of dead orchestrator |
| `lib/commands/integr8/reportGenerator.js` | Part of dead orchestrator |
| `lib/commands/integr8/databasePersister.js` | Part of dead orchestrator |
| `lib/commands/integr8/types.js` | Part of dead orchestrator |
| `backend/verify-persistence-fixes.js` | Test script, not production code |
| `lib/commands/backgroundIndexer.js` | Check if used, likely dead |
| `lib/commands/overview.js` | Check if used, likely dead |
| `lib/commands/parserPersistence.js` | Check if used, likely dead |
| `lib/commands/insightStore.js` | Check if used, likely dead |

---

*Document generated: 2026-05-14*
*Author: GSD Domain Researcher*
