import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph } from '../types';

/**
 * Deselection boundary edge cases not covered by deselection.test.ts.
 * Focuses on: x6/x4 specific ancestor paths, nonexistent nodes,
 * category deselection idempotency, deselect-then-reselect cycles.
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

describe('deselect x6 with partial domain selection', () => {
  // x6 parents: c3 (->d1), c4 (->d3). Ancestor domains: {d1, d3}

  it('only d1 selected — deselect x6 removes d1', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x6', action: 'deselect' },
      { nodeId: 'd1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'd1', selected: false, pathCount: 0 });
    expect(result.state.selectedDomains.size).toBe(0);
  });

  it('only d3 selected — deselect x6 removes d3', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'x6', action: 'deselect' },
      { nodeId: 'd3', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'd3', selected: false, pathCount: 0 });
    expect(result.state.selectedDomains.size).toBe(0);
  });

  it('d1+d3 selected — deselect x6 removes both d1 and d3', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'x6', action: 'deselect' },
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'd3', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'd1', selected: false, pathCount: 0 });
    expect(result.outputs[1]).toEqual({ nodeId: 'd3', selected: false, pathCount: 0 });
    expect(result.state.selectedDomains.size).toBe(0);
  });
});

describe('deselect x4 removes all ancestor domains', () => {
  // x4 parents: c2 (->d1, d2), c5 (->d2). Ancestor domains: {d1, d2}

  it('d1+d2 selected — deselect x4 removes both, nothing left', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x4', action: 'deselect' },
    ]);
    expect(result.state.selectedDomains.size).toBe(0);
  });

  it('d1+d2+d3 selected — deselect x4 removes d1+d2, d3 survives', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'x4', action: 'deselect' },
      { nodeId: 'd3', action: 'get_state' },
      { nodeId: 'x5', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains).toEqual(new Set(['d3']));
    expect(result.outputs[0]).toEqual({ nodeId: 'd3', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x5', selected: true, pathCount: 1 });
  });
});

describe('deselect nonexistent node ID', () => {
  it('with domains selected — no-op, state preserved', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'zzz_nonexistent', action: 'deselect' },
    ]);
    expect(result.state.selectedDomains).toEqual(new Set(['d1', 'd2']));
  });

  it('with nothing selected — no-op', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'zzz_nonexistent', action: 'deselect' },
    ]);
    expect(result.state.selectedDomains.size).toBe(0);
  });
});

describe('category deselection idempotency', () => {
  it('deselect c2 twice produces same result as once', () => {
    const once = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'c2', action: 'deselect' },
    ]);
    const twice = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'c2', action: 'deselect' },
      { nodeId: 'c2', action: 'deselect' },
    ]);
    expect(once.state.selectedDomains).toEqual(twice.state.selectedDomains);
  });

  it('deselect c4 twice produces same result as once', () => {
    const once = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'c4', action: 'deselect' },
    ]);
    const twice = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'c4', action: 'deselect' },
      { nodeId: 'c4', action: 'deselect' },
    ]);
    expect(once.state.selectedDomains).toEqual(twice.state.selectedDomains);
  });
});

describe('deselect then re-select ancestor domain', () => {
  it('deselect x6, re-select d3 — c4 path re-propagates', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'x6', action: 'deselect' },    // removes d1 and d3
      { nodeId: 'd3', action: 'select' },        // re-add d3
      { nodeId: 'x5', action: 'get_state' },
      { nodeId: 'x6', action: 'get_state' },
    ]);
    // d3->c4->x5 and d3->c4->x6 should be active again
    expect(result.outputs[0]).toEqual({ nodeId: 'x5', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x6', selected: true, pathCount: 1 });
    expect(result.state.selectedDomains).toEqual(new Set(['d3']));
  });

  it('deselect x4, re-select d2 — c2+c5 paths re-propagate', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x4', action: 'deselect' },    // removes d1 and d2
      { nodeId: 'd2', action: 'select' },        // re-add d2
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'x4', action: 'get_state' },
    ]);
    // d2->c2->x3 (1 path), d2->c2->x4 + d2->c5->x4 (2 paths)
    expect(result.outputs[0]).toEqual({ nodeId: 'x3', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x4', selected: true, pathCount: 2 });
    expect(result.state.selectedDomains).toEqual(new Set(['d2']));
  });
});
