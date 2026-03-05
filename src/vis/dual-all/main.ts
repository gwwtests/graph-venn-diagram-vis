/**
 * Dual-All: iframe-based dual panel with switchable renderers.
 *
 * Each panel loads a standalone viz via iframe. Selection state is
 * synchronized between panels using postMessage:
 *   iframe -> parent: {type: "node-clicked", nodeId}
 *   parent -> iframe: {type: "sync-select", nodeId}
 */

// Available renderers — label and relative path to index.html
const RENDERERS: { id: string; label: string; httpOnly?: boolean }[] = [
  { id: 'visnetwork', label: 'vis-network (hierarchical)' },
  { id: 'venn-enhanced', label: 'Enhanced Venn' },
  { id: 'cytoscape', label: 'Cytoscape.js + dagre' },
  { id: 'd3dag', label: 'D3.js + d3-dag (Sugiyama)' },
  { id: 'forcegraph', label: 'force-graph (vasturiano)' },
  { id: 'sigma', label: 'Sigma.js v3' },
  { id: 'reagraph', label: 'reagraph (WebGL/React)' },
  { id: 'venn', label: 'Venn Diagram (basic)' },
  { id: 'dual-v1', label: 'Dual Panel v1 (DAG + Venn)' },
  { id: 'orb', label: '@memgraph/orb + dagre', httpOnly: true },
];

const DEFAULT_LEFT = 'visnetwork';
const DEFAULT_RIGHT = 'venn-enhanced';

// Elements
const selectLeft = document.getElementById('select-left') as HTMLSelectElement;
const selectRight = document.getElementById('select-right') as HTMLSelectElement;
const iframeLeft = document.getElementById('iframe-left') as HTMLIFrameElement;
const iframeRight = document.getElementById('iframe-right') as HTMLIFrameElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

// Determine base URL for iframe sources.
// In snapshot mode (file:// or served from demos dir), vizs are sibling dirs.
// In dev mode (vite dev server), they are on separate ports.
function resolveVizUrl(vizId: string): string {
  // Check if we're in a snapshot directory structure:
  // The dual-all page is at .../dual-all/index.html
  // Sibling vizs are at ../{vizId}/index.html
  return `../${vizId}/index.html`;
}

// Populate dropdowns
function populateSelect(select: HTMLSelectElement, defaultValue: string) {
  const isFileProtocol = window.location.protocol === 'file:';
  for (const r of RENDERERS) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.label;
    if (r.httpOnly && isFileProtocol) {
      opt.textContent += ' (HTTP only)';
      opt.disabled = true;
    }
    select.appendChild(opt);
  }
  select.value = defaultValue;
}

populateSelect(selectLeft, DEFAULT_LEFT);
populateSelect(selectRight, DEFAULT_RIGHT);

// Load iframe
function loadIframe(iframe: HTMLIFrameElement, vizId: string) {
  const url = resolveVizUrl(vizId);
  iframe.src = url;
}

// Initial load
loadIframe(iframeLeft, DEFAULT_LEFT);
loadIframe(iframeRight, DEFAULT_RIGHT);

// Dropdown change handlers
selectLeft.addEventListener('change', () => {
  loadIframe(iframeLeft, selectLeft.value);
});
selectRight.addEventListener('change', () => {
  loadIframe(iframeRight, selectRight.value);
});

// ─── postMessage relay for selection sync ────────────────────────────

// Track which iframe sent the last message to avoid echo loops
let relaying = false;

window.addEventListener('message', (e) => {
  if (relaying) return;
  if (e.data?.type !== 'node-clicked') return;

  const nodeId = e.data.nodeId;
  if (!nodeId) return;

  relaying = true;

  // Determine which iframe sent the message, relay to the other
  const source = e.source;
  if (source === iframeLeft.contentWindow) {
    iframeRight.contentWindow?.postMessage({ type: 'sync-select', nodeId }, '*');
  } else if (source === iframeRight.contentWindow) {
    iframeLeft.contentWindow?.postMessage({ type: 'sync-select', nodeId }, '*');
  }

  relaying = false;
});

// Reset button: reload both iframes to clear state
btnReset.addEventListener('click', () => {
  loadIframe(iframeLeft, selectLeft.value);
  loadIframe(iframeRight, selectRight.value);
});

// ─── CDP Testing Hooks ──────────────────────────────────────────────

(window as any).__dualAllState = () => ({
  left: selectLeft.value,
  right: selectRight.value,
});
(window as any).__dualAllSetLeft = (vizId: string) => {
  selectLeft.value = vizId;
  loadIframe(iframeLeft, vizId);
};
(window as any).__dualAllSetRight = (vizId: string) => {
  selectRight.value = vizId;
  loadIframe(iframeRight, vizId);
};
