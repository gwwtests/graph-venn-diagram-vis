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
});
