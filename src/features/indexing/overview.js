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
exports.generateOverviewAndGetFileList = generateOverviewAndGetFileList;
// C:\orchestr8\scripts\prd src\overview.ts
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const fast_glob_1 = __importDefault(require("fast-glob")); // Using fast-glob for efficiency
// --- Constants ---
const SCAN_DIRS = ['src', 'src-tauri']; // Relative directories to scan within targetPath
const IGNORE_PATTERNS = [
    '**/node_modules/**', '**/target/**', '**/.git/**', '**/dist/**',
    '**/alignmentAndContextCache/**', // Important to ignore generated outputs
    '**/.DS_Store', '**/typings/**', '**/*.log',
];
const KEY_CONFIG_FILES = ['package.json', 'vite.config.ts', 'tauri.conf.json', 'tsconfig.json'];
const ENTRY_POINTS = ['src/main.ts', 'src-tauri/src/main.rs']; // Relative to targetPath
// Note: Dependencies are checked in files directly within targetPath or specific subdirs
const CORE_DEPS = ['vue', 'pinia', 'vue-router', 'naive-ui', '@tauri-apps/api', 'fs-extra']; // Frontend focus
const RUST_CORE_DEPS = ['tauri ', 'tokio ', 'serde ', 'rusqlite ']; // Note space for Cargo.toml format
// --- Helper Functions ---
/**
 * Uses fast-glob to get a sorted list of project files relative to a base path.
 * @param basePath - Absolute path to the directory to scan.
 * @returns Promise resolving to a sorted array of relative file paths (POSIX).
 */
function getRelativeProjectFiles(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`DEBUG [overview]: Scanning directories ${SCAN_DIRS.join(', ')} within ${basePath}`);
        const patterns = SCAN_DIRS.map(dir => `${dir}/**/*`); // Create glob patterns for scan dirs
        try {
            const files = yield (0, fast_glob_1.default)(patterns, {
                cwd: basePath, // Scan relative to the provided base path
                ignore: IGNORE_PATTERNS,
                onlyFiles: true,
                dot: false,
                absolute: false, // Get paths relative to basePath
            });
            console.log(`DEBUG [overview]: Found ${files.length} files in ${basePath} after filtering.`);
            return files.sort(); // Sort for consistent ordering
        }
        catch (err) {
            console.error(`ERROR [overview]: Failed to scan files in ${basePath}:`, err);
            return []; // Return empty list on error
        }
    });
}
/**
 * Generates the numbered file index string.
 * @param fileList - Sorted array of relative file paths.
 * @param startIndex - The number to start indexing from (defaults to 1).
 * @returns The formatted index string.
 */
function generateIndexString(fileList, startIndex = 1) {
    let fileIndexString = ""; // Start empty, header added later
    if (fileList.length > 0) {
        fileList.forEach((file, index) => {
            fileIndexString += `${startIndex + index}: ${file}\n`;
        });
    }
    return fileIndexString;
}
/**
 * Generates summary of key configuration files relative to a base path.
 * @param basePath - Absolute path to the base directory.
 * @returns Formatted config summary string.
 */
function generateConfigSummary(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        let summary = "--- Key Config Files ---\n";
        for (const cfgFile of KEY_CONFIG_FILES) {
            // Check relative to basePath, special case for tauri.conf.json
            const filePath = cfgFile === 'tauri.conf.json'
                ? path_1.default.join(basePath, 'src-tauri', cfgFile)
                : path_1.default.join(basePath, cfgFile);
            summary += `- ${cfgFile}: `;
            try {
                if (yield fs_extra_1.default.pathExists(filePath)) {
                    if (cfgFile === 'package.json') {
                        const pkg = yield fs_extra_1.default.readJson(filePath);
                        summary += `(Name: ${pkg.name || 'N/A'}, Version: ${pkg.version || 'N/A'})\n`;
                    }
                    else if (cfgFile === 'tauri.conf.json') {
                        const tauriConf = yield fs_extra_1.default.readJson(filePath);
                        summary += `(ID: ${((_b = (_a = tauriConf === null || tauriConf === void 0 ? void 0 : tauriConf.tauri) === null || _a === void 0 ? void 0 : _a.bundle) === null || _b === void 0 ? void 0 : _b.identifier) || 'N/A'}, Version: ${((_c = tauriConf === null || tauriConf === void 0 ? void 0 : tauriConf.package) === null || _c === void 0 ? void 0 : _c.version) || 'N/A'})\n`;
                    }
                    else {
                        summary += `(Found)\n`; // Keep it simple
                    }
                }
                else {
                    summary += `(Not Found)\n`;
                }
            }
            catch (err) {
                summary += `(Error reading: ${err.message})\n`;
            }
        }
        return summary + "\n"; // Add trailing newline
    });
}
/**
 * Checks for the existence of defined entry points relative to a base path.
 * @param basePath - Absolute path to the base directory.
 * @returns Formatted entry point summary string.
 */
function generateEntryPointSummary(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        let summary = "--- Entry Points ---\n";
        for (const ep of ENTRY_POINTS) {
            const filePath = path_1.default.join(basePath, ep); // Check relative to basePath
            summary += `- ${ep}: `;
            try {
                summary += (yield fs_extra_1.default.pathExists(filePath)) ? `(Found)\n` : `(Not Found)\n`;
            }
            catch (err) {
                summary += `(Error checking: ${err.message})\n`;
            }
        }
        return summary + "\n"; // Add trailing newline
    });
}
/**
 * Lists core dependencies from package.json and Cargo.toml relative to a base path.
 * @param basePath - Absolute path to the base directory.
 * @returns Formatted dependency summary string.
 */
function generateDependencySummary(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        let summary = "--- Core Dependencies ---\n";
        // Frontend Deps
        summary += "- Frontend (package.json):\n";
        const pkgJsonPath = path_1.default.join(basePath, 'package.json');
        try {
            if (yield fs_extra_1.default.pathExists(pkgJsonPath)) {
                const pkgJson = yield fs_extra_1.default.readJson(pkgJsonPath);
                const deps = Object.assign(Object.assign({}, pkgJson.dependencies), pkgJson.devDependencies);
                let foundCount = 0;
                CORE_DEPS.forEach(dep => {
                    if (deps[dep]) {
                        summary += `  - ${dep}: ${deps[dep]}\n`;
                        foundCount++;
                    }
                });
                if (foundCount === 0)
                    summary += "  (No specified core frontend dependencies found)\n";
            }
            else {
                summary += "  (package.json not found)\n";
            }
        }
        catch (err) {
            summary += `  (Error reading package.json: ${err.message})\n`;
        }
        // Backend Deps
        summary += "- Backend (src-tauri/Cargo.toml):\n";
        const cargoTomlPath = path_1.default.join(basePath, 'src-tauri/Cargo.toml');
        try {
            if (yield fs_extra_1.default.pathExists(cargoTomlPath)) {
                const cargoContent = yield fs_extra_1.default.readFile(cargoTomlPath, 'utf-8');
                let foundCount = 0;
                RUST_CORE_DEPS.forEach(depPrefix => {
                    const regex = new RegExp(`^${depPrefix.trim()}\\s*=`, 'm');
                    if (cargoContent.includes(depPrefix) || regex.test(cargoContent)) {
                        summary += `  - ${depPrefix.trim()}\n`;
                        foundCount++;
                    }
                });
                if (foundCount === 0)
                    summary += "  (No specified core backend dependencies found via basic scan)\n";
            }
            else {
                summary += "  (src-tauri/Cargo.toml not found)\n";
            }
        }
        catch (err) {
            summary += `  (Error reading Cargo.toml: ${err.message})\n`;
        }
        return summary + "\n"; // Add trailing newline
    });
}
/**
 * Provides a simple listing of top-level directories within scan roots relative to a base path.
 * @param basePath - Absolute path to the base directory.
 * @returns Formatted directory summary string.
 */
function generateDirectorySummary(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        let summary = "--- Top-Level Directory Summary ---\n";
        try {
            const topLevelEntries = yield fs_extra_1.default.readdir(basePath, { withFileTypes: true });
            const directories = topLevelEntries
                .filter(entry => entry.isDirectory())
                .sort((a, b) => a.name.localeCompare(b.name));
            // List directories, checking against ignores
            let listedDirs = 0;
            for (const dir of directories) {
                // Check if the directory name itself matches any simple ignore pattern base name
                const isIgnored = IGNORE_PATTERNS.some(pattern => {
                    // Basic check: if pattern is like '**/name/**', check 'name'
                    const baseIgnore = pattern.split('/').filter(part => part && part !== '**').pop();
                    return baseIgnore === dir.name;
                });
                if (!isIgnored) {
                    summary += `- ${dir.name}/\n`;
                    listedDirs++;
                    // Optionally list subdirs for src/src-tauri
                    if (SCAN_DIRS.includes(dir.name)) {
                        const fullDirPath = path_1.default.join(basePath, dir.name);
                        try {
                            const subEntries = yield fs_extra_1.default.readdir(fullDirPath, { withFileTypes: true });
                            const subDirs = subEntries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
                            subDirs.forEach(subDir => {
                                // Add simple check for subdirs too
                                const isSubIgnored = IGNORE_PATTERNS.some(pattern => pattern.includes(`/${subDir.name}/`));
                                if (!isSubIgnored) {
                                    summary += `  - ${subDir.name}/\n`;
                                }
                            });
                        }
                        catch (err) { /* Ignore sub-read errors */ }
                    }
                }
            }
            if (listedDirs === 0)
                summary += "(No relevant top-level directories found)\n";
        }
        catch (err) {
            summary += `(Error reading base directory ${basePath}: ${err.message})\n`;
        }
        return summary + "\n"; // Add trailing newline
    });
}
/**
 * Gathers overview data for a specific path.
 * @param basePath - The absolute path to analyze.
 * @returns An object containing the gathered data.
 */
function gatherOverviewData(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`DEBUG [overview]: Gathering overview data for: ${basePath}`);
        if (!(yield fs_extra_1.default.pathExists(basePath))) {
            console.error(`ERROR [overview]: Path not found: ${basePath}`);
            // Return minimal structure on error
            return {
                targetPath: basePath,
                fileList: [],
                configSummary: "--- Key Config Files ---\n(Path not found)\n\n",
                entryPointSummary: "--- Entry Points ---\n(Path not found)\n\n",
                dependencySummary: "--- Core Dependencies ---\n(Path not found)\n\n",
                directorySummary: "--- Top-Level Directory Summary ---\n(Path not found)\n\n",
            };
        }
        const fileList = yield getRelativeProjectFiles(basePath);
        const configSummary = yield generateConfigSummary(basePath);
        const entryPointSummary = yield generateEntryPointSummary(basePath);
        const dependencySummary = yield generateDependencySummary(basePath);
        const directorySummary = yield generateDirectorySummary(basePath); // Note: dir summary doesn't modify fileList here
        return {
            targetPath: basePath,
            fileList: fileList,
            configSummary: configSummary,
            entryPointSummary: entryPointSummary,
            dependencySummary: dependencySummary,
            directorySummary: directorySummary,
        };
    });
}
// --- Main Overview Generation Function ---
/**
 * REFACTORED: Generates the full overview report string and returns the file list
 * for the primary target path. Handles comparison if options.comparePath is provided.
 * @param targetPath - Absolute path to the primary project root/directory.
 * @param options - Options object possibly containing comparePath.
 * @returns Promise resolving to an object containing the report string and the file list for the primary targetPath.
 */
function generateOverviewAndGetFileList(targetPath_1) {
    return __awaiter(this, arguments, void 0, function* (targetPath, options = {}) {
        console.log(`DEBUG [overview]: Starting overview generation for target: ${targetPath}`);
        if (options.comparePath) {
            console.log(`DEBUG [overview]: Comparison mode activated with: ${options.comparePath}`);
        }
        // --- Gather data for the primary target path ---
        const primaryData = yield gatherOverviewData(targetPath);
        let combinedFileList = [...primaryData.fileList]; // Start with primary list
        // --- Initialize Report ---
        let report = `=== Maestro Project Overview ===\n`;
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `Primary Target: ${primaryData.targetPath}\n`;
        if (options.comparePath)
            report += `Comparison Target: ${options.comparePath}\n`;
        report += "=================================\n\n";
        // --- Comparison Mode Logic ---
        let compareData = null;
        if (options.comparePath) {
            compareData = yield gatherOverviewData(options.comparePath);
            // Prefix comparison file paths to avoid clashes in the report (optional, but good practice)
            const prefixedCompareList = compareData.fileList.map(f => `[COMPARE] ${f}`);
            // Combine lists for the index section
            combinedFileList = [...primaryData.fileList, ...prefixedCompareList];
            combinedFileList.sort(); // Sort the combined list
        }
        // --- Section 1: Combined File Index ---
        report += "=== Numbered File Index (Combined if Comparing) ===\n";
        if (combinedFileList.length === 0) {
            report += "(No files found matching scan criteria in primary or comparison target)\n";
        }
        else {
            report += generateIndexString(combinedFileList, 1); // Generate index from combined list
        }
        report += "==================================================\n\n";
        // --- Section 2: Primary Target Details ---
        report += `=== Details for Primary Target: ${path_1.default.basename(primaryData.targetPath)} ===\n`;
        report += primaryData.configSummary;
        report += primaryData.entryPointSummary;
        report += primaryData.dependencySummary;
        report += primaryData.directorySummary;
        report += "===============================================\n\n";
        // --- Section 3: Comparison Target Details (if applicable) ---
        if (compareData) {
            report += `=== Details for Comparison Target: ${path_1.default.basename(compareData.targetPath)} ===\n`;
            report += compareData.configSummary;
            report += compareData.entryPointSummary;
            report += compareData.dependencySummary;
            report += compareData.directorySummary;
            report += "==================================================\n\n";
        }
        // Include the static help text at the end
        report += `The Distributed Alignment and Context Orchestration tool (DAC-O) was created by Benjamin Webster...\n`; // Truncated for brevity
        // ... (Paste the full static help text block here from your original file) ...
        report += `Context is King! \n\nLove, \n\n          Ben       ;-*\n`;
        console.log("DEBUG [overview]: Finished overview generation.");
        // IMPORTANT: Return the fileList ONLY for the *primary* targetPath,
        // as this is needed for subsequent --indices lookups relative to that target.
        return { reportString: report, fileList: primaryData.fileList };
    });
}
//# sourceMappingURL=overview.js.map