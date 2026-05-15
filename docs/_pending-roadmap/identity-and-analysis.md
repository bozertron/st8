# Roadmap — Identity & Analysis

Pulled from the founder's explicit priorities, batch 025's "Dead Modules Wiring" deep-dive, and the gaps surfaced during this cluster's fact-finding pass.

---

## Priority 1 — Founder-Critical (do this first)

### P1.1 — Wire `path-generator.js` end-to-end (FOUNDER #1)

**The "yellow file → signal path → output" workflow.** Today there's nothing between "this file is RED/YELLOW" and "what do I do about it." path-generator produces a `MigrationStep[]` array from a `SemanticGraph`; we need to surface it.

Surface area to build:

- `POST /api/signal-path { fileNodeId, graphId }` → `{plan, outcome, reasons, visualization}` in `src/core/server/app.js`. Synchronous; runs path-generator over current persistence state.
- Terminal command `show-path <file>` in the phreak terminal. Stdout-renders the migration step sequence with explanatory reasons.
- Visualization in dive-in panel. Render the step chain as a vertical signal-path (nodes coloured by health, edges by step kind). Founder wants this as the daily-driver view; ~half-day if we skip visualization and return JSON, full day with a basic SVG render.
- Sample path runs on `node start.js .` for self-introspection — st8 must be able to explain its own dead modules to itself.

**Dependency:** none — path-generator runs synchronously on an analyzed semantic graph. The graph is already built by `data-ingestion.js`. Doesn't need Sonic, doesn't need background-indexer.

### P1.2 — Wire `insight-store.js` as INDEX_COMPLETE subscriber

Today the schema is created on first construction but nothing writes to it. Effort: register a P=35 INDEX_COMPLETE subscriber that walks `file_registry` and calls `addInsightsBatch` for: RED files (severity=error, category=orphan), low-reachability GREENs (severity=warning, category=under-imported), files with no exports (severity=info, category=consumed-only).

Once populated, the constellation/file-explorer can finally answer "why is this file RED" via a `GET /api/insights?filePath=<path>` lookup. The data layer exists — only the producer is missing.

### P1.3 — Add `/api/file-identity/<fingerprint>` endpoint

Founder flagged this as needed for the ticket pipeline. Returns the full identity bundle for a given fingerprint:

```json
{
  "file": { /* file_registry row */ },
  "intent": { /* file_intent row */ },
  "card": { /* parsed .st8/schema-cards/<flat>.json */ },
  "mutations": [ /* file_mutation_log entries */ ],
  "insights": [ /* once P1.2 lands */ ],
  "connections": { "imports": [], "importedBy": [] }
}
```

Single read-path for any downstream tool (ticket emitter, LLM brief generator, the eventual Louis lock-checker) to ask "tell me everything about this file."

---

## Priority 2 — Foundational Wiring (next session)

### P2.1 — Wire `relationship-analyzer.js`

924 lines, Stage 2 of the integr8 pipeline. Detects circular deps via Tarjan SCC, classifies dependencies (SAFE / NEEDS_REWRITE / CONFLICT / MISSING), detects structural-subtyping breaking changes. Register as an INDEX_COMPLETE subscriber at P=25 (before gap-analyzer reads cards so gap-analyzer can incorporate the conflict signal into D5).

`POST /api/analyze-relationships { currentGraphId, fileNodeId, targetPages }` per batch 025 roadmap.

### P2.2 — Wire `report-generator.js` behind a `report` terminal command

Markdown migration report — executive summary, graph properties, conflicts, steps, risks, next steps. ~2 hours once P1.1 (path-generator) is producing output. The killer feature: copy-paste the report into Claude/ChatGPT and get back a structured ticket.

`POST /api/generate-report { planId }` → markdown text.

### P2.3 — Resurrect `graph/traversal.js` for impact-chain queries

13 exports including `findPaths`, `computeImpactChain`, `findImportsOf`, `findExportsOf`. Currently reads from GraphNodes/GraphEdges tables that nothing populates today. Two paths:

1. **Lazy:** rewrite `graph/traversal.js` to read from st8's main `file_registry` + `connections` tables (skip the GraphNodes/GraphEdges abstraction).
2. **Sonic-aligned:** populate GraphNodes/GraphEdges from connections during the indexer's Pass-2 wiring step. Aligns with batch 027's sonic-foundation direction.

Lazy is faster. Sonic-aligned is right.

`GET /api/graph/deps?nodeId=<id>` and `GET /api/graph/impacts?nodeId=<id>` per batch 025.

### P2.4 — Per-parser documentation pass

Each of the seven parsers (overview, store, route, command, type, ui, parser-persistence) needs a one-paragraph header documenting: (a) input contract (file types, glob patterns), (b) output contract (the shape of the returned report), (c) how its output is consumed downstream. Pure docs change, low risk.

### P2.5 — Document the manifest's intentional omissions

Add a header comment to `manifest-generator.js` (and the `St8SchemaCard` definition in st8-types.js) noting that `lifecyclePhase` and `birthTimestamp` are intentionally omitted from `connection-state.json`. This decision came out of batch 025 and is currently only captured in the bible — a load-bearing schema choice that needs to live next to the code.

---

## Priority 3 — Cleanup & Hardening

### P3.1 — Replace `intent-seeder.js`'s pattern matcher with AST-driven heuristics

The 70-entry FILENAME_PURPOSE_MAP with first-match-wins is fragile. Better: combine the AST `exports[]` + `imports[]` already on the schema card to produce a structured-purpose object (type, role, primary external dep, primary export shape). The string-rendering layer stays the same — the heuristic engine becomes data-driven instead of pattern-stack-ordered.

Bonus: eliminates the double-read pass (current code reads each file twice in seedFile).

### P3.2 — Unify schema-card + ai-signal.toml under one type contract

Today `St8SchemaCard` in st8-types.js is the canonical shape for cards but ai-signal.toml's `[files.ai_signal]` block is hand-rolled in manifest-generator.js. Define a shared `AiSignalEntry` type, derive both the JSON manifest and the TOML output from it. Single source of truth for "what does the AI see."

### P3.3 — Migrate to a real schema migration framework

Today `ST8_SCHEMA` is a single CREATE-TABLE-IF-NOT-EXISTS string in `indexer.js`. Column additions (like `needsAIReview` + `tripleAtCount`) require ad-hoc ALTER scripts. Adopt a versioned-migration approach (knex-style or hand-rolled SQL files in `migrations/`) with a `schema_version` table tracking applied migrations. Aligns with the on-disk identity story — st8 of all projects shouldn't allow silent schema drift.

### P3.4 — Add unit tests for gap-analyzer's 6 dimensions

Fixture-driven: a known set of card JSONs in `__fixtures__/`, expected D1-D6 output, assert each metric. Currently zero tests for ~650 lines of analysis logic.

### P3.5 — `birthTimestamp` mtime-fallback warning

When `fs.statSync().birthtime` is unavailable (some filesystems / OSes return epoch), the indexer falls back to mtime. This silently mutates fingerprint on every file touch. Either log a one-time warning per indexer run, or refuse to fingerprint and surface as a YELLOW status. Identity is the foundation — silent drift is worse than a loud failure.

### P3.6 — CI regression test for schema-card prune

Force-check FC2 catches accumulated stale cards at runtime. Add a CI-level test: take a fixture project, index it, delete a file, re-index, assert the corresponding card file is gone. Codifies the batch 026 fix.

---

## Priority distribution

- **P1 (3 items):** path-generator wiring (FOUNDER #1), insight-store wiring, /api/file-identity
- **P2 (5 items):** relationship-analyzer, report-generator, traversal, parser docs, manifest schema docs
- **P3 (6 items):** intent-seeder refactor, type-contract unification, schema migrations, gap-analyzer tests, birthTimestamp warning, prune CI test

Total: 14 items, weighted heavily toward wiring the dead 2,894 lines (relationship-analyzer + path-generator + report-generator + traversal) that already exist and are tested by their TS origins.
