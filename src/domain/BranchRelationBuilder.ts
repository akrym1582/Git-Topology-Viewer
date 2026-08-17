import { CommitGraph, GitRef, RefViewGraph, RefVisibility } from './models';

const TOP_PADDING = 90;
const ROW_HEIGHT = 120;
const LANE_WIDTH = 190;

/** Projects the commit DAG into visible ref groups without exposing commit nodes. */
export class BranchRelationBuilder {
  build(graph: CommitGraph, visibility: RefVisibility = { tags: true, remotes: false }): RefViewGraph {
    const refsByCommit = new Map<string, GitRef[]>();
    for (const node of graph.nodes.values()) {
      const refs = node.refs.filter(ref => this.isVisibleRef(ref, visibility));
      if (refs.length) refsByCommit.set(node.id, refs);
    }
    const visible = new Set(refsByCommit.keys());
    const ordered = graph.order.filter(id => visible.has(id));
    const ancestorCache = new Map<string, Set<string>>();
    const lanes = this.assignLanes(graph, ordered, visible, ancestorCache);
    const nodes = ordered.map((id, row) => ({
      id,
      refs: refsByCommit.get(id)!,
      lane: lanes.get(id)!,
      row,
      x: 70 + lanes.get(id)! * LANE_WIDTH,
      y: TOP_PADDING + row * ROW_HEIGHT
    }));
    const edges = ordered.flatMap(from => [...this.visibleAncestors(graph, graph.nodes.get(from)!.parents, visible, ancestorCache)]
      .map(to => ({ from, to })));
    return { nodes, edges };
  }

  private isVisibleRef(ref: GitRef, visibility: RefVisibility): boolean {
    return ref.type === 'localBranch'
      || (ref.type === 'tag' && visibility.tags)
      || (ref.type === 'remoteBranch' && visibility.remotes);
  }

  private assignLanes(graph: CommitGraph, order: string[], visible: Set<string>, ancestorCache: Map<string, Set<string>>): Map<string, number> {
    const lanes = new Map<string, number>();
    const active: string[] = [];
    for (const id of order) {
      let lane = active.indexOf(id);
      if (lane < 0) lane = active.findIndex(value => !value);
      if (lane < 0) lane = active.length;
      lanes.set(id, lane);
      for (let index = 0; index < active.length; index++) if (index !== lane && active[index] === id) active[index] = '';
      const parents = [...this.visibleAncestors(graph, graph.nodes.get(id)?.parents ?? [], visible, ancestorCache)];
      active[lane] = parents[0] ?? '';
      for (let index = 1; index < parents.length; index++) {
        let parentLane = active.indexOf(parents[index]);
        if (parentLane < 0) parentLane = active.findIndex(value => !value);
        if (parentLane < 0) parentLane = active.length;
        active[parentLane] = parents[index];
      }
    }
    return lanes;
  }

  private visibleAncestors(graph: CommitGraph, starts: string[], visible: Set<string>, cache: Map<string, Set<string>>): Set<string> {
    const visit = (id: string): Set<string> => {
      if (visible.has(id)) return new Set([id]);
      const cached = cache.get(id);
      if (cached) return cached;
      const node = graph.nodes.get(id);
      const ancestors = new Set<string>();
      if (node) node.parents.forEach(parent => visit(parent).forEach(ancestor => ancestors.add(ancestor)));
      cache.set(id, ancestors);
      return ancestors;
    };
    const result = new Set<string>();
    starts.forEach(start => visit(start).forEach(ancestor => result.add(ancestor)));
    return result;
  }
}
