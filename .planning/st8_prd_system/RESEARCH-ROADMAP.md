# ST8 PRD System — Research Roadmapping Prompt

**Date:** 2026-05-13
**Purpose:** Agent-deployable research prompt for distilling all unique PRD IP across the ecosystem
**Output target:** A distilled PRD system concept that the st8 Fingerprint/Identity system will bring to life

---

## 1. Executive Summary

The st8 project needs a PRD generation system. This document maps **all existing PRD-related intellectual property** across the founder's ecosystem — 5 distinct PRD system lineages spanning orchestr8, stereOS/actu8, Orchestr8_jr, maestro, and MetaGPT — to be researched, cross-referenced, and distilled into a unified PRD system concept for st8.

**The key insight:** st8's Fingerprint/Identity system (schema cards + mutation logs) already provides the **data extraction layer** that Orchestr8's parser pipeline built manually. The missing piece is the **PRD composition engine** — the system that takes schema card data and composes structured PRD documents.

---

## 2. Complete File Inventory — All PRD-Related Files

### TIER 1: Core System Architecture Files (Research First)

| Lines | File | What It Contains | Why It Matters |
|-------|------|-----------------|----------------|
| 1,527 | `/home/bozertron/Software Projects/stereOS/IP for actu8/prdPlanning.md` | **THE master planning document.** Complete PrdGenerator component spec: data structures, DB schema, API methods, generation algorithms, UI/UX design, implementation strategy, metrics, competitive analysis. TypeScript interfaces for DocumentModel, SectionType, AssetType, GenerationOptions, AudienceType, DetailLevel. | This is the most comprehensive PRD system design in the ecosystem. Every other system is a subset or evolution of this. |
| 1,527 | `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/Staging/Connection - Files/prdPlanning.md` | Duplicate of above (staged copy) | Same content — confirms this is the canonical version |
| 731 | `/home/bozertron/Software Projects/Dev Tools/orchestr8_unpack/orchestr8_extracted/orchestr8/src/views/PrdGenerator.vue` | **The actual PrdGenerator Vue component.** Full implementation: parser type selection (overview, types, typesCompare, commands, stores, routes, files, uiGen), form model, Tauri invoke calls, progress tracking. | Working implementation reference — shows how the planning document was realized in code |
| 446 | `/home/bozertron/Software Projects/stereOS/IP for actu8/PrdGenerator.vue` | Earlier version of PrdGenerator.vue | Shows evolution of the component |
| 446 | `/home/bozertron/Software Projects/stereOS/IP for actu8/OG PRD/PrdGenerator.vue` | Original ("OG") version of PrdGenerator | Baseline for tracking feature additions |
| 446 | `/home/bozertron/Software Projects/stereOS/IP for actu8/prdGeneratorView.vue` | Alternative naming of PrdGenerator | Confirms naming conventions |
| 266 | `/home/bozertron/Software Projects/stereOS/IP for actu8/PrdEditor.vue` | **The PRD Editor component.** Dynamic field rendering from `_schema`, edit/propose workflow, `propose_prd_update()` integration, AddFieldForm support | The PRD editing experience — how users interact with generated PRDs |
| 152 | `/home/bozertron/Software Projects/stereOS/IP for actu8/prdDefinitions.ts` | **TypeScript type definitions.** `PrdVersion`, `LlmEntityConfig`, `FieldDefinition`, `ChangeRequest`, `ProposalResult`, `WorkflowStep`, `InteractionRecord`, `LlmEntityConfigInput` | Canonical type shapes for the entire PRD system — Rust ↔ TypeScript bridge |
| 202 | `/home/bozertron/Software Projects/orchestr8 Integration Staging/CLAUDE INTEGRATION PRE FIX/src-tauri/src/commands/prd_commands.rs` | **Rust backend commands.** `get_current_prd`, `create_initial_prd`, `propose_prd_update`, `add_prd_field`, `add_prd_version`, `diff_prd_data()` | The server-side PRD API — shows the complete command surface |
| 127 | `/home/bozertron/Software Projects/stereOS/IP for actu8/prd_user_stories_framework.md` | **StereOS MVP definition.** "The Void" (maestro) + "The Generator" (architect), PRD as "living database, not a file" (Atomic DB concept), user story template with Void/Gold/Physics checks | The philosophical framework — PRD as living data, not static documents |

### TIER 2: Integration & Reference Files (Research Second)

| Lines | File | What It Contains |
|-------|------|-----------------|
| 523 | `/home/bozertron/Software Projects/stereOS/IP for actu8/PrdGenerator.vue Updates for integration.txt` | Integration update notes for PrdGenerator |
| 523 | `/home/bozertron/Software Projects/stereOS/IP for actu8/PrdGenerator.vue Staging/PrdGenerator.vue Updates for integration.txt` | Staged version of integration notes |
| 519 | `/home/bozertron/Software Projects/stereOS/IP for actu8/prd_generator_reference.vue.txt` | Reference documentation for the generator component |
| 519 | `/home/bozertron/Software Projects/PRD/prd_generator_reference.vue.txt` | Same reference (PRD directory copy) |
| 519 | `/home/bozertron/Software Projects/maestro-scaffolder-tool/.archive/integration-proposals/PrdGenerator.vue Updates for integration.txt` | maestro integration proposal |
| 519 | `/home/bozertron/Software Projects/EPO Master/[Integration Staging]/docs/generator_reference/prd_generator_reference.vue.txt` | EPO staging copy |
| 519 | `/home/bozertron/1_AT_A_TIME/maestro-scaffolder-tool/.archive/integration-proposals/PrdGenerator.vue Updates for integration.txt` | maestro-scaffolder-tool copy |
| 519 | `/home/bozertron/1_AT_A_TIME/actu8/prd/prd_generator_reference.vue.txt` | actu8 copy |
| 519 | `/home/bozertron/Software Projects/stereOS/IP for actu8/PRD Generator Outputs - Post refactor storage/PrdGenerator.vue Updates for integration.txt` | Post-refactor copy |

### TIER 3: SCOUT PRD Generator Outputs (Per-Domain Parser Results)

| File | What It Is |
|------|-----------|
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-084-OG-PRD.json` | Original PrdGenerator.vue scan result |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-085-PrdGenerator-Staging.json` | Staging version scan |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-086-PRD-Outputs.json` | PRD output files scan |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-087-PRD-01-overview.json` | **Overview parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-088-PRD-03-stores.json` | **Stores parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-089-PRD-05-routes.json` | **Routes parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-090-PRD-07-commands.json` | **Commands parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-091-PRD-08-types.json` | **Types parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-092-PRD-10-ui.json` | **UI parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-093-PRD-12-files.json` | **Files parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-094-PRD-13-uiGen.json` | **UI Generator parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-095-PRD-13-uiGen-src.json` | **UI Generator source parser output** |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-100-PRD-Compiled.json` | **All parsers compiled** — lists all 17 source files in the PRD generator pipeline |
| `/home/bozertron/1_AT_A_TIME/actu8/prd/SCOUT-101-PRD-Documentation.json` | Documentation metadata |

**Critical insight from SCOUT-100:** The compiled output reveals the full parser pipeline source files:
- `overview.ts`, `typeParser.ts`, `routeParser.ts`, `commandParser.ts`, `storeParser.ts`
- `fileRetriever.ts`, `uiGenParser.ts`, `uiParser.ts`, `uiTemplateParser.ts`
- `backendGenParser.ts`, `featureFactory.ts`, `migrationAssistantParser.ts`
- `integr8handler.ts`, `saveScaffoldReport.ts`

### TIER 4: TaskMaster parse-prd Commands (PRD → Tasks Bridge)

| Lines | File | What It Contains |
|-------|------|-----------------|
| 52 | `/home/bozertron/Software Projects/Orchestr8_jr/.claude/commands/tm/parse-prd.md` | **CLI command:** `task-master parse-prd --input=<file>` — analyzes PRD, generates 10-15 tasks with dependencies |
| 51 | `/home/bozertron/Software Projects/Orchestr8_jr/.claude/commands/tm/parse-prd-with-research.md` | Research-enhanced version using Perplexity |
| — | Copies in `.cursor/`, `.gemini/` (TOML), `.roo/`, `.opencode/` | Same commands adapted for different AI editors |

### TIER 5: MetaGPT PRD System (Multi-Agent Reference)

| Lines | File | What It Contains |
|-------|------|-----------------|
| 173 | `/home/bozertron/Renderings/Memory and Context Application/Multi-Agent Model - Lots of Agents Features/MetaGPT/metagpt/actions/write_prd.py` | **Multi-agent PRD generation.** Writer/Analyst/Reviewer roles, triage-first (bugfix/update/new), incremental PRD updates, `CONTEXT_TEMPLATE` and `NEW_REQ_TEMPLATE` |
| — | `metagpt/actions/write_prd_an.py` | Action nodes for structured PRD generation |
| — | `metagpt/actions/write_prd_review.py` | PRD review action |

### TIER 6: Orchestr8_jr PRD Documents (Actual PRDs — Format Reference)

| Lines | File | What It Contains |
|-------|------|-----------------|
| 765 | `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/PRDs/PRD_ORCHESTR8_V4_CONSOLIDATED.md` | Consolidated v4 PRD — largest PRD document |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/orchestr8_next/prds/PRD-00-PROGRAM-GUARDRAILS.md` | Program guardrails PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/orchestr8_next/prds/PRD-01-CORE-SHELL-ACTION-BUS.md` | Core shell + action bus PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/orchestr8_next/prds/PRD-02-SERVICE-ADAPTERS-COMMS.md` | Service adapters PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/orchestr8_next/prds/PRD-03-WORKSPACE-IDE-BRIDGES.md` | Workspace/IDE bridges PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/orchestr8_next/prds/PRD-04-CODE-CITY-VALUE-LAYER.md` | Code City value layer PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/orchestr8_next/prds/PRD-05-CAPABILITY-BRIDGE-SLICES.md` | Capability bridge slices PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/orchestr8_next/prds/PRD-06-OPS-QUALITY-CUTOVER.md` | Ops quality cutover PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/mvp/prds/PRD_ORCHESTR8_JR_MVP.md` | Orchestr8_jr MVP PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/mvp/prds/PRD_A_CODEX_PLAN_MVP.md` | Codex Plan MVP PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/mvp/prds/PRD_2NDFID_EXPLORERS_MVP.md` | 2ndFID Explorers MVP PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/mvp/prds/PRD_OR8_FOUNDER_CONSOLE_MVP.md` | Founder Console MVP PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/mvp/prds/PRD_MINGOS_SETTLEMENT_LAB_MVP.md` | Mingos Settlement Lab MVP PRD |
| — | `/home/bozertron/Software Projects/Orchestr8_jr/.planning/mvp/PRD_MVP_BIG_PICTURE_DRAFT.md` | Big picture draft |
| 423 | `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/.taskmaster/docs/prd_orchestr8_v3_fortress.txt` | v3 Fortress PRD |
| 347 | `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/.taskmaster/docs/ui_design_prd.txt` | UI design PRD |
| 336 | `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/.taskmaster/docs/prd_v3.txt` | v3 PRD |
| 293 | `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/.taskmaster/docs/prd_orchestr8_v3_universal.txt` | v3 Universal PRD |
| 511 | `/home/bozertron/Software Projects/Orchestr8_jr/.taskmaster/templates/example_prd_rpg.txt` | Example PRD template (RPG format) |
| 511 | `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/.taskmaster/templates/example_prd_rpg.txt` | Same template (staged copy) |

### TIER 7: Hardware/Product PRDs (Format Reference Only)

| Lines | File | What It Contains |
|-------|------|-----------------|
| 581 | `/home/bozertron/1_AT_A_TIME/actu8/prd/Walley RLC - PRD - 10182021.docx` | Hardware PRD (Walley RLC) |
| 410 | `/home/bozertron/1_AT_A_TIME/actu8/prd/Walley RLC - PRD - 09072021 - For Team Feedback.docx` | Earlier version of same |
| — | `/home/bozertron/1_AT_A_TIME/actu8/prd/Sled 4.0 PRD.docx` | Hardware PRD (Sled 4.0) |
| — | `/home/bozertron/1_AT_A_TIME/actu8/prd/BLE_Mesh_Hub_PRD.odt` | Hardware PRD (BLE Mesh Hub) |

### Additional Files (in EPO Master and other locations)

| File | What It Is |
|------|-----------|
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-084-OG-PRD.json` | EPO copy of SCOUT output |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-085-PrdGenerator-Staging.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-086-PRD-Outputs.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-087-PRD-01-overview.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-088-PRD-03-stores.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-089-PRD-05-routes.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-090-PRD-07-commands.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-091-PRD-08-types.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-092-PRD-10-ui.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-093-PRD-12-files.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-094-PRD-13-uiGen.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-095-PRD-13-uiGen-src.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-100-PRD-Compiled.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/[Archive]/UI Cleanup/SCOUT-101-PRD-Documentation.json` | EPO copy |
| `/home/bozertron/Software Projects/EPO Master/Marketing/BLE_Mesh_Hub_PRD.odt` | Hardware PRD |
| `/home/bozertron/Software Projects/EPO Master/Marketing/Sled 4.0 PRD.docx` | Hardware PRD |
| `/home/bozertron/Software Projects/orchestr8_next/docs/transfer/SETTLEMENT_MASTER_PRD.md` | Settlement master PRD |
| `/home/bozertron/Software Projects/orchestr8_next/docs/transfer/SETTLEMENT_PRD_OUTLINE.md` | Settlement PRD outline |
| `/home/bozertron/Software Projects/Orchestr8_jr/.planning/projects/or8_founder_console/PRD.md` | Founder Console project PRD |
| `/home/bozertron/Software Projects/Orchestr8_jr/.planning/projects/mingos_settlement_lab/PRD.md` | Mingos Settlement Lab project PRD |
| `/home/bozertron/Software Projects/Orchestr8_jr/.taskmaster/docs/code_city_landscape_blind_integration_prd.txt` | Code City integration PRD |
| `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/docs/PRD_HOLLOW_COMPONENTS_INTEGRATION.md` | Hollow Components integration PRD |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/PrdGenerator.vue Staging/PrdGenerator.vue Updates for integration.txt` | Staging integration notes |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/ParserPack/PRDGenerator.vue` | ParserPack version of PrdGenerator |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/PRDGenerator.vue` | Capitalized filename variant |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/prd_user_story_framework.md.resolved` | Resolved user story framework |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/prd_user_story_framework.md.resolved.0` | Resolved variant 0 |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/prd_user_story_framework.md.resolved.1` | Resolved variant 1 |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/prd_user_story_framework.md.metadata.json` | Metadata for user story framework |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/prd_user_stories_framework.md` | Same as actu8 version (different filename) |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/PrdMenuView.vue` | PRD Menu View component |
| `/home/bozertron/Software Projects/stereOS/IP for actu8/example_prd.txt` | Example PRD output |
| `/home/bozertron/Software Projects/orchestr8 Integration Staging/OG NAMES/prdGeneratorView.vue` | OG name variant |
| `/home/bozertron/Software Projects/orchestr8 Integration Staging/OG PRD/PrdGenerator.vue` | OG PRD directory copy |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/st8_identity_system/17_prd_generation.md` | st8 identity system PRD generation spec |
| `/home/bozertron/1_AT_A_TIME/st8/.planning/st8_identity_system/20_prd_endpoint.md` | st8 identity system PRD endpoint spec |
| `/home/bozertron/1_AT_A_TIME/st8/lib/commands/overview.js` | maestro overview parser (references `prd src/overview.ts`) |

### Deduplicated Count (unique content, not copies)

| Unique Document | Lines | Priority |
|----------------|-------|----------|
| prdPlanning.md | 1,527 | **CRITICAL** |
| PrdGenerator.vue (unpacked) | 731 | **CRITICAL** |
| PRD_ORCHESTR8_V4_CONSOLIDATED.md | 765 | HIGH |
| PrdGenerator.vue Updates for integration.txt | 523 | HIGH |
| prd_generator_reference.vue.txt | 519 | HIGH |
| example_prd_rpg.txt | 511 | MEDIUM |
| PrdGenerator.vue (stereOS) | 446 | HIGH |
| PrdEditor.vue | 266 | HIGH |
| prd_orchestr8_v3_fortress.txt | 423 | MEDIUM |
| prd_commands.rs | 202 | **CRITICAL** |
| prd_user_stories_framework.md | 127 | **CRITICAL** |
| write_prd.py (MetaGPT) | 173 | HIGH |
| prdDefinitions.ts | 152 | **CRITICAL** |
| SCOUT JSON files (14 unique) | ~94 each | MEDIUM |
| parse-prd.md | 52 | MEDIUM |
| parse-prd-with-research.md | 51 | MEDIUM |
| Orchestr8_jr PRDs (6 + 5 MVP + 1 draft) | varies | LOW (format ref) |
| Hardware PRDs (4 files) | varies | LOW (format ref) |

---

## 3. Five PRD System Lineages — Key Architectural Patterns

### Lineage 1: Orchestr8 PrdGenerator (The OG)

**Stack:** Tauri (Rust) + Vue 3 + NaiveUI + SQLite
**Architecture:**
- Parser pipeline: 13+ TypeScript parsers (overview, types, routes, commands, stores, files, uiGen, uiTemplate, backendGen, migrationAssistant, featureFactory)
- Each parser produces a JSON artifact (SCOUT outputs)
- SCOUT-100 compiles all parser outputs
- PrdGenerator.vue selects parser type, configures options, invokes Tauri backend
- Backend stores PRD versions in `PRD_Versions` table
- `prd_data` is a JSON blob: `{ _schema, _meta, fields }`
- `_schema` drives dynamic form rendering in PrdEditor.vue
- Change proposal workflow: `propose_prd_update()` → `diff_prd_data()` → `ChangeRequest`
- LLM integration: `LlmEntityConfig` with `system_prompt`, `model_id`, `entity_type` (Cloud/Mock)

**Key types (from prdDefinitions.ts):**
```typescript
PrdVersion { version_id, project_id, timestamp, approved_by_user_id, based_on_version_id, prd_data, is_current_live }
LlmEntityConfig { id, project_id, role_name, entity_type, llm_provider, api_key, system_prompt, model_id }
FieldDefinition { id, label, field_type, options, required }
ChangeRequest { change_request_id, project_id, target_prd_version_id, proposed_by_user_id, proposed_changes, status, assessment_details, feedback_log, decision_details, resulting_prd_version_id }
ProposalResult { outcome: ProposalOutcome, message }
WorkflowStep { step_id, project_id, block_name, step_order, step_name, description, assigned_entity_role, input_spec, output_spec, completion_criteria, next_step_ids }
```

### Lineage 2: TaskMaster parse-prd

**Stack:** Node.js CLI
**Architecture:**
- Input: PRD file path
- Process: Extract requirements → identify components → detect dependencies → estimate complexity
- Output: 10-15 tasks with dependencies, priorities, acceptance criteria
- Research mode: Uses Perplexity for current best practices
- Available in Claude, Cursor, Gemini (TOML), Roo, OpenCode

**Key pattern:** This is the **PRD→tasks bridge.** After a PRD is generated, this converts it into executable work items.

### Lineage 3: SCOUT PRD Generator Outputs

**Stack:** TypeScript parser pipeline
**Architecture:**
- SCOUT scans directories and identifies UI files
- Each parser type produces a structured JSON output
- SCOUT-100 compiles all outputs into a single view
- 17 source files form the parser pipeline

**Key pattern:** PRD generation is **per-domain decomposition** — not one monolithic document, but structured outputs per architectural concern (types, routes, stores, commands, UI, etc.)

### Lineage 4: MetaGPT write_prd

**Stack:** Python, multi-agent
**Architecture:**
- Three roles: Writer, Analyst, Reviewer
- Triage-first: `run()` classifies input as bugfix/update/new requirement
- Each type has its own handler
- Supports incremental PRD updates via `NEW_REQ_TEMPLATE`
- Uses `ActionNode` system for structured output
- `FileRepository` for version-controlled storage

**Key pattern:** PRD generation is **triage-first** — classify the input, then generate accordingly. Not one-size-fits-all.

### Lineage 5: StereOS/actu8 PRD Framework

**Stack:** Conceptual framework
**Architecture:**
- "The Void" (maestro) as the orchestrating UI
- "The Generator" as the coding partner
- PRD as "Atomic DB" — living database, not a file
- User story template with Void/Gold/Physics acceptance checks
- 7-step dialogue (MVP) → Infinite Refinement (vision)

**Key pattern:** PRD is a **living data structure**, not a static document. It evolves with the project.

---

## 4. st8 Identity System Mapping — What We Already Have

| Orchestr8 Pattern | st8 Identity System Equivalent | Status |
|---|---|---|
| Parser pipeline (13 parsers) | Schema card emitter (AST extraction) | **BUILT** — astParser.js extracts imports/exports/signatures |
| `PrdVersion.prd_data._schema` | `St8SchemaCard` canonical type | **BUILT** — in st8-types.js |
| `PrdVersion.prd_data.fields` | File intent + metadata | **BUILT** — file_intent table + file_registry |
| `LlmEntityConfig.system_prompt` | PRD generation prompt | **NOT BUILT** — the missing composition engine |
| `diff_prd_data()` | Schema card diff | **BUILT** — SchemaCardEmitter.diff() |
| `ProposalResult` workflow | Lifecycle phase transitions | **BUILT** — LifecyclePhase enum + mutation log |
| SCOUT per-domain JSON outputs | Per-file schema cards | **BUILT** — .st8/schema-cards/*.json |
| `parse-prd` task generation | PRD→tasks bridge | **NOT BUILT** |
| "Atomic DB" concept | file_mutation_log + file_registry | **BUILT** — SQLite living database |
| `WorkflowStep` | Not yet mapped | **NOT BUILT** |

---

## 5. Agent Research Instructions

### Wave 1: Deep File Reading (All Tier 1 + Tier 2 files)

For each file, extract:
1. **Type definitions** — all interfaces, enums, classes
2. **API surface** — all function signatures, Tauri commands, store methods
3. **Data flow** — how data enters, transforms, and exits
4. **Composition patterns** — how templates/prompts drive PRD generation
5. **Unique IP** — patterns not found in any other file

### Wave 2: Cross-Reference Analysis

For each pair of systems, identify:
1. **Shared patterns** — what concepts appear in multiple lineages?
2. **Unique innovations** — what does each system do that no other does?
3. **Evolution trail** — how did concepts evolve from Orchestr8 → stereOS → actu8?
4. **Gaps** — what capabilities does no system have yet?

### Wave 3: Distillation

Synthesize findings into:
1. **Unified type system** — canonical PRD types that subsume all lineages
2. **Composition engine spec** — how schema cards become PRD documents
3. **Template architecture** — how PRD templates are defined and applied
4. **LLM integration points** — where AI enhances the generation pipeline
5. **Lifecycle integration** — how PRD generation maps to st8's lifecycle phases

### Key Questions to Answer During Research

1. **Composition model:** Template-driven? LLM-driven? Hybrid? What did the ecosystem converge on?
2. **Granularity:** Per-file PRDs? Per-module? Per-project? All three at different lifecycle phases?
3. **The parse-prd bridge:** Should st8's output be compatible with TaskMaster's format?
4. **The LlmEntity pattern:** Should st8 have configurable LLM entities with system prompts per PRD section?
5. **Living PRD:** Should PRDs be computed on-the-fly from current state (like a database view) or stored and versioned (like Orchestr8's `PRD_Versions` table)?
6. **Schema-driven rendering:** Orchestr8's `_schema` pattern is powerful — should st8 adopt it for dynamic PRD field rendering?
7. **Triage-first generation:** MetaGPT classifies input before generating — should st8 do the same (CONCEPT vs EDIT vs UPDATE)?
8. **Per-domain decomposition:** SCOUT produces per-domain artifacts — should st8 generate per-file, per-module, AND per-project PRDs?

---

## 6. Output Target

After all waves of research, produce a single document: **`PRD-SYSTEM-CONCEPT.md`** in this directory, containing:

1. **Unified Type System** — TypeScript interfaces that merge all lineage types into st8-compatible shapes
2. **Composition Engine Spec** — How schema cards → PRD documents, with templates and prompts
3. **API Surface** — All endpoints and methods the PRD system exposes
4. **Data Model** — SQLite tables, JSON shapes, versioning strategy
5. **Lifecycle Integration** — How PRD generation maps to CONCEPT → LOCKED → WIRING → DEVELOPMENT → PRODUCTION
6. **Implementation Phases** — Ordered task list with dependencies, agent-assignable
