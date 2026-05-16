# Agent Deployment Prompt Strategy

The canonical agent-deployment protocol that produced the **31-sub-wave, 186-ticket, zero-final-kickback** debugging sprint. This directory captures the prompts, anti-cheat contracts, and watchdog supervision pattern.

## Files in this directory

| File | What it is |
|---|---|
| `You are the WAVE N EXECUTOR.txt` | Canonical executor prompt template. Fill in the `<placeholders>` and ship. |
| `You are the WAVE N REVIEWER.txt` | Canonical reviewer prompt template. Reviewers do audits + mutation probes — never re-implement. |
| `ABSOLUTELY PROHIBITED.txt` | The 7-bullet anti-cheat list. Canonical. Lives at the bottom of `PRE_FLIGHT.md` and every executor prompt references it. |
| `Watchdog Protocol.md` | The v2.1 supervisory monitor that watches for hung/overtime/stalled agents. |

## How the pieces fit together

```
┌─────────────────────────────────────────────────────────────┐
│  /home/user/st8/CLAUDE.md  (auto-read by Claude sessions)   │
│    canonical project structure + entry-point chain          │
│    + sprint protocol overview                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  /home/user/st8/PRE_FLIGHT.md  (mandatory pre-wave reading) │
│    5-step pre-flight check                                  │
│    EXPECTED_PATHS contract                                  │
│    NO CHEATS canonical 7-bullet list                        │
│    REVIEWER ANTI-CHEATS parallel list                       │
│    Operational guardrails (timeouts, no extras, etc.)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Wave prompt (one of):                                      │
│    docs/Agent Deployment Prompt Strategy/                   │
│      You are the WAVE N EXECUTOR.txt   ← fill in placeholders│
│      You are the WAVE N REVIEWER.txt   ← fill in placeholders│
│                                                              │
│  Customize:                                                  │
│    - <wave-N> + <cluster-name>                              │
│    - tests baseline                                         │
│    - EXPECTED_PATHS list (per wave)                         │
│    - NO CHEATS wave-specific bullets (predict false-positives)│
│    - Per-ticket reference list                              │
│    - Budget + hard limit                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼  (launch via Agent tool)
┌─────────────────────────────────────────────────────────────┐
│  Watchdog Monitor (Watchdog Protocol.md)                    │
│    Reads /tmp/st8-active-agent.txt for the launched agent   │
│    Watches: STALE_WRITES + AGENT_OVERTIME + NO_COMMIT_PROGRESS│
│    Emits transition events + heartbeats + progress signals  │
└─────────────────────────────────────────────────────────────┘
```

## The 6 layered drift-prevention layers

Across the 31-wave sprint, exactly 0 of 186 reviewed tickets had unresolved kickbacks at sprint close (1 raised + resolved mid-sprint). The discipline came from these layers:

1. **`CLAUDE.md`** at repo root — every Claude session auto-reads it. Names the canonical tree + says explicitly what NEVER to target.

2. **`PRE_FLIGHT.md`** — mandatory 5-step check before any wave does work. Fails fast if `src/0_*` drift exists, structure isn't canonical, or tests baseline isn't met.

3. **`EXPECTED_PATHS` per prompt** — every wave declares the allowlist of files it's allowed to touch. Anything outside → STOP and report VIOLATION.

4. **Wave-specific NO CHEATS bullets** — for each ticket the prompt predicts the most-likely false-positive completion. This is the single biggest discipline-multiplier. Examples:
   - "real subscriber receives the event" (not just publisher exists)
   - "mutation probe is mandatory" (test fails when SUT is broken)
   - "ANY shell command without explicit timeout" (lesson from 3C hang)
   - "deferral abuse is not allowed" (only defer roadmap-scale work)

5. **Reviewer mandatory mutation probe** — every reviewer must break-something / confirm-test-fails / restore-byte-perfect. This is what catches genuine theater tests vs real tests.

6. **Cluster-close audit** — last reviewer in each cluster must run `find src -maxdepth 2 -name "0_*"` (must be empty) before renaming the JSON to `.for-review.json`.

## When to use which prompt

- **Tiny single-ticket re-launch** (e.g. the 6D-finish wave with just ticket 30): use the EXECUTOR template with a shrunk scope and explicit "this is a re-launch of WIP commit `<sha>`" note.
- **Normal 4-8 ticket wave**: standard EXECUTOR template.
- **Roadmap defer-en-masse** (e.g. Wave 8B's 10 forward-looking Louis tickets): standard EXECUTOR with the "DEFERRAL" what-done-looks-like section emphasized.
- **Audit of a wave**: REVIEWER template. Always mandatory mutation probe.
- **Cluster-close**: REVIEWER template + the cluster-close-audit instructions + the `git mv` rename + the SPRINT SUMMARY (only if final reviewer of the final cluster).

## What makes this protocol durable

- **Single concern per wave** — one cluster, never cross-cluster scope
- **Single concern per ticket** — minimum change, no surrounding refactor
- **No wave-level extras** — if a flag surfaces, it's a residualConcern, not a parasite-add
- **Honest premise contradiction allowed** — executors are expected to push back on wrong ticket framings (this happened twice in the sprint and produced sharper outcomes)
- **Pre-flight is mechanical** — runs in <5 seconds, catches drift before it propagates
- **Watchdog catches what humans miss** — silent hangs that would otherwise stall the pipeline

## Reading order for someone picking this up

1. `/home/user/st8/CLAUDE.md` (sprint context)
2. `/home/user/st8/PRE_FLIGHT.md` (anti-cheat + EXPECTED_PATHS)
3. This file (you're here)
4. `You are the WAVE N EXECUTOR.txt` (the actual prompt)
5. `You are the WAVE N REVIEWER.txt` (the audit prompt)
6. `Watchdog Protocol.md` (the supervisor)
7. `/home/user/st8/st8_bible.md` batches 028+ (the sprint's batch log — concrete examples of every shape)

## Related files

- `/home/user/st8/scripts/submit-pending-tickets.js` — drains the per-cluster `.for-review.json` files into SQLite with verdict→statusAtCreation tags for queryability.
- `/home/user/st8/docs/_pending-tickets/<cluster>.review.md` — the cluster's full audit history (each sub-wave's reviewer section + cluster summary).
- `/home/user/st8/docs/Agents, Welcome Home.md` — the orientation doc each agent reads first.
