# W1-02-TIER1: PrdGenerator Deep Research Report

**Research Date:** 2026-05-13
**Sources Analyzed:**
1. `/home/bozertron/Software Projects/Orchestr8_jr/one integration at a time/Staging/Connection - Files/prdPlanning.md` (1,528 lines)
2. `/home/bozertron/Software Projects/Dev Tools/orchestr8_unpack/orchestr8_extracted/orchestr8/src/views/PrdGenerator.vue` (731 lines)
3. `/home/bozertron/Software Projects/stereOS/IP for actu8/prdDefinitions.ts` (152 lines)
4. `/home/bozertron/Software Projects/stereOS/IP for actu8/PrdEditor.vue` (266 lines)
5. `/home/bozertron/Software Projects/stereOS/IP for actu8/PrdGenerator.vue` (446 lines)

---

## 1. Complete Component API

### Orchestr8 PrdGenerator.vue (731 lines) -- The Working Implementation

**Props:** None (self-contained view component)

**Emits:** None (uses router navigation and message API)

**Reactive State (Refs):**
- `selectedParserType: Ref<string | null>` -- Currently selected parser/generator type
- `isLoading: Ref<boolean>` -- Loading state for async Tauri operations
- `formRef: Ref<FormInst | null>` -- Naive UI form instance reference
- `generationStatus: Ref<GenerationStatus | null>` -- Status message object for user feedback
- `formModel: Ref<FormModel>` -- Complete reactive form state

**Computed Properties:**
- `selectedParser: ParserTypeInfo | undefined` -- Full info object for current parser type
- `derivedOutputDir: string` -- Dynamically calculated output directory based on parser type + compare mode
- `isComparisonAvailable: boolean` -- Whether current parser supports comparison
- `generatedCliCommand: string` -- Live-generated CLI command string for display/copy

**Methods:**
- `selectParserType(type: string): void` -- Switch parser type, reset relevant fields
- `closeView(): void` -- Navigate to home route (`/`)
- `selectPath(field, options): Promise<void>` -- Open Tauri file dialog, update form field
- `runGenerationCommand(): Promise<void>` -- Validate, build payload, invoke Tauri backend
- `copyCommand(): Promise<void>` -- Copy generated CLI string to clipboard
- `resetForm(): void` -- Reset all form fields to defaults
- `renderFilePathLabel(option): VNode` -- Render helper for file path tags in select

**Watchers:**
- `watch(selectedParserType)` -- Reset type-specific fields on parser change
- `watch(() => formModel.value.comparePath)` -- Log compare path changes (triggers computed re-evaluation)

---

## 2. Parser Type Selection

### Parser Types Defined in `parserTypes` Array

| Type | Label | Output SubDir | Supports Compare | CLI Command | What It Extracts |
|------|-------|---------------|------------------|-------------|------------------|
| `overview` | Overview | `01_overview` | Yes | `scaffold` | High-level project architecture, component relationships, system structure |
| `stores` | Stores | `03_stores` | Yes | `scaffold` | Pinia/Vuex store definitions, state management patterns, store interactions |
| `routes` | Routes | `05_routes` | Yes | `scaffold` | Vue Router route definitions, navigation paths, route guards, lazy loading |
| `commands` | Commands | `07_commands` | No | `scaffold` | Tauri backend command definitions, IPC interfaces, command signatures |
| `types` | Types | `08_types` | Yes | `scaffold` | TypeScript interfaces, type aliases, enums, generic definitions |
| `ui` | UI | `10_ui` | Yes | `scaffold` | UI component patterns, component libraries used (e.g., NaiveUI), UI structure |
| `files` | Files | `12_files` | No | `scaffold` | Specific file contents by index or path, file-level documentation |
| `generate-ui` | UI Gen | `13_uiGen` | No | `generate-ui` | Generates new UI components/scaffolding (code generation, not analysis) |
| `generate-backend` | BE Gen | `14_backendGen` | No | `generate-backend` | Generates backend code/scaffolding |
| `feature-factory` | Feature Factory | `15_featureFactory` | No | `feature-factory` | End-to-end feature scaffolding with name, description, UI/DB flags |

### Comparison Mode
When `comparePath` is set and `supportsCompare` is true, the system derives a compare subdirectory (e.g., `01_overview` becomes `02_overviewCompare`). This enables diff-style analysis between two codebases or versions.

### Dynamic Form Fields Per Parser
- **files**: `filesInputType` (indices vs paths), `filesIndices`, `filesPaths`
- **types / typesCompare**: `typeFilter` (regex filter, e.g., `User`, `*Props`)
- **ui / uiCompare**: `uiPattern` (regex for component prefix, e.g., `<n-`, `<YourPrefix`)
- **feature-factory**: `featureName`, `featureDesc`, `createUi` (boolean), `createDb` (boolean)
- **All**: `targetPath`, `userNotes`, `comparePath` (when available)

---

## 3. Form Model

### `FormModel` Interface

```typescript
interface FormModel {
  targetPath: string;           // File or folder to analyze (default: 'C:\orchestr8')
  outputDirOverride: string | null; // Optional override for base output dir
  comparePath: string | null;   // Folder to compare against
  filesInputType: 'indices' | 'paths'; // How to specify files
  filesIndices: string;         // Comma-separated indices (e.g., "1,5,10")
  filesPaths: string[];         // Array of selected file paths
  typeFilter: string;           // Regex filter for type analysis
  uiPattern: string;            // Regex for UI component matching
  featureName: string;          // Feature Factory: name
  featureDesc: string;          // Feature Factory: description
  createUi: boolean;            // Feature Factory: generate UI?
  createDb: boolean;            // Feature Factory: generate DB?
  userNotes: string;            // Free-form context notes
}
```

The form uses Naive UI components (`NForm`, `NInput`, `NRadioGroup`, `NCheckbox`, `NSelect`) with conditional rendering based on `selectedParserType`.

---

## 4. Tauri Invoke Calls

### Primary Backend Command

```typescript
const result = await invoke<string>('run_script_command', { args: argsForRust });
```

### `argsForRust` Payload Structure

The payload is a comprehensive object that maps form state to Rust command arguments:

```typescript
{
  commandType: string,        // e.g., "overview", "generate-ui", "feature-factory"
  outputDir: string | null,   // Derived output directory
  targetPath: string | null,  // For scaffold and feature-factory
  comparePath: string | null, // For scaffold compare mode
  filter: string | null,      // For types/typesCompare
  indices: string | null,     // For files (indices mode)
  paths: string | null,       // For files (paths mode) -- joined comma string
  uiPattern: string | null,   // For ui/uiCompare
  projectName: string | null, // Reserved for generate-ui/backend
  featureName: string | null, // For feature-factory
  featureDesc: string | null, // For feature-factory
  createUi: boolean | null,   // For feature-factory
  createDb: boolean | null,   // For feature-factory
  cliPath: string | null,     // Reserved for feature-factory CLI override
}
```

### Other Tauri APIs Used
- `open()` from `@tauri-apps/plugin-dialog` -- File/folder selection dialogs
- `writeText()` from `@tauri-apps/plugin-clipboard-manager` -- Copy CLI command
- `useMessage()` from Naive UI -- Toast notifications

---

## 5. Progress Tracking

The Orchestr8 implementation uses a simple but effective status system:

- **`isLoading: boolean`** -- Controls `NSpin` wrapper around the form, showing spinner during Tauri invoke
- **`generationStatus: GenerationStatus | null`** -- Structured feedback object:
  ```typescript
  interface GenerationStatus {
    success: boolean;
    message: string;
  }
  ```
- **Naive UI `useMessage()`** -- Toast notifications for success, error, info, warning
- **Console logging** -- Extensive `console.log`/`console.error` for debugging payload and results

There is no streaming/progressive progress (e.g., percentage complete). The operation is atomic: invoke -> wait -> result.

---

## 6. Type Shapes (from prdDefinitions.ts)

### Core Types

```typescript
// Flexible JSON blob for PRD content
export type PrdDataType = Record<string, any>;

// A versioned snapshot of PRD data
export interface PrdVersion {
  version_id: number;
  project_id: number;
  timestamp: string;              // ISO 8601
  approved_by_user_id: string;
  based_on_version_id: number | null;
  prd_data: PrdDataType;
  is_current_live: boolean;
}

// LLM configuration for AI-powered features
export interface LlmEntityConfig {
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

// Schema field definition for dynamic PRD forms
export interface FieldDefinition {
  id: string;
  label: string;
  field_type: string;             // "text", "textarea", "number", "select", etc.
  options?: string[] | null;
  required: boolean;
}

// Change proposal (the heart of the edit workflow)
export interface ChangeRequest {
  change_request_id: number;
  project_id: number;
  target_prd_version_id: number;
  proposed_by_user_id: string;
  proposal_timestamp: number;     // Unix timestamp
  proposed_changes: Record<string, any>;
  status: string;                 // "PendingAssessment", "PendingFeedback", "Approved", "Rejected"
  assessment_details?: Record<string, any> | null;
  feedback_log?: Record<string, any> | null;
  decision_details?: Record<string, any> | null;
  resulting_prd_version_id?: number | null;
}

// Result of proposing a PRD update
export interface ProposalResult {
  outcome: ProposalOutcome;
  message: string;
}

export type ProposalOutcome =
  | { type: "NoChangesDetected" }
  | { type: "ChangeRequestCreated"; change_request_id: number };

// Workflow step for structured generation pipelines
export interface WorkflowStep {
  step_id: string;
  project_id: number;
  block_name: string;
  step_order: number;
  step_name: string;
  description?: string | null;
  assigned_entity_role?: string | null;
  input_spec?: string | null;
  output_spec?: string | null;
  completion_criteria?: string | null;
  next_step_ids: string[];
  created_timestamp: number;
  updated_timestamp: number;
}

// LLM interaction audit log
export interface InteractionRecord {
  entry_id: number;
  timestamp: number;
  username: string;
  user_message: string;
  llm_response: string;
  response_topic?: string | null;
  is_mock_interaction: boolean;
  attachment_descriptor?: string | null;
}

// Supporting types
export interface ProjectInfo {
  project_id: number;
  project_name: string;
  created_timestamp: number;
}

export interface NewFieldDefinition {
  field_key: string;
  label: string;
  type: string;
  description: string | null;
  default_value: string | null;
}

export interface NewChangeRequestData {
  project_id: number;
  target_prd_version_id: number;
  proposed_by_user_id: string;
  proposed_changes: Record<string, any>;
  status: string;
}

export interface LlmEntityMinimal {
  id: string;
  name: string;
  entity_type: string;
}

export interface LlmEntityConfigInput {
  name: string;
  entity_type: string;
  provider?: string | null;
  api_key?: string | null;
  system_prompt?: string | null;
  mock_payload?: string | null;
  project_id?: number | null;
  id?: string | null;
  model_id?: string | null;
}

export interface TestResult {
  success: boolean;
  message: string;
}
```

---

## 7. Edit/Propose Workflow (PrdEditor.vue)

This is the **most unique and innovative** aspect of the st8 PRD system. Unlike typical document editors that save directly, this system implements a **structured change proposal workflow** with version control and assessment gates.

### How PrdEditor.vue Works

**1. Fetch Current PRD**
```typescript
const fetchedPrd = await invoke<PrdVersion | null>('get_current_prd', {
  projectId: projectIdNumber
});
```
- Loads the live `PrdVersion` for the current project
- If none exists, offers "Create Initial PRD" button which calls `create_initial_prd`

**2. Enter Edit Mode**
- `startEditing()` clones current PRD data into `prdDataForEdit` reactive object
- User edits fields through dynamically rendered form inputs based on schema
- Schema is extracted from `prdData.prd_data._schema`

**3. Dynamic Field Rendering**
The editor renders fields based on `field_type` from schema:
- `Text` -> `NInput`
- `Long Text` -> `NTextarea` (3 rows)
- `Number` -> `NInputNumber`
- `Boolean` -> `NSwitch`
- `Date` -> `NDatePicker`
- Fields are grouped by category (dot-notation prefix) in `NCollapse` panels

**4. Propose Changes (The Unique Workflow)**
```typescript
const result = await invoke<ProposalResult>('propose_prd_update', {
  projectId: projectIdNumber,
  proposedPrdData: prdDataForEdit,
  proposedByUserId: userId,
});
```

**5. Proposal Outcomes**
- **`NoChangesDetected`**: Backend compared proposed data to current version and found no diff. Editor exits edit mode.
- **`ChangeRequestCreated`**: A formal `ChangeRequest` record was created with a unique ID. The change is NOT immediately applied -- it enters an assessment workflow. Editor exits edit mode and refreshes to show the committed/live version.

**6. Change Request Lifecycle**
Based on the `ChangeRequest` interface, a created request tracks:
- `status`: `"PendingAssessment"` -> `"PendingFeedback"` -> `"Approved"` / `"Rejected"`
- `assessment_details`: Structured assessment data
- `feedback_log`: Iterative feedback history
- `decision_details`: Final approval/rejection rationale
- `resulting_prd_version_id`: Links to the new version if approved

### Why This Is Unique
Most PRD/document systems either:
- Save directly (Google Docs, Notion)
- Use simple version history (Confluence, Git)

This system introduces **gated change control** similar to software pull requests but for product requirements. Changes must be:
1. Proposed with full context
2. Assessed by the system or stakeholders
3. Approved or rejected with recorded rationale
4. If approved, spawn a new versioned PRD snapshot

This bridges the gap between agile iteration and formal change management.

---

## 8. Evolution Trail: stereOS (446 lines) -> Orchestr8 (731 lines)

### What Changed

| Aspect | stereOS Version (446 lines) | Orchestr8 Version (731 lines) |
|--------|----------------------------|-------------------------------|
| **Purpose** | AI-powered PRD document generator | Code analysis + scaffolding CLI wrapper |
| **Form Model** | `prdForm`: type, title, technicalScope, includeFiles, aiModel | `formModel`: targetPath, outputDir, comparePath, typeFilter, uiPattern, featureName, featureDesc, createUi, createDb, filesIndices, filesPaths, userNotes |
| **Document Types** | Feature PRD, Architecture, Spec, API Doc | Parser types: overview, stores, routes, commands, types, ui, files, generate-ui, generate-backend, feature-factory |
| **Backend Calls** | `generate_prd`, `get_project_analysis_data` | `run_script_command` (unified CLI runner) |
| **AI Integration** | Direct LLM call with model selection (gpt-4, gpt-3.5) | No direct AI in component -- delegates to CLI scripts |
| **Output** | Markdown preview + HTML render + export | File-based reports to `C:\orchestr8\PRD Generator Outputs` |
| **Comparison** | None | Full compare mode with derived compare directories |
| **UI Pattern** | Modal preview with tabs | Inline form with dynamic fields |
| **Progress** | Spinner in modal with "AI is thinking..." | Spin wrapper on form |
| **Export** | Export to Markdown file via dialog | No export -- generates to filesystem directly |
| **Validation** | FormRules on title, scope, type, aiModel | Inline validation before invoke |
| **Clipboard** | None | Copy generated CLI command |
| **File Selection** | None | Tauri dialog for target, compare, and multiple files |
| **Scaffolding** | None | Feature Factory, UI Gen, Backend Gen |

### What Was Added
1. **Parser pipeline** with 10 distinct analysis/generation types
2. **Comparison mode** for diff analysis between directories
3. **Feature Factory** -- end-to-end feature scaffolding with UI/DB flags
4. **File retrieval by indices or paths** -- granular file-level analysis
5. **Type filtering** -- regex-based TypeScript type extraction
6. **UI pattern matching** -- regex-based component library analysis
7. **CLI command generation and copy** -- transparency and reproducibility
8. **Derived output directory system** -- organized numbered subdirectories

### What Was Removed
1. **Direct AI/LLM integration** -- no more `gpt-4` or `gpt-3.5-turbo` selection
2. **Markdown preview modal** -- no live preview of generated content
3. **Export functionality** -- no save-to-file dialog
4. **Document type abstraction** -- replaced with concrete parser types
5. **Project analysis data fetching** -- no more `get_project_analysis_data`
6. **Marked.js rendering** -- no HTML preview from Markdown

### Architectural Shift
- **stereOS**: Frontend-driven AI document generation. The Vue component orchestrates LLM calls, manages prompts, and renders output. Heavy frontend responsibility.
- **Orchestr8**: Frontend is a thin wrapper over CLI tools. The Vue component collects parameters, generates CLI commands, and invokes a unified `run_script_command` backend. The heavy lifting (parsing, analysis, generation) happens in Rust/CLI scripts. This is a **command-pattern architecture** where the UI is a parameter collector and execution trigger.

---

## 9. Unique IP: What No Other PRD System Does

### 1. Code-to-PRD Parser Pipeline
The system doesn't just generate PRDs from prompts -- it **parses actual code** through specialized analyzers:
- `overview`: Architecture extraction
- `stores`: State management mapping
- `routes`: Navigation flow analysis
- `commands`: IPC interface documentation
- `types`: TypeScript schema extraction
- `ui`: Component library pattern recognition
- `files`: Granular file content retrieval

This is bidirectional: code informs documentation, and documentation can drive scaffolding.

### 2. Gated Change Proposal Workflow
The `propose_prd_update` -> `ChangeRequest` -> assessment -> approval/rejection cycle is unique. It treats PRD changes like code changes (pull requests for requirements), with:
- Formal change requests with IDs
- Assessment and feedback logs
- Decision tracking with rationale
- Version lineage (`based_on_version_id`, `resulting_prd_version_id`)

### 3. Comparison-Driven Documentation
The `supportsCompare` system enables **diff-style PRD generation** -- analyzing how a codebase changed between two points in time and generating comparison documentation automatically.

### 4. Feature Factory Scaffolding
The `feature-factory` command doesn't just document -- it **generates code scaffolding** for new features with configurable UI and database layers, bridging the gap between requirements and implementation.

### 5. CLI Transparency
Every UI action generates a reproducible CLI command that can be copied and run independently. This makes the system auditable, scriptable, and CI/CD-friendly.

### 6. Schema-Driven Dynamic Forms
The PRD Editor doesn't have hardcoded fields -- it renders forms dynamically based on a `_schema` definition within the PRD data itself, making the system extensible without code changes.

---

## 10. Key Insights for st8 Integration

1. **The parser types (`overview`, `stores`, `routes`, etc.) are the core intellectual property** -- these represent deep code analysis capabilities that should be preserved and extended.

2. **The `propose_prd_update` workflow is the differentiator** -- no competitor has PR-level change control for requirements. This should be a flagship feature.

3. **The evolution from stereOS to Orchestr8 shows a shift from AI-first to analysis-first** -- the system moved from generating documents via LLM prompts to extracting structure via parsers. A hybrid approach (parsers + LLM enhancement) may be optimal.

4. **The type system (`PrdVersion`, `ChangeRequest`, `WorkflowStep`) is well-designed** -- it supports versioning, audit trails, and structured workflows. These types should be the foundation of the st8 PRD module.

5. **The `run_script_command` architecture is a clean separation** -- the frontend is a parameter collector, the backend is an execution engine. This pattern scales well and enables CLI parity.

---

*End of Report*
