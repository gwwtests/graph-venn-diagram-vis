# Selection Propagation Logic

## Overview

Every node and edge in the DAG has a binary state: **selected** or **unselected**. User clicks flip individual nodes, then propagation rules recalculate the full graph state.

## State Representation

```
selected_domains: Set<DomainId>      // user-driven top-level selections
selected_categories: Set<CategoryId> // computed from selected_domains
selected_entities: Set<EntityId>     // computed from selected_categories
path_counts: Map<NodeId, number>     // paths from active domains to each node
```

## Forward Propagation (Top-Down)

Given a set of selected domains, compute the active state:

1. **Active categories** = all categories connected to at least one selected domain
2. **Active entities** = all entities connected to at least one active category
3. **Active edges** = edges where both endpoints are active
4. **Path counts** via matrix multiplication:

```
Let A = domain→category adjacency matrix (rows=domains, cols=categories)
Let B = category→entity adjacency matrix (rows=categories, cols=entities)

domain_vector = binary vector of selected domains
category_paths = domain_vector × A    // path counts per category
entity_paths = category_paths × B     // path counts per entity
```

## Click Actions

### Clicking a Domain node

* **If unselected → selected**: Add to `selected_domains`, recompute forward propagation
* **If selected → unselected**: Remove from `selected_domains`, recompute forward propagation

### Clicking a Category node

* **If unselected → selected**: Add all parent domains of this category to `selected_domains`, recompute
* **If selected → unselected**: This is the tricky case (see Deselection Logic below)

### Clicking an Entity node

* **If unselected → selected**: Add all parent categories' parent domains to `selected_domains`, recompute
* **If selected → unselected**: See Deselection Logic below

## Deselection Logic (Bottom-Up then Top-Down)

When a user deselects a lower-layer node (entity x_k or category c_m):

1. **Identify all parent domains** that contribute paths through the deselected node
2. **Deselect those parent domains** from `selected_domains`
3. **Recompute** forward propagation from the remaining `selected_domains`

This means deselecting a leaf can cascade upward and deactivate its entire ancestry, then the remaining active domains determine the new state.

### Example

Starting state: d1 and d2 both selected.

User deselects entity x3 (connected to c1→d1 and c2→d1,d2):

1. x3's parent categories: {c1, c2}
2. c1's parent domains: {d1}; c2's parent domains: {d1, d2}
3. All parent domains of x3: {d1, d2}
4. Remove d1 and d2 from `selected_domains`
5. Remaining `selected_domains` = {} (empty)
6. Forward propagation: nothing active

This is intentionally aggressive — deselecting x3 removes all domains that reach it. The user can re-select specific domains to rebuild the view.

## Visual Scaling

Path count determines visual weight:

```
raw_size = path_counts[node_id]
log_size = Math.log(1 + raw_size)  // log(1+x) to handle 0
normalized = (log_size - min_log) / (max_log - min_log)  // 0..1
display_size = MIN_SIZE + normalized * (MAX_SIZE - MIN_SIZE)
display_saturation = MIN_SAT + normalized * (MAX_SAT - MIN_SAT)
```

Constants (tunable):

* `MIN_SIZE` = 20px, `MAX_SIZE` = 60px
* `MIN_SAT` = 30%, `MAX_SAT` = 100%

## Edge Styling

* **Active edge**: full opacity, thicker stroke, vibrant color
* **Inactive edge**: low opacity (0.15), thin stroke, grey
* Edge thickness may also scale with the path weight flowing through it
