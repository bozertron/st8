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
exports.generateStoreReport = generateStoreReport;
// C:\orchestr8\scripts\prd src\storeParser.ts
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const parser_1 = require("@babel/parser");
const t = __importStar(require("@babel/types")); // Use babel types for checking node types
// --- Constants ---
// Default relative path to look for store files if targetPath is a directory
const DEFAULT_STORE_DIR = 'src/stores';
const IGNORE_FILES_IN_STORE_DIR = ['index.ts', '*.test.ts', '*.spec.ts']; // Files within store dir to ignore
// --- Helper Functions ---
/**
 * Finds potential store files based on the target path.
 * If targetPath is a directory, scans the default store subdirectory.
 * If targetPath is a file, returns only that file if it's a .ts file.
 * @param targetPath - Absolute path to the target directory or file.
 * @returns Promise resolving to an array of absolute store file paths.
 */
function findStoreFiles(targetPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetStats = yield fs_extra_1.default.stat(targetPath);
        if (targetStats.isDirectory()) {
            const storeDirPath = path_1.default.join(targetPath, DEFAULT_STORE_DIR);
            console.log(`DEBUG [stores]: Scanning for store files in ${storeDirPath}`);
            const pattern = `**/*.ts`; // Look for all .ts files within the store dir
            const ignorePatterns = IGNORE_FILES_IN_STORE_DIR.map(f => `${f}`); // Ignore relative to cwd
            try {
                // Use absolute paths for easier processing later
                const files = yield (0, fast_glob_1.default)(pattern, {
                    cwd: storeDirPath, // Set Current Working Directory to the store dir
                    ignore: ignorePatterns,
                    onlyFiles: true,
                    absolute: true, // Get absolute paths directly
                });
                console.log(`DEBUG [stores]: Found ${files.length} potential store files in directory.`);
                return files;
            }
            catch (err) {
                // Handle case where storeDirPath might not exist
                if (err.code === 'ENOENT') {
                    console.warn(`WARN [stores]: Default store directory not found: ${storeDirPath}`);
                    return [];
                }
                console.error(`ERROR [stores]: Failed to scan for store files in ${storeDirPath}:`, err);
                return [];
            }
        }
        else if (targetStats.isFile() && targetPath.endsWith('.ts')) {
            // If targeting a single file, check if it exists (redundant check, but safe)
            if (yield fs_extra_1.default.pathExists(targetPath)) {
                console.log(`DEBUG [stores]: Target is a single store file: ${targetPath}`);
                return [targetPath];
            }
            else {
                console.warn(`WARN [stores]: Target file specified but not found: ${targetPath}`);
                return [];
            }
        }
        else {
            // Target is a file but not a .ts file
            console.log(`DEBUG [stores]: Target ${targetPath} is not a directory or .ts file. Skipping store scan.`);
            return [];
        }
    });
}
/**
 * Parses a store file using Babel parser and extracts store info.
 * @param absoluteFilePath - Absolute path to the store file.
 * @param basePath - The base path the scan started from (used for relative paths in StoreInfo).
 * @returns Promise resolving to StoreInfo object or null.
 */
function parseStoreFile(absoluteFilePath, basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        // Calculate relative path for reporting
        const relativePath = path_1.default.relative(basePath, absoluteFilePath);
        console.log(`DEBUG [stores]: Parsing file: ${relativePath} (Absolute: ${absoluteFilePath})`);
        try {
            const code = yield fs_extra_1.default.readFile(absoluteFilePath, 'utf-8');
            const ast = (0, parser_1.parse)(code, {
                sourceType: 'module',
                plugins: ['typescript'], // Enable TypeScript syntax
                errorRecovery: true
            });
            let storeDetails = {}; // Use Partial initially
            let foundDefineStore = false;
            for (const node of ast.program.body) {
                // Look for variable declarations like `export const useMyStore = defineStore(...)`
                if (t.isExportNamedDeclaration(node) && node.declaration && t.isVariableDeclaration(node.declaration)) {
                    for (const declarator of node.declaration.declarations) {
                        if (t.isCallExpression(declarator.init) && t.isIdentifier(declarator.init.callee) && declarator.init.callee.name === 'defineStore') {
                            storeDetails = extractStoreDetailsAST(declarator.init.arguments);
                            if (t.isIdentifier(declarator.id)) {
                                storeDetails.variableName = declarator.id.name;
                            }
                            foundDefineStore = true;
                            break; // Assume one exported store per file
                        }
                    }
                }
                // Add check for default export: export default defineStore(...)
                if (t.isExportDefaultDeclaration(node) && t.isCallExpression(node.declaration) && t.isIdentifier(node.declaration.callee) && node.declaration.callee.name === 'defineStore') {
                    storeDetails = extractStoreDetailsAST(node.declaration.arguments);
                    // Cannot easily get variable name for default export unless assigned earlier
                    foundDefineStore = true;
                    break;
                }
                if (foundDefineStore)
                    break;
            }
            if (foundDefineStore) {
                console.log(`DEBUG [stores]: Successfully parsed store: ${storeDetails.id || 'Unknown ID'} in ${relativePath}`);
                storeDetails.filePath = relativePath; // Add relative file path
                return storeDetails; // Cast to full type
            }
            else {
                console.log(`DEBUG [stores]: No exported defineStore call found or parsed in ${relativePath}`);
                return null;
            }
        }
        catch (err) {
            console.error(`ERROR [stores]: Failed to parse AST for ${relativePath}: ${err.message}`);
            return null; // Return null on parsing error
        }
    });
}
/**
 * Extracts details from the arguments of a defineStore call AST node.
 * @param args - Array of AST nodes representing defineStore arguments.
 * @returns Partial<StoreInfo> object containing extracted details.
 */
function extractStoreDetailsAST(args) {
    const details = { stateKeys: [], getterKeys: [], actionKeys: [] };
    if (args.length === 0)
        return details;
    // First argument: Store ID (string literal)
    if (t.isStringLiteral(args[0])) {
        details.id = args[0].value;
    }
    // Second argument: Options object or Setup function
    if (args.length > 1) {
        const secondArg = args[1];
        // Options Object: { state: () => ({...}), getters: {...}, actions: {...} }
        if (t.isObjectExpression(secondArg)) {
            details.isSetupStore = false; // Explicitly options object
            secondArg.properties.forEach(prop => {
                if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key))
                    return;
                const keyName = prop.key.name;
                const valueNode = prop.value;
                try { // Wrap extraction in try-catch for safety
                    if (keyName === 'state' && t.isArrowFunctionExpression(valueNode) && t.isObjectExpression(valueNode.body)) {
                        valueNode.body.properties.forEach(stateProp => {
                            var _a;
                            if (t.isObjectProperty(stateProp) && t.isIdentifier(stateProp.key)) {
                                (_a = details.stateKeys) === null || _a === void 0 ? void 0 : _a.push(stateProp.key.name);
                            }
                        });
                    }
                    else if (keyName === 'getters' && t.isObjectExpression(valueNode)) {
                        valueNode.properties.forEach(getterProp => {
                            var _a;
                            if ((t.isObjectProperty(getterProp) || t.isObjectMethod(getterProp)) && t.isIdentifier(getterProp.key)) {
                                (_a = details.getterKeys) === null || _a === void 0 ? void 0 : _a.push(getterProp.key.name);
                            }
                        });
                    }
                    else if (keyName === 'actions' && t.isObjectExpression(valueNode)) {
                        valueNode.properties.forEach(actionProp => {
                            var _a;
                            if ((t.isObjectProperty(actionProp) || t.isObjectMethod(actionProp)) && t.isIdentifier(actionProp.key)) {
                                (_a = details.actionKeys) === null || _a === void 0 ? void 0 : _a.push(actionProp.key.name);
                            }
                        });
                    }
                }
                catch (extractErr) {
                    console.warn(`WARN [stores]: Error extracting property '${keyName}' for store ${details.id || 'Unknown'}: ${extractErr.message}`);
                }
            });
        }
        // Setup Function: () => { ... return {...} }
        else if (t.isFunctionExpression(secondArg) || t.isArrowFunctionExpression(secondArg)) {
            details.isSetupStore = true;
            // TODO: Future enhancement: Parse the setup function's return statement
            // This requires more complex AST traversal to track variables.
            console.log(`DEBUG [stores]: Detected setup store syntax for ID: ${details.id || 'Unknown'}. Detailed state/getter/action analysis TBD.`);
        }
    }
    // Ensure arrays exist even if empty
    if (!details.stateKeys)
        details.stateKeys = [];
    if (!details.getterKeys)
        details.getterKeys = [];
    if (!details.actionKeys)
        details.actionKeys = [];
    return details;
}
/**
 * Formats the report for a single store's information.
 * @param storeInfo - The parsed StoreInfo object.
 * @returns A formatted string for the report.
 */
function formatStoreInfo(storeInfo) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    let output = "";
    output += `--- Store ID: ${storeInfo.id || 'Unknown ID'} ---\n`;
    output += `File: ${storeInfo.filePath}\n`;
    if (storeInfo.variableName)
        output += `Exported As: ${storeInfo.variableName}\n`;
    if (storeInfo.isSetupStore) {
        output += `Type: Setup Function (Detailed analysis TBD)\n`;
    }
    else {
        output += `Type: Options Object\n`;
        output += ` State Properties (${(_b = (_a = storeInfo.stateKeys) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0}): ${((_c = storeInfo.stateKeys) === null || _c === void 0 ? void 0 : _c.length) ? storeInfo.stateKeys.join(', ') : 'None'}\n`;
        output += ` Getters (${(_e = (_d = storeInfo.getterKeys) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0}): ${((_f = storeInfo.getterKeys) === null || _f === void 0 ? void 0 : _f.length) ? storeInfo.getterKeys.join(', ') : 'None'}\n`;
        output += ` Actions (${(_h = (_g = storeInfo.actionKeys) === null || _g === void 0 ? void 0 : _g.length) !== null && _h !== void 0 ? _h : 0}): ${((_j = storeInfo.actionKeys) === null || _j === void 0 ? void 0 : _j.length) ? storeInfo.actionKeys.join(', ') : 'None'}\n`;
    }
    return output + "\n"; // Add newline for spacing
}
// --- Main Store Report Generation Function ---
/**
 * REFACTORED: Finds, parses, and formats a report of Pinia stores based on target path.
 * Handles comparison if options.comparePath is provided.
 * @param targetPath - Absolute path to the target directory or store file.
 * @param options - Options object possibly containing comparePath.
 * @returns Promise resolving to the formatted store report string.
 */
function generateStoreReport(targetPath_1) {
    return __awaiter(this, arguments, void 0, function* (targetPath, options = {}) {
        console.log(`DEBUG [stores]: Starting store report generation for target: ${targetPath}`);
        let report = "=== Pinia Stores Analysis ===\n";
        report += `Analysis Time: ${new Date().toISOString()}\n\n`;
        // --- Find and Parse Primary Stores ---
        const primaryStoreFiles = yield findStoreFiles(targetPath);
        const primaryStores = [];
        if (primaryStoreFiles.length > 0) {
            report += `--- Stores Found in Primary Target: ${targetPath} ---\n`;
            for (const file of primaryStoreFiles) {
                const storeInfo = yield parseStoreFile(file, targetPath); // Pass absolute path and base path
                if (storeInfo) {
                    primaryStores.push(storeInfo);
                    report += formatStoreInfo(storeInfo);
                }
            }
            if (primaryStores.length === 0) {
                report += "(No valid defineStore calls found in scanned files)\n";
            }
            report += "\n";
        }
        else {
            report += `--- Stores Found in Primary Target: ${targetPath} ---\n`;
            report += "(No store files found matching criteria)\n\n";
        }
        // --- Find and Parse Comparison Stores (if applicable) ---
        let compareStores = [];
        if (options.comparePath) {
            console.log(`DEBUG [stores]: Processing comparison target: ${options.comparePath}`);
            const compareStoreFiles = yield findStoreFiles(options.comparePath);
            report += `--- Stores Found in Comparison Target: ${options.comparePath} ---\n`;
            if (compareStoreFiles.length > 0) {
                for (const file of compareStoreFiles) {
                    const storeInfo = yield parseStoreFile(file, options.comparePath);
                    if (storeInfo) {
                        compareStores.push(storeInfo);
                        report += formatStoreInfo(storeInfo);
                    }
                }
                if (compareStores.length === 0) {
                    report += "(No valid defineStore calls found in comparison files)\n";
                }
                report += "\n";
            }
            else {
                report += "(No store files found matching criteria in comparison target)\n\n";
            }
            // --- Basic Comparison ---
            report += "--- Comparison Summary (Based on Store ID) ---\n";
            const primaryIds = new Set(primaryStores.map(s => s.id).filter(id => id)); // Filter null IDs
            const compareIds = new Set(compareStores.map(s => s.id).filter(id => id));
            const commonIds = [...primaryIds].filter(id => compareIds.has(id));
            const uniqueToPrimaryIds = [...primaryIds].filter(id => !compareIds.has(id));
            const uniqueToCompareIds = [...compareIds].filter(id => !primaryIds.has(id));
            report += `Common Store IDs (${commonIds.length}): ${commonIds.join(', ') || 'None'}\n`;
            report += `IDs Unique to Primary (${uniqueToPrimaryIds.length}): ${uniqueToPrimaryIds.join(', ') || 'None'}\n`;
            report += `IDs Unique to Comparison (${uniqueToCompareIds.length}): ${uniqueToCompareIds.join(', ') || 'None'}\n\n`;
        }
        report += "===========================\n";
        console.log("DEBUG [stores]: Finished store report generation.");
        return report;
    });
}
//# sourceMappingURL=storeParser.js.map