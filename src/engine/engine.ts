import type { DagGraph, GraphState, GraphEvent, ProcessResult } from './types';

export function createEmptyState(): GraphState {
  return { selectedDomains: new Set() };
}

export function processGraph(
  graph: DagGraph,
  initialState: GraphState,
  events: GraphEvent[]
): ProcessResult {
  return {
    outputs: [],
    state: { selectedDomains: new Set(initialState.selectedDomains) },
  };
}
