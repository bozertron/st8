# Refactor-Toolkit Review

## Wave 6A Review

**Reviewer:** wave-6a-reviewer
**HEAD at review:** 2c5987f
**Tests:** 373 pass / 0 fail / 0 skip / 0 todo
**Pre-flight:** OK (no src/0_ drift, canonical src/ layout, entry chain OK)

### Scope

17 tickets annotated as resolved-upstream by wave-6a-executor at indices [0, 1, 2, 3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 31].

### Citation verification

| Citation | Tickets | Verified by | Result |
|---|---|---|---|
| `bbfa7cc` "batch 019 — stage 46 migrated originals into OGB/" | 0-3 (lib/ deletion) | `git show bbfa7cc --stat`; commit message explicitly states "lib/utils/, lib/commands/, lib/commands/integr8/, backend/ now have no .js files". `ls lib/` → "No such file or directory". | ack |
| `93ffd40` "archive 14 outdated root .md indexes" | 8-19 (twelve 0_*_INDEX.md, 0_LINE_COUNT_REPORT*, 0_MASTER_INDEX, 0_PRESSURE_TEST) | `git show 93ffd40 --name-status` shows D for all twelve referenced 0_*.md files. `ls 0_MASTER_INDEX.md 0_FRONTEND_INDEX.md 0_BACKEND_INDEX.md` → all missing. | ack |
| `4fea31f` "fix(sonic): repair broken require paths in background-indexer" | 31 | `git show 4fea31f` touches `src/features/indexing/background-indexer.js`. `node -e "require('.../background-indexer')"` prints LOAD OK. | ack |

### Count audit

`jq '[.[] | select(.executedBy == "wave-6a-executor")] | length'` → **17** (matches prompt expectation).

### Verdict

All 17 tickets receive `verdict: "ack"`. Every claimed upstream resolution was independently reproducible at HEAD 2c5987f. No source/test edits were made by Wave 6A (annotation-only commit), and the full suite remains at 373/373.

Cluster remains open for Waves 6B–6D.

## Wave 6B Review

Reviewer: `wave-6b-reviewer` (NOT cluster-close — that is 6D).
Reviewed commits: `7f66a1a`, `0fd0e2f`, `76f108b`, `2c39a28` (range `2c5987f..2c39a28`).
Tickets covered: 7 (indices 4, 5, 6, 7, 22, 23, 25 — `executedBy == "wave-6b-executor"`).

### Pre-flight

- `git ls-files src/0_` empty. `ls src/` shows `core features frontend shared`. Entry chain OK.
- Baseline `npm test`: 398 / 398 pass / 0 fail / 0 skipped / 0 todo. Matches prompt expected baseline.

### Ticket verifications

**Tickets 4-7 — backend/ deletion (commit `7f66a1a`).**
- `ls backend/ 2>&1` → "No such file or directory".
- `grep -rE "require\([\'\"](\.{1,2}/)*backend/|from [\'\"](\.{1,2}/)*backend/" src/ scripts/ tests/` → zero hits.
- Remaining `"backend/"` mentions in src/ files (hook-registry.js, force-checks.js, indexer.js, check-identity-delta.js, check-conventions.js) are all comment-/string-only documentary references to the pre-refactor layout — verified by `grep -n` inspection.
- Verdict: ack ×4.

**Ticket 22 — orphan over-reporting fix (commit `0fd0e2f`).**
- Read `collectHtmlScriptRefs()` (lines 285-317) and `checkOrphans()` (lines 319-388 of check-conventions.js). Confirmed it parses `src/frontend/index.html` `<script src="...">` tags, resolves relative srcs to absolute paths, and seeds `referenced`. `main()` is gated behind `require.main === module`. `collectHtmlScriptRefs` + `checkOrphans` are exported.
- Ran `node scripts/migration/check-conventions.js` end-to-end: Tally now reports **Orphan modules: 11** (matches the executor's claim, down from the pre-fix 16).
- `node --test tests/scripts/migration/check-conventions.test.js`: 5 pass, 0 fail.
- Restored unrelated side-effect files (results.gap-analysis.md, results.verify.json) via `git checkout --`.
- Verdict: ack.

**Ticket 23 — verify.js parse heuristic (commit `76f108b`).**
- Read `detectBrowserOnly()` (lines 123-155 of verify.js). Counted **10 patterns**: `window`, `document`, `navigator`, `location`, `localStorage`, `sessionStorage`, `history.{pushState|replaceState|back|forward}`, `typeof window|document|navigator`, `customElements`, `HTMLElement`. All anchored with `(^|[^\w$])` (or `\b` for the typeof / HTMLElement forms) so lookalikes (`myWindow`, `documentation`) don't fire.
- Confirmed comment-stripping order: block comments via `/\/\*[\s\S]*?\*\//g` then full-line `//` comments via the filter — both happen BEFORE pattern matching.
- Wired into `isClient` at line 301: `m.client === true || heuristicBrowser`.
- `node --test tests/scripts/migration/verify.test.js`: 12 pass, 0 fail.
- Mutation probe (mandatory): removed the `window\s*[.\[]` pattern, re-ran the targeted suite → test "detects window.X member access as browser-only" failed (1 fail, 11 pass). Restored the pattern → 12 pass. Final diff of verify.js is empty.
- Verdict: ack.

**Ticket 25 — manifest-history backfill (commit `2c39a28`).**
- `wc -l scripts/migration/manifest-history.jsonl` → **12** entries (one per migrated batch from `ab4d038` shared → `9cca4b8` background-indexer).
- Spot-checked 3 entries (shared, analysis, background-indexer). Each carries `batch`, `description`, `generatedAt`, `verifiedAt`, `gitCommit`, `moves[]` — schema as claimed.
- Idempotency: re-ran `node scripts/migration/backfill-manifest-history.js` → "Done: 0 appended, 12 skipped." Line count remains 12.
- `node --test tests/scripts/migration/manifest-history.test.js`: 8 pass, 0 fail.
- Verdict: ack.

### Full suite

`npm test` after all verifications: **398 / 398 pass**, 0 fail, 0 skipped, 0 todo. Working tree clean (mutation probe restored cleanly, no residual results.*.json modifications committed).

### Verdict summary

7 ack / 0 kickback. All Wave 6B claims reproduce at HEAD `2c39a28` (since extended to `15b9822` by this review's annotation commit).

Cluster remains open for Waves 6C and 6D. JSON intentionally NOT renamed.


## Wave 6C Review

Reviewer: `wave-6c-reviewer` (NOT cluster-close — that is 6D).
Reviewed commits: `eea238d`, `98a1b33`, `76abc66`, `dbda6ba` (range `2c39a28..897a794`).
Tickets covered: 4 (indices 20, 21, 24, 26 — `executedBy == "wave-6c-executor"`).

### Pre-flight

- `git ls-files src/0_` empty. `ls src/` shows `core features frontend shared`. Entry chain OK.
- HEAD `897a794`. Baseline `npm test`: **413 / 413 pass / 0 fail / 0 skipped / 0 todo**. Matches prompt expected baseline.

### Ticket verifications

**Ticket 26 — batch 027 commit hash (commit `eea238d`).**
- Bible L3013 now reads `` **Commit:** `7f16a65` ``.
- `git show 7f16a65 --stat | head -10` → subject "feat(sonic): PM-1 Layer 1 — Sonic daemon + missing trio wired" (matches batch 027 sonic-foundation topic).
- Out-of-scope batch 002 gap is documented and not in this ticket's scope.
- Verdict: **ack**.

**Ticket 20 — bible TOC (commit `98a1b33`).**
- TOC structure exists at st8_bible.md L9-L76. Entry counts independently confirmed: **26 major sections + 27 batches = 53 rows**, matching the executor's claim.
- **DEFECT**: every line number in the TOC is systematically off by exactly 70 (the TOC's own inserted height). The executor computed targets before inserting the 70-line block.
  - TOC says batch 011 → L2065. Actual `^### Batch 011` is at **L2135** (delta +70).
  - TOC says batch 019 → L2374. Actual at **L2444** (delta +70).
  - TOC says batch 027 → L2868. Actual at **L2938** (delta +70).
  - Major sections shifted identically: "What is ST8?" claimed L9, actual L79; "Architecture Overview" claimed L37, actual L107.
- The TOC's self-caveat ("re-run grep if drift is suspected") does not excuse coordinates that are wrong on day 1.
- Fix is mechanical: add 70 to every line number in the TOC.
- Verdict: **kickback** (structure ack, coordinates broken).

**Ticket 24 — ogb-destroy.js (commit `76abc66`).**
- Dry-run: `node scripts/migration/ogb-destroy.js --dry-run` reports 48 files, 8 subdirs, Invariant A (no live require/import refs) PASS, planned actions printed (tar.gz backup → rm files → bottom-up rmdir → remove OGB/), and exits without touching the filesystem. Re-checked `ls OGB/` afterwards: untouched.
- Safety grep confirms: `BACKUP_DIR` path, `.tar.gz` tarball generation, Invariant A live-ref scan with regex covering `require('OGB/...')`, `require('./OGB/...')`, `require('../OGB/...')`.
- Default mode is dry-run; destruction requires explicit `--yes`.
- Targeted tests `node --test tests/scripts/migration/ogb-destroy.test.js`: **6 / 6 pass**.
- Verdict: **ack**.

**Ticket 21 — Tier 1 signal tests (commit `dbda6ba`).**
- Targeted suite `node --test tests/scripts/signal-tests/tier-1-schema-contracts.test.js`: **9 / 9 pass**. 3 handoff groups (H1 indexer→manifest-generator, H2 parser-persistence→graph-persister, H3 SchemaCard↔manifest-generator).
- **Mutation probe (mandatory) reproduced independently**: renamed `fingerprint:` → `fp_test:` at `src/features/schema-cards/manifest-generator.js:96`. Re-ran target suite: P1.3 ("end-to-end shape on representative input") failed AND its parent group H1 surfaced as failed (`# pass 8 / fail 1`). Restored the file byte-perfect; `git diff src/features/schema-cards/manifest-generator.js` is empty; target suite back to 9/9.
- Verdict: **ack**.

### Full suite

`npm test` after all verifications: **413 / 413 pass**, 0 fail, 0 skipped, 0 todo. Working tree clean post-mutation-restore.

### Verdict summary

**3 ack / 1 kickback**. Three claims (26, 24, 21) reproduce fully at HEAD `897a794`. Ticket 20's TOC structure is correct but its line numbers are unusable as a navigation aid until a +70 offset fix lands. Surfacing for 6D (final reviewer) or a follow-up sub-wave.

Cluster remains open for Wave 6D. JSON intentionally NOT renamed.
