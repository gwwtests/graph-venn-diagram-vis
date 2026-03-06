import { Network, DataSet } from 'vis-network/standalone';
import {
  masterGraph,
  COLORS,
  getVisState,
  handleNodeClick,
  createEmptyState,
} from '../shared';
import type { GraphState, VisNode, VisEdge } from '../shared';

let state: GraphState = createEmptyState();

function tierToLevel(tier: string): number {
  if (tier === 'domain') return 0;
  if (tier === 'category') return 1;
  return 2; // entity
}

function buildNodeData(node: VisNode) {
  const color = COLORS[node.tier];
  const sel = node.selected;
  return {
    id: node.id,
    label: node.tier === 'entity' && node.pathCount > 0
      ? `${node.label} (${node.pathCount})`
      : node.label,
    level: tierToLevel(node.tier),
    color: {
      background: sel ? color.selected : color.unselected,
      border: sel ? color.selected : '#444',
      highlight: { background: color.selected, border: color.selected },
    },
    font: {
      color: sel ? COLORS.text.selected : COLORS.text.unselected,
      size: node.tier === 'domain' ? 16 : node.tier === 'category' ? 14 : 12,
    },
    shape: node.tier === 'domain' ? 'diamond' : node.tier === 'category' ? 'box' : 'ellipse',
    size: node.tier === 'domain' ? 25 : node.tier === 'category' ? 20 : 15,
    borderWidth: sel ? 2 : 1,
  };
}

function buildEdgeData(edge: VisEdge, idx: number) {
  return {
    id: `e${idx}`,
    from: edge.from,
    to: edge.to,
    color: { color: edge.active ? COLORS.edge.active : COLORS.edge.inactive },
    width: edge.active ? 2 : 1,
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
    smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
  };
}

const container = document.getElementById('graph')!;

// Initial vis state
const visState = getVisState(masterGraph, state);

const nodesDS = new DataSet(visState.nodes.map(n => buildNodeData(n)));
const edgesDS = new DataSet(visState.edges.map((e, i) => buildEdgeData(e, i)));

// Compute level separation to use available height (3 tiers = 2 gaps)
function computeLevelSep() {
  const h = container.clientHeight;
  // Reserve ~30% for node sizes + padding, split rest into 2 gaps
  return Math.max(80, Math.floor(h * 0.7 / 2));
}

function getLayoutOptions() {
  return {
    hierarchical: {
      direction: 'UD' as const,
      sortMethod: 'directed' as const,
      levelSeparation: computeLevelSep(),
      nodeSpacing: 100,
      treeSpacing: 80,
    },
  };
}

const network = new Network(container, { nodes: nodesDS, edges: edgesDS }, {
  layout: getLayoutOptions(),
  physics: false,
  interaction: {
    hover: true,
    tooltipDelay: 200,
  },
  nodes: {
    borderWidth: 1,
    shadow: false,
  },
  edges: {
    smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 },
  },
});

// Fit graph to container after initial draw
network.once('afterDrawing', () => network.fit({ animation: false }));

// Re-layout and fit on resize
let resizeTimer: ReturnType<typeof setTimeout>;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    network.setSize(container.clientWidth + 'px', container.clientHeight + 'px');
    network.setOptions({ layout: getLayoutOptions() });
    network.fit();
  }, 150);
});

function refresh() {
  const vs = getVisState(masterGraph, state);
  // Update nodes
  for (const n of vs.nodes) {
    nodesDS.update(buildNodeData(n));
  }
  // Update edges
  for (let i = 0; i < vs.edges.length; i++) {
    edgesDS.update(buildEdgeData(vs.edges[i], i));
  }
}

network.on('click', (params: { nodes: string[] }) => {
  if (params.nodes.length > 0) {
    const nodeId = params.nodes[0];
    state = handleNodeClick(masterGraph, state, nodeId);
    refresh();
    window.parent.postMessage({ type: 'node-clicked', nodeId }, '*');
  }
});

// Expose for CDP testing
(window as any).__clickNode = (nodeId: string) => {
  state = handleNodeClick(masterGraph, state, nodeId);
  refresh();
};

// ─── postMessage support for dual-all iframe embedding ──────────────
window.addEventListener('message', (e) => {
  if (e.data?.type === 'sync-select' && e.data.nodeId) {
    state = handleNodeClick(masterGraph, state, e.data.nodeId);
    refresh();
  }
});
