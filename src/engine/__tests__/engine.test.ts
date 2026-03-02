import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph } from '../types';

describe('processGraph', () => {
  // Master example graph from docs/design/03-example-dag-cases.md
  const masterGraph: DagGraph = {
    domains: [
      { id: 'd1', label: 'Engineering' },
      { id: 'd2', label: 'Science' },
      { id: 'd3', label: 'Arts' },
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

  // Trivial graph: 1 domain, 1 category, 1 entity
  const trivialGraph: DagGraph = {
    domains: [{ id: 'd1', label: 'Domain1' }],
    categories: [{ id: 'c1', label: 'Cat1' }],
    entities: [{ id: 'x1', label: 'Entity1' }],
    domainToCategory: [{ from: 'd1', to: 'c1' }],
    categoryToEntity: [{ from: 'c1', to: 'x1' }],
  };

  it('returns empty state with no events and nothing selected', () => {
    const result = processGraph(trivialGraph, createEmptyState(), []);
    expect(result.outputs).toEqual([]);
    expect(result.state.selectedDomains.size).toBe(0);
  });

  it('selects a domain and propagates to category and entity', () => {
    const result = processGraph(trivialGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
    ]);
    expect(result.state.selectedDomains).toEqual(new Set(['d1']));
    // get_state to check propagation
    const result2 = processGraph(trivialGraph, result.state, [
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result2.outputs).toEqual([
      { nodeId: 'd1', selected: true, pathCount: 1 },
      { nodeId: 'c1', selected: true, pathCount: 1 },
      { nodeId: 'x1', selected: true, pathCount: 1 },
    ]);
  });

  it('selects multiple domains with correct cumulative path counts', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x2', action: 'get_state' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'x4', action: 'get_state' },
      { nodeId: 'x5', action: 'get_state' },
      { nodeId: 'x6', action: 'get_state' },
    ]);
    // From design doc — d1+d2 selected (d3 not):
    // x1: 1 path (d1→c1→x1)
    // x2: 2 paths (d1→c1→x2, d1→c3→x2)
    // x3: 3 paths (d1→c1→x3, d1→c2→x3, d2→c2→x3)
    // x4: 3 paths (d1→c2→x4, d2→c2→x4, d2→c5→x4)
    // x5: 0 paths (d3 not selected)
    // x6: 1 path (d1→c3→x6) — c4→x6 not active since d3 not selected
    expect(result.outputs).toEqual([
      { nodeId: 'x1', selected: true, pathCount: 1 },
      { nodeId: 'x2', selected: true, pathCount: 2 },
      { nodeId: 'x3', selected: true, pathCount: 3 },
      { nodeId: 'x4', selected: true, pathCount: 3 },
      { nodeId: 'x5', selected: false, pathCount: 0 },
      { nodeId: 'x6', selected: true, pathCount: 1 },
    ]);
  });

  it('deselects a domain and recomputes paths', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x2', action: 'get_state' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'x4', action: 'get_state' },
      { nodeId: 'x5', action: 'get_state' },
      { nodeId: 'x6', action: 'get_state' },
    ]);
    // Only d2 selected:
    // c2 active (d2→c2), c5 active (d2→c5)
    // x3: 1 path (d2→c2→x3)
    // x4: 2 paths (d2→c2→x4, d2→c5→x4)
    // x1: 0, x2: 0, x5: 0, x6: 0
    expect(result.outputs).toEqual([
      { nodeId: 'x1', selected: false, pathCount: 0 },
      { nodeId: 'x2', selected: false, pathCount: 0 },
      { nodeId: 'x3', selected: true, pathCount: 1 },
      { nodeId: 'x4', selected: true, pathCount: 2 },
      { nodeId: 'x5', selected: false, pathCount: 0 },
      { nodeId: 'x6', selected: false, pathCount: 0 },
    ]);
  });
});
