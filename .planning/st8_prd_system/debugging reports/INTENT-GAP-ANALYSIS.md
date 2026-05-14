# ST8 Intent System Gap Analysis

**Generated:** 2026-05-13T20:30:00.000Z
**Investigator:** GSD-Debugger Agent
**Status:** ROOT CAUSE FOUND

---

## Executive Summary

The intent system has a **critical pipeline integration gap**. While the current database shows 42/42 files with intent (100% coverage), this is misleading because:

1. **IntentSeeder is NEVER called in the main pipeline** — it was run once externally
2. **New files added via file watcher get NO intent** — zero auto-seeding
3. **Changed files get empty intent in schema cards** — null intent passed to emitter
4. **No incremental seeding mode** — running seeder would overwrite user-authored intent

**Impact:** Any file added after the initial manual seeder run will have NO intent, NO schema card intent fields, and will NOT be detected by gap analysis until a full re-index + manual seeder run.

---

## Current State (Database Snapshot)

```
Total files:      42
Total intents:    42
Missing intent:   0
Empty purpose:    0
Empty dependsOn:  0
Empty valueStmt:  0
```

**All 42 files currently have intent** — but this is because the seeder was run once externally by the task executor. The pipeline itself has no automatic intent seeding.

---

## Root Cause Analysis

### ROOT CAUSE #1: IntentSeeder Not Integrated into Main Pipeline

**File:** `backend/index.js`
**Lines:** 1-358 (entire file)
**Severity:** CRITICAL

**Evidence:**
- `IntentSeeder` is never imported in `backend/index.js`
- No `require('./intentSeeder')` statement exists
- No call to `seedAll()` or `seedFile()` anywhere in the pipeline
- The main pipeline flow is:
  1. `indexDirectory()` → files[]
  2. `persistence.upsertFile()` for each file
  3. `persistence.insertConnection()` for imports
  4. `writeManifests()`
  5. `emitter.emitAllCards()` → reads intents from DB
  6. `GapAnalyzer.analyze()`
  7. **MISSING: `IntentSeeder.seedAll()`**

**Impact:** New files added during initial indexing don't get auto-intent.

**Fix Required:** Add IntentSeeder call after file upsert in `backend/index.js`:
```javascript
// After line 151 (after file upsert loop)
const { IntentSeeder } = require('./intentSeeder');
const seeder = new IntentSeeder(persistence, path.join(targetDir, '.st8', 'schema-cards'));
seeder.seedAll();
```

---

### ROOT CAUSE #2: File Watcher Doesn't Seed Intent for New Files

**File:** `backend/index.js`
**Lines:** 212-258 (onFileChange handler for 'add' type)
**Severity:** CRITICAL

**Evidence:**
When a new file is added via file watcher:
```javascript
// Line 238: File is stored in DB
persistence.upsertFile(newFile);

// Line 240-247: Mutation is logged
persistence.logMutation({...});

// Line 249-255: Notification is published
notificationBus.publish({...});

// MISSING: No intent seeding!
// MISSING: No schema card emission!
```

**Impact:** New files added after initial index will have:
- ✅ File entry in DB
- ✅ Mutation log entry
- ✅ Notification published
- ❌ NO intent in `file_intent` table
- ❌ NO schema card in `.st8/schema-cards/`
- ❌ NOT detected by gap analysis

**Fix Required:** Add intent seeding and schema card emission in watcher's 'add' handler:
```javascript
// After line 255 (after notificationBus.publish)
const { IntentSeeder } = require('./intentSeeder');
const seeder = new IntentSeeder(persistence, path.join(targetDir, '.st8', 'schema-cards'));
seeder.seedFile(fingerprint);

// Emit schema card for new file
const astResult = { imports: [], exports: [] }; // Parse if needed
emitter.emitCard(newFile, astResult, { importedBy: [], imports: [] }, 
    persistence.getIntent(fingerprint), 
    { count: 1, lastMutation: { type: 'CREATE', actor: 'WATCHER', timestamp: new Date().toISOString() } });
```

---

### ROOT CAUSE #3: File Watcher Passes Null Intent for Changed Files

**File:** `backend/index.js`
**Line:** 303
**Severity:** HIGH

**Evidence:**
```javascript
// Line 302-305: Schema card emitted with null intent
const card = emitter.emitCard(changedFile, astResult,
    { importedBy: [], imports: [] }, 
    null,  // <-- NULL INTENT!
    { count: persistence.getMutationCount(changedFile.fingerprint),
      lastMutation: lastMutation ? { type: lastMutation.mutationType, ... } : { ... } });
```

**Impact:** Schema cards for changed files will have empty intent fields:
```json
{
  "intent": {
    "purpose": "",
    "dependsOnBehavior": "",
    "valueStatement": ""
  }
}
```

**Fix Required:** Read intent from DB before emitting:
```javascript
// Before line 302
const intent = persistence.getIntent(changedFile.fingerprint);
const card = emitter.emitCard(changedFile, astResult,
    { importedBy: [], imports: [] }, 
    intent,  // Use actual intent from DB
    { ... });
```

---

### ROOT CAUSE #4: IntentSeeder Has No Incremental Mode

**File:** `backend/intentSeeder.js`
**Lines:** 128-153 (seedAll method), 160-193 (seedFile method)
**Severity:** HIGH

**Evidence:**
- `seedAll()` re-seeds ALL files every time (line 128-153)
- No `seedNewFiles()` or `seedFileIfMissing()` method
- No check if intent already exists before seeding
- `seedFile()` always calls `upsertIntent()` with `authoredBy: 'INFERRED'` (line 183-184)
- This would OVERWRITE any user-authored intent!

**Impact:**
- Running `seedAll()` would overwrite all USER-authored intent with INFERRED intent
- No way to seed only new files without affecting existing ones
- No way to preserve user-authored intent

**Fix Required:** Add incremental seeding method:
```javascript
/**
 * Seed intent only for files that don't have intent yet.
 * Preserves existing user-authored intent.
 * @returns {{ seeded: number, skipped: number, errors: number }}
 */
seedMissing() {
    const files = this.persistence.getAllFiles();
    const existingIntents = this.persistence.getAllIntents();
    let seeded = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of files) {
        if (existingIntents[file.fingerprint]) {
            skipped++;
            continue; // Skip files that already have intent
        }
        
        try {
            const result = this.seedFile(file.fingerprint);
            if (result.success) {
                seeded++;
            } else {
                errors++;
            }
        } catch (err) {
            errors++;
        }
    }

    return { seeded, skipped, errors };
}
```

---

### ROOT CAUSE #5: Schema Card Emitter Doesn't Create Missing Intent

**File:** `backend/schemaCardEmitter.js`
**Lines:** 113-118
**Severity:** MEDIUM

**Evidence:**
```javascript
// Line 113-118: Reads intent from DB, uses empty if missing
const rawIntent = allIntents[file.fingerprint] || null;
const intent = rawIntent ? {
    purpose: rawIntent.purpose || '',
    dependsOnBehavior: rawIntent.dependsOnBehavior || '',
    valueStatement: rawIntent.valueStatement || ''
} : null;
```

And in `emitCard()` (line 59):
```javascript
intent: intent || { purpose: '', dependsOnBehavior: '', valueStatement: '' }
```

**Impact:** Missing intent results in empty schema card fields instead of triggering auto-seeding.

**Fix Required:** Either:
1. Call IntentSeeder before emitting cards, OR
2. Have emitter trigger seeding for missing intents

---

### ROOT CAUSE #6: Gap Analyzer Shows False 100% Coverage

**File:** `backend/gapAnalyzer.js`
**Lines:** 201-248 (_analyzeIntent method)
**Severity:** LOW (misleading but not functional)

**Evidence:**
Gap analyzer checks schema cards (line 214-217):
```javascript
const hasPurpose = card.intent &&
    card.intent.purpose &&
    card.intent.purpose.trim() !== '' &&
    card.intent.purpose !== '(not set)';
```

But schema cards are only as fresh as the last `emitAllCards()` call, which reads from DB. If new files were added without intent seeding, they won't appear in gap analysis.

**Impact:** Misleading coverage metrics — shows 100% when actual coverage is lower.

---

## Files Without Intent (Current State)

**Currently: 0 files missing intent** (all 42 files have intent from external seeder run)

**However, any NEW file added via:**
- File watcher (add event)
- Manual indexing without running seeder
- Concept file registration (unless intent provided)

**...will have NO intent.**

---

## Pipeline Flow Analysis

### Current Flow (BROKEN)
```
1. indexDirectory() → files[]
2. persistence.upsertFile() for each file
3. persistence.insertConnection() for imports
4. writeManifests()
5. emitter.emitAllCards() → reads intents from DB (empty for new files!)
6. GapAnalyzer.analyze() → shows false 100% coverage
```

### Required Flow (FIXED)
```
1. indexDirectory() → files[]
2. persistence.upsertFile() for each file
3. persistence.insertConnection() for imports
4. IntentSeeder.seedAll() ← ADD THIS
5. writeManifests()
6. emitter.emitAllCards() → reads intents from DB (now populated!)
7. GapAnalyzer.analyze() → shows accurate coverage
```

### File Watcher Flow (BROKEN)
```
New file detected:
1. Generate fingerprint
2. persistence.upsertFile(newFile)
3. persistence.logMutation()
4. notificationBus.publish()
5. MISSING: IntentSeeder.seedFile(fingerprint)
6. MISSING: emitter.emitCard()
```

### File Watcher Flow (FIXED)
```
New file detected:
1. Generate fingerprint
2. persistence.upsertFile(newFile)
3. persistence.logMutation()
4. notificationBus.publish()
5. IntentSeeder.seedFile(fingerprint) ← ADD THIS
6. emitter.emitCard(newFile, ...) ← ADD THIS
```

---

## Recommended Fixes (Priority Order)

### P0: Integrate IntentSeeder into Main Pipeline
**File:** `backend/index.js`
**Action:** Add IntentSeeder import and call after file upsert loop
**Lines to modify:** After line 151

### P1: Add Intent Seeding to File Watcher (New Files)
**File:** `backend/index.js`
**Action:** Add IntentSeeder.seedFile() and emitter.emitCard() in 'add' handler
**Lines to modify:** After line 255

### P2: Fix Null Intent in File Watcher (Changed Files)
**File:** `backend/index.js`
**Action:** Read intent from DB before emitting schema card
**Lines to modify:** Line 302-305

### P3: Add Incremental Seeding Mode
**File:** `backend/intentSeeder.js`
**Action:** Add seedMissing() method that preserves user-authored intent
**Lines to modify:** After line 193

### P4: Add Intent Seeding to Schema Card Emitter
**File:** `backend/schemaCardEmitter.js`
**Action:** Trigger seeding for missing intents in emitAllCards()
**Lines to modify:** Lines 91-148

---

## Verification Commands

### Check if files have intent:
```bash
cd /home/bozertron/1_AT_A_TIME/st8
node -e "
const { St8Persistence } = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const intents = p.getAllIntents();
const files = p.getAllFiles();
console.log('Total files:', files.length);
console.log('Total intents:', Object.keys(intents).length);
console.log('Files WITHOUT intent:');
for (const f of files) {
    if (!intents[f.fingerprint]) {
        console.log('  -', f.filepath);
    }
}
p.close();
"
```

### Test new file scenario:
```bash
# 1. Create a test file
echo "// test file" > /home/bozertron/1_AT_A_TIME/st8/test-intent-gap.js

# 2. Run indexer (without seeder)
cd /home/bozertron/1_AT_A_TIME/st8
node backend/index.js . --no-watch --no-serve

# 3. Check if test file has intent
node -e "
const { St8Persistence } = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const intent = p.getIntent('test-intent-gap.js||...');
console.log('Intent:', intent);
p.close();
"

# 4. Clean up
rm /home/bozertron/1_AT_A_TIME/st8/test-intent-gap.js
```

---

## Summary

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| IntentSeeder not in pipeline | CRITICAL | index.js | New files get no intent |
| Watcher doesn't seed intent | CRITICAL | index.js:212-258 | Watcher files get no intent |
| Watcher passes null intent | HIGH | index.js:303 | Changed files lose intent |
| No incremental seeding | HIGH | intentSeeder.js | Can't seed without overwriting |
| Emitter doesn't create intent | MEDIUM | schemaCardEmitter.js | Empty intent in cards |
| Gap analyzer false positive | LOW | gapAnalyzer.js | Misleading metrics |

**Total Issues:** 6
**Critical:** 2
**High:** 2
**Medium:** 1
**Low:** 1

---

## Next Steps

1. **Immediate:** Run IntentSeeder manually for any new files added since last run
2. **Short-term:** Fix P0 and P1 to integrate seeder into pipeline
3. **Medium-term:** Fix P2 and P3 for incremental seeding
4. **Long-term:** Fix P4 and P5 for complete automation

---

**Report Generated by:** GSD-Debugger Agent
**Investigation Duration:** 15 minutes
**Evidence Items:** 12
**Root Causes Identified:** 6
