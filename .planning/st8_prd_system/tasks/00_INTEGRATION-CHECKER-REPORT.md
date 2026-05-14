# Integration Checker Report: CommonJS Export Detection in astParser.js

**Status:** PASS (with fixes applied)
**Date:** 2026-05-13
**File Modified:** `lib/utils/astParser.js`

---

## Verification Summary

| Step | Status | Details |
|------|--------|---------|
| Function exists | ✅ PASS | `extractCommonJSExportsFromAST` at line 48 |
| Integration point exists | ✅ PASS | Lines 280-281 in `extractImportsAndExports()` |
| Real file: persistence.js | ✅ PASS | Found: `St8Persistence` |
| Real file: st8-types.js | ✅ PASS | Found 13 exports (types, validators, etc.) |
| Real file: server.js | ✅ PASS | Found: `St8Server` |
| Self-test: astParser.js | ✅ PASS | Found: `extractImportsAndExports`, `extractFromText` |
| Syntax check | ✅ PASS | `node -c` succeeded |

---

## Patterns Tested

| Pattern | Example | Before Fix | After Fix |
|---------|---------|------------|-----------|
| `module.exports = { ... }` | `module.exports = { foo, bar }` | ✅ PASS | ✅ PASS |
| `module.exports = identifier` | `module.exports = MyClass` | ✅ PASS | ✅ PASS |
| `exports.name = ...` | `exports.myFunction = function() {}` | ✅ PASS | ✅ PASS |
| Chained exports | `exports.a = exports.b = 'value'` | ✅ PASS | ✅ PASS |
| String literal keys in object | `module.exports = { 'key': 1 }` | ❌ **MISSED** | ✅ FIXED |
| `module.exports.fn = ...` | `module.exports.myMethod = function() {}` | ❌ **MISSED** | ✅ FIXED |
| `exports['computed'] = ...` | `exports['computed'] = 'val'` | ❌ **MISSED** | ✅ FIXED |
| `module.exports['computed'] = ...` | `module.exports['bracket'] = 'val'` | ❌ **MISSED** | ✅ FIXED |

---

## Issues Found and Fixed

### BUG-01: String literal keys not detected in `module.exports = { ... }`

**Severity:** WARNING
**Location:** `lib/utils/astParser.js:63` (original)

**Problem:** When `module.exports = { 'string-key': 1 }` is parsed, Babel produces a StringLiteral node for the key with `.value` property (not `.name`). The original code only checked `prop.key?.name`, missing all string literal keys.

**Fix:**
```javascript
// Before:
if (prop.key?.name && !seen.has(prop.key.name)) {
    seen.add(prop.key.name);
    exports.push({ name: prop.key.name, ... });

// After:
const propName = prop.key?.name || prop.key?.value;
if (propName && !seen.has(propName)) {
    seen.add(propName);
    exports.push({ name: propName, ... });
```

---

### BUG-02: `module.exports.fn = ...` pattern not detected

**Severity:** WARNING
**Location:** `lib/utils/astParser.js:87-100` (original)

**Problem:** The `exports.foo = ...` detection only matched when `node.left.object` was an Identifier named `'exports'`. For `module.exports.fn`, the object is a MemberExpression (`module.exports`), not an Identifier, so it was silently skipped.

**Fix:** Added a new detection block for `module.exports.fn = ...`:
```javascript
// module.exports.foo = ... (property assignment on module.exports)
if (node.type === 'AssignmentExpression' &&
    node.left?.type === 'MemberExpression' &&
    node.left?.object?.type === 'MemberExpression' &&
    node.left?.object?.object?.name === 'module' &&
    node.left?.object?.property?.name === 'exports') {
    const propKey = node.left?.property?.name || (node.left?.computed && node.left?.property?.value);
    if (propKey && !seen.has(propKey)) {
        // ... capture export
    }
}
```

---

### BUG-03: Computed property access not detected (`exports['key']`)

**Severity:** INFO
**Location:** `lib/utils/astParser.js:87-101` (original)

**Problem:** `exports['computed'] = 'val'` uses bracket notation. Babel sets `node.left.computed = true` and `node.left.property.type = 'StringLiteral'` with `.value` (not `.name`). The original code only checked `.name`.

**Fix:** Changed all property name extraction to also check computed string literal values:
```javascript
const propKey = node.left?.property?.name || (node.left?.computed && node.left?.property?.value);
```

---

## Final Verification Results

All 9 CommonJS export patterns now correctly detected:

```
All exports: [
  'foo',        // module.exports = { foo }
  'bar',        // module.exports = { bar }
  'MyClass',    // module.exports = MyClass
  'myFunction', // exports.myFunction = ...
  'a',          // exports.a = ...
  'b',          // exports.b = ...
  'myMethod',   // module.exports.myMethod = ...
  'myProp',     // module.exports.myProp = ...
  'computed',   // exports['computed'] = ...
  'bracket'     // module.exports['bracket'] = ...
]
```

Real project files confirmed working:
- `persistence.js` → 1 export (St8Persistence)
- `st8-types.js` → 13 exports (types, validators, utilities)
- `server.js` → 1 export (St8Server)
- `astParser.js` → 2 exports (extractImportsAndExports, extractFromText)

---

_Integration check completed: 2026-05-13_
_Checker: GSD-Integration-Checker_
