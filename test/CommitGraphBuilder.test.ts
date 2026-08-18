import { describe, expect, it } from 'vitest';
import { CommitGraphBuilder } from '../src/domain/CommitGraphBuilder';
import { CommitGraph, GitRef } from '../src/domain/models';

const ref = (name: string, type: GitRef['type'], commitId: string): GitRef => ({
  name,
  fullName: `refs/heads/${name}`,
  type,
  commitId,
});

describe('CommitGraphBuilder', () => {
  it('renders every loaded commit and both parents of a merge on distinct lanes', () => {
    const nodes = new Map();
    nodes.set('main', {
      id: 'main',
      parents: ['merge'],
      refs: [ref('main', 'localBranch', 'main')],
    });
    nodes.set('merge', { id: 'merge', parents: ['trunk', 'feature'], refs: [] });
    nodes.set('feature', {
      id: 'feature',
      parents: ['base'],
      refs: [ref('feature', 'localBranch', 'feature')],
    });
    nodes.set('trunk', { id: 'trunk', parents: ['base'], refs: [] });
    nodes.set('base', { id: 'base', parents: [], refs: [] });
    const graph: CommitGraph = { nodes, order: ['main', 'merge', 'feature', 'trunk', 'base'] };

    const view = new CommitGraphBuilder().build(graph);

    expect(view.nodes.map((node) => node.id)).toEqual(graph.order);
    expect(view.edges).toEqual([
      { from: 'main', to: 'merge' },
      { from: 'merge', to: 'trunk' },
      { from: 'merge', to: 'feature' },
      { from: 'feature', to: 'base' },
      { from: 'trunk', to: 'base' },
    ]);
    expect(view.nodes.find((node) => node.id === 'feature')?.lane).not.toBe(
      view.nodes.find((node) => node.id === 'trunk')?.lane,
    );
  });

  it('keeps commit nodes when their refs are hidden', () => {
    const nodes = new Map();
    nodes.set('head', { id: 'head', parents: [], refs: [ref('v1', 'tag', 'head')] });
    const view = new CommitGraphBuilder().build(
      { nodes, order: ['head'] },
      { tags: false, remotes: false },
    );
    expect(view.nodes).toHaveLength(1);
    expect(view.nodes[0].refs).toEqual([]);
  });
});
