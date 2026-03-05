import Sigma from 'sigma';
import Graph from 'graphology';
import dagre from 'dagre';
import {
  masterGraph,
  getVisState,
  handleNodeClick,
  createEmptyState,
  COLORS,
} from '../shared';
import type { GraphState } from '../shared';

let state: GraphState = createEmptyState();

/** Render/update the selection legend overlay */
function renderLegend() {
  let overlay = document.getElementById('selection-legend');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'selection-legend';
    overlay.style.cssText =
      'position:fixed;bottom:20px;left:20px;background:rgba(26,26,46,0.9);' +
      'border:1px solid #333;border-radius:8px;padding:12px 16px;color:#ccc;' +
      'font-family:sans-serif;font-size:13px;max-width:300px;pointer-events:none;z-index:10;';
    document.body.appendChild(overlay);
  }

  const { nodes } = getVisState(masterGraph, state);
  const selDomains = nodes.filter(n => n.tier === 'domain' && n.selected);
  const selCategories = nodes.filter(n => n.tier === 'category' && n.selected);
  const selEntities = nodes.filter(n => n.tier === 'entity' && n.selected);

  if (selDomains.length === 0) {
    overlay.innerHTML = '<span style="color:#666">Click a node to select it</span>';
    return;
  }

  const domainList = selDomains.map(n =>
    `<span style="color:${COLORS.domain.selected}">${n.label}</span>`).join(', ');
  const catList = selCategories.map(n =>
    `<span style="color:${COLORS.category.selected}">${n.label}</span>`).join(', ');
  const entityList = selEntities.map(n =>
    `${n.label} <span style="color:${COLORS.edge.active}">[${n.pathCount}]</span>`).join('<br>');

  overlay.innerHTML = `
    <div style="color:#fff;font-weight:bold;margin-bottom:4px">Selected: ${domainList}</div>
    <div style="margin-bottom:4px;font-size:11px">Categories: ${catList || '<span style="color:#666">none</span>'}</div>
    <div>${entityList || '<span style="color:#666">No entities active</span>'}</div>
  `;
}

/** Compute dagre layout and return positions keyed by node id */
function computeLayout(nodeIds: string[], edges: { from: string; to: string }[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const id of nodeIds) {
    g.setNode(id, { width: 50, height: 50 });
  }
  for (const e of edges) {
    g.setEdge(e.from, e.to);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of nodeIds) {
    const node = g.node(id);
    positions.set(id, { x: node.x, y: node.y });
  }
  return positions;
}

function buildGraph(): Graph {
  const vis = getVisState(masterGraph, state);
  const graph = new Graph();

  // Compute layout positions
  const allEdges = [
    ...masterGraph.domainToCategory,
    ...masterGraph.categoryToEntity,
  ];
  const positions = computeLayout(
    vis.nodes.map(n => n.id),
    allEdges,
  );

  // Add nodes
  for (const node of vis.nodes) {
    const pos = positions.get(node.id)!;
    const bgColor = node.selected
      ? COLORS[node.tier].selected
      : COLORS[node.tier].unselected;
    const displayLabel =
      node.pathCount > 0
        ? `${node.label} [${node.pathCount}]`
        : node.label;

    graph.addNode(node.id, {
      x: pos.x,
      y: -pos.y,
      size: node.tier === 'domain' ? 18 : node.tier === 'category' ? 14 : 10,
      color: bgColor,
      label: displayLabel,
      tier: node.tier,
      selected: node.selected,
      borderColor: node.selected ? bgColor : '#444',
    });
  }

  // Add edges
  for (const edge of vis.edges) {
    graph.addEdge(edge.from, edge.to, {
      color: edge.active ? COLORS.edge.active : COLORS.edge.inactive,
      size: edge.active ? 2.5 : 1,
      type: 'arrow',
    });
  }

  return graph;
}

let graph = buildGraph();

const container = document.getElementById('graph')!;
const renderer = new Sigma(graph, container, {
  renderEdgeLabels: false,
  defaultEdgeType: 'arrow',
  labelColor: { color: COLORS.text.selected },
  labelRenderedSizeThreshold: 0,
  defaultNodeColor: COLORS.category.unselected,
  stagePadding: 40,
  nodeReducer: (node, data) => {
    return {
      ...data,
      labelColor: data.selected ? COLORS.text.selected : COLORS.text.unselected,
    };
  },
  edgeReducer: (_edge, data) => {
    return { ...data };
  },
});

function updateVisualization() {
  const vis = getVisState(masterGraph, state);

  // Update node attributes
  for (const node of vis.nodes) {
    const bgColor = node.selected
      ? COLORS[node.tier].selected
      : COLORS[node.tier].unselected;
    const displayLabel =
      node.pathCount > 0
        ? `${node.label} [${node.pathCount}]`
        : node.label;

    graph.setNodeAttribute(node.id, 'color', bgColor);
    graph.setNodeAttribute(node.id, 'label', displayLabel);
    graph.setNodeAttribute(node.id, 'selected', node.selected);
    graph.setNodeAttribute(node.id, 'borderColor', node.selected ? bgColor : '#444');
  }

  // Update edge attributes
  for (const edge of vis.edges) {
    const edgeKey = graph.edge(edge.from, edge.to);
    if (edgeKey) {
      graph.setEdgeAttribute(edgeKey, 'color', edge.active ? COLORS.edge.active : COLORS.edge.inactive);
      graph.setEdgeAttribute(edgeKey, 'size', edge.active ? 2.5 : 1);
    }
  }

  renderLegend();
}

renderLegend();

// Handle clicks
renderer.on('clickNode', ({ node }) => {
  state = handleNodeClick(masterGraph, state, node);
  updateVisualization();
  window.parent.postMessage({ type: 'node-clicked', nodeId: node }, '*');
});

// Expose for CDP testing
(window as any).__sigmaState = () => state;
(window as any).__sigmaClick = (nodeId: string) => {
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
