import { CommitGraph, CommitViewGraph, RefVisibility } from './models';
import { CommitGraphBuilder } from './CommitGraphBuilder';

/** Compresses ordinary linear commits while retaining refs, forks, merges, and roots. */
export class SignificantCommitGraphBuilder {
  build(graph: CommitGraph, visibility: RefVisibility = { tags: true, remotes: false }): CommitViewGraph {
    const full = new CommitGraphBuilder().build(graph, visibility);
    const childCounts = new Map<string, number>();
    for (const node of graph.nodes.values()) {
      for (const parent of node.parents) childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
    }
    const visibleRefsByCommit = new Map(full.nodes.map(node => [node.id, node.refs]));
    const significant = new Set(graph.order.filter(id => {
      const node = graph.nodes.get(id)!;
      return (visibleRefsByCommit.get(id)?.length ?? 0) > 0 || node.parents.length !== 1 || (childCounts.get(id) ?? 0) > 1;
    }));
    const nodes = full.nodes.filter(node => significant.has(node.id)).map((node, row) => ({ ...node, row, y: 70 + row * 90 }));
    const edges = graph.order.filter(id => significant.has(id)).flatMap(from =>
      this.nearestSignificantAncestors(graph, graph.nodes.get(from)!.parents, significant).map(to => ({ from, to }))
    );
    return { nodes, edges };
  }

  private nearestSignificantAncestors(graph: CommitGraph, starts: string[], significant: Set<string>): string[] {
    const found = new Set<string>();
    const pending = [...starts];
    const visited = new Set<string>();
    while (pending.length) {
      const id = pending.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (significant.has(id)) { found.add(id); continue; }
      graph.nodes.get(id)?.parents.forEach(parent => pending.push(parent));
    }
    return [...found];
  }
}
