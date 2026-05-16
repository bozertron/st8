# CODE CITY BARRADEAU BUILDER - Technical Analysis

**Document Type:** Deep System Analysis  
**Source:** `/home/bozertron/Orchestr8_jr/IP/barradeau_builder.py`  
**Target Context:** `a_codex_plan` integration roadmap  
**Analysis Date:** 2026-02-16

---

## Executive Summary

The Barradeau particle builder is a Python-based 3D building generator that transforms source file metrics into volumetric particle representations for Code City visualization. This system implements the core visual metaphor where buildings EMERGE from the Void — a fundamental design principle establishing that static geometry follows emergence, with no breathing or pulsing animations post-crystallization.

The implementation spans two primary files: the Python generator (`barradeau_builder.py`) produces particle and edge data structures, while the JavaScript renderer (`woven_maps_3d.js`) consumes this data for Three.js visualization with emergence animations. This document provides deep analysis across five critical dimensions: particle generation from node data, emergence animation logic, status color mapping, performance considerations, and WovenMaps integration.

---

## 1. Particle Generation from Node Data

### 1.1 Input Data Contract

The `BarradeauBuilding` class accepts five primary inputs that map source file characteristics to 3D building properties. The path parameter identifies the source file, while line_count and export_count serve as the mathematical basis for dimensional calculations. The status parameter determines visual treatment, and the position parameter places the building in scene coordinates.

```python
def __init__(
    self,
    path: str,
    line_count: int,
    export_count: int,
    status: str = "working",
    position: Optional[Dict[str, float]] = None,
    is_locked: bool = False,
):
```

The input node data originates from the GraphData structure in `woven_maps.py`, where each node contains the file path, line count (LOC), export count, status classification, and optional lock state from the Louis protection system.

### 1.2 Dimensional Calculations

The building footprint and height follow LOCKED formulas documented in the CONFIG dictionary. Footprint radius derives from line count using a base value plus linear scaling:

```python
self.footprint_radius = CONFIG["BASE_FOOTPRINT"] + (
    self.line_count * CONFIG["FOOTPRINT_SCALE"]
)
# BASE_FOOTPRINT = 2
# FOOTPRINT_SCALE = 0.008
```

This produces footprints ranging from approximately 2 units for empty files up to 24+ units for large source files (2800 lines yields 24.4 unit radius). Height calculation similarly employs export count as the primary driver:

```python
self.height = CONFIG["MIN_HEIGHT"] + (
    self.export_count * CONFIG["HEIGHT_PER_EXPORT"]
)
# MIN_HEIGHT = 3
# HEIGHT_PER_EXPORT = 0.8
```

A file with 12 exports produces a height of 12.6 units, while a heavily-exported module with 50 exports reaches 43 units. This scaling ensures visual hierarchy reflects the architectural importance of files within the codebase.

### 1.3 Footprint Generation via Delaunay Triangulation

The footprint generation creates an organic, slightly irregular polygon rather than perfect circles. The algorithm generates complexity proportional to file size, capped at 12 primary perimeter points with additional inner ring structures:

```python
complexity = min(12, 6 + self.line_count // 100)
```

The perimeter points use polar coordinates with randomized variance (0.85 to 1.15 multiplier) to create subtle irregularity that reads as architectural authenticity. Inner rings add structural detail, with ring count derived from footprint radius and point count decreasing per ring to create hierarchical detail density.

The center point ensures triangulation closure, and the complete point set feeds into the Bowyer-Watson Delaunay triangulation algorithm implemented in the nested `Delaunay` class. This produces a mesh of triangular faces that define the building cross-section at ground level.

### 1.4 Vertical Extrusion and Particle Placement

The `_extrude_building` method transforms the 2D triangulation into 3D volumetric particles through layer-wise extrusion. The system generates 15 vertical layers (CONFIG["LAYER_COUNT"]) that taper toward the top:

```python
for layer in range(layer_count):
    t = layer / layer_count
    y = t * self.height
    scale = 1 - (layer * taper)  # taper = 0.015
    layer_opacity = 1 - t * 0.5
```

The taper reduction (1.5% per layer) creates the ethereal fade effect where building tops dissolve into the Void. Opacity similarly decreases from full opacity at base to 50% at the apex, reinforcing the emergence-from-nothing visual metaphor.

The Barradeau technique filters edges by length at higher layers, using a threshold that decreases with elevation:

```python
length_threshold = max_edge_length * (1 - t * 0.5)
```

This filtering causes longer perimeter edges to disappear at upper layers while shorter interior edges persist, creating the characteristic dissolution effect where solid cores give way to luminous boundaries.

### 1.5 Particle Density Distribution

Particle density follows the inverse-edge-length principle central to the Barradeau technique. Shorter edges (interior detail) receive more particles than longer edges (perimeter):

```python
density_multiplier = 1 + (1 - edge.length / max_edge_length) * 2
num_particles = max(
    2, int(edge.length * particles_per_unit * density_multiplier)
)
# particles_per_unit = 1.2
```

This produces approximately 1.2 base particles per unit edge length, multiplied by up to 3x for the shortest edges. The result creates dense particle clusters at triangle interiors and sparse particles along boundaries — the inverse of traditional mesh rendering where edges appear thicker than faces.

Each particle receives randomized positional jitter (0.08 unit variance) that prevents mechanical regularity and contributes to the ethereal quality:

```python
x=a_3d["x"] + (b_3d["x"] - a_3d["x"]) * pt + (random.random() - 0.5) * 0.08
```

The final output aggregates all particles into a `BuildingData` dataclass containing position arrays, edge arrays, dimensional metadata, and status indicators suitable for JSON serialization to JavaScript.

---

## 2. Emergence Animation Logic

### 2.1 Animation Philosophy

The emergence animation embodies the philosophical principle that buildings materialize from the Void rather than animating continuously. This is explicitly documented in both Python and JavaScript sources: "Buildings EMERGE from the Void — NO breathing/pulsing animations." The animation plays once on building load, transitioning particles from scattered chaos to organized structure while simultaneously shifting color from teal (potential) to the final status color (crystallization).

### 2.2 JavaScript Implementation

The emergence logic resides in `woven_maps_3d.js` within the `playEmergenceAnimation` method of the `CodeCityScene` class. The animation operates on three simultaneous transformations: positional scatter-to-target, color teal-to-status, and timing-based easing.

```javascript
playEmergenceAnimation(duration = 2000) {
    const emergenceColor = new THREE.Color(CONFIG_3D.COLOR_BROKEN); // Teal
    
    for (const meshGroup of this.buildingMeshes) {
        const positions = meshGroup.particles.geometry.attributes.position;
        const originalPositions = positions.array.slice();
        const count = positions.count;
        const targetColor = new THREE.Color(this.getStatusColor(meshGroup.data.status));
        
        // Scatter phase: random positions within volume
        const scatteredPositions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            scatteredPositions[i3] = (Math.random() - 0.5) * 100;
            scatteredPositions[i3 + 1] = Math.random() * 50;
            scatteredPositions[i3 + 2] = (Math.random() - 0.5) * 100;
        }
        
        // Apply scattered positions and teal color immediately
        positions.array.set(scatteredPositions);
        positions.needsUpdate = true;
        // Color assignment to teal...
    }
}
```

The scattered positions distribute particles across a 100x50x100 unit volume centered on the origin, representing undifferentiated potential. The animation frame loop interpolates each particle from its scattered position to its original (target) position:

```javascript
const animate = () => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    
    const positionEased = 1 - Math.pow(1 - t, 3); // Cubic ease-out
    
    for (let i = 0; i < count * 3; i++) {
        positions.array[i] = scatteredPositions[i] + 
            (originalPositions[i] - scatteredPositions[i]) * positionEased;
    }
    positions.needsUpdate = true;
    
    // Color interpolation with accelerated curve
    const colorT = Math.pow(t, 1.5);
    const currentColor = new THREE.Color().lerpColors(
        emergenceColor, targetColor, colorT
    );
    // Apply color to materials...
};
```

### 2.3 Easing Functions

Two distinct easing curves govern the emergence. Position interpolation uses cubic ease-out (`1 - Math.pow(1 - t, 3)`), creating fast initial movement that settles gently into final position. Color interpolation uses an accelerated curve (`Math.pow(t, 1.5)`), causing color to shift rapidly toward the target while particles are still scattered, completing the transition before positional settling finishes. This asymmetry creates a "crystallization" effect where particles appear to solidify into their final color as they lock into place.

### 2.4 Trigger Points

The emergence animation triggers through two mechanisms. The `addBuilding` method accepts an optional `animateEmergence` parameter that immediately plays the animation when adding individual buildings. The `playEmergenceAnimation` method iterates all existing buildings for coordinated emergence, triggered when the Code City loads or refreshes. The graph builder integration specifies a default duration of 2.5 seconds for coordinated emergence.

---

## 3. Status Color Mapping

### 3.1 Canonical Color Definitions

The status color system follows the canonical definitions documented in CLAUDE.md, establishing three primary states with precise hex values:

| State | Color Name | Hex Value | Integer Value |
|-------|-----------|-----------|---------------|
| Working | Gold-metallic | #D4AF37 | 0xD4AF37 |
| Broken | Teal/Blue | #1FBDEA | 0x1FBDEA |
| Combat | Purple | #9D4EDD | 0x9D4EDD |

The Void background color (#0A0A0B) provides the contrast ground against which all buildings emerge. These values are duplicated in both Python CONFIG and JavaScript CONFIG_3D, ensuring consistent color transmission through the serialization boundary.

### 3.2 Python Color Utilities

The barradeau_builder.py provides two utility functions for color access. The `get_status_color_hex` function returns CSS-compatible hex strings for UI and documentation:

```python
def get_status_color_hex(status: str) -> str:
    colors = {
        "working": CONFIG["COLOR_WORKING"],
        "broken": CONFIG["COLOR_BROKEN"],
        "combat": CONFIG["COLOR_COMBAT"],
    }
    color_int = colors.get(status, CONFIG["COLOR_WORKING"])
    return f"#{color_int:06X}"
```

The `get_status_color_int` function returns integer values suitable for Three.js direct assignment:

```python
def get_status_color_int(status: str) -> int:
    colors = {
        "working": CONFIG["COLOR_WORKING"],
        "broken": CONFIG["COLOR_BROKEN"],
        "combat": CONFIG["COLOR_COMBAT"],
    }
    return colors.get(status, CONFIG["COLOR_WORKING"])
```

### 3.3 JavaScript Color Mapping

The JavaScript renderer implements expanded color mapping to handle status aliases and provide graceful degradation:

```javascript
getStatusColor(status) {
    const colorMap = {
        "working": CONFIG_3D.COLOR_WORKING,
        "broken": CONFIG_3D.COLOR_BROKEN,
        "combat": CONFIG_3D.COLOR_COMBAT,
        "needs_work": CONFIG_3D.COLOR_BROKEN,
        "agents_active": CONFIG_3D.COLOR_COMBAT,
        "gold": CONFIG_3D.COLOR_WORKING,
        "teal": CONFIG_3D.COLOR_BROKEN,
        "purple": CONFIG_3D.COLOR_COMBAT
    };
    return colorMap[status] || CONFIG_3D.COLOR_WORKING;
}
```

The mapping supports multiple semantic aliases: "needs_work" maps to broken (teal), "agents_active" maps to combat (purple), and color names themselves map to corresponding states. This flexibility accommodates various naming conventions across different subsystems while maintaining visual consistency.

### 3.4 Louis Lock Indicator

The system extends status with a fourth visual state for Louis-protected files. Locked buildings display a red lock indicator sprite positioned above the building:

```javascript
if (buildingData.isLocked) {
    lockIndicator = this.createLockIndicator(buildingData);
    this.scene.add(lockIndicator);
}
```

The lock indicator uses a canvas-rendered emoji (🔒) with red fill color, positioned at building height plus 1.5 units. This indicator coexists with the status color, allowing a locked file to display as working/broken/combat while also showing protection status.

### 3.5 Emergence Color Progression

During emergence animation, the system always begins from the teal (broken) color as the "emergence color":

```javascript
const emergenceColor = new THREE.Color(CONFIG_3D.COLOR_BROKEN);
```

This creates consistent animation semantics regardless of final state: buildings emerge from potential (teal) into their crystallized form (gold/purple). The teal origin reinforces the Void metaphor where all matter begins as undifferentiated potential before taking final shape.

---

## 4. Performance Considerations

### 4.1 Particle Count Budgets

The system operates with configurable particle budgets that balance visual fidelity against rendering performance. The graph builder configuration exposes these as tunable parameters:

```python
particle_cpu_cap: int = 180000
particle_gpu_target_cap: int = 1_000_000
emergence_frame_spawn_cap: int = 700
```

The CPU cap (180,000 particles) represents the fallback limit when GPU acceleration is unavailable. The GPU target cap (1,000,000 particles) enables high-fidelity rendering on capable hardware. The emergence frame spawn cap limits particles processed per frame during animation to prevent frame drops.

### 4.2 Barradeau Density Optimization

The inverse-edge-length density principle provides automatic level-of-detail optimization. Large files with many lines generate larger footprints with longer perimeter edges. These longer edges receive fewer particles due to the density formula, while shorter interior edges from Delaunay triangulation receive more particles. The net effect: complex files concentrate particles in detailed interiors while simplifying boundaries, maintaining visual density without proportional particle count inflation.

### 4.3 Layer Filtering Efficiency

The edge length filtering at upper layers provides significant particle reduction for tall buildings. A building with 15 layers progressively discards longer edges, potentially reducing particle count by 50% or more in the upper half. This creates the ethereal dissolution effect while naturally limiting total particle generation.

### 4.4 Three.js Rendering Optimizations

The JavaScript renderer employs several performance strategies. Custom ShaderMaterial with additive blending provides GPU-accelerated particle rendering with soft glow effects without expensive post-processing. BufferGeometry with typed arrays (Float32Array) enables efficient GPU memory layout and batch rendering. Point size attenuation based on camera distance ensures particles scale appropriately without expensive mesh scaling operations.

The render loop uses requestAnimationFrame with conditional post-processing:

```javascript
if (this.composer && typeof this.composer.render === "function") {
    this.composer.render();
} else {
    this.renderer.render(this.scene, this.camera);
}
```

When EffectComposer is unavailable (missing Three.js addons), the system falls back to direct renderer calls, maintaining functionality at reduced visual quality.

### 4.5 Memory Management

The `clearBuildings` method properly disposes all Three.js resources to prevent memory leaks during scene refreshes:

```javascript
clearBuildings() {
    for (const meshGroup of this.buildingMeshes) {
        meshGroup.particles.geometry.dispose();
        meshGroup.particles.material.dispose();
        meshGroup.lines.geometry.dispose();
        meshGroup.lines.material.dispose();
        
        if (meshGroup.lockIndicator) {
            // Dispose lock indicator resources...
        }
    }
}
```

This disposal pattern ensures clean memory release when rebuilding the scene with updated graph data.

### 4.6 Payload Size Guard

The Code City render pipeline includes a payload size guard that prevents oversized data from destabilizing the marimo runtime. When the serialized payload exceeds 9,000,000 bytes (configurable via ORCHESTR8_CODE_CITY_MAX_BYTES), the system attempts rebuilding with IP/ as the root path to reduce scope. If still oversized, a compact warning panel displays rather than crashing the visualization.

---

## 5. Integration with WovenMaps

### 5.1 Data Flow Architecture

The integration follows a unidirectional data flow from WovenMaps graph construction through Barradeau generation to JavaScript rendering. The `generate_barradeau_buildings` function in `woven_maps.py` orchestrates this flow:

```python
def generate_barradeau_buildings(
    graph_data: "GraphData",
    layout_scale: float = 10.0,
) -> List[Dict[str, Any]]:
    from IP.barradeau_builder import BarradeauBuilding
    
    buildings = []
    for node in graph_data.nodes:
        position = {"x": node.x * layout_scale, "z": node.y * layout_scale}
        
        building = BarradeauBuilding(
            path=node.path,
            line_count=node.loc,
            export_count=node.export_count,
            status=node.status,
            position=position,
            is_locked=getattr(node, "is_locked", False),
        )
        
        building_data = building.get_building_data().to_json()
        buildings.append(building_data)
    
    return buildings
```

The function iterates graph nodes, translates 2D layout coordinates to 3D scene coordinates using the layout_scale factor, instantiates BarradeauBuilding for each node, serializes results, and returns the building array.

### 5.2 Template Integration

The `create_3d_code_city` function wraps building generation with metadata:

```python
def create_3d_code_city(
    graph_data: "GraphData",
    layout_scale: float = 10.0,
) -> Dict[str, Any]:
    buildings = generate_barradeau_buildings(graph_data, layout_scale)
    
    return {
        "buildings": buildings,
        "metadata": {
            "total_buildings": len(buildings),
            "layout_scale": layout_scale,
            "generated_at": datetime.now().isoformat(),
        },
    }
```

The complete data package (buildings + metadata) passes to the WovenMaps HTML template, which initializes the CodeCityScene JavaScript class and loads the building data.

### 5.3 Serialization Contract

The BuildingData.to_json() method defines the serialization contract between Python and JavaScript:

```python
def to_json(self) -> Dict[str, Any]:
    return {
        "path": self.path,
        "status": self.status,
        "isLocked": self.is_locked,
        "position": self.position,
        "footprintRadius": self.footprint_radius,
        "height": self.height,
        "particles": self.particles,
        "edges": self.edges,
        "lineCount": self.line_count,
        "exportCount": self.export_count,
        "particleCount": len(self.particles),
        "edgeCount": len(self.edges),
    }
```

JavaScript expects these exact keys when deserializing in the `createBuildingMesh` and `createBuildingLines` methods. Any schema changes require coordinated updates across the Python/JavaScript boundary.

### 5.4 Import Strategy

The barradeau_builder import uses a flexible strategy accommodating different module resolution contexts:

```python
try:
    from IP.barradeau_builder import BarradeauBuilding
except ImportError:
    from barradeau_builder import BarradeauBuilding
```

The primary import path assumes IP/ is on the Python path (standard orchestr8 deployment). The fallback supports standalone testing and alternative deployment configurations.

### 5.5 3D Streaming Strategy

The CLAUDE.md session notes document a recent evolution in the 3D rendering strategy. Rather than inlining full particle and edge arrays into iframe srcdoc (which risks exceeding payload limits), the current implementation generates 3D buildings client-side from graph nodes streamed progressively. The stream budget is controlled by `ORCHESTR8_CODE_CITY_STREAM_BPS` (default 5,000,000 bytes/sec). Legacy heavy inline mode can be re-enabled with `ORCHESTR8_CODE_CITY_INLINE_BUILDING_DATA=1`.

This streaming approach addresses the oversized payload issue that previously caused render failures with large codebases.

---

## Architectural Summary

The Barradeau particle builder implements a complete visualization pipeline from source file metrics to 3D emergence animation. The Python layer transforms line counts and export counts into Delaunay-triangulated volumetric structures with particle density following the inverse-edge-length principle. The JavaScript layer renders these particles using Three.js with custom shaders and orchestrates the emergence animation that embodies the Void-to-crystallization philosophical framework.

The integration with WovenMaps follows a clear data flow: graph construction produces nodes with file metrics, BarradeauBuilding generates particle data, serialization transfers to JavaScript, and CodeCityScene renders with emergence animation. Color mapping maintains consistency through duplicated CONFIG dictionaries in both languages, with status determining the crystallized color while emergence always originates from teal potential.

Performance considerations span both layers: the Python generation applies density optimization through inverse-edge-length distribution and layer filtering, while JavaScript rendering employs BufferGeometry, typed arrays, additive blending, and conditional post-processing. The payload size guard prevents runtime failures with large codebases through scope reduction and fallback warnings.

This system serves as the primary visual interface for Code City in Orchestr8, transforming abstract code metrics into the spatial metaphor of buildings emerging from the Void — the foundational visual language of the eventual ∅明nos megacity.
