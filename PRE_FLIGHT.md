# Sprint Pre-Flight Protocol

Every executor and reviewer agent in the 23-wave debugging sprint must run these checks **before** doing any work. They take under 5 seconds and catch drift before it propagates.

## Step 1 — Drift detection

```bash
git ls-files src/0_ | head -5
```

**Expected: empty.** If any path is printed, STOP and report:

> PRE-FLIGHT FAILED: drift detected at src/0_*. Halting.

## Step 2 — Canonical structure check

```bash
ls src/
```

**Expected output (exact, in any order):** `core  features  frontend  shared`

Any other entries → STOP and report PRE-FLIGHT FAILED with the diff.

## Step 3 — Entry-point check (sanity)

```bash
test -f start.js && test -f src/core/server/main.js && test -f src/core/server/app.js && echo "entry chain OK"
```

**Expected:** `entry chain OK`. Anything else → STOP.

## Step 4 — Tests baseline

```bash
cd /home/user/st8 && npm test 2>&1 | grep -E "^# (tests|pass|fail|skip|todo)"
```

**Expected:** `tests N / pass N / fail 0 / skipped 0 / todo 0` where N matches the wave's prior baseline (207 as of end of Cluster 3 Wave 3B).

If `fail > 0` or `skip > 0` or `todo > 0` BEFORE your work starts → STOP.

## Step 5 — Log success

```
PRE-FLIGHT OK (tests=N, head=$(git log -1 --format=%h))
```

Then proceed with required reading + execution.

## EXPECTED_PATHS contract

Every prompt will declare an `EXPECTED_PATHS` allowlist. All edits must be in this set. Common paths:

- `src/core/`, `src/features/`, `src/shared/`, `src/frontend/`
- `tests/`
- `scripts/` (for tooling, not application code)
- `docs/` (component docs, tickets, roadmap, bible)
- Repo root: `st8_bible.md`, `package.json` (rarely), `CLAUDE.md` (almost never)

If a ticket would require editing outside the EXPECTED_PATHS set, STOP and report:

> EXPECTED_PATHS VIOLATION: ticket N requires edit to <path>. Aborting wave.

## Cluster-close audit (final reviewer only)

The last reviewer in a cluster must run this before renaming the JSON to `.for-review.json`:

```bash
git log --since="2026-05-14" --name-only --pretty=format: | grep -E "^src/0_" | head
```

**Expected: empty.** If anything is printed, the cluster cannot close. Report:

> CLUSTER-CLOSE FAILED: drift commit detected in <cluster>. Halt rename.

## Operational guardrails

- **No live probes without explicit timeouts.** Every `curl` uses `--max-time 5`. Every `node start.js` in a probe gets a `kill %1` cleanup.
- **No "wave-level extras".** If your prompt lists 5 tickets, you finish those 5. If you find an additional issue, mark it as a residualConcern — it becomes its own wave.
- **No port 3847 in probes when running parallel.** Use ephemeral ports (`bootServer()` helper in `tests/_helpers/` if it exists, otherwise let the OS pick a port).
- **No silent failures.** Honest "blocked" beats false "executed."
