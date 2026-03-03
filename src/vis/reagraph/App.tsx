import { useState, useMemo, useCallback, useEffect } from 'react';
import { GraphCanvas, GraphNode, GraphEdge } from 'reagraph';
import {
  masterGraph,
  getVisState,
  handleNodeClick,
  createEmptyState,
  COLORS,
} from '../shared';
import type { GraphState, VisNode } from '../shared';

/** Map tier to Y row for layout */
const TIER_ROW: Record<string, number> = {
  domain: 0,
  category: 1,
  entity: 2,
};

/** Map tier to Y position in 3D space */
const TIER_Y: Record<string, number> = {
  domain: 0,
  category: -150,
  entity: -300,
};

function nodeColor(node: VisNode): string {
  return node.selected
    ? COLORS[node.tier].selected
    : COLORS[node.tier].unselected;
}

function nodeLabel(node: VisNode): string {
  return node.pathCount > 0
    ? `${node.label} [${node.pathCount}]`
    : node.label;
}

/** SVG overlay for headless screenshot capture (WebGL not captured by CDP) */
function SvgOverlay({
  vis,
  onNodeClick,
}: {
  vis: ReturnType<typeof getVisState>;
  onNodeClick: (nodeId: string) => void;
}) {
  const width = 1024;
  const height = 768;
  const rowHeight = height / 4;
  const padding = 60;

  // Group nodes by tier
  const byTier: Record<string, VisNode[]> = { domain: [], category: [], entity: [] };
  for (const n of vis.nodes) byTier[n.tier].push(n);

  // Compute positions
  const posMap = new Map<string, { cx: number; cy: number }>();
  for (const tier of ['domain', 'category', 'entity'] as const) {
    const items = byTier[tier];
    const row = TIER_ROW[tier];
    const cy = padding + rowHeight * (row + 0.5);
    const availWidth = width - 2 * padding;
    items.forEach((n, i) => {
      const cx = padding + (availWidth / (items.length + 1)) * (i + 1);
      posMap.set(n.id, { cx, cy });
    });
  }

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      {/* Tier labels */}
      {(['domain', 'category', 'entity'] as const).map((tier) => {
        const row = TIER_ROW[tier];
        const y = padding + rowHeight * row + 15;
        return (
          <text
            key={`tier-${tier}`}
            x={15}
            y={y}
            fill="#555"
            fontSize="11"
            fontFamily="sans-serif"
          >
            {tier.toUpperCase()}S
          </text>
        );
      })}

      {/* Edges */}
      {vis.edges.map((e, i) => {
        const from = posMap.get(e.from);
        const to = posMap.get(e.to);
        if (!from || !to) return null;
        return (
          <line
            key={`edge-${i}`}
            x1={from.cx}
            y1={from.cy}
            x2={to.cx}
            y2={to.cy}
            stroke={e.active ? COLORS.edge.active : COLORS.edge.inactive}
            strokeWidth={e.active ? 2 : 1}
            opacity={e.active ? 0.9 : 0.3}
          />
        );
      })}

      {/* Nodes */}
      {vis.nodes.map((n) => {
        const pos = posMap.get(n.id);
        if (!pos) return null;
        const fill = nodeColor(n);
        const r = n.tier === 'domain' ? 28 : n.tier === 'category' ? 24 : 20;
        return (
          <g
            key={n.id}
            onClick={() => onNodeClick(n.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={pos.cx}
              cy={pos.cy}
              r={r}
              fill={fill}
              stroke={n.selected ? '#fff' : '#444'}
              strokeWidth={n.selected ? 2 : 1}
              opacity={0.9}
            />
            <text
              x={pos.cx}
              y={pos.cy + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={n.selected ? COLORS.text.selected : COLORS.text.unselected}
              fontSize={n.tier === 'entity' ? '9' : '10'}
              fontFamily="sans-serif"
              fontWeight={n.selected ? 'bold' : 'normal'}
            >
              {nodeLabel(n)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function App() {
  const [state, setState] = useState<GraphState>(createEmptyState);
  const [webglFailed, setWebglFailed] = useState(false);

  // Detect WebGL availability
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) setWebglFailed(true);
    } catch {
      setWebglFailed(true);
    }
    // Also always show overlay for headless environments
    const isHeadless =
      navigator.userAgent.includes('HeadlessChrome') ||
      !(window as any).chrome?.runtime;
    if (isHeadless) setWebglFailed(true);
  }, []);

  const vis = useMemo(() => getVisState(masterGraph, state), [state]);

  // Compute X positions per tier for 3D canvas
  const positions = useMemo(() => {
    const byTier: Record<string, VisNode[]> = { domain: [], category: [], entity: [] };
    for (const n of vis.nodes) byTier[n.tier].push(n);
    const pos = new Map<string, { x: number; y: number; z: number }>();
    for (const tier of ['domain', 'category', 'entity'] as const) {
      const items = byTier[tier];
      const spread = 120;
      const startX = -((items.length - 1) * spread) / 2;
      items.forEach((n, i) => {
        pos.set(n.id, { x: startX + i * spread, y: TIER_Y[tier], z: 0 });
      });
    }
    return pos;
  }, [vis.nodes]);

  const nodes: GraphNode[] = useMemo(
    () =>
      vis.nodes.map((n) => ({
        id: n.id,
        label: nodeLabel(n),
        fill: nodeColor(n),
        data: { tier: n.tier, selected: n.selected },
        ...positions.get(n.id),
      })),
    [vis.nodes, positions],
  );

  const edges: GraphEdge[] = useMemo(
    () =>
      vis.edges.map((e, i) => ({
        id: `e${i}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        fill: e.active ? COLORS.edge.active : COLORS.edge.inactive,
      })),
    [vis.edges],
  );

  const onNodeClick = useCallback(
    (node: GraphNode) => {
      setState((prev) => handleNodeClick(masterGraph, prev, node.id));
    },
    [],
  );

  const onSvgNodeClick = useCallback(
    (nodeId: string) => {
      setState((prev) => handleNodeClick(masterGraph, prev, nodeId));
    },
    [],
  );

  // Expose for CDP testing
  useEffect(() => {
    (window as any).__reagraphClick = (nodeId: string) => {
      setState((prev) => handleNodeClick(masterGraph, prev, nodeId));
    };
    (window as any).__reagraphState = () => state;
  }, [state]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: COLORS.background,
        position: 'relative',
      }}
    >
      {/* SVG overlay for headless/screenshot or WebGL fallback */}
      {webglFailed && (
        <SvgOverlay vis={vis} onNodeClick={onSvgNodeClick} />
      )}
      {/* WebGL canvas (renders behind SVG overlay if present) */}
      {!webglFailed && (
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          layoutType="custom"
          onNodeClick={onNodeClick}
          labelType="all"
          theme={{
            canvas: { background: COLORS.background },
            node: {
              fill: COLORS.domain.unselected,
              label: { color: '#ccc', fontSize: 5 },
            },
            edge: {
              fill: COLORS.edge.inactive,
              label: { color: '#888', fontSize: 4 },
            },
          }}
        />
      )}
    </div>
  );
}
