# W1-10: ACTU8 Framework Deep Research Report

**Date:** 2026-05-13  
**Source Files Analyzed:** 8  
**Researcher:** File Search Agent  

---

## 1. The Atomic DB Philosophy

The stereOS framework (from `/home/bozertron/Software Projects/stereOS/IP for actu8/prd_user_stories_framework.md`) defines an **"Atomic DB"** as a system where the PRD is a **living database, not a static file** (line 49). This is a paradigm shift from traditional document-based PRDs:

- **PRD as Queryable Data:** Rather than a markdown document that decays, the PRD is an emergent property of the codebase itself -- generated on-demand from structured schema cards that capture identity, intent, exports, imports, and lifecycle state.
- **Data Over Documents:** The framework explicitly states "Provisions for 'Atomic DB' (PRD as a living database, not a file)." This means the PRD is not authored; it is *derived* from the ground truth of the code.
- **Implications for st8:** st8 already stores all file metadata in SQLite (`st8.sqlite`) and emits deterministic JSON schema cards to `.st8/schema-cards/`. The PRD should be a *view* over this data, recomposed on every request, not a snapshot written to disk.

---

## 2. The Void / Gold / Physics Framework

The stereOS framework is built on three aesthetic/philosophical pillars that govern all user stories and UI decisions:

| Concept | Definition | PRD/User Story Application |
|---------|-----------|---------------------------|
| **The Void** | Pure Obsidian (`#0A0A0B`) background. No boxes, no frames. UI elements "emerge from the void" only when summoned. | **Void Check:** Is the feature minimal? No clutter? Does it respect negative space? |
| **Gold** | The "Happy Path" is visually highlighted in Gold/Dark Goldenrod. Intelligence elements are saffron. | **Gold Check:** Is the primary user journey clearly illuminated and prioritized? |
| **Physics** | Elements "float" and "dance" with physics-based emergence. Spatial placement is dynamic. | **Physics Check:** Do elements "emerge" or "float" naturally? Is the interaction physically intuitive? |

These are not just visual guidelines -- they are **acceptance criteria gates**. Every user story in the framework must pass all three checks before it is considered complete (lines 63-68).

**For st8 PRD generation:** These checks represent a *quality layer* that a basic schema-card-to-markdown converter does not address. A true PRD composition engine would need to evaluate whether generated requirements satisfy Void (minimalism), Gold (clarity of happy path), and Physics (natural emergence/flow).

---

## 3. User Story Template

The stereOS framework enforces a strict user story format (lines 57-68):

```markdown
## [ID] Story Title
**As a** [Persona]
**I want to** [Action]
**So that** [Benefit/Truth]

### Acceptance Criteria
- [ ] [Void Check] Is it minimal? (No clutter)
- [ ] [Gold Check] Is the "Happy Path" highlighted in Gold?
- [ ] [Physics Check] Do elements "emerge" or "float" naturally?
- [ ] criteria 1
- [ ] criteria 2
```

**Key insights:**
- The three checks (Void, Gold, Physics) are **mandatory** acceptance criteria, not optional design notes.
- The template demands a persona-action-benefit structure with explicit truth-seeking ("So that [Benefit/Truth]").
- This is a **higher-level abstraction** than what st8 currently generates. st8's PRD (Task 17 / Task 20) outputs file-centric documentation, not user-centric stories.

---

## 4. st8 Current PRD Capability

### Task 17: PRD Generation Script (`.planning/st8_identity_system/17_prd_generation.md`)
- **Status:** Spec defined but `generate-prd.js` does **not exist** in the repo.
- **Original spec:** A temporary script that reads `.st8/schema-cards/*.json`, groups by `lifecyclePhase`, and writes a markdown file to `.planning/st8_identity_system/PRD.md`.
- **Content per file:** fingerprint, status, purpose, exports (with signatures/return types), and dependencies.

### Task 20: PRD Endpoint (`.planning/st8_identity_system/20_prd_endpoint.md`)
- **Status:** The `_handlePrd` route **exists in `backend/server.js`** (line 115) and is **wired and functional**.
- **Implementation:** Delegates to `backend/prdGenerator.js` (`loadSchemaCards` + `generatePRD`), which **does exist** and is a mature module (200 lines).
- **Output:** Markdown with header, summary table, and per-phase file listings.

**Verdict:** The basic PRD generation pipeline is **partially implemented** -- the endpoint and generator module exist, but the original `generate-prd.js` temporary script from Task 17 was never created (and may no longer be needed since `prdGenerator.js` supersedes it).

---

## 5. What's Already Built in st8

st8 has a surprisingly rich identity infrastructure that maps closely to Orchestr8 concepts:

| st8 Artifact | Location | Purpose | Orchestr8 Equivalent |
|-------------|----------|---------|---------------------|
| **File Registry** | `backend/persistence.js` -- `file_registry` table | Canonical store of every code file with fingerprint, hash, status, lifecycle phase | File nodes / vertex table |
| **Schema Cards** | `.st8/schema-cards/*.json` | Deterministic, diffable JSON snapshots per file (identity + AST + intent + mutations) | `_schema` metadata / vertex properties |
| **Connections** | `backend/persistence.js` -- `connections` table | Source-target dependency graph with confidence scores and resolution status | Edge table |
| **Mutation Log** | `backend/persistence.js` -- `file_mutation_log` table | Append-only audit of every CREATE, EDIT, RENAME, REFACTOR, LOCK, PRODUCTION, PURGE | Audit log / changelog |
| **Intent Store** | `backend/persistence.js` -- `file_intent` table | Human/AI-authored purpose, behavior dependencies, value statements | `intent` annotations |
| **Activity Log** | `backend/persistence.js` -- `activity_log` table | System-level events (indexer runs, user actions) | System telemetry |
| **Settings** | `backend/persistence.js` -- `st8_settings` table | Key-value configuration with categories | Config store |
| **Lifecycle Phases** | `backend/st8-types.js` -- `LifecyclePhase` enum | CONCEPT -> LOCKED -> WIRING -> DEVELOPMENT -> PRODUCTION | State machine / version stages |
| **Fingerprint System** | `backend/st8-types.js` -- `generateFingerprint()` | Stable identity: `{filepath}||{birthTimestamp}` | `PrdVersion` / composite key |
| **AST Extraction** | `lib/utils/astParser.js` (referenced) | Extracts imports, exports, signatures, return types | Static analysis / codegen metadata |
| **Graph Builder** | `lib/commands/graphBuilder.js` (referenced) | Builds dependency graph, classifies health (GREEN/YELLOW/RED) | Graph analysis engine |
| **Schema Card Emitter** | `backend/schemaCardEmitter.js` | Emits deterministic JSON cards on every index run and file change | Schema emission / snapshotter |
| **Schema Card Printer** | `backend/schemaCardPrinter.js` | Human-readable `.txt` fallback + pruning logic | Human interface / printer |
| **Notification Bus** | `backend/notificationBus.js` (referenced) | SSE-based pub/sub for mutations | Event stream |
| **Server Endpoints** | `backend/server.js` | HTTP API including `/api/prd`, `/api/mvp-lock`, `/api/concept-file`, `/api/production-promote` | REST API surface |

**Key mapping to Orchestr8's `PrdVersion`:**
- Orchestr8's `_schema` and `fields` are directly analogous to st8's `St8SchemaCard` shape (lines 79-119 of `st8-types.js`).
- Orchestr8's version identifier is analogous to st8's `fingerprint` (`filepath||birthTimestamp`).
- Orchestr8's mutation tracking is analogous to st8's `file_mutation_log`.

---

## 6. What's Missing

From the **Gap Analysis** (`IDENTITY-SYSTEM-GAP-ANALYSIS.md`) and code inspection:

### Critical Bugs (3)
- **C1:** Recursive `.txt` emission loop -- phantom files get indexed, printed, re-indexed. **Partially fixed** by guards in `schemaCardPrinter.js` and `IGNORE_DIRS` updates.
- **C2:** Schema cards lose AST data on file edit -- empty `{imports: [], exports: []}` passed to `emitCard()` in watcher. **Not fixed** in `backend/index.js`.
- **C3:** `.st8/` not in `.gitignore`. **Not fixed**.

### High Priority Missing Features (5)
- **H1:** Phase 6 API endpoints (`/api/concept-file`, `/api/mvp-lock`, `/api/prd`, `/api/production-promote`). **Actually FIXED** -- all four routes and handlers exist in `server.js` as of this inspection. The gap analysis is outdated.
- **H2:** Frontend SSE integration -- no `EventSource` consumer in frontend. **Still missing**.
- **H3:** PRD generation -- `generate-prd.js` script missing, but `prdGenerator.js` exists and `/api/prd` works. **Partially implemented**.
- **H4:** Connections not populated in schema cards -- `schemaCardEmitter.js` line 124 had a TODO. **Actually FIXED** -- `emitAllCards()` now queries `persistence.getConnectionsForFile()` and builds `importedBy`/`imports` arrays (lines 128-133).
- **H5:** Timestamped `.txt` files accumulate. **Actually FIXED** -- `schemaCardPrinter.js` now has `pruneOldCards(maxPerFile = 10)` (lines 194-257).

### Medium/Low Issues (10+)
- Schema drift between `indexer.js` and `persistence.js` (M2).
- `updated_at` vs `updatedAt` naming inconsistency (M1).
- Duplicate `require('./manifestGenerator')` in `index.js` (M4).
- `.html` files not in `CODE_EXTENSIONS` (L3).
- CLI `--diff` mode stub (L1).

**Updated Verdict:** The codebase is in better shape than the gap analysis suggests. Many "NOT IMPLEMENTED" items from the gap analysis have since been built. The remaining critical work is **C2 (AST loss on edit)** and **H2 (frontend SSE)**.

---

## 7. The Missing Composition Engine

This is the **central insight** of this research:

> st8 has excellent **extraction** (schema cards capture every file's identity, AST, intent, and mutations) but has **no composition engine** that elevates these atomic facts into product-level meaning.

### What the current `prdGenerator.js` does:
- Loads schema cards.
- Groups by `lifecyclePhase`.
- Outputs markdown with file path, fingerprint, status, purpose, exports, and dependencies.

### What it does NOT do (and what a Composition Engine would do):

| Capability | Current State | Composition Engine Need |
|-----------|--------------|------------------------|
| **User Stories** | None generated | Derive "As a [persona], I want [capability]" from intent + exports + dependents |
| **Epic Grouping** | Groups by `lifecyclePhase` only | Group by functional domain (e.g., "Auth System", "API Layer") using connection graph clustering |
| **Dependency Narrative** | Lists raw import sources | Explains *why* dependencies exist and what architectural layer they represent |
| **Void/Gold/Physics Checks** | Not evaluated | Assess whether features satisfy minimalism, happy-path clarity, and natural emergence |
| **Acceptance Criteria** | Not generated | Derive criteria from export signatures, mutation types, and status transitions |
| **MVP Scope Definition** | Not generated | Use `LOCKED` phase + entry points to define the minimal viable surface |
| **Risk Assessment** | Not generated | Flag `RED` status files with high `impactRadius` as blockers |
| **Temporal Narrative** | Mutation count only | Tell the story of how the system evolved: CONCEPT -> DEVELOPMENT -> LOCKED -> PRODUCTION |
| **Cross-Reference Validation** | Not performed | Verify that every export mentioned in a user story has a corresponding schema card |

### What a Composition Engine would need:

1. **Intent Parser:** Convert `file_intent.purpose` + `dependsOnBehavior` + `valueStatement` into structured user story fragments.
2. **Graph Analyzer:** Use the `connections` table to find clusters (modules), entry points, and critical paths.
3. **Status Interpreter:** Map `GREEN/YELLOW/RED` + `reachabilityScore` + `impactRadius` into risk language.
4. **Phase Narrator:** Explain what each lifecycle phase means for the product (CONCEPT = "planned but not built", LOCKED = "MVP scope frozen", etc.).
5. **Template Engine:** Apply the stereOS user story template (As a / I want / So that + Void/Gold/Physics checks).
6. **Markdown Composer:** Assemble all of the above into a living PRD that can be regenerated on demand.

**The key architectural decision:** Should the composition engine be a **static generator** (run once, write markdown) or a **dynamic query layer** (PRD rendered on-the-fly from the DB, like a view)? The Atomic DB philosophy argues for the latter.

---

## 8. Fingerprint / Identity System Mapping

### st8's Identity Model

From `backend/st8-types.js`:

```javascript
const St8FileEntry = Object.freeze({
    fingerprint: '',          // {filepath}||{birthTimestamp}
    filepath: '',
    filename: '',
    sha256Hash: '',           // Content version
    status: 'RED',
    reachabilityScore: 0.0,
    impactRadius: 0,
    lifecyclePhase: 'DEVELOPMENT',
    birthTimestamp: '',       // Never changes
    lastModified: '',         // Changes on edit
    lastIndexed: '',          // Changes on index run
    isEntryPoint: false
});
```

**Fingerprint = `{filepath}||{birthTimestamp}`**
- Uses `||` separator (fixed from old `:` separator to avoid ISO 8601 ambiguity).
- Stable for the lifetime of the file (even across renames, though rename creates a new fingerprint).
- `birthTimestamp` is file `birthtime` from `fs.statSync()`.

### Mapping to Orchestr8 Concepts

| Orchestr8 Concept | st8 Equivalent | Location | Notes |
|------------------|----------------|----------|-------|
| `PrdVersion` | `fingerprint` | `st8-types.js` | Composite key: filepath + birth time |
| `_schema` | `St8SchemaCard` | `st8-types.js` | Extended shape with AST + intent + mutations |
| `fields` | `exports` array | `astParser.js` | Each export has `name`, `kind`, `signature`, `returnType` |
| `relations` | `connections` table | `persistence.js` | Source/target fingerprints with `connectionType` and `confidenceScore` |
| `state` / `status` | `FileStatus` enum | `st8-types.js` | GREEN, YELLOW, RED, CONCEPT, LOCKED, PRODUCTION |
| `mutationLog` | `file_mutation_log` table | `persistence.js` | Append-only with `mutationType`, `actor`, `timestamp`, `changedFields` |
| `intent` | `file_intent` table | `persistence.js` | `purpose`, `dependsOnBehavior`, `valueStatement`, `authoredBy` |
| `lifecycle` | `LifecyclePhase` enum | `st8-types.js` | CONCEPT, LOCKED, WIRING, DEVELOPMENT, PRODUCTION |

### Identity System Strengths
- **Deterministic:** Same file always generates the same fingerprint (unless birthtime changes).
- **Content-addressed hashing:** `sha256Hash` captures content version independently of identity.
- **Temporal stability:** `birthTimestamp` never changes, so the fingerprint is stable across edits.
- **Rich metadata:** The schema card is a comprehensive snapshot that can be diffed, validated, and queried.

### Identity System Gaps
- **Rename handling:** A file rename creates a brand new fingerprint, orphaning the old mutation log and intent. No migration/alias mechanism exists.
- **Cross-project identity:** Fingerprints are project-local. No global identity for shared modules.
- **Semantic versioning:** No version number (v1, v2) -- only timestamps and hashes.

---

## Summary & Recommendations

1. **The Atomic DB vision is partially realized.** st8 has the data layer (SQLite registry, schema cards, mutation log) but the PRD is still a static markdown view. The next step is to treat the PRD as a **query interface** over the database.

2. **The Composition Engine is the biggest gap.** st8 extracts beautifully but does not compose. A new module (e.g., `backend/prdComposer.js`) should bridge schema cards -> user stories -> PRD, applying the Void/Gold/Physics framework as quality gates.

3. **Leverage existing artifacts:**
   - Use `file_intent` table to seed user story "So that" clauses.
   - Use `connections` table + `isEntryPoint` to define MVP boundaries.
   - Use `mutation_log` to generate a "Development Chronicle" section.
   - Use `lifecyclePhase` to color-code PRD sections (CONCEPT = gray, DEVELOPMENT = blue, LOCKED = gold, PRODUCTION = green).

4. **Fix C2 before building on top.** The AST data loss on file edit means schema cards decay during active development. This undermines the "living database" promise.

5. **Consider the stereOS template as the target format.** The current PRD generator outputs file-centric docs. The next iteration should output **user-story-centric** docs using the strict stereOS template, with Void/Gold/Physics checks derived from the schema data.
