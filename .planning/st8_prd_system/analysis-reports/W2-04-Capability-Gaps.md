# Cross-Lineage Analysis: Capability Gaps

**Date:** 2026-05-13
**Scope:** What capabilities exist in NO lineage that the st8 PRD system needs
**Sources:** All W1 research reports + W2-01, W2-02, W2-03 + FOUNDER-VISION.md + DESIGN-DECISIONS.md

---

## Methodology

For each capability needed by the st8 "Intimate PRD" vision, we score:
- **Coverage:** How many lineages address this? (0 = gap)
- **Maturity:** How well is it implemented? (None/Partial/Robust)
- **Priority:** How critical is this for st8's success?

---

## Gap 1: Voice-First Stakeholder Interview System

**What It Is:** A conversational interface where stakeholders speak naturally about their product aspirations, and the system captures structured data without forms.

**Coverage:** 0/6 lineages
**Maturity:** None
**Priority:** CRITICAL (Founder's #1 interaction preference)

**Why No Lineage Has It:**
- All existing systems are text-first: document editors, CLI tools, web forms
- MetaGPT uses chat but for multi-agent coordination, not stakeholder interviews
- No system treats conversation as the PRIMARY input modality

**What st8 Needs:**
1. **Local audio capture** with "done" button control
2. **Real-time transcription** with visual feedback
3. **Intent parsing** — convert speech to structured requirements
4. **Adaptive questioning** — based on previous answers and business ontology
5. **Persona-specific question frameworks** — engineers get constraint questions, CFOs get strategic questions

**Implementation Complexity:** Medium
**Dependencies:** Speech-to-text engine, conversation state manager, business ontology

---

## Gap 2: Cross-Department Inference Engine

**What It Is:** When one stakeholder mentions a concept (e.g., "packaging"), the system automatically identifies all other departments that need to address packaging and adds inferred topics to their interviews.

**Coverage:** 0/6 lineages
**Maturity:** None
**Priority:** CRITICAL (Core to Founder's alignment vision)

**Why No Lineage Has It:**
- All existing systems treat PRD generation as linear or single-user
- No system maintains a "business ontology" of cross-department relationships
- Multi-agent systems (MetaGPT) coordinate agents, not departments

**What st8 Needs:**
1. **Business Ontology Table** — concepts + department tags + related concepts + trigger keywords
2. **Entity Extraction** — parse conversations for business-relevant entities
3. **Inference Engine** — match entities to departments, generate inferred topics
4. **Topic Store** — per-stakeholder pending topics from other conversations
5. **Adaptive Interview Scripting** — prepend inferred topics: "Based on [Engineer]'s input on packaging..."

**Implementation Complexity:** Medium-High
**Dependencies:** Business ontology design, NLP entity extraction, conversation store

---

## Gap 3: PRD Package Generation (Multi-Document)

**What It Is:** Generating not one PRD document but a PACKAGE of documents: press release, GTM plan, sales strategy, financial projections, partnership announcements, etc.

**Coverage:** 0/6 lineages
**Maturity:** None
**Priority:** CRITICAL (The "make it real before kickoff" vision)

**Why No Lineage Has It:**
- All existing systems generate technical PRDs only
- No system generates commercial, marketing, or financial documents
- The "working backwards" press release (Amazon) is a design technique, not an automated output

**What st8 Needs:**
1. **Hub-and-Spoke Model** — Press Release + Internal FAQ as central hub
2. **Document Templates** — per document type (press release, GTM, sales brief, etc.)
3. **Dependency Graph** — which documents depend on which hub data
4. **Multi-Format Output** — interactive web (primary), DOCX/PDF (fallback)
5. **Reality Fabrication** — specific prices, dates, customer names, competitors (not placeholders)

**Implementation Complexity:** Medium
**Dependencies:** Template system, document generation engine, format converters

---

## Gap 4: Objection Mediation Workflow

**What It Is:** A structured workflow for handling stakeholder disagreements: identify conflicts → escalate to Product Owner → propose alternatives → cycle until resolution or Final Say decision.

**Coverage:** 0/6 lineages
**Maturity:** None
**Priority:** HIGH (Essential for alignment)

**Why No Lineage Has It:**
- Orchestr8 has change requests but no objection mediation
- MetaGPT triages requirements but doesn't handle human disagreements
- No system has a "conversation → objection → resolution" loop

**What st8 Needs:**
1. **Conflict Detection** — identify contradictions across stakeholder inputs
2. **Escalation Path** — Product Owner → Final Say (configurable)
3. **Alternative Generation** — Product Owner proposes multiple solutions
4. **Further Questions** — structured follow-up to relevant stakeholders
5. **Resolution Tracking** — log compromises, counter-suggestions, decisions

**Implementation Complexity:** Medium
**Dependencies:** Stakeholder store, conversation comparison, decision logging

---

## Gap 5: Interactive Web-Based PRD Experience

**What It Is:** A rich, locally-served interactive "website" for the PRD — not static documents. HTML+CSS+vanilla.js + SQLite + Python backend.

**Coverage:** 0/6 lineages
**Maturity:** None (all existing systems generate static documents)
**Priority:** HIGH (Founder's vision: "interactive website")

**Why No Lineage Has It:**
- Orchestr8 uses Vue desktop app (Tauri)
- TaskMaster is CLI-only
- MetaGPT is backend Python
- No lineage has an interactive web-based PRD viewer

**What st8 Needs:**
1. **Local Web Server** — serves interactive PRD from SQLite
2. **Rich Visualizations** — dependency graphs, timeline views, stakeholder maps
3. **Progressive Disclosure** — show summaries first, drill into details
4. **Real-Time Updates** — reflect code changes as they happen
5. **Multi-Modal** — text, diagrams, embedded media

**Implementation Complexity:** Medium-High
**Dependencies:** Web server, frontend framework, visualization library

---

## Gap 6: Hardware-Software Unified PRD

**What It Is:** A single PRD system that handles firmware, backend, frontend, AND hardware (consumer products, industrial equipment) with appropriate sections for each domain.

**Coverage:** 1/6 lineages (partial — stereOS had hardware PRD concept but no implementation)
**Maturity:** Partial (knowledge exists in hardware PRDs but not integrated)
**Priority:** HIGH (st8's core differentiator)

**Why No Lineage Has It:**
- All existing PRD systems are software-only
- Hardware PRDs exist as separate documents (DOCX/ODT) with no system integration
- No system bridges firmware → backend → frontend → hardware → manufacturing

**What st8 Needs:**
1. **Domain-Aware Templates** — software PRD vs hardware PRD vs integrated PRD
2. **Hardware-Specific Sections** — BOM, materials, tolerances, certifications, manufacturing
3. **Cross-Domain Constraints** — how hardware choices impact firmware (e.g., MCU selection → memory → firmware architecture)
4. **Supply Chain Integration** — AVL, cost tracking, volume tiers
5. **Certification Workstreams** — FCC, CE, UL with timelines and costs

**Implementation Complexity:** High
**Dependencies:** Hardware template library, BOM data model, certification tracker

---

## Gap 7: The "Fun" Factor / Personality

**What It Is:** Making the PRD system enjoyable, warm, and engaging — not sterile. Delightful interactions, beautiful output, celebratory progress.

**Coverage:** 0/6 lineages
**Maturity:** None (all existing systems are utilitarian)
**Priority:** HIGH (Founder explicitly requested this)

**Why No Lineage Has It:**
- Software tools prioritize functionality over delight
- No PRD system has invested in personality or warmth
- The stereOS "Void" aesthetic (emergence, physics, gold) had the concept but not the PRD integration

**What st8 Needs:**
1. **Persona for the System** — warm, curious, genuinely interested in user's work
2. **Progressive Disclosure UX** — watch the PRD structure form in real-time as you speak
3. **Gamification** — completion badges, insight unlocks, "aha moment" celebrations
4. **Beautiful Visualizations** — not dry text; engaging charts, graphs, timelines
5. **Celebratory Milestones** — "Your PRD package is ready!" with flair

**Implementation Complexity:** Medium
**Dependencies:** UX design, animation system, feedback loops

---

## Gap 8: Non-Forcing, Exploratory Interaction Model

**What It Is:** Users explore and interact with the PRD at their leisure. No forced timelines, no mandatory fields, no pressure.

**Coverage:** 0/6 lineages
**Maturity:** None (all existing systems are task-driven)
**Priority:** MEDIUM-HIGH

**Why No Lineage Has It:**
- All systems are "do this task, then this task, then this task"
- No system supports "browse the product at your leisure"
- The concept of "non-forcing" is antithetical to most tool design

**What st8 Needs:**
1. **Exploratory Navigation** — users can jump between any part of the PRD package
2. **Bookmark/Resume** — pick up where you left off
3. **Optional Deep Dives** — "Want to explore the BOM? Click here." (not mandatory)
4. **Casual Consumption** — PRD as a "website you browse" not "document you review"

**Implementation Complexity:** Low-Medium
**Dependencies:** Navigation design, state persistence

---

## Gap 9: Real-Time Code-to-PRD Sync

**What It Is:** When code changes, the PRD updates automatically. Not periodic regeneration — real-time sync via file watchers.

**Coverage:** 1/6 lineages (partial — st8 has file watcher but PRD doesn't auto-update)
**Maturity:** Partial
**Priority:** MEDIUM

**Why Only Partial Coverage:**
- st8 has file watcher and mutation log
- But PRD generator is manual (run script or hit endpoint)
- No automatic PRD refresh when code changes

**What st8 Needs:**
1. **Auto-Regenerate PRD** on file change (triggered by mutation log)
2. **Smart Diff Display** — show "what changed since last view" to stakeholders
3. **Change Notifications** — notify relevant stakeholders when their area changes

**Implementation Complexity:** Low (st8 already has watcher)
**Dependencies:** SSE/WebSocket for push notifications

---

## Gap 10: Business Ontology as Foundation

**What It Is:** A structured understanding of the business domain that informs every conversation, inference, and document generation.

**Coverage:** 0/6 lineages
**Maturity:** None
**Priority:** MEDIUM-HIGH (Enables Gap 2 and much of the PRD package)

**Why No Lineage Has It:**
- All existing systems are code-centric, not business-centric
- No system has a "business model" layer
- The closest is MetaGPT's ProductManager role, which is generic

**What st8 Needs:**
1. **Company Profile** — business type, markets, channels, margins, competitors
2. **Product Catalog** — existing products, lines, categories
3. **Department Ontology** — roles, responsibilities, key concerns per department
4. **Market Ontology** — buying groups, channels, regions, pricing tiers
5. **Technology Ontology** — chipsets, platforms, protocols, certifications

**Implementation Complexity:** Medium
**Dependencies:** Data model design, initial setup wizard

---

## Summary: The Gap Landscape

| Gap | Coverage | Priority | Complexity | st8 Innovation Opportunity |
|-----|----------|----------|------------|---------------------------|
| Voice-First Interviews | 0/6 | CRITICAL | Medium | ✅ Unique to st8 |
| Cross-Department Inference | 0/6 | CRITICAL | Medium-High | ✅ Unique to st8 |
| PRD Package Generation | 0/6 | CRITICAL | Medium | ✅ Unique to st8 |
| Objection Mediation | 0/6 | HIGH | Medium | ✅ Unique to st8 |
| Interactive Web PRD | 0/6 | HIGH | Medium-High | ✅ Unique to st8 |
| Hardware-Software Unified | 1/6 partial | HIGH | High | ✅ Unique to st8 |
| The "Fun" Factor | 0/6 | HIGH | Medium | ✅ Unique to st8 |
| Non-Forcing Interaction | 0/6 | MEDIUM-HIGH | Low-Medium | ✅ Unique to st8 |
| Real-Time Code Sync | 1/6 partial | MEDIUM | Low | Extends existing |
| Business Ontology | 0/6 | MEDIUM-HIGH | Medium | ✅ Unique to st8 |

**Key Finding:** st8's PRD system has **10 significant gaps**, 8 of which are **completely unaddressed by any existing lineage**. These represent st8's core innovation opportunities — capabilities that, if built well, make st8 unlike any other PRD system in existence.

**The Most Critical Gaps (Phase 1):**
1. Voice-first stakeholder interviews
2. Cross-department inference engine
3. PRD package generation (press release, GTM, etc.)

**The Next Tier (Phase 2):**
4. Objection mediation workflow
5. Interactive web-based PRD experience
6. Hardware-software unified PRD

**The Polish Tier (Phase 3):**
7. The "fun" factor
8. Non-forcing interaction
9. Real-time code sync
10. Deep business ontology

---

## Research Sources
- W2-01: Shared patterns across lineages
- W2-02: Evolution trail
- W2-03: Unique innovations per lineage
- FOUNDER-VISION.md: "Intimate PRD" philosophy
- DESIGN-DECISIONS.md: Voice, inference, objections, interaction model
