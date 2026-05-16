/* ═══════════════════════════════════════════════════════════════
   ST8 DIVE-IN — Barradeau 3D building view for a single file
   ═══════════════════════════════════════════════════════════════

   Phase C. When a user clicks a particle in the flat constellation
   and that file has substantive analysis content (errors, exports,
   high impact radius), the dive-in opens as a full-screen overlay
   showing the file as a Barradeau-style particle building.

   Why Barradeau (per the founder's brief):
     - Buildings EMERGE from the void (scatter -> position animation,
       teal -> status color), reinforcing the "matter from potential"
       metaphor.
     - Particle density follows the inverse-edge-length principle:
       more particles on shorter (interior) edges, fewer on long
       perimeter edges. Files concentrate detail in their core.
     - Status colors match the constellation:
         GREEN / working   -> --gold  (#D4AF37)
         RED / broken      -> --cyan  (#1FBDEA — bug-juice)
         COMBAT (future)   -> --purple (#9D4EDD — agents-active)
       Locked files will get a red lock indicator above the building
       (NOT YET IMPLEMENTED — see DEFERRAL NOTE below).

   ─── DEFERRAL NOTE: red lock indicator ──────────────────────────
   (identity-and-analysis ticket 12, Wave 3C)

   The red lock indicator referenced in
   /home/user/st8/docs/Sonic/CODE_CITY_BARRADEAU_BUILDER.md is a
   cross-cluster feature that this cluster cannot ship in isolation.
   It requires two upstream pieces neither of which exists today:

     1. A locked-file STATE source on the data side. This is
        louis-and-locking cluster Phase L1 territory: see
        docs/_pending-roadmap/louis-and-locking.md — specifically
        the `locked INTEGER DEFAULT 0` column addition to
        file_registry, the lock-manager.js chmod primitive, and the
        GET /api/locks endpoint. Until that lands, the dive-in has
        no way to ask "is this file locked?" without inventing its
        own lock semantics.

     2. The 3D RENDER for the indicator (a red lock sprite or
        billboarded mesh positioned above the building's max-height
        particle envelope, with bloom/glow consistent with the rest
        of the scene). This is frontend-experience cluster (Wave 7)
        scope — it is a visual/interaction primitive, not an
        identity-and-analysis concern.

   Sequencing: Wave 7 (frontend) cannot implement the render until
   Wave 8/louis ships the data source, so this dive-in comment
   stays as documentary intent until BOTH clusters have shipped
   their halves. When they do, the implementation is:
   (a) GET /api/locks on `show(file)`, (b) if file.filepath is in
   the response, attach a sprite at `building.position + (0, height
   + offset, 0)` colored 0xFF3344, (c) listen for the LOCK_STATE
   hook (defined in the louis roadmap Phase L1) to update mid-flight
   via setStatus()'s sibling path.

   Cross-cluster pointers:
     - docs/_pending-roadmap/louis-and-locking.md (data source)
     - docs/_pending-roadmap/frontend-experience.md (render layer)

   Source material:
     /home/user/st8/docs/Sonic/CODE_CITY_BARRADEAU_BUILDER.md
     /home/bozertron/Orchestr8_jr/IP/barradeau_builder.py (Python original)
     barradeau3d.html standalone demo (the founder built this)

   Mount target:
     <div id="dive-in-overlay">  — full-screen overlay added to body
     on first show(). Hidden by default.

   Public API (window.St8DiveIn):
     show(file, options)     — open with the given file_registry row
     hide()                  — close + dispose
     isOpen()                — boolean
     setStatus(file, status) — change building color mid-flight
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/controls/OrbitControls.js';
import { EffectComposer } from './three/postprocessing/EffectComposer.js';
import { RenderPass } from './three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './three/postprocessing/UnrealBloomPass.js';

// ─── Constants ─────────────────────────────────────────────────

// Ticket 9 (Wave 7C): STATUS_COLOR lives in the shared single-source
// module at /components/status-colors.js (loaded as a classic <script>
// tag in index.html BEFORE the dive-in ESM module imports). We read
// the INT table from window.St8StatusColors at module-init; falling
// back to the historical inline hex values if the shared module is
// missing (script tag dropped, load-order broken) so the dive-in is
// still functional during local dev when index.html might be in flux.
const STATUS_COLOR = (typeof window !== 'undefined' && window.St8StatusColors && window.St8StatusColors.INT) || {
  GREEN:  0xD4AF37,
  YELLOW: 0xD4AF37,
  RED:    0x1FBDEA,
  COMBAT: 0x9D4EDD,
  LOCKED: 0xC9748F,
};
if (typeof window !== 'undefined' && !window.St8StatusColors) {
  console.warn('[st8:dive-in] components/status-colors.js not loaded — using inline STATUS_COLOR fallback. Verify <script> load order in index.html.');
}

const EMERGENCE_COLOR = 0x1FBDEA;   // always emerge from cyan potential

const BUILDING_CONFIG = {
  baseFootprint:  2,
  footprintScale: 0.008,    // radius per LOC
  minHeight:      3,
  heightPerExport: 0.8,
  layerCount:     15,
  taper:          0.015,    // 1.5% narrowing per layer
  particlesPerUnit: 1.2,
  verticalNoise:  0.3,
  emergenceMs:    2500,
};

// ─── Delaunay 2D (Bowyer-Watson, lifted from barradeau3d.html) ──

class Delaunay2D {
  static triangulate(points) {
    if (points.length < 3) return [];
    const minX = Math.min(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxX = Math.max(...points.map(p => p.x));
    const maxY = Math.max(...points.map(p => p.y));
    const dx = maxX - minX, dy = maxY - minY;
    const deltaMax = Math.max(dx, dy) * 2;
    const p1 = { x: minX - deltaMax, y: minY - deltaMax };
    const p2 = { x: minX + deltaMax * 2, y: minY - deltaMax };
    const p3 = { x: minX + dx / 2, y: maxY + deltaMax };
    let triangles = [{ p1, p2, p3 }];
    for (const point of points) {
      const bad = [];
      for (const tri of triangles) if (this.inCircumcircle(point, tri)) bad.push(tri);
      const polygon = [];
      for (const tri of bad) {
        const edges = [[tri.p1, tri.p2], [tri.p2, tri.p3], [tri.p3, tri.p1]];
        for (const edge of edges) {
          let shared = false;
          for (const other of bad) {
            if (other === tri) continue;
            if (this.hasEdge(edge, other)) { shared = true; break; }
          }
          if (!shared) polygon.push(edge);
        }
      }
      triangles = triangles.filter(t => !bad.includes(t));
      for (const edge of polygon) triangles.push({ p1: edge[0], p2: edge[1], p3: point });
    }
    return triangles.filter(t =>
      t.p1 !== p1 && t.p1 !== p2 && t.p1 !== p3 &&
      t.p2 !== p1 && t.p2 !== p2 && t.p2 !== p3 &&
      t.p3 !== p1 && t.p3 !== p2 && t.p3 !== p3
    );
  }
  static inCircumcircle(p, tri) {
    const ax = tri.p1.x - p.x, ay = tri.p1.y - p.y;
    const bx = tri.p2.x - p.x, by = tri.p2.y - p.y;
    const cx = tri.p3.x - p.x, cy = tri.p3.y - p.y;
    return (ax*ax + ay*ay) * (bx*cy - cx*by) -
           (bx*bx + by*by) * (ax*cy - cx*ay) +
           (cx*cx + cy*cy) * (ax*by - bx*ay) > 0;
  }
  static hasEdge(edge, tri) {
    const edges = [[tri.p1, tri.p2], [tri.p2, tri.p3], [tri.p3, tri.p1]];
    return edges.some(e =>
      (e[0] === edge[0] && e[1] === edge[1]) ||
      (e[0] === edge[1] && e[1] === edge[0])
    );
  }
}

// ─── Footprint generation ──────────────────────────────────────
// Generate an organic, slightly irregular polygon whose complexity
// scales with the file's line count. Mirrors the Python builder.

function makeFootprint(lineCount) {
  const complexity = Math.min(12, 6 + Math.floor(lineCount / 100));
  const baseRadius = BUILDING_CONFIG.baseFootprint + lineCount * BUILDING_CONFIG.footprintScale;
  const points = [];

  // Outer perimeter — polar with jitter
  for (let i = 0; i < complexity; i++) {
    const angle = (i / complexity) * Math.PI * 2;
    const r = baseRadius * (0.85 + Math.random() * 0.30);
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }

  // Inner ring for structural detail
  const ringCount = Math.max(1, Math.floor(baseRadius / 4));
  for (let ring = 1; ring <= ringCount; ring++) {
    const ringR = baseRadius * (1 - ring / (ringCount + 1));
    const ringPts = Math.max(3, Math.floor(complexity / (ring + 1)));
    for (let i = 0; i < ringPts; i++) {
      const angle = (i / ringPts) * Math.PI * 2 + ring * 0.3;
      points.push({ x: Math.cos(angle) * ringR, y: Math.sin(angle) * ringR });
    }
  }

  // Center anchor — closes the triangulation
  points.push({ x: 0, y: 0 });
  return points;
}

// ─── BarradeauBuilding generator ───────────────────────────────

class BarradeauBuilding {
  constructor(file) {
    this.file = file;
    this.particles = [];
    this.edges = [];
  }
  build() {
    const lineCount   = this.file.fileSizeBytes ? Math.max(20, Math.floor(this.file.fileSizeBytes / 60)) : 100;
    const exportCount = (this.file.exports && this.file.exports.length) || 1;
    const height = BUILDING_CONFIG.minHeight + exportCount * BUILDING_CONFIG.heightPerExport;
    const layers = BUILDING_CONFIG.layerCount;
    const taper  = BUILDING_CONFIG.taper;
    const footprint = makeFootprint(lineCount);
    const triangles = Delaunay2D.triangulate(footprint);
    // Unique edges with lengths
    const edgeMap = new Map();
    for (const tri of triangles) {
      const triEdges = [[tri.p1, tri.p2], [tri.p2, tri.p3], [tri.p3, tri.p1]];
      for (const [a, b] of triEdges) {
        const key = a.x < b.x || (a.x === b.x && a.y < b.y)
          ? `${a.x},${a.y}-${b.x},${b.y}`
          : `${b.x},${b.y}-${a.x},${a.y}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, { a, b, length: Math.hypot(b.x - a.x, b.y - a.y) });
        }
      }
    }
    const edges2D = Array.from(edgeMap.values());
    const maxLen = Math.max(...edges2D.map(e => e.length), 1);

    // Vertical extrusion + per-layer edge filtering (Barradeau's trick)
    for (let layer = 0; layer < layers; layer++) {
      const t = layer / layers;
      const y = t * height;
      const scale = 1 - layer * taper;
      const opacity = 1 - t * 0.5;
      const lenThreshold = maxLen * (1 - t * 0.5);
      for (const edge of edges2D) {
        if (edge.length > lenThreshold) continue;
        const a3D = {
          x: edge.a.x * scale,
          y: y + (Math.random() - 0.5) * BUILDING_CONFIG.verticalNoise,
          z: edge.a.y * scale,
        };
        const b3D = {
          x: edge.b.x * scale,
          y: y + (Math.random() - 0.5) * BUILDING_CONFIG.verticalNoise,
          z: edge.b.y * scale,
        };
        this.edges.push({ a: a3D, b: b3D, length: edge.length });
        const densityMult = 1 + (1 - edge.length / maxLen) * 2;
        const n = Math.max(2, Math.floor(edge.length * BUILDING_CONFIG.particlesPerUnit * densityMult));
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          this.particles.push({
            x: a3D.x + (b3D.x - a3D.x) * u + (Math.random() - 0.5) * 0.08,
            y: a3D.y + (b3D.y - a3D.y) * u + (Math.random() - 0.5) * 0.08,
            z: a3D.z + (b3D.z - a3D.z) * u + (Math.random() - 0.5) * 0.08,
            opacity,
            edgeLen: edge.length / maxLen,
          });
        }
      }
    }
    return this;
  }
  getPointsGeometry(colorHex) {
    const baseColor = new THREE.Color(colorHex);
    const accentColor = new THREE.Color(0xD4AF37);  // accent: gold dust at the building's heart
    const positions = new Float32Array(this.particles.length * 3);
    const colors    = new Float32Array(this.particles.length * 3);
    const sizes     = new Float32Array(this.particles.length);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const i3 = i * 3;
      positions[i3]     = p.x;
      positions[i3 + 1] = p.y;
      positions[i3 + 2] = p.z;
      const mixed = baseColor.clone().lerp(accentColor, 1 - p.edgeLen);
      colors[i3]     = mixed.r;
      colors[i3 + 1] = mixed.g;
      colors[i3 + 2] = mixed.b;
      sizes[i] = 0.3 + p.opacity * 0.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    g.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
    return g;
  }
  getLinesGeometry() {
    const positions = [];
    for (const e of this.edges) {
      positions.push(e.a.x, e.a.y, e.a.z, e.b.x, e.b.y, e.b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }
}

// ─── Scene state ───────────────────────────────────────────────

const state = {
  overlay: null,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  composer: null,
  points: null,
  lines: null,
  particleMaterial: null,
  animId: null,
  clock: null,
  currentFile: null,
  // ─── Emergence animation state (ticket 11) ──────────────────
  // BUILDING_CONFIG.emergenceMs governs the entrance animation per
  // the founder's brief: "scatter -> position animation, teal ->
  // status color". `emergence` is populated on each buildForFile()
  // and consumed in the anim tick; null when no animation is active.
  //   startTime    — performance.now() at emergence kickoff
  //   targetColors — Float32Array of final per-particle colors
  //   basePositions — Float32Array of final positions; scatter is
  //                   derived by multiplying by SCATTER_FACTOR on
  //                   tick(0) and interpolating back to *1.0 by
  //                   tick(emergenceMs).
  emergence: null,
};

const SCATTER_FACTOR = 3.0;   // how far the particles start from final pos
const EMERGENCE_RESIZE_LISTENER = { fn: null };   // ticket 12 — stored ref for cleanup

// ─── Materials ─────────────────────────────────────────────────

function buildParticleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uTime;
      void main() {
        vColor = color;
        vec3 pos = position;
        pos.y += sin(uTime * 0.5 + position.x * 0.3) * 0.05;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (150.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = 1.0 - smoothstep(0.0, 0.5, d);
        a = pow(a, 1.5);
        gl_FragColor = vec4(vColor, a * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const LINE_MATERIAL = new THREE.LineBasicMaterial({
  color: 0xFFFFFF, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending,
});

// ─── Overlay DOM ───────────────────────────────────────────────

function ensureOverlay() {
  if (state.overlay) return state.overlay;
  // ─── Ticket 0 — overlay DOM built with class names only ──────
  // All visual rules (positioning, colors, hover/active, responsive,
  // prefers-reduced-motion) live in components/dive-in/dive-in.css.
  // This builder only assigns identifiers and class names — the CSS
  // file owns the look. Display toggling uses the .open class
  // (see show/hide) instead of inline style.display.
  const overlay = document.createElement('div');
  overlay.id = 'dive-in-overlay';
  overlay.className = 'dive-in-overlay';
  overlay.innerHTML = [
    '<div class="dive-in-header">',
    '  <div id="dive-in-filepath"></div>',
    '  <div id="dive-in-meta"></div>',
    '</div>',
    '<button id="dive-in-close" aria-label="Close dive-in">◇</button>',
    '<button id="dive-in-notes">Notes / Make Ticket</button>',
    '<div id="dive-in-canvas-host"></div>',
  ].join('');
  document.body.appendChild(overlay);
  overlay.querySelector('#dive-in-close').addEventListener('click', hide);
  overlay.querySelector('#dive-in-notes').addEventListener('click', function() {
    if (state.currentFile && typeof window.handleFileNotes === 'function') {
      window.handleFileNotes(state.currentFile.filepath);
    }
  });
  document.addEventListener('keydown', function(e) {
    // Ticket 0 — display state lives in the .open class now, not inline style.
    if (e.key === 'Escape' && state.overlay && state.overlay.classList.contains('open')) hide();
  });
  state.overlay = overlay;
  return overlay;
}

// ─── Show / hide ───────────────────────────────────────────────

export function show(file) {
  if (!file) return;
  state.currentFile = file;
  const overlay = ensureOverlay();
  overlay.classList.add('open');

  // Header
  overlay.querySelector('#dive-in-filepath').textContent = file.filepath || file.filename || '';
  overlay.querySelector('#dive-in-meta').textContent =
    'status: ' + (file.status || '?') +
    '   |   exports: ' + ((file.exports && file.exports.length) || 0) +
    '   |   bytes: ' + (file.fileSizeBytes || 0);

  // Scene init or re-use
  if (!state.scene) initScene(overlay.querySelector('#dive-in-canvas-host'));
  // ─── Ticket 17 — restore autoRotate on show ─────────────────
  // hide() stops controls.autoRotate to spare GPU when the overlay
  // isn't visible; resume the rotation here so the next dive-in
  // session starts spinning again.
  if (state.controls) state.controls.autoRotate = true;
  buildForFile(file);
  startAnim();
}

export function hide() {
  if (!state.overlay) return;
  state.overlay.classList.remove('open');
  stopAnim();
  // ─── Ticket 17 — stop autoRotate while hidden ───────────────
  // controls.autoRotate was previously left enabled; even with the
  // anim loop stopped, a subsequent re-init would otherwise carry
  // momentum-state forward. Disable explicitly; show() restores.
  if (state.controls) state.controls.autoRotate = false;
  // We keep the scene alive between opens — cheap re-use, avoids
  // re-allocating Three.js resources. dispose() only on full destroy.
}

// ─── Destroy / teardown (ticket 12) ────────────────────────────
// Full teardown path for HMR-reload or module-destroy scenarios.
// Removes the resize listener registered in initScene(), tears down
// the Three.js scene + DOM, and clears state. Not called in normal
// hide()/show() cycles — those preserve the scene for cheap re-use.
export function destroy() {
  hide();
  if (EMERGENCE_RESIZE_LISTENER.fn) {
    window.removeEventListener('resize', EMERGENCE_RESIZE_LISTENER.fn);
    EMERGENCE_RESIZE_LISTENER.fn = null;
  }
  if (state.points)   { state.points.geometry.dispose(); }
  if (state.lines)    { state.lines.geometry.dispose(); }
  if (state.particleMaterial) state.particleMaterial.dispose();
  if (state.composer) state.composer.dispose && state.composer.dispose();
  if (state.renderer) state.renderer.dispose();
  if (state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
  state.overlay = null;
  state.renderer = null;
  state.scene = null;
  state.camera = null;
  state.controls = null;
  state.composer = null;
  state.points = null;
  state.lines = null;
  state.particleMaterial = null;
  state.currentFile = null;
  state.emergence = null;
}

export function isOpen() {
  // Ticket 0 — overlay open-state is driven by the .open class.
  return !!(state.overlay && state.overlay.classList.contains('open'));
}

// PERF NOTE — ticket 16 (Wave 7C, deferred):
// setStatus calls buildForFile which fully tears down + rebuilds
// the geometry (BarradeauBuilding + Delaunay etc.) just to swap
// the color. The cheap path is to keep the builder + cache the
// color BufferAttribute and rewrite in place. Acceptable today
// because (a) status flips are rare (debug-time bug-juice → green
// or vice-versa, not a hot loop), (b) the dive-in is one file at
// a time so the cost is bounded by a single building's particle
// count (typically <500), and (c) the visible cost is invisible
// against the 2500ms emergence animation that follows.
// Threshold for revisiting: ship the in-place color update when
// setStatus is called >1Hz (LIFECYCLE_TRANSITION batch flow) OR
// the rebuild is measurably stutter-visible (>50ms on commodity
// hardware). See docs/_pending-roadmap/frontend-experience.md
// "Dive-in setStatus in-place color update".
export function setStatus(file, status) {
  if (!state.points || !state.currentFile) return;
  if (file.fingerprint !== state.currentFile.fingerprint) return;
  state.currentFile.status = status;
  buildForFile(state.currentFile);
}

// ─── Scene management ──────────────────────────────────────────

function initScene(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.setClearColor(0x0A0A0B);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0A0A0B, 0.02);

  const camera = new THREE.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.1, 500);
  camera.position.set(25, 20, 25);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(host.clientWidth, host.clientHeight),
    1.2, 0.4, 0.1
  ));

  state.renderer = renderer;
  state.scene = scene;
  state.camera = camera;
  state.controls = controls;
  state.composer = composer;
  state.particleMaterial = buildParticleMaterial();
  state.clock = new THREE.Clock();

  // ─── Resize listener (ticket 12) ────────────────────────────
  // Store the handler reference so destroy() can call
  // removeEventListener with the same function identity. Without
  // this, an HMR reload or module-destroy leaves the listener
  // attached and the now-orphan camera/renderer get poked on resize.
  const onResize = function() {
    if (!host.clientWidth) return;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
    composer.setSize(host.clientWidth, host.clientHeight);
  };
  window.addEventListener('resize', onResize);
  EMERGENCE_RESIZE_LISTENER.fn = onResize;
}

function buildForFile(file) {
  if (!state.scene) return;
  // Remove prior building
  if (state.points)  { state.scene.remove(state.points);  state.points.geometry.dispose(); }
  if (state.lines)   { state.scene.remove(state.lines);   state.lines.geometry.dispose(); }

  const builder = new BarradeauBuilding(file).build();
  const colorHex = file.locked ? STATUS_COLOR.LOCKED : (STATUS_COLOR[file.status] || STATUS_COLOR.GREEN);

  const pointsGeom = builder.getPointsGeometry(colorHex);
  state.points = new THREE.Points(pointsGeom, state.particleMaterial);
  state.lines  = new THREE.LineSegments(builder.getLinesGeometry(), LINE_MATERIAL);
  state.scene.add(state.points);
  state.scene.add(state.lines);

  // ─── Kick off emergence animation (ticket 11) ─────────────
  // Snapshot the target positions + colors, then overwrite the live
  // attributes with the scattered-out / cyan-tinted starting state.
  // The anim tick interpolates back over BUILDING_CONFIG.emergenceMs.
  const targetPositions = new Float32Array(pointsGeom.attributes.position.array);
  const targetColors    = new Float32Array(pointsGeom.attributes.color.array);
  const emergeColor = new THREE.Color(EMERGENCE_COLOR);
  const livePos = pointsGeom.attributes.position.array;
  const liveCol = pointsGeom.attributes.color.array;
  for (let i = 0; i < livePos.length; i += 3) {
    livePos[i]     = targetPositions[i]     * SCATTER_FACTOR;
    livePos[i + 1] = targetPositions[i + 1] * SCATTER_FACTOR;
    livePos[i + 2] = targetPositions[i + 2] * SCATTER_FACTOR;
    liveCol[i]     = emergeColor.r;
    liveCol[i + 1] = emergeColor.g;
    liveCol[i + 2] = emergeColor.b;
  }
  pointsGeom.attributes.position.needsUpdate = true;
  pointsGeom.attributes.color.needsUpdate = true;
  state.emergence = {
    startTime: performance.now(),
    targetPositions,
    targetColors,
  };

  // Center the camera target on the building's middle
  const midY = (builder.particles.length ? builder.particles.reduce((s,p)=>s+p.y,0) / builder.particles.length : 0);
  state.controls.target.set(0, midY, 0);
  state.controls.update();
}

// ─── Emergence tick (ticket 11) ─────────────────────────────
// Interpolates the live position + color BufferAttributes from the
// scattered/cyan starting snapshot back to the target geometry over
// BUILDING_CONFIG.emergenceMs. Self-clears state.emergence on completion.
function updateEmergence(nowMs) {
  const e = state.emergence;
  if (!e || !state.points) return;
  const elapsed = nowMs - e.startTime;
  const tRaw = Math.min(1, elapsed / BUILDING_CONFIG.emergenceMs);
  // ease-out cubic for organic settle (matches the orbit-control damping feel)
  const t = 1 - Math.pow(1 - tRaw, 3);
  const livePos = state.points.geometry.attributes.position.array;
  const liveCol = state.points.geometry.attributes.color.array;
  const tgtPos  = e.targetPositions;
  const tgtCol  = e.targetColors;
  const emergeColor = new THREE.Color(EMERGENCE_COLOR);
  const scaleStart = SCATTER_FACTOR;
  const scale = scaleStart + (1 - scaleStart) * t;   // SCATTER → 1.0
  for (let i = 0; i < livePos.length; i += 3) {
    livePos[i]     = tgtPos[i]     * scale;
    livePos[i + 1] = tgtPos[i + 1] * scale;
    livePos[i + 2] = tgtPos[i + 2] * scale;
    liveCol[i]     = emergeColor.r + (tgtCol[i]     - emergeColor.r) * t;
    liveCol[i + 1] = emergeColor.g + (tgtCol[i + 1] - emergeColor.g) * t;
    liveCol[i + 2] = emergeColor.b + (tgtCol[i + 2] - emergeColor.b) * t;
  }
  state.points.geometry.attributes.position.needsUpdate = true;
  state.points.geometry.attributes.color.needsUpdate = true;
  if (tRaw >= 1) state.emergence = null;
}

// ─── Animation loop ────────────────────────────────────────────

function startAnim() {
  if (state.animId) return;
  function tick() {
    state.animId = requestAnimationFrame(tick);
    const time = state.clock.getElapsedTime();
    if (state.particleMaterial) state.particleMaterial.uniforms.uTime.value = time;
    if (state.emergence) updateEmergence(performance.now());
    if (state.controls) state.controls.update();
    if (state.composer) state.composer.render();
  }
  tick();
}

function stopAnim() {
  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
}

// ─── Expose for non-ESM callers (app.js) ───────────────────────

window.St8DiveIn = { show, hide, isOpen, setStatus, destroy };
