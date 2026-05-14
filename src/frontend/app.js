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
            const self = this;
            const hoist = function() {
              const titlebar = self.column.querySelector('.panel-titlebar');
              if (!titlebar) return;
              const fresh = self.host.querySelector('.explorer-error-banner');
              titlebar.querySelectorAll('.explorer-error-banner').forEach(function(n) {
                if (n !== fresh) n.parentNode.removeChild(n);
              });
              if (fresh) titlebar.appendChild(fresh);
            };
            hoist();
            new MutationObserver(hoist).observe(this.host, { childList: true, subtree: true });
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

    // From any flanking panel, ESC returns to st8 center (matches the
    // "diamond closest to st8" semantic). Skip when the phreak TUI is
    // active — it has its own ESC behavior.
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Escape') return;
      if (window.PhreakTerminal && window.PhreakTerminal.getState && window.PhreakTerminal.getState().isTUI) return;
      const current = strip && strip.getAttribute('data-active');
      if (current && current !== 'st8') slideTo('st8');
    });

    // ─── PRD WIZARD ─────────────────────────────────────────
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
        // Unload void-engine if it was loaded
        if (window.unloadVoidEngine) window.unloadVoidEngine();
      } else if (wsType === 'pretext-dev') {
        // Activate pretext development mode — load void-engine
        voidEl.classList.remove('split-mode');
        // Remove right panel if exists
        const rightPanel = voidEl.querySelector('.void-right-panel');
        if (rightPanel) rightPanel.remove();
        // Stop coordination polling
        if (window.St8Coordination) {
          window.St8Coordination.stopPolling();
        }
        // Load void-engine for pretext workspace
        if (window.loadVoidEngine) {
          window.loadVoidEngine().then(() => {
            console.info('[st8] void-engine loaded for pretext-dev workspace');
          }).catch(err => {
            console.error('[st8] failed to load void-engine:', err);
          });
        }
      } else {
        // Deactivate split mode (standard workspace)
        voidEl.classList.remove('split-mode');
        // Remove right panel
        const rightPanel = voidEl.querySelector('.void-right-panel');
        if (rightPanel) rightPanel.remove();
        // Stop coordination polling
        if (window.St8Coordination) {
          window.St8Coordination.stopPolling();
        }
        // Unload void-engine if it was loaded
        if (window.unloadVoidEngine) window.unloadVoidEngine();
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
        '</div>' +
      '</div>';

      document.body.appendChild(overlay);
    }

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
