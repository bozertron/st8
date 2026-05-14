# Conversational AI Requirements Gathering: Research Report

**Research Date:** 2026-05-13
**Researcher:** Domain Research Agent (st8 PRD System)
**Sources:** Nielsen Norman Group, Anthropic Engineering, Interaction Design Foundation, arXiv

---

## 1. Executive Summary

This report synthesizes current research on conversational AI systems for requirements gathering, stakeholder interviews, and voice-first input capture. The st8 PRD system aims to use voice-first, conversational interfaces to interview diverse stakeholders and capture product aspirations. Key findings indicate that while AI-moderated interviews are viable for structured data collection at scale, they currently struggle with semistructured discovery, real-time adaptation, and building genuine rapport. Voice-first design requires careful integration with visual feedback, error prevention, and recognition-over-recall support. Leading question design follows established frameworks (funnel technique, open-ended probing) that can be codified for AI use. The "fun factor" emerges from microinteractions, personality-appropriate tone, and visible progress — not gamification gimmicks.

---

## 2. Conversational Requirements Gathering: What Exists & What Works

### 2.1 Existing Systems & Approaches

**AI-Moderated Interview Platforms**
Current commercial AI interviewers (e.g., Marvin, UserFlix) facilitate structured interviews via synthetic voice. Participants complete interviews asynchronously without human facilitators. These systems:
- Follow predefined scripts with configurable probing depth
- Summarize participant responses to create a sense of being heard
- Support multilingual interviews without translators
- Allow scaling of feedback collection beyond human researcher capacity

**What Works**
- **Structured data collection at scale:** AI interviewers excel when the problem space is well understood and questions are predefined (Rosala, 2026)
- **Summarization as rapport-builder:** AI summarization of participant responses was the most common positive feedback — it made participants feel heard and understood
- **Scheduling flexibility:** Asynchronous completion removes coordination friction
- **Translation:** Running interviews in languages the research team doesn't speak

**What Does Not Work**
- **Semistructured discovery:** Current AI interviewers cannot adapt to unexpected insights, skip irrelevant questions, or reframe questions in real time
- **Reading nonverbal cues:** AI lacks facial-expression analysis, body-language reading, and backchannel cues (nodding, smiling)
- **Consistent performance:** Interview quality varies dramatically (13–56 minutes in one study) due to inability to "read the room" or manage time
- **Sycophancy:** Overly enthusiastic AI responses ("Wow, brilliant insight!") feel fake and disingenuous to participants
- **Interruptions vs. awkward silences:** Some systems interrupt participants; others leave dead air that makes users multitask or disengage

### 2.2 Implications for st8

The st8 system should adopt a **hybrid model**: AI-led structured questioning for efficiency, with human-in-the-loop checkpoints for discovery and conflict resolution. The system must avoid the "sycophancy trap" — exaggerated enthusiasm destroys trust. Summarization should be followed by a pause for participant confirmation, not an immediate topic switch.

---

## 3. Voice-First UX Patterns

### 3.1 Voice-First vs. Screen-First vs. Voice-Only

**Screen-first with voice added** (e.g., Siri, Google Assistant) creates fragmented experiences: voice initiates tasks, but subsequent steps require touch. This division breaks flow and increases cognitive load.

**Voice-only** (e.g., original Amazon Echo) enables true hands-free operation but suffers from:
- Working memory overload (users must hold information in mind without visual reference)
- Inability to browse or compare options efficiently
- Tedious sequential information access

**Voice-first with screen augmentation** (e.g., Echo Show) is the emerging best practice:
- Voice as primary input; screen as primary output
- Sequential numbering of search results for verbal selection
- Immersive displays of rich content accessible via voice commands
- Suggested verbal commands displayed ambiently for discoverability

### 3.2 Core Voice-First Design Principles

| Principle | Application for st8 |
|---|---|
| **Error Prevention** | Superior far-field microphones and noise cancellation; confirm ambiguous inputs before acting |
| **Visibility of System Status** | Visual waveform during listening; transcription displayed in real time; progress indicators |
| **Recognition Over Recall** | Display suggested topics/commands; show previous answers; visual memory aid |
| **Flexibility & Efficiency** | Allow batch input ("add these three requirements"); support voice shortcuts for power users |
| **Support Multitasking** | Hands-free operation so stakeholders can reference documents while speaking |

### 3.3 The "Gulf of Execution" in Voice

Voice-first systems must bridge the gap between what users want and what they can articulate. Echo Show's approach of displaying "Try 'Alexa, scroll right'" instead of buttons exemplifies **ambient education** — teaching commands in context without breaking flow.

For st8, this means:
- **Contextual command suggestions**: "You can say 'go deeper on that' or 'move to next topic'"
- **Visual scaffolding**: Show the conversation structure so users know where they are
- **Graceful fallback**: When voice fails, offer touch/text alternatives without penalty

### 3.4 Critical Warning

NN/g warns that voice-first should not mean "voice-only." Deliberately handicapping screens to enforce pure voice interaction "would be like going into a fight with one hand tied behind your back" (Whitenton, 2017). A visual display is inherently more efficient for accessing large amounts of information than audio-only output.

---

## 4. Leading Question Techniques for Rich Requirements

### 4.1 The Funnel Technique

The funnel technique structures interviews from broad to specific:

1. **Broad open-ended questions**: "Walk me through how you think about this product area."
2. **Probing follow-ups**: "Tell me more about that." / "Can you give me an example?"
3. **Closed clarification**: "Was that in Q1 or Q2?"

Starting broad prevents priming participants with the interviewer's assumptions. It surfaces motivations and concerns the interviewer didn't anticipate.

### 4.2 Question Frameworks by Stakeholder Goal

NN/g identifies four high-level topics for stakeholder interviews (Gibbons, 2022):

| Topic | Example Questions |
|---|---|
| **Success Metrics** | "What does success look like for you and your team?" / "Do you have specific goals or metrics you're tracking?" |
| **Priorities** | "What challenges or business issues are currently top priorities?" |
| **History & Expertise** | "Can you tell me about any solutions to this problem you've tried before?" |
| **Process & Workflow** | "What is your ideal level of engagement in the project?" |

### 4.3 Probing Question Inventory

When a stakeholder gives a brief or vague answer, these probes elicit depth:

- "Tell me more about that…"
- "Can you expand on that…"
- "Can you give me an example…"
- "Can you tell me about the last time that you…"
- "How do you feel about that…"
- "Why is that important to you?"
- "Why does that stand out in your memory?"

### 4.4 Avoiding Leading Questions

Leading questions interject the desired answer into the question itself. They result in biased or false answers because participants mimic the interviewer's words (Schade, 2017).

| Leading (Bad) | Neutral / Open-Ended (Good) |
|---|---|
| "Was that experience helpful?" | "How did you find that experience?" |
| "Did that make sense?" | "What did you think about that?" |
| "Did you find that task difficult?" | "How did you find that task?" |
| "To what extent was visual design a factor?" | "What factors did you consider?" |

**Red flags for leading questions:** Questions starting with "did," "was," or "is" often imply answers. Open-ended questions start with "how" or "what."

### 4.5 The "5 Whys" Technique

Originating from Toyota's manufacturing process, the 5 Whys technique probes root causes by repeatedly asking "why?" This transforms surface-level requirements into deep product insights:

> Stakeholder: "We need a dashboard."  
> AI: "Why is a dashboard important?"  
> Stakeholder: "So executives can see status quickly."  
> AI: "Why do they need to see status quickly?"  
> Stakeholder: "Because currently they call me 3 times a day asking for updates."  
> AI: "Why do they call you instead of checking the system?"  
> Stakeholder: "Because the current system doesn't show real-time data."  

**Root insight:** The requirement is not "dashboard" — it's "real-time visibility that reduces interruption."

---

## 5. Natural Language to Structured Data

### 5.1 The Thematic Analysis Pipeline

Converting free-form stakeholder conversations into structured PRD data follows the established thematic analysis methodology (Rosala, 2022):

1. **Transcribe** audio to text (with speaker diarization for multi-stakeholder sessions)
2. **Code** segments of text with descriptive labels (e.g., "performance-concern," "user-complaint," "competitive-threat")
3. **Group** related codes into candidate themes (e.g., "scalability-requirements")
4. **Interpret** themes into actionable requirements
5. **Validate** with stakeholders — confirm interpretation matches intent

### 5.2 LLM-Based Extraction Patterns

Anthropic's research on agentic systems suggests effective patterns for NLP-to-structured-data conversion:

**Prompt Chaining**
Decompose extraction into sequential steps:
- Step 1: Identify requirement statements from transcript
- Step 2: Classify each as functional / non-functional / constraint
- Step 3: Assign priority based on stakeholder tone and emphasis
- Step 4: Detect conflicts between requirements
- Step 5: Generate structured PRD entries

**Routing**
Route different stakeholder types to specialized extraction pipelines:
- Executive inputs → strategic objectives & success metrics
- Engineer inputs → technical constraints & implementation considerations
- Sales inputs → market requirements & competitive differentiators
- Designer inputs → UX requirements & interaction patterns

**Orchestrator-Workers**
A central LLM breaks down complex stakeholder interviews into subtasks:
- Worker 1: Extract user stories
- Worker 2: Extract acceptance criteria
- Worker 3: Identify dependencies and risks
- Worker 4: Synthesize cross-cutting concerns

**Evaluator-Optimizer**
One LLM generates structured requirements; another evaluates completeness and clarity. Iterate until quality threshold is met.

### 5.3 NLP Approaches That Work

| Approach | Use Case for st8 |
|---|---|
| **Named Entity Recognition (NER)** | Extract product names, competitor names, technical terms, dates |
| **Sentiment Analysis** | Detect stakeholder enthusiasm vs. concern to infer priority |
| **Intent Classification** | Distinguish "feature request" from "bug report" from "process complaint" |
| **Coreference Resolution** | Track "it" and "that" back to specific requirements across long transcripts |
| **Topic Modeling** | Discover hidden themes across multiple stakeholder interviews |
| **Emotion Detection** | Identify frustration, excitement, or ambivalence to weight requirements |

### 5.4 Structured Output Schema

Requirements should be extracted into a consistent schema:

```json
{
  "requirement_id": "REQ-001",
  "source": "stakeholder_interview",
  "stakeholder": {"name": "...", "role": "...", "department": "..."},
  "raw_quote": "...",
  "category": "functional | non-functional | constraint",
  "type": "feature | performance | security | usability | ...",
  "priority_indicated": "critical | high | medium | low",
  "confidence": 0.92,
  "themes": ["scalability", "real-time"],
  "conflicts_with": ["REQ-003"],
  "supports": ["REQ-007"],
  "extracted_at": "2026-05-13T10:00:00Z"
}
```

---

## 6. Stakeholder Interview Design by Persona

### 6.1 Persona-Based Question Customization

Different stakeholders require different interview approaches. The same AI system must adapt its persona, vocabulary, and depth:

| Stakeholder | Interview Focus | Question Style | Depth |
|---|---|---|---|
| **C-Suite (CEO/CFO)** | Strategic objectives, market opportunity, ROI, competitive positioning | Business-oriented, metric-driven, time-efficient | High-level, 10-15 min |
| **VP Engineering** | Technical feasibility, architecture constraints, team capacity, technical debt | Technical but accessible, resource-aware | Medium, 15-20 min |
| **Firmware Engineer** | Implementation details, edge cases, hardware limitations, protocol requirements | Highly technical, specific, example-rich | Deep, 20-30 min |
| **Mechanical Engineer** | Physical constraints, materials, manufacturing, ergonomics | Visual/spatial, prototype-oriented | Deep, 20-30 min |
| **Sales Director** | Customer pain points, competitive gaps, deal-blockers, market timing | Customer-story-driven, competitive-aware | Medium, 15-20 min |
| **Designer** | User experience, interaction patterns, aesthetic direction, accessibility | Open-ended, aspirational, reference-rich | Medium-deep, 15-25 min |
| **Legal/Compliance** | Regulatory requirements, IP concerns, liability, standards | Precise, scenario-based, risk-focused | Medium, 10-15 min |

### 6.2 Vocabulary Adaptation

The AI should mirror stakeholder vocabulary without pretension:
- With engineers: Use precise technical terms ("latency," "throughput," "MTBF")
- With executives: Use business outcomes ("market share," "customer acquisition cost," "time-to-revenue")
- With sales: Use customer-centric language ("deal velocity," "win rate," "customer journey")

### 6.3 Rapport Techniques by Persona

Building rapport differs by stakeholder type:
- **Executives**: Respect time constraints; get to the point; frame questions around their strategic priorities
- **Engineers**: Show technical competence; ask about trade-offs; acknowledge complexity
- **Sales**: Let them tell stories; ask about specific deals; validate their customer insights
- **Designers**: Ask about inspiration and references; explore "what if" scenarios

---

## 7. Cross-Department Alignment

### 7.1 The Alignment Problem

Stakeholder interviews often reveal conflicting priorities:
- Engineering wants stability; Sales wants rapid feature releases
- Finance wants cost reduction; Design wants premium materials
- Legal wants risk minimization; Product wants market disruption

### 7.2 AI-Facilitated Alignment Techniques

**Conflict Detection via Semantic Analysis**
Use NLP to identify when stakeholders from different departments express contradictory requirements:
- Sales: "We need this feature by Q2 to close Enterprise deals."
- Engineering: "That architecture requires 6 months of refactoring."
→ Flag as **schedule-architecture conflict**

**Theme Convergence Mapping**
Apply thematic analysis across all stakeholder transcripts to find:
- **Universal themes**: Requirements mentioned by all departments (highest priority)
- **Department-specific themes**: Unique perspectives that others missed
- **Hidden opportunities**: Contradictions that reveal innovative solutions

**Alignment Visualization**
Present stakeholders with a visual map showing:
- Where their inputs agree (builds consensus)
- Where they diverge (requires discussion)
- What each department cares about most (enables trade-off decisions)

### 7.3 Facilitating Resolution

When conflicts are detected, the AI should:
1. **Acknowledge neutrally**: "I notice Engineering mentioned a 6-month timeline while Sales mentioned Q2. Let's explore that."
2. **Reframe around shared goals**: "Both teams want the Enterprise segment — what's the minimum viable version for Q2?"
3. **Propose options**: "Would a phased approach work — limited release in Q2, full architecture in Q4?"
4. **Escalate to human**: When stakes are high or emotions run strong, bring in a human facilitator

---

## 8. The "Fun" Factor: Making Requirements Gathering Enjoyable

### 8.1 Why Enjoyment Matters

Requirements gathering is often perceived as tedious overhead. When stakeholders enjoy the process:
- They participate more fully and honestly
- They volunteer information beyond the questions asked
- They become champions for the resulting PRD
- Response rates and completion rates increase

### 8.2 UX Patterns That Create Delight

**Microinteractions**
Small, triggered feedback moments make the experience feel alive (Kendrick, 2018):
- Subtle sound when the system "wakes" to listen
- Smooth waveform animation during voice input
- Satisfying confirmation chime when a requirement is captured
- Visual celebration (confetti, checkmark animation) when a session completes

**Asana's Unicorn Principle**
Asana's flying unicorn — a playful animation that appears sporadically when completing tasks — demonstrates that **surprise delight** creates emotional attachment. The key is appropriateness: a flying unicorn fits a creative tool but would feel unprofessional in a compliance system.

**Visible Progress & Achievement**
- Progress bar showing interview completion
- "Topics explored" counter
- Summary of insights captured so far
- "You've contributed 12 requirements!" milestone messaging

**Personality-Appropriate Tone**
The AI's persona should match the company culture:
- **Professional but warm**: Not overly casual, not robotic
- **Context-aware**: More formal with executives; more conversational with designers
- **Self-aware humor**: Light acknowledgment of AI limitations builds trust ("I'm still learning your industry's terminology — correct me if I misinterpret.")

**Conversation Flow, Not Form-Filling**
The experience must feel like a conversation, not a survey:
- No visible numbered lists of questions
- Natural transitions: "That reminds me — have you thought about…?"
- Reference previous answers: "Earlier you mentioned reliability concerns. How does that factor in here?"
- Allow tangents: Let stakeholders explore related ideas; gently guide back when needed

**The "Coffee Chat" Frame**
NN/g recommends framing stakeholder interviews as "virtual coffees" — informal, relaxed, relationship-building. The AI should open with warmth:

> "Hi [Name]. I'm here to learn about your vision for [Product]. There are no wrong answers — think of this as a brainstorm. We'll take about 15 minutes, and you can pause anytime. Ready when you are."

### 8.3 Anti-Patterns to Avoid

| Anti-Pattern | Why It Kills Enjoyment |
|---|---|
| **Overly enthusiastic AI** | "Wow, brilliant insight!" feels fake and patronizing (Rosala, 2026) |
| **Interruptions** | Cutting off a stakeholder mid-thought destroys trust |
| **Awkward silences** | Dead air after an answer makes users think the system crashed |
| **Repetitive questions** | Asking the same thing in different ways feels like a test |
| **Robotic transitions** | "Moving to Question 7 of 12" breaks conversational flow |
| **No visible output** | Users need to see that their input was captured and understood |

---

## 9. Objection Handling & Disagreement Facilitation

### 9.1 Types of Stakeholder Objections

1. **Process objection**: "I don't have time for this."
2. **Scope objection**: "That's not our team's responsibility."
3. **Priority objection**: "That's less important than [other thing]."
4. **Feasibility objection**: "We can't build that with our current stack."
5. **Strategic objection**: "That doesn't align with our Q3 goals."
6. **Interpersonal objection**: "[Other department] always gets their way."

### 9.2 AI Facilitation Strategies

**Acknowledge & Validate**
Always acknowledge the objection before responding:
> "I hear that time is tight — that's a common concern. The good news is this interview adapts to your schedule. We can cover the essentials in 5 minutes, or explore more deeply if you have time."

**Reframe Around Value**
Connect the interview to the stakeholder's own goals:
> "The reason I'm asking about [topic] is that CFOs who've participated said it helped them secure budget by making the business case explicit. Would that be useful?"

**Surface Underlying Concerns**
Objections often mask deeper issues:
> "You mentioned [department] always gets their way. Can you tell me more about how prioritization decisions typically happen?"

**Offer Options**
Give stakeholders agency:
> "We can either dive deep on technical constraints now, or I can note it for a follow-up with your team. Which works better?"

**Escalation Protocols**
Define clear thresholds for human intervention:
- Emotional escalation (frustration, anger detected in tone/sentiment)
- High-stakes conflicts (budget, headcount, strategic direction)
- Complex political dynamics (inter-departmental rivalry)
- Legal/regulatory concerns

---

## 10. Specific Recommendations for st8's Stakeholder Interview System

### 10.1 Architecture Recommendations

1. **Hybrid AI-Human Model**
   - AI handles structured data collection, transcription, and initial synthesis
   - Human PMs review AI summaries, resolve conflicts, and conduct deep-dive follow-ups
   - Escalation triggers: sentiment drop, conflict detection, stakeholder request

2. **Prompt-Chaining Pipeline**
   - Chain 1: Transcription + speaker diarization
   - Chain 2: Requirement extraction + classification
   - Chain 3: Conflict detection + cross-reference
   - Chain 4: PRD generation + human review gate

3. **Orchestrator-Workers for Multi-Stakeholder Sessions**
   - Orchestrator: Manages interview flow, decides when to probe vs. move on
   - Worker 1: Real-time requirement extraction
   - Worker 2: Sentiment & engagement monitoring
   - Worker 3: Cross-reference against existing PRD content
   - Worker 4: Suggest follow-up questions based on gaps

### 10.2 UX Recommendations

1. **Voice-First with Rich Visual Feedback**
   - Primary input: Voice
   - Primary output: Screen showing real-time transcript, captured requirements, and conversation structure
   - Always display: "Listening..." waveform, current topic, progress indicator

2. **Ambient Education**
   - Contextually suggest commands: "You can say 'tell me more' or 'let's move on'"
   - Show visual scaffolding of the conversation roadmap
   - Offer touch fallback without penalty

3. **Rapport-Building Features**
   - Summarize stakeholder input and ask for confirmation before moving on
   - Reference previous answers to show continuity
   - Adapt vocabulary and tone to stakeholder persona
   - Include brief, warm introduction explaining purpose and confidentiality

4. **Delight Microinteractions**
   - Subtle audio/visual feedback for state changes (listening → processing → captured)
   - Progress celebrations (milestone animations)
   - "Insights discovered" counter that grows during the session
   - Post-interview summary email with key contributions highlighted

### 10.3 Question Design Recommendations

1. **Funnel-Structured Interviews**
   - Begin broad: "Tell me about your vision for this product."
   - Probe with "how" and "what" questions
   - Clarify with specific closed questions only when needed
   - End with: "What haven't I asked that I should have?" / "Who else should I talk to?"

2. **Persona-Adapted Question Banks**
   - Pre-built question sets for each stakeholder persona
   - Dynamic adaptation based on detected role, vocabulary, and concerns
   - Department-specific deep-dive modules

3. **5 Whys Integration**
   - When a requirement is stated at surface level, automatically probe deeper
   - Surface the root cause alongside the stated requirement
   - Present both to stakeholders for validation

### 10.4 Data Quality Recommendations

1. **Real-Time Validation**
   - Display extracted requirements for stakeholder confirmation
   - Flag ambiguous statements for clarification
   - Highlight potential conflicts with previously captured requirements

2. **Confidence Scoring**
   - Assign confidence scores to extracted requirements
   - Low-confidence items flagged for human review
   - Stakeholder confirmation increases confidence

3. **Thematic Convergence Dashboard**
   - After N interviews, generate a visualization of themes across stakeholders
   - Show universal themes, department-specific insights, and conflict areas
   - Enable drill-down to source quotes for verification

---

## 11. Conclusion

Conversational AI for requirements gathering is viable today but requires careful design. The most successful implementations — per NN/g's research and Anthropic's production experience — use simple, composable patterns rather than complex frameworks. Voice-first interaction demands tight integration with visual feedback. Leading questions must be systematically avoided in favor of open-ended, neutral probes. Enjoyment comes from microinteractions, visible progress, and conversational flow — not gamification. Cross-department alignment requires explicit conflict detection and human-facilitated resolution.

For st8, the path forward is a **hybrid system**: AI-led interviews for scale and consistency, human oversight for discovery and diplomacy, and rich visual feedback to bridge the voice-first interaction model. The goal is not to replace human product managers but to amplify their ability to gather, synthesize, and align stakeholder input into actionable PRDs.

---

## References

1. Whitenton, K. (2017). "Voice First: The Future of Interaction?" Nielsen Norman Group.
2. Whitenton, K. (2016). "Voice Interaction UX: Brave New World...Same Old Story." Nielsen Norman Group.
3. Gibbons, S. (2022). "Stakeholder Interviews 101." Nielsen Norman Group.
4. Rosala, M. (2026). "AI-Moderated Interviews: If, When, and How to Use Them." Nielsen Norman Group.
5. Rosala, M. (2024). "Open-Ended vs. Closed Questions in User Research." Nielsen Norman Group.
6. Rosala, M. (2022). "How to Analyze Qualitative Data from UX Research: Thematic Analysis." Nielsen Norman Group.
7. Schade, A. (2017). "Avoid Leading Questions to Get Better Insights from Participants." Nielsen Norman Group.
8. Kendrick, A. (2018). "Microinteractions in User Experience." Nielsen Norman Group.
9. Saffer, D. (2014). *Microinteractions.* O'Reilly Media.
10. Anthropic Engineering. (2024). "Building Effective Agents." Anthropic.
11. Sinclair, D. & Pye, W. (2023). "Towards Emotion-Based Synthetic Consciousness: Using LLMs to Estimate Emotion Probability Vectors." arXiv:2310.10673.
