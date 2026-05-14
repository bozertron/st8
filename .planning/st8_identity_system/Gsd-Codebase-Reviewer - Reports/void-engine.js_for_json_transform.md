# Deep-Dive Analysis: `void-engine.js`

**File:** `/home/bozertron/1_AT_A_TIME/st8/void-engine.js`
**Lines:** 338 total
**Source:** Native ES module (loaded via `<script type="module">`)
**Purpose:** Pretext-powered editorial layout engine — renders text flowing around draggable obstacles in real time at 60fps using DOM-free text measurement. The "drift surface" for ST8's pretext-dev workspace.

**Duplicate:** `vendor/void-engine.js` is byte-identical (zero diff). ST8 loads the vendor copy conditionally from `st8.html` line 1638.

---

## Lines 1-7: Module Header & Imports

```javascript
// the-editorial-engine.ts
import {
  prepareWithSegments,
  layoutWithLines,
  layoutNextLine,
  walkLineRanges
} from "https://esm.sh/@chenglou/pretext@0.0.6";
```

- **What triggers it:** Module load (ES module `import` declaration)
- **What it calls:** External CDN `https://esm.sh/@chenglou/pretext@0.0.6`
- **What calls it:** `st8.html:1638` (`vendor/void-engine.js` via dynamic `<script type="module">`) or `void-engine.html:42` (standalone)
- **Dependencies:** `@chenglou/pretext@0.0.6` (ESM CDN)
- **Status:** PARTIAL — 2 of 4 imports are unused
- **Gap:**
  - **Line 1:** Comment says `// the-editorial-engine.ts` — the file is actually `void-engine.js`. This is a stale header from the original pretext demo repository. Misleading for maintainers.
  - **Line 4:** `layoutWithLines` is imported but **NEVER called** anywhere in the file. Dead import.
  - **Line 6:** `walkLineRanges` is imported but **NEVER called** anywhere in the file. Dead import.
  - **Security:** External CDN import has no Subresource Integrity (SRI) hash. A compromised CDN could serve arbitrary code. The version is pinned (`@0.0.6`) which mitigates supply-chain drift but not CDN compromise.

---

## Lines 8-13: Layout Constants

```javascript
var BODY_FONT = '18px "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif';
var BODY_LINE_HEIGHT = 30;
var HEADLINE_FONT_FAMILY = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif';
var GUTTER = 48;
var COL_GAP = 40;
var MIN_SLOT_WIDTH = 50;
```

- **What triggers it:** Module load (top-level `var` declarations)
- **What it calls:** Nothing
- **What calls it:** Various functions throughout the file
- **Dependencies:** None
- **Status:** PARTIAL — 2 of 6 constants are unused
- **Gap:**
  - **Line 10:** `HEADLINE_FONT_FAMILY` is defined but **NEVER referenced** anywhere in the file. Dead constant. Likely a leftover from the original pretext demo which had headline rendering.
  - **Line 12:** `COL_GAP` is defined but **NEVER referenced** anywhere in the file. Dead constant. The original demo had multi-column layout; this ST8 version uses single-column bottom-anchored layout.

---

## Lines 14-33: `carveTextLineSlots(base, blocked)`

```javascript
function carveTextLineSlots(base, blocked) {
  let slots = [base];
  for (let bi = 0; bi < blocked.length; bi++) {
    const iv = blocked[bi];
    const next = [];
    for (let si = 0; si < slots.length; si++) {
      const s = slots[si];
      if (iv.right <= s.left || iv.left >= s.right) {
        next.push(s);
        continue;
      }
      if (iv.left > s.left)
        next.push({ left: s.left, right: iv.left });
      if (iv.right < s.right)
        next.push({ left: iv.right, right: s.right });
    }
    slots = next;
  }
  return slots.filter((s) => s.right - s.left >= MIN_SLOT_WIDTH);
}
```

- **What triggers it:** Called from `layoutColumn()` at line 206
- **What it calls:** References `MIN_SLOT_WIDTH` (line 13)
- **What calls it:** `layoutColumn()` at line 206
- **Dependencies:** `MIN_SLOT_WIDTH` constant
- **Status:** WORKING
- **Gap:** None. This is a clean interval-subtraction algorithm. For each blocked interval, it splits existing slots into left/right remainders. The `MIN_SLOT_WIDTH` filter (line 32) prevents degenerate narrow slots that would produce broken text layout. Edge cases handled correctly: non-overlapping intervals preserved (line 21-24), partial overlaps split (lines 25-28), complete overlaps eliminated (both conditionals false → slot dropped).

---

## Lines 34-44: `circleIntervalForBand(cx, cy, r, bandTop, bandBottom, hPad, vPad)`

```javascript
function circleIntervalForBand(cx, cy, r, bandTop, bandBottom, hPad, vPad) {
  const top = bandTop - vPad;
  const bottom = bandBottom + vPad;
  if (top >= cy + r || bottom <= cy - r)
    return null;
  const minDy = cy >= top && cy <= bottom ? 0 : cy < top ? top - cy : cy - bottom;
  if (minDy >= r)
    return null;
  const maxDx = Math.sqrt(r * r - minDy * minDy);
  return { left: cx - maxDx - hPad, right: cx + maxDx + hPad };
}
```

- **What triggers it:** Called from `layoutColumn()` at line 196
- **What it calls:** `Math.sqrt()` (line 42)
- **What calls it:** `layoutColumn()` at line 196
- **Dependencies:** None
- **Status:** WORKING (but currently unreachable — see Gap)
- **Gap:**
  - **Line 194-199:** This function is called inside `layoutColumn` for `circleObs`, but **no circle obstacles are ever created**. The `circleObs` array at line 270 is always empty (`const circleObs = [];`). The function is therefore **dead code in practice** — it's wired up but never produces results. This is a remnant from the original demo which had animated glowing orbs (circles). ST8 only uses rectangular `sirkit-rect` obstacles.

---

## Lines 45-106: Text Content Variables

```javascript
// Old demo prose preserved for reference; the void starts empty in st8.
var BODY_TEXT = ``;
var bodyDirty = false;
var BODY_TEXT_OLD_DEMO = `The web renders text through a pipeline that was designed thirty years ago...`;
```

- **What triggers it:** Module load (top-level declarations)
- **What it calls:** Nothing
- **What calls it:** `BODY_TEXT` used at lines 151, 158-159, 164, 168, 278, 290. `bodyDirty` used at lines 161, 165, 169, 277, 279.
- **Dependencies:** None
- **Status:** WORKING — `BODY_TEXT` starts empty (line 46), populated by keyboard input
- **Gap:**
  - **Lines 48-106:** `BODY_TEXT_OLD_DEMO` is a **58-line essay** (~5,400 characters) that is **NEVER referenced** anywhere in the file. This is pure dead code — a leftover from the original pretext demo. It adds ~5KB of dead weight to the module. Should be removed or moved to a separate reference file.
  - **Line 46:** `var BODY_TEXT = ``;` uses a template literal for an empty string. While functionally correct, `var BODY_TEXT = ""` would be clearer. Minor style issue.

---

## Lines 107-112: Stage Element & Chatbox Constants

```javascript
var stage = document.getElementById("stage");

// ── Chatbox anchor (matches original void-input position) ──
var CHATBOX_LEFT = 64;          // matches original padding-left
var CHATBOX_BOTTOM_PAD = 24;    // gap above the dock
```

- **What triggers it:** Module load (top-level declarations)
- **What it calls:** `document.getElementById("stage")` (line 107)
- **What calls it:** `stage` is used at lines 122, 131, 267, 268 (via `stage.clientWidth`/`stage.clientHeight`)
- **Dependencies:** Requires `#stage` DOM element to exist when module loads
- **Status:** WORKING (with risk)
- **Gap:**
  - **Line 107:** **No null check on `stage`.** If `#stage` doesn't exist in the DOM, `stage` is `null`, and every subsequent `stage.appendChild()` (lines 122, 131, 178) and `stage.clientWidth`/`stage.clientHeight` (lines 134-135, 267-268) will throw a `TypeError`. In practice this works because:
    - Standalone (`void-engine.html`): `<div id="stage"></div>` is in the HTML (line 41)
    - Integrated (`st8.html`): `#stage` is defined in the main HTML and void-engine loads after DOM ready
    - But if the dynamic loader in `st8.html:1634` is called before `#stage` exists, it will crash silently.

---

## Lines 113-122: Cursor Element Creation

```javascript
var cursorEl = document.createElement("div");
cursorEl.className = "void-cursor visible";
cursorEl.setAttribute("aria-hidden", "true");
for (var ci = 0; ci < 5; ci++) {
  var sp = document.createElement("span");
  sp.textContent = "—";
  cursorEl.appendChild(sp);
}
stage.appendChild(cursorEl);
```

- **What triggers it:** Module load (top-level code)
- **What it calls:** `document.createElement()`, `stage.appendChild()` (line 122)
- **What calls it:** Cursor position updated in `animate()` at lines 323-333
- **Dependencies:** CSS classes `.void-cursor`, `.void-cursor.visible` defined in `st8.html:689-726`
- **Status:** WORKING
- **Gap:**
  - **Line 115:** The `visible` class is permanently applied. The cursor is always visible when void-engine is loaded, even when `BODY_TEXT` is empty. The cursor sits at the chatbox origin (lines 329-330) when empty, which is intentional — it shows "where text will appear."
  - **CSS dependency:** The wave-pulse animation (`@keyframes void-wave` at `st8.html:720-723`) is defined in `st8.html` but NOT in `void-engine.html`. Standalone mode via `void-engine.html` will show the cursor dashes but without the wave animation — they'll be static at opacity 0.18 (barely visible). **Bug for standalone mode.**

---

## Lines 124-149: Rectangular Obstacle Definitions

```javascript
var rectDefs = [
  { fx: 0.55, fy: 0.40, w: 320, h: 200, label: "SIRKIT · DRAG ME" }
];
function createRectEl(label) {
  const el = document.createElement("div");
  el.className = "sirkit-rect";
  el.textContent = label;
  stage.appendChild(el);
  return el;
}
var W0 = stage.clientWidth || window.innerWidth;
var H0 = stage.clientHeight || window.innerHeight;
var rects = rectDefs.map((d) => ({
  x: d.fx * W0,
  y: d.fy * H0,
  w: d.w,
  h: d.h,
  label: d.label,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dragStartRectX: 0,
  dragStartRectY: 0,
  el: createRectEl(d.label)
}));
var activeRect = null;
```

- **What triggers it:** Module load (top-level code)
- **What it calls:** `createRectEl()` (lines 127-133), `stage.clientWidth`/`stage.clientHeight` (line 134-135)
- **What calls it:** `rects` array used at lines 272, 315, 230 (via `hitTestRects`)
- **Dependencies:** CSS class `.sirkit-rect` defined in `st8.html:88-106` and `void-engine.html:29-37`
- **Status:** WORKING
- **Gap:**
  - **Line 134:** `W0 = stage.clientWidth || window.innerWidth` — `clientWidth` can be 0 if the element has no computed layout yet (e.g., `display: none`). The `|| window.innerWidth` fallback handles this, but the rect will be positioned at a fractional screen-relative position rather than a stage-relative one. This is a minor edge case.
  - **Line 125:** Only ONE rect obstacle is defined. The `rectDefs` array supports multiple, but the demo only uses one. This is intentional for the ST8 use case.

---

## Lines 150-151: Font Loading & Initial Text Preparation

```javascript
await document.fonts.ready;
var preparedBody = prepareWithSegments(BODY_TEXT, BODY_FONT);
```

- **What triggers it:** Module load (top-level `await`)
- **What it calls:** `document.fonts.ready` (browser API), `prepareWithSegments()` (pretext library)
- **What calls it:** `preparedBody` used at lines 278 (re-preparation), 292, 300
- **Dependencies:** `@chenglou/pretext` library, fonts must be loaded
- **Status:** WORKING
- **Gap:**
  - **Line 150:** Top-level `await` requires ES module context. This is correct since the file is loaded as `<script type="module">`. However, if anyone tries to bundle or load this as a regular script, it will fail.
  - **Line 151:** `BODY_TEXT` is empty at this point (`""`), so `prepareWithSegments` prepares an empty text. This is wasteful but harmless — the real preparation happens at line 278 when `bodyDirty` is true.

---

## Lines 153-172: Keyboard Input Handler

```javascript
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Backspace") {
    if (BODY_TEXT.length > 0) {
      BODY_TEXT = BODY_TEXT.slice(0, -1);
      bodyDirty = true;
    }
    e.preventDefault();
  } else if (e.key === "Enter") {
    BODY_TEXT += "\n\n";
    bodyDirty = true;
    e.preventDefault();
  } else if (e.key.length === 1) {
    BODY_TEXT += e.key;
    bodyDirty = true;
    e.preventDefault();
  }
});
```

- **What triggers it:** Any `keydown` event on `window`
- **What it calls:** Modifies `BODY_TEXT` and `bodyDirty` global state
- **What calls it:** Browser keyboard events
- **Dependencies:** None
- **Status:** WORKING (with interaction concerns)
- **Gap:**
  - **Line 155:** Correctly ignores events from form inputs — prevents conflict with st8.html's own input fields (terminal input, settings fields, etc.).
  - **Line 164:** Enter adds `"\n\n"` (double newline = paragraph break). This is correct for pretext's paragraph-aware layout.
  - **Interaction issue:** When void-engine is loaded alongside st8.html's other panels (explorer, terminal, etc.), keyboard events bubble to `window`. The `e.target` check (line 155) prevents interference with form elements, but if the user types while a non-input panel is focused (e.g., the graph visualizer or file explorer), characters will be silently consumed by void-engine and appended to `BODY_TEXT`. This is by design for the "drift surface" UX but may surprise users.
  - **No undo support:** Typing is append-only with single-character backspace. No word-delete, line-delete, or undo functionality.

---

## Lines 173-184: DOM Element Pool (`syncPool`)

```javascript
var linePool = [];
function syncPool(pool, count, className) {
  while (pool.length < count) {
    const el = document.createElement("div");
    el.className = className;
    stage.appendChild(el);
    pool.push(el);
  }
  for (let i = 0; i < pool.length; i++) {
    pool[i].style.display = i < count ? "" : "none";
  }
}
```

- **What triggers it:** Called from `animate()` at line 305
- **What it calls:** `document.createElement()`, `stage.appendChild()`
- **What calls it:** `animate()` function at line 305
- **Dependencies:** `stage` DOM element
- **Status:** WORKING
- **Gap:**
  - **Line 182:** `display = ""` resets to default (which is `position: absolute` per CSS). The pool grows monotonically — elements are never removed, only hidden. For a chat that grows large, this means DOM element count increases without bound. Not a bug per se, but a memory consideration for very long typing sessions.
  - **Design note:** This is a standard object pool pattern for avoiding GC pressure in animation loops. Well-implemented.

---

## Lines 185-226: `layoutColumn(prepared, startCursor, regionX, regionY, regionW, regionH, lineHeight, circleObs, rectObstacles)`

```javascript
function layoutColumn(prepared, startCursor, regionX, regionY, regionW, regionH, lineHeight, circleObs, rectObstacles) {
  let cursor = startCursor;
  let lineTop = regionY;
  const lines = [];
  let textExhausted = false;
  while (lineTop + lineHeight <= regionY + regionH && !textExhausted) {
    const bandTop = lineTop;
    const bandBottom = lineTop + lineHeight;
    const blocked = [];
    for (let oi = 0; oi < circleObs.length; oi++) {
      const c = circleObs[oi];
      const iv = circleIntervalForBand(c.cx, c.cy, c.r, bandTop, bandBottom, c.hPad, c.vPad);
      if (iv !== null) blocked.push(iv);
    }
    for (let ri = 0; ri < rectObstacles.length; ri++) {
      const r = rectObstacles[ri];
      if (bandBottom <= r.y || bandTop >= r.y + r.h) continue;
      blocked.push({ left: r.x, right: r.x + r.w });
    }
    const slots = carveTextLineSlots({ left: regionX, right: regionX + regionW }, blocked);
    if (slots.length === 0) {
      lineTop += lineHeight;
      continue;
    }
    slots.sort((a, b) => a.left - b.left);
    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si];
      const slotWidth = slot.right - slot.left;
      const line = layoutNextLine(prepared, cursor, slotWidth);
      if (line === null) {
        textExhausted = true;
        break;
      }
      lines.push({ x: Math.round(slot.left), y: Math.round(lineTop), text: line.text, width: line.width });
      cursor = line.end;
    }
    lineTop += lineHeight;
  }
  return { lines, cursor };
}
```

- **What triggers it:** Called from `animate()` at lines 292 and 300
- **What it calls:** `circleIntervalForBand()` (line 196), `carveTextLineSlots()` (line 206), `layoutNextLine()` (line 215)
- **What calls it:** `animate()` function (lines 292, 300)
- **Dependencies:** Pretext library functions, `carveTextLineSlots`, `circleIntervalForBand`
- **Status:** WORKING
- **Gap:**
  - **Lines 194-199:** Circle obstacle loop iterates over `circleObs`, which is always empty (see line 270). This loop body is dead code at runtime. However, the code is architecturally clean — if circles were added to the obstacle list, they'd work immediately.
  - **Line 207-209:** When all slots are blocked (`slots.length === 0`), the line is skipped and `lineTop` advances. This means text "disappears" behind obstacles rather than wrapping around them when a line is fully blocked. This is correct behavior — there's simply no room for text.
  - **Line 215:** `layoutNextLine(prepared, cursor, slotWidth)` — this is the core pretext call. Returns `{text, width, end}` or `null` when text is exhausted. The cursor carries exact position (segment index + grapheme index).
  - **Line 211:** Slots are sorted left-to-right, so text fills leftmost available slots first. For multi-slot lines (text wrapping around both sides of an obstacle), text flows left-to-right across slots. This means text appears to "teleport" across the obstacle gap — it doesn't read continuously. This is the expected behavior for editorial wrap.

---

## Lines 227-261: Pointer/Drag Interaction

```javascript
var pointerX = -9999;
var pointerY = -9999;
function hitTestRects(px, py) {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r;
  }
  return null;
}
stage.addEventListener("pointerdown", (e) => {
  const r = hitTestRects(e.clientX, e.clientY);
  if (r) {
    activeRect = r;
    r.dragging = true;
    r.dragStartX = e.clientX;
    r.dragStartY = e.clientY;
    r.dragStartRectX = r.x;
    r.dragStartRectY = r.y;
    e.preventDefault();
  }
});
window.addEventListener("pointermove", (e) => {
  pointerX = e.clientX;
  pointerY = e.clientY;
  if (activeRect) {
    activeRect.x = activeRect.dragStartRectX + (e.clientX - activeRect.dragStartX);
    activeRect.y = activeRect.dragStartRectY + (e.clientY - activeRect.dragStartY);
  }
});
window.addEventListener("pointerup", () => {
  if (activeRect) {
    activeRect.dragging = false;
    activeRect = null;
  }
});
```

- **What triggers it:** Pointer events on `stage` (pointerdown) and `window` (pointermove, pointerup)
- **What it calls:** `hitTestRects()` (line 237), modifies `rects` and `activeRect` state
- **What calls it:** Browser pointer events
- **Dependencies:** `rects` array (line 136)
- **Status:** WORKING
- **Gap:**
  - **Line 230:** Reverse iteration (`i >= 0`) for z-order — last rect in array has highest priority. This matches the visual stacking since later `appendChild` calls place elements on top. Correct behavior.
  - **No pointer capture:** When dragging starts on `stage` (line 236), the pointer is NOT captured via `setPointerCapture()`. If the user drags the mouse outside the stage element, `pointermove` still fires on `window` (line 248), so the drag continues. This works correctly because `pointermove` is on `window`, not `stage`. However, if the pointer leaves the browser window entirely, the `pointerup` event may not fire, leaving the rect in a permanent "dragging" state. The next `pointerdown` would reset via `hitTestRects`, but there's a visual glitch window.
  - **No boundary clamping:** Rects can be dragged completely off-screen. No bounds checking prevents this.

---

## Lines 262-338: Animation Loop (`animate`)

### Lines 262-266: RAF Setup & Delta Time

```javascript
var lastTime = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
```

- **What triggers it:** `requestAnimationFrame` at line 338 (initial call) and line 264 (recursive)
- **What it calls:** `requestAnimationFrame()`
- **What calls it:** Self-referencing (RAF loop)
- **Dependencies:** Browser RAF API
- **Status:** WORKING (with dead code)
- **Gap:**
  - **Line 265:** `dt` is computed (delta time in seconds, capped at 50ms) but **NEVER USED** anywhere in the function. This is dead code. The original demo likely had animated orbs that used `dt` for smooth motion. Since ST8 only has draggable rects (user-positioned, not auto-animated), `dt` serves no purpose.

### Lines 267-275: Dimension Measurement & Obstacle Building

```javascript
  const pw = stage.clientWidth;
  const ph = stage.clientHeight;
  // Build obstacle list from current rects (with breathing-room padding)
  const circleObs = [];
  const rectObstacles = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    rectObstacles.push({ x: r.x - 14, y: r.y - 4, w: r.w + 28, h: r.h + 8 });
  }
```

- **What triggers it:** Every animation frame
- **What it calls:** `stage.clientWidth`, `stage.clientHeight`
- **What calls it:** `animate()` loop
- **Dependencies:** `rects` array
- **Status:** WORKING
- **Gap:**
  - **Line 270:** `circleObs = []` — always empty. Circle obstacle support is wired up (line 194-199 in `layoutColumn`) but never populated. Dead architecture.
  - **Line 274:** Padding adds 14px left/right and 4px top/bottom around each rect. This creates "breathing room" so text doesn't touch the rect edges. The asymmetric padding (14px horizontal vs 4px vertical) gives more horizontal clearance, which is typographically sensible.

### Lines 276-280: Text Re-preparation

```javascript
  const t0 = performance.now();
  if (bodyDirty) {
    preparedBody = prepareWithSegments(BODY_TEXT, BODY_FONT);
    bodyDirty = false;
  }
```

- **What triggers it:** Every frame, but `prepareWithSegments` only called when `bodyDirty` is true
- **What it calls:** `prepareWithSegments()` (pretext library)
- **What calls it:** `animate()` loop, triggered by keyboard handler setting `bodyDirty = true`
- **Dependencies:** `@chenglou/pretext` library
- **Status:** WORKING
- **Gap:** None. This is an efficient dirty-flag pattern. Text is only re-measured when the user types.

### Lines 282-303: Two-Pass Layout

```javascript
  // Bottom-anchored layout: text grows UPWARD from the chatbox origin.
  const chatBoxBottomY = ph - CHATBOX_BOTTOM_PAD;
  const chatBoxX = CHATBOX_LEFT;
  const cursorBaselineY = chatBoxBottomY - BODY_LINE_HEIGHT;
  const colWidth = Math.max(200, Math.min(pw - chatBoxX * 2, 1100));

  let allBodyLines = [];
  let lastLine = null;

  if (BODY_TEXT.length > 0) {
    // Pass 1: measure unobstructed line count to compute bodyTop.
    const p1 = layoutColumn(preparedBody, { segmentIndex: 0, graphemeIndex: 0 }, chatBoxX, 0, colWidth, ph * 20, BODY_LINE_HEIGHT, [], []);
    const lineCount = Math.max(1, p1.lines.length);
    const totalH = lineCount * BODY_LINE_HEIGHT;
    let bodyTop = chatBoxBottomY - totalH;
    if (bodyTop < GUTTER) bodyTop = GUTTER;
    const bodyHeight = chatBoxBottomY - bodyTop;

    // Pass 2: real layout with rect obstacles in their screen positions.
    const p2 = layoutColumn(preparedBody, { segmentIndex: 0, graphemeIndex: 0 }, chatBoxX, bodyTop, colWidth, bodyHeight, BODY_LINE_HEIGHT, circleObs, rectObstacles);
    allBodyLines = p2.lines;
    if (allBodyLines.length > 0) lastLine = allBodyLines[allBodyLines.length - 1];
  }
```

- **What triggers it:** Every animation frame when `BODY_TEXT` is non-empty
- **What it calls:** `layoutColumn()` twice (lines 292, 300)
- **What calls it:** `animate()` loop
- **Dependencies:** `layoutColumn`, pretext library, all layout constants
- **Status:** WORKING
- **Gap:**
  - **Line 292 (Pass 1):** Lays out text with NO obstacles and `ph * 20` height (effectively infinite). This measures the total line count as if there were no obstacles. The purpose is to compute `bodyTop` — the Y position where text starts, so text grows **upward** from the chatbox anchor. `ph * 20` is a hack for "unlimited height" — it guarantees all text is measured.
  - **Line 296:** `if (bodyTop < GUTTER) bodyTop = GUTTER;` — prevents text from going above the top gutter (48px). Text is clipped rather than scrolling.
  - **Line 300 (Pass 2):** Re-layouts with actual obstacles and the computed `bodyTop`/`bodyHeight`. This is where text actually flows around rects.
  - **Performance note:** Two `layoutColumn` calls per frame means two full pretext layout passes. Since pretext is pure arithmetic (no DOM reads), this is fast (~0.5ms total), but it's double the work needed. For the single-rect ST8 case, the difference is negligible.
  - **Line 293:** `Math.max(1, p1.lines.length)` — ensures at least 1 line height even for empty results. This prevents `totalH = 0` which would collapse `bodyTop` to `chatBoxBottomY`.

### Lines 304-321: DOM Updates (Lines & Rects)

```javascript
  const reflowTime = performance.now() - t0;
  syncPool(linePool, allBodyLines.length, "line");
  for (let i = 0; i < allBodyLines.length; i++) {
    const el = linePool[i];
    const line = allBodyLines[i];
    el.textContent = line.text;
    el.style.left = line.x + "px";
    el.style.top = line.y + "px";
    el.style.font = BODY_FONT;
    el.style.lineHeight = BODY_LINE_HEIGHT + "px";
  }
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    r.el.style.left = r.x + "px";
    r.el.style.top = r.y + "px";
    r.el.style.width = r.w + "px";
    r.el.style.height = r.h + "px";
  }
```

- **What triggers it:** Every animation frame
- **What it calls:** `syncPool()` (line 305), direct DOM style writes
- **What calls it:** `animate()` loop
- **Dependencies:** `linePool`, `syncPool`, `rects`
- **Status:** WORKING (with dead code)
- **Gap:**
  - **Line 304:** `reflowTime` is computed but **NEVER USED**. Dead code — likely intended for a performance debug overlay that was never implemented.
  - **Lines 309-313:** Every frame, `el.style.font` and `el.style.lineHeight` are set even though they never change. These could be set once during `syncPool` element creation. Minor inefficiency (not in scope for this review but noted).

### Lines 323-336: Cursor Positioning & Hover State

```javascript
  // ── Cursor: sits at end of last line, or at chatbox origin if empty ──
  let curX, curY;
  if (lastLine) {
    curX = lastLine.x + lastLine.width + 2;
    curY = lastLine.y;
  } else {
    curX = chatBoxX;
    curY = cursorBaselineY;
  }
  cursorEl.style.left = curX + "px";
  cursorEl.style.top = curY + "px";
  const hovered = hitTestRects(pointerX, pointerY);
  document.body.style.cursor = activeRect ? "grabbing" : hovered ? "grab" : "";
```

- **What triggers it:** Every animation frame
- **What it calls:** `hitTestRects()` (line 334)
- **What calls it:** `animate()` loop
- **Dependencies:** `cursorEl`, `hitTestRects`
- **Status:** WORKING
- **Gap:**
  - **Line 326:** `curX = lastLine.x + lastLine.width + 2` — cursor sits 2px after the last character. The `+2` is a visual offset.
  - **Line 334:** `hitTestRects(pointerX, pointerY)` runs every frame to determine cursor style. With only 1 rect, this is trivial.
  - **Line 335:** Cursor style ternary: `grabbing` (actively dragging) > `grab` (hovering over rect) > default. The empty string `""` resets to CSS default.

### Lines 337-338: Initial Kick

```javascript
lastTime = performance.now();
requestAnimationFrame(animate);
```

- **What triggers it:** Module load (top-level code, executes after `await document.fonts.ready`)
- **What it calls:** `requestAnimationFrame(animate)`
- **What calls it:** Nothing — this is the entry point
- **Dependencies:** `animate` function
- **Status:** WORKING
- **Gap:** None. `lastTime` is initialized to `performance.now()` before the first `animate` call, preventing a large `dt` on the first frame (which is already capped at 0.05 anyway).

---

## Connection Map

### What triggers the void engine?

| Trigger | Source | Mechanism |
|---------|--------|-----------|
| Standalone mode | `void-engine.html:42` | `<script type="module" src="./void-engine.js">` |
| ST8 integrated mode | `st8.html:1638` | `window.loadVoidEngine()` → dynamic `<script>` append of `vendor/void-engine.js` |
| Workspace switch to "pretext-dev" | `st8.html:1910-1925` | Calls `window.loadVoidEngine()` |
| Workspace switch away from "pretext-dev" | `st8.html:1907-1908, 1937-1938` | Calls `window.unloadVoidEngine()` → removes script + clears `#stage` |

### What other files get called?

| Dependency | Type | Used For |
|-----------|------|----------|
| `@chenglou/pretext@0.0.6` | ESM CDN | `prepareWithSegments()`, `layoutNextLine()` — core text measurement |
| `st8.html` | CSS host | `.line`, `.sirkit-rect`, `.void-cursor` styles |
| `void-engine.html` | Standalone host | Self-contained demo page (subset of CSS) |

### Is it still used in ST8?

**YES — conditionally.** The void-engine is loaded ONLY when the user switches to the "pretext-dev" workspace in `st8.html`. It is the proof-of-concept for pretext-powered text layout within the ST8 platform. It is NOT part of the main ST8 application flow (file explorer, terminal, graph visualizer, coordination, etc.).

The `vendor/void-engine.js` copy is the one actually loaded by ST8. The root `void-engine.js` appears to be the development/original copy.

---

## @@@ Handling

**No `@@@` symbols found** in `void-engine.js`. The grep search returned zero matches.

---

## Summary of Findings

| # | Line(s) | Severity | Issue |
|---|---------|----------|-------|
| 1 | 4, 6 | WARNING | Unused imports: `layoutWithLines`, `walkLineRanges` |
| 2 | 10 | WARNING | Unused constant: `HEADLINE_FONT_FAMILY` |
| 3 | 12 | WARNING | Unused constant: `COL_GAP` |
| 4 | 48-106 | WARNING | Dead code: `BODY_TEXT_OLD_DEMO` (~5,400 chars never referenced) |
| 5 | 265 | WARNING | Unused variable: `dt` (delta time computed but never used) |
| 6 | 304 | WARNING | Unused variable: `reflowTime` (computed but never used) |
| 7 | 1 | INFO | Stale comment: `// the-editorial-engine.ts` — file is `void-engine.js` |
| 8 | 270 | INFO | `circleObs` always empty — circle obstacle support is dead architecture |
| 9 | 34-44 | INFO | `circleIntervalForBand()` is wired but never produces results (no circles) |
| 10 | 7 | INFO | External CDN import with no SRI hash |
| 11 | 107 | INFO | No null check on `document.getElementById("stage")` |
| 12 | 113-122 | INFO | Cursor wave-pulse CSS animation missing from `void-engine.html` standalone mode |
| 13 | 236-261 | INFO | No `setPointerCapture()` — rect drag state may persist if pointer leaves browser |

---

_Reviewed: 2026-05-13_
_Reviewer: GSD-Codebase-Reviewer_
_Depth: standard_
