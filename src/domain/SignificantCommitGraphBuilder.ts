import { CommitGraph, CommitViewGraph, RefVisibility } from './models';
import { CommitGraphBuilder } from './CommitGraphBuilder';

interface LinearCommitGroup {
  id: string;
  commitIds: string[];
  lane: number;
  target?: string;
}

const LANE_WIDTH = 180;

export interface SignificantCommitGraphOptions {
  summarizeLinearCommits?: boolean;
}

/** Groups ordinary linear commits while retaining refs, forks, merges, and roots. */
export class SignificantCommitGraphBuilder {
  build(
    graph: CommitGraph,
    visibility: RefVisibility = { tags: true, remotes: false },
    options: SignificantCommitGraphOptions = {},
  ): CommitViewGraph {
    const summarizeLinearCommits = options.summarizeLinearCommits ?? true;
    const full = new CommitGraphBuilder().build(graph, visibility);
    const fullNodes = new Map(full.nodes.map((node) => [node.id, node]));
    const childCounts = new Map<string, number>();
    for (const node of graph.nodes.values()) {
      for (const parent of node.parents)
        childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
    }
    const visibleRefsByCommit = new Map(full.nodes.map((node) => [node.id, node.refs]));
    const significant = new Set(
      graph.order.filter((id) => {
        const node = graph.nodes.get(id)!;
        return (
          (visibleRefsByCommit.get(id)?.length ?? 0) > 0 ||
          node.parents.length !== 1 ||
          (childCounts.get(id) ?? 0) > 1
        );
      }),
    );
    const lanes = new CommitGraphBuilder().lanesFor(graph);
    if (summarizeLinearCommits) {
      for (const id of [...significant]) {
        for (const parent of graph.nodes.get(id)!.parents) {
          const group = this.groupAfter(parent, graph, significant, lanes);
          if (group?.commitIds.length === 1) significant.add(group.commitIds[0]);
        }
      }
    }
    const groupsBySource = new Map<string, LinearCommitGroup[]>();
    for (const id of graph.order.filter((candidate) => significant.has(candidate))) {
      const groups = graph.nodes
        .get(id)!
        .parents.map((parent) => this.groupAfter(parent, graph, significant, lanes))
        .filter((group): group is LinearCommitGroup => Boolean(group));
      if (groups.length) groupsBySource.set(id, groups);
    }

    const nodes = graph.order
      .flatMap((id) => {
        if (!significant.has(id)) return [];
        const node = fullNodes.get(id)!;
        const rendered = [{ ...node, row: 0, y: 0 }];
        for (const group of groupsBySource.get(id) ?? []) {
          if (!summarizeLinearCommits || group.commitIds.length === 1) continue;
          rendered.push({
            id: group.id,
            refs: [],
            lane: group.lane,
            row: 0,
            x: 70 + group.lane * LANE_WIDTH,
            y: 0,
            commitIds: group.commitIds,
          });
        }
        return rendered;
      })
      .map((node, row) => ({ ...node, row, y: 70 + row * 90 }));

    const edges = graph.order
      .filter((id) => significant.has(id))
      .flatMap((from) => {
        const source = graph.nodes.get(from)!;
        return source.parents.flatMap((parent) => {
          const group = groupsBySource
            .get(from)
            ?.find((candidate) => candidate.commitIds[0] === parent);
          if (!group) return significant.has(parent) ? [{ from, to: parent }] : [];
          if (!summarizeLinearCommits || group.commitIds.length === 1) {
            return group.target ? [{ from, to: group.target }] : [];
          }
          return [
            { from, to: group.id },
            ...(group.target ? [{ from: group.id, to: group.target }] : []),
          ];
        });
      });
    return { nodes, edges };
  }

  private groupAfter(
    start: string,
    graph: CommitGraph,
    significant: Set<string>,
    lanes: Map<string, number>,
  ): LinearCommitGroup | undefined {
    if (significant.has(start)) return undefined;
    const commitIds: string[] = [];
    const visited = new Set<string>();
    let current: string | undefined = start;
    while (current && !significant.has(current) && !visited.has(current)) {
      visited.add(current);
      commitIds.push(current);
      const node = graph.nodes.get(current);
      current = node?.parents.length === 1 ? node.parents[0] : undefined;
    }
    if (!commitIds.length) return undefined;
    return {
      id: `commit-group:${commitIds.join(':')}`,
      commitIds,
      lane: lanes.get(start) ?? 0,
      target: current && significant.has(current) ? current : undefined,
    };
  }
}
