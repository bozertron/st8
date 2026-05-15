# Tier 6 — Schema Card Identity Delta

Generated: 2026-05-14T14:39:03.141Z
Cards inspected: 43

| Bucket | Count | Meaning |
|---|---|---|
| MATCH (identity preserved) | 37 | exports + imports identical to pre-refactor card |
| DOCUMENTED DRIFT | 3 | identity changed, but the change was an intentional batch-X patch |
| UNDOCUMENTED DRIFT | 0 | **investigate** — surface differs and isn't on the documented list |
| MISSING ON DISK | 3 | card exists but no file at expected path (probably retired to OGB / removed) |
| FAILED TO PARSE | 0 | the AST extractor threw on the new file |

---

## UNDOCUMENTED DRIFT (investigate) — 0

_None._

## DOCUMENTED DRIFT — 3

- `src/core/server/main.js`
    - imports +: intentseeder::; astparser::
- `src/features/schema-cards/emitter.js`
    - imports +: astparser::
- `src/core/server/app.js`
    - imports +: brunooscar::; templateengine::

## MISSING ON DISK — 3

- `fake-stream.js`  (card was `fake-stream.js.json`)
- `test/newfile.js`  (card was `test_newfile.js.json`)
- `void-engine.js`  (card was `void-engine.js.json`)

## FAILED TO PARSE — 0

_None._

## MATCH — 37

- `src/features/watcher/file-watcher.js`
- `src/features/analysis/gap-analyzer.js`
- `src/features/indexing/indexer.js`
- `src/features/analysis/intent-seeder.js`
- `src/features/schema-cards/manifest-generator.js`
- `src/core/notification-bus.js`
- `src/core/database/persistence.js`
- `src/features/prd/generator.js`
- `src/features/schema-cards/printer.js`
- `src/shared/types/st8-types.js`
- `src/core/database/verify-persistence-fixes.js`
- `src/frontend/services/coordination.js`
- `src/frontend/components/file-explorer/file-explorer.js`
- `src/frontend/components/graph-viewer/graph-viewer.js`
- `src/features/indexing/background-indexer.js`
- `src/features/graph/builder.js`
- `src/features/graph/traversal.js`
- `src/features/analysis/insight-store.js`
- `src/features/indexing/data-ingestion.js`
- `src/core/database/graph-persister.js`
- `src/features/integr8/index.js`
- `src/features/integr8/migration-executor.js`
- `src/features/analysis/path-generator.js`
- `src/features/analysis/relationship-analyzer.js`
- `src/features/analysis/report-generator.js`
- `src/features/integr8/toml-serializer.js`
- `src/shared/types/integr8-types.js`
- `src/features/indexing/overview.js`
- `src/features/indexing/parser-persistence.js`
- `src/shared/utils/ast-parser.js`
- `src/shared/utils/ground-plane.js`
- `src/shared/utils/io-chan.js`
- `src/shared/utils/safe-fs.js`
- `src/frontend/components/terminal/terminal.js`
- `src/frontend/services/state.js`
- `src/frontend/components/settings/settings.js`
- `start.js`
