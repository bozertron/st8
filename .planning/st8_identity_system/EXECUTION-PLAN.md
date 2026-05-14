# ST8 Identity System — Execution Plan

**Date:** 2026-05-13
**Status:** READY FOR AGENT DEPLOYMENT
**Purpose:** Bootstrap st8's file identity system by applying it to the st8 codebase itself

---

## Architecture Summary

```
Fingerprint = {filepath}:{birthTimestamp}   ← stable identity, never changes
sha256Hash = content version                ← updated on every edit
file_mutation_log = audit trail             ← every mutation from concept → production
schema-card.json = deterministic snapshot   ← machine-readable, always in sync
.st8_identity_system/*.txt = fallback       ← human-readable, for when UI is offline
```

**Lifecycle Flow:**
```
CONCEPT → MVP LOCK → WIRING → DEVELOPMENT → PRODUCTION
  (no file)  (cards emit)  (deps checked)  (watcher logs)  (purge + lightweight)
```

---

## Dependency Graph

```
Phase 0: st8-types.js              ← NO DEPENDENCIES (create first)
    │
    ├─► Phase 1: Schema Changes     ← depends on Phase 0 types
    │       (persistence.js + indexer.js)
    │
    ├─► Phase 2: New Modules        ← depends on Phase 0 types
    │       (SchemaCardEmitter + Printer + NotificationBus)
    │
    ├─► Phase 3: Integration Wiring ← depends on Phase 1 + 2
    │       (fileWatcher + index.js + server.js)
    │
    ├─► Phase 4: Normalization      ← depends on Phase 1
    │       (snake_case → camelCase everywhere)
    │
    ├─► Phase 5: Bootstrap          ← depends on Phase 2 + 3 + 4
    │       (apply system to st8 itself)
    │
    └─► Phase 6: Advanced Features  ← depends on Phase 5
            (concept phase, PRD, purge, UI)
```

**Parallelizable groups:**
- Phase 1 and Phase 2 can run in parallel (both depend only on Phase 0)
- Phase 3 and Phase 4 can run in parallel (Phase 3 needs 1+2, Phase 4 needs only 1)
- Phase 5 and Phase 6 are strictly sequential

---

## Agent Assignment Strategy

| Agent | Tasks | Rationale |
|-------|-------|-----------|
| **Agent A** | Phase 0 + Phase 1 | Types + Schema are tightly coupled — same agent ensures consistency |
| **Agent B** | Phase 2 | New modules are independent — can build against Phase 0 types |
| **Agent C** | Phase 3 + Phase 4 | Wiring + normalization touch the same files — avoids merge conflicts |
| **Agent D** | Phase 5 + Phase 6 | Bootstrap + advanced features require all prior phases complete |

**Execution order:**
1. Agent A completes Phase 0 → signals Agent B and Agent C
2. Agent B starts Phase 2, Agent A continues with Phase 1
3. Agent C starts Phase 3 + 4 after Phase 1 + 2 are done
4. Agent D starts after all others finish

---

## File Inventory — What Exists Now

### Backend (backend/)
| File | Lines | Role | Current fingerprint |
|------|-------|------|---------------------|
| `server.js` | 599 | HTTP API server + handlers | sha256Hash (content) |
| `persistence.js` | 351 | SQLite persistence layer | sha256Hash (content) |
| `indexer.js` | 424 | File discovery, hashing, parsing, graph | sha256Hash (content) |
| `index.js` | 252 | Main orchestrator | sha256Hash (content) |
| `manifestGenerator.js` | 173 | JSON/TOML manifest generation | sha256Hash (content) |
| `fileWatcher.js` | 134 | Chokidar-based change detection | sha256Hash (content) |
| `package.json` | 23 | Dependencies | N/A |

### Frontend (root)
| File | Lines | Role | Current fingerprint |
|------|-------|------|---------------------|
| `st8.html` | ~400 | Main app shell | sha256Hash (content) |
| `file-explorer.js` | ~695 | File explorer UI | sha256Hash (content) |
| `phreak-terminal.js` | ~600 | Terminal UI | sha256Hash (content) |
| `void-engine.js` | ~500 | Render engine | sha256Hash (content) |
| `void-engine.html` | ~200 | Render engine host | sha256Hash (content) |
| `settings-ui.js` | ~300 | Settings panel | sha256Hash (content) |
| `settings-reader.js` | ~200 | Settings reader | sha256Hash (content) |
| `coordination.js` | ~200 | Coordination layer | sha256Hash (content) |
| `graph-visualizer.js` | ~300 | Graph visualization | sha256Hash (content) |
| `fake-stream.js` | ~100 | Fake stream utility | sha256Hash (content) |
| `start.js` | 149 | Startup script | sha256Hash (content) |

### New Files to Create
| File | Purpose |
|------|---------|
| `backend/st8-types.js` | Canonical type definitions |
| `backend/schemaCardEmitter.js` | Emits .st8/schema-card.json per file |
| `backend/schemaCardPrinter.js` | Emits .txt fallback to .planning/st8_identity_system/ |
| `backend/notificationBus.js` | Event bus + SSE endpoint for mutations |
| `.st8/schema-cards/` | Directory for JSON schema cards |
| `.planning/st8_identity_system/` | Directory for .txt fallback (already exists) |

---

## Detailed specifications: See PHASE-SPECS.md

All code, SQL, integration instructions, and verification steps are in the companion file `PHASE-SPECS.md` in this directory.

---

## Verification Checklist (Run After All Phases Complete)

1. `node backend/st8-types.js --validate` — confirms all types are well-formed
2. `node backend/index.js . --watch --serve` — starts st8 on itself
3. Check `.st8/schema-cards/` for JSON files — one per backend + frontend file
4. Check `.planning/st8_identity_system/` for .txt files — human-readable fallback
5. Edit any file, save → confirm mutation logged in `file_mutation_log` table
6. Confirm `.txt` file updated automatically after save
7. Confirm SSE endpoint at `http://localhost:3847/api/mutations` streams events
8. Run `node backend/schemaCardEmitter.js --diff` — confirms no drift between code and cards
