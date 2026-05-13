# ST8 Connection Tracker: Bootstrap Proposal
**Target:** Standalone connection-tracking tool for maestro codebase visibility  
**Goal:** Get st8 functional fast (3-4 days)

---

## EXECUTIVE SUMMARY

st8 will be a **standalone peer tool** providing real-time visibility into file connection state. Unlike gap-analysis (slow feedback loop), st8 shows verified connection status: **GREEN** (reachable from entry point), **YELLOW** (partial), **RED** (orphaned).

**Key outcomes:**
- Index maestro's 87 files with SHA-256 hashing
- Build connection graph (who imports what)
- Classify every file by reachability
- Provide standalone HTML dashboard
- Enable clipboard copy for LLM conversations
- Watch for changes + auto re-index
- Export JSON/TOML manifests

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Data Flow

```
maestro src/commands/ (87 .ts files)
    ↓
ST8 INDEXER (Node.js)
├─ File Walker (fast-glob) → SHA-256 hash
├─ Parser (Babel + regex) → extract imports/exports
├─ Graph Builder → reachability, GREEN/YELLOW/RED
└─ Persistence (SQLite) → FileRegistry, FileConnections

    ↓
┌─────────┬──────────────┬──────────────┐
│ SQLite  │ connection-  │  ai-signal   │
│ DB      │ state.json   │  manifest    │
│         │ (for HTML)   │  (TOML)      │
└─────────┴──────────────┴──────────────┘
    ↓
HTML Dashboard (connection-tracker.html)
├─ 3-column layout (status | info | clipboard)
├─ Filters (ALL/GREEN/YELLOW/RED)
├─ Auto-refresh every 2s
└─ Copy context to clipboard for LLM
```

### 1.2 File Structure

```
st8/backend/                  # NEW
├─ indexer.ts               # Walk, hash, parse
├─ graphBuilder.ts          # Connection graph
├─ persistence.ts           # SQLite schema + ops
├─ fileWatcher.ts           # Chokidar integration
├─ manifestGenerator.ts     # JSON/TOML output
├─ server.ts                # HTTP for manifests
└─ types.ts                 # Shared types

st8/
├─ connection-tracker.html  # NEW: Dashboard
├─ package.json             # Update: deps
├─ tsconfig.json            # NEW
└─ README.md                # NEW
```

---

## 2. SQLITE SCHEMA

```sql
-- FileRegistry: One row per file
CREATE TABLE FileRegistry (
  file_id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  sha256_hash TEXT NOT NULL,
  status TEXT DEFAULT 'GREEN',        -- GREEN/YELLOW/RED
  reachability_score REAL,            -- 0.0 to 1.0
  impact_radius INTEGER,              -- # affected files
  is_entry_point INTEGER DEFAULT 0,
  indexed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- FileConnections: Who imports what
CREATE TABLE FileConnections (
  connection_id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL,
  target_file_id TEXT NOT NULL,
  connection_type TEXT,              -- 'import'
  is_resolved INTEGER DEFAULT 1,
  FOREIGN KEY (source_file_id) REFERENCES FileRegistry(file_id),
  FOREIGN KEY (target_file_id) REFERENCES FileRegistry(file_id)
);

-- ActivityLog: Audit trail
CREATE TABLE ActivityLog (
  log_id TEXT PRIMARY KEY,
  action_type TEXT,                 -- 'index_start', 'status_changed'
  file_id TEXT,
  old_status TEXT,
  new_status TEXT,
  message TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ConnectionSnapshots: Historical state
CREATE TABLE ConnectionSnapshots (
  snapshot_id TEXT PRIMARY KEY,
  snapshot_timestamp TEXT,
  green_count INTEGER,
  yellow_count INTEGER,
  red_count INTEGER,
  snapshot_data TEXT NOT NULL       -- JSON
);
```

---

## 3. INDEXER DESIGN

**Class:** `Indexer`

**Methods:**
- `reindexFull()` – Walk all files, hash, parse, classify
  - Phase 1: Discover files (fast-glob)
  - Phase 2: Hash (SHA-256)
  - Phase 3: Parse (Babel + regex fallback)
  - Phase 4: Build graph + classify
  - Phase 5: Persist to SQLite

- `reindexIncremental(changedFiles)` – Update only affected edges
  - Recompute hashes for changed files
  - Delete old connections, insert new
  - Recompute reachability from entry point

**Parsing Strategy:** Hybrid
1. Try Babel AST parse (accurate)
2. Fall back to regex (tolerant of syntax errors)
3. Extract imports from `import { x } from 'path'`
4. Extract exports from `export` statements

**Path Resolution:** Relative vs External
- Relative (`./utils`): Check file + index.ts + extensions (.ts, .js)
- Package (`lodash`): Return null (external)

**Key IP lifted from maestro:**
- graphBuilder.ts (lines 37-90, 189-205): Adjacency lists, BFS, impact radius
- parserPersistence.ts (1-100): Database setup, WAL mode
- opportunityClassifier.ts (130-135): SHA-256 fingerprinting
- importValidator.ts (100-150): Import path resolution

---

## 4. GRAPH BUILDER

**Algorithm:**
1. Build adjacency lists: outgoing (dependencies), incoming (consumers)
2. BFS from entry point (src/index.ts) to trace reachability
3. Mark files:
   - **GREEN:** Reachable from entry point
   - **YELLOW:** Imported but not reachable from entry point
   - **RED:** No incoming edges (orphaned)
4. Compute impact radius for each file (transitive dependents)

**Classification:**
```
if reachability_score >= 0.5:
  status = 'GREEN'
elif has any incoming edges:
  status = 'YELLOW'
else:
  status = 'RED'
```

---

## 5. FILE WATCHER (chokidar)

**Config:**
```javascript
{
  ignored: ['**/node_modules', '**/.dist', '**/.git'],
  awaitWriteFinish: { stabilityThreshold: 200 },
  depth: 10
}
```

**Debounce Strategy:** 500ms
- Multiple rapid changes → batched into single reindex
- Prevents thrashing on save-all operations

**Events:**
- add → new file discovered
- change → existing file modified
- unlink → file deleted

---

## 6. CONNECTION-STATE.JSON

```json
{
  "metadata": {
    "timestamp": "2026-05-11T14:30:45Z",
    "totalFiles": 87,
    "statusCounts": { "GREEN": 36, "YELLOW": 12, "RED": 39 }
  },
  "files": [
    {
      "fileId": "uuid-1",
      "relativePath": "src/commands/graphBuilder.ts",
      "status": "GREEN",
      "reachabilityScore": 0.95,
      "impactRadius": 8,
      "connections": {
        "importedBy": [...],
        "imports": [...]
      },
      "context": "// First 20 lines of file"
    }
  ]
}
```

---

## 7. AI-SIGNAL.TOML

```toml
[metadata]
version = "1.0"
total_files = 87
green_files = 36
yellow_files = 12
red_files = 39

[[files]]
path = "src/commands/graphBuilder.ts"
status = "GREEN"
reachability_score = 0.95
imported_by = ["selfAnalysis.ts", "dashboardApi.ts"]

[files.ai_signal]
core_responsibility = "Build semantic graphs; compute health metrics"
expected_consumers = ["selfAnalysis.ts", "dashboardApi.ts"]
can_be_archived = false
```

---

## 8. HTML DASHBOARD

**File:** `connection-tracker.html`

**Layout (3 columns):**
```
┌─────────────────────────────────────────┐
│ st8 Connection Tracker                  │
└─────────────────────────────────────────┘

┌─────┬──────────────────────┬────────────┐
│ Status │ File Info          │ Clipboard  │
│ Color  │ Connections        │ + Actions  │
│        │ Context            │            │
├─────┼──────────────────────┼────────────┤
│GREEN│ graphBuilder.ts      │[COPY]      │
│     │ Status: GREEN (95%)  │            │
│     │ Imported by: [2]     │            │
│     │ Imports: [2]         │            │
├─────┼──────────────────────┼────────────┤
│RED  │ harmonize/index.ts   │[COPY]      │
│     │ Status: RED (orphan) │            │
│     │ Imported by: [0]     │            │
│     │ Imports: [4]         │            │
└─────┴──────────────────────┴────────────┘

Filters: [ALL] [GREEN] [YELLOW] [RED]
Sort: [Status] [Name] [Path]
Auto-refresh: 2s
```

**Design:**
- Obsidian black (#0A0A0B)
- Gold (#D4AF37), Cyan (#1FBDEA)
- Poiret One typography
- NO emojis (text + CSS only)
- Vanilla JS (no framework)

**Features:**
- Filter by status
- Sort by status/name/path
- Search by filename
- Copy context to clipboard
- Auto-refresh every 2s
- Highlight changes (300ms flash)

---

## 9. BOOTSTRAP SEQUENCE

### Phase 0: Setup (2h)
- Create directory structure
- Update package.json (add deps: better-sqlite3, chokidar, @babel/parser, fast-glob)
- Create tsconfig.json
- Create shared types.ts

**Deliverables:** package.json, tsconfig.json, types.ts

### Phase 1: Indexer + SQLite (4h)
- Create persistence.ts (database setup)
- Create indexer.ts (walk, hash, parse)
- Test on maestro (87 files)

**Deliverables:** persistence.ts, indexer.ts, SQLite database

### Phase 2: Graph Builder (3h)
- Extend indexer with buildGraph()
- Classify files (GREEN/YELLOW/RED)
- Compute impact radius
- Validate against disconnection-sweep findings

**Deliverables:** Complete indexer with classification

### Phase 3: Manifest + Watcher (3h)
- Create manifestGenerator.ts
- Create fileWatcher.ts
- Create server.ts (HTTP endpoints)
- Test live updates

**Deliverables:** Working server with /api/connection-state.json

### Phase 4: Dashboard (3h)
- Create connection-tracker.html
- Implement dashboard.js (fetch, render, filter, sort)
- Add interactive features

**Deliverables:** connection-tracker.html, working UI

### Phase 5: AI Signal (2h)
- Extend manifestGenerator with TOML output
- Generate ai-signal.toml
- Serve via HTTP

**Deliverables:** ai-signal.toml, TOML endpoint

**TOTAL: 3-4 days, 17 hours**

---

## 10. MAESTRO IP EXTRACTION

**Lift (copy verbatim):**
- graphBuilder.ts (adjacency, BFS, impact radius)
- databasePersister.ts (database setup)
- opportunityClassifier.ts (SHA-256 fingerprinting)

**Adapt (refactor to remove maestro deps):**
- backgroundIndexer.ts → fileWatcher.ts
- parserPersistence.ts → persistence.ts (st8 schema only)
- internalFlowAnalyzer.ts → indexer.ts (simpler extraction)
- dataIngestion.ts → circuit breaker pattern only

---

## 11. FIRST TARGET: MAESTRO SELF-ANALYSIS

**Expected Results:**
- 87 total files indexed
- ~36 GREEN (reachable)
- ~12 YELLOW (partial)
- ~39 RED (orphaned)

**Validation:**
- Matches disconnection-sweep-phase-a.md findings
- 51 orphans detected ✓
- harmonize/* all RED ✓
- sonicClient.ts, sonicIndexer.ts RED ✓
- core files (graphBuilder, integr8/index) GREEN ✓

---

## 12. HOW THIS ENABLES RECONNECTION WORK

**Before (gap-analysis):**
```
Change file → Manual reindex (5 min wait) → Report says "unknown"
```

**After (st8):**
```
Change file → Auto reindex (2 sec) → Dashboard shows GREEN/YELLOW/RED
             → Copy context → Paste into LLM → AI sees manifest
             → AI proposes fix → Status updates in real-time
```

**Example Workflow:**

1. User opens connection-tracker.html
2. Sees sonicClient.ts is RED (orphaned)
3. Clicks [COPY] button → copies file context to clipboard
4. Opens LLM chat, pastes: "Here's sonicClient.ts, status: RED. How do I reconnect?"
5. LLM sees context + ai-signal.toml → understands dependencies
6. LLM suggests: "Import sonicClient in src/index.ts and register the command"
7. User makes change
8. st8 detects file change (watcher event)
9. Re-indexes in 2 seconds
10. Dashboard refreshes, shows sonicClient.ts now YELLOW or GREEN
11. User sees status change → confirms fix worked

**Key difference:** Verified state instead of assumed state.

---

## 13. SUCCESS CRITERIA

| Item | Success Criterion |
|------|-------------------|
| File count | 87 files indexed |
| Classification | 36±2 GREEN, 12±2 YELLOW, 39±2 RED |
| Gap analysis match | 51 RED matches orphan count |
| Dashboard | All files render, filters work |
| Manifest | Valid JSON, includes context |
| AI Signal | Valid TOML, includes reasoning |
| Watcher | Changes detected <2 sec |
| Copy | Context works with LLM |

---

## APPENDIX: DEPENDENCIES

```json
{
  "better-sqlite3": "^12.9.0",     // SQLite access
  "@babel/parser": "^7.29.3",      // AST parsing
  "chokidar": "^4.0.3",            // File watching
  "fast-glob": "^3.3.3",           // Fast file discovery
  "typescript": "^5.8.3",          // Compilation
  "@types/better-sqlite3": "^7.6.13"
}
```

**Same versions as maestro** for consistency.

---

END PROPOSAL
