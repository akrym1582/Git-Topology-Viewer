import { describe, expect, it } from 'vitest';
import { SignificantCommitGraphBuilder } from '../src/domain/SignificantCommitGraphBuilder';
import { CommitGraph, GitRef } from '../src/domain/models';

const ref = (name: string, commitId: string): GitRef => ({ name, fullName: `refs/heads/${name}`, type: 'localBranch', commitId });

describe('SignificantCommitGraphBuilder', () => {
  it('retains ref tips, branch points, merges, and roots while compressing linear commits', () => {
    const nodes = new Map();
    nodes.set('tip', { id: 'tip', parents: ['merge'], refs: [ref('main', 'tip')] });
    nodes.set('merge', { id: 'merge', parents: ['trunk', 'feature'], refs: [] });
    nodes.set('trunk', { id: 'trunk', parents: ['branch'], refs: [] });
    nodes.set('feature', { id: 'feature', parents: ['branch'], refs: [ref('feature', 'feature')] });
    nodes.set('branch', { id: 'branch', parents: ['ordinary'], refs: [] });
    nodes.set('ordinary', { id: 'ordinary', parents: ['root'], refs: [] });
    nodes.set('root', { id: 'root', parents: [], refs: [] });
    const graph: CommitGraph = { nodes, order: ['tip', 'merge', 'trunk', 'feature', 'branch', 'ordinary', 'root'] };

    const view = new SignificantCommitGraphBuilder().build(graph);

    expect(view.nodes.map(node => node.id)).toEqual(['tip', 'merge', 'commit-group:trunk', 'feature', 'branch', 'commit-group:ordinary', 'root']);
    expect(view.nodes.find(node => node.id === 'commit-group:trunk')?.commitIds).toEqual(['trunk']);
    expect(view.nodes.find(node => node.id === 'commit-group:ordinary')?.commitIds).toEqual(['ordinary']);
    expect(view.edges).toEqual([
      { from: 'tip', to: 'merge' }, { from: 'merge', to: 'commit-group:trunk' }, { from: 'commit-group:trunk', to: 'branch' },
      { from: 'merge', to: 'feature' }, { from: 'feature', to: 'branch' }, { from: 'branch', to: 'commit-group:ordinary' },
      { from: 'commit-group:ordinary', to: 'root' }
    ]);
  });

  it('places a multi-commit summary between significant commits', () => {
    const nodes = new Map([
      ['tip', { id: 'tip', parents: ['newer'], refs: [ref('main', 'tip')] }],
      ['newer', { id: 'newer', parents: ['middle'], refs: [] }],
      ['middle', { id: 'middle', parents: ['older'], refs: [] }],
      ['older', { id: 'older', parents: ['root'], refs: [] }],
      ['root', { id: 'root', parents: [], refs: [] }]
    ]);
    const graph: CommitGraph = { nodes, order: ['tip', 'newer', 'middle', 'older', 'root'] };

    const view = new SignificantCommitGraphBuilder().build(graph);

    expect(view.nodes.map(node => node.id)).toEqual(['tip', 'commit-group:newer:middle:older', 'root']);
    expect(view.nodes[1].commitIds).toEqual(['newer', 'middle', 'older']);
    expect(view.edges).toEqual([
      { from: 'tip', to: 'commit-group:newer:middle:older' },
      { from: 'commit-group:newer:middle:older', to: 'root' }
    ]);
  });
});
