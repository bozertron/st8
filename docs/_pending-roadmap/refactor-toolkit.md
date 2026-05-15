# Refactor Toolkit & Meta — Roadmap

Priorities are P0 (do soon — cosmetic/maintainability debt that's accumulating) through P3 (do if/when needed).

---

## P0 — Low effort, high cleanup value

### 0.1 Clean up empty `lib/` + `backend/` directories

The `lib/`, `lib/utils/`, `lib/commands/`, `lib/commands/integr8/` directories all exist but are empty (originals retired to OGB in batch 019; `stage-originals.js` doesn't `rmdir` empty parent dirs). The `backend/` directory contains only 3 non-code files: `SCHEMA-CARD-EMITTER-REPORT.md`, `SECURITY-AUDIT-H1.md`, `package.json`.

Steps:
1. Decide fate of the 3 files in `backend/` — likely options:
   - Move `*.md` reports to `docs/archive/` (preserve history)
   - Delete `backend/package.json` (git has it)
2. Remove empty dirs: `rmdir lib/utils lib/commands/integr8 lib/commands lib backend` (after the 3 files are dealt with).
3. Commit as a small cleanup batch in the bible — Batch NNN — `repo-root-cleanup`.

### 0.2 Add `scripts/migration/cleanup-empty-dirs.sh` helper

A bottom-up `find ... -empty -delete` walk scoped to `lib/`, `backend/`, and (after the founder destroys it) `OGB/`. Idempotent. Safe to run repeatedly.

Pseudo-shape:
```bash
#!/usr/bin/env bash
# Removes empty directories under known refactor-era trees. Safe + idempotent.
for root in lib backend OGB src/0_core src/0_features src/0_shared src/0_frontend; do
  if [ -d "$root" ]; then
    find "$root" -depth -type d -empty -delete
  fi
done
```

Worth wiring into the bible's "after-each-batch" checklist.

### 0.3 Add a top-of-file navigation index to `st8_bible.md`

The bible is 2943 lines with 27 batch entries. Add at the top (after the title, before "What is ST8?"):

```markdown
## Navigation

- [Architecture Overview](#architecture-overview) — L37
- [Refactor Findings](#refactor-findings--2026-05-14) — L1604
- [Refactor Batch Log](#refactor-batch-log--2026-05-14) — L1705
  - Batch 001 — shared — L1712
  - Batch 002 — core-database — L1743
  - ...
  - Batch 027 — sonic-foundation — L2868
```

Generate from `grep -n "^## \|^### Batch" st8_bible.md`. Could be a small script: `scripts/maintenance/regenerate-bible-toc.js`.

### 0.4 Delete or archive the 12 stale `0_*` planning docs at repo root

```
0_BACKEND_INDEX.md
0_FRONTEND_INDEX.md
0_INDEX_JS_INDEX.md
0_INDEXER_JS_INDEX.md
0_LIB_COMMANDS_INDEX.md
0_LIB_UTILS_INDEX.md
0_LINE_COUNT_REPORT.md
0_LINE_COUNT_REPORT_V2.md
0_MASTER_INDEX.md
0_PERSISTENCE_JS_INDEX.md
0_PRESSURE_TEST.md
0_SERVER_JS_INDEX.md
```

All reference the `backend/` and `lib/` paths that no longer exist. The `src/0_*` skeleton was deleted in batch 021 but these root-level planning docs survived. Options:
- **Delete** (git preserves history; cleanest)
- **Archive** under `docs/archive/pre-refactor-planning/` (preserves discoverability)
- **Rewrite** for the new `src/` tree (most work; only worth it if anyone actually uses them)

Recommend archive. Half-day of work to `git mv` everything and update any external references.

---

## P1 — Medium effort, real value

### 1.1 Archive `manifest.json` per batch

Today `scripts/migration/manifest.json` is overwritten every batch. The description + generatedAt + per-move metadata is lost — only the moves themselves survive in `move-history.json`.

Add `scripts/migration/manifest-history/` directory. On successful verify, `verify.js` copies the current `manifest.json` to `manifest-history/<batch-name>.json` before appending to `move-history.json`. Idempotent (overwrite is fine if the batch is re-verified).

Benefit: full reconstruction of "what did batch 005 actually move, and what was its declared rationale?" without git archaeology.

### 1.2 Reverse-history lookup CLI

`node scripts/migration/which-batch.js <path>` — given:
- A current src/ path (`src/features/indexing/background-indexer.js`)
- An OGB path (`OGB/lib/commands/typeParser.js.txt`)
- An old path (`backend/persistence.js`)

…return the batch that moved it, with the full from/to entry.

Implementation: read `move-history.json`, scan `completedBatches[].moves` for any match (basename normalize so OGB `.txt` paths match too). Print `Batch <name> (<completedAt>): from=<from>, to=<to>`.

### 1.3 Commit-hash verification script

26 of 27 bible batches reference a short commit hash (`ab4d038`, `8d1e930`, etc.). Add `scripts/maintenance/verify-bible-commits.js`:
- Parse `st8_bible.md` for `**Commit:** `<hash>`` lines.
- For each, run `git cat-file -e <hash>` to confirm reachable.
- Optionally `git log --oneline <hash>` to confirm it's still on the branch (vs floating dangling).
- Report any missing/orphaned hashes.

Useful if anyone ever force-pushes or rebases the branch — bible references shouldn't silently rot.

### 1.4 Make `verify.js` auto-detect `client: true`

Today the manifest flag `client: true` is set per-move to switch verify.js from full `require()` to `node --check` syntax probe. Easy to forget.

Replace with path-prefix auto-detection: any move where `to.startsWith('src/frontend/')` is treated as client. Keep the explicit flag as override for edge cases.

Benefit: removes a manual-process failure mode that produced noisy WARNs in past batches.

### 1.5 Document `expectedOrphan` list in `check-conventions.js`

The orphan-detection in check #6 has a hardcoded `expectedOrphans` Set with 3 entries (lines 329-331):
```js
['src/core/server/main.js', 'src/core/database/verify-persistence-fixes.js', 'src/frontend/app.js']
```

Bible batch 021 documents 6 actual orphan candidates worth human-allowlisting:
- `ground-plane.js` — CLI/diagnostic entry point
- `integr8/index.js` — feature entry point
- `migration-executor.js` — CLI tool
- `background-indexer.js` — dormant pending sonic restoration
- `graph/builder.js` — used by indexer but possibly via dynamic require
- `graph/traversal.js` — same

Audit each. If genuinely an entry point or intentional orphan, add to `expectedOrphans` with a reason comment. If actually orphaned-by-mistake, that's a separate ticket.

---

## P2 — Larger work, conditional value

### 2.1 SQLite schema migration framework

No versioned migrations exist today. Schema lives inline in `src/core/database/persistence.js` as `CREATE TABLE IF NOT EXISTS …` statements in `initialize()`. Any future schema change needs:
- A `scripts/migrations/` directory with `<timestamp>-<name>.sql` files.
- A `schema_migrations` table in SQLite tracking which migrations have run.
- A runner that, on startup, identifies pending migrations and applies them transactionally.

**Don't build this unless a schema change is actually needed.** Premature otherwise. But it's worth designing the convention now so the first real change isn't a panic build.

### 2.2 Tier 1 signal tests — schema contracts at internal handoffs

Deferred in batch 021. Build only if a regression slips past Tier 2 (pipeline invariants) and Tier 6 (identity-delta).

Targets would be the internal handoffs:
- `indexer → manifestGenerator` — what shape does `indexer` produce, what does `manifestGenerator` consume?
- `parserPersistence → graphPersister` — DB rows shape contract.
- `dataIngestion → relationshipAnalyzer/pathGenerator/reportGenerator` — the integr8 pipeline's intermediate types.

Each contract would be expressed as a runtime-checkable schema (zod, ajv, or hand-written assertion functions) wrapped around each handoff. Cost: real engineering work. Skip until justified.

### 2.3 Auto-cleanup OGB tooling

Batch 019 documents OGB cleanup as "founder-driven destruction" — i.e. the founder manually `rm`s when ready. Possible enhancements:

- **Confirmation prompt:** `node scripts/migration/destroy-ogb.js` — interactive; lists every file, asks confirm-y/N, deletes if confirmed.
- **Git-aware delete:** verify each OGB file's text content matches its git-history version of the original. If yes, safe to destroy. If no (somehow tampered), abort with a diff.
- **Empty-dir cleanup** (covered by P0.2 above).

Low priority — manual destruction is fine and OGB isn't a big footprint.

---

## P3 — Speculative

### 3.1 Move-batch dry-run mode

`node scripts/migration/move-files.js --dry-run` — print the moves it would do without copying. Run rewrite-imports + verify in dry-run too. Useful for reviewing a manifest before pulling the trigger.

Today the workflow is "edit manifest, run move, run rewrite, run verify" — but rewrite + verify are post-copy, so if the manifest is wrong you've already created files. Dry-run mode would catch errors earlier.

### 3.2 Per-feature schema-card freshness

Schema cards in `st8_json/schema-cards/` are static — they were generated pre-refactor and never re-emitted. Today `check-identity-delta.js` does the comparison; nothing actively refreshes the cards.

If schema cards become a living artifact (e.g. used by the PRD wizard or some future agent), the freshness story needs answering. For now they're treated as a historical baseline.

### 3.3 Migration-batch rollback automation

`node scripts/migration/rollback-batch.js <batch-name>` — undo a batch by:
1. Reading the batch's entry from `move-history.json`.
2. For each move: copy `to` back to `from`.
3. Rewrite imports in reverse direction (the rewriter is symmetric — just swap `from` and `to` in the history map).
4. Remove the batch from `move-history.json`.

Speculative because today rollback is "git revert <commit-hash>" which works fine. Worth building only if non-git rollback ever becomes needed (e.g. partial-batch rollback).

---

## Priority distribution

| Priority | Count |
|---------:|------:|
| P0 | 4 |
| P1 | 5 |
| P2 | 3 |
| P3 | 3 |
| **Total** | **15** |

Most P0 items are <1 day. P1 is a week of cleanup if all are tackled. P2 is gated on real need. P3 is "if/when."
