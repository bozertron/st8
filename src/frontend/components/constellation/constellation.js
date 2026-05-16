/* ═══════════════════════════════════════════════════════════════
   ST8 CONSTELLATION — flat file overview rendered via particles.js
   ═══════════════════════════════════════════════════════════════

   Phase B of the PM-1 visualization stack.

   The constellation is the FLAT view: each file in file_registry is one
   particle. Healthy files glow gold, broken/bug-juice files glow blue
   (--cyan token). Strands (line_linked) auto-form between proximate
   particles, hinting at the dependency graph without us drawing every
   edge by hand.

   For the dive-in view (single file with errors, rendered as a 3D
   Barradeau building) see components/constellation/barradeau.js
   (Phase C).

   Mount target:
     #stage  inside the center .panel-column[data-panel="st8"]

   Public API (window.St8Constellation):
     init({ targetEl, files, onParticleClick })
     setFiles(files)              — re-seed with new file set
     updateFileStatus(fingerprint, status)  — re-color one particle
     refocus(fingerprint)         — set attraction center to that file
     destroy()                    — tear down (for HMR / dev)

   Notes:
     - We DON'T modify particles.js. We hook into its public api
       (window.pJSDom[i].pJS) after loading to mutate per-particle
       fileId + color, since the upstream library is built for
       anonymous decorative particles.
     - Click handling is at the canvas level + nearest-particle
       hit-test, not relying on particles.js's built-in click modes
       (which only do push/remove/bubble/repulse, none of which fits
       "open a notes popup").
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Status → color mapping ───────────────────────────────────
  // Per the founder's spec: gold for healthy, blue for sad ("bug-juice").
  // The third state from the Barradeau builder doc was "combat" (purple)
  // for agents-active — wired here for future use.
  const STATUS_COLOR = {
    GREEN:   { r: 212, g: 175, b: 55  },   // --gold
    YELLOW:  { r: 212, g: 175, b: 55  },   // gold (slightly desaturated in opacity)
    RED:     { r: 31,  g: 189, b: 234 },   // --cyan (sad / bug-juice)
    LOCKED:  { r: 201, g: 116, b: 143 },   // --pink (louis-protected, future)
    COMBAT:  { r: 157, g: 78,  b: 221 },   // purple (agents-active, future)
  };

  function statusColor(file) {
    if (file && file.locked)            return STATUS_COLOR.LOCKED;
    const s = file && file.status;
    return STATUS_COLOR[s] || STATUS_COLOR.GREEN;
  }

  // ─── State ────────────────────────────────────────────────────
  const state = {
    targetEl: null,
    pJS: null,
    files: [],
    onParticleClick: null,
    initialized: false,
  };

  // ─── Configuration ────────────────────────────────────────────
  // Tuned for st8's aesthetic: subtle drift, faint strands, no
  // aggressive interactivity. The dim default lets the chrome breathe.
  function buildParticlesConfig(fileCount) {
    return {
      particles: {
        // 1 particle per file. particlesJS.density is for ambient
        // background scenes; we want a deterministic 1:1 mapping.
        number: { value: Math.max(fileCount, 1), density: { enable: false } },
        color:  { value: '#D4AF37' },              // default gold; we override per-particle after init
        shape:  { type: 'circle' },
        opacity:{ value: 0.85, random: false, anim: { enable: true, speed: 0.4, opacity_min: 0.6, sync: false } },
        size:   { value: 4,    random: true,  anim: { enable: false } },
        line_linked: {
          enable:   true,
          distance: 140,                            // strand reach in px
          color:    '#1FBDEA',                      // --cyan — strands suggest dependency-graph hint
          opacity:  0.18,
          width:    1,
        },
        move: {
          enable: true,
          speed:  0.6,                              // slow drift — the void is calm
          direction: 'none',
          random:    true,
          straight:  false,
          out_mode:  'bounce',
          attract: { enable: false, rotateX: 600, rotateY: 1200 },
        },
      },
      interactivity: {
        detect_on: 'canvas',
        events: {
          onhover: { enable: true,  mode: 'grab' },  // mousing the void lights up nearby strands
          onclick: { enable: false },                // we handle click ourselves for the notes popup
          resize:  true,
        },
        modes: {
          grab: { distance: 180, line_linked: { opacity: 0.5 } },
        },
      },
      retina_detect: true,
    };
  }

  // ─── Init ─────────────────────────────────────────────────────
  function init(options) {
    options = options || {};
    const targetEl = options.targetEl || document.getElementById('stage');
    if (!targetEl) {
      console.warn('[st8:constellation] target element not found');
      return;
    }
    if (typeof window.particlesJS !== 'function') {
      console.warn('[st8:constellation] particles.lib.js not loaded — did the <script src> drop?');
      return;
    }
    state.targetEl = targetEl;
    state.files = Array.isArray(options.files) ? options.files.slice() : [];
    state.onParticleClick = typeof options.onParticleClick === 'function' ? options.onParticleClick : null;

    // particles.js mounts on a known DOM id. Ensure our target has one.
    if (!targetEl.id) targetEl.id = 'st8-constellation-canvas-host';

    // particles.js renders a <canvas> inside the host. Wipe any prior
    // content (we're taking over the stage area entirely).
    targetEl.innerHTML = '';
    targetEl.style.position = 'absolute';
    targetEl.style.inset = '0';
    targetEl.style.width = '100%';
    targetEl.style.height = '100%';
    targetEl.style.overflow = 'hidden';

    window.particlesJS(targetEl.id, buildParticlesConfig(state.files.length));
    state.pJS = pickPJS(targetEl.id);
    if (!state.pJS) {
      console.warn('[st8:constellation] particlesJS init did not register a pJS instance');
      return;
    }
    state.initialized = true;
    bindFilesToParticles();
    attachClickHandler();
  }

  function pickPJS(domId) {
    // particles.js stores instances in window.pJSDom[i].pJS keyed by tag id.
    if (!Array.isArray(window.pJSDom)) return null;
    for (let i = 0; i < window.pJSDom.length; i++) {
      const dom = window.pJSDom[i];
      if (dom && dom.pJS && dom.pJS.canvas && dom.pJS.tag && dom.pJS.tag.id === domId) {
        return dom.pJS;
      }
    }
    // Fallback — last registered instance.
    return window.pJSDom.length ? window.pJSDom[window.pJSDom.length - 1].pJS : null;
  }

  // ─── Bind file metadata to each particle ──────────────────────
  // particles.js spawns N anonymous particles. We walk pJS.particles.array
  // and decorate each with {fileId, status, originalColor} so click
  // handlers can map (x, y) -> fileId, and so SSE 'mutation' events can
  // re-color individual particles.
  function bindFilesToParticles() {
    if (!state.pJS || !state.pJS.particles || !Array.isArray(state.pJS.particles.array)) return;
    const particles = state.pJS.particles.array;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const file = state.files[i] || null;
      p.fileId = file ? file.fingerprint : null;
      p.filepath = file ? file.filepath : null;
      p.fileStatus = file ? file.status : 'GREEN';
      const rgb = statusColor(file);
      p.color = { value: { r: rgb.r, g: rgb.g, b: rgb.b }, rgb: rgb };
    }
  }

  // ─── Click → nearest particle → callback ──────────────────────
  function attachClickHandler() {
    if (!state.pJS || !state.pJS.canvas || !state.pJS.canvas.el) return;
    const canvas = state.pJS.canvas.el;
    canvas.addEventListener('click', function (ev) {
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (canvas.width  / rect.width);
      const y = (ev.clientY - rect.top)  * (canvas.height / rect.height);
      const hit = nearestParticle(x, y, 32 /* px hit radius */);
      if (!hit) return;
      if (state.onParticleClick) {
        state.onParticleClick({
          fingerprint: hit.fileId,
          filepath:    hit.filepath,
          status:      hit.fileStatus,
          x:           ev.clientX,
          y:           ev.clientY,
        });
      }
    });
  }

  // PERF NOTE — ticket 13 (Wave 7C, deferred):
  // nearestParticle is O(N) per click. Acceptable today: ~1000 files
  // = ~0.1ms per scan on commodity hardware, dwarfed by click-event
  // dispatch overhead. Becomes load-bearing once file counts cross
  // ~5k (node_modules-scope repos). The optimization is a coarse
  // spatial bucket (8x8 grid over the canvas) keyed in
  // bindFilesToParticles() — see
  // docs/_pending-roadmap/frontend-experience.md P3 "Constellation
  // spatial index". Don't ship a half-baked R*-tree.
  function nearestParticle(x, y, maxRadius) {
    if (!state.pJS || !state.pJS.particles) return null;
    const arr = state.pJS.particles.array;
    let best = null;
    let bestDist = maxRadius * maxRadius;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p.fileId) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = p;
      }
    }
    return best;
  }

  // ─── Public mutators ──────────────────────────────────────────
  function setFiles(files) {
    state.files = Array.isArray(files) ? files.slice() : [];
    if (!state.initialized) return;
    // Re-init the canvas if particle count changed materially.
    if (!state.pJS || state.pJS.particles.array.length !== state.files.length) {
      destroy();
      init({ targetEl: state.targetEl, files: state.files, onParticleClick: state.onParticleClick });
      return;
    }
    bindFilesToParticles();
  }

  function updateFileStatus(fingerprint, status) {
    if (!state.pJS) return;
    const arr = state.pJS.particles.array;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].fileId === fingerprint) {
        arr[i].fileStatus = status;
        const rgb = statusColor({ status: status });
        arr[i].color = { value: { r: rgb.r, g: rgb.g, b: rgb.b }, rgb: rgb };
        return true;
      }
    }
    return false;
  }

  function refocus(fingerprint) {
    if (!state.pJS) return;
    const arr = state.pJS.particles.array;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].fileId === fingerprint) {
        // Use particles.js's attract feature by setting mouse position
        // to the particle's coords — the existing 'grab' mode will pull
        // strands toward it visually.
        if (state.pJS.interactivity && state.pJS.interactivity.mouse) {
          state.pJS.interactivity.mouse.pos_x = arr[i].x;
          state.pJS.interactivity.mouse.pos_y = arr[i].y;
        }
        return true;
      }
    }
    return false;
  }

  function destroy() {
    // Ticket 19: the previous guard used `typeof state.pJS.fn` and
    // `typeof state.pJS.fn.vendors` — typeof returns a non-empty string
    // even for `undefined` (the string `"undefined"`), so those two
    // checks were always truthy and only the trailing `typeof ... ===
    // 'function'` actually gated the call. Tightened to real truthy
    // checks on the intermediates plus the function-type check.
    if (state.pJS && state.pJS.fn && state.pJS.fn.vendors && typeof state.pJS.fn.vendors.destroypJS === 'function') {
      try { state.pJS.fn.vendors.destroypJS(); } catch (_) {}
    }
    state.pJS = null;
    state.initialized = false;
  }

  // ─── Export ───────────────────────────────────────────────────
  window.St8Constellation = {
    init: init,
    setFiles: setFiles,
    updateFileStatus: updateFileStatus,
    refocus: refocus,
    destroy: destroy,
  };
})();
