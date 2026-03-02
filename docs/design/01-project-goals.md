# Project Goals: Graph DAG ⟺ Venn Diagram Dual Visualization

## Objective

Build an interactive browser-based visualization that displays the same hierarchical data simultaneously as:

1. A **directed acyclic graph (DAG)** with clean layered layout
2. A **Venn diagram** showing set membership and intersections

Both views stay synchronized — selecting/deselecting in one updates the other.

## Data Model

Three-tier hierarchy:

* **Domains** (d1, d2, d3, ...) — top-level meta-categories
* **Categories** (c1, c2, c3, ...) — mid-level categories, each belonging to one or more domains
* **Entities** (x1, x2, x3, ...) — leaf nodes, each belonging to one or more categories

This forms a DAG (not a tree) because entities and categories can have multiple parents.

## DAG Visualization Requirements

* **Layered layout**: Domains at top, categories in middle, entities at bottom
* Nodes grouped visually by layer
* Edges show parent-child membership
* Each node and edge has two visual states:
  * **Selected** (activated, highlighted, vibrant, bold)
  * **Unselected** (deactivated, pale, less saturated, not bold)

## Venn Diagram Visualization Requirements

* Show the same data as overlapping sets
* Categories (or domains) define the sets; entities are members
* Interactive — clicking regions selects/deselects corresponding elements
* Multiple visualization modes (user-selectable)

## Interaction Model

### Selection Propagation

Clicking a node **flips** its state (selected ↔ unselected), then propagation occurs:

**Selecting (activating) a node — propagation goes DOWN:**

1. User selects domain d_i
2. All categories connected to d_i become selected (and edges between them)
3. All entities connected to those categories become selected (and edges)
4. If d_j is additionally selected, its connected categories activate, then their connected entities activate
5. Nodes display cumulative path counts — how many active paths reach them

**Deselecting (deactivating) a node — propagation goes UP then DOWN:**

1. User deselects a leaf entity x_k or category c_m
2. All parent nodes of the deselected node are deselected (c* parents for entities, d* parents for categories)
3. From the remaining selected domains, propagation recalculates downward
4. New DAG state computed in background, view updates

### Visual Scaling

* Node **size** scales with the number of active paths reaching it
* Since path counts can grow exponentially: `display_size = log(path_count)` normalized to a defined min/max range
* Node **color saturation** also adjusts with path count value
* Edge thickness may also reflect path weight

### Computation

* Graph represented as adjacency matrices
* Matrix multiplication computes reachability/path counts per stage
* Small graph size makes this efficient for real-time updates

## Dual-Panel Layout

* Display split into two panels: DAG view + Venn diagram view
* **Adaptive split direction** based on browser viewport:
  * Wide viewport (width > height): left/right split
  * Tall viewport (height > width): top/bottom split
  * Dynamically switches on resize
* See [adaptive-split-layout.md](./02-adaptive-split-layout.md) for detailed design

## Synchronization

* Both panels share the same underlying data model
* Selection/deselection in either panel propagates to the other
* Visual updates happen simultaneously in both views
