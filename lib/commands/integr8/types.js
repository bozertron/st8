"use strict";
// src/commands/integr8/types.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationLevel = exports.ResolutionStrategy = exports.ConflictType = exports.MigrationAction = exports.EdgeType = exports.NodeType = exports.DependencyStatus = exports.IntegrationOutcome = void 0;
// ============ ENUMS ============
var IntegrationOutcome;
(function (IntegrationOutcome) {
    IntegrationOutcome["SUCCESS"] = "SUCCESS";
    IntegrationOutcome["PARTIAL"] = "PARTIAL";
    IntegrationOutcome["FAILURE"] = "FAILURE";
    IntegrationOutcome["AMBIGUOUS"] = "AMBIGUOUS";
    IntegrationOutcome["REDIRECT"] = "REDIRECT"; // Critical dependency unavailable, suggest alternative
})(IntegrationOutcome || (exports.IntegrationOutcome = IntegrationOutcome = {}));
var DependencyStatus;
(function (DependencyStatus) {
    DependencyStatus["SAFE"] = "SAFE";
    DependencyStatus["NEEDS_REWRITE"] = "NEEDS_REWRITE";
    DependencyStatus["CONFLICT"] = "CONFLICT";
    DependencyStatus["MISSING"] = "MISSING"; // Not found in target project
})(DependencyStatus || (exports.DependencyStatus = DependencyStatus = {}));
var NodeType;
(function (NodeType) {
    NodeType["FILE"] = "file";
    NodeType["STORE"] = "store";
    NodeType["ROUTE"] = "route";
    NodeType["COMMAND"] = "command";
    NodeType["TYPE"] = "type";
    NodeType["IMPORT"] = "import";
    NodeType["EXPORT"] = "export";
    NodeType["COMPONENT"] = "component";
    NodeType["FUNCTION"] = "function";
    NodeType["VARIABLE"] = "variable";
})(NodeType || (exports.NodeType = NodeType = {}));
var EdgeType;
(function (EdgeType) {
    EdgeType["DEPENDS_ON"] = "depends_on";
    EdgeType["IMPORTS"] = "imports";
    EdgeType["EXPORTS"] = "exports";
    EdgeType["NAVIGATES_TO"] = "navigates_to";
    EdgeType["INVOKES"] = "invokes";
    EdgeType["CONFLICTS_WITH"] = "conflicts_with";
    EdgeType["CONTAINS"] = "contains";
    EdgeType["CALLS"] = "calls";
    EdgeType["READS"] = "reads";
    EdgeType["WRITES"] = "writes";
    EdgeType["DYNAMIC_IMPORT"] = "dynamic_import";
    EdgeType["REEXPORTS"] = "reexports";
})(EdgeType || (exports.EdgeType = EdgeType = {}));
var MigrationAction;
(function (MigrationAction) {
    MigrationAction["COPY_FILE"] = "copy_file";
    MigrationAction["REWRITE_IMPORT"] = "rewrite_import";
    MigrationAction["MERGE_ROUTE"] = "merge_route";
    MigrationAction["RESOLVE_CONFLICT"] = "resolve_conflict";
    MigrationAction["RUN_COMMAND"] = "run_command";
    MigrationAction["VERIFY"] = "verify";
})(MigrationAction || (exports.MigrationAction = MigrationAction = {}));
var ConflictType;
(function (ConflictType) {
    ConflictType["NAME_COLLISION"] = "name_collision";
    ConflictType["TYPE_MISMATCH"] = "type_mismatch";
    ConflictType["VERSION_CONFLICT"] = "version_conflict";
    ConflictType["CIRCULAR_DEPENDENCY"] = "circular_dependency";
    ConflictType["API_INCOMPATIBILITY"] = "api_incompatibility";
    ConflictType["MISSING_DEPENDENCY"] = "missing_dependency";
})(ConflictType || (exports.ConflictType = ConflictType = {}));
var ResolutionStrategy;
(function (ResolutionStrategy) {
    ResolutionStrategy["RENAME"] = "rename";
    ResolutionStrategy["MERGE"] = "merge";
    ResolutionStrategy["OVERWRITE"] = "overwrite";
    ResolutionStrategy["IGNORE"] = "ignore";
    ResolutionStrategy["CUSTOM"] = "custom";
})(ResolutionStrategy || (exports.ResolutionStrategy = ResolutionStrategy = {}));
// ============ TIER 2: ENHANCED VERIFY (I-06) ============
var VerificationLevel;
(function (VerificationLevel) {
    VerificationLevel["SYNTAX"] = "syntax";
    VerificationLevel["IMPORT_RESOLUTION"] = "import_resolution";
    VerificationLevel["TYPE_CHECK"] = "type_check";
    VerificationLevel["SEMANTIC"] = "semantic";
})(VerificationLevel || (exports.VerificationLevel = VerificationLevel = {}));
//# sourceMappingURL=types.js.map