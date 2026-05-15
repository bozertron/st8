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
exports.generateCommandReport = generateCommandReport;
// C:\orchestr8\scripts\prd src\commandParser.ts
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const fast_glob_1 = __importDefault(require("fast-glob"));
// --- Constants ---
// Removed MAESTRO_ROOT - paths will be derived from targetPath
const TAURI_COMMANDS_SUBDIR = 'src-tauri/src/commands'; // Relative subdirectory for Rust commands
const FRONTEND_SUBDIRS = ['src']; // Relative subdirectories to look for invoke() calls
// Regex patterns (unchanged)
const INVOKE_PATTERN = /invoke\(\s*['"]([^'"]+)['"]/g;
const TAURI_COMMAND_PATTERN = /#\[tauri::command\][\s\n]*(?:pub\s*)?(?:async\s*)?fn\s+([a-zA-Z0-9_]+)/g;
// --- Helper Functions ---
/**
 * Find frontend invoke() calls within a given base path.
 * If basePath is a directory, scans specified subdirectories.
 * If basePath is a file, scans only that file.
 * @param basePath - Absolute path to the target directory or file.
 * @returns Map of command names to arrays of file paths where they're used (relative to basePath if it was a dir).
 */
function findInvokeCalls(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const commandUsage = new Map();
        const stats = yield fs_extra_1.default.stat(basePath);
        const isDirectory = stats.isDirectory();
        let filesToScan = [];
        let cwd = basePath; // Default cwd
        if (isDirectory) {
            console.log(`DEBUG [commands]: Scanning for invoke calls in subdirs of ${basePath}`);
            const patterns = FRONTEND_SUBDIRS.map(dir => `${dir}/**/*.{ts,js,vue}`);
            cwd = basePath; // Set cwd for glob to the target directory
            try {
                filesToScan = yield (0, fast_glob_1.default)(patterns, {
                    cwd: cwd,
                    ignore: ['**/node_modules/**', '**/dist/**'],
                    onlyFiles: true,
                    absolute: false // Get paths relative to cwd
                });
                console.log(`DEBUG [commands]: Found ${filesToScan.length} potential files in subdirs.`);
            }
            catch (err) {
                console.error(`ERROR [commands]: Failed to glob for files in ${basePath}: ${err}`);
                return commandUsage; // Return empty map on glob error
            }
        }
        else {
            // If it's a file, check if it's a relevant type
            if (/\.(ts|js|vue)$/.test(basePath)) {
                console.log(`DEBUG [commands]: Scanning single file for invoke calls: ${basePath}`);
                filesToScan = [basePath]; // The list contains only the target file
                cwd = path_1.default.dirname(basePath); // Use file's directory context if needed later, though absolute path is used below
            }
            else {
                console.log(`DEBUG [commands]: Target path ${basePath} is not a relevant frontend file type (.ts, .js, .vue). Skipping invoke scan.`);
                return commandUsage; // Not a file type we scan
            }
        }
        // Scan each file for invoke patterns
        for (const file of filesToScan) {
            // Construct absolute path if needed (glob returns relative if cwd is set)
            // If scanning single file, 'file' is already the absolute path.
            const filePath = isDirectory ? path_1.default.join(cwd, file) : file;
            const displayPath = isDirectory ? file : path_1.default.basename(filePath); // Show relative path for dirs, just filename for single file
            try {
                const content = yield fs_extra_1.default.readFile(filePath, 'utf-8');
                const matches = Array.from(content.matchAll(INVOKE_PATTERN));
                if (matches.length > 0) {
                    console.log(`DEBUG [commands]: Found ${matches.length} invoke calls in ${displayPath}`);
                }
                for (const match of matches) {
                    const commandName = match[1];
                    if (!commandUsage.has(commandName)) {
                        commandUsage.set(commandName, []);
                    }
                    // Store the display path (relative or filename)
                    commandUsage.get(commandName).push(displayPath);
                }
            }
            catch (err) {
                // Log error but continue scanning other files
                console.error(`ERROR [commands]: Failed to read/scan file ${filePath}: ${err}`);
            }
        }
        if (commandUsage.size > 0) {
            console.log(`DEBUG [commands]: Found ${commandUsage.size} unique invoked command names.`);
        }
        return commandUsage;
    });
}
/**
 * Parse Rust source code to find Tauri command declarations.
 * If basePath is a directory, scans the 'src-tauri/src/commands' subdirectory.
 * If basePath is a file, scans only that file if it's a .rs file.
 * @param basePath - Absolute path to the target directory or file.
 * @returns Map of command names to their source file and line number.
 */
function findTauriCommandDeclarations(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const commandDeclarations = new Map();
        const stats = yield fs_extra_1.default.stat(basePath);
        const isDirectory = stats.isDirectory();
        let filesToScan = [];
        let scanDir = '';
        let cwd = basePath; // Default CWD for relative path calculation
        if (isDirectory) {
            scanDir = path_1.default.join(basePath, TAURI_COMMANDS_SUBDIR);
            cwd = scanDir; // Set cwd for glob
            console.log(`DEBUG [commands]: Scanning for Tauri commands in ${scanDir}`);
            try {
                if (!(yield fs_extra_1.default.pathExists(scanDir))) {
                    console.warn(`WARN [commands]: Tauri commands directory not found: ${scanDir}`);
                    return commandDeclarations;
                }
                filesToScan = yield (0, fast_glob_1.default)(['**/*.rs'], {
                    cwd: cwd,
                    onlyFiles: true,
                    absolute: false // Get paths relative to cwd
                });
                console.log(`DEBUG [commands]: Found ${filesToScan.length} potential Rust files in ${scanDir}.`);
            }
            catch (err) {
                console.error(`ERROR [commands]: Failed to glob for Rust files in ${scanDir}: ${err}`);
                return commandDeclarations;
            }
        }
        else {
            // If it's a file, check if it's a Rust file
            if (/\.rs$/.test(basePath)) {
                console.log(`DEBUG [commands]: Scanning single file for Tauri commands: ${basePath}`);
                filesToScan = [basePath]; // List contains only the target file
                cwd = path_1.default.dirname(basePath);
            }
            else {
                console.log(`DEBUG [commands]: Target path ${basePath} is not a Rust file (.rs). Skipping Tauri command scan.`);
                return commandDeclarations;
            }
        }
        // Scan each file for Tauri command declarations
        for (const file of filesToScan) {
            const filePath = isDirectory ? path_1.default.join(cwd, file) : file; // Construct absolute path if needed
            const displayPath = isDirectory ? path_1.default.join(TAURI_COMMANDS_SUBDIR, file) : path_1.default.basename(filePath); // Show relative path from project root or just filename
            try {
                const content = yield fs_extra_1.default.readFile(filePath, 'utf-8');
                const matches = Array.from(content.matchAll(TAURI_COMMAND_PATTERN));
                if (matches.length > 0) {
                    console.log(`DEBUG [commands]: Found ${matches.length} command declarations in ${displayPath}`);
                }
                for (const match of matches) {
                    if (match && match[1]) {
                        const commandName = match[1];
                        // Crude way to get a "line" context - might be improved
                        // const lineNum = (content.substring(0, match.index).match(/\n/g) || []).length + 1;
                        const lineContext = `#[tauri::command] fn ${commandName}(...)`; // Simplified representation
                        commandDeclarations.set(commandName, {
                            file: displayPath,
                            line: lineContext // Store simplified context
                        });
                    }
                }
            }
            catch (err) {
                console.error(`ERROR [commands]: Failed to read/scan Rust file ${filePath}: ${err}`);
            }
        }
        if (commandDeclarations.size > 0) {
            console.log(`DEBUG [commands]: Found ${commandDeclarations.size} unique command declarations.`);
        }
        return commandDeclarations;
    });
}
// --- Main Command Report Generation Function ---
/**
 * REFACTORED: Generates a report of Tauri commands detected based on a target path.
 * Scans frontend invokes and backend declarations relative to the target path.
 * @param targetPath - Absolute path to the target directory or file.
 * @param options - Command parser options (currently unused).
 * @returns Promise resolving to the formatted command report string.
 */
function generateCommandReport(targetPath_1) {
    return __awaiter(this, arguments, void 0, function* (targetPath, options = {} // Accept options object
    ) {
        console.log(`DEBUG [commands]: Starting Tauri command report generation for target: ${targetPath}`);
        // Check if target path exists before proceeding
        if (!(yield fs_extra_1.default.pathExists(targetPath))) {
            console.error(`ERROR [commands]: Target path not found: ${targetPath}`);
            return `ERROR: Target path not found: ${targetPath}`;
        }
        // Run scanners based on the targetPath
        const frontendCommands = yield findInvokeCalls(targetPath);
        const backendCommands = yield findTauriCommandDeclarations(targetPath);
        const stats = yield fs_extra_1.default.stat(targetPath);
        const context = stats.isDirectory() ? `directory ${path_1.default.basename(targetPath)}` : `file ${path_1.default.basename(targetPath)}`;
        // --- Generate Report String ---
        let report = `=== Tauri Commands Analysis for ${context} ===\n`;
        report += `Target Path: ${targetPath}\n`;
        report += `Analysis Time: ${new Date().toISOString()}\n\n`;
        // Section 1: Frontend Invokes
        report += `--- Frontend Command Usage (invoke calls found relative to target) ---\n`;
        if (frontendCommands.size === 0) {
            report += `(No frontend 'invoke' calls found in the specified target)\n`;
        }
        else {
            for (const [commandName, files] of frontendCommands.entries()) {
                report += `Command: ${commandName}\n`;
                report += `  Invoked in: ${files.length} file(s)\n`;
                // Display limited number of files for brevity
                files.slice(0, 5).forEach(f => report += `    - ${f}\n`);
                if (files.length > 5) {
                    report += `    ... and ${files.length - 5} more\n`;
                }
                report += "\n";
            }
        }
        // Section 2: Backend Declarations
        report += `\n--- Backend Command Declarations (found relative to target) ---\n`;
        if (backendCommands.size === 0) {
            report += `(No backend command declarations found in the specified target)\n`;
        }
        else {
            for (const [commandName, details] of backendCommands.entries()) {
                report += `Command: ${commandName}\n`;
                report += `  Declared in: ${details.file}\n`;
                // report += `  Declaration Context: ${details.line}\n\n`; // Keep it simple
                report += "\n";
            }
        }
        // Section 3: Cross-Reference (Only makes sense if targetPath was a directory covering both frontend/backend areas)
        if (stats.isDirectory()) {
            report += "\n--- Command Cross-Reference (within target directory) ---\n";
            const undeclaredCommands = Array.from(frontendCommands.keys())
                .filter(cmd => !backendCommands.has(cmd));
            if (undeclaredCommands.length > 0) {
                report += "Commands Invoked But Not Declared (within scope):\n";
                undeclaredCommands.forEach(cmd => report += `  - ${cmd}\n`);
            }
            else {
                report += "All invoked commands seem to have declarations (within scope).\n";
            }
            const unusedCommands = Array.from(backendCommands.keys())
                .filter(cmd => !frontendCommands.has(cmd));
            if (unusedCommands.length > 0) {
                report += "\nCommands Declared But Not Invoked (within scope):\n";
                unusedCommands.forEach(cmd => report += `  - ${cmd}\n`);
            }
            else {
                report += "\nAll declared commands seem to be invoked (within scope).\n";
            }
        }
        else {
            report += "\n--- Command Cross-Reference (Skipped: Target was a single file) ---\n";
        }
        report += "\n=================================\n";
        console.log("DEBUG [commands]: Finished Tauri command report generation.");
        return report;
    });
}
//# sourceMappingURL=commandParser.js.map