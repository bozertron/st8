# Gap Analysis — Deterministic Checks

Generated: 2026-05-14T14:35:07.945Z
Source: `src/` (63 files, 26 directories)

---

## 1. Naming (camelCase / PascalCase in filenames) — 0 finding(s)

_None._

## 2. Zero-prefix residue (`0_` paths) — 0 finding(s)

_None._

## 3. Empty directories — 0 finding(s)

_None._

## 4. Stale references to OLD paths — 0 finding(s)

_None._

## 5. Architecture boundary violations — 25 finding(s)

- `src/features/integr8/index.js`:50 — features/integr8 -> features/indexing (cross-feature) — `../indexing/data-ingestion.js`
- `src/features/integr8/index.js`:51 — features/integr8 -> features/analysis (cross-feature) — `../analysis/relationship-analyzer.js`
- `src/features/integr8/index.js`:52 — features/integr8 -> features/analysis (cross-feature) — `../analysis/path-generator.js`
- `src/features/integr8/index.js`:54 — features/integr8 -> features/analysis (cross-feature) — `../analysis/report-generator.js`
- `src/features/indexing/background-indexer.js`:64 — features/indexing -> features/analysis (cross-feature) — `../analysis/insight-store.js`
- `src/features/graph/builder.js`:17 — features/graph -> features/indexing (cross-feature) — `../indexing/data-ingestion.js`
- `src/core/server/app.js`:289 — core -> features — `../../features/indexing/indexer`
- `src/core/server/app.js`:290 — core -> features — `../../features/schema-cards/manifest-generator`
- `src/core/server/app.js`:704 — core -> features — `../../features/indexing/indexer`
- `src/core/server/app.js`:877 — core -> features — `../../features/schema-cards/emitter`
- `src/core/server/app.js`:950 — core -> features — `../../features/prd/generator`
- `src/core/server/app.js`:1045 — core -> features — `../../features/analysis/gap-analyzer`
- `src/core/server/app.js`:1206 — core -> features — `../../features/lifecycle/bruno-oscar`
- `src/core/server/app.js`:1261 — core -> features — `../../features/lifecycle/bruno-oscar`
- `src/core/server/app.js`:1370 — core -> features — `../../features/prd/template-engine`
- `src/core/server/app.js`:1407 — core -> features — `../../features/prd/template-engine`
- `src/core/server/main.js`:14 — core -> features — `../../features/indexing/indexer`
- `src/core/server/main.js`:16 — core -> features — `../../features/schema-cards/manifest-generator`
- `src/core/server/main.js`:17 — core -> features — `../../features/watcher/file-watcher`
- `src/core/server/main.js`:20 — core -> features — `../../features/schema-cards/emitter`
- `src/core/server/main.js`:21 — core -> features — `../../features/schema-cards/printer`
- `src/core/server/main.js`:23 — core -> features — `../../features/analysis/gap-analyzer`
- `src/core/server/main.js`:24 — core -> features — `../../features/analysis/intent-seeder`
- `src/core/server/main.js`:155 — core -> features — `../../features/schema-cards/manifest-generator`
- `src/core/server/main.js`:377 — core -> features — `../../features/schema-cards/manifest-generator`

## 6. Orphan modules (no consumers in src/) — 6 finding(s)

- `src/shared/utils/ground-plane.js`
- `src/features/integr8/index.js`
- `src/features/integr8/migration-executor.js`
- `src/features/indexing/background-indexer.js`
- `src/features/graph/builder.js`
- `src/features/graph/traversal.js`

---
**Total findings: 31** — 0 naming, 0 zero-prefix, 0 empty, 0 stale paths, 25 boundary, 6 orphans.
