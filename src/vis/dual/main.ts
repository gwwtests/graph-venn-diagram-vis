/**
 * Dual-Panel Synchronized View
 *
 * Left/Top: D3 + d3-dag DAG visualization
 * Right/Bottom: upsetjs/venn.js Venn diagram
 * Both share a single GraphState via the engine.
 */
import * as d3 from 'd3';
import { graphStratify, sugiyama } from 'd3-dag';
import * as venn from '@upsetjs/venn.js';
import {
  masterGraph,
  getVisState,
  handleNodeClick,
  createEmptyState,
  COLORS,
  type DagGraph,
  type GraphState,
  type VisNode,
  type VisEdge,
} from '../shared';

// ─── Shared State ───────────────────────────────────────────────────
let state: GraphState = createEmptyState();
const graph = masterGraph;

function onStateChange(nodeId: string) {
  state = handleNodeClick(graph, state, nodeId);
  renderDag();
  renderVenn();
  renderEntityOverlay();
}

function resetState() {
  state = createEmptyState();
  renderDag();
  renderVenn();
  renderEntityOverlay();
}

// ─── DAG Panel (D3 + d3-dag) ───────────────────────────────────────

// Compute Sugiyama layout once (static positions)
function buildStratifyData() {
  const data: { id: string; parentIds: string[] }[] = [];
  for (const d of graph.domains) data.push({ id: d.id, parentIds: [] });
  for (const c of graph.categories) {
    const parents = graph.domainToCategory
      .filter(e => e.to === c.id)
      .map(e => e.from);
    data.push({ id: c.id, parentIds: parents });
  }
  for (const e of graph.entities) {
    const parents = graph.categoryToEntity
      .filter(edge => edge.to === e.id)
      .map(edge => edge.from);
    data.push({ id: e.id, parentIds: parents });
  }
  return data;
}

const dagData = graphStratify()(buildStratifyData());
const layoutResult = sugiyama()(dagData);
const dagWidth = layoutResult.width;
const dagHeight = layoutResult.height;

const dagPositions = new Map<string, { x: number; y: number }>();
for (const node of dagData.nodes()) {
  dagPositions.set(node.data.id, { x: node.x, y: node.y });
}

interface LinkData {
  sourceId: string;
  targetId: string;
  points: [number, number][];
}
const dagLinks: LinkData[] = [];
for (const link of dagData.links()) {
  dagLinks.push({
    sourceId: link.source.data.id,
    targetId: link.target.data.id,
    points: link.points as [number, number][],
  });
}

const PADDING = 50;
const NODE_RADIUS = 20;

function getDagScale() {
  const container = document.getElementById('dag-content')!;
  const w = container.clientWidth;
  const h = container.clientHeight;
  const scaleX = (w - PADDING * 2) / (dagWidth || 1);
  const scaleY = (h - PADDING * 2) / (dagHeight || 1);
  return { scaleX, scaleY, w, h };
}

function dagScaledPos(id: string) {
  const pos = dagPositions.get(id)!;
  const { scaleX, scaleY } = getDagScale();
  return { x: PADDING + pos.x * scaleX, y: PADDING + pos.y * scaleY };
}

// Create DAG SVG
const dagContainer = document.getElementById('dag-content')!;
const dagSvg = d3.select(dagContainer)
  .append('svg')
  .attr('width', '100%')
  .attr('height', '100%')
  .style('background', COLORS.background);

// Arrow markers
const defs = dagSvg.append('defs');
for (const [id, color] of [['arrow-active', COLORS.edge.active], ['arrow-inactive', COLORS.edge.inactive]]) {
  defs.append('marker')
    .attr('id', id)
    .attr('viewBox', '0 0 10 6')
    .attr('refX', 10)
    .attr('refY', 3)
    .attr('markerWidth', 8)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,0 L10,3 L0,6 Z')
    .attr('fill', color);
}

const dagEdgeGroup = dagSvg.append('g').attr('class', 'edges');
const dagNodeGroup = dagSvg.append('g').attr('class', 'nodes');

const dagLineGen = d3.line<[number, number]>()
  .x(d => {
    const { scaleX } = getDagScale();
    return PADDING + d[0] * scaleX;
  })
  .y(d => {
    const { scaleY } = getDagScale();
    return PADDING + d[1] * scaleY;
  })
  .curve(d3.curveBasis);

function getNodeMap(nodes: VisNode[]): Map<string, VisNode> {
  const m = new Map<string, VisNode>();
  for (const n of nodes) m.set(n.id, n);
  return m;
}

function getEdgeMap(edges: VisEdge[]): Map<string, VisEdge> {
  const m = new Map<string, VisEdge>();
  for (const e of edges) m.set(`${e.from}->${e.to}`, e);
  return m;
}

function renderDag() {
  const vis = getVisState(graph, state);
  const nodeMap = getNodeMap(vis.nodes);
  const edgeMap = getEdgeMap(vis.edges);

  // Edges
  const edgeSel = dagEdgeGroup
    .selectAll<SVGPathElement, LinkData>('path')
    .data(dagLinks, d => `${d.sourceId}->${d.targetId}`);

  const edgeEnter = edgeSel.enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke-width', 2);

  edgeEnter.merge(edgeSel).each(function (d) {
    const edge = edgeMap.get(`${d.sourceId}->${d.targetId}`);
    const active = edge?.active ?? false;
    d3.select(this)
      .attr('d', dagLineGen(d.points))
      .attr('stroke', active ? COLORS.edge.active : COLORS.edge.inactive)
      .attr('marker-end', `url(#${active ? 'arrow-active' : 'arrow-inactive'})`);
  });

  // Nodes
  const nodeData = Array.from(dagPositions.keys()).map(id => ({
    id,
    ...dagScaledPos(id),
  }));

  const nodeSel = dagNodeGroup
    .selectAll<SVGGElement, (typeof nodeData)[0]>('g.node')
    .data(nodeData, d => d.id);

  const nodeEnter = nodeSel.enter().append('g').attr('class', 'node');
  nodeEnter.append('circle').attr('r', NODE_RADIUS);
  nodeEnter.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', '10px')
    .attr('pointer-events', 'none');
  nodeEnter.style('cursor', 'pointer')
    .on('click', (_event, d) => onStateChange(d.id));

  const allNodes = nodeEnter.merge(nodeSel);
  allNodes.attr('transform', d => `translate(${d.x},${d.y})`);

  allNodes.select('circle').each(function (d) {
    const node = nodeMap.get(d.id);
    if (!node) return;
    const bg = node.selected ? COLORS[node.tier].selected : COLORS[node.tier].unselected;
    d3.select(this)
      .attr('fill', bg)
      .attr('stroke', node.selected ? bg : '#444')
      .attr('stroke-width', 2);
  });

  allNodes.select('text').each(function (d) {
    const node = nodeMap.get(d.id);
    if (!node) return;
    const label = node.pathCount > 0
      ? `${node.label} [${node.pathCount}]`
      : node.label;
    d3.select(this)
      .text(label)
      .attr('fill', node.selected ? COLORS.text.selected : COLORS.text.unselected);
  });
}

// ─── Venn Panel (upsetjs/venn.js) ───────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  Engineering: '#00d4ff',
  Science: '#00ff88',
  Arts: '#ff6b6b',
};
const SELECTED_COLORS: Record<string, string> = {
  Engineering: '#00eeff',
  Science: '#33ff99',
  Arts: '#ff8888',
};

const domainLabelToId = new Map(graph.domains.map(d => [d.label, d.id]));

function domainEntitySets(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const d of graph.domains) {
    const entities = new Set<string>();
    const cats = graph.domainToCategory.filter(e => e.from === d.id).map(e => e.to);
    for (const cat of cats) {
      for (const e of graph.categoryToEntity) {
        if (e.from === cat) entities.add(e.to);
      }
    }
    result.set(d.id, entities);
  }
  return result;
}

const domainSets = domainEntitySets();

function buildVennData(): venn.ISetOverlap[] {
  const domainIds = graph.domains.map(d => d.id);
  const domainLabels = new Map(graph.domains.map(d => [d.id, d.label]));
  const data: venn.ISetOverlap[] = [];

  for (const did of domainIds) {
    data.push({ sets: [domainLabels.get(did)!], size: domainSets.get(did)!.size });
  }

  for (let i = 0; i < domainIds.length; i++) {
    for (let j = i + 1; j < domainIds.length; j++) {
      const a = domainSets.get(domainIds[i])!;
      const b = domainSets.get(domainIds[j])!;
      const inter = new Set([...a].filter(x => b.has(x)));
      if (inter.size > 0) {
        data.push({
          sets: [domainLabels.get(domainIds[i])!, domainLabels.get(domainIds[j])!],
          size: inter.size,
        });
      }
    }
  }

  if (domainIds.length >= 3) {
    const all = domainIds.map(d => domainSets.get(d)!);
    const triple = new Set([...all[0]].filter(x => all[1].has(x) && all[2].has(x)));
    if (triple.size > 0) {
      data.push({
        sets: domainIds.map(d => domainLabels.get(d)!),
        size: triple.size,
      });
    }
  }

  return data;
}

function renderVenn() {
  const container = d3.select('#venn-content');
  container.selectAll('*').remove();

  const el = document.getElementById('venn-content')!;
  const w = el.clientWidth;
  const h = el.clientHeight;

  const vennData = buildVennData();

  const chart = venn.VennDiagram({ textFill: '#fff' })
    .width(w)
    .height(h)
    .padding(30)
    .duration(0); // No animation for synchronized updates

  container.datum(vennData).call(chart);

  const visState = getVisState(graph, state);
  const selectedDomains = new Set(
    visState.nodes
      .filter(n => n.tier === 'domain' && n.selected)
      .map(n => n.label),
  );

  // Style circles
  container.selectAll('.venn-circle').each(function () {
    const el = d3.select(this);
    const setAttr = el.attr('data-venn-sets');
    const isSelected = selectedDomains.has(setAttr);

    el.select('path')
      .style('fill', isSelected ? SELECTED_COLORS[setAttr] || '#4a9eff' : DOMAIN_COLORS[setAttr] || '#2a3a5c')
      .style('fill-opacity', isSelected ? 0.5 : 0.15)
      .style('stroke', isSelected ? SELECTED_COLORS[setAttr] || '#4a9eff' : DOMAIN_COLORS[setAttr] || '#555')
      .style('stroke-width', isSelected ? 3 : 1.5)
      .style('stroke-opacity', isSelected ? 1 : 0.5);

    el.select('text')
      .style('fill', isSelected ? '#fff' : '#aaa')
      .style('font-size', '14px')
      .style('font-weight', isSelected ? 'bold' : 'normal');
  });

  // Style intersections
  container.selectAll('.venn-intersection').each(function () {
    const el = d3.select(this);
    const setsStr = el.attr('data-venn-sets');
    const sets = setsStr.split('_');
    const allSelected = sets.every(s => selectedDomains.has(s));
    const someSelected = sets.some(s => selectedDomains.has(s));

    el.select('path')
      .style('fill', allSelected ? '#ffffff' : someSelected ? '#4a9eff' : '#333')
      .style('fill-opacity', allSelected ? 0.3 : someSelected ? 0.1 : 0.02)
      .style('stroke', 'none');
  });

  // Click handlers — circles
  container.selectAll('.venn-circle')
    .style('cursor', 'pointer')
    .on('click', function () {
      const setName = d3.select(this).attr('data-venn-sets');
      const domainId = domainLabelToId.get(setName);
      if (domainId) onStateChange(domainId);
    });

  // Click handlers — intersections
  container.selectAll('.venn-intersection')
    .style('cursor', 'pointer')
    .on('click', function () {
      const setsStr = d3.select(this).attr('data-venn-sets');
      const sets = setsStr.split('_');
      const unselected = sets.find(s => !selectedDomains.has(s));
      const target = unselected || sets[0];
      const domainId = domainLabelToId.get(target);
      if (domainId) onStateChange(domainId);
    });

  // Hover effects
  container.selectAll('.venn-area')
    .on('mouseenter', function () {
      d3.select(this).select('path')
        .transition().duration(100)
        .style('fill-opacity', function () {
          const current = parseFloat(d3.select(this).style('fill-opacity'));
          return Math.min(current + 0.15, 0.8);
        });
    })
    .on('mouseleave', () => renderVenn());
}

// ─── Entity Overlay ─────────────────────────────────────────────────

function renderEntityOverlay() {
  const overlay = document.getElementById('entity-overlay')!;
  const visState = getVisState(graph, state);
  const selectedDomains = visState.nodes
    .filter(n => n.tier === 'domain' && n.selected)
    .map(n => n.label);

  if (selectedDomains.length === 0) {
    overlay.innerHTML = '<span style="color:#666">Click a domain node or Venn circle to select</span>';
    return;
  }

  const activeEntities = visState.nodes
    .filter(n => n.tier === 'entity' && n.selected);

  const entitiesHtml = activeEntities.map(n =>
    `<span class="entity-item">${n.label} <span class="path-count">[${n.pathCount}]</span></span>`
  ).join('');

  overlay.innerHTML = `
    <div class="label">Selected: ${selectedDomains.join(', ')}</div>
    <div class="entities">${entitiesHtml || '<span style="color:#666">No entities</span>'}</div>
  `;
}

// ─── Reset Button ───────────────────────────────────────────────────

document.getElementById('btn-reset')!.addEventListener('click', resetState);

// ─── Resize Handling ────────────────────────────────────────────────

let resizeTimer: ReturnType<typeof setTimeout>;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderDag();
    renderVenn();
  }, 100);
});

// ─── Initial Render ─────────────────────────────────────────────────

renderDag();
renderVenn();
renderEntityOverlay();

// ─── CDP Testing Hooks ──────────────────────────────────────────────

(window as any).__dualState = () => {
  const vis = getVisState(graph, state);
  return {
    selectedDomains: [...state.selectedDomains],
    nodes: vis.nodes.map(n => ({
      id: n.id, label: n.label, tier: n.tier,
      selected: n.selected, pathCount: n.pathCount,
    })),
  };
};
(window as any).__dualClick = (nodeId: string) => onStateChange(nodeId);
(window as any).__dualReset = () => resetState();
