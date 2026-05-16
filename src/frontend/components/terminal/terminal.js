/* ═══════════════════════════════════════════════════════════════
   PHREAK> TERMINAL — actu8 Enhanced Edition
   ═══════════════════════════════════════════════════════════════

   Enhanced from orchestr8_next/maestro/phreak-terminal.js

   New features over original:
   - Append-only streaming (no full innerHTML re-render)
   - Event delegation (CSP-safe, no inline onclick)
   - TUI toggle (full-screen overlay mode, Escape to return)
   - Signal framework (receiveSignal, provisioned pop-ups)
   - Phone icon (vintage SVG handset, off-hook toggle)

   Kept from original:
   - bozertron@orchestr8:~$ prompt
   - Command history (↑↓ arrow keys)
   - stdout / stderr / system / input line types
   - Copy-to-chat mechanism
   - Simulation fallback
   - No ANSI/color support
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── STATE ────────────────────────────────────────────────────

/* ─── PHONE METAPHOR (Wave 5H ticket 16) ────────────────────────
   The "phone" is a whimsical phone-phreaking metaphor for the
   terminal's signal-suppression toggle. It exposes a single
   user-controllable bit (`phoneOffHook`) that gates whether
   inbound signal pop-ups render inside the terminal panel.

   Signal flow:
     (a) Persisted on `phreakState.phoneOffHook` (boolean, default false).
     (b) Toggled by `togglePhoneOffHook()` (data-action="phone-toggle"
         button in the terminal header, lifted into the column titlebar
         by src/frontend/app.js).
     (c) READ INTERNALLY by `_pushSignal()` (line ~397) — when off-hook
         the signal is recorded with `suppressed:true` and the pop-up
         is NOT rendered. ON-hook signals render the popup overlay.
     (d) READ EXTERNALLY by src/frontend/app.js (≈lines 137-146) via
         `PhreakTerminal.getPhoneState()` — used only to drive the
         status-line text ("PHONE OFF-HOOK — SIGNALS SUPPRESSED" vs
         "PHONE ON-HOOK — SIGNALS ACTIVE") and the .phone-on/.phone-off
         CSS class on the status element.

   In plain language: "phone off-hook" = signal pop-ups muted; "phone
   on-hook" = signal pop-ups active. The metaphor borrows from analog
   telephony where lifting the handset off the cradle prevented the
   bell from ringing on inbound calls. This is pure UI state — no
   backend round-trip, no persistence across reloads.

   Future direction (FRONT-007 in cluster roadmap): consider routing
   ALL SSE notifications through this state machine globally, so the
   single toggle controls every notification surface rather than only
   the terminal's signal pop-ups.
   ───────────────────────────────────────────────────────────── */

const phreakState = {
    lines: [],              // { id, type, content }
    history: [],            // command history
    historyIndex: -1,
    isExecuting: false,
    lineCounter: 0,
    onCopyLine: null,       // callback: fn(content)
    lastRenderedIndex: -1,  // tracks append-only render position
    isTUI: false,           // true when in full-screen TUI mode
    phoneOffHook: false,    // true when phone is "off the hook" — see PHONE METAPHOR block above
    signals: [],            // { id, type, data, provisioned, timestamp }
    signalCounter: 0,
    _epoUnlisten: null,     // cleanup fn for EPO listener
    _signalPopups: [],      // active signal popup elements
};

const PHREAK_API = '/api/v1/exec';

// ─── EXECUTION ────────────────────────────────────────────────

async function phreakExecute(cmd) {
    if (!cmd.trim()) return;

    // Push to history
    phreakState.history.push(cmd);
    phreakState.historyIndex = -1;

    // Echo input line
    phreakState.lines.push(_mkLine('input', cmd));
    phreakState.isExecuting = true;
    _renderLines();

    try {
        // Built-in media commands (routed via EPO bus to media_control)
        var handled = await _tryMediaCommand(cmd);
        if (handled) {
            phreakState.isExecuting = false;
            _renderLines();
            return;
        }

        // Use EPO WebSocket for exec (replaces dead /api/v1/exec REST)
        if (window.epoClient && window.epoClient.connected) {
            const data = await window.epoClient.request('exec', { command: cmd });
            const stdout = data.stdout || '';
            const stderr = data.stderr || '';

            if (stdout) {
                stdout.split('\n').forEach(function(line) {
                    if (line !== '') phreakState.lines.push(_mkLine('stdout', line));
                });
            }
            if (stderr) {
                stderr.split('\n').forEach(function(line) {
                    if (line !== '') phreakState.lines.push(_mkLine('stderr', line));
                });
            }
            if (!stdout && !stderr) {
                phreakState.lines.push(_mkLine('system', '[command completed]'));
            }
        } else {
            // Fallback to backend API when not connected to EPO
            try {
                const response = await fetch('/api/exec', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: cmd })
                });
                const data = await response.json();
                if (data.stdout) {
                    data.stdout.split('\n').forEach(function(line) {
                        if (line !== '') phreakState.lines.push(_mkLine('stdout', line));
                    });
                }
                if (data.stderr) {
                    data.stderr.split('\n').forEach(function(line) {
                        if (line !== '') phreakState.lines.push(_mkLine('stderr', line));
                    });
                }
                if (!data.stdout && !data.stderr) {
                    phreakState.lines.push(_mkLine('system', '[command completed]'));
                }
            } catch (fetchErr) {
                phreakState.lines.push(_mkLine('stderr', 'Backend not available: ' + fetchErr.message));
            }
        }
    } catch (err) {
        phreakState.lines.push(_mkLine('stderr', 'Error: ' + err.message));
    }

    phreakState.isExecuting = false;
    _renderLines();
}

// ─── MEDIA COMMANDS (via EPO bus → media_control) ─────────────

var MEDIA_COMMANDS = {
    'stream list':    { type: 'get_streams',  label: 'Streams' },
    'stream status':  { type: 'get_status',   label: 'Status' },
    'media health':   { type: 'get_health',   label: 'Health' },
    'media config':   { type: 'get_config',   label: 'Config' },
};

async function _tryMediaCommand(cmd) {
    var trimmed = cmd.trim().toLowerCase();

    // Check for exact media command matches
    var match = MEDIA_COMMANDS[trimmed];
    if (match) {
        if (!window.epoClient || !window.epoClient.connected) {
            phreakState.lines.push(_mkLine('stderr', 'Not connected to EPO bus'));
            return true;
        }
        try {
            var data = await window.epoClient.request(match.type, {});
            phreakState.lines.push(_mkLine('system', '── ' + match.label + ' ──'));
            var text = JSON.stringify(data, null, 2);
            text.split('\n').forEach(function(line) {
                phreakState.lines.push(_mkLine('stdout', line));
            });
        } catch (e) {
            phreakState.lines.push(_mkLine('stderr', match.label + ': ' + e.message));
        }
        return true;
    }

    // proxy add <url>
    if (trimmed.startsWith('proxy add ')) {
        var url = cmd.trim().substring(10).trim();
        if (!url) {
            phreakState.lines.push(_mkLine('stderr', 'Usage: proxy add <rtmp://...>'));
            return true;
        }
        if (!window.epoClient || !window.epoClient.connected) {
            phreakState.lines.push(_mkLine('stderr', 'Not connected to EPO bus'));
            return true;
        }
        try {
            await window.epoClient.request('start_proxy', { url: url });
            phreakState.lines.push(_mkLine('stdout', 'Proxy started: ' + url));
        } catch (e) {
            phreakState.lines.push(_mkLine('stderr', 'Proxy failed: ' + e.message));
        }
        return true;
    }

    // media help
    if (trimmed === 'media help' || trimmed === 'stream help' || trimmed === 'av help') {
        phreakState.lines.push(_mkLine('system', '── A/V Media Commands ──'));
        phreakState.lines.push(_mkLine('stdout', ''));
        phreakState.lines.push(_mkLine('stdout', '  Discovery'));
        phreakState.lines.push(_mkLine('stdout', '    stream list         Active streams (protocol, codec, viewers)'));
        phreakState.lines.push(_mkLine('stdout', '    stream status       Health, bitrate, buffer state'));
        phreakState.lines.push(_mkLine('stdout', '    media health        ZLMediaKit liveness check'));
        phreakState.lines.push(_mkLine('stdout', '    media config        Server configuration'));
        phreakState.lines.push(_mkLine('stdout', ''));
        phreakState.lines.push(_mkLine('stdout', '  Streaming'));
        phreakState.lines.push(_mkLine('stdout', '    proxy add <url>     Ingest stream (rtmp://, rtsp://)'));
        phreakState.lines.push(_mkLine('stdout', ''));
        phreakState.lines.push(_mkLine('stdout', '  Protocols'));
        phreakState.lines.push(_mkLine('stdout', '    RTMP  :1935    RTSP  :554     HLS   :80'));
        phreakState.lines.push(_mkLine('stdout', '    WebRTC (WHIP/WHEP)  SRT :10080'));
        phreakState.lines.push(_mkLine('stdout', '    WS-FLV (WebSocket binary frames)'));
        phreakState.lines.push(_mkLine('stdout', ''));
        phreakState.lines.push(_mkLine('stdout', '  Video Codecs (compiled)'));
        phreakState.lines.push(_mkLine('stdout', '    H.264       H.265/HEVC  AV1'));
        phreakState.lines.push(_mkLine('stdout', '    VP8         VP9         JPEG'));
        phreakState.lines.push(_mkLine('stdout', '    MPEG-2V'));
        phreakState.lines.push(_mkLine('stdout', ''));
        phreakState.lines.push(_mkLine('stdout', '  Audio Codecs (compiled)'));
        phreakState.lines.push(_mkLine('stdout', '    AAC         Opus        MP3'));
        phreakState.lines.push(_mkLine('stdout', '    G.711A      G.711U      L16/PCM'));
        phreakState.lines.push(_mkLine('stdout', '    MPEG-2A'));
        return true;
    }

    return false;
}

// ─── RENDER — APPEND-ONLY STREAMING ───────────────────────────

function _renderLines() {
    const output = document.getElementById('phreak-output');
    if (!output) return;

    // Append-only: only render lines we haven't seen yet
    const newLines = phreakState.lines.slice(phreakState.lastRenderedIndex + 1);
    if (newLines.length === 0 && phreakState.lastRenderedIndex >= 0) {
        // Nothing new — just update executing indicator
        _updateExecutingIndicator();
        return;
    }

    // Build HTML for new lines only
    const fragment = newLines.map(_buildLineHTML).join('');
    output.insertAdjacentHTML('beforeend', fragment);
    phreakState.lastRenderedIndex = phreakState.lines.length - 1;

    _updateExecutingIndicator();
    _scrollToBottom();
}

// Full re-render — used on clear, TUI toggle, and remount
function _fullRender() {
    const output = document.getElementById('phreak-output');
    if (!output) return;

    output.innerHTML = phreakState.lines.map(_buildLineHTML).join('');
    phreakState.lastRenderedIndex = phreakState.lines.length - 1;

    _updateExecutingIndicator();
    _scrollToBottom();
}

function _updateExecutingIndicator() {
    const inputLine = document.getElementById('phreak-input-line');
    const indicator = document.getElementById('phreak-executing');
    if (indicator) indicator.style.display = phreakState.isExecuting ? 'inline' : 'none';
    if (inputLine) inputLine.style.opacity = phreakState.isExecuting ? '0.5' : '1';
}

function _scrollToBottom() {
    const output = document.getElementById('phreak-output');
    if (output) output.scrollTop = output.scrollHeight;
}

function _mkLine(type, content) {
    return { id: ++phreakState.lineCounter, type, content };
}

// ─── HTML UTILITIES ───────────────────────────────────────────

function _escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _buildLineHTML(line) {
    const isInput = line.type === 'input';
    const isSystem = line.type === 'system';

    let html = `<div class="phreak-line phreak-line--${line.type}" data-line-id="${line.id}">`;
    html += '<div class="phreak-line-content">';
    if (isInput) {
        html += '<span class="phreak-prompt">bozertron@orchestr8:~$&nbsp;</span>';
    }
    html += `<span class="phreak-text">${_escapeHtml(line.content)}</span>`;
    html += '</div>';
    if (!isSystem) {
        html += '<button class="phreak-copy-btn" title="Copy to Chat" data-action="copy">◇</button>';
    }
    html += '</div>';
    return html;
}

// ─── INPUT HANDLING ───────────────────────────────────────────

function _handleInputKeydown(e) {
    const input = document.getElementById('phreak-cmd-input');
    if (!input) return;

    // Ctrl+T → toggle TUI mode
    if (e.key === 't' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleTUI();
        return;
    }

    // Escape in TUI mode → return to panel
    if (e.key === 'Escape' && phreakState.isTUI) {
        e.preventDefault();
        toggleTUI();
        return;
    }

    if (e.key === 'Enter') {
        const cmd = input.value;
        input.value = '';
        phreakExecute(cmd);
        return;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (phreakState.history.length === 0) return;
        if (phreakState.historyIndex === -1) {
            phreakState.historyIndex = phreakState.history.length - 1;
        } else if (phreakState.historyIndex > 0) {
            phreakState.historyIndex--;
        }
        input.value = phreakState.history[phreakState.historyIndex];
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (phreakState.historyIndex === -1) return;
        if (phreakState.historyIndex < phreakState.history.length - 1) {
            phreakState.historyIndex++;
            input.value = phreakState.history[phreakState.historyIndex];
        } else {
            phreakState.historyIndex = -1;
            input.value = '';
        }
        return;
    }
}

// Event delegation for copy buttons + signal dismiss — single listener on #phreak-output
function _handleOutputClick(e) {
    // Signal dismiss
    var dismissBtn = e.target.closest('[data-action="dismiss-signal"]');
    if (dismissBtn) {
        e.stopPropagation();
        var popup = dismissBtn.closest('.phreak-signal-popup');
        if (popup) _dismissSignalPopup(popup);
        return;
    }

    // Copy button
    var copyBtn = e.target.closest('.phreak-copy-btn');
    if (!copyBtn) return;

    e.stopPropagation();
    var lineEl = copyBtn.closest('.phreak-line');
    if (!lineEl) return;

    var lineId = parseInt(lineEl.getAttribute('data-line-id'), 10);
    if (!isNaN(lineId)) {
        phreakCopyLine(lineId);
    }
}

// ─── COPY-TO-CHAT ─────────────────────────────────────────────

function phreakCopyLine(lineId) {
    var line = phreakState.lines.find(function(l) { return l.id === lineId; });
    if (!line) return;
    if (phreakState.onCopyLine) {
        phreakState.onCopyLine(line.content);
    } else {
        // Fallback: copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(line.content).catch(function() {});
        }
    }
}

// ─── SIGNAL FRAMEWORK ─────────────────────────────────────────
//
// Signal shape:
// {
//   type: 'announcement' | 'message' | 'media' | 'system',
//   data: { title?, body?, source?, meta? },
//   provisioned: boolean   // only true → visual pop-up
// }

function receiveSignal(signal) {
    if (!signal || !signal.type) return;

    // If phone is off the hook, store but don't display
    var entry = {
        id: ++phreakState.signalCounter,
        type: signal.type,
        data: signal.data || {},
        provisioned: !!signal.provisioned,
        timestamp: Date.now(),
        suppressed: phreakState.phoneOffHook,
    };

    phreakState.signals.push(entry);

    // Log to terminal as system line
    var label = '[' + entry.type.toUpperCase() + ']';
    var desc = entry.data.title || entry.data.body || 'signal received';
    var status = entry.suppressed ? ' (suppressed — phone off-hook)' : '';
    phreakState.lines.push(_mkLine('system', label + ' ' + desc + status));
    _renderLines();

    // Only provisioned signals trigger visual pop-up (and phone must be on-hook)
    if (entry.provisioned && !entry.suppressed) {
        _showSignalPopup(entry);
    }
}

function _showSignalPopup(entry) {
    // Create a styled card popup in the terminal output area
    var output = document.getElementById('phreak-output');
    if (!output) return;

    var popup = document.createElement('div');
    popup.className = 'phreak-signal-popup phreak-signal--' + entry.type;
    popup.setAttribute('data-signal-id', entry.id);

    var typeIcons = {
        'announcement': '📡',
        'message': '📨',
        'media': '🎬',
        'system': '⚙',
    };
    var icon = typeIcons[entry.type] || '◇';
    var title = entry.data.title || entry.type;
    var body = entry.data.body || '';
    var source = entry.data.source || '';

    popup.innerHTML =
        '<div class="phreak-signal-header">' +
            '<span class="phreak-signal-icon">' + icon + '</span>' +
            '<span class="phreak-signal-title">' + _escapeHtml(title) + '</span>' +
            '<button class="phreak-signal-dismiss" data-action="dismiss-signal">✕</button>' +
        '</div>' +
        (body ? '<div class="phreak-signal-body">' + _escapeHtml(body) + '</div>' : '') +
        (source ? '<div class="phreak-signal-source">via ' + _escapeHtml(source) + '</div>' : '');

    output.appendChild(popup);
    _scrollToBottom();

    // Auto-dismiss after 8 seconds
    var timer = setTimeout(function() {
        if (popup.parentNode) {
            popup.classList.add('phreak-signal-fading');
            setTimeout(function() {
                if (popup.parentNode) popup.parentNode.removeChild(popup);
            }, 400);
        }
    }, 8000);

    // Track for cleanup
    phreakState._signalPopups.push({ el: popup, timer: timer });
}

function _dismissSignalPopup(el) {
    for (var i = phreakState._signalPopups.length - 1; i >= 0; i--) {
        if (phreakState._signalPopups[i].el === el) {
            clearTimeout(phreakState._signalPopups[i].timer);
            phreakState._signalPopups.splice(i, 1);
            break;
        }
    }
    if (el.parentNode) {
        el.classList.add('phreak-signal-fading');
        setTimeout(function() {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 400);
    }
}

// ─── TUI TOGGLE ───────────────────────────────────────────────

function toggleTUI() {
    if (phreakState.isTUI) {
        _exitTUI();
    } else {
        _enterTUI();
    }
}

function _enterTUI() {
    var container = document.getElementById('phreak-container');
    if (!container) return;

    phreakState.isTUI = true;

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'phreak-tui-overlay';
    overlay.className = 'phreak-tui-overlay';

    // Build TUI header with phone icon + toggle button
    overlay.innerHTML =
        '<div class="phreak-tui-header">' +
            '<span class="phreak-tui-title">phreak&gt; TUI</span>' +
            '<div class="phreak-tui-controls">' +
                _buildPhoneIconHTML() +
                '<button class="phreak-tui-toggle-btn" data-action="tui-toggle" title="Exit TUI (Esc)">✕</button>' +
            '</div>' +
        '</div>' +
        '<div class="phreak-tui-toolbar" id="phreak-tui-toolbar">' +
            '<div class="phreak-tui-btn-group">' +
                '<button class="phreak-tui-action-btn" data-action="isolate-green" title="Show GREEN files">GREEN<span class="phreak-badge" data-badge="green"></span></button>' +
                '<button class="phreak-tui-action-btn" data-action="isolate-yellow" title="Show YELLOW files">YELLOW<span class="phreak-badge" data-badge="yellow"></span></button>' +
                '<button class="phreak-tui-action-btn" data-action="isolate-red" title="Show RED files">RED<span class="phreak-badge" data-badge="red"></span></button>' +
                '<button class="phreak-tui-action-btn" data-action="show-all" title="Show all files">ALL<span class="phreak-badge" data-badge="all"></span></button>' +
                '<button class="phreak-tui-action-btn" data-action="show-graph" title="Show connection graph">GRAPH</button>' +
            '</div>' +
            '<div class="phreak-tui-btn-group">' +
                '<button class="phreak-tui-action-btn" data-action="clear-void" title="Clear void right panel">CLEAR VOID</button>' +
                '<button class="phreak-tui-action-btn" data-action="clear-phreak" title="Clear terminal">CLEAR PHREAK</button>' +
                '<button class="phreak-tui-action-btn" data-action="clear-all" title="Clear all">CLEAR ALL</button>' +
                '<button class="phreak-tui-action-btn" data-action="show-settings" title="Open settings">SETTINGS</button>' +
            '</div>' +
        '</div>' +
        '<div class="phreak-tui-body" id="phreak-tui-body">' +
            '<div class="phreak-output" id="phreak-output"></div>' +
            '<div class="phreak-input-row" id="phreak-input-line">' +
                '<span class="phreak-prompt">bozertron@orchestr8:~$&nbsp;</span>' +
                '<input id="phreak-cmd-input" type="text" class="phreak-cmd-input" ' +
                    'autocomplete="off" spellcheck="false" placeholder="" />' +
                '<span class="phreak-executing" id="phreak-executing" style="display:none">◇</span>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    // Re-attach input listener and focus
    _attachInputListener();
    _attachOutputClickListener();
    _fullRender();

    // Update phone icon state
    _updatePhoneIconState();

    // Update file count badges
    _updateTUIBadges();

    // Wire TUI header buttons
    overlay.addEventListener('click', function(e) {
        if (e.target.closest('[data-action="tui-toggle"]')) {
            toggleTUI();
        }
        if (e.target.closest('[data-action="phone-toggle"]')) {
            togglePhoneOffHook();
        }
        if (e.target.closest('[data-action="isolate-green"]')) {
            _isolateFiles('GREEN');
        }
        if (e.target.closest('[data-action="isolate-yellow"]')) {
            _isolateFiles('YELLOW');
        }
        if (e.target.closest('[data-action="isolate-red"]')) {
            _isolateFiles('RED');
        }
        if (e.target.closest('[data-action="show-all"]')) {
            _isolateFiles('ALL');
        }
        if (e.target.closest('[data-action="show-graph"]')) {
            _showGraph();
        }
        if (e.target.closest('[data-action="clear-void"]')) {
            _clearVoid();
        }
        if (e.target.closest('[data-action="clear-phreak"]')) {
            _clearPhreak();
        }
        if (e.target.closest('[data-action="clear-all"]')) {
            _clearAll();
        }
        if (e.target.closest('[data-action="show-settings"]')) {
            _showSettings();
        }
    });

    // Global Escape handler for TUI mode
    phreakState._tuiEscHandler = function(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            toggleTUI();
        }
    };
    document.addEventListener('keydown', phreakState._tuiEscHandler);

    setTimeout(function() {
        var input = document.getElementById('phreak-cmd-input');
        if (input) input.focus();
    }, 80);
}

// ─── TUI ISOLATION AND CLEAR FUNCTIONS ───────────────────────

function _isolateFiles(status) {
    var manifest = window.VoidFileExplorer && window.VoidFileExplorer.getIndexedFingerprints
        ? window.VoidFileExplorer.getIndexedFingerprints()
        : null;
    
    if (!manifest || !manifest.files) {
        phreakState.lines.push(_mkLine('system', 'No indexed files. Run INDEX first.'));
        _renderLines();
        return;
    }
    
    var filtered;
    if (status === 'ALL') {
        filtered = manifest.files;
    } else {
        filtered = manifest.files.filter(function(f) { return f.status === status; });
    }
    
    // Update badge counts
    _updateTUIBadges();
    
    phreakState.lines.push(_mkLine('system', '── ' + status + ' FILES (' + filtered.length + ') ──'));
    _renderLines();
    
    // Render filtered files in void right panel
    if (window.renderFileList) {
        window.renderFileList(filtered);
    }
    
    // Show action options
    if (filtered.length > 0) {
        phreakState.lines.push(_mkLine('stdout', ''));
        phreakState.lines.push(_mkLine('stdout', '  Actions:'));
        phreakState.lines.push(_mkLine('stdout', '    make-topic    Load files into chat context'));
        phreakState.lines.push(_mkLine('stdout', '    export-report Generate JSON/TOML report'));
        phreakState.lines.push(_mkLine('stdout', '    create-sprint Create sprint document'));
        phreakState.lines.push(_mkLine('stdout', ''));
        phreakState.lines.push(_mkLine('system', 'Type an action or continue working.'));
        _renderLines();
    }
}

function _clearVoid() {
    var container = document.getElementById('void-file-list');
    if (container) {
        container.innerHTML = '<div style="color:var(--text);opacity:0.5;font-size:13px;letter-spacing:1px;">No files indexed</div>';
    }
    phreakState.lines.push(_mkLine('system', 'Void cleared.'));
    _renderLines();
}

function _clearPhreak() {
    phreakState.lines = [];
    phreakState.lastRenderedIndex = -1;
    _fullRender();
}

function _clearAll() {
    _clearVoid();
    _clearPhreak();
}

function _showGraph() {
    var manifest = window.VoidFileExplorer && window.VoidFileExplorer.getIndexedFingerprints
        ? window.VoidFileExplorer.getIndexedFingerprints()
        : null;
    
    if (!manifest || !manifest.files) {
        phreakState.lines.push(_mkLine('system', 'No indexed files. Run INDEX first.'));
        _renderLines();
        return;
    }
    
    if (window.St8GraphVisualizer && window.St8GraphVisualizer.showGraphPopup) {
        window.St8GraphVisualizer.showGraphPopup(manifest);
        phreakState.lines.push(_mkLine('system', 'Connection graph opened.'));
    } else {
        phreakState.lines.push(_mkLine('stderr', 'Graph visualizer not loaded.'));
    }
    _renderLines();
}

function _showSettings() {
    if (window.St8Settings && window.St8Settings.showSettingsInExplorer) {
        window.St8Settings.showSettingsInExplorer();
        phreakState.lines.push(_mkLine('system', 'Settings opened in File Explorer.'));
    } else {
        phreakState.lines.push(_mkLine('stderr', 'Settings UI not loaded.'));
    }
    _renderLines();
}

function _exitTUI() {
    phreakState.isTUI = false;

    // Remove global escape handler
    if (phreakState._tuiEscHandler) {
        document.removeEventListener('keydown', phreakState._tuiEscHandler);
        phreakState._tuiEscHandler = null;
    }

    // Remove overlay
    var overlay = document.getElementById('phreak-tui-overlay');
    if (overlay) overlay.parentNode.removeChild(overlay);

    // Re-render into panel container (phreakMount will be called by orchestr8 or
    // we find the existing panel body)
    var panelBody = document.getElementById('panel-phreak-body');
    if (panelBody) {
        phreakMountStateless(panelBody);
    }
}

// ─── TUI BADGE UPDATES ───────────────────────────────────────

function _updateTUIBadges() {
    var manifest = window.VoidFileExplorer && window.VoidFileExplorer.getIndexedFingerprints
        ? window.VoidFileExplorer.getIndexedFingerprints()
        : null;

    if (!manifest || !manifest.files) return;

    var counts = { green: 0, yellow: 0, red: 0 };
    manifest.files.forEach(function(f) {
        if (f.status === 'GREEN') counts.green++;
        else if (f.status === 'YELLOW') counts.yellow++;
        else if (f.status === 'RED') counts.red++;
    });

    var badges = document.querySelectorAll('#phreak-tui-toolbar .phreak-badge');
    badges.forEach(function(badge) {
        var type = badge.getAttribute('data-badge');
        if (type === 'green') badge.textContent = counts.green || '';
        else if (type === 'yellow') badge.textContent = counts.yellow || '';
        else if (type === 'red') badge.textContent = counts.red || '';
        else if (type === 'all') badge.textContent = manifest.files.length || '';
    });
}

// Mount without re-seeding welcome message (state is preserved)
function phreakMountStateless(panelBodyEl) {
    panelBodyEl.innerHTML = _buildContainerHTML();

    _attachInputListener();
    _attachOutputClickListener();
    _fullRender();

    setTimeout(function() {
        var input = document.getElementById('phreak-cmd-input');
        if (input) input.focus();
    }, 80);
}

// ─── PHONE ICON ───────────────────────────────────────────────

// Vintage telephone handset SVG (ear cup + mouthpiece)
var PHONE_SVG_ACTIVE =
    '<svg class="phreak-phone-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M5.5 6.5C5.5 5.1 6.6 4 8 4h1c.8 0 1.5.7 1.5 1.5v3c0 .8-.7 1.5-1.5 1.5H8c-.8 0-2 .5-2 2v4.5c0 .8.7 1.5 1.5 1.5H9c.8 0 1-.5 1-1.5v-2.5" />' +
        '<path d="M18.5 6.5c0-1.4-1.1-2.5-2.5-2.5h-1c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h.5c.8 0 2 .5 2 2v4.5c0 .8-.7 1.5-1.5 1.5H15c-.8 0-1-.5-1-1.5v-2.5" />' +
        '<circle cx="8" cy="7" r="1.2" opacity="0.5" />' +
        '<circle cx="16" cy="7" r="1.2" opacity="0.5" />' +
        '<path d="M10.5 11c0 1.5 1.2 2.5 3.5 2.5s3.5-1 3.5-2.5" opacity="0.35" />' +
    '</svg>';

var PHONE_SVG_OFFHOOK =
    '<svg class="phreak-phone-svg phreak-phone-offhook" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<g transform="rotate(-6 8 10)">' +
            '<path d="M5 6C5 4.6 6.1 3.5 7.5 3.5h1c.8 0 1.5.7 1.5 1.5v3c0 .8-.7 1.5-1.5 1.5H8c-.8 0-2 .5-2 2v4.5c0 .8.7 1.5 1.5 1.5H9c.8 0 1-.5 1-1.5v-2.5" />' +
        '</g>' +
        '<g transform="rotate(6 16 10)">' +
            '<path d="M19 6c0-1.4-1.1-2.5-2.5-2.5h-1c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h.5c.8 0 2 .5 2 2v4.5c0 .8-.7 1.5-1.5 1.5H15c-.8 0-1-.5-1-1.5v-2.5" />' +
        '</g>' +
        '<path d="M10 13c0 2 1.5 3 4 3" opacity="0.3" />' +
        '<circle cx="12" cy="20" r="1" fill="currentColor" opacity="0.6">' +
            '<animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />' +
        '</circle>' +
        '<circle cx="9.5" cy="19.5" r="0.7" fill="currentColor" opacity="0.4">' +
            '<animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />' +
        '</circle>' +
        '<circle cx="14.5" cy="19.5" r="0.7" fill="currentColor" opacity="0.4">' +
            '<animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />' +
        '</circle>' +
    '</svg>';

function _buildPhoneIconHTML() {
    var svg = phreakState.phoneOffHook ? PHONE_SVG_OFFHOOK : PHONE_SVG_ACTIVE;
    var stateClass = phreakState.phoneOffHook ? ' phreak-phone--offhook' : '';
    var title = phreakState.phoneOffHook
        ? 'Phone off-hook — signals suppressed (click to reconnect)'
        : 'Phone on-hook — signals active (click to disconnect)';

    return '<button class="phreak-phone-btn' + stateClass + '" ' +
        'data-action="phone-toggle" title="' + title + '">' +
        svg +
    '</button>';
}

function togglePhoneOffHook() {
    phreakState.phoneOffHook = !phreakState.phoneOffHook;
    _updatePhoneIconState();

    var status = phreakState.phoneOffHook
        ? 'Phone OFF-HOOK — incoming signals suppressed'
        : 'Phone ON-HOOK — incoming signals active';
    phreakState.lines.push(_mkLine('system', status));
    _renderLines();
}

function _updatePhoneIconState() {
    var btns = document.querySelectorAll('[data-action="phone-toggle"]');
    btns.forEach(function(btn) {
        if (phreakState.phoneOffHook) {
            btn.classList.add('phreak-phone--offhook');
            btn.title = 'Phone off-hook — signals suppressed (click to reconnect)';
        } else {
            btn.classList.remove('phreak-phone--offhook');
            btn.title = 'Phone on-hook — signals active (click to disconnect)';
        }
        // Swap SVG
        var oldSvg = btn.querySelector('.phreak-phone-svg');
        if (oldSvg) {
            var wrapper = document.createElement('div');
            wrapper.innerHTML = phreakState.phoneOffHook ? PHONE_SVG_OFFHOOK : PHONE_SVG_ACTIVE;
            var newSvg = wrapper.firstChild;
            if (newSvg) oldSvg.parentNode.replaceChild(newSvg, oldSvg);
        }
    });
}

// ─── MUTATION NOTIFICATIONS (SSE-driven) ──────────────────────
// Called by the SSE mutation stream in st8.html.
// Displays mutation events in the terminal output area.
// Format: [MUTATION] {type} {filepath} {timestamp}
// Colors: CREATE → gold (system), EDIT → cyan (stdout), LOCK → pink (stderr)

function notifyMutation(data) {
    if (!data) return;

    var type = (data.mutationType || 'UNKNOWN').toUpperCase();
    var filepath = data.filepath || data.fingerprint || '—';
    var timestamp = data.publishedAt || data.timestamp || '';

    // Format time as HH:MM:SS
    var timeStr = '';
    if (timestamp) {
        try {
            var d = new Date(timestamp);
            timeStr = String(d.getHours()).padStart(2, '0') + ':' +
                      String(d.getMinutes()).padStart(2, '0') + ':' +
                      String(d.getSeconds()).padStart(2, '0');
        } catch (_) {}
    }

    var msg = '[MUTATION] ' + type + ' ' + filepath + (timeStr ? ' ' + timeStr : '');

    // Map mutation type to line type for color coding
    var lineType;
    if (type === 'CREATE')      lineType = 'system';  // gold
    else if (type === 'EDIT')   lineType = 'stdout';  // cyan
    else if (type === 'LOCK')   lineType = 'stderr';  // pink
    else                        lineType = 'system';  // default gold

    phreakState.lines.push(_mkLine(lineType, msg));
    _renderLines();
}

// ─── EPO BUS LISTENER ─────────────────────────────────────────
// Listens for signals from the actu8 EPO WebSocket bus.
// Translates EPO broadcast messages into phreak signals.

function _wireEPOListener() {
    if (phreakState._epoUnlisten) return; // already wired

    // Check if EPO client exists
    if (typeof window === 'undefined' || !window.epoClient) return;

    phreakState._epoUnlisten = window.epoClient.listen(function(msg) {
        // Only process messages that look like signals
        if (!msg || !msg.type) return;

        // Map EPO message types to phreak signal types
        var signalMap = {
            'announcement': 'announcement',
            'notify': 'announcement',
            'chat_response': 'message',
            'chat_ack': 'message',
            'media': 'media',
            'tts': 'media',
            'system': 'system',
            'error': 'system',
            'heartbeat': null, // skip heartbeats
            'ping': null,
            'pong': null,
            'registered': null,
        };

        var signalType = signalMap[msg.type];
        if (signalType === null || signalType === undefined) return;

        receiveSignal({
            type: signalType,
            data: {
                title: msg.type,
                body: msg.content || msg.message || msg.text || '',
                source: 'epo-bus',
                meta: msg,
            },
            provisioned: true,
        });
    });
}

function _unwireEPOListener() {
    if (phreakState._epoUnlisten) {
        phreakState._epoUnlisten();
        phreakState._epoUnlisten = null;
    }
}

// ─── CONTAINER HTML BUILDER ───────────────────────────────────

function _buildContainerHTML() {
    return '<div class="phreak-container" id="phreak-container">' +
        '<div class="phreak-header" id="phreak-header">' +
            '<span class="phreak-header-title">PHREAK></span>' +
            '<div class="phreak-header-controls">' +
                _buildPhoneIconHTML() +
                '<button class="phreak-tui-btn" data-action="tui-toggle" title="Toggle TUI mode (Ctrl+T)">⬚</button>' +
            '</div>' +
        '</div>' +
        '<div class="phreak-output" id="phreak-output"></div>' +
        '<div class="phreak-input-row" id="phreak-input-line">' +
            '<span class="phreak-prompt">bozertron@orchestr8:~$&nbsp;</span>' +
            '<input id="phreak-cmd-input" type="text" class="phreak-cmd-input" ' +
                'autocomplete="off" spellcheck="false" placeholder="" />' +
            '<span class="phreak-executing" id="phreak-executing" style="display:none">◇</span>' +
        '</div>' +
    '</div>';
}

// ─── LISTENER ATTACHMENT HELPERS ───────────────────────────────

function _attachInputListener() {
    var input = document.getElementById('phreak-cmd-input');
    if (input) {
        input.addEventListener('keydown', _handleInputKeydown);
    }
}

function _attachOutputClickListener() {
    var output = document.getElementById('phreak-output');
    if (output) {
        output.addEventListener('click', _handleOutputClick);
    }
}

// ─── MOUNT / INIT ─────────────────────────────────────────────

function phreakMount(panelBodyEl, onCopyLine) {
    phreakState.onCopyLine = onCopyLine || null;

    // Seed welcome message
    if (false && phreakState.lines.length === 0) {
        phreakState.lines.push(_mkLine('system', 'PHREAK> TERMINAL — actu8 void shell'));
        phreakState.lines.push(_mkLine('system', 'Type "help" for available commands'));
        phreakState.lines.push(_mkLine('system', '─────────────────────────────────────'));
    }

    panelBodyEl.innerHTML = _buildContainerHTML();

    _attachInputListener();
    _attachOutputClickListener();

    // Click anywhere in container focuses input
    var container = document.getElementById('phreak-container');
    if (container) {
        container.addEventListener('click', function(e) {
            // Don't steal focus from copy/signal buttons
            if (e.target.closest('.phreak-copy-btn') ||
                e.target.closest('.phreak-signal-popup') ||
                e.target.closest('.phreak-phone-btn') ||
                e.target.closest('.phreak-tui-btn')) return;
            var input = document.getElementById('phreak-cmd-input');
            if (input) input.focus();
        });
    }

    // Wire header button delegation
    var header = document.getElementById('phreak-header');
    if (header) {
        header.addEventListener('click', function(e) {
            if (e.target.closest('[data-action="tui-toggle"]')) {
                toggleTUI();
            }
            if (e.target.closest('[data-action="phone-toggle"]')) {
                togglePhoneOffHook();
            }
        });
    }

    // Wire EPO bus listener
    _wireEPOListener();

    _fullRender();

    setTimeout(function() {
        var input = document.getElementById('phreak-cmd-input');
        if (input) input.focus();
    }, 80);
}

function phreakFocus() {
    var input = document.getElementById('phreak-cmd-input');
    if (input) input.focus();
}

// ─── PUBLIC API ───────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.PhreakTerminal = {
        // Original API (preserved)
        mount: phreakMount,
        execute: phreakExecute,
        focus: phreakFocus,
        copyLine: phreakCopyLine,
        getLines: function() { return phreakState.lines; },
        clear: function() {
            phreakState.lines = [];
            phreakState.lastRenderedIndex = -1;
            _fullRender();
        },

        // New: TUI toggle
        toggleTUI: toggleTUI,

        // New: Signal framework
        receiveSignal: receiveSignal,
        getSignals: function() { return phreakState.signals; },

        // New: Mutation notification (SSE-driven)
        notifyMutation: notifyMutation,

        // New: Phone toggle
        togglePhoneOffHook: togglePhoneOffHook,
        getPhoneState: function() { return { offHook: phreakState.phoneOffHook }; },
        getState: function() { return { isTUI: phreakState.isTUI, phoneOffHook: phreakState.phoneOffHook, lineCount: phreakState.lines.length }; },

        // New: Streaming token support — call this to append a token to the last stdout line
        // or create a new one if the last line isn't stdout
        appendToken: function(token) {
            if (!token) return;
            var last = phreakState.lines[phreakState.lines.length - 1];
            if (last && last.type === 'stdout' && !last._sealed) {
                // Append to existing stdout line (streaming)
                last.content += token;
                // Re-render that specific line in DOM
                var el = document.querySelector('[data-line-id="' + last.id + '"] .phreak-text');
                if (el) el.textContent = last.content;
                _scrollToBottom();
            } else {
                // New line
                var line = _mkLine('stdout', token);
                line._sealed = false;
                phreakState.lines.push(line);
                _renderLines();
            }
        },

        // Seal the current streaming line so next token starts a new line
        sealLine: function() {
            var last = phreakState.lines[phreakState.lines.length - 1];
            if (last) last._sealed = true;
        },

        // New: State snapshot (for debugging / inspection)
        getState: function() {
            return {
                lineCount: phreakState.lines.length,
                historyCount: phreakState.history.length,
                isExecuting: phreakState.isExecuting,
                isTUI: phreakState.isTUI,
                phoneOffHook: phreakState.phoneOffHook,
                signalCount: phreakState.signals.length,
            };
        },
    };
}
