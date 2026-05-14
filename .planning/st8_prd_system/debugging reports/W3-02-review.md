---
phase: W3-02
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - backend/prdGenerator.js
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# W3-02: Code Review Report — prdGenerator.js

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `backend/prdGenerator.js` — a module that loads schema card JSON files from `.st8/schema-cards/` and generates a markdown PRD. The module is well-structured with clean separation of concerns and proper CLI/programmatic dual-use pattern. However, there is a significant code duplication problem with `server.js` that has already caused behavioral divergence, and `process.exit(1)` in an exported function creates a hazard for programmatic consumers.

## Critical Issues

### CR-01: PRD generation logic duplicated in server.js — behavioral divergence

**File:** `backend/prdGenerator.js:117-143` / `backend/server.js:798-853`
**Issue:** `server.js` contains a complete inline duplicate of the PRD generation logic that does NOT use `prdGenerator.js`. The two implementations have already diverged:

| Behavior | prdGenerator.js | server.js |
|---|---|---|
| Dependency listing | Deduplicates sources via `new Set()` (line 93) | No deduplication — `card.imports.map(i => i.source).join(', ')` (line 838) |
| Summary table | Included (lines 125-132) | Missing |
| Header newlines | `\n\n` after title | Single `\n` |
| Reachability/impact | Included in card output | Omitted |

This means the CLI (`node backend/prdGenerator.js`) and the HTTP server produce different PRD output for the same data. Any future bug fix or feature addition must be applied in two places.

**Fix:** Refactor `server.js` to import and use `prdGenerator.js`:
```javascript
// In server.js — replace inline PRD generation (lines 798-853) with:
const { loadSchemaCards, generatePRD } = require('./prdGenerator');

// ...inside the handler:
const cards = loadSchemaCards(cardsDir);
const prd = generatePRD(cards);
res.writeHead(200, { 'Content-Type': 'text/markdown' });
res.end(prd);
```

### CR-02: `process.exit(1)` in exported function kills programmatic callers

**File:** `backend/prdGenerator.js:182`
**Issue:** `main()` is exported (line 199) for programmatic use, but it calls `process.exit(1)` on error. If a programmatic consumer calls `main()` and the schema cards directory doesn't exist, the entire Node.js process terminates — no try/catch by the caller can prevent this.

```javascript
// Line 180-183
} catch (err) {
    console.error(`Error generating PRD: ${err.message}`);
    process.exit(1);  // ← kills the process, caller cannot catch
}
```

**Fix:** Let the error propagate; handle `process.exit` only in the CLI block:
```javascript
function main(targetDir) {
    const cardsDir = path.join(targetDir, '.st8', 'schema-cards');
    const outputPath = path.join(targetDir, '.planning', 'st8_identity_system', 'PRD.md');

    console.log(`Loading schema cards from: ${cardsDir}`);
    const cards = loadSchemaCards(cardsDir);
    
    if (cards.length === 0) {
        console.log('No schema cards found. Generating empty PRD.');
    }

    const prdContent = generatePRD(cards);
    writePRD(prdContent, outputPath);
    
    console.log(`PRD generation complete. ${cards.length} cards processed.`);
}

// CLI mode
if (require.main === module) {
    const targetDir = process.argv[2] || '.';
    try {
        main(targetDir);
    } catch (err) {
        console.error(`Error generating PRD: ${err.message}`);
        process.exit(1);
    }
}
```

## Warnings

### WR-01: No schema validation on loaded JSON cards

**File:** `backend/prdGenerator.js:40-42`
**Issue:** `loadSchemaCards()` parses JSON but performs no structural validation. A file containing valid JSON like `{"foo": "bar"}` will be accepted as a schema card. Downstream, `generateCardMarkdown()` will render `undefined` values as `(not set)` for most fields, but `card.exports` and `card.imports` guards check for truthiness and array length — a non-array value like `"string"` would pass the truthiness check but fail on `.length` or iteration.

```javascript
// Line 41 — no validation after parse
const card = JSON.parse(content);
cards.push(card);
```

**Fix:** Add minimal structural validation:
```javascript
const card = JSON.parse(content);
if (!card.filepath || !card.fingerprint) {
    console.warn(`Skipping ${file}: missing required fields (filepath, fingerprint)`);
    continue;
}
cards.push(card);
```

### WR-02: Silent skip of malformed JSON files masks data corruption

**File:** `backend/prdGenerator.js:43-46`
**Issue:** When a JSON file fails to parse, the error is logged to stderr but the file is silently skipped. This is a reasonable resilience strategy, but the caller (`main()`) has no way to know that some cards were skipped. For a PRD generator, missing schema cards could produce an incomplete document that looks valid.

```javascript
} catch (err) {
    console.error(`Error parsing ${file}: ${err.message}`);
    // Continue with other cards rather than failing entirely
}
```

**Fix:** Return a count of skipped files so the caller can report it:
```javascript
// Change loadSchemaCards to return { cards, errors }
function loadSchemaCards(cardsDir) {
    // ...existing code...
    const errors = [];
    // ...in catch block:
    errors.push({ file, message: err.message });
    // ...return { cards, errors };
}
```

### WR-03: Output path hardcoded — no way to customize PRD location

**File:** `backend/prdGenerator.js:166`
**Issue:** The output path is hardcoded to `.planning/st8_identity_system/PRD.md`. The `writePRD()` function accepts a custom `outputPath`, but `main()` doesn't expose this. Programmatic callers who want the PRD written elsewhere must duplicate the logic instead of calling `main()`.

**Fix:** Accept an optional output path parameter:
```javascript
function main(targetDir, outputOverride) {
    const cardsDir = path.join(targetDir, '.st8', 'schema-cards');
    const outputPath = outputOverride || 
        path.join(targetDir, '.planning', 'st8_identity_system', 'PRD.md');
    // ...
}
```

## Info

### IN-01: Magic string 'UNKNOWN' for missing lifecycle phase

**File:** `backend/prdGenerator.js:60`
**Issue:** The fallback lifecycle phase `'UNKNOWN'` is a magic string used inline. Consider extracting to a constant for consistency and grep-ability.

**Fix:**
```javascript
const DEFAULT_LIFECYCLE_PHASE = 'UNKNOWN';
// ...in groupByLifecyclePhase:
const phase = card.lifecyclePhase || DEFAULT_LIFECYCLE_PHASE;
```

### IN-02: Code duplication with schemaCardPrinter.js card loading pattern

**File:** `backend/prdGenerator.js:23-50` / `backend/schemaCardPrinter.js:262-283`
**Issue:** Both `prdGenerator.loadSchemaCards()` and `SchemaCardPrinter.printAllFromCards()` implement the same pattern: read directory → filter `.json` → parse each → handle errors. Consider extracting a shared `readSchemaCards(dir)` utility.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
