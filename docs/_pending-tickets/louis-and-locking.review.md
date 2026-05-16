# Louis-and-Locking Review

## Wave 8A Review

Reviewer: wave-8a-reviewer
Commit range: `3fac49e..7e061e8` (6 ticket commits + 1 chore close)
Executor: wave-8a-executor (6 doc tickets in 5:25)
Tests: 451 pass / 0 fail / 0 skip / 0 todo (matches baseline)
PRE-FLIGHT: OK (head=7e061e8, src/ clean: core/features/frontend/shared)

### Ticket-by-ticket

| # | Subject | Verdict | Note |
|---|---------|---------|------|
| 0 | dive-in.js lock-indicator comment | ack | Header now cites docs/_pending-roadmap/louis-and-locking.md + L2 (SSE data source) + L4 (Three.js sprite) phase split. Deferral note re-tagged "louis-and-locking cluster ticket 0 — Wave 8A annotation." Doc-only edit; no behavior change. Honest "option (a)" — sprite gated on L1. |
| 1 | bible Louis cross-references | ack | New `> **Louis Cross-References (Wave 8A — ticket 1)**` blockquote at top of §Batch 021 "Louis Concept" (bible:2599). Enumerates 5 Louis mentions (Batch 021 memo, Batch 023 hooks-arch, enum tables, constellation/status-colors slot, line ~1617 LOCK-defined-but-never-fired) and the 3 authoritative docs in priority order (component doc > roadmap > tickets JSON). Forward-going convention codified ("future Louis batches: add a cross-link entry here, keep prose in the component doc"). |
| 2 | Louis-standalone tool boundary | ack | New "Louis-standalone tool boundary (Wave 8A explicit decision)" subsection under Out-of-scope. Four explicit guarantees: (1) Python bugs tracked out-of-repo, (2) reference-only treatment like OGB/, (3) lifecycle bugs raised upstream not as st8 tickets, (4) Connie+Carl stay off-limits even on Louis-standalone deprecation. |
| 3 | Boundary IN/OUT tables | ack | Verified BOTH tables present in new "Scope boundary — Path C, Warden only" section (louis-and-locking.md:531-588). IN table: 8 rows (chmod primitive, SQLite lock state, HOOKS.LOCK_CHANGED + subscribers, /api/lock|unlock|locks, lock-panel UI, SSE + constellation + explorer badge, git pre-commit + installer, dive-in sprite) with phase pointers L1-L4 + target paths. OUT table: 8 rows (Connie, Carl, PyQt6 GUI, Path A, Path B, region locking, per-lock attribution, Python audit) each with "why excluded" + "where it stays" columns. Real categorization, not bullet lists — passes the "no cheats" boundary-table check. |
| 8 | STATUS_COLOR.LOCKED annotation | ack | Touchpoint table in component doc (louis-and-locking.md:12-18) now has a "Shared color tokens" row cross-linking to src/frontend/components/status-colors.js (Wave 7C ticket 9). Confirms statusColor(file) already honors file.locked first — only the data side (Phase L1) is missing. |
| 15 | Audit-trail decision | ack | Independently verified activity_log schema (persistence.js:129-136): `id, timestamp, source, action, targetFingerprint, details` — has exactly the columns needed to capture lock-history (target+action+source+details+timestamp). file_mutation_log (persistence.js:117-127) has `actor, mutationType, fingerprint, metadata` — supports the long-declared-never-fired LOCK enum. Decision documented in louis-and-locking.md "Known unknowns" + spec'd as P=20 (lock-mutation-log) + P=30 (lock-activity-log) subscribers. Option (a) verified: no new persistence surface, queryable via SQL, travels with st8.sqlite, single source of truth. |

### Counts
- ack: 6
- kickback: 0
- defer-confirmed: 0
- residual concerns: 0

### Confidence for Wave 8B
Annotation-only wave. No source/test edits, tests stable at 451. Forward-looking tickets (lock-manager.js, lock-state.js, git-hook-installer.js, lock-panel.js, /api/lock routes, HOOKS.LOCK_CHANGED registration, file_registry.locked column, file-explorer badge, dive-in sprite render) all remain unimplemented and are appropriate **defer-en-masse** targets for 8B — they are Phase L1–L4 build work, not 23-wave sprint scope. Roadmap (`docs/_pending-roadmap/louis-and-locking.md`) is the canonical landing zone for each.

**Safe for 8B defer-en-masse.**
