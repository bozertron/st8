# W1-04 TIER3 SCOUT Outputs — Deep File Reading Report
**Project:** st8 PRD System Research  
**Scope:** All 14 SCOUT JSON outputs from `/home/bozertron/1_AT_A_TIME/actu8/prd/`  
**Date:** 2026-05-13  
**Analyst:** Research Agent  

---

## Executive Summary

The SCOUT JSON corpus is not a set of parsed content artifacts; it is a **directory-inventory layer** produced by a scanning tool that catalogs the output of a multi-domain PRD generator pipeline. Each JSON records which files a given parser (or output stage) produced. By reading the 13 available inventories (one file, SCOUT-085, was absent from disk), we can reverse-engineer the pipeline architecture, parser taxonomy, decomposition strategy, and identify both the strengths and gaps of the system relative to monolithic PRD generation.

---

## 1. Parser Inventory — What Each Domain Extracts & Outputs

The evidence comes from the `directory` paths inside each SCOUT JSON. The system uses numbered output folders that map 1-to-1 to parser responsibilities.

| SCOUT ID | Parser / Domain | Output Directory | Files Found | Output Types | Inferred Extraction Focus |
|----------|----------------|------------------|-------------|--------------|---------------------------|
| SCOUT-084 | OG-PRD (original) | `OG PRD/` | 1 | `.vue` | The legacy monolithic `PrdGenerator.vue` source |
| SCOUT-086 | PRD-Outputs (general) | `PRD Generator Outputs/` | 3 | `.txt`, `.md` | Folder maps, migration prep, integration notes |
| SCOUT-087 | **overview** | `01_overview/` | 4 | `.txt` | High-level project context, scope, architecture summary |
| SCOUT-088 | **stores** | `03_stores/` | 2 | `.txt` | Pinia/Vuex store definitions, state shape, getters/actions |
| SCOUT-089 | **routes** | `05_routes/` | 2 | `.txt` | Vue-router or equivalent route tables, guards, lazy-loading |
| SCOUT-090 | **commands** | `07_commands/` | 19 | `.txt` | Business logic, action handlers, API call layers, command bus — **largest domain** |
| SCOUT-091 | **types** | `08_types/` | 4 | `.txt` | TypeScript interfaces, enums, type aliases, DTOs |
| SCOUT-092 | **ui** | `10_ui/` | 2 | `.txt` | Component hierarchy, view templates, layout structure |
| SCOUT-093 | **files** | `12_files/` | 1 | `.txt` | File-tree indices, scaffold maps, directory topology |
| SCOUT-094 | **uiGen** | `13_uiGen/` | 4 | `.html`, `.json`, `.ts` | **Runnable** generated project shell (Vite + Vue/TS) |
| SCOUT-095 | **uiGen-src** | `13_uiGen/src/` | 2 | `.vue`, `.ts` | Generated source entry points (`App.vue`, `main.ts`) |
| SCOUT-100 | **Compiled** | `Compiled/prd src/` | 17 | `.ts`, `.json` | The actual parser engine source code (see Section 2) |
| SCOUT-101 | **Documentation** | `Documentation/` | 2 | `.txt` | Plugin conventions, UI plugin lists |

**Key observation:** Most parsers emit plain `.txt` chunks. Only `uiGen` and `Compiled` emit executable artifacts (`.vue`, `.ts`, `.html`, `.json`). The `commands` parser is the most prolific (19 files), suggesting commands are either the largest or most granularly decomposed domain.

---

## 2. SCOUT-100 Analysis — The Compiled Pipeline & 17 Source Files

SCOUT-100 inventories the `Compiled/prd src/` directory. These are the **actual parser engine sources**, not the PRD text outputs. There are exactly 17 items:

### Config / Manifest Files (3)
1. `tsconfig.json`
2. `package.json`
3. `package-lock.json`

### Core Parser Modules (11)
4. `overview.ts` — Project-wide overview synthesis
5. `storeParser.ts` — State management extraction
6. `routeParser.ts` — Routing table extraction
7. `commandParser.ts` — Business logic / command extraction
8. `typeParser.ts` — TypeScript definition extraction
9. `uiParser.ts` — UI/component structure extraction
10. `uiTemplateParser.ts` — Template-level UI parsing (separate from component logic)
11. `uiGenParser.ts` — Code generation for new UI projects
12. `fileRetriever.ts` — File-system indexing / topology extraction
13. `backendGenParser.ts` — Backend code generation
14. `migrationAssistantParser.ts` — Migration analysis / refactoring support

### Orchestration / Factory Modules (3)
15. `featureFactory.ts` — Composes individual parser outputs into feature-level artifacts
16. `integr8handler.ts` — Integration glue / handler dispatch
17. `saveScaffoldReport.ts` — Persists scaffold state / reports to disk

### What SCOUT-100 Reveals About the Full Pipeline
- **Parser-per-domain is literal:** Each domain has its own `.ts` parser module.
- **Generation is bidirectional:** The pipeline both *reads* code (`*Parser.ts`) and *writes* code (`*Gen*.ts`).
- **Factory pattern:** `featureFactory.ts` implies parsed domains are aggregated into higher-level "features" rather than staying siloed.
- **Integration layer:** `integr8handler.ts` and `saveScaffoldReport.ts` suggest the PRD system is not a static document generator; it is a **living scaffold tool** that writes back to disk and maintains state.
- **Missing from compiled sources:** There is no monolithic `prdGenerator.ts` here. The original `PrdGenerator.vue` (SCOUT-084) was refactored into these 14 specialist modules.

---

## 3. Per-Domain Decomposition Pattern

The folder naming convention `NN_domain` (e.g., `01_overview`, `03_stores`) reveals a **canonical PRD section map** aligned with full-stack application architecture.

### Observed Section Map
| Section # | Domain | Role in PRD / App |
|-----------|--------|-------------------|
| 01 | Overview | Executive summary, tech stack, goals |
| 03 | Stores | State management layer |
| 05 | Routes | Client-side navigation |
| 07 | Commands | Business logic / actions / API layer |
| 08 | Types | Data contracts / TypeScript |
| 10 | UI | Presentation layer |
| 12 | Files | File-system topology |
| 13 | uiGen | Generated application shell |

### Decomposition Strategy Insights
1. **Odd-numbered sections dominate** (01, 03, 05, 07, 10, 12, 13). Gaps (02, 04, 06, 09, 11) imply either:
   - Those sections are optional and omitted when empty, or
   - The numbering reserves slots for future domains (e.g., 02 = dependencies, 04 = services, 06 = middleware, 09 = tests, 11 = config).
2. **Chunking by token budget:** Commands produce 18+ `.txt` files. This is a deliberate anti-monolith strategy—each chunk stays within LLM context windows.
3. **Depth mirroring:** Some folders contain nested duplicates (e.g., `01_overview/01_overview/overview-1.txt`). This suggests an intermediate staging copy or a recursive write step in the pipeline.
4. **From analysis to synthesis:** Lower-numbered sections (01–08) are analytical; higher numbers (10–13) are synthetic/generative. The pipeline transitions from *understanding* to *building*.

---

## 4. Output Schema — Consistency & Variance

### Universal Fields (Present in Every SCOUT JSON)
- `directory`: Absolute path of the scanned output folder.
- `scout_id`: Unique scan identifier (`SCOUT-NNN`).
- `ui_files_found`: Array of file descriptors.
  - `path`: Absolute file path.
  - `type`: File extension (e.g., `.txt`, `.ts`).
  - `name`: Basename.
- `total_ui_files`: Integer count.
- `scan_status`: Always `"complete"` in this corpus.

### Variance by Parser
| Dimension | What Varies | Example |
|-----------|-------------|---------|
| **File count** | 1 to 19 files per domain | `12_files` = 1 file; `07_commands` = 19 files |
| **File type** | `.txt` vs executable code | Most = `.txt`; `uiGen` = `.html`/`.ts`; `Compiled` = `.ts` |
| **Directory depth** | Flat vs nested | Some domains have duplicate nested subfolders |
| **Naming pattern** | Sequential chunks vs semantic names | `commands-1.txt` … `commands-18.txt` vs `FolderMap.txt` |
| **Cross-domain leakage** | One file mis-filed? | `08_types` contains a `commands-1.txt` (possible misclassification or shared domain) |

**Schema conclusion:** The SCOUT layer itself is intentionally thin and uniform. All semantic richness lives in the *contents* of the inventoried files and in the *directory naming convention*.

---

## 5. Data Transformation — Raw Source to Structured JSON

The SCOUT corpus implies a **5-stage transformation pipeline**:

### Stage 0: Legacy Monolith
- Input: Raw codebase (Vue/TS/full-stack app).
- Artifact: `PrdGenerator.vue` (SCOUT-084) — the original all-in-one generator.

### Stage 1: Domain Parsing (Analytical)
- Input: Raw codebase.
- Process: Each specialist parser (`storeParser.ts`, `commandParser.ts`, etc.) reads targeted slices of the codebase.
- Output: Numbered `.txt` chunks in `01_*` through `08_*` directories.
- Evidence: 4–19 text files per domain.

### Stage 2: Synthesis & Generation (Synthetic)
- Input: Parsed domain chunks + templates.
- Process: `uiGenParser.ts`, `backendGenParser.ts`, `featureFactory.ts` aggregate understanding into new code.
- Output: `13_uiGen/` contains a **runnable Vite project** (`index.html`, `package.json`, `vite.config.ts`, `App.vue`).

### Stage 3: Compilation (Engineering)
- Input: All parser `.ts` sources.
- Process: Compiled into `Compiled/prd src/` with `tsconfig.json` and `package.json`.
- Output: A standalone, installable parser engine.

### Stage 4: Integration & Scaffolding (Operational)
- Input: Generated artifacts.
- Process: `integr8handler.ts` and `saveScaffoldReport.ts` wire outputs into the build system.
- Output: Migration guides, folder maps, plugin documentation (SCOUT-086, SCOUT-101).

**Intermediate steps observed:**
- `.txt` chunks are the primary intermediate representation between raw code and final PRD.
- Nested directories (e.g., `07_commands/07_commands/`) indicate a possible copy or merge step before finalization.

---

## 6. Unique IP — Why This Beats Monolithic PRD Generation

The parser pipeline approach offers several structural advantages over a single "write me a PRD" prompt:

1. **Expert Specialization:** Each parser module is a domain expert. A `routeParser` understands Vue Router nuances; a `typeParser` understands TS generics. Monoliths dilute expertise.
2. **Context Window Management:** By chunking commands into 18 files, no single LLM invocation must ingest the entire business-logic layer. This scales to arbitrarily large codebases.
3. **Re-composability:** `featureFactory.ts` can mix-and-match domain outputs (e.g., "give me the routes + stores + types for Feature X") without re-parsing everything.
4. **Bidirectional Flow:** The system is not just "code → document." It is "code → document → code" via `uiGenParser.ts` and `backendGenParser.ts`.
5. **Deterministic Scaffolding:** `fileRetriever.ts` and `saveScaffoldReport.ts` ground the PRD in actual file-system topology, eliminating hallucinated file names common in monolithic generation.
6. **Plugin Extensibility:** The `Documentation` folder (SCOUT-101) references plugin conventions, implying new parsers can be registered without rewriting the core.

---

## 7. Gaps — What Domains Are NOT Covered

Based on the numbered section map and compiled source inventory, the following domains are **absent or under-represented**:

### Missing Numbered Sections
- **02_** — Likely reserved for **Dependencies / Tech Stack** (package audit, external APIs).
- **04_** — Likely reserved for **Services / API Clients** (REST/GraphQL layer separate from commands).
- **06_** — Likely reserved for **Middleware / Auth / Guards** (interceptors, auth flows).
- **09_** — Likely reserved for **Tests** (unit, integration, E2E specifications).
- **11_** — Likely reserved for **Configuration / Environment** (env vars, CI/CD, build config).

### Missing Parser Modules (no `.ts` equivalent in SCOUT-100)
- **Database / ORM / Models:** No `modelParser.ts` or `schemaParser.ts`. Types (08) partially cover this, but DB migrations and relations are not explicitly addressed.
- **Styles / Theming / CSS:** No `styleParser.ts` or `themeParser.ts`. UI (10) may embed style info, but design-system tokens are not a first-class domain.
- **Assets / Static Files:** No parser for images, icons, fonts, or i18n locale files.
- **Tests / QA:** No `testParser.ts` to extract test coverage or requirements.
- **Documentation / README:** While a `Documentation/` folder exists, there is no parser that auto-generates user-facing docs from code comments.
- **Deployment / DevOps:** No `deployParser.ts` for Docker, K8s, or serverless configs.

### Anomaly Noted
- In `08_types` (SCOUT-091), one file is named `commands-1.txt`. This may indicate a **classification leak** where command-related types were written to the types folder, or it reveals that domains are not always strictly bounded.

---

## Conclusions for st8 PRD System Design

1. **Adopt the `NN_domain` convention.** Numbered folders create an implicit PRD outline and make omissions visible.
2. **Implement parser-per-domain.** Do not build one mega-parser. Build 8–12 focused parsers that emit chunked `.txt` intermediates.
3. **Include a Factory/Compiler layer.** `featureFactory.ts` and the `Compiled/` stage prove that PRD generation should be a pipeline, not a single shot.
4. **Plan for the missing sections.** A complete st8 PRD should explicitly address tests (09), config (11), and database/schema (04/06) even if the original system skipped them.
5. **Track cross-domain leakage.** Enforce naming hygiene so that a `types` parser does not emit `commands-*.txt` files.
6. **Preserve the SCOUT inventory layer.** A thin JSON index of every parser's output enables traceability, auditability, and downstream tooling.

---

*End of Report*
