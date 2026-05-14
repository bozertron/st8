# PRD System — API Design Planning

**Based on:** RESEARCH-CURRENT-STATE.md, PLAN-DATA-MODEL.md
**Date:** 2026-05-13
**Status:** READY FOR IMPLEMENTATION

---

## New Endpoints

### PRD Projects API

#### `GET /api/prd-projects`
Returns all PRD projects.

**Response:**
```json
{
  "status": "ok",
  "projects": [
    {
      "id": 1,
      "name": "st8-launch",
      "path": "/home/bozertron/prd-projects/st8-launch",
      "template": "press-release",
      "variables": { "product_name": "ST8", "launch_date": "2026-06-01" },
      "created": "2026-05-13T10:00:00Z",
      "updated": "2026-05-13T10:00:00Z"
    }
  ]
}
```

#### `POST /api/prd-projects`
Create a new PRD project.

**Request:**
```json
{
  "name": "st8-launch",
  "template": "press-release",
  "variables": {
    "product_name": "ST8",
    "launch_date": "2026-06-01"
  }
}
```

**Response:**
```json
{
  "status": "ok",
  "project": {
    "name": "st8-launch",
    "path": "/home/bozertron/prd-projects/st8-launch",
    "template": "press-release",
    "variables": { "product_name": "ST8", "launch_date": "2026-06-01" }
  }
}
```

**Errors:**
- `400` — Missing required field (name or template)
- `409` — Project name already exists

#### `GET /api/prd-projects/:name`
Get a specific PRD project.

**Response:**
```json
{
  "status": "ok",
  "project": { ... }
}
```

**Errors:**
- `404` — Project not found

---

### Bruno & Oscar API

#### `POST /api/bruno-call`
Trigger Bruno's call — scans for stale files and flags them.

**Request:** (optional)
```json
{
  "threshold": 5  // override default threshold
}
```

**Response:**
```json
{
  "status": "ok",
  "flaggedFiles": 3,
  "files": [
    {
      "filepath": "old-feature.md",
      "sessionsSinceAccess": 7,
      "action": "flagged_for_review"
    }
  ]
}
```

**Behavior:**
1. Queries files with `sessionsSinceAccess >= threshold`
2. Sets `brunoStatus = 'flagged'`
3. Publishes `BRUNO_CALL` notification for each

#### `POST /api/oscar-house`
Trigger Oscar's House — archives flagged files.

**Request:** (optional)
```json
{
  "gracePeriod": 7  // days before deletion
}
```

**Response:**
```json
{
  "status": "ok",
  "archivedFiles": 2,
  "files": [
    {
      "filepath": "old-feature.md",
      "expiryDate": "2026-05-20T00:00:00Z"
    }
  ]
}
```

**Behavior:**
1. Finds files with `brunoStatus = 'flagged'`
2. Sets `brunoStatus = 'archived'`
3. Sets `expiryDate = now + gracePeriod`
4. Publishes `ARCHIVE` notification

---

### @@@ Symbol API

#### `GET /api/needs-ai-review`
Returns files with @@@ symbols needing human review.

**Response:**
```json
{
  "status": "ok",
  "files": [
    {
      "filepath": "design-doc.md",
      "tripleAtCount": 3,
      "purpose": "Technical specification ???"
    }
  ]
}
```

#### `POST /api/mark-reviewed`
Mark a file's AI content as reviewed.

**Request:**
```json
{
  "filepath": "design-doc.md",
  "approved": true,
  "notes": "Looks good, minor edits needed"
}
```

**Response:**
```json
{
  "status": "ok",
  "filepath": "design-doc.md",
  "reviewed": true
}
```

**Behavior:**
1. Sets `needsAIReview = 0`
2. Updates `ai_content.reviewed = 1`
3. Publishes `AI_REVIEWED` notification

---

### Templates API

#### `GET /api/templates`
Returns available PRD templates.

**Response:**
```json
{
  "status": "ok",
  "templates": [
    {
      "name": "press-release",
      "description": "Product launch press release",
      "variables": ["product_name", "launch_date", "tagline"]
    },
    {
      "name": "technical-spec",
      "description": "Technical specification document",
      "variables": ["feature_name", "author", "date"]
    }
  ]
}
```

#### `POST /api/templates`
Create or update a custom template.

**Request:**
```json
{
  "name": "custom-roadmap",
  "content": "# Roadmap: {{project_name}}\n\n## Q3 2026\n- {{milestone_1}}\n",
  "description": "Custom roadmap template"
}
```

**Response:**
```json
{
  "status": "ok",
  "template": {
    "name": "custom-roadmap",
    "variables": ["project_name", "milestone_1"]
  }
}
```

---

## Modified Endpoints

### `POST /api/mvp-lock` (Enhanced)

**Current behavior:** Locks ALL files in CONCEPT or DEVELOPMENT phase.

**New behavior:** 
- Still locks all eligible files
- Now triggers schema card emission for .md/.txt/.json files too
- Sets `eventTrigger = 'mvp-lock'` on locked files

### `POST /api/production-promote` (Enhanced)

**Current behavior:** Purges development mutations for a single file.

**New behavior:**
- Still purges mutations
- Now clears `templateVariables` and `hasUnfilledVariables`
- Sets `brunoStatus = 'active'` (reset cleanup state)

### `GET /api/prd` (Enhanced)

**Current behavior:** Returns generated PRD markdown.

**New behavior:**
- Still returns PRD markdown
- Now includes PRD project files if they exist
- Includes template variable status

---

## Endpoint Summary Table

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | /api/prd-projects | NEW | List all PRD projects |
| POST | /api/prd-projects | NEW | Create PRD project |
| GET | /api/prd-projects/:name | NEW | Get specific project |
| POST | /api/bruno-call | NEW | Trigger stale file scan |
| POST | /api/oscar-house | NEW | Archive flagged files |
| GET | /api/needs-ai-review | NEW | List files needing AI review |
| POST | /api/mark-reviewed | NEW | Mark AI content reviewed |
| GET | /api/templates | NEW | List templates |
| POST | /api/templates | NEW | Create/update template |
| POST | /api/mvp-lock | MODIFIED | Now includes document files |
| POST | /api/production-promote | MODIFIED | Resets template state |
| GET | /api/prd | MODIFIED | Includes project data |

---

## Implementation Order

1. **Wave 1:** Add new endpoints to server.js (structure only)
2. **Wave 2:** Implement Bruno & Oscar logic
3. **Wave 3:** Implement @@@ symbol logic
4. **Wave 4:** Implement template engine
5. **Wave 5:** Wire everything together

---

## END OF API DESIGN PLAN
