/**
 * Enhanced Venn Diagram — Domains, Categories & Entities
 *
 * Renders a 3-tier hierarchy inside a Venn diagram:
 * - Domains: large venn.js circles (area-proportional)
 * - Categories: smaller circles positioned inside their parent domain(s)
 * - Entities: small dots positioned inside their parent category/categories
 *
 * Uses venn.js for domain circle layout, then overlays D3 SVG elements
 * for categories and entities using the computed circle geometry.
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

/** Which domains each category belongs to */
function getCategoryDomains(g: DagGraph): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of g.categories) {
    const parents = g.domainToCategory
      .filter(e => e.to === c.id)
      .map(e => e.from);
    m.set(c.id, parents);
  }
  return m;
}

/** Which categories each entity belongs to */
function getEntityCategories(g: DagGraph): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of g.entities) {
    const parents = g.categoryToEntity
      .filter(edge => edge.to === e.id)
      .map(edge => edge.from);
    m.set(e.id, parents);
  }
  return m;
}

/** Which entities belong to each category */
function getCategoryEntities(g: DagGraph): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of g.categories) {
    const children = g.categoryToEntity
      .filter(e => e.from === c.id)
      .map(e => e.to);
    m.set(c.id, children);
  }
  return m;
}

/** Compute domain → entity reachability for venn.js sizing */
function domainEntitySets(g: DagGraph): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const d of g.domains) {
    const entities = new Set<string>();
    const cats = g.domainToCategory.filter(e => e.from === d.id).map(e => e.to);
    for (const cat of cats) {
      for (const e of g.categoryToEntity) {
        if (e.from === cat) entities.add(e.to);
      }
    }
    result.set(d.id, entities);
  }
  return result;
}

const categoryDomains = getCategoryDomains(graph);
const entityCategories = getEntityCategories(graph);
const categoryEntities = getCategoryEntities(graph);
const domainSets = domainEntitySets(graph);
const domainLabelToId = new Map(graph.domains.map(d => [d.label, d.id]));
const domainIdToLabel = new Map(graph.domains.map(d => [d.id, d.label]));
const categoryIdToLabel = new Map(graph.categories.map(c => [c.id, c.label]));
const entityIdToLabel = new Map(graph.entities.map(e => [e.id, e.label]));

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

  if (domainIds.length >= 3) {
    const all = domainIds.map(d => domainSets.get(d)!);
    const triple = new Set([...all[0]].filter(x => all[1].has(x) && all[2].has(x)));
    if (triple.size > 0) {
      data.push({
        sets: domainIds.map(d => domainIdToLabel.get(d)!),
        size: triple.size,
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
};

const SELECTED_COLORS: Record<string, string> = {
  Engineering: '#00eeff',
  Science: '#33ff99',
  Arts: '#ff8888',
};

const CATEGORY_COLOR = '#00ff88';
const CATEGORY_COLOR_SELECTED = '#33ffaa';
const ENTITY_COLOR = '#ff6b6b';
const ENTITY_COLOR_SELECTED = '#ff9999';

// ─── Geometry helpers ────────────────────────────────────────────────

interface CircleGeo {
  x: number;
  y: number;
  radius: number;
}

/** Compute centroid of intersection of multiple circles (approximation) */
function intersectionCentroid(circles: CircleGeo[]): { x: number; y: number } {
  if (circles.length === 1) return { x: circles[0].x, y: circles[0].y };

  // Weighted centroid biased toward smaller circles
  let totalWeight = 0;
  let wx = 0;
  let wy = 0;
  for (const c of circles) {
    const w = 1 / (c.radius * c.radius); // inverse-area weight
    wx += c.x * w;
    wy += c.y * w;
    totalWeight += w;
  }
  return { x: wx / totalWeight, y: wy / totalWeight };
}

/**
 * Position categories within their domain circle(s).
 * Returns a map: categoryId → { x, y, radius }
 */
function layoutCategories(domainCircles: Map<string, CircleGeo>): Map<string, CircleGeo> {
  const result = new Map<string, CircleGeo>();

  // Group categories by their domain-set signature (sorted domain ids)
  const groups = new Map<string, string[]>();
  for (const c of graph.categories) {
    const doms = categoryDomains.get(c.id) || [];
    const key = doms.slice().sort().join(',');
    const arr = groups.get(key) || [];
    arr.push(c.id);
    groups.set(key, arr);
  }

  for (const [domKey, catIds] of groups) {
    const domIds = domKey.split(',');
    const parentCircles = domIds
      .map(did => domainCircles.get(domainIdToLabel.get(did)!))
      .filter((c): c is CircleGeo => c !== undefined);

    if (parentCircles.length === 0) continue;

    const center = intersectionCentroid(parentCircles);
    const minRadius = Math.min(...parentCircles.map(c => c.radius));

    // Category circle radius proportional to entity count, scaled to fit
    const entityCounts = catIds.map(cid => (categoryEntities.get(cid) || []).length);
    const maxEntities = Math.max(...entityCounts, 1);

    // Use d3.packSiblings for non-overlapping layout
    const packData = catIds.map((cid, i) => ({
      r: Math.max(12, minRadius * 0.18 * Math.sqrt((entityCounts[i] + 1) / (maxEntities + 1))),
      cid,
    }));

    d3.packSiblings(packData as any);

    // Scale to fit within 60% of parent region
    const maxExtent = Math.max(...packData.map((p: any) => Math.sqrt(p.x * p.x + p.y * p.y) + p.r), 1);
    const fitScale = (minRadius * 0.55) / maxExtent;
    const scale = Math.min(fitScale, 1.5); // don't over-scale tiny groups

    for (const p of packData as any[]) {
      result.set(p.cid, {
        x: center.x + p.x * scale,
        y: center.y + p.y * scale,
        radius: p.r * Math.min(scale, 1),
      });
    }
  }

  return result;
}

/**
 * Position entities within their category circle(s).
 * Returns a map: entityId → { x, y }
 */
function layoutEntities(catCircles: Map<string, CircleGeo>): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const ENTITY_DOT_RADIUS = 5;

  // For entities with a single category: pack inside that category circle
  // For entities with multiple categories: position at centroid of parent circles

  // First, group entities by their category set signature
  const processed = new Set<string>();

  // Handle multi-category entities first (positioned at centroid)
  for (const e of graph.entities) {
    const cats = entityCategories.get(e.id) || [];
    if (cats.length > 1) {
      const parentCircles = cats
        .map(cid => catCircles.get(cid))
        .filter((c): c is CircleGeo => c !== undefined);
      if (parentCircles.length > 0) {
        const centroid = intersectionCentroid(parentCircles);
        result.set(e.id, centroid);
        processed.add(e.id);
      }
    }
  }

  // Pack single-category entities inside their category circle
  const catSingleEntities = new Map<string, string[]>();
  for (const e of graph.entities) {
    if (processed.has(e.id)) continue;
    const cats = entityCategories.get(e.id) || [];
    if (cats.length === 1) {
      const arr = catSingleEntities.get(cats[0]) || [];
      arr.push(e.id);
      catSingleEntities.set(cats[0], arr);
    }
  }

  for (const [catId, entityIds] of catSingleEntities) {
    const catCircle = catCircles.get(catId);
    if (!catCircle) continue;

    if (entityIds.length === 1) {
      // Single entity: center of category
      result.set(entityIds[0], { x: catCircle.x, y: catCircle.y });
    } else {
      const packData = entityIds.map(eid => ({ r: ENTITY_DOT_RADIUS, eid }));
      d3.packSiblings(packData as any);

      const maxExtent = Math.max(...packData.map((p: any) => Math.sqrt(p.x * p.x + p.y * p.y) + p.r), 1);
      const fitScale = Math.min((catCircle.radius * 0.7) / maxExtent, 1);

      for (const p of packData as any[]) {
        result.set(p.eid, {
          x: catCircle.x + p.x * fitScale,
          y: catCircle.y + p.y * fitScale,
        });
      }
    }
  }

  return result;
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

  // ─── Extract domain circle geometry from venn.js ───
  const domainCircles = new Map<string, CircleGeo>();
  const svgEl = container.select('svg').node() as SVGSVGElement;
  if (!svgEl) return;

  container.selectAll('.venn-circle').each(function () {
    const el = d3.select(this);
    const label = el.attr('data-venn-sets');
    // Extract circle center from the group transform + path bounding box
    const pathEl = el.select('path').node() as SVGPathElement;
    if (!pathEl) return;

    const bbox = pathEl.getBBox();
    // The path is a circle; its bounding box gives us center and radius
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;
    const radius = Math.min(bbox.width, bbox.height) / 2;

    // Account for the group transform
    const gEl = el.node() as SVGGElement;
    const transform = gEl.getAttribute('transform');
    let tx = 0, ty = 0;
    if (transform) {
      const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
      if (match) {
        tx = parseFloat(match[1]);
        ty = parseFloat(match[2]);
      }
    }

    domainCircles.set(label, {
      x: cx + tx,
      y: cy + ty,
      radius,
    });
  });

  if (domainCircles.size === 0) return;

  // ─── Layout & render categories ───
  const catCircles = layoutCategories(domainCircles);
  const entityPositions = layoutEntities(catCircles);

  // Get or create overlay group on the SVG
  const svgD3 = d3.select(svgEl);
  const overlayGroup = svgD3.append('g').attr('class', 'enhanced-overlay');

  // Render category circles
  for (const c of graph.categories) {
    const geo = catCircles.get(c.id);
    if (!geo) continue;

    const isSelected = selectedCategories.has(c.id);

    const catGroup = overlayGroup.append('g')
      .attr('class', 'category-node')
      .attr('transform', `translate(${geo.x}, ${geo.y})`)
      .style('cursor', 'pointer')
      .on('click', () => {
        // Clicking a category toggles its parent domain(s)
        const doms = categoryDomains.get(c.id) || [];
        if (doms.length > 0) {
          // Toggle first unselected domain, or first selected
          const unsel = doms.find(d => !state.selectedDomains.has(d));
          const target = unsel || doms[0];
          state = handleNodeClick(graph, state, target);
          render();
        }
      });

    // Category circle
    catGroup.append('circle')
      .attr('r', geo.radius)
      .attr('fill', isSelected ? CATEGORY_COLOR_SELECTED : CATEGORY_COLOR)
      .attr('fill-opacity', isSelected ? 0.4 : 0.12)
      .attr('stroke', isSelected ? CATEGORY_COLOR_SELECTED : CATEGORY_COLOR)
      .attr('stroke-width', isSelected ? 2 : 1)
      .attr('stroke-opacity', isSelected ? 0.9 : 0.3)
      .attr('stroke-dasharray', '3,2');

    // Category label
    catGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -geo.radius - 4)
      .attr('font-size', '10px')
      .attr('fill', isSelected ? '#fff' : '#888')
      .attr('font-weight', isSelected ? 'bold' : 'normal')
      .text(categoryIdToLabel.get(c.id) || c.id);
  }

  // Render entity dots
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
        // Clicking an entity toggles its grandparent domain(s)
        const cats = entityCategories.get(e.id) || [];
        const doms = new Set<string>();
        for (const catId of cats) {
          for (const domId of categoryDomains.get(catId) || []) {
            doms.add(domId);
          }
        }
        if (doms.size > 0) {
          const domArr = [...doms];
          const unsel = domArr.find(d => !state.selectedDomains.has(d));
          const target = unsel || domArr[0];
          state = handleNodeClick(graph, state, target);
          render();
        }
      });

    // Entity dot
    entityGroup.append('circle')
      .attr('r', 5)
      .attr('fill', isSelected ? ENTITY_COLOR_SELECTED : ENTITY_COLOR)
      .attr('fill-opacity', isSelected ? 0.9 : 0.3)
      .attr('stroke', isSelected ? '#fff' : ENTITY_COLOR)
      .attr('stroke-width', isSelected ? 1.5 : 0.5)
      .attr('stroke-opacity', isSelected ? 1 : 0.3);

    // Entity label
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
      }
    });

  // Intersection click
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
      }
    });

  // Hover effects
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

  // Entity list overlay
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
    overlay.innerHTML =
      '<span style="color:#666">Click a domain circle to select it</span>';
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
