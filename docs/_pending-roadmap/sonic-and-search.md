# Roadmap — `sonic-and-search`

Source mix: `docs/Sonic/pm1-background-indexer-vision.md` (the 5-layer plan), bible Batch 027, and agent inferences from the source files themselves.

Priority labels:
- **P1** — direct unblocker for PM-1 progression OR fixes a non-functional dormant module
- **P2** — completes a Layer 2-4 stride or a high-value adjacent feature
- **P3** — polish, hardening, deferred-by-founder ideas

---

## P1 — Revive `background-indexer.js`

The file is dormant: top-level requires reference `multiPassAnalyzer.js` and `precisionCapture.js` which don't exist in st8, plus `./sonicClient.js` which after Batch 027 lives at `../search/sonic-client`.

Two paths the founder can take:

1. **Port the missing modules from MAESTRO.** Bring `multiPassAnalyzer.{js,ts}` and `precisionCapture.{js,ts}` across the same way Sonic was — drop into `docs/`, then re-home into `src/features/indexing/` or `src/features/analysis/`. This unlocks PM-1 Layer 2 directly.
2. **Replace the dependencies with direct `InsightStore` writes.** `src/features/analysis/insight-store.js` already exists. Skip multi-pass entirely for v1; just have `background-indexer` queue projects, run the integr8 pipeline, and write whatever insights it produces straight into InsightStore. Layer 2 becomes a future enhancement.

Founder explicitly deferred this call. Either path also requires:
- Fix the `sonicClient.js` require to `../search/sonic-client`
- Add a caller (today nothing `require`s background-indexer, so even fixing the requires only makes it loadable, not active)

---

## P1 — Sonic ticket-indexer

The ticket system (`/api/tickets`) does SQLite scans today. Push every ticket's `userNote` + `identityBundle` (filepath, scope) into Sonic under a new bucket (e.g. `BUCKET_TICKETS = 'tickets'`), so:

- `GET /api/tickets?q=foo` becomes a Sonic SUGGEST + KV intersect (microseconds)
- ticket search-as-you-type in the shelf chat input becomes instant
- ticket→file linking (which file does this ticket pertain to) is FST-fast

Bucket structure (proposed):

```
COLLECTION = 'codebase'
BUCKET_TICKETS = 'tickets'  # objectId = "ticket_<id>", text = userNote + filepath + scope tags
```

Add an `INDEX_COMPLETE` (priority 30 or so) subscriber that re-pushes any tickets whose source files were touched in the index pass.

---

## P1 — Restore the founder-intended exchange surface (ground-plane bridge)

Today `ground-plane.js` only verifies `~/.local/share/com.scaffolder.app/`. Nothing watches it; nothing writes there.

Build the bridge:
- **st8 → maestro write side.** On `INDEX_COMPLETE`, write a `graph-snapshot.json` (or symlink to `.st8/integr8-graph.db`) into the shared data dir.
- **maestro → st8 read side.** Add `chokidar` watcher on `<groundPlane.data>/resolutions/*.json`. When a maestro resolution lands, ingest it into InsightStore + Sonic.
- **Resolve the `APP_ID` question first** (see ticket file): is st8 sharing `com.scaffolder.app` or splitting to `com.st8.app`? Bridge design depends on it.

Founder explicitly deferred this. Unblocks LLM-colleague handoff (Layer 3 indirectly).

---

## P2 — PM-1 Layer 2: Multi-Pass Analyzer

From the vision doc. Five passes wired as `INDEX_COMPLETE` subscribers feeding `InsightStore`:

1. **Pass 1 — Baseline.** File complexity (cyclomatic, lines, nesting), export/import ratios, structural metrics. Reuses `typhonjs-escomplex` (new dep).
2. **Pass 2 — Dependency Health.** Circular dependency detection, version-conflict scan, breaking-change predictions from edge type+direction.
3. **Pass 3 — Pattern Detection.** Recurring issues (3+ similar findings in a directory), anti-patterns from a heuristics library.
4. **Pass 4 — Security.** Vulnerability scan, sensitive-data flow tracking, compliance checks.
5. **Pass 5 — Meta-Architectural.** System-wide patterns, scaling limits, abstraction gaps. Operates over the cross-file accumulated insights from passes 1-4.

Output: `InsightRecord` rows in `FileInsightSlots` (see vision doc schema). Each pass adds confidence-scored findings. Vision-doc effort: 140 h.

Implementation note: depends on either P1 (revive background-indexer) or a direct hook subscriber. Probably simpler to have each pass be its own hook subscriber, no central `BackgroundIndexer` coordinator.

---

## P2 — PM-1 Layer 3: Hook system + LLM experts

The hook system (`src/core/hook-registry.js`) already exists. What's missing: the **expert prompts** and the **LLM_PROVIDERS-driven invocation path**.

Build:
- `LLM_PROVIDERS` config (env: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) and a provider abstraction
- Hook types: `NewInsight`, `Pattern` (fires when 3+ similar insights in same module), `Threshold`, `Scheduled`
- LLM experts (each is a prompt template + post-processor):
  - **PatternAnalyst** — "find recurring patterns, identify root causes"
  - **PerformanceAdvisor** — "suggest specific optimizations"
  - **ArchitectureReviewer** — "propose systemic refactorings"
  - **SecurityAnalyst** — "identify vulnerabilities and mitigations"
- Workflow: insights posted → InsightStore updated → `InsightHookManager.fireHooks()` → expert prompt formatted → LLM call → `Opportunity` written to OpportunityCatalog

This is also the **shelf chat input** integration. The user types into the shelf, st8 routes to the right expert based on intent, Sonic surfaces context, the LLM responds. Vision-doc effort: 90 h.

---

## P2 — PM-1 Layer 4: Opportunity Classifier

From vision doc. The `Opportunity` schema is fully spec'd:

```ts
interface Opportunity {
  opportunityId: string;
  category: 'granular' | 'meta_architectural';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedComponents: string[];
  pattern: { name, occurrences, trend };
  estimatedEffort: 'trivial' | 'small' | 'medium' | 'large' | 'epic';
  estimatedImpact: 'low' | 'medium' | 'high' | 'transformational';
  proposedOptimization: string;
  relatedOpportunities: string[];
  discoveredAt: timestamp;
}
```

Build:
- `OpportunityCatalog` table (SQLite) + Sonic indexing under `BUCKET_OPPORTUNITIES`
- Query API: `listOpportunities(filters)`, `getImpactRoadmap()` (sorted by impact/effort, quick wins first), `getPatternInsights()`
- Endpoint: `GET /api/opportunities` with filter+sort query params

Vision-doc effort: 60 h. Depends on Layer 3 LLM output to populate.

---

## P2 — Sonic daemon health-check endpoint

Add `GET /api/sonic/status` to st8's HTTP server. Returns `daemon.getStatus()`:

```json
{
  "running": true,
  "pid": 12345,
  "port": 1491,
  "host": "127.0.0.1",
  "since": "2026-05-15T…",
  "restartCount": 1,
  "storePath": "/path/to/.st8/sonic-store",
  "lastError": null
}
```

Cheap to add — `sonic-daemon.js` already exports `getStatus`. Useful for: UI status indicator, smoke-test assertions, ops/monitoring. Hook into the existing routes file in `src/core/server/`.

---

## P3 — PM-1 Layer 5: Simulation engine

The **visualization** piece is partly done (Phase B + Phase C of an earlier batch shipped the D3 graph + opportunity explorer chrome). What's left is the **simulation engine**:

- Compute baseline metrics from the current graph (complexity, coupling, cohesion, test coverage)
- Apply proposed changes conceptually (e.g., "what if we split this module into two?")
- Output delta metrics: complexity %, maintainability improvement, coupling reduction
- Risk assessment: breaking changes, rollback feasibility, tests required

Reuses GraphNodes/GraphEdges. Vision-doc effort: 110 h. Depends on Layer 4 opportunities being populated to drive what gets simulated.

---

## P3 — Sonic store GC / per-target rebuild

Sonic's KV store grows indefinitely as projects are re-indexed (FST consolidates but RocksDB doesn't auto-GC orphaned word→ID mappings). Add either:

- a `--rebuild-sonic` CLI flag that wipes `<targetDir>/.st8/sonic-store/` and re-indexes
- a POP-old-IDs phase in `sonic-indexer.js` that tracks the previous indexing's ID set and POPs the difference
- a periodic compaction call (`TRIGGER consolidate` then a manual SST compaction)

Low impact (Sonic is small) but worth doing before any long-running production project hits 6 figures of objects.

---

## P3 — Sonic daemon auto-restart on crash

Upstream Sonic v1.4.9 panics on broken-pipe (ticket noted). Today, a crashed Sonic stays dead until next `daemon.start()`. Add:

- `child.on('exit')` handler that, if exit was unexpected (non-SIGTERM/SIGKILL from our `stop()`), automatically calls `start()` again with a backoff (1s, 5s, 30s)
- Cap at 3 consecutive crashes → mark dead, force SQLite-only mode, log loudly

Pairs with the daemon health-check endpoint (P2) for ops visibility.

---

## P3 — Sonic daemon test suite

No tests today. Add at minimum:
- binary_missing → graceful degrade
- adopt-if-already-running (spawn a fake TCP listener on 1491 first)
- health-check timeout → SIGTERM cleanup
- idempotent re-start
- stop() does not hang the event loop (currently uses sync spin-wait — see ticket)

---

## P3 — CI sync check for canonical `sonic.cfg`

Add a CI step (or pre-commit hook) that:
- Parses `docs/Sonic/sonic.cfg`
- Asserts: `port = 1491`, `${SONIC_STORE_PATH}` is referenced in `[store.kv]` and `[store.fst]`, `auth_password` exists
- Optionally: diff against the daemon's expected fields

Cheap insurance against MAESTRO drift breaking the integration.
