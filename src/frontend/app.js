/*
 * src/frontend/app.js — extracted from st8.html
 *
 * Contains the inline JavaScript that used to live in st8.html's third
 * <script> block plus the escapeHtml utility from the second block.
 * Loaded in the new slim index.html AFTER the component scripts
 * (file-explorer.js, phreak-terminal.js, graph-viewer.js, settings.js,
 * coordination.js) — same load order as the original.
 *
 * Omitted from extraction (per founder direction):
 *   - The void-engine loader (st8.html lines 1762-1779) — void-engine
 *     has been moved to a separate project.
 */

// ──────────────────────────────────────────────────────────────
// escapeHtml utility (was script block 2)
// Extracted from st8.html lines 1784–1788.
// ──────────────────────────────────────────────────────────────

    window.escapeHtml = function(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    // ──────────────────────────────────────────────────────────
    // AUTH (ticket 27)
    //
    // The write routes /api/record-commit and /api/tickets require
    // X-St8-Secret. The secret is generated server-side at boot and
    // served to loopback callers via GET /api/auth-token. We fetch it
    // once at module load and cache the resulting Promise so every
    // call to st8AuthFetch() that needs the header reuses it.
    //
    // If the fetch fails (server down, non-loopback, secret not yet
    // initialized) we degrade to fetching without the header — the
    // server will respond 401/503, which is the correct visible
    // failure mode for the user. We do not silently mask auth errors.
    // ──────────────────────────────────────────────────────────
    window._st8SecretPromise = (function() {
      return fetch('/api/auth-token', { method: 'GET' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(j) { return (j && j.secret) ? j.secret : null; })
        .catch(function() { return null; });
    })();

    /**
     * Fetch wrapper that adds X-St8-Secret to the request headers
     * once the secret has been loaded. Pass-through to the global
     * `fetch` for everything else. Use for any POST to a write route
     * gated by ticket-27 auth.
     */
    window.st8AuthFetch = function(url, opts) {
      opts = opts || {};
      return window._st8SecretPromise.then(function(secret) {
        var headers = Object.assign({}, opts.headers || {});
        if (secret) headers['X-St8-Secret'] = secret;
        return fetch(url, Object.assign({}, opts, { headers: headers }));
      });
    };

// ──────────────────────────────────────────────────────────────
// Main application (panels, wizard, file list, toasts, SSE)
// Extracted from st8.html lines 1797–2584.
// ──────────────────────────────────────────────────────────────

    // ─── SLIDE CONTROLLER ─────────────────────────────────
    // Replaces the old modal panel-overlay open/close pattern. All three
    // panels now live in a 300vw .panels-strip and slide via translateX.
    // Each panel is MOUNTED ONCE at boot — never torn down — so Three.js /
    // particles.js state in the st8 panel survives slides between adjacent
    // columns.
    //
    // The .panels-strip + .shelf both carry `data-active` (one of
    // "explorer" | "st8" | "phreak"), driving both the transform AND the
    // contextual diamond visibility in the shelf.

    const SLIDE_TARGETS = ['explorer', 'st8', 'phreak'];

    const panels = {
      explorer: {
        // .panel-titlebar now lives inside the static column rather than a
        // modal overlay, but the selector still works because the column
        // contains exactly one .panel-frame.
        column:  document.querySelector('.panel-column[data-panel="explorer"]'),
        host:    document.getElementById('explorer-host'),
        mounted: false,
        mount() {
          if (this.mounted) return;
          if (window.VoidFileExplorer && typeof window.VoidFileExplorer.mount === 'function') {
            window.VoidFileExplorer.mount(this.host, function(paths) {
              console.info('[st8] selected:', paths);
            });

            // Wave 5I (ticket FRONT-003): the explorer used to render
            // an inline .explorer-error-banner inside its host, and a
            // shell-side MutationObserver hoisted it into the titlebar.
            // The observer fired on every DOM mutation inside the host
            // and broke silently any time the banner's parent element
            // changed. Replaced with a CustomEvent contract:
            // file-explorer.js dispatches 'explorer:error' on `window`
            // with detail = { message, canRetry } | null; the shell
            // paints/clears the banner in the titlebar directly.
            const self = this;
            const renderBanner = function(detail) {
              const titlebar = self.column.querySelector('.panel-titlebar');
              if (!titlebar) return;
              // Remove any existing banner first (idempotent).
              titlebar.querySelectorAll('.explorer-error-banner').forEach(function(n) {
                n.parentNode.removeChild(n);
              });
              if (!detail) return;
              const banner = document.createElement('div');
              banner.className = 'explorer-error-banner';
              const icon = document.createElement('span');
              icon.className = 'explorer-error-icon';
              icon.textContent = '⚠';
              const msg = document.createElement('span');
              msg.className = 'explorer-error-msg';
              msg.textContent = detail.message || '';
              banner.appendChild(icon);
              banner.appendChild(msg);
              if (detail.canRetry) {
                const retry = document.createElement('button');
                retry.className = 'explorer-retry-btn';
                retry.textContent = 'RETRY';
                retry.addEventListener('click', function() {
                  if (window.VoidFileExplorer && typeof window.VoidFileExplorer._retry === 'function') {
                    window.VoidFileExplorer._retry();
                  }
                });
                banner.appendChild(retry);
              }
              titlebar.appendChild(banner);
            };
            window.addEventListener('explorer:error', function(e) {
              try {
                renderBanner(e && e.detail);
              } catch (err) {
                console.warn('[st8] explorer-error renderer failed:', err && err.message);
              }
            });
          } else {
            this.host.innerHTML = '<div style="padding:24px;color:#C9748F">file-explorer.js failed to load</div>';
          }
          this.mounted = true;
        },
      },
      phreak: {
        column:  document.querySelector('.panel-column[data-panel="phreak"]'),
        host:    document.getElementById('phreak-host'),
        mounted: false,
        mount() {
          if (this.mounted) return;
          if (window.PhreakTerminal && typeof window.PhreakTerminal.mount === 'function') {
            window.PhreakTerminal.mount(this.host, function(content) {
              console.info('[st8] phreak copy:', content);
            });
            const controls = this.host.querySelector('.phreak-header-controls');
            const titlebar = this.column.querySelector('.panel-titlebar');
            if (controls && titlebar) titlebar.appendChild(controls);
            const status = document.createElement('span');
            status.className = 'phreak-status-line';
            status.textContent = 'TYPE "HELP" FOR AVAILABLE COMMANDS';
            // titlebar no longer has a .panel-close diamond (those are
            // shelf-level now), so we just append the status line.
            titlebar.appendChild(status);
            this.statusEl = status;
            const self = this;
            controls && controls.addEventListener('click', function(e) {
              if (e.target.closest('[data-action="tui-toggle"]')) {
                if (window.PhreakTerminal.toggleTUI) window.PhreakTerminal.toggleTUI();
              } else if (e.target.closest('[data-action="phone-toggle"]')) {
                if (window.PhreakTerminal.togglePhoneOffHook) window.PhreakTerminal.togglePhoneOffHook();
                const st = window.PhreakTerminal.getPhoneState && window.PhreakTerminal.getPhoneState();
                if (st && self.statusEl) {
                  self.statusEl.classList.remove('phone-on', 'phone-off');
                  if (st.offHook) {
                    self.statusEl.textContent = 'PHONE OFF-HOOK — SIGNALS SUPPRESSED';
                    self.statusEl.classList.add('phone-off');
                  } else {
                    self.statusEl.textContent = 'PHONE ON-HOOK — SIGNALS ACTIVE';
                    self.statusEl.classList.add('phone-on');
                  }
                }
              }
            });
          } else {
            this.host.innerHTML = '<div style="padding:24px;color:#C9748F">phreak-terminal.js failed to load</div>';
          }
          this.mounted = true;
        },
      },
    };

    const strip = document.getElementById('panels-strip');
    const shelf = document.getElementById('shelf');

    function slideTo(target) {
      if (!SLIDE_TARGETS.includes(target)) return;
      if (strip) strip.setAttribute('data-active', target);
      if (shelf) shelf.setAttribute('data-active', target);
      // Lazy-mount the visited panel. The st8 panel is mounted by the
      // particles/Three integration in Phase B/C; explorer + phreak mount
      // on first visit.
      if (panels[target] && typeof panels[target].mount === 'function') {
        panels[target].mount();
      }
    }

    // Expose for the rest of the app (terminal, future hotkeys, etc.).
    window.St8Slide = { slideTo, current: function() { return strip ? strip.getAttribute('data-active') : null; } };

    // Mount file-explorer + phreak immediately so their state is ready
    // even before the user slides to them. Center st8 panel mounts when
    // particles/Three init in Phase B/C.
    panels.explorer.mount();
    panels.phreak.mount();

    // ─── CONSTELLATION (Phase B) ──────────────────────────────
    // Mount the flat file-view in the center st8 panel's #stage.
    // Particle click → existing notes-popup via window.handleFileNotes.
    // SSE 'mutation' events live-update individual particle colors.
    function bootConstellation() {
      if (!window.St8Constellation || typeof window.St8Constellation.init !== 'function') {
        console.warn('[st8] constellation.js not loaded — st8 main panel will stay empty');
        return;
      }
      const stage = document.getElementById('stage');
      if (!stage) return;
      fetch('/api/connection-state.json')
        .then(function(r) { return r.ok ? r.json() : { files: [] }; })
        .then(function(data) {
          const files = (data && Array.isArray(data.files)) ? data.files : [];
          // Stash the manifest so the click handler can look up full
          // file context when opening the dive-in.
          window._st8FileIndex = {};
          files.forEach(function(f) { window._st8FileIndex[f.fingerprint] = f; });

          window.St8Constellation.init({
            targetEl: stage,
            files: files,
            onParticleClick: function(hit) {
              // Founder's loop:
              //   - RED / YELLOW particle (bug-juice) -> open Three.js dive-in
              //     showing the file as a Barradeau building. Inside the
              //     dive-in there's a Notes/Ticket affordance for the
              //     human <-> LLM collaboration loop.
              //   - GREEN particle -> straight to notes popup (no need
              //     to dimensionalize a healthy file).
              const file = window._st8FileIndex[hit.fingerprint];
              const isBuggy = file && (file.status === 'RED' || file.status === 'YELLOW');
              if (isBuggy && window.St8DiveIn && typeof window.St8DiveIn.show === 'function') {
                window.St8DiveIn.show(file);
              } else if (typeof window.handleFileNotes === 'function' && hit.filepath) {
                window.handleFileNotes(hit.filepath);
              }
            },
          });
        })
        .catch(function(err) {
          console.warn('[st8] constellation /api/files failed:', err && err.message);
        });
    }
    // Ticket 21: invoke bootConstellation on DOMContentLoaded rather than at
    // script-parse time. `<script src="app.js">` lives at the END of <body>
    // today so the DOM IS parsed by now — but if anyone ever adds
    // defer/async, moves the tag, or wraps the bundle differently, the
    // top-level `document.getElementById('stage')` lookup races and silently
    // returns null. DOMContentLoaded fires immediately when the document is
    // already parsed (the spec guarantees this), so wrapping is a strictly
    // defensive move with zero behavior change in the current load order.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootConstellation);
    } else {
      bootConstellation();
    }

    // Live updates (post Wave 4D ticket 1): the constellation listens on
    // the SAME /api/mutations stream the mutation toast handler uses. The
    // window event 'st8:mutation' is dispatched from that handler below
    // (see the mutationSource.onmessage block) with the parsed payload —
    // we subscribe here and recolor a single particle on each event.
    //
    // Replaces the previous 5s setInterval poll of /api/connection-state.json:
    // SSE delivers the same status signal with <1s latency and no idle
    // round-trips. Initial constellation state still comes from the
    // one-shot fetch in bootConstellation() above.
    window.addEventListener('st8:mutation', function(ev) {
      if (!window.St8Constellation) return;
      var data = ev && ev.detail;
      if (!data || !data.fingerprint) return;

      // schemaCard carries the canonical GREEN/YELLOW/RED status the
      // poller was reading from connection-state.json. For DELETE events
      // schemaCard is null on purpose (file is gone); skip those — the
      // particle will be reconciled on the next full manifest reload.
      var status = data.schemaCard && data.schemaCard.status;
      if (!status) return;

      try {
        window.St8Constellation.updateFileStatus(data.fingerprint, status);
      } catch (err) {
        console.warn('[st8] constellation updateFileStatus failed:', err && err.message);
      }
    });

    // Wire the contextual slide diamonds. Each .slide-diamond is either
    // .slide-left (in the left shelf slot) or .slide-right (right slot).
    // The target panel is computed from the CURRENT active panel:
    //   from explorer → only slide-right is visible → goes to st8
    //   from st8      → slide-left goes to explorer, slide-right to phreak
    //   from phreak   → only slide-left is visible  → goes to st8
    // This matches the founder's "diamond on the side closest to st8" rule.
    function diamondTarget(direction) {
      const cur = strip ? strip.getAttribute('data-active') : 'st8';
      if (direction === 'left') {
        if (cur === 'phreak') return 'st8';
        if (cur === 'st8') return 'explorer';
        return null; // explorer — slide-left is hidden anyway
      }
      // direction === 'right'
      if (cur === 'explorer') return 'st8';
      if (cur === 'st8') return 'phreak';
      return null;
    }
    document.querySelectorAll('.slide-diamond').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const dir = btn.classList.contains('slide-left') ? 'left' : 'right';
        const target = diamondTarget(dir);
        if (target) slideTo(target);
      });
    });

    // ─── CAROUSEL KEYBOARD NAV (ticket 7) ──────────────────────
    // Carousel was one-button-deep before this: only ESC worked.
    // Now wired:
    //   ESC          → return to st8 center (matches "diamond closest to st8")
    //   ArrowLeft    → slide one column left  (phreak→st8, st8→explorer)
    //   ArrowRight   → slide one column right (explorer→st8, st8→phreak)
    //   Home         → jump to leftmost column (explorer)
    //   End          → jump to rightmost column (phreak)
    //
    // Suppression rules (skip the global handler):
    //   - phreak TUI is active (it owns its own keymap)
    //   - typeable focus: <input>, <textarea>, <select>, contenteditable
    //     OR an open .notes-popup-overlay / .panel-overlay.open
    //     (PRD wizard, notes popup own their own Tab/Esc focus context)
    //   - any modifier key down (Ctrl/Meta/Alt/Shift) — preserves
    //     browser shortcuts and avoids stealing Ctrl+ArrowLeft etc.
    //
    // Both the keydown router AND the slide-target computation are
    // exported on window.St8Slide so tests/frontend can drive them
    // as pure functions without a DOM.

    /**
     * Compute the next active panel given the current panel + a key.
     * Pure function: no DOM, no side effects.
     * Returns null when the key is unhandled or no slide should happen.
     *
     * @param {string} key       — KeyboardEvent.key value
     * @param {string} current   — current panel ('explorer'|'st8'|'phreak')
     * @returns {string|null}    — target panel or null
     */
    function nextSlideTarget(key, current) {
      const order = ['explorer', 'st8', 'phreak'];
      const idx = order.indexOf(current);
      if (idx < 0) return null; // unknown current — no-op
      if (key === 'Escape') return current === 'st8' ? null : 'st8';
      if (key === 'ArrowLeft')  return idx > 0 ? order[idx - 1] : null;
      if (key === 'ArrowRight') return idx < order.length - 1 ? order[idx + 1] : null;
      if (key === 'Home') return current === 'explorer' ? null : 'explorer';
      if (key === 'End')  return current === 'phreak'   ? null : 'phreak';
      return null;
    }

    /**
     * Return true if the keydown should be suppressed (a typeable
     * element has focus, or an in-app modal owns the keymap).
     * Pure function over `document` / event target only.
     */
    function shouldSuppressCarouselKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return true;
      // Shift alone is allowed (no shifted form of ArrowLeft/Right
      // collides), but Shift+Arrow inside a text input would already
      // be caught by the input check below.
      const t = e.target;
      if (t) {
        const tag = (t.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (t.isContentEditable) return true;
      }
      // Modal overlays own their own keymap.
      if (document.querySelector('.notes-popup-overlay')) return true;
      const prdOverlay = document.getElementById('overlay-prd-wizard');
      if (prdOverlay && prdOverlay.classList.contains('open')) return true;
      // Phreak TUI owns its own keymap.
      if (window.PhreakTerminal && window.PhreakTerminal.getState && window.PhreakTerminal.getState().isTUI) return true;
      return false;
    }

    document.addEventListener('keydown', function(e) {
      const key = e.key;
      if (key !== 'Escape' && key !== 'ArrowLeft' && key !== 'ArrowRight'
          && key !== 'Home' && key !== 'End') return;
      if (shouldSuppressCarouselKey(e)) return;
      const current = strip && strip.getAttribute('data-active');
      const target = nextSlideTarget(key, current || 'st8');
      if (!target) return;
      e.preventDefault();
      slideTo(target);
      // Move focus to the slide-diamond that *would have triggered*
      // this slide so screen readers announce the active control and
      // subsequent keyboard actions stay on the carousel chrome
      // instead of falling back to the body. The shelf's contextual
      // visibility (.slide-left hidden when on explorer; .slide-right
      // hidden when on phreak) means after the slide there's always a
      // visible diamond pointing back to the previous panel; focus
      // that.
      try {
        const back = (target === 'explorer') ? '.slide-right'
                   : (target === 'phreak')   ? '.slide-left'
                   : (current === 'explorer') ? '.slide-right' : '.slide-left';
        const diamond = document.querySelector('.shelf ' + back);
        if (diamond && typeof diamond.focus === 'function') diamond.focus();
      } catch (_) { /* focus is best-effort */ }
    });

    // Export the pure helpers so tests can verify the keymap without
    // booting a full DOM. Append to window.St8Slide established above.
    if (window.St8Slide) {
      window.St8Slide.nextSlideTarget = nextSlideTarget;
      window.St8Slide.shouldSuppressCarouselKey = shouldSuppressCarouselKey;
    }

    // ─── PRD WIZARD ─────────────────────────────────────────
    //
    // DESIGN DECISION (Wave 5I, ticket FRONT-006):
    //   The PRD wizard remains a modal `.panel-overlay#overlay-prd-wizard`
    //   rather than a 4th carousel slide. The frontend wave previously
    //   chose this and the founder's stance is "strip legacy UI, don't
    //   add to it." Promoting the wizard to a permanent carousel column
    //   would require:
    //     - a 4th slide track in `panels-strip` (currently 3-target:
    //       explorer | st8 | phreak — see SLIDE_TARGETS above)
    //     - new diamond-key bindings, shelf icon, and visibility gating
    //       (hide unless INDEX has run)
    //     - moving `loadTemplatesForWizard` + the generation flow into
    //       its own mounted component, mirroring explorer/phreak.
    //   None of that is needed for the current launch surface.
    //
    //   Trade-off:
    //   - Modal isolates the wizard from the carousel and lets users
    //     keep their explorer context while configuring a PRD.
    //   - `file-explorer.js:350` calls `window.openPRDWizard()` directly,
    //     a coupling we accept: if the wizard ever moves to a slide,
    //     this global function will become a `slideTo('prd')` wrapper
    //     and the call site does NOT need to change.
    //
    //   Deferred to roadmap: `docs/_pending-roadmap/server-api-and-legacy-frontend.md`
    //   item P3.3 — "Migrate PRD wizard into the carousel pattern".
    //
    window.openPRDWizard = function() {
      document.getElementById('overlay-prd-wizard').classList.add('open');
      loadTemplatesForWizard();
    };
    window.closePRDWizard = function() {
      document.getElementById('overlay-prd-wizard').classList.remove('open');
    };

    async function loadTemplatesForWizard() {
      try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        const select = document.getElementById('prd-template');
        select.innerHTML = '<option value="">Select template...</option>';
        if (data.templates) {
          data.templates.forEach(function(t) {
            var opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = t.name;
            select.appendChild(opt);
          });
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    }

    window.createPRDProject = async function() {
      var name = document.getElementById('prd-name').value;
      var template = document.getElementById('prd-template').value;
      if (!name || !template) {
        alert('Name and template are required');
        return;
      }
      try {
        var response = await fetch('/api/prd-projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, template: template, variables: {} })
        });
        if (response.ok) {
          closePRDWizard();
          alert('PRD project created: ' + name);
        } else {
          var err = await response.json();
          alert('Error: ' + (err.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Failed to create project: ' + err.message);
      }
    };

    // ─── TEMPLATE VARIABLE EDITOR ────────────────────────────
    function showPopup(title, html, onSave) {
      var overlay = document.createElement('div');
      overlay.className = 'notes-popup-overlay';
      overlay.innerHTML = '<div class="notes-popup">' +
        '<div class="notes-popup-header">' +
          '<span class="notes-popup-title">' + escapeHtml(title) + '</span>' +
          '<button class="notes-popup-close" onclick="this.closest(\'.notes-popup-overlay\').remove()">◇</button>' +
        '</div>' +
        '<div class="notes-popup-body">' + html + '</div>' +
        '<div class="notes-popup-footer">' +
          '<button class="notes-btn notes-btn-cancel" onclick="this.closest(\'.notes-popup-overlay\').remove()">CANCEL</button>' +
          '<button class="notes-btn notes-btn-save">SAVE</button>' +
        '</div>' +
      '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.notes-btn-save').addEventListener('click', function() {
        if (onSave) onSave();
        overlay.remove();
      });
    }

    window.showVariableEditor = function(filepath, variables) {
      var vars = variables || {};
      var html = Object.keys(vars).map(function(key) {
        return '<div class="var-field"><label>' + escapeHtml(key) + '</label>' +
          '<input type="text" class="var-input" data-var="' + escapeHtml(key) + '" ' +
          'value="' + escapeHtml(vars[key] || '') + '" placeholder="Enter ' + escapeHtml(key) + '..."></div>';
      }).join('');
      // Simple prompt-based editor for now
      if (Object.keys(vars).length === 0) {
        alert('No variables to fill');
        return;
      }
      showPopup('Fill Variables: ' + filepath, html, function() {
        var filled = {};
        document.querySelectorAll('.var-input').forEach(function(input) {
          filled[input.dataset.var] = input.value;
        });
        console.log('Filled variables:', filled);
      });
    };

    // ─── WORKSPACE CHANGE HANDLER ─────────────────────────────
    window.st8WorkspaceChanged = function(wsType) {
      console.info('[st8] workspace changed to:', wsType);
      const voidEl = document.getElementById('void');
      if (!voidEl) return;

      if (wsType === 'logic-analyzer') {
        // Activate split mode
        voidEl.classList.add('split-mode');
        // Create right panel if it doesn't exist
        if (!voidEl.querySelector('.void-right-panel')) {
          const rightPanel = document.createElement('div');
          rightPanel.className = 'void-right-panel';
          rightPanel.innerHTML = '<div class="file-list-header">FILES</div><div id="void-file-list"></div>';
          voidEl.appendChild(rightPanel);
        }
        // Start coordination polling
        if (window.St8Coordination) {
          window.St8Coordination.startPolling('/api/connection-state.json');
        }
      } else {
        // Deactivate split mode (standard workspace; also catches
        // legacy 'pretext-dev' workspace value — void-engine was
        // retired to a separate project, so pretext-dev now degrades
        // gracefully to standard mode. See index.html header comment).
        voidEl.classList.remove('split-mode');
        // Remove right panel
        const rightPanel = voidEl.querySelector('.void-right-panel');
        if (rightPanel) rightPanel.remove();
        // Stop coordination polling
        if (window.St8Coordination) {
          window.St8Coordination.stopPolling();
        }
      }
    };

    // ─── FILE LIST RENDERING ──────────────────────────────────
    window.renderFileList = function(files) {
      const container = document.getElementById('void-file-list');
      if (!container) return;

      if (!files || files.length === 0) {
        container.innerHTML = '<div style="color:var(--text);opacity:0.5;font-size:13px;letter-spacing:1px;">No files indexed</div>';
        return;
      }

      // Count statuses
      var greenCount = files.filter(function(f) { return f.status === 'GREEN'; }).length;
      var yellowCount = files.filter(function(f) { return f.status === 'YELLOW'; }).length;
      var redCount = files.filter(function(f) { return f.status === 'RED'; }).length;

      // Build HTML
      var html = '<div class="file-list-summary">' +
        '<span class="file-summary-item"><span class="file-status-dot green"></span> ' + greenCount + '</span>' +
        '<span class="file-summary-item"><span class="file-status-dot yellow"></span> ' + yellowCount + '</span>' +
        '<span class="file-summary-item"><span class="file-status-dot red"></span> ' + redCount + '</span>' +
        '<span class="file-summary-total">' + files.length + ' files</span>' +
      '</div>';

      html += files.map(function(file) {
        var statusClass = file.status === 'GREEN' ? 'green' : file.status === 'YELLOW' ? 'yellow' : 'red';
        var purpose = file.intent && file.intent.purpose ? file.intent.purpose : '(no purpose)';
        var hasUnknown = purpose.indexOf('???') !== -1;
        return '<div class="file-list-item" data-path="' + escapeHtml(file.filepath) + '">' +
          '<div class="file-status-dot ' + statusClass + '"></div>' +
          '<div class="file-list-content">' +
            '<div class="file-name">' + escapeHtml(file.filename) + (file.needsAIReview ? ' <span class="badge-ai-review">@@@</span>' : '') + '</div>' +
            '<div class="file-purpose">' + escapeHtml(purpose) +
              (hasUnknown ? ' <span class="badge-unknown">???</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="file-actions">' +
            '<button class="file-action-btn" onclick="window.handleFileNotes(\'' + escapeHtml(file.filepath) + '\')">Notes</button>' +
            '<button class="file-action-btn" onclick="window.handleFileClipboard(\'' + escapeHtml(file.filepath) + '\')">Copy</button>' +
          '</div>' +
        '</div>';
      }).join('');

      container.innerHTML = html;
    };

    // ─── FILE ACTION HANDLERS ─────────────────────────────────
    window.handleFileNotes = function(filepath) {
      console.info('[st8] notes for:', filepath);
      showNotesPopup(filepath);
    };
    window.handleFileClipboard = function(filepath) {
      console.info('[st8] clipboard:', filepath);
      copyFileContext(filepath);
    };

    // ─── COPY FILE CONTEXT ───────────────────────────────────
    function copyFileContext(filepath) {
      var manifest = window.VoidFileExplorer && window.VoidFileExplorer.getIndexedFingerprints
        ? window.VoidFileExplorer.getIndexedFingerprints()
        : null;
      var fileData = manifest && manifest.files
        ? manifest.files.find(function(f) { return f.filepath === filepath; })
        : null;

      if (!fileData) {
        console.warn('[st8] File not found in manifest:', filepath);
        return;
      }

      // Build context string
      var context = 'FILE: ' + filepath + '\n';
      context += 'STATUS: ' + fileData.status + '\n';
      context += 'HASH: ' + (fileData.sha256Hash || 'N/A') + '\n';
      context += '\n';

      // Connections
      if (fileData.imports && fileData.imports.length > 0) {
        context += 'IMPORTS:\n';
        fileData.imports.forEach(function(imp) {
          context += '  - ' + imp.source + '\n';
        });
        context += '\n';
      }
      if (fileData.importedBy && fileData.importedBy.length > 0) {
        context += 'IMPORTED BY:\n';
        fileData.importedBy.forEach(function(imp) {
          context += '  - ' + imp + '\n';
        });
        context += '\n';
      }

      // Intent
      if (fileData.intent) {
        if (fileData.intent.purpose) {
          context += 'PURPOSE: ' + fileData.intent.purpose + '\n';
        }
        if (fileData.intent.dependsOnBehavior) {
          context += 'DEPENDS ON: ' + fileData.intent.dependsOnBehavior + '\n';
        }
        if (fileData.intent.valueStatement) {
          context += 'VALUE: ' + fileData.intent.valueStatement + '\n';
        }
      }

      // Copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(context).then(function() {
          console.info('[st8] Context copied to clipboard');
          // Show feedback
          showCopyFeedback(filepath);
        }).catch(function(err) {
          console.error('[st8] Failed to copy:', err);
        });
      } else {
        // Fallback for older browsers
        var textarea = document.createElement('textarea');
        textarea.value = context;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        console.info('[st8] Context copied to clipboard (fallback)');
        showCopyFeedback(filepath);
      }
    }

    // ─── COPY FEEDBACK ───────────────────────────────────────
    function showCopyFeedback(filepath) {
      var items = document.querySelectorAll('.file-list-item[data-path="' + CSS.escape(filepath) + '"]');
      items.forEach(function(item) {
        var btn = item.querySelector('.file-action-btn:last-child');
        if (btn) {
          var originalText = btn.textContent;
          btn.textContent = 'COPIED!';
          btn.style.background = 'var(--gold)';
          btn.style.color = 'var(--void)';
          setTimeout(function() {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
          }, 1500);
        }
      });
    }

    // ─── NOTES POPUP ─────────────────────────────────────────
    function showNotesPopup(filepath) {
      // Get existing intent data
      var manifest = window.VoidFileExplorer && window.VoidFileExplorer.getIndexedFingerprints
        ? window.VoidFileExplorer.getIndexedFingerprints()
        : null;
      var fileData = manifest && manifest.files
        ? manifest.files.find(function(f) { return f.filepath === filepath; })
        : null;
      var intent = fileData && fileData.intent ? fileData.intent : {};

      // Create overlay
      var overlay = document.createElement('div');
      overlay.className = 'notes-popup-overlay';
      overlay.innerHTML = '<div class="notes-popup">' +
        '<div class="notes-popup-header">' +
          '<span class="notes-popup-title">FILE NOTES</span>' +
          '<button class="notes-popup-close" onclick="this.closest(\'.notes-popup-overlay\').remove()">◇</button>' +
        '</div>' +
        '<div class="notes-popup-body">' +
          '<div class="notes-field">' +
            '<label>PURPOSE</label>' +
            '<textarea id="notes-purpose" rows="3">' + escapeHtml(intent.purpose || '') + '</textarea>' +
          '</div>' +
          '<div class="notes-field">' +
            '<label>DEPENDS ON BEHAVIOR</label>' +
            '<textarea id="notes-depends" rows="3">' + escapeHtml(intent.dependsOnBehavior || '') + '</textarea>' +
          '</div>' +
          '<div class="notes-field">' +
            '<label>VALUE STATEMENT</label>' +
            '<textarea id="notes-value" rows="3">' + escapeHtml(intent.valueStatement || '') + '</textarea>' +
          '</div>' +
        '</div>' +
        '<div class="notes-popup-footer">' +
          '<button class="notes-btn notes-btn-cancel" onclick="this.closest(\'.notes-popup-overlay\').remove()">CANCEL</button>' +
          '<button class="notes-btn notes-btn-save" onclick="window.saveFileNotes(\'' + escapeHtml(filepath) + '\')">SAVE</button>' +
          '<button class="notes-btn notes-btn-ticket" onclick="window.makeTicketFromNotes(\'' + escapeHtml(filepath) + '\')" style="background:transparent;border:1px solid #C9748F;color:#D4AF37;margin-left:8px;text-shadow:0 0 6px rgba(201,116,143,0.5);">MAKE TICKET</button>' +
        '</div>' +
      '</div>';

      document.body.appendChild(overlay);
    }

    // ─── MAKE TICKET ─────────────────────────────────────────
    // Closes the founder's loop: user spots bug-juice in the void →
    // clicks particle → notes popup → writes a note → clicks Make
    // Ticket. POSTs to /api/tickets; backend writes the row, fires
    // HOOKS.TICKET_CREATED, and (once the Sonic indexer is wired) the
    // LLM colleague picks it up via the shared ground-plane channel.
    window.makeTicketFromNotes = function(filepath) {
      const file = (window._st8FileIndex && Object.values(window._st8FileIndex).find(function(f) {
        return f.filepath === filepath;
      })) || {};
      const purposeEl = document.getElementById('notes-purpose');
      const dependsEl = document.getElementById('notes-depends');
      const valueEl   = document.getElementById('notes-value');
      // Compose the user note from whatever they've typed. If they
      // typed in only one field, that's the note; we don't force them
      // to fill all three.
      const parts = [];
      if (purposeEl && purposeEl.value) parts.push('PURPOSE:\n' + purposeEl.value);
      if (dependsEl && dependsEl.value) parts.push('DEPENDS ON:\n' + dependsEl.value);
      if (valueEl   && valueEl.value)   parts.push('VALUE:\n'   + valueEl.value);
      const userNote = parts.join('\n\n') || '(no note text)';

      // Auth-aware POST — st8AuthFetch attaches X-St8-Secret if the
      // secret was successfully fetched on page load (ticket 27).
      window.st8AuthFetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: file.fingerprint,
          filepath:    file.filepath || filepath,
          sha256Hash:  file.sha256Hash,
          status:      file.status,
          userNote:    userNote,
          identityBundle: {
            intent:    file.intent || null,
            imports:   file.imports || [],
            importedBy: file.importedBy || [],
            statusCounts: file.statusCounts || null,
          },
        }),
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data && data.ok) {
          // Visual feedback: toast + close the popup.
          // Note: showCopyFeedback is a local function in this closure (NOT on
          // window). The previous `window.showCopyFeedback` check was always
          // falsy, silently swallowing the success toast. Call the local fn
          // directly. showCopyFeedback targets a `.file-list-item[data-path=X]`
          // — pass the filepath so the COPIED-style badge lands on the right
          // row in the explorer's file list.
          if (typeof showCopyFeedback === 'function') {
            showCopyFeedback(filepath);
          }
          console.info('[st8] Ticket #' + data.id + ' created');
          const overlay = document.querySelector('.notes-popup-overlay');
          if (overlay) overlay.remove();
        } else {
          alert('Ticket creation failed: ' + (data && data.error));
        }
      }).catch(function(err) {
        alert('Ticket creation failed: ' + err.message);
      });
    };

    // ─── SAVE FILE NOTES ─────────────────────────────────────
    window.saveFileNotes = function(filepath) {
      var purpose = document.getElementById('notes-purpose').value;
      var depends = document.getElementById('notes-depends').value;
      var value = document.getElementById('notes-value').value;

      console.info('[st8] saving notes for:', filepath);

      // Update manifest
      var manifest = window.VoidFileExplorer && window.VoidFileExplorer.getIndexedFingerprints
        ? window.VoidFileExplorer.getIndexedFingerprints()
        : null;
      if (manifest && manifest.files) {
        var fileData = manifest.files.find(function(f) { return f.filepath === filepath; });
        if (fileData) {
          fileData.intent = {
            purpose: purpose,
            dependsOnBehavior: depends,
            valueStatement: value
          };
          
          // F7: Call backend API to persist notes
          fetch('/api/file-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fingerprint: fileData.sha256Hash,
              purpose: purpose,
              dependsOnBehavior: depends,
              valueStatement: value
            })
          }).then(function(response) {
            if (!response.ok) {
              throw new Error('Save failed: ' + response.status);
            }
            return response.json();
          }).then(function(data) {
            console.info('[st8] Notes saved to backend:', data);
            
            // Close popup
            var overlay = document.querySelector('.notes-popup-overlay');
            if (overlay) overlay.remove();
            
            // Re-fetch manifest to get updated intent
            return fetch('/api/connection-state.json');
          }).then(function(response) {
            return response.json();
          }).then(function(freshManifest) {
            if (freshManifest && freshManifest.files) {
              // Update VoidFileExplorer state
              if (window.VoidFileExplorer && window.VoidFileExplorer.setIndexedFingerprints) {
                window.VoidFileExplorer.setIndexedFingerprints(freshManifest);
              }
              // Re-render file list with fresh data
              renderFileList(freshManifest.files);
            }
          }).catch(function(err) {
            console.error('[st8] Failed to save notes:', err);
            alert('Failed to save notes: ' + err.message);
          });
        }
      }
    };

    // ─── INDEXING COMPLETE HANDLER ────────────────────────────
    window.st8IndexingComplete = function(targetPath) {
      console.info('[st8] indexing complete for:', targetPath);
      
      // Fetch the manifest and populate the file list
      fetchManifest(targetPath).then(function(manifest) {
        if (manifest && manifest.files) {
          renderFileList(manifest.files);
          // Store in explorer state
          if (window.VoidFileExplorer && window.VoidFileExplorer.setIndexedFingerprints) {
            window.VoidFileExplorer.setIndexedFingerprints(manifest);
          }
        }
      });
    };
    
    // ─── FETCH MANIFEST ──────────────────────────────────────
    async function fetchManifest(targetPath) {
      try {
        // Try to fetch from the backend server (relative path)
        const response = await fetch('/api/connection-state.json');
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.warn('[st8] Backend server not available, trying local file');
      }
      
      // Fallback: try to read from local file
      try {
        const response = await fetch(targetPath + '/connection-state.json');
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.warn('[st8] Local manifest not found');
      }
      
      return null;
    }

    // ─── BRUNO & OSCAR + AI REVIEW TOASTS ────────────────────
    function showBrunoToast(data) {
        showActionToast('BRUNO', data.filepath || data.fingerprint, 'badge-bruno',
            'Review', function() { reviewStaleFile(data.filepath); },
            'Archive', function() { archiveFile(data.filepath); }
        );
    }

    function showArchiveToast(data) {
        showActionToast('ARCHIVED', data.filepath || data.fingerprint, 'badge-archive',
            null, null, null, null
        );
    }

    function showAIReviewToast(data) {
        showActionToast('AI REVIEW', data.filepath || data.fingerprint, 'badge-ai',
            'Review', function() { openAIReview(data.filepath); },
            'Dismiss', function() { }
        );
    }

    function showActionToast(typeLabel, text, badgeClass, btn1Text, btn1Action, btn2Text, btn2Action) {
        var container = document.getElementById('mutation-toasts');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'mutation-toast';

        var badge = document.createElement('span');
        badge.className = 'mutation-badge ' + badgeClass;
        badge.textContent = typeLabel;

        var filepath = document.createElement('span');
        filepath.className = 'mutation-filepath';
        filepath.textContent = text || '—';

        toast.appendChild(badge);
        toast.appendChild(filepath);

        if (btn1Text) {
            var btn1 = document.createElement('button');
            btn1.className = 'file-action-btn';
            btn1.textContent = btn1Text;
            btn1.onclick = btn1Action;
            toast.appendChild(btn1);
        }
        if (btn2Text) {
            var btn2 = document.createElement('button');
            btn2.className = 'file-action-btn';
            btn2.textContent = btn2Text;
            btn2.onclick = btn2Action;
            toast.appendChild(btn2);
        }

        container.appendChild(toast);
        setTimeout(function() {
            toast.classList.add('dismissing');
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 8000);
    }

    window.reviewStaleFile = function(filepath) {
        console.log('Reviewing stale file:', filepath);
    };

    window.archiveFile = function(filepath) {
        fetch('/api/oscar-house', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: [filepath] })
        });
    };

    window.openAIReview = function(filepath) {
        console.log('Opening AI review for:', filepath);
    };

    // ─── SSE MUTATION STREAM ──────────────────────────────────
    // Connect to the backend mutation notification stream.
    // Uses relative URL since frontend is served from same origin.
    (function initMutationStream() {
      var mutationSource = null;
      var reconnectTimer = null;
      var reconnectDelay = 1000; // Start at 1s, exponential backoff to 30s
      var MAX_RECONNECT_DELAY = 30000;
      var TOAST_DURATION = 5000; // Auto-dismiss after 5s

      function getBadgeClass(mutationType) {
        var type = (mutationType || '').toUpperCase();
        if (type === 'CREATE')     return 'badge-create';
        if (type === 'EDIT')       return 'badge-edit';
        if (type === 'DELETE')     return 'badge-purge';
        if (type === 'LOCK')       return 'badge-lock';
        if (type === 'CONCEPT')    return 'badge-concept';
        if (type === 'PRODUCTION') return 'badge-production';
        if (type === 'PURGE')      return 'badge-purge';
        return 'badge-other';
      }

      function formatTime(isoString) {
        try {
          var d = new Date(isoString);
          var h = String(d.getHours()).padStart(2, '0');
          var m = String(d.getMinutes()).padStart(2, '0');
          var s = String(d.getSeconds()).padStart(2, '0');
          return h + ':' + m + ':' + s;
        } catch (_) {
          return '';
        }
      }

      function showMutationToast(data) {
        var container = document.getElementById('mutation-toasts');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'mutation-toast';

        var badge = document.createElement('span');
        badge.className = 'mutation-badge ' + getBadgeClass(data.mutationType);
        badge.textContent = data.mutationType || 'UNKNOWN';

        var filepath = document.createElement('span');
        filepath.className = 'mutation-filepath';
        filepath.textContent = data.filepath || data.fingerprint || '—';
        filepath.title = data.filepath || data.fingerprint || '';

        var time = document.createElement('span');
        time.className = 'mutation-time';
        time.textContent = formatTime(data.publishedAt || data.timestamp);

        toast.appendChild(badge);
        toast.appendChild(filepath);
        toast.appendChild(time);
        container.appendChild(toast);

        // Auto-dismiss after TOAST_DURATION
        setTimeout(function() {
          toast.classList.add('dismissing');
          setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
          }, 300);
        }, TOAST_DURATION);
      }

      function connect() {
        if (mutationSource) {
          try { mutationSource.close(); } catch (_) {}
        }

        mutationSource = new EventSource('/api/mutations');

        mutationSource.onopen = function() {
          console.info('[st8] Mutation stream connected');
          reconnectDelay = 1000; // Reset backoff on successful connect
        };

        mutationSource.onmessage = function(event) {
          try {
            var data = JSON.parse(event.data);

            // Skip the initial 'connected' event from the server
            if (data.type === 'connected') {
              console.info('[st8] SSE handshake complete');
              return;
            }

            console.log('[st8] Mutation:', data.mutationType, data.filepath);

            // Re-broadcast on the window so loose subscribers (e.g. the
            // constellation recolor handler installed earlier in this file)
            // can consume the same event without coupling to this closure.
            // Wave 4D ticket 1: replaces the 5s connection-state.json poll.
            try {
              window.dispatchEvent(new CustomEvent('st8:mutation', { detail: data }));
            } catch (err) {
              console.warn('[st8] window.dispatchEvent failed:', err && err.message);
            }

            // Display notification toast in UI
            showMutationToast(data);

            // Bruno & Oscar notifications
            if (data.mutationType === 'BRUNO_CALL') {
                showBrunoToast(data);
            }
            if (data.mutationType === 'ARCHIVE') {
                showArchiveToast(data);
            }
            if (data.mutationType === 'AI_REVIEW_NEEDED') {
                showAIReviewToast(data);
            }

            // Surface mutation in phreak terminal TUI
            if (window.PhreakTerminal && window.PhreakTerminal.notifyMutation) {
              window.PhreakTerminal.notifyMutation(data);
            }
          } catch (err) {
            console.warn('[st8] Failed to parse mutation event:', err);
          }
        };

        mutationSource.onerror = function() {
          console.warn('[st8] Mutation stream disconnected — will auto-reconnect');
          mutationSource.close();
          mutationSource = null;

          // Exponential backoff reconnection
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(function() {
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
            connect();
          }, reconnectDelay);
        };
      }

      // Initial connection
      connect();

      // Expose for debugging
      window.st8MutationStream = {
        reconnect: connect,
        close: function() {
          clearTimeout(reconnectTimer);
          if (mutationSource) { mutationSource.close(); mutationSource = null; }
        }
      };
    })();
