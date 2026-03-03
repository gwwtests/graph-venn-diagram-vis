# Step 5: Evaluation and Selection

Comparison of all 8 visualization implementations (7 DAG + 1 Venn) for the dual-panel synchronized view.

## DAG Visualization Comparison

### Summary Matrix

| Library | Renderer | Bundle | Layout | Headless CDP | Visual Quality | Interaction |
|---------|----------|--------|--------|-------------|----------------|-------------|
| **D3 + d3-dag** | SVG | **118KB** | Sugiyama | Works | Excellent | Good |
| **force-graph** | Canvas 2D | 180KB | dagMode td | Works | Good | Good |
| **Sigma.js** | WebGL | 250KB | dagre ext. | Needs flags | Good | Good |
| **@memgraph/orb** | Canvas | 354KB | dagre ext. | Works | Good | Good |
| **Cytoscape.js** | Canvas | 530KB | dagre | Works | Good | Good |
| **vis-network** | Canvas | **643KB** | built-in | Works | Excellent | Excellent |
| **reagraph** | WebGL | **1.5MB** | built-in | SVG fallback | Good (fallback) | React-only |

### Detailed Analysis

#### D3.js + d3-dag — RECOMMENDED for DAG panel

* **Smallest DAG bundle** (118KB) — matters for dual-panel loading
* **SVG rendering** — same as Venn (D3 ecosystem consistency)
* Sugiyama layout produces optimal hierarchical positioning
* Full control over every visual element
* Color-coded tiers with path counts render clearly
* Same D3 event model as venn.js — simplifies synchronization code
* **Tradeoff**: More manual code required, but our graph is small (14 nodes)

#### vis-network — Strong runner-up

* Built-in hierarchical layout with `level` property — simplest setup
* DataSet.update() enables efficient incremental re-renders
* Diamond/box/ellipse shapes differentiate tiers well
* **Largest DAG bundle** (643KB) — significant for dual-panel
* Very polished out-of-box experience

#### force-graph — Compact alternative

* Very small API surface, dagMode 'td' is zero-config
* Animated particles on edges are visually distinctive
* 180KB bundle — good middle ground
* Node spacing can be tight without manual tuning

#### Cytoscape.js — Reliable workhorse

* CSS-like selectors are intuitive for styling
* dagre layout works well
* Moderate bundle (530KB)
* Requires full element rebuild + layout re-run on state change

#### Sigma.js — Performance king

* WebGL rendering handles 100k+ nodes (overkill for us)
* Requires special Chrome flags for headless testing
* 250KB bundle, clean architecture with graphology
* Node/edge reducers are elegant for dynamic styling

#### @memgraph/orb — Niche choice

* TypeScript-first, d3-zoom built in
* No built-in layout — needs external dagre
* 354KB bundle, canvas rendering
* Good but no standout advantage

#### reagraph — Heaviest option

* 1.5MB bundle (Three.js dependency) — too large for dual-panel
* WebGL doesn't work in headless Chrome — needed SVG fallback
* React-only — adds framework coupling
* Eliminated from consideration due to bundle size

### Selection: D3.js + d3-dag

**Primary reasons:**

1. **Ecosystem consistency** — same D3 as venn.js, shared event model
2. **Smallest bundle** — 118KB + 64KB venn = 182KB total (vs 643KB+ for alternatives)
3. **SVG** — both panels use SVG, enabling shared styling and transitions
4. **Full control** — small graph (14 nodes) makes manual rendering worthwhile
5. **No framework lock-in** — vanilla TypeScript, no React/Angular dependency

## Venn Visualization

Only one candidate (upsetjs/venn.js) — and it works well:

* Area-proportional circles correctly represent domain sizes
* 64KB bundle (22KB gzipped) — tiny
* SVG rendering with D3 integration
* Interactive click on circles/intersections
* Solid library, maintained fork of benfred/venn.js

**Selection: @upsetjs/venn.js** (only option, works great)

## Combined Architecture for Step 6

```
┌─────────────────────┬─────────────────────┐
│    DAG Panel         │    Venn Panel        │
│    D3 + d3-dag       │    upsetjs/venn.js   │
│    SVG               │    SVG               │
│    118KB             │    64KB              │
└──────────┬──────────┴──────────┬──────────┘
           │     Shared Engine    │
           │  processGraph()      │
           │  GraphState          │
           └─────────────────────┘
```

* Both panels share `GraphState` via the engine
* Click in DAG → update state → re-render Venn (and vice versa)
* D3 transitions can be coordinated across panels
* Total bundle: ~182KB (both panels + engine)

## Kept for Reference

All 7 DAG implementations remain in the codebase for comparison via `./serve-demos.sh`.
The dual-panel view (Step 6) will use D3 + d3-dag and venn.js.
