"use strict";
// src/commands/integr8/tomlSerializer.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeMigrationPlanToToml = serializeMigrationPlanToToml;
exports.serializeGraphMetadataToToml = serializeGraphMetadataToToml;
exports.parseMigrationPlanFromToml = parseMigrationPlanFromToml;
const types_1 = require("./types");
// ============ TOML STRING HELPERS ============
/**
 * Escape a string value for TOML double-quoted strings.
 * Handles backslashes, double quotes, newlines, tabs, and other control chars.
 */
function escapeTomlString(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}
/**
 * Format a value for TOML output.
 * Strings get quoted, numbers/booleans remain bare.
 */
function tomlValue(value) {
    if (typeof value === 'string') {
        return `"${escapeTomlString(value)}"`;
    }
    return String(value);
}
/**
 * Format a TOML array of strings: ["a", "b", "c"]
 */
function tomlStringArray(values) {
    const escaped = values.map(v => `"${escapeTomlString(v)}"`);
    return `[${escaped.join(', ')}]`;
}
// ============ SERIALIZATION ============
/**
 * Serialize a MigrationPlan to TOML format string.
 */
function serializeMigrationPlanToToml(plan) {
    const lines = [];
    // -- [metadata] section --
    lines.push('[metadata]');
    lines.push(`id = ${tomlValue(plan.id)}`);
    lines.push(`timestamp = ${tomlValue(plan.timestamp)}`);
    lines.push(`source_path = ${tomlValue(plan.sourcePath)}`);
    lines.push(`target_path = ${tomlValue(plan.targetPath)}`);
    lines.push(`outcome = ${tomlValue(plan.outcome)}`);
    lines.push(`estimated_complexity = ${tomlValue(plan.estimatedComplexity)}`);
    lines.push(`conflict_count = ${plan.conflictCount}`);
    lines.push('');
    // -- [[steps]] sections --
    for (const step of plan.steps) {
        lines.push('[[steps]]');
        lines.push(`step = ${step.step}`);
        lines.push(`action = ${tomlValue(step.action)}`);
        lines.push(`description = ${tomlValue(step.description)}`);
        if (step.from !== undefined) {
            lines.push(`from = ${tomlValue(step.from)}`);
        }
        if (step.to !== undefined) {
            lines.push(`to = ${tomlValue(step.to)}`);
        }
        if (step.file !== undefined) {
            lines.push(`file = ${tomlValue(step.file)}`);
        }
        if (step.conflictId !== undefined) {
            lines.push(`conflict_id = ${tomlValue(step.conflictId)}`);
        }
        if (step.resolution !== undefined) {
            lines.push(`resolution = ${tomlValue(step.resolution)}`);
        }
        if (step.command !== undefined) {
            lines.push(`command = ${tomlValue(step.command)}`);
        }
        if (step.rules !== undefined && step.rules.length > 0) {
            // Serialize rules as inline array of tables under the step
            for (const rule of step.rules) {
                lines.push('');
                lines.push('[[steps.rules]]');
                lines.push(`original_import = ${tomlValue(rule.originalImport)}`);
                lines.push(`rewritten_import = ${tomlValue(rule.rewrittenImport)}`);
                lines.push(`reason = ${tomlValue(rule.reason)}`);
            }
        }
        lines.push('');
    }
    // -- [[conflicts]] sections --
    for (const conflict of plan.conflicts) {
        lines.push('[[conflicts]]');
        lines.push(`id = ${tomlValue(conflict.id)}`);
        lines.push(`type = ${tomlValue(conflict.type)}`);
        lines.push(`item = ${tomlValue(conflict.item)}`);
        lines.push(`description = ${tomlValue(conflict.description)}`);
        lines.push(`resolution_options = ${tomlStringArray(conflict.resolutionOptions)}`);
        lines.push(`recommended = ${tomlValue(conflict.recommended)}`);
        if (conflict.details !== undefined) {
            // Serialize details as key-value pairs under a sub-table
            const detailKeys = Object.keys(conflict.details);
            if (detailKeys.length > 0) {
                lines.push(`details = ${serializeInlineTable(conflict.details)}`);
            }
        }
        lines.push('');
    }
    return lines.join('\n');
}
/**
 * Serialize a flat Record to a TOML inline table: { key = "val", num = 42 }
 */
function serializeInlineTable(obj) {
    const parts = [];
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null)
            continue;
        const safeKey = key.replace(/\s+/g, '_');
        if (typeof value === 'string') {
            parts.push(`${safeKey} = ${tomlValue(value)}`);
        }
        else if (typeof value === 'number' || typeof value === 'boolean') {
            parts.push(`${safeKey} = ${tomlValue(value)}`);
        }
        else {
            // Fallback: stringify complex values as JSON string
            parts.push(`${safeKey} = ${tomlValue(JSON.stringify(value))}`);
        }
    }
    return `{ ${parts.join(', ')} }`;
}
/**
 * Serialize graph properties to TOML format.
 */
function serializeGraphMetadataToToml(properties) {
    const lines = [];
    lines.push('[graph_properties]');
    lines.push(`reachability = ${properties.reachability}`);
    lines.push(`stability = ${properties.stability}`);
    lines.push(`fragility = ${properties.fragility}`);
    if (properties.integrationDistance !== undefined) {
        lines.push(`integration_distance = ${properties.integrationDistance}`);
    }
    return lines.join('\n');
}
/**
 * Low-level TOML line parser. Splits TOML text into named sections
 * with their key-value entries as raw strings.
 */
function tokenizeSections(tomlString) {
    const sections = [];
    let current = null;
    const lines = tomlString.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        // Skip empty lines and comments
        if (line === '' || line.startsWith('#'))
            continue;
        // Array of tables: [[name]]
        const arrayMatch = line.match(/^\[\[([^\]]+)\]\]$/);
        if (arrayMatch) {
            current = { name: arrayMatch[1].trim(), isArray: true, entries: {} };
            sections.push(current);
            continue;
        }
        // Single table: [name]
        const tableMatch = line.match(/^\[([^\]]+)\]$/);
        if (tableMatch) {
            current = { name: tableMatch[1].trim(), isArray: false, entries: {} };
            sections.push(current);
            continue;
        }
        // Key = value pair
        const kvMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s*)=(\s*)(.+)$/);
        if (kvMatch && current) {
            current.entries[kvMatch[1]] = kvMatch[4].trim();
        }
    }
    return sections;
}
/**
 * Parse a raw TOML string value into a JS value.
 * Handles quoted strings, numbers, booleans, arrays, and inline tables.
 */
function parseTomlValue(raw) {
    // Quoted string
    if (raw.startsWith('"') && raw.endsWith('"')) {
        return unescapeTomlString(raw.slice(1, -1));
    }
    // Boolean
    if (raw === 'true')
        return true;
    if (raw === 'false')
        return false;
    // Array: [ ... ]
    if (raw.startsWith('[') && raw.endsWith(']')) {
        return parseTomlArray(raw);
    }
    // Inline table: { ... }
    if (raw.startsWith('{') && raw.endsWith('}')) {
        return parseInlineTable(raw);
    }
    // Number (integer or float)
    const num = Number(raw);
    if (!isNaN(num) && raw !== '') {
        return num;
    }
    // Fallback: return as string
    return raw;
}
/**
 * Unescape TOML string escape sequences.
 */
function unescapeTomlString(value) {
    return value
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}
/**
 * Parse a TOML array value like ["a", "b", "c"] or [1, 2, 3]
 */
function parseTomlArray(raw) {
    const inner = raw.slice(1, -1).trim();
    if (inner === '')
        return [];
    const items = [];
    let current = '';
    let inQuote = false;
    let depth = 0;
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        const prev = i > 0 ? inner[i - 1] : '';
        if (ch === '"' && prev !== '\\') {
            inQuote = !inQuote;
            current += ch;
            continue;
        }
        if (!inQuote) {
            if (ch === '[' || ch === '{')
                depth++;
            if (ch === ']' || ch === '}')
                depth--;
            if (ch === ',' && depth === 0) {
                const trimmed = current.trim();
                if (trimmed !== '')
                    items.push(parseTomlValue(trimmed));
                current = '';
                continue;
            }
        }
        current += ch;
    }
    const trimmed = current.trim();
    if (trimmed !== '')
        items.push(parseTomlValue(trimmed));
    return items;
}
/**
 * Parse a TOML inline table: { key = "val", num = 42 }
 */
function parseInlineTable(raw) {
    const inner = raw.slice(1, -1).trim();
    if (inner === '')
        return {};
    const result = {};
    // Split by comma, respecting quotes
    const pairs = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        const prev = i > 0 ? inner[i - 1] : '';
        if (ch === '"' && prev !== '\\') {
            inQuote = !inQuote;
        }
        if (ch === ',' && !inQuote) {
            pairs.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    if (current.trim() !== '')
        pairs.push(current.trim());
    for (const pair of pairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1)
            continue;
        const key = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();
        result[key] = parseTomlValue(val);
    }
    return result;
}
/**
 * Parse a TOML migration plan string back to a MigrationPlan object.
 * Tolerant of comments (lines starting with #) and blank lines.
 */
function parseMigrationPlanFromToml(tomlString) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    const sections = tokenizeSections(tomlString);
    // -- Parse [metadata] --
    const metadataSection = sections.find(s => s.name === 'metadata' && !s.isArray);
    if (!metadataSection) {
        throw new Error('TOML parse error: missing [metadata] section');
    }
    const md = metadataSection.entries;
    const id = String(parseTomlValue((_a = md['id']) !== null && _a !== void 0 ? _a : '""'));
    const timestamp = String(parseTomlValue((_b = md['timestamp']) !== null && _b !== void 0 ? _b : '""'));
    const sourcePath = String(parseTomlValue((_c = md['source_path']) !== null && _c !== void 0 ? _c : '""'));
    const targetPath = String(parseTomlValue((_d = md['target_path']) !== null && _d !== void 0 ? _d : '""'));
    const outcomeRaw = String(parseTomlValue((_e = md['outcome']) !== null && _e !== void 0 ? _e : '"SUCCESS"'));
    const estimatedComplexityRaw = String(parseTomlValue((_f = md['estimated_complexity']) !== null && _f !== void 0 ? _f : '"medium"'));
    const conflictCount = Number(parseTomlValue((_g = md['conflict_count']) !== null && _g !== void 0 ? _g : '0'));
    // Validate outcome enum
    if (!Object.values(types_1.IntegrationOutcome).includes(outcomeRaw)) {
        throw new Error(`TOML parse error: invalid outcome "${outcomeRaw}"`);
    }
    const outcome = outcomeRaw;
    // Validate complexity
    const validComplexities = ['low', 'medium', 'high'];
    if (!validComplexities.includes(estimatedComplexityRaw)) {
        throw new Error(`TOML parse error: invalid estimated_complexity "${estimatedComplexityRaw}"`);
    }
    const estimatedComplexity = estimatedComplexityRaw;
    // -- Parse [[steps]] --
    const stepSections = sections.filter(s => s.name === 'steps' && s.isArray);
    const ruleSections = sections.filter(s => s.name === 'steps.rules' && s.isArray);
    const steps = [];
    let ruleIdx = 0;
    for (const sec of stepSections) {
        const e = sec.entries;
        const actionRaw = String(parseTomlValue((_h = e['action']) !== null && _h !== void 0 ? _h : '"copy_file"'));
        if (!Object.values(types_1.MigrationAction).includes(actionRaw)) {
            throw new Error(`TOML parse error: invalid migration action "${actionRaw}"`);
        }
        const step = {
            step: Number(parseTomlValue((_j = e['step']) !== null && _j !== void 0 ? _j : '0')),
            action: actionRaw,
            description: String(parseTomlValue((_k = e['description']) !== null && _k !== void 0 ? _k : '""'))
        };
        if (e['from'] !== undefined)
            step.from = String(parseTomlValue(e['from']));
        if (e['to'] !== undefined)
            step.to = String(parseTomlValue(e['to']));
        if (e['file'] !== undefined)
            step.file = String(parseTomlValue(e['file']));
        if (e['conflict_id'] !== undefined)
            step.conflictId = String(parseTomlValue(e['conflict_id']));
        if (e['command'] !== undefined)
            step.command = String(parseTomlValue(e['command']));
        if (e['resolution'] !== undefined) {
            const resRaw = String(parseTomlValue(e['resolution']));
            if (Object.values(types_1.ResolutionStrategy).includes(resRaw)) {
                step.resolution = resRaw;
            }
        }
        // Collect rules that belong to this step.
        // Rules appear as [[steps.rules]] sections immediately after their parent [[steps]].
        // We determine ownership by position: rules between this step and the next step section.
        const thisStepIndex = sections.indexOf(sec);
        const nextStepIndex = stepSections.indexOf(sec) + 1 < stepSections.length
            ? sections.indexOf(stepSections[stepSections.indexOf(sec) + 1])
            : sections.length;
        const stepRules = [];
        for (let i = thisStepIndex + 1; i < nextStepIndex; i++) {
            const rs = sections[i];
            if (rs.name === 'steps.rules' && rs.isArray) {
                stepRules.push({
                    originalImport: String(parseTomlValue((_l = rs.entries['original_import']) !== null && _l !== void 0 ? _l : '""')),
                    rewrittenImport: String(parseTomlValue((_m = rs.entries['rewritten_import']) !== null && _m !== void 0 ? _m : '""')),
                    reason: String(parseTomlValue((_o = rs.entries['reason']) !== null && _o !== void 0 ? _o : '""'))
                });
            }
        }
        if (stepRules.length > 0) {
            step.rules = stepRules;
        }
        steps.push(step);
    }
    // -- Parse [[conflicts]] --
    const conflictSections = sections.filter(s => s.name === 'conflicts' && s.isArray);
    const conflicts = [];
    for (const sec of conflictSections) {
        const e = sec.entries;
        const typeRaw = String(parseTomlValue((_p = e['type']) !== null && _p !== void 0 ? _p : '"name_collision"'));
        if (!Object.values(types_1.ConflictType).includes(typeRaw)) {
            throw new Error(`TOML parse error: invalid conflict type "${typeRaw}"`);
        }
        const conflict = {
            id: String(parseTomlValue((_q = e['id']) !== null && _q !== void 0 ? _q : '""')),
            type: typeRaw,
            item: String(parseTomlValue((_r = e['item']) !== null && _r !== void 0 ? _r : '""')),
            description: String(parseTomlValue((_s = e['description']) !== null && _s !== void 0 ? _s : '""')),
            resolutionOptions: parseTomlValue((_t = e['resolution_options']) !== null && _t !== void 0 ? _t : '[]'),
            recommended: String(parseTomlValue((_u = e['recommended']) !== null && _u !== void 0 ? _u : '"rename"'))
        };
        if (e['details'] !== undefined) {
            conflict.details = parseTomlValue(e['details']);
        }
        conflicts.push(conflict);
    }
    return {
        id,
        timestamp,
        sourcePath,
        targetPath,
        outcome,
        estimatedComplexity,
        conflictCount,
        steps,
        conflicts
    };
}
//# sourceMappingURL=tomlSerializer.js.map