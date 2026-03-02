# Graph Engine — Behavioral Specification

Reference document for writing tests. Describes exactly how `processGraph()` should behave.

## Public Interface

```typescript
import { processGraph, createEmptyState } from '../engine/engine';
import type { DagGraph, GraphEvent, GraphState, NodeState, ProcessResult } from '../engine/types';
```

### Core function

```typescript
processGraph(graph: DagGraph, initialState: GraphState, events: GraphEvent[]): ProcessResult
```

* **Pure function** — no side effects, fully deterministic
* Processes events sequentially, left to right
* Returns `{ outputs: NodeState[], state: GraphState }`

### Types

```typescript
interface DagGraph {
  domains: { id: string; label: string }[];
  categories: { id: string; label: string }[];
  entities: { id: string; label: string }[];
  domainToCategory: { from: string; to: string }[];  // domain→category edges
  categoryToEntity: { from: string; to: string }[];   // category→entity edges
}

interface GraphState {
  selectedDomains: Set<string>;  // only domains are tracked; categories/entities are computed
}

interface GraphEvent {
  nodeId: string;
  action: 'select' | 'deselect' | 'get_state';
}

interface NodeState {
  nodeId: string;
  selected: boolean;
  pathCount: number;
}

interface ProcessResult {
  outputs: NodeState[];  // one entry per get_state event in the events array
  state: GraphState;     // final state after processing all events
}
```

## Three-Tier DAG Model

```
Layer 0 (top):    Domains    d1, d2, d3, ...
                     ↓
Layer 1 (middle): Categories c1, c2, c3, ...
                     ↓
Layer 2 (bottom): Entities   x1, x2, x3, ...
```

* Edges go downward only (it's a DAG)
* A category can have multiple parent domains
* An entity can have multiple parent categories
* This means an entity can be reachable from multiple domains through different paths

## Event Actions

### `select`

* **On a domain**: Add domain to `selectedDomains`. Forward propagation recalculates automatically on next `get_state`.
* **On a category**: Currently treated same as domain select — adds nodeId to selectedDomains. (This means selecting a category by id has no effect unless id happens to match a domain.)
* **On an entity**: Same behavior — adds nodeId to selectedDomains.

> Note: In the current implementation, `select` always adds to `selectedDomains`. For categories/entities, this has no effect on propagation since the computation only looks at domain membership. The primary intended usage is selecting domains.

### `deselect`

Three behaviors depending on node type:

* **On a domain**: Remove that domain from `selectedDomains`.
* **On a category**: Find all parent domains of this category (via `domainToCategory` edges where `to === nodeId`), remove ALL of them from `selectedDomains`.
* **On an entity**: Find all parent categories (via `categoryToEntity` edges where `to === nodeId`), then find all parent domains of those categories, remove ALL of them from `selectedDomains`.

This is **aggressive deselection** — deselecting a leaf removes every domain that could reach it through any path.

### `get_state`

Returns a `NodeState` for the given nodeId computed from the current `selectedDomains`:

* **Domain**: `selected = selectedDomains.has(nodeId)`, `pathCount = selected ? 1 : 0`
* **Category**: `pathCount` = number of selected domains that connect to this category. `selected = pathCount > 0`
* **Entity**: `pathCount` = sum of pathCounts of all parent categories. `selected = pathCount > 0`

This is forward propagation: `domain_vector × adjacency(d→c) → category_counts × adjacency(c→e) → entity_counts`

## Master Example Graph

```
Domains:    d1 (Engineering)    d2 (Science)    d3 (Arts)

Domain→Category edges:
  d1 → c1 (Software), c2 (Data), c3 (Hardware)
  d2 → c2 (Data), c5 (Research)
  d3 → c4 (Design)

Category→Entity edges:
  c1 → x1, x2, x3
  c2 → x3, x4
  c3 → x2, x6
  c4 → x5, x6
  c5 → x4
```

### Expected Path Counts

**All domains selected (d1+d2+d3):**

| Entity | Paths | Count |
|--------|-------|-------|
| x1 | d1→c1→x1 | 1 |
| x2 | d1→c1→x2, d1→c3→x2 | 2 |
| x3 | d1→c1→x3, d1→c2→x3, d2→c2→x3 | 3 |
| x4 | d1→c2→x4, d2→c2→x4, d2→c5→x4 | 3 |
| x5 | d3→c4→x5 | 1 |
| x6 | d1→c3→x6, d3→c4→x6 | 2 |

**Only d1 selected:**

| Entity | Paths | Count |
|--------|-------|-------|
| x1 | d1→c1→x1 | 1 |
| x2 | d1→c1→x2, d1→c3→x2 | 2 |
| x3 | d1→c1→x3, d1→c2→x3 | 2 |
| x4 | d1→c2→x4 | 1 |
| x5 | (none) | 0 |
| x6 | d1→c3→x6 | 1 |

**Only d2 selected:**

| Entity | Paths | Count |
|--------|-------|-------|
| x1 | (none) | 0 |
| x2 | (none) | 0 |
| x3 | d2→c2→x3 | 1 |
| x4 | d2→c2→x4, d2→c5→x4 | 2 |
| x5 | (none) | 0 |
| x6 | (none) | 0 |

**Only d3 selected:**

| Entity | Paths | Count |
|--------|-------|-------|
| x1-x4 | (none) | 0 |
| x5 | d3→c4→x5 | 1 |
| x6 | d3→c4→x6 | 1 |

**d1+d2 selected (d3 not):**

| Entity | Count |
|--------|-------|
| x1 | 1 |
| x2 | 2 |
| x3 | 3 |
| x4 | 3 |
| x5 | 0 |
| x6 | 1 |

### Category Path Counts (for category-level get_state)

**All domains selected:**

| Category | Domains connecting | pathCount |
|----------|--------------------|-----------|
| c1 | d1 | 1 |
| c2 | d1, d2 | 2 |
| c3 | d1 | 1 |
| c4 | d3 | 1 |
| c5 | d2 | 1 |

**Only d1 selected:**

| Category | pathCount |
|----------|-----------|
| c1 | 1 |
| c2 | 1 |
| c3 | 1 |
| c4 | 0 |
| c5 | 0 |

## Deselection Examples

**Deselect x3 when d1+d2 selected:**

1. x3's parent categories: c1, c2 (from `categoryToEntity` edges)
2. c1's parent domains: d1. c2's parent domains: d1, d2.
3. All ancestor domains: {d1, d2}
4. Remove d1 and d2 from selectedDomains → selectedDomains = {}
5. Result: everything unselected, all pathCounts = 0

**Deselect c2 when d1+d2+d3 selected:**

1. c2's parent domains: d1, d2 (from `domainToCategory` edges)
2. Remove d1 and d2 → selectedDomains = {d3}
3. Forward propagation from d3: c4 active → x5 (count=1), x6 (count=1)

**Deselect x5 when d1+d3 selected:**

1. x5's parent categories: c4
2. c4's parent domains: d3
3. Remove d3 → selectedDomains = {d1}
4. Forward from d1: c1,c2,c3 active → x1(1), x2(2), x3(2), x4(1), x6(1)

## Edge Cases

* **Empty events**: `processGraph(graph, state, [])` → returns unchanged state, empty outputs
* **Select already-selected domain**: No-op (Set.add on existing element)
* **Deselect already-deselected domain**: No-op (Set.delete on non-existing element)
* **Deselect entity when nothing selected**: No-op (no domains to remove)
* **get_state on unknown nodeId**: Currently returns `{ nodeId, selected: false, pathCount: 0 }` (falls through to entity branch, finds no parent categories)
* **Sequential events**: Events processed left-to-right. State mutations from earlier events are visible to later events.

## CLI Interface

```bash
npx tsx src/cli/main.ts --graph examples/master.json --events '[["d1","select"],["x3","get_state"]]'
```

Events are `[nodeId, action]` tuples. Output is JSON with `outputs` and `state`.

## Test File Locations

* Engine unit tests: `src/engine/__tests__/engine.test.ts`
* CLI integration tests: `src/cli/__tests__/cli.test.ts`
* Run all: `npm test`
