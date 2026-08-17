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

    expect(view.nodes.map(node => node.id)).toEqual(['tip', 'merge', 'feature', 'branch', 'root']);
    expect(view.edges).toEqual([
      { from: 'tip', to: 'merge' }, { from: 'merge', to: 'feature' }, { from: 'merge', to: 'branch' },
      { from: 'feature', to: 'branch' }, { from: 'branch', to: 'root' }
    ]);
  });
});
