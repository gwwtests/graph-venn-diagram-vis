export interface DagGraph {
  domains: { id: string; label: string }[];
  categories: { id: string; label: string }[];
  entities: { id: string; label: string }[];
  domainToCategory: { from: string; to: string }[];  // domain→category edges
  categoryToEntity: { from: string; to: string }[];   // category→entity edges
}

export interface GraphState {
  selectedDomains: Set<string>;
}

export type EventAction = 'select' | 'deselect' | 'get_state';

export interface GraphEvent {
  nodeId: string;
  action: EventAction;
}

export interface NodeState {
  nodeId: string;
  selected: boolean;
  pathCount: number;
}

export interface ProcessResult {
  outputs: NodeState[];  // one per get_state event
  state: GraphState;
}
