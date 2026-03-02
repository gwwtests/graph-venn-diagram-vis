import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph } from '../types';

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

// Trivial graph: 1 domain, 1 category, 1 entity
const trivialGraph: DagGraph = {
  domains: [{ id: 'd1', label: 'Domain1' }],
  categories: [{ id: 'c1', label: 'Cat1' }],
  entities: [{ id: 'x1', label: 'Entity1' }],
  domainToCategory: [{ from: 'd1', to: 'c1' }],
  categoryToEntity: [{ from: 'c1', to: 'x1' }],
};

describe('Edge cases', () => {
  it('1. empty events → empty outputs, same state', () => {
    const initial = createEmptyState();
    initial.selectedDomains.add('d1');
    const result = processGraph(masterGraph, initial, []);
    expect(result.outputs).toEqual([]);
    expect(result.state.selectedDomains).toEqual(new Set(['d1']));
  });

  it('2. double-select d1 → same result as selecting once', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains).toEqual(new Set(['d1']));
    expect(result.outputs).toEqual([
      { nodeId: 'd1', selected: true, pathCount: 1 },
      { nodeId: 'x1', selected: true, pathCount: 1 },
    ]);
  });

  it('3. double-deselect d1 when not selected → no change', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'd1', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains.size).toBe(0);
    expect(result.outputs).toEqual([
      { nodeId: 'd1', selected: false, pathCount: 0 },
    ]);
  });

  it('4. deselect entity x3 when nothing selected → no change', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'x3', action: 'deselect' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'd2', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains.size).toBe(0);
    expect(result.outputs).toEqual([
      { nodeId: 'x3', selected: false, pathCount: 0 },
      { nodeId: 'd1', selected: false, pathCount: 0 },
      { nodeId: 'd2', selected: false, pathCount: 0 },
    ]);
  });

  it('5. select all then deselect all → everything inactive', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'd2', action: 'deselect' },
      { nodeId: 'd3', action: 'deselect' },
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'd2', action: 'get_state' },
      { nodeId: 'd3', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'x5', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains.size).toBe(0);
    expect(result.outputs).toEqual([
      { nodeId: 'd1', selected: false, pathCount: 0 },
      { nodeId: 'd2', selected: false, pathCount: 0 },
      { nodeId: 'd3', selected: false, pathCount: 0 },
      { nodeId: 'x1', selected: false, pathCount: 0 },
      { nodeId: 'x3', selected: false, pathCount: 0 },
      { nodeId: 'x5', selected: false, pathCount: 0 },
    ]);
  });

  it('6. get_state on unknown nodeId → selected=false, pathCount=0', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'nonexistent', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'nonexistent', selected: false, pathCount: 0 },
    ]);
  });
});

describe('Sequential event chains', () => {
  it('7. build up then tear down — interleaved events in one call', () => {
    // select d1, get_state x1 (1)
    // select d2, get_state x3 (3 since d1+d2)
    // select d3, get_state x5 (1)
    // deselect d1, get_state x1 (0)
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'x5', action: 'get_state' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'x1', selected: true, pathCount: 1 },   // d1 only
      { nodeId: 'x3', selected: true, pathCount: 3 },   // d1+d2: d1→c1→x3, d1→c2→x3, d2→c2→x3
      { nodeId: 'x5', selected: true, pathCount: 1 },   // d3→c4→x5
      { nodeId: 'x1', selected: false, pathCount: 0 },  // d1 deselected, x1 only via c1→d1
    ]);
  });

  it('8. re-select after deselect: select d1, deselect d1, select d1', () => {
    const result = processGraph(trivialGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'd1', selected: true, pathCount: 1 },
      { nodeId: 'x1', selected: true, pathCount: 1 },
    ]);
  });

  it('9. deselect entity then re-select domain', () => {
    // select d1+d2, deselect x3 (removes d1+d2 via aggressive deselection), select d1
    // x3 parent categories: c1 (→d1), c2 (→d1,d2) → removes {d1,d2}
    // then re-select d1
    // x1: d1→c1→x1 = 1
    // x3: d1→c1→x3 + d1→c2→x3 = 2
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x3', action: 'deselect' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x3', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'x1', selected: true, pathCount: 1 },
      { nodeId: 'x3', selected: true, pathCount: 2 },
    ]);
  });

  it('10. isolated path: select d3 only', () => {
    // d3→c4→x5 (count=1), d3→c4→x6 (count=1)
    // x6 also has c3→x6 but c3←d1 and d1 not selected, so only c4 path
    // x1 not reachable from d3
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'x5', action: 'get_state' },
      { nodeId: 'x6', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'x5', selected: true, pathCount: 1 },
      { nodeId: 'x6', selected: true, pathCount: 1 },
      { nodeId: 'x1', selected: false, pathCount: 0 },
    ]);
  });
});

describe('State persistence across processGraph calls', () => {
  it('11a. state carries between calls — select in call1, query in call2', () => {
    // call1: select d1
    const result1 = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
    ]);
    expect(result1.state.selectedDomains).toEqual(new Set(['d1']));

    // call2: use state1, query x1
    const result2 = processGraph(masterGraph, result1.state, [
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result2.outputs).toEqual([
      { nodeId: 'x1', selected: true, pathCount: 1 },
    ]);
  });

  it('11b. state carries between calls — add domain in subsequent call', () => {
    // call1: select d1
    const state1 = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
    ]).state;

    // call2: select d2 on top of state1, query x3
    // d1+d2: x3 = d1→c1→x3, d1→c2→x3, d2→c2→x3 = 3
    const result3 = processGraph(masterGraph, state1, [
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x3', action: 'get_state' },
    ]);
    expect(result3.outputs).toEqual([
      { nodeId: 'x3', selected: true, pathCount: 3 },
    ]);
    expect(result3.state.selectedDomains).toEqual(new Set(['d1', 'd2']));
  });

  it('11c. processGraph does not mutate the input state', () => {
    const initial = createEmptyState();
    initial.selectedDomains.add('d1');
    const frozenDomains = new Set(initial.selectedDomains);

    // This call adds d2 internally
    processGraph(masterGraph, initial, [
      { nodeId: 'd2', action: 'select' },
    ]);

    // Original state should be unchanged
    expect(initial.selectedDomains).toEqual(frozenDomains);
  });
});
