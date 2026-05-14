# ST8 Product Requirements Document

**Generated:** 2026-05-13T17:14:59.726Z
**Total Files:** 40
**Lifecycle Phases:** 1

## Summary

| Lifecycle Phase | File Count |
|-----------------|------------|
| DEVELOPMENT | 40 |

## Phase: DEVELOPMENT (40 files)

### backend/fileWatcher.js
- **Fingerprint:** backend/fileWatcher.js||2026-05-12T07:22:16.663Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, fs
- **Reachability Score:** 0

### backend/index.js
- **Fingerprint:** backend/index.js||2026-05-12T07:23:01.935Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, ./indexer, ./persistence, ./manifestGenerator, ./fileWatcher, ./server, ./st8-types, ./schemaCardEmitter, ./schemaCardPrinter, ./notificationBus, fs, crypto
- **Reachability Score:** 0

### backend/indexer.js
- **Fingerprint:** backend/indexer.js||2026-05-12T07:20:30.968Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, fs, ./st8-types, crypto
- **Reachability Score:** 0

### backend/manifestGenerator.js
- **Fingerprint:** backend/manifestGenerator.js||2026-05-12T07:21:55.099Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, fs
- **Reachability Score:** 0

### backend/notificationBus.js
- **Fingerprint:** backend/notificationBus.js||2026-05-13T14:15:13.100Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** events
- **Reachability Score:** 0

### backend/persistence.js
- **Fingerprint:** backend/persistence.js||2026-05-12T07:21:03.355Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, fs, ./st8-types, better-sqlite3
- **Reachability Score:** 0

### backend/prdGenerator.js
- **Fingerprint:** backend/prdGenerator.js||2026-05-13T16:12:16.658Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** fs, path
- **Reachability Score:** 0

### backend/schemaCardEmitter.js
- **Fingerprint:** backend/schemaCardEmitter.js||2026-05-13T14:15:44.081Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, fs, ./st8-types, ./persistence
- **Reachability Score:** 0

### backend/schemaCardPrinter.js
- **Fingerprint:** backend/schemaCardPrinter.js||2026-05-13T14:15:22.619Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, fs
- **Reachability Score:** 0

### backend/server.js
- **Fingerprint:** backend/server.js||2026-05-12T07:22:39.719Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** http, fs, path, ./indexer, ./manifestGenerator, ./persistence, os, crypto, ./notificationBus, ./schemaCardEmitter, ./prdGenerator
- **Reachability Score:** 0

### backend/st8-types.js
- **Fingerprint:** backend/st8-types.js||2026-05-13T14:13:47.351Z
- **Status:** RED
- **Purpose:** (not set)
- **Reachability Score:** 0

### backend/verify-persistence-fixes.js
- **Fingerprint:** backend/verify-persistence-fixes.js||2026-05-13T15:08:05.551Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, fs, ./persistence
- **Reachability Score:** 0

### coordination.js
- **Fingerprint:** coordination.js||2026-05-12T08:09:56.549Z
- **Status:** RED
- **Purpose:** (not set)
- **Reachability Score:** 0

### fake-stream.js
- **Fingerprint:** fake-stream.js||2026-05-11T21:48:30.641Z
- **Status:** RED
- **Purpose:** (not set)
- **Exports:**
  - class `FakeStream`
- **Reachability Score:** 0

### file-explorer.js
- **Fingerprint:** file-explorer.js||2026-05-11T21:48:30.642Z
- **Status:** RED
- **Purpose:** (not set)
- **Reachability Score:** 0

### graph-visualizer.js
- **Fingerprint:** graph-visualizer.js||2026-05-12T08:01:28.404Z
- **Status:** RED
- **Purpose:** (not set)
- **Reachability Score:** 0

### lib/commands/backgroundIndexer.js
- **Fingerprint:** lib/commands/backgroundIndexer.js||2026-05-12T08:23:17.356Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** events, chokidar, ./integr8/databasePersister.js, ./integr8/dataIngestion.js, ./parserPersistence.js, ./sonicClient.js, ./insightStore.js, ./multiPassAnalyzer.js, ./precisionCapture.js, ./integr8/types.js
- **Reachability Score:** 0

### lib/commands/graphBuilder.js
- **Fingerprint:** lib/commands/graphBuilder.js||2026-05-12T08:23:17.353Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** ./integr8/types.js, ./integr8/dataIngestion.js
- **Reachability Score:** 0

### lib/commands/graphTraversal.js
- **Fingerprint:** lib/commands/graphTraversal.js||2026-05-12T08:23:17.355Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** ./integr8/databasePersister.js
- **Reachability Score:** 0

### lib/commands/insightStore.js
- **Fingerprint:** lib/commands/insightStore.js||2026-05-12T08:24:07.123Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Dependencies:** ./integr8/databasePersister.js
- **Reachability Score:** 0.95

### lib/commands/integr8/dataIngestion.js
- **Fingerprint:** lib/commands/integr8/dataIngestion.js||2026-05-12T08:23:39.441Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Dependencies:** ./types.js, ../overview.js, ../storeParser.js, ../routeParser.js, ../commandParser.js, ../typeParser.js, ../uiParser.js, ../parserPersistence.js, ../../utils/astParser.js, ../../utils/safeFs.js, ../../utils/ioChan.js
- **Reachability Score:** 0.95

### lib/commands/integr8/databasePersister.js
- **Fingerprint:** lib/commands/integr8/databasePersister.js||2026-05-12T08:23:17.357Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Reachability Score:** 0.95

### lib/commands/integr8/index.js
- **Fingerprint:** lib/commands/integr8/index.js||2026-05-12T08:23:53.252Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** ./dataIngestion.js, ./relationshipAnalyzer.js, ./pathGenerator.js, ./tomlSerializer.js, ./reportGenerator.js, ./databasePersister.js
- **Reachability Score:** 0

### lib/commands/integr8/migrationExecutor.js
- **Fingerprint:** lib/commands/integr8/migrationExecutor.js||2026-05-12T08:23:53.251Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** ./views/NewView.vue, ./types, ./tomlSerializer, child_process, crypto
- **Reachability Score:** 0

### lib/commands/integr8/pathGenerator.js
- **Fingerprint:** lib/commands/integr8/pathGenerator.js||2026-05-12T08:23:53.249Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Dependencies:** ./${toNode.name}, ./types
- **Reachability Score:** 0.95

### lib/commands/integr8/relationshipAnalyzer.js
- **Fingerprint:** lib/commands/integr8/relationshipAnalyzer.js||2026-05-12T08:23:17.358Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Dependencies:** ./types.js
- **Reachability Score:** 0.95

### lib/commands/integr8/reportGenerator.js
- **Fingerprint:** lib/commands/integr8/reportGenerator.js||2026-05-12T08:23:53.250Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Dependencies:** ./types.js
- **Reachability Score:** 0.95

### lib/commands/integr8/tomlSerializer.js
- **Fingerprint:** lib/commands/integr8/tomlSerializer.js||2026-05-12T08:23:17.360Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Dependencies:** ./types
- **Reachability Score:** 0.95

### lib/commands/integr8/types.js
- **Fingerprint:** lib/commands/integr8/types.js||2026-05-12T08:23:39.439Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Reachability Score:** 0.95

### lib/commands/overview.js
- **Fingerprint:** lib/commands/overview.js||2026-05-12T08:24:07.119Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Reachability Score:** 0.95

### lib/commands/parserPersistence.js
- **Fingerprint:** lib/commands/parserPersistence.js||2026-05-12T08:24:07.121Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Dependencies:** ./integr8/databasePersister.js
- **Reachability Score:** 0.95

### lib/utils/astParser.js
- **Fingerprint:** lib/utils/astParser.js||2026-05-12T08:23:17.352Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Dependencies:** @babel/parser
- **Reachability Score:** 0.95

### lib/utils/groundPlane.js
- **Fingerprint:** lib/utils/groundPlane.js||2026-05-12T08:23:39.438Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** ./safeFs.js
- **Reachability Score:** 0

### lib/utils/ioChan.js
- **Fingerprint:** lib/utils/ioChan.js||2026-05-12T08:23:39.436Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Reachability Score:** 0.95

### lib/utils/safeFs.js
- **Fingerprint:** lib/utils/safeFs.js||2026-05-12T08:23:39.435Z
- **Status:** GREEN
- **Purpose:** (not set)
- **Reachability Score:** 0.95

### phreak-terminal.js
- **Fingerprint:** phreak-terminal.js||2026-05-11T21:48:30.642Z
- **Status:** RED
- **Purpose:** (not set)
- **Reachability Score:** 0

### settings-reader.js
- **Fingerprint:** settings-reader.js||2026-05-11T21:48:30.642Z
- **Status:** RED
- **Purpose:** (not set)
- **Exports:**
  - class `SettingsReader`
  - variable `LocalStorageAdapter`
  - variable `MemoryAdapter`
- **Reachability Score:** 0

### settings-ui.js
- **Fingerprint:** settings-ui.js||2026-05-12T08:05:12.940Z
- **Status:** RED
- **Purpose:** (not set)
- **Reachability Score:** 0

### start.js
- **Fingerprint:** start.js||2026-05-12T08:27:16.939Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** path, fs, child_process, open
- **Reachability Score:** 0

### void-engine.js
- **Fingerprint:** void-engine.js||2026-05-11T21:48:30.649Z
- **Status:** RED
- **Purpose:** (not set)
- **Dependencies:** https://esm.sh/@chenglou/pretext@0.0.6
- **Reachability Score:** 0

