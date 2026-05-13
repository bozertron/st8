/* ═══════════════════════════════════════════════════════════════
   ST8 GRAPH VISUALIZER — Connection Graph Renderer
   ═══════════════════════════════════════════════════════════════

   Renders connection graphs using D3.js force-directed layout.
   References maestro-scaffolder-tool for graph data structures.
   DO NOT copy files from maestro. Import/require by path.

   Public API: window.St8GraphVisualizer
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── D3 LOADING ──────────────────────────────────────────────

let d3 = null;

function loadD3() {
    if (d3) return d3;
    
    // Try to load D3 from CDN
    return new Promise(function(resolve, reject) {
        if (window.d3) {
            d3 = window.d3;
            resolve(d3);
            return;
        }
        
        var script = document.createElement('script');
        script.src = 'https://d3js.org/d3.v7.min.js';
        script.onload = function() {
            d3 = window.d3;
            resolve(d3);
        };
        script.onerror = function() {
            reject(new Error('Failed to load D3.js'));
        };
        document.head.appendChild(script);
    });
}

// ─── GRAPH VISUALIZER CLASS ──────────────────────────────────

class GraphVisualizer {
    constructor(container, options) {
        this.container = container;
        this.width = options.width || 800;
        this.height = options.height || 600;
        this.nodes = [];
        this.links = [];
        this.simulation = null;
        this.svg = null;
        this.onNodeClick = options.onNodeClick || null;
    }
    
    async initialize() {
        await loadD3();
        this._createSVG();
    }
    
    _createSVG() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('viewBox', [0, 0, this.width, this.height]);
        
        // Add zoom behavior
        var zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', function(event) {
                this.svg.select('g').attr('transform', event.transform);
            }.bind(this));
        
        this.svg.call(zoom);
        
        // Add main group
        this.svg.append('g');
    }
    
    setData(manifest) {
        if (!manifest || !manifest.files) return;
        
        this.nodes = manifest.files.map(function(file) {
            return {
                id: file.filepath,
                name: file.filename,
                status: file.status,
                reachabilityScore: file.reachabilityScore || 0,
                impactRadius: file.impactRadius || 0,
                imports: file.imports || [],
                importedBy: file.importedBy || []
            };
        });
        
        this.links = [];
        manifest.files.forEach(function(file) {
            if (file.imports) {
                file.imports.forEach(function(imp) {
                    var target = manifest.files.find(function(f) {
                        return f.filepath === imp.source || f.filename === imp.source;
                    });
                    if (target) {
                        this.links.push({
                            source: file.filepath,
                            target: target.filepath,
                            type: 'import'
                        });
                    }
                }.bind(this));
            }
        }.bind(this));
    }
    
    render() {
        if (!this.svg || !d3) return;
        
        var g = this.svg.select('g');
        
        // Clear previous elements
        g.selectAll('*').remove();
        
        // Create simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(function(d) { return d.id; }).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(30));
        
        // Create links
        var link = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(this.links)
            .enter()
            .append('line')
            .attr('stroke', '#9E9E9E')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);
        
        // Create nodes
        var node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(this.nodes)
            .enter()
            .append('circle')
            .attr('r', function(d) {
                return 5 + (d.impactRadius || 0) * 2;
            })
            .attr('fill', function(d) {
                switch (d.status) {
                    case 'GREEN': return '#D4AF37';
                    case 'YELLOW': return '#1FBDEA';
                    case 'RED': return '#C9748F';
                    default: return '#E0E0E0';
                }
            })
            .attr('stroke', '#0A0A0B')
            .attr('stroke-width', 1.5)
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', function(event, d) {
                    if (!event.active) this.simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                }.bind(this))
                .on('drag', function(event, d) {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', function(event, d) {
                    if (!event.active) this.simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }.bind(this))
            );
        
        // Add click handler
        if (this.onNodeClick) {
            node.on('click', function(event, d) {
                this.onNodeClick(d);
            }.bind(this));
        }
        
        // Add labels
        var label = g.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(this.nodes)
            .enter()
            .append('text')
            .text(function(d) { return d.name; })
            .attr('font-size', 10)
            .attr('font-family', 'Poiret One, sans-serif')
            .attr('fill', '#E0E0E0')
            .attr('text-anchor', 'middle')
            .attr('dy', 20)
            .style('pointer-events', 'none');
        
        // Update positions on tick
        this.simulation.on('tick', function() {
            link
                .attr('x1', function(d) { return d.source.x; })
                .attr('y1', function(d) { return d.source.y; })
                .attr('x2', function(d) { return d.target.x; })
                .attr('y2', function(d) { return d.target.y; });
            
            node
                .attr('cx', function(d) { return d.x; })
                .attr('cy', function(d) { return d.y; });
            
            label
                .attr('x', function(d) { return d.x; })
                .attr('y', function(d) { return d.y; });
        });
    }
    
    destroy() {
        if (this.simulation) {
            this.simulation.stop();
        }
        if (this.svg) {
            this.svg.remove();
        }
    }
}

// ─── GRAPH POPUP ─────────────────────────────────────────────

function showGraphPopup(manifest) {
    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'graph-popup-overlay';
    overlay.innerHTML = '<div class="graph-popup">' +
        '<div class="graph-popup-header">' +
            '<span class="graph-popup-title">CONNECTION GRAPH</span>' +
            '<button class="graph-popup-close" onclick="this.closest(\'.graph-popup-overlay\').remove()">◇</button>' +
        '</div>' +
        '<div class="graph-popup-body" id="graph-popup-body"></div>' +
        '<div class="graph-popup-footer">' +
            '<span class="graph-popup-info">' + (manifest.files ? manifest.files.length : 0) + ' files</span>' +
            '<button class="graph-popup-btn" onclick="window.St8GraphVisualizer.resetZoom()">RESET ZOOM</button>' +
        '</div>' +
    '</div>';
    
    document.body.appendChild(overlay);
    
    // Initialize graph
    var container = document.getElementById('graph-popup-body');
    var visualizer = new GraphVisualizer(container, {
        width: 800,
        height: 500,
        onNodeClick: function(node) {
            console.info('[st8] Node clicked:', node);
            // TODO: Show file details popup
        }
    });
    
    visualizer.initialize().then(function() {
        visualizer.setData(manifest);
        visualizer.render();
        
        // Store reference for reset zoom
        window.St8GraphVisualizer._currentVisualizer = visualizer;
    });
}

// ─── PUBLIC API ───────────────────────────────────────────────

window.St8GraphVisualizer = {
    showGraphPopup: showGraphPopup,
    resetZoom: function() {
        if (window.St8GraphVisualizer._currentVisualizer) {
            window.St8GraphVisualizer._currentVisualizer.svg.call(
                d3.zoom().transform,
                d3.zoomIdentity
            );
        }
    },
    _currentVisualizer: null
};
