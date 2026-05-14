# PRD System — Corrected Integration Plan

**Date:** 2026-05-13
**Status:** REVISED — Leverage Existing Architecture
**Philosophy:** PRD files are files. The identity system already handles them. The workspace system already displays them.

---

## What I Found: How st8 Already Works

### 1. The Workspace System
```javascript
// st8.html:1666-1717
window.st8WorkspaceChanged = function(wsType) {
  if (wsType === 'logic-analyzer') {
    // Enables split-mode with:
    // - Left: #stage (main void)
    // - Right: #void-file-list (file list panel)
    // - Starts coordination polling
  }
};
```

**The "Full Stack Logic Analyzer" IS the PRD workspace.** Split mode. Left side for chat/void. Right side for files. Already exists.

### 2. The Identity System (How Files Become "First Class Citizens")

```javascript
// indexer.js — already exists
// 1. Scans directory
// 2. Emits schema cards (.st8/schema-cards/*.json)
// 3. Writes connection-state.json (manifest)

// schemaCardEmitter.js — already exists
// Emits: {filepath, fingerprint, status, intent, imports, exports, lifecyclePhase}

// coordination.js — already exists
// Polls connection-state.json every 2 seconds
// compareManifests() detects: added, removed, statusChanged, intentChanged
// generateAiContext() builds LLM-ready text from all files
```

**Files are ALREADY first-class citizens.** They have identity (fingerprint), purpose (intent), relationships (imports), lifecycle, and mutation history.

### 3. The File List Panel

```javascript
// st8.html:1721 — renderFileList()
window.renderFileList = function(files) {
  // Renders in #void-file-list
  // Shows: status dot, filename, [Notes] [Copy]
};

// handleFileClipboard() — copies full context to clipboard:
// FILE: path, STATUS: GREEN, HASH: ..., IMPORTS: ..., 
// PURPOSE: ..., DEPENDS ON: ..., VALUE: ...
```

**Already renders intent.purpose.** Already copies full context. Already has notes editing.

### 4. The "Add to Chat" Button

```javascript
// file-explorer.js:211
function _emitSelect() {
  const paths = Array.from(explorerState.selectedPaths);
  if (explorerState.onSelect) {
    explorerState.onSelect(paths);  // callback if set
  } else {
    // Default: inject into actu8 chat input
    const input = document.getElementById('input');
    if (input) input.value = paths.join(', ');
  }
}
```

**Currently broken** — no `#input` element exists. Falls through silently.

### 5. The Coordination Context Builder

```javascript
// coordination.js:166
function generateAiContext(manifest) {
  // Builds text:
  // ST8 CODEBASE CONTEXT
  // Target: /path/to/project
  // Total Files: 42
  // Status: 35 GREEN, 4 YELLOW, 3 RED
  //
  // FILES:
  // backend/server.js
  //   Status: GREEN
  //   Hash: a3f7c2...
  //   Imports: http, fs, path
  //   Purpose: HTTP API server for st8
}
```

**Already generates LLM context from ALL indexed files.** PRD files would be included automatically.

---

## The Correct Architecture

PRD does NOT need:
- ❌ Custom commands in phreak terminal
- ❌ New UI panels or views
- ❌ Special handling for PRD files
- ❌ Custom file types or extensions

PRD DOES need:
1. A **project folder** with PRD template files
2. **Standard indexing** (already works for .md files)
3. **Intent seeding** so PRD files have `purpose: "Press Release"`
4. The **workspace set** to that project folder
5. **Logic Analyzer workspace** (split view) to see files + chat

The files themselves ARE the PRD system.

---

## The User Flow

### 1. Open PRD (Sidebar Button)

```
[Click PRD button in explorer sidebar]
  └─→ Shows menu:
      ◈ Create New    │ Wizard: name, type, market
      ◇ Open Existing │ List: ~/prd-projects/*/
      ◇ Import        │ Local folder / Remote request
```

### 2. Create New Project

```
Project Name: flagship-headphones
Product Type: Consumer Hardware
Target Market: Premium Audio

[Create]
  └─→ Creates ~/prd-projects/flagship-headphones/
      ├─ press-release.md      (template with {{variables}})
      ├─ gtm-plan.md           (template)
      ├─ stakeholder-list.md   (template table)
      ├─ technical-spec.md     (template)
      └─ .st8/
          └─ project.json      {name, type, market, created}
  
  └─→ Sets workspace to this folder
  └─→ Triggers indexing (connection-state.json generated)
  └─→ Switches to logic-analyzer view (split mode)
```

### 3. See Files in Right Panel

```
┌────────────────────┬─────────────────────┐
│                    │ [Files]              │
│   VOID / CHAT      │                      │
│                    │ ● press-release.md   │
│                    │ ○ gtm-plan.md        │
│                    │ ○ stakeholder-list   │
│                    │ ○ technical-spec     │
│                    │                      │
│                    │ [Notes] [Copy]       │
└────────────────────┴─────────────────────┘
```

**The right panel is standard `renderFileList()`.** PRD files have status dots (all GREEN when created). Intent shows their purpose.

### 4. Work With Files

**Option A: Edit via Notes**
- Click `Notes` on press-release.md
- Edits `intent.purpose`, `intent.valueStatement` in popup
- Saves → mutation log → re-indexed → coordination detects change

**Option B: Copy Context**
- Click `Copy` on press-release.md
- Full context copied to clipboard
- Paste into phreak terminal, external chat, document editor

**Option C: Add to Chat** (needs fix)
- Select multiple files
- Click `ADD TO CHAT`
- Loads selected files' context into coordination/chat system
- Chat interface shows them as loaded context

### 5. Indexing Updates Everything

When any PRD file changes:
1. File watcher detects change
2. Schema card re-emitted
3. connection-state.json updated
4. coordination.js picks up change (2s poll)
5. `renderFileList()` re-renders
6. `generateAiContext()` includes updated content

**All automatic. No PRD-specific code needed.**

---

## What's Actually Needed (Minimal)

### 1. PRD Sidebar Button (file-explorer.js)

Add to `_buildLocations()`:
```javascript
{ name: 'PRD', icon: '◈', path: null, isPRDMenu: true }
```

Handle click:
```javascript
function _showPRDMenu() {
  // Shows 3 options: Create New, Open, Import
  // Each is a simple action
}
```

### 2. Create New Flow

```javascript
function _createPRDProject() {
  // 1. Prompt for name, type, market
  // 2. Create folder: ~/prd-projects/<name>/
  // 3. Write template .md files
  // 4. Write .st8/project.json
  // 5. Set as workspace path
  // 6. Switch workspace to 'logic-analyzer'
  // 7. Trigger indexing (/api/index)
  // 8. Done — files appear in right panel
}
```

### 3. Template Files

Simple markdown files with `{{variable}}` placeholders:

**press-release.md:**
```markdown
# Press Release: {{product_name}}

**FOR IMMEDIATE RELEASE**

{{company_name}} announces {{product_name}}, a {{product_type}}
designed for {{target_market}}.

## Key Features

- ( populated from stakeholder interviews )

## Availability

Price: {{target_price}}
Launch Date: {{launch_date}}
```

When these are indexed, `intentSeeder.js` would detect patterns like "Press Release" in the filename and auto-set `purpose: "Press Release"`.

### 4. Open Existing Flow

```javascript
function _openPRDProject() {
  // 1. Scan ~/prd-projects/ for folders with .st8/project.json
  // 2. Show list with name, type, last modified
  // 3. Select one
  // 4. Set as workspace
  // 5. Index
  // 6. Switch to logic-analyzer
}
```

### 5. "Add to Chat" Fix

Currently injects into non-existent `#input`. Should instead:

```javascript
function _emitSelect() {
  const paths = Array.from(explorerState.selectedPaths);
  if (paths.length === 0) return;
  
  // Generate focused context for selected files only
  const focusedContext = generateContextForFiles(paths);
  
  // Load into coordination/chat system
  if (window.St8Coordination && window.St8Coordination.loadFocusedContext) {
    window.St8Coordination.loadFocusedContext(focusedContext);
  }
  
  explorerState.selectedPaths.clear();
  _updateSelectionUI();
}
```

Or if phreak terminal is the chat interface:
```javascript
// Inject into phreak as a system line
PhreakTerminal.receiveSignal({
  type: 'system',
  data: { title: 'Files Loaded', body: focusedContext },
  provisioned: true
});
```

---

## What Leverages Existing Patterns

| Feature | Existing Pattern | File |
|---------|-----------------|------|
| File display | `renderFileList()` | st8.html:1721 |
| File indexing | `/api/index` POST | file-explorer.js:568 |
| File intent | `intentSeeder.js` pattern matching | backend/intentSeeder.js |
| Schema cards | `schemaCardEmitter.js` | backend/schemaCardEmitter.js |
| Coordination | `coordination.js` polling | coordination.js:58 |
| Context building | `generateAiContext()` | coordination.js:166 |
| Notes editing | `showNotesPopup()` → `/api/file-intent` | st8.html:1861 |
| Context copy | `copyFileContext()` → clipboard | st8.html:1769 |
| Workspace switch | `st8WorkspaceChanged('logic-analyzer')` | st8.html:1666 |
| Split view | `.split-mode` CSS + `#void-file-list` | st8.html styles |
| Status tracking | GREEN/YELLOW/RED dots | renderFileList() |
| Mutation stream | SSE `/api/mutations` | st8.html:2007 |

---

## The "Elegant Mechanism That Protects the Work"

**What the user means:** The coordination system's polling + manifest comparison.

```javascript
// coordination.js:94
function compareManifests(oldManifest, newManifest) {
  // Detects: added, removed, statusChanged, intentChanged
  // Files are NEVER silently lost
  // Changes are ALWAYS tracked
  // Intent changes are captured
  // This "protects the work"
}
```

When you edit a PRD file's notes/intent:
1. File intent updated in SQLite
2. File watcher detects change
3. New schema card emitted
4. New connection-state.json written
5. Coordination detects `intentChanged`
6. File list re-renders with updated info
7. AI context regenerated

**No data loss. Full audit trail. Automatic sync.**

---

## Phreak Terminal Integration (Passive)

**No new commands needed.** The TUI already suggests:
```
Actions:
  make-topic    Load files into chat context
  export-report Generate JSON/TOML report
  create-sprint Create sprint document
```

These work for PRD files too because:
- `make-topic` = `generateAiContext()` + selected files
- `export-report` = generate report from current manifest
- `create-sprint` = derive tasks from intent + status

If we need PRD-specific actions later, they'd be:
- Natural language in phreak: "generate me a press release for the flagship headphones"
- The system looks at the PRD files in the manifest, finds press-release.md, works with it

**No command structure needed. Just natural language + context.**

---

## Settings Integration (settings-ui.js Pattern)

Add PRD defaults:

```javascript
// DEFAULT_SETTINGS addition:
prd: {
  projects_dir: '~/prd-projects',
  default_template: 'default',
  auto_index_on_open: true,
  interview_timeout_minutes: 30
}
```

**Auto-renders in settings panel. Auto-persists via `/api/settings`.**

---

## Implementation Order

### Phase 1: Sidebar + Menu (2 days)
- Add PRD button to sidebar
- Create `_showPRDMenu()` function
- Implement Create New wizard (simple prompts)
- Implement Open flow (scan projects dir)

### Phase 2: Templates (2 days)
- Create template markdown files (press-release, gtm-plan, etc.)
- Add template variables ({{product_name}}, etc.)
- Create `intentSeeder` patterns for PRD files
- Ensure templates index correctly

### Phase 3: Integration Polish (2 days)
- Fix `ADD TO CHAT` to load context properly
- Add PRD settings category
- Test workspace switching
- Verify coordination picks up PRD files

**Total: 6 days**

---

## Success Criteria

- [ ] PRD button visible in sidebar under Workspace
- [ ] Click shows Create New / Open / Import menu
- [ ] Create New generates project folder with templates
- [ ] Project files indexed automatically
- [ ] Files appear in right panel with status dots
- [ ] Notes button edits intent
- [ ] Copy button copies context
- [ ] Coordination polls and detects changes
- [ ] No new phreak commands needed
- [ ] No custom UI components needed
- [ ] All existing patterns reused

---

**Research Sources**
- file-explorer.js — sidebar locations, emitSelect, indexCodebase
- st8.html — workspace switcher, renderFileList, file actions, coordination integration
- coordination.js — polling, manifest comparison, ai context generation
- phreak-terminal.js — TUI actions (make-topic suggestion, not yet implemented)
- intentSeeder.js — pattern-based intent assignment
- schemaCardEmitter.js — file → schema card pipeline

---

**End of Corrected Plan**
