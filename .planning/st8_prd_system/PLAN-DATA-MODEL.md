# PRD System — Data Model Planning

**Based on:** RESEARCH-CURRENT-STATE.md
**Date:** 2026-05-13
**Status:** READY FOR IMPLEMENTATION

---

## Schema Changes Summary

### Table: `file_registry` (MODIFY)

Add the following columns to the existing `file_registry` table:

```sql
-- Bruno & Oscar fields
ALTER TABLE file_registry ADD COLUMN lastAccessed TEXT;
ALTER TABLE file_registry ADD COLUMN sessionsSinceAccess INTEGER DEFAULT 0;
ALTER TABLE file_registry ADD COLUMN expiryDate TEXT;
ALTER TABLE file_registry ADD COLUMN associatedWith TEXT;
ALTER TABLE file_registry ADD COLUMN eventTrigger TEXT;
ALTER TABLE file_registry ADD COLUMN brunoStatus TEXT DEFAULT 'active' CHECK(brunoStatus IN ('active', 'flagged', 'archived'));

-- @@@ Symbol fields
ALTER TABLE file_registry ADD COLUMN needsAIReview INTEGER DEFAULT 0;
ALTER TABLE file_registry ADD COLUMN tripleAtCount INTEGER DEFAULT 0;
ALTER TABLE file_registry ADD COLUMN aiContentInjected INTEGER DEFAULT 0;

-- Template fields
ALTER TABLE file_registry ADD COLUMN templateVariables TEXT; -- JSON array
ALTER TABLE file_registry ADD COLUMN hasUnfilledVariables INTEGER DEFAULT 0;
```

**Rationale:**
- All fields are nullable or have sensible defaults — backward compatible
- `brunoStatus` uses CHECK constraint for data integrity
- `templateVariables` stores JSON array as TEXT (SQLite doesn't have native array type)
- All boolean fields use INTEGER (0/1) for SQLite compatibility

### Table: `prd_projects` (CREATE)

```sql
CREATE TABLE IF NOT EXISTS prd_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  template TEXT NOT NULL,
  variables TEXT, -- JSON object
  created TEXT DEFAULT CURRENT_TIMESTAMP,
  updated TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prd_projects_name ON prd_projects(name);
```

**Rationale:**
- `name` is UNIQUE — project names are human-readable identifiers
- `path` is the filesystem path to the project directory
- `template` is the template name (e.g., 'press-release')
- `variables` is JSON object mapping variable names to values

### Table: `ai_content` (CREATE)

```sql
CREATE TABLE IF NOT EXISTS ai_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filepath TEXT NOT NULL,
  content TEXT NOT NULL,
  reviewed INTEGER DEFAULT 0,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_content_filepath ON ai_content(filepath);
CREATE INDEX IF NOT EXISTS idx_ai_content_reviewed ON ai_content(reviewed);
```

**Rationale:**
- Separate table keeps `file_registry` clean
- `filepath` references files (not fingerprint, since files may be deleted/recreated)
- `reviewed` flag for workflow tracking

---

## Persistence.js Methods to Add

### Bruno & Oscar Methods

```javascript
// Get files that haven't been accessed in N sessions
getStaleFiles(threshold) {
    const stmt = this.db.prepare(
        'SELECT * FROM file_registry WHERE sessionsSinceAccess >= ? AND brunoStatus = \'active\''
    );
    return stmt.all(threshold);
}

// Update file lifecycle fields
updateFileLifecycle(filepath, updates) {
    const allowedFields = ['lastAccessed', 'sessionsSinceAccess', 'expiryDate', 
                          'associatedWith', 'eventTrigger', 'brunoStatus'];
    const fields = Object.keys(updates).filter(f => allowedFields.includes(f));
    if (fields.length === 0) return { changes: 0 };
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`UPDATE file_registry SET ${setClause} WHERE filepath = ?`);
    return stmt.run(...fields.map(f => updates[f]), filepath);
}

// Increment session counter for all files
incrementSessionCounters() {
    const stmt = this.db.prepare(
        'UPDATE file_registry SET sessionsSinceAccess = sessionsSinceAccess + 1 WHERE brunoStatus = \'active\''
    );
    return stmt.run();
}

/**
 * SESSION TRACKING DEFINITION
 *
 * A "session" is defined as: one backend startup cycle.
 *
 * When: `node backend/index.js <workspace> --serve` runs
 * Action: Call `persistence.incrementSessionCounters()`
 *
 * This increments `sessionsSinceAccess` for ALL files with `brunoStatus = 'active'`.
 * When a file is accessed (opened, edited, viewed), call `persistence.markFileAccessed(filepath)`
 * to reset its counter to 0.
 *
 * Example lifecycle:
 * 1. Session 1: File created, sessionsSinceAccess = 0
 * 2. Session 2: File not opened, sessionsSinceAccess = 1
 * 3. Session 3: File opened, sessionsSinceAccess = 0 (reset)
 * 4. Session 4-8: File not opened, sessionsSinceAccess = 4
 * 5. Session 9: sessionsSinceAccess = 5, Bruno flags it
 */

// Reset session counter for accessed file
markFileAccessed(filepath) {
    const stmt = this.db.prepare(
        'UPDATE file_registry SET sessionsSinceAccess = 0, lastAccessed = CURRENT_TIMESTAMP WHERE filepath = ?'
    );
    return stmt.run(filepath);
}

// Archive file (move to Oscar's House)
archiveFile(filepath) {
    const stmt = this.db.prepare(
        "UPDATE file_registry SET brunoStatus = 'archived' WHERE filepath = ?"
    );
    return stmt.run(filepath);
}

// Set expiry date for archived file
setExpiryDate(filepath, daysFromNow) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysFromNow);
    const stmt = this.db.prepare(
        'UPDATE file_registry SET expiryDate = ? WHERE filepath = ?'
    );
    return stmt.run(expiryDate.toISOString(), filepath);
}
```

### @@@ Symbol Methods

```javascript
// Flag file as needing AI review
flagForAIReview(filepath, tripleAtCount) {
    const stmt = this.db.prepare(
        'UPDATE file_registry SET needsAIReview = 1, tripleAtCount = ? WHERE filepath = ?'
    );
    return stmt.run(tripleAtCount, filepath);
}

// Mark AI review as complete
markAIReviewed(filepath) {
    const stmt = this.db.prepare(
        'UPDATE file_registry SET needsAIReview = 0 WHERE filepath = ?'
    );
    return stmt.run(filepath);
}

// Get files needing AI review
getFilesNeedingAIReview() {
    const stmt = this.db.prepare(
        'SELECT * FROM file_registry WHERE needsAIReview = 1 ORDER BY filepath'
    );
    return stmt.all();
}

// Store AI-generated content
storeAIContent(filepath, content) {
    const stmt = this.db.prepare(
        'INSERT OR REPLACE INTO ai_content (filepath, content, reviewed, timestamp) VALUES (?, ?, 0, CURRENT_TIMESTAMP)'
    );
    return stmt.run(filepath, content);
}

// Get AI content for file
getAIContent(filepath) {
    const stmt = this.db.prepare(
        'SELECT * FROM ai_content WHERE filepath = ? ORDER BY timestamp DESC'
    );
    return stmt.all(filepath);
}
```

### Template Methods

```javascript
// Set template variables for a file
setTemplateVariables(filepath, variables) {
    const varsJson = JSON.stringify(variables);
    const hasUnfilled = Object.values(variables).some(v => v === null || v === undefined || v === '');
    const stmt = this.db.prepare(
        'UPDATE file_registry SET templateVariables = ?, hasUnfilledVariables = ? WHERE filepath = ?'
    );
    return stmt.run(varsJson, hasUnfilled ? 1 : 0, filepath);
}

// Get template variables for a file
getTemplateVariables(filepath) {
    const stmt = this.db.prepare(
        'SELECT templateVariables, hasUnfilledVariables FROM file_registry WHERE filepath = ?'
    );
    const row = stmt.get(filepath);
    if (!row || !row.templateVariables) return { variables: {}, hasUnfilled: false };
    try {
        return { variables: JSON.parse(row.templateVariables), hasUnfilled: Boolean(row.hasUnfilledVariables) };
    } catch {
        return { variables: {}, hasUnfilled: false };
    }
}
```

### PRD Project Methods

```javascript
// Create PRD project
createPRDProject(name, projectPath, template, variables) {
    const stmt = this.db.prepare(
        'INSERT INTO prd_projects (name, path, template, variables) VALUES (?, ?, ?, ?)'
    );
    return stmt.run(name, projectPath, template, JSON.stringify(variables));
}

// Get PRD project by name
getPRDProject(name) {
    const stmt = this.db.prepare('SELECT * FROM prd_projects WHERE name = ?');
    const row = stmt.get(name);
    if (row && row.variables) {
        try { row.variables = JSON.parse(row.variables); } catch { }
    }
    return row;
}

// Get all PRD projects
getAllPRDProjects() {
    const stmt = this.db.prepare('SELECT * FROM prd_projects ORDER BY created DESC');
    const rows = stmt.all();
    for (const row of rows) {
        if (row.variables) {
            try { row.variables = JSON.parse(row.variables); } catch { }
        }
    }
    return rows;
}

// Update PRD project
updatePRDProject(name, updates) {
    const allowedFields = ['path', 'template', 'variables'];
    const fields = Object.keys(updates).filter(f => allowedFields.includes(f));
    if (fields.length === 0) return { changes: 0 };
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const stmt = this.db.prepare(`UPDATE prd_projects SET ${setClause}, updated = CURRENT_TIMESTAMP WHERE name = ?`);
    const values = fields.map(f => f === 'variables' ? JSON.stringify(updates[f]) : updates[f]);
    return stmt.run(...values, name);
}

// Delete PRD project
deletePRDProject(name) {
    const stmt = this.db.prepare('DELETE FROM prd_projects WHERE name = ?');
    return stmt.run(name);
}
```

---

## Migration Strategy

### Phase 1: Schema Migration (Wave 1)

All schema changes are backward-compatible:
- New columns have DEFAULT values
- New tables don't affect existing queries
- No data migration needed

### Phase 2: Data Population (Wave 2-3)

- Existing files get `sessionsSinceAccess = 0` (default)
- Existing files get `brunoStatus = 'active'` (default)
- No retroactive AI review or template variable detection

### Phase 3: Index Considerations

New indexes to add:
```sql
CREATE INDEX IF NOT EXISTS idx_file_registry_bruno ON file_registry(brunoStatus);
CREATE INDEX IF NOT EXISTS idx_file_registry_ai_review ON file_registry(needsAIReview);
CREATE INDEX IF NOT EXISTS idx_file_registry_unfilled ON file_registry(hasUnfilledVariables);
```

---

## Integration with Existing Code

### Where to add methods in persistence.js

Add after line 483 (before `close()` method), grouped by feature:
1. Bruno & Oscar methods (after line 483)
2. @@@ Symbol methods (after Bruno & Oscar)
3. Template methods (after @@@ Symbol)
4. PRD Project methods (after Template)

### St8Types.js Updates

Add new fields to `St8FileEntry` shape (line 61):
```javascript
const St8FileEntry = Object.freeze({
    // ... existing fields ...
    lastAccessed: '',
    sessionsSinceAccess: 0,
    expiryDate: '',
    associatedWith: '',
    eventTrigger: '',
    brunoStatus: 'active',
    needsAIReview: 0,
    tripleAtCount: 0,
    aiContentInjected: 0,
    templateVariables: '',
    hasUnfilledVariables: 0
});
```

---

## END OF DATA MODEL PLAN
