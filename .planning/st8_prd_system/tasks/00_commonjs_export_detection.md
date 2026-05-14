# Task 00: Extend astParser.js with CommonJS Export Detection

**Phase:** 2
**Single Concern:** Add CommonJS export detection to AST parser
**Files to Modify:** `lib/utils/astParser.js`

---

## Specification Reference

**Gap Analysis:** D4 — Export Surface Gaps
**Research:** COMMONJS-PARSER-RESEARCH.md — Option B (AST-Based)

---

## Exact Implementation

### Step 1: Add new function after line ~230

```javascript
/**
 * Extract CommonJS exports from AST
 * Handles: module.exports = { ... }, module.exports = X, exports.foo = ...
 */
function extractCommonJSExportsFromAST(ast, content, filePath) {
    const exports = [];
    const seen = new Set();
    
    function walkNode(node) {
        if (!node || typeof node !== 'object') return;
        
        // module.exports = { ... }
        if (node.type === 'AssignmentExpression' &&
            node.left?.type === 'MemberExpression' &&
            node.left?.object?.name === 'module' &&
            node.left?.property?.name === 'exports') {
            
            if (node.right?.type === 'ObjectExpression') {
                for (const prop of node.right.properties) {
                    if (prop.key?.name && !seen.has(prop.key.name)) {
                        seen.add(prop.key.name);
                        exports.push({
                            name: prop.key.name,
                            kind: 'variable',
                            sourceFile: filePath,
                            line: node.loc?.start.line,
                            exportVisibility: 'named',
                        });
                    }
                }
            } else if (node.right?.type === 'Identifier' && !seen.has(node.right.name)) {
                seen.add(node.right.name);
                exports.push({
                    name: node.right.name,
                    kind: 'default',
                    sourceFile: filePath,
                    line: node.loc?.start.line,
                    exportVisibility: 'default',
                });
            }
        }
        
        // exports.foo = ...
        if (node.type === 'AssignmentExpression' &&
            node.left?.type === 'MemberExpression' &&
            node.left?.object?.name === 'exports' &&
            node.left?.property?.name &&
            !seen.has(node.left.property.name)) {
            seen.add(node.left.property.name);
            exports.push({
                name: node.left.property.name,
                kind: 'variable',
                sourceFile: filePath,
                line: node.loc?.start.line,
                exportVisibility: 'named',
            });
        }
        
        // Recurse
        for (const key of Object.keys(node)) {
            if (['loc', 'start', 'end', 'leadingComments', 'trailingComments'].includes(key)) continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && typeof item === 'object' && item.type) walkNode(item);
                }
            } else if (child && typeof child === 'object' && child.type) {
                walkNode(child);
            }
        }
    }
    
    walkNode(ast.program);
    return exports;
}
```

### Step 2: Integrate into main function

After line ~202 (after the existing export extraction loop), add:

```javascript
// CommonJS export detection
const commonjsExports = extractCommonJSExportsFromAST(ast, content, filePath);
result.exports.push(...commonjsExports);
```

---

## PARALLELIZATION

```
- Can start after: [nothing — first task]
- Can run parallel with: [nothing — must complete first]
- Must complete before: [01, 02, 03, 04, 05]
- Conflict risk: [lib/utils/astParser.js]
```

---

## Verification Steps

```bash
cd /home/bozertron/1_AT_A_TIME/st8

# 1. Syntax check
node -c lib/utils/astParser.js

# 2. Test CommonJS detection
node -e "
const { extractImportsAndExports } = require('./lib/utils/astParser');
const result = extractImportsAndExports('./backend/persistence.js');
console.log('Exports found:', result.exports.length);
console.log('Export names:', result.exports.map(e => e.name));
"
```

---

## Success Criteria

- [ ] `extractCommonJSExportsFromAST()` function added
- [ ] Function integrated into `extractImportsAndExports()`
- [ ] Detects `module.exports = { ... }` pattern
- [ ] Detects `module.exports = Identifier` pattern
- [ ] Detects `exports.foo = ...` pattern
- [ ] `node -c` passes (no syntax errors)
- [ ] Exports detected for CommonJS files like `persistence.js`

---

## Report Format

When complete, report:
```
TASK 00 COMPLETE
- Function added: extractCommonJSExportsFromAST()
- Integration point: line ~202 in extractImportsAndExports()
- Test results: [exports found count]
- Verification: PASS/FAIL
```

---

## Integration Report Requirements

The job isn't finished until:
1. Wiring is confirmed (function called in main extraction flow)
2. Error reporting is in place (try/catch around new code)
3. Report covers every integration point with filepaths and line-specific details
