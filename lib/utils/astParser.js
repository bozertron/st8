"use strict";
// src/utils/astParser.ts
// AST-based import/export extraction using @babel/parser
// Fixes: I-02, I-03, I-10, I-12
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractImportsAndExports = extractImportsAndExports;
exports.extractFromText = extractFromText;
const parser_1 = require("@babel/parser");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
                    const propName = prop.key?.name || prop.key?.value;
                    if (propName && !seen.has(propName)) {
                        seen.add(propName);
                        exports.push({
                            name: propName,
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
        
        // exports.foo = ... (including exports['foo'] = ...)
        if (node.type === 'AssignmentExpression' &&
            node.left?.type === 'MemberExpression' &&
            node.left?.object?.name === 'exports') {
            const propKey = node.left?.property?.name || (node.left?.computed && node.left?.property?.value);
            if (propKey && !seen.has(propKey)) {
                seen.add(propKey);
                exports.push({
                    name: propKey,
                    kind: 'variable',
                    sourceFile: filePath,
                    line: node.loc?.start.line,
                    exportVisibility: 'named',
                });
            }
        }
        
        // module.exports.foo = ... (property assignment on module.exports)
        if (node.type === 'AssignmentExpression' &&
            node.left?.type === 'MemberExpression' &&
            node.left?.object?.type === 'MemberExpression' &&
            node.left?.object?.object?.name === 'module' &&
            node.left?.object?.property?.name === 'exports') {
            const propKey = node.left?.property?.name || (node.left?.computed && node.left?.property?.value);
            if (propKey && !seen.has(propKey)) {
                seen.add(propKey);
                exports.push({
                    name: propKey,
                    kind: 'variable',
                    sourceFile: filePath,
                    line: node.loc?.start.line,
                    exportVisibility: 'named',
                });
            }
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

// ============ MAIN EXTRACTION ============
/**
 * Extracts imports and exports from a TypeScript/JavaScript/Vue file using AST parsing.
 * Falls back to regex if AST parsing fails.
 * I-02 Enhanced: export star merging, Vue SFC support, re-export chain tracking, dynamic imports.
 */
function extractImportsAndExports(filePath) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const result = {
        imports: [],
        exports: [],
        exportStars: [],
        hasErrors: false,
    };
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    }
    catch (err) {
        return { imports: [], exports: [], exportStars: [], hasErrors: true, errorMessage: `Cannot read file: ${err.message}` };
    }
    // For .vue files, extract the <script> block (I-02: enhanced Vue SFC support)
    if (filePath.endsWith('.vue')) {
        content = extractScriptFromVue(content);
    }
    try {
        const ast = (0, parser_1.parse)(content, {
            sourceType: 'module',
            plugins: [
                'typescript',
                'jsx',
                'decorators-legacy',
                'classProperties',
                'optionalChaining',
                'nullishCoalescingOperator',
                'dynamicImport',
            ],
            errorRecovery: true,
        });
        // Extract imports
        for (const node of ast.program.body) {
            if (node.type === 'ImportDeclaration') {
                const imp = parseImportDeclaration(node);
                if (imp)
                    result.imports.push(imp);
            }
            // I-02: export * from './module' — export star merging
            if (node.type === 'ExportAllDeclaration' && node.source) {
                const starSource = node.source.value;
                const starEntry = {
                    source: starSource,
                    line: (_a = node.loc) === null || _a === void 0 ? void 0 : _a.start.line,
                };
                // Attempt to resolve the actual exports from the target module
                const resolvedPath = resolveModulePath(filePath, starSource);
                if (resolvedPath) {
                    const resolvedExports = resolveExportStar(resolvedPath);
                    starEntry.resolvedExports = resolvedExports;
                    // Create individual export entries for each resolved export
                    for (const expName of resolvedExports) {
                        result.exports.push({
                            name: expName,
                            kind: 'reexport',
                            sourceFile: filePath,
                            line: (_b = node.loc) === null || _b === void 0 ? void 0 : _b.start.line,
                            isReexport: true,
                            reexportSource: starSource,
                            originPath: resolvedPath,
                            exportVisibility: 'star',
                        });
                    }
                }
                result.exportStars.push(starEntry);
                // Also track as an import dependency
                result.imports.push({
                    source: starSource,
                    specifiers: [],
                    importType: 'namespace',
                    line: (_c = node.loc) === null || _c === void 0 ? void 0 : _c.start.line,
                });
            }
            // Re-exports: export { x } from './y' — I-02: with chain tracking
            if (node.type === 'ExportNamedDeclaration' && node.source) {
                const reexportSource = node.source.value;
                const reexportImport = {
                    source: reexportSource,
                    specifiers: (node.specifiers || []).map((s) => {
                        var _a, _b, _c, _d, _e;
                        return ({
                            name: ((_a = s.exported) === null || _a === void 0 ? void 0 : _a.name) || ((_b = s.local) === null || _b === void 0 ? void 0 : _b.name) || 'unknown',
                            alias: ((_c = s.exported) === null || _c === void 0 ? void 0 : _c.name) !== ((_d = s.local) === null || _d === void 0 ? void 0 : _d.name) ? (_e = s.local) === null || _e === void 0 ? void 0 : _e.name : undefined,
                        });
                    }),
                    importType: 'named',
                    line: (_d = node.loc) === null || _d === void 0 ? void 0 : _d.start.line,
                };
                result.imports.push(reexportImport);
                // Create export entries with re-export chain tracking
                for (const spec of node.specifiers || []) {
                    const exportedName = ((_e = spec.exported) === null || _e === void 0 ? void 0 : _e.name) || ((_f = spec.local) === null || _f === void 0 ? void 0 : _f.name) || 'unknown';
                    const localName = ((_g = spec.local) === null || _g === void 0 ? void 0 : _g.name) || exportedName;
                    // I-02: Trace re-export chain back to origin
                    const resolvedPath = resolveModulePath(filePath, reexportSource);
                    const chain = resolvedPath
                        ? traceReexportChain(resolvedPath, localName)
                        : [reexportSource];
                    result.exports.push({
                        name: exportedName,
                        kind: 'reexport',
                        sourceFile: filePath,
                        line: (_h = node.loc) === null || _h === void 0 ? void 0 : _h.start.line,
                        isReexport: true,
                        reexportSource,
                        reexportChain: chain,
                        originPath: chain.length > 0 ? chain[chain.length - 1] : reexportSource,
                        exportVisibility: 'named',
                    });
                }
            }
            // Named exports: export function/class/const/type/interface/enum
            if (node.type === 'ExportNamedDeclaration' && node.declaration) {
                const exports = parseExportDeclaration(node.declaration, filePath, (_j = node.loc) === null || _j === void 0 ? void 0 : _j.start.line, content);
                result.exports.push(...exports);
            }
            // Named exports without declaration: export { a, b }
            if (node.type === 'ExportNamedDeclaration' && !node.declaration && !node.source) {
                for (const spec of node.specifiers || []) {
                    result.exports.push({
                        name: ((_k = spec.exported) === null || _k === void 0 ? void 0 : _k.name) || ((_l = spec.local) === null || _l === void 0 ? void 0 : _l.name) || 'unknown',
                        kind: 'variable',
                        sourceFile: filePath,
                        line: (_m = node.loc) === null || _m === void 0 ? void 0 : _m.start.line,
                        exportVisibility: 'named',
                    });
                }
            }
            // Default export
            if (node.type === 'ExportDefaultDeclaration') {
                const exp = parseDefaultExport(node, filePath, content);
                if (exp)
                    result.exports.push(exp);
            }
            // export = (TS)
            if (node.type === 'TSExportAssignment') {
                result.exports.push({
                    name: 'default',
                    kind: 'default',
                    sourceFile: filePath,
                    line: (_o = node.loc) === null || _o === void 0 ? void 0 : _o.start.line,
                    exportVisibility: 'default',
                });
            }
        }
        // I-02: Find dynamic imports in the AST (creates DYNAMIC_IMPORT edges)
        const dynamicImports = extractDynamicImportsFromAST(ast, content);
        result.imports.push(...dynamicImports);
        // Find require() calls via regex
        const requireImports = extractRequireStatements(content);
        result.imports.push(...requireImports);
        // CommonJS export detection
        const commonjsExports = extractCommonJSExportsFromAST(ast, content, filePath);
        result.exports.push(...commonjsExports);
    }
    catch (err) {
        // AST parsing failed — fall back to regex extraction
        result.hasErrors = true;
        result.errorMessage = `AST parse error: ${err.message}`;
        result.imports = extractImportsViaRegex(content);
        result.exports = extractExportsViaRegex(content, filePath);
    }
    return result;
}
/**
 * Extract from raw text content (for parser report text that isn't a real file).
 * Uses enhanced regex patterns covering more import/export varieties.
 */
function extractFromText(text, projectPath) {
    return {
        imports: extractImportsViaRegex(text),
        exports: extractExportsViaRegex(text, projectPath),
    };
}
// ============ AST PARSE HELPERS ============
function parseImportDeclaration(node) {
    var _a, _b, _c, _d;
    const source = (_a = node.source) === null || _a === void 0 ? void 0 : _a.value;
    if (!source)
        return null;
    const specifiers = [];
    let importType = 'named';
    if (!node.specifiers || node.specifiers.length === 0) {
        importType = 'side-effect';
    }
    else {
        for (const spec of node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
                importType = 'default';
                specifiers.push({ name: spec.local.name, isType: node.importKind === 'type' });
            }
            else if (spec.type === 'ImportNamespaceSpecifier') {
                importType = 'namespace';
                specifiers.push({ name: spec.local.name, isType: node.importKind === 'type' });
            }
            else if (spec.type === 'ImportSpecifier') {
                specifiers.push({
                    name: ((_b = spec.imported) === null || _b === void 0 ? void 0 : _b.name) || spec.local.name,
                    alias: spec.local.name !== (((_c = spec.imported) === null || _c === void 0 ? void 0 : _c.name) || spec.local.name) ? spec.local.name : undefined,
                    isType: spec.importKind === 'type' || node.importKind === 'type',
                });
                if (importType !== 'default' && importType !== 'namespace') {
                    importType = 'named';
                }
            }
        }
    }
    return { source, specifiers, importType, line: (_d = node.loc) === null || _d === void 0 ? void 0 : _d.start.line };
}
function parseExportDeclaration(declaration, filePath, line, sourceContent) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const exports = [];
    switch (declaration.type) {
        case 'FunctionDeclaration':
        case 'TSDeclareFunction':
            if ((_a = declaration.id) === null || _a === void 0 ? void 0 : _a.name) {
                const paramTypes = extractParamTypes(declaration);
                const complexity = sourceContent
                    ? computeComplexity(declaration, sourceContent)
                    : undefined;
                const isPure = detectPurity(declaration);
                const jsdocTags = extractJsDocTags(declaration, sourceContent);
                exports.push({
                    name: declaration.id.name,
                    kind: 'function',
                    signature: buildFunctionSignature(declaration),
                    returnType: extractReturnType(declaration),
                    paramCount: ((_b = declaration.params) === null || _b === void 0 ? void 0 : _b.length) || 0,
                    typeParams: extractTypeParams(declaration),
                    sourceFile: filePath,
                    line,
                    paramTypes,
                    isPure,
                    complexity,
                    jsdocTags,
                    exportVisibility: 'named',
                });
            }
            break;
        case 'ClassDeclaration':
            if ((_c = declaration.id) === null || _c === void 0 ? void 0 : _c.name) {
                const jsdocTags = extractJsDocTags(declaration, sourceContent);
                exports.push({
                    name: declaration.id.name,
                    kind: 'class',
                    sourceFile: filePath,
                    line,
                    jsdocTags,
                    exportVisibility: 'named',
                });
            }
            break;
        case 'VariableDeclaration':
            for (const decl of declaration.declarations || []) {
                if ((_d = decl.id) === null || _d === void 0 ? void 0 : _d.name) {
                    const isConst = declaration.kind === 'const';
                    // Check if it's an arrow function
                    if (((_e = decl.init) === null || _e === void 0 ? void 0 : _e.type) === 'ArrowFunctionExpression' || ((_f = decl.init) === null || _f === void 0 ? void 0 : _f.type) === 'FunctionExpression') {
                        const paramTypes = extractParamTypes(decl.init);
                        const complexity = sourceContent
                            ? computeComplexity(decl.init, sourceContent)
                            : undefined;
                        const isPure = detectPurity(decl.init);
                        const jsdocTags = extractJsDocTags(decl, sourceContent);
                        exports.push({
                            name: decl.id.name,
                            kind: 'function',
                            signature: buildArrowSignature(decl),
                            returnType: extractReturnType(decl.init),
                            paramCount: ((_g = decl.init.params) === null || _g === void 0 ? void 0 : _g.length) || 0,
                            typeParams: extractTypeParams(decl.init),
                            sourceFile: filePath,
                            line,
                            paramTypes,
                            isPure,
                            complexity,
                            jsdocTags,
                            exportVisibility: 'named',
                        });
                    }
                    else {
                        const jsdocTags = extractJsDocTags(decl, sourceContent);
                        exports.push({
                            name: decl.id.name,
                            kind: isConst ? 'const' : 'variable',
                            sourceFile: filePath,
                            line,
                            jsdocTags,
                            exportVisibility: 'named',
                        });
                    }
                }
            }
            break;
        case 'TSTypeAliasDeclaration':
            if ((_h = declaration.id) === null || _h === void 0 ? void 0 : _h.name) {
                exports.push({
                    name: declaration.id.name,
                    kind: 'type',
                    typeParams: extractTypeParams(declaration),
                    sourceFile: filePath,
                    line,
                    exportVisibility: 'named',
                });
            }
            break;
        case 'TSInterfaceDeclaration':
            if ((_j = declaration.id) === null || _j === void 0 ? void 0 : _j.name) {
                exports.push({
                    name: declaration.id.name,
                    kind: 'interface',
                    typeParams: extractTypeParams(declaration),
                    sourceFile: filePath,
                    line,
                    exportVisibility: 'named',
                });
            }
            break;
        case 'TSEnumDeclaration':
            if ((_k = declaration.id) === null || _k === void 0 ? void 0 : _k.name) {
                exports.push({
                    name: declaration.id.name,
                    kind: 'enum',
                    sourceFile: filePath,
                    line,
                    exportVisibility: 'named',
                });
            }
            break;
    }
    return exports;
}
function parseDefaultExport(node, filePath, sourceContent) {
    var _a, _b, _c, _d, _e, _f;
    const decl = node.declaration;
    if (!decl)
        return null;
    if (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression') {
        const paramTypes = extractParamTypes(decl);
        const complexity = sourceContent ? computeComplexity(decl, sourceContent) : undefined;
        const isPure = detectPurity(decl);
        return {
            name: ((_a = decl.id) === null || _a === void 0 ? void 0 : _a.name) || 'default',
            kind: 'default',
            signature: buildFunctionSignature(decl),
            returnType: extractReturnType(decl),
            paramCount: ((_b = decl.params) === null || _b === void 0 ? void 0 : _b.length) || 0,
            sourceFile: filePath,
            line: (_c = node.loc) === null || _c === void 0 ? void 0 : _c.start.line,
            paramTypes,
            isPure,
            complexity,
            exportVisibility: 'default',
        };
    }
    if (decl.type === 'ClassDeclaration') {
        return {
            name: ((_d = decl.id) === null || _d === void 0 ? void 0 : _d.name) || 'default',
            kind: 'default',
            sourceFile: filePath,
            line: (_e = node.loc) === null || _e === void 0 ? void 0 : _e.start.line,
            exportVisibility: 'default',
        };
    }
    return {
        name: 'default',
        kind: 'default',
        sourceFile: filePath,
        line: (_f = node.loc) === null || _f === void 0 ? void 0 : _f.start.line,
        exportVisibility: 'default',
    };
}
// ============ SIGNATURE BUILDERS ============
function buildFunctionSignature(node) {
    var _a;
    const name = ((_a = node.id) === null || _a === void 0 ? void 0 : _a.name) || 'anonymous';
    const params = (node.params || []).map((p) => paramToString(p)).join(', ');
    const ret = extractReturnType(node);
    return `${name}(${params})${ret ? ': ' + ret : ''}`;
}
function buildArrowSignature(decl) {
    var _a;
    const name = ((_a = decl.id) === null || _a === void 0 ? void 0 : _a.name) || 'anonymous';
    const init = decl.init;
    if (!init)
        return `${name}()`;
    const params = (init.params || []).map((p) => paramToString(p)).join(', ');
    const ret = extractReturnType(init);
    return `${name}(${params})${ret ? ': ' + ret : ''}`;
}
function paramToString(param) {
    var _a;
    if (param.type === 'Identifier') {
        const typeAnnotation = (_a = param.typeAnnotation) === null || _a === void 0 ? void 0 : _a.typeAnnotation;
        const typeName = typeAnnotation ? typeAnnotationToString(typeAnnotation) : 'any';
        return `${param.name}: ${typeName}`;
    }
    if (param.type === 'AssignmentPattern') {
        return paramToString(param.left) + '?';
    }
    if (param.type === 'RestElement') {
        return `...${paramToString(param.argument)}`;
    }
    if (param.type === 'ObjectPattern') {
        return '{ ... }';
    }
    if (param.type === 'ArrayPattern') {
        return '[ ... ]';
    }
    return 'unknown';
}
function typeAnnotationToString(node) {
    var _a;
    if (!node)
        return 'any';
    switch (node.type) {
        case 'TSStringKeyword': return 'string';
        case 'TSNumberKeyword': return 'number';
        case 'TSBooleanKeyword': return 'boolean';
        case 'TSVoidKeyword': return 'void';
        case 'TSAnyKeyword': return 'any';
        case 'TSNullKeyword': return 'null';
        case 'TSUndefinedKeyword': return 'undefined';
        case 'TSNeverKeyword': return 'never';
        case 'TSObjectKeyword': return 'object';
        case 'TSUnknownKeyword': return 'unknown';
        case 'TSTypeReference':
            return ((_a = node.typeName) === null || _a === void 0 ? void 0 : _a.name) || 'unknown';
        case 'TSArrayType':
            return `${typeAnnotationToString(node.elementType)}[]`;
        case 'TSUnionType':
            return (node.types || []).map((t) => typeAnnotationToString(t)).join(' | ');
        case 'TSFunctionType':
            return 'Function';
        default:
            return 'unknown';
    }
}
function extractReturnType(node) {
    var _a;
    const annotation = (_a = node === null || node === void 0 ? void 0 : node.returnType) === null || _a === void 0 ? void 0 : _a.typeAnnotation;
    if (!annotation)
        return undefined;
    return typeAnnotationToString(annotation);
}
function extractTypeParams(node) {
    var _a;
    const params = (_a = node === null || node === void 0 ? void 0 : node.typeParameters) === null || _a === void 0 ? void 0 : _a.params;
    if (!params || params.length === 0)
        return undefined;
    return params.map((p) => p.name || 'T');
}
// ============ REGEX FALLBACKS ============
/**
 * I-02: Extract dynamic imports from AST traversal (not just regex).
 * Walks the AST to find CallExpression nodes with callee type 'Import'.
 */
function extractDynamicImportsFromAST(ast, content) {
    const imports = [];
    const seen = new Set();
    function walkNode(node) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!node || typeof node !== 'object')
            return;
        // Detect import() call expressions
        if (node.type === 'CallExpression' && ((_a = node.callee) === null || _a === void 0 ? void 0 : _a.type) === 'Import') {
            const arg = (_b = node.arguments) === null || _b === void 0 ? void 0 : _b[0];
            if ((arg === null || arg === void 0 ? void 0 : arg.type) === 'StringLiteral' && !seen.has(arg.value)) {
                seen.add(arg.value);
                imports.push({
                    source: arg.value,
                    specifiers: [],
                    importType: 'dynamic',
                    isDynamic: true,
                    line: (_c = node.loc) === null || _c === void 0 ? void 0 : _c.start.line,
                });
            }
            else if ((arg === null || arg === void 0 ? void 0 : arg.type) === 'TemplateLiteral' && ((_d = arg.quasis) === null || _d === void 0 ? void 0 : _d.length) === 1) {
                // Template literal with no expressions: import(`./file`)
                const value = (_f = (_e = arg.quasis[0]) === null || _e === void 0 ? void 0 : _e.value) === null || _f === void 0 ? void 0 : _f.cooked;
                if (value && !seen.has(value)) {
                    seen.add(value);
                    imports.push({
                        source: value,
                        specifiers: [],
                        importType: 'dynamic',
                        isDynamic: true,
                        line: (_g = node.loc) === null || _g === void 0 ? void 0 : _g.start.line,
                    });
                }
            }
        }
        // Recurse into child nodes
        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments' || key === 'trailingComments')
                continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && typeof item === 'object' && item.type) {
                        walkNode(item);
                    }
                }
            }
            else if (child && typeof child === 'object' && child.type) {
                walkNode(child);
            }
        }
    }
    walkNode(ast.program);
    // Also catch any dynamic imports missed by AST traversal (regex fallback)
    const dynamicRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = dynamicRegex.exec(content)) !== null) {
        if (!seen.has(match[1])) {
            seen.add(match[1]);
            imports.push({
                source: match[1],
                specifiers: [],
                importType: 'dynamic',
                isDynamic: true,
            });
        }
    }
    return imports;
}
/**
 * Simple regex-based dynamic import extraction (used as fallback).
 */
function extractDynamicImportsViaRegex(content) {
    const imports = [];
    const dynamicRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = dynamicRegex.exec(content)) !== null) {
        imports.push({
            source: match[1],
            specifiers: [],
            importType: 'dynamic',
            isDynamic: true,
        });
    }
    return imports;
}
function extractRequireStatements(content) {
    const imports = [];
    const requireRegex = /(?:const|let|var)\s+(?:\{[^}]+\}|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
        imports.push({
            source: match[1],
            specifiers: [],
            importType: 'require',
        });
    }
    return imports;
}
function extractImportsViaRegex(content) {
    const imports = [];
    const seen = new Set();
    // Standard imports: import ... from 'path'
    const importFromRegex = /import\s+(?:(?:type\s+)?(?:\{[^}]*\}|[a-zA-Z_$][a-zA-Z0-9_$]*|\*\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*,\s*(?:\{[^}]*\}|[a-zA-Z_$][a-zA-Z0-9_$]*|\*\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*))*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importFromRegex.exec(content)) !== null) {
        const source = match[1];
        if (seen.has(source))
            continue;
        seen.add(source);
        imports.push({ source, specifiers: [], importType: 'named' });
    }
    // Dynamic imports
    imports.push(...extractDynamicImportsViaRegex(content));
    // Require statements
    imports.push(...extractRequireStatements(content));
    // Re-exports: export { ... } from 'path'
    const reexportRegex = /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = reexportRegex.exec(content)) !== null) {
        const source = match[1];
        if (seen.has(source))
            continue;
        seen.add(source);
        imports.push({ source, specifiers: [], importType: 'named' });
    }
    return imports;
}
function extractExportsViaRegex(content, filePath) {
    const exports = [];
    const seen = new Set();
    // export function/class/const/let/var/type/interface/enum
    const exportRegex = /export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(function|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
        const kind = match[1];
        const name = match[2];
        if (seen.has(name))
            continue;
        seen.add(name);
        exports.push({ name, kind, sourceFile: filePath });
    }
    // export default
    const defaultRegex = /export\s+default\s+/g;
    if (defaultRegex.test(content)) {
        if (!seen.has('default')) {
            exports.push({ name: 'default', kind: 'default', sourceFile: filePath });
        }
    }
    return exports;
}
// ============ VUE HELPERS (I-02 ENHANCED) ============
/**
 * I-02: Enhanced Vue SFC support.
 * Parses both <script> and <script setup> blocks.
 * Combines content from both if present.
 */
function extractScriptFromVue(content) {
    const scripts = [];
    // Match <script setup ...> blocks (higher priority)
    const scriptSetupMatch = content.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
    if (scriptSetupMatch) {
        scripts.push(scriptSetupMatch[1]);
    }
    // Match regular <script ...> blocks
    const scriptRegex = /<script(?!\s+setup)[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
        scripts.push(match[1]);
    }
    if (scripts.length > 0) {
        return scripts.join('\n');
    }
    return content;
}
// ============ I-02: EXPORT STAR RESOLUTION ============
/**
 * Resolves a module path relative to the importing file.
 * Tries common extensions: .ts, .tsx, .js, .jsx, /index.ts, /index.js
 */
function resolveModulePath(importerPath, modulePath) {
    // Only resolve relative paths
    if (!modulePath.startsWith('.'))
        return undefined;
    const dir = path.dirname(importerPath);
    const basePath = path.resolve(dir, modulePath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '/index.ts', '/index.js', '/index.tsx'];
    // Check if exact path exists
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        return basePath;
    }
    // Try extensions
    for (const ext of extensions) {
        const fullPath = basePath + ext;
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return undefined;
}
/**
 * I-02: Resolves export * from a module by parsing it and extracting its export names.
 * Handles up to 3 levels of re-export depth to prevent infinite recursion.
 */
function resolveExportStar(filePath, depth = 0) {
    var _a, _b, _c, _d;
    if (depth > 3)
        return []; // prevent infinite recursion
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        let scriptContent = content;
        if (filePath.endsWith('.vue')) {
            scriptContent = extractScriptFromVue(content);
        }
        const ast = (0, parser_1.parse)(scriptContent, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'dynamicImport'],
            errorRecovery: true,
        });
        const exportNames = [];
        for (const node of ast.program.body) {
            // Named exports
            if (node.type === 'ExportNamedDeclaration') {
                if (node.declaration) {
                    const decl = node.declaration;
                    if ((_a = decl.id) === null || _a === void 0 ? void 0 : _a.name) {
                        exportNames.push(decl.id.name);
                    }
                    else if (decl.declarations) {
                        for (const d of decl.declarations) {
                            if ((_b = d.id) === null || _b === void 0 ? void 0 : _b.name)
                                exportNames.push(d.id.name);
                        }
                    }
                }
                if (!node.source && node.specifiers) {
                    for (const spec of node.specifiers) {
                        const name = (_c = spec.exported) === null || _c === void 0 ? void 0 : _c.name;
                        if (name)
                            exportNames.push(name);
                    }
                }
                // Re-exports from another module
                if (node.source && node.specifiers) {
                    for (const spec of node.specifiers) {
                        const name = (_d = spec.exported) === null || _d === void 0 ? void 0 : _d.name;
                        if (name)
                            exportNames.push(name);
                    }
                }
            }
            // Default export
            if (node.type === 'ExportDefaultDeclaration') {
                exportNames.push('default');
            }
            // Recursive export * resolution
            if (node.type === 'ExportAllDeclaration' && node.source) {
                const nestedPath = resolveModulePath(filePath, node.source.value);
                if (nestedPath) {
                    const nestedExports = resolveExportStar(nestedPath, depth + 1);
                    exportNames.push(...nestedExports);
                }
            }
        }
        return [...new Set(exportNames)];
    }
    catch (_e) {
        return [];
    }
}
/**
 * I-02: Traces the re-export chain for a specific export name back to its origin.
 * Returns the chain of file paths traversed.
 */
function traceReexportChain(filePath, exportName, depth = 0) {
    var _a, _b;
    if (depth > 5)
        return [filePath]; // prevent infinite recursion
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        let scriptContent = content;
        if (filePath.endsWith('.vue')) {
            scriptContent = extractScriptFromVue(content);
        }
        const ast = (0, parser_1.parse)(scriptContent, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'dynamicImport'],
            errorRecovery: true,
        });
        for (const node of ast.program.body) {
            // Check if this file re-exports the name from another source
            if (node.type === 'ExportNamedDeclaration' && node.source) {
                for (const spec of node.specifiers || []) {
                    const exported = (_a = spec.exported) === null || _a === void 0 ? void 0 : _a.name;
                    const local = (_b = spec.local) === null || _b === void 0 ? void 0 : _b.name;
                    if (exported === exportName || local === exportName) {
                        const nextPath = resolveModulePath(filePath, node.source.value);
                        if (nextPath) {
                            const chain = traceReexportChain(nextPath, local || exportName, depth + 1);
                            return [filePath, ...chain];
                        }
                        return [filePath, node.source.value];
                    }
                }
            }
            // Check export * — the name might come from a star export
            if (node.type === 'ExportAllDeclaration' && node.source) {
                const nextPath = resolveModulePath(filePath, node.source.value);
                if (nextPath) {
                    const starExports = resolveExportStar(nextPath, depth + 1);
                    if (starExports.includes(exportName)) {
                        const chain = traceReexportChain(nextPath, exportName, depth + 1);
                        return [filePath, ...chain];
                    }
                }
            }
        }
        // This file defines the export directly — end of chain
        return [filePath];
    }
    catch (_c) {
        return [filePath];
    }
}
// ============ I-03: ENHANCED METADATA HELPERS ============
/**
 * I-03: Extracts parameter type annotations from a function node.
 */
function extractParamTypes(node) {
    const params = node === null || node === void 0 ? void 0 : node.params;
    if (!params || params.length === 0)
        return undefined;
    const types = [];
    for (const param of params) {
        types.push(paramToString(param));
    }
    return types;
}
/**
 * I-03: Heuristic purity detection.
 * A function is considered pure if it:
 * - Has no assignments to external variables
 * - Has no method calls that could be side-effecting (console.*, fs.*, etc.)
 * - Does not use `this`
 */
function detectPurity(node) {
    if (!node || !node.body)
        return true; // declaration without body = assume pure
    const bodyStr = JSON.stringify(node.body);
    // Detect obvious side-effect patterns
    const sideEffectPatterns = [
        '"type":"AssignmentExpression"',
        '"object":{"type":"Identifier","name":"console"}',
        '"object":{"type":"Identifier","name":"fs"}',
        '"object":{"type":"Identifier","name":"process"}',
        '"type":"ThisExpression"',
        '"type":"AwaitExpression"',
        '"callee":{"type":"Identifier","name":"fetch"}',
    ];
    for (const pattern of sideEffectPatterns) {
        if (bodyStr.includes(pattern))
            return false;
    }
    return true;
}
/**
 * I-03: Computes cyclomatic and cognitive complexity for a function node.
 * Uses the source content to count branching and nesting.
 */
function computeComplexity(node, sourceContent) {
    if (!node.loc)
        return undefined;
    const startLine = node.loc.start.line;
    const endLine = node.loc.end.line;
    const lines = sourceContent.split('\n').slice(startLine - 1, endLine);
    const linesOfCode = lines.length;
    // Cyclomatic complexity: count decision points
    let cyclomatic = 1; // base complexity
    let cognitive = 0;
    let nestingLevel = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        // Count branching constructs
        if (/\b(if|else if|\?\s*)\b/.test(trimmed)) {
            cyclomatic++;
            cognitive += 1 + nestingLevel;
        }
        if (/\b(for|while|do)\b/.test(trimmed)) {
            cyclomatic++;
            cognitive += 1 + nestingLevel;
        }
        if (/\b(switch)\b/.test(trimmed)) {
            cyclomatic++;
            cognitive += 1 + nestingLevel;
        }
        if (/\b(case)\b/.test(trimmed)) {
            cyclomatic++;
        }
        if (/\b(catch)\b/.test(trimmed)) {
            cyclomatic++;
            cognitive += 1 + nestingLevel;
        }
        if (/&&|\|\|/.test(trimmed)) {
            cyclomatic++;
            cognitive++;
        }
        // Track nesting
        const opens = (trimmed.match(/{/g) || []).length;
        const closes = (trimmed.match(/}/g) || []).length;
        nestingLevel += opens - closes;
        if (nestingLevel < 0)
            nestingLevel = 0;
    }
    return { cyclomatic, cognitive, linesOfCode };
}
/**
 * I-03: Extracts JSDoc tags from leading comments of a node.
 */
function extractJsDocTags(node, sourceContent) {
    var _a, _b, _c, _d;
    const tags = [];
    // Check for leadingComments in the AST node
    const comments = node.leadingComments || node.trailingComments || [];
    for (const comment of comments) {
        if (comment.type === 'CommentBlock' && comment.value.startsWith('*')) {
            // Parse JSDoc block
            const tagRegex = /@(\w+)(?:\s+(.+?))?(?=\n\s*\*\s*@|\n\s*\*\/|$)/g;
            let match;
            while ((match = tagRegex.exec(comment.value)) !== null) {
                tags.push({ name: match[1], value: (_a = match[2]) === null || _a === void 0 ? void 0 : _a.trim() });
            }
        }
    }
    // Fallback: if no AST comments, try to find JSDoc from source content
    if (tags.length === 0 && sourceContent && node.loc) {
        const lines = sourceContent.split('\n');
        const startLine = node.loc.start.line - 1;
        // Look backwards for JSDoc comment
        let searchLine = startLine - 1;
        while (searchLine >= 0 && searchLine >= startLine - 10) {
            const line = (_b = lines[searchLine]) === null || _b === void 0 ? void 0 : _b.trim();
            if (line === '*/') {
                // Found end of JSDoc, scan backwards for tags
                for (let i = searchLine - 1; i >= Math.max(0, searchLine - 20); i--) {
                    const docLine = (_c = lines[i]) === null || _c === void 0 ? void 0 : _c.trim();
                    if (docLine === '/**')
                        break;
                    const tagMatch = docLine === null || docLine === void 0 ? void 0 : docLine.match(/^\*?\s*@(\w+)(?:\s+(.+))?$/);
                    if (tagMatch) {
                        tags.push({ name: tagMatch[1], value: (_d = tagMatch[2]) === null || _d === void 0 ? void 0 : _d.trim() });
                    }
                }
                break;
            }
            if (line && !line.startsWith('*') && !line.startsWith('//'))
                break;
            searchLine--;
        }
    }
    return tags.length > 0 ? tags : undefined;
}
//# sourceMappingURL=astParser.js.map