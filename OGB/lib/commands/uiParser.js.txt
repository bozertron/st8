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
exports.generateUiComponentReport = generateUiComponentReport;
// C:\orchestr8\scripts\prd src\uiParser.ts
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const fast_glob_1 = __importDefault(require("fast-glob"));
// --- Constants ---
// Default relative paths if targetPath is a directory
const DEFAULT_COMPONENTS_DIR = 'src/components';
const DEFAULT_VIEWS_DIR = 'src/views';
// Default pattern if none is provided via options
const DEFAULT_UI_PATTERN = /<n-([a-zA-Z0-9-]+)/g; // Default to NaiveUI
// --- Helper Functions ---
/**
 * Determines the type of UI component based on its absolute path relative to a base path.
 * @param absoluteFilePath - The absolute path to the component file.
 * @param basePath - The absolute base path (targetPath) the scan started from.
 * @returns 'View', 'Component', 'Sub-Component', or 'Unknown'.
 */
function determineComponentType(absoluteFilePath, basePath) {
    const relativeFilePath = path_1.default.relative(basePath, absoluteFilePath).replace(/\\/g, '/'); // Get path relative to base
    const normalizedBasePath = basePath.replace(/\\/g, '/');
    // Define paths relative to the basePath for comparison
    const viewsDirRel = DEFAULT_VIEWS_DIR.replace(/\\/g, '/');
    const componentsDirRel = DEFAULT_COMPONENTS_DIR.replace(/\\/g, '/');
    // console.log(`DEBUG [ui]: Determining type for ${relativeFilePath} (relative to ${normalizedBasePath})`);
    // console.log(`DEBUG [ui]: Checking against Views: ${viewsDirRel}, Components: ${componentsDirRel}`);
    if (relativeFilePath.startsWith(viewsDirRel + '/')) {
        // console.log(`DEBUG [ui]: Identified as View`);
        return 'View';
    }
    else if (relativeFilePath.startsWith(componentsDirRel + '/')) {
        // Check if it's directly inside components or in a subdirectory
        const pathWithinComponents = relativeFilePath.substring(componentsDirRel.length + 1);
        if (pathWithinComponents.includes('/')) {
            // console.log(`DEBUG [ui]: Identified as Sub-Component (within ${pathWithinComponents})`);
            return 'Sub-Component';
        }
        else {
            // console.log(`DEBUG [ui]: Identified as Component (directly under components)`);
            return 'Component';
        }
    }
    // console.log(`DEBUG [ui]: Could not determine component type, defaulting to Unknown`);
    return 'Unknown';
}
/**
 * Extract UI components used in a file based on a provided regex pattern.
 * @param content - The file content string.
 * @param pattern - The RegExp pattern to use for matching components.
 * @returns Array of unique component tag names (e.g., ['n-button', 'n-input']).
 */
function extractUiComponents(content, pattern) {
    // Ensure the pattern has the global flag for matchAll
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    const matches = Array.from(content.matchAll(globalPattern));
    const components = new Set();
    matches.forEach(match => {
        // Assuming the pattern captures the full tag or a significant part
        // This might need adjustment based on the actual uiPattern format.
        // For the default <n-tag>, match[0] is the full tag like '<n-button'
        // We'll store the matched tag prefix (e.g., 'n-button')
        if (match[0]) {
            // Simple extraction: remove '<' if present, could be more robust
            const tagName = match[0].startsWith('<') ? match[0].substring(1) : match[0];
            components.add(tagName);
        }
    });
    return Array.from(components);
}
/**
 * Analyzes Vue files based on targetPath to find UI component usage matching a pattern.
 * @param targetPath - Absolute path to the target directory or file.
 * @param uiPatternRegex - The compiled RegExp to use for matching.
 * @returns Promise resolving to an array of ComponentInfo objects.
 */
function analyzeUiComponents(targetPath, uiPatternRegex) {
    return __awaiter(this, void 0, void 0, function* () {
        const componentInfos = [];
        let filesToScan = []; // Store absolute paths
        console.log(`DEBUG [ui]: Analyzing UI components for target: ${targetPath}`);
        try {
            const targetStats = yield fs_extra_1.default.stat(targetPath);
            if (targetStats.isDirectory()) {
                // Scan default component/view directories relative to targetPath
                const componentScanDir = path_1.default.join(targetPath, DEFAULT_COMPONENTS_DIR);
                const viewScanDir = path_1.default.join(targetPath, DEFAULT_VIEWS_DIR);
                const dirsToScan = [componentScanDir, viewScanDir];
                for (const dir of dirsToScan) {
                    if (!(yield fs_extra_1.default.pathExists(dir))) {
                        console.warn(`WARN [ui]: Directory not found: ${dir}`);
                        continue;
                    }
                    try {
                        const files = yield (0, fast_glob_1.default)('**/*.vue', {
                            cwd: dir,
                            onlyFiles: true,
                            absolute: true, // Get absolute paths
                        });
                        filesToScan.push(...files);
                    }
                    catch (err) {
                        console.error(`ERROR [ui]: Failed to scan directory ${dir}:`, err);
                    }
                }
                console.log(`DEBUG [ui]: Found ${filesToScan.length} potential Vue files in default directories.`);
            }
            else if (targetStats.isFile() && targetPath.endsWith('.vue')) {
                if (yield fs_extra_1.default.pathExists(targetPath)) {
                    console.log(`DEBUG [ui]: Target is a single Vue file: ${targetPath}`);
                    filesToScan = [targetPath];
                }
                else {
                    console.warn(`WARN [ui]: Target file specified but not found: ${targetPath}`);
                }
            }
            else {
                console.log(`DEBUG [ui]: Target ${targetPath} is not a directory or .vue file. Skipping UI scan.`);
            }
        }
        catch (err) {
            console.error(`ERROR [ui]: Cannot stat target path ${targetPath}:`, err);
            return componentInfos; // Return empty on error
        }
        // Process each found Vue file
        for (const absolutePath of filesToScan) {
            try {
                const relativePath = path_1.default.relative(targetPath, absolutePath).replace(/\\/g, '/');
                const content = yield fs_extra_1.default.readFile(absolutePath, 'utf-8');
                const componentType = determineComponentType(absolutePath, targetPath);
                const uiElements = extractUiComponents(content, uiPatternRegex);
                componentInfos.push({
                    relativePath: relativePath,
                    absolutePath: absolutePath,
                    componentType: componentType,
                    uiElements: uiElements,
                });
            }
            catch (err) {
                console.error(`ERROR [ui]: Failed to process file ${absolutePath}:`, err);
            }
        }
        console.log(`DEBUG [ui]: Analysis complete. Found ${componentInfos.length} Vue files containing ${componentInfos.reduce((sum, ci) => sum + ci.uiElements.length, 0)} UI elements matching pattern.`);
        return componentInfos;
    });
}
// --- Main UI Component Report Generation Function ---
/**
 * REFACTORED: Generates a report of UI components used in the project.
 * Handles configurable UI pattern and comparison.
 * @param targetPath - Absolute path to the target directory or file.
 * @param options - Options object with uiPattern and potentially comparePath.
 * @returns Promise resolving to the formatted UI component report string.
 */
function generateUiComponentReport(targetPath_1) {
    return __awaiter(this, arguments, void 0, function* (targetPath, options = {}) {
        const { uiPattern: uiPatternString, comparePath } = options;
        console.log(`DEBUG [ui]: Starting UI component report generation for target: ${targetPath}`);
        let report = "=== UI Components Usage Analysis ===\n"; // Changed title slightly
        report += `Analysis Time: ${new Date().toISOString()}\n`;
        // --- Determine UI Pattern Regex ---
        let uiPatternRegex;
        let patternSource = uiPatternString || DEFAULT_UI_PATTERN.source; // Use provided or default source
        try {
            // Ensure global flag is present for matchAll
            uiPatternRegex = new RegExp(patternSource, 'g');
            report += `Using UI Pattern: /${uiPatternRegex.source}/${uiPatternRegex.flags}\n\n`;
        }
        catch (e) {
            console.error(`ERROR [ui]: Invalid UI pattern provided: "${uiPatternString}". Defaulting to NaiveUI pattern. Error: ${e}`);
            uiPatternRegex = DEFAULT_UI_PATTERN; // Fallback safely
            report += `Using Default UI Pattern (NaiveUI): /${uiPatternRegex.source}/${uiPatternRegex.flags}\n\n`;
        }
        // --- Analyze Primary Target ---
        const primaryComponents = yield analyzeUiComponents(targetPath, uiPatternRegex);
        // --- Analyze Comparison Target (if applicable) ---
        let compareComponents = [];
        if (comparePath) {
            console.log(`DEBUG [ui]: Processing comparison target: ${comparePath}`);
            compareComponents = yield analyzeUiComponents(comparePath, uiPatternRegex);
        }
        // --- Format Report (Based on Primary Target First) ---
        report += `--- Component Usage in Primary Target: ${targetPath} ---\n`;
        if (primaryComponents.length === 0) {
            report += "(No relevant Vue files found or processed)\n\n";
        }
        else {
            // Group primary components by type for the report structure
            const views = primaryComponents.filter(c => c.componentType === 'View');
            const components = primaryComponents.filter(c => c.componentType === 'Component');
            const subComponents = primaryComponents.filter(c => c.componentType === 'Sub-Component');
            const unknown = primaryComponents.filter(c => c.componentType === 'Unknown');
            const formatSection = (folderName, files) => {
                if (files.length === 0)
                    return;
                report += `\nFolder Name: ${folderName}\n`;
                files.forEach(info => {
                    const fileName = path_1.default.basename(info.relativePath);
                    // Adjust display name slightly for sub-components if desired
                    const displayName = info.componentType === 'Sub-Component' ? `Sub-Component ${fileName}` : fileName;
                    report += ` File Name: ${displayName} (${info.relativePath})\n`; // Include relative path for context
                    report += `  UI Elements (${info.uiElements.length}): ${info.uiElements.length ? info.uiElements.join(', ') : 'None found'}\n`;
                });
                report += "\n";
            };
            formatSection('views', views);
            formatSection('components', components);
            formatSection('Sub-Components', subComponents); // Group sub-components together
            // Optionally list Unknown files
            if (unknown.length > 0) {
                report += "\nFolder Name: Unknown/Other\n";
                unknown.forEach(info => {
                    report += ` File Name: ${path_1.default.basename(info.relativePath)} (${info.relativePath})\n`;
                    report += `  UI Elements (${info.uiElements.length}): ${info.uiElements.length ? info.uiElements.join(', ') : 'None found'}\n`;
                });
                report += "\n";
            }
        }
        // --- Add Comparison Section ---
        if (comparePath) {
            report += `--- Comparison Summary vs: ${comparePath} ---\n`;
            // Example Comparison: Compare the sets of unique UI element tags found
            const primaryElements = new Set(primaryComponents.flatMap(c => c.uiElements));
            const compareElements = new Set(compareComponents.flatMap(c => c.uiElements));
            const commonElements = [...primaryElements].filter(el => compareElements.has(el));
            const uniqueToPrimaryElements = [...primaryElements].filter(el => !compareElements.has(el));
            const uniqueToCompareElements = [...compareElements].filter(el => !primaryElements.has(el));
            report += `Common UI Elements (${commonElements.length}): ${commonElements.join(', ') || 'None'}\n`;
            report += `Elements Unique to Primary (${uniqueToPrimaryElements.length}): ${uniqueToPrimaryElements.join(', ') || 'None'}\n`;
            report += `Elements Unique to Comparison (${uniqueToCompareElements.length}): ${uniqueToCompareElements.join(', ') || 'None'}\n\n`;
            // Future: Could add file-by-file comparison if needed
        }
        report += "=====================================\n";
        console.log("DEBUG [ui]: Finished UI component report generation.");
        return report;
    });
}
//# sourceMappingURL=uiParser.js.map