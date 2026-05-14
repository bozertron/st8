# ST8 PRD System — Agent Wave Strategy & Documentation Architecture

**Status:** PROPOSED — awaiting discussion/brainstorm & approval
**Date:** 2026-05-13
**Scope:** Research, cross-reference, and distill all PRD-related IP across the ecosystem into a unified PRD system specification for st8

---

## Acknowledging What This Is

We are building **the PRD for the PRD System**.

The st8 Identity System already provides:
- Schema card emitter (AST extraction) ← replaces Orchestr8's parser pipeline
- `St8SchemaCard` canonical types ← replaces `PrdVersion.prd_data._schema`
- File mutation log + registry ← realizes the "Atomic DB" concept
- Schema card diff ← replaces `diff_prd_data()`

What we are now designing is **the composition engine** — the system that takes schema card data and composes structured, living PRD documents for software (firmware → frontend) AND hardware (premium consumer products → industrial manufacturing equipment).

---

## 1. Documentation Architecture

We produce a **living specification system**, not a single document. The structure ensures every wave's output feeds the next, and nothing is lost.

```
.planning/st8_prd_system/
├── RESEARCH-ROADMAP.md                     (already exists — master index)
├── AGENT-WAVE-STRATEGY.md                  <-- THIS DOCUMENT (the plan)
├── wave-manifest.md                        <-- Running tracker of all waves
│
├── research-reports/                       (Wave 1: Deep file reading)
│   ├── W1-01-TIER1-prdPlanning.md          (1,527 lines — the canonical spec)
│   ├── W1-02-TIER1-PrdGenerator.md         (Vue implementation + types)
│   ├── W1-03-TIER1-PrdEditor_Commands.md   (Editor + Rust backend)
│   ├── W1-04-TIER3-SCOUT-Outputs.md        (JSON data extraction)
│   ├── W1-05-TIER2-Integration-Reference.md (Integration notes + reference)
│   ├── W1-06-TIER5-MetaGPT-PRD.md          (Multi-agent Python PRD system)
│   ├── W1-07-TIER6-Orchestr8-PRDs.md       (Actual PRD document formats)
│   ├── W1-08-TIER4-TaskMaster-parse-prd.md (PRD → tasks bridge)
│   ├── W1-09-TIER7-Hardware-PRDs.md        (Hardware PRD patterns)
│   ├── W1-10-ACTU8-Framework.md            (User story + Atomic DB philosophy)
│   └── W1-11-ST8-Current-State.md          (st8 existing PRD-relevant code)
│
├── analysis-reports/                       (Wave 2: Cross-reference)
│   ├── W2-01-Shared-Patterns.md            (What appears in 3+ lineages)
│   ├── W2-02-Evolution-Trail.md            (How ideas migrated across lineages)
│   ├── W2-03-Unique-Innovations.md         (What each lineage does that no other does)
│   ├── W2-04-Capability-Gaps.md            (What no lineage covers yet)
│   ├── W2-05-Software-PRD-Patterns.md      (General product management research)
│   ├── W2-06-Hardware-PRD-Patterns.md      (Industrial/consumer hardware PRD research)
│   ├── W2-07-Multi-Agent-PRD-Gen.md        (Meta-level: PRD systems that build PRDs)
│   └── W2-08-Reference-Model.md            (Industry-standard PRD reference models)
│
├── distilled-specs/                        (Wave 3: Synthesis)
│   ├── D1-Unified-Type-System.md           (TypeScript interfaces for all PRD types)
│   ├── D2-Composition-Engine.md            (Schema cards → PRD documents)
│   ├── D3-Template-Architecture.md         (Templates, prompts, formatting rules)
│   ├── D4-LLM-Integration.md               (LlmEntity pattern, prompts, triage)
│   ├── D5-Lifecycle-Integration.md         (CONCEPT→LOCKED→WIRING→DEVELOPMENT→PRODUCTION)
│   ├── D6-API-Surface.md                   (HTTP endpoints, CLI commands, methods)
│   ├── D7-Data-Model.md                    (SQLite tables, JSON shapes, versioning)
│   ├── D8-Change-Proposal-Workflow.md      (propose/diff/approve cycle)
│   ├── D9-Hardware-Software-Bridge.md      (Handling all domains st8 covers)
│   └── D10-Implementation-Phases.md        (GSD-style ordered task list)
│
├── prd-system-concept.md                   (Wave 4: Final unified PRD)
└── implementation-readiness-report.md        (What to build, in what order)
```

### Why This Structure Works

1. **Backtrackable:** If we discover something in Wave 3 that needs re-investigation, the Wave 1 reports are preserved.
2. **Parallelizable:** Agents in Wave 1 don't depend on each other (mostly). Same for Wave 2.
3. **Reproducible:** Every output is labeled with source files and lineage.
4. **Handoff-ready:** The implementation phases in D10 become the roadmap for the actual build.

---

## 2. Agent Wave Strategy

### Agent Types (Roles)

| Agent Type | Tool Access | Specialty | Used In |
|-----------|-------------|-----------|---------|
| **Research Agent** (`explore`) | Read/Glob | Deep file reading, pattern extraction | Wave 1 |
| **Domain Research Agent** (`gsd-domain-researcher`) | Web Fetch / Read | External research, best practices, standards | Wave 2 |
| **Cross-Reference Agent** (`general`) | Read | Compares multiple files, traces evolution | Wave 2 |
| **Synthesis Agent** (`gsd-planner` style) | Read/Write | Creates specs from research findings | Wave 3 |
| **Verification Agent** (`gsd-verifier` style) | Read | Checks completeness, coverage, quality | Wave 4 |
| **Gap Analysis Agent** (`general`) | Read | Identifies missing capabilities | Wave 2 & 4 |

---

### Wave 1: Deep File Reading (The Archaeological Dig)

**Goal:** Extract structured intelligence from every file in the research roadmap.
**Parallelism:** HIGH — agents read different files simultaneously.
**Output:** One research report per file group.

#### W1-01: prdPlanning.md (The Master Document)
- **File:** `/home/bozertron/Software Projects/stereOS/IP for actu8/prdPlanning.md` (1,527 lines)
- **Agent:** Research Agent
- **Task:** Read the complete document. Extract ALL type definitions, DB schema, API methods, generation algorithms, UI/UX design, metrics, competitive analysis. This is the canonical design — every other file compares to this.

#### W1-02: PrdGenerator.vue + Supporting Types
- **Files:**
  - PrdGenerator.vue (731 lines — working implementation)
  - prdDefinitions.ts (152 lines)
  - PrdGenerator.vue (stereOS, 446 lines — evolution)
  - PrdEditor.vue (266 lines)
- **Agent:** Research Agent
- **Task:** Extract complete component API, parser type selection, form model, Tauri invoke calls, progress tracking, edit/propose workflow, `propose_prd_update()` integration. Note evolution between OG → stereOS → Orchestr8_jr versions.

#### W1-03: Rust Backend + CLI
- **Files:**
  - prd_commands.rs (202 lines)
  - parse-prd.md (52 lines)
  - parse-prd-with-research.md (51 lines)
- **Agent:** Research Agent
- **Task:** Extract all Rust backend commands (get_current_prd, create_initial_prd, propose_prd_update, add_prd_field, etc.). Extract CLI behavior and research-enhanced PRD parsing flow.

#### W1-04: SCOUT Outputs
- **Files:** All 14 SCOUT JSON files in `/home/bozertron/1_AT_A_TIME/actu8/prd/`
- **Agent:** Research Agent (JSON analysis)
- **Task:** Parse each JSON output. Identify the 17 source parsers. Map which ones produce what kind of data. Extract the "per-domain decomposition" pattern — how PRD generation breaks down by concern (overview, types, routes, stores, commands, UI, etc.).

#### W1-05: Integration Notes & Reference
- **Files:** PrdGenerator.vue Updates for integration.txt, prd_generator_reference.vue.txt, example_prd_rpg.txt
- **Agent:** Research Agent
- **Task:** What changed between versions? What integration points exist? What is example_prd_rpg.txt's format and why was it chosen?

#### W1-06: MetaGPT Multi-Agent PRD
- **Files:** write_prd.py, write_prd_an.py, write_prd_review.py
- **Agent:** Research Agent
- **Task:** Extract Writer/Analyst/Reviewer roles, triage-first logic, incremental PRD updates, ActionNode system, FileRepository pattern, CONTEXT_TEMPLATE, NEW_REQ_TEMPLATE. How does multi-agent collaboration work?

#### W1-07: Orchestr8_jr PRD Documents (Format Reference)
- **Files:** PRD_ORCHESTR8_V4_CONSOLIDATED.md (765 lines), all MVP PRDs, v3/v3_fortress PRDs
- **Agent:** Research Agent
- **Task:** Analyze PRD FORMAT, not content. What sections exist? What ordering? What detail levels? How do PRDs for different subsystems (shell, service adapters, workspace, code city, etc.) differ in structure? Extract a "PRD schema" from the documents themselves.

#### W1-08: TaskMaster parse-prd Commands
- **Files:** All parse-prd variants (Claude, Cursor, Gemini, Roo, OpenCode)
- **Agent:** Research Agent
- **Task:** Extract the PRD → tasks bridge. What does it extract from a PRD? How does it handle dependencies? What research mode adds? Write the algorithm.

#### W1-09: Hardware/Product PRDs
- **Files:** Walley RLC PRDs (2 versions), Sled 4.0 PRD, BLE_Mesh_Hub_PRD
- **Agent:** Research Agent
- **Task:** These are DOCX/ODT files. Extract structure, sections, and content patterns. How do hardware PRDs differ from software PRDs? What sections exist that don't appear in software PRDs (materials, tolerances, certifications, manufacturing processes, supply chain, etc.)?

#### W1-10: Atomic DB Philosophy & Current st8 State
- **Files:**
  - prd_user_stories_framework.md (127 lines)
  - st8 identity system: 17_prd_generation.md, 20_prd_endpoint.md
  - st8 codebase: astParser.js, schemaCardEmitter.js, file_registry tables
- **Agent:** Research Agent
- **Task:** Understand the "living database, not a file" philosophy. Map st8's current capabilities against Orchestr8's. What is already built? What is the missing composition engine?

**Wave 1 Trigger:** Execute all 10 agents in parallel. Each outputs a structured report.

---

### Wave 2: Cross-Reference Analysis (Connecting the Dots)

**Goal:** Compare, contrast, trace, and identify gaps across all Wave 1 findings.
**Parallelism:** MEDIUM — some agents need Wave 1 outputs; some can run immediately.
**Output:** Analysis reports with specific findings.

#### W2-01: Shared Patterns Analysis
- **Input:** All Wave 1 reports
- **Agent:** Cross-Reference Agent
- **Task:** What concepts appear in 3+ lineages? e.g., "PRD versioning" appears in Lineage 1 (PRD_Versions table) and Lineage 5 (mutation log). "Per-domain decomposition" appears in Lineage 1 (13 parsers) and Lineage 3 (SCOUT). List shared patterns with confidence levels.

#### W2-02: Evolution Trail
- **Input:** Wave 1-01, W1-02, W1-10
- **Agent:** Cross-Reference Agent
- **Task:** How did the PRD system evolve? Orchestr8 (OG) → stereOS (actu8 concepts) → actu8 (staged copy) → st8 (current). What was added? Removed? Changed philosophy? Document the evolution with specific code references.

#### W2-03: Unique Innovations per Lineage
- **Input:** All Wave 1 reports
- **Agent:** Cross-Reference Agent
- **Task:** For each lineage, what does it do that NO OTHER lineage does? e.g., MetaGPT has multi-agent triage-first classification. SCOUT has per-domain JSON outputs. Orchestr8 has change proposal workflow with diff. StereOS has the "Atomic DB" philosophy.

#### W2-04: Capability Gaps
- **Input:** All Wave 1 + W2-01
- **Agent:** Gap Analysis Agent
- **Task:** What capabilities does NO system have yet? SaaS PRD? Hardware PRD integration? Collaborative editing? Real-time updates? Export to multiple formats? These become st8's innovation opportunities.

#### W2-05: Software PRD Best Practices (External Research)
- **Input:** None (web research)
- **Agent:** Domain Research Agent
- **Task:** Research modern PRD best practices from product management literature. What makes a PRD "good"? What do teams like Linear, Figma, Vercel do? What do actual product managers evaluate? Specifically search for:
  - "product requirements document best practices 2025 2026"
  - "PRD template software engineering"
  - "PRD anti-patterns product management"

#### W2-06: Hardware/Product PRD Best Practices (External Research)
- **Input:** Wave 1-09
- **Agent:** Domain Research Agent
- **Task:** Research hardware/product PRD standards and frameworks. How do companies like Apple, Dyson, or industrial equipment manufacturers structure product requirements? What sections are mandatory for hardware? Search for:
  - "hardware product requirements document template"
  - "industrial equipment specification document"
  - "consumer electronics PRD manufacturing"

#### W2-07: Multi-Agent PRD Generation Research
- **Input:** Wave 1-06
- **Agent:** Domain Research Agent
- **Task:** Research how multi-agent systems generate specifications/documents. What are the state-of-the-art approaches? Is MetaGPT still the reference? Look for:
  - "multi-agent system document generation 2025 2026"
  - "LLM agent collaboration specification writing"

#### W2-08: Industry Reference Model
- **Input:** None
- **Agent:** Domain Research Agent
- **Task:** Research if there exist standardized PRD formats or reference models (like ISO standards, IEEE standards) that st8 should align with or be compatible with.

**Wave 2 Trigger:** Starts immediately after Wave 1 completes. Some agents (W2-05 to W2-08) can start in parallel with Wave 1 since they're external research.

---

### Wave 3: Distillation & Synthesis (The Composition)

**Goal:** Turn research + analysis into concrete specifications that can be implemented.
**Parallelism:** MEDIUM-HIGH — agents produce sections of the spec independently, but a final integration pass is needed.
**Output:** Distilled spec documents (D1-D10).

#### W3-01: Unified Type System (D1)
- **Input:** W1-02 (types), W1-03 (Rust types), W1-10 (st8 types), W2-01 (shared patterns)
- **Agent:** Synthesis Agent
- **Task:** Merge all lineage types into a canonical set of TypeScript interfaces for st8's PRD system. Map Rust ↔ TypeScript equivalencies. Define PrdVersion, PrdData, PrdSection, Template, ChangeRequest, ProposalResult, WorkflowStep, etc.

#### W3-02: Composition Engine (D2)
- **Input:** W1-01 (algorithms), W1-04 (SCOUT decomposition), W2-01 (shared patterns)
- **Agent:** Synthesis Agent
- **Task:** Specify how schema cards become PRD documents. Template-driven? LLM-driven? Hybrid? Per-domain composition? Multi-granularity (per-file, per-module, per-project)?

#### W3-03: Template Architecture (D3)
- **Input:** W1-01 (templates), W1-07 (PRD formats), W2-05 (best practices), W2-06 (hardware)
- **Agent:** Synthesis Agent
- **Task:** Define template system for different PRD types: Software component, Hardware product, API/service, Firmware module, Industrial equipment. Define template inheritance, customization, and variable substitution.

#### W3-04: LLM Integration Points (D4)
- **Input:** W1-02 (LlmEntityConfig), W1-06 (MetaGPT patterns), W2-07 (multi-agent)
- **Agent:** Synthesis Agent
- **Task:** Specify LlmEntity pattern, system prompts per section, triage-first classification (CONCEPT vs EDIT vs UPDATE), prompt templates, research enhancement (Perplexity integration).

#### W3-05: Lifecycle Integration (D5)
- **Input:** W1-10 (st8 lifecycle), W2-02 (evolution)
- **Agent:** Synthesis Agent
- **Task:** Map PRD generation to st8 lifecycle phases: CONCEPT (lightweight PRD) → LOCKED (validated PRD) → WIRING (component PRDs) → DEVELOPMENT (living PRD with diffs) → PRODUCTION (as-built spec).

#### W3-06: API Surface & Data Model (D6 + D7)
- **Input:** W1-02 (Vue API), W1-03 (Rust commands), W1-10 (st8 server)
- **Agent:** Synthesis Agent
- **Task:** Specify all HTTP endpoints, CLI commands, and server methods. Define SQLite tables for PRD storage, versioning strategy, JSON shapes.

#### W3-07: Change Proposal Workflow (D8)
- **Input:** W1-02 (propose_prd_update), W1-06 (incremental updates), W2-03 (unique innovations)
- **Agent:** Synthesis Agent
- **Task:** Specify the propose → diff → assess → feedback → approve/reject → version cycle. How does st8's existing mutation log enable this? How is the UI workflow structured?

#### W3-08: Hardware-Software Bridge (D9)
- **Input:** W1-09 (hardware PRDs), W2-06 (hardware research), W2-04 (gaps)
- **Agent:** Synthesis Agent
- **Task:** Specify how the PRD system handles the full spectrum: firmware (bare metal C/ASM) → backend services → frontend UIs → consumer hardware (industrial design, materials) → industrial equipment (safety, certifications, compliance).

#### W3-09: Implementation Phases (D10)
- **Input:** All D1-D9, W2-04 (gaps)
- **Agent:** Synthesis Agent
- **Task:** Create a GSD-compatible implementation plan. Ordered phases with dependencies, estimated complexity, agent-assignable tasks. Map to st8's existing roadmap.

**Wave 3 Trigger:** Starts when Wave 2 completes.

---

### Wave 4: Verification & Packaging (The Final PRD)

**Goal:** Ensure completeness, consistency, and readiness for implementation.
**Parallelism:** LOW — sequential verification passes.
**Output:** Final deliverables.

#### W4-01: Completeness Audit
- **Input:** All D1-D10 + RESEARCH-ROADMAP.md questions
- **Agent:** Verification Agent
- **Task:** Verify that EVERY question from the roadmap's "Key Questions" section (and our additional questions) has been answered. Cross-check all unique IP was captured. Verify no Wave 1 finding was lost.

#### W4-02: Consistency Check
- **Input:** All D1-D10
- **Agent:** Verification Agent
- **Task:** Check for contradictions between specs. Does D2's composition engine match D6's API? Does D5's lifecycle map to D7's data model? Are type names consistent across all specs?

#### W4-03: st8 Integration Feasibility
- **Input:** All D1-D10 + st8 codebase
- **Agent:** Gap Analysis Agent
- **Task:** Verify the specs are implementable in st8's current architecture. Does the PRD system need changes to the schema card format? Can the existing file_registry support PRD metadata? What's the delta?

#### W4-04: Produce Final PRD-SYSTEM-CONCEPT.md
- **Input:** Everything
- **Agent:** Synthesis Agent (final pass)
- **Task:** Write the unified final document. Merge all D1-D10 into a coherent, readable specification. This is the "PRD for the PRD system."

#### W4-05: Produce Implementation Readiness Report
- **Input:** D10 + W4-03 delta
- **Agent:** Synthesis Agent
- **Task:** What can be built next? What has prerequisites? What can run in parallel? Produce a concrete, agent-executable next wave.

**Wave 4 Trigger:** Starts when Wave 3 completes.

---

## 3. Information Refinement System

### The Guarantee: How We Ensure No Good Idea Is Lost

The entire pipeline is designed around **traceability** and **redundancy reduction**:

#### 3.1 Structured Extraction Template (Every Wave 1 Agent Must Use)

Every research agent outputs their findings in this exact structure:

```markdown
## Source File: {path}
### Lineage: {which of the 5}
### Types Extracted
- `{TypeName}` — {description, source file lines}
### API Surface
- `{functionName}({args})` — {return type, description, source file lines}
### Data Flow
- Input: {what goes in}
- Transform: {what happens}
- Output: {what comes out}
### Composition Patterns
- {How this system composes/generates PRDs}
### Unique IP (Not Found in Other Lineages)
- {specific innovation, with code reference}
### Redundancies (Overlaps with Other Files)
- {what this file duplicates from elsewhere}
### Knowability Gaps (What Is This File Missing That Others Had?)
- {what this system doesn't do that others do}
```

#### 3.2 Cross-Reference Tagging

Every extracted pattern gets tagged with its provenance:
- `[LINEAGE-1:prdPlanning.md:L42]` — Orchestr8 master doc, line 42
- `[LINEAGE-3:SCOUT-100:overview]` — SCOUT parser pipeline, overview section
- `[LINEAGE-5:prd_user_stories_framework.md:S3]` — StereOS philosophy, Section 3

This allows readers of Wave 2 and Wave 3 to instantly verify claims by checking the source.

#### 3.3 The "Innovation Bubbler"

Unique IP (patterns found in only ONE lineage) gets **prominently flagged** in Wave 1 reports with a `🆕 UNIQUE` marker. These become focal points in Wave 2-3 analysis. The question is always: "Should st8 adopt this unique innovation?"

#### 3.4 The "Evolution Tracer"

When the same concept appears across versions (e.g., PrdGenerator.vue OG → stereOS → Orchestr8_jr), Wave 2 agents must trace the evolution:
- What changed?
- Why did it change?
- What was added/removed?
- What does the evolution tell us about the optimal design?

#### 3.5 The "Hardware-Software Bridge Matrix"

Since st8 spans both, every spec section must answer: **"How does this apply to firmware? To backend APIs? To frontend UIs? To hardware products? To industrial equipment?"**

#### 3.6 The "Fingerprint/Identity Mapping"

Every Wave 3 specification MUST include a mapping table showing how it leverages existing st8 identity system features:

| Orchestr8 Pattern | st8 Equivalent | Used By This Spec? | Notes |
|---|---|---|---|
| Parser pipeline | Schema card emitter | Yes | Replaces 13 parsers |
| `PrdVersion` | `file_mutation_log` | Yes | Versioning via mutation log |
| `diff_prd_data()` | `SchemaCardEmitter.diff()` | Yes | Already implemented |
| `LlmEntityConfig` | ??? | TBD | Not yet in st8 — add? |

#### 3.7 The "Coverage Checklist"

After Wave 4, the Verification Agent checks against this mandatory coverage matrix:

| Capability | Source Lineage | Captured in D? | Implemented in st8? |
|---|---|---|---|
| PRD versioning | Lineage 1 | TBD | Partial (mutation log) |
| Parser pipeline | Lineage 1,3 | TBD | Yes (schema cards) |
| Per-domain decomposition | Lineage 1,3 | TBD | Partial |
| Triage-first generation | Lineage 4 | TBD | No |
| Multi-agent PRD | Lineage 4 | TBD | No |
| PRD → tasks bridge | Lineage 2 | TBD | No |
| Change proposal workflow | Lineage 1 | TBD | No |
| Atomic DB concept | Lineage 5 | TBD | Yes (file_registry) |
| Hardware PRD support | Lineage 7 | TBD | No |
| Template-driven composition | Lineage 1 | TBD | No |

---

## 4. Additional Strategic Questions (Beyond Roadmap)

The original roadmap asks 8 excellent questions. I propose adding these for Wave 2-3 to answer:

**9. Hardware PRD Convergence:** How do we bridge from software PRDs to hardware PRDs? What sections exist in hardware PRDs (material specs, tolerances, certifications, manufacturing processes) that don't appear in software? Should the PRD system be domain-aware and generate different section sets?

**10. Schema Card ↔ PRD Bidirectionality:** Can PRD edits trigger schema changes (e.g., "add a new API endpoint" in PRD → generate stub code)? Can schema changes auto-update the PRD? Is the PRD a "view" on the database or a separate document?

**11. Multi-Format Output:** Should PRDs output markdown (for humans), JSON (for machines), DOCX (for stakeholders), and interactive web views (for developers)? What is the single source of truth?

**12. LLM Entity Configuration:** Should st8 have configurable LLM entities with system prompts per PRD section (like Orchestr8)? Or a single prompt? Or a prompt hierarchy?

**13. The "Living" Aspect:** If PRDs are "living data," what is the refresh cadence? On every file save? On demand? On lifecycle phase transitions? How do we prevent PRD drift from reality?

**14. Scale Handling:** What happens when a project has 10,000 files? 100,000? Does the PRD system paginate? Produce summaries? Per-module PRDs?

---

## 5. Proposed Execution Order

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0: Preparation (Now)                                     │
│  - Finalize this strategy (brainstorm/discuss with you)         │
│  - Create wave-manifest.md tracker                              │
│  - Confirm agent types and assignments                          │
│  - Prep output directory structure                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Wave 1 (Deep Reading)                                 │
│  - Deploy 10 research agents in parallel                        │
│  - Each reads assigned file(s)                                  │
│  - Each produces structured report                              │
│  - Collect all reports                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Wave 2 (Cross-Reference + External Research)          │
│  - Deploy 8 analysis agents (4 internal + 4 external)           │
│  - External research starts in parallel with Wave 1             │
│  - Internal cross-reference starts after Wave 1                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Wave 3 (Distillation)                                 │
│  - Deploy 9 synthesis agents                                    │
│  - Each produces one distilled spec (D1-D9)                     │
│  - Final synthesis agent produces D10                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Wave 4 (Verification + Final PRD)                     │
│  - Deploy 5 verification agents                                 │
│  - Produce PRD-SYSTEM-CONCEPT.md                                │
│  - Produce implementation-readiness-report.md                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: Handoff to Implementation                             │
│  - D10 becomes the implementation roadmap for st8 dev           │
│  - PRD-SYSTEM-CONCEPT.md becomes the living specification       │
│  - Remaining gaps become backlog items                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Success Criteria for the Full Research Pipeline

After all waves complete, we should be able to answer **yes** to every item:

- [ ] Every file in the research roadmap (all 7 tiers) has been read and analyzed
- [ ] Every unique type definition from all lineages is captured in D1
- [ ] Every unique API/method is captured in D6
- [ ] Every composition pattern is captured in D2
- [ ] Every template format is captured in D3
- [ ] Every LLM integration point is captured in D4
- [ ] The 8 roadmap questions + 6 additional questions are all answered
- [ ] The hardware-software bridge is specified in D9
- [ ] The st8 integration map (what exists vs needs building) is clear
- [ ] PRD-SYSTEM-CONCEPT.md reads as a coherent, implementable specification
- [ ] D10 provides an ordered, dependency-resolved implementation plan
- [ ] No "unique IP" from any lineage was lost during synthesis

---

## 7. Open Questions for Discussion

These are areas I deliberately want your input before deploying:

1. **Priority override:** Should we prioritize hardware PRD support (since st8 does both software and hardware) or focus on software first and extend later?

2. **Multi-agent PRD generation:** MetaGPT's multi-agent approach is powerful but complex. Should st8 adopt it, or start with a simpler single-agent + template approach?

3. **Format scope:** Should the PRD system output markdown only, or should it support DOCX/PDF for stakeholder handoffs and JSON for programmatic consumption?

4. **LLM strategy:** Should st8 integrate Perplexity (like TaskMaster's research-enhanced mode) for research-enhanced PRD generation? Should it support multiple LLM providers (OpenAI, Anthropic, local)?

5. **Triage-first vs flat generation:** MetaGPT classifies input before generating. Should st8 do CONCEPT/EDIT/UPDATE classification, or is the lifecycle phase enough?

6. **The "Atomic DB" tension:** The current st8 implementation has a SQLite DB. The Atomic DB concept is elegant but not fully realized. Should we lean into "computed views" (PRD as query on file_registry) or keep explicit PRD documents?

7. **Wave acceleration:** Some Wave 2 external research agents can start NOW (in parallel with Wave 1). Should we start those immediately, or wait for full approval?

---

**End of Proposal. Ready for discussion/brainstorm!**
