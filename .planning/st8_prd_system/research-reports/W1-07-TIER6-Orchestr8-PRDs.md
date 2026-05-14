# Research Report: Orchestr8_jr PRD Document Ecosystem Analysis

**Research Date:** 2026-05-13
**Analyst:** st8 Research Agent
**Source Project:** Orchestr8_jr
**Files Analyzed:** 13 PRD documents (ranging from 47 to 765 lines)

---

## 1. PRD Section Structure

Across the Orchestr8_jr ecosystem, PRDs follow a generally consistent section ordering, though formatting varies by document type and maturity level.

### Standard Section Order (Observed across full-system PRDs):

1. **Document Metadata Header** — Version, date, status, authors, philosophy, core stack
2. **Executive Summary / Project Overview** — Problem statement, solution summary, key principle
3. **System Architecture / Directory Structure** — Hierarchy diagrams, component responsibilities
4. **Subsystem Specifications** — Deep dives into individual modules (UI, tools, integrations)
5. **Implementation Phases** — Ordered development phases with tasks, priorities, and deliverables
6. **Acceptance Criteria** — Numbered checklist of completion conditions
7. **Technical Constraints** — Runtime requirements, dependencies
8. **File Manifest** — Files to create, modify, retire
9. **Appendix / Notes / Signatures** — Research questions, operational manuals, signoff blocks

### V4 Consolidated (765 lines, most comprehensive) uses a refined Roman numeral structure:
- I. Color System
- II. System Architecture
- III. The Void: Primary Interface
- IV. actu8: Terminal Integration
- V. Ticket System Integration
- VI. Fiefdom Management
- VII. The Wisdom System
- VIII. Tool Integration: Carl, Connie, Louis
- IX. ChangeChecker Integration
- X. Current Implementation Status
- XI. Implementation Phases
- XII. File Structure
- XIII. For the Generals: Operating Manual
- XIV. Open Research Questions Summary
- XV. Signatures

### V3 Fortress / Universal (423 and 293 lines) use a task-oriented phase structure:
- Phase 1: [Category Name]
  - Task X.Y: [Task Name] (with Priority, Dependencies, Required Changes, Test Strategy)
- Phase 2...
- Acceptance Criteria
- Technical Constraints
- File Manifest
- Notes for Taskmaster AI

### UI Design PRD (347 lines) uses a decimal subsection system:
- 1. Design Philosophy & Aesthetic Direction
- 2. Color System Implementation
- 3. Typography System
- 4. Component Design Specifications
- 5. Motion & Animation Specifications
- 6. Implementation Phases
- 7. Technical Implementation Notes
- 8. Acceptance Criteria
- 9. Future Enhancements

---

## 2. Section Depth and Granularity

| Document | Total Lines | Avg Section Depth | Detail Level |
|----------|-------------|-------------------|--------------|
| V4 Consolidated | 765 | 2-3 levels (Roman -> subsection -> sub-subsection) | Very High — includes ASCII diagrams, CSS blocks, code templates, CLAUDE.md template, CAMPAIGN_LOG template |
| V3 Fortress | 423 | 2 levels (Phase -> Task) | High — each task includes priority, dependencies, required changes (numbered), test strategy |
| UI Design PRD | 347 | 2 levels (Section -> Subsection) | High — includes CSS variable blocks, HTML implementation snippets, animation specs |
| V3 Universal | 293 | 2 levels (Phase -> Task) | High — similar to Fortress but narrower scope (Universal Bridge only) |
| V3 (prd_v3.txt) | 336 | 2 levels (Section -> Subsection) | Medium-High — more prose-oriented, less task granularity than Fortress |
| PRD v1 (prd.txt) | 150 | 2 levels (Phase -> numbered steps) | Medium — early MVP, conversational, includes emoji in UI spec |
| MVP Big Picture | 171 | 1-2 levels | Medium — program-level, includes checkboxes for founder signoff |
| MVP Sub-PRDs | 55-62 | 1 level (numbered sections) | Low — concise, scoping documents |

**Observation:** The depth correlates directly with the document's purpose. Full system PRDs (V4, V3 Fortress) are extremely granular because they are intended to be parsed by TaskMaster into executable tasks. Design PRDs are granular on visual specs. MVP PRDs are intentionally shallow to serve as governance scoping documents.

---

## 3. Cross-PRD Comparison: Subsystem vs. Workspace vs. Ops PRDs

### Core Subsystem PRD (e.g., V3 Fortress / V3 Universal)
- **Focus:** Implementation of a specific technical subsystem (Plugin Architecture, Universal Bridge)
- **Structure:** Phase-based with numbered tasks
- **Key Sections:** Task definitions with Priority/Dependencies/Test Strategy, File Manifest, Technical Constraints
- **Depth:** Very high on implementation details, code snippets, interface definitions
- **Audience:** TaskMaster AI / implementing engineer
- **Unique traits:** Each task has explicit "Test Strategy" subsection; "Notes for Taskmaster AI" appendix

### Workspace / UI Design PRD
- **Focus:** Visual system, component styling, interaction design
- **Structure:** Design system categories (Color, Typography, Components, Motion)
- **Key Sections:** CSS variable specifications, HTML implementation blocks, animation timing specs
- **Depth:** High on visual properties, medium on logic
- **Audience:** Frontend engineer / designer
- **Unique traits:** "Design Prohibitions" section; explicit glow/border/animation values; "Mission Control Noir" aesthetic language

### Ops / Governance PRD (MVP PRDs, Big Picture)
- **Focus:** Process governance, packet lifecycle, acceptance criteria
- **Structure:** Objective -> Problem -> In/Out of Scope -> Requirements -> Acceptance Criteria -> Evidence -> Risks
- **Key Sections:** Evidence Requirements, Risks and Mitigations, Founder Signoff
- **Depth:** Low on implementation, high on accountability
- **Audience:** Founder, program manager, canonical lane operator
- **Unique traits:** "Evidence Requirements" section is mandatory; "Canonical lane" terminology; checkbox-based founder signoff blocks

---

## 4. MVP PRD Format

The 5 MVP PRDs analyzed (`PRD_ORCHESTR8_JR_MVP.md`, `PRD_A_CODEX_PLAN_MVP.md`, `PRD_OR8_FOUNDER_CONSOLE_MVP.md`, `PRD_2NDFID_EXPLORERS_MVP.md`, `PRD_MINGOS_SETTLEMENT_LAB_MVP.md`) share an **almost identical template**:

```
## 1. Objective
## 2. Problem
## 3. In Scope
## 4. Out of Scope
## 5. Functional Requirements
## 6. Non-Functional Requirements
## 7. Integration/Data/Control Interfaces (varies by PRD)
## 8. Acceptance Criteria
## 9. Evidence Requirements
## 10. Risks and Mitigations
```

### How MVP PRDs Differ from Full System PRDs:

| Dimension | Full System PRDs (V4, V3 Fortress) | MVP PRDs |
|-----------|-----------------------------------|----------|
| **Length** | 300-765 lines | 55-62 lines |
| **Purpose** | Implementation blueprint | Governance scoping |
| **Code snippets** | Extensive | None |
| **Architecture detail** | Deep (diagrams, file structures) | Absent |
| **Phase breakdown** | Detailed phases with tasks | None |
| **Test strategy** | Per-task | At acceptance criteria level only |
| **Evidence requirements** | Absent | Dedicated section |
| **Founder signoff** | Absent | Present in Big Picture draft |
| **In/Out of Scope** | Rarely explicit | Explicit, dedicated sections |
| **Terminology** | Technical (fiefdoms, plugins, state managers) | Process-oriented (packets, lanes, canonical, replay) |

**Key insight:** MVP PRDs are not implementation documents. They are **contract documents** that define what a lane must deliver to be considered complete, what evidence is required, and what risks exist. They delegate implementation detail to the canonical lane or to TaskMaster-generated task sets.

---

## 5. TaskMaster Example PRD Templates

Two templates exist in `.taskmaster/templates/`:

### example_prd_rpg.txt (511 lines) — Repository Planning Graph Method

Uses **XML-like semantic tags** to structure the document:

```xml
<rpg-method>       # Methodology explanation
<overview>         # Problem, users, success metrics
<functional-decomposition>   # Capabilities and features (WHAT)
<structural-decomposition>   # File/folder structure (WHERE)
<dependency-graph>           # Topological dependencies (ORDER)
<implementation-roadmap>     # Phases with entry/exit criteria
<test-strategy>              # Test pyramid, coverage, scenarios
<architecture>               # Components, data models, stack
<risks>                      # Technical, dependency, scope risks
<appendix>                   # References, glossary, open questions
<task-master-integration>    # How TaskMaster parses this PRD
```

**Key features:**
- Separates WHAT (functional) from HOW (structural) from WHEN (dependency graph)
- Each tag contains `<instruction>` blocks with good/bad `<example>` blocks
- Features defined with: Description, Inputs, Outputs, Behavior
- Tasks defined with: checkbox `[ ]`, dependencies, acceptance criteria, test strategy
- Explicitly designed for `task-master parse-prd` to extract capabilities -> tasks, features -> subtasks, dependencies -> task.dependencies

### example_prd.txt (47 lines) — Minimal Template

Uses two top-level tags only:

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
</PRD>
```

This is a lightweight alternative for simpler projects. The instructions explicitly state: "Do not think about timelines whatsoever -- all that matters is scope and detailing exactly what needs to be build in each phase so it can later be cut up into tasks."

---

## 6. Document Metadata Headers

Metadata placement is **always at the top** of the document, before the first section header.

### Metadata patterns observed:

| Field | Frequency | Example Values |
|-------|-----------|----------------|
| **Version** | Universal | "4.0 Consolidated", "3.0.0", "1.0 (MVP)", "2.0 (Design Renaissance)" |
| **Date/Created** | Common | "2026-01-26", "2026-02-16" |
| **Status** | Common | "READY FOR TASKMASTER PARSING", "Draft for founder review" |
| **Authors/Owner** | Common | "Ben (Emperor) + Claude (Strategic Council)", "The Mayor (Codex)" |
| **Philosophy** | V3-era | "The Mainframe", "Polyglot" |
| **Core Stack** | V3-era | "Marimo (UI/State), Python (Glue), TypeScript (Analysis), SQLite (Data)" |
| **Architecture** | Early PRDs | "Reactive Python Notebook (Marimo)" |
| **Role** | Early PRDs | "The General Contractor" |
| **Codename** | Rare | "Polyglot" (V3 Universal) |
| **Design Direction** | UI PRD | "Neo-Brutalist Command Center with Cinematic Polish" |

**Observation:** Later PRDs (V4, MVP era) drop "Philosophy" and "Core Stack" from the header, moving them into the body. The V4 header is the most complete: Version, Created, Status, Authors.

---

## 7. Requirements Format

### Full System PRDs — Three styles observed:

**Style A: Task-oriented (V3 Fortress, V3 Universal)**
```
### Task X.Y: [Name]
**Priority:** high | medium | low
**Dependencies:** none | Task A.B, Task C.D

**Required Changes:**
1. [Specific change]
2. [Specific change]

**Test Strategy:** [How to verify]
```

**Style B: Prose specification (V4 Consolidated, V3 prd_v3.txt)**
- Requirements stated as bullet points or numbered lists within section narratives
- No strict priority tagging within the list
- Acceptance criteria often implicit in the description

**Style C: Component specification (UI Design PRD)**
- Each component has: Current state, Redesign description, Implementation snippet
- Visual states enumerated in tables (Default, Hover, Active, Disabled)
- Animation timing specified in milliseconds with easing functions

### MVP PRDs — Uniform numbered list:
```
## 5. Functional Requirements
1. [Requirement statement]
2. [Requirement statement]
```

No priority tags, no acceptance criteria nested within individual requirements. Acceptance is verified at section 8 (Acceptance Criteria) which maps back to the requirements.

### RPG Template — Structured feature definition:
```
#### Feature: [Name]
- **Description**: [One sentence]
- **Inputs**: [What it needs]
- **Outputs**: [What it produces]
- **Behavior**: [Key logic]
```

---

## 8. Unique IP: Formatting Patterns and Section Structures Unique to Orchestr8_jr

### A. Domain-Specific Terminology as Structural Elements
The ecosystem has invented a **coherent vocabulary** that appears across PRDs:
- **Roles:** Emperor, General, Scout, Fixer, Validator, Git Agent
- **Spaces:** The Void, Fiefdom, Overton Anchor
- **States:** Working (Gold), Broken (Blue), Combat (Purple)
- **Artifacts:** CAMPAIGN_LOG.md, BRIEFING.md, CLAUDE.md, BUILD_SPEC.json
- **Components:** Carl, Connie, Louis, actu8, Maestro
- **Process:** Packet, Lane, Canonical, Replay, Closeout, Settlement

This is not merely flavor text. These terms define **structural sections** (e.g., "VI. Fiefdom Management", "VII. The Wisdom System") and **artifact templates** embedded directly in PRDs.

### B. Embedded Artifact Templates
V4 Consolidated includes **complete templates** for files that must exist in the runtime:
- CLAUDE.md Template (Standing Orders) — lines 325-357
- CAMPAIGN_LOG.md Format — lines 386-414

These are not examples; they are **specifications of file contents** that generals must produce.

### C. Inline Research Questions
A unique pattern in V4: "RESEARCH QUESTIONS FOR TASKMASTER" blocks appear inline within sections (e.g., lines 212-221, 256-264). These are explicitly tagged questions (Q1-Q15) that require external research before implementation can proceed.

### D. ASCII Architecture Diagrams
Extensive use of box-drawing ASCII art for:
- System hierarchies (lines 76-113)
- UI layout specifications (lines 148-178)
- Ticket lifecycles (lines 267-275)
- Decision gates (lines 464-484)
- Wisdom accumulation flow (lines 371-381)

These diagrams are **normative**, not illustrative. They define exact layout proportions (e.g., "Bottom Fifth - The Overton Anchor (NEVER MOVES)").

### E. "Notes for Taskmaster AI" Appendix
V3 Fortress and V3 Universal include a dedicated section (lines 416-423 and 286-293) with execution guidance specifically for the AI parser:
- "Tasks should be executed in dependency order"
- "Preserve existing working code - no deletions without explicit backup"
- "Prioritize X and Y as parallel tracks"

This is meta-commentary directed at the parsing agent, not the human reader.

### F. Evidence Requirements Section (MVP PRDs)
Unique to the MVP governance layer: a dedicated section (section 9 in all MVP PRDs) specifying what proof must be produced:
- "Canonical artifact paths per packet"
- "Replayed commands and pass counts"
- "Shared memory observation IDs"
- "Test command output with pass counts"

This reflects a **replay-based acceptance culture** where claims must be backed by observable evidence.

### G. Founder Signoff Blocks
The MVP Big Picture PRD includes "Guardrail Assumptions" (A-01 through A-08) with checkbox-style founder comment slots:
```
- [ ] Agree
- [ ] Adjust: ___________
```

And a final "Founder Signoff Block" with:
- [ ] Approve draft as-is
- [ ] Approve with edits
- [ ] Rework required

This makes the PRD a **living negotiation document**, not a static spec.

### H. Color System as Authoritative Reference
V4 Section I is titled "Color System (Authoritative Reference: MaestroView.vue)". The PRD treats design tokens as **normative law** with "EXACT VALUES, NO EXCEPTIONS". This is unusual for a technical PRD but reflects the project's visual identity discipline.

### I. Three-State System Table
A recurring pattern across PRDs: the Working/Broken/Combat state table with exact hex values:
| State | Color | Hex | Meaning |
This is treated as a **contract** that all UI components must honor.

---

## 9. Synthesis: The Orchestr8_jr PRD Ecosystem as a System

The PRDs do not exist in isolation. They form a **layered specification system**:

1. **Big Picture / Program PRD** (MVP Big Picture) — Defines gates, assumptions, and non-goals
2. **Lane PRDs** (5 MVP PRDs) — Define per-lane scope, evidence, and acceptance
3. **System PRDs** (V4 Consolidated, V3 Fortress) — Define implementation architecture and tasks
4. **Design PRDs** (UI Design) — Define visual system and component behavior
5. **Templates** (RPG, Minimal) — Define how future PRDs should be structured

The progression from V1 (prd.txt, 150 lines, emoji-friendly) to V4 (765 lines, strict no-emoji policy, embedded templates, inline research questions) shows a **maturation of the specification culture** from prototype sketch to production-grade task input.

---

## 10. Implications for st8 PRD System Design

Based on this research, a st8 PRD system should consider:

1. **Dual-mode PRDs:** The Orchestr8 ecosystem clearly separates *implementation PRDs* (long, detailed, code-heavy) from *governance PRDs* (short, scoped, evidence-driven). st8 should support both modes.

2. **Task-oriented parsing:** The V3 Fortress/Universal format (Phase -> Task with Priority/Dependencies/Test Strategy) is explicitly designed for AI parsing. This should be the default format for implementation PRDs.

3. **Embedded templates:** V4's inclusion of CLAUDE.md and CAMPAIGN_LOG.md templates within the PRD is powerful. st8 PRDs could embed templates for runtime artifacts.

4. **Evidence requirements:** The MVP PRDs' emphasis on evidence and replay suggests st8 should have a dedicated "Evidence" or "Verification" section in governance PRDs.

5. **ASCII diagrams as first-class:** The extensive use of ASCII diagrams for layout and architecture suggests st8 should preserve and render these correctly.

6. **Metadata standardization:** A consistent header format (Version, Date, Status, Authors) should be enforced.

7. **XML-tag templates for complex projects:** The RPG template's `<functional-decomposition>` / `<structural-decomposition>` / `<dependency-graph>` separation is powerful for large projects. For smaller projects, the minimal `<context>` / `<PRD>` template suffices.

---

*End of Research Report*
