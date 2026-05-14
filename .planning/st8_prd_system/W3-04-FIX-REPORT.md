# W3-04 Fix Report: SSE Mutation Integration → Phreak Terminal TUI

## Summary

Wired the existing SSE mutation stream (`/api/mutations`) to also surface mutation events in the phreak terminal TUI, in addition to the existing toast notifications.

## Integration Pattern

**Two-point wiring:** Added a `notifyMutation()` handler to phreak-terminal.js and called it from the SSE `onmessage` handler in st8.html.

## Changes

### 1. `phreak-terminal.js` — New `notifyMutation()` function

**Lines 829–864** (new section, inserted before EPO bus listener)

```js
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
```

**Format:** `[MUTATION] {type} {filepath} {HH:MM:SS}`

**Color mapping (line type → CSS):**
| Mutation Type | Line Type | CSS Class | Color |
|---------------|-----------|-----------|-------|
| CREATE | system | `.phreak-line--system .phreak-text` | gold (`--gold: #D4AF37`) |
| EDIT | stdout | `.phreak-line--stdout .phreak-text` | cyan (`--cyan: #1FBDEA`) |
| LOCK | stderr | `.phreak-line--stderr .phreak-text` | pink (`--pink: #C9748F`) |
| Other | system | `.phreak-line--system .phreak-text` | gold (default) |

### 2. `phreak-terminal.js` — Public API exposure

**Line 1040** (inside `window.PhreakTerminal` object)

```js
notifyMutation: notifyMutation,
```

### 3. `st8.html` — SSE handler wiring

**Lines 2101–2104** (inside `mutationSource.onmessage`, after `showMutationToast(data)`)

```js
// Surface mutation in phreak terminal TUI
if (window.PhreakTerminal && window.PhreakTerminal.notifyMutation) {
  window.PhreakTerminal.notifyMutation(data);
}
```

## Error Reporting

- `notifyMutation()` guards against null `data` (line 836: `if (!data) return;`)
- Time parsing wrapped in try/catch (lines 846–850) — falls back to empty string on malformed timestamps
- SSE handler in st8.html uses optional chaining guard (`window.PhreakTerminal && window.PhreakTerminal.notifyMutation`) — no error if phreak-terminal.js fails to load
- The existing SSE `onerror` handler (st8.html lines 2111–2122) covers connection failures with exponential backoff reconnection

## Data Flow

```
Backend /api/mutations (SSE)
  → EventSource onmessage (st8.html:2086)
    → showMutationToast(data)           // toast notification (existing)
    → PhreakTerminal.notifyMutation(data) // terminal line (NEW)
      → _mkLine(lineType, formattedMsg)
      → _renderLines()  // append-only DOM render
```

## Wiring Confirmation

- [x] `notifyMutation()` function exists in phreak-terminal.js (line 835)
- [x] `notifyMutation` exposed in `window.PhreakTerminal` API (line 1040)
- [x] SSE `onmessage` calls `PhreakTerminal.notifyMutation(data)` (st8.html line 2102)
- [x] Null guard on data parameter
- [x] Time parsing error handling
- [x] Guard against missing `PhreakTerminal` global
- [x] Uses existing `_mkLine` + `_renderLines` pipeline (append-only, no full re-render)
- [x] Color mapping follows st8 design tokens (gold/cyan/pink)
