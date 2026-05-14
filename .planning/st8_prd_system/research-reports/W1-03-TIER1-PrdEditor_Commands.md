# W1-03 TIER1 Research Report: PRD Editor Commands & parse-prd Bridge

**Date:** 2026-05-13
**Agent:** st8 Research Agent
**Scope:** Rust backend PRD commands, TaskMaster parse-prd CLI algorithm, research-enhanced mode, and CLI variants across IDEs.

---

## 1. Rust Backend Commands (`prd_commands.rs`)

**Source File:**
`/home/bozertron/Software Projects/orchestr8 Integration Staging/CLAUDE INTEGRATION PRE FIX/src-tauri/src/commands/prd_commands.rs` (201 lines)

The Rust backend exposes six PRD-related functions. At the time of reading, **five are stubs** and only two pieces of logic are actually implemented (diffing and internal fetch).

### 1.1 Command Surface

| Command | Signature | Status | What It Does |
|---------|-----------|--------|--------------|
| `get_current_prd` | `async fn get_current_prd(project_id: i64, _state: State<'_, AppState>) -> CommandResult<Option<PrdVersion>>` | **STUB** | Intended to fetch the current live PRD version for a project. Currently logs and returns `Ok(None)`. |
| `create_initial_prd` | `async fn create_initial_prd(project_id: i64, prd_data: JsonValue, user_id: String, _state: State<'_, AppState>) -> CommandResult<PrdVersion>` | **STUB** | Intended to insert the first PRD version. Returns a mock `PrdVersion` with `version_id: 1`, `is_current_live: true`, and the supplied `prd_data`. |
| `propose_prd_update` | `async fn propose_prd_update(project_id: i64, based_on_version_id: i64, _proposed_prd_data: JsonValue, _user_id: String, _state: State<'_, AppState>) -> CommandResult<ProposalResult>` | **STUB** | Intended to compare proposed data against a base version and create a change request if differences exist. Returns `ProposalOutcome::NoChangesDetected`. |
| `add_prd_field` | `async fn add_prd_field(project_id: i64, field_definition: NewFieldDefinition, _state: State<'_, AppState>) -> CommandResult<()>` | **STUB** | Intended to add a field definition to the PRD structure (either via change request or direct draft modification). Currently no-op. |
| `add_prd_version` | `async fn add_prd_version(_data: NewPrdVersionData, _state: State<'_, AppState>) -> CommandResult<i64>` | **STUB** | Returns `CommandError::NotImplemented` explicitly. |
| `diff_prd_data` | `pub fn diff_prd_data(current_fields_val: &JsonValue, proposed_fields_val: &JsonValue) -> Option<JsonValue>` | **IMPLEMENTED** | Compares two PRD JSON blobs (specifically their `fields` objects), ignoring `_meta` and `_schema`. Returns `None` if no changes, or `Some(JsonValue)` containing only changed fields. Detects additions and modifications; logs warnings for deletions but does not capture them in the diff map. |
| `get_prd_version_by_id_internal` | `pub async fn get_prd_version_by_id_internal(state: &AppState, version_id: i64) -> CommandResult<PrdVersion>` | **IMPLEMENTED** | Queries `PRD_Versions` by ID, deserializes `prd_data` from JSON text, and returns a full `PrdVersion` struct. Maps `QueryReturnedNoRows` to `CommandError::NotFound`. |

### 1.2 Types Used

From `models.rs`:
- `PrdVersion` — `{ version_id: i64, project_id: i64, timestamp: String, approved_by_user_id: String, based_on_version_id: Option<i64>, prd_data: Value, is_current_live: bool }`
- `ProposalResult` — `{ outcome: ProposalOutcome, message: String }`
- `ProposalOutcome` — enum: `NoChangesDetected` or `ChangeRequestCreated(i64)`
- `NewFieldDefinition` — `{ field_key: String, label: String, field_type: String, description: Option<String>, default_value: Option<String> }`
- `NewPrdVersionData` — `{ project_id: i64, approved_by_user_id: String, based_on_version_id: Option<i64>, prd_data: Value, is_current_live: bool }`

---

## 2. Database Schema Implied

**Source File:**
`/home/bozertron/Software Projects/orchestr8 Integration Staging/CLAUDE INTEGRATION PRE FIX/src-tauri/src/database/schema.rs`

The Rust commands reference the following canonical tables:

### 2.1 `PRD_Versions`
```sql
CREATE TABLE PRD_Versions (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    approved_by_user_id TEXT,           -- NULL allowed
    based_on_version_id INTEGER,        -- NULL allowed (self-referential FK)
    prd_data TEXT NOT NULL,             -- JSON blob
    is_current_live BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (based_on_version_id) REFERENCES PRD_Versions(version_id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX idx_prd_versions_live ON PRD_Versions(project_id, is_current_live) WHERE is_current_live = TRUE;
CREATE INDEX idx_prd_versions_project ON PRD_Versions(project_id);
```

### 2.2 `Change_Requests`
```sql
CREATE TABLE Change_Requests (
    change_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    target_prd_version_id INTEGER NOT NULL,
    proposed_by_user_id TEXT NOT NULL,
    proposal_timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    proposed_changes TEXT NOT NULL,     -- JSON diff
    status TEXT NOT NULL CHECK(status IN ('PendingAssessment', 'PendingFeedback', 'PendingDecision', 'Approved', 'Rejected', 'Cancelled')) DEFAULT 'PendingAssessment',
    assessment_details TEXT,            -- JSON
    feedback_log TEXT,                  -- JSON array
    decision_details TEXT,              -- JSON
    resulting_prd_version_id INTEGER,   -- NULL until approved
    FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (target_prd_version_id) REFERENCES PRD_Versions(version_id) ON DELETE CASCADE,
    FOREIGN KEY (resulting_prd_version_id) REFERENCES PRD_Versions(version_id) ON DELETE SET NULL
);
CREATE INDEX idx_cr_project_status ON Change_Requests(project_id, status);
CREATE INDEX idx_cr_target_version ON Change_Requests(target_prd_version_id);
```

### 2.3 Supporting Tables
- **`Projects`** — `project_id`, `project_name`, `created_timestamp`
- **`Users`** — `user_id`, `user_type`, `display_name`, `created_timestamp`
- **`Workflow_Definitions`** / **`Workflow_Steps`** / **`Workflow_Instances`** / **`Workflow_Step_Instances`** — Refined workflow engine tables supporting LLM, Human, Decision, Webhook, NoirVerification, MCPTool, Start/End/Branch/Merge step types.

**Key Observations:**
- The schema supports **version chaining** via `based_on_version_id`.
- Only **one live PRD per project** is enforced by a partial unique index.
- Change requests store a **JSON diff** (`proposed_changes`), not full copies.
- Status is managed through a strict CHECK constraint with six states.

---

## 3. parse-prd Algorithm (TaskMaster CLI)

**Source Files:**
- `/home/bozertron/Software Projects/Orchestr8_jr/.claude/commands/tm/parse-prd.md`
- `/home/bozertron/Software Projects/Orchestr8_jr/.cursor/commands/tm/parse-prd.md`
- `/home/bozertron/Software Projects/Orchestr8_jr/.gemini/commands/tm/parse-prd.toml`
- `/home/bozertron/Software Projects/Orchestr8_jr/.roo/commands/tm-parse-prd.md`
- `/home/bozertron/Software Projects/Orchestr8_jr/.opencode/command/tm-parse-prd.md`

The CLI command files are **wrappers/declarations**, not the core TaskMaster engine implementation. They document the algorithm and invoke `task-master parse-prd` with appropriate flags.

### 3.1 What It Extracts from a PRD
1. **Key requirements** — functional and non-functional requirements
2. **Technical components** — systems, modules, APIs, databases, external services
3. **Dependencies** — what must exist before other things can be built
4. **Complexity estimates** — implicit sizing for task breakdown

### 3.2 How It Generates Tasks
1. **Default scope:** 10-15 tasks
2. **Task categories:**
   - Implementation tasks
   - Testing tasks
   - Documentation tasks
3. **Logical dependency chaining** between tasks

### 3.3 How It Detects Dependencies
- Inferred from PRD structure (e.g., "Deliverable A must come before Deliverable B")
- Technical ordering (schema before API, API before UI)
- Logical dependency chain described in the PRD's roadmap/development sections

### 3.4 How It Estimates Complexity
- The wrapper files do not expose an explicit complexity formula. Complexity estimation is handled internally by the `task-master` CLI engine.
- From the PRD content, the engine likely uses:
  - Scope breadth (number of features)
  - Technical novelty (new vs. existing patterns)
  - Integration surface area (external APIs, cross-runtime bridges)

### 3.5 Output Format
The command produces:
1. A **task summary** (displayed to user)
2. A **dependency graph** (visualized)
3. **Sprint planning recommendations**
4. Suggestions for **task expansion** on complex items

### 3.6 CLI Options / Modifiers
- Number after filename → `--num-tasks` (custom task count)
- `research` keyword → `--research` flag (research-enhanced mode)
- `comprehensive` keyword → generates more tasks

---

## 4. Research-Enhanced Mode (`parse-prd-with-research`)

**Source Files:**
- `/home/bozertron/Software Projects/Orchestr8_jr/.claude/commands/tm/parse-prd-with-research.md`
- Corresponding variants in `.cursor/`, `.gemini/`, `.roo/`, `.opencode/`

### 4.1 What It Adds
Research mode appends the `--research` flag to the CLI invocation:
```bash
task-master parse-prd --input=$ARGUMENTS --research
```

### 4.2 Perplexity Integration
The documentation states it "uses the research AI provider (typically Perplexity) for more comprehensive task generation with current best practices."

The research provider is configured in `.taskmaster/config.json`:
```json
"research": {
  "provider": "zai-coding",
  "modelId": "glm-4.6",
  "maxTokens": 204800,
  "temperature": 0.1
}
```
Note: The documentation mentions Perplexity as typical, but the actual config shows `zai-coding` / `glm-4.6`.

### 4.3 Research Benefits
1. **Current Best Practices**
   - Latest framework patterns
   - Security considerations
   - Performance optimizations
   - Accessibility requirements
2. **Technical Deep Dive**
   - Implementation approaches
   - Library recommendations
   - Architecture patterns
   - Testing strategies
3. **Comprehensive Coverage**
   - Edge cases consideration
   - Error handling tasks
   - Monitoring setup
   - Deployment tasks

### 4.4 Enhanced Output
- More detailed tasks
- Industry standards included
- Compliance considerations added
- Modern tooling suggested

### 4.5 When to Use
- New technology domains
- Complex requirements
- Regulatory compliance needed
- Best practices crucial

---

## 5. CLI Variants Across IDEs

All five IDE/agent directories contain functionally **identical content**, differing only in wrapper format:

| IDE/Agent | Directory | File Format | Wrapper Differences |
|-----------|-----------|-------------|---------------------|
| **Claude** | `.claude/commands/tm/` | Markdown | Title line + standard sections |
| **Cursor** | `.cursor/commands/tm/` | Markdown | Slightly abbreviated header (no "Parse PRD" title in base version) |
| **Gemini** | `.gemini/commands/tm/` | TOML | `description="..."` field + `prompt = """..."""` block |
| **Roo** | `.roo/commands/` | Markdown | YAML frontmatter with `description:` and `argument-hint:` |
| **OpenCode** | `.opencode/command/` | Markdown | YAML frontmatter with `description:` only (no `argument-hint`) |

**Key Insight:** The content (parsing process, options, post-generation steps) is **byte-for-byte identical** across all variants. Only the metadata envelope changes to satisfy each IDE's command-discovery mechanism. This indicates a **single source of truth** for the parse-prd algorithm, with format adapters per target platform.

---

## 6. The PRD → Tasks Bridge Pattern

### 6.1 The Full Algorithm

```
INPUT: PRD file path + optional modifiers
  |
  v
[Argument Parsing]
  - Number → --num-tasks
  - "research" → --research flag
  - "comprehensive" → expand scope
  |
  v
[CLI Execution]
  task-master parse-prd --input=<path> [--research]
  |
  v
[Phase 1: Document Analysis]
  - Extract key requirements
  - Identify technical components
  - Detect dependencies
  - Estimate complexity
  |
  v
[Phase 2: Task Generation]
  - Create 10-15 tasks (default)
  - Include implementation tasks
  - Add testing tasks
  - Include documentation tasks
  - Set logical dependencies
  |
  v
[Phase 3: Smart Enhancements]
  - Group related functionality
  - Set appropriate priorities
  - Add acceptance criteria
  - Include test strategies
  |
  v
[Phase 4: Post-Generation]
  - Display task summary
  - Show dependency graph
  - Suggest task expansion for complex items
  - Recommend sprint planning
  |
  v
OUTPUT: Task list with dependencies, priorities, and acceptance criteria
```

### 6.2 Why the Bridge Matters

The PRD → Tasks bridge is the **critical handoff** between product definition and execution. Without it:
- PRDs remain static documents that engineers must manually translate
- Dependencies are discovered late (during implementation), causing blockers
- Testing and documentation are often forgotten
- Sprint planning lacks structured input

With the bridge:
- **Requirements become executable** — every PRD section maps to one or more tasks
- **Dependencies are explicit** — the dependency graph prevents "blocked" sprints
- **Quality is built-in** — testing and documentation tasks are generated automatically
- **Complexity is surfaced early** — the engine suggests expansion for items that are too large

### 6.3 Integration with the Rust Backend

The Rust backend (`prd_commands.rs`) and the TaskMaster CLI operate in **complementary but separate domains**:
- **Rust backend** manages PRD **versions**, **change requests**, and **approval workflows** (the "what is the current truth?" layer)
- **TaskMaster CLI** converts a PRD into an **execution plan** (the "how do we build it?" layer)

The missing integration point is a bridge from an **approved PRD version** (stored in `PRD_Versions` with `is_current_live = true`) into the TaskMaster parse-prd input pipeline. A future integration would:
1. Fetch the current live PRD via `get_current_prd(project_id)`
2. Export it to a markdown file
3. Invoke `task-master parse-prd --input=<exported_prd>`
4. Store generated tasks in the database (likely linking to `Workflow_Step_Instances` or a new `Tasks` table)

---

## 7. Observations & Gaps

1. **Heavy stubbing in Rust:** 5 of 6 PRD commands are stubs. The diffing logic is the only production-ready code path.
2. **No `Tasks` table:** The schema has workflows and step instances, but no explicit `Tasks` table for TaskMaster output. This is a likely future migration.
3. **Research provider mismatch:** Documentation says "typically Perplexity" but config uses `zai-coding` / `glm-4.6`.
4. **No deletion tracking in diff:** `diff_prd_data` logs warnings for deleted fields but does not represent deletions in the returned diff map. This is a known limitation.
5. **IDE parity:** All CLI variants are content-identical; maintenance could be simplified with a generator or symlink strategy.

---

## 8. File Inventory (Absolute Paths)

### Rust Backend
- `/home/bozertron/Software Projects/orchestr8 Integration Staging/CLAUDE INTEGRATION PRE FIX/src-tauri/src/commands/prd_commands.rs`
- `/home/bozertron/Software Projects/orchestr8 Integration Staging/CLAUDE INTEGRATION PRE FIX/src-tauri/src/models.rs`
- `/home/bozertron/Software Projects/orchestr8 Integration Staging/CLAUDE INTEGRATION PRE FIX/src-tauri/src/database/schema.rs`

### TaskMaster CLI (Claude)
- `/home/bozertron/Software Projects/Orchestr8_jr/.claude/commands/tm/parse-prd.md`
- `/home/bozertron/Software Projects/Orchestr8_jr/.claude/commands/tm/parse-prd-with-research.md`

### TaskMaster CLI (Cursor)
- `/home/bozertron/Software Projects/Orchestr8_jr/.cursor/commands/tm/parse-prd.md`
- `/home/bozertron/Software Projects/Orchestr8_jr/.cursor/commands/tm/parse-prd-with-research.md`

### TaskMaster CLI (Gemini)
- `/home/bozertron/Software Projects/Orchestr8_jr/.gemini/commands/tm/parse-prd.toml`
- `/home/bozertron/Software Projects/Orchestr8_jr/.gemini/commands/tm/parse-prd-with-research.toml`

### TaskMaster CLI (Roo)
- `/home/bozertron/Software Projects/Orchestr8_jr/.roo/commands/tm-parse-prd.md`
- `/home/bozertron/Software Projects/Orchestr8_jr/.roo/commands/tm-parse-prd-with-research.md`

### TaskMaster CLI (OpenCode)
- `/home/bozertron/Software Projects/Orchestr8_jr/.opencode/command/tm-parse-prd.md`
- `/home/bozertron/Software Projects/Orchestr8_jr/.opencode/command/tm-parse-prd-with-research.md`

### TaskMaster Config
- `/home/bozertron/Software Projects/Orchestr8_jr/.taskmaster/config.json`

---

*End of Report*
