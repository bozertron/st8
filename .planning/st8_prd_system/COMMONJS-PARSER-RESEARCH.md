# CommonJS Export Detection Research

**Source:** maestro-scaffolder-tool codebase
**Date:** 2026-05-13
**Best Candidate:** `/home/bozertron/Software Projects/maestro-scaffolder-tool/src/utils/astParser.ts`

---

## File Overview

`astParser.ts` is a 1056-line AST-based import/export extraction module using `@babel/parser`. It's the canonical parser for the maestro integr8 system, used by `dataIngestion.ts` to build semantic graphs from JavaScript/TypeScript/Vue projects.

### Key Exported Functions

```typescript
// Main entry point — parses a real file on disk
export function extractImportsAndExports(filePath: string): ASTExtractionResult

// Text-only extraction (for parser report text that isn't a real file)
export function extractFromText(text: string, projectPath: string): {
  imports: ExtractedImport[];
  exports: ExtractedExport[];
}
```

### Return Types

```typescript
export interface ExtractedExport {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum' | 'const' | 'reexport' | 'default';
  signature?: string;
  returnType?: string;
  paramCount?: number;
  typeParams?: string[];
  sourceFile: string;
  line?: number;
  isReexport?: boolean;
  reexportSource?: string;
  reexportChain?: string[];
  originPath?: string;
  exportVisibility?: 'default' | 'named' | 'namespace' | 'star';
  paramTypes?: string[];
  isPure?: boolean;
  complexity?: { cyclomatic: number; cognitive: number; linesOfCode: number };
  jsdocTags?: { name: string; value?: string }[];
}

export interface ASTExtractionResult {
  imports: ExtractedImport[];
  exports: ExtractedExport[];
  exportStars: ExportStarEntry[];
  hasErrors: boolean;
  errorMessage?: string;
}
```

---

## What It Currently Handles

### ES6 Exports (AST path — lines 188-223)

| Pattern | Handled | Method |
|---------|---------|--------|
| `export function foo()` | ✅ | AST `ExportNamedDeclaration` + `FunctionDeclaration` |
| `export class Foo` | ✅ | AST `ExportNamedDeclaration` + `ClassDeclaration` |
| `export const x = ...` | ✅ | AST `ExportNamedDeclaration` + `VariableDeclaration` |
| `export type Foo = ...` | ✅ | AST `ExportNamedDeclaration` + `TSTypeAliasDeclaration` |
| `export interface Foo` | ✅ | AST `ExportNamedDeclaration` + `TSInterfaceDeclaration` |
| `export enum Foo` | ✅ | AST `ExportNamedDeclaration` + `TSEnumDeclaration` |
| `export default function` | ✅ | AST `ExportDefaultDeclaration` |
| `export default class` | ✅ | AST `ExportDefaultDeclaration` |
| `export { x } from './y'` | ✅ | AST `ExportNamedDeclaration` with `source` + chain tracking |
| `export * from './module'` | ✅ | AST `ExportAllDeclaration` + recursive resolution |
| `export =` (TS) | ✅ | AST `TSExportAssignment` |

### ES6 Exports (Regex fallback — lines 688-713)

```typescript
function extractExportsViaRegex(content: string, filePath: string): ExtractedExport[] {
  // Matches: export function/class/const/let/var/type/interface/enum NAME
  const exportRegex = /export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(function|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  
  // Matches: export default
  const defaultRegex = /export\s+default\s+/g;
}
```

### CommonJS Imports (lines 639-653)

```typescript
function extractRequireStatements(content: string): ExtractedImport[] {
  // Matches: const { x } = require('path') or const x = require('path')
  const requireRegex = /(?:const|let|var)\s+(?:\{[^}]+\}|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
}
```

---

## What It DOES NOT Handle (The Gap)

### CommonJS Export Patterns — MISSING

| Pattern | Example | Status |
|---------|---------|--------|
| Object destructuring | `module.exports = { foo, bar, baz }` | ❌ NOT DETECTED |
| Single export | `module.exports = ClassName` | ❌ NOT DETECTED |
| Named exports | `exports.foo = function() {}` | ❌ NOT DETECTED |
| Chained exports | `exports.foo = exports.bar = ...` | ❌ NOT DETECTED |
| Default + named | `module.exports.default = function run() {}` | ❌ NOT DETECTED |
| Mixed | `module.exports = { run }; module.exports.default = run` | ❌ NOT DETECTED |
| CJS export with require | `module.exports.x = require('y')` | ❌ NOT DETECTED |

### Evidence from Codebase

The gap is explicitly documented in `gap-analysis/research/task93-integr8-sota-plan.md` (line 353):

> **SOTA Gap:**
> 3. **No module.exports.x = require() pattern** — CommonJS export pattern not recognized

And the solution plan (line 361):

> - Support CommonJS export assignment: `module.exports.x = require('y')`

### Real-World Examples Found in Codebase

From `.archive/gap-analysis/test-results/test-edge-cases-df.js`:

```javascript
// Pattern 1: Single function export
module.exports = function init() {
  throw new Error('initHook deliberate failure for testing');
};
module.exports.default = module.exports;

// Pattern 2: Default export with named alias
module.exports.default = function run(data) { return { ...data, ran: true }; };
module.exports.run = module.exports.default;

// Pattern 3: Same pattern in plugin execution
module.exports.default = function run(data) {
  throw new Error('Plugin execution deliberate crash');
};
module.exports.run = module.exports.default;
```

From `src/commands/integr8handler.ts`:

```typescript
// Pattern 4: Object destructuring export
module.exports = { runIntegr8Command };
```

From `.archive/compiled-workspace/Compiled/prd src/commandParser.js`:

```javascript
// Pattern 5: TypeScript-compiled chained named exports
exports.specificOptions = exports.supportsCompare = exports.description = exports.commandType = void 0;
exports.analyzeDataFunction = analyzeCommandData;
exports.formatReportFunction = formatCommandReport;
exports.commandType = 'commands';
exports.description = 'Analyzes Tauri commands...';
exports.supportsCompare = true;
exports.specificOptions = { ... };
```

---

## How to Extend for CommonJS Detection

### Option A: Add to Regex Fallback (Quick Win)

Add to `extractExportsViaRegex()`:

```typescript
// CommonJS: module.exports = { ... }
const moduleExportsObjectRegex = /module\.exports\s*=\s*\{([^}]+)\}/g;
while ((match = moduleExportsObjectRegex.exec(content)) !== null) {
  const names = match[1].split(',').map(s => s.trim().split(/[\s:]/)[0]).filter(Boolean);
  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name);
      exports.push({ name, kind: 'variable', sourceFile: filePath });
    }
  }
}

// CommonJS: module.exports = Identifier
const moduleExportsSingleRegex = /module\.exports\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*;/g;
while ((match = moduleExportsSingleRegex.exec(content)) !== null) {
  const name = match[1];
  if (!seen.has(name)) {
    seen.add(name);
    exports.push({ name, kind: 'default', sourceFile: filePath });
  }
}

// CommonJS: exports.foo = ...
const exportsNamedRegex = /exports\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;
while ((match = exportsNamedRegex.exec(content)) !== null) {
  const name = match[1];
  if (!seen.has(name)) {
    seen.add(name);
    exports.push({ name, kind: 'variable', sourceFile: filePath });
  }
}
```

### Option B: AST-Based Detection (Recommended)

Add a new AST walker after the main loop (around line 230):

```typescript
// CommonJS export detection via AST
const commonjsExports = extractCommonJSExportsFromAST(ast, content, filePath);
result.exports.push(...commonjsExports);
```

With implementation:

```typescript
function extractCommonJSExportsFromAST(ast: any, content: string, filePath: string): ExtractedExport[] {
  const exports: ExtractedExport[] = [];
  
  function walkNode(node: any): void {
    if (!node || typeof node !== 'object') return;
    
    // module.exports = { ... }
    if (node.type === 'AssignmentExpression' &&
        node.left?.type === 'MemberExpression' &&
        node.left?.object?.name === 'module' &&
        node.left?.property?.name === 'exports') {
      
      if (node.right?.type === 'ObjectExpression') {
        for (const prop of node.right.properties) {
          if (prop.key?.name) {
            exports.push({
              name: prop.key.name,
              kind: 'variable',
              sourceFile: filePath,
              line: node.loc?.start.line,
              exportVisibility: 'named',
            });
          }
        }
      } else if (node.right?.type === 'Identifier') {
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
        node.left?.property?.name) {
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

---

## Integration Points for st8

### 1. Gap Analysis Engine
- Use `extractImportsAndExports()` to build dependency graphs
- Use `extractFromText()` for parser report text analysis
- The `ExtractedExport.kind` field maps directly to gap categories

### 2. Intent Seeder
- `exportVisibility` field ('default', 'named', 'namespace', 'star') seeds intent classification
- `isReexport` + `reexportChain` trace intent through barrel files
- `isPure` heuristic detects side-effect-free exports

### 3. Schema Card Emitter
- `signature`, `returnType`, `paramTypes`, `typeParams` provide function schema data
- `jsdocTags` extract documentation metadata
- `complexity` metrics (cyclomatic, cognitive, LOC) feed quality cards

### 4. Connection Graph Building
- `ASTExtractionResult.exportStars` tracks `export *` relationships
- `reexportChain` traces multi-hop re-exports to origin
- `dataIngestion.ts` shows full graph-building pattern (nodes + edges)

### Dependencies
- `@babel/parser` — AST parsing
- `fs`, `path` — file system access (Node.js built-ins)

---

## Summary

**Best file:** `src/utils/astParser.ts` (1056 lines, well-structured, TypeScript)

**Current CommonJS coverage:** Imports only (`require()` detection via regex). Exports: **NONE**.

**Gap:** All four target patterns are undetected:
- `module.exports = { ... }` — object destructuring
- `module.exports = ClassName` — single export  
- `exports.foo = function() {}` — named exports
- `exports.foo = exports.bar = ...` — chained exports

**Recommended approach:** Add AST-based CommonJS export detection (Option B) alongside the existing ES6 export detection. The regex fallback (Option A) provides a safety net when AST parsing fails.

**Reusable patterns:** The existing `walkNode()` recursive AST traversal pattern (used for dynamic imports at line 552) is directly applicable to CommonJS detection.
