"use strict";
// src/commands/integr8/index.ts
// Main Orchestrator — central entry point that wires all three stages together.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIntegr8Command = runIntegr8Command;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const dataIngestion_js_1 = require("../indexing/data-ingestion.js");
const relationshipAnalyzer_js_1 = require("../analysis/relationship-analyzer.js");
const pathGenerator_js_1 = require("../analysis/path-generator.js");
const tomlSerializer_js_1 = require("./toml-serializer.js");
const reportGenerator_js_1 = require("../analysis/report-generator.js");
const databasePersister_js_1 = require("../../core/database/graph-persister.js");
/**
 * Runs the full integr8 pipeline: ingest → analyze → generate path → output.
 *
 * @param args - Validated arguments from CLI parsing
 * @returns Integr8Output with migration plan, report, graph, outcome, and reasons
 */
function runIntegr8Command(args) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`\n=== integr8: Semantic Graph Compiler ===`);
        console.log(`Source: ${args.externalProjectPath}`);
        console.log(`Target: ${args.currentProjectPath}`);
        console.log(`Pages:  ${args.targetPages.join(', ')}`);
        console.log(`Strategy: ${args.strategy} | Format: ${args.format}\n`);
        // Stage 1: Data Ingestion
        console.log('[Stage 1/3] Ingesting project data...');
        const { externalGraph, currentGraph } = yield (0, dataIngestion_js_1.ingestProjectData)({
            externalPath: args.externalProjectPath,
            currentPath: args.currentProjectPath,
            targetPages: args.targetPages
        });
        console.log(`  External: ${externalGraph.nodes.length} nodes`);
        console.log(`  Current:  ${currentGraph.nodes.length} nodes`);
        // Stage 2: Relationship Analysis
        console.log('[Stage 2/3] Analyzing relationships...');
        const analysis = (0, relationshipAnalyzer_js_1.analyzeRelationships)(externalGraph, currentGraph, args.targetPages);
        console.log(`  Edges: ${analysis.unifiedGraph.edges.length}`);
        console.log(`  Conflicts: ${analysis.conflicts.length}`);
        console.log(`  Reachability: ${(analysis.unifiedGraph.properties.reachability * 100).toFixed(1)}%`);
        // Stage 3: Path Generation
        console.log('[Stage 3/3] Generating migration path...');
        const { plan, outcome, reasons } = (0, pathGenerator_js_1.generateMigrationPath)(analysis.unifiedGraph, analysis.conflicts, args.targetPages, args.externalProjectPath, args.currentProjectPath);
        console.log(`  Outcome: ${outcome}`);
        console.log(`  Steps: ${plan.steps.length}`);
        console.log(`  Complexity: ${plan.estimatedComplexity}`);
        // Build output
        const output = {
            migrationPlan: plan,
            migrationReport: '', // generated below
            semanticGraph: analysis.unifiedGraph,
            outcome,
            reasons
        };
        // Generate report
        output.migrationReport = (0, reportGenerator_js_1.generateMigrationReport)(output);
        // Write output artifacts (unless dry-run)
        if (!args.dryRun) {
            yield fs.ensureDir(args.outputDir);
            // Write TOML migration plan
            const tomlContent = (0, tomlSerializer_js_1.serializeMigrationPlanToToml)(plan);
            yield fs.writeFile(path.join(args.outputDir, 'migration_plan.toml'), tomlContent);
            // Write Markdown report
            yield fs.writeFile(path.join(args.outputDir, 'migration_report.md'), output.migrationReport);
            // Write graph JSON
            const graphJson = JSON.stringify({
                nodes: analysis.unifiedGraph.nodes,
                edges: analysis.unifiedGraph.edges,
                properties: analysis.unifiedGraph.properties
            }, null, 2);
            yield fs.writeFile(path.join(args.outputDir, 'graph.json'), graphJson);
            console.log(`\nArtifacts written to: ${args.outputDir}/`);
            console.log('  - migration_plan.toml');
            console.log('  - migration_report.md');
            console.log('  - graph.json');
        }
        else {
            console.log('\n[DRY RUN] No files written.');
        }
        // Persist to SQLite if --save-graph was specified
        if (args.saveGraph) {
            const persister = new databasePersister_js_1.DatabasePersister();
            persister.saveGraph(plan.id, analysis.unifiedGraph.nodes, analysis.unifiedGraph.edges, analysis.unifiedGraph.properties);
            persister.saveMigrationPlan(plan);
            console.log(`\n[save-graph] Persisted to: ${(0, databasePersister_js_1.getSharedDatabasePath)()}`);
            console.log(`  Graph ID: ${plan.id}`);
            console.log(`  Nodes: ${analysis.unifiedGraph.nodes.length}, Edges: ${analysis.unifiedGraph.edges.length}`);
            persister.close();
        }
        // Summary
        console.log(`\n=== OUTCOME: ${outcome} ===`);
        reasons.forEach(r => console.log(`  • ${r}`));
        console.log('');
        return output;
    });
}
//# sourceMappingURL=index.js.map