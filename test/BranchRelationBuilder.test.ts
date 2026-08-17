import { describe, expect, it } from 'vitest';
import { BranchRelationBuilder } from '../src/domain/BranchRelationBuilder';
import { CommitGraph, GitRef } from '../src/domain/models';

const ref = (name: string, type: GitRef['type'], commitId: string): GitRef => ({ name, fullName: `${type === 'tag' ? 'refs/tags' : type === 'remoteBranch' ? 'refs/remotes' : 'refs/heads'}/${name}`, type, commitId });

describe('BranchRelationBuilder', () => {
  it('shows only ref groups and connects them across hidden commits', () => {
    const nodes = new Map();
    nodes.set('main', { id: 'main', parents: ['middle-2'], refs: [ref('main', 'localBranch', 'main')] });
    nodes.set('middle-2', { id: 'middle-2', parents: ['middle-1'], refs: [] });
    nodes.set('middle-1', { id: 'middle-1', parents: ['feature'], refs: [] });
    nodes.set('feature', { id: 'feature', parents: [], refs: [ref('feature', 'localBranch', 'feature')] });

    const view = new BranchRelationBuilder().build({ nodes, order: ['main', 'middle-2', 'middle-1', 'feature'] });

    expect(view.nodes.map(node => node.id)).toEqual(['main', 'feature']);
    expect(view.nodes.every(node => node.refs.length > 0)).toBe(true);
    expect(view.edges).toEqual([{ from: 'main', to: 'feature' }]);
  });

  it('keeps both nearest relations after a merge without inventing a branch parent', () => {
    const nodes = new Map();
    nodes.set('main', { id: 'main', parents: ['merge'], refs: [ref('main', 'localBranch', 'main')] });
    nodes.set('merge', { id: 'merge', parents: ['trunk', 'feature'], refs: [] });
    nodes.set('trunk', { id: 'trunk', parents: ['base'], refs: [] });
    nodes.set('feature', { id: 'feature', parents: ['base'], refs: [ref('feature', 'localBranch', 'feature')] });
    nodes.set('base', { id: 'base', parents: [], refs: [ref('base', 'localBranch', 'base')] });

    const view = new BranchRelationBuilder().build({ nodes, order: ['main', 'merge', 'feature', 'trunk', 'base'] });

    expect(view.edges).toContainEqual({ from: 'main', to: 'feature' });
    expect(view.edges).toContainEqual({ from: 'main', to: 'base' });
    expect(view.edges).toContainEqual({ from: 'feature', to: 'base' });
  });

  it('groups refs sharing a commit and applies tag and remote visibility', () => {
    const nodes = new Map();
    nodes.set('head', { id: 'head', parents: ['base'], refs: [ref('main', 'localBranch', 'head'), ref('v1', 'tag', 'head'), ref('origin/main', 'remoteBranch', 'head')] });
    nodes.set('base', { id: 'base', parents: [], refs: [ref('base', 'localBranch', 'base')] });
    const graph: CommitGraph = { nodes, order: ['head', 'base'] };

    const localOnly = new BranchRelationBuilder().build(graph, { tags: false, remotes: false });
    const allRefs = new BranchRelationBuilder().build(graph, { tags: true, remotes: true });

    expect(localOnly.nodes.find(node => node.id === 'head')?.refs.map(item => item.name)).toEqual(['main']);
    expect(allRefs.nodes.find(node => node.id === 'head')?.refs.map(item => item.name)).toEqual(['main', 'v1', 'origin/main']);
  });
});
