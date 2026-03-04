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

// ─── Enhanced Venn Panel (domains + categories + entities) ──────────

const DOMAIN_COLORS: Record<string, string> = {
  Engineering: '#00d4ff',
  Science: '#00ff88',
  Arts: '#ff6b6b',
  Production: '#ff9f43',
};
const SELECTED_COLORS: Record<string, string> = {
  Engineering: '#00eeff',
  Science: '#33ff99',
  Arts: '#ff8888',
  Production: '#ffb366',
};

const CATEGORY_COLOR = '#00ff88';
const CATEGORY_COLOR_SELECTED = '#33ffaa';
const ENTITY_COLOR = '#ff6b6b';
const ENTITY_COLOR_SELECTED = '#ff9999';

const domainLabelToId = new Map(graph.domains.map(d => [d.label, d.id]));
const domainIdToLabel = new Map(graph.domains.map(d => [d.id, d.label]));
const categoryIdToLabel = new Map(graph.categories.map(c => [c.id, c.label]));
const entityIdToLabel = new Map(graph.entities.map(e => [e.id, e.label]));
const allDomainLabels = graph.domains.map(d => d.label);

/** Which domains each category belongs to */
const categoryDomains = new Map<string, string[]>();
for (const c of graph.categories) {
  categoryDomains.set(c.id, graph.domainToCategory.filter(e => e.to === c.id).map(e => e.from));
}

/** Which categories each entity belongs to */
const entityCategories = new Map<string, string[]>();
for (const e of graph.entities) {
  entityCategories.set(e.id, graph.categoryToEntity.filter(edge => edge.to === e.id).map(edge => edge.from));
}

/** Which entities belong to each category */
const categoryEntities = new Map<string, string[]>();
for (const c of graph.categories) {
  categoryEntities.set(c.id, graph.categoryToEntity.filter(e => e.from === c.id).map(e => e.to));
}

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
  const data: venn.ISetOverlap[] = [];

  for (const did of domainIds) {
    data.push({ sets: [domainIdToLabel.get(did)!], size: domainSets.get(did)!.size });
  }

  for (let i = 0; i < domainIds.length; i++) {
    for (let j = i + 1; j < domainIds.length; j++) {
      const a = domainSets.get(domainIds[i])!;
      const b = domainSets.get(domainIds[j])!;
      const inter = new Set([...a].filter(x => b.has(x)));
      if (inter.size > 0) {
        data.push({
          sets: [domainIdToLabel.get(domainIds[i])!, domainIdToLabel.get(domainIds[j])!],
          size: inter.size,
        });
      }
    }
  }

  // Triple intersections
  if (domainIds.length >= 3) {
    for (let i = 0; i < domainIds.length; i++) {
      for (let j = i + 1; j < domainIds.length; j++) {
        for (let k = j + 1; k < domainIds.length; k++) {
          const a = domainSets.get(domainIds[i])!;
          const b = domainSets.get(domainIds[j])!;
          const c = domainSets.get(domainIds[k])!;
          const triple = new Set([...a].filter(x => b.has(x) && c.has(x)));
          if (triple.size > 0) {
            data.push({
              sets: [domainIdToLabel.get(domainIds[i])!, domainIdToLabel.get(domainIds[j])!, domainIdToLabel.get(domainIds[k])!],
              size: triple.size,
            });
          }
        }
      }
    }
  }

  // Quad intersection
  if (domainIds.length >= 4) {
    const all = domainIds.map(d => domainSets.get(d)!);
    const quad = new Set([...all[0]].filter(x => all.every(s => s.has(x))));
    if (quad.size > 0) {
      data.push({
        sets: domainIds.map(d => domainIdToLabel.get(d)!),
        size: quad.size,
      });
    }
  }

  return data;
}

interface CircleGeo { x: number; y: number; radius: number; }

/**
 * Find the visual center of a Venn region using computeTextCentre
 * (pole of inaccessibility via Nelder-Mead optimization).
 */
function regionCenter(
  interiorLabels: string[],
  allCircles: Map<string, CircleGeo>,
): { x: number; y: number } | null {
  const interior = interiorLabels
    .map(l => allCircles.get(l))
    .filter((c): c is CircleGeo => c !== undefined);
  const exterior = allDomainLabels
    .filter(l => !interiorLabels.includes(l))
    .map(l => allCircles.get(l))
    .filter((c): c is CircleGeo => c !== undefined);

  if (interior.length === 0) return null;

  const center = venn.computeTextCentre(interior, exterior);

  // computeTextCentre returns {x:0, y:-1000} for impossible regions
  if (center.y < -500) return null;

  return center;
}

/**
 * Compute entity's Venn region: the set of domain labels reachable from it.
 */
function entityDomainLabels(entityId: string): string[] {
  const cats = entityCategories.get(entityId) || [];
  const doms = new Set<string>();
  for (const catId of cats) {
    for (const domId of categoryDomains.get(catId) || []) {
      doms.add(domainIdToLabel.get(domId)!);
    }
  }
  return [...doms];
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
    .duration(0);

  container.datum(vennData).call(chart);

  const visState = getVisState(graph, state);
  const selectedDomains = new Set(
    visState.nodes.filter(n => n.tier === 'domain' && n.selected).map(n => n.label),
  );
  const selectedCategories = new Set(
    visState.nodes.filter(n => n.tier === 'category' && n.selected).map(n => n.id),
  );
  const selectedEntities = new Set(
    visState.nodes.filter(n => n.tier === 'entity' && n.selected).map(n => n.id),
  );
  const entityPathCounts = new Map(
    visState.nodes.filter(n => n.tier === 'entity').map(n => [n.id, n.pathCount]),
  );

  // Style domain circles
  container.selectAll('.venn-circle').each(function () {
    const el = d3.select(this);
    const setAttr = el.attr('data-venn-sets');
    const isSelected = selectedDomains.has(setAttr);

    el.select('path')
      .style('fill', isSelected ? SELECTED_COLORS[setAttr] || '#4a9eff' : DOMAIN_COLORS[setAttr] || '#2a3a5c')
      .style('fill-opacity', isSelected ? 0.35 : 0.1)
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
      .style('fill-opacity', allSelected ? 0.2 : someSelected ? 0.08 : 0.02)
      .style('stroke', 'none');
  });

  // ─── Extract domain circle geometry from venn.js ───
  const domainCircles = new Map<string, CircleGeo>();
  const svgEl = container.select('svg').node() as SVGSVGElement;
  if (!svgEl) return;

  container.selectAll('.venn-circle').each(function () {
    const el = d3.select(this);
    const label = el.attr('data-venn-sets');
    const pathEl = el.select('path').node() as SVGPathElement;
    if (!pathEl) return;
    const bbox = pathEl.getBBox();
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const radius = Math.min(bbox.width, bbox.height) / 2;
    const gEl = el.node() as SVGGElement;
    const transform = gEl.getAttribute('transform');
    let tx = 0, ty = 0;
    if (transform) {
      const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
      if (match) { tx = parseFloat(match[1]); ty = parseFloat(match[2]); }
    }
    domainCircles.set(label, { x: cx + tx, y: cy + ty, radius });
  });

  if (domainCircles.size === 0) return;

  // ─── Position categories using computeTextCentre ───
  const catPositions = new Map<string, { x: number; y: number }>();
  const catRadii = new Map<string, number>();

  const minDomainRadius = Math.min(...[...domainCircles.values()].map(c => c.radius));
  const catBaseRadius = Math.max(12, minDomainRadius * 0.12);

  for (const c of graph.categories) {
    const parentDomIds = categoryDomains.get(c.id) || [];
    const parentLabels = parentDomIds.map(did => domainIdToLabel.get(did)!);
    const center = regionCenter(parentLabels, domainCircles);
    if (center) {
      catPositions.set(c.id, center);
      const entityCount = (categoryEntities.get(c.id) || []).length;
      catRadii.set(c.id, catBaseRadius + catBaseRadius * 0.15 * entityCount);
    }
  }

  // Spread categories sharing the same region using packSiblings
  const regionGroups = new Map<string, string[]>();
  for (const c of graph.categories) {
    if (!catPositions.has(c.id)) continue;
    const parentDomIds = categoryDomains.get(c.id) || [];
    const key = parentDomIds.slice().sort().join(',');
    const arr = regionGroups.get(key) || [];
    arr.push(c.id);
    regionGroups.set(key, arr);
  }

  for (const [, catIds] of regionGroups) {
    if (catIds.length <= 1) continue;
    const center = catPositions.get(catIds[0])!;
    const packData = catIds.map(cid => ({
      r: catRadii.get(cid) || catBaseRadius,
      cid,
    }));
    d3.packSiblings(packData as any);
    for (const p of packData as any[]) {
      catPositions.set(p.cid, {
        x: center.x + p.x,
        y: center.y + p.y,
      });
    }
  }

  // ─── Position entities using computeTextCentre ───
  const entityPositions = new Map<string, { x: number; y: number }>();

  const entityRegionGroups = new Map<string, string[]>();
  for (const e of graph.entities) {
    const domLabels = entityDomainLabels(e.id);
    const key = domLabels.slice().sort().join(',');
    const arr = entityRegionGroups.get(key) || [];
    arr.push(e.id);
    entityRegionGroups.set(key, arr);
  }

  for (const [regionKey, entityIds] of entityRegionGroups) {
    const domLabels = regionKey.split(',');
    const center = regionCenter(domLabels, domainCircles);
    if (!center) continue;

    if (entityIds.length === 1) {
      entityPositions.set(entityIds[0], { x: center.x, y: center.y + catBaseRadius + 6 });
    } else {
      const packData = entityIds.map(eid => ({ r: 4, eid }));
      d3.packSiblings(packData as any);
      for (const p of packData as any[]) {
        entityPositions.set(p.eid, {
          x: center.x + p.x,
          y: center.y + catBaseRadius + 6 + p.y,
        });
      }
    }
  }

  // ─── Render overlay ───
  const svgD3 = d3.select(svgEl);
  const overlayGroup = svgD3.append('g').attr('class', 'enhanced-overlay');

  // Category circles
  for (const c of graph.categories) {
    const pos = catPositions.get(c.id);
    if (!pos) continue;
    const radius = catRadii.get(c.id) || catBaseRadius;
    const isSelected = selectedCategories.has(c.id);

    const catGroup = overlayGroup.append('g')
      .attr('class', 'category-node')
      .attr('transform', `translate(${pos.x}, ${pos.y})`)
      .style('cursor', 'pointer')
      .on('click', () => {
        const doms = categoryDomains.get(c.id) || [];
        if (doms.length > 0) {
          const unsel = doms.find(d => !state.selectedDomains.has(d));
          onStateChange(unsel || doms[0]);
        }
      });

    catGroup.append('circle')
      .attr('r', radius)
      .attr('fill', isSelected ? CATEGORY_COLOR_SELECTED : CATEGORY_COLOR)
      .attr('fill-opacity', isSelected ? 0.4 : 0.12)
      .attr('stroke', isSelected ? CATEGORY_COLOR_SELECTED : CATEGORY_COLOR)
      .attr('stroke-width', isSelected ? 2 : 1)
      .attr('stroke-opacity', isSelected ? 0.9 : 0.3)
      .attr('stroke-dasharray', '3,2');

    catGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -radius - 3)
      .attr('font-size', '9px')
      .attr('fill', isSelected ? '#fff' : '#888')
      .attr('font-weight', isSelected ? 'bold' : 'normal')
      .text(categoryIdToLabel.get(c.id) || c.id);
  }

  // Entity dots
  for (const e of graph.entities) {
    const pos = entityPositions.get(e.id);
    if (!pos) continue;
    const isSelected = selectedEntities.has(e.id);
    const pathCount = entityPathCounts.get(e.id) || 0;

    const entityGroup = overlayGroup.append('g')
      .attr('class', 'entity-node')
      .attr('transform', `translate(${pos.x}, ${pos.y})`)
      .style('cursor', 'pointer')
      .on('click', () => {
        const cats = entityCategories.get(e.id) || [];
        const doms = new Set<string>();
        for (const catId of cats) {
          for (const domId of categoryDomains.get(catId) || []) doms.add(domId);
        }
        if (doms.size > 0) {
          const domArr = [...doms];
          const unsel = domArr.find(d => !state.selectedDomains.has(d));
          onStateChange(unsel || domArr[0]);
        }
      });

    entityGroup.append('circle')
      .attr('r', 4)
      .attr('fill', isSelected ? ENTITY_COLOR_SELECTED : ENTITY_COLOR)
      .attr('fill-opacity', isSelected ? 0.9 : 0.3)
      .attr('stroke', isSelected ? '#fff' : ENTITY_COLOR)
      .attr('stroke-width', isSelected ? 1.5 : 0.5)
      .attr('stroke-opacity', isSelected ? 1 : 0.3);

    entityGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 12)
      .attr('font-size', '7px')
      .attr('fill', isSelected ? '#fff' : '#666')
      .text(() => {
        const label = entityIdToLabel.get(e.id) || e.id;
        return pathCount > 0 ? `${label} [${pathCount}]` : label;
      });
  }

  // Click handlers — domain circles
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
