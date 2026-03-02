import type { DagGraph, GraphState, GraphEvent, NodeState, ProcessResult } from './types';

export function createEmptyState(): GraphState {
  return { selectedDomains: new Set() };
}

export function processGraph(
  graph: DagGraph,
  initialState: GraphState,
  events: GraphEvent[]
): ProcessResult {
  const selectedDomains = new Set(initialState.selectedDomains);
  const outputs: NodeState[] = [];

  for (const event of events) {
    switch (event.action) {
      case 'select':
        selectedDomains.add(event.nodeId);
        break;

      case 'deselect':
        selectedDomains.delete(event.nodeId);
        break;

      case 'get_state':
        outputs.push(computeNodeState(graph, selectedDomains, event.nodeId));
        break;
    }
  }

  return { outputs, state: { selectedDomains } };
}

function computeNodeState(
  graph: DagGraph,
  selectedDomains: Set<string>,
  nodeId: string
): NodeState {
  // Check if nodeId is a domain
  if (graph.domains.some((d) => d.id === nodeId)) {
    const selected = selectedDomains.has(nodeId);
    return { nodeId, selected, pathCount: selected ? 1 : 0 };
  }

  // Check if nodeId is a category
  if (graph.categories.some((c) => c.id === nodeId)) {
    let pathCount = 0;
    for (const edge of graph.domainToCategory) {
      if (edge.to === nodeId && selectedDomains.has(edge.from)) {
        pathCount++;
      }
    }
    return { nodeId, selected: pathCount > 0, pathCount };
  }

  // Must be an entity
  let pathCount = 0;
  for (const edge of graph.categoryToEntity) {
    if (edge.to === nodeId) {
      // Get this parent category's pathCount
      const catPathCount = computeNodeState(graph, selectedDomains, edge.from).pathCount;
      pathCount += catPathCount;
    }
  }
  return { nodeId, selected: pathCount > 0, pathCount };
}
