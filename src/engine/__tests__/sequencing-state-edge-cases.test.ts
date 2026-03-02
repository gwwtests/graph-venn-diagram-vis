import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph, GraphState } from '../types';

/**
 * Event sequencing and state mutation edge cases.
 * Verifies: pure function guarantee, state threading, interleaved get_state,
 * select/deselect toggling, output ordering, determinism.
 */

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

describe('pure function guarantee — initialState not mutated', () => {
  it('select events do not mutate original state', () => {
    const original: GraphState = { selectedDomains: new Set() };
    processGraph(masterGraph, original, [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
    ]);
    expect(original.selectedDomains.size).toBe(0);
  });

  it('deselect events do not mutate original state', () => {
    const original: GraphState = { selectedDomains: new Set(['d1', 'd2']) };
    processGraph(masterGraph, original, [
      { nodeId: 'd1', action: 'deselect' },
    ]);
    expect(original.selectedDomains).toEqual(new Set(['d1', 'd2']));
  });

  it('mixed events do not mutate original state', () => {
    const original: GraphState = { selectedDomains: new Set(['d1']) };
    processGraph(masterGraph, original, [
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x3', action: 'deselect' },
      { nodeId: 'd3', action: 'select' },
    ]);
    expect(original.selectedDomains).toEqual(new Set(['d1']));
  });
});

describe('state threading across multiple processGraph calls', () => {
  it('chains 3 calls — state flows correctly', () => {
    // Call 1: select d1
    const r1 = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
    ]);
    expect(r1.state.selectedDomains).toEqual(new Set(['d1']));

    // Call 2: use r1.state, select d2
    const r2 = processGraph(masterGraph, r1.state, [
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x3', action: 'get_state' },
    ]);
    expect(r2.state.selectedDomains).toEqual(new Set(['d1', 'd2']));
    expect(r2.outputs[0]).toEqual({ nodeId: 'x3', selected: true, pathCount: 3 });

    // Call 3: use r2.state, deselect d1
    const r3 = processGraph(masterGraph, r2.state, [
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'x3', action: 'get_state' },
    ]);
    expect(r3.state.selectedDomains).toEqual(new Set(['d2']));
    expect(r3.outputs[0]).toEqual({ nodeId: 'x3', selected: true, pathCount: 1 });
  });

  it('output state from call N is not mutated by call N+1', () => {
    const r1 = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
    ]);
    const r1StateCopy = new Set(r1.state.selectedDomains);

    // Call 2 uses r1.state
    processGraph(masterGraph, r1.state, [
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd3', action: 'select' },
    ]);

    // r1.state should be unchanged
    expect(r1.state.selectedDomains).toEqual(r1StateCopy);
  });
});

describe('get_state reflects earlier mutations in same event array', () => {
  it('select then get_state then deselect then get_state — all in one call', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },   // should be selected (d1->c1->x1)
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'x1', action: 'get_state' },   // should be unselected
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: false, pathCount: 0 });
  });

  it('category pathCount changes mid-sequence', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'c2', action: 'get_state' },   // c2 pathCount=1 (d1)
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'c2', action: 'get_state' },   // c2 pathCount=2 (d1+d2)
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c2', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'c2', selected: true, pathCount: 2 });
  });
});

describe('select->deselect->select same domain', () => {
  it('single toggle cycle — domain ends up selected', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'd1', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: true, pathCount: 1 });
  });

  it('triple toggle — domain ends up deselected', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'd1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'd1', selected: false, pathCount: 0 });
  });
});

describe('interleaved get_state snapshots at different points', () => {
  it('6 snapshots through a build-up and tear-down sequence', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'x4', action: 'get_state' },   // 0: nothing -> 0
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x4', action: 'get_state' },   // 1: d1->c2->x4 -> 1
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x4', action: 'get_state' },   // 2: d1->c2->x4, d2->c2->x4, d2->c5->x4 -> 3
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'x4', action: 'get_state' },   // 3: still 3 (d3 doesn't reach x4)
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'x4', action: 'get_state' },   // 4: d2->c2->x4, d2->c5->x4 -> 2
      { nodeId: 'd2', action: 'deselect' },
      { nodeId: 'x4', action: 'get_state' },   // 5: nothing reaches x4 -> 0
    ]);
    expect(result.outputs.map(o => o.pathCount)).toEqual([0, 1, 3, 3, 2, 0]);
  });
});

describe('pre-selected domains in initialState', () => {
  it('propagation works with pre-selected domains and only get_state events', () => {
    const preSelected: GraphState = { selectedDomains: new Set(['d1', 'd3']) };
    const result = processGraph(masterGraph, preSelected, [
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x5', action: 'get_state' },
      { nodeId: 'x6', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x5', selected: true, pathCount: 1 });
    // x6: d1->c3->x6 + d3->c4->x6 = 2
    expect(result.outputs[2]).toEqual({ nodeId: 'x6', selected: true, pathCount: 2 });
  });

  it('deselect on pre-selected state without any prior select events', () => {
    const preSelected: GraphState = { selectedDomains: new Set(['d1', 'd2', 'd3']) };
    const result = processGraph(masterGraph, preSelected, [
      { nodeId: 'c2', action: 'deselect' },  // removes d1, d2
      { nodeId: 'd3', action: 'get_state' },
      { nodeId: 'x5', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains).toEqual(new Set(['d3']));
    expect(result.outputs[0]).toEqual({ nodeId: 'd3', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x5', selected: true, pathCount: 1 });
  });
});

describe('output array ordering', () => {
  it('one output per get_state event, in exact order', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x6', action: 'get_state' },
    ]);
    expect(result.outputs.length).toBe(3);
    expect(result.outputs[0].nodeId).toBe('x3');
    expect(result.outputs[1].nodeId).toBe('x1');
    expect(result.outputs[2].nodeId).toBe('x6');
  });

  it('select and deselect produce no outputs', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
    ]);
    expect(result.outputs).toEqual([]);
  });

  it('reverse-order get_state preserved in output', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x6', action: 'get_state' },
      { nodeId: 'x5', action: 'get_state' },
      { nodeId: 'x4', action: 'get_state' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'x2', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs.map(o => o.nodeId)).toEqual(['x6', 'x5', 'x4', 'x3', 'x2', 'x1']);
  });
});

describe('determinism', () => {
  it('same inputs produce identical outputs across multiple calls', () => {
    const events = [
      { nodeId: 'd1', action: 'select' as const },
      { nodeId: 'd2', action: 'select' as const },
      { nodeId: 'x3', action: 'get_state' as const },
      { nodeId: 'x4', action: 'get_state' as const },
      { nodeId: 'd1', action: 'deselect' as const },
      { nodeId: 'x3', action: 'get_state' as const },
    ];
    const r1 = processGraph(masterGraph, createEmptyState(), events);
    const r2 = processGraph(masterGraph, createEmptyState(), events);
    const r3 = processGraph(masterGraph, createEmptyState(), events);

    expect(r1.outputs).toEqual(r2.outputs);
    expect(r2.outputs).toEqual(r3.outputs);
    expect(r1.state.selectedDomains).toEqual(r2.state.selectedDomains);
    expect(r2.state.selectedDomains).toEqual(r3.state.selectedDomains);
  });
});
