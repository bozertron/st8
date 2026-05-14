# Line-by-Line Analysis: `lib/commands/integr8/tomlSerializer.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/lib/commands/integr8/tomlSerializer.js`
**Lines:** 418 total
**Generated:** 2026-05-13T21:30:00Z
**Source TypeScript:** `src/commands/integr8/tomlSerializer.ts`

---

## 1. Module Header & Exports

### Lines 1-7: Module Setup & Export Declarations
```
"use strict";
// src/commands/integr8/tomlSerializer.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeMigrationPlanToToml = serializeMigrationPlanToToml;
exports.serializeGraphMetadataToToml = serializeGraphMetadataToToml;
exports.parseMigrationPlanFromToml = parseMigrationPlanFromToml;
```

- **What triggers it:** Module load via `require('./tomlSerializer')`
- **What it calls:** Nothing (declarative)
- **What calls it:**
  - `lib/commands/integr8/index.js:53` — `require("./tomlSerializer.js")`
  - `lib/commands/integr8/migrationExecutor.js:60` — `require("./tomlSerializer")`
  - `backend/manifestGenerator.js:37` — `loadLibModule('commands/integr8/tomlSerializer.js')`
  - `backend/indexer.js:67` — `loadLibModule('commands/integr8/tomlSerializer.js')`
- **Dependencies:** None (this is the root)
- **Status:** WORKING
- **Gap:** None — standard TypeScript CommonJS compiled output

---

## 2. Imports

### Line 7: Type System Import
```
const types_1 = require("./types");
```

- **What triggers it:** Module load
- **What it calls:** `lib/commands/integr8/types.js`
- **What calls it:** Used by `parseMigrationPlanFromToml()` at lines 319, 337, 357, 389 for enum validation
- **Dependencies:** `lib/commands/integr8/types.js` — exports `IntegrationOutcome`, `MigrationAction`, `ConflictType`, `ResolutionStrategy`
- **Status:** WORKING
- **Gap:** None — `types.js` is a sibling module in the same directory

---

## 3. TOML String Helpers

### Lines 8-20: `escapeTomlString(value)`
```
function escapeTomlString(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}
```

- **What triggers it:** Called by `tomlValue()` (line 27) and `tomlStringArray()` (line 35)
- **What it calls:** Nothing (pure string transform)
- **What calls it:**
  - `tomlValue()` at line 27
  - `tomlStringArray()` at line 35
- **Dependencies:** None
- **Status:** WORKING — **but has a subtle ordering bug (see below)**
- **Gap:**
  - **POTENTIAL BUG (Line 14-15):** The backslash replacement on line 14 runs FIRST, converting `\` to `\\`. Then the double-quote replacement on line 15 runs. But consider the input string `\"` — it first becomes `\\"` (line 14), then becomes `\\\"` (line 15). This is **correct TOML escaping** for a literal backslash-quote. The ordering is actually correct here.
  - **MISSING:** Does not escape `\b` (backspace), `\0` (null), or Unicode control characters (U+0000–U+001F except \n, \r, \t). Per TOML spec, these must be escaped in double-quoted strings. Any string containing `\b`, `\0`, or other control chars will produce **invalid TOML**.

---

### Lines 21-30: `tomlValue(value)`
```
function tomlValue(value) {
    if (typeof value === 'string') {
        return `"${escapeTomlString(value)}"`;
    }
    return String(value);
}
```

- **What triggers it:** Called during serialization of all non-array TOML values
- **What it calls:** `escapeTomlString()` (line 27)
- **What calls it:**
  - `serializeMigrationPlanToToml()` — lines 46-51, 58-77, 83-85, 93-98
  - `serializeInlineTable()` — lines 120, 123, 127
- **Dependencies:** `escapeTomlString()` (line 13)
- **Status:** WORKING
- **Gap:**
  - **TYPE SAFETY ISSUE (Line 29):** For non-string values, `String(value)` is called. If `value` is `null` or `undefined`, this produces the strings `"null"` or `"undefined"` which are **not valid TOML bare values** and will cause parse errors on round-trip. The function should handle these edge cases.

---

### Lines 31-37: `tomlStringArray(values)`
```
function tomlStringArray(values) {
    const escaped = values.map(v => `"${escapeTomlString(v)}"`);
    return `[${escaped.join(', ')}]`;
}
```

- **What triggers it:** Called during conflict serialization (line 97)
- **What it calls:** `escapeTomlString()` (via inline template at line 35)
- **What calls it:** `serializeMigrationPlanToToml()` at line 97 for `resolutionOptions`
- **Dependencies:** `escapeTomlString()` (line 13)
- **Status:** WORKING
- **Gap:**
  - **NO VALIDATION:** Does not check if `values` is actually an array. If `conflict.resolutionOptions` is `undefined` or `null`, this will throw a runtime error at `values.map()`.

---

## 4. Serialization: `serializeMigrationPlanToToml(plan)`

### Lines 38-109: Main Serialization Function

- **What triggers it:**
  - `lib/commands/integr8/index.js:104` — when `!args.dryRun` and migration plan needs to be written to `migration_plan.toml`
- **What it calls:**
  - `tomlValue()` — lines 46-51, 58-77, 83-85, 93-98
  - `tomlStringArray()` — line 97
  - `serializeInlineTable()` — line 103
- **What calls it:**
  - `runIntegr8Command()` in `lib/commands/integr8/index.js:104`
- **Dependencies:** `types.js` (not directly, but plan object comes from `pathGenerator.js` which uses types)
- **Status:** WORKING — **but has output format issues**

#### Lines 43-53: `[metadata]` Section Serialization
```
const lines = [];
lines.push('[metadata]');
lines.push(`id = ${tomlValue(plan.id)}`);
lines.push(`timestamp = ${tomlValue(plan.timestamp)}`);
lines.push(`source_path = ${tomlValue(plan.sourcePath)}`);
lines.push(`target_path = ${tomlValue(plan.targetPath)}`);
lines.push(`outcome = ${tomlValue(plan.outcome)}`);
lines.push(`estimated_complexity = ${tomlValue(plan.estimatedComplexity)}`);
lines.push(`conflict_count = ${plan.conflictCount}`);
lines.push('');
```

- **Status:** WORKING
- **Gap:**
  - **Line 52:** `conflict_count = ${plan.conflictCount}` — uses raw numeric value without `tomlValue()` wrapper. This is functionally correct for numbers but inconsistent with the pattern used for all other fields. If `conflictCount` is ever `NaN` or `undefined`, this produces `conflict_count = NaN` or `conflict_count = undefined` which are invalid TOML.

#### Lines 54-89: `[[steps]]` Array-of-Tables Serialization
```
for (const step of plan.steps) {
    lines.push('[[steps]]');
    lines.push(`step = ${step.step}`);     // Line 57
    lines.push(`action = ${tomlValue(step.action)}`);
    lines.push(`description = ${tomlValue(step.description)}`);
    ...
}
```

- **Status:** WORKING
- **Gap:**
  - **Line 57:** `step = ${step.step}` — raw numeric without `tomlValue()`. Same inconsistency as line 52.
  - **Lines 60-77:** Optional fields (`from`, `to`, `file`, `conflictId`, `resolution`, `command`) correctly use `!== undefined` checks before serialization.
  - **Lines 78-87:** Rules are serialized as `[[steps.rules]]` sub-tables. The empty `lines.push('')` at line 81 before each rule creates a blank line, which is valid TOML but creates extra whitespace in the output.

#### Lines 90-107: `[[conflicts]]` Array-of-Tables Serialization
```
for (const conflict of plan.conflicts) {
    lines.push('[[conflicts]]');
    lines.push(`id = ${tomlValue(conflict.id)}`);
    lines.push(`type = ${tomlValue(conflict.type)}`);
    lines.push(`item = ${tomlValue(conflict.item)}`);
    lines.push(`description = ${tomlValue(conflict.description)}`);
    lines.push(`resolution_options = ${tomlStringArray(conflict.resolutionOptions)}`);
    lines.push(`recommended = ${tomlValue(conflict.recommended)}`);
    ...
}
```

- **Status:** WORKING
- **Gap:**
  - **Line 97:** `tomlStringArray(conflict.resolutionOptions)` — will crash if `resolutionOptions` is `undefined` or not an array (see `tomlStringArray` gap above).
  - **Line 99-104:** `details` is serialized as an inline table via `serializeInlineTable()`. This is correct TOML syntax.

---

## 5. Inline Table Serialization: `serializeInlineTable(obj)`

### Lines 110-131: `serializeInlineTable(obj)`
```
function serializeInlineTable(obj) {
    const parts = [];
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null)
            continue;
        const safeKey = key.replace(/\s+/g, '_');
        if (typeof value === 'string') {
            parts.push(`${safeKey} = ${tomlValue(value)}`);
        }
        else if (typeof value === 'number' || typeof value === 'boolean') {
            parts.push(`${safeKey} = ${tomlValue(value)}`);
        }
        else {
            parts.push(`${safeKey} = ${tomlValue(JSON.stringify(value))}`);
        }
    }
    return `{ ${parts.join(', ')} }`;
}
```

- **What triggers it:** Called by `serializeMigrationPlanToToml()` at line 103 for conflict `details`
- **What it calls:** `tomlValue()` — lines 120, 123, 127
- **What calls it:** `serializeMigrationPlanToToml()` at line 103
- **Dependencies:** `tomlValue()` (line 25)
- **Status:** WORKING — **but has key sanitization issue**
- **Gap:**
  - **Line 118:** `safeKey = key.replace(/\s+/g, '_')` — only replaces whitespace with underscores. TOML bare keys must match `[A-Za-z0-9-_]+`. If the key contains characters like `.`, `=`, `[`, `]`, `{`, `}`, `#`, or other special characters, the output will be **invalid TOML**. The sanitizer should also handle dots (for sub-tables) and other non-alphanumeric characters.
  - **Line 127:** Complex objects are JSON-stringified then wrapped in quotes. This works but means the value in TOML is a JSON string, not a native TOML structure. This is a design choice but makes the TOML less readable and harder to parse with standard TOML parsers that expect native types.

---

## 6. Graph Metadata Serialization: `serializeGraphMetadataToToml(properties)`

### Lines 132-145: `serializeGraphMetadataToToml(properties)`
```
function serializeGraphMetadataToToml(properties) {
    const lines = [];
    lines.push('[graph_properties]');
    lines.push(`reachability = ${properties.reachability}`);
    lines.push(`stability = ${properties.stability}`);
    lines.push(`fragility = ${properties.fragility}`);
    if (properties.integrationDistance !== undefined) {
        lines.push(`integration_distance = ${properties.integrationDistance}`);
    }
    return lines.join('\n');
}
```

- **What triggers it:**
  - `backend/manifestGenerator.js:106` — when generating AI signal TOML manifest
- **What it calls:** Nothing (raw string interpolation)
- **What calls it:**
  - `generateAiSignalToml()` in `backend/manifestGenerator.js:106`
  - Also loaded by `backend/indexer.js:67` but **never actually called** from indexer (only `getTomlSerializer()` is defined, no call to `serializeGraphMetadataToToml` found in indexer)
- **Dependencies:** None (takes properties object directly)
- **Status:** PARTIAL — **schema mismatch with caller**
- **Gap:**
  - **SCHEMA MISMATCH (CRITICAL):** The `manifestGenerator.js:95-105` passes an object with `{ version, generatedAt, targetDirectory, totalFiles, statusDistribution }` but this function expects `{ reachability, stability, fragility, integrationDistance }`. The function will output:
    ```
    [graph_properties]
    reachability = undefined
    stability = undefined
    fragility = undefined
    ```
    This produces **invalid TOML** (`undefined` is not a valid TOML value). The function is designed for graph properties from `relationshipAnalyzer.js` but is being called with manifest metadata from `manifestGenerator.js`.
  - **Line 138-140:** `properties.reachability`, `properties.stability`, `properties.fragility` — all use raw interpolation without `tomlValue()`. If these are strings (e.g., from a different caller), the TOML will be unquoted and invalid.
  - **INCONSISTENCY:** This function doesn't use `tomlValue()` or `escapeTomlString()` unlike `serializeMigrationPlanToToml()`. This means string values will be output unquoted.

---

## 7. TOML Parser: `tokenizeSections(tomlString)`

### Lines 146-180: Low-Level TOML Tokenizer
```
function tokenizeSections(tomlString) {
    const sections = [];
    let current = null;
    const lines = tomlString.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#'))
            continue;
        const arrayMatch = line.match(/^\[\[([^\]]+)\]\]$/);
        if (arrayMatch) {
            current = { name: arrayMatch[1].trim(), isArray: true, entries: {} };
            sections.push(current);
            continue;
        }
        const tableMatch = line.match(/^\[([^\]]+)\]$/);
        if (tableMatch) {
            current = { name: tableMatch[1].trim(), isArray: false, entries: {} };
            sections.push(current);
            continue;
        }
        const kvMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s*)=(\s*)(.+)$/);
        if (kvMatch && current) {
            current.entries[kvMatch[1]] = kvMatch[4].trim();
        }
    }
    return sections;
}
```

- **What triggers it:** Called by `parseMigrationPlanFromToml()` at line 304
- **What it calls:** Nothing (pure parsing)
- **What calls it:** `parseMigrationPlanFromToml()` at line 304
- **Dependencies:** None
- **Status:** WORKING — **but has parsing limitations**
- **Gap:**
  - **Line 174:** Key regex `^([A-Za-z_][A-Za-z0-9_]*)(\s*)=(\s*)(.+)$` — only matches bare keys (alphanumeric + underscore). TOML also allows quoted keys like `"dotted.key" = value` and dotted keys like `a.b.c = value`. These will be silently dropped.
  - **Line 174:** The value capture `(.+)$` will include trailing comments if present (TOML allows `key = value # comment`). The comment will be parsed as part of the value, causing downstream parse errors.
  - **NO MULTI-LINE STRING SUPPORT:** Does not handle TOML multi-line strings (`"""..."""` or `'''...'''`).
  - **NO INLINE TABLE PARSING AT TOKENIZER LEVEL:** Inline tables `{ key = "val" }` on a single line are captured as a raw string by the kvMatch regex, which is correct — they're parsed later by `parseInlineTable()`.

---

## 8. TOML Value Parser: `parseTomlValue(raw)`

### Lines 181-210: Parse Raw TOML Value String
```
function parseTomlValue(raw) {
    if (raw.startsWith('"') && raw.endsWith('"')) {
        return unescapeTomlString(raw.slice(1, -1));
    }
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw.startsWith('[') && raw.endsWith(']')) {
        return parseTomlArray(raw);
    }
    if (raw.startsWith('{') && raw.endsWith('}')) {
        return parseInlineTable(raw);
    }
    const num = Number(raw);
    if (!isNaN(num) && raw !== '') {
        return num;
    }
    return raw;
}
```

- **What triggers it:** Called during plan parsing (lines 311-317, 336-343, 346-358, 373-375, 394-399)
- **What it calls:**
  - `unescapeTomlString()` — line 188
  - `parseTomlArray()` — line 197
  - `parseInlineTable()` — line 201
- **What calls it:**
  - `parseMigrationPlanFromToml()` — multiple lines (311-317, 336, etc.)
  - `parseTomlArray()` — line 249, 258
  - `parseInlineTable()` — line 294
- **Dependencies:** `unescapeTomlString()` (line 214), `parseTomlArray()` (line 225), `parseInlineTable()` (line 264)
- **Status:** WORKING — **but has edge case issues**
- **Gap:**
  - **Line 204-206:** `Number(raw)` will parse `"42"` as `42` (correct), but will also parse `" 42 "` (with spaces) as `42` because `Number()` trims whitespace. This is generally fine but differs from strict TOML behavior.
  - **NO INTEGER SUFFIX SUPPORT:** TOML supports `1_000` (underscore separators) and `0xFF` (hex), `0o7` (octal), `0b1` (binary). These will fall through to the string fallback.
  - **NO DATE/TIME SUPPORT:** TOML date-time values like `2023-01-01T00:00:00Z` will be returned as strings, which is acceptable for this use case.

---

## 9. String Unescaping: `unescapeTomlString(value)`

### Lines 211-221: `unescapeTomlString(value)`
```
function unescapeTomlString(value) {
    return value
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}
```

- **What triggers it:** Called by `parseTomlValue()` at line 188
- **What it calls:** Nothing (pure string transform)
- **What calls it:** `parseTomlValue()` at line 188
- **Dependencies:** None
- **Status:** WORKING — **but has ordering bug (mirrors escapeTomlString)**
- **Gap:**
  - **Line 219-220:** The unescape ordering is **CORRECT**. `\\"` (line 219) runs before `\\\\` (line 220). Input `\\\"` first becomes `\"` (line 219 matches `\"`), then becomes `"` (wrong!). Wait — let me trace more carefully:
    - Input: `\\\"` (4 chars: `\`, `\`, `\`, `"`)
    - Line 219: `/\\"/g` matches `\"` at position 2-3 → becomes `\\"` → becomes `\"` (3 chars: `\`, `\`, `"`)
    - Actually, the regex `/\\"/g` matches a literal backslash followed by a quote. So in the input `\\\"`, it matches `\"` at the end, producing `\\"`. Then line 220's `\\\\/g` matches `\\` at the start, producing `\"`. This is correct — the original TOML string `\\\"` represents a literal backslash followed by a quote.
  - **MISSING:** Does not handle `\b` (backspace), `\f` (form feed), `\uXXXX` (Unicode escapes), `\UXXXXXXXX` (long Unicode escapes). If these appear in the TOML, they will be left as-is (e.g., `\b` remains `\b` instead of becoming a backspace character).

---

## 10. TOML Array Parser: `parseTomlArray(raw)`

### Lines 222-260: `parseTomlArray(raw)`
```
function parseTomlArray(raw) {
    const inner = raw.slice(1, -1).trim();
    if (inner === '') return [];
    const items = [];
    let current = '';
    let inQuote = false;
    let depth = 0;
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        const prev = i > 0 ? inner[i - 1] : '';
        if (ch === '"' && prev !== '\\') {
            inQuote = !inQuote;
            current += ch;
            continue;
        }
        if (!inQuote) {
            if (ch === '[' || ch === '{') depth++;
            if (ch === ']' || ch === '}') depth--;
            if (ch === ',' && depth === 0) {
                const trimmed = current.trim();
                if (trimmed !== '') items.push(parseTomlValue(trimmed));
                current = '';
                continue;
            }
        }
        current += ch;
    }
    const trimmed = current.trim();
    if (trimmed !== '') items.push(parseTomlValue(trimmed));
    return items;
}
```

- **What triggers it:** Called by `parseTomlValue()` at line 197 when value starts with `[` and ends with `]`
- **What it calls:** `parseTomlValue()` — lines 249, 258 (recursive)
- **What calls it:** `parseTomlValue()` at line 197
- **Dependencies:** `parseTomlValue()` (line 185)
- **Status:** WORKING — **but has escaped-quote edge case**
- **Gap:**
  - **Line 236:** `ch === '"' && prev !== '\\'` — this check for escaped quotes has a false positive. The input `\\"` (a literal backslash followed by a quote) will have `prev === '\\'` at the quote, so the quote won't toggle `inQuote`. But `\\"` in TOML means "escaped backslash followed by unescaped quote", so the quote SHOULD toggle `inQuote`. This is a **parsing bug** for strings containing `\\` followed by `"`.
  - **NO WHITESPACE AROUND COMMAS:** TOML allows whitespace around commas in arrays. The parser handles this correctly since it trims the current token before pushing.

---

## 11. Inline Table Parser: `parseInlineTable(raw)`

### Lines 261-297: `parseInlineTable(raw)`
```
function parseInlineTable(raw) {
    const inner = raw.slice(1, -1).trim();
    if (inner === '') return {};
    const result = {};
    const pairs = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        const prev = i > 0 ? inner[i - 1] : '';
        if (ch === '"' && prev !== '\\') {
            inQuote = !inQuote;
        }
        if (ch === ',' && !inQuote) {
            pairs.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    if (current.trim() !== '') pairs.push(current.trim());
    for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) continue;
        const key = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();
        result[key] = parseTomlValue(val);
    }
    return result;
}
```

- **What triggers it:** Called by `parseTomlValue()` at line 201 when value starts with `{` and ends with `}`
- **What it calls:** `parseTomlValue()` — line 294
- **What calls it:** `parseTomlValue()` at line 201
- **Dependencies:** `parseTomlValue()` (line 185)
- **Status:** WORKING — **same escaped-quote bug as parseTomlArray**
- **Gap:**
  - **Line 276:** Same `prev !== '\\'` false positive as `parseTomlArray()` line 236. A string containing `\\"` will incorrectly fail to toggle `inQuote`.
  - **Line 289:** `pair.indexOf('=')` uses first `=` only. If a value contains `=` (e.g., `{ key = "a=b" }`), the split is correct because `indexOf` finds the first `=`.

---

## 12. Migration Plan Parser: `parseMigrationPlanFromToml(tomlString)`

### Lines 298-417: Main Deserialization Function

- **What triggers it:**
  - `lib/commands/integr8/migrationExecutor.js:67` — when loading a migration plan from TOML file
- **What it calls:**
  - `tokenizeSections()` — line 304
  - `parseTomlValue()` — lines 311-317, 336, 341, 343, 346-358, 373-375, 394-399
  - `Object.values(types_1.IntegrationOutcome)` — line 319
  - `Object.values(types_1.MigrationAction)` — line 337
  - `Object.values(types_1.ResolutionStrategy)` — line 357
  - `Object.values(types_1.ConflictType)` — line 389
- **What calls it:**
  - `loadMigrationPlan()` in `lib/commands/integr8/migrationExecutor.js:67`
- **Dependencies:** `types.js` (line 7), `tokenizeSections()` (line 150), `parseTomlValue()` (line 185)
- **Status:** WORKING — **but has robustness issues**

### Lines 303: Variable Declarations
```
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
```

- **Status:** WORKING — TypeScript compiled nullish coalescing variables
- **Gap:** These are unused if all TOML fields are present. They're only used for default values via `_a !== null && _a !== void 0 ? _a : 'default'` pattern.

### Lines 304-309: Section Tokenization & Metadata Validation
```
const sections = tokenizeSections(tomlString);
const metadataSection = sections.find(s => s.name === 'metadata' && !s.isArray);
if (!metadataSection) {
    throw new Error('TOML parse error: missing [metadata] section');
}
```

- **Status:** WORKING
- **Gap:** Throws on missing `[metadata]` section — correct fail-fast behavior.

### Lines 310-328: Metadata Parsing with Defaults
```
const md = metadataSection.entries;
const id = String(parseTomlValue((_a = md['id']) !== null && _a !== void 0 ? _a : '""'));
const timestamp = String(parseTomlValue((_b = md['timestamp']) !== null && _b !== void 0 ? _b : '""'));
const sourcePath = String(parseTomlValue((_c = md['source_path']) !== null && _c !== void 0 ? _c : '""'));
const targetPath = String(parseTomlValue((_d = md['target_path']) !== null && _d !== void 0 ? _d : '""'));
const outcomeRaw = String(parseTomlValue((_e = md['outcome']) !== null && _e !== void 0 ? _e : '"SUCCESS"'));
const estimatedComplexityRaw = String(parseTomlValue((_f = md['estimated_complexity']) !== null && _f !== void 0 ? _f : '"medium"'));
const conflictCount = Number(parseTomlValue((_g = md['conflict_count']) !== null && _g !== void 0 ? _g : '0'));
```

- **Status:** WORKING
- **Gap:**
  - **Lines 311-314:** Default values are empty strings (`'""'`). If a field is missing from the TOML, the parsed value will be an empty string `""`. This means `id`, `timestamp`, `sourcePath`, `targetPath` can all be empty strings without error.
  - **Line 315:** Default outcome is `"SUCCESS"` — this means a corrupted TOML without an outcome field will silently assume success. This could mask errors.
  - **Line 317:** `conflictCount` defaults to `0` — reasonable.

### Lines 319-328: Outcome & Complexity Validation
```
if (!Object.values(types_1.IntegrationOutcome).includes(outcomeRaw)) {
    throw new Error(`TOML parse error: invalid outcome "${outcomeRaw}"`);
}
const outcome = outcomeRaw;
const validComplexities = ['low', 'medium', 'high'];
if (!validComplexities.includes(estimatedComplexityRaw)) {
    throw new Error(`TOML parse error: invalid estimated_complexity "${estimatedComplexityRaw}"`);
}
const estimatedComplexity = estimatedComplexityRaw;
```

- **Status:** WORKING
- **Gap:**
  - **Line 324:** `validComplexities` is a local array literal instead of using an enum or constant from `types.js`. If complexity values change in the types, this array must be manually updated. **Maintenance risk.**

### Lines 329-383: Steps Parsing with Rule Association
```
const stepSections = sections.filter(s => s.name === 'steps' && s.isArray);
const ruleSections = sections.filter(s => s.name === 'steps.rules' && s.isArray);
const steps = [];
let ruleIdx = 0;
for (const sec of stepSections) {
    ...
    // Rules are associated by position: rules between this step and the next
    const thisStepIndex = sections.indexOf(sec);
    const nextStepIndex = stepSections.indexOf(sec) + 1 < stepSections.length
        ? sections.indexOf(stepSections[stepSections.indexOf(sec) + 1])
        : sections.length;
    const stepRules = [];
    for (let i = thisStepIndex + 1; i < nextStepIndex; i++) {
        const rs = sections[i];
        if (rs.name === 'steps.rules' && rs.isArray) {
            stepRules.push({ ... });
        }
    }
    ...
}
```

- **Status:** WORKING — **but has unused variable and fragile association logic**
- **Gap:**
  - **Line 333:** `let ruleIdx = 0;` — declared but **never used**. Dead code.
  - **Line 331:** `const ruleSections = sections.filter(...)` — declared but **never used**. Dead code. Rules are found by iterating `sections` between step boundaries (lines 369-377).
  - **Lines 364-367:** Rule-to-step association is based on **positional ordering** in the TOML file. If the TOML has `[[steps.rules]]` sections that are not contiguous with their parent `[[steps]]`, they will be associated with the wrong step or missed entirely. This is fragile but matches the serialization format.
  - **Line 365:** `stepSections.indexOf(sec) + 1 < stepSections.length` — correct boundary check for "is there a next step?"
  - **Lines 345-358:** Optional fields use `e['field'] !== undefined` checks, which is correct since `tokenizeSections` only adds keys that are present.

### Lines 384-405: Conflicts Parsing
```
const conflictSections = sections.filter(s => s.name === 'conflicts' && s.isArray);
const conflicts = [];
for (const sec of conflictSections) {
    ...
    resolutionOptions: parseTomlValue((_t = e['resolution_options']) !== null && _t !== void 0 ? _t : '[]'),
    ...
}
```

- **Status:** WORKING
- **Gap:**
  - **Line 398:** `parseTomlValue((_t = e['resolution_options']) !== null && _t !== void 0 ? _t : '[]')` — defaults to `'[]'` which `parseTomlValue` will parse as an empty array via `parseTomlArray`. Correct.
  - **Line 399:** `recommended` defaults to `'"rename"'` — this means a missing `recommended` field will silently default to `"rename"` strategy. Could mask configuration errors.

### Lines 406-417: Return Statement
```
return {
    id, timestamp, sourcePath, targetPath,
    outcome, estimatedComplexity, conflictCount,
    steps, conflicts
};
```

- **Status:** WORKING
- **Gap:** None — returns complete MigrationPlan object.

---

## 13. Source Map Reference

### Line 418: Source Map
```
//# sourceMappingURL=tomlSerializer.js.map
```

- **Status:** WORKING (if .map file exists alongside)

---

## CONNECTION MAP

### What Triggers Serialization?

| Trigger | Function Called | Caller Location |
|---------|---------------|-----------------|
| `integr8` command completes (non-dry-run) | `serializeMigrationPlanToToml()` | `lib/commands/integr8/index.js:104` |
| AI signal manifest generation | `serializeGraphMetadataToToml()` | `backend/manifestGenerator.js:106` |

### What Triggers Deserialization?

| Trigger | Function Called | Caller Location |
|---------|---------------|-----------------|
| `loadMigrationPlan()` called | `parseMigrationPlanFromToml()` | `lib/commands/integr8/migrationExecutor.js:67` |

### Data Flow

```
pathGenerator.js (generates plan)
    ↓
serializeMigrationPlanToToml() ← tomlSerializer.js
    ↓
migration_plan.toml (written to disk)
    ↓
loadMigrationPlan() ← migrationExecutor.js
    ↓
parseMigrationPlanFromToml() ← tomlSerializer.js
    ↓
executeMigrationPlan() ← migrationExecutor.js
```

### Dead/Disconnected Code

| Function/Variable | Location | Status |
|------------------|----------|--------|
| `getTomlSerializer()` | `backend/indexer.js:65-69` | **DEFINED BUT NEVER CALLED** from indexer |
| `ruleIdx` variable | `tomlSerializer.js:333` | **UNUSED** |
| `ruleSections` variable | `tomlSerializer.js:331` | **UNUSED** |

---

## @@@ SYMBOL HANDLING

**No `@@@` symbols found in `tomlSerializer.js`.**

The `@@@` pattern exists in other files:
- `backend/brunoOscar.js:173` — `<!-- @@@ Content from ... @@@ -->` (append marker)
- `backend/intentSeeder.js:187-188` — `@@@AI_REVIEW` pattern detection
- `backend/persistence.js:577` — `@@@ SYMBOL METHODS` section

These are unrelated to the TOML serializer.

---

## SUMMARY OF FINDINGS

### CRITICAL Issues (3)

1. **Schema mismatch in `serializeGraphMetadataToToml()`** (Lines 135-145): Called by `manifestGenerator.js` with manifest metadata but expects graph properties. Produces `undefined` values in TOML output.

2. **`serializeGraphMetadataToToml()` doesn't use `tomlValue()`** (Lines 138-140): Raw interpolation without quoting. If values are strings, output is invalid TOML.

3. **`tomlStringArray()` has no null guard** (Line 35): Will crash if `values` is `undefined` or `null`.

### MODERATE Issues (5)

4. **Escaped quote parsing bug** in `parseTomlArray()` (Line 236) and `parseInlineTable()` (Line 276): `\\"` followed by `"` incorrectly fails to toggle `inQuote`.

5. **`escapeTomlString()` missing control chars** (Lines 13-20): Doesn't escape `\b`, `\0`, or Unicode control characters per TOML spec.

6. **`tokenizeSections()` key regex too restrictive** (Line 174): Doesn't handle quoted keys or dotted keys.

7. **`tokenizeSections()` doesn't strip inline comments** (Line 174): `key = value # comment` captures the comment as part of the value.

8. **`serializeInlineTable()` key sanitization incomplete** (Line 118): Only replaces whitespace, not other non-bare-key characters.

### MINOR Issues (4)

9. **Dead variables** `ruleIdx` (Line 333) and `ruleSections` (Line 331).

10. **Hardcoded complexity validation** (Line 324): Local array instead of using types.

11. **`getTomlSerializer()` in indexer.js** (Line 65): Defined but never called.

12. **`tomlValue()` doesn't handle `null`/`undefined`** (Line 29): Produces `"null"` or `"undefined"` strings.
