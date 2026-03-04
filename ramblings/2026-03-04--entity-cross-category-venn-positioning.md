# Entity Cross-Category Venn Positioning Problem

## Problem

Entity4 belongs to categories **Research** (Science-only) and **Data** (Engineering+Science).

In the domain-level Venn diagram:
- Research is positioned in the **Science-exclusive** region (inside Science, outside Engineering)
- Data is positioned in the **Eng∩Sci intersection** region

These are two different Venn regions. The current algorithm places Entity4 using
`entityDomainLabels(x4)` = `['Engineering', 'Science']` → `regionCenter(['Engineering', 'Science'])`,
which puts it in the Eng∩Sci region near Data but far from Research.

```
  ┌─────────────────────────────────────┐
  │ Engineering                         │
  │                                     │
  │           ┌────────────────┐        │
  │           │  Eng∩Sci       │        │
  │           │                │        │
  │  Software │  Data ● Entity4│Research│  ← Entity4 near Data, far from Research
  │           │  Entity3       │        │
  │           │                │ Science│
  │  Hardware └────────────────┘        │
  │                                     │
  └─────────────────────────────────────┘
```

## Root Cause

The positioning uses **domain-level Venn regions** for entities, computed as the
union of all ancestor domains. This ignores the **category-level** membership.

Entity4 has domains {Engineering, Science} (via Data→Eng,Sci + Research→Sci),
so it goes to Eng∩Sci. But its *category* parents Research and Data are in
different sub-regions of this Venn, and Entity4 should visually connect to both.

## Additional Issue: 4-Circle Venn Limitations

With 4 circles, venn.js cannot represent all 16 possible regions. The layout
may produce geometrically impossible regions or distorted proportions. In our
case, Science has 2 entities (x3, x4) and Eng∩Sci also has 2 entities — meaning
Science should be nearly a subset of Engineering. But the 4-circle layout may
not achieve this, making the Science-exclusive region artificially large.

## Proposed Fix

**Entity positioning**: Place multi-category entities at the **centroid of their
parent category positions**, not at the domain-region center. This ensures
Entity4 appears between Research and Data, visually representing both memberships.

```typescript
// Instead of:
regionCenter(entityDomainLabels(entityId), domainCircles)

// Use:
centroid of catPositions for parent categories of entityId
```

## Venn Data for Reference

```
Domain entity sets:
  Engineering: {x1, x2, x3, x4, x6} = 5
  Science: {x3, x4} = 2
  Arts: {x5, x6} = 2
  Production: {x2, x5, x6} = 3

Pairwise intersections:
  Eng∩Sci: {x3, x4} = 2
  Eng∩Arts: {x6} = 1
  Eng∩Prod: {x2, x6} = 2
  Arts∩Prod: {x5, x6} = 2
  Sci∩Arts: ∅
  Sci∩Prod: ∅

Note: Science-exclusive = Sci - Eng∩Sci = 0 entities
      (all Science entities are also Engineering entities)
```
