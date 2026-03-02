import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph } from '../types';

describe('multi-domain combinations', () => {
  // Master example graph from docs/design/06-engine-behavioral-spec.md
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

  // Helper: select domains, then get_state for all entities and categories
  function selectAndQuery(domainIds: string[]) {
    const events = [
      ...domainIds.map(id => ({ nodeId: id, action: 'select' as const })),
      // Query all entities
      { nodeId: 'x1', action: 'get_state' as const },
      { nodeId: 'x2', action: 'get_state' as const },
      { nodeId: 'x3', action: 'get_state' as const },
      { nodeId: 'x4', action: 'get_state' as const },
      { nodeId: 'x5', action: 'get_state' as const },
      { nodeId: 'x6', action: 'get_state' as const },
      // Query all categories
      { nodeId: 'c1', action: 'get_state' as const },
      { nodeId: 'c2', action: 'get_state' as const },
      { nodeId: 'c3', action: 'get_state' as const },
      { nodeId: 'c4', action: 'get_state' as const },
      { nodeId: 'c5', action: 'get_state' as const },
    ];
    return processGraph(masterGraph, createEmptyState(), events);
  }

  describe('d1+d2 selected', () => {
    // d1 activates: c1(1), c2(1), c3(1)
    // d2 activates: c2(+1=2), c5(1)
    // Entity paths:
    //   x1: c1(1) = 1
    //   x2: c1(1) + c3(1) = 2
    //   x3: c1(1) + c2(2) = 3
    //   x4: c2(2) + c5(1) = 3
    //   x5: 0 (c4 inactive)
    //   x6: c3(1) = 1 (c4 inactive)
    let result: ReturnType<typeof processGraph>;

    it('produces correct entity path counts', () => {
      result = selectAndQuery(['d1', 'd2']);
      const entities = result.outputs.slice(0, 6);
      expect(entities).toEqual([
        { nodeId: 'x1', selected: true, pathCount: 1 },
        { nodeId: 'x2', selected: true, pathCount: 2 },
        { nodeId: 'x3', selected: true, pathCount: 3 },
        { nodeId: 'x4', selected: true, pathCount: 3 },
        { nodeId: 'x5', selected: false, pathCount: 0 },
        { nodeId: 'x6', selected: true, pathCount: 1 },
      ]);
    });

    it('produces correct category path counts', () => {
      result = selectAndQuery(['d1', 'd2']);
      const categories = result.outputs.slice(6, 11);
      expect(categories).toEqual([
        { nodeId: 'c1', selected: true, pathCount: 1 },
        { nodeId: 'c2', selected: true, pathCount: 2 },
        { nodeId: 'c3', selected: true, pathCount: 1 },
        { nodeId: 'c4', selected: false, pathCount: 0 },
        { nodeId: 'c5', selected: true, pathCount: 1 },
      ]);
    });

    it('has correct final state', () => {
      result = selectAndQuery(['d1', 'd2']);
      expect(result.state.selectedDomains).toEqual(new Set(['d1', 'd2']));
    });
  });

  describe('d1+d3 selected', () => {
    // d1 activates: c1(1), c2(1), c3(1)
    // d3 activates: c4(1)
    // Entity paths:
    //   x1: c1(1) = 1
    //   x2: c1(1) + c3(1) = 2
    //   x3: c1(1) + c2(1) = 2
    //   x4: c2(1) = 1
    //   x5: c4(1) = 1
    //   x6: c3(1) + c4(1) = 2
    let result: ReturnType<typeof processGraph>;

    it('produces correct entity path counts', () => {
      result = selectAndQuery(['d1', 'd3']);
      const entities = result.outputs.slice(0, 6);
      expect(entities).toEqual([
        { nodeId: 'x1', selected: true, pathCount: 1 },
        { nodeId: 'x2', selected: true, pathCount: 2 },
        { nodeId: 'x3', selected: true, pathCount: 2 },
        { nodeId: 'x4', selected: true, pathCount: 1 },
        { nodeId: 'x5', selected: true, pathCount: 1 },
        { nodeId: 'x6', selected: true, pathCount: 2 },
      ]);
    });

    it('produces correct category path counts', () => {
      result = selectAndQuery(['d1', 'd3']);
      const categories = result.outputs.slice(6, 11);
      expect(categories).toEqual([
        { nodeId: 'c1', selected: true, pathCount: 1 },
        { nodeId: 'c2', selected: true, pathCount: 1 },
        { nodeId: 'c3', selected: true, pathCount: 1 },
        { nodeId: 'c4', selected: true, pathCount: 1 },
        { nodeId: 'c5', selected: false, pathCount: 0 },
      ]);
    });

    it('has correct final state', () => {
      result = selectAndQuery(['d1', 'd3']);
      expect(result.state.selectedDomains).toEqual(new Set(['d1', 'd3']));
    });
  });

  describe('d2+d3 selected', () => {
    // d2 activates: c2(1), c5(1)
    // d3 activates: c4(1)
    // Entity paths:
    //   x1: 0 (c1 inactive)
    //   x2: 0 (c1, c3 inactive)
    //   x3: c2(1) = 1
    //   x4: c2(1) + c5(1) = 2
    //   x5: c4(1) = 1
    //   x6: c4(1) = 1 (c3 inactive)
    let result: ReturnType<typeof processGraph>;

    it('produces correct entity path counts', () => {
      result = selectAndQuery(['d2', 'd3']);
      const entities = result.outputs.slice(0, 6);
      expect(entities).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: true, pathCount: 1 },
        { nodeId: 'x4', selected: true, pathCount: 2 },
        { nodeId: 'x5', selected: true, pathCount: 1 },
        { nodeId: 'x6', selected: true, pathCount: 1 },
      ]);
    });

    it('produces correct category path counts', () => {
      result = selectAndQuery(['d2', 'd3']);
      const categories = result.outputs.slice(6, 11);
      expect(categories).toEqual([
        { nodeId: 'c1', selected: false, pathCount: 0 },
        { nodeId: 'c2', selected: true, pathCount: 1 },
        { nodeId: 'c3', selected: false, pathCount: 0 },
        { nodeId: 'c4', selected: true, pathCount: 1 },
        { nodeId: 'c5', selected: true, pathCount: 1 },
      ]);
    });

    it('has correct final state', () => {
      result = selectAndQuery(['d2', 'd3']);
      expect(result.state.selectedDomains).toEqual(new Set(['d2', 'd3']));
    });
  });

  describe('d1+d2+d3 (all domains) selected', () => {
    // d1 activates: c1(1), c2(1), c3(1)
    // d2 activates: c2(+1=2), c5(1)
    // d3 activates: c4(1)
    // Entity paths:
    //   x1: c1(1) = 1
    //   x2: c1(1) + c3(1) = 2
    //   x3: c1(1) + c2(2) = 3
    //   x4: c2(2) + c5(1) = 3
    //   x5: c4(1) = 1
    //   x6: c3(1) + c4(1) = 2
    let result: ReturnType<typeof processGraph>;

    it('produces correct entity path counts', () => {
      result = selectAndQuery(['d1', 'd2', 'd3']);
      const entities = result.outputs.slice(0, 6);
      expect(entities).toEqual([
        { nodeId: 'x1', selected: true, pathCount: 1 },
        { nodeId: 'x2', selected: true, pathCount: 2 },
        { nodeId: 'x3', selected: true, pathCount: 3 },
        { nodeId: 'x4', selected: true, pathCount: 3 },
        { nodeId: 'x5', selected: true, pathCount: 1 },
        { nodeId: 'x6', selected: true, pathCount: 2 },
      ]);
    });

    it('produces correct category path counts', () => {
      result = selectAndQuery(['d1', 'd2', 'd3']);
      const categories = result.outputs.slice(6, 11);
      expect(categories).toEqual([
        { nodeId: 'c1', selected: true, pathCount: 1 },
        { nodeId: 'c2', selected: true, pathCount: 2 },
        { nodeId: 'c3', selected: true, pathCount: 1 },
        { nodeId: 'c4', selected: true, pathCount: 1 },
        { nodeId: 'c5', selected: true, pathCount: 1 },
      ]);
    });

    it('has correct final state', () => {
      result = selectAndQuery(['d1', 'd2', 'd3']);
      expect(result.state.selectedDomains).toEqual(new Set(['d1', 'd2', 'd3']));
    });
  });
});
