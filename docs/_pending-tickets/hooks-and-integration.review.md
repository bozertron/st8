# Hooks-and-Integration Review

Cluster: hooks-and-integration-plumbing. This file accumulates reviewer findings
sub-wave by sub-wave. Each section's verdict counts cover only the tickets that
sub-wave executed. Tickets not yet executed are not annotated.

---

## Wave 2A Review

Reviewer: wave-2a-reviewer
Reviewed: 2026-05-15
Tickets in scope: indices 0, 1, 2, 8, 9, 10, 11, 20, 21, 22, 23, 24 (12 total)
Commits audited: `1d59f51..HEAD` filtered to wave-2a-executor authorship.

### Verdict counts

- **ack:** 11
- **defer-confirmed:** 1 (ticket 20)
- **kickback:** 0

### Commit-by-commit verification

| Ticket | Commit | Verdict | Verification |
|---|---|---|---|
| 0 | `bec7145` (Wave 1A) | ack | snake_case `target_fingerprint` absent from app.js; persistence-side validator now throws on the key, making silent recurrence impossible. Executor correctly did NOT redo the fix. |
| 1 | `008afbc` | ack | JSDoc rewritten to match COMMIT_RECORDED behavior (activity_log + FK rationale + batch 025 cross-reference). Payload shape matches hook-registry.js:57. |
| 2 | `05cc3e4` | ack | `HOOKS.TICKET_CREATED || 'ticket:created'` fallback is gone; bare reference at app.js:1612. Stale surrounding comment also fixed. |
| 8 | `50276d4` | ack | Server writes `.st8/server.port` on listen-callback (app.js:54 → `_writePortFile()`); hook reads it with env > file > 3847 priority, integer-validates. Live probe confirmed write + SIGINT-direct cleanup. |
| 9 | `153f993` | ack | Two-tier escaper (`jq -n --arg ...` preferred; awk fallback covering U+0000..U+001F). Live probe with BEL/BS/VT/FF/backslash/quote chars round-trips through `python -c json.loads`. |
| 10 | `5b582a5` | ack | `iconv -c -f UTF-8 -t UTF-8` after `head -c 200`. The `\${...} || true` wrapper swallows iconv's expected non-zero on the repair-split (without it, the original `|| exit 0` chain would have silently NULL'd SUBJECT — well-spotted secondary bug). Live probe with 300 bytes of `你` confirmed 198 valid bytes out. |
| 11 | `55d1f63` | ack | Installer refuses pre-existing regular file or foreign symlink, prints chained-hook recipe, exits 3. `--force` overwrites with warning. Unknown args fail exit 2. All 6 scenarios verified in /tmp/install-test. |
| 20 | (none) | **defer-confirmed** | Observation-only outcome. The userNote ends 'Document or add a retry queue.' — executor did neither, but the analysis (persistence-first is the correct design; the roadmap P3 replay-tool closes the at-most-once gap) is sound. With zero TICKET_CREATED/COMMIT_RECORDED subscribers today there is nothing to retrofit. Not a kickback — but 2D might want to add an explicit 'delivery semantics' subsection to the component doc. |
| 21 | `4154733` | ack | TICKET_CREATED payload locked to 8 explicit fields (id, fingerprint, filepath, userNote, sha256Hash, statusAtCreation, identityBundle, createdAt). The `...payload` spread is gone. hook-registry.js HOOKS comment updated to enumerate the same 8 fields (was `...` before). |
| 22 | `93b3673` | ack | Both GET sites annotated with TICKETS_QUERIED extension note. No premature constant added. |
| 23 | `04cee9b` | ack | listAllHooks() returns all 9 canonical hook names with count:0/sources:[]/runOrder:[] on a fresh registry. listHooks() preserved unchanged for back-compat. |
| 24 | `4e3f040` | ack | Probed registry with priorities [99, 1, 50] registered out of order — introspectExecuteOrder() and listHooks()[0].runOrder both returned [test-early, test-mid, test-late]. Unknown-hook returns []. execute()'s loop sort was already priority-correct so the change is purely introspective. |

### residualConcerns audit

All four executor-flagged residualConcerns are present in the JSON, not
just the agent report:

1. **Ticket 8 — shell:true SIGINT propagation through start.js** — confirmed by
   live test. Direct SIGINT to backend node cleans up; SIGINT through
   start.js does not (the wrapper's `spawn('node', ..., { shell: true })`
   at start.js:110 inserts a shell that does not forward signals reliably).
2. **Ticket 8 — main.js has no SIGTERM handler** — confirmed by reading
   src/core/server/main.js:436 (only `process.on('SIGINT', ...)` is wired).
   A `kill <pid>` of the backend leaves the port file stale.
3. **Ticket 9 — bash `$(...)` strips NUL bytes** — accurate; documented in
   the commit message and residualConcerns rather than papered over.
4. **Ticket 9 — awk fallback escape_json is single-record** — accurate
   footgun if anyone re-uses the function for `--pretty=%B`.

### No-cheats sweep

- `git diff c982b87..HEAD -- src/ scripts/` reviewed. No new TODO/FIXME/XXX,
  no empty function bodies, no silently-swallowing try/catches added.
  The only `|| true` is the intentional iconv wrapper (correctly justified
  in the comment).
- Every "Executed" status maps to a real, substantive commit OR the
  observation-only ticket 20 where the explanation is sound.
- No status:open ticket was touched in the JSON edit (verified diff is
  scoped to the 12 wave-2a-executor tickets).
- File renaming: NOT performed (correct — Wave 2D handles).

### Cluster shape for downstream waves

**Safe for 2B (structural decomp) to build on.** The 2A changes are
narrow and additive:

- New methods on HookRegistry (`listAllHooks`, `introspectExecuteOrder`)
  do not alter `execute()` semantics or the existing `listHooks()` shape
  for current consumers (gap-analyzer, force-checks, future plugins).
- The `TICKET_CREATED` payload narrowing has zero current subscribers,
  so no live blast radius.
- The post-commit script and installer touch shell-only paths — no
  Node-side coupling.
- `.st8/server.port` is a new runtime artifact; `.gitignore` already
  covers `.st8/` so it will not pollute commits.
- The single doc-only edit (JSDoc on `_handleRecordCommit`) cannot
  conflict with 2B's structural work.

### Cross-cluster flags for founder

- **Lifecycle cluster: SIGTERM is unwired in main.js:436.** `kill <pid>`
  of the backend leaves the port file stale, the sonic-daemon child
  orphaned, and any future stop()-cleanup hooks unrun. This is a
  one-line fix (`process.on('SIGTERM', ...)`) but belongs in the
  lifecycle cluster's audit.
- **Lifecycle cluster: `start.js` uses `spawn(..., { shell: true })`
  for the backend node child** (start.js:110). The shell wrapper
  does not consistently forward signals on Linux, so even SIGINT to
  start.js can leave the backend's stop() unrun. This affects more
  than port-file cleanup (sonic-daemon shutdown, persistence close,
  watcher teardown). Drop `shell: true` here or wire an explicit
  signal-forwarding handler in start.js.
- These two together explain why 2A's port-file cleanup, while
  correctly implemented at the hook layer, can still leave stale
  files in real-world `kill` and `Ctrl-C-through-start.js` flows.
  Both are out of cluster scope.

### Bottom line

Wave 2A executor was honest. Twelve tickets, eleven code-or-doc fixes
plus one defensible observation-only call. residualConcerns flag four
real follow-ups, two of which I'm escalating cross-cluster. Annotations
written; JSON file NOT renamed (Wave 2D's job).
