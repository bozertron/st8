# PRD System — Frontend Impact Planning

**Based on:** RESEARCH-CURRENT-STATE.md, PLAN-API-DESIGN.md
**Date:** 2026-05-13
**Status:** READY FOR IMPLEMENTATION

---

## UI Components to Modify

### 1. File List (st8.html lines 1721-1756)

**Current:** Shows status dot + filename + action buttons

**New:** Add intent purpose subtitle and badges

```html
<!-- CURRENT -->
<div class="file-name">server.js</div>

<!-- NEW -->
<div class="file-name">server.js</div>
<div class="file-purpose">
  HTTP server and API routes ???
  <span class="badge-unknown">???</span>
  <span class="badge-ai-review">@@@</span>
</div>
```

**CSS to add (in <style> section):**
```css
.file-purpose {
  font-size: 11px;
  color: var(--cyan);
  opacity: 0.7;
  margin-top: 2px;
  font-style: italic;
}
.badge-unknown {
  background: var(--pink);
  color: var(--void);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: bold;
  margin-left: 4px;
}
.badge-ai-review {
  background: var(--gold);
  color: var(--void);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: bold;
  margin-left: 4px;
}
```

### 2. Mutation Toast System (st8.html lines 2010-2136)

**Current:** Handles CREATE, EDIT, DELETE, LOCK, PRODUCTION, PURGE

**New:** Add handlers for:
- `BRUNO_CALL` — Show "Stale file detected" toast with "Review" button
- `ARCHIVE` — Show "File archived" toast
- `AI_REVIEW_NEEDED` — Show "AI content needs review" toast with "Review" button

```javascript
// Add to getBadgeClass function (line 2017)
if (type === 'BRUNO_CALL') return 'badge-bruno';
if (type === 'ARCHIVE') return 'badge-archive';
if (type === 'AI_REVIEW_NEEDED') return 'badge-ai';

// Add CSS
.mutation-badge.badge-bruno { background: var(--pink); color: var(--void); }
.mutation-badge.badge-archive { background: var(--cyan); color: var(--void); }
.mutation-badge.badge-ai { background: var(--gold); color: var(--void); }
```

### 3. File Explorer (file-explorer.js)

**Current:** Shows file icon, name, size, modified date

**New:** Add intent purpose column and @@@ badge

```javascript
// In renderTable function, add column header
'<th>Purpose</th>'

// In row rendering, add cell
'<td class="explorer-col-purpose">' + 
  (file.intent?.purpose || '') + 
  (file.needsAIReview ? ' <span class="badge-ai-review">@@@</span>' : '') +
'</td>'
```

---

## UI Components to Add

### 4. PRD Project Wizard

**New component:** Modal dialog for creating PRD projects

```html
<div class="prd-wizard-overlay" id="prd-wizard" style="display:none;">
  <div class="prd-wizard">
    <div class="prd-wizard-header">
      <span class="prd-wizard-title">CREATE PRD PROJECT</span>
      <button class="prd-wizard-close" onclick="closePRDWizard()">◇</button>
    </div>
    <div class="prd-wizard-body">
      <div class="prd-field">
        <label>PROJECT NAME</label>
        <input type="text" id="prd-name" class="prd-input" placeholder="e.g., st8-launch">
      </div>
      <div class="prd-field">
        <label>TEMPLATE</label>
        <select id="prd-template" class="prd-select">
          <option value="press-release">Press Release</option>
          <option value="technical-spec">Technical Specification</option>
          <option value="gtm-plan">Go-To-Market Plan</option>
        </select>
      </div>
      <div id="prd-variables"></div>
    </div>
    <div class="prd-wizard-footer">
      <button class="prd-btn-cancel" onclick="closePRDWizard()">CANCEL</button>
      <button class="prd-btn-create" onclick="createPRDProject()">CREATE</button>
    </div>
  </div>
</div>
```

**JavaScript:**
```javascript
function openPRDWizard() {
  document.getElementById('prd-wizard').style.display = 'flex';
  loadTemplates();
}

function closePRDWizard() {
  document.getElementById('prd-wizard').style.display = 'none';
}

async function loadTemplates() {
  const response = await fetch('/api/templates');
  const data = await response.json();
  // Populate template select
}

async function createPRDProject() {
  const name = document.getElementById('prd-name').value;
  const template = document.getElementById('prd-template').value;
  const variables = {}; // Collect from dynamic inputs
  
  const response = await fetch('/api/prd-projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, template, variables })
  });
  
  if (response.ok) {
    closePRDWizard();
    // Refresh file list
  }
}
```

### 5. Template Variable Editor

**New component:** Inline editor for filling template variables

```javascript
function showVariableEditor(filepath, variables) {
  const html = variables.map(v => `
    <div class="var-field">
      <label>${v.name}</label>
      <input type="text" class="var-input" data-var="${v.name}" 
             value="${v.value || ''}" placeholder="Enter ${v.name}...">
    </div>
  `).join('');
  
  // Show in popup or inline
  showPopup('Fill Template Variables', html, () => saveVariables(filepath));
}
```

### 6. Bruno & Oscar Notifications

**New component:** Actionable notification toasts

```javascript
function showBrunoToast(filepath) {
  const toast = document.createElement('div');
  toast.className = 'mutation-toast';
  toast.innerHTML = `
    <span class="mutation-badge badge-bruno">BRUNO</span>
    <span class="mutation-filepath">${filepath}</span>
    <button onclick="reviewStaleFile('${filepath}')">Review</button>
    <button onclick="archiveFile('${filepath}')">Archive</button>
  `;
  document.getElementById('mutation-toasts').appendChild(toast);
}
```

---

## CSS Changes Needed

### New CSS Classes

```css
/* PRD Wizard */
.prd-wizard-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 10, 11, 0.92);
  backdrop-filter: blur(6px);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.prd-wizard {
  width: min(500px, 90vw);
  background: #0c0c0e;
  border: 1px solid var(--pink);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}
.prd-wizard-header {
  display: flex;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--pink);
}
.prd-wizard-title {
  color: var(--cyan);
  font-family: 'Poiret One', sans-serif;
  font-size: 13px;
  letter-spacing: 4px;
}
.prd-wizard-body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.prd-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.prd-field label {
  color: var(--cyan);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.prd-input, .prd-select {
  background: #0a0a0b;
  border: 1px solid rgba(201, 116, 143, 0.3);
  border-radius: 4px;
  color: var(--text);
  font-family: 'Poiret One', sans-serif;
  font-size: 14px;
  padding: var(--space-2);
}
.prd-wizard-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--pink);
}
.prd-btn-create {
  background: transparent;
  border: 1px solid var(--gold);
  color: var(--gold);
  padding: 6px 16px;
  font-family: 'Poiret One', sans-serif;
  font-size: 11px;
  letter-spacing: 3px;
  cursor: pointer;
}
.prd-btn-create:hover {
  background: var(--gold);
  color: var(--void);
}

/* Variable Editor */
.var-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.var-field label {
  color: var(--cyan);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.var-input {
  background: #0a0a0b;
  border: 1px solid rgba(201, 116, 143, 0.3);
  border-radius: 4px;
  color: var(--text);
  font-family: 'Poiret One', sans-serif;
  font-size: 14px;
  padding: 8px;
}
```

---

## JavaScript Changes Needed

### In st8.html

1. **Modify `renderFileList`** (line 1721):
   - Add `file-purpose` div after `file-name`
   - Add ??? badge if purpose contains '???'
   - Add @@@ badge if file.needsAIReview

2. **Modify `getBadgeClass`** (line 2017):
   - Add cases for BRUNO_CALL, ARCHIVE, AI_REVIEW_NEEDED

3. **Add `showMutationToast` handlers** (line 2041):
   - Add buttons for actionable toasts (Review, Archive)

### In file-explorer.js

1. **Modify table rendering**:
   - Add Purpose column
   - Add @@@ badge indicator

2. **Add PRD project actions**:
   - "Create PRD Project" button in toolbar
   - "Fill Variables" action for template files

### In phreak-terminal.js

1. **Add commands**:
   - `bruno-call` — trigger stale file scan
   - `oscar-house` — archive flagged files
   - `ai-review` — list files needing review
   - `prd-create <name> <template>` — create PRD project

---

## Event Handling Changes

### New SSE Event Handlers

```javascript
// In initMutationStream (st8.html line 2010)
mutationSource.onmessage = function(event) {
  var data = JSON.parse(event.data);
  
  if (data.mutationType === 'BRUNO_CALL') {
    showBrunoToast(data.filepath);
  } else if (data.mutationType === 'AI_REVIEW_NEEDED') {
    showAIReviewToast(data.filepath);
  } else if (data.mutationType === 'ARCHIVE') {
    showArchiveToast(data.filepath);
  }
  
  // ... existing handlers ...
};
```

### New Click Handlers

```javascript
// Review stale file
window.reviewStaleFile = function(filepath) {
  // Open file in editor or show details
  console.log('Reviewing:', filepath);
};

// Archive file
window.archiveFile = function(filepath) {
  fetch('/api/oscar-house', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [filepath] })
  });
};
```

---

## Component Specifications

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| Intent display | st8.html | 1721-1756 | MODIFY |
| ??? badge | st8.html | 1743-1755 | ADD |
| @@@ badge | st8.html | 1743-1755 | ADD |
| Mutation toasts | st8.html | 2010-2136 | MODIFY |
| PRD wizard | st8.html | NEW | ADD |
| Variable editor | st8.html | NEW | ADD |
| File explorer purpose | file-explorer.js | ~400-500 | MODIFY |
| Phreak commands | phreak-terminal.js | ~200-300 | ADD |

---

## END OF FRONTEND IMPACT PLAN
