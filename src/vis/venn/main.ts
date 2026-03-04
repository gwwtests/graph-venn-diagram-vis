/**
 * Venn Diagram Visualization using @upsetjs/venn.js
 *
 * Maps the DAG to a Venn diagram where:
 * - Each domain is a set
 * - Entities reachable from a domain are members of that set
 * - Intersections show shared entities between domains
 * - Click on a region to select/deselect its domain(s)
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

/** Compute which entities are reachable from each domain */
function domainEntitySets(g: DagGraph): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  for (const d of g.domains) {
    const entities = new Set<string>();
    // domain → categories
    const cats = g.domainToCategory
      .filter(e => e.from === d.id)
      .map(e => e.to);
    // categories → entities
    for (const cat of cats) {
      for (const e of g.categoryToEntity) {
        if (e.from === cat) entities.add(e.to);
      }
    }
    result.set(d.id, entities);
  }

  return result;
}

/** Build venn.js data from domain-entity sets */
function buildVennData(
  g: DagGraph,
  domainSets: Map<string, Set<string>>,
  currentState: GraphState,
): venn.ISetOverlap[] {
  const domainIds = g.domains.map(d => d.id);
  const domainLabels = new Map(g.domains.map(d => [d.id, d.label]));
  const data: venn.ISetOverlap[] = [];

  // Single sets
  for (const did of domainIds) {
    data.push({
      sets: [domainLabels.get(did)!],
      size: domainSets.get(did)!.size,
    });
  }

  // Pairwise intersections
  for (let i = 0; i < domainIds.length; i++) {
    for (let j = i + 1; j < domainIds.length; j++) {
      const a = domainSets.get(domainIds[i])!;
      const b = domainSets.get(domainIds[j])!;
      const intersection = new Set([...a].filter(x => b.has(x)));
      if (intersection.size > 0) {
        data.push({
          sets: [
            domainLabels.get(domainIds[i])!,
            domainLabels.get(domainIds[j])!,
          ],
          size: intersection.size,
        });
      }
    }
  }

  // Triple intersection (if any)
  if (domainIds.length >= 3) {
    const all = domainIds.map(d => domainSets.get(d)!);
    const tripleIntersection = new Set(
      [...all[0]].filter(x => all[1].has(x) && all[2].has(x)),
    );
    if (tripleIntersection.size > 0) {
      data.push({
        sets: domainIds.map(d => domainLabels.get(d)!),
        size: tripleIntersection.size,
      });
    }
  }

  return data;
}

/** Color map for domains */
const DOMAIN_COLORS: Record<string, string> = {
  Engineering: '#00d4ff',
  Science: '#00ff88',
  Arts: '#ff6b6b',
  Production: '#ff9f43',
};

/** Selected color (brighter) */
const SELECTED_COLORS: Record<string, string> = {
  Engineering: '#00eeff',
  Science: '#33ff99',
  Arts: '#ff8888',
  Production: '#ffb366',
};

const domainSets = domainEntitySets(graph);
const domainLabelToId = new Map(graph.domains.map(d => [d.label, d.id]));

function render() {
  const container = d3.select('#venn');
  container.selectAll('*').remove();

  const vennData = buildVennData(graph, domainSets, state);

  const chart = venn.VennDiagram({
    textFill: '#fff',
  })
    .width(window.innerWidth)
    .height(window.innerHeight)
    .padding(40)
    .duration(400);

  container.datum(vennData).call(chart);

  // Get vis state for selection info
  const visState = getVisState(graph, state);
  const selectedDomains = new Set(
    visState.nodes
      .filter(n => n.tier === 'domain' && n.selected)
      .map(n => n.label),
  );

  // Style circles based on selection
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
      .style('fill-opacity', allSelected ? 0.3 : someSelected ? 0.1 : 0.02)
      .style('stroke', 'none');
  });

  // Click handlers
  container.selectAll('.venn-circle')
    .style('cursor', 'pointer')
    .on('click', function () {
      const el = d3.select(this);
      const setName = el.attr('data-venn-sets');
      const domainId = domainLabelToId.get(setName);
      if (domainId) {
        state = handleNodeClick(graph, state, domainId);
        render();
      }
    });

  // Intersection click: toggle first unselected domain, or deselect first selected
  container.selectAll('.venn-intersection')
    .style('cursor', 'pointer')
    .on('click', function () {
      const el = d3.select(this);
      const setsStr = el.attr('data-venn-sets');
      const sets = setsStr.split('_');
      // Find first unselected domain to select, or first selected to deselect
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
          return Math.min(current + 0.15, 0.8);
        });
    })
    .on('mouseleave', function () {
      // Re-render to reset opacity
      render();
    });

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

  const selectedList = [...selectedDomains].join(', ');
  overlay.innerHTML = `
    <div style="color:#fff;font-weight:bold;margin-bottom:6px">Selected: ${selectedList}</div>
    <div>${activeEntities || '<span style="color:#666">No entities active</span>'}</div>
  `;
}

// CDP test hooks
(window as any).__vennClick = (domainLabel: string) => {
  const domainId = domainLabelToId.get(domainLabel);
  if (domainId) {
    state = handleNodeClick(graph, state, domainId);
    render();
  }
};
(window as any).__vennState = () => {
  const visState = getVisState(graph, state);
  return {
    selectedDomains: [...state.selectedDomains],
    nodes: visState.nodes.map(n => ({
      id: n.id,
      label: n.label,
      tier: n.tier,
      selected: n.selected,
      pathCount: n.pathCount,
    })),
  };
};

// Initial render
render();

// Re-render on resize
window.addEventListener('resize', () => render());
