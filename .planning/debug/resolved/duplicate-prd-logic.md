---
status: resolved
trigger: "Fix the duplicate PRD logic in server.js — _handlePrd is a hand-copied subset of prdGenerator.js that has already diverged. Should import and reuse the existing module."
created: 2026-05-13T00:00:00Z
updated: 2026-05-13T00:00:00Z
---

## Current Focus

hypothesis: "_handlePrd in server.js contains hand-copied PRD generation logic that is a strict subset of prdGenerator.js but has already diverged (missing summary table, missing dependency dedup, missing metadata fields). Fix: import loadSchemaCards and generatePRD from prdGenerator and replace inline logic."
test: "Replace inline code with module import, verify server still generates PRD correctly"
expecting: "Identical or improved PRD output, single source of truth for PRD generation"
next_action: "Apply fix to server.js"

## Symptoms

expected: "Single source of truth for PRD generation via prdGenerator.js module"
actual: "_handlePrd has hand-copied, diverged logic that is a subset of prdGenerator.js"
errors: "N/A — code smell / maintenance blocker, not runtime error"
reproduction: "Compare server.js lines 798-843 with prdGenerator.js loadSchemaCards + generatePRD + generateCardMarkdown"
started: "Present since _handlePrd was introduced"

## Eliminated

(none — root cause is obvious from code comparison)

## Evidence

- timestamp: 2026-05-13T00:00:00Z
  checked: "server.js _handlePrd (lines 776-854) vs prdGenerator.js"
  found: "Lines 798-805 duplicate loadSchemaCards; Lines 811-843 duplicate generatePRD+generateCardMarkdown. Divergence: missing summary table, no dependency dedup, no metadata fields (isEntryPoint, reachabilityScore, impactRadius)"
  implication: "Any future PRD enhancement must be made in two places, guaranteed to diverge further"

- timestamp: 2026-05-13T00:00:00Z
  checked: "prdGenerator.js exports"
  found: "Exports: loadSchemaCards, groupByLifecyclePhase, generateCardMarkdown, generatePRD, writePRD, main — all needed functions are already exported"
  implication: "Fix is straightforward: import and call existing functions"

## Resolution

root_cause: "_handlePrd contains hand-copied PRD generation logic from prdGenerator.js that has already diverged (missing summary table, missing dependency deduplication, missing metadata fields). This violates DRY and creates a maintenance burden where any PRD enhancement must be applied in two places."
fix: "Replace inline PRD generation in _handlePrd with import of { loadSchemaCards, generatePRD } from './prdGenerator' and call those functions."
verification: "Smoke test passed — 39 cards loaded, 9099-char PRD generated with full format. Import resolution confirmed."
files_changed: ["backend/server.js"]
