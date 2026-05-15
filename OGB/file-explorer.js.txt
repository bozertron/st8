/* ═══════════════════════════════════════════════════════════════
   VOID FILE EXPLORER — actu8 Edition
   ═══════════════════════════════════════════════════════════════

   Ported from maestro/file-explorer.js with enhancements:
   - WebSocket via EPO Bus (no REST fetch)
   - Dynamic workspace path (no hardcodes)
   - Error display with retry (not silent)
   - Virtual scrolling for large directories
   - Hidden files toggle (persisted)

   Public API: window.VoidFileExplorer
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── STATE ────────────────────────────────────────────────────

const explorerState = {
    currentPath: '~',
    entries: [],               // raw entries from server
    filteredEntries: [],       // after hidden-files filter
    isLoading: false,
    error: null,               // { message: string } | null
    selectedPaths: new Set(),
    activeLocation: 'HOME',
    onSelect: null,            // callback: fn(paths[])
    showHidden: true,         // hidden files always shown (single-user tool)
    workspaceType: 'logic-analyzer', // default to Logic Analyzer
    indexedFingerprints: null, // populated after indexing
};

// ─── CONFIG ───────────────────────────────────────────────────

const VIRTUAL_SCROLL_THRESHOLD = 100;  // entries before virtual scroll kicks in
const ROW_HEIGHT = 32;                 // px per table row
const VIRTUAL_BUFFER = 20;             // rows above/below viewport

// Hidden files are always shown (single-user tool, no toggle)

// ─── DYNAMIC LOCATIONS ────────────────────────────────────────

function _getWorkspacePath() {
    // Try reading from actu8 config if exposed
    if (window.actu8Config && window.actu8Config.workspace) {
        return window.actu8Config.workspace;
    }
    // Fallback: use home dir (tilde) as default
    return '~';
}

function _buildLocations() {
    const wsPath = _getWorkspacePath();
    return [
        { name: 'HOME',      icon: '◇', path: '~' },
        { name: 'DOCUMENTS', icon: '◇', path: '~/Documents' },
        { name: 'DOWNLOADS', icon: '◇', path: '~/Downloads' },
        { name: 'WORKSPACE', icon: '◈', path: null, isWorkspacePicker: true },
    ];
}

let LOCATIONS = _buildLocations();

// ─── HELPERS ──────────────────────────────────────────────────

function _getBreadcrumbs(path) {
    if (!path || path === '~') return [{ name: '~', path: '~' }];
    // Expand tilde to home — try config, fall back to /home/$USER
    const home = (window.actu8Config && window.actu8Config.homeDir) || '~';
    const expanded = path.replace(/^~/, home);
    const parts = expanded.split('/').filter(Boolean);
    const crumbs = [];
    let acc = '';
    parts.forEach(part => {
        acc = acc ? `${acc}/${part}` : `/${part}`;
        crumbs.push({ name: part, path: acc });
    });
    return crumbs;
}

function _getIcon(entry) {
    if (entry.isDirectory) return '📁';
    const ext = entry.name.split('.').pop()?.toLowerCase();
    const icons = {
        md: '📄', txt: '📄',
        js: '📜', ts: '📜', py: '📜', vue: '📜', rs: '📜',
        png: '🖼', jpg: '🖼', svg: '🖼', webp: '🖼',
        json: '{}', toml: '⚙', yaml: '⚙', yml: '⚙',
        css: '🎨', html: '🌐',
    };
    return icons[ext] || '◇';
}

function _formatSize(bytes) {
    if (bytes == null) return '—';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function _formatDate(date) {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}



function _filterEntries(entries) {
    return entries;
}

// ─── FILE SYSTEM (WebSocket) ─────────────────────────────────

async function explorerNavigate(path) {
    explorerState.selectedPaths.clear();
    explorerState.currentPath = path;
    explorerState.isLoading = true;
    explorerState.error = null;
    _renderExplorer();

    let entries = null;
    let fetchError = null;

    try {
        entries = await _fetchViaWebSocket(path);
    } catch (err) {
        fetchError = err;
        explorerState.error = {
            message: 'Unable to load directory — ' + (err.message || 'Unknown error'),
            canRetry: true,
        };
    }

    if (entries !== null) {
        explorerState.entries = entries;
        explorerState.filteredEntries = _filterEntries(entries);
    }

    explorerState.isLoading = false;
    _renderExplorer();
}

async function _fetchViaWebSocket(path) {
    // Try EPO first (if available)
    if (window.epoClient && window.epoClient.connected) {
        try {
            const res = await window.epoClient.request('file_list', { path });
            if (!res.error) return res.entries || res;
        } catch (err) {
            console.warn('[st8] EPO failed, falling back to REST:', err.message);
        }
    }

    // REST fallback
    const response = await fetch('/api/files?path=' + encodeURIComponent(path));
    if (!response.ok) {
        throw new Error('Failed to fetch directory: ' + response.status);
    }
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.entries || [];
}

function _isNetworkError(err) {
    const msg = (err.message || '').toLowerCase();
    return msg.includes('not connected')
        || msg.includes('network')
        || msg.includes('timeout')
        || msg.includes('failed to fetch')
        || msg.includes('econnrefused');
}

// ─── HIDDEN FILES TOGGLE ─────────────────────────────────────

function _toggleHidden() {
    explorerState.showHidden = !explorerState.showHidden;
    try {
        localStorage.setItem(LS_SHOW_HIDDEN, String(explorerState.showHidden));
    } catch (e) { /* ignore */ }
    explorerState.filteredEntries = _filterEntries(explorerState.entries);
    _renderExplorer();
}

// ─── INTERACTION ──────────────────────────────────────────────

function _handleRowClick(e, path, isDirectory) {
    if (e.ctrlKey || e.metaKey) {
        if (explorerState.selectedPaths.has(path)) {
            explorerState.selectedPaths.delete(path);
        } else {
            explorerState.selectedPaths.add(path);
        }
    } else {
        explorerState.selectedPaths.clear();
        explorerState.selectedPaths.add(path);
    }
    _updateSelectionUI();
}

function _handleRowDblClick(path, isDirectory) {
    if (isDirectory) {
        explorerNavigate(path);
    } else {
        _emitSelect();
    }
}

function _emitSelect() {
    const paths = Array.from(explorerState.selectedPaths);
    if (paths.length === 0) return;
    if (explorerState.onSelect) {
        explorerState.onSelect(paths);
    } else {
        // Default: inject into actu8 chat input
        const input = document.getElementById('input');
        if (input) {
            input.value = paths.join(', ');
            input.focus();
        }
    }
    explorerState.selectedPaths.clear();
    _updateSelectionUI();
}

function _updateSelectionUI() {
    // Update row highlight classes
    document.querySelectorAll('.explorer-file-row').forEach(row => {
        const path = row.dataset.path;
        row.classList.toggle('selected', explorerState.selectedPaths.has(path));
    });
    // Update footer count
    const info = document.getElementById('explorer-selection-info');
    const addBtn = document.getElementById('explorer-add-btn');
    const count = explorerState.selectedPaths.size;
    if (info) info.textContent = count > 0 ? `${count} ITEM${count > 1 ? 'S' : ''} SELECTED` : '';
    if (addBtn) addBtn.disabled = count === 0;
}

// ─── VIRTUAL SCROLL STATE ─────────────────────────────────────

const _virtualScroll = {
    scrollTop: 0,
    viewportHeight: 0,
    useVirtual: false,
};

function _onVirtualScroll() {
    const container = document.getElementById('explorer-vscroll');
    if (!container) return;
    _virtualScroll.scrollTop = container.scrollTop;
    _virtualScroll.viewportHeight = container.clientHeight;
    _renderVirtualRows();
}

// ─── RENDER ───────────────────────────────────────────────────

function _renderExplorer() {
    const container = document.getElementById('explorer-root');
    if (!container) return;

    const crumbs = _getBreadcrumbs(explorerState.currentPath);
    const entries = explorerState.filteredEntries;
    const hiddenCount = explorerState.entries.length - entries.length;
    const totalEntries = explorerState.entries.length;
    _virtualScroll.useVirtual = totalEntries > VIRTUAL_SCROLL_THRESHOLD;

    container.innerHTML = `
        <div class="explorer-layout">
            <!-- Sidebar -->
            <aside class="explorer-sidebar">
                <nav class="explorer-nav">
                    ${LOCATIONS.map(loc => {
                        if (loc.isWorkspacePicker) {
                            const isActive = explorerState.activeLocation === 'WORKSPACE';
                            return '<button class="explorer-nav-item' + (isActive ? ' active' : '') + '" onclick="window.VoidFileExplorer._showWorkspacePicker()">' +
                                '<span class="explorer-nav-icon">' + loc.icon + '</span>' +
                                '<span class="explorer-nav-label">' + loc.name + '</span>' +
                                '</button>';
                        }
                        return '<button class="explorer-nav-item' + (explorerState.activeLocation === loc.name ? ' active' : '') + '" onclick="window.VoidFileExplorer._navTo(\'' + loc.name + '\', \'' + escapeHtml(loc.path) + '\')">' +
                            '<span class="explorer-nav-icon">' + loc.icon + '</span>' +
                            '<span class="explorer-nav-label">' + loc.name + '</span>' +
                            '</button>';
                    }).join('')}
                </nav>
            </aside>

            <!-- Main -->
            <main class="explorer-main">
                <!-- Breadcrumbs -->
                <header class="explorer-header">
                    <div class="explorer-breadcrumbs">
                        <button class="crumb-btn" onclick="window.VoidFileExplorer.navigate('~')">/</button>
                        ${crumbs.map((crumb, i) => `
                            <span class="crumb-sep">›</span>
                            <button
                                class="crumb-btn ${i === crumbs.length - 1 ? 'crumb-btn--last' : ''}"
                                onclick="window.VoidFileExplorer.navigate('${escapeHtml(crumb.path)}')"
                            >${escapeHtml(crumb.name)}</button>
                        `).join('')}
                    </div>
                </header>

                <!-- Error banner -->
                ${explorerState.error ? `
                    <div class="explorer-error-banner">
                        <span class="explorer-error-icon">⚠</span>
                        <span class="explorer-error-msg">${escapeHtml(explorerState.error.message)}</span>
                        ${explorerState.error.canRetry ? `
                            <button class="explorer-retry-btn" onclick="window.VoidFileExplorer._retry()">RETRY</button>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Content -->
                <div class="explorer-content">
                    ${explorerState.isLoading ? `
                        <div class="explorer-state-msg">
                            <span class="explorer-spin">◇</span>
                            <p>ACCESSING VOID...</p>
                        </div>
                    ` : entries.length === 0 ? `
                        <div class="explorer-state-msg">
                            <span>◇</span>
                            <p>${explorerState.error ? 'NO DATA AVAILABLE' : 'DIRECTORY IS EMPTY'}</p>
                        </div>
                    ` : _virtualScroll.useVirtual
                        ? _renderVirtualTable(entries)
                        : _renderStandardTable(entries)
                    }
                </div>

                <!-- Footer -->
                <footer class="explorer-footer">
                    <span class="explorer-footer-info">
                        ${entries.length} item${entries.length !== 1 ? 's' : ''}
                    </span>
                    <span class="explorer-selection-info" id="explorer-selection-info"></span>
                    <button
                        class="explorer-verify-btn"
                        id="explorer-verify-btn"
                        style="display:none"
                        onclick="window.VoidFileExplorer._verifyCodebase()"
                    >VERIFY</button>
                    <button
                        class="explorer-index-btn"
                        id="explorer-index-btn"
                        onclick="window.VoidFileExplorer._indexCodebase()"
                    >INDEX</button>
                    <button
                        class="explorer-add-btn"
                        id="explorer-add-btn"
                        disabled
                        onclick="window.VoidFileExplorer._emitSelect()"
                    >ADD TO CHAT</button>
                    <button
                        class="explorer-prd-btn"
                        id="explorer-prd-btn"
                        onclick="window.openPRDWizard()"
                    >CREATE PRD</button>
                </footer>
            </main>
        </div>
    `;

    // Attach virtual scroll listener and do initial render
    if (_virtualScroll.useVirtual && !explorerState.isLoading) {
        const vscroll = document.getElementById('explorer-vscroll');
        if (vscroll) {
            _virtualScroll.viewportHeight = vscroll.clientHeight;
            vscroll.addEventListener('scroll', _onVirtualScroll);
            _renderVirtualRows();  // paint first visible batch immediately
        }
    }
}

// ─── STANDARD TABLE (≤100 entries) ───────────────────────────

function _renderStandardTable(entries) {
    return `
        <table class="explorer-table">
            <thead>
                <tr>
                    <th>NAME</th>
                    <th>SIZE</th>
                    <th>MODIFIED</th>
                    <th>Purpose</th>
                </tr>
            </thead>
            <tbody>
                ${entries.map(entry => _renderRow(entry)).join('')}
            </tbody>
        </table>
    `;
}

// ─── VIRTUAL TABLE (>100 entries) ────────────────────────────

function _renderVirtualTable(entries) {
    const totalHeight = entries.length * ROW_HEIGHT;
    return `
        <div class="explorer-vscroll-container" id="explorer-vscroll">
            <table class="explorer-table explorer-table--virtual">
                <thead>
                    <tr>
                        <th>NAME</th>
                        <th>SIZE</th>
                        <th>MODIFIED</th>
                        <th>Purpose</th>
                    </tr>
                </thead>
            </table>
            <div class="explorer-vscroll-spacer" style="height:${totalHeight}px;">
                <div class="explorer-vscroll-content" id="explorer-vscroll-content">
                    <!-- rows injected by _renderVirtualRows() -->
                </div>
            </div>
        </div>
    `;
}

function _renderVirtualRows() {
    const entries = explorerState.filteredEntries;
    const container = document.getElementById('explorer-vscroll-content');
    if (!container) return;

    const scrollTop = _virtualScroll.scrollTop;
    const viewportH = _virtualScroll.viewportHeight || 400;

    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIRTUAL_BUFFER);
    const endIdx = Math.min(entries.length, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + VIRTUAL_BUFFER);

    const offsetY = startIdx * ROW_HEIGHT;
    let html = `<div style="height:${offsetY}px;"></div>`;
    html += '<table class="explorer-table explorer-table--body"><tbody>';
    for (let i = startIdx; i < endIdx; i++) {
        html += _renderRow(entries[i]);
    }
    html += '</tbody></table>';

    container.innerHTML = html;
}

// ─── ROW RENDERER (shared) ───────────────────────────────────

function _renderRow(entry) {
    const isSelected = explorerState.selectedPaths.has(entry.path);
    return `
        <tr
            class="explorer-file-row ${isSelected ? 'selected' : ''}"
            data-path="${escapeHtml(entry.path)}"
            data-is-dir="${entry.isDirectory}"
            onclick="window.VoidFileExplorer._rowClick(event, '${escapeHtml(entry.path)}', ${entry.isDirectory})"
            ondblclick="window.VoidFileExplorer._rowDblClick('${escapeHtml(entry.path)}', ${entry.isDirectory})"
        >
            <td class="explorer-col-name">
                <span class="explorer-file-icon">${_getIcon(entry)}</span>
                <span class="explorer-file-name">${escapeHtml(entry.name)}</span>
            </td>
            <td class="explorer-col-meta">${_formatSize(entry.size)}</td>
            <td class="explorer-col-meta">${_formatDate(entry.modifiedAt)}</td>
            <td class="explorer-col-purpose">${entry.intent && entry.intent.purpose ? escapeHtml(entry.intent.purpose) : ''}${entry.needsAIReview ? ' <span class="badge-ai-review">@@@</span>' : ''}</td>
        </tr>
    `;
}

// ─── STYLES ───────────────────────────────────────────────────

function _injectExplorerStyles() {
    if (document.getElementById('explorer-dynamic-styles')) return;
    const style = document.createElement('style');
    style.id = 'explorer-dynamic-styles';
    style.textContent = `
.explorer-col-purpose {
  color: var(--cyan);
  font-size: 12px;
  font-style: italic;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge-ai-review {
  background: var(--gold);
  color: var(--void);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: bold;
  margin-left: 4px;
}
.explorer-prd-btn {
  background: transparent;
  border: 1px solid var(--gold) !important;
  color: var(--gold);
  padding: 5px 14px;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 3px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}
.explorer-prd-btn:hover {
  background: var(--gold);
  color: var(--void);
}
    `;
    document.head.appendChild(style);
}

// ─── MOUNT ────────────────────────────────────────────────────

function explorerMount(panelBodyEl, onSelect) {
    _injectExplorerStyles();
    explorerState.onSelect = onSelect || null;

    // Refresh locations in case config was set after load
    LOCATIONS = _buildLocations();

    panelBodyEl.innerHTML = '<div id="explorer-root" class="explorer-root"></div>';
    explorerNavigate('~');
}

// ─── RETRY ────────────────────────────────────────────────────

function _retry() {
    explorerNavigate(explorerState.currentPath);
}

// ─── WORKSPACE TYPE SWITCHING ─────────────────────────────────

function _showWorkspacePicker() {
    explorerState.activeLocation = 'WORKSPACE';
    
    // Show workspace options in the main content area
    const container = document.getElementById('explorer-root');
    if (!container) return;
    
    const workspaces = [
        { id: 'logic-analyzer', name: 'Full Stack Logic Analyzer', icon: '◈', description: 'Codebase connection analysis and debugging' },
        { id: 'standard', name: 'Standard', icon: '◇', description: 'Default workspace with text drift surface' },
        { id: 'pretext-dev', name: 'Pretext Dev', icon: '◇', description: 'Development environment for pretext engine' }
    ];
    
    let html = '<div class="explorer-layout">' +
        '<aside class="explorer-sidebar">' +
            '<nav class="explorer-nav">' +
                LOCATIONS.map(loc => {
                    if (loc.isWorkspacePicker) {
                        return '<button class="explorer-nav-item active">' +
                            '<span class="explorer-nav-icon">' + loc.icon + '</span>' +
                            '<span class="explorer-nav-label">' + loc.name + '</span>' +
                            '</button>';
                    }
                    return '<button class="explorer-nav-item" onclick="window.VoidFileExplorer._navTo(\'' + loc.name + '\', \'' + escapeHtml(loc.path) + '\')">' +
                        '<span class="explorer-nav-icon">' + loc.icon + '</span>' +
                        '<span class="explorer-nav-label">' + loc.name + '</span>' +
                        '</button>';
                }).join('') +
            '</nav>' +
        '</aside>' +
        '<main class="explorer-main">' +
            '<header class="explorer-header">' +
                '<div class="explorer-breadcrumbs">' +
                    '<button class="crumb-btn crumb-btn--last">WORKSPACE</button>' +
                '</div>' +
            '</header>' +
            '<div class="explorer-content">' +
                '<div class="workspace-picker">' +
                    '<div class="workspace-picker-title">SELECT WORKSPACE</div>' +
                    workspaces.map(ws => {
                        const isActive = explorerState.workspaceType === ws.id;
                        return '<div class="workspace-option' + (isActive ? ' active' : '') + '" onclick="window.VoidFileExplorer._selectWorkspace(\'' + ws.id + '\')">' +
                            '<div class="workspace-option-icon">' + (isActive ? '◈' : '◇') + '</div>' +
                            '<div class="workspace-option-info">' +
                                '<div class="workspace-option-name">' + ws.name + '</div>' +
                                '<div class="workspace-option-desc">' + ws.description + '</div>' +
                            '</div>' +
                            (isActive ? '<div class="workspace-option-badge">ACTIVE</div>' : '') +
                        '</div>';
                    }).join('') +
                '</div>' +
            '</div>' +
        '</main>' +
    '</div>';
    
    container.innerHTML = html;
}

function _selectWorkspace(wsType) {
    explorerState.workspaceType = wsType;
    explorerState.activeLocation = 'HOME';
    
    // Notify the UI about workspace change
    if (window.st8WorkspaceChanged) {
        window.st8WorkspaceChanged(wsType);
    }
    
    // Return to HOME
    explorerNavigate('~');
}

function _setWorkspaceType(wsType) {
    explorerState.workspaceType = wsType;
    explorerState.activeLocation = 'HOME';
    
    // Notify the UI about workspace change
    if (window.st8WorkspaceChanged) {
        window.st8WorkspaceChanged(wsType);
    }
    
    // Return to HOME
    explorerNavigate('~');
}

// ─── INDEX CODEBASE ──────────────────────────────────────────

async function _indexCodebase() {
    const indexBtn = document.getElementById('explorer-index-btn');
    if (!indexBtn) return;
    
    // Get current path
    const targetPath = explorerState.currentPath;
    if (!targetPath || targetPath === '~') {
        console.warn('[st8] Cannot index home directory');
        return;
    }
    
    // Update button state
    indexBtn.classList.add('indexing');
    indexBtn.textContent = 'INDEXING...';
    indexBtn.disabled = true;
    
    try {
        const response = await fetch('/api/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath })
        });
        
        const result = await response.json();
        
        if (!response.ok || result.error) {
            throw new Error(result.error || 'Indexing failed');
        }
        
        console.info('[st8] Indexed:', result.files, 'files');
        
        // Show Verify button only on success
        const verifyBtn = document.getElementById('explorer-verify-btn');
        if (verifyBtn) {
            verifyBtn.style.display = '';
        }
        
        // Notify UI only on success
        if (window.st8IndexingComplete) {
            window.st8IndexingComplete(targetPath);
        }
    } catch (err) {
        console.error('[st8] Indexing failed:', err);
    } finally {
        // Restore button state
        indexBtn.classList.remove('indexing');
        indexBtn.textContent = 'INDEX';
        indexBtn.disabled = false;
    }
}

// ─── VERIFY CODEBASE ─────────────────────────────────────────

async function _verifyCodebase() {
    const verifyBtn = document.getElementById('explorer-verify-btn');
    if (!verifyBtn) return;
    
    // Get current path
    const targetPath = explorerState.currentPath;
    if (!targetPath || targetPath === '~') {
        console.warn('[st8] Cannot verify home directory');
        return;
    }
    
    // Update button state
    verifyBtn.classList.add('verifying');
    verifyBtn.textContent = 'VERIFYING...';
    verifyBtn.disabled = true;
    
    try {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath })
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Verification failed');
        }

        // Show verification results
        const { summary, issues } = result;
        const hasCriticalIssues = issues.some(i => i.severity === 'CRITICAL');

        if (hasCriticalIssues || summary.missing > 0) {
            console.warn('[st8] Verification issues:', summary);
            console.table(issues);
        } else {
            console.info('[st8] Verification passed:', summary);
        }
    } catch (err) {
        console.error('[st8] Verification failed:', err);
    } finally {
        // Restore button state
        verifyBtn.classList.remove('verifying');
        verifyBtn.textContent = 'VERIFY';
        verifyBtn.disabled = false;
    }
}

// ─── PUBLIC API ───────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.VoidFileExplorer = {
        mount: explorerMount,
        navigate: explorerNavigate,
        _navTo: (name, path) => {
            explorerState.activeLocation = name;
            if (path) explorerNavigate(path);
        },
        _showWorkspacePicker: _showWorkspacePicker,
        _selectWorkspace: _selectWorkspace,
        _setWorkspaceType: _setWorkspaceType,
        _indexCodebase: _indexCodebase,
        _verifyCodebase: _verifyCodebase,
        _rowClick: _handleRowClick,
        _rowDblClick: _handleRowDblClick,
        _emitSelect: _emitSelect,
        _toggleHidden: _toggleHidden,
        _retry: _retry,
        getWorkspaceType: () => explorerState.workspaceType,
        getIndexedFingerprints: () => explorerState.indexedFingerprints,
        setIndexedFingerprints: (fp) => { explorerState.indexedFingerprints = fp; },
    };
}
