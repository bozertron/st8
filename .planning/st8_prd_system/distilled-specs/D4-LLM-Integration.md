# D4: LLM Integration Specification

**st8 PRD System — Distilled Specification**  
**Date:** 2026-05-13  
**Status:** Draft  
**Depends on:** D1 (Data Model), D5 (Pipeline), D10 (Conversation Engine)  

---

## 1. Overview

This specification defines how Large Language Models integrate with the st8 PRD system. The design maps the founder's vision of an intimate, voice-first conversational experience onto concrete prompt architectures, input pipelines, and triage logic.

Key principles from the source analysis that drive this spec:
- **Voice-first, not voice-only** (Conversational AI Requirements): Voice is primary input; screens provide primary output and ambient education.
- **Single-call triage** (MetaGPT analysis): MetaGPT's N+1 triage LLM calls are too expensive for a personal tool. We collapse triage to one lightweight LLM call with heuristics.
- **Local-first, transient audio** (Design Decisions): Audio never persists on disk. Once transcribed and parsed, the raw audio is discarded.
- **Warmth and curiosity** (Founder Vision): The system is a conversational alignment engine, not a form-filling robot.
- **Tap existing LLM infrastructure** (Founder Vision): Reuse st8's `LlmEntityConfig` patterns rather than building a new provider layer.

---

## 2. Conversation System Prompts

Each stakeholder conversation is powered by a system prompt that establishes persona, tone, and functional goals. The prompt is injected into an `LlmEntityConfig` record (see `LlmEntityConfig.system_prompt` in the existing data model) with `entity_type: "Cloud"`.

### 2.1 Prompt Strategy

All conversation prompts share a common base with persona-specific overlays. The system prompt is a single string (for the LLM API call) composed of concatenated sections:

1. **Identity preamble** — who the AI is
2. **Tone and behavior constraints** — warmth, curiosity, sycophancy avoidance
3. **Knowledge context** — current project state, business ontology, prior stakeholder inputs
4. **Functional directives** — how to ask questions, when to probe, when to move on
5. **Output schema hint** — remind the model that its text responses will be parsed for structured data extraction

### 2.2 Base Conversation Prompt

```markdown
You are st8, a product discovery assistant for [COMPANY_NAME]. Your goal is to help the team build alignment around a product that doesn't exist yet, by understanding each person's aspirations, constraints, and domain expertise.

Tone and behavior:
- Be genuinely curious. Ask follow-ups that show you listened.
- Warm, not enthusiastic. Avoid phrases like "Wow, brilliant insight!"
- Frame the session as a brainstorm, not an interrogation.
- If the stakeholder pauses, wait silently. Do not rush.
- Summarize what you heard and ask for confirmation before changing topics.
- Allow tangents, but gently nudge back: "That's interesting — let's park that and come back if we have time."
- Never ask the same question in different ways.
- If the user says "I don't have time," offer a 5-minute essential version or a reschedule without guilt.

Context available to you:
- Project: [PROJECT_NAME]
- Product category: [PRODUCT_CATEGORY]
- Known concepts from prior conversations: [INFERRED_TOPICS_JSON]
- Business ontology matches: [ONTOLOGY_MATCHES]

When you speak, remember:
- Your responses are transcribed and parsed into structured requirements.
- Tag entities naturally: "So you'd like to target a $1299 price point..." helps downstream parsing.
- If you detect a conflict with a prior stakeholder statement, note it neutrally: "I notice Engineering mentioned a longer timeline — let's explore that."
```

### 2.3 Stakeholder Persona Prompts

Persona prompts override select sections of the base prompt. They are stored as templates in `llm_entity_prompts.prompt_template` keyed by `persona_key`.

#### Stakeholder Interview Prompt (General/Warm, Curious, Leading Questions)
- **Target:** Default for stakeholders where a specific persona is not matched.
- **Override:**
  ```markdown
  Directives:
  - Start broad: "Tell me about your vision for this product."
  - Use the funnel technique: open-ended -> probing -> closed clarification only when necessary.
  - Keep sessions time-adaptive: mention the estimated duration at the start.
  - Reference prior answers to maintain continuity.
  - End with: "What haven't I asked that I should have?" and "Who else should I talk to?"
  ```

#### Engineer Persona Prompt (Constraint-Oriented, Technical)
- **Target:** `role_name` matching `*Engineer*`, `*Architect*`, `*Developer*`.
- **Override:**
  ```markdown
  Directives:
  - Show technical competence. Use precise terms (latency, throughput, MTBF) without pretension.
  - Ask about trade-offs and edge cases.
  - Probe feasibility: "What's the riskiest assumption in that approach?"
  - Acknowledge complexity: "That sounds non-trivial — what makes it hard?"
  - If you need more depth, use the 5 Whys sparingly.
  ```

#### Executive Persona Prompt (Strategic, Outcome-Focused)
- **Target:** `role_name` matching `CEO`, `CFO`, `CRO`, `VP*`, `Director`.
- **Override:**
  ```markdown
  Directives:
  - Respect time. Get to strategic relevance within 60 seconds.
  - Ask about success metrics, market opportunity, and ROI.
  - Vocabulary: market share, customer acquisition cost, time-to-revenue.
  - Probe: "What would make this a must-have for the board?"
  - Offer them options to save time: "We can hit the three essential questions now, or schedule a deeper dive."
  ```

#### Sales Persona Prompt (Market-Oriented, Critical Incident Technique)
- **Target:** `role_name` matching `Sales*`, `BD*`, `Account*`, `Revenue*`.
- **Override:**
  ```markdown
  Directives:
  - Encourage storytelling about specific deals, channels, and customer pain points.
  - Use critical incident technique: "Tell me about the last time a deal was won or lost because of a missing feature."
  - Ask about competitive gaps and buying groups.
  - Vocabulary: deal velocity, win rate, customer journey, channel strategy.
  - Map product concepts to revenue impact: "If we hit that price point, how does that affect your close rate?"
  ```

### 2.4 Objection Handling Prompt (Constructive, Non-Adversarial)

This prompt is used during the **Objection Cycle** (see Design-Decisions.md Section 3) when a stakeholder raises concerns about the drafted PRD package.

```markdown
You are st8, facilitating a constructive review of the draft PRD package for [PROJECT_NAME].

The stakeholder [STAKEHOLDER_NAME] from [DEPARTMENT] is reviewing sections relevant to them.

Your role:
- Present their own captured input and the synthesized draft side by side.
- Ask: "Does this accurately reflect what you shared? Is anything missing, overstated, or misaligned?"
- If they raise an objection:
  1. Acknowledge neutrally: "I hear that..."
  2. Reframe around shared goals: "Both you and [OTHER_STAKEHOLDER] want [SHARED_GOAL] — what's the minimum viable path?"
  3. Propose concrete options before escalation.
  4. Surface underlying concerns: objections often mask deeper issues.
- Escalation trigger suggestion: if the stakeholder's sentiment drops sharply or the issue involves budget/headcount/strategic direction, advise that this may need Product Owner mediation.

Tone: calm, impartial, helpful. You are a translator, not a defender of the draft.
```

---

## 3. Composition System Prompts

After stakeholder conversations are complete, the system shifts from **interview mode** to **composition mode**. These prompts generate the PRD package documents. Composition prompts are also stored as `LlmEntityConfig` records with `entity_type: "Cloud"`, but they are invoked in a batched pipeline (see Wave 3 execution) rather than interactively.

### 3.1 Press Release Generation Prompt

```markdown
You are a senior communications strategist for [COMPANY_NAME]. Write a launch press release for the following product.

Product context:
- Name: [PRODUCT_NAME]
- Category: [PRODUCT_CATEGORY]
- Target price: [PRICE_POINT]
- Key features: [FEATURE_LIST]
- Target channels: [CHANNEL_LIST]
- Competitive positioning: [POSITIONING_SUMMARY]

Instructions:
- Write in journalistic style: inverted pyramid.
- Include a compelling headline, sub-headline, dateline, body, quote from an internal leader, and boilerplate.
- Mention the problem the product solves and the market gap it fills.
- Tone: confident, clear, slightly aspirational. Not hyperbolic.
- Output as Markdown.
```

### 3.2 GTM Plan Generation Prompt

```markdown
You are a go-to-market strategist. Produce a GTM plan for [PRODUCT_NAME].

Inputs:
- Sales Director insights: [SALES_SUMMARY]
- Marketing insights: [MARKETING_SUMMARY]
- Target regions: [REGION_LIST]
- Buying groups: [BUYING_GROUP_LIST]
- Launch price: [PRICE_POINT]
- Channel strategy: [CHANNEL_LIST]

Instructions:
- Sections: Market Context, Target Audience, Channel Strategy, Launch Timeline, Messaging Framework, Pricing & Packaging, Success Metrics, Risks & Mitigations.
- Make it specific: name channels, suggest launch windows, propose promotional hooks.
- Cross-reference Sales Director's channel relationships with Marketing's regional plans.
- Tone: business-fluent, executable, not generic.
- Output as Markdown.
```

### 3.3 Technical Spec Generation Prompt

```markdown
You are a principal engineer writing a technical specification for [PRODUCT_NAME].

Inputs:
- Engineering stakeholder inputs: [ENGINEERING_SUMMARY]
- Known constraints: [CONSTRAINT_LIST]
- Target components: [COMPONENT_LIST]
- BOM-relevant items: [BOM_HINTS]

Instructions:
- Sections: Overview, Architecture, Components, Interfaces, Constraints, Risks, Open Questions.
- Be specific where possible: suggest architectures, protocols, or toolchains if the input implies them.
- Flag any requirement that seems incompatible with stated constraints.
- Tone: precise, analytical, honest about trade-offs.
- Output as Markdown.
```

### 3.4 Cross-Department Inference Prompt

```markdown
You are a synthesis engine. You have received inputs from multiple departments about a single product.

Your task: identify hidden alignments, latent conflicts, and cross-cutting opportunities.

Inputs:
[DEPARTMENT_INPUTS_JSON]

Instructions:
- For each pair of departments, note where their inputs converge on a single opportunity.
- Highlight conflicts: "Sales wants Q2 launch but Engineering estimates 6 months."
- Propose bridging options: "Would a phased approach — limited release Q2, full architecture Q4 — satisfy both?"
- If a keyword from the business ontology appears in one department's input but they didn't connect it to another department, note the missed link.
- Output a structured report: Alignments, Conflicts, Opportunities, Recommended Follow-up Questions.
```

### 3.5 Quality Gate Prompt (Void / Gold / Physics)

This prompt implements a structured review pass before a PRD package is presented in the objection cycle.

```markdown
You are a quality gate for the [PROJECT_NAME] PRD package. Evaluate the draft against three criteria:

1. VOID — Are there logical gaps or internal contradictions?
   - Example: Price point is $1299 but BOM costs imply 1.2x CoGS with no margin explanation.
   - Example: A feature is promised but no engineering input supports feasibility.

2. GOLD — Is the business case clear and compelling?
   - Is the target market defined?
   - Are revenue/margin projections present and defensible?
   - Does the competitive positioning hold up?

3. PHYSICS — Are the constraints realistic?
   - Given the stated timeline and team size/resources, is the scope achievable?
   - Are manufacturing tolerances, hardware lead times, or certification requirements acknowledged?

Output:
- A scorecard with PASS / PARTIAL / FAIL per criterion.
- Specific quotes from the draft that triggered each flag.
- Suggested fixes for any PARTIAL or FAIL.
```

---

## 4. Voice + Text + File Input Pipeline

The founder explicitly wants **voice + text + file uploads** as three equal pillars. This section defines the end-to-end data flow for each modality.

### 4.1 Core Principles

1. **Local-first architecture**: Transcription and initial parsing happen on the user's machine. Cloud LLMs receive text, not audio.
2. **Transient audio**: Raw audio buffers are discarded immediately after transcription. Only the transcript and parsed structured data persist.
3. **User control**: A visible "Done" button (or voice command) lets the user finish capture. No auto-cutoff mid-thought.
4. **Screen augmentation**: During voice capture, the screen shows: real-time waveform, live transcript scrolling, current topic indicator, and inferred-requirement sidebar.

### 4.2 Audio Capture → Transcription → Intent Parsing → Structured Data

| Stage | Technology | Details |
|---|---|---|
| **Audio Capture** | Browser-native Web Speech API (MVP) | Continuous listening via `SpeechRecognition` with `interimResults = true`. Upgrade path to Whisper via local inference or st8's existing LLM infra. |
| **Transient Buffer** | In-memory `AudioBuffer` or `Blob` | Held only while `isListening === true`. Never written to disk. |
| **Transcription** | Web Speech API `onresult` (MVP) | Real-time interim + final transcript delivered to UI. For Whisper upgrade: `FormData` POST to local endpoint, receive text. |
| **Utterance Chunking** | Custom heuristics | Split transcript on pauses (>1.5s) and punctuation into "utterances." Each utterance is a candidate for entity extraction. |
| **Intent Parsing** | Single LLM call (lightweight model) | Send a batch of utterances + conversation context to an LLM. Prompt: "Extract requirements, entities, and sentiment from these utterances." Return JSON matching the structured requirement schema. |
| **Structured Data** | SQLite `Parsed_Utterances` table | Store: `utterance_id`, `conversation_id`, `raw_text`, `extracted_entities` (JSON), `intent_type`, `confidence_score`, `themes[]`, `linked_requirement_ids[]`. |

**Prompt for Intent Parsing LLM call**:
```markdown
You are an intent parser for a product requirements system.
Given the following conversation transcript snippet and the project context, extract:

- Relevant entities (products, competitors, technologies, prices, timelines, departments)
- Stated requirements (functional or non-functional)
- Constraints or risks mentioned
- Sentiment (positive / neutral / concerned / frustrated)
- Suggested follow-up questions

Project context: [CONTEXT]
Transcript snippet: [UTTERANCES]

Return JSON matching this schema:
{
  "entities": [{"text": "...", "type": "...", "confidence": 0.9}],
  "requirements": [{"text": "...", "category": "...", "confidence": 0.85}],
  "constraints": [{"text": "..."}],
  "sentiment": "concerned",
  "follow_up_suggestions": ["..."]
}
```

### 4.3 Text Form Input → Structured Data

When a user prefers typing, the system surfaces a **dynamic form** rendered from the PRD schema, as shown in the existing `PrdEditor.vue` design. Text input flows are simpler:

1. User types into a field (e.g., "Target Price").
2. On blur or explicit save, the raw text is stored in `PRD_Versions.prd_data`.
3. An optional **enhancement pass** (lightweight LLM call) enriches the text: e.g., "$1299" is parsed into `{ "currency": "USD", "value": 1299, "tier": "premium" }`.

### 4.4 File Upload → Extraction → Context

| Upload Type | Extraction Method | Context Integration |
|---|---|---|
| **Images** (renders, sketches, UI mockups) | Vision-enabled LLM or local vision model (MVP: manual description by user; upgrade: LLM vision) | Description text added to conversation context and `uploads` table. |
| **Documents** (existing PRDs, PDFs, Word) | Text extraction via `pdf-text-reader` / `mammoth` / `python-docx`. Then entity extraction via LLM. | Key entities and text added to conversation context. Full text stored in `uploads.raw_text`. |
| **Spreadsheets** (BOMs, cost models) | Parse via `papaparse` or Python `pandas`. Numeric summaries extracted. | Key rows/columns added to context; BOM entries linked to `components` ontology. |
| **CAD files** | Metadata extraction (filename, dimensions if embedded). Full parsing deferred to specialist tools. | Filename and user-provided notes added to context. |
| **Audio/Video** | Transcription via Whisper or similar. | Treated same as voice capture pipeline above. |
| **Presentations** | Slide text extraction via `python-pptx` or similar. | Key slides summarized by LLM; added to context. |

**Storage**:
- Physical file: `.st8/uploads/` directory (project-local).
- Metadata + extracted text: SQLite `Uploads` table.
- LLM context injection: When a conversation or composition prompt is built, the system queries `Uploads` for files tagged with the current stakeholder or topic and appends summaries to the prompt context.

---

## 5. Triage-First Classification

Before any conversation or composition workflow begins, every new user input must be classified. This prevents the expensive N+1 triage pattern observed in MetaGPT.

### 5.1 Classification Categories

| Category | Trigger | Route |
|---|---|---|
| **NEW_PRD** | No existing PRD for this project; user is initiating a new product discovery. | Stakeholder discovery → Conversational capture → Synthesis → Composition |
| **UPDATE_PRD** | An existing PRD exists; user input relates to an existing requirement or adds new requirements to an existing project. | Identify target PRD section → Legacy+Delta merge (MetaGPT's `NEW_REQ_TEMPLATE` pattern) → Change proposal workflow |
| **BUGFIX** | User describes a bug, defect, or broken behavior. | Bug report intake → Link to nearest existing requirement → Escalate to engineering ticket (not PRD workflow) |
| **CLARIFICATION** | User asks a question or requests info without changing content. | Direct response; no workflow entry. |

### 5.2 Single-Call Triage Implementation

Instead of MetaGPT's sequential `_is_bugfix()` + `get_related_docs()` LLM calls, st8 uses **one structured LLM call**:

```markdown
You are a triage classifier. Analyze the user's message and classify it.

User input: [USER_INPUT]
Project context: [PROJECT_NAME] — current PRD exists: [YES/NO]
Recent history: [LAST_3_MESSAGES]

Classify into exactly one category:
- NEW_PRD
- UPDATE_PRD
- BUGFIX
- CLARIFICATION

Also return:
- confidence_score (0.0–1.0)
- reasoning (1 sentence)
- suggested_next_action

If UPDATE_PRD, identify the most likely affected PRD section.
If BUGFIX, extract the affected component/feature if mentioned.

Return JSON matching schema: { "category": "...", "confidence": 0.95, "reasoning": "...", "target_section": "...", "component": "..." }
```

**Heuristic shortcuts** (executed before LLM call to save cost):
- If `project_status === "empty"` → classify as `NEW_PRD` without LLM call.
- If input contains keywords: "bug", "broken", "crash", "defect" → classify as `BUGFIX` without LLM call if confidence > 0.9.
- If input is a single question starting with "what", "how", "when" → classify as `CLARIFICATION` without LLM call.

---

## 6. Research Enhancement

### 6.1 Optional Perplexity Integration

The `parse-prd-with-research` research mode (W1-03-TIER1-PrdEditor_Commands) uses a research provider for comprehensive, current-best-practice task generation. st8 adopts this pattern as an **opt-in enhancement** layer.

**When enabled** (`research_enabled: true` in project config), the research layer is invoked at two points:
1. **Pre-interview**: If the product domain involves new technology, the research agent fetches latest framework/security/performance best practices. These are injected into the engineer persona prompt as "current context."
2. **Pre-composition**: Before writing technical specs, a research pass gathers current architecture patterns, library recommendations, and compliance standards.

**Implementation**:
- Provider configured in `.taskmaster/config.json` style, but integrated into st8's `LlmEntityConfig` layer.
- Research calls are **cached** per project per week to avoid redundant cost.
- Research output is stored in `Research_Notes` table, linked to `project_id`.

### 6.2 When to Enable

- **New technology domains**: Stakeholder mentions a framework, chipset, or protocol the LLM's training cutoff may not cover well.
- **Complex requirements**: Multi-system integrations involving regulatory or compliance considerations (e.g., medical, automotive, finance).
- **Explicit user request**: Product Owner toggles "Enhance with current research" during project setup.

### 6.3 Prompt for Research Agent

```markdown
You are a research assistant. The user is building a product in [DOMAIN].
Current date: [TODAY].

Fetch or summarize the current best practices for:
1. Technology stack and framework selection in this domain.
2. Security and compliance considerations.
3. Performance benchmarks and common pitfalls.
4. Recommended testing strategies.

Return a concise Markdown report (max 800 words) with citations where possible.
This report will be injected into the technical composition prompts.
```

---

## 7. LLM Configuration

### 7.1 Tap st8's Existing LLM Infrastructure

st8 already has an `LlmEntityConfig` data model (`W1-02-TIER1-PrdGenerator`):

```typescript
interface LlmEntityConfig {
  id: string;
  project_id: number;
  role_name: string;
  entity_type: "Cloud" | "Mock";
  llm_provider?: string | null;
  api_key?: string | null;
  mock_response_payload?: string | null;
  system_prompt: string;
  model_id?: string | null;
}
```

The PRD system reuses this exactly:
- **Conversation prompts** are `LlmEntityConfig` rows with `role_name` as the persona key (e.g., `"engineer_persona"`).
- **Composition prompts** are rows with `role_name` as the composition type (e.g., `"press_release_composer"`).
- **Triage classifier** is a row with `role_name: "triage_classifier"`.
- **Intent parser** is a row with `role_name: "intent_parser"`.
- **Research agent** is a row with `role_name: "research_assistant"`.

### 7.2 System Prompt per Company Onboarding

As per Design Decision 6, the system prompt is established once during company onboarding:

- A base prompt is stored in `companies.system_prompt` (or equivalent).
- This base prompt is **prepended** to every persona and composition prompt at prompt-assembly time.
- It defines company voice, values, product philosophy, and any industry-specific vocabulary.

**Example**:
```markdown
Company: Acme Audio
Voice: Technically confident, warmly conversational. We respect craft.
Taboos: Never describe audio as "crispy." Never use hyperbole about "revolutionary" sound.
Philosophy: Products should disappear into the user's life. Engineering elegance over feature bloat.
```

### 7.3 Model Selection Strategy

The PRD system differentiates between **latency-sensitive** (interactive) and **quality-sensitive** (batch) tasks.

| Task | Sensitivity | Default Model Strategy |
|---|---|---|
| **Triage classifier** | Latency | Fast, cheap model (e.g., GPT-4o-mini, Haiku). Heuristic bypass where possible. |
| **Intent parser (live)** | Latency | Fast model with JSON mode. Must return in <2s for real-time feel. |
| **Conversation engine** | Latency | Capable model (e.g., GPT-4o, Sonnet). Streaming response for natural feel. |
| **Composition (docs)** | Quality | Best available model (e.g., GPT-4o, Opus). No streaming; batch execution. |
| **Quality gate** | Quality | Best available model, prompted for careful analysis. |
| **Cross-department inference** | Quality | Best available model. Complex reasoning required. |
| **Research agent** | Quality | Research-capable model (Perplexity API, or general model with tool use for web search). |

**Model override**: The Product Owner can override per-task models in project settings. If no override is set, the system falls back to the st8-wide `default_llm_model` config.

### 7.4 Mock Mode for Testing

`entity_type: "Mock"` enables offline testing:
- When `entity_type === "Mock"`, the system returns `mock_response_payload` instead of calling the provider.
- This is used in CI, demo environments, and during prompt engineering.
- Mock payloads should be realistic JSON that matches the expected response schema for that role.

---

## 8. Summary Table: LLM Touchpoints

| # | Touchpoint | Invoker | Input | Output | Model Tier |
|---|------------|---------|-------|--------|------------|
| 1 | Triage classifier | UI (new message) | User text + context | `NEW_PRD` / `UPDATE_PRD` / `BUGFIX` / `CLARIFICATION` | Fast |
| 2 | Conversation turn | Conversation engine | Persona prompt + conversation history + ontology context | Assistant reply text | Capable |
| 3 | Intent parser | Conversation engine (background) | Utterances + conversation context | JSON: entities, requirements, sentiment | Fast |
| 4 | Objection facilitator | Objection cycle UI | Stakeholder review context + draft diff | Follow-up questions, options, escalation flags | Capable |
| 5 | Press release composer | Composition pipeline | Product summary + market context | Markdown press release | Quality |
| 6 | GTM plan composer | Composition pipeline | Sales/marketing inputs + channels | Markdown GTM plan | Quality |
| 7 | Technical spec composer | Composition pipeline | Engineering inputs + constraints | Markdown technical spec | Quality |
| 8 | Cross-dept inference | Composition pipeline (Wave 3) | All stakeholder summaries | JSON: alignments, conflicts, opportunities | Quality |
| 9 | Quality gate | Pre-objection review | Draft PRD package | JSON scorecard: Void/Gold/Physics | Quality |
| 10 | Research assistant | Optional, pre-composition | Domain query | Current best practices Markdown | Research |

---

## 9. Future Considerations

- **Streaming composition**: For very large PRD packages, composition prompts may be split into sections and streamed, with a final consistency pass.
- **Multi-modal LLM input**: When vision models are reliably fast, uploaded images may be passed directly to the conversation LLM rather than being described in text first.
- **Fine-tuned triage**: If the single-call triage accuracy drops below 95%, consider a lightweight fine-tuned classifier instead of a general LLM.
- **Conversation memory compression**: For long projects, conversation histories may exceed context windows. Implement a summarization/memory-condensation step that archives old turns into a "conversation summary."
