# Task W2-03 Report: Fix upsertIntent Default + Use Enum Constants + Rename updated_at

**Status:** COMPLETE
**Date:** 2026-05-13
**Files Modified:** 3 (`persistence.js`, `index.js`, `indexer.js`)

---

## Part 1: Fix upsertIntent Default (WR-04)

**File:** `backend/persistence.js`
**Line:** 275
**Change:** `'USER'` → `'INFERRED'`

The `upsertIntent()` method defaulted `authoredBy` to `'USER'`, which contradicted:
- The schema definition (line 83): `authoredBy TEXT DEFAULT 'INFERRED'`
- The `getAllIntents()` method (line 293): which already used `'INFERRED'` as fallback

**Before:** `intent.authoredBy || 'USER'`
**After:** `intent.authoredBy || 'INFERRED'`

**Verification:** In-memory DB test confirmed `upsertIntent({ fingerprint: 'fp1', purpose: 'test' })` produces `authoredBy === 'INFERRED'`.

---

## Part 2: Use Enum Constants (WR-03)

**File:** `backend/index.js`
**Import (line 19):** Already imports `MutationType` and `ActorType` from `./st8-types` — no import change needed.

### Changes Applied

| Line | Before | After |
|------|--------|-------|
| 114 | `mutationType: 'CREATE'` | `mutationType: MutationType.CREATE` |
| 116 | `actor: 'INDEXER'` | `actor: ActorType.INDEXER` |
| 144 | `source: 'INDEXER'` | `source: ActorType.INDEXER` |
| 231 | `mutationType: 'CREATE'` | `mutationType: MutationType.CREATE` |
| 233 | `actor: 'WATCHER'` | `actor: ActorType.WATCHER` |
| 240 | `mutationType: 'CREATE'` | `mutationType: MutationType.CREATE` |
| 241 | `actor: 'WATCHER'` | `actor: ActorType.WATCHER` |
| 266 | `mutationType: 'EDIT'` | `mutationType: MutationType.EDIT` |
| 268 | `actor: 'WATCHER'` | `actor: ActorType.WATCHER` |
| 275 | `mutationType: 'EDIT'` | `mutationType: MutationType.EDIT` |
| 276 | `actor: 'WATCHER'` | `actor: ActorType.WATCHER` |

**Total:** 11 string literals → enum constants across 6 call sites (4 `logMutation`, 2 `notificationBus.publish`, 1 `logActivity`)

**Verification:** Grep confirmed zero remaining raw `'CREATE'`/`'EDIT'`/`'INDEXER'`/`'WATCHER'` string literals in mutation/actor contexts in index.js.

### Out-of-Scope Note

`persistence.js` still uses raw strings in `registerConceptFile()` (line 367: `'CONCEPT'`, line 369: `'DEVELOPER'`) and `purgeDevelopmentData()` (line 400: `'PURGE'`, line 402: `'INDEXER'`). These are outside the spec scope (Part 2 targets index.js only) and the module doesn't currently import `MutationType`/`ActorType`. Future cleanup opportunity.

---

## Part 3: Rename updated_at → updatedAt (M1)

### persistence.js — Schema Definition
**Line 122:** `updated_at TEXT DEFAULT CURRENT_TIMESTAMP` → `updatedAt TEXT DEFAULT CURRENT_TIMESTAMP`

### persistence.js — upsertSetting() Method
**Line 440:** `INSERT OR REPLACE INTO st8_settings (category, key, value, updated_at)` → `INSERT OR REPLACE INTO st8_settings (category, key, value, updatedAt)`

### indexer.js — Schema Definition
**Line 154:** Already uses `updatedAt` — fixed in prior commit `e75d5c2` (W2-01). No change needed.

**Verification:** In-memory DB test confirmed `upsertSetting('test', 'key1', 'val1')` + `getSetting('test', 'key1')` returns `'val1'` — column rename is wired correctly.

---

## Wiring Confirmation

| Check | Result |
|-------|--------|
| `node -c backend/persistence.js` | ✓ Syntax OK |
| `node -c backend/indexer.js` | ✓ Syntax OK |
| `node -c backend/index.js` | ✓ Syntax OK |
| Existing verify-persistence-fixes.js (CR-01/02/03) | ✓ 10/10 passed |
| Custom W2-03 verification (6 checks) | ✓ 6/6 passed |
| Grep: no raw string literals in index.js mutation/actor contexts | ✓ Clean |
| Grep: no `updated_at` in source code | ✓ Only in docs/planning |

---

## Integration Points Summary

| Pattern | File | Lines | Integration |
|---------|------|-------|-------------|
| Default fix | `persistence.js` | 275 | `upsertIntent()` fallback → `'INFERRED'` matches schema default |
| Enum constant | `index.js` | 114, 116 | Pass 1 batch indexing: `MutationType.CREATE`, `ActorType.INDEXER` |
| Enum constant | `index.js` | 144 | Activity logging: `ActorType.INDEXER` |
| Enum constant | `index.js` | 231, 233 | Watcher add: `MutationType.CREATE`, `ActorType.WATCHER` |
| Enum constant | `index.js` | 240, 241 | Watcher add notification: `MutationType.CREATE`, `ActorType.WATCHER` |
| Enum constant | `index.js` | 266, 268 | Watcher edit: `MutationType.EDIT`, `ActorType.WATCHER` |
| Enum constant | `index.js` | 275, 276 | Watcher edit notification: `MutationType.EDIT`, `ActorType.WATCHER` |
| Column rename | `persistence.js` | 122 | Schema: `updatedAt TEXT DEFAULT CURRENT_TIMESTAMP` |
| Column rename | `persistence.js` | 440 | `upsertSetting()` SQL uses `updatedAt` |
| Column rename | `indexer.js` | 154 | Schema: `updatedAt TEXT DEFAULT CURRENT_TIMESTAMP` (already done in W2-01) |
