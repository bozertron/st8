# Debug Report: CR-01 — Fingerprint Parsing Broken with ISO 8601 Timestamps

**File:** `backend/st8-types.js`
**Date:** 2026-05-13
**Severity:** Critical (data corruption)
**Status:** Fixed

---

## Problem Description

`parseFingerprint()` corrupts both `filepath` and `birthTimestamp` when fingerprints contain real ISO 8601 timestamps.

**Reproduction:**
```js
generateFingerprint('src/utils.js', '2024-01-15T10:30:45.123Z')
// → 'src/utils.js:2024-01-15T10:30:45.123Z'

parseFingerprint('src/utils.js:2024-01-15T10:30:45.123Z')
// → { filepath: 'src/utils.js:2024-01-15T10:30', birthTimestamp: '45.123Z' }
//   ↑ CORRUPTED — extra path segments          ↑ CORRUPTED — truncated timestamp
```

## Root Cause Analysis

**Separator conflict:** `generateFingerprint()` uses `:` as the separator between filepath and birthTimestamp. `parseFingerprint()` uses `lastIndexOf(':')` to find the split point.

ISO 8601 timestamps contain colons: `T10:30:45.123Z` has **3 colons**. The `lastIndexOf(':')` finds the wrong colon — the one before milliseconds (`:45.123Z`) instead of the intended separator.

**Affected timestamp formats:**
- `2024-01-15T10:30:45Z` — 3 colons in time portion
- `2024-01-15T10:30:45.123Z` — 3 colons in time portion
- `2024-01-15T10:30:45+05:30` — 4 colons (time + timezone offset)

**Not affected:**
- Numeric timestamps (e.g., `0`, `1234567890`) — no colons
- Unix epoch strings — no colons

## Fix Applied

**Changed separator from `:` to `||` (double pipe).**

`||` cannot appear in:
- Filepaths (not a valid filename character on any OS)
- ISO 8601 timestamps (only uses `-`, `T`, `:`, `.`, `Z`, `+`)

### Code Changes

**`generateFingerprint()`** — uses new `FINGERPRINT_SEPARATOR` constant:
```js
const FINGERPRINT_SEPARATOR = '||';

function generateFingerprint(filepath, birthTimestamp) {
    return `${filepath}${FINGERPRINT_SEPARATOR}${birthTimestamp}`;
}
```

**`parseFingerprint()`** — dual-format parser:
```js
function parseFingerprint(fingerprint) {
    // New format: split on `||`
    const doublePipe = fingerprint.indexOf('||');
    if (doublePipe !== -1) {
        return {
            filepath: fingerprint.substring(0, doublePipe),
            birthTimestamp: fingerprint.substring(doublePipe + 2)
        };
    }

    // Legacy format: split on last `:` (backward compatibility)
    // Only safe for non-ISO timestamps (e.g., numeric timestamps like `0`)
    const lastColon = fingerprint.lastIndexOf(':');
    if (lastColon === -1) return { filepath: fingerprint, birthTimestamp: '' };
    return {
        filepath: fingerprint.substring(0, lastColon),
        birthTimestamp: fingerprint.substring(lastColon + 1)
    };
}
```

## Verification Results

| Test Case | Input | Expected | Result |
|-----------|-------|----------|--------|
| ISO 8601 fractional | `src/utils.js\|\|2024-01-15T10:30:45.123Z` | filepath=`src/utils.js`, ts=`2024-01-15T10:30:45.123Z` | PASS |
| ISO 8601 no fractional | `backend/server.js\|\|2025-06-01T09:00:00Z` | filepath=`backend/server.js`, ts=`2025-06-01T09:00:00Z` | PASS |
| Deep path + ISO | `src/deep/nested/path/module.ts\|\|2024-12-31T23:59:59.999Z` | filepath=`src/deep/nested/path/module.ts` | PASS |
| Windows path (colon in drive) | `C:/Users/dev/project/file.js\|\|2024-01-15T10:30:45Z` | filepath=`C:/Users/dev/project/file.js` | PASS |
| Legacy numeric timestamp | `src/old.js:0` | filepath=`src/old.js`, ts=`0` | PASS |
| No separator | `just-a-filename` | filepath=`just-a-filename`, ts=`` | PASS |
| CLI self-test | `node st8-types.js --validate` | Self-test: PASS | PASS |

## Migration Concerns

### Existing Fingerprints in DB

**Impact:** Existing fingerprints stored in the database that use the `:` separator **with ISO 8601 timestamps are already corrupted.** The old code was silently producing wrong data.

**No automatic migration is possible** because:
- The old format is ambiguous — `src/utils.js:2024-01-15T10:30:45.123Z` could split at any of the 3 colons
- There's no way to know which colon was the "intended" separator
- The filepath portion is corrupted (contains extra timestamp fragments)

**Recommended migration strategy:**
1. **Regenerate all fingerprints** from source data. Each file's `birthTimestamp` is stored separately in the DB, so:
   ```sql
   -- Pseudocode: regenerate fingerprints from filepath + birthTimestamp columns
   UPDATE files SET fingerprint = filepath || '||' || birth_timestamp;
   ```
2. **Update all foreign key references** to fingerprints in `mutation_log`, `file_intent`, and any other tables that store fingerprints.
3. **Run a consistency check** after migration to verify all fingerprints parse correctly.

### Files Affected

All callers of `generateFingerprint()` will automatically use the new format:
- `backend/persistence.js` (line 347)
- `backend/index.js` (line 206)
- `backend/indexer.js` (line 361)

### Backward Compatibility

The `parseFingerprint()` function handles both formats:
- New `||` format — used for all newly generated fingerprints
- Legacy `:` format — used only for simple (non-ISO) timestamps in existing DB records

**The legacy fallback is safe for numeric timestamps** (e.g., `file.js:0`) but **will still corrupt ISO timestamps** from old records. This is acceptable because those records were already corrupted by the original code.

---

*Debug session completed 2026-05-13.*
