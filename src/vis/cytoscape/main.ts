import cytoscape from 'cytoscape';
import cytoscapeDagre from 'cytoscape-dagre';
import {
  masterGraph,
  getVisState,
  handleNodeClick,
  createEmptyState,
  COLORS,
} from '../shared';
import type { GraphState } from '../shared';

// Register dagre layout
cytoscape.use(cytoscapeDagre);

let state: GraphState = createEmptyState();

function buildElements() {
  const vis = getVisState(masterGraph, state);
  const elements: cytoscape.ElementDefinition[] = [];

  for (const node of vis.nodes) {
    const bgColor = node.selected
      ? COLORS[node.tier].selected
      : COLORS[node.tier].unselected;
    const textColor = node.selected
      ? COLORS.text.selected
      : COLORS.text.unselected;
    const displayLabel =
      node.pathCount > 0
        ? `${node.label} [${node.pathCount}]`
        : node.label;

    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label: displayLabel,
        tier: node.tier,
        bgColor,
        textColor,
        borderColor: node.selected ? bgColor : '#444',
      },
    });
  }

  for (const edge of vis.edges) {
    elements.push({
      group: 'edges',
      data: {
        id: `${edge.from}->${edge.to}`,
        source: edge.from,
        target: edge.to,
        lineColor: edge.active ? COLORS.edge.active : COLORS.edge.inactive,
      },
    });
  }

  return elements;
}

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: buildElements(),
  style: [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'background-color': 'data(bgColor)',
        color: 'data(textColor)',
        'border-width': 2,
        'border-color': 'data(borderColor)',
        'font-size': '12px',
        width: 40,
        height: 40,
        'text-wrap': 'wrap',
        'text-max-width': '80px',
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': 'data(lineColor)',
        'target-arrow-color': 'data(lineColor)',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        width: 2,
      },
    },
  ],
  layout: {
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 60,
    rankSep: 80,
    padding: 30,
  } as any,
});

function updateVisualization() {
  const elements = buildElements();
  cy.json({ elements });
  const layout = cy.layout({
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 60,
    rankSep: 80,
    padding: 30,
  } as any);
  layout.run();
}

cy.on('tap', 'node', (evt) => {
  const nodeId = evt.target.id();
  state = handleNodeClick(masterGraph, state, nodeId);
  updateVisualization();
  window.parent.postMessage({ type: 'node-clicked', nodeId }, '*');
});

// Expose for CDP testing
(window as any).__cyState = () => state;
(window as any).__cyClick = (nodeId: string) => {
  state = handleNodeClick(masterGraph, state, nodeId);
  updateVisualization();
};

// ─── postMessage support for dual-all iframe embedding ──────────────
window.addEventListener('message', (e) => {
  if (e.data?.type === 'sync-select' && e.data.nodeId) {
    state = handleNodeClick(masterGraph, state, e.data.nodeId);
    updateVisualization();
  }
});
