# louis-and-locking — roadmap

Forward-looking design work for the locking cluster. **This is the place
where the founder's Priority 1 lives.**

Quoting the founder's session-closing message (the close of the session
that produced batch 027):

> "Priority one is the locking system you captured in the bible inspired by
> Louis."

The bible captured the design (§batch 021, lines 2527-2610). This roadmap
is the build plan. The canonical spec is
`docs/components/louis-and-locking.md`.

Priority key:

- **Priority 0** — the founder's explicit #1; nothing else ships before
  Phase L1 starts.
- **Priority 2** — policy decisions adjacent to the locking system that
  benefit from being decided alongside it.
- **Priority 3** — explicit non-goals and boundary documentation; necessary
  so future contributors do not over-scope the work.

---

## PRIORITY 0 — The Locking System

The founder's stated #1. Four phases, designed to ship independently so the
panel can land before the git hook does.

### Phase L1 — The locking primitive + state + routes

The smallest possible vertical slice that proves the design out.

- **Create `src/features/locks/lock-manager.js`** with the chmod primitive
  (`lockFile`, `unlockFile`, `isWritable`, `lockAll`, `unlockAll`). ~50 LOC,
  full body given in the component doc. Pure `fs.chmodSync` wrapper; no
  SQLite, no SSE, no UI. Stateless.

- **Add `locked INTEGER DEFAULT 0` to `file_registry`** in
  `src/core/database/persistence.js`. Add an
  `idx_file_registry_locked` index. **Bootstrap migration step:** on
  first-run after the migration, iterate every row and seed
  `locked = 1` for paths the OS reports read-only (avoids first-run
  inconsistency between SQLite state and disk state).

- **Create `src/features/locks/lock-state.js`** — SQLite-backed
  `setLocked` / `getLocked` / `listLocked` / `regenerateProtectedFile`.
  ~100 LOC. Rides `st8.sqlite`; no separate DB.

- **Add `HOOKS.LOCK_CHANGED`** to `src/core/hook-registry.js` (canonical
  map). Payload: `{ fingerprint, filepath, locked }`. Register two default
  subscribers in `src/core/hooks/default-subscribers.js`:
  - P=10 `regenerate-protected-file` — writes
    `~/.louis-control/protected-files.txt` from current SQLite state.
  - P=20 `lock-mutation-log` — INSERTs a `mutationType = 'LOCK'` row into
    `file_mutation_log` (finally fires the long-declared LOCK enum,
    bible §line 1617).

- **Add three routes to `src/core/server/app.js`:**
  - `POST /api/lock { path }` — resolve filepath via `file_registry`, call
    `lockFile(absPath)`, persist via `setLocked(fingerprint, true)`, fire
    `HOOKS.LOCK_CHANGED`.
  - `POST /api/unlock { path }` — symmetric.
  - `GET /api/locks` — returns `listLocked()`.

- **Decide D1, D2, D3 from the component doc** (column-vs-table,
  file-vs-region, anonymous-vs-attributed). Default recommendations stand
  unless the founder vetoes.

**Exit criterion for L1:** `curl -X POST /api/lock` flips a file to
read-only on disk AND records it in SQLite AND fires the hook AND emits an
SSE event. No UI yet. Verified by `curl /api/locks` and `ls -l`.

### Phase L2 — The lock panel UI + SSE wiring

The visible half of the feature.

- **Create `src/frontend/components/lock-panel/lock-panel.{js,css}`** —
  toggle list of every `file_registry` row with lock state; search box;
  per-row 🔒 toggle; "Lock all PRODUCTION" bulk button (gated by D4
  default = off).

- **Mount the panel under Settings.** Today's dock has `phreak>` and the
  file-explorer icon. Per the batch-027 design memo, the dock is moving to
  outer-edge diamonds; a 🔒 diamond joins the rotation. If the diamond
  redesign hasn't landed by L2, mount as a Settings sub-panel in the
  meantime.

- **SSE `lock-change` event** — piggyback on the existing
  `/api/mutations` stream (D7 default). The new P=20 default subscriber
  (added in L1) pushes `{ type: 'lock-change', fingerprint, locked }` to
  all SSE clients.

- **Wire the constellation** — subscribe to the `lock-change` SSE event
  in `bootConstellation()` and call
  `St8Constellation.updateFileStatus(fingerprint, 'LOCKED')` on each
  event. Locked files turn pink (`--pink`, the LOCKED slot already
  reserved in `STATUS_COLOR`). `statusColor(file)` already checks
  `file.locked` first per `frontend-experience.md:326`.

- **File-explorer badge** — add a small 🔒 glyph next to the existing
  status dot in `src/frontend/components/file-explorer/file-explorer.js`.
  Same SSE subscription, second render sink.

**Exit criterion for L2:** lock a file via the panel → particle turns pink
within ~50ms → explorer badge appears → unlock reverses both. Multi-tab
test: open two browser tabs, lock in one, see the other update without
refresh.

### Phase L3 — Git pre-commit hook + protected-files contract

The "lock travels with the repo" layer.

- **Create `src/features/locks/git-hook-installer.js`** — port of Louis's
  `install_git_hook()`. Writes `.git/hooks/pre-commit` from a template
  with a versioned header line. Detects prior customization and surfaces
  the conflict to the panel UI rather than silently overwriting. ~80 LOC.

- **Add `scripts/git-hooks/pre-commit`** — the shell script body (the
  installer reads this template). Reads
  `~/.louis-control/protected-files.txt` (D6 default = `B`, share the
  directory with standalone Louis), greps staged paths, rejects matches
  with a clear red error. Body sketched in the component doc.

- **Update `scripts/git-hooks/install.sh`** to manage both pre-commit
  (new) and post-commit (existing, from batch 024). Single entry point.

- **Surface hook status in the panel** — show "pre-commit hook installed
  ✓ / not installed ✗" and a re-install button.

- **Verify the regenerate path** — `regenerateProtectedFile()` (already
  built in L1) runs on every `LOCK_CHANGED`, so the file the hook reads
  is always fresh. Test: lock file A, commit a touch on B (allowed),
  commit a touch on A (rejected), unlock A, commit on A (allowed).

**Exit criterion for L3:** `git commit` on a locked file is rejected with
a clear st8-branded error, even if the user has manually `chmod 644`'d the
file in between (because the hook reads the protected-files list, not the
file's mode bits).

### Phase L4 — Visual indicators: dive-in 🔒 sprite + constellation polish

The final aesthetic layer. Redeems the dangling comment at
`dive-in.js:21`.

- **Build the dive-in lock sprite** — `Three.js Sprite` with a
  canvas-textured 🔒 glyph, parented to the building group, offset on +Y
  by a new `BUILDING_CONFIG.lockBadgeOffsetY` (suggested: building height
  × 1.2). Toggle visibility on `building.userData.locked`. Red fill
  (`--bug-juice` / cyan? or the LOCKED-pink token? — picking the LOCKED
  pink keeps the visual grammar consistent across constellation +
  dive-in + explorer).

- **Update `dive-in.js`'s SSE wiring** to flip the sprite on
  `lock-change` events when the dive-in is open on the affected file.

- **Constellation particle polish** — pink fill from `--pink` is already
  reserved; verify rendering at the production particle count. If pink
  vs cyan vs gold gets visually confusing at scale, add a small lock
  glyph overlay per particle (probably overkill; defer unless the
  founder asks).

- **Resolve the `dive-in.js:21` comment** — either it's now accurate
  (sprite ships) or it should be deleted. **No more dangling promises in
  source comments.**

**Exit criterion for L4:** Open dive-in on a locked file → red 🔒 sprite
visible above the building. Lock via the panel while dive-in is open → the
sprite appears live. Unlock → it fades out.

---

## Priority 2 — Bruno-Oscar + Louis interaction policy

Adjacent decisions that benefit from being made during the locking work.
These do not block Phase L1 but should land alongside L2.

- **D4 from the component doc — auto-lock PRODUCTION files?**
  Decide whether `lifecyclePhase` transition to `PRODUCTION` should
  auto-flip `locked = 1`. Default recommendation: **opt-in via
  `st8_settings`**; expose a checkbox in the lock panel + a bulk "Lock
  all PRODUCTION" button. Document the choice in
  `docs/components/identity-and-analysis.md`'s bruno-oscar section so the
  lifecycle-state-machine doc reflects what `PRODUCTION` actually
  guarantees.

- **Pre-commit hook awareness of bruno-oscar phases.**
  Should the pre-commit hook also refuse commits to `PRODUCTION` files
  even if they're not explicitly locked? This is a stricter version of
  D4 (lock-on-promotion). Default recommendation: **no** — keep the hook
  reading only `protected-files.txt`. Letting bruno-oscar drive the hook
  couples two systems; the auto-lock-on-promotion option (D4) achieves
  the same outcome with looser coupling.

- **Lock-history audit trail consolidation.**
  Louis writes `~/.louis-control/lock-history.log`. st8's L1 phase
  already fires a `mutationType = 'LOCK'` row into `file_mutation_log`
  per the L1 design. Decide whether to also keep the text log (for users
  running the standalone Louis app) or treat `file_mutation_log` as the
  single source of truth. Default recommendation: **single source of
  truth in SQLite**, expose a "lock history" view in the panel that
  reads from `file_mutation_log`.

- **Multi-agent lock ownership (D3 follow-up).**
  Anonymous locks are fine for MVP. When agent-tagging arrives, decide
  whether agents can lock files or only humans can. Default
  recommendation: **humans only** for the first multi-agent release;
  agent locks are a separate trust surface and shouldn't be lumped in.

---

## Priority 3 — Connie + Carl audit (out of scope, but documented)

The founder explicitly excluded the other two Louis tabs from st8
integration. This priority exists to make sure that decision survives
contact with future agents.

- **Document the boundary in `docs/components/louis-and-locking.md`.**
  Already done in the "Out of scope" section. Verify it stays in place
  across rewrites.

- **Do NOT port Connie.** The standalone Louis app's database → LLM
  converter overlaps with st8's existing features (schema cards, the PRD
  generator, the file-context-bundle pieces around the LLM
  collaboration loop). Porting Connie would create two ways to do the
  same thing in st8 with subtle differences. The boundary: if a user
  wants Connie, they run `lock_em_up_louis_v2.py` standalone.

- **Do NOT port Carl.** Similar reasoning. Carl's "LLM chat context
  generator" is a single-shot snapshot tool. st8's collaboration loop
  is incremental and persistent. They are different products; carrying
  Carl into st8 would muddy the model.

- **Audit `lock_em_up_louis_v2.py` for residual bugs (optional, future).**
  The founder mentioned "a couple errors but I've built it successfully
  before." This is about the standalone PyQt6 app and does not block
  st8. If the standalone app remains a supported delivery vehicle,
  audit `LouisTab.__init__`, `ConnieTab.__init__`, `CarlTab.__init__`
  for race conditions on signal connect and uninitialized widget refs
  (the bible §2606 calls these out as the highest-risk surfaces in
  PyQt6 widget lifecycle code). Filed as a low-severity ticket in
  `_pending-tickets/louis-and-locking.json`.

- **If the standalone app is deprecated** — and the founder's intent is
  "Louis lives inside st8 now" — explicitly mark the standalone
  `Louis/` directory for removal in a future batch. Until that decision
  is made, keep it untouched at repo root per the bible §batch 021
  closing note.

---

## Phase dependency graph

```
L1 (primitive + state + routes)
  ├── L2 (panel UI + SSE)         — visible feature
  ├── L3 (git hooks)              — repo-traveling enforcement
  └── L4 (dive-in 🔒 + polish)    — visual completeness
```

L2, L3, L4 are independent and can ship in any order after L1. The
recommended order is L1 → L2 → L3 → L4 because L2 gives the founder a
hands-on feel for the feature before the git-hook escalation, and L4 is
pure polish that benefits from the rest being stable first.

---

## See also

- `docs/components/louis-and-locking.md` — the canonical spec, including
  the 50-line chmod primitive in full, the seven open architectural
  decisions (D1–D7) with default recommendations, and the file map of
  every path that needs to be created or modified.
- `docs/_pending-tickets/louis-and-locking.json` — per-file tickets,
  most GREEN/forward-looking, one or two real cleanups.
- `st8_bible.md` §batch 021 ("Louis Concept", lines 2527-2610) — the
  source design memo that this roadmap operationalizes.
