# Venn Diagram Alternatives & Algorithm Research

## 4-Circle Geometric Limitation

With 4 circles, only **14 of 16** possible regions are representable. The missing two are
the "diagonal" exclusions: A∩C\B\D and B∩D\A\C. This is provable via Euler's planar graph
formula: V - E + F = 2 → max regions = n² - n + 2 = 14 for n=4, but need 2^4 = 16.

`computeTextCentre()` returns `{x:0, y:-1000}` for impossible regions — we detect this
with the `y < -500` check.

## Better Approaches for 4+ Sets

### Ellipse-Based Venn (Edwards-Venn)
- **Edwards construction**: uses "cogwheel" curves on a sphere, projected back to plane
- All 2^n regions guaranteed for any n
- **genvenn** (JS): `drawEllipseBase()` renders symmetric ellipse Venn for 4,5,7 sets
- **eulerr** (R only): Nelder-Mead optimization with 5 DOF per ellipse (cx,cy,rx,ry,θ)
- Symmetric Venn diagrams exist **only when n is prime** (Henderson 1963)

### Euler Diagrams (vs Venn)
- Euler: only draw regions with non-zero cardinality
- Better for sparse data (our case: Sci∩Arts=∅, Sci∩Prod=∅)
- venn.js already supports this — zero-cardinality → non-overlapping circles

### UpSet Plots
- Matrix encoding: rows=sets, columns=intersection combos, dots+bars
- Scales to arbitrary set count, no geometric constraints
- **@upsetjs/upsetjs** — same ecosystem as our venn.js
- Karnaugh Map variant for exactly 4 sets (4×4 Gray-coded grid)

## Entity Positioning in Regions

### Problem: Cross-Category Entities
Entity4 belongs to Research (Sci-only) and Data (Eng+Sci). These categories are in
different Venn regions, so entity can't be "inside both" in the domain Venn.

### Solution Applied: Category-Centroid
Place multi-category entities at centroid of parent category positions.
- Old: regionCenter(domainLabels) → Eng∩Sci center → 98px from Research, 0px from Data
- New: centroid(Research.pos, Data.pos) → 49px from each (balanced)

### Alternatives Considered
| Approach | Mechanism | Trade-off |
|----------|-----------|-----------|
| **Category centroid** ✅ | Midpoint of parent positions | Simple, balanced, may be outside Venn regions |
| **Duplication + link** | Clone dot in each region, connect with line | Visual clutter for many entities |
| **Bubble Sets** | Isocontour overlay reaching around members | Complex, works for fixed layouts |
| **UpSet plot** | Abandon circle metaphor | Best for analysis, loses spatial intuition |
| **KelpFusion** | Spanning tree through members | Good for maps, overkill here |

## Key Papers & Libraries

1. **Riche & Dwyer 2010** — Element duplication in Euler diagrams (IEEE InfoVis)
2. **Lex et al. 2014** — UpSet: Visualization of Intersecting Sets (PMC4720993)
3. **Collins et al. 2009** — Bubble Sets (IEEE TVCG)
4. **Alsallakh et al. 2016** — State-of-the-Art of Set Visualization (CGF survey)
5. **eulerr** — https://jolars.github.io/eulerr/ (R, area-proportional ellipses)
6. **genvenn** — http://habtom.github.io/biojs-vis-genvenn/ (JS, symmetric ellipse Venn)
7. **@upsetjs/upsetjs** — https://github.com/upsetjs/upsetjs (JS, UpSet+Karnaugh)

## Recommendation

For our current 4-domain case, the circle-based Venn with category-centroid entity
positioning works adequately. If we add more domains or the layout becomes too distorted:

1. **Short-term**: Switch to Euler mode (drop empty intersections)
2. **Medium-term**: Add UpSet plot as companion view (already in upsetjs ecosystem)
3. **Long-term**: Consider ellipse-based Venn via eulerr or genvenn
