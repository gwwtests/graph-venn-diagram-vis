import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph } from '../types';

describe('Single domain selection', () => {
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

  describe('Only d1 selected', () => {
    // From spec: d1 connects to c1, c2, c3
    // c1→x1, c1→x2, c1→x3
    // c2→x3, c2→x4
    // c3→x2, c3→x6
    // Entity counts: x1=1, x2=2, x3=2, x4=1, x5=0, x6=1
    // Category counts: c1=1, c2=1, c3=1, c4=0, c5=0

    it('produces correct entity path counts', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'd1', action: 'select' },
        { nodeId: 'x1', action: 'get_state' },
        { nodeId: 'x2', action: 'get_state' },
        { nodeId: 'x3', action: 'get_state' },
        { nodeId: 'x4', action: 'get_state' },
        { nodeId: 'x5', action: 'get_state' },
        { nodeId: 'x6', action: 'get_state' },
      ]);
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: true, pathCount: 1 },
        { nodeId: 'x2', selected: true, pathCount: 2 },
        { nodeId: 'x3', selected: true, pathCount: 2 },
        { nodeId: 'x4', selected: true, pathCount: 1 },
        { nodeId: 'x5', selected: false, pathCount: 0 },
        { nodeId: 'x6', selected: true, pathCount: 1 },
      ]);
    });

    it('produces correct category path counts', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'd1', action: 'select' },
        { nodeId: 'c1', action: 'get_state' },
        { nodeId: 'c2', action: 'get_state' },
        { nodeId: 'c3', action: 'get_state' },
        { nodeId: 'c4', action: 'get_state' },
        { nodeId: 'c5', action: 'get_state' },
      ]);
      expect(result.outputs).toEqual([
        { nodeId: 'c1', selected: true, pathCount: 1 },
        { nodeId: 'c2', selected: true, pathCount: 1 },
        { nodeId: 'c3', selected: true, pathCount: 1 },
        { nodeId: 'c4', selected: false, pathCount: 0 },
        { nodeId: 'c5', selected: false, pathCount: 0 },
      ]);
    });
  });

  describe('Only d2 selected', () => {
    // From spec: d2 connects to c2, c5
    // c2→x3, c2→x4
    // c5→x4
    // Entity counts: x1=0, x2=0, x3=1, x4=2, x5=0, x6=0
    // Category counts: c1=0, c2=1, c3=0, c4=0, c5=1

    it('produces correct entity path counts', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'd2', action: 'select' },
        { nodeId: 'x1', action: 'get_state' },
        { nodeId: 'x2', action: 'get_state' },
        { nodeId: 'x3', action: 'get_state' },
        { nodeId: 'x4', action: 'get_state' },
        { nodeId: 'x5', action: 'get_state' },
        { nodeId: 'x6', action: 'get_state' },
      ]);
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: true, pathCount: 1 },
        { nodeId: 'x4', selected: true, pathCount: 2 },
        { nodeId: 'x5', selected: false, pathCount: 0 },
        { nodeId: 'x6', selected: false, pathCount: 0 },
      ]);
    });

    it('produces correct category path counts', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'd2', action: 'select' },
        { nodeId: 'c1', action: 'get_state' },
        { nodeId: 'c2', action: 'get_state' },
        { nodeId: 'c3', action: 'get_state' },
        { nodeId: 'c4', action: 'get_state' },
        { nodeId: 'c5', action: 'get_state' },
      ]);
      expect(result.outputs).toEqual([
        { nodeId: 'c1', selected: false, pathCount: 0 },
        { nodeId: 'c2', selected: true, pathCount: 1 },
        { nodeId: 'c3', selected: false, pathCount: 0 },
        { nodeId: 'c4', selected: false, pathCount: 0 },
        { nodeId: 'c5', selected: true, pathCount: 1 },
      ]);
    });
  });

  describe('Only d3 selected', () => {
    // From spec: d3 connects to c4
    // c4→x5, c4→x6
    // Entity counts: x1=0, x2=0, x3=0, x4=0, x5=1, x6=1
    // Category counts: c1=0, c2=0, c3=0, c4=1, c5=0

    it('produces correct entity path counts', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'd3', action: 'select' },
        { nodeId: 'x1', action: 'get_state' },
        { nodeId: 'x2', action: 'get_state' },
        { nodeId: 'x3', action: 'get_state' },
        { nodeId: 'x4', action: 'get_state' },
        { nodeId: 'x5', action: 'get_state' },
        { nodeId: 'x6', action: 'get_state' },
      ]);
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: false, pathCount: 0 },
        { nodeId: 'x4', selected: false, pathCount: 0 },
        { nodeId: 'x5', selected: true, pathCount: 1 },
        { nodeId: 'x6', selected: true, pathCount: 1 },
      ]);
    });

    it('produces correct category path counts', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'd3', action: 'select' },
        { nodeId: 'c1', action: 'get_state' },
        { nodeId: 'c2', action: 'get_state' },
        { nodeId: 'c3', action: 'get_state' },
        { nodeId: 'c4', action: 'get_state' },
        { nodeId: 'c5', action: 'get_state' },
      ]);
      expect(result.outputs).toEqual([
        { nodeId: 'c1', selected: false, pathCount: 0 },
        { nodeId: 'c2', selected: false, pathCount: 0 },
        { nodeId: 'c3', selected: false, pathCount: 0 },
        { nodeId: 'c4', selected: true, pathCount: 1 },
        { nodeId: 'c5', selected: false, pathCount: 0 },
      ]);
    });
  });

  describe('Domain state checks', () => {
    it('reports selected domain as selected with pathCount=1, others as unselected with pathCount=0', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'd1', action: 'select' },
        { nodeId: 'd1', action: 'get_state' },
        { nodeId: 'd2', action: 'get_state' },
        { nodeId: 'd3', action: 'get_state' },
      ]);
      expect(result.outputs).toEqual([
        { nodeId: 'd1', selected: true, pathCount: 1 },
        { nodeId: 'd2', selected: false, pathCount: 0 },
        { nodeId: 'd3', selected: false, pathCount: 0 },
      ]);
    });
  });
});
