# ST8 Proposed Directory Structure — Visual Reference

## Current Structure (Problems Highlighted)

```
st8/
├── st8.html                    # ❌ 2587 lines (CSS+HTML+JS mixed)
├── file-explorer.js            # ⚠️ Root-level frontend
├── phreak-terminal.js          # ⚠️ Root-level frontend
├── graph-visualizer.js         # ⚠️ Root-level frontend
├── settings-ui.js              # ⚠️ Root-level frontend
├── coordination.js             # ⚠️ Root-level frontend
├── settings-reader.js          # ⚠️ Root-level frontend
├── start.js                    # Entry point
├── package.json
│
├── backend/
│   ├── index.js                # Entry point (435 lines)
│   ├── server.js               # ❌ 1430 lines (monolithic)
│   ├── persistence.js          # ❌ 704 lines (schema+queries+logic)
│   ├── indexer.js              # ⚠️ Feature, not infrastructure
│   ├── st8-types.js            # ⚠️ Shared types in backend
│   ├── schemaCardEmitter.js    # ⚠️ Feature, not infrastructure
│   ├── schemaCardPrinter.js    # ⚠️ Feature, not infrastructure
│   ├── notificationBus.js      # Infrastructure
│   ├── gapAnalyzer.js          # ⚠️ Feature, not infrastructure
│   ├── intentSeeder.js         # ⚠️ Feature, not infrastructure
│   ├── prdGenerator.js         # ⚠️ Feature, not infrastructure
│   ├── manifestGenerator.js    # Feature
│   ├── fileWatcher.js          # Feature
│   ├── brunoOscar.js           # Feature
│   ├── templateEngine.js       # Feature
│   └── verify-persistence-fixes.js  # ❌ Dead code
│
├── lib/
│   ├── utils/
│   │   ├── astParser.js        # ⚠️ Used by indexing feature
│   │   ├── safeFs.js           # Shared utility
│   │   ├── ioChan.js           # Shared utility
│   │   └── groundPlane.js      # Shared utility
│   └── commands/
│       ├── graphBuilder.js     # ⚠️ Feature, not command
│       ├── graphTraversal.js   # ⚠️ Feature, not command
│       ├── backgroundIndexer.js # ❌ Likely dead
│       ├── overview.js         # ❌ Likely dead
│       ├── parserPersistence.js # ❌ Likely dead
│       ├── insightStore.js     # ❌ Likely dead
│       └── integr8/            # ❌ DEAD CODE (never called)
│           ├── index.js
│           ├── dataIngestion.js
│           ├── relationshipAnalyzer.js
│           ├── pathGenerator.js
│           ├── tomlSerializer.js
│           ├── reportGenerator.js
│           ├── databasePersister.js
│           └── types.js
│
└── .st8/                       # Output directory
```

## Proposed Structure (Clean Architecture)

```
st8/
├── src/                              # All source code
│   │
│   ├── core/                         # Infrastructure layer
│   │   ├── database/                 # SQLite management
│   │   │   ├── connection.js         # Connection factory
│   │   │   ├── schema/
│   │   │   │   ├── 001_initial.sql
│   │   │   │   └── 002_prd_tables.sql
│   │   │   ├── migrations/
│   │   │   │   ├── runner.js
│   │   │   │   └── migrations.js
│   │   │   ├── queries/
│   │   │   │   ├── file-registry.js
│   │   │   │   ├── connections.js
│   │   │   │   ├── file-intent.js
│   │   │   │   ├── mutation-log.js
│   │   │   │   ├── activity-log.js
│   │   │   │   ├── settings.js
│   │   │   │   └── prd-projects.js
│   │   │   └── index.js              # Public API
│   │   │
│   │   ├── server/                   # HTTP server
│   │   │   ├── app.js                # Express setup
│   │   │   ├── routes/
│   │   │   │   ├── index.js          # Route registry
│   │   │   │   └── api/
│   │   │   │       ├── files.js
│   │   │   │       ├── connections.js
│   │   │   │       ├── schema-cards.js
│   │   │   │       ├── settings.js
│   │   │   │       ├── health.js
│   │   │   │       └── sse.js
│   │   │   ├── middleware/
│   │   │   │   ├── error-handler.js
│   │   │   │   ├── request-logger.js
│   │   │   │   └── cors.js
│   │   │   └── index.js              # Startup
│   │   │
│   │   ├── config/                   # Configuration
│   │   │   ├── default.js
│   │   │   ├── development.js
│   │   │   ├── production.js
│   │   │   ├── schema.js
│   │   │   ├── loader.js
│   │   │   └── index.js
│   │   │
│   │   ├── logging/                  # Structured logging
│   │   │   ├── logger.js
│   │   │   ├── formatters.js
│   │   │   └── index.js
│   │   │
│   │   └── errors/                   # Error handling
│   │       ├── st8-error.js
│   │       ├── database-error.js
│   │       ├── validation-error.js
│   │       ├── indexing-error.js
│   │       ├── handler.js
│   │       └── index.js
│   │
│   ├── features/                     # Domain features
│   │   ├── indexing/                 # File indexing engine
│   │   │   ├── indexer.js
│   │   │   ├── ast-parser.js
│   │   │   ├── file-scanner.js
│   │   │   ├── fingerprint.js
│   │   │   ├── indexer.test.js
│   │   │   └── index.js
│   │   │
│   │   ├── analysis/                 # Gap analysis, intent seeding
│   │   │   ├── gap-analyzer.js
│   │   │   ├── intent-seeder.js
│   │   │   ├── gap-analyzer.test.js
│   │   │   ├── intent-seeder.test.js
│   │   │   └── index.js
│   │   │
│   │   ├── schema-cards/             # Schema card generation
│   │   │   ├── emitter.js
│   │   │   ├── printer.js
│   │   │   ├── emitter.test.js
│   │   │   ├── printer.test.js
│   │   │   └── index.js
│   │   │
│   │   ├── prd/                      # PRD generation
│   │   │   ├── generator.js
│   │   │   ├── templates/
│   │   │   │   ├── default.md
│   │   │   │   └── technical.md
│   │   │   ├── generator.test.js
│   │   │   └── index.js
│   │   │
│   │   ├── graph/                    # Graph building/traversal
│   │   │   ├── builder.js
│   │   │   ├── traversal.js
│   │   │   ├── visualizer.js
│   │   │   ├── builder.test.js
│   │   │   ├── traversal.test.js
│   │   │   └── index.js
│   │   │
│   │   ├── watcher/                  # File watching
│   │   │   ├── file-watcher.js
│   │   │   ├── debounce.js
│   │   │   ├── file-watcher.test.js
│   │   │   └── index.js
│   │   │
│   │   └── lifecycle/                # File lifecycle management
│   │       ├── bruno.js
│   │       ├── bruno.test.js
│   │       └── index.js
│   │
│   ├── frontend/                     # UI layer
│   │   ├── components/
│   │   │   ├── file-explorer/
│   │   │   │   ├── file-explorer.js
│   │   │   │   ├── file-explorer.css
│   │   │   │   └── file-explorer.test.js
│   │   │   ├── terminal/
│   │   │   │   ├── terminal.js
│   │   │   │   ├── terminal.css
│   │   │   │   └── terminal.test.js
│   │   │   ├── graph-viewer/
│   │   │   │   ├── graph-viewer.js
│   │   │   │   ├── graph-viewer.css
│   │   │   │   └── graph-viewer.test.js
│   │   │   ├── settings/
│   │   │   │   ├── settings.js
│   │   │   │   ├── settings.css
│   │   │   │   └── settings.test.js
│   │   │   ├── prd-wizard/
│   │   │   │   ├── prd-wizard.js
│   │   │   │   ├── prd-wizard.css
│   │   │   │   └── prd-wizard.test.js
│   │   │   └── notifications/
│   │   │       ├── toast.js
│   │   │       └── toast.css
│   │   │
│   │   ├── services/
│   │   │   ├── api.js                # HTTP client
│   │   │   ├── state.js              # State management
│   │   │   ├── events.js             # Event bus
│   │   │   ├── workspace.js          # Workspace management
│   │   │   └── coordination.js       # Multi-LLM sync
│   │   │
│   │   ├── styles/
│   │   │   ├── base.css              # Reset, variables
│   │   │   ├── layout.css            # Grid, panels
│   │   │   ├── themes.css            # Color schemes
│   │   │   ├── animations.css        # Transitions
│   │   │   └── index.css             # Import all
│   │   │
│   │   ├── app.js                    # Entry point
│   │   └── index.html                # Minimal shell
│   │
│   └── shared/                       # Cross-cutting concerns
│       ├── types/
│       │   ├── st8-types.js
│       │   ├── file-entry.js
│       │   ├── schema-card.js
│       │   └── index.js
│       │
│       ├── utils/
│       │   ├── safe-fs.js
│       │   ├── io-chan.js
│       │   ├── ground-plane.js
│       │   ├── crypto.js
│       │   ├── path.js
│       │   └── index.js
│       │
│       └── constants/
│           ├── file-extensions.js
│           ├── lifecycle-phases.js
│           ├── file-status.js
│           ├── mutation-types.js
│           └── index.js
│
├── tests/                            # Test suite
│   ├── unit/
│   │   ├── core/
│   │   │   ├── database/
│   │   │   │   ├── connection.test.js
│   │   │   │   └── queries/
│   │   │   └── server/
│   │   │       └── routes/
│   │   ├── features/
│   │   │   ├── indexing/
│   │   │   ├── analysis/
│   │   │   └── schema-cards/
│   │   └── shared/
│   │       ├── utils/
│   │       └── types/
│   │
│   ├── integration/
│   │   ├── api.test.js
│   │   ├── database.test.js
│   │   └── indexing.test.js
│   │
│   ├── e2e/
│   │   ├── workflow.test.js
│   │   └── ui.test.js
│   │
│   └── fixtures/
│       ├── sample-files/
│       ├── expected-outputs/
│       └── test-db/
│
├── scripts/                          # Build/dev scripts
│   ├── build.js
│   ├── dev.js
│   ├── migrate.js
│   └── seed.js
│
├── docs/                             # Documentation
│   ├── architecture.md
│   ├── api.md
│   ├── contributing.md
│   └── migration-guide.md
│
├── .st8/                             # Output directory
├── .planning/                        # Planning documents
├── .eslintrc.js
├── .prettierrc
├── jest.config.js
├── package.json
└── README.md
```

## Quick Reference: Where Does X Go?

| What | Where |
|------|-------|
| New API endpoint | `src/core/server/routes/api/` |
| New database query | `src/core/database/queries/` |
| New analysis feature | `src/features/analysis/` |
| New UI component | `src/frontend/components/` |
| New shared utility | `src/shared/utils/` |
| New type definition | `src/shared/types/` |
| New constant | `src/shared/constants/` |
| Configuration | `src/core/config/` |
| Logging | `src/core/logging/` |
| Error handling | `src/core/errors/` |

## Import Examples

```javascript
// Backend: Import database
const { queries, getConnection } = require('../src/core/database');

// Backend: Import feature
const { indexDirectory } = require('../src/features/indexing');

// Backend: Import shared types
const { LifecyclePhase, FileStatus } = require('../src/shared/types');

// Backend: Import config
const config = require('../src/core/config');

// Backend: Import logger
const logger = require('../src/core/logging');

// Frontend: Import component
import { FileExplorer } from './components/file-explorer/file-explorer.js';

// Frontend: Import service
import { api } from './services/api.js';

// Frontend: Import styles
import './styles/index.css';
```

## Key Principles

1. **Infrastructure in `core/`** — Database, server, config, logging, errors
2. **Domain logic in `features/`** — Each feature is self-contained
3. **UI in `frontend/`** — Components, services, styles
4. **Shared code in `shared/`** — Types, utils, constants
5. **Tests mirror source** — `tests/unit/features/indexing/` mirrors `src/features/indexing/`
6. **Barrel exports** — Every directory has `index.js` for clean imports
7. **Kebab-case files** — `file-registry.js`, not `fileRegistry.js`
8. **One concern per file** — No 1000+ line monoliths

---

*Reference: CODEBASE_ARCHITECTURE_RESEARCH.md for full details*
