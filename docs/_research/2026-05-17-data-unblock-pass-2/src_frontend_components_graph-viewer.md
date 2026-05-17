# Research: `src/frontend/components/graph-viewer` (data-unblock pass 2)

Date: 2026-05-17. Mode: read-only.

The graph-viewer renders the D3 force-directed connection graph that opens
from the phreak terminal (`terminal.js:735 → St8GraphVisualizer.showGraphPopup`)
and is the only visualization in st8 that paints the *import graph itself*
to the user. Its data path is materially affected by batch 031's
`connection-resolver` work, but the viewer doesn't yet benefit because
it consumes the manifest's `imports[].source` raw-string field — not the
persistence-derived edges that batch 031 fixed.

## 1. File inventory

| File | LOC | Role |
|---|---:|---|
| `src/frontend/components/graph-viewer/graph-viewer.js` | 585 | D3 force-directed renderer + popup shell. Exposes `window.St8GraphVisualizer.{showGraphPopup,resetZoom}`. Includes node-details popup, status-filter buttons, a11y (focus trap, ARIA dialog, Escape, focus return) added in Wave 5I FRONT-005. |
| `src/frontend/components/graph-viewer/graph-viewer.css` | 110 | Popup chrome (`.graph-popup-overlay`, `.graph-popup`, header/body/footer, filter buttons). Extracted verbatim from `st8.html` lines 499–601. |

No `index.js`, no submodules. CSS is loaded from `src/frontend/index.html:57`,
JS from `src/frontend/index.html:177`. Public surface is the global
`window.St8GraphVisualizer`.

## 2. Endpoints consumed

The viewer does **no fetching of its own**. It receives a `manifest`
argument from its single caller (`terminal.js:736`) which in turn reads
the cached `connection-state.json` via `window.VoidFileExplorer.getIndexedFingerprints()`
(set during `st8IndexingComplete` in `app.js:967-975` from `fetchManifest()` →
`GET /api/connection-state.json`).

| Route | Method | Where called | Shape expected by viewer |
|---|---|---|---|
| `/api/connection-state.json` | GET | `src/frontend/app.js:942, 982` (indirect — populates `VoidFileExplorer.indexedFingerprints`, the only data source for `showGraphPopup`). Backend handler `_serveManifest` at `src/core/server/app.js:401, 553-602`. | `{ metadata, files: [{ filepath, filename, status, reachabilityScore, impactRadius, sha256Hash, imports: [{source,names,isDefault}], importedBy: [], intent }] }` |

The viewer is therefore **only as good as `connection-state.json`** —
NOT the SQLite `connections` table, NOT `/api/insights`, NOT the
batch-031 resolver.

## 3. Backend-data accuracy check (post-batch-031)

| Field consumed | Produced where | Status today |
|---|---|---|
| `manifest.files[].status` (GREEN/YELLOW/RED) | `indexer.js:322-332` (classifyBasic) or graph-builder classifier | Produced. Only GREEN/RED actually emitted by `classifyBasic`; YELLOW is reachable only via the maestro-style graph builder branch. |
| `reachabilityScore` | `indexer.js:329` | Stub-quality: hard-coded `0.95` for GREEN, `0.0` for RED in the fallback branch. Real values only via integr8/graph-builder when it runs. |
| `impactRadius` | `indexer.js:330` | **Always 0 in the basic-classifier branch.** Drives node radius (`graph-viewer.js:209-213`) — so every node currently renders the same size. |
| `imports: [{source, ...}]` | `indexer.js:421-431` — raw AST `source` strings (`'./foo'`, `'react'`, etc.) | Produced, but **unresolved**. Batch 031's `connection-resolver` resolves these to filepaths but writes results to SQLite `connections`, NOT into the manifest. |
| `importedBy: []` | `indexer.js:357` reads `f.importedBy` which is never assigned upstream in the per-file pipeline | **Always empty array** in the JSON manifest path. The schema-card emitter (`emitter.js:166-170`) DOES populate this from persistence — but the viewer reads `connection-state.json`, not cards. |

Link-building inside the viewer (`graph-viewer.js:116-131`):

```js
file.imports.forEach(function(imp) {
    var target = manifest.files.find(function(f) {
        return f.filepath === imp.source || f.filename === imp.source;
    });
```

This compares import strings like `'./connection-resolver'` against
file paths like `'src/features/indexing/connection-resolver.js'`.
**It almost never matches.** This is the load-bearing finding for this
audit: the graph viewer is currently drawing nodes-without-edges in the
common case, despite the backend resolver now knowing exactly which
filepath each import maps to.

## 4. UI states gated on missing/wrong data

- **Edge rendering** (`graph-viewer.js:149-200`): the link layer fires only
  for `imports[].source` that exactly equals a `filepath` or `filename`.
  Sibling-relative imports (`./foo`), parent-relative imports (`../core/x`),
  extension-less imports, and directory-index imports all silently drop.
  The viewer LOOKS like it works (nodes render, popup opens, filter chips
  work) but visually claims st8 has ~no connections.
- **Status filter chips** (`graph-viewer.js:393-397`) include a YELLOW chip,
  but `classifyBasic` never emits YELLOW — so that button is unreachable
  in the offline / fallback indexer path. Reachable only when integr8
  graph-builder is alive.
- **`impactRadius`-scaled node size** (`graph-viewer.js:209-213`) and
  the IMPACT RADIUS stat in the node-details popup (`graph-viewer.js:331`):
  display `0` for every node in the basic-classifier branch.
- **REACHABILITY stat** in node-details (`graph-viewer.js:327`): displays
  `0` or `0.95` only — no spread.
- **IMPORTED BY count** (`graph-viewer.js:339-340`): always `0`
  because the manifest's `importedBy` array is never populated.

## 5. Mock / stub regions

None hard-coded. The mock-quality data is upstream (`classifyBasic`,
empty `importedBy`, unresolved `imports[].source`). The viewer itself
is correct given its input contract.

## 6. Categories / enums the UI handles vs canonical-13

The graph viewer is status-oriented, not insight-category-oriented. It
knows `GREEN | YELLOW | RED | (default)` (graph-viewer.js:214-220) and
filters on those (lines 393-397). It does **not** consume `/api/insights`,
does **not** know about `circular_dependency`, the populator's 5
ad-hoc categories, or any of the canonical-13. Cycles detected by the
batch-031 pipeline are invisible here — there's no "highlight cycle"
overlay, no cycle-edge styling, no cycle-member node coloring.

## 7. TOP 3 QUICK WINS

1. **Resolve `imports[].source` in the manifest emitter** (or in
   `manifest-generator.js`, post-indexer). Reuse the freshly-shipped
   `src/features/indexing/connection-resolver.js` (`resolveImportTarget`
   + `buildFileMap`) which already lives in the codebase and is being
   called from `src/core/server/main.js` Pass-2. Add a resolved
   `targetFilepath` field next to `source` on each import (or replace
   `source` outright for first-party imports). The viewer's matcher
   (`graph-viewer.js:119-121`) then succeeds for every first-party
   edge — bringing the visual edge count for st8-on-st8 from near-zero
   to "16 right" parity with the resolver's accurate output.

2. **Populate `manifest.files[].importedBy`** from the SQLite
   `connections` table (or compute it from the same first-party
   resolution pass). The schema-card emitter already does this
   (`emitter.js:166-170`); the JSON manifest emitter does not.
   Unblocks the IMPORTED BY stat in the node-details popup and the
   `force-directed-layout` "fan-in" intuition. ~10 LOC change to
   `manifest-generator.js`.

3. **Highlight cycle members in the graph.** Now that the cycle
   pipeline emits canonical `circular_dependency` insights (batch 031),
   expose them either by enriching the manifest (`cycleMember: true`
   on the per-file record) or by having the viewer fetch
   `/api/insights?category=circular_dependency` once at popup-open
   and color cycle-member nodes (e.g. `#FF6E40` ring). This is the
   first UI surface that would consume canonical-13 data — small
   precedent for the 12 remaining categories.

## 8. Cross-directory dependencies

- **Caller**: `src/frontend/components/terminal/terminal.js:735-736` —
  only invocation site of `St8GraphVisualizer.showGraphPopup`.
- **Manifest provider**: `src/frontend/components/file-explorer/file-explorer.js:763`
  exposes `getIndexedFingerprints()`; populated by `src/frontend/app.js:948-949, 971-972`
  after `GET /api/connection-state.json`.
- **Backend handler**: `src/core/server/app.js:_serveManifest` (lines 401, 553-602).
- **Data producer**: `src/features/indexing/indexer.js:generateManifest`
  (lines 337-362) → `writeManifest` (lines 364-374). NOT
  `src/features/schema-cards/manifest-generator.js` (that one is invoked
  via the `/api/index` POST handler at `app.js:665` but `_serveManifest`
  reads the on-disk file directly — see note below).
- **Vendor**: `src/frontend/vendor/d3/d3.v7.min.js` (offline-first, no CDN).
- **HTML wiring**: `src/frontend/index.html:57, 177`.

## 9. Gaps / open questions

- **Two manifest emitters, one consumer.** `src/features/indexing/indexer.js`
  has its own `generateManifest()` (line 337). `src/features/schema-cards/manifest-generator.js`
  has `generateConnectionState()` (line 83). Both write `connection-state.json`-ish
  shapes; the indexer-internal one runs by default when `options.write !== false`,
  while the schema-cards one is called explicitly from `app.js:665` during
  `POST /api/index`. The two `imports`/`importedBy` projections differ
  (indexer writes empty `importedBy`, schema-cards writes
  fingerprint arrays). Which one ends up on disk at any given moment
  is uncertain and likely state-dependent. **Resolving this is probably a
  prerequisite to either quick-win #1 or #2.**
- The `graph-visualizer.js.json` pre-refactor schema card
  (`st8_json/schema-cards/graph-visualizer.js.json`) shows `imports: []`,
  `importedBy: []`, `impactRadius: 0`, `reachabilityScore: 0`,
  `status: 'RED'` — i.e. even the predecessor module was self-described
  as unconnected in the canonical snapshot. The card-level intent
  trailing `???` ("No external dependencies ???", "Try to load D3 from
  CDN ???") suggests automated intent-seeding ran but no human cleanup
  happened. Not a viewer concern, but worth flagging for the meta-dogfood
  tracker.
- The viewer's `_currentVisualizer` global (line 527, 544) makes the
  popup non-reentrant — opening it twice in quick succession would lose
  the first instance's drag handlers. Not a data issue, but a structural
  one to remember if the cycle-highlight quick-win triggers re-render.
- Should the viewer eventually consume `/api/insights` directly, or
  should `connection-state.json` be enriched with cycle metadata? The
  latter keeps the viewer offline-capable (matches the D3 vendoring
  stance); the former scales better as more canonical categories come
  online. Founder call.

## Corpus-blind-spot checks (NO CHEATS rule)

- `st8_bible.md` references: lines 114, 204, 235, 1525, 2180, 2219, 2257,
  2292, 2298, 2553, 3273. The Batch 030/031 sections (3196, 3331) do
  **not** mention the graph-viewer as a beneficiary or stakeholder —
  confirming the resolver fix did not propagate into the manifest the
  viewer reads.
- `docs/_pending-tickets/frontend-experience.review.md` /
  `.for-review.json`: the only graph-viewer mentions are about Wave 5I
  ticket FRONT-005 (a11y — focus trap, ARIA, Escape). No prior ticket
  has addressed the empty-edges issue. The tests
  `tests/frontend/graph-popup-a11y.test.js` cover popup chrome behavior
  but not data accuracy.
- `docs/components/frontend-experience.md:14` lists `graph-viewer` as a
  current component (not stub, not historical).
- `docs/_pending-roadmap/frontend-experience.md`: no graph items in P1/P2/P3.
- `st8_json/schema-cards/graph-visualizer.js.json`: pre-refactor snapshot
  shows the predecessor module was already self-classified RED with zero
  imports/importedBy — i.e. the legacy state-of-the-world claimed the
  viewer was unreachable. The post-refactor descendant
  (`src/frontend/components/graph-viewer/graph-viewer.js`) is in fact
  reached via `terminal.js:735` and CSS-loaded via `index.html:57`.
  Treating "RED in the legacy card" as "dead code today" would be wrong.

**"I almost called it dead but corpus said otherwise" moment:** the
viewer is fully wired and a11y-polished, but renders almost-no edges
because its input contract (`imports[].source` raw strings) was never
upgraded to consume the batch-031 resolver's output. Easy to mistake
the silence for "stub UI"; it is in fact "live UI starved upstream".
