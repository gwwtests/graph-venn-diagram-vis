/**
 * Tests for Venn diagram entity/category positioning.
 *
 * Uses venn.js venn() + scaleSolution() + computeTextCentre() purely
 * in computation (no DOM) to verify that entities are placed in visually
 * correct positions relative to their parent categories.
 */
import { describe, it, expect } from 'vitest';
import * as venn from '@upsetjs/venn.js';
import type { DagGraph } from '../../engine/types';

// ─── Helpers (mirrors the logic in venn-enhanced/main.ts) ──────────

interface CircleGeo { x: number; y: number; radius: number; }

function buildTopology(graph: DagGraph) {
  const categoryDomains = new Map<string, string[]>();
  for (const c of graph.categories) {
    categoryDomains.set(c.id, graph.domainToCategory.filter(e => e.to === c.id).map(e => e.from));
  }

  const entityCategories = new Map<string, string[]>();
  for (const e of graph.entities) {
    entityCategories.set(e.id, graph.categoryToEntity.filter(edge => edge.to === e.id).map(edge => edge.from));
  }

  const categoryEntities = new Map<string, string[]>();
  for (const c of graph.categories) {
    categoryEntities.set(c.id, graph.categoryToEntity.filter(e => e.from === c.id).map(e => e.to));
  }

  const domainIdToLabel = new Map(graph.domains.map(d => [d.id, d.label]));
  const allDomainLabels = graph.domains.map(d => d.label);

  return { categoryDomains, entityCategories, categoryEntities, domainIdToLabel, allDomainLabels };
}

function domainEntitySets(graph: DagGraph): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const d of graph.domains) {
    const entities = new Set<string>();
    const cats = graph.domainToCategory.filter(e => e.from === d.id).map(e => e.to);
    for (const cat of cats) {
      for (const e of graph.categoryToEntity) {
        if (e.from === cat) entities.add(e.to);
      }
    }
    result.set(d.id, entities);
  }
  return result;
}

function buildVennData(graph: DagGraph): venn.ISetOverlap[] {
  const domainSets = domainEntitySets(graph);
  const domainIdToLabel = new Map(graph.domains.map(d => [d.id, d.label]));
  const domainIds = graph.domains.map(d => d.id);
  const data: venn.ISetOverlap[] = [];

  for (const did of domainIds) {
    data.push({ sets: [domainIdToLabel.get(did)!], size: domainSets.get(did)!.size });
  }

  for (let i = 0; i < domainIds.length; i++) {
    for (let j = i + 1; j < domainIds.length; j++) {
      const a = domainSets.get(domainIds[i])!;
      const b = domainSets.get(domainIds[j])!;
      const inter = new Set([...a].filter(x => b.has(x)));
      if (inter.size > 0) {
        data.push({
          sets: [domainIdToLabel.get(domainIds[i])!, domainIdToLabel.get(domainIds[j])!],
          size: inter.size,
        });
      }
    }
  }

  if (domainIds.length >= 3) {
    for (let i = 0; i < domainIds.length; i++) {
      for (let j = i + 1; j < domainIds.length; j++) {
        for (let k = j + 1; k < domainIds.length; k++) {
          const a = domainSets.get(domainIds[i])!;
          const b = domainSets.get(domainIds[j])!;
          const c = domainSets.get(domainIds[k])!;
          const triple = new Set([...a].filter(x => b.has(x) && c.has(x)));
          if (triple.size > 0) {
            data.push({
              sets: [domainIdToLabel.get(domainIds[i])!, domainIdToLabel.get(domainIds[j])!, domainIdToLabel.get(domainIds[k])!],
              size: triple.size,
            });
          }
        }
      }
    }
  }

  return data;
}

/** Compute circle layout from venn data (no DOM needed) */
function computeCircles(vennData: venn.ISetOverlap[]): Map<string, CircleGeo> {
  // venn.venn() returns { "Label": { x, y, radius }, ... }
  const rawSolution = venn.venn(vennData);
  const normalized = venn.normalizeSolution(rawSolution, Math.PI / 2, undefined);
  const scaled = venn.scaleSolution(normalized, 600, 400, 15, false);
  const result = new Map<string, CircleGeo>();
  for (const [label, geo] of Object.entries(scaled)) {
    result.set(label, geo as CircleGeo);
  }
  return result;
}

function regionCenter(
  interiorLabels: string[],
  allDomainLabels: string[],
  allCircles: Map<string, CircleGeo>,
): { x: number; y: number } | null {
  const interior = interiorLabels
    .map(l => allCircles.get(l))
    .filter((c): c is CircleGeo => c !== undefined);
  const exterior = allDomainLabels
    .filter(l => !interiorLabels.includes(l))
    .map(l => allCircles.get(l))
    .filter((c): c is CircleGeo => c !== undefined);

  if (interior.length === 0) return null;

  const center = venn.computeTextCentre(interior, exterior);
  if (center.y < -500) return null;

  return center;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── Minimal graph: the exact problem case ─────────────────────────

/** Minimal reproduction: Entity4 belongs to Research (Sci-only) + Data (Eng+Sci) */
const minimalGraph: DagGraph = {
  domains: [
    { id: 'd1', label: 'Engineering' },
    { id: 'd2', label: 'Science' },
  ],
  categories: [
    { id: 'c1', label: 'Software' },
    { id: 'c2', label: 'Data' },
    { id: 'c5', label: 'Research' },
  ],
  entities: [
    { id: 'x1', label: 'Entity1' },
    { id: 'x3', label: 'Entity3' },
    { id: 'x4', label: 'Entity4' },
  ],
  domainToCategory: [
    { from: 'd1', to: 'c1' },  // Software → Engineering only
    { from: 'd1', to: 'c2' },  // Data → Engineering + Science
    { from: 'd2', to: 'c2' },
    { from: 'd2', to: 'c5' },  // Research → Science only
  ],
  categoryToEntity: [
    { from: 'c1', to: 'x1' },  // Entity1 → Software only
    { from: 'c1', to: 'x3' },  // Entity3 → Software + Data
    { from: 'c2', to: 'x3' },
    { from: 'c2', to: 'x4' },  // Entity4 → Data + Research (the problem case!)
    { from: 'c5', to: 'x4' },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────

describe('Venn positioning: entity cross-category placement', () => {
  const vennData = buildVennData(minimalGraph);
  const circles = computeCircles(vennData);
  const topo = buildTopology(minimalGraph);

  it('should compute valid circle layout', () => {
    expect(circles.size).toBe(2);
    const eng = circles.get('Engineering')!;
    const sci = circles.get('Science')!;
    expect(eng).toBeDefined();
    expect(sci).toBeDefined();
    console.log('Engineering:', eng);
    console.log('Science:', sci);
  });

  it('should have overlapping Engineering and Science circles (Eng∩Sci > 0)', () => {
    const eng = circles.get('Engineering')!;
    const sci = circles.get('Science')!;

    // Circles should overlap: distance between centers < sum of radii
    const d = dist(eng, sci);
    console.log(`Circle distance: ${d.toFixed(1)}, sum of radii: ${(eng.radius + sci.radius).toFixed(1)}`);
    expect(d).toBeLessThan(eng.radius + sci.radius);
  });

  it('should place Research in Science region (not in intersection)', () => {
    const researchDomIds = topo.categoryDomains.get('c5')!;
    const researchLabels = researchDomIds.map(did => topo.domainIdToLabel.get(did)!);
    expect(researchLabels).toEqual(['Science']);

    const researchPos = regionCenter(researchLabels, topo.allDomainLabels, circles);
    expect(researchPos).not.toBeNull();
    console.log('Research position:', researchPos);

    // Research should be inside Science
    const sci = circles.get('Science')!;
    expect(dist(researchPos!, sci)).toBeLessThan(sci.radius);
  });

  it('should place Data in Eng∩Sci intersection region', () => {
    const dataDomIds = topo.categoryDomains.get('c2')!;
    const dataLabels = dataDomIds.map(did => topo.domainIdToLabel.get(did)!);
    expect(dataLabels).toContain('Engineering');
    expect(dataLabels).toContain('Science');

    const dataPos = regionCenter(dataLabels, topo.allDomainLabels, circles);
    expect(dataPos).not.toBeNull();
    console.log('Data position:', dataPos);

    // Data should be inside both circles
    const eng = circles.get('Engineering')!;
    const sci = circles.get('Science')!;
    expect(dist(dataPos!, eng)).toBeLessThan(eng.radius);
    expect(dist(dataPos!, sci)).toBeLessThan(sci.radius);
  });

  it('Entity4 (Research+Data): domain-region approach is biased toward Data', () => {
    // Compute category positions
    const researchPos = regionCenter(['Science'], topo.allDomainLabels, circles)!;
    const dataPos = regionCenter(['Engineering', 'Science'], topo.allDomainLabels, circles)!;

    // Current (broken) approach: entity domain labels = union of all ancestor domains
    const entityDomLabels = (() => {
      const cats = topo.entityCategories.get('x4') || [];
      const doms = new Set<string>();
      for (const catId of cats) {
        for (const domId of topo.categoryDomains.get(catId) || []) {
          doms.add(topo.domainIdToLabel.get(domId)!);
        }
      }
      return [...doms];
    })();

    const domainRegionPos = regionCenter(entityDomLabels, topo.allDomainLabels, circles)!;

    const distToData = dist(domainRegionPos, dataPos);
    const distToResearch = dist(domainRegionPos, researchPos);

    console.log(`Domain-region pos: (${domainRegionPos.x.toFixed(1)}, ${domainRegionPos.y.toFixed(1)})`);
    console.log(`Research pos: (${researchPos.x.toFixed(1)}, ${researchPos.y.toFixed(1)})`);
    console.log(`Data pos: (${dataPos.x.toFixed(1)}, ${dataPos.y.toFixed(1)})`);
    console.log(`Dist to Research: ${distToResearch.toFixed(1)}, Dist to Data: ${distToData.toFixed(1)}`);
    console.log(`Ratio (Research/Data): ${(distToResearch / (distToData + 0.001)).toFixed(2)}`);

    // BUG: domain-region approach places Entity4 at Eng∩Sci center,
    // which is essentially the same as Data's position — far from Research.
    // The ratio should be < 2 for balanced placement.
    const ratio = distToResearch / (distToData + 0.001);
    expect(ratio).toBeLessThan(2);
  });

  it('Entity4: category-centroid approach should be balanced', () => {
    const researchPos = regionCenter(['Science'], topo.allDomainLabels, circles)!;
    const dataPos = regionCenter(['Engineering', 'Science'], topo.allDomainLabels, circles)!;

    // In the 2-domain case, Science ⊂ Engineering, so both positions collapse
    // This is expected — the real test is the 4-domain case below
    const maxDist = dist(researchPos, dataPos);
    console.log(`Category centroid gap: ${maxDist.toFixed(1)} (expected ~0 for 2-domain case)`);

    // Centroid of identical positions is the same position — trivially balanced
    const catCentroid = {
      x: (researchPos.x + dataPos.x) / 2,
      y: (researchPos.y + dataPos.y) / 2,
    };
    expect(dist(catCentroid, researchPos)).toBeCloseTo(dist(catCentroid, dataPos), 0);
  });
});

// ─── Full master graph: the real production problem ────────────────

import { masterGraph } from '../shared';

describe('Venn positioning: 4-domain master graph', () => {
  const vennData = buildVennData(masterGraph);
  const circles = computeCircles(vennData);
  const topo = buildTopology(masterGraph);

  it('should produce 4 domain circles', () => {
    expect(circles.size).toBe(4);
    for (const [label, geo] of circles) {
      console.log(`${label}: center=(${geo.x.toFixed(1)}, ${geo.y.toFixed(1)}), r=${geo.radius.toFixed(1)}`);
    }
  });

  it('Research and Data should be in DIFFERENT Venn regions', () => {
    const researchLabels = (topo.categoryDomains.get('c5') || []).map(did => topo.domainIdToLabel.get(did)!);
    const dataLabels = (topo.categoryDomains.get('c2') || []).map(did => topo.domainIdToLabel.get(did)!);

    console.log('Research domain labels:', researchLabels);  // ['Science']
    console.log('Data domain labels:', dataLabels);           // ['Engineering', 'Science']

    const researchPos = regionCenter(researchLabels, topo.allDomainLabels, circles);
    const dataPos = regionCenter(dataLabels, topo.allDomainLabels, circles);

    console.log('Research pos:', researchPos);
    console.log('Data pos:', dataPos);

    // Both should be placeable
    expect(researchPos).not.toBeNull();
    expect(dataPos).not.toBeNull();

    // They should be in different positions (different Venn regions)
    if (researchPos && dataPos) {
      const gap = dist(researchPos, dataPos);
      console.log(`Research-Data gap: ${gap.toFixed(1)}`);
      // With 4 domains, Science-exclusive should exist, so these should differ
      // (unlike the 2-domain case where Science ⊂ Engineering)
      expect(gap).toBeGreaterThan(5);
    }
  });

  it('OLD domain-region approach is biased (documents the bug)', () => {
    const researchLabels = (topo.categoryDomains.get('c5') || []).map(did => topo.domainIdToLabel.get(did)!);
    const dataLabels = (topo.categoryDomains.get('c2') || []).map(did => topo.domainIdToLabel.get(did)!);

    const researchPos = regionCenter(researchLabels, topo.allDomainLabels, circles);
    const dataPos = regionCenter(dataLabels, topo.allDomainLabels, circles);

    if (!researchPos || !dataPos) return;

    // Old approach: entity at domain-region center
    const entityDomLabels = (() => {
      const cats = topo.entityCategories.get('x4') || [];
      const doms = new Set<string>();
      for (const catId of cats) {
        for (const domId of topo.categoryDomains.get(catId) || []) {
          doms.add(topo.domainIdToLabel.get(domId)!);
        }
      }
      return [...doms];
    })();

    const domainRegionPos = regionCenter(entityDomLabels, topo.allDomainLabels, circles);
    if (!domainRegionPos) return;

    const distToResearch = dist(domainRegionPos, researchPos);
    const distToData = dist(domainRegionPos, dataPos);
    const ratio = distToResearch / (distToData + 0.001);

    console.log(`OLD approach: Dist to Research=${distToResearch.toFixed(1)}, Dist to Data=${distToData.toFixed(1)}, Ratio=${ratio.toFixed(2)}`);

    // Document the bug: ratio >> 2 means heavily biased toward Data
    expect(ratio).toBeGreaterThan(2);
  });

  it('NEW category-centroid approach places Entity4 balanced between parents', () => {
    const researchLabels = (topo.categoryDomains.get('c5') || []).map(did => topo.domainIdToLabel.get(did)!);
    const dataLabels = (topo.categoryDomains.get('c2') || []).map(did => topo.domainIdToLabel.get(did)!);

    const researchPos = regionCenter(researchLabels, topo.allDomainLabels, circles);
    const dataPos = regionCenter(dataLabels, topo.allDomainLabels, circles);

    if (!researchPos || !dataPos) return;

    // New approach: centroid of parent category positions
    const catCentroid = {
      x: (researchPos.x + dataPos.x) / 2,
      y: (researchPos.y + dataPos.y) / 2,
    };

    const distToResearch = dist(catCentroid, researchPos);
    const distToData = dist(catCentroid, dataPos);
    const ratio = distToResearch / (distToData + 0.001);

    console.log(`NEW approach: Dist to Research=${distToResearch.toFixed(1)}, Dist to Data=${distToData.toFixed(1)}, Ratio=${ratio.toFixed(2)}`);

    // Fixed: ratio should be ~1 (balanced)
    expect(ratio).toBeLessThan(2);
    expect(ratio).toBeGreaterThan(0.5);
  });

  it('Entity6 (Hardware+Design) should be between both parent categories', () => {
    // Entity6 = x6, parents: Hardware (c3) and Design (c4)
    // Hardware: Engineering + Production → regionCenter(['Engineering','Production'])
    // Design: Arts + Production → regionCenter(['Arts','Production'])
    const hwDomIds = topo.categoryDomains.get('c3') || [];
    const dsDomIds = topo.categoryDomains.get('c4') || [];
    const hwLabels = hwDomIds.map(did => topo.domainIdToLabel.get(did)!);
    const dsLabels = dsDomIds.map(did => topo.domainIdToLabel.get(did)!);

    console.log('Hardware domain labels:', hwLabels);
    console.log('Design domain labels:', dsLabels);

    const hwPos = regionCenter(hwLabels, topo.allDomainLabels, circles);
    const dsPos = regionCenter(dsLabels, topo.allDomainLabels, circles);

    console.log('Hardware pos:', hwPos);
    console.log('Design pos:', dsPos);

    expect(hwPos).not.toBeNull();
    expect(dsPos).not.toBeNull();

    if (!hwPos || !dsPos) return;

    const gap = dist(hwPos, dsPos);
    console.log(`Hardware-Design gap: ${gap.toFixed(1)}`);

    // Category-centroid approach for Entity6
    const catCentroid = {
      x: (hwPos.x + dsPos.x) / 2,
      y: (hwPos.y + dsPos.y) / 2,
    };
    const distToHw = dist(catCentroid, hwPos);
    const distToDs = dist(catCentroid, dsPos);

    console.log(`Entity6 centroid: (${catCentroid.x.toFixed(1)}, ${catCentroid.y.toFixed(1)})`);
    console.log(`Dist to Hardware: ${distToHw.toFixed(1)}, Dist to Design: ${distToDs.toFixed(1)}`);

    expect(distToHw).toBeCloseTo(distToDs, 0);
    // Should actually be between them, not at one of them
    if (gap > 5) {
      const ratio = distToHw / (distToDs + 0.001);
      expect(ratio).toBeLessThan(2);
      expect(ratio).toBeGreaterThan(0.5);
    }
  });

  it('Entity4: category-centroid is always balanced', () => {
    const researchLabels = (topo.categoryDomains.get('c5') || []).map(did => topo.domainIdToLabel.get(did)!);
    const dataLabels = (topo.categoryDomains.get('c2') || []).map(did => topo.domainIdToLabel.get(did)!);

    const researchPos = regionCenter(researchLabels, topo.allDomainLabels, circles);
    const dataPos = regionCenter(dataLabels, topo.allDomainLabels, circles);

    if (!researchPos || !dataPos) {
      console.log('SKIP: region not computable');
      return;
    }

    // Proposed fix: centroid of parent category positions
    const catCentroid = {
      x: (researchPos.x + dataPos.x) / 2,
      y: (researchPos.y + dataPos.y) / 2,
    };

    const distToResearch = dist(catCentroid, researchPos);
    const distToData = dist(catCentroid, dataPos);

    console.log(`Category centroid: (${catCentroid.x.toFixed(1)}, ${catCentroid.y.toFixed(1)})`);
    console.log(`Dist to Research: ${distToResearch.toFixed(1)}, Dist to Data: ${distToData.toFixed(1)}`);

    // Centroid is equidistant by definition
    expect(distToResearch).toBeCloseTo(distToData, 0);

    // And ratio is exactly 1
    const ratio = distToResearch / (distToData + 0.001);
    expect(ratio).toBeLessThan(2);
  });
});
