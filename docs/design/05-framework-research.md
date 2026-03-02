# Framework Research Summary

## Graph/DAG Visualization Libraries

| Library | License | ~Stars | Active | Hierarchical Layout | Interactivity | Fit Score |
|---------|---------|--------|--------|---------------------|---------------|-----------|
| **Cytoscape.js** | MIT | 10.8k | Yes (v3.33, 2025) | Via dagre/ELK adapters | Excellent built-in | ★★★★★ |
| **G6 (AntV) v5** | MIT | 12k | Yes (v5, 2025) | Built-in dagre | Excellent built-in | ★★★★☆ |
| **React Flow** | MIT | 24k | Yes | Via dagre/ELK plugins | Excellent (React) | ★★★★☆ |
| **vis-network** | Apache-2.0 | 3.2k | Yes (2025) | Built-in hierarchical | Good | ★★★☆☆ |
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
Primary:   Cytoscape.js (DAG) + upsetjs/venn.js (Venn, ≤5 sets)
Layout:    cytoscape-dagre (Sugiyama layered layout)
Bundler:   Vite (fast dev, simple config)
Language:  TypeScript (type safety for graph data structures)
```

### Why this combination

* Both MIT licensed
* Cytoscape handles all DAG requirements natively
* upsetjs/venn.js handles Venn with D3-compatible events
* Orthogonal dependencies — no conflicts
* Both support dynamic updates for synchronized interaction
* No framework lock-in (vanilla JS/TS, not React-specific)

## Sources

* [Cytoscape.js](https://github.com/cytoscape/cytoscape.js)
* [G6/AntV](https://github.com/antvis/G6)
* [React Flow](https://github.com/xyflow/xyflow)
* [upsetjs/venn.js](https://github.com/upsetjs/venn.js)
* [dagre](https://github.com/dagrejs/dagre)
* [ELK.js](https://github.com/kieler/elkjs)
