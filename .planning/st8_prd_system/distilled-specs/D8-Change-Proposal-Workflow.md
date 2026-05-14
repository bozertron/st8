# D8 — Change Proposal Workflow Specification

**Spec ID:** D8  
**System:** st8 PRD System  
**Date:** 2026-05-13  
**Status:** Distilled Specification  
**Depends on:** D1 (Schema Architecture), D3 (Stakeholder Conversation Loop), D4 (PRD Package Composition)

---

## 1. Change Detection

The system detects changes through three parallel channels:

### 1.1 Schema Card Diff (Automated)
When the schema-driven PRD editor is used, the `SchemaCardEmitter` component computes a structural diff between the current live PRD version (`PrdVersion.prd_data`) and the edited state. This diff is computed on the client side before the proposal is even submitted.

- **Trigger:** User clicks "Propose Changes" in the PRD editor.
- **Scope:** Compares the `fields` object within `prd_data`, ignoring `_meta` and `_schema` keys.
- **Outcome:** If no diff is found, the system returns `ProposalOutcome::NoChangesDetected` immediately and exits edit mode without creating a record.

### 1.2 Mutation Log (System Auto-Detect)
The mutation log captures deltas from:
- **Codebase changes** — When integrated with the st8 development environment, parser pipelines (overview, stores, routes, types, UI, commands) emit change events.
- **Conversation changes** — After a stakeholder interview, the synthesis engine compares extracted entities against the current live PRD. If new entities surface or existing values diverge, the system flags a potential mutation.
- **Business ontology updates** — Cross-department inference engine adds inferred topics to pending topic lists.

- **Trigger:** System detects a delta between live PRD and newly synthesized or parsed data.
- **Silent update rule:** If the delta is purely additive (new inferred topics, new supporting documents, non-conflicting metadata) and falls below the minor-change threshold, the system logs the mutation silently without opening a formal change request.
- **Proposal trigger:** If the delta modifies existing values, removes fields, or conflicts with stakeholder aspirations, the system creates a `ChangeRequest` with status `PendingAssessment`.

### 1.3 Manual Stakeholder Input
Any stakeholder with access to the PRD package can explicitly propose a change:
- **Via interactive web:** Inline "Suggest Edit" buttons on any PRD section open a mini-editor.
- **Via voice/text input:** During review, a stakeholder says "Actually, the target price should be $1199, not $1299." The system transcribes, maps to the relevant PRD field, and initiates a change request.
- **Via file upload:** A stakeholder uploads an updated BOM spreadsheet or new CAD file. The system extracts structured data and surfaces a diff.

---

## 2. The Proposal

### 2.1 Who Can Propose
- **Any stakeholder** — Any identified department head or contributor can suggest a change to any section visible to them.
- **Product Owner (PO)** — Has blanket authority to propose changes on behalf of the product or on behalf of stakeholders who provided verbal input.
- **System auto-detect** — The mutation log and inference engine can auto-propose changes when deltas exceed the silent-update threshold. These are attributed to a system user (`user_id: "system"`).

### 2.2 What a Proposal Contains
Every formal `ChangeRequest` record contains:

| Field | Source | Description |
|-------|--------|-------------|
| `change_request_id` | Auto | Unique integer primary key |
| `project_id` | Context | Links to the project |
| `target_prd_version_id` | Auto | The `version_id` of the live PRD this change is based on |
| `proposed_by_user_id` | Context | User who initiated or triggered it |
| `proposal_timestamp` | Auto | Unix timestamp of creation |
| `proposed_changes` | Diff Engine | JSON blob containing only the changed fields (see §4) |
| `status` | Workflow | Starts as `PendingAssessment`; advances through workflow states |
| `assessment_details` | System/PO | Structured impact assessment (scope, risk, affected departments) |
| `feedback_log` | Stakeholders | JSON array of objection and counter-suggestion entries |
| `decision_details` | Authority | Final rationale, approver identity, and timestamp |
| `resulting_prd_version_id` | Auto | Populated only after approval; links to newly created version |

In addition to the database record, the interactive presentation layer renders a **Proposal Card** containing:
1. **Visual Diff** — Side-by-side or inline diff showing exactly what changed.
2. **Rationale** — Free-text field. For manual proposals, the proposer provides this. For auto-detect, the LLM generates a rationale from the mutation context.
3. **Impact Assessment** — Automatically computed or PO-supplied summary of affected departments, affected documents within the PRD package, and risk level (Low / Medium / High / Critical).

### 2.3 How It Is Presented to Stakeholders
- **Interactive Web (Primary):** Stakeholders log into the local st8 web app. A "Review Pending Changes" section shows Proposal Cards in a queue. Each card is collapsible and filterable by department or document.
- **Email (External Stakeholders):** For stakeholders who do not access the web app directly, the system generates a DOCX diff summary and emails a link to the interactive view (or attaches the summary).
- **In-App Notifications:** Toast and badge notifications appear when a new change request is created that affects a stakeholder's department.

---

## 3. The Objection Cycle

The st8 change proposal workflow is not a simple approve/reject gate. It implements a **structured mediation loop** derived from the Founder's objection-handling concept. The cycle repeats until all outstanding objections are resolved or overridden.

### Phase 1: Silent Acceptance Period
After a proposal is created (status: `PendingAssessment`), the system enters a configurable review window (default: 48 hours). During this window:
- All relevant stakeholders are notified.
- Stakeholders may review the diff but do not actively object.
- **If no objections are raised within the window**, the proposal is treated as implicitly accepted and moves directly to approval (for minor proposals) or to a formal fast-track approval gate (for major/critical proposals). This is the "No challenge in the first pass" rule.

### Phase 2: Objections Surfaced → Escalated to Product Owner
If one or more stakeholders raise an objection during the review window:
- The proposal status advances to `PendingFeedback`.
- Each objection is recorded in `feedback_log` as a structured entry: `{ stakeholder_id, timestamp, objection_text, affected_field, severity: "blocking" | "concern" }`.
- The system immediately notifies the Product Owner that mediation is required.
- The Product Owner receives a **Mediation Dashboard** showing all open objections grouped by topic and department.

### Phase 3: Product Owner Generates Alternatives
The Product Owner acts as a mediator, not a dictator at this stage:
- For each objection, the PO generates **as many alternative solutions as they can think of**.
- Alternatives are speculative PRD field modifications that preserve the original intent while addressing the stakeholder's concern.
- Example: If Engineering objects to a $1299 price point due to CoGS, alternatives might include: (A) Reduce margin target to 1.8x, (B) Substitute a lower-cost chipset, (C) Offer two SKUs at $999 and $1299.
- These alternatives are stored as `alternative_proposals` within `assessment_details`.

### Phase 4: "Further Questions for Refinement" Sent to Stakeholders
The Product Owner packages the alternatives and original objection into a **Refinement Request**:
- The message tone is constructive, not adversarial: "Here are a few ways we could address your concern. Which direction feels right, or is there another approach you'd suggest?"
- The Refinement Request is delivered back to the objecting stakeholder(s) via their preferred channel (interactive web, email, or threaded conversation).
- The proposal status becomes `PendingFeedback` (awaiting counter-input).

### Phase 5: Counter-Suggestions Received
Stakeholders respond with:
- **Selection** — "Alternative B works for me."
- **Modification** — "Alternative B is close, but can we use [specific chipset] instead?"
- **Counter-suggestion** — A brand new proposal from the stakeholder that was not in the PO's alternative list.
- **Withdrawal** — "On second thought, the original proposal is fine."
- All responses are appended to `feedback_log` with `entry_type: "counter-suggestion"`.

### Phase 6: Compromise or Escalation to Final Say
The system evaluates the feedback log:
- **Compromise reached** — If all objecting stakeholders select an alternative or provide a modification that the PO can harmonize into a single revised diff, the PO updates `proposed_changes` with the compromised version. The cycle returns to Phase 1 (new silent acceptance period on the revised proposal).
- **Stalemate** — If stakeholders cannot agree, or if a counter-suggestion conflicts with another department's core constraint, the Product Owner escalates the decision to the **Final Say** authority.
- The Final Say is defined in the initial project setup. It may be the Product Owner themselves (if they hold final authority), the Founder, or a designated department head.
- The escalation record includes a summary of objections, alternatives tried, and why consensus was impossible.

### Phase 7: Decision Logged, PRD Updated
Once a decision is reached (compromise or Final Say ruling):
- `decision_details` is populated: `{ decision_authority: "PO" | "FinalSay" | "Consensus", approver_user_id, decision_timestamp, rationale: string }`.
- The proposal status moves to `Approved`.
- A new PRD version is created (see §6).
- The cycle terminates for this proposal. If new objections arise against the newly created version, a **fresh change request** is created, starting Phase 1 anew.
- The process repeats until the PRD reaches **LOCK** status (no outstanding objections for a full review cycle across all active sections).

---

## 4. The Diff Engine

The system uses three diff strategies depending on the source of change:

### 4.1 Code Changes — `SchemaCardEmitter.diff()`
For changes originating from the schema-driven PRD editor or codebase parsers:
- **Algorithm:** A shallow key-by-key comparison of the `fields` object inside `prd_data`.
- **Ignored keys:** `_meta` and `_schema` are stripped before comparison to avoid flagging structural noise.
- **Output format:** A JSON object containing **only the changed keys** and their **new values**.
  - Additions and modifications appear as `"field_key": new_value`.
  - Deletions are **not included in the diff map** (a known design limitation for safety). Instead, deletions trigger a warning log entry, and the system creates a separate "Deletion Notice" that must be explicitly acknowledged by the Product Owner.
- **Example output:**
  ```json
  {
    "target_price": 1199,
    "primary_chipset": "NeuralAudio-X2",
    "launch_regions": ["NA", "EMEA", "APAC"]
  }
  ```

### 4.2 Stakeholder Input Changes — Conversation Comparison
For changes derived from stakeholder interviews or review feedback:
- **Algorithm:** Compare extracted entities from the latest conversation against the current live PRD's entity map.
- **Scope:** Entities are matched by semantic key (e.g., `price_point`, `chipset_target`, `channel_strategy`).
- **Output format:** Same JSON-field diff, but each entry includes a `source_conversation_id` and `stakeholder_id` for traceability.
- **Example output:**
  ```json
  {
    "target_price": {
      "new_value": 1199,
      "source": "conversation_42",
      "stakeholder": "sales_director_01",
      "confidence": 0.97
    }
  }
  ```

### 4.3 PRD Package Document Changes — Document Diff
For changes to long-form documents within the PRD package (press releases, pitch decks, GTM plans):
- **Algorithm:** Paragraph-level or section-level diff depending on document type.
- **Scope:** Tracks additions, deletions, and modifications at the block level.
- **Output format:** A structured diff array:
  ```json
  [
    { "type": "modified", "section_id": "exec_summary_p2", "old_text_hash": "abc123", "new_text": "..." },
    { "type": "added", "section_id": "distribution_04", "new_text": "..." }
  ]
  ```

---

## 5. Approval Gates

### 5.1 Who Can Approve
| Role | Authority |
|------|-----------|
| **System (Auto)** | Minor changes only, after silent acceptance period. |
| **Product Owner** | Minor and major changes. Can fast-track during silent period if confident. |
| **Department Heads** | Major changes affecting their domain (via stakeholder vote). |
| **Final Say** | Critical changes and stalemate escalations. Absolute override authority. |

### 5.2 Approval Levels
The system classifies every change request at creation time based on impact assessment:

| Level | Criteria | Approval Path |
|-------|----------|---------------|
| **Minor** | Typos, formatting, non-conflicting metadata additions, inferred-topic appendage. | Auto-approved after silent acceptance period (24–48h). |
| **Major** | Feature modifications, scope shifts, pricing changes, component substitutions, document rewrites. | Requires explicit stakeholder vote (simple majority of affected departments). PO can break ties. |
| **Critical** | Architecture changes, strategic pivots, new product lines, removal of locked features, margin-structure changes. | Requires Final Say authority. Stakeholder vote is advisory but not binding. |

The classification is computed automatically from `assessment_details.risk_score` and can be overridden by the Product Owner.

### 5.3 How Approval Is Recorded
Approval is immutable and auditable:
- **Signature:** The approver's `user_id` is written to `decision_details.approver_user_id`.
- **Timestamp:** Unix timestamp in `decision_details.decision_timestamp`.
- **Rationale:** The approver must provide a brief rationale (minimum 10 characters) before the system finalizes the approval. For auto-approvals, the rationale is `"Auto-approved after silent acceptance period."`.
- **Digital Witness:** The system computes a SHA-256 hash of the change request record (including `proposed_changes`, `feedback_log`, and `decision_details`) and stores it in a `proof_hash` column. This provides tamper-evidence for compliance and dispute resolution.
- **Approval propagation:** Once approved, the change request status becomes `Approved`, and the system triggers version creation (§6).

---

## 6. Version Creation

### 6.1 How an Approved Change Creates a New PRD Version
1. **Lock the base version** — The `target_prd_version_id` row remains in the database but its `is_current_live` is set to `FALSE`.
2. **Apply the diff** — The system deep-merges `proposed_changes` into the base version's `prd_data`. The merge strategy is shallow for scalar fields and recursive for nested objects.
3. **Insert new version** — A new row is inserted into `PRD_Versions`:
   - `version_id`: auto-increment.
   - `project_id`: same as base.
   - `timestamp`: current Unix timestamp.
   - `approved_by_user_id`: from `decision_details.approver_user_id`.
   - `based_on_version_id`: `target_prd_version_id`.
   - `prd_data`: merged JSON blob.
   - `is_current_live`: `TRUE`.
4. **Link change request** — The `ChangeRequest` record is updated: `resulting_prd_version_id = new_version_id`.
5. **Enforce uniqueness** — The partial unique index `idx_prd_versions_live` on `(project_id, is_current_live)` ensures only one version is live per project at any time.

### 6.2 Mutation Log Capture
Every approved change generates a **Mutation Log Entry**:
- Stored in the project-local `mutation_log.jsonl` and mirrored to a `Mutations` SQLite table.
- Format:
  ```json
  {
    "mutation_id": "uuid",
    "change_request_id": 7,
    "version_from": 12,
    "version_to": 13,
    "timestamp": 1715587200,
    "diff_summary": { "fields_changed": 3, "fields_added": 1, "fields_removed": 0 },
    "authority": "FinalSay",
    "approver_id": "founder_01"
  }
  ```
- The mutation log is append-only and powers the version lineage graph.

### 6.3 Stakeholder Notification
Upon version creation:
- **Interactive Web:** A "New Version Available" banner appears. Stakeholders can toggle a version-comparison view showing exactly what changed since they last reviewed.
- **Email Digest:** If the stakeholder has email notifications enabled, they receive a summary of the approved change with a link to the live PRD package.
- **Department Channels:** Changes flagged as "major" or "critical" trigger a notification to the relevant department's collaboration channel (e.g., Slack, Teams — via configured webhook).
- **Progress Celebration:** In alignment with the "Fun Mandate," the UI shows a brief celebratory state: "PRD v13 is live — 3 new alignments discovered!"

---

## 7. Rejection Path

If a change request is rejected (status: `Rejected`):
1. `decision_details` is populated with rejection rationale.
2. No new PRD version is created.
3. `resulting_prd_version_id` remains `NULL`.
4. A rejection notification is sent to the original proposer.
5. The proposer may create a **new** change request with revised `proposed_changes`, starting the cycle again.

---

## 8. State Machine Summary

```
[Created] ──► PendingAssessment ──► (silent period) ──► [Auto-Approved] ──► Version Created
                    │
                    ▼ (objection raised)
              PendingFeedback ──► (PO mediation) ──► (compromise) ──► [Approved] ──► Version Created
                    │                                    │
                    ▼ (stalemate)                        ▼
              PendingDecision ──► Final Say ──► [Approved/Rejected]
```

---

## Summary

The st8 Change Proposal Workflow treats PRD evolution as a **gated, mediated negotiation** rather than direct editing. Changes are detected via schema diffs, mutation logs, or manual stakeholder input. A `ChangeRequest` record captures the diff, rationale, and impact assessment, then enters a seven-phase objection cycle: silent acceptance, objection surfacing, Product Owner alternative generation, refinement questioning, counter-suggestions, compromise or Final Say escalation, and finally decision logging with PRD update. The diff engine uses `SchemaCardEmitter.diff()` for code-linked changes, conversation comparison for stakeholder-derived changes, and document diff for prose changes. Approval gates are tiered: minor changes auto-approve, major changes require stakeholder vote, and critical changes escalate to the predefined Final Say authority. Every approval is signed, timestamped, and hashed. An approved change spawns a new `PrdVersion` with lineage tracking via `based_on_version_id`, an immutable mutation log entry, and celebratory stakeholder notification. This bridges agile iteration with formal change control, ensuring the PRD package remains aligned, auditable, and stakeholder-validated as it evolves toward LOCK.
