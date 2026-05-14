# RT-3 Cluster Agent 1: Intent Persistence — Backend Manifest Flow

## Executive Summary

**Issues Investigated:**
- RT-3-1: `_handleFileIntent()` never regenerates manifest
- RT-3-2: `generateManifest()` never queries `file_intent` table

**Root Cause:** The intent persistence pipeline has two disconnected paths:
1. User intent is saved to SQLite (`file_intent` table) but manifests are never regenerated
2. Manifest generation reads from file objects but never queries the `file_intent` table

**Impact:** User-authored intent is lost — saved to DB but never appears in manifests served to UI.

**Fix Complexity:** Low — 3 code changes in 2 files

---

## 1. Issue Analysis

### 1.1 RT-3-1: `_handleFileIntent()` Never Regenerates Manifest

**Location:** `backend/server.js:239-274`

**Current Flow:**
```
POST /api/file-intent
  → upsertIntent(fingerprint, purpose, dependsOnBehavior, valueStatement)
  → logActivity({ source: 'USER_UI', action: 'NOTE_ADDED', ... })
  → close()
  → respond { status: 'ok', fingerprint }
```

**Problem:** After saving intent to database, the handler NEVER:
- Calls `getAllFiles()` to retrieve file registry
- Calls `getIntent()` to enrich files with intent data
- Calls `writeManifests()` to regenerate manifests on disk

**Result:** Manifests on disk retain stale empty intent `{ purpose: '', dependsOnBehavior: '', valueStatement: '' }`.

---

### 1.2 RT-3-2: `generateManifest()` Never Queries `file_intent` Table

**Location:** `backend/indexer.js:261-286` and `backend/manifestGenerator.js:44-75`

**Current `generateManifest()` in indexer.js:**
```javascript
function generateManifest(files, targetDir) {
    const manifest = {
        metadata: { ... },
        files: files.map(f => ({
            filepath: f.filepath,
            filename: f.filename,
            status: f.status,
            reachabilityScore: f.reachabilityScore,
            impactRadius: f.impactRadius,
            sha256Hash: f.sha256Hash,
            imports: f.imports || [],
            importedBy: f.importedBy || []
            // NOTE: NO intent field!
        }))
    };
    return manifest;
}
```

**Current `generateConnectionState()` in manifestGenerator.js:**
```javascript
function generateConnectionState(files, targetDir) {
    const manifest = {
        metadata: { ... },
        files: files.map(f => ({
            ...
            intent: f.intent || {
                purpose: '',
                dependsOnBehavior: '',
                valueStatement: ''
            }
        }))
    };
    return manifest;
}
```

**Problem:**
1. `generateManifest()` in indexer.js doesn't include an `intent` field at all
2. `generateConnectionState()` in manifestGenerator.js includes `intent` but defaults to empty strings
3. Neither function queries the `file_intent` table to get actual user-authored intent
4. `getIntent(fingerprint)` exists in persistence.js (line 217) but is NEVER called

**Root Cause:** Manifest generation pipeline has no access to persistence layer.

---

## 2. Existing API Surface

### 2.1 persistence.js Methods

| Method | Line | Purpose | Called By |
|--------|------|---------|-----------|
| `upsertIntent(intent)` | 202 | Save intent to `file_intent` table | `_handleFileIntent()` in server.js |
| `getIntent(fingerprint)` | 217 | Get intent for single file | **NEVER CALLED** |
| `getAllFiles()` | 167 | Get all files from `file_registry` | **NEVER CALLED** |
| `logActivity(activity)` | 224 | Log to `activity_log` table | `_handleFileIntent()` in server.js |

### 2.2 Missing Method

`getAllIntents()` does not exist. Needed to bulk-load all intents for manifest enrichment.

---

## 3. Fix Design

### 3.1 Fix RT-3-1: Regenerate Manifest After Intent Save

**Location:** `backend/server.js:239-274`

**Fixed Flow:**
```
POST /api/file-intent
  → upsertIntent(fingerprint, purpose, dependsOnBehavior, valueStatement)
  → logActivity(...)
  → getAllFiles()                         ← NEW
  → getAllIntents()                       ← NEW
  → enrich files with intent map         ← NEW
  → writeManifests(enriched, targetDir)  ← NEW
  → close()
  → respond { status: 'ok', fingerprint }
```

**Why this approach:**
- Single DB round-trip for all intents (bulk load)
- In-memory Map for O(1) intent lookup per file
- Manifests regenerated atomically after intent save
- No changes to `writeManifests()` signature

---

### 3.2 Fix RT-3-2: Query `file_intent` During Manifest Generation

**Recommended Approach: Enrichment Layer**

Instead of modifying `generateManifest()` or `generateConnectionState()`, add an enrichment step BEFORE calling them.

**Why enrichment layer:**
- Keeps manifest generation functions pure (no DB dependency)
- Enrichment can be applied at any call site (server handlers, indexer CLI)
- Single responsibility: manifest functions generate, enrichment functions attach data

**Flow:**
```
indexDirectory(targetDir)
  → discoverFiles()
  → hashFiles()
  → parseImports()
  → buildGraph()
  → generateManifest(files, targetDir)  ← Stays simple, no DB access
  → [ENRICHMENT STEP] getAllIntents() + attach to files
  → writeManifests(enrichedFiles, targetDir)
```

---

## 4. Complete Fixed Signal Paths

### Signal Path 1: User Saves Intent via UI

```
[User clicks "Add Intent" in file explorer]
  ↓
POST /api/file-intent
  Body: { fingerprint, purpose, dependsOnBehavior, valueStatement }
  ↓
server.js: _handleFileIntent()
  ↓
persistence.upsertIntent({
  fingerprint,
  purpose,
  dependsOnBehavior,
  valueStatement,
  authoredBy: 'USER'
})
  ↓ INSERT OR REPLACE INTO file_intent
  ↓
persistence.logActivity({
  source: 'USER_UI',
  action: 'NOTE_ADDED',
  targetFingerprint: fingerprint,
  details: { purpose, dependsOnBehavior, valueStatement }
})
  ↓ INSERT INTO activity_log
  ↓
persistence.getAllFiles()
  ↓ SELECT * FROM file_registry
  ↓
persistence.getAllIntents()
  ↓ SELECT * FROM file_intent
  ↓
Map<int fingerprint, intent> intentMap
  ↓
files.map(f => ({
  ...f,
  sha256Hash: f.sha256_hash,
  intent: intentMap.get(f.fingerprint) || { empty defaults }
}))
  ↓
writeManifests(enrichedFiles, targetDir)
  ↓
generateConnectionState(enrichedFiles, targetDir)
  ↓ writes connection-state.json with intent data
  ↓
generateAiSignalToml(enrichedFiles, targetDir)
  ↓ writes ai-signal.toml with intent data
  ↓
persistence.close()
  ↓
respond { status: 'ok', fingerprint }
  ↓
[Manifests on disk now include user's intent]
[UI fetches updated manifests on next refresh]
```

---

### Signal Path 2: User Clicks INDEX Button

```
[User clicks INDEX in file explorer]
  ↓
POST /api/index
  ↓
server.js: _handleIndex()
  ↓
indexDirectory(targetDir, { write: false })
  ↓ Returns { files: [...], manifest: {...} }
  ↓
persistence.initialize()
  ↓
persistence.getAllIntents()
  ↓ SELECT * FROM file_intent
  ↓
Map<int fingerprint, intent> intentMap
  ↓
result.files.map(f => ({
  ...f,
  intent: intentMap.get(f.sha256Hash || f.fingerprint) || { empty defaults }
}))
  ↓
writeManifests(enrichedFiles, targetDir)
  ↓
persistence.close()
  ↓
respond { status: 'ok', files: count }
  ↓
[Manifests now include all user-authored intents]
```

---

### Signal Path 3: Manifest Generation During Indexer CLI Run

```
[node indexer.js /path/to/project]
  ↓
indexDirectory(targetDir)
  ↓
discoverFiles()
  ↓
hashFiles()
  ↓
parseImports()
  ↓
buildGraph()
  ↓
generateManifest(files, targetDir)
  ↓ Returns manifest without intent (indexer has no DB access)
  ↓
writeManifest(manifest, targetDir)
  ↓
[Manifest generated without intent — this is expected for CLI runs]
[Intent is only available when server is running with DB]
```

---

## 5. Implementation Steps

### Step 1: Add `getAllIntents()` to persistence.js

**File:** `backend/persistence.js`
**Location:** After `getIntent()` method (line 220)

```javascript
getAllIntents() {
    const stmt = this.db.prepare('SELECT * FROM file_intent');
    return stmt.all();
}
```

**Purpose:** Bulk-load all intents for manifest enrichment.

---

### Step 2: Modify `_handleFileIntent()` in server.js

**File:** `backend/server.js`
**Location:** Lines 239-274

**Changes:**
1. Import `writeManifests` from manifestGenerator
2. After `upsertIntent()` and `logActivity()`, add enrichment step
3. Call `writeManifests()` with enriched files

```javascript
_handleFileIntent(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { fingerprint, purpose, dependsOnBehavior, valueStatement } = JSON.parse(body);
            const { St8Persistence } = require('./persistence');
            const { writeManifests } = require('./manifestGenerator');
            const persistence = new St8Persistence();

            persistence.initialize().then(() => {
                // Save intent
                persistence.upsertIntent({
                    fingerprint,
                    purpose,
                    dependsOnBehavior,
                    valueStatement,
                    authoredBy: 'USER'
                });

                // Log activity
                persistence.logActivity({
                    source: 'USER_UI',
                    action: 'NOTE_ADDED',
                    targetFingerprint: fingerprint,
                    details: { purpose, dependsOnBehavior, valueStatement }
                });

                // Regenerate manifests with intent data
                const files = persistence.getAllFiles();
                const intents = persistence.getAllIntents();
                const intentMap = new Map(intents.map(i => [i.fingerprint, i]));
                
                const enrichedFiles = files.map(f => ({
                    ...f,
                    sha256Hash: f.sha256_hash,
                    intent: intentMap.get(f.fingerprint) || {
                        purpose: '',
                        dependsOnBehavior: '',
                        valueStatement: ''
                    }
                }));
                
                writeManifests(enrichedFiles, this.targetDir);
                persistence.close();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', fingerprint }));
            });
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    });
}
```

---

### Step 3: Modify `_handleIndex()` in server.js

**File:** `backend/server.js`
**Location:** Lines 223-237

**Changes:**
1. Import `St8Persistence`
2. After `indexDirectory()`, enrich files with intents
3. Call `writeManifests()` with enriched files

```javascript
_handleIndex(req, res) {
    const { indexDirectory } = require('./indexer');
    const { writeManifests } = require('./manifestGenerator');
    const { St8Persistence } = require('./persistence');
    
    const persistence = new St8Persistence();
    
    indexDirectory(this.targetDir, { write: false })
        .then(result => {
            return persistence.initialize().then(() => {
                // Get intents from database
                const intents = persistence.getAllIntents();
                const intentMap = new Map(intents.map(i => [i.fingerprint, i]));
                
                // Enrich files with intent data
                const enrichedFiles = result.files.map(f => ({
                    ...f,
                    intent: intentMap.get(f.sha256Hash || f.fingerprint) || {
                        purpose: '',
                        dependsOnBehavior: '',
                        valueStatement: ''
                    }
                }));
                
                writeManifests(enrichedFiles, this.targetDir);
                persistence.close();
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', files: result.files.length }));
            });
        })
        .catch(err => {
            persistence.close();
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });
}
```

---

## 6. Key Insights

### 6.1 Manifest Generation Functions Stay Pure

The `generateManifest()` and `generateConnectionState()` functions do NOT need to be modified. They already handle the `intent` field correctly — the problem is that the `intent` property is never populated on the file objects passed to them.

### 6.2 Enrichment Layer Pattern

The fix uses an **enrichment layer** pattern:
1. Fetch files from registry
2. Fetch intents from database
3. Create in-memory Map for O(1) lookup
4. Attach intents to file objects
5. Pass enriched files to manifest generation

This keeps manifest generation pure and testable.

### 6.3 Fingerprint Consistency

The `file_intent` table uses `fingerprint` as the primary key, which is the SHA256 hash. The `file_registry` table also uses `fingerprint` as the primary key. The enrichment step uses `f.fingerprint` from `getAllFiles()` to look up intents.

---

## 7. Verification Checklist

- [ ] `getAllIntents()` method added to `St8Persistence` class
- [ ] `_handleFileIntent()` calls `writeManifests()` after `upsertIntent()`
- [ ] `_handleIndex()` enriches files with intents before `writeManifests()`
- [ ] `connection-state.json` includes `intent` field for each file
- [ ] `ai-signal.toml` includes `core_responsibility` from intent
- [ ] User-authored intent appears in UI after saving
- [ ] Intent persists across INDEX operations
- [ ] Empty intent defaults handled correctly

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DB not initialized when `writeManifests()` called | Low | High | Initialize persistence before enrichment |
| Large number of intents causes slow manifest generation | Low | Medium | SQLite is fast for simple SELECT * |
| Fingerprint mismatch between file_registry and file_intent | Low | High | Both use SHA256 hash as primary key |
| Manifest write fails after intent save | Low | Medium | Intent is already saved; manifest can be regenerated |

---

## 9. Dependencies

- `backend/persistence.js` — needs `getAllIntents()` method
- `backend/server.js` — needs to import `writeManifests` and `St8Persistence`
- `backend/manifestGenerator.js` — no changes needed (already handles intent field)

---

## 10. Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| RT-3-1 | `_handleFileIntent()` never regenerates manifest after saving intent | Add `getAllFiles()` + `getAllIntents()` + `writeManifests()` after `upsertIntent()` |
| RT-3-2 | `generateManifest()` never queries `file_intent` table | Create enrichment step that queries intents and attaches to file objects before manifest generation |

**Key insight:** The manifest generation pipeline needs to be enriched with intent data from the database. The fix is to add an enrichment step between file retrieval and manifest generation, not to modify the manifest generation functions themselves.
