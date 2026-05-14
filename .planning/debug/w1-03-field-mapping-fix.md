---
status: resolved
trigger: "Fix field name mapping bug in file watcher callback — persistence.getLastMutation() returns {mutationType, actor, timestamp} but emitCard() expects {type, actor, timestamp}"
created: 2026-05-13T00:00:00Z
updated: 2026-05-13T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — File watcher passes raw persistence object to emitCard without field mapping
test: Code review comparison of emitAllCards() (correct) vs file watcher callback (incorrect)
expecting: Schema cards should have `type` field populated with mutation type
next_action: Fix applied, verification complete

## Symptoms

expected: Schema cards generated during --watch mode should have `lastMutation.type` set to mutation type (e.g., 'EDIT')
actual: Schema cards have `lastMutation.type` as undefined because `mutationType` field name doesn't match expected `type`
errors: No runtime error — silent data corruption in schema card output
reproduction: Run `node index.js <dir> --watch`, edit a file, check generated schema card JSON
started: Introduced when file watcher schema card emission was added

## Eliminated

- hypothesis: persistence.getLastMutation() returns wrong data
  evidence: Returns correct SQLite row — field name mismatch is the issue, not data content
  timestamp: 2026-05-13

## Evidence

- timestamp: 2026-05-13
  checked: schemaCardEmitter.js lines 118-119
  found: emitAllCards() correctly maps {mutationType → type, actor, timestamp}
  implication: The bulk path handles mapping, but incremental path in index.js does not

- timestamp: 2026-05-13
  checked: persistence.js getLastMutation() method
  found: Returns raw SQLite row with column names {mutationType, actor, timestamp, ...}
  implication: Confirms source data uses `mutationType` not `type`

- timestamp: 2026-05-13
  checked: index.js file watcher callback lines 289-292
  found: Passes persistence.getLastMutation() result directly to emitCard() without mapping
  implication: Root cause confirmed — missing field name transformation

## Resolution

root_cause: File watcher callback in index.js passed raw persistence object ({mutationType, actor, timestamp}) to emitCard() which expects ({type, actor, timestamp}). The bulk emitAllCards() method had correct mapping, but the incremental watcher path did not.

fix: Added field mapping: lastMutation ? { type: lastMutation.mutationType, actor: lastMutation.actor, timestamp: lastMutation.timestamp } : { type: '', actor: '', timestamp: '' }

verification: Fix matches the pattern in schemaCardEmitter.js emitAllCards(), handles null case, and applies correct field transformation

files_changed: [backend/index.js]
