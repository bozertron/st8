"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRouteReport = generateRouteReport;
/**
 * route-parser — Vue Router declaration extractor (Stage 1 of integr8).
 *
 * INPUT CONTRACT:
 *   - targetPath: absolute path to a project root OR a single .ts file.
 *     When a directory, reads `<targetPath>/src/router/index.ts`
 *     (DEFAULT_ROUTER_FILE_REL_PATH). When a file, parses it directly.
 *   - options.comparePath (optional): a second project root whose
 *     router/index.ts is parsed and reported alongside the primary.
 *
 * OUTPUT CONTRACT (generateRouteReport returns string):
 *   - Human-readable text report. Lists every route with path, name,
 *     component, parent (for nested routes). data-ingestion.js parses
 *     this text via regex inside `parseRouteText()` to produce
 *     SemanticGraph nodes of type 'route'.
 *
 * CONSUMERS:
 *   - data-ingestion.js:863 — circuit-breaker-wrapped invocation.
 *   - parser-persistence.js — persists extracted routes into the
 *     Routes SQLite table.
 *
 * KNOWN LIMITATIONS:
 *   - Vue Router only. React Router, Next.js file-routing, SvelteKit
 *     route conventions are NOT detected.
 *   - Hardcoded to `src/router/index.ts`. Projects using a different
 *     entry file must pass that file's path explicitly.
 *   - Only TypeScript router files. .js routers will not parse.
 *
 * ORIGIN: compiled from maestro-scaffolder-tool's src/routeParser.ts.
 */
// C:\orchestr8\scripts\prd src\routeParser.ts
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const parser_1 = require("@babel/parser");
const t = __importStar(require("@babel/types")); // Make sure @babel/types is installed
// --- Constants ---
// Default relative path to look for the router file if targetPath is a directory
const DEFAULT_ROUTER_FILE_REL_PATH = 'src/router/index.ts';
// --- Helper Functions ---
/**
 * Parses the specified router file to find route definitions.
 * @param routerFilePath - Absolute path to the router file to parse.
 * @returns Promise resolving to an array of simplified route definition objects or null on error/not found.
 */
function parseRouterFile(routerFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`DEBUG [routes]: Attempting to parse router file: ${routerFilePath}`);
        if (!(yield fs_extra_1.default.pathExists(routerFilePath))) {
            console.warn(`WARN [routes]: Router file not found at ${routerFilePath}`);
            return null;
        }
        try {
            const code = yield fs_extra_1.default.readFile(routerFilePath, 'utf-8');
            // Use Babel parser for robust JS/TS parsing
            const ast = (0, parser_1.parse)(code, {
                sourceType: 'module', // Assume ES Modules
                plugins: ['typescript'], // Enable TypeScript syntax
                errorRecovery: true // Try to recover from minor syntax errors
            });
            let routesArray = [];
            // Traverse the AST to find the routes array
            // Look for createRouter call first, as it's the most common pattern
            let createRouterCall = null;
            let routesVariable = null;
            for (const node of ast.program.body) {
                // Find `createRouter({...})` call expression
                if (t.isVariableDeclaration(node)) {
                    for (const declarator of node.declarations) {
                        if (t.isCallExpression(declarator.init) && t.isIdentifier(declarator.init.callee) && declarator.init.callee.name === 'createRouter') {
                            createRouterCall = declarator.init;
                            break;
                        }
                        // Check for direct routes variable assignment (less common now with setup)
                        if (t.isArrayExpression(declarator.init) && t.isIdentifier(declarator.id) && declarator.id.name.toLowerCase().includes('route')) {
                            routesVariable = declarator.init;
                            console.log(`DEBUG [routes]: Found standalone routes variable: ${declarator.id.name}`);
                        }
                    }
                }
                // Handle direct export default createRouter({...})
                if (t.isExportDefaultDeclaration(node) && t.isCallExpression(node.declaration) && t.isIdentifier(node.declaration.callee) && node.declaration.callee.name === 'createRouter') {
                    createRouterCall = node.declaration;
                }
                if (createRouterCall)
                    break; // Prioritize createRouter
            }
            // Extract routes array from createRouter options or standalone variable
            if (createRouterCall && createRouterCall.arguments.length > 0 && t.isObjectExpression(createRouterCall.arguments[0])) {
                const optionsObject = createRouterCall.arguments[0];
                const routesProp = optionsObject.properties.find(prop => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'routes');
                if (routesProp && t.isObjectProperty(routesProp) && t.isArrayExpression(routesProp.value)) {
                    console.log(`DEBUG [routes]: Found routes array inside createRouter call.`);
                    routesArray = parseRoutesArrayAST(routesProp.value.elements);
                }
                else {
                    console.warn(`WARN [routes]: Found createRouter call but couldn't find a 'routes' array property inside.`);
                }
            }
            else if (routesVariable) {
                console.log(`DEBUG [routes]: Using standalone routes variable.`);
                routesArray = parseRoutesArrayAST(routesVariable.elements);
            }
            if (routesArray.length === 0) {
                console.log(`DEBUG [routes]: Could not automatically extract routes array from ${routerFilePath}`);
            }
            return routesArray;
        }
        catch (err) {
            console.error(`ERROR [routes]: Failed to parse AST for ${routerFilePath}: ${err.message}\n${err.stack}`);
            return null; // Return null on parsing error
        }
    });
}
/**
 * Recursively parses the elements (route objects) of a routes array expression from the AST.
 * @param routeElements - Array of AST nodes from the routes array (ObjectExpression expected).
 * @returns Array of simplified route definition objects.
 */
function parseRoutesArrayAST(routeElements) {
    const parsedRoutes = [];
    routeElements.forEach((routeNode) => {
        if (!t.isObjectExpression(routeNode)) {
            // Ignore non-object elements like spread operators for simplicity
            if (routeNode)
                console.log(`DEBUG [routes]: Skipping non-object element in routes array: ${routeNode.type}`);
            return;
        }
        const routeDef = { children: [] }; // Use Partial for easier assignment
        routeNode.properties.forEach(prop => {
            if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key))
                return; // Skip spread props, non-identifier keys
            const key = prop.key.name;
            const valueNode = prop.value;
            try {
                if (key === 'path' && t.isStringLiteral(valueNode)) {
                    routeDef.path = valueNode.value;
                }
                else if (key === 'name' && t.isStringLiteral(valueNode)) {
                    routeDef.name = valueNode.value;
                }
                else if (key === 'component') {
                    if (t.isIdentifier(valueNode)) {
                        routeDef.component = valueNode.name; // Component imported and used directly
                    }
                    else if (t.isArrowFunctionExpression(valueNode) || (t.isCallExpression(valueNode) && t.isImport(valueNode.callee))) {
                        // Handle dynamic imports: () => import('./views/Home.vue') or import('./views/Home.vue')
                        routeDef.component = "(Dynamic Import)"; // Simple placeholder
                    }
                    else {
                        routeDef.component = `(${valueNode.type})`; // Indicate other type found
                    }
                }
                else if (key === 'children' && t.isArrayExpression(valueNode)) {
                    routeDef.children = parseRoutesArrayAST(valueNode.elements); // Recursive call
                }
                // Future: Could parse 'meta', 'props', 'redirect' etc. here
            }
            catch (parseErr) {
                console.warn(`WARN [routes]: Error parsing property '${key}' in route object: ${parseErr.message}`);
            }
        });
        // Add the route if it has a path (basic validation)
        if (routeDef.path !== undefined && routeDef.path !== null) {
            // Ensure children array exists even if empty
            if (!routeDef.children)
                routeDef.children = [];
            parsedRoutes.push(routeDef); // Cast to non-partial
        }
        else {
            console.warn(`WARN [routes]: Skipping route object missing 'path' property.`);
        }
    });
    return parsedRoutes;
}
/**
 * Formats an array of route definitions into a string report.
 * @param routes - Array of simplified route definition objects.
 * @param indent - Current indentation level (for nested routes).
 * @returns Formatted string representation of the routes.
 */
function formatRoutes(routes, indent = 0) {
    let output = "";
    const prefix = "  ".repeat(indent);
    routes.forEach(route => {
        output += `${prefix}- Path: ${route.path}\n`;
        if (route.name)
            output += `${prefix}  Name: ${route.name}\n`;
        if (route.component)
            output += `${prefix}  Component: ${route.component}\n`;
        if (route.children && route.children.length > 0) {
            output += `${prefix}  Children:\n`;
            output += formatRoutes(route.children, indent + 2); // Recursive call for children
        }
        // output += "\n"; // Add space between routes if desired
    });
    return output;
}
// --- Main Route Report Generation Function ---
/**
 * REFACTORED: Generates a report of defined Vue Router routes using AST parsing.
 * Handles comparison if options.comparePath is provided.
 * @param targetPath - Absolute path to the primary target directory or router file.
 * @param options - Options object possibly containing comparePath.
 * @returns Promise resolving to the formatted route report string.
 */
function generateRouteReport(targetPath_1) {
    return __awaiter(this, arguments, void 0, function* (targetPath, options = {}) {
        console.log(`DEBUG [routes]: Starting route report generation for target: ${targetPath}`);
        let report = "=== Vue Router Routes Analysis ===\n";
        report += `Analysis Time: ${new Date().toISOString()}\n\n`;
        // --- Determine Router File Path(s) ---
        let primaryRouterPath = null;
        let compareRouterPath = null;
        try {
            const stats = yield fs_extra_1.default.stat(targetPath);
            if (stats.isDirectory()) {
                primaryRouterPath = path_1.default.join(targetPath, DEFAULT_ROUTER_FILE_REL_PATH);
            }
            else if (stats.isFile() && targetPath.endsWith('.ts')) { // Allow targeting the file directly
                primaryRouterPath = targetPath;
            }
        }
        catch (err) {
            console.error(`ERROR [routes]: Invalid target path: ${targetPath}`, err);
            return report + `ERROR: Invalid target path: ${targetPath}`;
        }
        if (options.comparePath) {
            try {
                const compareStats = yield fs_extra_1.default.stat(options.comparePath);
                if (compareStats.isDirectory()) {
                    compareRouterPath = path_1.default.join(options.comparePath, DEFAULT_ROUTER_FILE_REL_PATH);
                }
                else if (compareStats.isFile() && options.comparePath.endsWith('.ts')) {
                    compareRouterPath = options.comparePath;
                }
            }
            catch (err) {
                console.warn(`WARN [routes]: Invalid compare path: ${options.comparePath}`, err);
                // Proceed without comparison if compare path is invalid
            }
        }
        // --- Parse Router Files ---
        const primaryRoutes = primaryRouterPath ? yield parseRouterFile(primaryRouterPath) : null;
        const compareRoutes = compareRouterPath ? yield parseRouterFile(compareRouterPath) : null;
        // --- Generate Report String ---
        if (!primaryRouterPath) {
            report += `ERROR: Could not determine primary router file path from target: ${targetPath}\n`;
            return report;
        }
        report += `--- Routes for Primary Target: ${primaryRouterPath} ---\n`;
        if (primaryRoutes === null) {
            report += "(Could not find or parse router file)\n";
        }
        else if (primaryRoutes.length === 0) {
            report += "(No routes extracted from file)\n";
        }
        else {
            report += formatRoutes(primaryRoutes);
        }
        report += "\n";
        if (compareRouterPath) {
            report += `--- Routes for Comparison Target: ${compareRouterPath} ---\n`;
            if (compareRoutes === null) {
                report += "(Could not find or parse comparison router file)\n";
            }
            else if (compareRoutes.length === 0) {
                report += "(No routes extracted from comparison file)\n";
            }
            else {
                report += formatRoutes(compareRoutes);
            }
            report += "\n";
            // --- Basic Comparison Logic (can be expanded) ---
            report += "--- Comparison Summary ---\n";
            if (primaryRoutes && compareRoutes) {
                const primaryPaths = new Set(primaryRoutes.map(r => r.path));
                const comparePaths = new Set(compareRoutes.map(r => r.path));
                const uniqueToPrimary = primaryRoutes.filter(r => !comparePaths.has(r.path));
                const uniqueToCompare = compareRoutes.filter(r => !primaryPaths.has(r.path));
                const commonPaths = primaryRoutes.filter(r => comparePaths.has(r.path));
                report += `Common Top-Level Paths (${commonPaths.length}): ${commonPaths.map(r => r.path).join(', ') || 'None'}\n`;
                report += `Paths Unique to Primary (${uniqueToPrimary.length}): ${uniqueToPrimary.map(r => r.path).join(', ') || 'None'}\n`;
                report += `Paths Unique to Comparison (${uniqueToCompare.length}): ${uniqueToCompare.map(r => r.path).join(', ') || 'None'}\n`;
            }
            else {
                report += "(Cannot compare routes due to parsing errors in one or both files)\n";
            }
            report += "\n";
        }
        report += "=================================\n";
        console.log("DEBUG [routes]: Finished route report generation.");
        return report;
    });
}
//# sourceMappingURL=routeParser.js.map