"use strict";
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
exports.generateTypeReport = generateTypeReport;
// C:\orchestr8\scripts\prd src\typeParser.ts
/**
 * type-parser — TypeScript type / interface / enum extractor.
 *
 * INPUT CONTRACT:
 *   - targetPath: absolute path to a project root OR a single .ts file.
 *     When a directory, scans `<targetPath>/src/types/**\/*.ts`
 *     (DEFAULT_TYPES_DIR), excluding `PRDs/`. When a file, parses it
 *     directly if it ends in .ts.
 *   - This parser uses fast-glob + regex extraction, NOT a full AST
 *     parse — it's faster but less precise than ast-parser.js. For
 *     full AST coverage of types in arbitrary files, use the per-file
 *     extractImportsAndExports() pipeline (consumed by indexer.js).
 *
 * OUTPUT CONTRACT (generateTypeReport returns string):
 *   - Human-readable text report listing every `type X = ...`,
 *     `interface X { ... }`, and `enum X { ... }` declaration with
 *     its export status. data-ingestion.js parses via
 *     `parseTypeText()` into SemanticGraph nodes of type 'typeDefinition'.
 *
 * CONSUMERS:
 *   - data-ingestion.js:890 — circuit-breaker-wrapped invocation.
 *   - parser-persistence.js — persists into Types SQLite table.
 *
 * KNOWN LIMITATIONS:
 *   - Only the `src/types/` directory is scanned on directory targets;
 *     types co-located with their consumers are missed.
 *   - Regex-only extraction: types defined via complex generic
 *     conditional patterns may not be matched fully.
 *   - PRDs/ subdirectory is intentionally filtered (DEFAULT_PRD_DIR).
 *
 * ORIGIN: compiled from maestro-scaffolder-tool's src/typeParser.ts.
 */
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const fast_glob_1 = __importDefault(require("fast-glob"));
// Note: AST parsing (@babel/parser) is NOT used in this version for types,
// but could be added later for more detailed analysis.
// --- Constants ---
// Default relative path to look for type files if targetPath is a directory
const DEFAULT_TYPES_DIR = 'src/types';
// Default relative path for PRDs (special case for filter)
const DEFAULT_PRD_DIR = 'PRDs';
// --- Helper Functions ---
/**
 * Finds type definition files (.ts) based on the target path.
 * If targetPath is a directory, scans the default types subdirectory.
 * If targetPath is a file, returns only that file if it's a .ts file.
 * @param targetPath - Absolute path to the target directory or file.
 * @returns Promise resolving to an array of FileInfo objects (without content initially).
 */
function findTypeFiles(targetPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const foundFiles = [];
        const targetStats = yield fs_extra_1.default.stat(targetPath);
        if (targetStats.isDirectory()) {
            const typesDirPath = path_1.default.join(targetPath, DEFAULT_TYPES_DIR);
            console.log(`DEBUG [types]: Scanning for type files in ${typesDirPath}`);
            const pattern = `**/*.ts`; // Look for all .ts files
            try {
                // Use absolute paths for easier processing later
                const files = yield (0, fast_glob_1.default)(pattern, {
                    cwd: typesDirPath,
                    onlyFiles: true,
                    absolute: true, // Get absolute paths
                });
                console.log(`DEBUG [types]: Found ${files.length} potential type files in directory.`);
                files.forEach(absPath => {
                    foundFiles.push({
                        absolutePath: absPath,
                        relativePath: path_1.default.relative(targetPath, absPath) // Relative to original target
                    });
                });
            }
            catch (err) {
                if (err.code === 'ENOENT') {
                    console.warn(`WARN [types]: Default types directory not found: ${typesDirPath}`);
                }
                else {
                    console.error(`ERROR [types]: Failed to scan for type files in ${typesDirPath}:`, err);
                }
            }
        }
        else if (targetStats.isFile() && targetPath.endsWith('.ts')) {
            if (yield fs_extra_1.default.pathExists(targetPath)) {
                console.log(`DEBUG [types]: Target is a single type file: ${targetPath}`);
                foundFiles.push({
                    absolutePath: targetPath,
                    relativePath: path_1.default.basename(targetPath) // Use filename as relative path
                });
            }
            else {
                console.warn(`WARN [types]: Target file specified but not found: ${targetPath}`);
            }
        }
        else {
            console.log(`DEBUG [types]: Target ${targetPath} is not a directory or .ts file. Skipping type scan.`);
        }
        return foundFiles;
    });
}
/**
 * Finds PRD files based on the target path (only if target is a directory).
 * @param targetPath - Absolute path to the target directory.
 * @returns Promise resolving to an array of FileInfo objects (without content).
 */
function findPrdFiles(targetPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const foundFiles = [];
        try {
            const targetStats = yield fs_extra_1.default.stat(targetPath);
            if (!targetStats.isDirectory()) {
                console.log(`DEBUG [types/prd]: Target path ${targetPath} is not a directory. Skipping PRD scan.`);
                return foundFiles;
            }
        }
        catch (err) {
            console.error(`ERROR [types/prd]: Cannot stat target path ${targetPath}:`, err);
            return foundFiles;
        }
        const prdDirPath = path_1.default.join(targetPath, DEFAULT_PRD_DIR);
        console.log(`DEBUG [types/prd]: Scanning for PRD files in ${prdDirPath}`);
        try {
            const files = yield (0, fast_glob_1.default)(['**/*.*'], {
                cwd: prdDirPath,
                onlyFiles: true,
                absolute: true, // Get absolute paths
            });
            console.log(`DEBUG [types/prd]: Found ${files.length} potential PRD files.`);
            files.forEach(absPath => {
                foundFiles.push({
                    absolutePath: absPath,
                    relativePath: path_1.default.relative(targetPath, absPath) // Relative to original target
                });
            });
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                console.warn(`WARN [types/prd]: PRD directory not found: ${prdDirPath}`);
            }
            else {
                console.error(`ERROR [types/prd]: Failed to scan for PRD files in ${prdDirPath}:`, err);
            }
        }
        return foundFiles;
    });
}
/**
 * Loads content for files and applies filter if specified.
 * @param files - Array of FileInfo objects.
 * @param filter - Optional filter string (case-insensitive).
 * @returns Promise resolving to the filtered array of FileInfo objects with content loaded.
 */
function loadAndFilterFiles(files, filter) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = [];
        const filterLower = filter === null || filter === void 0 ? void 0 : filter.toLowerCase();
        for (const fileInfo of files) {
            try {
                const content = yield fs_extra_1.default.readFile(fileInfo.absolutePath, 'utf-8');
                fileInfo.content = content; // Load content
                // Apply filter if provided (check relative path and content)
                if (filterLower) {
                    if (fileInfo.relativePath.toLowerCase().includes(filterLower) ||
                        (fileInfo.content && fileInfo.content.toLowerCase().includes(filterLower))) {
                        results.push(fileInfo);
                    }
                }
                else {
                    results.push(fileInfo); // No filter, include all loaded files
                }
            }
            catch (err) {
                console.error(`ERROR [types]: Failed to read file content for ${fileInfo.relativePath}:`, err);
                // Optionally add a placeholder to results indicating the error?
                // results.push({ ...fileInfo, content: `ERROR reading file: ${err.message}` });
            }
        }
        if (filter)
            console.log(`DEBUG [types]: Filtered ${files.length} files down to ${results.length} using pattern: ${filter}`);
        return results;
    });
}
/**
 * Formats the report for a list of type or PRD files.
 * @param title - The title for this section of the report.
 * @param basePath - The base path these files are relative to.
 * @param files - Array of FileInfo objects (with content loaded).
 * @returns A formatted string section for the report.
 */
function formatFileReport(title, basePath, files) {
    let section = `${title}\nTarget Context: ${basePath}\n`;
    if (files.length === 0) {
        section += "(No files found matching criteria)\n\n";
    }
    else {
        section += `Found ${files.length} file(s):\n\n`;
        files.forEach(fileInfo => {
            section += `--- File: ${fileInfo.relativePath} ---\n`;
            // section += `Absolute Path: ${fileInfo.absolutePath}\n`; // Optional: for debugging
            if (fileInfo.content !== undefined && fileInfo.content !== null) {
                section += "Content:\n";
                // Detect language for ``` block based on extension
                const lang = path_1.default.extname(fileInfo.relativePath).substring(1) || 'text';
                section += `\`\`\`${lang}\n`;
                section += fileInfo.content;
                section += "\n\`\`\`\n\n";
            }
            else {
                section += "(Content could not be loaded or file was filtered out before loading)\n\n";
            }
        });
    }
    return section;
}
// --- Main Type Report Generation Function ---
/**
 * REFACTORED: Generates a report of TypeScript types or PRD files.
 * Handles comparison if options.comparePath is provided (only for types, not PRDs).
 * @param targetPath - Absolute path to the target directory or file.
 * @param options - Options object containing filter and potentially comparePath.
 * @returns Promise resolving to the formatted report string.
 */
function generateTypeReport(targetPath_1) {
    return __awaiter(this, arguments, void 0, function* (targetPath, options = {}) {
        const { filter, comparePath } = options;
        console.log(`DEBUG [types]: Starting type report generation for target: ${targetPath}, Filter: ${filter || 'None'}`);
        let report = "";
        const isPrdMode = (filter === null || filter === void 0 ? void 0 : filter.toLowerCase()) === 'prd';
        // --- Handle PRD Mode ---
        if (isPrdMode) {
            report += "=== Product Requirement Documents (PRDs) ===\n";
            report += `Analysis Time: ${new Date().toISOString()}\n\n`;
            // PRD scan only makes sense if targetPath is a directory
            const prdFilesInfo = yield findPrdFiles(targetPath);
            const loadedPrds = yield loadAndFilterFiles(prdFilesInfo); // Load content (filter doesn't apply here)
            report += formatFileReport(`PRDs found relative to: ${targetPath}`, targetPath, loadedPrds);
            // Comparison doesn't apply to PRD mode
            if (comparePath)
                console.warn("WARN [types]: --comparePath is ignored when using --filter Prd.");
            // --- Handle Regular Type Mode ---
        }
        else {
            report += "=== TypeScript Type Definition Analysis ===\n";
            report += `Analysis Time: ${new Date().toISOString()}\n\n`;
            // --- Find and Process Primary Target ---
            const primaryTypeFilesInfo = yield findTypeFiles(targetPath);
            const loadedPrimaryTypes = yield loadAndFilterFiles(primaryTypeFilesInfo, filter);
            report += formatFileReport(`Types Found in Primary Target`, targetPath, loadedPrimaryTypes);
            // --- Find and Process Comparison Target (if applicable) ---
            if (comparePath) {
                console.log(`DEBUG [types]: Processing comparison target: ${comparePath}`);
                const compareTypeFilesInfo = yield findTypeFiles(comparePath);
                const loadedCompareTypes = yield loadAndFilterFiles(compareTypeFilesInfo, filter);
                report += formatFileReport(`Types Found in Comparison Target`, comparePath, loadedCompareTypes);
                // --- Basic Comparison ---
                report += "--- Comparison Summary (Based on Relative Path & Filter) ---\n";
                const primaryPaths = new Set(loadedPrimaryTypes.map(f => f.relativePath));
                const comparePaths = new Set(loadedCompareTypes.map(f => f.relativePath));
                const commonPaths = loadedPrimaryTypes.filter(f => comparePaths.has(f.relativePath));
                const uniqueToPrimary = loadedPrimaryTypes.filter(f => !comparePaths.has(f.relativePath));
                const uniqueToCompare = loadedCompareTypes.filter(f => !primaryPaths.has(f.relativePath));
                report += `Common Relative Paths (${commonPaths.length}): ${commonPaths.map(f => f.relativePath).join(', ') || 'None'}\n`;
                report += `Paths Unique to Primary (${uniqueToPrimary.length}): ${uniqueToPrimary.map(f => f.relativePath).join(', ') || 'None'}\n`;
                report += `Paths Unique to Comparison (${uniqueToCompare.length}): ${uniqueToCompare.map(f => f.relativePath).join(', ') || 'None'}\n\n`;
            }
        }
        report += "=========================================\n";
        console.log("DEBUG [types]: Finished type/PRD report generation.");
        return report;
    });
}
//# sourceMappingURL=typeParser.js.map