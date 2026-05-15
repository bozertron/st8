# Identity-and-Analysis Review

## Wave 3A Review

Reviewer audited 7 tickets executed by `wave-3a-executor`: [0, 1, 9, 10,
11, 15, 16]. All 7 verdicts: **ack**.

### Test-suite verification
- `npm test` → tests:175 / suites:0 / pass:175 / fail:0 / cancelled:0 /
  skipped:0 / todo:0 / duration ~2.4s. Confirms the executor's
  108 → 175 claim.
- Mutation probe: replaced the multi-fingerprint dedup block in
  `src/features/schema-cards/emitter.js` with a passthrough; reran
  `node --test tests/features/schema-cards/emitter-prune.test.js` →
  6 pass / 2 fail (both MULTI-FINGERPRINT probes failed in BOTH row
  orderings — exactly the bug claim). Restored the file. The test
  genuinely guards the bug, not a coincidence of iteration order.

### Live identity-preservation probe (ticket 15)
Manual reproduction with `St8Persistence` real instance + `fs.writeFile`
+ `fs.utimes`:
- PASS1 origin `stat-birthtime` → birthTimestamp recorded.
- File mutated; mtime advanced to 2027-01-01 via `utimesSync`.
- PASS2 origin `reused-persisted` → birthTimestamp UNCHANGED.
- `FP1 === FP2` → **true**. Identity preserved across mtime move.

### Live multi-fingerprint card-clobber probe (ticket 9)
Manual probe with two registry rows for `app.js` (2020 + 2027
birthTimestamps), tested in BOTH orderings:
- Original order `[older, newer]` → card on disk carries `sha-NEW` /
  `birthTimestamp=2027-01-01`. emitted=1, pruned=0.
- Reversed order `[newer, older]` → identical result, `sha-NEW`.
Newer wins regardless of input order. Confirmed.

### Cheats considered and dismissed
- **"persistence reuse only tested when persistence is brand-new"** — the
  birth-timestamp.test.js end-to-end probe uses a stub persistence (fake
  `getFileByPath`), not a real `St8Persistence`. This was the executor's
  declared shape and is acceptable: the unit-test scope is the helper's
  contract, not the SQLite layer. My live probe above used a real
  `St8Persistence` and the contract held end-to-end.
- **"single-read spy is incorrectly scoped"** — the test in
  `tests/features/analysis/intent-seeder.test.js:59` filters reads by
  exact absolute target path (`reads.filter((p) => p === target)`), so
  it counts ONLY reads of the file under test, ignoring schema-card
  JSON reads or other ambient fs.readFileSync traffic. Correctly scoped.
- **"multi-fingerprint test hides the bug via iteration order"** — the
  test file contains TWO probes (`MULTI-FINGERPRINT — two registry rows`
  and `MULTI-FINGERPRINT — reverse order`). Mutation probe confirmed
  BOTH fail when dedup is removed. Not order-coincidental.
- **"isUnreliableBirthtime misses real cases"** — cutoff is 1980-01-01.
  Covers epoch + pre-1980 FUSE sentinels. tmpfs/overlayfs/Docker volumes
  on modern kernels record real birthtime > 2020 → unaffected. The
  failure mode "tmpfs returns current time as birthtime" is harmless
  (real timestamp wins, no fallback). Heuristic is sound for the
  current node version.
- **"identity-risk.json is an unwired stub"** — TRUE in the strict
  sense: `grep -rn 'identity-risk' src/` finds writes in indexer.js
  but no readers anywhere. The executor's residualConcerns flag the
  write path's robustness (concern #3) but do NOT explicitly call it
  out as an unconsumed artifact. Logging this in the reviewNote.
  Not a kickback — the console.warn line IS the live introspection
  surface today; the JSON file is a forward-compatible extension
  point. Wave 3B/3C should wire a consumer.

### Cross-cluster flags worth founder attention
1. **Historical multi-fingerprint stale rows** in the live st8.sqlite
   (flagged by FC3 force-check; called out in tickets 9 + 15
   residualConcerns). Wave 3A's fixes prevent NEW drift; they do NOT
   clean existing accumulation. Requires either (a) a per-fingerprint
   `pruneFilesNotIn` variant in persistence or (b) a one-off cleanup
   migration. Should be a lifecycle-and-eventing ticket.
2. **`.st8/identity-risk.json` has no reader.** Future Wave 3B or 3C
   should wire it into force-checks or the gap-analyzer surface, or
   the executor's claim "consumed by introspection tools / force-
   checks" remains aspirational. Flagged here for the cluster's final
   reviewer.
3. **Parser files (ticket 10) + ast-parser.js (ticket 11) are compiled-
   from-TS artifacts.** New JSDoc headers are at risk of being
   overwritten if upstream maestro-scaffolder-tool re-vendors. The
   executor's recommendation to mark these as `linguist-generated=true`
   in `.gitattributes` (and to document the vendor-out recipe) should
   be acted on by whichever cluster owns vendor hygiene.
4. **`start.js` runs the backend with `cwd: __dirname`** (the st8
   install dir) regardless of the target arg. Schema cards, manifests,
   and `.st8/identity-risk.json` therefore land in /home/user/st8 not
   the target directory when invoked via start.js. This is pre-3A and
   out of scope for this audit, but observed during manual probes and
   worth surfacing.

### Safe for Wave 3B?
**Yes.** The identity contract is intact:
- birthTimestamp reuse works against a real persistence instance.
- Multi-fingerprint card emission is deterministic (newest wins).
- Single-read consolidation is properly scoped.
- Data-ingestion validators are present and tested.
- FILENAME_PURPOSE_MAP ordering is locked by a regression test.

Wave 3B can build on this foundation. Specifically:
- `path-generator.js` wiring (FOUNDER PRIORITY #1, ticket 4) can rely
  on stable fingerprints surviving across runs — the
  mutation_log / intent / connections graph is no longer at risk of
  silent drift.
- `insight-store.js` wiring (ticket 8) can use fingerprint as a stable
  primary key without ad-hoc reconciliation.
- `relationship-analyzer.js` decision (ticket 3) is independent of
  3A's surface area.

No source-code changes needed before 3B starts.
