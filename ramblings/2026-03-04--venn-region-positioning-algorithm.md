# Venn Region Positioning Algorithm

## Problem

Categories belong to specific domain subsets. A category in {Engineering, Science} must be placed in the Eng∩Sci region that is **outside** Arts and Production. The previous approach using centroid/repulsion heuristics placed elements in wrong regions.

## Solution: `computeTextCentre` from @upsetjs/venn.js

The library already implements the exact algorithm we need — **pole of inaccessibility** (Nelder-Mead optimization of `circleMargin`):

```typescript
import { computeTextCentre } from '@upsetjs/venn.js';

// Place category in Eng∩Sci but NOT in Arts or Production:
const pos = computeTextCentre(
  [engCircle, sciCircle],     // interior: must be inside these
  [artsCircle, prodCircle]    // exterior: must be outside these
);
```

### How it works

1. `circleMargin(point, interior, exterior)` = min distance to any boundary
   - For interior circles: `radius - distance(center, point)` (positive = inside)
   - For exterior circles: `distance(center, point) - radius` (positive = outside)
   - Returns minimum across all → maximizing this finds the most "centered" point
2. Nelder-Mead optimization maximizes `circleMargin` starting from sampled candidates
3. Result is the point with maximum clearance from all boundaries — the visual center

### Key insight

The `exterior` parameter is what was missing. Without it, categories were just placed at the centroid of parent circles, landing in overlap areas with other domains. By specifying non-parent domains as exterior, the algorithm pushes placement into the exclusive region.

## Circle geometry extraction from venn.js

After calling `chart()`, extract circle positions from SVG bounding boxes:

```typescript
container.selectAll('.venn-circle').each(function() {
  const pathBBox = el.select('path').node().getBBox();
  // cx = bbox.x + bbox.width/2, cy = bbox.y + bbox.height/2
  // radius = min(bbox.width, bbox.height) / 2
  // + account for group transform translate(tx, ty)
});
```

Alternatively, use `venn.layout()` directly to get circle positions without rendering.

## 4-circle limitation

4 circles can only represent 14 of 16 possible regions (some 4-set Venn regions don't exist geometrically). `computeTextCentre` returns `{x:0, y:-1000}` for impossible regions — detect and handle gracefully.
