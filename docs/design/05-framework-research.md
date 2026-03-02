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

### Runner-up: G6 (AntV) v5

* MIT, good built-in features
* Chinese-origin — documentation quality varies in English
* Significant API changes between v4 and v5

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
DAG (try both):
  1. Cytoscape.js + cytoscape-dagre  (richer styling, more control)
  2. vis-network (hierarchical mode)  (simpler, existing reference code)
Venn:      upsetjs/venn.js (≤5 sets)
Bundler:   Vite (fast dev, simple config)
Language:  TypeScript (type safety for graph data structures)
```

### Why try both DAG approaches

* Cytoscape.js: richer styling API (CSS-like selectors), compound nodes, graph algorithms
* vis-network: simpler API, reactive DataSet, working reference in Tripleter codebase
* Both permissively licensed, both have built-in hierarchical layout
* Trying both lets us compare and pick the best fit (or offer both as visualization modes)
* upsetjs/venn.js works orthogonally with either
* No framework lock-in (vanilla JS/TS, not React-specific)

## Sources

* [Cytoscape.js](https://github.com/cytoscape/cytoscape.js)
* [G6/AntV](https://github.com/antvis/G6)
* [React Flow](https://github.com/xyflow/xyflow)
* [upsetjs/venn.js](https://github.com/upsetjs/venn.js)
* [dagre](https://github.com/dagrejs/dagre)
* [ELK.js](https://github.com/kieler/elkjs)
