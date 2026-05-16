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
//
// OFFLINE-FIRST (Wave 5H ticket 4):
//   D3.js is vendored locally at src/frontend/vendor/d3/d3.v7.min.js
//   (served from the same origin as everything else under STATIC_DIR
//   == repo root). Previously the script src pointed at
//   https://d3js.org/d3.v7.min.js — that broke the desktop-first /
//   offline stance set during Sonic integration and was also a CSP
//   liability. No network fetch is attempted; if the vendored file
//   is missing, loadD3 rejects (no silent CDN fallback). To refresh:
//     curl -sLo src/frontend/vendor/d3/d3.v7.min.js https://d3js.org/d3.v7.min.js
//   Version pinned to v7.9.0 (matches the previous CDN target).

let d3 = null;

const D3_VENDOR_URL = '/src/frontend/vendor/d3/d3.v7.min.js';

function loadD3() {
    if (d3) return d3;

    // Load D3 from the local vendored copy (offline-first, no CDN).
    return new Promise(function(resolve, reject) {
        if (window.d3) {
            d3 = window.d3;
            resolve(d3);
            return;
        }

        var script = document.createElement('script');
        script.src = D3_VENDOR_URL;
        script.onload = function() {
            d3 = window.d3;
            resolve(d3);
        };
        script.onerror = function() {
            reject(new Error('Failed to load D3.js from ' + D3_VENDOR_URL + ' — vendored file missing? Refresh with: curl -sLo src/frontend/vendor/d3/d3.v7.min.js https://d3js.org/d3.v7.min.js'));
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
        this.zoom = null;
        this.onNodeClick = options.onNodeClick || null;
        this._filterStatus = null;
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
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', function(event) {
                this.svg.select('g').attr('transform', event.transform);
            }.bind(this));
        
        this.svg.call(this.zoom);
        
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
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                var sourceName = typeof d.source === 'object' ? d.source.name : d.source;
                var targetName = typeof d.target === 'object' ? d.target.name : d.target;
                d3.select(this)
                    .attr('stroke', '#D4AF37')
                    .attr('stroke-opacity', 1)
                    .attr('stroke-width', 2);
                // Show tooltip
                var tooltip = d3.select('#graph-link-tooltip');
                if (tooltip.empty()) {
                    tooltip = d3.select('body').append('div')
                        .attr('id', 'graph-link-tooltip')
                        .style('position', 'fixed')
                        .style('background', '#0c0c0e')
                        .style('border', '1px solid var(--cyan, #1FBDEA)')
                        .style('color', 'var(--text, #E0E0E0)')
                        .style('padding', '6px 10px')
                        .style('font-family', "'Poiret One', sans-serif")
                        .style('font-size', '11px')
                        .style('letter-spacing', '1px')
                        .style('border-radius', '3px')
                        .style('pointer-events', 'none')
                        .style('z-index', '1000');
                }
                tooltip.html(sourceName + ' → ' + targetName)
                    .style('left', (event.clientX + 12) + 'px')
                    .style('top', (event.clientY - 10) + 'px')
                    .style('display', 'block');
            })
            .on('mousemove', function(event) {
                d3.select('#graph-link-tooltip')
                    .style('left', (event.clientX + 12) + 'px')
                    .style('top', (event.clientY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('stroke', '#9E9E9E')
                    .attr('stroke-opacity', 0.6)
                    .attr('stroke-width', 1);
                d3.select('#graph-link-tooltip').style('display', 'none');
            });
        
        // Create nodes
        var node = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(this.nodes)
            .enter()
            .append('circle')
            .attr('r', function(d) {
                var base = 6;
                var impact = Math.min(d.impactRadius || 0, 10);
                return base + impact * 2.5;
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

// ─── NODE DETAILS POPUP ─────────────────────────────────────

function _showNodeDetails(node) {
    // Remove existing details popup if any
    var existing = document.getElementById('graph-node-details');
    if (existing) existing.remove();

    var statusColor = {
        'GREEN': '#D4AF37',
        'YELLOW': '#1FBDEA',
        'RED': '#C9748F'
    };

    var details = document.createElement('div');
    details.id = 'graph-node-details';
    details.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
        'background:#0c0c0e;border:1px solid var(--pink, #C9748F);border-radius:8px;' +
        'padding:20px;min-width:300px;max-width:400px;z-index:110;' +
        'box-shadow:0 0 40px rgba(0,0,0,0.8),0 0 20px rgba(201,116,143,0.2);';

    var statusCol = statusColor[node.status] || '#E0E0E0';
    var importCount = node.imports ? node.imports.length : 0;
    var importedByCount = node.importedBy ? node.importedBy.length : 0;

    details.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
            '<span style="color:var(--cyan, #1FBDEA);font-family:Poiret One,sans-serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;">FILE DETAILS</span>' +
            '<button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:var(--gold, #D4AF37);font-size:20px;cursor:pointer;">◇</button>' +
        '</div>' +
        '<div style="margin-bottom:12px;">' +
            '<div style="color:' + statusCol + ';font-family:Poiret One,sans-serif;font-size:18px;margin-bottom:4px;">' + _escapeHtml(node.name) + '</div>' +
            '<div style="color:var(--text, #E0E0E0);opacity:0.6;font-size:11px;word-break:break-all;">' + _escapeHtml(node.id) + '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:8px;text-align:center;">' +
                '<div style="color:var(--text, #E0E0E0);font-size:18px;font-family:Poiret One,sans-serif;">' + node.reachabilityScore + '</div>' +
                '<div style="color:var(--text, #E0E0E0);opacity:0.5;font-size:10px;letter-spacing:1px;">REACHABILITY</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:8px;text-align:center;">' +
                '<div style="color:var(--text, #E0E0E0);font-size:18px;font-family:Poiret One,sans-serif;">' + node.impactRadius + '</div>' +
                '<div style="color:var(--text, #E0E0E0);opacity:0.5;font-size:10px;letter-spacing:1px;">IMPACT RADIUS</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:8px;text-align:center;">' +
                '<div style="color:var(--text, #E0E0E0);font-size:18px;font-family:Poiret One,sans-serif;">' + importCount + '</div>' +
                '<div style="color:var(--text, #E0E0E0);opacity:0.5;font-size:10px;letter-spacing:1px;">IMPORTS</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:8px;text-align:center;">' +
                '<div style="color:var(--text, #E0E0E0);font-size:18px;font-family:Poiret One,sans-serif;">' + importedByCount + '</div>' +
                '<div style="color:var(--text, #E0E0E0);opacity:0.5;font-size:10px;letter-spacing:1px;">IMPORTED BY</div>' +
            '</div>' +
        '</div>' +
        '<div style="text-align:center;">' +
            '<span style="display:inline-block;padding:3px 12px;border:1px solid ' + statusCol + ';color:' + statusCol + ';border-radius:3px;font-family:Poiret One,sans-serif;font-size:11px;letter-spacing:2px;">' +
                node.status +
            '</span>' +
        '</div>';

    document.body.appendChild(details);

    // Close on overlay click
    var overlay = document.createElement('div');
    overlay.id = 'graph-node-details-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:105;';
    overlay.onclick = function() {
        overlay.remove();
        details.remove();
    };
    document.body.insertBefore(overlay, details);
}

function _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ─── GRAPH POPUP ─────────────────────────────────────────────

function showGraphPopup(manifest) {
    // Capture the element that opened the popup so we can return focus
    // when it closes (a11y — standard modal pattern). May be null in
    // programmatic flows; that's fine, focus simply stays where the
    // browser puts it after teardown.
    var opener = (typeof document !== 'undefined' && document.activeElement) || null;

    // Create overlay. Wave 5I (ticket FRONT-005): added ARIA dialog
    // semantics, Escape-to-close, focus trap, initial focus, and
    // return-focus-on-close. The popup now matches the convention
    // .panel-overlay uses for the PRD wizard.
    var overlay = document.createElement('div');
    overlay.className = 'graph-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Connection graph');
    overlay.innerHTML = '<div class="graph-popup">' +
        '<div class="graph-popup-header">' +
            '<span class="graph-popup-title" id="graph-popup-title">CONNECTION GRAPH</span>' +
            '<button class="graph-popup-close" data-graph-popup-close="1" aria-label="Close connection graph">◇</button>' +
        '</div>' +
        '<div class="graph-popup-body" id="graph-popup-body"></div>' +
        '<div class="graph-popup-footer">' +
            '<div class="graph-popup-filters">' +
                '<button class="graph-popup-btn graph-filter-btn active" data-filter="ALL">ALL</button>' +
                '<button class="graph-popup-btn graph-filter-btn" data-filter="GREEN" style="border-color:#D4AF37;color:#D4AF37;">GREEN</button>' +
                '<button class="graph-popup-btn graph-filter-btn" data-filter="YELLOW" style="border-color:#1FBDEA;color:#1FBDEA;">YELLOW</button>' +
                '<button class="graph-popup-btn graph-filter-btn" data-filter="RED" style="border-color:#C9748F;color:#C9748F;">RED</button>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
                '<span class="graph-popup-info">' + (manifest.files ? manifest.files.length : 0) + ' files</span>' +
                '<button class="graph-popup-btn" data-graph-popup-resetzoom="1">RESET ZOOM</button>' +
            '</div>' +
        '</div>' +
    '</div>';

    overlay.setAttribute('aria-labelledby', 'graph-popup-title');
    document.body.appendChild(overlay);

    // ─── A11Y: close handler ──────────────────────────────────
    // Single close function — used by Escape key, close button, and
    // any future programmatic dismissal. Removes the keydown listener
    // and restores focus to the opener.
    var closed = false;
    function closeGraphPopup() {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKeyDown, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (opener && typeof opener.focus === 'function') {
            try { opener.focus(); } catch (e) { /* opener may have detached */ }
        }
    }

    // Wire the close diamond. Replaces the previous inline
    // onclick="this.closest('.graph-popup-overlay').remove()" which
    // skipped the focus-return + keydown-cleanup steps.
    var closeBtn = overlay.querySelector('[data-graph-popup-close]');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeGraphPopup);
    }

    // Wire reset-zoom button via addEventListener (was inline onclick).
    var resetBtn = overlay.querySelector('[data-graph-popup-resetzoom]');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            window.St8GraphVisualizer.resetZoom();
        });
    }

    // ─── A11Y: focus trap + Escape ────────────────────────────
    // Uses a single keydown listener registered on `document` in
    // capture phase. Tab/Shift+Tab cycle through focusable elements
    // INSIDE the overlay; Escape closes. Other keys propagate.
    function getFocusable() {
        var nodes = overlay.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]),' +
            ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        var arr = [];
        for (var i = 0; i < nodes.length; i++) {
            // Skip hidden elements (best-effort — offsetParent is null
            // when display:none, which covers our cases).
            if (nodes[i].offsetParent !== null || nodes[i] === document.activeElement) {
                arr.push(nodes[i]);
            }
        }
        return arr;
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            e.stopPropagation();
            closeGraphPopup();
            return;
        }
        if (e.key !== 'Tab') return;

        var focusable = getFocusable();
        if (focusable.length === 0) {
            // Nothing to trap to — prevent focus from leaving by
            // refocusing the overlay container.
            e.preventDefault();
            overlay.focus();
            return;
        }

        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        var active = document.activeElement;

        if (e.shiftKey) {
            if (active === first || !overlay.contains(active)) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (active === last || !overlay.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        }
    }
    document.addEventListener('keydown', onKeyDown, true);

    // ─── A11Y: initial focus ──────────────────────────────────
    // Focus the first focusable element (the close button) so the
    // keyboard user lands inside the dialog immediately.
    if (closeBtn && typeof closeBtn.focus === 'function') {
        try { closeBtn.focus(); } catch (e) { /* JSDOM-style edge cases */ }
    }

    // Make overlay focusable as a fallback target for the focus trap
    // when no focusable children exist.
    if (!overlay.hasAttribute('tabindex')) {
        overlay.setAttribute('tabindex', '-1');
    }

    // Expose closer for tests / programmatic dismissal.
    overlay.__st8Close = closeGraphPopup;
    
    // Initialize graph
    var container = document.getElementById('graph-popup-body');
    var visualizer = new GraphVisualizer(container, {
        width: 800,
        height: 500,
        onNodeClick: function(node) {
            _showNodeDetails(node);
        }
    });
    
    visualizer.initialize().then(function() {
        visualizer.setData(manifest);
        visualizer.render();
        
        // Store reference for reset zoom
        window.St8GraphVisualizer._currentVisualizer = visualizer;
    });

    // Wire filter buttons
    overlay.querySelector('.graph-popup-footer').addEventListener('click', function(e) {
        var btn = e.target.closest('.graph-filter-btn');
        if (!btn) return;
        
        var filter = btn.getAttribute('data-filter');
        
        // Update active button
        overlay.querySelectorAll('.graph-filter-btn').forEach(function(b) {
            b.classList.remove('active');
        });
        btn.classList.add('active');
        
        // Apply filter
        if (window.St8GraphVisualizer._currentVisualizer) {
            var viz = window.St8GraphVisualizer._currentVisualizer;
            var g = viz.svg.select('g');
            
            if (filter === 'ALL') {
                g.selectAll('.nodes circle').style('opacity', 1);
                g.selectAll('.labels text').style('opacity', 1);
                g.selectAll('.links line').style('opacity', 0.6);
            } else {
                g.selectAll('.nodes circle').style('opacity', function(d) {
                    return d.status === filter ? 1 : 0.1;
                });
                g.selectAll('.labels text').style('opacity', function(d) {
                    return d.status === filter ? 1 : 0.1;
                });
                g.selectAll('.links line').style('opacity', function(d) {
                    var sourceStatus = typeof d.source === 'object' ? d.source.status : null;
                    var targetStatus = typeof d.target === 'object' ? d.target.status : null;
                    return (sourceStatus === filter || targetStatus === filter) ? 0.6 : 0.05;
                });
            }
        }
    });
}

// ─── PUBLIC API ───────────────────────────────────────────────

window.St8GraphVisualizer = {
    showGraphPopup: showGraphPopup,
    resetZoom: function() {
        if (window.St8GraphVisualizer._currentVisualizer) {
            var viz = window.St8GraphVisualizer._currentVisualizer;
            if (viz.zoom && viz.svg) {
                viz.svg.transition().duration(500).call(
                    viz.zoom.transform,
                    d3.zoomIdentity
                );
            }
        }
    },
    _currentVisualizer: null
};
