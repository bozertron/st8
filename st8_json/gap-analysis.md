# ST8 Gap Analysis Report

**Generated:** 2026-05-13T20:24:47.680Z
**Total Schema Cards:** 42

## D1: Lifecycle Progression

Found 42 files across 1 lifecycle phases. 42 files have intent and can progress.

### Phase Distribution

| Phase | Count | Files |
|-------|-------|-------|
| DEVELOPMENT | 42 | backend/fileWatcher.js, backend/gapAnalyzer.js, backend/index.js... |

### Files Ready to Progress

- `backend/fileWatcher.js` — Phase: DEVELOPMENT
- `backend/gapAnalyzer.js` — Phase: DEVELOPMENT
- `backend/index.js` — Phase: DEVELOPMENT
- `backend/indexer.js` — Phase: DEVELOPMENT
- `backend/intentSeeder.js` — Phase: DEVELOPMENT
- `backend/manifestGenerator.js` — Phase: DEVELOPMENT
- `backend/notificationBus.js` — Phase: DEVELOPMENT
- `backend/persistence.js` — Phase: DEVELOPMENT
- `backend/prdGenerator.js` — Phase: DEVELOPMENT
- `backend/schemaCardEmitter.js` — Phase: DEVELOPMENT
- `backend/schemaCardPrinter.js` — Phase: DEVELOPMENT
- `backend/server.js` — Phase: DEVELOPMENT
- `backend/st8-types.js` — Phase: DEVELOPMENT
- `backend/verify-persistence-fixes.js` — Phase: DEVELOPMENT
- `coordination.js` — Phase: DEVELOPMENT
- `fake-stream.js` — Phase: DEVELOPMENT
- `file-explorer.js` — Phase: DEVELOPMENT
- `graph-visualizer.js` — Phase: DEVELOPMENT
- `lib/commands/backgroundIndexer.js` — Phase: DEVELOPMENT
- `lib/commands/graphBuilder.js` — Phase: DEVELOPMENT
- `lib/commands/graphTraversal.js` — Phase: DEVELOPMENT
- `lib/commands/insightStore.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/dataIngestion.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/databasePersister.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/index.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/migrationExecutor.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/pathGenerator.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/relationshipAnalyzer.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/reportGenerator.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/tomlSerializer.js` — Phase: DEVELOPMENT
- `lib/commands/integr8/types.js` — Phase: DEVELOPMENT
- `lib/commands/overview.js` — Phase: DEVELOPMENT
- `lib/commands/parserPersistence.js` — Phase: DEVELOPMENT
- `lib/utils/astParser.js` — Phase: DEVELOPMENT
- `lib/utils/groundPlane.js` — Phase: DEVELOPMENT
- `lib/utils/ioChan.js` — Phase: DEVELOPMENT
- `lib/utils/safeFs.js` — Phase: DEVELOPMENT
- `phreak-terminal.js` — Phase: DEVELOPMENT
- `settings-reader.js` — Phase: DEVELOPMENT
- `settings-ui.js` — Phase: DEVELOPMENT
- `start.js` — Phase: DEVELOPMENT
- `void-engine.js` — Phase: DEVELOPMENT

## D2: Status Health

Status distribution: RED=29, GREEN=13. 29 RED files, 0 GREEN with low reachability.

### RED Files

| File | Reachability | Root Causes |
|------|--------------|-------------|
| `backend/fileWatcher.js` | 0 | Unknown |
| `backend/gapAnalyzer.js` | 0 | Unknown |
| `backend/index.js` | 0 | No importers — orphan file; No exports — cannot be consumed |
| `backend/indexer.js` | 0 | Unknown |
| `backend/intentSeeder.js` | 0 | No importers — orphan file |
| `backend/manifestGenerator.js` | 0 | Unknown |
| `backend/notificationBus.js` | 0 | Unknown |
| `backend/persistence.js` | 0 | Unknown |
| `backend/prdGenerator.js` | 0 | Unknown |
| `backend/schemaCardEmitter.js` | 0 | Unknown |
| `backend/schemaCardPrinter.js` | 0 | Unknown |
| `backend/server.js` | 0 | Unknown |
| `backend/st8-types.js` | 0 | Unknown |
| `backend/verify-persistence-fixes.js` | 0 | No importers — orphan file; No exports — cannot be consumed |
| `coordination.js` | 0 | No importers — orphan file; No exports — cannot be consumed |
| `fake-stream.js` | 0 | No importers — orphan file |
| `file-explorer.js` | 0 | No importers — orphan file; No exports — cannot be consumed |
| `graph-visualizer.js` | 0 | No importers — orphan file; No exports — cannot be consumed |
| `lib/commands/backgroundIndexer.js` | 0 | No importers — orphan file |
| `lib/commands/graphBuilder.js` | 0 | No importers — orphan file |
| ... | ... | *9 more* |

## D3: Intent Authoring

Intent coverage: 42/42 files have purpose (100.0%). 0 files lack intent.

### Coverage by Directory

| Directory | Total | With Intent | Coverage |
|-----------|-------|-------------|----------|
| backend | 14 | 14 | 100% |
| . | 9 | 9 | 100% |
| lib/commands | 6 | 6 | 100% |
| lib/commands/integr8 | 9 | 9 | 100% |
| lib/utils | 4 | 4 | 100% |

## D4: Export Surface

Export coverage: 33/42 files export (78.6%). 25 CommonJS, 0 ES6 modules.

### Files with Exports

| File | Export Count | Exports |
|------|--------------|---------|
| `backend/fileWatcher.js` | 1 | FileWatcher |
| `backend/gapAnalyzer.js` | 1 | GapAnalyzer |
| `backend/indexer.js` | 7 | indexDirectory, discoverFiles, hashFile, parseImports, buildGraph, generateManifest, writeManifest |
| `backend/intentSeeder.js` | 1 | IntentSeeder |
| `backend/manifestGenerator.js` | 3 | generateConnectionState, generateAiSignalToml, writeManifests |
| `backend/notificationBus.js` | 2 | NotificationBus, notificationBus |
| `backend/persistence.js` | 1 | St8Persistence |
| `backend/prdGenerator.js` | 6 | loadSchemaCards, groupByLifecyclePhase, generateCardMarkdown, generatePRD, writePRD, main |
| `backend/schemaCardEmitter.js` | 1 | SchemaCardEmitter |
| `backend/schemaCardPrinter.js` | 1 | SchemaCardPrinter |
| `backend/server.js` | 1 | St8Server |
| `backend/st8-types.js` | 13 | LifecyclePhase, FileStatus, MutationType, ActorType, St8FileEntry, St8SchemaCard, St8MutationRecord, validateAgainstShape, validateSt8FileEntry, validateSt8SchemaCard, validateSt8MutationRecord, generateFingerprint, parseFingerprint |
| `fake-stream.js` | 1 | FakeStream |
| `lib/commands/backgroundIndexer.js` | 2 | BackgroundIndexer, getBackgroundIndexer |
| `lib/commands/graphBuilder.js` | 2 | buildDependencyGraph, getImpactAnalysis |

## D5: Connection Integrity

Connection integrity: 59/59 imports resolve. 0 orphan imports, 11 isolated files.

### Isolated Files (No Connections)

- `coordination.js`
- `fake-stream.js`
- `file-explorer.js`
- `graph-visualizer.js`
- `lib/commands/overview.js`
- `lib/utils/astParser.js`
- `lib/utils/ioChan.js`
- `phreak-terminal.js`
- `settings-reader.js`
- `settings-ui.js`
- `void-engine.js`

## D6: Architectural Completeness

Architecture: 8/8 components present. SSE: yes. PRD generation: yes. Endpoints: 14/14 covered.

### Endpoint Coverage

**Coverage:** 14/14 (100.0%)

### Component Status

| Component | Present |
|-----------|---------|
| persistence | ✓ |
| indexer | ✓ |
| fileWatcher | ✓ |
| schemaCardEmitter | ✓ |
| notificationBus | ✓ |
| server | ✓ |
| prdGenerator | ✓ |
| manifestGenerator | ✓ |

**SSE Integration:** ✓ Present
**PRD Generation:** ✓ Present
