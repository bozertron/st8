# W2-01 Shared Patterns Analysis: Cross-Lineage Convergence in PRD Systems

**Date:** 2026-05-13
**Scope:** 8 Wave 1 research reports across 6 distinct PRD system lineages
**Analyst:** st8 Cross-Reference Agent

---

## Executive Summary

After analyzing eight research reports spanning the stereOS PRD Generator, Orchestr8 parser pipeline, MetaGPT multi-agent system, TaskMaster CLI bridge, SCOUT output corpus, and ACTU8 framework, nine shared architectural patterns emerge that appear in **three or more lineages**. The most significant finding is that **all lineages converge on versioned, template-driven PRD generation with gated change control** — but they approach it from different directions (database-backed vs. Git-backed vs. file-backed). The "right" architecture for st8 must unify these convergent instincts into a single system.

---

## Pattern 1: Versioned PRD Lifecycle with Change Control

**Where It Appears:** prdPlanning (TIER1), PrdGenerator (TIER1), PrdEditor Commands (TIER1), MetaGPT (TIER5), Orchestr8-PRDs (TIER6), ACTU8 (TIER6)

**Description:**
PRDs are not single files that get overwritten. Every lineage treats the PRD as an **evolving artifact with explicit states, versions, and approval gates**. A PRD moves through defined lifecycle stages (Draft → Review → Approved → Deprecated) and each transition creates a persistent snapshot.

**Variations:**

| Lineage | Versioning Model | State Machine | Storage |
|---------|-----------------|---------------|---------|
| **prdPlanning** | `DocumentVersions` table with semantic version strings | `DocumentStatus` enum: Draft, Review, Approved, Deprecated, Archived | SQLite with full JSON snapshot per version |
| **PrdGenerator/PrdEditor** | `PrdVersion` with `based_on_version_id` (parent-child chain) | `ChangeRequest.status`: PendingAssessment → PendingFeedback → Approved/Rejected | SQLite: one live version per project + change request diffs |
| **MetaGPT** | Timestamp-based filenames (`YYYYMMDDHHMMSS.json`) | Implicit via FileRepository + Git commits | Git-backed filesystem with dependency tracking |
| **Orchestr8-PRDs** | Version metadata in headers ("4.0 Consolidated") | Human-driven review with founder signoff blocks | Plain markdown files in versioned directories |
| **ACTU8** | `LifecyclePhase` enum + `mutation_log` table | CONCEPT → LOCKED → WIRING → DEVELOPMENT → PRODUCTION | SQLite with append-only mutation log |

**Convergence Evidence:**
**Strong convergence** on the core idea that PRDs must be versioned and approved, but **divergence on mechanism**. Database-backed lineages (stereOS/ACTU8) use SQL tables with foreign keys; MetaGPT uses Git-native filesystem; Orchestr8 uses human signoff. The consensus is that **overwriting a PRD in-place is unacceptable** — yet no lineage fully automates the approval gate.

---

## Pattern 2: Template/Schema-Driven Generation

**Where It Appears:** prdPlanning (TIER1), PrdGenerator (TIER1), PrdEditor Commands (TIER1), MetaGPT (TIER5), Orchestr8-PRDs (TIER6), SCOUT-Outputs (TIER3), Integration-Reference (TIER2)

**Description:**
PRDs are not freeform text. Every system defines a **structural template** that governs what sections exist, what data types they hold, and how they relate. The template may be explicit (JSON schema, database schema), implicit (XML tags in markdown), or compiled dynamically (Pydantic models at runtime).

**Variations:**

| Lineage | Template Mechanism | Schema Source | Extensibility |
|---------|-------------------|---------------|---------------|
| **prdPlanning** | `DocumentTemplate` with `TemplateSection[]` and per-section `prompts[]` | Hardcoded TypeScript interfaces + DB schema | Add new templates via `save_document_template` |
| **PrdGenerator** | `_schema` embedded in PRD JSON data; fields rendered dynamically by `field_type` | Extracted from PRD data itself at runtime | Add fields via `add_prd_field` without code changes |
| **MetaGPT** | `ActionNode` tree → dynamic Pydantic models at runtime | Python class hierarchy with `expected_type`, `instruction`, `example` | New nodes added via `ActionNode.from_children()` |
| **Orchestr8-PRDs** | XML-like semantic tags (`<context>`, `<PRD>`, `<functional-decomposition>`) | Text templates in `.taskmaster/templates/` | New templates added as `.txt` files |
| **SCOUT** | Numbered domain folders (`01_overview`, `03_stores`) + parser-per-domain | Hardcoded TypeScript parser modules | New parsers registered as `.ts` files |
| **Integration-Reference** | Dual-mode: AI narrative templates vs. CLI scaffolding templates | `example_prd.txt` with `<context>`/`<PRD>` split | Plugin loading via `list_cli_plugins` |

**Convergence Evidence:**
**Strong convergence on structure, divergence on implementation depth.** All lineages agree PRDs need predefined sections, but they solve it at different layers: database schema (stereOS), runtime Pydantic (MetaGPT), XML tags in markdown (Orchestr8), or filesystem conventions (SCOUT). The most sophisticated approach (MetaGPT's ActionNode) is also the heaviest. The most pragmatic (Orchestr8's XML tags) is the most human-editable.

---

## Pattern 3: Per-Domain / Per-Module Decomposition

**Where It Appears:** prdPlanning (TIER1), PrdGenerator (TIER1), SCOUT-Outputs (TIER3), Integration-Reference (TIER2), Orchestr8-PRDs (TIER6), ACTU8 (TIER6)

**Description:**
No lineage generates a PRD as a single monolith. All decompose the problem space into **domain-specific chunks** that can be generated, parsed, or reviewed independently. This avoids LLM context window limits and enables specialized expertise per domain.

**Variations:**

| Lineage | Decomposition Strategy | Domains Identified |
|---------|----------------------|-------------------|
| **prdPlanning** | `DocumentType` enum: 5 document types (FeaturePRD, ArchitectureOverview, etc.) | Feature, Architecture, TechnicalSpec, API, UserFlow |
| **PrdGenerator** | Parser types: 10 distinct analyzers | overview, stores, routes, commands, types, ui, files, generate-ui, generate-backend, feature-factory |
| **SCOUT** | Numbered folder convention (`NN_domain`) with dedicated `.ts` parser per domain | 01_overview, 03_stores, 05_routes, 07_commands, 08_types, 10_ui, 12_files, 13_uiGen |
| **Integration-Reference** | Scaffold subtypes mapped to numbered output directories | Same as PrdGenerator + integr8, feature-factory |
| **Orchestr8-PRDs** | Layered PRD ecosystem: Program → Lane → System → Design | Big Picture, MVP Lanes, V3/V4 System PRDs, UI Design PRDs |
| **ACTU8** | Per-file schema cards grouped by `lifecyclePhase` | CONCEPT, LOCKED, WIRING, DEVELOPMENT, PRODUCTION |

**Convergence Evidence:**
**Near-universal convergence.** Every lineage independently discovered that monolithic PRD generation fails at scale. The SCOUT pipeline's `NN_domain` convention is the most mechanical and reproducible. The Orchestr8 layered ecosystem is the most semantically rich. st8 should adopt **both**: mechanical per-domain parsing (like SCOUT) with semantic layering (like Orchestr8).

---

## Pattern 4: PRD-to-Execution Bridge (Tasks / Workflow / Codegen)

**Where It Appears:** PrdGenerator (TIER1), PrdEditor Commands (TIER1), MetaGPT (TIER5), Orchestr8-PRDs (TIER6), SCOUT-Outputs (TIER3), ACTU8 (TIER6)

**Description:**
A PRD is not an end in itself — it is an input to downstream execution. Every lineage implements some form of **bridge from PRD content to actionable work items**: tasks, workflow steps, code scaffolding, or implementation phases.

**Variations:**

| Lineage | Bridge Mechanism | Output |
|---------|-----------------|--------|
| **PrdGenerator** | `WorkflowStep` interface with `step_order`, `input_spec`, `output_spec`, `completion_criteria`, `next_step_ids` | Ordered workflow steps for structured generation pipelines |
| **PrdEditor Commands** | `task-master parse-prd` CLI: extracts requirements → generates 10-15 tasks with dependencies and acceptance criteria | Task list with dependency graph and sprint recommendations |
| **MetaGPT** | ProductManager role runs `WritePRD` → triages to bugfix/update/new → writes to FileRepository → downstream roles observe | JSON PRD files that Engineer/Architect roles consume |
| **Orchestr8-PRDs** | TaskMaster parses V3 Fortress/Universal format: Phase → Task with Priority/Dependencies/Test Strategy | Executable tasks with explicit dependency chains |
| **SCOUT** | `featureFactory.ts` + `integr8handler.ts` aggregate parsed domains into feature-level artifacts | Feature scaffolding, migration guides, runnable project shells |
| **ACTU8** | `prdGenerator.js` groups schema cards by lifecyclePhase into markdown PRD sections | File-centric PRD with per-phase listings (not yet task-level) |

**Convergence Evidence:**
**Strong convergence on intent, divergence on maturity.** PrdEditor Commands (TaskMaster) and Orchestr8-PRDs have the most mature task-generation bridges. MetaGPT's bridge is implicit (roles observe file changes). ACTU8's bridge is the weakest — it outputs file listings, not tasks. The consensus is that **a PRD without an execution bridge is a dead document**.

---

## Pattern 5: Edit → Propose → Review → Approve Workflow

**Where It Appears:** prdPlanning (TIER1), PrdGenerator (TIER1), PrdEditor Commands (TIER1), MetaGPT (TIER5), Orchestr8-PRDs (TIER6)

**Description:**
PRD changes are not saved directly. They flow through a **gated workflow** where edits are proposed, assessed, reviewed, and either approved (creating a new version) or rejected (with recorded rationale). This mirrors software pull requests but applies to requirements.

**Variations:**

| Lineage | Proposal Mechanism | Review Gate | Approval Model |
|---------|-------------------|-------------|----------------|
| **prdPlanning** | Collaborative editing with change tracking → save creates new `DocumentVersion` | In-app review workflow with comments/suggestions | Human-driven: editor proposes, reviewer approves |
| **PrdGenerator** | `propose_prd_update` → backend diffs current vs. proposed → creates `ChangeRequest` | `ChangeRequest.status`: PendingAssessment → PendingFeedback → Approved/Rejected | System diff + human decision |
| **PrdEditor Commands** | Same as PrdGenerator; Rust backend stores `proposed_changes` as JSON diff | `assessment_details`, `feedback_log`, `decision_details` | Formal assessment with feedback history |
| **MetaGPT** | `WritePRDReview` action returns free-form text feedback; not a blocking gate | Lightweight LLM review via `_aask()` | Implicit: feedback fed into ProductManager memory |
| **Orchestr8-PRDs** | Founder signoff blocks with checkbox negotiation (Agree/Adjust/Rework) | Human founder review with explicit guardrail assumptions | Single human authority (founder) |

**Convergence Evidence:**
**Convergence on the gate, divergence on who guards it.** The PrdGenerator/PrdEditor lineage has the most formal, database-backed change control (diff → ChangeRequest → assessment → approval). MetaGPT's review is too lightweight to be a gate. Orchestr8 uses human signoff. The "right" answer for st8 is likely **PrdEditor's structured ChangeRequest model** with optional human override.

---

## Pattern 6: Code-to-PRD Bidirectional Pipeline

**Where It Appears:** prdPlanning (TIER1), PrdGenerator (TIER1), SCOUT-Outputs (TIER3), ACTU8 (TIER6), Integration-Reference (TIER2)

**Description:**
PRDs should be derived from code, not written from scratch. And code should be derivable from PRDs. This bidirectional flow ensures documentation stays synchronized with implementation.

**Variations:**

| Lineage | Code → PRD | PRD → Code |
|---------|-----------|-----------|
| **prdPlanning** | Deep code analysis: ConnectionVerifier, ConnectionGraph, File Explorer → document sections | Export to Markdown/PDF/Confluence/Notion |
| **PrdGenerator** | 10 parser types analyze code (overview, stores, routes, commands, types, ui, files) | `feature-factory`, `generate-ui`, `generate-backend` scaffold code |
| **SCOUT** | Parser-per-domain extracts code into `.txt` chunks → `featureFactory.ts` synthesizes | `uiGenParser.ts` emits runnable Vite+Vue project; `backendGenParser.ts` emits backend code |
| **ACTU8** | AST extraction + schema card emission creates deterministic JSON per file | `prdGenerator.js` composes schema cards into markdown PRD (one-way today) |
| **Integration-Reference** | `integr8` command imports external projects; `run_script_command` executes analysis | Feature Factory with `createUi`/`createDb` flags generates scaffolding |

**Convergence Evidence:**
**Strong convergence on Code → PRD; weak convergence on PRD → Code.** Every lineage except MetaGPT implements some form of code analysis for PRD generation. But only SCOUT and PrdGenerator implement true PRD → code scaffolding (feature factory, uiGen). ACTU8 is one-way (code → PRD). st8 should prioritize **bidirectional flow** as a differentiator.

---

## Pattern 7: LLM Prompt Orchestration

**Where It Appears:** prdPlanning (TIER1), PrdGenerator (TIER1), MetaGPT (TIER5), PrdEditor Commands (TIER1), ACTU8 (TIER6)

**Description:**
LLMs are not called with a single giant prompt. Instead, prompts are **decomposed, specialized, and orchestrated** — per section, per domain, per role, or per workflow step.

**Variations:**

| Lineage | Orchestration Model | Prompt Specialization |
|---------|--------------------|----------------------|
| **prdPlanning** | `TemplateSection.prompts[]` — per-section prompt list | Audience-adapted (technical vs. business), detail-level adapted (high/medium/low) |
| **PrdGenerator** | `LlmEntityConfig` with `role_name`, `system_prompt`, `model_id` | Role-based LLM entities (Cloud vs. Mock) with configurable providers |
| **MetaGPT** | `ActionNode.compile()` — tree-structured prompt compiler with context + example + instruction + constraint | Per-node instructions with type-safe output schemas and in-context learning examples |
| **PrdEditor Commands** | `parse-prd-with-research` — appends `--research` flag to use research provider (Perplexity/zai-coding) | Research-enhanced mode adds best practices, edge cases, compliance considerations |
| **ACTU8** | User story template with Void/Gold/Physics checks | Quality gates applied to LLM output: minimalism, happy-path clarity, natural emergence |

**Convergence Evidence:**
**Convergence on decomposition, divergence on sophistication.** prdPlanning's per-section `prompts[]` is the simplest and most maintainable. MetaGPT's ActionNode is the most powerful but adds 735 lines of metaprogramming. ACTU8's Void/Gold/Physics checks are unique quality gates. The sweet spot for st8 is likely **prdPlanning's per-section prompts + ACTU8's quality gates**.

---

## Pattern 8: Structured Type-Safe Output

**Where It Appears:** prdPlanning (TIER1), PrdGenerator (TIER1), MetaGPT (TIER5), PrdEditor Commands (TIER1), ACTU8 (TIER6)

**Description:**
PRD data is not untyped text. Every lineage defines **explicit types, interfaces, or schemas** for PRD content, versions, changes, and metadata. This enables validation, diffing, and programmatic consumption.

**Variations:**

| Lineage | Type System | Validation | Key Types |
|---------|------------|-----------|-----------|
| **prdPlanning** | TypeScript interfaces | Form validation + DB constraints | `Document`, `DocumentSection`, `DocumentAsset`, `GenerationOptions` |
| **PrdGenerator** | TypeScript interfaces + Rust structs | Rust `CommandResult<T>` with error mapping | `PrdVersion`, `ChangeRequest`, `WorkflowStep`, `FieldDefinition` |
| **MetaGPT** | Dynamic Pydantic models at runtime | `ActionNode.fill()` validates LLM output against compiled model | `ActionNode`, `BaseModel`, runtime-generated `action_outcls_registry` |
| **PrdEditor Commands** | Rust structs + SQLite CHECK constraints | DB-level enum constraints, JSON diff validation | `PrdVersion`, `ProposalResult`, `NewFieldDefinition` |
| **ACTU8** | JavaScript `Object.freeze()` schemas + SQLite types | Schema card shape enforcement, hash verification | `St8FileEntry`, `St8SchemaCard`, `LifecyclePhase`, `FileStatus` |

**Convergence Evidence:**
**Universal convergence.** Every lineage uses strong typing. The most pragmatic approach (PrdGenerator's TypeScript + Rust split) mirrors st8's existing stack. MetaGPT's dynamic Pydantic is overkill for a single-user tool.

---

## Pattern 9: Markdown / JSON Hybrid Format

**Where It Appears:** prdPlanning (TIER1), PrdGenerator (TIER1), MetaGPT (TIER5), Orchestr8-PRDs (TIER6), ACTU8 (TIER6), PrdEditor Commands (TIER1)

**Description:**
PRDs are stored and transmitted in **two forms simultaneously**: a machine-readable structured representation (JSON, database rows) and a human-readable rendered representation (Markdown, HTML, PDF).

**Variations:**

| Lineage | Machine Form | Human Form | Source of Truth |
|---------|-------------|-----------|----------------|
| **prdPlanning** | SQLite tables with `content_json` | Markdown preview + WYSIWYG editor | Database (JSON) |
| **PrdGenerator** | `PrdVersion.prd_data` (JSON blob) | Dynamic form UI rendered from `_schema` | Database (JSON) |
| **MetaGPT** | Timestamped `.json` files (Pydantic dumps) | Markdown + PDF + Mermaid charts | JSON (Markdown is secondary artifact) |
| **Orchestr8-PRDs** | XML-tagged markdown (`<context>`, `<PRD>`) | Rendered markdown with ASCII diagrams | Markdown (with machine-parseable tags) |
| **ACTU8** | `St8SchemaCard` JSON in `.st8/schema-cards/` | `prdGenerator.js` composes markdown PRD | JSON schema cards (PRD is a view) |
| **PrdEditor Commands** | `prd_data` JSON text in SQLite | TaskMaster consumes markdown PRD files | SQLite (JSON) |

**Convergence Evidence:**
**Convergence on duality, divergence on which side is primary.** MetaGPT and PrdEditor treat JSON as source-of-truth. Orchestr8 treats Markdown as source-of-truth with XML tags for machine parsing. ACTU8's "Atomic DB" vision is the most philosophically pure: **the PRD is a queryable view, not a file**. This is the direction st8 should take.

---

## Cross-Pattern Synthesis: What This Tells Us About st8 Architecture

### The Consensus Architecture

Every lineage, in its own way, is converging on the same shape:

```
[Codebase Analysis] ──► [Per-Domain Extraction] ──► [Structured Schema/Templates]
                                                              │
                                                              ▼
[LLM Enhancement] ◄── [Prompt Orchestration] ◄── [Template-Driven Generation]
                                                              │
                                                              ▼
[Versioned PRD Store] ──► [Edit/Propose/Review/Approve] ──► [Execution Bridge]
       │                                                              │
       └──────────────────── [Markdown View] ◄───────────────────────┘
```

### Critical Architectural Decisions for st8

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **Source of truth** | SQLite + JSON schema cards (ACTU8 model) | PRD is a view over the database, not a file. This enables real-time regeneration, diffing, and querying. |
| **Change control** | PrdEditor's `ChangeRequest` model | Formal diff → assessment → approval with recorded rationale. Do not allow direct overwrites. |
| **Decomposition** | SCOUT's `NN_domain` + Orchestr8's semantic layering | Numbered domain parsers for mechanical decomposition; layered PRD types (Program/Lane/System/Design) for semantic organization. |
| **Template system** | prdPlanning's `TemplateSection.prompts[]` + ACTU8's quality gates | Per-section prompt lists are maintainable; Void/Gold/Physics checks enforce output quality. |
| **Execution bridge** | TaskMaster's `parse-prd` + PrdGenerator's `WorkflowStep` | Generate tasks with dependencies from approved PRDs; use WorkflowSteps for structured generation pipelines. |
| **Bidirectional flow** | SCOUT's `uiGenParser.ts` + `backendGenParser.ts` | Code → PRD (analysis) and PRD → Code (scaffolding) must both be first-class. |
| **Type system** | Static TypeScript + Rust (PrdGenerator model) | Avoid MetaGPT's dynamic Pydantic metaprogramming. Use static types with JSON serialization. |
| **LLM integration** | Role-based `LlmEntityConfig` with per-section prompts | Configurable providers, mockable for testing, system prompts per generation domain. |

### The Single Most Important Insight

> **The PRD should not be a document. It should be a query interface over a living database of codebase facts.**

ACTU8's "Atomic DB" philosophy is the correct north star. All other lineages treat the PRD as a file or a document that gets versioned. ACTU8 alone treats it as an emergent property of the codebase. When st8 regenerates the PRD from schema cards on every request, it achieves something no other lineage has: **documentation that cannot drift from implementation** because it is not stored — it is computed.

The remaining lineages contribute the machinery that ACTU8 lacks:
- **PrdEditor Commands** gives us the change-request workflow
- **SCOUT** gives us the per-domain parser pipeline
- **TaskMaster** gives us the PRD-to-tasks bridge
- **prdPlanning** gives us the template system and audience adaptation
- **MetaGPT** gives us structured output validation (simplified)
- **Orchestr8-PRDs** gives us the semantic layering and ASCII diagram conventions

st8's job is to **unify these convergent instincts into one system** where the PRD is always a live query, never a stale file.

---

*End of Analysis Report*
