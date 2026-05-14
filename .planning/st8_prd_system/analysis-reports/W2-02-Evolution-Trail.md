# Cross-Lineage Analysis: Evolution Trail

**Date:** 2026-05-13
**Scope:** How PRD system concepts migrated from Orchestr8 OG → stereOS → actu8 → st8
**Sources:** W1-01 through W1-10 research reports

---

## 1. The Parser Pipeline

### Orchestr8 OG (Lineage 1)
- **10 parser types:** overview, stores, routes, commands, types, ui, files, generate-ui, generate-backend, feature-factory
- **14+ specialist .ts modules:** overview.ts, storeParser.ts, routeParser.ts, commandParser.ts, typeParser.ts, uiParser.ts, uiTemplateParser.ts, uiGenParser.ts, fileRetriever.ts, backendGenParser.ts, migrationAssistantParser.ts, featureFactory.ts, integr8handler.ts, saveScaffoldReport.ts
- **Bidirectional:** code → document AND document → code (uiGenParser.ts produces runnable scaffolds)
- **Dynamic plugin discovery** from Rust backend at runtime

### stereOS/actu8 (Lineage 5)
- Parser types still existed, CLI-driven scaffolding
- Same decomposition philosophy but less dynamic

### st8 (Lineage 6 — Current)
- **Schema card extraction** via `backend/schemaCardEmitter.js` and `astParser.js`
- **Graph builder** for connections
- **No per-domain parser pipeline** — single extraction → schema cards
- **What was lost:** Per-domain specialization, bidirectional generation, dynamic plugins
- **What was gained:** Deterministic, diffable, fingerprinted JSON per file; universal applicability to any code; integration with lifecycle system

**Evolution Insight:** The OG pipeline was **powerful but tightly coupled to a specific stack** (Tauri/Vue/Rust). st8's schema card system is **universal but less specialized**. The ideal system would combine st8's universal extraction with per-domain composition templates.

---

## 2. The PRD Data Model

### Orchestr8 OG (Lineage 1)
- **`PrdVersion`** with `_schema` and `fields` — a JSON blob with schema-driven dynamic forms
- **Version chaining** via `based_on_version_id` (self-referential)
- **SQLite tables:** `PRD_Versions`, `Change_Requests`, `Workflow_Definitions`, `Workflow_Steps`, `Workflow_Instances`
- **Dynamic forms:** `_schema` embedded in PRD data drives `PrdEditor.vue` rendering

### st8 (Lineage 6 — Current)
- **`file_registry` table:** fingerprint, filepath, sha256, status, lifecyclePhase
- **Schema cards:** deterministic JSON snapshots with AST + intent + mutations
- **`connections` table:** dependency graph
- **`file_mutation_log`:** append-only audit trail
- **`file_intent`:** human/AI-authored purpose and valueStatement
- **No `_schema` blob** — schema is structural in the DB

**Evolution Insight:** OG's `_schema` was **flexible but opaque** — a JSON blob interpreted by the frontend. st8's approach is **transparent and queryable** — every piece of PRD-relevant data lives in a typed table. The trade-off: st8 is less flexible for arbitrary PRD structures but more powerful for code-driven PRDs.

**Critical Gap:** st8 has the data layer but lacks the **composition/query layer** to turn schema cards into meaningful PRD documents.

---

## 3. The Generation Approach

### stereOS (PrdGenerator.vue, 446 lines)
- **AI-powered document generator** using GPT-4 or GPT-3.5 Turbo
- Form with: type, title, technicalScope, aiModel
- **Markdown preview** + HTML render + export to `.md`
- **Frontend-driven** — all generation logic in Vue

### Orchestr8 (PrdGenerator.vue, 731 lines)
- **CLI scaffolding orchestrator** — paradigm shift!
- Thin Vue wrapper over Rust CLI
- 10 parser types, feature factory, comparison mode
- **No AI in component** — pure code analysis + scaffolding

### st8 (Current)
- **`prdGenerator.js` (200 lines):** Loads schema cards, groups by `lifecyclePhase`, outputs markdown
- Lists: file path, fingerprint, status, purpose, exports, dependencies
- **NO composition engine** — just a file listing

**Evolution Insight:** The system went from **LLM hallucination** (stereOS) to **deterministic extraction** (Orchestr8) to **universal but shallow extraction** (st8). What's missing in st8 is the **composition intelligence** — the layer that turns file listings into meaningful product narratives, user stories, and workback schedules.

**The Missing Piece:** The composition engine must:
1. Cluster schema cards into **epics/features**
2. Derive **user stories** from intent + exports + connections
3. Generate **workback schedules** from lifecycle phases + dependencies
4. Create **PRD package documents** (press release, GTM plan, etc.)
5. Apply **Void/Gold/Physics quality gates**

---

## 4. The Change Workflow

### Orchestr8 OG (Lineage 1)
- **`propose_prd_update()`** → `diff_prd_data()` → `ChangeRequest`
- **Status lifecycle:** PendingAssessment → PendingFeedback → Approved/Rejected/Cancelled
- **Gated change control** like pull requests for requirements
- **Formal diff assessment** — only changed fields returned

### st8 (Current)
- **Mutation log exists** (`file_mutation_log`) but no proposal workflow
- **No `ChangeRequest`** — changes are auto-logged, not gated
- **No diff assessment** — diff exists (`SchemaCardEmitter.diff()`) but no approval gate

**Evolution Insight:** OG's change workflow was **formal and heavy** — suitable for large teams with approval processes. st8's mutation log is **automatic and lightweight** — suitable for development but insufficient for stakeholder alignment.

**What st8 Needs:** A **lightweight change proposal workflow** that:
1. Detects when schema cards change (mutation log already does this)
2. Allows stakeholders to **review and approve** changes (new feature)
3. Tracks **who approved what and when** (extends mutation log)
4. Supports **the objection cycle** (Product Owner mediation → Final Say)

---

## 5. The "Living PRD" Concept

### stereOS/actu8 (Lineage 5)
- **"Atomic DB"** — PRD as living database, not a static file
- Data over documents
- PRD derived from ground truth of code
- **Void/Gold/Physics** quality gates for acceptance criteria

### st8 (Current)
- **`file_registry` + schema cards + mutation log** = partial implementation
- PRD is still a **static markdown view** (`prdGenerator.js` writes to `.planning/st8_identity_system/PRD.md`)
- **Missing:** Dynamic query layer, composition engine, quality gates

**Evolution Insight:** The Atomic DB vision is **correct** but **incomplete** in st8. The data layer is there, but:
- No query engine to compose views
- No template system to format output
- No quality gates (Void/Gold/Physics)
- No stakeholder-specific views

**What "Living PRD" Means for st8:**
- PRD is **computed on-the-fly** from schema cards
- Different views for different stakeholders (engineer sees API specs, CMO sees messaging)
- Updates automatically when code changes
- Tracks evolution via mutation log
- Supports versioning (mutation log + lifecycle phases)

---

## 6. The Composition Engine

### Orchestr8 OG (Lineage 1)
- **Templates + LLM prompts per section**
- `DocumentTemplate` with `TemplateSection.prompts[]`
- Hybrid template + AI composition
- "Prompt orchestration at the document architecture level"
- Supports **multiple audiences** (developer, executive, customer) with different detail levels

### st8 (Current)
- **None.** `prdGenerator.js` does file-listing markdown only.
- No user stories
- No epic grouping
- No dependency narrative
- No acceptance criteria
- No risk assessment
- No temporal narrative

**Evolution Insight:** This is the **single biggest gap**. OG had a sophisticated composition engine. st8 has the data but no engine.

**The Composition Engine Must:**
1. **Query schema cards** by domain, lifecycle phase, status, impact radius
2. **Cluster into epics** using connections + intent + file groupings
3. **Generate user stories** using stereOS template (As a [persona] I want [action] so that [benefit])
4. **Apply quality gates** (Void/Gold/Physics) to each story
5. **Create workback schedule** from lifecycle phases + dependencies
6. **Generate PRD package documents** using templates (press release, GTM, etc.)
7. **Support multiple outputs** (markdown, JSON, interactive web, DOCX)

---

## 7. The LLM Integration

### Orchestr8 OG (Lineage 1)
- **`LlmEntityConfig`** — per-entity provider, API key, model ID, system prompt
- Cloud vs Mock entity types
- Per-project configuration
- Per-section prompt orchestration

### TaskMaster (Lineage 2)
- Research-enhanced mode via Perplexity
- Current best practices injection
- Optional research flag

### MetaGPT (Lineage 4)
- Multi-agent prompt orchestration
- ActionNode structured output
- Self-critique and self-revision loops

### st8 (Current)
- **No LLM integration for PRD generation**
- Existing LLM infrastructure (`st8.html` has LLM config) but not wired to PRD

**Evolution Insight:** OG's LLM configuration was **granular and powerful** but **complex**. For st8, the simpler approach is:
- Single LLM configuration (already exists)
- **System prompt per conversation type** (stakeholder interview, composition, objection handling)
- **Template-driven generation** with LLM enhancement for narrative quality
- **Research mode** as optional enhancement (Phase 2)

---

## 8. The PRD → Execution Bridge

### TaskMaster (Lineage 2)
- **`parse-prd`** — analyzes PRD, generates 10-15 tasks with dependencies
- Complexity estimation
- Sprint planning recommendations
- Dependency graph output

### MetaGPT (Lineage 4)
- ProductManager triages requirements to Engineer roles
- Workflow steps with completion criteria

### st8 (Current)
- **No execution bridge**
- Schema cards exist but don't feed into task generation
- Mutation log tracks changes but doesn't create tasks

**Evolution Insight:** The PRD → execution bridge is **essential** but not urgent for MVP. Priority order:
1. **Conversation capture** (stakeholder interviews)
2. **Composition engine** (PRD package generation)
3. **Objection cycle** (alignment)
4. **Execution bridge** (task generation from locked PRD)

---

## 9. Key Lost Capabilities (What We Must Rebuild)

| Capability | OG Source | Status in st8 | Priority |
|-----------|-----------|---------------|----------|
| Per-domain parser specialization | `typeParser.ts`, `routeParser.ts`, etc. | ❌ Missing (replaced by generic AST) | Medium |
| Bidirectional code generation | `uiGenParser.ts`, `featureFactory.ts` | ❌ Missing | Medium |
| Change proposal workflow | `ChangeRequest` with status lifecycle | ❌ Missing (mutation log only) | High |
| Template-driven composition | `DocumentTemplate.prompts[]` | ❌ Missing | **Critical** |
| LLM prompt per section | `LlmEntityConfig.system_prompt` | ❌ Missing | High |
| PRD → tasks bridge | `parse-prd` CLI | ❌ Missing | Medium |
| Multi-audience output | DetailLevel enum | ❌ Missing | Medium |
| Quality gates (Void/Gold/Physics) | User story framework | ❌ Missing | High |
| Schema-driven form rendering | `_schema` in PrdVersion | ❌ Not needed (schema cards replace) | — |
| Automatic diff generation | `diff_prd_data()` | ✅ Partial (`SchemaCardEmitter.diff()`) | — |
| Version chaining | `based_on_version_id` | ✅ Partial (mutation log) | — |
| Living database concept | "Atomic DB" | ✅ Partial (file_registry + mutation log) | — |

---

## 10. What the Evolution Tells Us

### The Optimal Architecture for st8

The lineage evolution reveals a clear trajectory:

1. **OG was powerful but monolithic** — tied to Tauri/Vue/Rust, hard to generalize
2. **st8 is universal but shallow** — works with any codebase but produces shallow output
3. **The gap is the composition engine** — st8 has the data, OG had the engine

**The right design:**
- **Keep st8's universal extraction** (schema cards, mutation log, connections)
- **Rebuild OG's composition intelligence** (templates, clustering, narrative generation)
- **Add the "intimate PRD" layer** (voice conversations, cross-department inference, objection cycles)
- **Preserve the Atomic DB vision** (PRD as computed view, not static document)

### The "Intimate PRD" Adds New Requirements

No prior lineage had:
- **Voice-first stakeholder interviews**
- **Cross-department inference engine**
- **Objection mediation workflow**
- **Interactive web-based PRD experience**
- **PRD package generation** (press release, GTM, etc.)
- **The "fun" mandate**

These are st8's unique innovations and must be designed from scratch.

---

## Research Sources
- W1-01: prdPlanning.md ( canonical design)
- W1-02: PrdGenerator.vue evolution (OG 446 → Orchestr8 731 lines)
- W1-03: Rust backend commands (change workflow)
- W1-04: SCOUT outputs (parser pipeline)
- W1-05: Integration notes (evolution evidence)
- W1-10: Atomic DB + st8 current state
- W2-01: Shared patterns analysis
- W2-03: Unique innovations analysis
