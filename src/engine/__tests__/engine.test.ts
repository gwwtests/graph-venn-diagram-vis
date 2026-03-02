import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph } from '../types';

describe('processGraph', () => {
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
});
