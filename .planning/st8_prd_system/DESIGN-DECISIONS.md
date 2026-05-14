# ST8 PRD System — Design Decisions Log

**Date:** 2026-05-13
**Status:** Active decisions driving specification

---

## Decision 1: Voice + Text Input Architecture

**Decision:** Both voice AND text are first-class options. Voice is not primary over text — users choose their preferred modality.

**Rationale (from Founder):**
- Voice and text should be equally represented as options
- Some users prefer typing, some prefer speaking
- Prepare forms for text-based answers
- In addition to typing/voice, there needs to be forms for uploading anything users want to help 'feed into the conversation' (pictures, spreadsheets, existing documents, CAD files, etc.)

**Implications:**
- Dual-mode input system: voice OR text at any point
- Text forms with structured fields for key data capture
- File upload support: images, documents, spreadsheets, CAD files, audio, video
- All uploaded content becomes context for the conversation and PRD generation
- Voice capture remains local-first with "done" button (as previously decided)
- Transcription happens locally or via configured LLM
- No audio storage (privacy + storage efficiency)

---

## Decision 1b: File Upload & Rich Media Input

**Decision:** Users can upload any files to "feed into the conversation." These become context for interviews and PRD generation.

**Upload Types:**
- Images (product renders, sketches, reference photos, UI mockups)
- Documents (existing PRDs, market research, competitor analysis)
- Spreadsheets (BOMs, cost models, financial projections)
- CAD files (mechanical designs, PCB layouts)
- Audio/Video (interview recordings, product demos)
- Presentations (pitch decks, sales materials)

**Processing Pipeline:**
1. **Upload** → stored in project `.st8/uploads/` directory
2. **Extract** → text/entities from documents, vision analysis for images, metadata for CAD
3. **Index** → content added to business ontology and conversation context
4. **Reference** → LLM can reference uploaded content during interviews and composition

---

## Decision 2: Cross-Department Inference Engine

**Decision:** Parse every conversation against every other conversation + a universal "business table."

**Rationale (from Founder):**
- Business table exposes keywords and conceptual relationships for every element of the business AND every element of the product
- Example: When industrial designer talks about packaging, inferences are added to procurement, logistics, marketing, sales conversations because all those departments deal with packaging
- Product Owner lays down initial info including these relationship concepts
- Conversational elements added to each relevant colleague to flesh out topics for their interview
- Stored and added to conversations in intelligent ways

**Open Question:** How do we store and intelligently add inferred topics to subsequent conversations?

**Proposed Approach:**
1. **Business Ontology Table** — SQLite table with: `concept`, `department_tags[]`, `related_concepts[]`, `trigger_keywords[]`, `inference_template`
2. **Conversation Parser** — After each stakeholder interview, extract entities/keywords, match against business ontology
3. **Inferred Topics Store** — For each stakeholder, maintain a `pending_topics` list of inferred questions/topics from other conversations
4. **Adaptive Interview Scripting** — When interviewing stakeholder N, prepend their conversation with relevant inferred topics: "Based on what [Engineer] shared about packaging, we'd love your take on..."

---

## Decision 3: Objection Handling Workflow

**Decision:** Three-tier escalation: No challenge → Product Owner mediation → Final Say authority.

**Rationale (from Founder):**
- Nothing is challenged in the first pass
- Conflicts in opinions escalated first to Product Owner
- Then, if required, to whoever has "the final say"
- Final Say defined in initial project setup (could be Product Owner or someone else)
- First phase: Product Owner addresses each objection with as many alternatives as they can think of
- Those brought back to appropriate colleagues as "Further Questions for Refinement"
- Cycles until: Final Say makes the call, OR parties compromise on a solution that works for everyone (they can always issue a counter-suggestion)

**Workflow Diagram:**
```
Stakeholder Input (Round 1) →
Synthesis + Draft PRD Package →
Objections Identified →
  → Product Owner addresses with alternatives →
    → "Further Questions for Refinement" sent to relevant stakeholders →
      → Counter-suggestions received →
        → Compromise reached? → YES → Updated Draft
        → Compromise reached? → NO → Escalate to Final Say
          → Final Say makes call → Updated Draft
→ Repeat until no outstanding objections → LOCK
```

---

## Decision 4: Output Format & Platform

**Decision:** Interactive web-based system, locally served. HTML+CSS+vanilla.js + SQLite + Python for logic/calculations/effects/simulations.

**Rationale (from Founder):**
- Goal is an interactive "website" served locally
- Product Owner feeds all available assets during project set up
- Anything used before can be used again
- Standard Office document packaging (DOCX/PDF) as fallback for external stakeholders
- Rich, interactive, multimedia — not dry documents

**Fallback Chain:**
1. **Primary:** Interactive local web app (HTML+CSS+JS+SQLite+Python)
2. **External Sharing:** Office document package (DOCX/PDF)
3. **Developer Consumption:** Markdown + JSON exports

---

## Decision 5: Interaction Model

**Decision:** Product Owner driven for now. System-driven roadmap later. Non-forcing, exploratory.

**Rationale (from Founder):**
- After first time, user prompted: "Anyone new we're adding, or the same as last time?"
- Users explore and interact with the product "website" at their leisure
- NOT forcing anything on anyone
- System adapts to user pace, not the other way around

---

## Decision 6: LLM System Prompt Strategy

**Decision:** LLM system prompt established per company onboarding. Not critical for now (single user/company).

**Rationale (from Founder):**
- For now, only for us — not a big concern
- Eventually: per-company system prompt configured during onboarding
- System prompt defines company voice, values, product philosophy

---

## Decision 7: Agent Deployment Strategy (Meta-Decision)

**Decision:** Deploy more agents than needed. Tell them to write output in phases.

**Rationale (from Founder):**
- "Deploy more than you think you may need"
- "Tell them to write their output in phases, the first one being just the document and header"
- Agents rarely get hung up if they write incrementally

**Implementation:**
- Wave 3 synthesis agents will be instructed to write in phases:
  1. Document header + outline
  2. Section-by-section population
  3. Cross-reference and consistency check
  4. Final summary

---

## Summary: The st8 PRD System Philosophy

1. **Voice + Text equally supported** — Natural dialogue OR structured forms, user's choice
2. **Rich media uploads** — Any file can feed into the conversation
3. **Intelligent cross-referencing** — Every conversation enriches every other
4. **Product Owner mediated** — Human in the loop for objections
5. **Interactive web experience** — Rich, local, multimedia
6. **Non-forcing** — Users explore at their own pace
7. **Living, not static** — PRD evolves with conversations, code, and stakeholder input continuously. Not a document that is written once — it breathes with the project.

---

**CRITICAL REMINDER:** At the end of the fact-finding journey, prompt the founder on the **st8 integration vision** — how this PRD system integrates with the broader st8 identity/lifecycle platform.

**Next Action:** These decisions feed directly into Wave 3 synthesis (D1-D10 specs).
