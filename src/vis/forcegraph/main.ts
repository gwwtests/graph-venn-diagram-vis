import ForceGraph from 'force-graph';
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
    .dagLevelDistance(120)
    .d3VelocityDecay(0.4)
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

  // Strengthen charge to push same-tier nodes apart
  const charge = graph.d3Force('charge');
  if (charge && typeof (charge as any).strength === 'function') {
    (charge as any).strength(-200);
  }

  currentGraph = graph;
  // Expose for CDP testing
  (window as any).__forceGraph = graph;
  (window as any).__clickNode = (nodeId: string) => {
    state = handleNodeClick(masterGraph, state, nodeId);
    render();
  };
}

render();
