# Assumptions Analysis: `fake-stream.js` — Dead Code or Supposed to Be Wired?

**File:** `/home/bozertron/1_AT_A_TIME/st8/fake-stream.js` (96 lines)
**Analyzed:** 2026-05-13
**Verdict:** ⚠️ **DEAD CODE — orphaned by architectural pivot, but its PURPOSE is still planned**

---

## Executive Summary

`fake-stream.js` was a **legitimate, shipped component** of Phase A v2 that demoed the three-queue streaming architecture by feeding synthetic LLM tokens into `DriftEngine.pushTokens()`. When the project pivoted from the custom `DriftEngine` to the editorial-engine pattern (HANDOFF v3), the `DriftEngine` was never built — orphaning this file. Its *purpose* (a synthetic stream emitter for demos) is still relevant because the "Stream API + reveal queue" remains a planned next-move, but the *interface* it depends on (`pushTokens`/`endTurn`) no longer exists and will not be implemented in the same form.

---

## 1. Evidence: Was This File Ever Imported/Required?

### Search Results

| Search Pattern | Hits in Source Code | Hits in Planning Docs |
|---|---|---|
| `import.*fake-stream` | **0** | 0 |
| `require.*fake-stream` | **0** | 0 |
| `from.*fake-stream` | **0** | 0 |
| `FakeStream` | **0** in source; 27 in `.planning/` | Identity cards, CONCERNS, ARCHITECTURE |
| `fakeStream` (camelCase) | **0** in source; 1 in `.planning/` (existing deep-dive report) | Report only |

**Conclusion:** The file is **never imported or required** by any source file. It is referenced only in `.planning/` documentation artifacts (identity cards, architecture docs, concerns docs, and one existing deep-dive analysis report).

### HTML File Check

- `st8.html` — **no references** to `fake-stream`, `FakeStream`, or `fakeStream`
- `void-engine.html` — **no references**
- No other `.html` file references it

---

## 2. Evidence: Was It Supposed to Be Wired Up?

### YES — Originally It Was Shipped and Working

**HANDOFF-phase-a-v2.md** (`snapshots/v1-pre-pretext/`, line 15) explicitly lists it as a shipped component:

```
st8.html                       ← rewritten: void is now a drift surface
vendor/drift-engine.js         ← three-queue pipeline, pretext-driven layout, drift, buffer trail, metronome
vendor/settings-reader.js      ← Phase A.1 data layer; localStorage adapter, swappable
vendor/fake-stream.js          ← synthetic LLM emitter for the demo
```

The same doc (line 22) confirms it was the demo driver:

> "type-from-line is replaced with the synthetic stream — keyboard-typing into the line is Phase B work, the stream proves the same pipeline"

And smoke test item 7 (line 430):

> "Trigger a synthetic `pushTokens` stream of 200 words at high speed → words arrive into network queue immediately, but reveal pace stays at 200 WPM."

**This was a working, wired component that drove the Phase A demo.**

### The Architectural Pivot Orphaned It

**HANDOFF-phase-a-v3.md** (`snapshots/v2-tap6-single-rect/`) documents the pivot:

> "The pivot: v2's custom drift engine had subtle coordinate-system and ordering bugs. The breakthrough was using the working precision instrument in `uploads/the-editorial-engine.{js,html}` — a 22KB pretext-driven layout engine"

> "Editorial pattern vs v2 drift-engine: Stateless full re-layout per frame (~0.5ms) vs incremental state machine (~510 lines). No state to corrupt"

The `DriftEngine` class (which `fake-stream.js` feeds tokens into) was **never implemented** in the current codebase:

- `vendor/drift-engine.js` — **does not exist** (only `vendor/void-engine.js` exists)
- `Concept/drift-engine.js` — **directory does not exist** (the `Concept/` folder was mentioned in HANDOFF v4 as "preserved for future revival" but was never created)
- `void-engine.js` — has **no `pushTokens()` or `endTurn()` methods** (grep confirms zero matches)

### Current Engine Interface Is Incompatible

The current `void-engine.js` uses a completely different paradigm:
- Direct `BODY_TEXT` string manipulation (`BODY_TEXT += char; bodyDirty = true`)
- `prepareWithSegments()` for pretext layout
- No token streaming API, no role-based input, no turn lifecycle

The `FakeStream` class requires:
- `engine.pushTokens(role, text)` — **does not exist**
- `engine.endTurn()` — **does not exist**

---

## 3. Evidence: References in Planning Docs, Handoff Notes, or Research

### Planning Documentation References

| File | Lines | Context |
|---|---|---|
| `.planning/codebase/CONCERNS.md` | 37-41 | Listed as **dead code**: "fake-stream.js provides a FakeStream class for demo mode that nothing consumes" |
| `.planning/codebase/ARCHITECTURE.md` | 35, 74-75 | Listed as "Demo data: synthetic LLM token stream for Phase A demos" |
| `.planning/codebase/CONVENTIONS.md` | 14, 50, 65, 78 | Naming/style references only |
| `.planning/codebase/STRUCTURE.md` | 15 | Directory listing |
| `.planning/codebase/TESTING.md` | 50-51, 149 | Notes "contains hardcoded demo scripts that could serve as test data" |
| `.planning/st8_prd_system/PRD-IMPLEMENTATION-GAP-ANALYSIS.md` | 372-374 | Status: "COMPLETE — Dev utility only, ES6 export incompatible with CommonJS" |
| `.planning/st8_prd_system/tasks/06_INTEGRATION-CHECKER-REPORT.md` | 133 | Identity card reference |
| `.planning/st8-filemap.md` | 22 | "Stream simulation" |
| `README.md` | 54 | Listed in directory tree |
| `connection-state.json` | 632-634 | Fingerprint entry |
| `.planning/HANDOFF-MASTER-REFERENCE.md` | (none) | **No mention** of `fake-stream` or `FakeStream` |

### Existing Deep-Dive Report

A thorough analysis already exists at:
`.planning/st8_identity_system/Gsd-Codebase-Reviewer - Reports/fake-stream.js_for_json_transform.md`

Key findings from that report:
- Line 99: "**NOTHING IN THE CURRENT CODEBASE.** No file imports `fake-stream.js`."
- Line 101: "Status: 🔴 **NOT CONNECTED — DEAD CODE**"
- Line 279: "No engine implementation exists. The `DriftEngine` class was designed in `snapshots/v1-pre-pretext/HANDOFF-phase-a-v2.md` (line 370) but was never built."
- Line 311: "Dead code: The entire file is exported but never imported. The `DriftEngine` it depends on was never implemented."

---

## 4. Evidence: Is There Code That SHOULD Be Using It?

### The "Stream API + reveal queue" Is Still Planned

**HANDOFF-phase-a-v4.md** (`snapshots/v4-restored/`, line 96) lists as next-move #4:

> "Stream API + reveal queue. v2 §4 — three queues (network → word → reveal), per-word atomic commits, metronome reveal at 200 WPM. The cursor metronome pulse already animates; now the cursor PACES the reveal. Ports cleanly to `BODY_TEXT += word; bodyDirty = true`."

**HANDOFF-MASTER-REFERENCE.md** (line 115) confirms:

> "Stream API + reveal queue | NEXT | Three queues, per-word atomic commits, 200 WPM metronome"

### But the Interface Will Be Different

The v4 handoff explicitly notes the new approach "ports cleanly to `BODY_TEXT += word; bodyDirty = true`" — this is a fundamentally different interface than `pushTokens(role, text)`. The planned Stream API will:
- Work with `BODY_TEXT` string manipulation (not a `DriftEngine` wrapper)
- Use the editorial-engine pattern (stateless re-layout) not the incremental DriftEngine
- Likely need a new synthetic emitter adapted to the `void-engine.js` API

### What SHOULD Use It (But Can't)

If someone were to build the Stream API + reveal queue today, they would need:
1. A streaming token source (LLM provider or synthetic demo) — **this is what `fake-stream.js` provides**
2. A queue/reveal pipeline — **does not exist yet**
3. An engine that accepts streamed tokens — **`void-engine.js` does not have this API**

The *concept* of a synthetic demo stream is still valuable for development and testing. But `fake-stream.js` cannot be wired up without either:
- (a) Implementing `DriftEngine` with `pushTokens()`/`endTurn()` (architectural regression), or
- (b) Rewriting `fake-stream.js` to feed `BODY_TEXT` directly (new interface)

---

## 5. Additional Code Quality Issues

From the existing deep-dive report and independent verification:

| Issue | Severity | Line(s) |
|---|---|---|
| Unhandled promise rejection in `_runNext()` | Warning | 68 |
| Infinite loop with no exit/callback on completion | Warning | 64 |
| Stale header comment (`vendor/fake-stream.js` vs actual root path) | Info | 2 |
| Irreversible `stop()` — no restart capability | Info | 56 |
| Busy-wait pause polling (80ms intervals) | Info | 86-88 |
| No `endTurn()` called on cancellation | Info | 84, 89 |

---

## 6. Verdict Matrix

| Question | Answer | Confidence |
|---|---|---|
| Was it ever imported? | **No** — never imported in current codebase | 100% |
| Was it ever wired up? | **Yes** — HANDOFF v2 confirms it shipped with `vendor/drift-engine.js` | 100% |
| Does the dependency exist? | **No** — `DriftEngine` was never implemented post-pivot | 100% |
| Is it referenced in planning? | **Yes** — extensively, but always as "dead code" or "dev utility" | 100% |
| Should it be wired up? | **Not as-is** — its interface is incompatible with current engine | 100% |
| Is its purpose still needed? | **Yes** — Stream API + reveal queue is a planned next-move | 95% |

---

## 7. Recommendation

### **REWIRE (with rewrite) — not DELETE, not KEEP AS IS**

**Rationale:**

1. **Do NOT DELETE.** The file embodies a valuable design pattern (synthetic LLM stream for demo/dev mode) that is explicitly planned as next-move #4 in the v4 handoff. The hardcoded demo scripts (5 turns of sirkits conversation) are useful test data. The class structure (start/stop/pause/resume lifecycle, token jitter, between-turn delays) is well-designed for its purpose.

2. **Do NOT KEEP AS IS.** The file is dead code. It depends on an API (`pushTokens`/`endTurn`) that doesn't exist and won't exist in the same form. It uses ES module `export` syntax incompatible with the current `st8.html` inline script loading. The header comment is stale. It has unhandled promise rejection and infinite loop issues.

3. **DO REWRITE** when the Stream API + reveal queue is implemented. The rewrite should:
   - Target `BODY_TEXT += word; bodyDirty = true` instead of `engine.pushTokens(role, text)`
   - Drop the `DriftEngine` dependency entirely
   - Use the same token jitter and timing logic (it's good)
   - Keep the SCRIPTS array as demo/test data
   - Fix the unhandled promise rejection (add `.catch()`)
   - Add a completion callback or `once` mode
   - Move back to `vendor/` (or wherever the project convention lands)
   - Update the header comment

4. **Interim action:** Move to `.archive/dead-code/fake-stream.js` with a note pointing to this analysis and the HANDOFF v4 next-move #4. This keeps it discoverable without cluttering the root.

---

## Appendix: Search Methodology

### Patterns Searched
- `fake-stream` (filename) — 88 matches across codebase
- `FakeStream` (class name) — 27 matches
- `fakeStream` (camelCase) — 1 match
- `DriftEngine` (dependency) — 9 matches
- `pushTokens` (engine method) — 14 matches
- `endTurn` (engine method) — 12 matches
- `import.*fake-stream` / `require.*fake-stream` / `from.*fake-stream` — **0 matches in source**
- `drift-engine` — 7 matches (all in planning docs, no source file)

### Directories Searched
- Project root (`/home/bozertron/1_AT_A_TIME/st8/`)
- `.planning/` (all subdirectories)
- `vendor/` (only `void-engine.js` exists)
- `snapshots/` (all 5 snapshot directories)
- `Concept/` — **does not exist**

### Files Verified
- `st8.html` — no fake-stream references
- `void-engine.js` — no `pushTokens` or `endTurn` methods
- `vendor/void-engine.js` — no `pushTokens` or `endTurn` methods
- `void-engine.html` — no fake-stream references
- All `.js` files in root — no imports of fake-stream
- `HANDOFF-phase-a-v2.md` — confirms it was shipped with `vendor/drift-engine.js`
- `HANDOFF-phase-a-v3.md` — confirms the pivot away from DriftEngine
- `HANDOFF-phase-a-v4.md` — confirms Stream API is still planned (next-move #4)
- `HANDOFF-MASTER-REFERENCE.md` — no mention of fake-stream
- `CONCERNS.md` — explicitly lists it as dead code

---

*Analyzed: 2026-05-13*
*Analyzer: GSD-Assumptions-Analyzer*
*Depth: Deep (cross-file, cross-document, architectural trace)*
