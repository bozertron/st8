/* ═══════════════════════════════════════════════════════════════
   ST8 STATUS COLORS — single source of truth for status->color
   ═══════════════════════════════════════════════════════════════

   Per Wave 7C ticket 9: STATUS_COLOR used to live in TWO files:
     - constellation.js as { r, g, b } floats (0-255), for particles.js
     - dive-in.js      as 0x…       hex integers,    for THREE.js
   The two were kept in sync by convention only. Adding a new state
   (LOCKED was added recently, COMBAT is coming) meant updating both
   files in lock-step. This module is the single source of truth.

   Loaded as a classic <script> tag BEFORE constellation.js (which is
   itself classic-script) so constellation.js sees window.St8StatusColors
   at IIFE-init time. dive-in.js is an ES module; it reads
   window.St8StatusColors at module-init too — the dive-in module is
   guaranteed to load after this script per index.html load order.

   Hex values must stay in sync with styles/tokens.css:
     GREEN/YELLOW → --gold   (#D4AF37)
     RED          → --cyan   (#1FBDEA, bug-juice)
     LOCKED       → --pink   (#C9748F, louis-protected)
     COMBAT       → --purple (#9D4EDD, agents-active)

   Public surface (window.St8StatusColors):
     HEX                 — { GREEN, YELLOW, RED, LOCKED, COMBAT }
                           hex strings without 0x or # prefix; the
                           canonical hue per state. Used to derive
                           the integer + rgb forms.
     INT                 — same keys, integer 0x… values (THREE.js
                           Color constructor expects integers).
     RGB                 — same keys, { r, g, b } objects with 0-255
                           integer components (particles.js consumes
                           these directly).
     resolve(file)       — given a file_registry-like row, returns the
                           { r, g, b } triplet honoring the `locked`
                           override (locked → LOCKED regardless of
                           status). Used by constellation.js.
     resolveInt(file)    — same but returns the integer form. Used by
                           dive-in.js.
     hexToInt(hex)       — utility: 'D4AF37' → 0xD4AF37
     hexToRgb(hex)       — utility: 'D4AF37' → { r:212, g:175, b:55 }
   ═══════════════════════════════════════════════════════════════ */

(function (root, factory) {
  'use strict';
  const exported = factory();
  // Browser global — primary consumer surface.
  if (typeof window !== 'undefined') {
    window.St8StatusColors = exported;
  }
  // CommonJS — Node tests can require() this file directly.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Canonical hex values — must match styles/tokens.css.
  const HEX = {
    GREEN:  'D4AF37',   // --gold
    YELLOW: 'D4AF37',   // --gold (desaturated via opacity at call site)
    RED:    '1FBDEA',   // --cyan (bug-juice)
    LOCKED: 'C9748F',   // --pink (louis-protected)
    COMBAT: '9D4EDD',   // --purple (agents-active)
  };

  function hexToInt(hex) {
    return parseInt(hex, 16);
  }

  function hexToRgb(hex) {
    const n = parseInt(hex, 16);
    return {
      r: (n >> 16) & 0xFF,
      g: (n >> 8)  & 0xFF,
      b:  n        & 0xFF,
    };
  }

  // Pre-derived maps so callers don't pay a parseInt on every lookup.
  const INT = {};
  const RGB = {};
  Object.keys(HEX).forEach(function (k) {
    INT[k] = hexToInt(HEX[k]);
    RGB[k] = hexToRgb(HEX[k]);
  });

  function resolve(file) {
    if (file && file.locked) return RGB.LOCKED;
    const s = (file && file.status) || 'GREEN';
    return RGB[s] || RGB.GREEN;
  }

  function resolveInt(file) {
    if (file && file.locked) return INT.LOCKED;
    const s = (file && file.status) || 'GREEN';
    return Object.prototype.hasOwnProperty.call(INT, s) ? INT[s] : INT.GREEN;
  }

  return { HEX: HEX, INT: INT, RGB: RGB, resolve: resolve, resolveInt: resolveInt, hexToInt: hexToInt, hexToRgb: hexToRgb };
});
