# Framework Research Summary

## Graph/DAG Visualization Libraries

| Library | License | ~Stars | Active | Hierarchical Layout | Interactivity | Fit Score |
|---------|---------|--------|--------|---------------------|---------------|-----------|
| **Cytoscape.js** | MIT | 10.8k | Yes (v3.33, 2025) | Via dagre/ELK adapters | Excellent built-in | ★★★★★ |
| **G6 (AntV) v5** | MIT | 12k | Yes (v5, 2025) | Built-in dagre | Excellent built-in | ★★★★☆ |
| **React Flow** | MIT | 24k | Yes | Via dagre/ELK plugins | Excellent (React) | ★★★★☆ |
| **vis-network** | Apache-2.0/MIT | 3.2k | Yes (2025) | Built-in hierarchical | Good | ★★★★☆ |
| **D3.js + d3-dag** | BSD-3 / MIT | 112k | Yes / light | Sugiyama via d3-dag | Manual (full control) | ★★★★☆ |
| **d3-graphviz** | BSD-3 | 1.8k | Yes (v5.6, 2025) | 7 Graphviz algos (dot=hierarchical) | D3 transitions, SVG | ★★★☆☆ |
| **Sigma.js v3** | MIT | 11.6k | Yes (2024) | Needs external layout | Good | ★★★☆☆ |
| **dagre** | MIT | 5.1k | Stale/revived | Core purpose (layout only) | N/A (no renderer) | Layout engine |
| **ELK.js** | EPL-2.0 | 2.1k | Yes | Best-in-class | N/A (no renderer) | Layout engine (license concern) |
| **Cola.js** | MIT | 2k | Inactive | Not hierarchical | Via adapters | ★☆☆☆☆ |
| **force-graph** | MIT | 1.9k (+5k react) | Yes (2025) | Native `dagMode` | Canvas 2D, zero-config DAG | ★★★★☆ |
| **reagraph** | Apache-2.0 | ~1k | Yes (2025) | Built-in hierarchical | WebGL (Three.js), React | ★★★★☆ |
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

### Strong candidate: D3.js + d3-dag (manual SVG rendering)

* D3.js: BSD-3, 112k stars — the foundational web visualization library
* d3-dag: MIT, ~900 stars — Sugiyama layered layout for DAGs
* Full control: hand-code every SVG element, transition, interaction
* **Same D3 ecosystem as upsetjs/venn.js** — consistent event model, selections, transitions across both panels
* SVG rendering: inspectable DOM, CSS-styleable, accessible
* No abstraction tax — nothing hidden, no framework opinions
* More upfront code than higher-level libs, but our graph is small (14 nodes)
* Sugiyama layout algorithms: `sugiyama()`, `zherebko()`, `grid()`
* Note: `force-graph` (vasturiano) is also D3-based internally (d3-force-3d, d3-drag, d3-zoom, d3-selection)

### D3 ecosystem note: d3-graphviz

* BSD-3, 1.8k stars, 29k weekly npm downloads, active (v5.6, March 2025)
* Uses Graphviz WASM for layout — 7 algorithms including `dot` (hierarchical DAG)
* SVG output with D3-powered animated transitions between graph states
* Input is DOT language (not JSON) — requires generating DOT strings from our data model
* 3MB WASM bundle adds weight
* Could be an alternative if we want Graphviz-quality edge routing

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

### Strong candidate: reagraph (reaviz)

* **Apache-2.0** license, actively maintained (v4.30.x, Dec 2025)
* WebGL rendering via Three.js — smooth performance, 2D and 3D modes
* Built-in hierarchical layouts: `HierarchicalTopDown2D`, `HierarchicalLeftRight2D`, `TreeTopDown2D`, `TreeLeftRight2D`
* Built-in clustering, label overlap resolution, animated transitions
* Node/edge selection API, context menus
* React-based — requires React as a dependency
* npm: `reagraph`
* Maintained by Good Code US (commercial org), ensuring stability
* ~1k stars but growing; part of the reaviz visualization ecosystem

### Runner-up: G6 (AntV) v5

* MIT, good built-in features
* Chinese-origin — documentation quality varies in English
* Significant API changes between v4 and v5

### Also evaluated (lower fit for our use case)

* **@antv/x6** (MIT, 6.5k stars) — full diagramming/editor SDK with dagre layout, rich edge routing, undo/redo, minimap — heavier than we need, editor-oriented rather than pure visualization
* **@logicflow/core** (Apache-2.0, 11.2k stars) — workflow/BPMN engine from DiDi, highest star count but domain-specific (workflow simulation), Chinese-primary docs
* **neovis.js** (Apache-2.0, 1.8k stars) — thin wrapper around vis-network for Neo4j graph databases. Tightly coupled to Neo4j Bolt record format (`neo4j-driver` is a hard dependency); even standalone `dataFunction` mode requires mimicking Neo4j wire protocol, not simple `{nodes, edges}` JSON. Unmaintained since May 2023 (no releases in 2024-2025, ~600 weekly npm downloads). No value beyond using vis-network directly, which we already have as candidate 3b

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
DAG (try all five, compare):
  1. Cytoscape.js + cytoscape-dagre  (richer styling, compound nodes)
  2. vis-network (hierarchical mode)  (simpler, existing Tripleter reference)
  3. force-graph (dagMode: 'td')      (minimal API, Canvas, D3-based internally)
  4. D3.js + d3-dag (manual SVG)      (full control, same ecosystem as venn.js)
  5. reagraph (WebGL, hierarchical)   (Apache-2.0, 2D+3D, React-based)
Venn:      upsetjs/venn.js (≤5 sets)
Bundler:   Vite (fast dev, simple config)
Language:  TypeScript (type safety for graph data structures)
UI:        React (needed for reagraph; other candidates work standalone or with React)
```

### Why try five DAG approaches

* **Cytoscape.js**: richest styling API (CSS-like selectors), compound nodes, graph algorithms built-in
* **vis-network**: simpler API, reactive DataSet, working Tripleter reference codebase
* **force-graph**: most minimal API, native `dagMode` with zero config, Canvas rendering, directional edge particles
* **D3.js + d3-dag**: full control, SVG, same D3 ecosystem as upsetjs/venn.js (consistent event model across both panels)
* **reagraph**: Apache-2.0, WebGL via Three.js, built-in hierarchical layouts, 2D+3D modes, clustering, commercially maintained
* All five permissively licensed (MIT/Apache/BSD), all support hierarchical/DAG layout
* Trying all lets us compare and pick the best fit (or offer multiple as visualization modes)
* D3 ecosystem coherence: force-graph is D3-based internally, venn.js is D3-based — so 3 of 5 DAG candidates + the Venn lib share D3 foundations
* React added to stack for reagraph; other candidates work with or without React

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
* [d3-dag](https://github.com/erikbrinkman/d3-dag) — MIT, ~900 stars
* [d3-graphviz](https://github.com/magjac/d3-graphviz) — BSD-3, 1.8k stars
