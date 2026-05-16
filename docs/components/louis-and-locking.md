# louis-and-locking

Cluster: **louis-and-locking** — the founder's **Priority 1 Roadmap** item:
port the Warden core from "Lock 'em up Louis" (a 1463-line PyQt6 desktop app
the founder built) into st8 as a panel under Settings, with `chmod`-based
file protection, a git pre-commit safety net, SSE-driven live updates, and a
red lock indicator in the dive-in view.

This document is **forward-looking**. There is no `src/features/locks/`
directory in the st8 tree today; the closest things on disk are:

| Touchpoint | Where it lives | What it is |
|---|---|---|
| Louis design / Path C plan | `st8_bible.md:2527-2610` | The captured design — not yet implemented |
| Stale comment | `src/frontend/components/dive-in/dive-in.js:21` | `Locked files get a red lock indicator above the building.` — referenced but never drawn |
| Constellation color slot | `src/frontend/components/constellation/constellation.js` (`STATUS_COLOR.LOCKED`) | `{r:201, g:116, b:143}` pink — already reserved; nothing flips files into the LOCKED bucket yet |
| Shared color tokens | `src/frontend/components/status-colors.js` (single-source `STATUS_COLOR` since Wave 7C ticket 9) | Both constellation and dive-in now read `STATUS_COLOR.LOCKED` from `window.St8StatusColors`; `statusColor(file)` already honors `file.locked` first (overrides RED/GREEN). Pre-wired and waiting for the L1 data source. |
| LOCKED enum | `src/core/database/persistence.js:57,60` and bible §status enums | `FileStatus = ...LOCKED...`, `LifecyclePhase = ...LOCKED...` — declared, never written |

The **Louis directory itself is not on disk** in this working copy — the
founder dropped `Louis/lock_em_up_louis_v2.py` and the four companion
markdowns on `master` at commit `1df677b` (per bible §batch 021). When the
implementation session opens, the canonical reference will be that commit,
not the working tree.

---

## What Louis is

"Lock 'em up Louis" is a standalone PyQt6 desktop application
(`Louis/lock_em_up_louis_v2.py`, 1463 lines) the founder built and uploaded
as a concept seed for st8. It fuses three tools into one tabbed UI:

1. **👮 Louis (Warden)** — file locking. `chmod 444` to lock, `chmod 644` to
   unlock. State persisted in `~/.louis-control/{louis-config.json,
   protected-files.txt, lock-history.log}`. Optional `.git/hooks/pre-commit`
   that reads `protected-files.txt` and refuses commits that touch any
   protected path.
2. **🎨 Connie** — a database-to-LLM-friendly-format converter.
3. **📚 Carl** — an LLM chat context generator.

Of the three, **only Louis (the Warden, ~140 lines of core logic inside the
`LouisWarden` class)** is in scope for st8. The bible's batch 021 entry is
explicit: "Path C — port just the Warden... Reimplement only the locking
logic in Node + new st8 panel UI." Connie and Carl stay in the standalone
PyQt6 app; st8 does not absorb them.

---

## Why st8 wants this

Per the founder's session-closing instruction (the last message of the
session that produced batch 027): **"Priority one is the locking system you
captured in the bible inspired by Louis."**

The motivation is the same as Louis's original motivation: while
collaborating with an LLM, the developer wants a hard "don't touch this
file" guarantee. Today st8's `lifecyclePhase` flag (`PRODUCTION`) is
**advisory** — Bruno+Oscar can warn an agent off, but nothing on the OS
prevents a write. `chmod 444` is the cheapest possible enforcement: a write
attempt fails at the syscall layer, regardless of which tool issued it.

The "lock_em_up" metaphor extends naturally:

- A locked file's particle in the constellation gets pink fill (`--pink`,
  the LOCKED slot in `STATUS_COLOR`).
- A locked file's building in the dive-in carries a red 🔒 sprite above it
  (the dangling `dive-in.js:21` comment).
- A pre-commit hook makes the lock travel with the repo: even if the
  developer forgets a file is locked and the `chmod` is undone (e.g. by a
  fresh `git clone`), the hook still refuses the commit.

---

## Path C plan (canonical, from bible §batch 021)

Path A (subprocess-shell-out to the Python app) and Path B (full Node port
of all 1463 lines) were considered and rejected:

| Path | Approach | Verdict |
|---|---|---|
| A — Subprocess wrap | st8 shells `python lock_em_up_louis_v2.py --lock <p>` | NO — drags in PyQt6 even for headless ops, slow per call |
| B — Full Node port | Reimplement Warden + Connie + Carl + GUI in Node | NO — massive rewrite of features st8 doesn't need |
| **C — Warden-only port** | Port the ~140-line `LouisWarden` class + the panel UI | ✅ Recommended |

The Path C plan as captured:

```
src/features/locks/
├── lock-manager.js          # port of LouisWarden — fs.chmodSync for
│                            # lockFile / unlockFile / lockAll / isWritable
├── lock-state.js            # port of LouisConfig — SQLite-backed
│                            # (extends existing st8.sqlite, no separate DB)
└── git-hook-installer.js    # port of install_git_hook()

src/frontend/components/lock-panel/
├── lock-panel.js            # UI under Settings in the dock
└── lock-panel.css

Wire-up:
- New dock button "🔒" next to "phreak>" in src/frontend/index.html
- Backend routes added to src/core/server/app.js:
    POST /api/lock    { path }
    POST /api/unlock  { path }
    GET  /api/locks
- file_registry table gains a `locked BOOLEAN DEFAULT 0` column
- File explorer shows a lock badge next to each file's status dot
- SSE "lock-change" event so all open UIs update instantly
```

---

## Intended architecture in st8

### Backend modules

**`src/features/locks/lock-manager.js`** — pure file-system primitives. No
SQLite import, no SSE import. Exports four functions:

- `lockFile(absPath) → { ok, error? }` — `fs.chmodSync(absPath, 0o444)`
- `unlockFile(absPath) → { ok, error? }` — `fs.chmodSync(absPath, 0o644)`
- `isWritable(absPath) → boolean` — `fs.accessSync(absPath, W_OK)`
- `lockAll(absPaths) / unlockAll(absPaths) → { ok: N, fail: M, errors: [...] }`

Mirrors `LouisWarden.lock_file / unlock_file / lock_all / is_writable` from
the Python source. **Stateless** — does not record what got locked; that's
`lock-state.js`'s job.

**`src/features/locks/lock-state.js`** — SQLite-backed state, riding the
existing `st8.sqlite` (no separate DB file). Owns reads/writes to whichever
table ends up holding the lock bit (see "Decisions" below). Exports:

- `setLocked(fingerprint, locked) → void`
- `getLocked(fingerprint) → boolean`
- `listLocked() → [{ fingerprint, filepath }]`
- `regenerateProtectedFile() → void` — writes `~/.louis-control/protected-files.txt`

**`src/features/locks/git-hook-installer.js`** — port of Louis's
`install_git_hook()`. Writes `.git/hooks/pre-commit` with a shell script
that reads `~/.louis-control/protected-files.txt` and rejects the commit if
any staged path is on the list. Idempotent install + uninstall.

### Backend routes (in `src/core/server/app.js`)

| Method | Path | Body | Returns | Hook fired |
|---|---|---|---|---|
| POST | `/api/lock` | `{ path }` | `{ ok, error? }` | `LOCK_CHANGED` (new) |
| POST | `/api/unlock` | `{ path }` | `{ ok, error? }` | `LOCK_CHANGED` (new) |
| GET  | `/api/locks` | — | `[{ fingerprint, filepath }]` | — |

All three resolve the path via `file_registry.filepath`, call into
`lock-manager.js` for the chmod, then `lock-state.js` to persist, then fire
a `LOCK_CHANGED` hook + push an SSE event.

### New named hook

`HOOKS.LOCK_CHANGED` joins the canonical map in `src/core/hook-registry.js`:

```js
LOCK_CHANGED: 'lock:changed'   // { fingerprint, filepath, locked }
```

Subscribers (defaults):

- `regenerate-protected-file` (P=10) — rewrites
  `~/.louis-control/protected-files.txt` from current SQLite state. The
  pre-commit hook reads this file at commit time, so it must be fresh.
- `sse-broadcast-lock-change` (P=20) — pushes a `{ type: 'lock-change',
  fingerprint, locked }` event to all SSE clients on `/api/mutations` (or a
  dedicated `/api/locks/stream` endpoint — see Decisions).

This matches the hook pattern used for `COMMIT_RECORDED` and
`TICKET_CREATED` in batch 023–026.

### Frontend

**`src/frontend/components/lock-panel/lock-panel.js`** — a panel mounted
under Settings (today's dock has "phreak>" + file-explorer; per the
batch-027 design memo, the dock is moving to outer-edge diamonds, and a 🔒
diamond joins the rotation). The panel renders:

- A toggle list of every file in `file_registry`, status-sorted.
- Per row: filepath, status dot, lock toggle (◇ when unlocked, 🔒 when
  locked), last-locked timestamp.
- A search box that filters by filepath.
- A "Lock all PRODUCTION" bulk button (gated by the bruno-oscar policy
  decision; off by default).

**`src/frontend/components/lock-panel/lock-panel.css`** — owns visual style;
matches the existing component pattern. Notably, the file is **not** styled
inline (see `dive-in.js`'s pending-ticket about exactly this anti-pattern).

**Constellation integration** — the `LOCKED` pink slot in
`constellation.js`'s `STATUS_COLOR` is already reserved. When the SSE
`lock-change` event arrives, `St8Constellation.updateFileStatus(fingerprint,
'LOCKED')` flips the particle to pink. Per `frontend-experience.md:326`:
"`statusColor(file)` checks `file.locked` first, so a locked + RED file
shows pink, not cyan. Locked overrides status."

**Dive-in integration** — `dive-in.js:21`'s promise is finally honored: a
red 🔒 sprite (or low-poly mesh) hovers above the building. Implementation
sketch: a Three.js `Sprite` with a small canvas-textured 🔒 glyph, parented
to the building group, offset on +Y by `BUILDING_CONFIG.lockBadgeOffsetY`.
Toggle visibility on the building's `userData.locked` flag.

**File-explorer badge** — `file-explorer.js` already renders a status dot
per row; a lock badge next to it (small 🔒 glyph in the LOCKED-pink token)
piggybacks on the same render loop. Single SSE subscription updates both
the explorer and the constellation.

---

## The chmod primitive

The Node port of the locking primitive is small enough to live in the doc.
This is the bible's batch-021 sketch, lightly cleaned for production use:

```js
// src/features/locks/lock-manager.js
'use strict';

const fs = require('fs');

function lockFile(absPath) {
  if (!fs.existsSync(absPath)) return { ok: false, error: 'not found' };
  try {
    fs.chmodSync(absPath, 0o444);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function unlockFile(absPath) {
  if (!fs.existsSync(absPath)) return { ok: false, error: 'not found' };
  try {
    fs.chmodSync(absPath, 0o644);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function isWritable(absPath) {
  try {
    fs.accessSync(absPath, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function lockAll(absPaths) {
  let ok = 0, fail = 0;
  const errors = [];
  for (const p of absPaths) {
    const r = lockFile(p);
    if (r.ok) ok++; else { fail++; errors.push({ path: p, error: r.error }); }
  }
  return { ok, fail, errors };
}

function unlockAll(absPaths) {
  let ok = 0, fail = 0;
  const errors = [];
  for (const p of absPaths) {
    const r = unlockFile(p);
    if (r.ok) ok++; else { fail++; errors.push({ path: p, error: r.error }); }
  }
  return { ok, fail, errors };
}

module.exports = { lockFile, unlockFile, isWritable, lockAll, unlockAll };
```

**Caveats the Python original handles and the Node port must too:**

- On Windows, `chmod` is partially honored — Node's `fs.chmodSync` only
  flips the read-only bit. Test on Windows before declaring done. Louis's
  Python uses `os.chmod` with the same limitation.
- A locked file is still writable by `root`. The lock is a courtesy, not a
  security mechanism. Document this in the panel UI.
- Some editors (VS Code, vim with `:w!`) will offer to override read-only.
  This is by design — locking is a "are you sure?" speed bump, not a wall.

---

## The git pre-commit hook integration

Louis's mechanism:

1. `~/.louis-control/protected-files.txt` lists one protected path per line.
2. A shell `pre-commit` hook reads the staged file list (`git diff --cached
   --name-only`) and grep-checks each against the protected list.
3. If any match, the hook prints a red error and exits non-zero, aborting
   the commit.

st8's port keeps the same protected-files.txt contract — that is the
**ABI** between the in-process locking system and the out-of-process git
hook. Two-process architectures need a file-system rendezvous point, and
this is it.

The differences:

- The file is **regenerated from SQLite** on every `LOCK_CHANGED` hook
  firing (P=10 default subscriber). Louis writes it from in-memory state on
  every lock; st8 writes it from the source of truth, which is the
  `locked = 1` rows in (probably) `file_registry`.
- The hook installer (`git-hook-installer.js`) is invoked on st8 startup if
  the hook is missing OR if it's stale (a checksum line at the top of the
  hook script identifies the version). It is **never** silently
  overwritten; if the user has customized `.git/hooks/pre-commit`, the
  installer detects the conflict and asks via the panel UI.
- The post-commit hook (already installed by batch 024,
  `scripts/git-hooks/post-commit`) coexists with the new pre-commit hook.
  Both are symlinked from `scripts/git-hooks/` per the batch-024 pattern.

**Sample hook script (st8 port, simplified):**

```bash
#!/usr/bin/env bash
# st8 pre-commit hook — refuses commits to locked files
# version: 1
PROTECTED="$HOME/.louis-control/protected-files.txt"
[ -f "$PROTECTED" ] || exit 0
STAGED=$(git diff --cached --name-only)
WORKDIR=$(git rev-parse --show-toplevel)
for f in $STAGED; do
  ABS="$WORKDIR/$f"
  if grep -Fxq "$ABS" "$PROTECTED"; then
    echo >&2 "✖ st8 lock: $f is locked. Unlock via the lock panel first."
    exit 1
  fi
done
exit 0
```

---

## What needs deciding before building

These are the open architectural questions. Each has a default suggestion
but the founder should sign off.

### D1 — Lock state: new column on `file_registry`, or its own table?

**Option A (recommended): add `locked INTEGER DEFAULT 0` to `file_registry`.**

- Pro: one row per file is the natural shape. No JOINs needed for the
  panel's "list every file with its lock state" query. Matches how
  `brunoStatus`, `needsAIReview`, `aiContentInjected` etc. already ride
  `file_registry` rather than their own tables.
- Con: schema migration required. `file_registry` already has 22 columns;
  adding more makes the row wider.

**Option B: dedicated `locks` table.**

- Pro: clean separation. Optional join. Easier to add per-lock metadata
  later (locked_at, locked_by, reason, expires_at) without bloating
  `file_registry`.
- Con: every panel render is a LEFT JOIN. More surface to keep in sync.

Default: **A** for the MVP (single boolean is all Louis carries). Migrate
to **B** the moment a second piece of lock-metadata is needed.

### D2 — Lock granularity: file-only, or file + region?

Louis is file-only. `chmod` cannot do anything finer. Region-level locking
would require either a custom editor or an in-process advisory layer (`a
mutation handler that rejects edits touching protected line ranges`).

Default: **file-only for MVP.** Region locking is a separate later
discussion and probably belongs to a different feature (annotated regions,
not the Warden).

### D3 — Lock owner: anonymous, or attributed?

Louis is anonymous — every lock is just a row in `protected-files.txt`. st8
has no user system, but it does have actor tags in `file_mutation_log`
(`actor` column: DEVELOPER / AGENT-N / etc.). A `locked_by` column would
let the panel show "you locked this 3h ago" vs "an agent locked this".

Default: **anonymous for MVP.** Add `locked_by TEXT` later if multi-agent
collaboration arrives and lock-ownership disputes become a thing.

### D4 — Interaction with bruno-oscar lifecycle

Should `lifecyclePhase = 'PRODUCTION'` files auto-lock on transition?

- Pro: the founder's stated mental model — "PRODUCTION files are
  finished" — maps naturally to "PRODUCTION files are locked".
- Con: noisy. Promoting a file to PRODUCTION today is reversible without
  ceremony; auto-locking adds a friction surface.

Default: **opt-in.** A panel checkbox "Lock all PRODUCTION files" performs
the bulk lock manually. A setting in `st8_settings` toggles auto-lock on
PRODUCTION transition for users who want it.

### D5 — Pre-commit + post-commit hook coexistence

Batch 024 installed a post-commit hook that POSTs to `/api/record-commit`.
The new pre-commit hook installer must not stomp it. Both should be
installed by the same `scripts/git-hooks/install.sh` and managed as a pair.

Default: **`install.sh` installs both hooks** and the panel UI shows their
status side by side.

### D6 — `~/.louis-control/` directory ownership

Louis owns this directory. If st8 also writes to it, the two apps are
silently coupled. Two safer options:

- **A:** st8 writes its own protected-files list to
  `~/.st8-control/protected-files.txt` and the pre-commit hook reads
  whichever path the installer chose. The directory name signals
  ownership.
- **B:** st8 writes to `~/.louis-control/` deliberately, so the standalone
  Louis app and st8 share a single protected-files list. Either app's
  lock action is visible to the other.

Default: **B for now** (the founder's intent in the bible passage is
clearly "this is one lock system"). Revisit if the standalone Louis app is
deprecated or if users complain about cross-app coupling.

### D7 — SSE channel: existing `/api/mutations` or new `/api/locks/stream`?

The mutation stream already broadcasts file events. Adding a `type:
'lock-change'` event there is cheaper than a new endpoint. The frontend's
existing single `EventSource` subscription gets one more `switch` arm.

Default: **reuse `/api/mutations`** with a new event `type`.

---

## Known unknowns

Search of the bible turns up no further Louis batches beyond §021 (the
captured concept). Specifically:

- **No prior implementation attempt.** The "agents have built it before"
  reference in the founder's session-closing message is to the standalone
  Louis PyQt6 app, not to st8 integration.
- **No agreed migration path** for already-`chmod 444`'d files when st8
  first installs the lock column. The bootstrap should `SELECT filepath
  FROM file_registry`, `isWritable()`-check each, and seed `locked = 1`
  for paths the OS reports read-only. Without this, the first-run state is
  inconsistent.
- **No load test on chmodAll for large repos.** Louis's `lock_all` is
  blocking. For st8 targets with 10k+ files, the bulk-lock button should
  yield to the event loop (chunk + `setImmediate`) or move off-thread.
- **No defined behavior** for "the file no longer exists on disk but is
  still marked `locked = 1` in SQLite." Decide on every `LOCK_CHANGED`
  fire: drop the row, or keep it as a tombstone?
- **No spec for the lock-history log.** Louis writes one
  (`~/.louis-control/lock-history.log`). st8 already has
  `file_mutation_log` and `activity_log`. The right merge is probably:
  emit a `mutationType = 'LOCK'` row into `file_mutation_log` on every
  lock-change (the LOCK enum value is already declared in the type system
  but never written — see bible §line 1617's "Defined-but-never-fired").

---

## File map (planned)

```
src/features/locks/
├── lock-manager.js              # chmod primitives (50 LOC, in this doc)
├── lock-state.js                # SQLite-backed state (~100 LOC)
└── git-hook-installer.js        # pre-commit hook installer (~80 LOC)

src/frontend/components/lock-panel/
├── lock-panel.js                # UI module (~200 LOC)
└── lock-panel.css               # styles, no inline (~100 LOC)

scripts/git-hooks/
├── pre-commit                   # NEW — protected-files reader (~30 LOC shell)
├── post-commit                  # EXISTING — batch 024
└── install.sh                   # UPDATE — installs both

src/core/server/app.js           # +3 routes: /api/lock, /api/unlock, /api/locks
src/core/hook-registry.js        # +1 hook constant: HOOKS.LOCK_CHANGED
src/core/hooks/default-subscribers.js  # +2 subscribers (protected-files writer, SSE broadcaster)
src/core/database/persistence.js # +1 column: file_registry.locked
src/frontend/components/dive-in/dive-in.js  # remove dangling comment OR build the 🔒 sprite
src/frontend/components/constellation/constellation.js  # no change — LOCKED color already reserved
src/frontend/components/file-explorer/file-explorer.js  # +1 lock badge per row
src/frontend/index.html          # +1 dock entry for the lock panel (or +1 outer diamond per batch-027 design)
```

Estimate: **~700 net new LOC** + a one-column schema migration. About a
half-day of focused implementation; another half-day for the UI polish and
the Three.js sprite.

---

## Out of scope

These are explicitly **not** part of the Louis-in-st8 work:

- **Connie** (the database → LLM converter). Stays in the standalone
  PyQt6 app.
- **Carl** (the LLM chat context generator). Stays in the standalone
  PyQt6 app.
- **The PyQt6 GUI itself.** st8's UI is the panel. The standalone Louis
  app continues to exist for users who want a OS-level desktop tool
  without st8 running.
- **Audit / bug-hunt of `lock_em_up_louis_v2.py`.** The founder's
  "couple errors but I've built it successfully before" is about the
  standalone app and is filed as a follow-up ticket in
  `_pending-tickets/louis-and-locking.json`, but it does not block the
  st8 port.

---

## See also

- `st8_bible.md` §batch 021 ("Louis Concept") — the source design memo.
- `st8_bible.md` §lifecyclePhase / FileStatus enums — the LOCKED slot
  already declared.
- `docs/components/frontend-experience.md` §"Status → color map" — the
  pink (`--pink`) token reserved for LOCKED particles.
- `docs/components/hooks-and-integration.md` — the pattern the
  `LOCK_CHANGED` hook will follow (matches `COMMIT_RECORDED` /
  `TICKET_CREATED`).
- `src/frontend/components/dive-in/dive-in.js:21` — the dangling comment
  that this feature finally redeems.
