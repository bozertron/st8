# D6-D7: API Surface and Data Model Specification

**Date:** 2026-05-13
**Scope:** st8 PRD System — REST API endpoints, backend commands, and SQLite data model
**Sources:** W1-02 (PrdGenerator), W1-03 (PrdEditor Commands), W1-10 (ACTU8 Framework), W2-01 (Shared Patterns)

---

## Part 1: API Surface (D6)

The st8 PRD API exposes five functional domains: Stakeholder management, Conversation capture, PRD Generation, Objection handling, and Template rendering. The surface unifies three backend traditions: (1) the ACTU8 server endpoints (`/api/prd`), (2) the Rust Tauri command layer (`get_current_prd`, `propose_prd_update`, etc.), and (3) the Orchestr8 parser pipeline (`run_script_command`). All endpoints return JSON and use standard HTTP status codes.

---

### 1. Stakeholder APIs

These endpoints manage the humans who provide context for PRD generation.

#### `POST /api/stakeholders`
Create a new stakeholder.
- **Request Body:**
  ```json
  {
    "name": "string (required)",
    "role": "string (required) — e.g., 'Product Manager', 'Engineering Lead'",
    "department": "string (optional)",
    "email": "string (optional)",
    "project_id": "integer (required)"
  }
  ```
- **Response (201):**
  ```json
  {
    "id": 1,
    "name": "Alice Chen",
    "role": "Product Manager",
    "department": "Product",
    "email": "alice@example.com",
    "status": "active",
    "created_at": "2026-05-13T12:00:00Z"
  }
  ```
- **Errors:** 400 (missing required field), 409 (duplicate email for project)

#### `GET /api/stakeholders`
List stakeholders for a project.
- **Query:** `?project_id={integer}` (required)
- **Response (200):** Array of stakeholder objects.

#### `POST /api/stakeholders/:id/interview`
Start an interview session with a stakeholder.
- **Request Body:**
  ```json
  {
    "mode": "text | voice",
    "topics": ["string"] // optional seed topics
  }
  ```
- **Response (201):**
  ```json
  {
    "session_id": "uuid",
    "stakeholder_id": 1,
    "started_at": "2026-05-13T12:00:00Z",
    "status": "active"
  }
  ```

#### `POST /api/stakeholders/:id/upload`
Upload a file (pdf, docx, image, audio) for context enrichment.
- **Content-Type:** `multipart/form-data`
- **Fields:** `file` (binary), `description` (string, optional)
- **Response (201):**
  ```json
  {
    "upload_id": "uuid",
    "filename": "roadmap-q3.pdf",
    "type": "pdf",
    "extracted_text": "string | null",
    "metadata": { "pages": 12, "word_count": 3400 }
  }
  ```

#### `GET /api/stakeholders/:id/conversation`
Get conversation history for a stakeholder.
- **Query:** `?session_id={uuid}` (optional; omit for all sessions)
- **Response (200):** Array of conversation turns (speaker, text, timestamp, entities).

---

### 2. Conversation APIs

These endpoints accept raw input and expose extracted entities.

#### `POST /api/conversation/text`
Submit text input to an active interview session.
- **Request Body:**
  ```json
  {
    "session_id": "uuid (required)",
    "text": "string (required)",
    "speaker": "stakeholder | system",
    "timestamp": "string (ISO 8601, optional — server-assigned if absent)"
  }
  ```
- **Response (202):**
  ```json
  {
    "message_id": "uuid",
    "status": "accepted",
    "processing_job_id": "uuid"
  }
  ```
- **Note:** Returns 202 because entity extraction may be asynchronous.

#### `POST /api/conversation/voice`
Submit a voice recording (multipart).
- **Content-Type:** `multipart/form-data`
- **Fields:** `session_id` (text), `audio` (binary, mp3/wav/m4a), `speaker` (text)
- **Response (202):** Same as text endpoint.

#### `GET /api/conversation/:id/status`
Check processing status of a conversation job.
- **Response (200):**
  ```json
  {
    "job_id": "uuid",
    "status": "pending | processing | completed | failed",
    "progress_percent": 75,
    "result": { "entities_extracted": 4, "topics_inferred": 2 } // null until completed
  }
  ```

#### `GET /api/conversation/:id/entities`
Get extracted entities for a completed conversation job.
- **Response (200):**
  ```json
  {
    "entities": [
      { "entity": "OAuth 2.0", "type": "Technology", "confidence": 0.94 },
      { "entity": "GDPR compliance", "type": "Requirement", "confidence": 0.88 }
    ]
  }
  ```

---

### 3. PRD Generation APIs

These endpoints unify the ACTU8 `/api/prd` route, the Rust PrdEditor commands, and the Orchestr8 parser pipeline. They all operate on a `project_id` scope.

#### `GET /api/prd`
Generate and return a PRD from the current project state. This is the **Atomic DB view**: the PRD is computed on-demand from `file_registry`, `schema-cards`, and `file_intent`, not retrieved from a static file.
- **Query:** `?project_id={integer} (required)`
- **Response (200):**
  ```json
  {
    "format": "markdown",
    "content": "# Project PRD\n...",
    "generated_at": "2026-05-13T12:00:00Z",
    "source": "atomic-db-query",
    "stats": {
      "files_analyzed": 42,
      "phases_covered": ["CONCEPT", "LOCKED", "DEVELOPMENT", "PRODUCTION"]
    }
  }
  ```
- **Note:** Corresponds to the existing st8 `_handlePrd` route in `backend/server.js`.

#### `GET /api/prd/current`
Get the current live `PrdVersion` from the versioned store (Rust-backed).
- **Query:** `?project_id={integer} (required)`
- **Response (200):**
  ```json
  {
    "version_id": 7,
    "project_id": 1,
    "timestamp": "2026-05-13T10:00:00Z",
    "approved_by_user_id": "user-123",
    "based_on_version_id": 5,
    "prd_data": { "...JSON blob..." },
    "is_current_live": true
  }
  ```
- **Response (404):** No live PRD exists yet.
- **Note:** Direct counterpart to Rust `get_current_prd`.

#### `POST /api/prd`
Create the initial PRD version.
- **Request Body:**
  ```json
  {
    "project_id": 1,
    "prd_data": { "...JSON blob..." },
    "user_id": "user-123"
  }
  ```
- **Response (201):** Full `PrdVersion` object with `version_id: 1`, `is_current_live: true`.
- **Note:** Direct counterpart to Rust `create_initial_prd`.

#### `POST /api/prd/propose`
Propose an update to the current live PRD. This triggers the gated change workflow.
- **Request Body:**
  ```json
  {
    "project_id": 1,
    "based_on_version_id": 7,
    "proposed_prd_data": { "...JSON blob..." },
    "proposed_by_user_id": "user-456"
  }
  ```
- **Response (200):**
  ```json
  {
    "outcome": {
      "type": "NoChangesDetected" | "ChangeRequestCreated",
      "change_request_id": 12 // present only if ChangeRequestCreated
    },
    "message": "string"
  }
  ```
- **Note:** Direct counterpart to Rust `propose_prd_update`. The backend diffs the JSON blobs (ignoring `_meta` and `_schema`) using `diff_prd_data`.

#### `POST /api/prd/generate`
Trigger a parser/generation pipeline. This is the **Orchestr8-style command runner** (`run_script_command`).
- **Request Body:**
  ```json
  {
    "project_id": 1,
    "command_type": "overview | stores | routes | commands | types | ui | files | generate-ui | generate-backend | feature-factory",
    "target_path": "string (optional — defaults to project root)",
    "compare_path": "string (optional)",
    "filter": "string (optional — regex for types parser)",
    "indices": "string (optional — comma-separated for files parser)",
    "paths": ["string"] (optional — file paths for files parser),
    "ui_pattern": "string (optional — regex for ui parser)",
    "feature_name": "string (optional — for feature-factory)",
    "feature_desc": "string (optional)",
    "create_ui": true,
    "create_db": false,
    "user_notes": "string (optional)"
  }
  ```
- **Response (202):**
  ```json
  { "job_id": "uuid", "status": "running", "output_dir": ".st8/outputs/01_overview" }
  ```
- **Note:** When `compare_path` is set and the parser supports compare, the derived output subdirectory becomes `02_overviewCompare`.

#### `GET /api/prd/package`
Get the full PRD package (all generated documents for the current version).
- **Query:** `?project_id={integer} (required)`
- **Response (200):**
  ```json
  {
    "package_id": "uuid",
    "version_id": 7,
    "documents": [
      { "doc_id": "uuid", "type": "overview", "format": "markdown", "content_url": "/api/prd/doc/{doc_id}" },
      { "doc_id": "uuid", "type": "press-release", "format": "markdown", "content_url": "/api/prd/doc/{doc_id}" }
    ],
    "status": "complete"
  }
  ```

#### `GET /api/prd/:type`
Get a specific document type by name.
- **Path:** `:type` = `press-release | gtm | overview | stores | routes | commands | types | ui | architecture | user-stories`
- **Query:** `?project_id={integer} (required)`
- **Response (200):** Document object with `content` (Markdown or JSON).
- **Response (404):** Document type not generated for this project.

#### `POST /api/prd/fields`
Add a dynamic field definition to the PRD schema.
- **Request Body:**
  ```json
  {
    "project_id": 1,
    "field_key": "security_review_date",
    "label": "Security Review Date",
    "field_type": "Date",
    "description": "When the security team signed off",
    "default_value": null
  }
  ```
- **Response (201):** `{ "field_key": "security_review_date", "added": true }`
- **Note:** Direct counterpart to Rust `add_prd_field`.

---

### 4. Objection APIs

Objections are structured concerns raised during review. They flow through `Open → Alternatives Proposed → Resolved`.

#### `POST /api/objections`
Submit a new objection.
- **Request Body:**
  ```json
  {
    "project_id": 1,
    "stakeholder_id": 1,
    "topic": "string (required)",
    "description": "string (required)",
    "priority": "low | medium | high | blocker",
    "context_version_id": 7 // optional: links to the PRD version under review
  }
  ```
- **Response (201):** Full objection object with `id`, `status: "open"`, `created_at`.

#### `GET /api/objections`
List objections for a project.
- **Query:** `?project_id={integer} (required)`, `?status=open|resolved|all` (default: `open`)
- **Response (200):** Array of objection objects.

#### `POST /api/objections/:id/alternatives`
Propose alternatives to resolve an objection.
- **Request Body:**
  ```json
  {
    "alternative": "string (required) — description of the alternative approach",
    "proposed_by": "user-id",
    "tradeoffs": "string (optional)"
  }
  ```
- **Response (201):** Alternative object with `id`, `objection_id`, `created_at`.

#### `POST /api/objections/:id/resolve`
Resolve an objection.
- **Request Body:**
  ```json
  {
    "resolution_type": "accepted | rejected | superseded | deferred",
    "decided_by": "user-id (required)",
    "rationale": "string (required)",
    "chosen_alternative_id": "uuid (optional)"
  }
  ```
- **Response (200):** Updated objection with `status: "resolved"`, `resolved_at`.

---

### 5. Template APIs

Templates define the structural skeleton for PRD generation. They map to parser types, document types, and stereOS user-story templates.

#### `GET /api/templates`
List available templates.
- **Query:** `?project_id={integer} (optional — project-scoped templates)`, `?category=prd | user-story | parser | press-release`
- **Response (200):**
  ```json
  {
    "templates": [
      { "id": "overview", "name": "Overview Parser", "category": "parser", "supports_compare": true },
      { "id": "feature-factory", "name": "Feature Factory", "category": "parser", "supports_compare": false },
      { "id": "press-release", "name": "Press Release", "category": "press-release", "supports_compare": false },
      { "id": "stereos-user-story", "name": "stereOS User Story", "category": "user-story", "checks": ["Void", "Gold", "Physics"] }
    ]
  }
  ```

#### `GET /api/templates/:id`
Get template structure and schema.
- **Response (200):**
  ```json
  {
    "id": "overview",
    "name": "Overview Parser",
    "fields": [
      { "key": "target_path", "label": "Target Path", "field_type": "path", "required": true },
      { "key": "user_notes", "label": "User Notes", "field_type": "textarea", "required": false }
    ],
    "prompts": [
      "Extract high-level project architecture",
      "Map component relationships",
      "Identify state management patterns"
    ],
    "output_spec": { "format": "markdown", "sections": ["Architecture", "Modules", "Dependencies"] }
  }
  ```

#### `POST /api/templates/:id/render`
Render a template with provided data and/or project state.
- **Request Body:**
  ```json
  {
    "project_id": 1,
    "template_data": { "target_path": "/src", "user_notes": "Focus on auth" },
    "use_project_state": true // if true, schema-cards and intent are injected
  }
  ```
- **Response (200):**
  ```json
  {
    "rendered_content": "# Overview\n...",
    "format": "markdown",
    "generated_at": "2026-05-13T12:00:00Z"
  }
  ```

---

## Part 2: Data Model (D7)

The data model follows the **Atomic DB** philosophy: the PRD is a queryable view over structured data, not a static file. The schema unifies the existing st8 persistence layer (`file_registry`, `connections`, `file_intent`), the Rust database schema (`PRD_Versions`, `Change_Requests`), and new tables for stakeholder interviews, objections, and uploads.

All tables use SQLite. JSON blobs are stored as `TEXT` with application-level validation. Enforced via `CHECK` constraints where applicable.

---

### 1. Core PRD Tables

#### `prd_versions`
The canonical versioned snapshot store. One project has at most one live version (enforced by partial unique index).

```sql
CREATE TABLE prd_versions (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    approved_by_user_id TEXT,                     -- NULL for draft versions
    based_on_version_id INTEGER,                  -- self-referential FK: version lineage
    prd_data TEXT NOT NULL,                       -- JSON blob: the full PRD data
    is_current_live BOOLEAN NOT NULL DEFAULT FALSE,
    composition_source TEXT DEFAULT 'schema-cards', -- 'schema-cards' | 'manual' | 'hybrid'
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (based_on_version_id) REFERENCES prd_versions(version_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_prd_versions_live ON prd_versions(project_id, is_current_live) WHERE is_current_live = TRUE;
CREATE INDEX idx_prd_versions_project ON prd_versions(project_id);
CREATE INDEX idx_prd_versions_timestamp ON prd_versions(timestamp);
```

**JSON Shape — `prd_data`:**
```json
{
  "_meta": {
    "version_id": 7,
    "generated_at": "2026-05-13T12:00:00Z",
    "generator": "atomic-db-v1"
  },
  "_schema": {
    "fields": [
      { "id": "title", "label": "Title", "field_type": "text", "required": true },
      { "id": "description", "label": "Description", "field_type": "long_text", "required": true }
    ]
  },
  "fields": {
    "title": "st8 PRD System",
    "description": "A living PRD generator..."
  }
}
```
- **Rule:** `_meta` and `_schema` are ignored by the diff engine (`diff_prd_data`).
- **Rule:** Only the `fields` object is diffed during change proposal.

#### `change_requests`
Formal change proposals. Mirrors the Rust `ChangeRequest` type exactly.

```sql
CREATE TABLE change_requests (
    change_request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    target_prd_version_id INTEGER NOT NULL,
    proposed_by_user_id TEXT NOT NULL,
    proposal_timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    proposed_changes TEXT NOT NULL,               -- JSON diff: only changed fields
    status TEXT NOT NULL CHECK(status IN ('PendingAssessment', 'PendingFeedback', 'PendingDecision', 'Approved', 'Rejected', 'Cancelled')) DEFAULT 'PendingAssessment',
    assessment_details TEXT,                      -- JSON: structured assessment data
    feedback_log TEXT,                            -- JSON array: iterative feedback history
    decision_details TEXT,                        -- JSON: final approval/rejection rationale
    resulting_prd_version_id INTEGER,             -- NULL until approved
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (target_prd_version_id) REFERENCES prd_versions(version_id) ON DELETE CASCADE,
    FOREIGN KEY (resulting_prd_version_id) REFERENCES prd_versions(version_id) ON DELETE SET NULL
);

CREATE INDEX idx_cr_project_status ON change_requests(project_id, status);
CREATE INDEX idx_cr_target_version ON change_requests(target_prd_version_id);
CREATE INDEX idx_cr_proposer ON change_requests(proposed_by_user_id);
```

**JSON Shape — `proposed_changes` (diff format):**
```json
{
  "title": "Updated Title",
  "new_field": "New value"
}
```
- **Note:** Deletions are logged as warnings but do not appear in the diff map (known limitation of `diff_prd_data`).

#### `prd_documents`
Individual documents within a PRD package (press-release, GTM, per-domain parser outputs).

```sql
CREATE TABLE prd_documents (
    doc_id TEXT PRIMARY KEY,                      -- UUID
    version_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,                       -- 'overview', 'press-release', 'gtm', 'user-stories', etc.
    content TEXT NOT NULL,                        -- Markdown or JSON text
    format TEXT NOT NULL DEFAULT 'markdown',      -- 'markdown' | 'json' | 'html'
    parser_type TEXT,                             -- nullable: links to parser command_type if generated
    generated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT,                                -- JSON: word_count, sections, source_files[]
    FOREIGN KEY (version_id) REFERENCES prd_versions(version_id) ON DELETE CASCADE
);

CREATE INDEX idx_prd_docs_version ON prd_documents(version_id);
CREATE INDEX idx_prd_docs_type ON prd_documents(doc_type);
```

#### `prd_packages`
A package bundles all documents for a specific PRD version.

```sql
CREATE TABLE prd_packages (
    package_id TEXT PRIMARY KEY,                  -- UUID
    version_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'generating', 'complete', 'failed')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER,
    error_log TEXT,                               -- JSON: error messages if failed
    FOREIGN KEY (version_id) REFERENCES prd_versions(version_id) ON DELETE CASCADE
);

CREATE INDEX idx_prd_packages_version ON prd_packages(version_id);
```

---

### 2. Stakeholder Tables

#### `stakeholders`

```sql
CREATE TABLE stakeholders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX idx_stakeholders_project ON stakeholders(project_id);
CREATE UNIQUE INDEX idx_stakeholders_email_project ON stakeholders(project_id, email) WHERE email IS NOT NULL;
```

#### `interview_sessions`

```sql
CREATE TABLE interview_sessions (
    id TEXT PRIMARY KEY,                          -- UUID
    stakeholder_id INTEGER NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('text', 'voice', 'hybrid')),
    started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    ended_at INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'abandoned')),
    transcript TEXT,                              -- JSON array of turns
    summary TEXT,                                 -- AI-generated session summary
    FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id) ON DELETE CASCADE
);

CREATE INDEX idx_interview_sessions_stakeholder ON interview_sessions(stakeholder_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(status);
```

**JSON Shape — `transcript`:**
```json
[
  { "turn": 1, "speaker": "stakeholder", "text": "...", "timestamp": "2026-05-13T12:00:00Z" },
  { "turn": 2, "speaker": "system", "text": "...", "timestamp": "2026-05-13T12:00:05Z" }
]
```

#### `conversation_entities`
Entities extracted from a single interview session.

```sql
CREATE TABLE conversation_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_type TEXT NOT NULL,                    -- 'Technology', 'Requirement', 'Person', 'Department', 'Metric'
    confidence REAL NOT NULL CHECK(confidence >= 0.0 AND confidence <= 1.0),
    source_turn INTEGER,                          -- which transcript turn
    inferred_topic_id INTEGER,                    -- FK to inferred_topics (nullable)
    FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (inferred_topic_id) REFERENCES inferred_topics(id) ON DELETE SET NULL
);

CREATE INDEX idx_entities_session ON conversation_entities(session_id);
CREATE INDEX idx_entities_type ON conversation_entities(entity_type);
```

---

### 3. Business Ontology Tables

#### `business_concepts`
A living taxonomy of business terms detected across sessions and uploads.

```sql
CREATE TABLE business_concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    concept TEXT NOT NULL,                        -- canonical term, e.g., "Recurring Revenue"
    normalized_concept TEXT NOT NULL,             -- lowercased, stemmed
    department_tags TEXT,                         -- JSON array: ["Finance", "Product"]
    related_concepts TEXT,                        -- JSON array of concept IDs
    triggers TEXT,                                -- JSON array: regex patterns or keyword triggers
    first_seen_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    usage_count INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX idx_business_concepts_project ON business_concepts(project_id);
CREATE UNIQUE INDEX idx_business_concepts_project_normalized ON business_concepts(project_id, normalized_concept);
```

#### `inferred_topics`
Topics inferred by clustering entities and transcripts.

```sql
CREATE TABLE inferred_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    stakeholder_id INTEGER,                       -- nullable: may be cross-stakeholder
    source_session_id TEXT,                       -- nullable: may come from uploads
    topic TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    evidence_count INTEGER NOT NULL DEFAULT 0,    -- number of supporting entities/mentions
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'addressed', 'merged', 'discarded')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id) ON DELETE SET NULL,
    FOREIGN KEY (source_session_id) REFERENCES interview_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_inferred_topics_project ON inferred_topics(project_id);
CREATE INDEX idx_inferred_topics_priority ON inferred_topics(priority);
CREATE INDEX idx_inferred_topics_status ON inferred_topics(status);
```

---

### 4. Objection Tables

#### `objections`

```sql
CREATE TABLE objections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    stakeholder_id INTEGER,
    context_version_id INTEGER,                   -- PRD version under review
    topic TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'alternatives_proposed', 'resolved', 'superseded')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'blocker')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    resolved_at INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id) ON DELETE SET NULL,
    FOREIGN KEY (context_version_id) REFERENCES prd_versions(version_id) ON DELETE SET NULL
);

CREATE INDEX idx_objections_project ON objections(project_id);
CREATE INDEX idx_objections_status ON objections(status);
CREATE INDEX idx_objections_priority ON objections(priority);
```

#### `objection_alternatives`

```sql
CREATE TABLE objection_alternatives (
    id TEXT PRIMARY KEY,                          -- UUID
    objection_id INTEGER NOT NULL,
    alternative TEXT NOT NULL,
    proposed_by TEXT NOT NULL,
    tradeoffs TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (objection_id) REFERENCES objections(id) ON DELETE CASCADE
);

CREATE INDEX idx_alternatives_objection ON objection_alternatives(objection_id);
```

#### `objection_resolutions`

```sql
CREATE TABLE objection_resolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objection_id INTEGER NOT NULL,
    resolution_type TEXT NOT NULL CHECK(resolution_type IN ('accepted', 'rejected', 'superseded', 'deferred')),
    decided_by TEXT NOT NULL,
    rationale TEXT NOT NULL,
    chosen_alternative_id TEXT,
    resolved_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (objection_id) REFERENCES objections(id) ON DELETE CASCADE,
    FOREIGN KEY (chosen_alternative_id) REFERENCES objection_alternatives(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_resolutions_objection ON objection_resolutions(objection_id);
```

---

### 5. Upload Tables

#### `uploads`
Files uploaded for context enrichment (PDFs, wireframes, audio transcripts).

```sql
CREATE TABLE uploads (
    id TEXT PRIMARY KEY,                          -- UUID
    project_id INTEGER NOT NULL,
    stakeholder_id INTEGER,                       -- nullable: may be system-uploaded
    filename TEXT NOT NULL,
    original_mimetype TEXT NOT NULL,
    storage_path TEXT NOT NULL,                   -- path on disk / object store key
    extracted_text TEXT,                          -- OCR or parsed text content
    extracted_entities TEXT,                      -- JSON array of entities from this upload
    metadata TEXT,                                -- JSON: pages, word_count, duration_seconds, etc.
    processed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id) ON DELETE SET NULL
);

CREATE INDEX idx_uploads_project ON uploads(project_id);
CREATE INDEX idx_uploads_stakeholder ON uploads(stakeholder_id);
```

---

### 6. Integration with Existing st8 Tables

The PRD module does not duplicate st8's identity system. It queries these existing tables as read-only sources during PRD composition:

| Table | Source File | Role in PRD Composition |
|-------|-------------|------------------------|
| `projects` | `persistence.js` | Scope boundary. `project_id` FK across all PRD tables. |
| `file_registry` | `persistence.js` | File inventory: fingerprint, filepath, sha256Hash, status, lifecyclePhase. |
| `connections` | `persistence.js` | Dependency graph: source/target fingerprints, connectionType, confidenceScore. |
| `file_mutation_log` | `persistence.js` | Temporal narrative: mutationType, actor, timestamp, changedFields. |
| `file_intent` | `persistence.js` | Semantic seed: purpose, dependsOnBehavior, valueStatement. |
| `activity_log` | `persistence.js` | System events for PRD provenance. |

**Composition Query Pattern:**
```sql
-- Example: Gather all schema-card-equivalent data for a PRD version
SELECT
  fr.fingerprint, fr.filepath, fr.status, fr.lifecyclePhase,
  fi.purpose, fi.dependsOnBehavior, fi.valueStatement,
  c.target_fingerprint, c.connectionType
FROM file_registry fr
LEFT JOIN file_intent fi ON fr.fingerprint = fi.fingerprint
LEFT JOIN connections c ON fr.fingerprint = c.source_fingerprint
WHERE fr.project_id = ?
ORDER BY fr.lifecyclePhase, fr.filepath;
```

---

## Summary

This specification defines a unified REST API surface and SQLite data model for the st8 PRD system. **Part 1 (D6)** exposes 20+ endpoints across five domains: Stakeholder management (interview + upload), Conversation capture (text/voice input + entity extraction), PRD Generation (Atomic DB view, versioned store, parser pipeline, and gated change proposals), Objection handling (structured review workflow), and Template rendering (schema-driven generation). The API unifies the existing st8 `/api/prd` route, the Rust Tauri command layer (`get_current_prd`, `propose_prd_update`), and the Orchestr8 parser pipeline (`run_script_command` with 10 parser types).

**Part 2 (D7)** defines 13 new tables plus integration with 6 existing st8 tables. The core `prd_versions` and `change_requests` tables carry forward the Rust-backed version lineage and formal diff-assessment-approval workflow. Stakeholder, ontology, and objection tables add the human-in-the-loop layer. The model adheres to the **Atomic DB** philosophy: `prd_versions.prd_data` is a JSON view over the existing `file_registry`, `connections`, and `file_intent` tables — the PRD is recomputed on request, not stored as a static file. This ensures documentation never drifts from implementation.
