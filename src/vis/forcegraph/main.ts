import ForceGraph from 'force-graph';
import { forceCollide } from 'd3-force';
import {
  masterGraph,
  COLORS,
  getVisState,
  handleNodeClick,
  createEmptyState,
  type VisNode,
  type GraphState,
} from '../shared';

let state: GraphState = createEmptyState();
let currentGraph: ReturnType<ReturnType<typeof ForceGraph>> | null = null;

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

function render() {
  const { nodes, edges } = getVisState(masterGraph, state);

  // Build lookup for quick access
  const nodeMap = new Map<string, VisNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const graphData = {
    nodes: nodes.map(n => ({
      id: n.id,
      label: n.label,
      tier: n.tier,
      selected: n.selected,
      pathCount: n.pathCount,
    })),
    links: edges.map(e => ({
      source: e.from,
      target: e.to,
      active: e.active,
    })),
  };

  const container = document.getElementById('graph')!;
  container.innerHTML = '';

  const width = window.innerWidth;
  const height = window.innerHeight;

  const graph = ForceGraph()(container)
    .width(width)
    .height(height)
    .backgroundColor(COLORS.background)
    .dagMode('td')
    .dagLevelDistance(180)
    .d3VelocityDecay(0.3)
    .graphData(graphData)
    // Node rendering
    .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = nodeMap.get(node.id as string);
      if (!n) return;

      const tierColors = COLORS[n.tier];
      const fillColor = n.selected ? tierColors.selected : tierColors.unselected;
      const textColor = n.selected ? COLORS.text.selected : COLORS.text.unselected;
      const radius = n.tier === 'domain' ? 14 : n.tier === 'category' ? 11 : 9;

      // Draw circle
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = n.selected ? '#fff' : '#555';
      ctx.lineWidth = n.selected ? 2 : 1;
      ctx.stroke();

      // Draw label below node
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = textColor;
      ctx.fillText(n.label, node.x!, node.y! + radius + 3);

      // Draw pathCount badge on entities
      if (n.tier === 'entity' && n.pathCount > 0) {
        ctx.font = `bold ${fontSize * 0.9}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(String(n.pathCount), node.x!, node.y!);
      }
    })
    .nodePointerAreaPaint((node: any, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, 16, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    })
    // Edge rendering
    .linkColor((link: any) => link.active ? COLORS.edge.active : COLORS.edge.inactive)
    .linkWidth((link: any) => link.active ? 2.5 : 1)
    .linkDirectionalParticles((link: any) => link.active ? 3 : 0)
    .linkDirectionalParticleWidth(3)
    .linkDirectionalParticleColor(() => COLORS.edge.active)
    // Click handler
    .onNodeClick((node: any) => {
      state = handleNodeClick(masterGraph, state, node.id as string);
      render();
    })
    .cooldownTicks(150)
    .onEngineStop(() => {
      graph.zoomToFit(300, 50);
    });

  // Push nodes apart aggressively to avoid label overlap
  const charge = graph.d3Force('charge');
  if (charge && typeof (charge as any).strength === 'function') {
    (charge as any).strength(-800);
  }

  // Increase minimum link distance to spread tiers further apart
  const link = graph.d3Force('link');
  if (link && typeof (link as any).distance === 'function') {
    (link as any).distance(120);
  }

  // Collision force prevents node overlap (radius includes label space)
  graph.d3Force('collide', forceCollide(50));

  currentGraph = graph;
  renderLegend();

  // Expose for CDP testing
  (window as any).__forceGraph = graph;
  (window as any).__clickNode = (nodeId: string) => {
    state = handleNodeClick(masterGraph, state, nodeId);
    render();
  };
}

render();
