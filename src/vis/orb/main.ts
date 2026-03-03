import { Orb, OrbEventType } from '@memgraph/orb';
import type { INodeBase, IEdgeBase } from '@memgraph/orb';
import dagre from 'dagre';
import {
  masterGraph,
  getVisState,
  handleNodeClick,
  createEmptyState,
  COLORS,
} from '../shared';
import type { GraphState } from '../shared';

interface OrbNode extends INodeBase {
  id: string;
  label: string;
  tier: 'domain' | 'category' | 'entity';
  selected: boolean;
  pathCount: number;
}

interface OrbEdge extends IEdgeBase {
  id: string;
  start: string;
  end: string;
  active: boolean;
}

let state: GraphState = createEmptyState();

// Compute dagre layout positions
function computeDagrePositions(
  nodes: { id: string; tier: string }[],
  edges: { from: string; to: string }[]
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80, marginx: 30, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: 60, height: 40 });
  }
  for (const edge of edges) {
    g.setEdge(edge.from, edge.to);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    positions.set(node.id, { x: pos.x, y: pos.y });
  }
  return positions;
}

function buildGraphData() {
  const vis = getVisState(masterGraph, state);

  const nodes: OrbNode[] = vis.nodes.map((n) => ({
    id: n.id,
    label: n.pathCount > 0 ? `${n.label} [${n.pathCount}]` : n.label,
    tier: n.tier,
    selected: n.selected,
    pathCount: n.pathCount,
  }));

  const edges: OrbEdge[] = vis.edges.map((e, i) => ({
    id: `e${i}`,
    start: e.from,
    end: e.to,
    active: e.active,
  }));

  return { nodes, edges };
}

const container = document.getElementById('graph')!;

const orb = new Orb<OrbNode, OrbEdge>(container);

// Style nodes by tier and selection state
orb.data.setDefaultStyle({
  getNodeStyle(node) {
    const tier = node.data.tier;
    const selected = node.data.selected;
    return {
      size: tier === 'domain' ? 18 : tier === 'category' ? 14 : 12,
      color: selected ? COLORS[tier].selected : COLORS[tier].unselected,
      borderColor: selected ? COLORS[tier].selected : '#444',
      borderWidth: 2,
      borderWidthSelected: 3,
      fontSize: 12,
      fontColor: selected ? COLORS.text.selected : COLORS.text.unselected,
      label: node.data.label,
      shape: tier === 'domain' ? 'square' as any : 'circle' as any,
    };
  },
  getEdgeStyle(edge) {
    const active = edge.data.active;
    return {
      color: active ? COLORS.edge.active : COLORS.edge.inactive,
      width: active ? 2 : 1,
      arrowSize: 6,
      fontSize: 0,
    };
  },
});

// Initial data load
const initial = buildGraphData();
orb.data.setup({ nodes: initial.nodes, edges: initial.edges });

// Compute dagre layout and apply positions
function applyDagreLayout() {
  const vis = getVisState(masterGraph, state);
  const allEdges = [
    ...masterGraph.domainToCategory,
    ...masterGraph.categoryToEntity,
  ];
  const positions = computeDagrePositions(
    vis.nodes.map((n) => ({ id: n.id, tier: n.tier })),
    allEdges
  );

  const nodePositions = Array.from(positions.entries()).map(([id, pos]) => ({
    id,
    x: pos.x,
    y: pos.y,
  }));

  orb.data.setNodePositions(nodePositions);
}

applyDagreLayout();

// Render with recenter to fit graph in view
orb.view.render(() => {
  orb.view.recenter();
});

// Handle node clicks
orb.events.on(OrbEventType.NODE_CLICK, (event) => {
  const nodeId = event.node.data.id;
  state = handleNodeClick(masterGraph, state, nodeId);
  refreshVisualization();
});

function refreshVisualization() {
  const data = buildGraphData();
  orb.data.setup({ nodes: data.nodes, edges: data.edges });
  applyDagreLayout();
  orb.view.render(() => {
    orb.view.recenter();
  });
}

// Expose for CDP testing
(window as any).__orbState = () => state;
(window as any).__orbClick = (nodeId: string) => {
  state = handleNodeClick(masterGraph, state, nodeId);
  refreshVisualization();
};
