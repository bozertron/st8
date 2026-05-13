# ST8 — Full Stack Logic Analyzer

**Version:** 0.1.0  
**Date:** 2026-05-11  
**Status:** Development

---

## What is ST8?

ST8 is a standalone codebase analysis tool that provides real-time visibility into file connection state. It's the first in a series of tools: **st8 → integr8 → actu8 → orchestr8**.

> "You can't integrate what you can't see. You can't actuate what you haven't integrated. You can't orchestrate what you haven't actuated."

ST8 gives you the ability to **see** the state of your codebase — which files are connected, which are orphaned, and where the signal path breaks.

---

## Quick Start

```bash
# Navigate to st8 directory
cd /home/bozertron/1_AT_A_TIME/st8

# Install dependencies (first time only)
npm install

# Start with maestro-scaffolder-tool as target
node start.js "/home/bozertron/Software Projects/maestro-scaffolder-tool"

# Start with file watching
node start.js "/home/bozertron/Software Projects/maestro-scaffolder-tool" --watch

# Start in dev mode
node start.js "/home/bozertron/Software Projects/maestro-scaffolder-tool" --dev
```

The server will start at `http://localhost:3847` and open your browser automatically.

---

## Architecture

```
st8/
├── st8.html                    # Main UI (void + dock + panels)
├── file-explorer.js            # File browser panel
├── phreak-terminal.js          # Terminal panel
├── graph-visualizer.js         # D3.js graph renderer
├── settings-ui.js              # Settings interface
├── coordination.js             # Multi-LLM synchronization
├── void-engine.js              # Pretext text layout engine
├── settings-reader.js          # Settings persistence
├── fake-stream.js              # Synthetic LLM stream
├── start.js                    # Auto-start script
├── package.json                # Dependencies
│
├── backend/                    # Backend server
│   ├── index.js                # Main entry point
│   ├── indexer.js              # File indexing engine
│   ├── persistence.js          # SQLite database layer
│   ├── manifestGenerator.js    # JSON/TOML manifest generation
│   ├── fileWatcher.js          # File change detection
│   └── server.js               # HTTP server
│
├── lib/                        # Analysis libraries (from maestro)
│   ├── utils/
│   │   ├── astParser.js        # AST-based import/export extraction
│   │   ├── safeFs.js           # Fortified filesystem wrapper
│   │   ├── ioChan.js           # Priority-based I/O router
│   │   └── groundPlane.js      # Directory structure verification
│   └── commands/
│       ├── graphBuilder.js     # Dependency graph builder
│       ├── graphTraversal.js   # Graph traversal and queries
│       ├── backgroundIndexer.js # Background indexing engine
│       └── integr8/
│           ├── databasePersister.js   # SQLite persistence
│           ├── relationshipAnalyzer.js # Connection classification
│           ├── tomlSerializer.js      # TOML serialization
│           └── ...                    # Other integr8 modules
│
├── fonts/                      # Typography
│   ├── Monoton-Regular.ttf     # Wordmark font
│   └── PoiretOne-Regular.ttf   # Chrome/body font
│
└── snapshots/                  # Version snapshots
    ├── v1-pre-pretext/
    ├── v2-pre-drift/
    ├── v2-tap6-single-rect/
    ├── v3-tap8-keyboard/
    └── v4-restored/
```

---

## Workspace Types

ST8 supports three workspace types, switchable from the file explorer sidebar:

### 1. Standard
- Normal void with pretext/drift active
- Text flows around obstacles (sirkits)
- Default mode

### 2. Full Stack Logic Analyzer
- Void splits vertically: left = chat, right = file list
- File list shows GREEN/YELLOW/RED status
- Notes and Clipboard buttons per file
- TUI toolbar with isolation buttons
- Pretext/drift deactivated

### 3. Pretext Dev
- Current state with complex dynamic carets
- Text flying around obstacles
- Development environment for refining the drift surface

---

## Features

### File Indexing
- SHA-256 content hashing
- AST-based import/export parsing
- Dependency graph building
- GREEN/YELLOW/RED classification
- File watching with auto-reindex

### File List (Right Panel)
- Status dots (GREEN/YELLOW/RED)
- Status summary with counts
- Notes button → form-based popup
- Clipboard button → copy context to clipboard

### Notes System
- Purpose field
- Depends On Behavior field
- Value Statement field
- Save persists to SQLite + injects into LLM context
- Cancel does nothing

### TUI Toolbar
- **Isolation Buttons:** GREEN, YELLOW, RED, ALL
- **Action Buttons:** GRAPH, SETTINGS
- **Clear Buttons:** CLEAR VOID, CLEAR PHREAK, CLEAR ALL

### Graph Visualization
- D3.js force-directed graph
- Node coloring by status (GREEN/YELLOW/RED)
- Node sizing by impact radius
- Drag to rearrange
- Zoom and pan

### Settings UI
- Schema-driven categories
- Sirkits, Models, Shells, Voidflow, Keybindings, Theme, Storage, Network
- Duplicate pattern for easy configuration
- Form-based editing

### Multi-LLM Coordination
- Manifest-based synchronization
- Both LLMs read the same connection-state.json
- Polling for real-time updates
- Change detection and notification

---

## Design Tokens (Non-Negotiable)

```css
--void:   #0A0A0B    /* Background (obsidian black) */
--text:   #E0E0E0    /* Primary text */
--gold:   #D4AF37    /* Wordmark, diamonds, system text */
--cyan:   #1FBDEA    /* UI chrome, cursor, dynamic data */
--pink:   #C9748F    /* Notifications, error chrome, rim accents */
```

**Typography:**
- Monoton — Wordmark ("st8")
- Poiret One — Chrome labels, body text

**Idioms:**
- `0.5px -webkit-text-stroke` — Brand "weight bump"
- `letter-spacing: 1px` — Body text spacing
- `font-size: 18px` — Body text size

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves st8.html |
| `/api/connection-state.json` | GET | File connection manifest |
| `/api/ai-signal.toml` | GET | AI consumption manifest |
| `/api/health` | GET | Server health check |
| `/*.js` | GET | JavaScript files |
| `/*.css` | GET | Stylesheets |
| `/*.ttf` | GET | Font files |

---

## Usage Workflow

1. **Start ST8** with maestro-scaffolder-tool as target
2. **Open the file explorer** (click ∞ in the dock)
3. **Select "Logic Analyzer"** workspace type
4. **Click INDEX** to scan the codebase
5. **View results** in the void's right panel
6. **Click Notes** to add intent annotations
7. **Click Copy** to copy file context for LLM conversations
8. **Open TUI** (click phreak>) for isolation and analysis
9. **Click GRAPH** to visualize connections
10. **Click SETTINGS** to configure the tool

---

## Dependencies

- **Node.js** >= 18.0.0
- **better-sqlite3** — SQLite database
- **chokidar** — File watching
- **@babel/parser** — AST parsing
- **fast-glob** — File discovery
- **D3.js** v7 — Graph visualization (loaded from CDN)

---

## Development

```bash
# Start in dev mode
node start.js "/home/bozertron/Software Projects/maestro-scaffolder-tool" --dev

# Run indexer directly
node backend/indexer.js "/home/bozertron/Software Projects/maestro-scaffolder-tool"

# Start server only
node backend/server.js "/home/bozertron/Software Projects/maestro-scaffolder-tool" --port 3847
```

---

## Roadmap

- [x] Phase 0: Workspace foundation
- [x] Phase 1: Void split
- [x] Phase 2: Indexer backend
- [x] Phase 3: File explorer Index button
- [x] Phase 4: Void right side file list
- [x] Phase 5: Notes popup
- [x] Phase 6: Phreak TUI buttons
- [x] Phase 7: Clipboard context
- [x] Phase 8: Runtime attendance call
- [x] Phase 9: Graph visualization
- [x] Phase 10: Full Settings UI
- [x] Phase 11: Multi-LLM coordination
- [ ] Debugging and testing
- [ ] Integration with maestro parsers
- [ ] Real-time collaboration features

---

## Related Projects

- **maestro-scaffolder-tool** — Source of analysis libraries
- **stereOS** — Consciousness persistence framework
- **actu8** — Action execution layer (next in series)
- **orchestr8** — Orchestration layer (future)

---

## License

Private — Benjamin Webster

---

*"You can't integrate what you can't see."*
