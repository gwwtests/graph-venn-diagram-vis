import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const CLI = 'npx tsx src/cli/main.ts';

describe('CLI', () => {
  it('prints help with --help', () => {
    const output = execSync(`${CLI} --help`, { cwd: ROOT, encoding: 'utf-8' });
    expect(output).toContain('Usage:');
    expect(output).toContain('--graph');
  });

  it('processes select and get_state on trivial graph', () => {
    const events = JSON.stringify([['d1', 'select'], ['d1', 'get_state'], ['x1', 'get_state']]);
    const output = execSync(
      `${CLI} --graph examples/trivial.json --events '${events}'`,
      { cwd: ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(output);
    expect(result.outputs).toEqual([
      { nodeId: 'd1', selected: true, pathCount: 1 },
      { nodeId: 'x1', selected: true, pathCount: 1 },
    ]);
    expect(result.state.selectedDomains).toEqual(['d1']);
  });

  it('processes master graph with multi-domain selection', () => {
    const events = JSON.stringify([['d1', 'select'], ['d2', 'select'], ['x3', 'get_state']]);
    const output = execSync(
      `${CLI} --graph examples/master.json --events '${events}'`,
      { cwd: ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(output);
    expect(result.outputs).toEqual([
      { nodeId: 'x3', selected: true, pathCount: 3 },
    ]);
  });
});
