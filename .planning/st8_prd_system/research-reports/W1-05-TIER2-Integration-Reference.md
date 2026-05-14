# W1-05-TIER2 Integration & Reference Research Report

**Date:** 2026-05-13
**Agent:** st8 PRD System Research
**Sources:** 6 files from `/home/bozertron/Software Projects/stereOS/IP for actu8/`

---

## 1. Executive Summary

The stereOS PRD Generator ecosystem contains **two distinct evolutionary branches**:
1. **AI-Driven PRD Generator** (`PrdGenerator.vue` / `prdGeneratorView.vue`) — a form-based Vue component that invokes backend AI (GPT-4) to generate markdown PRDs with preview/export capabilities.
2. **CLI-Integrated Scaffolding Generator** (`PrdGenerator.vue Updates for integration.txt` / `prd_generator_reference.vue.txt`) — a Tauri-integrated Vue component that dynamically loads parser plugins from a Rust backend and constructs CLI commands for code scaffolding, feature factory, UI/backend generation, and external project integration (`integr8`).

Additionally, a stub menu component (`PrdMenuView.vue`) and an example PRD template (`example_prd.txt`) define the intended output contract.

---

## 2. Integration Changes to PrdGenerator

### 2.1 What Changed for Integration

The integration update notes (523 lines) reveal a significant refactor of the generator from a static script invoker to a **dynamic plugin-driven CLI orchestrator**:

| Aspect | Before | After (Integrated) |
|--------|--------|-------------------|
| CLI Path | Hardcoded `CLI_SCRIPT_PATH` to a Node.js script | Removed; Rust backend handles command resolution |
| Command Config | Static constant | `ORCHESTR8_CLI_COMMAND` ref (default: `orchestr8-cli`) |
| Parser Types | Hardcoded list | Hybrid: static types + dynamic types fetched from Rust via `list_cli_plugins` |
| Tauri API | `@tauri-apps/api/tauri` (v1 style) | `@tauri-apps/api/core` (v2+) |
| Backend Invoke | Direct script execution | `invoke('run_script_command', { args: argsForRust })` |
| Plugin Loading | None | `onMounted` fetches `PluginInfo[]` from Rust, maps to UI buttons |
| Compare Mode | Basic suffix append | Automatic subdirectory derivation (`01_overview` -> `02_overviewCompare`) |

### 2.2 Added

- **`PluginInfo` interface** — maps to Rust struct with `#[serde(rename_all = "camelCase")]`:
  - `commandType`, `description`, `supportsCompare`, `specificOptions`
- **`FormModel` expansions** — added fields for:
  - `externalProjectPath`, `targetPages` (for `integr8`)
  - `featureName`, `featureDesc`, `createUi`, `createDb` (for `feature-factory`)
  - `userNotes`
- **`argsForRust` payload** — structured object passed to `run_script_command` containing all form state mapped to camelCase keys expected by Rust.
- **Dynamic `allParserTypes` computed property** — merges `staticParserTypes` and `dynamicParserTypes`.
- **`isLoadingPlugins` / `pluginError` state** — UI feedback for async plugin discovery.

### 2.3 Removed

- `CLI_SCRIPT_PATH` constant and all direct Node.js script path references.
- Static-only parser type definitions (now partially dynamic).

### 2.4 Modified

- **`selectPath` method** — expanded to handle `externalProjectPath` and `filesPaths` with Tauri dialog API.
- **`generatedCliCommand` computed** — now splits `ORCHESTR8_CLI_COMMAND` to support multi-part entries like `node /path/to/script.js`.
- **`onMounted` lifecycle hook** — now primary integration point; invokes `list_cli_plugins` with the configured CLI command and maps 12 scaffold subtypes to numbered output directories (`01_overview` through `12_files`).

---

## 3. Reference Documentation Analysis

### 3.1 `prd_generator_reference.vue.txt`

This file is **functionally identical** to the code portion of the integration update notes. It serves as the canonical reference for:

- **Interface contracts** between Vue frontend and Rust backend.
- **Button group generation** using `allParserTypes`.
- **Directory derivation logic** for compare mode (`derivedOutputDir`).
- **CLI string assembly** with `addArg` and `addFlag` helpers.
- **Form reset and validation** patterns.

### 3.2 `PrdMenuView.vue`

A minimal stub (12 lines) that emits a `create-new` event with payload `'prd'`. Represents the entry point/menu for PRD creation in the broader stereOS navigation hierarchy.

---

## 4. Example PRD Output Format

**File:** `example_prd.txt` (47 lines)

The system expects PRD output wrapped in **two XML-like tags**:

```xml
<context>
  # Overview
  # Core Features
  # User Experience
</context>
<PRD>
  # Technical Architecture
  # Development Roadmap
  # Logical Dependency Chain
  # Risks and Mitigations
  # Appendix
</context>
```

### 4.1 Key Format Characteristics

- **Explicit scope-over-time mandate**: "Do not think about timelines whatsoever -- all that matters is scope and detailing exactly what needs to be build in each phase."
- **Logical Dependency Chain** section: Defines foundation-first ordering, getting to a usable front-end as quickly as possible, and atomic feature scoping.
- **Dual-phase structure**: `context` (business/user side) and `PRD` (technical/implementation side).
- **Markdown-native**: All sections use standard Markdown headings.

---

## 5. Evolution Evidence

### 5.1 Filename Variants (Case Sensitivity Map)

| File | Lines | Role | Notes |
|------|-------|------|-------|
| `PrdGenerator.vue Updates for integration.txt` | 523 | Integration spec + code | Contains unique trailing design notes about 7-phase particle UI |
| `prd_generator_reference.vue.txt` | 520 | Reference code | Same code as above, minus trailing notes |
| `PrdGenerator.vue` | 446 | AI Generator (full UI) | Template + script + styles; uses `projectStore` |
| `prdGeneratorView.vue` | 446 | AI Generator (duplicate) | Nearly identical to `PrdGenerator.vue`; minor path/syntax diffs |
| `PRDGenerator.vue` (root) | 221 | AI Generator (minimal) | Script-only; no template; fallback PRD generator |
| `ParserPack/PRDGenerator.vue` | 221 | AI Generator (copy) | **100% identical** to root `PRDGenerator.vue` |
| `PrdMenuView.vue` | 12 | Navigation stub | Emits `create-new` event |

### 5.2 Structural Divergence

The codebase shows **two parallel implementations** that were never merged:

1. **AI Generator Branch** (`PrdGenerator.vue`, `PRDGenerator.vue`):
   - Focus: AI-powered markdown generation (GPT-4 / GPT-3.5).
   - UI: Form with document type, title, technical scope, AI model selector.
   - Output: Markdown preview modal with export to `.md`.
   - Backend commands: `generate_prd`, `get_project_analysis_data`.

2. **CLI Scaffolding Branch** (integration notes / reference):
   - Focus: Code scaffolding, file parsing, feature factory, integr8.
   - UI: Button group for parser types (scaffold, generate-ui, generate-backend, feature-factory, integr8).
   - Output: CLI command strings executed via Rust `run_script_command`.
   - Backend commands: `list_cli_plugins`, `run_script_command`.

---

## 6. Unique IP & Integration Patterns

### 6.1 Unique to Integration Notes (Not in Other Files)

1. **7-Phase Particle UI Vision** — A multi-agent workflow where:
   - An **orchestration agent** pulls UI templates.
   - Particles form around invisible template frames.
   - An **interviewer agent** confirms placements with the user.
   - An **aesthetic architect** agent adjusts particle fields based on user feedback.
   - A **PRD agent** writes hyper-detailed PRDs referencing template IDs and axis changes.
   - The output feeds a **coding execution agent** and **QC agent**.

2. **`integr8` Command** — Dedicated parser type for integrating external projects into stereOS, requiring `externalProjectPath` and `targetPages`.

3. **Dynamic Plugin Discovery** — Frontend does not hardcode scaffold types; it queries Rust at mount time via `list_cli_plugins` and derives labels, output subdirectories, and CLI commands from the response.

4. **Compare Subdirectory Derivation** — Algorithm that automatically maps base output dirs (e.g., `01_overview`) to compare dirs (e.g., `02_overviewCompare`) by parsing numeric prefixes.

5. **`specificOptions` Passthrough** — Dynamic form options from Rust plugins are mapped to Vue form model keys via kebab-to-camelCase conversion (`/[-]([a-z])/g`).

### 6.2 Unique to AI Generator Branch

1. **Markdown Live Preview** — Uses `marked` library with a `watch` on `generatedPRD` to render HTML preview in real-time.
2. **Export to Markdown File** — Tauri `dialog.save` + `writeTextFile` for `.md` export.
3. **Fallback PRD Generator** — On AI failure, generates a structured fallback document with project name, date, requirements, architecture, and implementation phases.
4. **`includeFiles` Toggle** — Optionally fetches `get_project_analysis_data` before calling `generate_prd`.

---

## 7. Redundancies & Duplicates

| Duplicate Set | Files | Match % |
|---------------|-------|---------|
| AI Generator (minimal) | `PRDGenerator.vue` (root) and `ParserPack/PRDGenerator.vue` | **100%** — identical 221-line script-only components |
| AI Generator (full UI) | `PrdGenerator.vue` and `prdGeneratorView.vue` | **~98%** — identical logic; minor diffs in store import path (`../stores/projectStore` vs `../stores/project-store`) and template footer slot syntax (`template footer` vs `template #footer`) |
| CLI Scaffolding Code | `PrdGenerator.vue Updates for integration.txt` (lines 1-520) and `prd_generator_reference.vue.txt` (lines 1-520) | **~99%** — the `.txt` file appends 3 lines of unique design notes at the end |

---

## 8. Configuration & Workflow Summary

### 8.1 Static Parser Types (CLI Branch)

| Type | Label | CLI Command | Output SubDir | Compare Support |
|------|-------|-------------|---------------|-----------------|
| `integr8` | integr8 | `integr8` | `14_integr8` | No |
| `feature-factory` | Feature Factory | `feature-factory` | `15_featureFactory` | No |
| `generate-ui` | UI Generator | `generate-ui` | `13_uiGen` | No |
| `generate-backend` | Back End Generator | `generate-backend` | `16_backendGen` | No |

Dynamic scaffold types (loaded from Rust) include: `overview`, `overviewCompare`, `stores`, `storesCompare`, `routes`, `routesCompare`, `commands`, `types`, `typesCompare`, `ui`, `uiCompare`, `files`.

### 8.2 AI Generator Form Options

| Field | Type | Default | Options |
|-------|------|---------|---------|
| `type` | select | `feature` | Feature PRD, Architecture Overview, Technical Specification, API Documentation |
| `title` | input | `""` | — |
| `technicalScope` | textarea | `""` | Main prompt for AI |
| `includeFiles` | checkbox | `true` | Include project analysis data |
| `aiModel` | select | `gpt-4` | GPT-4, GPT-3.5 Turbo |

---

## 9. Key Takeaways for st8 PRD System Design

1. **Dual-Mode PRD Generation**: The stereOS IP envisions both **AI-generated narrative PRDs** (markdown, human-readable) and **scaffolding-generated structural PRDs** (CLI-driven, code-focused). Any st8 implementation should decide which mode to adopt or how to unify them.

2. **Context/PRD Split**: The `example_prd.txt` format mandates a strict separation between user/business context and technical PRD content. This should be preserved in templates.

3. **Plugin Architecture**: The CLI branch's dynamic plugin loading (`list_cli_plugins`) is a powerful pattern for extensibility. Consider a similar hook system for st8 parser modules.

4. **Agent Orchestration Vision**: The trailing notes in the integration file describe a sophisticated multi-agent particle UI system. While not implemented in code, it represents the aspirational end-state for stereOS PRD generation — a visual, conversational, template-guided workflow rather than a static form.

5. **Naming Inconsistency**: The proliferation of `PrdGenerator.vue`, `PRDGenerator.vue`, `prdGeneratorView.vue`, and `ParserPack/PRDGenerator.vue` indicates unresolved refactoring. A unified naming convention (`PascalCase` matching component export) should be enforced.

---

*End of Report*
