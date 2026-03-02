import { describe, it, expect } from 'vitest';
import { processGraph, createEmptyState } from '../engine';
import type { DagGraph } from '../types';

/**
 * Path count computation edge cases using custom DAG topologies.
 * Verifies domain_vector x adjacency(d->c) -> category_counts x adjacency(c->e) -> entity_counts.
 */

describe('diamond topology — same domain reaches entity via 2 categories', () => {
  // d1->c1->x1, d1->c2->x1
  const diamondGraph: DagGraph = {
    domains: [{ id: 'd1', label: 'D1' }],
    categories: [{ id: 'c1', label: 'C1' }, { id: 'c2', label: 'C2' }],
    entities: [{ id: 'x1', label: 'X1' }],
    domainToCategory: [{ from: 'd1', to: 'c1' }, { from: 'd1', to: 'c2' }],
    categoryToEntity: [{ from: 'c1', to: 'x1' }, { from: 'c2', to: 'x1' }],
  };

  it('entity pathCount=2 when domain selected (two paths)', () => {
    const result = processGraph(diamondGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: true, pathCount: 2 });
  });

  it('each category has pathCount=1', () => {
    const result = processGraph(diamondGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'c2', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c1', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'c2', selected: true, pathCount: 1 });
  });

  it('entity pathCount=0 when nothing selected', () => {
    const result = processGraph(diamondGraph, createEmptyState(), [
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: false, pathCount: 0 });
  });

  it('deselect d1 returns entity to 0', () => {
    const result = processGraph(diamondGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: false, pathCount: 0 });
  });
});

describe('wide fan-out — 1 domain, 5 categories, 1 entity', () => {
  const fanOutGraph: DagGraph = {
    domains: [{ id: 'd1', label: 'D1' }],
    categories: [
      { id: 'c1', label: 'C1' },
      { id: 'c2', label: 'C2' },
      { id: 'c3', label: 'C3' },
      { id: 'c4', label: 'C4' },
      { id: 'c5', label: 'C5' },
    ],
    entities: [{ id: 'x1', label: 'X1' }],
    domainToCategory: [
      { from: 'd1', to: 'c1' },
      { from: 'd1', to: 'c2' },
      { from: 'd1', to: 'c3' },
      { from: 'd1', to: 'c4' },
      { from: 'd1', to: 'c5' },
    ],
    categoryToEntity: [
      { from: 'c1', to: 'x1' },
      { from: 'c2', to: 'x1' },
      { from: 'c3', to: 'x1' },
      { from: 'c4', to: 'x1' },
      { from: 'c5', to: 'x1' },
    ],
  };

  it('entity pathCount=5 when domain selected', () => {
    const result = processGraph(fanOutGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: true, pathCount: 5 });
  });

  it('each category has pathCount=1', () => {
    const result = processGraph(fanOutGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'c3', action: 'get_state' },
      { nodeId: 'c5', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'c1', selected: true, pathCount: 1 },
      { nodeId: 'c3', selected: true, pathCount: 1 },
      { nodeId: 'c5', selected: true, pathCount: 1 },
    ]);
  });

  it('entity pathCount=0 when nothing selected', () => {
    const result = processGraph(fanOutGraph, createEmptyState(), [
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: false, pathCount: 0 });
  });
});

describe('wide fan-in — 3 domains, 1 category, 1 entity', () => {
  const fanInGraph: DagGraph = {
    domains: [
      { id: 'd1', label: 'D1' },
      { id: 'd2', label: 'D2' },
      { id: 'd3', label: 'D3' },
    ],
    categories: [{ id: 'c1', label: 'C1' }],
    entities: [{ id: 'x1', label: 'X1' }],
    domainToCategory: [
      { from: 'd1', to: 'c1' },
      { from: 'd2', to: 'c1' },
      { from: 'd3', to: 'c1' },
    ],
    categoryToEntity: [{ from: 'c1', to: 'x1' }],
  };

  it('all 3 domains selected — category pathCount=3, entity pathCount=3', () => {
    const result = processGraph(fanInGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c1', selected: true, pathCount: 3 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: true, pathCount: 3 });
  });

  it('1 domain selected — pathCount=1', () => {
    const result = processGraph(fanInGraph, createEmptyState(), [
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c1', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: true, pathCount: 1 });
  });

  it('2 domains selected — pathCount=2', () => {
    const result = processGraph(fanInGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c1', selected: true, pathCount: 2 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: true, pathCount: 2 });
  });

  it('deselect entity with fan-in — removes all 3 ancestor domains', () => {
    const result = processGraph(fanInGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'x1', action: 'deselect' },
    ]);
    expect(result.state.selectedDomains.size).toBe(0);
  });

  it('deselect category with fan-in — removes all 3 parent domains', () => {
    const result = processGraph(fanInGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'c1', action: 'deselect' },
    ]);
    expect(result.state.selectedDomains.size).toBe(0);
  });

  it('partial deselect via domain — only that domain removed', () => {
    const result = processGraph(fanInGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'd3', action: 'select' },
      { nodeId: 'd2', action: 'deselect' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c1', selected: true, pathCount: 2 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: true, pathCount: 2 });
  });
});

describe('deep chain — minimal d1->c1->x1', () => {
  const chainGraph: DagGraph = {
    domains: [{ id: 'd1', label: 'D1' }],
    categories: [{ id: 'c1', label: 'C1' }],
    entities: [{ id: 'x1', label: 'X1' }],
    domainToCategory: [{ from: 'd1', to: 'c1' }],
    categoryToEntity: [{ from: 'c1', to: 'x1' }],
  };

  it('all pathCounts=1 when selected', () => {
    const result = processGraph(chainGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'd1', selected: true, pathCount: 1 },
      { nodeId: 'c1', selected: true, pathCount: 1 },
      { nodeId: 'x1', selected: true, pathCount: 1 },
    ]);
  });

  it('all pathCounts=0 when not selected', () => {
    const result = processGraph(chainGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'get_state' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'd1', selected: false, pathCount: 0 },
      { nodeId: 'c1', selected: false, pathCount: 0 },
      { nodeId: 'x1', selected: false, pathCount: 0 },
    ]);
  });

  it('round-trip: select then deselect returns to 0', () => {
    const result = processGraph(chainGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd1', action: 'deselect' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x1', selected: false, pathCount: 0 });
  });
});

describe('disconnected entity — orphan with no parent categories', () => {
  const orphanEntityGraph: DagGraph = {
    domains: [{ id: 'd1', label: 'D1' }],
    categories: [{ id: 'c1', label: 'C1' }],
    entities: [
      { id: 'x1', label: 'X1' },
      { id: 'x_orphan', label: 'Orphan' },
    ],
    domainToCategory: [{ from: 'd1', to: 'c1' }],
    categoryToEntity: [{ from: 'c1', to: 'x1' }],
    // x_orphan has no categoryToEntity edge
  };

  it('orphan entity always pathCount=0 even when domains selected', () => {
    const result = processGraph(orphanEntityGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x_orphan', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x_orphan', selected: false, pathCount: 0 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: true, pathCount: 1 });
  });

  it('deselecting orphan entity is no-op', () => {
    const result = processGraph(orphanEntityGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x_orphan', action: 'deselect' },
      { nodeId: 'd1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'd1', selected: true, pathCount: 1 });
  });

  it('orphan with nothing selected — still pathCount=0', () => {
    const result = processGraph(orphanEntityGraph, createEmptyState(), [
      { nodeId: 'x_orphan', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x_orphan', selected: false, pathCount: 0 });
  });
});

describe('orphan category — no parent domains', () => {
  const orphanCatGraph: DagGraph = {
    domains: [{ id: 'd1', label: 'D1' }],
    categories: [
      { id: 'c1', label: 'C1' },
      { id: 'c_orphan', label: 'Orphan' },
    ],
    entities: [
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
    ],
    domainToCategory: [{ from: 'd1', to: 'c1' }],
    // c_orphan has no domainToCategory edge
    categoryToEntity: [
      { from: 'c1', to: 'x1' },
      { from: 'c_orphan', to: 'x2' },
    ],
  };

  it('orphan category always pathCount=0', () => {
    const result = processGraph(orphanCatGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'c_orphan', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'c_orphan', selected: false, pathCount: 0 });
  });

  it('entity behind orphan category always pathCount=0', () => {
    const result = processGraph(orphanCatGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x2', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x2', selected: false, pathCount: 0 });
    expect(result.outputs[1]).toEqual({ nodeId: 'x1', selected: true, pathCount: 1 });
  });

  it('deselecting orphan category is no-op', () => {
    const result = processGraph(orphanCatGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'c_orphan', action: 'deselect' },
      { nodeId: 'd1', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'd1', selected: true, pathCount: 1 });
  });
});

describe('independent subgraphs — two isolated chains', () => {
  const twoChainGraph: DagGraph = {
    domains: [
      { id: 'dA', label: 'DA' },
      { id: 'dB', label: 'DB' },
    ],
    categories: [
      { id: 'cA', label: 'CA' },
      { id: 'cB', label: 'CB' },
    ],
    entities: [
      { id: 'xA', label: 'XA' },
      { id: 'xB', label: 'XB' },
    ],
    domainToCategory: [
      { from: 'dA', to: 'cA' },
      { from: 'dB', to: 'cB' },
    ],
    categoryToEntity: [
      { from: 'cA', to: 'xA' },
      { from: 'cB', to: 'xB' },
    ],
  };

  it('selecting dA does not activate chain B', () => {
    const result = processGraph(twoChainGraph, createEmptyState(), [
      { nodeId: 'dA', action: 'select' },
      { nodeId: 'xA', action: 'get_state' },
      { nodeId: 'xB', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'xA', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'xB', selected: false, pathCount: 0 });
  });

  it('selecting dB does not activate chain A', () => {
    const result = processGraph(twoChainGraph, createEmptyState(), [
      { nodeId: 'dB', action: 'select' },
      { nodeId: 'xA', action: 'get_state' },
      { nodeId: 'xB', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'xA', selected: false, pathCount: 0 });
    expect(result.outputs[1]).toEqual({ nodeId: 'xB', selected: true, pathCount: 1 });
  });

  it('both selected — each chain independent', () => {
    const result = processGraph(twoChainGraph, createEmptyState(), [
      { nodeId: 'dA', action: 'select' },
      { nodeId: 'dB', action: 'select' },
      { nodeId: 'xA', action: 'get_state' },
      { nodeId: 'xB', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'xA', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'xB', selected: true, pathCount: 1 });
  });

  it('deselecting in chain A leaves chain B intact', () => {
    const result = processGraph(twoChainGraph, createEmptyState(), [
      { nodeId: 'dA', action: 'select' },
      { nodeId: 'dB', action: 'select' },
      { nodeId: 'xA', action: 'deselect' },
      { nodeId: 'xB', action: 'get_state' },
      { nodeId: 'dB', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains).toEqual(new Set(['dB']));
    expect(result.outputs[0]).toEqual({ nodeId: 'xB', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'dB', selected: true, pathCount: 1 });
  });

  it('deselecting in chain B leaves chain A intact', () => {
    const result = processGraph(twoChainGraph, createEmptyState(), [
      { nodeId: 'dA', action: 'select' },
      { nodeId: 'dB', action: 'select' },
      { nodeId: 'cB', action: 'deselect' },
      { nodeId: 'xA', action: 'get_state' },
      { nodeId: 'dA', action: 'get_state' },
    ]);
    expect(result.state.selectedDomains).toEqual(new Set(['dA']));
    expect(result.outputs[0]).toEqual({ nodeId: 'xA', selected: true, pathCount: 1 });
    expect(result.outputs[1]).toEqual({ nodeId: 'dA', selected: true, pathCount: 1 });
  });
});

describe('combined topology — diamond + fan-in + orphans', () => {
  // d1->c1->x1, d1->c2->x1 (diamond for x1, pathCount=2)
  // d2->c1 (fan-in on c1, now c1 has 2 parent domains)
  // d2->c3->x2 (separate path)
  // c_orphan->x3 (orphan category, x3 unreachable)
  // x_orphan has no edges (orphan entity)
  const combinedGraph: DagGraph = {
    domains: [
      { id: 'd1', label: 'D1' },
      { id: 'd2', label: 'D2' },
    ],
    categories: [
      { id: 'c1', label: 'C1' },
      { id: 'c2', label: 'C2' },
      { id: 'c3', label: 'C3' },
      { id: 'c_orphan', label: 'Orphan Cat' },
    ],
    entities: [
      { id: 'x1', label: 'X1' },
      { id: 'x2', label: 'X2' },
      { id: 'x3', label: 'X3' },
      { id: 'x_orphan', label: 'Orphan Ent' },
    ],
    domainToCategory: [
      { from: 'd1', to: 'c1' },
      { from: 'd1', to: 'c2' },
      { from: 'd2', to: 'c1' },
      { from: 'd2', to: 'c3' },
    ],
    categoryToEntity: [
      { from: 'c1', to: 'x1' },
      { from: 'c2', to: 'x1' },
      { from: 'c3', to: 'x2' },
      { from: 'c_orphan', to: 'x3' },
    ],
  };

  it('d1 only: x1=2 (diamond d1->c1->x1 + d1->c2->x1), x2=0, orphans=0', () => {
    const result = processGraph(combinedGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x2', action: 'get_state' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'x_orphan', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'x1', selected: true, pathCount: 2 },
      { nodeId: 'x2', selected: false, pathCount: 0 },
      { nodeId: 'x3', selected: false, pathCount: 0 },
      { nodeId: 'x_orphan', selected: false, pathCount: 0 },
    ]);
  });

  it('d2 only: x1=1 (d2->c1->x1), x2=1 (d2->c3->x2), orphans=0', () => {
    const result = processGraph(combinedGraph, createEmptyState(), [
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x2', action: 'get_state' },
      { nodeId: 'x3', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'x1', selected: true, pathCount: 1 },
      { nodeId: 'x2', selected: true, pathCount: 1 },
      { nodeId: 'x3', selected: false, pathCount: 0 },
    ]);
  });

  it('d1+d2: c1=2 (fan-in), x1=3 (c1:2 + c2:1), x2=1 (d2->c3->x2)', () => {
    const result = processGraph(combinedGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'c1', action: 'get_state' },
      { nodeId: 'x1', action: 'get_state' },
      { nodeId: 'x2', action: 'get_state' },
    ]);
    expect(result.outputs).toEqual([
      { nodeId: 'c1', selected: true, pathCount: 2 },
      { nodeId: 'x1', selected: true, pathCount: 3 },
      { nodeId: 'x2', selected: true, pathCount: 1 },
    ]);
  });

  it('orphan category x3 always 0 regardless of selections', () => {
    const result = processGraph(combinedGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x3', action: 'get_state' },
      { nodeId: 'c_orphan', action: 'get_state' },
    ]);
    expect(result.outputs[0]).toEqual({ nodeId: 'x3', selected: false, pathCount: 0 });
    expect(result.outputs[1]).toEqual({ nodeId: 'c_orphan', selected: false, pathCount: 0 });
  });

  it('deselect x1 removes both d1 and d2 (aggressive)', () => {
    const result = processGraph(combinedGraph, createEmptyState(), [
      { nodeId: 'd1', action: 'select' },
      { nodeId: 'd2', action: 'select' },
      { nodeId: 'x1', action: 'deselect' },
    ]);
    // x1 parents: c1 (->d1,d2), c2 (->d1). Ancestor domains: {d1, d2}
    expect(result.state.selectedDomains.size).toBe(0);
  });
});
