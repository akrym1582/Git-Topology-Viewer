import { CommitGraph, GitRef, RefViewGraph, RefVisibility } from './models';
import { CommitGraphBuilder } from './CommitGraphBuilder';

const TOP_PADDING = 90;
const ROW_HEIGHT = 120;
const LANE_WIDTH = 190;

/** Projects the commit DAG into visible ref groups without exposing commit nodes. */
export class BranchRelationBuilder {
  build(
    graph: CommitGraph,
    visibility: RefVisibility = { tags: true, remotes: false },
  ): RefViewGraph {
    const refsByCommit = new Map<string, GitRef[]>();
    for (const node of graph.nodes.values()) {
      const refs = node.refs.filter((ref) => this.isVisibleRef(ref, visibility));
      if (refs.length) refsByCommit.set(node.id, refs);
    }
    const visible = new Set(refsByCommit.keys());
    const ordered = graph.order.filter((id) => visible.has(id));
    const orderIndex = new Map(graph.order.map((id, index) => [id, index]));
    const lanes = new CommitGraphBuilder().lanesFor(graph);
    const nodes = ordered.map((id, row) => ({
      id,
      refs: refsByCommit.get(id)!,
      lane: lanes.get(id)!,
      row,
      x: 70 + lanes.get(id)! * LANE_WIDTH,
      y: TOP_PADDING + row * ROW_HEIGHT,
    }));
    const edges = ordered.flatMap((from) => {
      const to = this.nearestVisibleAncestor(
        graph,
        graph.nodes.get(from)!.parents,
        visible,
        orderIndex,
      );
      return to ? [{ from, to }] : [];
    });
    return { nodes, edges };
  }

  private isVisibleRef(ref: GitRef, visibility: RefVisibility): boolean {
    return (
      ref.type === 'localBranch' ||
      (ref.type === 'tag' && visibility.tags) ||
      (ref.type === 'remoteBranch' && visibility.remotes)
    );
  }

  private nearestVisibleAncestor(
    graph: CommitGraph,
    starts: string[],
    visible: Set<string>,
    orderIndex: Map<string, number>,
  ): string | undefined {
    const pending = starts.map((id) => ({ id, distance: 1 }));
    const distances = new Map<string, number>();
    const candidates = new Set<string>();
    let bestDistance: number | undefined;
    for (let index = 0; index < pending.length; index++) {
      const { id, distance } = pending[index];
      if (bestDistance !== undefined && distance > bestDistance) break;
      const knownDistance = distances.get(id);
      if (knownDistance !== undefined && knownDistance <= distance) continue;
      distances.set(id, distance);
      if (visible.has(id)) {
        bestDistance = distance;
        candidates.add(id);
        continue;
      }
      graph.nodes
        .get(id)
        ?.parents.forEach((parent) => pending.push({ id: parent, distance: distance + 1 }));
    }
    return [...candidates].sort(
      (left, right) =>
        (orderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (orderIndex.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right),
    )[0];
  }
}
