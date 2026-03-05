/**
 * Enhanced Venn Diagram — Domains, Categories & Entities
 *
 * Renders a 3-tier hierarchy inside a Venn diagram:
 * - Domains: large venn.js circles (area-proportional)
 * - Categories: smaller circles positioned in the correct Venn region
 * - Entities: small dots positioned in the correct Venn region
 *
 * Uses venn.js for domain circle layout, then uses computeTextCentre()
 * (pole of inaccessibility) to find the visual center of each Venn region
 * for category and entity placement.
 */
import * as venn from '@upsetjs/venn.js';
import * as d3 from 'd3';
import {
  masterGraph,
  getVisState,
  handleNodeClick,
  createEmptyState,
  COLORS,
  type DagGraph,
  type GraphState,
} from '../shared';

let state: GraphState = createEmptyState();
const graph = masterGraph;

// ─── Precomputed topology ────────────────────────────────────────────

/** Which domains each category belongs to (by domain ID) */
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

/** Compute domain → entity reachability for venn.js sizing */
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
const domainLabelToId = new Map(graph.domains.map(d => [d.label, d.id]));
const domainIdToLabel = new Map(graph.domains.map(d => [d.id, d.label]));
const categoryIdToLabel = new Map(graph.categories.map(c => [c.id, c.label]));
const entityIdToLabel = new Map(graph.entities.map(e => [e.id, e.label]));
const allDomainLabels = graph.domains.map(d => d.label);

// ─── Venn data for domain circles ────────────────────────────────────

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

  // Triple and higher-order intersections
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

// ─── Colors ──────────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  Engineering: '#00d4ff',
  Science: '#00ff88',
  Arts: '#ff6b6b',
  Production: '#ff9f43',
  Computing: '#a855f7',
};

const SELECTED_COLORS: Record<string, string> = {
  Engineering: '#00eeff',
  Science: '#33ff99',
  Arts: '#ff8888',
  Production: '#ffb366',
  Computing: '#c084fc',
};

const CATEGORY_COLOR = '#00ff88';
const CATEGORY_COLOR_SELECTED = '#33ffaa';
const ENTITY_COLOR = '#ff6b6b';
const ENTITY_COLOR_SELECTED = '#ff9999';

// ─── Region positioning using computeTextCentre ──────────────────────

interface CircleGeo {
  x: number;
  y: number;
  radius: number;
}

/**
 * Find the visual center of a Venn region defined by:
 * - interiorLabels: domain labels the point must be INSIDE
 * - allCircles: map of all domain circles
 *
 * Uses venn.js computeTextCentre (pole of inaccessibility via Nelder-Mead).
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
 * Compute entity's Venn region: the set of domains reachable from it.
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

// ─── Render ──────────────────────────────────────────────────────────

function render() {
  const container = d3.select('#venn');
  container.selectAll('*').remove();

  const vennData = buildVennData();
  const w = window.innerWidth;
  const h = window.innerHeight;

  const chart = venn.VennDiagram({ textFill: '#fff' })
    .width(w)
    .height(h)
    .padding(40)
    .duration(0);

  container.datum(vennData).call(chart);

  // Get vis state for selection
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
      .style('font-size', '16px')
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

  // ─── Extract domain circle geometry from venn.js SVG ───
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

  // Compute base radius from smallest domain circle
  const minDomainRadius = Math.min(...[...domainCircles.values()].map(c => c.radius));
  const catBaseRadius = Math.max(15, minDomainRadius * 0.12);

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
  // Group by identical domain-label set
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
    // Multiple categories in the same Venn region — use packSiblings to spread them
    const center = catPositions.get(catIds[0])!;
    const packData = catIds.map(cid => ({
      r: catRadii.get(cid) || catBaseRadius,
      cid,
    }));
    d3.packSiblings(packData as any);

    // Don't scale beyond the region — keep compact
    for (const p of packData as any[]) {
      catPositions.set(p.cid, {
        x: center.x + p.x,
        y: center.y + p.y,
      });
    }
  }

  // ─── Position entities at centroid of parent category positions ───
  // This ensures multi-category entities appear between their parents,
  // not biased to one domain region (see ramblings/2026-03-04--entity-cross-category-venn-positioning.md)
  const entityPositions = new Map<string, { x: number; y: number }>();

  for (const e of graph.entities) {
    const cats = entityCategories.get(e.id) || [];
    const parentPositions = cats
      .map(cid => catPositions.get(cid))
      .filter((p): p is { x: number; y: number } => p !== undefined);

    if (parentPositions.length === 0) {
      // Fallback: use domain-region center
      const domLabels = entityDomainLabels(e.id);
      const center = regionCenter(domLabels, domainCircles);
      if (center) entityPositions.set(e.id, { x: center.x, y: center.y + catBaseRadius + 8 });
      continue;
    }

    // Centroid of parent category positions
    const cx = parentPositions.reduce((s, p) => s + p.x, 0) / parentPositions.length;
    const cy = parentPositions.reduce((s, p) => s + p.y, 0) / parentPositions.length;
    entityPositions.set(e.id, { x: cx, y: cy + catBaseRadius + 8 });
  }

  // Spread overlapping entities using packSiblings
  const entityByPos = new Map<string, string[]>();
  for (const e of graph.entities) {
    const pos = entityPositions.get(e.id);
    if (!pos) continue;
    const key = `${pos.x.toFixed(1)},${pos.y.toFixed(1)}`;
    const arr = entityByPos.get(key) || [];
    arr.push(e.id);
    entityByPos.set(key, arr);
  }
  for (const [, eids] of entityByPos) {
    if (eids.length <= 1) continue;
    const base = entityPositions.get(eids[0])!;
    const packData = eids.map(eid => ({ r: 5, eid }));
    d3.packSiblings(packData as any);
    for (const p of packData as any[]) {
      entityPositions.set(p.eid, { x: base.x + p.x, y: base.y + p.y });
    }
  }

  // ─── Resize category circles to encompass their entities ───
  for (const c of graph.categories) {
    const pos = catPositions.get(c.id);
    if (!pos) continue;
    const ents = categoryEntities.get(c.id) || [];
    let maxDist = 0;
    for (const eid of ents) {
      const epos = entityPositions.get(eid);
      if (epos) {
        const d = Math.sqrt((pos.x - epos.x) ** 2 + (pos.y - epos.y) ** 2);
        if (d > maxDist) maxDist = d;
      }
    }
    const minR = catBaseRadius;
    catRadii.set(c.id, Math.max(minR, maxDist + 12));
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
          const nodeId = unsel || doms[0];
          state = handleNodeClick(graph, state, nodeId);
          render();
          window.parent.postMessage({ type: 'node-clicked', nodeId }, '*');
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
      .attr('dy', -radius - 4)
      .attr('font-size', '10px')
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
          const nodeId = unsel || domArr[0];
          state = handleNodeClick(graph, state, nodeId);
          render();
          window.parent.postMessage({ type: 'node-clicked', nodeId }, '*');
        }
      });

    entityGroup.append('circle')
      .attr('r', 5)
      .attr('fill', isSelected ? ENTITY_COLOR_SELECTED : ENTITY_COLOR)
      .attr('fill-opacity', isSelected ? 0.9 : 0.3)
      .attr('stroke', isSelected ? '#fff' : ENTITY_COLOR)
      .attr('stroke-width', isSelected ? 1.5 : 0.5)
      .attr('stroke-opacity', isSelected ? 1 : 0.3);

    entityGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 14)
      .attr('font-size', '8px')
      .attr('fill', isSelected ? '#fff' : '#666')
      .text(() => {
        const label = entityIdToLabel.get(e.id) || e.id;
        return pathCount > 0 ? `${label} [${pathCount}]` : label;
      });
  }

  // ─── Click handlers for domain circles ───
  container.selectAll('.venn-circle')
    .style('cursor', 'pointer')
    .on('click', function () {
      const setName = d3.select(this).attr('data-venn-sets');
      const domainId = domainLabelToId.get(setName);
      if (domainId) {
        state = handleNodeClick(graph, state, domainId);
        render();
        window.parent.postMessage({ type: 'node-clicked', nodeId: domainId }, '*');
      }
    });

  container.selectAll('.venn-intersection')
    .style('cursor', 'pointer')
    .on('click', function () {
      const setsStr = d3.select(this).attr('data-venn-sets');
      const sets = setsStr.split('_');
      const unselected = sets.find(s => !selectedDomains.has(s));
      const target = unselected || sets[0];
      const domainId = domainLabelToId.get(target);
      if (domainId) {
        state = handleNodeClick(graph, state, domainId);
        render();
        window.parent.postMessage({ type: 'node-clicked', nodeId: domainId }, '*');
      }
    });

  container.selectAll('.venn-area')
    .on('mouseenter', function () {
      d3.select(this).select('path')
        .transition().duration(100)
        .style('fill-opacity', function () {
          const current = parseFloat(d3.select(this).style('fill-opacity'));
          return Math.min(current + 0.1, 0.6);
        });
    })
    .on('mouseleave', () => render());

  renderEntityList(selectedDomains);
}

/** Show selected entities as a small overlay */
function renderEntityList(selectedDomains: Set<string>) {
  let overlay = document.getElementById('entity-list');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'entity-list';
    overlay.style.cssText =
      'position:fixed;bottom:20px;left:20px;background:rgba(26,26,46,0.9);border:1px solid #333;border-radius:8px;padding:12px 16px;color:#ccc;font-family:sans-serif;font-size:13px;max-width:300px;pointer-events:none;';
    document.body.appendChild(overlay);
  }

  if (selectedDomains.size === 0) {
    overlay.innerHTML = '<span style="color:#666">Click a domain circle to select it</span>';
    return;
  }

  const visState = getVisState(graph, state);
  const activeEntities = visState.nodes
    .filter(n => n.tier === 'entity' && n.selected)
    .map(n => `${n.label} <span style="color:#4a9eff">[${n.pathCount}]</span>`)
    .join('<br>');

  const activeCategories = visState.nodes
    .filter(n => n.tier === 'category' && n.selected)
    .map(n => `<span style="color:${CATEGORY_COLOR}">${n.label}</span>`)
    .join(', ');

  const selectedList = [...selectedDomains].join(', ');
  overlay.innerHTML = `
    <div style="color:#fff;font-weight:bold;margin-bottom:4px">Selected: ${selectedList}</div>
    <div style="margin-bottom:4px;font-size:11px">Categories: ${activeCategories || '<span style="color:#666">none</span>'}</div>
    <div>${activeEntities || '<span style="color:#666">No entities active</span>'}</div>
  `;
}

// ─── CDP test hooks ──────────────────────────────────────────────────

(window as any).__vennEnhancedClick = (domainLabel: string) => {
  const domainId = domainLabelToId.get(domainLabel);
  if (domainId) {
    state = handleNodeClick(graph, state, domainId);
    render();
  }
};

(window as any).__vennEnhancedState = () => {
  const visState = getVisState(graph, state);
  return {
    selectedDomains: [...state.selectedDomains],
    nodes: visState.nodes.map(n => ({
      id: n.id, label: n.label, tier: n.tier,
      selected: n.selected, pathCount: n.pathCount,
    })),
  };
};

(window as any).__vennEnhancedReset = () => {
  state = createEmptyState();
  render();
};

// ─── Initial render ──────────────────────────────────────────────────

render();

let resizeTimer: ReturnType<typeof setTimeout>;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => render(), 100);
});

// ─── postMessage support for dual-all iframe embedding ──────────────
window.addEventListener('message', (e) => {
  if (e.data?.type === 'sync-select' && e.data.nodeId) {
    state = handleNodeClick(graph, state, e.data.nodeId);
    render();
  }
});
