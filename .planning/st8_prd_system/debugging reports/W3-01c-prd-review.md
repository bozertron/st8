# W3-01c: `/api/prd` Endpoint Review

**File:** `backend/server.js` (lines 776-854)
**Compared against:** `backend/prdGenerator.js` (200 lines)
**Reviewed:** 2026-05-13

---

## Route Registration ✅

**Line 115-117:** Route correctly registered in the switch statement.

```javascript
case '/api/prd':
    this._handlePrd(req, res);
    break;
```

No issues.

---

## Method Validation ✅

**Lines 777-781:** GET-only enforcement is correct. Returns 405 with proper JSON error.

No issues.

---

## Schema Card Loading ✅

**Lines 790-805:** Reads from `.st8/schema-cards/`, checks directory existence (404), filters `.json` files, handles parse errors per-file with `filter(Boolean)`.

No issues.

---

## Critical Issues

### CR-01: Duplicate import sources listed in Dependencies (bug)

**File:** `server.js:838`
**Severity:** BLOCKER — incorrect output

The server endpoint lists **duplicate** dependency sources, while `prdGenerator.js` correctly deduplicates them.

**server.js (broken):**
```javascript
prd += `- **Dependencies:** ${card.imports.map(i => i.source).join(', ')}\n`;
```

**prdGenerator.js (correct):**
```javascript
const uniqueSources = [...new Set(card.imports.map(i => i.source))];
md += `- **Dependencies:** ${uniqueSources.join(', ')}\n`;
```

If a card imports multiple symbols from the same module (e.g., `{ foo } from './utils'` and `{ bar } from './utils'`), the API output will show `./utils, ./utils` instead of `./utils`.

**Fix:**
```javascript
if (card.imports && card.imports.length > 0) {
    const uniqueSources = [...new Set(card.imports.map(i => i.source))];
    prd += `- **Dependencies:** ${uniqueSources.join(', ')}\n`;
}
```

---

## Warnings

### WR-01: Entire PRD generation logic duplicated instead of reusing `prdGenerator.js`

**File:** `server.js:798-843`
**Severity:** WARNING — maintainability

`prdGenerator.js` already exports `loadSchemaCards`, `groupByLifecyclePhase`, `generateCardMarkdown`, and `generatePRD` for programmatic use (line 192-199). The `_handlePrd` method copy-pastes all of this logic inline rather than importing the module.

This has already caused divergence (see CR-01 above) and will continue to cause drift as the two implementations evolve independently.

**Fix:** Import and reuse:
```javascript
const { loadSchemaCards, generatePRD } = require('./prdGenerator');

// Inside _handlePrd:
const cardsDir = path.join(this.targetDir, '.st8', 'schema-cards');
const cards = loadSchemaCards(cardsDir);
const prd = generatePRD(cards);
res.writeHead(200, { 'Content-Type': 'text/markdown' });
res.end(prd);
```

### WR-02: Missing metadata fields that `prdGenerator.js` outputs

**File:** `server.js:821-841`
**Severity:** WARNING — incomplete output

`prdGenerator.js` outputs three additional metadata fields per card that the API endpoint omits:

| Field | prdGenerator.js | server.js |
|-------|----------------|-----------|
| `isEntryPoint` | ✅ line 98-100 | ❌ missing |
| `reachabilityScore` | ✅ line 101-103 | ❌ missing |
| `impactRadius` | ✅ line 104-106 | ❌ missing |

This means the API response is less informative than the CLI-generated PRD.

### WR-03: Missing summary table in PRD output

**File:** `server.js:807-810`
**Severity:** WARNING — incomplete output

`prdGenerator.js` generates a summary table at the top of the PRD (lines 126-132):
```markdown
## Summary
| Lifecycle Phase | File Count |
|-----------------|------------|
| CORE | 12 |
| PERIPHERAL | 5 |
```

And includes a `**Lifecycle Phases:** N` count in the header. The API endpoint omits both, producing a less useful document.

### WR-04: Formatting inconsistencies with `prdGenerator.js`

**File:** `server.js:807-809`
**Severity:** WARNING — output inconsistency

| Element | prdGenerator.js | server.js |
|---------|----------------|-----------|
| Title | `# ST8...\n\n` (double newline) | `# ST8...\n` (single newline) |
| Generated | `**Generated:**` (bold) | `Generated:` (plain) |
| Total Files | `**Total Files:**` (bold) | `Total Files:` (plain) |

The API produces visually different markdown than the CLI tool for the same data.

---

## Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | 1 (duplicate dependencies bug) |
| WARNING  | 4 (code duplication, missing fields, missing summary, formatting drift) |

**Root cause:** The `_handlePrd` method is a hand-copied subset of `prdGenerator.js` that has already diverged. The fix for all issues is the same: **import and reuse `prdGenerator.js`** instead of duplicating its logic inline.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
