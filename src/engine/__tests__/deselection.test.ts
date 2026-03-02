import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph, GraphEvent } from '../types';

/**
 * Deselection scenario tests for the Graph Engine.
 *
 * All tests use the master example graph from docs/design/06-engine-behavioral-spec.md.
 * The pattern: start with all domains selected (d1+d2+d3), deselect one node,
 * then verify the resulting entity/category path counts.
 *
 * Deselection is "aggressive" — deselecting an entity or category removes
 * ALL ancestor domains that could reach it through any path.
 */
describe('deselection scenarios', () => {
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

  /** Helper: select all three domains then apply additional events. */
  function selectAllThen(...extraEvents: GraphEvent[]) {
    return processGraph(masterGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      ...extraEvents,
    ]);
  }

  /** Helper: build get_state events for all six entities. */
  function getStateAllEntities(): GraphEvent[] {
    return [
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x2', action: 'get_state' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'x4', action: 'get_state' },
      { nodeId: 'x5', action: 'get_state' },
      { nodeId: 'x6', action: 'get_state' },
    ];
  }

  // ── Entity deselection tests ─────────────────────────────────────────

  describe('entity deselection from all-selected state', () => {
    it('deselect x1: removes d1, leaving {d2, d3}', () => {
      // x1 → parent cat c1 → parent domain d1
      // Remaining: {d2, d3} → active cats: c2(d2), c4(d3), c5(d2)
      const result = selectAllThen(
        { nodeId: 'x1', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d2', 'd3']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: true, pathCount: 1 },  // d2→c2→x3
        { nodeId: 'x4', selected: true, pathCount: 2 },  // d2→c2→x4, d2→c5→x4
        { nodeId: 'x5', selected: true, pathCount: 1 },  // d3→c4→x5
        { nodeId: 'x6', selected: true, pathCount: 1 },  // d3→c4→x6
      ]);
    });

    it('deselect x3: removes d1 and d2, leaving {d3}', () => {
      // x3 → parent cats c1(→d1), c2(→d1,d2)
      // Ancestor domains: {d1, d2} → removed → remaining: {d3}
      // Only d3→c4 active → x5(1), x6(1)
      const result = selectAllThen(
        { nodeId: 'x3', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d3']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: false, pathCount: 0 },
        { nodeId: 'x4', selected: false, pathCount: 0 },
        { nodeId: 'x5', selected: true, pathCount: 1 },
        { nodeId: 'x6', selected: true, pathCount: 1 },
      ]);
    });

    it('deselect x5: removes d3, leaving {d1, d2}', () => {
      // x5 → parent cat c4 → parent domain d3
      // Remaining: {d1, d2} — same as d1+d2 from spec
      const result = selectAllThen(
        { nodeId: 'x5', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d1', 'd2']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: true, pathCount: 1 },
        { nodeId: 'x2', selected: true, pathCount: 2 },
        { nodeId: 'x3', selected: true, pathCount: 3 },
        { nodeId: 'x4', selected: true, pathCount: 3 },
        { nodeId: 'x5', selected: false, pathCount: 0 },
        { nodeId: 'x6', selected: true, pathCount: 1 },  // d1→c3→x6 only
      ]);
    });

    it('deselect x6: removes d1 and d3, leaving {d2}', () => {
      // x6 → parent cats c3(→d1), c4(→d3)
      // Ancestor domains: {d1, d3} → removed → remaining: {d2}
      // d2→c2, d2→c5 active → same as d2-only from spec
      const result = selectAllThen(
        { nodeId: 'x6', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d2']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: true, pathCount: 1 },  // d2→c2→x3
        { nodeId: 'x4', selected: true, pathCount: 2 },  // d2→c2→x4, d2→c5→x4
        { nodeId: 'x5', selected: false, pathCount: 0 },
        { nodeId: 'x6', selected: false, pathCount: 0 },
      ]);
    });
  });

  // ── Category deselection tests ───────────────────────────────────────

  describe('category deselection from all-selected state', () => {
    it('deselect c1: removes d1, leaving {d2, d3}', () => {
      // c1 parent domains: d1 only
      // Remaining: {d2, d3} → active cats: c2(d2), c4(d3), c5(d2)
      const result = selectAllThen(
        { nodeId: 'c1', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d2', 'd3']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: true, pathCount: 1 },
        { nodeId: 'x4', selected: true, pathCount: 2 },
        { nodeId: 'x5', selected: true, pathCount: 1 },
        { nodeId: 'x6', selected: true, pathCount: 1 },
      ]);
    });

    it('deselect c2: removes d1 and d2, leaving {d3}', () => {
      // c2 parent domains: d1, d2
      // Remaining: {d3} → only c4 active → x5(1), x6(1)
      const result = selectAllThen(
        { nodeId: 'c2', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d3']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: false, pathCount: 0 },
        { nodeId: 'x4', selected: false, pathCount: 0 },
        { nodeId: 'x5', selected: true, pathCount: 1 },
        { nodeId: 'x6', selected: true, pathCount: 1 },
      ]);
    });

    it('deselect c5: removes d2, leaving {d1, d3}', () => {
      // c5 parent domains: d2 only
      // Remaining: {d1, d3} → active cats: c1(d1), c2(d1), c3(d1), c4(d3)
      const result = selectAllThen(
        { nodeId: 'c5', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d1', 'd3']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: true, pathCount: 1 },  // d1→c1→x1
        { nodeId: 'x2', selected: true, pathCount: 2 },  // d1→c1→x2, d1→c3→x2
        { nodeId: 'x3', selected: true, pathCount: 2 },  // d1→c1→x3, d1→c2→x3
        { nodeId: 'x4', selected: true, pathCount: 1 },  // d1→c2→x4
        { nodeId: 'x5', selected: true, pathCount: 1 },  // d3→c4→x5
        { nodeId: 'x6', selected: true, pathCount: 2 },  // d1→c3→x6, d3→c4→x6
      ]);
    });
  });

  // ── Sequential deselection tests ─────────────────────────────────────

  describe('sequential deselection', () => {
    it('deselect x1 then x4: removes d1 then d2, leaving {d3}', () => {
      // Step 1: deselect x1 → parent cat c1 → parent domain d1 → remove d1
      //   State: {d2, d3}
      // Step 2: deselect x4 → parent cats c2(→d1,d2), c5(→d2)
      //   d1 already gone, d2 removed → remaining: {d3}
      const result = selectAllThen(
        { nodeId: 'x1', action: 'deselect' },
        { nodeId: 'x4', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d3']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: false, pathCount: 0 },
        { nodeId: 'x4', selected: false, pathCount: 0 },
        { nodeId: 'x5', selected: true, pathCount: 1 },
        { nodeId: 'x6', selected: true, pathCount: 1 },
      ]);
    });

    it('deselect x5 then x1: removes d3 then d1, leaving {d2}', () => {
      // Step 1: deselect x5 → parent cat c4 → parent domain d3 → remove d3
      //   State: {d1, d2}
      // Step 2: deselect x1 → parent cat c1 → parent domain d1 → remove d1
      //   State: {d2}
      const result = selectAllThen(
        { nodeId: 'x5', action: 'deselect' },
        { nodeId: 'x1', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d2']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: true, pathCount: 1 },  // d2→c2→x3
        { nodeId: 'x4', selected: true, pathCount: 2 },  // d2→c2→x4, d2→c5→x4
        { nodeId: 'x5', selected: false, pathCount: 0 },
        { nodeId: 'x6', selected: false, pathCount: 0 },
      ]);
    });

    it('deselect c1 then c4: removes d1 then d3, leaving {d2}', () => {
      // Step 1: deselect c1 → parent domain d1 → remove d1. State: {d2, d3}
      // Step 2: deselect c4 → parent domain d3 → remove d3. State: {d2}
      const result = selectAllThen(
        { nodeId: 'c1', action: 'deselect' },
        { nodeId: 'c4', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains).toEqual(new Set(['d2']));
      expect(result.outputs).toEqual([
        { nodeId: 'x1', selected: false, pathCount: 0 },
        { nodeId: 'x2', selected: false, pathCount: 0 },
        { nodeId: 'x3', selected: true, pathCount: 1 },
        { nodeId: 'x4', selected: true, pathCount: 2 },
        { nodeId: 'x5', selected: false, pathCount: 0 },
        { nodeId: 'x6', selected: false, pathCount: 0 },
      ]);
    });

    it('deselect all domains one by one leaves nothing selected', () => {
      const result = selectAllThen(
        { nodeId: 'd1', action: 'deselect' },
        { nodeId: 'd2', action: 'deselect' },
        { nodeId: 'd3', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(result.state.selectedDomains.size).toBe(0);
      for (const output of result.outputs) {
        expect(output.selected).toBe(false);
        expect(output.pathCount).toBe(0);
      }
    });
  });

  // ── Deselection with category-level verification ─────────────────────

  describe('category-level state after deselection', () => {
    it('deselect x1 verifies category pathCounts too', () => {
      // After removing d1, remaining {d2, d3}
      // c1: 0 (no domain), c2: 1 (d2), c3: 0, c4: 1 (d3), c5: 1 (d2)
      const result = selectAllThen(
        { nodeId: 'x1', action: 'deselect' },
        { nodeId: 'c1', action: 'get_state' },
        { nodeId: 'c2', action: 'get_state' },
        { nodeId: 'c3', action: 'get_state' },
        { nodeId: 'c4', action: 'get_state' },
        { nodeId: 'c5', action: 'get_state' },
      );

      expect(result.outputs).toEqual([
        { nodeId: 'c1', selected: false, pathCount: 0 },
        { nodeId: 'c2', selected: true, pathCount: 1 },
        { nodeId: 'c3', selected: false, pathCount: 0 },
        { nodeId: 'c4', selected: true, pathCount: 1 },
        { nodeId: 'c5', selected: true, pathCount: 1 },
      ]);
    });

    it('deselect c2 verifies category pathCounts too', () => {
      // After removing d1 and d2, remaining {d3}
      // c1: 0, c2: 0, c3: 0, c4: 1 (d3), c5: 0
      const result = selectAllThen(
        { nodeId: 'c2', action: 'deselect' },
        { nodeId: 'c1', action: 'get_state' },
        { nodeId: 'c2', action: 'get_state' },
        { nodeId: 'c3', action: 'get_state' },
        { nodeId: 'c4', action: 'get_state' },
        { nodeId: 'c5', action: 'get_state' },
      );

      expect(result.outputs).toEqual([
        { nodeId: 'c1', selected: false, pathCount: 0 },
        { nodeId: 'c2', selected: false, pathCount: 0 },
        { nodeId: 'c3', selected: false, pathCount: 0 },
        { nodeId: 'c4', selected: true, pathCount: 1 },
        { nodeId: 'c5', selected: false, pathCount: 0 },
      ]);
    });
  });

  // ── Domain-level state verification after entity/category deselection ─

  describe('domain-level state after deselection', () => {
    it('deselect x6 verifies domain states', () => {
      // x6 ancestors: c3→d1, c4→d3. Remove d1, d3. Remaining: {d2}
      const result = selectAllThen(
        { nodeId: 'x6', action: 'deselect' },
        { nodeId: 'd1', action: 'get_state' },
        { nodeId: 'd2', action: 'get_state' },
        { nodeId: 'd3', action: 'get_state' },
      );

      expect(result.outputs).toEqual([
        { nodeId: 'd1', selected: false, pathCount: 0 },
        { nodeId: 'd2', selected: true, pathCount: 1 },
        { nodeId: 'd3', selected: false, pathCount: 0 },
      ]);
    });

    it('deselect x3 verifies domain states', () => {
      // x3 ancestors: c1→d1, c2→d1,d2. Remove d1, d2. Remaining: {d3}
      const result = selectAllThen(
        { nodeId: 'x3', action: 'deselect' },
        { nodeId: 'd1', action: 'get_state' },
        { nodeId: 'd2', action: 'get_state' },
        { nodeId: 'd3', action: 'get_state' },
      );

      expect(result.outputs).toEqual([
        { nodeId: 'd1', selected: false, pathCount: 0 },
        { nodeId: 'd2', selected: false, pathCount: 0 },
        { nodeId: 'd3', selected: true, pathCount: 1 },
      ]);
    });
  });

  // ── Idempotent / no-op deselection ───────────────────────────────────

  describe('idempotent and no-op deselection', () => {
    it('deselecting an entity when nothing is selected is a no-op', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'x3', action: 'deselect' },
        ...getStateAllEntities(),
      ]);

      expect(result.state.selectedDomains.size).toBe(0);
      for (const output of result.outputs) {
        expect(output.selected).toBe(false);
        expect(output.pathCount).toBe(0);
      }
    });

    it('deselecting a category when nothing is selected is a no-op', () => {
      const result = processGraph(masterGraph, createEmptyState(), [
        { nodeId: 'c2', action: 'deselect' },
        ...getStateAllEntities(),
      ]);

      expect(result.state.selectedDomains.size).toBe(0);
      for (const output of result.outputs) {
        expect(output.selected).toBe(false);
        expect(output.pathCount).toBe(0);
      }
    });

    it('deselecting the same entity twice produces same result as once', () => {
      const resultOnce = selectAllThen(
        { nodeId: 'x1', action: 'deselect' },
        ...getStateAllEntities(),
      );
      const resultTwice = selectAllThen(
        { nodeId: 'x1', action: 'deselect' },
        { nodeId: 'x1', action: 'deselect' },
        ...getStateAllEntities(),
      );

      expect(resultOnce.state.selectedDomains).toEqual(resultTwice.state.selectedDomains);
      expect(resultOnce.outputs).toEqual(resultTwice.outputs);
    });
  });
});
