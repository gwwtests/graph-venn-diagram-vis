# Framework Research Summary

## Graph/DAG Visualization Libraries

| Library | License | ~Stars | Active | Hierarchical Layout | Interactivity | Fit Score |
|---------|---------|--------|--------|---------------------|---------------|-----------|
| **Cytoscape.js** | MIT | 10.8k | Yes (v3.33, 2025) | Via dagre/ELK adapters | Excellent built-in | ★★★★★ |
| **G6 (AntV) v5** | MIT | 12k | Yes (v5, 2025) | Built-in dagre | Excellent built-in | ★★★★☆ |
| **React Flow** | MIT | 24k | Yes | Via dagre/ELK plugins | Excellent (React) | ★★★★☆ |
| **vis-network** | Apache-2.0/MIT | 3.2k | Yes (2025) | Built-in hierarchical | Good | ★★★★☆ |
| **D3.js + d3-dag** | BSD-3 / MIT | 112k | Yes / light | Via d3-dag plugin | Manual (full control) | ★★☆☆☆ |
| **Sigma.js v3** | MIT | 11.6k | Yes (2024) | Needs external layout | Good | ★★★☆☆ |
| **dagre** | MIT | 5.1k | Stale/revived | Core purpose (layout only) | N/A (no renderer) | Layout engine |
| **ELK.js** | EPL-2.0 | 2.1k | Yes | Best-in-class | N/A (no renderer) | Layout engine (license concern) |
| **Cola.js** | MIT | 2k | Inactive | Not hierarchical | Via adapters | ★☆☆☆☆ |
| **force-graph** | MIT | 1.9k (+5k react) | Yes (2025) | Native `dagMode` | Canvas 2D, zero-config DAG | ★★★★☆ |
| **reagraph** | Apache-2.0 | ~1k | Yes (2025) | Built-in hierarchical | WebGL (Three.js), React-only | ★★★☆☆ |
| **@antv/x6** | MIT | 6.5k | Yes (2026) | Via @antv/layout (dagre) | SVG, diagram editor SDK | ★★★☆☆ |
| **@logicflow/core** | Apache-2.0 | 11.2k | Yes (2026) | Built-in + dagre ext | SVG, workflow/BPMN focused | ★★☆☆☆ |

### Top Pick: Cytoscape.js

* MIT license, actively maintained
* Built-in click/select events, style API with CSS-like selectors
* Hierarchical layout via `cytoscape-dagre` plugin (wraps dagre)
* Optional `cytoscape-elk` for higher-quality layouts
* Compound nodes for visual grouping
* Built-in graph algorithms (BFS, DFS, etc.)
* Headless mode for server-side computation

### Strong candidate: vis-network (Tripleter reference)

* Apache-2.0/MIT dual license, actively maintained (v9.1.6)
* Built-in hierarchical layout: `layout: { hierarchical: { direction: 'UD' } }`
* Reactive `vis.DataSet` — add/remove/update triggers automatic re-render
* Working reference implementation: [Tripleter vis/v5](https://tripleter.github.io/vis/v5/)
  * Local copy: `/mnt/ro/github/tripleter/tripleter.github.io/static/vis/v5/`
  * Self-contained vanilla JS, single HTML file, no build system needed
  * Uses force-directed `forceAtlas2Based` physics, but hierarchical mode available
* Lower learning curve than Cytoscape.js — simpler API
* Limitation: less flexible styling than Cytoscape's CSS-like selectors

### Strong candidate: force-graph (vasturiano)

* MIT license, active 2025 (v1.51.x, 166k weekly npm downloads)
* Native `dagMode` prop: `'td'` (top-down), `'bu'`, `'lr'`, `'rl'`, `'radialout'`, `'radialin'`
* `dagLevelDistance` controls inter-layer spacing — zero-config hierarchical DAG
* Canvas 2D rendering; sibling `3d-force-graph` for WebGL 3D
* Custom node/link rendering via Canvas callbacks
* Directional particles on edges (visual flow indicator)
* Minimal API surface — very easy to get started
* npm: `force-graph` (vanilla), `react-force-graph` (React wrapper)
* Limitation: less compound-graph styling than Cytoscape; Canvas = no SVG DOM

### Runner-up: G6 (AntV) v5

* MIT, good built-in features
* Chinese-origin — documentation quality varies in English
* Significant API changes between v4 and v5

### Also evaluated (lower fit for our use case)

* **reagraph** (Apache-2.0, ~1k stars) — WebGL via Three.js, built-in `HierarchicalTopDown2D`, but React-only
* **@antv/x6** (MIT, 6.5k stars) — full diagramming/editor SDK with dagre layout, rich edge routing, undo/redo, minimap — heavier than we need, editor-oriented rather than pure visualization
* **@logicflow/core** (Apache-2.0, 11.2k stars) — workflow/BPMN engine from DiDi, highest star count but domain-specific (workflow simulation), Chinese-primary docs

## Venn Diagram Libraries

| Library | License | Stars | Active | Max Sets | Interactive |
|---------|---------|-------|--------|----------|-------------|
| **upsetjs/venn.js** | MIT | ~225 | Yes (2025) | 5-6 practical | Yes (D3 events) |
| **benfred/venn.js** | MIT | ~900 | Stale (2019) | 5-6 practical | Yes |
| **@upsetjs/upsetjs** | AGPL-3.0 | ~500 | Yes | Unlimited (UpSet plot) | Yes |
| **chartjs-chart-venn** | MIT | ~100 | Yes | 3-4 practical | Via Chart.js |

### Top Pick: upsetjs/venn.js

* MIT license, maintained fork of the original benfred/venn.js
* D3v7 compatible
* Area-proportional Venn/Euler diagrams
* Click events via D3 event model
* Practical limit: 5-6 sets (geometric constraint of Venn diagrams)

### Alternative for many sets: UpSet plots

* For 5+ sets, traditional Venn diagrams become unreadable
* UpSet.js shows intersection bar charts instead
* AGPL license is a concern for non-open-source use

## Recommended Stack

```
DAG (try all three, compare):
  1. Cytoscape.js + cytoscape-dagre  (richer styling, compound nodes)
  2. vis-network (hierarchical mode)  (simpler, existing Tripleter reference)
  3. force-graph (dagMode: 'td')      (minimal API, Canvas, zero-config DAG)
Venn:      upsetjs/venn.js (≤5 sets)
Bundler:   Vite (fast dev, simple config)
Language:  TypeScript (type safety for graph data structures)
```

### Why try three DAG approaches

* **Cytoscape.js**: richest styling API (CSS-like selectors), compound nodes, graph algorithms built-in
* **vis-network**: simpler API, reactive DataSet, working Tripleter reference codebase
* **force-graph**: most minimal API, native `dagMode` with zero config, Canvas rendering, directional edge particles
* All three MIT/Apache licensed, all support hierarchical/DAG layout
* Trying all three lets us compare and pick the best fit (or offer multiple as visualization modes)
* upsetjs/venn.js works orthogonally with any of them
* No framework lock-in (vanilla JS/TS, not React-specific)

## Sources

* [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) — MIT, 10.8k stars
* [vis-network](https://github.com/visjs/vis-network) — Apache-2.0/MIT, 3.2k stars
* [force-graph](https://github.com/vasturiano/force-graph) — MIT, 1.9k stars (+5k react wrapper)
* [G6/AntV](https://github.com/antvis/G6) — MIT, 12k stars
* [React Flow](https://github.com/xyflow/xyflow) — MIT, 24k stars
* [reagraph](https://github.com/reaviz/reagraph) — Apache-2.0, ~1k stars
* [@antv/x6](https://github.com/antvis/X6) — MIT, 6.5k stars
* [@logicflow/core](https://github.com/didi/LogicFlow) — Apache-2.0, 11.2k stars
* [upsetjs/venn.js](https://github.com/upsetjs/venn.js) — MIT
* [dagre](https://github.com/dagrejs/dagre) — MIT, 5.1k stars
* [ELK.js](https://github.com/kieler/elkjs) — EPL-2.0, 2.1k stars
