# Gap Analysis — Deterministic Checks

Generated: 2026-05-16T09:43:09.699Z
Source: `src/` (91 files, 38 directories)

---

## 1. Naming (camelCase / PascalCase in filenames) — 8 finding(s)

- `src/frontend/components/dive-in/three/shaders/CopyShader.js` — CopyShader.js
- `src/frontend/components/dive-in/three/shaders/LuminosityHighPassShader.js` — LuminosityHighPassShader.js
- `src/frontend/components/dive-in/three/postprocessing/EffectComposer.js` — EffectComposer.js
- `src/frontend/components/dive-in/three/postprocessing/MaskPass.js` — MaskPass.js
- `src/frontend/components/dive-in/three/postprocessing/RenderPass.js` — RenderPass.js
- `src/frontend/components/dive-in/three/postprocessing/ShaderPass.js` — ShaderPass.js
- `src/frontend/components/dive-in/three/postprocessing/UnrealBloomPass.js` — UnrealBloomPass.js
- `src/frontend/components/dive-in/three/controls/OrbitControls.js` — OrbitControls.js

## 2. Zero-prefix residue (`0_` paths) — 0 finding(s)

_None._

## 3. Empty directories — 0 finding(s)

_None._

## 4. Stale references to OLD paths — 1 finding(s)

- `src/core/hook-registry.js`:14 — `* `backend/index.js` (now src/core/server/main.js). The HOOK-ARCHITECTURE-`

## 5. Architecture boundary violations — 35 finding(s)

- `src/features/integr8/index.js`:50 — features/integr8 -> features/indexing (cross-feature) — `../indexing/data-ingestion.js`
- `src/features/integr8/index.js`:51 — features/integr8 -> features/analysis (cross-feature) — `../analysis/relationship-analyzer.js`
- `src/features/integr8/index.js`:52 — features/integr8 -> features/analysis (cross-feature) — `../analysis/path-generator.js`
- `src/features/integr8/index.js`:54 — features/integr8 -> features/analysis (cross-feature) — `../analysis/report-generator.js`
- `src/features/indexing/background-indexer.js`:65 — features/indexing -> features/search (cross-feature) — `../search/sonic-client.js`
- `src/features/indexing/background-indexer.js`:66 — features/indexing -> features/analysis (cross-feature) — `../analysis/insight-store.js`
- `src/features/graph/builder.js`:17 — features/graph -> features/indexing (cross-feature) — `../indexing/data-ingestion.js`
- `src/core/server/app.js`:664 — core -> features — `../../features/indexing/indexer`
- `src/core/server/app.js`:665 — core -> features — `../../features/schema-cards/manifest-generator`
- `src/core/server/app.js`:1066 — core -> features — `../../features/indexing/indexer`
- `src/core/server/app.js`:1231 — core -> features — `../../features/schema-cards/emitter`
- `src/core/server/app.js`:1320 — core -> features — `../../features/prd/generator`
- `src/core/server/app.js`:1435 — core -> features — `../../features/analysis/gap-analyzer`
- `src/core/server/app.js`:1492 — core -> features — `../../features/analysis/signal-path-adapter`
- `src/core/server/app.js`:1577 — core -> features — `../../features/analysis/signal-path-adapter`
- `src/core/server/app.js`:1578 — core -> features — `../../features/analysis/report-generator`
- `src/core/server/app.js`:1653 — core -> features — `../../features/analysis/insight-store`
- `src/core/server/app.js`:1850 — core -> features — `../../features/lifecycle/bruno-oscar`
- `src/core/server/app.js`:1895 — core -> features — `../../features/lifecycle/bruno-oscar`
- `src/core/server/app.js`:1994 — core -> features — `../../features/prd/template-engine`
- `src/core/server/app.js`:2020 — core -> features — `../../features/prd/template-engine`
- `src/core/server/app.js`:2596 — core -> features — `../../features/llm/dispatcher`
- `src/core/server/main.js`:14 — core -> features — `../../features/indexing/indexer`
- `src/core/server/main.js`:16 — core -> features — `../../features/schema-cards/manifest-generator`
- `src/core/server/main.js`:17 — core -> features — `../../features/watcher/file-watcher`
- `src/core/server/main.js`:20 — core -> features — `../../features/schema-cards/emitter`
- `src/core/server/main.js`:21 — core -> features — `../../features/schema-cards/printer`
- `src/core/server/main.js`:23 — core -> features — `../../features/analysis/gap-analyzer`
- `src/core/server/main.js`:24 — core -> features — `../../features/analysis/intent-seeder`
- `src/core/hooks/default-subscribers.js`:44 — core -> features — `../../features/search/sonic-daemon`
- `src/core/hooks/default-subscribers.js`:117 — core -> features — `../../features/lifecycle/bruno-oscar`
- `src/core/hooks/default-subscribers.js`:144 — core -> features — `../../features/schema-cards/manifest-generator`
- `src/core/hooks/default-subscribers.js`:168 — core -> features — `../../features/analysis/gap-analyzer`
- `src/core/hooks/default-subscribers.js`:183 — core -> features — `../../features/analysis/intent-seeder`
- `src/core/hooks/default-subscribers.js`:216 — core -> features — `../../features/analysis/insight-store-populator`

## 6. Orphan modules (no consumers in src/) — 11 finding(s)

- `src/shared/utils/ground-plane.js`
- `src/features/search/sonic-indexer.js`
- `src/features/search/sonic-queries.js`
- `src/features/llm/providers/anthropic.js`
- `src/features/llm/providers/openai.js`
- `src/features/integr8/index.js`
- `src/features/integr8/migration-executor.js`
- `src/features/indexing/background-indexer.js`
- `src/features/graph/builder.js`
- `src/features/graph/traversal.js`
- `src/core/server/route-manifest.js`

---
**Total findings: 55** — 8 naming, 0 zero-prefix, 0 empty, 1 stale paths, 35 boundary, 11 orphans.
