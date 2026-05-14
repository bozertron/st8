# W1-06-TIER5: MetaGPT Multi-Agent PRD Generation System — Deep Research Report

**Research Date:** 2026-05-13  
**Source:** `/home/bozertron/Renderings/Memory and Context Application/Multi-Agent Model - Lots of Agents Features/MetaGPT/`  
**Files Analyzed:**
- `metagpt/actions/write_prd.py` (172 lines)
- `metagpt/actions/write_prd_an.py` (223 lines)
- `metagpt/actions/write_prd_review.py` (31 lines)
- `metagpt/actions/action_node.py` (735 lines)
- `metagpt/utils/file_repository.py` (237 lines)
- `metagpt/roles/product_manager.py` (43 lines)
- `metagpt/actions/action.py` (121 lines)
- `metagpt/actions/action_output.py` (18 lines)

---

## 1. Agent Roles & Collaboration Model

MetaGPT implements a **role-based multi-agent architecture** where each "Role" encapsulates a set of actions and an observation watchlist. For PRD generation, three primary agent roles exist:

### 1.1 ProductManager (Writer)
- **File:** `metagpt/roles/product_manager.py`
- **Role:** Alice, the Product Manager
- **Actions:** `[PrepareDocuments, WritePRD]`
- **Watchlist:** `[UserRequirement, PrepareDocuments]`
- **React Mode:** `BY_ORDER` — executes actions in strict sequence, not reactively
- **Responsibility:** Receives raw user requirements, triages them (bugfix / new / update), and generates or mutates the PRD document.

### 1.2 WritePRD (The Core Action)
- **File:** `metagpt/actions/write_prd.py`
- This is not a standalone agent but an Action class executed by the ProductManager. It contains the triage logic and orchestrates three sub-flows:
  - `_handle_bugfix()` — writes a `bugfix.json` and sends a Message to "Alex" (Engineer)
  - `_handle_new_requirement()` — generates a fresh PRD from `CONTEXT_TEMPLATE`
  - `_handle_requirement_update()` — merges new requirements into existing PRDs via `NEW_REQ_TEMPLATE`

### 1.3 WritePRDReview (Reviewer)
- **File:** `metagpt/actions/write_prd_review.py`
- **Role:** A lightweight review action with a single prompt template
- **Behavior:** Takes a PRD string, formats it into `prd_review_prompt_template`, and returns free-form textual feedback via `_aask()`
- **Integration:** In the broader MetaGPT system, this review output is fed back into the ProductManager's memory/message queue for iterative refinement. However, in the files analyzed, **WritePRDReview is not directly invoked by WritePRD**; it operates as a separate action that other roles can trigger.

### 1.4 WritePRDAN (Analyst / Schema Definition)
- **File:** `metagpt/actions/write_prd_an.py`
- **Role:** Pure schema definition — no runtime logic, only `ActionNode` declarations
- **Responsibility:** Defines the structured fields of a PRD (Product Goals, User Stories, Competitive Analysis, etc.) and provides **refined variants** for incremental updates

### Collaboration Flow
```
UserRequirement → ProductManager → WritePRD.run()
                                    ├── _is_bugfix() → BugFixContext → Engineer ("Alex")
                                    ├── get_related_docs() → _handle_requirement_update()
                                    └── (else) → _handle_new_requirement()
                                          ↓
                                    WritePRDReview (separate role/action)
                                          ↓
                                    Feedback loop (message queue)
```

**Key Insight:** The collaboration is **not a conversation graph** in the PRD subsystem. It is a **pipeline**: PM observes requirement → runs WritePRD → writes to FileRepository. Review exists but is decoupled; it is not a blocking gate in the PRD write flow.

---

## 2. Triage-First Logic

The `WritePRD.run()` method implements a **three-way classifier** executed in strict priority order:

### 2.1 Decision Tree
```python
async def run(self, with_messages, ...):
    req = await self.repo.requirement
    docs = await self.repo.docs.prd.get_all()

    if await self._is_bugfix(req.content):
        return await self._handle_bugfix(req)          # BRANCH 1

    await self.repo.docs.delete(filename=BUGFIX_FILENAME)  # cleanup

    if related_docs := await self.get_related_docs(req, docs):
        return await self._handle_requirement_update(req, related_docs)  # BRANCH 2
    else:
        return await self._handle_new_requirement(req)  # BRANCH 3
```

### 2.2 Bugfix Detection (`_is_bugfix`)
- **Precondition:** `self.repo.code_files_exists()` must be True. If no codebase exists, it can never be a bugfix.
- **Mechanism:** Uses a dedicated `ActionNode` (`WP_ISSUE_TYPE_NODE`) with two child nodes:
  - `ISSUE_TYPE`: constrained to `BUG` / `REQUIREMENT`
  - `REASON`: free-form reasoning string
- **Prompt:** The raw requirement text is passed directly to the LLM via `WP_ISSUE_TYPE_NODE.fill(context, self.llm)`
- **Decision:** Returns `True` only if `node.get("issue_type") == "BUG"`

### 2.3 Related-Document Detection (`get_related_docs`)
- **Mechanism:** Iterates over all existing PRD documents and tests each with `WP_IS_RELATIVE_NODE`
- **Node Structure:**
  - `IS_RELATIVE`: constrained to `YES` / `NO`
  - `REASON`: reasoning
- **Context Template:** `NEW_REQ_TEMPLATE` injects both the **legacy PRD content** and the **new requirement**:
  ```markdown
  ### Legacy Content
  {old_prd}

  ### New Requirements
  {requirements}
  ```
- **Performance Note:** The comment says "refine: use gather to speed up" — current implementation is sequential.

### 2.4 Decision Criteria Summary
| Branch | Criteria | LLM Call |
|--------|----------|----------|
| Bugfix | Code exists + WP_ISSUE_TYPE_NODE says BUG | Yes |
| Update | Existing PRDs + WP_IS_RELATIVE_NODE says YES | Yes (per doc) |
| New | Fallback | No triage LLM call for this branch |

---

## 3. Incremental PRD Updates

### 3.1 NEW_REQ_TEMPLATE
```python
NEW_REQ_TEMPLATE = """
### Legacy Content
{old_prd}

### New Requirements
{requirements}
"""
```
This template is the **core diff engine**. It presents the LLM with both the existing PRD (as JSON or markdown) and the new user requirement, asking it to produce a merged/refined output.

### 3.2 Update Flow (`_handle_requirement_update`)
1. For each related document, call `_merge(req, related_doc)`
2. `_merge()` constructs the prompt from `NEW_REQ_TEMPLATE`
3. Calls `REFINED_PRD_NODE.fill(..., schema=self.prompt_schema)`
4. Overwrites `related_doc.content` with the new JSON model dump
5. Calls `_rename_workspace(node)` to potentially update project name
6. Saves back via `self.repo.docs.prd.save_doc(doc=new_prd_doc)`
7. Re-generates competitive analysis chart (Mermaid quadrant) and PDF

### 3.3 Refined Node Schema (`REFINED_NODES`)
In `write_prd_an.py`, there are **dual node sets**:
- `NODES` (for new PRDs): `Original Requirements`, `Product Goals`, `User Stories`, ...
- `REFINED_NODES` (for updates): `Refined Requirements`, `Refined Product Goals`, `Refined User Stories`, `Refined Requirement Analysis`, `Refined Requirement Pool`

**Pattern:** The refined schema explicitly signals to the LLM that it should **retain legacy content unrelated to the incremental change** while updating/evolving the relevant sections. The instruction for `Refined Requirement Pool` explicitly states: "Cover both legacy content and incremental content. Retain content unrelated to incremental development."

### 3.4 New Requirement Flow (`_handle_new_requirement`)
1. Formats `CONTEXT_TEMPLATE` with project name and requirements
2. Calls `WRITE_PRD_NODE.fill(...)` using the base `NODES` schema
3. Excludes `PROJECT_NAME` if already set
4. Saves as a **new JSON file** with timestamp-based filename via `FileRepository.new_filename() + ".json"`
5. Generates Mermaid quadrant chart and PDF artifact

---

## 4. ActionNode Structured Output System

`ActionNode` is MetaGPT's **most distinctive architectural pattern**. It is a tree-structured prompt compiler that generates Pydantic models dynamically to validate LLM outputs.

### 4.1 Core Abstraction
```python
class ActionNode:
    key: str              # field name (e.g., "Product Goals")
    expected_type: Type   # Python type (str, List[str], etc.)
    instruction: str      # LLM prompt for this field
    example: Any          # in-context learning example
    children: dict[str, ActionNode]  # nested structure
    content: str          # raw LLM output
    instruct_content: BaseModel  # validated Pydantic instance
```

### 4.2 Tree Composition
- **Leaf nodes** define individual fields.
- **Parent nodes** aggregate children via `ActionNode.from_children("WritePRD", NODES)`.
- `WRITE_PRD_NODE` contains 12 child nodes (Language, Programming Language, Original Requirements, Project Name, Product Goals, User Stories, Competitive Analysis, Competitive Quadrant Chart, Requirement Analysis, Requirement Pool, UI Design Draft, Anything UNCLEAR).

### 4.3 Dynamic Pydantic Model Generation
```python
def create_model_class(cls, class_name: str, mapping: Dict[str, Tuple[Type, Any]]):
    # Uses pydantic.create_model() to build a validation class at runtime
    # Registers in a global registry (action_outcls_registry) to avoid duplicate classes
    # Supports nested recursion for tree structures
```

### 4.4 Prompt Compilation Pipeline (`compile()`)
For a given context, ActionNode generates a complete prompt with four sections:
1. **Context** — user/project information
2. **Format Example** — JSON or markdown example wrapped in `[CONTENT]...[/CONTENT]` tags
3. **Instruction** — per-node type + instruction (e.g., `"Product Goals": <class 'list'> # Provide up to three...`)
4. **Constraint** — language matching + format enforcement

**Template used:**
```markdown
## context
{context}
-----
## format example
{example}
## nodes: "<node>: <type>  # <instruction>"
{instruction}
## constraint
{constraint}
## action
Follow instructions of nodes, generate output and make sure it follows the format example.
```

### 4.5 Fill & Validation (`fill()`)
```python
async def fill(self, context, llm, schema="json", mode="auto", strgy="simple"):
    # 1. Compiles prompt
    # 2. Calls LLM via retry decorator (6 attempts, exponential backoff)
    # 3. Parses output: JSON parser for json schema, markdown parser otherwise
    # 4. Validates against dynamically created Pydantic model
    # 5. Stores in instruct_content
```

### 4.6 Review & Revise Loop
ActionNode provides a **self-correcting** mechanism:
- `simple_review(review_mode=ReviewMode.AUTO)` — LLM checks its own output against instructions and flags mismatches
- `auto_revise()` — takes review comments and regenerates only the incorrect keys
- `human_review()` / `human_revise()` — interactive CLI for human feedback

**Pattern Value:** This is not just structured output; it is **self-validating structured output with built-in critique and correction loops**.

---

## 5. CONTEXT_TEMPLATE

### 5.1 Structure
```python
CONTEXT_TEMPLATE = """
### Project Name
{project_name}

### Original Requirements
{requirements}

### Search Information
-
"""
```

### 5.2 Analysis
- **Minimalist design:** Only three sections — project name, requirements, and a placeholder for search info.
- **Search Information is empty:** The `-` suggests this is a stub for future RAG/web search integration that was never fully implemented in this version.
- **No historical memory:** Unlike systems that inject full conversation history, MetaGPT's PRD writer relies on the FileRepository (existing PRD docs) for context, not on message memory.
- **Project Name anchoring:** The template ensures the LLM knows the project identity, which is especially important for `_rename_workspace()` logic.

---

## 6. FileRepository — Version-Controlled Storage

### 6.1 Architecture
`FileRepository` is a **filesystem abstraction layer** backed by a Git repository. It is not a database; it is a structured file manager with dependency tracking.

### 6.2 Key Capabilities
| Method | Purpose |
|--------|---------|
| `save(filename, content)` | Write file + auto-create parent dirs + log |
| `save_doc(doc)` | Wrapper that extracts filename/content from Document |
| `save_pdf(doc)` | Converts JSON content to Markdown via `json_to_markdown`, saves `.md` |
| `get(filename)` | Read file into Document |
| `get_all()` | List all files, optionally filtering ignored files |
| `delete(filename)` | Remove file + clear dependency entry |
| `new_filename()` | Timestamp-based name: `YYYYMMDDHHMMSS` |

### 6.3 Git Integration
- `workdir` resolves to `git_repo.workdir / relative_path`
- `changed_files` property returns files with modification types relative to the repository path
- `get_dependency()` / `get_changed_dependency()` track inter-file dependencies (stored in a separate dependency file managed by GitRepository)

### 6.4 PRD-Specific Storage Pattern
```python
# New PRD
await self.repo.docs.prd.save(
    filename=FileRepository.new_filename() + ".json",
    content=node.instruct_content.model_dump_json()
)

# Update existing PRD
await self.repo.docs.prd.save_doc(doc=new_prd_doc)

# PDF artifact
await self.repo.resources.prd.save_pdf(doc=new_prd_doc)

# Competitive analysis chart
pathname = self.repo.workdir / COMPETITIVE_ANALYSIS_FILE_REPO / Path(prd_doc.filename).stem
await mermaid_to_file(..., quadrant_chart, pathname)
```

**Key Insight:** Every PRD is a **timestamped JSON file**. There is no single `prd.md` that gets overwritten; instead, new requirements create new documents, and updates mutate existing ones in-place. The Git backing provides implicit versioning.

---

## 7. Unique IP — What MetaGPT Does That Others Don't

### 7.1 ActionNode Tree + Dynamic Pydantic Validation
No other PRD system in our research ecosystem (including st8's current design) uses a **recursive tree of prompt nodes that compile into typed Pydantic models at runtime**. This provides:
- Type-safe LLM outputs without hardcoded schemas
- Nested structure support (e.g., `List[List[str]]` for requirement pools)
- Automatic example generation and instruction compilation
- Global registry to deduplicate dynamically generated classes

### 7.2 Self-Critique / Self-Revise Loop
The `auto_review()` and `auto_revise()` methods on ActionNode constitute a **self-healing structured generation** pattern:
1. Generate output
2. Check each field against its own instruction
3. Flag mismatches
4. Regenerate only flagged fields
This is more sophisticated than simple JSON schema validation; it is semantic validation via LLM.

### 7.3 Dual Schema for Incremental Development
The explicit split between `NODES` and `REFINED_NODES` (with `Refined X` variants) is a deliberate pattern for **prompting the LLM to preserve legacy content while integrating deltas**. Most systems either overwrite fully or do naive string concatenation.

### 7.4 Git-Native Document Repository
FileRepository treats the workspace as a content-addressed, versioned store with dependency tracking. This is deeper than "save to disk" — it enables change detection, dependency invalidation, and reproducible builds.

### 7.5 Role-Based Action Observation
The `Role` base class (`watch`, `react_mode`, `observe`) creates a publish-subscribe message bus where agents react to specific message types. Even though ProductManager uses `BY_ORDER` (not reactive), the framework supports `BY_ORDER`, `REACT`, and `PLAN_AND_ACT` modes.

---

## 8. Limitations — Why This Would Not Work Directly for st8

### 8.1 Multi-Agent Overhead for Single-User Tool
MetaGPT is architected for **autonomous software teams** (PM, Architect, Engineer, QA). The PRD subsystem is only 1/6th of the pipeline. For st8 — a personal PRD assistant — the Role/React/MessageBus machinery is excessive. A single orchestrator with conditional logic is simpler and more debuggable.

### 8.2 Heavy Reliance on FileSystem + Git
st8's target environment may not have a Git repository or even a persistent filesystem per-project. FileRepository assumes `git_repo.workdir` exists. Porting this to a database-backed or stateless model would require significant refactoring.

### 8.3 LLM-Only Triage is Expensive and Slow
Every requirement triggers **1-2 LLM calls before any PRD generation**:
1. `_is_bugfix()` — 1 call
2. `get_related_docs()` — N calls (one per existing PRD)
For a user with 50 PRDs, a simple update could require 50+ LLM calls just for triage. The comment "use gather to speed up" acknowledges the performance issue but does not solve the cost issue.

### 8.4 JSON-First PRD Storage
MetaGPT stores PRDs as **machine-readable JSON** (Pydantic dumps), then generates Markdown/PDF as secondary artifacts. For st8, human-editable Markdown is the source of truth. Inverting this would break MetaGPT's ActionNode validation pipeline.

### 8.5 WritePRDReview is Too Lightweight
The review action is a single prompt with no structured output, no checklist, no integration with the PRD schema. It returns free-form text that must be parsed by another agent. st8 needs **structured review** (e.g., scoring, missing-section detection) that can be acted upon deterministically.

### 8.6 Bugfix Branch is a Stub
`_handle_bugfix()` does not actually analyze code. It writes the raw requirement to `bugfix.json` and sends a message to "Alex" (a hardcoded engineer name). The actual bug analysis happens downstream in `FixBug` action. For st8, if we want bug-to-PRD translation, we would need to inline that logic.

### 8.7 ActionNode Complexity
While powerful, ActionNode is 735 lines of metaprogramming (dynamic class creation, recursive trees, prompt compilation, parsing). It is a **framework within a framework**. Adopting it in st8 would add substantial cognitive and maintenance overhead for a benefit (type-safe LLM output) that can be achieved with simpler Pydantic models + instructor/structured output libraries.

---

## 9. Patterns Worth Extracting for st8

| Pattern | st8 Adoption | Notes |
|---------|--------------|-------|
| **Triage-first logic** | YES — simplified | Classify input as bugfix / update / new before generation. Use heuristics or a single cheap LLM call, not N calls. |
| **Legacy + Delta context template** | YES | Present old PRD + new requirement together when updating. This yields better merge quality than simple overwriting. |
| **Structured output with examples** | YES — via Pydantic + instructor | Use Pydantic models for PRD sections with `example=` fields for few-shot prompting. No need for dynamic class creation. |
| **Timestamped document versions** | MAYBE | Instead of overwriting `prd.md`, save iterations with timestamps or Git commits. st8 already uses Git, so this aligns. |
| **Self-review loop** | MAYBE — lightweight | After generation, run a fast structured review (checklist) against the PRD schema. Do not adopt full ActionNode revise complexity. |
| **Competitive analysis as artifact** | NO | Mermaid quadrant charts are cool but niche. Not a core st8 need. |
| **Role-based action bus** | NO | Overkill for a single-user CLI/GUI tool. |

---

## 10. Conclusion

MetaGPT's PRD subsystem is a **sophisticated, framework-heavy implementation** designed for autonomous multi-agent software teams. Its crown jewels are the ActionNode structured output engine and the incremental update context pattern. However, the full architecture — Role message buses, Git-native FileRepository, N+1 triage LLM calls, and dynamic Pydantic metaprogramming — is misaligned with st8's goals of being a lightweight, fast, human-centric PRD assistant.

**Recommended st8 strategy:**
1. Adopt the **triage-first classification** (bugfix / update / new) with a single lightweight LLM call.
2. Adopt the **Legacy Content + New Requirements** template for updates.
3. Use **static Pydantic models** (not dynamic) for structured PRD generation.
4. Skip the multi-agent Role framework entirely.
5. Borrow the **versioned save** concept (timestamped backups or Git commits) but keep Markdown as the source of truth.
