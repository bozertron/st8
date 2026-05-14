# PRD-SYSTEM-CONCEPT.md
# The st8 Product Requirements Document System

**Version:** 1.0
**Date:** 2026-05-13
**Author:** st8 Research Team
**Status:** SPECIFICATION — Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Problem This Solves](#2-what-problem-this-solves)
3. [Core Concepts](#3-core-concepts)
4. [System Architecture](#4-system-architecture)
5. [The User Experience](#5-the-user-experience)
6. [Data Model](#6-data-model)
7. [API Surface](#7-api-surface)
8. [Templates & Documents](#8-templates--documents)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Success Metrics](#10-success-metrics)
11. [Appendix: Design Decisions](#11-appendix-design-decisions)

---

## 1. Executive Summary

The st8 PRD System is a **conversational product requirements platform** that turns stakeholder aspirations into a compelling, multi-document PRD package — making products feel real before they exist.

**Key Differentiators:**
- **Voice-first conversations** with stakeholders (not forms)
- **Cross-department inference engine** that finds hidden opportunities
- **PRD Package generation** (press release, GTM plan, sales strategy, tech specs, and more)
- **Objection mediation workflow** with Product Owner + Final Say escalation
- **Hardware-software unified** — handles firmware to frontend + consumer products to industrial equipment
- **Living, not static** — PRD evolves with code changes and stakeholder input
- **Intimate, not sterile** — warm, enjoyable experience for passionate product teams

**Target Users:**
- Product Owners (primary orchestrators)
- C-suite executives (strategic input)
- Engineering leads (technical constraints)
- Sales/Marketing (market and channel input)
- Hardware teams (mechanical, electrical, manufacturing)

**Output:** A PRD Package that makes the product feel real before the all-hands kickoff meeting.

---

## 2. What Problem This Solves

### The Problem: Products Die in Kickoff Meetings

> "Complex hardware/software products go off the rails in the all-hands kickoff meeting. Why? Because you have a room full of people speaking different domain languages about something that doesn't exist yet."
> — Founder, st8

**Current State:**
- PRDs are sterile documents that nobody reads
- Stakeholders speak past each other (engineers talk chipsets, CMOs talk messaging, sales talks channels)
- Hidden opportunities are missed (the firmware engineer's acoustic rendering + the product manager's auto-pairing concept + the sales director's price gap = flagship product)
- Objections are handled adversarially or ignored
- PRDs decay the moment they're written

**st8's Solution:**
1. **Make the product feel real BEFORE kickoff** — generate press releases, GTM plans, retailer briefs, and more
2. **Have intimate conversations** — voice or text, adaptive, leading questions
3. **Cross-reference every conversation** — find hidden alignments automatically
4. **Mediate objections constructively** — Product Owner generates alternatives, cycles until consensus
5. **Keep the PRD alive** — auto-update as code evolves, track every change

---

## 3. Core Concepts

### 3.1 The PRD Package

The PRD is **never a single document**. It's a collection of documents that together make the product feel real:

| Document | Purpose | Audience |
|----------|---------|----------|
| **Press Release** | The customer promise | Everyone (hub document) |
| **Internal FAQ** | Strategic reality check | Leadership, investors |
| **Product Positioning** | Market context | Marketing, Sales |
| **Messaging Framework** | Reusable communications | Marketing, PR |
| **Go-to-Market Plan** | Execution strategy | Sales, Operations |
| **Technical PRD** | Implementation blueprint | Engineering |
| **User Stories** | Feature definitions | Engineering, QA |
| **Test Strategy** | Quality assurance | QA, Engineering |
| **BOM & Cost Analysis** | Financial reality | CFO, Procurement |
| **Certification Tracker** | Compliance roadmap | Regulatory, Engineering |
| **Manufacturing Process** | Production plan | Manufacturing, Operations |

**The Hub-and-Spoke Model:** The Press Release + Internal FAQ are the hub. All other documents are spokes that derive from them. This guarantees consistency.

### 3.2 The Stakeholder Input Loop

```
Identify Stakeholders → Interview (voice/text/upload) →
Extract Entities → Cross-Reference → Find Opportunities →
Generate PRD Package → Present to Stakeholders →
Objection Cycle (if needed) → Lock → Execute
```

### 3.3 The Objection Cycle

```
Draft PRD → Review Period (no challenges) →
Objections Identified → Escalate to Product Owner →
PO Generates Alternatives → "Further Questions" to Stakeholders →
Counter-Suggestions → Compromise? YES → Update
Compromise? NO → Escalate to Final Say → Decision → Update →
Repeat until no objections → LOCK
```

### 3.4 The Atomic DB

The PRD is not a file. It is a **computed view** over:
- Schema cards (code analysis)
- File mutation log (change history)
- Stakeholder conversations (interviews)
- Business ontology (company knowledge)
- Intent store (purpose and value statements)

When you request the PRD, the system queries all of these and composes the document on-the-fly.

### 3.5 The Settings-Driven Architecture

Using the `settings-ui.js` pattern (schema-driven by convention):

- **To add a new LLM provider:** Add an entry to `models` array → UI appears automatically
- **To add a new stakeholder role:** Add to `stakeholders` array → interview questions appear
- **To configure product type:** Add to `product` object → correct templates selected
- **To add a new document template:** Add to `templates` array → available for generation

**No custom forms. No database migrations. No code changes.**

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         st8 PRD System                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  VOICE INPUT │  │  TEXT INPUT  │  │ FILE UPLOAD  │           │
│  │   (Web API)  │  │   (forms)    │  │  (any type)  │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                     │
│         └─────────────────┴─────────────────┘                     │
│                           │                                       │
│              ┌────────────▼────────────┐                         │
│              │   CONVERSATION ENGINE   │                         │
│              │  (transcription, intent │                         │
│              │   parsing, entity ext.)  │                         │
│              └────────────┬────────────┘                         │
│                           │                                       │
│              ┌────────────▼────────────┐                         │
│              │   BUSINESS ONTOLOGY     │                         │
│              │  (cross-dept inference,  │                         │
│              │   opportunity detection)│                        │
│              └────────────┬────────────┘                         │
│                           │                                       │
│  ┌────────────────────────▼────────────────────────┐             │
│  │              COMPOSITION ENGINE                │             │
│  │  (query schema cards → cluster → enrich →      │             │
│  │   template apply → quality gate → assemble)    │             │
│  └────────────────────────┬────────────────────────┘             │
│                           │                                       │
│              ┌────────────▼────────────┐                         │
│              │     TEMPLATE SYSTEM     │                         │
│  ┌───────────▼───────────┐ ┌──────────▼──────────┐             │
│  │   SOFTWARE TEMPLATES  │ │  HARDWARE TEMPLATES   │             │
│  │  (component, api, arch)│ │  (product, BOM, cert)│             │
│  └───────────┬───────────┘ └──────────┬──────────┘             │
│              │                        │                         │
│              └──────────┬───────────┘                         │
│                         │                                       │
│  ┌──────────────────────▼──────────────────────┐             │
│  │              PRD PACKAGE OUTPUT               │             │
│  │  (interactive web / markdown / DOCX / PDF)    │             │
│  └──────────────────────┬──────────────────────┘             │
│                         │                                       │
│              ┌──────────▼──────────┐                         │
│              │  OBJECTION CYCLE    │                         │
│              │  (review → mediate →│                         │
│              │   resolve → lock)     │                         │
│              └──────────┬──────────┘                         │
│                         │                                       │
│              ┌──────────▼──────────┐                         │
│              │  EXECUTION BRIDGE   │                         │
│              │  (tasks, timeline,  │                         │
│              │   dependencies)     │                         │
│              └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Breakdown

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | HTML + CSS + vanilla.js | Interactive PRD experience |
| **Backend** | Node.js + SQLite | Data persistence, API |
| **Schema Cards** | JSON files + SQLite | Code analysis snapshots |
| **Composition Engine** | Node.js + LLM API | PRD document generation |
| **Template Engine** | JS string templates | Document formatting |
| **LLM Integration** | REST API calls | Conversation, composition |
| **Voice Input** | Web Speech API (MVP) | Audio capture + transcription |
| **File Upload** | Multer/express | File storage + extraction |

---

## 5. The User Experience

### 5.1 Product Owner Setup (First Time)

1. **Open st8** → Click Settings → PRD System
2. **Enter project basics:** Name, product type, target market, price range
3. **Add stakeholders:** Name, email, role, department
4. **Configure LLM:** Add provider (OpenAI, Anthropic, local), API key, model
5. **Upload existing assets:** PRDs, research, competitor analysis, sketches

### 5.2 Stakeholder Interview Flow

**For each stakeholder:**

1. **System sends invitation:** "You're invited to share your vision for [Product Name]. This will take ~20 minutes."
2. **Stakeholder opens link** → sees warm welcome message
3. **Conversation begins:**
   - "Tell me about a product or feature you've always wanted to build but never had the chance."
   - Stakeholder speaks or types
   - System listens, transcribes, shows real-time feedback
   - System asks adaptive follow-ups based on answers
4. **File upload offered:** "Have any sketches, spreadsheets, or reference materials you'd like to share?"
5. **Conversation ends** → Stakeholder sees a summary of what was captured
6. **System extracts entities** and adds inferred topics to other stakeholders' interviews

### 5.3 PRD Package Generation

1. **Product Owner clicks "Generate PRD Package"**
2. **System shows progress:**
   - Analyzing conversations... ✓
   - Cross-referencing opportunities... ✓ (3 found!)
   - Generating press release... ✓
   - Generating GTM plan... ✓
   - Generating technical specs... ✓
   - Running quality gates... ✓
3. **PRD Package ready** → Interactive web view opens
4. **Product Owner reviews** → can edit any section
5. **"Share for Review"** → sends to all stakeholders

### 5.4 Objection Review Flow

**For each stakeholder:**

1. **Receives PRD Package** → browses at leisure
2. **Sees their contributions highlighted** → "You mentioned acoustic rendering — it's featured in the Key Technologies section!"
3. **Can raise objections:** Click "Question This" on any section
4. **Objection routed to Product Owner**
5. **PO generates alternatives** → sends back as "Further Questions"
6. **Stakeholder responds** → compromise or counter-suggestion
7. **Repeat until resolved**

### 5.5 The Kickoff Meeting

1. **Product Owner opens locked PRD Package** on screen
2. **Press release is shown first** → everyone sees the customer promise
3. **"Here's how we get there"** → GTM plan, workback schedule
4. **"Here's what each of you brings"** → stakeholder contributions highlighted
5. **Dry sections available** (technical specs, BOM) but not forced
6. **Everyone pulls in the same direction** because they all see their dreams reflected

---

## 6. Data Model

### 6.1 Core PRD Tables

```sql
-- PRD Versions (versioned document states)
CREATE TABLE prd_versions (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('DRAFT', 'REVIEW', 'LOCKED', 'ARCHIVED')),
    based_on_version_id INTEGER,
    prd_data TEXT, -- JSON blob
    is_current_live INTEGER DEFAULT 0,
    FOREIGN KEY (based_on_version_id) REFERENCES prd_versions(version_id)
);

-- PRD Documents (individual documents in a package)
CREATE TABLE prd_documents (
    doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL, -- 'press_release', 'gtm_plan', etc.
    content TEXT, -- Markdown content
    format TEXT DEFAULT 'markdown',
    status TEXT DEFAULT 'GENERATED',
    FOREIGN KEY (version_id) REFERENCES prd_versions(version_id)
);

-- PRD Packages (collection of documents)
CREATE TABLE prd_packages (
    package_id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    documents TEXT, -- JSON array of doc_ids
    status TEXT DEFAULT 'DRAFT',
    FOREIGN KEY (version_id) REFERENCES prd_versions(version_id)
);
```

### 6.2 Stakeholder Tables

```sql
-- Stakeholders
CREATE TABLE stakeholders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT, -- 'electrical_engineer', 'cmo', etc.
    department TEXT,
    status TEXT DEFAULT 'ACTIVE'
);

-- Interview Sessions
CREATE TABLE interview_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stakeholder_id INTEGER NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    transcript TEXT, -- Full conversation text
    status TEXT DEFAULT 'IN_PROGRESS',
    FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id)
);

-- Conversation Entities (extracted data)
CREATE TABLE conversation_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    entity TEXT NOT NULL, -- e.g., "$1299", "neural audio", "auto-pairing"
    entity_type TEXT, -- e.g., "price", "technology", "feature"
    confidence REAL,
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id)
);
```

### 6.3 Business Ontology Tables

```sql
-- Business Concepts (cross-department knowledge)
CREATE TABLE business_concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concept TEXT NOT NULL, -- e.g., "packaging"
    department_tags TEXT, -- JSON array: ["procurement", "marketing", "sales"]
    related_concepts TEXT, -- JSON array: ["logistics", "branding"]
    trigger_keywords TEXT -- JSON array: ["box", "unboxing", "retail"]
);

-- Inferred Topics (cross-stakeholder suggestions)
CREATE TABLE inferred_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stakeholder_id INTEGER NOT NULL,
    source_session_id INTEGER,
    topic TEXT NOT NULL,
    source_concept TEXT,
    priority TEXT DEFAULT 'MEDIUM',
    status TEXT DEFAULT 'PENDING'
);
```

### 6.4 Objection Tables

```sql
-- Objections
CREATE TABLE objections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stakeholder_id INTEGER NOT NULL,
    prd_version_id INTEGER,
    topic TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'OPEN', -- OPEN, UNDER_REVIEW, RESOLVED, ESCALATED
    priority TEXT DEFAULT 'MEDIUM',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Objection Alternatives (proposed by PO)
CREATE TABLE objection_alternatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objection_id INTEGER NOT NULL,
    alternative TEXT NOT NULL,
    proposed_by TEXT,
    status TEXT DEFAULT 'PROPOSED'
);

-- Objection Resolutions
CREATE TABLE objection_resolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objection_id INTEGER NOT NULL,
    resolution_type TEXT, -- COMPROMISE, FINAL_SAY, WITHDRAWN
    decided_by TEXT,
    resolution TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 6.5 Integration with Existing st8 Tables

The PRD system **reads from** (does not duplicate):
- `file_registry` — file fingerprints, lifecycle phases
- `file_mutation_log` — change history
- `file_intent` — purpose and value statements
- `connections` — dependency graph
- `schema-cards/*.json` — AST + exports + imports

---

## 7. API Surface

### 7.1 Stakeholder APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stakeholders` | GET | List all stakeholders |
| `/api/stakeholders` | POST | Create stakeholder |
| `/api/stakeholders/:id` | PUT | Update stakeholder |
| `/api/stakeholders/:id` | DELETE | Remove stakeholder |
| `/api/stakeholders/:id/interview` | POST | Start interview session |
| `/api/stakeholders/:id/upload` | POST | Upload file for context |

### 7.2 Conversation APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversation/text` | POST | Submit text input |
| `/api/conversation/voice` | POST | Submit voice recording (multipart) |
| `/api/conversation/:id/status` | GET | Check processing status |
| `/api/conversation/:id/entities` | GET | Get extracted entities |

### 7.3 PRD Generation APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prd` | GET | Generate PRD from current state |
| `/api/prd/generate` | POST | Trigger generation |
| `/api/prd/package` | GET | Get full PRD package |
| `/api/prd/:type` | GET | Get specific document type |
| `/api/prd/propose` | POST | Propose PRD update |
| `/api/prd/lock` | POST | Lock PRD version |

### 7.4 Objection APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/objections` | GET | List open objections |
| `/api/objections` | POST | Submit objection |
| `/api/objections/:id/alternatives` | POST | Propose alternatives |
| `/api/objections/:id/resolve` | POST | Resolve objection |

### 7.5 Template APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/templates` | GET | List available templates |
| `/api/templates/:id` | GET | Get template structure |
| `/api/templates/:id/render` | POST | Render template with data |

---

## 8. Templates & Documents

### 8.1 Document Types

The system generates **20 document types** organized into three domains:

**Software (5):**
1. Component PRD
2. API Specification
3. Architecture Overview
4. User Story Collection
5. Test Strategy

**Hardware (6):**
6. Product Specification
7. Industrial Equipment Specification
8. IoT/Embedded Specification
9. BOM and Cost Analysis
10. Certification Tracker
11. Manufacturing Process

**Business / Launch (9):**
12. Press Release
13. Internal FAQ
14. Go-to-Market Plan
15. Sales Channel Strategy
16. Product Positioning Document
17. Messaging Framework
18. External FAQ
19. Partnership Announcement
20. Financial Projections

### 8.2 Template System

All templates inherit from `st8-Core` base template:
- Metadata header (version, date, status, stakeholders)
- Document registry
- Change log

Domain templates extend via modular sections:
- `MOD-SW-API` — API endpoint definitions
- `MOD-HW-BOM` — Bill of materials table
- `MOD-BIZ-PR` — Press release structure

Template variables use `{{variable}}` syntax:
- `{{product.name}}` — Product name
- `{{product.target_price}}` — Price
- `{{biz.launch_date}}` — Launch date
- `{{stakeholder.electrical_engineer.name}}` — Stakeholder name

---

## 9. Implementation Roadmap

### Phase 0: Foundation (1-2 days)
Fix critical bugs in st8 identity system. Add `product` and `stakeholders` settings categories.

### Phase 1: Stakeholder Discovery (3-5 days)
Stakeholder registry, CRUD APIs, settings UI integration.

### Phase 2: Conversational Input (5-8 days)
Text/voice interview interface, LLM integration, file upload, conversation storage.

### Phase 3: Cross-Department Inference (5-7 days)
Business ontology, entity extraction, opportunity map, adaptive interview scripting.

### Phase 4: PRD Package Generation (10-14 days)
Template engine, composition pipeline, press release + spoke documents, technical PRDs, hardware PRDs, output formatting.

### Phase 5: Objection & Alignment (5-7 days)
Objection data model, review UI, mediation workflow, resolution tracking, version locking.

### Phase 6: Execution Bridge (5-7 days)
Task generation, workback schedule, living PRD sync, drift detection.

### Phase 7: Polish & Scale (ongoing)
Fun factor, advanced features, performance, hardware deep integration.

**Total MVP Timeline:** 13-15 weeks

---

## 10. Success Metrics

### System Metrics
- [ ] 100% of identified stakeholders complete interviews
- [ ] 3+ hidden opportunities found per project
- [ ] PRD package generated in < 10 minutes from conversations
- [ ] 90%+ of objections resolved without Final Say escalation
- [ ] PRD package shared externally by stakeholders (pride metric)

### Business Metrics
- [ ] Kickoff meetings have 0 "wait, I thought we were building..." moments
- [ ] Execution planning happens in days, not weeks
- [ ] Cross-department alignment score >= 90%
- [ ] Projects stay on schedule (measured against workback schedule)

### Quality Metrics
- [ ] Press release passes "Stranger Test" (understandable to outsider)
- [ ] All documents pass Consistency Test (same story across docs)
- [ ] Technical specs pass Actionability Test (can execute from this alone)
- [ ] PRD passes Objection Test (addresses top 3 failure reasons)

---

## 11. Appendix: Design Decisions

### Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Voice + Text equally supported | User choice, not forced modality |
| 2 | File uploads for rich context | Images, docs, CAD, spreadsheets feed into conversations |
| 3 | Local-first audio, transient | Privacy, no cloud dependency, storage efficiency |
| 4 | Settings-driven configuration | `settings-ui.js` pattern — add to array → UI appears automatically |
| 5 | Hub-and-spoke document model | Press Release is hub, all others are spokes — guarantees consistency |
| 6 | Objection mediation, not adversarial | PO generates alternatives, cycles until consensus |
| 7 | PRD as computed view, not file | Atomic DB philosophy — queries schema cards + conversations on-the-fly |
| 8 | Hardware-software unified | Same system, domain-aware templates |
| 9 | Non-forcing interaction | Users browse at leisure, system adapts to pace |
| 10 | Living, not static | PRD evolves with code and stakeholder input |

### Research Sources

This specification synthesizes research from:
- **10 Wave 1 research reports** (deep file reading across 5 PRD system lineages)
- **8 Wave 2 analysis reports** (cross-reference, external research, gap analysis)
- **10 Distilled specs** (D1-D10)
- **Founder's Vision** (stakeholder alignment, "make it real" philosophy)
- **Design Decisions** (architecture patterns, settings-driven config)

---

## End of PRD-SYSTEM-CONCEPT.md

**This is the PRD for the PRD system.**

**Next step:** Implementation begins with Phase 0 (Foundation).

**Open question for the founder:** How does this PRD system integrate with the broader st8 platform vision? We have the identity system (schema cards, mutation log) and now the PRD system (conversations, composition, packages). What connects them? What is the unified user experience?
