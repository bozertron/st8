# Detailed Line-by-Line Report: `backend/manifestGenerator.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/backend/manifestGenerator.js`
**Total Lines:** 172
**Purpose:** Generates two manifest files — `connection-state.json` (structured JSON file inventory with status, imports, intent) and `ai-signal.toml` (TOML-formatted signal file for AI consumption) — from an array of indexed file objects.

---

## Lines 1-2: Shebang
```js
#!/usr/bin/env node
```
- **What this section does:** Declares this file as an executable Node.js script.
- **What triggers it:** Running `node manifestGenerator.js` directly from CLI.
- **What it calls:** N/A — OS-level directive.
- **What calls it:** Direct CLI invocation (but there is NO CLI block at the bottom of the file, so this shebang is unused).
- **Dependencies:** None.
- **Status:** BROKEN (dead code)
- **Gap:** The shebang suggests standalone CLI usage was intended, but the file has **no CLI entry point block** (no `if (require.main === module)` guard). The file can only be consumed as a module via `require('./manifestGenerator')`. The shebang is dead code. Compare with `schemaCardEmitter.js` which has a proper CLI block.

---

## Lines 3-9: JSDoc Block Comment
```js
/**
 * ST8 Manifest Generator
 * 
 * Generates connection-state.json and ai-signal.toml manifests.
 * References maestro-scaffolder-tool code for TOML serialization.
 * DO NOT copy files from maestro. Import/require by path.
 */
```
- **What this section does:** Module-level documentation describing the generator's purpose and design constraint (use maestro lib by path, don't copy).
- **What triggers it:** N/A — documentation only.
- **What it calls:** N/A.
- **What calls it:** N/A.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** The doc says "References maestro-scaffolder-tool code" but the actual lib path loaded (line 37) is `lib/commands/integr8/tomlSerializer.js`, which is from the **integr8** command, not maestro-scaffolder-tool. Minor documentation inaccuracy — the intent (load from lib, don't copy) is correct, but the provenance attribution is wrong.

---

## Line 11: Strict Mode
```js
'use strict';
```
- **What this section does:** Enables JavaScript strict mode — prevents accidental globals, silent errors.
- **What triggers it:** Module load time.
- **What it calls:** N/A.
- **What calls it:** Node.js runtime on require.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None.

---

## Lines 13-14: Imports
```js
const path = require('path');
const fs = require('fs');
```
- **What this section does:** Imports Node.js built-in `path` and `fs` modules.
- **What triggers it:** Module load time.
- **What it calls:** `require('path')`, `require('fs')`.
- **What calls it:** Module loader.
- **Dependencies:** Node.js standard library.
- **Status:** WORKING
- **Gap:** None. Both are used throughout the file — `path` at lines 18, 24, 145, 146; `fs` at lines 25, 151, 156.

---

## Lines 16-19: Lib Directory Constant
```js
// ─── LIB CODE REFERENCES ─────────────────────────────────────

const LIB_DIR = path.join(__dirname, '..', 'lib');
```
- **What this section does:** Computes the absolute path to the `lib/` directory relative to the `backend/` directory. Since this file is at `backend/manifestGenerator.js`, `__dirname` is `backend/`, so `..` resolves to the project root, and `LIB_DIR` becomes `<project-root>/lib`.
- **What triggers it:** Module load time (top-level constant evaluation).
- **What it calls:** `path.join()`.
- **What calls it:** `loadLibModule()` at line 24.
- **Dependencies:** `path` module (line 13).
- **Status:** WORKING
- **Gap:** None. The path computation is correct given the project structure where `lib/` is a sibling of `backend/`.

---

## Lines 20-40: Lazy TOML Serializer Loader
```js
let _tomlSerializer = null;

function loadLibModule(modulePath) {
    try {
        const fullPath = path.join(LIB_DIR, modulePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Lib module not found: ${fullPath}`);
        }
        return require(fullPath);
    } catch (err) {
        console.error(`[st8:manifest] Failed to load lib module: ${modulePath}`, err.message);
        return null;
    }
}

function getTomlSerializer() {
    if (!_tomlSerializer) {
        _tomlSerializer = loadLibModule('commands/integr8/tomlSerializer.js');
    }
    return _tomlSerializer;
}
```

### Line 20: Module-level cache variable
```js
let _tomlSerializer = null;
```
- **What this section does:** Declares a module-scoped mutable variable to cache the loaded TOML serializer module.
- **What triggers it:** Module load time.
- **What it calls:** N/A.
- **What calls it:** `getTomlSerializer()` reads/writes this.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None. This is a standard lazy-initialization cache pattern.

### Lines 22-33: `loadLibModule(modulePath)`
- **What this section does:** Safely loads a module from the `lib/` directory. First checks if the file exists with `fs.existsSync` (line 25), then uses `require()` (line 28) to load it. If either step fails, logs an error (line 30) and returns `null` (line 31).
- **What triggers it:** Called by `getTomlSerializer()` at line 37.
- **What it calls:** `path.join()` (line 24), `fs.existsSync()` (line 25), `require()` (line 28).
- **What calls it:** `getTomlSerializer()` at line 37.
- **Dependencies:** `fs` (line 14), `path` (line 13), `LIB_DIR` (line 18).
- **Status:** WORKING
- **Gap:** The function catches ALL errors (line 29) including syntax errors in the loaded module. If `tomlSerializer.js` has a runtime error on load, it will be silently swallowed and logged as "Failed to load lib module" — misleading the developer into thinking the file is missing rather than broken. The error message at line 30 only prints `err.message`, not the stack trace. Consider distinguishing "file not found" from "file exists but failed to load."

### Lines 35-40: `getTomlSerializer()`
- **What this section does:** Returns the cached TOML serializer module. On first call (or if previous load failed and `_tomlSerializer` is still `null`), attempts to load it via `loadLibModule()`.
- **What triggers it:** Called by `generateAiSignalToml()` at line 90.
- **What it calls:** `loadLibModule()` (line 37).
- **What calls it:** `generateAiSignalToml()` (line 90).
- **Dependencies:** `loadLibModule()` (line 22), `_tomlSerializer` (line 20).
- **Status:** WORKING
- **Gap:** The caching logic is correct — `!null` is `true`, so it retries on failure. However, if `loadLibModule` returns `null` every time (file missing), every call to `generateAiSignalToml` will retry the `fs.existsSync` check and log a console error. This means repeated manifest generation attempts will spam the error log. A "checked and failed" sentinel (e.g., `false` instead of `null`) would prevent retry spam.

---

## Lines 42-75: `generateConnectionState(files, targetDir)` — JSON Manifest Builder
```js
function generateConnectionState(files, targetDir) {
    const manifest = {
        metadata: {
            timestamp: new Date().toISOString(),
            targetDirectory: targetDir,
            totalFiles: files.length,
            statusCounts: {
                GREEN: files.filter(f => f.status === 'GREEN').length,
                YELLOW: files.filter(f => f.status === 'YELLOW').length,
                RED: files.filter(f => f.status === 'RED').length
            }
        },
        files: files.map(f => ({
            fingerprint: f.fingerprint || f.sha256Hash,
            filepath: f.filepath,
            filename: f.filename,
            status: f.status,
            reachabilityScore: f.reachabilityScore || 0.0,
            impactRadius: f.impactRadius || 0,
            sha256Hash: f.sha256Hash,
            imports: f.imports || [],
            importedBy: f.importedBy || [],
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

### Lines 44-45: Function signature and manifest object start
```js
function generateConnectionState(files, targetDir) {
    const manifest = {
```
- **What this section does:** Takes an array of `files` (indexed file objects from the indexer) and a `targetDir` string. Begins constructing the manifest object.
- **What triggers it:** Called by `writeManifests()` at line 150.
- **What it calls:** N/A (object construction).
- **What calls it:** `writeManifests()` (line 150).
- **Dependencies:** `files` array shape from `indexer.js`.
- **Status:** WORKING
- **Gap:** No input validation — if `files` is `null` or `undefined`, `files.length` (line 49) will throw `TypeError: Cannot read properties of null`. If `targetDir` is `undefined`, it silently writes `undefined` as the targetDirectory value.

### Lines 46-54: Metadata section
```js
metadata: {
    timestamp: new Date().toISOString(),
    targetDirectory: targetDir,
    totalFiles: files.length,
    statusCounts: {
        GREEN: files.filter(f => f.status === 'GREEN').length,
        YELLOW: files.filter(f => f.status === 'YELLOW').length,
        RED: files.filter(f => f.status === 'RED').length
    }
},
```
- **What this section does:** Builds the metadata block with a generation timestamp, the target directory path, total file count, and counts by status (GREEN/YELLOW/RED).
- **What triggers it:** Part of `generateConnectionState()`.
- **What it calls:** `new Date().toISOString()` (line 47), `Array.filter()` (lines 51-53).
- **What calls it:** Internal to `generateConnectionState()`.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** Three separate `filter()` passes over the `files` array (lines 51-53) — functionally correct but O(3n). For large file sets this is a minor inefficiency, not a correctness issue. No validation that `f.status` is one of the three expected values — any other status string (e.g., `'UNKNOWN'`) will simply not be counted, silently dropping it from the status counts.

### Lines 56-71: Files mapping
```js
files: files.map(f => ({
    fingerprint: f.fingerprint || f.sha256Hash,
    filepath: f.filepath,
    filename: f.filename,
    status: f.status,
    reachabilityScore: f.reachabilityScore || 0.0,
    impactRadius: f.impactRadius || 0,
    sha256Hash: f.sha256Hash,
    imports: f.imports || [],
    importedBy: f.importedBy || [],
    intent: f.intent || {
        purpose: '',
        dependsOnBehavior: '',
        valueStatement: ''
    }
}))
```
- **What this section does:** Transforms each indexed file object into a manifest entry. Uses fallback defaults for missing fields.
- **What triggers it:** Part of `generateConnectionState()`.
- **What it calls:** `Array.map()`.
- **What calls it:** Internal to `generateConnectionState()`.
- **Dependencies:** File object shape from `indexer.js`.
- **Status:** WORKING
- **Gap (Line 57):** `fingerprint: f.fingerprint || f.sha256Hash` — if BOTH `fingerprint` and `sha256Hash` are `undefined`/`null`/empty, the fingerprint will be `undefined`. There is no fallback for a missing hash. This could produce entries with `fingerprint: undefined` in the JSON (which JSON.stringify converts to the key being omitted entirely).
- **Gap (Line 61):** `reachabilityScore: f.reachabilityScore || 0.0` — the `||` operator treats `0` as falsy. If a file legitimately has `reachabilityScore: 0`, this will still produce `0.0` (correct in this case since the fallback is also 0). But semantically, `?? 0.0` (nullish coalescing) would be more correct to distinguish "missing" from "explicitly zero."
- **Gap (Line 62):** `impactRadius: f.impactRadius || 0` — same `||` vs `??` concern. If `impactRadius` is explicitly `0`, `|| 0` produces `0` (correct). But if it's `null` or `undefined`, `|| 0` also produces `0`. The `??` operator would be more semantically precise.
- **Gap (Line 66-70):** Default empty intent object — if a file has no intent seeded, it gets `{ purpose: '', dependsOnBehavior: '', valueStatement: '' }`. This is a reasonable default but the empty strings may confuse downstream consumers that check for intent presence via string length rather than null checks.

### Lines 73-75: Return
```js
    return manifest;
}
```
- **What this section does:** Returns the constructed manifest object (NOT a JSON string — the caller handles serialization).
- **What triggers it:** Part of `generateConnectionState()`.
- **What it calls:** N/A.
- **What calls it:** `writeManifests()` at line 150.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** None.

---

## Lines 77-140: TOML Manifest Generation

### Lines 79-87: `escapeTomlString(value)` — Local TOML String Escaper
```js
function escapeTomlString(value) {
    if (typeof value !== 'string') return String(value);
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}
```
- **What this section does:** Escapes a JavaScript string for safe inclusion in a TOML double-quoted string. Handles backslashes, double quotes, newlines, carriage returns, and tabs. Non-string values are coerced via `String()`.
- **What triggers it:** Called by `generateAiSignalToml()` at lines 115, 116, 127, 128, 133.
- **What it calls:** `String()` (line 80), `String.replace()` (lines 82-86).
- **What calls it:** `generateAiSignalToml()` (manual TOML path).
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** This is a **duplicate** of the identical function at `lib/commands/integr8/tomlSerializer.js` lines 13-20. Both have the same escaping logic. The DRY violation means a bug fix in one won't propagate to the other. Also, the function does NOT escape single quotes — but since TOML double-quoted strings don't require single-quote escaping, this is correct.
- **Gap (Line 80):** For non-string inputs, `String(value)` is used. If `value` is `null`, `String(null)` returns `"null"` — which would be written as `"null"` in TOML. If `value` is `undefined`, `String(undefined)` returns `"undefined"`. These are valid strings but may not be the intended behavior for missing values.

### Lines 89-140: `generateAiSignalToml(files, targetDir)` — TOML Manifest Builder
```js
function generateAiSignalToml(files, targetDir) {
```

#### Lines 90-110: Maestro Serializer Path (Primary)
```js
    const tomlSerializer = getTomlSerializer();
    
    // Try to use maestro's TOML serializer
    if (tomlSerializer && typeof tomlSerializer.serializeGraphMetadataToToml === 'function') {
        try {
            const metadata = {
                version: '1.0',
                generatedAt: new Date().toISOString(),
                targetDirectory: targetDir,
                totalFiles: files.length,
                statusDistribution: {
                    green: files.filter(f => f.status === 'GREEN').length,
                    yellow: files.filter(f => f.status === 'YELLOW').length,
                    red: files.filter(f => f.status === 'RED').length
                }
            };
            return tomlSerializer.serializeGraphMetadataToToml(metadata);
        } catch (err) {
            console.warn('[st8:manifest] Maestro TOML serializer failed, using manual generation');
        }
    }
```
- **What this section does:** Attempts to use the maestro/integr8 TOML serializer (`serializeGraphMetadataToToml`) to generate the TOML output. Constructs a `metadata` object with version, timestamp, target directory, total files, and status distribution.
- **What triggers it:** Called by `writeManifests()` at line 155.
- **What it calls:** `getTomlSerializer()` (line 90), `tomlSerializer.serializeGraphMetadataToToml()` (line 106).
- **What calls it:** `writeManifests()` (line 155).
- **Dependencies:** `lib/commands/integr8/tomlSerializer.js` (loaded lazily).
- **Status:** **BROKEN** 🚨
- **Gap (CRITICAL — Lines 95-106):** **TYPE MISMATCH with serializer contract.** The `serializeGraphMetadataToToml()` function in `lib/commands/integr8/tomlSerializer.js` (lines 135-145) expects a `properties` object with the shape:
  ```js
  {
      reachability: <number>,
      stability: <number>,
      fragility: <number>,
      integrationDistance?: <number>
  }
  ```
  But the code at lines 95-105 passes:
  ```js
  {
      version: '1.0',
      generatedAt: '...',
      targetDirectory: '...',
      totalFiles: N,
      statusDistribution: { green: N, yellow: N, red: N }
  }
  ```
  The serializer will produce:
  ```toml
  [graph_properties]
  reachability = undefined
  stability = undefined
  fragility = undefined
  ```
  `undefined` is **not valid TOML** — it will cause any TOML parser to fail. The serializer writes `properties.reachability`, `properties.stability`, and `properties.fragility` directly as bare values (no string quoting), so `undefined` becomes the literal string `undefined` in the output. This means:
  1. The maestro serializer path **always produces invalid TOML** when called from this file.
  2. The catch block (line 107-109) catches the error IF the serializer throws — but `serializeGraphMetadataToToml` doesn't throw; it just produces garbage output. It returns a string like `"[graph_properties]\nreachability = undefined\n..."`.
  3. The `return` at line 106 returns this invalid TOML, and the manual fallback (lines 112-139) is **never reached**.
  4. The manifest file `ai-signal.toml` is **always corrupted** when the lib module is present.

#### Lines 112-139: Manual TOML Generation (Fallback)
```js
    // Manual TOML generation
    let toml = `# AI Signal Manifest
version = "1.0"
generated_at = "${escapeTomlString(new Date().toISOString())}"
target_directory = "${escapeTomlString(targetDir)}"

[status_distribution]
green = ${files.filter(f => f.status === 'GREEN').length}
yellow = ${files.filter(f => f.status === 'YELLOW').length}
red = ${files.filter(f => f.status === 'RED').length}

`;
    
    for (const file of files) {
        toml += `[[files]]
path = "${escapeTomlString(file.filepath)}"
status = "${escapeTomlString(file.status)}"
reachability_score = ${file.reachabilityScore || 0.0}
impact_radius = ${file.impactRadius || 0}

[files.ai_signal]
core_responsibility = "${escapeTomlString((file.intent && file.intent.purpose) || '')}"
can_be_archived = ${file.status === 'RED' && (file.impactRadius || 0) === 0}

`;
    }
    
    return toml;
```
- **What this section does:** Manually constructs a TOML string with a header section (version, timestamp, target directory, status distribution) followed by per-file `[[files]]` array-of-tables entries with an `[files.ai_signal]` subtable.
- **What triggers it:** Reached only if the maestro serializer is NOT loaded (line 93 condition fails) OR if the serializer throws (line 107 catch). Due to the bug at lines 90-110, this path is almost never reached in practice.
- **What it calls:** `escapeTomlString()` (lines 115, 116, 127, 128, 133), `Array.filter()` (lines 119-121).
- **What calls it:** Internal fallback within `generateAiSignalToml()`.
- **Dependencies:** `escapeTomlString()` (line 79).
- **Status:** PARTIAL
- **Gap (Line 115):** `escapeTomlString(new Date().toISOString())` — `toISOString()` always returns a safe ASCII string like `"2026-05-13T12:00:00.000Z"` that never contains backslashes or quotes. The escaping is technically unnecessary but harmless.
- **Gap (Line 129):** `reachability_score = ${file.reachabilityScore || 0.0}` — When `file.reachabilityScore` is falsy (null/undefined), the `||` fallback produces `0.0`. But JavaScript's `String(0.0)` is `"0"`, not `"0.0"`. So the TOML output will be `reachability_score = 0` (integer) instead of `reachability_score = 0.0` (float). In TOML, these are different types. If downstream consumers expect a float, this type mismatch could cause issues.
- **Gap (Line 130):** `impact_radius = ${file.impactRadius || 0}` — Same `|| 0` pattern. `String(0)` is `"0"` — correct for an integer field. No issue here.
- **Gap (Line 134):** `can_be_archived = ${file.status === 'RED' && (file.impactRadius || 0) === 0}` — This evaluates a JS boolean expression and embeds the result directly. This produces valid TOML (`true`/`false`). However, the logic means a file is archivable ONLY if its status is exactly `'RED'` AND its impact radius is 0 (or missing/falsy). A `YELLOW` file with zero impact is NOT marked archivable. This is an intentional business rule but worth noting.
- **Gap (Lines 125-136):** The `[files.ai_signal]` subtable after `[[files]]` is valid TOML syntax per the TOML v1.0 spec — it creates a subtable of the most recently defined `[[files]]` entry. This is correct.

---

## Lines 142-164: `writeManifests(files, targetDir)` — File Writer
```js
function writeManifests(files, targetDir) {
    const jsonPath = path.join(targetDir, 'connection-state.json');
    const tomlPath = path.join(targetDir, 'ai-signal.toml');
    
    try {
        // Write JSON manifest
        const jsonManifest = generateConnectionState(files, targetDir);
        fs.writeFileSync(jsonPath, JSON.stringify(jsonManifest, null, 2));
        console.log(`[st8:manifest] JSON manifest written to: ${jsonPath}`);
        
        // Write TOML manifest
        const tomlContent = generateAiSignalToml(files, targetDir);
        fs.writeFileSync(tomlPath, tomlContent);
        console.log(`[st8:manifest] TOML manifest written to: ${tomlPath}`);
        
        return { jsonPath, tomlPath };
    } catch (err) {
        console.error('[st8:manifest] Error writing manifests:', err.message);
        return null;
    }
}
```

### Lines 144-146: Path construction
```js
const jsonPath = path.join(targetDir, 'connection-state.json');
const tomlPath = path.join(targetDir, 'ai-signal.toml');
```
- **What this section does:** Constructs absolute paths for both manifest files within the target directory.
- **What triggers it:** Called by `writeManifests()`.
- **What it calls:** `path.join()`.
- **What calls it:** Internal.
- **Dependencies:** `path` module (line 13).
- **Status:** WORKING
- **Gap:** No validation that `targetDir` exists. If `targetDir` is a non-existent path, `fs.writeFileSync` at lines 151/156 will throw `ENOENT`, caught by the try/catch at line 160. This is acceptable error handling but the error message (`"Error writing manifests: ENOENT: no such file or directory"`) doesn't clearly indicate the target directory was invalid.

### Lines 148-159: Try block — generate and write both manifests
- **What this section does:** Generates the JSON manifest via `generateConnectionState()`, writes it to disk with pretty-printing (2-space indent), then generates the TOML manifest via `generateAiSignalToml()` and writes it to disk. Returns paths on success.
- **What triggers it:** `writeManifests()` invocation.
- **What it calls:** `generateConnectionState()` (line 150), `fs.writeFileSync()` (lines 151, 156), `generateAiSignalToml()` (line 155).
- **What calls it:** External callers (see "Callers" section below).
- **Dependencies:** `fs` (line 14), `generateConnectionState()` (line 44), `generateAiSignalToml()` (line 89).
- **Status:** WORKING (JSON path) / **BROKEN** (TOML path — inherits the type mismatch bug from `generateAiSignalToml`)
- **Gap (Line 151):** `fs.writeFileSync(jsonPath, JSON.stringify(jsonManifest, null, 2))` — synchronous file write. If the target directory doesn't exist, this throws. The error is caught but both manifests fail together (the TOML write never happens if JSON write fails).
- **Gap (Line 156):** Similarly, if the TOML write fails, the function returns `null` but the JSON manifest may have already been written successfully, leaving a partial/inconsistent state (JSON exists, TOML doesn't).

### Lines 160-163: Catch block
```js
    } catch (err) {
        console.error('[st8:manifest] Error writing manifests:', err.message);
        return null;
    }
```
- **What this section does:** Catches any error during manifest generation or file writing, logs it, and returns `null`.
- **What triggers it:** Any exception in the try block.
- **What it calls:** `console.error()`.
- **What calls it:** N/A — error handler.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** The return value `null` is **never checked by callers**. All three call sites (see below) ignore the return value:
  - `server.js:299` — `writeManifests(result.files, targetDir);` (discarded)
  - `index.js:156` — `writeManifests(result.files, targetDir);` (discarded)
  - `index.js:378` — `writeManifests(result.files, targetDir);` (discarded)
  
  If manifest writing fails, no caller knows. The server returns a 200 OK even if manifests weren't written.

---

## Lines 166-172: Exports
```js
module.exports = {
    generateConnectionState,
    generateAiSignalToml,
    writeManifests
};
```
- **What this section does:** Exports three functions as a CommonJS module.
- **What triggers it:** Module load time.
- **What it calls:** N/A.
- **What calls it:** `require('./manifestGenerator')` in callers.
- **Dependencies:** None.
- **Status:** WORKING
- **Gap:** `escapeTomlString` and `loadLibModule` are NOT exported. They are internal-only. This is fine — they're implementation details. But `escapeTomlString` is duplicated in `tomlSerializer.js` and neither exports it for shared use.

---

## Callers — What Triggers Manifest Generation?

### Caller 1: `backend/server.js` — HTTP API Endpoint (line 284, 299)
```
Line 284: const { writeManifests } = require('./manifestGenerator');
Line 299: writeManifests(result.files, targetDir);
```
- **Trigger:** HTTP POST request to the manifest generation endpoint (around line 275-313).
- **Context:** Indexes the directory via `indexDirectory()`, enriches with intents from persistence, then writes manifests. Returns 200 OK to client.
- **Return value check:** ❌ None. Return value discarded.
- **Error propagation:** Server wraps in try/catch (line 307-309) and returns 500 on error. But if `writeManifests` returns `null` (internal error caught), the server still returns 200 OK.

### Caller 2: `backend/index.js` — Initial Index (line 16, 155-156)
```
Line 16: const { writeManifests } = require('./manifestGenerator');
Line 155-156: const { writeManifests } = require('./manifestGenerator');
         writeManifests(result.files, targetDir);
```
- **Trigger:** After initial full directory indexing completes (around line 145-157).
- **Context:** Part of the main startup flow — index → write manifests → emit schema cards → run gap analysis.
- **Return value check:** ❌ None.
- **Note:** Line 16 imports at top level but line 155 re-imports locally. The top-level import at line 16 is redundant — it's imported again at line 155 inside the function. The line 16 import IS used elsewhere at line 377 though.

### Caller 3: `backend/index.js` — Incremental Re-index (line 377-378)
```
Line 377: const { writeManifests } = require('./manifestGenerator');
Line 378: writeManifests(result.files, targetDir);
```
- **Trigger:** File watcher detects changes and triggers incremental re-indexing (around line 375-378). Only runs if `anyChanged` is true.
- **Context:** Part of the file watcher's change handler — re-indexes, regenerates manifests, re-seeds intents.
- **Return value check:** ❌ None.

---

## @@@ Handling

**No `@@@` symbols found in `manifestGenerator.js`.** The `@@@` pattern is handled in other files:
- `backend/brunoOscar.js:173` — Uses `@@@` as a content marker in HTML comments.
- `backend/intentSeeder.js:187-188` — Detects `@@@` symbols in file content via regex `@@@AI_REVIEW`.
- `backend/persistence.js:577` — Has a `@@@ SYMBOL METHODS` section.

`manifestGenerator.js` does not detect, process, or generate `@@@` symbols. The `ai-signal.toml` output does not include any `@@@` markers. If `@@@` detection was intended in the manifest (e.g., flagging files with `@@@AI_REVIEW` markers), it is **not implemented**.

---

## Dependency Map

```
backend/manifestGenerator.js
├── requires: path (Node.js built-in)
├── requires: fs (Node.js built-in)
├── lazy-loads: lib/commands/integr8/tomlSerializer.js  ← BROKEN TYPE CONTRACT
│
├── called by: backend/server.js:284,299  (HTTP endpoint)
├── called by: backend/index.js:16,155-156  (initial index)
└── called by: backend/index.js:377-378  (incremental re-index)
```

---

## Summary of Findings

| # | Lines | Severity | Issue |
|---|-------|----------|-------|
| 1 | 90-110 | **BLOCKER** | `serializeGraphMetadataToToml()` receives wrong object shape — produces `reachability = undefined` (invalid TOML). The serializer expects `{reachability, stability, fragility}` but gets `{version, generatedAt, targetDirectory, totalFiles, statusDistribution}`. |
| 2 | 106 | **BLOCKER** | The `return` on line 106 means the manual TOML fallback (lines 112-139) is unreachable when the lib module loads successfully. Users always get broken TOML. |
| 3 | 148-163 | **WARNING** | `writeManifests()` catches errors and returns `null`, but all 3 callers discard the return value. Failed manifest writes go undetected. |
| 4 | 22-33 | **WARNING** | `loadLibModule()` catches ALL errors (including syntax errors in loaded modules) and treats them as "module not found." Broken lib modules are silently swallowed. |
| 5 | 35-40 | **WARNING** | `getTomlSerializer()` retries `fs.existsSync` + error logging on every call when the lib module is missing. No "checked and failed" sentinel — error log spam. |
| 6 | 79-87 | **INFO** | `escapeTomlString()` is duplicated in `lib/commands/integr8/tomlSerializer.js:13-20`. DRY violation — bug fixes won't propagate. |
| 7 | 1-2 | **INFO** | Shebang declares executable but no CLI entry point exists. Dead code. |
| 8 | 61-62 | **INFO** | `\|\| 0.0` / `\|\| 0` patterns treat explicit `0` the same as missing values. `?? 0.0` would be more semantically correct. |
| 9 | 151-156 | **WARNING** | Non-atomic write — JSON may succeed while TOML fails (or vice versa), leaving inconsistent state on disk. |
| 10 | 129 | **INFO** | `String(0.0)` is `"0"` (integer in TOML), not `"0.0"` (float). The fallback produces a different TOML type than the field name `reachability_score` suggests. |

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (line-by-line analysis)_
