# HANDOFF MASTER REFERENCE

**Compiled:** May 11, 2026
**Sources:** 4 HANDOFF documents spanning v1 through v4
**Purpose:** Consolidated reference for all roadmap context, design decisions, and architectural patterns

---

## 1. HANDOFF DOCUMENT SUMMARIES

### HANDOFF v1 (`snapshots/v1-pre-pretext/HANDOFF-phase-a.md`)

**Status:** Original spec, superseded by v2
**Key contribution:** Established the pretext integration plan and obstacle-wrap concept

- Defined the goal: replace `contenteditable` text surface with a [pretext](https://github.com/chenglou/pretext)-driven editorial engine
- Specified vendoring strategy (Option A: bun build, Option B: hand-port)
- Defined `EditorialEngine` class API: `insertText`, `deleteText`, `addObstacle`, `updateObstacle`, `removeObstacle`, `getCaretRect`, `layout`
- Established the layout pipeline: collect obstacle rects → feed as wrap-geometry exclusions → render line boxes → place caret
- Introduced sirkit kinds for Phase B: `embed-iframe`, `phreak-mini`, `image-pin`
- Identified gotchas: streaming reflow cost, caret on empty surface, bidi, font loading, z-order

### HANDOFF v2 (`snapshots/v1-pre-pretext/HANDOFF-phase-a-v2.md`)

**Status:** Superseded v1, still authoritative for streaming architecture, drift mechanics, Voidflow keys, gotchas, Settings rollout, and Phase B–E roadmap
**Key contribution:** Defined the drift surface mental model and three-queue streaming architecture

- **The mental model:** The void is NOT a chat window. It is a **drift surface** where text rises from the cyan line and wraps around obstacles via pretext
- **Caret = the line.** No bottom-center input box. You type from the line
- **Sirkits** are the single naming concept for all spawnable surfaces (not "embeds", not "TUI experiences")
- Defined the **three-queue streaming architecture**: Network Queue → Word Queue → Reveal Queue
- Specified **resume-from-point layout** for incremental, cheap per-word commits
- Defined **drift mechanics**: single `translateY` on content wrapper, buffer trail, cursor metronome
- Introduced **Settings JSON** with `Voidflow` category and tunables
- Full **Phase A–E roadmap** with Polish/icing items
- **Phase A.5:** phreak-mini sirkit
- **Phase B:** dynamic-caret-engine (state machine: LINE | RAIL_LEFT | RAIL_RIGHT | RAIL_BOTH | MIGRATING)
- **Phase C:** rails fallback (lower-fifth left/right side panels)
- **Phase D:** sirkit zoo (embed-iframe, image-pin, pty-process, react-component)
- **Phase E:** full Settings table UI
- **Polish:** skip-to-end key, drift arc, older prose decay, per-character reveal, stream attribution glyph, OCR highlight

### HANDOFF v3 (`snapshots/v2-tap6-single-rect/HANDOFF-phase-a-v3.md`)

**Status:** Superseded v2's drift-engine approach, still authoritative for pivot rationale and editorial-pattern observations
**Key contribution:** The pivot from custom drift-engine to the editorial-engine pattern

- **The pivot:** v2's custom drift engine had subtle coordinate-system and ordering bugs. The breakthrough was using the **working precision instrument** in `uploads/the-editorial-engine.{js,html}` — a 22KB pretext-driven layout engine
- **Editorial pattern vs v2 drift-engine:** Stateless full re-layout per frame (~0.5ms) vs incremental state machine (~510 lines). No state to corrupt
- **Chisel tap sequence:** 8 taps to reduce the demo to st8's foundation
  - Tap 1: Remove headline text
  - Tap 2: Remove drop cap
  - Tap 3: Remove pull quotes
  - Tap 4: Remove stats bar / demo furniture
  - Tap 5: Remove multi-column logic
  - Tap 6: Three orbs → one cyan-bordered draggable rect
  - Tap 7: Clear `BODY_TEXT` to empty
  - Tap 8: Rename to `void-engine.{js,html}`
- **Key editorial-engine observations:**
  - Full re-layout per frame is cheap (~0.5ms)
  - Obstacles are first-class: `{x, y, w, h}` with optional `hPad`/`vPad`
  - Pretext caches by font shorthand string
  - `prepareWithSegments` is idempotent and cheap on stable text
  - The line pool pattern is the only DOM-touching code
  - Drag = direct rect mutation, no relayout call needed
- **Concept folder:** `Concept/drift-engine.js` preserved for future revival (v2's incremental approach is right for large scrollback scenarios)

### HANDOFF v4 (`snapshots/v4-restored/HANDOFF-phase-a-v4.md`)

**Status:** Current source of truth
**Key contribution:** Canonical UI restoration and chatbox-anchor mechanism

- **What shipped since v3:**
  - Tap 8: Renamed to `vendor/void-engine.{js,html}`
  - Keyboard wiring: `window.keydown` appends to `BODY_TEXT`, Backspace truncates, Enter inserts `\n\n`
  - Stage `clientWidth` fix: text no longer bleeds behind dock
  - Canonical UI restored: dock (cyan line, ∞ button, Monoton `st8` mark, `phreak>` button) + both overlay panels
  - Explorer + phreak aesthetics restored (~500 lines inline CSS)
  - Wave-pulse cursor created by `void-engine.js` inside `#stage`
  - **Chatbox-anchor mechanism:** Body text bottom-anchored to `CHATBOX_LEFT = 64px`, 24px above dock. Two-pass layout: pass 1 measures unobstructed line count, pass 2 lays out with obstacles. Text grows UPWARD
- **Stabilized idioms:**
  - Snapshots before each milestone (`.txt` copies of all live files)
  - `snapshots/v2-pre-drift/` is THE canonical-UI reference
  - Two-pass layout is fine (sub-millisecond)
  - Cursor element lives inside `#stage`, owned by `void-engine.js`
  - Keyboard listener guards (skip `<input>`, `<textarea>`, `contenteditable`, modifier keys)
  - Panel-titlebar hoisting (explorer + phreak hoist dynamic chrome into parent `.panel-titlebar`)

---

## 2. COMPLETE PHASE/SPRINT MAP

### Phase A — Pretext Integration (COMPLETED through v4)

| Sub-phase | Status | Description |
|-----------|--------|-------------|
| A.0 — Vendor pretext | DONE | Pretext loaded via `https://esm.sh/@chenglou/pretext@0.0.6` |
| A.1 — Settings reader data layer | DONE | localStorage adapter, swappable |
| A.2 — Editorial engine wrapper | DONE | `vendor/void-engine.js` — pretext-powered, single column |
| A.3 — Wire into st8.html | DONE | Surface markup, mount, CSS |
| A.4 — Smoke test | DONE | Text reflowing around test rectangle at 60fps |
| A.5 — First real sirkit | DEFERRED | `kind: 'phreak-mini'` — terminal as draggable obstacle |
| Tap sequence (1–8) | DONE | Chisel reduction of editorial engine to st8 foundation |
| Keyboard wiring | DONE | `window.keydown` → `BODY_TEXT` |
| Canonical UI restore | DONE | Dock + explorer/phreak overlays |
| Chatbox anchor | DONE | Bottom-anchored text, two-pass layout |

### Phase A (remaining) — Next Moves

| Item | Priority | Description |
|------|----------|-------------|
| Drift y-offset | NEXT | Single `translateY`, default OFF until quality dialed in |
| Sirkit registry | NEXT | `addSirkit` / `removeSirkit` / `updateSirkit` replacing hardcoded `rectDefs` |
| Phreak-mini sirkit | NEXT | `phreak-terminal.js` as draggable obstacle, 480×320, `tr` corner |
| Stream API + reveal queue | NEXT | Three queues, per-word atomic commits, 200 WPM metronome |
| Buffer trail | NEXT | Trailing characters between body and cursor, lower opacity |
| Settings reader | NEXT | Voidflow values become POJO-readable |

### Phase B — Dynamic Caret Engine

- Caret as first-class agent with state machine: `LINE | RAIL_LEFT | RAIL_RIGHT | RAIL_BOTH | MIGRATING`
- Events: `obstacle_added/moved/removed`, `obstacle_density_high/low`, `corridor_blocked`, `user_pin_caret`, `stream_started(role)`
- Corridor calculation: vertical band rooted at caret, occlusion sum, threshold + dwell
- Animated migration (~400ms cubic-out)
- Settings: `caret_migration_enabled`, `corridor_block_threshold`, `corridor_block_dwell_ms`, `corridor_clear_dwell_ms`, `caret_migration_duration_ms`, `rail_priority`

### Phase C — Rails Fallback

- Lower-fifth left/right side panels (compressed dock: logo + buttons stack vertical center)
- Rail = stable consumption point when caret has migrated there
- Prose still drifts up through the void from rail-tops
- Trigger conditions: corridor blocked, or explicit user toggle
- `Sirkits.position.anchor` accepts `rail-left` / `rail-right`

### Phase D — Sirkit Zoo

| Kind | Description |
|------|-------------|
| `embed-iframe` | Spotify, YouTube, local webserver |
| `image-pin` | Drop-an-image-on-the-void |
| `pty-process` | htop, btop, etc., framebuffer rendered |
| `react-component` | OCR pad, plot, custom |

### Phase E — Full Settings UI

- File explorer ◇ SETTINGS entry, three-drill-down (category → entry → form)
- Schema-rendered forms, Duplicate button
- Test Connection button, last_tested stamp
- HuggingFace Browse-the-Hub picker
- Categories: `Surfaces`, `Models`, `Shells`, `Keybindings`, `Theme`, `Storage`, `Network`, `Voidflow`

### Polish / Icing (Aspirational)

| Feature | Description |
|---------|-------------|
| Skip-to-end key | `Tab` (or user-bound) drains reveal queue instantly |
| Drift arc | Words curve inward toward void center as they rise |
| Older prose decay | Gradient fade-out at top of void, faint trail |
| Per-character reveal mode | `word_atomic: false` for phreak-style typewriter feel |
| Stream attribution glyph | Small role marker (●) drifting up alongside first line of each turn |
| OCR highlight as obstacle kind | Drop an OCR'd page, regions become individually-selectable obstacles |

---

## 3. THE "WORKSPACES" CONCEPT

The Workspaces concept appears in the **File Explorer** sidebar as a first-class navigation item:

```
◇ HOME
◇ DOCUMENTS
◇ DOWNLOADS
◈ WORKSPACE        ← active workspace (diamond filled)
◇ SIRKITS
◇ MODELS
◇ SHELLS
◇ VOIDFLOW
◇ KEYBINDINGS
◇ THEME
◇ STORAGE
◇ NETWORK
◇ SETTINGS
```

**What Workspaces enable:**

- **Context isolation.** A workspace is a named collection of files, sirkits, and settings that can be switched as a unit. Think of it as a "project" or "session" that remembers what you had open and where
- **The ◇ vs ◈ convention.** Empty diamond (◇) = available/folder. Filled diamond (◈) = active/selected. The workspace is the only item that uses the filled diamond by default, signaling it is the current context
- **File Explorer integration.** The file explorer panel (`file-explorer.js`) is the home for workspace navigation. Selecting WORKSPACE changes what files/locations appear in the explorer's grid/breadcrumb area
- **Sirkit containment.** Sirkits can be scoped to a workspace — when you switch workspaces, the void's obstacle layout can change
- **Settings scoping.** Settings categories (Models, Shells, Voidflow, etc.) can potentially be workspace-scoped, allowing different configurations per project

**Relationship to connection tracking:** The workspace concept scopes connection tracking to a specific codebase/project. A "workspace" represents a target directory being indexed, with its own file registry, connection graph, and status distribution.

### Three Workspace Types (Defined)

The `◈ WORKSPACE` entry switches between workspace types. Each type configures the three panes differently.

**Workspace 1: Standard**
- Void: Normal (pretext/drift active, text flows around sirkits)
- File Explorer: Normal file browsing
- Phreak Terminal: Normal terminal
- Status: Default. Not our focus.

**Workspace 2: Full Stack Logic Analyzer (PRIMARY FOCUS)**
- Void: **Split vertically.** Left = standard chat. Right = file list with GREEN/YELLOW/RED status, Notes button, clipboard button.
- File Explorer: Extended with two buttons: "Add to Chat" + "Index"
- Phreak Terminal: Extended with TUI mode buttons: Isolate GREEN, Isolate YELLOW, Isolate RED, Clear Void, Clear Phreak, Clear All
- Pretext/drift: **DEACTIVATED.** No caret complexity. No text wrapping around obstacles.
- See: `.planning/REFACTORED-PLAN.md` for full specification

**Workspace 3: Pretext Dev**
- Void: Current state — complex dynamic carets, text flying around, pretext active
- File Explorer: Normal
- Phreak Terminal: Normal
- Status: Future development environment for refining the drift surface.

---

## 4. FULL FEATURE ROADMAP

### BUILT (Shipped)

| Feature | File | Status |
|---------|------|--------|
| Pretext integration (CDN) | `vendor/void-engine.js` | LIVE |
| Single-column layout engine | `vendor/void-engine.js` | LIVE |
| Keyboard input (char, backspace, enter) | `vendor/void-engine.js` | LIVE |
| Bottom-anchored chatbox origin | `vendor/void-engine.js` | LIVE |
| Two-pass layout (measure + render) | `vendor/void-engine.js` | LIVE |
| Wave-pulse cyan cursor | `vendor/void-engine.js` | LIVE |
| Single draggable rect obstacle | `vendor/void-engine.js` | LIVE |
| Text reflow around obstacles at 60fps | `vendor/void-engine.js` | LIVE |
| Dock (cyan line, ∞, st8, phreak>) | `st8.html` | LIVE |
| File Explorer overlay | `st8.html` + `file-explorer.js` | LIVE |
| Phreak Terminal overlay | `st8.html` + `phreak-terminal.js` | LIVE |
| Panel aesthetics (pink frame, gold diamond, cyan title) | `st8.html` | LIVE |
| Panel-titlebar hoisting | `st8.html` | LIVE |
| Keyboard listener guards | `vendor/void-engine.js` | LIVE |
| Snapshot system | `snapshots/vN-tag/` | LIVE |

### PLANNED (Next moves, Phase A remaining)

| Feature | Phase | Priority |
|---------|-------|----------|
| Drift y-offset (default OFF) | A | NEXT |
| Sirkit registry API | A | NEXT |
| Phreak-mini sirkit | A.5 | NEXT |
| Stream API (three queues) | A | NEXT |
| Buffer trail visualization | A | NEXT |
| Cursor metronome pulse | A | NEXT |
| Settings reader (POJO) | A | NEXT |

### PLANNED (Future phases)

| Feature | Phase | Description |
|---------|-------|-------------|
| Dynamic caret engine | B | State machine for caret positioning |
| Rails fallback | C | Side panels in lower-fifth |
| Sirkit zoo | D | iframe, image, pty, react obstacles |
| Full Settings UI | E | Schema-driven forms, Duplicate pattern |

### ASPIRATIONAL (Polish)

| Feature | Description |
|---------|-------------|
| Skip-to-end key | Instant queue drain |
| Drift arc | Poetic inward curve |
| Older prose decay | Gradient fade at void top |
| Per-character reveal | Typewriter mode |
| Stream attribution glyph | Role marker per turn |
| OCR highlight obstacles | Selectable OCR regions |

---

## 5. SURFACES/FEATURES FOR CONNECTION TRACKING

The st8 UI provides several surfaces that can be leveraged for the connection tracking use case:

### The Void (Drift Surface)

- **What it is:** The main content area where text flows and sirkits live
- **Connection tracking use:** Display connection status updates as drifting text. File status changes (GREEN/YELLOW/RED) can appear as system-role paragraphs that drift upward
- **Obstacle-wrap:** Connection graphs or file detail panels can be rendered as sirkits in the void, with explanatory text wrapping around them

### File Explorer Panel

- **What it is:** Overlay panel opened by clicking ∞ in the dock
- **Capabilities:** Sidebar navigation, grid view, breadcrumbs, footer, search, gold nav icons
- **Connection tracking use:** The explorer already browses files. It can be extended to show connection status (GREEN/YELLOW/RED indicators), filter by status, and display import/export relationships
- **Workspace integration:** The ◇ WORKSPACE entry could become the connection tracker's home, showing indexed files with their status

### Phreak Terminal Panel

- **What it is:** Overlay panel opened by clicking `phreak>` in the dock
- **Capabilities:** Monospace output area, signal popups, TUI overlay, phone-hook signal framework
- **Connection tracking use:** The terminal can display indexer output, reindex progress, and connection graph statistics in real-time. Signal popups can notify on status changes

### Settings System

- **What it is:** Schema-driven, sqlite-backed configuration with categories
- **Connection tracking use:** A new `CONNECTIONS` or `INDEXER` category can be added to Settings for configuring target directories, entry points, watch patterns, and refresh intervals

### Sirkits (Obstacles)

- **What it is:** Spawnable surfaces in the void that text wraps around
- **Connection tracking use:** A `kind: 'connection-graph'` sirkit could render an interactive dependency graph as an obstacle. A `kind: 'status-panel'` sirkit could show live file status counts

### Buffer Trail

- **What it is:** Visual representation of pending reveal queue depth
- **Connection tracking use:** Can be repurposed to show indexer progress — trail extends while indexing, shrinks when complete

---

## 6. FIXED DESIGN TOKENS (NON-NEGOTIABLE)

These tokens appear in every HANDOFF version and are explicitly marked as "do not invent new":

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--void` | `#0A0A0B` | Background (obsidian black) |
| `--text` | `#E0E0E0` | Primary text |
| `--gold` | `#D4AF37` | st8 wordmark, diamonds, nav icons, system-role text |
| `--cyan` | `#1FBDEA` | UI chrome, cursor, dynamic data, prompt, buffer trail |
| `--pink` | `#C9748F` | Notifications, error chrome, rim accents, panel frames |

### Typography

| Font | Usage | File |
|------|-------|------|
| `Monoton` | Wordmark ("st8") | `fonts/Monoton-Regular.ttf` |
| `Poiret One` | Chrome labels, body text, all laid-out text | `fonts/PoiretOne-Regular.ttf` |

### Type Idioms

| Pattern | Usage |
|---------|-------|
| `0.5px -webkit-text-stroke` | Brand "weight bump" on text |
| `'18px "Poiret One"'` | Canonical font string for pretext measurement |
| `letter-spacing: 1px` | Body text spacing |
| `font-size: 18px` | Body text size |

### Z-Order (Fixed)

| Layer | Z-Index | Element |
|-------|---------|---------|
| Text lines | 1 | `.void-line` |
| Obstacles + buffer trail | 2 | `.void-obstacle`, `.void-buffer-trail` |
| Cursor | 3 | `.void-cursor` |

### Panel Aesthetics (Fixed)

| Element | Style |
|---------|-------|
| Panel frame | Pink border (`var(--pink)`) |
| Close button | Gold diamond (◇), positioned LEFT |
| Title bar | Cyan text (`var(--cyan)`) |
| Explorer sidebar | Gold nav icons |
| Phreak output | Monospace |

### Design Principles

- **NO emojis.** Text + CSS only
- **NO new color tokens.** Use only the five defined above
- **NO frameworks.** Vanilla JS, vanilla CSS
- **The lower-fifth-UI is sacred ground.** It holds the dock. It does NOT hold a chat input

---

## 7. FILE EXPLORER WORKSPACE FUNCTIONALITY

The File Explorer (`file-explorer.js`) is a panel overlay with the following structure:

### Navigation Items

```
◇ HOME
◇ DOCUMENTS
◇ DOWNLOADS
◈ WORKSPACE
◇ SIRKITS
◇ MODELS
◇ SHELLS
◇ VOIDFLOW
◇ KEYBINDINGS
◇ THEME
◇ STORAGE
◇ NETWORK
◇ SETTINGS
```

### Capabilities

- **Sidebar navigation** with gold diamond icons
- **Grid view** for file browsing
- **Breadcrumbs** for path navigation
- **Footer** with status information
- **Search** functionality
- **Panel-titlebar hoisting** — dynamic chrome (error banner) pushed into parent `.panel-titlebar`

### Workspace Behavior

- `◈ WORKSPACE` is the active workspace indicator (filled diamond)
- Selecting it shows the current workspace's files/locations
- `File Explorer Locations` in Settings extends the navigation items as data, not hardcoded: `name, path, glyph, sort_order`
- The explorer is mounted into `#explorer-host` in `st8.html`

### Connection Tracking Integration Points

- The explorer can display file status (GREEN/YELLOW/RED) alongside file names
- The `WORKSPACE` entry can become the connection tracker's index view
- The sidebar can add a `◇ CONNECTIONS` entry for the connection graph
- The search can filter by connection status
- The grid can show import/export counts per file

---

## 8. VOID-ENGINE, PRETEXT, AND DRIFT SURFACE RELATIONSHIP

### The Stack

```
┌─────────────────────────────────────────────┐
│  st8.html  (canonical UI: dock + overlays)  │
├─────────────────────────────────────────────┤
│  vendor/void-engine.js  (layout engine)     │
├─────────────────────────────────────────────┤
│  @chenglou/pretext  (text layout primitive) │
└─────────────────────────────────────────────┘
```

### Pretext (Foundation)

- **What:** A text layout library by chenglou that handles line-breaking, bidirectional text, and measurement
- **Key API:** `prepareWithSegments()`, `layoutNextLineRange()`, `materializeLineRange()`, `walkLineRanges()`
- **Property:** Pretext is unaware of obstacles entirely. It lays out text in columns. The engine feeds it varying widths and it produces line breaks
- **Loaded via:** `https://esm.sh/@chenglou/pretext@0.0.6` (CDN, one-line switch to local vendor)

### Void Engine (Middle Layer)

- **What:** `vendor/void-engine.js` — a ~250-line wrapper around pretext that implements the drift surface
- **Responsibilities:**
  - Keyboard input handling
  - Body text management (`BODY_TEXT` string)
  - Two-pass layout (measure unobstructed → render with obstacles)
  - Bottom-anchored chatbox origin (64px left, 24px above dock)
  - Cursor positioning and animation
  - Obstacle rect management (`rectDefs` → future sirkit registry)
  - Frame loop (`requestAnimationFrame`)
- **Pattern:** Full re-layout per frame, ~0.5ms. Dirty flag skips when nothing changed. No incremental state to corrupt

### Drift Surface (Mental Model)

- **What:** The void is not a chat window. It is a surface where text rises from the cyan line and wraps around obstacles
- **Properties:**
  - Text appears at the chatbox origin (bottom-left, 64px from left, 24px above dock)
  - Text grows UPWARD as you type
  - Sirkits (obstacles) sit anywhere in the void
  - Text wraps around obstacles in real-time via pretext
  - Old prose dims and fades out the top (future: drift y-offset)
  - The cyan dash cursor is the caret — you type FROM the line
- **Why different:** Other UIs enforce chat-window vs document vs app boundaries with chrome. st8 collapses all three into one drift surface

### Concept Folder (Preserved Alternative)

- `Concept/drift-engine.js` contains v2's incremental approach
- **When to revive:** For cases where full re-layout is too expensive (e.g., chat scrollback of 10,000 lines, frequent insertions)
- **Current path:** v3's editorial pattern is right for st8's fixed-viewport drift surface with small active text bodies

---

## 9. "CONTEXTUALLY RELEVANT SUPERPOWERS"

This phrase captures the project's philosophy about what the UI should provide:

### Definition

"Contextually relevant superpowers" means the UI surfaces tools, information, and actions that are **relevant to what the user is currently doing** — not a fixed toolbar of generic buttons.

### How It Manifests

| Context | Superpower | Mechanism |
|---------|------------|-----------|
| Typing in the void | Text flows around obstacles | Pretext + void engine |
| Dragging a sirkit | Prose freezes, relayouts on release | Pause/resume protocol |
| Streaming LLM response | Buffer trail shows queue depth | Visual queue representation |
| Cursor pulsing | Model speed is visible | Cursor metronome |
| File in explorer | Copy context for LLM | Clipboard integration |
| Phreak terminal | Phone-hook signal framework | Signal popups |

### For Connection Tracking

The "contextually relevant superpowers" for connection tracking would be:

| Context | Superpower |
|---------|------------|
| Viewing a file | Show its connection status (GREEN/YELLOW/RED) |
| File status changes | Auto-reindex + visual notification |
| Hovering a file | Show import/export relationships |
| Selecting a RED file | Show what imports it (orphan root cause) |
| Selecting a GREEN file | Show its reachability path from entry point |
| Indexing in progress | Buffer trail shows progress |
| Index complete | Cursor pulse + status summary in void |

### The Philosophy

The user treats the LLM as a **partner, not a tool.** The UI should enable that partnership by making information visible and actionable in context — not by requiring the user to switch views or run commands. The drift surface is the medium; the superpowers are what it can show.

---

## 10. CONSOLIDATED UI COMPONENTS

### Dock (`st8.html`)

| Element | Position | Action |
|---------|----------|--------|
| Cyan line | Bottom edge of void | Visual separator |
| ∞ button | Left of dock | Opens File Explorer overlay |
| `st8` wordmark | Center of dock | Monoton font, gold |
| `phreak>` button | Right of dock | Opens Phreak Terminal overlay |

### Void (`st8.html` + `vendor/void-engine.js`)

| Element | Owner | Description |
|---------|-------|-------------|
| `#stage` | `void-engine.js` | Layout container, scales at low zoom |
| `.void-surface` | `void-engine.js` | Text rendering area |
| `.void-cursor` | `void-engine.js` | 5-dash cyan animated cursor, wave-pulse |
| `.void-line` | `void-engine.js` | Individual text line spans |
| `.void-obstacle` | `void-engine.js` | Sirkit containers |
| `.void-buffer-trail` | `void-engine.js` | Queue depth visualization (future) |

### File Explorer (`file-explorer.js`)

| Element | Description |
|---------|-------------|
| Sidebar | Navigation with gold diamond icons |
| Grid | File browsing area |
| Breadcrumbs | Path navigation |
| Footer | Status information |
| Search | File filtering |
| Titlebar | Cyan title, gold diamond close (LEFT), hoisted chrome |

### Phreak Terminal (`phreak-terminal.js`)

| Element | Description |
|---------|-------------|
| Output area | Monospace terminal display |
| Signal popups | Notification system |
| TUI overlay | Text UI mode |
| Phone-hook controls | Signal framework UI |
| Titlebar | Cyan title, gold diamond close (LEFT), hoisted chrome |

### Settings (Planned — Phase E)

| Element | Description |
|---------|-------------|
| Category list | Drill-down from `◇ SETTINGS` |
| Entry list | Rows per category |
| Form view | Schema-rendered form per entry |
| Duplicate button | Clone row with `(copy)` suffix |
| Test Connection | Round-trip test, stamps `last_tested` |
| Browse the Hub | HuggingFace model picker |

### Overlay System

| Behavior | Implementation |
|----------|----------------|
| Open | Click dock button → panel appears |
| Close | Escape key OR click outside |
| Input isolation | Keyboard listener guards prevent void input leakage |
| Titlebar hoisting | Panel chrome pushed into parent `.panel-titlebar` |

---

## APPENDIX: FILE REFERENCE

### Snapshot Directories

| Directory | Contents | Authority |
|-----------|----------|-----------|
| `snapshots/v1-pre-pretext/` | HANDOFF v1, v2; pre-pretext rollback point | v2: streaming, drift, Voidflow, gotchas, roadmap |
| `snapshots/v2-pre-drift/` | Canonical UI source-of-truth (pre-engine pivot) | Dock + explorer + phreak CSS/JS reference |
| `snapshots/v2-tap6-single-rect/` | HANDOFF v3; tap 6 snapshot | v3: pivot rationale, editorial-pattern observations |
| `snapshots/v3-tap8-keyboard/` | Post-tap-8 + keyboard snapshot | `void-engine.js` with keyboard wiring |
| `snapshots/v4-restored/` | HANDOFF v4; canonical UI restored | Current state of the art |

### Source Files

| File | Purpose |
|------|---------|
| `st8.html` | Canonical UI: void + dock + explorer/phreak overlays |
| `vendor/void-engine.js` | Pretext engine + keyboard + cursor + bottom-anchor |
| `vendor/void-engine.html` | Standalone demo shell for the engine |
| `file-explorer.js` | File browser panel, mounted into `#explorer-host` |
| `phreak-terminal.js` | Terminal panel, mounted into `#phreak-host` |
| `fonts/Monoton-Regular.ttf` | Wordmark font |
| `fonts/PoiretOne-Regular.ttf` | Chrome + body font |
| `Concept/drift-engine.js` | v2's incremental engine, preserved for revival |

### Planning Documents

| File | Purpose |
|------|---------|
| `.planning/st8-bootstrap-proposal.md` | Connection tracker bootstrap proposal (447 lines) |
| `.planning/st8-technical-reference.md` | Backend code patterns and types (748 lines) |
| `.planning/st8-DELIVERABLE-SUMMARY.md` | Proposal overview and next steps (304 lines) |
| `.planning/HANDOFF-MASTER-REFERENCE.md` | THIS FILE — consolidated roadmap reference |

### Pretext Reference

| File | Purpose |
|------|---------|
| `uploads/pretext-main/` | Full pretext repo (reference) |
| `uploads/the-editorial-engine.{js,html}` | Original demo (reference) |

---

## APPENDIX: KEY DECISIONS LOG

| Decision | Made In | Rationale |
|----------|---------|-----------|
| Use pretext for text layout | v1 | Native obstacle-wrap, bidi support, fast measurement |
| "Sirkits" as single naming concept | v2 | One concept, one category in Settings |
| Three-queue streaming architecture | v2 | Pace for human, not network |
| Per-word atomic commits | v2 | Line-break opportunities only at word boundaries |
| Full re-layout per frame (not incremental) | v3 | ~0.5ms, no state to corrupt, simpler |
| Editorial engine as foundation | v3 | Working precision instrument, 22KB, proven at 60fps |
| Bottom-anchored chatbox origin | v4 | Text grows upward from dock line |
| Two-pass layout | v4 | Sub-millisecond, acceptable tradeoff |
| Pretext via CDN (not local build) | v3 | One-line switch when ready to vendor |
| Canonical UI reference at `v2-pre-drift/` | v4 | Has been restored from twice; never reconstruct from memory |
| Snapshot before each milestone | v4 | Rollback is `cp snapshots/vN/foo.txt foo.{html,js,css}` |

---

*End of HANDOFF MASTER REFERENCE*
