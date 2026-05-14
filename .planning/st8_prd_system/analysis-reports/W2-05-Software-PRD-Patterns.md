# W2-05 Research Report: Software PRD Patterns & Best Practices

**Date:** 2026-05-13
**Researcher:** Domain Research Agent (st8 PRD System)
**Sources:** Atlassian Agile Blog, Basecamp Shape Up (Chapters 2-6), SVPG/Marty Cagan, Amazon Leadership Principles, Stripe Engineering Blog, industry literature synthesis

---

## 1. Industry Standards — What Leading Tech Companies Include in PRDs

### The Classic PRD Template (Atlassian, et al.)
The traditional Product Requirements Document has evolved from waterfall monstrosities into agile-aligned "landing pages." Atlassian's widely-cited template includes:

- **Project specifics** — context, goals, success metrics
- **User personas / assumptions** — who this is for and why
- **User stories** — what users need to do
- **Design / UX considerations** — wireframes, mockups, flows
- **Out-of-scope items** — what is explicitly NOT included
- **Release criteria / definition of done**

Atlassian emphasizes: "Never write a product requirements document by yourself -- you should always have a developer with you and write it together." The PRD becomes a "landing page" for everything related to an epic, with embedded links abstracting complexity and progressively disclosing information.

### The Shape Up "Pitch" (Basecamp / 37signals)
Basecamp rejects the term PRD entirely in favor of a **Pitch** -- a shaped proposal with exactly five ingredients:

1. **Problem** -- The raw idea, use case, or observed behavior motivating the work
2. **Appetite** -- How much time we want to spend (not an estimate; a budget)
3. **Solution** -- Core elements at the right level of abstraction
4. **Rabbit Holes** -- Details worth calling out to avoid problems
5. **No-Gos** -- What is specifically excluded to fit the appetite

Basecamp's pitches are "rough, solved, and bounded" -- they leave room for designers and engineers to apply expertise, but provide guardrails so teams don't wander or get stuck.

### The Amazon "Working Backwards" Approach
Amazon's famous alternative: before writing a PRD, write the **press release** and **FAQ** as if the product has already launched. This forces customer-centric thinking from the outset. If the press release isn't compelling, the product shouldn't be built. The PRD (if one exists) is derived from this narrative rather than driving it.

### SVPG / Marty Cagan: "Product Discovery" Over Requirements
Silicon Valley Product Group (Marty Cagan) argues that the very concept of "gathering requirements" is flawed. Product managers are **not requirement gatherers or backlog managers**. Instead, they lead **product discovery** -- a creative process to discover a solution that is:
- **Valuable** (customers will buy/use it)
- **Viable** (works for the business)
- **Usable** (users can figure it out)
- **Feasible** (can be built with available technology)

In this model, the "spec" is whatever artifact helps the team validate these four risks before committing engineering resources.

---

## 2. PRD Anti-Patterns — What Makes PRDs Fail

### The "Spec'd Out Before Engineering" Anti-Pattern
Atlassian explicitly warns: "The entire project is already spec'd out in great detail before any engineering work begins" is an anti-pattern. This destroys shared understanding and treats the PRD as a contract rather than a conversation starter.

### Wireframes That Are Too Concrete
Basecamp's Ryan Singer notes that wireframes and high-fidelity mockups in specs "leave designers no room for creativity" and lead to estimation errors because "making the interface just so can require solving hidden complexities... When the scope isn't variable, the team can't reconsider a design decision that is turning out to cost more than it's worth."

### Words That Are Too Abstract
The opposite extreme: projects defined in "a few words" like "Build a calendar view" or "add group notifications." Nobody knows what it means. Team members can't make trade-offs. Programmers have to be "mind readers."

### The "Grab-Bag" Project
Basecamp identifies "redesigns" or "refactorings" not driven by a single problem as "grab-bags." A tell-tale sign is the "2.0" label. Without a specific problem, "we don't know what 'done' looks like."

### The Requirements-First Fallacy (SVPG)
Marty Cagan: "This notion of requirements and design as a sequential, predictable and scheduled phase in a product development process is so ingrained in our industry that it's often one of the most difficult habits for product organizations to break." Teams schedule discovery like "planning the construction of a house," then use the full engineering team to build "a very, very expensive prototype" and use live customers as "unwitting test subjects."

### The Immutable Document
PRDs that are written once and never updated become liabilities. Atlassian emphasizes that PRDs should be "regularly updated" and that commenting, asking questions, and encouraging contributions -- especially on distributed teams -- is essential.

### Solution-Without-Problem
Basecamp: "Diving straight into 'what to build' -- the solution -- is dangerous. Without a specific problem, there's no test of fitness to judge whether one solution is better than the other."

### Problem-Without-Solution
Equally dangerous: "We really need to make it easier to find things." A problem without a solution is "unshaped work." Giving it to a team means "pushing research and exploration down to the wrong level, where the skillsets, time limit, and risk profile are all misaligned."

---

## 3. Modern Approaches — How PRDs Have Evolved

### From Documents to Conversations
The dominant trend is a shift from **comprehensive specifications** to **conversation starters**. Modern PRDs/pitches/specs are:
- **Living documents** (not signed-off contracts)
- **Collaboratively authored** (not solo PM work)
- **Visually rich** (sketches, breadboards, embedded media)
- **Bounded by appetite** (time-constrained, not scope-constrained)

### Fixed Time, Variable Scope (Basecamp)
The most counter-intuitive modern principle: instead of estimating how long a fixed scope will take, define how much time you're willing to spend (the appetite) and let the scope vary to fit. "An appetite is completely different from an estimate. Estimates start with a design and end with a number. Appetites start with a number and end with a design."

### No Backlogs (Basecamp)
Basecamp explicitly rejects backlogs. "Important ideas come back." Instead of maintaining an ever-growing backlog, keep a small pool of potential bets. This prevents the psychological weight of unfinished work and forces prioritization.

### Product Discovery as a Separate Track (SVPG)
Modern product organizations run **two tracks simultaneously**: product discovery (figuring out what to build) and product delivery (building it). The discovery track is "closed-door, creative work" that happens one cycle ahead of delivery.

### Documentation as Data (Stripe)
Stripe's Markdoc approach treats documentation as structured data (ASTs) rather than freeform prose. This enables validation, programmatic manipulation, and consistency at scale. For PRDs, this suggests value in structured formats over ad-hoc documents.

### The "Press Release" Format (Amazon)
Starting with customer-facing narrative rather than technical specification. The PRD answers: what would we tell the world about this? If we can't write a compelling press release, we shouldn't build it.

---

## 4. Template Analysis — Common Sections and What They Optimize For

| Template | Core Sections | Optimizes For |
|----------|--------------|---------------|
| **Classic PRD** (Atlassian) | Goals, user stories, design, out-of-scope, release criteria | Alignment, traceability, completeness |
| **Shape Up Pitch** (Basecamp) | Problem, appetite, solution, rabbit holes, no-gos | Clarity, boundedness, decision-making |
| **Amazon PR/FAQ** | Press release, customer FAQs, internal FAQs | Customer centricity, narrative coherence |
| **SVPG Discovery Spec** | Problem statement, hypothesis, prototype, validation plan | Risk reduction, evidence gathering |
| **One-Pager** (various) | Problem, success metric, solution sketch, open questions | Speed, readability, executive decision-making |

### What Modern Templates Share
Despite surface differences, effective modern specs almost always include:
1. **A specific problem** tied to a real user/customer story
2. **A clear constraint** (time, scope, or resource)
3. **An indication of what is out of scope**
4. **Success metrics or definition of done**
5. **Visual elements** (sketches, screenshots, diagrams)
6. **Acknowledgment of unknowns** (rabbit holes, open questions)

---

## 5. The Human Factor — What Makes Stakeholders Actually READ and USE a PRD

### "Intimate, Not Sterile" — Insights from Research

**Length and scannability matter.** Atlassian's approach of embedding links and keeping the PRD as a "landing page" works because it respects readers' time. Basecamp's pitches are typically 1-3 pages with embedded visuals.

**Visuals over text.** Basecamp uses "fat marker sketches" (very low-fidelity UI sketches) and "breadboards" (UI concepts showing affordances and connections without visual styling). These communicate more effectively than paragraphs of text and are explicitly "rough" so designers don't feel constrained.

**Asynchronous by default.** Basecamp posts pitches as messages in a dedicated team area. Stakeholders comment asynchronously. "We prefer asynchronous communication by default and escalate to real-time only when necessary. This gives everyone the maximum amount of time under their own control for doing real work."

**Co-authorship creates ownership.** Atlassian: "Never write a product requirements document by yourself -- you should always have a developer with you and write it together." When engineers and designers contribute to the spec, they are invested in it.

**Context, not control.** Effective specs provide enough context for teams to make good decisions, but don't over-specify. Basecamp: "The roughness leaves room for the team to resolve all the details, while the solution and boundaries act like guard rails."

**A compelling problem story.** The best specs start with a story that shows why the status quo doesn't work. Basecamp: "The best problem definition consists of a single specific story that shows why the status quo doesn't work. This gives you a baseline to test fitness against."

---

## 6. PRD vs. Other Docs — Relationship Map

| Document | Purpose | Relationship to PRD |
|----------|---------|-------------------|
| **PRD / Pitch / Spec** | What problem to solve and why; boundaries of the solution | The "north star" document |
| **Technical Spec / Architecture Doc** | How to build it; system design, data models, APIs | Derived from PRD; engineering-owned |
| **API Spec** | Contract for programmatic interfaces | May be part of technical spec; referenced by PRD |
| **User Stories** | Granular user-facing functionality | Often derived from PRD; live in backlog |
| **Design System / Mockups** | Visual and interaction details | Designer's domain; PRD should not over-specify |
| **Test Plan / QA Criteria** | How to verify correctness | Derived from PRD success criteria |
| **Product Strategy / Roadmap** | Why this, why now, relative priority | PRD executes a slice of strategy |
| **Release Notes / Changelog** | What shipped | Should be derivable from PRD + commits |

### Key Insight: The PRD Should Not Be a Design Document
Basecamp is explicit: wireframes are "too concrete" for the pitch stage. The PRD/pitch defines the problem, appetite, and solution elements at the right level of abstraction. Design details belong to designers. Technical details belong to engineers.

---

## 7. Collaborative PRD Writing — Tools and Practices

### Co-Authoring Practices
- **Write together, never alone.** Atlassian pairs PMs with engineers during spec writing.
- **Closed-door shaping, open feedback.** Basecamp does shaping work privately (1-2 people), then posts the pitch for async comment before the betting table.
- **Comment culture.** Atlassian: "Comment, ask questions, encourage others to contribute with thoughts and ideas."
- **Present to technical experts before finalizing.** Basecamp recommends a "friendly-conspiratorial" walkthrough with technical experts to find "time bombs" before betting.

### Tools in Use
- **Confluence / Notion / Coda** -- Collaborative docs with templates and commenting
- **Basecamp** -- Message boards for pitches with embedded images and threaded comments
- **Figma** -- For visual specs and design collaboration (though Basecamp warns against too-early high-fidelity)
- **GitHub / GitLab Issues & Wikis** -- For engineering-integrated specs
- **Linear / Jira** -- For linking specs to execution

### The Async-First Rule
Both Atlassian and Basecamp emphasize asynchronous communication. Real-time meetings should be the exception, not the default. Pitches posted for pre-read make "the betting table short and productive."

---

## 8. Surprising and Counter-Intuitive Findings

1. **The more specific the spec, the harder it can be to estimate.** Counter-intuitively, detailed wireframes hide implementation complexity. Rough sketches make uncertainty visible.

2. **No backlogs.** Basecamp's explicit rejection of backlogs -- "Important ideas come back" -- challenges decades of agile orthodoxy.

3. **Requirements are discovered, not gathered.** SVPG's framing that PMs are "not requirement gatherers" inverts the traditional PM identity.

4. **Fixed time, variable scope is more stable than fixed scope, variable time.** Most organizations do the opposite and suffer constant deadline slips.

5. **A spec without a problem is dangerous; a problem without a solution is unready.** Both extremes are common anti-patterns.

6. **The best specs are written *before* the team sees them, by a separate shaping track.** Basecamp's "two tracks" model means the spec authors are not the builders -- reducing pressure to commit to half-baked ideas.

7. **"Good" is relative to appetite.** There is no absolute "best" solution -- only the best solution given how much time you're willing to spend.

8. **Documentation treated as data (ASTs) enables automated validation.** Stripe's Markdoc approach suggests PRDs could be validated for structural completeness, link correctness, and style consistency programmatically.

---

## 9. Specific Recommendations for the st8 PRD System

Based on this research, the st8 PRD system should:

1. **Embrace the "Pitch" model over the traditional PRD.** A lean, bounded document (problem, appetite, solution, exclusions) is more effective than a comprehensive template. Support multiple formats but optimize for the pitch structure.

2. **Enforce the Problem-First rule.** Every PRD must articulate a specific user/customer problem with a baseline story before any solution is discussed. Reject solution-only specs.

3. **Make "Appetite" a first-class field.** Not an estimate -- a time budget. This enables fixed-time, variable-scope planning.

4. **Make "Out of Scope / No-Gos" mandatory.** What's excluded is as important as what's included. This is critical for the "intimate, not sterile" vision -- it shows the author made hard choices.

5. **Support rich embeds (sketches, screenshots, videos).** Text-only PRDs are less effective. The system should make it easy to embed visual context at low fidelity.

6. **Design for async collaboration.** Comment threads, @mentions, suggestion mode -- not just a static document. The PRD is a conversation.

7. **Link, don't duplicate.** The PRD should be a "landing page" that links to user stories, design files, technical specs, and data. It abstracts complexity rather than containing it.

8. **Track "Rabbit Holes" explicitly.** Call out known unknowns and potential traps. This builds trust and shows thoughtfulness.

9. **Distinguish between "shaping" (private/draft) and "betting" (shared/committed) states.** Not all early ideas should be visible to the whole team. Support draft/published workflows.

10. **Validate structure programmatically.** Taking inspiration from Stripe's Markdoc, the system could enforce that required sections exist, links are valid, and anti-patterns (e.g., no problem stated) are flagged.

11. **Co-authorship features.** Make it obvious and easy for engineers, designers, and stakeholders to contribute directly to the PRD, not just comment on it.

12. **Living document model.** PRDs should have clear versioning and update history. An outdated PRD is worse than no PRD.

---

## Sources & References

- Atlassian. "How to create a product requirements document (PRD)." https://www.atlassian.com/agile/product-management/requirements
- Basecamp / Ryan Singer. *Shape Up: Stop Running in Circles and Ship Work that Matters.* https://basecamp.com/shapeup (Chapters 1-6)
- Silicon Valley Product Group / Marty Cagan. "Product Discovery." https://www.svpg.com/product-discovery/
- Silicon Valley Product Group / Marty Cagan. "Product Management: An Introduction." https://www.svpg.com/product-management-an-introduction/
- Amazon. "Leadership Principles" (Working Backwards). https://www.amazon.jobs/content/en/our-workplace/leadership-principles
- Stripe Engineering / Ryan Paul. "How Stripe builds interactive docs with Markdoc." https://stripe.com/blog/markdoc
- Bryar, Colin and Carr, Bill. *Working Backwards: Insights, Stories, and Secrets from Inside Amazon.* (2021)
- Cagan, Marty. *Inspired: How to Create Tech Products Customers Love.* (2018, 2nd ed.)
- Torres, Teresa. *Continuous Discovery Habits.* (2021)
