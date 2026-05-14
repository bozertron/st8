# D10: Implementation Phases

**Date:** 2026-05-13
**Status:** SPECIFICATION
**Purpose:** Ordered, dependency-resolved implementation plan for the st8 PRD system

---

## Philosophy: Incremental Delivery, Continuous Value

The PRD system is built in **phases that each deliver usable value**. The Product Owner can start using the system after Phase 2 (stakeholder interviews). The team gets PRD packages after Phase 4. Full automation arrives in Phase 6.

**Each phase:**
- Has a clear deliverable
- Can be used standalone
- Builds on previous phases
- Is measured by "can the Product Owner do X now?"

---

## Phase 0: Foundation (Prerequisites)

**Duration:** 1-2 days
**Goal:** Ensure st8 core is stable and ready for PRD system integration
**Depends on:** Existing st8 identity system

### Tasks:
1. **Fix Critical Bugs** (from IDENTITY-SYSTEM-GAP-ANALYSIS.md)
   - [ ] Fix recursive .txt emission loop (C1)
   - [ ] Fix empty AST on file edit (C2)
   - [ ] Add `.st8/` to `.gitignore` (C3)
   - [ ] Sync indexer.js schema with persistence.js (M2)
   - [ ] Implement connections query in schema card emitter (H4)
   - [ ] Add `.txt` file cleanup/rotation (H5)

2. **Verify Schema Card Stability**
   - [ ] Confirm schema cards contain accurate AST data
   - [ ] Confirm schema cards persist across file edits
   - [ ] Confirm `.st8/schema-cards/*.json` is complete

3. **Add Product Settings Category**
   - [ ] Add `product` category to `SETTINGS_CATEGORIES`
   - [ ] Add `product` defaults to `DEFAULT_SETTINGS`
   - [ ] Verify `/api/settings` persists product config

---

## Phase 1: Stakeholder Discovery (Week 1)

**Duration:** 3-5 days
**Goal:** Product Owner can identify stakeholders and capture basic info
**Deliverable:** Interactive stakeholder registry
**User Story:** *"As a Product Owner, I want to add team members to the project so the system knows who to interview."*

### Tasks:
1. **Stakeholder Data Model**
   - [ ] Add `stakeholders` table to SQLite schema
   - [ ] Add `stakeholder_roles` reference data (predefined personas)
   - [ ] Add `project_stakeholders` junction table

2. **Stakeholder CRUD API**
   - [ ] `POST /api/stakeholders` — add stakeholder
   - [ ] `GET /api/stakeholders` — list stakeholders
   - [ ] `PUT /api/stakeholders/:id` — update stakeholder
   - [ ] `DELETE /api/stakeholders/:id` — remove stakeholder
   - [ ] `POST /api/stakeholders/:id/roles` — assign roles

3. **Stakeholder Settings Integration**
   - [ ] Add `stakeholders` category to `SETTINGS_CATEGORIES`
   - [ ] Add `stakeholders` array to `DEFAULT_SETTINGS`
   - [ ] Render stakeholder list in settings UI with ADD/EDIT/DUPLICATE

4. **Basic Stakeholder UI**
   - [ ] Stakeholder list view in web app
   - [ ] "Add New Stakeholder" form (name, email, role, department)
   - [ ] Stakeholder detail view

5. **Project Setup Wizard**
   - [ ] "New Project" flow: Product Owner enters project name, product type, target market
   - [ ] Auto-detects product type from file extensions if codebase exists
   - [ ] Suggests stakeholder roles based on product type

---

## Phase 2: Conversational Input (Weeks 2-3)

**Duration:** 5-8 days
**Goal:** Product Owner and stakeholders can have text/voice conversations with the system
**Deliverable:** Functional interview interface
**User Story:** *"As a stakeholder, I want to talk to the system about my product aspirations and see them captured."*

### Tasks:
1. **Conversation Data Model**
   - [ ] Add `interview_sessions` table
   - [ ] Add `conversation_turns` table (Q&A pairs)
   - [ ] Add `conversation_entities` table (extracted data)

2. **Text Input Pipeline**
   - [ ] `POST /api/conversation/text` — accept text input
   - [ ] Display conversation in chat UI (st8.html chat area)
   - [ ] Store conversation turns in SQLite
   - [ ] Show conversation history per stakeholder

3. **Voice Input MVP**
   - [ ] Web Speech API integration in browser
   - [ ] "Record" / "Done" button UI
   - [ ] Real-time transcription display
   - [ ] `POST /api/conversation/voice` — accept audio, return transcript
   - [ ] Discard audio after transcription (transient)

4. **File Upload Support**
   - [ ] `POST /api/upload` — multipart file upload
   - [ ] Store in `.st8/uploads/`
   - [ ] Extract text from PDFs, Word docs
   - [ ] Display uploaded files in conversation context

5. **LLM Integration Layer**
   - [ ] Add LLM provider config to `models` settings category
   - [ ] `POST /api/llm/chat` — proxy to configured LLM
   - [ ] System prompt per stakeholder persona
   - [ ] Conversation context management (last N turns)

6. **Interview Script Engine**
   - [ ] Predefined question sets per persona
   - [ ] Adaptive follow-up based on previous answers
   - [ ] Leading questions that leave breadcrumbs

---

## Phase 3: Cross-Department Inference (Weeks 4-5)

**Duration:** 5-7 days
**Goal:** System identifies hidden opportunities across department inputs
**Deliverable:** Opportunity map and inferred topics
**User Story:** *"As a Product Owner, I want to see how different team members' ideas connect into product opportunities."*

### Tasks:
1. **Business Ontology Data Model**
   - [ ] Add `business_concepts` table
   - [ ] Add `concept_relationships` table
   - [ ] Seed with default concepts (packaging, pricing, certifications, etc.)

2. **Entity Extraction**
   - [ ] Extract entities from conversation transcripts
   - [ ] Match entities against business ontology
   - [ ] Store extracted entities per conversation

3. **Inference Engine**
   - [ ] After each conversation, identify cross-department implications
   - [ ] Generate inferred topics for other stakeholders
   - [ ] Store in `inferred_topics` table

4. **Adaptive Interview Scripting**
   - [ ] When starting stakeholder N's interview, prepend inferred topics
   - [ ] "Based on what [Engineer] shared about [topic], we'd love your take..."
   - [ ] Show Product Owner the inferred topics before sending

5. **Opportunity Map UI**
   - [ ] Visual graph of stakeholder inputs and connections
   - [ ] Highlight hidden alignments (e.g., "EE's acoustic rendering + PM's auto-pairing + Sales' price gap = $1299 headphones")
   - [ ] Product Owner can approve/promote opportunities

---

## Phase 4: PRD Package Generation (Weeks 6-8)

**Duration:** 10-14 days
**Goal:** System generates the complete PRD package from stakeholder conversations
**Deliverable:** Automated PRD package (press release, GTM, tech specs, etc.)
**User Story:** *"As a Product Owner, I want the system to turn all our conversations into a compelling product package that makes the product feel real."*

### Tasks:
1. **Template System**
   - [ ] Implement template engine (variable substitution, section generation)
   - [ ] Create base `st8-Core` template
   - [ ] Create 20 document templates (D3 spec)
   - [ ] Template inheritance (base + extensions)

2. **Composition Engine Core**
   - [ ] Query schema cards by lifecycle phase / domain
   - [ ] Cluster schema cards into epics/features
   - [ ] Generate user stories from intent + exports + connections
   - [ ] Apply Void/Gold/Physics quality gates

3. **Press Release Generation (Hub)**
   - [ ] Generate press release from stakeholder inputs
   - [ ] Extract specific prices, dates, features from conversations
   - [ ] Enforce specificity (no placeholders)

4. **Spoke Document Generation**
   - [ ] Internal FAQ (from press release)
   - [ ] GTM plan (from press release + business ontology)
   - [ ] Product positioning (from competitive analysis in conversations)
   - [ ] Messaging framework
   - [ ] External FAQ

5. **Technical PRD Generation**
   - [ ] Architecture overview from schema cards
   - [ ] Component PRDs per module
   - [ ] API specifications (from code analysis)
   - [ ] Test strategy

6. **Hardware PRD Generation** (if product.has_hardware)
   - [ ] Product specification
   - [ ] BOM table (from uploaded BOM files)
   - [ ] Certification tracker
   - [ ] Manufacturing process overview

7. **PRD Package Assembly**
   - [ ] Hub-and-spoke assembly
   - [ ] Cross-document consistency checks
   - [ ] PRD Package Health dashboard

8. **Output Formatting**
   - [ ] Interactive web view (primary)
   - [ ] Markdown export
   - [ ] DOCX/PDF generation (fallback)
   - [ ] JSON export (for programmatic use)

---

## Phase 5: Objection & Alignment (Weeks 9-10)

**Duration:** 5-7 days
**Goal:** Stakeholders can review, object, and resolve conflicts
**Deliverable:** Objection mediation workflow
**User Story:** *"As a stakeholder, I want to raise concerns about the PRD and see them resolved through constructive dialogue."*

### Tasks:
1. **Objection Data Model**
   - [ ] Add `objections` table
   - [ ] Add `objection_alternatives` table
   - [ ] Add `objection_resolutions` table

2. **Objection UI**
   - [ ] Stakeholder review view of PRD package
   - [ ] "Raise Objection" button per section
   - [ ] Objection form (topic, description, priority)

3. **Product Owner Mediation**
   - [ ] PO receives objection notification
   - [ ] PO generates alternatives (free-form + AI-assisted)
   - [ ] "Further Questions for Refinement" sent to stakeholders

4. **Resolution Tracking**
   - [ ] Stakeholders submit counter-suggestions
   - [ ] Compromise detection (automated + manual)
   - [ ] Final Say escalation path
   - [ ] Resolution logging

5. **Version Locking**
   - [ ] "Lock PRD" button (after all objections resolved)
   - [ ] Create `PrdVersion` record
   - [ ] Mark as `is_current_live`
   - [ ] Generate version diff from previous

---

## Phase 6: Execution Bridge (Weeks 11-12)

**Duration:** 5-7 days
**Goal:** Locked PRD becomes executable tasks
**Deliverable:** PRD → tasks bridge
**User Story:** *"As a project manager, I want the locked PRD to become a work plan with tasks and dependencies."*

### Tasks:
1. **Task Generation**
   - [ ] Parse locked PRD into tasks
   - [ ] Extract dependencies between tasks
   - [ ] Estimate complexity (from schema card metrics + LLM)
   - [ ] Assign tasks to stakeholders/roles

2. **Workback Schedule**
   - [ ] Generate timeline from target launch date
   - [ ] Map tasks to phases (CONCEPT → LOCKED → WIRING → DEVELOPMENT → PRODUCTION)
   - [ ] Identify critical path

3. **Integration with TaskMaster (Optional)**
   - [ ] Export tasks to TaskMaster format
   - [ ] Or: implement native task tracking in st8

4. **Living PRD Sync**
   - [ ] Auto-detect code changes via file watcher
   - [ ] Flag drift between locked PRD and current code
   - [ ] Generate "PRD Update Proposal" when drift detected

---

## Phase 7: Polish & Scale (Week 13+)

**Duration:** Ongoing
**Goal:** The "fun" factor, advanced features, and scale
**Deliverable:** Delightful experience

### Tasks:
1. **The "Fun" Factor**
   - [ ] Celebratory milestones ("Your PRD package is ready!" animation)
   - [ ] Progress visualization (watch PRD structure form in real-time)
   - [ ] Insight unlocks ("We found 3 cross-department opportunities!")
   - [ ] Beautiful visualizations (dependency graphs, timeline views)

2. **Advanced Features**
   - [ ] Research-enhanced mode (Perplexity integration)
   - [ ] Multi-model support (compare outputs from different LLMs)
   - [ ] Template marketplace (save/share templates)
   - [ ] PRD package analytics (which sections get most objections?)

3. **Scale & Performance**
   - [ ] Handle 10,000+ file projects
   - [ ] Pagination for large PRD packages
   - [ ] Summary views for executives
   - [ ] Per-module PRDs for large systems

4. **Hardware Deep Integration**
   - [ ] CAD file visualization
   - [ ] BOM cost tracking against targets
   - [ ] Certification timeline alerts
   - [ ] Supplier communication templates

---

## Dependency Graph

```
Phase 0: Foundation
    │
    ▼
Phase 1: Stakeholder Discovery
    │
    ▼
Phase 2: Conversational Input ──┐
    │                           │
    ▼                           ▼
Phase 3: Cross-Department Inference
    │
    ▼
Phase 4: PRD Package Generation
    │
    ▼
Phase 5: Objection & Alignment
    │
    ▼
Phase 6: Execution Bridge
    │
    ▼
Phase 7: Polish & Scale
```

**Critical Path:** 0 → 1 → 2 → 3 → 4 → 5 (13-15 weeks to full PRD package with alignment)

**Parallel Tracks:**
- Hardware PRD templates can be built in parallel with Phase 2-3
- Execution bridge (Phase 6) can be designed during Phase 4-5
- Polish (Phase 7) is continuous

---

## Success Metrics Per Phase

| Phase | Deliverable | Success Metric |
|-------|-------------|----------------|
| 0 | Stable schema cards | 100% of files have accurate schema cards |
| 1 | Stakeholder registry | Product Owner adds 5+ stakeholders in < 5 min |
| 2 | Conversational input | Stakeholder completes interview in < 30 min |
| 3 | Opportunity map | System finds 3+ hidden alignments |
| 4 | PRD package | Press release + 5 spoke documents generated |
| 5 | Objection workflow | 90% of objections resolved without escalation |
| 6 | Execution bridge | PRD → 20+ tasks with dependencies in < 5 min |
| 7 | Delight | Users share PRD package externally because it looks amazing |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| LLM costs grow too high | Use heuristic shortcuts for triage; cache common prompts; offer local model option |
| Stakeholders don't engage | Non-forcing design; let them browse at leisure; Product Owner drives |
| PRD quality is poor | Void/Gold/Physics gates; PO review step; objection cycle |
| Hardware files don't parse | Extend schema card emitter for CAD formats; manual upload fallback |
| Integration complexity | Settings-driven config; modular templates; feature flags |

---

## Immediate Next Steps (This Week)

1. **Fix st8 critical bugs** (Phase 0)
2. **Add `product` and `stakeholders` settings categories** (Phase 0-1)
3. **Design stakeholder interview question sets** (Phase 2 prep)
4. **Create press release template** (Phase 4 prep)
5. **Set up LLM provider config in `models` settings** (Phase 2 prep)

---

**Research Sources:**
- W2-04: Capability gaps (identified 10 gaps, prioritized)
- FOUNDER-VISION.md: Phase-by-phase stakeholder loop
- DESIGN-DECISIONS.md: Settings-driven architecture
- IDENTITY-SYSTEM-GAP-ANALYSIS.md: Phase 0 prerequisites
