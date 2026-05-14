# DETAILED LINE-BY-LINE ANALYSIS: `backend/prdGenerator.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/prdGenerator.js`
**Total Lines:** 200
**Analyzed:** 2026-05-13

---

## Lines 1–11: File Header / JSDoc Module Comment
- **What this section does:** Declares the file purpose — reads schema cards from `.st8/schema-cards/` and generates a PRD markdown file. Documents CLI usage: `node backend/prdGenerator.js [targetDir]`.
- **What triggers it:** N/A (documentation only)
- **What it calls:** N/A
- **What calls it:** N/A
- **Dependencies:** N/A
- **Status:** WORKING
- **Gap:** None

---

## Line 13: `'use strict';`
- **What this section does:** Enables strict mode for the entire file.
- **What triggers it:** Module load
- **What it calls:** N/A
- **What calls it:** Always runs when module is loaded
- **Dependencies:** None
- **Status:** WORKING
- **Gap:** None

---

## Lines 15–16: Import Statements
- **What this section does:** Loads Node.js built-in modules.
- **What triggers it:** Module load
- **What it calls:** `require('fs')` → Node.js filesystem module; `require('path')` → Node.js path module
- **What calls it:** All functions in this file use `fs` and `path`
- **Dependencies:** `fs` (Node.js built-in), `path` (Node.js built-in)
- **Status:** WORKING
- **Gap:** None — only built-in modules, no external dependencies

---

## Lines 18–50: `loadSchemaCards(cardsDir)`
- **What this section does:** Reads all `.json` files from the given directory, parses each into a JS object, and returns an array of parsed schema cards. Skips individual files that fail to parse (line 43–46) rather than aborting.
- **What triggers it:** Called programmatically — by `main()` at line 170, and by `server.js:947`
- **What it calls:**
  - `fs.existsSync(cardsDir)` — line 24
  - `fs.readdirSync(cardsDir)` — line 28
  - `path.join(cardsDir, file)` — line 39
  - `fs.readFileSync(filePath, 'utf-8')` — line 40
  - `JSON.parse(content)` — line 41
- **What calls it:**
  - `main(targetDir)` at line 170
  - `server.js:947` via `require('./prdGenerator').loadSchemaCards`
- **Dependencies:** `fs`, `path`, schema card JSON files on disk in `.st8/schema-cards/`
- **Status:** WORKING
- **Gaps / Issues:**
  1. **No JSON schema validation** — Parsed cards are used directly (line 42) without verifying required fields like `filepath`, `fingerprint`, `status`, `intent`, `exports`, `imports`, `lifecyclePhase`. A malformed JSON file missing these fields will silently produce broken markdown downstream.
  2. **Silent failure on parse errors** — Line 44 logs to `console.error` but continues. If a critical schema card is malformed, the PRD will be silently incomplete with no clear indication beyond a console error.
  3. **Synchronous I/O** — Uses `readdirSync` and `readFileSync`. Acceptable for CLI / one-shot generation, but blocks the event loop when called from the server endpoint (`_handlePrd` in `server.js:930–959`). For 40 files this is negligible, but it doesn't scale.

---

## Lines 52–65: `groupByLifecyclePhase(cards)`
- **What this section does:** Groups an array of schema card objects by their `lifecyclePhase` field. Cards without `lifecyclePhase` get bucketed under `'UNKNOWN'`.
- **What triggers it:** Called by `generatePRD()` at line 118
- **What it calls:** Nothing — pure data transformation
- **What calls it:** `generatePRD(cards)` at line 118
- **Dependencies:** Input must be an array of objects with optional `lifecyclePhase` field
- **Status:** WORKING
- **Gaps / Issues:**
  1. **Currently degenerate** — All 40 existing schema cards have `lifecyclePhase: "DEVELOPMENT"` (confirmed in actual output PRD.md line 11). The grouping logic works but produces a single group. The `'UNKNOWN'` fallback (line 60) never triggers with current data.
  2. **No sorting** — Phases are output in insertion order (key enumeration order of `byPhase`). If phases existed, they would not be sorted in lifecycle order.

---

## Lines 67–110: `generateCardMarkdown(card)`
- **What this section does:** Converts a single schema card object into a markdown string with headings and bullet lists.
- **What triggers it:** Called by `generatePRD()` at line 138
- **What it calls:** Nothing — pure data transformation
- **What calls it:** `generatePRD()` at line 138, iterates over `phaseCards`
- **Dependencies:** Schema card object must have expected fields
- **Status:** PARTIAL — has dead code paths and data contract mismatches
- **Gaps / Issues:**

  ### CRITICAL — Data Contract Mismatch: `exp.signature` and `exp.returnType` (Lines 85–86)
  ```
  Line 84:  md += `  - ${exp.kind} \`${exp.name}\``;
  Line 85:  if (exp.signature) md += ` — \`${exp.signature}\``;
  Line 86:  if (exp.returnType) md += ` → ${exp.returnType}`;
  ```
  The actual schema card `exports` objects contain these fields:
  ```json
  {
    "exportVisibility": "named",
    "kind": "variable",
    "line": 47,
    "name": "runIntegr8Command",
    "sourceFile": "/absolute/path/to/file.js"
  }
  ```
  **`signature` and `returnType` do not exist in the schema card JSON format.** Lines 85–86 will always evaluate to falsy (`undefined`) and never contribute output. This means the exports section is incomplete — function signatures and return types are never rendered in the PRD.

  **Fix:** Either:
  - (a) Update the schema card emitter/indexer to populate `signature` and `returnType` fields, or
  - (b) Remove the dead code from lines 85–86, or
  - (c) Use `exp.line` and `exp.sourceFile` which DO exist and could provide useful context

  ### WARNING — Unused Schema Card Fields (Lines 97–106)
  The code renders `isEntryPoint`, `reachabilityScore`, and `impactRadius`. These fields exist in the actual data but:
  - `isEntryPoint` is always `false` for all 40 cards → line 99 never renders
  - `reachabilityScore` is always `0` → line 102 renders "Reachability Score: 0" for every card (informationally useless)
  - `impactRadius` is always `0` → the `> 0` guard on line 104 correctly suppresses it

  These are not bugs but the rendered "Reachability Score: 0" lines are noise in the output.

  ### INFO — Missing Intent Fields
  Line 78 only renders `card.intent?.purpose`. The schema cards also contain:
  - `intent.dependsOnBehavior` — not rendered
  - `intent.valueStatement` — not rendered

  These are available in the data and could enrich the PRD.

---

## Lines 112–143: `generatePRD(cards)`
- **What this section does:** Assembles the complete PRD markdown: header with metadata, summary table of lifecycle phases, then detailed per-phase sections with card markdown.
- **What triggers it:** Called by `main()` at line 176, and by `server.js:948`
- **What it calls:**
  - `groupByLifecyclePhase(cards)` — line 118
  - `generateCardMarkdown(card)` — line 138
- **What calls it:**
  - `main(targetDir)` at line 176
  - `server.js:948` via `require('./prdGenerator').generatePRD`
- **Dependencies:** `groupByLifecyclePhase`, `generateCardMarkdown`
- **Status:** WORKING
- **Gaps / Issues:**
  1. **No metadata filtering** — The PRD header (lines 120–123) includes `cards.length` and `Object.keys(byPhase).length` which are correct.
  2. **No content sorting** — Cards within each phase are output in the order they were read from disk (filesystem enumeration order). This is deterministic but arbitrary — not alphabetical by filepath or by any logical grouping.
  3. **Summary table only counts files** — The summary table (lines 127–131) shows phase name and file count. It doesn't surface other useful aggregates (e.g., total exports, total dependencies, status breakdown).

---

## Lines 145–158: `writePRD(prdContent, outputPath)`
- **What this section does:** Writes the PRD markdown string to a file, creating intermediate directories if needed.
- **What triggers it:** Called by `main()` at line 177
- **What it calls:**
  - `path.dirname(outputPath)` — line 151
  - `fs.existsSync(outputDir)` — line 152
  - `fs.mkdirSync(outputDir, { recursive: true })` — line 153
  - `fs.writeFileSync(outputPath, prdContent, 'utf-8')` — line 156
- **What calls it:** `main(targetDir)` at line 177
- **Dependencies:** `fs`, `path`, filesystem write access
- **Status:** WORKING
- **Gaps / Issues:**
  1. **Not called from server path** — The server endpoint (`server.js:930–959`) calls `generatePRD()` and sends the result directly in the HTTP response. It does NOT call `writePRD()`. So the `/api/prd` endpoint returns the PRD but does not persist it to disk. Only the CLI path (`main()`) writes to disk.
  2. **No backup/overwrite protection** — If the PRD file already exists, it is silently overwritten (line 156). No backup, no warning, no versioning.

---

## Lines 160–184: `main(targetDir)`
- **What this section does:** Orchestrates the full PRD generation pipeline: resolves paths → loads cards → generates PRD → writes to disk.
- **What triggers it:** CLI invocation at line 189, or programmatic call
- **What it calls:**
  - `path.join(targetDir, '.st8', 'schema-cards')` — line 165
  - `path.join(targetDir, '.planning', 'st8_identity_system', 'PRD.md')` — line 166
  - `loadSchemaCards(cardsDir)` — line 170
  - `generatePRD(cards)` — line 176
  - `writePRD(prdContent, outputPath)` — line 177
- **What calls it:**
  - CLI: `require.main === module` block at line 187–190
  - Can be called programmatically via `module.exports.main`
- **Dependencies:** `fs`, `path`, `loadSchemaCards`, `generatePRD`, `writePRD`
- **Status:** WORKING
- **Gaps / Issues:**
  1. **Hardcoded output path** — Line 166 hardcodes the output to `.planning/st8_identity_system/PRD.md`. This path is not configurable via CLI args or environment variables. To write elsewhere, you must modify the source code.
  2. **No `--help` or usage text** — The CLI accepts an optional `[targetDir]` argument (line 188) but provides no help text if invoked incorrectly.
  3. **`process.exit(1)` on error** — Line 182 calls `process.exit(1)` which kills the entire Node.js process. When called programmatically (not via CLI), this is destructive. A thrown error would be more appropriate for programmatic callers.

---

## Lines 186–190: CLI Entry Point Guard
- **What this section does:** Standard Node.js pattern — runs `main()` only when the file is executed directly (not when `require()`d as a module).
- **What triggers it:** `node backend/prdGenerator.js [targetDir]`
- **What it calls:** `main(targetDir)` — line 189
- **What calls it:** Node.js runtime when `require.main === module`
- **Dependencies:** `process.argv`
- **Status:** WORKING
- **Gap:** None

---

## Lines 192–200: Module Exports
- **What this section does:** Exports all 6 functions for programmatic use by other modules.
- **What triggers it:** Module load (when `require()`d)
- **What it calls:** N/A
- **What calls it:**
  - `server.js:944`: `const { loadSchemaCards, generatePRD } = require('./prdGenerator')`
  - Any other module: `require('./prdGenerator').main`, `.writePRD`, etc.
- **Dependencies:** N/A
- **Status:** WORKING
- **Gap:** None — clean named exports

---

# CONNECTION MAP

## What Triggers PRD Generation?

| Trigger | Entry Point | Path |
|---------|------------|------|
| **CLI** | `node backend/prdGenerator.js [dir]` | `main()` → `loadSchemaCards()` → `generatePRD()` → `writePRD()` |
| **HTTP API** | `GET /api/prd` | `server.js:_handlePrd()` (line 930) → `loadSchemaCards()` → `generatePRD()` → returns markdown in response body |

## What Other Files Get Called?

| File | How Used | Line |
|------|----------|------|
| `fs` (Node.js built-in) | File reading, writing, existence checks | 15, 24, 28, 40, 152, 153, 156 |
| `path` (Node.js built-in) | Path joining, directory extraction | 16, 39, 151, 165, 166 |

**prdGenerator.js does NOT import or call any other project modules.** It is a leaf dependency — it consumes data (JSON files from disk) and produces output (markdown string/file). It has zero coupling to the rest of the backend codebase.

## Where Does the PRD Get Written?

| Context | Output Destination | Triggered By |
|---------|-------------------|--------------|
| CLI mode | `{targetDir}/.planning/st8_identity_system/PRD.md` (hardcoded, line 166) | `main()` → `writePRD()` |
| Server/API mode | HTTP response body (`Content-Type: text/markdown`) — NOT written to disk | `server.js:_handlePrd()` |

---

# CONNECTIONS TO OTHER FILES

## Who Imports prdGenerator.js?

| File | Line | Functions Used |
|------|------|---------------|
| `backend/server.js` | 944 | `loadSchemaCards`, `generatePRD` (destructured) |

**Only one consumer exists.** `prdGenerator.js` is used exclusively by `server.js`'s `_handlePrd()` method.

## Who Writes to `.st8/schema-cards/`?

The schema card JSON files that `prdGenerator.js` reads are produced by:
- `backend/schemaCardEmitter.js` — emits schema cards to disk
- `backend/indexer.js` — indexes codebase and produces card data

## Where Is the PRD Read?

The generated PRD at `.planning/st8_identity_system/PRD.md` is a static markdown file. No code in the project programmatically reads it back.

---

# @@@ HANDLING

**No `@@@` symbols found** in `prdGenerator.js`. The file is clean of `@@@` markers.

Note: The `???` symbols that appear in schema card `intent` fields (e.g., `"purpose": "Code or data generation ???"`) come from the **indexer**, not from `prdGenerator.js`. The PRD generator faithfully renders these `???` markers as-is into the output markdown (line 78: `card.intent?.purpose || '(not set)'`).

---

# SUMMARY OF FINDINGS

| # | Lines | Severity | Issue |
|---|-------|----------|-------|
| 1 | 85–86 | **DEAD CODE** | `exp.signature` and `exp.returnType` fields don't exist in schema card JSON. These conditionals never execute. |
| 2 | 42 | **DATA CONTRACT GAP** | No JSON schema validation on parsed cards. Malformed cards produce broken markdown silently. |
| 3 | 182 | **BEHAVIORAL RISK** | `process.exit(1)` kills the process even when called programmatically (not via CLI). |
| 4 | 166 | **INFLEXIBILITY** | Output path is hardcoded. No CLI flag or env var to customize. |
| 5 | 930–959 | **DESIGN GAP** | Server endpoint returns PRD in response but never persists it to disk. Two different behaviors for the same generation. |
| 6 | 156 | **NO GUARD** | `writePRD` silently overwrites existing PRD file without warning or backup. |
| 7 | 137 | **NO SORTING** | Cards within a lifecycle phase are output in filesystem enumeration order, not alphabetical or logical order. |
| 8 | 78 | **INCOMPLETE** | Only `intent.purpose` is rendered. `intent.dependsOnBehavior` and `intent.valueStatement` are available but ignored. |
| 9 | 102 | **NOISE** | `reachabilityScore: 0` renders for every card — provides no useful information. |
| 10 | 40–41 | **SYNC I/O** | Synchronous file reads block the event loop when called from server context. |
