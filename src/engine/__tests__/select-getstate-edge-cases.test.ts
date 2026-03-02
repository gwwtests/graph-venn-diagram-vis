import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph, GraphState } from '../types';

/**
 * Edge cases for select and get_state actions not covered by other test files.
 * Focuses on: selecting non-domain nodes, get_state variations,
 * select/deselect asymmetry for categories and entities.
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

describe('select on non-domain nodes', () => {
  it('selecting a category adds its id to selectedDomains but has no propagation effect', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'c1', action: 'select' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x2', action: 'get_state' },
    ]);
    // "c1" is in selectedDomains but c1 is a category, not a domain
    expect(result.state.selectedDomains.has('c1')).toBe(true);
    // c1 as a category: pathCount = number of selected DOMAINS connecting to it = 0
    expect(result.outputs[0]).toEqual({ nodeId: 'c1', selected: false, pathCount: 0 });
    // entities downstream of c1 remain unselected
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: false, pathCount: 0 });
    expect(result.outputs[2]).toEqual({ nodeId: 'x2', selected: false, pathCount: 0 });
  });

  it('selecting an entity adds its id to selectedDomains but has no propagation effect', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'x1', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'd1', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains.has('x1')).toBe(true);
    // x1 as entity: pathCount from parent categories = 0 (no domains selected)
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: false, pathCount: 0 });
    expect(result.outputs[1]).toEqual({ nodeId: 'c1', selected: false, pathCount: 0 });
    expect(result.outputs[2]).toEqual({ nodeId: 'd1', selected: false, pathCount: 0 });
  });

  it('selecting a category alongside a real domain — only the domain propagates', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'c1', action: 'select' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    // c1 gets pathCount=1 from d1 (the real domain), not from "c1" in selectedDomains
    expect(result.outputs[0]).toEqual({ nodeId: 'c1', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: true, pathCount: 1 });
  });
});

describe('select/deselect asymmetry', () => {
  it('category select adds "c1" to selectedDomains; deselect c1 removes parent domain d1, leaving ghost "c1"', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'c1', action: 'select' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'c1', action: 'deselect' },
    ]);
    // Deselecting c1 (a category) removes its parent domain d1
    expect(result.state.selectedDomains.has('d1')).toBe(false);
    // But "c1" was added by select and deselect-category doesn't remove it
    expect(result.state.selectedDomains.has('c1')).toBe(true);
  });

  it('entity select adds "x1" to selectedDomains; deselect x1 removes ancestor domains, leaving ghost "x1"', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'x1', action: 'select' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x1', action: 'deselect' },
    ]);
    // Deselecting x1 (entity) removes ancestor domains: x1->c1->d1
    expect(result.state.selectedDomains.has('d1')).toBe(false);
    // "x1" remains as ghost entry
    expect(result.state.selectedDomains.has('x1')).toBe(true);
  });
});

describe('get_state with partial domain selection', () => {
  it('category c2 with 0 parent domains selected', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'c2', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c2', selected: false, pathCount: 0 });
  });

  it('category c2 with 1 of 2 parent domains selected (d1 only)', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'c2', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c2', selected: true, pathCount: 1 });
  });

  it('category c2 with 1 of 2 parent domains selected (d2 only)', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'c2', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c2', selected: true, pathCount: 1 });
  });

  it('category c2 with both parent domains selected (d1+d2)', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'c2', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c2', selected: true, pathCount: 2 });
  });
});

describe('interleaved get_state captures intermediate state', () => {
  it('get_state at multiple points shows pathCount growing as domains are added', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'x3', action: 'get_state' },  // 0: nothing selected
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x3', action: 'get_state' },  // 1: d1->c1->x3 + d1->c2->x3 = 2
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x3', action: 'get_state' },  // 2: + d2->c2->x3 = 3
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x3', selected: false, pathCount: 0 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x3', selected: true, pathCount: 2 });
    expect(result.outputs[2]).toEqual({ nodeId: 'x3', selected: true, pathCount: 3 });
  });

  it('get_state on domain tracks its own membership through select/deselect', () => {
    const result = processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'd1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'd1', selected: false, pathCount: 0 });
    expect(result.outputs[1]).toEqual({ nodeId: 'd1', selected: true, pathCount: 1 });
    expect(result.outputs[2]).toEqual({ nodeId: 'd1', selected: false, pathCount: 0 });
  });
});
