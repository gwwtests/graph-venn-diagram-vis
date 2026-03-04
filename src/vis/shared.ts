/**
 * Shared types and utilities for all visualization implementations.
 * Each visualization imports this + the engine.
 */
import type { DagGraph, GraphState, NodeState } from '../engine/types';
import { processGraph, createEmptyState } from '../engine/engine';

/** Master example graph — same as examples/master.json */
export const masterGraph: DagGraph = {
  domains: [
    { id: 'd1', label: 'Engineering' },
    { id: 'd2', label: 'Science' },
    { id: 'd3', label: 'Arts' },
    { id: 'd4', label: 'Production' },
    { id: 'd5', label: 'Computing' },
  ],
  categories: [
    { id: 'c1', label: 'Software' },
    { id: 'c2', label: 'Data' },
    { id: 'c3', label: 'Hardware' },
    { id: 'c4', label: 'Design' },
    { id: 'c5', label: 'Research' },
  ],
  entities: [
    { id: 'x1', label: 'Entity1' },
    { id: 'x2', label: 'Entity2' },
    { id: 'x3', label: 'Entity3' },
    { id: 'x4', label: 'Entity4' },
    { id: 'x5', label: 'Entity5' },
    { id: 'x6', label: 'Entity6' },
  ],
  domainToCategory: [
    { from: 'd1', to: 'c1' },
    { from: 'd1', to: 'c2' },
    { from: 'd1', to: 'c3' },
    { from: 'd2', to: 'c2' },
    { from: 'd2', to: 'c5' },
    { from: 'd3', to: 'c4' },
    { from: 'd4', to: 'c3' },
    { from: 'd4', to: 'c4' },
    { from: 'd5', to: 'c1' },
    { from: 'd5', to: 'c2' },
  ],
  categoryToEntity: [
    { from: 'c1', to: 'x1' },
    { from: 'c1', to: 'x2' },
    { from: 'c1', to: 'x3' },
    { from: 'c2', to: 'x3' },
    { from: 'c2', to: 'x4' },
    { from: 'c3', to: 'x2' },
    { from: 'c3', to: 'x6' },
    { from: 'c4', to: 'x5' },
    { from: 'c4', to: 'x6' },
    { from: 'c5', to: 'x4' },
  ],
};

/** Color palette for node states */
export const COLORS = {
  domain: { selected: '#00d4ff', unselected: '#2a3a5c' },
  category: { selected: '#00ff88', unselected: '#2a3a5c' },
  entity: { selected: '#ff6b6b', unselected: '#2a3a5c' },
  edge: { active: '#4a9eff', inactive: '#333' },
  text: { selected: '#fff', unselected: '#888' },
  background: '#1a1a2e',
};

/** All nodes with their tier info */
export interface VisNode {
  id: string;
  label: string;
  tier: 'domain' | 'category' | 'entity';
  selected: boolean;
  pathCount: number;
}

/** Edge with active state */
export interface VisEdge {
  from: string;
  to: string;
  active: boolean;
}

/** Get full visualization state from engine state */
export function getVisState(graph: DagGraph, state: GraphState): {
  nodes: VisNode[];
  edges: VisEdge[];
} {
  // Query state for all nodes
  const allNodeIds = [
    ...graph.domains.map(d => d.id),
    ...graph.categories.map(c => c.id),
    ...graph.entities.map(e => e.id),
  ];

  const events = allNodeIds.map(id => ({ nodeId: id, action: 'get_state' as const }));
  const result = processGraph(graph, state, events);

  const stateMap = new Map<string, NodeState>();
  for (const ns of result.outputs) {
    stateMap.set(ns.nodeId, ns);
  }

  const nodes: VisNode[] = [
    ...graph.domains.map(d => ({
      id: d.id,
      label: d.label,
      tier: 'domain' as const,
      selected: stateMap.get(d.id)?.selected ?? false,
      pathCount: stateMap.get(d.id)?.pathCount ?? 0,
    })),
    ...graph.categories.map(c => ({
      id: c.id,
      label: c.label,
      tier: 'category' as const,
      selected: stateMap.get(c.id)?.selected ?? false,
      pathCount: stateMap.get(c.id)?.pathCount ?? 0,
    })),
    ...graph.entities.map(e => ({
      id: e.id,
      label: e.label,
      tier: 'entity' as const,
      selected: stateMap.get(e.id)?.selected ?? false,
      pathCount: stateMap.get(e.id)?.pathCount ?? 0,
    })),
  ];

  // Edges: active if source node is selected
  const edges: VisEdge[] = [
    ...graph.domainToCategory.map(e => ({
      from: e.from,
      to: e.to,
      active: stateMap.get(e.from)?.selected ?? false,
    })),
    ...graph.categoryToEntity.map(e => ({
      from: e.from,
      to: e.to,
      active: stateMap.get(e.from)?.selected ?? false,
    })),
  ];

  return { nodes, edges };
}

/** Handle a click on a node — returns new state */
export function handleNodeClick(
  graph: DagGraph,
  state: GraphState,
  nodeId: string
): GraphState {
  // Determine current state
  const result = processGraph(graph, state, [{ nodeId, action: 'get_state' }]);
  const isSelected = result.outputs[0]?.selected ?? false;

  // Toggle: if selected, deselect; if not, select
  const action = isSelected ? 'deselect' : 'select';
  const newResult = processGraph(graph, state, [{ nodeId, action }]);
  return newResult.state;
}

export { createEmptyState, processGraph };
export type { DagGraph, GraphState };
