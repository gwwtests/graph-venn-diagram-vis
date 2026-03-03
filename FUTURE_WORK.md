# FUTURE_WORK — Ordered Implementation Plan

Work items in priority order. Each item is worked on one at a time with user consultation before starting and sign-off before closing.

## 1. Setup Repository [DONE]

* Initialize project with Vite + TypeScript
* Install core dependencies: Cytoscape.js, cytoscape-dagre, vis-network, force-graph, d3, d3-dag, reagraph, sigma, graphology, @memgraph/orb, react, react-dom, upsetjs/venn.js
* Install dev/test dependencies: vitest (unit testing), tsx (CLI runner)
* Configure build, dev server, linting
* Set up `.gitignore` for node_modules, dist, tmp, cache
* Create README.md with project description
* Project structure: `src/engine/` (pure logic), `src/vis/` (visualizations), `src/cli/` (CLI)

## 2. Graph Engine — Pure Computation Library [DONE]

Visualization-independent library for graph state management and propagation logic. Must be unit-testable and CLI-usable without any browser/DOM dependency.

### 2a. Core data structures

* `DagGraph` — typed graph: domains, categories, entities, edges
* `GraphState` — which nodes are selected/unselected
* Adjacency matrix representation (domain→category, category→entity)
* Load graph from JSON definition

### 2b. Computation engine

* Forward propagation: selected domains → active categories → active entities
* Path count via matrix multiplication: `domain_vector × A × B`
* Backward propagation (deselection): identify parent domains, remove, recompute
* `NodeState`: `{ selected: boolean, pathCount: number }`
* Visual scaling computation: `log(1 + pathCount)` normalized to min/max range

### 2c. Event processing

* Event type: `{ nodeId: string, action: 'select' | 'deselect' | 'get_state' }`
* `processEvent(graph, state, event) => newState`
* `processEvents(graph, initialState, events[]) => finalState`
* `get_state` returns: `{ selected: boolean, pathCount: number }` for the node
* Pure functions — no side effects, fully deterministic

### 2d. CLI interface

* `npx tsx src/cli/main.ts --graph <graph.json> --state <state.json> --events <events.json>`
* Also accept inline: `--events '[["d1","select"],["x3","get_state"]]'`
* Output: new state as JSON to stdout
* Useful for manual testing and scripting

### 2e. Master example graphs (JSON)

* Encode master example from `docs/design/03-example-dag-cases.md` as `examples/master.json`
* Add 1-2 simpler examples for basic testing
* Each example documents which cases it covers

### 2f. Unit tests — basic infrastructure

* Set up vitest
* Write first few trivial tests:
  * Load graph from JSON
  * Empty state (nothing selected)
  * Select single domain → verify propagation
  * Path count for simple case
* These validate the engine works before expanding test coverage

### 2g. Unit tests — comprehensive edge cases (parallelizable)

* **Once 2f infrastructure is working**, expand test coverage massively
* This work CAN be parallelized with a team of agents
* Test cases derived from `docs/design/03-example-dag-cases.md`:

| Test group | Cases to cover |
|------------|---------------|
| Single domain select | d1 only, d2 only, d3 only — verify correct categories/entities activate |
| Multiple domain select | d1+d2, d1+d3, d2+d3, all three — verify cumulative path counts |
| Entity deselection | Deselect x3 (multi-parent) — verify parent domains deselected, recomputation |
| Category deselection | Deselect c2 (shared across d1,d2) — verify both parent domains affected |
| Domain deselection | Deselect d1 from d1+d2 — verify only d2 paths remain |
| Isolated paths | x5→c4→d3 — single path, select/deselect d3 |
| Cross-domain entity | x6→{c3,c4} spans d1+d3 — verify path counts from each domain |
| Shared category | c2 shared by d1,d2 — select d1 vs d2 vs both, verify x3,x4 path counts |
| Sequential events | Chain of select/deselect operations, verify intermediate and final states |
| get_state queries | Query node state at various points, verify pathCount values |
| Edge cases | Empty graph, all selected, all deselected, select already-selected, deselect already-deselected |
| Path count math | Verify matrix multiplication matches hand-computed values from design doc |

## 3. Graph DAG Visualization [DONE]

Try all seven approaches, compare, keep best (or multiple as selectable modes).
All implementations consume the engine from step 2 — no computation logic in visualization code.

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

### 3d. D3.js + d3-dag (manual SVG rendering)

* d3-dag Sugiyama layout for hierarchical DAG positioning
* Manual D3 SVG rendering — full control over every element
* Same D3 ecosystem as upsetjs/venn.js — consistent event model across both panels
* More upfront code, but graph is small (14 nodes)
* Also consider d3-graphviz (DOT input, Graphviz WASM) as sub-variant

### 3e. reagraph (reaviz, WebGL)

* Apache-2.0 license, actively maintained (v4.30.x, Dec 2025)
* WebGL via Three.js — 2D and 3D modes
* Built-in `HierarchicalTopDown2D`, `TreeTopDown2D` layouts
* Built-in clustering, label overlap resolution, animated transitions
* React-based — requires React dependency
* npm: `reagraph`

### 3f. Sigma.js v3 + graphology + dagre

* MIT license, 11.6k stars, WebGL rendering
* graphology data model — flexible graph data structure
* Layout computed externally (dagre for hierarchical), positions applied to Sigma
* Node/edge reducers for dynamic per-frame styling
* Best-in-class performance (100k+ nodes) — overkill for us but visually smooth
* npm: `sigma`, `graphology`

### 3g. @memgraph/orb + dagre (WebWorker physics)

* Apache-2.0 license, TypeScript-first, Canvas rendering
* D3-based internally (d3-force, d3-drag, d3-zoom)
* WebWorker off-main-thread physics simulation (unique architectural feature)
* No built-in hierarchical layout — apply dagre positions via `getPosition()` callback
* Standalone — no Memgraph DB required, accepts plain `{nodes, edges}` JSON
* MapView via Leaflet (bonus: geographic overlay)
* npm: `@memgraph/orb`
* Blog: https://memgraph.com/blog/how-to-build-a-graph-visualization-engine-and-why-you-shouldnt

### Shared requirements (all visualization implementations)

* Consume `DagGraph` and `GraphState` from engine (step 2)
* Node styling: selected vs unselected states (color, size, opacity, border)
* Edge styling: active vs inactive (opacity, thickness, color)
* Click interaction: call `processEvent()` from engine, re-render with new state
* Visual scaling: node size and saturation based on engine's log-normalized path counts
* Display path count numbers on nodes

## 4. Venn Diagram Visualization [DONE]

* Implement upsetjs/venn.js-based Venn renderer
* Map DAG data to set definitions (categories or domains as sets, entities as members)
* Interactive regions: click to select/deselect sets
* Same engine (step 2) for propagation logic
* Visual states matching DAG: selected vs unselected regions
* Explore multiple Venn visualization modes (by domain, by category)
* Evaluate if UpSet plot mode is needed for many-set cases
* Explore alternative Venn renderers

## 5. Evaluate and Select Best Implementations [DONE]

* Compare DAG visualization approaches (if multiple were tried)
* Compare Venn visualization approaches (if multiple were tried)
* Select best of each based on: visual clarity, interactivity, performance
* Document decisions in `docs/design/`

## 6. Dual-Panel Synchronized View [DONE]

* Implement adaptive split layout (see `docs/design/02-adaptive-split-layout.md`)
* Wire both panels to shared engine state
* Selection in DAG panel updates Venn panel and vice versa
* Visualization mode selectors in each panel (switch between renderers)
* Responsive resize handling
* Polish: transitions, animations, visual consistency between panels

## 7. Bidirectional Selection Propagation (Bottom-Up + Top-Down)

Currently, selection only flows **top-down**: clicking a domain selects it, propagates to categories, then entities. Clicking a **middle or bottom tier** node that is already selected triggers **deselection** — it deselects parent domains, which recomputes everything downward. However, clicking a **deselected** category or entity does nothing.

### Goal

Introduce **bottom-up selection**: clicking a deselected category or entity should **propagate selection upward** to its parent domain(s), which then triggers the normal top-down propagation. This creates a symmetric interaction model:

* **Selected node clicked** → deselect (existing behavior, propagates up then recomputes down)
* **Deselected node clicked** → select parent domain(s) upward, then propagate down (new behavior)

### Examples

| Action | Current behavior | New behavior |
|--------|-----------------|--------------|
| Click deselected `Software` (c1) | Nothing | Select `Engineering` (d1), propagate down → Software, Data, Hardware, x1-x4, x6 all activate |
| Click deselected `Entity3` (x3) | Nothing | x3's categories are c1,c2 → parents are d1,d2 → select both → full d1+d2 propagation |
| Click deselected `Data` (c2) | Nothing | c2's parents are d1,d2 → select both → full d1+d2 propagation |
| Click deselected `Entity5` (x5) | Nothing | x5→c4→d3 → select d3 → d3 propagation only |

### Implementation plan

1. **Unit tests first** (engine layer, `src/engine/__tests__/`):
   * Simplest case: click deselected category with single parent domain → verify domain selected + propagation
   * Click deselected entity with single category, single domain → verify chain
   * Click deselected category with multiple parent domains → verify all parents selected
   * Click deselected entity with multiple categories spanning multiple domains → verify all ancestor domains selected
   * Sequential: select via bottom-up, then deselect via top-down, verify clean state
   * Edge case: click deselected entity whose some-but-not-all parent domains are already selected

2. **Engine changes** (`src/engine/engine.ts`):
   * Modify `processGraph` / event handling for `select` action on non-domain nodes
   * When selecting a category: find parent domains via `domainToCategory` edges, select them
   * When selecting an entity: find parent categories via `categoryToEntity`, then their parent domains, select all
   * After selecting domains, run normal top-down propagation

3. **Visualization integration**:
   * `handleNodeClick` in `shared.ts` already toggles select/deselect — engine change should be sufficient
   * Verify all visualization panels (DAG, Venn, dual) respond correctly
   * Categories and entities become truly interactive (not just display-only)

---

**Process**: For each item, consult user before starting. Track active work in `CURRENT_WORK.md`. On completion, mark as DONE here and clean `CURRENT_WORK.md` in the same commit.
