import { describe, expect, it } from 'vitest';
import { SignificantCommitGraphBuilder } from '../src/domain/SignificantCommitGraphBuilder';
import { CommitGraph, GitRef } from '../src/domain/models';

const ref = (name: string, commitId: string): GitRef => ({
  name,
  fullName: `refs/heads/${name}`,
  type: 'localBranch',
  commitId,
});

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
    const graph: CommitGraph = {
      nodes,
      order: ['tip', 'merge', 'trunk', 'feature', 'branch', 'ordinary', 'root'],
    };

    const view = new SignificantCommitGraphBuilder().build(graph);

    expect(view.nodes.map((node) => node.id)).toEqual([
      'tip',
      'merge',
      'trunk',
      'feature',
      'branch',
      'ordinary',
      'root',
    ]);
    expect(view.nodes.find((node) => node.id === 'trunk')?.commitIds).toBeUndefined();
    expect(view.nodes.find((node) => node.id === 'ordinary')?.commitIds).toBeUndefined();
    expect(view.edges).toEqual([
      { from: 'tip', to: 'merge' },
      { from: 'merge', to: 'trunk' },
      { from: 'merge', to: 'feature' },
      { from: 'trunk', to: 'branch' },
      { from: 'feature', to: 'branch' },
      { from: 'branch', to: 'ordinary' },
      { from: 'ordinary', to: 'root' },
    ]);
  });

  it('places a multi-commit summary between significant commits', () => {
    const nodes = new Map([
      ['tip', { id: 'tip', parents: ['newer'], refs: [ref('main', 'tip')] }],
      ['newer', { id: 'newer', parents: ['middle'], refs: [] }],
      ['middle', { id: 'middle', parents: ['older'], refs: [] }],
      ['older', { id: 'older', parents: ['root'], refs: [] }],
      ['root', { id: 'root', parents: [], refs: [] }],
    ]);
    const graph: CommitGraph = { nodes, order: ['tip', 'newer', 'middle', 'older', 'root'] };

    const view = new SignificantCommitGraphBuilder().build(graph);

    expect(view.nodes.map((node) => node.id)).toEqual([
      'tip',
      'commit-group:newer:middle:older',
      'root',
    ]);
    expect(view.nodes[1].commitIds).toEqual(['newer', 'middle', 'older']);
    expect(view.edges).toEqual([
      { from: 'tip', to: 'commit-group:newer:middle:older' },
      { from: 'commit-group:newer:middle:older', to: 'root' },
    ]);
  });

  it('can omit ordinary linear commits while preserving structural nodes', () => {
    const nodes = new Map([
      ['tip', { id: 'tip', parents: ['newer'], refs: [ref('main', 'tip')] }],
      ['newer', { id: 'newer', parents: ['middle'], refs: [] }],
      ['middle', { id: 'middle', parents: ['root'], refs: [] }],
      ['root', { id: 'root', parents: [], refs: [] }],
    ]);
    const graph: CommitGraph = { nodes, order: ['tip', 'newer', 'middle', 'root'] };

    const view = new SignificantCommitGraphBuilder().build(graph, undefined, {
      summarizeLinearCommits: false,
    });

    expect(view.nodes.map((node) => node.id)).toEqual(['tip', 'root']);
    expect(view.edges).toEqual([{ from: 'tip', to: 'root' }]);
  });
});
