# FUTURE_WORK — Ordered Implementation Plan

Work items in priority order. Each item is worked on one at a time with user consultation before starting and sign-off before closing.

## 1. Setup Repository [PENDING]

* Initialize project with Vite + TypeScript
* Install core dependencies: Cytoscape.js, cytoscape-dagre, upsetjs/venn.js, D3 (for venn)
* Configure build, dev server, linting
* Create basic HTML shell with dual-panel layout placeholder
* Set up `.gitignore` for node_modules, dist, tmp, cache
* Create README.md with project description

## 2. Define Master Example DAG Data [PENDING]

* Implement the graph data structure (domains, categories, entities, edges) in TypeScript
* Encode the master example from `docs/design/03-example-dag-cases.md`
* Add 1-2 additional example graphs (simpler and more complex) for user selection
* Document each example: what cases it covers, expected path counts
* Build a dropdown/selector UI for switching between examples

## 3. Graph DAG Visualization [PENDING]

Try all three approaches, compare, keep best (or multiple as selectable modes):

### 3a. Cytoscape.js + cytoscape-dagre

* Dagre-based layered layout: domains top, categories middle, entities bottom
* CSS-like style selectors for selected/unselected states
* Compound nodes for layer grouping

### 3b. vis-network (hierarchical mode)

* Built-in hierarchical layout (`direction: 'UD'`)
* Reactive `vis.DataSet` for automatic re-renders
* Reference: Tripleter codebase (`/mnt/ro/github/tripleter/tripleter.github.io/static/vis/v5/`)

### 3c. force-graph (vasturiano, dagMode)

* Native `dagMode: 'td'` — zero-config top-down DAG layout
* Canvas 2D rendering, minimal API surface
* Directional particles on edges (visual flow)
* npm: `force-graph`

### Shared requirements (all implementations)

* Node styling: selected vs unselected states (color, size, opacity, border)
* Edge styling: active vs inactive (opacity, thickness, color)
* Click interaction: flip node state, trigger propagation
* Selection propagation logic (forward/backward as per `04-selection-propagation.md`)
* Path count computation via adjacency matrix multiplication
* Visual scaling: node size and saturation based on log-normalized path counts
* Display path count numbers on nodes

## 4. Venn Diagram Visualization [PENDING]

* Implement upsetjs/venn.js-based Venn renderer
* Map DAG data to set definitions (categories or domains as sets, entities as members)
* Interactive regions: click to select/deselect sets
* Same selection propagation logic synced with DAG data model
* Visual states matching DAG: selected vs unselected regions
* Explore multiple Venn visualization modes (by domain, by category)
* Evaluate if UpSet plot mode is needed for many-set cases
* Explore alternative Venn renderers

## 5. Evaluate and Select Best Implementations [PENDING]

* Compare DAG visualization approaches (if multiple were tried)
* Compare Venn visualization approaches (if multiple were tried)
* Select best of each based on: visual clarity, interactivity, performance
* Document decisions in `docs/design/`

## 6. Dual-Panel Synchronized View [PENDING]

* Implement adaptive split layout (see `docs/design/02-adaptive-split-layout.md`)
* Wire both panels to shared data model
* Selection in DAG panel updates Venn panel and vice versa
* Visualization mode selectors in each panel (switch between renderers)
* Responsive resize handling
* Polish: transitions, animations, visual consistency between panels

---

**Process**: For each item, consult user before starting. Track active work in `CURRENT_WORK.md`. On completion, mark as DONE here and clean `CURRENT_WORK.md` in the same commit.
