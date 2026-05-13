// the-editorial-engine.ts
import {
  prepareWithSegments,
  layoutWithLines,
  layoutNextLine,
  walkLineRanges
} from "https://esm.sh/@chenglou/pretext@0.0.6";
var BODY_FONT = '18px "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif';
var BODY_LINE_HEIGHT = 30;
var HEADLINE_FONT_FAMILY = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif';
var GUTTER = 48;
var COL_GAP = 40;
var MIN_SLOT_WIDTH = 50;
function carveTextLineSlots(base, blocked) {
  let slots = [base];
  for (let bi = 0;bi < blocked.length; bi++) {
    const iv = blocked[bi];
    const next = [];
    for (let si = 0;si < slots.length; si++) {
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
// Old demo prose preserved for reference; the void starts empty in st8.
var BODY_TEXT = ``;
var bodyDirty = false;
var BODY_TEXT_OLD_DEMO = `The web renders text through a pipeline that was designed thirty years ago for static documents. A browser loads a font, shapes the text into glyphs, measures their combined width, determines where lines break, and positions each line vertically. Every step depends on the previous one. Every step requires the rendering engine to consult its internal layout tree — a structure so expensive to maintain that browsers guard access to it behind synchronous reflow barriers that can freeze the main thread for tens of milliseconds at a time.

For a paragraph in a blog post, this pipeline is invisible. The browser loads, lays out, and paints before the reader’s eye has traveled from the address bar to the first word. But the web is no longer a collection of static documents. It is a platform for applications, and those applications need to know about text in ways the original pipeline never anticipated.

A messaging application needs to know the exact height of every message bubble before rendering a virtualized list. A masonry layout needs the height of every card to position them without overlap. An editorial page needs text to flow around images, advertisements, and interactive elements. A responsive dashboard needs to resize and reflow text in real time as the user drags a panel divider.

Every one of these operations requires text measurement. And every text measurement on the web today requires a synchronous layout reflow. The cost is devastating. Measuring the height of a single text block forces the browser to recalculate the position of every element on the page. When you measure five hundred text blocks in sequence, you trigger five hundred full layout passes. This pattern, known as layout thrashing, is the single largest source of jank on the modern web.

Chrome DevTools will flag it with angry red bars. Lighthouse will dock your performance score. But the developer has no alternative — CSS provides no API for computing text height without rendering it. The information is locked behind the DOM, and the DOM makes you pay for every answer.

Developers have invented increasingly desperate workarounds. Estimated heights replace real measurements with guesses, causing content to visibly jump when the guess is wrong. ResizeObserver watches elements for size changes, but it fires asynchronously and always at least one frame too late. IntersectionObserver tracks visibility but says nothing about dimensions. Content-visibility allows the browser to skip rendering off-screen elements, but it breaks scroll position and accessibility. Each workaround addresses one symptom while introducing new problems.

The CSS Shapes specification, finalized in 2014, was supposed to bring magazine-style text wrap to the web. It allows text to flow around a defined shape — a circle, an ellipse, a polygon, even an image alpha channel. On paper, it was the answer. In practice, it is remarkably limited. CSS Shapes only works with floated elements. Text can only wrap on one side of the shape. The shape must be defined statically in CSS — you cannot animate it or change it dynamically without triggering a full layout reflow. And because it operates within the browser’s layout engine, you have no access to the resulting line geometry. You cannot determine where each line of text starts and ends, how many lines were generated, or what the total height of the shaped text block is.

The editorial layouts we see in print magazines — text flowing around photographs, pull quotes interrupting the column, multiple columns with seamless text handoff — have remained out of reach for the web. Not because they are conceptually difficult, but because the performance cost of implementing them with DOM measurement makes them impractical. A two-column editorial layout that reflows text around three obstacle shapes requires measuring and positioning hundreds of text lines. At thirty milliseconds per measurement, this would take seconds — an eternity for a render frame.

What if text measurement did not require the DOM at all? What if you could compute exactly where every line of text would break, exactly how wide each line would be, and exactly how tall the entire text block would be, using nothing but arithmetic?

This is the core insight of pretext. The browser’s canvas API includes a measureText method that returns the width of any string in any font without triggering a layout reflow. Canvas measurement uses the same font engine as DOM rendering — the results are identical. But because it operates outside the layout tree, it carries no reflow penalty.

Pretext exploits this asymmetry. When text first appears, pretext measures every word once via canvas and caches the widths. After this preparation phase, layout is pure arithmetic: walk the cached widths, track the running line width, insert line breaks when the width exceeds the maximum, and sum the line heights. No DOM. No reflow. No layout tree access.

The performance improvement is not incremental. Measuring five hundred text blocks with DOM methods costs fifteen to thirty milliseconds and triggers five hundred layout reflows. With pretext, the same operation costs 0.05 milliseconds and triggers zero reflows. This is a three hundred to six hundred times improvement. But even that number understates the impact, because pretext’s cost does not scale with page complexity — it is independent of how many other elements exist on the page.

With DOM-free text measurement, an entire class of previously impractical interfaces becomes trivial. Text can flow around arbitrary shapes, not because the browser’s layout engine supports it, but because you control the line widths directly. For each line of text, you compute which horizontal intervals are blocked by obstacles, subtract them from the available width, and pass the remaining width to the layout engine. The engine returns the text that fits, and you position the line at the correct offset.

This is exactly what CSS Shapes tried to accomplish, but with none of its limitations. Obstacles can be any shape — rectangles, circles, arbitrary polygons, even the alpha channel of an image. Text wraps on both sides simultaneously. Obstacles can move, animate, or be dragged by the user, and the text reflows instantly because the layout computation takes less than a millisecond.

Shrinkwrap is another capability that CSS cannot express. Given a block of multiline text, what is the narrowest width that preserves the current line count? CSS offers fit-content, which works for single lines but always leaves dead space for multiline text. Pretext solves this with a binary search over widths: narrow until the line count increases, then back off. The result is the tightest possible bounding box — perfect for chat message bubbles, image captions, and tooltip text.

Virtualized text rendering becomes exact rather than estimated. A virtual list needs to know the height of items before they enter the viewport, so it can position them correctly and calculate scroll extent. Without pretext, you must either render items off-screen to measure them (defeating the purpose of virtualization) or estimate heights and accept visual jumping when items enter the viewport with different heights than predicted. Pretext computes exact heights without creating any DOM elements, enabling perfect virtualization with zero visual artifacts.

Multi-column text flow with cursor handoff is perhaps the most striking capability. The left column consumes text until it reaches the bottom, then hands its cursor to the right column. The right column picks up exactly where the left column stopped, with no duplication, no gap, and perfect line breaking at the column boundary. This is how newspapers and magazines work on paper, but it has never been achievable on the web without extreme hacks involving multiple elements, hidden overflow, and JavaScript-managed content splitting.

Pretext makes it trivial. Call layoutNextLine in a loop for the first column, using the column width. When the column is full, take the returned cursor and start a new loop for the second column. The cursor carries the exact position in the prepared text — which segment, which grapheme within that segment. The second column continues seamlessly from the first.

Adaptive headline sizing is a detail that separates professional typography from amateur layout. The headline should be as large as possible without breaking any word across lines. This requires a binary search: try a font size, measure the text, check if any line breaks occur within a word, and adjust. With DOM measurement, each iteration costs a reflow. With pretext, each iteration is a microsecond of arithmetic.

Real-time text reflow around animated obstacles is the ultimate stress test. The demonstration you are reading right now renders text that flows around multiple moving objects simultaneously, every frame, at sixty frames per second. Each frame, the layout engine computes obstacle intersections for every line of text, determines the available horizontal slots, lays out each line at the correct width and position, and updates the DOM with the results. The total computation time is typically under half a millisecond.

The glowing orbs drifting across this page are not decorative — they are the demonstration. Each orb is a circular obstacle. For every line of text, the engine checks whether the line’s vertical band intersects each orb. If it does, it computes the blocked horizontal interval and subtracts it from the available width. The remaining width might be split into two or more segments — and the engine fills every viable slot, flowing text on both sides of the obstacle simultaneously. This is something CSS Shapes cannot do at all.

All of this runs without a single DOM measurement. The line positions, widths, and text contents are computed entirely in JavaScript using cached font metrics. The only DOM writes are setting the left, top, and textContent of each line element — the absolute minimum required to show text on screen. The browser never needs to compute layout because all positioning is explicit.

This performance characteristic has profound implications for the web platform. For thirty years, the browser has been the gatekeeper of text information. If you wanted to know anything about how text would render — its width, its height, where its lines break — you had to ask the browser, and the browser made you pay for the answer with a layout reflow. This created an artificial scarcity of text information that constrained what interfaces could do.

Pretext removes that constraint. Text information becomes abundant and cheap. You can ask how text would look at a thousand different widths in the time it used to take to ask about one. You can recompute text layout every frame, every drag event, every pixel of window resize, without any performance concern.

The implications extend beyond layout into composition. When you have instant text measurement, you can build compositing engines that combine text with graphics, animation, and interaction in ways that were previously reserved for game engines and native applications. Text becomes a first-class participant in the visual composition, not a static block that the rest of the interface must work around.

Imagine a data visualization where labels reflow around chart elements as the user zooms and pans. Imagine a collaborative document editor where text flows around embedded widgets, images, and annotations placed by other users, updating live as they move things around. Imagine a map application where place names wrap intelligently around geographic features rather than overlapping them. These are not hypothetical — they are engineering problems that become solvable when text measurement costs a microsecond instead of thirty milliseconds.

The open web deserves typography that matches its ambition. We build applications that rival native software in every dimension except text. Our animations are smooth, our interactions are responsive, our graphics are stunning — but our text sits in rigid boxes, unable to flow around obstacles, unable to adapt to dynamic layouts, unable to participate in the fluid compositions that define modern interface design.

This is what changes when text measurement becomes free. Not slightly better — categorically different. The interfaces that were too expensive to build become trivial. The layouts that existed only in print become interactive. The text that sat in boxes begins to flow.

The web has been waiting thirty years for this. A fifteen kilobyte library with zero dependencies delivers it. No browser API changes needed. No specification process. No multi-year standardization timeline. Just math, cached measurements, and the audacity to ask: what if we simply stopped asking the DOM?

Fifteen kilobytes. Zero dependencies. Zero DOM reads. And the text flows.`;
var stage = document.getElementById("stage");

// ── Chatbox anchor (matches original void-input position) ──
var CHATBOX_LEFT = 64;          // matches original padding-left
var CHATBOX_BOTTOM_PAD = 24;    // gap above the dock

// Cursor element — wave-pulse stack of 5 cyan dashes, positioned by layout
var cursorEl = document.createElement("div");
cursorEl.className = "void-cursor visible";
cursorEl.setAttribute("aria-hidden", "true");
for (var ci = 0; ci < 5; ci++) {
  var sp = document.createElement("span");
  sp.textContent = "—";
  cursorEl.appendChild(sp);
}
stage.appendChild(cursorEl);

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
await document.fonts.ready;
var preparedBody = prepareWithSegments(BODY_TEXT, BODY_FONT);

// ── Keyboard: type from the line ──
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
var linePool = [];
function syncPool(pool, count, className) {
  while (pool.length < count) {
    const el = document.createElement("div");
    el.className = className;
    stage.appendChild(el);
    pool.push(el);
  }
  for (let i = 0;i < pool.length; i++) {
    pool[i].style.display = i < count ? "" : "none";
  }
}
function layoutColumn(prepared, startCursor, regionX, regionY, regionW, regionH, lineHeight, circleObs, rectObstacles) {
  let cursor = startCursor;
  let lineTop = regionY;
  const lines = [];
  let textExhausted = false;
  while (lineTop + lineHeight <= regionY + regionH && !textExhausted) {
    const bandTop = lineTop;
    const bandBottom = lineTop + lineHeight;
    const blocked = [];
    for (let oi = 0;oi < circleObs.length; oi++) {
      const c = circleObs[oi];
      const iv = circleIntervalForBand(c.cx, c.cy, c.r, bandTop, bandBottom, c.hPad, c.vPad);
      if (iv !== null)
        blocked.push(iv);
    }
    for (let ri = 0;ri < rectObstacles.length; ri++) {
      const r = rectObstacles[ri];
      if (bandBottom <= r.y || bandTop >= r.y + r.h)
        continue;
      blocked.push({ left: r.x, right: r.x + r.w });
    }
    const slots = carveTextLineSlots({ left: regionX, right: regionX + regionW }, blocked);
    if (slots.length === 0) {
      lineTop += lineHeight;
      continue;
    }
    slots.sort((a, b) => a.left - b.left);
    for (let si = 0;si < slots.length; si++) {
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
var pointerX = -9999;
var pointerY = -9999;
function hitTestRects(px, py) {
  for (let i = rects.length - 1;i >= 0; i--) {
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
var lastTime = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const pw = stage.clientWidth;
  const ph = stage.clientHeight;
  // Build obstacle list from current rects (with breathing-room padding)
  const circleObs = [];
  const rectObstacles = [];
  for (let i = 0;i < rects.length; i++) {
    const r = rects[i];
    rectObstacles.push({ x: r.x - 14, y: r.y - 4, w: r.w + 28, h: r.h + 8 });
  }
  const t0 = performance.now();
  if (bodyDirty) {
    preparedBody = prepareWithSegments(BODY_TEXT, BODY_FONT);
    bodyDirty = false;
  }
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
  const reflowTime = performance.now() - t0;
  syncPool(linePool, allBodyLines.length, "line");
  for (let i = 0;i < allBodyLines.length; i++) {
    const el = linePool[i];
    const line = allBodyLines[i];
    el.textContent = line.text;
    el.style.left = line.x + "px";
    el.style.top = line.y + "px";
    el.style.font = BODY_FONT;
    el.style.lineHeight = BODY_LINE_HEIGHT + "px";
  }
  for (let i = 0;i < rects.length; i++) {
    const r = rects[i];
    r.el.style.left = r.x + "px";
    r.el.style.top = r.y + "px";
    r.el.style.width = r.w + "px";
    r.el.style.height = r.h + "px";
  }

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
}
lastTime = performance.now();
requestAnimationFrame(animate);
