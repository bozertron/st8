# Task 12: Bootstrap Verification — Delete DB + Fresh Index

**Phase:** 5A
**Single Concern:** Delete old database and run fresh index
**Files to Delete:** `st8.sqlite`

---

## Specification Reference

**PHASE-SPECS.md:** Lines 1542-1558 (Phase 5A: Delete old DB and run fresh index)

---

## Exact Implementation

### Step 1: Delete old database

```bash
rm -f st8.sqlite
```

### Step 2: Run fresh index

```bash
node backend/index.js . --watch --serve --port 3847
```

This will:
1. Discover all .js files in the project
2. Hash each file with SHA-256
3. Generate stable fingerprints (filepath:birthTimestamp)
4. Store in SQLite with camelCase columns
5. Emit `.st8/schema-cards/*.json` for each file
6. Print `.txt` fallbacks to `.planning/st8_identity_system/`
7. Start watching for changes
8. Start HTTP server

---

## PARALLELIZATION

```
- Can start after: [08, 09, 10, 11, 23]
- Can run parallel with: [none — must complete first]
- Must complete before: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
- Conflict risk: [st8.sqlite, .st8/schema-cards/, .planning/st8_identity_system/]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Old DB deleted
ls -la st8.sqlite
# Expected: File not found

# 2. Fresh DB created
node -e "
const Database = require('better-sqlite3');
const db = new Database('st8.sqlite');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
console.log('Tables:', tables.map(t => t.name));
db.close();
"
# Expected: Tables includes file_registry, connections, file_intent, file_mutation_log, activity_log

# 3. Files indexed
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
console.log('Total files:', files.length);
console.log('First 5 files:', files.slice(0, 5).map(f => f.filepath));
p.close();
"
# Expected: Total files > 0

# 4. Fingerprints generated
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const hasFingerprints = files.every(f => f.fingerprint && f.fingerprint.includes(':'));
console.log('All files have fingerprints:', hasFingerprints);
p.close();
"
# Expected: All files have fingerprints: true

# 5. LifecyclePhase set
node -e "
const {St8Persistence} = require('./backend/persistence');
const p = new St8Persistence();
p.initialize();
const files = p.getAllFiles();
const hasLifecycle = files.every(f => f.lifecyclePhase === 'DEVELOPMENT');
console.log('All files have lifecyclePhase:', hasLifecycle);
p.close();
"
# Expected: All files have lifecyclePhase: true
```

---

## Success Criteria

- [ ] Old `st8.sqlite` deleted
- [ ] Fresh database created with all tables
- [ ] All .js files discovered and indexed
- [ ] Stable fingerprints generated for all files
- [ ] `lifecyclePhase` set to 'DEVELOPMENT' for all files
- [ ] `isEntryPoint` set to false for all files
- [ ] HTTP server started on port 3847

---

## Report Format

When complete, report:

```
TASK 12 COMPLETE
- Database: st8.sqlite created fresh
- Tables: file_registry, connections, file_intent, file_mutation_log, activity_log
- Files indexed: [count]
- Fingerprints: PASS
- LifecyclePhase: PASS
- Server: running on port 3847
```
