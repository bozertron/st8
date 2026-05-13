# ST8 Refactored Plan — Full Stack Logic Analyzer Workspace

**Date:** 2026-05-11
**Status:** Ready for execution
**Incorporates:** Ben's corrections, maestro codebase inventory, HANDOFF roadmap

---

## Core Principles (Non-Negotiable)

1. **Aesthetic tokens are FIXED.** `--void`, `--text`, `--gold`, `--cyan`, `--pink`. Monoton + Poiret One. 0.5px text-stroke. No new tokens. No exceptions.
2. **Three panes are FIXED.** Void (main area), File Explorer (overlay), Phreak Terminal (overlay). The lower 5th UI dock is sacred.
3. **Use existing code.** 44,000+ lines of production-quality parsers, graph builders, and visualization tools exist in `/home/bozertron/Software Projects/maestro-scaffolder-tool/dist/`. Write ZERO new parser code.
4. **DO NOT copy or move files from maestro into st8.** Reference maestro code by path. Import/require from the maestro directory. Never duplicate.
5. **The void is split for Logic Analyzer workspace.** Left = standard chat. Right = file list with colors, notes, clipboard. Pretext/drift is DEACTIVATED in this workspace.
6. **Indexing is project-root-level.** Not file-level. The indexing engine scans the entire target directory automatically.
7. **Chat area uses no text bubbles.** Text offset and spacing only. Clean, minimal.
8. **"Add to Chat" button already exists** in the file explorer. Do not create a new one.

---

## Architecture: Three Workspace Types

The file explorer's `◈ WORKSPACE` entry switches between workspace types. Each type configures the three panes differently.

### Workspace 1: Standard
- **Void:** Normal (pretext/drift active, text flows around sirkits)
- **File Explorer:** Normal file browsing
- **Phreak Terminal:** Normal terminal
- **Status:** Not our focus. Exists as-is.

### Workspace 2: Full Stack Logic Analyzer (OUR FOCUS)
- **Void:** Split vertically. Left = standard chat. Right = file list with GREEN/YELLOW/RED status, Notes button, clipboard button.
- **File Explorer:** Extended with two buttons: "Add to Chat" + "Index"
- **Phreak Terminal:** Extended with TUI mode buttons: Isolate GREEN, Isolate YELLOW, Isolate RED, Clear Void, Clear Phreak, Clear All
- **Pretext/drift:** DEACTIVATED. No caret complexity. No text wrapping around obstacles.

### Workspace 3: Pretext Dev
- **Void:** Current state — complex dynamic carets, text flying around, pretext active
- **File Explorer:** Normal
- **Phreak Terminal:** Normal
- **Status:** Future development environment for refining the drift surface.

---

## The Void Split (Logic Analyzer Workspace)

```
┌─────────────────────────────────────────────────────────────────┐
│                        THE VOID                                  │
├────────────────────────────┬────────────────────────────────────┤
│                            │                                    │
│    LEFT SIDE               │    RIGHT SIDE                      │
│    Standard Chat           │    File List                       │
│                            │                                    │
│    - User messages         │    - File name                     │
│    - LLM responses         │    - Status color (G/Y/R)          │
│    - System messages       │    - [Notes] button → popup form   │
│                            │    - [Clipboard] button             │
│                            │                                    │
│                            │    Notes Popup:                    │
│                            │    ┌──────────────────────────┐    │
│                            │    │ Purpose: [textarea]       │    │
│                            │    │ Depends On: [textarea]    │    │
│                            │    │ Value: [textarea]         │    │
│                            │    │ [Cancel]  [Save]          │    │
│                            │    └──────────────────────────┘    │
│                            │                                    │
├────────────────────────────┴────────────────────────────────────┤
│                    LOWER 5TH UI (DOCK)                           │
│    [∞]              st8              [phreak>]                   │
└─────────────────────────────────────────────────────────────────┘
```

### Notes Popup Behavior
- **Trigger:** Click [Notes] button on a file row in the right side
- **Form fields:** Purpose, Depends On Behavior, Value Statement
- **Buttons:** Cancel (does nothing), Save (saves to fingerprint + triggers hook)
- **Save hook:** 
  1. Writes to `file_intent` table in SQLite
  2. Adds event to `activity_log`
  3. Injects the change into the LLM's context window (so the AI sees the note immediately)
  4. Regenerates manifest (connection-state.json + ai-signal.toml)
- **Safeguard:** The form is a popup/overlay that prevents accidental code edits. Only data editing, never code editing.

---

## File Explorer: Two Buttons

The File Explorer panel gets two new contextually relevant buttons in its footer:

### Button 1: "Add to Chat"
- **Action:** Surfaces selected files in the void's right side (file list)
- **Also:** Surfaces files in the phreak terminal (as system lines showing file status)
- **Clearing:** TUI mode has "Clear Void", "Clear Phreak>", "Clear All" buttons
- **No copy/paste needed.** The button IS the hook. Files are already visible.

### Button 2: "Index"
- **Action:** Triggers the indexing engine on the current workspace's project root
- **Scope:** Project-root-level. Scans ALL files in the target directory.
- **Process:** Walk → Hash → Parse → Build Graph → Classify → Write Manifest → Update SQLite
- **After indexing:** Phreak terminal's TUI senses it's in a Fingerprint-enabled repo and loads related option buttons
- **Notes:** Left empty after indexing. Human and AI populate them over time.

---

## Phreak Terminal: TUI Mode Buttons

When in TUI mode, the phreak terminal exposes contextually relevant buttons:

### Isolation Buttons
- **Isolate GREEN** — Filters file list to GREEN files (reachable from entry point)
- **Isolate YELLOW** — Filters to YELLOW files (imported but not reachable)
- **Isolate RED** — Filters to RED files (orphaned)
- **Show ALL** — Removes filter

### Each isolation view offers:
- **"Make Topic of Chat"** — Loads filtered files into the void's right side as context
- **"Export Report"** — Generates JSON/TOML report of filtered files
- **"Create Sprint"** — Creates a sprint document from filtered files
- **"Run Analysis"** — Uses @ and / commands to run analysis on filtered files
- **"Signal Path Map"** — Generates a message with signal path maps for filtered files

### Clear Buttons
- **Clear Void** — Removes files from the void's right side
- **Clear Phreak>** — Clears terminal output
- **Clear All** — Clears both

---

## The Fingerprint System

### FileFingerprint Structure
```
FileFingerprint = {
  identity: {
    sha256: string,           // content hash (from maestro's SHA-256 code)
    filepath: string,         // current path
    aliases: string[],        // previous paths (survives renames)
  },
  connections: {
    imports: string[],        // what this file imports (from maestro's astParser.js)
    importedBy: string[],     // what imports this file
    dynamicImports: string[], // detected but unresolved
  },
  classification: {
    status: 'GREEN' | 'YELLOW' | 'RED',
    reachabilityScore: number,
    impactRadius: number,
    lastVerified: string,
  },
  intent: {
    purpose: string,          // manually authored via Notes popup
    dependsOnBehavior: string, // manually authored
    valueStatement: string,   // manually authored
    notes: Array<{
      author: 'USER' | 'AI',
      text: string,
      timestamp: string,
      context: string,
    }>,
  },
  activity: {
    lastModified: string,
    lastIndexed: string,
    statusHistory: Array<{
      from: string,
      to: string,
      timestamp: string,
      trigger: string,        // USER_UI | AI_SIGNAL | FILE_HOOK | MANUAL
    }>,
  },
}
```

### SQLite Schema
```sql
CREATE TABLE file_registry (
  fingerprint TEXT PRIMARY KEY,
  filepath TEXT,
  filename TEXT,
  sha256_hash TEXT,
  status TEXT,              -- GREEN | YELLOW | RED
  reachability_score REAL,
  impact_radius INTEGER,
  last_modified TEXT,
  last_indexed TEXT
);

CREATE TABLE connections (
  source_fingerprint TEXT,
  target_fingerprint TEXT,
  connection_type TEXT,     -- IMPORT | EXPORT | DYNAMIC
  is_resolved INTEGER,
  last_verified TEXT
);

CREATE TABLE file_intent (
  fingerprint TEXT PRIMARY KEY,
  purpose TEXT,
  depends_on_behavior TEXT,
  value_statement TEXT,
  authored_by TEXT,         -- USER | AI | INFERRED
  last_updated TEXT
);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  source TEXT,              -- USER_UI | AI_SIGNAL | FILE_HOOK | MANUAL
  action TEXT,              -- CONNECTED | DISCONNECTED | MODIFIED | VERIFIED | NOTE_ADDED
  target_fingerprint TEXT,
  details TEXT              -- freeform JSON
);
```

---

## Maestro Code to Reuse (ZERO New Parser Code)

### Critical (Direct Reuse)
| Capability | Maestro File | What It Does |
|---|---|---|
| AST import/export parsing | `dist/utils/astParser.js` (965 lines) | Extracts imports/exports via @babel/parser, falls back to regex |
| Graph building | `dist/commands/graphBuilder.js` (213 lines) | Adjacency lists, DFS circular deps, orphan detection, health scores |
| Graph traversal | `dist/commands/graphTraversal.js` (827 lines) | BFS path finding, reachability, impact chains, directory boundaries |
| SQLite persistence | `dist/commands/integr8/databasePersister.js` (228 lines) | better-sqlite3, WAL mode, platform-aware paths |
| Background indexing | `dist/commands/backgroundIndexer.js` (811 lines) | Chokidar file watching, SHA-256 hashing, incremental updates |
| Connection classification | `dist/commands/integr8/relationshipAnalyzer.js` (923 lines) | SAFE/REWRITE/CONFLICT/MISSING classification, Tarjan's SCC |
| TOML serialization | `dist/commands/integr8/tomlSerializer.js` (417 lines) | Structured TOML output for manifests |

### High (Visualization Reuse)
| Capability | Maestro File | What It Does |
|---|---|---|
| D3 graph export | `src/commands/architectureExporter.ts` | D3 force-directed graph, DOT/Graphviz, JSON export |
| Dashboard API | `src/commands/dashboardApi.ts` | Health scores, module metrics, activity timelines |
| Report generation | `src/commands/integr8/reportGenerator.ts` | Markdown reports with 🟢🟡🟠🔴 risk levels |
| Historical analysis | `src/commands/historicalAnalyzer.ts` | Stability timelines, trend analysis |
| Pattern discovery | `src/commands/patternDiscovery.ts` | Design patterns, anti-patterns with severity |

### UI Spec (Design System)
| Asset | Maestro File | What It Provides |
|---|---|---|
| UI requirements | `docs/ui-requirements.md` (1500 lines) | D3.js v7, Vanilla JS module pattern, reusable components (gauges, data tables, status badges, filter bars) |

---

## Build Sequence

### Phase 0: Workspace Foundation + Input Verification (30 min)
- Add "Full Stack Logic Analyzer" as a workspace option in `file-explorer.js`
- Wire workspace selection to set a target directory
- Add "Standard" and "Pretext Dev" as other workspace options (Standard = default, Pretext Dev = current behavior)
- **Verify keyboard and mouse are working** across all three panes (void, file explorer, phreak terminal)
- Test: typing in void, clicking in file explorer, typing in phreak terminal, Escape to close panels

### Phase 1: Void Split (2 hours)
- Modify `st8.html` to support vertical split when Logic Analyzer workspace is active
- Left side: standard chat area (**NO text bubbles** — text offset and spacing only, clean and minimal)
- Right side: file list container (initially empty)
- CSS for the split layout (respecting all fixed tokens)
- Switching workspaces toggles between split and full-void modes
- **Verify:** keyboard input works in left side, mouse clicks work on right side

### Phase 2: Indexer Backend (3 hours)
- Create `st8/backend/` directory
- Create `indexer.js` — references maestro's `backgroundIndexer.js` + `astParser.js` + `graphBuilder.js` (DO NOT copy files)
- Create `persistence.js` — references maestro's `databasePersister.js` with st8's schema
- Create `manifestGenerator.js` — references maestro's `tomlSerializer.js` for connection-state.json + ai-signal.toml
- Create `fileWatcher.js` — references maestro's chokidar integration
- The indexer is a Node.js CLI script. Headless. No DOM. No UI dependency.

### Phase 3: File Explorer "Index" Button (1 hour)
- **"Add to Chat" button already exists** — do not create a new one
- Add "Index" button to file explorer footer (triggers indexer on project root)
- Index button shows progress in phreak terminal
- After indexing completes, show "Verify Codebase" button (see Phase 8)

### Phase 4: Void Right Side — File List (2 hours)
- Render file list in the void's right side with:
  - File name
  - Status color (GREEN/YELLOW/RED)
  - [Notes] button
  - [Clipboard] button
- File list auto-refreshes when manifest updates
- Color coding: `--gold` for GREEN, `--cyan` for YELLOW, `--pink` for RED

### Phase 5: Notes Popup (1 hour)
- Click [Notes] on a file row → popup overlay appears
- Form fields: Purpose, Depends On Behavior, Value Statement
- Pre-populated from `file_intent` table if notes exist
- Cancel = close without saving
- Save = write to SQLite + add to activity_log + inject into LLM context + regenerate manifest
- Form is a popup/overlay — prevents accidental code editing

### Phase 6: Phreak TUI Buttons (2 hours)
- Add TUI mode buttons: Isolate GREEN, Isolate YELLOW, Isolate RED, Show ALL
- Each isolation view offers: Make Topic of Chat, Export Report, Create Sprint, Run Analysis, Signal Path Map
- Add Clear Void, Clear Phreak>, Clear All buttons
- TUI senses when in a Fingerprint-enabled repo and loads related options

### Phase 7: Clipboard Context (1 hour)
- [Clipboard] button copies: file content + fingerprint entry (status, connections, intent notes, recent activity)
- Paste-ready for LLM conversations
- Includes all context the AI needs to understand the file's role in the system

### Phase 8: Runtime Attendance Call (2 hours)
- Add `__st8_verify()` pattern to priority files
- Indexer calls verify functions during sweep
- Verify function returns: identity, expected connections, provided exports, runtime health check
- Results feed into manifest as runtime-verified status
- **"Verify Codebase" button** appears in file explorer AFTER a codebase has been indexed
- Button triggers the runtime attendance call on the indexed codebase

### Phase 9: Graph Visualization (2 hours)
- Use maestro's `architectureExporter.ts` for D3 graph export (reference, do not copy)
- Render connection graph in the void's right side (or as a popup)
- D3 force-directed graph with GREEN/YELLOW/RED node coloring
- Click node → shows file details + notes

### Phase 10: Full Settings UI (2 hours)
- File explorer ◇ SETTINGS entry, three-drill-down (category → entry → form)
- Schema-rendered forms, Duplicate button
- Categories: Sirkits, Models, Shells, Voidflow, Keybindings, Theme, Storage, Network
- Test Connection button, last_tested stamp
- HuggingFace Browse-the-Hub picker

### Phase 11: Multi-LLM Coordination (1 hour)
- Manifest (connection-state.json + ai-signal.toml) is the coordination layer
- Both LLMs read the same manifest
- When one makes a fix, watcher fires, manifest updates, other LLM sees truth
- No "what's the current state?" questions needed

---

## What We're NOT Building (Explicitly Deferred)

- **Pretext/drift integration for Logic Analyzer workspace.** Deactivated. The void is a split screen, not a drift surface.
- **Dynamic caret engine (Phase B).** Deferred to Pretext Dev workspace.
- **Rails fallback (Phase C).** Deferred.
- **Sirkit zoo (Phase D).** Deferred.
- **New parser code.** We use maestro's existing 44,000+ lines.
- **New visualization code.** We use maestro's existing D3/graph/dashboard infrastructure.
- **Copying/moving files from maestro.** Reference by path only.

---

## Total Estimated Effort

| Phase | Hours | Description |
|---|---|---|
| 0 | 0.5 | Workspace foundation + input verification |
| 1 | 2 | Void split (no text bubbles) |
| 2 | 3 | Indexer backend |
| 3 | 1 | File explorer "Index" button |
| 4 | 2 | Void right side file list |
| 5 | 1 | Notes popup |
| 6 | 2 | Phreak TUI buttons |
| 7 | 1 | Clipboard context |
| 8 | 2 | Runtime attendance call + Verify button |
| 9 | 2 | Graph visualization |
| 10 | 2 | Full Settings UI |
| 11 | 1 | Multi-LLM coordination |
| **Total** | **19.5** | |

---

## Success Criteria

| Criterion | Validation |
|---|---|
| Workspace switching works | Click ◈ WORKSPACE → select "Full Stack Logic Analyzer" → void splits |
| Keyboard and mouse work | Typing in void, clicking in file explorer, typing in phreak terminal all functional |
| Indexing works | Click "Index" in file explorer → phreak shows progress → files appear in void right side with colors |
| GREEN/YELLOW/RED classification matches maestro | Same files, same status as maestro's own analysis |
| Notes popup works | Click [Notes] → form appears → edit → Save → note persists + LLM sees it |
| TUI isolation works | Click "Isolate RED" → only RED files shown → "Make Topic of Chat" loads them |
| Add to Chat works | Select files → click existing "Add to Chat" → files appear in void right side + phreak terminal |
| Verify Codebase button appears | After indexing, "Verify Codebase" button shows in file explorer |
| Manifest generated | connection-state.json + ai-signal.toml exist and are valid |
| File watcher works | Change a file → manifest updates within 2 seconds |
| Clipboard context works | Click [Clipboard] → paste into LLM conversation → AI has full context |
| Settings UI works | ◇ SETTINGS → category → entry → form → edit → save |
| Aesthetic tokens preserved | All five tokens used correctly. No new tokens. Monoton + Poiret One only |
| No text bubbles in chat | Chat area uses text offset and spacing only |
| No files copied from maestro | All maestro code referenced by path, never duplicated |

---

*End of refactored plan.*
