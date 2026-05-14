/**
 * prdGenerator.js — PRD generation from schema cards
 * 
 * Reads schema cards from .st8/schema-cards/ and generates
 * a comprehensive Product Requirements Document.
 * 
 * Usage:
 *   node backend/prdGenerator.js [targetDir]
 * 
 * @module backend/prdGenerator
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Load and parse all schema card JSON files from the specified directory
 * @param {string} cardsDir - Path to schema-cards directory
 * @returns {Array<Object>} Parsed schema cards
 */
function loadSchemaCards(cardsDir) {
    if (!fs.existsSync(cardsDir)) {
        throw new Error(`Schema cards directory not found: ${cardsDir}`);
    }

    const files = fs.readdirSync(cardsDir)
        .filter(f => f.endsWith('.json'));

    if (files.length === 0) {
        console.warn(`Warning: No JSON files found in ${cardsDir}`);
        return [];
    }

    const cards = [];
    for (const file of files) {
        try {
            const filePath = path.join(cardsDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const card = JSON.parse(content);
            cards.push(card);
        } catch (err) {
            console.error(`Error parsing ${file}: ${err.message}`);
            // Continue with other cards rather than failing entirely
        }
    }

    return cards;
}

/**
 * Group schema cards by their lifecycle phase
 * @param {Array<Object>} cards - Schema cards array
 * @returns {Object} Cards grouped by lifecyclePhase
 */
function groupByLifecyclePhase(cards) {
    const byPhase = {};
    for (const card of cards) {
        const phase = card.lifecyclePhase || 'UNKNOWN';
        if (!byPhase[phase]) byPhase[phase] = [];
        byPhase[phase].push(card);
    }
    return byPhase;
}

/**
 * Generate markdown content for a single schema card
 * @param {Object} card - Schema card object
 * @returns {string} Markdown representation
 */
function generateCardMarkdown(card) {
    let md = '';
    
    md += `### ${card.filepath}\n`;
    md += `- **Fingerprint:** ${card.fingerprint}\n`;
    md += `- **Status:** ${card.status}\n`;
    md += `- **Purpose:** ${card.intent?.purpose || '(not set)'}\n`;

    // Exports section
    if (card.exports && card.exports.length > 0) {
        md += `- **Exports:**\n`;
        for (const exp of card.exports) {
            md += `  - ${exp.kind} \`${exp.name}\``;
            if (exp.signature) md += ` — \`${exp.signature}\``;
            if (exp.returnType) md += ` → ${exp.returnType}`;
            md += '\n';
        }
    }

    // Dependencies section
    if (card.imports && card.imports.length > 0) {
        const uniqueSources = [...new Set(card.imports.map(i => i.source))];
        md += `- **Dependencies:** ${uniqueSources.join(', ')}\n`;
    }

    // Additional metadata
    if (card.isEntryPoint) {
        md += `- **Entry Point:** Yes\n`;
    }
    if (card.reachabilityScore !== undefined) {
        md += `- **Reachability Score:** ${card.reachabilityScore}\n`;
    }
    if (card.impactRadius !== undefined && card.impactRadius > 0) {
        md += `- **Impact Radius:** ${card.impactRadius}\n`;
    }

    md += '\n';
    return md;
}

/**
 * Generate complete PRD markdown content
 * @param {Array<Object>} cards - Schema cards array
 * @returns {string} Complete PRD markdown
 */
function generatePRD(cards) {
    const byPhase = groupByLifecyclePhase(cards);
    
    let prd = '# ST8 Product Requirements Document\n\n';
    prd += `**Generated:** ${new Date().toISOString()}\n`;
    prd += `**Total Files:** ${cards.length}\n`;
    prd += `**Lifecycle Phases:** ${Object.keys(byPhase).length}\n\n`;
    
    // Summary table
    prd += '## Summary\n\n';
    prd += '| Lifecycle Phase | File Count |\n';
    prd += '|-----------------|------------|\n';
    for (const [phase, phaseCards] of Object.entries(byPhase)) {
        prd += `| ${phase} | ${phaseCards.length} |\n`;
    }
    prd += '\n';

    // Detailed sections per lifecycle phase
    for (const [phase, phaseCards] of Object.entries(byPhase)) {
        prd += `## Phase: ${phase} (${phaseCards.length} files)\n\n`;
        for (const card of phaseCards) {
            prd += generateCardMarkdown(card);
        }
    }

    return prd;
}

/**
 * Write PRD to the specified output path
 * @param {string} prdContent - Generated PRD markdown
 * @param {string} outputPath - Path to write the PRD file
 */
function writePRD(prdContent, outputPath) {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, prdContent, 'utf-8');
    console.log(`PRD written to ${outputPath}`);
}

/**
 * Main execution function
 * @param {string} targetDir - Root directory containing .st8/schema-cards/
 */
function main(targetDir) {
    const cardsDir = path.join(targetDir, '.st8', 'schema-cards');
    const outputPath = path.join(targetDir, '.planning', 'st8_identity_system', 'PRD.md');

    try {
        console.log(`Loading schema cards from: ${cardsDir}`);
        const cards = loadSchemaCards(cardsDir);
        
        if (cards.length === 0) {
            console.log('No schema cards found. Generating empty PRD.');
        }

        const prdContent = generatePRD(cards);
        writePRD(prdContent, outputPath);
        
        console.log(`PRD generation complete. ${cards.length} cards processed.`);
    } catch (err) {
        console.error(`Error generating PRD: ${err.message}`);
        process.exit(1);
    }
}

// CLI mode
if (require.main === module) {
    const targetDir = process.argv[2] || '.';
    main(targetDir);
}

// Export for programmatic use
module.exports = {
    loadSchemaCards,
    groupByLifecyclePhase,
    generateCardMarkdown,
    generatePRD,
    writePRD,
    main
};
