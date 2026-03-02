import { readFileSync } from 'node:fs';
import { processGraph, createEmptyState } from '../engine/engine.js';
import type { DagGraph, GraphEvent, GraphState } from '../engine/types.js';

function printUsage(): void {
  console.log(`Usage: npx tsx src/cli/main.ts --graph <graph.json> [options]

Options:
  --graph <file>     Path to graph JSON file (required)
  --events <json>    Events as JSON string: [["nodeId","action"],...]
  --events-file <f>  Path to events JSON file
  --state <file>     Path to initial state JSON file (default: empty)
  --help             Show this help

Examples:
  npx tsx src/cli/main.ts --graph examples/master.json --events '[["d1","select"],["x3","get_state"]]'
  npx tsx src/cli/main.ts --graph examples/trivial.json --events '[["d1","select"],["d1","get_state"]]'
`);
}

function parseArgs(args: string[]): { graphFile?: string; events?: string; eventsFile?: string; stateFile?: string; help: boolean } {
  const result: { graphFile?: string; events?: string; eventsFile?: string; stateFile?: string; help: boolean } = { help: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--graph': result.graphFile = args[++i]; break;
      case '--events': result.events = args[++i]; break;
      case '--events-file': result.eventsFile = args[++i]; break;
      case '--state': result.stateFile = args[++i]; break;
      case '--help': result.help = true; break;
    }
  }
  return result;
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help || !parsed.graphFile) {
    printUsage();
    process.exit(parsed.help ? 0 : 1);
  }

  // Load graph
  const graph: DagGraph = JSON.parse(readFileSync(parsed.graphFile, 'utf-8'));

  // Load initial state
  let initialState: GraphState;
  if (parsed.stateFile) {
    const stateData = JSON.parse(readFileSync(parsed.stateFile, 'utf-8'));
    initialState = { selectedDomains: new Set(stateData.selectedDomains || []) };
  } else {
    initialState = createEmptyState();
  }

  // Parse events
  let events: GraphEvent[] = [];
  let eventsSource = parsed.events;
  if (parsed.eventsFile) {
    eventsSource = readFileSync(parsed.eventsFile, 'utf-8');
  }
  if (eventsSource) {
    const parsed_events: [string, string][] = JSON.parse(eventsSource);
    events = parsed_events.map(([nodeId, action]) => ({
      nodeId,
      action: action as 'select' | 'deselect' | 'get_state',
    }));
  }

  // Process
  const result = processGraph(graph, initialState, events);

  // Output as JSON
  const output = {
    outputs: result.outputs,
    state: {
      selectedDomains: [...result.state.selectedDomains],
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
