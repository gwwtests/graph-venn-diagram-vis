import * as d3 from 'd3';
import { graphStratify, sugiyama } from 'd3-dag';
import {
  masterGraph,
  getVisState,
  handleNodeClick,
  createEmptyState,
  COLORS,
} from '../shared';
import type { GraphState, VisNode, VisEdge } from '../shared';

let state: GraphState = createEmptyState();

// Build d3-dag input data from our graph
function buildStratifyData() {
  const data: { id: string; parentIds: string[] }[] = [];

  for (const d of masterGraph.domains) {
    data.push({ id: d.id, parentIds: [] });
  }
  for (const c of masterGraph.categories) {
    const parents = masterGraph.domainToCategory
      .filter((e) => e.to === c.id)
      .map((e) => e.from);
    data.push({ id: c.id, parentIds: parents });
  }
  for (const e of masterGraph.entities) {
    const parents = masterGraph.categoryToEntity
      .filter((edge) => edge.to === e.id)
      .map((edge) => edge.from);
    data.push({ id: e.id, parentIds: parents });
  }

  return data;
}

// Compute layout once — positions are static
const stratifyData = buildStratifyData();
const dagGraph = graphStratify()(stratifyData);
const layout = sugiyama();
const { width: dagWidth, height: dagHeight } = layout(dagGraph);

// Extract positions into a map
const positions = new Map<string, { x: number; y: number }>();
for (const node of dagGraph.nodes()) {
  positions.set(node.data.id, { x: node.x, y: node.y });
}

// Extract link points
interface LinkData {
  sourceId: string;
  targetId: string;
  points: [number, number][];
}
const linkDataList: LinkData[] = [];
for (const link of dagGraph.links()) {
  linkDataList.push({
    sourceId: link.source.data.id,
    targetId: link.target.data.id,
    points: link.points as [number, number][],
  });
}

// Scale positions to fit viewport with padding
const PADDING = 60;
const NODE_RADIUS = 22;

function getScale() {
  const container = document.getElementById('graph')!;
  const w = container.clientWidth;
  const h = container.clientHeight;
  const scaleX = (w - PADDING * 2) / (dagWidth || 1);
  const scaleY = (h - PADDING * 2) / (dagHeight || 1);
  return { scaleX, scaleY, w, h };
}

function scaledPos(id: string) {
  const pos = positions.get(id)!;
  const { scaleX, scaleY } = getScale();
  return {
    x: PADDING + pos.x * scaleX,
    y: PADDING + pos.y * scaleY,
  };
}

// Create SVG
const container = document.getElementById('graph')!;
const svg = d3
  .select(container)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .style('background', COLORS.background);

// Arrow marker
svg
  .append('defs')
  .append('marker')
  .attr('id', 'arrow-active')
  .attr('viewBox', '0 0 10 6')
  .attr('refX', 10)
  .attr('refY', 3)
  .attr('markerWidth', 8)
  .attr('markerHeight', 6)
  .attr('orient', 'auto')
  .append('path')
  .attr('d', 'M0,0 L10,3 L0,6 Z')
  .attr('fill', COLORS.edge.active);

svg
  .select('defs')
  .append('marker')
  .attr('id', 'arrow-inactive')
  .attr('viewBox', '0 0 10 6')
  .attr('refX', 10)
  .attr('refY', 3)
  .attr('markerWidth', 8)
  .attr('markerHeight', 6)
  .attr('orient', 'auto')
  .append('path')
  .attr('d', 'M0,0 L10,3 L0,6 Z')
  .attr('fill', COLORS.edge.inactive);

// Groups for edges and nodes (edges behind nodes)
const edgeGroup = svg.append('g').attr('class', 'edges');
const nodeGroup = svg.append('g').attr('class', 'nodes');

// Build a line generator for link points
const lineGen = d3
  .line<[number, number]>()
  .x((d) => {
    const { scaleX } = getScale();
    return PADDING + d[0] * scaleX;
  })
  .y((d) => {
    const { scaleY } = getScale();
    return PADDING + d[1] * scaleY;
  })
  .curve(d3.curveBasis);

function tierForId(id: string): 'domain' | 'category' | 'entity' {
  if (id.startsWith('d')) return 'domain';
  if (id.startsWith('c')) return 'category';
  return 'entity';
}

// Build lookup from vis state
function getNodeMap(nodes: VisNode[]): Map<string, VisNode> {
  const m = new Map<string, VisNode>();
  for (const n of nodes) m.set(n.id, n);
  return m;
}

// Build lookup for edges by "from->to"
function getEdgeMap(edges: VisEdge[]): Map<string, VisEdge> {
  const m = new Map<string, VisEdge>();
  for (const e of edges) m.set(`${e.from}->${e.to}`, e);
  return m;
}

function render() {
  const vis = getVisState(masterGraph, state);
  const nodeMap = getNodeMap(vis.nodes);
  const edgeMap = getEdgeMap(vis.edges);

  // --- EDGES ---
  const edgeSel = edgeGroup
    .selectAll<SVGPathElement, LinkData>('path')
    .data(linkDataList, (d) => `${d.sourceId}->${d.targetId}`);

  // Enter
  const edgeEnter = edgeSel
    .enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke-width', 2);

  // Update + Enter
  edgeEnter.merge(edgeSel).each(function (d) {
    const edge = edgeMap.get(`${d.sourceId}->${d.targetId}`);
    const active = edge?.active ?? false;
    const color = active ? COLORS.edge.active : COLORS.edge.inactive;
    const markerId = active ? 'arrow-active' : 'arrow-inactive';

    d3.select(this)
      .attr('d', lineGen(d.points))
      .attr('stroke', color)
      .attr('marker-end', `url(#${markerId})`);
  });

  // --- NODES ---
  const nodeData = Array.from(positions.keys()).map((id) => ({
    id,
    ...scaledPos(id),
  }));

  const nodeSel = nodeGroup
    .selectAll<SVGGElement, (typeof nodeData)[0]>('g.node')
    .data(nodeData, (d) => d.id);

  // Enter
  const nodeEnter = nodeSel.enter().append('g').attr('class', 'node');

  nodeEnter.append('circle').attr('r', NODE_RADIUS);

  nodeEnter
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', '10px')
    .attr('pointer-events', 'none');

  nodeEnter.style('cursor', 'pointer').on('click', function (_event, d) {
    state = handleNodeClick(masterGraph, state, d.id);
    render();
    window.parent.postMessage({ type: 'node-clicked', nodeId: d.id }, '*');
  });

  // Update + Enter
  const allNodes = nodeEnter.merge(nodeSel);

  allNodes.attr('transform', (d) => `translate(${d.x},${d.y})`);

  allNodes.select('circle').each(function (d) {
    const node = nodeMap.get(d.id);
    if (!node) return;
    const bgColor = node.selected
      ? COLORS[node.tier].selected
      : COLORS[node.tier].unselected;
    const borderColor = node.selected ? bgColor : '#444';

    d3.select(this)
      .attr('fill', bgColor)
      .attr('stroke', borderColor)
      .attr('stroke-width', 2);
  });

  allNodes.select('text').each(function (d) {
    const node = nodeMap.get(d.id);
    if (!node) return;
    const textColor = node.selected
      ? COLORS.text.selected
      : COLORS.text.unselected;
    const displayLabel =
      node.pathCount > 0
        ? `${node.label} [${node.pathCount}]`
        : node.label;

    d3.select(this).text(displayLabel).attr('fill', textColor);
  });
}

// Initial render
render();

// Re-render on resize (getScale() reads container dimensions dynamically)
window.addEventListener('resize', () => render());

// Expose for CDP testing
(window as any).__d3dagState = () => state;
(window as any).__d3dagClick = (nodeId: string) => {
  state = handleNodeClick(masterGraph, state, nodeId);
  render();
};

// ─── postMessage support for dual-all iframe embedding ──────────────
window.addEventListener('message', (e) => {
  if (e.data?.type === 'sync-select' && e.data.nodeId) {
    state = handleNodeClick(masterGraph, state, e.data.nodeId);
    render();
  }
});
