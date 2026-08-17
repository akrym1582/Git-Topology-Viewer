import { CommitGraph, CommitViewGraph, GitRef, RefVisibility } from './models';

const TOP_PADDING = 70;
const ROW_HEIGHT = 64;
const LANE_WIDTH = 180;

/** Lays out the immutable commit DAG without inferring branch parentage. */
export class CommitGraphBuilder {
  build(graph: CommitGraph, visibility: RefVisibility = { tags: true, remotes: false }): CommitViewGraph {
    const lanes = this.lanesFor(graph);
    const nodes = graph.order.map((id, row) => {
      const node = graph.nodes.get(id)!;
      const lane = lanes.get(id) ?? 0;
      return {
        id,
        refs: node.refs.filter(ref => this.isVisibleRef(ref, visibility)),
        lane,
        row,
        x: 70 + lane * LANE_WIDTH,
        y: TOP_PADDING + row * ROW_HEIGHT
      };
    });
    const visible = new Set(graph.nodes.keys());
    const edges = graph.order.flatMap(from => graph.nodes.get(from)!.parents
      .filter(to => visible.has(to))
      .map(to => ({ from, to })));
    return { nodes, edges };
  }

  /** Assigns stable lanes from the full DAG so projections retain merge shape. */
  lanesFor(graph: CommitGraph): Map<string, number> {
    return this.assignLanes(graph);
  }

  private isVisibleRef(ref: GitRef, visibility: RefVisibility): boolean {
    return ref.type === 'localBranch'
      || (ref.type === 'tag' && visibility.tags)
      || (ref.type === 'remoteBranch' && visibility.remotes);
  }

  private assignLanes(graph: CommitGraph): Map<string, number> {
    const lanes = new Map<string, number>();
    const active: Array<string | undefined> = [];
    for (const id of graph.order) {
      let lane = active.indexOf(id);
      if (lane < 0) lane = active.findIndex(value => value === undefined);
      if (lane < 0) lane = active.length;
      active[lane] = id;
      lanes.set(id, lane);

      const parents = [...new Set(graph.nodes.get(id)!.parents.filter(parent => graph.nodes.has(parent)))];
      this.replaceWithParents(active, lane, parents);
      while (active.length > 0 && active.at(-1) === undefined) active.pop();
    }
    return lanes;
  }

  private replaceWithParents(active: Array<string | undefined>, lane: number, parents: string[]): void {
    const [first, ...remaining] = parents;
    active[lane] = first && !active.some((value, index) => index !== lane && value === first) ? first : undefined;
    let insertionLane = lane + 1;
    for (const parent of remaining) {
      if (active.includes(parent)) continue;
      active.splice(insertionLane, 0, parent);
      insertionLane++;
    }
  }
}
